// 환경설정 씬 [P-64 / P-64a / P-64b] — 도전과제·강화상점 톤 + 세로 스크롤 + 모바일 호환.
//   카테고리: 사운드 / 게임 / 계정 / 정보·지원.

import Phaser from 'phaser';
import { gameSettings, saveSettings } from '../data/settings.js';
import { FONT, addText } from '../ui/theme.js';
import { attachTouchFeedback } from '../ui/touchFeedback.js';
import { addDiamonds } from '../data/diamonds.js';

const COLOR_GOLD     = '#FFD166';
const COLOR_BEIGE    = '#FFE9B5';
const COLOR_TEXT_2ND = '#9A9AA2';
const COLOR_DIM      = '#6A6A72';

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SettingsScene' });
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    attachTouchFeedback(this, { particlesOnEmpty: true });

    // === 베이스 다크 배경 ===
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(-10);

    // === 헤더 (← 나가기 / ◈ 환경 설정) ===
    const exitTxt = this.add.text(20, 32, '◀  나가기', {
      fontFamily: FONT, fontSize: '20px', color: COLOR_BEIGE, fontStyle: '800',
    }).setOrigin(0, 0.5).setDepth(900);
    exitTxt.setShadow(2, 2, '#000000', 3, false, true);
    const exitHit = this.add.zone(20, 32, 140, 44).setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true }).setDepth(900);
    exitHit.on('pointerdown',      () => exitTxt.setColor('#FFFFFF'));
    exitHit.on('pointerup',        () => { exitTxt.setColor(COLOR_BEIGE); this._exit(); });
    exitHit.on('pointerupoutside', () => exitTxt.setColor(COLOR_BEIGE));

    const titleTxt = this.add.text(W / 2, 32, '◈ 환경 설정', {
      fontFamily: FONT, fontSize: '22px', color: COLOR_GOLD, fontStyle: '900',
    }).setOrigin(0.5).setDepth(900);
    titleTxt.setShadow(2, 2, '#000000', 3, false, true);

    // === 콘텐츠 프레임 (정적) ===
    const FRAME_PAD_X = Math.max(20, Math.round(W * 0.03));
    const FRAME_TOP   = 72;
    const FRAME_BOT   = H - 16;
    const FRAME_X = FRAME_PAD_X;
    const FRAME_W = W - FRAME_PAD_X * 2;
    const FRAME_H = FRAME_BOT - FRAME_TOP;
    // 프레임 채움 (depth 0).
    const frameG = this.add.graphics().setDepth(0);
    frameG.fillStyle(0x0E1726, 0.85);
    frameG.fillRoundedRect(FRAME_X, FRAME_TOP, FRAME_W, FRAME_H, 8);

    // === 스크롤 컨테이너 — 박스 외곽 안쪽까지만 mask (테두리 두께 inset). ===
    this._panel = this.add.container(0, 0).setDepth(1);
    const MASK_INSET = 3;   // 외곽 라인 (1px) + 안전 여유.
    const MASK_X = FRAME_X + MASK_INSET;
    const MASK_Y = FRAME_TOP + MASK_INSET;
    const MASK_W = FRAME_W - MASK_INSET * 2;
    const MASK_H = FRAME_H - MASK_INSET * 2;
    const maskG = this.make.graphics({ add: false });
    maskG.fillStyle(0xffffff);
    maskG.fillRect(MASK_X, MASK_Y, MASK_W, MASK_H);
    this._panel.setMask(maskG.createGeometryMask());

    // === Occluder — mask 보조: 박스 위/아래 바깥 영역을 검정으로 가림 (depth 50). ===
    //   geometry mask 가 일부 환경에서 새는 것 방지 (스크롤 시 박스 밖 누출 차단).
    const occTop = this.add.graphics().setDepth(50);
    occTop.fillStyle(0x000000, 1);
    occTop.fillRect(0, 0, W, FRAME_TOP);
    const occBot = this.add.graphics().setDepth(50);
    occBot.fillStyle(0x000000, 1);
    occBot.fillRect(0, FRAME_BOT, W, H - FRAME_BOT);

    // === 프레임 외곽선 — occluder 위에 다시 그려 박스 라인 보이게 (depth 60). ===
    const frameBorder = this.add.graphics().setDepth(60);
    frameBorder.lineStyle(1, 0xC5A059, 0.6);
    frameBorder.strokeRoundedRect(FRAME_X, FRAME_TOP, FRAME_W, FRAME_H, 8);
    frameBorder.fillStyle(0xFFFFFF, 0.08);
    frameBorder.fillRect(FRAME_X + 2, FRAME_TOP + 2, FRAME_W - 4, 1);

    // === 레이아웃 상수 — _buildContent 재호출 시 재사용. ===
    const PAD_INNER = Math.max(16, Math.round(FRAME_W * 0.04));
    this._lay = {
      FRAME_TOP, FRAME_X, FRAME_W,
      MASK_Y, MASK_H,
      SECTION_GAP: 14, ROW_H: 50,
      COL_LX: FRAME_X + PAD_INNER,
      COL_RX: FRAME_X + FRAME_W - PAD_INNER,
    };
    this._expanded = { terms: false, privacy: false, credits: false };
    this._scrollY = 0;

    this._buildContent();
    this._initScrollHandlers();

    // ESC = 뒤로.
    this.input.keyboard.on('keydown-ESC', () => this._exit());

    // 씬 종료 시 HTML input 정리.
    this.events.on('shutdown', () => this._unmountCodeInput());
    this.events.on('destroy',  () => this._unmountCodeInput());
  }

  // === 콘텐츠 빌드 (아코디언 펼침/접힘 시 재호출). ===
  _buildContent() {
    if (this._panel) this._panel.removeAll(true);
    const L = this._lay;
    let y = L.FRAME_TOP + 14;

    const _section = (label) => {
      y += 4;
      const t = this._track(this.add.text(L.COL_LX, y, label, {
        fontFamily: FONT, fontSize: '16px', color: '#E8D4A8', fontStyle: '900', letterSpacing: 3,
      }).setOrigin(0, 0.5));
      const g = this._track(this.add.graphics());
      g.fillStyle(0xC5A059, 0.40);
      g.fillRect(L.COL_LX + t.width + 12, y - 0.5, L.COL_RX - (L.COL_LX + t.width + 12), 1);
      y += 28;
    };

    _section('사운드');
    this._makeSliderRow(L.COL_LX, L.COL_RX, y, 'BGM 볼륨', 'bgmVolume'); y += L.ROW_H;
    this._makeSliderRow(L.COL_LX, L.COL_RX, y, '효과음 볼륨', 'sfxVolume'); y += L.ROW_H;
    this._makeToggleRow(L.COL_LX, L.COL_RX, y, '진동', 'vibration'); y += L.ROW_H;

    y += L.SECTION_GAP;
    _section('게임');
    this._makeChoiceRow(L.COL_LX, L.COL_RX, y, '언어', 'language',
      [{ v: 'ko', l: '한국어' }, { v: 'en', l: 'English' }]); y += L.ROW_H;
    this._makeToggleRow(L.COL_LX, L.COL_RX, y, '화면 흔들림', 'screenShake'); y += L.ROW_H;

    y += L.SECTION_GAP;
    _section('계정');
    this._makeAccountRow(L.COL_LX, L.COL_RX, y); y += L.ROW_H;
    this._makeCodeInputRow(L.COL_LX, L.COL_RX, y); y += L.ROW_H;

    y += L.SECTION_GAP;
    _section('정보 · 지원');
    y = this._makeAccordionRow(L.COL_LX, L.COL_RX, y, '이용약관', 'terms');
    y = this._makeAccordionRow(L.COL_LX, L.COL_RX, y, '개인정보처리방침', 'privacy');
    y = this._makeAccordionRow(L.COL_LX, L.COL_RX, y, '크레딧', 'credits');

    y += 12;   // 하단 여유.

    // === 스크롤 영역 갱신. ===
    this._scrollMaxY = Math.max(0, y - (L.MASK_Y + L.MASK_H));
    this._scrollTopY = L.MASK_Y;
    this._scrollBotY = L.MASK_Y + L.MASK_H;
    // 펼침으로 콘텐츠 줄었을 때 스크롤 위치 클램프.
    this._scrollY = Math.max(0, Math.min(this._scrollMaxY, this._scrollY));
    if (this._panel) this._panel.y = -this._scrollY;
    this._repositionCodeInput();
  }

  // === 패널 추적 — 생성한 객체를 panel container 에 자동 추가 ===
  _track(obj) {
    if (this._panel && obj) this._panel.add(obj);
    return obj;
  }

  // === 스크롤 핸들러 (휠 + 터치 드래그) ===
  _initScrollHandlers() {
    // 휠 — 데스크탑.
    this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
      if (pointer.y < this._scrollTopY || pointer.y > this._scrollBotY) return;
      this._setScroll(this._scrollY + dy);
    });
    // 드래그 — 모바일/마우스.
    let _dragging = false;
    let _dragY = 0;
    this.input.on('pointerdown', (p) => {
      if (p.y >= this._scrollTopY && p.y <= this._scrollBotY) {
        _dragging = true;
        _dragY = p.y;
      }
    });
    this.input.on('pointermove', (p) => {
      if (!_dragging || !p.isDown) return;
      const delta = _dragY - p.y;
      _dragY = p.y;
      this._setScroll(this._scrollY + delta);
    });
    this.input.on('pointerup',         () => { _dragging = false; });
    this.input.on('pointerupoutside',  () => { _dragging = false; });
  }

  _setScroll(yPx) {
    this._scrollY = Math.max(0, Math.min(this._scrollMaxY, yPx));
    if (this._panel) this._panel.y = -this._scrollY;
    this._repositionCodeInput();   // 스크롤 시 HTML input 위치 동기화.
  }

  _exit() {
    saveSettings();
    this.scene.start('MenuScene');
  }

  // ===== 행 헬퍼 =====

  _rowLabel(lx, y, label) {
    const t = this.add.text(lx, y, label, {
      fontFamily: FONT, fontSize: '17px', color: COLOR_BEIGE, fontStyle: '700',
    }).setOrigin(0, 0.5);
    t.setShadow(1, 1, '#000000', 2, false, true);
    return this._track(t);
  }

  _makeSliderRow(lx, rx, y, label, key) {
    this._rowLabel(lx, y, label);
    const barW = Math.min((rx - lx) * 0.50, 260);
    const barH = 10;
    const barX = rx - barW - 110;
    const barG = this._track(this.add.graphics());
    const valTxt = this._track(this.add.text(rx, y, this._formatPct(key), {
      fontFamily: FONT, fontSize: '15px', color: COLOR_GOLD, fontStyle: '800',
    }).setOrigin(1, 0.5));
    const drawBar = () => {
      barG.clear();
      barG.fillStyle(0x05080F, 0.85);
      barG.fillRect(barX, y - barH / 2, barW, barH);
      barG.lineStyle(1, 0xFFFFFF, 0.18);
      barG.strokeRect(barX, y - barH / 2, barW, barH);
      const v = gameSettings[key] || 0;
      const fw = Math.max(2, barW * v);
      barG.fillStyle(0xC5A059, 0.90);
      barG.fillRect(barX, y - barH / 2, fw, barH);
      barG.fillStyle(0xFFFFFF, 0.20);
      barG.fillRect(barX, y - barH / 2, fw, 1);
    };
    drawBar();
    const refresh = () => { valTxt.setText(this._formatPct(key)); drawBar(); };
    this._makeMiniBtn(barX + barW + 18, y, '◀', () => {
      gameSettings[key] = Math.max(0, Math.round((gameSettings[key] - 0.1) * 10) / 10);
      refresh();
    });
    this._makeMiniBtn(barX + barW + 52, y, '▶', () => {
      gameSettings[key] = Math.min(1, Math.round((gameSettings[key] + 0.1) * 10) / 10);
      refresh();
    });
    const hit = this._track(this.add.rectangle(barX + barW / 2, y, barW, barH + 8, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true }));
    hit.on('pointerdown', (p) => {
      const ratio = Math.max(0, Math.min(1, (p.x - barX) / barW));
      gameSettings[key] = Math.round(ratio * 10) / 10;
      refresh();
    });
  }

  _formatPct(key) { return `${Math.round((gameSettings[key] || 0) * 100)}%`; }

  _makeToggleRow(lx, rx, y, label, key) {
    this._rowLabel(lx, y, label);
    const w = 72, h = 30;
    const tx = rx - w / 2;
    const g = this._track(this.add.graphics());
    const txt = this._track(this.add.text(tx, y, '', {
      fontFamily: FONT, fontSize: '14px', fontStyle: '900', letterSpacing: 2,
    }).setOrigin(0.5));
    const draw = () => {
      g.clear();
      const on = !!gameSettings[key];
      g.fillStyle(on ? 0xC5A059 : 0x2A2A30, on ? 0.9 : 0.85);
      g.fillRoundedRect(tx - w / 2, y - h / 2, w, h, 6);
      g.lineStyle(1, on ? 0xFFE9B5 : 0x4A4A50, on ? 1 : 0.7);
      g.strokeRoundedRect(tx - w / 2, y - h / 2, w, h, 6);
      txt.setText(on ? 'ON' : 'OFF');
      txt.setColor(on ? '#1A0F08' : '#9A9AA2');
    };
    draw();
    const hit = this._track(this.add.zone(tx, y, Math.max(w, 80), 44).setOrigin(0.5)
      .setInteractive({ useHandCursor: true }));
    hit.on('pointerup', () => { gameSettings[key] = !gameSettings[key]; draw(); });
  }

  _makeChoiceRow(lx, rx, y, label, key, options) {
    this._rowLabel(lx, y, label);
    const cx = rx - 60;
    const valTxt = this._track(this.add.text(cx, y, '', {
      fontFamily: FONT, fontSize: '16px', color: COLOR_GOLD, fontStyle: '900',
    }).setOrigin(0.5));
    const refresh = () => {
      const opt = options.find(o => o.v === gameSettings[key]) || options[0];
      valTxt.setText(opt.l);
    };
    refresh();
    const move = (dir) => {
      const idx = options.findIndex(o => o.v === gameSettings[key]);
      const ni = (idx + dir + options.length) % options.length;
      gameSettings[key] = options[ni].v;
      refresh();
    };
    this._makeMiniBtn(cx - 70, y, '◀', () => move(-1));
    this._makeMiniBtn(cx + 70, y, '▶', () => move(1));
  }

  _makeAccountRow(lx, rx, y) {
    this._rowLabel(lx, y, '계정 연동');
    const stateTxt = this._track(this.add.text(rx - 110, y, '미로그인', {
      fontFamily: FONT, fontSize: '14px', color: COLOR_TEXT_2ND, fontStyle: '700',
    }).setOrigin(1, 0.5));
    this._makePillBtn(rx - 50, y, 90, 36, '로그인', () => {
      console.log('[settings] account login (Firebase pending)');
      if (this.events && this.events.emit) this.events.emit('toast', 'Firebase 연동 예정');
    });
  }

  _makeCodeInputRow(lx, rx, y) {
    this._rowLabel(lx, y, '코드 입력');
    const boxW = 150, boxH = 36;
    // 확인 버튼(cx=rx-50, w=90 → 좌측 rx-95)과 겹치지 않게 우측 끝 rx-105 로 제한.
    const boxRight = rx - 105;
    const boxCx = boxRight - boxW / 2;
    // 박스 시각 (HTML input 뒤 배경 — 테두리만 살짝).
    const g = this._track(this.add.graphics());
    g.fillStyle(0x05080F, 0.85);
    g.fillRoundedRect(boxCx - boxW / 2, y - boxH / 2, boxW, boxH, 6);
    g.lineStyle(1, 0xC5A059, 0.4);
    g.strokeRoundedRect(boxCx - boxW / 2, y - boxH / 2, boxW, boxH, 6);
    // 박스 좌표 보관 — HTML input 정렬용.
    this._codeBoxGeom = { cx: boxCx, y, w: boxW, h: boxH };
    // 인라인 HTML input 마운트 (클릭 시 바로 입력).
    this._mountCodeInput();
    // 확인 버튼 → 입력값 적용.
    this._makePillBtn(rx - 50, y, 90, 36, '확인', () => this._submitCode());
  }

  // === 정보·지원 아코디언 행 — 제목 탭 시 인라인 펼침/접힘. 반환: 다음 y. ===
  _makeAccordionRow(lx, rx, y, label, kind) {
    const open = !!this._expanded[kind];
    // 제목 줄.
    const titleTxt = this._track(this.add.text(lx, y, label, {
      fontFamily: FONT, fontSize: '17px', color: open ? COLOR_GOLD : COLOR_BEIGE, fontStyle: '700',
    }).setOrigin(0, 0.5));
    titleTxt.setShadow(1, 1, '#000000', 2, false, true);
    // 펼침 표시 (▼ / ▲).
    const arrow = this._track(this.add.text(rx, y, open ? '▲' : '▼', {
      fontFamily: FONT, fontSize: '15px', color: COLOR_GOLD, fontStyle: '900',
    }).setOrigin(1, 0.5));
    // 제목 줄 전체 탭 영역.
    const hit = this._track(this.add.zone(lx, y - 22, rx - lx, 44).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true }));
    hit.on('pointerup', () => {
      this._expanded[kind] = !this._expanded[kind];
      this._buildContent();   // 재빌드로 펼침 반영.
    });
    y += this._lay.ROW_H;

    // 펼친 경우 본문 텍스트.
    if (open) {
      const bodyTxt = this._track(this.add.text(lx, y - 18, this._infoBody(kind), {
        fontFamily: FONT, fontSize: '14px', color: '#CBD5E1', fontStyle: '600',
        wordWrap: { width: rx - lx }, lineSpacing: 6,
      }).setOrigin(0, 0));
      y += bodyTxt.height + 18;
    }
    return y;
  }

  _infoBody(kind) {
    const map = {
      terms: [
        '본 게임 이용약관 (더미).',
        '',
        '1. 본 게임은 개인 학습/취미용 프로젝트입니다.',
        '2. 게임 진행에 따른 데이터 손실은 책임지지 않습니다.',
        '3. 실제 약관은 추후 작성 예정.',
      ].join('\n'),
      privacy: [
        '개인정보처리방침 (더미).',
        '',
        '1. 본 게임은 로컬에만 데이터를 저장합니다.',
        '2. Firebase 연동 시 익명 UID 만 수집.',
        '3. 실제 방침은 추후 작성 예정.',
      ].join('\n'),
      credits: [
        'False Hero — A Fake Hero\'s Tale',
        '',
        'Developer: false hero studios',
        'Engine: Phaser 4 + Vite + Capacitor',
        'Font: Galmuri11 / Cinzel',
        '',
        'Version 1.0.0',
      ].join('\n'),
    };
    return map[kind] || '';
  }

  // Phaser 좌표 → 화면(브라우저) 좌표 변환 (FIT 스케일 반영).
  _phaserToScreen(px, py) {
    const canvas = this.game && this.game.canvas;
    const rect = canvas ? canvas.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const sx = rect.width / this.scale.width;
    const sy = rect.height / this.scale.height;
    return { left: rect.left, top: rect.top, sx, sy,
      x: rect.left + px * sx, y: rect.top + py * sy };
  }

  _mountCodeInput() {
    if (this._codeInputEl) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 32;
    input.placeholder = '코드 입력';
    input.autocomplete = 'off';
    input.autocapitalize = 'characters';
    input.autocorrect = 'off';
    input.spellcheck = false;
    input.enterKeyHint = 'done';
    input.style.cssText = `
      position: fixed; z-index: 9000;
      box-sizing: border-box;
      background: transparent; color: #FFE9B5;
      border: none; outline: none;
      text-align: center; letter-spacing: 1px;
      font-family: ${FONT};
    `;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._submitCode(); }
    });
    document.body.appendChild(input);
    this._codeInputEl = input;
    this._repositionCodeInput();
  }

  _repositionCodeInput() {
    const input = this._codeInputEl;
    const geom = this._codeBoxGeom;
    if (!input || !geom) return;
    // 스크롤 오프셋 반영 (panel.y).
    const panelY = this._panel ? this._panel.y : 0;
    const cyPhaser = geom.y + panelY;
    // mask 영역 밖이면 숨김.
    if (cyPhaser < this._scrollTopY || cyPhaser > this._scrollBotY) {
      input.style.display = 'none';
      return;
    }
    input.style.display = 'block';
    const m = this._phaserToScreen(geom.cx, cyPhaser);
    const wPx = geom.w * m.sx;
    const hPx = geom.h * m.sy;
    input.style.left   = `${m.x - wPx / 2}px`;
    input.style.top    = `${m.y - hPx / 2}px`;
    input.style.width  = `${wPx}px`;
    input.style.height = `${hPx}px`;
    input.style.fontSize = `${Math.max(11, Math.round(13 * m.sy))}px`;
  }

  _unmountCodeInput() {
    if (this._codeInputEl) {
      try { document.body.removeChild(this._codeInputEl); } catch {}
      this._codeInputEl = null;
    }
  }

  _submitCode() {
    const input = this._codeInputEl;
    if (!input) return;
    const val = (input.value || '').trim();
    if (!val) return;
    this._applyCode(val);
    input.value = '';
    try { input.blur(); } catch {}
  }

  _applyCode(code) {
    const c = code.toUpperCase().replace(/\s+/g, '');   // 공백 무시.
    const emit = (msg) => { if (this.events && this.events.emit) this.events.emit('toast', msg); };
    if (c === 'DIAMOND100') {
      addDiamonds(100, 'coupon:DIAMOND100');
      emit('💎 +100 적용됨');
    } else if (c === 'DEVMODE') {
      gameSettings.testMode = true;
      saveSettings();
      // 메인 메뉴에 DEV MODE 항목 노출되도록 잠금 해제 플래그도 설정.
      try { localStorage.setItem('false-hero-dev-unlocked', '1'); } catch {}
      emit('DEV MODE ON');
    } else if (c === 'DEVMODECLOSED') {
      gameSettings.testMode = false;
      saveSettings();
      // 잠금 해제 플래그 제거 → 메인 메뉴에서 DEV MODE 항목 사라짐 (구 키도 제거 — 마이그레이션 복원 방지).
      try {
        localStorage.removeItem('false-hero-dev-unlocked');
        localStorage.removeItem('first-game-dev-unlocked');
      } catch {}
      emit('DEV MODE OFF');
    } else {
      emit('❌ 잘못된 코드');
    }
  }

  // ===== 공용 컴포넌트 =====

  _makeMiniBtn(x, y, label, onClick) {
    const w = 30, h = 30;
    const HIT = 44;
    const g = this._track(this.add.graphics());
    const draw = (pressed = false) => {
      g.clear();
      g.fillStyle(0x121826, 0.95);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
      g.lineStyle(1, pressed ? 0xC5A059 : 0xFFFFFF, pressed ? 0.85 : 0.30);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 4);
    };
    draw(false);
    this._track(addText(this, x, y, label, {
      fontFamily: FONT, fontSize: '15px', color: COLOR_GOLD, fontStyle: '800',
    }).setOrigin(0.5));
    const hit = this._track(this.add.zone(x, y, HIT, HIT).setOrigin(0.5)
      .setInteractive({ useHandCursor: true }));
    hit.on('pointerdown',      () => draw(true));
    hit.on('pointerupoutside', () => draw(false));
    hit.on('pointerup',        () => { draw(false); onClick(); });
  }

  _makePillBtn(cx, y, w, h, label, onClick) {
    const HIT_W = Math.max(w, 44), HIT_H = Math.max(h, 44);
    const g = this._track(this.add.graphics());
    const draw = (pressed = false) => {
      g.clear();
      g.fillStyle(pressed ? 0xB8941F : 0xC5A059, pressed ? 1 : 0.85);
      g.fillRoundedRect(cx - w / 2, y - h / 2, w, h, h / 2);
      g.lineStyle(1, 0xFFE9B5, 0.9);
      g.strokeRoundedRect(cx - w / 2, y - h / 2, w, h, h / 2);
    };
    draw(false);
    this._track(addText(this, cx, y, label, {
      fontFamily: FONT, fontSize: '14px', color: '#1A0F08', fontStyle: '900', letterSpacing: 1,
    }).setOrigin(0.5));
    const hit = this._track(this.add.zone(cx, y, HIT_W, HIT_H).setOrigin(0.5)
      .setInteractive({ useHandCursor: true }));
    hit.on('pointerdown',      () => draw(true));
    hit.on('pointerupoutside', () => draw(false));
    hit.on('pointerup',        () => { draw(false); onClick(); });
  }
}
