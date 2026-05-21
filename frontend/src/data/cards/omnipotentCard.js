// 만능 카드 (Omnipotent) — 1장 [Phase M-B9]
// 이름: 일곱 가면. 컨셉: 7죄 초월 — "모든 죄와 동시 계약, 가짜 영웅의 모든 가면".
// 등장 조건: player._shouldShowOmnipotent() — _hasAllSinCards() + 5% 확률 + 미보유.
// 카드픽 슬롯 1개 강제 차지 (한 게임당 1회만 등장).
//
// 효과: 모든 stat 중간 강도 보너스 + 7죄 sinCounts +1 (시너지 단계 즉시 갱신).
// sin = null (7죄 어디에도 속하지 않음). isOmnipotent: true 플래그로 UI 차별화.

import { SINS } from '../sins.js';

const OMNI_EFFECT = {
  attackPower: 3,
  attackSpeed: -30,
  maxHp: 30,
  critChance: 0.05,
  critDamage: 0.20,
  dodge: 0.05,
  accuracy: 0.10,
  lifesteal: 0.05,
  damageReduction: 0.05,
  goldGainMul: 0.10,
};

export const omnipotentCard = {
  id: 'omnipotent_1',
  name: '일곱 가면',
  icon: '🃏',
  sin: null,
  rarity: 'legend',
  desc: '모든 능력치 보너스 + 7대죄 모든 시너지 +1',
  isOmnipotent: true,
  effect: OMNI_EFFECT,
  apply: (player) => {
    for (const [stat, val] of Object.entries(OMNI_EFFECT)) {
      player.modStat(stat, 'cards', val);
    }
    for (const sin of Object.values(SINS)) {
      player.sinCounts[sin] = (player.sinCounts[sin] || 0) + 1;
    }
    if (typeof player._updateActiveSin === 'function') {
      player._updateActiveSin();
    }
  },
  revert: (player) => {
    for (const [stat, val] of Object.entries(OMNI_EFFECT)) {
      player.modStat(stat, 'cards', -val);
    }
    for (const sin of Object.values(SINS)) {
      player.sinCounts[sin] = Math.max(0, (player.sinCounts[sin] || 0) - 1);
    }
    if (typeof player._updateActiveSin === 'function') {
      player._updateActiveSin();
    }
  },
};
