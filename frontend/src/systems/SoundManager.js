// 사운드 매니저 — Web Audio API로 간단한 효과음을 코드로 합성
// 외부 mp3/wav 파일 없이 동작. 추후 실제 SFX 파일로 교체하기 쉽게 메서드별로 분리.
//
// 호출 위치:
//   - playerAttack: 플레이어 공격 발사 시 (CombatSystem)
//   - enemyHit:     적이 데미지 받을 때 (CombatSystem.applyDamageToEnemy)
//   - enemyDeath:   적 처치 시 (CombatSystem.applyDamageToEnemy, killed 시)
//   - playerHit:    플레이어 피격 시 (CombatSystem.processEnemyAttacks)
//   - levelUp:      레벨업 시 (Player.gainExp, 레벨 오를 때)
//   - cardPicked:   카드 클릭 시 (GameScene.showCardSelection)
//
// BGM (Phaser sound API 사용 — preload 단계 audio 로드 필요):
//   - playBgm(scene, key)            씬 진입 시 호출. 같은 트랙이면 무동작
//   - stopBgm(fadeMs)                페이드아웃 후 정지
//   - setBgmVolume(volume)           재생 중 볼륨 즉시 변경
//   - crossfadeBgm(scene, key, ms)   다른 트랙으로 부드럽게 전환

import { gameSettings } from '../data/settings.js';

class SoundManager {
  constructor() {
    this.ctx = null;
    this.currentBgmKey = null;
    this.bgmSound = null;
    this._bgmScene = null;     // 마지막 사용 씬 — tween 호스트
  }

  // 첫 사용자 상호작용 후에만 AudioContext 활성화 가능 (브라우저 정책)
  ensureContext() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return false;
      }
    }
    if (this.ctx.state === 'suspended') {
      // 첫 user gesture 전엔 autoplay block. Promise rejection 무시 — 이후 클릭 시 재시도.
      try { this.ctx.resume().catch(() => {}); } catch {}
    }
    return true;
  }

  // 기본 비프 — frequency Hz, duration ms, volume 0~1, type 파형
  beep(freq, duration, volume = 0.5, type = 'square') {
    if (!this.ensureContext()) return;
    const finalVol = gameSettings.sfxVolume * volume;
    if (finalVol <= 0) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(finalVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000);

    osc.start(now);
    osc.stop(now + duration / 1000);
  }

  // === 세련된 합성 효과음 헬퍼 ===

  // 노이즈 burst — 짧은 화이트 노이즈 + filter + envelope
  _noiseBurst(durationMs, volume = 0.3, filterFreq = 2000, filterType = 'highpass') {
    if (!this.ensureContext()) return;
    const finalVol = gameSettings.sfxVolume * volume;
    if (finalVol <= 0) return;
    const sec = durationMs / 1000;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    src.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(finalVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + sec);
    src.start(now);
    src.stop(now + sec);
  }

  // 주파수 sweep — 시작 → 끝 주파수 변화
  _sweep(freqStart, freqEnd, durationMs, volume = 0.4, type = 'sine') {
    if (!this.ensureContext()) return;
    const finalVol = gameSettings.sfxVolume * volume;
    if (finalVol <= 0) return;
    const sec = durationMs / 1000;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.connect(gain); gain.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + sec);
    gain.gain.setValueAtTime(finalVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + sec);
    osc.start(now);
    osc.stop(now + sec);
  }

  // === 게임 효과음 (세련화) ===

  // 플레이어 공격 — 짧고 날카로운 슬라이스 (sine sweep 하향 + 노이즈 burst)
  playerAttack() {
    this._sweep(900, 350, 60, 0.18, 'sine');
    this._noiseBurst(30, 0.10, 4000, 'highpass');
  }

  // 적 피격 — 톡톡 thunk (중주파 sweep + 노이즈)
  enemyHit() {
    this._sweep(280, 140, 80, 0.25, 'triangle');
    this._noiseBurst(50, 0.18, 1200, 'bandpass');
  }

  // 적 처치 — 깊은 swoosh + 종료감 (주파수 하강 + 노이즈)
  enemyDeath() {
    this._sweep(380, 60, 220, 0.30, 'sawtooth');
    this._noiseBurst(180, 0.18, 800, 'lowpass');
  }

  // 플레이어 피격 — 깊은 임팩트 (저주파 thud + 노이즈 burst)
  playerHit() {
    this._sweep(160, 50, 140, 0.42, 'sawtooth');
    this._noiseBurst(80, 0.30, 600, 'lowpass');
    // 서브 베이스 — 깊이감
    setTimeout(() => this._sweep(80, 40, 80, 0.20, 'sine'), 10);
  }

  cardPicked()   { this.beep(880, 60, 0.3, 'sine'); }

  // 보물상자 열기 — 밝은 chime + 사운드 sweep (보상 느낌)
  treasureOpen() {
    this.beep(523, 80, 0.30, 'sine');                                  // C5
    setTimeout(() => this.beep(659, 80, 0.30, 'sine'), 70);            // E5
    setTimeout(() => this.beep(988, 200, 0.35, 'sine'), 140);          // B5
  }

  // 다이아 획득 — 짧고 청량한 sparkle
  diamondGain() {
    this.beep(1318, 60, 0.25, 'sine');                                 // E6
    setTimeout(() => this.beep(1568, 100, 0.30, 'sine'), 60);          // G6
  }

  // 신의 시험 수락 — 묵직한 저음 (음산함)
  trialAccept() {
    this._sweep(220, 110, 240, 0.35, 'sawtooth');
    this._noiseBurst(180, 0.20, 500, 'lowpass');
  }

  // 보스 등장 — 깊은 horn (긴장감)
  bossAppear() {
    this._sweep(120, 240, 400, 0.40, 'sawtooth');
    setTimeout(() => this._sweep(90, 180, 350, 0.30, 'sine'), 100);
  }

  // 레벨업 — 3음 상승 아르페지오
  levelUp() {
    this.beep(523, 90, 0.35, 'sine');                                // C5
    setTimeout(() => this.beep(659, 90, 0.35, 'sine'), 100);         // E5
    setTimeout(() => this.beep(784, 180, 0.35, 'sine'), 200);        // G5
  }

  // === BGM 시스템 ===
  // 음원 파일이 preload 안 됐으면 silent fail (콘솔 warn 만, 게임 진행 무영향).

  _trackLoaded(scene, key) {
    return !!(scene && scene.cache && scene.cache.audio && scene.cache.audio.exists(key));
  }

  _effectiveBgmVolume(override) {
    const v = override !== undefined ? override : (gameSettings.bgmVolume ?? 0.7);
    return Math.max(0, Math.min(1, v));
  }

  _stopBgmImmediate() {
    if (!this.bgmSound) return;
    try { this.bgmSound.stop(); this.bgmSound.destroy(); } catch {}
    this.bgmSound = null;
    this.currentBgmKey = null;
  }

  playBgm(scene, key) {
    if (!scene || !key) return;
    if (this.currentBgmKey === key && this.bgmSound && this.bgmSound.isPlaying) return;
    this._stopBgmImmediate();
    this._bgmScene = scene;

    if (!this._trackLoaded(scene, key)) {
      console.warn(`[bgm] track not loaded: ${key} — silent`);
      return;
    }
    try {
      const vol = this._effectiveBgmVolume();
      this.bgmSound = scene.sound.add(key, { loop: true, volume: vol });
      this.bgmSound.play();
      this.currentBgmKey = key;
    } catch (e) {
      console.warn('[bgm] play failed:', e);
    }
  }

  stopBgm(fadeMs = 500) {
    if (!this.bgmSound) return;
    const sound = this.bgmSound;
    const scene = this._bgmScene;
    this.bgmSound = null;
    this.currentBgmKey = null;
    if (!scene || !scene.tweens || fadeMs <= 0) {
      try { sound.stop(); sound.destroy(); } catch {}
      return;
    }
    scene.tweens.add({
      targets: sound, volume: 0, duration: fadeMs,
      onComplete: () => { try { sound.stop(); sound.destroy(); } catch {} },
    });
  }

  setBgmVolume(volume) {
    // volume: 0.0~1.0. 재생 중 트랙 즉시 반영.
    if (!this.bgmSound) return;
    try { this.bgmSound.setVolume(this._effectiveBgmVolume(volume)); } catch {}
  }

  crossfadeBgm(scene, newKey, fadeMs = 800) {
    if (!scene || !newKey) return;
    if (this.currentBgmKey === newKey) return;
    if (!this._trackLoaded(scene, newKey)) {
      console.warn(`[bgm] crossfade target not loaded: ${newKey} — stopping current`);
      this.stopBgm(fadeMs);
      return;
    }

    const oldSound = this.bgmSound;
    const oldScene = this._bgmScene;
    this._bgmScene = scene;

    let newSound;
    try {
      newSound = scene.sound.add(newKey, { loop: true, volume: 0 });
      newSound.play();
    } catch (e) {
      console.warn('[bgm] crossfade play failed:', e);
      return;
    }

    this.bgmSound = newSound;
    this.currentBgmKey = newKey;
    const targetVol = this._effectiveBgmVolume();

    scene.tweens.add({ targets: newSound, volume: targetVol, duration: fadeMs });

    if (oldSound) {
      const host = (oldScene && oldScene.tweens) ? oldScene : scene;
      host.tweens.add({
        targets: oldSound, volume: 0, duration: fadeMs,
        onComplete: () => { try { oldSound.stop(); oldSound.destroy(); } catch {} },
      });
    }
  }
}

// 전역 싱글톤
export const sound = new SoundManager();
