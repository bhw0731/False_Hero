// ⚔ 장비 강화 모달 (Phase P-55)
//
// 옛 개별 장비 구매 시스템 폐기. 8 슬롯 각자 Lv 0~10 강화 — 영구.
// 다이아 상점 가지 않아도 이 모달 자체에서 강화 가능 (편의).
//
// 레이아웃:
//   상단: 8 슬롯 탭 (가로) — 현재 Lv 표시
//   중단: 좌 = 현재 Lv 효과 / 가운데 = +1 Lv 변화 / 우 = 다음 Lv 효과 미리보기
//   하단: 강화 비용 + ⚒ 강화 버튼 + ▶ 시작 / ← 취소
//
// 흐름:
//   슬롯 탭 클릭 → 강화 패널 전환
//   ⚒ 강화 클릭 → 다이아 차감 + Lv +1 (만렙 시 비활성)

import { createModal } from './Modal.js';
import { makeGlassBtn } from './glassBtn.js';
import { addText, FONT } from './theme.js';
import { showConfirmDialog } from './ConfirmDialog.js';
import { getDiamonds, getSlotLevels, upgradeSlot } from '../data/diamonds.js';
import {
  MAX_LEVEL, getNextLevelCost, getSlotEffect, getLevelDelta, getSlotMeta,
} from '../data/loadoutUpgrades.js';
import { SLOTS, SLOT_LABELS } from '../data/items.js';

const COLOR_GOLD       = '#C5A059';
const COLOR_DIAMOND    = '#6AD8FF';
const COLOR_TEXT_PRI   = '#E8E8E8';
const COLOR_TEXT_2ND   = '#9A9AA2';
const COLOR_TEXT_MUTED = '#6A6A72';
const COLOR_UP         = '#86EFAC';
const COLOR_DOWN       = '#FCA5A5';

const STAT_LABELS = {
  maxHp: '최대 HP', attackPower: '공격력', attackSpeed: '공속',
  critChance: '치명타', critDamage: '치명타 피해', accuracy: '명중', dodge: '회피',
  lifesteal: '흡혈', damageReduction: '피해 감소', goldGainMul: '골드',
};
const PCT_STATS = new Set(['critChance','critDamage','accuracy','dodge','lifesteal','damageReduction','goldGainMul']);
const _fmtStat = (k, v) => {
  if (v == null || v === 0) return '0';
  if (k === 'attackSpeed') return `${v > 0 ? '+' : ''}${v}ms`;
  if (PCT_STATS.has(k))    return `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
  if (Number.isInteger(v)) return `${v > 0 ? '+' : ''}${v}`;
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
};

// 레벨에 따른 색 (1=커먼 ~ 10=전설)
function levelTierColor(lv) {
  if (lv >= 9) return { hex: '#FFB300', color: 0xFFB300 };   // 전설
  if (lv >= 7) return { hex: '#C084FC', color: 0xC084FC };   // 에픽
  if (lv >= 5) return { hex: '#60A5FA', color: 0x60A5FA };   // 레어
  if (lv >= 3) return { hex: '#34D399', color: 0x34D399 };   // 언커먼
  if (lv >= 1) return { hex: '#94A3B8', color: 0x94A3B8 };   // 커먼
  return       { hex: '#4A4A50', color: 0x4A4A50 };          // 미강화
}

export function showLoadout(scene, opts = {}) {
  const { onStart, onCancel } = opts;
  const W = 920, H = 560;
  const modal = createModal(scene, {
    title: '⚒ 장비 강화',
    width: W, height: H,
    pauseGame: false,
    showOverlay: true,
    showCloseButton: false,
    overlayCloses: false,
    onClose: () => {},
  });

  let _selectedSlot = SLOTS[0] || 'head';

  let _tabEls = [];
  let _panelEls = [];
  const _clearArr = (arr) => { arr.forEach(e => e && e.destroy && e.destroy()); arr.length = 0; };

  // === 1. 상단 슬롯 탭 ===
  const TAB_W = 100, TAB_H = 50, TAB_GAP = 4, TAB_Y = modal.bodyTopY + 30;
  const totalTabsW = SLOTS.length * TAB_W + (SLOTS.length - 1) * TAB_GAP;
  const tabStartX = -totalTabsW / 2 + TAB_W / 2;

  const _renderTabs = () => {
    _clearArr(_tabEls);
    const levels = getSlotLevels();
    SLOTS.forEach((slot, i) => {
      const x = tabStartX + i * (TAB_W + TAB_GAP);
      const lv = levels[slot] || 0;
      const isSel = (_selectedSlot === slot);
      const tier = levelTierColor(lv);

      const g = scene.add.graphics();
      if (isSel) { g.fillStyle(0x000000, 0.5); g.fillRect(x - TAB_W / 2 + 2, TAB_Y - TAB_H / 2 + 2, TAB_W, TAB_H); }
      g.fillStyle(0x121826, isSel ? 0.95 : 0.55);
      g.fillRect(x - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H);
      const accColor = isSel ? 0xC5A059 : tier.color;
      g.fillStyle(accColor, isSel ? 0.85 : (lv > 0 ? 0.7 : 0.30));
      g.fillRect(x - TAB_W / 2, TAB_Y - TAB_H / 2, 3, TAB_H);
      g.lineStyle(1, isSel ? 0xC5A059 : (lv > 0 ? tier.color : 0xFFFFFF), isSel ? 0.75 : (lv > 0 ? 0.45 : 0.15));
      g.strokeRect(x - TAB_W / 2, TAB_Y - TAB_H / 2, TAB_W, TAB_H);
      modal.body.add(g);
      _tabEls.push(g);

      const slotLbl = addText(scene, x, TAB_Y - 9, SLOT_LABELS[slot] || slot, {
        fontFamily: FONT, fontSize: '14px', color: isSel ? '#E8E8E8' : COLOR_TEXT_2ND, fontStyle: '700',
      }).setOrigin(0.5);
      slotLbl.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(slotLbl);
      _tabEls.push(slotLbl);

      const lvLbl = addText(scene, x, TAB_Y + 11, `Lv ${lv}/${MAX_LEVEL}`, {
        fontFamily: FONT, fontSize: '13px', color: lv > 0 ? tier.hex : COLOR_TEXT_MUTED, fontStyle: '800',
      }).setOrigin(0.5);
      lvLbl.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(lvLbl);
      _tabEls.push(lvLbl);

      const hit = scene.add.rectangle(x, TAB_Y, TAB_W, TAB_H, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (p, lx, ly, ev) => {
        if (ev) ev.stopPropagation();
        if (_selectedSlot === slot) return;
        _selectedSlot = slot;
        _renderTabs();
        _renderPanel();
      });
      modal.body.add(hit);
      _tabEls.push(hit);
    });
  };

  // === 2. 중단 비교 패널 ===
  const PNL_TOP = modal.bodyTopY + 75;
  const CARD_W = 260, CARD_H = 250;
  const CARD_GAP = 70;

  const _drawCard = (cx, cy, slot, level, label) => {
    const els = [];
    const meta = getSlotMeta(slot);
    const tier = levelTierColor(level);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.45);
    g.fillRect(cx - CARD_W / 2 + 2, cy - CARD_H / 2 + 2, CARD_W, CARD_H);
    g.fillStyle(0x121826, 0.92);
    g.fillRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H);
    g.fillStyle(tier.color, level > 0 ? 0.85 : 0.4);
    g.fillRect(cx - CARD_W / 2, cy - CARD_H / 2, 4, CARD_H);
    g.fillStyle(0xFFFFFF, 0.08);
    g.fillRect(cx - CARD_W / 2 + 5, cy - CARD_H / 2 + 1, CARD_W - 6, 1);
    g.lineStyle(1, level > 0 ? tier.color : 0xFFFFFF, level > 0 ? 0.45 : 0.18);
    g.strokeRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H);
    modal.body.add(g); els.push(g);

    const lblTxt = addText(scene, cx, cy - CARD_H / 2 + 14, label, {
      fontFamily: FONT, fontSize: '13px', color: COLOR_TEXT_2ND, fontStyle: '600',
    }).setOrigin(0.5);
    modal.body.add(lblTxt); els.push(lblTxt);

    const lvTxt = addText(scene, cx, cy - CARD_H / 2 + 42, `Lv ${level} / ${MAX_LEVEL}`, {
      fontFamily: FONT, fontSize: '22px', color: level > 0 ? tier.hex : COLOR_TEXT_MUTED, fontStyle: '900',
    }).setOrigin(0.5);
    lvTxt.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(lvTxt); els.push(lvTxt);

    // 슬롯명
    const slotName = addText(scene, cx, cy - CARD_H / 2 + 72, SLOT_LABELS[slot] || slot, {
      fontFamily: FONT, fontSize: '15px', color: COLOR_TEXT_PRI, fontStyle: '700',
    }).setOrigin(0.5);
    modal.body.add(slotName); els.push(slotName);

    // effect 리스트
    const eff = getSlotEffect(slot, level);
    const effKeys = Object.keys(eff);
    if (level === 0 || effKeys.length === 0) {
      const empty = addText(scene, cx, cy + 10, '— 미강화 —', {
        fontFamily: FONT, fontSize: '14px', color: COLOR_TEXT_MUTED, fontStyle: '700',
      }).setOrigin(0.5);
      modal.body.add(empty); els.push(empty);
    } else {
      let y = cy - CARD_H / 2 + 105;
      effKeys.forEach(k => {
        const t = addText(scene, cx, y,
          `${STAT_LABELS[k] || k}  ${_fmtStat(k, eff[k])}`, {
          fontFamily: FONT, fontSize: '15px', color: COLOR_TEXT_PRI, fontStyle: '700',
        }).setOrigin(0.5);
        modal.body.add(t); els.push(t);
        y += 22;
      });
    }

    // 메타 — 메인/보조 stat 안내
    if (meta) {
      const metaLine = `메인: ${STAT_LABELS[meta.main.stat] || meta.main.stat}` +
        (meta.secondary ? `  ·  보조: ${STAT_LABELS[meta.secondary.stat] || meta.secondary.stat} (Lv ${meta.secondary.threshold}+)` : '');
      const m = addText(scene, cx, cy + CARD_H / 2 - 16, metaLine, {
        fontFamily: FONT, fontSize: '11px', color: COLOR_TEXT_MUTED, fontStyle: '600',
      }).setOrigin(0.5);
      modal.body.add(m); els.push(m);
    }
    return els;
  };

  const _drawDelta = (slot, curLv) => {
    const els = [];
    const cx = 0;
    const cy = PNL_TOP + CARD_H / 2;
    if (curLv >= MAX_LEVEL) {
      const t = addText(scene, cx, cy, '★ 만렙', {
        fontFamily: FONT, fontSize: '18px', color: COLOR_GOLD, fontStyle: '900',
      }).setOrigin(0.5);
      modal.body.add(t); els.push(t);
      return els;
    }
    const delta = getLevelDelta(slot, curLv);
    let y = cy - 60;
    const header = addText(scene, cx, y, '→  +1 Lv  →', {
      fontFamily: FONT, fontSize: '13px', color: COLOR_GOLD, fontStyle: '800',
    }).setOrigin(0.5);
    modal.body.add(header); els.push(header);
    y += 26;

    for (const k of Object.keys(delta)) {
      const v = delta[k];
      if (v === 0) continue;
      const isUp = v > 0 ? (k !== 'attackSpeed') : (k === 'attackSpeed');   // attackSpeed 음수 = 좋음
      const color = isUp ? COLOR_UP : COLOR_DOWN;
      const arrow = isUp ? '▲' : '▼';
      const t = addText(scene, cx, y,
        `${arrow}  ${STAT_LABELS[k] || k}  ${_fmtStat(k, v)}`, {
        fontFamily: FONT, fontSize: '14px', color, fontStyle: '700',
      }).setOrigin(0.5);
      modal.body.add(t); els.push(t);
      y += 22;
    }

    // Threshold 도달 알림
    const meta = getSlotMeta(slot);
    if (meta && meta.secondary && curLv + 1 === meta.secondary.threshold) {
      const t = addText(scene, cx, y + 4, `✨ 보조 stat 해금!`, {
        fontFamily: FONT, fontSize: '12px', color: COLOR_GOLD, fontStyle: '800',
      }).setOrigin(0.5);
      modal.body.add(t); els.push(t);
    }
    return els;
  };

  const _renderPanel = () => {
    _clearArr(_panelEls);
    const levels = getSlotLevels();
    const curLv = levels[_selectedSlot] || 0;
    const nextLv = Math.min(MAX_LEVEL, curLv + 1);

    const leftCx = -(CARD_W + CARD_GAP) / 2 - 30;
    const leftCy = PNL_TOP + CARD_H / 2;
    _panelEls.push(..._drawCard(leftCx, leftCy, _selectedSlot, curLv, '현재 Lv'));

    const rightCx = (CARD_W + CARD_GAP) / 2 + 30;
    _panelEls.push(..._drawCard(rightCx, leftCy, _selectedSlot, nextLv, curLv >= MAX_LEVEL ? '만렙' : '다음 Lv'));

    _panelEls.push(..._drawDelta(_selectedSlot, curLv));

    // 강화 버튼
    const cost = getNextLevelCost(curLv);
    const myDia = getDiamonds();
    const canAfford = cost != null && myDia >= cost;
    const upgradeY = leftCy + CARD_H / 2 + 30;

    if (cost == null) {
      // 만렙
      const t = addText(scene, 0, upgradeY, '★ 최대 강화 도달 ★', {
        fontFamily: FONT, fontSize: '18px', color: COLOR_GOLD, fontStyle: '900',
      }).setOrigin(0.5);
      modal.body.add(t); _panelEls.push(t);
    } else {
      const btn = makeGlassBtn(scene, {
        x: 0, y: upgradeY, w: 220, h: 38,
        label: `강화  ·  ${cost} 다이아`,
        fontSize: '17px',
        color: canAfford ? COLOR_GOLD : COLOR_TEXT_MUTED,
        baseAlpha: canAfford ? 0.5 : 0.25,
        hoverAlpha: canAfford ? 0.7 : 0.3,
        parent: modal.body, stopPropagation: true,
        onClick: () => {
          if (!canAfford) {
            if (scene.events && scene.events.emit) scene.events.emit('toast', '❌ 다이아 부족');
            return;
          }
          showConfirmDialog(scene, {
            title: `${SLOT_LABELS[_selectedSlot] || _selectedSlot} Lv ${curLv + 1}`,
            message: `다이아 ${cost} 사용해서 강화하시겠습니까?`,
            onConfirm: () => {
              if (upgradeSlot(_selectedSlot)) {
                if (scene.events && scene.events.emit) {
                  scene.events.emit('toast', `⚒ ${SLOT_LABELS[_selectedSlot] || _selectedSlot} Lv ${curLv + 1}`);
                }
                _renderTabs();
                _renderPanel();
              }
            },
          });
        },
      });
      _panelEls.push(btn.bg, btn.txt, btn.hit);
    }

    // 다이아 잔액 표시 (우상단, 픽셀 아이콘 + 숫자)
    const diaTxt = addText(scene, modal.w / 2 - 16, modal.bodyTopY + 22, `${myDia.toLocaleString()}`, {
      fontFamily: FONT, fontSize: '16px', color: COLOR_DIAMOND, fontStyle: '800',
    }).setOrigin(1, 0.5);
    diaTxt.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(diaTxt); _panelEls.push(diaTxt);
    if (scene.textures && scene.textures.exists('icon-diamond')) {
      const diaIcon = scene.add.image(modal.w / 2 - 16 - diaTxt.width - 6, modal.bodyTopY + 22, 'icon-diamond')
        .setDisplaySize(72, 44).setOrigin(1, 0.5);
      modal.body.add(diaIcon); _panelEls.push(diaIcon);
    }
  };

  _renderTabs();
  _renderPanel();

  // === 3. 하단 시작/취소 ===
  const btnY = modal.bodyBotY - 26;
  makeGlassBtn(scene, {
    x: -100, y: btnY, w: 160, h: 38,
    label: '▶ 시작', fontSize: '19px',
    color: COLOR_GOLD, baseAlpha: 0.5, hoverAlpha: 0.7,
    parent: modal.body, stopPropagation: true,
    onClick: () => {
      modal.close();
      if (typeof onStart === 'function') onStart();
    },
  });
  makeGlassBtn(scene, {
    x: 100, y: btnY, w: 160, h: 38,
    label: '← 취소', fontSize: '19px',
    color: COLOR_TEXT_2ND, baseAlpha: 0.3, hoverAlpha: 0.5,
    parent: modal.body, stopPropagation: true,
    onClick: () => {
      modal.close();
      if (typeof onCancel === 'function') onCancel();
    },
  });
}
