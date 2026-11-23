# コマンド技のエフェクト（ドット絵）を作る：水色の気の斬撃・渦・溜め・まとう気・風切り線・気の柱
# 足し合わせて描く（lighter）ので、暗い色ほど透けて見える。
# 使い方: python3 tools/fx_moves.py   → game/assets/fx/ に png を書き、fx.json に登録する
import json, math, random, os
from PIL import Image, ImageDraw
OUT = os.path.join(os.path.dirname(__file__), '..', 'game', 'assets', 'fx')
WHITE, PALE, CYAN, BLUE, DEEP = (255, 255, 255), (170, 240, 255), (56, 200, 255), (24, 100, 220), (12, 40, 130)
SHADES = [DEEP, BLUE, CYAN, PALE, WHITE]
random.seed(7)

def sheet(name, frames):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames): s.paste(f, (i * w, 0))
    s.save(os.path.join(OUT, name + '.png'), optimize=True)
    return {'file': name + '.png', 'w': w, 'h': h, 'n': len(frames)}

def shade(v):   # 0..1 の明るさ → 5段階の色
    return SHADES[max(0, min(4, int(v * 5 - 1e-6)))]

def arc_frames(w, h, cx, cy, r, a0, a1, thick, sy=1.0, n=8):
    """三日月の斬撃。最初の3コマで振り抜き、そのあと細くなって消える"""
    out = []
    for k in range(n):
        im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
        grow = min(1.0, (k + 1) / 3)
        fade = 1.0 if k < 3 else max(0.0, 1 - (k - 2) / (n - 2))
        end = a0 + (a1 - a0) * grow
        steps = 60
        for band in range(5):              # 外側ほど明るい
            t_out = thick * fade * (1 - band * 0.2)
            if t_out < 0.6: continue
            pts_o, pts_i = [], []
            for i in range(steps + 1):
                a = math.radians(a0 + (end - a0) * i / steps)
                u = i / steps
                taper = math.sin(math.pi * min(1, u * 1.15)) ** 0.7 * (0.35 + 0.65 * u)   # 先が太く根元が細い
                th = t_out * taper
                ro, ri = r, r - th
                pts_o.append((cx + ro * math.cos(a), cy + ro * math.sin(a) * sy))
                pts_i.append((cx + ri * math.cos(a), cy + ri * math.sin(a) * sy))
            d.polygon(pts_o + pts_i[::-1], fill=SHADES[band] + (255,))
        # 弧の外に飛ぶ光の粒
        if 1 <= k <= 5:
            for _ in range(10):
                u = random.random(); a = math.radians(a0 + (end - a0) * u)
                rr = r + random.uniform(-2, 8 + k * 2)
                x, y = cx + rr * math.cos(a), cy + rr * math.sin(a) * sy
                d.point((x, y), fill=(PALE if random.random() < 0.6 else CYAN) + (255,))
        out.append(im)
    return out

def swirl_frames(w=176, h=72, n=8):
    """旋風脚の風の渦：横長の輪が回る（手前は明るく、奥は暗い）"""
    out = []
    cx, cy, rx, ry = w / 2, h / 2, 74, 18
    for k in range(n):
        im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
        for seg in range(3):
            base = k / n * 360 + seg * 120
            for j in range(26):
                a = math.radians(base + j * 3.2)
                front = (math.sin(a) + 1) / 2          # 手前ほど1
                v = (0.25 + 0.75 * front) * (1 - j / 30)
                x, y = cx + rx * math.cos(a), cy + ry * math.sin(a)
                rad = 2 + int(3 * front * (1 - j / 26))
                d.ellipse((x - rad, y - rad * 0.6, x + rad, y + rad * 0.6), fill=shade(v) + (255,))
        for _ in range(8):
            a = random.uniform(0, math.tau); rr = random.uniform(0.6, 1.15)
            d.point((cx + rx * rr * math.cos(a), cy + ry * rr * math.sin(a)), fill=PALE + (255,))
        out.append(im)
    return out

def charge_frames(w=72, h=72, n=8):
    """気を溜める光：まわりから粒が集まり、真ん中が脈打つ"""
    out = []; cx, cy = w / 2, h / 2
    parts = [(random.uniform(0, math.tau), random.uniform(0, 1)) for _ in range(18)]
    for k in range(n):
        im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
        for a, ph in parts:
            u = (ph + k / n) % 1.0
            rr = 32 * (1 - u)
            x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
            x2, y2 = cx + (rr + 5) * math.cos(a), cy + (rr + 5) * math.sin(a)
            d.line((x, y, x2, y2), fill=shade(0.4 + 0.6 * u) + (255,), width=1)
        pr = 6 + 2 * math.sin(k / n * math.tau)
        for band in range(4):
            r = pr * (1 - band * 0.22)
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=SHADES[band + 1] + (255,))
        out.append(im)
    return out

def burst_frames(w=96, h=96, n=6):
    """手のひら・ひじの衝撃：広がる輪と光の筋"""
    out = []; cx, cy = w / 2, h / 2
    rays = [random.uniform(0, math.tau) for _ in range(9)]
    for k in range(n):
        im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
        u = (k + 1) / n
        r = 8 + 34 * u
        width = max(1, int(5 * (1 - u)) + 1)
        d.ellipse((cx - r, cy - r * 0.8, cx + r, cy + r * 0.8), outline=shade(1 - u * 0.7) + (255,), width=width)
        for a in rays:
            r0, r1 = 4 + 20 * u, 14 + 34 * u * (1 - 0.3 * u)
            d.line((cx + r0 * math.cos(a), cy + r0 * math.sin(a), cx + r1 * math.cos(a), cy + r1 * math.sin(a)), fill=shade(1 - u * 0.6) + (255,), width=2 if k < 2 else 1)
        if k < 2:
            c = 10 - k * 4
            d.ellipse((cx - c, cy - c, cx + c, cy + c), fill=WHITE + (255,))
        out.append(im)
    return out

def aura_frames(w=128, h=184, n=8):
    """超必殺でまとう気：体の輪郭にそって、炎のような気が上へ揺らめく"""
    out = []; cx, cy, rx, ry = w / 2, h - 86, 40, 82
    tongues = [(random.uniform(0, math.tau), random.uniform(0, 1), random.uniform(10, 24)) for _ in range(34)]
    for k in range(n):
        im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
        for a, ph, ln in tongues:
            u = (ph + k / n) % 1.0
            x0, y0 = cx + rx * math.cos(a), cy + ry * math.sin(a)
            y0 -= u * 26
            x1 = x0 + math.sin((u + ph) * math.tau) * 3
            v = 0.2 + 0.6 * (1 - u)
            d.line((x0, y0, x1, y0 - ln * (1 - u * 0.5)), fill=shade(v) + (255,), width=2 if u < 0.4 else 1)
        out.append(im)
    return out

def speed_frames(w=176, h=96, n=6):
    """EX迅閃脚の風切り線"""
    out = []
    lines = [(random.uniform(10, h - 10), random.uniform(30, 120), random.uniform(0, 1)) for _ in range(16)]
    for k in range(n):
        im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
        for y, ln, ph in lines:
            x = w - ((ph + k / n) % 1.0) * (w + ln)
            v = 0.3 + 0.7 * ph
            d.line((x, y, x + ln, y), fill=shade(v) + (255,), width=1 if ph < 0.7 else 2)
        out.append(im)
    return out

def pillar_frames(w=104, h=256, n=10):
    """天地穿の気の柱：らせんが下から立ち上がって消える"""
    out = []; cx = w / 2
    for k in range(n):
        im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
        top = h - h * min(1, (k + 1) / 3)
        fade = 1 if k < 6 else 1 - (k - 5) / 5
        for s in range(2):
            for y in range(int(top), h, 2):
                a = (h - y) / 22 + k * 0.9 + s * math.pi
                front = (math.sin(a) + 1) / 2
                rx = 30 + 6 * math.sin(y / 30)
                x = cx + rx * math.cos(a)
                v = (0.2 + 0.8 * front) * fade
                r = 1 + int(2 * front)
                d.ellipse((x - r, y - r, x + r, y + r), fill=shade(v) + (255,))
        # 真ん中の光の芯
        if fade > 0.2:
            d.rectangle((cx - 4 * fade, top, cx + 4 * fade, h), fill=shade(0.5 * fade) + (255,))
            d.rectangle((cx - 1, top, cx + 1, h), fill=shade(0.9 * fade) + (255,))
        out.append(im)
    return out

meta = json.load(open(os.path.join(OUT, 'fx.json')))
meta['mv_slash_up'] = sheet('mv_slash_up', arc_frames(128, 176, 40, 120, 84, 35, -105, 28))
meta['mv_slash_h'] = sheet('mv_slash_h', arc_frames(192, 112, 96, 74, 90, 200, 370, 26, sy=0.42))
meta['mv_slash_down'] = sheet('mv_slash_down', arc_frames(144, 144, 44, 80, 76, -125, 65, 26))
meta['mv_swirl'] = sheet('mv_swirl', swirl_frames())
meta['mv_charge'] = sheet('mv_charge', charge_frames())
meta['mv_burst'] = sheet('mv_burst', burst_frames())
meta['mv_aura'] = sheet('mv_aura', aura_frames())
meta['mv_speed'] = sheet('mv_speed', speed_frames())
meta['mv_pillar'] = sheet('mv_pillar', pillar_frames())
json.dump(meta, open(os.path.join(OUT, 'fx.json'), 'w'), ensure_ascii=False)
print('ok', [k for k in meta if k.startswith('mv_')])
