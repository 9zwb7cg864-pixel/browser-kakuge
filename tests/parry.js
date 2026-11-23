// パリィ・ジャストパリィ・パリィラッシュ・ゲージ1本化・同時押しの猶予
const { KF, meta, inp, N } = require('./harness');
const C = KF.CONST;
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ ' + msg); } }
function fresh(gap) {
  const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta });
  for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.camX = 512; b.p[0].x = 470; b.p[1].x = 470 + (gap || 60); b.p[0].facing = 1; b.p[1].facing = -1;
  b.p[0].rush = b.p[1].rush = C.RUSH_MAX; b.p[0].rushCD = b.p[1].rushCD = 0;
  return b;
}
// p1q / p2q: 1フレームごとの入力。P2の方向は画面基準（右向き基準の番号をそのまま使う）
function run(b, p1q, p2q, n) {
  const ev = [];
  for (let f = 0; f < (n || 60); f++) {
    const e0 = b.events.length;
    b.step([p1q[f] || N(), p2q[f] || N()]);
    b.events.slice(e0).forEach(e => ev.push(Object.assign({ f }, e)));
  }
  return ev;
}
const hold = (d, btn, n) => Array.from({ length: n }, () => inp(d, btn));
const ann = (ev, t) => ev.some(e => e.type === 'announce' && e.text === t);

{ const b = fresh(); run(b, [inp(5, 'rush')], [], 2);
  ok(b.p[0].state === 'parry' && b.p[0].rush < C.RUSH_MAX - 400, 'パリィボタンでパリィになり、ゲージを使う（' + b.p[0].state + ' / ' + Math.round(b.p[0].rush) + '）'); }
{ const b = fresh(); const hp0 = b.p[0].hp;
  const p1 = hold(5, 'rush', 40), p2 = []; p2[10] = inp(5, 'mp');
  const ev = run(b, p1, p2, 40);
  ok(b.p[0].hp === hp0 && ann(ev, 'PARRY') && !ann(ev, 'JUST PARRY'), 'パリィ中に中Pを受けると、体力は減らずにパリィ'); }
{ const b = fresh(); const hp0 = b.p[0].hp;
  // 相手の中Pの発生に合わせて、当たる直前にパリィを押す
  const mpStart = KF.CHARS.kokuu.moves.mp, fa = b.p[1].A.mp.firstActive;
  const p2 = []; p2[2] = inp(5, 'mp'); const p1 = []; for (let i = 2 + fa - 1; i < 60; i++) p1[i] = inp(5, 'rush');
  const ev = run(b, p1, p2, 60);
  ok(b.p[0].hp === hp0 && ann(ev, 'JUST PARRY'), '当たる直前に押すとジャストパリィ');
  // ジャストパリィの後は守った側が先に動ける
  const b2 = fresh(); const ev2 = []; let tA = null, tD = null;
  for (let f = 0; f < 80; f++) { const e0 = b2.events.length; b2.step([f >= 2 + fa - 1 && f < 2 + fa + 1 ? inp(5, 'rush') : N(), f === 2 ? inp(5, 'mp') : N()]); b2.events.slice(e0).forEach(e => ev2.push(e));
    if (ann(ev2, 'JUST PARRY')) { if (tD == null && b2.p[0].actionable()) tD = f; if (tA == null && b2.p[1].actionable()) tA = f; } }
  ok(tD != null && tA != null && tA - tD >= 15, `ジャストパリィの後、守った側が ${tA - tD}F 先に動ける`); }
{ const b = fresh(140); const r0 = b.p[0].rush;
  const p1 = [inp(5, 'rush'), inp(5, 'rush'), inp(6, 'rush'), inp(5, 'rush'), inp(6, 'rush')];
  run(b, p1, [], 8);
  ok(b.p[0].state === 'rush', 'パリィ中に →→ でラッシュ（' + b.p[0].state + '）');
  ok(r0 - b.p[0].rush > 900 && r0 - b.p[0].rush < 1200, `パリィラッシュはゲージ約1本（${Math.round(r0 - b.p[0].rush)}）`); }
{ const b = fresh(); run(b, hold(6, '', 10), [], 10); ok(b.p[0].state !== 'rush', '何もしていないときの →→ はラッシュにならない（' + b.p[0].state + '）'); }
{ const b = fresh(50); const hp0 = b.p[0].hp; const p1 = hold(5, 'rush', 60), p2 = []; p2[8] = inp(5, 'lp,lk');
  const ev = run(b, p1, p2, 80);
  const thr = KF.CHARS.kokuu.moves.throw.dmg; const d = hp0 - b.p[0].hp;
  ok(ann(ev, 'PUNISH COUNTER') && d >= thr * 1.4, `パリィ中に投げられるとパニッシュカウンター（${d} ダメージ）`); }
{ const b = fresh(); const r0 = b.p[0].rush;
  run(b, [inp(2), inp(3), inp(6, 'lp,mp')], [], 4);
  ok(b.p[0].moveId === 'fire_ex' && Math.abs(r0 - b.p[0].rush - C.EX_COST) < 1, `EX技はゲージを2本使う（${Math.round(r0 - b.p[0].rush)}）`); }
{ const b = fresh(); b.p[0].rush = 1500; run(b, [inp(2), inp(3), inp(6, 'lp,mp')], [], 4);
  ok(b.p[0].moveId === 'fire', 'ゲージ2本ないときは普通の虚環弾'); }
{ const b = fresh(); run(b, [inp(2), inp(3), inp(6, 'lp'), inp(6), inp(5, 'mp')], [], 6);
  ok(b.p[0].moveId === 'fire_ex', '波動の弱Pを押して2F遅れて中Pを押してもEXになる（' + b.p[0].moveId + '）'); }
{ const b = fresh(); run(b, [inp(2), inp(3), inp(6, 'lp'), N(), N(), N(), N(), inp(5, 'mp')], [], 10);
  ok(b.p[0].moveId === 'fire', '遅すぎる（5F）2つ目ではEXにならない'); }
{ const b = fresh(50); run(b, [inp(5, 'lp'), N(), inp(5, 'lk')], [], 6);
  ok(b.p[0].moveId === 'throw' || b.p[0].state === 'throwing', '弱Pを押して2F遅れて弱Kでも投げになる（' + (b.p[0].moveId || b.p[0].state) + '）'); }
{ const b = fresh(50); const r0 = C.RUSH_MAX; const p1 = [inp(2, 'mk')]; for (let i = 1; i < 30; i++) p1.push(N());
  const ev = []; let fired = false;
  for (let f = 0; f < 30; f++) { const e0 = b.events.length; b.step([fired ? N() : (b.p[0].connected ? (fired = true, inp(5, 'rush')) : (f === 0 ? inp(2, 'mk') : inp(2))), N()]); b.events.slice(e0).forEach(e => ev.push(e)); }
  ok(ev.some(e => e.type === 'rushcancel'), 'しゃがみ中Kを当ててパリィボタンでラッシュキャンセル'); }
console.log(`結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
