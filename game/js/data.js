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
  GRAVITY: 0.62, JUMP_VY: -12.4, JUMP_VX: 3.6,
  RUSH_MAX: 6000, RUSH_SEG: 1000, RUSH_NEUTRAL_COST: 1000, RUSH_CANCEL_COST: 3000,
  RUSH_REGEN: 5, RUSH_REGEN_FWD: 7, RUSH_COOLDOWN: 90, RUSH_BONUS_ADV: 4, RUSH_REC_CUT: 5,
  SUPER_MAX: 3000, SUPER_BAR: 1000, EX_COST: 1000, EX_MAX: 2000,   // EXゲージは超必殺とは別枠（2本・EX技1回で1本）
  ROUND_TIME: 99, JUGGLE_LIMIT: 3,
  SCALING: [1.0, 1.0, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25, 0.2],
  RUSH_CANCEL_SCALE: 0.85,
  THROW_RANGE: 88, THROW_TECH_WINDOW: 10,
};

KF.CHARS = {
  kokuu: {
    name: '道着キャラ男', en: 'KOKUU', hp: 10000, walkF: 1.9, walkB: 1.5, dashF: 7.2, dashB: -6.4,
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
      j_lk: { anim: 'j_k', dmg: 450, stun: [16, 12], hs: 8, push: [3, 3], lv: 'o', air: 1 },
      j_mk: { anim: 'j_k', dmg: 600, stun: [18, 14], hs: 10, push: [3, 3], lv: 'o', air: 1 },
      j_hk: { anim: 'j_hk', dmg: 900, stun: [22, 17], hs: 12, push: [3, 3], lv: 'o', air: 1 },
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
      fire_ex: { anim: 'ex_fire', type: 'x', name: 'EX虚環弾', dmg: 450, adv: [6, 0], hs: 10, push: [6, 6], lv: 'm', chip: 0.125,
              proj: { fx: 'ball_k_ex', spd: [7.0, 7.0, 7.0], life: 140, hits: 2, r: 18, rehit: 8 }, cancel: 'u' },
      // 昇穿：スト6の昇龍拳と同じ。発生 弱5F・中6F・強7F／空中の攻撃にだけ無敵 弱1-14F・中1-9F・強1-8F／ガード -23・-32・-39F
      dp: { anim: 'sp_dp', type: 's', name: '昇穿', dmg: [1000, 1200, 1400], adv: ['kd', [-31, -36, -39]], hs: 12, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch', jlim: 2, jinc: 3, cancel: 'u', saGround: 1, saOnly: ['su3'], rootF: [2, 2, 1], rootDmg: 800,
            preDelay: [2, 3, 4], aaInv: [[1, 14], [1, 9], [1, 8]], jump: { vx: [1.6, 2.2, 2.8], vy: [-9.5, -10.8, -12.0] }, lvy: -9, lvx: 2.5, meter: 40 },
      dp_ex: { anim: 'ex_dp', type: 'x', name: 'EX昇穿', dmg: 800, adv: ['kd', -34], hs: 12, push: [2, 4], lv: 'm', chip: 0.125, kd: 'launch', hits: 2, rehit: 7, jlim: 3, jinc: 3, cancel: 'u', saGround: 1, saOnly: ['su2', 'su3'],
            preDelay: 3, inv: [[1, 9]], jump: { vx: [2.4], vy: [-12.4] }, lvy: -10, lvx: 2.5, jg: 1 },   // EX：発生は中と同じ6F・完全無敵
      // 迅閃脚：下段スライディング。飛び道具をくぐり、当たるとダウン。ガードされると大きく不利。間合いは弱＜中＜強
      rushk: { anim: 'sp_slide', type: 's', name: '迅閃脚', dmg: [800, 900, 1000], adv: ['kd', -10], hs: 12, push: [3, 6], lv: 'l', chip: 0.125,
               kd: 'sweep', projInv: 1, jlim: 0, dash: { vx: [4.6, 5.8, 7.0], vy: 0 }, meter: 40 },
      rushk_ex: { anim: 'ex_rush', type: 'x', name: 'EX迅閃脚', dmg: 700, hs: 12, push: [4, 7], lv: 'm', chip: 0.125, hits: 2, rehit: 9,
               dash: { vx: [8.5], vy: -3.5 }, projInv: 1, kd: 'launch', lvy: -7, lvx: 3 },
      // 旋風脚：コンボの部品。最後の1発で浮かせ、昇穿や超必殺で追撃できる。弱＝その場で高く／中＝運ぶ／強＝画面端まで運ぶ
      tatsu: { anim: 'sp_tatsu', type: 's', name: '旋風脚', dmg: [300, 320, 340], hits: 3, rehit: 7, hs: 8, push: [1.2, 3], lv: 'm', chip: 0.125,
               dash: { vx: [2.0, 3.6, 5.2], vy: 0 }, kdLast: 'launch', lvy: [-9.0, -8.6, -8.2], lvx: [0.8, 1.6, 2.4], jset: 1, jlim: 1, cancel: 'u', meter: 40 },
      atatsu: { anim: 'sp_atatsu', type: 's', name: '空旋脚', air: 1, dmg: 350, hits: 2, rehit: 7, hs: 8, push: [2, 3], lv: 'm', stun: [16, 12], stall: [2.4, 3.0, 3.6], jlim: 2 },
      palm: { anim: 'sp_palm', type: 's', name: '虚掌破', dmg: [900, 1000, 1100], adv: [0, -8], hs: 13, push: [2, 7], lv: 'm', chip: 0.125,
              kd: 'launch', lvy: -6, lvx: 0.3, floatG: 0.25, jset: -1, jlim: 0, cancel: 'u', meter: 40,   // ふわっと浮かせる（波動などで拾いやすい）
              preDelay: 10 },   // 発生24F。のけぞりの長い強P系からだけつながり、弱・中からは出るがつながらない
      // EX虚掌破：発生7F。弱・中・強どの通常技からでもつながる
      palm_ex: { anim: 'ex_palm', type: 'x', name: 'EX虚掌破', dmg: 1000, adv: [0, -4], hs: 13, push: [2, 6], lv: 'm', chip: 0.125,
              kd: 'launch', lvy: -10, lvx: 0.8, jset: 0, jlim: 0, cancel: 'u' },
      su3: { anim: 'su_3', type: 'u', bars: 3, name: '天地穿', dmg: 600, hits: 7, rehit: 5, hs: 6, push: [0.3, 2], lv: 'm', chip: 0.25,
             inv: [[1, 44]], lock: 1, lockAir: 1, dashS: 7, jump: { vx: [0.8], vy: [-10] }, kdLast: 'launch', lvy: -12, lvx: 2.5, lastDmg: 1800, minScale: 0.7 },
      su1: { anim: 'su_1', type: 'u', bars: 1, name: '虚空砲', dmg: 620, hits: 5, rehit: 8, hs: 6, push: [1.5, 2], lv: 'm', chip: 0.25,
             inv: [[1, 14]], beam: { fx: 'beam_k', head: 'beamhead_k', len: 600, h: 34 }, kdLast: 'launch', lvy: -8, lvx: 4, minScale: 0.7 },
      su2: { anim: 'su_2', type: 'u', bars: 2, name: '零界継承', dmg: 520, hits: 9, rehit: 6, hs: 6, push: [0.5, 4], lv: 'm', chip: 0.25,
             inv: [[1, 26]], lock: 1, dashS: 9.0, kdLast: 'launch', lvy: -11, lvx: 3, lastDmg: 1300, minScale: 0.7 },
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
    { seq: [2, 1, 4], btn: 'P', win: 12, move: 'palm' },
    { seq: [2, 1, 4], btn: 'K', win: 12, move: 'rushk' },
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
    ['虚環弾', '↓↘→ + P'], ['昇穿（対空・空中の攻撃に無敵／EXは完全無敵）', '→↓↘ + P（前→下→前 なら出る）'], ['旋風脚（浮かせて追撃）/ 空中で空旋脚', '↓↘→ + K'],
    ['虚掌破（アッパー・発生24F。強P系からだけつながる／EXはどこからでも）', '↓↙← + P'], ['迅閃脚（下段スライディング）', '↓↙← + K'], ['EX必殺技', '各コマンド + ボタン2つ（必殺ゲージ0.5本）'],
    ['超必殺 虚空砲 / 天地穿', '↓↘→↓↘→ + P（1本） / + K（3本）'], ['超必殺 零界継承', '↓↙←↓↙← + P（2本）'],
    ['投げ / ラッシュ', '弱P+弱K（つかまれたら弱P+弱Kで抜け） / RUSH（技のキャンセルは →→ でも）'],
  ],
  shuuen: [
    ['特殊技 破頭', '→ + 強P'], ['特殊技 圧殺踏（中段）', '→ + 中K'], ['特殊技 掬い爪（対空）', '← + 強P'],
    ['ターゲットコンボ 砕撃 / 轟連', '中K ～ 強P ／ 強P ～ 強K'],
    ['冥核弾', '↓↘→ + P'], ['地裂脚（下段の衝撃波）', '↓↘→ + K'], ['断天（無敵対空）', '→↓↘ + P（↘↓↘・→押しっぱなし↓はじきでも可）'],
    ['冥爪連撃（3段まで派生）', '↓↙← + P → ↓↙← + P → ↓↙← + P'], ['崩落突進 / 空中で降魔落', '↓↙← + K'],
    ['終縛（コマンド投げ）', '→↘↓↙← + P'], ['超必殺 終焉の柱 / 万象終焉', '↓↘→↓↘→ + P（1本） / + K（2本・投げ）'],
    ['超必殺 万象崩', '↓↙←↓↙← + P（3本）'], ['投げ / ラッシュ', '弱P+弱K（つかまれたら弱P+弱Kで抜け） / RUSH（技のキャンセルは →→ でも）'],
  ],
};

// コンボ表（＞=キャンセル　，=目押し　～=ターゲットコンボ）。テストで同じ手順の成立を確認する
//  steps: {b, d, m:[コマンド]}  link:1=目押し（硬直が解けてから押す） noHit:1=当たりを待たない  wait=押すまでのF
KF.COMBOS = {
  kokuu: [
    // ---- 基本
    { name: '弱攻撃からダウン', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ 弱P ＞ 迅閃脚', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { b: 'lp' }, { m: [2, 1, 4], b: 'lk' }] },
    { name: '弱攻撃から浮かせ', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ 弱旋風脚 ， 昇穿', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { m: [2, 3, 6], b: 'lk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '差し込み', text: 'しゃがみ中K ＞ 虚環弾', steps: [{ d: 2, b: 'mk' }, { m: [2, 3, 6], b: 'lp' }] },
    { name: '差し込みから浮かせ', text: 'しゃがみ中K ＞ 中旋風脚 ， 昇穿', steps: [{ d: 2, b: 'mk' }, { m: [2, 3, 6], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ターゲットコンボ', text: '中P ～ 強P ＞ 強旋風脚 ， 昇穿', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 3, 6], b: 'hk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '目押し', text: '中P ， しゃがみ中P ＞ 弱旋風脚 ， 昇穿', steps: [{ b: 'mp' }, { d: 2, b: 'mp', link: 1 }, { m: [2, 3, 6], b: 'lk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ターゲットコンボ2', text: '中K ～ 強K ＞ 虚環弾', steps: [{ b: 'mk' }, { b: 'hk' }, { m: [2, 3, 6], b: 'lp' }] },
    { name: '旋踵から', text: '←強K（旋踵）＞ 中旋風脚 ， 昇穿', steps: [{ d: 4, b: 'hk' }, { m: [2, 3, 6], b: 'mk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '虚掌破から', text: '強P ＞ 虚掌破 ， 弱旋風脚 ， 昇穿', steps: [{ b: 'hp' }, { m: [2, 1, 4], b: 'hp' }, { m: [2, 3, 6], b: 'lk', link: 1 }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'EX虚掌破（弱攻撃から）', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ EX虚掌破 ， しゃがみ強P ＞ 昇穿（EXゲージ1本）', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { m: [2, 1, 4], b: 'lp,mp' }, { d: 2, b: 'hp', link: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    { name: 'アッパー強P拾い', text: '強P ＞ 虚掌破 ， 強P ＞ 虚環弾 ＞ RUSH ～ 強P ＞ 昇穿（ラッシュ3本）', steps: [{ b: 'hp' }, { m: [2, 1, 4], b: 'hp' }, { b: 'hp', link: 1 }, { m: [2, 3, 6], b: 'lp' }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    { name: 'アッパーから波動ラッシュ', text: '強P ＞ 虚掌破 ， 虚環弾 ＞ RUSH ～ 強P ＞ 昇穿（ラッシュ3本）', steps: [{ b: 'hp' }, { m: [2, 1, 4], b: 'hp' }, { m: [2, 3, 6], b: 'lp', link: 1 }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    { name: '虚掌破から対空', text: '虚掌破 ， しゃがみ強P ＞ 昇穿', steps: [{ m: [2, 1, 4], b: 'hp' }, { d: 2, b: 'hp', link: 1 }, { m: [6, 2, 3], b: 'hp' }] },
    // ---- 応用
    { name: '飛び込み', text: 'ジャンプ強K ， 中P ～ 強P ＞ 強旋風脚 ， 昇穿', jumpIn: 'hk', steps: [{ b: 'mp', link: 1 }, { b: 'hp' }, { m: [2, 3, 6], b: 'hk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'パニッシュカウンター', text: '（相手の空振りに）強K ， 強旋風脚 ， 昇穿', punish: 'hk', steps: [{ m: [2, 3, 6], b: 'hk', link: 1 }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ラッシュキャンセル', text: 'しゃがみ中K ＞ RUSH ～ 強P ＞ 強旋風脚 ， 昇穿（ラッシュ3本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [2, 3, 6], b: 'hk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ラッシュ強Kから', text: 'しゃがみ中K ＞ RUSH ～ 強K ， 強P ＞ 強旋風脚 ， 昇穿（ラッシュ3本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hk', wait: 7, noHit: 1 }, { b: 'hp', link: 1 }, { m: [2, 3, 6], b: 'hk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: 'ダブルラッシュ', text: 'しゃがみ中K ＞ RUSH ～ 強P ＞ RUSH ～ 中P ～ 強P ＞ 強旋風脚 ， 昇穿（ラッシュ6本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { b: 'rush' }, { b: 'mp', wait: 7, noHit: 1 }, { b: 'hp' }, { m: [2, 3, 6], b: 'hk' }, { m: [6, 2, 3], b: 'hp', link: 1 }] },
    { name: '確定反撃', text: '強P ＞ 昇穿', steps: [{ b: 'hp' }, { m: [6, 2, 3], b: 'hp' }] },
    { name: '特殊技から', text: '→強P（踏破肘）＞ 迅閃脚', gap: 66, steps: [{ d: 6, b: 'hp' }, { m: [2, 1, 4], b: 'mk' }] },
    // ---- 超必殺
    { name: '超必殺', text: 'しゃがみ中K ＞ 虚空砲（1本）', steps: [{ d: 2, b: 'mk' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp' }], sup: 1000 },
    { name: '超必殺 浮かせから', text: '中P ～ 強P ＞ 強旋風脚 ＞ 虚空砲（1本）', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 3, 6], b: 'hk' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp', wait: 4, noHit: 1 }], sup: 1000 },
    { name: '超必殺 密着', text: '強P ＞ 虚空砲（1本・密着でも根元が当たる）', gap: 36, steps: [{ b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp' }], sup: 1000 },
    { name: '超必殺 虚掌破から', text: '虚掌破 ， 虚空砲（1本）', steps: [{ m: [2, 1, 4], b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hp', link: 1 }], sup: 1000 },
    { name: '超必殺2', text: '中P ～ 強P ＞ 零界継承（2本）', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 1, 4, 2, 1, 4], b: 'hp' }], sup: 2000 },
    { name: '超必殺3', text: '中P ～ 強P ＞ 強旋風脚 ＞ 天地穿（3本）', steps: [{ b: 'mp' }, { b: 'hp' }, { m: [2, 3, 6], b: 'hk' }, { m: [2, 3, 6, 2, 3, 6], b: 'hk', wait: 4, noHit: 1 }], sup: 3000 },
    { name: '昇竜SA', text: '強昇穿（根本）＞ 天地穿（3本）', steps: [{ m: [6, 2, 3], b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hk' }], sup: 3000 },
    { name: '確定反撃 昇竜SA', text: '強P ＞ 強昇穿 ＞ 天地穿（3本）', steps: [{ b: 'hp' }, { m: [6, 2, 3], b: 'hp' }, { m: [2, 3, 6, 2, 3, 6], b: 'hk' }], sup: 3000 },
    { name: 'EX昇竜SA', text: 'EX昇穿 ＞ 零界継承（EXゲージ1本＋2本）', steps: [{ m: [6, 2, 3], b: 'lp,mp' }, { m: [2, 1, 4, 2, 1, 4], b: 'hp' }], sup: 2000 },
    { name: 'パニッシュカウンター超必殺', text: '（相手の空振りに）強K ， 虚空砲（1本）', punish: 'hk', steps: [{ m: [2, 3, 6, 2, 3, 6], b: 'hp', link: 1 }], sup: 1000 },
  ],
  shuuen: [
    { name: '目押し', text: 'しゃがみ弱P ， しゃがみ弱P ＞ 崩落突進', steps: [{ d: 2, b: 'lp' }, { d: 2, b: 'lp', link: 1 }, { m: [2, 1, 4], b: 'lk' }] },
    { name: '弱攻撃から', text: 'しゃがみ弱K ＞ しゃがみ弱P ＞ 崩落突進', steps: [{ d: 2, b: 'lk' }, { d: 2, b: 'lp' }, { m: [2, 1, 4], b: 'lk' }] },
    { name: 'ターゲットコンボ', text: '中K ～ 強P ＞ 崩落突進', steps: [{ b: 'mk' }, { b: 'hp' }, { m: [2, 1, 4], b: 'hk' }] },
    { name: '確定反撃', text: '強P ＞ 断天', steps: [{ b: 'hp' }, { m: [6, 2, 3], b: 'hp' }] },
    { name: '飛び込み', text: 'ジャンプ強P ， しゃがみ中P ＞ 崩落突進', jumpIn: 'hp', steps: [{ d: 2, b: 'mp', link: 1 }, { m: [2, 1, 4], b: 'mk' }] },
    { name: 'パニッシュカウンター', text: '（相手の空振りに）強P ＞ RUSH ～ 強P ＞ 崩落突進（ラッシュ3本）', punish: 'hp', steps: [{ b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [2, 1, 4], b: 'hk' }] },
    { name: 'ラッシュキャンセル', text: 'しゃがみ中K ＞ RUSH ～ 強P ＞ 断天（ラッシュ3本）', steps: [{ d: 2, b: 'mk' }, { b: 'rush' }, { b: 'hp', wait: 7, noHit: 1 }, { m: [6, 2, 3], b: 'hp' }] },
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
