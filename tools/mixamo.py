"""Mixamo の Collada（.dae、骨だけ）を読み、毎コマの関節の位置（cm、Y上・Z前）を出す"""
import re, sys, xml.etree.ElementTree as ET
import numpy as np

NS = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}
KEEP = dict(pel='Hips', spine='Spine2', neck='Neck', head='Head', top='HeadTop_End',
            shL='LeftArm', elL='LeftForeArm', handL='LeftHand', fingL='LeftHandMiddle1',
            shR='RightArm', elR='RightForeArm', handR='RightHand', fingR='RightHandMiddle1',
            hipL='LeftUpLeg', knL='LeftLeg', anL='LeftFoot', toeL='LeftToeBase', tipL='LeftToe_End',
            hipR='RightUpLeg', knR='RightLeg', anR='RightFoot', toeR='RightToeBase', tipR='RightToe_End')


def load(path):
    root = ET.parse(path).getroot()
    anims = {}
    for a in root.iter('{%s}animation' % NS['c']):
        srcs = {s.get('id'): s for s in a.findall('c:source', NS)}
        ch = a.find('c:channel', NS)
        if ch is None: continue
        tgt = ch.get('target').split('/')[0]
        inp = out = None
        for s in srcs.values():
            fa = s.find('c:float_array', NS)
            if fa is None: continue
            if s.get('id').endswith('input'): inp = np.array(fa.text.split(), float)
            elif 'output' in s.get('id'): out = np.array(fa.text.split(), float).reshape(-1, 4, 4)
        anims[tgt] = (inp, out)
    n = max(len(v[0]) for v in anims.values())
    times = next(v[0] for v in anims.values() if len(v[0]) == n)
    scene = root.find('.//c:library_visual_scenes/c:visual_scene', NS)
    pos = {}

    def walk(node, parent):           # parent: (n,4,4)
        nid = node.get('id')
        m = node.find('c:matrix', NS)
        local = np.array(m.text.split(), float).reshape(4, 4) if m is not None else np.eye(4)
        if nid in anims:
            loc = anims[nid][1]
            if len(loc) < n: loc = np.concatenate([loc, np.repeat(loc[-1:], n - len(loc), 0)])
        else:
            loc = np.repeat(local[None], n, 0)
        world = parent @ loc
        short = nid.replace('mixamorig_', '')
        pos[short] = world[:, :3, 3].copy()
        for c in node.findall('c:node', NS): walk(c, world)

    for node in scene.findall('c:node', NS):
        walk(node, np.repeat(np.eye(4)[None], n, 0))
    J = {k: pos[v] for k, v in KEEP.items() if v in pos}
    return times, J


if __name__ == '__main__':
    t, J = load(sys.argv[1])
    print(len(t), t[1] - t[0], sorted(J))
    for k in ('pel', 'top', 'handL', 'handR', 'anL', 'anR'):
        print(k, J[k][0].round(1), J[k].min(0).round(1), J[k].max(0).round(1))
