/**
 * Vector Rush - 3D Endless Runner Game Engine
 * Core mechanics: Pseudo-3D Projection, Web Audio API Sound Synth, Particles, Near Misses, Touch zones.
 */

// --- Audio Synthesizer Class ---
class SoundSynth {
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
    
    // Cyberpunk bassline notes (frequencies in Hz)
    // C2, Eb2, F2, Bb2 and variations
    this.bassline = [
      65.41, 65.41, 77.78, 65.41, 
      87.31, 87.31, 116.54, 98.00, 
      65.41, 65.41, 77.78, 65.41, 
      87.31, 98.00, 77.78, 58.27
    ];
    
    // High lead melody sequence
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
      this.masterGain.gain.setValueAtTime(0.2, this.ctx.currentTime); // Keep volume moderate
      this.masterGain.connect(this.ctx.destination);
      
      this.initEngineSound();
      this.isEnabled = true;
      this.nextNoteTime = this.ctx.currentTime;
    } catch (e) {
      console.warn("Web Audio API not supported or blocked: ", e);
    }
  }

  initEngineSound() {
    // Engine hum: low sawtooth oscillator + lowpass filter
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(70, this.ctx.currentTime);
    
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(150, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(4, this.ctx.currentTime);
    
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.05, this.ctx.currentTime); // Faint background hum
    
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    
    this.engineOsc.start(0);
  }

  updateEngine(speedRatio, steerAmount) {
    if (!this.isEnabled || !this.ctx) return;
    
    // Modulate pitch and filter frequency based on speed and steering inputs
    const baseFreq = 65 + speedRatio * 35 + Math.abs(steerAmount) * 20;
    const filterFreq = 120 + speedRatio * 200 + Math.abs(steerAmount) * 100;
    
    this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.1);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.15);
    this.engineGain.gain.setTargetAtTime(0.04 + speedRatio * 0.04, this.ctx.currentTime, 0.2);
  }

  updateMusic(dt, currentSpeed) {
    if (!this.isEnabled || !this.ctx || this.ctx.state === 'suspended') return;
    
    // Dynamically adjust BPM with game speed (starts at 120, max 160)
    const speedFactor = Math.min(1.0, (currentSpeed - 30) / 100);
    this.bpm = 120 + speedFactor * 40;
    
    const stepDuration = 60 / this.bpm / 2; // Eighth notes
    
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.playSequencerStep(this.nextNoteTime, stepDuration);
      this.nextNoteTime += stepDuration;
      this.step = (this.step + 1) % 16;
    }
  }

  playSequencerStep(time, duration) {
    // 1. Play Bass Note
    const bassFreq = this.bassline[this.step];
    if (bassFreq > 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      
      // Cyberpunk deep bass synth: triangle/saw combo or fat triangle
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
    
    // 2. Play Melodic Lead note on alternate steps
    if (this.step % 2 === 0) {
      const leadFreq = this.leadSeq[this.step];
      // Randomly enable melody lead variations to make it procedural
      if (leadFreq > 0 && Math.random() > 0.4) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(leadFreq * 2, time); // Octave up
        
        gain.gain.setValueAtTime(0.03, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 1.5);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(time);
        osc.stop(time + duration * 1.5);
      }
    }
    
    // 3. Play Procedural Cyber-snare/hi-hat on steps 4, 12 (snare) and odds (hi-hat)
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

  // --- Sound Effects Synthesizers ---
  
  triggerExplosion() {
    if (!this.isEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 1.8;
    
    // Low rumble oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + duration * 0.6);
    
    // Noise buffer for blast
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
    
    // Two rapid high-pitched sci-fi beeps
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
    
    // Synthesize an upward retro scale arpeggio (C5 -> E5 -> G5 -> C6)
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
    
    // Harsh digital crash (high pitch down sweep + short noise)
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

// --- Particle Engine ---
class Particle {
  constructor(x, y, z, vx, vy, vz, color, size, maxLife) {
    this.x = x; // 3D offset relative to track center or coordinates
    this.y = y;
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.color = color;
    this.size = size;
    this.maxLife = maxLife;
    this.life = maxLife;
  }

  update(dt, cameraZ) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.life -= dt;
  }
}

// --- Obstacle Class (3D bounding-box columns) ---
class Obstacle {
  constructor(xRelative, z, width, height, type) {
    this.x = xRelative;      // Horizontal offset relative to center of curving track
    this.y = 0;              // Rests on ground (y=0)
    this.z = z;              // Distance ahead of camera
    this.w = width;
    this.h = height;
    this.d = 8;              // 3D block depth
    this.type = type;        // 'pillar', 'arch', 'slide-left', 'slide-right'
    this.passed = false;
    this.nearMissChecked = false;
    
    // Sliders properties
    this.slideDir = type === 'slide-left' ? -1 : 1;
    this.slideSpeed = 22;    // units/sec horizontal slide speed
    this.slideRange = 30;    // max drift left/right
  }

  update(dt, currentSpeed) {
    // If it's a moving obstacle, slide it left/right relative to track
    if (this.type.startsWith('slide')) {
      this.x += this.slideDir * this.slideSpeed * dt;
      if (Math.abs(this.x) > this.slideRange) {
        this.x = Math.sign(this.x) * this.slideRange;
        this.slideDir *= -1; // reverse direction
      }
    }
  }

  // Draw solid wireframe faces with cyan/pink edges
  draw(ctx, camera, width, height, getCurve) {
    const halfW = this.w / 2;
    const h = this.h;
    const d = this.d;
    
    // Define 8 vertices of the 3D block
    // Front face
    const v1 = camera.project(this.x - halfW, 0, this.z, getCurve, width, height);
    const v2 = camera.project(this.x + halfW, 0, this.z, getCurve, width, height);
    const v3 = camera.project(this.x - halfW, h, this.z, getCurve, width, height);
    const v4 = camera.project(this.x + halfW, h, this.z, getCurve, width, height);
    
    // Back face
    const v5 = camera.project(this.x - halfW, 0, this.z + d, getCurve, width, height);
    const v6 = camera.project(this.x + halfW, 0, this.z + d, getCurve, width, height);
    const v7 = camera.project(this.x - halfW, h, this.z + d, getCurve, width, height);
    const v8 = camera.project(this.x + halfW, h, this.z + d, getCurve, width, height);
    
    // We only need to draw if they are projected
    if (!v1 || !v2 || !v3 || !v4 || !v5 || !v6 || !v7 || !v8) return;

    // Glowing pink/red color gradients
    const neonPink = '#ff007f';
    const transparentPink = 'rgba(255, 0, 127, 0.15)';
    
    ctx.lineWidth = Math.max(1, 2.5 * v1.scale / 100);
    ctx.strokeStyle = neonPink;
    ctx.shadowBlur = Math.min(20, v1.scale / 15);
    ctx.shadowColor = neonPink;
    
    // Draw polygon faces
    const drawFace = (a, b, c, d) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fillStyle = transparentPink;
      ctx.fill();
      ctx.stroke();
    };

    // Draw solid-looking 3D block by rendering relevant faces
    // Front face
    drawFace(v1, v2, v4, v3);
    // Back face
    drawFace(v5, v6, v8, v7);
    // Left face
    drawFace(v1, v5, v7, v3);
    // Right face
    drawFace(v2, v6, v8, v4);
    // Top face
    drawFace(v3, v4, v8, v7);

    // If it's an archway, draw a glowing floating crossbar connecting left/right rails
    if (this.type === 'arch') {
      const railGlow = '#00f3ff';
      ctx.strokeStyle = railGlow;
      ctx.shadowColor = railGlow;
      ctx.lineWidth = Math.max(2, 4 * v1.scale / 100);
      
      ctx.beginPath();
      ctx.moveTo(v3.x, v3.y);
      ctx.lineTo(v4.x, v4.y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(v7.x, v7.y);
      ctx.lineTo(v8.x, v8.y);
      ctx.stroke();
    }
    
    ctx.shadowBlur = 0; // reset
  }
}

// --- Power-up Class ---
class PowerUp {
  constructor(xRelative, z, type) {
    this.x = xRelative;
    this.y = 1.2;            // floats slightly above the ground
    this.z = z;
    this.type = type;        // 'shield', 'boost'
    this.collected = false;
    this.radius = 2.0;       // size for collision
    this.spin = 0;
  }

  update(dt) {
    this.spin += 2.5 * dt; // spin animation
    this.y = 1.0 + Math.sin(this.spin * 1.5) * 0.3; // bobbing up and down
  }

  draw(ctx, camera, width, height, getCurve) {
    const proj = camera.project(this.x, this.y, this.z, getCurve, width, height);
    if (!proj) return;

    const scale = proj.scale;
    const r = this.radius * scale;
    
    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.rotate(this.spin);
    
    if (this.type === 'shield') {
      // Draw spinning octahedron (shield) - Amber color
      const color = '#ffea00';
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = Math.min(25, scale / 8);
      ctx.lineWidth = Math.max(1.5, 2.5 * scale / 100);
      
      // Vertices of projected octahedron flat layout
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.8, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 234, 0, 0.15)';
      ctx.fill();
      ctx.stroke();
      
      // Center lines
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, 0);
      ctx.lineTo(r * 0.8, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();
    } else {
      // Draw double arrow chevron pointing forward (boost) - Green
      const color = '#39ff14';
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = Math.min(25, scale / 8);
      ctx.lineWidth = Math.max(2, 3 * scale / 100);
      
      // Draw 2 nested chevrons
      const drawChevron = (offsetY) => {
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, r * 0.4 + offsetY);
        ctx.lineTo(0, -r * 0.4 + offsetY);
        ctx.lineTo(r * 0.6, r * 0.4 + offsetY);
        ctx.stroke();
      };
      
      drawChevron(-r * 0.2);
      drawChevron(r * 0.3);
    }
    
    ctx.restore();
  }
}

// --- Player Ship representation ---
class PlayerShip {
  constructor() {
    this.x = 0;          // relative horizontal position (-40 to 40)
    this.y = 0.5;        // altitude offset
    this.z = 15;         // fixed forward offset from camera
    this.width = 4.2;
    this.height = 1.4;
    this.length = 6.0;
    
    this.roll = 0;       // ship roll angle based on steer velocity
    this.steerInput = 0; // -1 (left), 1 (right)
    this.velocity = 0;
    this.shield = 1;     // starts with shield active
    this.boostActive = 0;// duration of boost left (seconds)
    
    // Thruster scale parameter
    this.thrusterPulse = 0;
  }

  update(dt, speed, steerVelocity) {
    this.velocity = steerVelocity;
    // Ship tilts proportionally to velocity
    this.roll = -steerVelocity * 0.055;
    
    // Floating bounce animation
    this.thrusterPulse += dt * 25;
    this.y = 0.5 + Math.sin(this.thrusterPulse * 0.15) * 0.06;
    
    if (this.boostActive > 0) {
      this.boostActive -= dt;
    }
  }

  // Draw ship in 3D using project points from local coords
  draw(ctx, camera, width, height, getCurve) {
    // 3D coordinates relative to ship center
    // Nose, wings, fins, etc.
    const roll = this.roll;
    
    const rotateRoll = (xLocal, yLocal) => {
      const rx = xLocal * Math.cos(roll) - yLocal * Math.sin(roll);
      const ry = xLocal * Math.sin(roll) + yLocal * Math.cos(roll);
      return { x: rx, y: ry };
    };

    // Define spaceship local points in 3D relative to its center (0,0,0)
    const localPts = {
      nose:      { x: 0,    y: 0,     z: 4.0 },
      leftWing:  { x: -2.3, y: -0.4,  z: -2.0 },
      rightWing: { x: 2.3,  y: -0.4,  z: -2.0 },
      topFin:    { x: 0,    y: 1.1,   z: -2.5 },
      exhaust:   { x: 0,    y: -0.2,  z: -2.5 },
      belly:     { x: 0,    y: -0.4,  z: 0 }
    };

    // Convert local points to world coordinates (centered at ship x, y, z) and project
    const proj = {};
    for (const key in localPts) {
      const pt = localPts[key];
      // Rotate wings/fin around Z-axis (roll)
      const rot = rotateRoll(pt.x, pt.y);
      
      const worldX = this.x + rot.x;
      const worldY = this.y + rot.y;
      const worldZ = camera.z + this.z + pt.z;
      
      proj[key] = camera.project(worldX, worldY, worldZ, getCurve, width, height);
    }

    // Clip if nose is behind screen
    if (!proj.nose || !proj.leftWing || !proj.rightWing || !proj.topFin || !proj.exhaust || !proj.belly) return;

    const cyan = '#00f3ff';
    const pink = '#ff007f';
    const activeColor = this.boostActive > 0 ? '#39ff14' : cyan;
    
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = activeColor;
    ctx.shadowBlur = 15;
    ctx.shadowColor = activeColor;
    
    // Draw wireframe panels
    const drawLine = (ptA, ptB) => {
      ctx.beginPath();
      ctx.moveTo(ptA.x, ptA.y);
      ctx.lineTo(ptB.x, ptB.y);
      ctx.stroke();
    };
    
    const fillFace = (a, b, c, fillStyle) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
      ctx.stroke();
    };

    // Draw panels with slightly different translucent blue shading
    fillFace(proj.nose, proj.leftWing, proj.belly, 'rgba(0, 243, 255, 0.15)');
    fillFace(proj.nose, proj.rightWing, proj.belly, 'rgba(0, 243, 255, 0.15)');
    fillFace(proj.leftWing, proj.rightWing, proj.belly, 'rgba(0, 100, 200, 0.25)');
    
    // Draw Fin/wings outline in magenta/cyan highlight
    ctx.strokeStyle = pink;
    ctx.shadowColor = pink;
    fillFace(proj.nose, proj.topFin, proj.leftWing, 'rgba(255, 0, 127, 0.1)');
    fillFace(proj.nose, proj.topFin, proj.rightWing, 'rgba(255, 0, 127, 0.1)');
    
    // Draw cross thruster exhaust box
    ctx.strokeStyle = activeColor;
    ctx.shadowColor = activeColor;
    drawLine(proj.leftWing, proj.topFin);
    drawLine(proj.rightWing, proj.topFin);
    
    // Draw flame booster trail
    const flameScale = 1.0 + Math.sin(this.thrusterPulse) * 0.4;
    const flameLength = (this.boostActive > 0 ? 10 : 4) * flameScale;
    
    const flamePt = { x: 0, y: -0.2, z: -2.5 - flameLength };
    const rotFlame = rotateRoll(flamePt.x, flamePt.y);
    const projFlame = camera.project(this.x + rotFlame.x, this.y + rotFlame.y, camera.z + this.z + flamePt.z, getCurve, width, height);
    
    if (projFlame) {
      ctx.beginPath();
      ctx.moveTo(proj.exhaust.x, proj.exhaust.y);
      ctx.lineTo(proj.leftWing.x, proj.leftWing.y);
      ctx.lineTo(projFlame.x, projFlame.y);
      ctx.closePath();
      ctx.fillStyle = this.boostActive > 0 ? 'rgba(57, 255, 20, 0.4)' : 'rgba(255, 0, 127, 0.4)';
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(proj.exhaust.x, proj.exhaust.y);
      ctx.lineTo(proj.rightWing.x, proj.rightWing.y);
      ctx.lineTo(projFlame.x, projFlame.y);
      ctx.closePath();
      ctx.fillStyle = this.boostActive > 0 ? 'rgba(57, 255, 20, 0.2)' : 'rgba(0, 243, 255, 0.4)';
      ctx.fill();
    }

    // Shield Bubble (if shield active)
    if (this.shield > 0) {
      const shieldCenter = camera.project(this.x, this.y, this.z + 1.0, getCurve, width, height);
      if (shieldCenter) {
        ctx.beginPath();
        const shieldRadius = 6.0 * shieldCenter.scale;
        ctx.arc(shieldCenter.x, shieldCenter.y, shieldRadius, 0, Math.PI * 2);
        
        ctx.strokeStyle = '#ffea00';
        ctx.shadowColor = '#ffea00';
        ctx.shadowBlur = 20;
        ctx.lineWidth = 2.0;
        
        // Pulsing shield color fill
        const alpha = 0.08 + Math.sin(this.thrusterPulse * 0.2) * 0.04;
        ctx.fillStyle = `rgba(255, 234, 0, ${alpha})`;
        ctx.fill();
        ctx.stroke();
      }
    }
    
    ctx.shadowBlur = 0; // reset
  }
}

// --- Camera System ---
class Camera {
  constructor() {
    this.x = 0;            // track relative camera center
    this.y = 3.2;          // camera vertical eye level (higher = looking further down)
    this.z = 0;            // current game distance traveled
    this.fov = 320;        // Focal length (depth scale)
    this.baseFov = 320;
    this.horizonOffset = 25;   // shifts vanishing point upward (px)
    this.depthWarp = 0.0025;   // quadratic depth compression for longer track feel
  }

  update(dt, shipX, targetSpeedRatio) {
    // Camera drifts smoothly behind the ship, adding dynamic horizontal sweep
    this.x += (shipX * 0.72 - this.x) * 0.12;
    
    // Zoom/FOV distortion when speed boosting
    const targetFov = this.baseFov + targetSpeedRatio * 60;
    this.fov += (targetFov - this.fov) * 0.05;

    // Floor descends as speed increases — horizon drops, camera tilts down
    const targetHorizon = 25 + targetSpeedRatio * 90;
    this.horizonOffset += (targetHorizon - this.horizonOffset) * 0.03;
    const targetCamY = 3.2 + targetSpeedRatio * 5;
    this.y += (targetCamY - this.y) * 0.03;
  }

  // Projects absolute 3D track positions onto 2D canvas coordinates
  project(xRelative, yRelative, zAbsolute, getCurve, screenWidth, screenHeight) {
    const dz = zAbsolute - this.z;
    if (dz <= 0.2) return null; // Behind camera or clipping plane

    // Bends coordinates relative to curve path offsets
    const curveOffset = getCurve(zAbsolute);
    const camCurveOffset = getCurve(this.z);
    
    const dx = (xRelative + curveOffset) - (this.x + camCurveOffset);
    const dy = yRelative - this.y;

    // Depth warp: quadratic term keeps distant objects smaller longer,
    // then they scale up rapidly as they approach the player
    const depthWarp = dz + dz * dz * this.depthWarp;
    const scale = this.fov / depthWarp;
    
    // Horizon offset shifts the vanishing point upward
    const horizonY = screenHeight / 2 - this.horizonOffset;
    const px = screenWidth / 2 + dx * scale;
    const py = horizonY - dy * scale;
    
    return { x: px, y: py, scale: scale };
  }
}

// --- Main Orchestration Game Class ---
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.quality = 'high'; // 'high' uses pixel ratio, 'low' uses standard scale
    this.state = 'MENU'; // MENU, PLAYING, GAMEOVER
    
    this.camera = new Camera();
    this.ship = new PlayerShip();
    this.synth = new SoundSynth();
    
    // Controls State
    this.keys = {};
    this.mobileSteer = 0; // -1 to 1 steering amount from touch zones
    this.steerVelocity = 0;
    this.steerSensitivity = 16.0; // speed of sideways movement
    
    // Speed tracking
    this.baseSpeed = 35;
    this.currentSpeed = 35;
    this.maxSpeed = 160;
    this.speedBoost = 0;
    
    // Lists
    this.obstacles = [];
    this.powerups = [];
    this.particles = [];
    this.stars = []; // 3D background points
    
    // Procedural generation parameters
    this.nextSpawnZ = 120;
    this.trackWidth = 84;
    this.drawDistance = 450; // far z-clip
    
    // Statistics & Milestones
    this.score = 0;
    this.highScore = 0;
    this.distance = 0;
    this.nearMissCount = 0;
    this.peakSpeed = 35;
    this.multiplier = 1.0;
    
    // Visual Effects
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.flashDuration = 0;
    
    // Frame Timing
    this.lastTime = 0;
    
    this.initStars();
    this.bindEvents();
    this.loadHighScore();
    this.resizeCanvas();
  }

  loadHighScore() {
    try {
      const saved = localStorage.getItem('vector_rush_highscore');
      if (saved) {
        this.highScore = parseInt(saved, 10);
        document.getElementById('record-val').innerText = this.formatScore(this.highScore);
      }
    } catch(e) {
      console.warn("Could not load high score: ", e);
    }
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('vector_rush_highscore', this.highScore.toString());
      } catch(e) {
        console.warn("Could not save high score");
      }
      document.getElementById('record-val').innerText = this.formatScore(this.highScore);
    }
  }

  formatScore(val) {
    return String(Math.floor(val)).padStart(6, '0');
  }

  // Procedural formula for track curve offsets at distance z
  getTrackCurve(z) {
    // Curvature is composed of multiple overlapping frequencies
    return Math.sin(z * 0.002) * 55 + Math.cos(z * 0.0006) * 75;
  }

  initStars() {
    this.stars = [];
    // Distribute 150 points randomly in a box ahead of camera
    for (let i = 0; i < 180; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.25) * 350,
        z: Math.random() * this.drawDistance
      });
    }
  }

  bindEvents() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      
      // Prevent browser space scrolling
      if (e.code === 'Space') {
        e.preventDefault();
      }
      
      // Start or restart keys
      if (e.code === 'Space' || e.code === 'Enter') {
        if (this.state === 'MENU') {
          this.startGame();
        } else if (this.state === 'GAMEOVER') {
          this.resetGame();
          this.startGame();
        }
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Handle focus lost to prevent glitches
    window.addEventListener('blur', () => {
      this.keys = {};
      this.mobileSteer = 0;
    });

    // Resize
    window.addEventListener('resize', () => this.resizeCanvas());

    // Start UI buttons
    document.getElementById('btn-start').addEventListener('click', () => {
      this.startGame();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this.resetGame();
      this.startGame();
    });

    // Quality togglers
    const btnLow = document.getElementById('btn-quality-low');
    const btnHigh = document.getElementById('btn-quality-high');

    btnLow.addEventListener('click', () => {
      this.quality = 'low';
      btnLow.classList.add('active');
      btnHigh.classList.remove('active');
      this.resizeCanvas();
    });

    btnHigh.addEventListener('click', () => {
      this.quality = 'high';
      btnHigh.classList.add('active');
      btnLow.classList.remove('active');
      this.resizeCanvas();
    });

    // Web audio activation button
    const btnAudio = document.getElementById('audio-toggle-btn');
    const iconMuted = document.getElementById('audio-icon-muted');
    const iconPlaying = document.getElementById('audio-icon-playing');

    btnAudio.addEventListener('click', () => {
      const active = this.synth.toggle();
      if (active) {
        iconMuted.style.display = 'none';
        iconPlaying.style.display = 'block';
      } else {
        iconMuted.style.display = 'block';
        iconPlaying.style.display = 'none';
      }
    });

    // Mobile touch overlays
    const touchLeft = document.getElementById('touch-left');
    const touchRight = document.getElementById('touch-right');

    const handleTouchStart = (steerValue) => {
      // Lazy init audio context on first screen touch gesture
      this.synth.init();
      this.mobileSteer = steerValue;
    };

    const handleTouchEnd = () => {
      this.mobileSteer = 0;
    };

    touchLeft.addEventListener('mousedown', () => handleTouchStart(-1));
    touchLeft.addEventListener('mouseup', handleTouchEnd);
    touchLeft.addEventListener('mouseleave', handleTouchEnd);

    touchRight.addEventListener('mousedown', () => handleTouchStart(1));
    touchRight.addEventListener('mouseup', handleTouchEnd);
    touchRight.addEventListener('mouseleave', handleTouchEnd);

    // Touch support (iOS/Android)
    touchLeft.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleTouchStart(-1);
    });
    touchLeft.addEventListener('touchend', handleTouchEnd);

    touchRight.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleTouchStart(1);
    });
    touchRight.addEventListener('touchend', handleTouchEnd);
  }

  resizeCanvas() {
    const parent = document.getElementById('game-container');
    const rect = parent.getBoundingClientRect();
    
    // Canvas sizing setup (HD ratio target 16:9)
    const ratio = window.devicePixelRatio || 1;
    
    let canvasW = rect.width;
    let canvasH = rect.height;
    
    if (this.quality === 'high') {
      this.canvas.width = canvasW * ratio;
      this.canvas.height = canvasH * ratio;
      this.ctx.resetTransform();
      this.ctx.scale(ratio, ratio);
    } else {
      // Lower res for better performance on slow devices
      const capW = Math.min(1024, canvasW);
      const capH = capW * (9 / 16);
      this.canvas.width = capW;
      this.canvas.height = capH;
      this.ctx.resetTransform();
      // scale up output display visually via style rules
      canvasW = capW;
      canvasH = capH;
    }
    
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  startGame() {
    this.synth.init();
    if (this.state !== 'PLAYING') {
      this.state = 'PLAYING';
      this.lastTime = performance.now();
      
      // Hide menus, reveal HUD
      document.getElementById('start-overlay').classList.add('hidden');
      document.getElementById('gameover-overlay').classList.add('hidden');
      
      // Show near-miss alert element container
      document.getElementById('screen-notification').classList.remove('active');
    }
  }

  triggerScreenNotification(text, className, duration = 1.2) {
    const alert = document.getElementById('screen-notification');
    alert.innerText = text;
    alert.className = '';
    alert.classList.add('active', className);
    
    // Force DOM reflow to restart scaling animations
    alert.style.animation = 'none';
    alert.offsetHeight; 
    alert.style.animation = null;

    clearTimeout(this.notificationTimer);
    this.notificationTimer = setTimeout(() => {
      alert.classList.remove('active');
    }, duration * 1000);
  }

  triggerScreenShake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  spawnVFXSparks(x, y, z, count, color = '#ff007f') {
    for (let i = 0; i < count; i++) {
      const vx = (Math.random() - 0.5) * 50;
      const vy = (Math.random() - 0.3) * 30 + 10;
      const vz = (Math.random() - 0.7) * 40;
      const size = Math.random() * 2 + 1;
      const life = Math.random() * 0.6 + 0.4;
      
      this.particles.push(new Particle(x, y, z, vx, vy, vz, color, size, life));
    }
  }

  resetGame() {
    this.camera = new Camera();
    this.ship = new PlayerShip();
    
    this.obstacles = [];
    this.powerups = [];
    this.particles = [];
    
    this.currentSpeed = 35;
    this.nextSpawnZ = 120;
    this.score = 0;
    this.distance = 0;
    this.nearMissCount = 0;
    this.multiplier = 1.0;
    this.peakSpeed = 35;
    
    this.steerVelocity = 0;
    this.shakeDuration = 0;
    this.flashDuration = 0;
    
    this.initStars();
    
    document.getElementById('score-val').innerText = '000,000';
    document.getElementById('multiplier-val').innerText = '1.0x';
    document.getElementById('shield-val').innerText = 'SHIELD: ACTIVE';
    document.getElementById('shield-val').className = 'hud-value yellow';
    document.getElementById('boost-bar-val').style.width = '0%';
  }

  handleGameOver() {
    this.state = 'GAMEOVER';
    this.saveHighScore();
    
    // Trigger explosions
    this.synth.triggerExplosion();
    this.triggerScreenShake(30, 1.8);
    this.flashDuration = 0.5; // full white screen flash
    
    // Spawn massive particle system
    this.spawnVFXSparks(this.ship.x, this.ship.y, this.ship.z, 90, '#ff007f');
    this.spawnVFXSparks(this.ship.x, this.ship.y + 1, this.ship.z, 50, '#00f3ff');
    
    // Update GameOver overlay statistics values
    document.getElementById('stat-distance').innerText = `${Math.floor(this.distance)}m`;
    document.getElementById('stat-misses').innerText = this.nearMissCount;
    document.getElementById('stat-speed').innerText = `${Math.floor(this.peakSpeed * 2.8)} km/h`;
    document.getElementById('stat-score').innerText = this.formatScore(this.score);
    
    // Reveal Game Over overlay screen
    setTimeout(() => {
      document.getElementById('gameover-overlay').classList.remove('hidden');
    }, 1200);
  }

  // Spawns columns, moving hurdles, and shields ahead
  proceduralSpawner() {
    if (this.camera.z + this.drawDistance < this.nextSpawnZ) return;
    
    const trackHalfW = this.trackWidth / 2;
    
    // As game progresses, patterns get harder
    const level = Math.min(6, Math.floor(this.distance / 800));
    
    // Decide pattern type randomly
    const rand = Math.random();
    
    // Pattern 1: Single Pillar
    if (rand < 0.35 - level * 0.03) {
      const lanes = [-25, 0, 25];
      const selectedLane = lanes[Math.floor(Math.random() * lanes.length)];
      
      const width = Math.random() * 6 + 10;
      const height = Math.random() * 10 + 26;
      
      this.obstacles.push(new Obstacle(selectedLane, this.nextSpawnZ, width, height, 'pillar'));
    } 
    // Pattern 2: Double Obstacles (gates / arches)
    else if (rand < 0.65 - level * 0.02) {
      const type = Math.random() > 0.4 ? 'arch' : 'pillar';
      
      if (type === 'arch') {
        const leftX = -26;
        const rightX = 26;
        // Spawn two pillars to support the crossbar drawn inside Obstacle class
        this.obstacles.push(new Obstacle(leftX, this.nextSpawnZ, 10, 36, 'arch'));
        this.obstacles.push(new Obstacle(rightX, this.nextSpawnZ, 10, 36, 'pillar'));
      } else {
        // Double pillars blocking left and right, center open
        this.obstacles.push(new Obstacle(-24, this.nextSpawnZ, 16, 30, 'pillar'));
        this.obstacles.push(new Obstacle(24, this.nextSpawnZ, 16, 30, 'pillar'));
      }
    } 
    // Pattern 3: Sliding / Oscillating obstacles
    else if (rand < 0.85 + level * 0.02) {
      const dir = Math.random() > 0.5 ? 'slide-left' : 'slide-right';
      const offset = (Math.random() - 0.5) * 20;
      this.obstacles.push(new Obstacle(offset, this.nextSpawnZ, 18, 24, dir));
    } 
    // Pattern 4: Triple Wall Canyon
    else {
      // 3 pillars with narrow escape corridors
      const openLane = Math.floor(Math.random() * 3); // 0 (left), 1 (center), 2 (right) open
      
      if (openLane !== 0) this.obstacles.push(new Obstacle(-28, this.nextSpawnZ, 18, 30, 'pillar'));
      if (openLane !== 1) this.obstacles.push(new Obstacle(0, this.nextSpawnZ, 18, 30, 'pillar'));
      if (openLane !== 2) this.obstacles.push(new Obstacle(28, this.nextSpawnZ, 18, 30, 'pillar'));
    }
    
    // Spawn powerups in empty spaces occasionally
    if (Math.random() < 0.22) {
      const pX = (Math.random() - 0.5) * 44;
      const type = Math.random() > 0.78 ? 'boost' : 'shield';
      this.powerups.push(new PowerUp(pX, this.nextSpawnZ + 20, type));
    }
    
    // Calculate gap to next hurdle: narrows down as we speed up, making the game dense
    const speedFactor = this.currentSpeed / this.maxSpeed;
    const baseGap = 100 - level * 10;
    this.nextSpawnZ += Math.max(45, baseGap - speedFactor * 45);

    // Sometimes spawn another pattern slightly closer for extra density
    if (level > 1 && Math.random() < 0.2 + level * 0.04) {
      this.nextSpawnZ -= 30;
      this.proceduralSpawner();
    }
  }

  // --- Collision and Near-Miss Systems ---
  checkCollisions() {
    const shipMinZ = this.camera.z + this.ship.z - this.ship.length / 2;
    const shipMaxZ = this.camera.z + this.ship.z + this.ship.length / 2;
    
    const shipHalfW = this.ship.width / 2;
    const shipMinX = this.ship.x - shipHalfW;
    const shipMaxX = this.ship.x + shipHalfW;
    
    const shipMinY = this.ship.y - this.ship.height / 2;
    const shipMaxY = this.ship.y + this.ship.height / 2;
    
    // 1. Obstacle collisions
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.passed) continue;
      
      // Calculate intersection on Z depth axis
      const obsMinZ = obs.z;
      const obsMaxZ = obs.z + obs.d;
      
      if (shipMaxZ >= obsMinZ && shipMinZ <= obsMaxZ) {
        
        // Z overlap exists, now check X (horizontal coordinate relative to curve)
        const obsHalfW = obs.w / 2;
        const obsMinX = obs.x - obsHalfW;
        const obsMaxX = obs.x + obsHalfW;
        
        const obsMinY = 0;
        const obsMaxY = obs.h;
        
        if (shipMaxX >= obsMinX && shipMinX <= obsMaxX && shipMaxY >= obsMinY && shipMinY <= obsMaxY) {
          
          // Collision detected!
          if (this.ship.boostActive > 0) {
            // Speed boost invulnerability - smash through obstacle!
            obs.passed = true;
            this.synth.triggerExplosion();
            this.triggerScreenShake(15, 0.4);
            this.spawnVFXSparks(obs.x, obs.h / 2, obs.z, 25, '#39ff14');
            this.score += 250 * this.multiplier;
          } else if (this.ship.shield > 0) {
            // Shield protects - destroy shield, grant brief invincibility
            obs.passed = true;
            this.ship.shield = 0;
            this.synth.triggerShieldBreak();
            this.triggerScreenShake(20, 0.6);
            this.spawnVFXSparks(obs.x, obs.h / 2, obs.z, 30, '#ffea00');
            
            // HUD display updates
            const shieldHUD = document.getElementById('shield-val');
            shieldHUD.innerText = 'SHIELD: OFFLINE';
            shieldHUD.className = 'hud-value pink';
            
            this.triggerScreenNotification('SHIELD DOWN', 'near-miss', 1.5);
          } else {
            // Crash and burn
            this.handleGameOver();
            return;
          }
        }
      }
      
      // Near-Miss calculations (checked when ship passes front plane of obstacle)
      if (!obs.passed && !obs.nearMissChecked && shipMinZ > obsMinZ) {
        const obsHalfW = obs.w / 2;
        const distToLeftEdge = Math.abs(shipMaxX - (obs.x - obsHalfW));
        const distToRightEdge = Math.abs(shipMinX - (obs.x + obsHalfW));
        const lateralDistance = Math.min(distToLeftEdge, distToRightEdge);
        
        // If ship passed narrow side edge within 2.8 units AND was not a collision
        if (lateralDistance < 2.8 && shipMinX < obs.x + obsHalfW + 3.0 && shipMaxX > obs.x - obsHalfW - 3.0) {
          obs.nearMissChecked = true;
          this.nearMissCount++;
          const scoreBonus = 500 * this.multiplier;
          this.score += scoreBonus;
          this.multiplier = Math.min(4.0, this.multiplier + 0.2); // multiply points
          
          this.synth.triggerNearMiss();
          this.triggerScreenShake(5, 0.25);
          this.triggerScreenNotification(`NEAR MISS! +${Math.floor(scoreBonus)}`, 'near-miss', 0.85);
          this.spawnVFXSparks(this.ship.x, this.ship.y, obs.z, 15, '#ffea00');
        }
      }
      
      // Mark as passed when completely behind ship
      if (obs.z + obs.d < this.camera.z) {
        obs.passed = true;
        if (!obs.nearMissChecked) {
          // Increment score for safe evasion
          this.score += 100 * this.multiplier;
        }
      }
    }
    
    // 2. Powerups Collisions
    for (let i = 0; i < this.powerups.length; i++) {
      const p = this.powerups[i];
      if (p.collected) continue;
      
      // Z distance check
      const distanceZ = Math.abs(p.z - (this.camera.z + this.ship.z));
      if (distanceZ < (this.ship.length / 2 + p.radius)) {
        // X horizontal check
        const distanceX = Math.abs(p.x - this.ship.x);
        if (distanceX < (this.ship.width / 2 + p.radius)) {
          
          // Power up collected!
          p.collected = true;
          this.synth.triggerCollect();
          
          if (p.type === 'shield') {
            this.ship.shield = 1;
            const shieldHUD = document.getElementById('shield-val');
            shieldHUD.innerText = 'SHIELD: ACTIVE';
            shieldHUD.className = 'hud-value yellow';
            this.triggerScreenNotification('SHIELD RESTORED', 'level-up', 1.0);
            this.spawnVFXSparks(p.x, p.y, p.z, 20, '#ffea00');
          } else if (p.type === 'boost') {
            this.ship.boostActive = 3.5; // 3.5 seconds of super speed boost
            this.triggerScreenNotification('OVERCHARGE DETECTED!', 'level-up', 1.5);
            this.spawnVFXSparks(p.x, p.y, p.z, 25, '#39ff14');
            this.multiplier = Math.min(4.0, this.multiplier + 0.5);
          }
        }
      }
    }
  }

  // --- Main Update Loop ---
  update(dt) {
    // 1. Controls processing (interpolate keyboard and mobile triggers)
    let steerDir = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) steerDir = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) steerDir = 1;
    
    if (this.mobileSteer !== 0) steerDir = this.mobileSteer;
    
    // Steer velocity interpolation
    const targetSteerVel = steerDir * this.steerSensitivity;
    this.steerVelocity += (targetSteerVel - this.steerVelocity) * 0.18;
    
    // Steer ship
    this.ship.x += this.steerVelocity * dt * 2.8;
    
    // Bounds check boundary limits
    const halfTrackW = this.trackWidth / 2;
    const boundary = halfTrackW - this.ship.width / 2 - 2;
    if (this.ship.x < -boundary) this.ship.x = -boundary;
    if (this.ship.x > boundary) this.ship.x = boundary;

    // 2. Speed acceleration logic
    let targetSpeed = this.baseSpeed + (this.distance * 0.005);
    
    if (this.ship.boostActive > 0) {
      targetSpeed = this.baseSpeed + 80; // extreme velocity
    }
    
    targetSpeed = Math.min(this.maxSpeed, targetSpeed);
    
    // Interpolate current speed
    this.currentSpeed += (targetSpeed - this.currentSpeed) * 0.06;
    if (this.currentSpeed > this.peakSpeed) {
      this.peakSpeed = this.currentSpeed;
    }

    // 3. Move camera
    this.camera.z += this.currentSpeed * dt;
    this.distance = this.camera.z / 10; // 1 unit = 10 meters distance scale
    
    this.camera.update(dt, this.ship.x, (this.currentSpeed - 35) / 125);
    this.ship.update(dt, this.currentSpeed, this.steerVelocity);

    // 4. Procedural generator
    this.proceduralSpawner();

    // 5. Update lists of obstacles & power-ups
    this.obstacles.forEach(o => o.update(dt, this.currentSpeed));
    this.powerups.forEach(p => p.update(dt));
    
    // Filter out offscreen elements
    this.obstacles = this.obstacles.filter(o => o.z + o.d > this.camera.z - 10);
    this.powerups = this.powerups.filter(p => !p.collected && p.z > this.camera.z - 5);

    // 6. Update background stars (reposition behind camera)
    this.stars.forEach(s => {
      if (s.z < this.camera.z) {
        // Respawn far in front of camera
        s.z = this.camera.z + this.drawDistance;
        s.x = (Math.random() - 0.5) * 600;
        s.y = (Math.random() - 0.25) * 350;
      }
    });

    // 7. Update particles
    this.particles.forEach(p => p.update(dt, this.camera.z));
    this.particles = this.particles.filter(p => p.life > 0);

    // 8. Collisions
    this.checkCollisions();

    // 9. Sound hum synthesis updates
    const speedRatio = (this.currentSpeed - 35) / 125;
    this.synth.updateEngine(speedRatio, steerDir);
    this.synth.updateMusic(dt, this.currentSpeed);

    // 10. Update HUD visuals
    this.score += this.currentSpeed * dt * 0.15 * this.multiplier;
    document.getElementById('score-val').innerText = this.formatScore(this.score);
    document.getElementById('multiplier-val').innerText = `${this.multiplier.toFixed(1)}x`;
    
    // Boost HUD meter bar
    const boostPct = this.ship.boostActive > 0 ? (this.ship.boostActive / 3.5) * 100 : 0;
    document.getElementById('boost-bar-val').style.width = `${boostPct}%`;
    
    // Score multiplier decay over time (gently falls back if no near-misses hit)
    if (this.multiplier > 1.0 && this.ship.boostActive <= 0) {
      this.multiplier -= dt * 0.04;
    }
  }

  // --- Rendering Functions ---
  draw() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Clear back screen
    this.ctx.fillStyle = '#06060c';
    this.ctx.fillRect(0, 0, width, height);

    // Apply camera screen shake
    this.ctx.save();
    if (this.shakeDuration > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(dx, dy);
      this.shakeDuration -= 0.016; // roughly 60fps frame decrement
    }

    // 1. Draw Star warp speed lines
    const starColor = '#ffffff';
    this.ctx.strokeStyle = starColor;
    this.ctx.shadowBlur = 0;
    
    this.stars.forEach(s => {
      // Current projected coordinate
      const proj = this.camera.project(s.x, s.y, s.z, this.getTrackCurve, width, height);
      if (!proj) return;
      
      // Draw streak line trailing behind Z direction (previous frame depth projection)
      const prevProj = this.camera.project(s.x, s.y, s.z + 18, this.getTrackCurve, width, height);
      if (!prevProj) return;

      const alpha = Math.min(1.0, (s.z - this.camera.z) / 80); // fade out at horizon
      
      // Dynamic color trails based on speed (warp distortion)
      this.ctx.strokeStyle = this.ship.boostActive > 0 ? `rgba(57, 255, 20, ${alpha * 0.45})` : `rgba(255, 255, 255, ${alpha * 0.35})`;
      this.ctx.lineWidth = Math.max(0.5, 1.2 * proj.scale / 100);
      
      this.ctx.beginPath();
      this.ctx.moveTo(proj.x, proj.y);
      this.ctx.lineTo(prevProj.x, prevProj.y);
      this.ctx.stroke();
    });

    // 2. Draw 3D Receding Track Grid
    this.drawTrack(width, height);

    // 3. Draw Powerups
    this.powerups.forEach(p => p.draw(this.ctx, this.camera, width, height, this.getTrackCurve.bind(this)));

    // 4. Draw Obstacles
    this.obstacles.forEach(o => o.draw(this.ctx, this.camera, width, height, this.getTrackCurve.bind(this)));

    // 5. Draw Particles
    this.particles.forEach(p => {
      const proj = this.camera.project(p.x, p.y, p.z, this.getTrackCurve, width, height);
      if (!proj) return;
      
      const r = p.size * proj.scale * 0.12;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = Math.min(15, proj.scale / 10);
      
      this.ctx.beginPath();
      this.ctx.arc(proj.x, proj.y, Math.max(0.5, r), 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.shadowBlur = 0; // reset

    // 6. Draw Player spaceship
    this.ship.draw(this.ctx, this.camera, width, height, this.getTrackCurve.bind(this));

    this.ctx.restore();

    // 7. Full screen color flash overlay (on crashes)
    if (this.flashDuration > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashDuration})`;
      this.ctx.fillRect(0, 0, width, height);
      this.flashDuration -= 0.035; // fade speed
    }
  }

  // Projects and renders dynamic bending gridlines
  drawTrack(width, height) {
    const gridStep = 20; // draw ground grid segments every 20 z units
    const startZ = Math.floor(this.camera.z / gridStep) * gridStep;
    const count = Math.ceil(this.drawDistance / gridStep);
    
    const trackHalfW = this.trackWidth / 2;
    const neonCyan = '#00f3ff';
    const neonPink = '#ff007f';
    const sideGlow = this.ship.boostActive > 0 ? '#39ff14' : neonCyan;

    // A. Longitudinal Lines (flowing along road curvature: left rail, lane dash, right rail)
    const lanes = [-trackHalfW, -trackHalfW / 2, 0, trackHalfW / 2, trackHalfW];
    
    lanes.forEach((xOffset, lIdx) => {
      const isRail = lIdx === 0 || lIdx === lanes.length - 1;
      
      this.ctx.save();
      this.ctx.strokeStyle = isRail ? sideGlow : 'rgba(0, 243, 255, 0.15)';
      this.ctx.lineWidth = isRail ? 3.5 : 1.5;
      
      if (isRail) {
        this.ctx.shadowColor = sideGlow;
        this.ctx.shadowBlur = 15;
      }
      
      this.ctx.beginPath();
      let first = true;
      
      for (let i = 0; i <= count; i++) {
        const lineZ = startZ + i * gridStep;
        const proj = this.camera.project(xOffset, 0, lineZ, this.getTrackCurve, width, height);
        if (!proj) continue;
        
        if (first) {
          this.ctx.moveTo(proj.x, proj.y);
          first = false;
        } else {
          this.ctx.lineTo(proj.x, proj.y);
        }
      }
      this.ctx.stroke();
      this.ctx.restore();
    });

    // B. Transverse Lines (horizontal grid stripes passing under player)
    for (let i = 0; i < count; i++) {
      const lineZ = startZ + i * gridStep;
      
      const leftProj = this.camera.project(-trackHalfW, 0, lineZ, this.getTrackCurve, width, height);
      const rightProj = this.camera.project(trackHalfW, 0, lineZ, this.getTrackCurve, width, height);
      
      if (!leftProj || !rightProj) continue;

      // Make lines closer to the camera thicker to increase perspective depth
      const thickness = Math.max(0.5, 3.5 * leftProj.scale / 100);
      const alpha = Math.max(0.02, 0.5 * (1.0 - (lineZ - this.camera.z) / this.drawDistance));
      
      this.ctx.strokeStyle = `rgba(0, 243, 255, ${alpha * 0.4})`;
      this.ctx.lineWidth = thickness;
      
      this.ctx.beginPath();
      this.ctx.moveTo(leftProj.x, leftProj.y);
      this.ctx.lineTo(rightProj.x, rightProj.y);
      this.ctx.stroke();
      
      // C. Draw glowing vertical side fences posts on boundaries
      // Placed every 40 units along track
      if (lineZ % 40 === 0) {
        const postHeight = 8.5; // height of side rails
        const leftTopProj = this.camera.project(-trackHalfW, postHeight, lineZ, this.getTrackCurve, width, height);
        const rightTopProj = this.camera.project(trackHalfW, postHeight, lineZ, this.getTrackCurve, width, height);
        
        if (leftTopProj && rightTopProj) {
          const fenceColor = lineZ % 80 === 0 ? neonPink : sideGlow;
          this.ctx.lineWidth = Math.max(1, 2.0 * leftProj.scale / 100);
          this.ctx.strokeStyle = fenceColor;
          this.ctx.shadowColor = fenceColor;
          this.ctx.shadowBlur = Math.min(15, leftProj.scale / 12);
          
          // Draw left vertical post
          this.ctx.beginPath();
          this.ctx.moveTo(leftProj.x, leftProj.y);
          this.ctx.lineTo(leftTopProj.x, leftTopProj.y);
          this.ctx.stroke();

          // Draw right vertical post
          this.ctx.beginPath();
          this.ctx.moveTo(rightProj.x, rightProj.y);
          this.ctx.lineTo(rightTopProj.x, rightTopProj.y);
          this.ctx.stroke();
          
          // Connect top rails to the next post ahead
          const nextZ = lineZ + 40;
          const leftNextTopProj = this.camera.project(-trackHalfW, postHeight, nextZ, this.getTrackCurve, width, height);
          const rightNextTopProj = this.camera.project(trackHalfW, postHeight, nextZ, this.getTrackCurve, width, height);
          
          if (leftNextTopProj && rightNextTopProj) {
            // Draw left rail connector
            this.ctx.beginPath();
            this.ctx.moveTo(leftTopProj.x, leftTopProj.y);
            this.ctx.lineTo(leftNextTopProj.x, leftNextTopProj.y);
            this.ctx.stroke();

            // Draw right rail connector
            this.ctx.beginPath();
            this.ctx.moveTo(rightTopProj.x, rightTopProj.y);
            this.ctx.lineTo(rightNextTopProj.x, rightNextTopProj.y);
            this.ctx.stroke();
          }
        }
      }
    }
  }

  // --- The Core Game loop ---
  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Caps dt to handle potential lag spikes/lost tab focus frames
    dt = Math.min(0.08, dt);

    if (this.state === 'PLAYING') {
      this.update(dt);
      this.draw();
    } else if (this.state === 'GAMEOVER') {
      // Just render static view during GameOver screen overlay
      this.draw();
    } else {
      // MENU state: draw bending track passing by slowly in the background
      this.camera.z += 10.0 * dt; // slow drift speed
      this.camera.x = Math.sin(timestamp * 0.001) * 15; // slow tilt panning
      this.initStars(); // reinit stars to prevent bunching
      this.draw();
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}

// Instantiate and start the game engine loop on window load
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  requestAnimationFrame((timestamp) => game.loop(timestamp));
});
