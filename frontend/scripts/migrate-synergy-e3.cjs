// Phase E3 — synergyEffects.js apply/revert 자동 변환.
// 13종 multi-source stat 만 modStat('synergy') 로 변환.
// hp/gold/level/exp 는 flat 유지. hp clamp 는 getStat('maxHp') 사용.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'data', 'synergyEffects.js');

const MULTI_STATS = new Set([
  'attackPower', 'attackSpeed', 'attackRange', 'moveSpeed', 'defense',
  'maxHp', 'critChance', 'critDamage', 'dodge', 'accuracy',
  'lifesteal', 'damageReduction', 'goldGainMul',
]);

let src = fs.readFileSync(FILE, 'utf8');
const before = src;

// 1. player.stats.X = Math.max(M, player.stats.X + Y)  →  modStat('X', 'synergy', Y)
//    Y 는 변수 (payload.foo, fooDelta) 또는 양수 리터럴 (0.10, 5).
src = src.replace(
  /player\.stats\.(\w+)\s*=\s*Math\.max\(\s*[\d.]+\s*,\s*player\.stats\.\1\s*\+\s*([\w.]+)\s*\)\s*;/g,
  (m, stat, delta) => {
    if (!MULTI_STATS.has(stat)) return m;
    return `player.modStat('${stat}', 'synergy', ${delta});`;
  }
);

// 2. player.stats.X = Math.max(M, player.stats.X - Y)  →  modStat('X', 'synergy', -Y)
src = src.replace(
  /player\.stats\.(\w+)\s*=\s*Math\.max\(\s*[\d.]+\s*,\s*player\.stats\.\1\s*-\s*([\w.]+)\s*\)\s*;/g,
  (m, stat, delta) => {
    if (!MULTI_STATS.has(stat)) return m;
    return `player.modStat('${stat}', 'synergy', -${delta});`;
  }
);

// 3. player.stats.goldGainMul = (player.stats.goldGainMul || 1.0) + Y  →  modStat('goldGainMul', 'synergy', Y)
src = src.replace(
  /player\.stats\.goldGainMul\s*=\s*\(\s*player\.stats\.goldGainMul\s*\|\|\s*[\d.]+\s*\)\s*\+\s*([\w.]+)\s*;/g,
  (m, delta) => `player.modStat('goldGainMul', 'synergy', ${delta});`
);

// 4. player.stats.X += Y  →  modStat('X', 'synergy', Y)   (X 는 multi-source 만)
src = src.replace(
  /player\.stats\.(\w+)\s*\+=\s*([\w.]+)\s*;/g,
  (m, stat, delta) => {
    if (!MULTI_STATS.has(stat)) return m;
    return `player.modStat('${stat}', 'synergy', ${delta});`;
  }
);

// 5. player.stats.X -= Y  →  modStat('X', 'synergy', -Y)
src = src.replace(
  /player\.stats\.(\w+)\s*-=\s*([\w.]+)\s*;/g,
  (m, stat, delta) => {
    if (!MULTI_STATS.has(stat)) return m;
    return `player.modStat('${stat}', 'synergy', -${delta});`;
  }
);

// 6. player.stats.hp = Math.min(player.stats.hp, player.stats.maxHp);
//    → player.stats.hp = Math.min(player.stats.hp, player.getStat('maxHp'));
src = src.replace(
  /player\.stats\.hp\s*=\s*Math\.min\(\s*player\.stats\.hp\s*,\s*player\.stats\.maxHp\s*\)\s*;/g,
  `player.stats.hp = Math.min(player.stats.hp, player.getStat('maxHp'));`
);

if (src !== before) {
  fs.writeFileSync(FILE, src, 'utf8');
  const beforeLines = before.split('\n');
  const afterLines  = src.split('\n');
  const diff = beforeLines.filter((l, i) => l !== afterLines[i]).length;
  console.log(`migrated synergyEffects.js: ${diff} lines changed`);
} else {
  console.log('no changes');
}

// === leftover scan — multi-source stat 직접 변경 잔존 검출 ===
console.log('\n=== leftover scan ===');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');
let leftover = 0;
lines.forEach((line, i) => {
  // player.stats.X = / += / -=  형태 (단 modStat 호출 라인 제외)
  if (line.includes('player.modStat')) return;
  const m = line.match(/player\.stats\.(\w+)\s*[=+-]/);
  if (!m) return;
  const stat = m[1];
  if (!MULTI_STATS.has(stat)) return;
  // hp/maxHp companion read 는 정상 (예: maxHp * 0.10) — write 만 잡음
  // 패턴 확인: [+]?= 가 있어야 write
  if (!/\s*=\s*[^=]|\+=|-=/.test(line)) return;
  console.log(`  ${i + 1}: ${line.trim()}`);
  leftover++;
});
console.log(`leftover write-only: ${leftover}`);
