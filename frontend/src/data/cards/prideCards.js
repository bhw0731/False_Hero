// 오만 (PRIDE) 카드 풀 — 38장 [Phase P-54]
// 분배: 노말 12 / 레어 14 / 레전드 8. epic 등급 제거.
// 메인 stat: critChance. 보조: 공격력 / 공속 / 최대 HP / 치피 / 회피 / 명중 / 흡혈 / 피해 감소 / 골드.

import { SINS } from '../sins.js';
import { makeCard } from './_cardHelper.js';

const ICON = '✨';
const SIN  = SINS.PRIDE;
const _card = (id, name, rarity, desc, effect) => makeCard(id, name, ICON, SIN, rarity, desc, effect);

export const prideCards = [
  // ==================== 노말 12장 (stat 9 + 트리거 3) ====================
  _card('pride_normal_1',  '자만',         'normal', '치명타 확률 +5%',                          { critChance: 0.05 }),
  _card('pride_normal_2',  '빠른 칼끝',    'normal', '치명타 확률 +2%, 공격 속도 +2%',           { critChance: 0.02, attackSpeed: -20 }),
  _card('pride_normal_3',  '거만한 검',    'normal', '치명타 확률 +3%, 공격력 +2',               { critChance: 0.03, attackPower: 2 }),
  _card('pride_normal_4',  '정밀',         'normal', '치명타 확률 +3%, 명중 +5%',                { critChance: 0.03, accuracy: 0.05 }),
  _card('pride_normal_5',  '화려한 일격',  'normal', '치명타 확률 +2%, 치명타 피해 +10%',         { critChance: 0.02, critDamage: 0.10 }),
  _card('pride_normal_6',  '거만한 흡혈',  'normal', '치명타 확률 +2%, 흡혈 +2%',                 { critChance: 0.02, lifesteal: 0.02 }),
  _card('pride_normal_7',  '거만한 회피',  'normal', '치명타 확률 +2%, 회피 +3%',                 { critChance: 0.02, dodge: 0.03 }),
  _card('pride_normal_8',  '거만한 방어',  'normal', '치명타 확률 +3%, 피해 감소 +2%',            { critChance: 0.03, damageReduction: 0.02 }),
  _card('pride_normal_9',  '거만한 자산',  'normal', '치명타 확률 +2%, 골드 획득량 +3%',          { critChance: 0.02, goldGainMul: 0.03 }),
  // 트리거 3장
  {
    id: 'pride_normal_10', name: '완전체', icon: ICON, sin: SIN, rarity: 'normal',
    desc: 'HP 100% 시 공격력 +5%',
    apply:  (p) => { p._prideNormalFullHpAtkActive = true; },
    revert: (p) => { p._prideNormalFullHpAtkActive = false; },
  },
  {
    id: 'pride_normal_11', name: '치명 폭주', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '치명타 적중 시 0.3초 무적',
    apply:  (p) => { p._prideNormalCritInvulnActive = true; },
    revert: (p) => { p._prideNormalCritInvulnActive = false; },
  },
  {
    id: 'pride_normal_12', name: '누적 자만', icon: ICON, sin: SIN, rarity: 'normal',
    desc: 'HP 100% 유지 시 매초 공격력 +0.1 (max +5)',
    apply:  (p) => { p._prideNormalFullHpStackActive = true; },
    revert: (p) => {
      p._prideNormalFullHpStackActive = false;
      p._prideNormalFullHpStackAdded = 0;
      p._prideNormalFullHpLastTickTime = 0;
    },
  },

  // ==================== 레어 14장 (stat 8 + 트리거 6) ====================
  _card('pride_rare_1',  '오만의 검',     'rare', '치명타 확률 +6%, 공격력 +3',                                  { critChance: 0.06, attackPower: 3 }),
  _card('pride_rare_2',  '화려한 마법',   'rare', '치명타 확률 +7%, 치명타 피해 +20%',                            { critChance: 0.07, critDamage: 0.20 }),
  _card('pride_rare_3',  '차가운 정밀',   'rare', '치명타 확률 +6%, 명중 +6%',                                   { critChance: 0.06, accuracy: 0.06 }),
  _card('pride_rare_4',  '오만한 갑옷',   'rare', '치명타 확률 +8%, 최대 HP +20, 흡혈 +3%',                       { critChance: 0.08, maxHp: 20, lifesteal: 0.03 }),
  _card('pride_rare_5',  '빠른 정밀',     'rare', '치명타 확률 +6%, 공격 속도 +5%, 회피 +3%',                     { critChance: 0.06, attackSpeed: -50, dodge: 0.03 }),
  _card('pride_rare_6',  '정밀한 황금',   'rare', '치명타 확률 +7%, 골드 획득량 +10%',                            { critChance: 0.07, goldGainMul: 0.10 }),
  _card('pride_rare_7',  '정밀한 방어',   'rare', '치명타 확률 +5%, 피해 감소 +4%, 명중 +4%',                     { critChance: 0.05, damageReduction: 0.04, accuracy: 0.04 }),
  _card('pride_rare_8',  '거만한 폭발',   'rare', '치명타 확률 +5%, 치명타 피해 +15%, 공격력 +2',                  { critChance: 0.05, critDamage: 0.15, attackPower: 2 }),
  // 트리거 6장
  {
    id: 'pride_rare_9', name: '완전체 (레어)', icon: ICON, sin: SIN, rarity: 'rare',
    desc: 'HP 100% 시 공격력 +10%',
    apply:  (p) => { p._prideRareFullHpAtkActive = true; },
    revert: (p) => { p._prideRareFullHpAtkActive = false; },
  },
  {
    id: 'pride_rare_10', name: '무적', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '치명타 적중 시 0.5초 무적',
    apply:  (p) => { p._prideRareCritInvulnActive = true; },
    revert: (p) => { p._prideRareCritInvulnActive = false; },
  },
  {
    id: 'pride_rare_11', name: '영원한 자만', icon: ICON, sin: SIN, rarity: 'rare',
    desc: 'HP 100% 유지 시 매초 공격력 +0.3 (max +15)',
    apply:  (p) => { p._prideRareFullHpStackActive = true; },
    revert: (p) => {
      p._prideRareFullHpStackActive = false;
      p._prideRareFullHpStackAdded = 0;
      p._prideRareFullHpLastTickTime = 0;
    },
  },
  {
    id: 'pride_rare_12', name: '5초의 평화', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '5초 무피격 시 공격력 +15%',
    apply:  (p) => { p._prideRareNoDmgActive = true; },
    revert: (p) => { p._prideRareNoDmgActive = false; },
  },
  {
    id: 'pride_rare_13', name: '폭발의 자만', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '치명타 적중 시 5초간 공격력 +10%',
    apply:  (p) => { p._prideRareCritAtkBuffActive = true; },
    revert: (p) => { p._prideRareCritAtkBuffActive = false; },
  },
  {
    id: 'pride_rare_14', name: '오만한 결계', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '5초 무피격 도달 시 즉시 5초 무적 (스테이지당 1회)',
    apply:  (p) => { p._prideRareInvulnActive = true; },
    revert: (p) => { p._prideRareInvulnActive = false; p._prideRareInvulnUsed = false; },
  },

  // ==================== 레전드 8장 (stat 4 + 트리거/게임체인저 4) ====================
  _card('pride_legend_1', '신의 자만',     'legend', '치명타 확률 +20%, 공격력 +10, 치명타 피해 +30%',                 { critChance: 0.20, attackPower: 10, critDamage: 0.30 }),
  _card('pride_legend_2', '만능 오만',     'legend', '치명타 확률 +12%, 명중 +20%, 회피 +6%, 공격 속도 +6%',           { critChance: 0.12, accuracy: 0.20, dodge: 0.06, attackSpeed: -60 }),
  _card('pride_legend_3', '영원한 정밀',   'legend', '치명타 확률 +25%, 치명타 피해 +50%',                              { critChance: 0.25, critDamage: 0.50 }),
  _card('pride_legend_4', '화려한 신탁',   'legend', '치명타 확률 +18%, 공격력 +15, 흡혈 +5%',                          { critChance: 0.18, attackPower: 15, lifesteal: 0.05 }),
  // 게임체인저 4장
  {
    id: 'pride_legend_5', name: '완전 우월', icon: ICON, sin: SIN, rarity: 'legend',
    desc: 'HP 100% + 5초 무피격 시 공격력 +30%, 치명타 확률 +15%, 치명타 피해 +50%',
    apply:  (p) => { p._prideL1Active = true; },
    revert: (p) => { p._prideL1Active = false; },
  },
  {
    id: 'pride_legend_6', name: '영원한 자만 (레전드)', icon: ICON, sin: SIN, rarity: 'legend',
    desc: 'HP 100% 유지 시 매초 공격력 +0.5 (max +25, 피격 시 리셋)',
    apply:  (p) => { p._prideL4Active = true; },
    revert: (p) => { p._prideL4Active = false; p._prideL4StackAdded = 0; p._prideL4LastTickTime = 0; },
  },
  {
    id: 'pride_legend_7', name: '신의 한 수', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '웨이브 첫 공격 무조건 치명타',
    apply:  (p) => { p._prideL5Active = true; },
    revert: (p) => { p._prideL5Active = false; p._prideL5UsedThisWave = false; },
  },
  {
    id: 'pride_legend_8', name: '치명의 일격', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '치명타 적중 시 다음 공격 강제 치명타 (1회성 체인)',
    apply:  (p) => { p._prideEpicNextCritActive = true; },
    revert: (p) => { p._prideEpicNextCritActive = false; p._prideEpicNextCritPending = false; },
  },
];
