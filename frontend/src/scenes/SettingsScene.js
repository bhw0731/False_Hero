// 환경설정 씬 — [Phase P-54] 글래스 톤 통일 + 슬라이더 바 시각화.

import Phaser from 'phaser';
import {
  gameSettings,
  saveSettings,
} from '../data/settings.js';
import { C, FONT, addText, makeButton, makeTitle } from '../ui/theme.js';
import { attachTouchFeedback } from '../ui/touchFeedback.js';

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SettingsScene' });
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const cx = W / 2, cy = H / 2;
    attachTouchFeedback(this);

    // 배경 — 짙은 그라데이션 (상단 살짝 시안 톤 → 하단 검정)
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0E1726, 0x0E1726, 0x05080F, 0x05080F, 1, 1, 1, 1);
    bg.fillRect(0, 0, W, H);
    // 미세 스캔라인 느낌 (가로 선 8개)
    for (let i = 0; i < 8; i++) {
      const y = (H / 8) * i + 4;
      this.add.rectangle(cx, y, W, 1, 0xFFFFFF, 0.018);
    }

    // === 헤더 — 흰 타이틀 + 골드 미세 라인 (한 수푼) ===
    const title = addText(this, cx, 60, '환경설정', {
      fontFamily: FONT, fontSize: '30px', color: '#E8E8E8', fontStyle: '800',
    }).setOrigin(0.5);
    // 타이틀 아래 골드 라인 (짧고 옅게)
    const tl = this.add.graphics();
    tl.fillStyle(0xC5A059, 0.5);
    tl.fillRect(cx - 24, 86, 48, 1);

    // === 심플 패널 — 다크 그레이 + 흰 외곽 (코너 마크 / 글로우 / layer 제거) ===
    // [Phase P-54+++] 모던 픽셀 패널 — 드롭 섀도우 + 베벨 + 상단 골드 미세 띠
    const pw = 560, ph = 320;
    const px = cx - pw / 2, py = cy + 10 - ph / 2;
    const panel = this.add.graphics();
    // 드롭 섀도우 (4px 오프셋)
    panel.fillStyle(0x000000, 0.55);
    panel.fillRect(px + 4, py + 4, pw, ph);
    // 본체
    panel.fillStyle(0x121826, 0.95);
    panel.fillRect(px, py, pw, ph);
    // 1px 흰 외곽
    panel.lineStyle(1, 0xFFFFFF, 0.25);
    panel.strokeRect(px, py, pw, ph);
    // 베벨 — 상단 1px 흰 highlight
    panel.fillStyle(0xFFFFFF, 0.12);
    panel.fillRect(px + 1, py + 1, pw - 2, 1);
    // 베벨 — 하단 1px 검정 shadow
    panel.fillStyle(0x000000, 0.55);
    panel.fillRect(px + 1, py + ph - 2, pw - 2, 1);
    // 상단 골드 미세 띠 (2px, 절제)
    panel.fillStyle(0xC5A059, 0.55);
    panel.fillRect(px + 2, py + 2, pw - 4, 2);

    // === 섹션 헤더 — 흰 텍스트 ===
    const sectionTxt = addText(this, cx, py + 28, '사운드', {
      fontFamily: FONT, fontSize: '15px', color: '#CBD5E1', fontStyle: '700',
    }).setOrigin(0.5);
    sectionTxt.setShadow(1, 1, '#000000', 2, false, true);
    // 섹션 아래 미세 디바이더
    const sDiv = this.add.graphics();
    sDiv.fillStyle(0xFFFFFF, 0.10);
    sDiv.fillRect(px + 24, py + 52, pw - 48, 1);

    // === 슬라이더 행 — BGM / 효과음 ===
    this.makeSliderRow(cx, py + 100, 'BGM 볼륨',     'bgmVolume',  pw - 80);
    this.makeSliderRow(cx, py + 180, '효과음 볼륨',   'sfxVolume',  pw - 80);

    // === 뒤로 버튼 — 글래스 톤 ===
    this._makeGlassButton(cx, py + ph + 50, '◀ 뒤로', () => {
      saveSettings();
      this.scene.start('MenuScene');
    });

    // ESC 키도 뒤로
    this.input.keyboard.on('keydown-ESC', () => {
      saveSettings();
      this.scene.start('MenuScene');
    });
  }

  // === 슬라이더 행 — 라벨 / 가로 진행바 (10 segments) / 값 + ◀ ▶ 버튼 ===
  makeSliderRow(cx, y, label, key, width) {
    // 라벨 (좌측)
    addText(this, cx - width / 2, y - 18, label, {
      fontFamily: FONT, fontSize: '15px', color: '#CBD5E1', fontStyle: '600',
    }).setOrigin(0, 0.5);

    // 값 (우측)
    const valTxt = addText(this, cx + width / 2, y - 18, this.formatVolume(key), {
      fontFamily: FONT, fontSize: '15px', color: '#C5A059', fontStyle: '800',
    }).setOrigin(1, 0.5);

    // 진행 바 그래픽 + 10 segments
    const barW = width - 80;
    const barH = 10;
    const barX = cx - width / 2;
    const barG = this.add.graphics();
    const drawBar = () => {
      barG.clear();
      // [Phase P-54++] 픽셀 트랙 — 직각 + 두꺼운 외곽
      barG.fillStyle(0x05080F, 0.85);
      barG.fillRect(barX, y - barH / 2, barW, barH);
      barG.lineStyle(2, 0xFFFFFF, 0.20);
      barG.strokeRect(barX + 1, y - barH / 2 + 1, barW - 2, barH - 2);
      // 채워진 부분 (시안 그라데이션)
      const v = gameSettings[key] || 0;
      const fillW = Math.max(2, barW * v);
      // 채움 — 골드 (직각, 픽셀)
      barG.fillStyle(0xC5A059, 0.85);
      barG.fillRect(barX + 2, y - barH / 2 + 2, fillW - 4, barH - 4);
      // 상단 highlight 1px
      barG.fillStyle(0xFFFFFF, 0.22);
      barG.fillRect(barX + 2, y - barH / 2 + 2, fillW - 4, 1);
      // 세그먼트 (10 칸 구분선)
      barG.lineStyle(1, 0x000000, 0.35);
      for (let i = 1; i < 10; i++) {
        const sx = barX + (barW / 10) * i;
        barG.lineBetween(sx, y - barH / 2 + 1, sx, y + barH / 2 - 1);
      }
    };
    drawBar();

    const refresh = () => {
      valTxt.setText(this.formatVolume(key));
      drawBar();
    };

    // ◀ 버튼
    this._makeMiniBtn(cx + width / 2 - 60, y, '◀', () => {
      gameSettings[key] = Math.max(0, Math.round((gameSettings[key] - 0.1) * 10) / 10);
      refresh();
    });
    // ▶ 버튼
    this._makeMiniBtn(cx + width / 2 - 28, y, '▶', () => {
      gameSettings[key] = Math.min(1, Math.round((gameSettings[key] + 0.1) * 10) / 10);
      refresh();
    });

    // 바 클릭 시 해당 비율로 값 설정
    const hit = this.add.rectangle(barX + barW / 2, y, barW, barH + 4, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p) => {
      const localX = p.x - barX;
      const ratio = Math.max(0, Math.min(1, localX / barW));
      gameSettings[key] = Math.round(ratio * 10) / 10;
      refresh();
    });
  }

  // [Phase P-54+++] 모던 픽셀 ◀▶ 버튼 — 베벨 + 1px 외곽
  _makeMiniBtn(x, y, label, onClick) {
    const w = 24, h = 24;
    const g = this.add.graphics();
    const draw = (hovered = false) => {
      g.clear();
      // 드롭 섀도우
      g.fillStyle(0x000000, 0.5);
      g.fillRect(x - w / 2 + 1, y - h / 2 + 1, w, h);
      // 본체
      g.fillStyle(0x121826, 0.95);
      g.fillRect(x - w / 2, y - h / 2, w, h);
      // 1px 외곽
      g.lineStyle(1, hovered ? 0xC5A059 : 0xFFFFFF, hovered ? 0.85 : 0.30);
      g.strokeRect(x - w / 2, y - h / 2, w, h);
      // 베벨 highlight
      g.fillStyle(0xFFFFFF, hovered ? 0.18 : 0.10);
      g.fillRect(x - w / 2 + 1, y - h / 2 + 1, w - 2, 1);
    };
    draw(false);
    const t = addText(this, x, y, label, {
      fontFamily: FONT, fontSize: '13px', color: '#C5A059', fontStyle: '800',
    }).setOrigin(0.5);
    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', () => onClick());
  }

  // [Phase P-54+++] 모던 픽셀 뒤로 버튼 — 베벨 + 좌측 액센트 바
  _makeGlassButton(x, y, label, onClick) {
    const w = 140, h = 40;
    const g = this.add.graphics();
    const draw = (hovered = false) => {
      g.clear();
      // 드롭 섀도우
      g.fillStyle(0x000000, 0.55);
      g.fillRect(x - w / 2 + 2, y - h / 2 + 2, w, h);
      // 본체
      g.fillStyle(0x121826, 0.95);
      g.fillRect(x - w / 2, y - h / 2, w, h);
      // 좌측 골드 액센트 바 (hover 시 더 진하게)
      g.fillStyle(0xC5A059, hovered ? 0.95 : 0.55);
      g.fillRect(x - w / 2, y - h / 2, 3, h);
      // 1px 외곽
      g.lineStyle(1, 0xFFFFFF, hovered ? 0.40 : 0.20);
      g.strokeRect(x - w / 2, y - h / 2, w, h);
      // 베벨 highlight
      g.fillStyle(0xFFFFFF, hovered ? 0.15 : 0.08);
      g.fillRect(x - w / 2 + 4, y - h / 2 + 1, w - 5, 1);
      // 베벨 shadow
      g.fillStyle(0x000000, 0.55);
      g.fillRect(x - w / 2 + 4, y + h / 2 - 1, w - 5, 1);
    };
    draw(false);
    const t = addText(this, x, y, label, {
      fontFamily: FONT, fontSize: '17px', color: '#E8E8E8', fontStyle: '700',
    }).setOrigin(0.5);
    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', () => onClick());
  }

  formatVolume(key) {
    return `${Math.round(gameSettings[key] * 100)}%`;
  }
}
