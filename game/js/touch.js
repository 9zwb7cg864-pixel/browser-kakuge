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
  return {
    show: function (on) { root.style.display = on ? 'block' : 'none'; document.body.classList.toggle('touchmode', !!on); if (!on) { resetPad(); btnTouches = {}; refreshButtons(); } },
  };
})();
