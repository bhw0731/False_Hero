// [Phase P-54] 이벤트 노드 — 무한 맵 상 고정 배치. 플레이어 근접 시 효과/모달.
// 두 가지 타입:
//   'treasure' — 보물 상자. 즉시 무작위 보상 (골드/영약/다이아/회복).
//   'trial'    — 신의 시험. 모달 표시 → 수락 시 디버프 + 다이아 보상 / 거절 시 skip.

import { addText, FONT } from '../ui/theme.js';
import { showConfirmDialog } from '../ui/ConfirmDialog.js';
import { addDiamonds } from '../data/diamonds.js';
import { sound } from '../systems/SoundManager.js';

const NODE_RADIUS = 22;
const APPROACH_DIST = 90;
const VISITED_ALPHA = 0.25;

const TREASURE = {
  bg: 0xFFE066,    // 골드 라이트
  stroke: 0xC5A059,
  icon: '🎁',
  label: '보물',
  labelColor: '#FFE066',
};
const TRIAL = {
  bg: 0xA855F7,    // 보라
  stroke: 0x6A2EB8,
  icon: '💀',
  label: '시험',
  labelColor: '#C084FC',
};

export default class EventNode {
  constructor(scene, x, y, type = 'treasure') {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;
    this.visited = false;
    const cfg = type === 'trial' ? TRIAL : TREASURE;

    this.bg = scene.add.circle(x, y, NODE_RADIUS, cfg.bg, 0.95)
      .setStrokeStyle(2, cfg.stroke, 1)
      .setDepth(8);
    this.icon = addText(scene, x, y - 2, cfg.icon, {
      fontFamily: FONT, fontSize: '24px',
    }).setOrigin(0.5).setDepth(9);
    this.label = addText(scene, x, y + 32, cfg.label, {
      fontFamily: FONT, fontSize: '12px', color: cfg.labelColor, fontStyle: '700',
    }).setOrigin(0.5).setDepth(9);
    this.label.setShadow(1, 1, '#000000', 2, false, true);

    // 부드러운 부유 애니메이션
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
      this._trigger(player);
    }
  }

  _trigger(player) {
    if (this.type === 'treasure') this._triggerTreasure(player);
    else if (this.type === 'trial') this._triggerTrial(player);
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

  // === 신의 시험 — 일시정지 + 모달 선택: 수락 (디버프 + 다이아) vs 거절 ===
  _triggerTrial(player) {
    const trials = [
      { desc: '공격력 -30%', apply: (p) => { p.activeBuffs.attackPower = (p.activeBuffs.attackPower || 0) - 0.30; } },
      { desc: '명중 -20%',   apply: (p) => { p.activeBuffs.accuracy    = (p.activeBuffs.accuracy    || 0) - 0.20; } },
      { desc: '받는 피해 +20%', apply: (p) => { p.activeBuffs.damageReduction = (p.activeBuffs.damageReduction || 0) - 0.20; } },
    ];
    const trial = trials[Math.floor(Math.random() * trials.length)];
    const reward = 3 + Math.floor(Math.random() * 3);  // 3~5 다이아

    this._pauseGame();
    showConfirmDialog(this.scene, {
      title: '💀 신의 시험',
      message: `이번 스테이지 ${trial.desc} 감수\n→ 다이아 +${reward}\n\n수락하시겠습니까?`,
      overlayCloses: false,   // 외곽 실수 클릭으로 닫히지 않음 — 명시적 선택 필수
      onConfirm: () => {
        this._resumeGame();
        sound.trialAccept();
        sound.diamondGain();
        trial.apply(player);
        addDiamonds(reward, '신의 시험');
        if (this.scene.events && this.scene.events.emit) {
          this.scene.events.emit('toast', `💀 시험 수락 — 다이아 +${reward}`);
        }
      },
      onCancel: () => {
        this._resumeGame();
        if (this.scene.events && this.scene.events.emit) {
          this.scene.events.emit('toast', '💀 시험 거절');
        }
      },
    });
  }

  _fade() {
    if (!this.scene || !this.scene.tweens) return;
    this.scene.tweens.add({
      targets: [this.bg, this.icon, this.label],
      alpha: VISITED_ALPHA,
      duration: 400,
      ease: 'Sine.easeOut',
    });
  }

  destroy() {
    if (this.bg && this.bg.destroy) this.bg.destroy();
    if (this.icon && this.icon.destroy) this.icon.destroy();
    if (this.label && this.label.destroy) this.label.destroy();
    this.bg = null; this.icon = null; this.label = null;
  }
}
