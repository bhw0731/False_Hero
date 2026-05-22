// 전투 / 게임 종료 시각 효과 — 큰 화면 단위 연출
//   - showBossIntro   보스 등장 영화적 연출 (오버레이 + sprite + 텍스트 + camera shake + BGM 전환)
//   - showGameOver    게임오버 — "실패" + 통계 + 글래스 버튼
//   - showGameClear   10스테이지 클리어 — 통계 패널 + 글래스 버튼
//
// 모든 함수는 `scene` 인자(GameScene 인스턴스)를 받음. scene 의 상태 플래그(bossIntroActive,
// gameOverActive)와 게임 시스템(player, waveSystem) 을 직접 읽고 씀.

import { sound } from '../../systems/SoundManager.js';
import { clearSave } from '../../data/save.js';
import { getDiamonds } from '../../data/meta/diamonds.js';
import { SLOTS } from '../../data/items.js';
import { makeGlassBtn } from '../glassBtn.js';
import { FONT, FONT_DISP, addText } from '../theme.js';

// 게임오버/클리어 거대 텍스트 — Pretendard 굵은 weight (Bold) 로 임팩트 확보
const FONT_BIG  = FONT;
const COLOR_GOLD      = '#C5A059';
const COLOR_TEXT_2ND  = '#9A9AA2';

// === 보스 등장 연출 — 제거됨 (추후 재설계) ===
// 시각 cinematic 전체 무력화. BGM 전환은 게임플레이 신호로 보존.
// scene.bossIntroActive 플래그도 설정 안 함 — GameScene.update 의 가드 (line 270)
// 가 true 로 남으면 게임이 무한 일시정지되므로 의도적으로 건드리지 않음.
// 호출처 (WaveSystem 'boss-spawned' → GameScene wrapper) 는 그대로 유지.
export function showBossIntro(scene, data) {
  const isSubBoss = data && data.isSubBoss === true;
  const isElite   = data && data.isElite === true;
  // [Phase P-54] BGM — 서브 = subboss 트랙, 정예 = subboss + 카메라 가벼운 셰이크, 메인 = boss 트랙.
  sound.crossfadeBgm(scene, (isSubBoss || isElite) ? 'game_subboss' : 'game_boss', 600);
  sound.bossAppear();

  // 정예 보스 등장 — 짧은 라벨 플래시 (메인/서브와 차별화)
  if (isElite && scene.cameras && scene.cameras.main) {
    scene.cameras.main.shake(150, 0.003);
    const cx = scene.scale.width / 2;
    const label = scene.add.text(cx, 110, `⚔ 정예 등장 — ${data.name || ''}`, {
      fontFamily: FONT, fontSize: '24px', color: '#A855F7', fontStyle: '900',
    }).setOrigin(0.5).setDepth(2500).setScrollFactor(0);
    label.setShadow(0, 0, '#A855F7', 12, true, true);
    label.alpha = 0;
    scene.tweens.add({
      targets: label, alpha: { from: 0, to: 1 }, duration: 250, ease: 'Sine.easeOut',
      yoyo: true, hold: 1500, repeat: 0,
      onComplete: () => { try { label.destroy(); } catch {} },
    });
  }
}

// === 게임 클리어 — 10스테이지 마왕 처치 시 통계 화면 ===
// [Phase P-19] 480 → 640 (캔버스 1280 가운데). 통계 패널 leftX/rightX 도 정합 시프트.
export function showGameClear(scene, unlockedDifficulty) {
  scene.gameOverActive = true;
  const cx = scene.scale.width / 2;   // 640 (P-19)

  // 어두운 막
  // [Phase P-7b] 캔버스 1280×600 전체 덮기 — 동적 크기 조회
  scene.add.rectangle(cx, scene.scale.height / 2, scene.scale.width, scene.scale.height, 0x000000, 0.92).setScrollFactor(0);

  // 타이틀
  addText(scene, cx, 50, '🏆  마왕 처치!', {
    fontFamily: FONT_DISP, fontSize: '32px', color: COLOR_GOLD, fontStyle: '700',
  }).setOrigin(0.5).setScrollFactor(0).setShadow(0, 0, '#DAA520', 12, true, true);
  addText(scene, cx, 82, '"가짜였는데... 진짜로 해냈습니다."', {
    fontFamily: FONT, fontSize: '20px', color: COLOR_GOLD, fontStyle: '500',
  }).setOrigin(0.5).setScrollFactor(0);

  // 챕터 클리어 안내 — 1챕터 완료. 추후 2/3챕터 업데이트 예정.
  addText(scene, cx, 105, '✨  1챕터 클리어! · 추후 2챕터 업데이트 예정', {
    fontFamily: FONT, fontSize: '20px', color: COLOR_GOLD, fontStyle: '700',
  }).setOrigin(0.5).setScrollFactor(0);

  // === 통계 패널 ===
  const stats = scene.player.runStats;
  const elapsedSec = Math.floor((Date.now() - stats.startTime) / 1000);
  const min = Math.floor(elapsedSec / 60);
  const sec = elapsedSec % 60;
  const timeStr = `${min}분 ${String(sec).padStart(2, '0')}초`;

  scene.add.rectangle(cx, 275, 600, 290, 0x14142B, 0.95).setStrokeStyle(1, 0xC5A059).setScrollFactor(0);

  // [Phase P-19] leftX 220→380 / rightX 500→660 (cx 640 기준 양옆 ±260 / ±20 시프트).
  const leftX = 380, rightX = 660;
  const startY = 175;
  const lineH = 26;

  const drawStatLine = (x, y, label, value, valueColor = COLOR_GOLD) => {
    addText(scene, x, y, label, {
      fontFamily: FONT, fontSize: '19px', color: '#94A3B8',
    }).setScrollFactor(0);
    addText(scene, x + 180, y, value, {
      fontFamily: FONT, fontSize: '20px', color: valueColor, fontStyle: '700',
    }).setOrigin(1, 0).setScrollFactor(0);
  };

  // 좌측 — 전투
  addText(scene, leftX, startY - 25, '⚔  전투', {
    fontFamily: FONT, fontSize: '20px', color: '#F87171', fontStyle: '700',
  }).setScrollFactor(0);
  drawStatLine(leftX, startY,           '클리어 시간',  timeStr,                          COLOR_GOLD);
  drawStatLine(leftX, startY + lineH,   '잡몹 처치',    `${stats.enemiesKilled} 마리`,    '#A4D86E');
  drawStatLine(leftX, startY + lineH*2, '보스 처치',    `${stats.bossesKilled} 마리`,     '#F87171');
  drawStatLine(leftX, startY + lineH*3, '입힌 피해',  `${stats.damageDealt.toLocaleString()}`, COLOR_GOLD);
  drawStatLine(leftX, startY + lineH*4, '받은 피해',  `${stats.damageTaken.toLocaleString()}`, '#F87171');
  drawStatLine(leftX, startY + lineH*5, '최고 콤보',    `×${stats.maxKillStreak}`,        '#8B0000');

  // 우측 — 경제 / 빌드
  addText(scene, rightX, startY - 25, '💰  경제 / 빌드', {
    fontFamily: FONT, fontSize: '20px', color: COLOR_GOLD, fontStyle: '700',
  }).setScrollFactor(0);
  drawStatLine(rightX, startY,           '획득 골드',     `${stats.goldEarned.toLocaleString()} 💰`, COLOR_GOLD);
  drawStatLine(rightX, startY + lineH,   '사용 골드',     `${stats.goldSpent.toLocaleString()} 💰`,  '#94A3B8');
  drawStatLine(rightX, startY + lineH*2, '카드 픽',       `${stats.cardsPicked} 장`,                '#C084FC');
  drawStatLine(rightX, startY + lineH*3, '장비 구매',     `${stats.itemsBought} 개`,                '#60A5FA');
  drawStatLine(rightX, startY + lineH*4, '특수카드 구매', `${stats.specialCardsBought} 개`,         '#FF8FB1');
  const equippedCount = SLOTS.filter(s => scene.player.equipment[s]).length;
  drawStatLine(rightX, startY + lineH*5, '장착 슬롯',     `${equippedCount}/8`,                     '#34D399');

  // 최종 레벨
  addText(scene, cx, 445, `최종 레벨  Lv.${scene.player.stats.level}    HP ${scene.player.getStat('maxHp')}    공격 ${scene.player.getStat('attackPower')}`, {
    fontFamily: FONT, fontSize: '20px', color: '#CBD5E1',
  }).setOrigin(0.5).setScrollFactor(0);

  // [▶ 다시 시작] (강조) / [🚪 메뉴로]
  // [Phase P-19] 버튼 x 400/560 → 560/720 (cx 640 기준 ±80 양옆).
  makeGlassBtn(scene, {
    x: cx - 80, y: 495, w: 140, h: 36,
    label: '▶ 다시 시작', fontSize: '22px',
    color: COLOR_GOLD, baseAlpha: 0.45, hoverAlpha: 0.6,
    onClick: () => scene.scene.start('GameScene', { newGame: true }),
  });
  makeGlassBtn(scene, {
    x: cx + 80, y: 495, w: 140, h: 36,
    label: '🚪 메뉴로', fontSize: '22px',
    color: COLOR_TEXT_2ND, baseAlpha: 0.3, hoverAlpha: 0.45,
    onClick: () => scene.scene.start('MenuScene'),
  });
}

// === 스테이지 클리어 — 무한 맵 메인보스 처치 시 표시 ===
// [무한 맵] 스테이지 N 클리어 시 세련된 모달 (1~9스), 10스 = showGameClear (챕터 완료).
export function showStageClear(scene, stage, starInfo = null) {
  scene.gameOverActive = true;  // 게임 멈춤 가드 재활용 (입력 차단)

  const W = scene.scale.width;
  const H = scene.scale.height;
  const cx = W / 2, cy = H / 2;
  const stats = scene.player.runStats || {};
  // [Phase P-54] 이번 스테이지 경과 시간 — 일시정지/모달 시간 제외 누적 (_stageElapsedMs).
  //   폴백: 옛 _stageStartedAt (wall clock) → runStats.startTime.
  let elapsedSec;
  if (scene._stageElapsedMs != null) {
    elapsedSec = Math.floor(scene._stageElapsedMs / 1000);
  } else {
    const startedAt = scene._stageStartedAt || stats.startTime || Date.now();
    elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
  }
  const min = Math.floor(elapsedSec / 60);
  const sec = elapsedSec % 60;
  const timeStr = `${min}분 ${String(sec).padStart(2, '0')}초`;
  const diamondStr = `${(getDiamonds() || 0).toLocaleString()}`;
  const isFinalStage = stage >= 10;

  // 어두운 오버레이 — alpha fade in
  const overlay = scene.add.rectangle(cx, cy, W, H, 0x000000, 0)
    .setDepth(2400).setScrollFactor(0);
  scene.tweens.add({ targets: overlay, alpha: 0.78, duration: 400, ease: 'Sine.easeOut' });

  // 빛줄기 그라데이션 (상단 골드 → 투명)
  const beamG = scene.add.graphics().setDepth(2401).setScrollFactor(0);
  beamG.fillGradientStyle(0xC5A059, 0xC5A059, 0x000000, 0x000000, 0.25, 0.25, 0, 0);
  beamG.fillRect(0, 0, W, H * 0.6);
  beamG.alpha = 0;
  scene.tweens.add({ targets: beamG, alpha: 1, duration: 600, delay: 200 });

  // === [글래스 톤] 클리어 카드 패널 — 스탯 박스 톤 + 골드 광택 강조 ===
  // ⭐ 챕터 2 클리어 — 별점 블록 공간 확보 (그 외 챕터는 기존 높이 유지).
  const hasStars = !!(starInfo && starInfo.best);
  const STAR_BLOCK_H = 70;
  const cardW = 460, cardH = 320 + (hasStars ? STAR_BLOCK_H : 0);
  const cardG = scene.add.graphics().setDepth(2402).setScrollFactor(0);
  cardG.fillStyle(0x000000, 0.65);
  cardG.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 10);
  // 흰 외곽 미세
  cardG.lineStyle(1, 0xFFFFFF, 0.20);
  cardG.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 10);
  // 골드 외곽 (클리어 강조)
  cardG.lineStyle(1.5, 0xC5A059, 0.7);
  cardG.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 10);
  // 상단 골드 광택 라인
  cardG.fillStyle(0xC5A059, 0.5);
  cardG.fillRect(cx - cardW / 2 + 8, cy - cardH / 2 + 2, cardW - 16, 2);
  cardG.alpha = 0;
  cardG.setScale(0.92);
  scene.tweens.add({
    targets: cardG, alpha: 1, scaleX: 1, scaleY: 1,
    duration: 500, delay: 300, ease: 'Back.easeOut',
  });

  // === 타이틀 ===
  const titleY = cy - cardH / 2 + 48;
  const trophy = addText(scene, cx, titleY - 10, '🏆', {
    fontFamily: FONT, fontSize: '44px',
  }).setOrigin(0.5).setDepth(2403).setScrollFactor(0);
  trophy.alpha = 0;
  scene.tweens.add({ targets: trophy, alpha: 1, y: titleY, duration: 500, delay: 500, ease: 'Sine.easeOut' });

  const titleStr = isFinalStage ? '챕터 클리어' : `스테이지 ${stage} 클리어`;
  const title = addText(scene, cx, titleY + 38, titleStr, {
    fontFamily: FONT_DISP, fontSize: '32px', color: '#FFD166', fontStyle: '900',
  }).setOrigin(0.5).setDepth(2403).setScrollFactor(0);
  title.setShadow(0, 0, '#C5A059', 12, true, true);
  title.alpha = 0;
  scene.tweens.add({ targets: title, alpha: 1, duration: 500, delay: 700 });

  // === ⭐ 챕터 2 별점 블록 — 타이틀 아래, 구분선 위 (HP 기준 ★★★) ===
  if (hasStars) {
    const best = starInfo.best || 1;
    const starRowY = titleY + 72;
    const STAR_GAP = 46;
    for (let i = 0; i < 3; i++) {
      const earned = i < best;
      const st = addText(scene, cx + (i - 1) * STAR_GAP, starRowY, earned ? '★' : '☆', {
        fontFamily: FONT, fontSize: '34px',
        color: earned ? '#FFD166' : '#5A5A62', fontStyle: '900',
      }).setOrigin(0.5).setDepth(2403).setScrollFactor(0);
      if (earned) st.setShadow(0, 0, '#C5A059', 10, true, true);
      st.alpha = 0; st.setScale(0.4);
      scene.tweens.add({
        targets: st, alpha: 1, scale: 1,
        duration: 380, delay: 850 + i * 170, ease: 'Back.easeOut',
      });
    }
    // 누적 별 + 신기록 / 보상 상자 개봉 안내 라인
    const total = starInfo.total || 0;
    let sub = `별 ${total} / 30`;
    let subColor = '#9A9AA2';
    if (starInfo.openableChests > 0) {
      sub = `🎁 보상 상자 개봉 가능!   ·   별 ${total} / 30`;
      subColor = '#FFD166';
    } else if (starInfo.improved) {
      sub = `신기록!   ·   별 ${total} / 30`;
      subColor = '#A4D86E';
    }
    const subTxt = addText(scene, cx, starRowY + 30, sub, {
      fontFamily: FONT, fontSize: '16px', color: subColor, fontStyle: '700',
    }).setOrigin(0.5).setDepth(2403).setScrollFactor(0);
    subTxt.setShadow(1, 1, '#000000', 2, false, true);
    subTxt.alpha = 0;
    scene.tweens.add({ targets: subTxt, alpha: 1, duration: 400, delay: 1380 });
  }

  // === 구분선 ===
  const extra = hasStars ? STAR_BLOCK_H : 0;
  const divG = scene.add.graphics().setDepth(2403).setScrollFactor(0);
  divG.lineStyle(1, 0xC5A059, 0.4);
  divG.lineBetween(cx - cardW / 2 + 40, titleY + 80 + extra, cx + cardW / 2 - 40, titleY + 80 + extra);

  // === 통계 ===
  const statY = titleY + 110 + extra;
  const lineH = 32;
  const drawStat = (idx, label, value, valueColor = '#FFD166') => {
    const y = statY + idx * lineH;
    const lbl = addText(scene, cx - 140, y, label, {
      fontFamily: FONT, fontSize: '17px', color: '#9A9AA2', fontStyle: '500',
    }).setOrigin(0, 0.5).setDepth(2403).setScrollFactor(0);
    const val = addText(scene, cx + 140, y, value, {
      fontFamily: FONT, fontSize: '19px', color: valueColor, fontStyle: '700',
    }).setOrigin(1, 0.5).setDepth(2403).setScrollFactor(0);
    val.setShadow(1, 1, '#000000', 2, false, true);
    [lbl, val].forEach((t, i) => {
      t.alpha = 0;
      scene.tweens.add({ targets: t, alpha: 1, duration: 300, delay: 900 + idx * 100 + i * 30 });
    });
  };
  drawStat(0, '⏱  시간',     timeStr, '#FFFFFF');
  drawStat(1, '⚔  처치',     `${stats.enemiesKilled || 0} 마리`, '#A4D86E');
  drawStat(2, '보유 다이아', `${diamondStr}`, '#7EE7FF');

  // === 버튼 ===
  const btnY = cy + cardH / 2 - 50;
  const btnDelay = 1300;
  const _btnHolder = { items: [] };
  const drawBtn = (x, label, color, baseA, hoverA, onClick) => {
    const w = 160, h = 42;
    const bg = scene.add.graphics().setDepth(2404).setScrollFactor(0);
    const draw = (a) => {
      bg.clear();
      bg.fillStyle(0x000000, a);
      bg.fillRoundedRect(x - w / 2, btnY - h / 2, w, h, 6);
      bg.lineStyle(1.5, color, 0.8);
      bg.strokeRoundedRect(x - w / 2, btnY - h / 2, w, h, 6);
    };
    draw(baseA);
    const txt = addText(scene, x, btnY, label, {
      fontFamily: FONT, fontSize: '20px', color: `#${color.toString(16).padStart(6, '0')}`, fontStyle: '800',
    }).setOrigin(0.5).setDepth(2405).setScrollFactor(0);
    txt.setShadow(1, 1, '#000000', 2, false, true);
    const hit = scene.add.rectangle(x, btnY, w, h, 0x000000, 0.001)
      .setDepth(2406).setScrollFactor(0).setInteractive({ useHandCursor: true });
    // [P-59 2차] 호버 제거 — pointerdown 강조, pointerup 액션.
    hit.on('pointerdown',      () => draw(hoverA));
    hit.on('pointerupoutside', () => draw(baseA));
    hit.on('pointerup', () => {
      draw(baseA);
      scene.gameOverActive = false;
      _btnHolder.items.forEach(o => { try { o.destroy && o.destroy(); } catch {} });
      try { overlay.destroy(); beamG.destroy(); cardG.destroy(); } catch {}
      try { trophy.destroy(); title.destroy(); divG.destroy(); } catch {}
      if (onClick) onClick();
    });
    [bg, txt, hit].forEach((o) => {
      o.alpha = 0;
      scene.tweens.add({ targets: o, alpha: 1, duration: 400, delay: btnDelay });
      _btnHolder.items.push(o);
    });
  };

  if (isFinalStage) {
    // 챕터 클리어 — 다시 시작 / 메뉴
    drawBtn(cx - 90, '▶ 다시 시작', 0xC5A059, 0.5, 0.7, () => scene.scene.start('GameScene', { newGame: true }));
    drawBtn(cx + 90, '🚪 메뉴로',   0x9A9AA2, 0.35, 0.5, () => scene.scene.start('MenuScene'));
  } else {
    drawBtn(cx - 90, '▶ 다음 스테이지', 0xC5A059, 0.5, 0.7, () => {
      if (scene.waveSystem && scene.waveSystem.proceedToNextStage) {
        scene.waveSystem.proceedToNextStage();
      }
    });
    drawBtn(cx + 90, '🚪 메뉴로', 0x9A9AA2, 0.35, 0.5, () => scene.scene.start('MenuScene'));
  }
}

// === 게임 오버 — "실패" 화면 + 재시도/메뉴 ===
// [Phase P-19] 480 → 640 (캔버스 1280 가운데).
export function showGameOver(scene) {
  scene.gameOverActive = true;
  clearSave();
  const cx = scene.scale.width / 2;   // 640 (P-19)

  // 가짜 용사 컨셉 — 죽었을 때 위트 있는 문구
  const GAMEOVER_QUOTES = [
    '"진짜 용사였다면 죽지 않았을 텐데..."',
    '"왕국에는 비밀로 해주세요. 부탁이에요."',
    '"공주님, 죄송합니다. 다른 가짜 용사를 알아보세요."',
    '"이래서 자격증이 필요했나 봅니다."',
    '"마왕은 잠깐 기뻐할 겁니다. 다음 가짜를 만나기 전까진."',
    '"진짜 용사가 깨어나길 기도하세요."',
  ];
  const quote = GAMEOVER_QUOTES[Math.floor(Math.random() * GAMEOVER_QUOTES.length)];

  // 어두운 오버레이
  // [Phase P-7b] 캔버스 1280×600 전체 덮기
  scene.add.rectangle(cx, scene.scale.height / 2, scene.scale.width, scene.scale.height, 0x000000, 0.7).setDepth(5).setScrollFactor(0);

  // "실패"
  const title = addText(scene, cx, 200, '실패', {
    fontFamily: FONT_BIG, fontSize: '56px', color: '#DC2626', fontStyle: '700',
    stroke: '#000000', strokeThickness: 4,
  }).setOrigin(0.5).setScrollFactor(0).setDepth(1500);
  title.setShadow(0, 0, '#991B1B', 16, true, true);

  addText(scene, cx, 260, '가짜 용사의 여정이 끝났습니다.', {
    fontFamily: FONT, fontSize: '22px', color: '#C4C8CF', fontStyle: '500',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(1500);

  addText(scene, cx, 300, quote, {
    fontFamily: FONT, fontSize: '20px', color: COLOR_GOLD, fontStyle: 'italic',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(1500);

  // 도달 스테이지 / 웨이브
  const sInfo = (scene.waveSystem && scene.waveSystem.getStageInfo) ? scene.waveSystem.getStageInfo() : { stage: 1, wave: 1 };
  addText(scene, cx, 340, `스테이지 ${sInfo.stage} · 웨이브 ${sInfo.wave}`, {
    fontFamily: FONT, fontSize: '20px', color: COLOR_GOLD, fontStyle: '700',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(1500);

  // [Phase P-19] 버튼 x 400/560 → 560/720 (cx 640 기준 ±80 양옆).
  // [▶ 재시도] (강조)
  makeGlassBtn(scene, {
    x: cx - 80, y: 400, w: 140, h: 40,
    label: '▶ 재시도', fontSize: '22px',
    color: COLOR_GOLD, baseAlpha: 0.45, hoverAlpha: 0.6,
    depth: 1500,
    onClick: () => scene.scene.start('GameScene', { newGame: true }),
  });

  // [🚪 메뉴로]
  makeGlassBtn(scene, {
    x: cx + 80, y: 400, w: 140, h: 40,
    label: '🚪 메뉴로', fontSize: '22px',
    color: COLOR_TEXT_2ND, baseAlpha: 0.3, hoverAlpha: 0.45,
    depth: 1500,
    onClick: () => scene.scene.start('MenuScene'),
  });
}
