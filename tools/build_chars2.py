"""全キャラ・全モーションを生成して game/assets/<kind>/ に書き出す"""
import json, os, sys, time
from concurrent.futures import ProcessPoolExecutor
from PIL import Image
import moves2 as moves
import moves_gai


def defs_for(kind):
    return moves_gai.defs(kind) if kind.startswith('gai') else moves.defs(kind)
from anim2 import build as build_anim
from art import FW, FH

ROOT = os.path.join(os.path.dirname(__file__), '..', 'game', 'assets')


def job(args):
    kind, idx = args
    a = defs_for(kind)[idx]
    out = os.path.join(ROOT, kind)
    meta, imgs = build_anim(kind, a, out)
    return a.name, meta, len(imgs)


def main(kinds=('kokuu', 'shuuen'), only=None):
    for kind in kinds:
        os.makedirs(os.path.join(ROOT, kind), exist_ok=True)
        defs = defs_for(kind)
        idxs = [i for i, a in enumerate(defs) if only is None or a.name in only]
        t = time.time()
        with ProcessPoolExecutor() as ex:
            res = list(ex.map(job, [(kind, i) for i in idxs]))
        mfile = os.path.join(ROOT, kind, 'anims.json')
        allm = {}
        if only and os.path.exists(mfile):
            allm = json.load(open(mfile))['anims']
        total = 0
        for name, meta, n in res:
            allm[name] = meta
        total = sum(len(m['frames']) for m in allm.values())
        json.dump({'frameW': FW, 'frameH': FH, 'anchor': [112, 190], 'anims': allm},
                  open(mfile, 'w'), separators=(',', ':'))
        print(kind, 'anims', len(allm), 'frames', total, '%.1fs' % (time.time() - t))


if __name__ == '__main__':
    only = sys.argv[1:] or None
    main(only=set(only) if only else None)
