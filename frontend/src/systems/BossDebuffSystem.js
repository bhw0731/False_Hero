// 보스 디버프 시스템 — 16 보스가 각자 다른 디버프 보유.
// 트리거 5종: onWaveStart / onHit / onBossHpThreshold / interval / onBossDeath
//
// 사용 흐름:
//   constructor(scene, player) — GameScene.create 에서 1회
//   onBossSpawn(boss)           WaveSystem.spawnBoss/spawnSubBoss 후 호출
//   onBossDeath(boss)           Enemy.die 또는 CombatSystem 처치 시
//   onBossHit(boss, damage)     보스 → 플레이어 공격 적중 시
//   onBossHpChange(boss)        보스 HP 변경 후 (CombatSystem 데미지 적용 후)
//   update(dt)                  매 프레임 (interval 트리거 + DoT/stun 카운트다운)
//
// 효과 적용 위치 — Player 객체에 _debuff* 필드 누적, CombatSystem 이 calc 시 참조:
//   _debuffStunMs        공격/이동 정지 카운트다운 (ms)
//   _debuffDots          [{ percent, remaining, tickAccum }]  DoT 큐
//   _debuffOverrides     스탯 오버라이드 — 보스 처치 시 자동 정리
//     dodgeOverride / moveSpeedOverride / defenseMul / attackSpeedMul
//     accuracyReduction / rangeMul / damageMul / critImmune
//     healingDisabled / synergyDisabled
// 보스 객체에 _debuffBuffs 필드:
//   damageReduction / dodge / attackMul / attackSpeedMul / lifestealRatio

import { addText } from '../ui/theme.js';

const FONT = '"Pretendard Variable","Pretendard",sans-serif';

export default class BossDebuffSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.activeCtx = null;       // 현재 활성 보스 디버프 컨텍스트 (보스 1개당 1개)
    this._darkOverlay = null;
    this._bannerEls = [];
    this._intimidateText = null; // 두목 위압 카운트다운 텍스트
  }

  // 보스 등장 시 — WaveSystem 에서 호출
  onBossSpawn(boss) {
    if (!boss || !boss.debuff) return;
    // 옛 ctx 의 DOT/stun 잔존 방지 — 새 보스 진입 시 이전 효과 강제 해제.
    if (this.activeCtx && this.activeCtx.boss !== boss) {
      this._restoreEffect(this.activeCtx);
    }
    const d = boss.debuff;
    const ctx = {
      debuff: d,
      boss,
      thresholdFired: false,
      intervalAccumMs: 0,
      nextIntervalMs: this._rollInterval(d),
      activeWindow: null,         // interval 트리거의 일시 효과 윈도우
      bannerStartTime: this.scene.time.now,
    };
    this.activeCtx = ctx;
    this._showBanner(d);

    // 즉시 발동 트리거
    if (d.trigger === 'onWaveStart') {
      this._applyEffect(ctx);
      // paladin: 5초 후 자동 해제 (durationMs 가 있는 경우)
      if (d.triggerData && d.triggerData.durationMs) {
        this.scene.time.delayedCall(d.triggerData.durationMs, () => {
          if (this.activeCtx === ctx) this._restoreEffect(ctx);
        });
      }
    }
  }

  // 보스 처치 시 — Enemy.die 또는 CombatSystem 에서 호출
  // 분열 자식(_splitDepth)은 activeCtx 무관하게 직접 boss.debuff 검사 (자식의 자식까지 작동).
  onBossDeath(boss) {
    // 분열 트리거 — boss.debuff 가 onBossDeath 면 activeCtx 무관하게 처리
    if (boss && boss.debuff && boss.debuff.trigger === 'onBossDeath') {
      this._handleSplit({ boss, debuff: boss.debuff });
    }
    if (this.activeCtx && this.activeCtx.boss === boss) {
      this._restoreEffect(this.activeCtx);
      this._clearBanner();
      this._clearDarkOverlay();
      if (this._intimidateText) { this._intimidateText.destroy(); this._intimidateText = null; }
      this.activeCtx = null;
    }
  }

  // 보스 → 플레이어 공격 적중 시 — CombatSystem 에서 호출
  onBossHit(boss, damageDealt) {
    const ctx = this.activeCtx;
    if (!ctx || ctx.boss !== boss || ctx.debuff.trigger !== 'onHit') return;
    const e = ctx.debuff.effect;
    if (e.stunMs) {
      this.player._debuffStunMs = Math.max(this.player._debuffStunMs || 0, e.stunMs);
    }
    if (e.dotPercent) {
      if (!this.player._debuffDots) this.player._debuffDots = [];
      this.player._debuffDots.push({
        percent: e.dotPercent, remaining: e.dotDurationMs, tickAccum: 0,
      });
    }
    if (e.bossLifestealRatio) {
      const heal = Math.floor(damageDealt * e.bossLifestealRatio);
      boss.hp = Math.min(boss.maxHp, boss.hp + heal);
      if (boss.updateHpDisplay) boss.updateHpDisplay();
    }
  }

  // 보스 HP 변경 후 — CombatSystem 에서 호출
  onBossHpChange(boss) {
    const ctx = this.activeCtx;
    if (!ctx || ctx.boss !== boss || ctx.debuff.trigger !== 'onBossHpThreshold') return;
    const ratio = boss.hp / Math.max(1, boss.maxHp);
    const threshold = ctx.debuff.triggerData.hpThreshold;
    // 히스테리시스 — threshold +5% 이상으로 회복하면 다시 트리거 가능 (heal 후 재발동 보장).
    if (ctx.thresholdFired) {
      if (ratio > threshold + 0.05) ctx.thresholdFired = false;
      return;
    }
    if (ratio <= threshold) {
      ctx.thresholdFired = true;
      this._applyEffect(ctx);
    }
  }

  // 매 프레임 — interval 트리거 + DoT/stun 카운트다운
  update(dt) {
    // Stun 카운트다운
    if (this.player._debuffStunMs > 0) {
      this.player._debuffStunMs = Math.max(0, this.player._debuffStunMs - dt);
    }
    // DoT 처리 (1초마다 percent% 감소)
    if (this.player._debuffDots && this.player._debuffDots.length > 0) {
      const stillActive = [];
      for (const dot of this.player._debuffDots) {
        dot.tickAccum += dt;
        dot.remaining -= dt;
        while (dot.tickAccum >= 1000) {
          dot.tickAccum -= 1000;
          const dmg = Math.max(1, Math.floor(this.player.getStat('maxHp') * dot.percent / 100));
          this.player.stats.hp = Math.max(0, this.player.stats.hp - dmg);
        }
        if (dot.remaining > 0) stillActive.push(dot);
      }
      this.player._debuffDots = stillActive;
    }
    // 두목 위압 — 활성 윈도우 카운트다운
    const ctx = this.activeCtx;
    if (!ctx || !ctx.boss.active) return;
    const d = ctx.debuff;
    if (d.trigger === 'interval') {
      ctx.intervalAccumMs += dt;
      // 위압 활성 윈도우 해제 체크 (durationMs 경과)
      if (ctx.activeWindow) {
        ctx.activeWindow.remaining -= dt;
        if (this._intimidateText && ctx.activeWindow.remaining > 0) {
          this._intimidateText.setText(`💢 ${(ctx.activeWindow.remaining / 1000).toFixed(1)}s`);
          // [Phase P-19] boss sprite fallback 480,270 → 1045,300 (옵션 C 보스 좌표).
          this._intimidateText.x = ctx.boss.sprite ? ctx.boss.sprite.x : 1045;
          this._intimidateText.y = (ctx.boss.sprite ? ctx.boss.sprite.y : 300) - 80;
        }
        if (ctx.activeWindow.remaining <= 0) {
          // 윈도우 종료 — 효과 해제
          this._restoreEffect(ctx);
          ctx.activeWindow = null;
          if (this._intimidateText) { this._intimidateText.destroy(); this._intimidateText = null; }
        }
      }
      // 다음 발동 시점 도달
      if (!ctx.activeWindow && ctx.intervalAccumMs >= ctx.nextIntervalMs) {
        ctx.intervalAccumMs = 0;
        ctx.nextIntervalMs = this._rollInterval(d);
        this._fireInterval(ctx);
      }
    }
  }

  _rollInterval(d) {
    const td = d.triggerData || {};
    if (td.intervalMs) return td.intervalMs;
    if (td.intervalMinMs && td.intervalMaxMs) {
      return td.intervalMinMs + Math.random() * (td.intervalMaxMs - td.intervalMinMs);
    }
    return 5000;
  }

  // === 효과 적용 ===
  _applyEffect(ctx) {
    const e = ctx.debuff.effect;
    const p = this.player;
    if (!p._debuffOverrides) p._debuffOverrides = {};
    const O = p._debuffOverrides;

    // 플레이어 스탯 오버라이드
    if (e.dodgeOverride !== undefined) O.dodgeOverride = e.dodgeOverride;
    if (e.moveSpeedOverride !== undefined) O.moveSpeedOverride = e.moveSpeedOverride;
    if (e.defenseReduction) O.defenseMul = 1 - e.defenseReduction;
    if (e.playerAttackSpeedMul) O.attackSpeedMul = e.playerAttackSpeedMul;
    if (e.accuracyReduction) O.accuracyReduction = e.accuracyReduction;
    if (e.playerRangeMul) O.rangeMul = e.playerRangeMul;
    if (e.playerDamageMul) O.playerTakenDamageMul = e.playerDamageMul;
    if (e.critImmune) O.critImmune = true;
    if (e.healingDisabled) O.healingDisabled = true;
    if (e.synergyDisabled) {
      O.synergyDisabled = true;
      // sin-seal 적용 — 시너지 효과 재계산 (A-type stat 보너스 deactivate).
      if (typeof p._applySynergyEffect === 'function') p._applySynergyEffect();
    }

    // 보스 자체 강화
    const boss = ctx.boss;
    if (!boss._debuffBuffs) boss._debuffBuffs = {};
    const B = boss._debuffBuffs;
    if (e.damageReduction) B.damageReduction = e.damageReduction;
    if (e.bossDodge) B.dodge = e.bossDodge;
    if (e.bossAttackMul) B.attackMul = e.bossAttackMul;
    if (e.bossAttackSpeedMul) B.attackSpeedMul = e.bossAttackSpeedMul;
    if (e.bossDamageMul) B.outgoingDamageMul = e.bossDamageMul;

    // 거인족 — sprite 크기 변경 + HP 배수
    // [무한 맵] WaveSystem._applyBossSizeDebuff 가 spawn 직후 sprite 만 미리 적용 → 시각 갑작 변형 회피.
    //   여기선 boss._sizeDebuffApplied 가드 — 이미 적용된 경우 skip.
    if (e.spriteScale && boss.sprite && !boss._sizeDebuffApplied) {
      ctx.originalSpriteSize = boss.size;
      boss.size = boss.size * e.spriteScale;
      if (boss.sprite.setDisplaySize) {
        boss.sprite.setDisplaySize(boss.size, boss.size);
      }
    } else if (e.spriteScale && boss._sizeDebuffApplied) {
      // restore 위해 ctx 에 originalSpriteSize 만 기록.
      ctx.originalSpriteSize = boss._originalSize || (boss.size / e.spriteScale);
    }
    if (e.hpMul) {
      ctx.originalMaxHp = boss.maxHp;
      ctx.originalHp = boss.hp;
      boss.maxHp = Math.floor(boss.maxHp * e.hpMul);
      boss.hp = Math.floor(boss.hp * e.hpMul);
      if (boss.updateHpDisplay) boss.updateHpDisplay();
    }

    // 어둠 사도 — 화면 어둡게
    if (e.screenDarken) {
      this._showDarkOverlay(e.screenDarken);
    }
  }

  // === 효과 복원 ===
  // Phase G — 보스 사망 시 즉시 해제. DOT/stun/오버라이드 모두 클리어.
  _restoreEffect(ctx) {
    const p = this.player;
    const hadSynergyDisabled = !!(p._debuffOverrides && p._debuffOverrides.synergyDisabled);
    if (p._debuffOverrides) p._debuffOverrides = {};
    // sin-seal 해제 — 시너지 효과 재apply (A-type stat 보너스 reactivate).
    if (hadSynergyDisabled && typeof p._applySynergyEffect === 'function') p._applySynergyEffect();
    // 시간 누적 디버프 강제 종료 (DOT 큐 / stun 카운트다운 모두 0)
    p._debuffStunMs = 0;
    p._debuffDots = [];
    const boss = ctx.boss;
    if (boss && boss._debuffBuffs) boss._debuffBuffs = {};
    // 거인족 복원 (분열 자식에는 안 함)
    if (ctx.originalSpriteSize !== undefined && boss && boss.sprite) {
      boss.size = ctx.originalSpriteSize;
      if (boss.sprite.setDisplaySize) boss.sprite.setDisplaySize(boss.size, boss.size);
    }
    // 어둠 오버레이 정리
    this._clearDarkOverlay();
  }

  // === Interval 트리거 발동 ===
  _fireInterval(ctx) {
    const d = ctx.debuff;
    // 쥐떼 소환
    if (d.id === 'summon-rats') {
      this._spawnRats(d.effect.spawnCount);
      return;
    }
    // 두목 위압 — 일시 효과 + 카운트다운 UI
    if (d.id === 'intimidate') {
      this._applyEffect(ctx);
      ctx.activeWindow = { remaining: d.triggerData.durationMs };
      // 카운트다운 텍스트
      const boss = ctx.boss;
      // [Phase P-19] boss sprite fallback 480,270 → 1045,300.
      const x = boss.sprite ? boss.sprite.x : 1045;
      const y = (boss.sprite ? boss.sprite.y : 300) - 80;
      this._intimidateText = addText(this.scene, x, y, `💢 ${(d.triggerData.durationMs / 1000).toFixed(1)}s`, {
        fontFamily: FONT, fontSize: '22px', color: '#FF6B35', fontStyle: '700',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(80);
    }
  }

  // 쥐떼 소환 (2 쥐떼왕) — WaveSystem.spawnExtra 사용
  _spawnRats(count) {
    const wave = this.scene && this.scene.waveSystem;
    if (!wave || !wave.spawnExtra) return;
    const boss = this.activeCtx && this.activeCtx.boss;
    // [Phase P-19] fallback 750 → 965 (boss x 1045 - 80, 옵션 C).
    const x = (boss && boss.sprite) ? boss.sprite.x - 80 : 965;
    wave.spawnExtra('rat', count, { x, y: 446, sizeMul: 0.7, hpMul: 0.5, attackMul: 0.6 });
  }

  // === 분열 (1 거대 슬라임) — 보스 사망 시 자식 생성, 자식도 처치 시 또 분열 (depth 2까지) ===
  _handleSplit(ctx) {
    const wave = this.scene && this.scene.waveSystem;
    if (!wave || !wave.spawnExtra) return;
    const boss = ctx.boss;
    const e = ctx.debuff.effect;
    // splitDepth 누적 추적 — 첫 분열은 effect.splitDepth=2, 자식은 부모 splitDepth - 1
    const remaining = (boss._splitDepth !== undefined) ? boss._splitDepth : e.splitDepth;
    if (remaining <= 0) return;
    const sizeMul = e.sizeMul || 0.6;
    const hpMul = e.hpMul || 0.5;
    // [Phase P-19] fallback 850 → 1010 (boss x 1045 근처, 옵션 C).
    const cx = (boss.sprite && boss.sprite.x) || 1010;
    const cy = (boss.sprite && boss.sprite.y) || 446;
    // 좌/우 2개 자식 생성 — 슬라임 sprite, 줄어든 크기/HP
    const children = wave.spawnExtra('slime', 2, {
      x: cx, y: cy,
      sizeMul: Math.pow(sizeMul, 3 - remaining),    // 1단계: 0.6, 2단계: 0.36
      hpMul: Math.pow(hpMul, 3 - remaining),
    });
    // 자식에게 분열 트리거 transitive 적용 (depth - 1)
    for (const child of children) {
      child._splitDepth = remaining - 1;
      if (remaining - 1 > 0) {
        child.debuff = boss.debuff;   // 자식도 분열 보유
        child.type = 'boss';          // 보스 사망 후 onBossDeath 트리거 위해
      }
    }
  }

  // === 배너 UI ===
  // [Phase P-19] cx 480 → 동적 (캔버스 1280 가운데 = 640). 배너 폭 400, bg X 280→440.
  _showBanner(debuff) {
    this._clearBanner();
    const scene = this.scene;
    const bannerY = 110;
    const cx = (scene.scale && scene.scale.width || 1280) / 2;
    const bgW = 400;
    const bgX = cx - bgW / 2;
    // [Phase P-50b] 보스 디버프 배너 — 화면 고정.
    const bg = scene.add.graphics().setDepth(890).setScrollFactor(0);
    // [글래스 톤] 보스 디버프 배너 — 검정 + 흰 외곽 + 빨강 외곽 이중
    bg.fillStyle(0x000000, 0.65);
    bg.fillRoundedRect(bgX, bannerY - 28, bgW, 56, 8);
    bg.lineStyle(1, 0xFFFFFF, 0.20);
    bg.strokeRoundedRect(bgX, bannerY - 28, bgW, 56, 8);
    bg.lineStyle(1.5, 0xDC2626, 0.85);
    bg.strokeRoundedRect(bgX, bannerY - 28, bgW, 56, 8);
    const nameTxt = addText(scene, cx, bannerY - 9, '⚠ 보스 디버프', {
      fontFamily: FONT, fontSize: '21px', color: '#FF6B35', fontStyle: '800',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(891).setScrollFactor(0);
    const descTxt = addText(scene, cx, bannerY + 10, debuff.desc, {
      fontFamily: FONT, fontSize: '15px', color: '#E8E8E8', fontStyle: '500',
      align: 'center', wordWrap: { width: 380 },
    }).setOrigin(0.5).setDepth(891).setScrollFactor(0);
    this._bannerEls = [bg, nameTxt, descTxt];
    // 4초 후 페이드아웃
    scene.tweens.add({
      targets: [bg, nameTxt, descTxt], alpha: 0, duration: 600, delay: 3400,
      onComplete: () => this._clearBanner(),
    });
  }

  _clearBanner() {
    this._bannerEls.forEach(e => e && e.destroy && e.destroy());
    this._bannerEls = [];
  }

  // === 화면 어둡게 (16 어둠 사도) ===
  _showDarkOverlay(alpha) {
    this._clearDarkOverlay();
    // [Phase P-7b] 캔버스 1280×600 — 동적 크기 조회 (전체 덮기)
    const W = this.scene.scale.width, H = this.scene.scale.height;
    // [Phase P-50b] 다크 오버레이 — 화면 전체 고정.
    this._darkOverlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, alpha).setDepth(50).setScrollFactor(0);
  }

  _clearDarkOverlay() {
    if (this._darkOverlay) { this._darkOverlay.destroy(); this._darkOverlay = null; }
  }
}
