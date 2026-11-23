"""
motion4: Mixamo のモーションキャプチャ（本物の人の動き）を、ゲームの骨の長さ・発生・持続・リーチに合わせて写す。

1. Mixamo の座標（cm、Y上、Z＝前、X＝体の左）を、ゲームの座標（x＝相手の方向、y＝上、z＝手前）へ直す
2. 足首と拳の位置はモーションキャプチャのまま（脚の長さの比で縮める）。ひざとひじは IK で、
   曲がる向きはモーションキャプチャのひざ・ひじに合わせる（ゲームの骨の長さを保つ）
3. 当たる瞬間（拳・足先が一番前に出たコマ）を見つけ、出始め→当たる→戻りの時間をゲームの数字に合わせて伸び縮みさせる
4. 先端の届く距離をリーチに合わせるため、当たる前後だけ体を前へ寄せる
5. 最初と最後の数コマは構えの姿勢へなめらかにつなぐ（どの技も同じ構えから始まり、構えに戻る）
"""
import os, sys, math
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import mixamo

RAW = os.environ.get('MIXAMO_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'design', 'mixamo'))
B = dict(torso=46, head=17, uarm=34, farm=34, thigh=36, shin=35, foot=13, hip=9, sho=15)
DEPTH_Y = 0.15

# 技ごとの設定：使うファイル、当てる部位、ゲームの数字（発生・持続・全体）、リーチ
SPEC = dict(
    idle=dict(dir='idle', jp='構え（Fighting Idle）', loop=True),
    lp=dict(dir='lp', jp='弱P（ジャブ）', hit='handL', st=4, act=2, tot=12, reach=98),
    mp=dict(dir='mp', jp='中P（ストレート）', hit='handR', st=6, act=3, tot=20, reach=100),
    hp=dict(dir='hp', jp='強P（踏み込みストレート）', hit='handR', st=9, act=4, tot=31, reach=116, step=14),
    lk=dict(dir='lk', jp='弱K（ローキック）', hit='toeR', st=5, act=2, tot=15, reach=103),
    mk=dict(dir='mk', jp='中K（ミドルキック）', hit='toeR', st=8, act=3, tot=25, reach=108),
    hk=dict(dir='hk', jp='強K（ハイキック）', hit='toeR', st=11, act=4, tot=35, reach=91),
)


def to_game(p):
    """Mixamo（X左・Y上・Z前）→ ゲーム（x前・y上・z手前＝体の右）"""
    return np.stack([p[..., 2], p[..., 1], -p[..., 0]], -1)


def unit(v):
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-6)


def ik(root, target, L1, L2, mid_ref):
    d = target - root
    dist = np.clip(np.linalg.norm(d), 1e-3, (L1 + L2) * 0.999)
    u = d / max(np.linalg.norm(d), 1e-6)
    pole = mid_ref - root
    w = pole - u * np.dot(pole, u)
    if np.linalg.norm(w) < 1e-4: w = np.array([0, -1.0, 0])
    w = w / np.linalg.norm(w)
    ca = np.clip((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1)
    mid = root + u * L1 * ca + w * L1 * math.sqrt(1 - ca * ca)
    return mid, root + u * dist


def load_clip(name):
    t, J = mixamo.load(os.path.join(RAW, SPEC[name]['dir'] + '.dae'))
    return {k: to_game(v) for k, v in J.items()}


def retarget(J):
    """モーションキャプチャの関節（cm）→ ゲームの骨の長さの関節（px）。毎コマ"""
    leg = np.mean([np.linalg.norm(J['hip' + s][0] - J['kn' + s][0]) + np.linalg.norm(J['kn' + s][0] - J['an' + s][0]) for s in 'LR'])
    arm = np.mean([np.linalg.norm(J['sh' + s][0] - J['el' + s][0]) + np.linalg.norm(J['el' + s][0] - J['hand' + s][0]) for s in 'LR'])
    s = (B['thigh'] + B['shin']) / leg                 # 全体の縮め方（脚の長さで合わせる）
    ka = (B['uarm'] + B['farm']) / (arm * s)           # 腕はゲームの方が長いので、肩からの距離をこの比で伸ばす
    n = len(J['pel'])
    ground = min(J['anL'][:, 1].min(), J['anR'][:, 1].min())
    out = []
    for i in range(n):
        g = {k: v[i] * s for k, v in J.items()}
        g = {k: v - np.array([0, ground * s, 0]) for k, v in g.items()}
        pel = g['pel']
        up = unit(g['neck'] - pel)
        neck = pel + up * B['torso']
        shc = pel + up * (B['torso'] - 5)
        sh_axis = unit(g['shL'] - g['shR'])
        hip_axis = unit(g['hipL'] - g['hipR'])
        F = dict(pel=pel, neck=neck)
        F['head'] = neck + unit(g['top'] - g['neck']) * B['head']
        F['shL'], F['shR'] = shc + sh_axis * B['sho'], shc - sh_axis * B['sho']
        F['hipL'], F['hipR'] = pel + hip_axis * B['hip'], pel - hip_axis * B['hip']
        for sd in 'LR':
            # 拳：肩からの向き・伸び具合はそのまま、長さだけゲームの腕に合わせる
            rel = g['hand' + sd] - g['sh' + sd]
            hand_t = F['sh' + sd] + rel * ka
            F['el' + sd], F['hand' + sd] = ik(F['sh' + sd], hand_t, B['uarm'], B['farm'], F['sh' + sd] + (g['el' + sd] - g['sh' + sd]))
            relf = g['an' + sd] - g['hip' + sd]
            an_t = F['hip' + sd] + relf
            F['kn' + sd], F['an' + sd] = ik(F['hip' + sd], an_t, B['thigh'], B['shin'], F['hip' + sd] + (g['kn' + sd] - g['hip' + sd]))
            F['toe' + sd] = F['an' + sd] + unit(g['tip' + sd] - g['an' + sd]) * B['foot']
        out.append(F)
    return out


def sample(frames, t):
    """小数のコマ位置 t で関節を補間"""
    t = min(max(t, 0), len(frames) - 1)
    a = int(math.floor(t)); b = min(a + 1, len(frames) - 1); f = t - a
    return {k: frames[a][k] * (1 - f) + frames[b][k] * f for k in frames[a]}


def shift(F, dx):
    return {k: v + np.array([dx, 0, 0]) for k, v in F.items()}


def blend(A, Bf, w):
    return {k: A[k] * (1 - w) + Bf[k] * w for k in A}


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


_cache = {}


def stance():
    """構え：Fighting Idle の最初のコマ（足の位置を原点にそろえる）"""
    if 'st' not in _cache:
        fr = retarget(load_clip('idle'))
        _cache['idle'] = fr
        _cache['st'] = fr[0]
    return _cache['st']


def center(frames, ref):
    """前足と後ろ足の中点が、構えと同じ場所に来るように横へずらす（最初のコマで決める）"""
    f0 = frames[0]
    dx = ((ref['anL'][0] + ref['anR'][0]) - (f0['anL'][0] + f0['anR'][0])) / 2
    return [shift(f, dx) for f in frames]


def build(name):
    sp = SPEC[name]
    S = stance()
    if sp.get('loop'):
        fr = _cache['idle']
        fr = center(fr, S)
        # 30fps の1コマ＝ゲームの2コマ。そのままの速さで1周分
        return [(sample(fr, i / 2), '-') for i in range(2 * (len(fr) - 1))]
    fr = center(retarget(load_clip(name)), S)
    hit = sp['hit']
    xs = np.array([f[hit][0] for f in fr])
    imp = int(np.argmax(xs))                                   # 当たる瞬間＝先端が一番前
    # 動き出し：先端の速さが最大の15%を超える直前
    sp_ = np.abs(np.diff(xs)); thr = sp_.max() * 0.15
    t0 = imp
    while t0 > 0 and sp_[t0 - 1] > thr: t0 -= 1
    t0 = max(0, t0 - 2)                                        # ため（予備動作）を少し含める
    # 戻り終わり：当たった後、先端が構えの位置近くまで戻ったところ
    rest = xs[0]
    t1 = imp
    while t1 < len(xs) - 1 and xs[t1] > rest + (xs[imp] - rest) * 0.08: t1 += 1
    t1 = min(len(xs) - 1, t1 + 4)
    st, act, tot = sp['st'], sp['act'], sp['tot']
    rec = tot - (st - 1) - act
    out = []
    # 出始め：ゲームの 0〜st-1 コマ ← モーションキャプチャの t0〜imp（最後のコマで当たる瞬間に届く）
    for g in range(st - 2):
        u = (g + 1) / (st - 1)
        out.append((sample(fr, t0 + (imp - t0) * u), 's'))
    # 持続：当たる瞬間の前後をゆっくり（伸びきった形を少し長く見せる）
    for g in range(act):
        out.append((sample(fr, imp + 0.6 * g), 'a'))
    # 戻り：当たった後〜戻り終わり
    for g in range(rec):
        u = (g + 1) / rec
        out.append((sample(fr, imp + 0.6 * (act - 1) + (t1 - imp - 0.6 * (act - 1)) * (u ** 0.85)), 'r'))
    out.insert(0, (S, 's'))
    out = out[:tot]
    assert len(out) == tot, (name, len(out))
    # 構えへのつなぎ：最初の2コマと最後の5コマ
    n = len(out)
    for i in range(n):
        F, ph = out[i]
        w_in = smooth(i / 3.0)
        w_out = smooth((n - 1 - i) / 5.0)
        w = min(w_in, w_out)
        out[i] = (blend(S, F, w), ph)
    # リーチ合わせ：当たる瞬間に先端がリーチ−8 に来るよう、当たる前後だけ体を前へ寄せる
    ai = [i for i, (_, ph) in enumerate(out) if ph == 'a']
    cur = max(out[i][0][hit][0] for i in ai)
    need = sp['reach'] - 8 - cur
    peak = ai[0]
    for i in range(n):
        if i <= peak: w = smooth(i / peak)
        elif i <= ai[-1]: w = 1.0
        else: w = smooth(1 - (i - ai[-1]) / max(1, (n - 1 - ai[-1])))
        out[i] = (shift(out[i][0], need * w), out[i][1])
    return out


def project(F):
    return {k: [round(float(v[0]), 1), round(float(-v[1] + v[2] * DEPTH_Y), 1), round(float(v[2]), 1)] for k, v in F.items()}


def bake():
    res = {}
    for name, sp in SPEC.items():
        fr = build(name)
        res[name] = dict(jp=sp['jp'], loop=bool(sp.get('loop')), reach=sp.get('reach'), hit=sp.get('hit'),
                         frames=[dict(ph=ph, j=project(F)) for F, ph in fr])
    return res


if __name__ == '__main__':
    R = bake()
    for k, m in R.items():
        ph = ''.join(f['ph'] for f in m['frames'])
        a = [i for i, c in enumerate(ph) if c == 'a']
        hx = round(max(m['frames'][i]['j'][m['hit']][0] for i in a) + 8, 1) if a else None
        print(f"{k:5s} {m['jp']:16s} 全体{len(ph):3d}F", f"発生{a[0] + 1}F 持続{len(a)}F 先端{hx}（目標{m['reach']}）" if a else '')
