// ⚒ 강화 상점 — 장비 8슬롯 Lv 0~10 강화 (확률 + 소프트 실패). 풀스크린 모달.
//
// 배경: sprites/screens/upgrade-equipment.png
//   이미지 원본 1831×859, 모달 body 영역에 stretch 로 깔고 frame 좌표 fraction 으로 텍스트/hit 오버레이.

import { createModal } from './Modal.js';
import { addText, FONT } from '../theme.js';
import {
  getDiamonds,
  getSlotLevels, upgradeSlot, getUpgradeOdds,
  getSlotAwakenAll, getAwakenOdds, upgradeSlotAwaken,
  devResetPurchases, devMaxSlot,
} from '../../data/meta/diamonds.js';
import { gameSettings } from '../../data/settings.js';
import { getMaterials, MATERIALS } from '../../data/meta/materials.js';
import { SLOTS, SLOT_LABELS } from '../../data/items.js';
import {
  MAX_LEVEL, getNextLevelCost, getSlotEffect, getSlotMeta,
  AWAKEN_TIER_MAX, getAwakenLabel, getNextAwakenLabel, getAwakenMultiplier,
} from '../../data/meta/loadoutUpgrades.js';

const COLOR_DIAMOND     = '#FFD166';
const COLOR_TEXT_PRI    = '#E8E8E8';
const COLOR_TEXT_2ND    = '#9A9AA2';
const COLOR_TEXT_MUTED  = '#6A6A72';
const COLOR_OWNED       = '#34D399';
const COLOR_GOLD        = '#FFD166';

// 영구 강화 데이터 — UI 제거됨 (도전과제 시스템으로 이행 예정). data/meta/diamonds.js 에서 직접 참조하면 됨.

// 슬롯 강화 등급별 색 (Lv 1~10).
const _lvColor = (lv) => {
  if (lv >= 9) return { color: 0xFBBF24, hex: '#FBBF24' };   // 전설
  if (lv >= 7) return { color: 0xA855F7, hex: '#A855F7' };   // 에픽
  if (lv >= 5) return { color: 0x3B82F6, hex: '#3B82F6' };   // 레어
  if (lv >= 3) return { color: 0x10B981, hex: '#10B981' };   // 언커먼
  if (lv >= 1) return { color: 0x9CA3AF, hex: '#9CA3AF' };   // 커먼
  return       { color: 0x475569, hex: '#475569' };          // 미강화
};

const _STAT_LABEL = {
  maxHp: '최대 HP', attackPower: '공격력', attackSpeed: '공속',
  critChance: '치명타', critDamage: '치명타 피해', accuracy: '명중', dodge: '회피',
  lifesteal: '흡혈', damageReduction: '피해 감소', goldGainMul: '골드',
};
const _PCT = new Set(['critChance','critDamage','accuracy','dodge','lifesteal','damageReduction','goldGainMul']);
const _fmt = (k, v) => {
  if (!v) return '0';
  if (k === 'attackSpeed') return `${v > 0 ? '+' : ''}${v}ms`;
  if (_PCT.has(k))         return `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
  if (Number.isInteger(v)) return `${v > 0 ? '+' : ''}${v}`;
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
};

export function showUpgradeShop(scene, options = {}) {
  const fullscreen = options.fullscreen === true;
  const W = fullscreen ? scene.scale.width  : 880;
  const H = fullscreen ? scene.scale.height : 500;
  const modal = createModal(scene, {
    // fullscreen 시 타이틀 생략 + frameless (테두리/그림자/헤더 라인 X) — ChallengeScene 톤 통일.
    title: fullscreen ? '' : '강화 상점',
    width: W, height: H,
    pauseGame: false,
    showOverlay: !fullscreen,
    showCloseButton: !fullscreen,
    overlayCloses: !fullscreen,
    frameless: fullscreen,
    onClose: () => {
      if (options.onClose) options.onClose();
    },
  });

  // === 다이아 잔액 (모달 헤더 우측, 이미지 밖) ===
  const balanceX = fullscreen ? modal.w / 2 - 16 : modal.w / 2 - 48;
  // 잔액 = 숫자 텍스트 (우측 정렬) + 아이콘 (텍스트 좌측에 배치)
  const balanceTxt = addText(scene, balanceX, -modal.h / 2 + 32, `${getDiamonds().toLocaleString()}`, {
    fontFamily: FONT, fontSize: '22px', color: COLOR_DIAMOND, fontStyle: '900',
  }).setOrigin(1, 0.5);
  balanceTxt.setShadow(2, 2, '#000000', 3, false, true);
  modal.container.add(balanceTxt);
  // 다이아 아이콘 — 숫자 텍스트 좌측에 위치.
  const balanceIcon = scene.add.image(balanceX - balanceTxt.width - 8, -modal.h / 2 + 32, 'icon-diamond')
    .setDisplaySize(72, 44).setOrigin(1, 0.5).setTint(0xFFD166);
  modal.container.add(balanceIcon);
  // 각성석 / 초월석 보유 — 다이아 아래 한 줄 (★ N  ✦ N).
  const matTxt = addText(scene, balanceX, -modal.h / 2 + 58, '', {
    fontFamily: FONT, fontSize: '15px', color: '#C9A0FF', fontStyle: '900', letterSpacing: 1,
  }).setOrigin(1, 0.5);
  matTxt.setShadow(2, 2, '#000000', 3, false, true);
  modal.container.add(matTxt);
  const refreshBalance = () => {
    balanceTxt.setText(`${getDiamonds().toLocaleString()}`);
    balanceIcon.setX(balanceX - balanceTxt.width - 8);
    const mat = getMaterials();
    matTxt.setText(`★ ${mat.awakenStone}    ✦ ${mat.transcendStone}`);
  };
  refreshBalance();

  // === fullscreen 모드 — 모달 헤더 좌측에 나가기 링크 ===
  if (fullscreen) {
    const exTxt = addText(scene, -modal.w / 2 + 20, -modal.h / 2 + 32, '메뉴', {
      fontFamily: FONT, fontSize: '20px', color: '#FFE9B5', fontStyle: '800',
    }).setOrigin(0, 0.5);
    exTxt.setShadow(2, 2, '#000000', 3, false, true);
    const exHit = scene.add.rectangle(-modal.w / 2 + 70, -modal.h / 2 + 32, 130, 44, 0x000000, 0.001)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
    exHit.on('pointerdown', (p, lx, ly, ev) => {
      if (ev) ev.stopPropagation();
      exTxt.setColor('#FFFFFF');
    });
    exHit.on('pointerup',         () => { exTxt.setColor('#FFE9B5'); modal.close(); });
    exHit.on('pointerupoutside',  () => exTxt.setColor('#FFE9B5'));
    modal.container.add([exTxt, exHit]);
  }

  // === 강화 상점 — 장비 강화 전용 (영구 강화 탭 제거됨, 추후 도전과제 시스템으로 대체 예정) ===
  // 헤더 중앙에 단일 타이틀.
  const TAB_Y = -modal.h / 2 + 32;
  const headerTitle = addText(scene, 0, TAB_Y, '◈ 장비 강화', {
    fontFamily: FONT, fontSize: '22px', color: '#FFD166', fontStyle: '900',
  }).setOrigin(0.5);
  headerTitle.setShadow(2, 2, '#000000', 3, false, true);
  modal.container.add(headerTitle);

  // === 콘텐츠 영역 — 탭 전환 시 재렌더 ===
  let _contentEls = [];
  const _clearContent = () => {
    _contentEls.forEach(e => e && e.destroy && e.destroy());
    _contentEls = [];
  };
  const _addEl = (el) => { _contentEls.push(el); modal.body.add(el); return el; };

  // === body 영역 — frameless 풀스크린 시 헤더 60px (ChallengeScene 와 통일). ===
  const _bodyBox = () => {
    const HEADER = fullscreen ? 60 : 40;
    const bw  = modal.w;
    const bh  = modal.h - HEADER;
    const bcy = -modal.h / 2 + HEADER + bh / 2;
    return { bw, bh, bcy };
  };
  // 이미지 fraction (좌상단 0,0 ~ 우하단 1,1) → body 좌표 (cx, cy, w, h)
  const _frame = (fx, fy, fw, fh) => {
    const { bw, bh } = _bodyBox();
    return {
      cx: -bw / 2 + (fx + fw / 2) * bw,
      cy: modal.bodyTopY + (fy + fh / 2) * bh,
      w:  fw * bw,
      h:  fh * bh,
    };
  };
  const _frC = (fcx, fcy, fw, fh) => _frame(fcx - fw / 2, fcy - fh / 2, fw, fh);

  // === 확인 다이얼로그 (간단) ===
  const _showConfirmPurchase = (name, cost, onConfirm) => {
    // 인라인 글래스 다이얼로그.
    const dlgW = 360, dlgH = 180;
    const dlgC = scene.add.container(0, 0).setDepth(2000);
    const overlay = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.6)
      .setDepth(1999).setScrollFactor(0).setInteractive();
    const bg = scene.add.graphics();
    bg.fillStyle(0x121826, 0.95);
    bg.fillRoundedRect(-dlgW / 2, -dlgH / 2, dlgW, dlgH, 8);
    bg.lineStyle(2, 0xFFD166, 0.5);
    bg.strokeRoundedRect(-dlgW / 2, -dlgH / 2, dlgW, dlgH, 8);
    dlgC.add(bg);
    const titleTxt = addText(scene, 0, -50, name, {
      fontFamily: FONT, fontSize: '20px', color: COLOR_GOLD, fontStyle: '900',
    }).setOrigin(0.5);
    titleTxt.setShadow(1, 1, '#000000', 2, false, true);
    dlgC.add(titleTxt);
    const msgTxt = addText(scene, 0, -10, `다이아 ${cost} 사용해서 구매하시겠습니까?`, {
      fontFamily: FONT, fontSize: '15px', color: COLOR_TEXT_PRI, fontStyle: '600',
      align: 'center',
    }).setOrigin(0.5);
    dlgC.add(msgTxt);

    const closeDlg = () => {
      overlay.destroy();
      dlgC.destroy();
    };
    const mkBtn = (x, label, color, onClick) => {
      const w = 100, h = 36;
      const g = scene.add.graphics();
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(x - w / 2, 30, w, h, 6);
      g.lineStyle(1, color, 0.7);
      g.strokeRoundedRect(x - w / 2, 30, w, h, 6);
      dlgC.add(g);
      const t = addText(scene, x, 48, label, {
        fontFamily: FONT, fontSize: '17px', color: '#FFFFFF', fontStyle: '800',
      }).setOrigin(0.5);
      dlgC.add(t);
      const hit = scene.add.rectangle(x, 48, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (p, lx, ly, ev) => {
        if (ev) ev.stopPropagation();
        closeDlg();
        onClick();
      });
      dlgC.add(hit);
    };
    mkBtn(-60, '예',   0xFFD166, onConfirm);
    mkBtn( 60, '아니오', 0x7A7A82, () => {});

    const cx = scene.scale.width / 2;
    const cy = scene.scale.height / 2;
    dlgC.setPosition(cx, cy);
    overlay.setPosition(cx, cy);
    overlay.on('pointerdown', closeDlg);
  };

  const _flashToast = (x, y) => {
    const toast = addText(scene, x, y, '✓ 구매 완료!', {
      fontFamily: FONT, fontSize: '20px', color: COLOR_OWNED, fontStyle: '800',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1100);
    modal.body.add(toast);
    scene.tweens.add({
      targets: toast, y: y - 30, alpha: 0, duration: 700,
      onComplete: () => toast.destroy(),
    });
  };

  // [P-65] 강화 결과 토스트 (플로팅 결과 텍스트). [P-68] 각성/초월 커스텀 라벨.
  //   성공: 금빛 광륜 + 팝 + 사방 반짝임.  실패: 붉은 흔들림 + 수축하는 잔불.
  const _flashUpgradeResult = (x, y, success, successLabel = '강화 성공!', failLabel = '강화 실패…') => {
    const label = success ? successLabel : failLabel;
    // 연출 요소를 한 컨테이너에 모아 함께 정리.
    const fxC = scene.add.container(x, y).setDepth(1100);
    modal.body.add(fxC);

    if (success) {
      const GOLD = 0xFFD166;
      // 뒤로 퍼지는 광륜.
      const ring = scene.add.circle(0, 0, 16, GOLD, 0).setStrokeStyle(3, GOLD, 0.9);
      fxC.add(ring);
      scene.tweens.add({ targets: ring, scale: 5.5, alpha: 0, duration: 640, ease: 'Cubic.easeOut' });
      // 부드러운 광채.
      const glow = scene.add.circle(0, 0, 30, GOLD, 0.30);
      fxC.add(glow);
      scene.tweens.add({ targets: glow, scale: 2.6, alpha: 0, duration: 560, ease: 'Sine.easeOut' });
      // 사방으로 튀는 반짝임(작은 빛 알갱이).
      const N = 9;
      for (let i = 0; i < N; i++) {
        const ang = (Math.PI * 2 * i) / N + Math.random() * 0.4;
        const dist = 52 + Math.random() * 22;
        const mote = scene.add.circle(0, 0, 3, 0xFFF1C2, 1);
        fxC.add(mote);
        scene.tweens.add({
          targets: mote, x: Math.cos(ang) * dist, y: Math.sin(ang) * dist,
          scale: 0, alpha: 0, duration: 560, delay: 40, ease: 'Cubic.easeOut',
        });
      }
      // 텍스트 — 금빛 글로우 + 팝 바운스.
      const txt = addText(scene, 0, 0, label, {
        fontFamily: FONT, fontSize: '30px', color: '#FFE9B5', fontStyle: '900',
        stroke: '#3A2A12', strokeThickness: 5,
      }).setOrigin(0.5);
      txt.setShadow(0, 0, '#FFD166', 14, false, true);
      fxC.add(txt);
      txt.setScale(0.4);
      scene.tweens.add({
        targets: txt, scale: 1.14, duration: 230, ease: 'Back.easeOut',
        onComplete: () => scene.tweens.add({ targets: txt, scale: 1.0, duration: 130, ease: 'Sine.easeOut' }),
      });
      scene.tweens.add({ targets: txt, y: -44, alpha: 0, duration: 720, delay: 560, ease: 'Sine.easeIn' });
      scene.time.delayedCall(1400, () => { if (fxC && fxC.active) fxC.destroy(); });

    } else {
      const EMBER = 0xC65B3C;   // 식어가는 잔불 (어두운 주황).
      const SMOKE = 0x4A4A52;   // 잿빛 연기.
      // 잿빛 연기 — 위로 번지며 사라짐.
      const smoke = scene.add.circle(0, -2, 26, SMOKE, 0.34);
      fxC.add(smoke);
      scene.tweens.add({ targets: smoke, scale: 2.3, y: -30, alpha: 0, duration: 780, ease: 'Sine.easeOut' });
      // 아래로 흩어져 떨어지는 재.
      const N = 7;
      for (let i = 0; i < N; i++) {
        const spread = (Math.random() - 0.5) * 64;
        const ember = scene.add.circle(spread * 0.25, -2, 2 + Math.random() * 1.6, EMBER, 0.9);
        fxC.add(ember);
        scene.tweens.add({
          targets: ember, x: spread, y: 34 + Math.random() * 26,
          alpha: 0, duration: 620 + Math.random() * 220, delay: 50, ease: 'Quad.easeIn',
        });
      }
      // 텍스트 — 위에서 쿵 떨어지는 임팩트(스쿼시) 후 식으며 가라앉음.
      const txt = addText(scene, 0, -18, label, {
        fontFamily: FONT, fontSize: '28px', color: '#E08A8A', fontStyle: '900',
        stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5);
      txt.setShadow(2, 2, '#000000', 4, false, true);
      fxC.add(txt);
      txt.setScale(1.22).setAlpha(0);
      // 떨어지며 등장 → 착지 시 세로 압축 → 원상.
      scene.tweens.add({
        targets: txt, y: 0, alpha: 1, scaleX: 1.0, scaleY: 0.86, duration: 190, ease: 'Quad.easeIn',
        onComplete: () => scene.tweens.add({ targets: txt, scaleY: 1.0, duration: 130, ease: 'Back.easeOut' }),
      });
      // 잠시 후 가라앉으며 소멸.
      scene.tweens.add({ targets: txt, y: 18, alpha: 0, duration: 580, delay: 560, ease: 'Sine.easeIn' });
      scene.time.delayedCall(1340, () => { if (fxC && fxC.active) fxC.destroy(); });
    }
  };

  // === 영구 강화 탭 — 제거됨 (추후 도전과제 시스템으로 대체 예정).
  //   UPGRADES / isUpgradeOwned / buyUpgrade 데이터는 다른 시스템에서 참조 가능성 있어 유지.

  // === 탭 2: 장비 강화 — 이미지 배경 (upgrade-equipment.png) ===
  let _selSlot = SLOTS[0] || 'head';

  const _renderItemsTab = () => {
    const levels = getSlotLevels();
    const awakenAll = getSlotAwakenAll();   // [P-68] 슬롯별 각성/초월 단계.
    const { bw, bh, bcy } = _bodyBox();
    const bg = scene.add.image(0, bcy, 'ui-upgrade-equipment');
    bg.setDisplaySize(bw, bh);
    _addEl(bg);
    modal.body.sendToBack(bg);

    // [P-63] 본문 UI 전체 +20px 아래로 시프트 (배경 이미지/외곽 프레임은 그대로).
    const UI_Y_OFFSET = 20;
    const _frC = (fcx, fcy, fw, fh) => {
      const r = _frame(fcx - fw / 2, fcy - fh / 2, fw, fh);
      return { ...r, cy: r.cy + UI_Y_OFFSET };
    };

    // 좌 사이드바 8슬롯 — 이미지의 8개 가로 슬롯 프레임 y 중심.
    const SLOT_FY = [0.110, 0.215, 0.320, 0.425, 0.530, 0.635, 0.740, 0.845];
    const SLOT_FW = 0.208, SLOT_FH = 0.090, SLOT_FX = 0.142;
    // 슬롯별 y 미세 보정 (PNG 슬롯 위치 차이).
    const SLOT_DY = [3, 1, 0, -1, -2, -3, -4, -5];

    SLOTS.forEach((slot, i) => {
      const lv = levels[slot] || 0;
      const isSel = (_selSlot === slot);
      const tier = _lvColor(lv);
      const fr = _frC(SLOT_FX, SLOT_FY[i], SLOT_FW, SLOT_FH);
      fr.cy += SLOT_DY[i] || 0;

      if (isSel) {
        // 슬롯별 노란 박스 y 미세 보정.
        const HL_DY = [-1, 0.5, 0, 0, 0.5, 0.5, 0, 0];
        const hlDy = HL_DY[i] || 0;
        // ▶ 마커 제거 → 좌측 inset 만큼 박스 폭 축소.
        const HL_LEFT_INSET = 28;
        const hlX = fr.cx - fr.w / 2 + HL_LEFT_INSET;
        const hlW = fr.w - HL_LEFT_INSET;
        const sg = scene.add.graphics();
        sg.fillStyle(0xFFD166, 0.22);
        sg.fillRect(hlX, fr.cy - fr.h / 2 + hlDy, hlW, fr.h);
        sg.lineStyle(3, 0xFFD166, 1.0);
        sg.strokeRect(hlX, fr.cy - fr.h / 2 + hlDy, hlW, fr.h);
        _addEl(sg);
      }

      const lblL = addText(scene, fr.cx - fr.w / 2 + 50, fr.cy, SLOT_LABELS[slot] || slot, {
        fontFamily: FONT, fontSize: '17px',
        color: isSel ? '#FFE9B5' : '#F1F5F9', fontStyle: isSel ? '900' : '700',
      }).setOrigin(0, 0.5);
      lblL.setShadow(1, 1, '#000000', 2, false, true);
      _addEl(lblL);

      const slotAwaken = awakenAll[slot] || 0;
      const lvLabel = slotAwaken > 0 ? getAwakenLabel(slotAwaken) : `Lv ${lv}/${MAX_LEVEL}`;
      const lvColor = slotAwaken > 0 ? '#C9A0FF' : (lv > 0 ? tier.hex : '#7A7A82');
      const lvT = addText(scene, fr.cx + fr.w / 2 - 32, fr.cy, lvLabel, {
        fontFamily: FONT, fontSize: '14px',
        color: lvColor, fontStyle: '900',
      }).setOrigin(1, 0.5);
      lvT.setShadow(1, 1, '#000000', 2, false, true);
      _addEl(lvT);

      const hit = scene.add.rectangle(fr.cx, fr.cy, fr.w, fr.h, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (p, lx, ly, ev) => {
        if (ev) ev.stopPropagation();
        if (_selSlot === slot) return;
        _selSlot = slot;
        _renderContent();
      });
      _addEl(hit);
    });

    // 우 패널 — 슬롯 헤더 + 메타 + 비교 박스 + 강화 버튼.
    const slot = _selSlot;
    const lv = levels[slot] || 0;
    const nextLv = Math.min(MAX_LEVEL, lv + 1);
    const isMax = lv >= MAX_LEVEL;
    const cost = getNextLevelCost(lv);
    const canAfford = cost != null && getDiamonds() >= cost;
    const meta = getSlotMeta(slot);
    // [P-68] 각성/초월 — Lv10 풀강 시에만 의미.
    const awakenTier = awakenAll[slot] || 0;
    const isAwakenMax = isMax && awakenTier >= AWAKEN_TIER_MAX;

    // 슬롯명 헤더 제거 — 좌측 사이드바 탭에 이미 슬롯명 표시됨.

    if (meta) {
      // 현재 효과 박스 — 모루 위, 메인/보조 두 줄로 정리.
      const boxFr = _frC(0.650, 0.180, 0.34, 0.10);
      const boxG = scene.add.graphics();
      boxG.fillStyle(0x000000, 0.35);
      boxG.fillRoundedRect(boxFr.cx - boxFr.w / 2, boxFr.cy - boxFr.h / 2, boxFr.w, boxFr.h, 6);
      boxG.lineStyle(1, 0xFFD166, 0.4);
      boxG.strokeRoundedRect(boxFr.cx - boxFr.w / 2, boxFr.cy - boxFr.h / 2, boxFr.w, boxFr.h, 6);
      _addEl(boxG);
      // 제목 — 각성/초월 중이면 단계·배율 표기.
      const titleStr = awakenTier > 0
        ? `현재 효과   ${getAwakenLabel(awakenTier)}  ×${getAwakenMultiplier(awakenTier).toFixed(2)}`
        : '현재 효과';
      const titleTxt = addText(scene, boxFr.cx, boxFr.cy - boxFr.h * 0.35, titleStr, {
        fontFamily: FONT, fontSize: '12px',
        color: awakenTier > 0 ? '#C9A0FF' : '#FFD166', fontStyle: '900', letterSpacing: 2,
      }).setOrigin(0.5);
      _addEl(titleTxt);
      // 메인.
      const mainLine = `메인 · ${_STAT_LABEL[meta.main.stat] || meta.main.stat}`;
      const mainTxt = addText(scene, boxFr.cx, boxFr.cy - boxFr.h * 0.02, mainLine, {
        fontFamily: FONT, fontSize: '13px', color: '#FFE9B5', fontStyle: '800',
      }).setOrigin(0.5);
      _addEl(mainTxt);
      // 보조 (해금 여부에 따라 회색/일반).
      if (meta.secondary) {
        const secUnlocked = lv >= meta.secondary.threshold;
        const subLine = `보조 · ${_STAT_LABEL[meta.secondary.stat] || meta.secondary.stat} (Lv ${meta.secondary.threshold}+)`;
        const subTxt = addText(scene, boxFr.cx, boxFr.cy + boxFr.h * 0.28, subLine, {
          fontFamily: FONT, fontSize: '13px',
          color: secUnlocked ? '#E8E8E8' : '#7A7A82', fontStyle: '700',
        }).setOrigin(0.5);
        _addEl(subTxt);
      }
    }

    // 좌 박스 (현재) / 우 박스 (다음).
    const leftBoxFr  = _frC(0.442, 0.490, 0.215, 0.430);
    const rightBoxFr = _frC(0.818, 0.490, 0.215, 0.430);

    const drawBoxContent = (fr, label, level, dxAdjust = 0, awakenT = 0) => {
      const t2 = _lvColor(level);
      // 박스 안 모든 텍스트 살짝 오른쪽으로 시프트 (이미지 frame 중심이 1-2px 오른쪽).
      const TX_DX = 3 + dxAdjust;
      const baseCx = fr.cx + dxAdjust;
      const lblT = addText(scene, fr.cx + TX_DX, fr.cy - fr.h * 0.32, label, {
        fontFamily: FONT, fontSize: '14px', color: '#FFE9B5', fontStyle: '800',
      }).setOrigin(0.5);
      lblT.setShadow(2, 2, '#000000', 3, false, true);
      _addEl(lblT);
      // 각성/초월 중이면 큰 라벨을 ★N / ✦N 으로, 아니면 Lv N.
      const bigLabel = awakenT > 0 ? getAwakenLabel(awakenT) : `Lv ${level}`;
      const bigColor = awakenT > 0 ? '#C9A0FF' : (level > 0 ? t2.hex : '#7A7A82');
      const lvT = addText(scene, fr.cx + TX_DX, fr.cy - fr.h * 0.15, bigLabel, {
        fontFamily: FONT, fontSize: awakenT > 0 ? '28px' : '32px',
        color: bigColor, fontStyle: '900',
      }).setOrigin(0.5);
      lvT.setShadow(2, 2, '#000000', 3, false, true);
      _addEl(lvT);
      const eff = getSlotEffect(slot, level, awakenT);
      const keys = Object.keys(eff);
      if (keys.length === 0) {
        _addEl(addText(scene, baseCx, fr.cy + fr.h * 0.05, '— 미강화 —', {
          fontFamily: FONT, fontSize: '14px', color: '#7A7A82', fontStyle: '700',
        }).setOrigin(0.5));
      } else {
        let yy = fr.cy - fr.h * 0.02;
        keys.forEach(k => {
          _addEl(addText(scene, baseCx, yy, `${_STAT_LABEL[k] || k}`, {
            fontFamily: FONT, fontSize: '14px', color: COLOR_TEXT_2ND, fontStyle: '600',
          }).setOrigin(0.5));
          _addEl(addText(scene, baseCx, yy + 18, _fmt(k, eff[k]), {
            fontFamily: FONT, fontSize: '18px', color: COLOR_TEXT_PRI, fontStyle: '900',
          }).setOrigin(0.5));
          yy += 44;
        });
      }
    };

    // === 비교 박스 + 확률 + 버튼 — Lv0~9 강화(다이아) / Lv10 각성·초월(재료) 분기. ===
    const btnFr  = _frC(0.620, 0.835, 0.220, 0.075);
    const oddsFr = _frC(0.620, 0.745, 0.34, 0.05);
    const fxFr   = _frC(0.620, 0.400, 0.30, 0.05);

    if (!isMax) {
      // --- Lv 0~9: 다이아 강화 ---
      drawBoxContent(leftBoxFr,  '현재',  lv, 0, 0);
      drawBoxContent(rightBoxFr, '강화 후', nextLv, -2, 0);

      const odds = getUpgradeOdds(slot);
      const pct = Math.round(odds.rate * 100);
      const oddsColor = pct >= 80 ? '#FFE9B5' : pct >= 50 ? '#FFD166' : pct >= 20 ? '#FF9F45' : '#F87171';
      const oddsTxt = addText(scene, oddsFr.cx, oddsFr.cy, `성공 확률 ${pct}%`, {
        fontFamily: FONT, fontSize: '14px', color: oddsColor, fontStyle: '900',
      }).setOrigin(0.5);
      oddsTxt.setShadow(1, 1, '#000000', 2, false, true);
      _addEl(oddsTxt);

      // 강화 버튼 — "강화" 텍스트 + 다이아 아이콘 + 비용.
      const btnColor = canAfford ? '#FFE9B5' : '#7A6F66';
      const ICON_S = 56, ICON_GAP_L = 14, ICON_GAP_R = 8;
      const labelW_btn = addText(scene, 0, 0, '강화', { fontFamily: FONT, fontSize: '20px' }).setVisible(false);
      const labelWidth = labelW_btn.width; labelW_btn.destroy();
      const costW_btn = addText(scene, 0, 0, `${cost}`, { fontFamily: FONT, fontSize: '20px' }).setVisible(false);
      const costWidth = costW_btn.width; costW_btn.destroy();
      const totalW2 = labelWidth + ICON_GAP_L + ICON_S + ICON_GAP_R + costWidth;
      const startX2 = btnFr.cx - totalW2 / 2;
      const txtL = addText(scene, startX2, btnFr.cy, '강화', {
        fontFamily: FONT, fontSize: '20px', color: btnColor, fontStyle: '900',
      }).setOrigin(0, 0.5);
      txtL.setShadow(2, 2, '#000000', 3, false, true);
      _addEl(txtL);
      const btnIcon = scene.add.image(startX2 + labelWidth + ICON_GAP_L + ICON_S / 2, btnFr.cy, 'icon-diamond')
        .setDisplaySize(ICON_S, ICON_S * 0.62).setOrigin(0.5).setTint(0xFFD166);
      _addEl(btnIcon);
      const txtR = addText(scene, startX2 + labelWidth + ICON_GAP_L + ICON_S + ICON_GAP_R, btnFr.cy, `${cost}`, {
        fontFamily: FONT, fontSize: '20px', color: btnColor, fontStyle: '900',
      }).setOrigin(0, 0.5);
      txtR.setShadow(2, 2, '#000000', 3, false, true);
      _addEl(txtR);
      const btnTxt = { setColor: (c) => { txtL.setColor(c); txtR.setColor(c); } };

      const hit = scene.add.rectangle(btnFr.cx, btnFr.cy, btnFr.w, btnFr.h, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      const restoreBtn = () => btnTxt.setColor(canAfford ? '#FFE9B5' : '#7A6F66');
      hit.on('pointerdown', (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); if (canAfford) btnTxt.setColor('#FFFFFF'); });
      hit.on('pointerupoutside', restoreBtn);
      hit.on('pointerup', () => {
        restoreBtn();
        if (!canAfford) {
          if (scene.events && scene.events.emit) scene.events.emit('toast', '❌ 다이아 부족');
          return;
        }
        const res = upgradeSlot(slot);
        if (res && res.ok) {
          refreshBalance();
          _flashUpgradeResult(fxFr.cx, fxFr.cy, res.success);
          _renderContent();
        }
      });
      _addEl(hit);

    } else {
      // --- Lv 10 풀강: 각성(★) / 초월(✦) — 재료 도박, 실패 시 단계 하락 ---
      const curLabel = awakenTier > 0 ? getAwakenLabel(awakenTier) : '현재';
      drawBoxContent(leftBoxFr, curLabel, lv, 0, awakenTier);

      if (isAwakenMax) {
        drawBoxContent(rightBoxFr, '최대', lv, -2, awakenTier);
        _addEl(addText(scene, btnFr.cx, btnFr.cy, '✦  최대 초월 달성  ✦', {
          fontFamily: FONT, fontSize: '18px', color: '#C9A0FF', fontStyle: '900',
        }).setOrigin(0.5));
      } else {
        drawBoxContent(rightBoxFr, getNextAwakenLabel(awakenTier), lv, -2, awakenTier + 1);

        const odds = getAwakenOdds(slot);
        const isTrans = awakenTier >= 5;   // 다음 단계가 초월(✦) 구간인지.
        const matId = odds.cost ? odds.cost.id : 'awakenStone';
        const matInfo = MATERIALS[matId] || { icon: '★', label: '재료' };
        const pct = Math.round(odds.rate * 100);
        const enough = odds.canAwaken;
        const oddsColor = pct >= 50 ? '#C9A0FF' : pct >= 20 ? '#FF9F45' : '#F87171';

        // 성공률.
        const oddsTxt = addText(scene, oddsFr.cx, oddsFr.cy - 9, `성공 확률 ${pct}%`, {
          fontFamily: FONT, fontSize: '14px', color: oddsColor, fontStyle: '900',
        }).setOrigin(0.5);
        oddsTxt.setShadow(1, 1, '#000000', 2, false, true);
        _addEl(oddsTxt);
        // 재료 소모 + 보유.
        const matStr = `${matInfo.icon} ${matInfo.label} ${odds.cost.amount}  (보유 ${odds.have})`;
        const matTxt2 = addText(scene, oddsFr.cx, oddsFr.cy + 9, matStr, {
          fontFamily: FONT, fontSize: '12px', color: enough ? '#C9A0FF' : '#F87171', fontStyle: '800',
        }).setOrigin(0.5);
        matTxt2.setShadow(1, 1, '#000000', 2, false, true);
        _addEl(matTxt2);
        // 실패해도 단계 유지 (재료만 소모) — 강화와 동일한 소프트 방식.
        _addEl(addText(scene, oddsFr.cx, oddsFr.cy + 26, '실패해도 단계 유지', {
          fontFamily: FONT, fontSize: '10px', color: '#6A8A6A', fontStyle: '700',
        }).setOrigin(0.5));

        // 각성/초월 버튼.
        const actLabel = isTrans ? '✦ 초월' : '★ 각성';
        const txt = addText(scene, btnFr.cx, btnFr.cy, actLabel, {
          fontFamily: FONT, fontSize: '20px', color: enough ? '#E9D5FF' : '#7A6F66', fontStyle: '900',
        }).setOrigin(0.5);
        txt.setShadow(2, 2, '#000000', 3, false, true);
        _addEl(txt);

        const hit = scene.add.rectangle(btnFr.cx, btnFr.cy, btnFr.w, btnFr.h, 0x000000, 0.001)
          .setScrollFactor(0).setInteractive({ useHandCursor: true });
        const restoreBtn = () => txt.setColor(enough ? '#E9D5FF' : '#7A6F66');
        hit.on('pointerdown', (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); if (enough) txt.setColor('#FFFFFF'); });
        hit.on('pointerupoutside', restoreBtn);
        hit.on('pointerup', () => {
          restoreBtn();
          if (!enough) {
            if (scene.events && scene.events.emit) scene.events.emit('toast', `❌ ${matInfo.label} 부족`);
            return;
          }
          const res = upgradeSlotAwaken(slot);
          if (res && res.ok) {
            refreshBalance();
            const sLabel = isTrans ? '초월 성공!' : '각성 성공!';
            const fLabel = isTrans ? '초월 실패…' : '각성 실패…';
            _flashUpgradeResult(fxFr.cx, fxFr.cy, res.success, sLabel, fLabel);
            _renderContent();
          }
        });
        _addEl(hit);
      }
    }

    // === [DEV] 장비 강화 초기화 버튼 — testMode 일 때만 표시. ===
    if (gameSettings && gameSettings.testMode) {
      const devFr = _frC(0.88, 0.04, 0.20, 0.05);
      const devTxt = addText(scene, devFr.cx, devFr.cy, '[DEV] 강화 초기화', {
        fontFamily: FONT, fontSize: '15px', color: '#F87171', fontStyle: '900',
      }).setOrigin(0.5);
      devTxt.setShadow(2, 2, '#000000', 3, false, true);
      _addEl(devTxt);
      const devHit = scene.add.rectangle(devFr.cx, devFr.cy, devFr.w, devFr.h, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      devHit.on('pointerdown',      () => devTxt.setColor('#FFFFFF'));
      devHit.on('pointerupoutside', () => devTxt.setColor('#F87171'));
      devHit.on('pointerup', () => {
        devTxt.setColor('#F87171');
        devResetPurchases();
        refreshBalance();
        _renderContent();
        if (scene.events && scene.events.emit) scene.events.emit('toast', '[DEV] 강화 초기화');
      });
      _addEl(devHit);

      // [DEV] 선택 슬롯 즉시 Lv10 — 각성/초월 테스트용.
      const dev2Fr = _frC(0.88, 0.10, 0.20, 0.05);
      const dev2Txt = addText(scene, dev2Fr.cx, dev2Fr.cy, '[DEV] Lv10', {
        fontFamily: FONT, fontSize: '15px', color: '#60A5FA', fontStyle: '900',
      }).setOrigin(0.5);
      dev2Txt.setShadow(2, 2, '#000000', 3, false, true);
      _addEl(dev2Txt);
      const dev2Hit = scene.add.rectangle(dev2Fr.cx, dev2Fr.cy, dev2Fr.w, dev2Fr.h, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      dev2Hit.on('pointerdown',      () => dev2Txt.setColor('#FFFFFF'));
      dev2Hit.on('pointerupoutside', () => dev2Txt.setColor('#60A5FA'));
      dev2Hit.on('pointerup', () => {
        dev2Txt.setColor('#60A5FA');
        devMaxSlot(_selSlot);
        _renderContent();
        if (scene.events && scene.events.emit) scene.events.emit('toast', '[DEV] Lv10 풀강');
      });
      _addEl(dev2Hit);
    }
  };

  const _renderContent = () => {
    _clearContent();
    _renderItemsTab();
  };
  _renderContent();
}
