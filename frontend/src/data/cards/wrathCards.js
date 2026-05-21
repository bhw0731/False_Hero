// 분노 (WRATH) 카드 풀 — 38장 [Phase P-54]
// 분배: 노말 12 / 레어 14 / 레전드 8. epic 등급 제거.
// 메인 stat: attackPower. 보조: 공속/HP/치명타/치피/회피/명중/흡혈/피해감소/골드.
// 규칙: 같은 등급 안 stat 조합 unique. 페널티 X. 트리거 결과 다양화 (공격력/공속/무적/배수).
//
// 새 ID 체계: wrath_normal_1~12, wrath_rare_1~14, wrath_legend_1~8.
// 옛 'wrath_epic_*' / 'wrath_normal_13' (콤보) / 옛 'wrath_rare_11' 등은 폐기 — 세이브 마이그레이션에서 자동 정리.

import { SINS } from '../sins.js';
import { makeCard } from './_cardHelper.js';

const ICON = '🔥';
const SIN  = SINS.WRATH;
const _card = (id, name, rarity, desc, effect) => makeCard(id, name, ICON, SIN, rarity, desc, effect);

export const wrathCards = [
  // ==================== 노말 12장 (stat 9 + 트리거 3) ====================
  _card('wrath_normal_1',  '맹공',       'normal', '공격력 +3',                  { attackPower: 3 }),
  _card('wrath_normal_2',  '가벼운 검',   'normal', '공격력 +1, 공격 속도 +3%',     { attackPower: 1, attackSpeed: -30 }),
  _card('wrath_normal_3',  '거검',       'normal', '공격력 +3, 피해 감소 +2%',    { attackPower: 3, damageReduction: 0.02 }),
  _card('wrath_normal_4',  '송곳니',     'normal', '공격력 +1, 치명타 확률 +3%',  { attackPower: 1, critChance: 0.03 }),
  _card('wrath_normal_5',  '강타',       'normal', '공격력 +2, 치명타 피해 +12%', { attackPower: 2, critDamage: 0.12 }),
  _card('wrath_normal_6',  '흡혈검',     'normal', '공격력 +1, 흡혈 +3%',         { attackPower: 1, lifesteal: 0.03 }),
  _card('wrath_normal_7',  '정확한 일격', 'normal', '공격력 +2, 명중 +5%',         { attackPower: 2, accuracy: 0.05 }),
  _card('wrath_normal_8',  '회피검',     'normal', '공격력 +1, 회피 +3%',         { attackPower: 1, dodge: 0.03 }),
  _card('wrath_normal_9',  '핏빛 칼날',  'normal', '공격력 +2, 최대 HP +15',      { attackPower: 2, maxHp: 15 }),
  // 트리거 3장
  {
    id: 'wrath_normal_10', name: '도살', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '처치 시 공격력 +0.1 영구 (max +3)',
    apply:  (p) => { p._wrathKillStackNActive = true; },
    revert: (p) => {
      p._wrathKillStackNActive = false;
      if (p._wrathKillStackNAdded > 0) {
        p.modStat('attackPower', 'cards', -p._wrathKillStackNAdded);
        p._wrathKillStackNAdded = 0;
      }
    },
  },
  {
    id: 'wrath_normal_11', name: '역린', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '피격 시 3초간 공격력 +6%',
    apply:  (p) => { p._wrathDmgBuffNActive = true; },
    revert: (p) => { p._wrathDmgBuffNActive = false; },
  },
  {
    id: 'wrath_normal_12', name: '광기의 끝', icon: ICON, sin: SIN, rarity: 'normal',
    desc: 'HP 50% 이하 시 공격 속도 +20%',
    apply:  (p) => { p._wrathNormalHpSpeedActive = true; },
    revert: (p) => { p._wrathNormalHpSpeedActive = false; },
  },

  // ==================== 레어 14장 (stat 8 + 트리거 6) ====================
  _card('wrath_rare_1',  '광인',          'rare', '공격력 +5, 공격 속도 +5%',                  { attackPower: 5, attackSpeed: -50 }),
  _card('wrath_rare_2',  '잔혹한 일격',    'rare', '공격력 +4, 치명타 확률 +5%, 치명타 피해 +15%', { attackPower: 4, critChance: 0.05, critDamage: 0.15 }),
  _card('wrath_rare_3',  '피의 검',        'rare', '공격력 +5, 최대 HP +25, 흡혈 +3%',           { attackPower: 5, maxHp: 25, lifesteal: 0.03 }),
  _card('wrath_rare_4',  '무거운 도끼',    'rare', '공격력 +7, 명중 +6%',                       { attackPower: 7, accuracy: 0.06 }),
  _card('wrath_rare_5',  '야수의 발톱',    'rare', '공격력 +5, 공격 속도 +6%, 피해 감소 +4%',      { attackPower: 5, attackSpeed: -60, damageReduction: 0.04 }),
  _card('wrath_rare_6',  '사신의 낫',      'rare', '공격력 +5, 치명타 확률 +4%, 회피 +3%',       { attackPower: 5, critChance: 0.04, dodge: 0.03 }),
  _card('wrath_rare_7',  '황금 검',        'rare', '공격력 +6, 골드 획득량 +12%',                { attackPower: 6, goldGainMul: 0.12 }),
  _card('wrath_rare_8',  '정확한 처형',    'rare', '공격력 +4, 명중 +8%, 치명타 피해 +20%',      { attackPower: 4, accuracy: 0.08, critDamage: 0.20 }),
  // 트리거 6장
  {
    id: 'wrath_rare_9', name: '분노의 누적', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '처치 시 공격력 +0.25 영구 (max +8)',
    apply:  (p) => { p._wrathKillStackRActive = true; },
    revert: (p) => {
      p._wrathKillStackRActive = false;
      if (p._wrathKillStackRAdded > 0) {
        p.modStat('attackPower', 'cards', -p._wrathKillStackRAdded);
        p._wrathKillStackRAdded = 0;
      }
    },
  },
  {
    id: 'wrath_rare_10', name: '반격', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '피격 시 4초간 공격력 +15%',
    apply:  (p) => { p._wrathDmgBuffRActive = true; },
    revert: (p) => { p._wrathDmgBuffRActive = false; },
  },
  {
    id: 'wrath_rare_11', name: '격노의 연격', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '콤보 4+ 시 공격력 +12%',
    apply:  (p) => { p._wrathComboBuffRActive = true; },
    revert: (p) => { p._wrathComboBuffRActive = false; },
  },
  {
    id: 'wrath_rare_12', name: '격추', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '처치 시 1초 무적',
    apply:  (p) => { p._wrathRareKillInvulnActive = true; },
    revert: (p) => { p._wrathRareKillInvulnActive = false; },
  },
  {
    id: 'wrath_rare_13', name: '연쇄 처형', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '5번째 공격마다 피해 ×1.6',
    apply:  (p) => { p._wrathRareCounterActive = true; },
    revert: (p) => { p._wrathRareCounterActive = false; p._wrathAttackCounter = 0; },
  },
  {
    id: 'wrath_rare_14', name: '절체절명', icon: ICON, sin: SIN, rarity: 'rare',
    desc: 'HP 60% 이하 시 공격력 +18%',
    apply:  (p) => { p._wrathHpBuffRActive = true; },
    revert: (p) => { p._wrathHpBuffRActive = false; },
  },

  // ==================== 레전드 8장 (stat 4 + 트리거/게임체인저 4) ====================
  _card('wrath_legend_1', '무한 폭주',   'legend', '공격력 +25, 공격 속도 +12%, 치명타 피해 +50%',         { attackPower: 25, attackSpeed: -110, critDamage: 0.50 }),
  _card('wrath_legend_2', '만능 폭주',   'legend', '공격력 +20, 흡혈 +8%, 명중 +15%, 치명타 확률 +10%',     { attackPower: 20, lifesteal: 0.08, accuracy: 0.15, critChance: 0.10 }),
  _card('wrath_legend_3', '폭군의 일격', 'legend', '공격력 +30, 치명타 피해 +60%',                          { attackPower: 30, critDamage: 0.60 }),
  _card('wrath_legend_4', '폭풍',       'legend', '공격력 +22, 공격 속도 +20%, 회피 +8%',                   { attackPower: 22, attackSpeed: -170, dodge: 0.08 }),
  // 트리거/게임체인저 4장
  {
    id: 'wrath_legend_5', name: '빈사의 광기', icon: ICON, sin: SIN, rarity: 'legend',
    desc: 'HP 낮을수록 공격력 (HP 1% 시 ×1.5)',
    apply:  (p) => { p._wrathL1Active = true; },
    revert: (p) => { p._wrathL1Active = false; },
  },
  {
    id: 'wrath_legend_6', name: '영겁의 분노', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '처치 시 공격력 +0.5 영구 (max +30)',
    apply:  (p) => { p._wrathL3Active = true; },
    revert: (p) => {
      p._wrathL3Active = false;
      if (p._wrathL3Added > 0) {
        p.modStat('attackPower', 'cards', -p._wrathL3Added);
        p._wrathL3Added = 0;
      }
    },
  },
  {
    id: 'wrath_legend_7', name: '폭주 콤보', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '콤보 5+ 시 공격력 ×1.30',
    apply:  (p) => { p._wrathL4Active = true; },
    revert: (p) => { p._wrathL4Active = false; },
  },
  {
    id: 'wrath_legend_8', name: '학살의 인장', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '처치 시 3초간 공격 속도 +30%',
    apply:  (p) => { p._wrathLegendKillSpeedActive = true; },
    revert: (p) => { p._wrathLegendKillSpeedActive = false; },
  },
];
