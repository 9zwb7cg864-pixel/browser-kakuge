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
  SCALING: [1.0, 1.0, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25, 0.2],
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
              proj: { fx: 'ball_k', spd: [3.6, 4.8, 6.0], life: 160, hits: 1, r: 14 }, meter: 40, cancel: 'ur',
              lvy: -3.5, lvx: 0.5, floatG: 0.35 },   // 浮いた相手に当たると、近くにふわっと浮かせ直す。当たったらラッシュでキャンセルできる
      // EX虚環弾：ゆっくり飛ぶ。1発目で相手を少し浮かせて後ろへ飛ばし、弾は少し止まってから追いかけて、飛んだ先で2発目が当たる
      fire_ex: { anim: 'ex_fire', type: 'x', name: 'EX虚環弾', dmg: 450, adv: [6, 0], hs: 10, push: [6, 6], lv: 'm', chip: 0.125,
              proj: { fx: 'ball_k_ex', spd: [5.0, 5.0, 5.0], life: 200, hits: 2, r: 18, rehit: 8, stop: 10, lead: 20, chaseSpd: 5.0 }, cancel: 'u',
              kd: 'launch', lvy: -5.5, lvx: 2.0, floatG: 0.25 },
      // 昇穿：スト6の昇龍拳と同じ。発生 弱5F・中6F・強7F／空中の攻撃にだけ無敵 弱1-14F・中1-9F・強1-8F／ガード -23・-32・-39F
      dp: { anim: 'sp_dp', type: 's', name: '昇穿', dmg: [1000, 1200, 1400], adv: ['kd', [-31, -36, -39]], hs: 12, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch', jlim: 2, jinc: 3, cancel: 'u', saGround: 1, saOnly: ['su3'], rootF: [2, 2, 1], rootDmg: 800,
            preDelay: [2, 3, 4], aaInv: [[1, 14], [1, 9], [1, 8]], jump: { vx: [1.6, 2.2, 2.8], vy: [-9.5, -10.8, -12.0] }, lvy: -9, lvx: 2.5, meter: 40 },
      dp_ex: { anim: 'ex_dp', type: 'x', name: 'EX昇穿', dmg: 800, adv: ['kd', -34], hs: 12, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch', hits: 2, rehit: 7, jlim: 3, jinc: 3, cancel: 'u', saGround: 1, saOnly: ['su2', 'su3'],
            preDelay: 3, inv: [[1, 9]], jump: { vx: [2.4], vy: [-12.4] }, lvy: -6, lvx: 0.6, floatG: 0.14, jugAfter: 1, jg: 1 },   // 当てたら相手がふわっと漂い、着地後の昇穿がどんな時もつながる   // EX：発生は中と同じ6F・完全無敵
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
      zanku: { anim: 'j_p', type: 's', name: '斬空虚環弾', air: 1, dmg: 500, hs: 10, push: [4, 4], lv: 'm', chip: 0.125, stall: [0], jlim: 2,
               proj: { fx: 'ball_k', spd: [3.0, 3.8, 4.6], vy: [3.4, 2.7, 2.0], life: 140, hits: 1, r: 14 }, meter: 40, lvy: -3.5, lvx: 0.5, floatG: 0.35 },
      // EX斬空虚環弾：地上のEX虚環弾と同じく2回当たる大きい弾
      zanku_ex: { anim: 'j_p', type: 'x', name: 'EX斬空虚環弾', air: 1, dmg: 450, hs: 10, push: [4, 5], lv: 'm', chip: 0.125, stall: [0], jlim: 3,
               proj: { fx: 'ball_k_ex', spd: [4.2], vy: [2.6], life: 160, hits: 2, r: 18, rehit: 8 }, kd: 'launch', lvy: -5.5, lvx: 1.2, floatG: 0.3 },
      palm: { anim: 'sp_palm', type: 's', name: '虚掌破', dmg: 1100, adv: [0, -8], hs: 13, push: [2, 7], lv: 'm', chip: 0.125,
              kd: 'launch', lvy: -6, lvx: 14, lvxDrag: 0.92, floatG: 0.25, jset: -1, jlim: 0, cancel: 'u', meter: 40,   // 強さの違いは無し（弱・中・強どれも同じ）。横に吹っ飛んでから止まる：画面中央では強Pが届かず、画面端では壁で止まって届く
              addScale: 0.7,   // 追加補正：当てたあとのコンボのダメージが ×0.7
              preDelay: 10 },   // 発生24F。のけぞりの長い強P系からだけつながり、弱・中からは出るがつながらない
      // EX虚掌破：発生7F。弱・中・強どの通常技からでもつながる
      palm_ex: { anim: 'ex_palm', type: 'x', name: 'EX虚掌破', dmg: 1000, adv: [0, -4], hs: 13, push: [2, 6], lv: 'm', chip: 0.125,
              kd: 'launch', lvy: -8, lvx: 0.6, jset: 0, jlim: 0, cancel: 'u', floatG: 0.22, dashS: 5.5 },   // 前に踏み込みながら打つ。ふわっと浮かせて、ジャンプで追いかけて拾える
      su3: { anim: 'su_3', type: 'u', bars: 3, name: '天地穿', dmg: 600, hits: 7, rehit: 5, hs: 6, push: [0.3, 2], lv: 'm', chip: 0.25,
             inv: [[1, 44]], lock: 1, lockAir: 1, dashS: 7, jump: { vx: [0.8], vy: [-10] }, kdLast: 'launch', lvy: -12, lvx: 2.5, lastDmg: 1800, minScale: 0.7 },
      su1: { anim: 'su_1', type: 'u', bars: 1, name: '虚空砲', dmg: 620, hits: 5, rehit: 8, hs: 6, push: [1.5, 2], lv: 'm', chip: 0.25,
             inv: [[1, 14]], beam: { fx: 'beam_k', head: 'beamhead_k', len: 600, h: 34 }, kdLast: 'launch', lvy: -8, lvx: 4, minScale: 0.7 },
      su2: { anim: 'su_2', type: 'u', bars: 2, name: '零界継承', dmg: 390, hits: 9, rehit: 6, hs: 6, push: [0.5, 4], lv: 'm', chip: 0.25,
             inv: [[1, 26]], lock: 1, dashS: 9.0, kdLast: 'launch', lvy: -11, lvx: 3, lastDmg: 1044, minScale: 0.3, minTotal: 1250 },   // 生当て2400・最低保証1250
    },
  },

  // ==================================================================== 変身キャラ男
  //  ↓↓P でハンマー形態と大盾形態を入れ替える。体力とゲージは共通。技・絵・コマンドは形態ごとにまったく別
  //  変身キャンセル：当てた通常技から↓↓Pでキャンセルすると、相手ののけぞりが延び、変身後の技がつながる
  gai_h: {
    name: '変身キャラ男', form: 'ハンマー形態', en: 'HENSHIN', hp: 10500, walkF: 1.35, walkB: 1.15, dashF: 6.2, dashB: -5.6,
    jumpVX: 3.2, color: '#ffb22a', fx: 'k', pushW: 38, prefRange: [120, 200], other: 'gai_s', base: 'gai',
    moves: {
      lp:  { anim: 'lp', dmg: 300, adv: [4, 1], hs: 8, push: [3, 4], lv: 'm', cancel: 'csur', light: 1 },
      mp:  { anim: 'mp', dmg: 700, tc: { btn: 'hp', id: 'tc_hp' }, adv: [3, -2], hs: 11, push: [6, 6], lv: 'm', cancel: 'sur' },
      hp:  { anim: 'hp', heavy: 1, dmg: 1300, adv: [2, -5], hs: 15, push: [4, 8], lv: 'm', cancel: 'sur', armor: [[3, 13]] },
      lk:  { anim: 'lk', dmg: 300, adv: [3, -1], hs: 8, push: [3, 4], lv: 'm', cancel: 'csur', light: 1 },
      mk:  { anim: 'mk', dmg: 650, tc: { btn: 'hk', id: 'tc_hk' }, adv: [2, -3], hs: 10, push: [4, 6], lv: 'm', cancel: '' },
      hk:  { anim: 'hk', heavy: 1, dmg: 1100, adv: [1, -6], hs: 14, push: [6, 8], lv: 'm', cancel: 'sur', pcLaunch: [-10.5, 0.6] },
      c_lp: { anim: 'c_lp', dmg: 280, adv: [4, 1], hs: 8, push: [3, 4], lv: 'm', cancel: 'csur', light: 1, crouch: 1 },
      c_mp: { anim: 'c_mp', dmg: 600, adv: [4, -1], hs: 11, push: [5, 5.5], lv: 'm', cancel: 'sur', crouch: 1 },
      c_hp: { anim: 'c_hp', heavy: 1, dmg: 1000, adv: [1, -7], hs: 13, push: [5, 6], lv: 'm', cancel: 'sur', crouch: 1, aa: 1, jlim: 0, lvy: -7, lvx: 1.2 },
      c_lk: { anim: 'c_lk', dmg: 250, adv: [2, -1], hs: 8, push: [3, 4], lv: 'l', cancel: 'csur', light: 1, crouch: 1 },
      c_mk: { anim: 'c_mk', dmg: 600, adv: [1, -4], hs: 11, push: [6, 6], lv: 'l', cancel: 'sur', crouch: 1 },
      c_hk: { anim: 'c_hk', heavy: 1, dmg: 1100, adv: ['kd', -14], hs: 13, push: [3, 7], lv: 'l', cancel: 'r', crouch: 1, kd: 'sweep' },
      j_lp: { anim: 'j_p', dmg: 450, stun: [16, 12], hs: 8, push: [3, 3], lv: 'o', air: 1 },
      j_mp: { anim: 'j_p', dmg: 600, stun: [18, 14], hs: 10, push: [3, 3], lv: 'o', air: 1 },
      j_hp: { anim: 'j_hp', dmg: 1000, stun: [22, 17], hs: 13, push: [3, 3], lv: 'o', air: 1 },
      j_lk: { anim: 'j_k', dmg: 450, stun: [16, 12], hs: 8, push: [3, 3], lv: 'o', air: 1 },
      j_mk: { anim: 'j_k', dmg: 600, stun: [18, 14], hs: 10, push: [3, 3], lv: 'o', air: 1 },
      j_hk: { anim: 'j_hk', dmg: 900, stun: [22, 17], hs: 12, push: [3, 3], lv: 'o', air: 1 },
      tc_hp: { anim: 'hp', name: 'ターゲットコンボ', dmg: 1000, adv: [2, -6], hs: 14, push: [4, 8], lv: 'm', cancel: 'sur', heavy: 1 },
      tc_hk: { anim: 'mp', name: 'ターゲットコンボ2（回し打ち）', dmg: 950, adv: [1, -6], hs: 13, push: [4, 7], lv: 'm', cancel: 'su', heavy: 1, kd: 'launch', lvy: -6.5, lvx: 1.4, jset: 0, jlim: 1 },
      b_hp: { anim: 'b_hp', name: '槌突き', dmg: 800, adv: [5, 2], hs: 13, push: [7, 9], lv: 'm', cancel: 'sur', heavy: 1 },
      f_mk: { anim: 'f_mk', name: 'すくい打ち', dmg: 750, adv: [0, -7], hs: 12, push: [5, 7], lv: 'l', cancel: 's', dash: { vx: [2.4], vy: 0 } },
      f_hp: { anim: 'f_hp', name: '地響き', dmg: 1000, adv: [3, -6], hs: 14, push: [2, 6], lv: 'o', cancel: '', kd: 'bounce', lvy: -3, lvx: 1.0, jset: 0, jlim: 0 },
      throw: { anim: 'throw', type: 't', dmg: 1300, doAnim: 'throw_do' },
      // 変身（↓↓P）：大盾形態へ
      change: { anim: 'change', type: 's', name: '変身', swap: 'gai_s', swapExt: 12 },
      change_in: { anim: 'change_in', freeCancel: 1 },
      // 地割れ：地面を走る衝撃波（下段）。空中の相手に当たると浮かせ直す
      quake: { anim: 'sp_quake', type: 's', name: '地割れ', dmg: [700, 800, 900], adv: [2, -6], hs: 11, push: [6, 6], lv: 'l', chip: 0.125,
               proj: { fx: 'shock_h', spd: [4.2, 5.6, 7.0], life: 120, hits: 1, r: 16, ground: 1 }, meter: 40, cancel: 'u', lvy: -4.5, lvx: 1.0, floatG: 0.4, jlim: 2, jinc: 1 },
      quake_ex: { anim: 'sp_quake', type: 'x', name: 'EX地割れ', dmg: 500, adv: [6, 0], hs: 11, push: [6, 6], lv: 'l', chip: 0.125,
               proj: { fx: 'shock_h', spd: [7.0], life: 120, hits: 2, r: 20, rehit: 7, ground: 1 }, cancel: 'u', kdLast: 'launch', lvy: -8, lvx: 1.2, jlim: 3, jinc: 1 },
      // かち上げ：対空（空中の攻撃に無敵）。根本で当てるとSA3でキャンセルできる
      upper: { anim: 'sp_upper', type: 's', name: 'かち上げ', dmg: [1100, 1250, 1400], adv: ['kd', [-28, -32, -36]], hs: 13, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch',
               jlim: 3, jinc: 3, cancel: 'u', preDelay: [2, 3, 4], aaInv: [[1, 12], [1, 9], [1, 8]], jump: { vx: [1.0, 1.4, 1.8], vy: [-7, -8, -9] }, lvy: -9.5, lvx: 2.2, meter: 40 },
      upper_ex: { anim: 'sp_upper', type: 'x', name: 'EXかち上げ', dmg: 750, adv: ['kd', -32], hs: 13, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch', hits: 2, rehit: 6,
               jlim: 3, jinc: 3, cancel: 'u', preDelay: 3, inv: [[1, 10]], jump: { vx: [1.6], vy: [-9.5] }, lvy: -10, lvx: 2.2, jg: 1 },
      // 大回転：アーマー（1回）で受けながら2段。最後の1発で画面端へ吹き飛ばして壁で跳ね返す
      spin: { anim: 'sp_spin', type: 's', name: '大回転', preDelay: 2, dmg: [380, 420, 460], hits: 3, rehit: 8, hs: 11, push: [2, 7], lv: 'm', chip: 0.125, adv: ['kd', -8],
              armor: [[4, 22]], dash: { vx: [4.4, 5.4, 6.4], vy: 0 }, kdLast: 'wall', lvy: [-5, -5.5, -6], lvx: [6, 7, 8], jset: 1, jlim: 2, cancel: 'u', meter: 40 },
      spin_ex: { anim: 'sp_spin', type: 'x', name: 'EX大回転', dmg: 340, hits: 4, rehit: 6, hs: 11, push: [2, 7], lv: 'm', chip: 0.125, adv: ['kd', -6],
              armor: [[4, 26]], armorHits: 2, dash: { vx: [7.2], vy: 0 }, kdLast: 'wall', lvy: -6, lvx: 8, jset: 0, jlim: 2, cancel: 'u' },
      // 飛び叩き：飛び上がって上から叩く（中段）。当たると床で跳ねる
      leap: { anim: 'sp_leap', type: 's', name: '飛び叩き', dmg: [900, 1000, 1100], adv: [-4, -10], hs: 14, push: [2, 6], lv: 'o', chip: 0.125,
              jump: { vx: [2.6, 3.4, 4.2], vy: [-8.4, -8.4, -8.4] }, kd: 'bounce', lvy: -3, lvx: 1.2, jset: 0, jlim: 0, cancel: 'u', meter: 40 },
      leap_ex: { anim: 'sp_leap', type: 'x', name: 'EX飛び叩き', dmg: 1100, adv: [-2, -6], hs: 15, push: [2, 6], lv: 'o', chip: 0.125,
              jump: { vx: [4.0], vy: [-9.0] }, armor: [[1, 30]], kd: 'bounce', lvy: -3.5, lvx: 1.2, jset: 0, jlim: 0, cancel: 'u' },
      // 担ぎ叩き：コマンド投げ。つかんで担ぎ、地面へ落としてハンマーで叩き込む
      grab: { anim: 'sp_grab', type: 'g', name: '担ぎ叩き', dmg: [2000, 2200, 2400], range: [68, 74, 80], doAnim: 'sp_grab_do', meter: 60 },
      grab_ex: { anim: 'sp_grab', type: 'g', name: 'EX担ぎ叩き', dmg: 2700, range: [90], inv: [[1, 4]], doAnim: 'sp_grab_do' },
      // 空中叩きつけ：空中から斜め下へ落ちながら叩く（中段）。地上の相手に当たると床で跳ねる
      aslam: { anim: 'sp_aslam', type: 's', name: '空中叩きつけ', air: 1, dmg: [900, 1000, 1100], stun: [20, 16], hs: 13, push: [2, 5], lv: 'o', chip: 0.125,
               dive: { vx: 3.0, vy: 8.0 }, kd: 'bounce', lvy: -3, lvx: 1.2, jset: 0, jlim: 0, meter: 40 },
      aslam_ex: { anim: 'sp_aslam', type: 'x', name: 'EX空中叩きつけ', air: 1, dmg: 1200, stun: [22, 18], hs: 14, push: [2, 5], lv: 'o', chip: 0.125,
               dive: { vx: 4.2, vy: 10.0 }, armor: [[1, 20]], kd: 'bounce', lvy: -4, lvx: 1.2, jset: 0, jlim: 0 },
      su1: { anim: 'su_1', type: 'u', bars: 1, name: '大槌連打', dmg: 480, hits: 6, rehit: 5, hs: 7, push: [0.3, 2], lv: 'm', chip: 0.25,
             inv: [[1, 12]], lock: 1, dashS: 4.5, kdLast: 'launch', lvy: -9, lvx: 3, lastDmg: 1200, minScale: 0.7 },
      su2: { anim: 'su_2', type: 'u', bars: 2, name: 'ギガントスイング', dmg: 380, hits: 9, rehit: 4, hs: 6, push: [0.3, 3], lv: 'm', chip: 0.25,
             inv: [[1, 22]], lock: 1, dashS: 5.5, kdLast: 'wall', lvy: -7, lvx: 7, lastDmg: 1500, minScale: 0.7 },
      su3: { anim: 'su_3', type: 'u', bars: 3, name: '天崩', dmg: 900, hits: 3, rehit: 8, hs: 9, push: [0.3, 2], lv: 'o', chip: 0.25,
             inv: [[1, 34]], lock: 1, jump: { vx: [2.6], vy: [-11] }, kdLast: 'bounce', lvy: -4, lvx: 1, lastDmg: 2600, minScale: 0.7 },
    },
  },
  gai_s: {
    name: '変身キャラ男', form: '大盾形態', en: 'HENSHIN', hp: 10500, walkF: 1.65, walkB: 1.45, dashF: 6.8, dashB: -6.0,
    jumpVX: 3.4, color: '#34f594', fx: 'k', pushW: 38, prefRange: [70, 140], other: 'gai_h', base: 'gai',
    moves: {
      lp:  { anim: 'lp', dmg: 300, adv: [3, 1], hs: 8, push: [4, 5], lv: 'm', cancel: 'csur', light: 1 },
      mp:  { anim: 'mp', dmg: 650, tc: { btn: 'hp', id: 'tc_hp' }, adv: [2, -1], hs: 11, push: [9, 9], lv: 'm', cancel: 'sur' },
      hp:  { anim: 'hp', heavy: 1, dmg: 950, adv: [3, -2], hs: 13, push: [10, 10], lv: 'm', cancel: 'sur' },
      lk:  { anim: 'lk', dmg: 300, adv: [3, -1], hs: 8, push: [3, 4], lv: 'm', cancel: 'csur', light: 1 },
      mk:  { anim: 'mk', dmg: 650, tc: { btn: 'hk', id: 'tc_hk' }, adv: [2, -2], hs: 10, push: [7, 7], lv: 'm', cancel: 'sur' },
      hk:  { anim: 'hk', heavy: 1, dmg: 1000, adv: [1, -6], hs: 13, push: [5, 7], lv: 'm', cancel: 'sur', pcLaunch: [-10, 0.4] },
      c_lp: { anim: 'c_lp', dmg: 280, adv: [4, 1], hs: 8, push: [3, 4], lv: 'm', cancel: 'csur', light: 1, crouch: 1 },
      c_mp: { anim: 'c_mp', dmg: 600, adv: [4, 0], hs: 11, push: [6, 6], lv: 'm', cancel: 'sur', crouch: 1 },
      c_hp: { anim: 'c_hp', heavy: 1, dmg: 900, adv: [1, -6], hs: 12, push: [5, 6], lv: 'm', cancel: 'sur', crouch: 1, aa: 1, aaInv: [[4, 10]], jlim: 0, lvy: -7, lvx: 1.2 },
      c_lk: { anim: 'c_lk', dmg: 250, adv: [2, -1], hs: 8, push: [3, 4], lv: 'l', cancel: 'csur', light: 1, crouch: 1 },
      c_mk: { anim: 'c_mk', dmg: 550, adv: [1, -4], hs: 11, push: [6, 6], lv: 'l', cancel: 'sur', crouch: 1 },
      c_hk: { anim: 'c_hk', heavy: 1, dmg: 950, adv: ['kd', -12], hs: 12, push: [3, 7], lv: 'l', cancel: 'r', crouch: 1, kd: 'sweep' },
      j_lp: { anim: 'j_p', dmg: 450, stun: [16, 12], hs: 8, push: [3, 3], lv: 'o', air: 1 },
      j_mp: { anim: 'j_p', dmg: 600, stun: [18, 14], hs: 10, push: [3, 3], lv: 'o', air: 1 },
      j_hp: { anim: 'j_hp', dmg: 900, stun: [22, 17], hs: 12, push: [3, 3], lv: 'o', air: 1 },
      j_lk: { anim: 'j_k', dmg: 450, stun: [16, 12], hs: 8, push: [3, 3], lv: 'o', air: 1 },
      j_mk: { anim: 'j_k', dmg: 600, stun: [18, 14], hs: 10, push: [3, 3], lv: 'o', air: 1 },
      j_hk: { anim: 'j_hk', dmg: 900, stun: [22, 17], hs: 12, push: [3, 3], lv: 'o', air: 1 },
      tc_hp: { anim: 'hp', name: 'ターゲットコンボ', dmg: 800, adv: [3, -3], hs: 13, push: [7, 9], lv: 'm', cancel: 'sur', heavy: 1 },
      tc_hk: { anim: 'hk', name: 'ターゲットコンボ2（盾連打）', dmg: 850, adv: [2, -5], hs: 13, push: [5, 8], lv: 'm', cancel: 'su', heavy: 1 },
      b_hp: { anim: 'b_hp', name: '盾押し', dmg: 700, adv: [4, 3], hs: 12, push: [16, 18], lv: 'm', cancel: 'sur', heavy: 1 },
      f_mk: { anim: 'f_mk', name: '盾すべり', dmg: 800, adv: ['kd', -10], hs: 12, push: [3, 6], lv: 'l', cancel: '', kd: 'sweep', dash: { vx: [4.4], vy: 0 } },
      f_hp: { anim: 'f_hp', name: '盾落とし', dmg: 900, adv: [6, -4], hs: 13, push: [2, 6], lv: 'o', cancel: '' },
      throw: { anim: 'throw', type: 't', dmg: 1200, doAnim: 'throw_do' },
      change: { anim: 'change', type: 's', name: '変身', swap: 'gai_h', swapExt: 12 },
      change_in: { anim: 'change_in', freeCancel: 1 },
      // 盾構え：当て身。受けたら盾で打ち返して浮かせる（超必殺・投げは止められない）
      counter: { anim: 'sp_counter', type: 's', name: '盾構え', gp: [[4, 21], [4, 21], [4, 21]], gpTo: 'counter_do', meter: 40 },
      counter_ex: { anim: 'sp_counter', type: 'x', name: 'EX盾構え', gp: [[2, 24]], gpTo: 'counter_do_ex' },
      counter_do: { anim: 'sp_counter_do', type: 's', name: '盾返し', dmg: 1200, adv: ['kd', -10], hs: 14, push: [2, 6], lv: 'm', kd: 'launch', lvy: -8, lvx: 2.2, jset: 0, jlim: 0, cancel: 'u' },
      counter_do_ex: { anim: 'sp_counter_do', type: 'x', name: 'EX盾返し', dmg: 1400, adv: ['kd', -8], hs: 15, push: [2, 6], lv: 'm', kd: 'launch', lvy: -10, lvx: 1.6, jset: -1, jlim: 0, cancel: 'u' },
      // 盾突進：飛び道具を抜ける2段の突進。最後の1発で吹き飛ばす
      charge: { anim: 'sp_charge', type: 's', name: '盾突進', dmg: [400, 450, 500], hits: 2, rehit: 8, hs: 11, push: [4, 8], lv: 'm', chip: 0.125, adv: ['kd', -6],
                projInv: 1, dash: { vx: [4.6, 5.8, 7.0], vy: 0 }, kdLast: 'launch', lvy: [-6, -6.5, -7], lvx: [2.5, 3.5, 4.5], jset: 1, jlim: 1, cancel: 'u', meter: 40 },
      charge_ex: { anim: 'sp_charge', type: 'x', name: 'EX盾突進', dmg: 380, hits: 3, rehit: 6, hs: 11, push: [4, 8], lv: 'm', chip: 0.125, adv: ['kd', -4],
                projInv: 1, dash: { vx: [8.0], vy: 0 }, kdLast: 'wall', lvy: -6, lvx: 8, jset: 0, jlim: 2, cancel: 'u' },
      // 跳ね上げ：盾ごと飛び上がる対空（空中の攻撃に無敵）
      lift: { anim: 'sp_lift', type: 's', name: '跳ね上げ', dmg: [1000, 1150, 1300], adv: ['kd', [-28, -32, -36]], hs: 12, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch',
              jlim: 3, jinc: 3, cancel: 'u', preDelay: [2, 3, 4], aaInv: [[1, 12], [1, 9], [1, 8]], jump: { vx: [1.2, 1.6, 2.0], vy: [-8, -9, -10] }, lvy: -9, lvx: 2.4, meter: 40 },
      lift_ex: { anim: 'sp_lift', type: 'x', name: 'EX跳ね上げ', dmg: 700, adv: ['kd', -32], hs: 12, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch', hits: 2, rehit: 6,
              jlim: 3, jinc: 3, cancel: 'u', preDelay: 3, inv: [[1, 10]], jump: { vx: [1.6], vy: [-10.5] }, lvy: -10, lvx: 2.4, jg: 1 },
      // 反射：飛び道具を跳ね返す。近くの相手にも当たる
      reflect: { anim: 'sp_reflect', type: 's', name: '反射', dmg: 600, adv: [2, -4], hs: 12, push: [6, 7], lv: 'm', chip: 0.125, reflect: 1, cancel: 'u', meter: 40 },
      reflect_ex: { anim: 'sp_reflect', type: 'x', name: 'EX反射', dmg: 800, adv: [4, 0], hs: 12, push: [6, 7], lv: 'm', chip: 0.125, reflect: 1, kd: 'launch', lvy: -7, lvx: 2, jset: 0, jlim: 0, cancel: 'u' },
      // 光盾投げ：光の盾を投げる飛び道具（ゆっくり・強いほど速い）。当たったらラッシュでキャンセルできる
      disc: { anim: 'sp_disc', type: 's', name: '光盾投げ', dmg: 650, adv: [1, -5], hs: 11, push: [6, 6], lv: 'm', chip: 0.125,
              proj: { fx: 'disc_s', spd: [3.4, 4.4, 5.4], life: 150, hits: 1, r: 18 }, meter: 40, cancel: 'ur', lvy: -3.5, lvx: 0.6, floatG: 0.35, jlim: 2, jinc: 1 },
      disc_ex: { anim: 'sp_disc', type: 'x', name: 'EX光盾投げ', dmg: 450, adv: [5, 0], hs: 11, push: [6, 6], lv: 'm', chip: 0.125,
              proj: { fx: 'disc_s', spd: [6.0], life: 150, hits: 2, r: 22, rehit: 8 }, cancel: 'ur', kdLast: 'launch', lvy: -7, lvx: 1.4, jlim: 3, jinc: 1 },
      // 盾落下：空中から真下気味に盾ごと落ちて押しつぶす（中段）
      sdrop: { anim: 'sp_sdrop', type: 's', name: '盾落下', air: 1, dmg: [800, 900, 1000], stun: [20, 16], hs: 13, push: [3, 6], lv: 'o', chip: 0.125,
               dive: { vx: 1.6, vy: 9.0 }, meter: 40 },
      sdrop_ex: { anim: 'sp_sdrop', type: 'x', name: 'EX盾落下', air: 1, dmg: 600, hits: 2, rehit: 6, stun: [22, 18], hs: 13, push: [3, 6], lv: 'o', chip: 0.125,
               dive: { vx: 2.4, vy: 10.5 }, kdLast: 'launch', lvy: -7, lvx: 1.6, jset: 0, jlim: 1 },
      su1: { anim: 'su_1', type: 'u', bars: 1, name: 'フォートレスブレイク', dmg: 420, hits: 6, rehit: 5, hs: 7, push: [0.3, 2], lv: 'm', chip: 0.25,
             inv: [[1, 14]], lock: 1, dashS: 5, kdLast: 'launch', lvy: -9, lvx: 3, lastDmg: 1200, minScale: 0.7 },
      su2: { anim: 'su_2', type: 'u', bars: 2, name: 'シールドラッシュ', dmg: 320, hits: 9, rehit: 3, hs: 6, push: [0.3, 3], lv: 'm', chip: 0.25,
             inv: [[1, 22]], lock: 1, dashS: 6.5, kdLast: 'wall', lvy: -7, lvx: 7, lastDmg: 1500, minScale: 0.7 },
      su3: { anim: 'su_3', type: 'u', bars: 3, name: '城門崩し', dmg: 900, hits: 3, rehit: 8, hs: 9, push: [0.3, 2], lv: 'o', chip: 0.25,
             inv: [[1, 34]], lock: 1, jump: { vx: [2.4], vy: [-11] }, kdLast: 'launch', lvy: -10, lvx: 2, lastDmg: 2500, minScale: 0.7 },
    },
  },
  shuuen: {
    name: '終焉の支配者', en: 'SHUUEN', hp: 11000, walkF: 1.4, walkB: 1.1, dashF: 5.8, dashB: -5.0,
    jumpVX: 3.0, color: '#ff3fe6', fx: 's', pushW: 38, prefRange: [70, 140],
    moves: {
      lp:  { anim: 'lp', dmg: 400, adv: [3, 0], hs: 8, push: [3, 4], lv: 'm', cancel: 'csur', light: 1 },
      mp:  { anim: 'mp', dmg: 800, adv: [4, -1], hs: 11, push: [5, 6], lv: 'm', cancel: 'sur' },
      hp:  { anim: 'hp', heavy: 1, dmg: 1300, tc: { btn: 'hk', id: 'tc_hk' }, adv: [2, -4], hs: 14, push: [5, 8], lv: 'm', cancel: 'sur' },
      lk:  { anim: 'lk', dmg: 400, adv: [2, -1], hs: 8, push: [3, 4], lv: 'm', cancel: 'cr', light: 1 },
      mk:  { anim: 'mk', dmg: 850, tc: { btn: 'hp', id: 'tc_hp' }, adv: [3, -3], hs: 11, push: [7, 7], lv: 'm', cancel: 'r' },
      hk:  { anim: 'hk', heavy: 1, dmg: 1300, adv: [2, -6], hs: 14, push: [9, 9], lv: 'm', cancel: '' },
      c_lp: { anim: 'c_lp', dmg: 360, adv: [5, 1], hs: 8, push: [3, 4], lv: 'm', cancel: 'csur', light: 1, crouch: 1 },
      c_mp: { anim: 'c_mp', dmg: 700, adv: [4, 0], hs: 11, push: [5, 6], lv: 'm', cancel: 'sur', crouch: 1 },
      c_hp: { anim: 'c_hp', heavy: 1, dmg: 1100, adv: [0, -8], hs: 13, push: [5, 6], lv: 'm', cancel: 'sur', crouch: 1, aa: 1 },
      c_lk: { anim: 'c_lk', dmg: 350, adv: [2, -1], hs: 8, push: [3, 4], lv: 'l', cancel: 'csur', light: 1, crouch: 1 },
      c_mk: { anim: 'c_mk', dmg: 650, adv: [1, -4], hs: 11, push: [6, 6], lv: 'l', cancel: 'sur', crouch: 1 },
      c_hk: { anim: 'c_hk', heavy: 1, dmg: 1100, adv: ['kd', -14], hs: 13, push: [3, 7], lv: 'l', cancel: 'r', crouch: 1, kd: 'sweep' },
      j_lp: { anim: 'j_p', dmg: 600, stun: [16, 12], hs: 8, push: [3, 3], lv: 'o', air: 1 },
      j_mp: { anim: 'j_p', dmg: 750, stun: [18, 14], hs: 10, push: [3, 3], lv: 'o', air: 1 },
      j_hp: { anim: 'j_hp', dmg: 1150, stun: [22, 17], hs: 13, push: [3, 3], lv: 'o', air: 1 },
      j_lk: { anim: 'j_k', dmg: 600, stun: [16, 12], hs: 8, push: [3, 3], lv: 'o', air: 1 },
      j_mk: { anim: 'j_k', dmg: 750, stun: [18, 14], hs: 10, push: [3, 3], lv: 'o', air: 1 },
      j_hk: { anim: 'j_hk', dmg: 1150, stun: [22, 17], hs: 13, push: [3, 3], lv: 'o', air: 1 },
      tc_hp: { anim: 'hp', name: 'ターゲットコンボ', dmg: 1100, adv: [2, -4], hs: 14, push: [6, 8], lv: 'm', cancel: 'sur', heavy: 1 },
      tc_hk: { anim: 'hk', name: 'ターゲットコンボ', dmg: 1200, adv: [1, -7], hs: 14, push: [8, 9], lv: 'm', cancel: '', heavy: 1 },
      f_hp: { anim: 'f_hp', name: '破頭', dmg: 1000, adv: [3, -4], hs: 14, push: [5, 7], lv: 'm', cancel: 'sur', heavy: 1 },
      f_mk: { anim: 'f_mk', name: '圧殺踏', dmg: 900, adv: [1, -4], hs: 13, push: [4, 6], lv: 'o', cancel: '' },
      b_hp: { anim: 'b_hp', name: '掬い爪', dmg: 900, adv: [1, -6], hs: 13, push: [4, 6], lv: 'm', cancel: 'sur', heavy: 1, aa: 1 },
      throw: { anim: 'throw', type: 't', dmg: 1500, doAnim: 'throw_do' },
      fire: { anim: 'sp_fire', type: 's', name: '冥核弾', dmg: 700, adv: [3, -3], hs: 12, push: [7, 7], lv: 'm', chip: 0.125,
              proj: { fx: 'ball_s', spd: [2.4, 3.2, 4.0], life: 220, hits: 1, r: 16 }, meter: 40, cancel: 'u' },
      fire_ex: { anim: 'ex_fire', type: 'x', name: 'EX冥核弾', dmg: 550, adv: [8, 2], hs: 12, push: [7, 7], lv: 'm', chip: 0.125,
              proj: { fx: 'ball_s_ex', spd: [4.2, 4.2, 4.2], life: 200, hits: 2, r: 22, rehit: 10 }, cancel: 'u' },
      dp: { anim: 'sp_dp', type: 's', name: '断天', dmg: [1200, 1300, 1400], hs: 13, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch',
            inv: [[1, 4], [1, 5], [1, 6]], jump: { vx: [1.2, 1.6, 2.0], vy: [-8.5, -9.5, -10.5] }, lvy: -9, lvx: 2.8, meter: 40 },
      dp_ex: { anim: 'ex_dp', type: 'x', name: 'EX断天', dmg: 900, hs: 13, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch', hits: 2, rehit: 8,
            inv: [[1, 9]], jump: { vx: [2.0], vy: [-11.0] }, lvy: -10, lvx: 2.8, jg: 1 },
      rushk: { anim: 'sp_rush', type: 's', name: '崩落突進', dmg: [1100, 1200, 1300], adv: [4, -8], hs: 14, push: [9, 8], lv: 'm', chip: 0.125,
               dash: { vx: [5.0, 6.2, 7.4], vy: 0 }, meter: 40 },
      rushk_ex: { anim: 'ex_rush', type: 'x', name: 'EX崩落突進', dmg: 800, hs: 14, push: [5, 8], lv: 'm', chip: 0.125, hits: 2, rehit: 8,
               dash: { vx: [8.0], vy: 0 }, projInv: 1, kd: 'launch', lvy: -7, lvx: 4 },
      grab: { anim: 'sp_grab', type: 'g', name: '終縛', dmg: [2200, 2400, 2600], range: [70, 78, 86], doAnim: 'sp_grab_do', meter: 60 },
      wave: { anim: 'sp_wave', type: 's', name: '地裂脚', dmg: 700, adv: [2, -3], hs: 12, push: [5, 6], lv: 'l', chip: 0.125,
              proj: { fx: 'wave_s', spd: [3.0, 4.0, 5.0], life: 140, hits: 1, r: 16, ground: 1 }, meter: 40, cancel: 'u' },
      rekka1: { anim: 'sp_rekka1', type: 's', name: '冥爪連撃', dmg: 600, adv: [-2, -6], hs: 11, push: [2.5, 4], lv: 'm', chip: 0.125,
                follow: { seq: [2, 1, 4], id: 'rekka2' }, meter: 30 },
      rekka2: { anim: 'sp_rekka2', type: 's', name: '冥爪連撃・二', dmg: 700, adv: [-2, -6], hs: 11, push: [2.5, 4], lv: 'm', chip: 0.125,
                follow: { seq: [2, 1, 4], id: 'rekka3' } },
      rekka3: { anim: 'sp_rekka3', type: 's', name: '冥爪連撃・終', dmg: 1000, adv: [0, -10], hs: 14, push: [2, 7], lv: 'm', chip: 0.125,
                kd: 'launch', lvy: -6, lvx: 4, cancel: 'u' },
      dive: { anim: 'sp_dive', type: 's', name: '降魔落', air: 1, dmg: 900, stun: [18, 14], hs: 12, push: [3, 4], lv: 'o', dive: { vx: 4.5, vy: 7.5 } },
      su3: { anim: 'su_3', type: 'u', bars: 3, name: '万象崩', dmg: 900, hits: 2, rehit: 9, hs: 7, push: [0.3, 1], lv: 'm', chip: 0.25,
             inv: [[1, 26]], pillar: { fx: 'pillar_s', w: 46, offs: [-70, 0, 70] }, kdLast: 'launch', lvy: -13, lvx: 1.5, minScale: 0.7 },
      su1: { anim: 'su_1', type: 'u', bars: 1, name: '終焉の柱', dmg: 700, hits: 4, rehit: 9, hs: 7, push: [0.5, 1], lv: 'm', chip: 0.25,
             inv: [[1, 18]], pillar: { fx: 'pillar_s', w: 46 }, kdLast: 'launch', lvy: -12, lvx: 1.5, minScale: 0.5 },
      su2: { anim: 'su_2', type: 'gu', bars: 2, name: '万象終焉', dmg: 4800, range: [96], doAnim: 'su_2_do', inv: [[1, 14]] },
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
    { seq: [2, 3, 6], btn: 'K', win: 12, move: 'tatsu' },
    { seq: [2, 3, 6], btn: 'K', win: 12, move: 'atatsu', air: 1 },
    { seq: [2, 3, 6], btn: 'P', win: 12, move: 'zanku', air: 1 },
    { seq: [2, 1, 4], btn: 'P', win: 12, move: 'palm' },
    { seq: [2, 1, 4], btn: 'K', win: 12, move: 'rushk' },
  ],
  gai_h: [
    { seq: [2, 3, 6, 2, 3, 6], altL: [[2, 3, 6, 2, 6], [2, 6, 2, 3, 6]], btn: 'P', win: 26, move: 'su1' },
    { seq: [2, 1, 4, 2, 1, 4], altL: [[2, 1, 4, 2, 4], [2, 4, 2, 1, 4]], btn: 'P', win: 28, move: 'su2' },
    { seq: [2, 3, 6, 2, 3, 6], altL: [[2, 3, 6, 2, 6], [2, 6, 2, 3, 6]], btn: 'K', win: 26, move: 'su3' },
    { seq: [2, 5, 2], dd: 1, btn: 'P', win: 18, move: 'change' },
    { seq: [6, 3, 2, 1, 4], btn: 'P', win: 22, move: 'grab', loose: 1 },
    { seq: [6, 2, 3], dp: 1, btn: 'P', win: 14, move: 'upper' },
    { seq: [2, 3, 6], btn: 'P', win: 12, move: 'aslam', air: 1 },
    { seq: [2, 3, 6], btn: 'P', win: 12, move: 'quake' },
    { seq: [2, 1, 4], btn: 'P', win: 12, move: 'spin' },
    { seq: [2, 3, 6], btn: 'K', win: 12, move: 'leap' },
  ],
  gai_s: [
    { seq: [2, 3, 6, 2, 3, 6], altL: [[2, 3, 6, 2, 6], [2, 6, 2, 3, 6]], btn: 'P', win: 26, move: 'su1' },
    { seq: [2, 1, 4, 2, 1, 4], altL: [[2, 1, 4, 2, 4], [2, 4, 2, 1, 4]], btn: 'P', win: 28, move: 'su2' },
    { seq: [2, 3, 6, 2, 3, 6], altL: [[2, 3, 6, 2, 6], [2, 6, 2, 3, 6]], btn: 'K', win: 26, move: 'su3' },
    { seq: [2, 5, 2], dd: 1, btn: 'P', win: 18, move: 'change' },
    { seq: [6, 2, 3], dp: 1, btn: 'P', win: 14, move: 'lift' },
    { seq: [2, 3, 6], btn: 'P', win: 12, move: 'charge' },
    { seq: [2, 1, 4], btn: 'P', win: 12, move: 'disc' },
    { seq: [2, 3, 6], btn: 'K', win: 12, move: 'sdrop', air: 1 },
    { seq: [2, 1, 4], btn: 'K', win: 12, move: 'counter' },
    { seq: [2, 3, 6], btn: 'K', win: 12, move: 'reflect' },
  ],
  shuuen: [
    { seq: [2, 3, 6, 2, 3, 6], btn: 'P', win: 26, move: 'su1' },
    { seq: [2, 3, 6, 2, 3, 6], btn: 'K', win: 26, move: 'su2' },
    { seq: [2, 1, 4, 2, 1, 4], btn: 'P', win: 28, move: 'su3' },
    { seq: [6, 3, 2, 1, 4], btn: 'P', win: 22, move: 'grab', loose: 1 },
    { seq: [6, 2, 3], dp: 1, btn: 'P', win: 14, move: 'dp' },
    { seq: [2, 3, 6], btn: 'P', win: 12, move: 'fire' },
    { seq: [2, 3, 6], btn: 'K', win: 12, move: 'wave' },
    { seq: [2, 1, 4], btn: 'P', win: 12, move: 'rekka1' },
    { seq: [2, 1, 4], btn: 'K', win: 12, move: 'rushk' },
    { seq: [2, 1, 4], btn: 'K', win: 12, move: 'dive', air: 1 },
  ],
};

KF.MOVE_LIST = {
  kokuu: [
    ['特殊技 鎚打ち（中段）', '→ + 中P'], ['特殊技 踏破肘', '→ + 強P'], ['特殊技 旋踵（ガードさせて有利）', '← + 強K'],
    ['ターゲットコンボ 連破 / 双蹴', '中P ～ 強P ／ 中K ～ 強K'], ['強K（パニッシュカウンターで浮く）', '強K'],
    ['虚環弾', '↓↘→ + P'], ['昇穿（対空・無敵。EXは当てたら着地後に昇穿で追撃できる）', '→↓↘ + P（前→下→前 なら出る）'], ['旋風脚（強は飛び道具を抜けるが、コンボにはつながらない） / 空中で空旋脚（空中Kからも出せる。浮いた相手は叩きつけて床バウンド）', '↓↘→ + K'], ['斬空虚環弾（空中で斜め下へ撃つ。EXは2回当たる）', '空中で ↓↘→ + P'],
    ['虚掌破（強P系からつながる。相手を遠くへ飛ばし、画面端以外では強Pで拾えない。強さの違いは無し。EXは高く浮かせてジャンプで追撃）', '↓↙← + P'], ['迅閃脚（下段スライディング）', '↓↙← + K'], ['EX必殺技', '各コマンド + ボタン2つ（EX/RUSHゲージ2本。足りなくても少しあれば出せる）'],
    ['超必殺 虚空砲 / 天地穿', '↓↘→↓↘→ + P（1本） / + K（3本）'], ['超必殺 零界継承', '↓↙←↓↙← + P（2本）'],
    ['投げ / パリィ・ラッシュ', '弱P+弱K（つかまれたら弱P+弱Kで抜け） / パリィ（押している間。出始めで受けるとジャストパリィ）／パリィ中に →→ でラッシュ（合わせて1本）／技の途中でパリィか →→ でラッシュキャンセル（3本）'],
  ],
  gai_h: [
    ['【ハンマー形態】遅いが一発が重い。強Pは発生前に攻撃を1回受け止める（アーマー）', ''],
    ['変身（大盾形態へ。当てた必殺技からも出せる＝変身キャンセル・1コンボ1回）', '↓↓ + P'],
    ['特殊技 地響き（中段・床跳ね） / 槌突き（ガードされても有利）', '→ + 強P ／ ← + 強P'],
    ['特殊技 すくい打ち（下段・踏み込む）', '→ + 中K'],
    ['ターゲットコンボ / 回し打ち（浮かせる）', '中P ～ 強P ／ 中K ～ 強K'],
    ['地割れ（地面を走る下段の衝撃波）', '↓↘→ + P'], ['かち上げ（対空・空中の攻撃に無敵）', '→↓↘ + P'],
    ['大回転（アーマー付き2段・画面端で壁跳ね）', '↓↙← + P'], ['飛び叩き（中段・床跳ね）', '↓↘→ + K'],
    ['担ぎ叩き（コマンド投げ） / 空中叩きつけ（中段・床跳ね）', '→↘↓↙← + P ／ 空中で ↓↘→ + P'],
    ['EX必殺技', '各コマンド + ボタン2つ（EX/RUSHゲージ2本。足りなくても少しあれば出せる）'],
    ['超必殺 大槌連打 / 天崩', '↓↘→↓↘→ + P（1本） / + K（3本）'], ['超必殺 ギガントスイング', '↓↙←↓↙← + P（2本）'],
    ['投げ / パリィ・ラッシュ', '弱P+弱K / パリィ（押している間。出始めで受けるとジャストパリィ）／パリィ中に →→ でラッシュ（合わせて1本）／技の途中でパリィか →→ でラッシュキャンセル（3本）'],
  ],
  gai_s: [
    ['【大盾形態】守りから返す。押し込みが強い', ''],
    ['変身（ハンマー形態へ。当てた必殺技からも出せる＝変身キャンセル・1コンボ1回）', '↓↓ + P'],
    ['特殊技 盾落とし（中段） / 盾押し（大きく押し出す・有利）', '→ + 強P ／ ← + 強P'],
    ['特殊技 盾すべり（下段・ダウン）', '→ + 中K'],
    ['ターゲットコンボ / 盾連打', '中P ～ 強P ／ 中K ～ 強K'], ['しゃがみ強P（対空・空中の攻撃に無敵）', '↓ + 強P'],
    ['盾突進（飛び道具を抜ける2段突進）', '↓↘→ + P'], ['跳ね上げ（対空・空中の攻撃に無敵）', '→↓↘ + P'],
    ['光盾投げ（飛び道具） / 盾構え（当て身。受けたら盾返し）', '↓↙← + P ／ ↓↙← + K'],
    ['反射（飛び道具を跳ね返す） / 盾落下（中段）', '↓↘→ + K ／ 空中で ↓↘→ + K'],
    ['EX必殺技', '各コマンド + ボタン2つ（EX/RUSHゲージ2本。足りなくても少しあれば出せる）'],
    ['超必殺 フォートレスブレイク / 城門崩し', '↓↘→↓↘→ + P（1本） / + K（3本）'], ['超必殺 シールドラッシュ', '↓↙←↓↙← + P（2本）'],
    ['投げ / パリィ・ラッシュ', '弱P+弱K / パリィ（押している間。出始めで受けるとジャストパリィ）／パリィ中に →→ でラッシュ（合わせて1本）／技の途中でパリィか →→ でラッシュキャンセル（3本）'],
  ],
  shuuen: [
    ['特殊技 破頭', '→ + 強P'], ['特殊技 圧殺踏（中段）', '→ + 中K'], ['特殊技 掬い爪（対空）', '← + 強P'],
    ['ターゲットコンボ 砕撃 / 轟連', '中K ～ 強P ／ 強P ～ 強K'],
    ['冥核弾', '↓↘→ + P'], ['地裂脚（下段の衝撃波）', '↓↘→ + K'], ['断天（無敵対空）', '→↓↘ + P（↘↓↘・→押しっぱなし↓はじきでも可）'],
    ['冥爪連撃（3段まで派生）', '↓↙← + P → ↓↙← + P → ↓↙← + P'], ['崩落突進 / 空中で降魔落', '↓↙← + K'],
    ['終縛（コマンド投げ）', '→↘↓↙← + P'], ['超必殺 終焉の柱 / 万象終焉', '↓↘→↓↘→ + P（1本） / + K（2本・投げ）'],
    ['超必殺 万象崩', '↓↙←↓↙← + P（3本）'], ['投げ / パリィ・ラッシュ', '弱P+弱K（つかまれたら弱P+弱Kで抜け） / パリィ（押している間。出始めで受けるとジャストパリィ）／パリィ中に →→ でラッシュ（合わせて1本）／技の途中でパリィか →→ でラッシュキャンセル（3本）'],
  ],
};

// コンボ表（＞=キャンセル　，=目押し　～=ターゲットコンボ）。テストで同じ手順の成立を確認する
//  steps: {b, d, m:[コマンド]}  link:1=目押し（硬直が解けてから押す） noHit:1=当たりを待たない  wait=押すまでのF
KF.COMBOS = {
  // 変身キャラ男（ハンマー形態から始める）
  gai_h: [
    {name: "小技から変身",text: "しゃがみ弱K ＞ しゃがみ弱P ＞ 変身 ＞ 盾突進",steps: [{d: 2,b: "lk"},{d: 2,b: "lp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [2,3,6],b: "lp",noHit: 1,wait: 8}]},
    {name: "ターゲットコンボから大回転",text: "中P ～ 強P ＞ 大回転",steps: [{b: "mp"},{b: "hp"},{m: [2,1,4],b: "lp"}]},
    {name: "強Pから地割れ",text: "強P ＞ 地割れ",steps: [{b: "hp"},{m: [2,3,6],b: "hp"}]},
    {name: "しゃがみ中Pから大回転",text: "しゃがみ中P ＞ 大回転",steps: [{d: 2,b: "mp"},{m: [2,1,4],b: "lp"}]},
    {name: "地響き（中段）から",text: "地響き（中段・床跳ね），強K ＞ 大回転",steps: [{d: 6,b: "hp"},{b: "hk",link: 1},{m: [2,1,4],b: "lp"}]},
    {name: "地響きからかち上げ",text: "地響き（中段・床跳ね），かち上げ",steps: [{d: 6,b: "hp"},{m: [6,2,3],b: "hp",link: 1}]},
    {name: "飛び叩き（中段）から",text: "飛び叩き（中段・床跳ね），中P ＞ 大回転",gap: 120,steps: [{m: [2,3,6],b: "lk"},{b: "mp",link: 1},{m: [2,1,4],b: "lp"}]},
    {name: "超必殺 大槌連打",text: "中P ～ 強P ＞ 大槌連打",sup: 1000,steps: [{b: "mp"},{b: "hp"},{m: [2,3,6,2,3,6],b: "hp"}]},
    {name: "かち上げから天崩",text: "強P ＞ かち上げ ＞ 天崩",sup: 3000,steps: [{b: "hp"},{m: [6,2,3],b: "hp"},{m: [2,3,6,2,3,6],b: "hk"}]},
    {name: "変身して盾突進",text: "強P ＞ 変身 ＞ 盾突進",steps: [{b: "hp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [2,3,6],b: "hp",noHit: 1,wait: 8}]},
    {name: "変身して跳ね上げ",text: "中P ＞ 変身 ＞ 跳ね上げ",steps: [{b: "mp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [6,2,3],b: "hp",noHit: 1,wait: 8}]},
    {name: "ラッシュから",text: "中P ＞ ラッシュ ～ 強P ＞ 大回転",steps: [{b: "mp"},{b: "rush"},{b: "hp",wait: 8,noHit: 1},{m: [2,1,4],b: "lp"}]},
    {name: "飛び込み",text: "ジャンプ強P ， しゃがみ中P ＞ 大回転",jumpIn: "hp",steps: [{d: 2,b: "mp",link: 1},{m: [2,1,4],b: "lp"}]},
    {name: "画面端 壁跳ね",text: "（画面端）強P ＞ 大回転（壁跳ね），かち上げ",corner: 1,steps: [{b: "hp"},{m: [2,1,4],b: "hp"},{m: [6,2,3],b: "hp",link: 1}]},
    {name: "パニッシュカウンター",text: "（相手の空振りに）強K（パニッシュカウンターで浮く），かち上げ",punish: "hk",steps: [{m: [6,2,3],b: "hp",link: 1}]},
    {name: "回し打ちから",text: "中K ～ 強K（回し打ち・浮かせ） ＞ かち上げ",steps: [{b: "mk"},{b: "hk"},{m: [6,2,3],b: "hp"}]},
    {name: "槌突きから",text: "←強P（槌突き） ＞ 地割れ",steps: [{d: 4,b: "hp"},{m: [2,3,6],b: "hp"}]},
    {name: "すくい打ち（下段）から",text: "→中K（すくい打ち・下段） ＞ 地割れ",gap: 100,steps: [{d: 6,b: "mk"},{m: [2,3,6],b: "hp"}]},
    {name: "回し打ちから変身",text: "中K ～ 強K ＞ 変身 ＞ 跳ね上げ",steps: [{b: "mk"},{b: "hk"},{m: [5,2,2,5,5,2],b: "lp"},{m: [6,2,3],b: "hp",noHit: 1,wait: 8}]},
    {name: "変身キャンセル 長いコンボ",text: "強P ＞ 地割れ ＞ 変身 ＞ 光盾投げ ＞ ラッシュ ～ 強P ＞ 跳ね上げ",steps: [{b: "hp"},{m: [2,3,6],b: "hp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [2,1,4],b: "hp",noHit: 1,wait: 4},{b: "rush"},{b: "hp",wait: 8,noHit: 1},{m: [6,2,3],b: "hp"}]},
    {name: "変身キャンセル 地上",text: "中P ～ 強P ＞ 地割れ ＞ 変身 ＞ 盾突進",steps: [{b: "mp"},{b: "hp"},{m: [2,3,6],b: "hp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [2,3,6],b: "hp",noHit: 1,wait: 4}]},
    {name: "床跳ねから変身",text: "地響き（床跳ね），強K ＞ 大回転 ＞ 変身 ＞ 跳ね上げ",steps: [{d: 6,b: "hp"},{b: "hk",link: 1},{m: [2,1,4],b: "lp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [6,2,3],b: "hp",noHit: 1,wait: 4}]},
  ],
  // 変身キャラ男（大盾形態から始める）
  gai_s: [
    {name: "小技から盾突進",text: "しゃがみ弱K ＞ しゃがみ弱P ＞ 盾突進",steps: [{d: 2,b: "lk"},{d: 2,b: "lp"},{m: [2,3,6],b: "lp"}]},
    {name: "ターゲットコンボから盾突進",text: "中P ～ 強P ＞ 盾突進",steps: [{b: "mp"},{b: "hp"},{m: [2,3,6],b: "hp"}]},
    {name: "しゃがみ中Pから盾突進",text: "しゃがみ中P ＞ 盾突進",steps: [{d: 2,b: "mp"},{m: [2,3,6],b: "mp"}]},
    {name: "強Pから跳ね上げ",text: "強P ＞ 跳ね上げ",steps: [{b: "hp"},{m: [6,2,3],b: "hp"}]},
    {name: "反射でしめる",text: "しゃがみ中P ＞ 反射",steps: [{d: 2,b: "mp"},{m: [2,3,6],b: "lk"}]},
    {name: "変身して地割れ",text: "中P ＞ 変身 ＞ 地割れ",steps: [{b: "mp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [2,3,6],b: "hp",noHit: 1,wait: 8}]},
    {name: "変身して大回転",text: "強P ＞ 変身 ＞ 大回転",steps: [{b: "hp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [2,1,4],b: "lp",noHit: 1,wait: 8}]},
    {name: "変身してかち上げ",text: "しゃがみ中P ＞ 変身 ＞ かち上げ",steps: [{d: 2,b: "mp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [6,2,3],b: "hp",noHit: 1,wait: 8}]},
    {name: "超必殺 フォートレスブレイク",text: "中P ～ 強P ＞ フォートレスブレイク",sup: 1000,steps: [{b: "mp"},{b: "hp"},{m: [2,3,6,2,3,6],b: "hp"}]},
    {name: "超必殺 シールドラッシュ",text: "強P ＞ 盾突進 ＞ シールドラッシュ",sup: 2000,steps: [{b: "hp"},{m: [2,3,6],b: "hp"},{m: [2,1,4,2,1,4],b: "hp"}]},
    {name: "跳ね上げから城門崩し",text: "強P ＞ 跳ね上げ ＞ 城門崩し",sup: 3000,steps: [{b: "hp"},{m: [6,2,3],b: "hp"},{m: [2,3,6,2,3,6],b: "hk"}]},
    {name: "ラッシュから",text: "中P ＞ ラッシュ ～ 強P ＞ 盾突進",steps: [{b: "mp"},{b: "rush"},{b: "hp",wait: 8,noHit: 1},{m: [2,3,6],b: "hp"}]},
    {name: "飛び込み",text: "ジャンプ強P ， 強P ＞ 盾突進",jumpIn: "hp",steps: [{b: "hp",link: 1},{m: [2,3,6],b: "hp"}]},
    {name: "盾落とし（中段）から",text: "盾落とし（中段），しゃがみ弱P ＞ 盾突進",steps: [{d: 6,b: "hp"},{d: 2,b: "lp",link: 1},{m: [2,3,6],b: "lp"}]},
    {name: "パニッシュカウンター",text: "（相手の空振りに）強K（パニッシュカウンターで浮く），跳ね上げ",punish: "hk",steps: [{m: [6,2,3],b: "hp",link: 1}]},
    {name: "画面端 壁跳ね",text: "（画面端）強P ＞ EX盾突進（壁跳ね），跳ね上げ",corner: 1,steps: [{b: "hp"},{m: [2,3,6],b: "lp,mp"},{m: [6,2,3],b: "hp",link: 1}]},
    {name: "盾連打から",text: "中K ～ 強K（盾連打） ＞ 盾突進",steps: [{b: "mk"},{b: "hk"},{m: [2,3,6],b: "hp"}]},
    {name: "盾押しから",text: "←強P（盾押し） ＞ 光盾投げ",steps: [{d: 4,b: "hp"},{m: [2,1,4],b: "hp"}]},
    {name: "光盾投げからラッシュ",text: "しゃがみ中P ＞ 光盾投げ ＞ ラッシュ ～ 強P ＞ 盾突進",steps: [{d: 2,b: "mp"},{m: [2,1,4],b: "lp"},{b: "rush"},{b: "hp",wait: 8,noHit: 1},{m: [2,3,6],b: "hp"}]},
    {name: "下段から光盾投げ",text: "しゃがみ中K ＞ 光盾投げ",steps: [{d: 2,b: "mk"},{m: [2,1,4],b: "hp"}]},
    {name: "変身キャンセル 突進から",text: "強P ＞ 盾突進 ＞ 変身 ＞ 大回転",steps: [{b: "hp"},{m: [2,3,6],b: "hp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [2,1,4],b: "hp",noHit: 1,wait: 4}]},
    {name: "変身キャンセル 飛び道具から",text: "しゃがみ中P ＞ 光盾投げ ＞ 変身 ＞ 大回転",steps: [{d: 2,b: "mp"},{m: [2,1,4],b: "hp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [2,1,4],b: "hp",noHit: 1,wait: 4}]},
    {name: "変身キャンセルから超必殺",text: "中K ～ 強K ＞ 盾突進 ＞ 変身 ＞ かち上げ ＞ 天崩",sup: 3000,steps: [{b: "mk"},{b: "hk"},{m: [2,3,6],b: "hp"},{m: [5,2,2,5,5,2],b: "lp"},{m: [6,2,3],b: "hp",noHit: 1,wait: 4},{m: [2,3,6,2,3,6],b: "hk"}]},
  ],
  kokuu: [
    // ---- 基本
    { name: '弱攻撃からダウン', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ 弱P ＞ 迅閃脚', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { b: 'lp' }, { m: [2, 1, 4], b: 'lk' }] },
    { name: '弱攻撃から浮かせ', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ 弱旋風脚 ， 昇穿', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { m: [2, 3, 6], b: 'lk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '差し込み', text: 'しゃがみ中K ＞ 虚環弾', steps: [{ d: 2, b: 'mk' }, { m: [2, 3, 6], b: 'lp' }] },
    { name: '差し込みから浮かせ', text: 'しゃがみ中K ＞ 中旋風脚 ， 昇穿', steps: [{ d: 2, b: 'mk' }, { m: [2, 3, 6], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ターゲットコンボ', text: '中P ～ 強P ＞ 中旋風脚 ， 昇穿', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 3, 6], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '目押し', text: '中P ， しゃがみ中P ＞ 弱旋風脚 ， 昇穿', steps: [{ b: 'mp' }, { d: 2, b: 'mp', link: 1 }, { m: [2, 3, 6], b: 'lk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ターゲットコンボ2', text: '中K ～ 強K ＞ 虚環弾', steps: [{ b: 'mk' }, { b: 'hk' }, { m: [2, 3, 6], b: 'lp' }] },
    { name: '旋踵から', text: '←強K（旋踵）＞ 中旋風脚 ， 昇穿', steps: [{ d: 4, b: 'hk' }, { m: [2, 3, 6], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '虚掌破から', corner: 1, text: '（画面端）強P ＞ 虚掌破 ， 弱旋風脚 ， 昇穿', steps: [{ b: 'hp' }, { m: [2, 1, 4], b: 'hp' }, { m: [2, 3, 6], b: 'lk', link: 1 }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'EX虚掌破（弱攻撃から）', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ EX虚掌破 ， しゃがみ強P ＞ 昇穿（ゲージ2本）', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { m: [2, 1, 4], b: 'lp,mp' }, { d: 2, b: 'hp', link: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    { name: 'アッパー強P拾い', corner: 1, text: '（画面端）強P ＞ 虚掌破 ， 強P ＞ 虚環弾 ＞ ラッシュ ～ 強P ＞ 昇穿（ラッシュ3本）', steps: [{ b: 'hp' }, { m: [2, 1, 4], b: 'hp' }, { b: 'hp', link: 1 }, { m: [2, 3, 6], b: 'lp' }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    { name: 'アッパーから波動ラッシュ', corner: 1, text: '（画面端）強P ＞ 虚掌破 ， 虚環弾 ＞ ラッシュ ～ 強P ＞ 昇穿（ラッシュ3本）', steps: [{ b: 'hp' }, { m: [2, 1, 4], b: 'hp' }, { m: [2, 3, 6], b: 'lp', link: 1 }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    { name: '虚掌破から対空', corner: 1, text: '（画面端）虚掌破 ， しゃがみ強P ＞ 昇穿', steps: [{ m: [2, 1, 4], b: 'hp' }, { d: 2, b: 'hp', link: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    // ---- 応用
    { name: '飛び込み', text: 'ジャンプ強K ， 中P ～ 強P ＞ 中旋風脚 ， 昇穿', jumpIn: 'hk', steps: [{ b: 'mp', link: 1 }, { b: 'hp' }, { m: [2, 3, 6], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'パニッシュカウンター', text: '（相手の空振りに）強K ， 中旋風脚 ， 昇穿', punish: 'hk', steps: [{ m: [2, 3, 6], b: 'mk', link: 1 }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ラッシュキャンセル', text: 'しゃがみ中K ＞ ラッシュ ～ 強P ＞ 中旋風脚 ， 昇穿（ラッシュ3本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [2, 3, 6], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ラッシュ強Kから', text: 'しゃがみ中K ＞ ラッシュ ～ 強K ， 強P ＞ 中旋風脚 ， 昇穿（ラッシュ3本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hk', wait: 7, noHit: 1 }, { b: 'hp', link: 1 }, { m: [2, 3, 6], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ダブルラッシュ', text: 'しゃがみ中K ＞ ラッシュ ～ 強P ＞ ラッシュ ～ 中P ～ 強P ＞ 中旋風脚 ， 昇穿（ラッシュ6本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { b: 'rush' }, { b: 'mp', wait: 7, noHit: 1 }, { b: 'hp' }, { m: [2, 3, 6], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '確定反撃', text: '強P ＞ 昇穿', steps: [{ b: 'hp' }, { m: [6, 2, 3], b: 'hp' }] },
    { name: '特殊技から', text: '→強P（踏破肘）＞ 迅閃脚', gap: 66, steps: [{ d: 6, b: 'hp' }, { m: [2, 1, 4], b: 'mk' }] },
    // ---- 超必殺
    { name: '超必殺', text: 'しゃがみ中K ＞ 虚空砲（1本）', steps: [{ d: 2, b: 'mk' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp' }], sup: 1000 },
    { name: '超必殺 浮かせから', text: '中P ～ 強P ＞ 中旋風脚 ＞ 虚空砲（1本）', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 3, 6], b: 'mk' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp', wait: 4, noHit: 1 }], sup: 1000 },
    { name: '超必殺 密着', text: '強P ＞ 虚空砲（1本・密着でも根元が当たる）', gap: 36, steps: [{ b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp' }], sup: 1000 },
    { name: '超必殺 虚掌破から', corner: 1, text: '（画面端）虚掌破 ， 虚空砲（1本）', steps: [{ m: [2, 1, 4], b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp', link: 1 }], sup: 1000 },
    { name: '超必殺2', text: '中P ～ 強P ＞ 零界継承（2本）', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 1, 4, 2, 1, 4], b: 'hp' }], sup: 2000 },
    { name: '超必殺3', text: '中P ～ 強P ＞ 中旋風脚 ＞ 天地穿（3本）', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 3, 6], b: 'mk' }, { m: [2, 3, 6, 2, 3, 6], b: 'hk', wait: 4, noHit: 1 }], sup: 3000 },
    { name: '昇竜SA', text: '強昇穿（根本）＞ 天地穿（3本）', steps: [{ m: [6, 2, 3], b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hk' }], sup: 3000 },
    { name: '確定反撃 昇竜SA', text: '強P ＞ 強昇穿 ＞ 天地穿（3本）', steps: [{ b: 'hp' }, { m: [6, 2, 3], b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hk' }], sup: 3000 },
    { name: 'EX昇竜SA', text: 'EX昇穿 ＞ 零界継承（ゲージ2本＋必殺2本）', steps: [{ m: [6, 2, 3], b: 'lp,mp' }, { m: [2, 1, 4, 2, 1, 4], b: 'hp' }], sup: 2000 },
    { name: 'パニッシュカウンター超必殺', text: '（相手の空振りに）強K ， 虚空砲（1本）', punish: 'hk', steps: [{ m: [2, 3, 6, 2, 3, 6], b: 'hp', link: 1 }], sup: 1000 },
  ],
  shuuen: [
    { name: '目押し', text: 'しゃがみ弱P ， しゃがみ弱P ＞ 崩落突進', steps: [{ d: 2, b: 'lp' }, { d: 2, b: 'lp', link: 1 }, { m: [2, 1, 4], b: 'lk' }] },
    { name: '弱攻撃から', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ 崩落突進', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { m: [2, 1, 4], b: 'lk' }] },
    { name: 'ターゲットコンボ', text: '中K ～ 強P ＞ 崩落突進', steps: [{ b: 'mk' }, { b: 'hp' }, { m: [2, 1, 4], b: 'hk' }] },
    { name: '確定反撃', text: '強P ＞ 断天', steps: [{ b: 'hp' }, { m: [6, 2, 3], b: 'hp' }] },
    { name: '飛び込み', text: 'ジャンプ強P ， しゃがみ中P ＞ 崩落突進', jumpIn: 'hp', steps: [{ d: 2, b: 'mp', link: 1 }, { m: [2, 1, 4], b: 'mk' }] },
    { name: 'パニッシュカウンター', text: '（相手の空振りに）強P ＞ ラッシュ ～ 強P ＞ 崩落突進（ラッシュ3本）', punish: 'hp', steps: [{ b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [2, 1, 4], b: 'hk' }] },
    { name: 'ラッシュキャンセル', text: 'しゃがみ中K ＞ ラッシュ ～ 強P ＞ 断天（ラッシュ3本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    { name: '超必殺', text: '強P ＞ 終焉の柱（1本）', steps: [{ b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp' }], sup: 1000 },
    { name: '冥爪連撃', text: '冥爪連撃 ＞ 二 ＞ 終', steps: [{ m: [2, 1, 4], b: 'lp' }, { m: [2, 1, 4], b: 'lp' }, { m: [2, 1, 4], b: 'lp' }], gap: 56 },
    { name: '弱攻撃から連撃', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ 冥爪連撃 ＞ 二 ＞ 終', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { m: [2, 1, 4], b: 'lp' }, { m: [2, 1, 4], b: 'lp' }, { m: [2, 1, 4], b: 'lp' }] },
    { name: 'ターゲットコンボ2', text: '強P ～ 強K', steps: [{ b: 'hp' }, { b: 'hk' }] },
    { name: '特殊技から', text: '→強P（破頭）＞ 崩落突進', steps: [{ d: 6, b: 'hp' }, { m: [2, 1, 4], b: 'hk' }] },
    { name: '超必殺3', text: '強P ＞ 万象崩（3本）', steps: [{ b: 'hp' }, { m: [2, 1, 4, 2, 1, 4], b: 'hp' }], sup: 3000 },
  ],
};

// 対空技の攻撃判定の補正（密着の立ち・しゃがみの相手にも当たるよう、下と前に伸ばす）
KF.HIT_FIX = {
  'gai:c_hp': { y1: -60, x0: -4 },
  'gai:sp_upper': { y1: -60 },
  'gai:sp_lift': { y1: -60 },
  'kokuu:c_hp': { y1: -86 },
  'kokuu:sp_palm': { y1: -84 },
  'kokuu:ex_palm': { y1: -84 },
  'shuuen:c_hp': { y1: -86 },
  'shuuen:b_hp': { x0: -10, x1: 40, y1: -100 },
  'kokuu:sp_dp': { y1: -96 },
  'shuuen:sp_dp': { y1: -96 },
  'kokuu:ex_dp': { y1: -96 },
  'shuuen:ex_dp': { y1: -96 }
};

// 紺野ユイ：今は道着キャラ男（kokuu）と同じ技・判定を使う（攻撃の絵はまだ無いので、攻撃中は仮の絵）
KF.CHARS.yui = Object.assign({}, KF.CHARS.kokuu, { name: '紺野ユイ', en: 'YUI', color: '#5c8dff' });
KF.COMMANDS.yui = KF.COMMANDS.kokuu;
if (KF.MOVE_LIST.kokuu) KF.MOVE_LIST.yui = KF.MOVE_LIST.kokuu;
if (KF.COMBOS.kokuu) KF.COMBOS.yui = KF.COMBOS.kokuu;
KF.HIT_FIX['yui:sp_dp'] = KF.HIT_FIX['kokuu:sp_dp'];
KF.HIT_FIX['yui:ex_dp'] = KF.HIT_FIX['kokuu:ex_dp'];
KF.kokuuType = function (k) { return k === 'kokuu' || k === 'yui'; };
