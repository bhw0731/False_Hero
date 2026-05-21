// 장비 패시브 — 에픽 / 전설 등급 일부 장비에 부여되는 자동 발동 효과
// item.passive 필드에 id 가 들어 있으면, CombatSystem 이 해당 시점에 자동으로 효과를 적용합니다.

export const PASSIVES = {
  'vampiric-strike': { name: '타격 흡혈',  desc: '공격 적중 시 입힌 데미지의 5% HP 회복' },
  'first-strike':    { name: '선제 타격',  desc: '새로운 적의 첫 일격 데미지 ×2' },
  'harvester':       { name: '수확자',     desc: 'HP 20% 미만 적에게 데미지 ×1.5' },
  'chain-strike':    { name: '연속 베기',  desc: '처치 시 30% 확률로 즉시 한 번 더 공격' },
  'explosive-strike':{ name: '폭발 일격',  desc: '매 5번째 공격이 광역 (50% 스플래시)' },
  'damage-reflect':  { name: '가시 반사',  desc: '받은 데미지의 30% 를 적에게 반사' },
  'crit-frenzy':     { name: '치명 폭주',  desc: '치명타 시 5초간 공속 +20%' },
  'invuln-strike':   { name: '무적 일격',  desc: '7초마다 받는 데미지 1회 무효화' },
  'second-wind':     { name: '위기 회복',  desc: 'HP 25% 이하 시 25% 회복 (웨이브당 1회)' },
  'executioner':     { name: '처형자',     desc: '잡몹 HP 8% 이하 시 즉사 (보스 제외)' },
  'berserker':       { name: '광폭화',     desc: 'HP 50% 이하일 때 공격력 +25%' },
  'lightning-strike':{ name: '연쇄 번개',  desc: '공격 시 20% 확률 다른 적에게 60% 데미지' },
};

export function passiveInfo(id) {
  return id ? PASSIVES[id] || null : null;
}
