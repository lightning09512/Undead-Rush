// ─── Audio: High-Fidelity Procedural Sound Synthesis System ───

import menuMusic from '../assets/01. Menu Music.mp3';
import gameMusicOne from '../assets/02. Music 1.mp3';
import gameMusicTwo from '../assets/03. Music 2.mp3';
import gameMusicThree from '../assets/04. Music 3.mp3';
import { getBossIdFromType, getBossSignature } from '../data/boss-signatures';

type MusicScene = 'menu' | 'calm' | 'combat' | 'campaignBoss' | 'boss' | 'paused';
export type WeaponSoundType = 'pistol' | 'rifle' | 'smg' | 'shotgun' | 'drone' | 'dmr' | 'lmg' | 'flamer' | 'rpg' | 'rail';
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
  campaignBoss: { key: 'game-3', url: gameMusicThree },
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
  private lastCreatureTelegraphTime = 0;
  private lastCreatureSkillTime = 0;
  private lastBossImpactTime = 0;
  private lastBossProjectilePassTime = 0;
  private activeBossCueVoices = 0;
  private lastDroneShotTime = 0;
  private lastFlamerShotTime = 0;
  private lastCreditPickupTime = 0;
  private lastSupplyPickupTime = 0;
  private lastObjectiveSoundTime = 0;
  private lastGameOverTime = 0;
  private playerFootstepTimer = 0;
  private resumeFailureLogged = false;
  private recordedBuffers = new Map<string, AudioBuffer>();
  private readonly recordedLoadQueue: Array<{ key: string; url: string; priority: number; order: number }> = [];
  private readonly requestedRecordedAudio = new Set<string>();
  private readonly failedRecordedAudio = new Set<string>();
  private readonly activeRecordedVoices = new Map<AudioBufferSourceNode, number>();
  private recordedAudioLoading = false;
  private recordedRequestOrder = 0;
  private readonly maxCachedRecordedClips = 8;
  private readonly maxRecordedVoices = 16;
  private readonly maxCriticalRecordedVoices = 20;
  private activeZombieVoices = 0;
  private musicDecks: MusicDeck[] = [];
  private activeMusicDeck = -1;
  private musicScene: MusicScene = 'menu';
  private musicEnabled = true;
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
    return !!(this.ctx && this.sfxGain);
  }

  /** Called directly from a trusted mouse, keyboard, or touch gesture. */
  unlock(): void {
    this.init();
    this.resumeFromGesture();
    // Warm only the likely first weapon sound. All other clips are requested
    // by their real gameplay event and decoded one at a time in priority order.
    this.requestRecordedAudio('gun-pistol', 2);
    this.syncMusicScene();
  }

  /** Selects the background score separately from the shared sound-effects bus. */
  setMusicScene(scene: MusicScene): void {
    if (this.musicScene === scene) {
      if (scene === 'paused' || !this.musicEnabled) return;
      const expectedKey = scene === 'menu' ? MENU_TRACK.key : GAME_TRACKS[scene].key;
      if (this.musicDecks[this.activeMusicDeck]?.key === expectedKey) return;
    }
    this.musicScene = scene;
    this.syncMusicScene();
  }

  setMusicEnabled(enabled: boolean): void {
    if (this.musicEnabled === enabled) return;
    this.musicEnabled = enabled;
    if (enabled) this.syncMusicScene();
    else for (let i = 0; i < this.musicDecks.length; i++) this.fadeDeck(i, 0, true);
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
    if (!this.musicEnabled) {
      for (let i = 0; i < this.musicDecks.length; i++) this.fadeDeck(i, 0, true);
      return;
    }
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
        const pausedActiveTrack = (this.musicScene === 'paused' || !this.musicEnabled) && this.activeMusicDeck === index;
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

  private requestRecordedAudio(key: string, priority = 0): void {
    if (!this.ctx || this.recordedBuffers.has(key) || this.failedRecordedAudio.has(key)) return;
    const queued = this.recordedLoadQueue.find((entry) => entry.key === key);
    if (queued) {
      queued.priority = Math.max(queued.priority, priority);
      this.recordedLoadQueue.sort((a, b) => b.priority - a.priority || a.order - b.order);
      return;
    }
    if (this.requestedRecordedAudio.has(key)) return;
    const file = this.recordedAudioFiles.find(([fileKey]) => fileKey === key);
    if (!file) return;
    this.requestedRecordedAudio.add(key);
    this.recordedLoadQueue.push({ key, url: file[1], priority, order: this.recordedRequestOrder++ });
    this.recordedLoadQueue.sort((a, b) => b.priority - a.priority || a.order - b.order);
    this.loadNextRecordedAudio();
  }

  private loadNextRecordedAudio(): void {
    if (!this.ctx || this.recordedAudioLoading) return;
    const job = this.recordedLoadQueue.shift();
    if (!job) return;
    const context = this.ctx;
    this.recordedAudioLoading = true;
    void (async () => {
      try {
        const response = await fetch(job.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const encoded = await response.arrayBuffer();
        const decoded = await context.decodeAudioData(encoded);
        if (this.ctx === context) {
          this.recordedBuffers.set(job.key, decoded);
          while (this.recordedBuffers.size > this.maxCachedRecordedClips) {
            const oldest = this.recordedBuffers.keys().next().value as string | undefined;
            if (!oldest) break;
            this.recordedBuffers.delete(oldest);
          }
        }
      } catch (error) {
        this.failedRecordedAudio.add(job.key);
        console.warn(`[Undead Rush] Could not load sound asset ${job.url}; using procedural fallback.`, error);
      } finally {
        this.requestedRecordedAudio.delete(job.key);
        this.recordedAudioLoading = false;
        this.loadNextRecordedAudio();
      }
    })();
  }

  get performanceStats(): { loadedRecordedClips: number; queuedRecordedClips: number; decodedAudioBytes: number; activeRecordedVoices: number } {
    let decodedAudioBytes = 0;
    for (const buffer of this.recordedBuffers.values()) {
      decodedAudioBytes += buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    }
    return {
      loadedRecordedClips: this.recordedBuffers.size,
      queuedRecordedClips: this.recordedLoadQueue.length + Number(this.recordedAudioLoading),
      decodedAudioBytes,
      activeRecordedVoices: this.activeRecordedVoices.size,
    };
  }

  private playRecorded(
    key: string,
    options: { volume?: number; pan?: number; rate?: number; offset?: number; duration?: number; fadeOut?: number; lowpass?: number; priority?: number; onEnded?: () => void } = {},
  ): boolean {
    if (!this.ctx || !this.sfxGain) return false;
    const priority = options.priority ?? 1;
    const buffer = this.recordedBuffers.get(key);
    if (!buffer) {
      this.requestRecordedAudio(key, priority);
      return false;
    }

    // Refresh LRU order while retaining at most eight decoded clips in memory.
    this.recordedBuffers.delete(key);
    this.recordedBuffers.set(key, buffer);
    if (this.activeRecordedVoices.size >= this.maxRecordedVoices) {
      let lowestVoice: AudioBufferSourceNode | undefined;
      let lowestPriority = Infinity;
      for (const [voice, voicePriority] of this.activeRecordedVoices) {
        if (voicePriority < lowestPriority) {
          lowestVoice = voice;
          lowestPriority = voicePriority;
        }
      }
      if (lowestVoice && lowestPriority < priority) {
        this.activeRecordedVoices.delete(lowestVoice);
        try { lowestVoice.stop(); } catch { /* it may have ended between scheduling and stopping */ }
      } else if (priority < 3 || this.activeRecordedVoices.size >= this.maxCriticalRecordedVoices) {
        // Suppress a low-priority recorded voice without falling through to a
        // second procedural voice. Critical player and boss cues get headroom.
        if (options.onEnded) window.setTimeout(options.onEnded, Math.max(0, options.duration ?? .5) * 1000);
        return true;
      }
    }
    const offset = Math.max(0, Math.min(options.offset ?? 0, buffer.duration - 0.01));
    const duration = Math.min(options.duration ?? buffer.duration - offset, buffer.duration - offset);
    if (duration <= 0.01) return false;

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const nodes: AudioNode[] = [source, gain];
    source.buffer = buffer;
    source.playbackRate.value = options.rate ?? 1;
    const now = this.ctx.currentTime;
    const volume = options.volume ?? 0.6;
    gain.gain.setValueAtTime(volume, now);
    if (options.fadeOut && options.fadeOut > 0) {
      const playbackDuration = duration / Math.max(.01, options.rate ?? 1);
      const fadeDuration = Math.min(options.fadeOut, playbackDuration * .45);
      gain.gain.setValueAtTime(volume, now + playbackDuration - fadeDuration);
      gain.gain.exponentialRampToValueAtTime(.001, now + playbackDuration);
    }
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
      this.activeRecordedVoices.delete(source);
      for (const node of nodes) node.disconnect();
      options.onEnded?.();
    };
    this.activeRecordedVoices.set(source, priority);
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
  shoot(weaponType: WeaponSoundType = 'pistol'): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;

    if (weaponType === 'shotgun') {
      this.shotgun();
      return;
    }
    if (weaponType === 'drone') {
      this.droneShoot();
      return;
    }
    if (weaponType === 'flamer') {
      this.flamerShot();
      return;
    }
    if (weaponType === 'rpg') {
      this.grenadeLaunch();
      return;
    }
    if (weaponType === 'rail') {
      this.railShot();
      return;
    }

    const shotAssets: Record<'pistol' | 'rifle' | 'smg' | 'shotgun' | 'dmr' | 'lmg',
      { key: string; offset: number; duration: number; fadeOut?: number; volume: number; rate: number; lowpass: number }> = {
      pistol: { key: 'gun-pistol', offset: 2.8, duration: 0.82, fadeOut: .16, volume: 0.34, rate: 0.98 + Math.random() * 0.04, lowpass: 4700 },
      rifle: { key: 'gun-rifle', offset: 0.3, duration: 0.24, volume: 0.34, rate: 0.98 + Math.random() * 0.04, lowpass: 4600 },
      smg: { key: 'gun-rifle', offset: 6.0, duration: 0.19, volume: 0.27, rate: 1.08 + Math.random() * 0.06, lowpass: 5000 },
      shotgun: { key: 'gun-shotgun', offset: 0, duration: 0.26, volume: 0.4, rate: 0.99 + Math.random() * 0.02, lowpass: 4700 },
      dmr: { key: 'gun-rifle', offset: 0.3, duration: 0.29, volume: 0.36, rate: 0.91 + Math.random() * 0.025, lowpass: 3900 },
      lmg: { key: 'gun-rifle', offset: 6.0, duration: 0.2, volume: 0.28, rate: 0.94 + Math.random() * 0.035, lowpass: 4100 },
    };
    const shot = shotAssets[weaponType];
    if (this.playRecorded(shot.key, { offset: shot.offset, duration: shot.duration, fadeOut: shot.fadeOut,
      volume: shot.volume, lowpass: shot.lowpass, rate: shot.rate, priority: 3 })) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Small variation keeps automatic fire from sounding like a perfectly repeated sample.
    const pitchDetune = (Math.random() - 0.5) * (weaponType === 'smg' || weaponType === 'lmg' ? 0.11 : 0.075);
    const profile = weaponType === 'rifle'
      ? { pitch: 190, crack: 0.31, body: 0.075, roar: 0.18, tail: 0.13 }
      : weaponType === 'dmr'
        ? { pitch: 158, crack: 0.36, body: 0.09, roar: 0.21, tail: 0.17 }
        : weaponType === 'smg' || weaponType === 'lmg'
          ? { pitch: 225, crack: 0.26, body: 0.06, roar: 0.15, tail: 0.09 }
          : { pitch: 172, crack: 0.30, body: 0.07, roar: 0.17, tail: 0.10 };
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
      bodyGain.gain.setValueAtTime(weaponType === 'smg' || weaponType === 'lmg' ? 0.20 : 0.23, t);
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
      actionFilter.frequency.setValueAtTime(weaponType === 'smg' || weaponType === 'lmg' ? 1850 : 1420, t + 0.045);
      actionFilter.Q.value = 1.05;
      actionGain.gain.setValueAtTime(0.0001, t);
      actionGain.gain.setValueAtTime(0.035, t + 0.045);
      actionGain.gain.exponentialRampToValueAtTime(0.001, t + 0.092);
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
      reflectionGain.gain.setValueAtTime(0.025, t + 0.075);
      reflectionGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      reflection.connect(reflectionFilter);
      reflectionFilter.connect(reflectionGain);
      reflectionGain.connect(this.sfxGain);
      reflection.start(t + 0.075, Math.random());
      reflection.stop(t + 0.165);
    }
  }

  /**
   * Heavy 12-gauge shotgun blast with massive low end, wide noise spread and reverberation.
   */
  shotgun(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;

    if (this.playRecorded('gun-shotgun', { duration: 0.68, fadeOut: .15, volume: 0.46, lowpass: 5000,
      rate: 0.99 + Math.random() * 0.02, priority: 3 })) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pitchDetune = (Math.random() - 0.5) * 0.06;

    // Heavy Sub-Bass Blast (190Hz -> 30Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(190 * (1 + pitchDetune), t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.18);

    subGain.gain.setValueAtTime(0.17, t);
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
      crackGain.gain.setValueAtTime(0.40, t);
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
      blastGain.gain.setValueAtTime(0.30, t);
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
      tailGain.gain.setValueAtTime(0.12, t + 0.04);
      tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.21);

      tailSrc.connect(tailFilter);
      tailFilter.connect(tailGain);
      tailGain.connect(this.sfxGain);

      tailSrc.start(t + 0.04, Math.random());
      tailSrc.stop(t + 0.22);
    }
  }

  /** Soft fuel ignition and a broad flame rush for the Campaign flamethrower. */
  private flamerShot(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = performance.now();
    if (now - this.lastFlamerShotTime < 82) return;
    this.lastFlamerShotTime = now;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const hiss = ctx.createBufferSource();
    const hissFilter = ctx.createBiquadFilter();
    const hissGain = ctx.createGain();
    hiss.buffer = this.noiseBuffer;
    hiss.playbackRate.value = .72 + Math.random() * .16;
    hissFilter.type = 'bandpass';
    hissFilter.frequency.setValueAtTime(920 + Math.random() * 260, t);
    hissFilter.frequency.exponentialRampToValueAtTime(420, t + .115);
    hissFilter.Q.value = .52;
    hissGain.gain.setValueAtTime(.0001, t);
    hissGain.gain.linearRampToValueAtTime(.13, t + .012);
    hissGain.gain.exponentialRampToValueAtTime(.001, t + .13);
    hiss.connect(hissFilter); hissFilter.connect(hissGain); hissGain.connect(this.sfxGain);
    hiss.onended = () => { hiss.disconnect(); hissFilter.disconnect(); hissGain.disconnect(); };
    hiss.start(t, Math.random() * 1.4); hiss.stop(t + .14);
  }

  /** A sharp electrical discharge with a low transformer thump, without a pitched sci-fi beep. */
  private railShot(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const crack = ctx.createBufferSource();
    const crackFilter = ctx.createBiquadFilter();
    const crackGain = ctx.createGain();
    crack.buffer = this.noiseBuffer;
    crack.playbackRate.value = .86 + Math.random() * .18;
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(3100 + Math.random() * 650, t);
    crackFilter.frequency.exponentialRampToValueAtTime(980, t + .085);
    crackFilter.Q.value = .72;
    crackGain.gain.setValueAtTime(.3, t);
    crackGain.gain.exponentialRampToValueAtTime(.001, t + .09);
    crack.connect(crackFilter); crackFilter.connect(crackGain); crackGain.connect(this.sfxGain);
    crack.onended = () => { crack.disconnect(); crackFilter.disconnect(); crackGain.disconnect(); };
    crack.start(t, Math.random() * 1.3); crack.stop(t + .1);

    const body = ctx.createBufferSource();
    const bodyFilter = ctx.createBiquadFilter();
    const bodyGain = ctx.createGain();
    body.buffer = this.noiseBuffer;
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(640, t);
    bodyFilter.frequency.exponentialRampToValueAtTime(115, t + .22);
    bodyGain.gain.setValueAtTime(.24, t);
    bodyGain.gain.exponentialRampToValueAtTime(.001, t + .24);
    body.connect(bodyFilter); bodyFilter.connect(bodyGain); bodyGain.connect(this.sfxGain);
    body.onended = () => { body.disconnect(); bodyFilter.disconnect(); bodyGain.disconnect(); };
    body.start(t, Math.random() * 1.3); body.stop(t + .25);
  }

  /**
   * High-tech pulse sound for combat drones
   */
  droneShoot(pan = 0): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const now = performance.now();
    if (now - this.lastDroneShotTime < 82) return;
    this.lastDroneShotTime = now;
    if (!this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    panner.connect(this.sfxGain);

    const crack = ctx.createBufferSource();
    const crackFilter = ctx.createBiquadFilter();
    const crackGain = ctx.createGain();
    crack.buffer = this.noiseBuffer;
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(2600 + Math.random() * 600, t);
    crackFilter.Q.value = .72;
    crackGain.gain.setValueAtTime(.2, t);
    crackGain.gain.exponentialRampToValueAtTime(.001, t + .028);
    crack.connect(crackFilter); crackFilter.connect(crackGain); crackGain.connect(panner);
    crack.onended = () => { crack.disconnect(); crackFilter.disconnect(); crackGain.disconnect(); };
    crack.start(t, Math.random() * 1.4); crack.stop(t + .035);

    const body = ctx.createBufferSource();
    const bodyFilter = ctx.createBiquadFilter();
    const bodyGain = ctx.createGain();
    body.buffer = this.noiseBuffer;
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(620, t);
    bodyFilter.frequency.exponentialRampToValueAtTime(170, t + .09);
    bodyGain.gain.setValueAtTime(.16, t);
    bodyGain.gain.exponentialRampToValueAtTime(.001, t + .1);
    body.connect(bodyFilter); bodyFilter.connect(bodyGain); bodyGain.connect(panner);
    body.onended = () => { body.disconnect(); bodyFilter.disconnect(); bodyGain.disconnect(); panner.disconnect(); };
    body.start(t, Math.random() * 1.4); body.stop(t + .105);
  }

  /**
   * Pneumatic grenade launcher firing thump
   */
  grenadeLaunch(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = .68 + Math.random() * .12;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(760, t);
    filter.frequency.exponentialRampToValueAtTime(145, t + .18);
    filter.Q.value = .55;
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.linearRampToValueAtTime(.26, t + .01);
    gain.gain.exponentialRampToValueAtTime(.001, t + .21);
    source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(t, Math.random() * 1.3); source.stop(t + .22);

    const valve = ctx.createBufferSource();
    const valveFilter = ctx.createBiquadFilter();
    const valveGain = ctx.createGain();
    valve.buffer = this.noiseBuffer;
    valveFilter.type = 'bandpass'; valveFilter.frequency.value = 1900; valveFilter.Q.value = .62;
    valveGain.gain.setValueAtTime(.11, t);
    valveGain.gain.exponentialRampToValueAtTime(.001, t + .045);
    valve.connect(valveFilter); valveFilter.connect(valveGain); valveGain.connect(this.sfxGain);
    valve.onended = () => { valve.disconnect(); valveFilter.disconnect(); valveGain.disconnect(); };
    valve.start(t, Math.random() * 1.4); valve.stop(t + .05);
  }

  // ─── Tactical Reload & Weapon Action Sound Effects ───

  private reloadClack(delay: number, bodyCutoff: number, brightness: number, volume: number): void {
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
      filter.frequency.exponentialRampToValueAtTime(Math.max(320, brightness * 0.58), t + 0.045);
      filter.Q.value = .78;
      gain.gain.setValueAtTime(volume * .62, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + .052);
      metal.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      metal.onended = () => { metal.disconnect(); filter.disconnect(); gain.disconnect(); };
      metal.start(t, Math.random() * 1.5);
      metal.stop(t + .057);

      const body = ctx.createBufferSource();
      const bodyFilter = ctx.createBiquadFilter();
      const bodyGain = ctx.createGain();
      body.buffer = this.noiseBuffer;
      bodyFilter.type = 'lowpass';
      bodyFilter.frequency.setValueAtTime(Math.max(330, bodyCutoff), t);
      bodyFilter.frequency.exponentialRampToValueAtTime(150, t + .075);
      bodyGain.gain.setValueAtTime(volume * .22, t);
      bodyGain.gain.exponentialRampToValueAtTime(.001, t + .082);
      body.connect(bodyFilter); bodyFilter.connect(bodyGain); bodyGain.connect(this.sfxGain);
      body.onended = () => { body.disconnect(); bodyFilter.disconnect(); bodyGain.disconnect(); };
      body.start(t, Math.random() * 1.5); body.stop(t + .085);
    }
  }

  private reloadSlide(delay: number, duration: number, brightness: number): void {
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
    gain.gain.linearRampToValueAtTime(0.13, t + 0.025);
    gain.gain.setValueAtTime(0.09, t + duration * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    scrape.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    scrape.onended = () => { scrape.disconnect(); filter.disconnect(); gain.disconnect(); };
    scrape.start(t, Math.random() * 1.5);
    scrape.stop(t + duration + 0.01);
  }

  /** Magazine release followed by the metal magazine clearing the receiver. */
  reloadStart(weaponType: Exclude<WeaponSoundType, 'drone'> = 'rifle'): void {
    if (!this.ensureContext()) return;
    const isShotgun = weaponType === 'shotgun';
    if (isShotgun && this.playRecorded('reload-shotgun-first-shell', {
      offset: 0, duration: .145, volume: .34, rate: .98 + Math.random() * .04, priority: 2,
    })) return;
    if (!isShotgun && this.playRecorded('reload-rifle', {
      offset: .15, duration: .21, volume: .32, rate: this.reloadSampleRate(weaponType), priority: 2,
    })) return;
    const brightness = this.reloadBrightness(weaponType);
    this.reloadClack(0, isShotgun ? 460 : 520, brightness, 0.34);
    this.reloadSlide(0.035, isShotgun ? 0.15 : 0.105, brightness * 0.92);
    this.reloadClack(0.13, isShotgun ? 390 : 430, brightness * 0.72, 0.25);
  }

  /** Fresh magazine seats with a dense, weighty metal-on-metal slap. */
  reloadInsert(weaponType: Exclude<WeaponSoundType, 'drone'> = 'rifle'): void {
    if (!this.ensureContext()) return;
    if (weaponType === 'shotgun') {
      if (this.playRecorded('reload-shotgun-shells', {
        offset: .675, duration: .63, volume: .32, rate: .96 + Math.random() * .08, priority: 2,
      })) return;
      this.reloadClack(0, 560, 1150, 0.34);
      this.reloadClack(0.045, 680, 1900, 0.2);
      return;
    }
    const brightness = this.reloadBrightness(weaponType);
    this.reloadClack(0, weaponType === 'smg' || weaponType === 'lmg' ? 620 : 560, brightness, 0.38);
    this.reloadClack(0.035, weaponType === 'smg' || weaponType === 'lmg' ? 760 : 680, brightness * 1.35, 0.2);
  }

  /** Bolt or pump action scrapes forward, then snaps into battery. */
  reloadRack(weaponType: Exclude<WeaponSoundType, 'drone'> = 'rifle'): void {
    if (!this.ensureContext()) return;
    if (weaponType === 'shotgun') {
      if (this.playRecorded('reload-shotgun-rack', {
        offset: .61, duration: .48, volume: .4, rate: .97 + Math.random() * .06,
      })) return;
      this.reloadSlide(0, 0.2, 1300);
      this.reloadClack(0.17, 460, 780, 0.42);
      return;
    }
    if (this.playRecorded('reload-rifle', {
      offset: 1.04, duration: .44, volume: .31, rate: this.reloadSampleRate(weaponType), priority: 2,
    })) return;
    const isCompact = weaponType === 'smg' || weaponType === 'lmg';
    const brightness = this.reloadBrightness(weaponType);
    this.reloadSlide(0, isCompact ? 0.12 : 0.16, brightness);
    this.reloadClack(isCompact ? 0.105 : 0.14, isCompact ? 520 : 450, brightness * .7, 0.36);
  }

  private reloadBrightness(weaponType: Exclude<WeaponSoundType, 'drone'>): number {
    switch (weaponType) {
      case 'shotgun': return 720;
      case 'smg': return 1450;
      case 'lmg': return 1080;
      case 'dmr': case 'rail': return 840;
      case 'rpg': return 620;
      case 'flamer': return 560;
      default: return 980;
    }
  }

  private reloadSampleRate(weaponType: Exclude<WeaponSoundType, 'drone'>): number {
    return weaponType === 'smg' || weaponType === 'lmg' ? 1.08
      : weaponType === 'dmr' || weaponType === 'rail' ? .92
        : weaponType === 'rpg' ? .82 : .98;
  }

  private lastEmptyClickTime = 0;
  emptyClick(): void {
    const now = performance.now();
    if (now - this.lastEmptyClickTime < 180) return;
    this.lastEmptyClickTime = now;
    this.reloadClack(0, 520, 2600, 0.16);
  }

  /** A short, grounded impact and air rush for the rage skill, with no arcade-like pitch sweep. */
  rageActivate(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impact.type = 'triangle';
    impact.frequency.setValueAtTime(118, t);
    impact.frequency.exponentialRampToValueAtTime(56, t + 0.22);
    impactGain.gain.setValueAtTime(0.0001, t);
    impactGain.gain.linearRampToValueAtTime(0.34, t + 0.012);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    impact.connect(impactGain); impactGain.connect(this.sfxGain);
    impact.onended = () => { impact.disconnect(); impactGain.disconnect(); };
    impact.start(t); impact.stop(t + 0.27);

    if (this.noiseBuffer) {
      const rush = ctx.createBufferSource();
      const rushFilter = ctx.createBiquadFilter();
      const rushGain = ctx.createGain();
      rush.buffer = this.noiseBuffer;
      rush.playbackRate.value = 0.82;
      rushFilter.type = 'bandpass';
      rushFilter.frequency.setValueAtTime(540, t + 0.008);
      rushFilter.frequency.exponentialRampToValueAtTime(1450, t + 0.11);
      rushFilter.frequency.exponentialRampToValueAtTime(680, t + 0.2);
      rushFilter.Q.value = 0.72;
      rushGain.gain.setValueAtTime(0.0001, t);
      rushGain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      rushGain.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
      rush.connect(rushFilter); rushFilter.connect(rushGain); rushGain.connect(this.sfxGain);
      rush.onended = () => { rush.disconnect(); rushFilter.disconnect(); rushGain.disconnect(); };
      rush.start(t, Math.random() * 0.5, 0.22); rush.stop(t + 0.23);
    }
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
  private lastHealingSoundTime = 0;

  playerHit(): void {
    const now = performance.now();
    if (now - this.lastPlayerHitTime < 180) return;
    this.lastPlayerHitTime = now;
    this.playTone(180, 0.1, 'triangle', 0.22);
  }

  /** Soft, sustained recovery cue with an airy texture; no arcade-style beeps. */
  healing(): void {
    const now = performance.now();
    if (now - this.lastHealingSoundTime < 260) return;
    this.lastHealingSoundTime = now;
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    for (const [frequency, delay, peak] of [[174, 0, .075], [261, .055, .038]] as const) {
      const voice = ctx.createOscillator();
      const envelope = ctx.createGain();
      voice.type = 'sine';
      voice.frequency.setValueAtTime(frequency, t + delay);
      envelope.gain.setValueAtTime(.0001, t + delay);
      envelope.gain.linearRampToValueAtTime(peak, t + delay + .11);
      envelope.gain.setValueAtTime(peak * .72, t + delay + .25);
      envelope.gain.exponentialRampToValueAtTime(.001, t + delay + .68);
      voice.connect(envelope); envelope.connect(this.sfxGain);
      voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
      voice.start(t + delay); voice.stop(t + delay + .7);
    }

    if (this.noiseBuffer) {
      const breath = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      breath.buffer = this.noiseBuffer;
      breath.playbackRate.value = .82;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1050, t);
      filter.frequency.exponentialRampToValueAtTime(360, t + .56);
      envelope.gain.setValueAtTime(.0001, t);
      envelope.gain.linearRampToValueAtTime(.045, t + .08);
      envelope.gain.exponentialRampToValueAtTime(.001, t + .6);
      breath.connect(filter); filter.connect(envelope); envelope.connect(this.sfxGain);
      breath.onended = () => { breath.disconnect(); filter.disconnect(); envelope.disconnect(); };
      breath.start(t, Math.random() * .3, .62); breath.stop(t + .62);
    }
  }

  /** Quiet, weighty boot steps with a little grit; cadence follows player speed. */
  updatePlayerFootsteps(dt: number, moving: boolean, speed: number): void {
    if (!moving || speed < 24) {
      this.playerFootstepTimer = 0;
      return;
    }

    this.playerFootstepTimer -= dt;
    if (this.playerFootstepTimer > 0) return;
    this.playerFootstepTimer = Math.max(0.25, Math.min(0.43, 0.43 * 180 / Math.max(120, speed))) * (0.92 + Math.random() * 0.16);
    this.playerFootstep();
  }

  private playerFootstep(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const variation = 0.94 + Math.random() * 0.12;

    // A muted sole impact and short concrete grit, kept well below weapon level.
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(92 * variation, t);
    thud.frequency.exponentialRampToValueAtTime(48 * variation, t + 0.085);
    thudGain.gain.setValueAtTime(0.115, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.105);
    thud.connect(thudGain);
    thudGain.connect(this.sfxGain);
    thud.start(t);
    thud.stop(t + 0.11);

    if (this.noiseBuffer) {
      const grit = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gritGain = ctx.createGain();
      grit.buffer = this.noiseBuffer;
      grit.playbackRate.value = 0.72 + Math.random() * 0.18;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(620 + Math.random() * 180, t);
      filter.Q.value = 0.8;
      gritGain.gain.setValueAtTime(0.052, t);
      gritGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      grit.connect(filter);
      filter.connect(gritGain);
      gritGain.connect(this.sfxGain);
      grit.start(t, Math.random());
      grit.stop(t + 0.08);
    }
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

  /** Audible windup cue for a committed creature ability, spatially panned to its source. */
  creatureTelegraph(type: string, kind: string, pan = 0, distance = 0, boss = false, bossId = 0): void {
    const now = performance.now();
    const gain = this.creatureDistanceGain(distance);
    if (gain < 0.035 || now - this.lastCreatureTelegraphTime < 115) return;
    this.lastCreatureTelegraphTime = now;
    if (boss) {
      const id = bossId || getBossIdFromType(type);
      // Keep a subdued creature voice under the authored, low-frequency tell.
      this.playZombieVocal(type, pan, 0.36 * gain, 0.72, 'attack');
      this.playBossSignatureCue(id, kind, 'windup', pan, 0.34 * gain);
      return;
    }
    this.playZombieVocal(type, pan, 0.62 * gain, 0.42, 'attack');
    const pitch = kind === 'fan' || kind === 'ring' || kind === 'web' ? 210 : 138;
    this.playPannedCreatureTone(pitch, pitch * (kind === 'charge' || kind === 'thrust' ? 1.72 : 1.28),
      0.32, 0.042, 'sine', pan);
  }

  /** Short release sound so each melee, projectile, or area skill has a clear audible impact. */
  creatureSkill(type: string, kind: string, pan = 0, distance = 0, boss = false, bossId = 0, material = kind): void {
    const now = performance.now();
    const gain = this.creatureDistanceGain(distance);
    if (gain < 0.035 || now - this.lastCreatureSkillTime < 105) return;
    this.lastCreatureSkillTime = now;
    if (boss) {
      this.playBossSignatureCue(bossId || getBossIdFromType(type), kind, 'cast', pan, 0.42 * gain, material);
      return;
    }
    const ranged = ['fan', 'ring', 'web', 'spit', 'projectile', 'cross'].includes(kind);
    const heavy = ['slam', 'stomp', 'charge'].includes(kind);
    const start = ranged ? 360 : heavy ? 105 : 230;
    const end = ranged ? 115 : 42;
    const duration = heavy ? 0.31 : ranged ? 0.2 : 0.16;
    this.playPannedCreatureTone(start, end, duration, 0.09 * gain,
      ranged ? 'sawtooth' : 'triangle', pan);
    this.playPannedCreatureNoise(duration * 0.78, 950 + (ranged ? 720 : 0), 0.05 * gain, pan);
  }

  /** Material-specific, spatialized hit cue for a boss projectile. */
  bossProjectileImpact(projectileType: string, pan = 0, distance = 0, bossId = 0): void {
    const now = performance.now();
    const gain = this.creatureDistanceGain(distance);
    if (gain < 0.035 || now - this.lastBossImpactTime < 72) return;
    this.lastBossImpactTime = now;
    this.playBossSignatureCue(bossId || 1, projectileType, 'impact', pan, 0.26 * gain, projectileType);
  }

  /** A quiet material-specific pass-by cue, rate-limited to keep volleys readable. */
  bossProjectilePass(projectileType: string, pan = 0, distance = 0, bossId = 0): void {
    const now = performance.now();
    const gain = this.creatureDistanceGain(distance);
    if (gain < 0.12 || now - this.lastBossProjectilePassTime < 185) return;
    this.lastBossProjectilePassTime = now;
    this.playBossSignatureCue(bossId || 1, projectileType, 'flight', pan, 0.12 * gain, projectileType);
  }

  /** Low, layered boss cues use unstable throat formants and filtered air, never arcade pitch beeps. */
  private playBossSignatureCue(bossId: number, kind: string, event: 'windup' | 'cast' | 'flight' | 'impact',
    pan: number, volume: number, material = kind): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || !this.noiseBuffer || volume < 0.025 || this.activeBossCueVoices >= 4) return;
    const ctx = this.ctx;
    const signature = getBossSignature(bossId);
    const profile = signature.audio;
    const t = ctx.currentTime;
    const duration = event === 'windup' ? 0.62 : event === 'impact' ? 0.28 : event === 'flight' ? 0.18 : 0.37;
    const end = t + duration;
    const variation = 0.96 + Math.random() * 0.08;
    const root = profile.rootHz * variation;
    const materialFilter = material.includes('fire') ? 1260 : material.includes('arcane') || material === 'boss_orb'
      ? 1740 : material.includes('acid') ? 470 : material.includes('blood') || material.includes('wave') ? 360 : profile.textureHz;
    const bus = ctx.createGain();
    const panner = ctx.createStereoPanner();
    bus.gain.setValueAtTime(0.0001, t);
    const peak = volume * (event === 'windup' ? 0.74 : event === 'flight' ? 0.52 : 0.9);
    if (event === 'windup') {
      bus.gain.linearRampToValueAtTime(peak * 0.38, t + 0.14);
      bus.gain.linearRampToValueAtTime(peak, t + duration * 0.72);
    } else {
      bus.gain.linearRampToValueAtTime(peak, t + (event === 'impact' ? 0.008 : 0.025));
    }
    bus.gain.exponentialRampToValueAtTime(0.0001, end);
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    bus.connect(panner); panner.connect(this.sfxGain);

    const nodes: AudioNode[] = [bus, panner];
    let remaining = 0;
    this.activeBossCueVoices++;
    const track = (source: AudioScheduledSourceNode, startSource?: () => void) => {
      nodes.push(source); remaining++;
      source.onended = () => {
        if (--remaining !== 0) return;
        for (const node of nodes) node.disconnect();
        this.activeBossCueVoices = Math.max(0, this.activeBossCueVoices - 1);
      };
      if (startSource) startSource(); else source.start(t);
      source.stop(end + 0.02);
    };

    const throat = ctx.createBiquadFilter();
    const throatGain = ctx.createGain();
    throat.type = 'lowpass';
    throat.frequency.setValueAtTime(profile.throatHz * 1.25, t);
    throat.frequency.exponentialRampToValueAtTime(profile.throatHz * 0.72, end);
    throat.Q.value = profile.filterQ;
    throatGain.gain.value = event === 'windup' ? 0.64 : 0.78;
    throat.connect(throatGain); throatGain.connect(bus); nodes.push(throat, throatGain);
    const drone = ctx.createOscillator();
    drone.type = profile.waveform;
    drone.frequency.setValueAtTime(root * (event === 'cast' ? 1.16 : 0.94), t);
    drone.frequency.exponentialRampToValueAtTime(root * (event === 'windup' ? 1.04 : 0.66), end);
    drone.connect(throat); track(drone);

    const harmonicFilter = ctx.createBiquadFilter();
    const harmonicGain = ctx.createGain();
    harmonicFilter.type = 'bandpass'; harmonicFilter.frequency.value = profile.throatHz * 1.85;
    harmonicFilter.Q.value = Math.max(.7, profile.filterQ * .82);
    harmonicGain.gain.value = event === 'windup' ? 0.13 : 0.19;
    harmonicFilter.connect(harmonicGain); harmonicGain.connect(bus); nodes.push(harmonicFilter, harmonicGain);
    const harmonic = ctx.createOscillator();
    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(root * profile.harmonicRatio, t);
    harmonic.frequency.exponentialRampToValueAtTime(root * profile.harmonicRatio * .84, end);
    harmonic.connect(harmonicFilter); track(harmonic);

    const textureFilter = ctx.createBiquadFilter();
    const textureGain = ctx.createGain();
    textureFilter.type = 'bandpass';
    textureFilter.frequency.setValueAtTime(materialFilter, t);
    textureFilter.frequency.exponentialRampToValueAtTime(Math.max(170, materialFilter * .56), end);
    textureFilter.Q.value = material.includes('shard') ? 1.8 : .72;
    textureGain.gain.value = event === 'windup' ? .2 : event === 'flight' ? .24 : .32;
    textureFilter.connect(textureGain); textureGain.connect(bus); nodes.push(textureFilter, textureGain);
    const texture = ctx.createBufferSource();
    texture.buffer = this.noiseBuffer;
    texture.playbackRate.value = event === 'impact' ? .68 : event === 'flight' ? .92 + Math.random() * .12 : .52 + Math.random() * .14;
    texture.connect(textureFilter); track(texture, () => texture.start(t, Math.random() * 1.2, duration));
  }

  private playPannedCreatureTone(startHz: number, endHz: number, duration: number, volume: number,
    waveform: OscillatorType, pan: number): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || volume < 0.003) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = waveform;
    osc.frequency.setValueAtTime(Math.max(1, startHz), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + Math.min(0.025, duration * 0.18));
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    osc.connect(gain); gain.connect(panner); panner.connect(this.sfxGain);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); panner.disconnect(); };
    osc.start(t); osc.stop(t + duration + 0.01);
  }

  private playPannedCreatureNoise(duration: number, centerHz: number, volume: number, pan: number): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || !this.noiseBuffer || volume < 0.003) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.72 + Math.random() * 0.3;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerHz, t);
    filter.Q.value = 0.72;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    source.connect(filter); filter.connect(gain); gain.connect(panner); panner.connect(this.sfxGain);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); panner.disconnect(); };
    source.start(t, Math.random() * 0.2, duration);
    source.stop(t + duration + 0.01);
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
      priority: event === 'attack' ? 2 : event === 'death' ? 1 : 0,
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

  creditPickup(): void {
    const now = performance.now();
    if (now - this.lastCreditPickupTime < 85) return;
    this.lastCreditPickupTime = now;
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 1.4 + Math.random() * .25;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1400 + Math.random() * 250;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.linearRampToValueAtTime(.16, t + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .075);
    source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
    source.start(t, Math.random() * .2, .08);
    source.stop(t + .085);
    this.playTone(740 + Math.random() * 70, .045, 'triangle', .07);
  }

  supplyPickup(kind: 'ammo' | 'med' | 'crate'): void {
    const now = performance.now();
    if (now - this.lastSupplyPickupTime < 120) return;
    this.lastSupplyPickupTime = now;
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = kind === 'ammo' ? .82 : kind === 'med' ? 1.15 : .68;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = kind === 'med' ? 1250 : kind === 'ammo' ? 780 : 560;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.linearRampToValueAtTime(.095, t + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .10);
    source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
    source.start(t, 0, .11); source.stop(t + .12);
  }

  levelUp(): void {
    this.playTone(523, 0.1, 'sine', 0.28);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.28), 100);
    setTimeout(() => this.playTone(784, 0.15, 'sine', 0.28), 200);
  }

  /** A weighty, non-musical confirmation for completing a Campaign objective. */
  objectiveComplete(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastObjectiveSoundTime < 120) return;
    this.lastObjectiveSoundTime = nowMs;
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Low body impact with a short, gritty mechanical tail instead of a rising arcade chime.
    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impact.type = 'triangle';
    impact.frequency.setValueAtTime(96, t);
    impact.frequency.exponentialRampToValueAtTime(43, t + .38);
    impactGain.gain.setValueAtTime(.0001, t);
    impactGain.gain.linearRampToValueAtTime(.34, t + .012);
    impactGain.gain.exponentialRampToValueAtTime(.001, t + .44);
    impact.connect(impactGain); impactGain.connect(this.sfxGain);
    impact.onended = () => { impact.disconnect(); impactGain.disconnect(); };
    impact.start(t); impact.stop(t + .45);

    const resonance = ctx.createOscillator();
    const resonanceGain = ctx.createGain();
    resonance.type = 'sine';
    resonance.frequency.setValueAtTime(186, t + .018);
    resonance.frequency.exponentialRampToValueAtTime(112, t + .31);
    resonanceGain.gain.setValueAtTime(.0001, t);
    resonanceGain.gain.linearRampToValueAtTime(.105, t + .035);
    resonanceGain.gain.exponentialRampToValueAtTime(.001, t + .34);
    resonance.connect(resonanceGain); resonanceGain.connect(this.sfxGain);
    resonance.onended = () => { resonance.disconnect(); resonanceGain.disconnect(); };
    resonance.start(t + .018); resonance.stop(t + .35);

    if (this.noiseBuffer) {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gritGain = ctx.createGain();
      source.buffer = this.noiseBuffer;
      source.playbackRate.value = .72 + Math.random() * .12;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1150, t);
      filter.frequency.exponentialRampToValueAtTime(210, t + .29);
      gritGain.gain.setValueAtTime(.0001, t);
      gritGain.gain.linearRampToValueAtTime(.21, t + .009);
      gritGain.gain.exponentialRampToValueAtTime(.001, t + .32);
      source.connect(filter); filter.connect(gritGain); gritGain.connect(this.sfxGain);
      source.onended = () => { source.disconnect(); filter.disconnect(); gritGain.disconnect(); };
      source.start(t, Math.random() * .25, .33); source.stop(t + .34);
    }
  }

  /** A quiet relay clunk used when a player starts a hold-style objective. */
  objectiveActivate(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = .66;
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(760, t); filter.Q.value = .8;
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.linearRampToValueAtTime(.16, t + .007);
    gain.gain.exponentialRampToValueAtTime(.001, t + .12);
    source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(t, Math.random() * .2, .13); source.stop(t + .14);
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
    const nowMs = performance.now();
    if (nowMs - this.lastGameOverTime < 500) return;
    this.lastGameOverTime = nowMs;
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // One collapsing low impact and a filtered, descending groan; no discrete death jingle.
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(78, t);
    body.frequency.exponentialRampToValueAtTime(27, t + .9);
    bodyGain.gain.setValueAtTime(.0001, t);
    bodyGain.gain.linearRampToValueAtTime(.42, t + .025);
    bodyGain.gain.exponentialRampToValueAtTime(.001, t + 1.02);
    body.connect(bodyGain); bodyGain.connect(this.sfxGain);
    body.onended = () => { body.disconnect(); bodyGain.disconnect(); };
    body.start(t); body.stop(t + 1.04);

    const voice = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const voiceGain = ctx.createGain();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(172, t + .035);
    voice.frequency.exponentialRampToValueAtTime(34, t + .82);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(390, t);
    filter.frequency.exponentialRampToValueAtTime(95, t + .85);
    voiceGain.gain.setValueAtTime(.0001, t);
    voiceGain.gain.linearRampToValueAtTime(.13, t + .06);
    voiceGain.gain.exponentialRampToValueAtTime(.001, t + .9);
    voice.connect(filter); filter.connect(voiceGain); voiceGain.connect(this.sfxGain);
    voice.onended = () => { voice.disconnect(); filter.disconnect(); voiceGain.disconnect(); };
    voice.start(t + .035); voice.stop(t + .92);

    if (this.noiseBuffer) {
      const source = ctx.createBufferSource();
      const lowpass = ctx.createBiquadFilter();
      const noiseGain = ctx.createGain();
      source.buffer = this.noiseBuffer;
      source.playbackRate.value = .58;
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(520, t);
      lowpass.frequency.exponentialRampToValueAtTime(115, t + .75);
      noiseGain.gain.setValueAtTime(.0001, t);
      noiseGain.gain.linearRampToValueAtTime(.28, t + .018);
      noiseGain.gain.exponentialRampToValueAtTime(.001, t + .78);
      source.connect(lowpass); lowpass.connect(noiseGain); noiseGain.connect(this.sfxGain);
      source.onended = () => { source.disconnect(); lowpass.disconnect(); noiseGain.disconnect(); };
      source.start(t, Math.random() * .2, .8); source.stop(t + .81);
    }
  }

  revive(): void {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pulse = ctx.createOscillator();
    const pulseGain = ctx.createGain();
    pulse.type = 'sine';
    pulse.frequency.setValueAtTime(46, t);
    pulse.frequency.exponentialRampToValueAtTime(69, t + .12);
    pulse.frequency.exponentialRampToValueAtTime(42, t + .48);
    pulseGain.gain.setValueAtTime(.0001, t);
    pulseGain.gain.linearRampToValueAtTime(.26, t + .025);
    pulseGain.gain.exponentialRampToValueAtTime(.001, t + .52);
    pulse.connect(pulseGain); pulseGain.connect(this.sfxGain);
    pulse.onended = () => { pulse.disconnect(); pulseGain.disconnect(); };
    pulse.start(t); pulse.stop(t + .53);

    const breath = ctx.createBufferSource();
    const highpass = ctx.createBiquadFilter();
    const breathGain = ctx.createGain();
    breath.buffer = this.noiseBuffer;
    breath.playbackRate.value = .82;
    highpass.type = 'highpass'; highpass.frequency.value = 420;
    breathGain.gain.setValueAtTime(.0001, t);
    breathGain.gain.linearRampToValueAtTime(.12, t + .08);
    breathGain.gain.exponentialRampToValueAtTime(.001, t + .42);
    breath.connect(highpass); highpass.connect(breathGain); breathGain.connect(this.sfxGain);
    breath.onended = () => { breath.disconnect(); highpass.disconnect(); breathGain.disconnect(); };
    breath.start(t, Math.random() * .2, .44); breath.stop(t + .45);
  }

  menuSelect(): void {
    this.playTone(600, 0.08, 'sine', 0.18);
  }
}
