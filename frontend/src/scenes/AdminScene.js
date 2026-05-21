// 개발자 모드 — 테스트 모드 토글
// 켜면: 상점 가격 컷 무시, 골드 무제한 (구매 차감 X), 무제한 리롤 버튼

import Phaser from 'phaser';
import { C, FONT, makeButton, makeTitle, makeText } from '../ui/theme.js';
import { gameSettings, saveSettings } from '../data/settings.js';

export default class AdminScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AdminScene' });
  }

  create() {
    this.add.rectangle(480, 270, 960, 540, Phaser.Display.Color.HexStringToColor(C.bg).color);

    makeTitle(this, 480, 110, '개발자 모드', 'lg');
    makeText(this, 480, 150, '개발/테스트용 옵션', {
      size: '13px', color: C.textDim,
    }).setOrigin(0.5);
    this.add.rectangle(480, 178, 60, 2, 0x6366F1);

    // 토글 카드
    this._renderTestToggle(480, 280);

    // 효과 설명
    const descBg = this.add.rectangle(480, 380, 540, 130, Phaser.Display.Color.HexStringToColor(C.surface).color);
    descBg.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(C.border).color);

    this.add.text(480, 330, '테스트 모드 ON 효과', {
      fontFamily: FONT, fontSize: '18px', color: '#FFC857', fontStyle: '700',
    }).setOrigin(0.5);

    const lines = [
      '· 상점 가격 컷 무시 — 1스테이지부터 전설까지 OK',
      '· 골드 무제한 — 구매 시 차감 안 됨 (시작 7,777,777)',
      '· 무제한 리롤 — 상점에 🔄 리롤 (테스트) 버튼 노출',
    ];
    lines.forEach((line, i) => {
      this.add.text(480, 360 + i * 22, line, {
        fontFamily: FONT, fontSize: '15px', color: C.textDim,
      }).setOrigin(0.5);
    });

    makeButton(this, 480, 480, '메뉴로 돌아가기', () => {
      this.scene.start('MenuScene');
    }, { variant: 'ghost', size: 'md' });
  }

  _renderTestToggle(x, y) {
    const cardW = 540, cardH = 90;
    const card = this.add.rectangle(x, y, cardW, cardH, Phaser.Display.Color.HexStringToColor(C.surface).color);
    card.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(C.border).color);

    // 좌측 — 라벨
    this.add.text(x - cardW / 2 + 30, y - 12, '🧪  테스트 모드', {
      fontFamily: FONT, fontSize: '25px', color: C.textHi, fontStyle: '700',
    }).setOrigin(0, 0.5);

    const subtitle = this.add.text(x - cardW / 2 + 30, y + 18, '', {
      fontFamily: FONT, fontSize: '15px',
    }).setOrigin(0, 0.5);

    // 우측 — 토글 스위치
    const toggleX = x + cardW / 2 - 80;
    const trackW = 64, trackH = 28;
    const track = this.add.rectangle(toggleX, y, trackW, trackH, 0x2A3548);
    track.setStrokeStyle(1, 0x3D4A5F);

    const knobR = 11;
    const knob = this.add.circle(toggleX, y, knobR, 0xCBD5E1);

    const refresh = () => {
      const on = gameSettings.testMode;
      track.fillColor = on ? 0x10B981 : 0x2A3548;
      track.setStrokeStyle(1, on ? 0x34D399 : 0x3D4A5F);
      knob.x = on ? (toggleX + 14) : (toggleX - 14);
      knob.fillColor = on ? 0xFFFFFF : 0xCBD5E1;
      subtitle.setText(on ? '활성 — 다음 새 게임부터 적용' : '비활성 — 정상 모드');
      subtitle.setColor(on ? '#34D399' : C.textMute);
    };
    refresh();

    // 카드 전체가 클릭 가능 — 토글
    card.setInteractive({ useHandCursor: true });
    card.on('pointerover', () => card.fillColor = Phaser.Display.Color.HexStringToColor(C.surface2).color);
    card.on('pointerout',  () => card.fillColor = Phaser.Display.Color.HexStringToColor(C.surface).color);
    card.on('pointerdown', () => {
      gameSettings.testMode = !gameSettings.testMode;
      saveSettings();
      refresh();
    });
  }
}
