// 스플래시 / 로딩 씬 — 메인 메뉴(MenuScene) 톤 통일 (미니멀 다크 판타지)
// 단색 검정 배경 + 우아한 회색 로고 + 진행도별 카피 변주 + 검 프로그레스 바

import Phaser from 'phaser';
import { FONT } from '../ui/theme.js';
import { applyNearestToPixelTextures } from '../data/spriteOptions.js';

// 다크 판타지 세리프 스택 — MenuScene과 동일
// 진행도별 카피 4단계 — 임시 placeholder (게임 완성 후 교체 예정)
const PROGRESS_COPIES = [
  { until: 0.25, text: '출발' },
  { until: 0.50, text: '여정' },
  { until: 0.75, text: '결의' },
  { until: 1.01, text: '도착' },
];

function progressIdx(p) {
  for (let i = 0; i < PROGRESS_COPIES.length; i++) {
    if (p <= PROGRESS_COPIES[i].until) return i;
  }
  return PROGRESS_COPIES.length - 1;
}

export default class SplashScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SplashScene' });
  }

  preload() {
    this.load.image('background', 'sprites/menuui/main-menu.png');
  }

  create() {
    // [Phase P-2] sprite 텍스처 NEAREST 필터 적용
    applyNearestToPixelTextures(this);
    const W = this.scale.width, H = this.scale.height;

    // === 배경 — MenuScene PNG 재활용 + 어두운 오버레이 + 라디얼 글로우 ===
    // 1) 베이스 검정 (PNG 로드 실패 시 폴백)
    this.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0x000000).setDepth(-11);
    // 2) 메인 메뉴 배경 PNG (달 + 마왕성 + 캐릭터 흐릿하게)
    this.add.image(W * 0.5, H * 0.5, 'background')
      .setOrigin(0.5, 0.5).setDepth(-10).setDisplaySize(W, H);
    // 3) 검정 오버레이 — 분위기는 살리되 어둡게 (메인 메뉴와 차별)
    this.add.rectangle(W * 0.5, H * 0.5, W, H, 0x000000, 0.75)
      .setOrigin(0.5, 0.5).setDepth(-9.5);
    // 4) 콘텐츠 중심 라디얼 글로우 — 살짝 약화 (오버레이와 합산 시 너무 어두워지지 않게)
    const GLOW_CX = W * 0.5, GLOW_CY = H * 0.48;
    const GLOW_RINGS = 14;
    const GLOW_MAX_R = Math.max(W, H) * 0.55;
    for (let i = 0; i < GLOW_RINGS; i++) {
      const t = i / (GLOW_RINGS - 1);
      const r = GLOW_MAX_R * (1 - t * 0.88);
      this.add.circle(GLOW_CX, GLOW_CY, r, 0x1F2530, 0.030).setDepth(-9);
    }

    // === 진행도 카피 — 화면 중앙, 변주, fade in/out ===
    const phraseTxt = this.add.text(W * 0.5, H * 0.48, PROGRESS_COPIES[0].text, {
      fontFamily: FONT,
      fontSize: '20px',
      color: '#9A9AA2',
      fontStyle: '500',
      align: 'center',
      letterSpacing: 1,
    }).setOrigin(0.5).setAlpha(0);
    phraseTxt.setShadow(0, 1, '#000000', 3, false, true);

    let currentPhraseIdx = 0;
    const swapPhrase = (newIdx) => {
      if (newIdx === currentPhraseIdx) return;
      currentPhraseIdx = newIdx;
      this.tweens.add({
        targets: phraseTxt, alpha: 0, duration: 200, ease: 'Sine.easeIn',
        onComplete: () => {
          phraseTxt.setText(PROGRESS_COPIES[newIdx].text);
          this.tweens.add({ targets: phraseTxt, alpha: 1, duration: 200, ease: 'Sine.easeOut' });
        },
      });
    };

    // 진행률 % — 카피 바로 아래
    const percentTxt = this.add.text(W * 0.5, H * 0.52, '0%', {
      fontFamily: FONT, fontSize: '15px', color: '#6A6A72',
      fontStyle: '500', letterSpacing: 1,
    }).setOrigin(0.5, 0.5).setAlpha(0);

    // === 진행 라인 — 1px 얇은 가로 바, % 아래 ===
    const LINE_W = W * 0.25;
    const LINE_Y = H * 0.55;
    const LINE_LX = W * 0.5 - LINE_W / 2;
    // 빈 부분
    const lineBg = this.add.rectangle(LINE_LX, LINE_Y, LINE_W, 1, 0x2A2A2F)
      .setOrigin(0, 0.5).setAlpha(0);
    // 채워진 부분
    const lineFill = this.add.rectangle(LINE_LX, LINE_Y, 0, 1, 0x6A6A72)
      .setOrigin(0, 0.5).setAlpha(0);
    // 채워진 끝 작은 점 (3×3)
    const lineDot = this.add.rectangle(LINE_LX, LINE_Y, 3, 3, 0x9A9AA2)
      .setAlpha(0);

    // 작은 크레딧 — 우측 하단
    const credit = this.add.text(W * 0.97, H * 0.97, 'false hero studios', {
      fontFamily: FONT, fontSize: '11px', color: '#4A4A4A', letterSpacing: 1,
    }).setOrigin(1, 1).setAlpha(0);

    // === 시퀀스 트윈 — 카피/진행/크레딧만 (게임 제목 제거) ===
    this.tweens.add({
      targets: [phraseTxt, percentTxt, lineBg, lineFill, lineDot, credit],
      alpha: 1, duration: 500, delay: 400,
    });

    // === 진행 트윈 — 카피 변주 + % + 진행 라인 ===
    const loadProgress = { p: 0 };
    this.tweens.add({
      targets: loadProgress, p: 1,
      duration: 4000, ease: 'Sine.easeInOut', delay: 1500,
      onUpdate: () => {
        const p = loadProgress.p;
        percentTxt.setText(`${Math.floor(p * 100)}%`);
        // 진행 라인 채우기 + 끝 점 위치 갱신
        const w = LINE_W * p;
        lineFill.width = w;
        lineDot.x = LINE_LX + w;
        swapPhrase(progressIdx(p));
      },
    });

    // 메뉴로 — 채움 끝(1500+4000=5500) + 여운 1초 → 6.5s. 입력 스킵 없음.
    this.time.delayedCall(6500, () => this._goToMenu());
  }

  _goToMenu() {
    if (this._transitioning) return;
    this._transitioning = true;
    this.cameras.main.fadeOut(420, 10, 10, 15);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }
}
