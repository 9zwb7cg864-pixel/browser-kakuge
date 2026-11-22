"""エフェクトのピクセルアート生成（飛び道具・ヒット火花・ガード火花・砂煙・ビーム・闇の柱・超必殺の輪）"""
import json, math, os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'game', 'assets', 'fx')
os.makedirs(OUT, exist_ok=True)
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

THEMES = {
    'k': [(4, 30, 80), (10, 90, 190), (30, 190, 255), (150, 240, 255), (255, 255, 255)],
    's': [(40, 0, 50), (120, 10, 140), (230, 40, 210), (255, 150, 245), (255, 255, 255)],
    'w': [(60, 60, 90), (120, 130, 170), (190, 210, 240), (235, 245, 255), (255, 255, 255)],
    'g': [(10, 40, 70), (40, 110, 170), (110, 190, 240), (200, 235, 255), (255, 255, 255)],
}


def paint(field, theme, alpha_floor=0.12):
    """0..1 の強さ → テーマのランプに量子化（ディザ付き）"""
    h, w = field.shape
    yy, xx = np.mgrid[0:h, 0:w]
    f = np.clip(field + (BAY[yy % 4, xx % 4] - 0.5) * 0.12, 0, 1)
    ramp = np.array(THEMES[theme] if isinstance(theme, str) else theme, np.uint8)
    idx = np.clip((f * len(ramp)).astype(int), 0, len(ramp) - 1)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = ramp[idx]
    a = np.where(f > alpha_floor, np.clip(0.35 + f * 1.2, 0, 1), 0)
    out[..., 3] = (a * 255).astype(np.uint8)
    return out


def strip(frames, name):
    h, w = frames[0].shape[:2]
    img = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames):
        img.paste(Image.fromarray(f), (i * w, 0))
    img.save(os.path.join(OUT, name + '.png'), optimize=True)
    return {'file': name + '.png', 'w': w, 'h': h, 'n': len(frames)}


def grid(w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return xx - w / 2 + 0.5, yy - h / 2 + 0.5


def ring_ball(theme, n=8, size=72, dark_core=False, big=1.0):
    X, Y = grid(size, size)
    frames = []
    for i in range(n):
        t = i / n * math.tau
        d = np.sqrt(X * X + Y * Y)
        ang = np.arctan2(Y, X)
        R = 15 * big
        ring = np.exp(-((d - R) / (2.4 * big)) ** 2) * (0.75 + 0.25 * np.sin(ang * 6 + t * 2))
        core = np.exp(-(d / (8 * big)) ** 2)
        # 進行方向（右）の反対へ尾を引く
        tail = np.exp(-((Y) / (5 * big + 3 * np.clip(-X / 30, 0, 1))) ** 2) * np.clip(-X / (34 * big), 0, 1) * \
            (0.6 + 0.4 * np.sin(X * 0.5 + t * 3)) * (X < 0)
        sparks = np.zeros_like(d)
        for k in range(5):
            a = t * 0.7 + k * 1.25
            sx, sy = math.cos(a) * R * 1.35, math.sin(a) * R * 1.35
            sparks += np.exp(-(((X - sx) ** 2 + (Y - sy) ** 2) / 3.0))
        if dark_core:
            f = ring * 1.0 + tail * 0.7 + sparks * 0.8 + np.exp(-((d - R * 0.7) / 3) ** 2) * 0.5
            out = paint(np.clip(f, 0, 1), theme)
            inner = d < R * 0.62
            out[inner] = (6, 0, 10, 255)
            edge = (d >= R * 0.62) & (d < R * 0.62 + 1.2)
            out[edge] = (255, 120, 240, 255)
        else:
            f = ring + core * 0.95 + tail * 0.8 + sparks * 0.7
            out = paint(np.clip(f, 0, 1), theme)
        frames.append(out)
    return frames


def burst(theme, n=7, size=80, rays=9, seed=1):
    rnd = np.random.RandomState(seed)
    X, Y = grid(size, size)
    d = np.sqrt(X * X + Y * Y) + 1e-3
    ang = np.arctan2(Y, X)
    ray_ang = rnd.rand(rays) * math.tau
    ray_len = rnd.uniform(0.6, 1.0, rays)
    frames = []
    for i in range(n):
        t = (i + 1) / n
        f = np.zeros_like(d)
        R = size * 0.48 * (0.35 + t * 0.75)
        for a, l in zip(ray_ang, ray_len):
            da = np.angle(np.exp(1j * (ang - a)))
            width = 0.16 * (1 - t) + 0.04
            f += np.exp(-(da / width) ** 2) * (d < R * l) * (d > R * l * t * 0.7) * (1 - t * 0.6)
        flash = np.exp(-(d / (10 * (1 - t) + 2)) ** 2) * (1 - t) * 1.4
        shock = np.exp(-((d - R * 0.8) / 2.0) ** 2) * (1 - t) * 0.8
        frames.append(paint(np.clip(f + flash + shock, 0, 1), theme))
    return frames


def guard_fx(n=6, size=72):
    X, Y = grid(size, size)
    frames = []
    for i in range(n):
        t = (i + 1) / n
        # 六角形の障壁
        ang = np.arctan2(Y, X)
        r = np.sqrt(X * X + Y * Y)
        hexr = r * np.cos(np.angle(np.exp(1j * (ang * 3))) / 3)
        R = 14 + t * 14
        f = np.exp(-((hexr - R) / 1.6) ** 2) * (1 - t) * 1.2 + np.exp(-(r / (6 * (1 - t) + 1)) ** 2) * (1 - t)
        f *= (np.abs(X) < 10 + t * 4) | (r < R + 2)
        frames.append(paint(np.clip(f, 0, 1), 'g'))
    return frames


def dust(n=6, w=96, h=40):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    frames = []
    rnd = np.random.RandomState(4)
    puffs = [(rnd.uniform(-1, 1), rnd.uniform(0.5, 1.0)) for _ in range(10)]
    for i in range(n):
        t = (i + 1) / n
        f = np.zeros((h, w), np.float32)
        for (dx, s) in puffs:
            cx = w / 2 + dx * w * 0.42 * t
            cy = h - 6 - s * 14 * t
            r = 4 + s * 7 * t
            f += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r))) * (1 - t)
        frames.append(paint(np.clip(f * 1.2, 0, 1), [(30, 26, 50), (60, 56, 90), (100, 96, 140), (150, 150, 190)], 0.2))
    return frames


def beam(theme, n=6, w=64, h=64):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    Y = yy - h / 2
    frames = []
    for i in range(n):
        t = i / n * math.tau
        wob = 1 + 0.12 * np.sin(xx / w * math.tau * 2 + t * 2)
        core = np.exp(-(Y / (6 * wob)) ** 2)
        outer = np.exp(-(Y / (16 * wob)) ** 2) * 0.55
        streak = (np.sin(xx * 0.6 - t * 5 + Y * 0.2) > 0.6) * np.exp(-(Y / 20) ** 2) * 0.4
        f = core * 1.1 + outer + streak
        frames.append(paint(np.clip(f, 0, 1), theme, 0.08))
    return frames


def beam_head(theme, n=6, size=96):
    X, Y = grid(size, size)
    frames = []
    for i in range(n):
        t = i / n * math.tau
        r = np.sqrt(X * X + Y * Y)
        ang = np.arctan2(Y, X)
        f = np.exp(-(r / 22) ** 2) * 1.2 + np.exp(-((r - 28 - 3 * math.sin(t)) / 3) ** 2) * (0.7 + 0.3 * np.sin(ang * 8 + t * 3))
        f += np.exp(-(Y / 14) ** 2) * (X < 0) * 0.9
        frames.append(paint(np.clip(f, 0, 1), theme))
    return frames


def pillar(n=10, w=80, h=240):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    X = xx - w / 2
    frames = []
    for i in range(n):
        t = (i + 1) / n
        grow = min(1, t * 2.2)
        top = h * (1 - grow)
        width = 10 + 14 * min(1, t * 3) * (1.2 - 0.6 * max(0, t - 0.7) / 0.3)
        wob = width * (1 + 0.15 * np.sin(yy * 0.12 - i * 1.4))
        body = np.exp(-(X / wob) ** 4) * (yy > top)
        edge = np.exp(-((np.abs(X) - wob * 0.85) / 2.0) ** 2) * (yy > top)
        flick = (np.sin(yy * 0.4 + X * 0.6 - i * 2.0) > 0.7) * body * 0.5
        f = edge * 1.1 + flick + body * 0.2
        fade = 1 - max(0, t - 0.75) / 0.25
        out = paint(np.clip(f * fade, 0, 1), 's')
        core = (body > 0.8) & (np.abs(X) < wob * 0.6)
        out[core] = (8, 0, 14, int(255 * fade))
        frames.append(out)
    return frames


def flash_ring(theme, n=10, size=160):
    X, Y = grid(size, size)
    r = np.sqrt(X * X + Y * Y)
    ang = np.arctan2(Y, X)
    frames = []
    for i in range(n):
        t = (i + 1) / n
        R = 10 + t * 70
        f = np.exp(-((r - R) / (3 + 4 * t)) ** 2) * (1 - t) * 1.3
        f += np.exp(-((r - R * 0.6) / 1.5) ** 2) * (1 - t) * (np.sin(ang * 12) > 0) * 0.8
        # 紋章（同心の内輪と十字）
        f += (np.exp(-((r - 18) / 1.2) ** 2) + np.exp(-(X / 1.2) ** 2) * (r < 26) + np.exp(-(Y / 1.2) ** 2) * (r < 26)) * (1 - t) * 0.9
        frames.append(paint(np.clip(f, 0, 1), theme))
    return frames


def ground_wave(theme, n=6, w=72, h=56):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    frames = []
    for i in range(n):
        t = i / n * math.tau
        f = np.zeros((h, w), np.float32)
        for k in range(5):
            cx = 10 + k * 13 + 2 * math.sin(t + k)
            ht = (18 + 14 * (0.5 + 0.5 * math.sin(t * 2 + k * 1.7))) * (1 - abs(k - 2) * 0.12)
            sp = np.clip(1 - np.abs(xx - cx) / (4 + 3 * (1 - (h - yy) / max(ht, 1))), 0, 1) * ((h - yy) < ht)
            f += sp * (0.6 + 0.4 * (h - yy) / max(ht, 1))
        f += np.exp(-((yy - (h - 3)) / 3) ** 2) * 0.9
        frames.append(paint(np.clip(f, 0, 1), theme, 0.1))
    return frames


def main():
    meta = {}
    meta['wave_s'] = strip(ground_wave('s'), 'wave_s')
    meta['ball_k'] = strip(ring_ball('k'), 'ball_k')
    meta['ball_k_ex'] = strip(ring_ball('k', big=1.35, size=96), 'ball_k_ex')
    meta['ball_s'] = strip(ring_ball('s', dark_core=True, big=1.15, size=80), 'ball_s')
    meta['ball_s_ex'] = strip(ring_ball('s', dark_core=True, big=1.5, size=104), 'ball_s_ex')
    meta['hit_k'] = strip(burst('k', seed=2), 'hit_k')
    meta['hit_s'] = strip(burst('s', seed=3), 'hit_s')
    meta['hit_w'] = strip(burst('w', n=6, size=64, rays=7, seed=5), 'hit_w')
    meta['hit_big'] = strip(burst('w', n=9, size=128, rays=13, seed=9), 'hit_big')
    meta['guard'] = strip(guard_fx(), 'guard')
    meta['dust'] = strip(dust(), 'dust')
    meta['beam_k'] = strip(beam('k'), 'beam_k')
    meta['beamhead_k'] = strip(beam_head('k'), 'beamhead_k')
    meta['pillar_s'] = strip(pillar(), 'pillar_s')
    meta['ring_k'] = strip(flash_ring('k'), 'ring_k')
    meta['ring_s'] = strip(flash_ring('s'), 'ring_s')
    json.dump(meta, open(os.path.join(OUT, 'fx.json'), 'w'))
    # 確認用
    rows = []
    for k, m in meta.items():
        rows.append(Image.open(os.path.join(OUT, m['file'])))
    W = max(r.width for r in rows); H = sum(r.height for r in rows)
    sheet = Image.new('RGBA', (min(W, 1600), H), (5, 6, 12, 255))
    y = 0
    for r in rows:
        sheet.alpha_composite(r.crop((0, 0, min(r.width, 1600), r.height)), (0, y)); y += r.height
    sheet.save('/tmp/fx_preview.png')


if __name__ == '__main__':
    main()
