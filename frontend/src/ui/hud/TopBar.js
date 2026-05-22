// 우상단 + 좌상단 + 상단 가운데 통합 TopBar.
// 1단계 ✓ 빈 골격
// 2단계 ✓ 5 아이콘바
// 3단계 ✓ 미니 패널 (가로형 360×160)
// 4단계 ✓ 좌상단 박스 2개 + 콤보 배지 + 상단 가운데 텍스트 통합 (현재)
//
// 외부 인터페이스: new TopBar(scene, callbacks) / updateAll(data) / destroy().

import { FONT_PIXEL, addText, bindHover } from '../theme.js';
import { SIN_LIST, SIN_NAMES, SIN_ICONS, SIN_COLORS } from '../../data/sins.js';
import { isEquipmentUnlocked } from '../../data/meta/diamonds.js';
const HUD_FONT = FONT_PIXEL;
const ICON_BAR_DEPTH = 14;

// hex 색을 비율(0~1)만큼 어둡게. '#RRGGBB' → '#RRGGBB'.
function _dimHex(hex, ratio) {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.max(0, Math.min(255, Math.round(r * ratio)));
  const dg = Math.max(0, Math.min(255, Math.round(g * ratio)));
  const db = Math.max(0, Math.min(255, Math.round(b * ratio)));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(dr)}${toHex(dg)}${toHex(db)}`;
}

// 좌상단 박스 / 색 상수 (PALETTE 가까이 일치)
const COL = {
  bgBlack:      0x000000,
  bgDark:       0x1A1A1F,
  goldBright:   0xC5A059,
  goldDark:     0x8B7355,
  red:          0xC5404A,
  redDark:      0x6A2025,
  borderLight:  0x4A4A50,
  textPrimary:  0xE8E8E8,
};
const HX = {
  goldBright:   '#C5A059',
  textPrimary:  '#E8E8E8',
  textSecondary:'#9A9AA2',
  redDark:      '#6A2025',
};

// [Phase K → P-29 → P-37] 10 스탯 풀 표시 — 라벨만 표시 (icon 제거, P-37).
//   공속 (attackSpeed) — ms 단위 → % 표시 통일 (P-37). base 100% / delta 변환.
//   fmtMain(v): base value 만 표기 (흰색)
//   fmtDelta(v): equipment 또는 cards+synergy 의 delta 만 표기 ((+N) 형식, 부호 자동)
//   name: _statSources 키 (getStatBreakdown 호출용)
const _signed = (v, fmt) => `${v > 0 ? '+' : ''}${fmt(v)}`;
const _BASE_AS = 900;  // [Phase P-37] 공속 % 변환 기준 (Player.resetForNewStage 의 baseStats.attackSpeed).
const STATS_DEF = [
  { label: 'HP',     name: 'maxHp',
    fmtMain:  v => `${v}`,
    fmtDelta: v => _signed(v, x => `${Math.round(x)}`) },
  { label: '공격',   name: 'attackPower',
    fmtMain:  v => `${v}`,
    fmtDelta: v => _signed(v, x => x % 1 === 0 ? `${x}` : x.toFixed(1)) },
  // [Phase P-37] attackSpeed ms 단위 → % 통일. base 항상 100% / delta 음수 ms = +% (빠름).
  //   변환: pct = -delta / BASE_AS × 100 (round). 예: -50ms → +6% / -100ms → +11%.
  { label: '공속',   name: 'attackSpeed',
    fmtMain:  () => '100%',
    fmtDelta: v => {
      const pct = Math.round(-v / _BASE_AS * 100);
      return pct > 0 ? `+${pct}%` : `${pct}%`;
    } },
  { label: '치명',   name: 'critChance',
    fmtMain:  v => `${Math.round(v * 100)}%`,
    fmtDelta: v => _signed(v, x => `${Math.round(x * 100)}%`) },
  { label: '치피',   name: 'critDamage',
    fmtMain:  v => `${Math.round(v * 100)}%`,
    fmtDelta: v => _signed(v, x => `${Math.round(x * 100)}%`) },
  { label: '명중',   name: 'accuracy',
    fmtMain:  v => `${Math.round(v * 100)}%`,
    fmtDelta: v => _signed(v, x => `${Math.round(x * 100)}%`) },
  { label: '회피',   name: 'dodge',
    fmtMain:  v => `${Math.round(v * 100)}%`,
    fmtDelta: v => _signed(v, x => `${Math.round(x * 100)}%`) },
  { label: '흡혈',   name: 'lifesteal',
    fmtMain:  v => `${(v * 100).toFixed(0)}%`,
    fmtDelta: v => _signed(v, x => `${(x * 100).toFixed(0)}%`) },
  { label: '피감',   name: 'damageReduction',
    fmtMain:  v => `${Math.round(v * 100)}%`,
    fmtDelta: v => _signed(v, x => `${Math.round(x * 100)}%`) },
  { label: '골드',   name: 'goldGainMul',
    fmtMain:  v => `×${v.toFixed(2)}`,
    fmtDelta: v => _signed(v, x => `×${x.toFixed(2)}`) },
];

// === Phase E6 색상 ===
const STAT_COLOR_BASE = '#FFFFFF';
const STAT_COLOR_EQUIP = '#FF6666';
const STAT_COLOR_CS    = '#66AAFF';

// [Phase P-40] 시너지 단계 라벨 (SynergyInfoModal 의 TIER_NAMES 와 통일).
const TIER_NAMES = { 3: '3단계', 6: '6단계', 9: '9단계' };
const TIER_COLORS = { 3: '#A4D86E', 6: '#60A5FA', 9: '#FFD700' };

class TopBar {
  constructor(scene, callbacks) {
    this.scene = scene;
    this.callbacks = callbacks || {};
    this._hudDepth = 10;

    this._buildLeftTopBox();      // Lv/HP/EXP/골드
    this._buildLeftBottomBox();   // 10 스탯
    this._buildStageText();       // 상단 가운데
    // [무한 맵] 옛 상단 콤보 배지 제거 — ComboFloat (플레이어 위) 로 이전.
    this._buildIconBar();         // 우상단 5 아이콘
  }

  // === 좌상단 위 박스 (280×90, Lv/EXP/골드) ===
  // [Phase P-29 → P-34 → P-40] 박스 폭 280 / row 3 (Lv y=25 / EXP y=50 / 골드 y=75) /
  //   height 90. 아래 stat 박스 (STAT_Y=100) 와 gap 0 — 시각 통합 (P-40).
  _buildLeftTopBox() {
    const scene = this.scene;
    const HUD_X = 10, HUD_Y = 10, HUD_W = 280, HUD_H = 90;
    // 글래스 배경 (alpha 0.35, radius 4)
    const hudG = scene.add.graphics().setDepth(this._hudDepth - 1).setScrollFactor(0);
    hudG.fillStyle(COL.bgBlack, 0.35);
    hudG.fillRoundedRect(HUD_X, HUD_Y, HUD_W, HUD_H, 4);

    const ROW_LX = HUD_X + 12;          // 22
    const BAR_W = 150;                  // [Phase P-34] 110→150 — 큰 EXP 수치 / 호환.
    const BAR_CX = ROW_LX + BAR_W / 2;  // 97
    const VAL_LX = ROW_LX + BAR_W + 8;  // 180
    const ROW_Y = [25, 50, 75];         // Lv / EXP / 골드 (3 row)

    this.lvText = addText(scene, ROW_LX, ROW_Y[0], 'Lv.1', {
      fontFamily: HUD_FONT, fontSize: '22px', color: HX.goldBright, fontStyle: '700',
    }).setOrigin(0, 0.5).setDepth(this._hudDepth + 2).setScrollFactor(0);
    this.lvText.setShadow(1, 1, '#000000', 2, false, true);

    this.expBar = this._makeProgressBar(BAR_CX, ROW_Y[1], BAR_W, 9, COL.goldBright, COL.goldDark);
    this.expValText = addText(scene, VAL_LX, ROW_Y[1], '0/0', {
      fontFamily: HUD_FONT, fontSize: '19px', color: HX.textPrimary, fontStyle: '500',
    }).setOrigin(0, 0.5).setDepth(this._hudDepth + 2).setScrollFactor(0);
    this.expValText.setShadow(1, 1, '#000000', 2, false, true);

    // 골드 — 아이콘 (PNG) + 숫자.
    const _GOLD_ICON_W = 24, _GOLD_ICON_H = 16, _GOLD_ICON_GAP = 4;
    this.goldIcon = scene.textures.exists('icon-gold')
      ? scene.add.image(ROW_LX + _GOLD_ICON_W / 2, ROW_Y[2], 'icon-gold')
          .setDisplaySize(_GOLD_ICON_W, _GOLD_ICON_H).setOrigin(0.5)
          .setDepth(this._hudDepth + 2).setScrollFactor(0)
      : null;
    this.goldText = addText(scene, ROW_LX + _GOLD_ICON_W + _GOLD_ICON_GAP, ROW_Y[2], '0', {
      fontFamily: HUD_FONT, fontSize: '19px', color: HX.goldBright, fontStyle: '700',
    }).setOrigin(0, 0.5).setDepth(this._hudDepth + 2).setScrollFactor(0);
    this.goldText.setShadow(1, 1, '#000000', 2, false, true);

    this._leftTopEls = [hudG, this.lvText, this.expValText, this.goldText];
    if (this.goldIcon) this._leftTopEls.push(this.goldIcon);
  }

  // === 좌상단 아래 박스 (280×320, 10 스탯 + 시너지 강화) ===
  // [Phase P-19/29/34/36/37] 폭 280 / VAL_LX 70 / 좌측 정렬 / icon 제거.
  // [Phase P-40] STAT_Y 105→100 (위 박스와 gap 0, 시각 통합) + STAT_H 285→320 (시너지 강화
  //              영역 추가) + 구분선 2개 (위/stat 경계 + stat/시너지 경계) +
  //              VAL_LX 70→80 (LABEL_W 50 컬럼 정렬).
  _buildLeftBottomBox() {
    const scene = this.scene;
    const STAT_X = 10, STAT_Y = 100, STAT_W = 280, STAT_H = 320;
    const statG = scene.add.graphics().setDepth(this._hudDepth - 1).setScrollFactor(0);
    statG.fillStyle(COL.bgBlack, 0.35);
    statG.fillRoundedRect(STAT_X, STAT_Y, STAT_W, STAT_H, 4);

    // [Phase P-40] 구분선 1: 위 박스 (Lv/EXP/골드) ↔ stat 영역 (y=100, 박스 상단).
    const dividerG = scene.add.graphics().setDepth(this._hudDepth).setScrollFactor(0);
    dividerG.lineStyle(1, COL.goldDark, 0.4);
    dividerG.lineBetween(STAT_X + 8, STAT_Y + 1, STAT_X + STAT_W - 8, STAT_Y + 1);

    const STAT_Y0 = 115, STAT_DY = 22;
    // [Phase P-40] LABEL_X 20 / LABEL_W 50 / VAL_X 80 — 컬럼 정렬 (라벨 / 수치 일관 시작).
    // [Phase P-44e] DELTA_RIGHT = STAT_W - 10 = 270 (박스 안 우측 끝, eq/cs 우측 정렬).
    const LABEL_X = 20, VAL_LX = 80, DELTA_RIGHT = STAT_W - 10;
    this._statTexts = [];
    this._leftBottomEls = [statG];

    // Phase E6 — 각 스탯 행에 3 Text (main / equipment / cards+synergy) 배치.
    // [Phase P-36] origin (0, 0.5) 좌측 정렬. P-37 icon Text 제거 — 라벨 + 수치만.
    // [Phase P-44e] eq/cs 우측 정렬 (origin 1, 0.5) + 폰트 16→13px 축소.
    //   main 은 좌측 정렬 (라벨 옆), eq/cs 는 박스 우측 끝 (DELTA_RIGHT) 부터 좌측으로 시프트.
    STATS_DEF.forEach((stat, i) => {
      const y = STAT_Y0 + i * STAT_DY;
      const lblTxt = addText(scene, LABEL_X, y, stat.label, {
        fontFamily: HUD_FONT, fontSize: '17px', color: HX.textPrimary, fontStyle: '500',
      }).setOrigin(0, 0.5).setDepth(this._hudDepth + 2).setScrollFactor(0);
      lblTxt.setShadow(1, 1, '#000000', 2, false, true);
      // main — 라벨 옆 좌측 정렬 (그대로).
      const mainTxt = addText(scene, VAL_LX, y, '', {
        fontFamily: HUD_FONT, fontSize: '17px', color: STAT_COLOR_BASE, fontStyle: '700',
      }).setOrigin(0, 0.5).setDepth(this._hudDepth + 2).setScrollFactor(0);
      mainTxt.setShadow(1, 1, '#000000', 2, false, true);
      // [Phase P-44e] eq/cs — 우측 정렬, 폰트 13px (main 20px 보다 작게).
      const eqTxt = addText(scene, DELTA_RIGHT, y, '', {
        fontFamily: HUD_FONT, fontSize: '11px', color: STAT_COLOR_EQUIP, fontStyle: '700',
      }).setOrigin(1, 0.5).setDepth(this._hudDepth + 2).setScrollFactor(0);
      eqTxt.setShadow(1, 1, '#000000', 2, false, true);
      const csTxt = addText(scene, DELTA_RIGHT, y, '', {
        fontFamily: HUD_FONT, fontSize: '11px', color: STAT_COLOR_CS, fontStyle: '700',
      }).setOrigin(1, 0.5).setDepth(this._hudDepth + 2).setScrollFactor(0);
      csTxt.setShadow(1, 1, '#000000', 2, false, true);
      this._statTexts.push({ stat, mainTxt, eqTxt, csTxt, valLx: VAL_LX, deltaRight: DELTA_RIGHT });
      this._leftBottomEls.push(lblTxt, mainTxt, eqTxt, csTxt);
    });

    // === [Phase P-40] 시너지 영역 강화 (10 stat 아래) ===
    //   영역 1: 활성 죄 단계 라벨 (예: "🔥 분노 3 (3단계)" + 듀얼 마크).
    //   영역 2: 7대죄 카운터 (옛 그대로, 활성 죄 색 강조).
    //   stat 끝 = STAT_Y0 + 9 * STAT_DY = 313. 구분선 y=325 / 단계 라벨 y=340 / 카운터 y=370.
    const STAT_END_Y = STAT_Y0 + (STATS_DEF.length - 1) * STAT_DY;   // 313

    // [Phase P-40] 구분선 2: stat 영역 ↔ 시너지 영역.
    const synDivider = scene.add.graphics().setDepth(this._hudDepth).setScrollFactor(0);
    synDivider.lineStyle(1, COL.goldDark, 0.4);
    synDivider.lineBetween(STAT_X + 8, STAT_END_Y + 14, STAT_X + STAT_W - 8, STAT_END_Y + 14);
    this._leftBottomEls.push(synDivider);

    // [Phase P-40] 활성 죄 단계 라벨 — y=340, 좌측 정렬.
    const TIER_LBL_Y = STAT_END_Y + 28;
    this._synergyTierText = addText(scene, STAT_X + 12, TIER_LBL_Y, '', {
      fontFamily: HUD_FONT, fontSize: '15px', color: '#9A9AA2', fontStyle: '700',
    }).setOrigin(0, 0.5).setDepth(this._hudDepth + 2).setScrollFactor(0);
    this._synergyTierText.setShadow(1, 1, '#000000', 2, false, true);
    this._leftBottomEls.push(this._synergyTierText);

    // [Phase P-40] 듀얼 마크 — 우측 끝.
    this._synergyDualText = addText(scene, STAT_X + STAT_W - 12, TIER_LBL_Y, '', {
      fontFamily: HUD_FONT, fontSize: '14px', color: '#F87171', fontStyle: '700',
    }).setOrigin(1, 0.5).setDepth(this._hudDepth + 2).setScrollFactor(0);
    this._synergyDualText.setShadow(1, 1, '#000000', 2, false, true);
    this._leftBottomEls.push(this._synergyDualText);

    // 7대죄 카운터 줄 — y=370.
    const SYN_Y = STAT_END_Y + 58;
    const SYN_LEFT = 12, SYN_RIGHT = STAT_W - 4;
    const cellW = (SYN_RIGHT - SYN_LEFT) / SIN_LIST.length;
    this._synergyTexts = {};
    SIN_LIST.forEach((sin, i) => {
      const cx = SYN_LEFT + cellW * (i + 0.5);
      const txt = addText(scene, cx, SYN_Y, `${SIN_ICONS[sin]}0`, {
        fontFamily: HUD_FONT, fontSize: '14px', color: '#5A5A5F', fontStyle: '700',
      }).setOrigin(0.5, 0.5).setDepth(this._hudDepth + 2).setScrollFactor(0);
      txt.setShadow(1, 1, '#000000', 2, false, true);
      this._synergyTexts[sin] = txt;
      this._leftBottomEls.push(txt);
    });
    // 시너지 영역 클릭 → SynergyInfoModal — 단계 라벨 + 카운터 영역 모두 클릭.
    const synHit = scene.add.rectangle(
      STAT_X + STAT_W / 2, (TIER_LBL_Y + SYN_Y) / 2, STAT_W - 8, (SYN_Y - TIER_LBL_Y) + 22, 0x000000, 0.001
    ).setDepth(this._hudDepth + 3).setScrollFactor(0).setInteractive({ useHandCursor: true });
    synHit.on('pointerdown', (p, lx, ly, ev) => {
      if (ev) ev.stopPropagation();
      if (scene.showSynergyInfo) scene.showSynergyInfo();
    });
    this._leftBottomEls.push(synHit);
  }

  // 7대죄 카운트 + 활성/2번째 죄 시너지 갱신 (updateAll에서 호출)
  // 색 룰:
  //   활성 (1순위)        — SIN_COLORS 색 (밝게)
  //   2번째 (2순위)       — SIN_COLORS 약 65% 톤다운 (어둡게)
  //   그 외 카운트 > 0    — '#9A9AA2' (회색)
  //   카운트 0            — '#5A5A5F' (어두운 회색)
  // 듀얼 활성 시 — 활성/2번째 라벨에 굵게(800) 강조. (셀 폭 좁아 별 prefix 는 생략)
  updateSynergy(sinCounts, activeSin, secondarySin, dualActive) {
    if (!this._synergyTexts) return;
    SIN_LIST.forEach(sin => {
      const t = this._synergyTexts[sin];
      if (!t) return;
      const c = (sinCounts && sinCounts[sin]) || 0;
      t.setText(`${SIN_ICONS[sin]}${c}`);
      if (sin === activeSin) {
        t.setColor(SIN_COLORS[sin]);
      } else if (sin === secondarySin) {
        t.setColor(_dimHex(SIN_COLORS[sin], 0.65));
      } else {
        t.setColor(c > 0 ? '#9A9AA2' : '#5A5A5F');
      }
      // 듀얼 활성 — 활성/2번째 두 라벨만 굵게
      const isDualPair = !!(dualActive && (sin === activeSin || sin === secondarySin));
      if (t.style) t.style.fontStyle = isDualPair ? '800' : '700';
      t.dirty = true;
    });

    // [Phase P-40] 활성 죄 단계 라벨 갱신 (예: "🔥 분노 3 (3단계)").
    if (this._synergyTierText) {
      const player = this.scene && this.scene.player;
      const tier = (player && player.synergyTier) || 0;
      if (activeSin && tier > 0) {
        const sinIcon = SIN_ICONS[activeSin] || '';
        const sinName = SIN_NAMES[activeSin] || activeSin;
        const tierName = TIER_NAMES[tier] || `${tier}단계`;
        this._synergyTierText.setText(`${sinIcon} ${sinName} ${tier} (${tierName})`);
        this._synergyTierText.setColor(TIER_COLORS[tier] || SIN_COLORS[activeSin] || '#E8E8E8');
      } else {
        this._synergyTierText.setText('시너지 비활성');
        this._synergyTierText.setColor('#5A5A5F');
      }
    }
    // [Phase P-40] 듀얼 마크.
    if (this._synergyDualText) {
      this._synergyDualText.setText(dualActive ? '★ 듀얼' : '');
    }
  }

  // === 상단 가운데 — 스테이지/웨이브/남은적 ===
  // [Phase P-19] cx 480 → 640 (캔버스 1280 가운데).
  _buildStageText() {
    const cx = (this.scene.scale && this.scene.scale.width || 1280) / 2;
    this.stageText = addText(this.scene, cx, 20, '', {
      fontFamily: HUD_FONT, fontSize: '20px', color: HX.goldBright, fontStyle: '700',
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(this._hudDepth).setScrollFactor(0);
    this.stageText.setShadow(1, 1, '#000000', 2, false, true);
    // [Phase P-54] 스테이지 경과 시간 타이머 — stageText 바로 아래.
    this.stageTimerText = addText(this.scene, cx, 44, '', {
      fontFamily: HUD_FONT, fontSize: '13px', color: '#9A9AA2', fontStyle: '500',
    }).setOrigin(0.5, 0).setDepth(this._hudDepth).setScrollFactor(0);
    this.stageTimerText.setShadow(1, 1, '#000000', 2, false, true);
    // [Phase P-54] 챕터 디버프 표시 — 진행도 바 (y=72, h=3) 아래 배치 (겹침 방지).
    // 챕터 디버프 = 호박색 ⚠ (시험 디버프 BuffStrip 빨강 💀 과 톤 구분)
    this.stageDebuffText = addText(this.scene, cx, 82, '', {
      fontFamily: HUD_FONT, fontSize: '12px', color: '#FBBF24', fontStyle: '600',
    }).setOrigin(0.5, 0).setDepth(this._hudDepth).setScrollFactor(0);
    this.stageDebuffText.setShadow(1, 1, '#000000', 2, false, true);
    this.scene.events.on('update', this._updateStageTimer, this);
    this.scene.events.on('update', this._updateStageDebuff, this);
  }

  _updateStageDebuff() {
    if (!this.stageDebuffText) return;
    const ws = this.scene.waveSystem;
    if (!ws || !ws._currentStageDebuff) { this.stageDebuffText.setText(''); return; }
    const debuff = ws._currentStageDebuff();
    if (!debuff || !debuff.desc) { this.stageDebuffText.setText(''); return; }
    this.stageDebuffText.setText(`⚠ ${debuff.desc}`);
  }

  _updateStageTimer(time, delta) {
    if (!this.stageTimerText) return;
    const sc = this.scene;
    if (sc._stageElapsedMs == null) { this.stageTimerText.setText(''); return; }
    // 일시정지/카드선택/이벤트모달/보스인트로/게임오버 시 누적 정지 (GameScene.update 가드와 동일).
    const paused = sc.cardSelectionActive || sc.gameOverActive || sc.pauseMenuActive
                 || sc.bossIntroActive   || sc.eventModalActive;
    if (!paused && typeof delta === 'number') sc._stageElapsedMs += delta;
    const sec = Math.floor(sc._stageElapsedMs / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    this.stageTimerText.setText(`⏱ ${m}:${String(s).padStart(2, '0')}`);
  }

  // === 콤보 배지 — 화면 가운데 위 (640, 80). 평소 invisible. ===
  // [Phase P-19] cx 480 → 640 (캔버스 1280 가운데).
  // [Phase P-19+] y 50 → 80 — stageText (y=20, 폰트 20px, 아랫변 ~40) 와 분리 (간격 60).
  //   옛 50 은 P-3 글로벌 폰트 +25% 후 stageText 두께 + comboBadge 22px 가 7px 겹침 발생.
  _buildComboBadge() {
    const scene = this.scene;
    const cx = (scene.scale && scene.scale.width || 1280) / 2;
    const c = scene.add.container(cx, 80).setDepth(12).setScrollFactor(0);
    c.setVisible(false);
    c.setAlpha(0);
    c.setScale(0.8);

    const bg = scene.add.graphics();
    const txt = addText(scene, 0, 0, '', {
      fontFamily: HUD_FONT, fontSize: '22px', color: '#FFFFFF', fontStyle: '700',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5).setScrollFactor(0);
    txt.setShadow(0, 0, '#000000', 4, false, true);
    c.add([bg, txt]);

    this.comboBadge = { container: c, bg, txt, lastCount: 0 };
  }

  // === 우상단 아이콘바 ===
  // [Phase P-54] 🃏 보유 카드 아이콘 제거 — 우측 세로 띠 (PickedCardsStrip) 가 항상 표시.
  _buildIconBar() {
    const scene = this.scene;
    this._iconDefs = [
      { id: 'equip',     icon: '⚔',  label: '장비',     cb: 'onShowEquip', requiresEquipUnlock: true },
      { id: 'menu',      icon: '☰',  label: '메뉴',     cb: 'onShowMenu' },
    ];
    // 시각 40×36 그대로 / 터치 hit 영역 44×44 (모바일 fat finger 안전).
    const ICON_W = 40, ICON_H = 36, ICON_HIT = 44, ICON_GAP = 8, ICON_CY = 25;
    this._items = [];

    // 2개 × 40 + 1 × 6 = 86. 좌측 시작 = 1260 - 86.
    const canvasW = (scene.scale && scene.scale.width) || 1280;
    const TOTAL_W = this._iconDefs.length * ICON_W + (this._iconDefs.length - 1) * ICON_GAP;
    const ICON_FIRST_CX = canvasW - 20 - TOTAL_W + ICON_W / 2;
    this._iconDefs.forEach((def, idx) => {
      const cx = ICON_FIRST_CX + idx * (ICON_W + ICON_GAP);
      const cy = ICON_CY;
      const locked = !!def.requiresEquipUnlock && !isEquipmentUnlocked();

      const g = scene.add.graphics().setDepth(ICON_BAR_DEPTH).setScrollFactor(0);
      const draw = (a) => {
        g.clear();
        g.fillStyle(0x000000, a);
        g.fillRoundedRect(cx - ICON_W / 2, cy - ICON_H / 2, ICON_W, ICON_H, 4);
        if (locked) {
          g.lineStyle(1, 0x6A6A72, 0.5);
          g.strokeRoundedRect(cx - ICON_W / 2, cy - ICON_H / 2, ICON_W, ICON_H, 4);
        }
      };
      draw(0.35);

      const iconColor = locked ? '#6A6A72' : HX.goldBright;
      const iconTxt = addText(scene, cx, cy, def.icon, {
        fontFamily: HUD_FONT, fontSize: '25px', color: iconColor, fontStyle: '700',
      }).setOrigin(0.5).setDepth(ICON_BAR_DEPTH + 2).setScrollFactor(0);
      iconTxt.setShadow(1, 1, '#000000', 2, false, true);
      if (locked) iconTxt.setAlpha(0.5);

      const hit = scene.add.rectangle(cx, cy, ICON_HIT, ICON_HIT, 0x000000, 0.001)
        .setDepth(ICON_BAR_DEPTH + 1).setScrollFactor(0).setInteractive({ useHandCursor: true });

      bindHover(hit, () => draw(locked ? 0.4 : 0.5), () => draw(0.35));
      hit.on('pointerdown', (p, lx, ly, ev) => {
        if (ev) ev.stopPropagation();
        if (locked) {
          if (scene.events && scene.events.emit) scene.events.emit('toast', '🔒 2챕터 도달 시 활성');
          return;
        }
        const fn = this.callbacks[def.cb];
        if (typeof fn === 'function') fn();
      });

      this._items.push({ id: def.id, cx, cy, baseIcon: def.icon, g, draw, iconTxt, hit, locked });
    });
  }

  // === 잠금 상태 갱신 — chapterClearCount 변경 시 호출 가능 ===
  refreshLockStates() {
    if (!this._items) return;
    this._items.forEach(it => {
      if (it.id !== 'equip') return;
      const newLocked = !isEquipmentUnlocked();
      if (newLocked === it.locked) return;
      it.locked = newLocked;
      if (it.iconTxt) {
        it.iconTxt.setColor(newLocked ? '#6A6A72' : HX.goldBright);
        it.iconTxt.setAlpha(newLocked ? 0.5 : 1);
      }
      if (it.draw) it.draw(0.35);
    });
  }

  // === 진행바 헬퍼 ===
  _makeProgressBar(cx, cy, w, h, fillColor, borderColor) {
    const scene = this.scene;
    const D = this._hudDepth || 10;
    const bg = scene.add.rectangle(cx, cy, w, h, COL.bgDark, 0.85).setDepth(D + 1).setScrollFactor(0);
    bg.setStrokeStyle(1, COL.borderLight, 1);
    const fill = scene.add.rectangle(cx - w / 2 + 2, cy, w - 4, h - 4, fillColor, 1).setDepth(D + 1).setScrollFactor(0);
    fill.setOrigin(0, 0.5).setScrollFactor(0); fill.scaleX = 1;
    const fillHL = scene.add.rectangle(cx - w / 2 + 2, cy - 2, w - 4, (h - 4) / 2, 0xFFFFFF, 0.22).setDepth(D + 2).setScrollFactor(0);
    fillHL.setOrigin(0, 0.5).setScrollFactor(0); fillHL.scaleX = 1;
    const dots = [];
    for (let dx = 4; dx < w - 4; dx += 6) {
      const dot = scene.add.rectangle(cx - w / 2 + dx, cy - 2, 1, 1, 0xFFFFFF, 0.45).setDepth(D + 3).setScrollFactor(0);
      dot.setVisible(false);
      dots.push(dot);
    }
    const endGlowOuter = scene.add.circle(cx - w / 2 + 2, cy, 8, fillColor, 0).setDepth(D + 2).setScrollFactor(0);
    const endGlowMid = scene.add.circle(cx - w / 2 + 2, cy, 5, fillColor, 0).setDepth(D + 2).setScrollFactor(0);
    const endGlowCore = scene.add.rectangle(cx - w / 2 + 2, cy, 2, h - 4, 0xFFFFFF, 0).setDepth(D + 3).setScrollFactor(0);
    scene.tweens.add({
      targets: [endGlowOuter, endGlowMid],
      alpha: { from: 0.55, to: 0.25 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    scene.add.rectangle(cx, cy - h / 2 + 1.5, w - 2, 1, 0xFFFFFF, 0.22).setDepth(D + 3).setScrollFactor(0);
    const txt = addText(scene, cx, cy, '', {
      fontFamily: HUD_FONT, fontSize: '19px', color: '#FFFFFF', fontStyle: '700',
    }).setOrigin(0.5).setDepth(D + 4).setScrollFactor(0);
    txt.setShadow(1, 1, '#000000', 2, false, true);
    return { bg, fill, fillHL, txt, dots, endGlowOuter, endGlowMid, endGlowCore, cx, cy, w, h, _ratio: 0 };
  }

  _setProgressBar(bar, ratio, label) {
    const scene = this.scene;
    const r = Math.max(0, Math.min(1, ratio));
    const innerW = bar.w - 4;
    if (Math.abs((bar._ratio ?? -1) - r) > 0.0005) {
      if (scene.tweens) {
        scene.tweens.killTweensOf([bar.fill, bar.fillHL]);
        scene.tweens.add({
          targets: [bar.fill, bar.fillHL], scaleX: r,
          duration: 250, ease: 'Sine.easeOut',
          onUpdate: () => {
            const fillW = innerW * bar.fill.scaleX;
            const endX = bar.cx - bar.w / 2 + 2 + fillW;
            bar.endGlowOuter.x = endX;
            bar.endGlowMid.x = endX;
            bar.endGlowCore.x = endX;
            const fillEdge = bar.cx - bar.w / 2 + fillW;
            bar.dots.forEach(d => d.setVisible(d.x < fillEdge - 1));
          },
        });
      } else {
        bar.fill.scaleX = r; bar.fillHL.scaleX = r;
      }
    }
    const visible = r > 0.02;
    bar.endGlowOuter.setAlpha(visible ? 0.5 : 0);
    bar.endGlowMid.setAlpha(visible ? 0.55 : 0);
    bar.endGlowCore.setAlpha(visible ? 0.85 : 0);
    bar.txt.setText(label);
    bar._ratio = r;
  }

  // 미니 패널 시스템 (옛 _toggleMini / _renderBagBody / _renderEquipBody /
  // _renderMenuBody / _closeMini) 은 Phase D 에서 제거됨 — 5 아이콘 즉시 콜백.

  // === 통합 갱신 ===
  // data = { stats, stageInfo, combo, counts }
  updateAll(data) {
    if (!data) return;
    if (data.stats)     this._updateStats(data.stats);
    if (data.stageInfo) this._updateStageText(data.stageInfo);
    // [무한 맵] 옛 상단 combo 배지 호출 폐기 — ComboFloat (플레이어 위) 로 이전.
    if (data.counts)    this.updateCounts(data.counts);
    if (data.synergy)   this.updateSynergy(
      data.synergy.counts,
      data.synergy.active,
      data.synergy.secondary,
      data.synergy.dualActive,
    );
  }

  _updateStats(s) {
    const player = this.scene && this.scene.player;
    if (this.lvText)   this.lvText.setText(`Lv.${s.level}`);
    // [Phase P-29] hpBar 제거 — 캐릭터 위 HP 바 (Player.updateHpDisplay) 가 담당.
    //   maxHp 는 stat 박스 안 HP row 에서 표시 (STATS_DEF[0]).
    if (this.expBar)   {
      this._setProgressBar(this.expBar, s.exp / s.expToNext, '');
      if (this.expValText) this.expValText.setText(`${s.exp}/${s.expToNext}`);
    }
    if (this.goldText) this.goldText.setText(`${s.gold || 0}`);

    // Phase E6 — source 분리 표시 (main: base / eq: equipment / cs: cards+synergy)
    // [Phase P-44e] main 좌측 정렬 (VAL_LX) + eq/cs 우측 정렬 (DELTA_RIGHT 부터 좌측 시프트).
    //   cursor 우→좌: cs 먼저 DELTA_RIGHT, eq cs 좌측 - cs.width - 4.
    if (this._statTexts && player) {
      this._statTexts.forEach(({ stat, mainTxt, eqTxt, csTxt, valLx, deltaRight }) => {
        const b = player.getStatBreakdown(stat.name);
        // 부동소수점 누적 오차 보정 (예: 0.05+0.10+0.20 = 0.34999...) — 4자리 반올림 후 표시.
        const round4 = (v) => Math.round(v * 10000) / 10000;
        const eqDelta = round4(b.equipment || 0);
        const csDelta = round4((b.cards || 0) + (b.synergy || 0));
        // [무한 맵] main = 합산 final 값. 빨강(+장비) / 파랑(+카드/시너지) 부가 표시 유지.
        const total = round4((b.base || 0) + eqDelta + csDelta);
        mainTxt.setText(stat.fmtMain(total));
        mainTxt.setX(valLx);

        let rightCursor = deltaRight;
        if (csDelta !== 0) {
          csTxt.setText(`(${stat.fmtDelta(csDelta)})`);
          csTxt.setVisible(true);
          csTxt.setX(rightCursor);
          rightCursor -= (csTxt.width || 0) + 4;
        } else {
          csTxt.setText('');
          csTxt.setVisible(false);
        }
        if (eqDelta !== 0) {
          eqTxt.setText(`(${stat.fmtDelta(eqDelta)})`);
          eqTxt.setVisible(true);
          eqTxt.setX(rightCursor);
        } else {
          eqTxt.setText('');
          eqTxt.setVisible(false);
        }
      });
    }
  }

  _updateStageText(info) {
    if (!this.stageText) return;
    // [Phase P-50b] "웨이브 N/10" 표기 제거 — "스테이지 N · 남은 적 M" 만 표시.
    //   보스/서브보스 등장 시 라벨만 prefix 로 표시.
    let prefix = '';
    if (info.isBossWave)          prefix = `[보스: ${info.bossName || '???'}] `;
    else if (info.isEliteBossWave) prefix = `[정예: ${info.bossName || '???'}] `;
    else if (info.isSubBossWave)  prefix = `[서브보스: ${info.bossName || '???'}] `;
    const text = `${prefix}스테이지 ${info.stage}  ·  남은 적 ${info.aliveEnemies}`;
    this.stageText.setText(text);
    this.stageText.setColor(HX.goldBright);
  }

  _updateCombo(combo) {
    // [무한 맵] 옛 상단 콤보 배지 비활성화 — 진행도 바와 위치 겹침. ComboFloat (플레이어 위) 로 이전.
    return;
    /* eslint-disable no-unreachable */
    if (!this.comboBadge) return;
    const scene = this.scene;
    const { container, bg, txt } = this.comboBadge;

    if (combo.active) {
      const newText = `🔴 콤보 ×${combo.count} · ${combo.remainingSec}s`;
      txt.setText(newText);

      // 배경 자동 사이즈 (텍스트 측정 후 padding 적용)
      const padX = 12, padY = 6;
      const w = txt.width + padX * 2;
      const h = txt.height + padY * 2;
      bg.clear();
      bg.fillStyle(0x991B1B, 0.7);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
      bg.lineStyle(1, 0xC5A059, 0.5);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);

      // 처음 활성화 → 등장 트윈
      if (!container.visible) {
        container.setVisible(true);
        scene.tweens.killTweensOf(container);
        scene.tweens.add({
          targets: container, alpha: 1, scaleX: 1, scaleY: 1,
          duration: 200, ease: 'Back.easeOut',
        });
      }

      // 카운트 증가 → 펄스 효과
      if (combo.count > this.comboBadge.lastCount && container.visible) {
        scene.tweens.add({
          targets: container,
          scaleX: { from: 1.15, to: 1 }, scaleY: { from: 1.15, to: 1 },
          duration: 150, ease: 'Sine.easeOut',
        });
      }
      this.comboBadge.lastCount = combo.count;
    } else {
      // 비활성화 → 페이드아웃
      if (container.visible) {
        scene.tweens.killTweensOf(container);
        scene.tweens.add({
          targets: container, alpha: 0, scaleX: 0.8, scaleY: 0.8,
          duration: 200, ease: 'Sine.easeIn',
          onComplete: () => container.setVisible(false),
        });
        this.comboBadge.lastCount = 0;
      }
    }
  }

  // 카운트 갱신 (speed 만 텍스트 동기화)
  updateCounts(counts) {
    if (!counts || !this._items) return;
    if (counts.speed != null) {
      const speedItem = this._items.find(it => it.id === 'speed');
      if (speedItem && speedItem.iconTxt) {
        speedItem.iconTxt.setText(`${speedItem.baseIcon}${counts.speed}`);
      }
    }
  }

  destroy() {
    // scene.events.on 으로 등록한 update 리스너 해제 (scene 재시작 시 잔존 leak 방지).
    if (this.scene && this.scene.events) {
      if (this._updateStageTimer) this.scene.events.off('update', this._updateStageTimer, this);
      if (this._updateStageDebuff) this.scene.events.off('update', this._updateStageDebuff, this);
    }
    if (this._items) {
      this._items.forEach(it => {
        if (it.g && it.g.destroy) it.g.destroy();
        if (it.iconTxt && it.iconTxt.destroy) it.iconTxt.destroy();
        if (it.hit && it.hit.destroy) it.hit.destroy();
      });
      this._items = null;
    }
    if (this._leftTopEls)    this._leftTopEls.forEach(e => e && e.destroy && e.destroy());
    if (this._leftBottomEls) this._leftBottomEls.forEach(e => e && e.destroy && e.destroy());
    if (this.stageText && this.stageText.destroy)   this.stageText.destroy();
    if (this.comboBadge && this.comboBadge.container && this.comboBadge.container.destroy) {
      this.comboBadge.container.destroy();
    }
  }
}

export default TopBar;
