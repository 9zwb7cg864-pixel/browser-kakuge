// システム検証：コンボ成立・ラッシュキャンセル・永久防止・ゲージ増減・投げ/投げ抜け・必殺技・超必殺・ラウンド
const { KF, meta, inp, N } = require('./harness');
const C = KF.CONST;
{ const B = KF.Battle; KF.Battle = function (o) { B.call(this, o); this.p.forEach(f => { f.ex = C.EX_MAX; }); }; KF.Battle.prototype = B.prototype; }
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ ' + msg); } }
function fresh(p1 = 'kokuu', p2 = 'shuuen', gap = 50) {
  const b = new KF.Battle({ p1, p2, meta });
  for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[0].x = 470; b.p[1].x = 470 + gap; b.camX = 512; b.p[0].facing = 1; b.p[1].facing = -1;
  b.p[0].ex = b.p[1].ex = KF.CONST.EX_MAX;
  return b;
}
// script: [[frames, dir, 'btns'], ...]  1フレーム目だけボタンを押す
function run(b, script, p2 = () => N(), extra = 60) {
  const evs = [];
  const ev0 = b.events.length;
  for (const [n, dir, btn] of script) {
    for (let i = 0; i < n; i++) b.step([inp(dir, i === 0 ? btn : ''), p2(b)]);
  }
  for (let i = 0; i < extra; i++) b.step([N(), p2(b)]);
  return b.events.slice(ev0);
}
const hits = evs => evs.filter(e => e.type === 'hit' && e.side === 0);
const maxCombo = evs => Math.max(0, ...hits(evs).map(e => e.combo));

console.log('■ 必殺技コマンド');
{ const b = fresh('kokuu', 'shuuen', 300); const e = run(b, [[1, 2], [1, 3], [1, 6, 'hp']], N, 80);
  ok(b.projs.length > 0 || hits(e).length > 0, '虚環弾（↓↘→+P）で飛び道具が出る'); }
{ const b = fresh(); const e = run(b, [[1, 6], [1, 2], [1, 3, 'hp']]);
  ok(hits(e).some(x => x.move === 'dp'), '昇穿（→↓↘+P）が出てヒット'); }
{ const b = fresh('kokuu', 'shuuen', 120); const e = run(b, [[1, 2], [1, 1], [1, 4, 'mk']]);
  ok(hits(e).some(x => x.move === 'rushk'), '迅閃脚（↓↙←+K）が突進してヒット'); }
{ const b = fresh('shuuen', 'kokuu', 60); const e = run(b, [[1, 6], [1, 3], [1, 2], [1, 1], [1, 4, 'hp']], N, 120);
  ok(b.p[1].hp < b.p[1].D.hp - 2000, '終縛（→↘↓↙←+P）コマンド投げが決まる（' + (b.p[1].D.hp - b.p[1].hp) + 'ダメージ）'); }
{ const b = fresh(); b.p[0].sup = 0; b.p[0].ex = 2000; b.p[0].rushCD = 999; const e = run(b, [[1, 6], [1, 2], [1, 3, 'lp,mp']]);
  ok(hits(e).some(x => x.move === 'dp_ex'), 'EX昇穿（P2つ同時）が出る'); ok(b.p[0].ex < 1000 && b.p[0].sup >= 0, 'EXはEX/RUSHゲージを2本使い、必殺ゲージは使わない'); }
{ const b = fresh(); b.p[0].sup = 3000; b.p[0].ex = 0; const e = run(b, [[1, 6], [1, 2], [1, 3, 'lp,mp']]);
  ok(!hits(e).some(x => x.move === 'dp_ex') && b.p[0].sup >= 3000, 'EX/RUSHゲージが空なら、必殺ゲージが満タンでもEXは出ない'); }
{ const b = fresh('kokuu', 'shuuen', 200); b.p[0].sup = 1000; const e = run(b, [[1, 2], [1, 3], [1, 6], [1, 2], [1, 3], [1, 6, 'hp']], N, 150);
  ok(e.some(x => x.type === 'super'), '超必殺 虚空砲（1本）が発動し暗転演出'); ok(hits(e).filter(x => x.move === 'su1').length >= 3, '虚空砲が多段ヒット（' + hits(e).filter(x => x.move === 'su1').length + 'hit）');
  ok(b.p[0].sup < 1000, '必殺ゲージ1本を消費'); }
{ const b = fresh('kokuu', 'shuuen', 90); b.p[0].sup = 2000; const e = run(b, [[1, 2], [1, 1], [1, 4], [1, 2], [1, 1], [1, 4, 'hp']], N, 200);
  ok(maxCombo(e) >= 6, '超必殺 零界継承（2本）が乱舞でつながる（' + maxCombo(e) + 'hit, ' + (b.p[1].D.hp - b.p[1].hp) + 'ダメージ）'); }
{ const b = fresh('shuuen', 'kokuu', 70); b.p[0].sup = 2000; const e = run(b, [[1, 2], [1, 3], [1, 6], [1, 2], [1, 3], [1, 6, 'hk']], N, 220);
  ok(b.p[1].D.hp - b.p[1].hp >= 4000, '超必殺 万象終焉（2本・投げ）が決まる（' + (b.p[1].D.hp - b.p[1].hp) + 'ダメージ）'); }
{ const b = fresh('shuuen', 'kokuu', 200); b.p[0].sup = 1000; const e = run(b, [[1, 2], [1, 3], [1, 6], [1, 2], [1, 3], [1, 6, 'hp']], N, 200);
  ok(hits(e).filter(x => x.move === 'su1').length >= 2, '超必殺 終焉の柱が相手の位置で多段ヒット'); }

console.log('■ コンボ成立');
{ const b = fresh(); const e = run(b, [[2, 2, 'mk'], [5, 2], [1, 2], [1, 3], [1, 6, 'lp']], N, 90);
  ok(maxCombo(e) === 2, 'しゃがみ中K → 虚環弾（必殺技キャンセル）で2ヒット'); }
{ const b = fresh(); const e = run(b, [[3, 5, 'hp'], [6, 5], [1, 6], [1, 2], [1, 3, 'hp']], N, 90);
  ok(maxCombo(e) === 2, '強P → 昇穿 で2ヒット（' + (b.p[1].D.hp - b.p[1].hp) + 'ダメージ）'); }
{ const b = fresh('kokuu', 'shuuen', 38); const e = run(b, [[3, 2, 'lk'], [4, 2], [1, 2, 'lp'], [5, 2], [1, 2, 'lp'], [5, 2]], N, 60);
  ok(maxCombo(e) >= 3, '弱攻撃の連打キャンセル（しゃがみ弱K→弱P→弱P）で' + maxCombo(e) + 'ヒット'); }
{ const b = fresh(); const e = run(b, [[2, 5, 'mp'], [6, 5], [1, 5, 'rush'], [9, 6], [1, 5, 'hp'], [7, 5], [1, 6], [1, 2], [1, 3, 'hp']], N, 90);
  ok(e.some(x => x.type === 'rushcancel'), '中P → ラッシュキャンセル が発動');
  ok(maxCombo(e) >= 3, 'ラッシュキャンセルから強P→昇穿までつながる（' + maxCombo(e) + 'hit）');
  ok(b.p[0].rush <= C.RUSH_MAX - C.RUSH_CANCEL_COST + 800, 'ラッシュキャンセルでゲージを3本消費（そのあと当てた分が少し溜まる。残り' + Math.round(b.p[0].rush) + '）'); }

console.log('■ 永久コンボの防止');
{ // ラッシュキャンセルを繰り返そうとしても、ゲージ（6本・1回3本）が尽きるので2回まで
  const b = fresh(); b.p[0].rush = C.RUSH_MAX;
  const script = [];
  for (let k = 0; k < 5; k++) script.push([2, 5, 'mp'], [6, 5], [1, 5, 'rush'], [8, 6]);
  const e = run(b, script, N, 60);
  ok(e.filter(x => x.type === 'rushcancel').length <= 2, 'ラッシュキャンセルを繰り返してもゲージが尽きて2回まで（' + e.filter(x => x.type === 'rushcancel').length + '回）');
}
{ const b = fresh(); const script = []; for (let k = 0; k < 12; k++) script.push([3, 2, 'lp']);
  const e = run(b, script, N, 30);
  ok(maxCombo(e) <= 5, '弱P連打キャンセルは上限あり（最大' + maxCombo(e) + 'hit）'); }
{ // 空中コンボ（拾い直し）は上限で止まる：EX昇穿の拾いを連発
  const b = fresh(); b.p[0].sup = 3000; const script = [];
  for (let k = 0; k < 6; k++) script.push([1, 6], [1, 2], [1, 3, 'lp,mp'], [45, 5]);
  const e = run(b, script, N, 30);
  ok(maxCombo(e) <= 2 * C.JUGGLE_LIMIT + 2, '空中の拾い直しは回数制限で止まる（最大' + maxCombo(e) + 'hit）'); }
{ // ランダム入力の総当たり：長時間でもコンボが際限なく伸びない
  let worst = 0; const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let trial = 0; trial < 30; trial++) {
    const b = fresh(trial % 2 ? 'shuuen' : 'kokuu', 'kokuu'); b.p[0].sup = 3000;
    const btns = ['', '', 'lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'rush', 'lp,mp', 'lk,mk'];
    for (let f = 0; f < 1800; f++) {
      const d = 1 + Math.floor(rng() * 9), bt = rng() < 0.3 ? btns[Math.floor(rng() * btns.length)] : '';
      const ev0 = b.events.length;
      b.step([inp(d, bt), N()]);
      if (b.p[1].hp < 3000) { b.p[1].hp = b.p[1].D.hp; }
      b.events.slice(ev0).forEach(e => { if (e.type === 'hit') worst = Math.max(worst, e.combo); });
      b.timer = 99; b.p[0].sup = 3000;
    }
  }
  ok(worst <= 16, 'ランダム入力30試合×30秒でも最大コンボは ' + worst + 'hit で頭打ち');
}
{ // コンボ補正：ヒット数が増えると1ヒットの威力が下がる
  const b = fresh(); const e = run(b, [[3, 5, 'mp'], [6, 5], [1, 5, 'rush'], [9, 6], [1, 5, 'hp'], [7, 5], [1, 6], [1, 2], [1, 3, 'hp']], N, 90);
  const h = hits(e); const base = KF.CHARS.kokuu.moves.dp.dmg[2]; ok(h.length >= 3 && h[2].dmg < base, 'コンボ補正：3hit目の昇穿は本来 ' + base + ' → 補正後 ' + (h[2] && h[2].dmg)); }


console.log('■ 格ゲーとして変なつながり方がないこと');
{ const b = fresh(); const e = run(b, [[2, 5, 'lp'], [4, 5], [1, 5, 'mp'], [6, 5], [1, 5, 'hp'], [8, 5]], N, 60);
  ok(maxCombo(e) <= 1 || !hits(e).some(x => x.move === 'hp' && x.combo === 3), '弱P→中P→強Pの「何でもキャンセル」はできない（最大' + maxCombo(e) + 'hit）'); }
{ const b = fresh(); const e = run(b, [[3, 5, 'hk'], [6, 5], [1, 2], [1, 3], [1, 6, 'lp']], N, 90);
  ok(!hits(e).some(x => x.combo >= 2), '強Kは必殺技でキャンセルできない'); }
{ const b = fresh(); const e = run(b, [[3, 5, 'mk'], [5, 5], [1, 2], [1, 3], [1, 6, 'lp']], N, 90);
  ok(!hits(e).some(x => x.combo >= 2), '1Pの立ち中Kは必殺技でキャンセルできない'); }
{ // 有利フレームが足りない目押し（1P 弱P＋4 → しゃがみ中P 発生6）はつながらない
  const b = fresh('kokuu', 'shuuen', 46); let f = 0, done = false;
  const ev0 = b.events.length;
  b.step([inp(5, 'lp'), N()]);
  for (let i = 0; i < 60; i++) { const a = b.p[0]; b.step([(!done && a.actionable() && i > 2) ? (done = true, inp(2, 'mp')) : inp(done ? 2 : 5), N()]); }
  const e = b.events.slice(ev0);
  ok(!hits(e).some(x => x.combo >= 2), '有利フレームが足りない目押し（弱P，しゃがみ中P）はつながらない'); }
{ const b = fresh(); const e = run(b, [[3, 5, 'mp'], [6, 5], [1, 5, 'hp']], N, 60);
  ok(hits(e).some(x => x.move === 'tc_hp' && x.combo === 2), '1Pのターゲットコンボ（中P～強P）がつながる'); }


console.log('■ 追加した技');
{ const b = fresh(); const e = run(b, [[2, 6, 'mp']], () => inp(3), 60); ok(e.some(x => x.type === 'hit' && x.move === 'f_mp'), '1P →中P 鎚打ちは中段（しゃがみガード不可）'); }
{ const b = fresh(); const e = run(b, [[2, 6, 'mp']], () => inp(6), 60); ok(e.some(x => x.type === 'block' && x.move === 'f_mp'), '鎚打ちは立ちガードできる'); }
{ const b = fresh('kokuu', 'shuuen', 70); const e = run(b, [[2, 6, 'hp']], N, 60); ok(hits(e).some(x => x.move === 'f_hp'), '1P →強P 踏破肘が踏み込んで当たる'); }
{ const b = fresh('kokuu', 'shuuen', 80); const e = run(b, [[2, 4, 'hk']], N, 60); ok(hits(e).some(x => x.move === 'b_hk'), '1P ←強K 旋踵が当たる'); }
{ const b = fresh('kokuu', 'shuuen', 60); const e = run(b, [[1, 2], [1, 3], [1, 6, 'mk']], N, 90); ok(hits(e).filter(x => x.move === 'tatsu').length >= 3, '1P 旋風脚（↓↘→+K）が多段ヒット（' + hits(e).filter(x => x.move === 'tatsu').length + 'hit）'); }
{ const b = fresh('kokuu', 'shuuen', 130); const e = run(b, [[1, 9], [16, 5], [1, 2], [1, 3], [1, 6, 'mk']], N, 80); ok(e.some(x => x.type === 'hit' && x.move === 'atatsu') || b.p[0].moveId === 'atatsu', '1P 空中で空旋脚が出る'); }
{ const b = fresh(); const e = run(b, [[1, 2], [1, 1], [1, 4, 'hp'], [52, 5], [1, 6], [1, 2], [1, 3, 'hp']], N, 100);
  ok(hits(e).some(x => x.move === 'palm') && hits(e).some(x => x.move === 'dp' && x.combo === 2), '1P 虚掌破で浮かせて昇穿で追撃できる'); }
{ const b = fresh(); b.p[0].sup = 3000; const e = run(b, [[1, 2], [1, 3], [1, 6], [1, 2], [1, 3], [1, 6, 'hk']], N, 200);
  ok(e.some(x => x.type === 'super') && maxCombo(e) >= 5, '1P 超必殺3 天地穿（3本）が多段でつながる（' + maxCombo(e) + 'hit, ' + (b.p[1].D.hp - b.p[1].hp) + 'ダメージ）'); ok(b.p[0].sup < 100, '天地穿で必殺ゲージを3本消費'); }
{ const b = fresh('shuuen', 'kokuu', 60); const e = run(b, [[2, 6, 'mk']], () => inp(1), 80); ok(e.some(x => x.type === 'hit' && x.move === 'f_mk'), '2P →中K 圧殺踏は中段'); }
{ const b = fresh('shuuen', 'kokuu', 60); const e = run(b, [[2, 6, 'hp']], N, 60); ok(hits(e).some(x => x.move === 'f_hp'), '2P →強P 破頭が当たる'); }
{ let okAA = false, when = null;
  for (let t = 6; t <= 34 && !okAA; t++) { const b = fresh('shuuen', 'kokuu', 150); let f = 0;
    const e = run(b, [[t, 5], [2, 4, 'hp']], (bb) => { f++; return f === 1 ? inp(7) : (f === 16 ? inp(5, 'hk') : N()); }, 80);
    if (hits(e).some(x => x.move === 'b_hp')) { okAA = true; when = t; } }
  ok(okAA, '2P ←強P 掬い爪で飛び込みを落とせる（相手が跳んでから' + when + 'F後に入力）'); }
{ const b = fresh('shuuen', 'kokuu', 160); const e = run(b, [[1, 2], [1, 3], [1, 6, 'hk']], () => inp(6), 140); ok(e.some(x => x.type === 'hit' && x.move === 'wave'), '2P 地裂脚は下段（立ちガード不可）'); }
{ const b = fresh('shuuen', 'kokuu', 160); const e = run(b, [[1, 2], [1, 3], [1, 6, 'hk']], () => inp(3), 140); ok(e.some(x => x.type === 'block'), '地裂脚はしゃがみガードできる'); }
{ const b = fresh('shuuen', 'kokuu', 56); const e = run(b, [[1, 2], [1, 1], [1, 4, 'lp'], [10, 5], [1, 2], [1, 1], [1, 4, 'lp'], [10, 5], [1, 2], [1, 1], [1, 4, 'lp']], N, 90);
  ok(['rekka1', 'rekka2', 'rekka3'].every(m => hits(e).some(x => x.move === m)) && maxCombo(e) >= 3, '2P 冥爪連撃が3段まで派生してつながる（' + maxCombo(e) + 'hit）'); }
{ const b = fresh('shuuen', 'kokuu', 150); const e = run(b, [[1, 9], [14, 5], [1, 2], [1, 1], [1, 4, 'mk']], () => inp(1), 80); ok(e.some(x => x.type === 'hit' && x.move === 'dive'), '2P 空中の降魔落が出て、中段（しゃがみガード不可）'); }
{ const b = fresh('shuuen', 'kokuu', 110); b.p[0].sup = 3000; const e = run(b, [[1, 2], [1, 1], [1, 4], [1, 2], [1, 1], [1, 4, 'hp']], N, 200);
  ok(e.some(x => x.type === 'super') && hits(e).filter(x => x.move === 'su3').length >= 3, '2P 超必殺3 万象崩（3本）の柱が多段ヒット（' + (b.p[1].D.hp - b.p[1].hp) + 'ダメージ）'); }
{ const b = fresh('shuuen', 'kokuu', 46); const e = run(b, [[3, 5, 'hp'], [8, 5], [1, 5, 'hk']], N, 60); ok(hits(e).some(x => x.move === 'tc_hk'), '2P ターゲットコンボ2（強P～強K）'); }
{ const b = fresh(); const e = run(b, [[3, 5, 'mk'], [7, 5], [1, 5, 'hk']], N, 60); ok(hits(e).some(x => x.move === 'tc_hk'), '1P ターゲットコンボ2（中K～強K）'); }

console.log('■ ゲージ');
{ const b = fresh('kokuu', 'shuuen', 300); b.p[0].rush = C.RUSH_MAX; run(b, [[2, 5, 'rush'], [1, 6, 'rush'], [1, 5, 'rush'], [1, 6, 'rush']], N, 2);
  const used = C.RUSH_MAX - b.p[0].rush;
  ok(b.p[0].state === 'rush' && used >= 1000 && used <= 1050, 'パリィ→→のラッシュでゲージ1本消費（' + Math.round(used) + '）');
  const r0 = b.p[0].rush; run(b, [], N, 60); ok(b.p[0].rush === r0, '使用直後はゲージ回復が止まる（クールダウン）');
  run(b, [], N, 100); ok(b.p[0].rush > r0, 'クールダウン後に自然回復（' + r0 + '→' + b.p[0].rush + '）');
  const b2 = fresh('kokuu', 'shuuen', 300); b2.p[0].rush = 500; const e2 = run(b2, [[1, 5, 'rush']], N, 2);
  ok(b2.p[0].state !== 'rush' && !e2.some(x => x.type === 'rush'), 'ゲージ不足ではラッシュできない'); }
{ const b = fresh(); b.p[0].sup = 0; b.p[1].sup = 0; run(b, [[3, 5, 'hp']], N, 40);
  ok(b.p[0].sup > 0 && b.p[1].sup > 0, '攻撃を当てた側・食らった側の両方に必殺ゲージが溜まる（' + Math.round(b.p[0].sup) + ' / ' + Math.round(b.p[1].sup) + '）'); }
{ const b = fresh(); b.p[0].ex = 400; run(b, [[1, 6], [1, 2], [1, 3, 'lp,mp']], N, 60);
  ok(!(b.events.some(e => e.type === 'hit' && e.move === 'dp_ex')), 'EXゲージ不足ではEXにならない（通常版になる）'); }
{ const b = fresh(); b.p[0].ex = 0; b.p[1].ex = 0; run(b, [[3, 5, 'hp']], N, 40);
  ok(b.p[0].ex > 0 && b.p[1].ex > 0, '攻撃を当てた側・食らった側の両方にEXゲージが溜まる（' + Math.round(b.p[0].ex) + ' / ' + Math.round(b.p[1].ex) + '）'); }
{ const b = fresh(); b.p[0].sup = 900; const e = run(b, [[1, 2], [1, 3], [1, 6], [1, 2], [1, 3], [1, 6, 'hp']], N, 60);
  ok(!e.some(x => x.type === 'super'), '必殺ゲージ1本未満では超必殺が出ない'); }

console.log('■ ガード');
{ const b = fresh(); const e = run(b, [[2, 2, 'mk']], () => inp(6), 40); ok(e.some(x => x.type === 'hit'), '下段（しゃがみ中K）は立ちガードできない'); }
{ const b = fresh(); const e = run(b, [[2, 2, 'mk']], () => inp(3), 40); ok(e.some(x => x.type === 'block'), '下段はしゃがみガードで防げる'); }
{ const b = fresh('kokuu', 'shuuen', 300); const e = run(b, [[1, 2], [1, 3], [1, 6, 'hp']], () => inp(6), 120);
  ok(e.some(x => x.type === 'block') && b.p[1].hp < b.p[1].D.hp, '必殺技はガードしても削りダメージが入る（' + (b.p[1].D.hp - b.p[1].hp) + '）'); }

console.log('■ 投げ');
{ const b = fresh(); const e = run(b, [[1, 5, 'lp,lk']], N, 100); ok(b.p[1].hp === b.p[1].D.hp - KF.CHARS.kokuu.moves.throw.dmg, '投げが決まる（' + KF.CHARS.kokuu.moves.throw.dmg + 'ダメージ）'); }
{ const b = fresh(); let f = 0; const e = run(b, [[1, 5, 'lp,lk']], (bb) => { f++; return f === 9 ? inp(5, 'lp,lk') : N(); }, 100);
  ok(b.p[1].hp === b.p[1].D.hp && e.some(x => x.type === 'announce' && x.text === '投げ抜け'), '受付時間内の弱P+弱Kで投げ抜け'); }
{ const b = fresh(); const e = run(b, [[1, 5, 'lp,lk']], () => inp(6), 100); ok(b.p[1].hp < b.p[1].D.hp, '投げはガードできない'); }
{ const b = fresh('shuuen', 'kokuu', 60); let f = 0; run(b, [[1, 6], [1, 3], [1, 2], [1, 1], [1, 4, 'hp']], (bb) => { f++; return f === 12 ? inp(5, 'lp,lk') : N(); }, 120);
  ok(b.p[1].hp < b.p[1].D.hp, 'コマンド投げは投げ抜けできない'); }

console.log('■ 無敵・対空');
{ // 相手の強Pの持続に昇穿を合わせても、無敵で勝つ
  const b = fresh('kokuu', 'shuuen', 60); let f = 0;
  const e = run(b, [[4, 5], [1, 6], [1, 2], [1, 3, 'hp']], (bb) => { f++; return f === 1 ? inp(5, 'hp') : N(); }, 80);
  ok(hits(e).some(x => x.move === 'dp') && !e.some(x => x.type === 'hit' && x.side === 1), '昇穿の無敵で相手の強Pをすり抜けて勝つ'); }
{ const b = fresh('kokuu', 'shuuen', 160); let f = 0;
  const e = run(b, [[24, 5], [1, 6], [1, 2], [1, 3, 'hp']], (bb) => { f++; return f === 1 ? inp(7) : (f === 14 ? inp(5, 'hk') : N()); }, 80);
  ok(hits(e).some(x => x.move === 'dp'), '飛び込みを昇穿で対空できる'); }

console.log('■ ラウンド・タイマー');
{ const b = fresh(); b.p[1].hp = 100; run(b, [[3, 5, 'hp']], N, 260); ok(b.wins[0] === 1, 'KOで1P がラウンド取得'); ok(b.round === 2, '次のラウンドへ進む'); }
{ const b = fresh(); b.p[1].hp = 5000; b.timer = 1; b.timerSub = 0; run(b, [], N, 300); ok(b.wins[0] === 1, 'タイムアップは体力の多い方が勝ち'); }
{ const b = fresh('kokuu', 'kokuu'); b.p[0].hp = 1; b.p[1].hp = 1; b.timer = 99;
  // 同時KO：相打ち
  b.p[0].x = 470; b.p[1].x = 520; run(b, [[1, 5, 'lp']], () => inp(5, 'lp'), 260);
  ok(b.wins[0] === 1 && b.wins[1] === 1, '同時KOは両者にラウンド（' + b.wins + '）'); }
{ const b = fresh(); b.wins = [1, 0]; b.p[1].hp = 100; run(b, [[3, 5, 'hp']], N, 260); ok(b.matchOver && b.matchOver.winner === 0, '2ラウンド先取で試合終了'); }

console.log('■ 密着で技が当たる');
{
  const CMD = { fire: [[2], [3], [6, 'lp']], dp: [[6], [2], [3, 'lp']], tatsu: [[2], [3], [6, 'lk']], palm: [[2], [1], [4, 'lp']], rushk: [[2], [1], [4, 'lk']],
    wave: [[2], [3], [6, 'lk']], rekka1: [[2], [1], [4, 'lp']], grab: [[6], [3], [2], [1], [4, 'lp']] };
  const ids = { kokuu: ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'c_lp', 'c_mp', 'c_hp', 'c_lk', 'c_mk', 'c_hk', 'f_mp', 'f_hp', 'b_hk', 'fire', 'dp', 'tatsu', 'palm', 'rushk'],
    shuuen: ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'c_lp', 'c_mp', 'c_hp', 'c_lk', 'c_mk', 'c_hk', 'f_hp', 'f_mk', 'b_hp', 'wave', 'dp', 'rekka1', 'rushk', 'grab'] };
  for (const att of ['kokuu', 'shuuen']) for (const def of ['kokuu', 'shuuen']) {
    const bad = [];
    for (const id of ids[att]) for (const c of [{}, { crouch: 1 }, { corner: 1 }, { gap: 10 }]) {
      const b = new KF.Battle({ p1: att, p2: def, meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
      const A = b.p[0], D = b.p[1], g = c.gap != null ? c.gap : A.D.pushW / 2 + D.D.pushW / 2;
      if (c.corner) { D.x = b.limits()[1]; A.x = D.x - g; } else { A.x = 470; D.x = 470 + g; }
      A.facing = 1; D.facing = -1;
      const dIn = c.crouch ? inp(2) : N();
      const seq = CMD[id] || (id.startsWith('c_') ? [[2, id.slice(2)]] : id.startsWith('f_') ? [[6, id.slice(2)]] : id.startsWith('b_') ? [[4, id.slice(2)]] : [[5, id]]);
      for (const q of seq) b.step([inp(q[0], q[1]), dIn]);
      const hold = seq[seq.length - 1][0] === 2 ? inp(2) : N(); let hit = false;
      for (let f = 0; f < 90; f++) { const e0 = b.events.length; b.step([hold, dIn]); for (const e of b.events.slice(e0)) if (e.type === 'hit' || e.type === 'block') hit = true; if (A.state === 'throwing') hit = true; }
      if (!hit) bad.push(id + (c.crouch ? '(しゃがみ)' : c.corner ? '(画面端)' : c.gap != null ? '(重なり)' : ''));
    }
    ok(!bad.length, att + ' → ' + def + '：密着・しゃがみ・画面端・重なりで全部の技が当たる' + (bad.length ? '（空振り：' + bad.join(' ') + '）' : ''));
  }
}

console.log('■ →→のラッシュは技をキャンセルするときだけ');
{
  const setup = () => { const b = new KF.Battle({ p1: 'kokuu', p2: 'shuuen', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]); b.p[0].x = 400; b.p[1].x = 640; b.p[0].facing = 1; b.p[1].facing = -1; return b; };
  let b = setup(); [inp(6), N(), inp(6), inp(6)].forEach(x => b.step([x, N()])); ok(b.p[0].state === 'dash', '何もしていないときの→→は普通のダッシュ（ラッシュにはならない）');
  b = setup(); b.p[0].rush = 0; [inp(6), N(), inp(6), inp(6)].forEach(x => b.step([x, N()])); ok(b.p[0].state === 'dash', 'ゲージがなくても→→は普通のダッシュ');
  b = setup(); b.p[0].x = 560; b.p[1].x = 620; b.step([inp(2, 'mk'), N()]); let rc = false;
  for (let f = 0; f < 40; f++) { const e0 = b.events.length; b.step([f === 9 ? inp(6) : f === 10 ? N() : f === 11 ? inp(6) : inp(2), N()]); if (b.events.slice(e0).some(e => e.type === 'rushcancel')) rc = true; }
  ok(rc, 'しゃがみ中Kが当たったあと→→でラッシュキャンセルできる');
  b = setup(); for (let i = 0; i < 21; i++) b.step([inp(6), N()]); ok(b.p[0].state === 'walk_f', '前を押し続けるだけならラッシュは出ない');
}

console.log('■ 昇竜コマンドはスト6と同じ（前→下→前）');
{
  const tryCmd = (k, seq) => { const b = new KF.Battle({ p1: k, p2: 'shuuen', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]); b.p[0].x = 400; b.p[1].x = 640; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].sup = KF.CONST.SUPER_MAX;
    seq.forEach(q => b.step([inp(q[0], q[1]), N()])); for (let i = 0; i < 3; i++) b.step([N(), N()]); return b.p[0].moveId; };
  const D = (s, btn = 'lp') => { const a = s.split('').map(Number); return a.map((d, i) => i === a.length - 1 ? [d, btn] : [d]); };
  const names = { 623: '→↓↘', 626: '→↓→', 636: '→↘→（→押しっぱなしで↓をはじく）', 616: '→↙→', 323: '↘↓↘（しゃがみ昇竜）', 326: '↘↓→', 313: '↘↙↘', 923: '↗↓↘', 936: '↗↘→', 916: '↗↙→' };
  for (const k of ['kokuu', 'shuuen']) {
    const bad = Object.keys(names).filter(c => tryCmd(k, D(c)) !== 'dp');
    ok(!bad.length, k + '：スト6で昇竜が出る10通りの入れ方がすべて出る' + (bad.length ? '（出ない：' + bad.map(c => names[c]).join(' ') + '）' : ''));
  }
  ok(tryCmd('kokuu', D('6236')) === 'dp', '前歩きからの↓↘→＋Pは昇竜（スト6と同じ）');
  ok(tryCmd('kokuu', [[5], [5], ...D('236')]) === 'fire', '止まってからの↓↘→＋Pは飛び道具');
  ok(tryCmd('kokuu', D('63')) !== 'dp', '→↘＋P（↓をはじいた瞬間にP）では昇竜は出ない（スト6と同じ）');
  ok(tryCmd('kokuu', D('639')) !== 'dp', '最後が↗（→↘↗）では昇竜は出ない（スト6と同じ）');
  ok(tryCmd('kokuu', D('23')) !== 'dp', '↓↘＋Pだけでは昇竜は出ない');
  ok(tryCmd('kokuu', [[3, 'lp']]) === 'c_lp', 'その場で↘＋弱Pはしゃがみ弱P');
  ok(tryCmd('kokuu', D('323', 'lp,mp')) === 'dp_ex', '↘↓↘でもP2つ同時押しでEX');
}

console.log('■ 超必殺のコマンドはスト6リュウと同じ');
{
  const tryCmd = (seq, bars) => { const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]); b.p[0].x = 400; b.p[1].x = 470; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].sup = bars * 1000;
    seq.forEach(q => b.step([inp(q[0], q[1]), N()])); for (let i = 0; i < 3; i++) b.step([N(), N()]); return b.p[0].moveId; };
  ok(tryCmd([[2], [3], [6], [2], [3], [6, 'hp']], 3) === 'su1', '↓↘→↓↘→＋Pで虚空砲（1本）');
  ok(tryCmd([[2], [1], [4], [2], [1], [4, 'hp']], 3) === 'su2', '↓↙←↓↙←＋Pで零界継承（2本）');
  ok(tryCmd([[2], [3], [6], [2], [3], [6, 'hk']], 3) === 'su3', '↓↘→↓↘→＋Kで天地穿（3本）');
  ok(tryCmd([[2], [3], [6], [2], [3], [6, 'hk']], 2) !== 'su3', 'ゲージが3本ないときは天地穿は出ない');
  ok(tryCmd([[6], [2], [3], [6], [2], [3, 'hp']], 3) !== 'su3', '前のコマンド（→↓↘→↓↘＋P）では天地穿は出ない');
}

console.log('■ 空中追撃の決まりとK技の役割');
{
  const mk = () => { const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]); b.camX = 512; b.p[0].x = 470; b.p[1].x = 516; b.p[0].facing = 1; b.p[1].facing = -1; return b; };
  const play = (b, seq, n = 120, p2 = () => N()) => { const ev = []; const q = seq.slice(); for (let f = 0; f < n; f++) { const e0 = b.events.length; b.step([q.length ? q.shift() : N(), p2(f)]); ev.push(...b.events.slice(e0)); } return ev; };
  // 昇穿の後は超必殺以外で追撃できない
  { const b = mk(); const ev = play(b, [inp(6), inp(2), inp(3, 'hp'), ...Array(40).fill(N()), inp(2), inp(3), inp(6, 'lk')], 140);
    ok(!ev.some(e => e.type === 'hit' && e.move === 'tatsu'), '昇穿で浮かせた相手には旋風脚が当たらない（追撃カウントが上限）'); }
  // 旋風脚の最後の1発で浮く
  { const b = mk(); let launched = false; play(b, [inp(2), inp(3), inp(6, 'mk')], 60, () => { if (b.p[1].state === 'launch') launched = true; return N(); });
    ok(launched, '旋風脚が当たると相手が浮く'); }
  // 浮いた相手に通常技（強P）は当たらないが、虚掌破のあとだけは当たる
  { const b = mk(); const ev = play(b, [inp(2), inp(3), inp(6, 'lk'), ...Array(30).fill(N()), inp(5, 'hp')], 120);
    ok(!ev.some(e => e.type === 'hit' && e.move === 'hp'), '旋風脚で浮いた相手に通常技は当たらない'); }
  // 旋踵はガードさせて有利
  { const b = mk(); const ev = play(b, [inp(4, 'hk')], 80, () => inp(6)); const adv = ev.find(e => e.type === 'adv');
    ok(adv && adv.v >= 1, '旋踵はガードさせて有利（' + (adv ? adv.v : '?') + 'F）'); }
  // 迅閃脚は下段：立ちガードできない
  { const b = mk(); b.p[1].x = 560; const ev = play(b, [inp(2), inp(1), inp(4, 'mk')], 80, () => inp(6));
    ok(ev.some(e => e.type === 'hit' && e.move === 'rushk'), '迅閃脚は下段（立ちガードでは防げない）'); }
  // 迅閃脚は飛び道具をくぐる
  for (const slide of [false, true]) {
    const b = mk(); b.p[1].x = 760; b.camX = 620; const q = []; let go = false, hit = false;
    for (let f = 0; f < 120; f++) {
      const pr = b.projs[0]; if (slide && !go && pr && pr.x - b.p[0].x < 70) { go = true; q.push(inp(2), inp(1), inp(4, 'hk')); }
      const e0 = b.events.length; b.step([q.shift() || N(), f === 0 ? inp(2) : f === 1 ? inp(1) : f === 2 ? inp(4, 'lp') : N()]);
      if (b.events.slice(e0).some(e => e.type === 'hit' && e.side === 1)) hit = true;
    }
    ok(slide ? !hit : hit, slide ? '迅閃脚は飛び道具をくぐる' : '（確認）滑らなければ飛び道具に当たる');
  }
  // 強Kのパニッシュカウンターで浮く
  { const b = mk(); b.p[1].x = 585; let launched = false; play(b, [...Array(8).fill(N()), inp(5, 'hk')], 60, (f) => { if (b.p[1].state === 'launch') launched = true; return f === 0 ? inp(2, 'hp') : f < 7 ? inp(2) : N(); });
    ok(launched, '強Kはパニッシュカウンターで浮く'); }
}

console.log('■ トレーニングのラッシュゲージ回復');
{
  const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta, training: true }); b.p[0].x = 470; b.p[1].x = 520; b.p[0].facing = 1; b.p[1].facing = -1;
  const q = [inp(2, 'mk'), ...Array(8).fill(inp(2)), inp(6), N(), inp(6)];
  let low = 6000, done = false;
  for (let f = 0; f < 200; f++) { b.step([q.length ? q.shift() : N(), N()]); low = Math.min(low, b.p[0].rush); }
  ok(low < KF.CONST.RUSH_MAX && b.p[0].rush === KF.CONST.RUSH_MAX, 'ラッシュキャンセルで減ったゲージが、コンボが終わると満タンに戻る（最小' + low + '）');
  const b2 = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta, training: true }); b2.p[0].x = 300; b2.p[1].x = 700;
  const q2 = [inp(5, 'rush')]; let low2 = 6000;
  for (let f = 0; f < 200; f++) { b2.step([q2.length ? q2.shift() : N(), N()]); low2 = Math.min(low2, b2.p[0].rush); }
  ok(low2 < KF.CONST.RUSH_MAX && b2.p[0].rush === KF.CONST.RUSH_MAX, '当てずにラッシュしたときも、少し待つと満タンに戻る');
  const b3 = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b3.step([N(), N()]); b3.p[0].x = 300; b3.p[1].x = 700;
  [inp(5, 'rush')].forEach(x => b3.step([x, N()])); for (let f = 0; f < 120; f++) b3.step([N(), N()]);
  ok(b3.p[0].rush < KF.CONST.RUSH_MAX, '（確認）対戦ではラッシュゲージはすぐには戻らない');
}

console.log('■ トレーニングの位置リセット');
{
  const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta, training: true });
  for (let f = 0; f < 30; f++) b.step([inp(6), N()]);
  const W = KF.CONST.WORLD_W, wall = KF.CONST.WALL;
  const chk = (mode, cond, msg) => { b.resetTraining(mode); for (let f = 0; f < 3; f++) b.step([N(), N()]); const lim = b.limits(); ok(cond(b.p[0], b.p[1], lim), msg + '（1P ' + b.p[0].x.toFixed(0) + ' / 2P ' + b.p[1].x.toFixed(0) + '）'); };
  chk('center', (a, d) => Math.abs((a.x + d.x) / 2 - W / 2) < 5 && a.x < d.x && a.facing === 1, '中央：1Pが左、2Pが右');
  chk('oRight', (a, d, lim) => d.x >= lim[1] - 3 && a.x < d.x, '→＋リセット：相手が右の画面端');
  chk('sLeft', (a, d, lim) => a.x <= lim[0] + 3 && a.x < d.x, '←＋リセット：自分が左の画面端を背負う');
  chk('sRight', (a, d, lim) => a.x >= lim[1] - 3 && a.x > d.x && a.facing === -1, '↘＋リセット：自分が右の画面端を背負う（左向き）');
  chk('oLeft', (a, d, lim) => d.x <= lim[0] + 3 && a.x > d.x, '↙＋リセット：相手が左の画面端');
  b.p[1].hp = 100; b.p[0].rush = 0; b.resetTraining('center'); ok(b.p[1].hp === b.p[1].D.hp && b.p[0].rush === KF.CONST.RUSH_MAX, 'リセットで体力とラッシュゲージも戻る');
}

console.log('■ ラッシュキャンセルは1コンボに2回まで（スト6と同じ）');
for (const how of ['button', '66']) {
  const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.camX = 512; b.p[0].x = 470; b.p[1].x = 520; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].rush = KF.CONST.RUSH_MAX;
  let rc = 0, f = 0; const ev = [];
  const rushIn = how === 'button' ? [inp(5, 'rush')] : [inp(6), N(), inp(6)];
  const play = (arr, n) => { const q = arr.slice(); for (let i = 0; i < n; i++) { const e0 = b.events.length; b.step([q.length ? q.shift() : N(), N()]); for (const e of b.events.slice(e0)) { ev.push(e); if (e.type === 'rushcancel') rc++; } } };
  const waitHit = (n) => { for (let i = 0; i < n; i++) { const e0 = b.events.length; b.step([N(), N()]); const got = b.events.slice(e0); got.forEach(e => { ev.push(e); if (e.type === 'rushcancel') rc++; }); if (got.some(e => e.type === 'hit' && e.side === 0)) return; } };
  play([inp(2, 'mk')], 1); waitHit(20); play(rushIn, rushIn.length); play(Array(8).fill(inp(6)), 8); play([inp(5, 'hp')], 1); waitHit(20); play(rushIn, rushIn.length); play(Array(8).fill(inp(6)), 8); play([inp(5, 'hp')], 1); waitHit(30); play([], 40);
  ok(rc === 2, (how === 'button' ? 'ラッシュボタン' : '→→') + 'で 攻撃＞ラッシュ＞攻撃＞ラッシュ が2回ともキャンセルできる（' + rc + '回）');
  const b2 = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); b2.p[0].rush = 5900; ok(5900 < 2 * KF.CONST.RUSH_CANCEL_COST + 1 && KF.CONST.RUSH_MAX === 2 * KF.CONST.RUSH_CANCEL_COST, 'ゲージ6本・1回3本なので、3回目はゲージが足りず出ない');
}

console.log('■ 虚掌破は強Pからだけつながる（ほかの技からは出るがつながらない）／EX虚掌破はどの強さからでもつながる');
{
  const starters = { '弱P': [[5, 'lp']], '中P': [[5, 'mp']], '強P': [[5, 'hp']], '弱K': [[5, 'lk']], 'しゃがみ弱P': [[2, 'lp']], 'しゃがみ中P': [[2, 'mp']], 'しゃがみ強P': [[2, 'hp']],
    'しゃがみ弱K': [[2, 'lk']], 'しゃがみ中K': [[2, 'mk']], '→強P': [[6, 'hp']], '←強K': [[4, 'hk']], '中P～強P': [[5, 'mp'], 'wait', [5, 'hp']] };
  const heavyP = ['強P', 'しゃがみ強P', '→強P', '中P～強P'];
  const tryIt = (st, btn) => {
    const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
    b.camX = 512; b.p[0].x = 470; b.p[1].x = st[0][0] === 6 ? 536 : 516; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].sup = 1000;
    const want = btn === 'hp' ? 'palm' : 'palm_ex'; let got = false; tryIt.came = false;
    const stepW = (x) => { const e0 = b.events.length; b.step([x, N()]); return b.events.slice(e0); };
    const waitHit = () => { for (let i = 0; i < 25; i++) if (stepW(N()).some(e => e.type === 'hit' && e.side === 0)) return true; return false; };
    for (const q of st) { if (q === 'wait') { waitHit(); continue; } const hold = q[0] === 2 ? [inp(2)] : []; stepW(inp(q[0], q[1])); }
    if (!waitHit()) return false;
    for (const x of [inp(2), inp(1), inp(4, btn)]) { for (const e of stepW(x)) if (e.type === 'hit' && e.move === want && e.combo >= 2) got = true; if (b.p[0].moveId === want) tryIt.came = true; }
    for (let i = 0; i < 90; i++) { for (const e of stepW(N())) if (e.type === 'hit' && e.move === want && e.combo >= 2) got = true; if (b.p[0].moveId === want) tryIt.came = true; }
    return got;
  };
  const okP = [], ngP = [], okEX = [], ngEX = [], notCame = [];
  for (const [n, st] of Object.entries(starters)) {
    const p = tryIt(st, 'hp'), came = tryIt.came, x = tryIt(st, 'lp,mp');
    (p === heavyP.includes(n) ? okP : ngP).push(n + (p ? '○' : '×'));
    if (!came && n !== '中P' && n !== '中P～強P') notCame.push(n);
    (x ? okEX : ngEX).push(n);
  }
  ok(!ngP.length, '虚掌破は強Pで出す技からだけつながる' + (ngP.length ? '（違う：' + ngP.join(' ') + '）' : '（' + okP.join(' ') + '）'));
  ok(!notCame.length, '強P以外の通常技からでも虚掌破は出る（つながらないだけ）' + (notCame.length ? '（出ない：' + notCame.join(' ') + '）' : ''));
  ok(!ngEX.length, 'EX虚掌破は弱・中・強どの通常技からでもつながる' + (ngEX.length ? '（つながらない：' + ngEX.join(' ') + '）' : ''));
}

console.log('■ 昇竜SAはスト6と同じ（昇穿はSA3だけ・根本ヒットだけ）');
{
  const run2 = (dpBtn, saSeq, saBtn, gap, bars) => {
    const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
    b.camX = 512; b.p[0].x = 470; b.p[1].x = 470 + gap; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].sup = bars * 1000;
    const q = [inp(6), inp(2), inp(3, dpBtn)]; let dpDmg = null, sa = null;
    for (let f = 0; f < 140; f++) {
      if (f === 4) saSeq.forEach((d, i) => q.push(inp(d, i === saSeq.length - 1 ? saBtn : '')));
      const e0 = b.events.length; b.step([q.length ? q.shift() : N(), N()]);
      for (const e of b.events.slice(e0)) { if (e.type === 'hit' && /^dp/.test(e.move) && dpDmg == null) dpDmg = e.dmg; if (e.type === 'super') sa = sa || b.p[0].moveId; }
    }
    return { dpDmg, sa };
  };
  const S3 = [2, 3, 6, 2, 3, 6], S2 = [2, 1, 4, 2, 1, 4], S1 = [2, 3, 6, 2, 3, 6];
  ok(run2('hp', S3, 'hk', 44, 3).sa === 'su3', '強昇穿を根本で当てると天地穿（SA3）でキャンセルできる');
  ok(run2('hp', S1, 'hp', 44, 3).sa == null, '昇穿は虚空砲（SA1）ではキャンセルできない');
  ok(run2('hp', S2, 'hp', 44, 3).sa == null, '昇穿は零界継承（SA2）ではキャンセルできない');
  ok(run2('lp,mp', S2, 'hp', 44, 3).sa === 'su2', 'EX昇穿は零界継承（SA2）でキャンセルできる');
  // 対空で持続の後半に当てる（飛び込んでくる相手に早めに昇穿）
  let late = null;
  for (const t of [12, 14, 16]) {
    const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
    b.camX = 512; b.p[0].x = 420; b.p[1].x = 590; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].sup = 3000;
    const q = [...Array(t).fill(N()), inp(6), inp(2), inp(3, 'hp'), N(), N(), N(), inp(2), inp(3), inp(6), inp(2), inp(3), inp(6, 'hk')]; let r = null, sa = false;
    for (let f = 0; f < 120; f++) { const e0 = b.events.length; b.step([q.shift() || N(), f === 0 ? inp(7) : N()]);
      for (const e of b.events.slice(e0)) { if (e.type === 'hit' && e.move === 'dp' && !r) { const A = b.p[0]; r = { af: A.animTime() - A.A[A.anim].firstActive + 1, dmg: e.dmg }; } if (e.type === 'super') sa = true; } }
    if (r && r.af > 2) { late = Object.assign(r, { sa }); break; }
  }
  ok(late && late.dmg <= 800 && !late.sa, '持続の後半で当たった昇穿は個別ダメージ（' + (late ? late.dmg + '、持続' + late.af + 'F目' : '?') + '）になり、SA3でもキャンセルできない');
}

console.log('■ 昇穿の性能はスト6の昇龍拳と同じ');
{
  const fresh = (gap) => { const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]); b.camX = 512; b.p[0].x = 470; b.p[1].x = 470 + gap; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].sup = 3000; return b; };
  const want = { lp: [5, -23], mp: [6, -32], hp: [7, -39] };
  for (const [btn, [su, bl]] of Object.entries(want)) {
    let b = fresh(44); [inp(6), inp(2)].forEach(x => b.step([x, N()])); let st = null;
    for (let f = 1; f < 20 && st == null; f++) { const e0 = b.events.length; b.step([f === 1 ? inp(3, btn) : N(), N()]); if (b.events.slice(e0).some(e => e.type === 'hit')) st = f; }
    b = fresh(44); const q = [inp(6), inp(2), inp(3, btn)]; let adv = null;
    for (let f = 0; f < 140; f++) { const e0 = b.events.length; b.step([q.shift() || N(), inp(6)]); for (const e of b.events.slice(e0)) if (e.type === 'adv' && adv == null) adv = e.v; }
    ok(st === su && adv === bl, ({ lp: '弱', mp: '中', hp: '強' })[btn] + '昇穿：発生' + st + 'F（' + su + 'F）・ガード' + adv + 'F（' + bl + 'F）');
  }
  // 地上の攻撃には無敵がない：相手の強Pが先に出ていれば負ける／飛び込みには勝つ／EXは地上の攻撃にも勝つ
  const vs = (btn, air, d) => { const b = fresh(air ? 130 : 46); const q = [...Array(d).fill(N()), inp(6), inp(2), inp(3, btn)]; const p2 = air ? [inp(7), ...Array(14).fill(N()), inp(5, 'hk')] : [inp(5, 'hp')]; let w = '';
    for (let f = 0; f < 60; f++) { const e0 = b.events.length; b.step([q.shift() || N(), p2.shift() || N()]); for (const e of b.events.slice(e0)) if (e.type === 'hit' && !w) w = e.side === 0 ? 'win' : 'lose'; } return w; };
  ok(vs('hp', false, 5) === 'lose', '強昇穿は地上の攻撃には無敵がなく、打ち負ける');
  ok(vs('hp', true, 8) === 'win', '強昇穿は飛び込みには無敵で勝つ');
  ok(vs('lp,mp', false, 5) === 'win', 'EX昇穿は完全無敵で、地上の攻撃にも勝つ');
}

console.log('■ 昇竜SA（強昇穿＞天地穿）はスト6のどの入れ方でも出る');
{
  // 文字列：数字＝レバー（1F）、P＝強P、K＝強K。例 '623P236236K'
  const play = (str) => {
    const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
    b.camX = 512; b.p[0].x = 470; b.p[1].x = 514; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].sup = 3000;
    const q = []; let last = 5;
    for (const ch of str) { if (ch === 'P' || ch === 'K') { q[q.length - 1] = inp(last, ch === 'P' ? 'hp' : 'hk'); } else { last = +ch; q.push(inp(last)); } }
    let su = false, dp = false;
    for (let f = 0; f < 160; f++) { const e0 = b.events.length; b.step([q.length ? q.shift() : N(), N()]);
      for (const e of b.events.slice(e0)) { if (e.type === 'hit' && e.move === 'dp') dp = true; if (e.type === 'hit' && e.move === 'su3' && dp) su = true; } }
    return su;
  };
  const ways = {
    '623P236236K': '昇竜のあと、真・昇龍拳のコマンドを全部入れ直す',
    '6236P236K': '複合入力（→↓↘→＋強P、↓↘→＋K）',
    '623P36236K': '複合入力（→↓↘＋強P、↘→↓↘→＋K）',
    '323P6236K': 'レバーレス（↘↓↘＋強P、→↓↘→＋K）',
    '623P23626K': '簡易コマンド（↓↘→↓→＋K）',
    '623P26236K': '簡易コマンド（↓→↓↘→＋K）',
    '6236P26K': '複合入力＋簡易（→↓↘→＋強P、↓→＋K）',
  };
  for (const [w, nm] of Object.entries(ways)) ok(play(w), nm + '：' + w);
  ok(!play('623P236K'), '（確認）昇竜のあと↓↘→＋Kだけでは出ない（前の入力が足りない）');
}

console.log('■ 昇竜SAの猶予（飛び上がったあとでも、空中からもう一度突き上げる）');
{
  const tryD = (d) => { const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
    b.camX = 512; b.p[0].x = 470; b.p[1].x = 514; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].sup = 3000;
    const q = [inp(6), inp(2), inp(3, 'hp')]; let hitF = null, su = 0, h = null;
    for (let f = 0; f < 220; f++) { if (hitF != null && f === hitF + d) q.push(inp(2), inp(3), inp(6), inp(2), inp(3), inp(6, 'hk'));
      const e0 = b.events.length; b.step([q.shift() || N(), N()]);
      for (const e of b.events.slice(e0)) { if (e.type === 'hit' && e.move === 'dp' && hitF == null) hitF = f; if (e.type === 'hit' && e.move === 'su3') su++; if (e.type === 'super' && h == null) h = Math.round(C.GROUND - b.p[0].y); } }
    return { su, h }; };
  const early = tryD(3), late = tryD(25), tooLate = tryD(40);
  ok(early.su >= 6, '昇穿が当たってすぐ入れると、天地穿が最後まで当たる（' + early.su + 'hit）');
  ok(late.su >= 6 && late.h > 40, '飛び上がったあと（当たって25F後）に入れても、空中から天地穿が出て最後まで当たる（高さ' + late.h + '・' + late.su + 'hit）');
  ok(tooLate.h == null, '遅すぎる（当たって40F後）とSAは出ない（ゲージを無駄にしない）');
}

console.log('■ ラッシュから出した技（勢いが残る・後すきが短い・有利は技だけ）');
{
  const mk = () => { const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]); b.camX = 400; b.p[0].x = 200; b.p[1].x = 900; b.p[0].facing = 1; b.p[1].facing = -1; return b; };
  // 勢い：ラッシュ強Pは止まらずに滑る
  const PR = [inp(5, 'rush'), inp(5, 'rush'), inp(6, 'rush'), inp(5, 'rush'), inp(6, 'rush')];
  let b = mk(); const A = b.p[0]; PR.forEach(x => b.step([x, N()])); for (let i = 0; i < 7; i++) b.step([N(), N()]); b.step([inp(5, 'hp'), N()]); const x0 = A.x; for (let i = 0; i < 40; i++) b.step([N(), N()]);
  ok(A.x - x0 >= 50, 'ラッシュ強Pは勢いを残したまま滑りながら出る（' + Math.round(A.x - x0) + 'px）');
  // 後すき：同じ強Pでも、ラッシュから出すと早く動けるようになる
  const recov = (rush) => { const b2 = mk(); if (rush) { b2.step([inp(5, 'rush'), N()]); for (let i = 0; i < 7; i++) b2.step([N(), N()]); } b2.step([inp(5, 'hp'), N()]); let n = 0; while (!b2.p[0].actionable() && n < 80) { b2.step([N(), N()]); n++; } return n; };
  const r0 = recov(false), r1 = recov(true);
  ok(r1 <= r0 - KF.CONST.RUSH_REC_CUT, 'ラッシュから出した強Pは後すきが短い（' + r0 + 'F → ' + r1 + 'F）');
  // 有利はラッシュから出した技にだけ：そこからキャンセルした旋風脚には付かない
  b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]); b.camX = 512; b.p[0].x = 380; b.p[1].x = 520; b.p[0].facing = 1; b.p[1].facing = -1;
  const q = [...PR, ...Array(7).fill(N()), inp(5, 'hp')]; let tatsuBonus = null;
  for (let f = 0; f < 120; f++) { const e0 = b.events.length; if (b.p[0].moveId === 'hp' && b.p[0].connected && !q.length) q.push(inp(2), inp(3), inp(6, 'mk')); b.step([q.length ? q.shift() : N(), N()]); if (b.p[0].moveId === 'tatsu' && tatsuBonus == null) tatsuBonus = b.p[0].rushBonus; }
  ok(tatsuBonus === false, 'ラッシュの有利は、ラッシュから出した技にだけ付く（キャンセルした旋風脚には付かない）');
}

console.log('■ アッパー → 波動 → ラッシュ → 強P ＞ 昇穿');
{
  for (const how of ['button', '66']) {
    const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
    b.camX = 512; b.p[0].x = 470; b.p[1].x = 516; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].rush = KF.CONST.RUSH_MAX;
    const seq = []; const q = [inp(2), inp(1), inp(4, 'hp')]; let stage = 0, wait = 0;
    for (let f = 0; f < 260; f++) {
      const A = b.p[0];
      if (stage === 0 && seq.includes('palm') && A.actionable()) { q.push(inp(2), inp(3), inp(6, 'lp')); stage = 1; }
      if (stage === 1 && A.projHit) { if (how === 'button') q.push(inp(5, 'rush')); else q.push(inp(6), N(), inp(6)); stage = 2; wait = 9; }
      if (stage === 2 && A.state === 'rush' && --wait <= 0) { q.push(inp(5, 'hp')); stage = 3; }
      if (stage === 3 && A.moveId === 'hp' && A.connected) { q.push(inp(6), inp(2), inp(3, 'hp')); stage = 4; }
      const e0 = b.events.length; b.step([q.length ? q.shift() : N(), N()]);
      for (const e of b.events.slice(e0)) if (e.type === 'hit' && e.side === 0) seq.push(e.move + (e.combo === seq.length + 1 ? '' : '(途切れ)'));
    }
    ok(seq.join(' ') === 'palm fire hp dp', (how === 'button' ? 'RUSHボタン' : '→→') + 'で アッパー → 波動 → ラッシュ強P ＞ 昇穿 が途切れずにつながる（' + seq.join(' ') + '）');
  }
}

console.log('■ アッパー → 波動 → ラッシュ → パンチ ＞ 昇穿 は、押すタイミングがばらついてもつながる');
{
  const run = (o) => { const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]); b.camX = 512; b.p[0].x = 470; b.p[1].x = 516; b.p[0].facing = 1; b.p[1].facing = -1; b.p[0].rush = 6000;
    const A = b.p[0]; const q = [inp(2), inp(1), inp(4, 'hp')]; const seq = []; let st = 0, w = 0, cnt = 0;
    for (let f = 0; f < 300; f++) {
      if (st === 0 && seq.includes('palm') && A.actionable()) { if (cnt++ >= o.fd) { q.push(inp(2), inp(3), inp(6, o.fb)); st = 1; cnt = 0; } }
      if (st === 1 && A.projHit) { if (cnt++ >= o.rd) { q.push(...(o.rush === 'btn' ? [inp(5, 'rush')] : [inp(6), N(), inp(6)])); st = 2; w = o.pd; } }
      if (st === 2 && A.state === 'rush') { if (--w <= 0) { q.push(inp(5, o.pb)); st = 3; } }
      if (st === 3 && /^(lp|mp|hp)$/.test(A.moveId || '') && A.connected) { q.push(inp(6), inp(2), inp(3, 'hp')); st = 4; }
      const e0 = b.events.length; b.step([q.length ? q.shift() : N(), N()]);
      for (const e of b.events.slice(e0)) if (e.type === 'hit' && e.side === 0) seq.push(e.move + (e.combo === seq.length + 1 ? '' : '!'));
    }
    return /^palm fire (lp|mp|hp) dp$/.test(seq.join(' ')); };
  let tot = 0, bad = []; 
  for (const fb of ['lp', 'mp', 'hp']) for (const fd of [2, 6, 10, 14]) for (const rd of [0, 4, 8]) for (const rush of ['btn', '66']) for (const pd of [1, 6, 12]) for (const pb of ['lp', 'mp', 'hp']) {
    tot++; if (!run({ fb, fd, rd, rush, pd, pb })) bad.push(`波動${fb}遅れ${fd} ラッシュ遅れ${rd}${rush} パンチ${pb}遅れ${pd}`); }
  ok(!bad.length, '波動の強さ・入れる遅れ（2〜14F）、ラッシュ（ボタン・→→）と遅れ、パンチの種類と遅れを変えた ' + tot + ' 通りすべてでつながる' + (bad.length ? '（失敗：' + bad.slice(0, 3).join('／') + ' ほか' + bad.length + '）' : ''));
}

// 対空の波動が空中の相手に当たったら、技の戻りの最中でも虚空砲でキャンセルしてつながる
{ const b = new KF.Battle({ p1: 'kokuu', p2: 'kokuu', meta }); for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[0].x = 300; b.p[1].x = 580; b.camX = 512; b.p[0].sup = 3000; b.p[0].facing = 1; b.p[1].facing = -1;
  const q = [], q2 = [inp(7)]; for (let i = 0; i < 8; i++) q.push(N()); [2, 3, 6].forEach((d, i) => q.push(inp(d, i === 2 ? 'hp' : '')));
  let st = 0; const hs = [];
  for (let f = 0; f < 200; f++) { const e0 = b.events.length; b.step([q.length ? q.shift() : N(), q2.length ? q2.shift() : N()]);
    for (const e of b.events.slice(e0)) if (e.type === 'hit' && e.side === 0) hs.push(e.move + '#' + e.combo);
    if (!st && hs.some(x => /^fire/.test(x))) { st = 1; [2, 3, 6, 2, 3, 6].forEach((d, i) => q.push(inp(d, i === 5 ? 'hp' : ''))); } }
  ok(hs.some(x => x === 'su1#2'), '遠くで空中の相手に当たった波動から虚空砲がつながる（' + hs.join(' ') + '）'); }
console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
