"""
全モーションのキーポーズ定義
  各アニメの段階: s=予備動作, a=攻撃発生〜持続, r=戻り, -=攻撃以外
  key(pose, n=描く枚数, frames=その区間のゲームフレーム数, ph=段階, e=補間)
"""
import math
from anim import Anim


def P(base, **kw):
    d = dict(base); d.update(kw); return d


def defs(kind):
    K = kind == 'kokuu'
    A = []
    # ------------------------------------------------------------ 基本姿勢
    if K:
        G = dict(px=0, py=-76, lean=4, tw=0.55, hd=-4, al=('ik', 20, -74), ar=('ik', -16, -72),
                 ll=('ik', 18, -6), lr=('ik', -20, -6), fl=95, fr=82, hl='fist', hr='fist')
    else:
        G = dict(px=0, py=-77, lean=3, tw=0.75, hd=-2, al=('ik', 28, -76), ar=('ik', -26, -74),
                 ll=('ik', 22, -6), lr=('ik', -24, -6), fl=95, fr=84, hl='claw', hr='claw')
    slow = 1.0 if K else 1.25   # 2Pは動作全体が重い
    def F(n):
        return max(1, int(round(n * slow)))

    # 待機（呼吸）
    a = Anim('idle', loop=True)
    for i in range(10 if K else 12):
        ph = i / (10 if K else 12) * math.tau
        a.key(P(G, py=G['py'] + 1.3 * math.sin(ph), lean=G['lean'] + 1.2 * math.sin(ph),
                al=('ik', G['al'][1] + 1.2 * math.cos(ph), G['al'][2] + 1.6 * math.sin(ph)),
                ar=('ik', G['ar'][1] - 1.0 * math.cos(ph), G['ar'][2] + 1.4 * math.sin(ph + 0.6)),
                cape=3 * math.sin(ph)), 1, 6)
    A.append(a)

    # 前進・後退（歩行サイクル）
    def walk(name, direction, n, spd):
        a = Anim(name, loop=True, vx=spd * direction)
        s = 9 if K else 8
        for i in range(n):
            ph = i / n
            def foot(c, psi):
                psi %= 1.0
                if direction < 0:
                    psi = 1 - psi
                if psi < 0.5:
                    x = c + s - (2 * s) * (psi / 0.5); y = -6
                else:
                    q = (psi - 0.5) / 0.5
                    x = c - s + 2 * s * q; y = -6 - 9 * math.sin(math.pi * q)
                return x, y
            lx, ly = foot(G['ll'][1], ph)
            rx, ry = foot(G['lr'][1], ph + 0.5)
            bob = abs(math.cos(ph * math.tau)) * 2.2
            a.key(P(G, py=G['py'] + bob - 1, lean=G['lean'] + (3 if direction > 0 else -3),
                    ll=('ik', lx, ly), lr=('ik', rx, ry),
                    al=('ik', G['al'][1] + 2 * math.sin(ph * math.tau), G['al'][2] + 1.5 * math.cos(ph * math.tau)),
                    ar=('ik', G['ar'][1] - 2 * math.sin(ph * math.tau), G['ar'][2]),
                    fl=95 if ly > -7 else 80, fr=82 if ry > -7 else 70), 1, 4 if K else 5)
        A.append(a)
    walk('walk_f', 1, 12, 3.0 if K else 2.2)
    walk('walk_b', -1, 12, 2.4 if K else 1.8)

    # ダッシュ / バックステップ
    DSH = P(G, lean=30, py=-66, px=6, al=('ik', 40, -100), ar=('ik', -24, -86),
            ll=('ik', 36, -10), lr=('ik', -30, -14), fr=60, cape=-10)
    a = Anim('dash', vx=7)
    a.key(P(G, py=-68, lean=16), 2, 4).key(DSH, 2, 6, e='out').key(P(DSH, ll=('ik', 26, -6), lr=('ik', -10, -18), py=-70), 2, 6)
    a.key(P(G, py=-70), 2, F(5))
    A.append(a)
    a = Anim('dash_b', vx=-6)
    BD = P(G, lean=-14, py=-82, px=-4, ll=('ik', 10, -18), lr=('ik', -30, -14), hd=8,
           al=('ik', 30, -122), ar=('ik', 20, -112), cape=18)
    a.key(P(G, py=-70, lean=12), 1, 3).key(BD, 3, 9, e='out').key(P(G, py=-70, lean=4), 2, F(8))
    A.append(a)

    # ジャンプ（上昇・下降・着地）
    JU = P(G, py=-84, lean=4, ll=('fk', 50, 95), lr=('fk', 10, 70), al=('ik', 30, -124), ar=('ik', 12, -116),
           fl=60, fr=50, fabs_l=True, cape=25, capeb=10)
    a = Anim('jump_up')
    a.key(P(G, py=-62, lean=16, ll=('ik', 20, -6), lr=('ik', -22, -6)), 2, 4)  # 踏み切り
    a.key(P(G, py=-86, lean=2, ll=('fk', 20, 20), lr=('fk', -15, 25), fl=40, fr=30), 2, 6, e='out')
    a.key(JU, 3, 30)
    A.append(a)
    JD = P(G, py=-84, lean=6, ll=('fk', 25, 35), lr=('fk', -10, 30), al=('ik', 34, -118), ar=('ik', 16, -108),
           fl=60, fr=55, cape=-10, capeb=-10)
    a = Anim('jump_down')
    a.key(JU, 1, 4).key(JD, 3, 30)
    A.append(a)
    a = Anim('land')
    a.key(P(G, py=-60, lean=18, ll=('ik', 22, -6), lr=('ik', -22, -6), cape=-15), 2, 2).key(P(G, py=-68), 2, 2)
    A.append(a)

    # しゃがみ
    if K:
        C = P(G, py=-46, lean=20, hd=-14, al=('ik', 36, -86), ar=('ik', 18, -76),
              ll=('ik', 26, -6), lr=('ik', -22, -6), fr=60)
    else:
        C = P(G, py=-48, lean=16, hd=-10, al=('ik', 34, -72), ar=('ik', 6, -68),
              ll=('ik', 28, -6), lr=('ik', -26, -6), fr=60)
    a = Anim('crouch_in'); a.key(G, 1, 1).key(C, 2, 3, e='out'); A.append(a)
    a = Anim('crouch', loop=True)
    for i in range(8):
        ph = i / 8 * math.tau
        a.key(P(C, py=C['py'] + math.sin(ph), lean=C['lean'] + math.sin(ph), cape=2 * math.sin(ph)), 1, 7)
    A.append(a)
    a = Anim('crouch_out'); a.key(C, 1, 1).key(P(G, py=-66), 2, 3); A.append(a)

    # ガード
    GS = P(G, lean=-6, hd=10, py=-74, px=-2, al=('ik', 30, -122, -1), ar=('ik', 26, -108),
           ll=('ik', 16, -6), lr=('ik', -26, -6), cape=10)
    a = Anim('guard'); a.key(P(G, lean=0), 1, 2).key(GS, 2, 4).key(P(GS, px=-4, lean=-8), 1, 30); A.append(a)
    GC = P(C, lean=6, hd=4, al=('ik', 30, -84), ar=('ik', 24, -74), px=-2, cape=10)
    a = Anim('cguard'); a.key(P(C, lean=12), 1, 2).key(GC, 2, 4).key(P(GC, px=-4), 1, 30); A.append(a)

    # ------------------------------------------------------------ 通常技
    def atk(name, wind, hit, s, act, rec, ns=2, na=2, nr=3, hitj=None, over=None, vx=0.0, fl=None):
        a = Anim(name, hit=hitj, vx=vx, flags=fl or {})
        a.key(G, 1, 1, 's')
        a.key(wind, ns, max(ns, s - 1), 's', 'io')
        a.key(hit, 1, 1, 'a', 'snap')
        a.key(over or hit, na, max(na, act - 1), 'a', 'lin')
        a.key(P(G, py=G['py'] + 1), nr, rec, 'r', 'io')
        A.append(a)
        return a

    if K:
        # 弱P：前の手のジャブ
        atk('lp', P(G, al=('ik', 30, -112), lean=10), P(G, lean=14, px=4, tw=0.45, al=('ik', 72, -120), ll=('ik', 26, -6)),
            4, 2, 7, 2, 2, 3, hitj=('hand_l', 7, 'el_l'), over=P(G, lean=14, px=4, tw=0.45, al=('ik', 74, -121), ll=('ik', 26, -6)))
        # 中P：後ろ手のストレート
        atk('mp', P(G, lean=4, tw=0.7, ar=('ik', 4, -110), al=('ik', 34, -112)),
            P(G, lean=20, px=8, tw=0.25, ar=('ik', 80, -120), al=('ik', 20, -108), ll=('ik', 30, -6), lr=('ik', -18, -6), fr=60),
            6, 3, 12, 3, 2, 4, hitj=('hand_r', 8, 'el_r'),
            over=P(G, lean=21, px=9, tw=0.25, ar=('ik', 82, -119), al=('ik', 18, -106), ll=('ik', 30, -6), lr=('ik', -18, -6), fr=60))
        # 強P：踏み込み正拳突き
        atk('hp', P(G, lean=0, px=-4, tw=0.8, ar=('ik', -10, -104), al=('ik', 40, -116), ll=('ik', 18, -6)),
            P(G, lean=26, px=14, py=-68, tw=0.15, ar=('ik', 92, -118), al=('ik', 8, -102), ll=('ik', 42, -6), lr=('ik', -14, -6), fr=55, cape=-15),
            9, 4, 19, 4, 2, 6, hitj=('hand_r', 10, 'el_r'),
            over=P(G, lean=27, px=15, py=-67, tw=0.15, ar=('ik', 94, -116), al=('ik', 6, -100), ll=('ik', 42, -6), lr=('ik', -14, -6), fr=55, cape=-18))
        # 弱K：前蹴り（すね）
        atk('lk', P(G, lean=2, ll=('fk', 60, 90), fl=40), P(G, lean=-4, ll=('fk', 70, 12), fl=95, px=-2),
            5, 2, 9, 2, 2, 3, hitj=('toe_l', 8, 'an_l'))
        # 中K：中段回し蹴り（後ろ足）
        atk('mk', P(G, lean=-2, tw=0.75, lr=('fk', 60, 100), fr=20, fabs_r=True, px=-2),
            P(G, lean=-14, px=-4, tw=0.3, lr=('fk', 92, 8), fr=95, al=('ik', 26, -118), ar=('ik', -6, -106), ll=('ik', 16, -6), fl=100),
            8, 3, 15, 3, 2, 5, hitj=('toe_r', 9, 'kn_r'))
        # 強K：上段回し蹴り
        atk('hk', P(G, lean=-6, tw=0.8, lr=('fk', 80, 120), fr=10, px=-4, hd=4),
            P(G, lean=-26, px=-8, py=-78, tw=0.2, hd=18, lr=('fk', 118, 4), fr=120, al=('ik', 24, -116), ar=('ik', -24, -110), ll=('ik', 12, -6), fl=110, cape=20),
            11, 4, 21, 4, 3, 6, hitj=('toe_r', 10, 'kn_r'),
            over=P(G, lean=-28, px=-9, py=-78, tw=0.2, hd=20, lr=('fk', 122, 6), fr=125, al=('ik', 22, -114), ar=('ik', -26, -108), ll=('ik', 12, -6), fl=110, cape=24))
    else:
        # 弱P：爪の突き
        atk('lp', P(G, al=('ik', 26, -104), lean=6), P(G, lean=12, px=4, tw=0.55, al=('ik', 70, -112), ll=('ik', 30, -6), hl='open'),
            5, 2, 9, 2, 2, 3, hitj=('hand_l', 8, 'el_l'))
        # 中P：振り下ろしの手刀
        atk('mp', P(G, lean=-6, tw=0.8, ar=('fk', 175, 30), hd=6),
            P(G, lean=22, px=8, tw=0.3, ar=('fk', 80, 10), ll=('ik', 32, -6), hr='open'),
            8, 3, 15, 3, 2, 4, hitj=('hand_r', 10, 'el_r'))
        # 強P：両拳のハンマー（振りかぶり大）
        atk('hp', P(G, lean=-16, py=-80, tw=0.6, hd=10, al=('fk', 170, 20), ar=('fk', 185, 25), cape=12),
            P(G, lean=34, px=16, py=-64, tw=0.4, hd=-14, al=('fk', 55, 15), ar=('fk', 60, 10), ll=('ik', 46, -6), lr=('ik', -12, -6), fr=55, cape=-20),
            12, 4, 24, 4, 2, 6, hitj=(('hand_r', 11, 'el_r'), ('hand_l', 10)))
        atk('lk', P(G, lean=2, ll=('fk', 50, 80), fl=40), P(G, lean=-2, ll=('fk', 60, 6), fl=90),
            6, 2, 11, 2, 2, 3, hitj=('toe_l', 9, 'an_l'))
        # 中K：踏みつけ前蹴り
        atk('mk', P(G, lean=-6, ll=('fk', 85, 110), fl=60, px=-2),
            P(G, lean=-12, ll=('fk', 85, 6), fl=110, px=-2, al=('ik', 24, -106)),
            9, 3, 17, 3, 2, 5, hitj=('toe_l', 10, 'an_l'))
        # 強K：後ろ回し蹴り（重い）
        atk('hk', P(G, lean=10, tw=0.9, lr=('fk', 40, 110), fr=20, px=-6, hd=-4),
            P(G, lean=-24, px=-6, py=-78, tw=0.1, hd=16, lr=('fk', 108, 0), fr=110, ll=('ik', 10, -6), cape=22),
            14, 4, 26, 4, 3, 6, hitj=('toe_r', 11, 'kn_r'))

    # しゃがみ攻撃
    def catk(name, wind, hit, s, act, rec, ns=2, na=1, nr=3, hitj=None, fl=None):
        a = Anim(name, hit=hitj, flags=fl or {})
        a.key(C, 1, 1, 's').key(wind, ns, max(ns, s - 1), 's').key(hit, 1, 1, 'a', 'snap')
        a.key(hit, na, max(na, act - 1), 'a', 'lin').key(P(C, py=C['py'] + 1), nr, rec, 'r')
        A.append(a)
    catk('c_lp', P(C, al=('ik', 34, -84)), P(C, lean=24, px=4, al=('ik', 72, -92)), F(4), 2, F(7), 1, 1, 3, hitj=('hand_l', 7, 'el_l'))
    catk('c_mp', P(C, ar=('ik', 4, -80), tw=0.7), P(C, lean=26, px=6, tw=0.3, ar=('ik', 74, -94), al=('ik', 20, -80)),
         F(6), 2, F(11), 2, 2, 3, hitj=('hand_r', 8, 'el_r'))
    if K:
        catk('c_hp', P(C, ar=('ik', 10, -62), lean=24, py=-44), P(G, py=-78, lean=-4, tw=0.3, hd=10, ar=('fk', 138, 22), al=('ik', 20, -106), ll=('ik', 30, -6)),
             7, 5, 20, 3, 3, 5, hitj=('hand_r', 11, 'el_r'))
    else:
        catk('c_hp', P(C, ar=('ik', -10, -60), lean=20), P(G, py=-78, lean=-2, tw=0.4, hd=10, ar=('fk', 135, 25), hr='claw', ll=('ik', 32, -6)),
             9, 5, 24, 3, 3, 5, hitj=('hand_r', 12, 'el_r'))
    catk('c_lk', P(C, ll=('fk', 40, 60), fl=60), P(C, lean=24, ll=('fk', 80, 2), fl=95, py=-42),
         F(5), 2, F(8), 2, 1, 3, hitj=('toe_l', 8, 'an_l'), fl={'low': True})
    catk('c_mk', P(C, ll=('fk', 50, 70), fl=60, lean=26), P(C, lean=30, py=-38, ll=('fk', 84, 0), fl=95, px=-4, lr=('ik', -24, -6)),
         F(7), 3, F(14), 2, 2, 4, hitj=('toe_l', 9, 'an_l'), fl={'low': True})
    catk('c_hk', P(C, lean=34, lr=('fk', -30, 80), px=-2, tw=0.8),
         P(C, lean=36, py=-36, px=-6, tw=0.2, lr=('fk', 96, -2), fr=95, ll=('ik', 18, -6), cape=-20),
         F(9), 3, F(22), 3, 2, 6, hitj=('toe_r', 9, 'an_r'), fl={'low': True, 'sweep': True})

    # ジャンプ攻撃
    def jatk(name, wind, hit, s, act, ns=2, na=2, hitj=None):
        a = Anim(name, hit=hitj, flags={'air': True, 'high': True})
        a.key(JD, 1, 1, 's').key(wind, ns, max(ns, s - 1), 's').key(hit, 1, 1, 'a', 'snap')
        a.key(hit, na, max(na, act - 1), 'a', 'lin').key(JD, 2, 12, 'r')
        A.append(a)
    jatk('j_p', P(JD, al=('ik', 30, -110)), P(JD, lean=26, al=('fk', 60, 5), ar=('ik', 4, -100)), 5, 8, hitj=('hand_l', 9, 'el_l'))
    jatk('j_hp', P(JD, lean=-10, ar=('fk', 170, 40), tw=0.8), P(JD, lean=30, tw=0.2, ar=('fk', 55, 5), al=('ik', 0, -100)), F(8), 6, 3, 2, hitj=('hand_r', 11, 'el_r'))
    jatk('j_k', P(JD, ll=('fk', 70, 110)), P(JD, lean=-10, ll=('fk', 70, 6), fl=80, lr=('fk', 0, 60)), 5, 9, hitj=('toe_l', 9, 'an_l'))
    jatk('j_hk', P(JD, lean=10, lr=('fk', 30, 120), tw=0.8), P(JD, lean=-20, tw=0.2, lr=('fk', 75, 2), fr=75, ll=('fk', 20, 80)), F(9), 6, 3, 2, hitj=('toe_r', 10, 'an_r'))

    # ------------------------------------------------------------ 投げ
    TR = P(G, lean=22, px=8, tw=0.4, al=('ik', 62, -112), ar=('ik', 56, -100), hl='open', hr='open', ll=('ik', 34, -6))
    a = Anim('throw', hit=('hand_l', 10, 'hand_r'))
    a.key(G, 1, 1, 's').key(P(G, lean=14, al=('ik', 40, -112), ar=('ik', 30, -100), hl='open', hr='open'), 2, 4, 's')
    a.key(TR, 1, 1, 'a', 'snap').key(TR, 2, 2, 'a').key(P(G, lean=12), 4, 20, 'r')
    A.append(a)
    # 投げ成功（つかむ→持ち上げ→叩きつけ）
    a = Anim('throw_do', flags={'throw': True})
    if K:
        a.key(TR, 1, 2).key(P(TR, lean=10, al=('ik', 50, -120), ar=('ik', 44, -110), hl='fist', hr='fist'), 2, 6)
        a.key(P(G, lean=-18, hd=14, tw=0.8, px=-6, al=('ik', 10, -150), ar=('ik', -6, -146), py=-80), 3, 10, e='out')
        a.key(P(G, lean=38, px=12, py=-58, tw=0.3, al=('ik', 80, -70), ar=('ik', 70, -64), ll=('ik', 44, -6), cape=-22), 2, 5, e='snap')
        a.key(P(G, lean=38, px=12, py=-58, tw=0.3, al=('ik', 82, -66), ar=('ik', 72, -60), ll=('ik', 44, -6), cape=-26), 1, 8)
        a.key(G, 4, 14)
    else:
        a.key(TR, 1, 2).key(P(TR, lean=6, al=('ik', 52, -124), ar=('ik', 46, -118), hl='claw', hr='claw'), 2, 6)
        a.key(P(G, lean=-10, py=-82, hd=10, al=('ik', 30, -168), ar=('ik', 22, -164), tw=0.6), 3, 14, e='out')
        a.key(P(G, lean=44, px=18, py=-54, al=('ik', 84, -50), ar=('ik', 76, -44), ll=('ik', 50, -6), cape=-25), 2, 5, e='snap')
        a.key(P(G, lean=44, px=18, py=-52, al=('ik', 86, -46), ar=('ik', 78, -40), ll=('ik', 50, -6), cape=-28), 1, 10)
        a.key(G, 4, 16)
    A.append(a)
    a = Anim('tech')
    a.key(TR, 1, 1).key(P(G, lean=-10, px=-6, al=('ik', 60, -116), ar=('ik', 54, -104), hl='open', hr='open', hd=10), 2, 4, e='snap')
    a.key(P(G, lean=-16, px=-10, py=-78, al=('ik', 40, -124), ar=('ik', 30, -110), ll=('ik', 10, -10), hd=12, cape=20), 3, 10).key(G, 3, 9)
    A.append(a)

    # ------------------------------------------------------------ やられ
    a = Anim('hit_hi')
    HH = P(G, lean=-20, hd=26, px=-6, py=-76, al=('ik', 14, -126), ar=('ik', -6, -110), ll=('ik', 16, -6), lr=('ik', -26, -6), cape=20)
    a.key(HH, 1, 2).key(P(HH, lean=-26, hd=32, px=-8), 2, 6).key(P(G, lean=0), 3, 10)
    A.append(a)
    a = Anim('hit_lo')
    HL = P(G, lean=34, hd=-24, px=-6, py=-66, al=('ik', 10, -84), ar=('ik', 4, -78), cape=20)
    a.key(HL, 1, 2).key(P(HL, lean=40, py=-64), 2, 6).key(P(G, lean=10), 3, 10)
    A.append(a)
    a = Anim('hit_c')
    HC = P(C, lean=0, hd=24, px=-6, py=-46, al=('ik', 12, -96), ar=('ik', -4, -86), cape=20)
    a.key(HC, 1, 2).key(P(HC, lean=-6, hd=28), 2, 6).key(C, 3, 10)
    A.append(a)
    # 吹き飛び（空中きりもみ）
    a = Anim('launch')
    L1 = P(G, lean=-40, hd=30, py=-80, al=('fk', 200, 30), ar=('fk', 170, 30), ll=('fk', 40, 60), lr=('fk', -10, 50), fl=40, fr=30, cape=40, capeb=20)
    a.key(HH, 1, 2).key(L1, 3, 8).key(P(L1, lean=-70, hd=40, ll=('fk', 70, 80), lr=('fk', 30, 70)), 3, 12)
    a.key(P(L1, lean=-90, hd=30, ll=('fk', 80, 40), lr=('fk', 60, 30)), 3, 40)
    A.append(a)
    # ダウン（倒れて地面に寝る）
    a = Anim('down')
    D0 = P(G, lean=-90, hd=-4, py=-12, px=-20, tw=0.5, al=('fk', 200, -20), ar=('fk', 160, -10),
           ll=('fk', 100, 30), lr=('fk', 85, 10), fl=170, fr=170, cape=-60, capeb=-10)
    a.key(P(L1, lean=-80, py=-40), 1, 3).key(P(D0, py=-20), 2, 6, e='in').key(P(D0, py=-10, lean=-92), 2, 6)
    a.key(D0, 2, 40)
    A.append(a)
    # 起き上がり
    a = Anim('getup')
    a.key(D0, 1, 2).key(P(D0, lean=-50, py=-20, al=('fk', -60, 20), ll=('fk', 140, 120), fl=100), 3, 9)
    a.key(P(C, lean=30, py=-40, al=('ik', -10, -10)), 3, 9).key(P(G, py=-68), 3, 8)
    A.append(a)
    # KO
    a = Anim('ko')
    a.key(HH, 1, 3).key(P(HH, lean=-36, hd=40, px=-10, ll=('ik', 20, -10), lr=('ik', -30, -6)), 3, 12)
    a.key(L1, 3, 14).key(P(D0, py=-18), 3, 10, e='in').key(P(D0, py=-10), 2, 6).key(D0, 2, 60)
    A.append(a)

    # ------------------------------------------------------------ 勝利演出・登場
    a = Anim('win')
    if K:
        W1 = P(G, lean=0, tw=0.7, hd=-2, al=('ik', 30, -150), ar=('ik', -6, -96), hl='open', ll=('ik', 14, -6), lr=('ik', -16, -6), py=-78)
        a.key(G, 1, 4).key(P(G, lean=-4, py=-78, al=('ik', 28, -96), ar=('ik', 20, -96)), 3, 12)
        a.key(W1, 4, 16, e='out')
        for i in range(8):
            ph = i / 8 * math.tau
            a.key(P(W1, al=('ik', 30 + 2 * math.sin(ph), -152 + 2 * math.cos(ph)), cape=8 * math.sin(ph), py=-78 + math.sin(ph) * 0.8), 1, 6)
    else:
        W1 = P(G, lean=-4, tw=0.9, hd=8, al=('ik', 46, -104), ar=('ik', -40, -104), hl='claw', hr='claw', py=-78, ll=('ik', 26, -6), lr=('ik', -28, -6))
        a.key(G, 1, 4).key(P(G, lean=-10, hd=14, al=('ik', 30, -140), ar=('ik', -20, -140)), 4, 16)
        a.key(W1, 4, 14, e='snap')
        for i in range(8):
            ph = i / 8 * math.tau
            a.key(P(W1, hd=8 + 3 * math.sin(ph), cape=10 * math.sin(ph), py=-78 + math.sin(ph)), 1, 6)
    A.append(a)
    a = Anim('intro')
    a.key(P(G, lean=-2, tw=0.9, al=('ik', 8, -86), ar=('ik', -10, -86), py=-78, ll=('ik', 12, -6), lr=('ik', -14, -6)), 1, 10)
    a.key(P(G, lean=-2, tw=0.9, al=('ik', 20, -112), ar=('ik', 10, -112), py=-78, hd=6, ll=('ik', 12, -6), lr=('ik', -14, -6)), 3, 18)
    a.key(G, 4, 16)
    A.append(a)

    # ------------------------------------------------------------ ラッシュ
    a = Anim('rush', loop=True, vx=8)
    for i in range(6):
        ph = i / 6 * math.tau
        a.key(P(G, lean=34, py=-62 + math.sin(ph), px=8, tw=0.4, al=('ik', 46, -98), ar=('ik', -26, -80),
                ll=('ik', 30 + 6 * math.sin(ph), -8 - 3 * max(0, math.sin(ph))), lr=('ik', -32 - 6 * math.sin(ph), -12),
                fr=60, cape=-30 + 5 * math.sin(ph), capeb=-10), 1, 3)
    A.append(a)

    # ------------------------------------------------------------ 必殺技
    if K:
        # 虚環弾（236P）：両掌に溜めて突き出す
        a = Anim('sp_fire', flags={'proj': 'hand_r'})
        a.key(G, 1, 1, 's')
        a.key(P(G, lean=-4, px=-6, tw=0.9, al=('ik', -16, -96), ar=('ik', -24, -90), hl='open', hr='open', ll=('ik', 24, -6), cape=10), 3, 7, 's')
        a.key(P(G, lean=-6, px=-8, tw=0.95, al=('ik', -20, -98), ar=('ik', -26, -92), hl='open', hr='open', ll=('ik', 26, -6), cape=12), 1, 3, 's')
        FB = P(G, lean=24, px=10, py=-68, tw=0.3, al=('ik', 76, -112), ar=('ik', 72, -104), hl='open', hr='open', ll=('ik', 42, -6), lr=('ik', -16, -6), fr=60, cape=-20)
        a.key(FB, 1, 1, 'a', 'snap').key(P(FB, lean=26), 2, 4, 'a').key(P(G, py=-70), 6, 30, 'r')
        A.append(a)
        # EX虚環弾：頭上に輪を作り、両手で叩き込む
        a = Anim('ex_fire', flags={'proj': 'hand_r'})
        a.key(G, 1, 1, 's')
        a.key(P(G, lean=-12, py=-80, hd=12, tw=0.9, al=('ik', 30, -160), ar=('ik', 14, -160), hl='open', hr='open', cape=20), 3, 6, 's')
        a.key(P(G, lean=-4, px=-6, tw=0.95, al=('ik', -14, -110), ar=('ik', -20, -104), hl='open', hr='open', ll=('ik', 24, -6)), 2, 4, 's')
        FB2 = P(FB, lean=30, px=14, py=-66, al=('ik', 80, -116), ar=('ik', 80, -102), ll=('ik', 46, -6))
        a.key(FB2, 1, 1, 'a', 'snap').key(P(FB2, lean=32), 2, 4, 'a').key(P(G, py=-70), 7, 28, 'r')
        A.append(a)
        # 昇穿（623P）：沈み込みから跳び上がるアッパー
        a = Anim('sp_dp', hit=('hand_r', 15, 'el_r'))
        a.key(G, 1, 1, 's').key(P(C, lean=28, py=-50, ar=('ik', 6, -50), tw=0.8), 2, 2, 's')
        DP = P(G, py=-84, lean=-10, hd=14, tw=0.25, ar=('fk', 172, 6), al=('ik', 20, -100),
               ll=('fk', 70, 100), lr=('fk', -10, 20), fl=50, fr=10, fabs_r=True, cape=30, capeb=10)
        DPa = P(DP, lean=10, px=6, py=-74, ar=('fk', 112, 34), hd=4)
        a.key(DPa, 1, 2, 'a', 'snap').key(P(DP, lean=-10), 1, 2, 'a', 'snap').key(P(DP, lean=-16, hd=18), 2, 9, 'a')
        a.key(P(JD, lean=0, ar=('ik', 20, -130), al=('ik', 20, -110)), 4, 30, 'r').key(P(G, py=-62, lean=16), 2, 10, 'r')
        A.append(a)
        a = Anim('ex_dp', hit=('hand_r', 16, 'el_r'))
        a.key(G, 1, 1, 's').key(P(C, lean=30, py=-48, ar=('ik', 4, -48), al=('ik', 4, -60), tw=0.8), 2, 2, 's')
        DP2 = P(DP, al=('fk', 160, 10), tw=0.5)
        a.key(P(DP2, lean=4, py=-78, ar=('fk', 128, 30), al=('fk', 120, 30), hd=6), 1, 2, 'a', 'snap').key(DP2, 1, 2, 'a', 'snap').key(P(DP2, lean=-18, hd=20), 3, 13, 'a')
        a.key(P(JD, lean=0, ar=('ik', 20, -130), al=('ik', 20, -120)), 4, 32, 'r').key(P(G, py=-62, lean=16), 2, 10, 'r')
        A.append(a)
        # 迅閃脚（214K）：低い突進から飛び蹴り
        a = Anim('sp_rush', hit=('toe_l', 11, 'kn_l'), vx=6)
        a.key(G, 1, 1, 's').key(P(G, lean=26, py=-64, px=-6, tw=0.8, ll=('fk', 30, 100), lr=('ik', -26, -6), fl=40), 3, 9, 's')
        RK = P(G, lean=-16, py=-82, px=6, tw=0.2, hd=6, ll=('fk', 88, 2), fl=95, lr=('fk', -30, 90), fr=-40,
               al=('ik', 20, -126), ar=('ik', -24, -114), cape=40, capeb=20)
        a.key(RK, 1, 1, 'a', 'snap').key(P(RK, lean=-18), 3, 12, 'a').key(P(G, py=-64, lean=18), 4, 18, 'r').key(G, 1, 4, 'r')
        A.append(a)
        a = Anim('ex_rush', hit=('toe_l', 13, 'kn_l'), vx=8)
        a.key(G, 1, 1, 's').key(P(G, lean=30, py=-60, px=-6, tw=0.8, ll=('fk', 30, 100), fl=40), 3, 7, 's')
        a.key(P(RK, lean=-20), 1, 1, 'a', 'snap').key(P(RK, lean=-24, lr=('fk', 60, 110)), 3, 10, 'a')
        a.key(P(G, lean=-10, py=-84, lr=('fk', 100, 4), ll=('fk', -10, 60), al=('ik', 30, -130)), 2, 8, 'a')
        a.key(P(G, py=-64, lean=18), 4, 18, 'r').key(G, 1, 4, 'r')
        a.hit = ('toe_l', 13, 'kn_l')
        A.append(a)
        # 超必殺技1：虚空砲（236236P）
        a = Anim('su_1', flags={'beam': 'hand_r'})
        a.key(G, 1, 1, 's')
        a.key(P(G, lean=-6, py=-80, hd=10, tw=1.0, al=('ik', 40, -150), ar=('ik', -30, -150), hl='open', hr='open', ll=('ik', 26, -6), lr=('ik', -30, -6), cape=18), 4, 16, 's')
        a.key(P(G, lean=-8, px=-10, tw=0.95, al=('ik', -24, -100), ar=('ik', -30, -94), hl='open', hr='open', ll=('ik', 28, -6), cape=14), 3, 12, 's')
        SB = P(FB, lean=28, px=14, py=-64, al=('ik', 82, -112), ar=('ik', 80, -100), ll=('ik', 48, -6), cape=-30, capeb=-10)
        a.key(SB, 1, 1, 'a', 'snap')
        for i in range(6):
            a.key(P(SB, px=14 - i * 0.6, lean=28 - (i % 2), cape=-30 + 4 * math.sin(i)), 1, 8, 'a')
        a.key(P(G, py=-70), 6, 36, 'r')
        A.append(a)
        # 超必殺技2：零界継承（236236K）乱舞
        a = Anim('su_2', hit=(('hand_r', 15, 'el_r'), ('toe_r', 14, 'kn_r'), ('hand_l', 13)), vx=9)
        a.key(G, 1, 1, 's').key(P(G, lean=-10, py=-80, tw=0.9, al=('ik', 34, -130), ar=('ik', -20, -124), cape=20), 3, 14, 's')
        a.key(DSH, 3, 8, 's')
        a.key(P(G, lean=22, px=10, tw=0.2, ar=('ik', 86, -118), ll=('ik', 34, -6)), 1, 1, 'a', 'snap')
        seq = [
            P(G, lean=18, px=8, tw=0.6, al=('ik', 80, -120), ar=('ik', 10, -104), ll=('ik', 34, -6)),
            P(G, lean=24, px=12, tw=0.15, ar=('ik', 90, -112), al=('ik', 10, -104), ll=('ik', 38, -6)),
            P(G, lean=-16, px=-4, tw=0.3, lr=('fk', 100, 6), fr=100, ll=('ik', 14, -6), al=('ik', 24, -118)),
            P(G, lean=-22, px=-6, py=-78, tw=0.2, lr=('fk', 122, 4), fr=120, ll=('ik', 12, -6), al=('ik', 20, -116)),
            P(G, lean=26, px=14, tw=0.25, ar=('ik', 92, -100), al=('ik', 6, -104), ll=('ik', 40, -6)),
            P(C, lean=28, py=-50, ar=('ik', 6, -50), tw=0.8),
            P(DP, ar=('fk', 175, 4), lean=-12),
        ]
        for s_ in seq:
            a.key(s_, 2, 6, 'a', 'snap')
        a.key(P(DP, lean=-16, hd=20), 2, 14, 'a').key(P(JD, lean=0), 3, 20, 'r').key(P(G, py=-62, lean=16), 2, 10, 'r')
        A.append(a)
    else:
        # 冥核弾（236P）：頭上で黒球を作り、叩きつけて放つ
        a = Anim('sp_fire', flags={'proj': 'hand_r'})
        a.key(G, 1, 1, 's')
        a.key(P(G, lean=-14, py=-80, hd=10, tw=0.8, ar=('ik', 10, -170), al=('ik', 30, -124), hr='claw', cape=14), 4, 10, 's')
        FB = P(G, lean=28, px=12, py=-66, tw=0.3, ar=('ik', 76, -104), al=('ik', 24, -100), hr='open', ll=('ik', 44, -6), lr=('ik', -16, -6), fr=60, cape=-20)
        a.key(FB, 1, 1, 'a', 'snap').key(P(FB, lean=30), 2, 4, 'a').key(P(G, py=-72), 6, 34, 'r')
        A.append(a)
        a = Anim('ex_fire', flags={'proj': 'hand_r'})
        a.key(G, 1, 1, 's')
        a.key(P(G, lean=-18, py=-82, hd=14, tw=1.0, ar=('ik', 20, -172), al=('ik', 36, -168), hr='claw', hl='claw', cape=20), 4, 9, 's')
        FB2 = P(FB, al=('ik', 74, -96), hl='open', lean=32, px=14)
        a.key(FB2, 1, 1, 'a', 'snap').key(P(FB2, lean=34), 2, 4, 'a').key(P(G, py=-72), 7, 32, 'r')
        A.append(a)
        # 断天（623P）：跳び上がりながら爪で斬り上げる対空
        a = Anim('sp_dp', hit=('hand_r', 14, 'el_r'))
        a.key(G, 1, 1, 's').key(P(C, lean=22, py=-50, ar=('ik', -14, -40), tw=0.9, hr='claw'), 2, 3, 's')
        DP = P(G, py=-82, lean=-14, hd=16, tw=0.4, ar=('fk', 160, 10), al=('ik', 30, -110), hr='claw',
               ll=('fk', 60, 90), lr=('fk', -10, 30), fl=50, fr=10, cape=34, capeb=10)
        a.key(P(DP, lean=6, py=-78, ar=('fk', 122, 30), hd=4), 1, 2, 'a', 'snap').key(DP, 1, 2, 'a', 'snap').key(P(DP, lean=-20, ar=('fk', 200, 10), hd=22), 2, 8, 'a')
        a.key(P(JD, lean=4), 4, 30, 'r').key(P(G, py=-60, lean=20), 2, 12, 'r')
        A.append(a)
        a = Anim('ex_dp', hit=('hand_r', 16, 'el_r'))
        a.key(G, 1, 1, 's').key(P(C, lean=24, py=-48, ar=('ik', -14, -40), al=('ik', -4, -50), tw=0.9), 2, 3, 's')
        DP2 = P(DP, al=('fk', 150, 10), hl='claw')
        a.key(P(DP2, lean=6, py=-78, ar=('fk', 122, 30), al=('fk', 115, 30), hd=4), 1, 2, 'a', 'snap').key(DP2, 1, 2, 'a', 'snap').key(P(DP2, lean=-24, ar=('fk', 205, 10), al=('fk', 195, 10), hd=24), 3, 11, 'a')
        a.key(P(JD, lean=4), 4, 32, 'r').key(P(G, py=-60, lean=20), 2, 12, 'r')
        A.append(a)
        # 崩落突進（214K）：肩からのぶちかまし
        a = Anim('sp_rush', hit=(('sh_l', 14), ('hand_l', 10)), vx=7)
        a.key(G, 1, 1, 's').key(P(G, lean=-6, px=-8, tw=0.9, al=('ik', 0, -96), ar=('ik', -30, -96), cape=10), 3, 12, 's')
        TK = P(G, lean=36, px=10, py=-64, tw=0.15, al=('ik', 30, -90), ar=('ik', -10, -96), ll=('ik', 42, -8), lr=('ik', -34, -16), fr=50, cape=-34, capeb=-12)
        a.key(TK, 1, 1, 'a', 'snap')
        for i in range(4):
            a.key(P(TK, ll=('ik', 36 + 8 * (i % 2), -8 - 5 * (i % 2)), lr=('ik', -30 - 8 * (i % 2), -14)), 1, 4, 'a')
        a.key(P(G, py=-70, lean=14), 5, 22, 'r')
        A.append(a)
        a = Anim('ex_rush', hit=(('sh_l', 16), ('hand_l', 12)), vx=9)
        a.key(G, 1, 1, 's').key(P(G, lean=-8, px=-8, tw=1.0, al=('ik', 0, -96), ar=('ik', -32, -96), cape=12), 3, 9, 's')
        a.key(TK, 1, 1, 'a', 'snap')
        for i in range(5):
            a.key(P(TK, ll=('ik', 36 + 8 * (i % 2), -8 - 5 * (i % 2)), lr=('ik', -30 - 8 * (i % 2), -14)), 1, 4, 'a')
        a.key(P(G, py=-70, lean=14), 5, 22, 'r')
        A.append(a)
        # 終縛（63214P）：コマンド投げ
        CG = P(G, lean=28, px=14, tw=0.4, al=('ik', 74, -112), ar=('ik', 66, -96), hl='claw', hr='claw', ll=('ik', 44, -6))
        a = Anim('sp_grab', hit=('hand_l', 14, 'hand_r'))
        a.key(G, 1, 1, 's').key(P(G, lean=-8, px=-6, tw=0.9, al=('ik', 10, -130), ar=('ik', -16, -120)), 2, 4, 's')
        a.key(CG, 1, 1, 'a', 'snap').key(CG, 2, 3, 'a').key(P(G, lean=14), 5, 28, 'r')
        A.append(a)
        a = Anim('sp_grab_do', flags={'throw': True})
        a.key(CG, 1, 2).key(P(CG, lean=10, al=('ik', 56, -134), ar=('ik', 50, -126)), 2, 6)
        a.key(P(G, lean=-30, py=-84, hd=20, tw=0.7, al=('ik', 0, -178), ar=('ik', -10, -172)), 4, 18, e='out')
        a.key(P(G, lean=48, px=20, py=-48, al=('ik', 86, -36), ar=('ik', 78, -30), ll=('ik', 54, -6), cape=-30), 2, 4, e='snap')
        a.key(P(G, lean=50, px=20, py=-46, al=('ik', 88, -30), ar=('ik', 80, -26), ll=('ik', 54, -6), cape=-34), 1, 14)
        a.key(P(G, lean=-6, hd=8, py=-78), 4, 18)
        A.append(a)
        # 超必殺技1：終焉の柱（236236P）
        a = Anim('su_1', flags={'pillar': True})
        a.key(G, 1, 1, 's')
        a.key(P(G, lean=-16, py=-82, hd=18, tw=1.0, al=('ik', 40, -170), ar=('ik', -20, -170), hl='claw', hr='claw', cape=20), 4, 18, 's')
        SL = P(C, lean=40, py=-40, px=8, al=('ik', 60, -6), ar=('ik', 40, -6), hl='open', hr='open', cape=-20)
        a.key(SL, 2, 4, 'a', 'snap')
        for i in range(5):
            a.key(P(SL, py=-40 + (i % 2), lean=40 - (i % 2), cape=-20 + 6 * math.sin(i)), 1, 8, 'a')
        a.key(P(G, py=-72), 6, 34, 'r')
        A.append(a)
        # 超必殺技2：万象終焉（236236K）投げ超必殺
        a = Anim('su_2', hit=('hand_l', 16, 'hand_r'), vx=6)
        a.key(G, 1, 1, 's').key(P(G, lean=-12, py=-82, tw=1.0, al=('ik', 40, -140), ar=('ik', -30, -140), cape=20), 3, 12, 's')
        a.key(CG, 2, 6, 'a', 'snap').key(CG, 2, 6, 'a').key(P(G, lean=12), 4, 30, 'r')
        A.append(a)
        a = Anim('su_2_do', flags={'throw': True})
        a.key(CG, 1, 2).key(P(CG, lean=4, al=('ik', 56, -140), ar=('ik', 50, -132)), 2, 8)
        a.key(P(G, lean=-34, py=-86, hd=24, al=('ik', 0, -186), ar=('ik', -10, -180)), 4, 20, e='out')
        a.key(P(G, lean=50, px=20, py=-44, al=('ik', 88, -30), ar=('ik', 80, -24), ll=('ik', 56, -6), cape=-34), 2, 4, e='snap')
        a.key(P(G, lean=50, px=20, py=-44, al=('ik', 90, -26), ar=('ik', 82, -22), ll=('ik', 56, -6), cape=-36), 1, 20)
        a.key(P(G, lean=-10, hd=12, tw=0.9, al=('ik', 40, -110), ar=('ik', -30, -110), py=-78), 4, 24)
        A.append(a)
    return A
