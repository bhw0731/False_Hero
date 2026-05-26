// ⭐ 스테이지별 3성 평가 + 누적 별 보상 상자(🎁) — 전 챕터(1/2/3) 공통.
//
//   - 저장은 클리어 진행도(PROGRESS_KEY)와 분리된 별도 키 + 챕터(난이도)별 버킷.
//   - 별/상자는 영구 메타 진행 (다이아처럼 새 게임/게임오버에도 보존). 별은 최고 기록만 갱신.
//   - 챕터별 독립: normal/hard/veryHard 각각 별 0~30 + 상자 3개를 따로 관리.
//
// 별 기준 (HP 기준 — 클리어 순간 남은 HP%):
//   ★      클리어
//   ★★     클리어 + 남은 HP ≥ 50%
//   ★★★    클리어 + 남은 HP ≥ 90%
//
// 보상 상자 (누적 별 도달 시 개봉 가능 → 탭해서 💎 수령. 자동 지급 아님):
//   ★ 10개 → 🎁 💎30   ·   ★ 20개 → 🎁 💎60   ·   ★ 30개 → 🎁 💎120

import { addDiamonds } from './diamonds.js';
import { gameSettings, DIFFICULTY_ORDER } from '../settings.js';

// 호환용 — 옛 'STAR_CHAPTER' 참조처(WaveSystem._isArena 등 아레나 모드)는 여전히 'hard' 기준.
export const STAR_CHAPTER = 'hard';
export const STAGES_PER_CHAPTER = 10;
export const MAX_STARS_PER_STAGE = 3;
export const MAX_TOTAL_STARS = STAGES_PER_CHAPTER * MAX_STARS_PER_STAGE;   // 30

// HP% 임계치 (UI 안내 텍스트에서도 재사용).
export const STAR_HP_THRESHOLDS = { three: 0.90, two: 0.50 };

// 누적 별 보상 상자 — { need: 누적별, reward: 💎 }. (수동 개봉, 챕터별 독립)
export const STAR_CHESTS = [
  { need: 10, reward: 30 },
  { need: 20, reward: 60 },
  { need: 30, reward: 120 },
];

const KEY = 'falseHero.chapterStars';

const _isPlainObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// 난이도 정규화 — 인자 없으면 현재 진행 중 난이도. 유효하지 않으면 'normal'.
function _diff(d) {
  const v = d || (gameSettings && gameSettings.difficulty) || 'normal';
  return DIFFICULTY_ORDER.includes(v) ? v : 'normal';
}

// 저장 구조: { normal: { stars:{'1':3,...}, opened:[10,20] }, hard:{...}, veryHard:{...} }
function _readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return _isPlainObj(data) ? data : {};
  } catch {
    return {};
  }
}

// 특정 챕터(난이도) 버킷 읽기 — { stars, opened }.
function _read(diff) {
  const ch = _readAll()[_diff(diff)];
  const src = _isPlainObj(ch) ? ch : {};
  const stars = {};
  if (_isPlainObj(src.stars)) {
    for (let s = 1; s <= STAGES_PER_CHAPTER; s++) {
      const v = src.stars[s];
      if (Number.isInteger(v) && v >= 1 && v <= MAX_STARS_PER_STAGE) stars[s] = v;
    }
  }
  const opened = Array.isArray(src.opened) ? src.opened.filter(n => Number.isInteger(n)) : [];
  return { stars, opened };
}

function _write(diff, state) {
  try {
    const all = _readAll();
    all[_diff(diff)] = state;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('[chapterStars._write] failed:', e && e.message);
  }
}

// === 별 계산 — 클리어 순간 남은 HP 비율(0~1) → 별 개수(1~3) ===
export function computeStars(hpRatio) {
  const r = Math.max(0, Math.min(1, hpRatio || 0));
  if (r >= STAR_HP_THRESHOLDS.three) return 3;
  if (r >= STAR_HP_THRESHOLDS.two)   return 2;
  return 1;
}

// === 조회 (diff 생략 시 현재 난이도) ===
export function getStageStars(stage, diff) {
  return _read(diff).stars[stage] || 0;
}

export function getAllStageStars(diff) {
  return { ..._read(diff).stars };
}

export function getTotalStars(diff) {
  const stars = _read(diff).stars;
  let total = 0;
  for (let s = 1; s <= STAGES_PER_CHAPTER; s++) total += (stars[s] || 0);
  return total;
}

// === 기록 — 최고 기록만 갱신 (재도전으로 더 높은 별 획득 시 상승, 하락 X) ===
//   반환: { stars: 적용된 최고 별, prev: 이전 별, improved: 갱신 여부 }
export function recordStageStars(stage, stars, diff) {
  const s = Math.max(1, Math.min(MAX_STARS_PER_STAGE, stars | 0));
  const state = _read(diff);
  const prev = state.stars[stage] || 0;
  if (s <= prev) return { stars: prev, prev, improved: false };
  state.stars[stage] = s;
  _write(diff, state);
  return { stars: s, prev, improved: true };
}

// === 보상 상자 ===
export const CHEST_STATE = { LOCKED: 'locked', OPENABLE: 'openable', OPENED: 'opened' };

export function getChests() {
  return STAR_CHESTS.map(c => ({ ...c }));
}

export function getOpenedChests(diff) {
  return [..._read(diff).opened];
}

// 상자 상태 — 'opened'(수령완료) | 'openable'(개봉 가능) | 'locked'(별 부족).
export function getChestState(need, diff) {
  const state = _read(diff);
  if (state.opened.includes(need)) return CHEST_STATE.OPENED;
  return getTotalStars(diff) >= need ? CHEST_STATE.OPENABLE : CHEST_STATE.LOCKED;
}

// 개봉 가능(도달했지만 미수령) 상자 목록 — 클리어 모달 힌트용.
export function getOpenableChests(diff) {
  return STAR_CHESTS.filter(c => getChestState(c.need, diff) === CHEST_STATE.OPENABLE);
}

// 상자 열기 — 개봉 가능할 때만 💎 지급 + 수령 표시. 반환: 지급된 reward (불가 시 0).
export function openChest(need, diff) {
  const def = STAR_CHESTS.find(c => c.need === need);
  if (!def) return 0;
  const state = _read(diff);
  if (state.opened.includes(need)) return 0;          // 이미 수령.
  if (getTotalStars(diff) < need) return 0;           // 아직 별 부족.
  addDiamonds(def.reward, `star-chest:${_diff(diff)}:${need}`);
  state.opened.push(need);
  _write(diff, state);
  return def.reward;
}

// 데브/디버그 — 전 챕터 별/상자 기록 초기화.
export function resetChapterStars() {
  try { localStorage.removeItem(KEY); } catch {}
}
