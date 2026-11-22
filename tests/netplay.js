// オンライン対戦（ロールバック）の試験：2台分を、遅延・揺らぎ・時計のずれのある回線でつないで動かし、
// 両方の画面の計算結果が、正しい入力で最初から計算した結果と1フレームもずれないかを確かめる
const { KF, meta } = require('./harness');
const R = KF.Rollback;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✘ ' + m); } }

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
// 人が遊んでいるような入力（方向を数フレーム保持・ボタンをときどき押す・コマンドを入れる）
function player(seed) {
  const r = rng(seed); let cur = { x: 0, y: 0, held: {} }, left = 0, seq = [];
  const B = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'rush'];
  return () => {
    if (seq.length) { cur = seq.shift(); return cur; }
    if (--left > 0) { const h = {}; for (const k in cur.held) if (r() < 0.6) h[k] = cur.held[k]; cur = { x: cur.x, y: cur.y, held: h }; return cur; }
    left = 1 + Math.floor(r() * 12);
    const q = r();
    if (q < 0.15) { const b = B[Math.floor(r() * 6)]; seq = [[0, 1], [1, 1], [1, 0]].map(([x, y], i) => ({ x, y, held: i === 2 ? { [b]: true } : {} })); return cur = seq.shift(); }
    const held = {}; if (r() < 0.45) held[B[Math.floor(r() * B.length)]] = true;
    cur = { x: Math.floor(r() * 3) - 1, y: r() < 0.15 ? -1 : r() < 0.3 ? 1 : 0, held };
    return cur;
  };
}

function run(o) {
  const r = rng(o.seed);
  const mk = () => new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta });
  const q = [[], []]; let now = 0;
  const last = [0, 0];
  const peers = [0, 1].map(side => new R({ side, delay: o.delay, keepHistory: true, makeBattle: mk, send: m => {
    const lat = o.lat + r() * o.jit; let at = now + lat; at = Math.max(at, last[side]); last[side] = at;   // 順番は保つ（reliable）
    q[1 - side].push({ at, m: JSON.parse(JSON.stringify(m)) });
  } }));
  const inp = [player(o.seed * 7 + 1), player(o.seed * 7 + 2)];
  const next = [0, o.startGap || 0], period = [1000 / 60, 1000 / 60 * (o.drift || 1)];
  const T = o.ms;
  for (now = 0; now < T; now += 1) {
    for (let s = 0; s < 2; s++) { while (q[s].length && q[s][0].at <= now) peers[s].receive(q[s].shift().m); }
    for (let s = 0; s < 2; s++) if (now >= next[s]) { next[s] += period[s]; peers[s].tick(inp[s]()); }
  }
  // 正解：確定した入力で最初から計算
  const A = peers[0], B = peers[1];
  const upto = Math.min(A.lastRemote, B.lastRemote, A.frame - 1, B.frame - 1);
  const ref = mk(); let bad = -1, cmpN = 0; let prev = [0, 0];
  for (let f = 0; f <= upto; f++) {
    const l0 = A.local[f], l1 = B.local[f];
    if (l0 == null || l1 == null) break;
    ref.step([R.unpack(l0, prev[0]), R.unpack(l1, prev[1])]); prev = [l0, l1];
    const h = KF.hashBattle(ref);
    if (A.hashes[f] != null && B.hashes[f] != null) { cmpN++; if (A.hashes[f] !== h || B.hashes[f] !== h) { bad = f; break; } }
  }
  return { A, B, upto, bad, cmpN, phase: ref.phase, hp: ref.p.map(f => f.hp) };
}

const cases = [
  { name: '近い回線（片道20ms）', lat: 20, jit: 10, delay: 2, ms: 60000, seed: 1 },
  { name: '普通の回線（片道50ms・揺らぎ30ms）', lat: 50, jit: 30, delay: 2, ms: 60000, seed: 2 },
  { name: '遠い回線（片道90ms・揺らぎ60ms）', lat: 90, jit: 60, delay: 3, ms: 60000, seed: 3 },
  { name: '開始のずれ200ms・相手の時計が1%遅い', lat: 40, jit: 20, delay: 2, ms: 60000, seed: 4, startGap: 200, drift: 1.01 },
];
for (const c of cases) {
  const t0 = Date.now(); const r = run(c);
  const per = (Date.now() - t0) / (r.A.ticks + r.B.ticks);
  ok(r.bad < 0 && r.cmpN > 1000 && !r.A.desync && !r.B.desync,
    `${c.name}：${r.upto}フレーム（${Math.round(r.upto / 60)}秒）両方とも正解と一致（照合${r.cmpN}F／巻き戻し ${r.A.rollbacks}回・最大${r.A.maxRolled}F／待ち ${r.A.stalls}・${r.B.stalls}回／1フレーム平均${per.toFixed(2)}ms）` + (r.bad >= 0 ? ` ずれたフレーム ${r.bad}` : ''));
  ok(r.upto > c.ms / 1000 * 60 * 0.85, `${c.name}：止まらずに進む（${r.upto} / ${Math.round(c.ms / 1000 * 60)}フレーム）`);
}
console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
