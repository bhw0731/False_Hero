// 💎 다이아 — 영구 화폐 (게임 외부 진행, 새 게임/게임오버에도 보존)
//
// 획득:
//   서브보스 처치   +1 💎
//   메인보스 처치   +3 💎
//   챕터 첫 클리어  +50 💎
//   챕터 재클리어   +10 💎
//
// 영구 강화:
//   startGold / startCard / startRevive  — 시작 보너스 토글
//   slotLevels[slot]                     — 8 슬롯 강화 (Lv 0~10), data/loadoutUpgrades.js 참조

import { gameSettings } from '../settings.js';
import {
  LEVEL_COSTS, MAX_LEVEL, getSuccessRate,
  AWAKEN_TIER_MAX, getAwakenSuccessRate, getAwakenCost,
} from './loadoutUpgrades.js';
import { getMaterial, spendMaterial } from './materials.js';

const DIAMOND_KEY = 'false-hero-diamonds';
const DEV_DIAMONDS = 7777777;

const EMPTY_SLOT_LEVELS = { head: 0, accessory: 0, body: 0, shield: 0, hands: 0, arms: 0, legs: 0, feet: 0 };
const EMPTY_FAIL_STREAK = { head: 0, accessory: 0, body: 0, shield: 0, hands: 0, arms: 0, legs: 0, feet: 0 };
const EMPTY_SLOT_AWAKEN = { head: 0, accessory: 0, body: 0, shield: 0, hands: 0, arms: 0, legs: 0, feet: 0 };

const DEFAULT_STATE = {
  total: 0,
  spent: 0,
  upgrades: {
    startGold:   false,
    startCard:   false,
    startRevive: false,
  },
  slotLevels: { ...EMPTY_SLOT_LEVELS },   // Phase P-55 — 슬롯 강화 시스템
  slotFails:  { ...EMPTY_FAIL_STREAK },   // [P-65] 슬롯별 연속 실패 (천장).
  slotAwaken: { ...EMPTY_SLOT_AWAKEN },   // [P-68] 슬롯별 각성/초월 단계 (0~10).
  challenges: {},
};

const _emptyState = () => ({
  ...DEFAULT_STATE,
  upgrades:   { ...DEFAULT_STATE.upgrades },
  slotLevels: { ...EMPTY_SLOT_LEVELS },
  slotFails:  { ...EMPTY_FAIL_STREAK },
  slotAwaken: { ...EMPTY_SLOT_AWAKEN },
});
const _isPlainObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function _sanitizeSlotLevels(raw) {
  if (!_isPlainObj(raw)) return { ...EMPTY_SLOT_LEVELS };
  const out = { ...EMPTY_SLOT_LEVELS };
  for (const k of Object.keys(EMPTY_SLOT_LEVELS)) {
    const v = raw[k];
    if (Number.isInteger(v) && v >= 0 && v <= MAX_LEVEL) out[k] = v;
  }
  return out;
}

function _sanitizeFailStreak(raw) {
  if (!_isPlainObj(raw)) return { ...EMPTY_FAIL_STREAK };
  const out = { ...EMPTY_FAIL_STREAK };
  for (const k of Object.keys(EMPTY_FAIL_STREAK)) {
    const v = raw[k];
    if (Number.isInteger(v) && v >= 0) out[k] = v;
  }
  return out;
}

function _sanitizeSlotAwaken(raw) {
  if (!_isPlainObj(raw)) return { ...EMPTY_SLOT_AWAKEN };
  const out = { ...EMPTY_SLOT_AWAKEN };
  for (const k of Object.keys(EMPTY_SLOT_AWAKEN)) {
    const v = raw[k];
    if (Number.isInteger(v) && v >= 0 && v <= AWAKEN_TIER_MAX) out[k] = v;
  }
  return out;
}

function _read() {
  try {
    const raw = localStorage.getItem(DIAMOND_KEY);
    if (!raw) return _emptyState();
    let data;
    try { data = JSON.parse(raw); } catch { return _emptyState(); }
    if (!_isPlainObj(data)) return _emptyState();
    return {
      total:       Number.isFinite(data.total) ? data.total : 0,
      spent:       Number.isFinite(data.spent) ? data.spent : 0,
      upgrades:    _isPlainObj(data.upgrades)   ? { ...DEFAULT_STATE.upgrades, ...data.upgrades } : { ...DEFAULT_STATE.upgrades },
      slotLevels:  _sanitizeSlotLevels(data.slotLevels),
      slotFails:   _sanitizeFailStreak(data.slotFails),
      slotAwaken:  _sanitizeSlotAwaken(data.slotAwaken),
      challenges:  _isPlainObj(data.challenges) ? data.challenges  : {},
    };
  } catch {
    return _emptyState();
  }
}

function _write(state) {
  try { localStorage.setItem(DIAMOND_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('[diamonds._write] failed:', e && e.message); }
}

// === 다이아 잔액 ===

export function getDiamonds() {
  if (gameSettings && gameSettings.testMode) return DEV_DIAMONDS;
  return _read().total;
}

export function addDiamonds(amount, reason = '') {
  if (!amount || amount <= 0) return 0;
  const state = _read();
  state.total += amount;
  _write(state);
  console.log(`[💎] +${amount} (${reason || 'unknown'}) → total ${state.total}`);
  return state.total;
}

export function spendDiamonds(amount) {
  if (!amount || amount <= 0) return false;
  if (gameSettings && gameSettings.testMode) return true;
  const state = _read();
  if (state.total < amount) return false;
  state.total -= amount;
  state.spent += amount;
  _write(state);
  return true;
}

// === 시작 보너스 (startGold / startCard / startRevive) ===

export function getUpgrades() {
  return _read().upgrades;
}

export function buyUpgrade(upgradeId, cost) {
  const state = _read();
  if (state.upgrades[upgradeId]) return false;
  const isDev = !!(gameSettings && gameSettings.testMode);
  if (!isDev && state.total < cost) return false;
  state.upgrades[upgradeId] = true;
  if (!isDev) { state.total -= cost; state.spent += cost; }
  _write(state);
  return true;
}

export function isUpgradeOwned(upgradeId) {
  return !!_read().upgrades[upgradeId];
}

// === 슬롯 강화 (Phase P-55) ===

export function getSlotLevels() {
  return { ..._read().slotLevels };
}

export function getSlotLevel(slot) {
  return _read().slotLevels[slot] || 0;
}

export function getSlotFailStreak(slot) {
  return (_read().slotFails || {})[slot] || 0;
}

// [P-65] 다음 강화 정보 — UI 표시용 (성공률). 천장 없음 (순수 확률).
export function getUpgradeOdds(slot) {
  const state = _read();
  const curLv = (state.slotLevels || {})[slot] || 0;
  if (curLv >= MAX_LEVEL) return { rate: 0, isMax: true, pity: false, fails: 0 };
  return { rate: getSuccessRate(curLv), isMax: false, pity: false, fails: 0 };
}

// 한 단계 강화 시도 — [P-65] 확률 (소프트, 천장 없음).
//   반환: { ok, success, reason }.
//     ok      — 시도 자체가 유효 (비용 충분 + 만렙 아님).
//     success — 강화 성공 여부 (실패해도 레벨 유지, 다이아만 소모).
//   reason: 'maxlevel' | 'insufficient' | 'invalid' (ok=false 일 때).
export function upgradeSlot(slot) {
  const state = _read();
  if (!(slot in state.slotLevels)) return { ok: false, success: false, reason: 'invalid' };
  const curLv = state.slotLevels[slot];
  if (curLv >= MAX_LEVEL) return { ok: false, success: false, reason: 'maxlevel' };
  const cost = LEVEL_COSTS[curLv + 1];
  const isDev = !!(gameSettings && gameSettings.testMode);
  if (!isDev && state.total < cost) return { ok: false, success: false, reason: 'insufficient' };

  // 비용 소모 (성공/실패 무관 — 소프트). 데브는 차감 X.
  if (!isDev) { state.total -= cost; state.spent += cost; }

  // 성공 확률 — 데브 모드여도 실제 확률 적용 (확률 체감 테스트용). 비용만 무제한.
  const success = Math.random() < getSuccessRate(curLv);
  if (success) state.slotLevels[slot] = curLv + 1;
  _write(state);
  return { ok: true, success, reason: null };
}

// === 각성(★) / 초월(✦) [P-68] ===
//   awakenTier 0~10:  1~5 = ★,  6~10 = ✦.  Lv10(MAX_LEVEL) 풀강 슬롯만 가능.
//   재료(각성석/초월석) 소모, 확률 도박, 실패 시 단계 1 하락 (최저 0).

export function getSlotAwaken(slot) {
  return (_read().slotAwaken || {})[slot] || 0;
}

export function getSlotAwakenAll() {
  return { ...(_read().slotAwaken || EMPTY_SLOT_AWAKEN) };
}

// 다음 각성/초월 시도 정보 — UI 표시용.
//   반환: { canAwaken, isMax, curTier, rate, cost:{id,amount}, have, reason }.
//     canAwaken — 시도 가능 (Lv10 + 만렙 아님 + 재료 충분 / 데브).
//     reason   — 불가 사유: 'notmaxlevel' | 'maxtier' | 'insufficient'.
export function getAwakenOdds(slot) {
  const state = _read();
  const lv = (state.slotLevels || {})[slot] || 0;
  const curTier = (state.slotAwaken || {})[slot] || 0;
  const isDev = !!(gameSettings && gameSettings.testMode);

  if (lv < MAX_LEVEL) {
    return { canAwaken: false, isMax: false, curTier, rate: 0, cost: null, have: 0, reason: 'notmaxlevel' };
  }
  if (curTier >= AWAKEN_TIER_MAX) {
    return { canAwaken: false, isMax: true, curTier, rate: 0, cost: null, have: 0, reason: 'maxtier' };
  }
  const cost = getAwakenCost(curTier);
  const have = cost ? getMaterial(cost.id) : 0;
  const enough = isDev || (cost && have >= cost.amount);
  return {
    canAwaken: enough,
    isMax: false,
    curTier,
    rate: getAwakenSuccessRate(curTier),
    cost,
    have,
    reason: enough ? null : 'insufficient',
  };
}

// 한 단계 각성/초월 시도 — 확률 도박 (소프트 실패: 재료만 소모, 단계 유지).
//   반환: { ok, success, reason, newTier }.
//     ok      — 시도 자체가 유효 (Lv10 + 만렙 아님 + 재료 충분).
//     success — 성공 여부. 성공 시 tier+1, 실패 시 단계 유지 (차감 X).
//   reason: 'notmaxlevel' | 'maxtier' | 'insufficient' | 'invalid' (ok=false 일 때).
export function upgradeSlotAwaken(slot) {
  const state = _read();
  if (!(slot in state.slotAwaken)) return { ok: false, success: false, reason: 'invalid', newTier: 0 };
  const lv = state.slotLevels[slot] || 0;
  if (lv < MAX_LEVEL) return { ok: false, success: false, reason: 'notmaxlevel', newTier: state.slotAwaken[slot] };
  const curTier = state.slotAwaken[slot];
  if (curTier >= AWAKEN_TIER_MAX) return { ok: false, success: false, reason: 'maxtier', newTier: curTier };

  const cost = getAwakenCost(curTier);
  const isDev = !!(gameSettings && gameSettings.testMode);

  // 재료 소모 (성공/실패 무관 — 소프트). 데브는 차감 X.
  if (!isDev) {
    if (!cost || getMaterial(cost.id) < cost.amount) {
      return { ok: false, success: false, reason: 'insufficient', newTier: curTier };
    }
    spendMaterial(cost.id, cost.amount);
  }

  // 성공 확률 — 데브여도 실제 확률 적용 (재료만 무제한).
  const success = Math.random() < getAwakenSuccessRate(curTier);
  // 성공 시에만 단계 상승. 실패해도 단계 유지 (재료만 소모) — 강화와 동일한 소프트 방식.
  if (success) state.slotAwaken[slot] = curTier + 1;
  _write(state);
  return { ok: true, success, reason: null, newTier: state.slotAwaken[slot] };
}

// === 데브 / 디버그 ===

export function devResetPurchases() {
  const state = _read();
  state.upgrades   = { startGold: false, startCard: false, startRevive: false };
  state.slotLevels = { ...EMPTY_SLOT_LEVELS };
  state.slotFails  = { ...EMPTY_FAIL_STREAK };
  state.slotAwaken = { ...EMPTY_SLOT_AWAKEN };
  _write(state);
}

export function resetDiamonds() {
  try { localStorage.removeItem(DIAMOND_KEY); } catch {}
}

// [DEV] 슬롯을 즉시 Lv10 풀강 — 각성/초월 테스트용.
export function devMaxSlot(slot) {
  const state = _read();
  if (!(slot in state.slotLevels)) return;
  state.slotLevels[slot] = MAX_LEVEL;
  _write(state);
}

// === 장비 시스템 잠금 ===
// 1챕터 진행 중엔 장비 시스템 전체 비활성. 2챕터 첫 도달 (chapterClearCount ≥ 1) 시 활성.
// 데브 모드 (testMode) 시 무조건 활성 — 테스트 편의.
export function isEquipmentUnlocked() {
  if (gameSettings && gameSettings.testMode) return true;
  let count = 0;
  try { count = parseInt(localStorage.getItem('falseHero.chapterClearCount') || '0', 10); }
  catch {}
  return count >= 1;
}

// === Deprecated APIs (호환 stub) ===
// 옛 코드가 임포트해도 즉시 깨지지 않게 빈 구현 유지. 새 시스템으론 slot 강화 사용.
export function getItemPrice() { return 0; }
export function isItemOwned()   { return false; }
export function getOwnedItems() { return []; }
export function buyItem()       { return false; }
export function getLoadout()    { return { ...EMPTY_SLOT_LEVELS }; }   // 슬롯 키만 노출 — UI 호환.
export function setLoadoutSlot() {}
