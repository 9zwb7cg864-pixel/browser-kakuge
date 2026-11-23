# PixelLabで作った蒼井蓮のドット絵を、ゲームの技（今は弱P〜強K）に差し込む。
# 判定（やられ・攻撃）と関節の位置は今の技のものを1コマ（1/60秒）ずつに広げてそのまま使う。
# 使い方: python3 tools/pl_bake.py   （リポジトリの一番上で）
import json, os, copy
from PIL import Image
SRC = 'design/pixellab/ren'
OUT = 'game/assets/kokuu'
FW, FH, AX, AY = 224, 200, 112, 190
GUARD_H = 146          # 今の絵の背の高さ（足から頭のてっぺんまで）
moves = json.load(open(SRC + '/moves.json'))
meta = json.load(open(OUT + '/anims.json'))
# 構えの絵から、拡大の倍率と足元・体の中心を決める（PixelLabはカメラが動かないので全部の絵で同じ値を使う）
g = Image.open(SRC + '/' + moves['lp']['frames'][0]).convert('RGBA')
x0, y0, x1, y1 = g.getbbox()
S = GUARD_H / (y1 - y0)
CX, FY = (x0 + x1) / 2, y1
def place(p):
    im = Image.open(SRC + '/' + p).convert('RGBA')
    w, h = round(im.width * S), round(im.height * S)
    im = im.resize((w, h), Image.NEAREST)
    cell = Image.new('RGBA', (FW, FH))
    cell.alpha_composite(im, (round(AX - CX * S), round(AY - FY * S))) if False else cell.paste(im, (round(AX - CX * S), round(AY - FY * S)), im)
    return cell
for name, mv in moves.items():
    a = meta['anims'][name]
    old = a['frames']
    ticks = [f for f in old for _ in range(f['d'])]
    assert len(ticks) == len(mv['frames']), (name, len(ticks), len(mv['frames']))
    oph = ''.join(f['ph'] for f in ticks)
    assert oph == mv['phase'], (name, oph, mv['phase'])
    new = []
    for f in ticks:
        n = copy.deepcopy(f); n['d'] = 1; new.append(n)
    a['frames'] = new
    a['file'] = 'kokuu_' + name + '.png'
    sheet = Image.new('RGBA', (FW * len(new), FH))
    for i, p in enumerate(mv['frames']):
        sheet.paste(place(p), (i * FW, 0))
    sheet.save(OUT + '/' + a['file'], optimize=True)
    print(name, len(new), 'コマ')
json.dump(meta, open(OUT + '/anims.json', 'w'), ensure_ascii=False, separators=(',', ':'))
