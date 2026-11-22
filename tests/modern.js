// モダン操作の試験：方向＋SP・SP＋強・アシスト＋SP（EX）・アシストコンボ・通常技の読み替え・投げ・ダメージ8割
const { KF, meta, N } = require('./harness');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✘ ' + m); } }
// dir: テンキー（右向き基準）、btns: 'sp,h' など
function M(dir, btns, held) {
  const x = [0, -1, 0, 1, -1, 0, 1, -1, 0, 1][dir], y = [0, 1, 1, 1, 0, 0, 0, -1, -1, -1][dir];
  const h = {}, p = {};
  (held || '').split(',').filter(Boolean).forEach(b => { h[b] = true; });
  (btns || '').split(',').filter(Boolean).forEach(b => { h[b] = true; p[b] = true; });
  return { x, y, held: h, pressed: p };
}
function fresh(gap = 60, modern = [true, false]) {
  const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta, modern });
  for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[0].x = 470; b.p[1].x = 470 + gap; b.camX = 512; b.p[0].facing = 1; b.p[1].facing = -1;
  b.p[0].ex = KF.CONST.EX_MAX; b.p[0].sup = 3000;
  return b;
}
function run(b, script, frames = 60) {
  const ev0 = b.events.length, started = [];
  const q = script.slice();
  for (let f = 0; f < frames; f++) {
    const before = b.p[0].moveSerial;
    b.step([q.length ? q.shift() : N(), N()]);
    if (b.p[0].moveSerial !== before) started.push(b.p[0].moveId);
  }
  return { started, hits: b.events.slice(ev0).filter(e => e.type === 'hit' && e.side === 0) };
}
const cases = [
  ['SP（方向なし）＝虚環弾', 5, 'sp', 'fire'],
  ['→＋SP＝昇穿', 6, 'sp', 'dp'],
  ['↓＋SP＝旋風脚', 2, 'sp', 'tatsu'],
  ['←＋SP＝虚掌破', 4, 'sp', 'palm'],
  ['SP＋強＝虚空砲（Lv1）', 5, 'sp,h', 'su1'],
  ['→＋SP＋強＝虚空砲（Lv1）', 6, 'sp,h', 'su1'],
  ['←＋SP＋強＝零界継承（Lv2）', 4, 'sp,h', 'su2'],
  ['↓＋SP＋強＝天地穿（Lv3）', 2, 'sp,h', 'su3'],
  ['弱＝立ち弱P', 5, 'l', 'lp'], ['中＝立ち中P', 5, 'm', 'mp'], ['強＝立ち強P', 5, 'h', 'hp'],
  ['↓＋弱＝しゃがみ弱K', 2, 'l', 'c_lk'], ['↓＋中＝しゃがみ中K', 2, 'm', 'c_mk'], ['↓＋強＝しゃがみ強P（対空）', 2, 'h', 'c_hp'],
  ['→＋中＝鎚打ち', 6, 'm', 'f_mp'], ['→＋強＝踏破肘', 6, 'h', 'f_hp'], ['←＋強＝旋踵', 4, 'h', 'b_hk'],
];
for (const [name, dir, btn, want] of cases) {
  const b = fresh(dir === 6 && btn === 'sp' ? 60 : 140);
  const pre = dir === 2 ? [M(2), M(2)] : dir !== 5 ? [M(dir)] : [];
  const r = run(b, pre.concat([M(dir, btn, '')]), 30);
  ok(r.started[0] === want, `${name}（出た技：${r.started[0] || 'なし'}）`);
}
{ const b = fresh(140); const e0 = b.p[0].ex; const r = run(b, [M(5, 'sp', 'auto')], 30);
  ok(r.started[0] === 'fire_ex' && b.p[0].ex === e0 - KF.CONST.EX_COST, `アシスト＋SP＝EX虚環弾（EXゲージ1本使う）（出た技：${r.started[0]}）`); }
{ const b = fresh(140); b.p[0].ex = 0; const r = run(b, [M(5, 'sp', 'auto')], 30);
  ok(r.started[0] === 'fire', `EXゲージがなければアシスト＋SPは通常の虚環弾（出た技：${r.started[0]}）`); }
{ const b = fresh(); const r = run(b, [M(5, 'l,m')], 40); ok(b.p[1].state === 'thrown' || r.started[0] === 'throw', '弱＋中＝投げ'); }
{ const b = fresh(140); const r = run(b, [M(9)], 14); const r2 = run(b, [M(5, 'sp')], 20); ok(r2.started.includes('atatsu'), `空中でSP＝空旋脚（出た技：${r2.started.join(',') || 'なし'}）`); }
// ダメージ8割：同じ当て方で、クラシックの虚環弾とモダンのSP虚環弾を比べる
{ const bc = fresh(90, [false, false]); const rc = run(bc, [M(2), M(3), M(6, 'lp')], 80);
  const bm = fresh(90, [true, false]); const rm = run(bm, [M(5, 'sp')], 80);
  const dc = 10000 - bc.p[1].hp, dm = 10000 - bm.p[1].hp;
  ok(dc > 0 && dm > 0 && Math.abs(dm / dc - 0.8) < 0.05, `SPで出した必殺技はダメージ8割（クラシック ${dc} ／ モダン ${dm}）`); }
// レバー入力＋弱・中・強なら、モダンでも普通のダメージで必殺技が出る
{ const b = fresh(90); const r = run(b, [M(2), M(3), M(6, 'l')], 80);
  ok(r.started[0] === 'fire' && 10000 - b.p[1].hp === 600, `モダンでも↓↘→＋弱で虚環弾が出て、ダメージは10割（${10000 - b.p[1].hp}）`); }
// アシストコンボ：アシストを押しながら同じボタンを連打
function assist(key, gap, n, sup) {
  const b = fresh(gap); b.p[0].sup = sup;
  const q = [];
  for (let i = 0; i < n; i++) { q.push(M(5, key, 'auto')); for (let j = 0; j < 9; j++) q.push(M(5, '', 'auto')); }
  const r = run(b, q, 420);
  return { r, combo: Math.max(0, ...r.hits.map(h => h.combo)), dmg: 10000 - b.p[1].hp };
}
for (const [key, name, sup] of [['l', 'アシスト＋弱', 1000], ['m', 'アシスト＋中', 1000], ['h', 'アシスト＋強', 3000]]) {
  const a = assist(key, 50, 14, 3000);
  ok(a.combo >= 3, `${name}を連打でコンボ（${a.r.started.join(' → ')}／${a.combo}ヒット ${a.dmg}ダメージ）`);
}

// ---- 変身キャラ男（ハンマー形態・大盾形態）
function freshK(kind, gap) {
  const b = new KF.Battle({ p1: kind, p2: 'kokuu', meta, modern: [true, false] });
  for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[0].x = 470; b.p[1].x = 470 + gap; b.camX = 512; b.p[0].facing = 1; b.p[1].facing = -1;
  b.p[0].ex = KF.CONST.EX_MAX; b.p[0].sup = 3000;
  return b;
}
for (const [kind, list] of [
  ['gai_h', [['SP', 5, 'quake'], ['→＋SP', 6, 'upper'], ['↓＋SP', 2, 'leap'], ['←＋SP', 4, 'spin'], ['SP＋強', 5, 'su1', 'sp,h'], ['←＋SP＋強', 4, 'su2', 'sp,h'], ['↓＋SP＋強', 2, 'su3', 'sp,h']]],
  ['gai_s', [['SP', 5, 'charge'], ['→＋SP', 6, 'lift'], ['↓＋SP', 2, 'reflect'], ['←＋SP', 4, 'counter'], ['SP＋強', 5, 'su1', 'sp,h'], ['←＋SP＋強', 4, 'su2', 'sp,h'], ['↓＋SP＋強', 2, 'su3', 'sp,h']]],
]) {
  const fn = KF.CHARS[kind].form;
  for (const [name, dir, want, btn] of list) {
    const b = freshK(kind, 140);
    const pre = dir === 2 ? [M(2), M(2)] : dir !== 5 ? [M(dir)] : [];
    const r = run(b, pre.concat([M(dir, btn || 'sp', '')]), 30);
    ok(r.started[0] === want, `${fn}：${name}＝${want}（出た技：${r.started[0] || 'なし'}）`);
  }
  { const b = freshK(kind, 140); const r = run(b, [M(2), M(2), M(5), M(5), M(2, 'sp')], 60);
    ok(r.started[0] === 'change' && b.p[0].kind === KF.CHARS[kind].other, `${fn}：↓↓＋SPで変身（出た技：${r.started[0] || 'なし'} → ${b.p[0].kind}）`); }
  for (const key of ['l', 'm', 'h']) {
    const b = freshK(kind, 50); b.p[0].sup = key === 'h' ? 3000 : 1000;
    const q = []; for (let i = 0; i < 14; i++) { q.push(M(5, key, 'auto')); for (let j = 0; j < 9; j++) q.push(M(5, '', 'auto')); }
    b.p[0].sup = 3000; const r = run(b, q, 420); const combo = Math.max(0, ...r.hits.map(h => h.combo));
    ok(combo >= 3, `${fn}：アシスト＋${{ l: '弱', m: '中', h: '強' }[key]}を連打でコンボ（${r.started.join(' → ')}／${combo}ヒット ${10000 - b.p[1].hp}ダメージ）`);
  }
}

// アシスト＋ボタンを押しっぱなしでも最後まで続けて出る
for (const kind of ['kokuu', 'gai_h', 'gai_s']) for (const key of ['l', 'm', 'h']) {
  const b = freshK(kind, 50); const q = [M(5, key, 'auto')];
  for (let i = 0; i < 300; i++) q.push({ x: 0, y: 0, held: { auto: true, [key]: true }, pressed: {} });
  const r = run(b, q, 420); const seqLen = KF.MODERN_AUTO[kind][key].length;
  const combo = Math.max(0, ...r.hits.map(h => h.combo));
  ok(r.started.some(m => /^su/.test(m)) && combo >= 5, `${KF.CHARS[kind].name}${KF.CHARS[kind].form ? '（' + KF.CHARS[kind].form + '）' : ''}：アシスト＋${{ l: '弱', m: '中', h: '強' }[key]}押しっぱなしで${seqLen}手のコンボを最後まで（${r.started.join(' → ')}／${combo}ヒット ${10000 - b.p[1].hp}ダメージ）`);
}
console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
