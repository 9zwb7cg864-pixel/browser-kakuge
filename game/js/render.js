// =====================================================================
//  描画：ステージ（視差・雨・看板の点滅・水たまりの反射）/ キャラ / エフェクト / HUD
// =====================================================================
'use strict';
var KF = window.KF || (window.KF = {});

KF.Assets = { img: {}, meta: {}, fx: null, stage: null };

KF.loadAssets = function (onProgress) {
  var A = KF.Assets, jobs = [], done = 0;
  var EMB = window.KF_EMBED;   // 単体版：素材がHTMLに埋め込まれている
  function img(key, src) {
    if (EMB && EMB.img[src]) src = EMB.img[src];
    else if (window.KF_VER) src += '?v=' + window.KF_VER;   // 更新したら新しい絵を読み直す
    jobs.push(new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { A.img[key] = im; done++; onProgress && onProgress(done / Math.max(1, jobs.length)); res(); };
      im.onerror = function () { rej(new Error('画像を読み込めません: ' + src)); };
      im.src = src;
    }));
  }
  function json(url) {
    if (EMB && EMB.json[url]) return Promise.resolve(JSON.parse(JSON.stringify(EMB.json[url])));
    return fetch(url + (window.KF_VER ? '?v=' + window.KF_VER : '')).then(function (r) { return r.json(); });
  }
  // 遊べるキャラは道着キャラ男だけなので、その絵とエフェクトだけ読み込む（もう1人のキャラ・街のステージの絵は読まない）
  // 遊べるキャラ：道着キャラ男（kokuu）
  var KINDS = ['kokuu'];
  return Promise.all(KINDS.map(function (k) { return json('assets/' + k + '/anims.json'); }).concat([json('assets/fx/fx.json')]))
    .then(function (r) {
      KINDS.forEach(function (k, i) { A.meta[k] = KF.prepAnims(r[i]); });
      A.fx = r[KINDS.length]; A.stage = {};
      KINDS.forEach(function (k) { Object.keys(A.meta[k].anims).forEach(function (n) { img(k + ':' + n, 'assets/' + k + '/' + A.meta[k].anims[n].file); }); });
      Object.keys(A.fx).forEach(function (n) { img('fx:' + n, 'assets/fx/' + A.fx[n].file); });
      return Promise.all(jobs);
    });
};

KF.Renderer = function (canvas) {
  this.cv = canvas; this.ctx = canvas.getContext('2d');
  this.ctx.imageSmoothingEnabled = false;
  this.rain = [];
  for (var i = 0; i < 140; i++) this.rain.push({ x: Math.random() * 640, y: Math.random() * 360, s: 6 + Math.random() * 5, l: 6 + Math.random() * 8, z: Math.random() });
  this.splash = [];
  this.t = 0;
  this.ann = []; this.superBanner = null;
  this.debug = false;
  // 反射描画用オフスクリーン
  this.refl = document.createElement('canvas'); this.refl.width = 640; this.refl.height = 360;
  this.flipTmp = document.createElement('canvas'); this.flipTmp.width = 224; this.flipTmp.height = 200;
};

KF.Renderer.prototype.drawStageCity = function (camX, b) {
  var c = this.ctx, A = KF.Assets, W = 640, t = this.t;
  var L = camX - W / 2;
  c.drawImage(A.img['st:sky'], 0, 0);
  var far = A.img['st:far'];
  c.drawImage(far, -Math.round((L * 0.25) % far.width) - 40, A.stage.farY);
  var mid = A.img['st:mid'];
  var mx = -Math.round(L * 0.6) - 60;
  c.drawImage(mid, mx, 0);
  // 看板の点滅・光の脈動
  var self = this;
  A.stage.signs.forEach(function (s, i) {
    var x = mx + s.x, y = s.y;
    if (x + s.w < 0 || x > W) return;
    var flick = s.f > 0.85 ? (Math.sin(t * 0.9 + i) > 0.92 || (t + i * 37) % 240 < 6 ? 0 : 1) : 1;
    var pulse = 0.12 + 0.08 * Math.sin(t * 0.05 + i * 1.7);
    if (!flick) { c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(x, y, s.w, s.h); return; }
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ',' + (s.ad ? pulse * 0.6 : pulse * 0.5) + ')';
    c.fillRect(x - 2, y - 2, s.w + 4, s.h + 4);
    if (s.ad) { // 広告の走査線
      var sy = y + ((t * 0.7) % s.h);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x, sy, s.w, 2);
    }
    c.globalCompositeOperation = 'source-over';
  });
  var fl = A.img['st:floor'];
  c.drawImage(fl, -Math.round(L), A.stage.floorY);
};

// トレーニングステージ：方眼の壁と、遠近のついた方眼の床（距離が測れる）
KF.Renderer.prototype.drawStage = function (camX, b) {
  // カメラの位置ごとに描いた絵を取っておき、同じ位置なら1枚貼るだけにする（ステージは動かないので毎フレーム描き直さない）
  var key = Math.round(camX);
  if (!this.stCache) { this.stCache = document.createElement('canvas'); this.stCache.width = 680; this.stCache.height = 400; this.stKey = null; }
  if (this.stKey !== key) {
    this.stKey = key;
    var sc = this.stCache.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, 680, 400); sc.translate(20, 20);
    this.drawStageRaw(sc, key);
  }
  this.ctx.drawImage(this.stCache, -20, -20);
};
KF.Renderer.prototype.drawStageRaw = function (c, camX) {
  var W = 640, H = 360, C = KF.CONST;
  var L = camX - W / 2, G = C.GROUND, base = 262, hz = 196, vp = W / 2, cell = 32;
  // 壁
  var gw = c.createLinearGradient(0, 0, 0, base);
  gw.addColorStop(0, '#3d4452'); gw.addColorStop(0.6, '#59616f'); gw.addColorStop(1, '#6a7280');
  c.fillStyle = gw; c.fillRect(-20, -20, W + 40, base + 20);
  // 壁の方眼（少し奥なのでゆっくり動く）
  var wl = L * 0.85;
  c.lineWidth = 1;
  for (var gx = Math.floor(wl / cell) * cell; gx < wl + W + cell; gx += cell) {
    var x = Math.round(gx - wl) + 0.5, major = Math.round(gx / cell) % 5 === 0;
    c.strokeStyle = major ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.12)';
    c.beginPath(); c.moveTo(x, -20); c.lineTo(x, base); c.stroke();
  }
  for (var gy = base; gy > -20; gy -= cell) {
    var major2 = Math.round((base - gy) / cell) % 5 === 0;
    c.strokeStyle = major2 ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.12)';
    c.beginPath(); c.moveTo(-20, gy + 0.5); c.lineTo(W + 20, gy + 0.5); c.stroke();
  }
  // 床
  var gf = c.createLinearGradient(0, base, 0, H);
  gf.addColorStop(0, '#505764'); gf.addColorStop(1, '#3a404b');
  c.fillStyle = gf; c.fillRect(-20, base, W + 40, H - base + 20);
  // 壁と床の境目
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-20, base, W + 40, 2);
  // 床の縦線（立ち位置の線上で1マス＝32ドット。奥へ行くほど詰まる）
  var sAt = function (y) { return (y - hz) / (G - hz); };
  var s0 = sAt(base), s1 = sAt(H + 10);
  for (var fx = Math.floor((L - 400) / cell) * cell; fx < L + W + 400; fx += cell) {
    var xg = fx - L, n = Math.round(fx / cell), maj = n % 5 === 0;
    var x0 = vp + (xg - vp) * s0, x1 = vp + (xg - vp) * s1;
    if (Math.max(x0, x1) < -20 || Math.min(x0, x1) > W + 20) continue;
    c.strokeStyle = maj ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.13)';
    c.lineWidth = maj ? 1.5 : 1;
    c.beginPath(); c.moveTo(x0, base); c.lineTo(x1, H + 10); c.stroke();
  }
  // 床の横線（手前ほど間隔が広い）
  c.lineWidth = 1;
  for (var k = 1; k < 8; k++) {
    var y = hz + (base - hz) * Math.pow(1.17, k * 1.35);
    if (y > H) break;
    c.strokeStyle = 'rgba(255,255,255,' + (0.08 + k * 0.02) + ')';
    c.beginPath(); c.moveTo(-20, Math.round(y) + 0.5); c.lineTo(W + 20, Math.round(y) + 0.5); c.stroke();
  }
  // 立ち位置の線と、5マスごとの目盛り数字
  c.strokeStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(-20, G + 0.5); c.lineTo(W + 20, G + 0.5); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center';
  for (var mx = Math.ceil(L / (cell * 5)) * cell * 5; mx < L + W; mx += cell * 5) {
    c.fillText(String(Math.round(mx / cell / 5)), mx - L, G + 13);
  }
  c.textAlign = 'left';
  // 両端の壁（画面端）を少し暗くして分かるように
  [[0, 1], [C.WORLD_W, -1]].forEach(function (e) {
    var ex = e[0] - L; if (ex < -60 || ex > W + 60) return;
    var gr = c.createLinearGradient(ex, 0, ex + e[1] * 60, 0);
    gr.addColorStop(0, 'rgba(10,12,20,0.55)'); gr.addColorStop(1, 'rgba(10,12,20,0)');
    c.fillStyle = gr; c.fillRect(Math.min(ex, ex + e[1] * 60), -20, 60, H + 40);
  });
  // 周辺を少し落とす
  var vg = c.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.45)');
  c.fillStyle = vg; c.fillRect(-20, -20, W + 40, H + 40);
};

// 2Pの色違い：シアンの絵の色相を回してマゼンタにした絵を、初めて使うときに作って取っておく（デザイン画どおり）
KF.ALT_COLOR = '#ff3ce0';
KF.altImg = function (key) {
  var A = KF.Assets, k2 = key + '~alt';
  if (A.img[k2]) return A.img[k2];
  var src = A.img[key]; if (!src) return null;
  var cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  var c = cv.getContext('2d'); c.drawImage(src, 0, 0);
  try {
    var d = c.getImageData(0, 0, cv.width, cv.height), p = d.data;
    // 色相を約115度回す（シアン→マゼンタ）。明るさはそのまま
    var a = 115 * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    var m = [0.213 + co * 0.787 - si * 0.213, 0.715 - co * 0.715 - si * 0.715, 0.072 - co * 0.072 + si * 0.928,
             0.213 - co * 0.213 + si * 0.143, 0.715 + co * 0.285 + si * 0.140, 0.072 - co * 0.072 - si * 0.283,
             0.213 - co * 0.213 - si * 0.787, 0.715 - co * 0.715 + si * 0.715, 0.072 + co * 0.928 + si * 0.072];
    for (var i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      var r = p[i], g = p[i + 1], b = p[i + 2];
      p[i] = m[0] * r + m[1] * g + m[2] * b; p[i + 1] = m[3] * r + m[4] * g + m[5] * b; p[i + 2] = m[6] * r + m[7] * g + m[8] * b;
    }
    c.putImageData(d, 0, 0);
  } catch (e) { }
  A.img[k2] = cv;
  return cv;
};
KF.fighterImg = function (kind, anim, alt) { return alt ? KF.altImg(kind + ':' + anim) : KF.Assets.img[kind + ':' + anim]; };

KF.Renderer.prototype.drawFighterImg = function (ctx, f, x, y, alpha, flipY) {
  var A = KF.Assets, img = KF.fighterImg(f.kind, f.anim, f.alt);
  if (!img) return;
  var fw = 224, fh = 200, sx = Math.min(f.aF, f.animObj().frames.length - 1) * fw;
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(f.facing, flipY ? -1 : 1);
  ctx.drawImage(img, sx, 0, fw, fh, -112, -190, fw, fh);
  ctx.restore();
};

// 被弾した瞬間の白いシルエット
KF.Renderer.prototype.drawFighterWhite = function (ctx, f, x, y, alpha) {
  var img = KF.fighterImg(f.kind, f.anim, f.alt);
  if (!img) return;
  if (!this.wcv) { this.wcv = document.createElement('canvas'); this.wcv.width = 224; this.wcv.height = 200; }
  var w = this.wcv.getContext('2d'), sx = Math.min(f.aF, f.animObj().frames.length - 1) * 224;
  w.globalCompositeOperation = 'source-over'; w.clearRect(0, 0, 224, 200);
  w.drawImage(img, sx, 0, 224, 200, 0, 0, 224, 200);
  w.globalCompositeOperation = 'source-atop'; w.fillStyle = '#ffffff'; w.fillRect(0, 0, 224, 200);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y)); ctx.scale(f.facing, 1);
  ctx.drawImage(this.wcv, -112, -190);
  ctx.restore();
};
// 衝撃の色：通常・カウンター・パニッシュカウンター・超必殺
KF.IMPACT_COL = {
  n: ['255,255,255', '255,236,170', '255,190,90'],
  c: ['255,255,230', '255,214,80', '255,150,30'],
  p: ['255,255,255', '255,90,70', '210,30,60'],
  s: ['255,255,255', '160,240,255', '60,170,255'],
};
KF.Renderer.prototype.drawImpact = function (c, e, x, y) {
  var T = e.T, t = e.t, C3 = KF.IMPACT_COL[e.col], R0 = 12 + T * 6;
  if (t > 16) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  // 芯の閃光（最初の数フレームだけ大きく白く）
  if (t < 4) {
    var r1 = R0 * (1.2 - t * 0.2);
    var g = c.createRadialGradient(x, y, 0, x, y, r1);
    g.addColorStop(0, 'rgba(' + C3[0] + ',1)'); g.addColorStop(0.4, 'rgba(' + C3[1] + ',0.8)'); g.addColorStop(1, 'rgba(' + C3[2] + ',0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r1, 0, Math.PI * 2); c.fill();
  }
  // 広がる衝撃波の輪
  var k = t / 14, rr = R0 * (0.6 + k * 2.4);
  if (k < 1) {
    c.strokeStyle = 'rgba(' + C3[1] + ',' + (1 - k) * 0.9 + ')';
    c.lineWidth = Math.max(1, (1 - k) * (2 + T));
    c.beginPath(); c.ellipse(x, y, rr, rr * 0.75, 0, 0, Math.PI * 2); c.stroke();
  }
  // 放射状に飛ぶ楔（根元が太く先が尖る）
  var k2 = t / 9;
  if (k2 < 1) {
    e.rays.forEach(function (r) {
      var L = R0 * r.l * (1.1 + T * 0.12), d0 = R0 * 0.35 + L * k2 * 0.8, d1 = d0 + L * (1 - k2 * 0.6);
      var ca = Math.cos(r.a), sa = Math.sin(r.a) * 0.8, nx = -sa, ny = ca, w = (1 - k2) * (1.5 + T * 0.6);
      c.fillStyle = 'rgba(' + C3[k2 < 0.3 ? 0 : 1] + ',' + (1 - k2) * 0.95 + ')';
      c.beginPath();
      c.moveTo(x + ca * d0 + nx * w, y + sa * d0 + ny * w);
      c.lineTo(x + ca * d1, y + sa * d1);
      c.lineTo(x + ca * d0 - nx * w, y + sa * d0 - ny * w);
      c.closePath(); c.fill();
    });
  }
  c.restore();
};
// 地面を走る衝撃波（ハンマーの地割れ）：とがった岩と砂ぼこりと金色の光
KF.Renderer.prototype.drawShock = function (c, p, x) {
  var G = KF.CONST.GROUND, t = p.t, dir = p.vx < 0 ? -1 : 1;
  c.save(); c.globalCompositeOperation = 'lighter';
  var g = c.createRadialGradient(x, G - 6, 2, x, G - 6, 34);
  g.addColorStop(0, 'rgba(255,230,160,0.9)'); g.addColorStop(0.5, 'rgba(255,150,30,0.45)'); g.addColorStop(1, 'rgba(255,120,0,0)');
  c.fillStyle = g; c.fillRect(x - 36, G - 44, 72, 50);
  c.restore();
  // 岩のとげ（進む向きの後ろへ小さくなる）
  for (var i = 0; i < 5; i++) {
    var bx = x - dir * i * 9, h = (22 - i * 4) * (0.8 + 0.2 * Math.sin((t + i * 3) * 0.9)), w = 8 - i;
    c.fillStyle = i === 0 ? '#ffe7a6' : i < 3 ? '#ffb22a' : '#b86a08';
    c.beginPath(); c.moveTo(bx - w, G); c.lineTo(bx + dir * 2, G - h); c.lineTo(bx + w, G); c.closePath(); c.fill();
  }
  c.fillStyle = 'rgba(120,90,60,0.5)';
  for (var k = 0; k < 4; k++) { var dx = ((t * 3 + k * 17) % 40) - 20; c.fillRect(x - dir * 20 + dx, G - 4 - (k % 3) * 3, 3, 3); }
};
// 光の盾（大盾形態の飛び道具）：横に寝かせた光る盾が回りながら飛ぶ
KF.Renderer.prototype.drawDisc = function (c, p, x) {
  var t = p.t, y = p.y, dir = p.vx < 0 ? -1 : 1, sq = Math.abs(Math.cos(t * 0.35));
  c.save(); c.globalCompositeOperation = 'lighter';
  for (var i = 4; i >= 1; i--) {   // 残像
    c.fillStyle = 'rgba(60,245,150,' + (0.10 * (5 - i) / 4) + ')';
    c.beginPath(); c.ellipse(x - dir * i * 10, y, 30, 9 + 8 * sq, 0, 0, Math.PI * 2); c.fill();
  }
  var g = c.createRadialGradient(x, y, 2, x, y, 40);
  g.addColorStop(0, 'rgba(220,255,235,0.9)'); g.addColorStop(0.45, 'rgba(60,245,150,0.5)'); g.addColorStop(1, 'rgba(20,200,110,0)');
  c.fillStyle = g; c.fillRect(x - 42, y - 42, 84, 84);
  c.restore();
  c.save();
  c.fillStyle = '#e8fff2'; c.strokeStyle = '#34f594'; c.lineWidth = 3;
  c.beginPath(); c.ellipse(x, y, 30, 4 + 12 * sq, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = 'rgba(52,245,148,0.6)'; c.beginPath(); c.ellipse(x, y, 12, 2 + 5 * sq, 0, 0, Math.PI * 2); c.fill();
  c.restore();
};
KF.Renderer.prototype.drawSpark = function (c, e, x, y) {
  if (e.t > e.life) return;
  var k = e.t / e.life, C3 = KF.IMPACT_COL[e.col];
  c.save(); c.globalCompositeOperation = 'lighter';
  c.strokeStyle = 'rgba(' + C3[k < 0.3 ? 0 : 1] + ',' + (1 - k) + ')';
  c.lineWidth = k < 0.5 ? 3 : 2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x - e.vx * 1.6, y - e.vy * 1.6); c.stroke();
  c.restore();
};

KF.Renderer.prototype.render = function (b) {
  var c = this.ctx, W = 640, H = 360, C = KF.CONST;
  this.t++;
  var shx = b.shake ? (Math.random() - 0.5) * b.shake * 2 : 0, shy = b.shake ? (Math.random() - 0.5) * b.shake : 0;
  var camX = b.camX;
  c.save();
  // 強い一撃でカメラを少し寄せる（衝撃の位置を中心に）
  if (b.zoom > 0) {
    var zc = b.zoomAt || [W / 2, H / 2], z = 1 + b.zoom;
    c.translate(zc[0], zc[1]); c.scale(z, z); c.translate(-zc[0], -zc[1]);
  }
  c.translate(Math.round(shx), Math.round(shy));
  this.drawStage(camX, b);
  if (b.bgFlash > 0) { c.fillStyle = 'rgba(255,255,255,' + (b.bgFlash * 0.07) + ')'; c.fillRect(-20, -20, W + 40, H + 40); }
  var ox = W / 2 - camX;
  var self = this;

  // 床への映り込み（上下反転・半透明）。動きが重い端末では省く
  if (!KF.lowFx) {
  var r = this.refl.getContext('2d');
  r.clearRect(0, 0, W, H); r.imageSmoothingEnabled = false;
  b.p.forEach(function (f) { self.drawFighterImg(r, f, f.x + ox, C.GROUND + (C.GROUND - f.y) + 2, 0.55, true); });
  b.projs.forEach(function (p) { if (p.kind === 'ball') self.drawFxFrame(r, p.fx, (p.t >> 2), p.x + ox, 2 * C.GROUND - p.y, p.vx < 0, 1, 0.5); });
  r.globalCompositeOperation = 'destination-in';
  var grd = r.createLinearGradient(0, C.GROUND, 0, H);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  r.fillStyle = grd; r.fillRect(0, C.GROUND, W, H - C.GROUND);
  r.globalCompositeOperation = 'source-over';
  c.drawImage(this.refl, 0, 0);
  }

  // 影
  b.p.forEach(function (f) {
    var a = Math.max(0.15, 0.5 - (C.GROUND - f.y) / 300);
    c.fillStyle = 'rgba(0,0,0,' + a + ')';
    c.beginPath(); c.ellipse(f.x + ox, C.GROUND + 2, 30, 5, 0, 0, Math.PI * 2); c.fill();
  });

  // 超必殺の暗転
  if (b.freeze > 0) {
    c.fillStyle = 'rgba(0,0,8,' + Math.min(0.7, (40 - b.freeze) * 0.06 + 0.3) + ')';
    c.fillRect(-10, -10, W + 20, H + 20);
  }

  // キャラ（攻撃中・ラッシュ中の側を手前に）
  var order = b.p.slice().sort(function (a, z) { return (a.state === 'attack' || a.state === 'rush' ? 1 : 0) - (z.state === 'attack' || z.state === 'rush' ? 1 : 0); });
  order.forEach(function (f) {
    // ラッシュの残像
    if (f.state === 'rush' || (f.state === 'attack' && f.rushBonus) || (f.move && f.move.type === 'u' && b.freeze === 0)) {
      if (self.t % 3 === 0) { f.afterimg.push({ x: f.x, y: f.y, anim: f.anim, aF: f.aF, facing: f.facing, t: 12 }); }
    }
    f.afterimg.forEach(function (g) {
      g.t--;
      var fake = { kind: f.kind, anim: g.anim, aF: g.aF, facing: g.facing, animObj: function () { return f.A[g.anim]; } };
      c.save(); c.globalCompositeOperation = 'lighter';
      self.drawFighterImg(c, fake, g.x + ox, g.y, g.t / 30);
      c.restore();
    });
    f.afterimg = f.afterimg.filter(function (g) { return g.t > 0; });
    // 被弾側はヒットストップ中に左右に震える（だんだん収まる）
    var vib = 0;
    if (f.hs > 0 && f.hitShake && (f.state === 'hitstun' || f.state === 'launch' || f.state === 'blockstun')) {
      vib = (f.hs & 1 ? 1 : -1) * f.hitShake * Math.min(1, 0.35 + f.hs / (f.hitShakeT || 1));
    }
    self.drawFighterImg(c, f, f.x + ox + vib, f.y, 1);
    if (f.whiteT > 0) self.drawFighterWhite(c, f, f.x + ox + vib, f.y, f.whiteT >= 2 ? 0.9 : 0.5);
    else if (f.flash > 0) { // EX・被弾時の発光
      c.save(); c.globalCompositeOperation = 'lighter';
      self.drawFighterImg(c, f, f.x + ox + vib, f.y, f.flash / 14);
      c.restore();
    }
  });

  // 飛び道具・ビーム・柱
  b.projs.forEach(function (p) {
    if (p.kind === 'ball' && /^shock/.test(p.fx)) self.drawShock(c, p, p.x + ox);
    else if (p.kind === 'ball' && /^disc/.test(p.fx)) self.drawDisc(c, p, p.x + ox);
    else if (p.kind === 'ball') self.drawFxFrame(c, p.fx, (p.t >> 2), p.x + ox, p.y, p.vx < 0, 1);
    else if (p.kind === 'beam') {
      var meta = KF.Assets.fx[p.fx], img = KF.Assets.img['fx:' + p.fx];
      var fr = (p.t >> 1) % meta.n, seg = meta.w;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (var d = 0; d < p.len; d += seg - 2) {
        var x = p.dir > 0 ? p.x + d : p.x - d - seg;
        c.drawImage(img, fr * meta.w, 0, meta.w, meta.h, Math.round(x + ox), Math.round(p.y - meta.h / 2), seg, meta.h);
      }
      c.restore();
      self.drawFxFrame(c, p.head, (p.t >> 1), p.x + ox + p.dir * 6, p.y, p.dir < 0, 1);
    } else if (p.kind === 'pillar') {
      var m2 = KF.Assets.fx[p.fx];
      var fi = Math.min(m2.n - 1, Math.floor(p.t / 6));
      c.save(); c.globalCompositeOperation = 'lighter';
      c.drawImage(KF.Assets.img['fx:' + p.fx], fi * m2.w, 0, m2.w, m2.h, Math.round(p.x + ox - m2.w / 2), C.GROUND - m2.h + 6, m2.w, m2.h);
      c.restore();
    }
  });
  // ヒット火花など
  b.fx.forEach(function (e) {
    if (e.name === 'impact') { self.drawImpact(c, e, e.x + ox, e.y); return; }
    if (e.name === 'spk') { self.drawSpark(c, e, e.x + ox, e.y); return; }
    var m = KF.Assets.fx[e.name]; if (!m) return;
    var fi = Math.floor(e.t / (e.name === 'dust' ? 3 : e.name.indexOf('ring') === 0 ? 4 : 2));
    if (fi >= m.n) return;
    self.drawFxFrame(c, e.name, fi, e.x + ox, e.y - (e.name === 'dust' ? m.h / 2 - 4 : 0), e.flip, e.s);
  });

  // 雨（前景）

  if (this.debug) this.drawBoxes(c, b, ox);
  c.restore();
  this.drawHUD(b);
};

KF.Renderer.prototype.drawFxFrame = function (c, name, fi, x, y, flip, s, alpha) {
  var m = KF.Assets.fx[name], img = KF.Assets.img['fx:' + name];
  if (!m || !img) return;
  fi = fi % m.n; s = s || 1;
  c.save();
  c.globalCompositeOperation = 'lighter';
  if (alpha != null) c.globalAlpha = alpha;
  c.translate(Math.round(x), Math.round(y));
  if (flip) c.scale(-1, 1);
  var w = Math.round(m.w * s), h = Math.round(m.h * s);
  c.drawImage(img, fi * m.w, 0, m.w, m.h, -w / 2, -h / 2, w, h);
  c.restore();
};

KF.Renderer.prototype.drawRain = function (c) {
  var C = KF.CONST;
  c.save();
  for (var i = 0; i < this.rain.length; i++) {
    var d = this.rain[i];
    d.y += d.s; d.x -= d.s * 0.18;
    var gy = d.z > 0.5 ? C.GROUND + (d.z - 0.5) * 100 : C.GROUND - 20 + d.z * 40;
    if (d.y > gy) {
      if (d.z > 0.4 && this.splash.length < 60) this.splash.push({ x: d.x, y: gy, t: 0 });
      d.y = -10 - Math.random() * 40; d.x = Math.random() * 700;
    }
    c.strokeStyle = d.z > 0.7 ? 'rgba(170,200,255,0.45)' : 'rgba(120,140,210,0.25)';
    c.beginPath(); c.moveTo(Math.round(d.x), Math.round(d.y)); c.lineTo(Math.round(d.x + d.l * 0.18), Math.round(d.y - d.l)); c.stroke();
  }
  c.fillStyle = 'rgba(170,200,255,0.5)';
  this.splash.forEach(function (s) {
    s.t++;
    var r = s.t;
    c.fillRect(Math.round(s.x - r), Math.round(s.y), 1, 1); c.fillRect(Math.round(s.x + r), Math.round(s.y), 1, 1);
    if (s.t < 3) c.fillRect(Math.round(s.x), Math.round(s.y - 2), 1, 1);
  });
  this.splash = this.splash.filter(function (s) { return s.t < 5; });
  c.restore();
};

KF.Renderer.prototype.drawBoxes = function (c, b, ox) {
  b.p.forEach(function (f) {
    c.strokeStyle = 'rgba(80,255,120,0.9)';
    f.boxes('hurt').forEach(function (x) { c.strokeRect(x[0] + ox + 0.5, x[1] + 0.5, x[2], x[3]); });
    c.strokeStyle = 'rgba(255,60,60,1)';
    if (f.state === 'attack' && f.phase() === 'a') f.boxes('hit').forEach(function (x) { c.strokeRect(x[0] + ox + 0.5, x[1] + 0.5, x[2], x[3]); });
    c.strokeStyle = 'rgba(255,255,0,0.7)';
    c.strokeRect(f.x - f.D.pushW / 2 + ox + 0.5, f.y - 80.5, f.D.pushW, 80);
  });
  b.projs.forEach(function (p) {
    var bx = b.projBox(p); if (!bx) return;
    c.strokeStyle = 'rgba(255,60,60,1)'; c.strokeRect(bx[0] + ox + 0.5, bx[1] + 0.5, bx[2], bx[3]);
  });
};

// ------------------------------------------------------------------ HUD
KF.Renderer.prototype.text = function (s, x, y, size, color, align, glow, font) {
  // 文字（特に光るぼかし付き）は描くのが重いので、同じ文字・色・大きさなら一度描いた絵を貼るだけにする
  s = String(s);
  var key = s + '|' + size + '|' + color + '|' + (align || 'left') + '|' + (glow || '') + '|' + (font || '');
  var tc = this.txtCache || (this.txtCache = new Map());
  var e = tc.get(key);
  if (!e) {
    var cv = document.createElement('canvas'), c = cv.getContext('2d');
    var f = (font || '900 ') + size + 'px "Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif';
    c.font = f;
    var w = Math.ceil(c.measureText(s).width), pad = Math.ceil(size / 6) + (glow ? 12 : 3), h = Math.ceil(size * 1.5);
    cv.width = Math.max(1, w + pad * 2); cv.height = h + pad * 2;
    c.font = f; c.textAlign = 'left'; c.textBaseline = 'middle';
    if (glow) { c.shadowColor = glow; c.shadowBlur = 8; }
    c.lineWidth = Math.max(2, size / 6); c.strokeStyle = 'rgba(0,0,10,0.9)';
    c.strokeText(s, pad, pad + h / 2);
    c.fillStyle = color; c.fillText(s, pad, pad + h / 2);
    e = { cv: cv, w: w, pad: pad, h: h };
    // 文字はフォントの読み込み後に描かないと形が変わるので、読み込み前のものは取っておかない
    if (!document.fonts || document.fonts.status === 'loaded') { tc.set(key, e); if (tc.size > 600) tc.delete(tc.keys().next().value); }
  }
  var ox = align === 'center' ? -e.w / 2 : align === 'right' ? -e.w : 0;
  this.ctx.drawImage(e.cv, Math.round(x + ox - e.pad), Math.round(y - e.h / 2 - e.pad));
};

KF.Renderer.prototype.drawHUD = function (b) {
  var c = this.ctx, C = KF.CONST, self = this, t = this.t;
  // 上部の帯
  var g = c.createLinearGradient(0, 0, 0, 52);
  g.addColorStop(0, 'rgba(0,0,10,0.75)'); g.addColorStop(1, 'rgba(0,0,10,0)');
  c.fillStyle = g; c.fillRect(0, 0, 640, 52);
  b.p.forEach(function (f, i) {
    var L = i === 0, x0 = L ? 16 : 360, w = 264, y = 12, h = 13;
    var col = f.color || f.D.color;
    // 枠
    c.fillStyle = '#04040c'; c.fillRect(x0 - 2, y - 2, w + 4, h + 4);
    c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(x0 - 2.5, y - 2.5, w + 5, h + 5);
    c.fillStyle = '#1a0a14'; c.fillRect(x0, y, w, h);
    // 体力（減少分は赤く残る）
    var r = f.hp / f.D.hp, rt = Math.max(f.hp, f.hpTrail) / f.D.hp;
    function bar(ratio, style) {
      var bw = Math.round(w * ratio);
      c.fillStyle = style;
      if (L) c.fillRect(x0 + w - bw, y, bw, h); else c.fillRect(x0, y, bw, h);
    }
    bar(rt, '#e0244a');
    var hg = c.createLinearGradient(0, y, 0, y + h);
    var low = r < 0.25 && (t >> 3) % 2;
    hg.addColorStop(0, low ? '#ffffff' : '#fff6a0'); hg.addColorStop(0.5, low ? '#ffd060' : '#ffc21a'); hg.addColorStop(1, '#c07000');
    bar(r, hg);
    // 目盛り
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (var k = 1; k < 10; k++) c.fillRect(x0 + Math.round(w * k / 10), y, 1, h);
    // 名前
    self.text(f.D.name, L ? x0 + 2 : x0 + w - 2, y + h + 11, 11, '#ffffff', L ? 'left' : 'right', col);
    if (f.D.form) self.text(f.D.form, L ? x0 + 2 : x0 + w - 2, y + h + 23, 9, '#ffffff', L ? 'left' : 'right', f.D.color);   // 今の形態
    if (f.modern) self.text('M', L ? x0 + 2 + 76 : x0 + w - 2 - 76, y + h + 11, 10, '#ffe14a', 'center', '#ff8a00');   // モダン操作
    // ラッシュゲージ（6分割）
    var rx = L ? x0 + w - 150 : x0, ry = y + h + 5, rw = 150, seg = rw / 6;
    for (var s = 0; s < 6; s++) {
      var fill = Math.max(0, Math.min(1, (f.rush - s * C.RUSH_SEG) / C.RUSH_SEG));
      var sx = L ? rx + rw - (s + 1) * seg : rx + s * seg;
      c.fillStyle = '#05101c'; c.fillRect(Math.round(sx) + 1, ry, Math.round(seg) - 2, 5);
      if (fill > 0) {
        c.fillStyle = fill >= 1 ? (f.rushCD > 0 ? '#2a8f9c' : '#4ffff0') : '#1f6f7c';
        var fw = Math.round((seg - 2) * fill);
        c.fillRect(L ? Math.round(sx) + 1 + (Math.round(seg) - 2 - fw) : Math.round(sx) + 1, ry, fw, 5);
      }
    }
    self.text('RUSH', L ? rx - 4 : rx + rw + 4, ry + 3, 8, '#4ffff0', L ? 'right' : 'left');
    // ラウンド取得
    for (var k2 = 0; k2 < 2; k2++) {
      var px = L ? 296 - k2 * 12 : 344 + k2 * 12, py = 44;
      c.fillStyle = b.wins[i] > k2 ? col : '#1c1c2c';
      c.beginPath(); c.moveTo(px, py - 5); c.lineTo(px + 5, py); c.lineTo(px, py + 5); c.lineTo(px - 5, py); c.closePath(); c.fill();
      c.strokeStyle = '#ffffff55'; c.stroke();
    }
    // 必殺ゲージ（下部・3本）
    var bx = L ? 16 : 640 - 16 - 186, by = document.body.classList.contains('touchmode') ? 60 : 340;
    var bars = Math.floor(f.sup / C.SUPER_BAR);
    c.fillStyle = '#04040c'; c.fillRect(bx - 2, by - 2, 190, 11);
    for (var q = 0; q < 3; q++) {
      var fr = Math.max(0, Math.min(1, (f.sup - q * C.SUPER_BAR) / C.SUPER_BAR));
      var qx = L ? bx + q * 62 : bx + (2 - q) * 62;
      c.fillStyle = '#140a22'; c.fillRect(qx, by, 60, 7);
      var pg = c.createLinearGradient(qx, 0, qx + 60, 0);
      pg.addColorStop(0, fr >= 1 ? '#ffffff' : '#6a3cff'); pg.addColorStop(1, fr >= 1 ? col : '#9a5cff');
      c.fillStyle = pg;
      var qw = Math.round(60 * fr);
      c.fillRect(L ? qx : qx + 60 - qw, by, qw, 7);
      if (fr >= 1 && (t >> 2) % 6 === q) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(qx, by, 60, 7); }
    }
    self.text(String(bars), L ? bx + 196 : bx - 10, by + 2, 18, bars ? '#ffffff' : '#666', L ? 'left' : 'right', bars ? col : null);
    self.text('必殺', L ? bx : bx + 186, by - 9, 9, '#c9b0ff', L ? 'left' : 'right');
    // EXゲージ（必殺ゲージとは別枠・2本）
    var touch = document.body.classList.contains('touchmode');
    var ew = 46, ex0 = L ? bx + 40 : bx + 186 - 40 - ew * 2 - 4, ey = touch ? by + 14 : by - 13;
    c.fillStyle = '#04040c'; c.fillRect(ex0 - 2, ey - 2, ew * 2 + 8, 8);
    var exN = Math.floor((f.ex || 0) / C.EX_COST);
    for (var e2 = 0; e2 < 2; e2++) {
      var efr = Math.max(0, Math.min(1, ((f.ex || 0) - e2 * C.EX_COST) / C.EX_COST));
      var exx = L ? ex0 + e2 * (ew + 4) : ex0 + (1 - e2) * (ew + 4);
      c.fillStyle = '#1e1806'; c.fillRect(exx, ey, ew, 4);
      c.fillStyle = efr >= 1 ? '#ffd23c' : '#9a7a20';
      var eww = Math.round(ew * efr);
      c.fillRect(L ? exx : exx + ew - eww, ey, eww, 4);
      if (efr >= 1 && (t >> 2) % 8 === e2) { c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(exx, ey, ew, 4); }
    }
    self.text('EX', L ? ex0 + ew * 2 + 10 : ex0 - 8, ey - 2, 9, exN ? '#ffd23c' : '#7a6a40', L ? 'left' : 'right');
    // コンボ数・ダメージ
    var def = f.opp;
    if (def.combo >= 2 || (def.dmgPop && def.dmgPop.t > 0 && def.combo >= 2)) f._comboShow = { n: def.combo, d: def.comboDmg, t: 70 };
    if (f._comboShow) {
      var cs = f._comboShow; cs.t--;
      if (cs.t > 0) {
        var cxp = L ? 24 : 616, al = L ? 'left' : 'right';
        self.text(cs.n + ' HITS', cxp, 120, 22, '#ffe14a', al, '#ff8a00');
        self.text(cs.d + ' ダメージ', cxp, 142, 11, '#ffffff', al);
      } else f._comboShow = null;
    }
  });
  // タイマー
  c.fillStyle = '#04040c'; c.fillRect(298, 4, 44, 34);
  c.strokeStyle = '#8a7cff'; c.strokeRect(298.5, 4.5, 43, 33);
  self.text(b.training ? '∞' : String(b.timer), 320, 22, 24, b.timer <= 10 && !b.training ? '#ff5060' : '#ffffff', 'center', '#6a5cff');
  // アナウンス
  this.drawAnnounce(b);
};

KF.Renderer.prototype.announce = function (e) {
  this.ann.push({ text: e.text, big: e.big, small: e.small, side: e.side, t: 0 });
};
KF.Renderer.prototype.drawAnnounce = function (b) {
  var self = this;
  this.ann.forEach(function (a) {
    a.t++;
    var life = a.small ? 50 : 70;
    var k = a.t / life;
    if (a.small) {
      var x = a.side === 1 ? 616 : 24;
      self.text(a.text, a.side == null ? 320 : x, 172, 16, '#ff7af0', a.side == null ? 'center' : (a.side === 1 ? 'right' : 'left'), '#ff00aa');
    } else {
      var sz = a.big ? 64 : 40;
      var sc = a.t < 6 ? 1.6 - a.t * 0.1 : 1;
      var al = k > 0.8 ? (1 - k) / 0.2 : 1;
      self.ctx.globalAlpha = Math.max(0, al);
      self.text(a.text, 320, 165, Math.round(sz * sc), a.text.indexOf('KO') >= 0 ? '#ff3a5a' : '#ffffff', 'center', a.text === 'FIGHT' ? '#00e5ff' : '#ff00cc');
      self.ctx.globalAlpha = 1;
    }
  });
  this.ann = this.ann.filter(function (a) { return a.t < (a.small ? 50 : 70); });
  if (this.superBanner) {
    var sb = this.superBanner; sb.t++;
    if (sb.t < 60) {
      var c = this.ctx, y = 236;
      var slide = Math.min(1, sb.t / 8);
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, y - 16, 640, 32);
      c.fillStyle = sb.color; c.fillRect(0, y - 16, 640, 2); c.fillRect(0, y + 14, 640, 2);
      var x = sb.side === 0 ? -200 + 330 * slide : 840 - 330 * slide;
      this.text(sb.name, x, y, 22, '#ffffff', 'center', sb.color);
    } else this.superBanner = null;
  }
};
