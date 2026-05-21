// Phase E5 — Player.js 내부 multi-source stat 리드 → getStat 마이그레이션.
// 13종 stat 의 read-only 참조를 getStat 로 교체. write 는 이미 modStat 으로 변환됨 (E1+E3).
// hp / gold / level / exp / expToNext 는 flat 유지.
// 생성자 _statSources 초기화 라인 ({ base: this.stats.X, ... }) 는 보호 (read 가 아니라 init).

const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'src', 'entities', 'Player.js');

const MULTI_STATS = [
  'attackPower', 'attackSpeed', 'attackRange', 'moveSpeed', 'defense',
  'maxHp', 'critChance', 'critDamage', 'dodge', 'accuracy',
  'lifesteal', 'damageReduction', 'goldGainMul',
];

let src = fs.readFileSync(FILE, 'utf8');
const before = src;

// 라인별 처리 — 각 stat 의 직접 read 만 변환 (write/모드 패턴 제외)
const lines = src.split('\n');
const newLines = lines.map((line, i) => {
  const lineNum = i + 1;
  // 보호: _statSources 초기화 라인
  if (/\{\s*base:\s*this\.stats\.\w+/.test(line)) return line;
  // 보호: 이미 modStat / getStat 호출
  if (line.includes('this.modStat') || line.includes('this.getStat')) return line;
  // 보호: write 패턴 (=, +=, -=)
  // — multi-source 라인은 modStat 으로 변환됨; 잔존 write 는 hp/gold 만일 것.
  // 그러나 일부 hp 컴패니언 write 는 보존.

  let result = line;
  for (const stat of MULTI_STATS) {
    // this.stats.<stat> 가 read 로 등장 — 우측 (rhs) 또는 인자로.
    // 단순화: word boundary + this.stats.<stat>(?=\W) 매치, 단 = 의 좌변(LHS) 은 제외.
    // LHS 검사: "this.stats.<stat>" 다음에 곧바로 = (할당) 가 오면 LHS — 변환 X.
    const re = new RegExp(`this\\.stats\\.${stat}(?!\\w)`, 'g');
    result = result.replace(re, (match, offset) => {
      // 뒤에 공백 후 '=' 인지 확인 (할당 LHS 인지)
      const after = result.slice(offset + match.length);
      // 매치 직후 텍스트가 빈 공백 이후 = (단 ==, ===, =>, +=, -= 제외) 면 LHS
      const lhsMatch = after.match(/^\s*(=)(?!=)/);
      if (lhsMatch) {
        // += / -= 는 ?= 로 검증 후 / 단순 = 면 할당 — 변환 X
        return match;
      }
      // += / -= 는 위에서 lhsMatch 가 안 잡힘 (앞에 + 또는 -). 추가 검사:
      // 매치 앞 텍스트가 '+=' 또는 '-=' 의 일부면 LHS 의 변형이지만 — 사실 그 경우 매치 자체가 LHS.
      // 위 lhsMatch 가 단순 '=' 만 잡으니 +=/-= 케이스는 통과.
      // → 직전 문자 '+' 또는 '-' 가 있고 그 다음 '=' 가 곧 오면 +=/-= LHS — 변환 X.
      // 사실 이런 라인은 이미 modStat 으로 변환됐어야 함. 잔존 라인은 거의 없음.
      return `this.getStat('${stat}')`;
    });
  }
  return result;
});

src = newLines.join('\n');

if (src !== before) {
  fs.writeFileSync(FILE, src, 'utf8');
  const beforeArr = before.split('\n');
  const afterArr  = src.split('\n');
  const diff = beforeArr.filter((l, i) => l !== afterArr[i]).length;
  console.log(`migrated Player.js reads: ${diff} lines changed`);
} else {
  console.log('no changes');
}

// === 잔존 검증 — multi-source stat 직접 read 잔존 ===
console.log('\n=== leftover read scan ===');
const finalLines = fs.readFileSync(FILE, 'utf8').split('\n');
let leftover = 0;
finalLines.forEach((line, i) => {
  // _statSources init / modStat / getStat 호출 제외
  if (/\{\s*base:\s*this\.stats\.\w+/.test(line)) return;
  if (line.includes('this.modStat') || line.includes('this.getStat')) return;
  for (const stat of MULTI_STATS) {
    const re = new RegExp(`this\\.stats\\.${stat}(?!\\w)`);
    if (re.test(line)) {
      console.log(`  ${i + 1}: ${line.trim()}`);
      leftover++;
      break;
    }
  }
});
console.log(`leftover: ${leftover}`);
