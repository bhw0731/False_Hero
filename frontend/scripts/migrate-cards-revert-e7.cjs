// Phase E7 — 175 카드의 apply 함수 미러로 revert 함수 자동 생성.
// 패턴별 변환:
//   modStat('X', 'cards', N)        → modStat('X', 'cards', -(N))
//   player.stats.hp += N            → player.stats.hp -= N
//   player.stats.hp -= N            → player.stats.hp += N
//   player.stats.gold += N          → player.stats.gold -= N
//   player.stats.gold -= N          → player.stats.gold += N
//   player._XActive = true          → player._XActive = false
//   player._XAdded = 0              → player._XAdded = 0 (no-op revert)
//   player.stats.hp = Math.min(...) → SKIP (HP clamp 은 일방향)
//
// 결과: apply 직후 revert: (player) => { ... } 키 추가.

const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', 'src', 'data', 'cards');
const FILES = [
  'wrathCards.js', 'greedCards.js', 'slothCards.js', 'prideCards.js',
  'lustCards.js',  'envyCards.js',  'gluttonyCards.js',
];

// 한 라인을 inverted 라인으로 변환 (혹은 null 반환 시 revert 에서 스킵)
function invertLine(line) {
  // 1. modStat('X', 'cards', N)
  let m = line.match(/^(\s*)player\.modStat\('(\w+)',\s*'cards',\s*(.+?)\)\s*;\s*$/);
  if (m) {
    const [, indent, stat, delta] = m;
    return `${indent}player.modStat('${stat}', 'cards', -(${delta}));`;
  }
  // 2. player.stats.hp += N
  m = line.match(/^(\s*)player\.stats\.hp\s*\+=\s*(.+?)\s*;\s*$/);
  if (m) return `${m[1]}player.stats.hp -= ${m[2]};`;
  // 3. player.stats.hp -= N
  m = line.match(/^(\s*)player\.stats\.hp\s*-=\s*(.+?)\s*;\s*$/);
  if (m) return `${m[1]}player.stats.hp += ${m[2]};`;
  // 4. player.stats.gold += N
  m = line.match(/^(\s*)player\.stats\.gold\s*\+=\s*(.+?)\s*;\s*$/);
  if (m) return `${m[1]}player.stats.gold -= ${m[2]};`;
  // 5. player.stats.gold -= N
  m = line.match(/^(\s*)player\.stats\.gold\s*-=\s*(.+?)\s*;\s*$/);
  if (m) return `${m[1]}player.stats.gold += ${m[2]};`;
  // 6. player._XActive = true
  m = line.match(/^(\s*)player\.(\w+L1Active)\s*=\s*true\s*;\s*$/);
  if (m) return `${m[1]}player.${m[2]} = false;`;
  // 7. player._XAdded = 0  (legendary 누적 트래커 — revert 도 0)
  m = line.match(/^(\s*)player\.(\w+Added)\s*=\s*0\s*;\s*$/);
  if (m) return `${m[1]}player.${m[2]} = 0;`;
  // 8. player.stats.hp = Math.min(...) — HP clamp, 일방향 (revert 스킵)
  if (/player\.stats\.hp\s*=\s*Math\.min/.test(line)) return null;
  // 9. comment / blank line — revert 본문에 그대로 둠
  if (/^\s*\/\/|^\s*$/.test(line)) return line;
  // 알 수 없는 패턴 — 주석으로 표시 (수동 점검 필요)
  return `${line.replace(/\S/, '// [revert-todo] ')}`;
}

function processFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  const before = src;

  // 카드 객체의 apply 함수 끝 (`    },\n`) 다음에 revert 가 이미 있으면 스킵.
  // apply: (player) => { ... },\n  ← 이 패턴 찾아서 revert 키 삽입.
  // multiline regex: apply: (player) => {\n  body  \n    },
  const APPLY_RE = /(\n(\s*)apply:\s*\(player\)\s*=>\s*\{\n)([\s\S]*?)(\n\s*\},)/g;

  let count = 0;
  src = src.replace(APPLY_RE, (match, openLine, indent, body, closeLine) => {
    // body 라인 분해
    const bodyLines = body.split('\n');
    const revertLines = bodyLines.map(invertLine).filter(l => l !== null);
    // 사실상 revert 본문이 비어있으면 (예: 모두 HP clamp 만) 빈 함수 추가
    const revertBody = revertLines.length > 0 ? revertLines.join('\n') : `${indent}  // revert: 변동 없음`;
    count++;
    // apply { ... }, 뒤에 revert: (player) => { ... }, 추가.
    // closeLine 의 '\n    },' 을 '\n    },\n    revert: ...,' 로 교체.
    const revertBlock = `\n${indent}revert: (player) => {\n${revertBody}\n${indent}},`;
    return `${openLine}${body}${closeLine}${revertBlock}`;
  });

  if (src !== before) {
    fs.writeFileSync(filePath, src, 'utf8');
    return count;
  }
  return 0;
}

let totalRevertsAdded = 0;
for (const f of FILES) {
  const fp = path.join(CARDS_DIR, f);
  const added = processFile(fp);
  console.log(`[${f}] revert added to ${added} cards`);
  totalRevertsAdded += added;
}
console.log(`\nTotal reverts added: ${totalRevertsAdded}`);

// === leftover scan — apply 있는데 revert 없는 카드 검출 ===
console.log('\n=== leftover scan ===');
let leftover = 0;
for (const f of FILES) {
  const fp = path.join(CARDS_DIR, f);
  const src = fs.readFileSync(fp, 'utf8');
  // apply 카운트 vs revert 카운트
  const applyCount  = (src.match(/^\s*apply:\s*\(player\)\s*=>/gm) || []).length;
  const revertCount = (src.match(/^\s*revert:\s*\(player\)\s*=>/gm) || []).length;
  if (applyCount !== revertCount) {
    console.log(`  ${f}: apply=${applyCount}, revert=${revertCount}, diff=${applyCount - revertCount}`);
    leftover += (applyCount - revertCount);
  }
}
console.log(`leftover (apply 없는 revert): ${leftover}`);
