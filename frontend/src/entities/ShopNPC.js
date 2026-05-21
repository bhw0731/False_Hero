// 매점 NPC entity — 무한 맵 상에 고정 배치. 플레이어 근접 시 매점 모달 자동 진입.
//   visited 후 sprite fade. 다시 방문 X.

import { addText, FONT } from '../ui/theme.js';

const NPC_RADIUS = 24;
const NPC_COLOR = 0xFFD166;       // 골드
const NPC_STROKE = 0xC5A059;      // 다크 골드
const APPROACH_DIST = 90;         // 근접 트리거 거리 (player.x ↔ npc.x)
const VISITED_ALPHA = 0.35;

export default class ShopNPC {
  constructor(scene, x, y = 446) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.visited = false;

    // 시각: 골드 원 + "🏪" 라벨
    this.bg = scene.add.circle(x, y, NPC_RADIUS, NPC_COLOR, 0.95)
      .setStrokeStyle(2, NPC_STROKE, 1)
      .setDepth(8);
    this.icon = addText(scene, x, y - 2, '🏪', {
      fontFamily: FONT, fontSize: '26px',
    }).setOrigin(0.5).setDepth(9);
    this.label = addText(scene, x, y + 44, '매점', {
      fontFamily: FONT, fontSize: '15px', color: '#FFD166', fontStyle: '700',
    }).setOrigin(0.5).setDepth(9);
    this.label.setShadow(1, 1, '#000000', 2, false, true);

    // 부드러운 부유 애니메이션 (시각 강조)
    scene.tweens.add({
      targets: [this.bg, this.icon],
      y: y - 6,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // 매 프레임 호출 — 플레이어 근접 체크
  update(player) {
    if (this.visited) return;
    if (!player || !player.sprite) return;
    const dist = Math.abs(player.sprite.x - this.x);
    if (dist < APPROACH_DIST) {
      this.visited = true;
      this._fade();
      // 매점 진입 — 모달 emit
      if (this.scene.events && this.scene.events.emit) {
        this.scene.events.emit('show-shop');
      }
    }
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
