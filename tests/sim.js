// CPU同士の対戦シミュレーション
const { KF, meta } = require('./harness');
function makeSrc(ai) {
  let prev = {};
  return () => { const o = ai.output(); const p = {}; for (const k in o.held) p[k] = o.held[k] && !prev[k]; prev = Object.assign({}, o.held); return { x: o.x, y: o.y, held: o.held, pressed: p }; };
}
function match(p1, p2, l1, l2, seed) {
  const b = new KF.Battle({ p1, p2, meta });
  const a1 = new KF.AI(b, 0, l1, seed), a2 = new KF.AI(b, 1, l2, seed * 7 + 3);
  const s1 = makeSrc(a1), s2 = makeSrc(a2);
  const stats = { hits: [0, 0], blocks: [0, 0], supers: [0, 0], rush: [0, 0], rushc: [0, 0], maxCombo: [0, 0], tech: 0, ko: 0, specials: {} , frames: 0};
  let ev = 0;
  for (let f = 0; f < 60 * 60 * 8 && b.phase !== 'over'; f++) {
    a1.update(); a2.update();
    b.step([s1(), s2()]);
    for (; ev < b.events.length; ev++) {
      const e = b.events[ev];
      if (e.type === 'hit') { stats.hits[e.side]++; stats.maxCombo[e.side] = Math.max(stats.maxCombo[e.side], e.combo); stats.specials[e.move] = (stats.specials[e.move] || 0) + 1; }
      if (e.type === 'block') stats.blocks[e.side]++;
      if (e.type === 'super') stats.supers[e.side]++;
      if (e.type === 'rush') stats.rush[e.side]++;
      if (e.type === 'rushcancel') stats.rushc[e.side]++;
      if (e.type === 'announce' && e.text === '投げ抜け') stats.tech++;
    }
    stats.frames = f;
  }
  return { winner: b.matchOver ? b.matchOver.winner : 'none', wins: b.wins, rounds: b.round, stats, b };
}
module.exports = { match, makeSrc };
if (require.main === module) {
  const [l1, l2, n, p1, p2] = [process.argv[2] || 'EXPERT', process.argv[3] || 'EASY', +(process.argv[4] || 4), process.argv[5] || 'kokuu', process.argv[6] || 'shuuen'];
  let w = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const r = match(p1, p2, l1, l2, 1000 + i * 17);
    w[r.winner === -1 ? 2 : r.winner === 'none' ? 2 : r.winner]++;
    const s = r.stats;
    console.log(`#${i} winner=${r.winner} wins=${r.wins} rounds=${r.rounds} hits=${s.hits} blocks=${s.blocks} supers=${s.supers} rush=${s.rush} rc=${s.rushc} maxCombo=${s.maxCombo} tech=${s.tech} sec=${(s.frames/60).toFixed(0)}`);
  }
  console.log(`${p1}(${l1}) vs ${p2}(${l2}):`, w);
}
