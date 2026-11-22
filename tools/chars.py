"""
キャラクター仕様（体格・パレット・衣装）  ※参考画像 docs/reference.png に準拠
  1P 虚空の継承者 (kokuu)  : シアンネオン線画 / ヘルメット状の頭と光るバイザー / 肩当て /
                             太いベルト / 膝でふくらむズボン / ゴツいブーツ / 腰から流れる長い布
  2P 終焉の支配者 (shuuen) : マゼンタネオン線画 / 棘の肩当て・襟 / 後頭部の角 / 重い籠手 /
                             裂けた長い外套 / 一回り大きい体格
"""
import math
import numpy as np
from art import Canvas, Rig, shade, vdir, AX, AY, FW, FH

G_ARM_FAR, G_LEG_FAR, G_COAT_BACK, G_TORSO, G_HEAD, G_LEG_NEAR, G_CLOTH, G_ARM_NEAR, G_ARMOR = 1, 2, 3, 4, 5, 6, 7, 8, 9
M_SKIN, M_PANTS, M_BOOT, M_METAL, M_HEAD, M_CLOTH, M_ARMOR, M_COAT = 1, 2, 3, 4, 5, 6, 7, 8

DIMS = dict(abd=21, chest=24, shw=21, hipw=7, neck=5, headc=9.5,
            uarm=29, farm=26, hand=4.5, thigh=37, shin=36, foot=11)

PALETTES = {
    'kokuu': {
        'line_main': '#38d6ff', 'line_hot': '#c4f8ff', 'line_in': '#1a8fd6',
        'line_far': '#0d4f8a', 'line_far2': '#1670b4', 'glow': '#00b0ff',
        'neon': {1: ('#aef4ff', '#1a8fd6'), 2: ('#5fe2ff', '#0f5f9e'), 3: ('#ffffff', '#7fefff')},
        'mats': {
            M_SKIN: ['#03060c', '#07101e', '#0c1a2f', '#132845', '#1c3a62'],
            M_PANTS: ['#020409', '#050913', '#08101e', '#0c172a', '#122038'],
            M_BOOT: ['#020409', '#060b16', '#0b1526', '#132238'],
            M_METAL: ['#0f2a4a', '#1e5a90', '#4aa8e0', '#c4f2ff'],
            M_HEAD: ['#020409', '#060b16', '#0b1526', '#122038', '#1c3152'],
            M_CLOTH: ['#03070e', '#071020', '#0c1a30', '#122640'],
            M_ARMOR: ['#040a14', '#0a1628', '#12243e', '#1c3656', '#2a4e78'],
            M_COAT: ['#061633', '#0a2552', '#0f3876', '#16509e', '#1f6cc4', '#3a8fe0'],
        },
    },
    'shuuen': {
        'line_main': '#ff3fe6', 'line_hot': '#ffd0fa', 'line_in': '#c21cc0',
        'line_far': '#6e1078', 'line_far2': '#9a1aa4', 'glow': '#ff1fd2',
        'neon': {1: ('#ffc2fa', '#c21cc0'), 2: ('#ff6af0', '#7a1286'), 3: ('#ffffff', '#ff8af4')},
        'mats': {
            M_SKIN: ['#060209', '#0e0614', '#170a21', '#221030', '#311846'],
            M_PANTS: ['#050208', '#0a040f', '#110718', '#190b23', '#22102f'],
            M_BOOT: ['#040106', '#0b0510', '#140a1c', '#1f102c'],
            M_METAL: ['#3a1040', '#7a2286', '#d050d8', '#ffd6fb'],
            M_HEAD: ['#040106', '#0b0510', '#140a1c', '#1f102c', '#2e1840'],
            M_CLOTH: ['#060209', '#0e0614', '#170a20', '#21102e'],
            M_ARMOR: ['#0a040e', '#160a1e', '#24112e', '#351a44', '#4c265e'],
            M_COAT: ['#1a0526', '#2e0a44', '#481066', '#68168e', '#8c20b4', '#b23ad6'],
        },
    },
}


def seg_mask(cv, a, b, w):
    a = np.asarray(a, float); b = np.asarray(b, float)
    X = cv.xx + 0.5; Y = cv.yy + 0.5
    ab = b - a
    L2 = float(ab @ ab) + 1e-6
    t = np.clip(((X - a[0]) * ab[0] + (Y - a[1]) * ab[1]) / L2, 0, 1)
    dx = X - (a[0] + ab[0] * t); dy = Y - (a[1] + ab[1] * t)
    return dx * dx + dy * dy < w * w


def ring_mask(cv, c, r, w):
    X = cv.xx + 0.5 - c[0]; Y = cv.yy + 0.5 - c[1]
    return np.abs(np.sqrt(X * X + Y * Y) - r) < w


def flap_poly(top_a, top_b, ang, length, w_bot, bend=0.0, segs=5, tatter=0, tat_len=7, wave=0.0, phase=0.0):
    """布の多角形。上辺から角度angで垂れ、bendで曲がり、waveでなびく。tatterで裾が裂ける"""
    ta, tb = np.asarray(top_a, float), np.asarray(top_b, float)
    w_top = float(np.hypot(*(tb - ta)))
    perp_top = (tb - ta) / max(w_top, 1e-3)
    a = ang
    cur = (ta + tb) / 2
    cen = [cur.copy()]
    for i in range(segs):
        t = (i + 1) / segs
        a = ang + bend * t + wave * math.sin(phase + t * 3.2) * t
        cur = cur + vdir(a) * (length / segs)
        cen.append(cur.copy())
    left, right = [ta], [tb]
    for i in range(1, len(cen)):
        t = i / segs
        w = w_top + (w_bot - w_top) * t
        d = cen[i] - cen[i - 1]
        nrm = np.array([-d[1], d[0]]) / max(np.hypot(*d), 1e-3)
        if nrm @ perp_top < 0:
            nrm = -nrm
        left.append(cen[i] - nrm * w / 2); right.append(cen[i] + nrm * w / 2)
    bottom = []
    if tatter:
        L, R = left[-1], right[-1]
        dn = vdir(a)
        n = tatter * 2
        for k in range(1, n):
            p = L + (R - L) * (k / n)
            if k % 2 == 1:
                p = p + dn * (tat_len * (0.6 + 0.4 * math.sin(k * 2.3 + phase)))
            bottom.append(p)
    return [tuple(p) for p in left] + [tuple(p) for p in bottom] + [tuple(p) for p in reversed(right)]


def draw_arm(cv, J, side, zb, g, dark, P, kind):
    S, E, W, Hd = J['sh_' + side], J['el_' + side], J['wr_' + side], J['hand_' + side]
    big = 1.1 if kind == 'shuuen' else 1.0
    fa = J['farm_ang_' + side]
    cv.sphere(S + J['u'] * -1.5, 6.4 * big, zb + 1, g, M_SKIN, dark)                       # 三角筋
    cv.cone(S, E, 5.6 * big, 4.2 * big, zb, g, M_SKIN, dark, bulge=(0.4, 1.1, 0.26),
            lines=[(0.55, 0.55, 0.15, 0.85, 2)])      # 上腕
    if kind == 'shuuen':
        cv.cone(E + (W - E) * 0.05, W, 5.4, 6.0, zb + 1.5, g, M_ARMOR, dark,
                lines=[(0.0, 0.7, 0.45, 0.95, 2)])                                          # 籠手
        cv.cone(E + (W - E) * 0.35, E + (W - E) * 0.5, 6.2, 6.2, zb + 2, g, M_ARMOR, dark)
    else:
        cv.cone(E, W, 4.7, 3.6, zb, g, M_SKIN, dark, bulge=(0.22, 0.8, 0.25), lines=[(-0.5, 0.5, 0.1, 0.6, 2)])  # 前腕
        cv.cone(W + (E - W) * 0.32, W, 4.1, 3.9, zb + 1, g, M_CLOTH, dark,
                lines=[(0.0, 0.6, 0.15, 0.4, 2)])                                           # 手甲の巻き布
    hs = P.get('h' + side, 'fist')
    hm = M_ARMOR if kind == 'shuuen' else M_SKIN
    if hs == 'open':
        cv.cone(W, Hd + vdir(fa) * 3.5, 4.4, 3.2, zb + 2, g, hm, dark)
        cv.merge().cone(Hd, Hd + vdir(fa - 65) * 5, 1.7, 1.3, zb + 2.5, g, hm, dark)
    elif hs == 'claw':
        cv.sphere(Hd, 5.0 * big, zb + 2, g, hm, dark)
        for k in (-35, 0, 35):
            cv.cone(Hd, Hd + vdir(fa + k) * 7, 1.9, 0.8, zb + 3, g, M_METAL if kind == 'shuuen' else M_SKIN, dark)
    else:
        cv.sphere(Hd, 4.3 * big, zb + 2, g, hm, dark, sq=0.92)


def draw_leg(cv, J, side, zb, g, dark, kind):
    H, K, A, T = J['hip_' + side], J['kn_' + side], J['an_' + side], J['toe_' + side]
    big = 1.08 if kind == 'shuuen' else 1.0
    bt = K + (A - K) * 0.5          # ブーツの上端
    cv.cone(H, K, 8.8 * big, 8.4 * big, zb, g, M_PANTS, dark, bulge=(0.7, 1.4, 0.3),
            lines=[(0.35, 0.5, 0.25, 0.7, 2), (-0.6, 0.5, 0.5, 0.95, 2)])   # 膝でふくらむズボン
    cv.cone(K, bt, 8.8 * big, 7.4 * big, zb + 0.6, g, M_PANTS, dark, lines=[(0.4, 0.5, 0.2, 0.8, 2)])
    cv.cone(bt + (K - bt) * 0.25, bt, 8.0 * big, 7.8 * big, zb + 1.6, g, M_PANTS, dark)  # 裾のたるみ
    cv.cone(bt, A, 6.3 * big, 5.8 * big, zb + 1.8, g, M_BOOT, dark,
            lines=[(0.0, 0.7, 0.35, 0.42, 2), (0.0, 0.7, 0.72, 0.79, 2)])                 # ブーツ（ベルト2本）
    cv.sphere(A + np.array([-2.5, 2.2]), 5.6 * big, zb + 2, g, M_BOOT, dark)
    cv.merge().cone(A + np.array([-1, 2.6]), T + np.array([0, 0.6]), 5.4 * big, 3.9 * big, zb + 2.2, g, M_BOOT, dark)
    d = T - A
    cv.cone(A + np.array([-6, 6.4]), T + np.array([1.5, 2.6]) + d * 0.08, 2.0, 2.0, zb + 4, g, M_ARMOR, dark,
            lines=[(0.0, 0.5, 0.0, 1.0, 2)])                                              # 靴底


def build(kind, J, P):
    cv = Canvas()
    u, p = J['u'], J['p']
    tw = P['tw']
    far_dark = 0.62
    big = 1.1 if kind == 'shuuen' else 1.0
    t_anim = P.get('_t', 0.0)
    vx = P.get('_vx', 0.0)
    pel, mid, neck = J['pelvis'], J['mid'], J['neck']

    # ---- 背面の長い布（腰の後ろから足首まで流れる）----
    drag = max(-35, min(35, -vx * 6))
    if kind == 'kokuu':
        ta = pel - p * 9 + u * 6
        tb = pel - p * 1 + u * 6
        ang = -14 + drag + P.get('cape', 0)
        poly = flap_poly(ta, tb, ang, 78, 30, bend=-18 + P.get('capeb', 0), segs=6, tatter=4, tat_len=8,
                         wave=6, phase=t_anim * 2.0)
        cv.poly(poly, -6, 4, G_COAT_BACK, M_COAT, 0.85, lines_edge=2, edge_px=0.7, fold=1.6, axis=(pel, vdir(ang)))
    else:
        for k, (off, ln, wb, ph) in enumerate(((-11, 86, 40, 0.0), (-3, 80, 30, 1.7))):
            ta = pel + p * (off - 4) + u * 6
            tb = pel + p * (off + 6) + u * 6
            ang = -16 + drag + P.get('cape', 0) - k * 4
            poly = flap_poly(ta, tb, ang, ln, wb, bend=-16 + P.get('capeb', 0), segs=6, tatter=4, tat_len=10,
                             wave=5, phase=t_anim * 1.6 + ph)
            cv.poly(poly, -6 + k, 4, G_COAT_BACK, M_COAT, 0.8 + 0.1 * k, lines_edge=2, edge_px=0.7, fold=1.6,
                    axis=(pel, vdir(ang)))

    # ---- 奥側の脚と腕 ----
    draw_leg(cv, J, 'l', 0, G_LEG_FAR, far_dark, kind)
    draw_arm(cv, J, 'l', 0, G_ARM_FAR, far_dark, P, kind)

    # ---- 胴体（逆三角形）----
    zt = 10
    cv.cone(J['hip_l'] + u * 3, J['hip_r'] + u * 3, 8.6 * big, 8.6 * big, zt - 2, G_TORSO, M_PANTS, 1.0)
    cv.cone(pel + u * 4, mid, 7.8 * big, 9.0 * big, zt, G_TORSO, M_SKIN, 1.0)
    cv.cone(mid - u * 3, J['sh_r'], 7.4 * big, 8.4 * big, zt - 1, G_TORSO, M_SKIN, 1.0)
    cv.cone(mid - u * 3, J['sh_l'], 7.0 * big, 8.0 * big, zt - 2, G_TORSO, M_SKIN, 1.0)
    chest_c = neck - u * 9
    cv.sphere(chest_c - p * 1, 11.2 * big, zt, G_TORSO, M_SKIN, 1.0, zs=0.8)
    pec_l = neck - u * 8 + p * (7.5 * tw + 2)
    pec_r = neck - u * 8 - p * (7.0 * tw)
    cv.sphere(pec_r, 7.4 * big, zt + 3.5, G_TORSO, M_SKIN, 1.0, sq=0.82)
    cv.sphere(pec_l, 6.8 * big, zt + 3.2, G_TORSO, M_SKIN, 1.0, sq=0.82)
    for i in range(3):
        c = pel + (neck - pel) * (0.2 + i * 0.13) + p * (3.5 * tw + 1)
        for s in (-1, 1):
            cv.sphere(c + p * (2.8 * s), 3.0, zt + 6.6 - i * 0.3, G_TORSO, M_SKIN, 1.0, sq=0.78)
    cv.cone(neck - u * 3, neck + u * 5, 6.2 * big, 3.6, zt + 1, G_TORSO, M_SKIN, 1.0)
    cv.cone(J['sh_r'] + u * 2.5, neck + u * 3, 5.2 * big, 3.8, zt + 1, G_TORSO, M_SKIN, 1.0)

    if kind == 'kokuu':
        Y_c = neck - u * 13 + p * (3 * tw)
        m = seg_mask(cv, J['sh_r'] - u * 2, pel + u * 9 + p * 8, 0.7)
        m |= seg_mask(cv, Y_c, Y_c - u * 15, 0.55)
        m |= seg_mask(cv, Y_c, pec_l + p * 4 + u * 2, 0.55)
        cv.stamp_lines(m, 2, [G_TORSO])
        cv.stamp_lines(ring_mask(cv, Y_c + u * 1, 2.3, 0.7), 3, [G_TORSO])
    else:
        c = neck - u * 13 + p * (3 * tw)
        m = seg_mask(cv, c - u * 4, c + u * 4 + p * 7, 0.6) | seg_mask(cv, c - u * 4, c + u * 4 - p * 7, 0.6)
        m |= seg_mask(cv, c + u * 4 + p * 7, c + u * 4 - p * 7, 0.55)
        m |= seg_mask(cv, c - u * 4, mid - u * 6, 0.55)
        cv.stamp_lines(m, 2, [G_TORSO])
        cv.stamp_lines(ring_mask(cv, c + u * 1, 2.0, 0.7), 3, [G_TORSO])

    bl = J['hip_l'] + u * 8 + p * 4
    br = J['hip_r'] + u * 8 - p * 4
    cv.cone(br, bl, 4.6 * big, 4.6 * big, zt + 9, G_TORSO, M_CLOTH, 1.0)
    buckle = pel + u * 8 + p * (5 * tw + 2)
    cv.cone(buckle - p * 3.5, buckle + p * 3.5, 3.6, 3.6, zt + 13, G_TORSO, M_METAL, 1.0)
    cv.stamp_lines(ring_mask(cv, buckle, 1.6, 0.5), 2, [G_TORSO])

    # ---- 頭 ----
    ha = J['head_ang']
    tilt = 180 - ha
    if kind == 'kokuu':
        visor = [(lambda lx, ly: (lx > -2.5) & (np.abs(ly + 0.8) < 1.5), 3),
                 (lambda lx, ly: (np.abs(lx + 1.0) < 0.5) & (ly < -3.5) & (ly > -9), 2)]
    else:
        visor = [(lambda lx, ly: (lx > -1.5) & (np.abs(ly + 0.6 - (lx + 1.5) * 0.38) < 1.1), 3),
                 (lambda lx, ly: (lx > -1.5) & (np.abs(ly + 0.6 + (lx + 1.5) * 0.38) < 0.9), 3),
                 (lambda lx, ly: (np.abs(ly + 5.6 + lx * 0.25) < 0.5) & (lx > -6) & (lx < 3), 2)]
    cv.ellipse(J['head'], 7.4, 9.0, tilt, zt + 4, G_HEAD, M_HEAD, 1.0, visor=visor)
    if kind == 'shuuen':
        hd = J['head']; up = vdir(ha); fw = vdir(ha - 90)
        for k, (l, a) in enumerate(((11, 40), (8, 70))):
            base = hd - fw * 4 + up * (4 - k * 4)
            cv.cone(base, base + vdir(ha + a) * l, 2.8, 0.6, zt + 2, G_HEAD, M_ARMOR, 1.0,
                    lines=[(0.0, 0.4, 0.4, 1.0, 2)])

    # ---- 手前側の脚 ----
    draw_leg(cv, J, 'r', 8, G_LEG_NEAR, 1.0, kind)

    hip = J['hip_r']
    ta = hip + u * 6 - p * 5
    tb = hip + u * 6 + p * 6
    ang = J['thigh_ang_r'] * 0.6 + drag * 0.4
    if kind == 'kokuu':
        poly = flap_poly(ta, tb, ang, 60, 15, bend=-8, segs=5, tatter=3, tat_len=6, wave=3, phase=t_anim * 2.5)
        cv.poly(poly, 20, 3, G_CLOTH, M_COAT, 0.9, lines_edge=2, edge_px=0.7, fold=1.0, axis=(hip, vdir(ang)))
    else:
        poly = flap_poly(ta - p * 2, tb + p * 2, ang, 52, 20, bend=-10, segs=5, tatter=3, tat_len=7, wave=3,
                         phase=t_anim * 2.0)
        cv.poly(poly, 20, 4, G_CLOTH, M_COAT, 0.85, lines_edge=2, edge_px=0.7, fold=1.2, axis=(hip, vdir(ang)))

    # ---- 手前側の腕 ----
    draw_arm(cv, J, 'r', 24, G_ARM_NEAR, 1.0, P, kind)

    # ---- 肩当て ----
    for side, zz, dk, grp in (('l', 3, far_dark, G_ARM_FAR), ('r', 30, 1.0, G_ARMOR)):
        S = J['sh_' + side]
        ua = J['uarm_ang_' + side]
        if kind == 'kokuu':
            cv.sphere(S - u * 2.5, 6.8, zz, grp, M_ARMOR, dk, sq=0.75)
            for (l, a) in ((7, ua + 160), (5, ua + 130)):
                base = S - u * 3 + vdir(a) * 4
                cv.cone(base, base + vdir(a) * l, 2.2, 0.5, zz + 1, grp, M_ARMOR, dk)
        else:
            cv.sphere(S - u * 2, 8.6, zz, grp, M_ARMOR, dk, sq=0.78)
            for (l, a) in ((15, ua + 155), (12, ua + 120), (10, ua + 195)):
                base = S - u * 2 + vdir(a) * 5
                cv.cone(base, base + vdir(a) * l, 3.4, 0.5, zz + 2, grp, M_ARMOR, dk,
                        lines=[(0.5, 0.5, 0.35, 1.0, 1)])
    if kind == 'shuuen':
        for a in (-35, -10, 18):
            base = neck + u * 1 - p * 2
            cv.cone(base, base + vdir(180 - P['lean'] + a) * 10, 2.5, 0.5, zt + 3, G_TORSO, M_ARMOR, 1.0,
                    lines=[(0.0, 0.4, 0.5, 1.0, 1)])
    return cv


def render(kind, pose, rig=None):
    rig = rig or Rig(DIMS)
    J = rig.solve(pose)
    cv = build(kind, J, pose)
    img = shade(cv, PALETTES[kind])
    return img, J, cv
