// 보스 데이터 16종 — 외형(파일명)과 이름이 일치
// 잡몹과 같은 16종 스프라이트의 큰 사이즈(128) / 강한 능력치 버전
// [Phase P-44d] 모든 보스 attackRange = 100 (근접). 추후 보스 대변경 시 재결정.

import { getBossOverrides } from './adminConfig.js';

export const bossTypes = [
  // 1. 거대 슬라임 — 점점 커지는 슬라임
  {
    id: 'giantSlime',
    name: '거대 슬라임',
    desc: '거대한 점액 덩어리',
    spriteKey: '슬라임',
    color: 0x8FFF8F,
    size: 144,
    baseHp: 180,
    attackPower: 9,
    attackRange: 100,
    attackSpeed: 1300,
    dodgeChance: 0,
    defense: 1,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"split","name":"분열","desc":"HP 0이 되면 2개로 분열 (×0.6 크기, ×0.5 HP)","trigger":"onBossDeath","effect":{"splitDepth":2,"sizeMul":0.6,"hpMul":0.5}},
  },

  // 2. 쥐떼왕 — 빠른 연속 공격
  {
    id: 'ratKing',
    name: '쥐떼왕',
    desc: '쥐떼를 이끄는 빠른 사냥꾼',
    spriteKey: '쥐',
    color: 0xC4A28F,
    size: 144,
    baseHp: 110,
    attackPower: 9,
    attackRange: 100,
    attackSpeed: 600,
    dodgeChance: 0.15,
    defense: 0,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"summon-rats","name":"쥐떼 소환","desc":"10초마다 작은 쥐 3마리 소환","trigger":"interval","triggerData":{"intervalMs":10000},"effect":{"spawnCount":3,"enemyType":"rat"}},
  },

  // 3. 거대 거미 — 회피 + 빠름
  {
    id: 'giantSpider',
    name: '거대 거미',
    desc: '독니로 빠르게 찌르는 거대 거미',
    spriteKey: '거미',
    color: 0x8B0000,
    size: 144,
    baseHp: 130,
    attackPower: 11,
    attackRange: 100,
    attackSpeed: 800,
    dodgeChance: 0.25,
    defense: 1,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"web","name":"거미줄","desc":"공격 적중 시 플레이어 1초 정지","trigger":"onHit","effect":{"stunMs":1000}},
  },

  // 4. 전갈여왕 — 강한 한 방 + 갑각
  {
    id: 'scorpionQueen',
    name: '전갈여왕',
    desc: '강력한 독침의 일격',
    spriteKey: '전갈',
    color: 0xFF6B35,
    size: 144,
    baseHp: 140,
    attackPower: 17,
    attackRange: 100,
    attackSpeed: 1500,
    dodgeChance: 0.05,
    defense: 4,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"poison","name":"독","desc":"공격 적중 시 DOT 누적 (-2%/초, 5초)","trigger":"onHit","effect":{"dotPercent":2,"dotDurationMs":5000,"stackable":true}},
  },

  // 5. 드워프왕 — 단단한 탱커
  {
    id: 'dwarfKing',
    name: '드워프왕',
    desc: '두꺼운 갑옷의 산악 군주',
    spriteKey: '드워프',
    color: 0x808080,
    size: 144,
    baseHp: 220,
    attackPower: 11,
    attackRange: 100,
    attackSpeed: 1500,
    dodgeChance: 0,
    defense: 8,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"iron-armor","name":"단단한 갑옷","desc":"보스 받는 데미지 -40%, 플레이어 치명타 무효","trigger":"onWaveStart","effect":{"damageReduction":0.4,"critImmune":true}},
  },

  // 6. 유령왕 — 매우 높은 회피
  {
    id: 'ghostKing',
    name: '유령왕',
    desc: '실체 없는 망령의 군주',
    spriteKey: '유령',
    color: 0xCCCCFF,
    size: 144,
    baseHp: 110,
    attackPower: 11,
    attackRange: 100,
    attackSpeed: 1100,
    dodgeChance: 0.45,
    defense: 0,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"evasion-master","name":"회피 마스터","desc":"HP 50%↓ 시 보스 회피 50%","trigger":"onBossHpThreshold","triggerData":{"hpThreshold":0.5},"effect":{"bossDodge":0.5}},
  },

  // 7. 두목 — 거친 폭딜
  {
    id: 'thug',
    name: '두목',
    desc: '거친 한 방을 휘두르는 두목',
    spriteKey: '대머리',
    color: 0xC74343,
    size: 144,
    baseHp: 150,
    attackPower: 14,
    attackRange: 100,
    attackSpeed: 1200,
    dodgeChance: 0,
    defense: 2,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"intimidate","name":"위압","desc":"7~10초마다 3초간 플레이어 방어 -50%","trigger":"interval","triggerData":{"intervalMinMs":7000,"intervalMaxMs":10000,"durationMs":3000},"effect":{"defenseReduction":0.5}},
  },

  // 8. 흑기사 — 빠른 공격 + 약간 회피
  {
    id: 'blackKnight',
    name: '흑기사',
    desc: '검은 갑옷의 기민한 검사',
    spriteKey: '하급 기사',
    color: 0x202020,
    size: 144,
    baseHp: 130,
    attackPower: 12,
    attackRange: 100,
    attackSpeed: 900,
    dodgeChance: 0.10,
    defense: 5,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"honor-duel","name":"명예 결투","desc":"플레이어 회피 0, 이속 0","trigger":"onWaveStart","effect":{"dodgeOverride":0,"moveSpeedOverride":0}},
  },

  // 9. 검투사 — 균형형
  {
    id: 'gladiator',
    name: '검투사',
    desc: '경기장의 노련한 강자',
    spriteKey: '중급 기사',
    color: 0xC9A227,
    size: 144,
    baseHp: 150,
    attackPower: 13,
    attackRange: 100,
    attackSpeed: 1100,
    dodgeChance: 0.15,
    defense: 5,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"double-edged","name":"양날의 검","desc":"플레이어/보스 양쪽 데미지 +30%","trigger":"onWaveStart","effect":{"playerDamageMul":1.3,"bossDamageMul":1.3}},
  },

  // 10. 야만인 두목 — 강한 공격력
  {
    id: 'barbarianChief',
    name: '야만인 두목',
    desc: '부족을 이끄는 강력한 전사',
    spriteKey: '중급 야만인',
    color: 0xA34A28,
    size: 144,
    baseHp: 160,
    attackPower: 15,
    attackRange: 100,
    attackSpeed: 1300,
    dodgeChance: 0,
    defense: 3,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"berserker","name":"광폭화","desc":"HP 50%↓ 시 보스 공격 ×2","trigger":"onBossHpThreshold","triggerData":{"hpThreshold":0.5},"effect":{"bossAttackMul":2}},
  },

  // 11. 대마녀 — 매우 빠른 마법 연사
  {
    id: 'archWitch',
    name: '대마녀',
    desc: '쉴 새 없는 마법 연사',
    spriteKey: '마녀',
    color: 0xFFE066,
    size: 144,
    baseHp: 110,
    attackPower: 9,
    attackRange: 100,
    attackSpeed: 600,
    dodgeChance: 0.10,
    defense: 1,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"sin-seal","name":"신과의 단절","desc":"시너지 비활성, 단일 카드 효과만 작동","trigger":"onWaveStart","effect":{"synergyDisabled":true}},
  },

  // 12. 대마법사 — 균형 강자
  {
    id: 'archMage',
    name: '대마법사',
    desc: '모든 마법을 다루는 균형 강자',
    spriteKey: '마법사',
    color: 0x4B0082,
    size: 144,
    baseHp: 150,
    attackPower: 14,
    attackRange: 100,
    attackSpeed: 1200,
    dodgeChance: 0.20,
    defense: 2,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"time-warp","name":"시간 왜곡","desc":"플레이어 공속 -40%, 보스 공속 +40%","trigger":"onWaveStart","effect":{"playerAttackSpeedMul":1.4,"bossAttackSpeedMul":0.6}},
  },

  // 13. 성기사 — 빛나는 균형형 강자 (판금)
  {
    id: 'paladin',
    name: '성기사',
    desc: '빛나는 갑옷의 균형 잡힌 강자',
    spriteKey: '상급 기사',
    color: 0xE0E0FF,
    size: 144,
    baseHp: 170,
    attackPower: 13,
    attackRange: 100,
    attackSpeed: 1200,
    dodgeChance: 0.05,
    defense: 7,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"false-divinity","name":"거짓된 신성","desc":"전투 시작 5초간 모든 회복 무효","trigger":"onWaveStart","triggerData":{"durationMs":5000},"effect":{"healingDisabled":true}},
  },

  // 14. 광전사 — 한 방이 치명적 (갑옷 없음)
  {
    id: 'berserker',
    name: '광전사',
    desc: '한 방이 치명적인 광전사',
    spriteKey: '상급 야만인',
    color: 0xFF4500,
    size: 144,
    baseHp: 140,
    attackPower: 19,
    attackRange: 100,
    attackSpeed: 1500,
    dodgeChance: 0,
    defense: 1,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"savage-leech","name":"야만의 흡혈","desc":"보스 적중 시 가한 데미지의 30% HP 회복","trigger":"onHit","effect":{"bossLifestealRatio":0.3}},
  },

  // 15. 거인 — 거대 HP + 두꺼운 가죽
  {
    id: 'titan',
    name: '거인',
    desc: '거대한 체력 주머니, 느린 공격',
    spriteKey: '거인',
    color: 0x808080,
    size: 144,
    baseHp: 280,
    attackPower: 9,
    attackRange: 100,
    attackSpeed: 1800,
    dodgeChance: 0,
    defense: 8,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"gigantic","name":"거대화","desc":"sprite ×2, HP ×1.5, 플레이어 시거리 -30%","trigger":"onWaveStart","effect":{"spriteScale":2,"hpMul":1.5,"playerRangeMul":0.7}},
  },

  // 16. 타락한 대마법사 — 어둠의 군주
  {
    id: 'darkLord',
    name: '타락한 대마법사',
    desc: '엄청난 체력과 어둠의 마법',
    spriteKey: '타락한 마법사',
    color: 0x6E1B1B,
    size: 144,
    baseHp: 320,
    attackPower: 15,
    attackRange: 100,
    attackSpeed: 1500,
    dodgeChance: 0.10,
    defense: 3,
    expReward: 150,
    goldReward: 180,
    debuff: {"id":"darkness","name":"어둠","desc":"플레이어 명중 -30%, 화면 어두움","trigger":"onWaveStart","effect":{"accuracyReduction":0.3,"screenDarken":0.4}},
  },
];

// (Phase G — 옛 getBossForStage(stage) 함수 제거됨. 스테이지 → 보스 고정 매핑 폐지.
// WaveSystem._pickRandomBoss() 가 bossTypes 풀에서 무작위 추첨 — 한 스테이지 안 중복 X.)
// admin 오버라이드 머지 헬퍼 (선택사용 — 현재 호출처 X, 향후 어드민 편집기 보존용)
export function applyBossOverride(bossType) {
  if (!bossType) return bossType;
  const override = getBossOverrides()[bossType.id];
  return override ? { ...bossType, ...override } : bossType;
}
