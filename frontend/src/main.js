// 게임 시작점
// 폰트 로드 완료 후 Phaser 시작 → fallback 첫 렌더 방지

import Phaser from 'phaser';
import './style.css';
import StudioIntroScene from './scenes/StudioIntroScene.js';
import SplashScene from './scenes/SplashScene.js';
import MenuScene from './scenes/MenuScene.js';
import StageScene from './scenes/StageScene.js';
import GameScene from './scenes/GameScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import UpgradeShopScene from './scenes/UpgradeShopScene.js';
import ChallengeScene from './scenes/ChallengeScene.js';
import AdminScene from './scenes/AdminScene.js';
import BossEditScene from './scenes/BossEditScene.js';
import EnemyEditScene from './scenes/EnemyEditScene.js';
import { loadSettings } from './data/settings.js';

loadSettings();

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  // [Phase P-7b] 캔버스 960×540 (16:9) → 1280×600 (≈21:9) — 휴대폰 화면 (19.5:9 ~ 21:9) 정합.
  //              검은 letterbox 영역 大폭 감소.
  //              인게임 UI 좌표 (TopBar / 카드 모달 / 매점) 변경 X — 캔버스 안 좌측 정렬됨.
  //              인게임 배경 (bg_stage_*) 은 displaySize=W,H 로 자동 늘어나 시각 자연스러움.
  width: 1280,
  height: 600,
  backgroundColor: '#000000',
  // [Phase P-2] pixelArt: true → false. 텍스트 NEAREST 픽셀화 문제 해결.
  //              sprite (잡몹/보스/캐릭터/배경 PNG) 픽셀 모양은 PIXEL_TEXTURE_KEYS 로
  //              씬마다 개별 NEAREST 필터 적용 (data/spriteOptions.js + 씬 헬퍼).
  pixelArt: false,
  antialias: true,
  // [Phase P-7e] resolution 옵션 제거 — Phaser 4 에서 동작이 Phaser 3 과 달라
  //   DPR 3 휴대폰에서 캔버스가 1/3 크기로 축소되는 현상 발생.
  //   대안: P-3 폰트 +25% / P-4 Galmuri11 비트맵으로 sharper rendering 효과 대체.
  scale: {
    mode: Phaser.Scale.FIT,
    // [Phase P-17] parent 명시 — Phaser FIT 이 #app (100vw×100vh) 기준으로 측정.
    //   config.parent 가 scale 에 자동 전파 안 되는 Phaser 4 사례 — 명시로 안전.
    //   누락 시 body / documentElement fallback → #app (position:fixed) 측정 0 →
    //   FIT 실패 → native 1280×600 letterbox 작게 표시 (데스크탑 1920×1080 시 가운데 작은 박스).
    parent: 'app',
    // [Phase P-18] expandParent: false 제거 — Phaser 자동 sizing 복원.
    //   P-17 의 false 가 데스크탑 F12 토글 / 창 리사이즈 시 fit 재계산 사이클 일부 누락 유발.
    //   #app 가 이미 100vw/100vh 라 Phaser 가 추가로 늘리지 않음 (디폴트 true 안전).
    // [Phase P-15] autoCenter CENTER_BOTH → NO_CENTER —
    //   Phaser 4 의 autoCenter 가 P-13/P-14 측정에서 가운데 정렬 미작동.
    //   CSS 의 absolute + translate(-50%, -50%) 로 직접 가운데 강제 (style.css).
    //   Phaser 가 canvas margin/transform 건드리지 않게 하여 CSS 와 충돌 회피.
    autoCenter: Phaser.Scale.NO_CENTER,
    width: 1280,
    height: 600,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [StudioIntroScene, SplashScene, MenuScene, StageScene, GameScene, SettingsScene, UpgradeShopScene, ChallengeScene, AdminScene, BossEditScene, EnemyEditScene],
};

// [Phase P-44 후속] _cleanupLeftovers 제거 — 새 페이지 reload 후 잔재 X (자연 소멸).
//   옛 P-33 의 정리 코드가 일부 환경에서 캔버스 정상 생성을 방해 → 검은 화면 유발.
//   페이지 전체 reload 라 옛 인스턴스 자동 destroy. 명시적 정리 불필요.
async function startGame() {
  try {
    await document.fonts.ready;
    // [Phase P-4] 한글 글리프 명시적 preload — Galmuri11 (게임 UI 표준 픽셀 비트맵 폰트).
    // text 인자로 실제 사용할 한글 문자를 지정해서 해당 글리프 로드 보장.
    // ⚠ Galmuri11 은 비트맵이라 weight 무시 — 단일 weight (400) 만 의미 있음.
    const koGlyphs = '게임시작이어하기새환경설정도전테스트개발자모드보통어려움매우';
    await Promise.all([
      document.fonts.load('400 11px "Galmuri11"', koGlyphs),
      document.fonts.load('400 14px "Galmuri11"', koGlyphs),
      document.fonts.load('400 16px "Galmuri11"', koGlyphs),
      document.fonts.load('400 18px "Galmuri11"', koGlyphs),
      document.fonts.load('400 20px "Galmuri11"', koGlyphs),
      document.fonts.load('400 22px "Galmuri11"', koGlyphs),
      document.fonts.load('500 64px "Cinzel"'),
      document.fonts.load('500 32px "Cinzel"'),
    ]);
  } catch (err) {
    console.warn('[Font] Load error, starting anyway:', err);
  }
  const game = new Phaser.Game(config);
  window.game = game;

  // [Phase P-7e → P-9 → P-18] resize / orientationchange 리스너 — 캔버스 강제 재계산.
  //   P-9: 풀스크린 / 회전 자동화 모두 제거 — 사용자 자율.
  //        리스너는 보존 (사용자가 가로/세로 바꿀 때 캔버스 자동 적응 — Phaser scale FIT 보험).
  //   P-18: 데스크탑 F12 토글 / 창 리사이즈 시 fit 불안정 보강.
  //         원인: resize 이벤트 시점 window.innerWidth/innerHeight 갱신 전 →
  //               즉시 refresh() 시 옛 값으로 fit 계산 → 다음 프레임 보정 누락.
  //         해결: requestAnimationFrame 으로 다음 프레임 refresh — viewport 안정화 후 측정.
  //         + 연속 resize (드래그) 시 RAF debounce 로 매 프레임 호출 누적 방지.
  let _resizeRafId = null;
  const refreshScale = () => {
    if (_resizeRafId) cancelAnimationFrame(_resizeRafId);
    _resizeRafId = requestAnimationFrame(() => {
      _resizeRafId = null;
      if (window.game && window.game.scale) window.game.scale.refresh();
    });
  };
  window.addEventListener('resize', refreshScale);
  window.addEventListener('orientationchange', () => {
    // orientationchange 후 viewport 사이즈가 늦게 갱신되는 환경 대비 100ms 대기 → RAF
    setTimeout(refreshScale, 100);
  });

  // 백그라운드 시 게임/사운드 정지 (모바일 알림 / 앱 전환).
  document.addEventListener('visibilitychange', () => {
    if (!window.game) return;
    if (document.hidden) {
      try { window.game.sound && window.game.sound.pauseAll && window.game.sound.pauseAll(); } catch {}
      try { window.game.loop && window.game.loop.sleep && window.game.loop.sleep(); } catch {}
    } else {
      try { window.game.loop && window.game.loop.wake && window.game.loop.wake(); } catch {}
      try { window.game.sound && window.game.sound.resumeAll && window.game.sound.resumeAll(); } catch {}
    }
  });

  // [Phase P-18] 첫 시작 후 보험 refresh — 초기 fit 누락 사례 방어.
  //   Phaser.Game 생성 직후엔 parent 측정 / canvas inline style 박힘이 1 프레임 늦게 안정화.
  //   다음 프레임에 명시적 refresh 호출로 첫 fit 안정성 보강.
  requestAnimationFrame(refreshScale);
}

startGame();

// [Phase P-44 후속] import.meta.hot 핸들러 모두 제거 — polling reload 만 담당.
//   옛 dispose / on('vite:beforeFullReload') / on('force-page-reload') / decline() 모두 제거.
//   vite 의 page reload 메시지가 자동으로 location.reload() 트리거.
