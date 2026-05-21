// 탐욕 (GREED) 카드 풀 — 38장 [Phase P-54]
// 분배: 노말 12 / 레어 14 / 레전드 8. epic 등급 제거.
// 메인 stat: goldGainMul. 보조: attackPower / attackSpeed / maxHp / critChance / critDamage / dodge / accuracy / lifesteal / damageReduction.
//
// 트리거 카드는 기존 Player.js 플래그 (예: _greedNormalGoldRatioActive) 재활용 — Player 코드 변경 최소화.

import { SINS } from '../sins.js';
import { makeCard } from './_cardHelper.js';

const ICON = '💰';
const SIN  = SINS.GREED;
const _card = (id, name, rarity, desc, effect) => makeCard(id, name, ICON, SIN, rarity, desc, effect);

export const greedCards = [
  // ==================== 노말 12장 (stat 9 + 트리거 3) ====================
  _card('greed_normal_1',  '황금욕',        'normal', '골드 획득량 +5%',                       { goldGainMul: 0.05 }),
  _card('greed_normal_2',  '동전 마술사',   'normal', '골드 획득량 +2%, 공격력 +1',             { goldGainMul: 0.02, attackPower: 1 }),
  _card('greed_normal_3',  '동전 갑옷',     'normal', '골드 획득량 +3%, 최대 HP +10',           { goldGainMul: 0.03, maxHp: 10 }),
  _card('greed_normal_4',  '황금 화살',     'normal', '골드 획득량 +2%, 명중 +3%',              { goldGainMul: 0.02, accuracy: 0.03 }),
  _card('greed_normal_5',  '황금 일격',     'normal', '골드 획득량 +3%, 치명타 확률 +2%',        { goldGainMul: 0.03, critChance: 0.02 }),
  _card('greed_normal_6',  '빠른 욕망',     'normal', '골드 획득량 +2%, 공격 속도 +2%',          { goldGainMul: 0.02, attackSpeed: -20 }),
  _card('greed_normal_7',  '동전 흡혈',     'normal', '골드 획득량 +2%, 흡혈 +2%',              { goldGainMul: 0.02, lifesteal: 0.02 }),
  _card('greed_normal_8',  '동전 회피',     'normal', '골드 획득량 +2%, 회피 +2%',              { goldGainMul: 0.02, dodge: 0.02 }),
  _card('greed_normal_9',  '황금 방어',     'normal', '골드 획득량 +3%, 피해 감소 +2%',          { goldGainMul: 0.03, damageReduction: 0.02 }),
  // 트리거 3장
  {
    id: 'greed_normal_10', name: '도굴꾼', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '처치 시 골드 +1',
    apply:  (p) => { p._greedNormalKillGoldActive = true; },
    revert: (p) => { p._greedNormalKillGoldActive = false; },
  },
  {
    id: 'greed_normal_11', name: '누적 욕망', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '보유 골드 100당 공격력 +0.5',
    apply:  (p) => { p._greedNormalGoldRatioActive = true; },
    revert: (p) => { p._greedNormalGoldRatioActive = false; },
  },
  {
    id: 'greed_normal_12', name: '치명 보유', icon: ICON, sin: SIN, rarity: 'normal',
    desc: '보유 골드 100당 치명타 확률 +1%',
    apply:  (p) => { p._greedNormalCritGoldActive = true; },
    revert: (p) => { p._greedNormalCritGoldActive = false; },
  },

  // ==================== 레어 14장 (stat 8 + 트리거 6) ====================
  _card('greed_rare_1',  '동전 사냥꾼',   'rare', '골드 획득량 +8%, 공격력 +3',                            { goldGainMul: 0.08, attackPower: 3 }),
  _card('greed_rare_2',  '화려한 일격',   'rare', '골드 획득량 +7%, 치명타 확률 +4%, 치명타 피해 +15%',       { goldGainMul: 0.07, critChance: 0.04, critDamage: 0.15 }),
  _card('greed_rare_3',  '황금 갑옷',     'rare', '골드 획득량 +8%, 최대 HP +20, 피해 감소 +3%',           { goldGainMul: 0.08, maxHp: 20, damageReduction: 0.03 }),
  _card('greed_rare_4',  '동전 폭풍',     'rare', '골드 획득량 +9%, 공격 속도 +4%',                        { goldGainMul: 0.09, attackSpeed: -40 }),
  _card('greed_rare_5',  '회피 약탈',     'rare', '골드 획득량 +8%, 회피 +4%, 명중 +4%',                  { goldGainMul: 0.08, dodge: 0.04, accuracy: 0.04 }),
  _card('greed_rare_6',  '황금 마수',     'rare', '골드 획득량 +7%, 흡혈 +4%, 공격력 +2',                  { goldGainMul: 0.07, lifesteal: 0.04, attackPower: 2 }),
  _card('greed_rare_7',  '황금 검술',     'rare', '골드 획득량 +10%, 명중 +6%',                            { goldGainMul: 0.10, accuracy: 0.06 }),
  _card('greed_rare_8',  '정밀 약탈',     'rare', '골드 획득량 +6%, 치명타 피해 +20%, 공격력 +3',           { goldGainMul: 0.06, critDamage: 0.20, attackPower: 3 }),
  // 트리거 6장
  {
    id: 'greed_rare_9', name: '약탈자', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '처치 시 골드 +3',
    apply:  (p) => { p._greedRareKillGoldActive = true; },
    revert: (p) => { p._greedRareKillGoldActive = false; },
  },
  {
    id: 'greed_rare_10', name: '쌓인 욕망', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '보유 골드 100당 공격력 +1',
    apply:  (p) => { p._greedRareGoldRatioActive = true; },
    revert: (p) => { p._greedRareGoldRatioActive = false; },
  },
  {
    id: 'greed_rare_11', name: '누적 차감', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '골드 차감 시 1G당 공격력 +0.01 누적 (max +5)',
    apply:  (p) => { p._greedRareSpendStackActive = true; },
    revert: (p) => {
      p._greedRareSpendStackActive = false;
      if (p._greedRareSpendStackAdded > 0) {
        p.modStat('attackPower', 'cards', -p._greedRareSpendStackAdded);
        p._greedRareSpendStackAdded = 0;
      }
    },
  },
  {
    id: 'greed_rare_12', name: '치명 보유 (레어)', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '보유 골드 100당 치명타 확률 +2%',
    apply:  (p) => { p._greedRareCritGoldActive = true; },
    revert: (p) => { p._greedRareCritGoldActive = false; },
  },
  {
    id: 'greed_rare_13', name: '즉시 보상', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '골드 획득 시 5초간 공격력 +5%',
    apply:  (p) => { p._greedRareGoldGainBuffActive = true; },
    revert: (p) => { p._greedRareGoldGainBuffActive = false; },
  },
  {
    id: 'greed_rare_14', name: '황금 누적', icon: ICON, sin: SIN, rarity: 'rare',
    desc: '골드 누적 100G 사용 시 즉시 공격력 +3 영구 (1회성)',
    apply:  (p) => { p._greedRareMilestoneActive = true; },
    revert: (p) => {
      p._greedRareMilestoneActive = false;
      if (p._greedRareMilestoneUsed && p._greedRareMilestoneAdded > 0) {
        p.modStat('attackPower', 'cards', -p._greedRareMilestoneAdded);
        p._greedRareMilestoneAdded = 0;
        p._greedRareMilestoneUsed = false;
      }
      p._greedRareMilestoneSpent = 0;
    },
  },

  // ==================== 레전드 8장 (stat 4 + 트리거/게임체인저 4) ====================
  _card('greed_legend_1', '황금의 신탁', 'legend', '골드 획득량 +30%, 공격력 +15, 흡혈 +5%',                { goldGainMul: 0.30, attackPower: 15, lifesteal: 0.05 }),
  _card('greed_legend_2', '사치왕',     'legend', '골드 획득량 +40%, 공격력 +10, 명중 +15%, 치명타 피해 +30%', { goldGainMul: 0.40, attackPower: 10, accuracy: 0.15, critDamage: 0.30 }),
  _card('greed_legend_3', '황금 폭주',  'legend', '골드 획득량 +25%, 공격 속도 +12%, 치명타 피해 +50%',     { goldGainMul: 0.25, attackSpeed: -110, critDamage: 0.50 }),
  _card('greed_legend_4', '극한 욕망',  'legend', '골드 획득량 +50%, 최대 HP +50, 피해 감소 +5%',           { goldGainMul: 0.50, maxHp: 50, damageReduction: 0.05 }),
  // 게임체인저 4장
  {
    id: 'greed_legend_5', name: '황금 신탁', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '보유 골드 100당 공격력 +1',
    apply:  (p) => { p._greedL1Active = true; },
    revert: (p) => { p._greedL1Active = false; },
  },
  {
    id: 'greed_legend_6', name: '영겁의 욕망', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '처치 시 골드 +5 (영구)',
    apply:  (p) => { p._greedL3Active = true; },
    revert: (p) => { p._greedL3Active = false; },
  },
  {
    id: 'greed_legend_7', name: '누적 욕망 (레전드)', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '보유 골드 100당 모든 % 스탯 +5%',
    apply:  (p) => { p._greedL4Active = true; },
    revert: (p) => { p._greedL4Active = false; },
  },
  {
    id: 'greed_legend_8', name: '차감 누적 (레전드)', icon: ICON, sin: SIN, rarity: 'legend',
    desc: '골드 차감 시 1G당 공격력 +0.02 누적 (무제한)',
    apply:  (p) => { p._greedL5Active = true; },
    revert: (p) => {
      p._greedL5Active = false;
      if (p._greedL5AtkBonus > 0) {
        p.modStat('attackPower', 'cards', -p._greedL5AtkBonus);
        p._greedL5AtkBonus = 0;
      }
    },
  },
];
