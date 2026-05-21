// 💎 다이아 상점 씬 — 메인 메뉴 → 풀스크린 별도 씬 (옛 모달 폐기).
//   SettingsScene 패턴 — 배경 + 글래스 패널 + 옛 DiamondShopModal 콘텐츠 재활용.

import Phaser from 'phaser';
import { showDiamondShop } from '../ui/DiamondShopModal.js';
import { attachTouchFeedback } from '../ui/touchFeedback.js';

export default class DiamondShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DiamondShopScene' });
  }

  create() {
    const W = this.scale.width, H = this.scale.height;

    // 풀스크린 어두운 배경
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1);

    attachTouchFeedback(this);

    // 옛 DiamondShopModal 의 콘텐츠 (탭 / 카드 / 데브) 재활용 — 모달 형태로 가운데 표시.
    //   onClose → MenuScene 복귀.
    showDiamondShop(this, {
      fullscreen: true,
      onClose: () => this.scene.start('MenuScene'),
    });
  }
}
