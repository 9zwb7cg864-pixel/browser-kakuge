"""
モーション制作システム（第2版：モーション重視）
  k(pose, f, ph, e, hold, lag)
    f    : 前のキーからこのポーズまでのゲームフレーム数（60fps）
    ph   : この区間の段階  s=予備動作  a=攻撃判定あり  r=戻り  -=その他
    e    : 緩急  io=なめらか  out=打ち出し  snap=一気に  back=行き過ぎて戻る  in=溜める
    hold : ポーズに到達してから止める時間（打撃の「当たった瞬間の静止」）。止めている間もわずかに動かす
    lag  : 腕が体より遅れてついてくる量（腰→肩→拳の順に動く、鞭のような動き）
  ・コマ割り：4F以下の速い区間は1Fごと、それ以外は2Fごと、長い区間は3Fごとに全身を描き直す
  ・速く動いた拳・足には残像を描く
  ・マフラー/布は前後のフレームの動きから物理計算する（ループはなじむまで2周回す）
"""
import math, os
import numpy as np
from PIL import Image
from art import Rig, AX, AY, FW, FH, lerp_ang
import chars
import stick
from anim import interp as interp_pose, hurtboxes, hitbox, limb_to_fk

RIG = Rig(chars.DIMS)


def ease(t, e):
    t = max(0.0, min(1.0, t))
    if e == 'lin': return t
    if e == 'out': return 1 - (1 - t) ** 2.4
    if e == 'snap': return 1 - (1 - t) ** 4
    if e == 'in': return t ** 2.2
    if e == 'back':
        s = 1.9
        t1 = t - 1
        return 1 + (s + 1) * t1 ** 3 + s * t1 ** 2
    return t * t * (3 - 2 * t)


ARM_KEYS = ('al', 'ar', 'hl', 'hr')


def interp(p0, p1, t, e, lag):
    tb = ease(t, e)
    ta = ease((t - lag) / (1 - lag), e) if lag > 0 else tb
    th = ease((t - lag * 0.6) / (1 - lag * 0.6), e) if lag > 0 else tb
    base = interp_pose(p0, p1, tb)
    if lag > 0:
        arms = interp_pose(p0, p1, ta)
        head = interp_pose(p0, p1, th)
        for k in ARM_KEYS:
            if k in arms: base[k] = arms[k]
        base['hd'] = head['hd']
    return base


class A:
    def __init__(self, name, loop=False, hit=None, vx=0.0, wy=None, flags=None, smear=True, cloth_wind=0.0):
        self.name, self.loop, self.hit, self.vx, self.wy = name, loop, hit, vx, wy
        self.flags = flags or {}
        self.keys = []
        self.smear = smear
        self.wind = cloth_wind

    def k(self, pose, f=1, ph='-', e='io', hold=0, lag=0.0, step=None, vx=None):
        self.keys.append(dict(pose=dict(pose), f=f, ph=ph, e=e, hold=hold, lag=lag, step=step, vx=vx))
        return self

    def frames(self):
        out = []
        prev = None
        for kk in self.keys:
            pose, f = kk['pose'], kk['f']
            if prev is None:
                # 攻撃の出始めは構えのままの静止コマを入れない（押したフレームから動き出す＝発生を格ゲー並みに）
                if not (kk['ph'] == 's' and len(self.keys) > 1):
                    out.append((dict(pose), max(1, f), kk['ph'], kk['vx']))
            else:
                step = kk['step'] or (1 if f <= 4 else (2 if f <= 18 else 3))
                n = max(1, int(round(f / step)))
                durs = [f // n] * n
                for i in range(f - sum(durs)):
                    durs[n - 1 - i] += 1
                for i in range(n):
                    P = interp(prev, pose, (i + 1) / n, kk['e'], kk['lag'])
                    out.append((P, max(1, durs[i]), kk['ph'], kk['vx']))
            if kk['hold']:
                # 止めの間も、わずかに沈み込む（静止画にしない）
                Ph = dict(pose)
                Ph['py'] = Ph.get('py', -70) + 0.8
                Ph['lean'] = Ph.get('lean', 0) + 0.8
                out.append((Ph, kk['hold'], kk['ph'], kk['vx']))
            prev = pose
        return out


def cloth_anchor(kind, J):
    u, p = J['u'], J['p']
    if kind.startswith('gai'):
        return [J['pelvis'] - p * 5 + u * 6]      # 腰の帯
    if kind == 'kokuu':
        return [J['neck'] + u * 2 - p * 3]
    return [J['sh_r'] - p * 3 + u * 1, J['pelvis'] - p * 6 + u * 4]


def make_cloths(kind):
    if kind.startswith('gai'):
        return [stick.Cloth(8, 5.5, grav=0.34, drag=0.86)]
    if kind == 'kokuu':
        return []   # デザイン画のキャラはマフラーなし
    return [stick.Cloth(8, 6.0, grav=0.36, drag=0.86), stick.Cloth(9, 6.5, grav=0.4, drag=0.84)]


def build(kind, anim, outdir):
    frs = anim.frames()
    sols = []
    for (P, d, ph, vx) in frs:
        P = dict(P)
        J = stick.weapon_joints(kind, RIG.solve(P), P)
        sols.append((P, J, d, ph, vx))
    # 布の物理（ループは2周回してなじませる）
    cloths = make_cloths(kind)
    passes = 2 if anim.loop else 1
    cloth_res = [None] * len(sols)
    # 最初のポーズで布を垂らしておく（なじませ）
    a0 = cloth_anchor(kind, sols[0][1])
    v0 = anim.vx if sols[0][4] is None else sols[0][4]
    for _ in range(40):
        for c, a in zip(cloths, a0):
            c.step(a, 2, np.array([v0 * 2, 0.0]), anim.wind)
    for ps in range(passes):
        for i, (P, J, d, ph, vx) in enumerate(sols):
            v = anim.vx if vx is None else vx
            wy = 0.0
            if anim.wy is not None:
                wy = anim.wy(i, len(sols)) if callable(anim.wy) else anim.wy
            world = np.array([v * d, wy * d])
            anchors = cloth_anchor(kind, J)
            pts = [c.step(a, d, world, anim.wind) for c, a in zip(cloths, anchors)]
            if ps == passes - 1:
                cloth_res[i] = pts
    imgs, meta = [], []
    prevJ = None
    for i, (P, J, d, ph, vx) in enumerate(sols):
        smears = []
        if anim.smear and prevJ is not None and ph in ('s', 'a'):
            pairs = [('hand_l', 'el_l'), ('hand_r', 'el_r'), ('toe_l', 'an_l'), ('toe_r', 'an_r')]
            if 'tool' in J: pairs.append(('tool', 'hand_r'))
            if 'shld_t' in J: pairs.append(('shld_t', 'shld_b'))
            for jn, en in pairs:
                if jn not in prevJ: continue
                dv = J[jn] - prevJ[jn]
                if np.hypot(*dv) > 14:
                    r = stick.STYLE[kind]['limb'] * 1.25
                    smears.append((prevJ[jn], J[jn], r))
                    smears.append(((prevJ[en] + prevJ[jn]) / 2, (J[en] + J[jn]) / 2, r * 0.8))
        img = stick.render(kind, J, P, cloth_res[i], smears)
        imgs.append(img)
        m = {'d': int(d), 'ph': ph, 'hurt': hurtboxes(J)}
        if ph == 'a' and anim.hit:
            hits = anim.hit if isinstance(anim.hit[0], (list, tuple)) else [anim.hit]
            m['hit'] = [hitbox(J, h) for h in hits]
        m['j'] = {k: [round(float(J[k][0] - AX), 1), round(float(J[k][1] - AY), 1)]
                  for k in ('hand_l', 'hand_r', 'toe_l', 'toe_r', 'head', 'pelvis', 'neck', 'tool', 'shld') if k in J}
        meta.append(m)
        prevJ = J
    n = len(imgs)
    sheet = Image.new('RGBA', (FW * n, FH), (0, 0, 0, 0))
    for i, im in enumerate(imgs):
        sheet.paste(Image.fromarray(im), (i * FW, 0))
    fn = f'{kind}_{anim.name}.png'
    sheet.save(os.path.join(outdir, fn), optimize=True)
    return {'file': fn, 'loop': anim.loop, 'frames': meta, 'flags': anim.flags}, imgs
