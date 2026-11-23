"""
動きの骨組み（第2版）
  格闘ゲームの立ち回りと、空手・ボクシングの体の使い方を元に、技ごとの骨組みを作る。

  ・向きは右向き。前の手足（リード）は奥側、後ろの手足は手前側（ストリートファイターと同じ見え方）
  ・座標は足元の真ん中が原点、上がマイナス（ゲームと同じ）。単位はゲームの画素
  ・拳と足は「届く位置」で決め、ひじとひざは2本の骨の計算（IK）で出すので、骨の長さはいつも同じ
  ・拳・足の動きは肩・腰を中心にした角度と距離で補間するので、まっすぐではなく弧を描く
  ・技の長さ（発生・持続・全体）とリーチは今のゲームと同じにする
"""
import math, json

# 骨の長さ（身長 約140）
BONE = dict(torso=46, neck=7, head=10, uarm=34, farm=34, thigh=36, shin=35, foot=13, sh_w=5, hip_w=4)   # 腕は格闘ゲームらしく少し長め


def v(a, L):
    """角度a（0＝右、90＝下）に長さL"""
    r = math.radians(a)
    return (math.cos(r) * L, math.sin(r) * L)


def add(p, q):
    return (p[0] + q[0], p[1] + q[1])


def ik(root, target, L1, L2, bend):
    """2本の骨：rootからtargetへ。bend=+1で関節が下（時計回り）側、-1で上側に曲がる"""
    dx, dy = target[0] - root[0], target[1] - root[1]
    d = math.hypot(dx, dy)
    d = max(min(d, L1 + L2 - 0.01), abs(L1 - L2) + 0.01)
    a = math.atan2(dy, dx)
    c = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)
    b = math.acos(max(-1, min(1, c)))
    a1 = a + bend * b
    mid = (root[0] + math.cos(a1) * L1, root[1] + math.sin(a1) * L1)
    end = (root[0] + math.cos(a) * d, root[1] + math.sin(a) * d)
    return mid, end


def ik2(root, target, L1, L2, pref):
    """曲がる向きを自動で選ぶIK。pref：'down'＝関節が下、'up'＝上、'front'＝前（右）、'back'＝後ろ（左）、数値＝そのまま"""
    if isinstance(pref, (int, float)):
        return ik(root, target, L1, L2, pref)
    a = ik(root, target, L1, L2, 1); b = ik(root, target, L1, L2, -1)
    key = {'down': lambda m: m[0][1], 'up': lambda m: -m[0][1], 'front': lambda m: m[0][0], 'back': lambda m: -m[0][0]}[pref]
    return a if key(a) >= key(b) else b


def ease(t, kind):
    if kind == 'lin':
        return t
    if kind == 'in':      # ゆっくり出てだんだん速く（溜めから打つ）
        return t * t
    if kind == 'out':     # 速く出て止まる（打ち出し・戻り）
        return 1 - (1 - t) ** 2
    if kind == 'snap':    # とても速く出る（打撃の瞬間）
        return 1 - (1 - t) ** 4
    return t * t * (3 - 2 * t)   # 'io' なめらか


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_ang(a, b, t):
    d = (b - a + 180) % 360 - 180
    return a + d * t


# ------------------------------------------------------------------ 姿勢
# 姿勢は辞書：
#   pel=(x,y) 骨盤、tor=胴の傾き（前へ＋度）、hd=頭の傾き
#   hL/hR=前の手（L）・後ろの手（R）の拳の位置、fL/fR=前の足・後ろの足のくるぶしの位置
#   tL/tR=つま先の向き（度。0＝前、90＝下）
#   ebL/ebR、kbL/kbR＝ひじ・ひざの曲がる向き（省略時は自然な向き）

def resolve(P):
    """rhL/rhR（首から見た拳の位置）を、足元から見た位置hL/hRに直す"""
    if 'rhL' not in P and 'rhR' not in P:
        return P
    Q = dict(P)
    B = BONE
    up = -90 + P.get('tor', 0)
    neck = add(P['pel'], v(up, B['torso']))
    for s in 'LR':
        if 'rh' + s in P:
            Q['h' + s] = add(neck, P['rh' + s]); del Q['rh' + s]
    return Q


def joints(P):
    P = resolve(P)
    B = BONE
    pel = P['pel']
    tor = P.get('tor', 0)
    up = -90 + tor            # 胴の向き（上が-90）
    neck = add(pel, v(up, B['torso']))
    head = add(neck, v(up + P.get('hd', 0), B['neck'] + B['head']))
    # 肩：胴の上の方。前の肩（L）は少し前、後ろの肩（R）は少し後ろ（半身）
    sh_twist = P.get('tw', 0)     # 体の回転（＋で後ろの肩が前に出る＝打つ側の肩が入る）
    shC = add(pel, v(up, B['torso'] - 6))
    shL = add(shC, (B['sh_w'] + sh_twist * 0.8, 0))   # ジャブでは前の肩が前に入る
    shR = add(shC, (-B['sh_w'] + sh_twist, 0))
    hipL = add(pel, (B['hip_w'], 0))
    hipR = add(pel, (-B['hip_w'], 0))
    J = dict(pel=pel, neck=neck, head=head, shL=shL, shR=shR, hipL=hipL, hipR=hipR)
    for s in 'LR':
        el, hd_ = ik2(J['sh' + s], P['h' + s], B['uarm'], B['farm'], P.get('eb' + s, 'down'))
        J['el' + s], J['hand' + s] = el, hd_
        kn, an = ik2(J['hip' + s], P['f' + s], B['thigh'], B['shin'], P.get('kb' + s, 'front'))
        J['kn' + s], J['an' + s] = kn, an
        J['toe' + s] = add(an, v(P.get('t' + s, 0), B['foot']))
    return J


def polar(center, p):
    dx, dy = p[0] - center[0], p[1] - center[1]
    return math.degrees(math.atan2(dy, dx)), math.hypot(dx, dy)


def interp(P0, P1, t, arcs=()):
    """2つの姿勢の間。arcsに入っている手足（'hL'など）は肩・腰を中心に弧で動かす"""
    P0, P1 = resolve(P0), resolve(P1)
    P = {}
    for k in set(P0) | set(P1):
        a, b = P0.get(k, P1.get(k)), P1.get(k, P0.get(k))
        if isinstance(a, tuple):
            P[k] = (lerp(a[0], b[0], t), lerp(a[1], b[1], t))
        elif isinstance(a, (int, float)):
            P[k] = lerp_ang(a, b, t) if k in ('tor', 'hd', 'tL', 'tR') else lerp(a, b, t)
        else:
            P[k] = b if t >= 0.5 else a
    if arcs:
        J0, J1 = joints(P0), joints(P1)
        Jt = joints(P)
        for k in arcs:
            s = k[1]
            base = ('sh' if k[0] == 'h' else 'hip') + s
            a0, d0 = polar(J0[base], P0[k])
            a1, d1 = polar(J1[base], P1[k])
            a, d = lerp_ang(a0, a1, t), lerp(d0, d1, t)
            c = Jt[base]
            P[k] = (c[0] + math.cos(math.radians(a)) * d, c[1] + math.sin(math.radians(a)) * d)
    return P


class Move:
    """キーフレームの並び：(姿勢, そこまでのフレーム数, 補間の種類, 段階s/a/r, 弧で動かす手足)"""
    def __init__(self, name, jp, base, loop=False, reach=None, hit=None):
        self.name, self.jp, self.loop, self.reach, self.hit = name, jp, loop, reach, hit
        self.keys = [(base, 0, 'io', 's', ())]

    def k(self, P, n, e='io', ph='s', arcs=()):
        self.keys.append((P, n, e, ph, arcs))
        return self

    def frames(self):
        out = [(self.keys[0][0], self.keys[0][3])]
        for i in range(1, len(self.keys)):
            P0 = self.keys[i - 1][0]
            P1, n, e, ph, arcs = self.keys[i]
            for f in range(1, n + 1):
                out.append((interp(P0, P1, ease(f / n, e), arcs), ph))
        return out


def M(P, **kw):
    """姿勢Pを元に一部を変える。拳の位置は、あとから書いた書き方（hL か rhL）が優先"""
    Q = dict(P)
    for s in 'LR':
        if 'h' + s in kw: Q.pop('rh' + s, None)
        if 'rh' + s in kw: Q.pop('h' + s, None)
    Q.update(kw); return Q


# ------------------------------------------------------------------ 構え（オーソドックスの半身）
STANCE = dict(
    pel=(-2, -63), tor=9, hd=-6, tw=0,
    rhL=(25, -6), rhR=(11, 2),            # 前の手は顔の前、後ろの手はあご（首から見た位置なので体についてくる）
    fL=(21, -4), fR=(-25, -4), tL=8, tR=-4,   # 前足は前、後ろ足は後ろ（つま先は少し開く）
)


def moves():
    S = STANCE
    out = []

    # 構え：呼吸と重心の上下（ゆっくり、肩と拳も少し揺れる）
    m = Move('idle', '構え', S, loop=True)
    dn = M(S, pel=(-2, -60), rhL=(26, -4), rhR=(12, 4), tor=10)
    m.k(dn, 18, 'io', '-').k(S, 18, 'io', '-')
    out.append(m)

    # 弱P：ジャブ。前の手を一直線に。肩を入れて、体は少し前へ。戻りが速い（発生4・持続2・全体12）
    m = Move('lp', '弱P（ジャブ）', S, reach=98, hit='handL')
    ext = M(S, pel=(4, -62), tor=14, tw=7, hL=(90, -116), rhR=(10, 2))
    m.k(M(S, pel=(1, -63), tor=11, hL=(42, -114)), 2, 'in', 's')       # 打ち出し
    m.k(ext, 1, 'snap', 'a', ('hL',))
    m.k(ext, 1, 'lin', 'a')
    m.k(M(S, hL=(44, -114)), 4, 'out', 'r', ('hL',))
    m.k(S, 3, 'io', 'r')
    out.append(m)

    # 中P：ストレート（後ろの手）。腰を回し、後ろのかかとを上げて体重を前へ。前の手はあごへ引く（発生6・持続3・全体20）
    m = Move('mp', '中P（ストレート）', S, reach=100, hit='handR')
    load = M(S, pel=(-4, -62), tor=7, tw=-2, rhR=(8, 4))
    ext = M(S, pel=(10, -61), tor=18, tw=12, hR=(92, -114), rhL=(8, 4), fR=(-21, -6), tR=-30)
    m.k(load, 2, 'out', 's')                                              # 小さな溜め
    m.k(M(ext, hR=(52, -110)), 2, 'in', 's')
    m.k(ext, 1, 'snap', 'a', ('hR',))
    m.k(ext, 2, 'lin', 'a')
    m.k(M(S, pel=(4, -62), tor=13, hR=(40, -108)), 7, 'out', 'r', ('hR',))
    m.k(S, 5, 'io', 'r')
    out.append(m)

    # 強P：踏み込み逆突き（空手）。前足を踏み出し、腰を落として後ろの拳を突き出す。前の手は腰へ引く（引き手）
    # （発生9・持続4・全体31）
    m = Move('hp', '強P（踏み込み逆突き）', S, reach=115, hit='handR')
    load = M(S, pel=(-8, -61), tor=4, tw=-4, rhR=(4, 8), rhL=(28, -4))
    step = M(S, pel=(8, -57), tor=10, fL=(40, -4), rhR=(2, 10), rhL=(28, -2), tw=-2)
    ext = M(S, pel=(20, -56), tor=18, tw=18, fL=(44, -4), fR=(-30, -4), tR=-20,
            hR=(108, -110), hL=(14, -76), ebL='back')
    m.k(load, 2, 'out', 's')
    m.k(step, 3, 'io', 's')
    m.k(M(ext, hR=(66, -104)), 2, 'in', 's')
    m.k(ext, 1, 'snap', 'a', ('hR',))
    m.k(ext, 3, 'lin', 'a')
    m.k(M(ext, hR=(80, -106)), 5, 'out', 'r', ('hR',))
    m.k(M(S, pel=(10, -59), fL=(40, -4), tor=14, rhR=(14, 4), rhL=(24, -4)), 8, 'io', 'r')
    m.k(M(S, pel=(2, -62)), 6, 'io', 'r')
    m.k(S, 0, 'io', 'r')
    out.append(m)

    # 弱K：足元への前蹴り（すね狙い）。前のひざを軽く上げて、足先を下段へ素早く（発生5・持続2・全体15）
    m = Move('lk', '弱K（下段前蹴り）', S, reach=101, hit='toeL')
    chamber = M(S, pel=(6, -64), tor=5, fL=(40, -28), tL=24)
    ext = M(S, pel=(16, -64), tor=0, fL=(83, -30), tL=8, rhL=(24, -2), rhR=(8, 6))
    m.k(chamber, 2, 'out', 's')
    m.k(M(ext, fL=(66, -30)), 1, 'in', 's', ('fL',))
    m.k(ext, 1, 'snap', 'a', ('fL',))
    m.k(ext, 1, 'lin', 'a')
    m.k(chamber, 4, 'out', 'r', ('fL',))
    m.k(S, 5, 'io', 'r')
    out.append(m)

    # 中K：中段回し蹴り（後ろ足）。ひざを胸の前にたたみ（抱え込み）、軸足を返して腰を入れ、すねで蹴る
    # 上体はやや後ろへ倒して釣り合いを取る（発生8・持続3・全体25）
    m = Move('mk', '中K（中段回し蹴り）', S, reach=106, hit='toeR')
    shift = M(S, pel=(4, -64), tor=6, fR=(-14, -10), tR=-40)
    chamber = M(S, pel=(14, -67), tor=-4, fR=(38, -60), tR=20, fL=(21, -4), tL=-20,
                rhL=(26, 2), rhR=(10, 10))
    ext = M(S, pel=(24, -67), tor=-14, fR=(87, -74), tR=-6, tL=-40,
            rhL=(30, 14), rhR=(-14, 26))
    m.k(shift, 2, 'out', 's')
    m.k(chamber, 3, 'io', 's', ('fR',))
    m.k(M(ext, fR=(70, -70)), 1, 'in', 's', ('fR',))
    m.k(ext, 1, 'snap', 'a', ('fR',))
    m.k(ext, 2, 'lin', 'a')
    m.k(chamber, 5, 'out', 'r', ('fR',))
    m.k(M(shift, fR=(-20, -8)), 5, 'io', 'r', ('fR',))
    m.k(S, 5, 'io', 'r')
    out.append(m)

    # 強K：上段蹴り（後ろ足の上段回し）。大きく抱え込み、上体を後ろへ倒して高く伸ばす（発生11・持続4・全体35）
    m = Move('hk', '強K（上段回し蹴り）', S, reach=92, hit='toeR')
    shift = M(S, pel=(2, -63), tor=4, fR=(-16, -12), tR=-40)
    chamber = M(S, pel=(14, -68), tor=-12, fR=(32, -88), tR=10, tL=-30,
                rhL=(26, 4), rhR=(6, 14))
    ext = M(S, pel=(22, -69), tor=-28, fR=(72, -114), tR=-30, tL=-50,
            rhL=(28, 18), rhR=(-18, 34))
    m.k(shift, 2, 'out', 's')
    m.k(chamber, 5, 'io', 's', ('fR',))
    m.k(M(ext, fR=(58, -108)), 2, 'in', 's', ('fR',))
    m.k(ext, 1, 'snap', 'a', ('fR',))
    m.k(ext, 3, 'lin', 'a')
    m.k(chamber, 8, 'out', 'r', ('fR',))
    m.k(M(shift, fR=(-22, -8)), 7, 'io', 'r', ('fR',))
    m.k(S, 6, 'io', 'r')
    out.append(m)
    return out


def bake():
    """技ごとに、毎フレームの関節の位置と段階（s/a/r）を出す"""
    res = {}
    for m in moves():
        fr = m.frames()
        res[m.name] = dict(jp=m.jp, loop=m.loop, reach=m.reach, hit=m.hit,
                           frames=[dict(ph=ph, j={k: [round(p[0], 1), round(p[1], 1)] for k, p in joints(P).items()})
                                   for P, ph in fr])
    return res


if __name__ == '__main__':
    R = bake()
    for k, m in R.items():
        ph = ''.join(f['ph'] for f in m['frames'])
        a = [i for i, c in enumerate(ph) if c == 'a']
        hx = round(max(f['j'][m['hit']][0] for f in m['frames']) + 8, 1) if m['hit'] else None
        print(f"{k:5s} {m['jp']:16s} 全体{len(ph):3d}F", f"発生{a[0] + 1}F 持続{len(a)}F" if a else '', f"拳/足の先 {hx}（目標 {m['reach']}）" if hx else '')
