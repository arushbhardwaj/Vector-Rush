import { SoundSynth } from './audio/SoundSynth.js';
import { PlayerShip } from './entities/PlayerShip.js';
import { Particle } from './effects/Particle.js';
import { Camera } from './rendering/Camera.js';
import { TrackRenderer } from './rendering/TrackRenderer.js';
import { ChunkManager } from './chunks/ChunkManager.js';
import { formatScore } from './utils/helpers.js';
import { COLORS, CANVAS_GLOW } from './styleGuide.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.quality = 'high';
    this.state = 'MENU';

    this.camera = new Camera();
    this.ship = new PlayerShip();
    this.synth = new SoundSynth();
    this.trackRenderer = new TrackRenderer(this);

    this.keys = {};
    this.mobileSteer = 0;
    this.steerVelocity = 0;
    this.steerSensitivity = 20.0;

    this.baseSpeed = 50;
    this.currentSpeed = 50;
    this.maxSpeed = 220;
    this.speedBoost = 0;

    this.obstacles = [];
    this.powerups = [];
    this.particles = [];
    this.stars = [];

    this.trackWidth = 600;
    this.drawDistance = 450;
    this.chunkManager = new ChunkManager(this.trackWidth, this.drawDistance);

    this.score = 0;
    this.highScore = 0;
    this.distance = 0;
    this.nearMissCount = 0;
    this.peakSpeed = 35;
    this.multiplier = 1.0;

    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.flashDuration = 0;

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
        document.getElementById('record-val').innerText = formatScore(this.highScore);
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
      document.getElementById('record-val').innerText = formatScore(this.highScore);
    }
  }

  getTrackCurve(z) {
    return Math.sin(z * 0.002) * 55 + Math.cos(z * 0.0006) * 75;
  }

  initStars() {
    this.stars = [];
    for (let i = 0; i < 180; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.25) * 350,
        z: Math.random() * this.drawDistance
      });
    }
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'Space') {
        e.preventDefault();
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        if (this.state === 'MENU') {
          this.startGame();
        } else if (this.state === 'GAMEOVER') {
          this.resetGame();
          this.startGame();
        }
      }

      if (e.code === 'Escape') {
        if (this.state === 'PLAYING') {
          this.pauseGame();
        } else if (this.state === 'PAUSED') {
          this.resumeGame();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.keys = {};
      this.mobileSteer = 0;
    });

    window.addEventListener('resize', () => this.resizeCanvas());

    document.getElementById('btn-start').addEventListener('click', () => {
      this.startGame();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this.resetGame();
      this.startGame();
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
      this.resumeGame();
    });

    document.getElementById('btn-quit-menu').addEventListener('click', () => {
      this.quitToMenu();
    });

    document.getElementById('hud-pause-btn').addEventListener('click', () => {
      if (this.state === 'PLAYING') {
        this.pauseGame();
      }
    });

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

    const touchLeft = document.getElementById('touch-left');
    const touchRight = document.getElementById('touch-right');

    const handleTouchStart = (steerValue) => {
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

    const ratio = window.devicePixelRatio || 1;

    let canvasW = rect.width;
    let canvasH = rect.height;

    if (this.quality === 'high') {
      this.canvas.width = canvasW * ratio;
      this.canvas.height = canvasH * ratio;
      this.ctx.resetTransform();
      this.ctx.scale(ratio, ratio);
    } else {
      const capW = Math.min(1024, canvasW);
      const capH = capW * (9 / 16);
      this.canvas.width = capW;
      this.canvas.height = capH;
      this.ctx.resetTransform();
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

      document.getElementById('start-overlay').classList.add('hidden');
      document.getElementById('gameover-overlay').classList.add('hidden');
      document.getElementById('pause-overlay').classList.add('hidden');

      document.getElementById('screen-notification').classList.remove('active');
    }
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    document.getElementById('pause-overlay').classList.remove('hidden');
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.lastTime = performance.now();
    document.getElementById('pause-overlay').classList.add('hidden');
  }

  quitToMenu() {
    this.resetGame();
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('start-overlay').classList.remove('hidden');
    document.getElementById('gameover-overlay').classList.add('hidden');
    this.state = 'MENU';
  }

  triggerScreenNotification(text, className, duration = 1.2) {
    const alert = document.getElementById('screen-notification');
    alert.innerText = text;
    alert.className = '';
    alert.classList.add('active', className);

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

  spawnVFXSparks(x, y, z, count, color = COLORS.neonPink) {
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
    this.chunkManager.reset();
    this.score = 0;
    this.distance = 0;
    this.nearMissCount = 0;
    this.multiplier = 1.0;
    this.peakSpeed = 35;

    this.steerVelocity = 0;
    this.shakeDuration = 0;
    this.flashDuration = 0;
    this._deathHandled = false;

    this.initStars();

    document.getElementById('score-val').innerText = '000,000';
    document.getElementById('multiplier-val').innerText = '1.0x';
    document.getElementById('shield-val').innerText = 'SHIELD: ACTIVE';
    document.getElementById('shield-val').className = 'hud-value yellow';
    document.getElementById('boost-bar-val').style.width = '0%';
  }

  startDeathSequence() {
    this.state = 'DYING';
    this.ship.isDying = true;
    this.ship.deathTimer = 0.9;
    this.ship.deathSpin = 0;
    this.ship.deathFlash = 0;
    this.synth.triggerExplosion();
    this.triggerScreenShake(12, 0.4);
  }

  handleGameOver() {
    this.state = 'GAMEOVER';
    this.saveHighScore();

    this.triggerScreenShake(30, 1.8);
    this.flashDuration = 0.5;

    this.spawnVFXSparks(this.ship.x, this.ship.y, this.ship.z, 90, COLORS.neonPink);
    this.spawnVFXSparks(this.ship.x, this.ship.y + 1, this.ship.z, 50, COLORS.neonCyan);

    document.getElementById('stat-distance').innerText = `${Math.floor(this.distance)}m`;
    document.getElementById('stat-misses').innerText = this.nearMissCount;
    document.getElementById('stat-speed').innerText = `${Math.floor(this.peakSpeed * 2.8)} km/h`;
    document.getElementById('stat-score').innerText = formatScore(this.score);

    setTimeout(() => {
      document.getElementById('gameover-overlay').classList.remove('hidden');
    }, 1200);
  }

  checkCollisions() {
    const shipMinZ = this.camera.z + this.ship.z - this.ship.length / 2;
    const shipMaxZ = this.camera.z + this.ship.z + this.ship.length / 2;

    const shipHalfW = this.ship.width / 2;
    const shipMinX = this.ship.x - shipHalfW;
    const shipMaxX = this.ship.x + shipHalfW;

    const shipMinY = this.ship.y - this.ship.height / 2;
    const shipMaxY = this.ship.y + this.ship.height / 2;

    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.passed) continue;

      const obsMinZ = obs.z;
      const obsMaxZ = obs.z + obs.d;

      if (shipMaxZ >= obsMinZ && shipMinZ <= obsMaxZ) {

        const obsHalfW = obs.w / 2;
        const obsMinX = obs.x - obsHalfW;
        const obsMaxX = obs.x + obsHalfW;

        const obsMinY = 0;
        const obsMaxY = obs.h;

        if (shipMaxX >= obsMinX && shipMinX <= obsMaxX && shipMaxY >= obsMinY && shipMinY <= obsMaxY) {

          if (this.ship.boostActive > 0) {
            obs.passed = true;
            this.synth.triggerExplosion();
            this.triggerScreenShake(15, 0.4);
            this.spawnVFXSparks(obs.x, obs.h / 2, obs.z, 25, COLORS.neonGreen);
            this.score += 250 * this.multiplier;
          } else if (this.ship.shield > 0) {
            obs.passed = true;
            this.ship.shield = 0;
            this.synth.triggerShieldBreak();
            this.triggerScreenShake(20, 0.6);
            this.spawnVFXSparks(obs.x, obs.h / 2, obs.z, 30, COLORS.neonYellow);

            const shieldHUD = document.getElementById('shield-val');
            shieldHUD.innerText = 'SHIELD: OFFLINE';
            shieldHUD.className = 'hud-value pink';

            this.triggerScreenNotification('SHIELD DOWN', 'near-miss', 1.5);
          } else {
            this.startDeathSequence();
            return;
          }
        }
      }

      if (!obs.passed && !obs.nearMissChecked && shipMinZ > obsMinZ) {
        const obsHalfW = obs.w / 2;
        const distToLeftEdge = Math.abs(shipMaxX - (obs.x - obsHalfW));
        const distToRightEdge = Math.abs(shipMinX - (obs.x + obsHalfW));
        const lateralDistance = Math.min(distToLeftEdge, distToRightEdge);

        if (lateralDistance < 2.8 && shipMinX < obs.x + obsHalfW + 3.0 && shipMaxX > obs.x - obsHalfW - 3.0) {
          obs.nearMissChecked = true;
          this.nearMissCount++;
          const scoreBonus = 500 * this.multiplier;
          this.score += scoreBonus;
          this.multiplier = Math.min(4.0, this.multiplier + 0.2);

          this.synth.triggerNearMiss();
          this.triggerScreenShake(5, 0.25);
          this.triggerScreenNotification(`NEAR MISS! +${Math.floor(scoreBonus)}`, 'near-miss', 0.85);
          this.spawnVFXSparks(this.ship.x, this.ship.y, obs.z, 15, COLORS.neonYellow);
        }
      }

      if (obs.z + obs.d < this.camera.z) {
        obs.passed = true;
        if (!obs.nearMissChecked) {
          this.score += 100 * this.multiplier;
        }
      }
    }

    for (let i = 0; i < this.powerups.length; i++) {
      const p = this.powerups[i];
      if (p.collected) continue;

      const distanceZ = Math.abs(p.z - (this.camera.z + this.ship.z));
      if (distanceZ < (this.ship.length / 2 + p.radius)) {
        const distanceX = Math.abs(p.x - this.ship.x);
        if (distanceX < (this.ship.width / 2 + p.radius)) {

          p.collected = true;
          this.synth.triggerCollect();

          if (p.type === 'shield') {
            this.ship.shield = 1;
            const shieldHUD = document.getElementById('shield-val');
            shieldHUD.innerText = 'SHIELD: ACTIVE';
            shieldHUD.className = 'hud-value yellow';
            this.triggerScreenNotification('SHIELD RESTORED', 'level-up', 1.0);
            this.spawnVFXSparks(p.x, p.y, p.z, 20, COLORS.neonYellow);
          } else if (p.type === 'boost') {
            this.ship.boostActive = 3.5;
            this.triggerScreenNotification('OVERCHARGE DETECTED!', 'level-up', 1.5);
            this.spawnVFXSparks(p.x, p.y, p.z, 25, COLORS.neonGreen);
            this.multiplier = Math.min(4.0, this.multiplier + 0.5);
          }
        }
      }
    }
  }

  update(dt) {
    let steerDir = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) steerDir = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) steerDir = 1;

    if (this.mobileSteer !== 0) steerDir = this.mobileSteer;

    const targetSteerVel = steerDir * this.steerSensitivity;
    this.steerVelocity += (targetSteerVel - this.steerVelocity) * 0.18;

    this.ship.x += this.steerVelocity * dt * 3.5;

    let targetSpeed = this.baseSpeed + (this.distance * 0.005);

    if (this.ship.boostActive > 0) {
      targetSpeed = this.baseSpeed + 120;
    }

    targetSpeed = Math.min(this.maxSpeed, targetSpeed);

    this.currentSpeed += (targetSpeed - this.currentSpeed) * 0.06;
    if (this.currentSpeed > this.peakSpeed) {
      this.peakSpeed = this.currentSpeed;
    }

    this.camera.z += this.currentSpeed * dt;
    this.distance = this.camera.z / 10;

    this.camera.update(dt, this.ship.x, (this.currentSpeed - 35) / 125);
    this.ship.update(dt, this.currentSpeed, this.steerVelocity, this.multiplier, this.camera.z);

    const result = this.chunkManager.update(this.camera.z, this.currentSpeed);
    this.obstacles = result.obstacles;
    this.powerups = result.powerups;

    this.obstacles.forEach(o => o.update(dt, this.currentSpeed));
    this.powerups.forEach(p => p.update(dt));

    this.stars.forEach(s => {
      if (s.z < this.camera.z) {
        s.z = this.camera.z + this.drawDistance;
        s.x = (Math.random() - 0.5) * 600;
        s.y = (Math.random() - 0.25) * 350;
      }
    });

    this.particles.forEach(p => p.update(dt, this.camera.z));
    this.particles = this.particles.filter(p => p.life > 0);

    if (!this.ship.isDying) {
      this.checkCollisions();
    }

    if (this.ship.isDying && this.ship.deathTimer <= 0 && !this._deathHandled) {
      this._deathHandled = true;
      this.handleGameOver();
    }

    const speedRatio = (this.currentSpeed - 35) / 125;
    this.synth.updateEngine(speedRatio, steerDir);
    this.synth.updateMusic(dt, this.currentSpeed);

    this.score += this.currentSpeed * dt * 0.15 * this.multiplier;
    document.getElementById('score-val').innerText = formatScore(this.score);
    document.getElementById('multiplier-val').innerText = `${this.multiplier.toFixed(1)}x`;

    const boostPct = this.ship.boostActive > 0 ? (this.ship.boostActive / 3.5) * 100 : 0;
    document.getElementById('boost-bar-val').style.width = `${boostPct}%`;

    if (this.multiplier > 1.0 && this.ship.boostActive <= 0) {
      this.multiplier -= dt * 0.04;
    }
  }

  draw() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.fillStyle = COLORS.bgColor;
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.save();
    if (this.shakeDuration > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(dx, dy);
      this.shakeDuration -= 0.016;
    }

    const starColor = COLORS.accentWhite;
    this.ctx.strokeStyle = starColor;
    this.ctx.shadowBlur = 0;

    this.stars.forEach(s => {
      const proj = this.camera.project(s.x, s.y, s.z, this.getTrackCurve, width, height);
      if (!proj) return;

      const prevProj = this.camera.project(s.x, s.y, s.z + 18, this.getTrackCurve, width, height);
      if (!prevProj) return;

      const alpha = Math.min(1.0, (s.z - this.camera.z) / 80);

      this.ctx.strokeStyle = this.ship.boostActive > 0 ? `rgba(${COLORS.neonGreenRGB}, ${alpha * 0.45})` : `rgba(${COLORS.accentWhiteRGB}, ${alpha * 0.35})`;
      this.ctx.lineWidth = Math.max(0.5, 1.2 * proj.scale / 100);

      this.ctx.beginPath();
      this.ctx.moveTo(proj.x, proj.y);
      this.ctx.lineTo(prevProj.x, prevProj.y);
      this.ctx.stroke();
    });

    this.chunkManager.drawGround(this.ctx, this.camera, width, height, this.getTrackCurve.bind(this));
    this.trackRenderer.draw(this.ctx, width, height);

    this.powerups.forEach(p => p.draw(this.ctx, this.camera, width, height, this.getTrackCurve.bind(this)));

    this.obstacles.forEach(o => o.draw(this.ctx, this.camera, width, height, this.getTrackCurve.bind(this)));

    this.particles.forEach(p => {
      const proj = this.camera.project(p.x, p.y, p.z, this.getTrackCurve, width, height);
      if (!proj) return;

      const r = p.size * proj.scale * 0.12;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = Math.min(CANVAS_GLOW.low, proj.scale / 10);

      this.ctx.beginPath();
      this.ctx.arc(proj.x, proj.y, Math.max(0.5, r), 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.shadowBlur = 0;

    this.ship.draw(this.ctx, this.camera, width, height, this.getTrackCurve.bind(this), this.currentSpeed, this.multiplier);

    this.ctx.restore();

    if (this.flashDuration > 0) {
      this.ctx.fillStyle = `rgba(${COLORS.accentWhiteRGB}, ${this.flashDuration})`;
      this.ctx.fillRect(0, 0, width, height);
      this.flashDuration -= 0.035;
    }
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    dt = Math.min(0.08, dt);

    if (this.state === 'PLAYING' || this.state === 'DYING') {
      this.update(dt);
      this.draw();
    } else if (this.state === 'PAUSED') {
      this.draw();
    } else if (this.state === 'GAMEOVER') {
      this.draw();
    } else {
      this.camera.z += 10.0 * dt;
      this.camera.x = Math.sin(timestamp * 0.001) * 15;
      this.initStars();
      this.draw();
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}
