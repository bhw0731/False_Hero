// 🎴 CardPickerModal — 보유 카드 1장 선택 sub-modal (Phase D).
// 용도: 인벤토리 리롤권 / 등급업권 사용 시 대상 카드 선택.
//
// API:
//   showCardPicker(scene, { title, filterFn, onPick, onCancel })
//     filterFn(card) → boolean : 풀 필터 (false 면 피커에 표시 X)
//     onPick(card, origIdx)    : 선택 시 호출 (origIdx = player.pickedCards 의 원본 인덱스)
//     onCancel()                : X 닫기 시 호출
//
// 빈 풀 (필터 통과 0장) 시 "선택 가능한 카드 없음" 메시지 + 닫기 버튼.
// 5×2 = 10장/페이지 페이지네이션 (showPickedCards 와 동일 카드 130×190).

import { createModal } from './Modal.js';
import { addText, FONT } from '../theme.js';
import { CARD_TIER_COLORS, displayCardName } from '../../data/cards.js';

const COLOR_GOLD       = '#C5A059';
const COLOR_TEXT_PRI   = '#E8E8E8';
const COLOR_TEXT_2ND   = '#9A9AA2';
const COLOR_TEXT_MUTED = '#6A6A72';

export function showCardPicker(scene, options = {}) {
  const title    = options.title    || '🎴 카드 선택';
  const filterFn = options.filterFn || (() => true);
  const onPick   = options.onPick   || (() => {});
  const onCancel = options.onCancel || (() => {});

  // 필터 통과한 카드만 — 원본 인덱스 보존
  const all = scene.player.pickedCards || [];
  const filtered = [];
  all.forEach((c, idx) => { if (filterFn(c)) filtered.push({ card: c, origIdx: idx }); });

  // 빈 풀 처리 — 작은 모달 + 안내 + 닫기
  if (filtered.length === 0) {
    let _cancelled = true;
    // [Phase P-28] collapsable 제거 + H 240 → 200 원복 (단순 조회 모달).
    const modal = createModal(scene, {
      title,
      width: 360, height: 200,
      pauseGame: true,
      stashParent: true,   // 부모 (인벤토리/매점) 모달 보존 — close 시 자동 복원.
      onClose: () => { if (_cancelled) onCancel(); },
    });
    const empty = addText(scene, 0, modal.bodyTopY + 50, '선택 가능한 카드 없음', {
      fontFamily: FONT, fontSize: '20px', color: COLOR_TEXT_2ND, fontStyle: '500',
    }).setOrigin(0.5);
    empty.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(empty);
    return;
  }

  // === 페이지네이션 (5×2, 카드 130×190) ===
  const CARD_W = 130, CARD_H = 190, GAP = 12;
  const COLS = 5, ROWS = 2, PER_PAGE = COLS * ROWS;
  const gridW = COLS * CARD_W + (COLS - 1) * GAP;
  const gridH = ROWS * CARD_H + (ROWS - 1) * GAP;
  const modalW = gridW + 60;
  // [Phase P-28] modalH +40 원복 (collapsable 제거).
  const modalH = gridH + 130;

  let _picked = false;
  const modal = createModal(scene, {
    title,
    width: modalW, height: modalH,
    pauseGame: true,
    stashParent: true,   // 부모 (인벤토리/매점) 모달 보존 — close 시 자동 복원.
    onClose: () => { if (!_picked) onCancel(); },
  });

  let currentPage = 0;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  let _pageEls = [];
  const _clearPage = () => { _pageEls.forEach(e => e && e.destroy && e.destroy()); _pageEls = []; };

  const _renderPage = () => {
    _clearPage();
    const startIdx = currentPage * PER_PAGE;
    const slice = filtered.slice(startIdx, startIdx + PER_PAGE);
    const startX = -gridW / 2 + CARD_W / 2;
    const startY = modal.bodyTopY + 20 + CARD_H / 2;

    slice.forEach((entry, i) => {
      const { card, origIdx } = entry;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (CARD_W + GAP);
      const y = startY + row * (CARD_H + GAP);

      const tier = card.tier || card.rarity || 'normal';
      const tierInfo = CARD_TIER_COLORS[tier] || CARD_TIER_COLORS.common;
      const accent = tierInfo.color;

      const cardG = scene.add.graphics();
      cardG.fillStyle(0x000000, 0.4);
      cardG.fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 6);
      cardG.lineStyle(1, accent, 0.6);
      cardG.strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 6);
      cardG.fillStyle(accent, 0.85);
      cardG.fillRect(x - CARD_W / 2 + 4, y - CARD_H / 2 + 1, CARD_W - 8, 1);
      modal.body.add(cardG); _pageEls.push(cardG);

      const tierLbl = addText(scene, x, y - CARD_H / 2 + 12, tierInfo.name || '커먼', {
        fontFamily: FONT, fontSize: '14px', color: tierInfo.hex || COLOR_TEXT_2ND, fontStyle: '700',
      }).setOrigin(0.5);
      tierLbl.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(tierLbl); _pageEls.push(tierLbl);

      const iconTxt = addText(scene, x, y - 50, card.icon || '🃏', {
        fontFamily: FONT, fontSize: '30px',
      }).setOrigin(0.5);
      modal.body.add(iconTxt); _pageEls.push(iconTxt);

      const nameTxt = addText(scene, x, y - 18, displayCardName(card), {
        fontFamily: FONT, fontSize: '16px', color: COLOR_TEXT_PRI, fontStyle: '700',
        align: 'center', wordWrap: { width: CARD_W - 12 },
      }).setOrigin(0.5);
      nameTxt.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(nameTxt); _pageEls.push(nameTxt);

      const descTxt = addText(scene, x, y + 8, card.desc || '', {
        fontFamily: FONT, fontSize: '14px', color: COLOR_TEXT_2ND,
        align: 'center', wordWrap: { width: CARD_W - 12 }, lineSpacing: 2,
      }).setOrigin(0.5);
      modal.body.add(descTxt); _pageEls.push(descTxt);

      // 클릭 hit
      const hit = scene.add.rectangle(x, y, CARD_W, CARD_H, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
      const cardHighlight = (on) => {
        cardG.clear();
        cardG.fillStyle(0x000000, on ? 0.55 : 0.4);
        cardG.fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 6);
        cardG.lineStyle(on ? 2 : 1, accent, on ? 0.9 : 0.6);
        cardG.strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 6);
        cardG.fillStyle(accent, on ? 1 : 0.85);
        cardG.fillRect(x - CARD_W / 2 + 4, y - CARD_H / 2 + 1, CARD_W - 8, 1);
      };
      hit.on('pointerdown', (p, lx, ly, ev) => {
        if (ev) ev.stopPropagation();
        cardHighlight(true);
      });
      hit.on('pointerupoutside', () => cardHighlight(false));
      hit.on('pointerup', () => {
        cardHighlight(false);
        if (_picked) return;
        _picked = true;
        modal.close();
        onPick(card, origIdx);
      });
      modal.body.add(hit); _pageEls.push(hit);
    });
    _refreshPageCtrl();
  };

  // === 페이지 컨트롤 ===
  const ctrlY = modal.bodyBotY - 24;
  const prevBtn = addText(scene, -80, ctrlY, '◀ 이전', {
    fontFamily: FONT, fontSize: '19px', color: COLOR_TEXT_2ND, fontStyle: '700',
  }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
  prevBtn.setShadow(1, 1, '#000000', 2, false, true);
  prevBtn.on('pointerdown', (p, lx, ly, ev) => {
    if (ev) ev.stopPropagation();
    if (currentPage > 0) { currentPage -= 1; _renderPage(); }
  });
  modal.body.add(prevBtn);

  const pageTxt = addText(scene, 0, ctrlY, '', {
    fontFamily: FONT, fontSize: '18px', color: COLOR_GOLD, fontStyle: '700',
  }).setOrigin(0.5);
  pageTxt.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(pageTxt);

  const nextBtn = addText(scene, 80, ctrlY, '다음 ▶', {
    fontFamily: FONT, fontSize: '19px', color: COLOR_TEXT_2ND, fontStyle: '700',
  }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
  nextBtn.setShadow(1, 1, '#000000', 2, false, true);
  nextBtn.on('pointerdown', (p, lx, ly, ev) => {
    if (ev) ev.stopPropagation();
    if (currentPage < totalPages - 1) { currentPage += 1; _renderPage(); }
  });
  modal.body.add(nextBtn);

  const _refreshPageCtrl = () => {
    pageTxt.setText(`${currentPage + 1} / ${totalPages}`);
    prevBtn.setColor(currentPage > 0 ? COLOR_GOLD : COLOR_TEXT_MUTED);
    nextBtn.setColor(currentPage < totalPages - 1 ? COLOR_GOLD : COLOR_TEXT_MUTED);
  };

  _renderPage();
}
