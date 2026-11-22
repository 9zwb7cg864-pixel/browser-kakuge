// エンジンをNodeで動かすテスト用ハーネス
const fs = require('fs'), vm = require('vm'), path = require('path');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.addEventListener = () => {};
global.navigator = {};
const G = path.join(__dirname, '..', 'game');
for (const f of ['data.js', 'input.js', 'engine.js', 'ai.js', 'net.js']) {
  const p = path.join(G, 'js', f);
  if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: f });
}
const meta = {};
for (const k of ['kokuu', 'shuuen']) meta[k] = KF.prepAnims(JSON.parse(fs.readFileSync(path.join(G, 'assets', k, 'anims.json'))));
const N = () => ({ x: 0, y: 0, held: {}, pressed: {} });
function inp(dir, btns, prevHeld) {
  // dir: numpad (右向き基準の絶対方向) / btns: 'lp,lk'
  const x = [0, -1, 0, 1, -1, 0, 1, -1, 0, 1][dir], y = [0, 1, 1, 1, 0, 0, 0, -1, -1, -1][dir];
  const held = {}, pressed = {};
  (btns || '').split(',').filter(Boolean).forEach(b => { held[b] = true; pressed[b] = true; });
  return { x, y, held, pressed };
}
function battle(p1 = 'kokuu', p2 = 'shuuen', training = false) {
  const b = new KF.Battle({ p1, p2, meta, training });
  if (!training) for (let i = 0; i < 130; i++) b.step([N(), N()]);
  return b;
}
module.exports = { KF, meta, battle, inp, N };
