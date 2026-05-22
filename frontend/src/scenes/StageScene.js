// 스테이지 선택 — 한 화면 한 난이도 + 좌우 화살표/스와이프 전환
// 모바일 가로 게임. 큼지막한 노드/텍스트로 가독성 확보.

import Phaser from 'phaser';
import { hasSave, loadGame, PROGRESS_KEY, LAST_DIFF_KEY } from '../data/save.js';
import { gameSettings, getAvailableChapters, difficultyLabels } from '../data/settings.js';
import { FONT } from '../ui/theme.js';
import { sound } from '../systems/SoundManager.js';
import { getDiamonds, isEquipmentUnlocked } from '../data/meta/diamonds.js';
import { STAR_CHAPTER, getStageStars, getTotalStars, MAX_TOTAL_STARS, getChests, getChestState, openChest, CHEST_STATE } from '../data/meta/chapterStars.js';
import { applyNearestToPixelTextures } from '../data/spriteOptions.js';
import { attachTouchFeedback } from '../ui/touchFeedback.js';

const STAGE_NAMES = [
  '시작의 평원', '안개 낀 숲', '버려진 마을', '황량한 협곡', '마왕성 입구',
  '지하 감옥', '무너진 예배당', '심연의 알현실', '천계의 진실', '거짓된 루프',
];
// 스테이지별 짧은 설명 (진입 박스 두 번째 줄).
const STAGE_DESCS = [
  '여정이 시작되는 황량한 풀밭',
  '시야를 가리는 안개 속 숲',
  '주인이 떠난 텅 빈 마을',
  '바람조차 끊긴 협곡',
  '마왕의 성 입구 — 첫 시험',
  '햇빛이 닿지 않는 지하 감옥',
  '신앙이 무너진 폐허의 예배당',
  '심연 깊은 곳, 알현실',
  '천계가 감춘 진실의 문턱',
  '거짓이 반복되는 루프의 끝',
];

// 챕터 시스템 — getAvailableChapters() 가 데브 모드 분기 처리.
// 일반 모드: ['normal']. 데브 모드: ['normal','hard','veryHard'] (2/3챕터 = 1챕터 placeholder).
// 라벨은 settings.js 의 difficultyLabels 참조.
const UNLOCK_HINTS = {};   // 데브 모드 시 모든 챕터 자동 잠금 해제, 일반 모드는 normal 만 노출이라 안내 X

const COL_GOLD     = '#C5A059';
const COL_DIM      = '#6A6A72';
const COL_DISABLED = '#4A4A4F';

const NODE_GOLD    = 0xC5A059;
const NODE_HI      = 0xFDE9A8;
const NODE_CLEARED = 0x8B7355;

const HIT_MIN = 44;

export default class StageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StageScene' });
  }

  preload() {
    this.load.image('stage_select', 'sprites/screens/stage_select.png');
    this.load.image('icon-diamond', 'sprites/icons/diamond-icon.png');
    this.load.image('icon-gold',    'sprites/icons/gold-icon.png');
  }

  create(data) {
    // [Phase P-2] sprite 텍스처 NEAREST 필터 적용
    applyNearestToPixelTextures(this);
    const W = this.scale.width, H = this.scale.height;

    // === BGM — 메뉴 테마 (스테이지 선택은 메뉴 톤 유지) ===
    sound.playBgm(this, 'menu_theme');

    // === 배경 ===
    this.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0x000000).setDepth(-11);
    this.add.image(W * 0.5, H * 0.5, 'stage_select')
      .setOrigin(0.5, 0.5).setDepth(-10).setDisplaySize(W, H);
    // 옛 0.82 검정 오버레이 제거 — 이미지가 자체적으로 어두운 톤이라 추가 dim 불필요.

    // === 세이브 / 진행도 ===
    const newGame = data && data.newGame;
    this._saved = newGame ? null : (hasSave() ? loadGame() : null);
    this._newGame = newGame;
    this._isTest = !!gameSettings.testMode;
    // 새 게임이면 localStorage 잔재 무시하고 메모리에서 강제 초기화 (방어선)
    this._progress = newGame
      ? { normal: {}, hard: {}, veryHard: {} }
      : this._loadProgress();
    console.log('[stage init] newGame=', newGame, 'progress=', this._progress);
    // 잔존 selectedStage / 메모리 stale 방지 — currentSelection 도 강제 null
    this.currentSelection = null;

    // === DEV MODE 인디케이터 — 좌상단 메뉴 버튼 아래로 (겹침 방지). ===
    if (this._isTest) {
      this.add.text(20, 62, '● DEV MODE', {
        fontFamily: FONT, fontSize: '15px', color: COL_GOLD,
        fontStyle: '500', letterSpacing: 2,
      }).setOrigin(0, 0).setAlpha(0.7).setDepth(900);
    }

    // 다이아 잔액 표시 제거 — 스테이지 선택창은 양피지 지도에 집중.

    // === 하단 패널 (스테이지명 + 설명 + 진입 버튼) ===
    const panelW = 480, panelH = 110;
    const panelCx = W * 0.5, panelCy = H * 0.90;
    this._bottomPanel = this.add.graphics().setDepth(115);
    this._bottomPanel.fillStyle(0x3D2817, 0.85);
    this._bottomPanel.fillRoundedRect(panelCx - panelW / 2, panelCy - panelH / 2, panelW, panelH, 10);
    this._bottomPanel.lineStyle(2, 0xD4A942, 0.6);
    this._bottomPanel.strokeRoundedRect(panelCx - panelW / 2, panelCy - panelH / 2, panelW, panelH, 10);
    // 상단 베벨
    this._bottomPanel.fillStyle(0xFFE9B5, 0.10);
    this._bottomPanel.fillRect(panelCx - panelW / 2 + 8, panelCy - panelH / 2 + 1, panelW - 16, 1);

    // === 스테이지 설명 (중간) ===
    this._stageDescText = this.add.text(panelCx, panelCy + 2, '', {
      fontFamily: FONT, fontSize: '14px', color: '#E8D4A8',
      fontStyle: '500', align: 'center',
    }).setOrigin(0.5).setDepth(120);

    // === 진입 버튼 (하단) ===
    const entryX = panelCx, entryY = panelCy + 32;
    this._entryText = this.add.text(entryX, entryY, '▶ 진입', {
      fontFamily: FONT, fontSize: '22px', color: '#f4d160',
      fontStyle: '900', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(120);
    this._entryText.setShadow(2, 2, '#000000', 3, false, true);
    if (this._entryText.updateText) this._entryText.updateText();
    this._entryHit = this.add.zone(entryX, entryY, 220, 44).setOrigin(0.5)
      .setInteractive({ useHandCursor: true }).setDepth(120);
    this._entryHit.on('pointerdown', () => {
      const sel = this.currentSelection;
      if (!sel) return;
      const ref = this._currentNodeRefs[sel.stageIndex - 1];
      // 클리어된 스테이지 / 잠긴 난이도 → 진입 차단 (되돌아가기 방지)
      // ⭐ 단, 챕터 2(STAR_CHAPTER)는 별 갱신을 위해 클리어 스테이지 재도전 허용.
      if (!this._isTest) {
        const isCh2 = sel.difficulty === STAR_CHAPTER;
        if (ref && ref.isCleared && !isCh2) return;
        if (ref && !ref.isStageUnlocked) return;   // 이전 스테이지 미클리어 — 진입 차단.
        if (this._isDifficultyLocked(sel.difficulty)) return;
      }
      // sound.play('stage_enter');   // [Phase P-55] 사운드 hook.
      this.tweens.add({
        targets: this._entryText, scale: { from: 1, to: 1.15 },
        duration: 100, yoyo: true, ease: 'Sine.easeOut',
      });
      this.time.delayedCall(120, () => this._enterStage(sel.difficulty, sel.stageIndex));
    });

    // === 선택된 스테이지 이름 (단일, 노드 라인 아래 중앙. 잠금 안내와 분리) ===
    this._selectedNameText = this.add.text(panelCx, panelCy - 30, '', {
      fontFamily: FONT, fontSize: '20px',
      color: '#f4d160', fontStyle: '900', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(120);
    this._selectedNameText.setShadow(2, 2, '#000000', 3, false, true);
    if (this._selectedNameText.updateText) this._selectedNameText.updateText();

    // === 좌우 화살표 — 챕터 ≥2 (데브 모드) 일 때만 활성 ===
    this._leftArrow = null;
    this._rightArrow = null;
    if (getAvailableChapters().length > 1) {
      const arrowStyle = {
        fontFamily: FONT, fontSize: '32px', color: COL_GOLD,
        fontStyle: '700',
      };
      this._leftArrow = this.add.text(W * 0.06, H * 0.5, '◂', arrowStyle)
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(120);
      this._leftArrow.on('pointerdown', () => this._switchDifficulty(-1));
      this._rightArrow = this.add.text(W * 0.94, H * 0.5, '▸', arrowStyle)
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(120);
      this._rightArrow.on('pointerdown', () => this._switchDifficulty(1));
    }

    // === 챕터 라벨 — 상단 가운데 (◀ 1챕터 (N/10) ▶) — 클릭으로 챕터 전환 ===
    const CHAP_CX = W * 0.5;
    // 메인 라벨 — 어두운 다크브라운 + 베이지 그림자 (양피지 위 가독성).
    this._labelText = this.add.text(CHAP_CX - 78, 38, '', {
      fontFamily: FONT, fontSize: '28px', color: '#1a0f08',
      fontStyle: '900', letterSpacing: 2,
    }).setOrigin(0, 0.5).setDepth(900);
    this._labelText.setShadow(1, 1, '#e8d4a8', 3, false, true);
    if (this._labelText.updateText) this._labelText.updateText();
    // 진행도 — 라벨 우측 고정 위치.
    this._progressText = this.add.text(CHAP_CX + 32, 38, '', {
      fontFamily: FONT, fontSize: '18px', color: '#3d1f0a',
      fontStyle: '700',
    }).setOrigin(0, 0.5).setDepth(900);
    this._progressText.setShadow(1, 1, '#e8d4a8', 2, false, true);
    // 좌/우 화살표 — 라벨 양 옆, 클릭 시 챕터 전환.
    this._chapterLeftArrow = this.add.text(CHAP_CX - 108, 38, '◀', {
      fontFamily: FONT, fontSize: '20px', color: '#1a0f08', fontStyle: '700',
    }).setOrigin(0.5, 0.5).setDepth(900).setInteractive({ useHandCursor: true });
    this._chapterLeftArrow.setShadow(1, 1, '#e8d4a8', 2, false, true);
    this._chapterLeftArrow.on('pointerdown',      () => this._chapterLeftArrow.setColor('#8b6914'));
    this._chapterLeftArrow.on('pointerupoutside', () => this._chapterLeftArrow.setColor('#1a0f08'));
    this._chapterLeftArrow.on('pointerup',        () => { this._chapterLeftArrow.setColor('#1a0f08'); this._switchDifficulty(-1); });
    this._chapterRightArrow = this.add.text(CHAP_CX + 108, 38, '▶', {
      fontFamily: FONT, fontSize: '20px', color: '#1a0f08', fontStyle: '700',
    }).setOrigin(0.5, 0.5).setDepth(900).setInteractive({ useHandCursor: true });
    this._chapterRightArrow.setShadow(1, 1, '#e8d4a8', 2, false, true);
    this._chapterRightArrow.on('pointerdown',      () => this._chapterRightArrow.setColor('#8b6914'));
    this._chapterRightArrow.on('pointerupoutside', () => this._chapterRightArrow.setColor('#1a0f08'));
    this._chapterRightArrow.on('pointerup',        () => { this._chapterRightArrow.setColor('#1a0f08'); this._switchDifficulty(1); });
    // 위치 (라벨 우측 끝 + 8) 은 라벨 setText 후 결정 — _refreshDifficultyView 에서 갱신.

    // _indicatorText — 챕터 라벨 + 좌우 화살표와 정보 중복되어 숨김 처리.
    this._indicatorText = this.add.text(20, 60, '', {
      fontFamily: FONT, fontSize: '15px', color: COL_DIM,
      fontStyle: '500', letterSpacing: 2,
    }).setOrigin(0, 0).setDepth(900).setVisible(false);
    const chapters = getAvailableChapters();

    // === 초기 난이도 결정 ===
    this.currentDifficultyIndex = this._loadLastDifficulty();
    this.currentDifficulty = chapters[this.currentDifficultyIndex] || chapters[0];

    // === 현재 난이도 노드/안내 보관 — refresh 시 destroy ===
    this._diffElements = [];
    this._currentNodeRefs = [];

    // 첫 렌더
    this._refreshDifficultyView();

    // === 스와이프 (드래그) ===
    this.input.on('pointerdown', (pointer) => {
      this._tapStart = { x: pointer.x, t: Date.now() };
    });
    this.input.on('pointerup', (pointer) => {
      if (!this._tapStart) return;
      const dx = pointer.x - this._tapStart.x;
      const dt = Date.now() - this._tapStart.t;
      this._tapStart = null;
      if (dt < 500 && Math.abs(dx) > 50) {
        this._switchDifficulty(dx > 0 ? -1 : 1);
      }
    });

    // === 좌상단 메뉴 버튼 + 하단 환경 설정 ===
    this._makeBottomLink(20, 38, '메뉴', 0,
      () => this.scene.start('MenuScene'));
    this._makeBottomLink(W - W * 0.04, H - 30, '환경 설정', 1,
      () => this.scene.start('SettingsScene'));

    attachTouchFeedback(this);

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // === 난이도 전환 ===
  _switchDifficulty(direction) {
    const chapters = getAvailableChapters();
    const newIndex = this.currentDifficultyIndex + direction;
    if (newIndex < 0 || newIndex >= chapters.length) return;
    this.currentDifficultyIndex = newIndex;
    this.currentDifficulty = chapters[newIndex];
    this._saveLastDifficulty(newIndex);
    this._refreshDifficultyView();
  }

  // === 현재 난이도 다시 그리기 (라벨 / 노드 / 안내 / 인디케이터 / 화살표) ===
  _refreshDifficultyView() {
    // 기존 요소 제거
    this._diffElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    this._diffElements = [];
    this._currentNodeRefs = [];
    // ⭐ 챕터 2 보상 상자 요소도 정리 (챕터 전환 시 잔존 방지).
    if (this._chestElements) this._chestElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    this._chestElements = [];

    const diff = this.currentDifficulty;
    const isUnlocked = this._isTest || !this._isDifficultyLocked(diff);

    // 라벨 + 진행도 (클리어수/10) 갱신
    const chapters = getAvailableChapters();
    const progressMap = this._progress[diff] || {};
    let clearedCount = 0;
    for (let s = 1; s <= 10; s++) if (progressMap[s]) clearedCount++;
    const label = (difficultyLabels[diff] || diff);
    this._labelText.setText(label);
    this._labelText.setColor(isUnlocked ? '#1a0f08' : COL_DISABLED);
    this._labelText.setAlpha(isUnlocked ? 1 : 0.6);
    // 진행도 — 고정 위치 유지 (x=140 으로 초기화됨), 텍스트만 갱신.
    if (this._progressText) {
      this._progressText.setText(`(${clearedCount}/10)`);
      this._progressText.setColor(isUnlocked ? '#3d1f0a' : COL_DISABLED);
      this._progressText.setAlpha(isUnlocked ? 1 : 0.6);
    }
    this._indicatorText.setText(`${this.currentDifficultyIndex + 1} / ${chapters.length}`);
    // 우측 ▶ 화살표 — 고정 위치 (x=225 으로 초기화됨).
    // 화살표 활성/비활성 — 이동 가능 챕터 있을 때만 active.
    if (this._chapterLeftArrow) {
      const canLeft = this.currentDifficultyIndex > 0;
      this._chapterLeftArrow.setAlpha(canLeft ? 1 : 0.25);
      if (this._chapterLeftArrow.input) this._chapterLeftArrow.input.enabled = canLeft;
    }
    if (this._chapterRightArrow) {
      const canRight = this.currentDifficultyIndex < chapters.length - 1;
      this._chapterRightArrow.setAlpha(canRight ? 1 : 0.25);
      if (this._chapterRightArrow.input) this._chapterRightArrow.input.enabled = canRight;
    }

    // ⭐ 챕터 2 전용 — 누적 별 카운터 + 보상 상자 행 (상단 가운데).
    if (diff === STAR_CHAPTER) {
      const total = getTotalStars();
      const starTotal = this.add.text(this.scale.width * 0.5, 58,
        `★ ${total} / ${MAX_TOTAL_STARS}`, {
          fontFamily: FONT, fontSize: '17px', color: '#1a0f08', fontStyle: '900', letterSpacing: 1,
        }).setOrigin(0.5, 0.5).setDepth(900);
      starTotal.setShadow(1, 1, '#e8d4a8', 3, false, true);
      this._diffElements.push(starTotal);
      this._renderChapter2Chests();
    }

    // 노드 라인
    this._renderDifficulty(diff, isUnlocked);

    // 잠긴 안내
    // [Phase P-19] 960×540 하드코딩 → 동적 scale.width/height (P-16 누락 잔재).
    if (!isUnlocked && UNLOCK_HINTS[diff]) {
      const hint = this.add.text(this.scale.width * 0.5, this.scale.height * 0.62, UNLOCK_HINTS[diff], {
        fontFamily: FONT, fontSize: '18px', color: COL_DIM,
        fontStyle: '500', letterSpacing: 2,
      }).setOrigin(0.5).setAlpha(0.7);
      this._diffElements.push(hint);
    }

    // 기본 선택 — 현재 난이도의 다음 uncleared (또는 1)
    this.currentSelection = {
      difficulty: diff,
      stageIndex: this._pickDefaultStageInDifficulty(diff),
    };
    this._applySelection();
    this._updateArrowsState();
  }

  // === 노드 10개 그리기 — 양피지 지도의 마커 위치에 오버레이 ===
  _renderDifficulty(diff, isUnlocked) {
    const W = this.scale.width, H = this.scale.height;
    // 양피지 지도 (stage_select.png) 의 각 마커별 화면 비율 좌표 (x%, y%).
    //   1풀 / 2죽은나무 / 3집 / 4해골 / 5탑 / 6사슬 / 7십자가 / 8왕좌 / 9구름섬 / 10거울
    const NODE_POS = [
      { x: 0.063, y: 0.406 },
      { x: 0.180, y: 0.187 },
      { x: 0.297, y: 0.385 },
      { x: 0.364, y: 0.582 },
      { x: 0.487, y: 0.302 },   // 5번 (탑) — y +0.056 (깃발 비킴).
      { x: 0.547, y: 0.524 },
      { x: 0.610, y: 0.741 },   // 7번 (십자가) — y -0.018 (진입 박스 비킴).
      { x: 0.742, y: 0.559 },   // 8번 (왕좌) — y +0.046.
      { x: 0.847, y: 0.409 },   // 9번 (구름섬) — y +0.046.
      { x: 0.919, y: 0.657 },
    ];
    const xAt = (i) => W * NODE_POS[i].x;
    const yAt = (i) => H * NODE_POS[i].y;

    const progressMap = this._progress[diff] || {};

    // 노드 10개 — 양피지 지도 마커 위에 둥근 노드 + 번호.
    for (let i = 0; i < 10; i++) {
      const stage = i + 1;
      const x = xAt(i);
      const y = yAt(i);
      const stageCleared = this._isTest || !!progressMap[stage];
      const stageUnlocked = this._isTest
        || (isUnlocked && (stage === 1 || progressMap[stage - 1] === true));

      // 노드 디자인 — 양피지 톤 완전 통일. 외곽선 X. 상태별 색/굵기 변형.
      // 색은 베이지/갈색/황금 계열만 사용.
      let nodeFill, nodeStroke, nodeFillAlpha, nodeStrokeAlpha, nodeStrokeWidth;
      let numColor;
      let pulse = false;
      let lockIcon = false;
      const NODE_R_BASE = 16;   // 기본 반지름.
      let nodeScale = 1;
      if (!isUnlocked || (!stageUnlocked && !stageCleared)) {
        // 잠긴 노드 — 베이지 + 중간 갈색 테두리 + 자물쇠.
        nodeFill = 0xc9b48a; nodeStroke = 0x6b4423;
        nodeFillAlpha = 0.7; nodeStrokeAlpha = 1.0; nodeStrokeWidth = 2;
        numColor = '#6b4423';
        lockIcon = true;
      } else if (stageCleared) {
        // 클리어 — 다크 골드 + 어두운 다크브라운 테두리.
        nodeFill = 0x8b6914; nodeStroke = 0x3d1f0a;
        nodeFillAlpha = 0.95; nodeStrokeAlpha = 1.0; nodeStrokeWidth = 3;
        numColor = '#f4d160';
      } else {
        // 진행 가능 (active) — 따뜻한 황금 + 다크 골드 테두리, 펄스 + 1.3×.
        nodeFill = 0xd4a942; nodeStroke = 0x8b6914;
        nodeFillAlpha = 1.0; nodeStrokeAlpha = 1.0; nodeStrokeWidth = 5;
        numColor = '#2a1505';
        pulse = true;
        nodeScale = 1.3;
      }
      const NODE_R = NODE_R_BASE;

      // 입체감 그림자 — 노드 아래 더 떨어뜨려 (강화).
      const shadow = this.add.circle(x, y + 3, NODE_R, 0x000000, 0.5).setDepth(99);
      shadow.setScale(nodeScale);

      const node = this.add.circle(x, y, NODE_R, nodeFill, nodeFillAlpha).setDepth(100);
      node.setStrokeStyle(nodeStrokeWidth, nodeStroke, nodeStrokeAlpha);
      node.setScale(nodeScale);
      // 선택 강조용 외부 링 (alpha 0, 선택 시 alpha 1).
      const fillCircle = this.add.circle(x, y, NODE_R + 5, 0xf4d160, 0).setDepth(101);

      // 펄스 글로우 (진행 가능 노드만).
      if (pulse) {
        const pulseRing = this.add.circle(x, y, NODE_R + 3, 0xd4a942, 0.5).setDepth(99.5);
        this.tweens.add({
          targets: pulseRing,
          alpha: { from: 0.55, to: 0.15 },
          scale: { from: 1.0, to: 1.35 },
          duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        this._diffElements.push(pulseRing);

        // ▼ 화살표 — 양피지 황금 톤, 외곽선 X. (1번 노드 등 진행 가능 노드 강조)
        const arrowY = y - 28;
        const arrowText = this.add.text(x, arrowY, '▼', {
          fontFamily: FONT, fontSize: '20px', color: '#8b6914', fontStyle: '900',
        }).setOrigin(0.5).setDepth(103);
        this.tweens.add({
          targets: arrowText, y: { from: arrowY - 3, to: arrowY + 3 },
          duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        this._diffElements.push(arrowText);
      }

      node.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-HIT_MIN / 2, -HIT_MIN / 2, HIT_MIN, HIT_MIN),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });

      // 노드 번호 — 양피지 잉크 톤 (상태별), 외곽선 X.
      const numLabel = stageCleared ? '★' : `${stage}`;
      const numText = this.add.text(x, y, numLabel, {
        fontFamily: FONT, fontSize: stageCleared ? '20px' : '18px',
        color: numColor, fontStyle: '900',
      }).setOrigin(0.5, 0.5).setDepth(102);
      numText.setScale(nodeScale);
      if (numText.updateText) numText.updateText();

      // 자물쇠 아이콘 — 잠긴 노드 우측 하단 외부 (노드 외곽에 살짝 걸치게).
      if (lockIcon) {
        const lock = this.add.text(x + NODE_R + 2, y + NODE_R + 2, '🔒', {
          fontFamily: FONT, fontSize: '16px', color: '#5c3a1f',
        }).setOrigin(0.5).setDepth(103);
        this._diffElements.push(lock);
      }
      this._diffElements.push(shadow);

      // [P-59 2차] 호버 제거 — 탭 누름 시 확대, 뗐을 때 원복 (pointerdown 클릭 처리는 아래 별도).
      if (pulse) {
        const downScale = nodeScale * 1.1;
        const revertNode = () => {
          this.tweens.killTweensOf(node);
          this.tweens.add({ targets: node, scale: nodeScale, duration: 200, ease: 'Sine.easeIn' });
        };
        node.on('pointerdown', () => {
          this.tweens.killTweensOf(node);
          this.tweens.add({ targets: node, scale: downScale, duration: 120, ease: 'Sine.easeOut' });
        });
        node.on('pointerup',        revertNode);
        node.on('pointerupoutside', revertNode);
      }

      // 이름은 노드별로 안 그림 — 선택된 노드만 _selectedNameText 에 표시 (모바일 가독성)
      const nameText = null;

      // ⭐ 챕터 2 전용 — 노드 위 3성 표시 (양피지 황금 톤). 잠긴+기록없음이면 생략.
      if (diff === STAR_CHAPTER) {
        const earnedStars = getStageStars(stage);
        const showStarRow = isUnlocked && (stageUnlocked || stageCleared || earnedStars > 0);
        if (showStarRow) {
          const SGAP = 13;
          const sy = y - NODE_R * nodeScale - 18;
          for (let k = 0; k < 3; k++) {
            const got = k < earnedStars;
            const sTxt = this.add.text(x + (k - 1) * SGAP, sy, got ? '★' : '☆', {
              fontFamily: FONT, fontSize: '13px',
              color: got ? '#f4d160' : '#7a5a32', fontStyle: '900',
            }).setOrigin(0.5).setDepth(104);
            sTxt.setShadow(1, 1, '#2a1505', 2, false, true);
            this._diffElements.push(sTxt);
          }
        }
      }

      this._diffElements.push(node, fillCircle, numText);

      // 진입 가능 = 잠금 해제됨 + 미클리어. (⭐ 챕터 2는 클리어 스테이지도 재도전 가능.)
      const isPlayable = isUnlocked && stageUnlocked && (!stageCleared || diff === STAR_CHAPTER);

      const ref = {
        node, fillCircle, nameText, numText,
        baseNumColor: numColor, baseNumAlpha: 1.0,
        baseStrokeColor: nodeStroke, baseStrokeAlpha: nodeStrokeAlpha,
        baseStrokeWidth: nodeStrokeWidth, baseScale: nodeScale,
        x, y, stage, diff,
        isDiffLocked: !isUnlocked,
        isStageUnlocked: stageUnlocked || stageCleared,
        isCleared: stageCleared,
        isPlayable,
      };
      this._currentNodeRefs.push(ref);

      // 클릭 — 어떤 노드든 선택은 허용 (정보 표시).
      //   진입 제한은 _refreshEntryButton 에서 처리 (잠김/클리어 시 disabled).
      node.on('pointerdown', () => {
        // sound.play('ui_click');   // [Phase P-55] 사운드 hook.
        this.tweens.add({
          targets: node, scale: { from: 1, to: 1.15 },
          duration: 100, yoyo: true, ease: 'Sine.easeOut',
        });
        this.currentSelection = { difficulty: diff, stageIndex: stage };
        this._applySelection();
      });
    }
  }

  // ⭐ 챕터 2 보상 상자 행 — ★10/20/30 도달 시 개봉 가능. 탭하면 💎 수령.
  //   상태: locked(별 부족) / openable(개봉 가능, 펄스+흔들) / opened(수령 완료, ✓).
  _renderChapter2Chests() {
    if (this._chestElements) this._chestElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    this._chestElements = [];
    const W = this.scale.width;
    const total = getTotalStars();
    const chests = getChests();
    const cy = 92;
    const gap = 116;
    const startX = W * 0.5 - gap * (chests.length - 1) / 2;

    chests.forEach((chest, i) => {
      const cx = startX + i * gap;
      const state = getChestState(chest.need, total);
      const opened   = state === CHEST_STATE.OPENED;
      const openable = state === CHEST_STATE.OPENABLE;

      // 개봉 가능 — 뒤에 황금 펄스 링.
      if (openable) {
        const ring = this.add.circle(cx, cy, 20, 0xd4a942, 0.45).setDepth(108);
        this.tweens.add({
          targets: ring, alpha: { from: 0.5, to: 0.12 }, scale: { from: 1, to: 1.4 },
          duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        this._chestElements.push(ring);
      }

      // 상자 아이콘 — 게임 보물상자 톤(🎁) 통일.
      const icon = this.add.text(cx, cy, '🎁', { fontFamily: FONT, fontSize: '30px' })
        .setOrigin(0.5).setDepth(110)
        .setAlpha(opened ? 0.45 : (openable ? 1 : 0.4));
      this._chestElements.push(icon);

      // 수령 완료 ✓.
      if (opened) {
        const check = this.add.text(cx + 12, cy - 10, '✓', {
          fontFamily: FONT, fontSize: '18px', color: '#6b8e23', fontStyle: '900',
        }).setOrigin(0.5).setDepth(111);
        check.setShadow(1, 1, '#1a2a05', 2, false, true);
        this._chestElements.push(check);
      }

      // 라벨 — 요구 별 / 상태.
      const labelText = opened ? '완료' : (openable ? '개봉!' : `★${chest.need}`);
      const labelColor = opened ? '#5c4a2f' : (openable ? '#8b6914' : '#5c3a1f');
      const label = this.add.text(cx, cy + 24, labelText, {
        fontFamily: FONT, fontSize: '13px', color: labelColor, fontStyle: '900', letterSpacing: 1,
      }).setOrigin(0.5).setDepth(110);
      label.setShadow(1, 1, '#e8d4a8', 2, false, true);
      this._chestElements.push(label);

      // 개봉 가능 — 살짝 흔들 + 탭 처리.
      if (openable) {
        this.tweens.add({
          targets: icon, y: { from: cy - 2, to: cy + 2 },
          duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        const hit = this.add.zone(cx, cy, 56, 60).setOrigin(0.5)
          .setInteractive({ useHandCursor: true }).setDepth(112);
        hit.on('pointerdown', () => {
          this.tweens.add({ targets: icon, scale: { from: 1, to: 1.25 }, duration: 100, yoyo: true });
        });
        hit.on('pointerup', () => this._openChest(chest.need, cx, cy));
        this._chestElements.push(hit);
      }
    });
  }

  // 상자 열기 — 💎 지급 + 플로팅 표시 + 카운터/행 갱신.
  _openChest(need, cx, cy) {
    const reward = openChest(need);
    if (!reward) return;
    try { if (sound.treasureOpen) sound.treasureOpen(); } catch {}
    const float = this.add.text(cx, cy - 8, `💎 +${reward}`, {
      fontFamily: FONT, fontSize: '20px', color: '#7EE7FF', fontStyle: '900', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(2000);
    float.setShadow(1, 1, '#000000', 3, false, true);
    this.tweens.add({
      targets: float, y: cy - 48, alpha: { from: 1, to: 0 },
      duration: 1100, ease: 'Sine.easeOut',
      onComplete: () => { try { float.destroy(); } catch {} },
    });
    // 열린 상태 반영.
    this._renderChapter2Chests();
  }

  _pickDefaultStageInDifficulty(diff) {
    const map = this._progress[diff] || {};
    for (let s = 1; s <= 10; s++) {
      if (!map[s]) return s;
    }
    return 10;
  }

  // === 선택 시각 적용 ===
  _applySelection() {
    this._currentNodeRefs.forEach(ref => {
      ref.fillCircle.setAlpha(0);
      this.tweens.killTweensOf(ref.node);
      const baseScale = ref.baseScale || 1;
      this.tweens.add({
        targets: ref.node, scale: baseScale,
        duration: 200, ease: 'Sine.easeIn',
      });
      // base stroke 복원 — 양피지 톤 유지.
      ref.node.setStrokeStyle(
        ref.baseStrokeWidth || 2,
        ref.baseStrokeColor != null ? ref.baseStrokeColor : 0x6b4423,
        ref.baseStrokeAlpha != null ? ref.baseStrokeAlpha : 1.0
      );
      if (ref.numText) {
        ref.numText.setColor(ref.baseNumColor);
        ref.numText.setAlpha(ref.baseNumAlpha || 1.0);
      }
    });

    if (!this.currentSelection) {
      if (this._selectedNameText) this._selectedNameText.setText('');
      if (this._stageDescText) this._stageDescText.setText('');
      this._refreshEntryButton();
      return;
    }
    const sel = this.currentSelection;
    const ref = this._currentNodeRefs[sel.stageIndex - 1];
    if (!ref) {
      if (this._selectedNameText) this._selectedNameText.setText('');
      if (this._stageDescText) this._stageDescText.setText('');
      this._refreshEntryButton();
      return;
    }
    // 선택 효과 — 외곽 링 강조 + 테두리 굵게 (5px) + base scale 의 1.1×.
    ref.fillCircle.setAlpha(1);
    const selStrokeColor = ref.baseStrokeColor != null ? ref.baseStrokeColor : 0x8b6914;
    ref.node.setStrokeStyle(5, selStrokeColor, 1);
    this.tweens.killTweensOf(ref.node);
    const selScale = (ref.baseScale || 1) * 1.1;
    this.tweens.add({
      targets: ref.node, scale: selScale,
      duration: 200, ease: 'Sine.easeOut',
    });
    // 선택된 노드 이름 + 설명 표시 — 잠긴 스테이지도 정보는 노출, 진입만 막음.
    if (this._selectedNameText) {
      const nm = STAGE_NAMES[sel.stageIndex - 1] || '';
      this._selectedNameText.setText(nm);
      this._selectedNameText.setColor('#f4d160');
    }
    if (this._stageDescText) {
      const desc = STAGE_DESCS[sel.stageIndex - 1] || '';
      this._stageDescText.setText(desc);
      this._stageDescText.setColor('#E8D4A8');
    }

    this._refreshEntryButton();
  }

  _refreshEntryButton() {
    if (!this._entryText) return;
    const t = this._entryText;
    if (t.updateText && (!t.frame || !t.frame.source || !t.frame.source.image)) {
      t.updateText();
    }
    const sel = this.currentSelection;
    if (!sel) {
      t.setColor(COL_DISABLED).setText('▸ 진입');
      return;
    }
    const ref = this._currentNodeRefs[sel.stageIndex - 1];
    const isCleared = ref && ref.isCleared;
    const stageLocked = ref && !ref.isStageUnlocked;
    const diffLocked = !this._isTest && this._isDifficultyLocked(sel.difficulty);
    if (isCleared && !this._isTest) {
      // ⭐ 챕터 2 — 별 갱신용 재도전 허용 (잠금 아님). 그 외 챕터는 정복 완료로 진입 차단.
      if (sel.difficulty === STAR_CHAPTER) {
        t.setColor('#f4d160').setText('▸ 재도전');
        return;
      }
      t.setColor(COL_DISABLED).setText('— 정복 완료 —');
      return;
    }
    if (diffLocked || (stageLocked && !this._isTest)) {
      t.setColor(COL_DISABLED).setText('✕ 봉인됨');
      return;
    }
    t.setColor('#f4d160').setText('▸ 진입');
  }

  _updateArrowsState() {
    const chapters = getAvailableChapters();
    const idx = this.currentDifficultyIndex;
    const last = chapters.length - 1;
    if (this._leftArrow) {
      this._leftArrow.setAlpha(idx === 0 ? 0.3 : 1);
      if (this._leftArrow.input) this._leftArrow.input.enabled = (idx > 0);
    }
    if (this._rightArrow) {
      this._rightArrow.setAlpha(idx === last ? 0.3 : 1);
      if (this._rightArrow.input) this._rightArrow.input.enabled = (idx < last);
    }
  }

  _isDifficultyLocked(diff) {
    // 데브 모드 — 모든 챕터 잠금 해제. 일반 — normal 만.
    if (this._isTest) return false;
    return diff !== 'normal';
  }

  _isAllCleared(diff) {
    const map = (this._progress && this._progress[diff]) || {};
    for (let s = 1; s <= 10; s++) {
      if (!map[s]) return false;
    }
    return true;
  }

  // === 진행 상태 로드/저장 ===
  // 챕터별 클리어: { normal: {1:true, ...}, hard: {...}, veryHard: {...} }
  // 마이그레이션: 옛 'extreme' 키 → 'veryHard' 로 머지 (단, 신 키가 비어있을 때만 덮어쓰기 방지).
  _loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const veryHard = (p.veryHard && Object.keys(p.veryHard).length > 0)
          ? p.veryHard
          : (p.extreme || {});
        return {
          normal:   p.normal || {},
          hard:     p.hard   || {},
          veryHard,
        };
      }
    } catch (e) {}
    return { normal: {}, hard: {}, veryHard: {} };
  }
  _saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(this._progress)); } catch (e) {}
  }

  // === 마지막 본 난이도 영속화 ===
  _loadLastDifficulty() {
    const chapters = getAvailableChapters();
    try {
      const raw = localStorage.getItem(LAST_DIFF_KEY);
      if (raw) {
        const idx = parseInt(raw, 10);
        if (idx >= 0 && idx < chapters.length) return idx;
      }
    } catch (e) {}
    return 0;
  }
  _saveLastDifficulty(idx) {
    try { localStorage.setItem(LAST_DIFF_KEY, String(idx)); } catch (e) {}
  }

  // === 하단 링크 — 메인 메뉴 톤 ===
  _makeBottomLink(x, y, label, originX, onClick) {
    const baseColor = '#1a0f08';   // 양피지 잉크 — 가장 진한 톤 (가독성).
    const hoverColor = '#8b6914';  // 호버 시 다크 골드
    const isLeft = (originX === 0);
    const txt = this.add.text(x, y, label, {
      fontFamily: FONT, fontSize: '19px',
      color: baseColor, fontStyle: '900', letterSpacing: 1,
    }).setOrigin(originX, 0.5).setDepth(900);
    txt.setShadow(1, 1, '#e8d4a8', 3, false, true);

    const realMarkerChar = isLeft ? '›' : '‹';
    const marker = this.add.text(
      isLeft ? (x + 80) : (x - 80), y, realMarkerChar, {
        fontFamily: FONT, fontSize: '18px',
        color: hoverColor, fontStyle: '500',
      }).setOrigin(isLeft ? 0 : 1, 0.5).setAlpha(0).setDepth(900);

    const txtW = Math.max(txt.width + 40, 120);
    const hitH = Math.max(HIT_MIN, txt.height + 16);
    const hit = this.add.zone(
      isLeft ? (x - 8) : (x - txtW + 8), y - hitH / 2, txtW, hitH
    ).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(120);

    // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 원복 + 액션.
    const revertLink = () => {
      this.tweens.killTweensOf([txt, marker]);
      txt.setColor(baseColor);
      this.tweens.add({ targets: txt, x: x, scale: 1, duration: 180, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: marker, alpha: 0, duration: 120, ease: 'Sine.easeOut' });
    };
    hit.on('pointerdown', () => {
      this.tweens.killTweensOf([txt, marker]);
      txt.setColor(hoverColor);
      const dx = isLeft ? 4 : -4;
      this.tweens.add({ targets: txt, x: x + dx, scale: 1.05, duration: 150, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: marker, alpha: 1, duration: 120, ease: 'Sine.easeOut' });
    });
    hit.on('pointerup', () => {
      revertLink();
      this.time.delayedCall(60, onClick);
    });
    hit.on('pointerupoutside', revertLink);
    return { txt, marker, hit };
  }

  _enterStage(diff, stage) {
    // [Phase P-9] 풀스크린 자동 진입 코드 제거 — 사용자 자율.
    gameSettings.difficulty = diff;
    // 진행 중이던 세이브가 같은 난이도 + 같은 스테이지 진입 지점이면 → 데이터 유지 (이어하기)
    // 그 외 (새 난이도, 다른 스테이지 점프, 세이브 없음) → 새 게임 + 장착 모달
    const saved = this._saved;
    const continueRun = saved
      && saved.stage === stage
      && saved.difficulty === diff;
    if (continueRun) {
      // 이어하기 — 모달 스킵 (이미 장착 상태 유지됨)
      this.scene.start('GameScene', { newGame: false, savedGame: saved, startStage: stage });
      return;
    }
    // [Phase P-55] 슬롯 강화 시스템 — 강화는 강화 상점에서 별도 진행.
    //   스테이지 진입 직전 EquipmentLoadoutModal 폐기 — 곧장 게임 시작.
    this.scene.start('GameScene', { newGame: true, startStage: stage });
  }
}
