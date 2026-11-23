# PixelLabで作った蒼井蓮のドット絵を、ゲームの動きに差し込む。
# design/pixellab/ren/moves.json に「動きの名前 → 1/60秒ごとの絵」が書いてある。
# 判定（やられ・攻撃）と関節の位置は今の動きのものを1コマ（1/60秒）ずつに広げてそのまま使う。
# 足が地面に着いているコマは足元をそろえ、空中のコマは今のやられ判定の真ん中に体の真ん中を合わせる。
# 使い方: python3 tools/pl_bake.py   （リポジトリの一番上で）
import json, copy
from PIL import Image
SRC = 'design/pixellab/ren'
OUT = 'game/assets/kokuu'
FW, FH, AX, AY = 224, 200, 112, 190
GUARD_H = 146          # 今の絵の背の高さ（足から頭のてっぺんまで）
moves = json.load(open(SRC + '/moves.json'))
meta = json.load(open(OUT + '/anims.json'))
g = Image.open(SRC + '/' + moves['lp']['frames'][0]).convert('RGBA')
x0, y0, x1, y1 = g.getbbox()
S = GUARD_H / (y1 - y0)
CX, FY = (x0 + x1) / 2, y1
_cache = {}
def scaled(p):
    if p not in _cache:
        im = Image.open(SRC + '/' + p).convert('RGBA')
        _cache[p] = im.resize((round(im.width * S), round(im.height * S)), Image.NEAREST)
    return _cache[p]
def place(p, f):
    im = scaled(p)
    x = round(AX - CX * S)
    hs = f.get('hurt', [])[:3]
    if hs and max(h[1] + h[3] for h in hs) < -4:      # 空中：判定の真ん中に体の真ん中を合わせる
        b = im.getbbox()
        hc = (min(h[1] for h in hs) + max(h[1] + h[3] for h in hs)) / 2
        y = round(AY + hc - (b[1] + b[3]) / 2)
        y = max(y, 1 - b[1])                           # 頭が絵の枠の上で切れないように
    else:                                              # 地上：足元をそろえる
        y = round(AY - FY * S)
    cell = Image.new('RGBA', (FW, FH))
    cell.paste(im, (x, y), im)
    return cell
for name, mv in moves.items():
    a = meta['anims'][name]
    ticks = [f for f in a['frames'] for _ in range(f['d'])]
    if a.get('loop') and len(ticks) != len(mv['frames']):   # くり返す動きは長さを変えてよい（判定は割合で対応させる）
        ticks = [ticks[k * len(ticks) // len(mv['frames'])] for k in range(len(mv['frames']))]
    assert len(ticks) == len(mv['frames']), (name, len(ticks), len(mv['frames']))
    if 'phase' in mv:
        assert ''.join(f['ph'] for f in ticks) == mv['phase'], name
    new = []
    for f in ticks:
        n = copy.deepcopy(f); n['d'] = 1; new.append(n)
    a['frames'] = new
    a['file'] = 'kokuu_' + name + '.png'
    a['pl'] = True     # PixelLabの絵（2Pの色違いの作り方が違う）
    sheet = Image.new('RGBA', (FW * len(new), FH))
    for i, p in enumerate(mv['frames']):
        sheet.paste(place(p, new[i]), (i * FW, 0))
    sheet.save(OUT + '/' + a['file'], optimize=True)
    print(name, len(new), 'コマ')
json.dump(meta, open(OUT + '/anims.json', 'w'), ensure_ascii=False, separators=(',', ':'))
