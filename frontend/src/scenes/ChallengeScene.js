// 도전 과제 — 풀스크린 씬. 3개 도전과제 카드 (아이콘 X, 하단 박스가 수령 인터랙션).

import Phaser from 'phaser';
import { FONT } from '../ui/theme.js';
import { getDiamonds } from '../data/diamonds.js';
import {
  CHAPTERS, getCurrentChapter, getCurrentChapterIndex, getChapterProgress,
  getChallengeProgress, claimReward, devSetState,
} from '../data/challenges.js';
import { gameSettings } from '../data/settings.js';
import { applyNearestToPixelTextures } from '../data/spriteOptions.js';
import { attachTouchFeedback } from '../ui/touchFeedback.js';

const COLOR_GOLD     = '#FFD166';
const COLOR_DIAMOND  = '#FFD166';

// 진행바 — 0% 시에도 베이스 가시.
function drawProgressBar(scene, x, y, w, h, ratio, depth = 500, fillHex = 0xD4A942) {
  const bg = scene.add.graphics().setDepth(depth);
  bg.fillStyle(0x1a1f2e, 1);
  bg.fillRect(x, y, w, h);
  if (ratio > 0) {
    const fill = scene.add.graphics().setDepth(depth + 1);
    fill.fillStyle(fillHex, 1);
    fill.fillRect(x, y, Math.max(2, w * ratio), h);
  }
  const border = scene.add.graphics().setDepth(depth + 2);
  border.lineStyle(1, 0xD4A942, 1);
  border.strokeRect(x, y, w, h);
}

export default class ChallengeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ChallengeScene' });
  }

  preload() {
    this.load.image('ui-challenges', 'sprites/menuui/challenges.png');
    this.load.image('icon-diamond', 'sprites/icons/diamond-icon.png');
  }

  create() {
    applyNearestToPixelTextures(this);
    const W = this.scale.width, H = this.scale.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(-10);

    // 배경 이미지 — 외곽 검정 띠 제거.
    const PAD_TOP = 60;
    const bx = W / 2;
    const by = (PAD_TOP + H) / 2;
    const bw = W;
    const bh = H - PAD_TOP;
    this.add.image(bx, by, 'ui-challenges').setDisplaySize(bw, bh).setDepth(0);

    // === 헤더 ===
    const exitTxt = this.add.text(20, 32, '◀  나가기', {
      fontFamily: FONT, fontSize: '20px', color: '#FFE9B5', fontStyle: '800',
    }).setOrigin(0, 0.5).setDepth(900);
    exitTxt.setShadow(2, 2, '#000000', 3, false, true);
    const exitHit = this.add.zone(20, 32, 140, 36).setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true }).setDepth(900);
    exitHit.on('pointerdown',      () => exitTxt.setColor('#FFFFFF'));
    exitHit.on('pointerup',        () => { exitTxt.setColor('#FFE9B5'); this.scene.start('MenuScene'); });
    exitHit.on('pointerupoutside', () => exitTxt.setColor('#FFE9B5'));

    const titleTxt = this.add.text(W / 2, 32, '◈ 도전 과제', {
      fontFamily: FONT, fontSize: '22px', color: COLOR_GOLD, fontStyle: '900',
    }).setOrigin(0.5).setDepth(900);
    titleTxt.setShadow(2, 2, '#000000', 3, false, true);

    // 다이아 잔액 — 갱신 가능하게 멤버에 보관.
    this._diaTxt = this.add.text(W - 20, 32, `${getDiamonds().toLocaleString()}`, {
      fontFamily: FONT, fontSize: '22px', color: COLOR_DIAMOND, fontStyle: '900',
    }).setOrigin(1, 0.5).setDepth(900);
    this._diaTxt.setShadow(2, 2, '#000000', 3, false, true);
    this._diaIcon = this.add.image(W - 20 - this._diaTxt.width - 10, 32, 'icon-diamond')
      .setDisplaySize(72, 44).setOrigin(1, 0.5).setDepth(900).setTint(0xFFD166);
    this._refreshDia = () => {
      this._diaTxt.setText(`${getDiamonds().toLocaleString()}`);
      this._diaIcon.setX(W - 20 - this._diaTxt.width - 10);
    };

    // === 선택된 챕터 — 기본은 현재 진행 챕터. 좌우 화살표로 잠금 해제된 챕터 사이 이동. ===
    this._selectedChapterIdx = getCurrentChapterIndex();

    // === 상단 박스: 챕터명 + 진행도 퍼센트 ===
    const _percentStr = () => {
      const ov = getChapterProgress(this._selectedChapterIdx);
      const pct = ov.total ? Math.floor((ov.cleared / ov.total) * 100) : 0;
      const chName = ov.chapterName || `${this._selectedChapterIdx + 1}챕터`;
      return `${chName}  ·  ${pct}%`;
    };
    const topBoxCx = W / 2;
    const topBoxCy = 113;
    this._overallTxt = this.add.text(topBoxCx, topBoxCy, _percentStr(), {
      fontFamily: FONT, fontSize: '15px', color: '#FFFFFF', fontStyle: '900',
      letterSpacing: 1,
    }).setOrigin(0.5, 0.5).setDepth(500).setAlpha(1);
    this._overallTxt.setShadow(2, 2, '#000000', 4, false, true);
    this._redrawOverallBar = () => {
      this._overallTxt.setText(_percentStr());
    };

    // === 챕터 전환 좌/우 화살표 (잠금 해제된 챕터 사이 이동). ===
    const arrowStyle = { fontFamily: FONT, fontSize: '34px', color: '#FFE9B5', fontStyle: '900' };
    this._chapterLeft = this.add.text(W * 0.04, H * 0.5, '◂', arrowStyle)
      .setOrigin(0.5).setDepth(800).setInteractive({ useHandCursor: true });
    this._chapterLeft.setShadow(2, 2, '#000000', 3, false, true);
    this._chapterRight = this.add.text(W * 0.96, H * 0.5, '▸', arrowStyle)
      .setOrigin(0.5).setDepth(800).setInteractive({ useHandCursor: true });
    this._chapterRight.setShadow(2, 2, '#000000', 3, false, true);
    this._refreshChapterArrows = () => {
      const curMax = getCurrentChapterIndex();   // 잠금 해제된 마지막 챕터 인덱스.
      const idx = this._selectedChapterIdx;
      // ◂: 이전 챕터가 있으면 활성.
      this._chapterLeft.setAlpha(idx > 0 ? 1 : 0.25);
      this._chapterLeft.input.enabled = (idx > 0);
      // ▸: 잠금 해제된 다음 챕터가 있으면 활성.
      this._chapterRight.setAlpha(idx < curMax ? 1 : 0.25);
      this._chapterRight.input.enabled = (idx < curMax);
    };
    const _switchChapter = (dir) => {
      const curMax = getCurrentChapterIndex();
      const next = this._selectedChapterIdx + dir;
      if (next < 0 || next > curMax) return;
      this._selectedChapterIdx = next;
      this._redrawOverallBar();
      this._renderCards();
      this._refreshChapterArrows();
    };
    this._chapterLeft.on('pointerdown',      () => this._chapterLeft.setColor('#FFFFFF'));
    this._chapterLeft.on('pointerupoutside', () => this._chapterLeft.setColor('#FFE9B5'));
    this._chapterLeft.on('pointerup',        () => { this._chapterLeft.setColor('#FFE9B5'); _switchChapter(-1); });
    this._chapterRight.on('pointerdown',      () => this._chapterRight.setColor('#FFFFFF'));
    this._chapterRight.on('pointerupoutside', () => this._chapterRight.setColor('#FFE9B5'));
    this._chapterRight.on('pointerup',        () => { this._chapterRight.setColor('#FFE9B5'); _switchChapter(1); });

    // === 좌표 변환 헬퍼 ===
    const frame = (fx, fy, fw, fh) => {
      const cx = bx - bw / 2 + (fx + fw / 2) * bw;
      const cy = by - bh / 2 + (fy + fh / 2) * bh;
      return { cx, cy, w: fw * bw, h: fh * bh };
    };

    // === 카드 3개. 진행도 정보는 카드 안, 액션 버튼 박스는 카드 외부 (0.86). ===
    const CARDS = [
      { fx: 0.107, fy: 0.18, fw: 0.236, fh: 0.60, btnFy: 0.86, btnFh: 0.08 },
      { fx: 0.382, fy: 0.18, fw: 0.236, fh: 0.60, btnFy: 0.86, btnFh: 0.08 },
      { fx: 0.657, fy: 0.18, fw: 0.236, fh: 0.60, btnFy: 0.86, btnFh: 0.08 },
    ];

    this._renderCards = () => {
      // 기존 카드 요소 destroy 후 재렌더 (수령 시 상태 변경 반영).
      if (this._cardEls) this._cardEls.forEach(e => e && e.destroy && e.destroy());
      this._cardEls = [];

      const _chapter = CHAPTERS[this._selectedChapterIdx] || getCurrentChapter();
      _chapter.items.forEach((c, i) => {
        const slot = CARDS[i];
        if (!slot) return;
        const fr  = frame(slot.fx, slot.fy, slot.fw, slot.fh);
        const btn = frame(slot.fx, slot.btnFy, slot.fw, slot.btnFh);
        const cp = getChallengeProgress(c.id);
        const ratio = c.target ? Math.min(1, cp.progress / c.target) : 0;
        // 상태: in-progress / claimable (cleared && !claimed) / claimed.
        const claimable = cp.cleared && !cp.claimed;
        const claimed = cp.claimed;

        // 제목 (카드 위쪽).
        const nameTxt = this.add.text(fr.cx, fr.cy - fr.h * 0.18, c.name, {
          fontFamily: FONT, fontSize: '28px',
          color: claimed ? '#7A7A82' : '#F1F5F9', fontStyle: '900',
        }).setOrigin(0.5).setDepth(50);
        nameTxt.setShadow(2, 2, '#000000', 3, false, true);
        this._cardEls.push(nameTxt);

        // 설명.
        const descTxt = this.add.text(fr.cx, fr.cy - fr.h * 0.02, c.desc, {
          fontFamily: FONT, fontSize: '15px',
          color: claimed ? '#7A7A82' : '#FFE9B5', fontStyle: '700',
          align: 'center',
        }).setOrigin(0.5).setDepth(50);
        descTxt.setShadow(2, 2, '#000000', 4, false, true);
        this._cardEls.push(descTxt);

        // 보상 — 라벨 + 다이아 아이콘 (황금 tint) + 수치 — 다크판타지 황금 톤 통일.
        const rewardY = fr.cy + fr.h * 0.14;
        const ICON_W = 56, ICON_H = 34, ICON_GAP = 8;
        const lblColor = claimed ? '#7A7A82' : '#FFE9B5';
        const valColor = claimed ? '#7A7A82' : '#FFE9B5';
        const lblTxt = this.add.text(0, 0, '보상', {
          fontFamily: FONT, fontSize: '20px',
          color: lblColor, fontStyle: '900', letterSpacing: 1,
        }).setOrigin(0, 0.5).setVisible(false);
        const valTxt = this.add.text(0, 0, `${c.reward}`, {
          fontFamily: FONT, fontSize: '22px',
          color: valColor, fontStyle: '900', letterSpacing: 1,
        }).setOrigin(0, 0.5).setVisible(false);
        const totalW = lblTxt.width + ICON_GAP + ICON_W + ICON_GAP + valTxt.width;
        const startX = fr.cx - totalW / 2;
        lblTxt.setVisible(true).setPosition(startX, rewardY).setDepth(50);
        lblTxt.setShadow(2, 2, '#000000', 3, false, true);
        const rewardIcon = this.add.image(startX + lblTxt.width + ICON_GAP + ICON_W / 2, rewardY, 'icon-diamond')
          .setDisplaySize(ICON_W, ICON_H).setOrigin(0.5).setDepth(50);
        // 다이아 PNG 차가운 시안 → 황금 톤 tint (배경/라벨과 톤 통일).
        rewardIcon.setTint(claimed ? 0x7A7A82 : 0xFFD166);
        valTxt.setVisible(true).setPosition(startX + lblTxt.width + ICON_GAP + ICON_W + ICON_GAP, rewardY).setDepth(50);
        valTxt.setShadow(2, 2, '#000000', 3, false, true);
        this._cardEls.push(lblTxt, rewardIcon, valTxt);

        // === 카드 안 — 진행도 정보 (텍스트 + 진행바). 클릭 X. ===
        // 카드별 내부 텍스트/바 x 미세 보정.
        const INNER_DX = [4, 1.5, -4];   // 1번 +4, 2번 +1.5, 3번 -4.
        const innerDx = INNER_DX[i] || 0;
        const infoY = fr.cy + fr.h * 0.30;
        const infoTxt = this.add.text(fr.cx + innerDx, infoY,
          `${cp.progress} / ${c.target} 진행`, {
            fontFamily: FONT, fontSize: '13px',
            color: claimed ? '#7A7A82' : COLOR_GOLD, fontStyle: '900',
          }).setOrigin(0.5).setDepth(50);
        infoTxt.setShadow(2, 2, '#000000', 3, false, true);
        this._cardEls.push(infoTxt);
        // 카드 안 진행바 — 베이스 명확 + 두께 ↑.
        const innerBarW = fr.w * 0.78;
        const innerBarH = 10;
        const innerBarX = fr.cx - innerBarW / 2 + innerDx;
        const innerBarY = infoY + 14;
        const innerBarBg = this.add.graphics().setDepth(50);
        innerBarBg.fillStyle(0x2a3142, 1);
        innerBarBg.fillRect(innerBarX, innerBarY, innerBarW, innerBarH);
        this._cardEls.push(innerBarBg);
        if (ratio > 0) {
          const innerBarFill = this.add.graphics().setDepth(51);
          innerBarFill.fillStyle(claimed ? 0x4A4A50 : 0xD4A942, 1);
          innerBarFill.fillRect(innerBarX, innerBarY, Math.max(2, innerBarW * ratio), innerBarH);
          this._cardEls.push(innerBarFill);
        }
        const innerBarBorder = this.add.graphics().setDepth(52);
        innerBarBorder.lineStyle(1, 0xD4A942, claimed ? 0.4 : 0.9);
        innerBarBorder.strokeRect(innerBarX, innerBarY, innerBarW, innerBarH);
        this._cardEls.push(innerBarBorder);

        // === 카드 외부 하단 박스 — 액션 버튼. ===
        // 카드별 좌/우 미세 보정 (PNG 슬롯 위치 차이).
        const BOX_OFFSETS = [
          { left: -1, right: 5 },   // 1번 적 처치자 — 좌 -1 / 우 +5
          { left: 0,  right: 0.5 }, // 2번 보스 슬레이어 — 우 +0.5
          { left: 10, right: -1 },  // 3번 첫 정복 — 좌 +10 / 우 -1
        ];
        const off = BOX_OFFSETS[i] || { left: 0, right: 0 };
        const baseW = fr.w * 0.80;
        const boxW = baseW + off.left + off.right;
        const boxH = btn.h + 1;
        const boxX = fr.cx - baseW / 2 - off.left;
        const boxY = btn.cy - boxH / 2 + 5;

        const boxBg = this.add.graphics().setDepth(500);
        const drawBox = (pressed = false) => {
          boxBg.clear();
          // 모든 상태 박스 완전 투명 — 텍스트만 노출. 눌렀을 때만 살짝 어두운 오버레이.
          if (claimable && pressed) {
            boxBg.fillStyle(0x000000, 0.25);
            boxBg.fillRoundedRect(boxX, boxY, boxW, boxH, 6);
          }
        };
        drawBox(false);
        this._cardEls.push(boxBg);

        // 박스 안 라벨 — 카드별 텍스트 x 미세 보정.
        const LBL_DX = [3, 0, -5];   // 1번 +3, 2번 0, 3번 -5.
        const boxLbl = this.add.text(btn.cx + (LBL_DX[i] || 0), boxY + boxH / 2, '', {
          fontFamily: FONT, fontSize: '19px', fontStyle: '900', letterSpacing: 1,
        }).setOrigin(0.5).setDepth(501).setAlpha(1);
        boxLbl.setShadow(2, 2, '#000000', 4, false, true);
        if (claimed) {
          boxLbl.setText('완료');
          boxLbl.setColor('#C9B48A');
        } else if (claimable) {
          boxLbl.setText('보상 수령');
          boxLbl.setColor('#FFE9B5');
        } else {
          boxLbl.setText('진행 중');
          boxLbl.setColor('#C9B48A');
        }
        this._cardEls.push(boxLbl);

        // 수령 가능 박스만 인터랙티브.
        if (claimable) {
          const hit = this.add.zone(boxX + boxW / 2, boxY + boxH / 2, boxW, boxH)
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(502);
          hit.on('pointerdown',      () => drawBox(true));
          hit.on('pointerupoutside', () => drawBox(false));
          hit.on('pointerup', () => {
            drawBox(false);
            if (claimReward(c.id)) {
              // 챕터 완료 시 새 챕터로 자동 전환.
              const newCur = getCurrentChapterIndex();
              if (this._selectedChapterIdx < newCur) this._selectedChapterIdx = newCur;
              this._refreshDia();
              this._redrawOverallBar();
              this._renderCards();
              this._refreshChapterArrows && this._refreshChapterArrows();
              if (this.events && this.events.emit) this.events.emit('toast', `다이아 +${c.reward}`);
            }
          });
          this._cardEls.push(hit);
        }
      });
    };
    this._renderCards();
    this._refreshChapterArrows();

    attachTouchFeedback(this);

    // === DEV 모드 — 키 1/2/3 으로 해당 카드 상태 순환 (진행 중 → 수령 가능 → 완료 → 진행 중). ===
    if (gameSettings && gameSettings.testMode) {
      const _cycleState = (idx) => {
        const chapter = CHAPTERS[this._selectedChapterIdx] || getCurrentChapter();
        const c = chapter.items[idx];
        if (!c) return;
        const cur = getChallengeProgress(c.id);
        let next;
        if (!cur.cleared)       next = 'claimable';
        else if (!cur.claimed)  next = 'claimed';
        else                    next = 'progress';
        devSetState(c.id, next);
        this._refreshDia();
        this._redrawOverallBar();
        this._renderCards();
        this._refreshChapterArrows && this._refreshChapterArrows();
        if (this.events && this.events.emit) {
          this.events.emit('toast', `[DEV] ${c.name} → ${next}`);
        }
      };
      this.input.keyboard.on('keydown-ONE',   () => _cycleState(0));
      this.input.keyboard.on('keydown-TWO',   () => _cycleState(1));
      this.input.keyboard.on('keydown-THREE', () => _cycleState(2));
      // 화면 우상단 작은 안내 텍스트.
      const devHint = this.add.text(W - 20, H - 12, '[DEV] 1/2/3 키: 카드 상태 순환', {
        fontFamily: FONT, fontSize: '12px', color: '#F87171', fontStyle: '700',
      }).setOrigin(1, 1).setDepth(900).setAlpha(0.7);
    }

    this.cameras.main.fadeIn(280, 0, 0, 0);
  }
}
