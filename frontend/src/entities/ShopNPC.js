// 매점 NPC entity — 무한 맵 상에 고정 배치. 플레이어 근접 시 매점 모달 자동 진입.
//   visited 후 sprite fade. 다시 방문 X.
//
// [P-70] 헤럴드 메달리온 톤 — 어두운 베이스 + 골드 링 + 금화 각인 그래픽 (라벨 텍스트 제거).

const NPC_RADIUS = 22;
const BASE_COLOR  = 0x1A1208;     // 어두운 가죽 톤 베이스
const RING_COLOR  = 0xC5A059;     // 다크 골드 링
const COIN_BRIGHT = 0xE5C26B;     // 금화 본체
const COIN_DARK   = 0x6A4A1F;     // 금화 음영/각인
const APPROACH_DIST = 90;         // 근접 트리거 거리 (player.x ↔ npc.x)
const FADE_OUT_MS   = 380;        // 사용 후 페이드 시간 → 완전 소멸.

export default class ShopNPC {
  constructor(scene, x, y = 446) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.visited = false;

    // 베이스 원판.
    this.bg = scene.add.circle(x, y, NPC_RADIUS, BASE_COLOR, 0.92)
      .setStrokeStyle(2, RING_COLOR, 1)
      .setDepth(8);

    // 아이콘 — 금화 + 다이아몬드 각인 (그래픽으로 직접 그림, 라벨 텍스트 제거).
    this.icon = scene.add.graphics().setDepth(9);
    this.icon.x = x; this.icon.y = y;
    const r = 11;
    // 금화 본체.
    this.icon.fillStyle(COIN_BRIGHT, 1);
    this.icon.fillCircle(0, 0, r);
    this.icon.lineStyle(1.5, COIN_DARK, 1);
    this.icon.strokeCircle(0, 0, r);
    // 다이아몬드(◆) 각인.
    this.icon.fillStyle(COIN_DARK, 1);
    this.icon.fillTriangle(0, -r * 0.55,  -r * 0.45, 0,   r * 0.45, 0);
    this.icon.fillTriangle(0,  r * 0.55,  -r * 0.45, 0,   r * 0.45, 0);

    // 부드러운 부유 애니메이션.
    scene.tweens.add({
      targets: [this.bg, this.icon],
      y: y - 6,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // 매 프레임 호출 — 플레이어 근접 체크
  update(player) {
    if (this.visited) return;
    if (!player || !player.sprite) return;
    const dist = Math.abs(player.sprite.x - this.x);
    if (dist < APPROACH_DIST) {
      this.visited = true;
      this._fade();
      // 매점 진입 — 모달 emit
      if (this.scene.events && this.scene.events.emit) {
        this.scene.events.emit('show-shop');
      }
    }
  }

  _fade() {
    if (!this.scene || !this.scene.tweens) return;
    // 부유 애니메이션 정지 → 페이드 아웃 → 완전 소멸 (잔상 X).
    this.scene.tweens.killTweensOf([this.bg, this.icon]);
    this.scene.tweens.add({
      targets: [this.bg, this.icon],
      alpha: 0,
      duration: FADE_OUT_MS,
      ease: 'Sine.easeOut',
      onComplete: () => this.destroy(),
    });
  }

  destroy() {
    if (this.bg && this.bg.destroy) this.bg.destroy();
    if (this.icon && this.icon.destroy) this.icon.destroy();
    this.bg = null; this.icon = null;
  }
}
