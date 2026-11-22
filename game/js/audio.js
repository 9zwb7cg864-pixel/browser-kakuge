// 効果音（WebAudioでその場で合成。音声ファイルは使わない）
'use strict';
var KF = window.KF || (window.KF = {});
KF.Audio = (function () {
  var ctx = null, master = null, noiseBuf = null, on = true;
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.35;
      // 音が割れないようにまとめて圧縮する
      var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.15;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function noise(dur, freq, q, vol, type) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain(); var t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }
  function tone(f0, f1, dur, vol, type) {
    var o = ctx.createOscillator(); o.type = type || 'sine';
    var g = ctx.createGain(); var t = ctx.currentTime;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
  }
  var S = {
    // 打撃音は「乾いた破裂音」＋「芯の低音」＋「余韻」を重ねて重さを出す
    light: function () { noise(0.05, 3200, 1.0, 0.7); noise(0.09, 1400, 0.8, 0.35); tone(260, 90, 0.07, 0.5); },
    mid: function () { noise(0.05, 2600, 0.8, 0.8); noise(0.14, 900, 0.7, 0.6); tone(170, 50, 0.13, 0.8); tone(90, 40, 0.12, 0.5, 'triangle'); },
    heavy: function () { noise(0.04, 2200, 0.7, 0.9); noise(0.22, 600, 0.6, 1.0); tone(120, 32, 0.28, 1.1); tone(65, 28, 0.32, 0.9, 'triangle'); noise(0.35, 220, 0.5, 0.5, 'lowpass'); },
    superhit: function () { noise(0.05, 2400, 0.7, 1.0); noise(0.25, 700, 0.7, 1.0); tone(100, 28, 0.3, 1.1); tone(60, 25, 0.35, 0.9, 'sawtooth'); },
    counter: function () { tone(1400, 900, 0.12, 0.25, 'square'); tone(2100, 1500, 0.1, 0.15, 'square'); },
    punish: function () { tone(1600, 700, 0.18, 0.3, 'square'); tone(55, 25, 0.45, 1.0); noise(0.4, 300, 0.5, 0.7, 'lowpass'); },
    block: function () { noise(0.06, 4200, 3, 0.5); tone(900, 500, 0.05, 0.25, 'square'); },
    whiff: function () { noise(0.08, 1200, 0.6, 0.25, 'highpass'); },
    jump: function () { noise(0.05, 600, 1, 0.15); },
    land: function () { noise(0.06, 300, 1, 0.3); },
    dash: function () { noise(0.15, 1500, 0.5, 0.3, 'highpass'); },
    rush: function () { noise(0.25, 2000, 0.6, 0.45, 'highpass'); tone(300, 900, 0.2, 0.2, 'sawtooth'); },
    special: function () { tone(400, 800, 0.12, 0.15, 'square'); },
    ex: function () { tone(600, 1400, 0.2, 0.25, 'triangle'); },
    fire: function () { tone(500, 140, 0.3, 0.3, 'sawtooth'); noise(0.3, 900, 0.5, 0.3); },
    beam: function () { tone(120, 60, 1.2, 0.5, 'sawtooth'); noise(1.0, 800, 0.4, 0.5); },
    pillar: function () { tone(70, 30, 1.0, 0.6, 'sawtooth'); noise(0.8, 300, 0.5, 0.6); },
    super: function () { tone(200, 1600, 0.5, 0.35, 'sawtooth'); noise(0.5, 3000, 0.5, 0.3, 'highpass'); },
    grab: function () { noise(0.08, 500, 1, 0.5); },
    tech: function () { noise(0.1, 3000, 2, 0.6); tone(1200, 600, 0.1, 0.3, 'square'); },
    clash: function () { noise(0.15, 2000, 1, 0.7); },
    down: function () { noise(0.2, 200, 0.7, 0.8); tone(80, 40, 0.2, 0.6); },
    ko: function () { tone(220, 40, 1.2, 0.6, 'sawtooth'); noise(1.0, 400, 0.5, 0.6); },
    cursor: function () { tone(900, 900, 0.04, 0.15, 'square'); },
    ok: function () { tone(700, 1400, 0.1, 0.2, 'square'); },
    back: function () { tone(500, 250, 0.1, 0.2, 'square'); },
  };
  return {
    init: init,
    play: function (n) { if (!on) return; init(); if (!ctx) return; if (ctx.state === 'suspended') ctx.resume(); try { S[n] && S[n](); } catch (e) { } },
    toggle: function () { on = !on; return on; },
  };
})();
