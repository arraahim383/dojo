// Short, quiet Web Audio cues. No sound files or network access are needed.
class SoundEffectsService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  public setEnabled(value: boolean) {
    this.enabled = value;
  }

  public isEnabled() {
    return this.enabled;
  }

  private audio() {
    if (typeof window === 'undefined' || !this.enabled) return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      this.ctx = new AudioContextClass();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.34;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  private tone(frequency: number, duration: number, waveform: OscillatorType = 'sine', volume = 0.12, delay = 0) {
    const ctx = this.audio();
    if (!ctx || !this.master) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  private woodClick(intensity = 1) {
    const ctx = this.audio();
    if (!ctx || !this.master) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.045));
    const noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const channel = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) channel[i] = (Math.random() * 2 - 1) * (1 - i / length);

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = intensity > 1 ? 1450 : 1000;
    envelope.gain.setValueAtTime(0.0001, ctx.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.16 * intensity, ctx.currentTime + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    source.buffer = noise;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start();

    this.tone(intensity > 1 ? 155 : 190, 0.055, 'triangle', 0.08 * intensity);
  }

  public playMove() {
    this.woodClick();
  }

  public playCapture() {
    this.woodClick(1.35);
  }

  public playCheck() {
    this.tone(620, 0.1, 'sine', 0.07);
    this.tone(760, 0.12, 'sine', 0.055, 0.075);
  }

  public playCastle() {
    this.woodClick();
    setTimeout(() => this.woodClick(), 85);
  }

  public playSuccess() {
    [392, 494, 587].forEach((frequency, index) => this.tone(frequency, 0.16, 'sine', 0.07, index * 0.085));
  }

  public playError() {
    this.tone(310, 0.08, 'triangle', 0.06);
    this.tone(245, 0.09, 'triangle', 0.05, 0.085);
  }

  public playWarning() {
    this.tone(440, 0.13, 'sine', 0.055);
  }
}

export const sound = new SoundEffectsService();
