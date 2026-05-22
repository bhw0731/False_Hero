// ⚒ 강화 상점 씬 — 메인 메뉴 → 풀스크린 별도 씬.
//   UpgradeShopModal 콘텐츠를 풀스크린 모달로 표시.

import Phaser from 'phaser';
import { showUpgradeShop } from '../ui/modals/UpgradeShopModal.js';
import { attachTouchFeedback } from '../ui/touchFeedback.js';

export default class UpgradeShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UpgradeShopScene' });
  }

  create() {
    const W = this.scale.width, H = this.scale.height;

    // 풀스크린 어두운 배경
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1);

    attachTouchFeedback(this);

    // 강화 상점 콘텐츠 — 풀스크린 모달. onClose → MenuScene 복귀.
    showUpgradeShop(this, {
      fullscreen: true,
      onClose: () => this.scene.start('MenuScene'),
    });
  }
}
