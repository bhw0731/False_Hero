// 폭식 (GLUTTONY) 카드 풀 — 38장 [Phase P-54]
// 분배: 노말 12 / 레어 14 / 레전드 8. epic 등급 제거.
// 메인 stat: lifesteal. 보조: 공격력 / 공속 / 최대 HP / 치명타 / 치피 / 회피 / 명중 / 피해 감소 / 골드.

import { SINS } from '../sins.js';
import { makeCard } from './_cardHelper.js';

const ICON = '🍖';
const SIN  = SINS.GLUTTONY;
const _card = (id, name, rarity, desc, effect) => makeCard(id, name, ICON, SIN, rarity, desc, effect);

export const gluttonyCards = [
  // ==================== 노말 12장 (stat 9 + 트리거 3) ====================
  _card('gluttony_normal_1',  '흡혈',          'normal', '흡혈 +3%',                                { lifesteal: 0.03 }),
  _card('gluttony_normal_2',  '빠른 흡혈',     'normal', '흡혈 +1%, 공격 속도 +2%',                 { lifesteal: 0.01, attackSpeed: -20 }),
  _card('gluttony_normal_3',  '흡혈 강타',     'normal', '흡혈 +2%, 공격력 +2',                     { lifesteal: 0.02, attackPower: 2 }),
  _card('gluttony_normal_4',  '정밀 흡혈',     'normal', '흡혈 +2%, 명중 +5%',                      { lifesteal: 0.02, accuracy: 0.05 }),
  _card('gluttony_normal_5',  '흡혈 치명',     'normal', '흡혈 +2%, 치명타 확률 +3%',               { lifesteal: 0.02, critChance: 0.03 }),
  _card('gluttony_normal_6',  '폭주 흡혈',     'normal', '흡혈 +1%, 치명타 피해 +10%',              { lifesteal: 0.01, critDamage: 0.10 }),
  _card('gluttony_normal_7',  '거구화',        'normal', '흡혈 +2%, 최대 HP +15',                   { lifesteal: 0.02, maxHp: 15 }),
  _card('gluttony_normal_8',  '회피 흡혈',     'normal', '흡혈 +2%, 회피 +3%',                       { lifesteal: 0.02, dodge: 0.03 }),
  _card('gluttony_normal_9',  '흡혈 방어',     'normal', '흡혈 +3%, 피해 감소 +2%',                  { lifesteal: 0.03, damageReduction: 0.02 }),
  // 트리거 3장
  {
    id: 'gluttony_normal_10', name: '처치 누적', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '처치 시 공격력 +0.1 영구 (max +3)',
    apply:  (p) => { p._gluttonyNormalKillStackActive = true; },
    revert: (p) => {
      p._gluttonyNormalKillStackActive = false;
      if (p._gluttonyNormalKillStackAdded > 0) {
        p.modStat('attackPower', 'cards', -p._gluttonyNormalKillStackAdded);
        p._gluttonyNormalKillStackAdded = 0;
      }
    },
  },
  {
    id: 'gluttony_normal_11', name: '흡혈 폭주', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '흡혈 발동 시 3초간 공격력 +5%',
    apply:  (p) => { p._gluttonyNormalLifestealAtkBuffActive = true; },
    revert: (p) => { p._gluttonyNormalLifestealAtkBuffActive = false; },
  },
  {
    id: 'gluttony_normal_12', name: '포식의 본능', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '회복 시 3초간 최대 HP +5',
    apply:  (p) => { p._gluttonyNormalHealMaxHpActive = true; },
    revert: (p) => {
      p._gluttonyNormalHealMaxHpActive = false;
      if (p._gluttonyNormalHealMaxHpApplied) {
        p.modStat('maxHp', 'cards', -5);
        p._gluttonyNormalHealMaxHpApplied = false;
        p._gluttonyNormalHealMaxHpExpireAt = 0;
        if (p.stats.hp > p.getStat('maxHp')) p.stats.hp = p.getStat('maxHp');
      }
    },
  },

  // ==================== 레어 14장 (stat 8 + 트리거 6) ====================
  _card('gluttony_rare_1',  '거대 흡혈',     'rare', '흡혈 +5%, 공격력 +3',                                  { lifesteal: 0.05, attackPower: 3 }),
  _card('gluttony_rare_2',  '정밀 거구',     'rare', '흡혈 +5%, 최대 HP +20, 명중 +4%',                       { lifesteal: 0.05, maxHp: 20, accuracy: 0.04 }),
  _card('gluttony_rare_3',  '흡혈 폭주',     'rare', '흡혈 +5%, 공격 속도 +5%',                              { lifesteal: 0.05, attackSpeed: -50 }),
  _card('gluttony_rare_4',  '흡혈 치명',     'rare', '흡혈 +6%, 치명타 확률 +4%, 치명타 피해 +15%',            { lifesteal: 0.06, critChance: 0.04, critDamage: 0.15 }),
  _card('gluttony_rare_5',  '흡혈 회피',     'rare', '흡혈 +6%, 회피 +4%, 피해 감소 +3%',                    { lifesteal: 0.06, dodge: 0.04, damageReduction: 0.03 }),
  _card('gluttony_rare_6',  '황금 흡혈',     'rare', '흡혈 +6%, 공격력 +3, 골드 획득량 +8%',                  { lifesteal: 0.06, attackPower: 3, goldGainMul: 0.08 }),
  _card('gluttony_rare_7',  '정밀 흡혈',     'rare', '흡혈 +7%, 명중 +6%, 공격력 +2',                         { lifesteal: 0.07, accuracy: 0.06, attackPower: 2 }),
  _card('gluttony_rare_8',  '거구 강타',     'rare', '흡혈 +5%, 최대 HP +25, 치명타 피해 +15%',               { lifesteal: 0.05, maxHp: 25, critDamage: 0.15 }),
  // 트리거 6장
  {
    id: 'gluttony_rare_9', name: '처치 누적 (레어)', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '처치 시 공격력 +0.2 영구 (max +10)',
    apply:  (p) => { p._gluttonyRareKillStackActive = true; },
    revert: (p) => {
      p._gluttonyRareKillStackActive = false;
      if (p._gluttonyRareKillStackAdded > 0) {
        p.modStat('attackPower', 'cards', -p._gluttonyRareKillStackAdded);
        p._gluttonyRareKillStackAdded = 0;
      }
    },
  },
  {
    id: 'gluttony_rare_10', name: '흡혈 폭주 (레어)', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '흡혈 발동 시 4초간 공격력 +10%',
    apply:  (p) => { p._gluttonyRareLifestealAtkBuffActive = true; },
    revert: (p) => { p._gluttonyRareLifestealAtkBuffActive = false; },
  },
  {
    id: 'gluttony_rare_11', name: '회복 강화', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '회복 시 4초간 최대 HP +15',
    apply:  (p) => { p._gluttonyRareHealMaxHpActive = true; },
    revert: (p) => {
      p._gluttonyRareHealMaxHpActive = false;
      if (p._gluttonyRareHealMaxHpApplied) {
        p.modStat('maxHp', 'cards', -15);
        p._gluttonyRareHealMaxHpApplied = false;
        p._gluttonyRareHealMaxHpExpireAt = 0;
        if (p.stats.hp > p.getStat('maxHp')) p.stats.hp = p.getStat('maxHp');
      }
    },
  },
  {
    id: 'gluttony_rare_12', name: '거인 사냥', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '처치 시 최대 HP +1 영구 (max +30)',
    apply:  (p) => { p._gluttonyRareKillMaxHpActive = true; },
    revert: (p) => {
      p._gluttonyRareKillMaxHpActive = false;
      if (p._gluttonyRareKillMaxHpAdded > 0) {
        p.modStat('maxHp', 'cards', -p._gluttonyRareKillMaxHpAdded);
        p._gluttonyRareKillMaxHpAdded = 0;
      }
    },
  },
  {
    id: 'gluttony_rare_13', name: '즉시 흡혈', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '흡혈 발동 시 즉시 최대 HP × 1% 추가 회복',
    apply:  (p) => { p._gluttonyRareLifestealHealActive = true; },
    revert: (p) => { p._gluttonyRareLifestealHealActive = false; },
  },
  {
    id: 'gluttony_rare_14', name: '학살의 흡수', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '처치한 적의 공격력 × 3% 영구 흡수',
    apply:  (p) => { p._gluttonyRareAtkAbsorbedActive = true; },
    revert: (p) => {
      p._gluttonyRareAtkAbsorbedActive = false;
      if (p._gluttonyRareAtkAbsorbed > 0) {
        p.modStat('attackPower', 'cards', -p._gluttonyRareAtkAbsorbed);
        p._gluttonyRareAtkAbsorbed = 0;
      }
    },
  },

  // ==================== 레전드 8장 (stat 4 + 트리거/게임체인저 4) ====================
  _card('gluttony_legend_1', '흡혈의 신',     'legend', '흡혈 +20%, 공격력 +10, 최대 HP +50',                         { lifesteal: 0.20, attackPower: 10, maxHp: 50 }),
  _card('gluttony_legend_2', '만능 흡혈',     'legend', '흡혈 +15%, 명중 +10%, 회피 +5%, 공격력 +8',                  { lifesteal: 0.15, accuracy: 0.10, dodge: 0.05, attackPower: 8 }),
  _card('gluttony_legend_3', '영원한 흡혈',   'legend', '흡혈 +25%, 공격 속도 +7%, 명중 +10%',                        { lifesteal: 0.25, attackSpeed: -70, accuracy: 0.10 }),
  _card('gluttony_legend_4', '거대 흡혈',     'legend', '흡혈 +20%, 최대 HP +80, 치명타 피해 +30%',                   { lifesteal: 0.20, maxHp: 80, critDamage: 0.30 }),
  // 게임체인저 4장
  {
    id: 'gluttony_legend_5', name: '처치 누적 (레전드)', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '처치 시 공격력 +0.5 영구 (max +50)',
    apply:  (p) => { p._gluttonyL1Active = true; },
    revert: (p) => {
      p._gluttonyL1Active = false;
      if (p._gluttonyL1AtkAdded > 0) {
        p.modStat('attackPower', 'cards', -p._gluttonyL1AtkAdded);
        p._gluttonyL1AtkAdded = 0;
      }
    },
  },
  {
    id: 'gluttony_legend_6', name: '흡혈 폭주 (레전드)', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '흡혈 발동 시 5초간 공격력 ×1.20',
    apply:  (p) => { p._gluttonyL3Active = true; },
    revert: (p) => { p._gluttonyL3Active = false; },
  },
  {
    id: 'gluttony_legend_7', name: '회복 누적', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '회복 시 5초간 최대 HP +20',
    apply:  (p) => { p._gluttonyL4Active = true; },
    revert: (p) => {
      p._gluttonyL4Active = false;
      if (p._gluttonyL4MaxHpActive) {
        p.modStat('maxHp', 'cards', -20);
        p._gluttonyL4MaxHpActive = false;
        if (p.stats.hp > p.getStat('maxHp')) p.stats.hp = p.getStat('maxHp');
      }
    },
  },
  {
    id: 'gluttony_legend_8', name: '처치 흡수', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '처치한 적의 공격력 × 5% 영구 흡수',
    apply:  (p) => { p._gluttonyL5Active = true; },
    revert: (p) => {
      p._gluttonyL5Active = false;
      if (p._gluttonyL5AtkAdded > 0) {
        p.modStat('attackPower', 'cards', -p._gluttonyL5AtkAdded);
        p._gluttonyL5AtkAdded = 0;
      }
    },
  },
];
