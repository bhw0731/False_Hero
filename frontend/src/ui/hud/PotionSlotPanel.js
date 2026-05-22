// [Phase P-54] 기본 물약 — 우하단 단일 원형 슬롯 + 쿨다운 호 표시.
//
// Player.drinkPotion() / isPotionReady() / getPotionCdRemain() 와 연동.
// 위치: 캔버스 우하단 (1280×600 기준 — x≈1230, y≈540).
// 사용:
//   const panel = new PotionSlotPanel(scene);  // 매 프레임 자동 갱신
//   panel.destroy();                            // GameScene 종료 시.

import { addText, FONT } from '../theme.js';

const R         = 44;               // 원 반지름 — 크게 키움
const DEPTH     = 12;
const LIQ_COLOR = 0xFF5A6A;         // 액체 빨강 (네온)
const LIQ_DARK  = 0xB91C2E;         // 액체 짙은 톤
const GLASS     = 0xFFE6EA;         // 유리 하이라이트 (옅은 핑크 톤)
const CORK      = 0xC5A059;         // 코르크 골드

class PotionSlotPanel {
  constructor(scene) {
    this.scene = scene;
    const W = (scene.scale && scene.scale.width)  || 1280;
    const H = (scene.scale && scene.scale.height) || 600;
    this._cx = W - R - 24;
    this._cy = H - R - 24;

    // 배경 원 (검정 + 흰 외곽)
    this._bgG = scene.add.graphics().setDepth(DEPTH).setScrollFactor(0);
    // 물약 플라스크 (그래픽으로 직접 그림)
    this._flaskG = scene.add.graphics().setDepth(DEPTH + 1).setScrollFactor(0);
    // 쿨다운 호 (오버레이)
    this._cdG = scene.add.graphics().setDepth(DEPTH + 2).setScrollFactor(0);
    // 쿨다운 숫자 (사용 가능 시 숨김)
    this._cdTxt = addText(scene, this._cx, this._cy, '', {
      fontFamily: FONT, fontSize: '22px', color: '#FFFFFF', fontStyle: '900',
    }).setOrigin(0.5).setDepth(DEPTH + 3).setScrollFactor(0);
    this._cdTxt.setShadow(1, 1, '#000000', 4, false, true);
    // 자동 물약 보유 시 우상단 🤖 배지 (다이아 상점 'diamond-auto-potion').
    this._autoBadge = addText(scene, this._cx + R - 8, this._cy - R + 8, '🤖', {
      fontFamily: FONT, fontSize: '14px',
    }).setOrigin(0.5).setDepth(DEPTH + 3).setScrollFactor(0).setVisible(false);
    this._autoBadge.setShadow(1, 1, '#000000', 2, false, true);

    // 클릭 hit
    this._hit = scene.add.circle(this._cx, this._cy, R, 0x000000, 0.001)
      .setDepth(DEPTH + 4).setScrollFactor(0).setInteractive({ useHandCursor: true });
    // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
    this._hit.on('pointerdown', () => { this._hover = true;  this._redraw(); });
    this._hit.on('pointerupoutside', () => { this._hover = false; this._redraw(); });
    this._hit.on('pointerup', () => { this._hover = false; this._redraw(); this._onClick(); });

    // 매 프레임 갱신 — scene update 이벤트 구독.
    this._onUpdate = () => this._redraw();
    scene.events.on('update', this._onUpdate);

    this._hover = false;
    this._redraw();
  }

  _onClick() {
    const player = this.scene.player;
    if (!player || !player.drinkPotion) return;
    if (!player.isPotionReady()) return;
    player.drinkPotion();
    this._redraw();
  }

  _drawFlask(ready) {
    const g = this._flaskG;
    g.clear();
    const cx = this._cx;
    const cy = this._cy;
    const alpha = ready ? 1.0 : 0.45;

    // === 플라스크 본체 (둥근 삼각 플라스크: 좁은 목 + 둥근 몸통) ===
    // 좌표 설계: 본체 중심 (cx, cy+6), 반지름 ~22.
    const bodyR  = 22;
    const bodyCy = cy + 6;
    const neckW  = 12;
    const neckTopY = cy - 26;
    const neckBotY = cy - 8;

    // 액체 — 본체 아래 70% 영역 채움
    // 본체 원 + 상단 면 자르기: 원 그리고 위쪽을 사각으로 잘라낼 수 없으므로,
    // 원을 그리고 그 위로 검은 배경원으로 가리는 대신 — 단순 원 + 상부 highlight 로 표현.
    g.fillStyle(LIQ_DARK, alpha);
    g.fillCircle(cx, bodyCy, bodyR);
    // 밝은 액체 코어 (조금 작게 — 글로우 느낌)
    g.fillStyle(LIQ_COLOR, alpha * 0.92);
    g.fillCircle(cx, bodyCy + 2, bodyR - 3);

    // 유리 본체 외곽 (밝은 하이라이트 링)
    g.lineStyle(2, GLASS, alpha * 0.85);
    g.strokeCircle(cx, bodyCy, bodyR);

    // 유리 광택 — 좌상 둥근 호
    g.lineStyle(2.5, GLASS, alpha * 0.95);
    g.beginPath();
    g.arc(cx, bodyCy, bodyR - 4, Math.PI * 1.05, Math.PI * 1.35, false);
    g.strokePath();

    // === 목 (좁은 직사각형) ===
    g.fillStyle(LIQ_COLOR, alpha * 0.55);
    g.fillRect(cx - neckW / 2, neckBotY - 2, neckW, 8);   // 목 안 액체
    // 목 유리 라인 (양옆)
    g.lineStyle(2, GLASS, alpha * 0.85);
    g.lineBetween(cx - neckW / 2, neckTopY, cx - neckW / 2, neckBotY);
    g.lineBetween(cx + neckW / 2, neckTopY, cx + neckW / 2, neckBotY);

    // === 코르크 ===
    const corkW = 16, corkH = 8;
    g.fillStyle(CORK, alpha);
    g.fillRoundedRect(cx - corkW / 2, neckTopY - corkH, corkW, corkH, 2);
    g.lineStyle(1, 0x000000, alpha * 0.4);
    g.strokeRoundedRect(cx - corkW / 2, neckTopY - corkH, corkW, corkH, 2);

    // === 거품 (작은 흰 원 2개) — 사용 가능 시에만 ===
    if (ready) {
      g.fillStyle(GLASS, 0.85);
      g.fillCircle(cx - 6, bodyCy - 2, 2.2);
      g.fillStyle(GLASS, 0.55);
      g.fillCircle(cx + 7, bodyCy + 5, 1.6);
    }
  }

  _redraw() {
    const player = this.scene.player;
    const ready = !!(player && player.isPotionReady && player.isPotionReady());
    const remainMs = (player && player.getPotionCdRemain) ? player.getPotionCdRemain() : 0;

    // 배경 — 사용 가능 시 등급 외곽 강조 / 쿨다운 중 회색 + hover 시 밝게
    this._bgG.clear();
    const bgAlpha = ready ? (this._hover ? 0.70 : 0.60) : 0.65;
    this._bgG.fillStyle(0x000000, bgAlpha);
    this._bgG.fillCircle(this._cx, this._cy, R);
    // 흰 외곽 미세
    this._bgG.lineStyle(1, 0xFFFFFF, ready ? 0.28 : 0.14);
    this._bgG.strokeCircle(this._cx, this._cy, R);
    if (ready) {
      // 등급 외곽 (초록 글로우 강조)
      this._bgG.lineStyle(2.5, LIQ_COLOR, this._hover ? 1.0 : 0.85);
      this._bgG.strokeCircle(this._cx, this._cy, R);
      // 상단 광택 라인
      this._bgG.lineStyle(1, GLASS, 0.35);
      this._bgG.beginPath();
      this._bgG.arc(this._cx, this._cy, R - 3, Math.PI * 1.15, Math.PI * 1.45, false);
      this._bgG.strokePath();
    }

    // 플라스크
    this._drawFlask(ready);

    // 쿨다운 호 — 남은 비율만큼 어두운 부채꼴
    this._cdG.clear();
    if (!ready && remainMs > 0) {
      const totalMs = 30000;
      const ratio = Math.min(1, remainMs / totalMs);
      const startA = -Math.PI / 2;
      const endA   = startA + Math.PI * 2 * ratio;
      this._cdG.fillStyle(0x000000, 0.62);
      this._cdG.beginPath();
      this._cdG.moveTo(this._cx, this._cy);
      this._cdG.arc(this._cx, this._cy, R - 1, startA, endA, false);
      this._cdG.closePath();
      this._cdG.fillPath();
    }

    // 쿨다운 숫자
    if (!ready && remainMs > 0) {
      this._cdTxt.setText(`${Math.ceil(remainMs / 1000)}`);
    } else {
      this._cdTxt.setText('');
    }
    // 자동 물약 배지 — 보유 시 우상단 표시.
    if (this._autoBadge) {
      const hasAuto = !!(player && player._hasAutoPotion && player._hasAutoPotion());
      this._autoBadge.setVisible(hasAuto);
    }
  }

  // 외부 호환
  refresh() { this._redraw(); }

  destroy() {
    if (this.scene && this.scene.events && this._onUpdate) {
      this.scene.events.off('update', this._onUpdate);
    }
    [this._bgG, this._flaskG, this._cdG, this._cdTxt, this._hit].forEach(o => {
      try { o && o.destroy && o.destroy(); } catch {}
    });
  }
}

export default PotionSlotPanel;
