export class SoundSynth {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;

    this.isEnabled = false;
    this.nextNoteTime = 0;
    this.step = 0;
    this.bpm = 125;

    this.bassline = [
      65.41, 65.41, 77.78, 65.41,
      87.31, 87.31, 116.54, 98.00,
      65.41, 65.41, 77.78, 65.41,
      87.31, 98.00, 77.78, 58.27
    ];

    this.leadSeq = [
      261.63, 0, 311.13, 0, 349.23, 392.00, 0, 466.16,
      261.63, 0, 311.13, 392.00, 349.23, 0, 293.66, 0
    ];
  }

  init() {
    if (this.ctx) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.initEngineSound();
      this.isEnabled = true;
      this.nextNoteTime = this.ctx.currentTime;
    } catch (e) {
      console.warn("Web Audio API not supported or blocked: ", e);
    }
  }

  initEngineSound() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(70, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(150, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(4, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc.start(0);
  }

  updateEngine(speedRatio, steerAmount) {
    if (!this.isEnabled || !this.ctx) return;

    const baseFreq = 65 + speedRatio * 35 + Math.abs(steerAmount) * 20;
    const filterFreq = 120 + speedRatio * 200 + Math.abs(steerAmount) * 100;

    this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.1);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.15);
    this.engineGain.gain.setTargetAtTime(0.04 + speedRatio * 0.04, this.ctx.currentTime, 0.2);
  }

  updateMusic(dt, currentSpeed) {
    if (!this.isEnabled || !this.ctx || this.ctx.state === 'suspended') return;

    const speedFactor = Math.min(1.0, (currentSpeed - 30) / 100);
    this.bpm = 120 + speedFactor * 40;

    const stepDuration = 60 / this.bpm / 2;

    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.playSequencerStep(this.nextNoteTime, stepDuration);
      this.nextNoteTime += stepDuration;
      this.step = (this.step + 1) % 16;
    }
  }

  playSequencerStep(time, duration) {
    const bassFreq = this.bassline[this.step];
    if (bassFreq > 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(bassFreq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, time);
      filter.frequency.exponentialRampToValueAtTime(80, time + duration * 0.8);

      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + duration * 0.95);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + duration);
    }

    if (this.step % 2 === 0) {
      const leadFreq = this.leadSeq[this.step];
      if (leadFreq > 0 && Math.random() > 0.4) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(leadFreq * 2, time);

        gain.gain.setValueAtTime(0.03, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 1.5);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + duration * 1.5);
      }
    }

    if (this.step === 4 || this.step === 12) {
      this.playSnareNoise(time, 0.1);
    } else if (this.step % 2 !== 0 && Math.random() > 0.3) {
      this.playHihatNoise(time, 0.03);
    }
  }

  playSnareNoise(time, duration) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + duration * 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + duration);
  }

  playHihatNoise(time, duration) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.02, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + duration);
  }

  triggerExplosion() {
    if (!this.isEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 1.8;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + duration * 0.6);

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + duration * 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    noise.start(now);
    osc.stop(now + duration);
    noise.stop(now + duration);
  }

  triggerNearMiss() {
    if (!this.isEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const playBeep = (time, freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.1);
    };

    playBeep(now, 1000);
    playBeep(now + 0.06, 1300);
  }

  triggerCollect() {
    if (!this.isEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.15, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.2);
    });
  }

  triggerShieldBreak() {
    if (!this.isEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 0.5;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(100, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  toggle() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
        return true;
      } else if (this.ctx.state === 'running') {
        this.ctx.suspend();
        return false;
      }
    } else {
      this.init();
      return this.isEnabled;
    }
  }
}
