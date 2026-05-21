// 7대죄 시스템 — 카드 분류 기준
// 같은 죄의 카드를 3장 이상 모으면 "신과의 계약" 시너지 발동.
// 단계: 3장 (3단계) / 6장 (6단계) / 9장 (거짓된 계약).
// 또한 활성+2번째 죄 둘 다 ≥3장 모이면 듀얼 시너지 (단계 무관, 한 효과만).
//
// 컨셉: 가짜 영웅이 신인 줄 알았던 7대죄와 거짓된 계약을 맺다.

export const SINS = {
  WRATH:    '분노',
  GREED:    '탐욕',
  SLOTH:    '나태',
  PRIDE:    '오만',
  LUST:     '색욕',
  ENVY:     '질투',
  GLUTTONY: '폭식',
};

export const SIN_NAMES = {
  [SINS.WRATH]:    '분노의 신',
  [SINS.GREED]:    '탐욕의 신',
  [SINS.SLOTH]:    '나태의 신',
  [SINS.PRIDE]:    '오만의 신',
  [SINS.LUST]:     '색욕의 신',
  [SINS.ENVY]:     '질투의 신',
  [SINS.GLUTTONY]: '폭식의 신',
};

export const SIN_ICONS = {
  [SINS.WRATH]:    '🔥',
  [SINS.GREED]:    '💰',
  [SINS.SLOTH]:    '🛡',
  [SINS.PRIDE]:    '✨',
  [SINS.LUST]:     '💜',
  [SINS.ENVY]:     '💢',
  [SINS.GLUTTONY]: '🍖',
};

export const SIN_COLORS = {
  [SINS.WRATH]:    '#FF6B35',   // 주황빨강
  [SINS.GREED]:    '#FFD700',   // 황금
  [SINS.SLOTH]:    '#8B4513',   // 갈색
  [SINS.PRIDE]:    '#FFFFFF',   // 흰색
  [SINS.LUST]:     '#FF69B4',   // 핑크
  [SINS.ENVY]:     '#9370DB',   // 보라
  [SINS.GLUTTONY]: '#FF8C00',   // 주황
};

export const SIN_LIST = Object.values(SINS);

// 한국어 sin 이름 → 영문 키 매핑 (시너지 효과 ID 생성용 — 'wrath_3' 등)
export const SIN_KEY = {
  [SINS.WRATH]:    'wrath',
  [SINS.GREED]:    'greed',
  [SINS.SLOTH]:    'sloth',
  [SINS.PRIDE]:    'pride',
  [SINS.LUST]:     'lust',
  [SINS.ENVY]:     'envy',
  [SINS.GLUTTONY]: 'gluttony',
};

// 시너지 단계 임계값 — 내림차순 (큰 단계 먼저 매칭)
// 3 (3단계) / 6 (6단계) / 9 (거짓된 계약)
export const SYNERGY_TIERS = [9, 6, 3];

// 카운트 → 시너지 단계 변환
export function getSynergyTier(count) {
  if (count >= 9) return 9;
  if (count >= 6) return 6;
  if (count >= 3) return 3;
  return 0;
}

// 듀얼 시너지 활성 조건 — 활성+2번째 둘 다 ≥3장
export function isDualActive(activeCount, secondaryCount) {
  return (activeCount || 0) >= 3 && (secondaryCount || 0) >= 3;
}

// 듀얼 시너지 식별 키 — 두 sin 정렬해서 일관된 순서 (예: 'wrath_envy' 항상 같음)
// SIN_LIST(=Object.values(SINS)) 의 인덱스 순으로 정렬.
export function getDualSinPair(sinA, sinB) {
  if (!sinA || !sinB) return null;
  const ia = SIN_LIST.indexOf(sinA);
  const ib = SIN_LIST.indexOf(sinB);
  if (ia < 0 || ib < 0) return null;
  const [first, second] = (ia <= ib) ? [sinA, sinB] : [sinB, sinA];
  return `${first}_${second}`;
}
