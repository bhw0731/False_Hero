// 🏪 매점 — Phase I: 골드 매점 / 다이아 매점 탭 분리.
// 좌(매점, 540px): 3종 카드 (골드) 또는 1종 카드 (다이아) + 리롤(스테이지당 4회, 골드 탭만).
// 우(인벤토리 조회, 320px): 4×3 그리드, 보유 항목 표시 (조회만, 클릭 사용 X).
//
// 골드 매점 풀 (14종, 가중치 합 9498) — 가중치 3종 추출.
// 다이아 매점 풀 (3종) — 진입 시 1종 무작위 (data/diamondShopPool.js).
//
// 악마의 계약: HP 30% 이하 시 구매 차단 (apply 가 false 반환).

import Phaser from 'phaser';
import { createModal } from './Modal.js';
import { gameSettings } from '../data/settings.js';
import { sound } from '../systems/SoundManager.js';
import { FONT, addText } from './theme.js';
import { pickDiamondOffer, tryPayDiamonds } from '../data/diamondShopPool.js';
import { getDiamonds } from '../data/diamonds.js';
// [Phase P-39] 구매 확인 다이얼로그 + 인벤토리 사용/판매 액션 다이얼로그.
import { showConfirmDialog, showActionDialog } from './ConfirmDialog.js';
// [Bugfix] 매점 가방 안에서 등급업권/부적 같은 builtin-use 카드 디스패치 누락 fix.
import { hasBuiltinUse, useBuiltin } from './InventoryModal.js';

// [Phase P-39] 매점 인벤토리 영역 사용/판매 — 옛 InventoryModal 흐름과 동일 룰.
//   판매가 = SELL_PRICES (구매가 × 60% Math.floor). 부활석 / 다이아 항목 판매 X.
// [Phase P-54] potion 3종 제거 — 기본 물약 (쿨다운) 으로 대체.
const _SELL_PRICES = {
  'amulet': 48,
  'upgrade-wrath': 108, 'upgrade-greed': 108, 'upgrade-sloth': 108,
  'upgrade-pride': 108, 'upgrade-lust': 108, 'upgrade-envy': 108, 'upgrade-gluttony': 108,
};
function _shopInvAction(scene, card) {
  if (!card) return;
  const sellPrice = _SELL_PRICES[card.id] || 0;
  const canSell = sellPrice > 0;
  showActionDialog(scene, {
    title: card.name || '',
    message: '무엇을 하시겠습니까?',
    canSell,
    onUse: () => {
      // 매점 안 직접 사용 — 옛 InventoryModal 의 _useBuiltin 과 동등 흐름이지만
      //   매점 흐름 보호를 위해 매점 모달 닫고 인벤토리 모달 재진입 (사용/사용 후 토스트).
      // 단순화: 사용 확인 → toast + bag splice + renderShop. 옛 인벤토리 use 분기는
      //   InventoryModal.showInventory 가 담당 (매점 종료 후 가방 사용 안내 그대로).
      //   여기선 매점 작업 흐름 유지를 위해 메뉴 모달 호출 안 함, 대신 직접 사용 확인.
      showConfirmDialog(scene, {
        title: card.name || '',
        message: '사용하시겠습니까?',
        onConfirm: () => {
          // 디스패치: 카드 자체 use() 우선, 없으면 builtin (등급업권/부적 등 카드 피커 흐름).
          // _useBuiltin 은 즉시 소비 (true) / 비동기 (false) 둘 다 처리 — bag splice 시점 분기.
          let consumed = false;
          if (typeof card.use === 'function') {
            try { card.use(scene.player, scene); } catch {}
            consumed = true;
          } else if (hasBuiltinUse(card)) {
            consumed = useBuiltin(card, scene.player, scene);
            // false 면 비동기 (CardPicker) — bag splice / 토스트는 onPick 콜백이 담당.
            if (!consumed) return;
          } else {
            // 사용 불가 — passive 카드 등.
            if (scene.events && scene.events.emit) scene.events.emit('toast', '⚠ 사용 불가');
            return;
          }
          const idx = scene.player.bag.indexOf(card);
          if (idx !== -1) scene.player.bag.splice(idx, 1);
          if (scene.events && scene.events.emit) scene.events.emit('toast', `✨ ${card.name} 사용`);
          if (typeof renderShop === 'function') renderShop(scene);
        },
      });
    },
    onSell: () => {
      showConfirmDialog(scene, {
        title: card.name || '',
        message: `판매하시겠습니까? (+${sellPrice} 골드)`,
        onConfirm: () => {
          scene.player.stats.gold = (scene.player.stats.gold || 0) + sellPrice;
          const idx = scene.player.bag.indexOf(card);
          if (idx !== -1) scene.player.bag.splice(idx, 1);
          if (scene.events && scene.events.emit) scene.events.emit('toast', `골드 +${sellPrice}`);
          if (typeof renderShop === 'function') renderShop(scene);
        },
      });
    },
  });
}

const COLOR_GOLD       = '#C5A059';
const COLOR_TEXT_PRI   = '#E8E8E8';
const COLOR_TEXT_2ND   = '#9A9AA2';

const SINS = ['분노','탐욕','나태','오만','색욕','질투','폭식'];

// === 14종 풀 === (부활석 1 + 등급업권 7 + 부적 1 + 악마의 계약 1 + 일회용 영약 4)
// apply(scene, player) → bool. true 시 골드 차감.
// 대부분 player.bag 에 항목 push (즉시 사용 X). 인벤토리 모달에서 사용.
//   bag 항목 구조: { id, name, icon, type, ...meta } — Phase A 표준.
const SHOP_POOL = [
  // [Phase P-54] 매점 물약 3종 제거 — 기본 물약 (쿨다운 기반) 으로 대체.

  // === 부활석 (1종, passive) ===
  {
    id: 'revive-stone', name: '부활석', icon: '🪨', color: 0xFF8FB1,
    desc: '자동 부활\nHP 35%, 무적 1초', price: 200, weight: 1200,
    apply: (scene, player) => {
      player.bag.push({
        id: 'revive-stone', name: '부활석', icon: '🪨', type: 'passive',
        revivePct: 0.35, invulnSec: 1, color: 0xFF8FB1,
        passive: true,    // 호환 — 옛 코드(card.passive 체크) 유지용
      });
      if (player.runStats) player.runStats.specialCardsBought = (player.runStats.specialCardsBought || 0) + 1;
      return true;
    },
  },

  // === 등급업권 (7종) — 7대죄별 ===
  ...SINS.map(sin => ({
    id: `upgrade-${sin}`, name: `${sin} 등급업권`, icon: '⬆', color: 0xFFD166,
    desc: `${sin} 카드 1장\n등급 +1`, price: 180, weight: 350,
    apply: (scene, player) => {
      player.bag.push({
        id: `upgrade-${sin}`, name: `${sin} 등급업권`, icon: '⬆',
        type: 'utility', upgradeSin: sin, color: 0xFFD166,
      });
      return true;
    },
  })),

  // === 특수 ===
  // [Phase P-54] 경험의 영약 — 30초 시간 제한 (다른 영약과 통일).
  {
    id: 'amulet', name: '경험의 영약', icon: '📿', color: 0xC084FC,
    desc: '30초 동안\n경험치 +50%', price: 70, weight: 1500,
    apply: (scene, player) => {
      player.addTimedBuff('expMul', 0.50, 30000);
      if (scene.events && scene.events.emit) scene.events.emit('toast', '📿 경험치 +50% (30초)');
      return true;
    },
  },
  // [Phase P-39] reroll-token (카드 리롤권) 항목 제거 — 코드 / 핸들러 / 명세서 잔재 0.
  // === 일회용 영약 (4종) — 30초 시간 제한 (Phase P-54). 다음 스테이지 진입 시 자동 소멸.
  {
    id: 'strength-elixir', name: '힘의 영약', icon: '🔥', color: 0xFF6B4A,
    desc: '30초 동안\n공격력 +25%', price: 80, weight: 1100,
    apply: (scene, player) => {
      player.addTimedBuff('attackPower', 0.25, 30000);
      if (scene.events && scene.events.emit) scene.events.emit('toast', '🔥 공격력 +25% (30초)');
      return true;
    },
  },
  {
    id: 'haste-elixir', name: '신속의 영약', icon: '⚡', color: 0xFFE066,
    desc: '30초 동안\n공격속도 +25%', price: 80, weight: 1100,
    apply: (scene, player) => {
      player.addTimedBuff('attackSpeed', 0.25, 30000);
      if (scene.events && scene.events.emit) scene.events.emit('toast', '⚡ 공격속도 +25% (30초)');
      return true;
    },
  },
  {
    id: 'iron-elixir', name: '강철의 영약', icon: '🛡', color: 0x9CB4E0,
    desc: '30초 동안\n받는 피해 -25%', price: 90, weight: 900,
    apply: (scene, player) => {
      player.addTimedBuff('damageReduction', 0.25, 30000);
      if (scene.events && scene.events.emit) scene.events.emit('toast', '🛡 받는 피해 -25% (30초)');
      return true;
    },
  },
  {
    id: 'frenzy-elixir', name: '광폭의 묘약', icon: '💢', color: 0xDC2626,
    desc: '30초 동안\n공격력 +45% / 받는 피해 +15%', price: 60, weight: 850,
    apply: (scene, player) => {
      player.addTimedBuff('attackPower', 0.45, 30000);
      player.addTimedBuff('damageReduction', -0.15, 30000);
      if (scene.events && scene.events.emit) scene.events.emit('toast', '💢 광폭 — 공격력 +45% / 받는 피해 +15% (30초)');
      return true;
    },
  },

  {
    id: 'demon-deal', name: '악마의 계약', icon: '😈', color: 0xDC2626,
    desc: 'HP 30% 소모\n→ 골드 +200', price: 0, weight: 1000, hpCost: 0.30,
    apply: (scene, player) => {
      // HP 30% 이하 시 구매 차단
      if (player.stats.hp / Math.max(1, player.getStat('maxHp')) <= 0.30) {
        if (scene.events && scene.events.emit) scene.events.emit('toast', '⚠ HP가 너무 낮습니다');
        console.warn('[shop] demon-deal blocked: HP <= 30%');
        return false;
      }
      const hpCost = Math.floor(player.getStat('maxHp') * 0.30);
      player.stats.hp = Math.max(1, player.stats.hp - hpCost);
      player.stats.gold += 200;
      if (player.updateHpDisplay) player.updateHpDisplay();
      return true;
    },
  },
];

// === 가중치 추첨 (중복 X) ===
function weightedPick(pool) {
  const total = pool.reduce((s, c) => s + (c.weight || 1), 0);
  let r = Math.random() * total;
  for (const c of pool) {
    r -= (c.weight || 1);
    if (r <= 0) return c;
  }
  return pool[pool.length - 1];
}

function pickShopOffers(count = 3) {
  const remaining = [...SHOP_POOL];
  const out = [];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const pick = weightedPick(remaining);
    out.push({ ...pick, sold: false });
    const idx = remaining.indexOf(pick);
    if (idx !== -1) remaining.splice(idx, 1);
  }
  return out;
}

// === 모달 진입 ===
export function showShop(scene) {
  scene.cardSelectionActive = true;

  // Phase F — 매점 진입 시점 자동 회복 (매 웨이브 자동 회복 폐지 대체).
  // 회복 비율 0.20 (옛 healRatioBetweenWaves 와 동일). player.heal 가 healingDisabled 디버프 존중.
  if (scene.player && scene.player.heal) {
    scene.player.heal(scene.player.getStat('maxHp') * 0.20);
    if (scene.player.updateHpDisplay) scene.player.updateHpDisplay();
  }

  scene.shopOffers = pickShopOffers(3);
  // Phase I — 다이아 매점 슬롯 1종 추첨 + 초기 탭 = 골드.
  scene.diamondOffer = pickDiamondOffer();
  scene._shopTab = 'gold';

  // [Phase P-25] H 500 → 540 (접기 ▼ 버튼 자리 확보) + collapsable: true.
  const W = 900, H = 540;
  scene._shopModal = createModal(scene, {
    title: '매점',
    width: W, height: H,
    pauseGame: true,        // [무한 맵] 매점 동안 게임 정지 (NPC 근처 적과 충돌 회피)
    showCloseButton: false,
    overlayCloses: false,
    collapsable: true,
    onClose: () => {
      scene.cardSelectionActive = false;
      scene._shopModal = null;
      scene.cardFlowMode = null;
      // [무한 맵] 옛 _scheduleAutoAdvance 호출 폐기 — 매점 닫힘 후 게임 자동 재개.
    },
  });
  renderShop(scene);
}

// === 리롤 ===
export function rerollShop(scene) {
  if (!scene.shopOffers) return;
  const isTest = !!gameSettings.testMode;
  // [Phase P-42] testMode 시 4회 cap 무시 (무제한). 일반 모드는 그대로 4회.
  if (!isTest && (scene.player._stageShopRerollsUsed || 0) >= 4) return;
  if (!isTest) {
    if ((scene.player.stats.gold || 0) < 30) return;
    scene.player.stats.gold -= 30;
    if (scene.player.runStats) scene.player.runStats.goldSpent = (scene.player.runStats.goldSpent || 0) + 30;
    if (scene.player.onGoldSpent) scene.player.onGoldSpent(30);   // [Phase M2] 탐욕 L5 후크
  }
  scene.player._stageShopRerollsUsed = (scene.player._stageShopRerollsUsed || 0) + 1;
  scene.shopOffers = pickShopOffers(3);
  if (scene.updateInfoText) scene.updateInfoText();
  renderShop(scene);
}

// === 렌더 ===
export function renderShop(scene) {
  const modal = scene._shopModal;
  if (!modal || modal._closed) return;
  modal.body.removeAll(true);

  // === 좌/우 분할 ===
  const leftCx  = -225;
  const rightCx = +225;

  // === Phase I — 탭 (골드 매점 / 다이아 매점) ===
  const tab = scene._shopTab || 'gold';
  renderShopTabs(scene, modal, tab);

  // 디바이더 (탭 아래부터 — body 영역 내에서 좌/우 구분)
  const contentTopY = modal.bodyTopY + 36;   // 탭 28px + 8 마진
  const dividerH = modal.bodyBotY - contentTopY - 8;
  const divider = scene.add.rectangle(0, contentTopY + dividerH / 2 + 4, 1, dividerH, 0xC5A059, 0.3);
  modal.body.add(divider);

  // === Phase H — 5/10스 대형 스테이지 표시 (헤더 우측) ===
  const curStage = scene.waveSystem ? scene.waveSystem.currentStage : 1;
  const isClimax = (curStage === 5 || curStage === 10);
  if (isClimax) {
    const badge = addText(scene, modal.w / 2 - 16, -modal.h / 2 + 20, '🔥 대형 스테이지', {
      fontFamily: FONT, fontSize: '16px', color: '#FFD700', fontStyle: '700',
    }).setOrigin(1, 0.5);
    badge.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(badge);
  }

  // === Phase H — 10웨이브 스테이지의 W9 매점 (메인보스 직전) 안내 ===
  // 골드 탭에만 표시 (다이아 탭은 단일 슬롯이라 공간 없음 + 룰상 골드 매점 = 메인 진열).
  const ws = scene.waveSystem;
  const isFinalBossShop = !!(ws && isClimax && ws.currentWave === 9 && tab === 'gold');
  if (isFinalBossShop) {
    const noticeBg = scene.add.graphics();
    noticeBg.fillStyle(0x8B0000, 0.85);
    noticeBg.fillRoundedRect(-modal.w / 2 + 16, contentTopY + 4, modal.w - 32, 38, 4);
    noticeBg.lineStyle(1, 0xFFD700, 0.7);
    noticeBg.strokeRoundedRect(-modal.w / 2 + 16, contentTopY + 4, modal.w - 32, 38, 4);
    modal.body.add(noticeBg);
    const notice1 = addText(scene, 0, contentTopY + 12, '⚠ 다음 웨이브: 최종 보스', {
      fontFamily: FONT, fontSize: '19px', color: '#FFD700', fontStyle: '800',
    }).setOrigin(0.5, 0);
    notice1.setShadow(1, 1, '#000000', 2, false, true);
    const notice2 = addText(scene, 0, contentTopY + 28, '준비를 갖추세요', {
      fontFamily: FONT, fontSize: '14px', color: '#F1F5F9', fontStyle: '500',
    }).setOrigin(0.5, 0);
    notice2.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add([notice1, notice2]);
    [noticeBg, notice1, notice2].forEach(el => el.setAlpha(0));
    scene.tweens.add({
      targets: [noticeBg, notice1, notice2], alpha: 1, duration: 200, ease: 'Sine.easeOut',
    });
  }

  // === 좌 — 탭별 컨텐츠 ===
  if (tab === 'diamond') {
    renderDiamondShopSlot(scene, modal, leftCx, contentTopY);
  } else {
    renderShopCards(scene, modal, leftCx, isFinalBossShop, contentTopY);
  }

  // === 우 — 인벤토리 조회 (양 탭 공통) ===
  renderInventoryView(scene, modal, rightCx, contentTopY);

  // === 하단 — 잔액 / 리롤 / 나가기 (탭별 분기) ===
  renderShopFooter(scene, modal, leftCx, rightCx, tab);
}

// === Phase I — 탭 UI (골드 매점 / 다이아 매점) ===
function renderShopTabs(scene, modal, activeTab) {
  // [Phase P-37 후속] 탭 라벨 emoji 제거.
  const tabs = [
    { id: 'gold',    label: '골드 매점',  color: 0xC5A059 },
    { id: 'diamond', label: '다이아 매점', color: 0x60A5FA },
  ];
  const TAB_W = 160, TAB_H = 28, GAP = 4;
  const totalW = tabs.length * TAB_W + (tabs.length - 1) * GAP;
  const startX = -totalW / 2 + TAB_W / 2;
  const tabY = modal.bodyTopY + 18;     // body 상단

  tabs.forEach((t, i) => {
    const x = startX + i * (TAB_W + GAP);
    const isActive = activeTab === t.id;
    const g = scene.add.graphics();
    const draw = (a) => {
      g.clear();
      g.fillStyle(0x000000, isActive ? 0.55 : 0.25);
      g.fillRoundedRect(x - TAB_W / 2, tabY - TAB_H / 2, TAB_W, TAB_H, 4);
      g.lineStyle(isActive ? 2 : 1, t.color, isActive ? 0.95 : 0.4);
      g.strokeRoundedRect(x - TAB_W / 2, tabY - TAB_H / 2, TAB_W, TAB_H, 4);
      if (isActive) {
        // 활성 탭 상단 골드 광택
        g.fillStyle(t.color, 0.85);
        g.fillRect(x - TAB_W / 2 + 4, tabY - TAB_H / 2 + 1, TAB_W - 8, 1);
      }
      // hover 알파 무시 (단순화)
    };
    draw();
    modal.body.add(g);

    const txt = addText(scene, x, tabY, t.label, {
      fontFamily: FONT, fontSize: '18px',
      color: isActive ? '#F1F5F9' : '#9A9AA2', fontStyle: '700',
    }).setOrigin(0.5);
    txt.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(txt);

    if (!isActive) {
      const hit = scene.add.rectangle(x, tabY, TAB_W, TAB_H, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        scene._shopTab = t.id;
        renderShop(scene);
      });
      modal.body.add(hit);
    }
  });
}

// === Phase I — 다이아 매점 단일 슬롯 ===
function renderDiamondShopSlot(scene, modal, leftCx, contentTopY) {
  const offer = scene.diamondOffer;
  if (!offer) return;

  const sub = addText(scene, leftCx, contentTopY + 4, '오늘의 추천 (단일 슬롯)', {
    fontFamily: FONT, fontSize: '16px', color: COLOR_TEXT_2ND, fontStyle: '500',
  }).setOrigin(0.5, 0);
  sub.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(sub);

  // 단일 카드 — 다이아 매점은 1슬롯, 카드 크게 (190×280)
  const CARD_W = 190, CARD_H = 280;
  const x = leftCx;
  const cardCy = contentTopY + 30 + CARD_H / 2;
  const sold = offer.sold;
  const accent = offer.color || 0x60A5FA;
  const myDiamonds = getDiamonds();
  const canAfford = gameSettings.testMode || myDiamonds >= offer.price;

  // [스탯 박스 톤] 매점 카드 — 검정 + 등급 광택/외곽 + 흰 외곽 미세
  const cardG = scene.add.graphics().setPosition(x, cardCy);
  cardG.fillStyle(0x000000, sold ? 0.35 : 0.55);
  cardG.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
  cardG.fillStyle(accent, sold ? 0.3 : 1.0);
  cardG.fillRect(-CARD_W / 2 + 6, -CARD_H / 2 + 2, CARD_W - 12, 2);
  // 흰 외곽 미세
  cardG.lineStyle(1, 0xFFFFFF, sold ? 0.08 : 0.18);
  cardG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
  // 등급 외곽
  cardG.lineStyle(sold ? 1 : 1.5, accent, sold ? 0.3 : 0.75);
  cardG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
  modal.body.add(cardG);

  // 카테고리 라벨
  // [Phase P-37 후속] type 라벨 emoji 제거.
  const catTxt = (offer.id === 'diamond-revive')          ? '자동 발동'
                : (offer.id === 'diamond-upgrade')        ? '기능'
                : '즉시 효과';
  const catColor = (offer.id === 'diamond-revive')        ? '#C084FC'
                  : (offer.id === 'diamond-upgrade')      ? '#FFD166'
                  : '#F87171';
  const catLbl = addText(scene, x, cardCy - CARD_H / 2 + 14, catTxt, {
    fontFamily: FONT, fontSize: '15px', color: catColor, fontStyle: '700',
  }).setOrigin(0.5, 0);
  catLbl.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(catLbl);

  // 큰 아이콘
  const iconTxt = addText(scene, x, cardCy - 70, offer.icon || '💎', {
    fontFamily: FONT, fontSize: '56px',
  }).setOrigin(0.5);
  iconTxt.setAlpha(sold ? 0.4 : 1);
  modal.body.add(iconTxt);

  // 이름
  const nameTxt = addText(scene, x, cardCy - 4, offer.name, {
    fontFamily: FONT, fontSize: '21px',
    color: sold ? '#666' : '#F1F5F9', fontStyle: '700',
    align: 'center', wordWrap: { width: CARD_W - 16 },
  }).setOrigin(0.5);
  nameTxt.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(nameTxt);

  // 효과 설명
  const descTxt = addText(scene, x, cardCy + 30, offer.desc || '', {
    fontFamily: FONT, fontSize: '16px',
    color: sold ? '#555' : '#CBD5E1',
    align: 'center', wordWrap: { width: CARD_W - 16 }, lineSpacing: 4,
  }).setOrigin(0.5, 0);
  modal.body.add(descTxt);

  // [Phase P-54] 가격을 카드 본문 밖 아래로 이동 — 설명과 겹침 해소.
  const priceColor = sold ? '#666' : (canAfford ? '#60A5FA' : '#F87171');
  const diaPriceY = cardCy + CARD_H / 2 + 16;
  const priceTxt = addText(scene, x, diaPriceY,
    sold ? '✓ 구매됨' : `${offer.price} 다이아`, {
    fontFamily: FONT, fontSize: '19px', color: priceColor, fontStyle: '800',
  }).setOrigin(0.5);
  priceTxt.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(priceTxt);

  if (!sold) {
    const btnW = 120, btnH = 32, btnY = diaPriceY + 28;
    const btnG = scene.add.graphics();
    const drawBtn = (a) => {
      btnG.clear();
      btnG.fillStyle(0x000000, a);
      btnG.fillRoundedRect(x - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
    };
    drawBtn(canAfford ? 0.45 : 0.2);
    const btnTxt = addText(scene, x, btnY, canAfford ? '구매' : '다이아 부족', {
      fontFamily: FONT, fontSize: '19px',
      color: canAfford ? '#60A5FA' : '#F87171', fontStyle: '700',
    }).setOrigin(0.5);
    btnTxt.setShadow(1, 1, '#000000', 2, false, true);
    const btnHit = scene.add.rectangle(x, btnY, btnW, btnH, 0x000000, 0.001);
    if (canAfford) {
      btnHit.setScrollFactor(0).setInteractive({ useHandCursor: true });
      // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
      btnHit.on('pointerdown',      () => drawBtn(0.65));
      btnHit.on('pointerupoutside', () => drawBtn(0.45));
      btnHit.on('pointerup', () => {
        drawBtn(0.45);
        showConfirmDialog(scene, {
          title: offer.name || '',
          message: `구매하시겠습니까? (-${offer.price} 다이아)`,
          onConfirm: () => buyDiamondOffer(scene),
        });
      });
    }
    modal.body.add([btnG, btnHit, btnTxt]);
  }
}

// === 좌 — 매점 카드 ===
// Phase I — contentTopY 인자로 탭 영역만큼 시프트. isFinalBossShop=true 시 추가 38px 시프트.
function renderShopCards(scene, modal, leftCx, isFinalBossShop = false, contentTopY = null) {
  if (contentTopY === null) contentTopY = modal.bodyTopY;
  const subY = isFinalBossShop ? (contentTopY + 48) : (contentTopY + 4);
  const sub = addText(scene, leftCx, subY, '오늘의 추천', {
    fontFamily: FONT, fontSize: '16px', color: COLOR_TEXT_2ND, fontStyle: '500',
  }).setOrigin(0.5, 0);
  sub.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(sub);

  const cards = scene.shopOffers || [];
  const CARD_W = 140, CARD_H = isFinalBossShop ? 220 : 260, CARD_GAP = 10;
  const N = cards.length;
  const totalW = N * CARD_W + (N - 1) * CARD_GAP;
  const startX = leftCx - totalW / 2 + CARD_W / 2;
  const cardCy = (isFinalBossShop ? contentTopY + 74 : contentTopY + 30) + CARD_H / 2;

  cards.forEach((card, i) => {
    const x = startX + i * (CARD_W + CARD_GAP);
    const sold = card.sold;
    const accent = card.color || 0x6AD8FF;
    const canAfford = (scene.player.stats.gold || 0) >= card.price;

    // [Phase P-54] 글래스 톤 — 검정 0.55 + 미세 흰 외곽 + 등급 색 외곽 + 상단 색 바.
    const cardG = scene.add.graphics().setPosition(x, cardCy);
    cardG.fillStyle(0x000000, sold ? 0.30 : 0.55);
    cardG.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    // 상단 광택
    cardG.fillStyle(0xFFFFFF, 0.05);
    cardG.fillRect(-CARD_W / 2 + 6, -CARD_H / 2 + 2, CARD_W - 12, 1);
    // 흰 외곽 미세
    cardG.lineStyle(1, 0xFFFFFF, sold ? 0.10 : 0.18);
    cardG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    // 등급 색 외곽
    cardG.lineStyle(1.5, accent, sold ? 0.30 : 0.75);
    cardG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    // 상단 색 바
    cardG.fillStyle(accent, sold ? 0.30 : 0.90);
    cardG.fillRoundedRect(-CARD_W / 2 + 4, -CARD_H / 2 + 4, CARD_W - 8, 3, 2);
    modal.body.add(cardG);

    // 카테고리 라벨
    const cat = labelForType(card);
    const catLbl = addText(scene, x, cardCy - CARD_H / 2 + 12, cat.label, {
      fontFamily: FONT, fontSize: '15px', color: cat.color, fontStyle: '700',
    }).setOrigin(0.5, 0);
    catLbl.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(catLbl);

    // 큰 아이콘
    const iconTxt = addText(scene, x, cardCy - 70, card.icon || '🎁', {
      fontFamily: FONT, fontSize: '44px',
    }).setOrigin(0.5);
    iconTxt.setAlpha(sold ? 0.4 : 1);
    modal.body.add(iconTxt);

    // 이름
    const nameTxt = addText(scene, x, cardCy - 8, card.name, {
      fontFamily: FONT, fontSize: '19px',
      color: sold ? '#666' : '#F1F5F9', fontStyle: '700',
      align: 'center', wordWrap: { width: CARD_W - 16 },
    }).setOrigin(0.5);
    nameTxt.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(nameTxt);

    // 효과 설명 — 카드 본문 가운데. 폰트 15→14 + 줄간격 3 으로 다중라인 여유 확보.
    const descTxt = addText(scene, x, cardCy + 22, card.desc || '', {
      fontFamily: FONT, fontSize: '14px',
      color: sold ? '#555' : '#CBD5E1',
      align: 'center', wordWrap: { width: CARD_W - 16 }, lineSpacing: 3,
    }).setOrigin(0.5, 0);
    modal.body.add(descTxt);

    // [Phase P-54] 가격을 카드 본문 밖 아래로 이동 — 설명과 겹침 해소.
    //   priceY = 카드 아래 외부 (cardCy + CARD_H/2 + 16), 구매 버튼은 그 아래 (priceY + 22).
    const priceY = cardCy + CARD_H / 2 + 14;
    const priceTxt = addText(scene, x, priceY,
      sold ? '✓ 사용됨' : (card.price > 0 ? `${card.price} 골드` : '무료'), {
      fontFamily: FONT, fontSize: '17px',
      color: sold ? '#666' : (canAfford ? COLOR_GOLD : '#F87171'),
      fontStyle: '800',
    }).setOrigin(0.5);
    priceTxt.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(priceTxt);

    if (!sold) {
      const btnW = 100, btnH = 28, btnY = priceY + 26;
      const btnG = scene.add.graphics();
      const drawBtn = (a) => {
        btnG.clear();
        btnG.fillStyle(0x000000, a);
        btnG.fillRoundedRect(x - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
      };
      drawBtn(canAfford ? 0.45 : 0.2);
      const btnTxt = addText(scene, x, btnY, canAfford ? '구매' : '돈 부족', {
        fontFamily: FONT, fontSize: '18px',
        color: canAfford ? COLOR_GOLD : '#F87171', fontStyle: '700',
      }).setOrigin(0.5);
      btnTxt.setShadow(1, 1, '#000000', 2, false, true);
      const btnHit = scene.add.rectangle(x, btnY, btnW, btnH, 0x000000, 0.001);
      if (canAfford) {
        btnHit.setScrollFactor(0).setInteractive({ useHandCursor: true });
        // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
        btnHit.on('pointerdown',      () => drawBtn(0.65));
        btnHit.on('pointerupoutside', () => drawBtn(0.45));
        btnHit.on('pointerup', () => {
          drawBtn(0.45);
          const idx = scene.shopOffers.indexOf(card);
          showConfirmDialog(scene, {
            title: card.name || '',
            message: card.price > 0 ? `구매하시겠습니까? (-${card.price} 골드)` : '진행하시겠습니까?',
            onConfirm: () => buyShopCard(scene, idx),
          });
        });
      }
      modal.body.add([btnG, btnHit, btnTxt]);
    }
  });
}

// === 우 — 인벤토리 (4×3, 70×90, P-39 클릭 가능 — 사용/판매 다이얼로그) ===
function renderInventoryView(scene, modal, rightCx, contentTopY = null) {
  if (contentTopY === null) contentTopY = modal.bodyTopY;
  const headerLbl = addText(scene, rightCx, contentTopY + 4, '인벤토리', {
    fontFamily: FONT, fontSize: '18px', color: COLOR_TEXT_2ND, fontStyle: '700',
  }).setOrigin(0.5, 0);
  headerLbl.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(headerLbl);

  const COLS = 4, ROWS = 3;
  const SLOT_W = 70, SLOT_H = 90, GAP = 10;
  const gridW = COLS * SLOT_W + (COLS - 1) * GAP;
  const startX = rightCx - gridW / 2 + SLOT_W / 2;
  const startY = contentTopY + 30 + SLOT_H / 2;
  const bag = scene.player.bag || [];

  for (let i = 0; i < COLS * ROWS; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const sx = startX + col * (SLOT_W + GAP);
    const sy = startY + row * (SLOT_H + GAP);
    const card = bag[i];
    const accent = card ? (card.color || 0xC5A059) : 0xFFFFFF;
    const baseAlpha = card ? 0.35 : 0.10;

    // [글래스 톤] 인벤토리 슬롯 — 검정 + 흰 외곽 + 등급 외곽
    const slotG = scene.add.graphics();
    slotG.fillStyle(0x000000, baseAlpha + 0.15);
    slotG.fillRoundedRect(sx - SLOT_W / 2, sy - SLOT_H / 2, SLOT_W, SLOT_H, 6);
    if (card) {
      slotG.lineStyle(1, 0xFFFFFF, 0.15);
      slotG.strokeRoundedRect(sx - SLOT_W / 2, sy - SLOT_H / 2, SLOT_W, SLOT_H, 6);
      slotG.lineStyle(1.5, accent, 0.65);
      slotG.strokeRoundedRect(sx - SLOT_W / 2, sy - SLOT_H / 2, SLOT_W, SLOT_H, 6);
    } else {
      slotG.lineStyle(1, 0xFFFFFF, 0.12);
      slotG.strokeRoundedRect(sx - SLOT_W / 2, sy - SLOT_H / 2, SLOT_W, SLOT_H, 6);
    }
    modal.body.add(slotG);

    if (!card) continue;

    // 아이콘
    const iconChar = card.icon || (card.name && card.name[0]) || '?';
    const iconTxt = addText(scene, sx, sy - 12, iconChar, {
      fontFamily: FONT, fontSize: '30px',
    }).setOrigin(0.5);
    modal.body.add(iconTxt);

    // 짧은 이름
    const shortName = (card.name || '').slice(0, 5);
    const nameTxt = addText(scene, sx, sy + 26, shortName, {
      fontFamily: FONT, fontSize: '14px', color: COLOR_TEXT_PRI, fontStyle: '700',
      align: 'center', wordWrap: { width: SLOT_W - 6 },
    }).setOrigin(0.5);
    nameTxt.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(nameTxt);

    // [Phase P-39] 매점 인벤토리 영역 클릭 가능 — 사용/판매/취소 액션 다이얼로그.
    const hit = scene.add.rectangle(sx, sy, SLOT_W, SLOT_H, 0x000000, 0.001)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => _shopInvAction(scene, card));
    modal.body.add(hit);
  }

  // 하단 안내 — 매점 종료 후 인벤토리 모달에서 사용
  const hint = addText(scene, rightCx, startY + ROWS * SLOT_H + (ROWS - 1) * GAP - SLOT_H / 2 + 18,
    '매점 종료 후 가방에서 사용', {
    fontFamily: FONT, fontSize: '14px', color: '#5A5A5F',
    align: 'center', wordWrap: { width: 280 },
  }).setOrigin(0.5, 0);
  modal.body.add(hint);
}

// === 푸터 — 잔액 (좌측 끝) / 리롤 (좌측 가운데, 골드 탭만) / 나가기 (우측 끝) ===
// Phase I — tab='diamond' 시 잔액 = 다이아, 리롤 X.
function renderShopFooter(scene, modal, leftCx, rightCx, tab = 'gold') {
  const bottomY = modal.bodyBotY - 26;

  // 좌측 끝 — 잔액 (탭별 다른 통화 + 색)
  // [Phase P-37 후속] 잔액 emoji 제거 — 통화 명 후치.
  const balanceStr = (tab === 'diamond')
    ? `${getDiamonds()} 다이아`
    : `${scene.player.stats.gold || 0} 골드`;
  const balanceColor = (tab === 'diamond') ? '#60A5FA' : COLOR_GOLD;
  const balanceTxt = addText(scene, -modal.w / 2 + 24, bottomY, balanceStr, {
    fontFamily: FONT, fontSize: '20px', color: balanceColor, fontStyle: '700',
  }).setOrigin(0, 0.5);
  balanceTxt.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(balanceTxt);

  // 리롤 — 골드 탭에만 (다이아 매점은 리롤 X)
  if (tab === 'gold') {
    const isTest = !!gameSettings.testMode;
    const used = scene.player._stageShopRerollsUsed || 0;
    // [Phase P-42] testMode 시 cap 무시 — remaining 항상 ∞.
    const remaining = isTest ? Infinity : Math.max(0, 4 - used);
    const REROLL_COST = 30;
    if (remaining > 0) {
      const canAfford = isTest || (scene.player.stats.gold || 0) >= REROLL_COST;
      const label = isTest ? `리롤 (∞)` : `리롤 (${used}/4, ${REROLL_COST}G)`;
      // [Phase P-38 후속] 리롤 위치 bottomY → bottomY - 40 (골드 표시와 겹침 해소).
      const rrW = 200, rrH = 32, rrCx = leftCx, rrCy = bottomY - 40;
      const rrG = scene.add.graphics();
      const drawRr = (a) => {
        rrG.clear();
        rrG.fillStyle(0x000000, a);
        rrG.fillRoundedRect(rrCx - rrW / 2, rrCy - rrH / 2, rrW, rrH, 4);
      };
      drawRr(canAfford ? 0.35 : 0.2);
      const rrTxt = addText(scene, rrCx, rrCy, label, {
        fontFamily: FONT, fontSize: '18px',
        color: canAfford ? COLOR_TEXT_PRI : '#666', fontStyle: '700',
      }).setOrigin(0.5);
      rrTxt.setShadow(1, 1, '#000000', 2, false, true);
      const rrHit = scene.add.rectangle(rrCx, rrCy, rrW, rrH, 0x000000, 0.001);
      if (canAfford) {
        rrHit.setScrollFactor(0).setInteractive({ useHandCursor: true });
        // [P-59 2차] 호버 제거.
        rrHit.on('pointerdown',      () => drawRr(0.55));
        rrHit.on('pointerupoutside', () => drawRr(0.35));
        rrHit.on('pointerup',        () => { drawRr(0.35); rerollShop(scene); });
      }
      modal.body.add([rrG, rrHit, rrTxt]);
    }
  }

  // [Phase P-50a] '▶ 나가기' → '▶ 보스 진입' (자동 진행 흐름에서 매점 = 보스 직전).
  const exW = 140, exH = 32, exCx = modal.w / 2 - 90, exCy = bottomY;
  const exG = scene.add.graphics();
  const drawEx = (a) => {
    exG.clear();
    exG.fillStyle(0x000000, a);
    exG.fillRoundedRect(exCx - exW / 2, exCy - exH / 2, exW, exH, 4);
  };
  drawEx(0.35);
  const exTxt = addText(scene, exCx, exCy, '▶ 나가기', {
    fontFamily: FONT, fontSize: '20px', color: COLOR_GOLD, fontStyle: '700',
  }).setOrigin(0.5);
  exTxt.setShadow(1, 1, '#000000', 2, false, true);
  const exHit = scene.add.rectangle(exCx, exCy, exW, exH, 0x000000, 0.001).setScrollFactor(0).setInteractive({ useHandCursor: true });
  // [P-59 2차] 호버 제거.
  exHit.on('pointerdown',      () => drawEx(0.55));
  exHit.on('pointerupoutside', () => drawEx(0.35));
  exHit.on('pointerup',        () => { drawEx(0.35); exitShop(scene); });
  modal.body.add([exG, exHit, exTxt]);
}

// === 카테고리 라벨 ===
function labelForType(card) {
  const t = card.type;
  // [Phase P-37 후속] type 라벨 emoji 제거.
  if (t === 'consumable') return { label: '소모품',    color: '#6AD8FF' };
  if (t === 'passive')    return { label: '자동 발동', color: '#C084FC' };
  if (t === 'utility')    return { label: '기능',      color: '#FFD166' };
  // demon-deal 등 즉시효과 (bag.push X) — type 없음, "즉시" 라벨
  return { label: '즉시 효과', color: '#F87171' };
}

// === 구매 ===
export function buyShopCard(scene, index) {
  const offer = scene.shopOffers[index];
  if (!offer || offer.sold) return;
  const isTest = !!gameSettings.testMode;
  if (!isTest && (scene.player.stats.gold || 0) < offer.price) return;
  // 효과 적용 — 실패 시 (apply 가 false 반환) 차감 안 함 (악마의 계약 HP 가드 등)
  const ok = offer.apply ? offer.apply(scene, scene.player) : true;
  if (!ok) return;
  if (!isTest) {
    scene.player.stats.gold -= offer.price;
    scene.player.runStats.goldSpent = (scene.player.runStats.goldSpent || 0) + offer.price;
    if (scene.player.onGoldSpent) scene.player.onGoldSpent(offer.price);  // [Phase M2] 탐욕 L5 후크
  }
  offer.sold = true;
  sound.cardPicked();
  if (scene.player.updateHpDisplay) scene.player.updateHpDisplay();
  if (scene.updateInfoText) scene.updateInfoText();
  renderShop(scene);
}

// === Phase I — 다이아 매점 단일 슬롯 구매 ===
function buyDiamondOffer(scene) {
  const offer = scene.diamondOffer;
  if (!offer || offer.sold) return;
  // 더블클릭 더블스펜드 차단 — 결제 전 lock.
  offer.sold = true;
  if (!tryPayDiamonds(offer.price)) {
    offer.sold = false;   // 실패 시 lock 해제
    if (scene.events && scene.events.emit) scene.events.emit('toast', '❌ 다이아 부족');
    return;
  }
  // 효과 적용 — 실패 시 (apply 가 false 반환) 다이아 환불... 하지 않음 (현재 풀 3종은 항상 성공)
  const ok = offer.apply ? offer.apply(scene, scene.player) : true;
  if (!ok) { offer.sold = false; return; }
  sound.cardPicked();
  if (scene.events && scene.events.emit) {
    scene.events.emit('toast', `${offer.name} 구매`);
  }
  if (scene.player.updateHpDisplay) scene.player.updateHpDisplay();
  if (scene.updateInfoText) scene.updateInfoText();
  renderShop(scene);
}

// 호환 별칭
export function buyItem(scene, index)         { return buyShopCard(scene, index); }
export function buyConsumable(scene, index)   { return buyShopCard(scene, index); }
export function buySpecialCard(scene, index)  { return buyShopCard(scene, index); }

// === 종료 ===
export function exitShop(scene) {
  if (scene._clearItemTooltip) scene._clearItemTooltip();
  if (scene._shopModal && !scene._shopModal._closed) scene._shopModal.close();
}
