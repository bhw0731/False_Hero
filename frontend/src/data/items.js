// 상점 장비 — 8 슬롯, 슬롯당 1개만 장착 가능
// 새 장비를 사면 같은 슬롯의 기존 장비는 교체됨 (효과도 자동 갱신)
//
// [Phase O] 슬롯별 능력치 풀 (Phase K 10 stat 만 사용 — defense/moveSpeed/attackRange 폐기):
//   투구       → 최대 HP, 피해 감소, 치명타 확률
//   악세서리   → 치명타 확률, 치명타 피해, 공격력, 골드 획득량
//   갑옷       → 최대 HP, 피해 감소, 흡혈
//   방패       → 회피, 흡혈, 명중
//   무기       → 공격력, 공격 속도, 치명타 확률, 치명타 피해
//   장갑       → 공격 속도, 공격력, 치명타 확률
//   각반       → 최대 HP, 회피, 피해 감소
//   신발       → 회피, 공격 속도, 치명타 확률
//
// 등급 분포: 슬롯마다 1커먼 + 3언커먼 + 4레어 + 5에픽 + 5전설 = 18개
// 총 144개
//
// 일부 에픽 / 전설 장비는 passive 필드를 가짐 — passives.js 의 ID 를 참조,
// 장착하면 CombatSystem 이 해당 시점에 자동으로 효과를 적용합니다.
//
// effect 객체 stat 키 (Phase K 10 stat):
//   maxHp           — 절대 정수 (예: +20)
//   attackPower     — 절대 정수 (예: +5)
//   attackSpeed     — 음수 ms (예: -50 = 약 +5%, base 900ms 기준)
//   critChance      — 절대 0~1 (예: 0.05 = +5%)
//   critDamage      — 절대 0~1 (예: 0.20 = +20%)
//   accuracy        — 절대 0~1
//   dodge           — 절대 0~1
//   lifesteal       — 절대 0~1
//   damageReduction — 절대 0~1
//   goldGainMul     — base 1.0 + delta (예: 0.10 = ×1.10)

// 슬롯 순서 — UI 표시 순서 (장비 모달, 상점 우측 패널, TopBar)
export const SLOTS = ['head', 'accessory', 'body', 'shield', 'hands', 'arms', 'legs', 'feet'];
export const SLOT_LABELS = {
  head:      '투구',
  accessory: '악세서리',
  body:      '갑옷',
  shield:    '방패',
  hands:     '무기',
  arms:      '장갑',
  legs:      '각반',
  feet:      '신발',
};
export const SLOT_ICONS = {
  head:      '🪖',
  accessory: '📿',
  body:      '🦺',
  shield:    '🛡',
  hands:     '⚔️',
  arms:      '🧤',
  legs:      '👖',
  feet:      '👢',
};

// [Phase P-55] 개별 장비 아이템 시스템 폐기 — 슬롯 강화 (data/loadoutUpgrades.js) 로 대체.
// items 배열은 옛 코드 호환용 빈 배열로 유지 (외부 import 가 깨지지 않게).
export const items = [];
