# 当たり判定を今の絵に合わせる。
#   やられ判定：絵の体を「頭・胴・脚」の3つの帯に分け、それぞれの帯で体の幅に合わせた箱にする。
#               大きく伸びた手足の先には、小さい箱を足す（伸ばした手足は殴られる）。
#   攻撃判定：当たるコマで、実際に描かれている手足の先まで箱を広げる。
#   どちらも前の判定より狭くはしない（届く距離・しゃがみへの当たり方など、遊び心地は変えない）。
# 使い方: python3 tools/fit_boxes.py kokuu   （絵を焼き直したあとに毎回）
import json, sys
import numpy as np
from PIL import Image

kind = sys.argv[1] if len(sys.argv) > 1 else 'kokuu'
P = 'game/assets/%s/' % kind
M = json.load(open(P + 'anims.json'))
AX, AY = M['anchor']
FW, FH = M['frameW'], M['frameH']
LIMB = 12          # 手足の先の箱の大きさ
TIP_OUT = 12       # 体の箱からこれ以上はみ出した手足に箱を足す

def bands(cell):
    ys, xs = np.nonzero(cell)
    if len(ys) < 30: return None
    top, bot = ys.min(), ys.max() + 1
    H = bot - top
    cuts = [top, top + 0.2 * H, top + 0.55 * H, bot]
    out = []
    for k in range(3):
        sel = (ys >= cuts[k]) & (ys < cuts[k + 1])
        if sel.sum() < 5: out.append(None); continue
        bx = xs[sel]
        lo, hi = np.percentile(bx, 6), np.percentile(bx, 94)   # 細く伸びた手足は除いて、体の幅を取る
        out.append([float(lo), float(cuts[k]), float(hi - lo + 1), float(cuts[k + 1] - cuts[k])])
    return out

def to_rel(b):  # セルの座標 → 足元基準の座標
    return [round(float(b[0]) - AX, 1), round(float(b[1]) - AY, 1), round(float(b[2]), 1), round(float(b[3]), 1)]

def tips(cell, body):
    # 体の箱から大きくはみ出した手足の先（前・後ろ、上半分・下半分）に小さい箱
    ys, xs = np.nonzero(cell)
    if not len(ys): return []
    top, bot = ys.min(), ys.max() + 1
    mid = (top + bot) / 2
    front = max(b[0] + b[2] for b in body if b); back = min(b[0] for b in body if b)
    out = []
    for half in (ys < mid, ys >= mid):
        if not half.any(): continue
        hx, hy = xs[half], ys[half]
        i = hx.argmax()
        if hx[i] > front + TIP_OUT: out.append([hx[i] - LIMB, hy[i] - LIMB / 2, LIMB, LIMB])
        j = hx.argmin()
        if hx[j] < back - TIP_OUT: out.append([hx[j], hy[j] - LIMB / 2, LIMB, LIMB])
    return out

def fit_hit(cell, body, hb):
    # 元の攻撃の箱の高さの近く（上下30ドット）で、体より前に出ている手足の先を探して、そこへ箱を動かす
    x, y, w, h = hb
    cx0 = AX + x; cy0 = AY + y
    front = max(b[0] + b[2] for b in body if b)
    ys, xs = np.nonzero(cell)
    low = (y + h) > -30                                 # 足元の攻撃（下段など）は、元の箱の高さの中だけで探す
    pad = 0 if low else 30
    near = (ys >= cy0 - pad) & (ys <= cy0 + h + pad) & (xs > front)
    if near.sum() < 6: return hb                       # 前に出ている手足が無い（体ごと当てる技など）：そのまま
    tx = xs[near].max()                                # 手足の先
    tipsel = near & (xs >= tx - 14)
    ty = (ys[tipsel].min() + ys[tipsel].max()) / 2      # 先の高さ
    nw = max(w, 20); nh = max(h, 16)
    if low: return [round(float(tx) + 2 - nw - AX, 1), round(float(y), 1), round(float(nw), 1), round(float(h), 1)]   # 下段は高さを変えない
    return [round(float(tx) + 2 - nw - AX, 1), round(float(ty) - nh / 2 - AY, 1), round(float(nw), 1), round(float(nh), 1)]

changed = 0
for name, a in M['anims'].items():
    px = np.array(Image.open(P + a['file']).convert('RGBA')).astype(int)
    # 絵に描き込まれた青白いエフェクト（振りの軌跡・衝撃波）は体ではないので除く
    fx = (px[..., 2] > px[..., 0] + 25) & (px[..., 2] > 120)
    sheet = (px[..., 3] > 0) & ~fx
    for i, f in enumerate(a['frames']):
        cell = sheet[:, i * FW:(i + 1) * FW]
        bd = bands(cell)
        if not bd or not all(bd): continue
        hurt = [to_rel(b) for b in bd] + [to_rel(t) for t in tips(cell, bd)]
        # 遊び心地を変えないため、やられ判定は前の判定より狭くしない（頭・胴・脚の箱は前の箱も覆う。前の手足の箱も残す）
        old = f.get('hurt') or []
        for k in range(min(3, len(old))):
            o, n = old[k], hurt[k]
            x0 = min(o[0], n[0]); y0 = min(o[1], n[1]); x1 = max(o[0] + o[2], n[0] + n[2]); y1 = max(o[1] + o[3], n[1] + n[3])
            hurt[k] = [round(x0, 1), round(y0, 1), round(x1 - x0, 1), round(y1 - y0, 1)]
        hurt += [list(o) for o in old[3:]]
        f['hurt'] = hurt
        if f.get('hit'):
            nh = []
            for hb in f['hit']:
                n = fit_hit(cell, bd, hb)
                # 遊び心地を変えないため、前の箱より狭くしない（しゃがみに当たる、密着で当たる、届く距離もそのまま）
                y0 = min(n[1], hb[1]); y1 = max(n[1] + n[3], hb[1] + hb[3])
                x0 = min(n[0], hb[0]); x1 = max(n[0] + n[2], hb[0] + hb[2])   # 届く距離は前より短くしない
                nh.append([round(x0, 1), round(y0, 1), round(x1 - x0, 1), round(y1 - y0, 1)])
            f['hit'] = nh
        changed += 1
json.dump(M, open(P + 'anims.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(kind, changed, 'コマの判定を絵に合わせた')
