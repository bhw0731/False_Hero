// 카드 통합 — 7대죄 카드 풀 + 호환성 유지
//
// 신규 카드 추가는 data/cards/{sin}Cards.js 에서.
// 이 파일은 통합 export 만 담당 (구조 단일화).
//
// 카드 스키마:
//   { name, icon, sin, rarity, desc, apply }
//   호환: tier (rarity 와 동일 의미) / type (구버전, 사용 안 함)

import { wrathCards }    from './cards/wrathCards.js';
import { greedCards }    from './cards/greedCards.js';
import { slothCards }    from './cards/slothCards.js';
import { prideCards }    from './cards/prideCards.js';
import { lustCards }     from './cards/lustCards.js';
import { envyCards }     from './cards/envyCards.js';
import { gluttonyCards } from './cards/gluttonyCards.js';

export { SINS, SIN_NAMES, SIN_ICONS, SIN_COLORS, SIN_LIST, SYNERGY_TIERS }
  from './sins.js';

// 통합 카드 풀 — 모든 죄 합쳐서 export
export const commonCards = [
  ...wrathCards,
  ...greedCards,
  ...slothCards,
  ...prideCards,
  ...lustCards,
  ...envyCards,
  ...gluttonyCards,
];

// 호환용 — 일부 코드가 allCards 참조
export const allCards = [...commonCards];

// 카드 이름 표시 헬퍼 — '(노말)' / '(레어)' / '(레전드)' 등급 접미사 제거.
// 데이터상 동일 베이스 이름이 등급별 분기되어 있어 c.name 자체엔 suffix 가 있음
// (dedup / 픽 기록은 raw name 사용). 화면에선 별도 등급 라벨이 있으니 suffix 불필요.
export function displayCardName(card) {
  if (!card || !card.name) return '';
  return card.name.replace(/\s*\((?:노말|레어|레전드|에픽|만능)\)\s*$/u, '');
}

// === 스테이지별 등급 확률 가중치 [Phase P-54] 3등급 (normal/rare/legend) ===
// 분배: 죄별 노말 12 / 레어 14 / 레전드 8 = 34장 × 7죄 = 238장 + 만능 1장 = 239장.
// 1~3스: 초반 — normal 위주
// 4~7스: 중반 — normal/rare 균형
// 8~10스: 후반 — rare/legend 등장
export function getRarityWeights(stage) {
  if (stage >= 1 && stage <= 3) {
    return { normal: 0.70, rare: 0.28, legend: 0.02 };
  }
  if (stage >= 4 && stage <= 7) {
    return { normal: 0.40, rare: 0.50, legend: 0.10 };
  }
  if (stage >= 8 && stage <= 10) {
    return { normal: 0.20, rare: 0.55, legend: 0.25 };
  }
  return { normal: 0.70, rare: 0.28, legend: 0.02 };
}

// 가중치 객체에서 무작위 등급 추첨 (가중치 비례)
export function pickRarity(weights) {
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  if (total <= 0) return 'normal';
  let r = Math.random() * total;
  for (const [tier, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return tier;
  }
  return 'normal';
}

// 등급별 색상 (UI 카드 테두리/배지) — 3등급 [Phase P-54]
export const CARD_TIER_COLORS = {
  normal: { name: '노말',   hex: '#94A3B8', color: 0x94A3B8 },
  rare:   { name: '레어',   hex: '#A855F7', color: 0xA855F7 },  // 옛 에픽 보라 → 새 레어 색
  legend: { name: '레전드', hex: '#FFB300', color: 0xFFB300 },
};
