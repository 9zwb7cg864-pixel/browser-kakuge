"""
全モーション定義（第2版：モーション重視の棒人間）
SF6などの現代格闘ゲームのアニメーションの作り方を参考にした原則：
  ・予備動作（溜め）は逆方向へ小さく → 打ち出しは2〜3Fで一気に（snap）→ 当たりの瞬間に止め（hold）→ 余韻（戻り）はゆっくり
  ・腰と足が先に動き、拳は遅れて届く（lag）
  ・踏み込み・後ろ足のかかとの浮き・体重移動で全身を使う
  ・やられは頭と胴が大きくのけぞり、手足が振り回される
  ・前後ジャンプは宙返り
コメントの s/a/r は 発生前 / 攻撃判定 / 戻り。フレーム数は技データ（data.js）の設計値に合わせている。
"""
import math
from anim2 import A


def P(base, **kw):
    d = dict(base); d.update(kw); return d


def I(x, y, b=None):
    return ('ik', x, y) if b is None else ('ik', x, y, b)


def Fk(a, b):
    return ('fk', a, b)


def defs(kind):
    K = kind == 'kokuu'
    out = []

    # ================================================================ 基本の構え
    if K:  # 正統派の構え：前の拳はあごの前、後ろの拳はあご横、後ろ足のかかとを浮かせる
        G = dict(px=0, py=-68, lean=10, tw=0.35, hd=-8, al=I(36, -114), ar=I(16, -106),
                 ll=I(24, -5), lr=I(-26, -5), fl=92, fr=70, hl='fist', hr='fist')
        C = P(G, py=-42, lean=22, hd=-18, al=I(34, -84), ar=I(16, -76), ll=I(28, -5), lr=I(-20, -5), fr=55)
    else:  # 重量級：上体を起こし、両腕を広げて爪を構える
        G = dict(px=0, py=-71, lean=5, tw=0.6, hd=-3, al=I(42, -98), ar=I(-4, -94),
                 ll=I(27, -5), lr=I(-29, -5), fl=95, fr=86, hl='claw', hr='claw')
        C = P(G, py=-46, lean=18, hd=-12, al=I(40, -74), ar=I(8, -70), ll=I(30, -5), lr=I(-26, -5), fr=60)
    sl = 1.0 if K else 1.25

    def F(n):
        return max(1, int(round(n * sl)))

    # ================================================================ 待機（リズムを取る上下動）
    a = A('idle', loop=True)
    n = 4
    for i in range(n + 1):
        ph = (i % n) / n * math.tau
        down = math.sin(ph)
        if K:
            a.k(P(G, py=G['py'] + 2.4 * down, lean=G['lean'] + 1.6 * down,
                  al=I(36 - 1.5 * down, -114 + 2.5 * down), ar=I(16 - down, -106 + 2.2 * down),
                  hd=-8 - 1.2 * down), 1 if i == 0 else 12, e='io')
        else:
            a.k(P(G, py=G['py'] + 1.6 * down, lean=G['lean'] + 1.2 * down, tw=0.6 + 0.05 * down,
                  al=I(42 + 2 * math.cos(ph), -98 + 3 * down), ar=I(-4 - 2 * math.cos(ph), -94 + 3 * down),
                  hd=-3 + 2 * math.cos(ph)), 1 if i == 0 else 15, e='io')
    out.append(a)

    # ================================================================ 歩き（足が地面を滑らない：接地中の足は体の速度で後ろへ）
    def walk(name, dirn, spd, T):
        a = A(name, loop=True, vx=spd * dirn)
        nfr = T // 2
        swing = 0.38
        for i in range(nfr + 1):
            ph = (i % nfr) / nfr
            def foot(c, off):
                q = (ph + off) % 1.0
                if dirn < 0:
                    q = (1 - q) % 1.0
                travel = spd * T * (1 - swing)
                if q < swing:  # 振り出し（浮いて前へ）
                    k = q / swing
                    s = k * k * (3 - 2 * k)
                    return c - travel / 2 + travel * s, -5 - 7 * math.sin(math.pi * k), True
                k = (q - swing) / (1 - swing)
                return c + travel / 2 - travel * k, -5, False
            lead_first = 0.0 if dirn > 0 else 0.5
            lx, ly, lsw = foot(G['ll'][1], lead_first)
            rx, ry, rsw = foot(G['lr'][1], lead_first + 0.5)
            bob = math.cos(ph * math.tau * 2)
            sw = math.sin(ph * math.tau)
            a.k(P(G, py=G['py'] - 1.8 * bob - (1.2 if not K else 0), lean=G['lean'] + (2 if dirn > 0 else -2) - bob * 0.8,
                  tw=G['tw'] + 0.04 * sw, ll=I(lx, ly), lr=I(rx, ry),
                  al=I(G['al'][1] + 2 * sw, G['al'][2] - bob), ar=I(G['ar'][1] - 1.5 * sw, G['ar'][2] - bob),
                  fl=70 if lsw else 92, fr=60 if rsw else G['fr']), 1 if i == 0 else 2, e='lin')
        out.append(a)
    walk('walk_f', 1, 1.9 if K else 1.4, 24 if K else 30)
    walk('walk_b', -1, 1.5 if K else 1.1, 26 if K else 32)

    # ================================================================ ダッシュ（沈み込み→低く飛び込む→着地）
    a = A('dash', vx=6)
    a.k(G, 1)
    a.k(P(G, py=G['py'] + 7, lean=G['lean'] + 10, fr=50), 3, e='in')
    a.k(P(G, py=G['py'] + 2, px=6, lean=G['lean'] + 22, ll=I(44, -16), lr=Fk(-50, 70), fr=20, fl=70,
          al=I(46, -104), ar=I(-14, -98)), 4, e='snap', lag=0.3)
    a.k(P(G, py=G['py'] + 4, px=6, lean=G['lean'] + 18, ll=I(38, -5), lr=I(-30, -16), fr=40,
          al=I(44, -106), ar=I(4, -100)), 6, e='io')
    a.k(P(G, py=G['py'] + 3, lean=G['lean'] + 6), 4, e='out').k(G, F(4), e='io')
    out.append(a)
    a = A('dash_b', vx=-6)
    a.k(G, 1)
    a.k(P(G, py=G['py'] + 5, lean=G['lean'] + 6), 3, e='in')
    a.k(P(G, px=-6, py=G['py'] - 10, lean=-10, hd=8, ll=Fk(30, 80), lr=Fk(-30, 60), fl=70, fr=60,
          al=I(30, -124), ar=I(14, -116)), 6, e='snap', lag=0.25)
    a.k(P(G, px=-4, py=G['py'] - 6, lean=-4, ll=I(18, -12), lr=I(-30, -5)), 7, e='io')
    a.k(P(G, py=G['py'] + 5, lean=G['lean'] + 6), 4, e='out').k(G, F(5), e='io')
    out.append(a)

    # ================================================================ ジャンプ
    SQ = P(G, py=G['py'] + 12, lean=G['lean'] + 12, hd=G['hd'] - 4, fr=40)
    RISE = P(G, py=-80, lean=2, hd=-2, ll=Fk(10, 10), lr=Fk(-12, 14), fl=40, fr=30,
             al=I(30, -128), ar=I(10, -120))
    TUCK = P(G, py=-84, lean=10, hd=-8, ll=Fk(70, 120), lr=Fk(40, 110), fl=60, fr=50,
             al=I(30, -112), ar=I(16, -104))
    FALL = P(G, py=-82, lean=6, hd=-4, ll=Fk(30, 50), lr=Fk(-6, 40), fl=70, fr=60, al=I(34, -116), ar=I(14, -108))
    a = A('jump_up', wy=-6)
    a.k(G, 1).k(SQ, 3, e='in')
    a.k(RISE, 4, e='snap').k(TUCK, 12, e='out').k(P(TUCK, lean=12), 8)
    out.append(a)
    a = A('jump_down', wy=6)
    a.k(P(TUCK, lean=12), 1).k(FALL, 10, e='io').k(P(FALL, ll=Fk(20, 30), lr=Fk(-10, 26)), 20, e='io')
    out.append(a)
    for nm, sgn in (('jump_f', 1), ('jump_b', -1)):
        a = A(nm, wy=lambda i, n: -6 + 12 * i / max(1, n - 1), vx=3.4 * sgn)
        BALL = P(TUCK, ll=Fk(95, 140), lr=Fk(80, 135), lean=30, hd=-30, al=I(26, -86), ar=I(14, -84), rotc=8)
        a.k(P(G, py=G['py'] + 12, lean=G['lean'] + 12, fr=40), 1)
        a.k(P(RISE, rot=0), 4, e='snap')
        a.k(P(BALL, rot=90 * sgn), 6, e='in')
        a.k(P(BALL, rot=270 * sgn), 12, e='lin')
        a.k(P(TUCK, rot=360 * sgn, rotc=8), 6, e='out')
        a.k(P(FALL, rot=360 * sgn), 14, e='io')
        out.append(a)
    a = A('land')
    a.k(P(G, py=G['py'] + 12, lean=G['lean'] + 14, hd=G['hd'] - 6), 1).k(P(G, py=G['py'] + 3), 4, e='out')
    out.append(a)

    # ================================================================ しゃがみ
    a = A('crouch_in'); a.k(G, 1).k(P(C, py=C['py'] - 3), 2, e='snap').k(C, 2, e='io'); out.append(a)
    a = A('crouch', loop=True)
    for i in range(5):
        ph = (i % 4) / 4 * math.tau
        a.k(P(C, py=C['py'] + 1.4 * math.sin(ph), lean=C['lean'] + math.sin(ph)), 1 if i == 0 else 12)
    out.append(a)
    a = A('crouch_out'); a.k(C, 1).k(P(G, py=G['py'] + 6, lean=G['lean'] + 6), 3, e='out').k(G, 2); out.append(a)

    # ================================================================ ガード（構え→衝撃で押される→耐える）
    GS = P(G, lean=-2, hd=6, py=G['py'] + 1, px=-3, tw=0.25, al=I(30, -118, -1), ar=I(26, -104), ll=I(20, -5), lr=I(-28, -5), fr=80)
    GS2 = P(GS, px=-6, lean=-8, hd=12, py=G['py'] + 3)
    a = A('guard'); a.k(P(G, lean=4), 1).k(GS, 2, e='snap').k(GS2, 3, e='snap').k(GS, 10, e='io').k(P(GS, py=GS['py'] - 1), 20); out.append(a)
    GC = P(C, lean=8, hd=0, px=-3, al=I(30, -86), ar=I(26, -76))
    GC2 = P(GC, px=-6, lean=2, hd=6)
    a = A('cguard'); a.k(P(C, lean=14), 1).k(GC, 2, e='snap').k(GC2, 3, e='snap').k(GC, 10).k(P(GC, py=GC['py'] - 1), 20); out.append(a)

    # ================================================================ 立ち通常技
    hitP = lambda s, r=None: (s, r or (8 if K else 10), 'el_' + s[-1])
    if K:
        # 弱P ジャブ（発生4 持続2 硬直7）
        a = A('lp', hit=('hand_l', 7, 'el_l'))
        a.k(G, 1, 's')
        a.k(P(G, lean=12, tw=0.3, al=I(30, -112)), 1, 's')
        a.k(P(G, px=3, lean=15, tw=0.22, hd=-10, al=I(62, -118), ll=I(28, -5)), 2, 's', 'snap', lag=0.3)
        a.k(P(G, px=4, lean=16, tw=0.2, hd=-11, al=I(73, -119), ll=I(28, -5)), 1, 'a', 'out', hold=1)
        a.k(P(G, px=2, lean=13, al=I(48, -116), ll=I(26, -5)), 3, 'r', 'out')
        a.k(G, 4, 'r')
        out.append(a)
        # 中P 後ろ手のストレート（発生6 持続3 硬直12）
        a = A('mp', hit=('hand_r', 8, 'el_r'))
        a.k(G, 1, 's')
        a.k(P(G, px=-2, lean=8, tw=0.55, hd=-6, ar=I(4, -104)), 2, 's', 'in')
        a.k(P(G, px=6, lean=18, tw=0.15, hd=-14, ar=I(66, -116), al=I(22, -106), ll=I(32, -5), lr=I(-20, -5), fr=52), 3, 's', 'snap', lag=0.35)
        a.k(P(G, px=8, lean=20, tw=0.1, hd=-15, ar=I(81, -117), al=I(20, -104), ll=I(32, -5), lr=I(-20, -5), fr=50), 1, 'a', 'out', hold=2)
        a.k(P(G, px=5, lean=16, tw=0.25, ar=I(52, -112), al=I(26, -108), ll=I(30, -5), lr=I(-22, -5), fr=56), 4, 'r', 'out')
        a.k(G, 8, 'r')
        out.append(a)
        # 強P 踏み込み正拳（発生9 持続4 硬直19）
        a = A('hp', hit=('hand_r', 10, 'el_r'))
        a.k(G, 1, 's')
        a.k(P(G, px=-5, py=-66, lean=2, tw=0.72, hd=-4, ar=I(-16, -102), al=I(42, -118), ll=I(20, -5), fr=78), 4, 's', 'in')
        a.k(P(G, px=13, py=-63, lean=25, tw=0.12, hd=-20, ar=I(76, -116), al=I(12, -100), ll=I(46, -5), lr=I(-16, -5), fr=45), 4, 's', 'snap', lag=0.4)
        a.k(P(G, px=16, py=-62, lean=28, tw=0.05, hd=-22, ar=I(97, -114), al=I(6, -98), ll=I(48, -5), lr=I(-14, -5), fr=40), 1, 'a', 'back', hold=3)
        a.k(P(G, px=12, py=-64, lean=22, tw=0.2, hd=-16, ar=I(66, -110), al=I(14, -102), ll=I(46, -5), lr=I(-16, -5), fr=48), 6, 'r', 'out')
        a.k(P(G, px=4, py=-67, lean=14, ll=I(32, -5)), 8, 'r', 'io')
        a.k(G, 5, 'r')
        out.append(a)
        # 弱K すねへの前蹴り（発生5 持続2 硬直9）
        a = A('lk', hit=('toe_l', 8, 'an_l'))
        a.k(G, 1, 's')
        a.k(P(G, py=-70, lean=6, ll=Fk(70, 110), fl=30, al=I(32, -116)), 2, 's', 'out')
        a.k(P(G, py=-71, lean=-2, ll=Fk(64, 10), fl=90, al=I(30, -114)), 2, 's', 'snap')
        a.k(P(G, py=-71, lean=-3, ll=Fk(66, 4), fl=92, al=I(30, -114)), 1, 'a', 'out', hold=1)
        a.k(P(G, py=-70, lean=4, ll=Fk(55, 95), fl=40), 4, 'r', 'out')
        a.k(G, 5, 'r')
        out.append(a)
        # 中K 後ろ足の中段回し蹴り（発生8 持続3 硬直15）
        a = A('mk', hit=('toe_r', 9, 'kn_r'))
        a.k(G, 1, 's')
        a.k(P(G, px=-2, lean=2, tw=0.7, lr=I(-10, -16), fr=30, hd=-4), 3, 's', 'in')
        a.k(P(G, lean=-8, tw=0.5, lr=Fk(80, 122), fr=40, al=I(28, -116), ar=I(-6, -98), ll=I(22, -5), fl=110), 2, 's', 'out')
        a.k(P(G, lean=-16, tw=0.22, hd=4, lr=Fk(92, 8), fr=95, al=I(24, -114), ar=I(-14, -100), ll=I(22, -5), fl=112), 2, 's', 'snap', lag=0.2)
        a.k(P(G, lean=-18, tw=0.2, hd=5, lr=Fk(94, 2), fr=96, al=I(24, -114), ar=I(-16, -100), ll=I(22, -5), fl=112), 1, 'a', 'out', hold=2)
        a.k(P(G, lean=-6, tw=0.45, lr=Fk(70, 110), fr=40, ll=I(22, -5)), 6, 'r', 'out')
        a.k(G, 9, 'r')
        out.append(a)
        # 強K 上段回し蹴り（発生11 持続4 硬直21）
        # 強K：リュウの立ち強Kのような回し蹴り
        #   後ろ足を後ろへ引く → 足全体を後ろから大きく弧を描いて振り上げる（1Fずつ。残像が弧になる）→ 頭の高さで伸びる → 振り抜いて背中を見せてから戻る
        a = A('hk', hit=('toe_r', 10, 'kn_r'))
        a.k(G, 1, 's')
        # 体重を前足へ移し、腰をひねる
        a.k(P(G, px=2, lean=14, tw=0.95, hd=-8, lr=I(-28, -8), fr=50, ll=I(22, -5), fl=70, al=I(36, -110), ar=I(-16, -100)), 3, 's', 'in')
        # 後ろ足を後ろへ大きく引く（振りかぶり）
        a.k(P(G, px=0, lean=18, tw=0.7, hd=-6, lr=Fk(-40, 30), fr=-30, ll=I(18, -5), fl=80, al=I(36, -108), ar=I(-28, -96)), 3, 's', 'out')
        # 振り上げ：足全体が後ろ→下→前→上へ弧を描く（1Fずつ）
        a.k(P(G, px=-2, lean=6, tw=0.45, py=-72, hd=0, lr=Fk(8, 26), fr=20, ll=I(14, -5), fl=96, al=I(32, -104), ar=I(-36, -94)), 1, 's', 'lin')
        a.k(P(G, px=-5, lean=-10, tw=0.25, py=-73, hd=8, lr=Fk(52, 22), fr=60, ll=I(12, -5), fl=104, al=I(30, -100), ar=I(-44, -88)), 1, 's', 'lin')
        a.k(P(G, px=-8, lean=-24, tw=0.12, py=-74, hd=14, lr=Fk(86, 14), fr=90, ll=I(11, -5), fl=110, al=I(28, -100), ar=I(-50, -82)), 1, 's', 'lin')
        a.k(P(G, px=-9, lean=-32, tw=0.06, py=-74, hd=16, lr=Fk(104, 6), fr=102, ll=I(10, -5), fl=112, al=I(27, -100), ar=I(-53, -79)), 1, 's', 'lin')
        # 当たる瞬間：頭の高さで足がまっすぐ伸びる
        RH = P(G, px=-10, lean=-36, tw=0.04, py=-74, hd=18, lr=Fk(113, 2), fr=106, ll=I(10, -5), fl=114, al=I(26, -100), ar=I(-54, -78))
        a.k(RH, 1, 'a', 'lin', hold=3)
        # 振り抜き：足は勢いのまま上へ回り込み、体は背中を見せるほどひねる
        a.k(P(RH, lean=-28, tw=0.98, lr=Fk(128, 50), fr=40, al=I(-10, -104), ar=I(-40, -100), hd=10), 5, 'r', 'out')
        a.k(P(G, px=-6, lean=-8, tw=0.9, lr=Fk(70, 110), fr=-40, ll=I(14, -5), al=I(10, -106), ar=I(-30, -100)), 5, 'r', 'io')
        a.k(P(G, px=-2, lean=4, tw=0.6, lr=I(-22, -10), fr=40, ll=I(18, -5)), 5, 'r', 'io')
        a.k(G, 6, 'r')
        out.append(a)
    else:
        # 弱P 爪の裏拳（発生6 持続3 硬直9）
        a = A('lp', hit=('hand_l', 9, 'el_l'))
        a.k(G, 1, 's')
        a.k(P(G, tw=0.75, lean=2, al=I(20, -110)), 2, 's', 'in')
        a.k(P(G, px=4, lean=10, tw=0.45, al=I(64, -112), ll=I(32, -5)), 3, 's', 'snap', lag=0.3)
        a.k(P(G, px=5, lean=11, tw=0.42, al=I(72, -110), ll=I(32, -5)), 1, 'a', 'out', hold=2)
        a.k(P(G, px=2, lean=7, al=I(52, -104)), 4, 'r', 'out').k(G, 5, 'r')
        out.append(a)
        # 中P 振り下ろしの手刀（発生9 持続3 硬直15）
        a = A('mp', hit=('hand_r', 10, 'el_r'))
        a.k(G, 1, 's')
        a.k(P(G, lean=-8, tw=0.85, hd=6, ar=Fk(175, 35), py=-73), 4, 's', 'in')
        a.k(P(G, px=8, lean=20, tw=0.3, hd=-10, ar=Fk(95, 10), ll=I(34, -5), hr='open', py=-68), 4, 's', 'snap', lag=0.3)
        a.k(P(G, px=9, lean=22, tw=0.28, hd=-12, ar=Fk(82, 8), ll=I(34, -5), hr='open', py=-67), 1, 'a', 'out', hold=2)
        a.k(P(G, px=6, lean=14, ar=Fk(60, 30), ll=I(32, -5)), 6, 'r', 'out').k(G, 9, 'r')
        out.append(a)
        # 強P 両拳のハンマー（発生13 持続4 硬直24）
        a = A('hp', hit=(('hand_r', 12, 'el_r'), ('hand_l', 11)))
        a.k(G, 1, 's')
        a.k(P(G, lean=-6, tw=0.6, py=-73, al=I(30, -130), ar=I(10, -130)), 4, 's', 'io')
        a.k(P(G, lean=-18, tw=0.55, py=-76, hd=12, al=Fk(175, 25), ar=Fk(188, 25), hl='fist', hr='fist', fr=90), 4, 's', 'in', hold=1)
        a.k(P(G, px=14, py=-63, lean=32, tw=0.4, hd=-14, al=Fk(70, 15), ar=Fk(75, 12), hl='fist', hr='fist', ll=I(46, -5), lr=I(-12, -5), fr=50), 4, 's', 'snap', lag=0.3)
        a.k(P(G, px=16, py=-60, lean=36, tw=0.4, hd=-18, al=Fk(58, 12), ar=Fk(62, 10), hl='fist', hr='fist', ll=I(48, -5), lr=I(-12, -5), fr=48), 1, 'a', 'back', hold=3)
        a.k(P(G, px=13, py=-62, lean=30, al=Fk(40, 30), ar=Fk(45, 28), hl='fist', hr='fist', ll=I(46, -5), lr=I(-14, -5)), 8, 'r', 'out')
        a.k(P(G, px=5, lean=14, ll=I(34, -5)), 10, 'r').k(G, 6, 'r')
        out.append(a)
        # 弱K 低い蹴り（発生7 持続3 硬直11）
        a = A('lk', hit=('toe_l', 9, 'an_l'))
        a.k(G, 1, 's').k(P(G, lean=4, ll=Fk(52, 80), fl=40), 3, 's', 'out')
        a.k(P(G, lean=-2, ll=Fk(62, 6), fl=90), 3, 's', 'snap')
        a.k(P(G, lean=-3, ll=Fk(63, 3), fl=92), 1, 'a', hold=2)
        a.k(P(G, lean=2, ll=Fk(45, 70)), 5, 'r', 'out').k(G, 6, 'r')
        out.append(a)
        # 中K 踏みつける前蹴り（発生10 持続3 硬直17）
        a = A('mk', hit=('toe_l', 10, 'an_l'))
        a.k(G, 1, 's').k(P(G, lean=-8, px=-2, py=-73, ll=Fk(90, 118), fl=60), 5, 's', 'in')
        a.k(P(G, lean=-14, px=-2, py=-74, ll=Fk(86, 8), fl=112, al=I(26, -108)), 4, 's', 'snap', lag=0.2)
        a.k(P(G, lean=-15, px=-2, py=-74, ll=Fk(86, 3), fl=114, al=I(26, -108)), 1, 'a', hold=2)
        a.k(P(G, lean=-4, ll=Fk(70, 100)), 7, 'r', 'out').k(G, 10, 'r')
        out.append(a)
        # 強K 後ろ回し蹴り（発生15 持続4 硬直26）
        a = A('hk', hit=('toe_r', 11, 'kn_r'))
        a.k(G, 1, 's')
        a.k(P(G, lean=12, tw=0.95, px=-6, hd=-6, lr=I(-14, -10), fr=50), 6, 's', 'in')
        a.k(P(G, lean=4, tw=1.0, px=-6, hd=-2, lr=Fk(40, 120), fr=20, ll=I(16, -5)), 4, 's', 'io')
        a.k(P(G, lean=-22, tw=0.1, px=-6, py=-75, hd=14, lr=Fk(106, 2), fr=110, ll=I(12, -5), fl=110, al=I(26, -116), ar=I(-34, -110)), 4, 's', 'snap', lag=0.25)
        a.k(P(G, lean=-24, tw=0.08, px=-7, py=-75, hd=16, lr=Fk(108, 0), fr=112, ll=I(12, -5), fl=110, al=I(24, -114), ar=I(-36, -108)), 1, 'a', 'out', hold=3)
        a.k(P(G, lean=-10, tw=0.3, px=-6, lr=Fk(70, 60), ll=I(12, -5)), 8, 'r', 'out')
        a.k(P(G, lean=0, lr=I(-24, -12)), 8, 'r').k(G, 10, 'r')
        out.append(a)

    # ================================================================ しゃがみ通常技
    a = A('c_lp', hit=('hand_l', 7, 'el_l'))
    a.k(C, 1, 's').k(P(C, al=I(30, -82)), 1, 's')
    a.k(P(C, px=3, lean=26, al=I(64, -88)), 2 if K else 3, 's', 'snap', lag=0.3)
    a.k(P(C, px=4, lean=27, al=I(71, -88)), 1, 'a', hold=1 if K else 1)
    a.k(P(C, al=I(46, -86)), 3, 'r', 'out').k(C, F(4), 'r')
    out.append(a)
    a = A('c_mp', hit=('hand_r', 8, 'el_r'))
    a.k(C, 1, 's').k(P(C, tw=0.7, ar=I(2, -78)), 2, 's', 'in')
    a.k(P(C, px=6, lean=28, tw=0.15, ar=I(68, -92), al=I(20, -80)), F(3), 's', 'snap', lag=0.35)
    a.k(P(C, px=7, lean=29, tw=0.12, ar=I(78, -93), al=I(18, -80)), 1, 'a', hold=2)
    a.k(P(C, px=4, ar=I(46, -86)), 4, 'r', 'out').k(C, F(7), 'r')
    out.append(a)
    # しゃがみ強P：対空アッパー（沈み→伸び上がる）
    a = A('c_hp', hit=('hand_r', 11 if K else 12, 'el_r'))
    a.k(C, 1, 's').k(P(C, py=C['py'] + 2, lean=C['lean'] + 6, tw=0.75, ar=I(4, -44)), 3 if K else 4, 's', 'in')
    a.k(P(G, py=-72, lean=-2, tw=0.3, hd=6, ar=Fk(138, 22), al=I(20, -104), ll=I(30, -5)), 3 if K else 5, 's', 'snap', lag=0.3)
    a.k(P(G, py=-74, px=4, lean=0, tw=0.25, hd=8, ar=Fk(122, 26), al=I(18, -104), ll=I(32, -5)), 1, 'a', 'snap')
    a.k(P(G, py=-76, lean=-8, tw=0.25, hd=12, ar=Fk(165, 8), al=I(18, -104), ll=I(30, -5)), 1, 'a', 'out', hold=3)
    a.k(P(G, py=-72, lean=4, ar=I(30, -124)), 8 if K else 10, 'r', 'out').k(C, 12 if K else 14, 'r')
    out.append(a)
    a = A('c_lk', hit=('toe_l', 8, 'an_l'), flags={'low': True})
    a.k(C, 1, 's').k(P(C, ll=Fk(40, 60), fl=60), 2 if K else 3, 's', 'out')
    a.k(P(C, lean=26, py=C['py'] + 2, ll=Fk(80, 2), fl=96), 2 if K else 3, 's', 'snap')
    a.k(P(C, lean=27, py=C['py'] + 2, ll=Fk(82, 0), fl=98), 1, 'a', hold=1)
    a.k(P(C, ll=Fk(50, 70)), 3, 'r', 'out').k(C, F(5), 'r')
    out.append(a)
    # しゃがみ中K：低く滑り込む蹴り
    a = A('c_mk', hit=('toe_l', 9, 'an_l'), flags={'low': True})
    a.k(C, 1, 's').k(P(C, lean=30, ll=Fk(50, 80), fl=60, al=I(30, -70)), 3 if K else 4, 's', 'in')
    a.k(P(C, lean=34, py=C['py'] + 5, px=-2, ll=Fk(84, 0), fl=98, lr=I(-26, -5), al=I(26, -66), ar=I(6, -60)), 3 if K else 5, 's', 'snap', lag=0.2)
    a.k(P(C, lean=35, py=C['py'] + 5, px=-2, ll=Fk(86, 0), fl=100, lr=I(-26, -5), al=I(26, -66), ar=I(6, -60)), 1, 'a', hold=2)
    a.k(P(C, lean=28, ll=Fk(55, 80)), 6, 'r', 'out').k(C, F(8), 'r')
    out.append(a)
    # しゃがみ強K：足払い（手をついて後ろ足で円を描く）
    a = A('c_hk', hit=('toe_r', 9, 'an_r'), flags={'low': True, 'sweep': True})
    a.k(C, 1, 's')
    a.k(P(C, lean=40, py=C['py'] + 8, tw=0.9, al=I(34, -8), ar=I(18, -8), hl='open', hr='open', lr=Fk(-40, 60)), 4 if K else 5, 's', 'in')
    a.k(P(C, lean=44, py=C['py'] + 12, tw=0.3, al=I(36, -8), ar=I(16, -8), hl='open', hr='open', lr=Fk(70, 0), fr=90, ll=I(20, -5)), 3 if K else 4, 's', 'snap')
    a.k(P(C, lean=44, py=C['py'] + 13, tw=0.15, al=I(36, -8), ar=I(16, -8), hl='open', hr='open', lr=Fk(98, -2), fr=100, ll=I(18, -5)), 2, 'a', 'lin', hold=1)
    a.k(P(C, lean=40, py=C['py'] + 12, tw=0.15, al=I(36, -8), ar=I(16, -8), hl='open', hr='open', lr=Fk(120, 0), fr=110, ll=I(18, -5)), 8 if K else 10, 'r', 'out')
    a.k(P(C, lean=30, lr=Fk(-20, 80)), 8 if K else 10, 'r').k(C, 6 if K else 8, 'r')
    out.append(a)

    # ================================================================ ジャンプ攻撃（めくり・飛び込み）
    def jatk(name, wind, hit, s, act, hitj):
        a = A(name, hit=hitj, flags={'air': True, 'high': True}, wy=4)
        a.k(FALL, 1, 's').k(wind, s - 3, 's', 'in').k(hit, 2, 's', 'snap', lag=0.25)
        a.k(P(hit, lean=hit['lean'] + 2), 1, 'a', hold=act - 1).k(FALL, 12, 'r')
        out.append(a)
    jatk('j_p', P(FALL, al=I(26, -108), tw=0.5), P(FALL, lean=26, tw=0.25, al=Fk(58, 4), ar=I(4, -100)), 5, 8, ('hand_l', 9, 'el_l'))
    jatk('j_hp', P(FALL, lean=-12, tw=0.8, ar=Fk(175, 40), hd=6), P(FALL, lean=32, tw=0.15, hd=-16, ar=Fk(52, 4), al=I(2, -100)), F(8), 6, ('hand_r', 11, 'el_r'))
    jatk('j_k', P(FALL, ll=Fk(80, 120), lean=4), P(FALL, lean=-12, ll=Fk(72, 6), fl=80, lr=Fk(0, 70)), 6, 9, ('toe_l', 9, 'an_l'))
    jatk('j_hk', P(FALL, lean=14, tw=0.85, lr=Fk(30, 125)), P(FALL, lean=-22, tw=0.15, lr=Fk(78, 2), fr=78, ll=Fk(20, 90)), F(9), 6, ('toe_r', 10, 'an_r'))

    # ================================================================ 投げ
    TR = P(G, lean=24, px=8, tw=0.35, al=I(62, -112), ar=I(56, -100), hl='open', hr='open', ll=I(36, -5), fr=50)
    a = A('throw', hit=('hand_l', 10, 'hand_r'))
    a.k(G, 1, 's').k(P(G, lean=16, tw=0.5, al=I(40, -112), ar=I(30, -100), hl='open', hr='open'), 4, 's', 'snap', lag=0.2)
    a.k(TR, 1, 'a', hold=2).k(P(TR, px=4, lean=16), 8, 'r', 'out').k(G, 12, 'r')
    out.append(a)
    a = A('throw_do', flags={'throw': True})
    if K:
        a.k(TR, 2).k(P(TR, lean=12, al=I(48, -122), ar=I(42, -112), hl='fist', hr='fist'), 6, e='snap')
        a.k(P(G, lean=-20, hd=14, tw=0.85, px=-6, py=-72, al=I(8, -152), ar=I(-6, -148)), 10, e='out', lag=0.2)
        a.k(P(G, lean=40, px=12, py=-56, tw=0.25, al=I(80, -68), ar=I(70, -62), ll=I(46, -5), fr=40), 4, e='snap', hold=8)
        a.k(P(G, lean=20, px=6, py=-64), 8, e='out').k(G, 8)
    else:
        a.k(TR, 2).k(P(TR, lean=6, al=I(52, -124), ar=I(46, -118), hl='claw', hr='claw'), 6, e='snap')
        a.k(P(G, lean=-14, py=-76, hd=12, al=I(28, -170), ar=I(20, -166), tw=0.6), 14, e='out', lag=0.2)
        a.k(P(G, lean=46, px=18, py=-50, al=I(84, -48), ar=I(76, -42), ll=I(50, -5), fr=40), 5, e='snap', hold=10)
        a.k(P(G, lean=20, px=8, py=-66), 10, e='out').k(G, 8)
    out.append(a)
    a = A('tech')
    a.k(TR, 1).k(P(G, lean=-10, px=-6, al=I(62, -116), ar=I(56, -104), hl='open', hr='open', hd=10), 3, e='snap')
    a.k(P(G, lean=-16, px=-12, py=-70, al=I(40, -124), ar=I(30, -110), ll=I(10, -12), hd=12), 10, e='out').k(G, 10)
    out.append(a)

    # ================================================================ やられ（大きくのけぞる）
    HH = P(G, lean=-26, hd=34, px=-8, py=G['py'] - 2, tw=0.55, al=Fk(150, 60), ar=Fk(-30, 40), ll=I(18, -5), lr=I(-26, -5), fr=90)
    a = A('hit_hi')
    a.k(P(HH, lean=-14, hd=20), 1).k(HH, 2, e='snap').k(P(HH, lean=-30, hd=40, px=-10), 4, e='out')
    a.k(P(G, lean=-6, hd=10, px=-6, al=I(20, -110), ar=I(6, -100)), 8, e='io').k(G, 8, e='io')
    out.append(a)
    HL = P(G, lean=40, hd=-30, px=-8, py=G['py'] + 4, tw=0.4, al=I(12, -84), ar=I(4, -78), fr=80)
    a = A('hit_lo')
    a.k(P(HL, lean=28), 1).k(HL, 2, e='snap').k(P(HL, lean=46, py=G['py'] + 6, px=-10), 4, e='out')
    a.k(P(G, lean=22, px=-6), 8).k(G, 8)
    out.append(a)
    HC = P(C, lean=-2, hd=28, px=-8, py=C['py'] - 2, al=Fk(150, 60), ar=Fk(-20, 50))
    a = A('hit_c')
    a.k(P(HC, hd=18), 1).k(HC, 2, e='snap').k(P(HC, lean=-8, hd=34), 4).k(C, 14)
    out.append(a)
    # 吹き飛び：体ごと後ろへ回りながら飛ぶ（最後は横になって落ちる）
    L0 = P(G, lean=-30, hd=30, py=-74, tw=0.5, al=Fk(200, 40), ar=Fk(150, 30), ll=Fk(40, 60), lr=Fk(-20, 40), fl=40, fr=30)
    a = A('launch', wy=-4)
    a.k(HH, 1).k(P(L0, rot=0), 3, e='snap')
    a.k(P(L0, rot=-30, ll=Fk(60, 80), lr=Fk(30, 70)), 10, e='out')
    a.k(P(L0, rot=-60, lean=-20, ll=Fk(50, 30), lr=Fk(20, 30), al=Fk(210, 20), ar=Fk(180, 20)), 12, e='io')
    a.k(P(L0, rot=-80, lean=-10, ll=Fk(30, 20), lr=Fk(10, 20)), 30, e='io')
    out.append(a)
    # ダウン：横たわる（落下の衝撃で一度弾む）
    LIE = dict(px=0, py=12, lean=0, tw=0.4, hd=-6, rot=-90, rotc=18, al=Fk(170, 10), ar=Fk(190, 20),
               ll=Fk(4, 6), lr=Fk(-4, 12), fl=150, fr=150, hl='open', hr='open')
    a = A('down')
    a.k(P(LIE, py=6, rot=-84, ll=Fk(30, 50), lr=Fk(20, 40)), 1).k(P(LIE, py=0, rot=-80, ll=Fk(40, 60)), 3, e='out')
    a.k(P(LIE, py=13, rot=-92), 4, e='in').k(LIE, 6).k(P(LIE, hd=-4), 30)
    out.append(a)
    # 起き上がり：上体を起こす→片膝→立つ
    a = A('getup')
    a.k(LIE, 1).k(P(LIE, rot=-60, py=4, ll=Fk(70, 120), lr=Fk(20, 20), al=Fk(-20, 10), ar=Fk(-30, 10)), 6, e='out')
    a.k(P(C, py=-30, lean=30, rot=-10, ll=I(30, -5), lr=I(-20, -5), al=I(10, -6), ar=I(-4, -6), hl='open', hr='open'), 8, e='io')
    a.k(P(C, py=-40, lean=24), 6, e='out').k(P(G, py=G['py'] + 4), 6, e='out').k(G, 4)
    out.append(a)
    # KO：大きくのけぞってスローで倒れる
    a = A('ko')
    a.k(HH, 1).k(P(HH, lean=-40, hd=44, px=-12, ll=I(24, -8), lr=I(-34, -5)), 8, e='out')
    a.k(P(L0, rot=-30, py=-60), 10, e='in').k(P(L0, rot=-70, py=-36, lean=-10), 10, e='in')
    a.k(P(LIE, py=4, rot=-84), 6, e='in').k(P(LIE, py=0, rot=-82), 4, e='out').k(LIE, 6, e='in').k(LIE, 60)
    out.append(a)

    # ================================================================ 勝利・登場
    a = A('win', cloth_wind=0.25)
    if K:
        W1 = P(G, py=-74, lean=-2, tw=0.75, hd=-6, al=I(28, -152), ar=I(-14, -96), hl='fist', ll=I(14, -5), lr=I(-18, -5), fr=90)
        a.k(G, 1).k(P(G, py=-66, lean=14, tw=0.6, al=I(10, -96), ar=I(-6, -92)), 10, e='in')
        a.k(W1, 8, e='snap', lag=0.3)
        for i in range(4):
            a.k(P(W1, py=-74 + 0.7 * math.sin(i * 1.6), al=I(28, -152 + math.sin(i * 1.6)), hd=-6 + math.sin(i * 1.6)), 12)
    else:
        W1 = P(G, lean=-8, tw=0.95, hd=16, py=-74, al=I(52, -108), ar=I(-44, -108), ll=I(28, -5), lr=I(-30, -5))
        a.k(G, 1).k(P(G, lean=-12, hd=20, al=I(34, -146), ar=I(-24, -146)), 14, e='in')
        a.k(W1, 8, e='back', lag=0.3)
        for i in range(4):
            a.k(P(W1, hd=16 + 3 * math.sin(i * 2), lean=-8 + math.sin(i * 2)), 12)
    out.append(a)
    a = A('intro')
    if K:
        a.k(P(G, py=-75, lean=0, tw=0.9, hd=-4, al=I(10, -96), ar=I(-6, -94), ll=I(12, -5), lr=I(-14, -5), fr=90), 1)
        a.k(P(G, py=-75, lean=0, tw=0.9, hd=-10, al=I(18, -110), ar=I(12, -108), ll=I(12, -5), lr=I(-14, -5), fr=90), 18)
        a.k(P(G, py=-62, lean=16), 10, e='snap').k(G, 14)
    else:
        a.k(P(G, py=-76, lean=0, tw=0.9, hd=24, al=I(10, -100), ar=I(-10, -100), ll=I(16, -5), lr=I(-18, -5), fr=90), 1)
        a.k(P(G, py=-76, lean=0, tw=0.9, hd=-20, al=I(10, -100), ar=I(-10, -100), ll=I(16, -5), lr=I(-18, -5), fr=90), 16)
        a.k(P(G, py=-70, lean=8, al=I(50, -120), ar=I(-40, -120)), 10, e='back').k(G, 14)
    out.append(a)

    # ================================================================ ラッシュ（低い姿勢で走る）
    a = A('rush', loop=True, vx=8.5)
    nf = 6
    for i in range(nf + 1):
        ph = (i % nf) / nf * math.tau
        s = math.sin(ph); c = math.cos(ph)
        a.k(P(G, px=8, py=-62 - 3 * abs(c), lean=34, tw=0.3, hd=-30,
              al=I(42 - 10 * s, -100), ar=I(-20 + 12 * s, -88),
              ll=I(22 + 22 * s, -5 - 10 * max(0, c)), lr=I(-16 - 22 * s, -5 - 10 * max(0, -c)),
              fl=80, fr=60), 1 if i == 0 else 2, e='lin')
    out.append(a)

    # ================================================================ 必殺技
    if K:
        # 虚環弾：腰だめに気を溜める→両掌で撃ち出す（発生12）
        FB = P(G, px=12, py=-62, lean=24, tw=0.3, hd=-18, al=I(74, -110), ar=I(72, -100), hl='open', hr='open', ll=I(44, -5), lr=I(-18, -5), fr=50)
        a = A('sp_fire', flags={'proj': 'hand_r'})
        a.k(G, 1, 's')
        a.k(P(G, px=-6, py=-64, lean=0, tw=0.92, hd=-6, al=I(-16, -96), ar=I(-24, -90), hl='open', hr='open', ll=I(28, -5)), 6, 's', 'in', hold=2)
        a.k(FB, 3, 's', 'snap', lag=0.35)
        a.k(P(FB, px=13, lean=26), 1, 'a', hold=3)
        a.k(P(FB, px=10, lean=20, al=I(60, -108), ar=I(56, -100)), 10, 'r', 'out').k(G, 20, 'r')
        out.append(a)
        a = A('ex_fire', flags={'proj': 'hand_r'})
        a.k(G, 1, 's')
        a.k(P(G, py=-76, lean=-10, tw=0.9, hd=14, al=I(30, -160), ar=I(14, -160), hl='open', hr='open'), 4, 's', 'out')
        a.k(P(G, px=-6, py=-64, lean=-2, tw=0.95, al=I(-16, -108), ar=I(-22, -100), hl='open', hr='open', ll=I(28, -5)), 4, 's', 'snap', lag=0.3)
        FB2 = P(FB, lean=30, px=15, py=-60, al=I(80, -116), ar=I(80, -102), ll=I(48, -5))
        a.k(FB2, 2, 's', 'snap').k(P(FB2, lean=32), 1, 'a', hold=3)
        a.k(P(FB2, lean=22, al=I(60, -110), ar=I(58, -100)), 10, 'r', 'out').k(G, 18, 'r')
        out.append(a)
        # 昇穿：沈み込んで飛び上がるアッパー（無敵）
        DP0 = P(C, py=-46, px=8, lean=30, tw=0.8, hd=-20, ar=I(6, -48), ll=I(36, -5))
        DPa = P(G, py=-72, px=16, lean=14, tw=0.3, hd=0, ar=Fk(108, 34), al=I(20, -100), ll=Fk(60, 90), lr=I(-14, -5), fl=50)
        DP = P(G, py=-84, px=10, lean=-10, hd=14, tw=0.2, ar=Fk(174, 4), al=I(16, -100), ll=Fk(78, 110), lr=Fk(-10, 20), fl=50, fr=10, fabs_r=True)
        a = A('sp_dp', hit=('hand_r', 18, 'el_r'), wy=lambda i, n: -8 if i < n * 0.45 else 6)
        a.k(G, 1, 's').k(DP0, 2, 's', 'snap')
        a.k(DPa, 1, 'a', 'snap', hold=1).k(DP, 2, 'a', 'snap', lag=0.2).k(P(DP, tw=0.7, lean=-16, hd=18), 8, 'a', 'out')
        a.k(P(FALL, lean=4, ar=I(20, -126), al=I(16, -110), tw=0.4), 14, 'r', 'io')
        a.k(P(FALL, lean=8), 16, 'r').k(P(C, py=-50, lean=16), 6, 'r', 'out').k(P(G, py=-64), 4, 'r')
        out.append(a)
        a = A('ex_dp', hit=('hand_r', 19, 'el_r'), wy=lambda i, n: -9 if i < n * 0.45 else 6)
        a.k(G, 1, 's').k(P(DP0, al=I(4, -58)), 2, 's', 'snap')
        a.k(P(DPa, al=Fk(118, 30)), 1, 'a', 'snap', hold=1).k(P(DP, al=Fk(160, 10)), 2, 'a', 'snap', lag=0.2)
        a.k(P(DP, al=Fk(160, 10), tw=0.8, lean=-18, hd=20), 10, 'a', 'out')
        a.k(P(FALL, lean=4, ar=I(20, -126), al=I(16, -120)), 14, 'r').k(P(FALL, lean=8), 18, 'r')
        a.k(P(C, py=-50, lean=16), 6, 'r', 'out').k(P(G, py=-64), 4, 'r')
        out.append(a)
        # 迅閃脚：低く溜めて飛び横蹴り
        RK = P(G, lean=-16, py=-82, px=6, tw=0.15, hd=6, ll=Fk(88, 2), fl=95, lr=Fk(-30, 90), fr=-40, al=I(20, -126), ar=I(-26, -112))
        a = A('sp_rush', hit=('toe_l', 11, 'kn_l'), vx=6)
        a.k(G, 1, 's').k(P(G, lean=28, py=-60, px=-6, tw=0.8, ll=Fk(30, 100), fl=40), 6, 's', 'in').k(P(G, lean=24, py=-62, px=-4, ll=Fk(60, 120), fl=40), 2, 's', 'snap')
        a.k(RK, 1, 'a', 'snap', hold=2).k(P(RK, lean=-18, ll=Fk(90, 0)), 10, 'a', 'lin')
        a.k(P(G, py=-62, lean=18), 8, 'r', 'out').k(P(G, py=-66), 10, 'r').k(G, 4, 'r')
        out.append(a)
        # 迅閃脚（新）：下段スライディング。体を後ろに倒し、前足を地面すれすれに伸ばして滑る
        SL = P(G, lean=-42, py=-24, px=2, tw=0.2, hd=18, ll=I(78, -6), fl=100, lr=I(-4, -4), fr=20,
               al=I(-44, -8), ar=I(20, -48), hl='open', hr='fist')
        a = A('sp_slide', hit=('toe_l', 10, 'an_l'), flags={'low': True}, vx=7)
        a.k(G, 1, 's').k(P(C, lean=30, py=-40, px=-4, ll=Fk(40, 80), fl=60), 4, 's', 'in')
        a.k(P(SL, lean=-10, py=-36, ll=I(50, -8)), 3, 's', 'snap', lag=0.2)
        a.k(SL, 1, 'a', 'snap', hold=2).k(P(SL, lean=-44, py=-22, ll=I(82, -5)), 10, 'a', 'lin')
        a.k(P(SL, lean=-24, py=-30, ll=I(62, -6), lr=I(-2, -6), al=I(-30, -20)), 8, 'r', 'out')
        a.k(P(C, lean=18, py=-44), 8, 'r', 'io').k(G, 6, 'r')
        out.append(a)
        a = A('ex_rush', hit=('toe_l', 13, 'kn_l'), vx=8)
        a.k(G, 1, 's').k(P(G, lean=30, py=-58, px=-6, tw=0.8, ll=Fk(30, 100), fl=40), 6, 's', 'in').k(P(G, lean=24, py=-62, ll=Fk(60, 120)), 2, 's', 'snap')
        a.k(P(RK, lean=-20), 1, 'a', 'snap', hold=2).k(P(RK, lean=-24, lr=Fk(60, 110)), 8, 'a')
        a.k(P(G, lean=-12, py=-84, lr=Fk(104, 2), ll=Fk(-10, 60), al=I(30, -130), fr=104), 3, 'a', 'snap').k(P(G, lean=-14, py=-84, lr=Fk(106, 0), ll=Fk(-10, 60)), 1, 'a', hold=5)
        a.k(P(G, py=-62, lean=18), 10, 'r', 'out').k(P(G, py=-66), 8, 'r').k(G, 4, 'r')
        out.append(a)
        # 超必殺1 虚空砲：頭上に気を集め、両掌から放つ
        a = A('su_1', flags={'beam': 'hand_r'})
        a.k(G, 1, 's')
        a.k(P(G, lean=-6, py=-74, hd=10, tw=1.0, al=I(42, -150), ar=I(-32, -150), hl='open', hr='open', ll=I(28, -5), lr=I(-32, -5)), 4, 's', 'out', hold=2)
        a.k(P(G, lean=-8, px=-10, py=-64, tw=0.95, al=I(-24, -100), ar=I(-30, -94), hl='open', hr='open', ll=I(30, -5)), 3, 's', 'in', hold=1)
        SB = P(FB, lean=28, px=15, py=-60, al=I(82, -112), ar=I(80, -100), ll=I(50, -5))
        a.k(SB, 1, 's', 'snap')
        for i in range(6):
            a.k(P(SB, px=15 - (i % 2), lean=28 - (i % 2) * 2, py=-60 + (i % 2)), 8, 'a')
        a.k(P(SB, lean=18, px=10, al=I(60, -108), ar=I(58, -100)), 14, 'r', 'out').k(G, 22, 'r')
        out.append(a)
        # 超必殺2 零界継承：踏み込み→連打→昇り拳で打ち上げ
        a = A('su_2', hit=(('hand_r', 15, 'el_r'), ('toe_r', 14, 'kn_r'), ('hand_l', 13)), vx=9)
        a.k(G, 1, 's').k(P(G, lean=-12, py=-74, tw=0.9, al=I(34, -132), ar=I(-20, -126)), 4, 's', 'out', hold=2)
        a.k(P(G, py=-60, lean=32, px=6, ll=I(44, -16), lr=Fk(-50, 70), al=I(46, -104), ar=I(-14, -98)), 4, 's', 'snap', lag=0.2)
        seq = [
            P(G, px=8, lean=18, tw=0.5, al=I(76, -120), ar=I(12, -104), ll=I(34, -5)),
            P(G, px=12, lean=24, tw=0.12, ar=I(90, -112), al=I(10, -104), ll=I(38, -5), fr=45),
            P(G, px=8, lean=20, tw=0.55, al=I(74, -96), ar=I(10, -100), ll=I(36, -5)),
            P(G, px=-4, lean=-16, tw=0.25, lr=Fk(98, 6), fr=98, ll=I(14, -5), al=I(24, -118)),
            P(G, px=-6, lean=-26, py=-73, tw=0.15, lr=Fk(122, 4), fr=120, ll=I(12, -5), al=I(20, -114)),
            P(G, px=14, lean=26, tw=0.1, ar=I(94, -102), al=I(6, -104), ll=I(42, -5), fr=40),
            DP0,
            P(DP, lean=-12),
        ]
        for j, s_ in enumerate(seq):
            a.k(s_, 2, 'a', 'snap', lag=0.15).k(P(s_, lean=s_['lean'] + 2), 1, 'a', hold=3)
        a.k(P(DP, lean=-16, hd=20, tw=0.7), 8, 'a', 'out').k(P(FALL, lean=4), 14, 'r').k(P(C, py=-50, lean=16), 6, 'r').k(P(G, py=-64), 6, 'r')
        out.append(a)
    else:
        # 冥核弾：頭上で闇の球を練り、叩きつけるように放つ
        FB = P(G, px=12, py=-64, lean=30, tw=0.3, hd=-16, ar=I(76, -104), al=I(24, -100), hr='open', ll=I(44, -5), lr=I(-16, -5), fr=55)
        a = A('sp_fire', flags={'proj': 'hand_r'})
        a.k(G, 1, 's').k(P(G, lean=-14, py=-76, hd=12, tw=0.8, ar=I(10, -168), al=I(30, -124), hr='claw'), 9, 's', 'out', hold=4)
        a.k(FB, 3, 's', 'snap', lag=0.35).k(P(FB, lean=32), 1, 'a', hold=3)
        a.k(P(FB, lean=22, ar=I(56, -100)), 12, 'r', 'out').k(G, 24, 'r')
        out.append(a)
        a = A('ex_fire', flags={'proj': 'hand_r'})
        a.k(G, 1, 's').k(P(G, lean=-18, py=-78, hd=16, tw=1.0, ar=I(20, -172), al=I(36, -168), hr='claw', hl='claw'), 9, 's', 'out', hold=2)
        FB2 = P(FB, al=I(74, -96), hl='open', lean=34, px=14)
        a.k(FB2, 3, 's', 'snap', lag=0.3).k(P(FB2, lean=36), 1, 'a', hold=3)
        a.k(P(FB2, lean=24, al=I(54, -98), ar=I(56, -100)), 12, 'r', 'out').k(G, 22, 'r')
        out.append(a)
        # 断天：低く沈み、爪で斬り上げながら跳ぶ
        DP0 = P(C, py=-48, px=8, lean=26, tw=0.9, ar=I(-16, -40), hd=-16, ll=I(38, -5))
        DPa = P(G, py=-72, px=16, lean=12, hd=2, tw=0.4, ar=Fk(112, 30), ll=Fk(60, 90), fl=50)
        DP = P(G, py=-82, px=10, lean=-14, hd=18, tw=0.4, ar=Fk(168, 10), al=I(30, -110), ll=Fk(64, 90), lr=Fk(-10, 30), fl=50, fr=10)
        a = A('sp_dp', hit=('hand_r', 18, 'el_r'), wy=lambda i, n: -7 if i < n * 0.45 else 6)
        a.k(G, 1, 's').k(DP0, 3, 's', 'snap')
        a.k(DPa, 1, 'a', 'snap', hold=1).k(DP, 2, 'a', 'snap', lag=0.2).k(P(DP, lean=-20, ar=Fk(205, 10), hd=24), 8, 'a', 'out')
        a.k(P(FALL, lean=6, tw=0.6), 14, 'r').k(P(FALL, lean=10), 16, 'r').k(P(C, py=-52, lean=20), 8, 'r', 'out').k(P(G, py=-66), 4, 'r')
        out.append(a)
        a = A('ex_dp', hit=('hand_r', 19, 'el_r'), wy=lambda i, n: -8 if i < n * 0.45 else 6)
        a.k(G, 1, 's').k(P(DP0, al=I(-4, -50)), 3, 's', 'snap')
        a.k(P(DPa, al=Fk(112, 30)), 1, 'a', 'snap', hold=1).k(P(DP, al=Fk(150, 10)), 2, 'a', 'snap', lag=0.2)
        a.k(P(DP, lean=-24, ar=Fk(205, 10), al=Fk(195, 10), hd=24), 11, 'a', 'out')
        a.k(P(FALL, lean=6), 14, 'r').k(P(FALL, lean=10), 18, 'r').k(P(C, py=-52, lean=20), 8, 'r').k(P(G, py=-66), 4, 'r')
        out.append(a)
        # 崩落突進：肩から突っ込む体当たり
        TK = P(G, lean=36, px=10, py=-64, tw=0.12, hd=-24, al=I(30, -90), ar=I(-10, -96), ll=I(42, -8), lr=I(-34, -16), fr=50)
        a = A('sp_rush', hit=(('sh_l', 14), ('hand_l', 10)), vx=7)
        a.k(G, 1, 's').k(P(G, lean=-8, px=-8, tw=0.95, al=I(0, -96), ar=I(-30, -96), py=-74), 10, 's', 'in').k(P(TK, lean=24), 2, 's', 'snap')
        a.k(TK, 1, 'a', 'snap')
        for i in range(4):
            a.k(P(TK, ll=I(36 + 10 * (i % 2), -8 - 6 * (i % 2)), lr=I(-30 - 10 * (i % 2), -14)), 4, 'a', 'lin')
        a.k(P(G, py=-68, lean=18), 10, 'r', 'out').k(P(G, py=-70), 12, 'r')
        out.append(a)
        a = A('ex_rush', hit=(('sh_l', 16), ('hand_l', 12)), vx=9)
        a.k(G, 1, 's').k(P(G, lean=-8, px=-8, tw=1.0, al=I(0, -96), ar=I(-32, -96), py=-74), 7, 's', 'in').k(P(TK, lean=24), 2, 's', 'snap')
        a.k(TK, 1, 'a', 'snap')
        for i in range(5):
            a.k(P(TK, ll=I(36 + 10 * (i % 2), -8 - 6 * (i % 2)), lr=I(-30 - 10 * (i % 2), -14)), 4, 'a', 'lin')
        a.k(P(G, py=-68, lean=18), 10, 'r', 'out').k(P(G, py=-70), 12, 'r')
        out.append(a)
        # 終縛：コマンド投げ（つかみ→担ぎ上げ→叩きつけ）
        CG = P(G, lean=28, px=14, tw=0.4, al=I(74, -112), ar=I(66, -96), hl='claw', hr='claw', ll=I(44, -5), fr=50)
        a = A('sp_grab', hit=('hand_l', 14, 'hand_r'))
        a.k(G, 1, 's').k(P(G, lean=-8, px=-6, tw=0.9, al=I(10, -130), ar=I(-16, -120)), 3, 's', 'in').k(P(CG, lean=20), 2, 's', 'snap', lag=0.2)
        a.k(CG, 1, 'a', hold=2).k(P(CG, px=10, lean=20), 10, 'r', 'out').k(G, 18, 'r')
        out.append(a)
        a = A('sp_grab_do', flags={'throw': True})
        a.k(CG, 2).k(P(CG, lean=10, al=I(56, -134), ar=I(50, -126)), 6, e='snap')
        a.k(P(G, lean=-30, py=-80, hd=22, tw=0.7, al=I(0, -178), ar=I(-10, -172)), 18, e='out', lag=0.2)
        a.k(P(G, lean=50, px=20, py=-44, al=I(86, -36), ar=I(78, -30), ll=I(54, -5), fr=40), 4, e='snap', hold=14)
        a.k(P(G, lean=10, hd=8, py=-72), 10, e='out').k(G, 8)
        out.append(a)
        # 超必殺1 終焉の柱：両腕を天に掲げ、地面を叩く
        a = A('su_1', flags={'pillar': True})
        a.k(G, 1, 's').k(P(G, lean=-16, py=-78, hd=18, tw=1.0, al=I(40, -170), ar=I(-20, -170), cape=20), 16, 's', 'out', hold=6)
        SL = P(C, lean=44, py=-36, px=8, al=I(60, -6), ar=I(40, -6), hl='open', hr='open')
        a.k(SL, 3, 'a', 'snap')
        for i in range(5):
            a.k(P(SL, py=-36 + (i % 2), lean=44 - (i % 2)), 8, 'a')
        a.k(P(C, py=-48, lean=20), 14, 'r', 'out').k(G, 20, 'r')
        out.append(a)
        # 超必殺2 万象終焉：飛びかかってつかむ
        a = A('su_2', hit=('hand_l', 16, 'hand_r'), vx=6)
        a.k(G, 1, 's').k(P(G, lean=-12, py=-78, tw=1.0, al=I(40, -140), ar=I(-30, -140)), 9, 's', 'out', hold=4)
        a.k(P(CG, lean=34), 4, 'a', 'snap').k(CG, 4, 'a', hold=2).k(P(CG, px=10, lean=16), 12, 'r', 'out').k(G, 18, 'r')
        out.append(a)
        a = A('su_2_do', flags={'throw': True})
        a.k(CG, 2).k(P(CG, lean=4, al=I(56, -140), ar=I(50, -132)), 8, e='snap')
        a.k(P(G, lean=-34, py=-82, hd=24, al=I(0, -186), ar=I(-10, -180)), 20, e='out', lag=0.2)
        a.k(P(G, lean=52, px=20, py=-42, al=I(88, -30), ar=I(80, -24), ll=I(56, -5), fr=40), 4, e='snap', hold=20)
        a.k(P(G, lean=-10, hd=14, tw=0.95, al=I(44, -112), ar=I(-34, -112), py=-74), 12, e='out').k(G, 12)
        out.append(a)

    # ================================================================ 追加技（特殊技・必殺技・超必殺3）
    if K:
        # →＋中P 鎚打ち（中段）：振りかぶって上から叩き下ろす
        a = A('f_mp', hit=('hand_r', 11, 'el_r'), flags={'high': True})
        a.k(G, 1, 's')
        a.k(P(G, lean=-10, py=-72, tw=0.75, hd=8, ar=Fk(186, 30), al=I(36, -120), fr=86), 9, 's', 'in', hold=3)
        a.k(P(G, px=12, py=-64, lean=26, tw=0.3, hd=-16, ar=Fk(100, 8), al=I(10, -102), ll=I(42, -5), lr=I(-14, -5), fr=50), 4, 's', 'snap', lag=0.35)
        a.k(P(G, px=14, py=-62, lean=30, tw=0.28, hd=-20, ar=Fk(84, 6), al=I(8, -100), ll=I(44, -5), lr=I(-14, -5), fr=46), 1, 'a', 'back', hold=2)
        a.k(P(G, px=10, py=-64, lean=22, ar=Fk(60, 30), ll=I(40, -5)), 8, 'r', 'out').k(G, 10, 'r')
        out.append(a)
        # →＋強P 踏破肘：大きく踏み込んで肘
        a = A('f_hp', hit=('el_r', 12, 'sh_r'), vx=2.5)
        a.k(G, 1, 's')
        a.k(P(G, px=-4, lean=4, tw=0.8, ar=I(-6, -110), fr=78), 5, 's', 'in')
        a.k(P(G, px=22, py=-62, lean=30, tw=0.05, hd=-22, ar=Fk(80, -150), al=I(30, -112), ll=I(56, -5), lr=I(-6, -5), fr=40), 5, 's', 'snap', lag=0.2)
        a.k(P(G, px=24, py=-61, lean=32, tw=0.02, hd=-24, ar=Fk(84, -152), al=I(28, -110), ll=I(58, -5), lr=I(-4, -5), fr=38), 1, 'a', 'back', hold=3)
        a.k(P(G, px=18, py=-64, lean=22, ll=I(52, -5), lr=I(-8, -5)), 8, 'r', 'out').k(P(G, px=10), 6, 'r').k(G, 6, 'r')
        out.append(a)
        # ←＋強K 旋踵：背を向けて回る後ろ回し蹴り
        a = A('b_hk', hit=('toe_r', 12, 'kn_r'))
        a.k(G, 1, 's')
        a.k(P(G, lean=14, tw=1.0, px=-4, hd=-10, lr=I(-10, -8), fr=40, ar=I(-20, -96)), 6, 's', 'in')
        a.k(P(G, lean=6, tw=1.0, px=-6, lr=Fk(40, 120), fr=20, ll=I(16, -5)), 4, 's', 'io')
        a.k(P(G, lean=-26, tw=0.05, px=-8, py=-76, hd=16, lr=Fk(104, 0), fr=110, ll=I(10, -5), fl=112, al=I(24, -118), ar=I(-36, -112)), 3, 's', 'snap', lag=0.25)
        a.k(P(G, lean=-28, tw=0.04, px=-9, py=-76, hd=18, lr=Fk(106, 0), fr=112, ll=I(10, -5), fl=112, al=I(22, -116), ar=I(-38, -110)), 1, 'a', 'out', hold=3)
        a.k(P(G, lean=-10, tw=0.3, px=-6, lr=Fk(70, 60), ll=I(12, -5)), 4, 'r', 'out').k(P(G, lean=2, lr=I(-24, -12)), 3, 'r').k(G, 5, 'r')
        out.append(a)
        # ↓↘→＋K 旋風脚：片足で回転しながら前進する多段蹴り
        a = A('sp_tatsu', hit=(('toe_l', 12, 'kn_l'), ('toe_r', 12, 'kn_r')), vx=4, wy=-1)
        a.k(G, 1, 's').k(P(G, py=-62, lean=20, tw=0.9, ll=Fk(30, 100), fl=40, al=I(30, -100), ar=I(-20, -100)), 5, 's', 'in')
        SP1 = P(G, py=-90, lean=-4, tw=0.15, hd=0, ll=Fk(92, 0), lr=Fk(-10, 80), fl=95, fr=20, al=I(40, -130), ar=I(-40, -126))
        SP2 = P(G, py=-90, lean=4, tw=0.85, hd=-4, ll=Fk(10, 80), lr=Fk(-92, 0), fl=40, fr=-90, al=I(-30, -128), ar=I(40, -128))
        a.k(SP1, 3, 's', 'snap')
        for i in range(3):
            a.k(SP2, 3, 'a', 'lin').k(SP1, 3, 'a', 'lin', hold=1)
        a.k(P(FALL, lean=10), 5, 'r', 'out').k(P(C, py=-50, lean=16), 5, 'r', 'out').k(G, 4, 'r')
        out.append(a)
        # 空中↓↘→＋K 空旋脚
        a = A('sp_atatsu', hit=(('toe_l', 12, 'kn_l'), ('toe_r', 12, 'kn_r')), vx=3, flags={'air': True})
        a.k(FALL, 1, 's').k(P(SP1, py=-84), 4, 's', 'snap')
        for i in range(2):
            a.k(P(SP2, py=-84), 3, 'a', 'lin').k(P(SP1, py=-84), 3, 'a', 'lin', hold=1)
        a.k(FALL, 10, 'r', 'out')
        out.append(a)
        # ↓↙←＋P 虚掌破：両掌で押し出す（相手が浮いて追撃できる）
        # 虚掌破（↓↙←＋P）：深く沈み込み、地面すれすれから拳を真上へ突き上げるアッパー（相手を高く浮かせる）
        a = A('sp_palm', hit=(('hand_r', 14, 'el_r'),))
        a.k(G, 1, 's')
        UC0 = P(C, px=-4, py=-36, lean=34, tw=0.95, hd=-18, al=I(34, -80), ar=I(14, -16), hl='fist', hr='fist', ll=I(36, -5), lr=I(-26, -5), fr=50)
        a.k(UC0, 8, 's', 'in', hold=2)
        UC1 = P(G, px=8, py=-56, lean=22, tw=0.45, hd=-8, al=I(26, -88), ar=Fk(70, 60), ll=I(40, -5), lr=I(-22, -5), fr=50)
        a.k(UC1, 2, 's', 'snap', lag=0.25)
        UC = P(G, px=14, py=-70, lean=4, tw=0.15, hd=6, al=I(14, -96), ar=Fk(128, 18), ll=I(42, -5), lr=I(-18, -6), fr=36)
        a.k(UC, 1, 's', 'snap').k(P(UC, ar=Fk(140, 10), lean=0, py=-74), 1, 'a', 'back', hold=3)
        a.k(P(UC, lean=-10, py=-80, hd=14, ar=Fk(168, 4)), 4, 'r', 'out').k(P(UC, lean=-4, py=-72, ar=Fk(150, 30)), 4, 'r', 'io').k(G, 6, 'r')
        out.append(a)
        # EX虚掌破：沈み込みを短くした速いアッパー（どの通常技からでもつながる）
        a = A('ex_palm', hit=(('hand_r', 14, 'el_r'),))
        a.k(G, 1, 's')
        UC0 = P(C, px=-4, py=-36, lean=34, tw=0.95, hd=-18, al=I(34, -80), ar=I(14, -16), hl='fist', hr='fist', ll=I(36, -5), lr=I(-26, -5), fr=50)
        a.k(UC0, 3, 's', 'in')
        UC1 = P(G, px=8, py=-56, lean=22, tw=0.45, hd=-8, al=I(26, -88), ar=Fk(70, 60), ll=I(40, -5), lr=I(-22, -5), fr=50)
        a.k(UC1, 2, 's', 'snap', lag=0.25)
        UC = P(G, px=14, py=-70, lean=4, tw=0.15, hd=6, al=I(14, -96), ar=Fk(128, 18), ll=I(42, -5), lr=I(-18, -6), fr=36)
        a.k(UC, 1, 's', 'snap').k(P(UC, ar=Fk(140, 10), lean=0, py=-74), 1, 'a', 'back', hold=3)
        a.k(P(UC, lean=-10, py=-80, hd=14, ar=Fk(168, 4)), 4, 'r', 'out').k(P(UC, lean=-4, py=-72, ar=Fk(150, 30)), 4, 'r', 'io').k(G, 6, 'r')
        out.append(a)
        # 超必殺3 天地穿：気を溜め、無敵の連続アッパーで天まで突き上げる
        a = A('su_3', hit=(('hand_r', 18, 'el_r'), ('hand_l', 14)), wy=lambda i, n: -7 if i < n * 0.55 else 6)
        a.k(G, 1, 's').k(P(C, py=-40, lean=8, tw=1.0, hd=-6, al=I(-20, -56), ar=I(-28, -50), hl='open', hr='open'), 3, 's', 'in', hold=1)
        a.k(P(DP0, px=10), 2, 's', 'snap')
        for i in range(6):
            a.k(P(DP, px=10, rot=(i % 2) * 8 - 4, tw=0.2 + (i % 2) * 0.6, al=Fk(150 + 20 * (i % 2), 10), ar=Fk(176 - 10 * (i % 2), 4)), 2, 'a', 'snap').k(P(DP, px=10, tw=0.5), 3, 'a', 'lin')
        a.k(P(DP, px=10, lean=-20, hd=24, ar=Fk(178, 0), al=Fk(170, 0)), 4, 'a', 'out', hold=6)
        a.k(P(FALL, lean=4), 16, 'r').k(P(FALL, lean=8), 14, 'r').k(P(C, py=-50, lean=16), 6, 'r', 'out').k(P(G, py=-64), 6, 'r')
        out.append(a)
    else:
        # →＋強P 破頭：頭から突っ込む頭突き
        a = A('f_hp', hit=('head', 14, 'neck'))
        a.k(G, 1, 's').k(P(G, lean=-16, py=-76, hd=18, tw=0.7, al=I(30, -120), ar=I(-20, -116)), 7, 's', 'in')
        HB = P(G, px=16, py=-62, lean=40, hd=-30, tw=0.4, al=I(40, -80), ar=I(0, -80), ll=I(46, -5), lr=I(-12, -5), fr=46)
        a.k(HB, 4, 's', 'snap').k(P(HB, lean=42), 1, 'a', 'back', hold=3)
        a.k(P(HB, lean=26, px=10), 10, 'r', 'out').k(G, 10, 'r')
        out.append(a)
        # →＋中K 圧殺踏（中段）：跳ねて踏みつける
        a = A('f_mk', hit=('toe_l', 13, 'an_l'), flags={'high': True})
        a.k(G, 1, 's').k(P(G, py=-62, lean=16, ll=I(24, -5)), 5, 's', 'in')
        a.k(P(G, py=-92, px=6, lean=-6, ll=Fk(80, 110), fl=60, lr=Fk(-10, 30), al=I(40, -130), ar=I(-30, -126)), 8, 's', 'out')
        ST = P(G, py=-74, px=14, lean=4, ll=Fk(50, 8), fl=100, lr=Fk(-20, 40), al=I(40, -116), ar=I(-30, -110))
        a.k(ST, 4, 's', 'snap').k(P(ST, py=-72), 1, 'a', hold=2)
        a.k(P(G, py=-60, px=12, lean=20, ll=I(40, -5)), 6, 'r', 'out').k(G, 12, 'r')
        out.append(a)
        # ←＋強P 掬い爪：下からすくい上げる対空の爪
        a = A('b_hp', hit=('hand_r', 14, 'el_r'))
        a.k(G, 1, 's').k(P(G, py=-60, lean=24, tw=0.8, ar=I(-20, -30), hd=-14), 4, 's', 'in')
        a.k(P(G, py=-78, lean=-10, tw=0.3, hd=12, ar=Fk(150, 20), hr='claw', ll=I(30, -5)), 4, 's', 'snap', lag=0.3)
        a.k(P(G, py=-80, lean=-14, tw=0.25, hd=16, ar=Fk(176, 6), hr='claw', ll=I(30, -5)), 1, 'a', 'out', hold=4)
        a.k(P(G, py=-74, lean=0, ar=I(30, -130)), 10, 'r', 'out').k(G, 12, 'r')
        out.append(a)
        # ↓↘→＋K 地裂脚：踏みつけて地を這う衝撃波を放つ（下段）
        a = A('sp_wave', flags={'proj': 'toe_l'})
        a.k(G, 1, 's').k(P(G, py=-84, lean=-4, ll=Fk(90, 110), fl=60, al=I(40, -130), ar=I(-40, -126)), 8, 's', 'out', hold=2)
        WV = P(G, py=-58, lean=24, px=8, ll=I(38, -5), lr=I(-18, -5), al=I(46, -70), ar=I(-20, -70), fr=50)
        a.k(WV, 3, 's', 'snap').k(P(WV, py=-56), 1, 'a', hold=3)
        a.k(P(G, py=-64, lean=16), 12, 'r', 'out').k(G, 16, 'r')
        out.append(a)
        # ↓↙←＋P 冥爪連撃：3段まで派生する爪の連撃
        R1 = P(G, px=10, py=-66, lean=24, tw=0.3, ar=I(70, -104), hr='claw', ll=I(40, -5), fr=50)
        a = A('sp_rekka1', hit=('hand_r', 12, 'el_r'), vx=1.5)
        a.k(G, 1, 's').k(P(G, tw=0.9, lean=6, ar=I(-16, -110)), 5, 's', 'in').k(R1, 3, 's', 'snap', lag=0.3).k(P(R1, lean=26), 1, 'a', hold=2)
        a.k(P(R1, lean=18, ar=I(46, -100)), 10, 'r', 'out').k(G, 10, 'r')
        out.append(a)
        R2 = P(G, px=14, py=-68, lean=12, tw=0.55, hd=-4, al=Fk(100, 12), hl='claw', ar=I(20, -96), ll=I(42, -5), fr=60)
        a = A('sp_rekka2', hit=('hand_l', 13, 'el_l'), vx=1.5)
        a.k(R1, 1, 's').k(P(R1, lean=8, tw=0.9, al=I(-10, -96), hl='claw'), 4, 's', 'in').k(R2, 3, 's', 'snap', lag=0.3).k(P(R2, lean=14), 1, 'a', hold=2)
        a.k(P(R2, lean=4), 10, 'r', 'out').k(G, 10, 'r')
        out.append(a)
        R3 = P(G, px=18, py=-60, lean=42, tw=0.4, hd=-24, al=Fk(60, 10), ar=Fk(66, 8), hl='claw', hr='claw', ll=I(50, -5), lr=I(-10, -5), fr=44)
        a = A('sp_rekka3', hit=(('hand_r', 14, 'el_r'), ('hand_l', 13)), vx=2)
        a.k(R2, 1, 's').k(P(G, lean=-20, py=-80, hd=18, al=Fk(176, 25), ar=Fk(188, 25), px=12), 6, 's', 'in', hold=2)
        a.k(R3, 4, 's', 'snap', lag=0.25).k(P(R3, lean=44), 1, 'a', 'back', hold=3)
        a.k(P(R3, lean=30), 12, 'r', 'out').k(G, 14, 'r')
        out.append(a)
        # 空中↓↙←＋K 降魔落：両足から斜めに急降下
        a = A('sp_dive', hit=(('toe_l', 13, 'an_l'), ('toe_r', 12)), flags={'air': True, 'high': True}, wy=8, vx=4)
        a.k(FALL, 1, 's').k(P(TUCK, lean=-10, hd=10), 4, 's', 'in')
        DV = P(FALL, lean=-30, hd=20, ll=Fk(70, 0), lr=Fk(60, 10), fl=60, fr=60, al=I(-20, -140), ar=I(-34, -132))
        a.k(DV, 2, 'a', 'snap').k(P(DV, lean=-32), 1, 'a', hold=30)
        out.append(a)
        # 超必殺3 万象崩：跳び上がり、両拳で大地を砕く（闇の柱が3本）
        a = A('su_3', flags={'pillars': True})
        a.k(G, 1, 's').k(P(C, py=-44, lean=20, tw=1.0), 8, 's', 'in')
        a.k(P(G, py=-104, lean=-14, hd=18, tw=1.0, al=I(40, -176), ar=I(-20, -176), ll=Fk(60, 100), lr=Fk(20, 90), cape=20), 10, 's', 'out', hold=8)
        SL = P(C, lean=48, py=-34, px=10, al=I(62, -6), ar=I(44, -6), hl='fist', hr='fist')
        a.k(SL, 3, 'a', 'snap')
        for i in range(6):
            a.k(P(SL, py=-34 + (i % 2), lean=48 - (i % 2)), 7, 'a')
        a.k(P(C, py=-48, lean=20), 14, 'r', 'out').k(G, 22, 'r')
        out.append(a)
    return out
