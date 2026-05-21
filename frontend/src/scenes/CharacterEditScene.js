// 캐릭터 편집 (플레이어 기본 능력치)
// 클래스 시스템은 제거됨 — 플레이어 베이스만 편집

import Phaser from 'phaser';
import {
  getPlayerBaseOverrides,
  setPlayerBaseOverrides,
  resetPlayerBaseOverrides,
} from '../data/adminConfig.js';
import { C, FONT, FONT_DISP, makeButton } from '../ui/theme.js';

const PLAYER_DEFAULTS = {
  attackPower: 10,
  attackSpeed: 1000,
  attackRange: 90,
  moveSpeed:   100,
  maxHp:       100,
  defense:     0,
};

const FIELDS = [
  { key: 'attackPower',  label: '공격력',     min: 1,   max: 200,  step: 1   },
  { key: 'attackSpeed',  label: '공속(ms)',   min: 200, max: 3000, step: 50  },
  { key: 'attackRange',  label: '사거리',     min: 50,  max: 250,  step: 5   },
  { key: 'moveSpeed',    label: '이동속도',   min: 30,  max: 400,  step: 10  },
  { key: 'maxHp',        label: '최대 HP',    min: 50,  max: 1000, step: 10  },
  { key: 'defense',      label: '방어력',     min: 0,   max: 50,   step: 1   },
];

export default class CharacterEditScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterEditScene' });
  }

  create() {
    this.elements = [];
    this.editValues = null;

    this.add.rectangle(480, 270, 960, 540, Phaser.Display.Color.HexStringToColor(C.bg).color);

    this.add.text(40, 40, '캐릭터 편집', {
      fontFamily: FONT_DISP, fontSize: '30px', color: C.textHi, fontStyle: '600',
    }).setOrigin(0, 0.5);

    this.add.text(40, 65, '플레이어 기본 능력치', {
      fontFamily: FONT, fontSize: '15px', color: C.textDim,
    }).setOrigin(0, 0.5);

    makeButton(this, 890, 40, '뒤로', () => this.scene.start('AdminScene'),
      { variant: 'ghost', size: 'sm' });

    this.showEdit();
  }

  showEdit() {
    this.clearElements();

    const overrides = getPlayerBaseOverrides();
    this.editValues = {};
    FIELDS.forEach(f => {
      this.editValues[f.key] = overrides[f.key] !== undefined ? overrides[f.key] : PLAYER_DEFAULTS[f.key];
    });

    // 능력치 카드 — 960×540 기준 가운데 정렬
    const cardH = FIELDS.length * 50 + 60;
    const cardY = 130 + cardH / 2;
    const card = this.add.rectangle(480, cardY, 600, cardH, Phaser.Display.Color.HexStringToColor(C.surface).color);
    card.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(C.border).color);
    this.elements.push(card);

    this.elements.push(this.add.text(480, 145, '능력치', {
      fontFamily: FONT, fontSize: '15px', color: C.textDim, fontStyle: '500',
    }).setOrigin(0.5));

    this.elements.push(this.add.rectangle(480, 168, 540, 1, Phaser.Display.Color.HexStringToColor(C.border).color));

    const startY = 195;
    FIELDS.forEach((field, i) => {
      const y = startY + i * 50;

      this.elements.push(this.add.text(250, y, field.label, {
        fontFamily: FONT, fontSize: '18px', color: C.textHi, fontStyle: '500',
      }));

      const valText = this.add.text(620, y, `${this.editValues[field.key]}`, {
        fontFamily: FONT, fontSize: '19px', color: C.accent, fontStyle: '600',
      }).setOrigin(0.5);
      this.elements.push(valText);

      this.elements.push(makeButton(this, 550, y, '−', () => this.changeField(field, -1, valText), { size: 'sm' }));
      this.elements.push(makeButton(this, 690, y, '+', () => this.changeField(field, +1, valText), { size: 'sm' }));
    });

    const buttonsY = cardY + cardH / 2 + 40;
    this.elements.push(makeButton(this, 380, buttonsY, '저장',         () => this.save(),     { variant: 'primary', size: 'md' }));
    this.elements.push(makeButton(this, 580, buttonsY, '기본값으로',   () => this.reset(),    { variant: 'ghost', size: 'md' }));
  }

  changeField(field, dir, valText) {
    const cur = this.editValues[field.key];
    const next = cur + dir * field.step;
    if (next < field.min || next > field.max) return;
    this.editValues[field.key] = next;
    valText.setText(`${next}`);
  }

  save() {
    setPlayerBaseOverrides(this.editValues);
    this.flashMessage('저장됨!', C.success);
    this.showEdit();
  }

  reset() {
    resetPlayerBaseOverrides();
    this.flashMessage('기본값으로 복원', C.warning);
    this.showEdit();
  }

  flashMessage(text, color) {
    const msg = this.add.text(480, 500, text, {
      fontFamily: FONT, fontSize: '16px', color: color || C.success, fontStyle: '600',
      backgroundColor: '#0F1419', padding: { x: 14, y: 6 },
    }).setOrigin(0.5);
    this.tweens.add({ targets: msg, alpha: 0, duration: 1500, onComplete: () => msg.destroy() });
  }

  clearElements() {
    this.elements.forEach(el => el.destroy());
    this.elements = [];
  }
}
