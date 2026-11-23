// 旋風脚（中2倍・強3倍の距離／強は弾抜けで何からもつながらない）と、強虚掌破（画面端以外では強Pにつながらない）
const { KF, meta, inp, N } = require('./harness');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✘ ' + m); } }
// 状態をまるごとコピー（キャラ表などの変わらないものは共有）
const STATIC = new Set();
(function mark(o, d) { if (!o || typeof o !== 'object' || STATIC.has(o) || d > 12) return; STATIC.add(o); for (const k in o) mark(o[k], d + 1); })(meta, 0);
for (const k in KF) if (k !== 'Game' && KF[k] && typeof KF[k] === 'object') (function mark(o, d) { if (!o || typeof o !== 'object' || STATIC.has(o) || d > 12) return; STATIC.add(o); for (const kk in o) mark(o[kk], d + 1); })(KF[k], 0);
function clone(root) { const seen = new Map(); return (function c(o) { if (o === null || typeof o !== 'object' || STATIC.has(o)) return o; const s = seen.get(o); if (s) return s;
  if (Array.isArray(o)) { const r = []; seen.set(o, r); o.forEach((v, i) => r[i] = c(v)); return r; }
  const r = Object.create(Object.getPrototypeOf(o)); seen.set(o, r); for (const k of Object.keys(o)) r[k] = c(o[k]); return r; })(root); }
function root(corner) { const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  const C = KF.CONST; b.p[0].sup = 3000; b.p[0].rush = 6000;
  if (corner) { b.camX = C.WORLD_W - C.W / 2; b.p[1].x = b.limits()[1]; b.p[0].x = b.p[1].x - 46; } else { b.camX = 512; b.p[0].x = 470; b.p[1].x = 516; }
  b.p[0].facing = 1; b.p[1].facing = -1; b.p[1].hp = 1e6; return b; }
const mo = (seq, bt) => seq.map((d, i) => inp(d, i === seq.length - 1 ? bt : ''));

console.log('■ 旋風脚の進む距離');
const dist = str => { const b = root(false); b.p[0].x = 300; b.p[1].x = 1200; const x0 = b.p[0].x; b.startMove(b.p[0], 'tatsu', str); let mx = x0;
  for (let i = 0; i < 120 && b.p[0].state === 'attack'; i++) { b.step([N(), N()]); mx = Math.max(mx, b.p[0].x); } return mx - x0; };
const d0 = dist(0), d1 = dist(1), d2 = dist(2);
ok(d1 >= 170 && d1 <= 190, '中旋風脚は約2倍（' + Math.round(d1) + 'ドット。もとは89）');
ok(d2 >= 370 && d2 <= 400, '強旋風脚は約3倍（' + Math.round(d2) + 'ドット。もとは129）');

console.log('■ 強旋風脚は何からもつながらない');
const starters = { '強P': [inp(5, 'hp')], 'しゃがみ強P': [inp(2, 'hp')], '中P': [inp(5, 'mp')], '強K': [inp(5, 'hk')], 'しゃがみ中K': [inp(2, 'mk')], '強虚掌破': mo([2, 1, 4], 'hp'), 'EX虚掌破': mo([2, 1, 4], 'lp,mp'), '強昇竜': mo([6, 2, 3], 'hp'), '中旋風脚': mo([2, 3, 6], 'mk'), 'EX迅閃脚': mo([2, 1, 4], 'lk,mk') };
for (const corner of [false, true]) {
  const bad = [];
  for (const [nm, st] of Object.entries(starters)) {
    const s = root(corner); for (const f of st) s.step([f, N()]);
    for (let k = 0; k < 90; k++) {
      const c = clone(s); c.events.length = 0; for (const f of mo([2, 3, 6], 'hk')) c.step([f, N()]);
      let first = null; for (let i = 0; i < 60; i++) { for (const e of c.events) if (e.type === 'hit' && e.side === 0 && e.move === 'tatsu' && c.p[0].str === 2 && first === null) first = e.combo; c.events.length = 0; c.step([N(), N()]); }
      if (first >= 2) { bad.push(nm + ' ' + k + 'F後'); break; }
      s.step([N(), N()]);
    }
  }
  ok(!bad.length, (corner ? '画面端' : '画面中央') + '：10種類の技のあと、0〜89Fのどこで出してもつながらない' + (bad.length ? '（' + bad.join('／') + '）' : ''));
}
{ const b = root(false); b.p[1].x = 600; for (const f of mo([2, 3, 6], 'hk')) b.step([f, N()]); let h = 0; for (let i = 0; i < 80; i++) { for (const e of b.events) if (e.type === 'hit' && e.side === 0) h++; b.events.length = 0; b.step([N(), N()]); }
  ok(h === 3, '生で出せば当たる（' + h + 'ヒット）'); }

console.log('■ 強旋風脚は飛び道具を抜ける');
for (const str of ['mk', 'hk']) {
  const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.camX = 512; b.p[0].x = 300; b.p[1].x = 700; b.step([N(), N()]);
  for (const f of mo([2, 1, 4], 'lp')) b.step([N(), f]);
  let t = 0; while (!(b.projs[0] && b.projs[0].x - b.p[0].x < 100) && t++ < 200) b.step([N(), N()]);
  b.events.length = 0; for (const f of mo([2, 3, 6], str)) b.step([f, N()]);
  let hit = false; for (let i = 0; i < 60; i++) { for (const e of b.events) if (e.type === 'hit' && e.side === 1) hit = true; b.events.length = 0; b.step([N(), N()]); }
  ok(str === 'hk' ? !hit : hit, str === 'hk' ? '強旋風脚は波動を抜ける' : '（確認）中旋風脚は波動に当たる');
}

console.log('■ 強虚掌破のあとの強P');
for (const [corner, pb, nm] of [[false, 'hp', '画面中央 強虚掌破'], [true, 'hp', '画面端 強虚掌破'], [false, 'lp,mp', '画面中央 EX虚掌破']]) {
  const b = root(corner); b.step([inp(5, 'hp'), N()]); for (let i = 0; i < 12; i++) b.step([N(), N()]);
  for (const f of mo([2, 1, 4], pb)) b.step([f, N()]);
  let t = 0; while (b.p[1].combo < 2 && t++ < 80) b.step([N(), N()]);
  let n = 0; const s = b;
  for (let k = 0; k < 80; k++) { const c = clone(s); c.events.length = 0; c.step([inp(5, 'hp'), N()]); let hit = false;
    for (let i = 0; i < 40; i++) { for (const e of c.events) if (e.type === 'hit' && e.side === 0 && e.combo >= 3) hit = true; c.events.length = 0; c.step([N(), N()]); }
    if (hit) n++; s.step([N(), N()]); }
  ok(corner || pb !== 'hp' ? n > 0 : n === 0, nm + ' → 強P：' + (n ? n + 'Fの間つながる' : 'つながらない'));
}
console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
