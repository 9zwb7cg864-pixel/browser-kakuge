"""
motion3: 立体（3D）の骨組みで作る格闘の動き。
腰と胸の向き（ひねり）・軸足の回転・かかとの上げ下げを持たせ、横から見た形に写す。

参考にしたもの（調べて読んだ内容）
- 構え：前足のつま先と後ろ足のかかとを一直線、ひざは柔らかく曲げる、前の肩を相手へ・あごは前の肩の後ろ
  揺れは上がりをゆっくり・下がりを速く。拳は胴体の2〜4倍動き、頭は一瞬止まる（Pixelblog 52）
- ジャブ：前の手を一直線。腰は少し開くだけで脚は張ったまま、頭を前に出さない、前足を少し滑らせる
- ストレート：後ろ足の母指球で回り、かかとが上がる。後ろの腰と肩を相手へ、前の肩は引く。背中はまっすぐ、頭は上
- 逆突き：前足を出して前屈立ち（前のすねは垂直・後ろ足は伸ばす・後ろのつま先は約30度）、
  ひじは脇をこすって出し最後に拳をひねる。引き手は脇をこすって腰へ（日本武道館 空手道指導書）
- 前蹴り：ももを上げて上足底で蹴る、足の指を上げる、引き足をしてから立ちへ戻る（同）
- 回し蹴り：ひざを上げ、軸足の母指球で90〜180度回してかかとを相手へ、腰を返す（へそが相手と逆を向く）
  上体を後ろへ倒して釣り合いを取り、頭はまっすぐ。蹴ったら同じ道を通って抱え込みに戻す
- 動き全般：ためは短く、伸びきった形は少し長く見せる、戻りで一度だけ行き過ぎる（Pixelblog 9）

座標：x＝相手の方向（右向き）、y＝上、z＝手前（画面のこちら側）。地面は y=0。
左（L）が前足・前の手（画面の奥側）、右（R）が後ろ足・後ろの手（手前側）。
"""
import math

BONE = dict(torso=46, head=17, uarm=34, farm=34, thigh=36, shin=35, foot=13, hip=9, sho=15)
DEPTH_Y = 0.15          # 手前のものほど画面で少し下に見せる（床に奥行きを出す）


# ------------------------------------------------------------------ ベクトル
def add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def mul(a, s): return (a[0] * s, a[1] * s, a[2] * s)
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def norm(a): return math.sqrt(dot(a, a))
def unit(a):
    n = norm(a) or 1.0
    return mul(a, 1.0 / n)
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def rad(d): return d * math.pi / 180


def side(yaw):
    """体の左方向。yaw=0 は胸が相手を向く、yaw=90 は胸が手前（画面）を向く"""
    return (math.sin(rad(yaw)), 0.0, -math.cos(rad(yaw)))


def ik3(root, target, L1, L2, pole):
    """2本の骨の先を target に届かせる。中間の関節は pole の方向へ曲げる"""
    d = sub(target, root)
    dist = max(1e-3, min(norm(d), (L1 + L2) * 0.999))
    u = unit(d)
    w = sub(pole, mul(u, dot(pole, u)))
    if norm(w) < 1e-4: w = (0, -1, 0)
    w = unit(w)
    ca = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist)
    ca = max(-1, min(1, ca)); sa = math.sqrt(1 - ca * ca)
    mid = add(root, add(mul(u, L1 * ca), mul(w, L1 * sa)))
    end = add(root, mul(u, dist))
    return mid, end


# ------------------------------------------------------------------ 姿勢 → 関節
def joints3(P):
    B = BONE
    px, ph = P['pel']
    pel = (px, ph, 0.0)
    lp, lc = side(P['py']), side(P['cy'])
    lean = rad(P['lean'])
    up = (math.sin(lean), math.cos(lean), 0.0)
    neck = add(pel, mul(up, B['torso']))
    shc = add(pel, mul(up, B['torso'] - 5))
    hl = rad(P['lean'] * 0.45)                     # 頭は上体ほど倒さない（頭はまっすぐ）
    head = add(add(neck, mul((math.sin(hl), math.cos(hl), 0), B['head'])), (P.get('hx', 0), 0, 0))
    J = dict(pel=pel, neck=neck, head=head)
    J['shL'] = add(shc, mul(lc, B['sho'])); J['shR'] = add(shc, mul(lc, -B['sho']))
    J['hipL'] = add(pel, mul(lp, B['hip'])); J['hipR'] = add(pel, mul(lp, -B['hip']))
    for s, sg in (('L', 1), ('R', -1)):
        # 腕：拳は首の付け根から見た位置。ひじは下・外・少し後ろへ曲げる
        hand_t = add(neck, P['h' + s])
        pole = P.get('e' + s) or add((-0.35, -1.0, 0.0), mul(lc, 0.5 * sg))
        J['el' + s], J['hand' + s] = ik3(J['sh' + s], hand_t, B['uarm'], B['farm'], pole)
        # 脚：足首の位置を指定。ひざはつま先の向き（＋少し上）へ曲げる
        fy = rad(P['y' + s])
        fdir = (math.cos(fy), 0.0, math.sin(fy))
        pole = P.get('k' + s) or (fdir[0], 0.25, fdir[2])
        J['kn' + s], J['an' + s] = ik3(J['hip' + s], P['f' + s], B['thigh'], B['shin'], pole)
        mode = P.get('m' + s, 'ground')
        shin = unit(sub(J['an' + s], J['kn' + s]))
        if mode == 'point':                         # つま先を伸ばす（回し蹴りの足の甲）
            toe = add(J['an' + s], mul(unit(add(shin, mul(fdir, 0.25))), B['foot']))
        elif mode == 'flex':                         # 足の指を反らす（前蹴りの上足底）
            perp = unit(sub(fdir, mul(shin, dot(fdir, shin))))
            toe = add(J['an' + s], mul(unit(add(perp, mul(shin, 0.35))), B['foot']))
        else:                                        # 地面：かかとが上がるほどつま先が下がる
            a = math.atan2(max(0.0, J['an' + s][1]), B['foot'] * 0.95)
            toe = add(J['an' + s], (fdir[0] * B['foot'] * math.cos(a), -B['foot'] * math.sin(a), fdir[2] * B['foot'] * math.cos(a)))
            toe = (toe[0], max(0.0, toe[1]), toe[2])
        J['toe' + s] = toe
    return J


def project(J):
    """横から見た画面の座標（y は上がマイナス）と奥行き z"""
    return {k: (round(p[0], 1), round(-p[1] + p[2] * DEPTH_Y, 1), round(p[2], 1)) for k, p in J.items()}


# ------------------------------------------------------------------ 補間
def ease(t, kind):
    if kind == 'lin': return t
    if kind == 'in': return t * t * t
    if kind == 'out': return 1 - (1 - t) ** 3
    if kind == 'snap': return 1.0
    return t * t * (3 - 2 * t)


def slerp_vec(a, b, t):
    """長さと向きを別々に補間（拳や足先が弧を描く）"""
    la, lb = norm(a), norm(b)
    if la < 1e-3 or lb < 1e-3: return add(a, mul(sub(b, a), t))
    ua, ub = mul(a, 1 / la), mul(b, 1 / lb)
    c = max(-1, min(1, dot(ua, ub))); th = math.acos(c)
    if th < 1e-3: d = ua
    else: d = add(mul(ua, math.sin((1 - t) * th) / math.sin(th)), mul(ub, math.sin(t * th) / math.sin(th)))
    return mul(d, la + (lb - la) * t)


def lerp(a, b, t):
    if isinstance(a, (int, float)): return a + (b - a) * t
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def interp(P0, P1, t, arcs):
    Q = {}
    for k in set(P0) | set(P1):
        a, b = P0.get(k, P1.get(k)), P1.get(k, P0.get(k))
        if isinstance(a, str) or a is None or b is None:
            Q[k] = b if t > 0.5 else a; continue
        if k in arcs and k[0] == 'h':
            Q[k] = slerp_vec(a, b, t)
        elif k in arcs and k[0] == 'f':               # 足は腰の中心のまわりで弧を描く
            c0 = (P0['pel'][0], P0['pel'][1], 0); c1 = (P1['pel'][0], P1['pel'][1], 0)
            c = lerp(c0, c1, t)
            Q[k] = add(c, slerp_vec(sub(a, c0), sub(b, c1), t))
        else:
            Q[k] = lerp(a, b, t)
    return Q


class Move:
    def __init__(self, name, jp, base, loop=False, reach=None, hit=None):
        self.name, self.jp, self.loop, self.reach, self.hit = name, jp, loop, reach, hit
        self.keys = [(base, 0, 'io', 's', ())]

    def k(self, P, n, e='io', ph='s', arcs=()):
        self.keys.append((P, n, e, ph, arcs)); return self

    def frames(self):
        out = [(self.keys[0][0], '-' if self.loop else self.keys[0][3])]
        for i in range(1, len(self.keys)):
            P0 = self.keys[i - 1][0]
            P1, n, e, ph, arcs = self.keys[i]
            for f in range(1, n + 1):
                out.append((interp(P0, P1, ease(f / n, e), arcs), ph))
        return out


def M(P, **kw):
    Q = dict(P); Q.update(kw); return Q


# ------------------------------------------------------------------ 構え
# 前足（L・奥）を前、後ろ足（R・手前）を後ろ。前足のつま先と後ろ足のかかとがほぼ一直線（z をそろえる）。
# 腰は50度、胸は55度ひねって前の肩を相手へ。前の手は顔の前、後ろの手はあご。ひざは柔らかく曲げる。
STANCE = dict(
    pel=(-2, 57), py=50, cy=55, lean=7, hx=-1,
    hL=(20, 11, -8), hR=(8, 7, 9),
    fL=(27, 4, -7), yL=8, fR=(-29, 7, 7), yR=40,       # 後ろのかかとは軽く浮かせる（足首が少し高い）
)


def moves():
    S = STANCE
    out = []

    # 構え：上がりはゆっくり、下がりは速く。拳は胴体より大きく動き、頭は少し遅れる
    m = Move('idle', '構え', S, loop=True)
    top = M(S, pel=(-2, 59), hL=(20, 14, -8), hR=(8, 10, 9), fL=(27, 5, -7), fR=(-29, 9, 7), lean=6)
    low = M(S, pel=(-2, 54), hL=(21, 7, -8), hR=(9, 3, 9), lean=8, hx=0)
    m.k(top, 14, 'io', '-').k(low, 9, 'io', '-').k(S, 13, 'io', '-')
    out.append(m)

    # 弱P：ジャブ（発生4・持続2・全体12）。腰は少し開くだけ、前の肩を相手へ入れて腕を一直線に。前足を少し滑らせる
    m = Move('lp', '弱P（ジャブ）', S, reach=98, hit='handL')
    go = M(S, pel=(1, 58), cy=62, hL=(46, 12, -6))
    ext = M(S, pel=(7, 58), py=46, cy=78, lean=8, hL=(76, 10, -3), fL=(29, 4, -7), hx=-3)
    m.k(go, 2, 'in', 's', ('hL',))
    m.k(ext, 1, 'snap', 'a', ('hL',))
    m.k(M(ext, hL=(77, 10, -3)), 1, 'lin', 'a')
    m.k(M(S, pel=(1, 59), cy=50, hL=(17, 12, -8)), 4, 'out', 'r', ('hL',))   # 少し行き過ぎて戻る
    m.k(S, 3, 'io', 'r')
    out.append(m)

    # 中P：ストレート（発生6・持続3・全体20）。後ろ足の母指球で回ってかかとを上げ、後ろの腰と肩を相手へ。前の手はあごへ
    m = Move('mp', '中P（ストレート）', S, reach=100, hit='handR')
    load = M(S, pel=(-4, 57), py=56, cy=60, hR=(7, 6, 10))
    drive = M(S, pel=(5, 57), py=20, cy=10, lean=9, hR=(40, 8, 6), hL=(10, 10, -6), fR=(-21, 10, 6), yR=8)
    ext = M(S, pel=(11, 57), py=-8, cy=-42, lean=11, hR=(72, 7, -1), hL=(8, 9, -5), hx=-2,
            fR=(-19, 12, 5), yR=0)
    m.k(load, 2, 'out', 's')
    m.k(drive, 2, 'in', 's', ('hR',))
    m.k(ext, 1, 'snap', 'a', ('hR',))
    m.k(M(ext, hR=(73, 7, -1)), 2, 'lin', 'a')
    m.k(M(S, pel=(3, 58), py=38, cy=36, hR=(16, 8, 8), hL=(18, 11, -8)), 7, 'out', 'r', ('hR',))
    m.k(S, 5, 'io', 'r')
    out.append(m)

    # 強P：踏み込み逆突き（発生9・持続4・全体31）。後ろの拳をいったん腰へ（ため）、前足を踏み出して前屈立ち、
    # 拳は脇をこすって一直線に。前の手は引き手で腰へ。前のすねは垂直、後ろ足は伸ばしてつま先30度
    m = Move('hp', '強P（踏み込み逆突き）', S, reach=116, hit='handR')
    load = M(S, pel=(-6, 57), py=62, cy=66, hR=(-6, -34, 12), hL=(30, 8, -8))
    step = M(load, pel=(10, 52), fL=(46, 4, -7), yL=4, fR=(-27, 4, 8), yR=30, lean=5)
    drive = M(step, pel=(19, 50), py=20, cy=4, lean=10, hR=(30, -18, 8), hL=(8, -20, -12))
    ext = M(step, pel=(23, 50), py=-12, cy=-38, lean=14, hR=(76, 3, -2), hL=(-12, -36, -12),
            eL=(-1, -0.3, -0.3), hx=-1)
    m.k(load, 2, 'out', 's', ('hR',))
    m.k(step, 3, 'io', 's')
    m.k(drive, 2, 'in', 's', ('hR', 'hL'))
    m.k(ext, 1, 'snap', 'a', ('hR',))
    m.k(M(ext, hR=(78, 3, -2)), 3, 'lin', 'a')                                  # 極め（少し長く見せる）
    m.k(M(ext, hR=(52, 4, 2), hL=(-6, -30, -12)), 5, 'out', 'r', ('hR',))
    m.k(M(S, pel=(9, 55), fL=(38, 4, -7), py=46, cy=48, hR=(10, 6, 9), hL=(22, 10, -8)), 8, 'io', 'r', ('hR', 'hL'))
    m.k(S, 6, 'io', 'r')
    out.append(m)

    # 弱K：下段前蹴り・前足（発生5・持続2・全体15）。ももを上げ、足の指を反らして上足底ですねへ。引き足をしてから戻る
    m = Move('lk', '弱K（下段前蹴り）', S, reach=103, hit='toeL')
    ch = M(S, pel=(3, 61), py=62, cy=62, lean=2, fL=(30, 30, -7), mL='flex', fR=(-24, 5, 7), yR=55,
           hL=(16, 13, -8), hR=(7, 9, 9))
    ext = M(ch, pel=(17, 59), lean=-8, fL=(96, 15, -6), hL=(14, 12, -8), hx=-2)
    m.k(ch, 2, 'out', 's', ('fL',))
    m.k(M(ext, fL=(62, 22, -6)), 1, 'in', 's', ('fL',))
    m.k(ext, 1, 'snap', 'a', ('fL',))
    m.k(M(ext, fL=(97, 15, -6)), 1, 'lin', 'a')
    m.k(M(ch, pel=(6, 61)), 4, 'out', 'r', ('fL',))                              # 引き足
    m.k(S, 5, 'io', 'r')
    out.append(m)

    # 中K：中段回し蹴り・後ろ足（発生8・持続3・全体25）。前足に体重を移し、ひざを上げて抱え込む。
    # 軸足を回し（かかとを相手へ）、腰を返して、上体を後ろへ倒す。すね・足の甲で蹴り、同じ道で抱え込みへ戻す
    m = Move('mk', '中K（中段回し蹴り）', S, reach=108, hit='toeR')
    shift = M(S, pel=(5, 59), py=40, cy=48, fR=(-18, 12, 6), yR=20, fL=(23, 6, -7))
    ch = M(S, pel=(13, 64), py=-20, cy=10, lean=-12, fL=(23, 7, -7), yL=-60,
           fR=(30, 40, 16), mR='point', kR=(1, 0.3, 0.2), yR=0,
           hL=(20, 14, -6), hR=(4, 4, 12))
    ext = M(ch, pel=(19, 65), py=-85, cy=-30, lean=-22, yL=-120, hx=2,
            fR=(86, 70, 6), kR=(0.3, 1, 0.4), hL=(22, 16, -4), hR=(-18, -22, 14))
    m.k(shift, 2, 'out', 's')
    m.k(ch, 3, 'io', 's', ('fR',))
    m.k(M(ext, fR=(66, 66, 12)), 1, 'in', 's', ('fR',))
    m.k(ext, 1, 'snap', 'a', ('fR',))
    m.k(M(ext, fR=(88, 69, 4)), 2, 'lin', 'a')                                   # 振り抜き
    m.k(M(ch, pel=(14, 63)), 5, 'out', 'r', ('fR',))                              # 同じ道で抱え込みへ
    m.k(M(shift, fR=(-23, 9, 7), yR=35, pel=(3, 58)), 5, 'io', 'r', ('fR',))
    m.k(S, 5, 'io', 'r')
    out.append(m)

    # 強K：上段回し蹴り・後ろ足（発生11・持続4・全体35）。高く抱え込み、軸足をほぼ180度回し、上体を大きく後ろへ倒す
    m = Move('hk', '強K（上段回し蹴り）', S, reach=91, hit='toeR')
    shift = M(S, pel=(3, 59), py=38, cy=46, fR=(-19, 13, 6), yR=20, fL=(22, 6, -7))
    ch = M(S, pel=(11, 65), py=-30, cy=0, lean=-20, fL=(22, 8, -7), yL=-80,
           fR=(26, 54, 18), mR='point', kR=(0.8, 0.6, 0.2), yR=0,
           hL=(20, 16, -6), hR=(2, 6, 12))
    ext = M(ch, pel=(15, 66), py=-95, cy=-35, lean=-34, yL=-160, hx=3,
            fR=(70, 118, 6), kR=(0.2, 1, 0.3), hL=(24, 18, -4), hR=(-22, -18, 16))
    m.k(shift, 2, 'out', 's')
    m.k(ch, 5, 'io', 's', ('fR',))
    m.k(M(ext, fR=(48, 110, 14)), 2, 'in', 's', ('fR',))
    m.k(ext, 1, 'snap', 'a', ('fR',))
    m.k(M(ext, fR=(72, 116, 4)), 3, 'lin', 'a')
    m.k(M(ch, pel=(12, 64)), 8, 'out', 'r', ('fR',))
    m.k(M(shift, fR=(-23, 9, 7), yR=35, pel=(2, 58)), 7, 'io', 'r', ('fR',))
    m.k(S, 6, 'io', 'r')
    out.append(m)
    return out


def bake():
    res = {}
    for m in moves():
        fr = m.frames()
        res[m.name] = dict(jp=m.jp, loop=m.loop, reach=m.reach, hit=m.hit,
                           frames=[dict(ph=ph, j={k: list(v) for k, v in project(joints3(P)).items()}) for P, ph in fr])
    return res


if __name__ == '__main__':
    R = bake()
    for k, m in R.items():
        ph = ''.join(f['ph'] for f in m['frames'])
        a = [i for i, c in enumerate(ph) if c == 'a']
        hx = round(max(f['j'][m['hit']][0] for f in m['frames'] if f['ph'] == 'a') + 8, 1) if m['hit'] else None
        print(f"{k:5s} {m['jp']:14s} 全体{len(ph):3d}F", f"発生{a[0] + 1}F 持続{len(a)}F" if a else '',
              f"先端 {hx}（目標 {m['reach']}）" if hx else '')
