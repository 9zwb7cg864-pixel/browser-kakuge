// コンボ表の全コンボが、人が押せるタイミングで成立するかを確認する
//  キャンセル（＞・～）：前の技が当たってから c フレーム後に入力（c を 1〜14 で振る）
//  目押し（，）：自分の硬直が解けるフレームを 0 として、k フレームずれて押す（k を -6〜+6 で振る）
//  飛び込み：前ジャンプ → 降りぎわにジャンプ攻撃
//  パニッシュカウンター：相手が技を空振り → その戻りに当てる
const { KF, meta, inp, N } = require('./harness');

function setup(kind, combo) {
  const opp = 'kokuu';
  const b = new KF.Battle({ p1: kind, p2: opp, meta });
  for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[0].sup = combo.sup || 0; b.p[0].ex = KF.CONST.EX_MAX; b.p[0].rush = 6000; b.camX = 512;
  b.p[0].x = 470; b.p[1].x = 470 + (combo.gap || 46);
  if (combo.corner) { b.camX = KF.CONST.WORLD_W - KF.CONST.W / 2; b.p[1].x = b.limits()[1]; b.p[0].x = b.p[1].x - (combo.gap || 46); }
  b.p[0].facing = 1; b.p[1].facing = -1;
  return b;
}

// 最初の一撃を当てるまで（通常／飛び込み／パニッシュカウンター）
function opener(b, combo, q, p2q) {
  if (combo.jumpIn) {
    b.p[1].x = b.p[0].x + 150;
    q.push(inp(9));
    for (let i = 0; i < 4; i++) q.push(N());
    return { waitAir: combo.jumpIn };
  }
  if (combo.punish) {
    // 相手が前に届かない技（しゃがみ強P）を空振り → 戻りに自分の強K
    b.p[1].x = b.p[0].x + (combo._gap || 100);
    p2q.push(inp(2, 'hp')); for (let i = 0; i < 6; i++) p2q.push(inp(2));
    for (let i = 0; i < (combo._pcT || 10); i++) q.push(N());
    q.push(inp(5, combo.punish));
    return {};
  }
  return null;
}

function run(kind, combo, c, k) {
  const b = setup(kind, combo);
  const q = [], p2q = [];
  let steps = combo.steps.slice();
  const op = opener(b, combo, q, p2q);
  if (!op) { const s0 = steps.shift(); push(q, s0); }
  let cnt = 0, si = 0, phase = 'wait', hitSeen = 0, waitT = 0, airDone = !(op && op.waitAir), maxCombo = 0, pc = false, broken = false, firstDone = false;
  function push(qq, st) {
    if (st.m) st.m.forEach((d, i) => qq.push(inp(d, i === st.m.length - 1 ? st.b : '')));
    else { qq.push(inp(st.d || 5, st.b)); if (st.d) for (let i = 0; i < 8; i++) qq.push(inp(st.d)); }
  }
  for (let f = 0; f < 420; f++) {
    const a = b.p[0];
    if (!airDone && a.air && a.vy > 0.5 && a.y > 150) { q.push(inp(5, op.waitAir)); airDone = true; }
    const ev0 = b.events.length;
    b.step([q.length ? q.shift() : N(), p2q.length ? p2q.shift() : N()]);
    for (const e of b.events.slice(ev0)) {
      if (e.type === 'hit' && e.side === 0) { hitSeen++; if (e.combo === 1 && firstDone) broken = true; firstDone = true; maxCombo = Math.max(maxCombo, e.combo); if (process.env.SHOWHITS) (run.log = run.log || []).push(e.move + '#' + e.combo); }
      if (e.type === 'announce' && e.text === 'PUNISH COUNTER') pc = true;
    }
    if (si >= steps.length || q.length) continue;
    const st = steps[si];
    if (phase === 'wait') {
      if (st.noHit || hitSeen > 0) { hitSeen = 0; phase = st.link ? 'link' : 'delay'; waitT = st.wait != null ? st.wait : c; }
    }
    if (phase === 'delay') {
      if (--waitT <= 0) { push(q, st); si++; phase = 'wait'; }
    } else if (phase === 'link') {
      // 硬直が解けるまでの残りフレーム（1＝次のフレームから動ける）
      const left = a.actionable() ? 0 : (a.state === 'attack' ? a.hs + a.remaining() + 1 : (a.state === 'land' ? Math.max(0, 3 - a.t) : 99));
      if (k < 0 && left === -k) { push(q, st); si++; phase = 'wait'; cnt = 0; }
      else if (k >= 0 && a.actionable()) { if (cnt++ >= k) { push(q, st); si++; phase = 'wait'; cnt = 0; } }
    }
  }
  steps.forEach(s => { s._k = null; s._cnt = 0; });
  // 途中でコンボが途切れた（数え直しになった）ものは不成立
  return { hits: broken ? 0 : maxCombo, dmg: b.p[1].D.hp - b.p[1].hp, pc };
}

let fail = 0;
// CAND=ファイル名 で、試しのコンボ一覧だけを測る
if (process.env.CAND) KF.COMBOS = { [process.env.CANDKIND || 'kokuu']: require(require('path').resolve(process.env.CAND)) };
else KF.COMBOS = { kokuu: KF.COMBOS.kokuu };
for (const kind of Object.keys(KF.COMBOS)) {
  console.log('■ ' + KF.CHARS[kind].name);
  for (const combo of KF.COMBOS[kind]) {
    const need = combo.steps.filter(s => s.b !== 'rush').length + (combo.jumpIn || combo.punish ? 1 : 0) - (combo.jumpIn || combo.punish ? 0 : 0);
    const want = combo.steps.filter(s => s.b !== 'rush').length + (combo.jumpIn || combo.punish ? 1 : 0);
    const hasLink = combo.steps.some(s => s.link);
    let best = null, row = '', okCount = 0;
    if (combo.punish) { // パニッシュカウンターになる押しタイミングを探す
      let found = false;
      for (const g of [100, 95, 90, 105, 115, 125, 135]) { combo._gap = g;
        for (let t = 2; t <= 26 && !found; t++) { combo._pcT = t; const r = run(kind, combo, 3, -1); if (r.pc) found = true; }
        if (found) break; }
    }
    if (hasLink) {
      for (let k = -6; k <= 6; k++) {
        const r = run(kind, combo, 3, k);
        const ok = r.hits >= want && (!combo.punish || r.pc);
        row += ok ? '○' : '×'; if (ok) { okCount++; if (!best || r.dmg > best.dmg) best = r; }
      }
    } else {
      for (let c = 1; c <= 14; c++) {
        const r = run(kind, combo, c, 0);
        const ok = r.hits >= want && (!combo.punish || r.pc);
        row += ok ? '○' : '×'; if (ok) { okCount++; if (!best) best = r; }
      }
    }
    const pass = okCount >= (hasLink ? 2 : 3);
    if (!pass) fail++;
    console.log(`  ${pass ? '✔' : '✘'} ${combo.name}：${combo.text}`);
    console.log(`      ${hasLink ? '目押しのずれ -6〜+6F' : '入力の遅れ 1〜14F'}: ${row}（成立 ${okCount}F）${best ? `  ${best.hits}hit ${best.dmg}ダメージ` : ''}`);
  }
}
console.log(fail ? `\n${fail} 件つながらない` : '\nすべてのコンボが成立');
process.exit(fail ? 1 : 0);
