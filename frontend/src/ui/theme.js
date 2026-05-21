// 공통 디자인 시스템 — 모든 씬에서 import 해서 사용
// 색상, 폰트, 버튼/타이틀 헬퍼 정의

// ── 색상 팔레트 (모던 다크 + 인디고 액센트) ──
export const C = {
  bg:         '#0F1419',  // 배경 (near-black blue)
  surface:    '#1B2433',  // 카드/패널
  surface2:   '#2A3548',  // hover, 약간 밝은 면
  border:     '#3D4A5F',  // 경계선
  primary:    '#6366F1',  // 메인 액센트 (인디고)
  primaryHover: '#818CF8',
  accent:     '#FFC857',  // 골드 (강조)
  textHi:     '#F1F5F9',  // 주요 텍스트
  text:       '#CBD5E1',  // 본문
  textDim:    '#94A3B8',  // 약한 텍스트
  textMute:   '#64748B',  // 매우 약함
  success:    '#34D399',
  warning:    '#FBBF24',
  danger:     '#F87171',
};

// ── 폰트 시스템 [Phase P-4 — 2026-05-10] ──
// index.html 에서 CDN으로 사전 로드되는 폰트:
//   - Galmuri11 (한글 픽셀 비트맵, 11px 표준) — 게임 UI 표준 ★ Phase P-4
//   - Cinzel / Cinzel Decorative (영문 클래식 세리프) — 인트로/타이틀
//   - Noto Serif KR (한글 세리프) — 인트로 굵은 표기
// Phase P-2 에서 보존했던 Pretendard Variable 은 Phase P-4 에서 제거 —
// 모바일 시뮬 (저해상도 + 비정수 배율) 에서 자모 압축 깨짐 ('처치'→'치치') 발생.
// Galmuri11 은 픽셀 그리드 최적화 비트맵이라 작은 사이즈에서도 자모 명확 + 도트 컨셉 정합.
//
// 정책 (가독성 최우선):
//   게임 UI 전반 = Galmuri11 (한/영/숫자 모두 픽셀체로 통일).
//   FONT_TITLE 만 영화적 세리프 (메뉴 타이틀 / 게임클리어 화면 — 서양 분위기).
//   sprite 는 NEAREST 필터로 도트 모양 보존 (data/spriteOptions.js, Phase P-2).
//
// ⚠ Galmuri11 은 비트맵 → weight 무시 (브라우저가 굵게 렌더링 X).
//   fontStyle '700' 등을 명시해도 모양 동일. 강조는 색/배경/크기로 구분 권장.
//
// 사용 가이드:
//   FONT_BODY / FONT_PIXEL / FONT  — 모두 Galmuri11 (게임 UI 전반)
//   FONT_DISP                       — Galmuri11 + Cinzel (강조용 — 영문은 Cinzel 폴백)
//   FONT_TITLE                      — 영화적 인트로/엔딩 (Cinzel + Noto Serif KR)

// [Phase P-7 + P-7b] emoji fallback chain 강화 —
//   Galmuri11 에 emoji 글리프 X → '💎' / '🃏' 등 ?? 표시 방지.
//   환경별 system emoji 폰트 다중 fallback:
//     iOS / macOS    "Apple Color Emoji"
//     Windows 10+    "Segoe UI Emoji"
//     Windows 옛     "Segoe UI Symbol"
//     Linux / Android "Noto Color Emoji" / "Noto Emoji" / "Android Emoji"
//     Firefox        "Twemoji Mozilla"
//     기타           "EmojiSymbols" / "EmojiOne Color" / "emoji" (CSS Fonts L4 generic)
const EMOJI_FALLBACK = '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", "Noto Emoji", "Android Emoji", "Twemoji Mozilla", "EmojiSymbols", "EmojiOne Color", emoji';

export const FONT_BODY   = `"Galmuri11", "Galmuri", "Apple SD Gothic Neo", "Malgun Gothic", ${EMOJI_FALLBACK}, sans-serif`;
export const FONT_PIXEL  = FONT_BODY;   // 호환 유지 — 이제 진짜 픽셀 폰트 (Galmuri11)
export const FONT_DISP   = `"Galmuri11", "Cinzel", "Galmuri", ${EMOJI_FALLBACK}, sans-serif`;
export const FONT_TITLE  = `"Cinzel Decorative", "Noto Serif KR", "Cinzel", ${EMOJI_FALLBACK}, serif`;

// ── [Phase P-3] 글로벌 폰트 사이즈 상수 — 모바일 가독성 우선 (×1.25 상향) ──
// F12 모바일 시뮬 (674×392) 에서 작은 폰트 + 비정수 배율 + 저해상도가 합쳐져
// 한글 자모 깨짐 발생 ('처치'→'치치', '받는'→'시는' 등). 사이즈 +25% 로 픽셀
// 밀도 충분 확보. 28px+ 디스플레이 폰트는 그대로 (이미 충분히 큼).
//
// 매핑 (rounded):
//   원본 → 신규  : 9→11 / 11→14 / 12→15 / 13→16 / 14→18 / 15→19 / 16→20 /
//                   17→21 / 18→22 / 20→25 / 24→30 / 28+ 그대로.
//
// 신규 코드 작성 시엔 아래 SIZE_* 상수 사용 권장 (기존 코드는 일괄 치환됨).
export const SIZE_TINY   = 11;   // 옛 9px (배지/sub 라벨)
export const SIZE_XSMALL = 14;   // 옛 11px (작은 라벨)
export const SIZE_SMALL  = 15;   // 옛 12px (sub-label / tier)
export const SIZE_BODY   = 16;   // 옛 13px (desc / 보조 텍스트)
export const SIZE_MED    = 18;   // 옛 14px
export const SIZE_LG     = 19;   // 옛 15px (카드 이름 / 일반 라벨)
export const SIZE_XLG    = 20;   // 옛 16px (강조 라벨)
export const SIZE_HEAD   = 22;   // 옛 18px (모달 타이틀)
export const SIZE_TITLE  = 30;   // 옛 24px (큰 타이틀)

// 하위 호환 — 기존 import { FONT } 사용처 유지
export const FONT = FONT_BODY;

// ── 글래스 버튼 — 검정 alpha 0.35 + radius 4, 외곽선 없음, 텍스트 그림자 ──
// variant 인자는 호환을 위해 유지하되 실제 외양은 모두 동일 글래스 (primary 만 텍스트 골드 강조).
// size: 'sm' | 'md' | 'lg'
export function makeButton(scene, x, y, label, onClick, opts = {}) {
  const variant = opts.variant || 'default';
  const size = opts.size || 'md';

  const sizeStyles = {
    sm: { fontSize: '18px', padX: 12, padY: 6 },
    md: { fontSize: '21px', padX: 22, padY: 10 },
    lg: { fontSize: '25px', padX: 30, padY: 13 },
  };
  const s = sizeStyles[size];

  const variantFg = {
    default: C.textHi,
    primary: C.accent,   // 골드 강조
    ghost:   C.text,
    danger:  '#FECACA',
  };
  const fg = variantFg[variant] || C.textHi;
  const baseA = 0.35, hoverA = 0.5, downA = 0.6;

  // 텍스트 먼저 — 폭/높이 측정용
  const txt = scene.add.text(x, y, label, {
    fontFamily: FONT,
    fontSize: s.fontSize,
    color: fg,
    fontStyle: '500',
  }).setOrigin(0.5);
  txt.setShadow(1, 1, '#000000', 2, false, true);

  const w = txt.width  + s.padX * 2;
  const h = txt.height + s.padY * 2;

  // 글래스 배경 (둥근 모서리)
  const g = scene.add.graphics();
  const draw = (a) => {
    g.clear();
    g.fillStyle(0x000000, a);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
  };
  draw(baseA);
  scene.children.bringToTop(txt);

  // 히트 영역 — 별도 rect (Graphics 자체는 hitArea 잡기 까다로움)
  const hit = scene.add.rectangle(x, y, w, h, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true });
  // [P-59 2차] 호버 제거 → 탭 누름 피드백. 손가락 댐 = downA, 떼면 baseA + onClick.
  hit.on('pointerdown', () => draw(downA));
  hit.on('pointerup',         () => { draw(baseA); onClick && onClick(); });
  hit.on('pointerupoutside',  () => draw(baseA));

  // 호환: txt 를 반환 (호출자들이 elements.push(...) 후 destroy 하므로 destroy 시 g/hit 도 같이 정리)
  const _origDestroy = txt.destroy.bind(txt);
  txt.destroy = function (...args) {
    if (g && g.destroy) g.destroy();
    if (hit && hit.destroy) hit.destroy();
    return _origDestroy(...args);
  };
  return txt;
}

// ── 타이틀/헤딩 [Phase P-3: sm/md ×1.25 / lg/xl 그대로 (이미 큼)] ──
export function makeTitle(scene, x, y, text, size = 'lg') {
  const sizes = { sm: '22px', md: '30px', lg: '34px', xl: '48px' };
  return scene.add.text(x, y, text, {
    fontFamily: FONT_DISP,
    fontSize: sizes[size],
    color: C.textHi,
    fontStyle: '600',
  }).setOrigin(0.5);
}

// ── DPR 캡 (DPR 3+ 환경에서 GPU 부담 방지) ──
const TEXT_DPR = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);

// ── 본문 텍스트 (size/color/weight 단순화 시그니처, resolution 자동 주입) ──
// [Phase P-3] 기본값 14px → 18px (×1.25 정합).
export function makeText(scene, x, y, text, opts = {}) {
  return scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: opts.size || '18px',
    color: opts.color || C.text,
    fontStyle: opts.weight || '400',
    resolution: TEXT_DPR,
    ...(opts.style || {}),
  });
}

// ── scene.add.text 직접 대체 — 스타일 객체 그대로 받고 resolution 만 주입 ──
// Phaser 4 에서 game config 의 resolution 이 Text 에 적용되지 않아 별도 주입 필요.
// 사용처에서 resolution 명시 시 사용자 값 우선 (스프레드 순서).
export function addText(scene, x, y, content, style = {}) {
  return scene.add.text(x, y, content, {
    resolution: TEXT_DPR,
    ...style,
  });
}

// ── 탭 누름 피드백 헬퍼 [P-59 2차] ──
// 모바일 우선 — 호버 제거. onIn: 손가락 댐(pointerdown), onOut: 손가락 뗌(pointerup/upoutside).
export function bindHover(hit, onIn, onOut) {
  if (!hit || !hit.on) return;
  if (onIn)  hit.on('pointerdown', onIn);
  if (onOut) {
    hit.on('pointerup',         onOut);
    hit.on('pointerupoutside',  onOut);
  }
}

// ── 카드 효과 텍스트 키워드 컬러 (rich text) [Phase P-54 폴리시] ──
// 카드 픽 / 보유 카드 모달에서 stat 키워드만 색 입혀 가독성 ↑.
// 긴 키워드 우선 매치 (예: '공격 속도' 가 '공격력' 보다 먼저).
export const CARD_KEYWORD_COLORS = {
  '공격 속도': '#7DD3FC',
  '공격력':    '#FCA5A5',
  '공속':      '#7DD3FC',
  '치명타 피해': '#FCD34D',
  '치명타':    '#FBBF24',
  '흡혈':      '#FB7185',
  '회피':      '#C084FC',
  '명중':      '#FACC15',
  '최대 HP':   '#86EFAC',
  '피해 감소': '#93C5FD',
  '골드':      '#EAB308',
  '경험치':    '#A78BFA',
  '무적':      '#FFFFFF',
  '처치':      '#F87171',
  '레벨':      '#FCD34D',
};

// addRichText — 키워드 컬러 강조 다색 텍스트 (자체 word-wrap + align center).
// content 문자열을 keywords 맵에 따라 토큰화 → 각 토큰을 색별 Text 로 띄움.
// 반환: Phaser Container (origin 처리: container.y -= totalH*originY).
//   opts: { fontFamily, fontSize, fontStyle, color (default), wrapWidth, lineSpacing, align, originY, keywords, shadow }
export function addRichText(scene, x, y, content, opts = {}) {
  const fontSize    = opts.fontSize || '14px';
  const fontStyle   = opts.fontStyle || '400';
  const fontFamily  = opts.fontFamily || FONT;
  const defaultClr  = opts.color || C.text;
  const wrapWidth   = opts.wrapWidth || 200;
  const lineSpacing = opts.lineSpacing != null ? opts.lineSpacing : 3;
  const align       = opts.align || 'center';
  const originY     = opts.originY != null ? opts.originY : 0;
  const keywords    = opts.keywords || CARD_KEYWORD_COLORS;
  const useShadow   = opts.shadow !== false;

  const kwList = Object.keys(keywords).sort((a, b) => b.length - a.length);
  const text = String(content || '');

  // 1) 키워드 단위 색 분할
  const segs = [];
  let i = 0;
  while (i < text.length) {
    let hit = null;
    for (const kw of kwList) {
      if (text.startsWith(kw, i)) { hit = kw; break; }
    }
    if (hit) {
      segs.push({ text: hit, color: keywords[hit] || defaultClr });
      i += hit.length;
    } else {
      const last = segs[segs.length - 1];
      if (last && last.color === defaultClr) last.text += text[i];
      else segs.push({ text: text[i], color: defaultClr });
      i += 1;
    }
  }

  // 2) 단어 토큰화 (공백/줄바꿈 분리)
  const tokens = [];
  for (const seg of segs) {
    const parts = seg.text.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        if (part.includes('\n')) tokens.push({ newline: true });
        else tokens.push({ space: true, color: seg.color });
      } else {
        tokens.push({ text: part, color: seg.color });
      }
    }
  }

  const container = scene.add.container(x, y);
  const mkText = (s, c) => {
    const t = scene.add.text(0, 0, s, {
      fontFamily, fontSize, color: c, fontStyle, resolution: TEXT_DPR,
    }).setOrigin(0, 0);
    if (useShadow) t.setShadow(1, 1, '#000000', 2, false, true);
    return t;
  };

  // 공백 / 라인 높이 측정
  const _probeSp = mkText(' ', defaultClr); const spW = _probeSp.width;
  const lineH = _probeSp.height; _probeSp.destroy();

  // 3) Greedy word-wrap — 줄별 토큰 누적
  const lines = [[]];
  let curW = 0;
  for (const tok of tokens) {
    if (tok.newline) { lines.push([]); curW = 0; continue; }
    if (tok.space) {
      if (lines[lines.length - 1].length > 0) {
        lines[lines.length - 1].push({ space: true, w: spW });
        curW += spW;
      }
      continue;
    }
    const obj = mkText(tok.text, tok.color);
    const w = obj.width;
    if (curW + w > wrapWidth && lines[lines.length - 1].length > 0) {
      // trailing space 제거
      const line = lines[lines.length - 1];
      while (line.length > 0 && line[line.length - 1].space) { curW -= line.pop().w; }
      lines.push([]); curW = 0;
    }
    lines[lines.length - 1].push({ obj, w });
    curW += w;
  }

  // 4) 라인별 폭 계산 → align 처리
  const totalH = lines.length * lineH + (lines.length - 1) * lineSpacing;
  let yCur = 0;
  for (const line of lines) {
    const lw = line.reduce((s, it) => s + (it.w || 0), 0);
    let xCur = align === 'center' ? -lw / 2 : (align === 'right' ? -lw : 0);
    for (const it of line) {
      if (it.space) { xCur += it.w; continue; }
      it.obj.setPosition(xCur, yCur);
      container.add(it.obj);
      xCur += it.w;
    }
    yCur += lineH + lineSpacing;
  }
  if (originY !== 0) container.y -= totalH * originY;
  container._textHeight = totalH;
  return container;
}

// ── 카드 (테두리 있는 면) ──
export function makeCard(scene, x, y, width, height, opts = {}) {
  const fillColor = opts.fill ? Phaser.Display.Color.HexStringToColor(opts.fill).color : 0x1B2433;
  const card = scene.add.rectangle(x, y, width, height, fillColor);
  const borderColor = opts.border
    ? Phaser.Display.Color.HexStringToColor(opts.border).color
    : 0x3D4A5F;
  card.setStrokeStyle(opts.borderWidth || 1, borderColor);
  return card;
}
