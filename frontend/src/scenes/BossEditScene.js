// 보스 편집 씬
// 4종 보스의 능력치 / 외형 / 이름을 수정. 변경 사항은 adminConfig 에 저장됨.

import Phaser from 'phaser';
import { bossTypes } from '../data/enemies/bosses.js';
import {
  getBossOverrides,
  setBossOverride,
  resetBossOverride,
} from '../data/adminConfig.js';
import { C, FONT, FONT_DISP, makeButton, makeTitle, makeText } from '../ui/theme.js';
import { BOSS_SPRITE_OPTIONS, cycleSprite, applyNearestToPixelTextures } from '../data/spriteOptions.js';

// 편집 가능한 능력치 필드 (잡몹 편집과 동일한 9개)
const FIELDS = [
  { key: 'baseHp',       label: 'HP',           min: 5,    max: 5000, step: 10  },
  { key: 'attackPower',  label: '공격력',        min: 1,    max: 200,  step: 1   },
  { key: 'defense',      label: '방어력',        min: 0,    max: 100,  step: 1   },
  { key: 'attackRange',  label: '사거리',        min: 40,   max: 250,  step: 5   },
  { key: 'attackSpeed',  label: '공격간격(ms)',  min: 200,  max: 3000, step: 50  },
  { key: 'dodgeChance',  label: '회피율(%)',     min: 0,    max: 90,   step: 5,
    toDisplay: v => Math.round(v * 100), fromDisplay: v => v / 100 },
  { key: 'size',         label: '크기',          min: 24,   max: 192,  step: 8   },
  { key: 'expReward',    label: '경험치',        min: 1,    max: 1000, step: 10  },
  { key: 'goldReward',   label: '골드',          min: 0,    max: 1000, step: 10  },
];

export default class BossEditScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BossEditScene' });
  }

  preload() {
    BOSS_SPRITE_OPTIONS.forEach(name => {
      this.load.image(name, `sprites/${name}.png`);
    });
  }

  create() {
    // [Phase P-2] sprite 텍스처 NEAREST 필터 적용
    applyNearestToPixelTextures(this);
    this.editingBossId = null;
    this.editValues = null;
    this.editSpriteName = BOSS_SPRITE_OPTIONS[0];
    this.elements = [];

    this.add.rectangle(480, 270, 960, 540, Phaser.Display.Color.HexStringToColor(C.bg).color);

    // 헤더 영역
    this.titleText = this.add.text(40, 40, '보스 편집', {
      fontFamily: FONT_DISP, fontSize: '30px', color: C.textHi, fontStyle: '600',
    }).setOrigin(0, 0.5);

    this.subtitleText = this.add.text(40, 65, '16종 보스의 능력치·외형·이름을 직접 수정', {
      fontFamily: FONT, fontSize: '15px', color: C.textDim,
    }).setOrigin(0, 0.5);

    this.makeBackButton();
    this.showList();
  }

  // === 8종 보스 카드 리스트 (스크롤 지원) ===
  showList() {
    this.editingBossId = null;
    this.titleText.setText('보스 편집');
    this.subtitleText.setText('보스의 능력치·외형·이름을 직접 수정 (마우스 휠로 스크롤)');
    this.subtitleText.setVisible(true);
    this.clearElements();
    this._teardownScroll();

    // 스크롤 영역 — 헤더 아래 ~ 화면 아래까지 (960×540)
    const SCROLL_TOP = 95;
    const SCROLL_BOTTOM = 710;
    const SCROLL_H = SCROLL_BOTTOM - SCROLL_TOP;

    this.cardsContainer = this.add.container(0, SCROLL_TOP);

    bossTypes.forEach((boss, i) => {
      const x = 240 + (i % 2) * 420;
      const y = 80 + Math.floor(i / 2) * 170;     // 컨테이너 기준 상대 좌표

      const merged = this.getMergedBoss(boss.id);
      const hasOverride = !!getBossOverrides()[boss.id];

      const card = this.add.rectangle(x, y, 360, 150,
        Phaser.Display.Color.HexStringToColor(C.surface).color);
      card.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(C.border).color);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => {
        card.fillColor = Phaser.Display.Color.HexStringToColor(C.surface2).color;
        card.setStrokeStyle(1, 0x6366F1);
      });
      card.on('pointerout', () => {
        card.fillColor = Phaser.Display.Color.HexStringToColor(C.surface).color;
        card.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(C.border).color);
      });
      card.on('pointerdown', () => this.showEdit(boss.id));

      const nameText = this.add.text(x - 165, y - 55, merged.name, {
        fontFamily: FONT, fontSize: '22px', color: C.textHi, fontStyle: '600',
      });
      const cardChildren = [card, nameText];

      if (hasOverride) {
        const badge = this.add.text(x - 165 + nameText.width + 8, y - 55, '커스텀', {
          fontFamily: FONT, fontSize: '12px', color: C.accent, fontStyle: '500',
          backgroundColor: '#3D2E0A', padding: { x: 6, y: 2 },
        });
        cardChildren.push(badge);
      }

      const stats = this.add.text(x - 165, y - 25,
        `HP  ${merged.baseHp}\n공격  ${merged.attackPower}\n사거리  ${merged.attackRange}\n` +
        `공속  ${merged.attackSpeed}ms\n회피  ${Math.round(merged.dodgeChance * 100)}%`,
        { fontFamily: FONT, fontSize: '14px', color: C.text, lineSpacing: 4 }
      );

      const previewBg = this.add.rectangle(x + 130, y, 80, 80, 0x0F1419);
      previewBg.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(C.border).color);
      const preview = this.add.image(x + 130, y, merged.spriteKey).setDisplaySize(64, 64);
      preview.setFlipX(true);

      cardChildren.push(stats, previewBg, preview);
      this.cardsContainer.add(cardChildren);
    });

    // 스크롤 영역 마스크 (밖으로 삐져나간 부분 안 보이게)
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, SCROLL_TOP, 960, SCROLL_H);
    this.cardsMask = maskShape.createGeometryMask();
    this.cardsContainer.setMask(this.cardsMask);

    // 스크롤 한계 계산
    const rowCount = Math.ceil(bossTypes.length / 2);
    const totalH = 80 + rowCount * 170 - 20;     // 마지막 카드 아래 약간 여유
    this.scrollMaxY = SCROLL_TOP;
    this.scrollMinY = SCROLL_TOP - Math.max(0, totalH - SCROLL_H);

    // 마우스 휠로 스크롤
    this.input.off('wheel', this._wheelHandler);
    this._wheelHandler = (pointer, objs, dx, dy) => {
      if (this.editingBossId !== null || !this.cardsContainer || !this.cardsContainer.active) return;
      this.cardsContainer.y = Phaser.Math.Clamp(
        this.cardsContainer.y - dy * 0.4, this.scrollMinY, this.scrollMaxY
      );
    };
    this.input.on('wheel', this._wheelHandler);

    // 스크롤 가능 표시 (우측 작은 인디케이터)
    if (totalH > SCROLL_H) {
      this.scrollHint = this.add.text(1260, SCROLL_BOTTOM - 14, '↕ 스크롤', {
        fontFamily: FONT, fontSize: '12px', color: C.textDim,
      }).setOrigin(1, 0.5);
    }
  }

  _teardownScroll() {
    if (this.cardsContainer) {
      this.cardsContainer.destroy(true);
      this.cardsContainer = null;
    }
    if (this.cardsMask) {
      this.cardsMask.destroy();
      this.cardsMask = null;
    }
    if (this.scrollHint) {
      this.scrollHint.destroy();
      this.scrollHint = null;
    }
  }

  // === 보스 1종 편집 화면 ===
  showEdit(bossId) {
    this.editingBossId = bossId;
    this.clearElements();

    const merged = this.getMergedBoss(bossId);
    this.editValues = {
      baseHp: merged.baseHp, attackPower: merged.attackPower,
      defense: merged.defense ?? 0,
      attackRange: merged.attackRange, attackSpeed: merged.attackSpeed,
      dodgeChance: merged.dodgeChance, size: merged.size,
      expReward: merged.expReward ?? 150, goldReward: merged.goldReward ?? 180,
    };
    this.editSpriteName = BOSS_SPRITE_OPTIONS.includes(merged.spriteKey)
      ? merged.spriteKey : BOSS_SPRITE_OPTIONS[0];
    this.editName = merged.name;

    this.titleText.setText(`보스 편집  ·  ${merged.name}`);
    this.subtitleText.setVisible(false);

    // 좌측 — 스프라이트 카드 (960×540 기준)
    const spriteCard = this.add.rectangle(200, 320, 240, 280, Phaser.Display.Color.HexStringToColor(C.surface).color);
    spriteCard.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(C.border).color);
    this.elements.push(spriteCard);

    this.elements.push(this.add.text(200, 205, '외형', {
      fontFamily: FONT, fontSize: '15px', color: C.textDim, fontStyle: '500',
    }).setOrigin(0.5));

    const previewBg = this.add.rectangle(200, 290, 160, 160, 0x0F1419);
    previewBg.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(C.border).color);
    this.elements.push(previewBg);

    this.spritePreviewObj = this.add.image(200, 290, this.editSpriteName)
      .setDisplaySize(140, 140);
    this.spritePreviewObj.setFlipX(true);
    this.elements.push(this.spritePreviewObj);

    this.tileNumText = this.add.text(200, 400, this.editSpriteName, {
      fontFamily: FONT, fontSize: '14px', color: C.accent,
    }).setOrigin(0.5);
    this.elements.push(this.tileNumText);

    this.elements.push(makeButton(this, 140, 435, '◀', () => this.changeSprite(-1), { size: 'sm' }));
    this.elements.push(makeButton(this, 260, 435, '▶', () => this.changeSprite(1),  { size: 'sm' }));

    // 우측 — 능력치 카드
    const statsCard = this.add.rectangle(600, 255, 380, 350, Phaser.Display.Color.HexStringToColor(C.surface).color);
    statsCard.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(C.border).color);
    this.elements.push(statsCard);

    this.elements.push(this.add.text(600, 120, '능력치', {
      fontFamily: FONT, fontSize: '15px', color: C.textDim, fontStyle: '500',
    }).setOrigin(0.5));

    // 이름 행
    this.elements.push(this.add.text(460, 150, '이름', {
      fontFamily: FONT, fontSize: '18px', color: C.textHi, fontStyle: '500',
    }));
    this.nameDisplayObj = this.add.text(640, 150, this.editName, {
      fontFamily: FONT, fontSize: '18px', color: C.accent, fontStyle: '600',
    }).setOrigin(0.5);
    this.elements.push(this.nameDisplayObj);
    this.elements.push(makeButton(this, 740, 150, '변경', () => this.editNamePrompt(), { size: 'sm' }));

    // 구분선
    this.elements.push(this.add.rectangle(600, 175, 360, 1, Phaser.Display.Color.HexStringToColor(C.border).color));

    // 8개 능력치 행
    const startY = 160;
    const rowH = 32;
    FIELDS.forEach((field, i) => {
      const y = startY + i * rowH;
      this.elements.push(this.add.text(460, y, field.label, {
        fontFamily: FONT, fontSize: '16px', color: C.textHi, fontStyle: '500',
      }));

      const display = field.toDisplay
        ? field.toDisplay(this.editValues[field.key])
        : `${this.editValues[field.key]}`;
      const valText = this.add.text(640, y, display, {
        fontFamily: FONT, fontSize: '18px', color: C.accent, fontStyle: '600',
      }).setOrigin(0.5);
      this.elements.push(valText);

      this.elements.push(makeButton(this, 700, y, '−', () => this.changeField(field, -1, valText), { size: 'sm' }));
      this.elements.push(makeButton(this, 740, y, '+', () => this.changeField(field, +1, valText), { size: 'sm' }));
    });

    // 하단 버튼
    this.elements.push(makeButton(this, 320, 480, '저장',         () => this.saveEdit(),   { variant: 'primary', size: 'md' }));
    this.elements.push(makeButton(this, 480, 480, '기본값으로',   () => this.resetEdit(),  { variant: 'ghost', size: 'md' }));
    this.elements.push(makeButton(this, 640, 480, '취소',         () => this.showList(),   { variant: 'ghost', size: 'md' }));
  }

  changeField(field, dir, valText) {
    const cur = this.editValues[field.key];
    let next;
    if (field.fromDisplay) {
      const displayCur = field.toDisplay(cur);
      const displayNext = displayCur + dir * field.step;
      if (displayNext < field.min || displayNext > field.max) return;
      next = field.fromDisplay(displayNext);
    } else {
      next = cur + dir * field.step;
      if (next < field.min || next > field.max) return;
    }
    this.editValues[field.key] = next;
    valText.setText(field.toDisplay ? field.toDisplay(next) : `${next}`);
  }

  changeSprite(dir) {
    this.editSpriteName = cycleSprite(this.editSpriteName, dir, BOSS_SPRITE_OPTIONS);
    this.spritePreviewObj.setTexture(this.editSpriteName);
    this.tileNumText.setText(this.editSpriteName);
  }

  editNamePrompt() {
    const next = window.prompt('새 보스 이름', this.editName);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    if (trimmed.length > 12) {
      window.alert('이름은 12자 이하로 해주세요');
      return;
    }
    this.editName = trimmed;
    if (this.nameDisplayObj && this.nameDisplayObj.active) {
      this.nameDisplayObj.setText(this.editName);
    }
  }

  saveEdit() {
    const overrides = {
      ...this.editValues,
      spriteKey: this.editSpriteName,
      name: this.editName,
    };
    setBossOverride(this.editingBossId, overrides);
    this.flashMessage('저장됨!', C.success);
    this.showList();
  }

  resetEdit() {
    resetBossOverride(this.editingBossId);
    this.flashMessage('기본값으로 복원', C.warning);
    this.showList();
  }

  flashMessage(text, color) {
    const msg = this.add.text(480, 510, text, {
      fontFamily: FONT, fontSize: '16px', color: color || C.success, fontStyle: '600',
      backgroundColor: '#0F1419', padding: { x: 14, y: 6 },
    }).setOrigin(0.5);
    this.tweens.add({ targets: msg, alpha: 0, duration: 1500, onComplete: () => msg.destroy() });
  }

  getMergedBoss(bossId) {
    const base = bossTypes.find(b => b.id === bossId);
    const override = getBossOverrides()[bossId];
    return override ? { ...base, ...override } : base;
  }

  makeBackButton() {
    makeButton(this, 890, 40, '뒤로', () => this.scene.start('AdminScene'),
      { variant: 'ghost', size: 'sm' });
  }

  clearElements() {
    this.elements.forEach(el => el.destroy());
    this.elements = [];
  }
}
