// 영구 재료 [P-66] — 각성석 / 초월석.
//   강화(다이아) 다음 단계 재화. 메인 보스 처치로만 획득 (챕터 게이팅).
//   각성 단계 → 각성석(awakenStone), 초월 단계 → 초월석(transcendStone).
//
// 저장: localStorage 'false-hero-materials' (다이아와 별도 — 영구 보존).

const MAT_KEY = 'false-hero-materials';

// 재료 정의 — 라벨 / 획득 가능 챕터 (이 챕터 번호 이상부터 메인 보스 드랍).
export const MATERIALS = {
  awakenStone:    { id: 'awakenStone',    label: '각성석', icon: '★', minChapter: 1, dropPerBoss: 1 },
  transcendStone: { id: 'transcendStone', label: '초월석', icon: '✦', minChapter: 1, dropPerBoss: 1 },
};

const DEFAULT_STATE = { awakenStone: 0, transcendStone: 0 };

const _isPlainObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function _read() {
  try {
    const raw = localStorage.getItem(MAT_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const data = JSON.parse(raw);
    if (!_isPlainObj(data)) return { ...DEFAULT_STATE };
    return {
      awakenStone:    Number.isInteger(data.awakenStone)    && data.awakenStone    >= 0 ? data.awakenStone    : 0,
      transcendStone: Number.isInteger(data.transcendStone) && data.transcendStone >= 0 ? data.transcendStone : 0,
    };
  } catch { return { ...DEFAULT_STATE }; }
}

function _write(state) {
  try { localStorage.setItem(MAT_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('[materials._write] failed:', e && e.message); }
}

// === 조회 ===
export function getMaterial(id) {
  return _read()[id] || 0;
}
export function getMaterials() {
  return _read();
}

// === 증감 ===
export function addMaterial(id, amount, reason = '') {
  if (!(id in DEFAULT_STATE) || !amount || amount <= 0) return 0;
  const state = _read();
  state[id] += amount;
  _write(state);
  console.log(`[재료] ${id} +${amount} (${reason || 'unknown'}) → ${state[id]}`);
  return state[id];
}

export function spendMaterial(id, amount) {
  if (!(id in DEFAULT_STATE) || !amount || amount <= 0) return false;
  const state = _read();
  if (state[id] < amount) return false;
  state[id] -= amount;
  _write(state);
  return true;
}

// === 메인 보스 처치 시 재료 드랍 — 챕터 게이팅. ===
//   chapterNum: 1(normal) / 2(hard) / 3(veryHard).
//   각 재료의 minChapter 이상이면 dropPerBoss 만큼 지급.
export function awardBossMaterials(chapterNum) {
  const dropped = [];
  for (const m of Object.values(MATERIALS)) {
    if (chapterNum >= m.minChapter) {
      addMaterial(m.id, m.dropPerBoss, `메인보스(${chapterNum}챕터)`);
      dropped.push({ id: m.id, label: m.label, amount: m.dropPerBoss });
    }
  }
  return dropped;
}

export function resetMaterials() {
  try { localStorage.removeItem(MAT_KEY); } catch {}
}
