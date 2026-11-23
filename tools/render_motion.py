import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import motion5 as motion3
from PIL import Image, ImageDraw, ImageFont
ROOT = '/home/claude/dairantou-street-fight'
A = json.load(open(f'{ROOT}/game/assets/kokuu/anims.json'))
FW, FH = A['frameW'], A['frameH']
R = motion3.bake()
OUT = os.environ.get('OUT', '/tmp/mv/motion_v5.mp4')
W, H = 1280, 720
SC = 2.3
FB = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
font = ImageFont.truetype(FB, 30); small = ImageFont.truetype(FB, 22)

def old_frames(name):
    a = A['anims'][name]; sheet = Image.open(f"{ROOT}/game/assets/kokuu/{a['file']}").convert('RGBA')
    out = []
    for i, f in enumerate(a['frames']):
        im = sheet.crop((i * FW, 0, i * FW + FW, FH))
        out += [(im, f['ph'], f.get('hit', []))] * f['d']
    return out

def shade(z):
    t = max(0.0, min(1.0, (z + 20) / 40))
    return tuple(int(a + (b - a) * t) for a, b in zip((35, 95, 150), (140, 240, 255)))

def draw_skel(d, j, ox, oy, sc, hitk=None, active=False):
    P = lambda k: (ox + j[k][0] * sc, oy + j[k][1] * sc)
    Z = lambda k: j[k][2]
    items = []
    torso = ['shL', 'shR', 'hipR', 'hipL']
    items.append((sum(Z(k) for k in torso) / 4 - 0.5, 'poly', torso))
    for s in 'LR':
        for a, b, w in (('hip' + s, 'kn' + s, 7), ('kn' + s, 'an' + s, 6), ('an' + s, 'toe' + s, 5),
                        ('sh' + s, 'el' + s, 6), ('el' + s, 'hand' + s, 5.5)):
            items.append(((Z(a) + Z(b)) / 2, 'seg', (a, b, w)))
        items.append((Z('hand' + s) + 0.1, 'ball', ('hand' + s, 5.2)))
    items.append((Z('neck'), 'seg', ('neck', 'head', 5)))
    items.append((Z('head') + 0.2, 'ball', ('head', 10)))
    for z, kind, v in sorted(items, key=lambda x: x[0]):
        if kind == 'poly':
            c = shade(z); d.polygon([P(k) for k in v], fill=tuple(int(x * 0.8) for x in c), outline=c)
        elif kind == 'seg':
            a, b, w = v; c = shade(z)
            d.line([P(a), P(b)], fill=c, width=int(w * sc))
            for k in (a, b):
                x, y = P(k); r = w * sc / 2; d.ellipse([x - r, y - r, x + r, y + r], fill=c)
        else:
            k, r = v; c = shade(z); x, y = P(k); d.ellipse([x - r * sc, y - r * sc, x + r * sc, y + r * sc], fill=c)
    if hitk and active:
        x, y = P(hitk); r = 9 * sc; d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 60, 60), width=3)

def frame_img(name, i, oldf, label, speed):
    global R
    img = Image.new('RGB', (W, H), (14, 16, 26)); d = ImageDraw.Draw(img)
    gy = 600
    for px in (0, 640): d.line([(px + 20, gy), (px + 620, gy)], fill=(70, 80, 110), width=2)
    d.line([(640, 0), (640, H)], fill=(50, 55, 80), width=2)
    m = R[name]
    oi = oldf[min(i, len(oldf) - 1)]
    im = oi[0].resize((int(FW * SC), int(FH * SC)), Image.NEAREST)
    ox = 210
    img.paste(im, (int(ox - 112 * SC), int(gy - 190 * SC)), im)
    if oi[1] == 'a':
        for (x, y, w, h) in oi[2]:
            d.rectangle([ox + x * SC, gy + y * SC, ox + (x + w) * SC, gy + (y + h) * SC], outline=(255, 60, 60), width=3)
    fr = m['frames'][min(i, len(m['frames']) - 1)]
    draw_skel(d, fr['j'], 640 + 210, gy, SC, m['hit'], fr['ph'] == 'a')
    if m['reach']:
        for px in (ox, 640 + 210):
            x = px + m['reach'] * SC
            for yy in range(250, gy, 16): d.line([(x, yy), (x, yy + 8)], fill=(255, 200, 60), width=2)
        d.text((900, 60), f"黄色の線＝リーチ {m['reach']}px", font=small, fill=(255, 200, 60))
    d.text((30, 20), '今の動き', font=font, fill=(200, 200, 220))
    d.text((670, 20), '新しい骨組み（本物の人の動き＝Mixamo）', font=font, fill=(120, 235, 255))
    d.text((30, 640), f"{name}  {label}　{speed}", font=font, fill=(255, 255, 255))
    ph = fr['ph']; tag = {'s': '出始め', 'a': '当たる', 'r': '戻り', '-': ''}[ph]
    d.text((670, 640), f"{i + 1}/{len(m['frames'])}F {tag}", font=small, fill=(255, 90, 90) if ph == 'a' else (180, 190, 210))
    return img

def strip(name, out, n=8):
    m = R[name]; F = m['frames']; idx = [round(i * (len(F) - 1) / (n - 1)) for i in range(n)]
    a = [i for i, f in enumerate(F) if f['ph'] == 'a']
    if a: idx = sorted(set(idx[:-1] + [a[0]]))[:n]
    cw = 170; img = Image.new('RGB', (cw * len(idx), 200), (14, 16, 26)); d = ImageDraw.Draw(img)
    for c, i in enumerate(idx):
        draw_skel(d, F[i]['j'], c * cw + 55, 185, 1.0, m['hit'], F[i]['ph'] == 'a')
        d.text((c * cw + 4, 2), f"{i+1}{F[i]['ph']}", font=small, fill=(200, 200, 200))
    img.save(out)

if __name__ == '__main__':
    if sys.argv[1] == 'strip':
        ims = []
        for k in R: strip(k, f'/tmp/mv/s3_{k}.png')
        im = [Image.open(f'/tmp/mv/s3_{k}.png') for k in R]
        big = Image.new('RGB', (max(i.width for i in im), sum(i.height for i in im)))
        y = 0
        for i in im: big.paste(i, (0, y)); y += i.height
        big.save('/tmp/mv/s3_all.png')
    else:
        import subprocess, shutil
        tmp = '/tmp/mv/v3'; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
        k = 0
        for name in (sys.argv[2:] or list(R)):
            m = R[name]; oldf = old_frames(name); n = max(len(m['frames']), len(oldf))
            for speed, rep, loops in (('実際の速さの1/2', 1, 1),):
                for _ in range(loops):
                    for i in range(n):
                        im = frame_img(name, i, oldf, m['jp'], speed)
                        for _ in range(rep): im.save(f'{tmp}/f{k:05d}.jpg', quality=92); k += 1
                    for _ in range(8): im.save(f'{tmp}/f{k:05d}.jpg', quality=92); k += 1
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', '30', '-i', f'{tmp}/f%05d.jpg',
                        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', OUT + '.tmp.mp4'], check=True)
        os.replace(OUT + '.tmp.mp4', '/tmp/mv/motion_v5.mp4')
