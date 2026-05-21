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

import { gameSettings } from './settings.js';
import { LEVEL_COSTS, MAX_LEVEL } from './loadoutUpgrades.js';

const DIAMOND_KEY = 'false-hero-diamonds';
const DEV_DIAMONDS = 7777777;

const EMPTY_SLOT_LEVELS = { head: 0, accessory: 0, body: 0, shield: 0, hands: 0, arms: 0, legs: 0, feet: 0 };

const DEFAULT_STATE = {
  total: 0,
  spent: 0,
  upgrades: {
    startGold:   false,
    startCard:   false,
    startRevive: false,
  },
  slotLevels: { ...EMPTY_SLOT_LEVELS },   // Phase P-55 — 슬롯 강화 시스템
  challenges: {},
};

const _emptyState = () => ({
  ...DEFAULT_STATE,
  upgrades:   { ...DEFAULT_STATE.upgrades },
  slotLevels: { ...EMPTY_SLOT_LEVELS },
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

// 한 단계 강화 시도. 성공 시 true, 실패 시 false (비용 부족 / 만렙).
export function upgradeSlot(slot) {
  const state = _read();
  if (!(slot in state.slotLevels)) return false;
  const curLv = state.slotLevels[slot];
  if (curLv >= MAX_LEVEL) return false;
  const cost = LEVEL_COSTS[curLv + 1];
  const isDev = !!(gameSettings && gameSettings.testMode);
  if (!isDev && state.total < cost) return false;
  state.slotLevels[slot] = curLv + 1;
  if (!isDev) { state.total -= cost; state.spent += cost; }
  _write(state);
  return true;
}

// === 데브 / 디버그 ===

export function devResetPurchases() {
  const state = _read();
  state.upgrades   = { startGold: false, startCard: false, startRevive: false };
  state.slotLevels = { ...EMPTY_SLOT_LEVELS };
  _write(state);
}

export function resetDiamonds() {
  try { localStorage.removeItem(DIAMOND_KEY); } catch {}
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
