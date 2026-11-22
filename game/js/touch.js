// スマートフォン用：仮想方向パッド + 6攻撃ボタン + ラッシュ・投げ・ポーズ（マルチタッチ対応）
'use strict';
var KF = window.KF || (window.KF = {});
KF.Touch = (function () {
  var root = document.getElementById('touch');
  if (!root) return { show: function () { } };
  var pad = root.querySelector('.dpad'), knob = root.querySelector('.knob');
  var btns = Array.prototype.slice.call(root.querySelectorAll('[data-b]'));
  var T = KF.Input.touch;
  var padId = null, btnTouches = {};

  function setDir(cx, cy) {
    var r = pad.getBoundingClientRect();
    var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    var rad = r.width / 2, dz = rad * 0.22;
    var len = Math.hypot(dx, dy);
    T.x = 0; T.y = 0;
    if (len > dz) {
      var a = Math.atan2(dy, dx) * 180 / Math.PI; // 8方向
      var sector = Math.round(a / 45);
      var map = { 0: [1, 0], 1: [1, 1], 2: [0, 1], 3: [-1, 1], 4: [-1, 0], '-4': [-1, 0], '-3': [-1, -1], '-2': [0, -1], '-1': [1, -1] };
      var d = map[sector]; T.x = d[0]; T.y = d[1];
    }
    var k = Math.min(1, len / rad);
    knob.style.transform = 'translate(' + (dx / (len || 1) * k * rad * 0.45) + 'px,' + (dy / (len || 1) * k * rad * 0.45) + 'px)';
  }
  function resetPad() { T.x = 0; T.y = 0; knob.style.transform = ''; padId = null; }
  function btnAt(x, y) {
    for (var i = 0; i < btns.length; i++) {
      var r = btns[i].getBoundingClientRect();
      var pad2 = 6;
      if (x >= r.left - pad2 && x <= r.right + pad2 && y >= r.top - pad2 && y <= r.bottom + pad2) return btns[i];
    }
    return null;
  }
  function refreshButtons() {
    var held = {};
    Object.keys(btnTouches).forEach(function (id) {
      var b = btnTouches[id]; if (!b) return;
      b.getAttribute('data-b').split(',').forEach(function (n) { held[n] = true; });
    });
    var prevHeld = T.held || {};
    Object.keys(T.tap || {}).forEach(function (n) { if (T.tap[n] > 0) held[n] = true; });
    T.held = held;
    btns.forEach(function (b) {
      var on = b.getAttribute('data-b').split(',').every(function (n) { return held[n]; }) && Object.keys(btnTouches).some(function (id) { return btnTouches[id] === b; });
      b.classList.toggle('on', on);
    });
  }
  function handle(e) {
    e.preventDefault();
    if (editing) { editHandle(e); return; }
    KF.Audio.init();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i], id = t.identifier;
      var end = e.type === 'touchend' || e.type === 'touchcancel';
      if (e.type === 'touchstart') {
        var pr = pad.getBoundingClientRect();
        var inPad = t.clientX < pr.right + 40 && t.clientY > pr.top - 60 && t.clientX > pr.left - 40;
        if (inPad && padId === null) { padId = id; setDir(t.clientX, t.clientY); continue; }
        btnTouches[id] = btnAt(t.clientX, t.clientY);
        if (btnTouches[id]) { T.tap = T.tap || {}; btnTouches[id].getAttribute('data-b').split(',').forEach(function (n) { T.tap[n] = 2; }); }
        if (navigator.vibrate && btnTouches[id]) try { navigator.vibrate(8); } catch (er) { }
      } else if (e.type === 'touchmove') {
        if (id === padId) { setDir(t.clientX, t.clientY); continue; }
        if (id in btnTouches) btnTouches[id] = btnAt(t.clientX, t.clientY) || btnTouches[id];
      } else if (end) {
        if (id === padId) { resetPad(); continue; }
        delete btnTouches[id];
      }
    }
    refreshButtons();
  }
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (ev) { root.addEventListener(ev, handle, { passive: false }); });
  // ------------------------------------------------------------ 配置の変更（縦持ち・横持ちで別々に保存）
  //  各部品の位置は「画面の幅・高さに対する中心の位置（%）」と「大きさの倍率」で持つ
  var parts = [pad].concat(btns, [root.querySelector('[data-sys]')]).filter(Boolean);
  function pid(el) { return el === pad ? 'pad' : el.getAttribute('data-b') || 'sys'; }
  var layouts = {};
  try { layouts = JSON.parse(localStorage.getItem('kf_touch_layout') || '{}') || {}; } catch (e) { layouts = {}; }
  Object.keys(layouts).forEach(function (o) { var L0 = layouts[o]; if (!L0 || !L0.pad || !L0.pad.bw) delete layouts[o]; });
  function orient() { return window.innerWidth > window.innerHeight ? 'land' : 'port'; }
  function save() { try { localStorage.setItem('kf_touch_layout', JSON.stringify(layouts)); } catch (e) { } }
  function clearCustom() {
    root.classList.remove('custom');
    parts.forEach(function (el) { el.style.position = ''; el.style.left = ''; el.style.top = ''; el.style.width = ''; el.style.height = ''; el.style.transform = ''; el.style.right = ''; el.style.bottom = ''; el.style.margin = ''; });
  }
  // 今の見た目（初期配置）から、位置と大きさを読み取る
  function readDefault() {
    clearCustom();
    var W = window.innerWidth, H = window.innerHeight, L = {};
    parts.forEach(function (el) {
      var r = el.getBoundingClientRect();
      L[pid(el)] = { x: (r.left + r.width / 2) / W * 100, y: (r.top + r.height / 2) / H * 100, s: 1, bw: r.width, bh: r.height };
    });
    return L;
  }
  function apply() {
    var L = layouts[orient()];
    if (!L) { clearCustom(); return; }
    root.classList.add('custom');
    var W = window.innerWidth, H = window.innerHeight;
    parts.forEach(function (el) {
      var id = pid(el), p = L[id]; if (!p || !p.bw) return;   // 元の大きさ（bw,bh）も一緒に保存してある
      var w = p.bw * p.s, h = p.bh * p.s;
      el.style.position = 'fixed'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.margin = '0'; el.style.transform = 'none';
      el.style.width = w + 'px'; el.style.height = h + 'px';
      el.style.left = (p.x / 100 * W - w / 2) + 'px'; el.style.top = (p.y / 100 * H - h / 2) + 'px';
    });
  }
  window.addEventListener('resize', function () { setTimeout(apply, 60); });

  var editing = false, sel = null, drag = null, ui = null;
  function editHandle(e) {
    var W = window.innerWidth, H = window.innerHeight, L = layouts[orient()];
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (e.type === 'touchstart') {
        var hit = null;
        parts.forEach(function (el) { var r = el.getBoundingClientRect(); if (t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom) hit = el; });
        if (hit) { select(hit); var p = L[pid(hit)]; drag = { id: t.identifier, el: hit, ox: p.x - t.clientX / W * 100, oy: p.y - t.clientY / H * 100 }; }
      } else if (e.type === 'touchmove' && drag && t.identifier === drag.id) {
        var q = L[pid(drag.el)];
        q.x = Math.max(2, Math.min(98, t.clientX / W * 100 + drag.ox)); q.y = Math.max(2, Math.min(98, t.clientY / H * 100 + drag.oy));
        apply();
      } else if (drag && t.identifier === drag.id) { drag = null; save(); }
    }
  }
  function select(el) {
    parts.forEach(function (x) { x.style.outline = ''; });
    sel = el; if (el) { el.style.outline = '3px dashed #ffe14a'; el.style.outlineOffset = '3px'; }
  }
  function scaleSel(k) {
    if (!sel) return;
    var p = layouts[orient()][pid(sel)]; p.s = Math.max(0.5, Math.min(2.2, Math.round((p.s * k) * 100) / 100)); apply(); save();
  }
  function makeUI() {
    ui = document.createElement('div');
    ui.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:8;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;font:900 13px "Noto Sans JP",sans-serif;color:#fff;background:rgba(2,2,12,.85);padding:8px;border-radius:10px;border:1px solid #38d6ff;max-width:96vw';
    var tip = document.createElement('div'); tip.textContent = 'ボタンを指で動かす／選んだボタンの大きさを変える'; tip.style.cssText = 'width:100%;text-align:center;font-size:12px;color:#c0c8e8';
    ui.appendChild(tip);
    [['小さく', function () { scaleSel(1 / 1.12); }], ['大きく', function () { scaleSel(1.12); }],
     ['元に戻す', function () { delete layouts[orient()]; save(); layouts[orient()] = readDefault(); apply(); select(null); }],
     ['完了', function () { KF.Touch.endEdit(); }]].forEach(function (d) {
      var b = document.createElement('button'); b.textContent = d[0];
      b.style.cssText = 'font:900 14px "Noto Sans JP",sans-serif;padding:8px 14px;border-radius:8px;border:0;background:' + (d[0] === '完了' ? '#38d6ff;color:#001' : '#26264a;color:#fff');
      b.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      b.onclick = d[1]; ui.appendChild(b);
    });
    document.body.appendChild(ui);
  }
  apply();

  return {
    show: function (on) { root.style.display = on ? 'block' : 'none'; document.body.classList.toggle('touchmode', !!on); if (!on) { resetPad(); btnTouches = {}; refreshButtons(); } else apply(); },
    // 配置の変更を始める／終える
    startEdit: function () {
      editing = true; root.style.display = 'block'; document.body.classList.add('touchmode');
      if (!layouts[orient()]) layouts[orient()] = readDefault();
      apply(); if (!ui) makeUI(); ui.style.display = 'flex'; select(null);
    },
    endEdit: function () {
      editing = false; select(null); save(); if (ui) ui.style.display = 'none';
      root.style.display = 'none'; document.body.classList.remove('touchmode');
      if (KF.Touch.onEditEnd) KF.Touch.onEditEnd();
    },
    get editing() { return editing; },
  };
})();
