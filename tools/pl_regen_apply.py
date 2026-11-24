# PixelLabで丸ごと作り直した動きを moves.json に入れる。
# 依頼の一覧: /mnt/user-data/outputs/pl/rg/plan.json （動き・区切り・何コマ目から何コマ目か）
# 出来た絵:   /mnt/user-data/uploads/Downloads/pixellab/rg/<区切りの名前>/img_N.png
# 区切りの両端は今の絵そのもの（攻撃は当たる瞬間の絵が区切り）なので、当たるコマに当たる絵が来る。
# 区切りの中は、出来た絵から等間隔に選ぶ（同じ絵は2回使わない）。
# 使い方: python3 tools/pl_regen_apply.py [動きの名前 ...]   （名前を省くと出来ているもの全部）
import json, os, sys, shutil, hashlib
from collections import defaultdict
PLAN = '/mnt/user-data/outputs/pl/rg/plan.json'
GEN = '/mnt/user-data/uploads/Downloads/pixellab/rg/'
D = 'design/pixellab/ren/'
plan = json.load(open(PLAN))
M = json.load(open(D + 'moves.json'))
by = defaultdict(list)
for p in plan: by[p['anim']].append(p)
want = sys.argv[1:] or list(by)
import base64, glob
for r in glob.glob(GEN + '*/response.json'):         # 返事のファイルに入っている画像を img_N.png に書き出す
    d = os.path.dirname(r) + '/'
    try: ims = json.load(open(r))['last_response']['images']
    except Exception: continue
    for i, im in enumerate(ims):
        if not os.path.exists(d + f'img_{i}.png') or os.path.getmtime(d + f'img_{i}.png') < os.path.getmtime(r):
            open(d + f'img_{i}.png', 'wb').write(base64.b64decode(im['base64']))
def md5(p): return hashlib.md5(open(p, 'rb').read()).hexdigest()
done = []
for n in want:
    segs = sorted(by[n], key=lambda p: p['t0'])
    if not all(os.path.exists(GEN + s['name'] + f"/img_{s['fc']}.png") for s in segs):
        print(n, 'まだ揃っていない'); continue
    old = M[n]['frames']; L = len(old)
    out = [old[0]]; short = []
    for s in segs:
        need = s['t1'] - s['t0']                     # この区切りで新しく要るコマ数（先頭は前の区切りの最後）
        src = GEN + s['name'] + '/img_%d.png'
        seq = [0]                                    # PixelLabが同じ絵を続けたところは1枚にまとめる
        for i in range(1, s['fc'] + 1):
            if md5(src % i) not in [md5(src % j) for j in seq[-2:]]: seq.append(i)
        if md5(src % seq[-1]) != md5(src % s['fc']): seq.append(s['fc'])
        u = len(seq) - 1
        if u < need: short.append((s['name'], u, need)); continue
        idx = [round(k * u / need) for k in range(1, need + 1)]
        for k in range(1, need - 1):                 # 離れた2枚がたまたま同じ絵なら、となりの絵にずらす
            prev = md5(src % seq[idx[k - 1]])
            if md5(src % seq[idx[k]]) == prev and idx[k] + 1 < idx[k + 1]: idx[k] += 1
        pick = [seq[i] for i in idx]
        for k, i in enumerate(pick):
            if k == need - 1: out.append(old[s['t1']]); continue   # 区切りの最後は今の絵（当たる瞬間など）
            p = f"img/rg_{n}_{s['t0'] + k + 1:03d}.png"
            shutil.copy(src % i, D + p)
            out.append(p)
    if short:
        print(n, '絵が足りない区切り:', short); continue
    assert len(out) == L, (n, len(out), L)
    hs = [md5(D + p) for p in out]
    dup = sum(hs[i] == hs[i - 1] for i in range(1, L))
    M[n]['frames'] = out
    done.append(n)
    print(n, L, 'コマ  同じ絵の連続', dup)
json.dump(M, open(D + 'moves.json', 'w'), indent=1)
print('入れた:', len(done))
