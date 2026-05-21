// 카드 apply/revert 자동 미러 헬퍼 — Phase M1+ 7대죄 카드 파일에서 공유.
//
// 단순 카드: makeCard(id, name, icon, sin, rarity, desc, effect)
//   effect = { stat: delta, ... } — apply 시 modStat(stat, 'cards', delta), revert 시 -delta.
// 복합 카드 (게임체인저, 즉시 효과 등): _card{...} 객체 직접 작성 (apply/revert 함수 명시).

export function makeCard(id, name, icon, sin, rarity, desc, effect) {
  return {
    id, name, icon, sin, rarity, desc,
    apply: (player) => {
      for (const [stat, delta] of Object.entries(effect)) {
        player.modStat(stat, 'cards', delta);
      }
    },
    revert: (player) => {
      for (const [stat, delta] of Object.entries(effect)) {
        player.modStat(stat, 'cards', -delta);
      }
    },
  };
}
