// Phase E1+E2 카드 apply 자동 변환 스크립트.
// 7개 sin 카드 파일에 대해 mechanical regex 변환.
// 보존: player.stats.hp / player.stats.gold (flat) / 그 외 player._foo 플래그.
// 변환: player.stats.X (multi-source 13종) 의 +=, -=, Math.max(...) 패턴.

const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', 'src', 'data', 'cards');
const FILES = [
  'wrathCards.js', 'greedCards.js', 'slothCards.js', 'prideCards.js',
  'lustCards.js',  'envyCards.js',  'gluttonyCards.js',
];

// _statSources 등록된 13종 stat
const MULTI_STATS = new Set([
  'attackPower', 'attackSpeed', 'attackRange', 'moveSpeed', 'defense',
  'maxHp', 'critChance', 'critDamage', 'dodge', 'accuracy',
  'lifesteal', 'damageReduction', 'goldGainMul',
]);

let totalChanges = 0;

for (const fname of FILES) {
  const filePath = path.join(CARDS_DIR, fname);
  let src = fs.readFileSync(filePath, 'utf8');
  const before = src;

  // 1. Math.max(M, player.stats.X - N) → modStat('X', 'cards', -N)
  //    e.g. player.stats.attackPower = Math.max(1, player.stats.attackPower - 5);
  src = src.replace(
    /player\.stats\.(\w+)\s*=\s*Math\.max\(\s*[\d.]+\s*,\s*player\.stats\.\1\s*-\s*([\d.]+)\s*\);/g,
    (m, stat, n) => {
      if (!MULTI_STATS.has(stat)) return m;
      return `player.modStat('${stat}', 'cards', -${n});`;
    }
  );

  // 2. (player.stats.X || N) + M  pattern (goldGainMul)
  //    e.g. player.stats.goldGainMul = (player.stats.goldGainMul || 1.0) + 0.05;
  src = src.replace(
    /player\.stats\.(\w+)\s*=\s*\(\s*player\.stats\.\1\s*\|\|\s*[\d.]+\s*\)\s*\+\s*([\d.]+)\s*;/g,
    (m, stat, n) => {
      if (!MULTI_STATS.has(stat)) return m;
      return `player.modStat('${stat}', 'cards', ${n});`;
    }
  );

  // 3. player.stats.X += N  → modStat('X', 'cards', N)
  //    하지만 hp / gold 는 보존 (flat)
  src = src.replace(
    /player\.stats\.(\w+)\s*\+=\s*([\d.]+)\s*;/g,
    (m, stat, n) => {
      if (!MULTI_STATS.has(stat)) return m;  // hp, gold 등은 그대로
      return `player.modStat('${stat}', 'cards', ${n});`;
    }
  );

  // 4. player.stats.X -= N  → modStat('X', 'cards', -N)
  src = src.replace(
    /player\.stats\.(\w+)\s*-=\s*([\d.]+)\s*;/g,
    (m, stat, n) => {
      if (!MULTI_STATS.has(stat)) return m;
      return `player.modStat('${stat}', 'cards', -${n});`;
    }
  );

  // 5. hp clamp 보정
  //    player.stats.hp = Math.min(player.stats.hp, player.stats.maxHp);
  //    → player.stats.hp = Math.min(player.stats.hp, player.getStat('maxHp'));
  src = src.replace(
    /player\.stats\.hp\s*=\s*Math\.min\(\s*player\.stats\.hp\s*,\s*player\.stats\.maxHp\s*\);/g,
    `player.stats.hp = Math.min(player.stats.hp, player.getStat('maxHp'));`
  );

  if (src !== before) {
    fs.writeFileSync(filePath, src, 'utf8');
    const diffCount = before.split('\n').filter((l, i) => l !== src.split('\n')[i]).length;
    console.log(`[${fname}] migrated (${diffCount} lines changed)`);
    totalChanges += diffCount;
  } else {
    console.log(`[${fname}] no changes`);
  }
}

// === 잔존 검증 — 변환 누락 검출 ===
console.log('\n=== leftover scan (player.stats.X for multi-source stats) ===');
let leftover = 0;
for (const fname of FILES) {
  const filePath = path.join(CARDS_DIR, fname);
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/player\.stats\.(\w+)/);
    if (!m) return;
    const stat = m[1];
    if (!MULTI_STATS.has(stat)) return;  // hp/gold 는 정상 잔존
    // hp clamp 의 maxHp 참조는 이미 getStat 으로 변경됨; 누락된 것만 잡음.
    console.log(`  ${fname}:${i + 1}  ${line.trim()}`);
    leftover++;
  });
}
console.log(`leftover: ${leftover}`);
console.log(`\nTotal lines changed: ${totalChanges}`);
