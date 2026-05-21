// 잡몹 데이터 16종 — 스테이지에서 매 마리마다 랜덤 등장
// 외형(파일명)과 이름이 일치. 각 스프라이트는 잡몹 / 보스 양쪽으로 활용됨.
// [Phase P-44d] 사거리 100/150 2분류 — 플레이어 100, 적은 근접 100 / 원거리 150.
//   원거리(150) 5종: spider, ghost, apprenticeWitch, apprenticeMage, darkAcolyte
//   근접(100)  11종: 나머지 모두 (LATE 5종 포함)

import Phaser from 'phaser';
import { getEnemyOverrides } from './adminConfig.js';

export const enemyTypes = [
  // 1. 슬라임 — 약하고 균형잡힌 표준
  {
    id: 'slime',
    name: '슬라임',
    spriteKey: '슬라임',
    baseHp: 30,
    attackPower: 5,
    attackRange: 100,
    attackSpeed: 800,
    dodgeChance: 0,
    defense: 0,
    size: 48,
    expReward: 20,
    goldReward: 8,
  },

  // 2. 쥐 — 작고 빠르고 약함
  {
    id: 'rat',
    name: '쥐',
    spriteKey: '쥐',
    baseHp: 18,
    attackPower: 4,
    attackRange: 100,
    attackSpeed: 600,
    dodgeChance: 0.10,
    defense: 0,
    size: 42,
    expReward: 16,
    goldReward: 6,
  },

  // 3. 거미 — 작고 빠른 회피형
  {
    id: 'spider',
    name: '거미',
    spriteKey: '거미',
    baseHp: 22,
    attackPower: 4,
    attackRange: 150,
    attackSpeed: 650,
    dodgeChance: 0.20,
    defense: 0,
    size: 44,
    expReward: 20,
    goldReward: 8,
  },

  // 4. 전갈 — 한 방이 강한 독침 + 갑각
  {
    id: 'scorpion',
    name: '전갈',
    spriteKey: '전갈',
    baseHp: 28,
    attackPower: 7,
    attackRange: 100,
    attackSpeed: 1000,
    dodgeChance: 0.05,
    defense: 2,
    size: 46,
    expReward: 22,
    goldReward: 10,
  },

  // 5. 드워프 — HP + 갑옷 단단
  {
    id: 'dwarf',
    name: '드워프',
    spriteKey: '드워프',
    baseHp: 50,
    attackPower: 7,
    attackRange: 100,
    attackSpeed: 1300,
    dodgeChance: 0,
    defense: 4,
    size: 50,
    expReward: 26,
    goldReward: 12,
  },

  // 6. 유령 — 회피 매우 높음 (실체 없음)
  {
    id: 'ghost',
    name: '유령',
    spriteKey: '유령',
    baseHp: 22,
    attackPower: 5,
    attackRange: 150,
    attackSpeed: 900,
    dodgeChance: 0.30,
    defense: 0,
    size: 48,
    expReward: 24,
    goldReward: 10,
  },

  // 7. 대머리 — 거친 단순 공격형
  {
    id: 'bald',
    name: '대머리',
    spriteKey: '대머리',
    baseHp: 36,
    attackPower: 6,
    attackRange: 100,
    attackSpeed: 950,
    dodgeChance: 0,
    defense: 1,
    size: 48,
    expReward: 20,
    goldReward: 9,
  },

  // 8. 하급 기사 — 약하지만 균형잡힌 견습 기사 (가벼운 갑옷)
  {
    id: 'lowKnight',
    name: '하급 기사',
    spriteKey: '하급 기사',
    baseHp: 28,
    attackPower: 5,
    attackRange: 100,
    attackSpeed: 950,
    dodgeChance: 0.05,
    defense: 2,
    size: 48,
    expReward: 20,
    goldReward: 10,
  },

  // 9. 중급 기사 — 균형잡힌 정규 기사 (중갑)
  {
    id: 'midKnight',
    name: '중급 기사',
    spriteKey: '중급 기사',
    baseHp: 38,
    attackPower: 6,
    attackRange: 100,
    attackSpeed: 950,
    dodgeChance: 0.05,
    defense: 3,
    size: 50,
    expReward: 24,
    goldReward: 11,
  },

  // 10. 중급 야만인 — 공격력 높음 (가죽)
  {
    id: 'midBarbarian',
    name: '중급 야만인',
    spriteKey: '중급 야만인',
    baseHp: 32,
    attackPower: 8,
    attackRange: 100,
    attackSpeed: 1000,
    dodgeChance: 0,
    defense: 1,
    size: 50,
    expReward: 24,
    goldReward: 11,
  },

  // 11. 견습 마녀 — 마법 연사, 천옷
  {
    id: 'apprenticeWitch',
    name: '견습 마녀',
    spriteKey: '마녀',
    baseHp: 24,
    attackPower: 5,
    attackRange: 150,
    attackSpeed: 800,
    dodgeChance: 0.05,
    defense: 0,
    size: 48,
    expReward: 22,
    goldReward: 10,
  },

  // 12. 마법사 도제 — 사거리 김, 천옷
  {
    id: 'apprenticeMage',
    name: '마법사 도제',
    spriteKey: '마법사',
    baseHp: 22,
    attackPower: 5,
    attackRange: 150,
    attackSpeed: 1000,
    dodgeChance: 0.05,
    defense: 0,
    size: 48,
    expReward: 22,
    goldReward: 10,
  },

  // 13. 백기사 — 균형형 강자 (판금)
  {
    id: 'whiteKnight',
    name: '백기사',
    spriteKey: '상급 기사',
    baseHp: 44,
    attackPower: 7,
    attackRange: 100,
    attackSpeed: 1000,
    dodgeChance: 0.05,
    defense: 4,
    size: 52,
    expReward: 28,
    goldReward: 13,
  },

  // 14. 야만족 전사 — 강한 공격 (가죽)
  {
    id: 'barbarianWarrior',
    name: '야만족 전사',
    spriteKey: '상급 야만인',
    baseHp: 38,
    attackPower: 9,
    attackRange: 100,
    attackSpeed: 1100,
    dodgeChance: 0,
    defense: 2,
    size: 52,
    expReward: 28,
    goldReward: 13,
  },

  // 15. 거인족 — HP + 두꺼운 가죽
  {
    id: 'giantkin',
    name: '거인족',
    spriteKey: '거인',
    baseHp: 60,
    attackPower: 7,
    attackRange: 100,
    attackSpeed: 1400,
    dodgeChance: 0,
    defense: 5,
    size: 56,
    expReward: 30,
    goldReward: 14,
  },

  // 16. 어둠 사도 — 어둠 마법
  {
    id: 'darkAcolyte',
    name: '어둠 사도',
    spriteKey: '타락한 마법사',
    baseHp: 30,
    attackPower: 7,
    attackRange: 150,
    attackSpeed: 1050,
    dodgeChance: 0.10,
    defense: 1,
    size: 50,
    expReward: 26,
    goldReward: 12,
  },
];

// 관리자 오버라이드 적용 후 반환 — id 로 조회
export function getEnemyById(id) {
  const base = enemyTypes.find(e => e.id === id);
  if (!base) return null;
  const override = getEnemyOverrides()[id];
  return override ? { ...base, ...override } : base;
}

// [Phase Fix-3] 스테이지별 잡몹 풀 분류
//   EARLY_POOL (1~3스): 약한 잡몹만 등장 — 1웨 사망률 하향 / 클리어 HP 75~85% 목표.
//   LATE_POOL  (4스+) : 강한 잡몹 추가 — 4스부터 난이도 곡선 본격화.
//   ⚠ 분류 기준: 명세서 § 8 표. base hp ≤ 30 ⇒ EARLY (예외: lowKnight=28 EARLY),
//                base hp ≥ 32 ⇒ LATE (단 prefix 'mid'/'mid' / 'white' 등 강자 식별자).
export const EARLY_POOL_IDS = [
  'slime', 'rat', 'spider', 'scorpion', 'dwarf', 'ghost', 'bald',
  'lowKnight', 'apprenticeWitch', 'apprenticeMage', 'darkAcolyte',
]; // 11종
export const LATE_POOL_IDS = [
  'midKnight', 'midBarbarian', 'whiteKnight', 'barbarianWarrior', 'giantkin',
]; // 5종

// 랜덤 잡몹 하나 (오버라이드 적용된 상태) — WaveSystem 에서 사용
// [Phase Fix-3] stage 인자 추가 — 1~3스는 EARLY_POOL 만, 4스+ 는 전체 풀.
export function pickRandomEnemy(stage = 99) {
  const pool = (stage <= 3)
    ? EARLY_POOL_IDS
    : enemyTypes.map(e => e.id); // 4스+: 전체 16종
  const idx = Phaser.Math.Between(0, pool.length - 1);
  return getEnemyById(pool[idx]);
}

// [Phase P-54] 세그먼트별 잡몹 다양성 — 스테이지 진행 따라 약→강 점진적 분포.
// 5 세그먼트 (서브1/서브2/서브3/정예/메인 직전), 각자 풀 가중치 다름.
const WEAK_IDS = ['slime', 'rat', 'spider'];                                                              // 약함
const MID_IDS  = ['scorpion', 'dwarf', 'ghost', 'bald', 'lowKnight', 'apprenticeWitch', 'apprenticeMage', 'darkAcolyte']; // 중간
const STRONG_IDS = ['midKnight', 'midBarbarian', 'whiteKnight', 'barbarianWarrior', 'giantkin'];           // 강함

// 세그먼트 인덱스 (0~4) 별 [WEAK%, MID%, STRONG%] 가중치
const SEGMENT_WEIGHTS = [
  [0.65, 0.30, 0.05],  // seg 0: 시작 직후, 약한 적 위주
  [0.40, 0.45, 0.15],  // seg 1: 약+중 균형
  [0.20, 0.55, 0.25],  // seg 2: 중심 중간 적
  [0.10, 0.50, 0.40],  // seg 3: 중+강 비중 ↑
  [0.05, 0.35, 0.60],  // seg 4: 메인 직전, 강한 적 위주
];

export function pickRandomEnemyForSegment(stage = 99, segmentIdx = 0) {
  // 1~3스: STRONG 풀 차단 (EARLY_POOL 만)
  const earlyMode = stage <= 3;
  const weights = SEGMENT_WEIGHTS[Math.max(0, Math.min(4, segmentIdx))];

  const r = Math.random();
  let pool;
  if (r < weights[0]) {
    pool = WEAK_IDS;
  } else if (r < weights[0] + weights[1]) {
    pool = MID_IDS;
  } else {
    // STRONG 풀 — 1~3스에선 MID 로 폴백 (EARLY_POOL 외 차단)
    pool = earlyMode ? MID_IDS : STRONG_IDS;
  }
  const idx = Phaser.Math.Between(0, pool.length - 1);
  return getEnemyById(pool[idx]);
}
