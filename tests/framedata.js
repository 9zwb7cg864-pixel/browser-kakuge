// 全通常技・必殺技のフレームデータと、実測の硬直差・判定一致を確認
const { KF, meta, inp, N } = require('./harness');
function fresh(p1, p2, gap) {
  const b = new KF.Battle({ p1, p2, meta });
  for (let i = 0; i < 130; i++) b.step([N(), N()]);
  b.p[0].x = 470; b.p[1].x = 470 + gap; b.camX = 512;
  b.p[0].facing = 1; b.p[1].facing = -1;
  return b;
}
function measure(kind, id, dirBtn, block, gap) {
  const b = fresh(kind, 'kokuu', gap);
  const def = b.p[1];
  // 防御側：block=trueなら後ろ（右向きの相手にとって後ろ=+x方向）を押し続ける
  const dIn = block ? (block === 'low' ? inp(3) : inp(6)) : N();
  b.step([inp(dirBtn[0], dirBtn[1]), dIn]);
  let res = { hit: false, blocked: false, adv: null, contactFrame: null };
  for (let f = 1; f < 120; f++) {
    const ev0 = b.events.length;
    b.step([N(), dIn]);
    for (const e of b.events.slice(ev0)) {
      if ((e.type === 'hit' || e.type === 'block') && res.contactFrame == null) { res.contactFrame = f; res[e.type === 'hit' ? 'hit' : 'blocked'] = true; }
      if (e.type === 'adv' && res.adv == null) res.adv = e.v;
    }
  }
  return res;
}
const rows = [];
for (const kind of ['kokuu']) {
  const A = meta[kind].anims, M = KF.CHARS[kind].moves;
  for (const id of ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'c_lp', 'c_mp', 'c_hp', 'c_lk', 'c_mk', 'c_hk']) {
    const a = A[M[id].anim];
    const act = a.frames.filter(f => f.ph === 'a').reduce((s, f) => s + f.d, 0);
    const noHit = a.frames.filter(f => f.ph === 'a' && !(f.hit && f.hit.length)).length;
    const btn = id.replace('c_', ''), dir = id.startsWith('c_') ? 2 : 5;
    // 一番近い間合い（押し合いの最小距離）で測る
    const gap = 44;
    const h = measure(kind, id, [dir, btn], false, gap);
    const bl = measure(kind, id, [dir, btn], M[id].lv === 'l' ? 'low' : 'high', gap);
    rows.push({ kind, id, startup: a.firstActive + 1, active: act, recovery: a.total - a.lastActive - 1, total: a.total,
      contact: h.contactFrame, advHit: h.hit ? h.adv : 'whiff', advBlock: bl.blocked ? bl.adv : (bl.hit ? 'HIT(ガード不可?)' : 'whiff'),
      design: JSON.stringify(M[id].adv), activeNoHitbox: noHit });
  }
}
console.table(rows);
