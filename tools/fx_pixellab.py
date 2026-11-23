# PixelLabで作ったエフェクトのアニメを、ゲームのエフェクト（game/assets/fx/mv_*.png と fx.json）に並べる
# 斬撃は1種類を反転・回転して3つの向きに使う
import json, os, sys
from PIL import Image
SRC = sys.argv[1] if len(sys.argv) > 1 else 'design/pixellab/fx'
OUT = 'game/assets/fx'
meta = json.load(open(OUT + '/fx.json'))
def frames(k, n=9): return [Image.open(f'{SRC}/fa_{k}/img_{i}.png').convert('RGBA') for i in range(n)]
def sheet(name, fr):
    w, h = fr[0].size; s = Image.new('RGBA', (w * len(fr), h))
    for i, f in enumerate(fr): s.paste(f, (i * w, 0))
    s.save(f'{OUT}/{name}.png', optimize=True); meta[name] = {'file': name + '.png', 'w': w, 'h': h, 'n': len(fr)}
sl = frames('slash')
sheet('mv_slash_up', [f.rotate(90) for f in sl])                       # 下→前→上（昇り）
sheet('mv_slash_h', [f.transpose(Image.FLIP_TOP_BOTTOM) for f in sl])   # 後ろ→上→前（回し蹴り）
sheet('mv_slash_down', [f.rotate(-90).transpose(Image.FLIP_LEFT_RIGHT) for f in sl])   # 上→前→下（振り下ろし）
sheet('mv_swirl', frames('swirl')[:8])
sheet('mv_charge', frames('charge')[:8])
sheet('mv_burst', frames('burst'))
def hollow(f):   # 炎の真ん中の白っぽいところを抜いて、体のまわりだけ光るようにする
    px = f.load()
    for y in range(f.height):
        for x in range(f.width):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) > 170: px[x, y] = (0, 0, 0, 0)
    return f
sheet('mv_aura', [hollow(f) for f in frames('aura')[:8]])
sheet('mv_speed', frames('speed')[:8])
sheet('mv_pillar', frames('pillar'))
sheet('mv_exflare', frames('exflare')[:6])

# 波動（飛び道具）：白い玉の真ん中が当たり判定の中心に来るようにずらして並べる。光の足し算はせず普通に描く
def centered(k):
    fr = [Image.open(f'{SRC}/hb_{k}/img_{i}.png').convert('RGBA') for i in range(1, 9)]
    xs = ys = n = 0
    for f in fr:
        px = f.load()
        for y in range(f.height):
            for x in range(f.width):
                r, g, b, a = px[x, y]
                if a > 200 and min(r, g, b) > 215: xs += x; ys += y; n += 1
    cx, cy = round(xs / n), round(ys / n); w, h = fr[0].size
    W = 2 * max(cx, w - cx); H = 2 * max(cy, h - cy)
    out = []
    for f in fr:
        c = Image.new('RGBA', (W, H)); c.paste(f, (W // 2 - cx, H // 2 - cy)); out.append(c)
    return out
sheet('ball_k', centered('an')); meta['ball_k']['blend'] = 'normal'
sheet('ball_k_ex', centered('ae')); meta['ball_k_ex']['blend'] = 'normal'

# パリィ：体の前の光の膜（ループ）と、ジャストパリィの閃光。閃光の後半に紛れ込んだ小さな人影（青白以外の色）は消す
sheet('parry', [Image.open(f'{SRC}/py_ab/img_{i}.png').convert('RGBA') for i in range(1, 9)])
def bluewhite(f):
    px = f.load()
    for y in range(f.height):
        for x in range(f.width):
            r, g, b, a = px[x, y]
            if a and (r > b + 10 or max(r, g, b) < 90): px[x, y] = (0, 0, 0, 0)
    return f
sheet('jparry', [bluewhite(Image.open(f'{SRC}/py_aj/img_{i}.png').convert('RGBA')) for i in range(0, 6)])
json.dump(meta, open(OUT + '/fx.json', 'w'), ensure_ascii=False)
print('ok')
