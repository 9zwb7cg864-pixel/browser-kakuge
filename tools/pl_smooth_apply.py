# PixelLabで描いた間の絵を、1フレーム1枚で moves.json に入れる（pl_smooth_plan.py の続き）
import json, os, shutil, sys
D = 'design/pixellab/ren/'
U = '/mnt/user-data/uploads/Downloads/pixellab/sm/'
plan = json.load(open('/mnt/user-data/outputs/pl/sm/plan.json'))
M = json.load(open(D + 'moves.json'))
names = sys.argv[1].split(',')
for n in names:
    segs = plan[n]; fr = M[n]['frames']; T = len(fr); out = list(fr)
    need = [(g['job'], round((t - g['s']) * g['fc'] / (g['e'] - g['s']))) for g in segs for t in range(g['s'] + 1, g['e'])]
    ok = all(os.path.exists(f"{U}{j}/img_{k}.png") for j, k in need)
    if not ok: print('まだ', n); continue
    import hashlib
    for g in segs:
        s, e, fc = g['s'], g['e'], g['fc']
        ks = [round((t - s) * fc / (e - s)) for t in range(s + 1, e)]
        hs = [hashlib.md5(open(f"{U}{g['job']}/img_{k}.png", 'rb').read()).hexdigest() for k in ks]
        rep = sum(1 for i in range(1, len(hs)) if hs[i] == hs[i - 1])
        if hs and rep > len(hs) * 0.25:   # PixelLabが同じ絵を出し続けた区間は、元の絵のままにする
            print('  同じ絵が多いので元のまま', g['job'], rep, '/', len(hs)); continue
        for t in range(s, e + 1):
            k = round((t - s) * fc / (e - s)) if e > s else 0
            if t in (s, e): continue          # 端は今の絵（固定した絵）のまま
            dst = f"img/{g['job']}_{k:02d}.png"
            if not os.path.exists(D + dst): shutil.copy(f"{U}{g['job']}/img_{k}.png", D + dst)
            out[t] = dst
    M[n]['frames'] = out
    print(n, 'フレーム', T, '絵', len(set(out)))
json.dump(M, open(D + 'moves.json', 'w'), ensure_ascii=False, indent=1)
