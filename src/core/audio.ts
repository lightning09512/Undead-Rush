// ─── Audio: WebAudio placeholder sound system ───

export class Audio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch {
      // WebAudio not available
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.3): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, volume = 0.2): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
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
    gain.connect(this.masterGain);
    source.start();
  }

  shoot(): void {
    this.playTone(800, 0.08, 'square', 0.15);
  }

  hit(): void {
    this.playNoise(0.06, 0.12);
  }

  playerHit(): void {
    this.playTone(200, 0.15, 'sawtooth', 0.2);
  }

  zombieDie(): void {
    this.playTone(120, 0.12, 'square', 0.1);
  }

  xpPickup(): void {
    this.playTone(1200, 0.06, 'sine', 0.1);
  }

  levelUp(): void {
    this.playTone(523, 0.1, 'sine', 0.25);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.25), 100);
    setTimeout(() => this.playTone(784, 0.15, 'sine', 0.25), 200);
  }

  explosion(): void {
    this.playNoise(0.3, 0.3);
    this.playTone(60, 0.3, 'sine', 0.3);
  }

  gameOver(): void {
    this.playTone(400, 0.2, 'sawtooth', 0.3);
    setTimeout(() => this.playTone(300, 0.2, 'sawtooth', 0.3), 200);
    setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 0.3), 400);
  }

  menuSelect(): void {
    this.playTone(600, 0.08, 'sine', 0.15);
  }
}
