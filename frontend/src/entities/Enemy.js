// 적(몬스터) 클래스
// 적의 생김새, 능력치, 피격, 죽음 처리를 관리합니다

import Phaser from 'phaser';

export default class Enemy {
  constructor(scene, x, y, config = {}) {
    this.scene = scene;

    // 기본 능력치 (config로 덮어쓰기 가능)
    // [Phase K] defense / moveSpeed 폐기 — defense=0 고정, moveSpeed=100 고정 (잡몹/보스/플레이어 동일).
    //           attackRange 는 적별 다양성 보존 (config 값 사용).
    this.maxHp = config.maxHp || 30;
    this.hp = this.maxHp;
    this.attackPower = config.attackPower || 5;
    this.attackRange = config.attackRange || 60;
    this.attackSpeed = config.attackSpeed || 1500;  // ms
    this.moveSpeed = 100;                            // [Phase K] 고정값
    this.expReward = config.expReward || 15;
    this.goldReward = config.goldReward || 5;        // 처치 시 지급 골드
    this.dodgeChance = config.dodgeChance || 0;     // 회피율
    this.defense = 0;                                // [Phase K] 폐기 — takeDamage 무시
    this.color = config.color || 0x800080;          // 기본 보라색
    this.size = config.size || 40;
    this.type = config.type || 'normal';            // 'normal' | 'boss'
    // [Phase P-53] 펫 시스템 완전 제거 — _isPet 플래그 폐기.
    this.id = config.id || null;                    // 'slime' / 'rat' 등 — split / summon-rats 디버프 등에 사용

    // 생김새 — config로 textureKey 직접 지정 가능 (보스/서브보스가 PNG별로 다름)
    let textureKey = config.textureKey;
    if (!textureKey) {
      if (this.type === 'boss')         textureKey = 'boss';
      else if (this.type === 'subboss') textureKey = 'subboss';
      else                              textureKey = 'enemy';
    }

    if (scene.textures.exists(textureKey)) {
      this.sprite = scene.physics.add.sprite(x, y, textureKey);
      this.sprite.setDisplaySize(this.size, this.size);
      this.sprite.setFlipX(true);                   // 적은 플레이어 향해 (왼쪽).
      this._isSpriteImage = true;
    } else {
      this.sprite = scene.add.rectangle(x, y, this.size, this.size, this.color);
      scene.physics.add.existing(this.sprite);
      this._isSpriteImage = false;
    }

    // HP 바 (적 머리 위)
    const barW = this.size;
    const barH = 5;
    const barY = y - this.size / 2 - 8;
    this.hpBarBg = scene.add.rectangle(x - barW / 2, barY, barW, barH, 0x6A2025);
    this.hpBarBg.setOrigin(0, 0.5);
    this.hpBarBg.setStrokeStyle(1, 0x4A4A50, 0.5);
    this.hpBar = scene.add.rectangle(x - barW / 2, barY, barW, barH, 0xC5404A);
    this.hpBar.setOrigin(0, 0.5);
    this.hpBarMaxWidth = barW;

    // HP 숫자 — 모든 적 표시. 9px + 검정 stroke 로 어두운 배경에서도 가독.
    // 잡몹은 빽빽이 늘어서지만 폰트 작아 텍스트 끼리 겹침 최소화.
    const isBossish = (this.type === 'boss' || this.type === 'subboss');
    this.hpText = scene.add.text(x, barY - 2, `${this.hp}/${this.maxHp}`, {
      fontSize: isBossish ? '11px' : '9px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: isBossish ? 2 : 1,
      fontStyle: isBossish ? 'bold' : '500',
    }).setOrigin(0.5, 1);  // bottom anchor — HP 바 바로 위 정렬

    // [Phase P-30] 일반 잡몹은 생성 시 HP 바 hidden — updateHpDisplay 가 첫 피격 시 표시.
    //   옛 동작: 생성 시 visible:true 로 박혀 있어 풀 HP 인 적도 잠깐 노출 (데브 모드 2스 진입
    //            직후 7마리 풀 노출 보고 사례).
    //   보스/서브보스는 항상 표시 — 옛 룰 (updateHpDisplay 의 isBossish 분기) 그대로.
    if (!isBossish) {
      this.hpBarBg.setVisible(false);
      this.hpBar.setVisible(false);
      this.hpText.setVisible(false);
    }

    // 내부 상태
    this.lastAttackTime = 0;
    this.engagedAt = null;        // 플레이어가 사거리 안에 들어온 시각
    this.active = true;
    // [Phase M5] 색욕 L1 매혹 stun — 회피 시 사거리 안 적 1초 정지. 0 = 비활성.
    this._stunUntil = 0;
    // [Phase M-B6] 색욕 에픽 변형 2 — 회피 시 적 atk -50% 시간 한정. 0 = 비활성.
    this._atkDebuffUntil = 0;
  }

  // HP 표시 갱신 — 매 프레임 (적이 움직이므로 위치도 따라가야 함)
  updateHpDisplay() {
    if (!this.sprite || !this.sprite.active) return;
    const barW = this.hpBarMaxWidth;
    const barY = this.sprite.y - this.size / 2 - 8;

    // 일반 잡몹은 풀 HP 일 때 바 숨김 (시각 노이즈 제거). 보스/서브보스는 항상 표시.
    const isBossish = (this.type === 'boss' || this.type === 'subboss');
    const showBar = isBossish || this.hp < this.maxHp;

    if (this.hpBarBg && this.hpBarBg.active) {
      this.hpBarBg.setVisible(showBar);
      this.hpBarBg.x = this.sprite.x - barW / 2;
      this.hpBarBg.y = barY;
    }
    if (this.hpBar && this.hpBar.active) {
      this.hpBar.setVisible(showBar);
      this.hpBar.x = this.sprite.x - barW / 2;
      this.hpBar.y = barY;
      const ratio = Math.max(0, this.hp / this.maxHp);
      this.hpBar.width = barW * ratio;
      this.hpBar.fillColor = 0xC5404A;
    }
    if (this.hpText && this.hpText.active) {
      this.hpText.setVisible(showBar);  // HP 바와 동일한 가시성 (풀 HP 잡몹 숨김)
      this.hpText.x = this.sprite.x;
      this.hpText.y = barY - 2;          // HP 바 바로 위 (origin 0.5, 1 — bottom anchor)
      this.hpText.setText(`${Math.max(0, Math.floor(this.hp))}/${this.maxHp}`);
    }
  }

  // === 이동 ===

  // [Phase P-44d] 적 이동 폐기 — no-op. spawn 위치 고정.
  // 옛 호출처 호환용 stub 유지 (CombatSystem 펫 AI 등은 별도 인라인 velocity 사용).
  moveTowardPlayer(player, others = []) {
    // intentionally empty — 적은 spawn 후 정지 상태 유지.
  }

  // 정지 (사거리 안일 때 호출)
  stopMoving() {
    if (this.sprite && this.sprite.body) {
      this.sprite.body.setVelocityX(0);
    }
  }

  // === 피격 ===

  // 데미지 받기
  // 반환: { dodged, damage, killed }
  // accuracyMod: { bonus, penalty } — 플레이어 명중률 보정
  //   명중률 1.0 = 기본 (회피 그대로)
  //   명중률 1.2 = +20% → 적 회피 -20% (bonus 0.2)
  //   명중률 0.95 = -5% → 적 회피 +5% (penalty 0.05)
  //   최종 회피율 0~100% cap
  // 기본 인자 = 회피 보정 없음 (반사/카운터 데미지 등 비-플레이어 출처용)
  takeDamage(amount, accuracyMod = { bonus: 0, penalty: 0 }) {
    // 회피 판정 — 보스 디버프 dodge (유령왕 회피 마스터) 우선
    let effectiveDodge = this.dodgeChance;
    if (this._debuffBuffs && this._debuffBuffs.dodge !== undefined) {
      effectiveDodge = Math.max(effectiveDodge, this._debuffBuffs.dodge);
    }
    // 플레이어 명중률 보정 — bonus 만큼 회피 무효화, penalty 만큼 회피 추가, 0~1 cap
    const bonus = accuracyMod.bonus || 0;
    const penalty = accuracyMod.penalty || 0;
    effectiveDodge = Math.max(0, Math.min(1, effectiveDodge - bonus + penalty));
    if (Math.random() < effectiveDodge) {
      this.flashColor(0xcccccc); // 회색 깜빡임 (회피 표시)
      return { dodged: true, damage: 0, killed: false };
    }

    // [Phase K] 방어 공식 폐기 — 데미지 100% 적용
    const finalDamage = Math.max(1, Math.floor(amount));
    this.hp = Math.max(0, this.hp - finalDamage);
    this.flashColor(0xffffff); // 흰색 깜빡임 (피격 표시)
    this.updateHpDisplay();    // HP 바/숫자 갱신

    const killed = this.hp <= 0;
    if (killed) {
      this.die();
    }
    return { dodged: false, damage: finalDamage, killed };
  }

  // 잠깐 색 바꿨다가 원래대로 — 스프라이트는 tint+FILL 모드, 사각형은 fillColor
  flashColor(flashColor) {
    if (!this.sprite || !this.sprite.active) return;
    if (this._isSpriteImage) {
      // Phaser 4 — setTintFill 제거됨. setTint + setTintMode(FILL) 로 동일 효과
      this.sprite.setTint(flashColor);
      this.sprite.setTintMode(Phaser.TintModes.FILL);
      this.scene.time.delayedCall(100, () => {
        if (this.sprite && this.sprite.active) {
          this.sprite.clearTint();  // 원본 스프라이트 색상으로 복원
        }
      });
    } else {
      this.sprite.fillColor = flashColor;
      this.scene.time.delayedCall(100, () => {
        if (this.sprite && this.sprite.active) {
          this.sprite.fillColor = this.color;
        }
      });
    }
  }

  // 죽음
  die() {
    this.active = false;
    if (this.type === 'boss') console.log('[boss] died:', this.bossName || '???');
    else if (this.type === 'subboss') console.log('[subboss] died:', this.bossName || '???');
    else console.log('[enemy] died');
    // 진행 중 tween 정리 — 파괴된 sprite 위에서 tween 도는 Phaser 경고 방지.
    try {
      if (this.scene && this.scene.tweens) {
        this.scene.tweens.killTweensOf(this.sprite);
        if (this.hpBar)   this.scene.tweens.killTweensOf(this.hpBar);
        if (this.hpBarBg) this.scene.tweens.killTweensOf(this.hpBarBg);
        if (this.hpText)  this.scene.tweens.killTweensOf(this.hpText);
      }
    } catch {}
    this.sprite.destroy();
    if (this.hpBar)   this.hpBar.destroy();
    if (this.hpBarBg) this.hpBarBg.destroy();
    if (this.hpText)  this.hpText.destroy();
  }

  // === 공격 (나중에 구현용 자리) ===

  canAttack(time) {
    const gameMul = (this.scene && this.scene._gameSpeed) || 1;
    // 보스 디버프 — 시간 왜곡 (마법사 도제: 보스 공속 ×0.6 = 빨라짐)
    let speedMul = 1;
    if (this._debuffBuffs && this._debuffBuffs.attackSpeedMul) {
      speedMul = this._debuffBuffs.attackSpeedMul;
    }
    return time - this.lastAttackTime >= (this.attackSpeed * speedMul) / gameMul;
  }

  attack(time) {
    this.lastAttackTime = time;
    let dmg = this.attackPower;
    // 보스 디버프 — 광폭화 (야만인 두목: 공격 ×2)
    if (this._debuffBuffs && this._debuffBuffs.attackMul) {
      dmg = Math.floor(dmg * this._debuffBuffs.attackMul);
    }
    // [Phase M-B6] 색욕 에픽 변형 2 — atk -50% 디버프 활성 시
    if (this._atkDebuffUntil && time < this._atkDebuffUntil) {
      dmg = Math.max(1, Math.floor(dmg * 0.5));
    }
    return dmg;
  }

  // === 위치 ===

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  isActive() {
    return this.active && this.sprite && this.sprite.active;
  }
}