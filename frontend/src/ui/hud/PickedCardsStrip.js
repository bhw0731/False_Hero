// [P-69 A-안] 우측 7대죄 진행바 패널 — 옛 카드 리스트 대체.
//
// 위치: 캔버스 우측 가장자리. TopBar 아이콘 (y~60) 아래.
// 표시: 7개 죄 각각 한 줄 — [아이콘 · 게이지 · 카운트]. 게이지 = 시너지 최대 단계(9) 까지 채움.
// 활성 죄(최다 카운트) = 골드 톤 강조. 카운트 증가 시 해당 줄 펄스.
// 클릭 시 → showPickedCards 모달 (보유 카드 전체 보기).
//
// 사용:
//   const strip = new PickedCardsStrip(scene);
//   strip.refresh();   // 카드 픽 후 ('card-picked' 이벤트로 자동 호출)
//   strip.destroy();   // 씬 종료 시

import { addText, FONT } from '../theme.js';
import { SIN_COLORS, SIN_ICONS, SIN_KEY, SIN_LIST } from '../../data/sins.js';

const RIGHT_MARGIN = 16;
const PANEL_W = 62;
const ROW_H   = 22;
const BAR_W   = 30, BAR_H = 5;
const TOP_Y   = 80;       // TopBar 아이콘 (y=60) 아래
const SYN_MAX = 9;        // SYNERGY_TIERS[0] — 마지막 시너지 단계 진입 임계치 = 게이지 만수치.
const DEPTH   = 11;

class PickedCardsStrip {
  constructor(scene) {
    this.scene = scene;
    const W = (scene.scale && scene.scale.width)  || 1280;
    this._cx = W - RIGHT_MARGIN - PANEL_W / 2;
    this._elements = [];
    this._lastSinCounts = {};
    this._buildHit();
    this.refresh();
  }

  _buildHit() {
    const hitH = ROW_H * SIN_LIST.length + 8;
    this._hit = this.scene.add.rectangle(this._cx, TOP_Y + hitH / 2, PANEL_W + 4, hitH, 0x000000, 0.001)
      .setDepth(DEPTH).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this._hit.on('pointerdown', () => {
      // [P-71] 우측 탭 → 시너지 + 보유 카드 통합 모달 (좌측 시너지 클릭 트리거는 제거됨).
      if (this.scene.showInventoryAndSynergy) this.scene.showInventoryAndSynergy();
      else if (this.scene.showPickedCards)    this.scene.showPickedCards();
    });
    if (this.scene.markAsUI) this.scene.markAsUI(this._hit);
  }

  refresh() {
    // 기존 정리.
    this._elements.forEach(el => { try { el && el.destroy && el.destroy(); } catch {} });
    this._elements = [];

    const player = this.scene.player;
    if (!player) return;
    const sinCounts = player.sinCounts || {};
    const prevCounts = this._lastSinCounts || {};

    // 활성 죄 = 최다 카운트 (>0 일 때만). 동률은 첫 번째.
    let maxCount = 0, activeSin = null;
    SIN_LIST.forEach(s => {
      const c = sinCounts[s] || 0;
      if (c > maxCount) { maxCount = c; activeSin = s; }
    });

    const leftX = this._cx - PANEL_W / 2;
    SIN_LIST.forEach((sin, i) => {
      const c = sinCounts[sin] || 0;
      const rowY = TOP_Y + ROW_H / 2 + i * ROW_H;
      const sinHex = SIN_COLORS[sin] || '#FFFFFF';
      const sinColor = parseInt(sinHex.replace('#', '0x'), 16);
      const isActive = (sin === activeSin && c > 0);
      const accent = isActive ? 0xFFD166 : sinColor;

      // 죄 아이콘 (좌측). 픽셀 이미지 우선, emoji 폴백.
      const sinKey = SIN_KEY[sin];
      const imgKey = sinKey ? `sin_${sinKey}` : null;
      const iconX = leftX + 8;
      let iconEl;
      if (imgKey && this.scene.textures && this.scene.textures.exists(imgKey)) {
        iconEl = this.scene.add.image(iconX, rowY, imgKey)
          .setDisplaySize(12, 12).setDepth(DEPTH + 1).setScrollFactor(0);
      } else {
        iconEl = addText(this.scene, iconX, rowY, SIN_ICONS[sin] || '?', {
          fontFamily: FONT, fontSize: '11px',
        }).setOrigin(0.5).setDepth(DEPTH + 1).setScrollFactor(0);
      }
      if (c === 0) iconEl.setAlpha(0.4);
      this._elements.push(iconEl);

      // 진행 게이지 — 트랙(어두움) + 채움(죄/금 색). 그래픽은 자체 중심 기준으로 그려 스케일 안전.
      const barCx = leftX + 17 + BAR_W / 2;
      const barG = this.scene.add.graphics().setDepth(DEPTH).setScrollFactor(0);
      barG.x = barCx; barG.y = rowY;
      barG.fillStyle(0x1A1208, 0.85);
      barG.fillRoundedRect(-BAR_W / 2, -BAR_H / 2, BAR_W, BAR_H, 2);
      barG.lineStyle(1, accent, isActive ? 0.95 : 0.40);
      barG.strokeRoundedRect(-BAR_W / 2, -BAR_H / 2, BAR_W, BAR_H, 2);
      const fillRatio = Math.min(1, c / SYN_MAX);
      if (fillRatio > 0) {
        barG.fillStyle(accent, isActive ? 1.0 : 0.85);
        const fillW = Math.max(2, BAR_W * fillRatio - 2);
        barG.fillRoundedRect(-BAR_W / 2 + 1, -BAR_H / 2 + 1, fillW, BAR_H - 2, 1.5);
      }
      this._elements.push(barG);

      // 카운트 텍스트 (우측).
      const countTxt = addText(this.scene, leftX + PANEL_W - 4, rowY, `${c}`, {
        fontFamily: FONT, fontSize: '11px',
        color: c > 0 ? (isActive ? '#FFE9B5' : '#D8D8DC') : '#5A5A5F', fontStyle: '900',
      }).setOrigin(1, 0.5).setDepth(DEPTH + 1).setScrollFactor(0);
      countTxt.setShadow(1, 1, '#000000', 2, false, true);
      this._elements.push(countTxt);

      if (this.scene.markAsUI) this.scene.markAsUI([iconEl, barG, countTxt]);

      // 카운트 증가 펄스 — 행이 살짝 부풀었다 정착.
      if ((prevCounts[sin] || 0) < c) {
        this.scene.tweens.add({
          targets: [iconEl, barG, countTxt],
          scaleX: { from: 1.35, to: 1 }, scaleY: { from: 1.35, to: 1 },
          duration: 380, ease: 'Back.easeOut',
        });
      }
    });

    this._lastSinCounts = { ...sinCounts };
  }

  destroy() {
    this._elements.forEach(el => { try { el && el.destroy && el.destroy(); } catch {} });
    this._elements = [];
    if (this._hit) { try { this._hit.destroy(); } catch {} this._hit = null; }
  }
}

export default PickedCardsStrip;
