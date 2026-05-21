// 소지품 / 카드 모달 (gameplay-progression UI)
//   - showCardSelection   레벨업 시 3장 카드 픽 (등급 가중치 + 스테이지 곡선)
//   - showBag             🎒 가방 — 보유 특수 카드 24슬롯 (8×3)
//   - showPurchasedItems  소지품 — 좌측 캐릭터/8슬롯 + 우측 인벤토리 그리드
//   - showPickedCards     🃏 뽑은 카드 — 동적 사이즈 그리드
//
// 모달 간 호출 (showCardSelection → showShop) 은 scene.showShop() 으로 위임 — GameScene wrapper 필요.

import { createModal } from './Modal.js';
import { makeGlassBtn } from './glassBtn.js';
import { gameSettings } from '../data/settings.js';
import { sound } from '../systems/SoundManager.js';
import { commonCards, CARD_TIER_COLORS, getRarityWeights, pickRarity, displayCardName } from '../data/cards.js';
import { omnipotentCard } from '../data/cards/omnipotentCard.js';
import { SIN_LIST, SIN_NAMES, SIN_COLORS } from '../data/sins.js';
import { SLOTS } from '../data/items.js';
import { PASSIVES } from '../data/passives.js';
import { FONT, addText } from './theme.js';
import { showConfirmDialog } from './ConfirmDialog.js';
import { hasBuiltinUse, useBuiltin } from './InventoryModal.js';

const COLOR_GOLD       = '#C5A059';
const COLOR_TEXT_PRI   = '#E8E8E8';
const COLOR_TEXT_2ND   = '#9A9AA2';
const COLOR_TEXT_MUTED = '#6A6A72';

// === 카드 추출 — 슬롯별 sin 가중치 + 스테이지별 등급 가중치 (private) ===
// 슬롯 1: activeSin 40% / 다른 6죄 10%씩 (activeSin null 시 7죄 평등)
// 슬롯 2~4: 7죄 평등 (14.3%씩)
// 등급: getRarityWeights(stage) 가중치로 추첨 (1-3스 / 4-7스 / 8-10스 그룹)
// 한 픽 안 4장 중복 X + 한 스테이지 안 동일 카드 중복 X (player._pickedCardIdsThisStage)
// 풀 부족 시 폴백: 등급 한 단계 낮춤 (legend→epic→rare→normal). [Phase M1] 4등급
// [Phase P-54] 4등급 → 3등급 (epic 제거)
const TIER_ORDER = ['normal', 'rare', 'legend'];

function _pickSinForSlot(slotIdx, player) {
  if (slotIdx === 0 && player && player.activeSin) {
    if (Math.random() < 0.4) return player.activeSin;
    const others = SIN_LIST.filter(s => s !== player.activeSin);
    return others[Math.floor(Math.random() * others.length)];
  }
  return SIN_LIST[Math.floor(Math.random() * SIN_LIST.length)];
}

// rarity 보강(boost) — '카드픽 등급 +1' 휴식 상점 효과 적용.
// rarity 단계를 boost 만큼 끌어올림 (legendary 가 최상위, 캡).
function _boostRarity(rarity, boost) {
  if (!boost || boost <= 0) return rarity;
  const idx = TIER_ORDER.indexOf(rarity);
  if (idx < 0) return rarity;
  return TIER_ORDER[Math.min(idx + boost, TIER_ORDER.length - 1)];
}

// 죄+등급 풀에서 카드 1장 무작위 (사용 카드 제외).
function _pickFromSinAndRarity(pool, sin, rarity, used) {
  const filtered = pool.filter(c => c.sin === sin && (c.rarity || c.tier || 'normal') === rarity && !used.has(c.id));
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// 카드 슬롯 추출 (Phase P-1: count=3 기본) — 슬롯별 sin 가중치 × 스테이지별 등급 가중치 + 중복 방지 + 폴백.
//   슬롯 0: activeSin 40% / 다른 6죄 10%씩 (_pickSinForSlot)
//   슬롯 1~ : 7죄 균등 14.3%
// [Phase M-B1] 만능 카드 등장 — _shouldShowOmnipotent() 통과 시 한 슬롯 강제 차지 (3개 중 1개).
//              omnipotentCard === null (M-B9 작성 전) 이면 등장 가드 자동 폴백 (일반 카드).
function pickCardsForSlots(pool, count, stage, player) {
  const boost = (player && player.nextCardPickRarityBoost) || 0;
  const stageWeights = getRarityWeights(stage);
  // 한 스테이지 안 픽한 카드 + 한 픽 안 슬롯 중복 둘 다 추적
  const stagePicked = new Set((player && player._pickedCardIdsThisStage) || []);
  const used = new Set([...stagePicked]);   // 슬롯+스테이지 합집합
  const result = [];

  // [Phase M-B1] 만능 카드 슬롯 — 한 픽당 1슬롯 차지 (등장 시). 데이터 미작성 시 X.
  const omniSlot = (omnipotentCard && player && player._shouldShowOmnipotent && player._shouldShowOmnipotent())
    ? Math.floor(Math.random() * count)
    : -1;

  for (let slot = 0; slot < count; slot++) {
    if (slot === omniSlot && omnipotentCard) {
      result.push(omnipotentCard);
      used.add(omnipotentCard.id);
      continue;
    }
    let picked = null;
    let attempts = 40;
    while (attempts-- > 0) {
      const sin = _pickSinForSlot(slot, player);
      const baseRarity = pickRarity(stageWeights);
      const rarity = _boostRarity(baseRarity, boost);

      // 폴백 — 해당 죄+등급 풀이 비면 등급 한 단계씩 낮춤
      let tierIdx = TIER_ORDER.indexOf(rarity);
      while (tierIdx >= 0 && !picked) {
        picked = _pickFromSinAndRarity(pool, sin, TIER_ORDER[tierIdx], used);
        if (picked) break;
        tierIdx -= 1;
      }
      if (picked) break;
    }
    // 최종 폴백 — sin 무관, 잔여 전체 풀에서 무작위
    if (!picked) {
      const remaining = pool.filter(c => !used.has(c.id));
      if (remaining.length === 0) break;
      picked = remaining[Math.floor(Math.random() * remaining.length)];
    }
    if (picked) {
      used.add(picked.id);
      result.push(picked);
    }
  }
  return result;
}

// === 카드 선택 모달 ===
export function showCardSelection(scene) {
  scene.cardSelectionActive = true;

  // 카드 풀이 비어있는 경우 (카드 작성 중) — 모달 안 뜨고 즉시 다음 단계로
  if (commonCards.length === 0) {
    console.warn('[card-pick] commonCards pool empty — skipping card selection');
    scene.player.pendingLevelUps = 0;
    scene.cardSelectionActive = false;
    // [무한 맵] 옛 _isNextWaveBoss / 매점 배너 / _scheduleAutoAdvance 호출 폐기.
    //   적이 미리 배치되어 있고 플레이어가 진행하며 만남 — 카드 선택 후 게임 자동 재개.
    scene.cardFlowMode = null;
    return;
  }

  const stage = (scene.waveSystem && scene.waveSystem.currentStage) || 1;
  // [Phase P-1] 카드픽 4장 → 3장.
  const desired = 3;

  // 중복 픽 금지 — 이미 보유한 카드(name 매칭)는 후보 풀에서 제외.
  // 풀이 desired 미만이면 전체 풀로 폴백 (모든 카드 보유 시).
  const pickedIds = new Set((scene.player.pickedCards || []).map(c => c.id));
  const filteredPool = commonCards.filter(c => !pickedIds.has(c.id));
  const pool = filteredPool.length >= desired ? filteredPool : commonCards;
  if (filteredPool.length < desired) {
    console.warn(`[card-pick] filtered pool too small (${filteredPool.length}/${desired}) — falling back to full pool`);
  }
  const choiceCount = Math.min(desired, pool.length);
  const choices = pickCardsForSlots(pool, choiceCount, stage, scene.player);
  // 카드픽 등급 보장 1회성 — 후보 추출 직후 자동 리셋
  if (scene.player.nextCardPickRarityBoost) scene.player.nextCardPickRarityBoost = 0;

  // [Phase P-54] 카드 모달 — 미니멀 글래스 톤, 죄/등급/이름/설명 균형 배치.
  const W = 700, H = 400;
  const remaining = scene.player.pendingLevelUps;
  const titleStr = remaining > 1 ? `🃏 카드 선택 (${remaining}회 남음)` : '🃏 카드 선택';
  const modal = createModal(scene, {
    title: titleStr,
    width: W, height: H,
    pauseGame: true,
    overlayCloses: false,
    // [Phase P-23] ESC 로 close 차단 — cardSelectionActive 흐름 강제 (카드 선택 강제).
    escCloses: false,
    // [Phase P-25] collapsable: true — Modal.js 표준 접기 ▼ + 펼치기 ▲ 사용.
    //   showCloseButton 디폴트 false (P-25 변경) — X 버튼 자동 제거.
    collapsable: true,
  });

  // Phase H — 5/10스 대형 스테이지 표시 (헤더 우측)
  const curStageCS = (scene.waveSystem && scene.waveSystem.currentStage) || 1;
  if (curStageCS === 5 || curStageCS === 10) {
    const csBadge = addText(scene, modal.w / 2 - 16, -modal.h / 2 + 20, '🔥 대형 스테이지', {
      fontFamily: FONT, fontSize: '16px', color: '#FFD700', fontStyle: '700',
    }).setOrigin(1, 0.5);
    csBadge.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(csBadge);
  }

  // [Phase P-54] 카드 200×260 — 미니멀 글래스, 죄 아이콘 제거, 컨텐츠 균형 배치.
  const CARD_W = 200, CARD_H = 260, CARD_GAP = 18;
  const N = choices.length;
  const totalW = N * CARD_W + (N - 1) * CARD_GAP;
  const startX = -totalW / 2 + CARD_W / 2;
  const cardCy = modal.bodyTopY + 12 + CARD_H / 2;

  choices.forEach((card, i) => {
    const x = startX + i * (CARD_W + CARD_GAP);
    const tierInfo = CARD_TIER_COLORS[card.tier || card.rarity || 'normal'] || CARD_TIER_COLORS.normal;
    const isOmni  = !!card.isOmnipotent;
    const accent  = isOmni ? 0xFFD700 : tierInfo.color;
    const tierHex = isOmni ? '#FFD700' : tierInfo.hex;
    const tierName = isOmni ? '만능' : tierInfo.name;
    const sinName  = card.sin ? SIN_NAMES[card.sin] || card.sin : '';
    const sinHex   = card.sin ? SIN_COLORS[card.sin] || '#FFFFFF' : '#FFFFFF';

    const cardG = scene.add.graphics().setPosition(x, cardCy);
    const drawCard = (hovered = false) => {
      cardG.clear();
      // 글래스 베이스
      cardG.fillStyle(0x000000, hovered ? 0.70 : 0.55);
      cardG.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
      // 상단 광택 라인
      cardG.fillStyle(0xFFFFFF, 0.05);
      cardG.fillRect(-CARD_W / 2 + 8, -CARD_H / 2 + 2, CARD_W - 16, 1);
      // 상단 등급 색 바 (3px 라운드)
      cardG.fillStyle(accent, hovered ? 1.0 : 0.90);
      cardG.fillRoundedRect(-CARD_W / 2 + 4, -CARD_H / 2 + 4, CARD_W - 8, 3, 2);
      // 흰 외곽 미세
      cardG.lineStyle(1, 0xFFFFFF, hovered ? 0.30 : 0.18);
      cardG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
      // 등급 외곽
      cardG.lineStyle(hovered ? 2.5 : 1.5, accent, hovered ? 0.95 : 0.55);
      cardG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
      // 만능 — 추가 외곽 글로우
      if (isOmni) {
        cardG.lineStyle(2.5, accent, 0.95);
        cardG.strokeRoundedRect(-CARD_W / 2 - 1, -CARD_H / 2 - 1, CARD_W + 2, CARD_H + 2, 11);
      }
    };
    drawCard(false);
    modal.body.add(cardG);

    // === 상단 헤더 — 등급 (좌) / 죄 (우) ===
    const tierLbl = addText(scene, x - CARD_W / 2 + 14, cardCy - CARD_H / 2 + 16, tierName, {
      fontFamily: FONT, fontSize: '13px', color: tierHex, fontStyle: '800',
    }).setOrigin(0, 0);
    tierLbl.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(tierLbl);

    if (sinName) {
      const sinLbl = addText(scene, x + CARD_W / 2 - 14, cardCy - CARD_H / 2 + 16, sinName, {
        fontFamily: FONT, fontSize: '12px', color: sinHex, fontStyle: '700',
      }).setOrigin(1, 0);
      sinLbl.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(sinLbl);
    }

    // === 카드명 (상단부 중앙) — Phase P-54 카드 컨셉명 (맹공/거검/흡혈검 등) 복구 ===
    const nameTxt = addText(scene, x, cardCy - CARD_H / 2 + 56, displayCardName(card), {
      fontFamily: FONT, fontSize: '22px', color: '#F1F5F9', fontStyle: '900',
      align: 'center', wordWrap: { width: CARD_W - 20 },
    }).setOrigin(0.5, 0);
    nameTxt.setShadow(1, 1, '#000000', 3, false, true);
    modal.body.add(nameTxt);

    // === 카드명 아래 등급 색 짧은 디바이더 ===
    const dividerY = cardCy - CARD_H / 2 + 96;
    const dG = scene.add.graphics();
    dG.fillStyle(accent, 0.7);
    dG.fillRect(x - 30, dividerY, 60, 1);
    modal.body.add(dG);

    // === 설명 (디바이더 아래, 효과 상세) ===
    const descTxt = addText(scene, x, cardCy - CARD_H / 2 + 116, card.desc || '', {
      fontFamily: FONT, fontSize: '15px', color: '#CBD5E1',
      align: 'center', wordWrap: { width: CARD_W - 24 }, lineSpacing: 5,
    }).setOrigin(0.5, 0);
    modal.body.add(descTxt);

    const hit = scene.add.rectangle(x, cardCy, CARD_W, CARD_H, 0x000000, 0.001)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
    hit.on('pointerdown',      () => drawCard(true));
    hit.on('pointerupoutside', () => drawCard(false));
    hit.on('pointerup', () => {
      drawCard(false);
      sound.cardPicked();
      scene.player.applyCard(card);
      scene.player.updateHpDisplay();
      scene.updateInfoText();
      // [Phase P-25] 접기 시 expandBtn 정리는 Modal.js close() 가 자동 처리.
      modal.close();
      if (scene.player.pendingLevelUps > 0) {
        scene.showCardSelection();
      } else {
        // [무한 맵] mid-combat / wave-end 구분 없음 — 카드 선택 후 단순 게임 재개.
        //   적은 미리 배치되어 있으므로 별도 진행 트리거 불필요.
        scene.cardFlowMode = null;
        scene.cardSelectionActive = false;
      }
    });
    modal.body.add(hit);
  });

  // [Phase P-25] 옛 P-1/P-23 의 접기/펼치기 토글 코드 제거 — Modal.js collapsable: true 가 자동 처리.

  // [Phase P-31] 카드 리롤 버튼 — 일반 모드 (스테이지당 1회) + testMode (무제한) 모두 노출.
  //   위치: 모달 local (220, 140) — 옛 testMode 자리 그대로.
  //   일반 모드 라벨: '🎲 카드 리롤 (1/1)' / 사용 후 '(0/1)' 회색 비활성.
  //   testMode 라벨: '🎲 리롤 (∞)' — 카운터 무시 (테스트 흐름).
  //   스테이지 클리어 시 Player.resetForNewStage 가 _stageCardRerollsUsed = 0 리셋 (다음 스테이지 1회 가능).
  {
    const isTest = !!gameSettings.testMode;
    const used = scene.player._stageCardRerollsUsed || 0;
    const cap = 1;
    const canReroll = isTest || used < cap;
    // collapsable 모달의 '접기 ▼' 버튼이 bodyBotY-20 위치라 충돌 X — 그 위 50px 에 배치.
    const rrW = 180, rrH = 30, rrCx = 0, rrCy = modal.bodyBotY - 56;
    const rrG = scene.add.graphics();
    const drawRr = (a) => {
      rrG.clear();
      rrG.fillStyle(0x000000, a);
      rrG.fillRoundedRect(rrCx - rrW / 2, rrCy - rrH / 2, rrW, rrH, 4);
    };
    drawRr(canReroll ? 0.35 : 0.2);
    const label = isTest ? '🎲 리롤 (∞)' : `🎲 카드 리롤 (${cap - used}/${cap})`;
    const rrTxt = addText(scene, rrCx, rrCy, label, {
      fontFamily: FONT, fontSize: '16px', color: COLOR_TEXT_PRI, fontStyle: '700',
    }).setOrigin(0.5);
    rrTxt.setShadow(1, 1, '#000000', 2, false, true);
    if (!canReroll) { rrG.setAlpha(0.5); rrTxt.setAlpha(0.5); }
    const rrHit = scene.add.rectangle(rrCx, rrCy, rrW, rrH, 0x000000, 0.001);
    if (canReroll) {
      rrHit.setScrollFactor(0).setInteractive({ useHandCursor: true });
      // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
      rrHit.on('pointerdown',      () => drawRr(0.55));
      rrHit.on('pointerupoutside', () => drawRr(0.35));
      rrHit.on('pointerup', () => {
        drawRr(0.35);
        if (!isTest) scene.player._stageCardRerollsUsed = (scene.player._stageCardRerollsUsed || 0) + 1;
        modal.close();
        scene.cardSelectionActive = false;
        scene.showCardSelection();
      });
    }
    modal.body.add([rrG, rrHit, rrTxt]);
  }
}

// === 가방창 — 8×3 슬롯 그리드 ===
export function showBag(scene) {
  if (scene._activeModal && !scene._activeModal._closed) return;

  // [Phase P-28] collapsable 제거 + H 460 → 420 원복 (단순 조회 모달).
  const W = 600, H = 420;
  const modal = createModal(scene, {
    title: '가방',
    width: W, height: H,
    pauseGame: false,
  });

  const cols = 8, rows = 3, slotSize = 56, gap = 6;
  const gridW = cols * slotSize + (cols - 1) * gap;
  const startX = -gridW / 2 + slotSize / 2;
  const startY = modal.bodyTopY + 20 + slotSize / 2;

  const renderSlots = () => {
    modal.body.removeAll(true);
    const bag = scene.player.bag || [];
    const totalSlots = cols * rows;

    for (let i = 0; i < totalSlots; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const sx = startX + col * (slotSize + gap);
      const sy = startY + row * (slotSize + gap);
      const card = bag[i];
      const baseAlpha = card ? 0.3 : 0.15;
      const accent = card ? (card.color || 0xC5A059) : 0xC5A059;

      const slotG = scene.add.graphics().setPosition(sx, sy);
      const drawSlot = (a, tinted) => {
        slotG.clear();
        // [글래스 톤] 검정 베이스 + 미세 흰 외곽
        slotG.fillStyle(tinted ? accent : 0x000000, a + 0.15);
        slotG.fillRoundedRect(-slotSize / 2, -slotSize / 2, slotSize, slotSize, 6);
        slotG.lineStyle(1, 0xFFFFFF, tinted ? 0.35 : 0.15);
        slotG.strokeRoundedRect(-slotSize / 2, -slotSize / 2, slotSize, slotSize, 6);
      };
      drawSlot(baseAlpha, false);
      modal.body.add(slotG);

      if (!card) continue;

      const shortName = (card.name || '').slice(0, 4);
      const nameTxt = addText(scene, sx, sy, shortName, {
        fontFamily: FONT, fontSize: '20px', color: '#E8E8E8', fontStyle: '700',
        align: 'center', wordWrap: { width: slotSize - 8 },
      }).setOrigin(0.5);
      nameTxt.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(nameTxt);

      const slotHit = scene.add.rectangle(sx, sy, slotSize, slotSize, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      // [P-59 3차] 호버 툴팁 → long-press (500ms) 툴팁.
      //   짧은 탭 = 기존 사용 액션, 긴 탭 = 툴팁 표시 후 액션 스킵.
      let _tooltip = null;
      let _lpTimer = null;
      let _lpFired = false;
      const _showTooltip = () => {
        if (_tooltip) _tooltip.destroy();
        const ttW = 180, ttPadX = 8, ttPadY = 6;
        const ttC = scene.add.container(sx, sy - slotSize / 2 - 4);
        const ttTitle = addText(scene, 0, 0, card.name || '', {
          fontFamily: FONT, fontSize: '19px', color: COLOR_GOLD, fontStyle: '700',
        }).setOrigin(0.5, 1);
        const ttDesc = addText(scene, 0, -14, card.desc || '', {
          fontFamily: FONT, fontSize: '18px', color: '#CBD5E1',
          align: 'center', wordWrap: { width: ttW - ttPadX * 2 },
        }).setOrigin(0.5, 1);
        const totalH = ttTitle.height + ttDesc.height + ttPadY * 2 + 4;
        const ttBg = scene.add.graphics();
        ttBg.fillStyle(0x000000, 0.92);
        ttBg.fillRoundedRect(-ttW / 2, -totalH, ttW, totalH, 4);
        ttC.add([ttBg, ttDesc, ttTitle]);
        modal.body.add(ttC);
        _tooltip = ttC;
      };
      const _cancelLP = () => {
        if (_lpTimer) { _lpTimer.remove(false); _lpTimer = null; }
      };
      const _hideTooltip = () => {
        if (_tooltip) { _tooltip.destroy(); _tooltip = null; }
      };
      const _doUse = () => {
        if (card.passive) return;
        const onlyShop = card.onlyInShop;
        const canUse = !onlyShop || scene.cardSelectionActive;
        if (!canUse) return;
        if (card.use) {
          card.use(scene.player, scene);
          if (card.id !== 'shop-reroll') scene._addUsedBagBadge(card);
        }
        const idx = scene.player.bag.indexOf(card);
        if (idx !== -1) scene.player.bag.splice(idx, 1);
        scene.updateInfoText();
        if (card.id === 'shop-reroll') modal.close();
        else renderSlots();
      };
      slotHit.on('pointerdown', () => {
        _lpFired = false;
        drawSlot(0.45, true);
        _cancelLP();
        _lpTimer = scene.time.delayedCall(500, () => {
          _lpTimer = null;
          _lpFired = true;
          _showTooltip();
        });
      });
      slotHit.on('pointerup', () => {
        _cancelLP();
        drawSlot(baseAlpha, false);
        if (_lpFired) {
          _hideTooltip();
          _lpFired = false;
        } else {
          _doUse();
        }
      });
      slotHit.on('pointerupoutside', () => {
        _cancelLP();
        drawSlot(baseAlpha, false);
        _hideTooltip();
        _lpFired = false;
      });
      slotHit.on('pointerout', () => {
        _cancelLP();
        drawSlot(baseAlpha, false);
        _hideTooltip();
        _lpFired = false;
      });
      modal.body.add(slotHit);
    }
  };
  renderSlots();
}

// === 소지품 모달 (좌: 캐릭터+8슬롯 / 우: 인벤토리 그리드) ===
export function showPurchasedItems(scene) {
  if (scene._activeModal && !scene._activeModal._closed) return;
  // [Phase P-54] 리디자인 — 글래스 톤 통일 + 원형 슬롯 + 등급 글로우 + 상세 카드.
  const W = 760, H = 500;
  const modal = createModal(scene, {
    title: '소지품',
    width: W, height: H,
    pauseGame: false,
  });

  // === 글래스 패널 두 영역 (좌: 장비 / 우: 인벤토리) ===
  // 본문 좌표는 (0,0) 중심. 좌측 패널 cx=-200, 우측 cx=160.
  const PANEL_TOP = modal.bodyTopY + 6;
  const PANEL_BOT = modal.bodyBotY - 50;
  const PANEL_H   = PANEL_BOT - PANEL_TOP;

  const drawPanel = (cx, w) => {
    const g = scene.add.graphics();
    g.fillStyle(0xFFFFFF, 0.04);
    g.fillRoundedRect(cx - w / 2, PANEL_TOP, w, PANEL_H, 8);
    g.lineStyle(1, 0xFFFFFF, 0.10);
    g.strokeRoundedRect(cx - w / 2, PANEL_TOP, w, PANEL_H, 8);
    modal.body.add(g);
  };
  drawPanel(-200, 340);   // 장비
  drawPanel( 160, 360);   // 인벤토리

  // === 상세 정보 카드 (좌하단 — 패널 안 하단 영역) ===
  const DETAIL_W = 600, DETAIL_H = 80;
  const DETAIL_CY = modal.bodyBotY - 20 - DETAIL_H / 2;
  let selectedDetailId = null;
  const detailContainer = scene.add.container(0, DETAIL_CY).setVisible(false);
  modal.body.add(detailContainer);

  const renderDetail = (item, kind) => {
    detailContainer.removeAll(true);

    // 등급 색 (장비) / '특수' 자주 (가방)
    let tierName = '특수', tierHex = '#C084FC', tierColor = 0xC084FC, slotLabel = '';
    if (kind === 'equipment') {
      const tier = scene.itemTier(item.price);
      tierName = tier.name; tierHex = tier.hex; tierColor = tier.color;
      const slotKey = item.slot;
      slotLabel = ({
        head: '투구', accessory: '악세서리', body: '갑옷', shield: '방패',
        hands: '무기', arms: '장갑', legs: '각반', feet: '신발',
      })[slotKey] || slotKey;
    }

    // 글래스 배경 + 등급 좌측 강조 바
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.fillRoundedRect(-DETAIL_W / 2, -DETAIL_H / 2, DETAIL_W, DETAIL_H, 8);
    bg.fillStyle(0xFFFFFF, 0.05);
    bg.fillRect(-DETAIL_W / 2 + 8, -DETAIL_H / 2 + 2, DETAIL_W - 16, 1);
    bg.lineStyle(1, 0xFFFFFF, 0.18);
    bg.strokeRoundedRect(-DETAIL_W / 2, -DETAIL_H / 2, DETAIL_W, DETAIL_H, 8);
    // 등급 강조 — 좌측 4px 세로 바
    bg.fillStyle(tierColor, 0.85);
    bg.fillRoundedRect(-DETAIL_W / 2 + 6, -DETAIL_H / 2 + 10, 3, DETAIL_H - 20, 2);
    detailContainer.add(bg);

    // 아이콘 (좌측)
    const iconTxt = addText(scene, -DETAIL_W / 2 + 36, 0, item.icon || '?', {
      fontFamily: FONT, fontSize: '30px',
    }).setOrigin(0.5);
    detailContainer.add(iconTxt);

    // 이름 + 등급/부위
    const nameTxt = addText(scene, -DETAIL_W / 2 + 64, -DETAIL_H / 2 + 12, item.name || '', {
      fontFamily: FONT, fontSize: '20px', color: COLOR_TEXT_PRI, fontStyle: '800',
    }).setOrigin(0, 0);
    nameTxt.setShadow(1, 1, '#000000', 2, false, true);
    detailContainer.add(nameTxt);

    const sub = kind === 'equipment' ? `${tierName} · ${slotLabel}` : tierName;
    const subTxt = addText(scene, -DETAIL_W / 2 + 64, -DETAIL_H / 2 + 35, sub, {
      fontFamily: FONT, fontSize: '14px', color: tierHex, fontStyle: '700',
    }).setOrigin(0, 0);
    detailContainer.add(subTxt);

    // 설명 + 패시브 (한 줄)
    let desc = (item.desc || '').replace(/\n/g, ' ');
    if (item.passive && PASSIVES[item.passive]) {
      const p = PASSIVES[item.passive];
      desc = (desc ? desc + '  ·  ' : '') + `⚡ ${p.name} — ${p.desc}`;
    }
    const descTxt = addText(scene, -DETAIL_W / 2 + 64, -DETAIL_H / 2 + 55, desc, {
      fontFamily: FONT, fontSize: '13px', color: COLOR_TEXT_2ND,
      wordWrap: { width: DETAIL_W - 100 },
    }).setOrigin(0, 0);
    detailContainer.add(descTxt);

    // 가격 (우상단)
    if (item.price) {
      const priceTxt = addText(scene, DETAIL_W / 2 - 14, -DETAIL_H / 2 + 12, `🪙 ${item.price}`, {
        fontFamily: FONT, fontSize: '15px', color: COLOR_GOLD, fontStyle: '700',
      }).setOrigin(1, 0);
      detailContainer.add(priceTxt);
    }

    detailContainer.setVisible(true);
  };

  const toggleDetail = (item, kind) => {
    if (!item) return;
    if (selectedDetailId === item.id) {
      selectedDetailId = null;
      detailContainer.setVisible(false);
    } else {
      selectedDetailId = item.id;
      renderDetail(item, kind);
    }
  };

  // === 좌측 — 장비 (캐릭터 중앙 + 8 슬롯 원형 둘레) ===
  // 좌측 패널 중심 -200. 슬롯 4×2 그리드. 캐릭터 글래스 라운드 프레임.
  const leftCx = -200;
  const labelTxt = addText(scene, leftCx, PANEL_TOP + 12, '⚔ 장비', {
    fontFamily: FONT, fontSize: '16px', color: COLOR_GOLD, fontStyle: '700',
  }).setOrigin(0.5, 0);
  labelTxt.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(labelTxt);

  // 슬롯 위치 — 좌측 col / 우측 col, 캐릭터 중앙 (silhouette 표시).
  const SLOT_R = 26;
  const SLOT_POS = {
    head:      { x: leftCx - 110, y: -70, label: '투구' },
    body:      { x: leftCx - 110, y: -10, label: '갑옷' },
    hands:     { x: leftCx - 110, y:  50, label: '무기' },
    legs:      { x: leftCx - 110, y: 110, label: '각반' },
    accessory: { x: leftCx +  60, y: -70, label: '악세서리' },
    shield:    { x: leftCx +  60, y: -10, label: '방패' },
    arms:      { x: leftCx +  60, y:  50, label: '장갑' },
    feet:      { x: leftCx +  60, y: 110, label: '신발' },
  };

  // 캐릭터 실루엣 — 중앙 글래스 원
  const silCx = leftCx - 25, silCy = 20;
  const silG = scene.add.graphics();
  silG.fillStyle(0x000000, 0.35);
  silG.fillCircle(silCx, silCy, 56);
  silG.lineStyle(1.5, 0xFFFFFF, 0.20);
  silG.strokeCircle(silCx, silCy, 56);
  // 머리 + 몸 라인
  silG.fillStyle(0xB6C4E2, 0.18);
  silG.fillCircle(silCx, silCy - 18, 14);
  silG.fillRoundedRect(silCx - 18, silCy - 4, 36, 44, 8);
  modal.body.add(silG);

  SLOTS.forEach(slot => {
    const pos = SLOT_POS[slot]; if (!pos) return;
    const item = scene.player.equipment[slot];
    const equipped = !!item;
    const tier = equipped ? scene.itemTier(item.price) : null;
    const accent = tier ? tier.color : 0xFFFFFF;

    const slotG = scene.add.graphics();
    const draw = (hover) => {
      slotG.clear();
      // 배경
      slotG.fillStyle(0x000000, hover ? 0.70 : 0.55);
      slotG.fillCircle(pos.x, pos.y, SLOT_R);
      // 미세 흰 외곽
      slotG.lineStyle(1, 0xFFFFFF, equipped ? 0.22 : 0.14);
      slotG.strokeCircle(pos.x, pos.y, SLOT_R);
      // 장착 시 등급 글로우
      if (equipped) {
        slotG.lineStyle(2, accent, hover ? 1.0 : 0.85);
        slotG.strokeCircle(pos.x, pos.y, SLOT_R);
      }
    };
    draw(false);
    modal.body.add(slotG);

    // 부위 라벨 — 슬롯 위
    const lblTxt = addText(scene, pos.x, pos.y - SLOT_R - 10, pos.label, {
      fontFamily: FONT, fontSize: '11px', color: COLOR_TEXT_MUTED, fontStyle: '500',
    }).setOrigin(0.5);
    modal.body.add(lblTxt);

    // 아이콘 — 장착 시 emoji
    if (equipped) {
      const iconTxt = addText(scene, pos.x, pos.y, item.icon || '?', {
        fontFamily: FONT, fontSize: '22px',
      }).setOrigin(0.5);
      modal.body.add(iconTxt);
    }

    const slotHit = scene.add.circle(pos.x, pos.y, SLOT_R, 0x000000, 0.001)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
    slotHit.on('pointerdown', (p, lx, ly, ev) => {
      if (ev) ev.stopPropagation();
      draw(true);
    });
    slotHit.on('pointerupoutside', () => draw(false));
    slotHit.on('pointerup', () => {
      draw(false);
      if (equipped) toggleDetail(item, 'equipment');
    });
    modal.body.add(slotHit);
  });

  // === 우측 — 인벤토리 그리드 (6×4 = 24, player.bag 표시) ===
  const rightCx = 160;
  const invLbl = addText(scene, rightCx, PANEL_TOP + 12, '📦 인벤토리', {
    fontFamily: FONT, fontSize: '16px', color: COLOR_GOLD, fontStyle: '700',
  }).setOrigin(0.5, 0);
  invLbl.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(invLbl);

  const INV = 50, INV_GAP = 6, INV_COLS = 6, INV_ROWS = 4;
  const gridW = INV_COLS * INV + (INV_COLS - 1) * INV_GAP;
  const startX = rightCx - gridW / 2 + INV / 2;
  const startY = PANEL_TOP + 40 + INV / 2;
  const bag = (scene.player && scene.player.bag) ? scene.player.bag : [];

  for (let i = 0; i < INV_COLS * INV_ROWS; i++) {
    const c = i % INV_COLS, r = Math.floor(i / INV_COLS);
    const sx = startX + c * (INV + INV_GAP);
    const sy = startY + r * (INV + INV_GAP);
    const card = bag[i];

    const g = scene.add.graphics();
    const drawSlot = (hover) => {
      g.clear();
      g.fillStyle(0x000000, card ? (hover ? 0.65 : 0.50) : 0.25);
      g.fillRoundedRect(sx - INV / 2, sy - INV / 2, INV, INV, 6);
      g.lineStyle(1, 0xFFFFFF, card ? 0.22 : 0.10);
      g.strokeRoundedRect(sx - INV / 2, sy - INV / 2, INV, INV, 6);
      if (card && card.color) {
        g.lineStyle(1.5, card.color, hover ? 1.0 : 0.7);
        g.strokeRoundedRect(sx - INV / 2, sy - INV / 2, INV, INV, 6);
      }
    };
    drawSlot(false);
    modal.body.add(g);

    if (card) {
      const iconChar = card.icon || (card.name && card.name[0]) || '?';
      const iconTxt = addText(scene, sx, sy, iconChar, {
        fontFamily: FONT, fontSize: '26px',
      }).setOrigin(0.5);
      modal.body.add(iconTxt);

      const hit = scene.add.rectangle(sx, sy, INV, INV, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
      hit.on('pointerdown', (p, lx, ly, ev) => {
        if (ev) ev.stopPropagation();
        drawSlot(true);
      });
      hit.on('pointerupoutside', () => drawSlot(false));
      hit.on('pointerup', () => {
        drawSlot(false);
        const usable = hasBuiltinUse(card) || typeof card.use === 'function';
        if (!usable) { toggleDetail(card, 'bag'); return; }
        showConfirmDialog(scene, {
          title: card.name || '',
          message: '사용하시겠습니까?',
          onConfirm: () => {
            if (modal._closed) return;
            const consumed = (typeof card.use === 'function')
              ? (card.use(scene.player, scene), true)
              : useBuiltin(card, scene.player, scene);
            if (modal._closed) return;
            if (!consumed) return;
            if (scene._addUsedBagBadge && card.id !== 'shop-reroll') scene._addUsedBagBadge(card);
            const idx = scene.player.bag.indexOf(card);
            if (idx !== -1) scene.player.bag.splice(idx, 1);
            if (scene.updateInfoText) scene.updateInfoText();
            modal.close();
            showPurchasedItems(scene);
          },
        });
      });
      modal.body.add(hit);
    }
  }

  // === 하단 통계 라인 (디테일 카드 위) — 장착 / 인벤토리 카운트 ===
  const eq = SLOTS.filter(s => scene.player.equipment[s]).length;
  const bagCount = bag.length;
  const statY = modal.bodyBotY - DETAIL_H - 36;
  const statTxt = addText(scene, 0, statY,
    `⚔ ${eq}/8 슬롯 장착됨   ·   📦 ${bagCount}/${INV_COLS * INV_ROWS} 인벤토리`, {
    fontFamily: FONT, fontSize: '13px', color: COLOR_TEXT_2ND, fontStyle: '500',
  }).setOrigin(0.5);
  statTxt.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(statTxt);
}

// === 뽑은 카드 모달 — 동적 사이즈 + 상점 카드 스타일 ===
export function showPickedCards(scene) {
  if (scene._activeModal && !scene._activeModal._closed) return;

  const cards = scene.player.pickedCards || [];
  const count = cards.length;

  // === 페이지네이션 (5×2 = 10장/페이지, 카드 130×190) ===
  const CARD_W = 130, CARD_H = 190, GAP = 12;
  const COLS = 5, ROWS = 2, PER_PAGE = COLS * ROWS;
  const gridW = COLS * CARD_W + (COLS - 1) * GAP;
  const gridH = ROWS * CARD_H + (ROWS - 1) * GAP;
  const modalW = gridW + 60;          // 좌우 여백 30 + 30
  // [Phase P-28] modalH +40 / 빈 260 → 220 원복 (단순 조회 모달, collapsable 제거).
  const modalH = gridH + 130;         // 헤더 + 그리드 + 페이지 컨트롤 (~50)

  const modal = createModal(scene, {
    title: count > 0 ? `보유 카드 (${count})` : '보유 카드',
    width: count > 0 ? modalW : 320, height: count > 0 ? modalH : 220,
    pauseGame: false,
  });

  if (count === 0) {
    const empty = addText(scene, 0, modal.bodyTopY + 50, '아직 뽑은 카드가 없습니다', {
      fontFamily: FONT, fontSize: '20px', color: COLOR_TEXT_2ND, fontStyle: '500',
    }).setOrigin(0.5);
    empty.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(empty);
    const hint = addText(scene, 0, modal.bodyTopY + 80, '레벨업 후 카드를 골라보세요', {
      fontFamily: FONT, fontSize: '18px', color: COLOR_TEXT_MUTED,
    }).setOrigin(0.5);
    modal.body.add(hint);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(count / PER_PAGE));
  let currentPage = 0;
  let _pageEls = [];
  const _clearPage = () => { _pageEls.forEach(e => e && e.destroy && e.destroy()); _pageEls = []; };

  const _renderPage = () => {
    _clearPage();
    const startIdx = currentPage * PER_PAGE;
    const slice = cards.slice(startIdx, startIdx + PER_PAGE);
    const startX = -gridW / 2 + CARD_W / 2;
    const startY = modal.bodyTopY + 20 + CARD_H / 2;

    slice.forEach((card, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (CARD_W + GAP);
      const y = startY + row * (CARD_H + GAP);

      const tier = card.tier || card.rarity || 'normal';
      const tierInfo = CARD_TIER_COLORS[tier] || CARD_TIER_COLORS.normal;
      const accent = tierInfo.color;

      const cardG = scene.add.graphics();
      cardG.fillStyle(0x000000, 0.4);
      cardG.fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 6);
      cardG.lineStyle(1, accent, 0.6);
      cardG.strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 6);
      cardG.fillStyle(accent, 0.85);
      cardG.fillRect(x - CARD_W / 2 + 4, y - CARD_H / 2 + 1, CARD_W - 8, 1);
      modal.body.add(cardG); _pageEls.push(cardG);

      // [BUGFIX] 보유 카드 텍스트 겹침 수정 — y 위치 spread out + icon 24px 축소.
      // CARD_H=190 안: tier(상단) / icon / name(가운데) / desc(하단) 행간 충분히 분리.
      const tierLbl = addText(scene, x, y - CARD_H / 2 + 14, tierInfo.name || '노말', {
        fontFamily: FONT, fontSize: '13px', color: tierInfo.hex || COLOR_TEXT_2ND, fontStyle: '700',
      }).setOrigin(0.5);
      tierLbl.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(tierLbl); _pageEls.push(tierLbl);

      const iconTxt = addText(scene, x, y - 56, card.icon || '🃏', {
        fontFamily: FONT, fontSize: '24px',
      }).setOrigin(0.5);
      modal.body.add(iconTxt); _pageEls.push(iconTxt);

      const nameTxt = addText(scene, x, y - 22, displayCardName(card), {
        fontFamily: FONT, fontSize: '15px', color: COLOR_TEXT_PRI, fontStyle: '700',
        align: 'center', wordWrap: { width: CARD_W - 12 },
      }).setOrigin(0.5);
      nameTxt.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(nameTxt); _pageEls.push(nameTxt);

      const descTxt = addText(scene, x, y + 30, card.desc || '', {
        fontFamily: FONT, fontSize: '12px', color: COLOR_TEXT_2ND,
        align: 'center', wordWrap: { width: CARD_W - 12 }, lineSpacing: 3,
      }).setOrigin(0.5);
      modal.body.add(descTxt); _pageEls.push(descTxt);
    });
    _refreshPageCtrl();
  };

  // === 페이지 컨트롤 (하단) ===
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
