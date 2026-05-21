// 나태 (SLOTH) 카드 풀 — 38장 [Phase P-54]
// 분배: 노말 12 / 레어 14 / 레전드 8. epic 등급 제거.
// 메인 stat: maxHp. 보조: 공격력 / 공속 / 치명타 / 치피 / 회피 / 명중 / 흡혈 / 피해 감소 / 골드.

import { SINS } from '../sins.js';
import { makeCard } from './_cardHelper.js';

const ICON = '🛡';
const SIN  = SINS.SLOTH;
const _card = (id, name, rarity, desc, effect) => makeCard(id, name, ICON, SIN, rarity, desc, effect);

export const slothCards = [
  // ==================== 노말 12장 (stat 9 + 트리거 3) ====================
  _card('sloth_normal_1',  '두꺼운 가죽', 'normal', '최대 HP +15',                            { maxHp: 15 }),
  _card('sloth_normal_2',  '느린 검',     'normal', '최대 HP +8, 공격력 +1',                  { maxHp: 8,  attackPower: 1 }),
  _card('sloth_normal_3',  '둔중',        'normal', '최대 HP +12, 피해 감소 +2%',              { maxHp: 12, damageReduction: 0.02 }),
  _card('sloth_normal_4',  '무거운 검',   'normal', '최대 HP +10, 공격력 +2',                  { maxHp: 10, attackPower: 2 }),
  _card('sloth_normal_5',  '침착',        'normal', '최대 HP +12, 치명타 피해 +8%',            { maxHp: 12, critDamage: 0.08 }),
  _card('sloth_normal_6',  '거구화',      'normal', '최대 HP +10, 흡혈 +2%',                   { maxHp: 10, lifesteal: 0.02 }),
  _card('sloth_normal_7',  '정조준',      'normal', '최대 HP +12, 명중 +4%',                   { maxHp: 12, accuracy: 0.04 }),
  _card('sloth_normal_8',  '회피의 흐름', 'normal', '최대 HP +10, 회피 +3%',                   { maxHp: 10, dodge: 0.03 }),
  _card('sloth_normal_9',  '황금 잠',     'normal', '최대 HP +10, 골드 획득량 +3%',            { maxHp: 10, goldGainMul: 0.03 }),
  // 트리거 3장
  {
    id: 'sloth_normal_10', name: '누적 가죽', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '피격 시 최대 HP +1 영구 (max +20)',
    apply:  (p) => { p._slothNormalDmgStackActive = true; },
    revert: (p) => {
      p._slothNormalDmgStackActive = false;
      if (p._slothNormalDmgStackAdded > 0) {
        p.modStat('maxHp', 'cards', -p._slothNormalDmgStackAdded);
        p._slothNormalDmgStackAdded = 0;
      }
    },
  },
  {
    id: 'sloth_normal_11', name: '만회', icon: ICON, sin: SIN, rarity: 'normal',
    desc: 'HP 100% 시 받는 피해 -10%',
    apply:  (p) => { p._slothNormalFullHpReductActive = true; },
    revert: (p) => { p._slothNormalFullHpReductActive = false; },
  },
  {
    id: 'sloth_normal_12', name: '거구의 일격', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '최대 HP 100당 공격력 +0.5',
    apply:  (p) => { p._slothNormalMaxHpAtkActive = true; },
    revert: (p) => { p._slothNormalMaxHpAtkActive = false; },
  },

  // ==================== 레어 14장 (stat 8 + 트리거 6) ====================
  _card('sloth_rare_1',  '강철 가죽',     'rare', '최대 HP +25, 피해 감소 +4%',                  { maxHp: 25, damageReduction: 0.04 }),
  _card('sloth_rare_2',  '침묵의 검',     'rare', '최대 HP +20, 공격력 +3',                      { maxHp: 20, attackPower: 3 }),
  _card('sloth_rare_3',  '거구 흡혈',     'rare', '최대 HP +30, 흡혈 +3%',                       { maxHp: 30, lifesteal: 0.03 }),
  _card('sloth_rare_4',  '둔중한 망치',   'rare', '최대 HP +25, 공격력 +5, 명중 +3%',             { maxHp: 25, attackPower: 5, accuracy: 0.03 }),
  _card('sloth_rare_5',  '침착한 일격',   'rare', '최대 HP +20, 치명타 확률 +4%, 치명타 피해 +12%', { maxHp: 20, critChance: 0.04, critDamage: 0.12 }),
  _card('sloth_rare_6',  '황금 갑옷',     'rare', '최대 HP +25, 골드 획득량 +8%',                  { maxHp: 25, goldGainMul: 0.08 }),
  _card('sloth_rare_7',  '회피의 갑옷',   'rare', '최대 HP +20, 회피 +5%, 명중 +4%',              { maxHp: 20, dodge: 0.05, accuracy: 0.04 }),
  _card('sloth_rare_8',  '폭주의 인내',   'rare', '최대 HP +20, 공격 속도 +5%',                   { maxHp: 20, attackSpeed: -50 }),
  // 트리거 6장
  {
    id: 'sloth_rare_9', name: '맥스 비례 (레어)', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '최대 HP 100당 공격력 +1',
    apply:  (p) => { p._slothRareMaxHpAtkActive = true; },
    revert: (p) => { p._slothRareMaxHpAtkActive = false; },
  },
  {
    id: 'sloth_rare_10', name: '영원의 가죽', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '피격 시 최대 HP +2 영구 (max +40)',
    apply:  (p) => { p._slothRareDmgStackActive = true; },
    revert: (p) => {
      p._slothRareDmgStackActive = false;
      if (p._slothRareDmgStackAdded > 0) {
        p.modStat('maxHp', 'cards', -p._slothRareDmgStackAdded);
        p._slothRareDmgStackAdded = 0;
      }
    },
  },
  {
    id: 'sloth_rare_11', name: '만회 (레어)', icon: ICON, sin: SIN, rarity: 'rare',
    desc: 'HP 100% 시 받는 피해 -25%',
    apply:  (p) => { p._slothRareFullHpReductActive = true; },
    revert: (p) => { p._slothRareFullHpReductActive = false; },
  },
  {
    id: 'sloth_rare_12', name: '빈사 회복', icon: ICON, sin: SIN, rarity: 'rare',
    desc: 'HP 50% 이하 시 매초 최대 HP × 2% 회복',
    apply:  (p) => { p._slothRareLowHpHealActive = true; },
    revert: (p) => { p._slothRareLowHpHealActive = false; p._slothRareLowHpLastTickTime = 0; },
  },
  {
    id: 'sloth_rare_13', name: '회복 강화', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '회복 시 5초간 공격력 +10%',
    apply:  (p) => { p._slothRareHealAtkBuffActive = true; },
    revert: (p) => { p._slothRareHealAtkBuffActive = false; },
  },
  {
    id: 'sloth_rare_14', name: '자기 강화', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '최대 HP 200 도달 시 즉시 흡혈 +5% 영구 (1회성)',
    apply:  (p) => { p._slothRareMilestoneActive = true; },
    revert: (p) => {
      p._slothRareMilestoneActive = false;
      if (p._slothRareMilestoneUsed) {
        p.modStat('lifesteal', 'cards', -0.05);
        p._slothRareMilestoneUsed = false;
      }
    },
  },

  // ==================== 레전드 8장 (stat 4 + 트리거/게임체인저 4) ====================
  _card('sloth_legend_1', '거인의 힘',     'legend', '최대 HP +120, 피해 감소 +10%',                       { maxHp: 120, damageReduction: 0.10 }),
  _card('sloth_legend_2', '만능 거인',     'legend', '최대 HP +80, 공격력 +10, 명중 +10%',                  { maxHp: 80, attackPower: 10, accuracy: 0.10 }),
  _card('sloth_legend_3', '영생',          'legend', '최대 HP +100, 흡혈 +10%, 치명타 피해 +30%',           { maxHp: 100, lifesteal: 0.10, critDamage: 0.30 }),
  _card('sloth_legend_4', '폭주 침착',     'legend', '최대 HP +80, 공격 속도 +12%, 치명타 피해 +30%',       { maxHp: 80, attackSpeed: -110, critDamage: 0.30 }),
  // 게임체인저 4장
  {
    id: 'sloth_legend_5', name: '맥스 비례 (레전드)', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '최대 HP 100당 공격력 +1',
    apply:  (p) => { p._slothL1Active = true; },
    revert: (p) => { p._slothL1Active = false; },
  },
  {
    id: 'sloth_legend_6', name: '끈질김', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '피격 시 최대 HP +5 영구 (무제한)',
    apply:  (p) => { p._slothL3Active = true; },
    revert: (p) => {
      p._slothL3Active = false;
      if (p._slothL3MaxHpAdded > 0) {
        p.modStat('maxHp', 'cards', -p._slothL3MaxHpAdded);
        p._slothL3MaxHpAdded = 0;
        if (p.stats && p.stats.hp > p.getStat('maxHp')) p.stats.hp = p.getStat('maxHp');
      }
    },
  },
  {
    id: 'sloth_legend_7', name: '만회 (레전드)', icon: ICON, sin: SIN, rarity: 'legend',
    desc: 'HP 100% 시 받는 피해 ×0.5',
    apply:  (p) => { p._slothL4Active = true; },
    revert: (p) => { p._slothL4Active = false; },
  },
  {
    id: 'sloth_legend_8', name: '빈사 광기', icon: ICON, sin: SIN, rarity: 'legend',
    desc: 'HP 50% 이하 시 매초 최대 HP × 5% 회복',
    apply:  (p) => { p._slothL5Active = true; },
    revert: (p) => { p._slothL5Active = false; p._slothL5LastTickTime = 0; },
  },
];
