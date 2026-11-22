// ↓↓P（変身）の受付：人の押し方のばらつき（↓の長さ・離す長さ・Pの直前に↓を離す）を広く受け付け、しゃがみ技のつなぎには化けない
const { KF, meta, N } = require('./harness');
const I = (y, btn) => ({ x: 0, y, held: btn ? { [btn]: true } : {}, pressed: btn ? { [btn]: true } : {} });
function tryDD(d1, gap, d2, rel, kind = 'gai_h', pre = 0) {
  const b = new KF.Battle({ p1: kind, p2: 'kokuu', meta });
  for (let i = 0; i < 130; i++) b.step([N(), N()]);
  const q = [];
  for (let i = 0; i < pre; i++) q.push(I(1));          // しゃがんだまま待つ
  if (pre) for (let i = 0; i < 4; i++) q.push(I(0));
  for (let i = 0; i < d1; i++) q.push(I(1));
  for (let i = 0; i < gap; i++) q.push(I(0));
  for (let i = 0; i < d2 - 1; i++) q.push(I(1));
  if (rel < 0) q.push(I(1, 'lp')); else { q.push(I(1)); for (let i = 0; i < rel - 1; i++) q.push(I(0)); q.push(I(0, 'lp')); }
  for (const x of q) b.step([x, N()]);
  for (let i = 0; i < 40; i++) b.step([N(), N()]);
  return b.p[0].kind !== kind;
}
let tot = 0, okc = 0; const fails = [];
for (const d1 of [2, 4, 6, 8, 10, 12, 15]) for (const gap of [1, 3, 5, 7, 9, 12]) for (const d2 of [1, 3, 6, 10]) for (const rel of [-1, 1, 2, 3]) {
  tot++; if (tryDD(d1, gap, d2, rel)) okc++; else fails.push(`↓${d1}F 離す${gap}F ↓${d2}F ${rel < 0 ? '↓のままP' : 'Pの' + rel + 'F前に↓を離す'}`);
}
let pass = 0, fail = 0; function ok(c, m) { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✘ ' + m); } }
ok(okc >= tot - 8, `↓↓Pの押し方 ${tot}通りのうち ${okc}通りで変身（出ないのは全体が0.6秒を超えるゆっくり入力だけ）`);
fails.forEach(f => console.log('      出ない：' + f));
// しゃがみ弱K → 立つ → しゃがみ弱P は変身しない（何もない所で）
{ const b = new KF.Battle({ p1: 'gai_h', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[1].x = b.p[0].x + 400;
  const q = [I(1), I(1, 'lk')]; for (let i = 0; i < 14; i++) q.push(I(1)); for (let i = 0; i < 3; i++) q.push(I(0)); q.push(I(1)); q.push(I(1, 'lp'));
  for (const x of q) b.step([x, N()]); for (let i = 0; i < 30; i++) b.step([N(), N()]);
  ok(b.p[0].kind === 'gai_h', 'しゃがみ弱K → 立つ → しゃがみ弱P は変身に化けない'); }
// しゃがみ弱P を当てて、↓を離して ↓＋P → キャンセル変身
{ const b = new KF.Battle({ p1: 'gai_h', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[1].x = b.p[0].x + 60;
  const q = [I(1), I(1, 'lp'), I(1), I(1), I(1), I(0), I(0), I(0), I(1, 'lp')];
  for (const x of q) b.step([x, N()]); for (let i = 0; i < 30; i++) b.step([N(), N()]);
  ok(b.p[0].kind === 'gai_h', 'しゃがみ弱Pを当てて ↓を離して ↓＋P は、しゃがみ弱Pのつなぎ（変身しない）'); }
{ const b = new KF.Battle({ p1: 'gai_h', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[1].x = b.p[0].x + 60;
  const q = [I(1), I(1, 'lp'), I(1), I(1), I(0), I(0), I(1), I(1), I(0), I(1, 'lp')];
  for (const x of q) b.step([x, N()]); for (let i = 0; i < 30; i++) b.step([N(), N()]);
  ok(b.p[0].kind === 'gai_s', 'しゃがみ弱Pを当てて ↓↓P でキャンセル変身'); }
console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
