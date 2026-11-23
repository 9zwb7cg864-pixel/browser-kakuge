# 同じ絵が続くアニメを、1フレーム1枚にするための生成依頼を作る
#  今の絵を「始め・攻撃が出る瞬間・終わり」（と40フレームごと）に固定し、その間をPixelLabに描かせる
import json, os, re, sys, base64
D = 'design/pixellab/ren/'
M = json.load(open(D + 'moves.json'))
A = json.load(open('game/assets/kokuu/anims.json'))['anims']
P = '/mnt/user-data/outputs/pl/'
OUT = P + 'sm/'
SUB = 'a young martial artist in a black sleeveless shirt, gray cloth belt, baggy black pants, red hand wraps and black sneakers'
names = sys.argv[1].split(',')
def b64(p): return {"type": "base64", "base64": base64.b64encode(open(D + p, 'rb').read()).decode(), "format": "png"}
def desc_of(fr):
    for x in fr:
        m = re.match(r'img/(.+)_(m?)(\d+)\.png', x)
        if m and os.path.exists(P + m.group(1) + '.json'):
            d = json.load(open(P + m.group(1) + '.json')); return d.get('description', ''), d.get('initial_pose')
    return '', None
plan = {}
for n in names:
    fr = M[n]['frames']; T = len(fr)
    t = [f for f in A[n]['frames'] for _ in range(f['d'])]
    ka = next((i for i, f in enumerate(t) if f.get('ph') == 'a'), None)
    anchors = {0, T - 1}
    if ka is not None and 0 < ka < T - 1: anchors.add(ka)
    anchors = sorted(anchors); segs = []
    for a0, b0 in zip(anchors, anchors[1:]):
        k = a0
        while k < b0:
            e = min(b0, k + 40); segs.append((k, e)); k = e
    desc, pose = desc_of(fr)
    for i, (s, e) in enumerate(segs):
        fc = max(4, (e - s + 3) // 4 * 4)
        j = {"no_background": True, "enhance_prompt": False, "direction": "east", "view": "side", "seed": 211 + i,
             "subject_description": SUB, "first_frame": b64(fr[s]), "last_frame": b64(fr[e]), "frame_count": fc,
             "description": (desc + ' ' if desc else '') + 'Show only the part of this motion that goes smoothly from the first pose to the last pose, the same character, same size, no effects.'}
        if pose: j['initial_pose'] = pose
        nm = f'sm_{n}_{i}'
        json.dump(j, open(OUT + nm + '.json', 'w'))
        plan.setdefault(n, []).append({'job': nm, 's': s, 'e': e, 'fc': fc})
old = json.load(open(OUT + 'plan.json')) if os.path.exists(OUT + 'plan.json') else {}
old.update(plan); json.dump(old, open(OUT + 'plan.json', 'w'), indent=1)
for n, ss in plan.items(): print(n, [(x['job'], x['s'], x['e'], x['fc']) for x in ss])
