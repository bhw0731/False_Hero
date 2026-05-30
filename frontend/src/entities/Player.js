// 플레이어 클래스
// 캐릭터의 생김새, 능력치, 공격, 레벨업, 직업(클래스)을 관리합니다

import { sound } from '../systems/SoundManager.js';
import { SINS, SIN_LIST, SIN_NAMES, SIN_KEY, getSynergyTier, isDualActive, getDualSinPair } from '../data/sins.js';
import { synergyEffects, getSynergyEffect } from '../data/synergyEffects.js';
import { commonCards } from '../data/cards.js';

// [Phase M2] 탐욕 L4 — 골드 100당 +5% 보너스를 받는 % stat 집합.
const PERCENT_STATS = new Set([
  'critChance', 'critDamage', 'dodge', 'lifesteal', 'damageReduction', 'accuracy', 'goldGainMul',
]);

// [Phase P-54] 기본 물약 — 회복량 / 쿨다운.
const POTION_HEAL_PCT = 0.20;
const POTION_CD_MS    = 30000;

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;

    // 생김새 — 'player' 텍스처가 있으면 스프라이트, 없으면 빨간 네모
    if (scene.textures.exists('player')) {
      this.sprite = scene.physics.add.sprite(x, y, 'player');
      this.sprite.setDisplaySize(60, 60);
      this._isSpriteImage = true;
    } else {
      this.sprite = scene.add.rectangle(x, y, 60, 60, 0xff0000);
      scene.physics.add.existing(this.sprite);
      this._isSpriteImage = false;
    }

    // HP 바 (플레이어 머리 위) — 적과 동일한 형태
    // HP 바 — 상단 HUD 와 통일된 픽셀 베벨 스타일
    const barW = 60;
    const barH = 6;
    const barY = y - 30 - 8;
    // 그림자 (1px 우-아래)
    this.hpBarShadow = scene.add.rectangle(x - barW / 2 + 1, barY + 1, barW, barH, 0x000000, 0.55);
    this.hpBarShadow.setOrigin(0, 0.5);
    // 어두운 인셋 배경 — redDark
    this.hpBarBg = scene.add.rectangle(x - barW / 2, barY, barW, barH, 0x6A2025, 0.92);
    this.hpBarBg.setOrigin(0, 0.5);
    this.hpBarBg.setStrokeStyle(1, 0x4A4A50, 0.5);
    // 채움 — red 단일색
    this.hpBar = scene.add.rectangle(x - barW / 2 + 1, barY, barW - 2, barH - 2, 0xC5404A);
    this.hpBar.setOrigin(0, 0.5);
    // 위쪽 1px 하이라이트 (픽셀 질감)
    this.hpBarHL = scene.add.rectangle(x - barW / 2 + 1, barY - 1, barW - 2, 1, 0xFFFFFF, 0.35);
    this.hpBarHL.setOrigin(0, 0.5);
    this.hpBarMaxWidth = barW - 2;
    this.hpText = scene.add.text(x, barY - 11, '100/100', {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hpText.setShadow(1, 1, '#000000', 2, false, true);

    // 기본 능력치
    // ⚠ Phase E1: this.stats 는 호환을 위해 flat number 유지 (외부 ~1000 참조).
    //              source-tagged 분리는 this._statSources 에 병행 저장.
    //              modStat() 가 양쪽 동기화 — 새 코드는 modStat / getStat / getStatBreakdown 사용.
    // ⚠ Phase K: defense / moveSpeed / attackRange 폐기.
    //              defense=0 고정 (방어 공식 폐기, 데미지 100%), moveSpeed=100 / attackRange=90 모든 엔티티 동일.
    //              getStat 호출 호환 위해 stats 에 남기되 _statSources 에선 제외 → modStat no-op.
    this.stats = {
      // 핵심 능력치
      attackPower: 16,      // [Phase Fix-2] 13 → 16 (1스 1웨 사망률 하향)
      attackSpeed: 900,     // 1000 → 900 (10% 빠름)
      attackRange: 100,     // [Phase K + P-44d] 고정값 — Phase P-44d 에서 90 → 100 (사거리 시스템 재설계)
      moveSpeed: 100,       // [Phase K] 고정값 — 모든 변경 시도 무시
      defense: 0,           // [Phase K] 폐기 — 데미지 감산 공식 자체 제거
      hp: 150,              // [Phase Fix-2] 125 → 150
      maxHp: 150,           // [Phase Fix-2] 125 → 150

      // 추가 능력치 (카드로 얻음)
      critChance: 0.05,     // 치명타 확률 (기본 5%)
      critDamage: 1.5,      // 치명타 피해 배율
      dodge: 0,             // 회피율 (0~1)
      accuracy: 0.80,       // 명중률 (0~1) — 베이스 80%, 질투 명중 카드로 향상 가능
      lifesteal: 0,         // 흡혈량 — 처치 시 회복 + 콤보 버프 트리거
      damageReduction: 0,   // 피해 감소 / 치명 내성 (0~0.5) — 방어 공식 후 추가 % 감산
      goldGainMul: 1.0,     // 골드 획득 배수 (1.0 = 100%, 탐욕 카드용)

      // 성장 정보
      level: 1,
      exp: 0,
      expToNext: 50,

      // 화폐
      gold: 0,
    };

    // === Phase E1: 다중 source stat 추적 ===
    // 각 stat 의 4 source: base (시작값/다이아 영구) / equipment (장비) / cards (카드) / synergy (시너지).
    // hp / gold / level / exp / expToNext 는 multi-source 대상 X (실시간 / 화폐 / 진행도) — stats 에만.
    // 기존 stats 의 시작값을 base 로 복사. 이후 modStat 호출이 source 별 누적.
    // Phase K — 10 stat. defense/moveSpeed/attackRange 제외 (해당 stat 변경 시도는 modStat no-op).
    this._statSources = {
      attackPower:     { base: this.stats.attackPower,     equipment: 0, cards: 0, synergy: 0 },
      attackSpeed:     { base: this.stats.attackSpeed,     equipment: 0, cards: 0, synergy: 0 },
      maxHp:           { base: this.stats.maxHp,           equipment: 0, cards: 0, synergy: 0 },
      critChance:      { base: this.stats.critChance,      equipment: 0, cards: 0, synergy: 0 },
      critDamage:      { base: this.stats.critDamage,      equipment: 0, cards: 0, synergy: 0 },
      dodge:           { base: this.stats.dodge,           equipment: 0, cards: 0, synergy: 0 },
      accuracy:        { base: this.stats.accuracy,        equipment: 0, cards: 0, synergy: 0 },
      lifesteal:       { base: this.stats.lifesteal,       equipment: 0, cards: 0, synergy: 0 },
      damageReduction: { base: this.stats.damageReduction, equipment: 0, cards: 0, synergy: 0 },
      goldGainMul:     { base: this.stats.goldGainMul,     equipment: 0, cards: 0, synergy: 0 },
    };

    // 시너지 / 빌드 카드 플래그
    this.skills = {
      lifestealDouble: false,   // 연쇄의 검 — 흡혈 회복/콤보 ×2
      lifestealCritDrain: false, // 흡혈 의식 — 치명타 시 흡혈 절반만큼 추가 회복
      dodgeHunter: false,       // 회피 30%+ 일 때 회피 후 다음 공격 ×2
      desperateRage: false,     // HP 30% 이하일 때 데미지 ×1.8
    };

    // 흡혈 콤보 — 5초 내 연속 처치 시 스택 누적 (최대 5)
    this.killStreakCount = 0;
    this.killStreakEndTime = 0;

    // 런 통계 — 게임 클리어 시 결과 화면에서 표시
    this.runStats = {
      startTime: Date.now(),
      enemiesKilled: 0,
      bossesKilled: 0,
      damageDealt: 0,
      damageTaken: 0,
      goldEarned: 0,
      goldSpent: 0,
      cardsPicked: 0,
      itemsBought: 0,
      specialCardsBought: 0,
      maxKillStreak: 0,
    };

    // 회피 직후 강화 상태 (회피 사냥꾼 시너지)
    this.dodgeBuffActive = false;

    // 처치 폭발 버프 (흡혈 시 활성) — 처치 시 HP 회복 + 5초간 공격력 ↑
    this.killBuffMult = 1;        // 1 = 비활성, >1 = 버프 활성 배수
    this.killBuffEndTime = 0;     // 버프 종료 시각 (ms)

    // 내부 상태
    this.lastAttackTime = 0;
    this.engagedAt = null;        // 사거리 안에 들어온 시각 (전투 진입 딜레이용)
    this.pendingLevelUps = 0;
    // [무한 맵] 부적 — 다음 N마리 처치 EXP ×M (P-50c 신규, P-54 폐기 후 dead).
    this._nextKillsExpMul = 1;
    this._nextKillsExpRemain = 0;
    // [Phase P-54] 부적 영약화 — 이번 스테이지 EXP 배수 (스테이지 진입 시 1.0 리셋).
    this._stageExpMul = 1;
    // [Phase P-54] 시간 제한 버프 (영약 30초 등) — { stat, delta, expireAt }
    this._timedBuffs = [];
    if (scene && scene.events) {
      scene.events.on('update', this._tickTimedBuffs, this);
    }

    // 뽑은 카드들 — 이름/설명/타입을 시간 순서로 기록 (UI에서 조회)
    this.pickedCards = [];
    // 픽 순서 — 동률 처리 (마지막 픽 우선) 용. 카드 sin 만 시간 순서로 기록.
    this.pickedCardOrder = [];
    // 한 스테이지 안에서 픽된 카드 name 집합 (중복 픽 방지) — 스테이지 시작 시 초기화
    this._pickedCardIdsThisStage = [];
    // 7대죄 시너지 — 보유 카드 sin 카운트.
    // synergyTier: 0 / 3 (3단계) / 6 (6단계) / 9 (거짓된 계약).
    // activeSin: 카운트 1순위 (동률 시 마지막 픽). secondarySin: 2순위 (동률 시 마지막 픽).
    // dualActive: activeSin + secondarySin 둘 다 ≥3장. dualSinKey: 식별 키 ('wrath_envy' 등).
    this.sinCounts = {
      [SINS.WRATH]:    0,
      [SINS.GREED]:    0,
      [SINS.SLOTH]:    0,
      [SINS.PRIDE]:    0,
      [SINS.LUST]:     0,
      [SINS.ENVY]:     0,
      [SINS.GLUTTONY]: 0,
    };
    this.activeSin = null;
    this.secondarySin = null;
    this.synergyTier = 0;
    this.dualActive = false;
    this.dualSinKey = null;
    // 시너지 적용 효과 추적 (revert 정확도 보장 — apply 시 payload 저장, revert 시 사용)
    // 항목: { effectId: 'wrath_3' | '분노_탐욕', payload: { ...delta } }
    this._appliedSynergyEffects = [];
    // === Phase 3 트리거 / 카운터 / 임시 버프 ===
    this._synergyKillCount = 0;                // 폭식 처치 카운터
    this._synergyTempBuffs = [];               // [{ effectId, type: 'atkMul', value, expireAt }]
    this._synergyDodgeInvulnUntil = 0;         // 오만_색욕 회피 무적 종료 시각
    this._synergyDodgeInvulnCooldown = 0;      // 오만_색욕 회피 무적 쿨타임 종료 시각
    this._synergyOmanGuardCount = 0;           // 나태_오만 누적 방어 (max 10)
    this._synergyOmanLastTickTime = 0;         // 나태_오만 매초 틱 시각
    this._synergyDamageReceivedLifesteal = 0;  // 분노_색욕 받은 피해 누적 흡혈 (max 0.10, 5초 후 리셋)
    this._synergyDamageReceivedExpireAt = 0;
    this._lastDamageTime = 0;                  // 오만 무피격 카운트다운용
    // 듀얼 영구 누적 추적 (revert 정확용)
    this._naPok_maxHpAdded = 0;                // 나태_폭식 처치 시 maxHp +1 누적 (max 50)
    this._sePok_dodgeAdded = 0;                // 색욕_폭식 처치 시 회피 +0.005 누적 (max 0.25)
    this._tamSe_dodgeAdded = 0;                // 탐욕_색욕 골드 획득 시 회피 +0.001 (max 0.20)
    this._naSe_lifestealAdded = 0;             // 나태_색욕 회피 시 흡혈 +0.005 (max 0.10)
    this._omanPok_atkAdded = 0;                // 오만_폭식 HP 100% 처치 시 영구 atk +0.5, 피격 시 0 리셋
    this._tamPok_goldGainMulAdded = 0;         // 탐욕_폭식 처치 누적 골드 획득량 (max 0.30)
    this._greed9PercentBonus = 0;              // 탐욕 9 누적 % 보너스 (보유 골드 200당 +0.05, 단위 0.05)
    this._greedPride_critDamageBonus = 0;      // 탐욕_오만 누적 치명 피해 (보유 골드 200당 +0.20)
    // [Phase P-54] 분노 레전드 게임체인저 플래그 (L5 폭격 제거)
    // 옛 코드에서 L1 들은 _resetForNewStage 에서만 init 되어 첫 스테이지 진입 전 undefined 위험 — 명시 init.
    this._greedL1Active = false;
    this._prideL1Active = false;
    this._envyL1Active = false;
    this._lustL1Active = false;
    this._gluttonyL1Active = false;
    this._wrathHpBuffNActive = false;
    // 폭식 흡혈 누적기 — 재시작 시 undefined 였던 거 0 으로.
    this._gluttonyLifestealAdded = 0;
    this._gluttonyL1LifestealAdded = 0;
    // 신규 stat 누수 카운터.
    this._slothL3MaxHpAdded = 0;
    this._envyL3AtkAdded = 0;
    this._wrathL1Active = false;               // 빈사의 광기 — HP 낮을수록 atk (HP 1% 시 ×1.5)
    this._wrathL3Active = false;               // 영겁의 분노 — 처치 시 atk +0.5 영구 (max +30)
    this._wrathL4Active = false;               // 폭주 콤보 — 콤보 5+ 시 atk ×1.30
    // [Phase M2] 탐욕 레전드 게임체인저 플래그 (L1 은 옛 변수 재사용)
    this._greedL3Active = false;               // L3 — 처치 시 골드 +5
    this._greedL4Active = false;               // L4 — 보유 골드 100당 % stat +5%
    this._greedL5Active = false;               // L5 — 골드 차감 시 atk 누적 (1G당 +0.01)
    this._greedL5AtkBonus = 0;                 // L5 누적 atk (revert 정확용)
    // [Phase M3] 나태 레전드 게임체인저 플래그
    this._slothL1Active = false;               // L1 — maxHp 100당 atk +1
    this._slothL3Active = false;               // L3 — 받피 시 maxHp +5 영구
    this._slothL4Active = false;               // L4 — HP 100% 시 받피 ×0.5
    this._slothL5Active = false;               // L5 — HP 50%↓ 시 매초 maxHp×5% 회복
    this._slothL5LastTickTime = 0;
    // [Phase M4] 오만 레전드 게임체인저 플래그 (L1 은 옛 변수 _prideL1Active 재사용)
    this._prideL3Active = false;               // L3 — 치명타 적중 시 1초 무적
    this._prideL4Active = false;               // L4 — HP 100% 매초 atk +0.5 (max +25), 피격 시 revert
    this._prideL4AtkAdded = 0;                 // L4 누적 atk (revert 정확용)
    this._prideL4LastTickTime = 0;
    this._prideL5Active = false;               // L5 — 웨이브 첫 공격 강제 치명
    this._prideL5UsedThisWave = false;
    // [Phase M5] 색욕 레전드 게임체인저 플래그 (L1 은 옛 _lustL1Active 재사용 — 의미는 신규 메카닉)
    this._lustL3Active = false;                // L3 — 회피 시 5초 atk +20%
    this._lustL4Active = false;                // L4 — 회피 시 흡혈 +1% 영구 (max +20%)
    this._lustL4LifestealAdded = 0;            // L4 누적 흡혈 (revert 정확용)
    this._lustL5Active = false;                // L5 — 회피 후 다음 공격 강제 치명
    this._lustL5NextCrit = false;
    // [Phase M6] 질투 레전드 게임체인저 플래그 (L1 은 옛 _envyL1Active 재사용)
    this._envyL3Active = false;                // L3 — 강자 처치 시 atk +1 영구
    this._envyL4Active = false;                // L4 — 적 HP 비율 비례 데미지 (적 100% 시 +50%)
    this._envyL5Active = false;                // L5 — 처치 시 accuracy +1% (max +30%)
    this._envyL5AccuracyAdded = 0;             // L5 누적 accuracy (revert 정확용)
    // [Phase N2] 듀얼 시너지 21쌍 활성 플래그 (활성+2번째 죄 둘 다 ≥3 시 true)
    this._wrathGreedActive    = false;   // 처치 +3G + 5초 atk +10%
    this._wrathSlothActive    = false;   // HP50%↓ atk+20% + 피감+10%
    this._wrathPrideActive    = false;   // HP100%/50%↓ atk+30%
    this._wrathLustActive     = false;   // 받피 흡혈누적 + 회피 5초 atk+10%
    this._wrathEnvyActive     = false;   // 적HP> atk+30% + 처치 1초 atk+50%
    this._wrathGluttonyActive = false;   // 처치 시 atk +0.2 영구
    this._wrathGluttony_atkAdded = 0;
    this._greedSlothActive    = false;   // 골드 100당 maxHp +5
    this._greedPrideActive    = false;   // HP100% goldGainMul+50% + 골드 200당 critDamage+20%
    this._greedLustActive     = false;   // 골드 획득 시 dodge +0.1% (max +20%)
    this._greedEnvyActive     = false;   // 처치 시 적 골드 50% 추가 + 강자 +10G
    this._greedGluttonyActive = false;   // 처치 시 +5G + 처치 누적 goldGainMul+0.5% (max +30%)
    this._slothPrideActive    = false;   // HP100% 매초 피감+1% (max +10%) + HP100% 시 피감+20%
    this._slothLustActive     = false;   // 회피 시 흡혈 +0.5% (max +10%) + dodge+10%
    this._slothEnvyActive     = false;   // 적HP> 피감+15%
    this._slothGluttonyActive = false;   // 처치 시 maxHp +1 (max +50) + 흡혈+5% (apply 시)
    this._prideLustActive     = false;   // HP100% dodge+30% + 회피 1초 무적 (5초 쿨)
    this._prideEnvyActive     = false;   // 조건+적HP> atk×1.50
    this._prideGluttonyActive = false;   // HP100% 처치 atk+0.5 + 피격 시 0 리셋
    this._lustEnvyActive      = false;   // 적HP> dodge+20% + 흡혈+10%
    this._lustGluttonyActive  = false;   // 처치 dodge +0.5% (max +25%) + 흡혈+10% (apply)
    this._envyGluttonyActive  = false;   // 강자 처치 시 atk+1 영구
    this._envyGluttony_atkAdded = 0;
    // [Phase N1] 단일 시너지 21개 활성 플래그 (한 죄당 한 단계만 true)
    this._wrath9Active   = false;   // 분노 9 — HP 비율 반비례 atk +20% max
    this._greed6Active   = false;   // 탐욕 6 — 보유 골드 100당 atk +1
    this._greed9Active   = false;   // 탐욕 9 — 보유 골드 50당 atk +1 + 200당 % stat +5%
    this._pride3Active   = false;   // 오만 3 — HP100% + 5초 무피격 시 atk +15%
    this._pride6Active   = false;   // 오만 6 — atk +30% + 치명 +10%
    this._pride9Active   = false;   // 오만 9 — atk +50% + 치명 +20% + 치명 피해 +50%
    this._envy3Active    = false;   // 질투 3 — 적 HP > 내 HP 시 atk +15%
    this._envy6Active    = false;   // 질투 6 — atk +25% + 강자 흡혈 +5%
    this._envy9Active    = false;   // 질투 9 — atk +40% + 강자 흡혈 +10% + 강자 처치 atk +1
    this._gluttony3Active = false;  // 폭식 3 — 처치 10마리당 atk +1
    this._gluttony6Active = false;  // 폭식 6 — 처치 5마리당 atk +1 + 처치 흡혈 누적 max 20%
    this._gluttony9Active = false;  // 폭식 9 — + 처치 흡혈 누적 max 30% + 처치 50 도달 시 공속 -100ms
    this._gluttony9Speed50Used = false;   // 폭식 9 — 50 도달 1회성 플래그
    // [Phase P-54] 폭식 트리거 트래커 (3등급) — epic 폐기
    this._gluttonyNormalKillStackActive = false; this._gluttonyNormalKillStackAdded = 0;
    this._gluttonyRareKillStackActive   = false; this._gluttonyRareKillStackAdded   = 0;
    this._gluttonyNormalLifestealAtkBuffActive = false;
    this._gluttonyRareLifestealAtkBuffActive   = false;
    this._gluttonyNormalHealMaxHpActive  = false;
    this._gluttonyNormalHealMaxHpApplied = false;
    this._gluttonyNormalHealMaxHpExpireAt = 0;
    this._gluttonyRareHealMaxHpActive    = false;
    this._gluttonyRareHealMaxHpApplied   = false;
    this._gluttonyRareHealMaxHpExpireAt  = 0;
    this._gluttonyNormalAtkAbsorbedActive = false; this._gluttonyNormalAtkAbsorbed = 0;
    this._gluttonyRareAtkAbsorbedActive   = false; this._gluttonyRareAtkAbsorbed   = 0;
    this._gluttonyRareLifestealHealActive = false;
    this._gluttonyRareKillMaxHpActive = false; this._gluttonyRareKillMaxHpAdded = 0;
    // [Phase P-54] 질투 트리거 트래커 (3등급) — epic 폐기 (단 envy_legend_7 가 EpicStrongerCrit 재활용)
    this._envyNormalStrongerActive = false;
    this._envyRareStrongerActive   = false;
    this._envyNormalEnemyFullHpActive = false;
    this._envyRareEnemyFullHpActive   = false;
    this._envyNormalStrongerKillStackActive = false; this._envyNormalStrongerKillStackAdded = 0;
    this._envyRareStrongerKillStackActive   = false; this._envyRareStrongerKillStackAdded   = 0;
    this._envyNormalKillAccStackActive = false; this._envyNormalKillAccStackAdded = 0;
    this._envyRareKillAccStackActive   = false; this._envyRareKillAccStackAdded   = 0;
    this._envyRareStrongerAccBuffActive = false;
    this._envyRareStrongerLifestealActive = false;
    // 강자 강제 치명 (envy_legend_7 — 옛 epic 플래그 재활용)
    this._envyEpicStrongerCritActive = false;
    // [Phase P-54] 색욕 트리거 트래커 (3등급) — epic 폐기
    this._lustNormalAtkBuffActive = false;
    this._lustRareAtkBuffActive   = false;
    this._lustNormalLifestealStackActive = false; this._lustNormalLifestealStackAdded = 0;
    this._lustRareLifestealStackActive   = false; this._lustRareLifestealStackAdded   = 0;
    this._lustNormalShortStunActive = false;
    this._lustRareLongStunActive    = false;
    this._lustNormalNextAtkBuffActive  = false;
    this._lustNormalNextAtkPending     = false;
    this._lustRareForcedCritActive  = false;
    this._lustRareForcedCritPending = false;
    this._lustRareDodgeBuffActive   = false;
    this._lustRareDodgeBuffApplied  = false;
    this._lustRareDodgeBuffUntil    = 0;
    this._lustRareDodgeMilestoneActive = false;
    this._lustRareDodgeMilestoneCount  = 0;
    this._lustRareDodgeMilestoneUsed   = false;
    // [Phase P-54] 오만 트리거 트래커 (3등급) — epic 폐기 (단 pride_legend_8 가 EpicNextCrit 재활용)
    this._prideNormalFullHpAtkActive = false;
    this._prideRareFullHpAtkActive   = false;
    this._prideNormalCritInvulnActive = false;
    this._prideRareCritInvulnActive   = false;
    this._prideNormalFullHpStackActive = false; this._prideNormalFullHpStackAdded = 0; this._prideNormalFullHpLastTickTime = 0;
    this._prideRareFullHpStackActive   = false; this._prideRareFullHpStackAdded   = 0; this._prideRareFullHpLastTickTime   = 0;
    this._prideNormalCritBuffActive = false;
    this._prideNormalCritBuffUntil  = 0;
    this._prideRareNoDmgActive = false;
    this._prideRareCritAtkBuffActive = false;
    this._prideRareInvulnActive = false;
    this._prideRareInvulnUsed   = false;
    // 치명의 일격 (pride_legend_8 — 옛 epic 플래그 재활용)
    this._prideEpicNextCritActive  = false;
    this._prideEpicNextCritPending = false;
    // [Phase P-54] 나태 트리거 트래커 (3등급) — epic 폐기
    this._slothNormalMaxHpAtkActive = false;
    this._slothRareMaxHpAtkActive   = false;
    this._slothNormalDmgStackActive = false; this._slothNormalDmgStackAdded = 0;
    this._slothRareDmgStackActive   = false; this._slothRareDmgStackAdded   = 0;
    this._slothNormalFullHpReductActive = false;
    this._slothRareFullHpReductActive   = false;
    this._slothNormalLowHpDRActive = false;
    this._slothNormalLowHpDRBuffUntil = 0;
    this._slothRareLowHpHealActive   = false;
    this._slothRareLowHpLastTickTime = 0;
    this._slothRareHealAtkBuffActive = false;
    this._slothRareMaxHpMilestoneActive = false;
    this._slothRareMaxHpMilestoneUsed   = false;
    // [Phase P-54] 탐욕 트리거 트래커 (3등급) — epic 폐기
    this._greedNormalGoldRatioActive = false;
    this._greedRareGoldRatioActive   = false;
    this._greedNormalKillGoldActive  = false;
    this._greedRareKillGoldActive    = false;
    this._greedNormalSpendStackActive = false; this._greedNormalSpendStackAdded = 0;
    this._greedRareSpendStackActive   = false; this._greedRareSpendStackAdded   = 0;
    this._greedNormalCritGoldActive  = false;
    this._greedRareCritGoldActive    = false;
    this._greedRareGoldGainBuffActive = false;
    this._greedRareSpendOnceActive = false;
    this._greedRareSpendOnceUsed   = false;
    this._greedRareSpendOnceCounter = 0;
    // [Phase P-54] 분노 트리거 카드 트래커 (3등급: 노말/레어/레전드)
    // 처치 누적 atk: 노말 +0.1×30=+3 / 레어 +0.25×32=+8 / 레전드 +0.5×60=+30 (legend)
    this._wrathKillStackNActive = false; this._wrathKillStackNAdded = 0;
    this._wrathKillStackRActive = false; this._wrathKillStackRAdded = 0;
    // 받피 시 임시 atk 버프 (노말 +6%/3s, 레어 +15%/4s) — _synergyTempBuffs push
    this._wrathDmgBuffNActive = false;
    this._wrathDmgBuffRActive = false;
    // 콤보 buff (레어 콤보4+/+12%)
    this._wrathComboBuffRActive = false;
    // HP 60%↓ atk +18% (레어 절체)
    this._wrathHpBuffRActive = false;
    // 노말 광기의 끝 — HP 50%↓ AS +20%
    this._wrathNormalHpSpeedActive = false;
    // 레어 격추 — 처치 시 1초 무적
    this._wrathRareKillInvulnActive = false;
    // 레어 변형 — 5번째 공격마다 ×1.6
    this._wrathRareCounterActive = false;
    this._wrathAttackCounter = 0;
    // 레전드 학살의 인장 — 처치 시 3초 AS +30%
    this._wrathLegendKillSpeedActive = false;
    // 레전드 영겁의 분노 (L3) — 처치 시 atk +0.5 영구 (max +30, 캡)
    this._wrathL3Added = 0;
    // [Phase M7] 폭식 레전드 게임체인저 플래그 (L1 은 옛 _gluttonyL1Active 재사용 — 신규 메카닉)
    this._gluttonyL1AtkAdded = 0;              // L1 누적 atk (max 50, revert 정확용)
    this._gluttonyL3Active = false;            // L3 — 흡혈 발동 시 5초 atk ×1.20
    this._gluttonyL4Active = false;            // L4 — 회복 시 5초 maxHp +20
    this._gluttonyL4MaxHpActive = false;       // L4 임시 maxHp 보너스 활성 상태
    this._gluttonyL4MaxHpExpireAt = 0;         // L4 만료 시각
    this._gluttonyL5Active = false;            // L5 — 처치한 적의 atk × 0.05 흡수
    this._gluttonyL5AtkAbsorbed = 0;           // L5 누적 흡수 atk (revert 정확용)
    // [Phase P-53] 색욕 펫 시스템 완전 제거 (_activePets 폐기).
    // 매점 리롤 카운터 — 스테이지당 4회 제한 (Phase B)
    this._stageShopRerollsUsed = 0;
    // [Phase P-31] 카드 선택 리롤 카운터 — 스테이지당 1회 제한 (testMode 시 무제한, 카운터 무시).
    this._stageCardRerollsUsed = 0;
    // [Phase P-54] 기본 물약 — 쿨타임 기반. 항상 1개 보유, 쿨다운 회복.
    this._potionCdRemainMs = 0;   // 남은 쿨다운 (ms). 0 = 즉시 사용 가능. GameScene.update 가 감산.
    // 장비 슬롯 — 8 슬롯, 각자 1개만 장착 가능
    this.equipment = {
      head: null, accessory: null, body: null, shield: null,
      hands: null, arms: null, legs: null, feet: null,
    };
    // 특수 카드 가방 — 구매한 카드들
    // 항목 구조: { id, name, icon, type, desc?, color?, ...meta }
    //   type: 'consumable' (즉시 사용) / 'passive' (자동 발동) / 'utility' (특수 동작)
    this.bag = [];
    // 다음 웨이브에 적용될 임시 버프 (사용 시 큐에 들어감)
    // damageReduction: 임시 방패 (-50% 받는 데미지) — equipment damageReduction 후 추가 감산
    this.queuedBuffs = { attackPower: 0, attackSpeed: 0, damageReduction: 0 };
    // 현재 활성 임시 버프 (웨이브 시작 시 queued → active 이동, 웨이브 종료 시 리셋)
    this.activeBuffs = { attackPower: 0, attackSpeed: 0, damageReduction: 0 };
    // 지속 / 1회성 플래그
    this.goldMultWaves = 0;       // 황금의 부적 — 남은 웨이브 수 (0이면 비활성)
    this.nextCardChoices = 3;     // 운명의 주사위 — 다음 카드 선택 시 장수 (기본 3)
    this.nextBossHpReduce = 0;    // 폭발의 부적 — 다음 보스 HP 차감 비율
    this.nextBossFreezeMs = 0;    // 결빙의 부적 — 다음 보스 정지 ms
    this.nextCardPickRarityBoost = 0;  // 카드픽 등급 +1 보장 — 다음 카드픽 시 N단계 만큼 등급 상향, 픽 후 자동 0
    this.invulnUntil = 0;         // 부활 직후 무적 시각 (ms)

    // 장비 패시브 상태 (passives.js 참조 — 장착된 장비에 passive 필드가 있을 때 작동)
    this.passiveAttackCount = 0;          // explosive-strike — 매 공격 카운터
    this.passiveInvulnReadyAt = 0;        // invuln-strike — 다음 무효화 사용 가능 시각 (0 = 즉시)
    this.passiveSecondWindUsed = false;   // second-wind — 이번 웨이브에 이미 사용했는지
    this.passiveCritFrenzyEndTime = 0;    // crit-frenzy — 공속 부스트 종료 시각
  }

  // === Phase E1 — 다중 source stat 헬퍼 ===
  // _statSources 에 source 별 누적, getStat 으로 합계 + cap, modStat 으로 source 영역에 누적 변경.
  // this.stats[name] (flat number) 은 modStat 이 동기화 — 외부 옛 코드 호환용.

  getStat(name) {
    const src = this._statSources && this._statSources[name];
    if (!src) {
      // hp / gold / level / exp / expToNext 등 — flat 패스스루
      return (this.stats && this.stats[name] !== undefined) ? this.stats[name] : 0;
    }
    let total = (src.base || 0) + (src.equipment || 0) + (src.cards || 0) + (src.synergy || 0);
    // [Phase M2] 탐욕 L4 — 보유 골드 100 마다 % stat +5% 가산 (cap 적용 전).
    //   대상: critChance / critDamage / dodge / lifesteal / damageReduction / accuracy / goldGainMul.
    //   비대상: attackPower / attackSpeed / maxHp (정수/시간 stat).
    if (this._greedL4Active && PERCENT_STATS.has(name)) {
      total += Math.floor((this.stats.gold || 0) / 100) * 0.05;
    }
    // [Phase N1] 탐욕 시너지 9 — 보유 골드 200당 % stat +5% (sin-seal 시 무효)
    if (this._greed9Active && PERCENT_STATS.has(name)
        && !(this._debuffOverrides && this._debuffOverrides.synergyDisabled)) {
      total += Math.floor((this.stats.gold || 0) / 200) * 0.05;
    }
    // [Phase N2] 듀얼 시너지 동적 stat 가산 (sin-seal 시 무효, cap 적용 전)
    // ⚠ getStat 재귀 방지 — flat stats.hp / stats.maxHp 직접 참조 (modStat 동기화).
    const synergyOKStat = !(this._debuffOverrides && this._debuffOverrides.synergyDisabled);
    if (synergyOKStat) {
      const goldHundreds = Math.floor((this.stats.gold || 0) / 100);
      const isFullHpFlat = this.stats.hp >= (this.stats.maxHp || 1);
      // 탐욕_나태 — 보유 골드 100당 maxHp +5
      if (name === 'maxHp' && this._greedSlothActive) total += goldHundreds * 5;
      // 탐욕_오만 — HP 100% 시 goldGainMul +50%
      if (name === 'goldGainMul' && this._greedPrideActive && isFullHpFlat) total += 0.50;
      // 탐욕_오만 — 보유 골드 200당 critDamage +20% (HP 무관 항상)
      if (name === 'critDamage' && this._greedPrideActive) {
        total += Math.floor((this.stats.gold || 0) / 200) * 0.20;
      }
      // 오만_색욕 — HP 100% 시 dodge +30%
      if (name === 'dodge' && this._prideLustActive && isFullHpFlat) total += 0.30;
    }
    // === cap 정책 ===
    if (name === 'dodge')           total = Math.max(0, Math.min(1, total));
    else if (name === 'critChance') total = Math.max(0, Math.min(1, total));
    else if (name === 'damageReduction') total = Math.max(-0.5, Math.min(0.5, total));
    else if (name === 'lifesteal')  total = Math.max(0, Math.min(1.0, total));   // cap 100% — 더 큰 빌드는 무의미
    else if (name === 'accuracy')   total = Math.max(0, Math.min(1.5, total));   // cap 150% — dodge 상쇄 한계
    else if (name === 'attackPower')total = Math.max(1, total);
    else if (name === 'maxHp')      total = Math.max(1, total);
    else if (name === 'attackSpeed')total = Math.max(100, total);
    else if (name === 'goldGainMul')total = Math.max(0, total);
    else if (name === 'critDamage') total = Math.max(1.0, total);
    return total;
  }

  getStatBreakdown(name) {
    const src = this._statSources && this._statSources[name];
    if (!src) return { base: 0, equipment: 0, cards: 0, synergy: 0, total: this.getStat(name) };
    return {
      base:      src.base      || 0,
      equipment: src.equipment || 0,
      cards:     src.cards     || 0,
      synergy:   src.synergy   || 0,
      total:     this.getStat(name),
    };
  }

  // === [Phase P-54] 기본 물약 — 쿨타임 기반 (항상 1개 보유) ===
  // 사용 시 maxHp * POTION_HEAL_PCT 회복 + POTION_CD_MS 쿨다운 시작.
  // 만피 시 거부 (false 반환, 쿨다운 X). 쿨다운 중 클릭 시 거부 (false).
  // _potionCdRemainMs — wall clock 대신 누적기 (일시정지/모달 시 자동 정지).
  //   Player.update 가 delta 받아 감산 (씬 일시정지 가드 적용).
  isPotionReady() {
    return (this._potionCdRemainMs || 0) <= 0;
  }
  getPotionCdRemain() {
    return Math.max(0, this._potionCdRemainMs || 0);
  }
  drinkPotion() {
    if (!this.isPotionReady()) return false;
    const cur = this.stats.hp || 0;
    const max = this.getStat('maxHp') || 1;
    if (cur >= max) {
      if (this.scene && this.scene.events) this.scene.events.emit('toast', 'ℹ 이미 최대 HP');
      return false;
    }
    const heal = Math.floor(max * POTION_HEAL_PCT);
    this.stats.hp = Math.min(max, cur + heal);
    if (this.updateHpDisplay) this.updateHpDisplay();
    if (this.scene && this.scene.events) {
      this.scene.events.emit('toast', `❤ +${this.stats.hp - cur} HP`);
    }
    this._potionCdRemainMs = POTION_CD_MS;
    return true;
  }
  // GameScene.update 가 매 프레임 호출 (paused 가드 통과 시).
  tickPotionCd(deltaMs) {
    if ((this._potionCdRemainMs || 0) > 0) {
      this._potionCdRemainMs = Math.max(0, this._potionCdRemainMs - deltaMs);
    }
    // [Phase P-55] 자동 물약 — 다이아 상점 'diamond-auto-potion' 보유 시 HP 40% 이하 자동 사용.
    if (this._hasAutoPotion()) {
      const maxHp = this.getStat('maxHp') || 1;
      const hpRatio = (this.stats.hp || 0) / maxHp;
      if (hpRatio <= 0.40 && this.isPotionReady()) {
        this.drinkPotion();
      }
    }
  }
  _hasAutoPotion() {
    if (!Array.isArray(this.bag) || this.bag.length === 0) return false;
    for (const c of this.bag) {
      if (c && c.id === 'diamond-auto-potion') return true;
    }
    return false;
  }

  // === [Phase P-54] 시간 제한 버프 시스템 (영약 30초 등) ===
  // stat: 'attackPower' | 'attackSpeed' | 'damageReduction' | 'lifesteal'
  // delta: 추가량 (예: 0.25 = +25%). 음수도 가능 (디버프).
  // durationMs: ms (기본 30000 = 30초). 만료 시 _tickTimedBuffs 가 activeBuffs 에서 빼고 항목 제거.
  // stat 'expMul' 은 특수 — activeBuffs 대신 _stageExpMul 에 누적.
  addTimedBuff(stat, delta, durationMs = 30000) {
    if (!this.activeBuffs) this.activeBuffs = {};
    // [버그수정] 매점 등에서 같은 버프(stat+delta)를 중복 구매 시 스택 누적 X — 지속시간만 리셋.
    //   서로 다른 delta(예: 양수 영약 + 음수 디버프)는 독립이라 그대로 누적.
    if (this._timedBuffs && this._timedBuffs.length > 0) {
      const existing = this._timedBuffs.find(b => b.stat === stat && b.delta === delta);
      if (existing) {
        existing.remainMs = durationMs;
        return;
      }
    }
    if (stat === 'expMul') {
      this._stageExpMul = (this._stageExpMul || 1) + delta;
    } else {
      this.activeBuffs[stat] = (this.activeBuffs[stat] || 0) + delta;
    }
    // 남은 ms 기반 (wall clock 의존 X) — 일시정지/모달 시 자연스럽게 멈춤.
    this._timedBuffs.push({ stat, delta, remainMs: durationMs });
  }
  // scene 'update' 이벤트 콜백 — (time, delta) 수신. 일시정지 가드 통과 시에만 감산.
  _tickTimedBuffs(time, delta) {
    if (!this._timedBuffs || this._timedBuffs.length === 0) return;
    const sc = this.scene;
    const paused = sc && (sc.cardSelectionActive || sc.gameOverActive || sc.pauseMenuActive
                       || sc.bossIntroActive   || sc.eventModalActive);
    if (paused) return;
    const dt = typeof delta === 'number' ? delta : 0;
    const stillActive = [];
    for (const b of this._timedBuffs) {
      b.remainMs -= dt;
      if (b.remainMs <= 0) {
        if (b.stat === 'expMul') {
          this._stageExpMul = (this._stageExpMul || 1) - b.delta;
        } else {
          this.activeBuffs[b.stat] = (this.activeBuffs[b.stat] || 0) - b.delta;
        }
      } else {
        stillActive.push(b);
      }
    }
    this._timedBuffs = stillActive;
  }
  // BuffStrip 에서 남은 ms 조회 (가장 짧은 만료 = 임박한 것).
  getTimedBuffRemain(stat) {
    if (!this._timedBuffs || this._timedBuffs.length === 0) return 0;
    let min = Infinity;
    for (const b of this._timedBuffs) {
      if (b.stat === stat && b.remainMs > 0 && b.remainMs < min) min = b.remainMs;
    }
    return min === Infinity ? 0 : min;
  }

  // source: 'base' | 'equipment' | 'cards' | 'synergy'
  // delta: 양수/음수 누적. flat stats[name] 도 delta 만큼 누적 (sum 재계산 X).
  // ⚠ delta-sync 채용 이유: E3 마이그레이션 전 synergyEffects.js 가 stats[name] 직접 수정함.
  //   sum 재계산 시 synergy 직접 변경분이 덮어씌워져 손실됨. delta 누적으로 외부 직접 변경 보존.
  modStat(name, source, delta) {
    if (!this._statSources || !this._statSources[name]) return;
    if (source !== 'base' && source !== 'equipment' && source !== 'cards' && source !== 'synergy') return;
    if (!delta) return;
    this._statSources[name][source] = (this._statSources[name][source] || 0) + delta;
    // delta-sync — 옛 코드 (synergy / 외부) 의 직접 stats[name] 변경분을 보존.
    this.stats[name] = (this.stats[name] || 0) + delta;
  }

  // === 장비 패시브 ===

  // 장착된 장비 중 해당 패시브 ID 를 가진 것이 있으면 true
  hasPassive(id) {
    for (const slot of Object.keys(this.equipment)) {
      const item = this.equipment[slot];
      if (item && item.passive === id) return true;
    }
    return false;
  }

  // 웨이브 시작 시 호출 — 웨이브 단위 패시브 / 카드 효과 상태 리셋
  onWaveStart() {
    this.passiveSecondWindUsed = false;
    this.passiveAttackCount = 0;
    // [Phase M4] 오만 L5 — 웨이브 첫 공격 강제 치명 사용 플래그 리셋
    this._prideL5UsedThisWave = false;
    // [Phase M-B5] 오만 레어 변형 — 1회성 5초 무적 사용 플래그 리셋
    this._prideRareInvulnUsed = false;
  }

  // === 장비 장착 / 효과 적용 ===

  // item.effect 를 stats에 더하거나 빼기 (sign = +1 장착 / -1 해제)
  _applyItemEffect(effect, sign) {
    // Phase E1 — equipment source 영역에 누적. _statSources 에 등록된 stat 만 modStat,
    // 그 외 (예: 임시/특수 키) 는 옛 방식 (stats[key] 직접 += ) 으로 폴백.
    // [Phase K] defense/moveSpeed/attackRange 키는 무시 (스탯 폐기). 다음 단계 장비 재설계 전 임시 가드.
    const DROPPED_KEYS = ['defense', 'moveSpeed', 'attackRange'];
    Object.entries(effect).forEach(([key, val]) => {
      if (DROPPED_KEYS.includes(key)) return;
      const delta = sign * val;
      if (this._statSources && this._statSources[key]) {
        this.modStat(key, 'equipment', delta);
        if (key === 'maxHp') {
          // maxHp 가 늘면 hp 도 같이 늘고, 줄면 hp 도 cap 에 맞춰 깎음.
          // 양쪽 모두 maxHp cap 으로 clamp (양수 시 cap 초과 방지).
          if (sign > 0) this.stats.hp = Math.min(this.getStat('maxHp'), this.stats.hp + val);
          else this.stats.hp = Math.min(this.stats.hp, this.getStat('maxHp'));
        }
      } else {
        // _statSources 미등록 stat (level/exp 등은 장비 effect 에 안 옴) — 폴백
        this.stats[key] = (this.stats[key] || 0) + delta;
      }
    });
  }

  // 장비 장착 (같은 슬롯에 이미 있으면 교체)
  equipItem(item) {
    const slot = item.slot;
    if (!slot || !(slot in this.equipment)) return;
    const old = this.equipment[slot];
    if (old) this._applyItemEffect(old.effect, -1);    // 기존 효과 해제
    this._applyItemEffect(item.effect, +1);            // 새 효과 적용
    // 가벼운 데이터만 저장 (apply 함수 같은 클로저는 빼고)
    this.equipment[slot] = {
      id: item.id, name: item.name, slot: item.slot, desc: item.desc,
      price: item.price, effect: { ...item.effect },
      passive: item.passive || null,
    };
  }

  // === 이동 ===

  moveForward() {
    const gameMul = (this.scene && this.scene._gameSpeed) || 1;
    // [Phase K] moveSpeed 폐기 — 100 고정, 디버프 override 무시
    // stun 중에도 이동 정지
    if (this._debuffStunMs > 0) {
      this.sprite.body.setVelocityX(0);
      return;
    }
    this.sprite.body.setVelocityX(200 * gameMul);
  }

  stop() {
    this.sprite.body.setVelocityX(0);
  }

  resetPosition(x, y) {
    this.sprite.x = x;
    this.sprite.y = y;
    this.engagedAt = null;
  }

  // === 전투 ===

  canAttack(time) {
    // 보스 디버프 — stun 중이면 공격 불가
    if (this._debuffStunMs > 0) return false;
    // 폭주의 부적 — 공속 +(activeBuffs.attackSpeed × 100)% 빠름
    let speedMult = 1 / (1 + (this.activeBuffs.attackSpeed || 0));
    // 치명 폭주 패시브 — 발동 중이면 공속 +20%
    if (time < this.passiveCritFrenzyEndTime) speedMult /= 1.20;
    // [Phase P-54] 광기의 끝 (분노 노말) — HP 50% 이하 시 공속 +20% (interval ÷ 1.20)
    if (this._wrathNormalHpSpeedActive && this.stats.hp / this.getStat('maxHp') <= 0.50) {
      speedMult /= 1.20;
    }
    // [Phase P-54] _synergyTempBuffs 안 type 'attackSpeedMul' 항목 (학살의 인장 등) 만료시각 검사 + 적용
    if (this._synergyTempBuffs && this._synergyTempBuffs.length) {
      const nowAs = time;
      for (const b of this._synergyTempBuffs) {
        if (b.type === 'attackSpeedMul' && b.expireAt > nowAs) {
          speedMult /= (b.value || 1);
        }
      }
    }
    // 보스 디버프 — 시간 왜곡 (마법사 도제: 플레이어 공속 ×1.4 = 느려짐)
    if (this._debuffOverrides && this._debuffOverrides.attackSpeedMul) {
      speedMult *= this._debuffOverrides.attackSpeedMul;
    }
    // 게임 속도 — 2배속 시 쿨타임 절반
    const gameMul = (this.scene && this.scene._gameSpeed) || 1;
    return time - this.lastAttackTime >= (this.getStat('attackSpeed') * speedMult) / gameMul;
  }

  // 공격 실행 → 데미지 계산 결과 반환
  // targetEnemy: 동적 시너지 (질투 적HP / 분노_질투 / 오만_질투) 용 — null 시 무시
  attack(time, targetEnemy = null) {
    this.lastAttackTime = time;
    // getEffectiveAttackPower 가 기본 atk + activeBuffs + 시너지 동적 효과 처리.
    let damage = this.getEffectiveAttackPower(targetEnemy);

    // 처치 폭발 — 활성 시 공격력 ×(1+버프), 만료되면 자동 리셋
    if (time < this.killBuffEndTime) {
      damage *= this.killBuffMult;
    } else if (this.killBuffMult !== 1) {
      this.killBuffMult = 1;
    }

    // 결사항전 — HP 30% 이하일 때 데미지 ×1.8
    if (this.skills.desperateRage && this.stats.hp / this.getStat('maxHp') <= 0.3) {
      damage *= 1.8;
    }

    // 광폭화 패시브 — HP 50% 이하일 때 공격력 +25%
    if (this.hasPassive('berserker') && this.stats.hp / this.getStat('maxHp') <= 0.5) {
      damage *= 1.25;
    }

    // 회피 사냥꾼 — 회피 직후 다음 공격 ×2
    if (this.dodgeBuffActive) {
      damage *= 2;
      this.dodgeBuffActive = false;
    }

    // [Phase P-54] 분노 레어 변형 — 5번째 공격마다 ×1.6 (공격 카운터, 연쇄 처형)
    if (this._wrathRareCounterActive) {
      this._wrathAttackCounter += 1;
      if (this._wrathAttackCounter % 5 === 0) damage *= 1.6;
    }
    // [Phase M-B6] 색욕 노말 — 회피 후 다음 공격 atk +20% (1회성, 소비)
    if (this._lustNormalNextAtkBuffActive && this._lustNormalNextAtkPending) {
      damage *= 1.20;
      this._lustNormalNextAtkPending = false;
    }
    // 치명타 — getEffectiveCritChance/Damage 가 오만 L1 조건부 보너스 처리
    let isCrit = false;
    // [Phase M4] 오만 L5 — 웨이브 첫 공격 강제 치명 (한 웨이브당 1회) — 우선순위 1
    if (this._prideL5Active && !this._prideL5UsedThisWave) {
      isCrit = true;
      this._prideL5UsedThisWave = true;
    }
    // [Phase M5] 색욕 L5 — 회피 후 다음 공격 강제 치명 (1회성) — 우선순위 2
    else if (this._lustL5Active && this._lustL5NextCrit) {
      isCrit = true;
      this._lustL5NextCrit = false;
    }
    // [Phase M-B6] 색욕 레어 — 회피 후 다음 공격 강제 치명 (1회성, L5와 별개 카드) — 우선순위 2.5
    else if (this._lustRareForcedCritActive && this._lustRareForcedCritPending) {
      isCrit = true;
      this._lustRareForcedCritPending = false;
    }
    // [Phase M-B5] 오만 에픽 변형 2 — 치명 적중 후 다음 공격 강제 치명 (1회성 체인) — 우선순위 3
    else if (this._prideEpicNextCritActive && this._prideEpicNextCritPending) {
      isCrit = true;
      this._prideEpicNextCritPending = false;
    }
    // [Phase P-54] 분노 에픽 변형 1 (강제 치명) 제거 — 에픽 등급 폐기.
    // [Phase M-B7] 질투 에픽 변형 1 — 적 HP > 내 HP 시 모든 공격 강제 치명 — 우선순위 5
    else if (this._envyEpicStrongerCritActive && targetEnemy && (targetEnemy.hp || 0) > this.stats.hp) {
      isCrit = true;
    } else if (this.skills.perfectAccuracy && this.getStat('accuracy') >= 1.5) {
      isCrit = true;
    } else if (Math.random() < this.getEffectiveCritChance()) {
      isCrit = true;
    }
    if (isCrit) damage *= this.getEffectiveCritDamage();

    return {
      damage: Math.floor(damage),
      isCrit,
      isAreaAttack: false,
      areaRange: 0,
      splashRatio: 0,
    };
  }

  // 데미지 받기
  takeDamage(amount, opts) {
    // 부활 직후 무적 시간 체크 + Phase 3 오만_색욕 회피 무적
    const now = (this.scene && this.scene.time) ? this.scene.time.now : 0;
    if (now < this.invulnUntil) {
      return { dodged: true, damage: 0, invuln: true };
    }
    if (now < this._synergyDodgeInvulnUntil) {
      return { dodged: true, damage: 0, invuln: true, synergy: true };
    }
    // 보스 디버프 — 회피 강제 0 (흑기사: 명예 결투)
    const dodgeOverride = this._debuffOverrides && this._debuffOverrides.dodgeOverride;
    let effectiveDodge = (dodgeOverride !== undefined) ? dodgeOverride : this.getStat('dodge');
    // [Phase N2] 색욕_질투 듀얼 — 적 HP > 내 HP 시 dodge +20% (가장 가까운 적 추정)
    if (this._lustEnvyActive && (!this._debuffOverrides || !this._debuffOverrides.synergyDisabled)
        && this.scene && this.scene.combatSystem && this.scene.combatSystem.getNearestEnemy) {
      const nearest = this.scene.combatSystem.getNearestEnemy();
      if (nearest && nearest.enemy && (nearest.enemy.hp || 0) > this.stats.hp) {
        effectiveDodge = Math.min(1, effectiveDodge + 0.20);
      }
    }
    // 회피 판정
    if (Math.random() < effectiveDodge) {
      // 회피 사냥꾼 — 회피 30%+ 일 때 다음 공격 강화
      if (this.skills.dodgeHunter && effectiveDodge >= 0.3) {
        this.dodgeBuffActive = true;
      }
      // Phase 3 — 회피 트리거 (나태_색욕 흡혈 누적 / 오만_색욕 무적 발동)
      this._onDodge();
      return { dodged: true, damage: 0 };
    }

    // 무적 일격 패시브 — 7초마다 1회 무효화
    if (this.hasPassive('invuln-strike') && now >= this.passiveInvulnReadyAt) {
      this.passiveInvulnReadyAt = now + 7000;
      return { dodged: true, damage: 0, invuln: true, passive: 'invuln-strike' };
    }

    // [Phase K] 방어 공식 폐기 — 데미지 100% 적용. damageReduction 만 별개 stat으로 작동.
    const synergyOK = !(this._debuffOverrides && this._debuffOverrides.synergyDisabled);
    let finalDamage = Math.max(1, Math.floor(amount));

    // [Phase N2] 듀얼 시너지 동적 피감 (sin-seal 시 무시)
    if (synergyOK) {
      const hpRatioTD = this.stats.hp / this.getStat('maxHp');
      // 분노_나태 — HP 50%↓ 시 finalDamage ×0.90 (피감 +10%)
      if (this._wrathSlothActive && hpRatioTD <= 0.50) {
        finalDamage = Math.max(1, Math.floor(finalDamage * 0.90));
      }
      // 나태_오만 — HP 100% 시 finalDamage ×0.80 (피감 +20%)
      if (this._slothPrideActive && this.stats.hp >= this.getStat('maxHp')) {
        finalDamage = Math.max(1, Math.floor(finalDamage * 0.80));
      }
      // 나태_질투 — 적 HP > 내 HP 시 finalDamage ×0.85 (피감 +15%)
      //   가장 가까운 적 추정 — CombatSystem.getNearestEnemy() 사용
      if (this._slothEnvyActive && this.scene && this.scene.combatSystem
          && this.scene.combatSystem.getNearestEnemy) {
        const nearest = this.scene.combatSystem.getNearestEnemy();
        if (nearest && nearest.enemy && (nearest.enemy.hp || 0) > this.stats.hp) {
          finalDamage = Math.max(1, Math.floor(finalDamage * 0.85));
        }
      }
    }

    // [Phase M3] 나태 L4 — HP 100% 시 받피 ×0.5 (damageReduction 전 적용)
    if (this._slothL4Active && this.stats.hp >= this.getStat('maxHp')) {
      finalDamage = Math.max(1, Math.floor(finalDamage * 0.5));
    }
    // [Phase M-B4] 나태 트리거 — HP 100% 시 받피 감산 (노말 -10% / 레어 -25%)
    //   여러 카드 보유 시 곱셈 누적 (각 카드 별도 감산).
    if (this.stats.hp >= this.getStat('maxHp')) {
      if (this._slothNormalFullHpReductActive)
        finalDamage = Math.max(1, Math.floor(finalDamage * 0.90));
      if (this._slothRareFullHpReductActive)
        finalDamage = Math.max(1, Math.floor(finalDamage * 0.75));
    }
    // 피해 감소 (양수) / 받는 피해 증가 (음수) — 방어 공식 후 추가 % 적용
    // cap: -0.5 (받는 피해 +50%) ~ +0.5 (피해 감소 50%)
    // dmgReduce = +0.30 → finalDamage * 0.70 (30% 감산)
    // dmgReduce = -0.20 → finalDamage * 1.20 (20% 증가)
    // dmgReduce = +0.80 → cap 0.50 → finalDamage * 0.50 (50% 감산)
    // dmgReduce = -0.80 → cap -0.50 → finalDamage * 1.50 (50% 증가)
    const dmgReduce = Math.max(-0.5, Math.min(0.5, this.getStat('damageReduction') || 0));
    if (dmgReduce !== 0) {
      finalDamage = Math.max(1, Math.floor(finalDamage * (1 - dmgReduce)));
    }
    // 임시 방패 — 휴식 상점 buff (이번 웨이브 한정 추가 감산, 캡 50%)
    const tempReduce = Math.max(0, Math.min(0.5, (this.activeBuffs && this.activeBuffs.damageReduction) || 0));
    if (tempReduce > 0) {
      finalDamage = Math.max(1, Math.floor(finalDamage * (1 - tempReduce)));
    }
    // [Phase L] 옛 동적 듀얼/피격 트리거 (분노_나태/나태_오만/분노_색욕/오만_폭식) 모두 제거.
    //          synergyOK / _lastDamageTime / _hasSynergyEffect 후크는 보존 — Phase N 작성 시 재사용.
    this.stats.hp = Math.max(0, this.stats.hp - finalDamage);
    this._lastDamageTime = now;

    // [Phase N2] 듀얼 시너지 — 받피 트리거
    if (synergyOK) {
      // 분노_색욕 — 받피 시 흡혈 누적 +1% (max +10%, 5초 후 리셋, _updateSynergyTriggers 가 만료 처리)
      if (this._wrathLustActive) {
        if (now > this._synergyDamageReceivedExpireAt) {
          // 만료된 경우 누적 0 으로 리셋 (안전)
          if (this._synergyDamageReceivedLifesteal > 0) {
            this.modStat('lifesteal', 'synergy', -this._synergyDamageReceivedLifesteal);
          }
          this._synergyDamageReceivedLifesteal = 0;
        }
        if (this._synergyDamageReceivedLifesteal < 0.10) {
          this.modStat('lifesteal', 'synergy', 0.01);
          this._synergyDamageReceivedLifesteal += 0.01;
        }
        this._synergyDamageReceivedExpireAt = now + 5000;
      }
      // 오만_폭식 — 피격 시 _omanPok_atkAdded 누적 0 으로 리셋 (atk 회수)
      if (this._prideGluttonyActive && this._omanPok_atkAdded > 0) {
        this.modStat('attackPower', 'synergy', -this._omanPok_atkAdded);
        this._omanPok_atkAdded = 0;
      }
    }

    // [Phase P-54] 분노 L5 (옛 피격 ×1.20) 제거 — 카드 폐기됨.

    // [Phase P-54] 분노 트리거 — 받피 시 임시 atk 버프 (노말 +6%/3s, 레어 +15%/4s)
    const dmgTriggers = [
      { active: this._wrathDmgBuffNActive, id: 'wrath_dmg_N', val: 1.06, dur: 3000 },
      { active: this._wrathDmgBuffRActive, id: 'wrath_dmg_R', val: 1.15, dur: 4000 },
    ];
    for (const t of dmgTriggers) {
      if (!t.active) continue;
      this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== t.id);
      this._synergyTempBuffs.push({ effectId: t.id, type: 'atkMul', value: t.val, expireAt: now + t.dur });
    }

    // [Phase M3] 나태 L3 — 받피 시 maxHp 영구 +5 (cards 슬롯 누적, swap 대비 카운터 추적)
    if (this._slothL3Active) {
      this.modStat('maxHp', 'cards', 5);
      this._slothL3MaxHpAdded = (this._slothL3MaxHpAdded || 0) + 5;
    }

    // [Phase M-B4] 나태 트리거 — 받피 시 maxHp 영구 +N (노말/레어/에픽 cap)
    if (this._slothNormalDmgStackActive && this._slothNormalDmgStackAdded < 20) {
      const inc = Math.min(1, 20 - this._slothNormalDmgStackAdded);
      this.modStat('maxHp', 'cards', inc);
      this._slothNormalDmgStackAdded += inc;
    }
    if (this._slothRareDmgStackActive && this._slothRareDmgStackAdded < 40) {
      const inc = Math.min(2, 40 - this._slothRareDmgStackAdded);
      this.modStat('maxHp', 'cards', inc);
      this._slothRareDmgStackAdded += inc;
    }
    // [Phase M-B4] 나태 노말 — HP 50%↓ 시 5초 피해 감소 +5% (단발, 만료시각 갱신)
    //   damageReduction 동적 임시 buff 패턴: _synergyTempBuffs 외 별도 처리.
    //   매 takeDamage 호출 시 HP 비율 평가 → buff 활성 여부 결정.
    //   (단순 처리: HP 50%↓ 시 다음 받피부터 추가 감산이 아니라 이번 받피 후 다음 5초간 감산)
    //   → _synergyTempBuffs에 dmgReduce 타입 추가하면 복잡 → 단순 modStat('damageReduction', 'cards', 0.05)
    //     로 활성/비활성 토글 (이번 받피 후 5초). 트래커: _slothNormalLowHpDRBuffUntil.
    if (this._slothNormalLowHpDRActive && this.stats.hp / this.getStat('maxHp') <= 0.5) {
      const expireAt = now + 5000;
      if (!this._slothNormalLowHpDRBuffUntil || this._slothNormalLowHpDRBuffUntil < now) {
        // 비활성 → 활성: damageReduction +5% 적용
        this.modStat('damageReduction', 'cards', 0.05);
      }
      this._slothNormalLowHpDRBuffUntil = expireAt;
    }
    // [Phase M4] 오만 L4 — 피격 시 누적 atk 보너스 0 으로 리셋 (피격이 만피 깨뜨려도 일관 처리)
    if (this._prideL4Active && this._prideL4AtkAdded > 0) {
      this._prideL4AtkAdded = 0;
      this._prideL4LastTickTime = 0;
    }
    // [Phase M-B5] 오만 트리거 — 피격 시 N/R/E full-hp stack 0 리셋
    if (this._prideNormalFullHpStackAdded > 0) {
      this._prideNormalFullHpStackAdded = 0;
      this._prideNormalFullHpLastTickTime = 0;
    }
    if (this._prideRareFullHpStackAdded > 0) {
      this._prideRareFullHpStackAdded = 0;
      this._prideRareFullHpLastTickTime = 0;
    }

    // 위기 회복 패시브 — HP 25% 이하 떨어지면 25% 회복 (웨이브당 1회)
    if (this.hasPassive('second-wind') && !this.passiveSecondWindUsed
        && this.stats.hp > 0 && this.stats.hp <= this.getStat('maxHp') * 0.25) {
      this.passiveSecondWindUsed = true;
      this.stats.hp = Math.min(this.getStat('maxHp'), this.stats.hp + Math.floor(this.getStat('maxHp') * 0.25));
    }

    // HP 0 이고 부활석 보유 시 자동 발동 (passive 타입)
    // Phase I — 일반 부활석 (HP 35% / 1초) 우선 소비, 다이아 부활석 (HP 75% / 2초) 보존.
    if (this.stats.hp <= 0) {
      const normalIdx = this.bag.findIndex(c => c && c.id === 'revive-stone' && c.type === 'passive');
      const diamondIdx = this.bag.findIndex(c => c && c.id === 'diamond-revive' && c.type === 'passive');
      if (normalIdx !== -1) {
        this.bag.splice(normalIdx, 1);
        this.stats.hp = Math.floor(this.getStat('maxHp') * 0.35);
        this.invulnUntil = now + 1000;
        return { dodged: false, damage: finalDamage, revived: true };
      } else if (diamondIdx !== -1) {
        this.bag.splice(diamondIdx, 1);
        this.stats.hp = Math.floor(this.getStat('maxHp') * 0.75);
        this.invulnUntil = now + 2000;
        return { dodged: false, damage: finalDamage, revived: true };
      }
    }
    return { dodged: false, damage: finalDamage };
  }

  isDead() {
    return this.stats.hp <= 0;
  }

  // 즉시 일정량 회복 (최대 HP 초과 안 됨). 웨이브 전환 시 호출됨.
  heal(amount) {
    // 보스 디버프 — 백기사 거짓된 신성: 회복 무효 (5초)
    if (this._debuffOverrides && this._debuffOverrides.healingDisabled) return;
    const before = this.stats.hp;
    this.stats.hp = Math.min(this.getStat('maxHp'), this.stats.hp + amount);
    if (this.stats.hp > before) this._onHealed();
  }

  // [Phase M7] 회복 트리거 — 폭식 L4 (5초간 임시 maxHp +20). heal() / 흡혈 회복 / 부활 등에서 호출.
  // 활성 상태 추적 + 만료시각 갱신: 비활성→활성 전환 시에만 modStat 호출 (중복 누적 방지).
  // 만료는 _updateSynergyTriggers 가 처리 (만료 시 modStat 회수).
  // [Phase M-B4] 나태 레어 — 회복 시 5초간 atk +10% (단발, 만료시각 갱신).
  _onHealed() {
    const now = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
    // 폭식 L4
    if (this._gluttonyL4Active) {
      if (!this._gluttonyL4MaxHpActive) {
        this.modStat('maxHp', 'cards', 20);
        this._gluttonyL4MaxHpActive = true;
      }
      this._gluttonyL4MaxHpExpireAt = now + 5000;
    }
    // 나태 레어 — 임시 atk buff (_synergyTempBuffs push)
    if (this._slothRareHealAtkBuffActive) {
      this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== 'sloth_heal_R');
      this._synergyTempBuffs.push({
        effectId: 'sloth_heal_R', type: 'atkMul', value: 1.10, expireAt: now + 5000,
      });
    }
    // [Phase M-B8] 폭식 트리거 — 회복 시 임시 maxHp buff (활성-once + 만료시각 갱신)
    if (this._gluttonyNormalHealMaxHpActive) {
      if (!this._gluttonyNormalHealMaxHpApplied) {
        this.modStat('maxHp', 'cards', 5);
        this._gluttonyNormalHealMaxHpApplied = true;
      }
      this._gluttonyNormalHealMaxHpExpireAt = now + 3000;
    }
    if (this._gluttonyRareHealMaxHpActive) {
      if (!this._gluttonyRareHealMaxHpApplied) {
        this.modStat('maxHp', 'cards', 15);
        this._gluttonyRareHealMaxHpApplied = true;
      }
      this._gluttonyRareHealMaxHpExpireAt = now + 4000;
    }
  }

  // === 흡혈 / 처치 콤보 ===

  // killedEnemy / hpBeforeKill: Phase 3 트리거용 (강자 처치 / 펫 스폰).
  // 옛 호출자가 인자 없이 호출하면 둘 다 null/0 — 트리거 비활성, 흡혈만 작동.
  onEnemyKilled(killedEnemy = null, hpBeforeKill = 0) {
    // [Phase L] enemyWasStronger 후크 — Phase N 신규 시너지에서 강자 처치 조건 활용용 보존.
    const enemyWasStronger = killedEnemy && hpBeforeKill > this.stats.hp;

    // 처치 카운터 — Phase N 신규 시너지 처치 트리거용 보존
    this._synergyKillCount += 1;

    // [Phase N1] 단일 시너지 — 처치 트리거 (sin-seal 시 무효)
    const synergyOKK = !(this._debuffOverrides && this._debuffOverrides.synergyDisabled);
    if (synergyOKK) {
      // 폭식 3 — 처치 10마리당 atk 영구 +1
      if (this._gluttony3Active && this._synergyKillCount % 10 === 0) {
        this.modStat('attackPower', 'synergy', 1);
      }
      // 폭식 6/9 — 처치 5마리당 atk 영구 +1 + 처치 시 흡혈 누적
      if (this._gluttony6Active || this._gluttony9Active) {
        if (this._synergyKillCount % 5 === 0) {
          this.modStat('attackPower', 'synergy', 1);
        }
        const cap = this._gluttony9Active ? 0.30 : 0.20;
        if ((this._gluttonyLifestealAdded || 0) < cap) {
          this.modStat('lifesteal', 'synergy', 0.01);
          this._gluttonyLifestealAdded = (this._gluttonyLifestealAdded || 0) + 0.01;
        }
      }
      // 폭식 9 — 처치 50 도달 시 1회성 공속 -100ms
      if (this._gluttony9Active && !this._gluttony9Speed50Used && this._synergyKillCount >= 50) {
        this.modStat('attackSpeed', 'synergy', -100);
        this._gluttony9Speed50Used = true;
      }
      // 질투 9 — 강자 처치 시 atk 영구 +1
      if (this._envy9Active && enemyWasStronger) {
        this.modStat('attackPower', 'synergy', 1);
      }

      // [Phase N2] 듀얼 시너지 처치 트리거
      const nowK2 = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
      // 분노_탐욕 — 처치 시 +3G + 5초간 atk +10%
      if (this._wrathGreedActive) {
        this.stats.gold += 3;
        if (this.runStats) this.runStats.goldEarned += 3;
        this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== 'wrath_greed_dual');
        this._synergyTempBuffs.push({
          effectId: 'wrath_greed_dual', type: 'atkMul', value: 1.10, expireAt: nowK2 + 5000,
        });
      }
      // 분노_질투 — 처치 시 1초간 atk +50%
      if (this._wrathEnvyActive) {
        this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== 'wrath_envy_dual');
        this._synergyTempBuffs.push({
          effectId: 'wrath_envy_dual', type: 'atkMul', value: 1.50, expireAt: nowK2 + 1000,
        });
      }
      // 분노_폭식 — 처치 시 atk +0.2 영구 (cap 없음, 누적)
      if (this._wrathGluttonyActive) {
        this.modStat('attackPower', 'synergy', 0.2);
        this._wrathGluttony_atkAdded += 0.2;
      }
      // 탐욕_질투 — 강자 처치 시 +10G (잡몹 골드 50% 보너스는 CombatSystem 사이트에서 처리)
      if (this._greedEnvyActive && enemyWasStronger) {
        this.stats.gold += 10;
        if (this.runStats) this.runStats.goldEarned += 10;
      }
      // 탐욕_폭식 — 처치 시 +5G + 처치 누적 goldGainMul +0.5% (max +30%)
      if (this._greedGluttonyActive) {
        this.stats.gold += 5;
        if (this.runStats) this.runStats.goldEarned += 5;
        if (this._tamPok_goldGainMulAdded < 0.30) {
          this.modStat('goldGainMul', 'synergy', 0.005);
          this._tamPok_goldGainMulAdded += 0.005;
        }
      }
      // 나태_폭식 — 처치 시 maxHp +1 영구 (max +50)
      if (this._slothGluttonyActive && this._naPok_maxHpAdded < 50) {
        this.modStat('maxHp', 'synergy', 1);
        this._naPok_maxHpAdded += 1;
      }
      // 오만_폭식 — HP 100% 시 처치당 atk +0.5 누적 (피격 시 takeDamage 가 0 리셋)
      if (this._prideGluttonyActive && this.stats.hp >= this.getStat('maxHp')) {
        this.modStat('attackPower', 'synergy', 0.5);
        this._omanPok_atkAdded += 0.5;
      }
      // 색욕_폭식 — 처치 시 dodge +0.5% 영구 (max +25%)
      if (this._lustGluttonyActive && this._sePok_dodgeAdded < 0.25) {
        this.modStat('dodge', 'synergy', 0.005);
        this._sePok_dodgeAdded += 0.005;
      }
      // 질투_폭식 — 강자 처치 시 atk +1 영구 (cap 없음, 누적)
      if (this._envyGluttonyActive && enemyWasStronger) {
        this.modStat('attackPower', 'synergy', 1);
        this._envyGluttony_atkAdded += 1;
      }
    }

    // [Phase P-54] 분노 영겁의 분노 (L3) — 처치 시 atk +0.5 영구 (max +30 캡)
    if (this._wrathL3Active && this._wrathL3Added < 30) {
      this.modStat('attackPower', 'cards', 0.5);
      this._wrathL3Added += 0.5;
    }

    // [Phase P-54] 분노 트리거 — 처치 누적 atk (노말 +0.1×30 / 레어 +0.25×32)
    if (this._wrathKillStackNActive && this._wrathKillStackNAdded < 3) {
      this.modStat('attackPower', 'cards', 0.1);
      this._wrathKillStackNAdded += 0.1;
    }
    if (this._wrathKillStackRActive && this._wrathKillStackRAdded < 8) {
      this.modStat('attackPower', 'cards', 0.25);
      this._wrathKillStackRAdded += 0.25;
    }
    // [Phase P-54] 격추 (레어) — 처치 시 1초 무적
    if (this._wrathRareKillInvulnActive) {
      const nowKill = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
      this.invulnUntil = Math.max(this.invulnUntil || 0, nowKill + 1000);
    }
    // [Phase P-54] 학살의 인장 (레전드) — 처치 시 3초간 AS +30%
    if (this._wrathLegendKillSpeedActive) {
      const nowKill = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
      this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== 'wrath_kill_speed_L');
      this._synergyTempBuffs.push({
        effectId: 'wrath_kill_speed_L', type: 'attackSpeedMul', value: 1.30, expireAt: nowKill + 3000,
      });
    }

    // [Phase M2] 탐욕 L3 — 처치 시 골드 +5 (영구)
    if (this._greedL3Active) {
      this.stats.gold += 5;
      this.runStats.goldEarned += 5;
    }

    // [Phase M-B3] 탐욕 트리거 — 처치 시 골드 +N (노말 +1 / 레어 +3)
    if (this._greedNormalKillGoldActive) {
      this.stats.gold += 1;
      this.runStats.goldEarned += 1;
    }
    if (this._greedRareKillGoldActive) {
      this.stats.gold += 3;
      this.runStats.goldEarned += 3;
    }
    // [Phase M6] 질투 L3 — 강자 처치 시 atk +1 영구 (swap 대비 카운터 추적).
    if (this._envyL3Active && enemyWasStronger) {
      this.modStat('attackPower', 'cards', 1);
      this._envyL3AtkAdded = (this._envyL3AtkAdded || 0) + 1;
    }
    // [Phase M6] 질투 L5 — 처치 시 accuracy +1% 영구 (max +30%, 누적 추적)
    if (this._envyL5Active && this._envyL5AccuracyAdded < 0.30) {
      this.modStat('accuracy', 'cards', 0.01);
      this._envyL5AccuracyAdded += 0.01;
    }

    // [Phase M-B7] 질투 트리거 — 강자 처치 시 atk 누적 (노말 +0.2 max +5 / 레어 +0.5 max +10)
    if (enemyWasStronger) {
      if (this._envyNormalStrongerKillStackActive && this._envyNormalStrongerKillStackAdded < 5) {
        const inc = Math.min(0.2, 5 - this._envyNormalStrongerKillStackAdded);
        this.modStat('attackPower', 'cards', inc);
        this._envyNormalStrongerKillStackAdded += inc;
      }
      if (this._envyRareStrongerKillStackActive && this._envyRareStrongerKillStackAdded < 10) {
        const inc = Math.min(0.5, 10 - this._envyRareStrongerKillStackAdded);
        this.modStat('attackPower', 'cards', inc);
        this._envyRareStrongerKillStackAdded += inc;
      }
      // 레어 변형 — 강자 처치 시 흡혈 추가 발동 (maxHp × 10% 즉시 회복)
      if (this._envyRareStrongerLifestealActive) {
        const heal = Math.floor(this.getStat('maxHp') * 0.10);
        if (heal > 0) {
          const before = this.stats.hp;
          this.stats.hp = Math.min(this.getStat('maxHp'), this.stats.hp + heal);
          if (this.stats.hp > before) this._onHealed();
        }
      }
    }
    // [Phase M-B7] 질투 트리거 — 처치 시 명중 누적 (노말 +0.2% max +5% / 레어 +0.5% max +15%)
    if (this._envyNormalKillAccStackActive && this._envyNormalKillAccStackAdded < 0.05) {
      const inc = Math.min(0.002, 0.05 - this._envyNormalKillAccStackAdded);
      this.modStat('accuracy', 'cards', inc);
      this._envyNormalKillAccStackAdded += inc;
    }
    if (this._envyRareKillAccStackActive && this._envyRareKillAccStackAdded < 0.15) {
      const inc = Math.min(0.005, 0.15 - this._envyRareKillAccStackAdded);
      this.modStat('accuracy', 'cards', inc);
      this._envyRareKillAccStackAdded += inc;
    }
    // [Phase M7] 폭식 L1 — 처치당 atk 영구 +0.5 (max 누적 50)
    if (this._gluttonyL1Active && this._gluttonyL1AtkAdded < 50) {
      this.modStat('attackPower', 'cards', 0.5);
      this._gluttonyL1AtkAdded += 0.5;
    }
    // [Phase M7] 폭식 L5 — 처치한 적의 atk × 0.05 만큼 atk 영구 흡수 (cap 없음, 누적 추적)
    if (this._gluttonyL5Active && killedEnemy && killedEnemy.attackPower) {
      const absorb = killedEnemy.attackPower * 0.05;
      if (absorb > 0) {
        this.modStat('attackPower', 'cards', absorb);
        this._gluttonyL5AtkAbsorbed += absorb;
      }
    }

    // [Phase M-B8] 폭식 트리거 — 처치 누적 atk (노말 +0.1 max+3 / 레어 +0.2 max+10)
    if (this._gluttonyNormalKillStackActive && this._gluttonyNormalKillStackAdded < 3) {
      const inc = Math.min(0.1, 3 - this._gluttonyNormalKillStackAdded);
      this.modStat('attackPower', 'cards', inc);
      this._gluttonyNormalKillStackAdded += inc;
    }
    if (this._gluttonyRareKillStackActive && this._gluttonyRareKillStackAdded < 10) {
      const inc = Math.min(0.2, 10 - this._gluttonyRareKillStackAdded);
      this.modStat('attackPower', 'cards', inc);
      this._gluttonyRareKillStackAdded += inc;
    }
    // [Phase M-B8] 폭식 트리거 — 처치 적 atk 흡수 (노말 1% / 레어 3%, cap 없음)
    if (killedEnemy && killedEnemy.attackPower) {
      if (this._gluttonyNormalAtkAbsorbedActive) {
        const absorb = killedEnemy.attackPower * 0.01;
        if (absorb > 0) {
          this.modStat('attackPower', 'cards', absorb);
          this._gluttonyNormalAtkAbsorbed += absorb;
        }
      }
      if (this._gluttonyRareAtkAbsorbedActive) {
        const absorb = killedEnemy.attackPower * 0.03;
        if (absorb > 0) {
          this.modStat('attackPower', 'cards', absorb);
          this._gluttonyRareAtkAbsorbed += absorb;
        }
      }
    }
    // [Phase M-B8] 폭식 레어 변형 — 처치 시 maxHp +1 영구 (max +30)
    if (this._gluttonyRareKillMaxHpActive && this._gluttonyRareKillMaxHpAdded < 30) {
      this.modStat('maxHp', 'cards', 1);
      this._gluttonyRareKillMaxHpAdded += 1;
    }
    // [Phase L] 옛 시너지 처치 트리거 (분노_폭식/탐욕_폭식/나태_폭식/색욕_폭식/분노_질투/오만_폭식/질투_폭식
    //                                  + gluttony_3/6/9 / envy_9 / 폭식 L1 / 질투 L1) 모두 제거.
    //          Phase N 작성 시 synergyOK + _hasSynergyEffect 후크로 본 함수에 분기 추가.
    // 후크 변수 enemyWasStronger 사용 안내 (lint 회피)
    void enemyWasStronger;

    // [Phase P-53] 색욕 펫 (_trySpawnPet) 호출 제거 — 펫 시스템 완전 폐기.

    // === [P-67] 처치 콤보 — 흡혈 유무와 무관하게 모든 적 처치에 적용 ===
    {
      const nowC = (this.scene && this.scene.time) ? this.scene.time.now : 0;
      // 콤보 스택 — 5초 내 연속 처치 시 +1 (상한 없음), 끊기면 1로 리셋.
      if (nowC < this.killStreakEndTime) {
        this.killStreakCount = this.killStreakCount + 1;
      } else {
        this.killStreakCount = 1;
      }
      if (this.killStreakCount > this.runStats.maxKillStreak) {
        this.runStats.maxKillStreak = this.killStreakCount;
      }
      // 5초간 공격력 버프 — 흡혈 기반 보너스(있으면) + 콤보 스택 (스택당 +4%).
      //   [P-67] 콤보 카운트는 무제한이지만 공격 보너스는 상한(B): 스택 보너스 최대 +60%.
      const STREAK_BONUS_CAP = 0.60;   // 콤보 15 (15×0.04) 에서 도달.
      const lsRate = this.skills.lifestealDouble
        ? this.getStat('lifesteal') * 2
        : this.getStat('lifesteal');
      const baseBonus = lsRate * 3;
      const streakBonus = Math.min(STREAK_BONUS_CAP, this.killStreakCount * 0.04);
      this.killBuffMult = Math.max(this.killBuffMult, 1 + baseBonus + streakBonus);
      this.killBuffEndTime = nowC + 5000;
      this.killStreakEndTime = nowC + 5000;
    }

    if (this.getStat('lifesteal') <= 0) return;

    // lifesteal 은 maxHp 비율 (예: 0.05 = 5%). 더블 스킬 시 ×2.
    const lifestealRate = this.skills.lifestealDouble
      ? this.getStat('lifesteal') * 2
      : this.getStat('lifesteal');
    const now = (this.scene && this.scene.time) ? this.scene.time.now : 0;

    // 1) 즉시 HP 회복 — maxHp × rate (예: maxHp 125, lifesteal 0.05 → +6 HP)
    // [Phase N1] 질투 6/9 — 강자 처치 (hpBeforeKill > stats.hp) 시 lifesteal 동적 보정
    // [Phase N2] 색욕_질투 — 강자 처치 시 추가 lifesteal +10%
    let lifestealEff = lifestealRate;
    const synergyOKLs = !(this._debuffOverrides && this._debuffOverrides.synergyDisabled);
    if (synergyOKLs && enemyWasStronger) {
      if (this._envy6Active) lifestealEff += 0.05;
      if (this._envy9Active) lifestealEff += 0.10;
      if (this._lustEnvyActive) lifestealEff += 0.10;
    }
    let healAmount = Math.floor(this.getStat('maxHp') * lifestealEff);
    this.stats.hp = Math.min(this.getStat('maxHp'), this.stats.hp + healAmount);

    // [Phase M7] 폭식 L3 — 흡혈 발동 시 5초간 atk ×1.20 (만료 시각 갱신)
    if (this._gluttonyL3Active) {
      this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== 'gluttony_L3');
      this._synergyTempBuffs.push({
        effectId: 'gluttony_L3', type: 'atkMul', value: 1.20, expireAt: now + 5000,
      });
    }
    // [Phase M-B8] 폭식 트리거 — 흡혈 발동 시 임시 atk buff (노말 +5%/3s / 레어 +10%/4s)
    const lifestealAtkTriggers = [
      { active: this._gluttonyNormalLifestealAtkBuffActive, id: 'gluttony_ls_atk_N', val: 1.05, dur: 3000 },
      { active: this._gluttonyRareLifestealAtkBuffActive,   id: 'gluttony_ls_atk_R', val: 1.10, dur: 4000 },
    ];
    for (const t of lifestealAtkTriggers) {
      if (!t.active) continue;
      this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== t.id);
      this._synergyTempBuffs.push({ effectId: t.id, type: 'atkMul', value: t.val, expireAt: now + t.dur });
    }
    // [Phase M-B8] 폭식 레어 — 흡혈 시 추가 maxHp × 1% 회복
    if (this._gluttonyRareLifestealHealActive) {
      const extra = Math.floor(this.getStat('maxHp') * 0.01);
      if (extra > 0) {
        this.stats.hp = Math.min(this.getStat('maxHp'), this.stats.hp + extra);
      }
    }
    // [Phase M7] 폭식 L4 — 회복 트리거 (흡혈 회복 포함). _onHealed 헬퍼가 임시 maxHp 처리.
    if (healAmount > 0) this._onHealed();
    // [P-67] 콤보 스택/버프는 위쪽(early-return 앞)에서 모든 처치에 적용 — 여기선 흡혈 회복만 처리.
  }

  // 치명타 명중 시 호출 — 흡혈 의식 시너지 (CombatSystem 에서 호출)
  // 흡혈 절반만큼 maxHp 비율 추가 회복 (예: lifesteal 0.10 → maxHp × 0.05 회복)
  onCritHit(damage) {
    if (!this.skills.lifestealCritDrain || this.getStat('lifesteal') <= 0) return;
    const drainRate = this.getStat('lifesteal') / 2;
    const drainAmount = Math.floor(this.getStat('maxHp') * drainRate);
    this.stats.hp = Math.min(this.getStat('maxHp'), this.stats.hp + drainAmount);
  }

  // === 경험치 / 레벨업 ===

  gainExp(amount) {
    const wasZero = this.pendingLevelUps === 0;
    // [무한 맵] 부적 — 다음 N마리 처치 EXP ×M (옛 P-50c, 폐기 — 호환용 dead code).
    let mul = 1;
    if ((this._nextKillsExpRemain || 0) > 0) {
      mul = this._nextKillsExpMul || 1;
      this._nextKillsExpRemain -= 1;
      if (this._nextKillsExpRemain <= 0) {
        this._nextKillsExpRemain = 0;
        this._nextKillsExpMul = 1;
      }
    }
    // [Phase P-54] 새 부적 — 이번 스테이지 전체 EXP 배수 (영약 패턴).
    if (this._stageExpMul && this._stageExpMul !== 1) {
      mul *= this._stageExpMul;
    }
    const finalAmount = (mul !== 1) ? Math.floor(amount * mul) : amount;
    this.stats.exp += finalAmount;
    while (this.stats.exp >= this.stats.expToNext) {
      this.stats.exp -= this.stats.expToNext;
      this.stats.level += 1;
      this.stats.expToNext = Math.floor(this.stats.expToNext * 1.3);
      this.pendingLevelUps += 1;
      // 레벨업마다 최대 HP의 15% 회복
      this.heal(this.getStat('maxHp') * 0.15);
      sound.levelUp();
    }
    // 0 → 1+ 로 처음 늘어난 순간에만 GameScene 에 알림
    // (전투 중이어도 즉시 카드 모달이 뜨도록)
    if (wasZero && this.pendingLevelUps > 0 && this.scene && this.scene.events) {
      this.scene.events.emit('player-level-up');
    }
  }

  // === 스테이지 리셋 ===
  // 스테이지 시작 시 호출 — stats / 카드 풀 / 시너지 / 누적 트래커 / 펫 모두 초기화.
  // 다이아 영구 강화 + 장비 로드아웃은 호출자(GameScene) 가 별도 재적용.
  resetForNewStage() {
    // 1. stats 완전 리셋 (Phase E1 — multi-source 도 base 만 남기고 cards/equipment/synergy 0)
    // [Phase K] defense/moveSpeed/attackRange 는 stats 에 호환용 고정값만 (변경 불가)
    const baseStats = {
      attackPower: 16, attackSpeed: 900, maxHp: 150,    // [Phase Fix-2] 13/125 → 16/150
      critChance: 0.05, critDamage: 1.5, dodge: 0, accuracy: 0.80,
      lifesteal: 0, damageReduction: 0, goldGainMul: 1.0,
    };
    // _statSources 리셋 — base 는 baseStats 의 시작값으로 복귀, 나머지 source 0
    if (this._statSources) {
      for (const key of Object.keys(this._statSources)) {
        this._statSources[key].base      = baseStats[key] !== undefined ? baseStats[key] : 0;
        this._statSources[key].equipment = 0;
        this._statSources[key].cards     = 0;
        this._statSources[key].synergy   = 0;
      }
    }
    // flat stats — Phase K 고정값(defense=0/moveSpeed=100) + Phase P-44d (attackRange=100)
    this.stats = {
      ...baseStats,
      attackRange: 100, moveSpeed: 100, defense: 0,
      hp: 150,    // [Phase Fix-2] 125 → 150 (maxHp 와 동일)
      level: 1, exp: 0, expToNext: 50, gold: 0,
    };
    // 2. skills 리셋
    this.skills = {
      lifestealDouble: false, lifestealCritDrain: false,
      dodgeHunter: false, desperateRage: false,
    };
    // 3. 카드 / 시너지 / 픽 기록 초기화
    this.pickedCards = [];
    this.pickedCardOrder = [];
    this._pickedCardIdsThisStage = [];
    this.sinCounts = {
      [SINS.WRATH]: 0, [SINS.GREED]: 0, [SINS.SLOTH]: 0, [SINS.PRIDE]: 0,
      [SINS.LUST]: 0, [SINS.ENVY]: 0, [SINS.GLUTTONY]: 0,
    };
    this.activeSin = null;
    this.secondarySin = null;
    this.synergyTier = 0;
    this.dualActive = false;
    this.dualSinKey = null;
    this._appliedSynergyEffects = [];
    // 4. legend L1 플래그 모두 false
    this._wrathL1Active = false;
    this._wrathL3Active = false;   // 영겁의 분노 — 처치 시 atk +0.5 영구 (max +30)
    this._wrathL4Active = false;   // 폭주 콤보 — 콤보 5+ 시 atk ×1.30
    // [Phase N2] 듀얼 시너지 활성 플래그 리셋
    this._wrathGreedActive = false; this._wrathSlothActive = false; this._wrathPrideActive = false;
    this._wrathLustActive = false; this._wrathEnvyActive = false; this._wrathGluttonyActive = false;
    this._wrathGluttony_atkAdded = 0;
    this._greedSlothActive = false; this._greedPrideActive = false; this._greedLustActive = false;
    this._greedEnvyActive = false; this._greedGluttonyActive = false;
    this._slothPrideActive = false; this._slothLustActive = false; this._slothEnvyActive = false;
    this._slothGluttonyActive = false;
    this._prideLustActive = false; this._prideEnvyActive = false; this._prideGluttonyActive = false;
    this._lustEnvyActive = false; this._lustGluttonyActive = false;
    this._envyGluttonyActive = false; this._envyGluttony_atkAdded = 0;
    // [Phase N1] 단일 시너지 활성 플래그 리셋
    this._wrath9Active = false;
    this._greed6Active = false; this._greed9Active = false;
    this._pride3Active = false; this._pride6Active = false; this._pride9Active = false;
    this._envy3Active  = false; this._envy6Active  = false; this._envy9Active  = false;
    this._gluttony3Active = false; this._gluttony6Active = false; this._gluttony9Active = false;
    this._gluttony9Speed50Used = false;
    // [Phase P-54] 6 죄 트리거 트래커 리셋 (3등급, epic 폐기). 옛 epic 플래그 init 모두 제거.
    // 단 envy_legend_7 / pride_legend_8 가 옛 epic 플래그 재활용 — 둘만 보존.
    this._gluttonyNormalKillStackActive = false; this._gluttonyNormalKillStackAdded = 0;
    this._gluttonyRareKillStackActive   = false; this._gluttonyRareKillStackAdded   = 0;
    this._gluttonyNormalLifestealAtkBuffActive = false;
    this._gluttonyRareLifestealAtkBuffActive   = false;
    this._gluttonyNormalHealMaxHpActive = false; this._gluttonyNormalHealMaxHpApplied = false; this._gluttonyNormalHealMaxHpExpireAt = 0;
    this._gluttonyRareHealMaxHpActive   = false; this._gluttonyRareHealMaxHpApplied   = false; this._gluttonyRareHealMaxHpExpireAt   = 0;
    this._gluttonyNormalAtkAbsorbedActive = false; this._gluttonyNormalAtkAbsorbed = 0;
    this._gluttonyRareAtkAbsorbedActive   = false; this._gluttonyRareAtkAbsorbed   = 0;
    this._gluttonyRareLifestealHealActive = false;
    this._gluttonyRareKillMaxHpActive = false; this._gluttonyRareKillMaxHpAdded = 0;

    this._envyNormalStrongerActive = false;
    this._envyRareStrongerActive   = false;
    this._envyNormalEnemyFullHpActive = false;
    this._envyRareEnemyFullHpActive   = false;
    this._envyNormalStrongerKillStackActive = false; this._envyNormalStrongerKillStackAdded = 0;
    this._envyRareStrongerKillStackActive   = false; this._envyRareStrongerKillStackAdded   = 0;
    this._envyNormalKillAccStackActive = false; this._envyNormalKillAccStackAdded = 0;
    this._envyRareKillAccStackActive   = false; this._envyRareKillAccStackAdded   = 0;
    this._envyRareStrongerAccBuffActive = false;
    this._envyRareStrongerLifestealActive = false;
    this._envyEpicStrongerCritActive = false;  // envy_legend_7 재활용

    this._lustNormalAtkBuffActive = false;
    this._lustRareAtkBuffActive   = false;
    this._lustNormalLifestealStackActive = false; this._lustNormalLifestealStackAdded = 0;
    this._lustRareLifestealStackActive   = false; this._lustRareLifestealStackAdded   = 0;
    this._lustNormalShortStunActive = false;
    this._lustRareLongStunActive    = false;
    this._lustNormalNextAtkBuffActive  = false; this._lustNormalNextAtkPending = false;
    this._lustRareForcedCritActive  = false; this._lustRareForcedCritPending = false;
    this._lustRareDodgeBuffActive   = false; this._lustRareDodgeBuffApplied = false; this._lustRareDodgeBuffUntil = 0;
    this._lustRareDodgeMilestoneActive = false; this._lustRareDodgeMilestoneCount = 0; this._lustRareDodgeMilestoneUsed = false;

    this._prideNormalFullHpAtkActive = false;
    this._prideRareFullHpAtkActive   = false;
    this._prideNormalCritInvulnActive = false;
    this._prideRareCritInvulnActive   = false;
    this._prideNormalFullHpStackActive = false; this._prideNormalFullHpStackAdded = 0; this._prideNormalFullHpLastTickTime = 0;
    this._prideRareFullHpStackActive   = false; this._prideRareFullHpStackAdded   = 0; this._prideRareFullHpLastTickTime   = 0;
    this._prideNormalCritBuffActive = false; this._prideNormalCritBuffUntil  = 0;
    this._prideRareNoDmgActive = false;
    this._prideRareCritAtkBuffActive = false;
    this._prideRareInvulnActive = false; this._prideRareInvulnUsed = false;
    this._prideEpicNextCritActive  = false; this._prideEpicNextCritPending = false;  // pride_legend_8 재활용

    this._slothNormalMaxHpAtkActive = false;
    this._slothRareMaxHpAtkActive   = false;
    this._slothNormalDmgStackActive = false; this._slothNormalDmgStackAdded = 0;
    this._slothRareDmgStackActive   = false; this._slothRareDmgStackAdded   = 0;
    this._slothNormalFullHpReductActive = false;
    this._slothRareFullHpReductActive   = false;
    this._slothNormalLowHpDRActive = false;
    this._slothNormalLowHpDRBuffUntil = 0;
    this._slothRareLowHpHealActive   = false;
    this._slothRareLowHpLastTickTime = 0;
    this._slothRareHealAtkBuffActive = false;
    this._slothRareMaxHpMilestoneActive = false;
    this._slothRareMaxHpMilestoneUsed   = false;

    this._greedNormalGoldRatioActive = false;
    this._greedRareGoldRatioActive   = false;
    this._greedNormalKillGoldActive  = false;
    this._greedRareKillGoldActive    = false;
    this._greedNormalSpendStackActive = false; this._greedNormalSpendStackAdded = 0;
    this._greedRareSpendStackActive   = false; this._greedRareSpendStackAdded   = 0;
    this._greedNormalCritGoldActive  = false;
    this._greedRareCritGoldActive    = false;
    this._greedRareGoldGainBuffActive = false;
    this._greedRareSpendOnceActive = false; this._greedRareSpendOnceUsed = false; this._greedRareSpendOnceCounter = 0;
    // [Phase P-54] 분노 트리거 카드 트래커 리셋 (3등급)
    this._wrathKillStackNActive = false; this._wrathKillStackNAdded = 0;
    this._wrathKillStackRActive = false; this._wrathKillStackRAdded = 0;
    this._wrathL3Added = 0;
    this._wrathDmgBuffNActive = false; this._wrathDmgBuffRActive = false;
    this._wrathComboBuffRActive = false;
    this._wrathHpBuffRActive = false;
    this._wrathNormalHpSpeedActive = false;
    this._wrathRareKillInvulnActive = false;
    this._wrathRareCounterActive = false; this._wrathAttackCounter = 0;
    this._wrathLegendKillSpeedActive = false;
    this._greedL1Active = false;
    this._greedL3Active = false;   // [Phase M2] 탐욕 L3 — 처치 시 골드 +5
    this._greedL4Active = false;   // [Phase M2] 탐욕 L4 — 골드 100당 % stat +5%
    this._greedL5Active = false;   // [Phase M2] 탐욕 L5 — 골드 차감 시 atk 누적
    this._greedL5AtkBonus = 0;
    this._slothL1Active = false;   // [Phase M3] 나태 L1 — maxHp 100당 atk +1
    this._slothL3Active = false;   // [Phase M3] 나태 L3 — 받피 시 maxHp +5 영구
    this._slothL4Active = false;   // [Phase M3] 나태 L4 — HP 100% 시 받피 ×0.5
    this._slothL5Active = false;   // [Phase M3] 나태 L5 — HP 50%↓ 시 매초 회복
    this._slothL5LastTickTime = 0;
    this._prideL1Active = false;
    this._prideL3Active = false;   // [Phase M4] 오만 L3 — 치명타 적중 시 1초 무적
    this._prideL4Active = false;   // [Phase M4] 오만 L4 — HP 100% 매초 atk +0.5 (max +25)
    this._prideL4AtkAdded = 0;
    this._prideL4LastTickTime = 0;
    this._prideL5Active = false;   // [Phase M4] 오만 L5 — 웨이브 첫 공격 강제 치명
    this._prideL5UsedThisWave = false;
    this._envyL1Active = false;
    this._envyL3Active = false;    // [Phase M6] 질투 L3 — 강자 처치 시 atk +1 영구
    this._envyL4Active = false;    // [Phase M6] 질투 L4 — 적 HP 비율 비례 데미지
    this._envyL5Active = false;    // [Phase M6] 질투 L5 — 처치 시 accuracy +1% (max +30%)
    this._envyL5AccuracyAdded = 0;
    this._envyL3AtkAdded = 0;       // 신규 stat 누수 카운터 (sloth L3 / envy L3) 도 매 스테이지 리셋.
    this._slothL3MaxHpAdded = 0;
    this._lustL1Active = false;
    this._lustL3Active = false;    // [Phase M5] 색욕 L3 — 회피 시 5초 atk +20%
    this._lustL4Active = false;    // [Phase M5] 색욕 L4 — 회피 시 흡혈 +1% 영구 (max +20%)
    this._lustL4LifestealAdded = 0;
    this._lustL5Active = false;    // [Phase M5] 색욕 L5 — 회피 후 다음 공격 강제 치명
    this._lustL5NextCrit = false;
    this._gluttonyL1Active = false;
    this._gluttonyL1AtkAdded = 0;    // [Phase M7] 폭식 L1 누적 atk (max 50)
    this._gluttonyL3Active = false;  // [Phase M7] 폭식 L3 — 흡혈 발동 시 5초 atk ×1.20
    this._gluttonyL4Active = false;  // [Phase M7] 폭식 L4 — 회복 시 5초 maxHp +20
    this._gluttonyL4MaxHpActive = false;
    this._gluttonyL4MaxHpExpireAt = 0;
    this._gluttonyL5Active = false;  // [Phase M7] 폭식 L5 — 처치한 적의 atk × 0.05 흡수
    this._gluttonyL5AtkAbsorbed = 0;
    // 5. 누적 트래커 0
    this._synergyKillCount = 0;
    this._gluttonyLifestealAdded = 0;
    this._gluttonyL1LifestealAdded = 0;
    this._greed9PercentBonus = 0;
    this._greedPride_critDamageBonus = 0;
    this._synergyTempBuffs = [];
    this._synergyDodgeInvulnUntil = 0;
    this._synergyDodgeInvulnCooldown = 0;
    this._synergyOmanGuardCount = 0;
    this._synergyOmanLastTickTime = 0;
    this._synergyDamageReceivedLifesteal = 0;
    this._synergyDamageReceivedExpireAt = 0;
    this._naSe_lifestealAdded = 0;
    this._naPok_maxHpAdded = 0;
    this._sePok_dodgeAdded = 0;
    this._omanPok_atkAdded = 0;
    this._tamSe_dodgeAdded = 0;
    this._tamPok_goldGainMulAdded = 0;
    this._lastDamageTime = 0;
    // [Phase P-53] 6. 펫 정리 제거 — 펫 시스템 완전 폐기.
    // 7. 콤보/버프/가방/장비 초기화
    this.killStreakCount = 0;
    this.killStreakEndTime = 0;
    this.killBuffMult = 1;
    this.killBuffEndTime = 0;
    this.queuedBuffs = { attackPower: 0, attackSpeed: 0, damageReduction: 0 };
    this.activeBuffs = { attackPower: 0, attackSpeed: 0, damageReduction: 0 };
    this.pendingLevelUps = 0;
    this.invulnUntil = 0;
    this.bag = [];
    this.equipment = {
      head: null, accessory: null, body: null, shield: null,
      hands: null, arms: null, legs: null, feet: null,
    };
    // 8. 부가 플래그
    this.dodgeBuffActive = false;
    this.passiveAttackCount = 0;
    this.passiveInvulnReadyAt = 0;
    this.passiveSecondWindUsed = false;
    this.goldMultWaves = 0;
    this.nextCardChoices = 3;
    this.nextBossHpReduce = 0;
    this.nextBossFreezeMs = 0;
    this.nextCardPickRarityBoost = 0;
    // 매점 리롤 카운터 — 스테이지마다 4회 풀충전
    this._stageShopRerollsUsed = 0;
    // [Phase P-31] 카드 선택 리롤 카운터 — 스테이지마다 1회 풀충전.
    this._stageCardRerollsUsed = 0;
    // [Phase P-54] 기본 물약 쿨다운 — 스테이지 진입 시 초기화.
    this._potionCdRemainMs = 0;
    // 부적 EXP 배수 — 스테이지 사이 영속화 X (옛 _nextWaveExp* 폐기 + 신 _nextKillsExp*).
    this._nextWaveExpMul = null;
    this._nextWaveExpMulPending = null;
    this._nextKillsExpMul = 1;
    this._nextKillsExpRemain = 0;
    // [Phase P-54] 부적 영약화 — 스테이지 진입 시 1.0 리셋 (다음 스테이지에 효과 안 이월).
    this._stageExpMul = 1;
    // [Phase P-54] 시간 제한 버프 — 스테이지 이월 안 시킴, 모두 정리 (activeBuffs 도 새 스테이지에서 리셋됨).
    this._timedBuffs = [];
    console.log('[stage-reset] player state cleared');
  }

  // === 카드 적용 ===

  // 보유 카드 1장 교체 — 리롤권/등급업권 (Phase D) 가 사용.
  //   oldIdx: pickedCards 의 원본 인덱스 / newCard: 새로 적용할 원본 카드 객체.
  //   ⚠ 옛 카드의 stat 효과는 revert 함수가 없으면 누적됨 (단순화).
  //   bookkeeping: pickedCards / sinCounts / pickedCardOrder / _pickedCardIdsThisStage / 시너지.
  swapPickedCard(oldIdx, newCard) {
    if (!Array.isArray(this.pickedCards) || oldIdx < 0 || oldIdx >= this.pickedCards.length) return false;
    if (!newCard || typeof newCard.apply !== 'function') return false;
    const oldEntry = this.pickedCards[oldIdx];
    // 옛 카드 정확 revert: id 로 commonCards 에서 원본 lookup → revert(player) 호출.
    // revert 함수가 모든 modStat('cards', -delta) + flag false + tracker 0 처리.
    // id 매칭 — 이름 변경에도 안전 (옛 c.name 매칭은 rename 시 fragile).
    if (oldEntry && oldEntry.id) {
      const original = commonCards.find(c => c.id === oldEntry.id);
      if (original && typeof original.revert === 'function') {
        try { original.revert(this); }
        catch (err) { console.warn(`[swap] revert failed for ${oldEntry.id}`, err); }
      }
    }
    // 1. 옛 카드 제거 (bookkeeping)
    this.pickedCards.splice(oldIdx, 1);
    if (oldEntry && oldEntry.sin && this.sinCounts[oldEntry.sin] !== undefined) {
      this.sinCounts[oldEntry.sin] = Math.max(0, this.sinCounts[oldEntry.sin] - 1);
    }
    if (oldEntry && oldEntry.sin) {
      const oi = this.pickedCardOrder.lastIndexOf(oldEntry.sin);
      if (oi !== -1) this.pickedCardOrder.splice(oi, 1);
    }
    if (oldEntry && oldEntry.id && Array.isArray(this._pickedCardIdsThisStage)) {
      const ni = this._pickedCardIdsThisStage.lastIndexOf(oldEntry.id);
      if (ni !== -1) this._pickedCardIdsThisStage.splice(ni, 1);
    }
    // 시너지 재계산 (단계 변경 시 _applySynergyEffect 가 옛 효과 revert + 새 단계 effect)
    this._updateActiveSin();
    // 2. 새 카드 적용 — applyCard 가 pendingLevelUps -= 1 하므로 +1 보상
    this.pendingLevelUps += 1;
    this.applyCard(newCard);
    return true;
  }

  applyCard(card) {
    card.apply(this);  // 카드의 apply 함수에 플레이어 자신을 넘김
    this.pendingLevelUps -= 1;
    // 뽑은 카드 기록 (tier/rarity 호환 + sin 저장 + id 보존 — 세이브 마이그용)
    this.pickedCards.push({
      id: card.id,
      icon: card.icon,
      name: card.name,
      desc: card.desc,
      type: card.type || 'normal',
      tier: card.tier || card.rarity || 'normal',
      sin: card.sin || null,
    });
    // 죄 카운트 증가 + 픽 순서 기록 + 활성/2번째 죄/시너지 재계산
    if (card.sin && this.sinCounts[card.sin] !== undefined) {
      this.sinCounts[card.sin] += 1;
      this.pickedCardOrder.push(card.sin);
      this._updateActiveSin();
    }
    // 한 스테이지 안 동일 카드 중복 픽 방지 — 픽한 카드 name 기록
    if (card.id) this._pickedCardIdsThisStage.push(card.id);
    // 통계
    this.runStats.cardsPicked += 1;
    // [Phase P-54] 보유 카드 띠 (PickedCardsStrip) 갱신 알림
    if (this.scene && this.scene.events) this.scene.events.emit('cards-changed');
  }

  // 동률 시 마지막 픽 우선으로 1개 sin 결정.
  // candidates: 카운트 1위인 sin 후보들. count: 그 카운트.
  // pickedCardOrder 의 끝에서 거꾸로 훑어 candidates 안에서 가장 먼저 만나는 sin 반환.
  _resolveTieByLastPick(candidates) {
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const set = new Set(candidates);
    const order = this.pickedCardOrder || [];
    for (let i = order.length - 1; i >= 0; i--) {
      if (set.has(order[i])) return order[i];
    }
    return candidates[0];   // 폴백 — 픽 기록 없는 비정상 케이스
  }

  // 보유 카드 죄 카운트 → 1순위(activeSin) + 2순위(secondarySin) + synergyTier + dual.
  // 동률 시 마지막 픽 우선. 변경 발생 시 _applySynergyEffect 트리거.
  _updateActiveSin() {
    // 1순위 후보 — 카운트 최대값을 가진 sin 모두
    let max1 = 0;
    for (const s of SIN_LIST) {
      const c = this.sinCounts[s] || 0;
      if (c > max1) max1 = c;
    }
    const top1Cands = (max1 > 0)
      ? SIN_LIST.filter(s => (this.sinCounts[s] || 0) === max1)
      : [];
    const nextActive = this._resolveTieByLastPick(top1Cands);

    // 2순위 후보 — 1순위 제외 후 카운트 최대값
    let max2 = 0;
    if (nextActive) {
      for (const s of SIN_LIST) {
        if (s === nextActive) continue;
        const c = this.sinCounts[s] || 0;
        if (c > max2) max2 = c;
      }
    }
    const top2Cands = (max2 > 0)
      ? SIN_LIST.filter(s => s !== nextActive && (this.sinCounts[s] || 0) === max2)
      : [];
    const nextSecondary = this._resolveTieByLastPick(top2Cands);

    // 단일 시너지 단계 (3/6/9)
    const nextTier = nextActive ? getSynergyTier(max1) : 0;

    // 듀얼 활성 — 둘 다 ≥3장
    const nextDualActive = !!(nextActive && nextSecondary && isDualActive(max1, max2));
    const nextDualKey = nextDualActive ? getDualSinPair(nextActive, nextSecondary) : null;

    const changed = (nextActive    !== this.activeSin)
                 || (nextSecondary !== this.secondarySin)
                 || (nextTier      !== this.synergyTier)
                 || (nextDualActive!== this.dualActive)
                 || (nextDualKey   !== this.dualSinKey);

    if (changed) {
      this.activeSin    = nextActive;
      this.secondarySin = nextSecondary;
      this.synergyTier  = nextTier;
      this.dualActive   = nextDualActive;
      this.dualSinKey   = nextDualKey;
      this._applySynergyEffect();
    }
  }

  // 시너지 효과 적용 — diff 기반 apply/revert.
  // 단일 시너지 21개 (7죄 × 3단계) + 듀얼 시너지 21쌍 = 42 효과.
  // Phase 1: A타입 (단순 % 증폭) 만 실제 작동. B/C/D/E/F/G/H/I/J 타입은 Phase 2/3 placeholder.
  _applySynergyEffect() {
    // 1. sin-seal 디버프 (견습 마녀) — 모든 효과 revert + early return
    if (this._debuffOverrides && this._debuffOverrides.synergyDisabled) {
      this._revertAllSynergyEffects();
      console.log('[synergy] sin-seal active — all synergy disabled');
      return;
    }

    // 2. 목표 효과 ID 결정 (단일 + 듀얼)
    const targetEffectIds = [];
    if (this.activeSin && this.synergyTier > 0) {
      const sinKey = SIN_KEY[this.activeSin];
      if (sinKey) targetEffectIds.push(`${sinKey}_${this.synergyTier}`);
    }
    if (this.dualActive && this.dualSinKey) {
      targetEffectIds.push(this.dualSinKey);
    }

    // 3. 현재 적용된 효과 vs 목표 → diff
    const currentIds = this._appliedSynergyEffects.map(e => e.effectId);
    const toRevert = currentIds.filter(id => !targetEffectIds.includes(id));
    const toApply  = targetEffectIds.filter(id => !currentIds.includes(id));

    // 4. revert (이전 단계 / 사라진 듀얼)
    for (const id of toRevert) {
      const entry = this._appliedSynergyEffects.find(e => e.effectId === id);
      const effect = getSynergyEffect(id);
      if (effect && entry && typeof effect.revert === 'function') {
        try { effect.revert(this, entry.payload); }
        catch (err) { console.warn(`[synergy] revert failed: ${id}`, err); }
      }
      this._appliedSynergyEffects = this._appliedSynergyEffects.filter(e => e.effectId !== id);
    }

    // 5. apply (새 단계 / 새 듀얼)
    for (const id of toApply) {
      const effect = getSynergyEffect(id);
      if (effect && typeof effect.apply === 'function') {
        try {
          const payload = effect.apply(this) || {};
          this._appliedSynergyEffects.push({ effectId: id, payload });
        } catch (err) { console.warn(`[synergy] apply failed: ${id}`, err); }
      }
    }

    // 6. 콘솔 로그 — 변동 시점 확인용
    if (this.activeSin && this.synergyTier > 0) {
      console.log(`[synergy] ${SIN_NAMES[this.activeSin]}와의 계약 ${this.synergyTier}단계 발동`);
    }
    if (this.dualActive && this.dualSinKey) {
      console.log(`[dual] ${SIN_NAMES[this.activeSin]} + ${SIN_NAMES[this.secondarySin]} 듀얼 시너지 발동 (${this.dualSinKey})`);
    }
  }

  // === 동적 시너지 효과 게터 ===
  // 매 데미지 계산 시점 호출. 카드/A타입 누적분(stats.attackPower) 위에 동적 보너스 곱.
  // [Phase L] 옛 시너지 동적 효과 모두 제거. activeBuffs (휴식 상점) + Phase 3 임시 버프 후크만 보존.
  //           Phase N 신규 시너지 작성 시 _hasSynergyEffect 후크로 본 함수에 분기 추가.
  // targetEnemy: Phase N 신규 시너지가 적 HP 비교 조건 사용 시 활용. 현재는 미사용.
  getEffectiveAttackPower(targetEnemy = null) {
    let atk = this.getStat('attackPower');

    // activeBuffs (휴식 상점 임시 무기 강화) — 보존
    if (this.activeBuffs && this.activeBuffs.attackPower) {
      atk *= (1 + this.activeBuffs.attackPower);
    }

    // [Phase M1] 분노 L1 — HP 비율 반비례 atk (HP 0% 시 +50%)
    if (this._wrathL1Active) {
      const hpRatio = Math.max(0, this.stats.hp / this.getStat('maxHp'));
      atk *= (1 + (1 - hpRatio) * 0.50);
    }

    // [Phase M1] 분노 L4 — 콤보 5+ 시 atk ×1.30
    if (this._wrathL4Active && this.killStreakCount >= 5) {
      atk *= 1.30;
    }

    // [Phase P-54] 분노 트리거 — 콤보 폭발 (레어 4+ /+12%)
    if (this._wrathComboBuffRActive && this.killStreakCount >= 4) atk *= 1.12;

    // [Phase P-54] 분노 트리거 — 절체 (레어 HP 60%↓ /+18%)
    const hpRatioWrath = this.stats.hp / this.getStat('maxHp');
    if (this._wrathHpBuffRActive && hpRatioWrath <= 0.60) atk *= 1.18;

    // [Phase M2] 탐욕 L1 — 보유 골드 100당 atk +1
    if (this._greedL1Active) {
      atk += Math.floor((this.stats.gold || 0) / 100);
    }

    // [Phase M-B3] 탐욕 트리거 — 보유 골드 비례 atk (노말 0.5 / 레어 1)
    const goldHundreds = Math.floor((this.stats.gold || 0) / 100);
    if (goldHundreds > 0) {
      if (this._greedNormalGoldRatioActive) atk += goldHundreds * 0.5;
      if (this._greedRareGoldRatioActive)   atk += goldHundreds * 1;
    }

    // [Phase M2] 탐욕 L5 — 골드 차감 시 누적된 atk 보너스 (ShopModal 가 _greedL5AtkBonus 누적)
    if (this._greedL5Active && this._greedL5AtkBonus > 0) {
      atk += this._greedL5AtkBonus;
    }

    // [Phase M3] 나태 L1 — maxHp 100당 atk +1
    if (this._slothL1Active) {
      atk += Math.floor(this.getStat('maxHp') / 100);
    }

    // [Phase M-B4] 나태 트리거 — maxHp 비례 atk (노말 0.5 / 레어 1)
    const maxHpHundreds = Math.floor(this.getStat('maxHp') / 100);
    if (maxHpHundreds > 0) {
      if (this._slothNormalMaxHpAtkActive) atk += maxHpHundreds * 0.5;
      if (this._slothRareMaxHpAtkActive)   atk += maxHpHundreds * 1;
    }

    // [Phase M4] 오만 L1 — HP 100% + 5초 무피격 시 atk ×1.30
    if (this._prideL1Active && this._isPrideConditionActive()) {
      atk *= 1.30;
    }
    // [Phase M4] 오만 L4 — HP 100% 유지 시 매초 누적된 atk 보너스 (cards 슬롯 외 별도 추적)
    if (this._prideL4Active && this._prideL4AtkAdded > 0) {
      atk += this._prideL4AtkAdded;
    }

    // [Phase M-B5] 오만 트리거 — HP 100% 시 atk 보너스 (노말 +5% / 레어 +10%)
    if (this.stats.hp >= this.getStat('maxHp')) {
      if (this._prideNormalFullHpAtkActive) atk *= 1.05;
      if (this._prideRareFullHpAtkActive)   atk *= 1.10;
    }
    // [Phase M-B5] 오만 트리거 — HP 100% 매초 누적 atk (노말/레어 별도 트래커)
    if (this._prideNormalFullHpStackAdded > 0) atk += this._prideNormalFullHpStackAdded;
    if (this._prideRareFullHpStackAdded > 0)   atk += this._prideRareFullHpStackAdded;
    // [Phase M-B5] 오만 레어 — 5초 무피격 시 atk +15% (HP 조건 X)
    if (this._prideRareNoDmgActive) {
      const nowDmg = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
      if (!this._lastDamageTime || (nowDmg - this._lastDamageTime) >= 5000) {
        atk *= 1.15;
      }
    }

    // [Phase M6] 질투 L1 — 적 HP > 내 HP 시 atk ×1.30 (동적, targetEnemy 필수)
    if (this._envyL1Active && targetEnemy && (targetEnemy.hp || 0) > this.stats.hp) {
      atk *= 1.30;
    }
    // [Phase M6] 질투 L4 — 적 HP 비율 비례 atk (적 100% 시 +50%, 50% 시 +25%, 0% 시 +0%)
    if (this._envyL4Active && targetEnemy && targetEnemy.maxHp > 0) {
      const ratio = Math.max(0, Math.min(1, targetEnemy.hp / targetEnemy.maxHp));
      atk *= (1 + 0.5 * ratio);
    }

    // [Phase N1] 단일 시너지 동적 보너스 (sin-seal 디버프 시 무효)
    const synergyOK = !(this._debuffOverrides && this._debuffOverrides.synergyDisabled);
    if (synergyOK) {
      // 분노 9 — HP 비율 반비례 추가 atk (HP 0% 시 +20%, HP 100% 시 +0%)
      if (this._wrath9Active) {
        const hpRatio = Math.max(0, this.stats.hp / this.getStat('maxHp'));
        atk *= (1 + (1 - hpRatio) * 0.20);
      }
      // 탐욕 6 — 보유 골드 100당 atk +1
      if (this._greed6Active) {
        atk += Math.floor((this.stats.gold || 0) / 100);
      }
      // 탐욕 9 — 보유 골드 50당 atk +1 (6과 합산: 100당 +1, 50당 +1 = 100당 +3 효과)
      if (this._greed9Active) {
        atk += Math.floor((this.stats.gold || 0) / 50);
      }
      // 오만 3/6/9 — HP 100% + 5초 무피격 조건부 atk
      if (this._isPrideConditionActive()) {
        if (this._pride3Active) atk *= 1.15;
        if (this._pride6Active) atk *= 1.30;
        if (this._pride9Active) atk *= 1.50;
      }
      // 질투 3/6/9 — 적 HP > 내 HP 시 atk
      if (targetEnemy && (targetEnemy.hp || 0) > this.stats.hp) {
        if (this._envy3Active) atk *= 1.15;
        if (this._envy6Active) atk *= 1.25;
        if (this._envy9Active) atk *= 1.40;
      }

      // [Phase N2] 듀얼 시너지 동적 atk
      const hpRatioDual = this.stats.hp / this.getStat('maxHp');
      // 분노_나태 — HP 50%↓ atk +20%
      if (this._wrathSlothActive && hpRatioDual <= 0.50) atk *= 1.20;
      // 분노_오만 — HP 100% 또는 50%↓ atk +30%
      if (this._wrathPrideActive && (hpRatioDual >= 1.0 || hpRatioDual <= 0.50)) atk *= 1.30;
      // 분노_질투 — 적 HP > 내 HP atk +30%
      if (this._wrathEnvyActive && targetEnemy && (targetEnemy.hp || 0) > this.stats.hp) {
        atk *= 1.30;
      }
      // 오만_질투 — 조건 (HP 100% + 5초 무피격) + 적 HP > 내 HP atk ×1.50
      if (this._prideEnvyActive && this._isPrideConditionActive()
          && targetEnemy && (targetEnemy.hp || 0) > this.stats.hp) {
        atk *= 1.50;
      }
    }

    // [Phase M-B7] 질투 트리거 — 적 HP > 내 HP 시 atk (노말 +5% / 레어 +10%)
    if (targetEnemy && (targetEnemy.hp || 0) > this.stats.hp) {
      if (this._envyNormalStrongerActive)   atk *= 1.05;
      if (this._envyRareStrongerActive)     atk *= 1.10;
    }
    // [Phase M-B7] 질투 트리거 — 적 HP 100% 시 atk (노말 +10% / 레어 +20%)
    if (targetEnemy && targetEnemy.maxHp > 0 && targetEnemy.hp >= targetEnemy.maxHp) {
      if (this._envyNormalEnemyFullHpActive) atk *= 1.10;
      if (this._envyRareEnemyFullHpActive)   atk *= 1.20;
    }
    // [Phase M-B7] 강자/처치 누적 atk 는 onEnemyKilled 가 modStat('attackPower', 'cards', N) 직접 호출.
    //              cards 슬롯 자동 반영이라 별도 += 불필요. 트래커는 revert 정확용.

    // Phase 3 임시 버프 후크 (분노 L5 받피 +20% / Phase N 신규 시너지)
    if (this._synergyTempBuffs && this._synergyTempBuffs.length > 0) {
      const now = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
      for (const buff of this._synergyTempBuffs) {
        if (buff.expireAt > now && buff.type === 'atkMul') atk *= buff.value;
      }
    }

    return Math.max(1, Math.floor(atk));
  }

  // 시너지 효과 ID 가 현재 적용 중인지 (Phase 2 게터에서 빈번 조회)
  _hasSynergyEffect(effectId) {
    return this._appliedSynergyEffects.some(e => e.effectId === effectId);
  }

  // [Phase L 인프라] 7대죄 카드 모두 1장 이상 보유 — 만능 카드 등장 조건 (Phase M-B9).
  _hasAllSinCards() {
    return Object.values(SINS).every(sin => (this.sinCounts[sin] || 0) >= 1);
  }

  // [Phase M-B1] 만능 카드 등장 추첨 — _hasAllSinCards 가드 + 미보유 가드 + 5% 확률.
  // 카드픽 슬롯당 호출. 한 픽에서 만능 카드 1장 슬롯 차지 (다른 슬롯 일반 카드).
  // [Phase M-B9] 미보유 가드 — 한 게임당 1회만 등장 (이미 픽 시 0%).
  _shouldShowOmnipotent() {
    if (!this._hasAllSinCards()) return false;
    if (this.pickedCards && this.pickedCards.some(c => c.id === 'omnipotent_1')) return false;
    return Math.random() < 0.05;
  }

  // [Phase M2] 탐욕 L5 — 골드 차감 시 호출 (ShopModal). 차감량 × 0.01 만큼 atk 누적.
  // 매점 / 리롤 어디서든 골드를 소비할 때 호출.
  // [Phase M-B3] 노말/레어 누적 atk + 레어 변형 100G + 에픽 milestone 500G 분기.
  onGoldSpent(amount) {
    if (!amount || amount <= 0) return;
    // L5 — 1G당 atk +0.01 누적 (cap 없음)
    if (this._greedL5Active) {
      this._greedL5AtkBonus += amount * 0.01;
    }
    // 노말 — 차감량 × 0.005 만큼 atk 누적 (max +3)
    if (this._greedNormalSpendStackActive && this._greedNormalSpendStackAdded < 3) {
      const inc = Math.min(amount * 0.005, 3 - this._greedNormalSpendStackAdded);
      this.modStat('attackPower', 'cards', inc);
      this._greedNormalSpendStackAdded += inc;
    }
    // 레어 — 차감량 × 0.01 만큼 atk 누적 (max +5)
    if (this._greedRareSpendStackActive && this._greedRareSpendStackAdded < 5) {
      const inc = Math.min(amount * 0.01, 5 - this._greedRareSpendStackAdded);
      this.modStat('attackPower', 'cards', inc);
      this._greedRareSpendStackAdded += inc;
    }
    // 레어 변형 — 100G 누적 사용 시 1회성 atk +3 영구 (cards 슬롯)
    if (this._greedRareSpendOnceActive && !this._greedRareSpendOnceUsed) {
      this._greedRareSpendOnceCounter += amount;
      if (this._greedRareSpendOnceCounter >= 100) {
        this.modStat('attackPower', 'cards', 3);
        this._greedRareSpendOnceUsed = true;
      }
    }
  }

  // [Phase M-B3] 골드 획득 시 호출 — 레어 트리거 임시 atk buff (5초간 +5%, 만료시각 갱신).
  // CombatSystem.applyDamageToEnemy 의 처치 골드 지급 후 호출. 골드 획득 사이트 일원화 후크.
  // [Phase N2] 탐욕_색욕 듀얼 — 골드 획득 시 dodge +0.1% 영구 (max +20%, sin-seal 무효).
  onGoldGained(amount) {
    if (!amount || amount <= 0) return;
    if (this._greedRareGoldGainBuffActive) {
      const now = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
      this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== 'greed_gold_gain_R');
      this._synergyTempBuffs.push({
        effectId: 'greed_gold_gain_R', type: 'atkMul', value: 1.05, expireAt: now + 5000,
      });
    }
    // 탐욕_색욕 듀얼
    const synergyOK = !(this._debuffOverrides && this._debuffOverrides.synergyDisabled);
    if (synergyOK && this._greedLustActive && this._tamSe_dodgeAdded < 0.20) {
      this.modStat('dodge', 'synergy', 0.001);
      this._tamSe_dodgeAdded += 0.001;
    }
  }

  // 오만 시너지 조건 — HP 100% + 마지막 피격으로부터 5초 경과
  _isPrideConditionActive() {
    if (this.stats.hp < this.getStat('maxHp')) return false;
    const now = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
    if (!this._lastDamageTime) return true;   // 게임 시작 후 한 번도 안 맞음
    return (now - this._lastDamageTime) >= 5000;
  }

  // 치명타 확률 게터 — 데미지 계산 시 사용. [Phase M4] 오만 L1 조건부 보너스 +15%.
  getEffectiveCritChance() {
    let val = this.getStat('critChance');
    if (this._prideL1Active && this._isPrideConditionActive()) val += 0.15;
    // [Phase P-54] 분노 에픽 콤보 트리거 제거 (에픽 등급 폐기).
    // [Phase M-B3] 탐욕 트리거 — 보유 골드 100당 치명 +1% (노말) / +2% (레어)
    const goldHundredsCrit = Math.floor((this.stats.gold || 0) / 100);
    if (goldHundredsCrit > 0) {
      if (this._greedNormalCritGoldActive) val += goldHundredsCrit * 0.01;
      if (this._greedRareCritGoldActive)   val += goldHundredsCrit * 0.02;
    }
    // [Phase M-B5] 오만 노말 — 치명 적중 5초간 치명 +3% (트래커 만료시각)
    if (this._prideNormalCritBuffActive) {
      const nowCB = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
      if (nowCB < this._prideNormalCritBuffUntil) val += 0.03;
    }
    // [Phase N1] 오만 시너지 6/9 — HP 100% + 5초 무피격 조건부 치명 보너스
    const synergyOKCrit = !(this._debuffOverrides && this._debuffOverrides.synergyDisabled);
    if (synergyOKCrit && this._isPrideConditionActive()) {
      if (this._pride6Active) val += 0.10;
      if (this._pride9Active) val += 0.20;
    }
    return Math.max(0, Math.min(1, val));
  }

  // 치명타 피해 게터 — 데미지 계산 시 사용. [Phase M4] 오만 L1 조건부 보너스 +50%.
  getEffectiveCritDamage() {
    let val = this.getStat('critDamage');
    if (this._prideL1Active && this._isPrideConditionActive()) val += 0.50;
    // [Phase N1] 오만 시너지 9 — HP 100% + 5초 무피격 시 치명 피해 +50%
    const synergyOKCD = !(this._debuffOverrides && this._debuffOverrides.synergyDisabled);
    if (synergyOKCD && this._pride9Active && this._isPrideConditionActive()) {
      val += 0.50;
    }
    return Math.max(1.0, val);
  }

  // === 회피 트리거 (G타입 후크) ===
  // takeDamage 의 회피 분기에서 호출. [Phase M5] 색욕 L1/L3/L4/L5 후크.
  _onDodge() {
    if (this._debuffOverrides && this._debuffOverrides.synergyDisabled) return;
    const now = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();

    // [Phase M5] 색욕 L1 — 회피 시 사거리 90 안 적 1초 정지 (매혹)
    if (this._lustL1Active && this.scene && this.scene.combatSystem) {
      const range = 90;
      const enemies = this.scene.combatSystem.getAliveEnemies
        ? this.scene.combatSystem.getAliveEnemies()
        : (this.scene.combatSystem.enemies || []);
      for (const enemy of enemies) {
        if (!enemy || !enemy.sprite) continue;
        const dx = enemy.sprite.x - this.sprite.x;
        const dy = enemy.sprite.y - this.sprite.y;
        if (dx * dx + dy * dy <= range * range) {
          enemy._stunUntil = Math.max(enemy._stunUntil || 0, now + 1000);
        }
      }
    }

    // [Phase M5] 색욕 L3 — 회피 시 5초간 atk ×1.20 (만료 시각 갱신)
    if (this._lustL3Active) {
      this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== 'lust_L3');
      this._synergyTempBuffs.push({
        effectId: 'lust_L3', type: 'atkMul', value: 1.20, expireAt: now + 5000,
      });
    }

    // [Phase M5] 색욕 L4 — 회피 시 흡혈 +1% 영구 (max +20%)
    if (this._lustL4Active && this._lustL4LifestealAdded < 0.20) {
      this.modStat('lifesteal', 'cards', 0.01);
      this._lustL4LifestealAdded += 0.01;
    }

    // [Phase M5] 색욕 L5 — 회피 후 다음 공격 강제 치명 (1회성, Player.attack 이 소비)
    if (this._lustL5Active) {
      this._lustL5NextCrit = true;
    }

    // [Phase M-B6] 색욕 트리거 — 회피 시 stun 사거리 90 (노말 0.5s / 레어 0.7s)
    if (this._lustNormalShortStunActive || this._lustRareLongStunActive) {
      const range = 90;
      const enemies = (this.scene && this.scene.combatSystem && this.scene.combatSystem.getAliveEnemies)
        ? this.scene.combatSystem.getAliveEnemies()
        : [];
      let stunDur = 0;
      if (this._lustNormalShortStunActive) stunDur = Math.max(stunDur, 500);
      if (this._lustRareLongStunActive)    stunDur = Math.max(stunDur, 700);
      const expireAt = now + stunDur;
      for (const enemy of enemies) {
        if (!enemy || !enemy.sprite) continue;
        const dx = enemy.sprite.x - this.sprite.x;
        const dy = enemy.sprite.y - this.sprite.y;
        if (dx * dx + dy * dy <= range * range) {
          enemy._stunUntil = Math.max(enemy._stunUntil || 0, expireAt);
        }
      }
    }

    // [Phase M-B6] 색욕 트리거 — 회피 시 임시 atk buff (노말 +5%/3s / 레어 +10%/4s)
    const dodgeAtkTriggers = [
      { active: this._lustNormalAtkBuffActive, id: 'lust_dodge_atk_N', val: 1.05, dur: 3000 },
      { active: this._lustRareAtkBuffActive,   id: 'lust_dodge_atk_R', val: 1.10, dur: 4000 },
    ];
    for (const t of dodgeAtkTriggers) {
      if (!t.active) continue;
      this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== t.id);
      this._synergyTempBuffs.push({ effectId: t.id, type: 'atkMul', value: t.val, expireAt: now + t.dur });
    }

    // [Phase M-B6] 색욕 트리거 — 회피 시 흡혈 누적 영구 (노말 0.5% max 5% / 레어 1% max 10%)
    if (this._lustNormalLifestealStackActive && this._lustNormalLifestealStackAdded < 0.05) {
      const inc = Math.min(0.005, 0.05 - this._lustNormalLifestealStackAdded);
      this.modStat('lifesteal', 'cards', inc);
      this._lustNormalLifestealStackAdded += inc;
    }
    if (this._lustRareLifestealStackActive && this._lustRareLifestealStackAdded < 0.10) {
      const inc = Math.min(0.01, 0.10 - this._lustRareLifestealStackAdded);
      this.modStat('lifesteal', 'cards', inc);
      this._lustRareLifestealStackAdded += inc;
    }

    // [Phase M-B6] 색욕 노말 — 회피 후 다음 공격 atk +20% (1회성, Player.attack 소비)
    if (this._lustNormalNextAtkBuffActive) {
      this._lustNormalNextAtkPending = true;
    }
    // [Phase M-B6] 색욕 레어 — 회피 후 다음 공격 강제 치명 (1회성)
    if (this._lustRareForcedCritActive) {
      this._lustRareForcedCritPending = true;
    }

    // [Phase M-B6] 색욕 레어 — 회피 시 5초 dodge +5% (활성 상태 추적, 만료시각 갱신)
    if (this._lustRareDodgeBuffActive) {
      if (!this._lustRareDodgeBuffApplied) {
        this.modStat('dodge', 'cards', 0.05);
        this._lustRareDodgeBuffApplied = true;
      }
      this._lustRareDodgeBuffUntil = now + 5000;
    }

    // [Phase M-B6] 색욕 레어 변형 — 회피 누적 5회 도달 시 1회성 흡혈 +10% 영구
    if (this._lustRareDodgeMilestoneActive && !this._lustRareDodgeMilestoneUsed) {
      this._lustRareDodgeMilestoneCount += 1;
      if (this._lustRareDodgeMilestoneCount >= 5) {
        this.modStat('lifesteal', 'cards', 0.10);
        this._lustRareDodgeMilestoneUsed = true;
      }
    }

    // [Phase N2] 듀얼 시너지 — 회피 트리거
    // 분노_색욕 — 회피 시 5초간 atk +10% (_synergyTempBuffs push, 만료시각 갱신)
    if (this._wrathLustActive) {
      this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.effectId !== 'wrath_lust_dual');
      this._synergyTempBuffs.push({
        effectId: 'wrath_lust_dual', type: 'atkMul', value: 1.10, expireAt: now + 5000,
      });
    }
    // 나태_색욕 — 회피 시 흡혈 +0.5% 영구 (max +10%)
    if (this._slothLustActive && this._naSe_lifestealAdded < 0.10) {
      this.modStat('lifesteal', 'synergy', 0.005);
      this._naSe_lifestealAdded += 0.005;
    }
    // 오만_색욕 — 회피 시 1초 무적 (5초 쿨)
    if (this._prideLustActive) {
      if (now >= this._synergyDodgeInvulnCooldown) {
        this._synergyDodgeInvulnUntil = now + 1000;
        this._synergyDodgeInvulnCooldown = now + 5000;
        this.invulnUntil = Math.max(this.invulnUntil || 0, now + 1000);
      }
    }
  }

  // === 매 프레임 시간 트리거 (I타입) + 임시 버프 만료 ===
  // GameScene.update 가 매 프레임 호출.
  // [Phase L] 옛 시간 누적 효과 (탐욕 9 / 탐욕_오만 / 분노_색욕 만료 / 나태_오만 가드) 모두 제거.
  // 임시 버프 만료 + Phase N 후크만 보존.
  _updateSynergyTriggers(now) {
    // 임시 버프 만료 (sin-seal 무관 — 만료 처리는 항상)
    if (this._synergyTempBuffs && this._synergyTempBuffs.length > 0) {
      this._synergyTempBuffs = this._synergyTempBuffs.filter(b => b.expireAt > now);
    }

    // [Phase M3] 나태 L5 — HP 50%↓ 시 매초 maxHp × 5% 회복
    if (this._slothL5Active && this.stats.hp > 0) {
      const maxHp = this.getStat('maxHp');
      if (this.stats.hp / maxHp <= 0.5 && now - this._slothL5LastTickTime >= 1000) {
        const healAmount = Math.floor(maxHp * 0.05);
        this.stats.hp = Math.min(maxHp, this.stats.hp + healAmount);
        this._slothL5LastTickTime = now;
      }
    }

    // [Phase M-B4] 나태 레어 — HP 50%↓ 시 매초 maxHp × 2% 회복 (L5 약화)
    if (this._slothRareLowHpHealActive && this.stats.hp > 0) {
      const maxHpR = this.getStat('maxHp');
      if (this.stats.hp / maxHpR <= 0.5 && now - this._slothRareLowHpLastTickTime >= 1000) {
        const healAmount = Math.floor(maxHpR * 0.02);
        this.stats.hp = Math.min(maxHpR, this.stats.hp + healAmount);
        this._slothRareLowHpLastTickTime = now;
      }
    }
    // [Phase M-B4] 나태 레어 변형 — maxHp 200 도달 시 1회성 흡혈 +5% 영구
    if (this._slothRareMaxHpMilestoneActive && !this._slothRareMaxHpMilestoneUsed
        && this.getStat('maxHp') >= 200) {
      this.modStat('lifesteal', 'cards', 0.05);
      this._slothRareMaxHpMilestoneUsed = true;
    }
    // [Phase M-B4] 나태 노말 — LowHpDR 임시 buff 만료 처리 (활성 → 비활성 전환 시 -5% 회수)
    if (this._slothNormalLowHpDRBuffUntil > 0 && now >= this._slothNormalLowHpDRBuffUntil) {
      this.modStat('damageReduction', 'cards', -0.05);
      this._slothNormalLowHpDRBuffUntil = 0;
    }

    // [Phase M4] 오만 L4 — HP 100% 유지 시 매초 atk +0.5 (max +25). 트래커에 누적 (피격 시 takeDamage 가 0 리셋).
    if (this._prideL4Active && this.stats.hp >= this.getStat('maxHp') && this._prideL4AtkAdded < 25) {
      if (now - this._prideL4LastTickTime >= 1000) {
        this._prideL4AtkAdded = Math.min(25, this._prideL4AtkAdded + 0.5);
        this._prideL4LastTickTime = now;
      }
    }

    // [Phase M-B5] 오만 트리거 — HP 100% 매초 atk 누적 (노말/레어/에픽 별도 트래커, getEffectiveAttackPower add)
    const fullHp = this.stats.hp >= this.getStat('maxHp');
    if (this._prideNormalFullHpStackActive && fullHp && this._prideNormalFullHpStackAdded < 5
        && now - this._prideNormalFullHpLastTickTime >= 1000) {
      this._prideNormalFullHpStackAdded = Math.min(5, this._prideNormalFullHpStackAdded + 0.1);
      this._prideNormalFullHpLastTickTime = now;
    }
    if (this._prideRareFullHpStackActive && fullHp && this._prideRareFullHpStackAdded < 15
        && now - this._prideRareFullHpLastTickTime >= 1000) {
      this._prideRareFullHpStackAdded = Math.min(15, this._prideRareFullHpStackAdded + 0.3);
      this._prideRareFullHpLastTickTime = now;
    }
    // [Phase M-B6] 색욕 레어 — dodge buff 만료 회수 (활성 상태였으면 -0.05)
    if (this._lustRareDodgeBuffApplied && now >= this._lustRareDodgeBuffUntil) {
      this.modStat('dodge', 'cards', -0.05);
      this._lustRareDodgeBuffApplied = false;
      this._lustRareDodgeBuffUntil = 0;
    }

    // [Phase M-B5] 오만 레어 변형 — 5초 무피격 도달 시 1회성 5초 무적 (웨이브당 1회)
    if (this._prideRareInvulnActive && !this._prideRareInvulnUsed) {
      const noDmgFor5s = !this._lastDamageTime || (now - this._lastDamageTime) >= 5000;
      if (noDmgFor5s) {
        this.invulnUntil = Math.max(this.invulnUntil || 0, now + 5000);
        this._prideRareInvulnUsed = true;
      }
    }

    // [Phase M7] 폭식 L4 — 임시 maxHp +20 만료 처리 (회복 후 5초)
    if (this._gluttonyL4MaxHpActive && now >= this._gluttonyL4MaxHpExpireAt) {
      this.modStat('maxHp', 'cards', -20);
      this._gluttonyL4MaxHpActive = false;
      this._gluttonyL4MaxHpExpireAt = 0;
      // hp cap 재조정 (maxHp 줄어들었으니)
      if (this.stats.hp > this.getStat('maxHp')) this.stats.hp = this.getStat('maxHp');
    }
    // [Phase M-B8] 폭식 트리거 — 회복 maxHp buff 만료 (노말 +5 / 레어 +15)
    if (this._gluttonyNormalHealMaxHpApplied && now >= this._gluttonyNormalHealMaxHpExpireAt) {
      this.modStat('maxHp', 'cards', -5);
      this._gluttonyNormalHealMaxHpApplied = false;
      this._gluttonyNormalHealMaxHpExpireAt = 0;
      if (this.stats.hp > this.getStat('maxHp')) this.stats.hp = this.getStat('maxHp');
    }
    if (this._gluttonyRareHealMaxHpApplied && now >= this._gluttonyRareHealMaxHpExpireAt) {
      this.modStat('maxHp', 'cards', -15);
      this._gluttonyRareHealMaxHpApplied = false;
      this._gluttonyRareHealMaxHpExpireAt = 0;
      if (this.stats.hp > this.getStat('maxHp')) this.stats.hp = this.getStat('maxHp');
    }

    // [Phase N2] 듀얼 시너지 시간 트리거
    const synergyOKUpd = !(this._debuffOverrides && this._debuffOverrides.synergyDisabled);
    if (synergyOKUpd) {
      // 나태_오만 — HP 100% 유지 시 매초 피감 +1% (max +10%). HP 미달 시 누적 0 리셋.
      if (this._slothPrideActive) {
        const fullHp = this.stats.hp >= this.getStat('maxHp');
        if (fullHp) {
          if (now - this._synergyOmanLastTickTime >= 1000 && this._synergyOmanGuardCount < 10) {
            this.modStat('damageReduction', 'synergy', 0.01);
            this._synergyOmanGuardCount += 1;
            this._synergyOmanLastTickTime = now;
          }
        } else if (this._synergyOmanGuardCount > 0) {
          this.modStat('damageReduction', 'synergy', -(this._synergyOmanGuardCount * 0.01));
          this._synergyOmanGuardCount = 0;
          this._synergyOmanLastTickTime = 0;
        }
      }
      // 분노_색욕 — 받피 누적 흡혈 만료 5초 후 회수
      if (this._wrathLustActive
          && this._synergyDamageReceivedExpireAt > 0
          && now > this._synergyDamageReceivedExpireAt
          && this._synergyDamageReceivedLifesteal > 0) {
        this.modStat('lifesteal', 'synergy', -this._synergyDamageReceivedLifesteal);
        this._synergyDamageReceivedLifesteal = 0;
        this._synergyDamageReceivedExpireAt = 0;
      }
    }
  }

  // [Phase P-53] _trySpawnPet 함수 통째 제거 — 펫 시스템 완전 폐기.
  //   색욕 시너지 effect (lust_3/6/9) 의 다른 효과는 synergyEffects.js 본체에 그대로 보존.

  // sin-seal 디버프 발동 시 — 모든 적용 효과 revert (디버프 해제 시 _applySynergyEffect 가 다시 apply).
  _revertAllSynergyEffects() {
    // 1. 등록된 시너지 effect 의 revert 호출 — modStat('synergy') 로 누적분 회수.
    for (const entry of this._appliedSynergyEffects) {
      const effect = getSynergyEffect(entry.effectId);
      if (effect && typeof effect.revert === 'function') {
        try { effect.revert(this, entry.payload); }
        catch (err) { console.warn(`[synergy] revertAll failed: ${entry.effectId}`, err); }
      }
    }
    this._appliedSynergyEffects = [];

    // 2. Phase E3 — 동적 누적 효과 (legendary L1, 처치 카운터, 시간 누적 등) 의 synergy 보너스도 회수.
    //   sin-seal 룰: 단발성 / 한 스테이지 안 누적. 디버프 발동 시 모든 synergy 보너스 회수.
    //   _statSources 의 synergy 슬롯을 0 으로 리셋. flat stats 에는 회수된 누적분만큼 차감.
    if (this._statSources) {
      for (const key of Object.keys(this._statSources)) {
        const synergyAccum = this._statSources[key].synergy || 0;
        if (synergyAccum !== 0) {
          this.stats[key] = (this.stats[key] || 0) - synergyAccum;
        }
        this._statSources[key].synergy = 0;
      }
    }

    // 3. 동적 누적 트래커 변수 리셋 — 다시 활성 시 0 부터 누적 시작.
    this._gluttonyL1LifestealAdded = 0;
    this._greed9PercentBonus       = 0;
    this._greedPride_critDamageBonus = 0;
    this._naSe_lifestealAdded      = 0;
    this._naPok_maxHpAdded         = 0;
    this._sePok_dodgeAdded         = 0;
    this._omanPok_atkAdded         = 0;
    this._tamSe_dodgeAdded         = 0;
    this._tamPok_goldGainMulAdded  = 0;
    this._synergyDamageReceivedLifesteal = 0;
    this._synergyDamageReceivedExpireAt  = 0;
    this._synergyOmanGuardCount    = 0;
    this._synergyOmanLastTickTime  = 0;
    this._synergyTempBuffs         = [];
    this._synergyKillCount         = 0;
    // Phase E5 — 옛 runtime 안전망 클램프 제거 (getStat 가 cap 처리).
  }

  // === HP 바 갱신 (매 프레임) ===
  // 플레이어가 움직이므로 바 위치도 sprite을 따라가야 함
  updateHpDisplay() {
    if (!this.hpBar || !this.hpBar.active) return;
    const barW = this.hpBarMaxWidth;
    const fullW = barW + 2;   // 외곽 포함 너비
    const barY = this.sprite.y - 30 - 8;
    const leftX = this.sprite.x - fullW / 2;

    if (this.hpBarShadow) { this.hpBarShadow.x = leftX + 1; this.hpBarShadow.y = barY + 1; }
    this.hpBarBg.x = leftX;
    this.hpBarBg.y = barY;
    this.hpBar.x   = leftX + 1;
    this.hpBar.y   = barY;
    if (this.hpBarHL) { this.hpBarHL.x = leftX + 1; this.hpBarHL.y = barY - 1; }
    this.hpText.x  = this.sprite.x;
    this.hpText.y  = barY - 11;

    const ratio = Math.max(0, this.stats.hp / this.getStat('maxHp'));
    this.hpBar.width = barW * ratio;
    if (this.hpBarHL) this.hpBarHL.width = barW * ratio;
    // 색상 — 상단 HUD HP바와 통일 (빨강 톤)
    this.hpBar.fillColor = 0xC5404A;

    this.hpText.setText(`${Math.max(0, Math.floor(this.stats.hp))}/${this.getStat('maxHp')}`);
  }

  // === 위치 ===

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
}