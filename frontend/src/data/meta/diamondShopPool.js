// 다이아 매점 풀 — Phase I.
// 휴식 매점 (ShopModal) 의 [💎 다이아 매점] 탭에서 진입당 1종 무작위 추첨.
// 1챕터부터 활성. 다이아 0이어도 탭/슬롯 노출 (살 수만 없음).

import { spendDiamonds, getDiamonds } from './diamonds.js';
import { gameSettings } from '../settings.js';

// type 종류:
//   passive   — bag.push (사망 시 자동 발동, Player.takeDamage 가 처리)
//   utility   — bag.push (인벤토리에서 클릭 시 InventoryModal._useBuiltin 디스패처)
//   immediate — apply 가 즉시 효과 (bag.push X, 예: nextBossHpReduce 세팅)
export const DIAMOND_SHOP_POOL = [
  {
    id: 'diamond-revive', name: '다이아 부활석', icon: '🪨',
    desc: '자동 부활\nHP 75%, 무적 2초', price: 30, color: 0xC084FC,
    apply: (scene, player) => {
      player.bag.push({
        id: 'diamond-revive', name: '다이아 부활석', icon: '🪨',
        type: 'passive', revivePct: 0.75, invulnSec: 2, color: 0xC084FC,
        passive: true,    // 호환 — 옛 코드 (card.passive 체크)
      });
      if (player.runStats) {
        player.runStats.specialCardsBought = (player.runStats.specialCardsBought || 0) + 1;
      }
      return true;
    },
  },
  {
    id: 'diamond-upgrade', name: '다이아 등급업권', icon: '⭐',
    desc: '보유 카드 1장\n등급 +1 (모든 죄)', price: 50, color: 0x60A5FA,
    apply: (scene, player) => {
      player.bag.push({
        id: 'diamond-upgrade', name: '다이아 등급업권', icon: '⭐',
        type: 'utility', color: 0x60A5FA,
      });
      return true;
    },
  },
  {
    id: 'diamond-boss-weaken', name: '보스 약화', icon: '⚔',
    desc: '다음 보스\nHP -30%', price: 20, color: 0xDC2626,
    apply: (scene, player) => {
      player.nextBossHpReduce = 0.30;
      return true;
    },
  },
  {
    id: 'diamond-auto-potion', name: '자동 물약', icon: '🤖',
    desc: 'HP 40% 이하 시\n물약 자동 사용', price: 35, color: 0xF87171,
    apply: (scene, player) => {
      player.bag.push({
        id: 'diamond-auto-potion', name: '자동 물약', icon: '🤖',
        type: 'passive', color: 0xF87171,
        passive: true,    // 호환 — Player.update 가 bag 안 패시브 효과 자동 감지.
      });
      if (player.runStats) {
        player.runStats.specialCardsBought = (player.runStats.specialCardsBought || 0) + 1;
      }
      return true;
    },
  },
];

// 매점 진입 시 1개 추첨 (단일 슬롯).
export function pickDiamondOffer() {
  const idx = Math.floor(Math.random() * DIAMOND_SHOP_POOL.length);
  return { ...DIAMOND_SHOP_POOL[idx], sold: false };
}

// 다이아 차감 (테스트모드 시 무제한, 실제 차감 X).
// 반환: true = 차감 성공 또는 testMode, false = 잔액 부족.
export function tryPayDiamonds(price) {
  if (gameSettings.testMode) return true;
  if (getDiamonds() < price) return false;
  spendDiamonds(price);
  return true;
}
