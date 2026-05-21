// 🎒 인벤토리 모달 — Player.bag 보관 항목 조회 + 사용.
// 4×3 = 12 슬롯, 카드 110×140. 600×500 모달, 본문 460px (헤더 40 제외).
//
// 클릭 동작:
//   type 'consumable' / 'utility' → use(player, scene) 호출 + 가방에서 제거
//   type 'passive'                → 자동 발동 항목, 사용 X (정보만 표시)
//
// 상점에서만 사용 가능한 항목 (onlyInShop) 은 cardSelectionActive=false 시 비활성.
//
// pauseGame: false — 가방은 게임 중 즉시 열어 사용 (기존 showBag 패턴 유지).

import { createModal } from './Modal.js';
import { addText, FONT } from './theme.js';
import { showCardPicker } from './CardPickerModal.js';
import { commonCards, displayCardName } from '../data/cards.js';
import { showConfirmDialog, showActionDialog } from './ConfirmDialog.js';

// 판매 whitelist (구매가 × 60%, Math.floor).
//   등급업권 7종 / 부적 — 8종.
//   부활석 / 다이아 부활석 / 다이아 등급업권 / 다이아 보스 약화 — 판매 X.
const SELL_PRICES = {
  'amulet':           Math.floor(70 * 0.6),  // 42 (Phase P-54 가격 80→70 변경)
  'upgrade-wrath':    Math.floor(180 * 0.6), // 108
  'upgrade-greed':    Math.floor(180 * 0.6),
  'upgrade-sloth':    Math.floor(180 * 0.6),
  'upgrade-pride':    Math.floor(180 * 0.6),
  'upgrade-lust':     Math.floor(180 * 0.6),
  'upgrade-envy':     Math.floor(180 * 0.6),
  'upgrade-gluttony': Math.floor(180 * 0.6),
};
function _canSell(card) {
  return !!(card && card.id && SELL_PRICES[card.id] !== undefined);
}
function _sellPriceOf(card) {
  return (card && card.id && SELL_PRICES[card.id]) || 0;
}

const COLOR_GOLD     = '#C5A059';
const COLOR_TEXT_PRI = '#E8E8E8';
const COLOR_TEXT_2ND = '#9A9AA2';
const COLOR_DIM      = '#5A5A5F';

// type → 라벨 / 색
const TYPE_META = {
  consumable: { label: '🎁 소모품',  color: '#6AD8FF' },
  passive:    { label: '✨ 자동 발동', color: '#C084FC' },
  utility:    { label: '🔧 기능',     color: '#FFD166' },
};

export function showInventory(scene) {
  if (scene._activeModal && !scene._activeModal._closed) return;

  // [Phase P-28] collapsable 제거 + H 540 → 500 원복 (단순 조회 모달, 다른 화면 클릭 시 자동 close).
  const W = 600, H = 500;
  const modal = createModal(scene, {
    title: '인벤토리',
    width: W, height: H,
    pauseGame: false,
  });

  // 그리드 레이아웃 — 4×3, 카드 110×140, 간격 10
  const COLS = 4, ROWS = 3;
  const CARD_W = 110, CARD_H = 140, GAP = 10;
  const gridW = COLS * CARD_W + (COLS - 1) * GAP;
  const gridH = ROWS * CARD_H + (ROWS - 1) * GAP;
  const startX = -gridW / 2 + CARD_W / 2;
  const startY = modal.bodyTopY + 16 + CARD_H / 2;

  // 클릭 토글 detail — 같은 슬롯 재클릭 시 닫힘
  let _selectedIdx = null;
  let _detail = null;

  const closeDetail = () => {
    if (_detail) { _detail.destroy(); _detail = null; }
    _selectedIdx = null;
  };

  const renderSlots = () => {
    modal.body.removeAll(true);
    closeDetail();

    const bag = scene.player.bag || [];
    const total = COLS * ROWS;

    for (let i = 0; i < total; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = startX + col * (CARD_W + GAP);
      const sy = startY + row * (CARD_H + GAP);
      const card = bag[i];
      const accent = card ? (card.color || 0xC5A059) : 0xC5A059;
      const baseAlpha = card ? 0.4 : 0.15;

      // 카드 배경 + 보더
      const slotG = scene.add.graphics().setPosition(sx, sy);
      const drawSlot = (a) => {
        slotG.clear();
        slotG.fillStyle(0x000000, a);
        slotG.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);
        if (card) {
          slotG.lineStyle(2, accent, 0.7);
          slotG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);
          slotG.fillStyle(accent, 0.85);
          slotG.fillRect(-CARD_W / 2 + 4, -CARD_H / 2 + 1, CARD_W - 8, 1);
        } else {
          slotG.lineStyle(1, 0xFFFFFF, 0.12);
          slotG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);
        }
      };
      drawSlot(baseAlpha);
      modal.body.add(slotG);

      if (!card) continue;

      // 카테고리 라벨 (상단)
      const meta = TYPE_META[card.type] || (card.passive ? TYPE_META.passive : TYPE_META.consumable);
      const catLbl = addText(scene, sx, sy - CARD_H / 2 + 10, meta.label, {
        fontFamily: FONT, fontSize: '14px', color: meta.color, fontStyle: '700',
      }).setOrigin(0.5, 0);
      catLbl.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(catLbl);

      // 큰 아이콘
      const iconChar = card.icon || (card.name && card.name[0]) || '?';
      const iconTxt = addText(scene, sx, sy - 14, iconChar, {
        fontFamily: FONT, fontSize: '36px',
      }).setOrigin(0.5);
      modal.body.add(iconTxt);

      // 이름
      const nameTxt = addText(scene, sx, sy + 26, card.name || '', {
        fontFamily: FONT, fontSize: '16px', color: COLOR_TEXT_PRI, fontStyle: '700',
        align: 'center', wordWrap: { width: CARD_W - 12 },
      }).setOrigin(0.5, 0);
      nameTxt.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(nameTxt);

      // 사용 가능 여부 — passive 는 항상 X. onlyInShop 는 상점 중에만.
      const isPassive  = card.type === 'passive' || (!card.type && card.passive);
      const isShopOnly = !!card.onlyInShop;
      const hasDispatch = !isPassive && (typeof card.use === 'function' || _hasBuiltinUse(card));
      const usable     = hasDispatch && (!isShopOnly || scene.cardSelectionActive);

      // 클릭 hit
      const hit = scene.add.rectangle(sx, sy, CARD_W, CARD_H, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
      hit.on('pointerdown',      () => drawSlot(0.6));
      hit.on('pointerupoutside', () => drawSlot(baseAlpha));
      hit.on('pointerup', () => {
        drawSlot(baseAlpha);
        if (modal._closed) return;
        if (!usable) {
          // passive / 사용 불가 / 미구현 → detail 토글
          if (_selectedIdx === i) { closeDetail(); return; }
          closeDetail();
          _selectedIdx = i;
          _detail = buildDetail(scene, modal, card, isPassive, isShopOnly, hasDispatch);
          modal.body.add(_detail);
          return;
        }
        // [Phase P-39] usable 항목 클릭 → 사용/판매/취소 액션 다이얼로그.
        const sellPrice = _sellPriceOf(card);
        showActionDialog(scene, {
          title: card.name || '',
          message: '무엇을 하시겠습니까?',
          canSell: _canSell(card),
          onUse: () => {
            // 사용 확인 다이얼로그 → 옛 디스패치 흐름.
            showConfirmDialog(scene, {
              title: card.name || '',
              message: '사용하시겠습니까?',
              onConfirm: () => {
                if (modal._closed) return;
                const consumed = (typeof card.use === 'function')
                  ? (card.use(scene.player, scene), true)
                  : _useBuiltin(card, scene.player, scene);
                if (modal._closed) return;
                if (!consumed) { renderSlots(); return; }
                if (card.id !== 'shop-reroll' && scene._addUsedBagBadge) scene._addUsedBagBadge(card);
                const idx = scene.player.bag.indexOf(card);
                if (idx !== -1) scene.player.bag.splice(idx, 1);
                if (scene.updateInfoText) scene.updateInfoText();
                if (card.id === 'shop-reroll') { modal.close(); return; }
                renderSlots();
              },
            });
          },
          onSell: () => {
            // 판매 확인 다이얼로그.
            showConfirmDialog(scene, {
              title: card.name || '',
              message: `판매하시겠습니까? (+${sellPrice} 골드)`,
              onConfirm: () => {
                if (modal._closed) return;
                scene.player.stats.gold = (scene.player.stats.gold || 0) + sellPrice;
                const idx = scene.player.bag.indexOf(card);
                if (idx !== -1) scene.player.bag.splice(idx, 1);
                if (scene.updateInfoText) scene.updateInfoText();
                if (scene.events && scene.events.emit) scene.events.emit('toast', `🪙 +${sellPrice} 골드`);
                renderSlots();
              },
            });
          },
        });
      });
      modal.body.add(hit);
    }
  };

  renderSlots();
}

// === 상세 패널 — passive / 사용 불가 / use 미구현 항목 클릭 시 ===
function buildDetail(scene, modal, card, isPassive, isShopOnly, hasUseFn = true) {
  const W = modal.w - 40;
  const H = 64;
  const cy = modal.bodyBotY - H / 2 - 8;
  const c = scene.add.container(0, cy);

  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.85);
  bg.fillRoundedRect(-W / 2, -H / 2, W, H, 6);
  bg.lineStyle(1, 0xC5A059, 0.4);
  bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 6);
  c.add(bg);

  const iconTxt = addText(scene, -W / 2 + 22, 0, card.icon || '?', {
    fontFamily: FONT, fontSize: '28px',
  }).setOrigin(0.5);
  c.add(iconTxt);

  const nameTxt = addText(scene, -W / 2 + 50, -H / 2 + 8, card.name || '', {
    fontFamily: FONT, fontSize: '18px', color: COLOR_GOLD, fontStyle: '800',
  }).setOrigin(0, 0);
  nameTxt.setShadow(1, 1, '#000000', 2, false, true);
  c.add(nameTxt);

  let hint = '';
  if (isPassive)         hint = '자동 발동 — 클릭으로 사용 불가';
  else if (isShopOnly)   hint = '상점 진행 중에만 사용 가능';
  else if (!hasUseFn)    hint = '사용 기능 준비 중';
  const descLine = (card.desc || '').replace(/\n/g, ' ');
  const detailMsg = hint ? `${descLine}\n${hint}` : descLine;
  const descTxt = addText(scene, -W / 2 + 50, -H / 2 + 26, detailMsg, {
    fontFamily: FONT, fontSize: '15px', color: COLOR_TEXT_2ND,
    wordWrap: { width: W - 60 }, lineSpacing: 2,
  }).setOrigin(0, 0);
  c.add(descTxt);

  return c;
}

// === 내장 디스패처 — SHOP_POOL bag.push 항목 (use 함수 미정의) 처리 ===
// 매점 풀 항목은 메타필드만 가지고 bag 에 들어옴 — 여기서 id/type/메타로 분기.
// 반환: true = 즉시 사용 완료 (인벤토리에서 splice) / false = 거부 또는 sub-modal 인계.
//   upgrade-* / diamond-upgrade 는 sub-modal (CardPickerModal) 을 열고 false 반환 —
//   sub-modal 의 onPick 이 직접 player.bag 에서 splice 처리.
export function hasBuiltinUse(card) { return _hasBuiltinUse(card); }
export function useBuiltin(card, player, scene) { return _useBuiltin(card, player, scene); }

function _hasBuiltinUse(card) {
  if (!card || !card.id) return false;
  // [Phase P-54] potion-* 케이스 제거 — 기본 물약 (쿨다운) 으로 대체.
  if (card.id === 'amulet') return true;
  // [Phase P-39] reroll-token 케이스 제거.
  if (card.id.startsWith && card.id.startsWith('upgrade-')) return true;
  if (card.id === 'diamond-upgrade') return true;
  return false;
}

function _useBuiltin(card, player, scene) {
  const emit = (msg) => {
    if (scene.events && scene.events.emit) scene.events.emit('toast', msg);
  };

  // [Phase P-54] potion-* 사용 로직 제거 — 기본 물약 (쿨다운) 으로 대체.

  // [무한 맵] 부적 — 다음 N마리 처치 EXP ×M (즉시 활성).
  if (card.id === 'amulet') {
    const mul = card.expMul || 2.0;
    const kills = card.killCount || 20;
    player._nextKillsExpMul = mul;
    player._nextKillsExpRemain = (player._nextKillsExpRemain || 0) + kills;  // 누적 가능
    emit(`📿 다음 ${kills}마리 EXP ×${mul.toFixed(1)}`);
    return true;
  }

  // [Phase P-39] reroll-token (카드 리롤권) 사용 케이스 제거.

  // 다이아 등급업권 (Phase I) — 모든 죄 카드 중 선택 가능 (legend 제외).
  // 선택 카드의 같은 죄 + 다음 등급 풀에서 무작위 1장 교체.
  if (card.id === 'diamond-upgrade') {
    const all = (player.pickedCards || []);
    if (all.length === 0) {
      emit('⚠ 보유 카드 없음');
      return false;
    }
    const upgradable = all.filter(c => (c.tier || c.rarity) !== 'legend');
    if (upgradable.length === 0) {
      emit('⚠ 보유 카드 모두 레전드 — 업그레이드 불가');
      return false;
    }
    showCardPicker(scene, {
      title: '⭐ 다이아 등급업권: 카드 선택 (모든 죄)',
      filterFn: (c) => (c.tier || c.rarity) !== 'legend',
      onPick: (oldCard, oldIdx) => {
        const rarities = ['normal','rare','legend'];  // [Phase P-54] 3등급
        const oldTier = oldCard.tier || oldCard.rarity || 'normal';
        const oldI = rarities.indexOf(oldTier);
        const newTier = rarities[Math.min(rarities.length - 1, (oldI < 0 ? 0 : oldI) + 1)];
        // 같은 죄 + 새 등급 풀에서 무작위
        const candidates = commonCards.filter(c => c.sin === oldCard.sin && c.rarity === newTier);
        if (candidates.length === 0) {
          emit(`⚠ ${oldCard.sin || ''} ${newTier} 풀 비어있음`);
          return;
        }
        const newCard = candidates[Math.floor(Math.random() * candidates.length)];
        const ok = player.swapPickedCard(oldIdx, newCard);
        if (!ok) { emit('⚠ 카드 교체 실패'); return; }
        const bagIdx = player.bag.indexOf(card);
        if (bagIdx !== -1) player.bag.splice(bagIdx, 1);
        if (scene.updateInfoText) scene.updateInfoText();
        emit(`⭐ ${displayCardName(oldCard)} → ${displayCardName(newCard)} (${newTier})`);
      },
      onCancel: () => {},
    });
    return false;
  }

  // 등급업권 — 해당 죄 카드만 선택 가능, 같은 죄 + 다음 등급 풀에서 무작위 1장
  if (card.id && card.id.startsWith('upgrade-')) {
    const targetSin = card.upgradeSin;
    if (!targetSin) { emit('⚠ 등급업권 데이터 오류'); return false; }
    const sinAll = (player.pickedCards || []).filter(c => c.sin === targetSin);
    if (sinAll.length === 0) {
      emit(`⚠ ${targetSin} 카드를 보유해야 합니다`);
      return false;
    }
    // legend 는 더 이상 업그레이드 불가 — 필터에서 제외
    const upgradable = sinAll.filter(c => (c.tier || c.rarity) !== 'legend');
    if (upgradable.length === 0) {
      emit(`⚠ ${targetSin} 보유 카드 모두 레전드 — 업그레이드 불가`);
      return false;
    }
    showCardPicker(scene, {
      title: `⬆ ${targetSin} 등급업권: 카드 선택`,
      filterFn: (c) => c.sin === targetSin && (c.tier || c.rarity) !== 'legend',
      onPick: (oldCard, oldIdx) => {
        const rarities = ['normal','rare','legend'];  // [Phase P-54] 3등급
        const oldTier = oldCard.tier || oldCard.rarity || 'normal';
        const oldI = rarities.indexOf(oldTier);
        const newTier = rarities[Math.min(rarities.length - 1, (oldI < 0 ? 0 : oldI) + 1)];
        // 같은 죄 + 새 등급 풀에서 무작위 (commonCards.rarity 매칭 — 카드 schema 가 rarity)
        const candidates = commonCards.filter(c => c.sin === targetSin && c.rarity === newTier);
        if (candidates.length === 0) {
          emit(`⚠ ${targetSin} ${newTier} 풀 비어있음`);
          return;
        }
        const newCard = candidates[Math.floor(Math.random() * candidates.length)];
        const ok = player.swapPickedCard(oldIdx, newCard);
        if (!ok) { emit('⚠ 카드 교체 실패'); return; }
        const bagIdx = player.bag.indexOf(card);
        if (bagIdx !== -1) player.bag.splice(bagIdx, 1);
        if (scene.updateInfoText) scene.updateInfoText();
        emit(`⬆ ${displayCardName(oldCard)} → ${displayCardName(newCard)} (${newTier})`);
      },
      onCancel: () => {},
    });
    return false;
  }

  return false;
}
