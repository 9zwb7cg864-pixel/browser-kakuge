const { match } = require('./sim');
const L = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];
const n = +(process.argv[2] || 6);
for (let i = 0; i < 3; i++) {
  const hi = L[i + 1], lo = L[i];
  let w = 0, tot = 0, st = { rush: 0, rc: 0, sup: 0, blk: 0, hits: 0, combo: 0 };
  for (let k = 0; k < n; k++) {
    const swap = k % 2; const ch = ['kokuu', 'kokuu'];
    const r = swap ? match(ch[0], ch[1], lo, hi, 50 + k) : match(ch[0], ch[1], hi, lo, 50 + k);
    const hiSide = swap ? 1 : 0;
    if (r.winner === hiSide) w++; tot++;
    st.rush += r.stats.rush[hiSide]; st.rc += r.stats.rushc[hiSide]; st.sup += r.stats.supers[hiSide];
    st.blk += r.stats.blocks[1 - hiSide]; st.hits += r.stats.hits[hiSide]; st.combo = Math.max(st.combo, r.stats.maxCombo[hiSide]);
  }
  console.log(`${hi} vs ${lo}: ${hi}の勝ち ${w}/${tot}  (${hi}側 ラッシュ${st.rush} ラッシュC${st.rc} 超必殺${st.sup} 最大コンボ${st.combo} / 相手のガード${st.blk})`);
}
