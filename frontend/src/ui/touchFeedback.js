// 글로벌 터치 피드백 — 모든 씬에서 동일 작동.
//   탭 시 (UI/빈공간 무관) 흰 ripple (동심원 + 회색 외곽).
//
// 사용: attachTouchFeedback(this) — Scene.create() 안에서 호출.
//   씬 wake 시 자동 재부착, shutdown 시 핸들러 정리.

const COLOR_WHITE = 0xFFFFFF;
const COLOR_GRAY  = 0x888888;
const DEPTH_FX = 9999;

// Ripple — 흰 동심원 + 회색 외곽 (은은한 톤).
function _spawnRipple(scene, x, y) {
  // 회색 외곽 링.
  const ringDark = scene.add.circle(x, y, 7, 0x000000, 0).setDepth(DEPTH_FX);
  ringDark.setStrokeStyle(1, COLOR_GRAY, 0.3);
  ringDark.setScrollFactor(0);
  scene.tweens.add({
    targets: ringDark, scale: 6, alpha: 0,
    duration: 320, ease: 'Sine.easeOut',
    onComplete: () => ringDark.destroy(),
  });
  // 흰 동심원.
  const ring = scene.add.circle(x, y, 6, COLOR_WHITE, 0).setDepth(DEPTH_FX + 1);
  ring.setStrokeStyle(1, COLOR_WHITE, 0.55);
  ring.setScrollFactor(0);
  scene.tweens.add({
    targets: ring, scale: 6, alpha: 0,
    duration: 320, ease: 'Sine.easeOut',
    onComplete: () => ring.destroy(),
  });
  // 부드러운 흰 채움.
  const flash = scene.add.circle(x, y, 8, COLOR_WHITE, 0.25).setDepth(DEPTH_FX);
  flash.setScrollFactor(0);
  scene.tweens.add({
    targets: flash, scale: 3.0, alpha: 0,
    duration: 280, ease: 'Sine.easeOut',
    onComplete: () => flash.destroy(),
  });
}

/**
 * 씬에 글로벌 터치 피드백 부착 — Ripple 만 표시.
 * @param {Phaser.Scene} scene
 */
export function attachTouchFeedback(scene) {
  const handler = (pointer) => {
    if (!pointer) return;
    const x = pointer.x, y = pointer.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    _spawnRipple(scene, x, y);
  };

  // 중복 등록 방지.
  if (scene._touchFeedbackHandler) {
    try { scene.input.off('pointerdown', scene._touchFeedbackHandler); } catch {}
  }
  scene.input.on('pointerdown', handler);
  scene._touchFeedbackHandler = handler;

  // 씬 lifecycle.
  if (!scene._touchFeedbackLifecycleBound) {
    scene._touchFeedbackLifecycleBound = true;
    scene.events.on('wake', () => attachTouchFeedback(scene));
    scene.events.on('shutdown', () => {
      if (scene._touchFeedbackHandler) {
        try { scene.input.off('pointerdown', scene._touchFeedbackHandler); } catch {}
        scene._touchFeedbackHandler = null;
      }
    });
  }
}
