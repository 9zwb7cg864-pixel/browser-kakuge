// =====================================================================
//  格闘エンジン（描画に依存しない。Nodeでの自動テストにも使う）
//  60fps固定。発生/持続/硬直・ヒット/ガード硬直・硬直差・キャンセル・コンボ補正・
//  ヒットストップ・ノックバック・無敵・やられ判定/攻撃判定・投げ/投げ抜け・
//  ラッシュゲージ/必殺ゲージ・ラウンド制を扱う
// =====================================================================
'use strict';
var KF = window.KF || (window.KF = {});

(function () {
  var C = KF.CONST;

  function pick(v, i) { return Array.isArray(v) ? v[Math.min(i || 0, v.length - 1)] : v; }

  // ---------------------------------------------------------- 入力履歴照合
  KF.InputBuffer.prototype.match = function (seq, win, loose) {
    var H = this.hist, si = seq.length - 1, skip = loose ? 1 : 0;
    for (var j = H.length - 1; j >= Math.max(0, H.length - win) && si >= 0; j--) {
      var d = H[j].dir;
      if (d === seq[si]) si--;
      else if (skip > 0 && si > 0 && d === seq[si - 1]) { si -= 2; skip--; }
    }
    return si < 0;
  };
  // 簡易入力用の厳密な照合：win フレーム内の方向の移り変わりの最後が seq とぴったり一致するか
  KF.InputBuffer.prototype.matchStrict = function (seq, win) {
    var H = this.hist, tr = [];
    for (var j = H.length - 1; j >= Math.max(0, H.length - win); j--) {
      var d = H[j].dir;
      if (!tr.length || tr[tr.length - 1] !== d) tr.push(d);
      if (tr.length > seq.length) break;
    }
    if (tr.length < seq.length) return false;
    for (var i = 0; i < seq.length; i++) if (tr[i] !== seq[seq.length - 1 - i]) return false;
    return true;
  };
  // 昇竜コマンド（スト6と同じ決まり）：「前」→「下」→「前」がこの順に入っていれば成立
  //   最初の前：→↘↗ ／ 下：↓↙↘ ／ 最後の前：→↘（↗は不可）。同じ方向を押しっぱなしの間は1回と数える
  KF.InputBuffer.prototype.matchDP = function (win) {
    var H = this.hist, tr = [];
    for (var j = Math.max(0, H.length - win); j < H.length; j++) { var d = H[j].dir; if (!tr.length || tr[tr.length - 1] !== d) tr.push(d); }
    var F1 = [6, 3, 9], DN = [2, 1, 3], F2 = [6, 3];
    // 後ろから：最後の前 → その前の下 → さらにその前の前
    for (var k = tr.length - 1; k >= 2; k--) {
      if (F2.indexOf(tr[k]) < 0) continue;
      for (var m = k - 1; m >= 1; m--) {
        if (DN.indexOf(tr[m]) < 0) continue;
        for (var i = m - 1; i >= 0; i--) if (F1.indexOf(tr[i]) >= 0) return true;
      }
    }
    return false;
  };
  // 直近nフレーム以内にボタンが押されたか
  KF.InputBuffer.prototype.pressedWithin = function (btn, n) {
    var H = this.hist;
    for (var j = H.length - 1; j >= Math.max(0, H.length - n); j--) if (H[j].p[btn]) return true;
    return false;
  };
  KF.InputBuffer.prototype.cur = function () { return this.hist[this.hist.length - 1] || { dir: 5, p: {}, h: {} }; };

  // ---------------------------------------------------------- アニメ再生ユーティリティ
  function prepAnims(meta) {
    Object.keys(meta.anims).forEach(function (k) {
      var a = meta.anims[k];
      var tot = 0, firstA = -1, lastA = -1;
      a.frames.forEach(function (f, i) {
        f.start = tot; tot += f.d;
        if (f.ph === 'a') { if (firstA < 0) firstA = f.start; lastA = f.start + f.d - 1; }
        // 攻撃判定を手足の付け根まで伸ばす（密着で判定が相手の体を通り越して空振りしないように）
        if (f.hit && !f._ext) {
          f._ext = true;
          var fix = (KF.HIT_FIX || {})[String(a.file || '').split('_')[0] + ':' + k];
          f.hit.forEach(function (b) {
            if (fix) { var x1 = Math.max(b[0] + b[2], fix.x1 || 0), y1 = Math.max(b[1] + b[3], fix.y1 || -999); b[0] = Math.min(b[0], fix.x0 != null ? fix.x0 : b[0]); b[2] = x1 - b[0]; b[3] = y1 - b[1]; }
            if (b[0] > 6) { b[2] += b[0] - 6; b[0] = 6; }
          });
        }
      });
      a.total = tot; a.firstActive = firstA; a.lastActive = lastA; a.name = k;
    });
    return meta;
  }
  KF.prepAnims = prepAnims;

  // ---------------------------------------------------------- 戦闘員
  function Fighter(kind, side, animMeta) {
    this.kind = kind; this.side = side; this.D = KF.CHARS[kind]; this.A = animMeta.anims;
    this.buf = new KF.InputBuffer();
    this.reset(side === 0 ? 400 : 624);
  }
  KF.Fighter = Fighter;
  Fighter.prototype.reset = function (x) {
    this.x = x; this.y = C.GROUND; this.vx = 0; this.vy = 0; this.pushV = 0;
    this.facing = this.side === 0 ? 1 : -1;
    this.hp = this.D.hp; this.hpShown = this.hp; this.hpTrail = this.hp;
    this.rush = C.RUSH_MAX; this.rushCD = 0;
    if (this.sup === undefined) this.sup = 0;
    if (this.ex === undefined) this.ex = 0;
    this.state = 'idle'; this.t = 0; this.setAnim('idle');
    this.move = null; this.moveId = null; this.str = 0;
    this.hs = 0; this.stun = 0; this.inv = 0; this.thInv = 0; this.projInv = 0;
    this.air = false; this.juggle = 0; this.combo = 0; this.comboDmg = 0; this.scale = 1;
    this.rushLock = false; this.rushBonus = false; this.counterable = false;
    this.hitCount = 0; this.lastHitT = -99; this.connected = false; this.whiffed = false;
    this.pendingBtn = null; this.pendingT = 0;
    this.airAttackUsed = false; this.downT = 0; this.grabbed = null; this.thrower = null;
    this.flash = 0; this.afterimg = []; this.dmgPop = null; this.lastMoveInfo = null; this.koMarked = false;
    this.chain = 0; this.pendingRush = 0; this.carry = 0;
  };
  Fighter.prototype.setAnim = function (name, keep) {
    if (keep && this.anim === name) return;
    this.anim = name; this.aF = 0; this.aT = 0; this.aDone = false;
  };
  Fighter.prototype.animObj = function () { return this.A[this.anim]; };
  Fighter.prototype.frame = function () { var a = this.A[this.anim]; return a.frames[Math.min(this.aF, a.frames.length - 1)]; };
  Fighter.prototype.stepAnim = function () {
    var a = this.A[this.anim];
    this.aT++;
    if (this.aT >= a.frames[this.aF].d) {
      this.aT = 0; this.aF++;
      if (this.aF >= a.frames.length) {
        if (a.loop) this.aF = 0; else { this.aF = a.frames.length - 1; this.aDone = true; }
      }
    }
  };
  Fighter.prototype.animTime = function () { return this.frame().start + this.aT; };
  Fighter.prototype.remaining = function () { var a = this.A[this.anim]; return a.total - this.animTime() - 1; };
  Fighter.prototype.phase = function () { return this.frame().ph; };
  Fighter.prototype.grounded = function () { return !this.air; };
  Fighter.prototype.boxes = function (kind) {
    var f = this.frame(), src = kind === 'hit' ? f.hit : f.hurt, out = [];
    if (!src) return out;
    for (var i = 0; i < src.length; i++) {
      var b = src[i];
      var x = this.facing > 0 ? b[0] : -(b[0] + b[2]);
      out.push([this.x + x, this.y + b[1], b[2], b[3]]);
    }
    return out;
  };
  Fighter.prototype.joint = function (name) {
    var j = this.frame().j[name];
    return [this.x + j[0] * this.facing, this.y + j[1]];
  };
  Fighter.prototype.isCrouching = function () {
    return /^(crouch|crouch_in|cguard|hit_c)$/.test(this.anim) || (this.move && this.move.crouch);
  };
  Fighter.prototype.actionable = function () {
    return ['idle', 'walk_f', 'walk_b', 'crouch', 'guardpose'].indexOf(this.state) >= 0;
  };

  // ---------------------------------------------------------- 戦闘
  function Battle(opts) {
    this.opts = opts;
    this.meta = opts.meta; // {kokuu: animsMeta, shuuen: ...}
    this.p = [new Fighter(opts.p1, 0, this.meta[opts.p1]), new Fighter(opts.p2, 1, this.meta[opts.p2])];
    if (opts.p1 === opts.p2) { this.p[1].alt = true; this.p[1].color = KF.ALT_COLOR || '#ff5a3c'; }
    this.p[0].opp = this.p[1]; this.p[1].opp = this.p[0];
    this.wins = [0, 0]; this.round = 1; this.training = !!opts.training;
    this.events = []; this.fx = []; this.projs = []; this.frameNo = 0;
    this.camX = C.WORLD_W / 2; this.shake = 0;
    this.maxRounds = 3;
    this.startRound();
  }
  KF.Battle = Battle;

  Battle.prototype.emit = function (type, data) { this.events.push(Object.assign({ type: type, f: this.frameNo }, data || {})); };

  Battle.prototype.startRound = function () {
    var a = this.p[0], b = this.p[1];
    a.reset(C.WORLD_W / 2 - 110); b.reset(C.WORLD_W / 2 + 110);
    a.state = b.state = 'intro'; a.setAnim('intro'); b.setAnim('intro');
    this.timer = C.ROUND_TIME; this.timerSub = 0;
    this.phase = this.training ? 'fight' : 'intro'; this.phaseT = 0;
    if (this.training) { a.state = b.state = 'idle'; a.setAnim('idle'); b.setAnim('idle'); a.sup = b.sup = C.SUPER_MAX; a.ex = b.ex = C.EX_MAX; }
    this.freeze = 0; this.freezeBy = null; this.slow = 0; this.projs = []; this.fx = []; this.zoom = 0; this.bgFlash = 0;
    this.camX = C.WORLD_W / 2; this.result = null;
    this.emit('round', { n: this.round });
  };

  // 1フレーム進める。inputs = [inp1, inp2]
  Battle.prototype.step = function (inputs) {
    this.frameNo++;
    var self = this, P = this.p;
    for (var i = 0; i < 2; i++) P[i].buf.push(inputs[i], P[i].facing);

    if (this.phase === 'intro') {
      this.phaseT++;
      P.forEach(function (f) { f.stepAnim(); });
      if (this.phaseT === 50) this.emit('announce', { text: 'ROUND ' + this.round });
      if (this.phaseT === 110) this.emit('announce', { text: 'FIGHT', big: 1 });
      if (this.phaseT >= 120) { this.phase = 'fight'; P.forEach(function (f) { f.state = 'idle'; f.setAnim('idle'); }); }
      return;
    }
    if (this.phase === 'end') {
      this.phaseT++;
      this.updateFighters(true);
      this.updateFx();
      if (this.phaseT > 210) this.nextRound();
      return;
    }
    // 超必殺の暗転（両者停止）
    if (this.freeze > 0) {
      this.freeze--;
      this.updateFx();
      return;
    }
    if (this.slow > 0) { this.slow--; if (this.frameNo % 3) return; }

    this.updateFighters(false);
    this.updateProjs();
    this.collide();
    this.updateFx();
    this.separate();
    this.updateCamera();
    this.updateFacing();
    this.measureAdv();
    this.checkRound();
  };
  // 硬直差の計測（攻撃側と防御側がそれぞれ動けるようになったフレームの差）
  Battle.prototype.measureAdv = function () {
    var m = this.adv;
    if (!m) return;
    if (m.def.state === 'launch' || m.def.state === 'down') m.kd = true;
    if (m.tA == null && m.att.actionable()) m.tA = this.frameNo;
    if (m.tD == null && m.def.actionable()) m.tD = this.frameNo;
    if (m.tA != null && m.tD != null) { this.lastAdv = m.tD - m.tA; KF._lastAdv = m.kd ? 'ダウン' : this.lastAdv; this.emit('adv', { side: m.att.side, v: this.lastAdv, move: m.move, blocked: m.blocked }); this.adv = null; }
    else if (this.frameNo - m.f0 > 200) this.adv = null;
  };

  Battle.prototype.updateFighters = function (ending) {
    for (var i = 0; i < 2; i++) {
      var f = this.p[i];
      this.trackPending(f);
      if (f.hs > 0) {
        f.hs--;
        // ヒットストップ中もキャンセル入力は受け付ける
        if (!ending && f.state === 'attack' && f.connected && f.move && (f.move.cancel || f.move.tc)) { var cc = f.buf.cur(); this.tryCancel(f, cc, cc.dir); }
        else if (!ending && f.state === 'attack' && f.move && f.move.follow) this.tryFollow(f);
        continue;
      }
      if (!ending) this.think(f); else this.thinkEnding(f);
      this.physics(f);
      // ゲージ
      if (f.rushCD > 0) f.rushCD--;
      else if (f.rush < C.RUSH_MAX && f.state !== 'rush') f.rush = Math.min(C.RUSH_MAX, f.rush + (f.state === 'walk_f' ? C.RUSH_REGEN_FWD : C.RUSH_REGEN));
      if (f.inv > 0) f.inv--; if (f.thInv > 0) f.thInv--; if (f.projInv > 0) f.projInv--; if (f.aaInv > 0) f.aaInv--;
      if (f.flash > 0) f.flash--;
      // 体力表示の追従
      if (f.hpShown > f.hp) f.hpShown = Math.max(f.hp, f.hpShown - 120);
      var opp = f.opp;
      if (!(opp.state === 'attack' && opp.combo > 0) && f.combo === 0) f.hpTrail += (f.hp - f.hpTrail) * 0.06;
      if (f.hpTrail < f.hp) f.hpTrail = f.hp;
      if (this.training && f.combo === 0 && f.actionable() && f.hp < f.D.hp) { f.hp = f.D.hp; f.hpShown = f.hp; f.hpTrail = f.hp; }
      if (this.training) {
        f.sup = C.SUPER_MAX; f.ex = C.EX_MAX;
        // 当たらずに終わった（ガード・空振り）ときも、動ける状態が少し続いたらラッシュゲージを戻す
        if (f.actionable() && f.opp.combo === 0 && f.opp.actionable()) { f.trIdle = (f.trIdle || 0) + 1; if (f.trIdle > 40 && f.rush < C.RUSH_MAX) { f.rush = C.RUSH_MAX; f.rushCD = 0; } }
        else f.trIdle = 0;
      }
    }
  };

  Battle.prototype.thinkEnding = function (f) {
    if (f.state === 'ko') {
      f.t++; f.stepAnim();
      if (!f.air && f.anim !== 'ko' && f.anim !== 'down') { f.setAnim('down'); f.aF = 2; }
      if (!f.air) f.vx *= 0.8;
      return;
    }
    if (f.state === 'win') { f.t++; f.stepAnim(); return; }
    if (this.result && this.phaseT > 60 && f.grounded() && f.actionable() && this.result.winner === f.side) {
      f.state = 'win'; f.setAnim('win'); f.vx = 0;
    } else if (f.state === 'launch' || f.state === 'down' || f.state === 'getup' || f.state === 'attack' || f.state === 'hitstun' || f.state === 'blockstun' || f.state === 'land' || f.state === 'air' || f.state === 'dash' || f.state === 'rush' || f.state === 'prejump' || f.state === 'throwing' || f.state === 'thrown' || f.state === 'tech') {
      this.think(f);
    } else if (f.actionable()) {
      if (f.state !== 'idle') { f.state = 'idle'; f.setAnim('idle'); f.vx = 0; }
    }
  };

  // ---------------------------------------------------------- 状態遷移
  Battle.prototype.think = function (f) {
    f.t++;
    var cur = f.buf.cur(), dir = cur.dir;
    var back = dir === 4 || dir === 1 || dir === 7, fwd = dir === 6 || dir === 3 || dir === 9;
    var down = dir <= 3, up = dir >= 7;
    var D = f.D;


    switch (f.state) {
      case 'intro': f.stepAnim(); return;
      case 'idle': case 'walk_f': case 'walk_b': case 'crouch': case 'guardpose':
        if (this.tryActions(f, dir)) return;
        if (up) { this.startJump(f, dir); return; }
        if (this.checkDash(f)) return;
        if (down) {
          if (f.state !== 'crouch') { f.state = 'crouch'; f.setAnim('crouch_in'); }
          if (back && this.threatened(f)) f.setAnim('cguard', true);
          else if (f.anim === 'crouch_in' && f.aDone) f.setAnim('crouch');
          else if (f.anim === 'cguard') f.setAnim('crouch');
          f.vx = 0;
        } else if (back && this.threatened(f)) {
          f.state = 'guardpose'; f.setAnim('guard', true); f.vx = 0;
        } else if (fwd) {
          if (f.state !== 'walk_f') { f.state = 'walk_f'; f.setAnim('walk_f'); }
          f.vx = D.walkF * f.facing;
        } else if (back) {
          if (f.state !== 'walk_b') { f.state = 'walk_b'; f.setAnim('walk_b'); }
          f.vx = -D.walkB * f.facing;
        } else {
          if (f.state === 'crouch' && f.anim !== 'crouch_out') { f.setAnim('crouch_out'); }
          if (f.anim === 'crouch_out' && !f.aDone) { f.stepAnim(); f.vx = 0; return; }
          if (f.state !== 'idle' || f.anim === 'crouch_out') { f.state = 'idle'; f.setAnim('idle'); }
          f.vx = 0;
        }
        f.stepAnim();
        return;
      case 'prejump':
        if (this.trySpecial(f, false)) return;   // 踏み切り中は必殺技を出せる（スト6と同じ）
        f.stepAnim();
        if (f.t >= 4) {
          f.state = 'air'; f.air = true; f.vy = C.JUMP_VY; f.vx = f.jumpDir * D.jumpVX * f.facing;
          f.airAttackUsed = false;
          var ja = f.jumpDir > 0 ? 'jump_f' : (f.jumpDir < 0 ? 'jump_b' : 'jump_up');
          if (!f.A[ja]) ja = 'jump_up';
          f.setAnim(ja); f.aF = ja === 'jump_up' ? 4 : 1;
          this.emit('sfx', { s: 'jump' });
        }
        return;
      case 'air':
        if (!f.airAttackUsed && this.trySpecial(f, 'air')) { f.airAttackUsed = true; return; }
        if (!f.airAttackUsed && f.pendingBtn) {
          var am = D.moves['j_' + f.pendingBtn];
          if (am) { f.airAttackUsed = true; this.startMove(f, 'j_' + f.pendingBtn, 0); f.pendingBtn = null; return; }
        }
        if (f.vy > 0 && f.anim === 'jump_up') f.setAnim('jump_down');
        f.stepAnim();
        return;
      case 'land':
        f.stepAnim();
        if (f.t >= 3) { f.state = 'idle'; f.setAnim('idle'); }
        return;
      case 'dash':
        f.stepAnim();
        var da = f.animObj(), k = f.animTime() / da.total;
        f.vx = (f.dashBack ? D.dashB : D.dashF) * f.facing * Math.max(0, Math.sin(Math.PI * Math.min(1, k * 1.15)));
        if (f.aDone) { f.state = 'idle'; f.setAnim('idle'); f.vx = 0; }
        return;
      case 'rush':
        f.stepAnim();
        f.vx = f.facing * Math.max(3.5, 9.6 - f.t * 0.18);
        // ラッシュの出始めに押した攻撃ボタンは、攻撃を出せるようになるまで覚えておく
        if (f.pendingBtn) f.rushBuf = f.pendingBtn;
        if (f.t >= 6) {
          if (cur.p.lp && cur.h.lk || cur.p.lk && cur.h.lp) { this.tryThrow(f); return; }
          var rb = f.pendingBtn || f.rushBuf; f.rushBuf = null;
          if (rb) {
            var id = (down ? 'c_' : '') + rb;
            f.pendingBtn = null;
            f.carry = f.vx;            // ラッシュの勢いを残したまま技を出す（スト6と同じく滑りながら出る）
            f.nextRush = true;
            this.startMove(f, id, 0); return;
          }
        }
        if (f.t >= 30) { f.state = 'idle'; f.setAnim('idle'); f.vx = 0; }
        return;
      case 'attack':
        this.updateAttack(f, cur, dir);
        return;
      case 'hitstun': case 'blockstun':
        f.stepAnim();
        if (f.state === 'blockstun' && f.aF >= 2) { f.aF = Math.min(f.aF, f.animObj().frames.length - 1); }
        f.stun--;
        if (f.stun <= 0) {
          this.endCombo(f);
          if (f.state === 'blockstun' && f.anim === 'cguard') { f.state = 'crouch'; f.setAnim('crouch'); }
          else { f.state = 'idle'; f.setAnim('idle'); }
          f.vx = 0;
        }
        return;
      case 'launch':
        f.stepAnim();
        if (!f.air) { // 着地 → ダウン
          f.state = 'down'; f.setAnim('down'); f.aF = 1; f.vx *= 0.3; f.t = 0;
          this.emit('sfx', { s: 'down' }); this.spawnFx('dust', f.x, C.GROUND, 1);
          this.shake = 4;
        }
        return;
      case 'down':
        f.stepAnim(); f.vx *= 0.8; f.inv = 2; f.thInv = 2;
        if (f.hp <= 0) { f.state = 'ko'; return; }
        if (f.t >= 34) { f.state = 'getup'; f.setAnim('getup'); f.t = 0; this.endCombo(f); }
        return;
      case 'getup':
        f.stepAnim(); f.inv = 2; f.thInv = 4;
        if (f.aDone) { f.state = 'idle'; f.setAnim('idle'); f.thInv = 2; }
        return;
      case 'throwing':
        this.updateThrow(f, cur);
        return;
      case 'thrown':
        f.stepAnim();
        return;
      case 'tech':
        f.stepAnim(); f.vx *= 0.85;
        if (f.aDone) { f.state = 'idle'; f.setAnim('idle'); f.vx = 0; }
        return;
      case 'ko':
        f.stepAnim();
        return;
      case 'win':
        f.stepAnim();
        return;
    }
  };

  // 押したボタンを数フレーム覚えておく（先行入力）
  Battle.prototype.trackPending = function (f) {
    var cur = f.buf.cur();
    var pb = this.strongestPressed(cur.p);
    if (pb) { f.pendingBtn = pb; f.pendingT = 6; f.lastBtn = { b: pb, t: this.frameNo }; } else if (f.pendingT > 0) { f.pendingT--; if (!f.pendingT) f.pendingBtn = null; }
    // ラッシュ：RUSHボタンはいつでも。→→は技をキャンセルするときだけ（何もしていないときの→→は普通のダッシュ）
    if (cur.p.rush) { f.pendingRush = 6; f.rush66 = false; } else if (f.state === 'attack' && this.saw66(f)) { f.pendingRush = 6; f.rush66 = true; } else if (f.pendingRush > 0) f.pendingRush--;
  };
  // →→（前・ニュートラル・前）を12F以内に入れたか。ラッシュの入力として使う
  Battle.prototype.saw66 = function (f) {
    var H = f.buf.hist, n = H.length;
    if (n < 3 || H[n - 1].dir !== 6 || H[n - 2].dir === 6) return false;
    var sawNeutral = false;
    for (var j = n - 2; j >= Math.max(0, n - 12); j--) {
      var d = H[j].dir;
      if (d === 5) sawNeutral = true;
      else if (d === 6 && sawNeutral) return true;
      else if (d !== 5) return false;
    }
    return false;
  };
  Battle.prototype.strongestPressed = function (p) {
    var order = ['hp', 'hk', 'mp', 'mk', 'lp', 'lk'];
    for (var i = 0; i < order.length; i++) if (p[order[i]]) return order[i];
    return null;
  };

  // 相手の攻撃が来ている（ガード姿勢をとる条件）
  Battle.prototype.threatened = function (f) {
    var o = f.opp, dx = Math.abs(o.x - f.x);
    if (o.state === 'attack' && dx < 230 && o.phase() !== 'r') return true;
    for (var i = 0; i < this.projs.length; i++) {
      var pr = this.projs[i];
      if (pr.owner !== o) continue;
      var dpx = (f.x - pr.x) * Math.sign(pr.vx || o.facing);
      if (dpx > -20 && dpx < 220) return true;
    }
    return false;
  };

  Battle.prototype.checkDash = function (f) {
    var H = f.buf.hist, n = H.length;
    if (n < 3) return false;
    var cur = H[n - 1].dir;
    if (cur !== 6 && cur !== 4) return false;
    if (H[n - 2].dir === cur) return false;
    // 直前12フレーム以内に「同じ方向→ニュートラル」があるか
    var sawNeutral = false;
    for (var j = n - 2; j >= Math.max(0, n - 12); j--) {
      var d = H[j].dir;
      if (d === 5) sawNeutral = true;
      else if (d === cur && sawNeutral) {
        f.state = 'dash'; f.dashBack = cur === 4; f.setAnim(cur === 6 ? 'dash' : 'dash_b'); f.t = 0;
        if (f.dashBack) { f.inv = 8; f.thInv = 12; }
        this.emit('sfx', { s: 'dash' }); this.spawnFx('dust', f.x, C.GROUND, 0.8);
        f.buf.hist.length = 0;
        return true;
      } else if (d !== 5) return false;
    }
    return false;
  };

  Battle.prototype.startJump = function (f, dir) {
    f.state = 'prejump'; f.t = 0; f.setAnim('jump_up');
    f.jumpDir = (dir === 9 ? 1 : dir === 7 ? -1 : 0);
    f.vx = 0;
  };

  // 必殺技・投げ・ラッシュ・通常技の発動判定（行動可能時）
  Battle.prototype.tryActions = function (f, dir) {
    var cur = f.buf.cur();
    if (this.trySpecial(f, false)) return true;
    // 投げ：弱P+弱K（2フレーム以内）
    if ((cur.p.lp || cur.p.lk) && f.buf.pressedWithin('lp', 2) && f.buf.pressedWithin('lk', 2)) { this.tryThrow(f); return true; }
    if (f.pendingRush && f.rush >= C.RUSH_NEUTRAL_COST && f.grounded()) { this.startRush(f, C.RUSH_NEUTRAL_COST); f.buf.hist.length = 0; f.pendingRush = 0; return true; }
    if (f.pendingBtn) {
      var b = f.pendingBtn;
      // 弱P/弱Kは投げとの同時押し猶予として1フレーム待つ
      if ((b === 'lp' || b === 'lk') && f.pendingT === 5 && !cur.h[b === 'lp' ? 'lk' : 'lp']) { }
      var id = (dir <= 3 ? 'c_' : '') + b;
      if (dir === 6 && f.D.moves['f_' + b]) id = 'f_' + b;
      if (dir === 4 && f.D.moves['b_' + b]) id = 'b_' + b;
      f.pendingBtn = null; f.pendingT = 0;
      f.chain = 0; f.chainUsed = {};
      this.startMove(f, id, 0);
      return true;
    }
    return false;
  };

  Battle.prototype.trySpecial = function (f, cancelLevel) {
    var cmds = KF.COMMANDS[f.kind];
    var P = ['lp', 'mp', 'hp'], K = ['lk', 'mk', 'hk'];
    for (var i = 0; i < cmds.length; i++) {
      var c = cmds[i], set = c.btn === 'P' ? P : K;
      var pressed = null, nPressed = 0;
      var pw = cancelLevel ? Math.min(12, Math.max(3, this.frameNo - (f.moveStartF || 0))) : 5;
      for (var k = 0; k < 3; k++) if (f.buf.pressedWithin(set[k], pw)) { nPressed++; if (!pressed || k > set.indexOf(pressed)) pressed = set[k]; }
      if (!pressed) continue;
      var mv = f.D.moves[c.move];
      if (!!c.air !== (cancelLevel === 'air')) continue;
      // キャンセル元を限る技（虚掌破は強Pで出す技からだけ）。EXで出すときは限らない
      var willEx = nPressed >= 2 && f.D.moves[c.move + '_ex'] && f.ex >= C.EX_COST;
      // 昇穿はSA3（天地穿）でだけ、EX昇穿はSA2・SA3でキャンセルできる（スト6と同じ）
      if (cancelLevel && f.state === 'attack' && f.move && f.move.saOnly && f.move.saOnly.indexOf(c.move) < 0) continue;
      if (cancelLevel && cancelLevel !== 'air' && mv.cancelFrom && !willEx && f.state === 'attack' && f.move && f.move.type !== 's' && f.move.type !== 'x' && mv.cancelFrom.indexOf(f.moveId) < 0) continue;
      var slowAdd = (cancelLevel && cancelLevel !== 'air' && mv.slowFrom && !willEx && f.state === 'attack' && f.move && f.move.type !== 's' && f.move.type !== 'x' && mv.slowFrom.ok.indexOf(f.moveId) < 0) ? mv.slowFrom.add : 0;
      if (cancelLevel === 's' && mv.type !== 'u' && mv.type !== 'gu' && !/[sxg]/.test(mv.type)) continue;
      if (cancelLevel === 'u' && mv.type !== 'u' && mv.type !== 'gu') continue;
      var okSeq = c.dp ? f.buf.matchDP(c.win) : f.buf.match(c.seq, c.win, c.loose);
      // 簡易入力（昇竜の ↘↓↘ ・ ↓↘→↘ など）
      if (!okSeq && c.alt) for (var q = 0; q < c.alt.length && !okSeq; q++) okSeq = f.buf.matchStrict(c.alt[q], c.win);
      // 超必殺の簡易コマンド（スト6：↓↘→↓→ ・ ↓→↓↘→ でも成立）
      if (!okSeq && c.altL) for (var q3 = 0; q3 < c.altL.length && !okSeq; q3++) okSeq = f.buf.match(c.altL[q3], c.win, false);
      // 入力の最後が別の技の形で終わっているときはそちらを優先（前歩き波動が昇竜に化けない）
      if (okSeq && c.notIf) for (var q2 = 0; q2 < c.notIf.length && okSeq; q2++) if (f.buf.matchStrict(c.notIf[q2], c.win)) okSeq = false;
      if (!okSeq) continue;
      var str = set.indexOf(pressed);
      var id = c.move;
      if (mv.type === 'u' || mv.type === 'gu') {
        if (f.sup < mv.bars * C.SUPER_BAR) continue;
        f.sup -= mv.bars * C.SUPER_BAR;
        this.startMove(f, id, 0);
        this.superFlash(f, mv);
        f.buf.hist.length = 0;
        return true;
      }
      if (cancelLevel === 'u') continue;
      if (cancelLevel === 'air' && f.air && f.y > C.GROUND - 40) continue; // 地面すれすれでは出ない
      // EX判定：同系統ボタン2つ
      if (nPressed >= 2 && f.D.moves[id + '_ex'] && f.ex >= C.EX_COST) {
        f.ex -= C.EX_COST; id = id + '_ex'; str = 0;
        f.flash = 12; this.emit('sfx', { s: 'ex' });
      }
      this.startMove(f, id, str);
      if (slowAdd) f.preD += slowAdd;   // 竜巻P：強P以外からのキャンセルは出るのが遅れる
      // レバー入力の記録は消さない（スト6と同じ。昇竜の入力の後ろ半分をSAの入力に使い回せる＝複合入力）
      f.pendingBtn = null;
      return true;
    }
    return false;
  };

  Battle.prototype.superFlash = function (f, mv) {
    this.freeze = 40; this.freezeBy = f;
    var ch = f.joint('pelvis');
    this.spawnFx('ring_' + f.D.fx, ch[0], ch[1] - 30, 1);
    this.emit('super', { side: f.side, name: mv.name });
    this.emit('sfx', { s: 'super' });
  };

  Battle.prototype.startRush = function (f, cost) {
    f.rush -= cost; f.rushCD = C.RUSH_COOLDOWN;
    if (f.state === 'attack' && f.move) f.rushLock = true;
    f.state = 'rush'; f.t = 0; f.setAnim('rush'); f.move = null; f.rushBuf = null; f.pendingBtn = null; f.pendingT = 0;
    f.buf.hist.length = 0; f.pendingRush = 0;   // ラッシュの→→が、次の昇竜の→と合わさって→→と読まれないように区切る
    f.pendingRush = 0; f.pendingBtn = null;
    this.emit('sfx', { s: 'rush' }); this.emit('rush', { side: f.side });
    this.spawnFx('dust', f.x, C.GROUND, 1);
  };

  Battle.prototype.startMove = function (f, id, str) {
    var mv = f.D.moves[id];
    if (!mv) return false;
    f.state = 'attack'; f.t = 0; f.move = mv; f.moveId = id; f.str = str || 0; f.moveStartF = this.frameNo; f.moveSerial = (f.moveSerial || 0) + 1;
    f.mvT = 0; f.preD = mv.preDelay ? pick(mv.preDelay, f.str) : 0;
    // ラッシュから出した技だけ：有利＋4Fと、戻りの短縮（そこからキャンセルした技には引き継がない）
    f.rushBonus = !!f.nextRush; f.nextRush = false; f.projHit = false; f.rushCut = f.rushBonus ? C.RUSH_REC_CUT : 0;
    // 空中で出した飛び上がる超必殺（昇竜SAの天地穿）は、溜めを飛ばして、いきなり相手へ向かって突き上げる
    f.hover = false; f.airSA = 0;
    if (f.air && mv.jump && (mv.type === 'u' || mv.type === 'gu')) {
      var an = f.A[mv.anim], ia = 0; for (var k2 = 0; k2 < an.frames.length; k2++) if (an.frames[k2].ph === 'a') { ia = k2; break; }
      f.liftoff = false; f.airSA = 1; f.vy = 0; f.vx = 0; f.aF = 2; f.aT = 0;   // 溜めを短くして、すぐ突き上げに入る
    }
    f.setAnim(mv.anim);
    f.hitCount = 0; f.lastHitT = -99; f.connected = false; f.spawned = false; f.liftoff = false;
    f.counterable = true;
    if (!f.air) f.vx = f.carry || 0;
    f.carry = 0;
    if (mv.type !== 's' && mv.type !== 'x' && !mv.air) { } // 通常技
    if (mv.type === 's' || mv.type === 'x') this.emit('sfx', { s: 'special' });
    f.lastMoveInfo = { id: id, startup: f.animObj().firstActive + 1 + (f.preD || 0), total: f.animObj().total + (f.preD || 0) };
    if (f.thrower) f.thrower = null;
    return true;
  };

  Battle.prototype.updateAttack = function (f, cur, dir) {
    var mv = f.move, a = f.animObj();
    f.mvT = (f.mvT || 0) + 1;   // 技を出してからのフレーム（1F目から）
    // 無敵（完全無敵 inv / 空中の攻撃にだけ無敵 aaInv）。数え下げで同じフレームのうちに消えないよう2にする
    var fn = f.mvT;
    if (mv.inv) { var iv = pick(mv.inv, f.str); if (fn >= iv[0] && fn <= iv[1]) { f.inv = 2; f.thInv = 2; } }
    if (mv.aaInv) { var av = pick(mv.aaInv, f.str); if (fn >= av[0] && fn <= av[1]) f.aaInv = 2; }
    // 強さによる発生の差（スト6の昇龍拳：弱5F・中6F・強7F）。この間は構えの絵のまま待つ
    if (f.preD > 0) { f.preD--; return; }
    // 空中で相手を捕まえる超必殺（天地穿）：最後の一撃まで、捕まえた相手を自分の前に固定する
    if (mv.lockAir && f.air && f.hitCount > 0 && f.hitCount < (mv.hits || 1) && f.opp.state === 'launch') {
      var o2 = f.opp; o2.x = f.x + f.facing * 34; o2.y = Math.min(C.GROUND - 2, f.y - 6); o2.vy = Math.min(f.vy, 0); o2.vx = 0; o2.air = true;
    }
    f.stepAnim();
    // ラッシュから出した技は、戻りのはじめを早送りして後すきを短くする
    if (f.rushCut > 0 && f.phase() === 'r' && !f.aDone) { f.stepAnim(); f.rushCut--; }
    var t = f.animTime(), ph = f.phase();
    if (mv.projInv && ph !== 'r') f.projInv = 2;
    if (ph !== 's') f.counterable = false;
    // 移動
    if (mv.jump && ph === 'a' && !f.liftoff && t >= a.firstActive + 2) {
      f.liftoff = true; f.air = true;
      var s = Math.min(f.str, mv.jump.vy.length - 1);
      f.vy = mv.jump.vy[s]; f.vx = mv.jump.vx[s] * f.facing;
    }
    if (mv.dash) {
      var s2 = Math.min(f.str, mv.dash.vx.length - 1);
      if (ph === 'a') {
        if (!f.liftoff && mv.dash.vy) { f.liftoff = true; f.air = true; f.vy = mv.dash.vy; }
        f.vx = mv.dash.vx[s2] * f.facing;
      } else if (ph === 'r' && !f.air) f.vx *= 0.8;
    }
    if (mv.stall && f.air && ph !== 'r') { f.vy = Math.min(f.vy, 0.4); f.vx = mv.stall[Math.min(f.str, mv.stall.length - 1)] * f.facing; }
    if (mv.dive && ph === 'a' && !f.liftoff) { f.liftoff = true; f.vx = mv.dive.vx * f.facing; f.vy = mv.dive.vy; }
    if (mv.follow && this.tryFollow(f)) return;
    if (mv.dashS && ph === 's' && t > a.firstActive - 12) f.vx = mv.dashS * f.facing;
    if (mv.dashS && ph === 'a' && f.hitCount === 0) f.vx = mv.dashS * 0.6 * f.facing;
    if (mv.dashS && f.hitCount > 0) f.vx = 0.4 * f.facing;
    if (!mv.jump && !mv.dash && !mv.dashS && !f.air && !mv.air) f.vx *= f.rushBonus ? 0.9 : 0.82;   // ラッシュから出した技はゆっくり減速
    // 飛び道具・ビーム・柱の発生
    if (ph === 'a' && !f.spawned) {
      f.spawned = true;
      if (mv.proj) this.spawnProj(f, mv);
      if (mv.beam) this.spawnBeam(f, mv);
      if (mv.pillar) this.spawnPillar(f, mv);
      if (mv.type === 't' || mv.type === 'g' || mv.type === 'gu') { }
    }
    // 投げ判定（持続中）
    if ((mv.type === 't' || mv.type === 'g' || mv.type === 'gu') && ph === 'a' && !f.connected) {
      if (this.checkGrab(f, mv)) return;
    }
    // キャンセル（飛び道具を撃った技は、撃った後しばらく超必殺でキャンセルできる）
    // 飛び道具が当たったら（空中の相手に当たったときなど）、技の戻りの最中でも超必殺でキャンセルできる
    if (mv.proj && mv.cancel && f.spawned && (t <= a.firstActive + 14 || (f.projHit && f.opp.state === 'launch'))) {
      if (this.trySpecial(f, 'u')) return;
    }
    // 飛び道具が当たったら、そのあとはラッシュでキャンセルできる（竜巻P → 波動 → ラッシュ のため）
    if (mv.proj && mv.cancel && mv.cancel.indexOf('r') >= 0 && f.projHit && f.pendingRush && f.rush >= C.RUSH_CANCEL_COST && !f.air) {
      this.startRush(f, C.RUSH_CANCEL_COST); f.rushLock = true; f.pendingRush = 0;
      this.emit('rushcancel', { side: f.side }); return;
    }
    // 昇竜SA：昇穿などは、当たってから飛び上がる前（ヒットストップ中）だけ超必殺でキャンセルできる
    if (f.connected && (mv.cancel || mv.tc) && t <= a.lastActive + (mv.saGround ? 14 : 10) && !(mv.saGround && mv.rootF && !f.rootHit)) {
      if (this.tryCancel(f, cur, dir)) return;
    }
    // ラッシュ中の技は空振りでもラッシュの勢いを少し残す
    // 終了
    if (f.aDone) {
      f.rushBonus = false;
      if (f.air) { f.state = 'air'; f.setAnim('jump_down'); f.move = null; return; }
      f.move = null;
      if (mv.crouch && dir <= 3) { f.state = 'crouch'; f.setAnim('crouch'); }
      else { f.state = 'idle'; f.setAnim('idle'); }
      f.vx = 0;
      if (!f.connected && (mv.type === 's') && mv.meter) { f.sup = Math.min(C.SUPER_MAX, f.sup + mv.meter * 0.5); f.ex = Math.min(C.EX_MAX, f.ex + mv.meter * 0.8); }
    }
  };

  Battle.prototype.tryCancel = function (f, cur, dir) {
    var c = f.move.cancel || '';
    // 昇竜SA：根本で当たったときだけキャンセルできる。飛び上がったあとでもよい（空中からもう一度突き上げる）
    if (f.move.saGround && f.move.rootF && !f.rootHit) return false;
    if (c.indexOf('u') >= 0 || c.indexOf('s') >= 0) {
      if (this.trySpecial(f, c.indexOf('s') >= 0 ? 's' : 'u')) return true;
    }
    // ラッシュキャンセル：スト6と同じく、ゲージ（3本）があれば1コンボ中に何度でも（ゲージ6本なので最大2回）
    if (c.indexOf('r') >= 0 && f.pendingRush && f.rush >= C.RUSH_CANCEL_COST && !f.air) {
      this.startRush(f, C.RUSH_CANCEL_COST);
      f.rushLock = true; f.pendingRush = 0; f.buf.hist.length = 0;
      this.emit('rushcancel', { side: f.side });
      return true;
    }
    // チェーン：当たった（ガードされた）通常技から、より強い通常技へ（弱→中→強）。同じ技は1コンボ1回
    // キャンセル用の先行入力：今の技を出した後に押したボタンなら12F前まで有効
    var lb = f.lastBtn && f.lastBtn.t > (f.moveStartF || 0) && this.frameNo - f.lastBtn.t <= 12 ? f.lastBtn.b : null;
    // ターゲットコンボ（キャラ固有の決まった連係）
    if (f.move.tc && lb === f.move.tc.btn && dir > 3 && !f.air) {
      f.pendingBtn = null; f.lastBtn = null;
      this.startMove(f, f.move.tc.id, 0); f.chain = (f.chain || 0) + 1;
      this.emit('tc', { side: f.side });
      return true;
    }
    if (c.indexOf('c') >= 0 && lb && (lb === 'lp' || lb === 'lk') && f.chain < 3) {
      var id = (dir <= 3 ? 'c_' : '') + lb;
      if (f.D.moves[id] && f.D.moves[id].light) {
        var ch = (f.chain || 0) + 1, used0 = f.chainUsed || {};
        f.pendingBtn = null; f.lastBtn = null;
        this.startMove(f, id, 0); f.chain = ch; f.chainUsed = used0;
        return true;
      }
    }
    return false;
  };

  // 派生技：同じコマンドをもう一度入れると次の段へ（当たり・ガード・空振りのどれでも）
  Battle.prototype.tryFollow = function (f) {
    var mv = f.move, a = f.animObj(), t = f.animTime();
    if (!mv || !mv.follow || t < a.firstActive || t > a.lastActive + 20) return false;
    if (!f.connected && t <= a.lastActive) return false; // 当たる前に次の段で上書きしない
    var lb = f.lastBtn && f.lastBtn.t > (f.moveStartF || 0) && this.frameNo - f.lastBtn.t <= 12 ? f.lastBtn.b : null;
    if (!lb || lb.charAt(1) !== 'p') return false;
    if (!f.buf.match(mv.follow.seq, 16)) return false;
    f.lastBtn = null; f.pendingBtn = null;
    this.startMove(f, mv.follow.id, f.str);
    f.chain = (f.chain || 0) + 1;
    return true;
  };

  // トレーニング：立ち位置リセット（スト6のトレーニングモードと同じ考え方）
  //   center：画面中央 / oRight・oLeft：相手がその側の画面端 / sRight・sLeft：自分（1P）がその側の画面端を背負う
  Battle.prototype.resetTraining = function (mode) {
    var a = this.p[0], b = this.p[1], gap = 80, W = C.WORLD_W, wall = C.WALL;
    var ax, bx, cam;
    if (mode === 'oRight') { cam = W - C.W / 2; bx = W - wall - 2; ax = bx - gap; }
    else if (mode === 'sLeft') { cam = C.W / 2; ax = wall + 2; bx = ax + gap; }
    else if (mode === 'sRight') { cam = W - C.W / 2; ax = W - wall - 2; bx = ax - gap; }
    else if (mode === 'oLeft') { cam = C.W / 2; bx = wall + 2; ax = bx + gap; }
    else { cam = W / 2; ax = W / 2 - 70; bx = W / 2 + 70; }
    this.camX = cam; this.projs = []; this.freeze = 0; this.adv = null; KF._lastAdv = null;
    var self = this;
    [[a, ax], [b, bx]].forEach(function (q) {
      var f = q[0];
      f.x = q[1]; f.y = C.GROUND; f.vx = 0; f.vy = 0; f.air = false; f.pushV = 0;
      f.state = 'idle'; f.setAnim('idle'); f.move = null; f.moveId = null; f.t = 0;
      f.hs = 0; f.stun = 0; f.inv = 0; f.thInv = 0; f.projInv = 0; f.aaInv = 0; f.preD = 0; f.thrower = null; f.grabbed = null;
      f.hp = f.D.hp; f.hpShown = f.hp; f.hpTrail = f.hp; f.rush = C.RUSH_MAX; f.rushCD = 0; f.sup = C.SUPER_MAX; f.ex = C.EX_MAX;
      f.combo = 0; f.comboDmg = 0; f.scale = 1; f.juggle = 0; f.rushLock = false; f.chain = 0; f.chainUsed = {};
      f.pendingBtn = null; f.pendingT = 0; f.pendingRush = 0; f.buf.hist.length = 0;
    });
    a.facing = a.x < b.x ? 1 : -1; b.facing = -a.facing;
    this.emit('sfx', { s: 'cursor' });
  };

  Battle.prototype.endCombo = function (def) {
    if (def.combo > 0) this.emit('comboEnd', { side: def.opp.side, hits: def.combo, dmg: def.comboDmg });
    def.combo = 0; def.comboDmg = 0; def.scale = 1; def.juggle = 0;
    def.opp.rushLock = false; def.opp.chain = 0; def.opp.chainUsed = {};
    // トレーニング：コンボが終わったらラッシュゲージを満タンに戻す
    if (this.training) { def.opp.rush = C.RUSH_MAX; def.opp.rushCD = 0; }
  };

  // ---------------------------------------------------------- 投げ
  Battle.prototype.tryThrow = function (f) {
    f.pendingBtn = null; f.pendingT = 0;
    this.startMove(f, 'throw', 0);
  };
  Battle.prototype.checkGrab = function (f, mv) {
    var o = f.opp, dx = Math.abs(o.x - f.x);
    var range = mv.range ? mv.range[Math.min(f.str, mv.range.length - 1)] : C.THROW_RANGE;
    if (dx > range || o.air || o.thInv > 0) return false;
    if (['hitstun', 'blockstun', 'thrown', 'throwing', 'down', 'getup', 'launch', 'ko', 'prejump'].indexOf(o.state) >= 0) return false;
    if (mv.type === 't' && o.state === 'attack' && o.move && o.move.type === 't' && o.phase() === 'a') {
      this.doTech(f, o); return true; // 投げ同士はお互い抜ける
    }
    f.connected = true;
    f.state = 'throwing'; f.setAnim(mv.doAnim); f.t = 0; f.vx = 0;
    f.grabbed = o; f.grabMove = mv; f.grabHit = false;
    // 叩きつけフレーム（手が最も低くなるフレーム）
    var fr = f.animObj().frames, best = 0, by = -999;
    for (var i = 0; i < fr.length; i++) if (fr[i].j.hand_l[1] > by) { by = fr[i].j.hand_l[1]; best = i; }
    f.slamF = best;
    // 後ろ投げ：後ろ入力で相手を反対側へ
    var d = f.buf.cur().dir;
    f.backThrow = mv.type === 't' && (d === 4 || d === 1 || d === 7);
    o.state = 'thrown'; o.t = 0; o.setAnim('hit_hi'); o.move = null; o.vx = 0; o.thrower = f;
    o.techable = mv.type === 't'; o.techT = 0;
    this.endCombo(o);
    this.emit('sfx', { s: 'grab' });
    return true;
  };
  Battle.prototype.doTech = function (a, b) {
    [a, b].forEach(function (f) { f.state = 'tech'; f.setAnim('tech'); f.t = 0; f.vx = -f.facing * 5.5; f.grabbed = null; f.thrower = null; f.move = null; f.thInv = 8; });
    var mx = (a.x + b.x) / 2;
    this.spawnFx('guard', mx, C.GROUND - 100, 1.2);
    this.emit('sfx', { s: 'tech' }); this.emit('announce', { text: '投げ抜け', small: 1 });
    a.hs = b.hs = 8;
  };
  Battle.prototype.updateThrow = function (f, cur) {
    var o = f.grabbed;
    f.stepAnim();
    // 投げ抜け（受付時間内に弱P+弱K）
    if (o.techable && !f.grabHit) {
      o.techT++;
      var oc = o.buf.cur();
      if (o.techT <= C.THROW_TECH_WINDOW && (oc.p.lp || oc.p.lk) && o.buf.pressedWithin('lp', 3) && o.buf.pressedWithin('lk', 3)) {
        this.doTech(f, o); return;
      }
    }
    // 相手を手の位置に保持
    if (!f.grabHit) {
      var h = f.joint('hand_l');
      var side = f.backThrow && f.aF >= f.slamF - 1 ? -1 : 1;
      o.x = f.x + (h[0] - f.x) * side; o.y = Math.min(C.GROUND, h[1] + 70);
      if (o.y < C.GROUND - 2) { o.air = true; o.setAnim('launch', true); o.stepAnim(); } else o.stepAnim();
      o.facing = -f.facing * side;
    }
    if (!f.grabHit && f.aF >= f.slamF) {
      f.grabHit = true;
      var mv = f.grabMove, dmg = Array.isArray(mv.dmg) ? mv.dmg[Math.min(f.str, mv.dmg.length - 1)] : mv.dmg;
      if (f.backThrow) { f.facing = -f.facing; }
      this.applyDamage(f, o, dmg, mv, true);
      o.state = 'launch'; o.air = true; o.y = Math.min(o.y, C.GROUND - 20);
      o.vy = -4.5; o.vx = f.facing * 3.2; o.setAnim('launch'); o.aF = 4; o.thrower = null; o.juggle = 99;
      o.facing = -f.facing;
      f.hs = o.hs = mv.type === 'gu' ? 20 : 12;
      this.shake = mv.type === 'gu' ? 14 : 8;
      this.spawnFx(mv.type === 'gu' ? 'hit_big' : 'hit_' + f.D.fx, o.x, o.y - 40, 1.3);
      this.impact(f, o, o.x, o.y - 40, f.facing, mv.type === 'gu' ? 3 : 2, false, false, false);
      this.emit('sfx', { s: mv.type === 'gu' ? 'superhit' : 'heavy' });
    }
    if (f.aDone) { f.state = 'idle'; f.setAnim('idle'); f.grabbed = null; f.move = null; }
  };

  // ---------------------------------------------------------- 物理
  Battle.prototype.physics = function (f) {
    if (f.state === 'thrown') return;
    // ラッシュ（とラッシュから出した技の滑り）は、浮いている相手の下をくぐり抜けず、手前で止まる
    if (!f.air && (f.state === 'rush' || (f.state === 'attack' && f.rushBonus)) && f.opp.state === 'launch' && f.vx * f.facing > 0) {
      var gap = (f.opp.x - f.x) * f.facing;
      if (gap > 0) f.vx = f.facing * Math.min(f.vx * f.facing, Math.max(0, gap - 30));
    }
    f.x += f.vx + f.pushV;
    f.pushV *= 0.78; if (Math.abs(f.pushV) < 0.05) f.pushV = 0;
    // 空中から出した天地穿：突き上げながら、相手の少し下（拳が当たる位置）へ吸い寄せられる
    if (f.air && f.airSA > 0 && f.state === 'attack' && !f.liftoff) {
      // 突き上げる前の短い溜めのあいだに、相手の下（拳が届く位置）へすばやく回り込む
      var o = f.opp, tx = o.x - f.facing * 28, ty = Math.min(C.GROUND, o.y + 100);
      f.x += Math.max(-14, Math.min(14, tx - f.x)); f.y += Math.max(-16, Math.min(16, ty - f.y)); f.vy = 0;
      if (f.y >= C.GROUND) { f.y = C.GROUND; f.air = false; }
    }
    else if (f.air) {
      f.vy += (f.state === 'launch' ? (f.floatG || 0.5) : C.GRAVITY);   // ふわっと浮かせる技（アッパー）は落ちるのが遅い
      f.y += f.vy;
      if (f.y >= C.GROUND && f.vy > 0) {
        f.y = C.GROUND; f.air = false; f.vy = 0;
        this.onLand(f);
      }
    }
  };
  Battle.prototype.onLand = function (f) {
    if (f.state === 'launch') return; // think側でダウンへ
    if (f.state === 'air' || (f.state === 'attack' && f.move && (f.move.air || f.move.jump || f.move.dash))) {
      var wasAtk = f.state === 'attack';
      var rec = (wasAtk && f.move && (f.move.jump)) ? 10 : 0;
      f.move = null; f.state = 'land'; f.t = -rec; f.setAnim('land'); f.vx = 0;
      this.spawnFx('dust', f.x, C.GROUND, 0.7);
      this.emit('sfx', { s: 'land' });
    }
  };

  // ---------------------------------------------------------- 飛び道具など
  Battle.prototype.spawnProj = function (f, mv) {
    if (this.projs.some(function (p) { return p.owner === f && p.kind === 'ball'; })) return;
    var h = f.joint('hand_r'), pr = mv.proj, s = Math.min(f.str, pr.spd.length - 1);
    if (pr.ground) h = [f.x + f.facing * 30, C.GROUND - 16];
    this.projs.push({ kind: 'ball', owner: f, mv: mv, key: f.side + ':' + f.moveSerial, x: h[0] + f.facing * 12, y: h[1], vx: pr.spd[s] * f.facing,
                      fx: pr.fx, r: pr.r, hits: pr.hits, rehit: pr.rehit || 99, life: pr.life, t: 0, lastHit: -99, alive: true });
    this.emit('sfx', { s: 'fire' });
  };
  Battle.prototype.spawnBeam = function (f, mv) {
    var h = f.joint('hand_r');
    this.projs.push({ kind: 'beam', owner: f, mv: mv, key: f.side + ':' + f.moveSerial, x: h[0], y: h[1], fx: mv.beam.fx, head: mv.beam.head, len: 0, maxLen: mv.beam.len,
                      h: mv.beam.h, hits: mv.hits, rehit: mv.rehit, t: 0, lastHit: -99, alive: true, dir: f.facing });
    this.emit('sfx', { s: 'beam' }); this.shake = 6;
  };
  Battle.prototype.spawnPillar = function (f, mv) {
    var self = this, offs = mv.pillar.offs || [0];
    offs.forEach(function (o, i) {
      self.projs.push({ kind: 'pillar', owner: f, mv: mv, key: f.side + ':' + f.moveSerial, x: f.opp.x + o * f.facing, y: C.GROUND, fx: mv.pillar.fx, w: mv.pillar.w, hits: mv.hits,
                        rehit: mv.rehit, t: -i * 4, lastHit: -99, alive: true, life: 60 + i * 4 });
    });
    this.emit('sfx', { s: 'pillar' }); this.shake = 8;
  };
  Battle.prototype.updateProjs = function () {
    var self = this;
    this.projs.forEach(function (p) {
      p.t++;
      if (p.kind === 'ball') {
        p.x += p.vx; p.life--;
        if (p.life <= 0 || p.x < self.camX - 380 || p.x > self.camX + 380) p.alive = false;
      } else if (p.kind === 'beam') {
        var o = p.owner;
        if (o.state !== 'attack' || o.phase() === 'r' || o.anim !== 'su_1') { p.alive = false; return; }
        var h = o.joint('hand_r'); p.x = h[0]; p.y = h[1]; p.dir = o.facing;
        p.len = Math.min(p.maxLen, p.len + 60);
      } else if (p.kind === 'pillar') {
        p.life--; if (p.life <= 0) p.alive = false;
      }
    });
    // 飛び道具同士の相殺
    for (var i = 0; i < this.projs.length; i++) for (var j = i + 1; j < this.projs.length; j++) {
      var a = this.projs[i], b = this.projs[j];
      if (!a.alive || !b.alive || a.owner === b.owner || a.kind !== 'ball' || b.kind !== 'ball') continue;
      if (Math.abs(a.x - b.x) < a.r + b.r && Math.abs(a.y - b.y) < a.r + b.r) {
        a.hits--; b.hits--; if (a.hits <= 0) a.alive = false; if (b.hits <= 0) b.alive = false;
        this.spawnFx('hit_w', (a.x + b.x) / 2, (a.y + b.y) / 2, 1); this.emit('sfx', { s: 'clash' });
      }
    }
    // ビームが飛び道具をかき消す
    this.projs.forEach(function (p) {
      if (p.kind !== 'beam') return;
      self.projs.forEach(function (q) {
        if (q.kind === 'ball' && q.owner !== p.owner && q.alive) {
          var x0 = Math.min(p.x, p.x + p.len * p.dir), x1 = Math.max(p.x, p.x + p.len * p.dir);
          if (q.x > x0 && q.x < x1 && Math.abs(q.y - p.y) < p.h) { q.alive = false; self.spawnFx('hit_w', q.x, q.y, 1); }
        }
      });
    });
    this.projs = this.projs.filter(function (p) { return p.alive; });
  };
  Battle.prototype.projBox = function (p) {
    if (p.kind === 'ball') {
      // 出た直後の数フレームは、撃った本人の体の前から弾までを判定にする（密着で弾が相手の後ろに出ても当たる）
      if (p.t <= 3) {
        var bx = p.owner.x + p.owner.facing * 10, x0 = Math.min(bx, p.x - p.r), x1 = Math.max(bx, p.x + p.r);
        return [x0, p.y - p.r, x1 - x0, p.r * 2];
      }
      return [p.x - p.r, p.y - p.r, p.r * 2, p.r * 2];
    }
    if (p.kind === 'beam') {
      // 根元の判定：撃った本人の体の前から手の先までもビームの判定にする（密着でも当たる）
      var root = p.owner.x + p.dir * 6, tip = p.x + p.dir * p.len;
      var bx0 = Math.min(root, tip), bx1 = Math.max(root, tip);
      return [bx0, p.y - p.h / 2, bx1 - bx0, p.h];
    }
    if (p.kind === 'pillar') {
      var g = Math.min(1, p.t / 10);
      if (p.t < 6 || p.t > 52) return null; // t<0 は時間差で出る柱
      return [p.x - p.w / 2, C.GROUND - 230 * g, p.w, 230 * g];
    }
  };

  // ---------------------------------------------------------- 当たり判定
  function overlap(a, b) { return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1]; }
  function anyOverlap(A, B) {
    for (var i = 0; i < A.length; i++) for (var j = 0; j < B.length; j++) if (overlap(A[i], B[j])) return [A[i], B[j]];
    return null;
  }
  KF.overlap = overlap;

  Battle.prototype.collide = function () {
    var hits = [];
    for (var i = 0; i < 2; i++) {
      var f = this.p[i], o = f.opp;
      if (f.state !== 'attack' || !f.move || f.move.type === 't' || f.move.type === 'g' || f.move.type === 'gu') continue;
      if (f.hs > 0) continue;
      var mv = f.move, maxHits = mv.hits || 1;
      if (f.hitCount >= maxHits) continue;
      if (f.hitCount > 0 && f.animTime() - f.lastHitT < (mv.rehit || 99)) continue;
      if (f.phase() !== 'a') continue;
      var hb = f.boxes('hit');
      if (!hb.length) continue;
      if (!this.hittable(o, mv, f.side + ':' + f.moveSerial, f)) continue;
      var ov = anyOverlap(hb, o.boxes('hurt'));
      if (ov) hits.push([f, o, mv, ov]);
    }
    // 相打ちも両方処理
    var self = this;
    hits.forEach(function (h) { self.onHit(h[0], h[1], h[2], h[3], null); });
    // 飛び道具・ビーム・柱
    this.projs.forEach(function (p) {
      var o = p.owner.opp;
      if (!p.alive || p.hits <= 0) return;
      if (p.t - p.lastHit < p.rehit) return;
      if (!self.hittable(o, p.mv, p.key) || o.projInv > 0) return;
      var b = self.projBox(p); if (!b) return;
      var ov = anyOverlap([b], o.boxes('hurt'));
      if (ov) {
        p.lastHit = p.t; p.hits--;
        self.onHit(p.owner, o, p.mv, ov, p);
        if (p.owner.state === 'attack' && p.owner.move === p.mv) p.owner.projHit = true;
        if (p.kind === 'ball' && p.hits <= 0) p.alive = false;
      }
    });
  };

  // 空中追撃の決まり（スト6の追撃カウント方式）
  //   jset：地上の相手を浮かせたときのカウント / jlim：カウントがこの値以下なら浮いた相手に当たる / jinc：当てたときに増える量
  function jugLim(mv) {
    if (mv.jlim != null) return mv.jlim;
    if (mv.jg || mv.lock || mv.type === 'u' || mv.type === 'gu') return 99;
    if (mv.type === 'x') return 2;
    if (mv.type === 's') return 1;
    return 0;
  }
  KF.jugLim = jugLim;
  Battle.prototype.hittable = function (o, mv, key, att) {
    if (o.inv > 0) return false;
    if (o.aaInv > 0 && att && att.air) return false;   // 空中の攻撃にだけ無敵
    if (['down', 'getup', 'ko', 'thrown', 'tech', 'intro', 'win'].indexOf(o.state) >= 0) return false;
    if (o.state === 'launch') {
      if (o.juggle >= 99 && !(mv.type === 'u' && o.jugBy === key)) return false;
      if (key && o.jugBy === key) return true;   // 同じ技の2発目以降
      if (o.juggle > Math.max(jugLim(mv), att && att.rushBonus ? 1 : 0)) return false;   // ラッシュから出した通常技は浮いた相手にも当たる
    }
    return true;
  };

  Battle.prototype.canBlock = function (o, mv) {
    if (['idle', 'walk_f', 'walk_b', 'crouch', 'guardpose', 'blockstun'].indexOf(o.state) < 0) return false;
    if (o.air) return false;
    var d = o.buf.cur().dir;
    var back = d === 4 || d === 1;
    if (!back) return false;
    var crouching = d === 1;
    if (mv.lv === 'l' && !crouching) return false;
    if (mv.lv === 'o' && crouching) return false;
    return true;
  };

  Battle.prototype.onHit = function (att, def, mv, ov, proj) {
    var box = ov[0], hb = ov[1];
    var cx = (Math.max(box[0], hb[0]) + Math.min(box[0] + box[2], hb[0] + hb[2])) / 2;
    var cy = (Math.max(box[1], hb[1]) + Math.min(box[1] + box[3], hb[1] + hb[3])) / 2;
    var blocked = this.canBlock(def, mv);
    var str = att.str || 0;
    var baseDmg = Array.isArray(mv.dmg) ? mv.dmg[Math.min(str, mv.dmg.length - 1)] : mv.dmg;
    // 根本ヒット（昇穿：弱・中は持続1〜2F目、強は1F目）。それ以外の当たり方は個別ダメージになり、SAでキャンセルできない（スト6と同じ）
    if (!proj && mv.rootF && att.hitCount === 0) {
      var aa = att.A[att.anim]; att.rootHit = att.animTime() - aa.firstActive < pick(mv.rootF, str);
      if (!att.rootHit && mv.rootDmg) baseDmg = mv.rootDmg;
    }
    var lastHit = false;
    if (!proj) { att.hitCount++; att.lastHitT = att.animTime(); att.connected = true; }
    var maxH = mv.hits || 1;
    var hitIndex = proj ? (proj.mv.proj ? proj.mv.proj.hits : proj.mv.hits) - proj.hits : att.hitCount;
    lastHit = proj ? proj.hits <= 0 : att.hitCount >= maxH;
    if (mv.lastDmg && lastHit) baseDmg = mv.lastDmg;
    var rem = proj ? 0 : att.remaining();
    var hs = mv.hs || 10;
    var dirX = proj ? Math.sign(proj.vx || proj.dir || att.facing) : att.facing;

    if (blocked) {
      var bonus = att.rushBonus ? C.RUSH_BONUS_ADV : 0;
      var adv = mv.adv ? pick(mv.adv[1], str) : 0;
      var stun = mv.stun ? mv.stun[1] : Math.max(6, rem + adv + bonus + 1);
      if (proj) stun = 14 + (mv.adv ? mv.adv[1] + 6 : 0);
      if (mv.type === 'u' && !lastHit) stun = Math.max(stun, 16);
      def.state = 'blockstun'; def.stun = stun; def.vx = 0;
      def.setAnim(def.buf.cur().dir === 1 ? 'cguard' : 'guard'); def.aF = 1;
      var chip = mv.chip ? Math.round(baseDmg * mv.chip) : 0;
      if (chip) {
        if (def.hp - chip <= 0 && mv.type !== 'u') chip = def.hp - 1;
        def.hp -= chip;
      }
      def.hs = Math.max(4, hs - 2); if (!proj) att.hs = def.hs;
      def.hitShake = 1.5; def.hitShakeT = def.hs;
      this.push(att, def, mv.push ? mv.push[1] : 5, dirX, proj);
      att.sup = Math.min(C.SUPER_MAX, att.sup + baseDmg * 0.18);
      def.sup = Math.min(C.SUPER_MAX, def.sup + baseDmg * 0.12);
      att.ex = Math.min(C.EX_MAX, att.ex + baseDmg * 0.15); def.ex = Math.min(C.EX_MAX, def.ex + baseDmg * 0.15);
      this.spawnFx('guard', cx, cy, 1);
      this.emit('sfx', { s: 'block' });
      this.emit('block', { side: att.side, move: att.moveId });
      if (!proj) this.adv = { att: att, def: def, f0: this.frameNo, move: att.moveId, blocked: true };
      if (def.hp <= 0) this.koDefender(att, def);
      return;
    }

    // ---- ヒット
    var counter = def.state === 'attack' && def.counterable;
    var punish = !counter && ((def.state === 'attack' && def.phase() === 'r') || (def.state === 'land' && def.t < 0));
    def.combo++;
    var sc = C.SCALING[Math.min(def.combo - 1, C.SCALING.length - 1)];
    if (att.rushLock && def.combo > 1) sc *= C.RUSH_CANCEL_SCALE;
    if (mv.minScale) sc = Math.max(sc, mv.minScale);
    var dmg = Math.max(1, Math.round(baseDmg * sc * (counter || punish ? 1.2 : 1)));
    this.applyDamage(att, def, dmg, mv, false);
    def.counterable = false;
    if (counter) this.emit('announce', { text: 'COUNTER', small: 1, side: att.side });
    if (punish) this.emit('announce', { text: 'PUNISH COUNTER', small: 1, side: att.side });

    var wasAir = def.air || def.state === 'launch';
    // 相手を捕まえる超必殺（天地穿など）は、浮いている相手に当たっても地上で捕まえる
    if (mv.lock && !lastHit && wasAir && !att.air) { wasAir = false; def.air = false; def.y = C.GROUND; def.vy = 0; }
    def.move = null; def.thrower = null;
    if (def.grabbed) { def.grabbed.state = 'idle'; def.grabbed = null; }
    var kd = mv.kd || (mv.kdLast && lastHit ? mv.kdLast : null);
    if (mv.pcLaunch && punish) kd = 'launch';
    if (def.hp <= 0) kd = 'launch';
    if (mv.lock && !lastHit) kd = null;
    if (mv.lockAir && !lastHit && att.air) kd = 'launch';
    if (kd || wasAir) {
      def.state = 'launch'; def.air = true; def.setAnim('launch'); def.t = 0;
      if (kd === 'sweep') { def.vy = -3.5; def.vx = -dirX * -1 * 0 + dirX * 1.0; def.y = Math.min(def.y, C.GROUND - 4); }
      else {
        var lvy = mv.pcLaunch && punish ? mv.pcLaunch[0] : pick(mv.lvy, str), lvx = mv.pcLaunch && punish ? mv.pcLaunch[1] : pick(mv.lvx, str);
        // 浮いた相手を、浮かせ技ではない技（ラッシュ弱Pなど）で拾ったときは、その場で少し浮かせ直すだけにする
        if (wasAir && !kd && lvy == null && !proj && mv.type !== 'u' && mv.type !== 'gu') { lvy = KF.PICK_VY || -5.5; lvx = 0.6; }
        def.vy = lvy || -6.5; def.vx = dirX * (lvx == null ? 2.6 : lvx); if (def.y >= C.GROUND) def.y = C.GROUND - 2;
      }
      def.floatG = mv.floatG || null;   // 浮かせ方（次に当たった技で上書き）
      var jkey = proj ? proj.key : att.side + ':' + att.moveSerial;
      var isSup = mv.type === 'u' || mv.type === 'gu';   // 超必殺が当たったら、そのあとは追撃できない
      if (!wasAir) def.juggle = mv.jset != null ? pick(mv.jset, str) : (kd === 'sweep' || isSup ? 99 : 1);
      else if (def.jugBy !== jkey) def.juggle += mv.jinc != null ? mv.jinc : (isSup ? 99 : 1);
      def.jugBy = jkey;
      if (mv.lock && !lastHit) { def.vy = -2; def.vx = 0; def.pushV = 0; def.x = att.x + att.facing * 54; }
      if (mv.lockAir && !lastHit) { def.x = att.x + att.facing * 34; def.y = Math.min(C.GROUND - 2, att.y - 6); def.vy = Math.min(att.vy, -1); def.air = true; }
    } else {
      var bonus2 = (att.rushBonus ? C.RUSH_BONUS_ADV : 0) + (counter ? 2 : 0) + (punish ? (mv.heavy ? 6 : 4) : 0);
      var advH = mv.adv ? mv.adv[0] : 0;
      var stun2 = mv.stun ? mv.stun[0] : Math.max(8, rem + (advH === 'kd' ? 0 : advH) + bonus2 + 1);
      if (proj) stun2 = 18 + (mv.adv ? mv.adv[0] + 6 : 0);
      if (mv.lock) { stun2 = Math.max(stun2, mv.rehit + 14); def.pushV = 0; att.pushV = 0; def.x = att.x + att.facing * 54; }
      def.state = 'hitstun'; def.stun = stun2; def.vx = 0;
      var low = mv.lv === 'l' || (att.move && att.move.crouch && !att.move.aa);
      def.setAnim(def.isCrouching() || def.anim === 'crouch' ? 'hit_c' : (low ? 'hit_lo' : 'hit_hi'));
      this.push(att, def, mv.push ? mv.push[0] : 5, dirX, proj);
    }
    def.hs = hs + (punish && !proj ? 5 : counter || punish ? 3 : 0); if (!proj) att.hs = def.hs;
    var big = baseDmg >= 900 || mv.type === 'u';
    this.spawnFx(big ? 'hit_big' : (baseDmg >= 500 ? 'hit_' + att.D.fx : 'hit_w'), cx, cy, big ? 0.8 : 1);
    // 一撃の重さの演出：強さ（0弱 1中 2強 3超必殺）ごとに、被弾側の震え・白く光る・画面揺れ・寄り・火花・砂ぼこりを重ねる
    var tier = mv.type === 'u' ? 3 : (mv.heavy || baseDmg >= 800) ? 2 : baseDmg >= 500 ? 1 : 0;
    this.impact(att, def, cx, cy, dirX, tier, counter, punish, mv.type === 'u' && hitIndex > 1);
    this.emit('sfx', { s: mv.type === 'u' ? 'superhit' : (tier >= 2 ? 'heavy' : tier === 1 ? 'mid' : 'light') });
    if (counter || punish) this.emit('sfx', { s: punish ? 'punish' : 'counter' });
    this.emit('hit', { side: att.side, move: att.moveId, dmg: dmg, combo: def.combo, counter: counter });
    if (!proj) this.adv = { att: att, def: def, f0: this.frameNo, move: att.moveId, blocked: false };
    if (def.hp <= 0) this.koDefender(att, def);
  };

  Battle.prototype.applyDamage = function (att, def, dmg, mv, isThrow) {
    def.hp = Math.max(0, def.hp - dmg);
    def.comboDmg += dmg;
    if (isThrow) { def.combo = 1; }
    att.sup = Math.min(C.SUPER_MAX, att.sup + (mv.type === 'u' || mv.type === 'gu' ? 0 : dmg * 0.5));
    def.sup = Math.min(C.SUPER_MAX, def.sup + dmg * 0.3);
    if (mv.type !== 'x' && mv.type !== 'u' && mv.type !== 'gu') att.ex = Math.min(C.EX_MAX, att.ex + dmg * 0.3);
    def.ex = Math.min(C.EX_MAX, def.ex + dmg * 0.25);
    def.dmgPop = { v: def.comboDmg, t: 60 };
    def.flash = 6;
    if (def.hp <= 0) this.koDefender(att, def);
  };

  Battle.prototype.koDefender = function (att, def) {
    if (def.koMarked) return;
    def.koMarked = true;
    this.slow = 50; this.shake = 10;
    this.emit('ko', { side: def.side });
    this.emit('sfx', { s: 'ko' });
  };

  Battle.prototype.push = function (att, def, amt, dirX, proj) {
    if (!proj && att.chain > 0) amt *= 0.6;
    def.pushV += dirX * amt;
    // 画面端なら攻撃側が押し戻される
    var lim = this.limits();
    if (!proj && ((dirX > 0 && def.x >= lim[1] - 4) || (dirX < 0 && def.x <= lim[0] + 4))) {
      att.pushV -= dirX * amt * 0.9;
    }
  };

  // ---------------------------------------------------------- 押し合い・壁・カメラ
  Battle.prototype.limits = function () {
    var half = C.W / 2 - C.WALL;
    return [Math.max(C.WALL, this.camX - half), Math.min(C.WORLD_W - C.WALL, this.camX + half)];
  };
  Battle.prototype.separate = function () {
    var a = this.p[0], b = this.p[1];
    var wa = a.D.pushW / 2, wb = b.D.pushW / 2;
    var ya = a.y, yb = b.y;
    var vertOverlap = Math.abs(ya - yb) < 70 && a.state !== 'thrown' && b.state !== 'thrown' && a.state !== 'down' && b.state !== 'down';
    if (vertOverlap) {
      var dx = b.x - a.x, need = wa + wb;
      if (Math.abs(dx) < need) {
        var pen = need - Math.abs(dx), s = dx === 0 ? (a.facing > 0 ? 1 : -1) : Math.sign(dx);
        // 空中から落ちてくる側を主に押す
        var ra = a.air && !b.air ? 0.8 : (!a.air && b.air ? 0.2 : 0.5);
        a.x -= s * pen * ra; b.x += s * pen * (1 - ra);
      }
    }
    var lim = this.limits();
    // 最大間隔（画面内に収める）
    [a, b].forEach(function (f) { f.x = Math.max(lim[0], Math.min(lim[1], f.x)); });
    var dx2 = b.x - a.x;
    if (vertOverlap && Math.abs(dx2) < wa + wb - 1) {
      var s2 = Math.sign(dx2) || 1;
      if (a.x <= lim[0] + 0.5 || a.x >= lim[1] - 0.5) b.x = a.x + s2 * (wa + wb);
      else if (b.x <= lim[0] + 0.5 || b.x >= lim[1] - 0.5) a.x = b.x - s2 * (wa + wb);
    }
  };
  Battle.prototype.updateCamera = function () {
    var mid = (this.p[0].x + this.p[1].x) / 2;
    var target = Math.max(C.W / 2, Math.min(C.WORLD_W - C.W / 2, mid));
    // 二人が画面内に入るよう、近い方の端にのみ寄せる
    this.camX += (target - this.camX) * 0.25;
    var half = C.W / 2 - C.WALL + 2;
    var lo = Math.max(this.p[0].x, this.p[1].x) - half, hi = Math.min(this.p[0].x, this.p[1].x) + half;
    this.camX = Math.max(lo, Math.min(hi, this.camX));
    this.camX = Math.max(C.W / 2, Math.min(C.WORLD_W - C.W / 2, this.camX));
    if (this.shake > 0) this.shake *= 0.85; if (this.shake < 0.3) this.shake = 0;
  };
  Battle.prototype.updateFacing = function () {
    var self = this;
    this.p.forEach(function (f) {
      var want = f.opp.x >= f.x ? 1 : -1;
      if (f.air || f.state === 'attack' || f.state === 'throwing' || f.state === 'thrown' || f.state === 'launch' || f.state === 'down' || f.state === 'rush' || f.state === 'dash') return;
      if (want !== f.facing && Math.abs(f.opp.x - f.x) > 2) {
        f.facing = want;
      }
    });
  };

  // ---------------------------------------------------------- 演出用エフェクト
  Battle.prototype.spawnFx = function (name, x, y, scale) {
    this.fx.push({ name: name, x: x, y: y, t: 0, s: scale || 1, flip: Math.random() < 0.5 });
  };
  // ヒットの衝撃：tier 0弱 1中 2強 3超必殺。cont=超必殺の2段目以降（控えめにする）
  Battle.prototype.impact = function (att, def, x, y, dir, tier, counter, punish, cont) {
    var T = tier + (counter ? 1 : 0) + (punish ? 2 : 0);
    if (cont) T = Math.min(T, 2);
    // 被弾側だけヒットストップ中に震える（攻撃側は止まったまま）
    def.hitShake = [2.5, 3.5, 5, 6, 7, 8][Math.min(T, 5)]; def.hitShakeT = Math.max(1, def.hs);
    def.whiteT = T >= 1 ? 3 : 2;
    // 画面揺れと、強い一撃でのカメラの寄り
    this.shake = Math.max(this.shake, [0, 1.2, 3.5, 5, 6.5, 8][Math.min(T, 5)]);
    if (T >= 2 && !cont) { this.zoom = Math.max(this.zoom || 0, T >= 4 ? 0.07 : T >= 3 ? 0.05 : 0.03); this.zoomAt = [x - this.camX + KF.CONST.W / 2, y]; }
    if (punish || (tier === 3 && !cont)) this.bgFlash = punish ? 4 : 2;
    // 衝撃波と放射状の線
    var col = punish ? 'p' : counter ? 'c' : tier >= 3 ? 's' : 'n';
    var rays = [];
    var nr = [6, 9, 12, 14, 16, 18][Math.min(T, 5)];
    for (var i = 0; i < nr; i++) {
      var a = (i / nr) * Math.PI * 2 + Math.random() * 0.4;
      // 攻撃の向きに長く伸ばす
      var along = Math.cos(a) * dir;
      rays.push({ a: a, l: (0.6 + Math.random() * 0.6) * (1 + Math.max(0, along) * 0.9) });
    }
    this.fx.push({ name: 'impact', x: x, y: y, t: 0, T: T, col: col, dir: dir, rays: rays, s: 1 });
    // 飛び散る火の粉
    var np = [4, 7, 11, 14, 16, 20][Math.min(T, 5)];
    for (var k = 0; k < np; k++) {
      var sp = 2.5 + Math.random() * (2 + T * 1.2);
      var ang = (Math.random() - 0.5) * 2.2 + (dir > 0 ? 0 : Math.PI);
      this.fx.push({ name: 'spk', x: x, y: y, t: 0, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5, col: col, life: 10 + Math.random() * 10 | 0, s: 1 });
    }
    // 強い一撃は相手の足元に砂ぼこり
    if (tier >= 2 && !def.air && def.state !== 'launch') this.spawnFx('dust', def.x - dir * 6, KF.CONST.GROUND, 0.9 + T * 0.1);
  };
  Battle.prototype.updateFx = function () {
    this.fx.forEach(function (e) {
      e.t++;
      if (e.name === 'spk') { e.x += e.vx; e.y += e.vy; e.vx *= 0.9; e.vy = e.vy * 0.9 + 0.35; }
    });
    if (this.zoom > 0) { this.zoom *= 0.8; if (this.zoom < 0.002) this.zoom = 0; }
    if (this.bgFlash > 0) this.bgFlash--;
    this.p.forEach(function (f) { if (f.whiteT > 0) f.whiteT--; });
    this.fx = this.fx.filter(function (e) { return e.t < 40; });
    this.p.forEach(function (f) { if (f.dmgPop) { f.dmgPop.t--; if (f.dmgPop.t <= 0) f.dmgPop = null; } });
  };

  // ---------------------------------------------------------- ラウンド判定
  Battle.prototype.checkRound = function () {
    if (this.phase !== 'fight' || this.training) return;
    var a = this.p[0], b = this.p[1];
    this.timerSub++;
    if (this.timerSub >= 60) { this.timerSub = 0; this.timer = Math.max(0, this.timer - 1); }
    var aKO = a.hp <= 0, bKO = b.hp <= 0;
    var over = this.timer <= 0;
    if (!aKO && !bKO && !over) return;
    var winner;
    if (aKO && bKO) winner = -1;
    else if (aKO) winner = 1;
    else if (bKO) winner = 0;
    else {
      var ra = a.hp / a.D.hp, rb = b.hp / b.D.hp;
      winner = Math.abs(ra - rb) < 1e-6 ? -1 : (ra > rb ? 0 : 1);
    }
    this.phase = 'end'; this.phaseT = 0;
    var how = aKO || bKO ? (aKO && bKO ? 'DOUBLE KO' : 'KO') : 'TIME';
    this.result = { winner: winner, how: how };
    if (winner === -1) { this.wins[0]++; this.wins[1]++; } else this.wins[winner]++;
    if (aKO) { a.state = 'ko'; if (!a.air) a.setAnim('ko'); }
    if (bKO) { b.state = 'ko'; if (!b.air) b.setAnim('ko'); }
    this.emit('roundEnd', { winner: winner, how: how });
    this.emit('announce', { text: how === 'TIME' ? 'TIME OVER' : how, big: 1 });
  };
  Battle.prototype.nextRound = function () {
    var w = this.wins;
    var done = (w[0] >= 2 || w[1] >= 2) || this.round >= 5;
    if (done) {
      var winner = w[0] === w[1] ? -1 : (w[0] > w[1] ? 0 : 1);
      this.matchOver = { winner: winner };
      this.emit('matchEnd', { winner: winner });
      this.phase = 'over';
      return;
    }
    this.round++;
    var keepSup = [this.p[0].sup, this.p[1].sup], keepEx = [this.p[0].ex, this.p[1].ex];
    this.startRound();
    this.p[0].sup = keepSup[0]; this.p[1].sup = keepSup[1]; this.p[0].ex = keepEx[0]; this.p[1].ex = keepEx[1];
    this.p[0].koMarked = this.p[1].koMarked = false;
  };
})();
