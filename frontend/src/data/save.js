// 게임 진행 세이브/로드
// localStorage에 게임 상태를 저장. 웨이브 전환마다 호출됨.
//
// 세이브 시점:
//   - 다음 웨이브 진입 직전 (WaveSystem.proceedToNextWave)
//
// 세이브 정리 시점:
//   - 게임 클리어
//   - 게임 오버 (다시 플레이하려면 처음부터)
//   - "새 게임" 메뉴 선택

export const SAVE_KEY = 'false-hero-save';
export const PROGRESS_KEY = 'falseHero.clearedStages';   // StageScene 의 클리어 진행도
export const LAST_DIFF_KEY = 'falseHero.lastDifficulty'; // StageScene 마지막 난이도 탭 (UX 상태)
// 구 키 → 신 키 마이그레이션 (한 번만 실행)
try {
  const old = localStorage.getItem('first-game-save');
  if (old && !localStorage.getItem(SAVE_KEY)) {
    localStorage.setItem(SAVE_KEY, old);
  }
} catch {}
// Phase G — 옛 세이브 자동 폐기. 5웨이브/하드코드 보스 매핑 룰 → 6/10웨이브 + 챕터 디버프.
// [Phase P-44c] 2 → 3 — 6/10 분기 폐기, 1~10스 모두 10 웨이브 통일. 옛 wave=6 보존본 W1 재시작.
// [Phase P-52]  3 → 4 — 저장 시점 스테이지 클리어 시만, buildSaveState 의 wave 필드 제거.
const SAVE_VERSION = 4;

// 게임 상태 저장
export function saveGame(state) {
  try {
    const data = { ...state, version: SAVE_VERSION };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // quota exceeded / 시크릿 모드 등 — 게임은 안 멈추되, 콘솔에 명확히 남김.
    console.warn('[saveGame] failed — storage full or unavailable:', e && e.message);
  }
}

// 저장된 게임 상태 불러오기 (없으면 null)
//   - JSON parse 실패 / null / 비-object / 배열 → null
//   - 버전이 더 높은 (다운그레이드) → null 반환하되 세이브는 보존 (자동 wipe 방지)
//   - 버전이 더 낮은 (옛 세이브) → null 반환 + clearSave 호출 가능 (현재 미사용)
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }
    let data;
    try { data = JSON.parse(raw); }
    catch { console.log('[loadGame] JSON parse failed'); return null; }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      console.log('[loadGame] data is not a plain object');
      return null;
    }
    if (!Number.isInteger(data.version)) {
      console.log('[loadGame] missing/invalid version field');
      return null;
    }
    if (data.version > SAVE_VERSION) {
      // 다운그레이드 — 세이브 wipe 금지 (다음 saveGame 가 덮어쓰지 않게 호출 측이 결정).
      console.warn('[loadGame] save is newer than build:', data.version, '>', SAVE_VERSION, '- preserving raw save');
      return null;
    }
    if (data.version < SAVE_VERSION) {
      console.log('[loadGame] older version, dropping:', data.version, '<', SAVE_VERSION);
      return null;
    }
    // 슬롯 키 마이그레이션 — 구 'neck'/'ear' → 신 'accessory'/'shield'
    // 신 키가 비어있을 때만 이전 (덮어쓰기 방지)
    if (data.equipment) {
      const eq = data.equipment;
      if (eq.neck && !eq.accessory) eq.accessory = eq.neck;
      if (eq.ear  && !eq.shield)    eq.shield    = eq.ear;
      delete eq.neck;
      delete eq.ear;
    }
    return data;
  } catch (e) {
    console.log('[loadGame] threw:', e);
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  // 진행 중 게임 + 스테이지 클리어 진행도 + 마지막 난이도 탭 정리.
  // (settings/unlocks/dev/admin 키는 보존)
  const removed = [];
  try {
    [SAVE_KEY, PROGRESS_KEY, LAST_DIFF_KEY].forEach(key => {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        removed.push(key);
      }
    });
  } catch {
    // 시크릿 모드 등 무시
  }
  console.log('[clearSave] keys removed:', removed);
}
