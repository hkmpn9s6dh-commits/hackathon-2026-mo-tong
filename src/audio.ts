/** Everything you hear is synthesised; the game ships no audio files. */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private brushGain: GainNode | null = null;
  private brushFilter: BiquadFilterNode | null = null;
  muted = false;

  ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startBrushBed();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private startBrushBed(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const len = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    this.brushGain = gain;
    this.brushFilter = filter;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  /** call every frame while drawing; speed is px per frame */
  brush(speed: number): void {
    if (!this.ctx || !this.brushGain || !this.brushFilter) return;
    const target = Math.min(0.16, speed * 0.006);
    this.brushGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    this.brushFilter.frequency.setTargetAtTime(900 + Math.min(2600, speed * 55), this.ctx.currentTime, 0.08);
  }

  brushOff(): void {
    if (!this.ctx || !this.brushGain) return;
    this.brushGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** pentatonic chime, index walks up the scale as dots are taken */
  pluck(index: number): void {
    const scale = [523.25, 587.33, 698.46, 783.99, 880.0, 1046.5, 1174.66];
    const f = scale[Math.min(scale.length - 1, index)];
    this.tone(f, 0.5, 'triangle', 0.16);
    this.tone(f * 2, 0.24, 'sine', 0.05, 0.01);
  }

  /** the shadow takes a dot: same note, duller */
  shadowNote(index: number): void {
    const scale = [261.63, 293.66, 349.23, 392.0, 440.0];
    const f = scale[Math.min(scale.length - 1, index)];
    this.tone(f, 0.7, 'sine', 0.11);
  }

  seal(): void {
    this.tone(146.83, 0.9, 'sine', 0.2);
    this.tone(98, 1.2, 'sine', 0.14, 0.02);
    this.tone(440, 0.3, 'triangle', 0.05, 0.01);
  }

  bump(): void {
    this.tone(90, 0.18, 'sine', 0.12);
  }

  airy(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t0);
    osc.frequency.exponentialRampToValueAtTime(560, t0 + 0.6);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.06, t0 + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 1);
  }

  finish(): void {
    [392, 523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 1.1, 'sine', 0.11, i * 0.11));
  }

  sad(): void {
    this.tone(196, 0.5, 'sine', 0.12);
    this.tone(147, 0.7, 'sine', 0.1, 0.12);
  }
}
