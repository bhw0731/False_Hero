// 관리자 설정 — 보스 능력치 오버라이드 + 스테이지별 배경 타일 배치
// 모두 localStorage에 저장됨. 새로고침해도 유지.

const BOSS_KEY        = 'false-hero-boss-overrides';
const BG_KEY          = 'false-hero-stage-backgrounds';
const PLAYER_BASE_KEY = 'false-hero-player-base';
const ENEMY_KEY       = 'false-hero-enemy-overrides-v2';

// === 보스 오버라이드 ===
// 형태: { assassin: { baseHp: 300, attackPower: 25, ... }, titan: {...}, ... }

export function getBossOverrides() {
  try {
    const raw = localStorage.getItem(BOSS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setBossOverride(bossId, overrides) {
  try {
    const all = getBossOverrides();
    all[bossId] = overrides;
    localStorage.setItem(BOSS_KEY, JSON.stringify(all));
  } catch {}
}

export function resetBossOverride(bossId) {
  try {
    const all = getBossOverrides();
    delete all[bossId];
    localStorage.setItem(BOSS_KEY, JSON.stringify(all));
  } catch {}
}

// === 스테이지별 배경 ===
// 형태: { 1: [{ tileNum, x, y, scale }, ...], 2: [...], ... }

export function getStageBackground(stage) {
  try {
    const raw = localStorage.getItem(BG_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    return all[stage] || [];
  } catch {
    return [];
  }
}

export function setStageBackground(stage, tiles) {
  try {
    const raw = localStorage.getItem(BG_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[stage] = tiles;
    localStorage.setItem(BG_KEY, JSON.stringify(all));
  } catch {}
}

export function clearStageBackground(stage) {
  try {
    const raw = localStorage.getItem(BG_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    delete all[stage];
    localStorage.setItem(BG_KEY, JSON.stringify(all));
  } catch {}
}

// === 플레이어 기본 능력치 오버라이드 ===
// { attackPower, attackSpeed, attackRange, moveSpeed, maxHp, defense } 부분 적용

export function getPlayerBaseOverrides() {
  try {
    const raw = localStorage.getItem(PLAYER_BASE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setPlayerBaseOverrides(overrides) {
  try {
    localStorage.setItem(PLAYER_BASE_KEY, JSON.stringify(overrides));
  } catch {}
}

export function resetPlayerBaseOverrides() {
  try {
    localStorage.removeItem(PLAYER_BASE_KEY);
  } catch {}
}

// === 잡몹 능력치 오버라이드 (id 별로 저장) ===
// 형태: { slime: { baseHp: 40, ... }, goblin: { ... }, ... }

export function getEnemyOverrides() {
  try {
    const raw = localStorage.getItem(ENEMY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setEnemyOverride(enemyId, overrides) {
  try {
    const all = getEnemyOverrides();
    all[enemyId] = overrides;
    localStorage.setItem(ENEMY_KEY, JSON.stringify(all));
  } catch {}
}

export function resetEnemyOverride(enemyId) {
  try {
    const all = getEnemyOverrides();
    delete all[enemyId];
    localStorage.setItem(ENEMY_KEY, JSON.stringify(all));
  } catch {}
}
