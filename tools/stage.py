"""
ステージ「ネオン繁華街・雨夜」 ピクセルアート生成
  内部解像度 640x360 / 世界の幅 1024px / 地面の線 y=300
  レイヤー: sky(固定) far(視差0.25) mid(視差0.6) floor(視差1.0)
  看板の点滅・雨・反射は実行時に描く（signs.json に看板の位置と色を出力）
"""
import json, math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'game', 'assets', 'stage')
os.makedirs(OUT, exist_ok=True)
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
R = random.Random(7)
GROUND = 300
NEON = {'c': (40, 220, 255), 'm': (255, 50, 220), 'y': (255, 210, 60), 'r': (255, 60, 90), 'g': (60, 255, 170), 'v': (150, 90, 255)}


def font(sz):
    return ImageFont.truetype(FONT, sz, index=0)


def glow(img, radius, strength=1.0):
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), np.float32) * strength
    return a


def quant(arr, levels=6):
    return (np.floor(arr / 255 * levels) / levels * 255).clip(0, 255)


def sky():
    w, h = 640, 360
    y = np.linspace(0, 1, h)[:, None]
    top = np.array([4, 3, 14]); mid = np.array([22, 9, 40]); hor = np.array([48, 16, 64])
    c = np.where(y < 0.6, top + (mid - top) * (y / 0.6), mid + (hor - mid) * ((y - 0.6) / 0.4))
    img = np.repeat(c[:, None, :], w, 1).reshape(h, w, 3)
    # スモッグの帯（ディザ）
    yy, xx = np.mgrid[0:h, 0:w]
    bay = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0)[yy % 4, xx % 4]
    band = np.exp(-((yy - 210) / 40.0) ** 2) * (0.5 + 0.5 * np.sin(xx / 37.0 + yy / 23.0))
    img = img + (band > bay)[..., None] * np.array([14, 6, 24])
    # 月のにじみ
    d = np.sqrt((xx - 480) ** 2 + (yy - 70) ** 2)
    img = img + (np.exp(-(d / 60) ** 2) * 30)[..., None] * np.array([0.6, 0.4, 1.0])
    img[(d < 14)] = [120, 90, 170]
    img[(d < 12)] = [170, 140, 210]
    return Image.fromarray(img.clip(0, 255).astype(np.uint8))


def building_layer(w, h, n, col, win_cols, depth, seed, signs_out=None, big_signs=False):
    rnd = random.Random(seed)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = -10
    lights = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lights)
    while x < w:
        bw = rnd.randint(40, 110) if not big_signs else rnd.randint(70, 150)
        bh = rnd.randint(int(h * 0.35), int(h * (0.72 if big_signs else 0.95)))
        top = h - bh
        c = tuple(int(v * rnd.uniform(0.85, 1.15)) for v in col)
        d.rectangle((x, top, x + bw, h), fill=c + (255,))
        # 屋上の構造物・アンテナ
        if rnd.random() < 0.6:
            aw = rnd.randint(6, 20)
            ax = x + rnd.randint(4, max(5, bw - aw - 4))
            d.rectangle((ax, top - rnd.randint(6, 18), ax + aw, top), fill=c + (255,))
        if rnd.random() < 0.5:
            ax = x + rnd.randint(5, bw - 5)
            ah = rnd.randint(14, 40)
            d.line((ax, top - ah, ax, top), fill=c + (255,))
            ld.point((ax, top - ah), fill=NEON['r'] + (255,))
        # 輪郭のハイライト（左端）
        d.line((x, top, x, h), fill=tuple(min(255, v + 18) for v in c) + (255,))
        # 窓
        ww, wh, gx, gy = (2, 2, 5, 6) if depth == 0 else (3, 3, 7, 8)
        for wy in range(top + 6, h - 4, gy):
            for wx in range(x + 4, x + bw - 4, gx):
                r = rnd.random()
                if r < (0.07 if big_signs else 0.2):
                    wc = rnd.choice(win_cols)
                    ld.rectangle((wx, wy, wx + ww - 1, wy + wh - 1), fill=wc + (255,))
                elif r < (0.12 if big_signs else 0.3):
                    ld.rectangle((wx, wy, wx + ww - 1, wy + wh - 1), fill=tuple(int(v * 1.6) for v in c) + (255,))
        x += bw + rnd.randint(-6, 10)
    img.alpha_composite(lights)
    return img


SIGN_TEXT = ['電脳街', '夜市', 'ネオン堂', '虚空', '終焉通', '24H', '酒', '拉麺', '機巧', 'ホテル', '輪廻', '零']


def mid_layer():
    w, h = 1200, 300
    img = building_layer(w, h, 0, (10, 9, 24), [NEON['y'], NEON['c'], NEON['m'], (255, 150, 90)], 1, 21, big_signs=True)
    glowl = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glowl)
    d = ImageDraw.Draw(img)
    signs = []
    rnd = random.Random(99)
    x = 30
    i = 0
    while x < w - 40:
        txt = SIGN_TEXT[i % len(SIGN_TEXT)]; i += 1
        cname = rnd.choice(['c', 'm', 'y', 'r', 'g', 'v', 'm', 'c'])
        col = NEON[cname]
        vertical = rnd.random() < 0.6 and len(txt) > 1
        fs = rnd.choice([14, 16, 18])
        f = font(fs)
        if vertical:
            sw, sh = fs + 10, len(txt) * (fs + 2) + 10
        else:
            sw, sh = len(txt) * (fs + 1) + 14, fs + 12
        sy = rnd.randint(110, 200)
        box = (x, sy, x + sw, sy + sh)
        d.rectangle(box, fill=(8, 6, 16, 255))
        gd.rectangle(box, outline=col + (255,), width=1)
        d.rectangle(box, outline=tuple(v // 2 for v in col) + (255,))
        tl = Image.new('L', (sw, sh), 0)
        td = ImageDraw.Draw(tl)
        td.fontmode = '1'
        if vertical:
            for k, ch in enumerate(txt):
                td.text((5, 4 + k * (fs + 2)), ch, font=f, fill=255)
        else:
            td.text((7, 2), txt, font=f, fill=255)
        textc = Image.new('RGBA', (sw, sh), col + (255,))
        img.paste(textc, (x, sy), tl)
        gd.bitmap((x, sy), tl, fill=col + (255,))
        signs.append({'x': x, 'y': sy, 'w': sw, 'h': sh, 'c': col, 'f': round(rnd.uniform(0.2, 1.0), 2)})
        # 支柱
        d.line((x + sw // 2, sy + sh, x + sw // 2, sy + sh + 8), fill=(20, 18, 34, 255))
        x += sw + rnd.randint(40, 110)
    # 路面店の明かり（地面すぐ上の帯）
    for sx in range(0, w, 96):
        c = rnd.choice([NEON['y'], NEON['c'], NEON['m'], (255, 150, 90)])
        d.rectangle((sx + 8, h - 34, sx + 70, h - 4), fill=tuple(int(v * 0.22) for v in c) + (255,))
        d.rectangle((sx + 8, h - 38, sx + 70, h - 35), fill=tuple(int(v * 0.8) for v in c) + (255,))
        gd.rectangle((sx + 8, h - 38, sx + 70, h - 35), fill=c + (255,))
        for k in range(sx + 12, sx + 68, 10):
            d.line((k, h - 30, k, h - 6), fill=(6, 5, 12, 255))
    # 大型の発光広告（ホログラム）
    for (ax, ay, aw, ah, c1, c2, txt) in ((420, 110, 150, 70, NEON['c'], NEON['v'], 'NEO//ZERO'),
                                         (860, 130, 120, 60, NEON['m'], NEON['y'], 'VOID-ADS')):
        yy, xx = np.mgrid[0:ah, 0:aw]
        t = (xx / aw + yy / ah * 0.4)
        grad = np.array(c1)[None, None] * (1 - t[..., None]) + np.array(c2)[None, None] * t[..., None]
        grad = grad * (0.35 + 0.15 * (yy % 3 == 0)[..., None])
        a = np.full((ah, aw, 1), 230)
        panel = Image.fromarray(np.concatenate([grad, a], 2).clip(0, 255).astype(np.uint8))
        pd = ImageDraw.Draw(panel); pd.fontmode = '1'
        pd.text((8, ah // 2 - 10), txt, font=font(18), fill=(230, 250, 255, 255))
        pd.rectangle((0, 0, aw - 1, ah - 1), outline=c1 + (255,))
        img.alpha_composite(panel, (ax, ay))
        gd.rectangle((ax, ay, ax + aw, ay + ah), outline=c1 + (255,), width=2)
        signs.append({'x': ax, 'y': ay, 'w': aw, 'h': ah, 'c': c1, 'f': 0.1, 'ad': 1})
    # 看板の発光をにじませて重ねる
    g = glowl.filter(ImageFilter.GaussianBlur(4))
    ga = np.asarray(g, np.float32)
    ga[..., 3] = quant(ga[..., 3] * 1.6, 5) * 0.55
    img = Image.alpha_composite(Image.fromarray(ga.clip(0, 255).astype(np.uint8)), img)
    img.alpha_composite(Image.fromarray(ga.clip(0, 255).astype(np.uint8)))
    # 手前の高架・電線
    d = ImageDraw.Draw(img)
    for k in range(3):
        yy0 = 20 + k * 9
        pts = [(xx, yy0 + 14 * math.sin(xx / 180 + k)) for xx in range(0, w, 8)]
        d.line(pts, fill=(14, 12, 26, 255), width=1)
    return img, signs


def floor_layer():
    w, h = 1024, 360 - (GROUND - 16)
    rnd = random.Random(5)
    yy, xx = np.mgrid[0:h, 0:w]
    base = np.zeros((h, w, 3), np.float32)
    base[:] = (12, 10, 22)
    # 歩道の縁
    base[0:6] = (26, 22, 42)
    base[6:8] = (40, 36, 62)
    # 濡れたアスファルトの粒
    noise = np.random.RandomState(3).rand(h, w)
    base += (noise > 0.93)[..., None] * 8
    # 看板の色が地面に縦に伸びて映り込む
    for _ in range(46):
        cx = rnd.randint(0, w); cw = rnd.randint(3, 16)
        col = np.array(rnd.choice(list(NEON.values())), np.float32)
        fall = np.clip(1 - (yy - 8) / (h * rnd.uniform(0.5, 1.0)), 0, 1) * (yy > 8)
        horiz = np.exp(-((xx - cx) / cw) ** 2)
        wav = 0.6 + 0.4 * np.sin(yy * 0.9 + cx)
        base += (horiz * fall * wav)[..., None] * col * rnd.uniform(0.08, 0.22)
    # 水たまり（反射が強い部分） → マスクとして別出力
    puddle = Image.new('L', (w, h), 0)
    pdd = ImageDraw.Draw(puddle)
    for _ in range(9):
        px = rnd.randint(30, w - 30); py = rnd.randint(16, h - 10)
        pw = rnd.randint(60, 170); ph = rnd.randint(6, 14)
        pdd.ellipse((px - pw // 2, py - ph // 2, px + pw // 2, py + ph // 2), fill=255)
    pm = np.asarray(puddle, np.float32) / 255
    base = base * (1 - pm[..., None] * 0.35)
    edge = (np.asarray(puddle.filter(ImageFilter.FIND_EDGES)) > 0)
    base[edge] += (30, 40, 70)
    # 路面標示
    for x0 in range(40, w, 140):
        base[46:49, x0:x0 + 40] += (35, 35, 40)
    bay = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5)[yy % 4, xx % 4]
    base = base + bay[..., None] * 6
    img = Image.fromarray(np.concatenate([base.clip(0, 255), np.full((h, w, 1), 255)], 2).astype(np.uint8))
    return img, puddle


def main():
    sky().save(os.path.join(OUT, 'sky.png'))
    far = building_layer(900, 230, 0, (14, 10, 34), [(90, 70, 160), (60, 120, 170), (150, 60, 140)], 0, 11)
    far.save(os.path.join(OUT, 'far.png'))
    mid, signs = mid_layer()
    mid.save(os.path.join(OUT, 'mid.png'))
    fl, pd = floor_layer()
    fl.save(os.path.join(OUT, 'floor.png'))
    pd.save(os.path.join(OUT, 'puddle.png'))
    json.dump({'ground': GROUND, 'worldW': 1024, 'floorY': GROUND - 16, 'farY': 70, 'midY': 300 - 300 + 0,
               'signs': signs}, open(os.path.join(OUT, 'stage.json'), 'w'))
    # 確認用の合成
    comp = sky().convert('RGBA')
    comp.alpha_composite(far.crop((100, 0, 740, 230)), (0, 70))
    comp.alpha_composite(mid.crop((200, 0, 840, 300)), (0, 0))
    comp.alpha_composite(fl.crop((200, 0, 840, fl.height)), (0, GROUND - 16))
    comp.save('/tmp/stage_preview.png')


if __name__ == '__main__':
    main()
