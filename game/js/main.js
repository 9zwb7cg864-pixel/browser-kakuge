// =====================================================================
//  画面遷移：タイトル → モード → 難易度 → 対戦 → リザルト（キャラは道着キャラ男のみ。2Pは色違い）
//  60fps固定ステップのメインループ / 操作設定 / 技表 / ポーズ
// =====================================================================
'use strict';
var KF = window.KF || (window.KF = {});

(function () {
  var cv = document.getElementById('screen');
  var R, scene = 'load', sel = 0, game = null, sources, ai = null, cfg = { mode: 'cpu', p1: 'kokuu', p2: 'kokuu', level: 'NORMAL' };
  var menuItems = [], selStage = 0, selCursor = [0, 1], pausedSel = 0, paused = false, keyEdit = null, frameT = 0;
  var lastEvents = 0, fpsInfo = { n: 0, t: 0, fps: 60 }, showFps = false, resultSel = 0, moveListFor = 'kokuu';
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  var LEVELS = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];
  var LEVEL_DESC = {
    EASY: '反応が遅く、ガードや対空をあまりしない。単発の技が中心。',
    NORMAL: 'ほどほどにガードし、簡単な必殺技キャンセルを使う。',
    HARD: '対空・確定反撃をしっかり狙い、コンボやゲージも使う。',
    EXPERT: '反応が速く判断が正確。ラッシュキャンセルや超必殺でとどめを狙う。',
  };

  sources = [new KF.Input.Source(1), new KF.Input.Source(2)];
  if (isTouch) sources[0].useTouch = true;

  // ------------------------------------------------------------ メニュー入力
  var menuPrev = {};
  function menuInput() {
    var s = sources[0].sample(), s2 = sources[1].cpu ? null : sources[1].sample();
    var padNow = KF.Input.padMenu();
    if (padNow.ok && s.pressed.lk && !KF.Input.isDown(KF.Input.keys[1].lk)) s.pressed.lk = false;
    var res = { up: false, down: false, left: false, right: false, ok: false, back: false, p2: {} };
    function edge(name, v, store) { var p = store[name]; store[name] = v; return v && !p; }
    res.up = edge('u', s.y < 0, menuPrev); res.down = edge('d', s.y > 0, menuPrev);
    res.left = edge('l', s.x < 0, menuPrev); res.right = edge('r', s.x > 0, menuPrev);
    res.ok = s.pressed.lp || s.pressed.start || KF.Input.isDown('Enter') && edge('ent', true, menuPrev) || edge('sp', KF.Input.isDown('Space'), menuPrev);
    if (!KF.Input.isDown('Enter')) menuPrev.ent = false;
    res.back = s.pressed.lk || edge('esc', KF.Input.isDown('Escape'), menuPrev) || !!KF._tapBack;
    KF._tapBack = false;
    var pm = KF.Input.padMenu();
    if (edge('pa', pm.ok, menuPrev)) res.ok = true;
    if (edge('pb', pm.back, menuPrev)) { res.back = true; }
    if (pm.back) res.ok = res.ok && !s.pressed.lp;
    if (s2) {
      var p2 = menuPrev.p2 || (menuPrev.p2 = {});
      res.p2.left = edge('l', s2.x < 0, p2); res.p2.right = edge('r', s2.x > 0, p2); res.p2.ok = s2.pressed.lp || s2.pressed.start; res.p2.back = s2.pressed.lk;
    }
    return res;
  }

  // クリック/タップでメニュー選択
  var clickPos = null;
  function toCanvas(e) {
    var r = cv.getBoundingClientRect();
    var t = e.changedTouches ? e.changedTouches[0] : e;
    return [(t.clientX - r.left) / r.width * 640, (t.clientY - r.top) / r.height * 360];
  }
  cv.addEventListener('mousedown', function (e) { KF.Audio.init(); clickPos = toCanvas(e); });
  cv.addEventListener('touchstart', function (e) { KF.Audio.init(); if (scene !== 'battle' || paused) { clickPos = toCanvas(e); e.preventDefault(); } }, { passive: false });
  function clicked(rect) {
    if (!clickPos) return false;
    var x = clickPos[0], y = clickPos[1];
    return x >= rect[0] && x <= rect[0] + rect[2] && y >= rect[1] && y <= rect[1] + rect[3];
  }

  // ------------------------------------------------------------ 描画ヘルパ
  function bg(dim) {
    var c = R.ctx;
    R.t++;
    R.drawStage(512 + Math.sin(R.t * 0.002) * 180, null);
    // 雨はなし
    c.fillStyle = 'rgba(2,2,10,' + (dim == null ? 0.55 : dim) + ')'; c.fillRect(0, 0, 640, 360);
  }
  function drawMenu(items, y0, cur, w) {
    var c = R.ctx, rects = [];
    w = w || 220;
    items.forEach(function (it, i) {
      var gap = items.length > 10 ? 23 : items.length > 8 ? 26 : 30, bh = items.length > 10 ? 21 : 24, y = y0 + i * gap, x = 320 - w / 2, on = i === cur;   // 項目が多いときは詰める
      c.fillStyle = on ? 'rgba(0,220,255,0.18)' : 'rgba(10,10,30,0.6)';
      c.fillRect(x, y, w, bh);
      c.strokeStyle = on ? '#38d6ff' : '#3a3a6a'; c.strokeRect(x + 0.5, y + 0.5, w - 1, bh - 1);
      if (on) { c.fillStyle = '#ff3fe6'; c.fillRect(x, y, 3, bh); }
      R.text(it, 320, y + bh / 2, bh < 24 ? 12 : 13, on ? '#ffffff' : '#a0a8c8', 'center', on ? '#00c8ff' : null);
      rects.push([x, y, w, bh]);
    });
    return rects;
  }
  function pickByClick(rects) {
    for (var i = 0; i < rects.length; i++) if (clicked(rects[i])) return i;
    return -1;
  }
  function drawFighterBig(kind, anim, x, y, scale, facing, t, alt) {
    var A = KF.Assets, a = A.meta[kind].anims[anim], tot = a.total, tt = t % tot, fi = 0;
    for (var i = 0; i < a.frames.length; i++) if (tt >= a.frames[i].start) fi = i;
    var img = KF.fighterImg(kind, anim, alt), c = R.ctx;
    c.save(); c.translate(x, y); c.scale(facing * scale, scale);
    c.drawImage(img, fi * 224, 0, 224, 200, -112, -190, 224, 200);
    c.restore();
  }

  // ------------------------------------------------------------ シーン
  var titleSel = 0;
  var TITLE_ITEMS = ['CPU対戦', 'オンライン対戦', '2人対戦', 'トレーニング', '技表', '操作設定'];
  function sceneTitle(m) {
    bg(0.35);
    var c = R.ctx;
    drawFighterBig('kokuu', 'idle', 150, 330, 1.25, 1, frameT);
    drawFighterBig('kokuu', 'idle', 490, 330, 1.25, -1, frameT, true);
    c.fillStyle = 'rgba(0,0,10,0.45)'; c.fillRect(0, 40, 640, 86);
    R.text('ブラウザ格ゲー', 320, 84, 44, '#ffffff', 'center', '#00d8ff');
    var rects = drawMenu(TITLE_ITEMS, 134, titleSel, 200);
    if (m.up) { titleSel = (titleSel + TITLE_ITEMS.length - 1) % TITLE_ITEMS.length; KF.Audio.play('cursor'); }
    if (m.down) { titleSel = (titleSel + 1) % TITLE_ITEMS.length; KF.Audio.play('cursor'); }
    var ck = pickByClick(rects); if (ck >= 0) { titleSel = ck; m.ok = true; }
    drawPadStatus(323);
    R.text('キーボード：移動WASD 決定U 戻るJ ／ パッド：決定A 戻るB', 320, 346, 9, '#8890b0', 'center');
    if (m.ok) {
      KF.Audio.play('ok');
      if (titleSel === 0) { cfg.mode = 'cpu'; goSelect(); }
      else if (titleSel === 1) { goOnline(); }
      else if (titleSel === 2) { cfg.mode = 'vs'; goSelect(); }
      else if (titleSel === 3) { cfg.mode = 'training'; goSelect(); }
      else if (titleSel === 4) { scene = 'moves'; moveListFor = 'kokuu'; }
      else { scene = 'keys'; keyEdit = { p: 1, i: 0, wait: false }; }
    }
  }
  // コントローラーの状態（つながらない原因を画面で見られるように）
  function drawPadStatus(y) {
    var d = KF.Input.padDiag(), txt, col;
    if (!d.api || d.blocked) { txt = 'コントローラー：この開き方ではブラウザが読み取りを止めています（単体版を使ってください）'; col = '#ff8080'; }
    else if (!d.pads.length) {
      txt = d.frame ? 'コントローラー：見つかりません（claude.aiの中で開いています → 単体版で開いてください）'
                    : 'コントローラー：見つかりません（単体版' + (d.file ? '' : 'ではない') + '）→ Chromeがレバーレスを認識していません';
      col = '#ffd060';
    }
    else {
      var p = d.pads[0];
      txt = 'コントローラー：' + p.id.slice(0, 30) + (d.pads.length > 1 ? ' 他' + (d.pads.length - 1) + '台' : '') + '　入力中：' + (p.bs.length ? 'ボタン' + p.bs.join(',') : '') + (p.ax.length ? ' 軸' + p.ax.join(' ') : '') + (!p.bs.length && !p.ax.length ? 'なし' : '');
      col = '#7fffb0';
    }
    if (!d.focus) { txt += '（画面をクリックしてください）'; }
    R.ctx.fillStyle = 'rgba(0,0,10,0.7)'; R.ctx.fillRect(20, y - 9, 600, 18);
    R.text(txt, 320, y, 9, col, 'center');
  }
  function goSelect() { scene = 'select'; selStage = 0; selCursor = [0, 1]; }

  var KINDS = ['kokuu', 'yui'];
  var DESC = {
    kokuu: ['地上戦が得意なバランス型', '飛び道具・対空・突進技を持つ', '体力 10000 / 動き 速め'],
    yui: ['今は道着キャラ男と同じ技を使う', '攻撃の絵はまだ仮', '体力 10000 / 動き 速め'],
  };
  function sceneSelect(m) {
    bg(0.6);
    var c = R.ctx;
    R.text('キャラクター選択', 320, 22, 18, '#ffffff', 'center', '#7a5cff');
    var who = selStage === 0 ? '1P' : (cfg.mode === 'vs' ? '2P' : 'CPU');
    R.text(who + ' のキャラクターを選んでください', 320, 44, 11, '#c0c8e8', 'center');
    var rects = [];
    KINDS.forEach(function (k, i) {
      var x = i === 0 ? 30 : 330, w = 280, y = 58, h = 250;
      var on = selCursor[selStage] === i;
      c.fillStyle = on ? 'rgba(40,20,70,0.7)' : 'rgba(10,10,30,0.6)'; c.fillRect(x, y, w, h);
      c.strokeStyle = on ? KF.CHARS[k].color : '#33335a'; c.lineWidth = on ? 2 : 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); c.lineWidth = 1;
      drawFighterBig(k, on ? 'win' : 'idle', x + 92, y + 222, 1.0, 1, frameT);
      R.text(KF.CHARS[k].name, x + 180, y + 30, 15, '#ffffff', 'center', KF.CHARS[k].color);
      DESC[k].forEach(function (l, j) { R.text(l, x + 186, y + 62 + j * 18, 9, '#c8d0f0', 'center'); });
      if (selStage === 1 && selCursor[0] === i) R.text('1P', x + 20, y + 16, 12, '#38d6ff', 'left');
      rects.push([x, y, w, h]);
    });
    R.text('決定：弱P / 戻る：弱K', 320, 336, 9, '#8890b0', 'center');
    if (m.left || m.right) { selCursor[selStage] = 1 - selCursor[selStage]; KF.Audio.play('cursor'); }
    var ck = pickByClick(rects); if (ck >= 0) { selCursor[selStage] = ck; m.ok = true; }
    if (m.back) { KF.Audio.play('back'); if (selStage === 0) scene = 'title'; else selStage = 0; return; }
    if (m.ok) {
      KF.Audio.play('ok');
      if (selStage === 0) {
        cfg.p1 = KINDS[selCursor[0]];
        if (cfg.mode === 'training') { cfg.p2 = KINDS[selCursor[0]]; startBattle(); return; }
        selStage = 1; selCursor[1] = 1 - selCursor[0];
      }
      else {
        cfg.p2 = KINDS[selCursor[1]];
        if (cfg.mode === 'cpu') { scene = 'level'; sel = LEVELS.indexOf(cfg.level); }
        else startBattle();
      }
    }
  }
  function sceneLevel(m) {
    bg(0.6);
    R.text('CPUの強さ', 320, 40, 20, '#ffffff', 'center', '#7a5cff');
    var rects = drawMenu(LEVELS, 80, sel, 220);
    R.text(LEVEL_DESC[LEVELS[sel]], 320, 220, 11, '#d0d8f8', 'center');
    if (m.up) { sel = (sel + 3) % 4; KF.Audio.play('cursor'); }
    if (m.down) { sel = (sel + 1) % 4; KF.Audio.play('cursor'); }
    var ck = pickByClick(rects); if (ck >= 0) { sel = ck; m.ok = true; }
    if (m.back) { KF.Audio.play('back'); scene = 'title'; return; }
    if (m.ok) { KF.Audio.play('ok'); cfg.level = LEVELS[sel]; startBattle(); }
  }

  // タッチボタンの文字：モダンのときは 弱・中・強・SP・アシスト
  function touchLabels(modern) {
    var L = modern ? { lp: '弱', mp: '中', hp: '強', lk: 'SP', mk: 'アシスト', hk: 'SP' } : { lp: '弱P', mp: '中P', hp: '強P', lk: '弱K', mk: '中K', hk: '強K' };
    Object.keys(L).forEach(function (k) { var el = document.querySelector('#touch [data-b="' + k + '"]'); if (el) el.textContent = L[k]; });
  }
  function startBattle() {
    KF.vsMode = cfg.mode === 'vs';
    sources[0].modern = !!KF.Input.modern[1]; sources[1].modern = cfg.mode === 'vs' && !!KF.Input.modern[2];
    game = new KF.Battle({ p1: cfg.p1, p2: cfg.p2, meta: KF.Assets.meta, training: cfg.mode === 'training', modern: [sources[0].modern, sources[1].modern] });
    touchLabels(sources[0].modern);
    lastEvents = 0;
    sources[1].cpu = null; ai = null;
    if (cfg.mode === 'cpu') { ai = new KF.AI(game, 1, cfg.level, (Date.now() & 0xffff) + 1); sources[1].cpu = ai; }
    if (cfg.mode === 'training') { ai = null; sources[1].cpu = { output: function () { return { x: 0, y: 0, held: {} }; } }; }
    scene = 'battle'; paused = false; keyLog = []; rec = []; recCombo = { s: -1, e: -1 }; recPrevCombo = 0; recOrigin = null; recReset = null;
    R.ann = []; R.superBanner = null;
    KF.Touch && KF.Touch.show(isTouch);
  }

  // トレーニングのスピード（スロー）：100% / 75% / 50% / 25%。遅いときは、何コマかに1回だけ試合を進める
  var TR_SPEEDS = [1, 0.75, 0.5, 0.25], trSpeedI = 0, trAcc = 0;
  function trSpeedLabel() { return 'スピード：' + Math.round(TR_SPEEDS[trSpeedI] * 100) + '%'; }
  var trPend = null;
  function mergePress(a, b) {   // aでためた「押した瞬間」をbに足す（押しっぱなし・方向はbの今の状態）
    if (!a) return b;
    Object.keys(a.pressed || {}).forEach(function (k) { if (a.pressed[k]) { b.pressed[k] = true; b.held[k] = true; } });
    if (a.reset) b.reset = true;
    return b;
  }
  function cycleTrSpeed() { trSpeedI = (trSpeedI + 1) % TR_SPEEDS.length; trAcc = 0; }
  function sceneBattle() {
    var m = null, doStep = true;
    if (cfg.mode === 'training' && !paused && TR_SPEEDS[trSpeedI] < 1) { trAcc += TR_SPEEDS[trSpeedI]; if (trAcc >= 1) trAcc -= 1; else doStep = false; }
    if (!paused && !doStep) {   // スロー中で試合を進めないコマ：押されたボタンはためておき、次に進めるコマで使う
      var s1 = sources[0].sample(), s2 = sources[1].sample();
      trPend = [mergePress(trPend && trPend[0], s1), mergePress(trPend && trPend[1], s2)];
      if (KF.Input.isDown('Escape') && !menuPrev.escB) { paused = true; pausedSel = 0; menuPrev.esc = true; menuPrev.ent = KF.Input.isDown('Enter'); }
      menuPrev.escB = KF.Input.isDown('Escape');
    }
    if (!paused && doStep) {
      if (ai) ai.update();   // CPUの判断を先にして、そのフレームの入力にすぐ使う（1フレームの遅れをなくす）
      var i1 = sources[0].sample(), i2 = sources[1].sample();
      if (trPend) { i1 = mergePress(trPend[0], i1); i2 = mergePress(trPend[1], i2); trPend = null; }
      if (i1.pressed.start || KF.Input.isDown('Escape') && !menuPrev.escB) { paused = true; pausedSel = 0; menuPrev.esc = KF.Input.isDown('Escape'); menuPrev.ent = KF.Input.isDown('Enter'); }
      menuPrev.escB = KF.Input.isDown('Escape');
      // トレーニング：位置リセット（押したときの方向で場所を選ぶ）
      if (cfg.mode === 'training' && i1.reset) {
        var rm = i1.y > 0 ? (i1.x > 0 ? 'sRight' : i1.x < 0 ? 'oLeft' : 'center') : (i1.x > 0 ? 'oRight' : i1.x < 0 ? 'sLeft' : 'center');
        game.resetTraining(rm); recReset = rm;
      }
      if (play && !paused) {   // 貼った入力の再生中は、1Pと2Pの入力を差し替える
        var pf = play.frames[play.i];
        i1 = playInput(pf, play.prev); play.prev = pf;
        i2 = playInput({ d: play.stance === 'crouch' ? 2 : 5, b: play.i === 0 && play.opp ? [play.opp] : [] }, null);
        if (++play.i >= play.frames.length) { play = null; game.noSupRefill = false; game.noRushRefill = false; recToast = { s: '再生おわり', t: 120 }; }
      }
      if (cfg.mode === 'training' && !paused) { recordKeys(i1); recInput(i1); }
      if (!paused) game.step([i1, i2]);
      for (; lastEvents < game.events.length; lastEvents++) handleEvent(game.events[lastEvents]);
      if (game.events.length > 400) { game.events.splice(0, 300); lastEvents -= 300; }
    }
    R.render(game);
    if (cfg.mode === 'training') drawTrainingInfo();
    if (paused) drawPause();
    if (recToast && recToast.t-- > 0) { R.ctx.fillStyle = 'rgba(0,0,10,0.9)'; R.ctx.fillRect(160, 342, 320, 17); R.text(recToast.s, 320, 350, 10, '#7fffb0', 'center'); }
    if (game.phase === 'over' && !paused) { scene = 'result'; resultSel = 0; frameT = 0; KF.Touch && KF.Touch.show(false); }
  }
  function handleEvent(e) {
    if (e.type === 'sfx') KF.Audio.play(e.s);
    else if (e.type === 'announce') R.announce(e);
    else if (e.type === 'super') { }   // 超必殺の技名の帯は出さない
    else if (e.type === 'rushcancel') R.announce({ text: 'RUSH CANCEL', small: 1, side: e.side });
  }
  // 段の色：上段（立ち・しゃがみどちらでもガードできる）／中段（立ちガードのみ）／下段（しゃがみガードのみ）／投げ（ガードできない）
  var DAN_COL = { '上段': '#7fd0ff', '中段': '#ffd23c', '下段': '#ff7a9a', '投げ': '#c890ff' };
  // キーディス：1Pの入力の移り変わりを、新しい順に左に並べる（数字は続いたフレーム数）
  var keyLog = [], KEY_ROWS = 14, keyDisp = true;
  try { keyDisp = localStorage.getItem('kf_keydisp') !== '0'; } catch (e) { }
  function toggleKeyDisp() { keyDisp = !keyDisp; try { localStorage.setItem('kf_keydisp', keyDisp ? '1' : '0'); } catch (e) { } }
  var KEY_NM = { lp: '弱P', mp: '中P', hp: '強P', lk: '弱K', mk: '中K', hk: '強K', rush: 'ラッシュ', l: '弱', m: '中', h: '強', sp: 'SP', auto: 'アシスト' };
  var KEY_COL = { lp: '#7fd0ff', mp: '#ffd23c', hp: '#ff7a5a', lk: '#7fd0ff', mk: '#ffd23c', hk: '#ff7a5a', rush: '#7fffb0', l: '#7fd0ff', m: '#ffd23c', h: '#ff7a5a', sp: '#c890ff', auto: '#7fffb0' };
  var ARROW = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '・', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
  function recordKeys(inp) {
    var fc = game.p[0].facing || 1, rx = (inp.x || 0) * fc, ry = inp.y || 0;
    var dir = 5 + (rx > 0 ? 1 : rx < 0 ? -1 : 0) + (ry > 0 ? -3 : ry < 0 ? 3 : 0);
    var H = inp.held || {}, P = inp.pressed || {};
    var btn = Object.keys(KEY_NM).filter(function (k) { return H[k]; });
    var fresh = Object.keys(KEY_NM).filter(function (k) { return P[k]; });
    var top = keyLog[0], sig = dir + ':' + btn.join(',');
    if (top && top.sig === sig && !fresh.length) { top.n++; return; }
    keyLog.unshift({ sig: sig, dir: dir, btn: btn, fresh: fresh, n: 1 });
    if (keyLog.length > KEY_ROWS) keyLog.length = KEY_ROWS;
  }
  // 入力の記録：トレモ中の1Pの入力を毎フレーム残し、最後のコンボの分を文字にしてコピーできるようにする
  //   形式：KFREC1|1Pのx,2Pのx,1Pの向き,1PのEX/RUSH,1Pの超必殺ゲージ,1Pのキャラ,2Pのキャラ|「方向(テンキー)+ボタン x 続いたフレーム数」を空白区切り
  //   位置リセットしてから始めたコンボは、リセットした瞬間から記録する（KFREC2：リセットのしかた,1Pのキャラ,2Pのキャラ|入力）。こちらで完全に同じ状態から再生できる
  var rec = [], REC_MAX = 18000, recCombo = { s: -1, e: -1 }, recPrevCombo = 0, recToast = null, recReset = null, recOrigin = null;
  function recInput(inp) {
    var b = game, p0 = b.p[0], p1 = b.p[1];
    if (recReset) { rec = []; recCombo = { s: -1, e: -1 }; recPrevCombo = 0; recOrigin = { mode: recReset, k0: p0.kind, k1: p1.kind }; recReset = null; }
    var dir = 5 + (inp.x > 0 ? 1 : inp.x < 0 ? -1 : 0) + (inp.y > 0 ? -3 : inp.y < 0 ? 3 : 0);
    var H = inp.held || {}, btn = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'rush', 'l', 'm', 'h', 'sp', 'auto'].filter(function (k) { return H[k]; }).join('+');
    rec.push({ d: dir, b: btn, st: [Math.round(p0.x * 10) / 10, Math.round(p1.x * 10) / 10, p0.facing, p0.rush, p0.sup, p0.kind, p1.kind] });
    if (rec.length > REC_MAX) { rec.shift(); recCombo.s--; recCombo.e--; recOrigin = null; }
    var c = p1.combo;
    if (c > 0 && recPrevCombo === 0) { recCombo.s = rec.length - 1; recCombo.e = -1; }
    if (c === 0 && recPrevCombo > 0) recCombo.e = rec.length - 1;
    recPrevCombo = c;
  }
  function recText() {
    if (recCombo.s < 0) return null;
    var a = recOrigin ? 0 : Math.max(0, recCombo.s - 120), z = recCombo.e >= 0 ? Math.min(rec.length, recCombo.e + 20) : rec.length;
    var out = [], cur = null, n = 0;
    for (var i = a; i < z; i++) {
      var t = rec[i].d + (rec[i].b ? rec[i].b : '');
      if (t === cur) n++; else { if (cur !== null) out.push(cur + 'x' + n); cur = t; n = 1; }
    }
    if (cur !== null) out.push(cur + 'x' + n);
    if (recOrigin) return 'KFREC2|' + [recOrigin.mode, recOrigin.k0, recOrigin.k1].join(',') + '|' + out.join(' ');
    return 'KFREC1|' + rec[a].st.join(',') + '|' + out.join(' ');
  }
  function copyRec() {
    var t = recText();
    if (!t) { recToast = { s: 'まだコンボの記録がありません', t: 120 }; return; }
    var done = function () { recToast = { s: t.indexOf('KFREC2') === 0 ? '入力をコピーしました（位置リセットから）' : '入力をコピーしました（位置リセットしてからやると正確に再生できます）', t: 180 }; };
    var fall = function () { window.prompt('この文字をコピーして送ってください', t); done(); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fall); else fall(); } catch (e) { fall(); }
  }
  // 貼った入力（KFREC2）を、位置リセットしたところから1Pの入力として流す（コンボ探しの結果を画面で確かめる用）
  //   KFREC2|リセットのしかた,1Pのキャラ,2Pのキャラ[,ラッシュの本数,SAの本数,stand/crouch,2Pが振る技]|入力
  var play = null;
  function startPlay(t) {
    var m = /^KFREC2\|([^|]*)\|(.*)$/.exec((t || '').trim());
    if (!m) { recToast = { s: '貼った文字が KFREC2 の形ではありません', t: 180 }; return; }
    var h = m[1].split(','), frames = [];
    if (h[1] !== game.p[0].kind || h[2] !== game.p[1].kind) { recToast = { s: 'キャラが違います（' + h[1] + ' 対 ' + h[2] + ' で記録）', t: 180 }; return; }
    m[2].split(' ').forEach(function (tok) { var q = /^(\d)([a-z+]*)x(\d+)$/.exec(tok); if (!q) return; for (var k = 0; k < +q[3]; k++) frames.push({ d: +q[1], b: q[2] ? q[2].split('+') : [] }); });
    game.resetTraining(h[0] || 'center'); recReset = h[0] || 'center';
    var C = KF.CONST, p0 = game.p[0];
    game.noRushRefill = h[3] !== undefined && h[3] !== '';   // ラッシュの本数を決めたときは、トレモの自動回復を止める
    if (game.noRushRefill) p0.rush = Math.min(C.RUSH_MAX, +h[3] * C.RUSH_MAX / 6);
    game.noSupRefill = h[4] !== undefined && h[4] !== '';
    if (game.noSupRefill) p0.sup = +h[4] * 1000;
    play = { frames: frames, i: 0, prev: null, stance: h[5] || 'stand', opp: h[6] || '' };
    paused = false;
  }
  function pasteRec() {
    var fall = function () { var t = window.prompt('KFREC2 の文字を貼り付けてください', ''); if (t) startPlay(t); };
    try { if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (/^KFREC2/.test((t || '').trim())) startPlay(t); else fall(); }, fall); else fall(); } catch (e) { fall(); }
  }
  function playInput(fr, prev) {
    var X = [0, -1, 0, 1, -1, 0, 1, -1, 0, 1], Y = [0, 1, 1, 1, 0, 0, 0, -1, -1, -1], held = {}, pressed = {};
    fr.b.forEach(function (k) { held[k] = true; if (!prev || prev.b.indexOf(k) < 0) pressed[k] = true; });
    return { x: X[fr.d], y: Y[fr.d], held: held, pressed: pressed };
  }
  function drawKeyDisplay(y0) {
    var c = R.ctx, rowH = 15, h = KEY_ROWS * rowH + 6;
    c.fillStyle = 'rgba(0,0,10,0.5)'; c.fillRect(4, y0, 132, h);
    keyLog.forEach(function (e, i) {
      var y = y0 + 10 + i * rowH, a = i === 0 ? '#ffffff' : '#c8d0f0';
      R.text(String(Math.min(e.n, 99)), 24, y, 9, '#8890b0', 'right');
      R.text(ARROW[e.dir], 38, y, 11, e.dir === 5 ? '#606880' : a, 'center');
      var x = 52;
      e.btn.forEach(function (k) {
        var on = e.fresh.indexOf(k) >= 0;
        R.text(KEY_NM[k], x, y, 9, on ? KEY_COL[k] : '#707890', 'left');
        x += KEY_NM[k].length * 9 + 5;
      });
    });
  }
  function drawTrainingInfo() {
    var f = game.p[0], c = R.ctx;
    var info = f.lastMoveInfo, y0 = document.body.classList.contains('touchmode') ? 84 : 56;
    c.fillStyle = 'rgba(0,0,10,0.6)'; c.fillRect(4, y0, 386, 44);
    R.text('トレーニング（位置リセット：R / パッドBACK、→←↘↙で画面端　当たり判定：F2　キーディス：F3　スピード：F4）', 8, y0 + 8, 8, '#a0ffd0', 'left');
    var NN = { lp: '弱P', mp: '中P', hp: '強P', lk: '弱K', mk: '中K', hk: '強K', throw: '投げ' };
    var nmOf = function (id) { var mv = KF.CHARS[game.p[0].kind].moves[id]; if (mv && mv.name && mv.name !== 'ターゲットコンボ') return mv.name; var b = id.replace(/^(c_|j_|tc_|f_|b_)/, ''); var pre = { c_: 'しゃがみ', j_: 'ジャンプ', tc_: 'ターゲットコンボ ', f_: '→', b_: '←' }[(id.match(/^(c_|j_|tc_|f_|b_)/) || [''])[0]] || ''; return pre + (NN[b] || id); };
    if (info) {
      var imv = KF.CHARS[game.p[0].kind].moves[info.id] || {};
      var dan = imv.type === 't' ? '投げ' : imv.lv === 'l' ? '下段' : imv.lv === 'o' ? '中段' : imv.lv === 'm' ? '上段' : '';
      R.text('技 ' + nmOf(info.id) + '  発生 ' + info.startup + 'F  全体 ' + info.total + 'F', 8, y0 + 22, 9, '#ffffff', 'left');
      if (dan) R.text(dan, 326, y0 + 22, 10, DAN_COL[dan], 'right');
    }
    var adv = KF._lastAdv;
    if (adv === 'ダウン') R.text('硬直差 ダウンを奪った（起き攻めできる）', 8, y0 + 36, 9, '#7fffb0', 'left');
    else if (adv != null) R.text('硬直差 ' + (adv > 0 ? '+' : '') + adv + 'F', 8, y0 + 36, 9, adv >= 0 ? '#7fffb0' : '#ff8080', 'left');
    if (TR_SPEEDS[trSpeedI] < 1) R.text('スロー ' + Math.round(TR_SPEEDS[trSpeedI] * 100) + '%', 386, y0 + 36, 10, '#ffd23c', 'right');
    if (keyDisp) drawKeyDisplay(y0 + 48);
  }

  // ------------------------------------------------------------ オンライン対戦
  var net = null, rb = null;
  var onl = { sel: 0, stage: 'menu', match: 0, want: [false, false], escT: 0, resSel: 0, left: false, kinds: ['kokuu', 'kokuu'] };
  // オンラインで使うキャラ（部屋に入る前に選ぶ。次に開いたときも同じキャラ）
  try { KF.onlineKind = localStorage.getItem('kf_online_kind') || 'kokuu'; } catch (e) { KF.onlineKind = 'kokuu'; }
  if (!KF.CHARS[KF.onlineKind]) KF.onlineKind = 'kokuu';
  KF.onlineKind = 'kokuu';
  function validKind(k) { return 'kokuu'; }
  var ONLINE_ITEMS = ['部屋を作る', '部屋に入る（合言葉を入れる）', '戻る'];
  var ui = null;
  // 合言葉の入力欄・招待リンクのコピーボタン（文字入力はHTMLの部品で行う）
  function netUI(mode) {
    if (!ui) {
      ui = document.createElement('div');
      ui.style.cssText = 'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);z-index:6;display:none;gap:8px;align-items:center;font-family:inherit';
      ui.innerHTML = '<input id="netcode" maxlength="8" placeholder="合言葉" autocomplete="off" style="font:900 22px Noto Sans JP,sans-serif;width:150px;text-align:center;text-transform:uppercase;padding:6px;border-radius:8px;border:2px solid #38d6ff;background:#08081a;color:#fff">' +
        '<button id="netgo" style="font:900 16px Noto Sans JP,sans-serif;padding:9px 16px;border-radius:8px;border:0;background:#38d6ff;color:#001">つなぐ</button>' +
        '<button id="netcopy" style="font:900 15px Noto Sans JP,sans-serif;padding:9px 16px;border-radius:8px;border:0;background:#ffd23c;color:#201600">招待リンクをコピー</button>';
      document.body.appendChild(ui);
      var go = function () { var v = document.getElementById('netcode').value; if (v.trim()) { document.getElementById('netcode').blur(); onlineJoin(v); } };
      document.getElementById('netgo').onclick = go;
      document.getElementById('netcode').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); if (e.key === 'Escape') { e.target.blur(); netUI(null); onl.stage = 'menu'; } e.stopPropagation(); });
      document.getElementById('netcopy').onclick = function () {
        var url = net.inviteURL(), b = document.getElementById('netcopy');
        var done = function () { b.textContent = 'コピーしました'; setTimeout(function () { b.textContent = '招待リンクをコピー'; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt('このリンクを相手に送ってください', url); });
        else prompt('このリンクを相手に送ってください', url);
      };
    }
    ui.style.display = mode ? 'flex' : 'none';
    document.getElementById('netcode').style.display = mode === 'join' ? '' : 'none';
    document.getElementById('netgo').style.display = mode === 'join' ? '' : 'none';
    document.getElementById('netcopy').style.display = mode === 'host' ? '' : 'none';
    if (mode === 'join') setTimeout(function () { document.getElementById('netcode').focus(); }, 50);
  }
  window.addEventListener('pagehide', function () { if (net) net.send({ t: 'bye' }); });
  // ---------------------------------------------------------- アプリとして追加（PC・スマホのホーム画面）
  var installEvt = null, installBtn = null;
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    try { navigator.serviceWorker.register('sw.js').catch(function () { }); } catch (e) { }
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  window.addEventListener('appinstalled', function () { installEvt = null; if (installBtn) installBtn.style.display = 'none'; KF.padNotice = { text: 'アプリとして追加しました', t: 240 }; });
  function showInstall(on) {
    if (!installBtn) {
      installBtn = document.createElement('button');
      installBtn.textContent = 'アプリとして追加';
      installBtn.style.cssText = 'position:fixed;right:12px;top:12px;z-index:6;font:900 14px "Noto Sans JP",sans-serif;padding:8px 14px;border-radius:8px;border:2px solid #38d6ff;background:rgba(8,8,26,.85);color:#fff;cursor:pointer;display:none';
      installBtn.onclick = function () {
        if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; installBtn.style.display = 'none'; }); }
      };
      document.body.appendChild(installBtn);
    }
    var standalone = window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches);
    installBtn.style.display = on && installEvt && !standalone ? 'block' : 'none';
  }
  // ---------------------------------------------------------- 戻るボタン（スマホ・アプリでは Esc や弱Kが押せない画面があるため）
  var backBtn = null, quitBtn = null, quitArm = 0;
  var standaloneApp = window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches);
  function navButtons() {
    var want = isTouch || standaloneApp;
    if (!backBtn) {
      backBtn = document.createElement('button'); backBtn.textContent = '◀ 戻る';
      backBtn.style.cssText = 'position:fixed;left:10px;top:10px;z-index:7;font:900 15px "Noto Sans JP",sans-serif;padding:8px 14px;border-radius:8px;border:2px solid #7a7ab0;background:rgba(8,8,26,.85);color:#fff;display:none';
      backBtn.addEventListener('click', function () { KF._tapBack = true; });
      document.body.appendChild(backBtn);
      quitBtn = document.createElement('button'); quitBtn.textContent = '対戦をやめる';
      quitBtn.style.cssText = 'position:fixed;right:10px;top:10px;z-index:7;font:900 13px "Noto Sans JP",sans-serif;padding:6px 12px;border-radius:8px;border:2px solid #ff6b8a;background:rgba(8,8,26,.75);color:#fff;display:none';
      quitBtn.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      quitBtn.addEventListener('click', function () {
        if (quitArm > 0) { quitArm = 0; leaveOnline(); return; }
        quitArm = 120; quitBtn.textContent = 'もう一度押すとやめる';
      });
      document.body.appendChild(quitBtn);
    }
    var backScenes = { level: 1, keys: 1, online: 1, moves: 1, select: 1 };
    backBtn.style.display = want && backScenes[scene] && !(KF.Touch && KF.Touch.editing) ? 'block' : 'none';
    quitBtn.style.display = want && scene === 'onlineBattle' ? 'block' : 'none';
    if (quitArm > 0 && --quitArm === 0) quitBtn.textContent = '対戦をやめる';
  }
  function goOnline() { scene = 'online'; onl.stage = 'menu'; onl.sel = 0; netUI(null); }
  function newSession() {
    if (net) net.close();
    net = new KF.NetSession();
    net.on(onNetMessage);
    return net;
  }
  function onlineHost() { newSession().host(); onl.stage = 'host'; netUI('host'); }
  function onlineJoin(code) { newSession().join(code); onl.stage = 'join'; netUI(null); }
  function leaveOnline() {
    if (net) { net.send({ t: 'bye' }); var n = net; setTimeout(function () { n.close(); }, 200); }
    net = null; rb = null; netUI(null); scene = 'title'; KF.Touch && KF.Touch.show(false);
  }
  // 回線の速さに合わせて、入力を何フレーム遅らせるか決める（遅らせるほど巻き戻しが減る）
  // 片道にかかるフレーム数から2フレーム引いた分だけ遅らせ、残りは巻き戻しで埋める（0〜3F）
  function delayFor(rtt) { if (rtt == null) return 1; return Math.max(0, Math.min(3, Math.ceil(rtt / 2 / (1000 / 60)) - 2)); }
  function onNetMessage(m) {
    if (m.t === '_status') {
      if (net.status === 'closed' && (scene === 'onlineBattle' || scene === 'onlineResult')) onl.left = true;
      return;
    }
    if (m.t === 'hello' && net.isHost && !rb) {
      // 回線の速さを少し測ってから始める
      onl.peerModern = !!m.modern; onl.peerKind = validKind(m.kind);
      setTimeout(function () { if (!net || rb) return; var d = delayFor(net.rtt); var md = [!!KF.Input.modern[1], onl.peerModern]; var ks = [KF.onlineKind, onl.peerKind]; net.send({ t: 'start', g: 1, d: d, modern: md, kinds: ks }); startOnlineMatch(1, d, md, ks); }, 1500);
      return;
    }
    if (m.t === 'start') { startOnlineMatch(m.g, m.d, m.modern, m.kinds); return; }
    if ((m.t === 'in' || m.t === 'hash') && rb && m.g === onl.match) { rb.receive(m); return; }
    if (m.t === 'rematch') { onl.want[1 - net.side] = true; checkRematch(); return; }
    if (m.t === 'bye') { onl.left = true; return; }
  }
  function startOnlineMatch(g, d, md, ks) {
    md = md || [false, false]; onl.modern = md;
    ks = ks && ks.length === 2 ? [validKind(ks[0]), validKind(ks[1])] : ['kokuu', 'kokuu']; onl.kinds = ks;
    sources[0].modern = !!md[net.side]; touchLabels(sources[0].modern);
    onl.match = g; onl.want = [false, false]; onl.left = false; onl.escT = 0; onl.resSel = 0; onl.delay = d;
    rb = new KF.Rollback({
      side: net.side, delay: d, maxRollback: 10,
      makeBattle: function () { return new KF.Battle({ p1: ks[0], p2: ks[1], meta: KF.Assets.meta, modern: md }); },
      send: function (msg) { msg.g = g; net.send(msg); },
      onEvent: handleEvent,
    });
    game = rb.battle; cfg.mode = 'online'; ai = null; paused = false;
    R.ann = []; R.superBanner = null;
    netUI(null); scene = 'onlineBattle';
    KF.Touch && KF.Touch.show(isTouch);
  }
  function checkRematch() {
    if (net && net.isHost && onl.want[0] && onl.want[1]) { var g = onl.match + 1, d = delayFor(net.rtt), md = onl.modern, ks = onl.kinds; net.send({ t: 'start', g: g, d: d, modern: md, kinds: ks }); startOnlineMatch(g, d, md, ks); }
  }
  function sceneOnline(m) {
    bg(0.6);
    R.text('オンライン対戦', 320, 34, 22, '#ffffff', 'center', '#00d8ff');
    if (onl.stage === 'menu') {
      R.text('同じ合言葉の部屋に入った2人で対戦します', 320, 64, 11, '#c0c8e8', 'center');
      var rects = drawMenu(ONLINE_ITEMS, 100, onl.sel, 300);
      if (m.up) { onl.sel = (onl.sel + 2) % 3; KF.Audio.play('cursor'); }
      if (m.down) { onl.sel = (onl.sel + 1) % 3; KF.Audio.play('cursor'); }
      var ck = pickByClick(rects); if (ck >= 0) { onl.sel = ck; m.ok = true; }
      if (m.back) { KF.Audio.play('back'); scene = 'title'; return; }
      if (m.ok) {
        KF.Audio.play('ok');
        if (onl.sel === 0) onlineHost();
        else if (onl.sel === 1) { onl.stage = 'code'; netUI('join'); }
        else scene = 'title';
      }
      return;
    }
    if (onl.stage === 'code') {
      R.text('相手から聞いた合言葉（5文字）を入れて「つなぐ」', 320, 120, 13, '#ffffff', 'center');
      R.text('Esc：戻る', 320, 346, 9, '#8890b0', 'center');
      if (m.back) { netUI(null); onl.stage = 'menu'; }
      return;
    }
    // 部屋を作った・入ろうとしている
    var st = net ? net.status : 'idle';
    if (onl.stage === 'host' && net && net.code && st !== 'error') {
      R.text('合言葉', 320, 86, 12, '#c0c8e8', 'center');
      R.text(net.code, 320, 128, 44, '#ffffff', 'center', '#00d8ff');
      R.text('この合言葉か、招待リンクを相手に送ってください', 320, 170, 11, '#c0c8e8', 'center');
    }
    var col = st === 'error' || st === 'closed' ? '#ff8080' : '#7fffb0';
    R.text((net && net.msg) || '', 320, 206, 13, col, 'center');
    if (st === 'connected') R.text('まもなく対戦が始まります…', 320, 228, 11, '#ffffff', 'center');
    R.text('弱K / Esc：やめる', 320, 346, 9, '#8890b0', 'center');
    if (m.back) { KF.Audio.play('back'); if (net) net.close(); net = null; netUI(null); onl.stage = 'menu'; }
  }
  function sceneOnlineBattle() {
    var s = sources[0].sample();
    // Escを1.5秒以内に2回押したら対戦をやめる
    if (KF.Input.isDown('Escape') && !menuPrev.escO) { if (onl.escT > 0) { leaveOnline(); return; } onl.escT = 90; }
    menuPrev.escO = KF.Input.isDown('Escape');
    if (onl.escT > 0) onl.escT--;
    if (!onl.left) { rb.tick(s); game = rb.battle; }
    // 相手から6秒なにも届かなければ、切れたとみなす
    if (!onl.left && rb.lastRecvAt && performance.now() - rb.lastRecvAt > 6000) onl.left = true;
    R.render(game);
    var c = R.ctx, me = net ? net.side : 0;
    // 自分の側の表示
    R.text('あなた', me === 0 ? 24 : 616, 66, 10, '#ffe14a', me === 0 ? 'left' : 'right', '#ff8a00');
    var pr = net && net.rtt != null ? Math.round(net.rtt) + 'ms' : '--';
    R.text('ping ' + pr + '  入力遅延 ' + onl.delay + 'F' + (rb.maxRolled ? '  巻き戻し最大 ' + rb.maxRolled + 'F' : ''), 320, 356, 8, '#8890b0', 'center');
    if (onl.escT > 0) R.text('もう一度 Esc で対戦をやめます', 320, 160, 12, '#ffffff', 'center', '#ff3fe6');
    if (rb.desync) R.text('同期ずれが起きました（' + rb.desync.f + 'F）', 320, 92, 10, '#ff8080', 'center');
    if (onl.left) {
      c.fillStyle = 'rgba(0,0,10,0.7)'; c.fillRect(0, 140, 640, 60);
      R.text('相手との接続が切れました', 320, 162, 16, '#ff8080', 'center');
      R.text('弱K / Esc：タイトルへ', 320, 186, 10, '#ffffff', 'center');
      if (s.pressed.lk || KF.Input.isDown('Escape') || clickPos) leaveOnline();
      return;
    }
    if (game.phase === 'over') { scene = 'onlineResult'; frameT = 0; KF.Touch && KF.Touch.show(false); }
  }
  function sceneOnlineResult(m) {
    bg(0.5);
    var w = game.matchOver ? game.matchOver.winner : -1, me = net ? net.side : 0;
    if (w === -1) R.text('DRAW', 320, 70, 40, '#ffffff', 'center', '#7a5cff');
    else {
      drawFighterBig(game.p[w].kind, 'win', 200, 320, 1.35, 1, frameT, game.p[w].alt);
      R.text(w === me ? 'YOU WIN' : 'YOU LOSE', 430, 70, 34, '#ffffff', 'center', game.p[w].color || KF.CHARS.kokuu.color);
      R.text('ラウンド ' + game.wins[me] + ' - ' + game.wins[1 - me], 430, 110, 12, '#c0c8e8', 'center');
    }
    var c = R.ctx, items = ['もう一戦', 'やめる'];
    var rects = items.map(function (it, i) {
      var y = 170 + i * 30, x = 330, on = i === onl.resSel;
      c.fillStyle = on ? 'rgba(0,220,255,0.18)' : 'rgba(10,10,30,0.6)'; c.fillRect(x, y, 200, 24);
      c.strokeStyle = on ? '#38d6ff' : '#3a3a6a'; c.strokeRect(x + 0.5, y + 0.5, 199, 23);
      R.text(it, x + 100, y + 12, 13, on ? '#fff' : '#a0a8c8', 'center');
      return [x, y, 200, 24];
    });
    if (onl.left) R.text('相手は退出しました', 430, 246, 11, '#ff8080', 'center');
    else if (onl.want[me]) R.text(onl.want[1 - me] ? 'まもなく始まります…' : '相手の返事を待っています…', 430, 246, 11, '#7fffb0', 'center');
    else if (onl.want[1 - me]) R.text('相手は「もう一戦」を選びました', 430, 246, 11, '#ffe14a', 'center');
    if (m.up || m.down) onl.resSel = 1 - onl.resSel;
    var ck = pickByClick(rects); if (ck >= 0) { onl.resSel = ck; m.ok = true; }
    if (m.ok) {
      KF.Audio.play('ok');
      if (onl.resSel === 0 && !onl.left) { onl.want[me] = true; net.send({ t: 'rematch' }); checkRematch(); }
      else leaveOnline();
    }
  }

  var PAUSE_BASE = ['再開', '技表', '当たり判定 表示切替', 'やり直す', 'タイトルへ'];
  var PAUSE_TR = ['位置リセット：中央', '位置リセット：相手を画面端へ', '位置リセット：自分が画面端', 'キーディス 表示切替', 'スピード', '入力をコピー（最後のコンボ）', '入力を貼って再生'];
  var PAUSE_ITEMS = PAUSE_BASE;
  function drawPause() {
    PAUSE_ITEMS = cfg.mode === 'training' ? [PAUSE_BASE[0]].concat(PAUSE_TR.slice(0, 4), [trSpeedLabel(), PAUSE_TR[5], PAUSE_TR[6]], PAUSE_BASE.slice(1)) : PAUSE_BASE;
    var c = R.ctx;
    c.fillStyle = 'rgba(0,0,10,0.7)'; c.fillRect(0, 0, 640, 360);
    R.text('PAUSE', 320, 70, 28, '#ffffff', 'center', '#7a5cff');
    var rects = drawMenu(PAUSE_ITEMS, PAUSE_ITEMS.length > 10 ? 90 : PAUSE_ITEMS.length > 8 ? 92 : PAUSE_ITEMS.length > 6 ? 96 : 110, pausedSel, 260);
    var m = menuInput();
    if (m.up) pausedSel = (pausedSel + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length;
    if (m.down) pausedSel = (pausedSel + 1) % PAUSE_ITEMS.length;
    var ck = pickByClick(rects); if (ck >= 0) { pausedSel = ck; m.ok = true; }
    if (m.back) { paused = false; return; }
    if (m.ok) {
      var it = PAUSE_ITEMS[pausedSel];
      if (it === '再開') paused = false;
      else if (it === '技表') { scene = 'moves'; moveListFor = game.p[0].kind; paused = true; }
      else if (it === '当たり判定 表示切替') { R.debug = !R.debug; paused = false; }
      else if (it === 'やり直す') { paused = false; startBattle(); }
      else if (it === PAUSE_TR[0]) { game.resetTraining('center'); recReset = 'center'; paused = false; }
      else if (it === PAUSE_TR[1]) { game.resetTraining('oRight'); recReset = 'oRight'; paused = false; }
      else if (it === PAUSE_TR[2]) { game.resetTraining('sLeft'); recReset = 'sLeft'; paused = false; }
      else if (it === PAUSE_TR[3]) { toggleKeyDisp(); paused = false; }
      else if (it.indexOf('スピード') === 0) { cycleTrSpeed(); }
      else if (it === PAUSE_TR[5]) { copyRec(); }
      else if (it === PAUSE_TR[6]) { pasteRec(); }   // メニューは開いたまま（何度か押して選ぶ）
      else { KF.Touch && KF.Touch.show(false); scene = 'title'; }
    }
  }
  var RES_ITEMS = ['再戦する', 'タイトルへ'];
  function sceneResult(m) {
    bg(0.5);
    var w = game.matchOver.winner;
    if (w === -1) R.text('DRAW', 320, 70, 40, '#ffffff', 'center', '#7a5cff');
    else {
      var wk = game.p[w].kind, wcol = game.p[w].color || KF.CHARS[wk].color;
      drawFighterBig(wk, 'win', 200, 320, 1.35, 1, frameT, game.p[w].alt);
      var label = cfg.mode === 'cpu' ? (w === 0 ? 'YOU WIN' : 'YOU LOSE') : (w === 0 ? '1P WIN' : '2P WIN');
      R.text(label, 430, 70, 34, '#ffffff', 'center', wcol);
      R.text(KF.CHARS[wk].name + ' の勝利', 430, 104, 13, '#ffffff', 'center');
      R.text('ラウンド ' + game.wins[0] + ' - ' + game.wins[1], 430, 126, 11, '#c0c8e8', 'center');
    }
    var c = R.ctx;
    var rects = RES_ITEMS.map(function (it, i) {
      var y = 170 + i * 30, x = 330, on = i === resultSel;
      c.fillStyle = on ? 'rgba(0,220,255,0.18)' : 'rgba(10,10,30,0.6)'; c.fillRect(x, y, 200, 24);
      c.strokeStyle = on ? '#38d6ff' : '#3a3a6a'; c.strokeRect(x + 0.5, y + 0.5, 199, 23);
      R.text(it, x + 100, y + 12, 13, on ? '#fff' : '#a0a8c8', 'center');
      return [x, y, 200, 24];
    });
    if (m.up) resultSel = (resultSel + 1) % 2;
    if (m.down) resultSel = (resultSel + 1) % 2;
    var ck = pickByClick(rects); if (ck >= 0) { resultSel = ck; m.ok = true; }
    if (m.ok && frameT > 30) {
      KF.Audio.play('ok');
      if (resultSel === 0) startBattle();
      else scene = 'title';
    }
  }
  function sceneMoves(m) {
    bg(0.75);
    // 技表のページ：道着キャラ男／変身キャラ男（ハンマー形態）／変身キャラ男（大盾形態）。←→・タップで切り替え
    var PAGES = ['kokuu'];
    moveListFor = 'kokuu';
    var pi = PAGES.indexOf(moveListFor);
    var k = moveListFor, D = KF.CHARS[k];
    R.text('技表：' + D.name + (D.form ? '（' + D.form + '）' : ''), 320, 24, 16, '#ffffff', 'center', D.color);
    KF.MOVE_LIST[k].forEach(function (row, i) {
      R.text(row[0], 30, 54 + i * 21, 10, '#ffffff', 'left', D.color);
      R.text(row[1], 400, 54 + i * 21, 9, '#c8d0f0', 'left');
    });
    R.text('弱K / Esc：戻る', 320, 346, 9, '#8890b0', 'center');
    if (m.right || clickPos) { moveListFor = PAGES[(pi + 1) % PAGES.length]; clickPos = null; }
    if (m.left) moveListFor = PAGES[(pi + PAGES.length - 1) % PAGES.length];
    if (m.back) { scene = game && paused ? 'battle' : 'title'; }
  }
  var KEY_ACTIONS = ['up', 'down', 'left', 'right', 'lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'rush', 'start'];
  var KEY_NAMES_M = { lp: '弱', mp: '中', hp: '強', lk: 'SP（必殺技）', mk: 'アシスト', hk: 'SP（必殺技）' };
  var KEY_NAMES = { up: '上', down: '下', left: '左', right: '右', lp: '弱パンチ', mp: '中パンチ', hp: '強パンチ', lk: '弱キック', mk: '中キック', hk: '強キック', rush: 'パリィ', start: 'ポーズ', reset: '位置リセット' };
  var keyListener = null;
  var PAD_ACTIONS = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'rush', 'start', 'reset'];
  function scenePad(m) {
    R.text('ゲームパッド / レバーレスの設定', 320, 22, 16, '#ffffff', 'center', '#7a5cff');
    var ps = KF.Input.pads();
    if (KF.padBlocked) R.text('このページの表示方法ではブラウザがコントローラーの読み取りを止めています。下の説明を見てください', 320, 300, 9, '#ff8080', 'center');
    R.text(ps.length ? ('接続中：' + ps.map(function (p) { return (p.id || 'パッド').slice(0, 34); }).join(' / ')) : 'コントローラーが見つかりません（つないでから何かボタンを押してください）', 320, 42, 9, ps.length ? '#7fffb0' : '#ff8080', 'center');
    var map = KF.Input.padMap(), rects = [];
    PAD_ACTIONS.forEach(function (a, i) {
      var col = i < 5 ? 0 : 1, row = i % 5, x = 70 + col * 260, y = 60 + row * 44;
      var on = keyEdit.i === i;
      R.ctx.fillStyle = on ? 'rgba(0,220,255,0.18)' : 'rgba(10,10,30,0.6)'; R.ctx.fillRect(x, y, 240, 34);
      R.ctx.strokeStyle = on ? '#38d6ff' : '#3a3a6a'; R.ctx.strokeRect(x + 0.5, y + 0.5, 239, 33);
      R.text(KEY_NAMES[a], x + 12, y + 17, 11, '#ffffff', 'left');
      R.text(keyEdit.wait && on ? 'ボタンを押してください…' : 'ボタン ' + map[a], x + 228, y + 17, 11, on ? '#ffe14a' : '#a0a8c8', 'right');
      rects.push([x, y, 240, 34]);
    });
    drawPadStatus(300);
    // 押されているボタンの表示（確認用）
    var pp = KF.Input.padPressed();
    R.text(pp ? (pp.btn != null ? '押されているボタン：' + pp.btn : '方向キー（ハット）入力中') : '　', 320, 256, 10, '#ffe14a', 'center');
    R.text('方向は 十字キー・左スティック・ハット(POV) のどれでも使えます。左右同時押しはニュートラル', 320, 278, 9, '#c0c8e8', 'center');
    R.text('↑↓←→：選ぶ　弱P：変更　弱K：戻る　R：初期設定に戻す　Tab：キーボード設定へ', 320, 330, 9, '#8890b0', 'center');
    if (keyEdit.wait) {
      var now = KF.Input.padPressed();
      if (keyEdit.release) { if (!now) keyEdit.release = false; return; }
      if (now && now.btn != null) { KF.Input.setPad(PAD_ACTIONS[keyEdit.i], now.btn); keyEdit.wait = false; keyEdit.release = true; menuPrev = {}; }
      if (KF.Input.isDown('Escape')) keyEdit.wait = false;
      return;
    }
    if (keyEdit.release) { if (!KF.Input.padPressed()) keyEdit.release = false; else return; }
    if (m.up) keyEdit.i = (keyEdit.i + PAD_ACTIONS.length - 1) % PAD_ACTIONS.length;
    if (m.down) keyEdit.i = (keyEdit.i + 1) % PAD_ACTIONS.length;
    if (m.left || m.right) keyEdit.i = (keyEdit.i + 5) % PAD_ACTIONS.length;
    if (KF.Input.isDown('KeyR') && !menuPrev.kr) KF.Input.resetPad();
    menuPrev.kr = KF.Input.isDown('KeyR');
    var ck = pickByClick(rects); if (ck >= 0) { keyEdit.i = ck; m.ok = true; }
    if (m.back) { scene = 'title'; return; }
    if (m.ok) { keyEdit.wait = true; keyEdit.release = true; }
  }
  function sceneKeys(m) {
    bg(0.8);
    if (KF.Input.isDown('Tab') && !menuPrev.tab) { keyEdit.p = keyEdit.p === 'pad' ? 1 : 'pad'; keyEdit.i = 0; }
    menuPrev.tab = KF.Input.isDown('Tab');
    if (keyEdit.p === 'pad') { scenePad(m); return; }
    R.text('操作設定（キー割り当て）', 320, 22, 16, '#ffffff', 'center', '#7a5cff');
    R.text(keyEdit.p + 'P の設定　←→：1P/2P切替　弱P：変更　弱K：戻る　R：初期化　Tab：ゲームパッド設定へ', 320, 42, 9, '#c0c8e8', 'center');
    var keys = KF.Input.keys[keyEdit.p];
    var rects = [];
    KEY_ACTIONS.forEach(function (a, i) {
      var col = i < 6 ? 0 : 1, row = i % 6, x = 70 + col * 260, y = 64 + row * 40;
      var on = keyEdit.i === i;
      R.ctx.fillStyle = on ? 'rgba(0,220,255,0.18)' : 'rgba(10,10,30,0.6)'; R.ctx.fillRect(x, y, 240, 30);
      R.ctx.strokeStyle = on ? '#38d6ff' : '#3a3a6a'; R.ctx.strokeRect(x + 0.5, y + 0.5, 239, 29);
      R.text((KF.Input.modern[keyEdit.p] && KEY_NAMES_M[a]) || KEY_NAMES[a], x + 12, y + 15, 11, '#ffffff', 'left');
      R.text(keyEdit.wait && on ? 'キーを押してください…' : keys[a].replace(/^Key/, '').replace(/^Digit/, ''), x + 228, y + 15, 11, on ? '#ffe14a' : '#a0a8c8', 'right');
      rects.push([x, y, 240, 30]);
    });
    // 操作タイプ（クラシック／モダン）
    var md = KF.Input.modern[keyEdit.p], mrect = isTouch ? [50, 296, 320, 26] : [170, 296, 300, 26];
    R.ctx.fillStyle = md ? 'rgba(255,210,60,0.18)' : 'rgba(10,10,30,0.6)'; R.ctx.fillRect(mrect[0], mrect[1], mrect[2], mrect[3]);
    R.ctx.strokeStyle = md ? '#ffd23c' : '#3a3a6a'; R.ctx.strokeRect(mrect[0] + 0.5, mrect[1] + 0.5, mrect[2] - 1, mrect[3] - 1);
    R.text(keyEdit.p + 'P 操作タイプ：' + (md ? 'モダン' : 'クラシック') + '（Mキー／タップで切替）', mrect[0] + mrect[2] / 2, mrect[1] + 13, 11, md ? '#ffe14a' : '#ffffff', 'center');
    if (clicked(mrect)) { KF.Input.setModern(keyEdit.p, !md); KF.Audio.play('cursor'); clickPos = null; }
    if (md) R.text('アシストを押しながら弱・中・強を連打か押しっぱなしで、変身や超必殺まで入る長いコンボ', 320, 348, 9, '#ffe14a', 'center');
    R.text('ゲームパッド・レバーレスのボタン設定は Tab キー（またはここをタップ）', 320, 334, 9, '#8890b0', 'center');
    // スマホ：タッチボタンの配置を変える
    if (isTouch) {
      var trect = [380, 296, 210, 26];
      R.ctx.fillStyle = 'rgba(255,210,60,0.2)'; R.ctx.fillRect(trect[0], trect[1], trect[2], trect[3]);
      R.ctx.strokeStyle = '#ffd23c'; R.ctx.strokeRect(trect[0] + 0.5, trect[1] + 0.5, trect[2] - 1, trect[3] - 1);
      R.text('スマホのボタン配置を変える', trect[0] + trect[2] / 2, trect[1] + 13, 11, '#ffe14a', 'center');
      if (clicked(trect)) { clickPos = null; scene = 'touchEdit'; KF.Touch.onEditEnd = function () { scene = 'keys'; }; KF.Touch.startEdit(); return; }
    }
    if (clickPos && clickPos[1] > 326) { keyEdit.p = 'pad'; keyEdit.i = 0; return; }
    if (keyEdit.wait) return;
    if (m.up) keyEdit.i = (keyEdit.i + KEY_ACTIONS.length - 1) % KEY_ACTIONS.length;
    if (m.down) keyEdit.i = (keyEdit.i + 1) % KEY_ACTIONS.length;
    if (m.left || m.right) keyEdit.p = keyEdit.p === 1 ? 2 : 1;
    if (KF.Input.isDown('KeyR') && !menuPrev.kr) { KF.Input.resetKeys(); }
    menuPrev.kr = KF.Input.isDown('KeyR');
    var ck = pickByClick(rects); if (ck >= 0) { keyEdit.i = ck; m.ok = true; }
    if (m.back) { scene = 'title'; return; }
    if (m.ok) {
      keyEdit.wait = true;
      setTimeout(function () {
        keyListener = function (code) {
          if (code !== 'Escape') { KF.Input.keys[keyEdit.p][KEY_ACTIONS[keyEdit.i]] = code; KF.Input.saveKeys(); }
          keyEdit.wait = false; KF.Input.offKey(keyListener);
        };
        KF.Input.onKey(keyListener);
      }, 150);
    }
  }

  // ------------------------------------------------------------ ループ
  var acc = 0, last = performance.now();
  var lastRaf = 0;
  // オンライン対戦中は、タブが背景に回って画面の更新が止まっても裏で進め続ける（相手を待たせない）
  setInterval(function () {
    var now = performance.now();
    if (now - lastRaf < 250 || (scene !== 'onlineBattle' && scene !== 'online' && scene !== 'onlineResult')) return;
    var dt = Math.min(1500, now - last); last = now; acc += dt;
    var n = 0;
    while (acc >= 1000 / 60 && n < 100) { acc -= 1000 / 60; step(); n++; }
  }, 50);
  function tick(now) {
    lastRaf = performance.now();
    var dt = Math.min(100, now - last); last = now;
    acc += dt;
    fpsInfo.n++; fpsInfo.t += dt;
    if (fpsInfo.t >= 1000) {
      fpsInfo.fps = Math.round(fpsInfo.n * 1000 / fpsInfo.t); fpsInfo.n = 0; fpsInfo.t = 0; KF.fps = fpsInfo.fps;
      // 3秒続けて画面の更新が50回/秒を下回ったら、飾りを省いて軽くする
      fpsInfo.slow = fpsInfo.fps < 50 && !document.hidden ? (fpsInfo.slow || 0) + 1 : 0;
      if (fpsInfo.slow >= 3 && !KF.lowFx) { KF.lowFx = true; KF.RES = 1; cv.width = 640; cv.height = 360; }   // 重い端末では元の細かさに戻す
    }
    var steps = 0;
    // 画面の更新がだいたい60回/秒なら、1回の更新でちょうど1コマ進める（進まない回・2コマ進む回が混ざってガクッとするのを防ぐ）
    // オンライン対戦は時間どおりに進める
    var online = scene === 'onlineBattle' || scene === 'online' || scene === 'onlineResult';
    if (!online && dt > 1000 / 60 - 3.5 && dt < 1000 / 60 + 3.5) { acc = 0; step(); steps = 1; }
    else while (acc >= 1000 / 60 && steps < 4) { acc -= 1000 / 60; step(); steps++; }
    if (steps >= 4) acc = 0;
    requestAnimationFrame(tick);
  }
  function step() {
    frameT++;
    R.ctx.setTransform(KF.RES, 0, 0, KF.RES, 0, 0); R.ctx.imageSmoothingEnabled = false;
    if (scene === 'load') return;
    navButtons();
    if (scene === 'battle') { sceneBattle(); clickPos = null; }
    else if (scene === 'onlineBattle') { sceneOnlineBattle(); clickPos = null; }
    else {
      var m = menuInput();
      showInstall(scene === 'title');
      if (scene === 'title') sceneTitle(m);
      else if (scene === 'select') sceneSelect(m);
      else if (scene === 'level') sceneLevel(m);
      else if (scene === 'result') sceneResult(m);
      else if (scene === 'moves') sceneMoves(m);
      else if (scene === 'keys') sceneKeys(m);
      else if (scene === 'online') sceneOnline(m);
      else if (scene === 'touchEdit') { bg(0.2); R.text('ボタン配置の変更中', 320, 180, 14, '#ffffff', 'center'); }
      else if (scene === 'onlineResult') sceneOnlineResult(m);
      clickPos = null;
    }
    if (KF.padNotice && KF.padNotice.t > 0) { KF.padNotice.t--; R.ctx.fillStyle = 'rgba(0,0,10,0.7)'; R.ctx.fillRect(170, 326, 300, 20); R.text(KF.padNotice.text, 320, 336, 9, '#7fffb0', 'center'); }
    if (showFps) R.text(KF.fps + ' FPS', 636, 352, 8, '#7fffb0', 'right');
  }
  window.addEventListener('keydown', function (e) {
    KF.Audio.init();
    // 操作設定：Mキーでクラシック／モダンを切り替え（キー割り当て待ちのときは除く）
    if (e.code === 'KeyM' && scene === 'keys' && keyEdit && keyEdit.p !== 'pad' && !keyEdit.wait) { KF.Input.setModern(keyEdit.p, !KF.Input.modern[keyEdit.p]); KF.Audio.play('cursor'); }
    if (e.code === 'F2') { R && (R.debug = !R.debug); e.preventDefault(); }
    if (e.code === 'F3') { toggleKeyDisp(); e.preventDefault(); }
    if (e.code === 'F4' && cfg.mode === 'training') { cycleTrSpeed(); e.preventDefault(); }
    if (e.code === 'F3') { showFps = !showFps; e.preventDefault(); }
  });

  // 硬直差の計測（トレーニング表示用）
  setInterval(function () { }, 1000);

  KF.Game = { get battle() { return game; }, get scene() { return scene; }, get net() { return net; }, get rb() { return rb; }, cfg: cfg, start: startBattle, setScene: function (s) { scene = s; } };

  // 画面の中身は2倍の細かさで描く（ドット絵は荒いままで、動く位置だけ半ドット単位になり、移動やカメラがなめらかになる）
  KF.RES = 2; cv.width = 640 * KF.RES; cv.height = 360 * KF.RES;
  R = new KF.Renderer(cv);
  var bar = document.getElementById('loadbar');
  KF.loadAssets(function (p) { if (bar) bar.style.width = Math.round(p * 100) + '%'; }).then(function () {
    var ld = document.getElementById('loading'); if (ld) ld.style.display = 'none';
    scene = 'title';
    var q = location.search;
    if (/autostart/.test(q)) { // テスト用：URLで直接対戦開始
      var mm = q.match(/level=(\w+)/); if (mm) cfg.level = mm[1];
      cfg.mode = /training/.test(q) ? 'training' : (/vs/.test(q) ? 'vs' : 'cpu');
      startBattle();
    }
    if (/fps/.test(q)) showFps = true;
    if (/low/.test(q)) KF.lowFx = true;
    var rm = q.match(/room=([A-Za-z0-9]+)/);   // 招待リンクから開いたら、その部屋に入る
    if (rm) { goOnline(); onlineJoin(rm[1]); }
  }).catch(function (e) {
    var ld = document.getElementById('loading'); if (ld) ld.textContent = '読み込みエラー：' + e.message;
  });
  requestAnimationFrame(tick);
})();
