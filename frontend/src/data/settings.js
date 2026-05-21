// 환경설정 + 난이도 시스템
// 3단계: normal / hard / veryHard — 클리어해야 다음 난이도 잠금 해제

export const gameSettings = {
  bgmVolume: 0.7,
  sfxVolume: 0.7,
  difficulty: 'normal',     // 현재 선택된 난이도
  // 화면 흔들림 — 보스 등장 등 카메라 shake 효과 켜기/끄기
  screenShake: true,
  // 테스트 모드 — 관리자 메뉴 토글. 켜면:
  //   상점 가격 컷 무시 + 골드 무제한 (구매 차감 X) + 무제한 리롤 버튼
  testMode: false,
};

const STORAGE_KEY = 'false-hero-settings';
const UNLOCK_KEY  = 'false-hero-unlocks';
// 구 키 마이그레이션
try {
  ['first-game-settings', 'first-game-unlocks'].forEach((oldK, i) => {
    const newK = i === 0 ? STORAGE_KEY : UNLOCK_KEY;
    const v = localStorage.getItem(oldK);
    if (v && !localStorage.getItem(newK)) localStorage.setItem(newK, v);
  });
} catch {}

// 챕터 순서 — 일반 모드는 ['normal'] 만. 데브 모드 시 hard/veryHard 추가 노출.
// 2/3챕터 컨텐츠는 placeholder — 1챕터와 동일 (적/보스/배경 그대로 사용, 데브 테스트용).
export const DIFFICULTY_ORDER = ['normal', 'hard', 'veryHard'];

export const difficultyLabels = {
  normal:   '1챕터',
  hard:     '2챕터',
  veryHard: '3챕터',
};

// 데브 모드 시 모든 챕터 노출, 일반은 1챕터만. StageScene 의 탭 렌더링에 사용.
export function getAvailableChapters() {
  if (gameSettings && gameSettings.testMode) return ['normal', 'hard', 'veryHard'];
  return ['normal'];
}

// 챕터별 적 HP / 공격력 배수 — 1챕터 기본
export function getDifficultyMultiplier() {
  return 1.0;
}

// 챕터별 방어력 배수
export function getDifficultyDefenseMultiplier() {
  return 1.0;
}

// === 환경설정 저장/복원 ===
export function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(gameSettings)); } catch {}
}

// 알려진 키만 허용 — 외부 편집/cheat 차단 (예: testMode injection).
const _SETTING_SCHEMA = {
  bgmVolume:   v => (typeof v === 'number' && v >= 0 && v <= 1) ? v : null,
  sfxVolume:   v => (typeof v === 'number' && v >= 0 && v <= 1) ? v : null,
  difficulty:  v => (DIFFICULTY_ORDER.includes(v)) ? v : null,
  screenShake: v => (typeof v === 'boolean') ? v : null,
  testMode:    v => (typeof v === 'boolean') ? v : null,
};

export function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    let data;
    try { data = JSON.parse(saved); } catch { return; }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return;
    for (const k in _SETTING_SCHEMA) {
      if (k in data) {
        const v = _SETTING_SCHEMA[k](data[k]);
        if (v !== null) gameSettings[k] = v;
      }
    }
  } catch {}
}

// === 챕터 잠금해제 상태 ===
// 1챕터 시스템 — normal 만 진입 가능. 추후 2/3챕터 업데이트 예정.
// 기존 hard/veryHard 잠금해제 데이터는 보존 (UNLOCK_KEY) 하지만 사용 안 함.

export function getUnlockedDifficulties() {
  // 데브 모드 — 모든 챕터 잠금 해제. 일반 — normal 만.
  if (gameSettings && gameSettings.testMode) return ['normal', 'hard', 'veryHard'];
  return ['normal'];
}

export function isDifficultyUnlocked(diffId) {
  if (gameSettings && gameSettings.testMode) return DIFFICULTY_ORDER.includes(diffId);
  return diffId === 'normal';
}

// 다음 챕터 잠금해제 — 1챕터만 있으므로 항상 null 반환 (게임 클리어 메시지에서 처리)
export function unlockNextDifficulty() {
  return null;
}

export function setDifficulty(diffId) {
  if (!isDifficultyUnlocked(diffId)) return false;
  gameSettings.difficulty = diffId;
  saveSettings();
  return true;
}
