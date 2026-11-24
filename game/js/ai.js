// =====================================================================
//  CPU（EASY / NORMAL / HARD / EXPERT）
//  ・相手の状態は「反応時間」ぶん過去の情報しか見ない（先読み・超反応をしない）
//  ・難易度で変わるのは判断の精度：ガード率・対空・確定反撃・コンボの長さ・
//    ゲージの使い方・ラッシュの判断・間合い管理・必殺技の使い分け
//  ・入力はコマンドを1フレームずつ打ち込み、人間と同じ入力判定を通る
// =====================================================================
'use strict';
var KF = window.KF || (window.KF = {});

KF.AI_LEVELS = {
  EASY:   { react: 34, block: 0.25, lowRead: 0.2, aa: 0.12, punish: 0.1, combo: 1, confirm: 0, rush: 0.03, tech: 0.1, spacing: 0.3, think: 18, jump: 0.12, superUse: 0.3, fireball: 0.25, reversal: 0.0, mistake: 0.25 },
  NORMAL: { react: 24, block: 0.55, lowRead: 0.45, aa: 0.38, punish: 0.4, combo: 2, confirm: 0.3, rush: 0.12, tech: 0.3, spacing: 0.6, think: 12, jump: 0.08, superUse: 0.6, fireball: 0.4, reversal: 0.05, mistake: 0.12 },
  HARD:   { react: 16, block: 0.8, lowRead: 0.7, aa: 0.68, punish: 0.72, combo: 3, confirm: 0.75, rush: 0.3, tech: 0.55, spacing: 0.85, think: 8, jump: 0.05, superUse: 0.85, fireball: 0.55, reversal: 0.15, mistake: 0.05 },
  EXPERT: { react: 12, block: 0.92, lowRead: 0.85, aa: 0.86, punish: 0.92, combo: 4, confirm: 0.95, rush: 0.45, tech: 0.75, spacing: 0.95, think: 5, jump: 0.035, superUse: 1.0, fireball: 0.6, reversal: 0.25, mistake: 0.01 },
};

KF.AI = function (battle, side, level, seed) {
  this.b = battle; this.side = side; this.L = KF.AI_LEVELS[level] || KF.AI_LEVELS.NORMAL; this.level = level;
  this.q = []; this.hold = null; this.snap = []; this.cool = 0;
  this.seed = seed || 12345;
  this.out = { x: 0, y: 0, held: {} };
  this.mode = 'neutral';
};
KF.AI.prototype.rnd = function () { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return this.seed / 0x7fffffff; };
KF.AI.prototype.me = function () { return this.b.p[this.side]; };

// 相手の観測（反応時間ぶん遅れた情報）
KF.AI.prototype.observe = function () {
  var o = this.me().opp, m = this.me();
  this.snap.push({
    state: o.state, moveId: o.moveId, mv: o.move, ph: o.state === 'attack' ? o.phase() : null, air: o.air,
    x: o.x, y: o.y, vx: o.vx, vy: o.vy, rem: o.state === 'attack' ? o.remaining() : 0,
    projs: this.b.projs.filter(function (p) { return p.owner === o; }).map(function (p) { return { x: p.x, vx: p.vx, kind: p.kind }; }),
    hp: o.hp, sup: o.sup,
  });
  if (this.snap.length > 60) this.snap.shift();
  var i = Math.max(0, this.snap.length - 1 - this.L.react);
  return this.snap[i];
};

// 入力キュー：{d:前後基準テンキー, b:'lp,mp', n:保持フレーム}
KF.AI.prototype.push = function (d, b, n) { this.q.push({ d: d, b: b || '', n: n || 1 }); };
KF.AI.prototype.motion = function (seq, btn) {
  // ↓↘→＋Pの直前に前が入っていると昇竜になる（スト6と同じ）ので、前の入力が古くなるまで少し待つ
  if (seq.length === 3 && seq[0] === 2 && seq[1] === 3 && seq[2] === 6 && /p/.test(btn || '')) {
    var H = this.me().buf.hist, age = -1;
    for (var j = H.length - 1; j >= Math.max(0, H.length - 15); j--) if (H[j].dir === 6 || H[j].dir === 3 || H[j].dir === 9) { age = H.length - 1 - j; break; }
    if (age >= 0) this.push(5, '', 15 - age);
  }
  for (var i = 0; i < seq.length; i++) this.push(seq[i], i === seq.length - 1 ? btn : '', i === seq.length - 1 ? 2 : 1);
};
KF.AI.prototype.clear = function () { this.q = []; };

KF.AI.prototype.output = function () { return this.out; };

KF.AI.prototype.update = function () {
  var m = this.me(), o = m.opp, L = this.L, b = this.b;
  this.remember();
  if (this.level === 'EXPERT') this.learnWatch();
  if (this.planJob) { if (this.q.length || !m.actionable()) { this.planJob = null; this.hold = null; } else this.planStep(); }
  var s = this.observe();
  var dist = Math.abs(s.x - m.x);
  var self = this;
  if (b.phase === 'over' && this.learn && !this.learnSaved) { this.learnSave(); this.learnSaved = true; }
  if (b.phase !== 'fight' || b.freeze > 0) { this.out = { x: 0, y: 0, held: {} }; if (b.phase !== 'fight') this.clear(); return; }

  // 投げられた → 投げ抜け（受付時間内に判断できた場合）
  if (m.state === 'thrown' && m.techable && m.techT === 2 && this.rnd() < L.tech) { this.clear(); this.push(5, 'lp,lk', 2); }

  // コンボの継続（自分の技が当たった/ガードされたのを確認して次へ）
  if (this.combo && m.state === 'attack' && m.connected && !this.combo.done) {
    var c = this.combo;
    if (o.state === 'hitstun' || o.state === 'launch' || (c.onBlockToo && o.state === 'blockstun')) {
      if (this.rnd() < (c.confirm ? L.confirm : 1)) { this.clear(); c.next.forEach(function (st) { self.q.push(st); }); }
    }
    c.done = true;
  }
  if (this.plan && m.state === 'attack' && (m.connected || m.projHit) && m.moveId !== this.planLast) {
    this.planLast = m.moveId;
    var stg = this.plan.shift();
    if (stg && (o.state === 'hitstun' || o.state === 'launch' || (o.state === 'blockstun' && this.plan.length > 0 && stg.blockOk))) {
      if (this.rnd() < (this.plan.length ? 0.97 : L.confirm + 0.2)) { this.clear(); var self2 = this; stg.forEach(function (x) { self2.q.push(x); }); }
    } else this.plan = null;
  }
  if (this.plan && m.actionable() && !this.q.length) this.plan = null;
  if (this.combo && m.state !== 'attack' && m.state !== 'rush' && !this.q.length) this.combo = null;
  if (this.after && m.state === 'attack' && m.moveId === 'hp' && m.rushBonus && m.connected) {
    if (o.state === 'hitstun') { this.clear(); this.motion(this.after[0], this.after[1]); }
    this.after = null;
  }
  if (this.after && (m.actionable() && !this.q.length)) this.after = null;
  // 昇竜SA：昇穿が当たったら、飛び上がる前に超必殺でキャンセル
  if (KF.kokuuType(m.kind) && m.state === 'attack' && m.moveId === 'dp' && m.connected && m.rootHit && this.saTried !== m.moveSerial) {
    this.saTried = m.moveSerial;
    var sb = Math.floor(m.sup / 1000);
    if (sb >= 3 && m.rootHit && L.superUse > 0.7 && this.rnd() < 0.5) { this.clear(); this.motion([2, 3, 6, 2, 3, 6], 'hk'); }   // 昇穿はSA3でだけキャンセルできる
  }
  if (this.after3 && m.state === 'attack' && (m.moveId === 'upper' || m.moveId === 'lift') && m.connected && Math.floor(m.sup / 1000) >= 3) { this.clear(); this.motion([2, 3, 6, 2, 3, 6], 'hk'); this.after3 = null; }
  if (this.after3 && m.actionable() && !this.q.length) this.after3 = null;
  // 変身の後の必殺技（しゃがみ弱K ＞ 変身 ＞ 必殺技）
  if (this.after2 && m.state === 'attack' && m.moveId === 'change_in') { this.clear(); this.motion(this.after2[0], this.after2[1]); this.after2 = null; }
  if (this.after2 && m.actionable() && !this.q.length) this.after2 = null;
  // 浮いた相手への追撃：旋風脚などで浮かせたあと、動けるようになったら昇穿（ゲージがあれば超必殺）
  if (this.jug) {
    if (b.frameNo > this.jug.until || o.state === 'down' || o.state === 'getup') this.jug = null;
    else if (!this.q.length && o.state === 'launch' && dist < 150 && (m.actionable() || (m.state === 'attack' && m.remaining() + m.hs <= 4))) {
      var jb = Math.floor(m.sup / 1000);
      if (jb >= 1 && L.superUse > 0.7 && this.rnd() < 0.35) this.motion([2, 3, 6, 2, 3, 6], 'hp');
      else this.motion([6, 2, 3], 'hp');
      this.jug = null;
    }
  }
  if (KF.kokuuType(m.kind) && m.state === 'attack' && m.moveId === 'hk' && m.connected && o.state === 'launch' && !this.jug && this.rnd() < L.confirm + 0.2) this.jug = { until: b.frameNo + 60 };

  // 防御判断（キューより優先）
  var threat = this.threat(s, dist);
  if (m.actionable() && threat) {
    var r = this.rnd();
    if (threat.kind === 'air' && dist < 190 && r < L.aa) {
      this.clear(); this.antiAir(dist);
    } else if (threat.kind === 'proj' && m.kind === 'gai_s' && threat.d > 40 && threat.d < 100 && r < L.spacing * 0.8) {
      this.clear(); this.motion([2, 3, 6], 'lk');   // 反射
    } else if (threat.kind === 'proj' && KF.kokuuType(m.kind) && threat.d > 55 && threat.d < 110 && dist < 260 && r < L.spacing * 0.7) {
      this.clear(); this.motion([2, 1, 4], dist > 180 ? 'hk' : (dist > 120 ? 'mk' : 'lk'));
    } else if (threat.kind === 'proj' && L.spacing > 0.5 && threat.d > 130 && r < L.jump * 6) {
      this.clear(); this.push(9, '', 8); this.push(9, 'hk', 1);
    } else if (r < L.block || (this.guarding && this.rnd() < 0.85)) {
      this.clear();
      var low = threat.low && this.rnd() < L.lowRead;
      var high = threat.high;
      this.push(low && !high ? 1 : 4, '', 3);
      this.guarding = true;
    } else if (this.rnd() < L.mistake) {
      this.clear(); this.push(5, this.pick(['lp', 'lk', 'mp']), 1);
    }
  } else if (!threat) this.guarding = false;

  // 確定反撃：相手が硬直中
  if (m.actionable() && !this.q.length && s.state === 'attack' && s.ph === 'r' && s.mv && s.rem > 12 && dist < 120 && this.rnd() < L.punish) {
    this.punish(dist, s);
  }
  // 起き上がりの切り返し
  // 通常の昇穿は空中の攻撃にしか無敵がないので、切り返しはゲージがあればEX昇穿（完全無敵）で
  if (m.state === 'getup' && m.aF === m.animObj().frames.length - 2 && dist < 110 && this.rnd() < L.reversal) {
    this.clear();
    if (m.D.base === 'gai') { if (m.ex > 0) this.motion([6, 2, 3], 'lp,mp'); }
    else if (!KF.kokuuType(m.kind) || m.ex > 0) this.motion([6, 2, 3], KF.kokuuType(m.kind) ? 'lp,mp' : 'hp');
  }

  if (!this.q.length && m.actionable()) {
    this.cool--;
    if (this.cool <= 0) {
      var planned = this.planOn() && s.state !== 'down' && s.state !== 'getup' && (this.planJob || this.planStart());
      if (!planned) this.decide(s, dist);
      this.cool = planned ? KF.AI_PLAN[this.level].every : L.think + Math.floor(this.rnd() * L.think);
    }
  }

  // 出力
  var cmd = this.q[0];
  var out = { x: 0, y: 0, held: {} };
  if (cmd) {
    var d = cmd.d;
    var rx = ((d - 1) % 3) - 1, ry = d >= 7 ? -1 : (d <= 3 ? 1 : 0);
    out.x = rx * m.facing; out.y = ry;
    if (cmd.b) cmd.b.split(',').forEach(function (bt) { if (bt) out.held[bt] = true; });
    cmd.n--;
    if (cmd.n <= 0) this.q.shift();
  } else if (this.hold) {
    out.x = this.hold.x * m.facing; out.y = this.hold.y;
  }
  this.out = out;
};

KF.AI.prototype.pick = function (arr) { return arr[Math.floor(this.rnd() * arr.length)]; };

KF.AI.prototype.threat = function (s, dist) {
  var m = this.me();
  if (s.air && dist < 200 && ((s.x - m.x) * (s.vx || 0) < 0 || dist < 90) && s.vy > -6) return { kind: 'air', high: true };
  if (s.state === 'attack' && s.ph !== 'r' && dist < 190) {
    return { kind: 'atk', low: s.mv && s.mv.lv === 'l', high: s.mv && s.mv.lv === 'o' };
  }
  for (var i = 0; i < s.projs.length; i++) {
    var p = s.projs[i], dd = (m.x - p.x) * Math.sign(p.vx || 1);
    if (p.kind !== 'ball' || (dd > -10 && dd < 200)) return { kind: 'proj', d: dd };
  }
  if (s.state === 'rush' && dist < 200) return { kind: 'atk' };
  return null;
};

KF.AI.prototype.antiAir = function (dist) {
  var m = this.me(), L = this.L;
  if (m.kind === 'shuuen' && this.rnd() < 0.4) { this.push(4, 'hp', 2); return; }
  if (m.D.base === 'gai' && this.rnd() < 0.45) { this.push(2, 'hp', 1); return; }   // 変身キャラ男：しゃがみ強P（大盾は空中の攻撃に無敵）
  if (L.combo >= 2 && this.rnd() < 0.7) this.motion([6, 2, 3], dist < 90 ? 'hp' : 'mp');
  else this.push(2, 'hp', 1);
};

KF.AI.prototype.punish = function (dist, s) {
  if (this.me().D.base === 'gai') { this.punishGai(dist, s); return; }
  var m = this.me(), L = this.L, K = KF.kokuuType(m.kind);
  this.clear();
  var bars = Math.floor(m.sup / 1000);
  if (K) {
    if (bars >= 3 && L.superUse > 0.8 && this.rnd() < 0.6) { this.starter('hp', [[2, 3, 6, 2, 3, 6], 'hk']); return; }
    if (bars >= 2 && L.superUse > 0.8 && this.rnd() < 0.6) { this.starter('hp', [[2, 1, 4, 2, 1, 4], 'hp']); return; }
    if (bars >= 1 && L.superUse > 0.5 && this.rnd() < 0.4) { this.starter('hp', [[2, 3, 6, 2, 3, 6], 'hp']); return; }
    if (L.combo >= 3 && m.rush >= 3000 && this.rnd() < L.rush) { this.rushRoute(); return; }
    if (L.combo >= 3) { this.starter('hp', [[2, 1, 4], 'mk']); this.jug = { until: this.b.frameNo + 90 }; return; }   // 強P ＞ 中旋風脚 → 昇穿
    this.starter('hp', L.combo >= 2 ? [[6, 2, 3], 'hp'] : null);
  } else {
    if (bars >= 3 && L.superUse > 0.8 && this.rnd() < 0.5) { this.starter('hp', [[2, 1, 4, 2, 1, 4], 'hp']); return; }
    if (bars >= 2 && dist < 90 && L.superUse > 0.8 && this.rnd() < 0.6) { this.motion([2, 3, 6, 2, 3, 6], 'hk'); return; }
    if (dist < 75 && this.rnd() < 0.4) { this.motion([6, 3, 2, 1, 4], 'hp'); return; }
    this.starter('hp', L.combo >= 2 ? [[2, 1, 4], 'hk'] : null);
  }
};

// 起点技 → 当たったら続き（キャンセル）
KF.AI.prototype.starter = function (btn, cancel, crouch, confirm) {
  this.push(crouch ? 2 : 5, btn, 2);
  if (cancel) {
    var next = [];
    var seq = cancel[0];
    for (var i = 0; i < seq.length; i++) next.push({ d: seq[i], b: i === seq.length - 1 ? cancel[1] : '', n: i === seq.length - 1 ? 2 : 1 });
    this.combo = { next: next, confirm: !!confirm, done: false, onBlockToo: !confirm };
  }
};

// 格ゲーの基本コンボ（弱の連打キャンセル＞必殺技／ターゲットコンボ＞必殺技）。難易度で使う段数が変わる
KF.AI.prototype.chainCombo = function (light) {
  var m = this.me(), L = this.L, K = KF.kokuuType(m.kind);
  var mot = function (seq, btn) { return seq.map(function (x, i, arr) { return { d: x, b: i === arr.length - 1 ? btn : '', n: i === arr.length - 1 ? 2 : 1 }; }); };
  var bars = Math.floor(m.sup / 1000);
  var steps, first;
  if (light) {   // しゃがみ弱K ＞ しゃがみ弱P ＞ 弱旋風脚 → 昇穿（うまいCPUほど浮かせて追撃、そうでなければスライディングで締める）
    first = { d: 2, b: 'lk' };
    var lfin = K ? (L.combo >= 3 ? mot([2, 1, 4], 'lk') : mot([2, 3, 6], 'lk')) : mot([2, 1, 4], 'lk');   // 旋風脚は↓↙←＋K、迅閃脚は↓↘→＋K
    steps = [[{ d: 2, b: 'lp', n: 4 }], lfin];
    if (K && L.combo >= 3) this.jug = { until: this.b.frameNo + 120 };
  } else {       // ターゲットコンボ ＞ 強旋風脚 → 昇穿（ゲージがあれば超必殺）
    first = { d: 5, b: K ? 'mp' : 'mk' };
    var fin = K ? mot([2, 1, 4], 'mk') : mot([2, 1, 4], 'hk');
    if (bars >= (K ? 2 : 1) && L.superUse > 0.8 && this.rnd() < 0.4) fin = K ? mot([2, 1, 4, 2, 1, 4], 'hp') : mot([2, 3, 6, 2, 3, 6], 'hp');
    steps = [[{ d: 5, b: 'hp', n: 2 }], fin];
    if (K) this.jug = { until: this.b.frameNo + 120 };
  }
  var n = Math.max(0, L.combo - 1);
  this.plan = steps.slice(0, n);
  if (this.plan.length) this.plan[0].blockOk = true;
  this.planLast = null;
  this.push(first.d, first.b, 2);
};

// その場からのラッシュ：パリィを押して、押したまま →→
KF.AI.prototype.parryRush = function () { this.push(5, 'rush', 2); this.push(6, 'rush', 1); this.push(5, 'rush', 1); this.push(6, 'rush', 1); this.push(6, '', 9); };

KF.AI.prototype.rushRoute = function () {
  var m = this.me(), K = KF.kokuuType(m.kind);
  var next = [{ d: 5, b: 'rush', n: 1 }, { d: 6, b: '', n: 8 }, { d: 5, b: 'hp', n: 2 }];
  this.push(5, 'mp', 2);
  this.combo = { next: next, confirm: true, done: false };
  var self = this;
  // ラッシュ後の強Pが当たったら必殺技へ
  this.after = K ? [[2, 1, 4], 'mk'] : [[2, 1, 4], 'hk'];
  if (K) this.jug = { until: this.b.frameNo + 150 };
};


// ==========================================================================================
//  先読みで立ち回る（HARD / EXPERT）
//  ・相手の様子は反応時間ぶん遅れて見える：その時点の状態から、自分が入れた入力だけで「今」を予想する
//  ・候補の行動（歩く・下がる・ガード・牽制・波動・飛ぶ・昇穿・投げ・ダッシュ・パリィ）を、
//    相手の動き方いくつか（何もしない・ガード・前に歩く・しゃがみ中K・前ジャンプ・昇穿）と組み合わせて
//    実際のゲームの計算で数十フレーム先まで進め、ダメージ・ダウン・有利不利・間合い・画面端で点数をつけて選ぶ
// ==========================================================================================
KF.AI_PLAN = { HARD: { horizon: 26, every: 8, noise: 70, models: 4, per: 16 }, EXPERT: { horizon: 28, every: 4, noise: 25, models: 5, per: 30 } };
KF.AI.prototype.planOn = function () { return !!KF.AI_PLAN[this.level] && !!KF.cloneBattle && KF.kokuuType(this.me().kind); };
function aiIn(dx, dy, held, prev) {
  var pressed = {}; for (var k in held) if (held[k] && !(prev && prev[k])) pressed[k] = true;
  return { x: dx, y: dy, held: held, pressed: pressed };
}
// 毎フレーム、今の状態を写して覚えておく（反応時間ぶん前の状態から先読みするため）
KF.AI.prototype.remember = function () {
  if (!this.planOn()) return;
  var b = this.b, ev = b.events, fx = b.fx;
  b.events = []; b.fx = [];
  var c = KF.cloneBattle(b);
  b.events = ev; b.fx = fx;
  this.ring = this.ring || [];
  this.ring.push({ f: b.frameNo, b: c });
  if (this.ring.length > 40) this.ring.shift();
};
// 反応時間ぶん前の状態から、自分の入力だけを足して「今」を予想する（相手は最後に見えた入力のまま）
KF.AI.prototype.believedNow = function () {
  var R = this.L.react, b = this.b, ring = this.ring || [];
  var i = ring.length - 1 - R; if (i < 0) return null;
  var base = KF.cloneBattle(ring[i].b), me = this.side, f0 = ring[i].f;
  var myHist = this.me().buf.hist, oHist = this.me().opp.buf.hist;
  var steps = b.frameNo - f0; if (steps < 0 || steps > myHist.length) return null;
  var oLast = oHist[oHist.length - 1 - steps] || null;   // 反応時間ぶん前に見えていた相手の入力
  for (var k = 0; k < steps; k++) {
    var h = myHist[myHist.length - steps + k], fm = base.p[me], fo = base.p[1 - me];
    var mine = h ? { x: (((h.dir - 1) % 3) - 1) * fm.facing, y: h.dir >= 7 ? -1 : h.dir <= 3 ? 1 : 0, held: h.h || {}, pressed: h.p || {} } : aiIn(0, 0, {});
    var theirs = oLast ? { x: (((oLast.dir - 1) % 3) - 1) * fo.facing, y: oLast.dir >= 7 ? -1 : oLast.dir <= 3 ? 1 : 0, held: oLast.h || {}, pressed: {} } : aiIn(0, 0, {});
    var inp = [null, null]; inp[me] = mine; inp[1 - me] = theirs;
    base.events.length = 0; base.fx.length = 0; base.step(inp);
  }
  return base;
};
// 候補の行動：前後・上下は「相手の方向が6」の向き。f(t) がそのフレームの [方向, ボタン]
KF.AI.prototype.planCandidates = function (m) {
  var C = [], self = this;
  var seq = function (name, arr, then, setup) { C.push({ name: name, arr: arr, then: then || 4, setup: setup }); };
  var hold = function (d, n) { var a = []; for (var i = 0; i < n; i++) a.push([d, '']); return a; };
  var mot = function (dirs, btn) { return dirs.map(function (d, i) { return [d, i === dirs.length - 1 ? btn : '']; }); };
  seq('walkF8', hold(6, 8), 5); seq('walkF16', hold(6, 16), 5);
  seq('walkB8', hold(4, 8)); seq('walkB16', hold(4, 16));
  seq('guard', hold(4, 14)); seq('cguard', hold(1, 14), 1);
  seq('2mk', [[2, 'mk'], [2, 'mk']], 1, 'mk'); seq('5mk', [[5, 'mk'], [5, 'mk']], 4); seq('5hk', [[5, 'hk'], [5, 'hk']], 4);
  seq('2hk', [[2, 'hk'], [2, 'hk']], 1); seq('5mp', [[5, 'mp'], [5, 'mp']], 4, 'mp'); seq('2lk', [[2, 'lk'], [2, 'lk']], 1, 'lk');
  seq('fireL', mot([2, 3, 6], 'lp')); seq('fireH', mot([2, 3, 6], 'hp'));
  seq('jumpHK', hold(9, 1).concat(hold(5, 13), [[5, 'hk'], [5, 'hk']]), 5);
  seq('jumpHK2', hold(9, 1).concat(hold(5, 17), [[5, 'hk'], [5, 'hk']]), 5);
  seq('dp', mot([6, 2, 3], 'hp'));
  seq('throw', [[5, 'lp,lk'], [5, 'lp,lk']], 5);
  seq('dash', [[6, ''], [5, ''], [6, ''], [6, '']], 5);
  if (m.rush >= KF.CONST.PARRY_COST + 1000) seq('parry', hold(5, 1).map(function () { return [5, 'rush']; }).concat(hold(5, 10).map(function () { return [5, 'rush']; })), 4);
  return C;
};
// 相手の動き方の見本（相手から見た前後）
// 相手の動き方の見本（相手から見た前後）。w は覚える前の起こりやすさ
KF.AI_OPP_MODELS = [
  { name: 'idle', w: 0.22, f: function () { return [5, '']; } },
  { name: 'block', w: 0.18, f: function () { return [4, '']; } },
  { name: 'walk', w: 0.16, f: function () { return [6, '']; } },
  { name: 'poke', w: 0.15, f: function (t) { return t >= 3 && t < 5 ? [2, 'mk'] : [2, '']; } },
  { name: 'jump', w: 0.11, f: function (t) { return t < 2 ? [9, ''] : t >= 15 && t < 17 ? [5, 'hk'] : [5, '']; } },
  { name: 'dp', w: 0.08, f: function (t) { return t === 3 ? [6, ''] : t === 4 ? [2, ''] : t === 5 || t === 6 ? [3, 'hp'] : [5, '']; } },
  { name: 'fire', w: 0.06, f: function (t) { return t === 3 ? [2, ''] : t === 4 ? [3, ''] : t === 5 || t === 6 ? [6, 'mp'] : [5, '']; } },
  { name: 'throw', w: 0.04, f: function (t) { return t < 3 ? [6, ''] : t === 3 || t === 4 ? [5, 'lp,lk'] : [5, '']; } },
];
// 覚えたクセで重みを決め、起こりやすい順に n 通り使う（間合いごと）
KF.AI.prototype.oppModels = function (n, dist) {
  var ctx = this.learnCtx(dist, 'n'), cnt = this.learn && this.learn[ctx], PRIOR = 6;
  var M = KF.AI_OPP_MODELS.map(function (m) {
    var c = cnt ? (cnt[m.name] || 0) : 0, tot = cnt ? cnt._t || 0 : 0;
    return { name: m.name, f: m.f, w: (m.w * PRIOR + c) / (PRIOR + tot) };
  });
  M.sort(function (a, b) { return b.w - a.w; });
  return M.slice(0, n);
};
// ---- 相手のクセを覚える：間合い（近・中・遠）× 状況（立ち回り n／起き上がり w）ごとに、相手がやった行動を数える
KF.AI.prototype.learnCtx = function (dist, sit) { return sit + (dist < 110 ? 'N' : dist < 210 ? 'M' : 'F'); };
KF.AI.prototype.learnLoad = function () {
  var o = this.me().opp; this.learnKey = 'kf_ai_learn_' + o.kind;
  try { this.learn = JSON.parse(localStorage.getItem(this.learnKey) || 'null') || {}; } catch (e) { this.learn = {}; }
};
KF.AI.prototype.learnSave = function () { try { if (this.learnKey) localStorage.setItem(this.learnKey, JSON.stringify(this.learn)); } catch (e) { } };
KF.AI.prototype.learnAdd = function (ctx, what) {
  var t = this.learn[ctx] || (this.learn[ctx] = { _t: 0 });
  // 古いことは少しずつ忘れる（最近のクセほど強く効く）
  if (t._t > 80) { for (var k in t) t[k] *= 0.97; }
  t[what] = (t[what] || 0) + 1; t._t += 1;
};
KF.AI.prototype.learnWatch = function () {
  if (!this.learn) this.learnLoad();
  var m = this.me(), o = m.opp, b = this.b, dist = Math.abs(o.x - m.x);
  var st = this.lw || (this.lw = { ser: o.moveSerial || 0, t: 0, prevState: o.state });
  // 起き上がりに何をしたか（起き上がって最初の行動）
  if ((st.prevState === 'getup') && o.state !== 'getup') st.wake = b.frameNo;
  var sit = st.wake && b.frameNo - st.wake < 20 ? 'w' : 'n';
  var ctx = this.learnCtx(dist, sit), what = null;
  if ((o.moveSerial || 0) !== st.ser && o.state === 'attack') {   // 技を出した
    var id = o.moveId || '';
    what = /^dp/.test(id) ? 'dp' : /^fire/.test(id) ? 'fire' : id === 'throw' ? 'throw' : o.air || /^j_/.test(id) ? 'jump' : 'poke';
    st.ser = o.moveSerial;
  } else if (o.state === 'prejump' && st.prevState !== 'prejump') what = 'jump';
  else if (++st.t >= 8 && o.actionable() && sit === 'n') {   // 何もしていないときの様子（8Fごと）
    st.t = 0;
    var bx = o.buf.cur ? o.buf.cur() : null, dir = bx ? bx.dir : 5;
    what = dir === 4 || dir === 1 || o.state === 'walk_b' ? 'block' : dir === 6 || o.state === 'walk_f' ? 'walk' : 'idle';
  }
  if (what) { this.learnAdd(ctx, what); if (sit === 'w') st.wake = 0; }
  st.prevState = o.state;
  if (b.frameNo % 600 === 0) this.learnSave();
};
function dirIn(d, btn, facing, prevHeld) {
  var rx = ((d - 1) % 3) - 1, ry = d >= 7 ? -1 : (d <= 3 ? 1 : 0), held = {};
  if (btn) btn.split(',').forEach(function (k) { if (k) held[k] = true; });
  return aiIn(rx * facing, ry, held, prevHeld);
}
// 1つの候補 × 1つの相手の動き方 を進めて点数をつける
KF.AI.prototype.planScore = function (now, cand, model, H) {
  var b = KF.cloneBattle(now), me = this.side, m = b.p[me], o = b.p[1 - me];
  var hp0 = m.hp, ohp0 = o.hp, pm = {}, po = {}, hit = false, gotHit = false;
  for (var t = 0; t < H; t++) {
    var mine = t < cand.arr.length ? cand.arr[t] : [cand.then === 1 ? 1 : 4, ''];
    // 自分の技が当たったら、そのあとはガードを固めずに次の行動に移れる前提（コンボは別の処理で続ける）
    var a = dirIn(mine[0], mine[1], m.facing, pm), z = model.f(t), c = dirIn(z[0], z[1], o.facing, po);
    pm = a.held; po = c.held;
    var inp = [null, null]; inp[me] = a; inp[1 - me] = c;
    b.events.length = 0; b.fx.length = 0; b.step(inp);
    for (var i = 0; i < b.events.length; i++) { var e = b.events[i]; if (e.type === 'hit') { if (e.side === me) hit = true; else gotHit = true; } }
    if (b.phase !== 'fight') break;
  }
  var dealt = ohp0 - o.hp, taken = hp0 - m.hp;
  var sc = dealt * (hit && cand.setup ? 1.6 : 1.0) - taken * 1.15;   // 牽制が当たれば必殺技につなげられる分を足す
  var down = function (f) { return f.state === 'down' || f.state === 'launch' || f.state === 'getup'; };
  if (down(o)) sc += 250; if (down(m)) sc -= 300;
  var busy = function (f) { return /hitstun|blockstun|attack|land|thrown|launch|down|getup/.test(f.state); };
  if (m.actionable() && busy(o)) sc += 60; if (o.actionable() && busy(m)) sc -= (m.state === 'attack' ? 120 : 60);
  var dist = Math.abs(m.x - o.x), pr = m.D.prefRange || [110, 190], mid = (pr[0] + pr[1]) / 2;
  sc -= Math.max(0, Math.abs(dist - mid) - 25) * 1.2;
  var lim = b.limits ? b.limits() : [KF.CONST.WALL, KF.CONST.WORLD_W - KF.CONST.WALL];
  var myWall = Math.min(m.x - lim[0], lim[1] - m.x), oWall = Math.min(o.x - lim[0], lim[1] - o.x);
  if (myWall < 70) sc -= (70 - myWall) * 3; if (oWall < 70) sc += (70 - oWall) * 1.5;
  return sc;
};
// 先読みは1フレームで全部やると重いので、数フレームに分けて計算する（1フレームに per 組ずつ）
KF.AI.prototype.planStart = function () {
  var P = KF.AI_PLAN[this.level]; if (!P) return false;
  var now = this.believedNow(); if (!now) return false;
  var me = now.p[this.side]; if (!me.actionable()) return false;
  var dist = Math.abs(me.x - now.p[1 - this.side].x);
  var cands = this.planCandidates(me).filter(function (c) {   // 届かない・意味のない候補は先に外す
    if (dist > 160 && /^(throw|2lk|5mp)$/.test(c.name)) return false;
    if (dist > 260 && /^(2mk|5mk|5hk|2hk|dp)$/.test(c.name)) return false;
    if (dist < 70 && /^(jumpHK2|dash)$/.test(c.name)) return false;
    return true;
  });
  this.hold = { x: -1, y: 0 };   // 考えている間はガードを固めておく
  this.planJob = { now: now, cands: cands, models: this.oppModels(P.models, dist), i: 0, j: 0, acc: cands.map(function () { return { tot: 0, w: 0, worst: 1e9 }; }) };
  return true;
};
KF.AI.prototype.planStep = function () {
  var P = KF.AI_PLAN[this.level], J = this.planJob; if (!J) return;
  for (var n = 0; n < P.per && J.i < J.cands.length; n++) {
    var mo = J.models[J.j], v = this.planScore(J.now, J.cands[J.i], mo, P.horizon), a = J.acc[J.i];
    a.tot += v * mo.w; a.w += mo.w; a.worst = Math.min(a.worst, v);
    if (++J.j >= J.models.length) { J.j = 0; J.i++; }
  }
  if (J.i < J.cands.length) return;
  this.planJob = null; this.hold = null;
  if (this.q.length || !this.me().actionable()) return;   // 計算中に状況が変わった（攻撃された・コンボ中など）
  var best = null, self = this;
  for (var i = 0; i < J.cands.length; i++) {
    var a = J.acc[i], score = a.tot / a.w * 0.75 + a.worst * 0.25 + (this.rnd() - 0.5) * P.noise;
    if (J.cands[i].name === this.lastPlan) score -= 35;   // 同じ行動ばかりにならないように
    if (!best || score > best.score) best = { c: J.cands[i], score: score };
  }
  if (best) this.planCommit(best.c);
};
KF.AI.prototype.planCommit = function (c) {
  var self = this;
  this.clear(); this.lastPlan = c.name;
  // 牽制は当たったら必殺技につなぐ（当たったのを見てから）
  if (c.setup === 'mk') { this.starter('mk', [[2, 3, 6], 'lp'], true, true); return; }
  if (c.setup === 'lk') { this.starter('lk', [[2, 1, 4], 'lk'], true, true); this.jug = { until: this.b.frameNo + 100 }; return; }
  if (c.setup === 'mp') { this.starter('mp', null); this.plan = [[{ d: 5, b: 'hp', n: 2 }], [{ d: 2, b: '', n: 1 }, { d: 1, b: '', n: 1 }, { d: 4, b: 'mk', n: 2 }]]; this.planLast = null; this.jug = { until: this.b.frameNo + 120 }; return; }
  c.arr.forEach(function (x) { self.push(x[0], x[1], 1); });
  if (c.name === 'jumpHK' || c.name === 'jumpHK2') { this.plan = [[{ d: 5, b: 'mp', n: 2 }], [{ d: 5, b: 'hp', n: 2 }]]; this.planLast = null; }
};
KF.AI.prototype.decide = function (s, dist) {
  if (this.me().D.base === 'gai') { this.decideGai(s, dist); return; }
  var m = this.me(), L = this.L, K = KF.kokuuType(m.kind), r = this.rnd();
  var pr = m.D.prefRange;
  var bars = Math.floor(m.sup / 1000);
  // 後続入力（ラッシュルートの続き）
  if (this.after && m.state === 'attack') { }
  if (s.state === 'down' || s.state === 'getup') {
    // 起き攻め：近づいて重ねる / 2Pは投げ
    if (dist > 70) { this.push(6, '', 8); return; }
    // 起き上がりに昇穿をよく出す相手には、重ねずにガードして、空振りを反撃する（覚えたクセ）
    var wk = this.learn && this.learn[this.learnCtx(dist, 'w')];
    if (wk && wk._t >= 3 && (wk.dp || 0) / wk._t > 0.3 && r < 0.8) { this.push(1, '', 30); return; }
    if (wk && wk._t >= 3 && ((wk.block || 0) + (wk.idle || 0)) / wk._t > 0.6 && r < 0.5) { this.push(5, 'lp,lk', 1); return; }   // 固まる相手には投げ
    if (!K && r < 0.3 * L.spacing) { this.push(5, 'lp,lk', 1); return; }
    this.starter('lk', L.combo >= 2 ? (K ? [[2, 1, 4], 'lk'] : [[2, 1, 4], 'lk']) : null, true, true);
    if (K && L.combo >= 2) this.jug = { until: this.b.frameNo + 100 };
    return;
  }
  // 遠距離
  if (dist > pr[1]) {
    if (K && r < L.fireball && !this.b.projs.some(function (p) { return p.owner === m; })) {
      var bt = this.pick(['lp', 'mp', 'hp']);
      if (bars >= 1 && L.superUse > 0.7 && r < 0.05) { this.motion([2, 3, 6, 2, 3, 6], 'hp'); return; }
      this.motion([2, 3, 6], bt); return;
    }
    if (!K && r < L.fireball * 0.4) { this.motion([2, 3, 6], this.pick(['lp', 'mp'])); return; }
    if (r < L.jump && dist < 260) { this.push(9, '', 14); this.push(9, this.pick(['hk', 'hp']), 1); return; }
    if (m.rush >= 2000 && r < L.rush * 0.6 && dist < 300) { this.parryRush(); this.push(5, K ? 'mk' : 'hp', 2); return; }
    this.push(6, '', 6 + Math.floor(this.rnd() * 14));
    return;
  }
  // 追加技の使い分け
  if (L.combo >= 2 && r < 0.12) {
    if (K) {
      if (dist < 90 && r < 0.05) { this.push(6, 'mp', 2); return; }            // 中段で崩す
      if (dist < 100 && r < 0.08) { this.starter('hk', [[2, 3, 6], 'lp'], false, true); this.q[0].d = 4; return; } // 旋踵（ガードさせて有利）＞ 虚環弾
      if (dist < 120) { this.motion([2, 1, 4], this.pick(['lk', 'mk'])); this.jug = { until: this.b.frameNo + 100 }; return; } // 旋風脚 → 浮いたら追撃
    } else {
      if (dist < 90 && r < 0.05) { this.push(6, 'mk', 2); return; }            // 中段の踏みつけ
      if (dist > 120) { this.motion([2, 3, 6], this.pick(['lk', 'mk'])); return; } // 地裂脚（下段の飛び道具）
      if (dist < 100) {                                                         // 冥爪連撃を当たったら派生
        this.motion([2, 1, 4], 'lp');
        var mo = function (b) { return [{ d: 2, b: '', n: 1 }, { d: 1, b: '', n: 1 }, { d: 4, b: b, n: 2 }]; };
        this.plan = [mo('lp'), mo('lp')]; this.planLast = null; return;
      }
    }
  }
  // 適正距離（差し合い）
  if (dist > pr[0]) {
    if (r < 0.35) {
      if (K) { var tat = L.combo >= 3 && this.rnd() < 0.5; this.starter('mk', L.combo >= 2 ? (tat ? [[2, 1, 4], 'mk'] : [[2, 3, 6], 'lp']) : null, true, L.combo < 3); if (tat) this.jug = { until: this.b.frameNo + 100 }; }
      else this.starter('mk', L.combo >= 2 ? [[2, 1, 4], 'lk'] : null, true, L.combo < 3);
      return;
    }
    if (r < 0.5) { this.push(5, this.pick(K ? ['mk', 'mp', 'hk'] : ['mk', 'mp']), 2); return; }
    if (r < 0.62 && !K) { this.motion([2, 1, 4], this.pick(['lk', 'mk'])); return; }
    if (r < 0.62 && K && dist > 150) { this.motion([2, 3, 6], 'lp'); return; }
    if (L.spacing > this.rnd()) { this.push(this.rnd() < 0.5 ? 6 : 4, '', 8 + Math.floor(this.rnd() * 10)); return; }
    this.push(6, '', 10); return;
  }
  // 近距離
  if (r < 0.3 && L.combo >= 2) { this.chainCombo(this.rnd() < 0.5); return; }
  if (r < 0.25) {
    if (K) { this.starter('lk', L.combo >= 2 ? [[2, 1, 4], 'lk'] : null, true, true); if (L.combo >= 2) this.jug = { until: this.b.frameNo + 100 }; }
    else this.starter('lk', L.combo >= 2 ? [[2, 1, 4], 'lk'] : null, true, true);
    return;
  }
  if (r < 0.4) { this.push(5, 'lp,lk', 1); return; }
  if (!K && r < 0.55 && dist < 80) { this.motion([6, 3, 2, 1, 4], this.pick(['lp', 'mp', 'hp'])); return; }
  if (r < 0.6 && L.combo >= 3 && m.rush >= 3000) { this.rushRoute(); return; }
  if (r < 0.7) { this.push(4, '', 10); return; }
  if (r < 0.85) { this.push(5, this.pick(['lp', 'mp', 'hp', 'lk']), 2); return; }
  this.push(1, '', 12);
};

// ---------------------------------------------------------- 変身キャラ男
//  ハンマー形態：中〜遠距離で大振りと地割れ。近づかれたら大盾に変身することがある
//  大盾形態：近距離で押し込みと当て身。離れたらハンマーに変身することがある
//  コンボは試験でつながると確かめたものだけを使う
KF.AI.prototype.mot = function (seq, btn) { return seq.map(function (x, i, arr) { return { d: x, b: i === arr.length - 1 ? btn : '', n: i === arr.length - 1 ? 2 : 1 }; }); };
KF.AI.prototype.changeForm = function () { this.push(2, '', 2); this.push(5, '', 2); this.push(2, 'lp', 2); };
KF.AI.prototype.decideGai = function (s, dist) {
  var m = this.me(), L = this.L, H = m.kind === 'gai_h', r = this.rnd(), bars = Math.floor(m.sup / 1000);
  var pr = m.D.prefRange;
  if (s.state === 'down' || s.state === 'getup') {
    if (dist > 80) { this.push(6, '', 8); return; }
    if (r < 0.3 * L.spacing) { this.push(5, 'lp,lk', 1); return; }
    this.starter('lk', L.combo >= 2 ? [[2, 2, 5, 5, 2], 'lp'] : null, true, true);   // しゃがみ弱K ＞ 変身
    if (L.combo >= 2) this.after2 = H ? [[2, 3, 6], 'lp'] : [[2, 1, 4], 'lp'];
    return;
  }
  // 形態の使い分け
  if (L.combo >= 2) {
    if (H && dist < 90 && r < 0.18) { this.changeForm(); return; }          // 近い：大盾へ
    if (!H && dist > 190 && r < 0.3) { this.changeForm(); return; }         // 遠い：ハンマーへ
    // 変身キャンセルのコンボ：中P～強P ＞ 必殺技 ＞ 変身 ＞ もう一方の形態の必殺技
    if (dist < 110 && L.combo >= 3 && r > 0.8) {
      this.push(5, 'mp', 2);
      this.plan = [[{ d: 5, b: 'hp', n: 2 }], H ? this.mot([2, 3, 6], 'hp') : this.mot([2, 3, 6], 'hp'), this.mot([5, 2, 2, 5, 5, 2], 'lp').concat([{ d: 5, b: '', n: 18 }], H ? this.mot([2, 1, 4], 'hp') : this.mot([2, 1, 4], 'hp'))];   // ハンマー：地割れ＞変身＞光盾投げ／大盾：盾突進＞変身＞大回転
      this.plan[0].blockOk = true; this.planLast = null;
      return;
    }
    // 形態をまたぐコンボ：中P ＞ 変身 ＞ 必殺技（変身キャンセルで相手ののけぞりが延びる）
    if (dist < 110 && L.combo >= 3 && r > 0.85) {
      this.starter('mp', [[2, 2, 5, 5, 2], 'lp'], false, true);
      this.after2 = H ? [[2, 3, 6], 'hp'] : [[2, 1, 4], 'lp'];   // ハンマー→大盾は盾突進、大盾→ハンマーは大回転
      return;
    }
  }
  if (dist > pr[1]) {
    if (H && r < L.fireball * 1.2 && !this.b.projs.some(function (p) { return p.owner === m; })) { this.motion([2, 3, 6], this.pick(['lp', 'mp', 'hp'])); return; }
    if (!H && r < 0.15 && dist < 230) { this.motion([2, 3, 6], 'mp'); return; }   // 盾突進で突っ込む（飛び道具を抜ける）
    if (!H && r < 0.15 + L.fireball && !this.b.projs.some(function (p) { return p.owner === m; })) { this.motion([2, 1, 4], this.pick(['lp', 'mp', 'hp'])); return; }   // 光盾投げ
    if (r < L.jump && dist < 260) {
      this.push(9, '', 12);
      if (L.combo >= 2 && this.rnd() < 0.4) { this.motion([2, 3, 6], H ? 'lp' : 'lk'); return; }   // 空中叩きつけ／盾落下
      this.push(9, '', 2); this.push(9, 'hp', 1); return;
    }
    if (m.rush >= 2000 && r < L.rush * 0.6 && dist < 300) { this.parryRush(); this.push(5, 'hp', 2); return; }
    this.push(6, '', 6 + Math.floor(this.rnd() * 14));
    return;
  }
  if (dist > pr[0]) {   // 差し合い
    if (H) {
      if (r < 0.3) { this.starter('mp', L.combo >= 2 ? [[2, 1, 4], 'lp'] : null, false, L.combo < 3); return; }   // 中P ＞ 大回転
      if (r < 0.45) { this.push(2, 'mk', 2); return; }
      if (r < 0.55) { this.push(5, 'hk', 2); return; }
      if (r < 0.62 && L.combo >= 2) { this.push(6, 'hp', 2); this.after2 = null; this.jug = { until: this.b.frameNo + 90 }; return; }   // 地響き（中段）→床跳ねに追撃
      if (r < 0.7 && L.combo >= 2) { this.motion([2, 3, 6], 'lk'); return; }   // 飛び叩き
      if (r < 0.78) { this.push(6, 'mk', 2); if (L.combo >= 2) this.after2 = [[2, 3, 6], 'hp']; return; }   // すくい打ち（下段）＞ 地割れ
      if (r < 0.84 && L.combo >= 2) { this.push(5, 'mk', 2); this.plan = [[{ d: 5, b: 'hk', n: 2 }], this.mot([6, 2, 3], 'hp')]; this.planLast = null; return; }   // 中K～強K ＞ かち上げ
    } else {
      if (r < 0.35) { this.starter('mp', L.combo >= 2 ? [[2, 3, 6], 'hp'] : null, true, L.combo < 3); return; }   // しゃがみ中P ＞ 盾突進
      if (r < 0.5) { this.push(5, this.pick(['mp', 'mk']), 2); return; }
      if (r < 0.58 && L.combo >= 2) { this.motion([2, 1, 4], 'lk'); return; }   // 盾構え（当て身）
      if (r < 0.66) { this.push(6, 'mk', 2); return; }   // 盾すべり（下段）
      if (r < 0.72 && L.combo >= 2) { this.push(5, 'mk', 2); this.plan = [[{ d: 5, b: 'hk', n: 2 }], this.mot([2, 3, 6], 'hp')]; this.planLast = null; return; }   // 中K～強K ＞ 盾突進
    }
    if (L.spacing > this.rnd()) { this.push(this.rnd() < 0.5 ? 6 : 4, '', 8 + Math.floor(this.rnd() * 10)); return; }
    this.push(6, '', 10); return;
  }
  // 近距離
  if (r < 0.3 && L.combo >= 2) {   // 中P ～ 強P ＞ 必殺技（ゲージがあれば超必殺）
    var fin = H ? [[2, 1, 4], 'lp'] : [[2, 3, 6], 'hp'];
    if (bars >= 1 && L.superUse > 0.8 && this.rnd() < 0.4) fin = [[2, 3, 6, 2, 3, 6], 'hp'];
    this.push(5, 'mp', 2);
    this.plan = L.combo >= 3 ? [[{ d: 5, b: 'hp', n: 2 }], this.mot(fin[0], fin[1])] : [[{ d: 5, b: 'hp', n: 2 }]];
    this.plan[0].blockOk = true; this.planLast = null;
    return;
  }
  if (r < 0.42) { this.starter('lk', L.combo >= 2 ? (H ? [[2, 1, 4], 'lp'] : [[2, 3, 6], 'lp']) : null, true, true); return; }
  if (r < 0.52) { this.push(5, 'lp,lk', 1); return; }
  if (!H && r < 0.6) { this.motion([2, 1, 4], 'lk'); return; }   // 盾構え
  if (H && r < 0.6 && L.combo >= 2) { this.motion([6, 3, 2, 1, 4], 'lp'); return; }   // 担ぎ叩き（コマンド投げ）
  if (r < 0.64) { this.push(4, 'hp', 2); if (!H && L.combo >= 2) this.after2 = [[2, 1, 4], 'hp']; return; }   // 槌突き／盾押し（＞ 光盾投げ）
  if (r < 0.66 && L.combo >= 3 && m.rush >= 3000) { this.push(5, 'mp', 2); this.combo = { next: [{ d: 5, b: 'rush', n: 1 }, { d: 6, b: '', n: 8 }, { d: 5, b: 'hp', n: 2 }], confirm: true, done: false }; this.after = H ? [[2, 1, 4], 'lp'] : [[2, 3, 6], 'hp']; return; }
  if (r < 0.75) { this.push(4, '', 10); return; }
  if (r < 0.88) { this.push(5, this.pick(['lp', 'mp', 'hp', 'lk']), 2); return; }
  this.push(1, '', 12);
};
KF.AI.prototype.punishGai = function (dist, s) {
  var m = this.me(), L = this.L, H = m.kind === 'gai_h', bars = Math.floor(m.sup / 1000);
  this.clear();
  if (bars >= 3 && L.superUse > 0.8 && this.rnd() < 0.5) { this.starter('hp', [[6, 2, 3], 'hp']); this.after3 = { su3: true }; return; }   // 強P ＞ かち上げ/跳ね上げ ＞ Lv3
  if (bars >= 1 && L.superUse > 0.5 && this.rnd() < 0.4) { this.push(5, 'mp', 2); this.plan = [[{ d: 5, b: 'hp', n: 2 }], this.mot([2, 3, 6, 2, 3, 6], 'hp')]; this.planLast = null; return; }
  if (L.combo >= 2) { this.starter('hp', H ? [[2, 1, 4], 'hp'] : [[6, 2, 3], 'hp']); return; }
  this.starter('hp', null);
};
