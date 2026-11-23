"""道着キャラ男のゲームの動きを、ドット絵サイトPiskel用のファイル（.piskel）にする
  ・ゲームの絵の3×3画素を1ドットにまとめる（少ない色数・発光は3段階）
  ・コマの長さはゲームと同じ（30コマ/秒に直して、長いコマは同じ絵を続ける）
  ・2枚目の層に攻撃判定（赤い枠）を描くので、ドット絵の上でリーチが見える"""
import json, base64, io, os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
import stick

def pixelate(img, S, k=None):
    """ドット絵にする：k×k画素を1ドットにまとめ、色を少ない色数に寄せ、透明度も段階にする。
       大きさは元のまま（k倍に拡大して戻す）なので、ゲーム側の位置や当たり判定はそのまま"""
    k = k or S['pixel']
    h, w = img.shape[:2]
    H, W = (h + k - 1) // k, (w + k - 1) // k
    pad = np.zeros((H * k, W * k, 4), np.float32); pad[:h, :w] = img
    blk = pad.reshape(H, k, W, k, 4).transpose(0, 2, 1, 3, 4).reshape(H, W, k * k, 4)
    a = blk[..., 3] / 255.0
    cov = a.mean(axis=2)                                   # どれだけ埋まっているか
    wsum = a.sum(axis=2, keepdims=True) + 1e-6
    col = (blk[..., :3] * a[..., None]).sum(axis=2) / wsum  # 透明でない画素の平均色
    solid = (blk[..., 3] >= 250).mean(axis=2)              # 体（不透明）の割合
    # 使う色：体の明暗3色×手前/奥＋白い芯＋縁の明るい色＋発光の色
    gc = np.array(stick.hexc(S['glow']), np.float32)
    pal = [stick.hexc(c) for c in S['near']] + [stick.hexc(c) for c in S['far']] + [stick.hexc(S['acc'][1])]
    pal = [tuple(int(v + (255 - v) * 0.32) for v in c) for c in pal]
    pal += [tuple(int(v) for v in (gc + (255 - gc) * 0.55)), tuple(int(v) for v in gc)]
    pal = np.array(pal, np.float32)
    d = ((col[..., None, :] - pal[None, None]) ** 2).sum(-1)
    q = pal[d.argmin(-1)]
    out = np.zeros((H, W, 4), np.uint8)
    body = solid >= 0.34
    out[body, :3] = q[body]; out[body, 3] = 255
    # 発光は3段階の透明度（ドット絵らしく）
    glow = ~body & (cov > 0.08)
    lv = np.where(cov > 0.5, 170, np.where(cov > 0.25, 110, 55))
    out[glow, :3] = gc.astype(np.uint8); out[glow, 3] = lv[glow]
    big = out.repeat(k, 0).repeat(k, 1)[:h, :w]
    return np.ascontiguousarray(big)


K = 3
ROOT = os.path.join(os.path.dirname(__file__), '..')
A = json.load(open(os.path.join(ROOT, 'game/assets/kokuu/anims.json')))
FW, FH = A['frameW'], A['frameH']
OX, OY = 112, 190          # 足元の位置（ゲームの描画と同じ）
W, H = (FW + K - 1) // K, (FH + K - 1) // K
S = stick.STYLE['kokuu']


def small(img):
    big = pixelate(np.array(img.convert('RGBA')), S, K)
    return Image.fromarray(big[::K, ::K][:H, :W])


def png64(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def layer(name, frames, opacity=1.0):
    strip = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames): strip.alpha_composite(f, (i * W, 0))
    return json.dumps({'name': name, 'opacity': opacity, 'frameCount': len(frames),
                       'chunks': [{'layout': [[i] for i in range(len(frames))], 'base64PNG': png64(strip)}]})


def build(name):
    a = A['anims'][name]
    sheet = Image.open(os.path.join(ROOT, 'game/assets/kokuu', a['file']))
    art, hit = [], []
    for i, fr in enumerate(a['frames']):
        im = small(sheet.crop((i * FW, 0, i * FW + FW, FH)))
        hb = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(hb)
        for (x, y, w, h) in fr.get('hit', []):
            d.rectangle([(OX + x) / K, (OY + y) / K, (OX + x + w) / K, (OY + y + h) / K], outline=(255, 40, 40, 255))
        n = max(1, round(fr['d'] / 2))   # 60コマ/秒 → 30コマ/秒
        art += [im] * n; hit += [hb] * n
    doc = {'modelVersion': 2, 'piskel': {'name': 'dogi_' + name, 'description': '道着キャラ男 ' + name + '（ゲームの動き・リーチどおり）',
           'fps': 30, 'width': W, 'height': H, 'hiddenFrames': [],
           'layers': [layer('ドット絵', art), layer('攻撃判定', hit, 0.7)]}}
    out = os.path.join(ROOT, 'design/piskel', 'dogi_' + name + '.piskel')
    json.dump(doc, open(out, 'w'))
    return len(art)


if __name__ == '__main__':
    names = sys.argv[1:] or list(A['anims'].keys())
    tot = 0
    for n in names:
        tot += build(n)
    print(len(names), '技', tot, 'コマ', W, 'x', H)
