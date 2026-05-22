// 시작 메뉴 — Abyss Loop 패널 디자인
// HTML 레퍼런스: radial 배경 + 글래스 패널 + 그라디언트 타이틀 + 움직이는 별
//
// ⚠️ 메뉴 항목 호버 효과 작성 시 주의:
// - 호버 시 setStyle() 절대 사용 금지 (Phaser 4 에서 letterSpacing/fontFamily 손실 → 폰트 깨짐)
// - 색상 변경은 _setMenuColor(target, color) 헬퍼만 사용 (setColor + letterSpacing 재확인)
// - 새 메뉴 항목 추가 시 makeMenuItem() 또는 _addMenuItem() 통해 생성
// - 직접 add.text() + 호버 핸들러 작성 시 절대 setStyle 사용 X

import Phaser from 'phaser';
import { hasSave, loadGame, clearSave } from '../data/save.js';
import { gameSettings, saveSettings } from '../data/settings.js';
import { FONT, FONT_DISP } from '../ui/theme.js';
import { sound } from '../systems/SoundManager.js';
import { getDiamonds } from '../data/meta/diamonds.js';
import { showUpgradeShop } from '../ui/modals/UpgradeShopModal.js';
import { applyNearestToPixelTextures } from '../data/spriteOptions.js';
import { attachTouchFeedback } from '../ui/touchFeedback.js';

// === 공식 팔레트 — False Hero (4색만, 명도만 조절) ===
//   Iron Grey #2C2F33 / Old Gold #C5A059 / Deep Crimson #8B0000 / Ivory #E8E6E1
const A = {
  // 배경/어두운 UI — Iron Grey 명도 조절
  bgInner:    0x1A1C1F,    // Iron Grey -25%
  bgOuter:    0x0E1012,    // 가장 깊은 그레이
  panel:      0x2C2F33,    // Iron Grey 본체
  panelStr:   0x4A4D52,    // Iron Grey +20%
  btn:        0x2C2F33,    // Iron Grey
  btnBorder:  0x4A4D52,
  btnHov:     0x3D4045,    // Iron Grey +12%
  btnHovBdr:  0xC5A059,    // Old Gold (호버 강조)
  diffActive: 0x8B0000,    // Deep Crimson
  // 텍스트 — Ivory
  text:       '#A8A6A0',   // Ivory -25%
  textHi:     '#E8E6E1',   // Ivory
  // 액센트 — Old Gold
  accent:     '#C5A059',
  glow:       '#8B7340',   // Old Gold -20% (글로우 베이스)
  glowBright: '#E0BD75',   // Old Gold +15%
  crimson:    '#8B0000',
  dim:        '#76746F',   // Ivory -45%
  mute:       '#4A4845',
};

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  preload() {
    this.load.image('background', 'sprites/screens/main-menu.png');
    // 강화 상점 UI 배경 (Phase P-55).
    this.load.image('ui-upgrade-equipment', 'sprites/screens/upgrade-equipment.png');
    this.load.image('ui-challenges', 'sprites/screens/challenges.png');
    // 인라인 아이콘 — 💎 / 🪙 이모지 대체 (게임 톤 통일).
    this.load.image('icon-diamond', 'sprites/icons/diamond-icon.png');
    this.load.image('icon-gold',    'sprites/icons/gold-icon.png');
  }

  create() {
    // [Phase P-2] sprite 텍스처 NEAREST 필터 적용 (도트 모양 보존)
    applyNearestToPixelTextures(this);
    const W = this.scale.width, H = this.scale.height;   // 16:9 가로 모드

    // 씬 인스턴스 재사용 시 이전 참조가 살아남아 가드를 잘못 트리거하므로 리셋
    this._devUnlocked = false;
    this._moonClicks = 0;
    this._menuLayer = [];

    // (비활성) 코드 백드롭 — background.png 가 모든 분위기 처리
    // this.buildAbyssCliffBackground(W, H);

    // === BGM — 메뉴 테마 (음원 파일 누락 시 silent) ===
    sound.playBgm(this, 'menu_theme');

    // === 배경 PNG (달 + 마왕성 + 구름 + 빛줄기 통합) ===
    // [등장 연출] 처음엔 alpha 0 (검정에서 떠오름) + 아주 느린 켄번즈 줌(살아있는 배경)
    const bgImg = this.add.image(W * 0.5, H * 0.5, 'background')
      .setOrigin(0.5, 0.5)
      .setDepth(-10)
      .setAlpha(0);
    bgImg.setDisplaySize(W, H);
    // setDisplaySize 가 만든 scale 을 base 로 잡고, 항상 ≥ base*1.04 로 유지해 가장자리 빈틈 방지.
    const bgBaseSX = bgImg.scaleX * 1.04, bgBaseSY = bgImg.scaleY * 1.04;
    bgImg.setScale(bgBaseSX, bgBaseSY);
    this.tweens.add({
      targets: bgImg, scaleX: bgBaseSX * 1.06, scaleY: bgBaseSY * 1.06,
      duration: 20000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });


    // === 타이틀 — 가운데 상단 (Phase P-7: 좌측→가운데, 모바일 가로 letterbox 대응) ===
    const titleX = W * 0.5, titleY = H * 0.10;
    const TITLE_FS = 84;   // 모바일 가독성 위해 68 → 84
    // 다크 판타지 세리프 스택 (Hollow Knight / Blasphemous 톤)
    const TITLE_FONT = '"Cinzel", "Trajan Pro", "IM Fell English SC", "Times New Roman", serif';
    const titleStyle = { fontFamily: TITLE_FONT, fontSize: `${TITLE_FS}px`, fontStyle: '500' };

    // [Phase P-7] 가운데 정렬로 변경하면서 좌상단 backdrop 제거 (이제 비주얼 X)

    // 본체 — 단색 차분한 흰빛 회색 + 1px 부드러운 외곽선 (가운데 정렬)
    this._titleText = this.add.text(titleX, titleY, 'FALSE HERO', {
      ...titleStyle,
      color: '#B8B8C0',
      stroke: '#1A1A1F',
      strokeThickness: 1,
      letterSpacing: 7,
    }).setOrigin(0.5, 0.5);

    // 글리치 — 'FALSE' Crimson 색수차 (가운데 정렬 시 'FALSE HERO' 의 'FALSE' 부분과 정확히 겹치진 X
    //   → 단순 가운데 텍스트로 색수차만 발현. 캐릭터성 유지)
    const falseGlitchL = this.add.text(titleX, titleY, 'FALSE HERO', {
      ...titleStyle, color: '#8B0000', letterSpacing: 7,
    }).setOrigin(0.5, 0.5).setAlpha(0).setDepth(-1);
    const falseGlitchR = this.add.text(titleX, titleY, 'FALSE HERO', {
      ...titleStyle, color: '#8B0000', letterSpacing: 7,
    }).setOrigin(0.5, 0.5).setAlpha(0).setDepth(-1);
    const fireGlitch = () => {
      falseGlitchL.setPosition(titleX - 2, titleY);
      falseGlitchR.setPosition(titleX + 2, titleY);
      this.tweens.add({
        targets: [falseGlitchL, falseGlitchR], alpha: { from: 0.35, to: 0 },
        duration: 130, ease: 'Cubic.easeOut',
      });
      this.time.delayedCall(1500 + Phaser.Math.Between(-200, 200), fireGlitch);
    };
    // ⚠ 즉시 트리거 X — 등장 연출(_playMenuEntrance) 완료 후 시작 (타이틀 안착 뒤).

    // 부제 — 로고 바로 아래, 같은 톤 (가운데 정렬)
    this._subTitleText = this.add.text(titleX, titleY + TITLE_FS * 0.7, 'A FAKE HERO\'S TALE', {
      fontFamily: TITLE_FONT, fontSize: '25px', color: '#8A7A5A', fontStyle: '500', letterSpacing: 6,
    }).setOrigin(0.5, 0.5);

    // === 메뉴 — 가운데 정렬 (Phase P-7: 좌측 4%→가운데) ===
    this._menuX = W * 0.5;
    this._menuY0 = H * 0.32;
    this._menuStep = Math.round(H * 0.07);
    this._menuLayer = [];
    this._devUnlocked = !!this._readDevUnlock();
    this._devTriggerAnim = false;     // 첫 진입엔 페이드인 X. 토글 ON 시에만 true 로 세팅 후 1회 사용
    this._devFeatureTexts = [];
    this._buildMenuLayer();

    // === 좌상단 ⚙ 환경 설정 아이콘 ===
    this._gearTxt = this.add.text(30, 32, '⚙', {
      fontFamily: FONT, fontSize: '34px', color: '#A8842E', fontStyle: '800',
    }).setOrigin(0.5).setDepth(900);
    this._gearTxt.setShadow(0, 1, '#000000', 4, false, true);
    const gearHit = this.add.zone(30, 32, 48, 48).setOrigin(0.5)
      .setInteractive({ useHandCursor: true }).setDepth(900);
    // [P-59 2차] 호버 제거 — 탭 누름 시 강조 + 떼면 액션.
    const gearRevert = () => {
      this._setMenuColor(this._gearTxt, '#A8842E', 0);
      this.tweens.killTweensOf(this._gearTxt);
      this.tweens.add({ targets: this._gearTxt, scale: 1, angle: 0, duration: 280, ease: 'Sine.easeIn' });
    };
    gearHit.on('pointerdown', () => {
      this._setMenuColor(this._gearTxt, '#FDE9A8', 0);
      this.tweens.killTweensOf(this._gearTxt);
      this.tweens.add({ targets: this._gearTxt, scale: 1.15, angle: 60, duration: 280, ease: 'Sine.easeOut' });
    });
    gearHit.on('pointerup',        () => { gearRevert(); this.scene.start('SettingsScene'); });
    gearHit.on('pointerupoutside', gearRevert);

    // 다이아 잔액 — 우상단 (픽셀 아이콘 + 숫자).
    this._diamondTxt = this.add.text(W - 18, 32, `${getDiamonds().toLocaleString()}`, {
      fontFamily: FONT, fontSize: '25px', color: '#FFD166', fontStyle: '700',
    }).setOrigin(1, 0.5).setDepth(900);
    this._diamondTxt.setShadow(0, 1, '#000000', 4, false, true);
    this._diamondIcon = this.add.image(W - 18 - this._diamondTxt.width - 8, 32, 'icon-diamond')
      .setDisplaySize(72, 44).setOrigin(1, 0.5).setDepth(900).setTint(0xFFD166);
    // DEV 토글 등으로 잔액 변동 시 즉시 갱신.
    this._refreshDiamond = () => {
      if (!this._diamondTxt || !this._diamondTxt.scene) return;
      this._diamondTxt.setText(`${getDiamonds().toLocaleString()}`);
      if (this._diamondIcon) this._diamondIcon.setX(W - 18 - this._diamondTxt.width - 8);
    };

    // 푸터 — 우측 하단 구석, 읽을 수 있을 정도
    const versionTxt = this.add.text(W * 0.97, H * 0.97, 'v0.1', {
      fontFamily: FONT, fontSize: '16px', color: '#9A9AA2', letterSpacing: 1,
    }).setOrigin(1, 1);

    // === 픽셀 스캔라인 — 매우 옅은 가로줄 (CRT 레트로) ===
    const scanG = this.add.graphics().setDepth(8000).setScrollFactor(0);
    scanG.fillStyle(0x000000, 0.06);
    for (let yy = 0; yy < H; yy += 3) scanG.fillRect(0, yy, W, 1);

    attachTouchFeedback(this);

    // === 첫 진입 등장 연출 — 정통 스태거드 reveal ===
    //   배경 떠오름 → 타이틀 스르륵 상승 → 부제 → 메뉴 한 줄씩 → 구석 UI →
    //   (완료 후) 글리치/먼지/별 등 분위기 효과 시작. 클릭 동작·레이아웃은 그대로.
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this._playMenuEntrance({ bgImg, versionTxt, scanG, fireGlitch });

    // [Phase P-9] 풀스크린 / 회전 자동화 모두 제거 — 사용자 자율.
    //   브라우저: 사용자가 가로로 돌리면 캔버스가 화면에 맞춰 자동 확대 (Phaser scale FIT).
    //   APK: capacitor.config.json orientation: landscape 가 OS 레벨 가로 강제 (보존).
  }

  // === 첫 진입 등장 연출 — 정통 스태거드 reveal ===
  //   배경(페이드+켄번즈) → 타이틀(상승) → 부제 → 메뉴(한 줄씩) → 구석 UI →
  //   완료 후 분위기 효과(글리치/먼지/별/로고 떨림) 시작 → "정적 → 살아남" 흐름.
  //   ⚠ alpha/y 만 일시 조정하고 최종값으로 복귀 — 클릭/호버/레이아웃 로직 불변.
  _playMenuEntrance({ bgImg, versionTxt, scanG, fireGlitch }) {
    const tw = (cfg) => this.tweens.add(cfg);

    // 1) 배경 — 검정에서 부드럽게 떠오름
    tw({ targets: bgImg, alpha: 1, duration: 1000, ease: 'Sine.easeOut' });

    // 2) 타이틀 — 살짝 아래에서 스르륵 상승 + 페이드
    if (this._titleText) {
      const ty = this._titleText.y;
      this._titleText.setAlpha(0).setY(ty + 20);
      tw({ targets: this._titleText, alpha: 1, y: ty, duration: 850, delay: 450, ease: 'Cubic.easeOut' });
    }
    // 3) 부제 — 타이틀 뒤따라 페이드 + 살짝 상승
    if (this._subTitleText) {
      const sy = this._subTitleText.y;
      this._subTitleText.setAlpha(0).setY(sy + 12);
      tw({ targets: this._subTitleText, alpha: 1, y: sy, duration: 700, delay: 820, ease: 'Sine.easeOut' });
    }

    // 4) 메뉴 — 한 줄씩 아래에서 위로 (캐스케이드). 마커(alpha 0)는 건드리지 않음.
    const menuTexts = (this._menuLayer || []).filter(
      go => go instanceof Phaser.GameObjects.Text && go.alpha > 0.01
    );
    const MENU_BASE_DELAY = 1150, MENU_STAGGER = 110;
    menuTexts.forEach((t, i) => {
      const finalAlpha = t.alpha;   // 항목별 기본 alpha 보존 (보통 1, DEV 목록 0.8)
      const my = t.y;
      t.setAlpha(0).setY(my + 16);
      tw({
        targets: t, alpha: finalAlpha, y: my,
        duration: 520, delay: MENU_BASE_DELAY + i * MENU_STAGGER, ease: 'Cubic.easeOut',
      });
    });

    // 5) 구석 UI (⚙ / 💎 / 버전 / 스캔라인) — 가장 늦게 은은하게
    const cornerDelay = MENU_BASE_DELAY + menuTexts.length * MENU_STAGGER + 120;
    [this._gearTxt, this._diamondTxt, this._diamondIcon, versionTxt, scanG]
      .filter(Boolean)
      .forEach(go => {
        const a = go.alpha;
        go.setAlpha(0);
        tw({ targets: go, alpha: a, duration: 600, delay: cornerDelay, ease: 'Sine.easeOut' });
      });

    // 6) 등장 완료 후 — 분위기 효과 시작 (정적 → 살아남)
    const ambientDelay = cornerDelay + 500;
    this.time.delayedCall(ambientDelay, () => {
      if (!this.sys || !this.sys.isActive()) return;
      this._setupBackgroundFX();
      if (typeof fireGlitch === 'function') fireGlitch();
    });
  }

  // === 개발자 모드 잠금 / 노출 ===
  _readDevUnlock() {
    try {
      // 구 키 마이그레이션
      const old = localStorage.getItem('first-game-dev-unlocked');
      if (old === '1' && !localStorage.getItem('false-hero-dev-unlocked')) {
        localStorage.setItem('false-hero-dev-unlocked', '1');
      }
      return localStorage.getItem('false-hero-dev-unlocked') === '1';
    }
    catch { return false; }
  }

  _writeDevUnlock() {
    try { localStorage.setItem('false-hero-dev-unlocked', '1'); }
    catch {}
  }

  _showDevButton() {
    // DEV 항목 포함하여 메뉴 재빌드
    this._clearMenuLayer();
    this._buildMenuLayer();
  }

  // === 메뉴 레이어 — 동적 재빌드 가능 (난이도 변경 시 검정 fade 없이 즉시 갱신) ===
  _clearMenuLayer() {
    if (!this._menuLayer) return;
    this._menuLayer.forEach(go => { if (go && go.destroy) go.destroy(); });
    this._menuLayer = [];
  }

  _buildMenuLayer() {
    // 난이도 선택은 스테이지 화면으로 이동 — 메인 메뉴에서 제거
    let i = 0;
    if (hasSave()) {
      const saved = loadGame();
      this._addMenuItem(this._menuY0 + this._menuStep * i++,
        `이어하기 — STAGE ${saved.stage}/10`,
        () => this.scene.start('StageScene', { newGame: false }));
      this._addMenuItem(this._menuY0 + this._menuStep * i++, '새 게임', () => {
        console.log('[newGame] clicked — clearSave + StageScene fresh');
        clearSave();
        this.scene.start('StageScene', { newGame: true });
      });
      this._addMenuItem(this._menuY0 + this._menuStep * i++, '도전 과제',
        () => this.scene.start('ChallengeScene'));
      this._addMenuItem(this._menuY0 + this._menuStep * i++, '강화 상점',
        () => this._openUpgradeShop());
    } else {
      this._addMenuItem(this._menuY0 + this._menuStep * i++, '게임 시작',
        () => this.scene.start('StageScene', { newGame: true }));
      this._addMenuItem(this._menuY0 + this._menuStep * i++, '도전 과제',
        () => this.scene.start('ChallengeScene'));
      this._addMenuItem(this._menuY0 + this._menuStep * i++, '강화 상점',
        () => this._openUpgradeShop());
    }
    if (this._devUnlocked) {
      const isOn = !!gameSettings.testMode;
      const label = isOn ? 'DEV MODE ●' : 'DEV MODE';
      const devY = this._menuY0 + this._menuStep * i++;
      this._addMenuItem(devY, label, () => {
        if (gameSettings.testMode) {
          const features = this._devFeatureTexts || [];
          if (features.length) {
            this.tweens.add({
              targets: features, alpha: 0,
              duration: 150, ease: 'Sine.easeIn',
            });
          }
          this.time.delayedCall(features.length ? 160 : 0, () => {
            gameSettings.testMode = false;
            saveSettings();
            this._devTriggerAnim = false;
            this._clearMenuLayer();
            this._buildMenuLayer();
            this._refreshDiamond();
          });
        } else {
          gameSettings.testMode = true;
          saveSettings();
          this._devTriggerAnim = true;
          this._clearMenuLayer();
          this._buildMenuLayer();
          this._refreshDiamond();
        }
      }, { devActive: isOn });

      // === DEV MODE 활성 시 활성 기능 목록 표시 — 메뉴 항목 아래 (옛 위치 유지) ===
      this._devFeatureTexts = [];
      if (isOn) {
        const lines = [
          '· 골드 무제한 + 구매 차감 X',
          '· 다이아 무제한 + 차감 X',
          '· 모든 챕터 / 스테이지 해금',
          '· 장비 1챕터 잠금 해제',
          '· 카드 / 상점 리롤 무제한',
          '· 다이아 상점 구매 초기화 버튼',
        ];
        const featX = this._menuX + 30;
        const featStartY = devY + 30;
        const featStep = 26;
        lines.forEach((line, idx) => {
          const t = this.add.text(featX, featStartY + idx * featStep, line, {
            fontFamily: FONT, fontSize: '21px',
            color: '#8A7A5A', fontStyle: '500', letterSpacing: 2,
          }).setOrigin(0, 0.5);
          t.setShadow(0, 1, '#000000', 3, false, true);
          this._devFeatureTexts.push(t);
          this._menuLayer.push(t);
          if (this._devTriggerAnim) {
            t.setAlpha(0);
            this.tweens.add({
              targets: t, alpha: 0.8,
              duration: 200, ease: 'Sine.easeOut', delay: idx * 50,
            });
          } else {
            t.setAlpha(0.8);
          }
        });
        this._devTriggerAnim = false;
      }
    }
  }

  // ⚒ 강화 상점 — 별도 씬으로 진입.
  _openUpgradeShop() {
    this.scene.start('UpgradeShopScene');
  }

  _addMenuItem(y, label, cb, opts) {
    const r = this.makeMenuItem(this._menuX, y, label, cb, opts);
    if (r.txt) this._menuLayer.push(r.txt);
    if (r.hit) this._menuLayer.push(r.hit);
    if (r.marker) this._menuLayer.push(r.marker);
  }

  // === 색상 변경 안전 헬퍼 ===
  // ⚠️ 호버에서 색상만 바꿀 때는 반드시 이 메서드 사용. setStyle 사용 금지.
  // Phaser 4 의 setColor 가 letterSpacing 을 잃는 케이스를 대비해 명시적으로 재할당.
  _setMenuColor(target, color, letterSpacing = 1) {
    target.setColor(color);
    if (target.style) target.style.letterSpacing = letterSpacing;
    target.dirty = true;
  }

  // === 메뉴 항목 — 좌측 정렬 미니멀 텍스트 + 별도 호버 마커 + 클릭 피드백 ===
  // ⚠️ 모든 메뉴 항목은 이 함수를 통해 생성. 직접 add.text + 호버 핸들러 작성 금지.
  makeMenuItem(x, y, label, onClick, opts = {}) {
    const isPrimary = !!opts.primary;
    const isDim = !!opts.dim;
    const isDevActive = !!opts.devActive;   // DEV MODE ON 상태 — 골드 표시
    const H_BOX = 36;

    // 색상 — base / hover / down (3단계)
    let baseColor, hoverColor, downColor;
    if (isPrimary)        { baseColor = '#A8842E'; hoverColor = '#C5A059'; downColor = '#7A5C20'; }
    else if (isDevActive) { baseColor = '#C5A059'; hoverColor = '#FDE9A8'; downColor = '#8B7340'; }
    else if (isDim)       { baseColor = '#4A4A4A'; hoverColor = '#7A7A7A'; downColor = '#3A3A3A'; }
    else                  { baseColor = '#9A9AA2'; hoverColor = '#C5A059'; downColor = '#7A5C20'; }

    const FS = isPrimary ? 26 : (isDim ? 13 : 24);   // 모바일 가독성 19 → 24

    // 본체 — Primary는 항상 ▸ 마커 포함, 그 외는 라벨만
    // [Phase P-7] origin 0→0.5 (가운데 정렬, 메뉴 X 좌표가 W*0.5 로 변경됨에 따라)
    const baseText = isPrimary ? '▸ ' + label : label;
    const txt = this.add.text(x, y, baseText, {
      fontFamily: FONT,
      fontSize: `${FS}px`,
      color: baseColor,
      fontStyle: isPrimary ? '700' : '500',
      letterSpacing: 1,
    }).setOrigin(0.5, 0.5);
    txt.setShadow(0, 1, '#000000', 3, false, true);

    // 색상 변경 헬퍼 — Phaser 4 setColor 가 letterSpacing 등 잃을 수 있어 안전하게.
    // 클래스 메서드 _setMenuColor 를 letterSpacing 1 로 호출 (기본 메뉴 항목 spacing).
    const setColorOnly = (target, color) => this._setMenuColor(target, color, 1);

    // 별도 호버 마커 (Primary 외) — alpha 0 시작, 호버 시 fade-in
    // [Phase P-7] 가운데 정렬 시 마커는 텍스트 좌측 끝 외부에 배치 (txt.x - txt.width/2 - 14).
    let marker = null;
    const markerBaseX = x - txt.width / 2 - 14;   // 초기 마커 위치
    const markerHoverX = x - txt.width / 2 - 16;  // 호버 시 살짝 왼쪽
    if (!isPrimary) {
      const markerChar = isDim ? '·' : '›';
      marker = this.add.text(markerBaseX, y, markerChar, {
        fontFamily: FONT,
        fontSize: `${FS}px`,
        color: hoverColor,
        fontStyle: '500',
      }).setOrigin(0.5, 0.5).setAlpha(0);
      marker.setShadow(0, 1, '#000000', 3, false, true);
    }

    // hitArea — 글자 영역 + padding 5px만 (좌우 5씩, 빈 공간 hover 차단)
    // [Phase P-7] origin 0,0.5 zone 으로 변경 — 텍스트 가운데 정렬에 맞춰 hit 도 가운데
    const hitPadding = 5;
    const hitW = txt.width + hitPadding * 2;
    const hit = this.add.zone(x, y, hitW, H_BOX)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    const targets = marker ? [txt, marker] : [txt];

    // [P-59 2차] 호버 제거 — pointerdown 시 강조, pointerup 시 원복 + 액션.
    const revertMenu = () => {
      this.tweens.killTweensOf(targets);
      setColorOnly(txt, baseColor);
      this.tweens.add({ targets: txt, x: x, duration: 180, ease: 'Sine.easeOut' });
      if (marker) {
        this.tweens.add({ targets: marker, alpha: 0, x: markerBaseX, duration: 120, ease: 'Sine.easeOut' });
        marker.setText(isDim ? '·' : '›');
      }
    };
    hit.on('pointerdown', () => {
      this.tweens.killTweensOf(targets);
      setColorOnly(txt, downColor);
      this.tweens.add({ targets: txt, x: x + 6, duration: 120, ease: 'Sine.easeOut' });
      if (marker) {
        marker.setText(isDim ? '·' : '▸');
        this.tweens.add({ targets: marker, alpha: 1, x: markerHoverX, duration: 120, ease: 'Sine.easeOut' });
      }
    });
    hit.on('pointerupoutside', revertMenu);

    hit.on('pointerup', () => {
      this.tweens.killTweensOf(targets);
      setColorOnly(txt, baseColor);
      this.tweens.add({ targets: txt, x: x, duration: 80, ease: 'Sine.easeOut' });
      if (marker) {
        marker.setText(isDim ? '·' : '›');
        this.tweens.add({ targets: marker, alpha: 0, x: markerBaseX, duration: 120, ease: 'Sine.easeOut' });
      }
      // 시각 원복 후 액션 실행 (다음 프레임)
      this.time.delayedCall(20, onClick);
    });

    return { txt, hit, marker };
  }

  // === [심연의 경계 — 가짜의 그림자] 배경 ===
  // ── Z-Index 위계 (depth 값) ──
  //  -10  : 베이스 단색 (가장 뒤)
  //  -9   : 하늘 그라디언트
  //  -8.5 : 마왕성 뒤 달빛 헤일로
  //  -7.5 : 달 본체
  //  -7   : 마왕성 본체 (그라운드 anchor + 외벽 + 첨탑)  ← Z-Idx 0~1
  //  -6.7 : 안개 정적 그라디언트 백드롭
  //  -6.5 ~ -6 : 안개 흐르는 띠 3층  ← Z-Idx 4
  //  -3   : 절벽 본체  ← Z-Idx 2 (전경)
  //  -2.7 : 30 먼지 파티클
  //  -2.5 : 절벽 위 디테일 (수레/전단지)
  //  -2.3 : 그림자 (구부러진 나뭇가지 + Math.random 떨림)  ← Z-Idx 3
  //  -2   : 주인공 실루엣  ← Z-Idx 2
  //  -1.5 : 비네팅
  //   0+  : UI (메뉴/타이틀)  ← Z-Idx 5
  buildAbyssCliffBackground(W, H) {
    // ─── 0. 베이스 — 스펙 정확 색상 #1A1C1E ───
    this.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0x1A1C1E).setDepth(-10);

    // ─── 0-1. 30 먼지 파티클 (아래에서 위로 천천히 흐름, 스펙 정확) ───
    for (let i = 0; i < 30; i++) {
      const px = Phaser.Math.Between(0, W);
      const py = Phaser.Math.Between(0, H);
      const size = Phaser.Math.FloatBetween(0.8, 2.0);
      const baseAlpha = Phaser.Math.FloatBetween(0.18, 0.45);
      const dust = this.add.circle(px, py, size, 0xA8A6A0, baseAlpha).setDepth(-2.7);
      // 위로 흐르기
      this.tweens.add({
        targets: dust,
        y: -10,
        x: px + Math.sin(i * 0.7) * 50,
        duration: Phaser.Math.Between(22000, 38000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 8000),
        onRepeat: () => {
          dust.y = H + 10;
          dust.x = Phaser.Math.Between(0, W);
        },
      });
      // 알파 펄싱
      this.tweens.add({
        targets: dust, alpha: baseAlpha * 0.28,
        duration: Phaser.Math.Between(2000, 4500),
        yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1500),
      });
    }

    // ─── 1. 하늘 수직 그라디언트 (스펙: 위 어둡고 아래로 갈수록 살짝 밝아짐) ───
    this._drawSmoothGradient(W, 0, W, H, 0x0E1012, 0x1A1C1F, 0x2C2F33, -9);

    // ─── 2. 마왕성 뒤 달빛 헤일로 (역광 광원) ───
    // 달은 마왕성 뒤에 숨어 있지만 거대 헤일로가 마왕성 실루엣을 부드럽게 감쌈
    const moonX = W * 0.86, moonY = H * 0.20;
    // 큰 부드러운 빛번짐 (마왕성 윤곽이 떠오르도록)
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const r = 320 - t * 240;
      const a = 0.012 + t * 0.045;
      this.add.circle(moonX, moonY, r, 0xE8E6E1, a).setDepth(-8.5);
    }
    // 달 본체 — 마왕성 좌측에서 살짝 보이게 (이스터에그 클릭 영역)
    const moonBody = this.add.circle(moonX - 70, moonY - 18, 14, 0xC8C5BE, 0.50).setDepth(-7.5);
    this._moonClicks = 0;
    moonBody.setInteractive({ useHandCursor: false });
    moonBody.on('pointerdown', () => {
      this._moonClicks += 1;
      if (this._moonClicks >= 31 && !this._devUnlocked) {
        this._devUnlocked = true;
        this._writeDevUnlock();
        this._showDevButton();
      }
    });

    // (제거) 마왕성 실루엣 — background.png 에 통합됨

    // ─── 4. 안개바다 백드롭 (위 → 아래 그라디언트 페이드) ───
    // 위로 갈수록 투명, 아래로 갈수록 진한 회색 — 안개바다 깊이감
    const fogBg = this.add.graphics().setDepth(-6.7);
    const fogTop = H * 0.55;          // 안개 시작 (마왕성 발치)
    const fogBot = H * 1.0;
    const fogBands = 70;
    for (let i = 0; i < fogBands; i++) {
      const t = i / (fogBands - 1);
      // 위는 0% alpha, 아래는 35% alpha
      const a = t * t * 0.38;
      fogBg.fillStyle(0x14161A, a);
      const yy = fogTop + i * (fogBot - fogTop) / fogBands;
      fogBg.fillRect(0, yy, W, (fogBot - fogTop) / fogBands + 1);
    }

    // ─── 4-2. 수평형 안개 3층 — 그라디언트 페이드 띠가 좌우로 흐름 ───
    // 스펙: "둥근 타원형 안개 덩어리들을 지우고, 화면 하단 전체를 덮는 수평형 안개 레이어 3개 층"
    const makeFogBand = (yTop, height, color, peakAlpha, speedMs, depth) => {
      const container = this.add.container(0, 0).setDepth(depth);
      // 무한 루프용 2개 사본 (W 폭 두 개 나란히 → 컨테이너 -W 까지 tween)
      for (let copy = 0; copy < 2; copy++) {
        const seg = this.add.graphics();
        const halfH = height / 2;
        // 위 절반: 투명 → peakAlpha (위쪽 페이드인)
        seg.fillGradientStyle(color, color, color, color, 0, 0, peakAlpha, peakAlpha);
        seg.fillRect(copy * W, yTop, W, halfH);
        // 아래 절반: peakAlpha → 투명 (아래쪽 페이드아웃)
        seg.fillGradientStyle(color, color, color, color, peakAlpha, peakAlpha, 0, 0);
        seg.fillRect(copy * W, yTop + halfH, W, halfH);
        container.add(seg);
      }
      this.tweens.add({
        targets: container, x: -W,
        duration: speedMs, repeat: -1, ease: 'Linear',
        onRepeat: () => { container.x = 0; },
      });
    };
    // 스펙 정확값: globalAlpha 0.1 / 0.3 / 0.5 (이전 0.2/0.4/0.6 에서 다운)
    // 1층(가장 위, 가장 옅음) — 마왕성 발치
    makeFogBand(H * 0.66, 80, 0x4A4D52, 0.10, 56000, -6.5);
    // 2층(중간)
    makeFogBand(H * 0.78, 90, 0x33363A, 0.30, 36000, -6.3);
    // 3층(가장 아래, 가장 진함)
    makeFogBand(H * 0.90, 90, 0x1A1C1F, 0.50, 20000, -6);

    // ─── 7. 강력 비네팅 — 4면 페이드 + 코너 강화 (배경/UI 분리) ───
    const vg = this.add.graphics().setDepth(-1.5).setScrollFactor(0);
    const FADE = 160;
    for (let i = 0; i < FADE; i++) {
      vg.fillStyle(0x000000, 0.030);
      vg.fillRect(0, 0, W, FADE - i);
      vg.fillRect(0, H - (FADE - i), W, FADE - i);
      vg.fillRect(0, 0, FADE - i, H);
      vg.fillRect(W - (FADE - i), 0, FADE - i, H);
    }
    [
      { x: 0, y: 0 }, { x: W, y: 0 },
      { x: 0, y: H }, { x: W, y: H },
    ].forEach(({ x, y }) => {
      const corner = this.add.graphics().setDepth(-1.5);
      for (let r = 0; r < 40; r++) {
        corner.fillStyle(0x000000, 0.040);
        corner.fillCircle(x, y, 440 - r * 10);
      }
    });
  }

  // 두 색을 t(0~1) 비율로 섞어 RGB 정수 반환
  _blendHex(c1, c2, t) {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    return (Math.round(r1 + (r2 - r1) * t) << 16)
         | (Math.round(g1 + (g2 - g1) * t) << 8)
         |  Math.round(b1 + (b2 - b1) * t);
  }

  // 부드러운 세로 그라디언트 — top→mid→bot 3색 보간, 80 미세 띠
  // 인자: (w, x, w_unused, totalH, top, mid, bot, depth) — 사실상 fullW, startY, fullW, height
  _drawSmoothGradient(w, startY, _w, totalH, top, mid, bot, depth) {
    const N = 80;
    const bandH = totalH / N;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const color = (t < 0.5)
        ? this._blendHex(top, mid, t * 2)
        : this._blendHex(mid, bot, (t - 0.5) * 2);
      this.add.rectangle(w / 2, startY + i * bandH + bandH / 2, w, bandH + 1, color).setDepth(depth);
    }
  }

  // === 배경 분위기 효과 — 모두 토글 가능 ===
  // FX_CONFIG 의 false 로 바꾸면 해당 효과 OFF
  _setupBackgroundFX() {
    this._fxConfig = {
      stars: true,
      castleWindow: true,
      vignette: false,
      ash: true,
      logoVibrate: true,
    };
    if (this._fxConfig.stars)        this._fxMoonAndStars();
    if (this._fxConfig.castleWindow) this._fxCastleWindow();
    if (this._fxConfig.vignette)     this._fxVignette();
    if (this._fxConfig.ash)          this._fxAshParticles();
    if (this._fxConfig.logoVibrate)  this._fxLogoVibrate();
  }

  // B. 별 5개 (달빛 제거)
  _fxMoonAndStars() {
    const W = this.scale.width, H = this.scale.height;
    // 별 5개 — 화면 상단 1/3, 2px, 강한 깜빡임
    for (let i = 0; i < 5; i++) {
      const sx = Phaser.Math.Between(W * 0.10, W * 0.70);
      const sy = Phaser.Math.Between(H * 0.05, H * 0.30);
      const star = this.add.rectangle(sx, sy, 2, 2, 0xFFFFFF, 0.4).setDepth(4);
      this.tweens.add({
        targets: star, alpha: 1.0,
        duration: Phaser.Math.Between(1500, 3000),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1500),
      });
    }
  }

  // D. 마왕성 창문 — 빨간 점 5개, 강도 ↑
  _fxCastleWindow() {
    const W = this.scale.width, H = this.scale.height;
    for (let i = 0; i < 5; i++) {
      const wx = Phaser.Math.Between(W * 0.78, W * 0.92);
      const wy = Phaser.Math.Between(H * 0.30, H * 0.70);
      const sz = Phaser.Math.Between(3, 4);
      const win = this.add.rectangle(wx, wy, sz, sz, 0xC5404A, 0.5).setDepth(4);
      this.tweens.add({
        targets: win, alpha: 0.95,
        duration: Phaser.Math.Between(2000, 5000),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1500),
      });
    }
  }

  // E. 비네팅 — 4 모서리 검정
  _fxVignette() {
    const W = this.scale.width, H = this.scale.height;
    const vg = this.add.graphics().setDepth(100);
    vg.fillStyle(0x000000, 0.25);
    vg.fillRect(0, 0, W, 60);
    vg.fillRect(0, H - 60, W, 60);
    vg.fillRect(0, 0, 60, H);
    vg.fillRect(W - 60, 0, 60, H);
  }

  // F. 재 입자 — 15~20개 동시, 위로 흐름. 끝나면 재생성. 강도 ↑↑
  _fxAshParticles() {
    for (let i = 0; i < 18; i++) this._spawnAsh();
  }
  _spawnAsh() {
    if (!this._fxConfig || !this._fxConfig.ash) return;
    const W = this.scale.width, H = this.scale.height;
    const dot = this.add.rectangle(
      Phaser.Math.Between(0, W),
      Phaser.Math.Between(H, H + 20),
      Phaser.Math.Between(1, 2),
      Phaser.Math.Between(1, 2),
      0x8A8A92, 0.4,
    ).setDepth(50);
    this.tweens.add({
      targets: dot,
      y: -10,
      x: dot.x + Phaser.Math.Between(-50, 50),
      alpha: 0,
      duration: Phaser.Math.Between(8000, 14000),
      ease: 'Linear',
      onComplete: () => {
        dot.destroy();
        this._spawnAsh();
      },
    });
  }

  // 로고 미세 떨림 — 가짜 용사 컨셉 (정체 불안정). 부제는 정지.
  _fxLogoVibrate() {
    const logo = this._titleText;
    if (!logo) return;
    const ox = logo.x, oy = logo.y;
    this.time.addEvent({
      delay: 250, loop: true,
      callback: () => {
        logo.x = ox + Phaser.Math.FloatBetween(-0.3, 0.3);
        logo.y = oy + Phaser.Math.FloatBetween(-0.3, 0.3);
      },
    });
  }

}
