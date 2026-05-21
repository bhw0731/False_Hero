// 배경 편집 씬 (드래그 방식 + 하단 팔레트)

import Phaser from 'phaser';
import {
  getStageBackground,
  setStageBackground,
  clearStageBackground,
} from '../data/adminConfig.js';
import { C, FONT, FONT_DISP, makeButton } from '../ui/theme.js';

const TOP_H = 50;
const TOTAL_TILES = 132;

const GAME_W = 960;
const GAME_H = 540;
const GAME_TILE_SIZE = 48;

const PAL_TILE = 24;
const PAL_COLS = 33;
const PAL_ROWS = 4;
const PAL_W = PAL_COLS * PAL_TILE;
const PAL_H = PAL_ROWS * PAL_TILE;
const PAL_X = (GAME_W - PAL_W) / 2;
const PAL_Y = 540 - PAL_H - 8;

const PREV_AREA_TOP = TOP_H;
const PREV_AREA_BOTTOM = PAL_Y - 14;
const PREV_AREA_H = PREV_AREA_BOTTOM - PREV_AREA_TOP;
const PREV_SCALE = Math.min(1, PREV_AREA_H / GAME_H);
const PREV_W = GAME_W * PREV_SCALE;
const PREV_H = GAME_H * PREV_SCALE;
const PREV_X = (GAME_W - PREV_W) / 2;
const PREV_Y = PREV_AREA_TOP + (PREV_AREA_H - PREV_H) / 2;

export default class BackgroundEditScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BackgroundEditScene' });
  }

  preload() {
    for (let i = 0; i < TOTAL_TILES; i++) {
      const num = String(i).padStart(4, '0');
      this.load.image(`tile-${i}`, `sprites/t${num}.png`);
    }
  }

  create() {
    this.currentStage = 1;
    this.selectedTile = null;
    this.placedTiles = [];
    this.previewObjects = [];
    this.dragStartTile = null;
    this.dragMoved = false;
    this.ghostTile = null;

    // 배경
    this.add.rectangle(480, 270, 960, 540, Phaser.Display.Color.HexStringToColor(C.bg).color);

    this.gridGraphics = this.add.graphics().setDepth(50);
    this.gridVisible = false;

    // === 상단 바 ===
    const topBg = this.add.rectangle(480, TOP_H / 2, 960, TOP_H, Phaser.Display.Color.HexStringToColor(C.surface).color);
    this.add.rectangle(480, TOP_H, 960, 1, Phaser.Display.Color.HexStringToColor(C.border).color);

    this.add.text(20, TOP_H / 2, '배경 편집', {
      fontFamily: FONT_DISP, fontSize: '19px', color: C.textHi, fontStyle: '600',
    }).setOrigin(0, 0.5);

    // 스테이지 셀렉터
    makeButton(this, 145, TOP_H / 2, '◀', () => this.changeStage(-1), { size: 'sm' });
    this.stageText = this.add.text(190, TOP_H / 2, `스테이지 ${this.currentStage}`, {
      fontFamily: FONT, fontSize: '16px', color: C.accent, fontStyle: '600',
    }).setOrigin(0.5);
    makeButton(this, 235, TOP_H / 2, '▶', () => this.changeStage(1), { size: 'sm' });

    // 선택 타일 표시
    this.selectedDisplay = this.add.text(290, TOP_H / 2, '선택: 없음', {
      fontFamily: FONT, fontSize: '14px', color: C.textDim,
    }).setOrigin(0, 0.5);
    this.selectedTileIcon = null;

    // 우측 버튼 그룹
    makeButton(this, 460, TOP_H / 2, '저장',     () => this.save(),       { variant: 'primary', size: 'sm' });
    makeButton(this, 525, TOP_H / 2, '채우기',   () => this.fillAll(),    { size: 'sm' });
    makeButton(this, 595, TOP_H / 2, '지우기',   () => this.clearAll(),   { variant: 'danger', size: 'sm' });
    makeButton(this, 660, TOP_H / 2, '그리드',   () => this.toggleGrid(), { variant: 'ghost', size: 'sm' });
    makeButton(this, 735, TOP_H / 2, '뒤로',     () => this.scene.start('AdminScene'), { variant: 'ghost', size: 'sm' });

    // === 미리보기 캔버스 ===
    this.prevBg = this.add.rectangle(
      PREV_X + PREV_W / 2, PREV_Y + PREV_H / 2,
      PREV_W, PREV_H, 0x87CEEB
    );
    this.prevBg.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(C.border).color);
    this.prevBg.setInteractive({ useHandCursor: true });
    this.prevBg.on('pointerdown', (pointer) => this.handleCanvasClick(pointer));

    // 안내
    this.add.text(PREV_X, PREV_Y - 18, '👇 아래 팔레트에서 타일을 드래그해서 캔버스에 놓으세요', {
      fontFamily: FONT, fontSize: '14px', color: C.textDim,
    });

    // 게임 바닥선 미리보기
    this.add.rectangle(
      PREV_X + PREV_W / 2,
      PREV_Y + 538 * PREV_SCALE,
      PREV_W, 4 * PREV_SCALE, 0x8B4513
    );

    // === 하단 팔레트 ===
    this.add.rectangle(480, PAL_Y + PAL_H / 2, 960, PAL_H + 22,
      Phaser.Display.Color.HexStringToColor(C.surface).color);
    this.add.rectangle(480, PAL_Y - 11, 960, 1, Phaser.Display.Color.HexStringToColor(C.border).color);

    this.add.text(PAL_X, PAL_Y - 16, '🎨 타일 팔레트  ·  드래그해서 배치  ·  단일 클릭은 "선택" (전부 채우기용)', {
      fontFamily: FONT, fontSize: '12px', color: C.textDim,
    });

    this.makePalette();

    // === 글로벌 드래그 ===
    this.input.on('pointermove', (pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup',   (pointer) => this.handlePointerUp(pointer));

    this.loadStage(this.currentStage);
    this.toggleGrid();   // 기본 ON
  }

  makePalette() {
    for (let i = 0; i < TOTAL_TILES; i++) {
      const col = i % PAL_COLS;
      const row = Math.floor(i / PAL_COLS);
      const x = PAL_X + col * PAL_TILE + PAL_TILE / 2;
      const y = PAL_Y + row * PAL_TILE + PAL_TILE / 2;

      const img = this.add.image(x, y, `tile-${i}`)
        .setDisplaySize(PAL_TILE - 2, PAL_TILE - 2);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', (pointer) => this.startDrag(i, pointer));
    }
  }

  startDrag(tileNum, pointer) {
    this.dragStartTile = tileNum;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.dragMoved = false;
  }

  handlePointerMove(pointer) {
    if (this.dragStartTile === null) return;
    const dx = pointer.x - this.dragStartX;
    const dy = pointer.y - this.dragStartY;
    if (!this.dragMoved && Math.hypot(dx, dy) > 6) {
      this.dragMoved = true;
      const size = GAME_TILE_SIZE * PREV_SCALE;
      this.ghostTile = this.add.image(pointer.x, pointer.y, `tile-${this.dragStartTile}`)
        .setDisplaySize(size, size).setAlpha(0.7).setDepth(150);
    }
    if (this.ghostTile) {
      this.ghostTile.x = pointer.x;
      this.ghostTile.y = pointer.y;
    }
  }

  handlePointerUp(pointer) {
    if (this.dragStartTile === null) return;
    if (this.dragMoved) {
      if (this.ghostTile) { this.ghostTile.destroy(); this.ghostTile = null; }
      if (this.isInCanvas(pointer.x, pointer.y)) {
        this.placeTileAt(pointer.x, pointer.y, this.dragStartTile);
      }
    } else {
      this.selectTile(this.dragStartTile);
    }
    this.dragStartTile = null;
    this.dragMoved = false;
  }

  handleCanvasClick(pointer) {
    if (this.dragMoved) return;
    const { snapX, snapY } = this.toGameSnapped(pointer.x, pointer.y);
    const idx = this.findTileAt(snapX, snapY);
    if (idx !== -1) {
      this.placedTiles.splice(idx, 1);
      this.redrawPreview();
    }
  }

  toGameSnapped(px, py) {
    const gx = (px - PREV_X) / PREV_SCALE;
    const gy = (py - PREV_Y) / PREV_SCALE;
    const T = GAME_TILE_SIZE;
    const col = Math.floor(gx / T);
    const row = Math.floor(gy / T);
    return { snapX: col * T + T / 2, snapY: row * T + T / 2 };
  }

  isInCanvas(x, y) {
    return x >= PREV_X && x <= PREV_X + PREV_W && y >= PREV_Y && y <= PREV_Y + PREV_H;
  }

  placeTileAt(px, py, tileNum) {
    const { snapX, snapY } = this.toGameSnapped(px, py);
    if (snapX < 0 || snapX > GAME_W || snapY < 0 || snapY > GAME_H) return;
    const idx = this.findTileAt(snapX, snapY);
    if (idx !== -1) {
      this.placedTiles[idx].tileNum = tileNum;
    } else {
      this.placedTiles.push({ tileNum, x: snapX, y: snapY });
    }
    this.redrawPreview();
  }

  findTileAt(snapX, snapY) {
    const half = GAME_TILE_SIZE / 2;
    for (let i = this.placedTiles.length - 1; i >= 0; i--) {
      const t = this.placedTiles[i];
      if (Math.abs(t.x - snapX) < half && Math.abs(t.y - snapY) < half) return i;
    }
    return -1;
  }

  selectTile(tileNum) {
    this.selectedTile = tileNum;
    this.selectedDisplay.setText(`선택: tile_${String(tileNum).padStart(4, '0')}`);
    if (this.selectedTileIcon) this.selectedTileIcon.destroy();
    this.selectedTileIcon = this.add.image(420, TOP_H / 2, `tile-${tileNum}`)
      .setDisplaySize(22, 22).setOrigin(0, 0.5);
  }

  redrawPreview() {
    this.previewObjects.forEach(o => o.destroy());
    this.previewObjects = [];
    const dispSize = GAME_TILE_SIZE * PREV_SCALE;
    this.placedTiles.forEach(t => {
      const px = PREV_X + t.x * PREV_SCALE;
      const py = PREV_Y + t.y * PREV_SCALE;
      const obj = this.add.image(px, py, `tile-${t.tileNum}`)
        .setDisplaySize(dispSize, dispSize);
      this.previewObjects.push(obj);
    });
  }

  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    this.gridGraphics.clear();
    if (!this.gridVisible) return;
    this.gridGraphics.lineStyle(1, 0xffffff, 0.18);
    const step = GAME_TILE_SIZE * PREV_SCALE;
    for (let x = 0; x <= PREV_W; x += step) {
      this.gridGraphics.lineBetween(PREV_X + x, PREV_Y, PREV_X + x, PREV_Y + PREV_H);
    }
    for (let y = 0; y <= PREV_H; y += step) {
      this.gridGraphics.lineBetween(PREV_X, PREV_Y + y, PREV_X + PREV_W, PREV_Y + y);
    }
  }

  changeStage(dir) {
    let next = this.currentStage + dir;
    if (next < 1) next = 10;
    if (next > 10) next = 1;
    this.currentStage = next;
    this.stageText.setText(`스테이지 ${this.currentStage}`);
    this.loadStage(this.currentStage);
  }

  loadStage(stage) {
    this.placedTiles = [...getStageBackground(stage)];
    this.redrawPreview();
  }

  save() {
    setStageBackground(this.currentStage, this.placedTiles);
    this.flashMessage(`스테이지 ${this.currentStage} 배경 저장됨`, C.success);
  }

  clearAll() {
    this.placedTiles = [];
    clearStageBackground(this.currentStage);
    this.redrawPreview();
    this.flashMessage(`스테이지 ${this.currentStage} 배경 초기화`, C.warning);
  }

  fillAll() {
    if (this.selectedTile === null) {
      this.flashMessage('팔레트에서 타일 한 번 클릭으로 선택 후 사용', C.danger);
      return;
    }
    this.placedTiles = [];
    const T = GAME_TILE_SIZE;
    for (let y = T / 2; y < GAME_H; y += T) {
      for (let x = T / 2; x < GAME_W; x += T) {
        this.placedTiles.push({ tileNum: this.selectedTile, x: Math.round(x), y: Math.round(y) });
      }
    }
    this.redrawPreview();
    this.flashMessage(`${this.placedTiles.length}개 타일로 채움`, C.success);
  }

  flashMessage(text, color) {
    const msg = this.add.text(480, PREV_Y + PREV_H / 2, text, {
      fontFamily: FONT, fontSize: '18px', color: color || C.textHi, fontStyle: '600',
      backgroundColor: '#0F1419CC', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(200);
    this.tweens.add({ targets: msg, alpha: 0, duration: 1500, onComplete: () => msg.destroy() });
  }
}
