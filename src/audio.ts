/* Lightweight WebAudio feedback: ion-drive hum + UI blips. */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private oscA: OscillatorNode | null = null;
  private oscB: OscillatorNode | null = null;
  private noiseGain: GainNode | null = null;
  private muted = false;
  private smoothThrottle = 0;

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(ctx.destination);

      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.frequency.value = 320;
      this.engineFilter.Q.value = 1.1;

      this.oscA = ctx.createOscillator();
      this.oscA.type = "sawtooth";
      this.oscA.frequency.value = 52;
      this.oscB = ctx.createOscillator();
      this.oscB.type = "triangle";
      this.oscB.frequency.value = 78;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.5;
      this.oscA.connect(oscGain);
      this.oscB.connect(oscGain);
      oscGain.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);

      // airy noise layer
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900;
      bp.Q.value = 0.6;
      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.value = 0;
      noise.connect(bp);
      bp.connect(this.noiseGain);
      this.noiseGain.connect(this.master);

      this.oscA.start();
      this.oscB.start();
      noise.start();
    } catch {
      this.ctx = null;
    }
  }

  setEngine(throttle: number, boost: boolean) {
    if (!this.ctx || !this.engineGain || !this.oscA || !this.oscB || !this.engineFilter || !this.noiseGain) return;
    const t = this.ctx.currentTime;
    const th = Math.max(0, Math.min(1, throttle));
    this.smoothThrottle += (th - this.smoothThrottle) * 0.08;
    const s = this.smoothThrottle;
    const base = 46 + s * 64 + (boost ? 38 : 0);
    this.oscA.frequency.setTargetAtTime(base, t, 0.09);
    this.oscB.frequency.setTargetAtTime(base * 1.503, t, 0.09);
    this.engineFilter.frequency.setTargetAtTime(240 + s * 700 + (boost ? 500 : 0), t, 0.1);
    this.engineGain.gain.setTargetAtTime(s > 0.01 ? 0.028 + s * 0.075 + (boost ? 0.03 : 0) : 0, t, 0.12);
    this.noiseGain.gain.setTargetAtTime(s * 0.02 + (boost ? 0.014 : 0), t, 0.15);
  }

  blip(freq = 840, dur = 0.07, vol = 0.06) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.55), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  dispose() {
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        /* noop */
      }
      this.ctx = null;
    }
  }
}

export const audio = new AudioEngine();
