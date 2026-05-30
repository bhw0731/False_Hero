// [Phase P-54] 이벤트 노드 — 무한 맵 상 고정 배치. 플레이어 근접 시 모달.
//   보물 상자: 즉시 무작위 보상 (골드/영약/다이아/회복) 또는 함정 도박.

import { showConfirmDialog } from '../ui/modals/ConfirmDialog.js';
import { addDiamonds } from '../data/meta/diamonds.js';
import { sound } from '../systems/SoundManager.js';

const NODE_RADIUS = 20;
const APPROACH_DIST = 90;
const FADE_OUT_MS  = 380;     // [P-70] 사용 후 완전 소멸 시간 (잔상 X).

// [P-70] 헤럴드 메달리온 톤 — 어두운 베이스 + 골드 링 + 상자 글리프.
const TREASURE = {
  base: 0x1A1208,       // 어두운 가죽/돌 베이스
  ring: 0xE5C26B,       // 골드 라이트 링
  glyphColor: 0xE5C26B,
  glyphShade: 0x6A4A1F,
};

export default class EventNode {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.visited = false;
    const cfg = TREASURE;

    // 베이스 메달리온.
    this.bg = scene.add.circle(x, y, NODE_RADIUS, cfg.base, 0.92)
      .setStrokeStyle(2, cfg.ring, 1)
      .setDepth(8);

    // 글리프 — 자물쇠 달린 상자 (그래픽으로 직접 그림).
    this.icon = scene.add.graphics().setDepth(9);
    this.icon.x = x; this.icon.y = y;
    _drawChest(this.icon, cfg.glyphColor, cfg.glyphShade);

    // 부드러운 부유 애니메이션.
    scene.tweens.add({
      targets: [this.bg, this.icon],
      y: y - 5,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update(player) {
    if (this.visited) return;
    if (!player || !player.sprite) return;
    // [Phase P-54] 다른 모달/이벤트 이미 활성 시 대기 — 여러 이벤트 동시 발동 방지
    if (this.scene.eventModalActive) return;
    if (this.scene._activeModal && !this.scene._activeModal._closed) return;
    const dist = Math.abs(player.sprite.x - this.x);
    if (dist < APPROACH_DIST) {
      this.visited = true;
      this._fade();
      this._triggerTreasure(player);
    }
  }

  // [Phase P-54] 모달 열 때 일시정지 / 닫을 때 재개. eventModalActive 플래그로 GameScene.update 도 차단.
  _pauseGame() {
    if (this.scene.physics && this.scene.physics.world && !this.scene.physics.world.isPaused) {
      this.scene.physics.pause();
      this._pausedPhysics = true;
    }
    if (this.scene.time && !this.scene.time.paused) {
      this.scene.time.paused = true;
      this._pausedTime = true;
    }
    this.scene.eventModalActive = true;
    if (this.scene.events && this.scene.events.emit) this.scene.events.emit('modal-opened');
  }
  _resumeGame() {
    if (this._pausedPhysics && this.scene.physics && this.scene.physics.resume) {
      this.scene.physics.resume();
      this._pausedPhysics = false;
    }
    if (this._pausedTime && this.scene.time) {
      this.scene.time.paused = false;
      this._pausedTime = false;
    }
    this.scene.eventModalActive = false;
    if (this.scene.events && this.scene.events.emit) this.scene.events.emit('modal-closed');
  }

  // === 보물 상자 — "여시겠습니까?" 확인 → 무작위 보상 (좋은 것 + 안 좋은 것 섞임) ===
  _triggerTreasure(player) {
    this._pauseGame();
    showConfirmDialog(this.scene, {
      title: '🎁 보물 상자',
      message: '여시겠습니까?\n좋은 보상이 있을 수도, 함정이 있을 수도 있습니다.',
      overlayCloses: false,   // 외곽 실수 클릭으로 닫히지 않음 — 명시적 선택 필수
      onConfirm: () => {
        this._resumeGame();
        sound.treasureOpen();
        this._rollTreasureOutcome(player);
      },
      onCancel: () => { this._resumeGame(); },
    });
  }

  _rollTreasureOutcome(player) {
    const emit = (msg) => {
      if (this.scene.events && this.scene.events.emit) this.scene.events.emit('toast', msg);
    };
    const r = Math.random();
    // 보상 풀 — 좋은 것 65% / 안 좋은 것 25% / 무 10%
    if (r < 0.25) {
      // 골드 +100
      player.stats.gold = (player.stats.gold || 0) + 100;
      if (player.runStats) player.runStats.goldEarned += 100;
      emit('🎁 골드 +100');
    } else if (r < 0.45) {
      // 영약 효과 (랜덤 1종) — 30초 시간 제한
      const elixirs = ['atk', 'as', 'dr'];
      const pick = elixirs[Math.floor(Math.random() * elixirs.length)];
      if (pick === 'atk') {
        player.addTimedBuff('attackPower', 0.25, 30000);
        emit('🎁 공격력 +25% (30초)');
      } else if (pick === 'as') {
        player.addTimedBuff('attackSpeed', 0.25, 30000);
        emit('🎁 공속 +25% (30초)');
      } else {
        player.addTimedBuff('damageReduction', 0.25, 30000);
        emit('🎁 피해 감소 +25% (30초)');
      }
    } else if (r < 0.55) {
      // 다이아 +1
      addDiamonds(1, '보물 상자');
      emit('🎁 다이아 +1');
    } else if (r < 0.65) {
      // HP 풀 회복
      const max = player.getStat('maxHp') || 1;
      player.stats.hp = max;
      if (player.updateHpDisplay) player.updateHpDisplay();
      emit('🎁 HP 풀 회복');
    } else if (r < 0.80) {
      // [함정] 미믹! HP 30% 손실
      const max = player.getStat('maxHp') || 1;
      const damage = Math.floor(max * 0.30);
      player.stats.hp = Math.max(1, player.stats.hp - damage);
      if (player.updateHpDisplay) player.updateHpDisplay();
      emit(`💢 미믹! HP -${damage}`);
    } else if (r < 0.90) {
      // [함정] 독 함정 — 이번 스테이지 공격력 -20%
      player.activeBuffs.attackPower = (player.activeBuffs.attackPower || 0) - 0.20;
      emit('💢 독 함정! 공격력 -20% (이번 스테이지)');
    } else {
      // 빈 상자
      emit('🎁 빈 상자... 아무것도 없다');
    }
  }

  _fade() {
    if (!this.scene || !this.scene.tweens) return;
    // [P-70] 사용 후 부유 정지 → 페이드 아웃 → 완전 소멸 (스테이지에서 사라짐).
    this.scene.tweens.killTweensOf([this.bg, this.icon]);
    this.scene.tweens.add({
      targets: [this.bg, this.icon],
      alpha: 0,
      duration: FADE_OUT_MS,
      ease: 'Sine.easeOut',
      onComplete: () => this.destroy(),
    });
  }

  destroy() {
    if (this.bg && this.bg.destroy) this.bg.destroy();
    if (this.icon && this.icon.destroy) this.icon.destroy();
    this.bg = null; this.icon = null;
  }
}

// === 글리프 헬퍼 — 그래픽으로 직접 그린 헤럴드 심볼 ===

// 보물: 자물쇠 달린 상자 (가로 폭 16, 높이 12, 뚜껑 라인 + 중앙 자물쇠 점).
function _drawChest(g, color, shadeColor) {
  const w = 16, h = 12;
  g.fillStyle(shadeColor, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 2);
  g.lineStyle(1.5, color, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 2);
  // 뚜껑 가로선 (위쪽 1/3 지점).
  g.lineStyle(1.5, color, 0.9);
  g.lineBetween(-w / 2, -h / 6, w / 2, -h / 6);
  // 자물쇠 점.
  g.fillStyle(color, 1);
  g.fillCircle(0, h / 6, 1.6);
}
