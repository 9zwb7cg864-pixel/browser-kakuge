// 変身キャラ男の仕組みの試験：変身・暴発しないこと・アーマー・当て身・反射・床跳ね・壁跳ね・下段の衝撃波・飛び道具抜け
const { KF, meta, inp, N } = require('./harness');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✘ ' + m); } }
function fresh(p1, p2, gap) {
  const b = new KF.Battle({ p1, p2, meta });
  for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[0].x = 470; b.p[1].x = 470 + gap; b.camX = 512; b.p[0].facing = 1; b.p[1].facing = -1;
  b.p.forEach(f => { f.sup = 3000; f.ex = 2000; });
  return b;
}
function run(b, s1, s2, frames) {
  const q1 = s1.slice(), q2 = (s2 || []).slice(), ev0 = b.events.length;
  for (let f = 0; f < frames; f++) b.step([q1.length ? q1.shift() : N(), q2.length ? q2.shift() : N()]);
  return b.events.slice(ev0);
}
const DD = side => [inp(2), inp(2), inp(5), inp(5), inp(2, 'lp')];
const M = (seq, btn) => seq.map((d, i) => inp(d, i === seq.length - 1 ? btn : ''));
{ const b = fresh('gai_h', 'kokuu', 150); run(b, DD(), [], 40);
  ok(b.p[0].kind === 'gai_s', '↓↓Pでハンマー形態→大盾形態（' + b.p[0].kind + '）');
  run(b, DD(), [], 40); ok(b.p[0].kind === 'gai_h', 'もう一度↓↓Pで大盾形態→ハンマー形態（' + b.p[0].kind + '）');
  const hp0 = b.p[0].hp, sup0 = b.p[0].sup; ok(hp0 === b.p[0].D.hp && sup0 === 3000, '変身しても体力・ゲージはそのまま'); }
{ const b = fresh('gai_h', 'kokuu', 150); const s = []; for (let i = 0; i < 9; i++) s.push(inp(2, i === 0 ? 'lk' : '')); s.push(inp(5), inp(5), inp(2, 'lp')); run(b, s, [], 40);
  ok(b.p[0].kind === 'gai_h', 'しゃがみ弱K（↓を長く押す）→立つ→しゃがみ弱P では変身しない（暴発しない）'); }
{ const b = fresh('gai_h', 'kokuu', 70); const s2 = []; for (let i = 0; i < 6; i++) s2.push(N()); s2.push(inp(5, 'lp'));
  const ev = run(b, [inp(5, 'hp')], s2, 50);
  ok(ev.some(e => e.type === 'announce' && e.text === 'ARMOR') && ev.some(e => e.type === 'hit' && e.side === 0 && e.move === 'hp'), 'ハンマー強Pは発生前に相手の弱Pを受け止めて（アーマー）そのまま当たる'); }
{ const b = fresh('gai_s', 'kokuu', 70); const s2 = []; for (let i = 0; i < 4; i++) s2.push(N()); s2.push(inp(5, 'mp'));
  const ev = run(b, M([2, 1, 4], 'lk'), s2, 60);
  ok(ev.some(e => e.type === 'announce' && e.text === '受け止めた') && ev.some(e => e.type === 'hit' && e.side === 0 && e.move === 'counter_do'), '盾構え（当て身）で相手の中Pを受け止めて盾返しが当たる'); }
{ const b = fresh('gai_s', 'kokuu', 70); const s2 = []; for (let i = 0; i < 4; i++) s2.push(N()); s2.push(inp(5, 'lp,lk'));
  const ev = run(b, M([2, 1, 4], 'lk'), s2, 60);
  ok(!ev.some(e => e.type === 'announce' && e.text === '受け止めた'), '盾構えは投げは受け止められない'); }
{ // 相手の虚環弾が近づいたら反射（右側の相手の↓↘→は、画面の向きでは↓↙←）
  const b = fresh('gai_s', 'kokuu', 260); const q2 = M([2, 1, 4], 'lp'), q1 = []; const ev0 = b.events.length; let fired = false;
  for (let f = 0; f < 160; f++) {
    const p = b.projs.find(x => x.owner === b.p[1]);
    if (!fired && p && Math.abs(p.x - b.p[0].x) < 110) { M([2, 3, 6], 'lk').forEach(x => q1.push(x)); fired = true; }
    b.step([q1.length ? q1.shift() : N(), q2.length ? q2.shift() : N()]);
  }
  const ev = b.events.slice(ev0);
  ok(ev.some(e => e.type === 'announce' && e.text === '反射') && ev.some(e => e.type === 'hit' && e.side === 0), '反射で相手の虚環弾を跳ね返し、相手に当たる'); }
{ const b = fresh('gai_h', 'kokuu', 60); run(b, [inp(6, 'hp')], [], 60);
  ok(b.p[1].bounceUsed === 1 && b.p[1].state === 'launch', '地響きが当たると床で一度跳ねて、浮いたまま追撃できる'); }
{ const b = fresh('gai_h', 'kokuu', 46); b.camX = KF.CONST.WORLD_W - KF.CONST.W / 2; b.p[1].x = b.limits()[1]; b.p[0].x = b.p[1].x - 46;
  run(b, [inp(5, 'hp')].concat(Array(18).fill(0).map(() => N())).concat(M([2, 1, 4], 'hp')), [], 120);
  ok(b.p[1].wallUsed === 1, '画面端で大回転を当てると壁で跳ね返る'); }
{ const b = fresh('gai_h', 'kokuu', 150); const s2 = []; for (let i = 0; i < 60; i++) s2.push(inp(6));   // 相手は立ったまま後ろ（右向きの相手には→が後ろ）
  const ev = run(b, M([2, 3, 6], 'lp'), s2, 80);
  ok(ev.some(e => e.type === 'hit' && e.side === 0 && e.move === 'quake'), '地割れの衝撃波は下段（立ちガードでは防げない）'); }
{ const b = fresh('gai_s', 'kokuu', 260); const s1 = []; for (let i = 0; i < 16; i++) s1.push(N()); M([2, 3, 6], 'hp').forEach(x => s1.push(x));
  const ev = run(b, s1, M([2, 1, 4], 'lp'), 120);
  ok(ev.some(e => e.type === 'hit' && e.side === 0 && e.move === 'charge') && !ev.some(e => e.type === 'hit' && e.side === 1), '盾突進は飛び道具を抜けて当たる'); }
{ // 変身キャンセル：当てた通常技からだけ相手ののけぞりが延びる
  const b = fresh('gai_h', 'kokuu', 46); run(b, [inp(5, 'mp')], [], 9); const st0 = b.p[1].stun; run(b, DD(), [], 7);
  ok(b.p[1].stun >= st0 + 10, '当てた中Pから↓↓Pでキャンセルすると、相手ののけぞりが延びる（' + st0 + '→' + b.p[1].stun + '）'); }
console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
