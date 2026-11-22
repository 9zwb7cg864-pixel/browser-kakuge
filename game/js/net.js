// =====================================================================
//  オンライン対戦（ロールバック方式）
//   ・自分の入力は INPUT_DELAY フレーム後の分として相手に送る
//   ・相手の入力がまだ届いていないフレームは「直前の入力のまま」と予想して進める
//   ・予想が外れていたら、そのフレームまで状態を巻き戻して計算し直す（最大 MAX_ROLLBACK フレーム）
//   ・相手より進みすぎたら少し待って足並みをそろえる
//  KF.Rollback は通信方法に依存しない（Nodeの試験でも使う）。KF.NetSession が PeerJS で相手とつなぐ
// =====================================================================
'use strict';
var KF = (typeof window !== 'undefined' ? window : global).KF || {};

(function () {
  var BTN = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'rush', 'l', 'm', 'h', 'sp', 'auto'];   // 後ろ5つはモダン操作のボタン

  // 入力を1つの数にまとめる：方向(x,y) と押しているボタン
  function pack(inp) {
    var v = (inp.x + 1) | ((inp.y + 1) << 2);
    for (var i = 0; i < BTN.length; i++) if (inp.held && inp.held[BTN[i]]) v |= 1 << (4 + i);
    return v;
  }
  // 数から入力に戻す。押した瞬間（pressed）は前のフレームとの差で決める（両方の画面で必ず同じになる）
  function unpack(v, prev) {
    var held = {}, pressed = {};
    for (var i = 0; i < BTN.length; i++) {
      var on = !!(v & (1 << (4 + i)));
      held[BTN[i]] = on;
      pressed[BTN[i]] = on && !(prev & (1 << (4 + i)));
    }
    return { x: (v & 3) - 1, y: ((v >> 2) & 3) - 1, held: held, pressed: pressed };
  }
  var NEUTRAL = pack({ x: 0, y: 0, held: {} });

  // ---- 状態の丸ごと写し（キャラの技データや絵の情報など、変わらないものは写さずにそのまま使う）
  var statics = null;
  function buildStatics(roots) {
    var set = new Set(), stack = roots.slice();
    while (stack.length) {
      var v = stack.pop();
      if (!v || typeof v !== 'object' || set.has(v)) continue;
      set.add(v);
      if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) stack.push(v[i]); }
      else for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) stack.push(v[k]);
    }
    return set;
  }
  function cloneGraph(root) {
    var map = new Map();
    function c(v) {
      if (v === null || typeof v !== 'object') return v;
      if (statics.has(v)) return v;
      var m = map.get(v); if (m) return m;
      var o, i;
      if (Array.isArray(v)) { o = new Array(v.length); map.set(v, o); for (i = 0; i < v.length; i++) o[i] = c(v[i]); }
      else {
        o = Object.create(Object.getPrototypeOf(v)); map.set(v, o);
        var ks = Object.keys(v);
        for (i = 0; i < ks.length; i++) o[ks[i]] = c(v[ks[i]]);
      }
      return o;
    }
    return c(root);
  }
  KF.cloneBattle = function (b) {
    if (!statics) statics = buildStatics([KF.CHARS, KF.CONST, KF.COMMANDS, b.meta, b.opts]);
    return cloneGraph(b);
  };

  // 同期ずれの確認用：勝負に関わる値だけで作った短い値
  function hashBattle(b) {
    var s = b.frameNo + '|' + b.phase + '|' + b.round + '|' + b.timer + '|' + b.wins.join(',');
    b.p.forEach(function (f) {
      s += '|' + f.x.toFixed(2) + ',' + f.y.toFixed(2) + ',' + f.hp + ',' + f.state + ',' + f.anim + ',' + f.aF + ',' + Math.round(f.rush) + ',' + Math.round(f.sup) + ',' + Math.round(f.ex);
    });
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  KF.hashBattle = hashBattle;

  // ---------------------------------------------------------- ロールバック本体
  function Rollback(o) {
    this.side = o.side;                 // 自分が 0(1P) か 1(2P) か
    this.send = o.send;                 // 相手へ送る関数
    this.onEvent = o.onEvent || function () { };
    this.delay = o.delay != null ? o.delay : 2;
    this.maxRB = o.maxRollback || 8;
    this.battle = o.makeBattle();
    this.frame = 0;                     // 次に計算するフレーム
    this.local = {}; this.remote = {}; this.used = {}; // 自分の入力／相手の確定入力／計算に使った相手の入力
    this.snaps = {}; this.hashes = {}; this.sentHash = {};
    this.lastRemote = -1;               // 相手の入力がそろっている最後のフレーム
    this.remoteFrame = 0;               // 相手が計算しているフレーム（相手からの報告）
    this.rb = null;                     // 巻き戻しが必要な最初のフレーム
    this.ticks = 0; this.stalls = 0; this.rollbacks = 0; this.maxRolled = 0;
    this.desync = null; this.keep = !!o.keepHistory; this.remoteAdv = 0;
    for (var i = 0; i < this.delay; i++) this.local[i] = NEUTRAL;
    if (!this.delay) this.local[-1] = NEUTRAL;
    this.localSent = this.delay - 1;
  }
  KF.Rollback = Rollback;
  Rollback.pack = pack; Rollback.unpack = unpack;

  Rollback.prototype.remoteAt = function (f) {
    if (this.remote[f] != null) return this.remote[f];
    for (var g = Math.min(f, this.lastRemote + 50); g >= 0; g--) if (this.remote[g] != null) return this.remote[g];
    return NEUTRAL;
  };
  Rollback.prototype.inputsFor = function (f) {
    var l = this.local[f] != null ? this.local[f] : NEUTRAL;
    var lp = this.local[f - 1] != null ? this.local[f - 1] : NEUTRAL;
    var r = this.remoteAt(f), rp = f > 0 ? (this.used[f - 1] != null ? this.used[f - 1] : this.remoteAt(f - 1)) : NEUTRAL;
    this.used[f] = r;
    var li = unpack(l, lp), ri = unpack(r, rp);
    return this.side === 0 ? [li, ri] : [ri, li];
  };
  Rollback.prototype.stepFrame = function (f, silent) {
    this.snaps[f] = KF.cloneBattle(this.battle);
    var b = this.battle;
    b.events.length = 0;
    b.step(this.inputsFor(f));
    if (!silent) for (var i = 0; i < b.events.length; i++) this.onEvent(b.events[i]);
    b.events.length = 0;
    this.hashes[f] = hashBattle(b);
    delete this.snaps[f - this.maxRB - 4];
    if (!this.keep) { delete this.used[f - 400]; delete this.local[f - 400]; delete this.remote[f - 400]; delete this.hashes[f - 600]; }
  };

  // 相手から届いたもの
  Rollback.prototype.receive = function (m) {
    this.lastRecvAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (m.t === 'in') {
      for (var i = 0; i < m.d.length; i++) {
        var fr = m.s + i;
        if (this.remote[fr] != null) continue;
        this.remote[fr] = m.d[i];
        // すでに予想で計算したフレームで、予想が外れていたら巻き戻す
        if (fr < this.frame && this.used[fr] !== m.d[i]) this.rb = this.rb == null ? fr : Math.min(this.rb, fr);
      }
      while (this.remote[this.lastRemote + 1] != null) this.lastRemote++;
      if (m.f >= this.remoteFrame) { this.remoteFrame = m.f; this.remoteAdv = m.v || 0; }
      this.remoteAck = Math.max(this.remoteAck || -1, m.a);
    } else if (m.t === 'hash') {
      (this.theirHash = this.theirHash || {})[m.f] = m.h;
    }
  };

  // 毎フレーム呼ぶ。localInp は今のこの手元の入力。進んだら true
  Rollback.prototype.tick = function (localInp) {
    this.ticks++;
    var target = this.frame + this.delay;
    // 進みすぎて待っている間は、新しい入力を積まない（入力が先に溜まりすぎないように）
    if (this.local[target] == null) this.local[target] = pack(localInp);
    var top = target; while (this.local[top] == null && top > 0) top--;
    // 送る：まだ相手に確定していない自分の入力（取りこぼし対策で、ある程度まとめて毎回送る）
    var from = Math.max((this.remoteAck == null ? -1 : this.remoteAck) + 1, top - 30, 0), d = [];
    for (var g = from; g <= top; g++) d.push(this.local[g] != null ? this.local[g] : NEUTRAL);
    this.send({ t: 'in', s: from, d: d, f: this.frame, a: this.lastRemote, v: this.frame - this.remoteFrame });
    // 巻き戻して計算し直す
    if (this.rb != null && this.rb < this.frame) {
      var start = this.rb; this.rb = null;
      if (this.snaps[start]) {
        this.battle = KF.cloneBattle(this.snaps[start]);
        for (var f = start; f < this.frame; f++) this.stepFrame(f, true);
        this.rollbacks++; this.maxRolled = Math.max(this.maxRolled, this.frame - start);
      }
    }
    this.rb = null;
    // 同期ずれの確認（入力が両方そろって、計算し直しも済んだフレームだけ）
    for (var hf = Math.max(0, this.lastRemote - 120); hf <= Math.min(this.lastRemote, this.frame - 1); hf++) {
      if (hf % 60 === 0 && !this.sentHash[hf] && this.hashes[hf] != null) { this.sentHash[hf] = 1; this.send({ t: 'hash', f: hf, h: this.hashes[hf] }); }
    }
    if (this.theirHash) for (var k in this.theirHash) {
      var kf = +k; if (kf > this.lastRemote || kf >= this.frame) continue;
      if (this.hashes[kf] != null && this.hashes[kf] !== this.theirHash[k] && !this.desync) this.desync = { f: kf };
      delete this.theirHash[k];
    }
    // 相手の入力がまだ遠い（巻き戻せる幅を超える）ときは待つ
    if (this.frame - this.lastRemote > this.maxRB) { this.stalls++; return false; }
    // 相手より進みすぎていたら、ときどき1フレーム待って足並みをそろえる
    // （回線の遅れの分は両方に同じだけ入るので、お互いの「相手との差」を比べて、その半分を本当の差とみなす）
    var ahead = ((this.frame - this.remoteFrame) - this.remoteAdv) / 2;
    if (ahead >= 1 && this.ticks % 4 === 0) { this.stalls++; return false; }
    this.stepFrame(this.frame, false);
    this.frame++;
    return true;
  };

  // ---------------------------------------------------------- PeerJSで相手とつなぐ
  var PREFIX = 'dairantou-sf-v1-';
  var CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newCode() { var s = ''; for (var i = 0; i < 5; i++) s += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; return s; }

  function NetSession() { this.status = 'idle'; this.msg = ''; this.handlers = []; this.rtt = null; }
  KF.NetSession = NetSession;
  NetSession.prototype.on = function (fn) { this.handlers.push(fn); };
  NetSession.prototype.fire = function (m) { this.handlers.forEach(function (h) { h(m); }); };
  NetSession.prototype.setStatus = function (s, msg) { this.status = s; this.msg = msg || ''; this.fire({ t: '_status' }); };
  NetSession.prototype.peerOpts = function () { return { debug: 0 }; };

  NetSession.prototype.host = function () {
    var self = this;
    if (!window.Peer) { this.setStatus('error', '通信部品を読み込めませんでした'); return; }
    this.isHost = true; this.side = 0; this.code = newCode();
    this.setStatus('connecting', '部屋を作っています…');
    this.peer = new Peer(PREFIX + this.code, this.peerOpts());
    this.peer.on('open', function () { self.setStatus('waiting', '相手を待っています'); });
    this.peer.on('connection', function (c) {
      if (self.conn) { c.on('open', function () { c.send({ t: 'full' }); setTimeout(function () { c.close(); }, 500); }); return; }
      self.attach(c);
    });
    this.peer.on('error', function (e) {
      if (e.type === 'unavailable-id') { self.peer.destroy(); self.host(); return; }
      self.setStatus('error', '接続エラー：' + (e.type || e.message));
    });
  };
  NetSession.prototype.join = function (code) {
    var self = this;
    if (!window.Peer) { this.setStatus('error', '通信部品を読み込めませんでした'); return; }
    this.isHost = false; this.side = 1; this.code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.setStatus('connecting', '部屋 ' + this.code + ' につないでいます…');
    this.peer = new Peer(this.peerOpts());
    this.peer.on('open', function () {
      // 順番を保証しない送り方：1つ遅れても後ろの入力が待たされない（入力は毎回まとめて送り直すので取りこぼしても埋まる）
      var c = self.peer.connect(PREFIX + self.code, { reliable: false, serialization: 'json' });
      self.attach(c);
      setTimeout(function () { if (self.status === 'connecting') self.setStatus('error', '部屋が見つからないか、つながりませんでした'); }, 15000);
    });
    this.peer.on('error', function (e) {
      self.setStatus('error', e.type === 'peer-unavailable' ? '部屋 ' + self.code + ' が見つかりません' : '接続エラー：' + (e.type || e.message));
    });
  };
  NetSession.prototype.attach = function (c) {
    var self = this;
    this.conn = c;
    c.on('open', function () {
      self.setStatus('connected', 'つながりました');
      self.send({ t: 'hello', v: 1, modern: !!(KF.Input && KF.Input.modern && KF.Input.modern[1]), kind: KF.onlineKind || 'kokuu' });
      self.pingTimer = setInterval(function () { self.send({ t: 'ping', at: performance.now() }); }, 1000);
    });
    c.on('data', function (m) {
      if (!m || !m.t) return;
      if (m.t === 'ping') { self.send({ t: 'pong', at: m.at }); return; }
      if (m.t === 'pong') { var r = performance.now() - m.at; self.rtt = self.rtt == null ? r : self.rtt * 0.7 + r * 0.3; return; }
      if (m.t === 'full') { self.setStatus('error', 'その部屋はもう対戦中です'); return; }
      self.fire(m);
    });
    c.on('close', function () { self.closed(); });
    c.on('error', function () { self.closed(); });
  };
  NetSession.prototype.closed = function () {
    if (this.status === 'closed') return;
    clearInterval(this.pingTimer);
    this.setStatus('closed', '相手との接続が切れました');
  };
  NetSession.prototype.send = function (m) { try { if (this.conn && this.conn.open) this.conn.send(m); } catch (e) { } };
  NetSession.prototype.close = function () {
    clearInterval(this.pingTimer);
    try { this.conn && this.conn.close(); } catch (e) { }
    try { this.peer && this.peer.destroy(); } catch (e) { }
    this.conn = null; this.peer = null; this.status = 'idle';
  };
  NetSession.prototype.inviteURL = function () {
    return location.origin + location.pathname + '?room=' + this.code;
  };

  if (typeof module !== 'undefined') module.exports = { Rollback: Rollback };
})();
