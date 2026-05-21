// 도전과제 시스템 — 단일 배열 (3종 더미). 추후 확장 가능.
// 진행도/클리어 여부는 diamonds state.challenges 필드에 저장.
//   state.challenges = { [id]: { progress: N, cleared: bool } }

import { addDiamonds } from './diamonds.js';

// 챕터별 도전과제 — 1챕터 모두 claimed 시 자동으로 2챕터로 전환.
export const CHAPTERS = [
  {
    id: 1,
    name: '1챕터',
    items: [
      { id: 'kill_100',        name: '적 처치자',     desc: '적 100마리 처치',         icon: 'swords', target: 100, reward: 100 },
      { id: 'boss_50',         name: '보스 슬레이어', desc: '메인 보스 50마리 처치',   icon: 'skull',  target: 50,  reward: 200 },
      { id: 'chapter_1_clear', name: '첫 정복',       desc: '1챕터 클리어',            icon: 'flag',   target: 1,   reward: 300 },
    ],
  },
  {
    id: 2,
    name: '2챕터',
    items: [
      { id: 'kill_500',        name: '학살자',         desc: '적 500마리 처치',         icon: 'swords', target: 500, reward: 200 },
      { id: 'boss_200',        name: '보스 학살자',    desc: '메인 보스 200마리 처치',  icon: 'skull',  target: 200, reward: 400 },
      { id: 'chapter_2_clear', name: '두 번째 정복',   desc: '2챕터 클리어',            icon: 'flag',   target: 1,   reward: 600 },
    ],
  },
  {
    id: 3,
    name: '3챕터',
    items: [
      { id: 'kill_2000',       name: '심판자',         desc: '적 2000마리 처치',        icon: 'swords', target: 2000, reward: 400 },
      { id: 'boss_500',        name: '보스 종결자',    desc: '메인 보스 500마리 처치',  icon: 'skull',  target: 500,  reward: 800 },
      { id: 'chapter_3_clear', name: '진짜의 자리',    desc: '3챕터 클리어',            icon: 'flag',   target: 1,    reward: 1200 },
    ],
  },
];

// 평탄 배열 — 호환용 (devSetState / claimReward 등이 id 로 찾을 때 사용).
export const CHALLENGES = CHAPTERS.flatMap(ch => ch.items);

// 현재 진행 중인 챕터의 인덱스 — 아직 모든 항목 claimed 가 아닌 첫 챕터.
//   전부 완료 시 마지막 인덱스.
export function getCurrentChapterIndex() {
  const ch = _readChallenges();
  for (let i = 0; i < CHAPTERS.length; i++) {
    const allClaimed = CHAPTERS[i].items.every(it => _getEntry(ch, it.id).claimed);
    if (!allClaimed) return i;
  }
  return CHAPTERS.length - 1;
}

export function getCurrentChapter() {
  return CHAPTERS[getCurrentChapterIndex()];
}

// 챕터 인덱스로 진행도 조회 — 인자 없으면 현재 챕터.
export function getChapterProgress(idx) {
  const i = (typeof idx === 'number') ? idx : getCurrentChapterIndex();
  const chapter = CHAPTERS[i];
  if (!chapter) return { cleared: 0, total: 0 };
  const ch = _readChallenges();
  let claimed = 0;
  chapter.items.forEach(c => { if (_getEntry(ch, c.id).claimed) claimed++; });
  return { cleared: claimed, total: chapter.items.length, chapterId: chapter.id, chapterName: chapter.name };
}

const CH_KEY = 'false-hero-diamonds';

function _readChallenges() {
  try {
    const raw = localStorage.getItem(CH_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return (data && typeof data.challenges === 'object' && data.challenges) || {};
  } catch { return {}; }
}
function _writeChallenges(ch) {
  try {
    const raw = localStorage.getItem(CH_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data.challenges = ch;
    localStorage.setItem(CH_KEY, JSON.stringify(data));
  } catch (e) { console.warn('[challenges._write] failed:', e && e.message); }
}

// 도전과제 상태 ({ progress, cleared, claimed }) 조회.
//   progress: 누적 진행도. cleared: target 도달 (수령 가능). claimed: 보상 수령 완료.
//   옛 데이터 (boolean true / cleared 만) 는 claimed=true 로 마이그레이션 (이미 보상 받음 가정).
function _getEntry(ch, id) {
  const v = ch[id];
  if (v && typeof v === 'object') {
    const cleared = !!v.cleared;
    const claimed = (v.claimed != null) ? !!v.claimed : cleared;   // 옛 shape: cleared=true → claimed=true.
    return { progress: v.progress || 0, cleared, claimed };
  }
  if (v === true) return { progress: 0, cleared: true, claimed: true };
  return { progress: 0, cleared: false, claimed: false };
}

export function getChallengeProgress(id) {
  return _getEntry(_readChallenges(), id);
}

export function isChallengeCleared(id) {
  return _getEntry(_readChallenges(), id).cleared;
}

export function isChallengeClaimed(id) {
  return _getEntry(_readChallenges(), id).claimed;
}

// 진행도 증가. target 도달 시 cleared=true 로 마킹 (보상 자동 지급 X — 사용자 수령 액션 필요).
export function addProgress(id, amount = 1) {
  const c = CHALLENGES.find(x => x.id === id);
  if (!c) return false;
  const ch = _readChallenges();
  const cur = _getEntry(ch, id);
  if (cur.claimed) return false;
  const next = Math.min(c.target, cur.progress + amount);
  const nowCleared = next >= c.target;
  ch[id] = { progress: next, cleared: nowCleared, claimed: cur.claimed };
  _writeChallenges(ch);
  return nowCleared && !cur.cleared;   // 방금 cleared 가 됐는지 (수령 가능 알림용).
}

// 보상 수령 — cleared 이고 아직 안 받았으면 다이아 지급 + claimed=true.
export function claimReward(id) {
  const c = CHALLENGES.find(x => x.id === id);
  if (!c) return false;
  const ch = _readChallenges();
  const cur = _getEntry(ch, id);
  if (!cur.cleared || cur.claimed) return false;
  ch[id] = { progress: c.target, cleared: true, claimed: true };
  _writeChallenges(ch);
  addDiamonds(c.reward, `challenge:${id}`);
  return true;
}

// 직접 cleared 처리 (테스트/디버그용 — 다이아 지급 X, 수령 필요).
export function clearChallenge(id) {
  const c = CHALLENGES.find(x => x.id === id);
  if (!c) return false;
  const ch = _readChallenges();
  const cur = _getEntry(ch, id);
  if (cur.cleared) return false;
  ch[id] = { progress: c.target, cleared: true, claimed: cur.claimed };
  _writeChallenges(ch);
  return true;
}

// === 데브용 — 상태 강제 변경 (다이아 지급 X). state: 'progress' | 'claimable' | 'claimed'. ===
export function devSetState(id, state) {
  const c = CHALLENGES.find(x => x.id === id);
  if (!c) return false;
  const ch = _readChallenges();
  if (state === 'progress') ch[id] = { progress: 0, cleared: false, claimed: false };
  else if (state === 'claimable') ch[id] = { progress: c.target, cleared: true, claimed: false };
  else if (state === 'claimed')   ch[id] = { progress: c.target, cleared: true, claimed: true };
  else return false;
  _writeChallenges(ch);
  return true;
}

// 현재 챕터의 진행도 — claimed 기준 (UI 상단 단계 표기).
export function getOverallProgress() {
  const ch = _readChallenges();
  const chapter = getCurrentChapter();
  let claimed = 0;
  chapter.items.forEach(c => { if (_getEntry(ch, c.id).claimed) claimed++; });
  return { cleared: claimed, total: chapter.items.length, chapterId: chapter.id, chapterName: chapter.name };
}
