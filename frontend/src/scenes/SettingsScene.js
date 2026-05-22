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
    const frameG = this.add.graphics().setDepth(0);
    frameG.fillStyle(0x0E1726, 0.85);
    frameG.fillRoundedRect(FRAME_X, FRAME_TOP, FRAME_W, FRAME_H, 8);
    frameG.lineStyle(1, 0xC5A059, 0.6);
    frameG.strokeRoundedRect(FRAME_X, FRAME_TOP, FRAME_W, FRAME_H, 8);
    frameG.fillStyle(0xFFFFFF, 0.08);
    frameG.fillRect(FRAME_X + 2, FRAME_TOP + 2, FRAME_W - 4, 1);

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

    // === 콘텐츠 — 모든 행 요소는 _track 으로 panel 에 자동 등록. ===
    const PAD_INNER = Math.max(16, Math.round(FRAME_W * 0.04));
    const SECTION_GAP = 14;
    const ROW_H = 50;
    const COL_LX = FRAME_X + PAD_INNER;
    const COL_RX = FRAME_X + FRAME_W - PAD_INNER;

    let y = FRAME_TOP + 14;

    const _section = (label) => {
      y += 4;
      const t = this._track(this.add.text(COL_LX, y, label, {
        fontFamily: FONT, fontSize: '16px', color: '#E8D4A8', fontStyle: '900', letterSpacing: 3,
      }).setOrigin(0, 0.5));
      const g = this._track(this.add.graphics());
      g.fillStyle(0xC5A059, 0.40);
      g.fillRect(COL_LX + t.width + 12, y - 0.5, COL_RX - (COL_LX + t.width + 12), 1);
      y += 28;
    };

    // ─── [사운드] ───
    _section('사운드');
    this._makeSliderRow(COL_LX, COL_RX, y, 'BGM 볼륨', 'bgmVolume'); y += ROW_H;
    this._makeSliderRow(COL_LX, COL_RX, y, '효과음 볼륨', 'sfxVolume'); y += ROW_H;
    this._makeToggleRow(COL_LX, COL_RX, y, '진동', 'vibration'); y += ROW_H;

    y += SECTION_GAP;
    _section('게임');
    this._makeChoiceRow(COL_LX, COL_RX, y, '언어', 'language',
      [{ v: 'ko', l: '한국어' }, { v: 'en', l: 'English' }]); y += ROW_H;
    this._makeToggleRow(COL_LX, COL_RX, y, '화면 흔들림', 'screenShake'); y += ROW_H;

    y += SECTION_GAP;
    _section('계정');
    this._makeAccountRow(COL_LX, COL_RX, y); y += ROW_H;
    this._makeCodeInputRow(COL_LX, COL_RX, y); y += ROW_H;

    y += SECTION_GAP;
    _section('정보 · 지원');
    this._makeLinkRow(COL_LX, COL_RX, y, '이용약관',           () => this._openInfoModal('terms')); y += ROW_H;
    this._makeLinkRow(COL_LX, COL_RX, y, '개인정보처리방침',   () => this._openInfoModal('privacy')); y += ROW_H;
    this._makeLinkRow(COL_LX, COL_RX, y, '크레딧',             () => this._openInfoModal('credits')); y += ROW_H;

    y += 12;   // 하단 여유.

    // === 스크롤 영역 셋업 — mask 경계 기준. ===
    this._scrollMaxY = Math.max(0, y - (MASK_Y + MASK_H));
    this._scrollY = 0;
    this._scrollTopY = MASK_Y;
    this._scrollBotY = MASK_Y + MASK_H;
    this._initScrollHandlers();

    // ESC = 뒤로.
    this.input.keyboard.on('keydown-ESC', () => this._exit());
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

  _makeLinkRow(lx, rx, y, label, onClick) {
    this._rowLabel(lx, y, label);
    const txt = this._track(this.add.text(rx, y, '› 보기', {
      fontFamily: FONT, fontSize: '16px', color: COLOR_GOLD, fontStyle: '800',
    }).setOrigin(1, 0.5));
    txt.setShadow(1, 1, '#000000', 2, false, true);
    const hit = this._track(this.add.zone(rx - 60, y, 120, 44).setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true }));
    hit.on('pointerdown',      () => txt.setColor('#FFFFFF'));
    hit.on('pointerupoutside', () => txt.setColor(COLOR_GOLD));
    hit.on('pointerup',        () => { txt.setColor(COLOR_GOLD); onClick(); });
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
    const boxW = 180, boxH = 36;
    const boxCx = rx - 50 - boxW / 2 - 8;
    const g = this._track(this.add.graphics());
    g.fillStyle(0x05080F, 0.85);
    g.fillRoundedRect(boxCx - boxW / 2, y - boxH / 2, boxW, boxH, 6);
    g.lineStyle(1, 0xFFFFFF, 0.20);
    g.strokeRoundedRect(boxCx - boxW / 2, y - boxH / 2, boxW, boxH, 6);
    this._codeTxt = this._track(this.add.text(boxCx, y, '코드를 입력하세요', {
      fontFamily: FONT, fontSize: '13px', color: COLOR_DIM, fontStyle: '600', letterSpacing: 1,
    }).setOrigin(0.5));
    const boxHit = this._track(this.add.zone(boxCx, y, boxW, Math.max(boxH, 44)).setOrigin(0.5)
      .setInteractive({ useHandCursor: true }));
    boxHit.on('pointerup', () => this._openCodeInputModal());
    this._makePillBtn(rx - 50, y, 90, 36, '확인', () => this._openCodeInputModal());
  }

  _openCodeInputModal() {
    if (this._codeModalEl) return;
    const canvas = this.game && this.game.canvas;
    const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const root = document.createElement('div');
    root.style.cssText = `
      position: fixed;
      left: ${rect.left}px; top: ${rect.top}px;
      width: ${rect.width}px; height: ${rect.height}px;
      z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.7);
      font-family: 'Galmuri11', sans-serif;
    `;
    const box = document.createElement('div');
    box.style.cssText = `
      background: #0E1726; color: #FFE9B5;
      border: 1px solid #C5A059; border-radius: 8px;
      padding: 28px 32px;
      min-width: 320px; max-width: 90%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6);
      display: flex; flex-direction: column; gap: 18px;
    `;
    const title = document.createElement('div');
    title.textContent = '◈ 코드 입력';
    title.style.cssText = 'font-size: 20px; font-weight: 900; color: #FFD166; text-align: center;';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 32;
    input.placeholder = '코드를 입력하세요';
    input.autocomplete = 'off';
    input.autocapitalize = 'characters';
    input.style.cssText = `
      width: 100%;
      padding: 12px 14px;
      font-size: 18px;
      background: #05080F; color: #FFE9B5;
      border: 1px solid #C5A059; border-radius: 6px;
      outline: none;
      letter-spacing: 2px;
      box-sizing: border-box;
    `;
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';
    const mkBtn = (label, primary, onClick) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `
        padding: 10px 22px;
        font-size: 15px; font-weight: 900;
        border-radius: 6px; border: 1px solid ${primary ? '#FFE9B5' : '#4A4A50'};
        background: ${primary ? '#C5A059' : '#1A1F2E'};
        color: ${primary ? '#1A0F08' : '#CBD5E1'};
        cursor: pointer; min-width: 80px;
      `;
      b.addEventListener('click', onClick);
      return b;
    };
    const close = () => {
      if (this._codeModalEl) {
        document.body.removeChild(this._codeModalEl);
        this._codeModalEl = null;
      }
    };
    const cancelBtn = mkBtn('취소', false, close);
    const okBtn = mkBtn('확인', true, () => {
      const val = (input.value || '').trim();
      close();
      if (val) this._applyCode(val);
    });
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    box.appendChild(title);
    box.appendChild(input);
    box.appendChild(btnRow);
    root.appendChild(box);
    root.addEventListener('click', (e) => { if (e.target === root) close(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') okBtn.click();
      else if (e.key === 'Escape') close();
    });
    document.body.appendChild(root);
    this._codeModalEl = root;
    setTimeout(() => input.focus(), 50);
  }

  _applyCode(code) {
    const c = code.toUpperCase();
    if (c === 'DIAMOND100') {
      addDiamonds(100, 'coupon:DIAMOND100');
      if (this.events && this.events.emit) this.events.emit('toast', '💎 +100 적용됨');
    } else if (c === 'DEVMODE') {
      gameSettings.testMode = !gameSettings.testMode;
      saveSettings();
      if (this.events && this.events.emit) this.events.emit('toast', `DEV ${gameSettings.testMode ? 'ON' : 'OFF'}`);
    } else {
      if (this.events && this.events.emit) this.events.emit('toast', '❌ 잘못된 코드');
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

  // ===== 정보 모달 ===== (스크롤 영향 X — depth 2000+)
  _openInfoModal(kind) {
    const W = this.scale.width, H = this.scale.height;
    const dlgW = Math.min(W * 0.7, 720);
    const dlgH = Math.min(H * 0.8, 460);
    const cx = W / 2, cy = H / 2;
    const c = this.add.container(cx, cy).setDepth(2000);
    const overlay = this.add.rectangle(cx, cy, W, H, 0x000000, 0.7).setDepth(1999)
      .setInteractive();
    const g = this.add.graphics();
    g.fillStyle(0x0E1726, 0.97);
    g.fillRoundedRect(-dlgW / 2, -dlgH / 2, dlgW, dlgH, 8);
    g.lineStyle(1, 0xC5A059, 0.5);
    g.strokeRoundedRect(-dlgW / 2, -dlgH / 2, dlgW, dlgH, 8);
    c.add(g);
    const titleMap = { terms: '이용약관', privacy: '개인정보처리방침', credits: '크레딧' };
    const title = addText(this, 0, -dlgH / 2 + 22, `◈ ${titleMap[kind] || '안내'}`, {
      fontFamily: FONT, fontSize: '20px', color: COLOR_GOLD, fontStyle: '900',
    }).setOrigin(0.5);
    c.add(title);
    const bodyMap = {
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
    const body = addText(this, 0, 0, bodyMap[kind] || '', {
      fontFamily: FONT, fontSize: '15px', color: '#CBD5E1', fontStyle: '600',
      align: 'center', wordWrap: { width: dlgW - 60 }, lineSpacing: 6,
    }).setOrigin(0.5);
    c.add(body);
    const xBtn = addText(this, dlgW / 2 - 22, -dlgH / 2 + 22, '✕', {
      fontFamily: FONT, fontSize: '20px', color: COLOR_BEIGE, fontStyle: '900',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    c.add(xBtn);
    const close = () => { overlay.destroy(); c.destroy(); };
    xBtn.on('pointerup', close);
    overlay.on('pointerdown', close);
  }
}
