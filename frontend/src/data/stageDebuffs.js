// 스테이지 디버프 — Phase G.
// 옛 "보스 디버프" 시스템 (data/bosses.js 의 boss.debuff) 을 분리.
// 16 디버프 풀에서 챕터 시작 시 10개 비복원 추첨 → chapterDebuffs[1..10].
// 디버프는 보스 종류와 무관 — 그 스테이지에 묶임.
//
// 트리거 5종 (BossDebuffSystem 이 처리):
//   onWaveStart           보스 등장 직후 즉시 발동
//   onHit                 보스 공격 적중 시
//   onBossHpThreshold     보스 HP 비율 도달 (1회)
//   interval              주기적 (intervalMs / intervalMin~Max)
//   onBossDeath           보스 사망 시 (분열용)
//
// 발동 / 해제 룰 (Phase G):
//   서브보스 등장 + 메인보스 등장 모두에서 발동.
//   각 보스 사망 시 즉시 해제 (DOT/오버레이/시간누적 모두 강제 종료).
//   같은 스테이지 안 보스 여러 마리 — 각자 발동/해제 반복.

export const DEBUFF_POOL = [
  {
    id: 'split', desc: '보스 사망 시 ×2 자식 생성 (×0.6 크기, ×0.5 HP)',
    trigger: 'onBossDeath', effect: { splitDepth: 2, sizeMul: 0.6, hpMul: 0.5 },
  },
  {
    id: 'summon-rats', desc: '10초마다 쥐 3마리 소환',
    trigger: 'interval', triggerData: { intervalMs: 10000 },
    effect: { spawnCount: 3, enemyType: 'rat' },
  },
  {
    id: 'web', desc: '보스 공격 적중 시 플레이어 1초 정지',
    trigger: 'onHit', effect: { stunMs: 1000 },
  },
  {
    id: 'poison', desc: '보스 공격 적중 시 초당 2% 피해 (5초, 중첩)',
    trigger: 'onHit', effect: { dotPercent: 2, dotDurationMs: 5000, stackable: true },
  },
  {
    id: 'iron-armor', desc: '보스가 받는 피해 -40%, 치명타 무효',
    trigger: 'onWaveStart', effect: { damageReduction: 0.4, critImmune: true },
  },
  {
    id: 'evasion-master', desc: '보스 HP 50% 이하 시 회피 50%',
    trigger: 'onBossHpThreshold', triggerData: { hpThreshold: 0.5 },
    effect: { bossDodge: 0.5 },
  },
  {
    id: 'intimidate', desc: '7~10초마다 3초간 플레이어 피해 감소 -50%',
    trigger: 'interval', triggerData: { intervalMinMs: 7000, intervalMaxMs: 10000, durationMs: 3000 },
    effect: { defenseReduction: 0.5 },
  },
  {
    id: 'honor-duel', desc: '플레이어 회피 0',
    trigger: 'onWaveStart', effect: { dodgeOverride: 0, moveSpeedOverride: 0 },
  },
  {
    id: 'double-edged', desc: '플레이어/보스 양쪽 입히는 피해 +30%',
    trigger: 'onWaveStart', effect: { playerDamageMul: 1.3, bossDamageMul: 1.3 },
  },
  {
    id: 'berserker', desc: '보스 HP 50% 이하 시 공격 ×2',
    trigger: 'onBossHpThreshold', triggerData: { hpThreshold: 0.5 },
    effect: { bossAttackMul: 2 },
  },
  {
    id: 'sin-seal', desc: '시너지 비활성, 단일 카드만 작동',
    trigger: 'onWaveStart', effect: { synergyDisabled: true },
  },
  {
    id: 'time-warp', desc: '플레이어 공속 -40%, 보스 공속 +40%',
    trigger: 'onWaveStart', effect: { playerAttackSpeedMul: 1.4, bossAttackSpeedMul: 0.6 },
  },
  {
    id: 'false-divinity', desc: '5초간 회복 무효',
    trigger: 'onWaveStart', triggerData: { durationMs: 5000 }, effect: { healingDisabled: true },
  },
  {
    id: 'savage-leech', desc: '보스가 가한 피해의 30%를 회복',
    trigger: 'onHit', effect: { bossLifestealRatio: 0.3 },
  },
  {
    id: 'gigantic', desc: '보스 크기 ×2, HP ×1.5',
    trigger: 'onWaveStart', effect: { spriteScale: 2, hpMul: 1.5, playerRangeMul: 0.7 },
  },
  {
    id: 'darkness', desc: '플레이어 명중 -30%, 화면 어두워짐',
    trigger: 'onWaveStart', effect: { accuracyReduction: 0.3, screenDarken: 0.4 },
  },
];

// id → 디버프 객체
export function getDebuffById(id) {
  return DEBUFF_POOL.find(d => d.id === id) || null;
}

// 챕터 시작 시 10개 비복원 추첨 (16 → 10)
// 결과: stage 1~10 별 디버프 객체 — chapterDebuffs[i] = stage(i+1) 의 디버프
export function pickChapterDebuffs() {
  const pool = [...DEBUFF_POOL];
  const out = [];
  for (let i = 0; i < 10 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

// 직렬화 / 복원 — 세이브에 id 배열만 저장 → 로드 시 객체로 매핑
export function serializeChapterDebuffs(arr) {
  return (arr || []).map(d => d && d.id).filter(Boolean);
}
export function deserializeChapterDebuffs(idArr) {
  if (!Array.isArray(idArr)) return [];
  return idArr.map(id => getDebuffById(id)).filter(Boolean);
}
