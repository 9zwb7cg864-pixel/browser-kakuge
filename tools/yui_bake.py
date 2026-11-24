# PixelLabで作った紺野ユイのドット絵を、ゲームの動きに差し込む。
# 判定（やられ・攻撃）と動きの長さは蒼井蓮（kokuu）のものをそのまま使う。
# ユイの絵のコマは、蒼井蓮の動きの長さに合わせて均等に割り当てる。
# 攻撃の絵はまだ無いので、攻撃の動きは仮に「立ち絵」（空中の技は垂直ジャンプの頂点の絵）を出す。
# 使い方: python3 tools/yui_bake.py   （リポジトリの一番上で）
import json, copy
from PIL import Image
SRC = 'design/pixellab/yui'
KMETA = 'game/assets/kokuu/anims.json'
OUT = 'game/assets/yui'
FW, FH, AX, AY = 224, 200, 112, 190
GUARD_H = 146          # 立ち絵の背の高さ（蒼井蓮と同じ）
moves = json.load(open(SRC + '/moves.json'))
meta = json.load(open(KMETA))
g = Image.open(SRC + '/' + moves['idle']['frames'][0]).convert('RGBA')
x0, y0, x1, y1 = g.getbbox()
S = GUARD_H / (y1 - y0)
CX, FY = (x0 + x1) / 2, y1
AIR_ATTACK = {'j_p', 'j_hp', 'j_k', 'j_hk', 'sp_atatsu'}
TOP = moves['jump_up']['frames'][-1]
import numpy as np, math
_cache = {}
# 寝転がる動き：体が横になっているコマは傾きを水平に直し、どのコマも体の一番下を地面にそろえる
LIE = {'down', 'getup', 'ko', 'throw_do'}
def flatten(im):
    a = np.array(im)[..., 3] > 0
    ys, xs = np.nonzero(a)
    if len(xs) < 50 or (xs.max() - xs.min()) < 1.4 * (ys.max() - ys.min()): return im   # 横になっていないコマはそのまま
    x0, y0 = xs.mean(), ys.mean()
    cov = np.cov(np.stack([xs - x0, ys - y0]))
    w, v = np.linalg.eigh(cov); vx, vy = v[:, 1]
    ang = math.degrees(math.atan2(vy, vx))
    if ang > 90: ang -= 180
    if ang < -90: ang += 180
    if abs(ang) < 2: return im
    return im.rotate(ang, resample=Image.NEAREST, expand=True, center=(x0, y0))
def scaled(p):
    if p not in _cache:
        im = Image.open(SRC + '/' + p).convert('RGBA')
        _cache[p] = im.resize((round(im.width * S), round(im.height * S)), Image.NEAREST)
    return _cache[p]
def place(p, f, lie=False):
    im = scaled(p)
    x = round(AX - CX * S)
    hs = f.get('hurt', [])[:3]
    air = hs and max(h[1] + h[3] for h in hs) < -4
    if lie and not air and (name != 'throw_do' or im.getbbox()[3] > FY * S - 14):
        b0 = im.getbbox(); fl = flatten(im); body = fl.crop(fl.getbbox())
        cx = (b0[0] + b0[2]) / 2                             # 横の位置は元の絵の体の真ん中のまま
        cell = Image.new('RGBA', (FW, FH))
        cell.paste(body, (round(x + cx - body.width / 2), AY - body.height), body)   # 体の一番下を地面に（立ち絵の足元と同じ高さ）
        return cell
    if air:      # 空中：判定の真ん中に体の真ん中を合わせる
        b = im.getbbox()
        hc = (min(h[1] for h in hs) + max(h[1] + h[3] for h in hs)) / 2
        y = round(AY + hc - (b[1] + b[3]) / 2)
        y = max(y, 1 - b[1])
    else:                                              # 地上：足元をそろえる
        y = round(AY - FY * S)
    cell = Image.new('RGBA', (FW, FH))
    cell.paste(im, (x, y), im)
    return cell
# ユイだけの技の動き（蒼井蓮には無い）。やられ判定と関節は構えのものを使い、攻撃判定と手の位置はここで決める
def new_anims():
    base = meta['anims']['idle']['frames'][0]
    def fr(ph, hit=None, hand=None):
        f = copy.deepcopy(base); f['d'] = 1; f['ph'] = ph
        if hit: f['hit'] = hit
        if hand: f['j'] = dict(f['j']); f['j']['hand_l'] = list(hand)
        return f
    A = {}
    # 電撃：発生14F・持続6F・硬直22F。体の前（前へキャラ1人分＝幅70、高さ140）と、自分の足元から立ち上がる
    A['sp_shock'] = [fr('s') for _ in range(14)] + [fr('a', [[40, -140, 70, 140], [-35, -140, 70, 140]]) for _ in range(6)] + [fr('r') for _ in range(22)]
    # パワーグラブ：発生7F・つかめるのは3F・空振りの硬直30F
    A['sp_glove'] = [fr('s') for _ in range(7)] + [fr('a') for _ in range(3)] + [fr('r') for _ in range(30)]
    # つかんだあと：手を高く上げて相手を持ち上げ（24F）、前下へ振り下ろして投げる（手が一番低いコマで投げる）
    hand = []
    # 絵に合わせる：手の前で相手を少し持ち上げて構え（〜30F）、振り上げて（31F）前下へ叩きつける（33F）
    for i in range(46):
        if i <= 30: t = i / 30; hand.append((64 - 4 * t, -112 - 28 * t))
        elif i == 31: hand.append((44, -170))
        elif i <= 33: t = (i - 31) / 2; hand.append((44 + 46 * t, -170 + 100 * t))
        else: hand.append((60, -110))
    A['glove_do'] = [fr('-', hand=hand[i]) for i in range(46)]
    # 網：発生8F・持続6F・硬直28F（捕まえる範囲は技データの net.box）。捕まえたら持つ（最大24F）→ 投げる（8F目で放す）
    A['sp_net'] = [fr('s') for _ in range(8)] + [fr('a') for _ in range(6)] + [fr('r') for _ in range(28)]
    A['net_hold'] = [fr('-') for _ in range(24)]
    A['net_throw'] = [fr('-') for _ in range(30)]
    # メカ：発生14Fでメカを放す（そこから這っていく）・全体40F。メカ補充：12Fで1つ増える・全体40F
    A['sp_mech'] = [fr('s') for _ in range(14)] + [fr('a') for _ in range(2)] + [fr('r') for _ in range(14)]
    A['sp_reload'] = [fr('s') for _ in range(12)] + [fr('a') for _ in range(2)] + [fr('r') for _ in range(26)]
    # セグウェイ：8Fで乗って走り出し、走っている18Fだけ体の前に当たり判定（ぶつかる瞬間）、20Fで止まって降りる
    A['sp_segway'] = [fr('s') for _ in range(8)] + [fr('a', [[22, -110, 36, 110]]) for _ in range(18)] + [fr('r') for _ in range(20)]
    for n, frs in A.items():
        meta['anims'][n] = {'file': 'yui_' + n + '.png', 'loop': False, 'frames': frs}
new_anims()
import os
os.makedirs(OUT, exist_ok=True)
for name, a in meta['anims'].items():
    ticks = [f for f in a['frames'] for _ in range(f['d'])]
    if name in moves:
        src = moves[name]['frames']
        pics = [src[k * len(src) // len(ticks)] for k in range(len(ticks))]
        if not a.get('loop') and len(ticks) >= len(src): pics[-1] = src[-1]   # 最後のコマは必ず最後の絵
    else:                                              # 攻撃の絵はまだ無い：仮の絵
        pics = [TOP if name in AIR_ATTACK else moves['idle']['frames'][0]] * len(ticks)
    new = []
    for f in ticks:
        n = copy.deepcopy(f); n['d'] = 1; new.append(n)
    a['frames'] = new
    a['file'] = 'yui_' + name + '.png'
    a.pop('fw', None)   # 蒼井蓮の横に広いセル（中足）はユイには無い。ユイの絵はどれも同じ幅
    a['pl'] = True
    sheet = Image.new('RGBA', (FW * len(new), FH))
    for i, p in enumerate(pics):
        sheet.paste(place(p, new[i], name in LIE), (i * FW, 0))
    sheet.save(OUT + '/' + a['file'], optimize=True)
    print(name, len(new), 'コマ', '（仮）' if name not in moves else '')
json.dump(meta, open(OUT + '/anims.json', 'w'), ensure_ascii=False, separators=(',', ':'))
