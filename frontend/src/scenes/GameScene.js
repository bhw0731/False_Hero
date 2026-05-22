// 메인 게임 씬
// 시스템(플레이어/적/전투/웨이브)을 조립하고, 클래스 선택 + 카드 선택 + 게임 종료 UI를 담당합니다.

import Phaser from 'phaser';
import Player from '../entities/Player.js';
import CombatSystem from '../systems/CombatSystem.js';
import WaveSystem from '../systems/WaveSystem.js';
import BossDebuffSystem from '../systems/BossDebuffSystem.js';
import { commonCards, CARD_TIER_COLORS } from '../data/cards.js';
import { items, SLOTS, SLOT_LABELS } from '../data/items.js';
import { PASSIVES } from '../data/passives.js';
import { specialCards } from '../data/specialCards.js';
import { isUpgradeOwned, isEquipmentUnlocked, getSlotLevels } from '../data/diamonds.js';
import { STAR_CHAPTER } from '../data/chapterStars.js';
import { getSlotEffect } from '../data/loadoutUpgrades.js';
import { createModal } from '../ui/Modal.js';
import { makeGlassBtn } from '../ui/glassBtn.js';
import { FONT } from '../ui/theme.js';
import { attachTouchFeedback } from '../ui/touchFeedback.js';
import {
  showBossIntro as fxShowBossIntro,
  showGameOver  as fxShowGameOver,
  showGameClear as fxShowGameClear,
  showStageClear as fxShowStageClear,
} from '../ui/CombatFX.js';
import {
  showCardSelection  as fxShowCardSelection,
  showPurchasedItems as fxShowPurchasedItems,
  showPickedCards    as fxShowPickedCards,
} from '../ui/InventoryModals.js';
import { showInventory as fxShowInventory } from '../ui/InventoryModal.js';
import {
  showPauseMenu     as fxShowPauseMenu,
  showSettingsModal as fxShowSettingsModal,
} from '../ui/PauseModals.js';
import { showSynergyInfo as fxShowSynergyInfo } from '../ui/SynergyInfoModal.js';
import { showHelpModal as fxShowHelpModal } from '../ui/HelpModal.js';
import {
  showShop         as fxShowShop,
  rerollShop       as fxRerollShop,
  renderShop       as fxRenderShop,
  buyItem          as fxBuyItem,
  buySpecialCard   as fxBuySpecialCard,
  exitShop         as fxExitShop,
} from '../ui/ShopModal.js';
import TopBar from '../ui/TopBar.js';
import ComboFloat from '../ui/ComboFloat.js';
import PotionSlotPanel from '../ui/PotionSlotPanel.js';
import PickedCardsStrip from '../ui/PickedCardsStrip.js';
import BuffStrip from '../ui/BuffStrip.js';
import { ALL_SPRITES, PLAYER_SPRITE, applyNearestToPixelTextures } from '../data/spriteOptions.js';
import { gameSettings, saveSettings, DIFFICULTY_ORDER } from '../data/settings.js';
import { sound } from '../systems/SoundManager.js';
import { clearSave } from '../data/save.js';
import { deserializeChapterDebuffs } from '../data/stageDebuffs.js';

// === 다크 판타지 골드/검정 통일 팔레트 (메뉴/스테이지 화면과 일관) ===
const PALETTE = {
  bgBlack: 0x000000,
  bgDark: 0x1A1A1F,
  bgPanel: 0x14141A,
  goldBright: 0xC5A059,
  goldDark: 0x8B7355,
  textPrimary: 0xE8E8E8,
  textSecondary: 0x9A9AA2,
  textMuted: 0x6A6A72,
  red: 0xC5404A,
  redDark: 0x6A2025,
  green: 0x2EB87A,
  borderLight: 0x4A4A50,
  borderGold: 0xC5A059,
};
// 텍스트용 hex string 변환 헬퍼
const hex = (n) => '#' + n.toString(16).padStart(6, '0').toUpperCase();

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // 모든 캐릭터 PNG 로드 — Phaser 텍스처 키 = 파일명(공백 포함)
    ALL_SPRITES.forEach(name => {
      this.load.image(name, `sprites/${name}.png`);
    });
    // 플레이어 / 폴백 잡몹 별칭 (Player.js 와 Enemy.js 의 기본 키 호환용)
    this.load.image('player', `sprites/${PLAYER_SPRITE}.png`);
    this.load.image('enemy',  'sprites/슬라임.png');
    // 스테이지별 배경 10장
    for (let i = 1; i <= 10; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image(`bg_stage_${n}`, `sprites/backgrounds/bg_stage_${n}.png`);
    }
    // [Phase P-54] 7대죄 픽셀 아이콘 — 파일 있을 때만 로드 (없으면 emoji 폴백).
    //   파일 경로: public/sprites/sins/{wrath,greed,sloth,pride,lust,envy,gluttony}.png
    ['wrath', 'greed', 'sloth', 'pride', 'lust', 'envy', 'gluttony'].forEach(k => {
      this.load.image(`sin_${k}`, `sprites/sins/${k}.png`);
    });
    // 다이아 / 골드 픽셀 아이콘 (이모지 대체).
    this.load.image('icon-diamond', 'sprites/icons/diamond-icon.png');
    this.load.image('icon-gold',    'sprites/icons/gold-icon.png');
    // 파일 없을 때 로더가 오류 던지지 않도록 — 단순 무시.
    this.load.on('loaderror', (file) => {
      if (file.key && file.key.startsWith('sin_')) {
        // 조용히 무시 — PickedCardsStrip 가 textures.exists 체크로 폴백 처리.
      }
    });
  }

  create(data) {
    // [Phase P-2] sprite 텍스처 NEAREST 필터 적용 (도트 모양 보존). pixelArt: false 로 전환됨.
    applyNearestToPixelTextures(this);
    // [P-59 1차] 글로벌 터치 피드백 — Ripple 만.
    attachTouchFeedback(this);
    // 씬 재진입 시 상태 초기화
    this.cardSelectionActive = false;
    this.gameOverActive = false;
    this.cardsPopupActive = false;
    this.itemsPopupActive = false;
    this.pauseMenuActive = false;
    this.bossIntroActive = false; // 보스 등장 연출 중일 때 게임 일시정지
    this.cardFlowMode = null;     // 'wave-end' | 'mid-combat' (어떤 진입경로인지)
    // newGame 플래그가 true면 절대 savedGame 로드하지 않음 (방어)
    const isNewGame = !!(data && data.newGame);
    this.savedGame = (!isNewGame && data && data.savedGame) ? data.savedGame : null;
    // 테스트 모드 — 특정 스테이지로 시작 (모든 스테이지 잠금해제 클릭 시)
    this._startStageOverride = (data && data.startStage) ? data.startStage : null;

    // === 부품 조립 ===
    // [Phase P-19] Player x 75 → 235 (옵션 C 가운데 정렬, 거리 810 보존).
    this.player = new Player(this, 235, 446);
    this.combatSystem = new CombatSystem(this, this.player);
    this.waveSystem = new WaveSystem(this, this.player, this.combatSystem);
    this.bossDebuffSystem = new BossDebuffSystem(this, this.player);

    // === 배경 — [Phase P-50b] TileSprite 가로 무한 반복 + 카메라 X scrollX 동기화 ===
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const initialStage = (data && data.startStage) ? data.startStage : 1;
    const bgKey = this._bgKeyFor(initialStage);
    // [Phase P-50b 후속] tileSprite 폭 W+4 (우측 끝 픽셀 jaggy 방지 안전 마진).
    this._bgImage = this.add.tileSprite(0, 0, W + 4, H, bgKey)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-100);
    // 원본 PNG 가 W×H 와 다른 비율이라 setTileScale 로 한 타일을 화면 크기에 맞춤.
    const _bgTex = this.textures.get(bgKey);
    const _bgSrc = _bgTex && _bgTex.getSourceImage && _bgTex.getSourceImage();
    if (_bgSrc && _bgSrc.width && _bgSrc.height) {
      this._bgImage.setTileScale(W / _bgSrc.width, H / _bgSrc.height);
    }

    // === [Phase P-54 revert] UI 카메라 시도 → Phaser 4 호환 이슈로 보류. ===
    // markAsUI 헬퍼는 noop 으로 남겨서 (UI 코드가 호출해도 안전).
    this.markAsUI = () => {};

    // === [무한 맵] 카메라 follow + deadzone + bounds (Y 고정, X = 맵 길이) ===
    const cam = this.cameras.main;
    // bounds: 맵 시작 (player.x 시작 - W/2 정도 여유) ~ 맵 끝 (player.x + 8000 + W/2 여유).
    //   사용자가 우측 메인보스 까지 진행 후 멈춤. 좌측 / 우측 영원히 진행 X.
    const MAP_LENGTH = 8000;
    // ⭐ 챕터 2 = 웨이브 모드 (플레이어가 달려가 처치). 카메라 follow 는 기존과 동일.
    this._arenaMode = ((gameSettings && gameSettings.difficulty) === STAR_CHAPTER);
    cam.setBounds(-W / 2, 0, MAP_LENGTH + W, H);
    // startFollow(target, roundPixels, lerpX, lerpY) — Y lerp 0 으로 Y 잠금.
    cam.startFollow(this.player.sprite, true, 1.0, 0);
    // 좌측 1/3 위치 — 카메라 중심이 플레이어보다 W/6 만큼 우측.
    cam.setFollowOffset(-W / 6, 0);
    // deadzone 60×400 — 작은 움직임 무시.
    cam.setDeadzone(60, 400);

    // ⭐ 챕터 2 — 달리기 모션 기준 Y 저장 (상하 바운스용).
    if (this._arenaMode) {
      this._playerBaseY = (this.player && this.player.sprite) ? this.player.sprite.y : 0;
    }

    // ⭐ 챕터 2 아레나 — 상단 WAVE 카운터 (진행바 대체).
    if (this._arenaMode) {
      this._arenaWaveText = this.add.text(W * 0.5, 22, '', {
        fontFamily: FONT, fontSize: '20px', color: '#FFD166', fontStyle: '900', letterSpacing: 2,
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1500);
      this._arenaWaveText.setShadow(0, 2, '#000000', 4, false, true);
      this.events.on('arena-wave', ({ wave, total, boss }) => {
        if (!this._arenaWaveText || !this._arenaWaveText.scene) return;
        this._arenaWaveText.setText(boss ? '◆ BOSS WAVE ◆' : `WAVE ${wave} / ${total}`);
        this._arenaWaveText.setColor(boss ? '#FF6B6B' : '#FFD166');
        this.tweens.add({
          targets: this._arenaWaveText, scale: { from: 1.25, to: 1 },
          duration: 320, ease: 'Back.easeOut',
        });
      });
    }

    // === UI ===

    // 화면 외곽 금속 프레임 + 코너 못 — 제거 (글래스 톤과 충돌)
    // this._buildScreenFrame();

    // 비네팅 (가장자리 어둡게 그라디언트) — 제거. 외곽 회색 1px 라인의 원인이었음.
    // 외곽선 / 골드 못 (_buildScreenFrame) 도 이미 주석 처리됨.

    // === HUD — TopBar 가 좌상단 박스 2개 + 상단 가운데 + 콤보 배지 + 우상단 5 아이콘 + 미니 패널 모두 담당 ===
    this._hudDepth = 10;
    this._gameSpeed = 1;
    this.topBar = new TopBar(this, {
      onShowCards:     () => this.showPickedCards(),
      onShowInventory: () => this.showInventory(),
      onShowEquip:     () => this.showEquipmentModal(),
      onShowMenu:      () => this.showPauseMenu(),
      // 옛 onToggleSpeed 폐기 (배속 시스템 제거됨).
      onShowBag:       () => this.showInventory(),
    });
    // [무한 맵] 진행도 바 UI — 화면 상단 막대 + 캐릭터/보스/NPC 마커.
    this._createProgressBar();
    // [무한 맵] 콤보 플로팅 — 플레이어 sprite 위 (월드 좌표).
    this.comboFloat = new ComboFloat(this, this.player);
    // [Phase P-54] 우하단 기본 물약 슬롯 (원형 + 쿨다운).
    this.potionSlotPanel = new PotionSlotPanel(this);
    // [Phase P-54] 우측 보유 카드 세로 띠 — 인게임 항상 표시 (클릭 시 보유 카드 모달).
    this.pickedCardsStrip = new PickedCardsStrip(this);
    // [Phase P-54] 활성 버프/디버프 띠 — 상단 가운데, 영약/부적/이벤트 효과 표시.
    this.buffStrip = new BuffStrip(this);

    // === Scene shutdown 정리 ===
    // restart / 다른 scene 으로 전환 시 UI 컴포넌트들의 update 리스너가 새 scene 으로 누수되지 않도록.
    // 각 컴포넌트는 destroy() 안에서 events.off 처리하므로 명시 호출만 보장.
    this.events.once('shutdown', () => {
      try { if (this.buffStrip)        this.buffStrip.destroy?.(); } catch {}
      try { if (this.pickedCardsStrip) this.pickedCardsStrip.destroy?.(); } catch {}
      try { if (this.potionSlotPanel)  this.potionSlotPanel.destroy?.(); } catch {}
      try { if (this.topBar)           this.topBar.destroy?.(); } catch {}
      try { if (this.comboFloat)       this.comboFloat.destroy?.(); } catch {}
      // Player 도 자체 update 리스너 보유 — scene.events 가 곧 파괴되므로 자동 정리되지만 명시 off.
      try {
        if (this.player && this.player._tickTimedBuffs) {
          this.events.off('update', this.player._tickTimedBuffs, this.player);
        }
      } catch {}
    });
    this.events.removeAllListeners('cards-changed');
    this.events.on('cards-changed', () => {
      if (this.pickedCardsStrip) this.pickedCardsStrip.refresh();
    });

    // === 이벤트 연결 ===
    // 씬 재진입 시 누적 방지를 위해 먼저 제거
    this.events.removeAllListeners('show-card-selection');
    this.events.removeAllListeners('show-shop');
    this.events.removeAllListeners('player-level-up');
    this.events.removeAllListeners('game-clear');
    this.events.removeAllListeners('game-over');
    this.events.removeAllListeners('stage-changed');
    this.events.removeAllListeners('stage-advanced');
    this.events.removeAllListeners('boss-spawned');
    this.events.removeAllListeners('toast');

    // 장비 셀 툴팁 — 다른 곳 클릭 시 자동 닫기 (등록된 셀이나 툴팁 자체 외 클릭)
    this._tooltipCellBgs = [];
    this._badgeBgs = [];
    this.input.on('pointerdown', (pointer, gameObjects) => {
      if (this._itemTooltipForId) {
        const onTrigger = gameObjects.some(o => this._tooltipCellBgs.includes(o));
        if (!onTrigger) this._clearItemTooltip();
      }
      if (this._badgeTooltipForId) {
        const onBadge = gameObjects.some(o => this._badgeBgs.includes(o));
        if (!onBadge) this._clearBadgeTooltip();
      }
    });

    // 가방 사용 배지 — 좌측 사이드에 누적 표시
    this._usedBagBadges = [];
    this._badgeElements = [];
    this._badgeTooltipElements = [];
    this._badgeTooltipForId = null;

    // (스테이지 변경 시 배경 재구성 제거 — PNG 배경 사용)

    // 스테이지 클리어 (보스 처치 + 카드/상점 끝) → 맵으로 복귀
    // 명시적으로 newGame: false 를 넘겨야 함 — Phaser 의 scene.start 가 data 미지정 시
    // 이전 호출 시 받은 data 를 재사용하기 때문에, 메뉴에서 "새 게임"으로 들어왔다면
    // { newGame: true } 가 살아남아 세이브가 무시되는 버그 발생
    this.events.on('stage-advanced', (stage) => {
      console.log('[stage] stage-advanced received → start StageScene, target stage=', stage);
      this.scene.start('StageScene', { newGame: false });
    });

    // [무한 맵] 스테이지 클리어 — 메인보스 처치 시 emit. 세련된 클리어 모달 표시.
    this.events.removeAllListeners('stage-cleared');
    this.events.on('stage-cleared', (stage, starInfo) => {
      console.log('[stage] stage-cleared:', stage, '→ show stage clear modal', starInfo);
      // 1.2s wait — 처치 모션 끝나고 화면 안정 후 모달
      this.time.delayedCall(1200, () => {
        // 1.2s 사이 게임오버 발생 (반격/도트) 시 클리어 모달 X — 게임오버 화면 우선.
        if (this.gameOverActive) return;
        this.showStageClear(stage, starInfo);
      });
    });

    // 보스 등장 연출 — 영화적 (메인/서브 차별)
    this.events.on('boss-spawned', (data) => this.showBossIntro(data));

    // 콤보/킬버프 타이머는 scene.time.now 기반 — Modal.js + EventNode._pauseGame 가 이미
    //   scene.time.paused=true 설정 → 자동 동결. 옛 modal-opened/closed save/restore 불필요.

    // [Phase P-44b 후속 4 긴급 fix] 카드픽 큐 시스템 제거 — 옛 흐름 복원.
    //   옛 큐가 _activeModal 잔재 / modal-closed 이벤트 누락 시 stuck → 1웨 클리어 후 advance/카드픽 X.
    //   시너지 모달 + 카드픽 동시 발생 케이스: showCardSelection 의 createModal 가 _activeModal
    //   자동 강제 close (옛 룰) — 시너지 모달 자동 닫히고 카드픽 표시.
    this.events.on('show-card-selection', () => {
      if (!this.cardFlowMode) this.cardFlowMode = 'wave-end';
      this.showCardSelection();
    });
    this.events.on('show-shop', () => this.showShop());

    // 전투 중 레벨업 → 즉시 카드 모달
    this.events.on('player-level-up', () => {
      // 보스 인트로 / 이벤트 모달 / 일시정지 메뉴 / 액티브 모달 위에 카드픽 스택 방지.
      if (this.cardSelectionActive || this.cardsPopupActive || this.gameOverActive
          || this.bossIntroActive || this.eventModalActive || this.pauseMenuActive
          || (this._activeModal && !this._activeModal._closed)) {
        // 핸들러 종료 후 재시도 — pendingLevelUps 그대로 두면 카드픽 closure 가 자동 처리.
        this.time.delayedCall(500, () => this.events.emit('player-level-up'));
        return;
      }
      this.cardFlowMode = 'mid-combat';
      this.showCardSelection();
    });

    this.events.on('game-clear', (unlocked) => this.showGameClear(unlocked));
    this.events.on('game-over',  () => this.showGameOver());
    this.events.on('toast',      (msg)      => this._showToast(msg));

    // === BGM — 일반 전투 트랙 시작 (음원 파일 누락 시 silent) ===
    sound.playBgm(this, 'game_normal');

    // === 게임 시작 ===
    if (this.savedGame) {
      this.restoreFromSave(this.savedGame);
      // [무한 맵] 이어하기 / 다음 스테이지 진입 시 pendingLevelUps > 0 이면 자동 카드픽.
      //   이전 메인보스 처치 EXP 로 인한 레벨업 카드픽이 클리어 모달에 가려져 못 뜬 케이스.
      this.time.delayedCall(400, () => {
        if (this.player.pendingLevelUps > 0) {
          this.cardFlowMode = 'wave-end';
          this.events.emit('show-card-selection');
        }
      });
    } else {
      this.waveSystem.startFirstWave();
      // 테스트 모드 — 특정 스테이지 시작 옵션
      if (this._startStageOverride && this._startStageOverride > 1 && this._startStageOverride <= 10) {
        this.waveSystem.currentStage = this._startStageOverride;
        // 옛 적 / NPC 정리 + 새 stage 진입
        if (this.waveSystem.enemies) {
          this.waveSystem.enemies.forEach(e => { if (e.sprite) e.sprite.destroy(); });
        }
        this.waveSystem.enemies = [];
        this.waveSystem._enterStage();
      }
      // 💎 영구 강화 — 새 게임 시작 시만 1회 적용 (이어하기 시 X — 이미 효과 누적된 상태)
      this._applyDiamondUpgrades();
      // ⚔ 장착 로드아웃 — 다이아 상점에서 산 장비를 슬롯에 장착
      this._applyLoadout();
      // Phase H — 5/10스 새 진입 시 클라이맥스 배너 (이어하기 시엔 X — 이 분기 진입 X)
      const cs = this.waveSystem.currentStage;
      if (cs === 5 || cs === 10) {
        this._showClimaxBanner(cs);
      }
      // [무한 맵] 게임 시작 카드픽 폐기 — 레벨업 시에만 카드픽 (사용자 요청).
    }
    // 테스트 모드 — 새 게임/이어하기 무관 골드 무제한 모사 (구매 시 차감도 스킵)
    if (gameSettings.testMode) {
      this.player.stats.gold = 7777777;
      this.updateInfoText();
    }
  }

  // ⚔ 장착 로드아웃 — Phase P-55 슬롯 강화 시스템.
  //   8 슬롯 각자 Lv 0~10 — getSlotEffect 가 누적 stat delta 반환 → equipment 슬롯에 적용.
  //   장비 잠금 (1챕터 + 데브 OFF) 시 스킵.
  _applyLoadout() {
    if (!isEquipmentUnlocked()) return;
    const levels = getSlotLevels();
    for (const slot of SLOTS) {
      const lv = levels[slot] || 0;
      if (lv <= 0) continue;
      const effect = getSlotEffect(slot, lv);
      // Player.equipItem 호환 인터페이스 사용 — 가짜 item 객체 만들어 효과 적용.
      this.player.equipItem({
        id: `slot-${slot}-lv${lv}`,
        name: `${slot} Lv${lv}`,
        slot, effect, passive: null,
      });
    }
  }

  // 💎 다이아로 구매한 영구 강화를 새 게임 시작 시 적용
  _applyDiamondUpgrades() {
    // 시작 자금 — 골드 +200
    if (isUpgradeOwned('startGold')) {
      this.player.stats.gold = (this.player.stats.gold || 0) + 200;
    }
    // 운명의 첫 카드 — commonCards 에서 무작위 1장 적용 (적용 시 sin 카운트도 자동 ↑)
    if (isUpgradeOwned('startCard') && commonCards.length > 0) {
      const card = commonCards[Math.floor(Math.random() * commonCards.length)];
      this.player.applyCard(card);
      // applyCard는 pendingLevelUps -= 1 을 하지만 새 게임 시 0이라 음수가 됨 — 0으로 보정
      if (this.player.pendingLevelUps < 0) this.player.pendingLevelUps = 0;
    }
    // 수호의 부활석 — 부활권 1개 (특수카드 revive-stone 가방 추가)
    if (isUpgradeOwned('startRevive')) {
      const reviveCard = specialCards.find(c => c.id === 'revive-stone');
      if (reviveCard) {
        this.player.bag = this.player.bag || [];
        this.player.bag.push({
          id: reviveCard.id, name: reviveCard.name, icon: reviveCard.icon,
          type: reviveCard.type, desc: reviveCard.desc,
          price: reviveCard.price, color: reviveCard.color,
          passive: !!reviveCard.passive, onlyInShop: !!reviveCard.onlyInShop,
          use: reviveCard.use,
        });
      }
    }
  }

  // 세이브 데이터로부터 게임 상태 복원
  restoreFromSave(state) {
    // 1) 챕터 시스템 — 1챕터(normal)만 진입 가능. 구 hard/veryHard 세이브는 normal 로 보정.
    gameSettings.difficulty = 'normal';
    saveSettings();

    // 옛 정수 흡혈 시스템 → 새 % 시스템 마이그레이션
    // 이전: lifesteal 1~6 (정수, 처치 시 N HP 회복) / 신: 0.01~0.06 (maxHp 비율)
    // 0.5 초과 = 옛 정수형 → /100 으로 환산
    if (state.stats && state.stats.lifesteal > 0.5) {
      state.stats.lifesteal = state.stats.lifesteal / 100;
    }
    Object.assign(this.player.stats, state.stats);
    // Phase E5 — 다중 source 복원. 새 포맷은 statSources 직접 복원, 옛 포맷은 flat → cards 폴백.
    if (this.player._statSources) {
      if (state.statSources) {
        // 새 포맷
        for (const key of Object.keys(this.player._statSources)) {
          if (state.statSources[key]) {
            Object.assign(this.player._statSources[key], state.statSources[key]);
          }
        }
        // flat stats 재동기화 (sum)
        for (const key of Object.keys(this.player._statSources)) {
          const s = this.player._statSources[key];
          this.player.stats[key] = (s.base || 0) + (s.equipment || 0) + (s.cards || 0) + (s.synergy || 0);
        }
      } else {
        // 옛 포맷 — flat 차이를 cards 슬롯에 통합 (UI breakdown 정확도는 떨어지지만 getStat 정확)
        for (const key of Object.keys(this.player._statSources)) {
          const flat = this.player.stats[key];
          if (flat === undefined) continue;
          const s = this.player._statSources[key];
          const others = (s.base || 0) + (s.equipment || 0) + (s.synergy || 0);
          s.cards = flat - others;
        }
      }
    }
    Object.assign(this.player.skills, state.skills);
    this.player.pendingLevelUps = state.pendingLevelUps || 0;
    // [Phase P-54] 카드 풀 재설계 — 옛 세이브 pickedCards 중 새 풀에 없는 ID 자동 제거.
    //   epic 등급 폐기 + 노말 14→12 / 레어 12→14 / 레전드 10→8 재분배로 옛 ID 다수 무효.
    {
      const raw = state.pickedCards || [];
      const byId = new Map(commonCards.map(c => [c.id, c]));
      // 유효 ID 만 살리고 name/desc/icon 등은 최신 데이터로 갱신 (rename 마이그).
      this.player.pickedCards = raw
        .filter(c => c && c.id && byId.has(c.id))
        .map(saved => {
          const cur = byId.get(saved.id);
          return { ...saved, name: cur.name, desc: cur.desc, icon: cur.icon, rarity: cur.rarity, sin: cur.sin };
        });
      const dropped = raw.length - this.player.pickedCards.length;
      if (dropped > 0) console.log(`[save-migrate] dropped ${dropped} obsolete cards from save`);

      // [Bugfix] 트리거 카드 flag 재활성화 — apply() 가 _xxxActive 플래그 세팅하는데
      //   세이브에 플래그 자체는 안 들어가서 reload 시 flag-카드들이 무효화됨.
      //   stats 스냅샷 → apply() 재호출 → stats 복원 = 플래그만 다시 세팅 (stat 중복 X).
      const statsSnap = { ...this.player.stats };
      const cardsSnap = {};
      for (const k in this.player._statSources) {
        cardsSnap[k] = this.player._statSources[k].cards;
      }
      for (const c of this.player.pickedCards) {
        const cur = byId.get(c.id);
        if (cur && typeof cur.apply === 'function') {
          try { cur.apply(this.player); } catch (e) { console.warn(`[save-migrate] apply failed ${c.id}`, e); }
        }
      }
      // stats 복원 (apply 의 modStat 중복분 되돌리기).
      this.player.stats = statsSnap;
      for (const k in cardsSnap) {
        this.player._statSources[k].cards = cardsSnap[k];
      }
    }
    // 장비 복원 — 잠금 해제 상태에서만 적용. 잠금 상태면 statSources.equipment 도 0 처리 (장비 없는데 stat 잔존 방지).
    // 잠금 해제된 옛 세이브의 equipment 는 _savedEquipmentRaw 에 보존 — 다음 buildSaveState 시 재사용.
    if (state.equipment) {
      if (isEquipmentUnlocked()) {
        Object.assign(this.player.equipment, state.equipment);
      } else {
        this.player._savedEquipmentRaw = state.equipment;   // 보존 — 잠금 풀리면 복원 가능
        if (this.player._statSources) {
          for (const k in this.player._statSources) this.player._statSources[k].equipment = 0;
        }
      }
    }
    // 가방 복원 — id 만 저장됐으므로 specialCards 에서 다시 찾아서 복원
    // 옛 세이브 호환: 'revive-feather' → 'revive-stone' 자동 매핑
    if (state.bag && state.bag.length > 0) {
      this.player.bag = state.bag
        .map(id => (id === 'revive-feather' ? 'revive-stone' : id))
        .map(id => specialCards.find(c => c.id === id))
        .filter(c => !!c)
        .map(c => ({
          id: c.id, name: c.name, icon: c.icon, type: c.type,
          desc: c.desc, price: c.price, color: c.color,
          passive: !!c.passive, onlyInShop: !!c.onlyInShop, use: c.use,
        }));
    }
    this.player.goldMultWaves = state.goldMultWaves || 0;
    this.player.nextCardChoices = state.nextCardChoices || 3;
    this.player.nextBossHpReduce = state.nextBossHpReduce || 0;
    this.player.nextBossFreezeMs = state.nextBossFreezeMs || 0;
    this.player._nextKillsExpMul    = state.nextKillsExpMul || 1;
    this.player._nextKillsExpRemain = state.nextKillsExpRemain || 0;
    this.player.nextCardPickRarityBoost = state.nextCardPickRarityBoost || 0;
    this.player._stageShopRerollsUsed = state.stageShopRerollsUsed || 0;
    // [Phase P-31] 카드 리롤 사용 횟수 (옛 세이브 호환 — 없으면 0 폴백).
    this.player._stageCardRerollsUsed = state.stageCardRerollsUsed || 0;
    // [Phase P-54] 기본 물약 — 쿨다운 영속화 X (스테이지 진입 시 즉시 사용 가능).
    // 옛 세이브 bag 안 potion-* 항목 자동 정리.
    if (Array.isArray(this.player.bag)) {
      this.player.bag = this.player.bag.filter(c => !(c && c.id && c.id.startsWith && c.id.startsWith('potion-')));
    }
    // 휴식 상점 임시 버프 큐 복원 (다음 웨이브에 적용 — 임시 방패 / 무기 강화)
    if (state.queuedBuffs) Object.assign(this.player.queuedBuffs, state.queuedBuffs);
    // 런 통계 복원 — startTime 은 보존 (전체 플레이타임 누적)
    if (state.runStats) Object.assign(this.player.runStats, state.runStats);
    // 7대죄 시너지 복원 — 카운트 / 픽 순서 / 1·2순위 / 단계 / 듀얼
    if (state.sinCounts) Object.assign(this.player.sinCounts, state.sinCounts);
    this.player.pickedCardOrder = state.pickedCardOrder ? [...state.pickedCardOrder] : [];
    // [Phase P-54] 카드 풀 재설계 후 마이그 — sinCounts / pickedCardOrder 를 살아남은 pickedCards 기준으로 재계산.
    //   옛 epic 카드가 제거됐으면 시너지 카운트도 줄어들어야 일관성 유지.
    if (this.player.pickedCards && this.player.pickedCards.length > 0) {
      const recountedSinCounts = {};
      const validIds = new Set(this.player.pickedCards.map(c => c.id));
      // sinCounts 재계산
      for (const c of this.player.pickedCards) {
        if (c && c.sin) recountedSinCounts[c.sin] = (recountedSinCounts[c.sin] || 0) + 1;
      }
      this.player.sinCounts = recountedSinCounts;
      // pickedCardOrder 도 sin 카운트 한계 내로 truncate — 옛 카드 제거 시 stale 엔트리 정리.
      //   예: order [wrath, wrath, wrath] 인데 마이그 후 wrath count = 2 면 마지막 wrath 제거.
      if (Array.isArray(this.player.pickedCardOrder)) {
        const seen = {};
        this.player.pickedCardOrder = this.player.pickedCardOrder.filter((sin) => {
          const cap = recountedSinCounts[sin] || 0;
          seen[sin] = (seen[sin] || 0) + 1;
          return seen[sin] <= cap;
        });
      }
    }
    this.player.activeSin    = state.activeSin    || null;
    this.player.secondarySin = state.secondarySin || null;
    this.player.synergyTier  = state.synergyTier  || 0;
    this.player.dualActive   = !!state.dualActive;
    this.player.dualSinKey   = state.dualSinKey   || null;
    // 시너지 효과 추적 복원 — stats 는 이미 반영된 상태이므로 _applySynergyEffect 재호출 X.
    // 옛 세이브 (필드 없음) 인 경우 빈 배열 유지.
    this.player._appliedSynergyEffects = Array.isArray(state.appliedSynergyEffects)
      ? state.appliedSynergyEffects.map(e => ({ effectId: e.effectId, payload: { ...(e.payload || {}) } }))
      : [];

    // 웨이브 시스템 복원
    this.waveSystem.currentStage = state.stage;
    // [Phase P-52] wave 항상 1 — 저장은 스테이지 클리어 시점만, 진행 중 종료 시 해당 스테이지 W1 부터.
    this.waveSystem.currentWave = 1;
    // Phase G — 챕터 디버프 복원 (id 배열 → 객체 배열). 누락 시 새로 추첨.
    if (Array.isArray(state.chapterDebuffs) && state.chapterDebuffs.length > 0) {
      this.waveSystem._chapterDebuffs = deserializeChapterDebuffs(state.chapterDebuffs);
    }
    this.waveSystem._ensureChapterDebuffs();
    this.waveSystem._stageUsedBossIds = new Set();
    this._setBgForStage(state.stage);
    // [무한 맵] 옛 spawnWave → _enterStage (적 / NPC 미리 배치).
    this.waveSystem._enterStage();
    // ShopNPC visited 복원 — 미저장 시 익스플로잇 (mid-stage 재로드 → 매점 재진입).
    if (Array.isArray(state.shopNpcs) && this.waveSystem.shopNpcs) {
      state.shopNpcs.forEach((saved, i) => {
        if (saved && this.waveSystem.shopNpcs[i]) {
          this.waveSystem.shopNpcs[i].visited = !!saved.visited;
        }
      });
    }
  }

  // === 스테이지 번호 → 배경 텍스처 키 ===
  _bgKeyFor(stage) {
    const s = Math.min(10, Math.max(1, stage | 0));
    return `bg_stage_${String(s).padStart(2, '0')}`;
  }
  _setBgForStage(stage) {
    if (!this._bgImage) return;
    const key = this._bgKeyFor(stage);
    this._bgImage.setTexture(key);
    // [Phase P-50b] 새 텍스처 크기에 맞춰 tileScale 재계산.
    const tex = this.textures.get(key);
    const src = tex && tex.getSourceImage && tex.getSourceImage();
    if (src && src.width && src.height) {
      const W = this.cameras.main.width, H = this.cameras.main.height;
      this._bgImage.setTileScale(W / src.width, H / src.height);
    }
  }

  update(time, delta) {
    // [Phase P-50b 후속] 배경 무한 시각 — tilePositionX 는 텍스처 원본 픽셀 단위라
    //   setTileScale 사용 시 tileScaleX 로 보정해야 우측 끝 잘림 / 띠 안 생김.
    if (this._bgImage && this.cameras && this.cameras.main) {
      const sx = this._bgImage.tileScaleX || 1;
      this._bgImage.tilePositionX = this.cameras.main.scrollX / sx;
    }
    // 일시정지/카드 선택/게임오버/보스 등장 연출/이벤트 모달일 때 멈춤
    if (this.cardSelectionActive || this.gameOverActive || this.pauseMenuActive || this.bossIntroActive || this.eventModalActive) {
      if (this.player && this.player.stop) this.player.stop();
      if (this.waveSystem && this.waveSystem.enemies) {
        for (const e of this.waveSystem.enemies) {
          if (e.stopMoving) e.stopMoving();
        }
      }
      return;
    }

    this.combatSystem.update(time, delta);
    // combat에서 game-over가 발생했으면 같은 프레임 추가 업데이트 스킵
    if (this.gameOverActive) return;

    // 포션 쿨다운 감산 (일시정지/모달 가드 위에 있어 paused 시 멈춤).
    if (this.player && this.player.tickPotionCd) this.player.tickPotionCd(delta);

    this.waveSystem.update();
    if (this.bossDebuffSystem) this.bossDebuffSystem.update(delta);
    // Phase 3 시너지 트리거 (시간 누적 + 임시 버프 만료 + 5초 카운터)
    if (this.player && this.player._updateSynergyTriggers) {
      this.player._updateSynergyTriggers(time);
    }
    if (this._arenaMode) this._arenaJuiceUpdate(time);
    this.player.updateHpDisplay();
    this.updateInfoText();
    this._updateProgressBar();
  }

  // ⭐ 챕터 2 전용 — 달리기 모션 (상하 바운스 + 발밑 먼지). 시각 효과만, 좌표 로직 무영향.
  _arenaJuiceUpdate(time) {
    const sp = this.player && this.player.sprite;
    if (!sp) return;
    const vx = (sp.body && sp.body.velocity) ? sp.body.velocity.x : 0;
    const running = Math.abs(vx) > 5;
    const baseY = (this._playerBaseY != null) ? this._playerBaseY : sp.y;
    if (running) {
      sp.y = baseY + Math.sin(time * 0.025) * 4;     // 달리는 상하 바운스
      if (time - (this._lastRunDustAt || 0) > 100) { // 발밑 먼지 puff
        this._lastRunDustAt = time;
        this._spawnRunDust(sp.x - 16, baseY + 30);
      }
    } else {
      sp.y = baseY;
    }
  }

  _spawnRunDust(x, y) {
    const dust = this.add.circle(x, y, Phaser.Math.Between(3, 5), 0xCBB892, 0.5).setDepth(5);
    this.tweens.add({
      targets: dust, x: x - 28, y: y - 6, alpha: 0, scale: 0.3,
      duration: 420, ease: 'Cubic.easeOut', onComplete: () => dust.destroy(),
    });
  }

  // === [무한 맵] 진행도 바 UI — 미니멀 ===
  _createProgressBar() {
    if (this._arenaMode) return;   // ⭐ 챕터 2 아레나 — 진행바 대신 WAVE 카운터 사용.
    const W = this.scale.width;
    const cx = W / 2;
    const y = 72;
    const barW = W * 0.5;
    const barH = 3;     // 얇은 라인
    this._pbBarX = cx - barW / 2;
    this._pbBarW = barW;
    this._pbBarY = y;

    // 얇은 베이스 라인 — 단색
    this._pbBg = this.add.graphics().setDepth(12).setScrollFactor(0);
    this._pbBg.fillStyle(0xFFFFFF, 0.15);
    this._pbBg.fillRect(this._pbBarX, y, barW, barH);

    // 진행 채움 (좌측~플레이어)
    this._pbFill = this.add.graphics().setDepth(12).setScrollFactor(0);

    // 마커 placeholder — _setupProgressBarMarkers 에서 생성.
    this._pbPlayerMarker = null;
    this._pbSubBossMarkers = [];
    this._pbMainBossMarker = null;
    this._pbNpcMarkers = [];
    this._pbPlayerTargetX = null;  // lerp 목표 X

    this.time.delayedCall(50, () => this._setupProgressBarMarkers());
  }

  _setupProgressBarMarkers() {
    if (this._arenaMode) return;   // ⭐ 챕터 2 아레나 — 진행바 마커 없음.
    if (!this.waveSystem || !this.waveSystem.getStageInfo) return;
    const info = this.waveSystem.getStageInfo();

    // 옛 마커 정리
    if (this._pbPlayerMarker) { this._pbPlayerMarker.destroy(); this._pbPlayerMarker = null; }
    this._pbSubBossMarkers.forEach(m => m && m.destroy());
    this._pbSubBossMarkers = [];
    if (this._pbEliteBossMarker) { this._pbEliteBossMarker.destroy(); this._pbEliteBossMarker = null; }
    if (this._pbMainBossMarker) { this._pbMainBossMarker.destroy(); this._pbMainBossMarker = null; }
    this._pbNpcMarkers.forEach(m => m && m.destroy());
    this._pbNpcMarkers = [];

    const posToX = (worldX) => {
      const mapLen = info.mapEndX - info.mapStartX;
      const ratio = Math.max(0, Math.min(1, (worldX - info.mapStartX) / mapLen));
      return this._pbBarX + ratio * this._pbBarW;
    };
    const my = this._pbBarY + 1.5;  // 라인 가운데

    // 서브보스 — 작은 빨강 점
    info.subBosses.forEach(sb => {
      const m = this.add.circle(posToX(sb.x), my, 3.5, 0xDC2626).setDepth(13).setScrollFactor(0);
      this._pbSubBossMarkers.push(m);
    });

    // [Phase P-54] 정예 보스 — 보라 점 (서브와 메인 사이 단계)
    if (info.eliteBoss) {
      this._pbEliteBossMarker = this.add.circle(posToX(info.eliteBoss.x), my, 4.5, 0xA855F7).setDepth(14).setScrollFactor(0);
    }

    // 메인보스 — 약간 큰 빨강 점
    if (info.mainBoss) {
      this._pbMainBossMarker = this.add.circle(posToX(info.mainBoss.x), my, 5, 0xFF4444).setDepth(14).setScrollFactor(0);
    }

    // NPC — 작은 골드 점
    info.shopNpcs.forEach(npc => {
      const m = this.add.circle(posToX(npc.x), my, 3, 0xFFD166).setDepth(13).setScrollFactor(0);
      this._pbNpcMarkers.push(m);
    });

    // 플레이어 — 작은 흰 점 (가장 잘 보이게)
    const px = posToX(info.playerX);
    this._pbPlayerMarker = this.add.circle(px, my, 4, 0xFFFFFF).setDepth(16).setScrollFactor(0);
    this._pbPlayerTargetX = px;
  }

  _updateProgressBar() {
    if (!this.waveSystem || !this.waveSystem.getStageInfo) return;
    if (!this._pbPlayerMarker) return;
    const info = this.waveSystem.getStageInfo();
    const mapLen = info.mapEndX - info.mapStartX;
    if (mapLen <= 0) return;
    const posToX = (worldX) => {
      const ratio = Math.max(0, Math.min(1, (worldX - info.mapStartX) / mapLen));
      return this._pbBarX + ratio * this._pbBarW;
    };

    // 플레이어 위치 — lerp 부드럽게
    const targetX = posToX(info.playerX);
    const curX = this._pbPlayerMarker.x;
    const newX = curX + (targetX - curX) * 0.2;
    this._pbPlayerMarker.x = newX;

    // 진행 채움 — 좌측 ~ 플레이어 (얇은 흰 라인)
    if (this._pbFill) {
      this._pbFill.clear();
      const fillW = newX - this._pbBarX;
      if (fillW > 0) {
        this._pbFill.fillStyle(0xFFFFFF, 0.5);
        this._pbFill.fillRect(this._pbBarX, this._pbBarY, fillW, 3);
      }
    }

    // 서브보스 alive 색
    info.subBosses.forEach((sb, i) => {
      const m = this._pbSubBossMarkers[i];
      if (m) m.setFillStyle(sb.alive ? 0xDC2626 : 0x3A3A3A);
    });
    if (info.eliteBoss && this._pbEliteBossMarker) {
      this._pbEliteBossMarker.setFillStyle(info.eliteBoss.alive ? 0xA855F7 : 0x3A3A3A);
    }
    if (info.mainBoss && this._pbMainBossMarker) {
      this._pbMainBossMarker.setFillStyle(info.mainBoss.alive ? 0xFF4444 : 0x3A3A3A);
    }
    info.shopNpcs.forEach((npc, i) => {
      const m = this._pbNpcMarkers[i];
      if (m) m.setFillStyle(npc.visited ? 0x4A4A4A : 0xFFD166);
    });
  }

  // === 정보 표시 갱신 — TopBar.updateAll 한 번 호출로 통합 ===
  updateInfoText() {
    if (!this.topBar) return;
    const s = this.player.stats;
    const info = this.waveSystem.getStageInfo();

    // 콤보 상태 계산 (흡혈 처치 콤보 활성 중일 때만 visible)
    const now = this.time && this.time.now ? this.time.now : 0;
    const comboActive = this.player.killStreakCount > 0 && now < this.player.killStreakEndTime;
    const comboRemaining = comboActive ? ((this.player.killStreakEndTime - now) / 1000).toFixed(1) : 0;
    if (!comboActive && this.player.killStreakCount > 0) this.player.killStreakCount = 0;

    const equippedCount = SLOTS ? SLOTS.filter(k => this.player.equipment[k]).length : 0;

    // [무한 맵] ComboFloat — 플레이어 위 floating 콤보 UI.
    if (this.comboFloat) {
      this.comboFloat.update({
        active: comboActive,
        count: this.player.killStreakCount,
        remainingSec: parseFloat(comboRemaining),
        totalSec: 5,
      });
    }

    this.topBar.updateAll({
      stats: s,
      stageInfo: info,
      combo: { active: comboActive, count: this.player.killStreakCount, remainingSec: comboRemaining },
      counts: {
        bag:   this.player.bag ? this.player.bag.length : 0,
        equip: equippedCount,
        cards: this.player.pickedCards ? this.player.pickedCards.length : 0,
        speed: this._gameSpeed,
      },
      synergy: {
        counts:     this.player.sinCounts    || {},
        active:     this.player.activeSin    || null,
        secondary:  this.player.secondarySin || null,
        dualActive: !!this.player.dualActive,
      },
    });
  }

  // 보스 등장 연출 — 본체는 ui/CombatFX.js 로 분리, 이벤트 리스너 호환용 wrapper
  showBossIntro(data) { fxShowBossIntro(this, data); }

  // === 카드 선택 모달 — 본체는 ui/InventoryModals.js (등급 가중치 헬퍼 포함) ===
  showCardSelection() { fxShowCardSelection(this); }

  // 아이템 등급 — 가격 기반 (커먼/언커먼/레어/에픽/전설), rank: 비교용 1~5
  itemTier(price) {
    if (price <= 40)  return { name: '커먼',   hex: '#94A3B8', color: 0x94A3B8, rank: 1 };
    if (price <= 90)  return { name: '언커먼', hex: '#34D399', color: 0x34D399, rank: 2 };
    if (price <= 140) return { name: '레어',   hex: '#60A5FA', color: 0x60A5FA, rank: 3 };
    if (price <= 240) return { name: '에픽',   hex: '#C084FC', color: 0xC5A059, rank: 4 };
    return                    { name: '전설',   hex: '#FFB300', color: 0xFFB300, rank: 5 };
  }

  // [무한 맵] toggleGameSpeed / 배속 시스템 폐기 — 호출처 X.

  // === 토스트 — 화면 상단 중앙, 1.5초 페이드 (Phase C) ===
  // [Phase P-19] cx 480 → 동적 (캔버스 1280 가운데 = 640).
  _showToast(msg) {
    if (!msg) return;
    const cx = (this.scale && this.scale.width || 1280) / 2;
    const cy = 90;
    // 큐 — 동시 다중 토스트 시 아래로 쌓아서 표시
    if (!this._toastStack) this._toastStack = [];
    const offsetY = this._toastStack.length * 28;

    const t = this.add.text(cx, cy + offsetY, msg, {
      fontFamily: FONT, fontSize: '20px', color: '#F1F5F9', fontStyle: '700',
      backgroundColor: '#000000A8',
      padding: { x: 12, y: 6 },
      align: 'center',
      wordWrap: { width: 720, useAdvancedWrap: true },   // 긴 한글 메시지 오버플로 방지
    }).setOrigin(0.5).setDepth(2000).setScrollFactor(0);
    t.setShadow(1, 1, '#000000', 2, false, true);
    t.setAlpha(0);

    this._toastStack.push(t);
    this.tweens.add({ targets: t, alpha: 1, duration: 150, ease: 'Sine.easeOut' });
    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets: t, alpha: 0, y: t.y - 8, duration: 300, ease: 'Sine.easeIn',
        onComplete: () => {
          t.destroy();
          if (this._toastStack) {
            const i = this._toastStack.indexOf(t);
            if (i !== -1) this._toastStack.splice(i, 1);
          }
        },
      });
    });
  }

  // === Phase H — 클라이맥스 배너 (5스 / 10스 새 진입 시 1.5초) ===
  // 페이드 인 (300ms) → 1.2s 표시 → 페이드 아웃 (300ms). 이어하기 시엔 호출 X.
  _showClimaxBanner(stage) {
    const isStage5 = stage === 5;
    const bgColor   = isStage5 ? 0x8B0000 : 0xFFD700;
    const bgAlpha   = isStage5 ? 0.92    : 0.95;
    const titleClr  = isStage5 ? '#FFFFFF' : '#1A1A1A';
    const subClr    = isStage5 ? '#F1F5F9' : '#3F3F44';
    const titleStr  = isStage5 ? '⚔  대 전 투  ⚔' : '👑 최 종 결 전 👑';
    const subStr    = `스테이지 ${stage} · 10 웨이브 / 서브보스 2`;

    // [Phase P-19] W=960/H=540 → 동적 scale.width/height (캔버스 1280×600 정합).
    const W = this.scale.width, H = this.scale.height;
    // [Phase P-50b] 클라이맥스 배너 — 화면 고정.
    const bg = this.add.rectangle(W / 2, H / 2, W, H, bgColor, bgAlpha).setDepth(2500).setScrollFactor(0);
    const top = this.add.rectangle(W / 2, H / 2 - 40, W * 0.85, 2, isStage5 ? 0xFFFFFF : 0x000000, 0.9).setDepth(2501).setScrollFactor(0);
    const bot = this.add.rectangle(W / 2, H / 2 + 40, W * 0.85, 2, isStage5 ? 0xFFFFFF : 0x000000, 0.9).setDepth(2501).setScrollFactor(0);
    const titleTxt = this.add.text(W / 2, H / 2 - 8, titleStr, {
      fontFamily: FONT, fontSize: '40px', color: titleClr, fontStyle: '900',
    }).setOrigin(0.5).setDepth(2502).setScrollFactor(0);
    const subTxt = this.add.text(W / 2, H / 2 + 22, subStr, {
      fontFamily: FONT, fontSize: '19px', color: subClr, fontStyle: '600',
    }).setOrigin(0.5).setDepth(2502).setScrollFactor(0);
    titleTxt.setShadow(2, 2, '#000000', 4, true, true);
    subTxt.setShadow(1, 1, '#000000', 2, false, true);

    const all = [bg, top, bot, titleTxt, subTxt];
    all.forEach(el => el.setAlpha(0));

    // 페이드 인 → 1.2s 표시 → 페이드 아웃
    this.tweens.add({
      targets: all, alpha: { from: 0, to: 1 }, duration: 300, ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(1200, () => {
          this.tweens.add({
            targets: all, alpha: 0, duration: 300, ease: 'Sine.easeIn',
            onComplete: () => all.forEach(el => el.destroy()),
          });
        });
      },
    });
  }

  // === 가방 사용 배지 — 좌측 사이드 누적 표시 ===
  _addUsedBagBadge(card) {
    if (!this._usedBagBadges) this._usedBagBadges = [];
    // 최대 10개까지 — 그 이상은 오래된 것 제거 (FIFO)
    this._usedBagBadges.push({
      id: card.id, name: card.name, desc: card.desc, color: card.color || 0x9D6FE0,
    });
    if (this._usedBagBadges.length > 10) this._usedBagBadges.shift();
    this._renderUsedBagBadges();
  }

  _renderUsedBagBadges() {
    if (this._badgeElements) this._badgeElements.forEach(e => e && e.destroy && e.destroy());
    this._badgeElements = [];
    this._badgeBgs = [];
    // [BUGFIX] 좌측 상단 (16, 110) 은 TopBar stat 박스 영역과 겹침.
    //   우측 상단 우상단 아이콘바 (5 아이콘 = 우측 끝 ~ 60) 아래로 이동.
    const W = (this.scale && this.scale.width) || 1280;
    const x = W - 180, startY = 60, cellH = 30;
    this._usedBagBadges.forEach((b, i) => {
      const y = startY + i * cellH;
      const dot = this.add.circle(x + 12, y, 11, b.color, 0.92).setDepth(20).setScrollFactor(0);
      dot.setStrokeStyle(1, 0xffffff, 0.45);
      dot.setInteractive({ useHandCursor: true });
      dot.on('pointerdown', () => this._showBagBadgeInfo(b, x + 12, y));
      const lbl = this.add.text(x + 30, y, b.name, {
        fontFamily: FONT, fontSize: '12px', color: '#CBD5E1',
        fontStyle: '600', backgroundColor: '#0008', padding: { x: 4, y: 2 },
      }).setOrigin(0, 0.5).setDepth(20).setScrollFactor(0);
      lbl.setInteractive({ useHandCursor: true });
      lbl.on('pointerdown', () => this._showBagBadgeInfo(b, x + 12, y));
      this._badgeElements.push(dot, lbl);
      this._badgeBgs.push(dot, lbl);
    });
  }

  _showBagBadgeInfo(badge, anchorX, anchorY) {
    if (this._badgeTooltipForId === badge.id) {
      this._clearBadgeTooltip();
      return;
    }
    this._clearBadgeTooltip();
    this._badgeTooltipForId = badge.id;
    const tipW = 240, tipH = 96;
    let tipX = anchorX + tipW / 2 + 24;
    let tipY = anchorY;
    if (tipY - tipH / 2 < 80) tipY = 80 + tipH / 2;
    if (tipY + tipH / 2 > 525) tipY = 525 - tipH / 2;

    const D = 200;
    const left = tipX - tipW / 2;
    const top = tipY - tipH / 2;

    const els = [];
    const bg = this.add.rectangle(tipX, tipY, tipW, tipH, 0x14192C, 0.97).setDepth(D).setScrollFactor(0);
    bg.setStrokeStyle(2, badge.color);
    els.push(bg);
    els.push(this.add.text(left + 14, top + 12, badge.name, {
      fontFamily: FONT, fontSize: '16px', color: '#F1F5F9', fontStyle: '700',
    }).setDepth(D + 1).setScrollFactor(0));
    els.push(this.add.rectangle(tipX, top + 34, tipW - 28, 1, 0x3D4A5F).setDepth(D + 1).setScrollFactor(0));
    els.push(this.add.text(left + 14, top + 42, badge.desc, {
      fontFamily: FONT, fontSize: '14px', color: '#CBD5E1',
      wordWrap: { width: tipW - 28 }, lineSpacing: 2,
    }).setDepth(D + 1).setScrollFactor(0));
    this._badgeTooltipElements = els;
  }

  _clearBadgeTooltip() {
    if (this._badgeTooltipElements) {
      this._badgeTooltipElements.forEach(e => e && e.destroy && e.destroy());
    }
    this._badgeTooltipElements = [];
    this._badgeTooltipForId = null;
  }

  // === 장비 셀 클릭 시 툴팁 — 풀 정보 (이름/등급/슬롯/효과/패시브) ===
  _clearItemTooltip() {
    if (this._itemTooltipElements) {
      this._itemTooltipElements.forEach(e => e && e.destroy && e.destroy());
    }
    this._itemTooltipElements = [];
    this._itemTooltipForId = null;
  }

  // === 일시정지 메뉴 ===
  // === 일시정지 모달 — createModal 시스템 (글래스 통일, 환경설정 버튼 포함) ===
  // 일시정지 / 환경설정 모달 — 본체는 ui/PauseModals.js, wrapper 유지
  showPauseMenu() { fxShowPauseMenu(this); }
  showSettingsModal(opts = {}) { fxShowSettingsModal(this, opts); }
  showHelpModal(opts = {}) { fxShowHelpModal(this, opts); }

  // === 휴식 상점 ===
  // === 상점 모달 — createModal 시스템 (4 카드 + 하단 골드/리롤/나가기) ===
  // 휴식 상점 — 본체는 ui/ShopModal.js (showShop/rerollShop/renderShop/buyItem/buySpecialCard/exitShop)
  showShop()             { fxShowShop(this); }
  rerollShop()           { fxRerollShop(this); }
  renderShop()           { fxRenderShop(this); }
  buyItem(index)         { fxBuyItem(this, index); }
  buySpecialCard()       { fxBuySpecialCard(this); }
  exitShop()             { fxExitShop(this); }

  // === 장착 장비 보기 팝업 — 8 슬롯 ===
  // === 인벤토리 / 소지품 / 뽑은 카드 / 장비 ===
  //  showInventory:      신규 4×3 그리드 (사용/정보 통합) — TopBar 🎒
  //  showBag:            호환 alias → showInventory
  //  showEquipmentModal: TopBar ⚔ — showPurchasedItems 재사용 (장비+가방 보기)
  //  showPurchasedItems: 8슬롯 + 8×4 인벤토리 그리드 (옛 진입점)
  //  showPickedCards:    뽑은 카드 페이지네이션 — TopBar 🃏
  //  showSynergyInfo:    🔮 시너지 정보 (TopBar 시너지 줄 클릭)
  showInventory()      { fxShowInventory(this); }
  showBag()            { fxShowInventory(this); }
  showEquipmentModal() { fxShowPurchasedItems(this); }
  showPurchasedItems() { fxShowPurchasedItems(this); }
  showPickedCards()    { fxShowPickedCards(this); }
  showSynergyInfo()    { fxShowSynergyInfo(this); }
  // 게임 클리어 / 게임 오버 — 본체는 ui/CombatFX.js 로 분리, 이벤트 리스너 호환용 wrapper
  showGameClear(unlockedDifficulty) { fxShowGameClear(this, unlockedDifficulty); }
  showGameOver() { fxShowGameOver(this); }
  showStageClear(stage, starInfo) { fxShowStageClear(this, stage, starInfo); }
}
