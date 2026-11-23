"""骨組み（design/motion_skeleton.json）を PixelLab の animate-with-skeleton の形（0〜1の割合、3コマずつ）に直す"""
import json, base64, sys
R = json.load(open('design/motion_skeleton.json'))
SIZE = 128
import os
SIDES = (('R', 'RIGHT', 0), ('L', 'LEFT', -4)) if os.environ.get('SWAP') else (('R', 'LEFT', 0), ('L', 'RIGHT', -4))
S, OX, OY = 0.85, 50, 124        # ゲームの座標(px) → 128マスの画面(px)


ARM = float(os.environ.get('ARM', '0.78'))


def natural(j):
    """絵に渡すときだけ腕を人間の長さに縮める（肩→ひじ→手の向きはそのまま）"""
    j = {k: list(v) for k, v in j.items()}
    for s in 'LR':
        sh, el, ha = j['sh' + s], j['el' + s], j['hand' + s]
        e = [sh[0] + (el[0] - sh[0]) * ARM, sh[1] + (el[1] - sh[1]) * ARM]
        h = [e[0] + (ha[0] - el[0]) * ARM, e[1] + (ha[1] - el[1]) * ARM]
        j['el' + s], j['hand' + s] = e, h
    return j


def kp(j):
    j = natural(j)
    P = lambda k: (OX + j[k][0] * S, OY + j[k][1] * S)
    hx, hy = P('head'); nx, ny = P('neck')
    pts = []
    def add(lbl, p, z): pts.append(dict(x=round(p[0] / SIZE, 4), y=round(p[1] / SIZE, 4), label=lbl, z_index=z))
    add('NOSE', (hx + 5, hy + 2), -2); add('NECK', (nx, ny), -2)
    add('LEFT EYE', (hx + 4, hy - 2), -1); add('RIGHT EYE', (hx + 3, hy - 2), -3)
    add('LEFT EAR', (hx - 2, hy - 1), -1); add('RIGHT EAR', (hx - 4, hy - 1), -3)
    # PixelLab では右向きのとき手前が LEFT。ゲームの骨組みの R（手前）→ LEFT、L（奥）→ RIGHT
    for s, lbl, z in SIDES:
        add(f'{lbl} SHOULDER', P('sh' + s), z); add(f'{lbl} ELBOW', P('el' + s), z); add(f'{lbl} ARM', P('hand' + s), z)
        add(f'{lbl} HIP', P('hip' + s), z + 1 if z < 0 else -1); add(f'{lbl} KNEE', P('kn' + s), z + 1 if z < 0 else -1); add(f'{lbl} LEG', P('an' + s), z + 1 if z < 0 else -1)
    return pts


def body(name, idx, ref_png, seed=1, init=None):
    F = R[name]['frames']
    b = dict(image_size=dict(width=SIZE, height=SIZE), skeleton_keypoints=[kp(F[i]['j']) for i in idx],
             view='side', direction='east', reference_guidance_scale=1.1, pose_guidance_scale=3.0,
             isometric=False, oblique_projection=False,
             reference_image=dict(type='base64', base64=base64.b64encode(open(ref_png, 'rb').read()).decode()), seed=seed)
    return b


if __name__ == '__main__':
    name, out = sys.argv[1], sys.argv[3]
    idx = [int(x) for x in sys.argv[2].split(',')]
    json.dump(body(name, idx, sys.argv[4]), open(out, 'w'))
