// 콤보 플로팅 라벨 — 플레이어 sprite 위 (월드 좌표).
//   미니멀 디자인: 작은 텍스트 "×N" + 얇은 시간 바.

import { addText, FONT } from '../theme.js';

const Y_OFFSET = -78;
const BAR_W = 50;
const BAR_H = 2;

export default class ComboFloat {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.lastCount = 0;
    this._visible = false;

    this.container = scene.add.container(0, 0).setDepth(60);
    this.container.setVisible(false);
    this.container.setAlpha(0);

    // 미니멀 텍스트 — 작고 깔끔
    this.txt = addText(scene, 0, -8, '', {
      fontFamily: FONT, fontSize: '15px',
      color: '#FFFFFF', fontStyle: '700',
    }).setOrigin(0.5);
    this.txt.setShadow(1, 1, '#000000', 3, false, true);
    this.container.add(this.txt);

    // 시간 바 (얇은 라인)
    this.barBg = scene.add.graphics();
    this.barFill = scene.add.graphics();
    this.container.add([this.barBg, this.barFill]);
  }

  update(combo) {
    if (!this.player || !this.player.sprite) return;
    this.container.x = this.player.sprite.x;
    this.container.y = this.player.sprite.y + Y_OFFSET;

    if (combo.active && combo.count > 1) {
      this.txt.setText(`×${combo.count}`);
      // 콤보 크기에 따라 색 변화
      const color = combo.count >= 10 ? '#FF6B6B' : combo.count >= 5 ? '#FFD166' : '#FFFFFF';
      this.txt.setColor(color);

      const total = combo.totalSec || 5;
      const ratio = Math.max(0, Math.min(1, combo.remainingSec / total));
      this.barBg.clear();
      this.barBg.fillStyle(0xFFFFFF, 0.15);
      this.barBg.fillRect(-BAR_W / 2, 4, BAR_W, BAR_H);
      this.barFill.clear();
      this.barFill.fillStyle(0xFFFFFF, 0.85);
      this.barFill.fillRect(-BAR_W / 2, 4, BAR_W * ratio, BAR_H);

      if (!this._visible) {
        this._visible = true;
        this.container.setVisible(true);
        this.scene.tweens.killTweensOf(this.container);
        this.container.setScale(0.8);
        this.scene.tweens.add({
          targets: this.container,
          alpha: 1, scaleX: 1, scaleY: 1,
          duration: 150, ease: 'Sine.easeOut',
        });
      }

      if (combo.count > this.lastCount) {
        this.scene.tweens.add({
          targets: this.container,
          scaleX: { from: 1.15, to: 1 }, scaleY: { from: 1.15, to: 1 },
          duration: 120, ease: 'Sine.easeOut',
        });
      }
      this.lastCount = combo.count;
    } else {
      if (this._visible) {
        this._visible = false;
        this.scene.tweens.killTweensOf(this.container);
        this.scene.tweens.add({
          targets: this.container,
          alpha: 0,
          duration: 200, ease: 'Sine.easeIn',
          onComplete: () => this.container.setVisible(false),
        });
        this.lastCount = 0;
      }
    }
  }

  destroy() {
    if (this.container && this.container.destroy) this.container.destroy();
    this.container = null;
  }
}
