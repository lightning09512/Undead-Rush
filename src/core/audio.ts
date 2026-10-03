// ─── Audio: High-Fidelity Procedural Sound Synthesis System ───

export class Audio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private initialized = false;
  private noiseBuffer: AudioBuffer | null = null;
  private distortionCurve: Float32Array | null = null;

  init(): void {
    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.52; // Balanced master level
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.88;
      this.sfxGain.connect(this.masterGain);

      // Pre-generate 2 seconds of high quality white noise for crack & explosions
      const sampleRate = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sampleRate * 2, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Pre-compute soft-clipping distortion curve for firearm punch
      this.distortionCurve = this.createDistortionCurve(22);

      this.initialized = true;
    } catch {
      // WebAudio not available
    }
  }

  ensureContext(): boolean {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return !!(this.ctx && this.sfxGain);
  }

  private createDistortionCurve(amount: number): Float32Array {
    const k = amount;
    const n_samples = 22050;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.3): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, volume = 0.2): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
  }

  // ─── Tactical Gunshot Sound Effects ───

  /**
   * Powerful, crisp gunshot sound for primary weapons (pistol, rifle, smg).
   * Synthesizes 4 distinct layers:
   * 1. Supersonic bullet crack transient (high-passed noise + snap chirp)
   * 2. Gunpowder explosion & low-frequency punch (overdriven downward pitch sweep)
   * 3. Muzzle blast air roar (filtered noise decay)
   * 4. Mechanical brass casing drop / bolt cycle click
   */
  shoot(weaponType: 'pistol' | 'rifle' | 'shotgun' | 'drone' = 'pistol'): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;

    if (weaponType === 'shotgun') {
      this.shotgun();
      return;
    }
    if (weaponType === 'drone') {
      this.droneShoot();
      return;
    }

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Pitch detune (+/- 4%) so rapid shooting doesn't sound robotic
    const pitchDetune = (Math.random() - 0.5) * 0.08;
    const baseFreq = 230 * (1 + pitchDetune);

    // ── Layer 1: Supersonic Ballistic Crack (High-velocity sharp whip) ──
    if (this.noiseBuffer) {
      const crackSrc = ctx.createBufferSource();
      crackSrc.buffer = this.noiseBuffer;
      crackSrc.playbackRate.value = 1 + pitchDetune;

      const crackFilter = ctx.createBiquadFilter();
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime(2800 + Math.random() * 400, t);
      crackFilter.Q.value = 1.3;

      const crackGain = ctx.createGain();
      crackGain.gain.setValueAtTime(0.48, t);
      crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);

      crackSrc.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(this.sfxGain);

      crackSrc.start(t, Math.random());
      crackSrc.stop(t + 0.04);
    }

    // High snap chirp (firing pin & shockwave transient)
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(1400 * (1 + pitchDetune), t);
    snapOsc.frequency.exponentialRampToValueAtTime(170, t + 0.022);

    snapGain.gain.setValueAtTime(0.35, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    snapOsc.connect(snapGain);
    snapGain.connect(this.sfxGain);
    snapOsc.start(t);
    snapOsc.stop(t + 0.026);

    // ── Layer 2: Gunpowder Explosion & Low Punch (Body) ──
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'sawtooth';
    boomOsc.frequency.setValueAtTime(baseFreq, t);
    boomOsc.frequency.exponentialRampToValueAtTime(42, t + 0.085);

    boomGain.gain.setValueAtTime(0.52, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    if (this.distortionCurve) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.distortionCurve as any;
      boomOsc.connect(shaper);
      shaper.connect(boomGain);
    } else {
      boomOsc.connect(boomGain);
    }

    boomGain.connect(this.sfxGain);
    boomOsc.start(t);
    boomOsc.stop(t + 0.12);

    // ── Layer 3: Muzzle Blast Body & Air Rumble ──
    if (this.noiseBuffer) {
      const roarSrc = ctx.createBufferSource();
      roarSrc.buffer = this.noiseBuffer;

      const roarFilter = ctx.createBiquadFilter();
      roarFilter.type = 'lowpass';
      roarFilter.frequency.setValueAtTime(950, t);
      roarFilter.frequency.exponentialRampToValueAtTime(180, t + 0.14);

      const roarGain = ctx.createGain();
      roarGain.gain.setValueAtTime(0.38, t);
      roarGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      roarSrc.connect(roarFilter);
      roarFilter.connect(roarGain);
      roarGain.connect(this.sfxGain);

      roarSrc.start(t, Math.random());
      roarSrc.stop(t + 0.16);
    }

    // ── Layer 4: Subtle Brass Shell Ping / Slide Action ──
    const pingOsc = ctx.createOscillator();
    const pingGain = ctx.createGain();
    pingOsc.type = 'sine';
    pingOsc.frequency.setValueAtTime(2600 + Math.random() * 300, t + 0.055);
    pingGain.gain.setValueAtTime(0.0001, t);
    pingGain.gain.setValueAtTime(0.06, t + 0.055);
    pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);

    pingOsc.connect(pingGain);
    pingGain.connect(this.sfxGain);
    pingOsc.start(t + 0.055);
    pingOsc.stop(t + 0.1);
  }

  /**
   * Heavy 12-gauge shotgun blast with massive low end, wide noise spread and reverberation.
   */
  shotgun(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pitchDetune = (Math.random() - 0.5) * 0.06;

    // Heavy Sub-Bass Blast (190Hz -> 30Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(190 * (1 + pitchDetune), t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.18);

    subGain.gain.setValueAtTime(0.65, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    if (this.distortionCurve) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.distortionCurve as any;
      subOsc.connect(shaper);
      shaper.connect(subGain);
    } else {
      subOsc.connect(subGain);
    }
    subGain.connect(this.sfxGain);
    subOsc.start(t);
    subOsc.stop(t + 0.24);

    // Roaring 12-gauge gunpowder blast
    if (this.noiseBuffer) {
      const blastSrc = ctx.createBufferSource();
      blastSrc.buffer = this.noiseBuffer;

      const blastFilter = ctx.createBiquadFilter();
      blastFilter.type = 'lowpass';
      blastFilter.frequency.setValueAtTime(1600, t);
      blastFilter.frequency.exponentialRampToValueAtTime(220, t + 0.22);

      const blastGain = ctx.createGain();
      blastGain.gain.setValueAtTime(0.55, t);
      blastGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      blastSrc.connect(blastFilter);
      blastFilter.connect(blastGain);
      blastGain.connect(this.sfxGain);

      blastSrc.start(t, Math.random());
      blastSrc.stop(t + 0.25);

      // Acoustic reverb tail
      const tailSrc = ctx.createBufferSource();
      tailSrc.buffer = this.noiseBuffer;

      const tailFilter = ctx.createBiquadFilter();
      tailFilter.type = 'bandpass';
      tailFilter.frequency.setValueAtTime(450, t);
      tailFilter.Q.value = 0.9;

      const tailGain = ctx.createGain();
      tailGain.gain.setValueAtTime(0.3, t + 0.04);
      tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      tailSrc.connect(tailFilter);
      tailFilter.connect(tailGain);
      tailGain.connect(this.sfxGain);

      tailSrc.start(t + 0.04, Math.random());
      tailSrc.stop(t + 0.29);
    }
  }

  /**
   * High-tech pulse sound for combat drones
   */
  droneShoot(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.06);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  /**
   * Pneumatic grenade launcher firing thump
   */
  grenadeLaunch(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.12);
    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // ─── Tactical Reload & Weapon Action Sound Effects ───

  /** Magazine release and drop click */
  reloadStart(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    this.playTone(850, 0.025, 'triangle', 0.22);
    setTimeout(() => this.playTone(420, 0.035, 'sine', 0.18), 35);
  }

  /** Heavy magazine slam/lock into magwell */
  reloadInsert(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    this.playTone(260, 0.045, 'triangle', 0.28);
    setTimeout(() => this.playTone(720, 0.025, 'square', 0.18), 30);
  }

  /** Bolt carrier slide rack pull and chamber snap */
  reloadRack(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    this.playTone(1150, 0.03, 'sawtooth', 0.22);
    setTimeout(() => this.playTone(460, 0.04, 'triangle', 0.28), 45);
  }

  private lastEmptyClickTime = 0;
  emptyClick(): void {
    const now = performance.now();
    if (now - this.lastEmptyClickTime < 180) return;
    this.lastEmptyClickTime = now;
    this.playTone(1800, 0.02, 'square', 0.12);
  }

  /** Berserk rage activation powerup roar */
  rageActivate(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(750, t + 0.35);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  // ─── Impact & Gameplay Sound Effects ───

  private lastHitSoundTime = 0;

  /**
   * Squelchy flesh bullet impact sound with low-end thump
   */
  hit(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const now = performance.now();
    if (now - this.lastHitSoundTime < 42) return; // Prevent audio clipping on large swarms
    this.lastHitSoundTime = now;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.045);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.055);

    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, t);
      filter.Q.value = 1.6;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.18, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxGain);

      src.start(t, Math.random());
      src.stop(t + 0.05);
    }
  }

  private lastPlayerHitTime = 0;

  playerHit(): void {
    const now = performance.now();
    if (now - this.lastPlayerHitTime < 180) return;
    this.lastPlayerHitTime = now;
    this.playTone(180, 0.1, 'triangle', 0.22);
  }

  zombieDie(): void {
    this.playTone(110, 0.12, 'sawtooth', 0.12);
  }

  xpPickup(): void {
    this.playTone(1200, 0.06, 'sine', 0.12);
  }

  levelUp(): void {
    this.playTone(523, 0.1, 'sine', 0.28);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.28), 100);
    setTimeout(() => this.playTone(784, 0.15, 'sine', 0.28), 200);
  }

  private lastExplosionTime = 0;

  explosion(): void {
    const now = performance.now();
    if (now - this.lastExplosionTime < 140) return;
    this.lastExplosionTime = now;

    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(28, t + 0.3);

    subGain.gain.setValueAtTime(0.6, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(t);
    subOsc.stop(t + 0.36);

    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(120, t + 0.35);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.5, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxGain);

      src.start(t, Math.random());
      src.stop(t + 0.4);
    }
  }

  gameOver(): void {
    this.playTone(400, 0.2, 'sawtooth', 0.3);
    setTimeout(() => this.playTone(300, 0.2, 'sawtooth', 0.3), 200);
    setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 0.3), 400);
  }

  menuSelect(): void {
    this.playTone(600, 0.08, 'sine', 0.18);
  }
}
