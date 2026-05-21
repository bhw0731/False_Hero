// 질투 (ENVY) 카드 풀 — 38장 [Phase P-54]
// 분배: 노말 12 / 레어 14 / 레전드 8. epic 등급 제거.
// 메인 stat: accuracy. 보조: 공격력 / 공속 / 최대 HP / 치명타 / 치피 / 회피 / 흡혈 / 피해 감소 / 골드.

import { SINS } from '../sins.js';
import { makeCard } from './_cardHelper.js';

const ICON = '💢';
const SIN  = SINS.ENVY;
const _card = (id, name, rarity, desc, effect) => makeCard(id, name, ICON, SIN, rarity, desc, effect);

export const envyCards = [
  // ==================== 노말 12장 (stat 9 + 트리거 3) ====================
  _card('envy_normal_1',  '정조준',         'normal', '명중 +5%',                                { accuracy: 0.05 }),
  _card('envy_normal_2',  '정확한 빠름',    'normal', '명중 +2%, 공격 속도 +2%',                 { accuracy: 0.02, attackSpeed: -20 }),
  _card('envy_normal_3',  '정확한 일격',    'normal', '명중 +3%, 공격력 +2',                     { accuracy: 0.03, attackPower: 2 }),
  _card('envy_normal_4',  '정확한 치명',    'normal', '명중 +3%, 치명타 확률 +3%',               { accuracy: 0.03, critChance: 0.03 }),
  _card('envy_normal_5',  '정밀 강타',      'normal', '명중 +2%, 치명타 피해 +10%',              { accuracy: 0.02, critDamage: 0.10 }),
  _card('envy_normal_6',  '정확한 흡혈',    'normal', '명중 +2%, 흡혈 +2%',                       { accuracy: 0.02, lifesteal: 0.02 }),
  _card('envy_normal_7',  '정확한 회피',    'normal', '명중 +3%, 회피 +3%',                       { accuracy: 0.03, dodge: 0.03 }),
  _card('envy_normal_8',  '정확한 방어',    'normal', '명중 +3%, 피해 감소 +2%',                  { accuracy: 0.03, damageReduction: 0.02 }),
  _card('envy_normal_9',  '정확한 자산',    'normal', '명중 +3%, 골드 획득량 +3%',                { accuracy: 0.03, goldGainMul: 0.03 }),
  // 트리거 3장
  {
    id: 'envy_normal_10', name: '강자 처치', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '강자 처치 시 공격력 +0.2 영구 (max +5)',
    apply:  (p) => { p._envyNormalStrongerKillStackActive = true; },
    revert: (p) => {
      p._envyNormalStrongerKillStackActive = false;
      if (p._envyNormalStrongerKillStackAdded > 0) {
        p.modStat('attackPower', 'cards', -p._envyNormalStrongerKillStackAdded);
        p._envyNormalStrongerKillStackAdded = 0;
      }
    },
  },
  {
    id: 'envy_normal_11', name: '약자의 시샘', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '적 HP > 내 HP 시 공격력 +5%',
    apply:  (p) => { p._envyNormalStrongerActive = true; },
    revert: (p) => { p._envyNormalStrongerActive = false; },
  },
  {
    id: 'envy_normal_12', name: '처치 정밀', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '처치 시 명중 +0.2% 영구 (max +5%)',
    apply:  (p) => { p._envyNormalKillAccStackActive = true; },
    revert: (p) => {
      p._envyNormalKillAccStackActive = false;
      if (p._envyNormalKillAccStackAdded > 0) {
        p.modStat('accuracy', 'cards', -p._envyNormalKillAccStackAdded);
        p._envyNormalKillAccStackAdded = 0;
      }
    },
  },

  // ==================== 레어 14장 (stat 8 + 트리거 6) ====================
  _card('envy_rare_1',  '매의 눈',       'rare', '명중 +6%, 공격력 +3',                                  { accuracy: 0.06, attackPower: 3 }),
  _card('envy_rare_2',  '정확한 폭주',   'rare', '명중 +7%, 공격 속도 +5%, 치명타 확률 +3%',             { accuracy: 0.07, attackSpeed: -50, critChance: 0.03 }),
  _card('envy_rare_3',  '정확한 치명',   'rare', '명중 +8%, 치명타 피해 +20%',                           { accuracy: 0.08, critDamage: 0.20 }),
  _card('envy_rare_4',  '정확한 갑옷',   'rare', '명중 +7%, 최대 HP +20, 흡혈 +3%',                       { accuracy: 0.07, maxHp: 20, lifesteal: 0.03 }),
  _card('envy_rare_5',  '강자 사냥꾼',   'rare', '명중 +6%, 회피 +4%, 피해 감소 +3%',                    { accuracy: 0.06, dodge: 0.04, damageReduction: 0.03 }),
  _card('envy_rare_6',  '정확한 자산',   'rare', '명중 +8%, 공격력 +4, 골드 획득량 +8%',                  { accuracy: 0.08, attackPower: 4, goldGainMul: 0.08 }),
  _card('envy_rare_7',  '정확한 일격',   'rare', '명중 +9%, 치명타 확률 +5%, 치명타 피해 +12%',           { accuracy: 0.09, critChance: 0.05, critDamage: 0.12 }),
  _card('envy_rare_8',  '정밀 화살',     'rare', '명중 +6%, 치명타 피해 +15%, 공격력 +2',                 { accuracy: 0.06, critDamage: 0.15, attackPower: 2 }),
  // 트리거 6장
  {
    id: 'envy_rare_9', name: '강자 처치 (레어)', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '강자 처치 시 공격력 +0.5 영구 (max +10)',
    apply:  (p) => { p._envyRareStrongerKillStackActive = true; },
    revert: (p) => {
      p._envyRareStrongerKillStackActive = false;
      if (p._envyRareStrongerKillStackAdded > 0) {
        p.modStat('attackPower', 'cards', -p._envyRareStrongerKillStackAdded);
        p._envyRareStrongerKillStackAdded = 0;
      }
    },
  },
  {
    id: 'envy_rare_10', name: '적 HP 비례 (레어)', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '적 HP > 내 HP 시 공격력 +10%',
    apply:  (p) => { p._envyRareStrongerActive = true; },
    revert: (p) => { p._envyRareStrongerActive = false; },
  },
  {
    id: 'envy_rare_11', name: '처치 정밀 (레어)', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '처치 시 명중 +0.5% 영구 (max +15%)',
    apply:  (p) => { p._envyRareKillAccStackActive = true; },
    revert: (p) => {
      p._envyRareKillAccStackActive = false;
      if (p._envyRareKillAccStackAdded > 0) {
        p.modStat('accuracy', 'cards', -p._envyRareKillAccStackAdded);
        p._envyRareKillAccStackAdded = 0;
      }
    },
  },
  {
    id: 'envy_rare_12', name: '보스 사냥', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '적 HP 100% 시 공격력 +20%',
    apply:  (p) => { p._envyRareEnemyFullHpActive = true; },
    revert: (p) => { p._envyRareEnemyFullHpActive = false; },
  },
  {
    id: 'envy_rare_13', name: '강자 회복', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '강자 처치 시 즉시 흡혈 추가 발동 (최대 HP × 10% 회복)',
    apply:  (p) => { p._envyRareStrongerLifestealActive = true; },
    revert: (p) => { p._envyRareStrongerLifestealActive = false; },
  },
  {
    id: 'envy_rare_14', name: '강자 추적', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '적 HP > 내 HP 시 명중 +20%',
    apply:  (p) => { p._envyRareStrongerAccBuffActive = true; },
    revert: (p) => { p._envyRareStrongerAccBuffActive = false; },
  },

  // ==================== 레전드 8장 (stat 4 + 트리거/게임체인저 4) ====================
  _card('envy_legend_1', '신의 정조준',   'legend', '명중 +25%, 공격력 +10',                                       { accuracy: 0.25, attackPower: 10 }),
  _card('envy_legend_2', '만능 정밀',     'legend', '명중 +18%, 치명타 확률 +8%, 치명타 피해 +30%, 공격력 +8',     { accuracy: 0.18, critChance: 0.08, critDamage: 0.30, attackPower: 8 }),
  _card('envy_legend_3', '영원한 정밀',   'legend', '명중 +30%, 공격력 +12, 흡혈 +5%',                              { accuracy: 0.30, attackPower: 12, lifesteal: 0.05 }),
  _card('envy_legend_4', '빠른 정밀',     'legend', '명중 +20%, 공격 속도 +9%, 치명타 확률 +6%',                    { accuracy: 0.20, attackSpeed: -90, critChance: 0.06 }),
  // 게임체인저 4장
  {
    id: 'envy_legend_5', name: '강자 처치 (레전드)', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '강자 처치 시 공격력 +1 영구',
    apply:  (p) => { p._envyL3Active = true; },
    revert: (p) => {
      p._envyL3Active = false;
      if (p._envyL3AtkAdded > 0) {
        p.modStat('attackPower', 'cards', -p._envyL3AtkAdded);
        p._envyL3AtkAdded = 0;
      }
    },
  },
  {
    id: 'envy_legend_6', name: '적 HP 비례 (레전드)', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '적 HP > 내 HP 시 공격력 ×1.30',
    apply:  (p) => { p._envyL1Active = true; },
    revert: (p) => { p._envyL1Active = false; },
  },
  {
    id: 'envy_legend_7', name: '강자 처단', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '적 HP > 내 HP 시 모든 공격 강제 치명타',
    apply:  (p) => { p._envyEpicStrongerCritActive = true; },
    revert: (p) => { p._envyEpicStrongerCritActive = false; },
  },
  {
    id: 'envy_legend_8', name: '강자 사냥', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '적 HP 비율 비례 공격력 (적 100% 시 +50%)',
    apply:  (p) => { p._envyL4Active = true; },
    revert: (p) => { p._envyL4Active = false; },
  },
];
