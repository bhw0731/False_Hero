// 색욕 (LUST) 카드 풀 — 38장 [Phase P-54]
// 분배: 노말 12 / 레어 14 / 레전드 8. epic 등급 제거.
// 메인 stat: dodge. 보조: 공격력 / 공속 / 최대 HP / 치명타 / 치피 / 명중 / 흡혈 / 피해 감소 / 골드.

import { SINS } from '../sins.js';
import { makeCard } from './_cardHelper.js';

const ICON = '💜';
const SIN  = SINS.LUST;
const _card = (id, name, rarity, desc, effect) => makeCard(id, name, ICON, SIN, rarity, desc, effect);

export const lustCards = [
  // ==================== 노말 12장 (stat 9 + 트리거 3) ====================
  _card('lust_normal_1',  '유연',           'normal', '회피 +5%',                                { dodge: 0.05 }),
  _card('lust_normal_2',  '빠른 발',        'normal', '회피 +2%, 공격 속도 +3%',                 { dodge: 0.02, attackSpeed: -30 }),
  _card('lust_normal_3',  '유려한 검',      'normal', '회피 +2%, 공격력 +2',                     { dodge: 0.02, attackPower: 2 }),
  _card('lust_normal_4',  '정확한 회피',    'normal', '회피 +3%, 명중 +4%',                      { dodge: 0.03, accuracy: 0.04 }),
  _card('lust_normal_5',  '회피의 일격',    'normal', '회피 +3%, 치명타 확률 +3%',               { dodge: 0.03, critChance: 0.03 }),
  _card('lust_normal_6',  '회피 강타',      'normal', '회피 +2%, 치명타 피해 +10%',              { dodge: 0.02, critDamage: 0.10 }),
  _card('lust_normal_7',  '회피의 흡혈',    'normal', '회피 +2%, 흡혈 +2%',                       { dodge: 0.02, lifesteal: 0.02 }),
  _card('lust_normal_8',  '가벼운 갑옷',    'normal', '회피 +3%, 최대 HP +10',                    { dodge: 0.03, maxHp: 10 }),
  _card('lust_normal_9',  '회피의 자산',    'normal', '회피 +2%, 골드 획득량 +3%',                { dodge: 0.02, goldGainMul: 0.03 }),
  // 트리거 3장
  {
    id: 'lust_normal_10', name: '매혹의 발걸음', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '회피 시 3초간 공격력 +5%',
    apply:  (p) => { p._lustNormalAtkBuffActive = true; },
    revert: (p) => { p._lustNormalAtkBuffActive = false; },
  },
  {
    id: 'lust_normal_11', name: '흡혈 회피', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '회피 시 흡혈 +0.5% 영구 (max +5%)',
    apply:  (p) => { p._lustNormalLifestealStackActive = true; },
    revert: (p) => {
      p._lustNormalLifestealStackActive = false;
      if (p._lustNormalLifestealStackAdded > 0) {
        p.modStat('lifesteal', 'cards', -p._lustNormalLifestealStackAdded);
        p._lustNormalLifestealStackAdded = 0;
      }
    },
  },
  {
    id: 'lust_normal_12', name: '회피 반격', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '회피 시 다음 공격 공격력 +20%',
    apply:  (p) => { p._lustNormalNextAtkBuffActive = true; },
    revert: (p) => { p._lustNormalNextAtkBuffActive = false; p._lustNormalNextAtkPending = false; },
  },

  // ==================== 레어 14장 (stat 8 + 트리거 6) ====================
  _card('lust_rare_1',  '빠른 검술',     'rare', '회피 +6%, 공격력 +3',                                  { dodge: 0.06, attackPower: 3 }),
  _card('lust_rare_2',  '정확한 매혹',   'rare', '회피 +7%, 명중 +6%, 치명타 확률 +3%',                  { dodge: 0.07, accuracy: 0.06, critChance: 0.03 }),
  _card('lust_rare_3',  '매혹의 일격',   'rare', '회피 +7%, 치명타 피해 +20%',                           { dodge: 0.07, critDamage: 0.20 }),
  _card('lust_rare_4',  '매혹의 갑옷',   'rare', '회피 +8%, 최대 HP +20, 피해 감소 +3%',                 { dodge: 0.08, maxHp: 20, damageReduction: 0.03 }),
  _card('lust_rare_5',  '흡혈 회피',     'rare', '회피 +8%, 흡혈 +5%, 명중 +4%',                          { dodge: 0.08, lifesteal: 0.05, accuracy: 0.04 }),
  _card('lust_rare_6',  '빠른 폭주',     'rare', '회피 +9%, 공격 속도 +5%, 공격력 +2',                   { dodge: 0.09, attackSpeed: -50, attackPower: 2 }),
  _card('lust_rare_7',  '매혹의 자산',   'rare', '회피 +9%, 골드 획득량 +8%',                            { dodge: 0.09, goldGainMul: 0.08 }),
  _card('lust_rare_8',  '회피 폭주',     'rare', '회피 +7%, 치명타 확률 +5%, 치명타 피해 +15%',           { dodge: 0.07, critChance: 0.05, critDamage: 0.15 }),
  // 트리거 6장
  {
    id: 'lust_rare_9', name: '매혹 (레어)', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '회피 시 4초간 공격력 +10%',
    apply:  (p) => { p._lustRareAtkBuffActive = true; },
    revert: (p) => { p._lustRareAtkBuffActive = false; },
  },
  {
    id: 'lust_rare_10', name: '흡혈 누적', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '회피 시 흡혈 +1% 영구 (max +10%)',
    apply:  (p) => { p._lustRareLifestealStackActive = true; },
    revert: (p) => {
      p._lustRareLifestealStackActive = false;
      if (p._lustRareLifestealStackAdded > 0) {
        p.modStat('lifesteal', 'cards', -p._lustRareLifestealStackAdded);
        p._lustRareLifestealStackAdded = 0;
      }
    },
  },
  {
    id: 'lust_rare_11', name: '강제 치명', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '회피 시 다음 공격 강제 치명타',
    apply:  (p) => { p._lustRareForcedCritActive = true; },
    revert: (p) => { p._lustRareForcedCritActive = false; p._lustRareForcedCritPending = false; },
  },
  {
    id: 'lust_rare_12', name: '매혹의 시선', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '회피 시 가까운 적 0.7초 정지',
    apply:  (p) => { p._lustRareLongStunActive = true; },
    revert: (p) => { p._lustRareLongStunActive = false; },
  },
  {
    id: 'lust_rare_13', name: '누적 회피', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '회피 시 5초간 회피 +5%',
    apply:  (p) => { p._lustRareDodgeBuffActive = true; },
    revert: (p) => {
      p._lustRareDodgeBuffActive = false;
      if (p._lustRareDodgeBuffApplied) {
        p.modStat('dodge', 'cards', -0.05);
        p._lustRareDodgeBuffApplied = false;
      }
      p._lustRareDodgeBuffUntil = 0;
    },
  },
  {
    id: 'lust_rare_14', name: '회피 누적', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '회피 누적 5회 도달 시 즉시 흡혈 +10% 영구 (1회성)',
    apply:  (p) => { p._lustRareDodgeMilestoneActive = true; },
    revert: (p) => {
      p._lustRareDodgeMilestoneActive = false;
      if (p._lustRareDodgeMilestoneUsed) {
        p.modStat('lifesteal', 'cards', -0.10);
        p._lustRareDodgeMilestoneUsed = false;
      }
      p._lustRareDodgeMilestoneCount = 0;
    },
  },

  // ==================== 레전드 8장 (stat 4 + 트리거/게임체인저 4) ====================
  _card('lust_legend_1', '매혹의 신',     'legend', '회피 +18%, 공격력 +10, 흡혈 +8%',                          { dodge: 0.18, attackPower: 10, lifesteal: 0.08 }),
  _card('lust_legend_2', '만능 매혹',     'legend', '회피 +13%, 명중 +15%, 공격력 +8',                          { dodge: 0.13, accuracy: 0.15, attackPower: 8 }),
  _card('lust_legend_3', '영원한 매혹',   'legend', '회피 +20%, 치명타 피해 +50%, 공격력 +5',                  { dodge: 0.20, critDamage: 0.50, attackPower: 5 }),
  _card('lust_legend_4', '빠른 매혹',     'legend', '회피 +15%, 공격 속도 +12%, 명중 +10%',                    { dodge: 0.15, attackSpeed: -110, accuracy: 0.10 }),
  // 게임체인저 4장
  {
    id: 'lust_legend_5', name: '매혹의 결박', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '회피 시 가까운 적 1초 정지 (매혹)',
    apply:  (p) => { p._lustL1Active = true; },
    revert: (p) => { p._lustL1Active = false; },
  },
  {
    id: 'lust_legend_6', name: '흡혈 종합', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '회피 시 흡혈 +1% 영구 (max +20%)',
    apply:  (p) => { p._lustL4Active = true; },
    revert: (p) => {
      p._lustL4Active = false;
      if (p._lustL4LifestealAdded > 0) {
        p.modStat('lifesteal', 'cards', -p._lustL4LifestealAdded);
        p._lustL4LifestealAdded = 0;
      }
    },
  },
  {
    id: 'lust_legend_7', name: '강제 매혹', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '회피 후 다음 공격 강제 치명타',
    apply:  (p) => { p._lustL5Active = true; },
    revert: (p) => { p._lustL5Active = false; p._lustL5NextCrit = false; },
  },
  {
    id: 'lust_legend_8', name: '매혹 폭주', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '회피 시 5초간 공격력 ×1.20',
    apply:  (p) => { p._lustL3Active = true; },
    revert: (p) => { p._lustL3Active = false; },
  },
];
