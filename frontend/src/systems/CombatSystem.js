// 전투 시스템
// 플레이어와 적 사이의 전투 로직을 담당합니다
// - 가장 가까운 적 찾기
// - 사거리 안인지 판단
// - 공격 실행 및 데미지 적용
// - 광역 공격 처리

import Phaser from 'phaser';
import { sound } from './SoundManager.js';
import { addDiamonds } from '../data/diamonds.js';

// [Phase K] 이속 폐기 — engagementDelay 고정값 800ms (모든 엔티티 동일).
const BASE_ENGAGEMENT_DELAY = 800;
function engagementDelay() {
  return BASE_ENGAGEMENT_DELAY;
}

export default class CombatSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.enemies = []; // 현재 전투 중인 적 목록 (WaveSystem이 채워줌)
  }

  // 적 목록 갱신 (WaveSystem이 적 등장시킬 때 호출)
  setEnemies(enemies) {
    this.enemies = enemies;
  }

  // 살아있는 적만 반환
  getAliveEnemies() {
    return this.enemies.filter(e => e.isActive());
  }

  // 가장 가까운 살아있는 적 찾기
  getNearestEnemy() {
    const alive = this.getAliveEnemies();
    if (alive.length === 0) return null;

    let nearest = null;
    let nearestDist = Infinity;
    for (const enemy of alive) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        enemy.x, enemy.y
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }
    return { enemy: nearest, distance: nearestDist };
  }

  // 매 프레임마다 호출되는 메인 업데이트
  update(time, delta) {
    const aliveEnemies = this.getAliveEnemies();

    // 살아있는 적이 없으면 → 전투 종료
    if (aliveEnemies.length === 0) {
      this.player.stop();
      return { combatEnded: true };
    }

    // 가장 가까운 적 찾기
    const result = this.getNearestEnemy();
    if (!result) return { combatEnded: false };

    const { enemy: nearest, distance } = result;

    // [Phase K + 무한 맵] 플레이어 사거리 + 적 sprite 반경 — 큰 보스도 sprite 겹침 회피.
    const effectiveRange = this.player.getStat('attackRange') + (nearest.size || 0) / 2;
    // 사거리 안 → 공격, 사거리 밖 → 전진
    if (distance <= effectiveRange) {
      this.player.stop();
      // 첫 진입 시각 기록
      if (this.player.engagedAt === null) {
        this.player.engagedAt = time;
      }
      // 진입 후 일정 시간 지났을 때부터 공격 가능 (이속 ↑ → 딜레이 ↓)
      const playerDelay = engagementDelay();
      if (time - this.player.engagedAt >= playerDelay && this.player.canAttack(time)) {
        // 보스 디버프 — 어둠 사도 명중 -30% (빗나감 처리)
        const accuracyReduction = (this.player._debuffOverrides && this.player._debuffOverrides.accuracyReduction) || 0;
        if (accuracyReduction > 0 && Math.random() < accuracyReduction) {
          // 빗나감 — 공격 쿨타임만 소비, 데미지 안 적용
          this.player.lastAttackTime = time;
          this.showDamageText(this.player.x + 30, this.player.y - 30, 'MISS', '#888888');
        } else {
          this.executePlayerAttack(time, nearest);
        }
      }
    } else {
      this.player.moveForward();
      this.player.engagedAt = null;   // 사거리 벗어나면 리셋
    }

    // 적의 반격 처리
    const playerDied = this.processEnemyAttacks(time);
    if (playerDied) {
      return { combatEnded: true, playerDied: true };
    }

    return { combatEnded: false };
  }

  // 사거리 안에 있는 적이 플레이어 공격 (각자 쿨타임 별도)
  // 반환: 플레이어 사망 여부
  processEnemyAttacks(time) {
    const aliveEnemies = this.getAliveEnemies();
    for (const enemy of aliveEnemies) {
      // HP 바를 매 프레임 따라가게 갱신
      enemy.updateHpDisplay();

      // 결빙 (부적) / 매혹 stun (색욕 L1) — 정지 + 공격 불가
      if ((enemy.frozenUntil && time < enemy.frozenUntil)
          || (enemy._stunUntil && time < enemy._stunUntil)) {
        enemy.stopMoving();
        enemy.engagedAt = null;
        continue;
      }

      // [Phase P-53] 펫 AI 블록 제거 — 펫 시스템 완전 폐기.

      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        enemy.x, enemy.y
      );
      // [Phase P-44d + 무한 맵] 적 사거리 + 적 sprite 반경 + 플레이어 sprite 반경 (~30) 가산.
      //   큰 보스 (size 144 등) 도 적 본인 sprite 겹침 X.
      const enemyEffectiveRange = enemy.attackRange + (enemy.size || 0) / 2 + 30;
      if (dist <= enemyEffectiveRange) {
        if (enemy.engagedAt === null) enemy.engagedAt = time;
      } else {
        enemy.engagedAt = null;
        enemy.updateHpDisplay();
        continue;
      }
      enemy.updateHpDisplay();  // 정지 중에도 위치 동기화 (사거리 진입 후 이동 잔재 방지)
      // 진입 후 일정 시간 + 자기 공격 쿨타임 OK 면 공격 (이속 ↑ → 딜레이 ↓)
      if (time - enemy.engagedAt < engagementDelay()) continue;
      if (enemy.canAttack(time)) {
        // 플레이어 stun 중이면 적도 공격 통과는 하지만 효과 동일 (방어 못 함은 별도)
        let damage = enemy.attack(time);
        // 보스 디버프 — outgoingDamageMul (검투사 ×1.3) / playerTakenDamageMul
        if (enemy._debuffBuffs && enemy._debuffBuffs.outgoingDamageMul) {
          damage = Math.floor(damage * enemy._debuffBuffs.outgoingDamageMul);
        }
        if (this.player._debuffOverrides && this.player._debuffOverrides.playerTakenDamageMul) {
          damage = Math.floor(damage * this.player._debuffOverrides.playerTakenDamageMul);
        }
        const result = this.player.takeDamage(damage, { sourceEnemy: enemy });
        // result = { dodged, damage }

        // 보스 적중 시 디버프 트리거 (거미줄/독/흡혈)
        if (!result.dodged && enemy.type === 'boss' && this.scene.bossDebuffSystem) {
          this.scene.bossDebuffSystem.onBossHit(enemy, result.damage);
        }

        if (result.dodged) {
          // 무적 일격 패시브 발동 표시 / 그 외엔 MISS 로 통일
          const label = result.passive === 'invuln-strike' ? '⚡무적' : 'MISS';
          this.showDamageText(this.player.x, this.player.y - 30, label, '#aaffaa');
        } else {
          sound.playerHit();
          this.showDamageText(this.player.x, this.player.y - 30, result.damage, '#ff5555');
          // 통계 — 받은 데미지
          this.player.runStats.damageTaken += result.damage;

          // 가시 반사 패시브 — 받은 데미지의 30% 를 적에게 반사
          if (this.player.hasPassive('damage-reflect')) {
            const reflectDmg = Math.max(1, Math.floor(result.damage * 0.3));
            const reflect = enemy.takeDamage(reflectDmg);
            this.showDamageText(enemy.x, enemy.y - 20, reflectDmg, '#88aaff');
            if (reflect.killed) {
              sound.enemyDeath();
              this.player.gainExp(enemy.expReward);
              this.player.onEnemyKilled();
            }
          }

          // 반격 — 30% 확률로 받은 데미지 ×2 반사
          if (this.player.skills.counterAttack && Math.random() < 0.3) {
            const counterDmg = result.damage * 2;
            const counter = enemy.takeDamage(counterDmg);
            this.showDamageText(enemy.x, enemy.y - 20, counterDmg, '#ff88ff');
            if (counter.killed) {
              sound.enemyDeath();
              this.player.gainExp(enemy.expReward);
              this.player.onEnemyKilled();
            } else {
              sound.enemyHit();
            }
          }
        }

        // 플레이어 사망 → 게임오버 신호
        if (this.player.isDead()) {
          this.scene.events.emit('game-over');
          return true;
        }
      }
    }
    return false;
  }

  // 💎 다이아 획득 — localStorage 저장 + 화면 토스트 (1초)
  _awardDiamonds(amount, reason) {
    addDiamonds(amount, reason);
    // 토스트 — 화면 가운데 위쪽, 시안 색
    // [Phase P-19] cx 480 → 동적 (캔버스 1280 가운데 = 640).
    const cx = (this.scene.scale && this.scene.scale.width || 1280) / 2;
    // [Phase P-50b] 다이아 토스트 — 화면 고정.
    const toast = this.scene.add.text(cx, 90, `다이아 +${amount}`, {
      fontFamily: '"Pretendard Variable","Pretendard",sans-serif',
      fontSize: '30px', color: '#FFD166', fontStyle: '800',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(900).setScrollFactor(0);
    toast.setShadow(0, 0, '#FFD166', 12, true, true);
    this.scene.tweens.add({
      targets: toast, y: 60, alpha: 0, duration: 1000, ease: 'Cubic.easeOut',
      onComplete: () => toast.destroy(),
    });
  }

  // 데미지 숫자 띄우기 (위로 떠올랐다가 사라짐)
  showDamageText(x, y, value, color = '#ffffff') {
    const text = this.scene.add.text(x, y, `${value}`, {
      fontSize: '25px',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    let _backupTimer = null;
    const safeDestroy = () => {
      if (_backupTimer) { _backupTimer.remove(false); _backupTimer = null; }
      if (text && text.scene && text.active) text.destroy();
    };

    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: safeDestroy,
      onStop: safeDestroy,  // 트윈이 외부에서 killed 될 때도 정리
    });

    // 백업 — 트윈이 어떤 사유든 onComplete/onStop 둘 다 못 부르면 1.2s 후 강제 정리.
    // 핸들 저장 → safeDestroy 가 호출되면 timer 도 cancel (orphan 누적 방지).
    _backupTimer = this.scene.time.delayedCall(1200, safeDestroy);
  }

  // 플레이어 공격 실행
  executePlayerAttack(time, primaryTarget) {
    // Phase 2 시너지 (질투/분노_질투/오만_질투) — 동적 D타입 효과용 targetEnemy 전달
    const result = this.player.attack(time, primaryTarget);
    // result = { damage, isCrit, isAreaAttack, areaRange }
    sound.playerAttack();

    // 폭발 일격 패시브 — 매 5번째 공격은 광역 (50% 스플래시)
    if (this.player.hasPassive('explosive-strike')) {
      this.player.passiveAttackCount = (this.player.passiveAttackCount || 0) + 1;
      if (this.player.passiveAttackCount % 5 === 0) {
        result.isAreaAttack = true;
        result.areaRange = Math.max(result.areaRange || 0, this.player.getStat('attackRange') + 60);
        result.splashRatio = Math.max(result.splashRatio || 0, 0.5);
      }
    }

    if (result.isAreaAttack) {
      // 광역 공격: 주 타겟은 풀 데미지, 주변은 splashRatio 만큼
      // (splashRatio는 player.skills.splashRatio + 시너지 카드 보정)
      const splashRatio = result.splashRatio;
      const aliveEnemies = this.getAliveEnemies();
      for (const enemy of aliveEnemies) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          enemy.x, enemy.y
        );
        if (dist <= result.areaRange) {
          const dmg = (enemy === primaryTarget)
            ? result.damage
            : Math.max(1, Math.floor(result.damage * splashRatio));
          this.applyDamageToEnemy(enemy, dmg, result.isCrit);
        }
      }
    } else {
      // 단일 공격
      this.applyDamageToEnemy(primaryTarget, result.damage, result.isCrit);
    }

    // 연쇄 번개 패시브 — 20% 확률, 다른 적 1명에게 60% 데미지
    if (this.player.hasPassive('lightning-strike') && Math.random() < 0.2) {
      const others = this.getAliveEnemies().filter(e => e !== primaryTarget);
      if (others.length > 0) {
        const target2 = others[Math.floor(Math.random() * others.length)];
        const dmg2 = Math.max(1, Math.floor(result.damage * 0.6));
        this._chainTriggered = true;       // 연쇄 적용 중에는 chain-strike 같은 재귀 차단
        this.applyDamageToEnemy(target2, dmg2, false);
        this._chainTriggered = false;
      }
    }
  }

  // 적에게 데미지 적용
  applyDamageToEnemy(enemy, damage, isCrit) {
    // 선제 타격 패시브 — 새로운 적의 첫 일격은 데미지 ×2
    if (this.player.hasPassive('first-strike') && !enemy._hitByPlayer) {
      damage *= 2;
    }
    enemy._hitByPlayer = true;

    // 수확자 패시브 — HP 20% 미만 적에게 ×1.5
    if (this.player.hasPassive('harvester') && enemy.maxHp && enemy.hp / enemy.maxHp < 0.20) {
      damage = Math.floor(damage * 1.5);
    }

    // 처형자 패시브 — 잡몹 HP 8% 이하면 즉사 (보스 제외)
    if (this.player.hasPassive('executioner') && enemy.type !== 'boss' && enemy.type !== 'subboss'
        && enemy.maxHp && enemy.hp / enemy.maxHp <= 0.08) {
      damage = Math.max(damage, enemy.hp);
    }

    // 보스 디버프 — 받는 데미지 감소 (드워프왕 ×0.6) / 치명 무효 (드워프왕)
    if (enemy._debuffBuffs) {
      if (enemy._debuffBuffs.damageReduction) {
        damage = Math.floor(damage * (1 - enemy._debuffBuffs.damageReduction));
      }
      if (enemy._debuffBuffs.critImmune && isCrit) {
        // 치명타 보너스 무효 — base damage / 실제 critDamage (오만 L1 조건부 보너스 포함) 로 환산
        const critDmg = this.player.getEffectiveCritDamage
          ? this.player.getEffectiveCritDamage()
          : (this.player.getStat('critDamage') || 1);
        damage = Math.floor(damage / Math.max(1, critDmg));
      }
    }

    // 플레이어 명중률 보정 — accuracy 1.0 초과분만 회피 무효화, 1.0 미만은 회피 추가
    let accuracy = this.player.getStat('accuracy') || 1.0;
    // [Phase M-B7] 질투 레어 — 적 HP > 내 HP 시 명중 +20% (동적)
    if (this.player._envyRareStrongerAccBuffActive && (enemy.hp || 0) > this.player.stats.hp) {
      accuracy += 0.20;
    }
    const accuracyMod = {
      bonus:   Math.max(0, accuracy - 1.0),
      penalty: Math.max(0, 1.0 - accuracy),
    };
    // Phase 3 — 처치 직전 hp 보존 (강자 처치 트리거 / 질투 9 / 질투_폭식 용)
    const hpBeforeKill = enemy.hp;
    const result = enemy.takeDamage(Math.floor(damage), accuracyMod);

    // 보스 HP 변경 후 디버프 임계값 체크 (회피 마스터 / 광폭화)
    if (!result.dodged && enemy.type === 'boss' && this.scene.bossDebuffSystem) {
      this.scene.bossDebuffSystem.onBossHpChange(enemy);
    }
    // result = { dodged, damage, killed }

    // 데미지 숫자 표시
    if (result.dodged) {
      this.showDamageText(enemy.x, enemy.y - 20, 'MISS', '#cccccc');
    } else {
      const color = isCrit ? '#ffff00' : '#ffffff';
      this.showDamageText(enemy.x, enemy.y - 20, result.damage, color);
    }

    // 통계 — 입힌 데미지
    if (!result.dodged) {
      this.player.runStats.damageDealt += result.damage;
    }

    // 타격 흡혈 패시브 — 입힌 데미지의 5% HP 회복
    if (!result.dodged && this.player.hasPassive('vampiric-strike')) {
      const heal = Math.max(1, Math.floor(result.damage * 0.05));
      this.player.stats.hp = Math.min(this.player.getStat('maxHp'), this.player.stats.hp + heal);
    }

    if (result.killed) {
      // 적 처치 → 경험치 + 골드 + 흡혈
      sound.enemyDeath();
      this.player.gainExp(enemy.expReward);
      // 황금의 부적 — 다음 N웨이브 골드 ×2 (임시 버프)
      const goldMult = (this.player.goldMultWaves > 0) ? 2 : 1;
      // 영구 골드 배수 — 탐욕 카드용 (goldGainMul, 1.0 기본).
      // [Phase N2] 탐욕_오만 듀얼 — HP 100% goldGainMul +50% 는 getStat 가 동적 가산 (자동 반영).
      const permanentMul = this.player.getStat('goldGainMul') || 1.0;
      const goldGain = Math.floor((enemy.goldReward || 0) * goldMult * permanentMul);
      this.player.stats.gold += goldGain;
      this.player.runStats.goldEarned += goldGain;
      if (goldGain) {
        this.showDamageText(enemy.x, enemy.y - 35, `+${goldGain} 💰`, '#FFC857');
        if (this.player.onGoldGained) this.player.onGoldGained(goldGain);   // [Phase M-B3/N2] 골드 획득 후크
      }
      // [Phase N2] 듀얼 시너지 — 처치 골드 트리거 (sin-seal 시 비활성)
      const synergyOK = !(this.player._debuffOverrides && this.player._debuffOverrides.synergyDisabled);
      if (synergyOK) {
        // 탐욕_질투 — 적 보유 골드 50% 추가 획득 (강자 +10G 는 onEnemyKilled 가 처리)
        if (this.player._greedEnvyActive) {
          const bonus = Math.floor((enemy.goldReward || 0) * 0.50);
          if (bonus > 0) {
            this.player.stats.gold += bonus;
            this.player.runStats.goldEarned += bonus;
            if (this.player.onGoldGained) this.player.onGoldGained(bonus);
          }
        }
      }
      // 통계 — 처치 (보스 / 잡몹 분리)
      if (enemy.type === 'boss') {
        this.player.runStats.bossesKilled += 1;
        // 보스 디버프 정리 (스탯 복원 + 배너 + 어둠 오버레이 + 분열 트리거)
        if (this.scene.bossDebuffSystem) this.scene.bossDebuffSystem.onBossDeath(enemy);
        // [P-61] 보스 처치 다이아 보상 제거 — 도전과제 시스템으로 대체 예정.
      } else if (enemy.type === 'subboss') {
        this.player.runStats.enemiesKilled += 1;
        // [P-61] 서브보스 다이아 보상 제거.
      } else {
        this.player.runStats.enemiesKilled += 1;
      }

      this.player.onEnemyKilled(enemy, hpBeforeKill);
    } else if (!result.dodged) {
      sound.enemyHit();
    }

    // 치명타였으면 잠시 노란색으로 (피격 색 덮어쓰기)
    if (isCrit && !result.dodged && enemy.isActive()) {
      enemy.flashColor(0xffff00);
      // 흡혈 의식 시너지 — 치명타 시 흡혈 절반만큼 추가 회복
      if (this.player.onCritHit) this.player.onCritHit(result.damage);
      // 치명 폭주 패시브 — 5초간 공속 +20%
      if (this.player.hasPassive('crit-frenzy')) {
        const now = this.scene.time.now;
        this.player.passiveCritFrenzyEndTime = now + 5000;
      }
      // [Phase M4] 오만 L3 — 치명타 적중 시 1초 무적 (기존 invulnUntil 와 max 누적)
      if (this.player._prideL3Active) {
        const now = this.scene.time.now;
        this.player.invulnUntil = Math.max(this.player.invulnUntil || 0, now + 1000);
      }
      // [Phase M-B5] 오만 트리거 — 치명 적중 시 invuln (노말 0.3s / 레어 0.5s / 에픽 1s)
      const nowCrit = this.scene.time.now;
      if (this.player._prideNormalCritInvulnActive) {
        this.player.invulnUntil = Math.max(this.player.invulnUntil || 0, nowCrit + 300);
      }
      if (this.player._prideRareCritInvulnActive) {
        this.player.invulnUntil = Math.max(this.player.invulnUntil || 0, nowCrit + 500);
      }
      // [Phase M-B5] 오만 노말 — 치명 적중 시 5초간 치명 +3% (만료시각 갱신)
      if (this.player._prideNormalCritBuffActive) {
        this.player._prideNormalCritBuffUntil = nowCrit + 5000;
      }
      // [Phase M-B5] 오만 레어 — 치명 적중 시 5초간 atk +10% (_synergyTempBuffs push)
      if (this.player._prideRareCritAtkBuffActive) {
        this.player._synergyTempBuffs = this.player._synergyTempBuffs.filter(b => b.effectId !== 'pride_crit_atk_R');
        this.player._synergyTempBuffs.push({
          effectId: 'pride_crit_atk_R', type: 'atkMul', value: 1.10, expireAt: nowCrit + 5000,
        });
      }
      // 오만 레전드 — 치명 적중 시 다음 공격 강제 치명 (pride_legend_8 재활용)
      if (this.player._prideEpicNextCritActive) {
        this.player._prideEpicNextCritPending = true;
      }
    }

    // 연속 베기 패시브 — 처치 시 30% 확률로 즉시 한 번 더 공격
    if (result.killed && !this._chainStrikeFiring && !this._chainTriggered
        && this.player.hasPassive('chain-strike') && Math.random() < 0.3) {
      const next = this.getNearestEnemy();
      if (next && next.enemy && next.enemy !== enemy) {
        this._chainStrikeFiring = true;
        this.applyDamageToEnemy(next.enemy, damage, isCrit);
        this._chainStrikeFiring = false;
      }
    }
  }
}