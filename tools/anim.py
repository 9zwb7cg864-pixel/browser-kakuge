"""
アニメーション制作システム
  ・キーポーズ間を補間し、各フレームごとに全身を描き直してPNG化する
  ・フレームごとに「表示時間（ゲームフレーム数）」と「段階（予備動作s/発生・持続a/戻りr）」を持つ
  ・当たり判定（やられ判定）を各フレームの関節位置から自動で算出して書き出す
  ・攻撃判定は持続フレームの攻撃部位（拳・足など）の位置から算出する
    → 絵と判定が必ず一致する
座標は「足元基準点(112,190)からの相対」。yは上がマイナス。
"""
import json, math, os
import numpy as np
from PIL import Image
from art import Rig, AX, AY, FW, FH, ik2, vdir, lerp_ang
import chars

RIG = Rig(chars.DIMS)


def dist(total, n):
    """total ゲームフレームを n 枚の絵に配分"""
    n = max(1, n)
    base = [total // n] * n
    for i in range(total - sum(base)):
        base[n - 1 - i] += 1
    return [max(1, b) for b in base]


def ease(t, kind):
    if kind == 'lin':
        return t
    if kind == 'out':
        return 1 - (1 - t) ** 2.2
    if kind == 'in':
        return t ** 2
    if kind == 'snap':
        return 1 - (1 - t) ** 3.5
    return t * t * (3 - 2 * t)  # 'io'


def limb_to_fk(pose, key, is_arm):
    spec = pose[key]
    if spec[0] == 'fk':
        return spec
    J = RIG.solve(pose)
    side = key[1]
    if is_arm:
        S = J['sh_' + side]; E = J['el_' + side]; W = J['wr_' + side]
        a1 = math.degrees(math.atan2(*(E - S))); a2 = math.degrees(math.atan2(*(W - E)))
        return ('fk', a1, a2 - a1)
    H = J['hip_' + side]; K = J['kn_' + side]; A = J['an_' + side]
    a1 = math.degrees(math.atan2(*(K - H))); a2 = math.degrees(math.atan2(*(A - K)))
    return ('fk', a1, a1 - a2)


def interp(p0, p1, t):
    out = {}
    for k in set(p0) | set(p1):
        a = p0.get(k, p1.get(k)); b = p1.get(k, a)
        if k in ('al', 'ar', 'll', 'lr'):
            is_arm = k[0] == 'a'
            if a[0] == 'ik' and b[0] == 'ik':
                bend = b[3] if len(b) > 3 else (a[3] if len(a) > 3 else None)
                v = ('ik', a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
                out[k] = v + ((bend,) if bend is not None else ())
            else:
                fa = limb_to_fk(p0, k, is_arm) if a[0] == 'ik' else a
                fb = limb_to_fk(p1, k, is_arm) if b[0] == 'ik' else b
                out[k] = ('fk', lerp_ang(fa[1], fb[1], t), fa[2] + (fb[2] - fa[2]) * t)
        elif isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
            out[k] = a + (b - a) * t
        else:
            out[k] = b if t >= 0.5 else a
    return out


class Anim:
    """keys: [(pose, n_art_frames, game_frames_total, phase, ease)]"""
    def __init__(self, name, loop=False, hit=None, vx=0.0, flags=None):
        self.name, self.loop, self.hit, self.vx = name, loop, hit, vx
        self.keys = []
        self.flags = flags or {}

    def key(self, pose, n=1, frames=None, ph='-', e='io'):
        frames = frames if frames is not None else n * 3
        self.keys.append((dict(pose), n, frames, ph, e))
        return self

    def frames(self):
        out = []
        prev = None
        for (pose, n, total, ph, e) in self.keys:
            durs = dist(total, n)
            for i in range(n):
                if prev is None:
                    P = dict(pose)
                else:
                    P = interp(prev, pose, ease((i + 1) / n, e))
                out.append((P, durs[i], ph))
            prev = pose
        return out


def hurtboxes(J):
    def rel(p):
        return (float(p[0] - AX), float(p[1] - AY))
    boxes = []
    hx, hy = rel(J['head'])
    boxes.append([hx - 9, hy - 10, 18, 20])
    pts = [rel(J[k]) for k in ('neck', 'sh_l', 'sh_r', 'pelvis', 'mid', 'hip_l', 'hip_r')]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    boxes.append([min(xs) - 7, min(ys) - 4, max(xs) - min(xs) + 14, max(ys) - min(ys) + 10])
    pts = [rel(J[k]) for k in ('hip_l', 'hip_r', 'kn_l', 'kn_r', 'an_l', 'an_r')]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    boxes.append([min(xs) - 8, min(ys), max(xs) - min(xs) + 16, max(ys) - min(ys) + 8])
    # 伸ばした手足（胴体から離れたもの）も食らい判定に含める
    tor = boxes[1]
    for k in ('hand_l', 'hand_r', 'toe_l', 'toe_r', 'kn_l', 'kn_r'):
        x, y = rel(J[k])
        if x > tor[0] + tor[2] + 6 or x < tor[0] - 6:
            boxes.append([x - 6, y - 6, 12, 12])
    return [[round(v, 1) for v in b] for b in boxes]


def hitbox(J, hit):
    joint, r = hit[0], hit[1]
    p = J[joint]
    x, y = float(p[0] - AX), float(p[1] - AY)
    if len(hit) > 2:  # 関節から部位方向へ延長（腕全体・脚全体など）
        q = J[hit[2]]
        qx, qy = float(q[0] - AX), float(q[1] - AY)
        x0, x1 = min(x, qx) - r, max(x, qx) + r
        y0, y1 = min(y, qy) - r, max(y, qy) + r
        return [round(x0, 1), round(y0, 1), round(x1 - x0, 1), round(y1 - y0, 1)]
    return [round(x - r, 1), round(y - r, 1), round(2 * r, 1), round(2 * r, 1)]


def build_anim(kind, anim, outdir, t0=0.0):
    frs = anim.frames()
    imgs, meta = [], []
    t = t0
    prev_px = None
    for i, (P, dur, ph) in enumerate(frs):
        P = dict(P)
        t += dur / 10.0
        P['_t'] = t
        vx = anim.vx + ((P['px'] - prev_px) / max(dur, 1) if prev_px is not None else 0)
        P['_vx'] = P.get('_vx', vx)
        prev_px = P['px']
        img, J, cv = chars.render(kind, P, RIG)
        imgs.append(img)
        m = {'d': int(dur), 'ph': ph, 'hurt': hurtboxes(J)}
        if ph == 'a' and anim.hit:
            hits = anim.hit if isinstance(anim.hit[0], (list, tuple)) else [anim.hit]
            m['hit'] = [hitbox(J, h) for h in hits]
        m['j'] = {k: [round(float(J[k][0] - AX), 1), round(float(J[k][1] - AY), 1)]
                  for k in ('hand_l', 'hand_r', 'toe_l', 'toe_r', 'head', 'pelvis', 'neck')}
        meta.append(m)
    # スプライトシート（横一列）
    n = len(imgs)
    sheet = Image.new('RGBA', (FW * n, FH), (0, 0, 0, 0))
    for i, im in enumerate(imgs):
        sheet.paste(Image.fromarray(im), (i * FW, 0))
    fn = f'{kind}_{anim.name}.png'
    sheet.save(os.path.join(outdir, fn), optimize=True)
    return {'file': fn, 'loop': anim.loop, 'frames': meta, 'flags': anim.flags}, imgs
