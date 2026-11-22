"""
変身キャラ男：ハンマー形態（gai_h）と大盾形態（gai_s）の全モーション
  ・共通の動き（待機・歩き・ジャンプ・やられ・ダウンなど）は moves2 の骨組みに、各形態の構えを差し込んで作る
  ・攻撃は形態ごとにまったく別物：ハンマーは大振りで重く、大盾は押し込みと受け返し
  ・武器の向き：ハンマーは wa（胴の向きからの傾き。0＝胴と同じく上、90＝前に水平、-90＝後ろに水平）
                大盾は sa（胴の向きからの傾き。0＝縦に立てる、90＝前に倒して水平）
  ・フレーム数は data.js の技データ（発生・持続・硬直）に合わせている
"""
import math
from anim2 import A
from moves2 import P, I, Fk, defs as base_defs

COMMON = ('idle', 'walk_f', 'walk_b', 'dash', 'dash_b', 'jump_up', 'jump_down', 'jump_f', 'jump_b', 'land',
          'crouch_in', 'crouch', 'crouch_out', 'guard', 'cguard', 'tech', 'hit_hi', 'hit_lo', 'hit_c',
          'launch', 'down', 'getup', 'ko', 'rush')

# ハンマー形態の構え：柄を両手で持ち、頭を肩の後ろにかつぐ
GH = dict(px=0, py=-70, lean=8, tw=0.55, hd=-4, al=I(30, -100), ar=I(18, -108), ll=I(28, -5), lr=I(-30, -5),
          fl=94, fr=80, hl='fist', hr='fist', wa=-62)
CH = P(GH, py=-46, lean=20, hd=-12, al=I(34, -72), ar=I(24, -78), ll=I(30, -5), lr=I(-22, -5), fr=60, wa=-48)
# 大盾形態の構え：盾を前に立てた半身、後ろ手は腰
GS = dict(px=0, py=-68, lean=12, tw=0.3, hd=-8, al=I(4, -92), ar=I(30, -96), ll=I(26, -5), lr=I(-28, -5),
          fl=92, fr=72, hl='fist', hr='fist', sa=4)
CS = P(GS, py=-44, lean=22, hd=-16, al=I(10, -62), ar=I(34, -66), ll=I(30, -5), lr=I(-22, -5), fr=56, sa=12)


def common(kind):
    G, C = (GH, CH) if kind == 'gai_h' else (GS, CS)
    out = []
    for a in base_defs('shuuen', G, C):
        if a.name not in COMMON:
            continue
        for kk in a.keys:
            p = kk['pose']
            # 重量級の爪の手は、ふつうの拳に
            if p.get('hl') == 'claw': p['hl'] = 'fist'
            if p.get('hr') == 'claw': p['hr'] = 'fist'
            if kind == 'gai_h' and 'wa' not in p: p['wa'] = -62
            if kind == 'gai_s' and 'sa' not in p: p['sa'] = 4
        out.append(a)
    return out


def defs(kind):
    out = common(kind)
    H = kind == 'gai_h'
    G, C = (GH, CH) if H else (GS, CS)
    FALL = P(G, py=-82, lean=6, hd=-4, ll=Fk(30, 50), lr=Fk(-6, 40), fl=70, fr=60)
    TOOL = ('tool', 15, 'hand_r')          # ハンマーの頭から手まで
    SH = ('shld_t', 11, 'shld_b')          # 盾の全体

    def add(a):
        out.append(a)
        return a

    def jatk(name, wind, hit, s, act, hitj):
        a = A(name, hit=hitj, flags={'air': True, 'high': True}, wy=4)
        a.k(FALL, 1, 's').k(wind, s - 3, 's', 'in').k(hit, 2, 's', 'snap', lag=0.25)
        a.k(P(hit, lean=hit['lean'] + 2), 1, 'a', hold=act - 1).k(FALL, 12, 'r')
        add(a)

    # ================================================================ 勝利・登場・変身
    if H:
        a = A('win')
        W1 = P(G, py=-74, lean=-6, tw=0.8, hd=10, al=I(24, -150), ar=I(14, -156), wa=0, ll=I(26, -5), lr=I(-30, -5))
        a.k(G, 1).k(P(G, py=-64, lean=18, wa=-90, ar=I(-10, -96)), 10, e='in').k(W1, 8, e='back', lag=0.3)
        for i in range(4):
            a.k(P(W1, hd=10 + 2 * math.sin(i * 1.7), py=-74 + 0.6 * math.sin(i * 1.7)), 12)
        add(a)
        a = A('intro')
        a.k(P(G, wa=150, ar=I(40, -60), al=I(20, -70), lean=14), 1).k(P(G, wa=150, ar=I(40, -60), al=I(20, -70), lean=14), 16)
        a.k(P(G, wa=10, ar=I(26, -140), al=I(16, -136), lean=-4), 10, e='out').k(G, 14, e='io')
        add(a)
    else:
        a = A('win')
        W1 = P(G, py=-72, lean=-2, tw=0.6, hd=-4, sa=0, ar=I(34, -104), al=I(-4, -150), hl='fist', ll=I(20, -5), lr=I(-24, -5))
        a.k(G, 1).k(P(G, py=-62, lean=22, sa=20), 10, e='in').k(W1, 8, e='snap', lag=0.3)
        for i in range(4):
            a.k(P(W1, py=-72 + 0.6 * math.sin(i * 1.6), al=I(-4, -150 + math.sin(i * 1.6))), 12)
        add(a)
        a = A('intro')
        a.k(P(G, sa=90, ar=I(40, -40), lean=20, py=-60), 1).k(P(G, sa=90, ar=I(40, -40), lean=20, py=-60), 16)
        a.k(P(G, sa=-6, ar=I(30, -110), lean=0, py=-72), 10, e='snap').k(G, 14, e='io')
        add(a)
    # 変身：武器を頭上で回して持ち替える（光に包まれる）。この形態の絵は前半、次の形態の絵は後半（change_in）
    a = A('change')
    if H:
        a.k(G, 1, 'r').k(P(G, py=-74, lean=-4, ar=I(10, -150), al=I(0, -146), wa=0), 4, 'r', 'snap')
        a.k(P(G, py=-76, lean=-6, ar=I(6, -156), al=I(-2, -150), wa=90), 4, 'r', 'lin').k(P(G, py=-76, lean=-6, ar=I(6, -156), al=I(-2, -150), wa=180), 4, 'r', 'lin')
    else:
        a.k(G, 1, 'r').k(P(G, py=-74, lean=-4, ar=I(10, -150), sa=0, al=I(-6, -140)), 4, 'r', 'snap')
        a.k(P(G, py=-76, lean=-6, ar=I(6, -156), sa=90, al=I(-4, -146)), 4, 'r', 'lin').k(P(G, py=-76, lean=-6, ar=I(6, -156), sa=180, al=I(-4, -146)), 4, 'r', 'lin')
    add(a)
    a = A('change_in')
    if H:
        a.k(P(G, py=-76, lean=-6, ar=I(6, -156), al=I(-2, -150), wa=0), 1, 'r').k(P(G, py=-64, lean=16, wa=-80), 4, 'r', 'snap').k(G, 4, 'r', 'io')
    else:
        a.k(P(G, py=-76, lean=-6, ar=I(6, -156), sa=0, al=I(-4, -146)), 1, 'r').k(P(G, py=-62, lean=20, sa=10), 4, 'r', 'snap').k(G, 4, 'r', 'io')
    add(a)

    # ================================================================ 投げ
    TR = P(G, lean=22, px=8, tw=0.35, al=I(62, -112), hl='open', ll=I(36, -5), fr=50)
    a = add(A('throw', hit=('hand_l', 10, 'el_l')))
    a.k(G, 1, 's').k(P(G, lean=16, tw=0.5, al=I(44, -112), hl='open'), 4, 's', 'snap', lag=0.2)
    a.k(TR, 1, 'a', hold=2).k(P(TR, px=4, lean=16), 8, 'r', 'out').k(G, 12, 'r')
    a = add(A('throw_do', flags={'throw': True}))
    if H:   # つかんで、ハンマーの柄で打ち上げる
        a.k(TR, 2).k(P(TR, wa=-110, ar=I(-6, -130)), 8, e='in')
        a.k(P(TR, lean=-6, wa=60, ar=I(56, -140), al=I(40, -150)), 4, e='snap', hold=8)
        a.k(P(G, lean=10, wa=-40), 10, e='out').k(G, 8)
    else:   # つかんで、盾ごと体当たりで突き飛ばす
        a.k(TR, 2).k(P(TR, px=-2, lean=6, sa=10, ar=I(20, -96)), 8, e='in')
        a.k(P(G, px=16, lean=34, sa=26, ar=I(58, -98), al=I(40, -100), ll=I(50, -5), lr=I(-14, -5)), 4, e='snap', hold=8)
        a.k(P(G, px=8, lean=20), 10, e='out').k(G, 8)

    if H:
        # ============================================================ ハンマー形態：立ち通常技
        # 弱P 後ろ手のジャブ（発生5）
        a = add(A('lp', hit=('hand_l', 8, 'el_l')))
        a.k(G, 1, 's').k(P(G, al=I(26, -108), lean=10), 1, 's')
        a.k(P(G, px=3, lean=14, tw=0.4, al=I(66, -112), ll=I(30, -5)), 2, 's', 'snap', lag=0.3)
        a.k(P(G, px=4, lean=15, tw=0.38, al=I(74, -112), ll=I(30, -5)), 1, 'a', 'out', hold=1)
        a.k(P(G, px=2, al=I(46, -108)), 4, 'r', 'out').k(G, 4, 'r')
        # 中P 横なぎ（発生8）：頭を後ろへ引き、胸の高さで前へ振り抜く
        a = add(A('mp', hit=TOOL))
        a.k(G, 1, 's').k(P(G, px=-3, lean=0, tw=0.9, wa=-100, ar=I(-10, -96), al=I(10, -100)), 3, 's', 'in')
        a.k(P(G, px=8, lean=18, tw=0.3, wa=60, ar=I(46, -104), al=I(36, -102), ll=I(36, -5)), 3, 's', 'snap', lag=0.3)
        a.k(P(G, px=10, lean=20, tw=0.2, wa=88, ar=I(52, -102), al=I(40, -100), ll=I(38, -5)), 1, 'a', 'out', hold=2)
        a.k(P(G, px=8, lean=18, tw=0.1, wa=130, ar=I(40, -92), al=I(32, -94)), 5, 'r', 'out').k(P(G, wa=-20), 9, 'r', 'io')
        # 強P 振り下ろし（発生14・発生前アーマー）：頭上に振りかぶり、前の地面へ叩きつける
        a = add(A('hp', hit=('tool', 17, 'hand_r')))
        a.k(G, 1, 's').k(P(G, px=-4, py=-74, lean=-8, tw=0.6, hd=6, wa=-120, ar=I(-6, -150), al=I(-14, -146)), 5, 's', 'in')
        a.k(P(G, px=-6, py=-76, lean=-14, tw=0.6, hd=10, wa=-150, ar=I(-12, -156), al=I(-18, -150)), 4, 's', 'io', hold=1)
        a.k(P(G, px=12, py=-60, lean=30, tw=0.3, hd=-14, wa=96, ar=I(58, -64), al=I(48, -70), ll=I(46, -5), lr=I(-14, -5), fr=50), 3, 's', 'snap', lag=0.25)
        a.k(P(G, px=14, py=-58, lean=34, tw=0.3, hd=-16, wa=108, ar=I(60, -52), al=I(50, -58), ll=I(48, -5), lr=I(-14, -5), fr=48), 1, 'a', 'back', hold=3)
        a.k(P(G, px=12, py=-58, lean=32, wa=112, ar=I(58, -48), al=I(48, -54), ll=I(46, -5), lr=I(-14, -5)), 10, 'r', 'out')
        a.k(P(G, px=4, lean=16, wa=20), 8, 'r', 'io').k(G, 4, 'r')
        # 弱K 前足のすね蹴り（発生6）
        a = add(A('lk', hit=('toe_l', 8, 'an_l')))
        a.k(G, 1, 's').k(P(G, lean=4, ll=Fk(60, 100), fl=40), 2, 's', 'out')
        a.k(P(G, lean=-4, ll=Fk(66, 8), fl=90), 2, 's', 'snap').k(P(G, lean=-5, ll=Fk(68, 4), fl=92), 1, 'a', hold=1)
        a.k(P(G, lean=2, ll=Fk(50, 80)), 4, 'r', 'out').k(G, 5, 'r')
        # 中K 押し出す前蹴り（発生8）
        a = add(A('mk', hit=('toe_l', 10, 'an_l')))
        a.k(G, 1, 's').k(P(G, lean=-6, ll=Fk(88, 120), fl=60), 3, 's', 'in')
        a.k(P(G, lean=-14, px=2, ll=Fk(86, 6), fl=112), 3, 's', 'snap', lag=0.2).k(P(G, lean=-15, px=2, ll=Fk(86, 2), fl=114), 1, 'a', hold=2)
        a.k(P(G, lean=-4, ll=Fk(70, 100)), 6, 'r', 'out').k(G, 7, 'r')
        # 強K かち上げスイング（発生11）：下から上へ振り上げる
        a = add(A('hk', hit=('tool', 16, 'hand_r')))
        a.k(G, 1, 's').k(P(G, py=-62, lean=24, tw=0.8, wa=170, ar=I(-8, -40), al=I(4, -44)), 5, 's', 'in')
        a.k(P(G, py=-70, lean=8, tw=0.4, wa=120, ar=I(40, -60), al=I(30, -66), ll=I(34, -5)), 3, 's', 'snap', lag=0.25)
        a.k(P(G, py=-76, lean=-8, tw=0.3, hd=10, wa=20, ar=I(42, -126), al=I(34, -122), ll=I(34, -5)), 2, 's', 'snap')
        a.k(P(G, py=-78, lean=-14, tw=0.3, hd=14, wa=-10, ar=I(36, -140), al=I(28, -136), ll=I(34, -5)), 1, 'a', 'out', hold=3)
        a.k(P(G, py=-74, lean=-6, wa=-60, ar=I(10, -130)), 8, 'r', 'out').k(P(G, wa=-50), 8, 'r', 'io').k(G, 4, 'r')

        # ============================================================ しゃがみ通常技
        a = add(A('c_lp', hit=('hand_l', 7, 'el_l')))
        a.k(C, 1, 's').k(P(C, al=I(30, -80)), 1, 's').k(P(C, px=3, lean=26, al=I(64, -86)), 2, 's', 'snap', lag=0.3)
        a.k(P(C, px=4, lean=27, al=I(71, -86)), 1, 'a', hold=1).k(P(C, al=I(44, -82)), 3, 'r', 'out').k(C, 4, 'r')
        # しゃがみ中P 頭で突く（発生8）
        a = add(A('c_mp', hit=TOOL))
        a.k(C, 1, 's').k(P(C, px=-2, wa=-80, ar=I(6, -70)), 3, 's', 'in')
        a.k(P(C, px=6, lean=28, wa=92, ar=I(50, -70), al=I(40, -68)), 3, 's', 'snap', lag=0.25).k(P(C, px=7, lean=29, wa=94, ar=I(56, -70), al=I(44, -68)), 1, 'a', hold=2)
        a.k(P(C, px=4, wa=60, ar=I(40, -70)), 5, 'r', 'out').k(C, 7, 'r')
        # しゃがみ強P 対空の振り上げ（発生8）
        a = add(A('c_hp', hit=('tool', 17, 'hand_r')))
        a.k(C, 1, 's').k(P(C, py=C['py'] + 2, lean=C['lean'] + 6, tw=0.8, wa=150, ar=I(10, -40)), 3, 's', 'in')
        a.k(P(G, py=-70, lean=0, tw=0.4, hd=6, wa=40, ar=I(36, -118), al=I(26, -112), ll=I(30, -5)), 3, 's', 'snap', lag=0.3)
        a.k(P(G, py=-74, lean=-6, tw=0.3, hd=10, wa=0, ar=I(30, -140), al=I(22, -134), ll=I(30, -5)), 1, 'a', 'snap')
        a.k(P(G, py=-76, lean=-10, tw=0.3, hd=12, wa=-30, ar=I(22, -144), al=I(14, -138), ll=I(30, -5)), 1, 'a', 'out', hold=2)
        a.k(P(G, py=-72, lean=4, wa=-60, ar=I(16, -124)), 8, 'r', 'out').k(C, 12, 'r')
        a = add(A('c_lk', hit=('toe_l', 8, 'an_l'), flags={'low': True}))
        a.k(C, 1, 's').k(P(C, ll=Fk(40, 60), fl=60), 2, 's', 'out').k(P(C, lean=26, py=C['py'] + 2, ll=Fk(80, 2), fl=96), 2, 's', 'snap')
        a.k(P(C, lean=27, py=C['py'] + 2, ll=Fk(82, 0), fl=98), 1, 'a', hold=1).k(P(C, ll=Fk(50, 70)), 3, 'r', 'out').k(C, 5, 'r')
        # しゃがみ中K 地面すれすれをハンマーで払う（下段・発生9）
        a = add(A('c_mk', hit=TOOL, flags={'low': True}))
        a.k(C, 1, 's').k(P(C, lean=24, wa=-110, ar=I(-6, -40)), 4, 's', 'in')
        a.k(P(C, px=6, lean=32, py=C['py'] + 4, wa=150, ar=I(44, -24), al=I(36, -30)), 3, 's', 'snap', lag=0.2)
        a.k(P(C, px=7, lean=33, py=C['py'] + 4, wa=158, ar=I(50, -22), al=I(40, -28)), 1, 'a', hold=2)
        a.k(P(C, px=4, lean=28, wa=120, ar=I(36, -34)), 6, 'r', 'out').k(C, 9, 'r')
        # しゃがみ強K 大振りの足払い（下段・ダウン・発生11）
        a = add(A('c_hk', hit=('tool', 16, 'hand_r'), flags={'low': True, 'sweep': True}))
        a.k(C, 1, 's').k(P(C, lean=30, tw=0.95, wa=-140, ar=I(-20, -30), al=I(-4, -36)), 5, 's', 'in')
        a.k(P(C, px=8, lean=38, py=C['py'] + 6, tw=0.2, wa=150, ar=I(56, -20), al=I(44, -24), ll=I(40, -5)), 4, 's', 'snap', lag=0.25)
        a.k(P(C, px=10, lean=40, py=C['py'] + 6, tw=0.1, wa=170, ar=I(62, -16), al=I(48, -20), ll=I(42, -5)), 1, 'a', 'lin', hold=2)
        a.k(P(C, px=8, lean=36, wa=200, ar=I(50, -18)), 10, 'r', 'out').k(P(C, lean=24), 8, 'r').k(C, 6, 'r')

        # ============================================================ ジャンプ攻撃
        jatk('j_p', P(FALL, al=I(26, -108), tw=0.5), P(FALL, lean=26, tw=0.25, al=Fk(58, 4)), 5, 8, ('hand_l', 9, 'el_l'))
        jatk('j_hp', P(FALL, lean=-14, tw=0.8, wa=-140, ar=I(-6, -140), al=I(-14, -136), hd=6),
             P(FALL, lean=30, tw=0.2, hd=-14, wa=110, ar=I(48, -70), al=I(38, -76)), 9, 6, ('tool', 17, 'hand_r'))
        jatk('j_k', P(FALL, ll=Fk(80, 120), lean=4), P(FALL, lean=-12, ll=Fk(72, 6), fl=80, lr=Fk(0, 70)), 6, 9, ('toe_l', 9, 'an_l'))
        jatk('j_hk', P(FALL, lean=14, tw=0.85, lr=Fk(30, 125)), P(FALL, lean=-22, tw=0.15, lr=Fk(78, 2), fr=78, ll=Fk(20, 90)), 9, 6, ('toe_r', 10, 'an_r'))

        # ============================================================ 特殊技 →強P 地響き（中段・発生19）
        a = add(A('f_hp', hit=('tool', 17, 'hand_r')))
        a.k(G, 1, 's').k(P(G, py=-76, lean=-10, tw=0.6, hd=8, wa=-140, ar=I(-4, -154), al=I(-12, -150)), 8, 's', 'in')
        a.k(P(G, py=-80, lean=-16, tw=0.6, hd=12, wa=-170, ar=I(-8, -160), al=I(-16, -154), ll=Fk(30, 50), fl=60), 6, 's', 'io')
        a.k(P(G, px=16, py=-56, lean=38, tw=0.3, hd=-16, wa=110, ar=I(62, -48), al=I(52, -54), ll=I(52, -5), lr=I(-12, -5), fr=46), 3, 's', 'snap', lag=0.2)
        a.k(P(G, px=17, py=-54, lean=40, wa=116, ar=I(64, -40), al=I(54, -46), ll=I(52, -5), lr=I(-12, -5)), 1, 'a', 'back', hold=2)
        a.k(P(G, px=14, py=-56, lean=36, wa=118, ar=I(62, -38)), 12, 'r', 'out').k(P(G, wa=0), 8, 'r', 'io')

        # ============================================================ 必殺技
        # 地割れ（↓↘→P）：振りかぶって地面を叩き、衝撃波を走らせる
        a = add(A('sp_quake', hit=('tool', 16, 'hand_r'), flags={'proj': 'tool'}))
        a.k(G, 1, 's').k(P(G, py=-76, lean=-8, wa=-130, ar=I(-4, -150), al=I(-12, -146), hd=6), 6, 's', 'in')
        a.k(P(G, px=12, py=-54, lean=36, wa=120, ar=I(58, -34), al=I(48, -40), ll=I(46, -5), lr=I(-12, -5), fr=46), 4, 's', 'snap', lag=0.2)
        a.k(P(G, px=13, py=-52, lean=38, wa=126, ar=I(60, -28), al=I(50, -34), ll=I(46, -5), lr=I(-12, -5)), 1, 'a', 'back', hold=2)
        a.k(P(G, px=12, py=-54, lean=36, wa=126), 10, 'r', 'out').k(P(G, wa=0), 8, 'r', 'io').k(G, 2, 'r')
        # かち上げ（→↓↘P）：しゃがんでから全身で真上へ振り上げる対空（飛び上がる）
        a = add(A('sp_upper', hit=('tool', 18, 'hand_r')))
        a.k(G, 1, 's').k(P(C, lean=34, tw=0.9, wa=170, ar=I(6, -30), al=I(18, -34)), 2, 's', 'snap')
        a.k(P(G, py=-74, lean=4, tw=0.4, hd=6, wa=80, ar=I(44, -96), al=I(34, -92)), 2, 's', 'snap', lag=0.2)
        a.k(P(G, py=-80, lean=-10, tw=0.3, hd=14, wa=0, ar=I(30, -150), al=I(22, -146), ll=Fk(30, 50), lr=Fk(-10, 40), fl=60, fr=50), 2, 'a', 'snap')
        a.k(P(G, py=-82, lean=-16, tw=0.3, hd=16, wa=-30, ar=I(20, -156), al=I(14, -150), ll=Fk(30, 60), lr=Fk(-10, 50), fl=60, fr=50), 1, 'a', 'out', hold=4)
        a.k(P(FALL, wa=-60, ar=I(16, -130)), 10, 'r', 'io').k(P(FALL, wa=-60), 14, 'r')
        # 大回転（↓↙←P）：アーマーで受けながら2回振り回す
        a = add(A('sp_spin', hit=('tool', 17, 'hand_r')))
        a.k(G, 1, 's').k(P(G, px=-2, lean=4, tw=0.95, wa=-110, ar=I(-16, -96), al=I(-4, -98)), 5, 's', 'in')
        for i, (tw, wa, x, y) in enumerate(((0.2, 84, 54, -98), (0.9, -100, -20, -96), (0.2, 88, 56, -96), (0.9, -100, -18, -94))):
            a.k(P(G, px=6 + i, lean=14, tw=tw, wa=wa, ar=I(x, y), al=I(x * 0.7, y), ll=I(34, -5)), 3 if i == 0 else 4, 'a', 'lin')
        a.k(P(G, px=8, lean=18, tw=0.3, wa=100, ar=I(50, -90)), 4, 'a', 'lin')
        a.k(P(G, px=6, lean=14, wa=140, ar=I(36, -84)), 8, 'r', 'out').k(P(G, wa=0), 8, 'r', 'io').k(G, 4, 'r')
        # 飛び叩き（↓↘→K）：大きく飛び上がり、落ちながら上から叩く（中段）
        a = add(A('sp_leap', hit=('tool', 18, 'hand_r')))
        a.k(G, 1, 's').k(P(C, lean=24, wa=-60), 3, 's', 'in')
        a.k(P(FALL, py=-84, lean=-12, tw=0.6, wa=-150, ar=I(-6, -156), al=I(-14, -150), ll=Fk(60, 110), lr=Fk(30, 100)), 4, 's', 'snap')
        a.k(P(FALL, py=-84, lean=-16, tw=0.6, wa=-170, ar=I(-8, -160), al=I(-16, -154), ll=Fk(60, 110), lr=Fk(30, 100)), 8, 's', 'io')
        a.k(P(FALL, lean=34, tw=0.2, hd=-14, wa=110, ar=I(56, -60), al=I(46, -66), ll=Fk(40, 60), lr=Fk(10, 50)), 3, 'a', 'snap', lag=0.2)
        a.k(P(FALL, lean=36, wa=118, ar=I(58, -50), al=I(48, -56)), 14, 'a')
        a.k(P(G, px=12, py=-54, lean=36, wa=120, ar=I(58, -34)), 6, 'r').k(P(G, wa=0), 10, 'r', 'io')

        # ============================================================ 超必殺
        # Lv1 大槌連打（↓↘→↓↘→P）：踏み込みながら左右に何度も叩き込み、最後に大振り
        a = add(A('su_1', hit=('tool', 18, 'hand_r')))
        a.k(G, 1, 's').k(P(G, py=-74, lean=-6, wa=-120, ar=I(-6, -146), al=I(-14, -140)), 4, 's', 'in')
        seq = [(100, 58, -70, 30), (-60, 10, -126, 6), (96, 56, -66, 30), (-70, 8, -128, 6), (100, 58, -70, 30), (-90, 0, -140, -4)]
        for i, (wa, x, y, ln) in enumerate(seq):
            a.k(P(G, px=8 + i, py=-64, lean=ln, tw=0.4 if i % 2 == 0 else 0.8, wa=wa, ar=I(x, y), al=I(x * 0.8, y + 4), ll=I(40, -5)), 4, 'a', 'snap' if i % 2 == 0 else 'io')
        a.k(P(G, px=16, py=-54, lean=40, wa=120, ar=I(62, -34), al=I(50, -40), ll=I(50, -5), lr=I(-12, -5)), 3, 'a', 'snap', hold=6)
        a.k(P(G, px=12, lean=30, wa=120), 12, 'r', 'out').k(P(G, wa=0), 10, 'r', 'io')
        # Lv2 ギガントスイング（↓↙←↓↙←P）：回りながら前へ進み、何度も振り回す
        a = add(A('su_2', hit=('tool', 19, 'hand_r')))
        a.k(G, 1, 's').k(P(G, px=-4, lean=2, tw=1.0, wa=-110, ar=I(-20, -96)), 5, 's', 'in')
        for i in range(8):
            fw = i % 2 == 0
            a.k(P(G, px=6, lean=16, tw=0.15 if fw else 0.95, wa=88 if fw else -100, ar=I(58 if fw else -22, -98), al=I(40 if fw else -10, -96), ll=I(34, -5)), 4, 'a', 'lin')
        a.k(P(G, px=10, py=-76, lean=-10, wa=0, ar=I(36, -150), al=I(26, -146)), 4, 'a', 'snap', hold=4)
        a.k(P(G, wa=-40), 12, 'r', 'out').k(G, 8, 'r', 'io')
        # Lv3 天崩（↓↘→↓↘→K）：高く飛び上がり、落下の勢いで地面ごと叩き割る
        a = add(A('su_3', hit=('tool', 22, 'hand_r')))
        a.k(G, 1, 's').k(P(C, lean=30, wa=-80), 4, 's', 'in')
        a.k(P(FALL, py=-86, lean=-14, wa=-150, ar=I(-6, -158), al=I(-14, -152), ll=Fk(60, 110), lr=Fk(30, 100)), 6, 's', 'snap')
        a.k(P(FALL, lean=36, tw=0.2, hd=-14, wa=110, ar=I(56, -60), al=I(46, -66)), 4, 'a', 'snap', lag=0.2)
        a.k(P(FALL, lean=38, wa=120, ar=I(58, -48), al=I(48, -54)), 20, 'a')
        a.k(P(G, px=14, py=-50, lean=40, wa=124, ar=I(62, -26), al=I(50, -32), ll=I(52, -5), lr=I(-12, -5)), 2, 'a', 'snap', hold=10)
        a.k(P(G, px=12, lean=32, wa=124), 12, 'r', 'out').k(P(G, wa=0), 10, 'r', 'io')
    else:
        # ============================================================ 大盾形態：立ち通常技
        # 弱P 盾の縁で小突く（発生4）
        a = add(A('lp', hit=SH))
        a.k(G, 1, 's').k(P(G, px=4, lean=16, sa=8, ar=I(46, -98)), 2, 's', 'snap', lag=0.2)
        a.k(P(G, px=5, lean=17, sa=10, ar=I(52, -98)), 1, 'a', hold=1).k(P(G, px=2, ar=I(38, -96)), 3, 'r', 'out').k(G, 4, 'r')
        # 中P 盾の押し出し（発生7）
        a = add(A('mp', hit=SH))
        a.k(G, 1, 's').k(P(G, px=-3, lean=6, sa=0, ar=I(20, -96)), 3, 's', 'in')
        a.k(P(G, px=10, lean=22, sa=12, ar=I(58, -98), al=I(10, -90), ll=I(40, -5)), 2, 's', 'snap', lag=0.2)
        a.k(P(G, px=12, lean=24, sa=14, ar=I(62, -98), ll=I(42, -5)), 1, 'a', hold=2).k(P(G, px=8, lean=18, ar=I(46, -96)), 5, 'r', 'out').k(G, 7, 'r')
        # 強P 全身で盾を叩きつける（発生11）
        a = add(A('hp', hit=SH))
        a.k(G, 1, 's').k(P(G, px=-6, py=-72, lean=-4, tw=0.6, sa=-20, ar=I(6, -110)), 5, 's', 'in')
        a.k(P(G, px=16, py=-62, lean=30, tw=0.2, sa=30, ar=I(66, -94), al=I(20, -90), ll=I(48, -5), lr=I(-12, -5), fr=46), 4, 's', 'snap', lag=0.2)
        a.k(P(G, px=18, py=-60, lean=32, tw=0.2, sa=34, ar=I(70, -92), ll=I(50, -5), lr=I(-12, -5)), 1, 'a', 'back', hold=3)
        a.k(P(G, px=14, lean=26, sa=26, ar=I(60, -94)), 8, 'r', 'out').k(P(G, px=6, lean=16), 6, 'r', 'io').k(G, 4, 'r')
        a = add(A('lk', hit=('toe_l', 8, 'an_l')))
        a.k(G, 1, 's').k(P(G, lean=6, ll=Fk(60, 100), fl=40), 2, 's', 'out').k(P(G, lean=-2, ll=Fk(64, 8), fl=90), 1, 's', 'snap')
        a.k(P(G, lean=-3, ll=Fk(66, 4), fl=92), 1, 'a', hold=1).k(P(G, lean=4, ll=Fk(50, 80)), 4, 'r', 'out').k(G, 4, 'r')
        # 中K 盾を構えたままの横蹴り（発生8）
        a = add(A('mk', hit=('toe_l', 10, 'an_l')))
        a.k(G, 1, 's').k(P(G, lean=-4, tw=0.7, ll=Fk(90, 130), fl=60), 3, 's', 'in')
        a.k(P(G, lean=-18, tw=0.6, ll=Fk(88, 4), fl=110), 3, 's', 'snap', lag=0.2).k(P(G, lean=-19, tw=0.6, ll=Fk(88, 0), fl=112), 1, 'a', hold=2)
        a.k(P(G, lean=-4, ll=Fk(70, 100)), 6, 'r', 'out').k(G, 7, 'r')
        # 強K 盾のかち上げ（発生12）：盾の下端で下からすくい上げる
        a = add(A('hk', hit=SH))
        a.k(G, 1, 's').k(P(G, py=-58, lean=30, tw=0.6, sa=60, ar=I(30, -46)), 5, 's', 'in')
        a.k(P(G, py=-70, lean=10, tw=0.3, sa=20, ar=I(50, -90), ll=I(36, -5)), 3, 's', 'snap', lag=0.2)
        a.k(P(G, py=-78, lean=-10, tw=0.3, hd=10, sa=-20, ar=I(46, -130), ll=I(34, -5)), 3, 's', 'snap')
        a.k(P(G, py=-80, lean=-14, sa=-30, ar=I(42, -138), ll=I(34, -5)), 1, 'a', hold=2)
        a.k(P(G, py=-74, lean=-4, sa=-10, ar=I(36, -116)), 10, 'r', 'out').k(G, 10, 'r', 'io')

        # ============================================================ しゃがみ通常技
        a = add(A('c_lp', hit=('hand_l', 7, 'el_l')))
        a.k(C, 1, 's').k(P(C, al=I(26, -66)), 1, 's').k(P(C, px=3, lean=28, al=I(60, -70)), 1, 's', 'snap', lag=0.3)
        a.k(P(C, px=4, lean=29, al=I(66, -70)), 1, 'a', hold=1).k(P(C, al=I(36, -64)), 3, 'r', 'out').k(C, 4, 'r')
        # しゃがみ中P 盾を低く突き出す（発生7）
        a = add(A('c_mp', hit=SH))
        a.k(C, 1, 's').k(P(C, px=-2, sa=0, ar=I(22, -64)), 3, 's', 'in')
        a.k(P(C, px=8, lean=30, sa=20, ar=I(56, -62)), 2, 's', 'snap', lag=0.2).k(P(C, px=9, lean=31, sa=22, ar=I(60, -62)), 1, 'a', hold=2)
        a.k(P(C, px=4, ar=I(44, -64)), 5, 'r', 'out').k(C, 7, 'r')
        # しゃがみ強P 盾を頭上へ跳ね上げる対空（発生8）
        a = add(A('c_hp', hit=SH))
        a.k(C, 1, 's').k(P(C, py=C['py'] + 2, lean=C['lean'] + 6, sa=60, ar=I(30, -40)), 3, 's', 'in')
        a.k(P(G, py=-72, lean=-2, sa=-40, ar=I(36, -124), ll=I(30, -5)), 3, 's', 'snap', lag=0.3)
        a.k(P(G, py=-76, lean=-8, sa=-60, ar=I(30, -140), ll=I(30, -5)), 1, 'a', 'out', hold=3)
        a.k(P(G, py=-72, lean=4, sa=-20, ar=I(34, -116)), 8, 'r', 'out').k(C, 12, 'r')
        a = add(A('c_lk', hit=('toe_l', 8, 'an_l'), flags={'low': True}))
        a.k(C, 1, 's').k(P(C, ll=Fk(40, 60), fl=60), 2, 's', 'out').k(P(C, lean=26, py=C['py'] + 2, ll=Fk(80, 2), fl=96), 1, 's', 'snap')
        a.k(P(C, lean=27, py=C['py'] + 2, ll=Fk(82, 0), fl=98), 1, 'a', hold=1).k(P(C, ll=Fk(50, 70)), 3, 'r', 'out').k(C, 4, 'r')
        a = add(A('c_mk', hit=('toe_l', 9, 'an_l'), flags={'low': True}))
        a.k(C, 1, 's').k(P(C, lean=30, ll=Fk(50, 80), fl=60), 3, 's', 'in')
        a.k(P(C, lean=34, py=C['py'] + 5, px=-2, ll=Fk(84, 0), fl=98, lr=I(-26, -5)), 3, 's', 'snap', lag=0.2)
        a.k(P(C, lean=35, py=C['py'] + 5, px=-2, ll=Fk(86, 0), fl=100, lr=I(-26, -5)), 1, 'a', hold=2).k(P(C, lean=28, ll=Fk(55, 80)), 6, 'r', 'out').k(C, 7, 'r')
        a = add(A('c_hk', hit=('toe_r', 9, 'an_r'), flags={'low': True, 'sweep': True}))
        a.k(C, 1, 's').k(P(C, lean=40, py=C['py'] + 8, tw=0.9, al=I(34, -8), hl='open', lr=Fk(-40, 60)), 4, 's', 'in')
        a.k(P(C, lean=44, py=C['py'] + 12, tw=0.3, al=I(36, -8), hl='open', lr=Fk(70, 0), fr=90, ll=I(20, -5)), 4, 's', 'snap')
        a.k(P(C, lean=44, py=C['py'] + 13, tw=0.15, al=I(36, -8), hl='open', lr=Fk(98, -2), fr=100, ll=I(18, -5)), 2, 'a', 'lin', hold=1)
        a.k(P(C, lean=40, py=C['py'] + 12, al=I(36, -8), hl='open', lr=Fk(120, 0), fr=110, ll=I(18, -5)), 9, 'r', 'out')
        a.k(P(C, lean=30, lr=Fk(-20, 80)), 8, 'r').k(C, 6, 'r')

        # ============================================================ ジャンプ攻撃
        jatk('j_p', P(FALL, al=I(26, -108), tw=0.5), P(FALL, lean=26, tw=0.25, al=Fk(58, 4)), 5, 8, ('hand_l', 9, 'el_l'))
        jatk('j_hp', P(FALL, lean=-10, sa=-40, ar=I(20, -130)), P(FALL, lean=34, sa=70, ar=I(50, -70)), 8, 6, SH)
        jatk('j_k', P(FALL, ll=Fk(80, 120), lean=4), P(FALL, lean=-12, ll=Fk(72, 6), fl=80, lr=Fk(0, 70)), 6, 9, ('toe_l', 9, 'an_l'))
        jatk('j_hk', P(FALL, lean=14, tw=0.85, lr=Fk(30, 125)), P(FALL, lean=-22, tw=0.15, lr=Fk(78, 2), fr=78, ll=Fk(20, 90)), 9, 6, ('toe_r', 10, 'an_r'))

        # ============================================================ 特殊技 →強P 盾落とし（中段・発生18）
        a = add(A('f_hp', hit=SH))
        a.k(G, 1, 's').k(P(G, py=-78, lean=-10, sa=-30, ar=I(20, -146), ll=Fk(30, 50), fl=60), 9, 's', 'in')
        a.k(P(G, py=-82, lean=-14, sa=-40, ar=I(16, -150), ll=Fk(30, 50), fl=60), 5, 's', 'io')
        a.k(P(G, px=16, py=-58, lean=36, sa=60, ar=I(60, -64), ll=I(50, -5), lr=I(-12, -5)), 3, 's', 'snap', lag=0.2)
        a.k(P(G, px=17, py=-56, lean=38, sa=66, ar=I(62, -58), ll=I(50, -5), lr=I(-12, -5)), 1, 'a', 'back', hold=2)
        a.k(P(G, px=14, py=-58, lean=34, sa=60), 12, 'r', 'out').k(G, 8, 'r', 'io')

        # ============================================================ 必殺技
        # 盾構え（↓↙←K）：盾を構えて受け止める（当て身）。受けたら sp_counter_do で反撃
        a = add(A('sp_counter'))
        a.k(G, 1, 's').k(P(G, px=-4, py=-64, lean=18, tw=0.2, sa=2, ar=I(36, -96), al=I(30, -92), ll=I(30, -5), lr=I(-30, -5), hd=-14), 3, 'r', 'snap')
        a.k(P(G, px=-4, py=-63, lean=19, sa=2, ar=I(37, -96), al=I(31, -92), ll=I(30, -5), lr=I(-30, -5), hd=-14), 18, 'r')
        a.k(G, 10, 'r', 'io')
        a = add(A('sp_counter_do', hit=SH))
        a.k(P(G, px=-4, py=-64, lean=18, sa=2, ar=I(36, -96)), 1, 's').k(P(G, px=18, py=-60, lean=34, sa=36, ar=I(72, -92), ll=I(50, -5), lr=I(-12, -5)), 2, 's', 'snap')
        a.k(P(G, px=20, py=-58, lean=36, sa=40, ar=I(76, -90), ll=I(52, -5), lr=I(-12, -5)), 1, 'a', 'back', hold=2)
        a.k(P(G, px=14, lean=26, sa=26), 10, 'r', 'out').k(G, 8, 'r', 'io')
        # 盾突進（↓↘→P）：盾を前に構えて走り込む（飛び道具を抜ける）
        a = add(A('sp_charge', hit=SH))
        a.k(G, 1, 's').k(P(G, px=-4, py=-64, lean=20, sa=10, ar=I(30, -96)), 5, 's', 'in')
        nf = 6
        for i in range(nf):
            s_ = math.sin(i / nf * math.tau)
            a.k(P(G, px=8, py=-62, lean=30, tw=0.25, sa=12, ar=I(50, -96), al=I(20 - 10 * s_, -90), ll=I(26 + 20 * s_, -6), lr=I(-20 - 20 * s_, -6)), 2, 'a', 'lin')
        a.k(P(G, px=10, py=-60, lean=32, sa=20, ar=I(60, -96)), 2, 'a', 'snap', hold=2)
        a.k(P(G, px=6, lean=20, sa=10), 10, 'r', 'out').k(G, 6, 'r', 'io')
        # 跳ね上げ（→↓↘P）：盾ごと真上へ飛び上がる対空
        a = add(A('sp_lift', hit=SH))
        a.k(G, 1, 's').k(P(C, lean=30, sa=50, ar=I(30, -40)), 2, 's', 'snap')
        a.k(P(G, py=-76, lean=-4, sa=-20, ar=I(40, -120), ll=Fk(30, 50), lr=Fk(-10, 40), fl=60, fr=50), 2, 's', 'snap', lag=0.2)
        a.k(P(G, py=-82, lean=-12, sa=-50, ar=I(32, -148), ll=Fk(30, 60), lr=Fk(-10, 50), fl=60, fr=50), 2, 'a', 'snap')
        a.k(P(G, py=-84, lean=-16, sa=-60, ar=I(26, -152), ll=Fk(30, 60), lr=Fk(-10, 50), fl=60, fr=50), 1, 'a', 'out', hold=4)
        a.k(P(FALL, sa=0, ar=I(30, -110)), 10, 'r', 'io').k(P(FALL, sa=0), 14, 'r')
        # 反射（↓↘→K）：盾を前へ突き出して光らせ、飛び道具を跳ね返す（近くの相手にも当たる）
        a = add(A('sp_reflect', hit=SH))
        a.k(G, 1, 's').k(P(G, px=-2, lean=8, sa=0, ar=I(24, -98)), 3, 's', 'in')
        a.k(P(G, px=10, lean=24, sa=6, ar=I(60, -100), ll=I(40, -5)), 2, 's', 'snap')
        a.k(P(G, px=11, lean=25, sa=8, ar=I(62, -100), ll=I(40, -5)), 1, 'a', hold=5)
        a.k(P(G, px=6, lean=16, sa=4, ar=I(44, -98)), 10, 'r', 'out').k(G, 6, 'r', 'io')

        # ============================================================ 超必殺
        # Lv1 フォートレスブレイク（↓↘→↓↘→P）：無敵で踏み込み、盾で何度も打ちすえる
        a = add(A('su_1', hit=SH))
        a.k(G, 1, 's').k(P(G, px=-4, py=-64, lean=18, sa=0, ar=I(30, -96)), 4, 's', 'in')
        for i in range(5):
            o = i % 2 == 0
            a.k(P(G, px=12 if o else 4, py=-62, lean=30 if o else 14, sa=30 if o else -10, ar=I(66 if o else 36, -96 if o else -110), ll=I(44, -5)), 4, 'a', 'snap' if o else 'io')
        a.k(P(G, px=18, py=-58, lean=38, sa=60, ar=I(72, -80), ll=I(52, -5), lr=I(-12, -5)), 3, 'a', 'snap', hold=6)
        a.k(P(G, px=12, lean=26, sa=30), 12, 'r', 'out').k(G, 10, 'r', 'io')
        # Lv2 シールドラッシュ（↓↙←↓↙←P）：盾で押し込みながら連続で体当たり
        a = add(A('su_2', hit=SH))
        a.k(G, 1, 's').k(P(G, px=-4, py=-64, lean=20, sa=10, ar=I(30, -96)), 5, 's', 'in')
        for i in range(9):
            s_ = math.sin(i / 3 * math.tau)
            a.k(P(G, px=10, py=-62, lean=32, tw=0.25, sa=14 + 6 * s_, ar=I(56 + 6 * s_, -96), ll=I(28 + 18 * s_, -6), lr=I(-20 - 18 * s_, -6)), 3, 'a', 'lin')
        a.k(P(G, px=18, py=-76, lean=-6, sa=-40, ar=I(48, -136)), 4, 'a', 'snap', hold=6)
        a.k(P(G, sa=0), 12, 'r', 'out').k(G, 8, 'r', 'io')
        # Lv3 城門崩し（↓↘→↓↘→K）：盾を掲げて飛び上がり、全体重で押しつぶす
        a = add(A('su_3', hit=SH))
        a.k(G, 1, 's').k(P(C, lean=30, sa=40), 4, 's', 'in')
        a.k(P(FALL, py=-86, lean=-12, sa=-40, ar=I(20, -150)), 6, 's', 'snap')
        a.k(P(FALL, lean=36, sa=80, ar=I(52, -60)), 4, 'a', 'snap', lag=0.2)
        a.k(P(FALL, lean=40, sa=86, ar=I(54, -50)), 20, 'a')
        a.k(P(G, px=14, py=-50, lean=42, sa=90, ar=I(60, -30), ll=I(52, -5), lr=I(-12, -5)), 2, 'a', 'snap', hold=10)
        a.k(P(G, px=12, lean=30, sa=40), 12, 'r', 'out').k(G, 10, 'r', 'io')
    return out
