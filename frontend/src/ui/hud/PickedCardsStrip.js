// [Phase P-54] 보유 카드 우측 세로 띠 — 인게임 항상 표시 (모달 클릭 X).
//
// 위치: 캔버스 우측 가장자리. TopBar 아이콘 (y ~60) 아래 ~ 물약 슬롯 (y ~H-70) 위.
// 표시: 최근 픽한 카드 N장 (위→아래), 죄 색 fill + 등급 색 외곽. 클릭 → showPickedCards 모달.
// 갱신: scene.events 'card-picked' 또는 외부 refresh() 호출.
//
// 사용:
//   const strip = new PickedCardsStrip(scene);
//   strip.refresh();   // 카드 픽 후
//   strip.destroy();   // 씬 종료 시

import { addText, FONT } from '../theme.js';
import { CARD_TIER_COLORS } from '../../data/cards.js';
import { SIN_COLORS, SIN_ICONS, SIN_KEY } from '../../data/sins.js';

const CARD_W = 28, CARD_H = 28, GAP = 4;
const RIGHT_MARGIN = 16;
const TOP_Y = 80;       // TopBar 아이콘 (y=60) 아래
const BOT_PAD = 100;    // 물약 슬롯 위 여유
const MAX_CARDS = 12;
const DEPTH = 11;

class PickedCardsStrip {
  constructor(scene) {
    this.scene = scene;
    const W = (scene.scale && scene.scale.width)  || 1280;
    const H = (scene.scale && scene.scale.height) || 600;
    this._cx = W - RIGHT_MARGIN - CARD_W / 2;
    this._topY = TOP_Y;
    this._availH = H - BOT_PAD - TOP_Y;
    // 슬롯 그래픽/텍스트 보존 (refresh 마다 정리 후 재생성)
    this._elements = [];
    // [Phase P-54] 신규 픽 펄스 — 마지막 픽 카드 수 추적해 추가될 때 첫 칸 애니메이션.
    this._lastCardCount = 0;
    // 클릭 hit 영역 (전체 띠) — 항상 활성. 클릭 시 모달 오픈.
    this._buildHit();
    this.refresh();
  }

  _buildHit() {
    const W = (this.scene.scale && this.scene.scale.width)  || 1280;
    const H = (this.scene.scale && this.scene.scale.height) || 600;
    const hitH = H - BOT_PAD - TOP_Y;
    this._hit = this.scene.add.rectangle(this._cx, TOP_Y + hitH / 2, CARD_W + 8, hitH, 0x000000, 0.001)
      .setDepth(DEPTH).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this._hit.on('pointerdown', () => {
      if (this.scene.showPickedCards) this.scene.showPickedCards();
    });
    if (this.scene.markAsUI) this.scene.markAsUI(this._hit);
  }

  refresh() {
    // 기존 정리
    this._elements.forEach(el => { try { el && el.destroy && el.destroy(); } catch {} });
    this._elements = [];

    const player = this.scene.player;
    const cards = (player && player.pickedCards) || [];
    const isNewPick = cards.length > this._lastCardCount;
    this._lastCardCount = cards.length;
    if (cards.length === 0) return;

    // 가장 최근 카드 위쪽. slice 로 최대 MAX_CARDS 개 (오래된 거 절단).
    const visible = cards.slice(-MAX_CARDS).reverse();

    visible.forEach((card, i) => {
      const sx = this._cx;
      const sy = TOP_Y + CARD_H / 2 + i * (CARD_H + GAP);
      const tierInfo = CARD_TIER_COLORS[card.tier || card.rarity || 'normal'] || CARD_TIER_COLORS.normal;
      const accent  = tierInfo.color;
      const sinHex  = card.sin ? (SIN_COLORS[card.sin] || '#FFFFFF') : '#FFFFFF';
      const sinColor = parseInt(sinHex.replace('#', '0x'), 16);

      // 슬롯 배경 (글래스)
      const g = this.scene.add.graphics().setDepth(DEPTH).setScrollFactor(0);
      g.fillStyle(0x000000, 0.55);
      g.fillRoundedRect(sx - CARD_W / 2, sy - CARD_H / 2, CARD_W, CARD_H, 4);
      g.lineStyle(1, 0xFFFFFF, 0.15);
      g.strokeRoundedRect(sx - CARD_W / 2, sy - CARD_H / 2, CARD_W, CARD_H, 4);
      // 등급 색 외곽
      g.lineStyle(1.5, accent, 0.85);
      g.strokeRoundedRect(sx - CARD_W / 2, sy - CARD_H / 2, CARD_W, CARD_H, 4);
      // 죄 색 좌측 미세 바 (정체성 표시)
      g.fillStyle(sinColor, 0.85);
      g.fillRect(sx - CARD_W / 2 + 2, sy - CARD_H / 2 + 3, 2, CARD_H - 6);
      this._elements.push(g);

      // 죄 아이콘 — 픽셀 이미지 우선, 없으면 emoji 폴백.
      const sinKey = card.sin ? SIN_KEY[card.sin] : null;
      const imgKey = sinKey ? `sin_${sinKey}` : null;
      let iconEl;
      if (imgKey && this.scene.textures && this.scene.textures.exists(imgKey)) {
        iconEl = this.scene.add.image(sx + 2, sy, imgKey)
          .setDisplaySize(CARD_W - 6, CARD_H - 6)
          .setDepth(DEPTH + 1).setScrollFactor(0);
      } else {
        const iconChar = SIN_ICONS[card.sin] || card.icon || '?';
        iconEl = addText(this.scene, sx + 2, sy, iconChar, {
          fontFamily: FONT, fontSize: '15px',
        }).setOrigin(0.5).setDepth(DEPTH + 1).setScrollFactor(0);
      }
      this._elements.push(iconEl);

      if (this.scene.markAsUI) this.scene.markAsUI([g, iconEl]);

      // [Phase P-54] 신규 픽 펄스 — 첫 칸 (i===0) 에서만, isNewPick true 일 때.
      if (isNewPick && i === 0) {
        const pulseG = this.scene.add.graphics().setDepth(DEPTH - 1).setScrollFactor(0);
        pulseG.lineStyle(2, accent, 1);
        pulseG.strokeRoundedRect(sx - CARD_W / 2 - 2, sy - CARD_H / 2 - 2, CARD_W + 4, CARD_H + 4, 6);
        this._elements.push(pulseG);
        if (this.scene.markAsUI) this.scene.markAsUI(pulseG);
        // 펄스 트윈 — 외곽 확장 + 페이드 아웃 (1.5초 후 자동 destroy)
        this.scene.tweens.add({
          targets: pulseG, alpha: { from: 1, to: 0 },
          duration: 1500, ease: 'Sine.easeOut',
          onComplete: () => { try { pulseG.destroy(); } catch {} },
        });
        // 아이콘 살짝 펄스 (scale 1.0 → 1.2 → 1.0)
        if (iconEl.setScale) {
          this.scene.tweens.add({
            targets: iconEl, scale: { from: 1.3, to: 1 },
            duration: 600, ease: 'Back.easeOut',
          });
        }
      }
    });

    // 카드 더 있으면 하단에 "+N" 표시
    if (cards.length > MAX_CARDS) {
      const overflowSy = TOP_Y + CARD_H / 2 + MAX_CARDS * (CARD_H + GAP);
      const moreTxt = addText(this.scene, this._cx, overflowSy, `+${cards.length - MAX_CARDS}`, {
        fontFamily: FONT, fontSize: '12px', color: '#9A9AA2', fontStyle: '700',
      }).setOrigin(0.5).setDepth(DEPTH + 1).setScrollFactor(0);
      moreTxt.setShadow(1, 1, '#000000', 2, false, true);
      this._elements.push(moreTxt);
      if (this.scene.markAsUI) this.scene.markAsUI(moreTxt);
    }
  }

  destroy() {
    this._elements.forEach(el => { try { el && el.destroy && el.destroy(); } catch {} });
    this._elements = [];
    if (this._hit) { try { this._hit.destroy(); } catch {} this._hit = null; }
  }
}

export default PickedCardsStrip;
