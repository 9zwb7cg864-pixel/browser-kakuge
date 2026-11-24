// 道着キャラ男の空中コンボ
//  ・EX虚掌破 → 前ジャンプ → 空中強K/中K ＞ 空旋脚（叩きつけて床バウンド）→ 着地して強P ＞ 昇穿
//  ・EX昇穿を当てたら、地上・コンボ中・対空・画面端のどれでも、着地後の昇穿がつながる
const { KF, meta, N } = require('./harness');
const D = { 1: [-1, 1], 2: [0, 1], 3: [1, 1], 4: [-1, 0], 5: [0, 0], 6: [1, 0], 7: [-1, -1], 9: [1, -1] };
const I = (d, btn) => { const o = btn ? Object.fromEntries(btn.split(',').map(b => [b, true])) : {}; return { x: D[d][0], y: D[d][1], held: o, pressed: Object.assign({}, o) }; };
function trialPalm(jumpDelay, hkT, hpDelay, btn) {
  const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[0].x = 470; b.p[1].x = 530; b.p[0].ex = 2000;
  const m = b.p[0], o = b.p[1]; const q = [I(2), I(1), I(4, 'lp,mp')]; const log = [];
  let jumpAt = -1, ph = 0, landAt = -1;
  for (let f = 0; f < 260; f++) {
    let x = q.length ? q.shift() : null;
    if (!x) {
      if (ph === 0 && o.state === 'launch' && m.actionable()) { if (jumpAt < 0) jumpAt = f; if (f - jumpAt >= jumpDelay) { x = I(9); ph = 1; jumpAt = f; } }
      else if (ph === 1 && f - jumpAt === hkT) { x = I(5, btn); ph = 2; }
      else if (ph === 2 && m.state === 'attack' && m.connected) { q.push(I(1), I(4, 'lk')); x = I(2); ph = 3; }   // 空旋脚：↓↙← + K
      else if (ph === 3 && !m.air && m.actionable()) { if (landAt < 0) landAt = f; if (f - landAt >= hpDelay) { x = I(5, 'hp'); ph = 4; } }
      else if (ph === 4 && m.state === 'attack' && m.moveId === 'hp' && m.connected) { q.push(I(2), I(3, 'hp')); x = I(6); ph = 5; }
    }
    b.step([x || N(), N()]);
    for (const e of b.events.splice(0)) if (e.type === 'hit' && e.side === 0) log.push(e.move + '#' + e.combo);
  }
  return log.join(' ').includes('dp#') && !log.slice(1).some(x => x.endsWith('#1')) ? '○' : (log.some(x => /atatsu/.test(x)) ? '▲' : '×');
}
// 場面：raw（地上の相手に直接）・対空（相手が飛び込み）・コンボ（しゃがみ弱K＞しゃがみ弱P＞EX昇穿）・画面端
function trialDp(scene, dpDelay, strBtn) {
  const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  const m = b.p[0], o = b.p[1];
  m.x = scene === 'corner' ? 900 : 470; o.x = m.x + (scene === 'aa' ? 170 : 50); m.ex = 2000;
  if (scene === 'corner') { m.x = KF.CONST.STAGE_R ? KF.CONST.STAGE_R - 110 : m.x; o.x = m.x + 50; b.camX = m.x; }
  const q = [], p2 = [];
  if (scene === 'combo') q.push(I(2, 'lk'), ...Array(7).fill(I(2)), I(2, 'lp'), ...Array(5).fill(I(2)));
  if (scene === 'aa') { p2.push(I(7)); for (let i = 0; i < 14; i++) p2.push(N()); p2.push(I(5, 'hk')); for (let i = 0; i < 6; i++) q.push(N()); }
  let ph = 0, landAt = -1; const log = [];
  for (let f = 0; f < 240; f++) {
    let x = q.length ? q.shift() : null;
    if (!x) {
      if (ph === 0 && (scene !== 'aa' || (o.air && o.y > 150 && o.vy > 0))) { q.push(I(2), I(3, 'lp,mp')); x = I(6); ph = 1; }
      else if (ph === 1 && m.moveId === 'dp_ex' && m.connected && !m.air && m.actionable()) ph = 2;
      else if (ph === 1 && m.moveId === 'dp_ex' && !m.air && m.actionable()) ph = 2;
      if (ph === 2) { if (landAt < 0) landAt = f; if (f - landAt >= dpDelay) { q.push(I(2), I(3, strBtn)); x = I(6); ph = 3; } }
    }
    b.step([x || N(), p2.length ? p2.shift() : N()]);
    for (const e of b.events.splice(0)) if (e.type === 'hit' && e.side === 0) log.push(e.move + '#' + e.combo);
  }
  const s = log.join(' ');
  return /dp_ex/.test(s) && /\bdp#/.test(s) && !log.slice(1).some(x => x.endsWith('#1')) ? '○' : (/dp_ex/.test(s) ? '×' : '-');
}

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✘ ' + m); } }
for (const btn of ['hk', 'mk']) {
  let row = '', n = 0;
  for (const jd of [0, 4, 8]) for (let t = 4; t <= 24; t += 4) { const r = trialPalm(jd, t, 2, btn); row += r; if (r === '○') n++; }
  ok(n >= (btn === 'hk' ? 9 : 12), `EX虚掌破 → ジャンプ → 空中${btn === 'hk' ? '強K' : '中K'} ＞ 空旋脚 → 床バウンド → 強P ＞ 昇穿（ジャンプ遅れ0/4/8F × 空中技を押す4〜24F：${row} ${n}/18）`);
}
{ let row = '', n = 0; for (const hd of [0, 2, 4, 6, 8, 10]) { const r = trialPalm(0, 12, hd, 'hk'); row += r; if (r === '○') n++; } ok(n >= 5, `着地後の強Pを0〜10F遅らせても昇穿まで（${row}）`); }
for (const sc of [['raw', '地上の相手に'], ['combo', 'しゃがみ弱K＞しゃがみ弱P＞から'], ['aa', '対空で'], ['corner', '画面端で']]) {
  let row = '', n = 0;
  for (const btn of ['lp', 'mp', 'hp']) for (const d of [0, 1]) { const r = trialDp(sc[0], d, btn); row += r; if (r === '○') n++; }
  ok(n === 6, `EX昇穿を${sc[1]}当てたら、着地直後の昇穿（弱・中・強／0〜1F遅れ）がつながる（${row}）`);
  if (sc[0] !== 'aa') { const r = trialDp(sc[0], 6, 'lp'); ok(r === '×', `${sc[1]}のEX昇穿のあと、着地から6F遅れた昇穿は間に合わない（ふわっと浮きすぎない）`); }
}
console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
