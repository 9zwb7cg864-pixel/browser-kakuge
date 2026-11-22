// 変身キャラ男の追加技：特殊技・ターゲットコンボ2・コマンド投げ・空中必殺技・飛び道具が出て当たる
const { KF, meta, N } = require('./harness');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✘ ' + m); } }
const D = { 1: [-1, 1], 2: [0, 1], 3: [1, 1], 4: [-1, 0], 5: [0, 0], 6: [1, 0], 7: [-1, -1], 8: [0, -1], 9: [1, -1] };
const I = (d, btn) => { const o = btn ? Object.fromEntries(btn.split(',').map(b => [b, true])) : {}; return { x: D[d][0], y: D[d][1], held: o, pressed: Object.assign({}, o) }; };
function run(kind, seq, gap, block) {
  const b = new KF.Battle({ p1: kind, p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[0].x = 470; b.p[1].x = 470 + gap; b.p[0].ex = 2000;
  const ev0 = b.events.length, st = [];
  const q = seq.concat(Array(90).fill(null));
  for (const x of q) { const s0 = b.p[0].moveSerial; b.step([x || N(), block ? I(6) : N()]); if (b.p[0].moveSerial !== s0) st.push(b.p[0].moveId); }
  const ev = b.events.slice(ev0).filter(e => e.side === 0);
  return { st, hit: ev.filter(e => e.type === 'hit').map(e => e.move), blk: ev.filter(e => e.type === 'block').map(e => e.move), b };
}
const J = Array(6).fill(I(9)).concat(Array(6).fill(I(5)));
const TC = [I(5, 'mk')].concat(Array(8).fill(I(5)), [I(5, 'hk')]);
const cases = [
  ['gai_h', '←＋強P 槌突き', [I(4, 'hp')], 90, 'b_hp'],
  ['gai_h', '→＋中K すくい打ち（下段）', [I(6, 'mk')], 110, 'f_mk'],
  ['gai_h', '中K～強K 回し打ち', TC, 70, 'tc_hk'],
  ['gai_h', '→↘↓↙←＋P 担ぎ叩き', [I(6), I(3), I(2), I(1), I(4, 'lp')], 60, 'grab'],
  ['gai_h', '空中で↓↘→＋P 空中叩きつけ', J.concat([I(2), I(3), I(6, 'lp')]), 160, 'aslam'],
  ['gai_s', '←＋強P 盾押し', [I(4, 'hp')], 80, 'b_hp'],
  ['gai_s', '→＋中K 盾すべり（下段）', [I(6, 'mk')], 130, 'f_mk'],
  ['gai_s', '中K～強K 盾連打', TC, 70, 'tc_hk'],
  ['gai_s', '↓↙←＋P 光盾投げ', [I(2), I(1), I(4, 'lp')], 260, 'disc'],
  ['gai_s', '空中で↓↘→＋K 盾落下', J.concat([I(2), I(3), I(6, 'lk')]), 120, 'sdrop'],
  ['gai_h', 'EX担ぎ叩き', [I(6), I(3), I(2), I(1), I(4, 'lp,mp')], 80, 'grab_ex'],
  ['gai_s', 'EX光盾投げ', [I(2), I(1), I(4, 'lp,mp')], 260, 'disc_ex'],
];
for (const [kind, name, seq, gap, id] of cases) {
  const r = run(kind, seq, gap);
  const landed = r.hit.includes(id) || (/grab/.test(id) && r.b.p[1].hp < 10000 && r.st.includes(id));
  ok(r.st.includes(id) && landed, `${KF.CHARS[kind].form}：${name}が出て当たる（出た技：${r.st.join(',')} / 相手の体力 ${r.b.p[1].hp}）`);
}
// ガードされても有利な特殊技
for (const kind of ['gai_h', 'gai_s']) {
  const r = run(kind, [I(4, 'hp')], 85, true);
  ok(r.blk.includes('b_hp'), `${KF.CHARS[kind].form}：←＋強P はガードされる（相手がガード）`);
}

// 変身キャンセル：必殺技が当たったら変身でキャンセルでき、1コンボに1回だけ
{
  const CH = [I(5), I(2), I(2), I(5), I(5), I(2, 'lp')];
  const b = new KF.Battle({ p1: 'gai_h', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[0].x = 470; b.p[1].x = 530;
  const plan = [[0, [I(5, 'hp')]], [14, [I(2), I(3), I(6, 'hp')]], [24, CH], [52, [I(2), I(3), I(6, 'hp')]], [62, CH]];
  let f = 0, kinds = [];
  for (const [at, xs] of plan) { while (f < at) { b.step([N(), N()]); f++; kinds.push(b.p[0].kind); } for (const x of xs) { b.step([x, N()]); f++; kinds.push(b.p[0].kind); } }
  for (let i = 0; i < 60; i++) { b.step([N(), N()]); kinds.push(b.p[0].kind); }
  const swaps = kinds.filter((k, i) => i && k !== kinds[i - 1]).length;
  const ann = b.events.filter(e => e.type === 'announce' && e.text === '変身キャンセル').length;
  ok(swaps === 1 && ann === 1, `強P ＞ 地割れ ＞ 変身キャンセル（1回目は出る）／ 盾突進 ＞ もう一度変身 は出ない（変身 ${swaps}回）`);
}
console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
