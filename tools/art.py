"""
ピクセルアート全身フレーム生成エンジン
------------------------------------------------
・1フレーム = 全身を1枚に描いた画像。パーツ画像の切り貼りではなく、
  ポーズ（関節の位置）から毎フレーム全身をピクセル単位で描き直す。
・筋肉は「高さマップ」で立体を作り、法線から陰影を計算 → パレット量子化。
・輪郭線・内側の重なり線・ネオンのリムライト・発光ライン・外側の発光を
  すべてピクセル単位で処理する。

規格（全キャラ共通）
  フレームサイズ : 224 x 200 px
  足元基準点     : (112, 190)  ※キャラは右向きで描く（左向きは実行時に反転）
  身長           : 約148px（8頭身、頭部約18.5px）
"""
import math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

FW, FH = 224, 200
AX, AY = 112, 190

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], float) / 16.0 - 0.5


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def vdir(a):
    """角度→方向ベクトル。0=真下, 90=前方(+x), 180=真上, -90=後方"""
    r = math.radians(a)
    return np.array([math.sin(r), math.cos(r)])


def ang_of(v):
    return math.degrees(math.atan2(v[0], v[1]))


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_ang(a, b, t):
    d = (b - a + 180) % 360 - 180
    return a + d * t


# ------------------------------------------------------------------
# 骨格（順運動学 + 2関節IK）
# ------------------------------------------------------------------
def ik2(root, target, l1, l2, bend):
    """2関節IK。bend=+1で関節が前(+x側)に出る（膝）、-1で後ろ/下（肘）"""
    d = target - root
    dist = float(np.hypot(*d))
    dist = max(1e-3, min(dist, l1 + l2 - 0.01))
    base = ang_of(d)
    c = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
    c = max(-1, min(1, c))
    off = math.degrees(math.acos(c))
    a1 = base + off * bend
    mid = root + vdir(a1) * l1
    a2 = ang_of((root + vdir(base) * dist) - mid)
    return a1, a2


class Rig:
    def __init__(self, dims):
        self.d = dims

    def solve(self, P):
        """ポーズ辞書 → 関節座標（フレーム座標）"""
        d = self.d
        J = {}
        pel = np.array([AX + P['px'], AY + P['py']], float)
        lean = P['lean']
        u = vdir(180 - lean)                       # 背骨の向き
        p = np.array([math.cos(math.radians(lean)), math.sin(math.radians(lean))])  # 前方の垂線
        mid = pel + vdir(180 - lean * 0.55) * d['abd']
        neck = mid + u * d['chest']
        tw = P['tw']
        J['pelvis'], J['mid'], J['neck'] = pel, mid, neck
        J['u'], J['p'] = u, p
        J['sh_l'] = neck + p * (d['shw'] * tw) + u * (-1.0 - P.get('shrug', 0))
        J['sh_r'] = neck - p * (d['shw'] * tw * 0.85) + u * (-0.5 - P.get('shrug', 0))
        htw = P.get('htw', tw)
        J['hip_l'] = pel + p * (d['hipw'] * htw)
        J['hip_r'] = pel - p * (d['hipw'] * htw)
        ha = 180 - lean - P['hd']
        J['head'] = neck + u * d['neck'] + vdir(ha) * d['headc']
        J['head_ang'] = ha
        # 腕
        for side in ('l', 'r'):
            spec = P['a' + side]
            S = J['sh_' + side]
            if spec[0] == 'ik':
                T = np.array([AX + spec[1], AY + spec[2]], float)
                a1, a2 = ik2(S, T, d['uarm'], d['farm'], -1 if side == 'l' else -1)
                if len(spec) > 3:
                    a1, a2 = ik2(S, T, d['uarm'], d['farm'], spec[3])
            else:
                a1, a2 = spec[1], spec[1] + spec[2]
            E = S + vdir(a1) * d['uarm']
            W = E + vdir(a2) * d['farm']
            J['el_' + side], J['wr_' + side] = E, W
            J['hand_' + side] = W + vdir(a2) * d['hand']
            J['farm_ang_' + side] = a2
            J['uarm_ang_' + side] = a1
        # 脚
        for side in ('l', 'r'):
            spec = P['l' + side]
            H = J['hip_' + side]
            if spec[0] == 'ik':
                T = np.array([AX + spec[1], AY + spec[2]], float)
                bend = spec[3] if len(spec) > 3 else 1
                a1, a2 = ik2(H, T, d['thigh'], d['shin'], bend)
            else:
                a1, a2 = spec[1], spec[1] - spec[2]
            K = H + vdir(a1) * d['thigh']
            A = K + vdir(a2) * d['shin']
            fa = P.get('f' + side, None)
            if fa is None:
                fa = 90.0  # 足先は前方水平
            else:
                fa = fa
            fa_abs = fa if P.get('fabs_' + side, True) else a2 + fa
            T2 = A + vdir(fa_abs) * d['foot']
            J['kn_' + side], J['an_' + side], J['toe_' + side] = K, A, T2
            J['thigh_ang_' + side], J['shin_ang_' + side] = a1, a2
        # 全身の回転（宙返り・きりもみ用）。骨盤の少し上を中心に回す
        rot = P.get('rot', 0.0)
        if rot:
            c = J['pelvis'] + J['u'] * P.get('rotc', 18.0)
            ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))
            R = np.array([[ca, -sa], [sa, ca]])
            for k, v in list(J.items()):
                if isinstance(v, np.ndarray):
                    if k in ('u', 'p'):
                        J[k] = R @ v
                    else:
                        J[k] = c + R @ (v - c)
                elif k.endswith('_ang') or '_ang_' in k:
                    J[k] = v - rot
        return J


# ------------------------------------------------------------------
# ラスタライザ（高さマップ方式）
# ------------------------------------------------------------------
class Canvas:
    def __init__(self, w=FW, h=FH):
        self.w, self.h = w, h
        self.H = np.full((h, w), -1e9, np.float32)
        self.G = np.zeros((h, w), np.int16)        # グループ（輪郭計算用）
        self.M = np.zeros((h, w), np.int16)        # 材質
        self.L = np.zeros((h, w), np.int16)        # 発光ラインID
        self.D = np.ones((h, w), np.float32)       # 奥の手足の暗さ
        self.P = np.zeros((h, w), np.int32)        # パーツID（線画用）
        self.pid = 0
        self.seam_next = True
        self.yy, self.xx = np.mgrid[0:h, 0:w].astype(np.float32)

    def _box(self, x0, y0, x1, y1):
        x0 = max(0, int(math.floor(x0)) - 1); y0 = max(0, int(math.floor(y0)) - 1)
        x1 = min(self.w, int(math.ceil(x1)) + 2); y1 = min(self.h, int(math.ceil(y1)) + 2)
        if x0 >= x1 or y0 >= y1:
            return None
        return (slice(y0, y1), slice(x0, x1))

    def _write(self, sl, inside, h, g, m, dark, lid=None):
        if self.seam_next:
            self.pid += 1
        self.seam_next = True
        Hs = self.H[sl]
        win = inside & (h > Hs)
        Hs[win] = h[win]
        self.P[sl][win] = self.pid
        self.G[sl][win] = g
        self.M[sl][win] = m
        self.D[sl][win] = dark
        if lid is not None:
            Ls = self.L[sl]
            Ls[win] = lid[win]
        else:
            self.L[sl][win] = 0

    def cone(self, a, b, ra, rb, zb, g, m, dark=1.0, lines=(), zs=1.0, fold=0.0, bulge=None):
        a = np.asarray(a, float); b = np.asarray(b, float)
        rmax = max(ra, rb) + (bulge[1] if bulge else 0)
        sl = self._box(min(a[0], b[0]) - rmax, min(a[1], b[1]) - rmax,
                       max(a[0], b[0]) + rmax, max(a[1], b[1]) + rmax)
        if sl is None:
            return
        X = self.xx[sl] + 0.5; Y = self.yy[sl] + 0.5
        ab = b - a
        L2 = float(ab @ ab) + 1e-6
        t = ((X - a[0]) * ab[0] + (Y - a[1]) * ab[1]) / L2
        tc = np.clip(t, 0, 1)
        cx = a[0] + ab[0] * tc; cy = a[1] + ab[1] * tc
        dx = X - cx; dy = Y - cy
        dd = np.sqrt(dx * dx + dy * dy)
        r = ra + (rb - ra) * tc
        if bulge:  # 筋肉のふくらみ (位置t, 追加半径, 幅)
            bt, br, bw = bulge
            r = r + br * np.exp(-((tc - bt) / bw) ** 2)
        if fold:
            r = r + fold * np.sin(tc * 23.0) * 0.6
        inside = dd < r
        h = zb + np.sqrt(np.clip(r * r - dd * dd, 0, None)) * zs
        if fold:
            h = h + fold * np.sin(tc * 31.0 + dx * 0.3)
        lid = None
        if lines:
            ln = math.sqrt(L2)
            nx, ny = -ab[1] / ln, ab[0] / ln
            s = (dx * nx + dy * ny) / np.maximum(r, 1e-3)
            lid = np.zeros_like(inside, np.int16)
            for (so, wpx, t0, t1, cid) in lines:
                sel = (np.abs(s - so) * r < wpx) & (t >= t0) & (t <= t1)
                lid[sel] = cid
        self._write(sl, inside, h, g, m, dark, lid)

    def sphere(self, c, r, zb, g, m, dark=1.0, zs=1.0, sq=1.0):
        c = np.asarray(c, float)
        sl = self._box(c[0] - r, c[1] - r * sq, c[0] + r, c[1] + r * sq)
        if sl is None:
            return
        X = self.xx[sl] + 0.5; Y = self.yy[sl] + 0.5
        dx = X - c[0]; dy = (Y - c[1]) / sq
        dd = np.sqrt(dx * dx + dy * dy)
        inside = dd < r
        h = zb + np.sqrt(np.clip(r * r - dd * dd, 0, None)) * zs
        self._write(sl, inside, h, g, m, dark)

    def ellipse(self, c, rx, ry, ang, zb, g, m, dark=1.0, visor=None, zs=1.0):
        c = np.asarray(c, float)
        R = max(rx, ry)
        sl = self._box(c[0] - R, c[1] - R, c[0] + R, c[1] + R)
        if sl is None:
            return
        X = self.xx[sl] + 0.5 - c[0]; Y = self.yy[sl] + 0.5 - c[1]
        ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        lx = X * ca + Y * sa
        ly = -X * sa + Y * ca
        q = (lx / rx) ** 2 + (ly / ry) ** 2
        inside = q < 1
        h = zb + np.sqrt(np.clip(1 - q, 0, None)) * min(rx, ry) * zs
        lid = None
        if visor:
            lid = np.zeros_like(inside, np.int16)
            for (fn, cid) in visor:
                lid[fn(lx, ly) & inside] = cid
        self._write(sl, inside, h, g, m, dark, lid)

    def poly(self, pts, zb, thick, g, m, dark=1.0, lines_edge=0, edge_px=1.0, fold=0.0, axis=None, glyph=None):
        img = Image.new('L', (self.w * 2, self.h * 2), 0)
        ImageDraw.Draw(img).polygon([(x * 2, y * 2) for x, y in pts], fill=255)
        mk = np.asarray(img.resize((self.w, self.h), Image.BOX), np.float32) / 255.0
        inside = mk > 0.5
        if not inside.any():
            return
        dist = ndimage.distance_transform_edt(inside)
        h = zb + np.minimum(dist, 4.0) / 4.0 * thick
        if fold and axis is not None:
            o, ax = axis
            proj = (self.xx - o[0]) * ax[1] - (self.yy - o[1]) * ax[0]
            h = h + fold * np.sin(proj * 0.55)
        lid = None
        if lines_edge:
            lid = np.zeros(inside.shape, np.int16)
            lid[(dist <= edge_px + 0.5) & inside] = lines_edge
            if glyph is not None:
                gm = glyph(self.xx, self.yy) & inside
                lid[gm] = lines_edge
        sl = (slice(0, self.h), slice(0, self.w))
        self._write(sl, inside, h.astype(np.float32), g, m, dark, lid)

    def merge(self):
        """次に描くパーツを直前のパーツと同じ面として扱う（境目に線を引かない）"""
        self.seam_next = False
        return self

    def stamp_lines(self, mask, cid, groups):
        """既に描かれた面の上に紋章やラインを刻む"""
        sel = mask & np.isin(self.G, groups)
        self.L[sel] = cid


# ------------------------------------------------------------------
# シェーディング → パレット化
# ------------------------------------------------------------------
def shade(cv, pal, light=(-0.45, -0.8, 0.6), dither=0.06, glow=True):
    """参考画像の画風：黒に近い面 + 明るいネオンの線画（外周・重なり・筋肉の境目）"""
    H = cv.H
    mask = H > -1e8
    Hf = np.where(mask, H, 0).astype(np.float32)

    def grad(axis):
        f = np.roll(Hf, -1, axis); b = np.roll(Hf, 1, axis)
        mf = np.roll(mask, -1, axis); mb = np.roll(mask, 1, axis)
        gf = np.roll(cv.P, -1, axis) == cv.P; gb = np.roll(cv.P, 1, axis) == cv.P
        okf = mf & gf; okb = mb & gb
        g = np.where(okf & okb, (f - b) * 0.5, np.where(okf, f - Hf, np.where(okb, Hf - b, 0)))
        return np.clip(g, -3, 3)
    gx = grad(1); gy = grad(0)
    n = np.sqrt(gx * gx + gy * gy + 1)
    Nx, Ny, Nz = -gx / n, -gy / n, 1 / n
    Lx, Ly, Lz = light
    ll = math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz)
    dif = np.clip((Nx * Lx + Ny * Ly + Nz * Lz) / ll, 0, 1)
    v = (0.05 + 0.95 * dif ** 1.2) * cv.D
    v = v + BAYER[np.arange(cv.h)[:, None] % 4, np.arange(cv.w)[None, :] % 4] * dither

    out = np.zeros((cv.h, cv.w, 4), np.uint8)
    for mid, ramp in pal['mats'].items():
        sel = mask & (cv.M == mid)
        if not sel.any():
            continue
        cols = np.array([hexc(c) for c in ramp], np.uint8)
        idx = np.clip((v[sel] * len(ramp)).astype(int), 0, len(ramp) - 1)
        out[sel, :3] = cols[idx]
        out[sel, 3] = 255

    pad = np.pad(mask, 1)
    edge_out = mask & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    # 重なり・パーツ境目の線（奥側＝低い方のピクセルに引く）
    seam_far = np.zeros_like(mask)   # 別グループの重なり（強い線）
    seam_in = np.zeros_like(mask)    # 同グループ内の筋肉・布の境目（細い線）
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        Hn = np.roll(np.roll(Hf, dy, 0), dx, 1)
        Gn = np.roll(np.roll(cv.G, dy, 0), dx, 1)
        Pn = np.roll(np.roll(cv.P, dy, 0), dx, 1)
        Mn = np.roll(np.roll(mask, dy, 0), dx, 1)
        front = mask & Mn & (Hn > Hf + 0.5)
        seam_far |= front & (Gn != cv.G)
        seam_in |= front & (Gn == cv.G) & (Pn != cv.P)
    dk = cv.D < 0.9   # 奥の手足は線も暗く
    def put(sel, key):
        out[sel, :3] = hexc(pal[key])
    put(seam_in & ~dk, 'line_in'); put(seam_in & dk, 'line_far')
    put(seam_far & ~dk, 'line_main'); put(seam_far & dk, 'line_far')
    put(edge_out & ~dk, 'line_main'); put(edge_out & dk, 'line_far2')
    # 光の当たる側の外周はさらに明るく
    hot = edge_out & ~dk & ((Nx > 0.2) | (Ny < -0.4))
    put(hot, 'line_hot')

    lines = (cv.L > 0) & mask
    neon = np.zeros_like(mask)
    for cid, (core, mid) in pal['neon'].items():
        sel = lines & (cv.L == cid)
        if not sel.any():
            continue
        neon |= sel
        out[sel, :3] = hexc(core if cid != 2 or True else mid)
        bleed = ndimage.binary_dilation(sel) & mask & ~sel & ~edge_out & (cv.L == 0) & ~seam_far
        out[bleed, :3] = hexc(mid)

    # 外側にもう1px線を足して、参考画像のような太い線画にする
    ring = ndimage.binary_dilation(mask) & ~mask
    near_far = ndimage.binary_dilation(mask & ~dk) & ring
    out[ring, :3] = hexc(pal['line_far2']); out[ring, 3] = 255
    out[near_far, :3] = hexc(pal['line_main'])
    out[edge_out & ~dk & ~hot, :3] = hexc(pal['line_in'])
    if glow:
        src = (neon | ring | seam_far).astype(np.float32)
        bl = ndimage.gaussian_filter(src, 1.8) * 2.2
        a = np.clip(bl, 0, 1)
        q = np.floor(a * 4) / 4 * 0.5
        gsel = (~mask) & ~ring & (q > 0)
        out[gsel, :3] = np.array(hexc(pal['glow']), np.uint8)
        out[gsel, 3] = (q[gsel] * 255).astype(np.uint8)
    return out


def bbox_of(mask):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
