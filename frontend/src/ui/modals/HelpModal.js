// 도움말 모달 (Phase P-45 → P-47) — 6 탭 구조.
//   1. 게임 안내 (화면 정보 통합) / 2. 진행 / 3. 시너지 / 4. 카드 / 5. 매점
//   시너지 탭만 21 듀얼 listing 스크롤 (P-46 이동). 다른 탭 = 정적 컨텐츠.
//   탭 전환 시 옛 컨텐츠 destroy + 시너지 listing 의 scene.events listener 정리.

import { createModal } from './Modal.js';
import { addText, FONT } from '../theme.js';
import { SIN_LIST, SIN_COLORS } from '../../data/sins.js';
import { synergyEffects } from '../../data/synergyEffects.js';

const COLOR_GOLD = '#C5A059';
const COLOR_TEXT = '#E8E8E8';
const COLOR_DIM = '#9A9AA2';
const COLOR_MUTED = '#7A7A82';

const TABS = [
  { id: 'intro',   label: '게임 안내' },
  { id: 'flow',    label: '진행' },
  { id: 'synergy', label: '시너지' },
  { id: 'card',    label: '카드' },
  { id: 'shop',    label: '매점' },
];

export function showHelpModal(scene, opts = {}) {
  const fromPause = !!(opts && opts.fromPause);

  const W = 660, H = 540;
  const modal = createModal(scene, {
    title: '도움말',
    width: W, height: H,
    pauseGame: !fromPause,
    showOverlay: true,
    overlayCloses: true,
    onClose: () => {
      _cleanupSynergyListing();
      // pause 모달 stash 복원 — opts._pauseModal 우선, 옛 scene._pauseModal 폴백.
      const parentPM = (opts && opts._pauseModal) || scene._pauseModal;
      if (fromPause && parentPM) {
        if (parentPM._restore) parentPM._restore();
        else if (parentPM.container) { parentPM.container.setVisible(true); scene._activeModal = parentPM; }
      }
    },
  });

  // 시너지 탭 listing 자원 (탭 전환 / 모달 close 시 cleanup).
  let _synListingContainer = null;
  let _synScrollHit = null;
  let _synOnUpdate = null;
  const _cleanupSynergyListing = () => {
    if (_synOnUpdate) { scene.events.off('update', _synOnUpdate); _synOnUpdate = null; }
    if (_synListingContainer) { try { _synListingContainer.destroy(); } catch {} _synListingContainer = null; }
    if (_synScrollHit) { try { _synScrollHit.destroy(); } catch {} _synScrollHit = null; }
  };

  // 컨텐츠 영역 자식 (탭 전환 시 destroy).
  let _contentChildren = [];
  const _clearContent = () => {
    _cleanupSynergyListing();
    _contentChildren.forEach(c => { try { c.destroy(); } catch {} });
    _contentChildren = [];
  };

  // === 탭 버튼 영역 ===
  const tabY = modal.bodyTopY + 16;
  const tabW = (modal.w - 32) / TABS.length;
  const tabH = 32;
  const tabBtns = [];
  let activeTabIdx = 0;

  const renderTabButtons = () => {
    tabBtns.forEach(b => { try { b.bg.destroy(); b.txt.destroy(); b.hit.destroy(); } catch {} });
    tabBtns.length = 0;
    TABS.forEach((tab, i) => {
      const cx = -modal.w / 2 + 16 + tabW * (i + 0.5);
      const isActive = i === activeTabIdx;
      const bg = scene.add.graphics();
      bg.fillStyle(0x000000, isActive ? 0.6 : 0.25);
      bg.fillRoundedRect(cx - tabW / 2 + 2, tabY - tabH / 2, tabW - 4, tabH, 4);
      if (isActive) {
        bg.lineStyle(1, 0xC5A059, 0.7);
        bg.strokeRoundedRect(cx - tabW / 2 + 2, tabY - tabH / 2, tabW - 4, tabH, 4);
      }
      modal.body.add(bg);
      const txt = addText(scene, cx, tabY, tab.label, {
        fontFamily: FONT, fontSize: '14px',
        color: isActive ? COLOR_GOLD : COLOR_DIM, fontStyle: '700',
      }).setOrigin(0.5);
      txt.setShadow(1, 1, '#000000', 2, false, true);
      modal.body.add(txt);
      const hit = scene.add.rectangle(cx, tabY, tabW - 4, tabH, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (activeTabIdx === i) return;
        activeTabIdx = i;
        renderTabButtons();
        _clearContent();
        _renderContent();
      });
      modal.body.add(hit);
      tabBtns.push({ bg, txt, hit });
    });
  };

  // === 컨텐츠 영역 ===
  const contentTopY = tabY + tabH / 2 + 12;

  const _renderContent = () => {
    const tab = TABS[activeTabIdx];
    if (tab.id === 'intro')        _renderIntro();
    else if (tab.id === 'flow')    _renderFlow();
    else if (tab.id === 'synergy') _renderSynergy();
    else if (tab.id === 'card')    _renderCard();
    else if (tab.id === 'shop')    _renderShop();
  };

  const _addLine = (text, y, opts = {}) => {
    const t = addText(scene, -modal.w / 2 + 24, y, text, {
      fontFamily: FONT,
      fontSize: opts.size || '14px',
      color: opts.color || COLOR_TEXT,
      fontStyle: opts.bold ? '700' : '500',
      wordWrap: { width: modal.w - 48 }, lineSpacing: 2,
    }).setOrigin(0, 0);
    if (opts.shadow !== false) t.setShadow(1, 1, '#000000', 2, false, true);
    modal.body.add(t);
    _contentChildren.push(t);
    return t.height + (opts.gap != null ? opts.gap : 4);
  };
  const _addHeader = (text, y) => _addLine(text, y, { size: '16px', color: COLOR_GOLD, bold: true, gap: 6 });

  // === 탭 1: 게임 안내 (옛 게임 안내 + 화면 안내 통합) ===
  function _renderIntro() {
    let y = contentTopY;
    y += _addHeader('가짜 용사', y);
    y += _addLine('7대죄 카드를 모아 스테이지를 클리어하는 로그라이크.', y);
    y += _addLine('한 챕터 = 10 스테이지.', y, { color: COLOR_MUTED, gap: 10 });

    y += _addHeader('◆ 좌측 박스 (상태바)', y);
    y += _addLine('• HP / 골드 / EXP / Lv', y);
    y += _addLine('• 10 스탯 (합산 final 값) + 시너지 카운트', y);
    y += _addLine('• 시너지 영역 클릭 → 시너지 정보', y, { gap: 8 });

    y += _addHeader('◆ 스탯 색상 (변동량)', y);
    y += _addLine('• 흰색 = 합산 final 값', y);
    y += _addLine('• 빨강 = 장비 보너스 (+N)', y, { color: '#FF6666' });
    y += _addLine('• 파랑 = 카드 + 시너지 보너스 (+N)', y, { color: '#66AAFF', gap: 8 });

    y += _addHeader('◆ 상단 진행도 바', y);
    y += _addLine('⚪ 캐릭터  🔴 서브보스  🟣 정예 보스  🔴 메인보스  🟡 매점 NPC', y, { size: '13px', gap: 8 });

    y += _addHeader('◆ 상단 가운데 버프 띠', y);
    y += _addLine('영약/시험 효과 표시. 초록=긍정, 빨강=디버프. 시간 제한 시 남은 초 표시.', y, { size: '13px', gap: 8 });

    y += _addHeader('◆ 우상단 아이콘', y);
    y += _addLine('⚔ 장비    ☰ 메뉴', y, { size: '13px', gap: 8 });

    y += _addHeader('◆ 우측 보유 카드 띠', y);
    y += _addLine('현재 보유한 카드 (최근 12장). 탭 → 전체 보유 카드 모달.', y, { size: '13px', gap: 8 });

    y += _addHeader('◆ 우하단 물약', y);
    y += _addLine('기본 물약 1개 — 탭 시 HP 20% 회복, 30초 쿨다운.', y);
  }

  // === 탭 2: 진행 ===
  function _renderFlow() {
    let y = contentTopY;
    y += _addHeader('◆ 게임 흐름', y);
    y += _addLine('잡몹 처치 → 레벨업 → 카드 픽', y);
    y += _addLine('보스 직전 → 매점 진입 (5번)', y);
    y += _addLine('모든 10 스테이지 클리어 → 챕터 완료', y, { gap: 8 });

    y += _addHeader('◆ 스테이지 구조 (5 보스 시스템)', y);
    y += _addLine('잡몹 100마리 + 5 보스. 좌→우 진행.', y);
    y += _addLine('서브 보스 ×3 (메인 50% 스탯)', y);
    y += _addLine('정예 보스 ×1 (메인 70% 스탯)', y);
    y += _addLine('메인 보스 ×1 (스테이지 클리어 조건)', y, { color: COLOR_MUTED, gap: 8 });

    y += _addHeader('◆ 매점 NPC', y);
    y += _addLine('각 보스 직전 1개 (5 보스 = 5 매점).', y, { gap: 8 });

    y += _addHeader('◆ 이벤트 (스테이지당 5개)', y);
    y += _addLine('💀 신의 시험 (시작 직후) — 디버프 감수 시 다이아 보상.', y);
    y += _addLine('🎁 보물 상자 ×4 (각 보스 직후) — 좋은 보상 or 함정 도박.', y, { color: COLOR_MUTED, gap: 8 });

    y += _addHeader('◆ 엘리트 잡몹', y);
    y += _addLine('스테이지당 2마리. 골드 외곽 + 큰 사이즈. HP×4, ATK×1.5, 보상 ↑.', y, { gap: 8 });

    y += _addHeader('◆ 콤보', y);
    y += _addLine('연속 처치 시 콤보 누적. 5초 안 다음 처치 시 유지.', y);
    y += _addLine('플레이어 머리 위 콤보 표시 (×N).', y, { color: COLOR_MUTED });
  }

  // === 탭 4: 시너지 (+ 21 듀얼 listing 스크롤) ===
  function _renderSynergy() {
    let y = contentTopY;
    y += _addHeader('◆ 시너지란?', y);
    y += _addLine('같은 죄 카드를 3장 이상 모으면 발동. 활성 단계: 3 / 6 / 9.', y, { gap: 6 });
    y += _addHeader('◆ 듀얼 시너지', y);
    y += _addLine('활성 단일 + 다른 죄 ≥3장 보유 시 추가 발동. 21쌍 조합.', y, { gap: 6 });
    y += _addHeader('◆ sin-seal (시너지 봉인)', y);
    y += _addLine('일부 챕터 디버프. 시너지 발동 차단.', y, { color: '#F87171', gap: 12 });

    // 구분선
    const dividerG = scene.add.graphics();
    dividerG.lineStyle(1, 0x4A4A50, 0.5);
    dividerG.lineBetween(-modal.w / 2 + 24, y, modal.w / 2 - 24, y);
    modal.body.add(dividerG);
    _contentChildren.push(dividerG);
    y += 8;

    y += _addHeader('◆ 시너지 조합 (21 듀얼)', y);

    // === 듀얼 listing — 옛 P-46 코드 (스크롤 / culling / 죄 색별 / 한 줄) ===
    const cx = (scene.scale && scene.scale.width || 1280) / 2;
    const cy0 = (scene.scale && scene.scale.height || 600) / 2;
    const listingAbsX = cx - modal.w / 2 + 16;
    const listingAbsY = cy0 + y + 4;
    const listingW = modal.w - 32;
    const listingH = cy0 + modal.bodyBotY - 12 - listingAbsY;

    _synListingContainer = scene.add.container(listingAbsX, listingAbsY).setDepth(1010);
    const dimColor = COLOR_MUTED;
    let listY = 0;
    const sinIdx = (s) => SIN_LIST.indexOf(s);

    SIN_LIST.forEach((sin) => {
      const duals = synergyEffects.filter(eff => {
        if (!eff || !eff.description || eff.type !== 'dual' || !Array.isArray(eff.sins)) return false;
        const [a, b] = eff.sins;
        const firstSin = sinIdx(a) < sinIdx(b) ? a : b;
        return firstSin === sin;
      });
      if (duals.length === 0) return;
      duals.forEach(eff => {
        const [a, b] = eff.sins;
        const STYLE = { fontFamily: FONT, fontSize: '12px', fontStyle: '700' };
        let x = 16;
        const txtA = addText(scene, x, listY, a, { ...STYLE, color: SIN_COLORS[a] || COLOR_TEXT }).setOrigin(0, 0);
        _synListingContainer.add(txtA);
        x += txtA.width;
        const txtPlus = addText(scene, x, listY, ' + ', { ...STYLE, color: dimColor }).setOrigin(0, 0);
        _synListingContainer.add(txtPlus);
        x += txtPlus.width;
        const txtB = addText(scene, x, listY, b, { ...STYLE, color: SIN_COLORS[b] || COLOR_TEXT }).setOrigin(0, 0);
        _synListingContainer.add(txtB);
        x += txtB.width;
        const txtDesc = addText(scene, x, listY, ` = ${eff.description}`, { ...STYLE, color: dimColor }).setOrigin(0, 0);
        _synListingContainer.add(txtDesc);
        listY += 17;
      });
    });

    // culling.
    const cullTop = listingAbsY;
    const cullBot = listingAbsY + listingH;
    const updateCulling = () => {
      _synListingContainer.list.forEach(child => {
        if (!child || !child.setVisible) return;
        const childTop = _synListingContainer.y + (child.y || 0);
        const childBot = childTop + (child.height || 14);
        child.setVisible(childBot > cullTop && childTop < cullBot);
      });
    };

    const contentH = listY;
    const maxScroll = Math.max(0, contentH - listingH);
    let scrollOffset = 0;
    const applyScroll = () => {
      _synListingContainer.y = listingAbsY - scrollOffset;
      updateCulling();
    };
    updateCulling();

    _synScrollHit = scene.add.rectangle(
      listingAbsX + listingW / 2, listingAbsY + listingH / 2,
      listingW, listingH, 0x000000, 0.001
    ).setScrollFactor(0).setInteractive().setDepth(1011);
    let isDragging = false;
    let lastY = 0, lastMoveTime = 0, velocity = 0;
    _synScrollHit.on('wheel', (p, dx, dy) => {
      velocity = 0;
      scrollOffset = Math.max(0, Math.min(maxScroll, scrollOffset + dy * 0.5));
      applyScroll();
    });
    _synScrollHit.on('pointerdown', (p) => {
      isDragging = true;
      lastY = p.y;
      lastMoveTime = scene.time.now;
      velocity = 0;
    });
    _synScrollHit.on('pointermove', (p) => {
      if (!isDragging) return;
      const dy = lastY - p.y;
      const now = scene.time.now;
      const dt = Math.max(1, now - lastMoveTime);
      velocity = dy / dt * 16;
      scrollOffset = Math.max(0, Math.min(maxScroll, scrollOffset + dy));
      applyScroll();
      lastY = p.y;
      lastMoveTime = now;
    });
    const stopDrag = () => { isDragging = false; };
    _synScrollHit.on('pointerup', stopDrag);
    _synScrollHit.on('pointerupoutside', stopDrag);

    _synOnUpdate = () => {
      if (isDragging) return;
      if (Math.abs(velocity) < 0.1) { velocity = 0; return; }
      scrollOffset = Math.max(0, Math.min(maxScroll, scrollOffset + velocity));
      applyScroll();
      velocity *= 0.92;
    };
    scene.events.on('update', _synOnUpdate);
  }

  // === 탭 5: 카드 ===
  function _renderCard() {
    let y = contentTopY;
    y += _addHeader('◆ 카드 픽', y);
    y += _addLine('레벨업 또는 웨이브 끝 시 3장 중 1장 선택.', y);
    y += _addLine('스테이지당 1회 리롤 가능. ▼ 접기 — 카드 픽 미루기.', y, { gap: 8 });
    y += _addHeader('◆ 등급', y);
    y += _addLine('노말 → 레어 → 레전드.', y, { gap: 8 });
    y += _addHeader('◆ 7대죄', y);
    y += _addLine('분노 / 탐욕 / 나태 / 오만 / 색욕 / 질투 / 폭식. 각 죄마다 특화된 효과.', y, { gap: 8 });
    y += _addHeader('◆ 만능 카드', y);
    y += _addLine('5% 확률, 한 게임당 1회 등장. 어떤 죄로도 사용 가능.', y, { gap: 8 });
    y += _addHeader('◆ 등급업권', y);
    y += _addLine('매점에서 구매. 보유 카드 1장 등급 ↑.', y);
  }

  // === 탭 5: 매점 ===
  function _renderShop() {
    let y = contentTopY;
    y += _addHeader('◆ 골드 매점', y);
    y += _addLine('각 보스 직전 진입. 카드 3장 + 리롤 (스테이지당 4회, 30G).', y, { gap: 8 });

    y += _addHeader('◆ 매점 아이템 종류', y);
    y += _addLine('🔥 힘의 영약 — 30초 공격력 +25% (80G)', y, { size: '13px' });
    y += _addLine('⚡ 신속의 영약 — 30초 공속 +25% (80G)', y, { size: '13px' });
    y += _addLine('🛡 강철의 영약 — 30초 피해 감소 +25% (90G)', y, { size: '13px' });
    y += _addLine('💢 광폭의 묘약 — 30초 공격력 +45% / 받는 피해 +15% (60G)', y, { size: '13px' });
    y += _addLine('📿 경험의 영약 — 30초 EXP +50% (70G)', y, { size: '13px' });
    y += _addLine('🪨 부활석 — 사망 시 자동 부활 HP 35% (200G)', y, { size: '13px' });
    y += _addLine('⬆ 등급업권 — 보유 카드 1장 등급 +1 (180G)', y, { size: '13px' });
    y += _addLine('😈 악마의 계약 — HP 30% 소모 → 골드 +200 (무료)', y, { size: '13px', gap: 10 });

    y += _addHeader('◆ 다이아 매점 (메뉴)', y);
    y += _addLine('영구 강화 / 장비. 게임 간 영속.', y, { gap: 8 });

    y += _addHeader('◆ 인벤토리', y);
    y += _addLine('부활석/등급업권은 가방 보관, 클릭 사용. 영약은 즉시 발동.', y, { gap: 8 });

    y += _addHeader('◆ 기본 물약', y);
    y += _addLine('우하단 — HP 20% 회복 + 30초 쿨다운. 항상 보유.', y);
  }

  // 초기 렌더
  renderTabButtons();
  _renderContent();
}
