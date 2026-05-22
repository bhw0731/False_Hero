// 🔮 시너지 정보 모달 — TopBar 시너지 클릭 시 표시.
// [Phase P-46] 시너지 조합 listing 제거 (HelpModal 로 이동) + ◆ 단계 진행 + ◆ 다음 보스 영역 신규.
//   3 섹션:
//     1. 7대죄 카운트 (옛)
//     2. 활성 시너지 (옛 — 2줄 단일/듀얼)
//     3. 단계 진행 (신규 — 활성 죄 / 보유 ≥1 죄 다음 단계 카드 필요 수)
//     4. 다음 보스 (신규 — 현재 스테이지 디버프 + 보스 wave 구조)
//   pauseGame: false (정보 조회용, 게임 흐름 보존).

import { createModal } from './Modal.js';
import { addText, FONT } from '../theme.js';
import { SIN_LIST, SIN_NAMES, SIN_ICONS, SIN_COLORS, SIN_KEY } from '../../data/sins.js';
import { getSynergyEffect } from '../../data/synergyEffects.js';

const COLOR_GOLD     = '#C5A059';
const COLOR_TEXT_PRI = '#E8E8E8';
const COLOR_TEXT_2ND = '#9A9AA2';
const COLOR_DIM      = '#5A5A5F';
const COLOR_DIAMOND  = '#6AD8FF';
const COLOR_DANGER   = '#F87171';

const TIER_NAMES = { 3: '3단계', 6: '6단계', 9: '9단계' };

export function showSynergyInfo(scene) {
  if (scene._activeModal && !scene._activeModal._closed) return;

  // [Phase P-46] 660×540 → 660×460 (시너지 조합 listing 제거로 컴팩트).
  const W = 660, H = 460;
  const modal = createModal(scene, {
    title: '현재 시너지',
    width: W, height: H,
    pauseGame: false,
  });

  const player = scene.player;
  const synergyDisabled = !!(player._debuffOverrides && player._debuffOverrides.synergyDisabled);

  let cy = modal.bodyTopY + 12;

  // === sin-seal 디버프 (있으면 최상단) ===
  if (synergyDisabled) {
    const sealBox = scene.add.graphics();
    sealBox.fillStyle(0x8B0000, 0.3);
    sealBox.fillRoundedRect(-modal.w / 2 + 16, cy, modal.w - 32, 28, 4);
    sealBox.lineStyle(1, 0xDC2626, 0.6);
    sealBox.strokeRoundedRect(-modal.w / 2 + 16, cy, modal.w - 32, 28, 4);
    modal.body.add(sealBox);
    const sealTxt = addText(scene, 0, cy + 14, '🔒 시너지 비활성화 — 견습 마녀 디버프', {
      fontFamily: FONT, fontSize: '17px', color: COLOR_DANGER, fontStyle: '800',
    }).setOrigin(0.5);
    sealTxt.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(sealTxt);
    cy += 36;
  }

  // === 1. ◆ 7대죄 카운트 ===
  const countHeader = addText(scene, -modal.w / 2 + 24, cy, '◆ 7대죄 카운트', {
    fontFamily: FONT, fontSize: '18px', color: COLOR_GOLD, fontStyle: '800',
  }).setOrigin(0, 0);
  countHeader.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(countHeader);
  cy += 22;

  const countCellW = (modal.w - 40) / SIN_LIST.length;
  SIN_LIST.forEach((sin, i) => {
    const cx = -modal.w / 2 + 20 + countCellW * (i + 0.5);
    const c = (player.sinCounts && player.sinCounts[sin]) || 0;
    let color = c > 0 ? '#9A9AA2' : COLOR_DIM;
    if (sin === player.activeSin)    color = synergyDisabled ? COLOR_DIM : SIN_COLORS[sin];
    if (sin === player.secondarySin) color = synergyDisabled ? COLOR_DIM : _dim(SIN_COLORS[sin] || '#888', 0.65);
    const t = addText(scene, cx, cy, `${SIN_ICONS[sin]}${c}`, {
      fontFamily: FONT, fontSize: '17px', color, fontStyle: '700',
    }).setOrigin(0.5, 0);
    t.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(t);
  });
  cy += 28;

  // === 2. ◆ 활성 시너지 — 2줄 ===
  const actHeader = addText(scene, -modal.w / 2 + 24, cy, '◆ 활성 시너지', {
    fontFamily: FONT, fontSize: '18px', color: COLOR_GOLD, fontStyle: '800',
  }).setOrigin(0, 0);
  actHeader.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(actHeader);
  cy += 22;

  let singleLine, singleColor;
  if (player.activeSin && player.synergyTier > 0) {
    const effectId = `${SIN_KEY[player.activeSin]}_${player.synergyTier}`;
    const effect = getSynergyEffect(effectId);
    const effText = effect && effect.description ? (effect.description.split('—').slice(1).join('—').trim() || effect.description) : '';
    singleLine = `단일: ★ ${player.activeSin} ${player.synergyTier}단계 = ${effText}`;
    singleColor = synergyDisabled ? COLOR_DIM : '#A4D86E';
  } else {
    singleLine = '단일: (비활성 — 한 죄 카드 ≥3장 필요)';
    singleColor = COLOR_DIM;
  }
  const singleTxt = addText(scene, -modal.w / 2 + 32, cy, singleLine, {
    fontFamily: FONT, fontSize: '14px', color: singleColor, fontStyle: '700',
    wordWrap: { width: modal.w - 60 }, lineSpacing: 2,
  }).setOrigin(0, 0);
  singleTxt.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(singleTxt);
  cy += singleTxt.height + 4;

  let dualLine, dualColor;
  if (player.dualActive && player.dualSinKey) {
    const dualEffect = getSynergyEffect(player.dualSinKey);
    const a = player.activeSin || '';
    const b = player.secondarySin || '';
    const effText = dualEffect && dualEffect.description ? dualEffect.description : '';
    dualLine = `듀얼: ★ ${a} + ${b} = ${effText}`;
    dualColor = synergyDisabled ? COLOR_DIM : COLOR_DIAMOND;
  } else {
    dualLine = '듀얼: (비활성 — 활성 단일 + 2번째 죄 둘 다 ≥3 필요)';
    dualColor = COLOR_DIM;
  }
  const dualTxt = addText(scene, -modal.w / 2 + 32, cy, dualLine, {
    fontFamily: FONT, fontSize: '14px', color: dualColor, fontStyle: '700',
    wordWrap: { width: modal.w - 60 }, lineSpacing: 2,
  }).setOrigin(0, 0);
  dualTxt.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(dualTxt);
  cy += dualTxt.height + 12;

  // === 3. ◆ 단계 진행 (Phase P-46 신규) ===
  const progHeader = addText(scene, -modal.w / 2 + 24, cy, '◆ 단계 진행', {
    fontFamily: FONT, fontSize: '18px', color: COLOR_GOLD, fontStyle: '800',
  }).setOrigin(0, 0);
  progHeader.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(progHeader);
  cy += 22;

  // 보유 ≥1 죄만 표시. 활성 / 비활성 / 최대(9) 상태별 메시지.
  const nonZeroSins = SIN_LIST.filter(s => ((player.sinCounts && player.sinCounts[s]) || 0) > 0);
  if (nonZeroSins.length === 0) {
    const empty = addText(scene, -modal.w / 2 + 32, cy, '(보유 카드 없음)', {
      fontFamily: FONT, fontSize: '13px', color: COLOR_DIM,
    }).setOrigin(0, 0);
    modal.body.add(empty);
    cy += 18;
  } else {
    nonZeroSins.forEach(sin => {
      const c = player.sinCounts[sin] || 0;
      let msg;
      if (c >= 9)      msg = `${sin} 9단계 활성 (최대)`;
      else if (c >= 6) msg = `${sin} 6단계 활성 → 9단계까지 ${9 - c}장`;
      else if (c >= 3) msg = `${sin} 3단계 활성 → 6단계까지 ${6 - c}장`;
      else             msg = `${sin} ${c}장 보유 → 3단계까지 ${3 - c}장 더 필요`;
      const t = addText(scene, -modal.w / 2 + 32, cy, msg, {
        fontFamily: FONT, fontSize: '13px', color: SIN_COLORS[sin] || COLOR_TEXT_PRI, fontStyle: '600',
      }).setOrigin(0, 0);
      modal.body.add(t);
      cy += 16;
    });
  }
  cy += 8;

  // === 4. ◆ 다음 보스 (Phase P-46 신규) ===
  const bossHeader = addText(scene, -modal.w / 2 + 24, cy, '◆ 다음 보스', {
    fontFamily: FONT, fontSize: '18px', color: COLOR_GOLD, fontStyle: '800',
  }).setOrigin(0, 0);
  bossHeader.setShadow(1, 1, '#000000', 2, false, true);
  modal.body.add(bossHeader);
  cy += 22;

  // WaveSystem 의 _wavePlan + _currentStageDebuff 사용.
  const ws = scene.waveSystem;
  const stage = (ws && ws.currentStage) || 1;
  const debuff = (ws && ws._currentStageDebuff) ? ws._currentStageDebuff() : null;
  const wavePlan = (ws && ws._wavePlan) || [];
  const bossWaves = wavePlan.filter(p => p.type === 'subBoss' || p.type === 'mainBoss');

  if (bossWaves.length === 0) {
    const empty = addText(scene, -modal.w / 2 + 32, cy, '(웨이브 정보 없음)', {
      fontFamily: FONT, fontSize: '13px', color: COLOR_DIM,
    }).setOrigin(0, 0);
    modal.body.add(empty);
    cy += 18;
  } else {
    // 디버프 정보 한 줄.
    const debuffLine = debuff
      ? `디버프 (스테이지 ${stage}): ${debuff.desc || ''}`
      : `디버프 (스테이지 ${stage}): 없음`;
    const debuffTxt = addText(scene, -modal.w / 2 + 32, cy, debuffLine, {
      fontFamily: FONT, fontSize: '13px', color: COLOR_DANGER, fontStyle: '700',
      wordWrap: { width: modal.w - 60 }, lineSpacing: 2,
    }).setOrigin(0, 0);
    modal.body.add(debuffTxt);
    cy += debuffTxt.height + 6;

    // 보스 wave 구조 listing.
    bossWaves.forEach(p => {
      const label = p.type === 'mainBoss' ? '메인보스' : '서브보스';
      const line = `W${p.wave} ${label} — 등장 시 결정`;
      const t = addText(scene, -modal.w / 2 + 32, cy, line, {
        fontFamily: FONT, fontSize: '13px', color: COLOR_TEXT_2ND, fontStyle: '500',
      }).setOrigin(0, 0);
      modal.body.add(t);
      cy += 16;
    });
  }
}

// 색 톤다운.
function _dim(hex, ratio) {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.max(0, Math.min(255, Math.round(r * ratio)));
  const dg = Math.max(0, Math.min(255, Math.round(g * ratio)));
  const db = Math.max(0, Math.min(255, Math.round(b * ratio)));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(dr)}${toHex(dg)}${toHex(db)}`;
}
