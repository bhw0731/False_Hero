// 일시정지 / 환경설정 모달 — 게임 진행 중 프리징 모달.
//   - showPauseMenu       ☰ 아이콘 / ESC 시 표시. [계속하기] [환경설정] [메뉴로]
//   - showSettingsModal   환경설정 — BGM/SFX 슬라이더 + 화면 흔들림 토글 + [← 뒤로]
//
// fromPause 분기 — 일시정지에서 진입 시 캐릭터 움찔거림 방지 위해
// pause 모달은 close 하지 않고 visible=false 로 숨김 + setBgmVolume 즉시 반영.

import Phaser from 'phaser';
import { createModal } from './Modal.js';
import { makeGlassBtn } from '../glassBtn.js';
import { gameSettings, saveSettings } from '../../data/settings.js';
import { sound } from '../../systems/SoundManager.js';
import { FONT, addText } from '../theme.js';

const COLOR_GOLD       = '#C5A059';
const COLOR_TEXT_PRI   = '#E8E8E8';
const COLOR_TEXT_2ND   = '#9A9AA2';
const COLOR_TEXT_MUTED = '#6A6A72';
const GOLD_HEX         = 0xC5A059;

// === 일시정지 모달 ===
export function showPauseMenu(scene) {
  if (scene.pauseMenuActive) return;
  if (scene._activeModal && !scene._activeModal._closed) return;
  scene.pauseMenuActive = true;

  // [Phase P-28] collapsable 제거 + H 380 → 340 원복 (단순 조회 모달, ESC 로 종료).
  // [Phase P-45] H 340 → 380 — "도움말" 항목 추가로 +1 row.
  const W = 400, H = 380;
  const modal = createModal(scene, {
    title: '일시정지',
    width: W, height: H,
    pauseGame: true,
    showOverlay: true,
    overlayCloses: false,
    onClose: () => {
      scene.pauseMenuActive = false;
      scene._pauseModal = null;
    },
  });
  scene._pauseModal = modal;  // 환경설정에서 참조 (visible 토글)

  // 안내 텍스트
  const info = addText(scene, 0, modal.bodyTopY + 24, '게임이 일시 정지되었습니다', {
    fontFamily: FONT, fontSize: '20px', color: COLOR_TEXT_2ND, fontStyle: '500',
  }).setOrigin(0.5);
  info.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(info);

  // [▶ 계속하기] — 강조
  makeGlassBtn(scene, {
    x: 0, y: modal.bodyTopY + 70, w: 200, h: 40,
    label: '계속하기', fontSize: '22px',
    color: COLOR_GOLD, baseAlpha: 0.45, hoverAlpha: 0.6,
    parent: modal.body, stopPropagation: true,
    onClick: () => modal.close(),
  });

  // [Phase P-45] 도움말 — 계속하기 다음, HelpModal 진입.
  //   일시정지 모달 visible:false 로 숨김 (옛 환경설정 패턴) — _activeModal=null 후 HelpModal createModal.
  makeGlassBtn(scene, {
    x: 0, y: modal.bodyTopY + 125, w: 200, h: 36,
    label: '도움말', fontSize: '20px',
    color: COLOR_TEXT_2ND, baseAlpha: 0.3, hoverAlpha: 0.45,
    parent: modal.body, stopPropagation: true,
    onClick: () => {
      // stash 로 부모 모달 안전하게 숨김 (ESC 핸들러도 같이 detach).
      if (modal._stash) modal._stash();
      else { if (modal.container) modal.container.setVisible(false); scene._activeModal = null; }
      if (scene.showHelpModal) scene.showHelpModal({ fromPause: true, _pauseModal: modal });
    },
  });

  // [⚙ 환경설정] — 일시정지 모달은 닫지 않고 visible=false 로 숨김
  // (close 시 physics.resume() 호출되어 캐릭터 움찔거림 발생 → 숨김으로 회피)
  makeGlassBtn(scene, {
    x: 0, y: modal.bodyTopY + 175, w: 200, h: 36,
    label: '환경설정', fontSize: '20px',
    color: COLOR_TEXT_2ND, baseAlpha: 0.3, hoverAlpha: 0.45,
    parent: modal.body, stopPropagation: true,
    onClick: () => {
      // stash 로 부모 모달 안전하게 숨김 (ESC 핸들러도 같이 detach).
      if (modal._stash) modal._stash();
      else { if (modal.container) modal.container.setVisible(false); scene._activeModal = null; }
      scene.showSettingsModal({ fromPause: true, _pauseModal: modal });
    },
  });

  // [🚪 메뉴로 나가기]
  makeGlassBtn(scene, {
    x: 0, y: modal.bodyTopY + 225, w: 200, h: 36,
    label: '메뉴로 나가기', fontSize: '20px',
    color: COLOR_TEXT_2ND, baseAlpha: 0.3, hoverAlpha: 0.45,
    parent: modal.body, stopPropagation: true,
    onClick: () => {
      scene.pauseMenuActive = false;
      scene.scene.start('MenuScene');
    },
  });

  // 안내 문구
  const hint = addText(scene, 0, modal.bodyTopY + 285, '※ 메뉴로 나가면 현재 웨이브 진행도가 사라집니다', {
    fontFamily: FONT, fontSize: '18px', color: COLOR_TEXT_MUTED,
  }).setOrigin(0.5);
  hint.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(hint);
}

// === 환경설정 모달 — 일시정지에서 진입 시 fromPause=true ===
export function showSettingsModal(scene, opts = {}) {
  const fromPause = opts.fromPause === true;
  const W = 440, H = 360;
  const cleanups = [];

  const modal = createModal(scene, {
    title: '⚙ 환경설정',
    width: W, height: H,
    // 일시정지에서 왔으면 이미 멈춰있음 — 중복 pause/resume 방지 (캐릭터 움찔거림 원인)
    pauseGame: !fromPause,
    showOverlay: true,
    showCloseButton: true,
    overlayCloses: false,
    onClose: () => {
      cleanups.forEach(fn => fn());
      const parentPM = (opts && opts._pauseModal) || scene._pauseModal;
      if (fromPause && parentPM && !parentPM._closed) {
        if (parentPM._restore) parentPM._restore();
        else if (parentPM.container) { parentPM.container.setVisible(true); scene._activeModal = parentPM; }
      }
    },
  });

  // === 슬라이더 헬퍼 ===
  // 트랙 cx=-50, 폭 200 → 본문 좌표로 트랙 좌단 -150, 우단 +50
  // 모달 cx 캔버스 가운데 → 글로벌 pointer.x 변환 시 -cx 보정
  // [Phase P-19] 캔버스 1280 정합 — px - 480 → px - canvasW/2 (동적).
  const canvasCx = (scene.scale && scene.scale.width || 1280) / 2;
  const makeSlider = (y, label, getValue, setValue) => {
    const TRACK_CX = -50, TRACK_W = 200, TRACK_H = 6;
    const TRACK_LEFT = TRACK_CX - TRACK_W / 2;

    const lbl = addText(scene, -180, y, label, {
      fontFamily: FONT, fontSize: '20px', color: COLOR_TEXT_PRI, fontStyle: '700',
    }).setOrigin(0, 0.5);
    lbl.setShadow(1, 1, '#000000', 2, false, true);

    const trackBg = scene.add.graphics();
    const trackFill = scene.add.graphics();
    const handle = scene.add.circle(TRACK_LEFT, y, 6, GOLD_HEX).setStrokeStyle(1, 0x000000);
    const pct = addText(scene, 170, y, '0%', {
      fontFamily: FONT, fontSize: '20px', color: COLOR_GOLD, fontStyle: '700',
    }).setOrigin(1, 0.5);
    pct.setShadow(1, 1, '#000000', 2, false, true);

    const redraw = (val) => {
      val = Phaser.Math.Clamp(val, 0, 100);
      trackBg.clear();
      trackBg.fillStyle(0xFFFFFF, 0.2);
      trackBg.fillRoundedRect(TRACK_LEFT, y - TRACK_H / 2, TRACK_W, TRACK_H, 3);
      trackFill.clear();
      const fillW = TRACK_W * val / 100;
      if (fillW > 0) {
        trackFill.fillStyle(GOLD_HEX, 0.7);
        trackFill.fillRoundedRect(TRACK_LEFT, y - TRACK_H / 2, fillW, TRACK_H, 3);
      }
      handle.x = TRACK_LEFT + TRACK_W * val / 100;
      pct.setText(Math.round(val) + '%');
    };
    redraw(Math.round(getValue() * 100));

    // 트랙 + 패딩 hit zone (드래그 시작 + 트랙 클릭 점프)
    const hit = scene.add.rectangle(TRACK_CX, y, TRACK_W + 24, 24, 0x000000, 0.001)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });

    let dragging = false;
    const updateFromPointer = (px) => {
      const localX = px - canvasCx;
      const val = ((localX - TRACK_LEFT) / TRACK_W) * 100;
      const clamped = Phaser.Math.Clamp(val, 0, 100);
      setValue(clamped / 100);
      redraw(clamped);
    };

    hit.on('pointerdown', (p, lx, ly, ev) => {
      if (ev) ev.stopPropagation();
      dragging = true;
      updateFromPointer(p.x);
    });

    const moveHandler = (p) => { if (dragging) updateFromPointer(p.x); };
    const upHandler   = () => { dragging = false; };
    scene.input.on('pointermove', moveHandler);
    scene.input.on('pointerup',   upHandler);
    cleanups.push(() => {
      scene.input.off('pointermove', moveHandler);
      scene.input.off('pointerup',   upHandler);
    });

    modal.body.add([lbl, trackBg, trackFill, handle, pct, hit]);
  };

  // === iOS 토글 헬퍼 ===
  const makeToggle = (y, label, getValue, setValue) => {
    const TRACK_X = 130, TRACK_W = 50, TRACK_H = 26;

    const lbl = addText(scene, -180, y, label, {
      fontFamily: FONT, fontSize: '20px', color: COLOR_TEXT_PRI, fontStyle: '700',
    }).setOrigin(0, 0.5);
    lbl.setShadow(1, 1, '#000000', 2, false, true);

    const trackBg = scene.add.graphics();
    const handle = scene.add.circle(0, y, 11, 0xFFFFFF);

    const redraw = (val) => {
      trackBg.clear();
      trackBg.fillStyle(val ? GOLD_HEX : 0x808080, val ? 0.7 : 0.3);
      trackBg.fillRoundedRect(TRACK_X - TRACK_W / 2, y - TRACK_H / 2, TRACK_W, TRACK_H, 13);
    };
    redraw(getValue());
    handle.x = getValue() ? TRACK_X + 12 : TRACK_X - 12;

    const hit = scene.add.rectangle(TRACK_X, y, TRACK_W, TRACK_H, 0x000000, 0.001)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p, lx, ly, ev) => {
      if (ev) ev.stopPropagation();
      const newVal = !getValue();
      setValue(newVal);
      redraw(newVal);
      scene.tweens.add({
        targets: handle,
        x: newVal ? TRACK_X + 12 : TRACK_X - 12,
        duration: 200, ease: 'Cubic.easeOut',
      });
    });

    modal.body.add([lbl, trackBg, handle, hit]);
  };

  // === 항목 3개 ===
  makeSlider(modal.bodyTopY + 30, '🔊 BGM 볼륨',
    () => gameSettings.bgmVolume,
    (v) => { gameSettings.bgmVolume = v; saveSettings(); sound.setBgmVolume(v); }
  );
  makeSlider(modal.bodyTopY + 90, '🔉 효과음 볼륨',
    () => gameSettings.sfxVolume,
    (v) => { gameSettings.sfxVolume = v; saveSettings(); }
  );
  makeToggle(modal.bodyTopY + 150, '📺 화면 흔들림',
    () => gameSettings.screenShake !== false,
    (v) => { gameSettings.screenShake = v; saveSettings(); }
  );

  // [← 뒤로] 버튼
  makeGlassBtn(scene, {
    x: 0, y: modal.bodyTopY + 240, w: 120, h: 34,
    label: '← 뒤로', fontSize: '20px',
    color: COLOR_TEXT_2ND,
    parent: modal.body, stopPropagation: true,
    onClick: () => modal.close(),
  });
}
