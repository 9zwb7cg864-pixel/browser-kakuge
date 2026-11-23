"""
motion5: ゲームの全部の動き（道着キャラ男）を Mixamo のモーションキャプチャから作る。
motion4 の写し方（骨の長さ合わせ・時間の伸び縮み・リーチ合わせ・構えへのつなぎ）を全部の動きに広げたもの。

動きの種類
  loop  : 1周する動き（構え・歩き・しゃがみ）。もとの速さのまま1周
  plain : 決まった長さに伸び縮みさせる動き（やられ・ダウン・勝ちポーズなど）
  atk   : 攻撃。出始め→当たる→戻りを、ゲームの発生・持続・全体に合わせる。リーチも合わせる
足の差し替え（legs）
  crouch: 下半身をしゃがみの形にして、上半身だけ使う（しゃがみパンチ・しゃがみガード・しゃがみやられ）
  air   : 下半身をジャンプ中の形にして、上半身だけ使う（空中パンチ）
"""
import os, sys, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import motion4 as m4

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ANIMS = json.load(open(os.path.join(ROOT, 'game', 'assets', 'kokuu', 'anims.json')))['anims']
REACH_ADD = 14
LOWER = ('pel', 'hipL', 'hipR', 'knL', 'knR', 'anL', 'anR', 'toeL', 'toeR')
HANDS, FEET = ('handL', 'handR'), ('toeL', 'toeR')


def game_ph(name):
    return ''.join(f['ph'] * f['d'] for f in ANIMS[name]['frames']).replace('-', '-')


def game_data(name):
    a = ANIMS[name]
    ph = ''.join(f['ph'] * f['d'] for f in a['frames'])
    act = [i for i, c in enumerate(ph) if c == 'a']
    xs = [h[0] + h[2] for f in a['frames'] for h in f.get('hit', [])]
    reach = round(max(xs) + (REACH_ADD if max(xs) > 24 else 0), 1) if xs else None
    return dict(tot=len(ph), st=act[0] + 1 if act else None, act=len(act), reach=reach, loop=bool(a.get('loop')))


# 動きの表：ゲームの動きの名前 → (モーション, 種類, 設定)
S = dict
TABLE = {
    'idle': S(clip='idle', kind='loop', jp='構え'),
    'walk_f': S(clip='walk_f', kind='loop', jp='前歩き', inplace='x'),
    'walk_b': S(clip='walk_b', kind='loop', jp='後ろ歩き', inplace='x'),
    'dash': S(clip='dash', kind='plain', jp='前ダッシュ', inplace='x'),
    'dash_b': S(clip='dash_b', kind='plain', jp='後ろダッシュ', inplace='x'),
    'jump_up': S(kind='old', jp='垂直ジャンプ（上り）（今の動き）'),
    'jump_down': S(kind='old', jp='垂直ジャンプ（下り）（今の動き）'),
    'land': S(kind='old', jp='着地（今の動き）'),
    'jump_f': S(kind='old', jp='前ジャンプ（今の動き）'),
    'jump_b': S(kind='old', jp='後ろジャンプ（今の動き）'),
    'crouch_in': S(kind='old', jp='しゃがみ始め（今の動き）'),
    'crouch': S(kind='old', jp='しゃがみ（今の動き）'),
    'crouch_out': S(kind='old', jp='立ち上がり（今の動き）'),
    'guard': S(clip='guard', kind='plain', jp='ガード', win=(0, 0.22), end=None),
    'cguard': S(clip='cguard', kind='plain', jp='しゃがみガード', win=(0, 0.22), legs='crouch', start='crouch', end=None),
    'lp': S(clip='lp', kind='atk', jp='弱P', hit=('handL',)),
    'mp': S(clip='mp', kind='atk', jp='中P', hit=('handR',)),
    'hp': S(clip='hp', kind='atk', jp='強P', hit=('handR',)),
    'lk': S(clip='lk', kind='atk', jp='弱K', hit=('toeR',)),
    'mk': S(clip='mk', kind='atk', jp='中K', hit=('toeR',)),
    'hk': S(clip='hk', kind='atk', jp='強K', hit=('toeR',)),
    'c_lp': S(clip='lp', kind='atk', jp='しゃがみ弱P', hit=('handL',), legs='crouch', start='crouch', end='crouch'),
    'c_mp': S(clip='mp', kind='atk', jp='しゃがみ中P', hit=('handR',), legs='crouch', start='crouch', end='crouch'),
    'c_hp': S(clip='up_back', kind='atk', jp='しゃがみ強P（アッパー）', hit=HANDS, up=True, start='crouch', end='crouch'),
    'c_lk': S(clip='sweep_f', kind='atk', jp='しゃがみ弱K', hit=FEET, low=True, start='crouch', end='crouch'),
    'c_mk': S(clip='sweep_f', kind='atk', jp='しゃがみ中K', hit=FEET, low=True, start='crouch', end='crouch'),
    'c_hk': S(clip='sweep_b', kind='atk', jp='しゃがみ強K（足払い）', hit=FEET, low=True, start='crouch', end='crouch'),
    'j_p': S(clip='knee_punch', kind='atk', jp='ジャンプP', hit=HANDS, legs='air', start='air', end='air', inplace='xy', pin=False),
    'j_hp': S(clip='knee_punch', kind='atk', jp='ジャンプ強P', hit=HANDS, legs='air', start='air', end='air', inplace='xy', pin=False),
    'j_k': S(clip='sidekick', kind='atk', jp='ジャンプK（飛び蹴り）', hit=FEET, start='air', end='air', inplace='xy', pin=False),
    'j_hk': S(clip='bicycle', kind='atk', jp='ジャンプ強K', hit=FEET, start='air', end='air', inplace='xy', pin=False),
    'throw': S(clip='throw', kind='atk', jp='投げ（つかみ）', hit=HANDS, win=(0, 0.35)),
    'throw_do': S(clip='throw', kind='plain', jp='投げ（投げる）', win=(0.3, 1.0), inplace='x'),
    'tech': S(clip='dodge', kind='plain', jp='投げ抜け', inplace='x'),
    'hit_hi': S(clip='hit_hi', kind='plain', jp='やられ（上）'),
    'hit_lo': S(clip='hit_lo', kind='plain', jp='やられ（下）'),
    'hit_c': S(clip='hit_lo', kind='plain', jp='しゃがみやられ', legs='crouch', start='crouch', end='crouch'),
    'launch': S(clip='flyback', kind='plain', jp='浮き', win=(0.05, 0.6), inplace='xy', end=None, pin=False),
    'down': S(clip='ko_fall', kind='plain', jp='ダウン', win=(0.55, 1.0), inplace='x', start=None, end=None),
    'getup': S(clip='getup', kind='plain', jp='起き上がり', inplace='x', start=None),
    'ko': S(clip='ko_fall', kind='plain', jp='KO', inplace='x', end=None),
    'win': S(clip='win', kind='plain', jp='勝ちポーズ', inplace='x', end=None),
    'intro': S(clip='taunt', kind='plain', jp='登場', inplace='x'),
    'rush': S(clip='walk_f', kind='loop', jp='走り（突進中）', inplace='x', speed=2.0),
    'sp_fire': S(clip='hadouken', kind='atk', jp='虚環弾（波動）', hit=HANDS, noreach=True),
    'ex_fire': S(clip='hadouken', kind='atk', jp='EX虚環弾', hit=HANDS, noreach=True),
    'sp_dp': S(clip='up_lead', kind='atk', jp='昇穿（昇竜）', hit=HANDS, up=True),
    'ex_dp': S(clip='up_lead', kind='atk', jp='EX昇穿', hit=HANDS, up=True),
    'sp_rush': S(clip='slide', kind='atk', jp='突進', hit=FEET, inplace='x'),
    'sp_slide': S(clip='slide', kind='atk', jp='迅閃脚（スライディング）', hit=FEET, inplace='x'),
    'ex_rush': S(clip='slide', kind='atk', jp='EX迅閃脚', hit=FEET, inplace='x'),
    'su_1': S(clip='combo8', kind='atk', jp='虚空砲（SA1・連打）', hit=HANDS, multi=True, inplace='x'),
    'su_2': S(clip='kneejab', kind='atk', jp='零界継承（SA2）', hit=HANDS + FEET, multi=True, inplace='x'),
    'su_3': S(clip='backflip', kind='atk', jp='天地穿（SA3）', hit=HANDS + FEET, multi=True, inplace='x', up=True),
    'f_mp': S(clip='elbow_head', kind='atk', jp='鎚打ち（前＋中P）', hit=HANDS + ('elL', 'elR')),
    'f_hp': S(clip='elbow_step', kind='atk', jp='踏破肘（前＋強P）', hit=HANDS + ('elL', 'elR')),
    'b_hk': S(clip='spin_back', kind='atk', jp='旋踵（後ろ回し蹴り）', hit=FEET),
    'sp_tatsu': S(clip='hurricane', kind='atk', jp='旋風脚（竜巻）', hit=FEET, multi=True, inplace='xy', pin=False),
    'sp_atatsu': S(clip='hurricane', kind='atk', jp='空旋脚（空中竜巻）', hit=FEET, multi=True, inplace='xy', start='air', end='air', pin=False),
    'sp_palm': S(clip='palm', kind='atk', jp='虚掌破（掌打）', hit=HANDS, win=(0.55, 1.0)),
    'ex_palm': S(clip='palm', kind='atk', jp='EX虚掌破', hit=HANDS, win=(0.55, 1.0)),
}


# ------------------------------------------------------------------ 道具
def blend(A, B, w): return {k: A[k] * (1 - w) + B[k] * w for k in A}
def shift(F, d): return {k: v + np.asarray(d, float) for k, v in F.items()}
def smooth(x): x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)


_clips = {}


def clip(name):
    """モーションを読み、骨の長さを合わせ、前足と後ろ足の中点を構えにそろえる"""
    if name not in _clips:
        J = m4.mixamo.load(os.path.join(m4.RAW, name + '.dae'))[1]
        fr = m4.retarget({k: m4.to_game(v) for k, v in J.items()})
        _clips[name] = fr
    return _clips[name]


def feet_mid(F): return (F['anL'] + F['anR']) / 2


def poses():
    if 'P' in _clips: return _clips['P']
    st = clip('idle')[0]
    cr = old_frames('crouch')[0]                              # しゃがみ・ジャンプは今の動きの形を使う
    ju = old_frames('jump_up')
    air = ju[int(np.argmax([min(f['anL'][1], f['anR'][1]) for f in ju]))]
    _clips['P'] = dict(stand=st, crouch=cr, air=air)
    return _clips['P']


# ------------------------------------------------------------------ 今の動き（ジャンプ・しゃがみ）を新しい骨の長さで読み直す
_old = {}


def old_frames(name):
    """今のゲームの骨組み（2D）を、新しい骨の長さに合わせて読み直す。1コマずつ（表示コマ数ぶん並べる）"""
    if name in _old: return _old[name]
    import moves2, anim2
    from art import AX, AY
    if 'defs' not in _old: _old['defs'] = {a.name: a for a in moves2.defs('kokuu')}
    a = _old['defs'][name]
    B = m4.B
    def conv(J):
        g = {k: np.array([float(J[k][0] - AX), -float(J[k][1] - AY)]) for k in J if k in OLDMAP}
        return g
    if 'scale' not in _old:
        P0 = _old['defs']['idle'].frames()[0][0]
        J0 = conv(anim2.RIG.solve(dict(P0)))
        leg = np.linalg.norm(J0['hip_l'] - J0['kn_l']) + np.linalg.norm(J0['kn_l'] - J0['an_l'])
        _old['scale'] = (B['thigh'] + B['shin']) / leg
    s = _old['scale']
    out = []
    for (P, d, ph, vx) in a.frames():
        g = conv(anim2.RIG.solve(dict(P)))
        u = lambda a_, b_: (g[b_] - g[a_]) / max(np.linalg.norm(g[b_] - g[a_]), 1e-6)
        F = {}
        pel = g['pelvis'] * s
        F['pel'] = np.array([pel[0], pel[1], 0.0])
        def put(k, base, a_, b_, L, z):
            v = u(a_, b_) * L
            F[k] = F[base] + np.array([v[0], v[1], 0.0]) + np.array([0, 0, z])
        put('neck', 'pel', 'pelvis', 'neck', B['torso'], 0)
        put('head', 'neck', 'neck', 'head', B['head'], 0)
        for sd, z in (('l', -1), ('r', 1)):
            S_ = sd.upper()
            sh = (g['sh_' + sd] - g['neck']) * s
            F['sh' + S_] = F['neck'] + np.array([sh[0], sh[1], z * B['sho']])
            put('el' + S_, 'sh' + S_, 'sh_' + sd, 'el_' + sd, B['uarm'], 0)
            put('hand' + S_, 'el' + S_, 'el_' + sd, 'hand_' + sd, B['farm'], 0)
            hp = (g['hip_' + sd] - g['pelvis']) * s
            F['hip' + S_] = F['pel'] + np.array([hp[0], hp[1], z * B['hip']])
            put('kn' + S_, 'hip' + S_, 'hip_' + sd, 'kn_' + sd, B['thigh'], 0)
            put('an' + S_, 'kn' + S_, 'kn_' + sd, 'an_' + sd, B['shin'], 0)
            put('toe' + S_, 'an' + S_, 'an_' + sd, 'toe_' + sd, B['foot'], 0)
        # 足が地面についているコマは、足首の高さを今の動きに合わせる（骨の長さが違う分のずれを直す）
        low = min(g['an_l'][1], g['an_r'][1])
        if low < 9:
            k = 'anL' if g['an_l'][1] <= g['an_r'][1] else 'anR'
            dy = low * s - F[k][1]
            F = {kk: v + np.array([0, dy, 0]) for kk, v in F.items()}
        for _ in range(int(d)): out.append((F, ph))
    # 構え（Mixamo）と前後の位置をそろえる：最初のコマの足の中点
    st = clip('idle')[0]
    f0 = out[0][0]
    if name == 'idle':
        dx = feet_mid(st)[0] - feet_mid(f0)[0]
    else:
        ref = old_frames('idle')[0]
        dx = feet_mid(st)[0] - feet_mid(ref)[0] + (ref['pel'][0] - feet_mid(ref)[0]) * 0  # 今の構えと同じずらし幅
        dx = feet_mid(st)[0] - feet_mid(ref)[0]
    if name == 'idle':
        res = [{k: v + np.array([dx, 0, 0]) for k, v in F.items()} for F, ph in out]
        _old[name] = res
        return res
    res = [{k: v + np.array([dx, 0, 0]) for k, v in F.items()} for F, ph in out]
    _old[name] = res
    return res


OLDMAP = ('pelvis', 'neck', 'head', 'sh_l', 'sh_r', 'el_l', 'el_r', 'hand_l', 'hand_r', 'hip_l', 'hip_r',
          'kn_l', 'kn_r', 'an_l', 'an_r', 'toe_l', 'toe_r')


def legs_from(F, P):
    """下半身を P の形に。上半身は腰の位置の差だけ動かす"""
    d = P['pel'] - F['pel']
    G = {k: (P[k].copy() if k in LOWER else v + d) for k, v in F.items()}
    return G


def lower(F, y):
    """腰の高さを y まで下げる（足首はそのまま、ひざで曲げる）"""
    dy = y - F['pel'][1]
    if dy >= 0: return F
    G = {k: (v.copy() if k in ('anL', 'anR', 'toeL', 'toeR') else v + np.array([0, dy, 0])) for k, v in F.items()}
    for sd in 'LR':
        G['kn' + sd], G['an' + sd] = m4.ik(G['hip' + sd], F['an' + sd], m4.B['thigh'], m4.B['shin'], G['kn' + sd] + np.array([4.0, 0, 0]))
        G['toe' + sd] = G['an' + sd] + (F['toe' + sd] - F['an' + sd])
    return G


def inplace(frames, axes, ref):
    """移動を消す（ゲームが動かすので絵はその場で）。x：腰の横移動、y：腰の上下（ジャンプの高さ）"""
    p0 = frames[0]['pel']
    out = []
    for f in frames:
        d = np.zeros(3)
        if 'x' in axes: d[0] = p0[0] - f['pel'][0]
        if 'y' in axes: d[1] = ref['pel'][1] - f['pel'][1]
        out.append(shift(f, d))
    return out


def sample(frames, t): return m4.sample(frames, t)


def ground_ankle(F): return min(F['anL'][1], F['anR'][1])


def segment(fr, kind):
    """ジャンプやしゃがみの、使う区間（コマ番号）を見つける"""
    h = np.array([ground_ankle(f) for f in fr]); py = np.array([f['pel'][1] for f in fr])
    air = np.where(h > h.min() + 4)[0]
    if kind in ('up', 'down', 'land', 'air'):
        a0, a1 = (air[0], air[-1]) if len(air) else (0, len(fr) - 1)
        top = a0 + int(np.argmax(py[a0:a1 + 1]))
        return dict(up=(max(0, a0 - 3), top), down=(top, a1), land=(a1, min(len(fr) - 1, a1 + 8)), air=(a0, a1))[kind]
    if kind in ('drop', 'rise'):
        v = np.abs(np.diff(py)); thr = v.max() * 0.12
        mv = np.where(v > thr)[0]
        return (mv[0], mv[-1] + 1)
    return (0, len(fr) - 1)


# ------------------------------------------------------------------ 作る
def build(name):
    sp = TABLE[name]; gd = game_data(name); P = poses()
    if sp['kind'] == 'old':
        out = [(F, ph) for F, ph in zip(old_frames(name), [c for c in game_ph(name)])]
        st = P['stand']
        ends = dict(crouch_in=(st, None), jump_up=(st, None), crouch_out=(None, st), land=(None, st))
        a_, b_ = ends.get(name, (None, None))
        return ease_ends(out, a_, b_, 2, 3), gd
    fr = clip(sp['clip'])
    if sp.get('legs'): fr = [legs_from(f, P[sp['legs']]) for f in fr]
    if sp.get('low'): fr = [lower(f, P['crouch']['pel'][1]) for f in fr]
    n = len(fr)
    a, b = 0, n - 1
    if 'win' in sp: a, b = int(sp['win'][0] * (n - 1)), int(sp['win'][1] * (n - 1))
    if 'seg' in sp: a, b = segment(fr, sp['seg'])
    fr = fr[a:b + 1]
    # 前足と後ろ足の中点を構えにそろえる（その場の動きにするものは最初のコマで）
    if True:
        dx = feet_mid(P['stand'])[0] - feet_mid(fr[0])[0]
        fr = [shift(f, [dx, 0, 0]) for f in fr]
    if sp.get('inplace'): fr = inplace(fr, sp['inplace'], P['air'] if 'y' in sp['inplace'] else P['stand'])
    start = P.get(sp.get('start', 'stand')) if sp.get('start', 'stand') else None
    end = P.get(sp.get('end', sp.get('start', 'stand'))) if sp.get('end', sp.get('start', 'stand')) else None

    if sp['kind'] == 'loop':
        sp_ = sp.get('speed', 1.0)
        N = gd['tot'] if sp.get('speed') else int(round(2 * (len(fr) - 1) / sp_))
        out = [(sample(fr, i * (len(fr) - 1) / N), '-') for i in range(N)]
        return out, gd

    if sp['kind'] == 'plain':
        N = gd['tot']
        out = [(sample(fr, i * (len(fr) - 1) / max(1, N - 1)), '-') for i in range(N)]
        return ease_ends(out, start, end, 2, 4), gd

    # ---- 攻撃
    hits = sp['hit']
    xs_all = {h: np.array([f[h][1] if sp.get('up') else f[h][0] for f in fr]) * (-1 if False else 1) for h in hits}
    if sp.get('up'):
        xs_all = {h: np.array([f[h][1] for f in fr]) for h in hits}      # 上へ突き上げる技は高さで見る
    hj = max(hits, key=lambda h: xs_all[h].max() - xs_all[h][0])
    xs = xs_all[hj]
    rest = xs[0]; top = xs.max()
    peak = np.where(xs >= rest + (top - rest) * 0.8)[0]
    imp = int(peak[0])
    while imp + 1 < len(xs) and xs[imp + 1] >= xs[imp]: imp += 1   # 最初の山の頂上
    imp_last = int(peak[-1]) if sp.get('multi') else imp
    v = np.abs(np.diff(xs)); thr = v.max() * 0.15
    t0 = imp
    while t0 > 0 and v[t0 - 1] > thr: t0 -= 1
    t0 = max(0, t0 - 2)
    t1 = imp_last
    while t1 < len(xs) - 1 and xs[t1] > rest + (top - rest) * 0.08: t1 += 1
    t1 = min(len(xs) - 1, t1 + 4)
    st, act, tot = gd['st'], gd['act'], gd['tot']
    rec = tot - (st - 1) - act
    span = (imp_last - imp) if sp.get('multi') else 0.6 * (act - 1)
    out = [(start if start is not None else fr[0], 's')]
    for g in range(st - 2):
        out.append((sample(fr, t0 + (imp - t0) * (g + 1) / (st - 1)), 's'))
    for g in range(act):
        out.append((sample(fr, imp + span * (g / max(1, act - 1))), 'a'))
    ta = imp + span
    for g in range(rec):
        u = (g + 1) / rec
        out.append((sample(fr, ta + (t1 - ta) * (u ** 0.85)), 'r'))
    out = out[:tot]
    out = ease_ends(out, start, end, 3, 5)
    # リーチ合わせ（前へ伸びる技だけ）
    if gd['reach'] and not sp.get('noreach') and not sp.get('up'):
        ai = [i for i, (_, ph) in enumerate(out) if ph == 'a']
        cur = max(out[i][0][hj][0] for i in ai)
        need = gd['reach'] - 8 - cur
        pk = ai[0]; n_ = len(out)
        for i in range(n_):
            if i <= pk: w = smooth(i / max(1, pk))
            elif i <= ai[-1]: w = 1.0
            else: w = smooth(1 - (i - ai[-1]) / max(1, n_ - 1 - ai[-1]))
            out[i] = (shift(out[i][0], [need * w, 0, 0]), out[i][1])
    gd = dict(gd, hit=hj)
    return out, gd


def ease_ends(out, start, end, nin, nout):
    n = len(out)
    for i in range(n):
        F, ph = out[i]
        if start is not None:
            F = blend(start, F, smooth(i / nin))
        if end is not None:
            F = blend(F, end, smooth(1 - (n - 1 - i) / nout))
        out[i] = (F, ph)
    return out


def bake(names=None):
    res = {}
    for name in (names or TABLE):
        fr, gd = build(name)
        res[name] = dict(jp=TABLE[name]['jp'], loop=TABLE[name]['kind'] == 'loop', reach=gd.get('reach'), hit=gd.get('hit'),
                         frames=[dict(ph=ph, j=m4.project(F)) for F, ph in fr])
    return res


if __name__ == '__main__':
    R = bake(sys.argv[1:] or None)
    for k, m in R.items():
        ph = ''.join(f['ph'] for f in m['frames'])
        a = [i for i, c in enumerate(ph) if c == 'a']
        gd = game_data(k)
        msg = ''
        if a:
            hx = round(max(m['frames'][i]['j'][m['hit']][0] for i in a) + 8, 1)
            msg = f"発生{a[0] + 1}F（{gd['st']}） 持続{len(a)}F（{gd['act']}） 先端{hx}（リーチ{gd['reach']}） 当てる所:{m['hit']}"
        print(f"{k:10s} {m['jp']:20s} 全体{len(ph):4d}F（ゲーム{gd['tot']}） {msg}")
