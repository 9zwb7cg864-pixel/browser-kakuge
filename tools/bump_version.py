# 公開するたびに実行：index.html の読み込み先に版番号を付け、ブラウザが古い部品を使い続けないようにする
import re, time, os
p = os.path.join(os.path.dirname(__file__), '..', 'game', 'index.html')
v = time.strftime('%Y%m%d%H%M%S')
s = open(p, encoding='utf-8').read()
s = re.sub(r'(<script src="js/[^"?]+\.js)(\?v=\w+)?(")', lambda m: m.group(1) + '?v=' + v + m.group(3), s)
s = re.sub(r"(window\.KF_VER = ')\w*(')", lambda m: m.group(1) + v + m.group(2), s)
if 'window.KF_VER' not in s:
    s = s.replace('<script src="js/data.js', "<script>window.KF_VER = '" + v + "';</script>\n<script src=\"js/data.js", 1)
open(p, 'w', encoding='utf-8').write(s)
# アプリの取り置き（sw.js）の版も上げる：上げないと、アプリとして入れた人に新しい版が届かない
sw = os.path.join(os.path.dirname(__file__), '..', 'game', 'sw.js')
if os.path.exists(sw):
    t = open(sw, encoding='utf-8').read()
    t = re.sub(r"var VERSION = '\w+';", "var VERSION = '" + v + "';", t)
    open(sw, 'w', encoding='utf-8').write(t)
print('版', v)
