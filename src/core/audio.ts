// ─── Audio: High-Fidelity Procedural Sound Synthesis System ───

import menuMusic from '../assets/01. Menu Music.mp3';
import gameMusicOne from '../assets/02. Music 1.mp3';
import gameMusicTwo from '../assets/03. Music 2.mp3';
import gameMusicThree from '../assets/04. Music 3.mp3';

type MusicScene = 'menu' | 'calm' | 'combat' | 'boss' | 'paused';
interface MusicDeck {
  element: HTMLAudioElement;
  gain: GainNode;
  key: string | null;
  transition: number;
}

const MENU_TRACK = { key: 'menu', url: menuMusic };
const GAME_TRACKS: Record<Exclude<MusicScene, 'menu' | 'paused'>, { key: string; url: string }> = {
  calm: { key: 'game-1', url: gameMusicOne },
  combat: { key: 'game-2', url: gameMusicTwo },
  boss: { key: 'game-3', url: gameMusicThree },
};

export class Audio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private initialized = false;
  private noiseBuffer: AudioBuffer | null = null;
  private distortionCurve: Float32Array | null = null;
  private zombieAmbientTimer = 2.2;
  private noZombiesInRange = true;
  private lastZombieDeathTime = 0;
  private lastZombieAttackTime = 0;
  private lastZombieHurtTime = 0;
  private lastDroneShotTime = 0;
  private resumeFailureLogged = false;
  private recordedBuffers = new Map<string, AudioBuffer>();
  private recordedBuffersPromise: Promise<void> | null = null;
  private activeZombieVoices = 0;
  private musicDecks: MusicDeck[] = [];
  private activeMusicDeck = -1;
  private musicScene: MusicScene = 'menu';
  private musicWarningLogged = false;

  private get recordedAudioFiles(): Array<[string, string]> {
    const zombieFiles = Array.from({ length: 24 }, (_, index) => [
      `zombie-${index + 1}`,
      `/assets/audio/zombies/zombie-${index + 1}.wav`,
    ] as [string, string]);
    return [
      ...zombieFiles,
      ['gun-pistol', '/assets/audio/weapons/cz.wav'],
      ['gun-rifle', '/assets/audio/weapons/sks.wav'],
      ['gun-shotgun', '/assets/audio/weapons/shotty.wav'],
      ['reload-rifle', '/assets/audio/reload/rifle-reload.wav'],
      ['reload-shotgun-first-shell', '/assets/audio/reload/shotgun-first-shell.mp3'],
      ['reload-shotgun-shells', '/assets/audio/reload/shotgun-shells.mp3'],
      ['reload-shotgun-rack', '/assets/audio/reload/shotgun-rack.mp3'],
    ];
  }

  init(): void {
    if (this.initialized && this.ctx) {
      this.resumeFromGesture();
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        console.warn('[Undead Rush] Web Audio is unavailable in this browser.');
        return;
      }

      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.82;
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -13;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 3.5;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.18;
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.96;
      this.sfxGain.connect(this.masterGain);
      this.initMusicDecks();

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
      if (this.ctx.state === 'suspended') this.resumeFromGesture();
      this.syncMusicScene();
    } catch (error) {
      console.error('[Undead Rush] Could not initialize Web Audio:', error);
    }
  }

  private resumeFromGesture(): void {
    if (!this.ctx || this.ctx.state !== 'suspended') return;
    void this.ctx.resume().catch((error) => {
      if (this.resumeFailureLogged) return;
      this.resumeFailureLogged = true;
      console.error('[Undead Rush] Browser refused to resume Web Audio:', error);
    });
  }

  ensureContext(): boolean {
    if (!this.initialized) {
      this.init();
    }
    this.resumeFromGesture();
    this.preloadRecordedAudio();
    return !!(this.ctx && this.sfxGain);
  }

  /** Called directly from a trusted mouse, keyboard, or touch gesture. */
  unlock(): void {
    this.init();
    this.resumeFromGesture();
    this.preloadRecordedAudio();
    this.syncMusicScene();
  }

  /** Selects the background score separately from the shared sound-effects bus. */
  setMusicScene(scene: MusicScene): void {
    if (this.musicScene === scene && (scene === 'paused' || this.activeMusicDeck >= 0)) return;
    this.musicScene = scene;
    this.syncMusicScene();
  }

  private initMusicDecks(): void {
    if (!this.ctx || !this.masterGain || this.musicDecks.length) return;
    for (let i = 0; i < 2; i++) {
      const element = document.createElement('audio');
      element.preload = 'auto';
      const media = this.ctx.createMediaElementSource(element);
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      media.connect(gain);
      gain.connect(this.masterGain);
      const deck: MusicDeck = { element, gain, key: null, transition: 0 };
      element.addEventListener('playing', () => {
        console.info(`[Undead Rush] Background music playing: ${deck.key ?? 'unknown track'}.`);
      });
      element.addEventListener('error', () => {
        if (this.musicWarningLogged) return;
        this.musicWarningLogged = true;
        console.warn('[Undead Rush] Background music could not be loaded.');
      });
      this.musicDecks.push(deck);
    }
  }

  private syncMusicScene(): void {
    if (!this.ctx || !this.masterGain) return;
    this.initMusicDecks();
    if (this.musicScene === 'paused') {
      if (this.activeMusicDeck >= 0) this.fadeDeck(this.activeMusicDeck, 0, true);
      return;
    }
    if (this.musicScene === 'menu') {
      this.startMusicTrack(MENU_TRACK, 0.2, true);
      return;
    }

    this.startMusicTrack(GAME_TRACKS[this.musicScene], 0.18, true);
  }

  private startMusicTrack(track: { key: string; url: string }, volume: number, loop: boolean): void {
    if (!this.ctx || !this.musicDecks.length) return;
    const current = this.musicDecks[this.activeMusicDeck];
    const existingIndex = this.musicDecks.findIndex(deck => deck.key === track.key);
    if (existingIndex >= 0) {
      this.activeMusicDeck = existingIndex;
      const existing = this.musicDecks[existingIndex];
      existing.element.loop = loop;
      if (existing.element.paused) void existing.element.play().catch(() => this.warnMusicPlayback());
      this.fadeDeck(existingIndex, volume, false);
      for (let i = 0; i < this.musicDecks.length; i++) if (i !== existingIndex) this.fadeDeck(i, 0, true);
      return;
    }

    const nextIndex = this.activeMusicDeck === 0 ? 1 : 0;
    const next = this.musicDecks[nextIndex];
    next.transition++;
    next.element.pause();
    next.key = track.key;
    next.element.src = track.url;
    next.element.loop = loop;
    next.element.currentTime = 0;
    next.element.load();
    this.activeMusicDeck = nextIndex;
    void next.element.play().catch(() => this.warnMusicPlayback());
    this.fadeDeck(nextIndex, volume, false);
    if (current && nextIndex !== this.musicDecks.indexOf(current)) {
      this.fadeDeck(this.musicDecks.indexOf(current), 0, true);
    }
  }

  private fadeDeck(index: number, volume: number, pauseAtEnd: boolean): void {
    const deck = this.musicDecks[index];
    if (!deck || !this.ctx) return;
    const now = this.ctx.currentTime;
    const transition = ++deck.transition;
    deck.gain.gain.cancelScheduledValues(now);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, now);
    deck.gain.gain.linearRampToValueAtTime(volume, now + 0.75);
    if (pauseAtEnd) {
      window.setTimeout(() => {
        const pausedActiveTrack = this.musicScene === 'paused' && this.activeMusicDeck === index;
        if (deck.transition !== transition || (this.activeMusicDeck === index && !pausedActiveTrack)) return;
        deck.element.pause();
        if (deck.gain.gain.value < 0.01 && this.activeMusicDeck !== index) deck.key = null;
      }, 800);
    }
  }

  private warnMusicPlayback(): void {
    if (this.musicWarningLogged) return;
    this.musicWarningLogged = true;
    console.warn('[Undead Rush] Background music playback was blocked by the browser. Click or press a key to enable audio.');
  }

  private preloadRecordedAudio(): void {
    if (!this.ctx || this.recordedBuffersPromise) return;
    const context = this.ctx;
    this.recordedBuffersPromise = Promise.all(this.recordedAudioFiles.map(async ([key, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const encoded = await response.arrayBuffer();
        const decoded = await context.decodeAudioData(encoded);
        this.recordedBuffers.set(key, decoded);
      } catch (error) {
        console.warn(`[Undead Rush] Could not load sound asset ${url}; using procedural fallback.`, error);
      }
    })).then(() => {
      console.info(`[Undead Rush] Audio ready: ${this.recordedBuffers.size}/${this.recordedAudioFiles.length} recorded clips.`);
    });
  }

  private playRecorded(
    key: string,
    options: { volume?: number; pan?: number; rate?: number; offset?: number; duration?: number; lowpass?: number; onEnded?: () => void } = {},
  ): boolean {
    if (!this.ctx || !this.sfxGain) return false;
    const buffer = this.recordedBuffers.get(key);
    if (!buffer) return false;
    const offset = Math.max(0, Math.min(options.offset ?? 0, buffer.duration - 0.01));
    const duration = Math.min(options.duration ?? buffer.duration - offset, buffer.duration - offset);
    if (duration <= 0.01) return false;

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const nodes: AudioNode[] = [source, gain];
    source.buffer = buffer;
    source.playbackRate.value = options.rate ?? 1;
    gain.gain.setValueAtTime(options.volume ?? 0.6, this.ctx.currentTime);
    source.connect(gain);

    let last: AudioNode = gain;
    if (options.lowpass) {
      const filter = this.ctx.createBiquadFilter();
      nodes.push(filter);
      filter.type = 'lowpass';
      filter.frequency.value = options.lowpass;
      gain.connect(filter);
      last = filter;
    }
    if (options.pan !== undefined) {
      const panner = this.ctx.createStereoPanner();
      nodes.push(panner);
      panner.pan.value = Math.max(-1, Math.min(1, options.pan));
      last.connect(panner);
      last = panner;
    }
    last.connect(this.sfxGain);
    source.onended = () => {
      for (const node of nodes) node.disconnect();
      options.onEnded?.();
    };
    source.start(this.ctx.currentTime, offset, duration);
    return true;
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
  shoot(weaponType: 'pistol' | 'rifle' | 'smg' | 'shotgun' | 'drone' = 'pistol'): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;

    if (weaponType === 'shotgun') {
      this.shotgun();
      return;
    }
    if (weaponType === 'drone') {
      this.droneShoot();
      return;
    }

    const shotAssets: Record<'pistol' | 'rifle' | 'smg', { key: string; offset: number; volume: number; rate: number }> = {
      pistol: { key: 'gun-pistol', offset: 2.8, volume: 0.76, rate: 0.98 + Math.random() * 0.04 },
      rifle: { key: 'gun-rifle', offset: 0.3, volume: 0.79, rate: 0.98 + Math.random() * 0.04 },
      smg: { key: 'gun-rifle', offset: 6.0, volume: 0.66, rate: 1.08 + Math.random() * 0.06 },
    };
    const shot = shotAssets[weaponType];
    if (this.playRecorded(shot.key, { offset: shot.offset, duration: weaponType === 'pistol' ? 0.36 : 0.34, volume: shot.volume, rate: shot.rate })) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Small variation keeps automatic fire from sounding like a perfectly repeated sample.
    const pitchDetune = (Math.random() - 0.5) * (weaponType === 'smg' ? 0.11 : 0.075);
    const profile = weaponType === 'rifle'
      ? { pitch: 205, crack: 0.78, snap: 0.10, body: 0.16, roar: 0.56, tail: 0.18 }
      : weaponType === 'smg'
        ? { pitch: 250, crack: 0.63, snap: 0.08, body: 0.13, roar: 0.42, tail: 0.105 }
        : { pitch: 172, crack: 0.7, snap: 0.09, body: 0.15, roar: 0.48, tail: 0.13 };
    const baseFreq = profile.pitch * (1 + pitchDetune);

    // ── Layer 1: Supersonic Ballistic Crack (High-velocity sharp whip) ──
    if (this.noiseBuffer) {
      const crackSrc = ctx.createBufferSource();
      crackSrc.buffer = this.noiseBuffer;
      crackSrc.playbackRate.value = 1 + pitchDetune;

      const crackFilter = ctx.createBiquadFilter();
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime((weaponType === 'smg' ? 3450 : 2900) + Math.random() * 500, t);
      crackFilter.Q.value = weaponType === 'smg' ? 1.7 : 1.2;

      const crackGain = ctx.createGain();
      crackGain.gain.setValueAtTime(profile.crack, t);
      crackGain.gain.exponentialRampToValueAtTime(0.001, t + (weaponType === 'smg' ? 0.027 : 0.042));

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
    snapOsc.frequency.setValueAtTime((weaponType === 'smg' ? 1750 : 1350) * (1 + pitchDetune), t);
    snapOsc.frequency.exponentialRampToValueAtTime(weaponType === 'smg' ? 240 : 145, t + 0.025);

    snapGain.gain.setValueAtTime(profile.snap, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);

    snapOsc.connect(snapGain);
    snapGain.connect(this.sfxGain);
    snapOsc.start(t);
    snapOsc.stop(t + 0.02);

    // ── Layer 2: Gunpowder Explosion & Low Punch (Body) ──
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'triangle';
    boomOsc.frequency.setValueAtTime(baseFreq, t);
    boomOsc.frequency.exponentialRampToValueAtTime(weaponType === 'smg' ? 65 : 38, t + profile.tail);

    boomGain.gain.setValueAtTime(profile.body, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + profile.tail + 0.025);

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
    boomOsc.stop(t + profile.tail + 0.03);

    // ── Layer 3: Broadband powder blast and low air pressure ──
    if (this.noiseBuffer) {
      const bodySrc = ctx.createBufferSource();
      const bodyFilter = ctx.createBiquadFilter();
      const bodyGain = ctx.createGain();
      bodySrc.buffer = this.noiseBuffer;
      bodyFilter.type = 'lowpass';
      bodyFilter.frequency.setValueAtTime(780 + Math.random() * 260, t);
      bodyFilter.frequency.exponentialRampToValueAtTime(130, t + profile.tail + 0.08);
      bodyGain.gain.setValueAtTime(weaponType === 'smg' ? 0.62 : 0.78, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + profile.tail + 0.1);
      bodySrc.connect(bodyFilter);
      bodyFilter.connect(bodyGain);
      bodyGain.connect(this.sfxGain);
      bodySrc.start(t, Math.random());
      bodySrc.stop(t + profile.tail + 0.11);

      const roarSrc = ctx.createBufferSource();
      roarSrc.buffer = this.noiseBuffer;

      const roarFilter = ctx.createBiquadFilter();
      roarFilter.type = 'lowpass';
      roarFilter.frequency.setValueAtTime(weaponType === 'rifle' ? 1150 : 1450, t);
      roarFilter.frequency.exponentialRampToValueAtTime(150, t + profile.roar);

      const roarGain = ctx.createGain();
      roarGain.gain.setValueAtTime(profile.roar, t);
      roarGain.gain.exponentialRampToValueAtTime(0.001, t + profile.roar + 0.015);

      roarSrc.connect(roarFilter);
      roarFilter.connect(roarGain);
      roarGain.connect(this.sfxGain);

      roarSrc.start(t, Math.random());
      roarSrc.stop(t + profile.roar + 0.02);
    }

    // ── Layer 4: Very short filtered action tick and soft environmental reflection ──
    if (this.noiseBuffer) {
      const action = ctx.createBufferSource();
      const actionFilter = ctx.createBiquadFilter();
      const actionGain = ctx.createGain();
      action.buffer = this.noiseBuffer;
      actionFilter.type = 'bandpass';
      actionFilter.frequency.setValueAtTime(weaponType === 'smg' ? 2250 : 1700, t + 0.045);
      actionFilter.Q.value = 2.6;
      actionGain.gain.setValueAtTime(0.0001, t);
      actionGain.gain.setValueAtTime(0.12, t + 0.045);
      actionGain.gain.exponentialRampToValueAtTime(0.001, t + 0.082);
      action.connect(actionFilter);
      actionFilter.connect(actionGain);
      actionGain.connect(this.sfxGain);
      action.start(t + 0.045, Math.random());
      action.stop(t + 0.085);

      const reflection = ctx.createBufferSource();
      const reflectionFilter = ctx.createBiquadFilter();
      const reflectionGain = ctx.createGain();
      reflection.buffer = this.noiseBuffer;
      reflectionFilter.type = 'bandpass';
      reflectionFilter.frequency.setValueAtTime(640 + Math.random() * 260, t + 0.075);
      reflectionFilter.Q.value = 0.72;
      reflectionGain.gain.setValueAtTime(0.0001, t);
      reflectionGain.gain.setValueAtTime(0.085, t + 0.075);
      reflectionGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      reflection.connect(reflectionFilter);
      reflectionFilter.connect(reflectionGain);
      reflectionGain.connect(this.sfxGain);
      reflection.start(t + 0.075, Math.random());
      reflection.stop(t + 0.225);
    }
  }

  /**
   * Heavy 12-gauge shotgun blast with massive low end, wide noise spread and reverberation.
   */
  shotgun(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;

    if (this.playRecorded('gun-shotgun', { volume: 0.82, rate: 0.99 + Math.random() * 0.02 })) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pitchDetune = (Math.random() - 0.5) * 0.06;

    // Heavy Sub-Bass Blast (190Hz -> 30Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(190 * (1 + pitchDetune), t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.18);

    subGain.gain.setValueAtTime(0.32, t);
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
      const crackSrc = ctx.createBufferSource();
      const crackFilter = ctx.createBiquadFilter();
      const crackGain = ctx.createGain();
      crackSrc.buffer = this.noiseBuffer;
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime(2900 + Math.random() * 1000, t);
      crackFilter.Q.value = 0.95;
      crackGain.gain.setValueAtTime(0.82, t);
      crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      crackSrc.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(this.sfxGain);
      crackSrc.start(t, Math.random());
      crackSrc.stop(t + 0.055);

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
  droneShoot(pan = 0): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const now = performance.now();
    if (now - this.lastDroneShotTime < 82) return;
    this.lastDroneShotTime = now;

    if (this.playRecorded('gun-rifle', {
      offset: 9.7,
      duration: 0.34,
      volume: 0.68,
      rate: 1.04 + Math.random() * 0.04,
      pan,
    })) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    panner.connect(this.sfxGain);

    // Compact rifle report: sharp muzzle crack, short low body, and a tiny action clack.
    if (this.noiseBuffer) {
      const crack = ctx.createBufferSource();
      const crackFilter = ctx.createBiquadFilter();
      const crackGain = ctx.createGain();
      crack.buffer = this.noiseBuffer;
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime(3200 + Math.random() * 900, t);
      crackFilter.Q.value = 1.25;
      crackGain.gain.setValueAtTime(0.72, t);
      crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.034);
      crack.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(panner);
      crack.start(t, Math.random());
      crack.stop(t + 0.04);

      const body = ctx.createBufferSource();
      const bodyFilter = ctx.createBiquadFilter();
      const bodyGain = ctx.createGain();
      body.buffer = this.noiseBuffer;
      bodyFilter.type = 'lowpass';
      bodyFilter.frequency.setValueAtTime(980, t);
      bodyFilter.frequency.exponentialRampToValueAtTime(190, t + 0.12);
      bodyGain.gain.setValueAtTime(0.72, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      body.connect(bodyFilter);
      bodyFilter.connect(bodyGain);
      bodyGain.connect(panner);
      body.start(t, Math.random());
      body.stop(t + 0.14);

      const action = ctx.createBufferSource();
      const actionFilter = ctx.createBiquadFilter();
      const actionGain = ctx.createGain();
      action.buffer = this.noiseBuffer;
      actionFilter.type = 'bandpass';
      actionFilter.frequency.setValueAtTime(2100, t + 0.035);
      actionFilter.Q.value = 2.5;
      actionGain.gain.setValueAtTime(0.0001, t);
      actionGain.gain.setValueAtTime(0.16, t + 0.035);
      actionGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      action.connect(actionFilter);
      actionFilter.connect(actionGain);
      actionGain.connect(panner);
      action.start(t + 0.035, Math.random());
      action.stop(t + 0.08);
    }

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(135 + Math.random() * 25, t);
    thump.frequency.exponentialRampToValueAtTime(52, t + 0.085);
    thumpGain.gain.setValueAtTime(0.19, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    thump.connect(thumpGain);
    thumpGain.connect(panner);
    thump.start(t);
    thump.stop(t + 0.095);
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

  private reloadClack(delay: number, pitch: number, brightness: number, volume: number): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;

    if (this.noiseBuffer) {
      const metal = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      metal.buffer = this.noiseBuffer;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(brightness, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(180, brightness * 0.42), t + 0.065);
      filter.Q.value = 2.2;
      gain.gain.setValueAtTime(volume * 0.52, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      metal.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      metal.start(t, Math.random() * 1.5);
      metal.stop(t + 0.08);
    }

    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.type = 'triangle';
    ring.frequency.setValueAtTime(pitch, t);
    ring.frequency.exponentialRampToValueAtTime(Math.max(90, pitch * 0.58), t + 0.055);
    ringGain.gain.setValueAtTime(volume * 0.3, t);
    ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    ring.connect(ringGain);
    ringGain.connect(this.sfxGain);
    ring.start(t);
    ring.stop(t + 0.065);
  }

  private reloadSlide(delay: number, duration: number, pitchFrom: number, pitchTo: number, brightness: number): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const scrape = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    scrape.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(brightness, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(250, brightness * 0.48), t + duration);
    filter.Q.value = 1.05;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.025);
    gain.gain.setValueAtTime(0.12, t + duration * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    scrape.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    scrape.start(t, Math.random() * 1.5);
    scrape.stop(t + duration + 0.01);

    const bolt = ctx.createOscillator();
    const boltFilter = ctx.createBiquadFilter();
    const boltGain = ctx.createGain();
    bolt.type = 'sawtooth';
    bolt.frequency.setValueAtTime(pitchFrom, t);
    bolt.frequency.exponentialRampToValueAtTime(pitchTo, t + duration);
    boltFilter.type = 'lowpass';
    boltFilter.frequency.value = 1050;
    boltGain.gain.setValueAtTime(0.0001, t);
    boltGain.gain.linearRampToValueAtTime(0.055, t + 0.025);
    boltGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    bolt.connect(boltFilter);
    boltFilter.connect(boltGain);
    boltGain.connect(this.sfxGain);
    bolt.start(t);
    bolt.stop(t + duration + 0.01);
  }

  /** Magazine release followed by the metal magazine clearing the receiver. */
  reloadStart(weaponType: 'rifle' | 'shotgun' | 'smg' = 'rifle'): void {
    if (!this.ensureContext()) return;
    const isShotgun = weaponType === 'shotgun';
    if (isShotgun && this.playRecorded('reload-shotgun-first-shell', { volume: 0.48, rate: 0.98 + Math.random() * 0.04 })) return;
    const brightness = weaponType === 'smg' ? 1450 : isShotgun ? 720 : 980;
    this.reloadClack(0, isShotgun ? 180 : 225, brightness, 0.46);
    this.reloadSlide(0.035, isShotgun ? 0.15 : 0.105, 720, 260, brightness * 0.92);
    this.reloadClack(0.13, isShotgun ? 145 : 190, brightness * 0.72, 0.33);
  }

  /** Fresh magazine seats with a dense, weighty metal-on-metal slap. */
  reloadInsert(weaponType: 'rifle' | 'shotgun' | 'smg' = 'rifle'): void {
    if (!this.ensureContext()) return;
    if (weaponType === 'shotgun') {
      if (this.playRecorded('reload-shotgun-shells', { volume: 0.42, rate: 0.96 + Math.random() * 0.08 })) return;
      this.reloadClack(0, 300, 1150, 0.42);
      this.reloadClack(0.045, 870, 1900, 0.24);
      return;
    }
    const isSmg = weaponType === 'smg';
    if (this.playRecorded('reload-rifle', {
      offset: 0.94,
      duration: 0.55,
      volume: isSmg ? 0.4 : 0.48,
      rate: isSmg ? 1.08 : 1,
    })) return;
    this.reloadClack(0, isSmg ? 285 : 245, isSmg ? 1550 : 1150, 0.56);
    this.reloadClack(0.035, isSmg ? 1050 : 760, isSmg ? 2100 : 1650, 0.3);
  }

  /** Bolt or pump action scrapes forward, then snaps into battery. */
  reloadRack(weaponType: 'rifle' | 'shotgun' | 'smg' = 'rifle'): void {
    if (!this.ensureContext()) return;
    if (weaponType === 'shotgun') {
      if (this.playRecorded('reload-shotgun-rack', { volume: 0.52, rate: 0.97 + Math.random() * 0.06 })) return;
      this.reloadSlide(0, 0.2, 980, 230, 1300);
      this.reloadClack(0.17, 190, 780, 0.58);
      return;
    }
    const isSmg = weaponType === 'smg';
    this.reloadSlide(0, isSmg ? 0.12 : 0.16, isSmg ? 1150 : 920, 190, isSmg ? 1750 : 1200);
    this.reloadClack(isSmg ? 0.105 : 0.14, 205, isSmg ? 1250 : 840, 0.56);
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

  /** Play one distant, spatially positioned zombie groan every few seconds. */
  updateZombieAmbience(dt: number, distance = Infinity, pan = 0, type = 'normal'): void {
    if (!Number.isFinite(distance)) {
      this.noZombiesInRange = true;
      this.zombieAmbientTimer = Math.min(this.zombieAmbientTimer, 0.35);
      return;
    }

    if (this.noZombiesInRange) {
      this.noZombiesInRange = false;
      this.zombieAmbientTimer = Math.min(this.zombieAmbientTimer, 0.35);
    }
    this.zombieAmbientTimer -= dt;
    if (this.zombieAmbientTimer > 0) return;

    if (distance > 1950) {
      this.zombieAmbientTimer = 1.1 + Math.random() * 1.5;
      return;
    }

    const proximity = this.isNewCreature(type)
      ? this.creatureDistanceGain(distance)
      : Math.max(0.35, 1 - distance / 3000);
    const duration = type === 'runner' ? 0.72 : type.startsWith('boss') || type === 'tank' ? 1.35 : 1.05;
    this.playZombieVocal(type, pan, proximity * (0.75 + Math.random() * 0.35), duration);
    this.zombieAmbientTimer = distance < 240
      ? 2.6 + Math.random() * 1.8
      : 3.4 + Math.random() * 2.8;
  }

  zombieAttack(pan = 0, type = 'normal', distance = 0): void {
    const now = performance.now();
    if (now - this.lastZombieAttackTime < 260) return;
    this.lastZombieAttackTime = now;
    this.playZombieVocal(type, pan, 0.88 * this.creatureDistanceGain(distance), type === 'tank' || type.startsWith('boss') ? 0.55 : 0.38, 'attack');
  }

  zombieHurt(pan = 0, type = 'normal', distance = 0): void {
    // Existing zombies already have their established flesh-hit cue.
    if (!this.isNewCreature(type)) return;
    const now = performance.now();
    if (now - this.lastZombieHurtTime < 220) return;
    this.lastZombieHurtTime = now;
    this.playZombieVocal(type, pan, 0.47 * this.creatureDistanceGain(distance), 0.23, 'hurt');
  }

  zombieDie(pan = 0, type = 'normal', distance = 0): void {
    const now = performance.now();
    if (now - this.lastZombieDeathTime < 135) return;
    this.lastZombieDeathTime = now;
    this.playZombieVocal(type, pan, 0.78 * this.creatureDistanceGain(distance), 0.48, 'death');
  }

  private isNewCreature(type: string): boolean {
    return type === 'spider' || type === 'rat_king' || type === 'mutant' || type === 'armed' || type === 'multihead';
  }

  private creatureDistanceGain(distance: number): number {
    if (!Number.isFinite(distance) || distance >= 1800) return 0;
    return Math.pow(Math.max(0, 1 - Math.max(0, distance) / 1800), 1.35);
  }

  private playZombieVocal(type: string, pan: number, volume: number, duration: number, event: 'ambient' | 'attack' | 'hurt' | 'death' = 'ambient'): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    if (this.activeZombieVoices >= 4 || volume < 0.025) return;
    if (this.isNewCreature(type)) {
      this.playCreatureVocal(type, pan, volume, event);
      return;
    }

    const isSpitter = type === 'spitter';
    const isHeavy = type === 'tank' || type.startsWith('boss');
    const clipNumbers = isSpitter
      ? [22, 23, 24]
      : isHeavy
        ? [16, 17, 18, 19, 20, 21]
        : type === 'runner'
          ? [8, 9, 10, 11, 12, 13, 14, 15]
          : type === 'exploder'
            ? [12, 13, 14, 15, 16, 18]
            : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const clipNumber = clipNumbers[Math.floor(Math.random() * clipNumbers.length)];
    const recordedRate = isHeavy ? 0.82 : type === 'runner' ? 1.1 : isSpitter ? 0.96 : 0.92 + Math.random() * 0.16;
    if (this.playRecorded(`zombie-${clipNumber}`, {
      volume: volume * (isHeavy ? 0.78 : 0.68),
      rate: recordedRate,
      pan,
      lowpass: isHeavy ? 1150 : isSpitter ? 5200 : undefined,
      onEnded: () => { this.activeZombieVoices = Math.max(0, this.activeZombieVoices - 1); },
    })) {
      this.activeZombieVoices++;
      return;
    }

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const basePitch = isHeavy ? 61 : type === 'runner' ? 126 : isSpitter ? 88 : 93;
    const pitch = basePitch * (0.9 + Math.random() * 0.2);
    const end = t + duration;
    this.activeZombieVoices++;
    const nodes: AudioNode[] = [];

    const voiceBus = ctx.createGain();
    voiceBus.gain.setValueAtTime(volume * 0.7, t);
    const panner = ctx.createStereoPanner();
    nodes.push(voiceBus, panner);
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    voiceBus.connect(panner);
    panner.connect(this.sfxGain);

    // A formant-filtered, detuned voice gives the groan a throat-like vowel instead of a beep.
    const voice = ctx.createOscillator();
    const distortion = ctx.createWaveShaper();
    const throatFilter = ctx.createBiquadFilter();
    const throatEnvelope = ctx.createGain();
    nodes.push(voice, distortion, throatFilter, throatEnvelope);
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(pitch, t);
    voice.frequency.exponentialRampToValueAtTime(Math.max(38, pitch * (0.58 + Math.random() * 0.08)), end);
    if (this.distortionCurve) distortion.curve = this.distortionCurve as any;
    throatFilter.type = 'lowpass';
    throatFilter.frequency.setValueAtTime(isSpitter ? 1800 : 1250, t);
    throatFilter.frequency.exponentialRampToValueAtTime(isHeavy ? 560 : 720, end);
    throatEnvelope.gain.setValueAtTime(0.0001, t);
    throatEnvelope.gain.linearRampToValueAtTime(0.46, t + 0.075);
    throatEnvelope.gain.exponentialRampToValueAtTime(0.0001, end);
    voice.connect(distortion);
    distortion.connect(throatFilter);
    throatFilter.connect(throatEnvelope);
    throatEnvelope.connect(voiceBus);
    voice.start(t);
    voice.stop(end + 0.015);

    const vibrato = ctx.createOscillator();
    const vibratoDepth = ctx.createGain();
    nodes.push(vibrato, vibratoDepth);
    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(isHeavy ? 4.4 : 5.8, t);
    vibratoDepth.gain.setValueAtTime(pitch * (isHeavy ? 0.055 : 0.075), t);
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(voice.frequency);
    vibrato.start(t);
    vibrato.stop(end + 0.015);

    // Formants shape the harmonics into a strained open-mouth groan.
    const formantBands = isSpitter ? [560, 1480] : isHeavy ? [310, 680] : [420, 960];
    for (let i = 0; i < formantBands.length; i++) {
      const formant = ctx.createBiquadFilter();
      const formantGain = ctx.createGain();
      nodes.push(formant, formantGain);
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(formantBands[i], t);
      formant.frequency.exponentialRampToValueAtTime(formantBands[i] * (0.8 + Math.random() * 0.12), end);
      formant.Q.value = i === 0 ? 1.2 : 1.7;
      formantGain.gain.setValueAtTime(0.0001, t);
      formantGain.gain.linearRampToValueAtTime(i === 0 ? 0.48 : 0.32, t + 0.09);
      formantGain.gain.exponentialRampToValueAtTime(0.0001, end);
      voice.connect(formant);
      formant.connect(formantGain);
      formantGain.connect(voiceBus);
    }

    // Airflow supplies the wet rasp and breathy onset missing from a purely tonal synth.
    let finalSource: AudioScheduledSourceNode = voice;
    if (this.noiseBuffer) {
      const breath = ctx.createBufferSource();
      const breathFilter = ctx.createBiquadFilter();
      const breathEnvelope = ctx.createGain();
      nodes.push(breath, breathFilter, breathEnvelope);
      finalSource = breath;
      breath.buffer = this.noiseBuffer;
      breath.loop = true;
      breathFilter.type = isSpitter ? 'bandpass' : 'lowpass';
      breathFilter.frequency.setValueAtTime(isSpitter ? 2400 : 1750, t);
      breathFilter.frequency.exponentialRampToValueAtTime(isSpitter ? 900 : 420, end);
      if (isSpitter) breathFilter.Q.value = 0.75;
      breathEnvelope.gain.setValueAtTime(0.0001, t);
      breathEnvelope.gain.linearRampToValueAtTime(isSpitter ? 0.46 : 0.36, t + 0.12);
      breathEnvelope.gain.exponentialRampToValueAtTime(0.0001, end);
      breath.connect(breathFilter);
      breathFilter.connect(breathEnvelope);
      breathEnvelope.connect(voiceBus);
      breath.start(t, Math.random() * 1.5);
      breath.stop(end + 0.02);
    }
    finalSource.onended = () => {
      for (const node of nodes) node.disconnect();
      this.activeZombieVoices = Math.max(0, this.activeZombieVoices - 1);
    };
  }

  /** Original creature foley: shared noise, unstable throat formants and material resonances.
   * Every composite occupies one of the same four zombie voice slots as recorded groans.
   * Sources stop explicitly and release their graph together, including modulation nodes.
   */
  private playCreatureVocal(type: string, pan: number, volume: number, event: 'ambient' | 'attack' | 'hurt' | 'death'): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noiseBuffer = this.noiseBuffer;
    const bus = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    bus.gain.value = volume * 0.68;
    lowpass.type = 'lowpass';
    // Distance darkens the sound as well as lowering its level.
    lowpass.frequency.value = 1900 + Math.min(1, volume) * 4100;
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    bus.connect(lowpass);
    lowpass.connect(panner);
    panner.connect(this.sfxGain);
    const nodes: AudioNode[] = [bus, lowpass, panner];
    let sources = 0;
    this.activeZombieVoices++;
    const track = (source: AudioScheduledSourceNode, start: number, end: number) => {
      nodes.push(source);
      sources++;
      source.onended = () => {
        if (--sources !== 0) return;
        for (const node of nodes) node.disconnect();
        this.activeZombieVoices = Math.max(0, this.activeZombieVoices - 1);
      };
      source.start(start);
      source.stop(end);
    };

    // Broad, pitch-moving noise remains textured even on inexpensive speakers.
    const scrape = (delay: number, length: number, from: number, to: number, level: number, q = 1.2) => {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      const start = t + delay;
      source.buffer = noiseBuffer;
      source.loop = true;
      source.playbackRate.value = 0.82 + Math.random() * 0.36;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(from, start);
      filter.frequency.exponentialRampToValueAtTime(to, start + length);
      filter.Q.value = q;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(level, start + Math.min(0.03, length * 0.15));
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * 0.3), start + length * 0.6);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(bus);
      nodes.push(filter, envelope);
      track(source, start, start + length + 0.01);
    };

    // Uneven pitch, breath and moving resonances produce a strained animal voice.
    const throat = (delay: number, length: number, pitch: number, formant: number, level: number, fall = 0.58) => {
      const start = t + delay;
      const voice = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      const flutter = ctx.createOscillator();
      const flutterDepth = ctx.createGain();
      const jitter = 0.9 + Math.random() * 0.2;
      voice.type = 'sawtooth';
      voice.frequency.setValueAtTime(pitch * jitter, start);
      voice.frequency.exponentialRampToValueAtTime(pitch * 1.17, start + length * 0.2);
      voice.frequency.exponentialRampToValueAtTime(Math.max(28, pitch * fall), start + length);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(formant, start);
      filter.frequency.exponentialRampToValueAtTime(formant * 0.64, start + length);
      filter.Q.value = 0.95;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(level, start + Math.min(0.045, length * 0.17));
      envelope.gain.linearRampToValueAtTime(level * 0.36, start + length * 0.42);
      envelope.gain.linearRampToValueAtTime(level * 0.65, start + length * 0.57);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
      flutter.type = 'triangle';
      flutter.frequency.value = 19 + Math.random() * 23;
      flutterDepth.gain.value = pitch * 0.065;
      flutter.connect(flutterDepth);
      flutterDepth.connect(voice.frequency);
      voice.connect(filter);
      filter.connect(envelope);
      envelope.connect(bus);
      nodes.push(filter, envelope, flutterDepth);
      track(voice, start, start + length + 0.01);
      track(flutter, start, start + length + 0.01);
      scrape(delay, length, formant * 1.4, formant * 0.7, level * 0.48, 0.7);
    };

    const ambient = event === 'ambient';
    const dying = event === 'death';
    const hurting = event === 'hurt';
    const length = hurting ? 0.21 : dying ? 0.7 : ambient ? 1.0 : 0.5;
    const pitchScale = hurting ? 1.3 : dying ? 0.72 : 1;

    if (type === 'spider') {
      // Alternating hard claws followed by a wet jaw rattle; no electronic chirp.
      const count = hurting ? 2 : ambient ? 6 : 4;
      for (let i = 0; i < count; i++) {
        scrape(i * length / (count + 1), 0.045 + Math.random() * 0.035, 2100 + i * 180, 680, 0.32, 2.4);
      }
      scrape(length * 0.18, length * 0.7, 1600, dying ? 180 : 630, 0.5, 0.65);
      if (!ambient) throat(0, length * 0.75, 190 * pitchScale, 790, 0.3, 0.35);
    } else if (type === 'rat_king') {
      // Three overlapping, uneven squeals suggest several living mouths in one body.
      for (let i = 0; i < (hurting ? 2 : 3); i++) {
        throat(i * length * 0.15, length * (0.62 - i * 0.08), (430 + i * 185) * pitchScale, 1750 + i * 290, 0.28, dying ? 0.28 : 0.69);
      }
      scrape(0.05, length * 0.85, 390, 120, 0.42, 0.8);
    } else if (type === 'mutant') {
      // Two strained breaths over a chesty, irregular groan.
      throat(0, length, 58 * pitchScale, 350, 0.62, dying ? 0.43 : 0.78);
      scrape(0, length * 0.42, 820, 310, 0.7, 0.65);
      scrape(length * 0.48, length * 0.45, 640, 210, 0.54, 0.9);
      if (!ambient) scrape(0.01, 0.18, 190, 55, 0.95, 0.85);
    } else if (type === 'armed') {
      // Dragging rusty metal, then an inharmonic clank or weapon impact.
      scrape(0, length * 0.8, 1250, 530, ambient ? 0.48 : 0.67, 2.8);
      const impact = ambient ? length * 0.68 : 0.015;
      scrape(impact, 0.13, 1850, 1470, 0.4, 9);
      scrape(impact + 0.012, 0.18, 710, 625, 0.54, 8);
      throat(0.035, length * 0.8, 81 * pitchScale, 510, 0.33);
    } else {
      // Each head enters at a different pitch and time, sharing one voice budget slot.
      throat(0, length, 69 * pitchScale, 330, 0.36, dying ? 0.32 : 0.64);
      throat(length * 0.12, length * 0.76, 113 * pitchScale, 740, 0.31, 0.82);
      throat(length * 0.25, length * 0.68, 158 * pitchScale, 1180, 0.25, 0.47);
      scrape(length * 0.2, length * 0.65, 950, 230, 0.35, 1.4);
    }

    if (dying) {
      // Short flesh collapse ties the falling body to the death animation.
      scrape(0.32, 0.25, 580, 120, 0.62, 0.7);
      scrape(0.4, 0.12, 2100, 650, 0.25, 1.3);
    }
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
