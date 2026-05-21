// 공통 모달 시스템 — 글래스 톤 통일, 캔버스 가운데 자동 배치.
// [Phase P-7b] 캔버스 1280×600 으로 변경됨 — 하드코딩 X, scene.scale 동적 조회.
// 사용: const modal = createModal(scene, { title, width, height, ... });
//       modal.body 에 자식 추가, modal.close() 로 닫기.
import { FONT, addText } from './theme.js';

const MODAL_DEPTH = 1000;
const HEADER_H = 40;
const GOLD = 0xC5A059;

export function createModal(scene, opts = {}) {
  // nested modal — 기존 활성 모달은 stash (숨기고 보존). 새 모달 close 시 복원.
  // 옵션 stashParent: false (기본 false) — 기존 동작 유지 (즉시 파괴).
  //   true 시 부모 모달 숨김 후 자식 close 콜백에서 자동 복원.
  // 자식이 createModal 인 경우 stashParent=true 권장 (CardPicker, ConfirmDialog 등).
  const stashParent = opts.stashParent === true;
  let _stashedParent = null;
  if (scene._activeModal && !scene._activeModal._closed) {
    if (stashParent) {
      _stashedParent = scene._activeModal;
      _stashedParent._stash && _stashedParent._stash();
    } else {
      scene._activeModal._destroyImmediate();
    }
  }

  const w = opts.width  || 600;
  const h = opts.height || 420;
  // [Phase P-7b] 캔버스 가운데 동적 조회 — main.js 의 width/height 변경에 자동 적응.
  const canvasW = (scene.scale && scene.scale.width)  || 1280;
  const canvasH = (scene.scale && scene.scale.height) || 600;
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  const pauseGame      = opts.pauseGame === true;
  const showOverlay    = opts.showOverlay !== false;
  // [Phase P-25] showCloseButton 디폴트 true → false (X 버튼 제거 표준).
  //   필요 시 명시적 true (다이아 상점 / 환경설정).
  const showCloseBtn   = opts.showCloseButton === true;
  const overlayCloses  = opts.overlayCloses !== false;
  const title          = opts.title || '';
  // [Phase P-25] collapsable: true 시 자동 접기 ▼ (모달 가운데 아래) + 펼치기 ▲ (640, 400).
  //   다른 모달 진입 시 펼치기 버튼 자동 hide / close 시 복구 (modal-opened/closed listener).
  const collapsable    = opts.collapsable === true;

  // frameless: 모달 외곽 (그림자/배경/외곽선/헤더 액센트) 전부 생략.
  //   풀스크린 씬 (DiamondShopScene 등) 에서 ChallengeScene 과 통일된 무박스 헤더 구현용.
  const frameless = opts.frameless === true;

  // === [세련화] 배경 오버레이 — 어둠 0.6 (옛 0.5 → 더 강조), 모달 부각 ===
  let overlay = null;
  if (showOverlay) {
    overlay = scene.add.rectangle(cx, cy, canvasW, canvasH, 0x000000, 0.6)
      .setDepth(MODAL_DEPTH - 1)
      .setScrollFactor(0)
      .setInteractive();
    if (overlayCloses) {
      overlay.on('pointerdown', (pointer, lx, ly, ev) => {
        if (ev) ev.stopPropagation();
        api.close();
      });
    }
  }

  // 모달 컨테이너
  const container = scene.add.container(cx, cy).setDepth(MODAL_DEPTH).setScrollFactor(0);

  // [Phase P-54] UI 카메라 분리 — 모달 (overlay + container) 메인 카메라 무시.
  //   메인 카메라 lerp 로 인한 텍스트 흔들림 방지. uiCamera 가 모달 전담 렌더.
  if (scene.markAsUI) {
    if (overlay) scene.markAsUI(overlay);
    scene.markAsUI(container);
    // container.add 자동 markAsUI 패치 — 이후 추가되는 자식 (헤더/X버튼/접기버튼 등) 도 UI 표시.
    const _origContainerAdd = container.add.bind(container);
    container.add = (child) => {
      if (scene.markAsUI) scene.markAsUI(child);
      return _origContainerAdd(child);
    };
  }

  // === [Phase P-54] 글래스 톤 모달 — 그림자 / 더블 글로우 / 코너 액센트 ===
  // 드롭 섀도우 (오프셋 0, 5) — frameless 시 생략.
  if (!frameless) {
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.55);
    shadow.fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, 10);
    container.add(shadow);

    const bg = scene.add.graphics();
    bg.fillStyle(0x070A12, 0.92);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(1, 0xFFFFFF, 0.18);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    container.add(bg);
  }

  // 모달 영역 클릭 가로채기 (오버레이로 이벤트 새지 않게)
  const modalHit = scene.add.rectangle(0, 0, w, h, 0x000000, 0.001).setScrollFactor(0).setInteractive();
  container.add(modalHit);

  // === 헤더 — 좌측 골드 한 줄 + 흰 제목 (글로우 X). frameless 시 생략. ===
  if (!frameless) {
    const headerAccent = scene.add.rectangle(-w / 2 + 8, -h / 2 + HEADER_H / 2, 2, HEADER_H - 14, 0xC5A059, 0.7);
    container.add(headerAccent);

    const titleTxt = addText(scene, -w / 2 + 20, -h / 2 + HEADER_H / 2, title, {
      fontFamily: FONT, fontSize: '22px', color: '#E8E8E8', fontStyle: '700',
    }).setOrigin(0, 0.5);
    container.add(titleTxt);

    // 구분선 — 단일 흰 라인.
    const divG = scene.add.graphics();
    divG.fillStyle(0xFFFFFF, 0.10);
    divG.fillRect(-w / 2 + 16, -h / 2 + HEADER_H, w - 32, 1);
    container.add(divG);
  }

  // X 버튼 — 시각 24×24 / 터치 hit 44×44 (모바일 fat finger 안전).
  if (showCloseBtn) {
    const cbSize = 24;
    const cbHitSize = 44;
    const cbX = w / 2 - 8 - cbSize / 2;   // 우측 8px 패딩
    const cbY = -h / 2 + HEADER_H / 2;
    const cbBg = scene.add.graphics();
    const drawCb = (a) => {
      cbBg.clear();
      cbBg.fillStyle(0x000000, a);
      cbBg.fillRoundedRect(cbX - cbSize / 2, cbY - cbSize / 2, cbSize, cbSize, 4);
    };
    drawCb(0.35);
    const cbHit = scene.add.rectangle(cbX, cbY, cbHitSize, cbHitSize, 0x000000, 0.001)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    const cbTxt = addText(scene, cbX, cbY, '✕', {
      fontFamily: FONT, fontSize: '22px', color: '#E8E8E8', fontStyle: '700',
    }).setOrigin(0.5);
    cbTxt.setShadow(1, 1, '#000000', 2, false, true);
    // [P-59 2차] 호버 제거 — 탭 누름 피드백.
    cbHit.on('pointerdown',       (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); drawCb(0.5); });
    cbHit.on('pointerup',         () => { drawCb(0.35); api.close(); });
    cbHit.on('pointerupoutside',  () => drawCb(0.35));
    container.add([cbBg, cbHit, cbTxt]);
  }

  // 본문 컨테이너 — 외부에서 자식 추가 (좌표는 모달 중심 기준 = 컨테이너 로컬 좌표계)
  const body = scene.add.container(0, 0);
  container.add(body);

  // [Phase P-54] body.add 패치 — 추가 자식에 (1) setScrollFactor(0) (2) markAsUI 자동 적용.
  //   UI 카메라가 분리 운영되므로 모달 안 텍스트/그래픽은 main camera 무시 + uiCamera 전담 렌더.
  const _origAdd = body.add.bind(body);
  body.add = (child) => {
    const _fix = (obj) => {
      if (!obj) return;
      if (Array.isArray(obj)) { obj.forEach(_fix); return; }
      if (obj.setScrollFactor) { try { obj.setScrollFactor(0); } catch {} }
    };
    _fix(child);
    if (scene.markAsUI) scene.markAsUI(child);
    return _origAdd(child);
  };

  // ESC 키 — 닫기
  // [Phase P-23] opts.escCloses === false 시 ESC 차단 (카드 선택 모달 등 강제 모달용).
  const escHandler = (ev) => {
    if (ev.code === 'Escape' || ev.key === 'Escape') api.close();
  };
  const escEnabled = opts.escCloses !== false;
  if (escEnabled && scene.input && scene.input.keyboard) {
    scene.input.keyboard.on('keydown', escHandler);
  }

  // 일시정지 (선택) — physics + time 둘 다 정지 (콤보 / DOT / 디버프 타이머 보존).
  let _pausedPhysics = false;
  let _pausedTime = false;
  if (pauseGame && scene.physics && scene.physics.world && !scene.physics.world.isPaused) {
    scene.physics.pause();
    _pausedPhysics = true;
  }
  if (pauseGame && scene.time && !scene.time.paused) {
    scene.time.paused = true;
    _pausedTime = true;
  }

  // [세련화] 등장 트윈 — scale 0.92→1.0 + alpha 0→1, 240ms Back.easeOut (탄력감)
  container.alpha = 0;
  container.setScale(0.92);
  scene.tweens.add({
    targets: container, alpha: 1, scaleX: 1, scaleY: 1,
    duration: 240, ease: 'Back.easeOut',
  });
  if (overlay) {
    overlay.alpha = 0;
    scene.tweens.add({ targets: overlay, alpha: 1, duration: 220, ease: 'Sine.easeOut' });
  }

  // 컨테이너 트리 재귀 — 모든 interactive 자식의 입력 즉시 차단
  // (close 트윈 도중 잔재 클릭이 다음 화면 입력을 가로채는 것을 방지)
  const _disableInputDeep = (go) => {
    if (!go) return;
    if (go.input && typeof go.disableInteractive === 'function') {
      try { go.disableInteractive(); } catch {}
    }
    if (go.list && Array.isArray(go.list)) {
      for (const child of go.list) _disableInputDeep(child);
    }
  };

  const api = {
    container, body, overlay,        // [Phase P-1] overlay 노출 — 카드픽 접기/펼치기 토글용
    headerH: HEADER_H, w, h,
    bodyTopY: -h / 2 + HEADER_H,    // body 안 좌표 기준 본문 상단 y
    bodyBotY:  h / 2,
    _closed: false,
    // nested modal stash — 자식 모달이 떠 있는 동안 부모 숨김 (파괴 X), 자식 close 시 복원.
    _stash: () => {
      if (container) container.setVisible(false);
      if (overlay) { overlay.setVisible(false); try { overlay.disableInteractive(); } catch {} }
      if (escEnabled && scene.input && scene.input.keyboard) {
        scene.input.keyboard.off('keydown', escHandler);
      }
    },
    _restore: () => {
      if (api._closed) return;
      if (container) container.setVisible(true);
      if (overlay) { overlay.setVisible(true); try { overlay.setInteractive(); } catch {} }
      if (escEnabled && scene.input && scene.input.keyboard) {
        scene.input.keyboard.on('keydown', escHandler);
      }
      scene._activeModal = api;
    },
    _destroyImmediate: () => {
      api._closed = true;
      if (scene._activeModal === api) scene._activeModal = null;
      if (scene.events && scene.events.emit) scene.events.emit('modal-closed', api);
      if (escEnabled && scene.input && scene.input.keyboard) scene.input.keyboard.off('keydown', escHandler);
      if (_pausedPhysics && scene.physics && scene.physics.resume) scene.physics.resume();
      if (_pausedTime && scene.time) scene.time.paused = false;
      _disableInputDeep(container);
      if (overlay && overlay.disableInteractive) { try { overlay.disableInteractive(); } catch {} }
      // 진행 중 트윈 종료 — 파괴된 GameObject 위에서 tween 이 돌면 경고/에러.
      try { if (scene.tweens) { scene.tweens.killTweensOf(container); scene.tweens.killTweensOf(overlay); } } catch {}
      if (overlay && overlay.destroy) overlay.destroy();
      if (container && container.destroy) container.destroy();
      if (_stashedParent && _stashedParent._restore) _stashedParent._restore();
    },
    close: () => {
      if (api._closed) return;
      api._closed = true;
      if (scene._activeModal === api) scene._activeModal = null;
      if (scene.events && scene.events.emit) scene.events.emit('modal-closed', api);
      if (escEnabled && scene.input && scene.input.keyboard) scene.input.keyboard.off('keydown', escHandler);
      // 입력 즉시 차단 — 트윈 도중 잔재 클릭이 다음 씬으로 새지 않도록
      _disableInputDeep(container);
      if (overlay && overlay.disableInteractive) { try { overlay.disableInteractive(); } catch {} }
      // 닫기 트윈 — 역순 150ms. physics/time 재개는 트윈 종료 후 (적이 모달 보이는 동안 안 움직임).
      const resumeWorld = () => {
        if (_pausedPhysics && scene.physics && scene.physics.resume) scene.physics.resume();
        if (_pausedTime && scene.time) scene.time.paused = false;
      };
      scene.tweens.add({
        targets: container, alpha: 0, scaleX: 0.95, scaleY: 0.95,
        duration: 150, ease: 'Sine.easeIn',
        onComplete: () => {
          if (container && container.destroy) container.destroy();
          resumeWorld();
          // stash 된 부모 모달 복원.
          if (_stashedParent && _stashedParent._restore) _stashedParent._restore();
        },
      });
      if (overlay) {
        scene.tweens.add({
          targets: overlay, alpha: 0, duration: 150,
          onComplete: () => { if (overlay && overlay.destroy) overlay.destroy(); },
        });
      }
      if (typeof opts.onClose === 'function') opts.onClose();
    },
  };

  scene._activeModal = api;
  // [Phase P-23] modal-opened / modal-closed 이벤트 — 카드픽 접기 펼치기 버튼이 listen 하여
  //   다른 모달 진입 시 자동 hide / close 시 자동 show. 다른 시스템도 hook 가능.
  if (scene.events && scene.events.emit) scene.events.emit('modal-opened', api);

  // === [Phase P-25] collapsable: true 시 접기 ▼ + 펼치기 ▲ 토글 자동 등록 ===
  //   접기 ▼ — 모달 가운데 아래 (local x=0, y=h/2-20). 컨텐츠 영역 침범 X (모달 height +40 가정).
  //   펼치기 ▲ — 화면 절대 좌표 (canvasW/2, 400), 180×44, depth MODAL_DEPTH+100.
  //              다른 모달 진입 시 (modal-opened) 자동 hide / close 시 (modal-closed) 자동 show.
  //   접기 시: container/overlay setVisible(false) + overlay disableInteractive
  //            + scene._activeModal = null (다른 모달 진입 가능).
  //   펼치기 시: setVisible(true) + setInteractive + scene._activeModal = api 복구.
  if (collapsable) {
    let _expandEls = null;
    const _foldModal = () => {
      container.setVisible(false);
      if (overlay) {
        overlay.setVisible(false);
        if (overlay.disableInteractive) { try { overlay.disableInteractive(); } catch {} }
      }
      if (scene._activeModal === api) scene._activeModal = null;
      _expandEls = _createExpandButton();
      // [BUGFIX] fold 시에도 modal-closed emit — 콤보 시간 보존 listener 트리거
      if (scene.events && scene.events.emit) scene.events.emit('modal-closed', api);
    };
    const _unfoldModal = () => {
      if (_expandEls) { _expandEls.destroy(); _expandEls = null; }
      if (api._closed) return;
      container.setVisible(true);
      if (overlay) {
        overlay.setVisible(true);
        if (overlay.setInteractive) { try { overlay.setScrollFactor(0).setInteractive(); } catch {} }
      }
      scene._activeModal = api;
      // [BUGFIX] unfold 시에도 modal-opened emit — 콤보 시간 다시 저장
      if (scene.events && scene.events.emit) scene.events.emit('modal-opened', api);
    };
    const _createExpandButton = () => {
      // [Phase P-54] 펼치기 ▲ 위치/스타일을 접기 ▼ 와 동일하게 — container 절대 좌표 변환.
      //   container 는 캔버스 중앙(cx, cy)에 위치, 접기 ▼ local (0, h/2-20).
      const cx = (scene.scale && scene.scale.width  || 1280) / 2;
      const cy = (scene.scale && scene.scale.height || 600 ) / 2;
      const ecx = cx;
      const ecy = cy + (h / 2 - 20);
      const ew = 100, eh = 30;
      const EDEPTH = MODAL_DEPTH + 100;
      const eg = scene.add.graphics().setDepth(EDEPTH).setScrollFactor(0);
      // [글래스 톤] ▲ 펼치기 — 접기 ▼ 와 동일 톤 (검정 + 미세 흰 외곽, 라운드 6)
      const drawE = (a, hovered = false) => {
        eg.clear();
        eg.fillStyle(0x000000, a + 0.15);
        eg.fillRoundedRect(ecx - ew / 2, ecy - eh / 2, ew, eh, 6);
        eg.fillStyle(0xFFFFFF, hovered ? 0.10 : 0.05);
        eg.fillRect(ecx - ew / 2 + 4, ecy - eh / 2 + 1, ew - 8, 1);
        eg.lineStyle(1, 0xFFFFFF, hovered ? 0.45 : 0.18);
        eg.strokeRoundedRect(ecx - ew / 2, ecy - eh / 2, ew, eh, 6);
      };
      drawE(0.4);
      const etxt = addText(scene, ecx, ecy, '▲ 펼치기', {
        fontFamily: FONT, fontSize: '16px', color: '#E8E8E8', fontStyle: '700',
      }).setOrigin(0.5).setDepth(EDEPTH + 1).setScrollFactor(0);
      etxt.setShadow(1, 1, '#000000', 2, false, true);
      const ehit = scene.add.rectangle(ecx, ecy, ew, eh, 0x000000, 0.001)
        .setScrollFactor(0).setInteractive({ useHandCursor: true })
        .setDepth(EDEPTH + 1)
        .setScrollFactor(0);
      // [P-59 2차] 호버 제거 — 탭 누름 피드백.
      ehit.on('pointerdown',      () => drawE(0.65, true));
      ehit.on('pointerup',        () => { drawE(0.45, false); _unfoldModal(); });
      ehit.on('pointerupoutside', () => drawE(0.45, false));
      // [Phase P-54] 펼치기 버튼 UI 카메라 전담.
      if (scene.markAsUI) scene.markAsUI([eg, etxt, ehit]);
      // 다른 모달 진입 시 자동 hide / close 시 복구
      const onOpened = () => {
        eg.setVisible(false); etxt.setVisible(false); ehit.setVisible(false);
        if (ehit.disableInteractive) { try { ehit.disableInteractive(); } catch {} }
      };
      const onClosed = () => {
        eg.setVisible(true); etxt.setVisible(true); ehit.setVisible(true);
        if (ehit.setInteractive) { try { ehit.setScrollFactor(0).setInteractive({ useHandCursor: true }); } catch {} }
      };
      scene.events.on('modal-opened', onOpened);
      scene.events.on('modal-closed', onClosed);
      return {
        destroy: () => {
          scene.events.off('modal-opened', onOpened);
          scene.events.off('modal-closed', onClosed);
          try { ehit.disableInteractive(); } catch {}
          eg.destroy(); etxt.destroy(); ehit.destroy();
        },
      };
    };
    // 접기 ▼ 버튼 — 모달 가운데 아래 (local 좌표).
    const cbCw = 100, cbCh = 30, cbCx = 0, cbCy = h / 2 - 20;
    // [글래스 톤] ▼ 접기 버튼
    const cbG = scene.add.graphics();
    const drawCb2 = (a, hovered = false) => {
      cbG.clear();
      cbG.fillStyle(0x000000, a + 0.15);
      cbG.fillRoundedRect(cbCx - cbCw / 2, cbCy - cbCh / 2, cbCw, cbCh, 6);
      cbG.fillStyle(0xFFFFFF, hovered ? 0.10 : 0.05);
      cbG.fillRect(cbCx - cbCw / 2 + 4, cbCy - cbCh / 2 + 1, cbCw - 8, 1);
      cbG.lineStyle(1, 0xFFFFFF, hovered ? 0.45 : 0.18);
      cbG.strokeRoundedRect(cbCx - cbCw / 2, cbCy - cbCh / 2, cbCw, cbCh, 6);
    };
    drawCb2(0.4);
    const cbTxt = addText(scene, cbCx, cbCy, '▼ 접기', {
      fontFamily: FONT, fontSize: '16px', color: '#E8E8E8', fontStyle: '700',
    }).setOrigin(0.5);
    cbTxt.setShadow(1, 1, '#000000', 2, false, true);
    const cbHit = scene.add.rectangle(cbCx, cbCy, cbCw, cbCh, 0x000000, 0.001)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    // [P-59 2차] 호버 제거 — 탭 누름 피드백.
    cbHit.on('pointerdown',      () => drawCb2(0.65));
    cbHit.on('pointerup',        () => { drawCb2(0.45); _foldModal(); });
    cbHit.on('pointerupoutside', () => drawCb2(0.45));
    container.add([cbG, cbHit, cbTxt]);
    // close / _destroyImmediate 시 펼치기 버튼 잔재 정리 — try/catch 로 destroy 실패해도 null 처리.
    const _cleanupExpand = () => {
      if (_expandEls) {
        try { _expandEls.destroy(); } catch (e) { /* GameObject 이미 destroyed 등 — 무시 */ }
        _expandEls = null;
      }
    };
    const _origDestroyImm = api._destroyImmediate;
    api._destroyImmediate = () => {
      _cleanupExpand();
      _origDestroyImm();
    };
    const _origClose = api.close;
    api.close = () => {
      _cleanupExpand();
      _origClose();
    };
  }

  return api;
}
