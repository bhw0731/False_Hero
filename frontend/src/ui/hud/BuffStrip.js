// [Phase P-54] 활성 버프/디버프 표시 띠 — 좌측 스탯 박스 아래 세로 스택.
// 영약 / 부적 / 보물상자 보상 + 함정 디버프 표시.
//
// 데이터 소스:
//   - player.activeBuffs.{attackPower, attackSpeed, damageReduction, lifesteal, accuracy, dodge}
//   - player._stageExpMul (부적)
//
// 양수 = 초록 (positive), 음수 = 빨강 (debuff).
//
// 성능: panel + per-row bar Graphics 를 재사용 (clear + redraw). 텍스트도 동일 갯수면 setText.

import { addText, FONT } from '../theme.js';

const DEPTH = 11;
const LEFT_X = 10;
const TOP_Y  = 425;
const ROW_H = 18;
const PANEL_W = 280;

const BUFF_DEFS = [
  { src: 'activeBuffs.attackPower',     icon: '🔥', name: '공격력', fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
  { src: 'activeBuffs.attackSpeed',     icon: '⚡', name: '공속',   fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
  { src: 'activeBuffs.damageReduction', icon: '🛡', name: '피해 감소', fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
  { src: 'activeBuffs.lifesteal',       icon: '🍖', name: '흡혈',   fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
  { src: 'activeBuffs.accuracy',        icon: '🎯', name: '명중',   fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
  { src: 'activeBuffs.dodge',           icon: '💨', name: '회피',   fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
  { src: '_stageExpMul',                icon: '📿', name: 'EXP',    fmt: (v) => `+${Math.round((v - 1) * 100)}%`, predicate: (v) => v !== 1 },
];

const _readPath = (obj, path) => {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

class BuffStrip {
  constructor(scene) {
    this.scene = scene;
    // 재사용 풀 — 매 프레임 alloc 방지 (60fps 에서 GC 압박 ↓).
    this._panel = scene.add.graphics().setDepth(DEPTH).setScrollFactor(0).setVisible(false);
    this._rows = [];   // [{ bar: Graphics, txt: Text }]
    this._onUpdate = () => this._redraw();
    scene.events.on('update', this._onUpdate);
    this._redraw();
  }

  _ensureRow(i) {
    if (this._rows[i]) return this._rows[i];
    const bar = this.scene.add.graphics().setDepth(DEPTH + 1).setScrollFactor(0);
    const txt = addText(this.scene, 0, 0, '', {
      fontFamily: FONT, fontSize: '12px', color: '#FFFFFF', fontStyle: '600',
    }).setOrigin(0, 0.5).setDepth(DEPTH + 1).setScrollFactor(0);
    txt.setShadow(1, 1, '#000000', 2, false, true);
    const row = { bar, txt };
    this._rows.push(row);
    return row;
  }

  _redraw() {
    const player = this.scene.player;
    if (!player) { this._hideAll(); return; }

    // 활성 버프 추출
    const active = [];
    for (const def of BUFF_DEFS) {
      const v = _readPath(player, def.src);
      if (v == null) continue;
      const ok = def.predicate ? def.predicate(v) : (v !== 0);
      if (!ok) continue;
      const isPositive = def.src === '_stageExpMul' ? v > 1 : v > 0;
      let remainSec = 0;
      if (player.getTimedBuffRemain) {
        let timedStat = null;
        if (def.src.startsWith('activeBuffs.')) timedStat = def.src.split('.')[1];
        else if (def.src === '_stageExpMul') timedStat = 'expMul';
        if (timedStat) {
          const ms = player.getTimedBuffRemain(timedStat);
          if (ms > 0) remainSec = Math.ceil(ms / 1000);
        }
      }
      active.push({ def, value: v, positive: isPositive, remainSec });
    }

    if (active.length === 0) { this._hideAll(); return; }

    // 패널 재그리기 (alloc X).
    const totalH = active.length * ROW_H + 8;
    this._panel.clear();
    this._panel.fillStyle(0x000000, 0.35);
    this._panel.fillRoundedRect(LEFT_X, TOP_Y, PANEL_W, totalH, 4);
    this._panel.setVisible(true);

    active.forEach(({ def, value, positive, remainSec }, i) => {
      const durSuffix = remainSec > 0 ? ` · ${remainSec}초` : ' · 스테이지';
      const text = `${def.icon} ${def.name} ${def.fmt(value)}${durSuffix}`;
      const rowY = TOP_Y + 4 + i * ROW_H;
      const cy = rowY + ROW_H / 2;
      const accent = positive ? 0xA4D86E : 0xF87171;
      const color = positive ? '#A4D86E' : '#F87171';

      const row = this._ensureRow(i);
      row.bar.clear();
      row.bar.fillStyle(accent, 0.85);
      row.bar.fillRect(LEFT_X + 6, rowY + 3, 2, ROW_H - 6);
      row.bar.setVisible(true);

      row.txt.setPosition(LEFT_X + 14, cy);
      row.txt.setText(text);
      row.txt.setColor(color);
      row.txt.setVisible(true);
    });

    // 잉여 row 숨김
    for (let i = active.length; i < this._rows.length; i++) {
      this._rows[i].bar.setVisible(false);
      this._rows[i].txt.setVisible(false);
    }
  }

  _hideAll() {
    if (this._panel) this._panel.setVisible(false);
    for (const r of this._rows) { r.bar.setVisible(false); r.txt.setVisible(false); }
  }

  destroy() {
    if (this.scene && this.scene.events && this._onUpdate) {
      this.scene.events.off('update', this._onUpdate);
    }
    if (this._panel && this._panel.destroy) this._panel.destroy();
    for (const r of this._rows) {
      if (r.bar && r.bar.destroy) r.bar.destroy();
      if (r.txt && r.txt.destroy) r.txt.destroy();
    }
    this._rows = [];
    this._panel = null;
  }
}

export default BuffStrip;
