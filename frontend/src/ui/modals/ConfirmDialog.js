// 확인 다이얼로그 헬퍼 (Phase P-39)
// 두 함수 export:
//   showConfirmDialog — 단순 [예] [아니오] 다이얼로그 (구매/사용/판매 확인용).
//   showActionDialog  — [사용] [판매] [취소] 3 버튼 다이얼로그 (인벤토리 항목 클릭용).
//
// 둘 다 createModal 사용 X — _activeModal 충돌 회피 (매점/인벤토리 위에 떠야 함).
// 자체 container + overlay + ESC 핸들러 직접 구현. depth 1500 (모달 위).

import { addText, FONT, bindHover } from '../theme.js';

const DEPTH = 1500;
const GOLD = 0xC5A059;
const GREY = 0x6A6A72;

function _drawBtn(g, x, y, w, h, color, alpha) {
  g.clear();
  g.fillStyle(0x000000, alpha);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
  g.lineStyle(1, color, 0.7);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 4);
}

function _buildBase(scene, opts) {
  const { width = 400, title = '', message = '' } = opts;
  const minHeight = opts.height || 200;
  const cx = (scene.scale && scene.scale.width || 1280) / 2;
  const cy = (scene.scale && scene.scale.height || 600) / 2;

  // overlay (반투명 검정) — [Phase P-50b] 화면 고정. 0.5 → 0.6 강조.
  const overlay = scene.add.rectangle(cx, cy, scene.scale.width, scene.scale.height, 0x000000, 0.6)
    .setDepth(DEPTH - 1)
    .setScrollFactor(0)
    .setInteractive();

  const container = scene.add.container(cx, cy).setDepth(DEPTH).setScrollFactor(0);

  // === 1단계: 메시지 높이 미리 측정 → 다이얼로그 height 자동 확장 ===
  // 제목 영역 (44) + 메시지 + 버튼 영역 (64) ≥ minHeight.
  const TITLE_AREA = 56;    // -h/2 ~ -h/2 + 56 (제목 + 라인)
  const BTN_AREA   = 72;    // 하단 버튼 (btnY = h/2 - 32, h=36)
  const msgTxt = addText(scene, 0, 0, message, {
    fontFamily: FONT, fontSize: '18px', color: '#E8E8E8', align: 'center',
    wordWrap: { width: width - 40 }, lineSpacing: 4,
  }).setOrigin(0.5, 0).setScrollFactor(0);
  const msgH = msgTxt.height;
  const needH = TITLE_AREA + msgH + BTN_AREA;
  const height = Math.max(minHeight, needH);

  // === 2단계: 배경 그리기 (확장된 height 반영) ===
  const bg = scene.add.graphics();
  bg.fillStyle(0x070A12, 0.92);
  bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
  bg.lineStyle(1, 0xFFFFFF, 0.18);
  bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
  container.add(bg);

  // 제목 — 흰색
  const titleTxt = addText(scene, 0, -height / 2 + 26, title, {
    fontFamily: FONT, fontSize: '20px', color: '#E8E8E8', fontStyle: '700', align: 'center',
  }).setOrigin(0.5).setScrollFactor(0);
  container.add(titleTxt);

  // 제목 아래 골드 미세 라인
  const titleLine = scene.add.graphics();
  titleLine.fillStyle(0xC5A059, 0.4);
  titleLine.fillRect(-24, -height / 2 + 44, 48, 1);
  container.add(titleLine);

  // 메시지 — 제목 영역 아래 중앙 정렬 (TITLE_AREA + 여백 14)
  msgTxt.setPosition(0, -height / 2 + TITLE_AREA + 14);
  container.add(msgTxt);

  // [Phase P-54] 등장 트윈 — Modal.js 와 통일 (scale 0.92→1, alpha 0→1, 240ms Back.easeOut).
  container.alpha = 0;
  container.setScale(0.92);
  scene.tweens.add({
    targets: container, alpha: 1, scaleX: 1, scaleY: 1,
    duration: 240, ease: 'Back.easeOut',
  });
  overlay.alpha = 0;
  scene.tweens.add({ targets: overlay, alpha: 1, duration: 220, ease: 'Sine.easeOut' });

  return { overlay, container, width, height };
}

function _attachEsc(scene, closeFn) {
  const handler = (ev) => {
    if (ev.code === 'Escape' || ev.key === 'Escape') {
      // 아래 Modal ESC 와 동시 발화 방지 — 다이얼로그만 닫음.
      if (ev.stopPropagation) ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      closeFn();
    }
  };
  if (scene.input && scene.input.keyboard) scene.input.keyboard.on('keydown', handler);
  return () => {
    if (scene.input && scene.input.keyboard) scene.input.keyboard.off('keydown', handler);
  };
}

// === 단순 확인 다이얼로그 — [예] [아니오] ===
//   opts: { title, message, onConfirm, onCancel }
export function showConfirmDialog(scene, opts = {}) {
  const { onConfirm = () => {}, onCancel = () => {}, overlayCloses = true } = opts;
  const { overlay, container, width, height } = _buildBase(scene, opts);

  let _closed = false;
  const close = (confirmed) => {
    if (_closed) return;
    _closed = true;
    detachEsc();
    overlay.destroy();
    container.destroy();
    if (confirmed) onConfirm(); else onCancel();
  };
  const detachEsc = _attachEsc(scene, () => close(false));

  overlay.on('pointerdown', (p, lx, ly, ev) => {
    if (ev) ev.stopPropagation();
    // [Phase P-54] overlayCloses 옵션 — false 시 외곽 클릭으로 닫히지 않음 (이벤트 모달에서 사용).
    if (overlayCloses) close(false);
  });

  // 예 / 아니오 버튼 (가운데 ±60)
  const btnY = height / 2 - 32, btnW = 90, btnH = 36;
  const buttons = [
    { x: -55, label: '예',     color: GOLD, txt: '#C5A059', onClick: () => close(true) },
    { x:  55, label: '아니오', color: GREY, txt: '#9A9AA2', onClick: () => close(false) },
  ];
  buttons.forEach(b => {
    const g = scene.add.graphics();
    _drawBtn(g, b.x, btnY, btnW, btnH, b.color, 0.5);
    container.add(g);
    const t = addText(scene, b.x, btnY, b.label, {
      fontFamily: FONT, fontSize: '20px', color: b.txt, fontStyle: '700',
    }).setOrigin(0.5).setScrollFactor(0);
    container.add(t);
    const hit = scene.add.rectangle(b.x, btnY, btnW, btnH, 0x000000, 0.001).setScrollFactor(0).setInteractive({ useHandCursor: true });
    bindHover(hit,
      () => _drawBtn(g, b.x, btnY, btnW, btnH, b.color, 0.7),
      () => _drawBtn(g, b.x, btnY, btnW, btnH, b.color, 0.5));
    hit.on('pointerdown', (p, lx, ly, ev) => {
      if (ev) ev.stopPropagation();
      b.onClick();
    });
    container.add(hit);
  });
}

// === 액션 다이얼로그 — [사용] [판매] [취소] 3 버튼 ===
//   opts: { title, message, canSell, onUse, onSell, onCancel }
//   canSell=false 시 [판매] 버튼 alpha 0.4 + disableInteractive (시각 비활성).
export function showActionDialog(scene, opts = {}) {
  const { canSell = true, onUse = () => {}, onSell = () => {}, onCancel = () => {} } = opts;
  const { overlay, container, width, height } = _buildBase(scene, { ...opts, width: opts.width || 420, height: opts.height || 200 });

  let _closed = false;
  let _action = null;
  const close = () => {
    if (_closed) return;
    _closed = true;
    detachEsc();
    overlay.destroy();
    container.destroy();
    if (_action === 'use') onUse();
    else if (_action === 'sell') onSell();
    else onCancel();
  };
  const detachEsc = _attachEsc(scene, close);

  overlay.on('pointerdown', (p, lx, ly, ev) => {
    if (ev) ev.stopPropagation();
    close();
  });

  // 사용 / 판매 / 취소 (3 버튼 등간격)
  const btnY = height / 2 - 32, btnW = 100, btnH = 36;
  const buttons = [
    { x: -120, label: '사용', color: GOLD,     txt: '#C5A059', enabled: true,    action: 'use' },
    { x:    0, label: '판매', color: 0xF87171, txt: '#F87171', enabled: canSell, action: 'sell' },
    { x:  120, label: '취소', color: GREY,     txt: '#9A9AA2', enabled: true,    action: null },
  ];
  buttons.forEach(b => {
    const alpha = b.enabled ? 0.5 : 0.2;
    const g = scene.add.graphics();
    _drawBtn(g, b.x, btnY, btnW, btnH, b.color, alpha);
    if (!b.enabled) g.setAlpha(0.4);
    container.add(g);
    const t = addText(scene, b.x, btnY, b.label, {
      fontFamily: FONT, fontSize: '20px', color: b.txt, fontStyle: '700',
    }).setOrigin(0.5).setScrollFactor(0);
    if (!b.enabled) t.setAlpha(0.4);
    container.add(t);
    const hit = scene.add.rectangle(b.x, btnY, btnW, btnH, 0x000000, 0.001);
    if (b.enabled) {
      hit.setScrollFactor(0).setInteractive({ useHandCursor: true });
      bindHover(hit,
        () => _drawBtn(g, b.x, btnY, btnW, btnH, b.color, 0.7),
        () => _drawBtn(g, b.x, btnY, btnW, btnH, b.color, 0.5));
      hit.on('pointerdown', (p, lx, ly, ev) => {
        if (ev) ev.stopPropagation();
        _action = b.action;
        close();
      });
    }
    container.add(hit);
  });
}
