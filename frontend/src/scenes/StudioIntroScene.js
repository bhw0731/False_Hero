// 스튜디오 인트로 — 두 줄 + 모서리 데코 + 한 글자씩 잉크 번짐 (영화 액자 톤)

import Phaser from 'phaser';

const TITLE_FONT = '"Cinzel", "Cinzel Decorative", "Times New Roman", serif';
const SUB_FONT   = '"Cormorant Garamond", "Times New Roman", serif';

const COL_FILL_FINAL = '#FFFFFF';   // 흰색 (영화 인트로 정석)
const COL_FILL_INK   = '#5A5A5A';   // 어두운 회색 (잉크 번짐 시작)

export default class StudioIntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StudioIntroScene' });
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0x000000).setDepth(-10);

    // === 메인 텍스트 — 두 줄, 한 글자씩 잉크 번짐 ===
    const linesSpec = [
      { text: 'NONG',  y: H * 0.42, fontSize: '90px', letterSpacing: 16, startDelay: 700 },
      { text: 'GAMES', y: H * 0.54, fontSize: '90px', letterSpacing: 14, startDelay: 1500 },
    ];

    const allLetters = [];
    linesSpec.forEach(spec => {
      const style = {
        fontFamily: TITLE_FONT,
        fontSize: spec.fontSize,
        fontStyle: '900',
        letterSpacing: spec.letterSpacing,
      };
      // 폭 측정 헬퍼 — letterSpacing 포함된 실제 너비
      const measure = (s) => {
        if (!s) return 0;
        const t = this.add.text(0, 0, s, style).setVisible(false);
        const w = t.width; t.destroy(); return w;
      };
      const totalW = measure(spec.text);
      const startX = W * 0.5 - totalW / 2;

      let visibleIdx = 0;
      for (let i = 0; i < spec.text.length; i++) {
        const ch = spec.text[i];
        if (ch === ' ') continue;
        const xBefore = measure(spec.text.substring(0, i));
        const xAfter  = measure(spec.text.substring(0, i + 1));
        const cx = startX + (xBefore + xAfter) / 2;

        const t = this.add.text(cx, spec.y, ch, { ...style, color: COL_FILL_INK })
          .setOrigin(0.5, 0.5).setAlpha(0).setScale(0.7);
        allLetters.push(t);

        const delay = spec.startDelay + visibleIdx * 200;
        // alpha + scale tween
        this.tweens.add({
          targets: t, alpha: 1, scale: 1,
          duration: 600, ease: 'Power2.easeOut', delay,
        });
        // 색 보간 (어두운 핑크 → 연한 핑크)
        this.time.delayedCall(delay, () => {
          const counter = { t: 0 };
          const sR = 0x5A, sG = 0x5A, sB = 0x5A;     // 어두운 회색
          const eR = 0xFF, eG = 0xFF, eB = 0xFF;     // 흰색
          this.tweens.add({
            targets: counter, t: 1, duration: 600, ease: 'Power2.easeOut',
            onUpdate: () => {
              const r = Math.round(sR + (eR - sR) * counter.t);
              const g = Math.round(sG + (eG - sG) * counter.t);
              const b = Math.round(sB + (eB - sB) * counter.t);
              const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
              t.setColor(hex);
            },
          });
        });
        visibleIdx++;
      }
    });

    // === 부 텍스트 — presents (2.5s 페이드인) ===
    const presents = this.add.text(W * 0.5, H * 0.62, 'presents', {
      fontFamily: SUB_FONT,
      fontSize: '18px',
      fontStyle: '400',
      letterSpacing: 16,
      color: COL_FILL_FINAL,
    }).setOrigin(0.5, 0.5).setAlpha(0);
    this.tweens.add({
      targets: presents, alpha: 0.5,
      duration: 800, ease: 'Sine.easeOut', delay: 2500,
    });

    // === 페이드아웃 (4.5s, 600ms) ===
    this.tweens.add({
      targets: [...allLetters, presents], alpha: 0,
      duration: 600, ease: 'Sine.easeIn', delay: 4500,
    });

    // 다음 씬 전환
    let advanced = false;
    const goNext = () => {
      if (advanced) return;
      advanced = true;
      this.cameras.main.fadeOut(380, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('SplashScene');
      });
    };

    this.time.delayedCall(5100, goNext);

    // 클릭 스킵 (개발 편의)
    this.input.once('pointerdown', goNext);
  }
}
