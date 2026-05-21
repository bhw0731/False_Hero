// 특수 카드 — 가방 복원용 메타데이터 (id → 객체 매핑).
// 매점 신규 컨텐츠는 ui/ShopModal.js 의 SHOP_POOL / data/diamondShopPool.js 에서 정의.
// 본 파일은 세이브 복원 (state.bag id 배열 → 객체 배열) 용 메타데이터만 보유.
//
// type 'passive': 자동 발동 (가방에서 직접 사용 불가, Player.takeDamage 가 사망 시 검사)
// type 'consumable' / 'utility': 인벤토리에서 클릭 시 즉시 발동 + 가방에서 제거

export const specialCards = [
  {
    id: 'revive-stone',
    name: '부활석',
    icon: '🪨',
    type: 'passive',
    desc: '사망 시 1회 자동 발동\nHP 35%로 부활 + 1초 무적',
    price: 200,
    color: 0xFF8FB1,
    passive: true,        // 호환 — 옛 코드(card.passive 체크) 유지용
  },
  // Phase I — 다이아 매점 항목 (가방 복원용)
  {
    id: 'diamond-revive',
    name: '다이아 부활석',
    icon: '🪨',
    type: 'passive',
    desc: '사망 시 1회 자동 발동\nHP 75%로 부활 + 2초 무적',
    price: 30,            // 다이아
    color: 0xC084FC,
    passive: true,
  },
  {
    id: 'diamond-upgrade',
    name: '다이아 등급업권',
    icon: '⭐',
    type: 'utility',
    desc: '보유 카드 1장\n등급 +1 (모든 죄)',
    price: 50,            // 다이아
    color: 0x60A5FA,
  },
  {
    id: 'diamond-auto-potion',
    name: '자동 물약',
    icon: '🤖',
    type: 'passive',
    desc: 'HP 40% 이하 시\n물약 자동 사용',
    price: 35,            // 다이아
    color: 0xF87171,
    passive: true,
  },
];

// id로 카드 찾기 (세이브 가방 복원 등에서 사용)
export function getSpecialCardById(id) {
  return specialCards.find(c => c.id === id) || null;
}
