// 슬롯 강화 시스템 (Phase P-55)
// 옛 개별 장비 아이템 구매 시스템 폐기 — 8슬롯 각각 Lv 0~10 강화로 대체.
//
// 영구 진행 — 다이아 상점에서 강화 (data/diamonds.js 의 slotLevels 사용).
// 게임 진입 시 각 슬롯 레벨에 해당하는 effect 가 Player stats 에 누적 적용.
//
// 메인 / 보조 — 부위별 컨셉에 어울리게 디벨롭 (방어/유틸/공격/기동).
//   투구       maxHp           → 5렙 부터 damageReduction   (머리 보호)
//   악세서리   goldGainMul     → 5렙 부터 lifesteal         (마법 유틸)
//   갑옷       maxHp           → 5렙 부터 damageReduction   (몸통 본 방어)
//   방패       damageReduction → 5렙 부터 maxHp             (막아내고 체력 ↑)
//   무기       attackPower     → 5렙 부터 critDamage        (강한 일격)
//   장갑       attackSpeed     → 5렙 부터 critChance        (빠른 손 + 정확한 타격, attackSpeed 음수=빠름)
//   각반       dodge           → 5렙 부터 damageReduction   (다리로 회피 + 보호)
//   신발       accuracy        → 5렙 부터 attackSpeed       (정확 + 빠른 행동)

export const MAX_LEVEL = 10;

// === [P-65] 확률 강화 (소프트, 천장 없음) ===
// 실패 시: 다이아만 소모, 레벨 유지 (하락 X). 천장 X — 순수 확률.
//   다이아 수급 콘텐츠로 강화 시도 횟수를 커버하는 설계.
export const PITY_THRESHOLD = 0;   // 0 = 천장 비활성.

// 현재 레벨(curLv) 기준 다음 강화 성공 확률 (0~1). curLv = 강화 전 레벨.
const _SUCCESS_RATES = [
  1.00,  // 0 → 1
  0.85,  // 1 → 2
  0.70,  // 2 → 3
  0.55,  // 3 → 4
  0.40,  // 4 → 5
  0.30,  // 5 → 6
  0.25,  // 6 → 7
  0.20,  // 7 → 8
  0.15,  // 8 → 9
  0.10,  // 9 → 10
];
export function getSuccessRate(curLv) {
  if (curLv < 0 || curLv >= MAX_LEVEL) return 0;
  return _SUCCESS_RATES[curLv] != null ? _SUCCESS_RATES[curLv] : 0.01;
}

// 레벨별 다이아 비용 (누적 X — 한 단계 올릴 때마다 드는 비용).
// 합산 8520 💎 = 모든 슬롯 풀강.
export const LEVEL_COSTS = [
  0,   // Lv 0 (보유 X — 비용 의미 없음)
  10,  // → Lv 1
  20,  // → Lv 2
  30,  // → Lv 3
  45,  // → Lv 4
  60,  // → Lv 5
  80,  // → Lv 6
  105, // → Lv 7
  135, // → Lv 8
  170, // → Lv 9
  210, // → Lv 10
];

// 슬롯별 stat 증분 — 레벨당 더해지는 값. (누적 적용).
// effect = { stat: deltaPerLevel } — Player 가 level 만큼 곱해서 적용.
// secondaryThreshold — 이 레벨 이상에서만 보조 stat 활성화.
const SLOT_TIERS = {
  head: {
    label: '투구',
    main:      { stat: 'maxHp',           perLevel: 8     },
    secondary: { stat: 'damageReduction', perLevel: 0.010, threshold: 5 },
  },
  accessory: {
    label: '악세서리',
    main:      { stat: 'goldGainMul',     perLevel: 0.03  },
    secondary: { stat: 'lifesteal',       perLevel: 0.008, threshold: 5 },
  },
  body: {
    label: '갑옷',
    main:      { stat: 'maxHp',           perLevel: 12    },
    secondary: { stat: 'damageReduction', perLevel: 0.015, threshold: 5 },
  },
  shield: {
    label: '방패',
    main:      { stat: 'damageReduction', perLevel: 0.02  },
    secondary: { stat: 'maxHp',           perLevel: 6,     threshold: 5 },
  },
  hands: {
    label: '무기',
    main:      { stat: 'attackPower',     perLevel: 2     },
    secondary: { stat: 'critDamage',      perLevel: 0.04,  threshold: 5 },
  },
  arms: {
    label: '장갑',
    main:      { stat: 'attackSpeed',     perLevel: -20   },   // 음수 = 빠름
    secondary: { stat: 'critChance',      perLevel: 0.005, threshold: 5 },
  },
  legs: {
    label: '각반',
    main:      { stat: 'dodge',           perLevel: 0.015 },
    secondary: { stat: 'damageReduction', perLevel: 0.010, threshold: 5 },
  },
  feet: {
    label: '신발',
    main:      { stat: 'accuracy',        perLevel: 0.025 },
    secondary: { stat: 'attackSpeed',     perLevel: -10,   threshold: 5 },
  },
};

// 다음 레벨 비용 (level 은 현재 레벨, 반환값은 한 단계 올리는 비용).
export function getNextLevelCost(level) {
  if (level >= MAX_LEVEL) return null;
  return LEVEL_COSTS[level + 1];
}

// 슬롯 Lv N 의 누적 effect — { stat: total_delta } 형식 반환.
// Player.applyLoadout 가 이걸로 stats 에 modStat('equipment', delta) 적용.
export function getSlotEffect(slot, level) {
  const tier = SLOT_TIERS[slot];
  if (!tier || level <= 0) return {};
  const eff = {};
  // 메인 stat
  eff[tier.main.stat] = (eff[tier.main.stat] || 0) + tier.main.perLevel * level;
  // 보조 stat (threshold 이상부터)
  if (tier.secondary && level >= tier.secondary.threshold) {
    const sec = tier.secondary;
    const secLevels = level - sec.threshold + 1;
    eff[sec.stat] = (eff[sec.stat] || 0) + sec.perLevel * secLevels;
  }
  return eff;
}

// 슬롯 정의 메타 (UI 라벨 등).
export function getSlotMeta(slot) {
  return SLOT_TIERS[slot] || null;
}

// 한 레벨 올렸을 때 추가되는 effect (UI 미리보기용).
export function getLevelDelta(slot, fromLevel) {
  const tier = SLOT_TIERS[slot];
  if (!tier || fromLevel >= MAX_LEVEL) return {};
  const eff = {};
  eff[tier.main.stat] = tier.main.perLevel;
  // 보조 stat — threshold 도달 직전→직후일 때만 한 번에 활성, 또는 이미 threshold 이상이면 매 레벨 perLevel.
  if (tier.secondary) {
    const sec = tier.secondary;
    if (fromLevel + 1 === sec.threshold) {
      // threshold 진입 시 처음 활성 — 첫 perLevel 한 번.
      eff[sec.stat] = sec.perLevel;
    } else if (fromLevel + 1 > sec.threshold) {
      eff[sec.stat] = sec.perLevel;
    }
  }
  return eff;
}
