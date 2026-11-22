// =====================================================================
//  入力：キーボード（割り当て変更可）/ ゲームパッド / タッチ / CPU
//  毎フレーム {x, y, held{}, pressed{}} を作り、入力履歴（バッファ）に積む
// =====================================================================
'use strict';
var KF = window.KF || (window.KF = {});

KF.BUTTONS = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'rush', 'start'];
KF.DEFAULT_KEYS = {
  1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
       lp: 'KeyU', mp: 'KeyI', hp: 'KeyO', lk: 'KeyJ', mk: 'KeyK', hk: 'KeyL', rush: 'KeyH', start: 'Enter' },
  2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
       lp: 'Numpad4', mp: 'Numpad5', hp: 'Numpad6', lk: 'Numpad1', mk: 'Numpad2', hk: 'Numpad3', rush: 'Numpad0', start: 'NumpadEnter' },
};

KF.Input = (function () {
  var down = {}, latch = {};
  var keys = { 1: Object.assign({}, KF.DEFAULT_KEYS[1]), 2: Object.assign({}, KF.DEFAULT_KEYS[2]) };
  try {
    var saved = JSON.parse(localStorage.getItem('kf_keys') || 'null');
    if (saved) { keys[1] = Object.assign(keys[1], saved[1]); keys[2] = Object.assign(keys[2], saved[2]); }
  } catch (e) { }
  var touch = { x: 0, y: 0, held: {} };
  var listeners = [];
  window.addEventListener('keydown', function (e) {
    // 合言葉などを文字入力しているあいだは、ゲームの操作として扱わない
    var ae = document.activeElement; if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    if (!down[e.code]) listeners.forEach(function (f) { f(e.code); });
    down[e.code] = true; latch[e.code] = true;
    if (/^(Arrow|Space|Numpad|Tab)/.test(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { down[e.code] = false; });
  window.addEventListener('blur', function () { down = {}; latch = {}; });
  // フレームの間に押して離したキーも1フレームは押されたことにする
  function isOn(code) { return !!(down[code] || latch[code]); }

  // ---------------- ゲームパッド / レバーレス
  // ・どのスロットにつながっても使える（1Pは2P用に割り当てたパッド以外すべてを見る）
  // ・方向は 十字ボタン(12-15) / 左スティック / ハット(POV) のどれでも読む
  // ・ボタン割り当ては操作設定で変更できる（ブラウザに保存）
  var PAD_DEFAULT = { lp: 2, mp: 3, hp: 5, lk: 0, mk: 1, hk: 7, rush: 4, rush2: 6, start: 9, reset: 8, up: 12, down: 13, left: 14, right: 15 };
  var padMap = Object.assign({}, PAD_DEFAULT);
  var padOwner = {}; // pad.index -> 1 or 2（2Pに割り当てたパッド）
  try {
    var pm = JSON.parse(localStorage.getItem('kf_pad') || 'null'); if (pm) padMap = Object.assign(padMap, pm);
    var po = JSON.parse(localStorage.getItem('kf_padowner') || 'null'); if (po) padOwner = po;
  } catch (e) { }
  function pads() {
    var list = [];
    try { list = navigator.getGamepads ? navigator.getGamepads() : []; KF.padBlocked = false; }
    catch (e) { KF.padBlocked = true; list = []; }
    var out = [];
    for (var i = 0; i < (list ? list.length : 0); i++) if (list[i] && list[i].connected !== false) out.push(list[i]);
    return out;
  }
  function hat(p) {
    // DirectInput形式のハット：-1=上 … 1=左上、静止時は1より大きい値
    var idx = p.axes.length > 9 ? 9 : -1;
    if (idx < 0) return null;
    var v = p.axes[idx];
    if (v === undefined || v > 1.05 || v < -1.05) return null;
    var k = Math.round((v + 1) / (2 / 7));
    var dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    return dirs[k] || null;
  }
  function readPad(p) {
    var b = function (n) { return n != null && !!(p.buttons[n] && (p.buttons[n].pressed || p.buttons[n].value > 0.5)); };
    var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    var h = hat(p) || [0, 0];
    var m = padMap;
    return {
      left: b(m.left) || ax < -0.5 || h[0] < 0, right: b(m.right) || ax > 0.5 || h[0] > 0,
      up: b(m.up) || ay < -0.5 || h[1] < 0, down: b(m.down) || ay > 0.5 || h[1] > 0,
      lp: b(m.lp), mp: b(m.mp), hp: b(m.hp), lk: b(m.lk), mk: b(m.mk), hk: b(m.hk), rush: b(m.rush) || b(m.rush2), start: b(m.start), reset: b(m.reset),
    };
  }
  function padState(player) {
    var ps = pads(), res = null;
    ps.forEach(function (p, order) {
      // CPU戦・トレーニングでは、つながっているパッドはすべて1P。2人対戦では2台目以降を2Pに
      var owner = KF.vsMode ? (padOwner[p.index] || (order >= 1 ? 2 : 1)) : 1;
      if (owner !== player) return;
      var s = readPad(p);
      if (!res) res = s; else Object.keys(s).forEach(function (k) { res[k] = res[k] || s[k]; });
    });
    return res;
  }
  // 操作設定用：いま押されているパッドのボタン番号
  function padPressed() {
    var ps = pads();
    for (var i = 0; i < ps.length; i++) for (var j = 0; j < ps[i].buttons.length; j++) if (ps[i].buttons[j].pressed) return { pad: ps[i].index, btn: j };
    var h;
    for (var i2 = 0; i2 < ps.length; i2++) if ((h = hat(ps[i2])) && (h[0] || h[1])) return { pad: ps[i2].index, hat: h };
    return null;
  }
  window.addEventListener('gamepadconnected', function (e) { KF.padNotice = { text: 'コントローラー接続：' + (e.gamepad.id || '').slice(0, 40), t: 240 }; });
  window.addEventListener('gamepaddisconnected', function (e) { KF.padNotice = { text: 'コントローラーが外れました', t: 180 }; });

  function Source(player) {
    this.player = player; this.prev = {}; this.cpu = null; this.useTouch = false;
  }
  Source.prototype.sample = function () {
    var k = keys[this.player], h = {}, i;
    var pad = padState(this.player);
    var L, R, U, D;
    if (this.cpu) {
      var c = this.cpu.output();
      L = c.x < 0; R = c.x > 0; U = c.y < 0; D = c.y > 0;
      for (i = 0; i < KF.BUTTONS.length; i++) h[KF.BUTTONS[i]] = !!c.held[KF.BUTTONS[i]];
    } else {
      L = isOn(k.left); R = isOn(k.right); U = isOn(k.up); D = isOn(k.down);
      for (i = 0; i < KF.BUTTONS.length; i++) { h[KF.BUTTONS[i]] = isOn(k[KF.BUTTONS[i]]); }
      [k.left, k.right, k.up, k.down].concat(KF.BUTTONS.map(function (b) { return k[b]; })).forEach(function (c) { latch[c] = false; });
      if (pad) {
        L = L || pad.left; R = R || pad.right; U = U || pad.up; D = D || pad.down;
        for (i = 0; i < KF.BUTTONS.length; i++) h[KF.BUTTONS[i]] = h[KF.BUTTONS[i]] || pad[KF.BUTTONS[i]];
      }
      if (this.useTouch) {
        if (touch.tap) Object.keys(touch.tap).forEach(function (n) { if (touch.tap[n] > 0) { h[n] = true; touch.tap[n]--; } });
        L = L || touch.x < 0; R = R || touch.x > 0; U = U || touch.y < 0; D = D || touch.y > 0;
        for (i = 0; i < KF.BUTTONS.length; i++) h[KF.BUTTONS[i]] = h[KF.BUTTONS[i]] || !!touch.held[KF.BUTTONS[i]];
      }
    }
    // SOCD整理（レバーレス対応）：左右同時=ニュートラル、上下同時=上
    var x = (R ? 1 : 0) - (L ? 1 : 0);
    var y = U ? -1 : (D ? 1 : 0);
    var pressed = {};
    for (i = 0; i < KF.BUTTONS.length; i++) {
      var b = KF.BUTTONS[i];
      pressed[b] = h[b] && !this.prev[b];
    }
    // モダン操作：上の段（弱P・中P・強P）を弱・中・強、弱K／強KをSP、中Kをアシストとして読む
    if (this.modern && !this.cpu) {
      var pv = this.prev || {};
      var mh = { l: h.lp, m: h.mp, h: h.hp, sp: h.lk || h.hk, auto: h.mk };
      var mp0 = { l: pv.lp, m: pv.mp, h: pv.hp, sp: pv.lk || pv.hk, auto: pv.mk };
      Object.keys(mh).forEach(function (k) { pressed['_' + k] = mh[k] && !mp0[k]; });
      this._mh = mh;
    }
    this.prev = h;
    // トレーニングの位置リセット（1Pのみ：キーボードR / Backspace、パッドのBACK）
    var rs = !this.cpu && this.player === 1 && (isOn('KeyR') || isOn('Backspace') || !!(pad && pad.reset) || !!(this.useTouch && touch.reset));
    if (!this.cpu && this.player === 1) { latch.KeyR = false; latch.Backspace = false; }
    var rsP = rs && !this.prevReset; this.prevReset = rs;
    if (this.modern && !this.cpu && this._mh) {
      var mh2 = this._mh;
      ['l', 'm', 'h', 'sp', 'auto'].forEach(function (k) { h[k] = !!mh2[k]; pressed[k] = !!pressed['_' + k]; delete pressed['_' + k]; });
    }
    return { x: x, y: y, held: h, pressed: pressed, reset: rsP };
  };

  // 操作タイプ（クラシック／モダン）。1P・2Pそれぞれブラウザに保存
  var modern = { 1: false, 2: false };
  try { var md = JSON.parse(localStorage.getItem('kf_modern') || 'null'); if (md) modern = Object.assign(modern, md); } catch (e) { }
  return {
    modern: modern,
    setModern: function (pl, v) { modern[pl] = !!v; try { localStorage.setItem('kf_modern', JSON.stringify(modern)); } catch (e) { } },
    Source: Source, keys: keys, touch: touch,
    isDown: function (code) { return !!down[code]; },
    clearLatch: function () { latch = {}; },
    pads: pads, padMap: function () { return padMap; },
    padDiag: function () {
      var ok = !!navigator.getGamepads, list = pads();
      // ページの許可設定でコントローラーが禁止されていないか（禁止だと空の一覧が返るだけでエラーにならない）
      try { var fp = document.permissionsPolicy || document.featurePolicy; if (fp && fp.allowsFeature && !fp.allowsFeature('gamepad')) KF.padBlocked = true; } catch (e) { }
      var inFrame = false; try { inFrame = window.top !== window.self; } catch (e) { inFrame = true; }
      var raw = list.map(function (p) {
        var bs = []; p.buttons.forEach(function (b, i) { if (b.pressed || b.value > 0.5) bs.push(i); });
        var ax = []; p.axes.forEach(function (v, i) { if (Math.abs(v) > 0.5 && !(i === 9 && v > 1.05)) ax.push(i + ':' + v.toFixed(1)); });
        return { id: p.id, idx: p.index, map: p.mapping, bs: bs, ax: ax };
      });
      return { api: ok, blocked: !!KF.padBlocked, pads: raw, focus: document.hasFocus(), frame: inFrame, file: location.protocol === 'file:' };
    },
    // メニュー用：Aで決定・Bで戻る・STARTで決定（どのパッドでも）
    padMenu: function () {
      var r = { ok: false, back: false }, list = pads();
      list.forEach(function (p) { var b = function (n) { return p.buttons[n] && p.buttons[n].pressed; }; if (b(0) || b(9)) r.ok = true; if (b(1)) r.back = true; });
      return r;
    }, padPressed: padPressed, padOwner: padOwner,
    setPad: function (act, btn) { padMap[act] = btn; try { localStorage.setItem('kf_pad', JSON.stringify(padMap)); } catch (e) { } },
    setPadOwner: function (idx, player) { padOwner[idx] = player; try { localStorage.setItem('kf_padowner', JSON.stringify(padOwner)); } catch (e) { } },
    resetPad: function () { padMap = Object.assign({}, PAD_DEFAULT); try { localStorage.removeItem('kf_pad'); } catch (e) { } },
    onKey: function (f) { listeners.push(f); },
    offKey: function (f) { var i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); },
    saveKeys: function () { try { localStorage.setItem('kf_keys', JSON.stringify(keys)); } catch (e) { } },
    resetKeys: function () { keys[1] = Object.assign({}, KF.DEFAULT_KEYS[1]); keys[2] = Object.assign({}, KF.DEFAULT_KEYS[2]); this.saveKeys(); },
  };
})();

// 入力履歴（コマンド判定用）
KF.InputBuffer = function () { this.hist = []; };
KF.InputBuffer.prototype.push = function (inp, facing) {
  var x = inp.x * facing; // 向きを考慮（前=+）
  var dir = 5 + x - inp.y * 3; // テンキー表記
  this.hist.push({ dir: dir, p: inp.pressed, h: inp.held });
  if (this.hist.length > 40) this.hist.shift();
};
KF.InputBuffer.prototype.refacing = function () { };
// seq を win フレーム以内に順に入力し、最後の方向から5フレーム以内にボタン
KF.InputBuffer.prototype.match = function (seq, win, btnFrames, loose) {
  var H = this.hist, n = H.length;
  var lastBtn = -1;
  for (var i = n - 1; i >= Math.max(0, n - btnFrames); i--) if (btnFrames && H[i]._btn) { lastBtn = i; break; }
  var si = seq.length - 1;
  var limit = Math.max(0, n - win);
  var miss = 0;
  for (var j = n - 1; j >= limit && si >= 0; j--) {
    var d = H[j].dir;
    if (d === seq[si] || (seq[si] === 2 && (d === 1 || d === 3) && si > 0 && seq[si - 1] !== d && seq[si + 1] !== d && false)) si--;
    else if (loose && si > 0 && d === seq[si - 1] && miss < 1) { si -= 2; miss++; }
  }
  return si < 0;
};
