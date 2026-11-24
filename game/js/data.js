// =====================================================================
//  キャラクター技データ（独自の技名・数値）
//  タイミング（発生・持続・硬直）は anims.json のフレーム段階から決まる。
//  adv:[ヒット時有利, ガード時有利]  hs:ヒットストップ  push:[ヒット時, ガード時]ノックバック
//  lv: m=上中段 l=下段 o=中段(立ちガード必須)  cancel: c=弱連打 s=必殺技 u=超必殺 r=ラッシュ
// =====================================================================
'use strict';
var KF = window.KF || (window.KF = {});

KF.CONST = {
  W: 640, H: 360, GROUND: 300, WORLD_W: 1024, WALL: 36,
  GRAVITY: 0.62, JUMP_VY: -18.5, JUMP_G: 0.974, JUMP_VXK: 40 / 38, JUMP_VX: 3.6,   // ジャンプはスト6と同じくらい：滞空38F・最高点176px（体の約1.2倍）。横に跳ぶ距離は前と同じ
  RUSH_MAX: 6000, RUSH_SEG: 1000, RUSH_NEUTRAL_COST: 1000, RUSH_CANCEL_COST: 3000,
  RUSH_REGEN: 5, RUSH_REGEN_FWD: 7, RUSH_COOLDOWN: 90, RUSH_BONUS_ADV: 4, RUSH_REC_CUT: 5,
  SUPER_MAX: 3000, SUPER_BAR: 1000, EX_COST: 2000, EX_MAX: 6000,   // EX技はラッシュと同じゲージ（6本）を2本使う。2本ないときも、少しでも残っていれば出せる（ゲージは0になる）。超必殺のゲージ（3本）は別
  PARRY_COST: 500, PARRY_DRAIN: 4, PARRY_GAIN: 250, JPARRY_GAIN: 1000, PARRY_MIN: 8, PARRY_WHIFF: 14, JPARRY_WIN: 2, JPARRY_STOP: 22, PARRY_THROW_SCALE: 1.5,
  EMPTY_LOCK: 300,      // ゲージを使い切ったら5秒（300F）は増えない
  RAW_RUSH_COST: 500,   // パリィ（0.5本）から→→で出すラッシュは、パリィと合わせて1本
  CHORD: 3,             // 同時押しの猶予：技が出て3F以内にもう1つ押せば、EX技・投げに切り替わる
  ROUND_TIME: 99, JUGGLE_LIMIT: 3,
  SCALING: [1.0, 1.0, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1],   // スト6と同じ（10ヒット目以降は10%）
  RUSH_CANCEL_SCALE: 0.85,
  THROW_RANGE: 88, THROW_TECH_WINDOW: 10,
};

KF.CHARS = {
  kokuu: {
    name: '道着キャラ男', en: 'KOKUU', hp: 10000, walkF: 3.9, walkB: 2.66,   // 歩きはスト6のリュウと同じ（前0.047・後ろ0.032 × 約83ドット）
    dashF: 7.2, dashB: -6.4,
    jumpVX: 3.6, color: '#38d6ff', fx: 'k', pushW: 34, prefRange: [110, 190],
    moves: {
      lp:  { anim: 'lp', dmg: 300, adv: [4, 1], hs: 8, push: [3, 4], lv: 'm', cancel: 'csur', light: 1 },
      mp:  { anim: 'mp', dmg: 600, tc: { btn: 'hp', id: 'tc_hp' }, adv: [7, 1], hs: 10, push: [5, 5.5], lv: 'm', cancel: 'sur' },
      hp:  { anim: 'hp', heavy: 1, dmg: 900, adv: [3, -3], hs: 12, push: [4, 7], lv: 'm', cancel: 'sur' },
      lk:  { anim: 'lk', dmg: 300, adv: [3, -1], hs: 8, push: [3, 4], lv: 'm', cancel: 'csur', light: 1 },
      mk:  { anim: 'mk', dmg: 650, tc: { btn: 'hk', id: 'tc_hk' }, adv: [3, -2], hs: 10, push: [6, 6], lv: 'm', cancel: '' },
      hk:  { anim: 'hk', heavy: 1, dmg: 950, adv: [2, -4], hs: 12, push: [7, 8], lv: 'm', cancel: '', pcLaunch: [-10.0, 0.4] },
      c_lp: { anim: 'c_lp', dmg: 280, adv: [4, 1], hs: 8, push: [3, 4], lv: 'm', cancel: 'csur', light: 1, crouch: 1 },
      c_mp: { anim: 'c_mp', dmg: 550, adv: [5, 2], hs: 10, push: [5, 5.5], lv: 'm', cancel: 'sur', crouch: 1 },
      c_hp: { anim: 'c_hp', heavy: 1, dmg: 850, adv: [1, -6], hs: 12, push: [5, 6], lv: 'm', cancel: 'sur', crouch: 1, aa: 1, jlim: 0, lvy: -7, lvx: 1.2 },
      c_lk: { anim: 'c_lk', dmg: 250, adv: [2, -1], hs: 8, push: [3, 4], lv: 'l', cancel: 'csur', light: 1, crouch: 1 },
      c_mk: { anim: 'c_mk', dmg: 500, adv: [1, -4], hs: 10, push: [6, 6], lv: 'l', cancel: 'sur', crouch: 1 },
      c_hk: { anim: 'c_hk', heavy: 1, dmg: 900, adv: ['kd', -12], hs: 12, push: [3, 7], lv: 'l', cancel: 'r', crouch: 1, kd: 'sweep' },
      j_lp: { anim: 'j_p', dmg: 450, stun: [16, 12], hs: 8, push: [3, 3], lv: 'o', air: 1 },
      j_mp: { anim: 'j_p', dmg: 600, stun: [18, 14], hs: 10, push: [3, 3], lv: 'o', air: 1 },
      j_hp: { anim: 'j_hp', dmg: 850, stun: [22, 17], hs: 12, push: [3, 3], lv: 'o', air: 1 },
      j_lk: { anim: 'j_k', dmg: 450, stun: [16, 12], hs: 8, push: [3, 3], lv: 'o', air: 1, cancel: 'a' },
      j_mk: { anim: 'j_k', dmg: 600, stun: [18, 14], hs: 10, push: [3, 3], lv: 'o', air: 1, cancel: 'a' },
      j_hk: { anim: 'j_hk', dmg: 900, stun: [22, 17], hs: 12, push: [3, 3], lv: 'o', air: 1, cancel: 'a' },
      tc_hp: { anim: 'hp', name: 'ターゲットコンボ', dmg: 800, adv: [2, -4], hs: 12, push: [4, 7], lv: 'm', cancel: 'sur', heavy: 1 },
      tc_hk: { anim: 'hk', name: 'ターゲットコンボ', dmg: 850, adv: [2, -5], hs: 12, push: [5, 7], lv: 'm', cancel: 'su', heavy: 1 },
      // 特殊技（方向＋ボタン）
      f_mp: { anim: 'f_mp', name: '鎚打ち', dmg: 600, adv: [1, -3], hs: 11, push: [4, 5], lv: 'o', cancel: '' },
      f_hp: { anim: 'f_hp', name: '踏破肘', dmg: 800, adv: [2, -2], hs: 12, push: [4, 6], lv: 'm', cancel: 'sur', heavy: 1 },
      b_hk: { anim: 'b_hk', name: '旋踵', dmg: 800, adv: [4, 1], hs: 13, push: [5, 6], lv: 'm', cancel: 'sur', heavy: 1 },
      throw: { anim: 'throw', type: 't', dmg: 1200, doAnim: 'throw_do' },
      // 必殺技
      fire: { anim: 'sp_fire', type: 's', name: '虚環弾', dmg: 600, adv: [2, -4], hs: 10, push: [6, 6], lv: 'm', chip: 0.125,
              proj: { fx: 'ball_k', spd: [3.6, 4.8, 7.2], life: 160, hits: 1, r: 14 }, meter: 40, cancel: 'u',
              lvy: -3.5, lvx: 0.5, floatG: 0.35 },   // 浮いた相手に当たると、近くにふわっと浮かせ直す。当たったらラッシュでキャンセルできる
      // EX虚環弾：ゆっくり飛ぶ。1発目で相手を少し浮かせて後ろへ飛ばし、弾は少し止まってから追いかけて、飛んだ先で2発目が当たる
      fire_ex: { anim: 'ex_fire', type: 'x', name: 'EX虚環弾', dmg: 450, adv: [6, 0], hs: 10, push: [6, 6], lv: 'm', chip: 0.125,
              proj: { fx: 'ball_k_ex', spd: [5.0, 5.0, 5.0], life: 200, hits: 2, r: 18, rehit: 8, stop: 10, lead: 20, chaseSpd: 5.0 }, cancel: 'u',
              kd: 'launch', lvy: -5.5, lvx: 2.0, floatG: 0.25 },
      // 昇穿：スト6の昇龍拳と同じ。発生 弱5F・中6F・強7F／空中の攻撃にだけ無敵 弱1-14F・中1-9F・強1-8F／ガード -23・-32・-39F
      dp: { anim: 'sp_dp', type: 's', name: '昇穿', dmg: [1000, 1200, 1400], adv: ['kd', [-31, -36, -39]], hs: 12, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch', jlim: 2, jinc: 3, cancel: 'u', saGround: 1, saOnly: ['su3'], rootF: [2, 2, 1], rootDmg: 800,
            preDelay: [2, 3, 4], aaInv: [[1, 14], [1, 9], [1, 8]], jump: { vx: [1.6, 2.2, 2.8], vy: [-9.5, -10.8, -12.0] }, lvy: -9, lvx: 2.5, meter: 40 },
      dp_ex: { anim: 'ex_dp', type: 'x', name: 'EX昇穿', dmg: 800, adv: ['kd', -34], hs: 12, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch', hits: 2, rehit: 7, jlim: 3, jinc: 3, cancel: 'u', saGround: 1, saOnly: ['su2', 'su3'],
            preDelay: 3, inv: [[1, 9]], jump: { vx: [2.4], vy: [-12.4] }, lvy: -6, lvx: 0.6, floatG: 0.23, hangVy: false, jugAfter: 1, jg: 1 },   // 当てたら着地後の昇穿がギリギリつながる（強は着地直後の2F、弱は4F）   // EX：発生は中と同じ6F・完全無敵
      // 迅閃脚：下段スライディング。飛び道具をくぐり、当たるとダウン。ガードされると大きく不利。間合いは弱＜中＜強
      rushk: { anim: 'sp_slide', type: 's', name: '迅閃脚', dmg: [800, 900, 1000], adv: ['kd', -10], hs: 12, push: [3, 6], lv: 'l', chip: 0.125,
               kd: 'sweep', projInv: 1, jlim: 0, dash: { vx: [4.6, 5.8, 7.0], vy: 0 }, meter: 40 },   // 発生8F・持続13F。弱中強で遠くまで滑る
      rushk_ex: { anim: 'ex_rush', type: 'x', name: 'EX迅閃脚', dmg: 700, hs: 12, push: [4, 7], lv: 'm', chip: 0.125, hits: 2, rehit: 9,
               dash: { vx: [8.5], vy: -3.5, g: 0.36 }, projInv: 1, kd: 'launch', lvy: -7, lvx: 3 },   // 低く長く飛ぶ（持続18F・進む距離 約1.7倍）
      // 旋風脚：コンボの部品。最後の1発で浮かせ、昇穿や超必殺で追撃できる。弱＝その場で高く／中＝運ぶ／強＝画面端まで運ぶ
      tatsu: { anim: 'sp_tatsu', type: 's', name: '旋風脚', dmg: [300, 320, 340], hits: 3, rehit: 7, hs: 8, push: [1.2, 3], lv: 'm', chip: 0.125,
               dash: { vx: [2.0, 7.2, 10.4], vy: 0 }, aSlow: [1, 1, 0.667], kdLast: 'launch', lvy: [-9.0, -8.6, -8.2], lvx: [0.8, 1.6, 2.4], jset: 1, jlim: 1, cancel: 'u', meter: 40,
               projInv: [0, 0, 1], noCombo: [0, 0, 1] },   // 中は2倍・強は3倍進む（強は速さ2/3で、回る時間を1.5倍にして同じ距離）。強は飛び道具を抜け、コンボの途中の相手には当たらない（何からもつながらない）
      atatsu: { anim: 'sp_atatsu', type: 's', name: '空旋脚', air: 1, dmg: 350, hits: 2, rehit: 7, hs: 8, push: [2, 3], lv: 'm', stun: [16, 12], stall: [2.4, 3.0, 3.6], jlim: 2,
               airSpike: { vy: 7, vx: 0.8 } },   // 浮いた相手に当てると、最後の1発で地面へ叩きつけて床でバウンド
      // 斬空虚環弾：空中で ↓↘→ + P。斜め下へ虚環弾を撃つ（弱ほど急な角度）。撃つあいだは空中で少し止まる
      zanku: { anim: 'zanku', type: 's', name: '斬空虚環弾', air: 1, dmg: 500, hs: 10, push: [4, 4], lv: 'm', chip: 0.125, stall: [0], jlim: 2,
               proj: { fx: 'ball_k', spd: [3.0, 3.8, 4.6], vy: [3.4, 2.7, 2.0], life: 140, hits: 1, r: 14 }, meter: 40, lvy: -3.5, lvx: 0.5, floatG: 0.35 },
      // EX斬空虚環弾：地上のEX虚環弾と同じく2回当たる大きい弾
      zanku_ex: { anim: 'zanku', type: 'x', name: 'EX斬空虚環弾', air: 1, dmg: 450, hs: 10, push: [4, 5], lv: 'm', chip: 0.125, stall: [0], jlim: 3,
               proj: { fx: 'ball_k_ex', spd: [4.2], vy: [2.6], life: 160, hits: 2, r: 18, rehit: 8 }, kd: 'launch', lvy: -5.5, lvx: 1.2, floatG: 0.3 },
      palm: { anim: 'sp_palm', type: 's', name: '虚掌破', dmg: 1100, adv: [0, -8], hs: 13, push: [2, 7], lv: 'm', chip: 0.125,
              kd: 'launch', lvy: -6, lvx: 14, lvxDrag: 0.92, floatG: 0.3125, jset: -1, jlim: 0, cancel: 'u', meter: 40,   // 強さの違いは無し（弱・中・強どれも同じ）。横に吹っ飛んでから止まる：画面中央では強Pが届かず、画面端では壁で止まって届く
              addScale: 0.5,   // 追加補正：当てたあとのコンボのダメージが ×0.5
              preDelay: 10 },   // 発生24F。のけぞりの長い強P系からだけつながり、弱・中からは出るがつながらない
      // EX虚掌破：発生7F。弱・中・強どの通常技からでもつながる
      palm_ex: { anim: 'ex_palm', type: 'x', name: 'EX虚掌破', dmg: 1000, adv: [0, -4], hs: 13, push: [2, 6], lv: 'm', chip: 0.125,
              kd: 'launch', lvy: -8, lvx: 0.6, jset: 0, jlim: 0, cancel: 'u', floatG: 0.275, dashS: 5.5 },   // 前に踏み込みながら打つ。ふわっと浮かせて、ジャンプで追いかけて拾える
      su3: { anim: 'su_3', type: 'u', bars: 3, name: '天地穿', dmg: 769, hits: 7, rehit: 5, hs: 6, push: [0.3, 2], lv: 'm', chip: 0.25,
             inv: [[1, 44]], lock: 1, lockAir: 1, dashS: 7, jump: { vx: [0.8], vy: [-10] }, kdLast: 'launch', lvy: -12, lvx: 2.5, lastDmg: 2310, minScale: 0.5, imm: 0.1 },   // 即時補正10%（生当ては4000）
      su1: { anim: 'su_1', type: 'u', bars: 1, name: '虚空砲', dmg: 488, lastDmg: 487, hits: 5, rehit: 8, hs: 6, push: [1.5, 2], lv: 'm', chip: 0.25,
             inv: [[1, 14]], beam: { fx: 'beam_k', head: 'beamhead_k', len: 600, h: 34 }, kdLast: 'launch', lvy: -8, lvx: 4, minScale: 0.3 },
      su2: { anim: 'su_2', type: 'u', bars: 2, name: '零界継承', dmg: 464, hits: 9, rehit: 6, hs: 6, push: [0.5, 4], lv: 'm', chip: 0.25,
             inv: [[1, 26]], lock: 1, dashS: 9.0, kdLast: 'launch', lvy: -11, lvx: 3, lastDmg: 1236, minScale: 0.4, minTotal: 1250 },   // 生当て3000・最低保証1250
    },
  },
};

// 必殺技コマンド（優先順位が上のものから判定）
KF.COMMANDS = {
  kokuu: [
    { seq: [2, 3, 6, 2, 3, 6], altL: [[2, 3, 6, 2, 6], [2, 6, 2, 3, 6]], btn: 'P', win: 26, move: 'su1' },
    { seq: [2, 1, 4, 2, 1, 4], altL: [[2, 1, 4, 2, 4], [2, 4, 2, 1, 4]], btn: 'P', win: 28, move: 'su2' },
    { seq: [2, 3, 6, 2, 3, 6], altL: [[2, 3, 6, 2, 6], [2, 6, 2, 3, 6]], btn: 'K', win: 26, move: 'su3' },
    { seq: [6, 2, 3], dp: 1, btn: 'P', win: 14, move: 'dp' },
    { seq: [2, 3, 6], btn: 'P', win: 12, move: 'fire' },
    { seq: [2, 1, 4], btn: 'K', win: 12, move: 'tatsu' },   // 旋風脚は ↓↙← + K、迅閃脚は ↓↘→ + K（入れ替えた）
    { seq: [2, 1, 4], btn: 'K', win: 12, move: 'atatsu', air: 1 },
    { seq: [2, 3, 6], btn: 'P', win: 12, move: 'zanku', air: 1 },
    { seq: [2, 1, 4], btn: 'P', win: 12, move: 'palm' },
    { seq: [2, 3, 6], btn: 'K', win: 12, move: 'rushk' },
  ],
};

KF.MOVE_LIST = {
  kokuu: [
    ['特殊技 鎚打ち（中段）', '→ + 中P'], ['特殊技 踏破肘', '→ + 強P'], ['特殊技 旋踵（ガードさせて有利）', '← + 強K'],
    ['ターゲットコンボ 連破 / 双蹴', '中P ～ 強P ／ 中K ～ 強K'], ['強K（パニッシュカウンターで浮く）', '強K'],
    ['虚環弾', '↓↘→ + P'], ['昇穿（対空・無敵。EXは当てたら着地後に昇穿で追撃できる）', '→↓↘ + P（前→下→前 なら出る）'], ['旋風脚（強は飛び道具を抜けるが、コンボにはつながらない） / 空中で空旋脚（空中Kからも出せる。浮いた相手は叩きつけて床バウンド）', '↓↙← + K'], ['斬空虚環弾（空中で斜め下へ撃つ。EXは2回当たる）', '空中で ↓↘→ + P'],
    ['虚掌破（強P系からつながる。相手を遠くへ飛ばし、画面端以外では強Pで拾えない。強さの違いは無し。EXは高く浮かせてジャンプで追撃）', '↓↙← + P'], ['迅閃脚（下段スライディング）', '↓↘→ + K'], ['EX必殺技', '各コマンド + ボタン2つ（EX/RUSHゲージ2本。足りなくても少しあれば出せる）'],
    ['超必殺 虚空砲 / 天地穿', '↓↘→↓↘→ + P（1本） / + K（3本）'], ['超必殺 零界継承', '↓↙←↓↙← + P（2本）'],
    ['投げ / パリィ・ラッシュ', '弱P+弱K（つかまれたら弱P+弱Kで抜け） / パリィ（押している間。出始めで受けるとジャストパリィ）／パリィ中に →→ でラッシュ（合わせて1本）／技の途中でパリィか →→ でラッシュキャンセル（3本）'],
  ],
};

// コンボ表（＞=キャンセル　，=目押し　～=ターゲットコンボ）。テストで同じ手順の成立を確認する
//  steps: {b, d, m:[コマンド]}  link:1=目押し（硬直が解けてから押す） noHit:1=当たりを待たない  wait=押すまでのF
KF.COMBOS = {
  // 変身キャラ男（ハンマー形態から始める）
  // 変身キャラ男（大盾形態から始める）
  kokuu: [
    // ---- 基本
    { name: '弱攻撃からダウン', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ 弱P ＞ 迅閃脚', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { b: 'lp' }, { m: [2, 3, 6], b: 'lk' }] },
    { name: '弱攻撃から浮かせ', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ 弱旋風脚 ， 昇穿', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { m: [2, 1, 4], b: 'lk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '差し込み', text: 'しゃがみ中K ＞ 虚環弾', steps: [{ d: 2, b: 'mk' }, { m: [2, 3, 6], b: 'lp' }] },
    { name: '差し込みから浮かせ', text: 'しゃがみ中K ＞ 中旋風脚 ， 昇穿', steps: [{ d: 2, b: 'mk' }, { m: [2, 1, 4], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ターゲットコンボ', text: '中P ～ 強P ＞ 中旋風脚 ， 昇穿', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 1, 4], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '目押し', text: '中P ， しゃがみ中P ＞ 弱旋風脚 ， 昇穿', steps: [{ b: 'mp' }, { d: 2, b: 'mp', link: 1 }, { m: [2, 1, 4], b: 'lk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ターゲットコンボ2', text: '中K ～ 強K ＞ 虚環弾', steps: [{ b: 'mk' }, { b: 'hk' }, { m: [2, 3, 6], b: 'lp' }] },
    { name: '旋踵から', text: '←強K（旋踵）＞ 中旋風脚 ， 昇穿', steps: [{ d: 4, b: 'hk' }, { m: [2, 1, 4], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '虚掌破から', corner: 1, text: '（画面端）強P ＞ 虚掌破 ， 弱旋風脚 ， 昇穿', steps: [{ b: 'hp' }, { m: [2, 1, 4], b: 'hp' }, { m: [2, 1, 4], b: 'lk', link: 1 }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'EX虚掌破（弱攻撃から）', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ EX虚掌破 ， しゃがみ強P ＞ 昇穿（ゲージ2本）', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { m: [2, 1, 4], b: 'lp,mp' }, { d: 2, b: 'hp', link: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    { name: '虚掌破から対空', corner: 1, text: '（画面端）虚掌破 ， しゃがみ強P ＞ 昇穿', steps: [{ m: [2, 1, 4], b: 'hp' }, { d: 2, b: 'hp', link: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    // ---- 応用
    { name: '飛び込み', text: 'ジャンプ強K ， 中P ～ 強P ＞ 中旋風脚 ， 昇穿', jumpIn: 'hk', steps: [{ b: 'mp', link: 1 }, { b: 'hp' }, { m: [2, 1, 4], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'パニッシュカウンター', text: '（相手の空振りに）強K ， 中旋風脚 ， 昇穿', punish: 'hk', steps: [{ m: [2, 1, 4], b: 'mk', link: 1 }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ラッシュキャンセル', text: 'しゃがみ中K ＞ ラッシュ ～ 強P ＞ 中旋風脚 ， 昇穿（ラッシュ3本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [2, 1, 4], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ラッシュ強Kから', text: 'しゃがみ中K ＞ ラッシュ ～ 強K ， 強P ＞ 中旋風脚 ， 昇穿（ラッシュ3本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hk', wait: 7, noHit: 1 }, { b: 'hp', link: 1 }, { m: [2, 1, 4], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ダブルラッシュ', text: 'しゃがみ中K ＞ ラッシュ ～ 強P ＞ ラッシュ ～ 中P ～ 強P ＞ 中旋風脚 ， 昇穿（ラッシュ6本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { b: 'rush' }, { b: 'mp', wait: 7, noHit: 1 }, { b: 'hp' }, { m: [2, 1, 4], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '確定反撃', text: '強P ＞ 昇穿', steps: [{ b: 'hp' }, { m: [6, 2, 3], b: 'hp' }] },
    { name: '特殊技から', text: '→強P（踏破肘）＞ 迅閃脚', gap: 66, steps: [{ d: 6, b: 'hp' }, { m: [2, 3, 6], b: 'mk' }] },
    // ---- 超必殺
    { name: '超必殺', text: 'しゃがみ中K ＞ 虚空砲（1本）', steps: [{ d: 2, b: 'mk' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp' }], sup: 1000 },
    { name: '超必殺 浮かせから', text: '中P ～ 強P ＞ 中旋風脚 ＞ 虚空砲（1本）', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 1, 4], b: 'mk' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp', wait: 4, noHit: 1 }], sup: 1000 },
    { name: '超必殺 密着', text: '強P ＞ 虚空砲（1本・密着でも根元が当たる）', gap: 36, steps: [{ b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp' }], sup: 1000 },
    { name: '超必殺 虚掌破から', corner: 1, text: '（画面端）虚掌破 ， 虚空砲（1本）', steps: [{ m: [2, 1, 4], b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp', link: 1 }], sup: 1000 },
    { name: '超必殺2', text: '中P ～ 強P ＞ 零界継承（2本）', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 1, 4, 2, 1, 4], b: 'hp' }], sup: 2000 },
    { name: '超必殺3', text: '中P ～ 強P ＞ 中旋風脚 ＞ 天地穿（3本）', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 1, 4], b: 'mk' }, { m: [2, 3, 6, 2, 3, 6], b: 'hk', wait: 4, noHit: 1 }], sup: 3000 },
    { name: '昇竜SA', text: '強昇穿（根本）＞ 天地穿（3本）', steps: [{ m: [6, 2, 3], b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hk' }], sup: 3000 },
    { name: '確定反撃 昇竜SA', text: '強P ＞ 強昇穿 ＞ 天地穿（3本）', steps: [{ b: 'hp' }, { m: [6, 2, 3], b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hk' }], sup: 3000 },
    { name: 'EX昇竜SA', text: 'EX昇穿 ＞ 零界継承（ゲージ2本＋必殺2本）', steps: [{ m: [6, 2, 3], b: 'lp,mp' }, { m: [2, 1, 4, 2, 1, 4], b: 'hp' }], sup: 2000 },
    { name: 'パニッシュカウンター超必殺', text: '（相手の空振りに）強K ， 虚空砲（1本）', punish: 'hk', steps: [{ m: [2, 3, 6, 2, 3, 6], b: 'hp', link: 1 }], sup: 1000 },
  ],
};

// 対空技の攻撃判定の補正（密着の立ち・しゃがみの相手にも当たるよう、下と前に伸ばす）
KF.HIT_FIX = {
  'gai:c_hp': { y1: -60, x0: -4 },
  'gai:sp_upper': { y1: -60 },
  'gai:sp_lift': { y1: -60 },
  'kokuu:c_hp': { y1: -86 },
  'kokuu:c_mk': { reach: 1.3 },   // 中足：リーチ1.3倍
  'kokuu:sp_palm': { y1: -84 },
  'kokuu:ex_palm': { y1: -84 },
  'kokuu:sp_dp': { y1: -96 },
  'kokuu:ex_dp': { y1: -96 },
};

// 紺野ユイ：今は道着キャラ男（kokuu）と同じ技・判定を使う（攻撃の絵はまだ無いので、攻撃中は仮の絵）
KF.CHARS.yui = Object.assign({}, KF.CHARS.kokuu, { name: '紺野ユイ', en: 'YUI', color: '#5c8dff' });
KF.COMMANDS.yui = KF.COMMANDS.kokuu;
if (KF.MOVE_LIST.kokuu) KF.MOVE_LIST.yui = KF.MOVE_LIST.kokuu;
if (KF.COMBOS.kokuu) KF.COMBOS.yui = KF.COMBOS.kokuu;
KF.HIT_FIX['yui:sp_dp'] = KF.HIT_FIX['kokuu:sp_dp'];
KF.HIT_FIX['yui:ex_dp'] = KF.HIT_FIX['kokuu:ex_dp'];
KF.HIT_FIX['yui:c_mk'] = KF.HIT_FIX['kokuu:c_mk'];
KF.kokuuType = function (k) { return k === 'kokuu' || k === 'yui'; };
