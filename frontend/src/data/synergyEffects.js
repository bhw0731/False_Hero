// 시너지 효과 본체 — 단일 21개 + 듀얼 21쌍 = 42 항목.
// [Phase N1] 단일 21 재설계 — 페널티 X, Phase K 새 stat 매핑, 옵션 B 카드 시스템 정합.
// 듀얼 21은 placeholder 보존 (Phase N2 작성 예정).
//
// === 효과 스키마 ===
// { id, type: 'single' | 'dual', sin, tier, dualKey, description,
//   apply(player) → payload, revert(player, payload) }
//
// 효과 타입:
//   A타입 — 단순 stat (apply/revert 시 modStat). payload에 실제 변동량 저장 (revert 정확용).
//   B/C/D타입 (동적) — 플래그 set/clear만, 본체는 Player getter (getEffectiveAttackPower 등) 분기.
//   E/F타입 (트리거) — 플래그 set/clear만, 본체는 Player.onEnemyKilled 분기 (sin-seal 무효).

// === A타입 헬퍼 — apply 시점 stat × ratio 변동량 저장 + revert 시 음수로 회수 ===
function statBoostMul(player, stat, ratio) {
  const delta = player.getStat(stat) * ratio;
  player.modStat(stat, 'synergy', delta);
  return { [stat]: delta };
}
function statBoostAdd(player, stat, value) {
  player.modStat(stat, 'synergy', value);
  return { [stat]: value };
}
function revertPayload(player, payload) {
  if (!payload) return;
  for (const [stat, delta] of Object.entries(payload)) {
    player.modStat(stat, 'synergy', -delta);
  }
}

// [Phase N2] 듀얼 시너지 헬퍼 — 플래그 set/clear + 옵션으로 트래커 회수.
// flagKey: Player 의 활성 플래그 (예: '_wrathGreedActive').
// resetFn(player): revert 시 추가 회수 작업 (트래커 공격력 회수 등).
function dualEffect(dualKey, sins, description, flagKey, resetFn) {
  return {
    id: dualKey, type: 'dual', sin: null, tier: null, dualKey, sins,
    description,
    apply: (player) => { player[flagKey] = true; return {}; },
    revert: (player) => {
      player[flagKey] = false;
      if (resetFn) resetFn(player);
    },
  };
}

export const synergyEffects = [
  // ============================================================
  // 단일 21 (7죄 × 3단계) — Phase N1 신규 작성
  // ============================================================

  // ============ 분노 (WRATH) — 메인 공격력 ============
  {
    id: 'wrath_3', type: 'single', sin: '분노', tier: 3, dualKey: null,
    description: '분노의 신 3단계 — 공격력 +5%',
    apply: (p) => statBoostMul(p, 'attackPower', 0.05),
    revert: revertPayload,
  },
  {
    id: 'wrath_6', type: 'single', sin: '분노', tier: 6, dualKey: null,
    description: '분노의 신 6단계 — 공격력 +15%',
    apply: (p) => statBoostMul(p, 'attackPower', 0.15),
    revert: revertPayload,
  },
  {
    id: 'wrath_9', type: 'single', sin: '분노', tier: 9, dualKey: null,
    description: '분노의 신 9단계 — 공격력 +30% + HP 비율 반비례 추가 (HP 0% 시 +20%)',
    apply: (p) => {
      p._wrath9Active = true;   // B타입 동적 (HP 비율 반비례)
      return statBoostMul(p, 'attackPower', 0.30);
    },
    revert: (p, payload) => {
      p._wrath9Active = false;
      revertPayload(p, payload);
    },
  },

  // ============ 탐욕 (GREED) — 메인 goldGainMul ============
  {
    id: 'greed_3', type: 'single', sin: '탐욕', tier: 3, dualKey: null,
    description: '탐욕의 신 3단계 — 골드 획득량 +20%',
    apply: (p) => statBoostAdd(p, 'goldGainMul', 0.20),
    revert: revertPayload,
  },
  {
    id: 'greed_6', type: 'single', sin: '탐욕', tier: 6, dualKey: null,
    description: '탐욕의 신 6단계 — 골드 획득량 +40% + 보유 골드 100당 공격력 +1',
    apply: (p) => {
      p._greed6Active = true;   // C타입 동적
      return statBoostAdd(p, 'goldGainMul', 0.40);
    },
    revert: (p, payload) => {
      p._greed6Active = false;
      revertPayload(p, payload);
    },
  },
  {
    id: 'greed_9', type: 'single', sin: '탐욕', tier: 9, dualKey: null,
    description: '탐욕의 신 9단계 — 골드 획득량 +60%, 보유 골드 50당 공격력 +1, 200당 % stat +5%',
    apply: (p) => {
      p._greed9Active = true;   // C타입 동적 (공격력 + % stat 둘 다)
      return statBoostAdd(p, 'goldGainMul', 0.60);
    },
    revert: (p, payload) => {
      p._greed9Active = false;
      revertPayload(p, payload);
    },
  },

  // ============ 나태 (SLOTH) — 메인 maxHp ============
  {
    id: 'sloth_3', type: 'single', sin: '나태', tier: 3, dualKey: null,
    description: '나태의 신 3단계 — 최대 HP +15%',
    apply: (p) => statBoostMul(p, 'maxHp', 0.15),
    revert: revertPayload,
  },
  {
    id: 'sloth_6', type: 'single', sin: '나태', tier: 6, dualKey: null,
    description: '나태의 신 6단계 — 최대 HP +30% + 피해 감소 +5%',
    apply: (p) => {
      const hpDelta = p.getStat('maxHp') * 0.30;
      p.modStat('maxHp', 'synergy', hpDelta);
      p.modStat('damageReduction', 'synergy', 0.05);
      return { maxHp: hpDelta, damageReduction: 0.05 };
    },
    revert: revertPayload,
  },
  {
    id: 'sloth_9', type: 'single', sin: '나태', tier: 9, dualKey: null,
    description: '나태의 신 9단계 — 최대 HP +50% + 피해 감소 +15% + 흡혈 +5%',
    apply: (p) => {
      const hpDelta = p.getStat('maxHp') * 0.50;
      p.modStat('maxHp', 'synergy', hpDelta);
      p.modStat('damageReduction', 'synergy', 0.15);
      p.modStat('lifesteal', 'synergy', 0.05);
      return { maxHp: hpDelta, damageReduction: 0.15, lifesteal: 0.05 };
    },
    revert: revertPayload,
  },

  // ============ 오만 (PRIDE) — 메인 critChance ============
  {
    id: 'pride_3', type: 'single', sin: '오만', tier: 3, dualKey: null,
    description: '오만의 신 3단계 — HP 100% + 5초 무피격 시 공격력 +15%',
    apply:  (p) => { p._pride3Active = true; return {}; },   // B타입 (조건부 동적)
    revert: (p) => { p._pride3Active = false; },
  },
  {
    id: 'pride_6', type: 'single', sin: '오만', tier: 6, dualKey: null,
    description: '오만의 신 6단계 — HP 100% + 5초 무피격 시 공격력 +30% + 치명타 확률 +10%',
    apply:  (p) => { p._pride6Active = true; return {}; },
    revert: (p) => { p._pride6Active = false; },
  },
  {
    id: 'pride_9', type: 'single', sin: '오만', tier: 9, dualKey: null,
    description: '오만의 신 9단계 — HP 100% + 5초 무피격 시 공격력 +50% + 치명타 확률 +20% + 치명타 피해 +50%',
    apply:  (p) => { p._pride9Active = true; return {}; },
    revert: (p) => { p._pride9Active = false; },
  },

  // ============ 색욕 (LUST) — 메인 dodge ============
  {
    id: 'lust_3', type: 'single', sin: '색욕', tier: 3, dualKey: null,
    description: '색욕의 신 3단계 — 회피 +5%',
    apply: (p) => statBoostAdd(p, 'dodge', 0.05),
    revert: revertPayload,
  },
  {
    id: 'lust_6', type: 'single', sin: '색욕', tier: 6, dualKey: null,
    description: '색욕의 신 6단계 — 회피 +10% + 흡혈 +5%',
    apply: (p) => {
      p.modStat('dodge', 'synergy', 0.10);
      p.modStat('lifesteal', 'synergy', 0.05);
      return { dodge: 0.10, lifesteal: 0.05 };
    },
    revert: revertPayload,
  },
  {
    id: 'lust_9', type: 'single', sin: '색욕', tier: 9, dualKey: null,
    description: '색욕의 신 9단계 — 회피 +15% + 흡혈 +10% + 피해 감소 +10%',
    apply: (p) => {
      p.modStat('dodge', 'synergy', 0.15);
      p.modStat('lifesteal', 'synergy', 0.10);
      p.modStat('damageReduction', 'synergy', 0.10);
      return { dodge: 0.15, lifesteal: 0.10, damageReduction: 0.10 };
    },
    revert: revertPayload,
  },

  // ============ 질투 (ENVY) — 메인 accuracy ============
  {
    id: 'envy_3', type: 'single', sin: '질투', tier: 3, dualKey: null,
    description: '질투의 신 3단계 — 적 HP > 내 HP 시 공격력 +15%',
    apply:  (p) => { p._envy3Active = true; return {}; },   // D타입 (적 HP 비교 동적)
    revert: (p) => { p._envy3Active = false; },
  },
  {
    id: 'envy_6', type: 'single', sin: '질투', tier: 6, dualKey: null,
    description: '질투의 신 6단계 — 적 HP > 내 HP 시 공격력 +25% + 강자 처치 흡혈 +5%',
    apply:  (p) => { p._envy6Active = true; return {}; },
    revert: (p) => { p._envy6Active = false; },
  },
  {
    id: 'envy_9', type: 'single', sin: '질투', tier: 9, dualKey: null,
    description: '질투의 신 9단계 — 적 HP > 내 HP 시 공격력 +40% + 강자 흡혈 +10% + 강자 처치 시 공격력 영구 +1',
    apply:  (p) => { p._envy9Active = true; return {}; },   // D + F타입
    revert: (p) => { p._envy9Active = false; },
  },

  // ============ 폭식 (GLUTTONY) — 메인 lifesteal ============
  {
    id: 'gluttony_3', type: 'single', sin: '폭식', tier: 3, dualKey: null,
    description: '폭식의 신 3단계 — 처치 10마리당 공격력 영구 +1',
    apply:  (p) => { p._gluttony3Active = true; return {}; },   // E타입 (처치 카운터)
    revert: (p) => { p._gluttony3Active = false; },
  },
  {
    id: 'gluttony_6', type: 'single', sin: '폭식', tier: 6, dualKey: null,
    description: '폭식의 신 6단계 — 처치 5마리당 공격력 영구 +1 + 처치 시 흡혈 +1% (max +20%)',
    apply:  (p) => { p._gluttony6Active = true; return {}; },
    revert: (p) => { p._gluttony6Active = false; },
  },
  {
    id: 'gluttony_9', type: 'single', sin: '폭식', tier: 9, dualKey: null,
    description: '폭식의 신 9단계 — 처치 5마리당 공격력 영구 +1 + 처치 시 흡혈 +1% (max +30%) + 처치 50 도달 시 공격 속도 +11%',
    apply:  (p) => { p._gluttony9Active = true; return {}; },
    revert: (p) => { p._gluttony9Active = false; p._gluttony9Speed50Used = false; },
  },

  // ============================================================
  // 듀얼 21 (C(7,2)) — Phase N2 신규 작성. 페널티 X, 트리거 위주.
  // ============================================================

  // 분노 × N (6쌍)
  dualEffect('분노_탐욕',  ['분노','탐욕'],
    '처치 시 +3G + 5초간 공격력 +10%',
    '_wrathGreedActive'),
  dualEffect('분노_나태',  ['분노','나태'],
    'HP 50%↓ 시 공격력 +20% + 피해 감소 +10%',
    '_wrathSlothActive'),
  dualEffect('분노_오만',  ['분노','오만'],
    'HP 100% 또는 HP 50%↓ 시 공격력 +30% (양극단 폭주)',
    '_wrathPrideActive'),
  dualEffect('분노_색욕',  ['분노','색욕'],
    '피격 시 5초간 흡혈 누적 +1% (max +10%) + 회피 시 5초간 공격력 +10%',
    '_wrathLustActive',
    (p) => {
      // 피격 누적 흡혈 회수 (트래커 동적, 만료시각 0)
      if (p._synergyDamageReceivedLifesteal > 0) {
        p.modStat('lifesteal', 'synergy', -p._synergyDamageReceivedLifesteal);
        p._synergyDamageReceivedLifesteal = 0;
      }
      p._synergyDamageReceivedExpireAt = 0;
    }),
  dualEffect('분노_질투',  ['분노','질투'],
    '적 HP > 내 HP 시 공격력 +30% + 처치 시 1초간 공격력 +50%',
    '_wrathEnvyActive'),
  dualEffect('분노_폭식',  ['분노','폭식'],
    '처치 시 공격력 영구 +0.2 (cap 없음, 누적)',
    '_wrathGluttonyActive',
    (p) => {
      if (p._wrathGluttony_atkAdded > 0) {
        p.modStat('attackPower', 'synergy', -p._wrathGluttony_atkAdded);
        p._wrathGluttony_atkAdded = 0;
      }
    }),

  // 탐욕 × N (5쌍)
  dualEffect('탐욕_나태',  ['탐욕','나태'],
    '보유 골드 100당 maxHp +5 (동적)',
    '_greedSlothActive'),
  dualEffect('탐욕_오만',  ['탐욕','오만'],
    'HP 100% 시 골드 획득량 +50% + 보유 골드 200당 치명타 피해 +20% (HP 무관)',
    '_greedPrideActive'),
  dualEffect('탐욕_색욕',  ['탐욕','색욕'],
    '골드 획득 시 회피 +0.1% 영구 (max +20%)',
    '_greedLustActive',
    (p) => {
      if (p._tamSe_dodgeAdded > 0) {
        p.modStat('dodge', 'synergy', -p._tamSe_dodgeAdded);
        p._tamSe_dodgeAdded = 0;
      }
    }),
  dualEffect('탐욕_질투',  ['탐욕','질투'],
    '처치 시 적 보유 골드 50% 추가 획득 + 강자 처치 시 +10G',
    '_greedEnvyActive'),
  dualEffect('탐욕_폭식',  ['탐욕','폭식'],
    '처치 시 +5G + 처치 누적당 골드 획득량 +0.5% (max +30%)',
    '_greedGluttonyActive',
    (p) => {
      if (p._tamPok_goldGainMulAdded > 0) {
        p.modStat('goldGainMul', 'synergy', -p._tamPok_goldGainMulAdded);
        p._tamPok_goldGainMulAdded = 0;
      }
    }),

  // 나태 × N (4쌍)
  dualEffect('나태_오만',  ['나태','오만'],
    'HP 100% 유지 시 매초 피해 감소 +1% (max +10%) + HP 100% 시 추가 피해 감소 +20%',
    '_slothPrideActive',
    (p) => {
      if (p._synergyOmanGuardCount > 0) {
        p.modStat('damageReduction', 'synergy', -(p._synergyOmanGuardCount * 0.01));
        p._synergyOmanGuardCount = 0;
      }
      p._synergyOmanLastTickTime = 0;
    }),
  dualEffect('나태_색욕',  ['나태','색욕'],
    '회피 시 흡혈 +0.5% 영구 (max +10%) + 회피 +10%',
    '_slothLustActive',
    (p) => {
      if (p._naSe_lifestealAdded > 0) {
        p.modStat('lifesteal', 'synergy', -p._naSe_lifestealAdded);
        p._naSe_lifestealAdded = 0;
      }
    }),
  dualEffect('나태_질투',  ['나태','질투'],
    '적 HP > 내 HP 시 피해 감소 +15% (가장 가까운 적 추정)',
    '_slothEnvyActive'),
  // 나태_폭식 — apply 시 흡혈 +5% (단발) + 처치 시 maxHp 누적 (revert 시 둘 다 회수)
  {
    id: '나태_폭식', type: 'dual', sin: null, tier: null, dualKey: '나태_폭식',
    sins: ['나태','폭식'],
    description: '흡혈 +5% + 처치 시 maxHp 영구 +1 (max +50)',
    apply: (p) => {
      p._slothGluttonyActive = true;
      p.modStat('lifesteal', 'synergy', 0.05);
      return { lifesteal: 0.05 };
    },
    revert: (p, payload) => {
      p._slothGluttonyActive = false;
      if (payload?.lifesteal) p.modStat('lifesteal', 'synergy', -payload.lifesteal);
      if (p._naPok_maxHpAdded > 0) {
        p.modStat('maxHp', 'synergy', -p._naPok_maxHpAdded);
        p._naPok_maxHpAdded = 0;
        if (p.stats.hp > p.getStat('maxHp')) p.stats.hp = p.getStat('maxHp');
      }
    },
  },

  // 오만 × N (3쌍)
  dualEffect('오만_색욕',  ['오만','색욕'],
    'HP 100% 시 회피 +30% + 회피 시 1초 무적 (5초 쿨)',
    '_prideLustActive',
    (p) => {
      // 진행 중인 무적 / 쿨 리셋 (안전)
      p._synergyDodgeInvulnUntil = 0;
      p._synergyDodgeInvulnCooldown = 0;
    }),
  dualEffect('오만_질투',  ['오만','질투'],
    'HP 100% + 5초 무피격 + 적 HP > 내 HP 시 공격력 ×1.50',
    '_prideEnvyActive'),
  dualEffect('오만_폭식',  ['오만','폭식'],
    'HP 100% 유지 시 처치당 공격력 +0.5 (피격 시 누적 0 리셋)',
    '_prideGluttonyActive',
    (p) => {
      if (p._omanPok_atkAdded > 0) {
        p.modStat('attackPower', 'synergy', -p._omanPok_atkAdded);
        p._omanPok_atkAdded = 0;
      }
    }),

  // 색욕 × N (2쌍)
  dualEffect('색욕_질투',  ['색욕','질투'],
    '적 HP > 내 HP 시 회피 +20% + 강자 처치 흡혈 +10%',
    '_lustEnvyActive'),
  // 색욕_폭식 — apply 시 흡혈 +10% (단발) + 처치 시 dodge 누적
  {
    id: '색욕_폭식', type: 'dual', sin: null, tier: null, dualKey: '색욕_폭식',
    sins: ['색욕','폭식'],
    description: '흡혈 +10% + 처치 시 회피 +0.5% 영구 (max +25%)',
    apply: (p) => {
      p._lustGluttonyActive = true;
      p.modStat('lifesteal', 'synergy', 0.10);
      return { lifesteal: 0.10 };
    },
    revert: (p, payload) => {
      p._lustGluttonyActive = false;
      if (payload?.lifesteal) p.modStat('lifesteal', 'synergy', -payload.lifesteal);
      if (p._sePok_dodgeAdded > 0) {
        p.modStat('dodge', 'synergy', -p._sePok_dodgeAdded);
        p._sePok_dodgeAdded = 0;
      }
    },
  },

  // 질투 × N (1쌍)
  dualEffect('질투_폭식',  ['질투','폭식'],
    '강자 처치 (hpBeforeKill > 내 HP) 시 공격력 영구 +1 (cap 없음)',
    '_envyGluttonyActive',
    (p) => {
      if (p._envyGluttony_atkAdded > 0) {
        p.modStat('attackPower', 'synergy', -p._envyGluttony_atkAdded);
        p._envyGluttony_atkAdded = 0;
      }
    }),
];

// id 로 효과 조회
export function getSynergyEffect(id) {
  return synergyEffects.find(e => e.id === id) || null;
}
