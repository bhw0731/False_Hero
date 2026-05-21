// 사이드 스크롤 무한 맵 시스템 — 옵시디언 나이트 식.
// 스테이지 시작 시 잡몹 + 서브보스 2 + 메인보스 1 모두 미리 배치.
// 플레이어가 우측 진행하며 처치. 메인보스 처치 = 스테이지 클리어.
// 옛 _wavePlan / 자동 진행 / 매점 배너 시스템 완전 폐기 (A 옵션).

import Phaser from 'phaser';
import Enemy from '../entities/Enemy.js';
import ShopNPC from '../entities/ShopNPC.js';
import EventNode from '../entities/EventNode.js';
import { getDifficultyMultiplier, getDifficultyDefenseMultiplier, unlockNextDifficulty, gameSettings } from '../data/settings.js';
import { bossTypes } from '../data/bosses.js';
import { saveGame, clearSave, SAVE_KEY, PROGRESS_KEY } from '../data/save.js';
import { pickChapterDebuffs, serializeChapterDebuffs, deserializeChapterDebuffs } from '../data/stageDebuffs.js';
import { sound } from './SoundManager.js';
import { pickRandomEnemy, pickRandomEnemyForSegment, getEnemyById } from '../data/enemies.js';
import { FONT } from '../ui/theme.js';
import { addDiamonds } from '../data/diamonds.js';

const CHAPTER_CLEAR_COUNT_KEY = 'falseHero.chapterClearCount';

// 잡몹 시각 통일 사이즈 — 슬롯 64px 안에서 일정한 거리감 (24~96 원본 → 48 강제)
const NORMAL_ENEMY_SIZE = 48;
// [Phase P-54] 엘리트 잡몹 — 강한 일반 적 (보스 X). 스테이지당 2마리.
const ELITE_MOB_COUNT = 2;
const ELITE_MOB_SIZE  = 64;
const ELITE_HP_MUL    = 4.0;
const ELITE_ATK_MUL   = 1.5;
const ELITE_EXP_MUL   = 3.0;
const ELITE_GOLD_MUL  = 5.0;

// === 무한 맵 상수 ===
const PLAYER_START_X = 235;
const MAP_LENGTH = 8000;
// [Phase P-54] 5보스 구성: 서브×3 + 정예 + 메인.
const SUB_BOSS_COUNT = 3;
const MAIN_BOSS_OFFSET = 7600;        // player.x + 7600 = 메인보스 위치
const ELITE_BOSS_OFFSET = 6000;       // 정예 = 서브와 메인 사이 (~75% 지점)
const SUB_BOSS_RANGE = [0.20, 0.55];  // 맵 비율 — 서브보스 3마리 분포 범위
const NPC_BEFORE_BOSS = 250;          // 보스 sprite.x 의 N px 좌측에 매점 NPC 배치 (보스 사거리 밖)
// 구간 별 잡몹 수 (5 구간: 시작→서브1→서브2→서브3→정예→메인). 총 100마리, 후반 가중치.
const MOB_COUNT_PER_SEGMENT = [15, 18, 20, 22, 25];
// 보스 스탯 배수 (메인 대비)
const SUB_BOSS_STAT_MUL = 0.5;        // 서브: 메인의 50%
const ELITE_BOSS_STAT_MUL = 0.7;      // 정예: 메인의 70%
const REST_AFTER_BOSS = 200;          // 보스 처치 후 빈 공간 (회복/숨 고르기)
const SEGMENT_START_OFFSET = 200;     // 플레이어 시작 위치 직후 빈 공간
const NPC_MARGIN = 60;                // NPC 직전 잡몹 안 배치 (NPC 시각 깔끔)

export default class WaveSystem {
  constructor(scene, player, combatSystem) {
    this.scene = scene;
    this.player = player;
    this.combatSystem = combatSystem;

    // 스테이지 진행 상태
    this.currentStage = 1;
    this.currentWave = 1;  // 호환 stub — 항상 1

    // 보스 풀
    this._stageUsedBossIds = new Set();
    this._chapterDebuffs = [];

    // 적 / 보스 추적
    this.enemies = [];
    this.currentBoss = null;       // 현재 활성 보스 (서브/정예/메인) — BossDebuffSystem 호환
    this.subBosses = [];           // 스테이지 서브보스 목록 (위치 추적용) — 3마리
    this.eliteBoss = null;         // [Phase P-54] 정예 보스 — 서브와 메인 사이
    this.mainBoss = null;          // 메인보스
    this.shopNpcs = [];            // 매점 NPC 위치 목록 (서브×3 + 정예 + 메인 = 5개)
    this._eventNodes = [];         // [Phase P-54] 이벤트 노드 (보물상자/신의시험)

    // 스테이지 상태
    this.waveActive = false;       // 호환 stub — 스테이지 진행 중 = true
    this._stageCleared = false;

    // 호환 stub (옛 인터페이스)
    this.nextButton = null;
  }

  // === 챕터 디버프 ===

  _ensureChapterDebuffs() {
    if (!Array.isArray(this._chapterDebuffs) || this._chapterDebuffs.length === 0) {
      this._chapterDebuffs = pickChapterDebuffs();
      console.log('[chapter-debuffs] generated', this._chapterDebuffs.map(d => d.id));
    }
  }

  _currentStageDebuff() {
    const idx = this.currentStage - 1;
    if (idx < 0 || idx >= this._chapterDebuffs.length) return null;
    return this._chapterDebuffs[idx] || null;
  }

  // === 보스 추첨 ===

  _pickRandomBoss() {
    const available = bossTypes.filter(b => !this._stageUsedBossIds.has(b.id));
    const pool = available.length > 0 ? available : bossTypes;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    this._stageUsedBossIds.add(chosen.id);
    return chosen;
  }

  // === 스테이지 시작 ===

  // 첫 진입 (옛 startFirstWave 호환)
  startFirstWave() {
    this.currentStage = 1;
    this._enterStage();
  }

  // 스테이지 진입 — 적 모두 미리 배치
  _enterStage() {
    this.currentWave = 1;
    this._ensureChapterDebuffs();
    this._stageUsedBossIds.clear();
    this._stageCleared = false;
    this.subBosses = [];
    this.eliteBoss = null;
    this.mainBoss = null;
    // 옛 NPC entity 정리
    if (this._shopNpcEntities) {
      this._shopNpcEntities.forEach(npc => npc && npc.destroy && npc.destroy());
    }
    this._shopNpcEntities = [];
    this.shopNpcs = [];
    // [Phase P-54] 옛 이벤트 노드 정리
    if (this._eventNodes) {
      this._eventNodes.forEach(n => n && n.destroy && n.destroy());
    }
    this._eventNodes = [];
    this.spawnStage();
    // 매점 NPC entity 생성 — 5보스 직전 (서브×3 + 정예 + 메인).
    const bossesForNpc = [...this.subBosses, this.eliteBoss, this.mainBoss].filter(b => b && b.sprite);
    bossesForNpc.forEach((boss) => {
      const npcX = boss.sprite.x - NPC_BEFORE_BOSS;
      const ent = new ShopNPC(this.scene, npcX, 446);
      this._shopNpcEntities.push(ent);
      this.shopNpcs.push({ x: npcX, visited: false });
    });
  }

  // === 적 spawn — 한 번에 모두 배치 ===

  spawnStage() {
    console.log('[stage] enter: stage=', this.currentStage);
    this.enemies = [];
    this.currentBoss = null;

    // 장비 패시브 — 스테이지 시작 리셋
    if (this.player.onWaveStart) this.player.onWaveStart();

    // 큐 버프 → 활성
    if (this.player.queuedBuffs) {
      this.player.activeBuffs.attackPower     = this.player.queuedBuffs.attackPower     || 0;
      this.player.activeBuffs.attackSpeed     = this.player.queuedBuffs.attackSpeed     || 0;
      this.player.activeBuffs.damageReduction = this.player.queuedBuffs.damageReduction || 0;
      this.player.queuedBuffs.attackPower     = 0;
      this.player.queuedBuffs.attackSpeed     = 0;
      this.player.queuedBuffs.damageReduction = 0;
    }

    sound.crossfadeBgm(this.scene, 'game_normal', 600);

    // [무한 맵] 보스 먼저 spawn → 잡몹 구간 별 분포 결정 위해.
    this._spawnSubBosses();
    this._spawnEliteBoss();
    this._spawnMainBoss();
    this._spawnMobs();
    // [Phase P-54] 엘리트 잡몹 — 강한 일반 적 (보스 X). 스테이지당 2마리.
    this._spawnEliteMobs();
    // [Phase P-54] 이벤트 노드 — 보물 상자 2개 + 신의 시험 1개.
    this._spawnEventNodes();

    this.combatSystem.setEnemies(this.enemies);
    this.waveActive = true;
    // [Phase P-54] 스테이지 별 경과 시간 추적 (UI 타이머 + 클리어 모달 표시용).
    this.scene._stageStartedAt = Date.now();
    // [Phase P-54] 일시정지/모달 무시 누적 — _updateStageTimer 가 delta 누적.
    this.scene._stageElapsedMs = 0;
  }

  _spawnMobs() {
    // [Phase P-54] 5보스 구성 — 6 구간 (서브1/서브2/서브3/정예/메인 직전 + 보스 처치 후 빈 공간).
    const sub1 = this.subBosses[0];
    const sub2 = this.subBosses[1];
    const sub3 = this.subBosses[2];
    const elite = this.eliteBoss;
    const main = this.mainBoss;
    if (!sub1 || !sub1.sprite || !sub2 || !sub2.sprite || !sub3 || !sub3.sprite
        || !elite || !elite.sprite || !main || !main.sprite) return;

    const stageMul = 1 + (this.currentStage - 1) * 0.2;
    let lateBoost = 1;
    if (this.currentStage >= 3) lateBoost = 1 + (this.currentStage - 2) * 0.05;
    if (this.currentStage >= 6) lateBoost += (this.currentStage - 5) * 0.06;
    const totalMul = stageMul * getDifficultyMultiplier() * lateBoost;
    const debuffRange = (this.currentStage - 1) * 5;

    // 구간 정의: [시작, 끝, 잡몹 수] — 시작→서브1→서브2→서브3→정예→메인 (5 구간)
    const segments = [
      { start: PLAYER_START_X + SEGMENT_START_OFFSET, end: sub1.sprite.x - NPC_BEFORE_BOSS - NPC_MARGIN, count: MOB_COUNT_PER_SEGMENT[0] },
      { start: sub1.sprite.x + REST_AFTER_BOSS,        end: sub2.sprite.x - NPC_BEFORE_BOSS - NPC_MARGIN, count: MOB_COUNT_PER_SEGMENT[1] },
      { start: sub2.sprite.x + REST_AFTER_BOSS,        end: sub3.sprite.x - NPC_BEFORE_BOSS - NPC_MARGIN, count: MOB_COUNT_PER_SEGMENT[2] },
      { start: sub3.sprite.x + REST_AFTER_BOSS,        end: elite.sprite.x - NPC_BEFORE_BOSS - NPC_MARGIN, count: MOB_COUNT_PER_SEGMENT[3] },
      { start: elite.sprite.x + REST_AFTER_BOSS,       end: main.sprite.x - NPC_BEFORE_BOSS - NPC_MARGIN, count: MOB_COUNT_PER_SEGMENT[4] },
    ];

    // 구간 안 잡몹을 3~6 마리 그룹으로 분할
    const splitIntoGroups = (total) => {
      const groups = [];
      let remaining = total;
      while (remaining > 0) {
        const size = Math.min(remaining, 3 + Math.floor(Math.random() * 4));   // 3~6
        groups.push(size);
        remaining -= size;
      }
      return groups;
    };

    // [Phase P-54] segIdx 인자 추가 — 세그먼트별 잡몹 분포 다양화.
    const spawnEnemyAt = (x, segIdx = 0) => {
      const type = pickRandomEnemyForSegment(this.currentStage, segIdx);
      const randAtkSpeed = Math.floor(type.attackSpeed * Phaser.Math.FloatBetween(0.9, 1.1));
      const randAtkPower = Math.max(1, Math.floor(type.attackPower * totalMul * Phaser.Math.FloatBetween(0.9, 1.1)));
      const enemy = new Enemy(this.scene, x, 446, {
        id: type.id,
        maxHp: Math.floor(type.baseHp * totalMul),
        attackPower: randAtkPower,
        attackRange: type.attackRange + debuffRange,
        attackSpeed: randAtkSpeed,
        dodgeChance: type.dodgeChance,
        size: NORMAL_ENEMY_SIZE,
        expReward: type.expReward,
        goldReward: Math.floor(type.goldReward * stageMul),
        textureKey: type.spriteKey,
        color: 0x800080,
      });
      this.enemies.push(enemy);
    };

    // 그룹 사이 fixed 간격 — 콤보 유지 가능 거리. 옛 균등 분포 (range/groupCount = 1000+)
    // 는 그룹 사이 이동 10s+ → 콤보 5s 끊김. fixed 200px → 그룹 사이 2s → 콤보 유지.
    const GROUP_GAP = 200;
    const ENEMY_SPACING = 110;     // 그룹 안 sprite 폭 48 + 여유

    segments.forEach((seg, segIdx) => {
      const range = seg.end - seg.start;
      if (range <= 0) {
        // 보스 위치 너무 가까워서 세그먼트 압축됨 — 잡몹 강제 압축 배치 (count 보존).
        console.warn(`[mob-seg] segment ${segIdx} too small (${range}px), force-compressing ${seg.count} mobs`);
        const fallbackX = Math.max(seg.start, seg.end - 50);
        for (let i = 0; i < seg.count; i++) {
          spawnEnemyAt(fallbackX + (i % 3) * 30, segIdx);
        }
        return;
      }
      const groups = splitIntoGroups(seg.count);
      let cursorX = seg.start + 30;
      groups.forEach((groupSize) => {
        const groupHalfW = ((groupSize - 1) / 2) * ENEMY_SPACING;
        const groupCenter = cursorX + groupHalfW;
        for (let j = 0; j < groupSize; j++) {
          const x = groupCenter - groupHalfW + j * ENEMY_SPACING;
          if (x > seg.end) break;
          spawnEnemyAt(x, segIdx);
        }
        cursorX = groupCenter + groupHalfW + GROUP_GAP;
      });
    });
  }

  // [Phase P-54] 이벤트 노드 spawn — 총 5개. 고정 분포 (셔플 X).
  //   시작 직후: 신의 시험 (도박 강제 선택)
  //   서브1 직후: 보물상자
  //   서브2 직후: 보물상자
  //   서브3 직후: 보물상자
  //   정예 직후: 보물상자
  //   잡몹과 절대 겹치지 않음 — 모든 자리가 잡몹 spawn 범위 밖.
  _spawnEventNodes() {
    const sub1 = this.subBosses[0];
    const sub2 = this.subBosses[1];
    const sub3 = this.subBosses[2];
    const elite = this.eliteBoss;
    if (!sub1 || !sub2 || !sub3 || !elite) return;
    if (!sub1.sprite || !sub2.sprite || !sub3.sprite || !elite.sprite) return;

    // 시작 직후 신의 시험 — 플레이어 시작점 235 + 80 = 315 (잡몹 segment 시작 435 직전)
    this._eventNodes.push(new EventNode(this.scene, PLAYER_START_X + 80, 446, 'trial'));
    // 각 보스 직후 보물 상자 (120px 휴식 구역)
    this._eventNodes.push(new EventNode(this.scene, sub1.sprite.x + 120, 446, 'treasure'));
    this._eventNodes.push(new EventNode(this.scene, sub2.sprite.x + 120, 446, 'treasure'));
    this._eventNodes.push(new EventNode(this.scene, sub3.sprite.x + 120, 446, 'treasure'));
    this._eventNodes.push(new EventNode(this.scene, elite.sprite.x + 120, 446, 'treasure'));
  }

  // [Phase P-54] 엘리트 잡몹 spawn — 강한 일반 적 (보스 X). 잡몹 segment 안 무작위 위치.
  _spawnEliteMobs() {
    const sub1 = this.subBosses[0];
    const sub3 = this.subBosses[2];
    const main = this.mainBoss;
    if (!sub1 || !sub3 || !main) return;

    const stageMul = 1 + (this.currentStage - 1) * 0.2;
    const lateBoost = this.currentStage >= 3 ? 1 + (this.currentStage - 2) * 0.05 : 1;
    const totalMul = stageMul * getDifficultyMultiplier() * lateBoost;

    // 엘리트 잡몹 풀 — STRONG 카테고리 (1~3스에선 MID 폴백)
    const ELITE_POOL_LATE  = ['midKnight', 'midBarbarian', 'whiteKnight', 'barbarianWarrior', 'giantkin'];
    const ELITE_POOL_EARLY = ['scorpion', 'dwarf', 'bald', 'lowKnight'];
    const pool = this.currentStage <= 3 ? ELITE_POOL_EARLY : ELITE_POOL_LATE;

    // 위치 — 서브1 직후 ~ 메인 직전. 보스 / 매점 NPC 와 200px 이상 간격 보장.
    const minX = sub1.sprite.x + 400;
    const maxX = main.sprite.x - NPC_BEFORE_BOSS - 200;
    if (maxX - minX < 500) return;  // 너무 좁으면 skip

    // [Phase P-54] 기존 적/이벤트 위치 수집 (엘리트 위치 조정용 — 겹침 방지)
    const occupiedX = this.enemies
      .filter(e => e.sprite)
      .map(e => ({ x: e.sprite.x, halfW: (e.size || 48) / 2 }));
    const MIN_GAP = 90;  // 엘리트(64) + 일반(48) 평균 + 여유

    for (let i = 0; i < ELITE_MOB_COUNT; i++) {
      const baseId = pool[Math.floor(Math.random() * pool.length)];
      const type = getEnemyById(baseId);
      if (!type) continue;
      // 위치 — 균등 분할 + 기존 적과 겹치지 않도록 이동
      const segStart = minX + ((maxX - minX) / ELITE_MOB_COUNT) * i;
      const segEnd   = minX + ((maxX - minX) / ELITE_MOB_COUNT) * (i + 1);
      let x = segStart + Math.random() * (segEnd - segStart);
      // 가장 가까운 기존 적과 MIN_GAP 미만이면 옆으로 밀어냄 (최대 5번 시도)
      for (let tries = 0; tries < 5; tries++) {
        const closest = occupiedX.reduce((min, o) => {
          const d = Math.abs(o.x - x);
          return d < min.d ? { d, o } : min;
        }, { d: Infinity, o: null });
        if (closest.d >= MIN_GAP) break;
        // 우측으로 밀어냄 (segEnd 안으로)
        x = closest.o.x + MIN_GAP + (ELITE_MOB_SIZE / 2);
        if (x > segEnd) x = closest.o.x - MIN_GAP - (ELITE_MOB_SIZE / 2);
      }
      // 최종 클램프 — 5번 밀어내기 후에도 segment 밖일 수 있음.
      x = Math.max(minX, Math.min(maxX, x));
      // 위치 등록 (다음 엘리트 spawn 시 충돌 회피용)
      occupiedX.push({ x, halfW: ELITE_MOB_SIZE / 2 });

      const eliteMob = new Enemy(this.scene, x, 446, {
        id: type.id,
        maxHp: Math.floor(type.baseHp * ELITE_HP_MUL * totalMul),
        attackPower: Math.max(1, Math.floor(type.attackPower * ELITE_ATK_MUL * totalMul)),
        attackRange: type.attackRange + (this.currentStage - 1) * 5,
        attackSpeed: Math.floor(type.attackSpeed * 0.95),
        dodgeChance: type.dodgeChance,
        size: ELITE_MOB_SIZE,
        expReward: Math.floor((type.expReward || 20) * ELITE_EXP_MUL),
        goldReward: Math.floor((type.goldReward || 8) * ELITE_GOLD_MUL * stageMul),
        textureKey: type.spriteKey,
        color: 0xFFD700,  // 골드 틴트 (엘리트 식별용)
      });
      eliteMob.isEliteMob = true;
      this.enemies.push(eliteMob);
    }
  }

  _spawnSubBosses() {
    const stageMul = 1 + (this.currentStage - 1) * 0.2;
    const lateBoost = this.currentStage >= 3 ? 1 + (this.currentStage - 2) * 0.05 : 1;
    const totalMul = stageMul * getDifficultyMultiplier() * lateBoost;

    // [Phase P-54] 서브 3마리 — 맵 20~55% 범위 안 균등 분할 + 약간 랜덤. 메인의 50% 스탯.
    const rangeStart = MAP_LENGTH * SUB_BOSS_RANGE[0];
    const rangeEnd   = MAP_LENGTH * SUB_BOSS_RANGE[1];
    const rangeStep = (rangeEnd - rangeStart) / SUB_BOSS_COUNT;
    for (let i = 0; i < SUB_BOSS_COUNT; i++) {
      const segStart = rangeStart + i * rangeStep;
      const offset = segStart + Math.random() * rangeStep;
      const x = PLAYER_START_X + offset;
      const bossType = this._pickRandomBoss();
      const subAtkPower = Math.max(1, Math.floor(bossType.attackPower * SUB_BOSS_STAT_MUL * totalMul * Phaser.Math.FloatBetween(0.9, 1.1)));
      const subBoss = new Enemy(this.scene, x, 431, {
        maxHp: Math.floor(bossType.baseHp * SUB_BOSS_STAT_MUL * totalMul),
        attackPower: subAtkPower,
        attackRange: bossType.attackRange,
        attackSpeed: Math.floor(bossType.attackSpeed * 1.1),
        expReward: 80,
        goldReward: Math.floor(60 * stageMul),
        size: 90,
        color: bossType.color,
        dodgeChance: bossType.dodgeChance * 0.6,
        textureKey: bossType.spriteKey,
        type: 'subboss',
      });
      subBoss.bossName = `${bossType.name} (서브)`;
      subBoss.id = bossType.id;
      subBoss.debuff = this._currentStageDebuff();
      this._applyBossSizeDebuff(subBoss);
      this.enemies.push(subBoss);
      this.subBosses.push(subBoss);
    }
  }

  // [Phase P-54] 정예 보스 — 서브와 메인 사이 (~75% 지점). 메인의 70% 스탯.
  _spawnEliteBoss() {
    const stageMul = 1 + (this.currentStage - 1) * 0.2;
    const lateBoost = this.currentStage >= 3 ? 1 + (this.currentStage - 2) * 0.05 : 1;
    const totalMul = stageMul * getDifficultyMultiplier() * lateBoost;
    const bossType = this._pickRandomBoss();
    const eliteAtkPower = Math.max(1, Math.floor(bossType.attackPower * ELITE_BOSS_STAT_MUL * totalMul * Phaser.Math.FloatBetween(0.9, 1.1)));
    const x = PLAYER_START_X + ELITE_BOSS_OFFSET;
    const elite = new Enemy(this.scene, x, 428, {
      maxHp: Math.floor(bossType.baseHp * ELITE_BOSS_STAT_MUL * totalMul),
      attackPower: eliteAtkPower,
      attackRange: bossType.attackRange,
      attackSpeed: Math.floor(bossType.attackSpeed * 1.05),
      expReward: 110,
      goldReward: Math.floor(100 * stageMul),
      size: Math.floor((bossType.size || 110) * 0.85),
      color: bossType.color,
      dodgeChance: bossType.dodgeChance * 0.8,
      textureKey: bossType.spriteKey,
      type: 'elite',
    });
    elite.bossName = `${bossType.name} (정예)`;
    elite.id = bossType.id;
    elite.debuff = this._currentStageDebuff();
    this._applyBossSizeDebuff(elite);
    this.enemies.push(elite);
    this.eliteBoss = elite;
  }

  _spawnMainBoss() {
    const stageMul = 1 + (this.currentStage - 1) * 0.2;
    const lateBoost = this.currentStage >= 3 ? 1 + (this.currentStage - 2) * 0.05 : 1;
    const totalMul = stageMul * getDifficultyMultiplier() * lateBoost;
    const bossType = this._pickRandomBoss();
    const bossAtkPower = Math.max(1, Math.floor(bossType.attackPower * totalMul * Phaser.Math.FloatBetween(0.9, 1.1)));
    const x = PLAYER_START_X + MAIN_BOSS_OFFSET;
    const boss = new Enemy(this.scene, x, 424, {
      maxHp: Math.floor(bossType.baseHp * totalMul),
      attackPower: bossAtkPower,
      attackRange: bossType.attackRange,
      attackSpeed: bossType.attackSpeed,
      expReward: bossType.expReward ?? 150,
      goldReward: Math.floor((bossType.goldReward ?? 180) * stageMul),
      size: bossType.size,
      color: bossType.color,
      dodgeChance: bossType.dodgeChance,
      textureKey: bossType.spriteKey,
      type: 'boss',
    });
    boss.bossName = bossType.name;
    boss.id = bossType.id;
    boss.debuff = this._currentStageDebuff();
    // [무한 맵] sprite size 디버프 (gigantic) 만 spawn 직후 적용 — 시각 변형 회피.
    this._applyBossSizeDebuff(boss);

    // 폭발의 부적 — 보스 HP 즉시 차감
    if (this.player.nextBossHpReduce && this.player.nextBossHpReduce > 0) {
      const reduce = Math.floor(boss.maxHp * this.player.nextBossHpReduce);
      boss.hp = Math.max(1, boss.hp - reduce);
      boss.updateHpDisplay();
      this.player.nextBossHpReduce = 0;
    }
    if (this.player.nextBossFreezeMs && this.player.nextBossFreezeMs > 0) {
      const now = (this.scene.time && this.scene.time.now) || 0;
      boss.frozenUntil = now + this.player.nextBossFreezeMs;
      this.player.nextBossFreezeMs = 0;
    }

    this.enemies.push(boss);
    this.mainBoss = boss;
  }

  // [무한 맵] 보스 spawn 직후 sprite size 디버프만 적용 (시각 갑작 변형 회피).
  //   배너 / 다크 오버레이 / 스탯 오버라이드 등 나머지는 플레이어 근접 시 _checkBossActivation 에서.
  _applyBossSizeDebuff(boss) {
    if (!boss || !boss.debuff || !boss.debuff.effect) return;
    const e = boss.debuff.effect;
    if (e.spriteScale && boss.sprite) {
      boss._originalSize = boss.size;
      boss.size = boss.size * e.spriteScale;
      if (boss.sprite.setDisplaySize) {
        boss.sprite.setDisplaySize(boss.size, boss.size);
      }
      // BossDebuffSystem 의 _applyEffect 에서 중복 적용 방지 — 미리 적용 표시.
      boss._sizeDebuffApplied = true;
    }
  }

  // === BossDebuffSystem 호환 — 보스 근처 도달 시 onBossSpawn 호출 ===
  // 옛에서는 spawn 시점에 호출. 새 시스템에선 적 미리 배치 → 플레이어 사거리 진입 시 호출.

  _checkBossActivation() {
    if (!this.player || !this.player.sprite) return;
    const px = this.player.sprite.x;
    // [Phase P-54] 서브 + 정예 + 메인 중 가까운 + 미발동 디버프 찾기
    const all = [
      ...this.subBosses,
      ...(this.eliteBoss ? [this.eliteBoss] : []),
      ...(this.mainBoss ? [this.mainBoss] : []),
    ];
    for (const boss of all) {
      if (!boss || !boss.isActive() || !boss.sprite) continue;
      if (boss._debuffActivated) continue;
      const dx = Math.abs(boss.sprite.x - px);
      if (dx < 400) {
        boss._debuffActivated = true;
        this.currentBoss = boss;
        const isSubBoss = boss.type === 'subboss';
        const isElite   = boss.type === 'elite';
        this.scene.events.emit('boss-spawned', {
          name: boss.bossName, desc: '',
          isSubBoss, isElite, textureKey: null,
        });
        if (this.scene.bossDebuffSystem) {
          this.scene.bossDebuffSystem.onBossSpawn(boss);
        }
      }
    }
  }

  // === 스테이지 클리어 체크 ===

  _checkStageCleared() {
    if (this._stageCleared) return;
    if (!this.mainBoss) return;
    if (this.mainBoss.isActive()) return;
    // [BUGFIX] 메인보스 사망 후에도 분열 자식 / 추가 적 살아있으면 아직 클리어 X.
    //   모든 적 (분열 슬라임 / 쥐떼 소환 등 spawnExtra 포함) 처치 확인.
    const aliveAll = this.combatSystem.getAliveEnemies();
    if (aliveAll.length > 0) return;
    this._stageCleared = true;
    console.log('[stage] cleared! stage=', this.currentStage);
    // [Phase P-54 BUGFIX] 보스 처치 즉시 진행도 저장 — 클리어 모달에서 '메뉴로' 눌러도 unlock 보존.
    //   옛 로직: proceedToNextStage 안에서만 mark → 메뉴 복귀 시 진행도 손실.
    this._markStageCleared(this.currentStage);
    this.scene.events.emit('stage-cleared', this.currentStage);
  }

  // === 다음 스테이지 진행 ===
  // 클리어 모달 [▶ 다음 스테이지] 클릭 시 호출.
  proceedToNextStage() {
    // [Phase P-54] _markStageCleared 는 _checkStageCleared 에서 이미 호출 — 여기선 안 함.
    this.currentStage += 1;
    this._stageUsedBossIds.clear();

    if (this.currentStage > 10) {
      // 챕터 클리어 — [P-61] 다이아 보상 제거. 누적 카운트만 유지 (장비 잠금 해제용).
      let prevClears = 0;
      try { prevClears = parseInt(localStorage.getItem(CHAPTER_CLEAR_COUNT_KEY) || '0', 10); } catch {}
      try { localStorage.setItem(CHAPTER_CLEAR_COUNT_KEY, String(prevClears + 1)); } catch {}
      clearSave();
      const unlocked = unlockNextDifficulty();
      this.scene.events.emit('game-clear', unlocked);
      return;
    }

    // 새 스테이지 — Player 리셋 + 다이아 / 장비 재적용
    if (this.player.resetForNewStage) this.player.resetForNewStage();
    if (this.scene && this.scene._applyDiamondUpgrades) this.scene._applyDiamondUpgrades();
    if (this.scene && this.scene._applyLoadout) this.scene._applyLoadout();
    saveGame(this.buildSaveState());
    this.scene.events.emit('stage-advanced', this.currentStage);
  }

  _markStageCleared(stage) {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      const data = raw ? JSON.parse(raw) : { normal: {}, hard: {}, veryHard: {} };
      const diff = (gameSettings && gameSettings.difficulty) || 'normal';
      if (!data[diff]) data[diff] = {};
      data[diff][stage] = true;
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
      console.log('[progress] markStageCleared:', diff, stage);
    } catch (e) { console.warn('[progress] save failed:', e); }
  }

  // === 보스 디버프 — 추가 적 spawn 인터페이스 (분열 / 쥐떼 소환 등에서 호출) ===
  spawnExtra(enemyId, count, options = {}) {
    const baseType = getEnemyById(enemyId);
    if (!baseType) {
      console.warn('[spawnExtra] unknown enemy:', enemyId);
      return [];
    }
    const stageMul = 1 + (this.currentStage - 1) * 0.2;
    const totalMul = stageMul * getDifficultyMultiplier();
    const sizeMul = options.sizeMul || 1;
    const hpMul = options.hpMul || 1;
    const attackMul = options.attackMul || 1;
    const baseX = options.x || (this.player.x + 200);
    const baseY = options.y || 446;

    const created = [];
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * 40;
      const enemy = new Enemy(this.scene, baseX + offset, baseY, {
        id: enemyId,
        maxHp: Math.max(1, Math.floor(baseType.baseHp * totalMul * hpMul)),
        attackPower: Math.max(1, Math.floor(baseType.attackPower * totalMul * attackMul)),
        attackRange: baseType.attackRange,
        attackSpeed: Math.floor(baseType.attackSpeed * Phaser.Math.FloatBetween(0.9, 1.1)),
        dodgeChance: baseType.dodgeChance,
        size: 48 * sizeMul,
        expReward: baseType.expReward,
        goldReward: Math.floor(baseType.goldReward * stageMul),
        textureKey: baseType.spriteKey,
        color: 0x800080,
      });
      this.enemies.push(enemy);
      created.push(enemy);
    }
    if (this.combatSystem && this.combatSystem.setEnemies) {
      this.combatSystem.setEnemies(this.enemies);
    }
    return created;
  }

  // === 세이브 ===
  buildSaveState() {
    const bagIds = (this.player.bag || []).map(c => c.id);
    const statSources = {};
    if (this.player._statSources) {
      for (const k of Object.keys(this.player._statSources)) {
        statSources[k] = { ...this.player._statSources[k] };
      }
    }
    return {
      stats: { ...this.player.stats },
      statSources,
      skills: { ...this.player.skills },
      pendingLevelUps: this.player.pendingLevelUps,
      pickedCards: [...(this.player.pickedCards || [])],
      // 잠금 상태에서도 옛 세이브의 equipment 보존 (_savedEquipmentRaw) — 다음 잠금 해제 시 복원 가능.
      equipment: Object.keys(this.player.equipment || {}).length > 0
        ? { ...this.player.equipment }
        : { ...(this.player._savedEquipmentRaw || {}) },
      bag: bagIds,
      goldMultWaves: this.player.goldMultWaves || 0,
      nextCardChoices: this.player.nextCardChoices || 3,
      nextBossHpReduce: this.player.nextBossHpReduce || 0,
      nextBossFreezeMs: this.player.nextBossFreezeMs || 0,
      nextKillsExpMul:    this.player._nextKillsExpMul || 1,
      nextKillsExpRemain: this.player._nextKillsExpRemain || 0,
      nextCardPickRarityBoost: this.player.nextCardPickRarityBoost || 0,
      stageShopRerollsUsed: this.player._stageShopRerollsUsed || 0,
      stageCardRerollsUsed: this.player._stageCardRerollsUsed || 0,
      queuedBuffs: { ...(this.player.queuedBuffs || {}) },
      runStats: { ...(this.player.runStats || {}) },
      sinCounts: { ...(this.player.sinCounts || {}) },
      pickedCardOrder: [...(this.player.pickedCardOrder || [])],
      activeSin: this.player.activeSin || null,
      secondarySin: this.player.secondarySin || null,
      synergyTier: this.player.synergyTier || 0,
      dualActive: !!this.player.dualActive,
      dualSinKey: this.player.dualSinKey || null,
      appliedSynergyEffects: this.player._appliedSynergyEffects.map(e => ({
        effectId: e.effectId,
        payload: { ...(e.payload || {}) },
      })),
      stage: this.currentStage,
      difficulty: gameSettings.difficulty,
      chapterDebuffs: serializeChapterDebuffs(this._chapterDebuffs),
    };
  }

  // === 매 프레임 업데이트 ===
  update() {
    if (!this.waveActive) return;
    if (this._stageCleared) return;

    // 매점 NPC 근접 체크
    if (this._shopNpcEntities) {
      this._shopNpcEntities.forEach((npc, i) => {
        if (npc && npc.update) {
          const wasVisited = npc.visited;
          npc.update(this.player);
          if (!wasVisited && npc.visited && this.shopNpcs[i]) {
            this.shopNpcs[i].visited = true;
          }
        }
      });
    }

    // [Phase P-54] 이벤트 노드 (보물상자/신의시험) 근접 체크
    if (this._eventNodes) {
      this._eventNodes.forEach((node) => {
        if (node && node.update) node.update(this.player);
      });
    }

    // 보스 활성화 체크 (플레이어 근접 시 디버프 발동)
    this._checkBossActivation();

    // 스테이지 클리어 체크 (메인보스 사망)
    this._checkStageCleared();
  }

  // === 정보 (TopBar 용) ===
  getStageInfo() {
    const aliveEnemies = this.combatSystem.getAliveEnemies().length;
    return {
      stage: this.currentStage,
      wave: 1,                      // 호환
      totalWaves: 1,                // 호환
      isBossWave: !!(this.currentBoss && this.currentBoss.type === 'boss' && this.currentBoss.isActive()),
      isEliteBossWave: !!(this.currentBoss && this.currentBoss.type === 'elite' && this.currentBoss.isActive()),
      isSubBossWave: !!(this.currentBoss && this.currentBoss.type === 'subboss' && this.currentBoss.isActive()),
      bossName: this.currentBoss && this.currentBoss.isActive() ? this.currentBoss.bossName : null,
      aliveEnemies,
      // 무한 맵 진행도 — 진행 바 UI 용
      playerX: (this.player && this.player.sprite ? this.player.sprite.x : PLAYER_START_X),
      mapStartX: PLAYER_START_X,
      mapEndX: PLAYER_START_X + MAP_LENGTH,
      subBosses: this.subBosses.map(b => ({
        x: b.sprite ? b.sprite.x : 0,
        alive: !!(b.isActive && b.isActive()),
      })),
      // [Phase P-54] 정예 보스 — 서브와 메인 사이
      eliteBoss: this.eliteBoss ? {
        x: this.eliteBoss.sprite ? this.eliteBoss.sprite.x : 0,
        alive: !!(this.eliteBoss.isActive && this.eliteBoss.isActive()),
      } : null,
      mainBoss: this.mainBoss ? {
        x: this.mainBoss.sprite ? this.mainBoss.sprite.x : 0,
        alive: !!(this.mainBoss.isActive && this.mainBoss.isActive()),
      } : null,
      shopNpcs: this.shopNpcs.map(npc => ({ x: npc.x, visited: !!npc.visited })),
    };
  }
}
