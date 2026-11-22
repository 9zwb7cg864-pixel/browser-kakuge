"""単体版（HTML1枚）を作る：素材をすべて埋め込むので、ダブルクリックで開くだけで遊べる"""
import base64, json, os, re
G = os.path.join(os.path.dirname(__file__), '..', 'game')
OUT = os.path.join(os.path.dirname(__file__), '..', 'dist')
os.makedirs(OUT, exist_ok=True)
emb = {'json': {}, 'img': {}}
for root, _, fs in os.walk(os.path.join(G, 'assets')):
    for f in fs:
        p = os.path.join(root, f); rel = os.path.relpath(p, G).replace(os.sep, '/')
        if f.endswith('.json'):
            emb['json'][rel] = json.load(open(p))
        elif f.endswith('.png'):
            emb['img'][rel] = 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
html = open(os.path.join(G, 'index.html'), encoding='utf-8').read()
def inline(m):
    src = m.group(1)
    return '<script>\n' + open(os.path.join(G, src), encoding='utf-8').read().replace('</script', '<\\/script') + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
html = html.replace('<script>', '<script>window.KF_EMBED = ' + json.dumps(emb, separators=(',', ':')) + ';</script>\n<script>', 1)
fn = os.path.join(OUT, 'dairantou_street_fight.html')
open(fn, 'w', encoding='utf-8').write(html)
print(fn, round(os.path.getsize(fn) / 1e6, 1), 'MB')
