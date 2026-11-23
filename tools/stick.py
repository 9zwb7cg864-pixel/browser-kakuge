"""
棒人間レンダラー（Stick Fight風：太く丸い線・関節で途切れない・頭は丸）
  ・手足は「丸い端のカプセル」をつなげて描くので、関節で線が切れない
  ・奥の手足は暗い色、手前は明るい色。重なりの境目に暗い線
  ・速い攻撃には残像（スミア）を描く
  ・マフラー/布は物理計算（Verlet）で揺らす
"""
import math
import numpy as np
from scipy import ndimage
from art import Canvas, Rig, vdir, AX, AY, FW, FH, hexc, BAYER

STYLE = {
    # 道着キャラ男：デザイン画（光るシアンの棒人間・8頭身・丸い頭・細い手足・小さな関節の玉）
    'kokuu': dict(
        near=['#1aa8f0', '#5ce4ff', '#dcfcff'], far=['#0a5590', '#168ac8', '#46c0f0'],
        acc=['#e6fdff', '#ffffff'], scarf=['#1b7fb8', '#56e0ff', '#c8f8ff'],
        outline='#020a14', glow='#00c8ff', smear='#c8f8ff',
        limb=2.7, leg=3.1, torso=(4.4, 3.4), head=9.6, neck=1.9, fist=3.7, foot=3.0,
        joints=3.4, bloom=1.35, pixel=3),
    'shuuen': dict(
        near=['#a0108e', '#ff3fe6', '#ffb0f6'], far=['#560a50', '#8a1680', '#c02cb4'],
        acc=['#ffe0fb', '#ffffff'], scarf=['#5a0a52', '#a8169a', '#ff5ae8'],
        outline='#10020e', glow='#ff1fd2', smear='#ffd0f8',
        limb=4.8, leg=5.4, torso=(8.6, 6.6), head=9.0, neck=3.6, fist=5.6, foot=4.2),
}
G_FAR, G_SCARF, G_BODY, G_NEAR, G_SMEAR, G_WEAP = 1, 2, 3, 4, 5, 6

# 変身キャラ男：ハンマー形態（金）と大盾形態（緑）。武器はどちらも前側の手（右手）で持つ
STYLE['gai_h'] = dict(
    near=['#b86a08', '#ffb22a', '#ffe7a6'], far=['#5e3604', '#94580a', '#c98316'],
    acc=['#fff3d6', '#ffffff'], scarf=['#7a3a04', '#d06a10', '#ffb04a'],
    weap=['#4a4e5a', '#a9b2c4', '#f4f8ff'],
    outline='#140a02', glow='#ff9a00', smear='#ffe8b8',
    limb=4.6, leg=5.2, torso=(8.2, 6.4), head=8.8, neck=3.4, fist=5.2, foot=4.0)
STYLE['gai_s'] = dict(
    near=['#0c9a52', '#34f594', '#b6ffd6'], far=['#064e2a', '#0c8044', '#1cae62'],
    acc=['#e0fff0', '#ffffff'], scarf=['#06502c', '#10944e', '#4cf09a'],
    weap=['#3e5a50', '#9cc4b4', '#eafff6'],
    outline='#021208', glow='#00ff86', smear='#c8ffe2',
    limb=4.6, leg=5.2, torso=(8.2, 6.4), head=8.8, neck=3.4, fist=5.2, foot=4.0)
WEAP = {'gai_h': 'hammer', 'gai_s': 'shield'}


def ang_of(v):
    return math.degrees(math.atan2(v[0], v[1]))


def weapon_joints(kind, J, P):
    """武器の位置を関節として足す（当たり判定にも使う）
       ハンマー：wa＝胴の向きからの傾き（前へ倒すと＋）／ wf＝前腕の向きからのずれ
       大盾：sa＝胴の向きからの傾き"""
    w = WEAP.get(kind)
    if not w:
        return J
    hand = J['hand_r']
    ta = ang_of(J['u'])
    if w == 'hammer':
        if 'wf' in P:
            a = J['farm_ang_r'] + P['wf']
        else:
            a = ta - P.get('wa', 25)
        d = vdir(a)
        J['tool'] = hand + d * 34
        J['tool_b'] = hand - d * 10
        J['tool_ang'] = a
    else:
        a = ta - P.get('sa', 0)
        d = vdir(a); f = vdir(a - 90)
        c = hand + f * 4
        J['shld'] = c
        J['shld_t'] = c + d * 38
        J['shld_b'] = c - d * 34
        J['shld_ang'] = a
    return J


# ------------------------------------------------------------------ 布の物理
class Cloth:
    """先端が体の1点に固定された紐（マフラー・布）。フレーム間の時間で物理を進める"""
    def __init__(self, n, seg, grav=0.32, drag=0.86, stiff=3):
        self.n, self.seg, self.grav, self.drag, self.stiff = n, seg, grav, drag, stiff
        self.p = None; self.q = None

    def step(self, anchor, frames, world_dx, wind=0.0):
        anchor = np.asarray(anchor, float)
        if self.p is None:
            self.p = np.array([anchor + np.array([-i * self.seg, i * 1.0]) for i in range(self.n)])
            self.q = self.p.copy()
        sub = max(1, int(round(frames)))
        # 体が世界の中を動いた分は、布にとっては逆向きの風
        rel = -np.asarray(world_dx, float) / sub
        a0 = self.p[0].copy()
        for k in range(sub):
            t = (k + 1) / sub
            a = a0 + (anchor - a0) * t
            v = (self.p - self.q) * self.drag
            self.q = self.p.copy()
            self.p = self.p + v
            self.p[:, 1] += self.grav
            self.p += rel * 0.9
            self.p[:, 0] -= wind
            self.p[0] = a
            for _ in range(self.stiff):
                for i in range(1, self.n):
                    d = self.p[i] - self.p[i - 1]
                    L = np.hypot(*d) + 1e-6
                    self.p[i] = self.p[i - 1] + d * (self.seg / L)
                # 地面にはめり込まない
                self.p[:, 1] = np.minimum(self.p[:, 1], AY - 2)
        return self.p.copy()


# ------------------------------------------------------------------ 描画
def render(kind, J, P, cloth_pts=(), smears=()):
    S = STYLE[kind]
    cv = Canvas()
    cv.joints = J
    u, p = J['u'], J['p']
    L, Lg = S['limb'], S['leg']
    big = 1.0

    # 残像（スミア）：手足の通り道を一番奥に
    for (a, b, r) in smears:
        cv.cone(a, b, r, r * 0.6, -30, G_SMEAR, 9, 1.0)

    # 布（体の後ろ）
    for pts in cloth_pts:
        n = len(pts)
        for i in range(n - 1):
            w0 = S['limb'] * (1.05 - 0.55 * i / n)
            w1 = S['limb'] * (1.05 - 0.55 * (i + 1) / n)
            cv.cone(pts[i], pts[i + 1], w0, w1, -10 + i * 0.1, G_SCARF, 7, 1.0)

    JR = S.get('joints')   # 関節の玉の半径（デザイン画のキャラだけ）

    def leg(side, zb, g, mat):
        H, K, A, T = J['hip_' + side], J['kn_' + side], J['an_' + side], J['toe_' + side]
        cv.cone(H, K, Lg, Lg * 0.92, zb, g, mat)
        cv.merge().cone(K, A, Lg * 0.92, Lg * 0.8, zb, g, mat)
        cv.merge().cone(A, T, S['foot'], S['foot'] * 0.75, zb + 0.5, g, mat)
        if JR:
            cv.merge().sphere(K, JR, zb + 0.6, g, mat)

    def arm(side, zb, g, mat):
        Sh, E, W, Hd = J['sh_' + side], J['el_' + side], J['wr_' + side], J['hand_' + side]
        cv.cone(Sh, E, L, L * 0.9, zb, g, mat)
        cv.merge().cone(E, W, L * 0.9, L * 0.8, zb, g, mat)
        if JR:
            cv.merge().sphere(E, JR * 0.92, zb + 0.6, g, mat)
        hs = P.get('h' + side, 'fist')
        fa = J['farm_ang_' + side]
        if hs == 'open':
            cv.merge().cone(W, Hd + vdir(fa) * 3, S['fist'] * 0.8, S['fist'] * 0.6, zb + 0.5, g, mat)
        elif hs == 'claw':
            cv.merge().sphere(Hd, S['fist'] * 0.95, zb + 0.5, g, mat)
            for k in (-40, 0, 40):
                cv.merge().cone(Hd, Hd + vdir(fa + k) * 6.5, 1.5, 0.8, zb + 0.6, g, mat)
        else:
            cv.merge().sphere(Hd, S['fist'], zb + 0.5, g, mat)

    # 奥の手足
    leg('l', 0, G_FAR, 2)
    arm('l', 1, G_FAR, 2)
    # 胴体・首・頭（一続き）
    pel, mid, neck = J['pelvis'], J['mid'], J['neck']
    tw0, tw1 = S['torso']
    cv.cone(pel, mid, tw1, tw1 * 1.02, 10, G_BODY, 1)
    cv.merge().cone(mid, neck, tw1 * 1.02, tw0, 10, G_BODY, 1)
    cv.merge().cone(J['sh_l'], J['sh_r'], L * 1.05, L * 1.05, 10, G_BODY, 1)
    cv.merge().cone(neck, J['head'], S['neck'], S['neck'], 10, G_BODY, 1)
    if JR:
        cv.merge().ellipse(pel, JR * 1.6, JR * 1.15, 180 - ang_of(u), 10.5, G_BODY, 1)   # 腰の円盤
    ha = J['head_ang']
    tilt = 180 - ha
    if kind == 'kokuu':
        vis = [(lambda lx, ly: (lx > -1.0) & (np.abs(ly + 0.6) < 1.3), 1)]
    else:
        vis = [(lambda lx, ly: (lx > -0.5) & (np.abs(ly + 0.4 - (lx + 0.5) * 0.42) < 1.0), 1)]
    cv.merge().ellipse(J['head'], S['head'], S['head'] * 1.06, tilt, 10, G_BODY, 1)   # 顔の線は描かない
    if kind == 'shuuen':
        hd = J['head']; up = vdir(ha); fw = vdir(ha - 90)
        for (l, a, o) in ((10, 35, 2), (8, 60, -2)):
            base = hd - fw * 3 + up * (5 + o)
            cv.merge().cone(base, base + vdir(ha + a) * l, 2.6, 0.6, 10, G_BODY, 1)
    # 手前の手足
    leg('r', 14, G_NEAR, 1)
    arm('r', 20, G_NEAR, 1)
    # 武器（体の手前）
    w = WEAP.get(kind)
    if w == 'hammer':
        a = J['tool_ang']; n = vdir(a + 90); hd = J['tool']
        cv.cone(J['tool_b'], hd, 2.4, 2.4, 22, G_WEAP, 8)
        cv.merge().cone(hd - n * 12, hd + n * 12, 9.0, 9.0, 23, G_WEAP, 8)
        cv.merge().sphere(hd - n * 13, 7.4, 23.5, G_WEAP, 8)
        cv.merge().sphere(hd + n * 13, 7.4, 23.5, G_WEAP, 8)
    elif w == 'shield':
        a = J['shld_ang']; f = vdir(a - 90)
        cv.cone(J['shld_b'], J['shld_t'], 11.0, 11.0, 24, G_WEAP, 8)
        cv.merge().sphere(J['shld'] + f * 6, 6.0, 25, G_WEAP, 8)
    out = shade(cv, S)
    if S.get('pixel'):
        out = pixelate(out, S)
    return out


def shade(cv, S):
    mask = cv.H > -1e8
    out = np.zeros((cv.h, cv.w, 4), np.uint8)
    yy, xx = np.mgrid[0:cv.h, 0:cv.w]
    # 簡単な立体感：各部位の中心線より上側を明るく（高さマップの勾配から）
    Hf = np.where(mask, cv.H, 0)
    gy = np.roll(Hf, 1, 0) - Hf  # 上の画素の方が高い＝下向き面
    gx = np.roll(Hf, 1, 1) - Hf
    lit = (-gy * 0.7 - gx * 0.5)
    rim = np.zeros_like(mask)
    for mat, ramp in ((1, S['near']), (2, S['far']), (7, S['scarf']), (8, S.get('weap', S['near']))):
        sel = mask & (cv.M == mat)
        if not sel.any():
            continue
        cols = np.array([hexc(c) for c in ramp], np.float32)
        cols = (cols + (255 - cols) * 0.32).astype(np.uint8)   # 全体を明るく（発光）
        v = np.where(lit > 0.35, 2, np.where(lit > -0.6, 1, 0))
        out[sel, :3] = cols[v[sel]]
        out[sel, 3] = 255
    # バイザー（顔の光る帯）
    vs = mask & (cv.L > 0)
    out[vs, :3] = hexc(S['acc'][1])
    # 残像（半透明のディザ）
    sm = mask & (cv.M == 9)
    if sm.any():
        dith = BAYER[yy % 4, xx % 4] < 0.1
        sel = sm & dith
        out[sm, :3] = hexc(S['smear']); out[sm, 3] = 0
        out[sel, 3] = 150
        out[sm & ~dith, 3] = 70
    body = mask & (cv.M != 9)
    # 重なりの境目（奥側に暗い線）
    Hb = np.where(body, cv.H, -1e9)
    seam = np.zeros_like(mask)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        Hn = np.roll(np.roll(Hb, dy, 0), dx, 1)
        Gn = np.roll(np.roll(cv.G, dy, 0), dx, 1)
        seam |= body & (Gn != cv.G) & (Hn > Hb + 1.5)
    # 体とつながる関節のまわりには線を引かない（関節で途切れて見えないように）
    J = cv.joints
    keep = np.ones_like(mask)
    for k, r in (('sh_l', 7), ('sh_r', 7), ('hip_l', 8), ('hip_r', 8), ('neck', 6), ('el_l', 5), ('el_r', 5), ('kn_l', 5), ('kn_r', 5)):
        c = J[k]
        keep &= (xx + 0.5 - c[0]) ** 2 + (yy + 0.5 - c[1]) ** 2 > r * r
    seam &= keep
    out[seam, :3] = (np.array(hexc(S['far'][0]), np.float32) * 0.8).astype(np.uint8)
    # 外側1pxの輪郭
    ring = ndimage.binary_dilation(body) & ~body
    gc = np.array(hexc(S['glow']), np.float32)
    out[ring, :3] = (gc + (255 - gc) * 0.55).astype(np.uint8); out[ring, 3] = 255   # 明るい縁取り
    # 外側の発光：近くの強い光 ＋ 広くにじむ光
    b = body.astype(np.float32)
    bl = S.get('bloom', 1.0)
    inner = np.clip(ndimage.gaussian_filter(b, 2.2 * bl) * 2.2 * bl, 0, 1)
    outer = np.clip(ndimage.gaussian_filter(b, 6.0 * bl) * 2.4 * bl, 0, 1)
    a = np.maximum(inner * 0.8, outer * 0.46)
    a = np.floor(a * 8) / 8
    gsel = ~body & ~ring & (a > 0) & ~sm
    out[gsel, :3] = gc.astype(np.uint8); out[gsel, 3] = (a[gsel] * 255).astype(np.uint8)
    return out


def pixelate(img, S, k=None):
    """ドット絵にする：k×k画素を1ドットにまとめ、色を少ない色数に寄せ、透明度も段階にする。
       大きさは元のまま（k倍に拡大して戻す）なので、ゲーム側の位置や当たり判定はそのまま"""
    k = k or S['pixel']
    h, w = img.shape[:2]
    H, W = (h + k - 1) // k, (w + k - 1) // k
    pad = np.zeros((H * k, W * k, 4), np.float32); pad[:h, :w] = img
    blk = pad.reshape(H, k, W, k, 4).transpose(0, 2, 1, 3, 4).reshape(H, W, k * k, 4)
    a = blk[..., 3] / 255.0
    cov = a.mean(axis=2)                                   # どれだけ埋まっているか
    wsum = a.sum(axis=2, keepdims=True) + 1e-6
    col = (blk[..., :3] * a[..., None]).sum(axis=2) / wsum  # 透明でない画素の平均色
    solid = (blk[..., 3] >= 250).mean(axis=2)              # 体（不透明）の割合
    # 使う色：体の明暗3色×手前/奥＋白い芯＋縁の明るい色＋発光の色
    gc = np.array(hexc(S['glow']), np.float32)
    pal = [hexc(c) for c in S['near']] + [hexc(c) for c in S['far']] + [hexc(S['acc'][1])]
    pal = [tuple(int(v + (255 - v) * 0.32) for v in c) for c in pal]
    pal += [tuple(int(v) for v in (gc + (255 - gc) * 0.55)), tuple(int(v) for v in gc)]
    pal = np.array(pal, np.float32)
    d = ((col[..., None, :] - pal[None, None]) ** 2).sum(-1)
    q = pal[d.argmin(-1)]
    out = np.zeros((H, W, 4), np.uint8)
    body = solid >= 0.34
    out[body, :3] = q[body]; out[body, 3] = 255
    # 発光は3段階の透明度（ドット絵らしく）
    glow = ~body & (cov > 0.08)
    lv = np.where(cov > 0.5, 170, np.where(cov > 0.25, 110, 55))
    out[glow, :3] = gc.astype(np.uint8); out[glow, 3] = lv[glow]
    big = out.repeat(k, 0).repeat(k, 1)[:h, :w]
    return np.ascontiguousarray(big)
