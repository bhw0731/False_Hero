// 스플래시 / 시작 대기 씬 — 로딩 연출 제거, 검은 화면 + 터치 안내 멘트
// 화면 아무 곳이나 한 번 터치(클릭)하면 메인 메뉴로 진입.

import Phaser from 'phaser';
import { FONT } from '../ui/theme.js';

export default class SplashScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SplashScene' });
  }

  create() {
    const W = this.scale.width, H = this.scale.height;

    // === 순수 검은 배경 ===
    this.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0x000000).setDepth(-10);

    // 텍스트 뒤 아주 옅은 라디얼 글로우 — 완전 평면 검정 방지 (미세한 분위기)
    const GLOW_CY = H * 0.5;
    const GLOW_RINGS = 12;
    const GLOW_MAX_R = Math.max(W, H) * 0.42;
    for (let i = 0; i < GLOW_RINGS; i++) {
      const t = i / (GLOW_RINGS - 1);
      const r = GLOW_MAX_R * (1 - t * 0.88);
      this.add.circle(W * 0.5, GLOW_CY, r, 0x1F2530, 0.022).setDepth(-9);
    }

    // === 터치 안내 멘트 — 화면 중앙, 은은한 호흡(깜빡임) ===
    const prompt = this.add.text(W * 0.5, H * 0.5, '화면을 아무대나 한 번 터치 해주세요', {
      fontFamily: FONT,
      fontSize: '22px',
      color: '#C8C8CE',
      fontStyle: '500',
      align: 'center',
      letterSpacing: 1,
    }).setOrigin(0.5).setAlpha(0);
    prompt.setShadow(0, 1, '#000000', 4, false, true);

    // === 등장: 페이드인 후 호흡 루프 시작 ===
    this.cameras.main.fadeIn(380, 0, 0, 0);
    this.tweens.add({
      targets: [prompt], alpha: 1, duration: 600, delay: 200, ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: prompt, alpha: 0.35,
          duration: 1100, ease: 'Sine.easeInOut',
          yoyo: true, repeat: -1,
        });
      },
    });

    // === 화면 아무 곳이나 터치/클릭 → 메뉴로 ===
    this.input.once('pointerdown', () => this._goToMenu());
  }

  _goToMenu() {
    if (this._transitioning) return;
    this._transitioning = true;
    this.cameras.main.fadeOut(420, 10, 10, 15);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }
}
