// 글래스 버튼 헬퍼 — 검정 alpha 배경 + radius 4 + 호버 alpha 강화
// 사용처: showPauseMenu / showSettingsModal / showGameOver / showGameClear 등 모달 / 풀스크린 오버레이.
//
// 시그니처: makeGlassBtn(scene, opts)
//   opts:
//     x, y          중심 좌표 (필수). 모달 본문 안이면 모달 로컬 좌표.
//     w, h          버튼 크기 (필수)
//     label         텍스트 (필수)
//     onClick       클릭 콜백 (필수)
//     color         텍스트 색 hex 문자열 (기본 '#9A9AA2')
//     fontSize      텍스트 크기 (기본 '15px' — Phase P-3: 12 → 15px ×1.25)
//     baseAlpha     기본 배경 alpha (기본 0.35)
//     hoverAlpha    호버 배경 alpha (기본 0.5)
//     depth         설정 시 bg/txt/hit 에 depth/+1/+2 적용 (씬 레벨 노출 시 사용)
//     parent        Phaser Container — 있으면 [bg, hit, txt] 자동 add (모달 body 등)
//     stopPropagation  pointerdown 시 ev.stopPropagation 호출 여부 (모달용)
// 반환: { bg, txt, hit }

import { FONT, addText, bindHover } from './theme.js';

export function makeGlassBtn(scene, opts) {
  const {
    x = 0,
    y,
    w,
    h,
    label,
    onClick = () => {},
    color = '#9A9AA2',
    fontSize = '15px',
    baseAlpha = 0.35,
    hoverAlpha = 0.5,
    depth,
    parent,
    stopPropagation = false,
  } = opts;

  // [글래스 톤] 버튼 — frosted glass + 흰 외곽선 + 호버 강화
  const bg = scene.add.graphics();
  // 색 hex 변환 (텍스트 hex → 액센트 색)
  let accentColor = 0x6AC8FF;
  try {
    const hex = (color || '#6AC8FF').replace('#', '');
    accentColor = parseInt(hex, 16) || 0x6AC8FF;
  } catch {}
  const draw = (a, hovered = false) => {
    bg.clear();
    // [스탯 박스 톤] 검정 베이스 + 미세 흰 외곽 + 호버 시 흰 외곽 강화
    bg.fillStyle(0x000000, a + 0.15);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
    // 상단 미세 흰 광택
    bg.fillStyle(0xFFFFFF, hovered ? 0.10 : 0.05);
    bg.fillRect(x - w / 2 + 4, y - h / 2 + 1, w - 8, 1);
    // 외곽 흰 라인
    bg.lineStyle(1, 0xFFFFFF, hovered ? 0.45 : 0.18);
    bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
  };
  draw(baseAlpha);

  const txt = addText(scene, x, y, label, {
    fontFamily: FONT, fontSize, color, fontStyle: '700',
  }).setOrigin(0.5);
  txt.setShadow(1, 1, '#000000', 2, false, true);

  const hit = scene.add.rectangle(x, y, w, h, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true });

  if (depth !== undefined) {
    bg.setDepth(depth);
    txt.setDepth(depth + 1);
    hit.setDepth(depth + 2);
  }

  // [Phase P-50b + P-53 후속] hit zone 은 parent 유무 무관하게 setScrollFactor(0).
  //   parent (Container) 의 setScrollFactor(0) 가 자식 hit area 에 자동 전파되지 X.
  //   bg/txt 도 일관성 위해 함께 처리 (parent 안에 있으면 시각상 영향 X, 안전).
  bg.setScrollFactor(0);
  txt.setScrollFactor(0);
  hit.setScrollFactor(0);

  bindHover(hit, () => draw(hoverAlpha, true), () => draw(baseAlpha, false));
  hit.on('pointerdown', (p, lx, ly, ev) => {
    if (stopPropagation && ev) ev.stopPropagation();
    onClick();
  });

  if (parent) parent.add([bg, hit, txt]);

  return { bg, txt, hit };
}
