// Phase E3 — Player.js 의 동적 시너지 trigger 코드 변환.
// onEnemyKilled / takeDamage / _onDodge / _updateSynergyTriggers 안의 stats 직접 변경을
// modStat('X', 'synergy', delta) 로 마이그레이션.
//
// 자동 변환은 multi-source 13종 stat 만 — hp/gold/exp 는 그대로.
// 단순 +=/-=/Math.max(M, X ± V) / goldGainMul 패턴.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'entities', 'Player.js');

const MULTI_STATS = new Set([
  'attackPower', 'attackSpeed', 'attackRange', 'moveSpeed', 'defense',
  'maxHp', 'critChance', 'critDamage', 'dodge', 'accuracy',
  'lifesteal', 'damageReduction', 'goldGainMul',
]);

let src = fs.readFileSync(FILE, 'utf8');
const before = src;

// 1. this.stats.X = Math.max(M, this.stats.X + Y) → this.modStat('X', 'synergy', Y)
src = src.replace(
  /this\.stats\.(\w+)\s*=\s*Math\.max\(\s*[\d.]+\s*,\s*this\.stats\.\1\s*\+\s*([\w.()*\-+ \d]+?)\s*\)\s*;/g,
  (m, stat, delta) => {
    if (!MULTI_STATS.has(stat)) return m;
    return `this.modStat('${stat}', 'synergy', ${delta.trim()});`;
  }
);

// 2. this.stats.X = Math.max(M, this.stats.X - Y) → this.modStat('X', 'synergy', -Y)
src = src.replace(
  /this\.stats\.(\w+)\s*=\s*Math\.max\(\s*[\d.]+\s*,\s*this\.stats\.\1\s*-\s*([\w.()*\-+ \d]+?)\s*\)\s*;/g,
  (m, stat, delta) => {
    if (!MULTI_STATS.has(stat)) return m;
    return `this.modStat('${stat}', 'synergy', -(${delta.trim()}));`;
  }
);

// 3. this.stats.goldGainMul = (this.stats.goldGainMul || 1.0) + Y → modStat
src = src.replace(
  /this\.stats\.goldGainMul\s*=\s*\(\s*this\.stats\.goldGainMul\s*\|\|\s*[\d.]+\s*\)\s*\+\s*([\w.()*\-+ \d]+?)\s*;/g,
  (m, delta) => `this.modStat('goldGainMul', 'synergy', ${delta.trim()});`
);

// 4. this.stats.X += Y → this.modStat('X', 'synergy', Y)  (multi-source 13종만)
src = src.replace(
  /this\.stats\.(\w+)\s*\+=\s*([\w.()*\-+ \d]+?)\s*;/g,
  (m, stat, delta) => {
    if (!MULTI_STATS.has(stat)) return m;
    return `this.modStat('${stat}', 'synergy', ${delta.trim()});`;
  }
);

// 5. this.stats.X -= Y → this.modStat('X', 'synergy', -Y)
src = src.replace(
  /this\.stats\.(\w+)\s*-=\s*([\w.()*\-+ \d]+?)\s*;/g,
  (m, stat, delta) => {
    if (!MULTI_STATS.has(stat)) return m;
    return `this.modStat('${stat}', 'synergy', -(${delta.trim()}));`;
  }
);

if (src !== before) {
  fs.writeFileSync(FILE, src, 'utf8');
  const beforeLines = before.split('\n');
  const afterLines  = src.split('\n');
  const diff = beforeLines.filter((l, i) => l !== afterLines[i]).length;
  console.log(`migrated Player.js: ${diff} lines changed`);
} else {
  console.log('no changes');
}

// === leftover scan — multi-source stat write 직접 잔존 ===
console.log('\n=== leftover scan ===');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');
let leftover = 0;
lines.forEach((line, i) => {
  if (line.includes('this.modStat')) return;
  // _statSources 등록 라인 (생성자) 도 스킵 — base 초기화는 정상 직접 read
  if (line.includes('{ base: this.stats.')) return;
  // write 패턴: += -= 또는 = (단 = Math.min/max 도 잡힘)
  const m = line.match(/this\.stats\.(\w+)\s*([+\-]=|=\s*Math\.(?:max|min))/);
  if (!m) return;
  const stat = m[1];
  if (!MULTI_STATS.has(stat)) return;
  console.log(`  ${i + 1}: ${line.trim()}`);
  leftover++;
});
console.log(`leftover: ${leftover}`);
