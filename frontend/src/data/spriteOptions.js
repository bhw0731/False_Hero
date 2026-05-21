// 스프라이트 카탈로그 — sprites/ 폴더의 PNG 파일명과 동일
// Phaser 텍스처 키 = 파일명(공백 포함). 보스/잡몹/관리자 외형 옵션이 모두 이걸 사용.

import Phaser from 'phaser';

// 플레이어 전용 — 잡몹/보스 메뉴에는 노출 안 함
export const PLAYER_SPRITE = '플레이어';

// 잡몹 / 보스 양쪽에서 쓰는 16종 (공주 / 플레이어 제외)
export const CREATURE_SPRITES = [
  '슬라임', '쥐', '거미', '전갈', '드워프', '유령',
  '대머리', '하급 기사', '중급 기사', '중급 야만인',
  '마녀', '마법사', '상급 기사', '상급 야만인', '거인',
  '타락한 마법사',
];

// 잡몹 편집에 노출할 외형 옵션 — 16종
export const ENEMY_SPRITE_OPTIONS = CREATURE_SPRITES;
// 보스 편집에 노출할 외형 옵션 — 16종
export const BOSS_SPRITE_OPTIONS = CREATURE_SPRITES;

// 게임에서 로드해야 하는 모든 스프라이트 (preload 에서 사용)
// 공주는 현재 어디에도 안 쓰지만 폴더에 남아있으므로 미리 로드해두지 않음
export const ALL_SPRITES = [...CREATURE_SPRITES, PLAYER_SPRITE];

// === [Phase P-2] sprite NEAREST 필터 시스템 ===
// pixelArt: true 폐기 후, 도트 sprite 만 개별 NEAREST 필터 적용 (텍스트는 LINEAR 유지).
// PIXEL_TEXTURE_KEYS 에 등록된 키는 씬마다 _applyPixelFilters() 헬퍼로 NEAREST 처리.
// 등록 안 된 텍스처 (UI emoji / glassBtn 그래픽 등) 는 기본 LINEAR 유지.

// 배경 PNG 키 (bg_stage_01 ~ bg_stage_10 + 메뉴/스테이지 공용 background)
// ⚠ GameScene.preload 가 zero-padded 형식으로 로드함 (`bg_stage_${n.padStart(2,'0')}`)
const BG_TEXTURE_KEYS = [
  'background',
  'bg_stage_01', 'bg_stage_02', 'bg_stage_03', 'bg_stage_04', 'bg_stage_05',
  'bg_stage_06', 'bg_stage_07', 'bg_stage_08', 'bg_stage_09', 'bg_stage_10',
];

// 추가 sprite 별칭 — GameScene 에서 'player' / 'enemy' alias 로 한 번 더 로드함
const SPRITE_ALIAS_KEYS = ['player', 'enemy'];

// [Phase P-54] 7대죄 아이콘 키 — 픽셀아트, NEAREST 필터 적용
const SIN_ICON_KEYS = [
  'sin_wrath', 'sin_greed', 'sin_sloth', 'sin_pride',
  'sin_lust', 'sin_envy', 'sin_gluttony',
];

// 모든 픽셀 sprite 키 = 16종 한국어 키 + 플레이어 + 별칭 + 배경 + 죄 아이콘
export const PIXEL_TEXTURE_KEYS = [
  ...CREATURE_SPRITES,
  PLAYER_SPRITE,
  ...SPRITE_ALIAS_KEYS,
  ...BG_TEXTURE_KEYS,
  ...SIN_ICON_KEYS,
];

// 씬에서 호출 — PIXEL_TEXTURE_KEYS 중 존재하는 모든 텍스처에 NEAREST 필터 적용.
// preload 끝난 직후 (create 시작 시) 호출하면 안전.
// 같은 텍스처에 중복 호출해도 멱등 — 여러 씬에서 같은 키 호출해도 OK.
export function applyNearestToPixelTextures(scene) {
  if (!scene || !scene.textures) return 0;
  const NEAREST = Phaser.Textures.FilterMode.NEAREST;
  let applied = 0;
  for (const key of PIXEL_TEXTURE_KEYS) {
    if (!scene.textures.exists(key)) continue;
    const tex = scene.textures.get(key);
    if (tex && tex.source && Array.isArray(tex.source)) {
      tex.source.forEach(s => { if (s && typeof s.setFilter === 'function') s.setFilter(NEAREST); });
      applied += 1;
    } else if (tex && typeof tex.setFilter === 'function') {
      tex.setFilter(NEAREST);
      applied += 1;
    }
  }
  return applied;
}

// === 사이클 헬퍼 — 화살표(◀▶)로 외형 바꿀 때 사용 ===

export function cycleSprite(currentName, dir, options) {
  const idx = options.indexOf(currentName);
  const start = idx === -1 ? 0 : idx;
  const next = (start + dir + options.length) % options.length;
  return options[next];
}
