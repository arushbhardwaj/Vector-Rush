/**
 * Chunk-based endless world generation with object pooling.
 *
 * InstancedMesh note:
 * In Three.js, InstancedMesh renders N copies of the same geometry in a
 * single draw call by uploading per-instance transform matrices to the GPU,
 * eliminating N separate draw calls and GL state changes.  Here (Canvas 2D)
 * the equivalent optimisation is object pooling — reusing pre-allocated
 * Obstacle / PowerUp instances instead of creating + destroying them avoids
 * GC pressure and allocation stutter during gameplay.
 *
 * All obstacle placement is driven by plain data arrays so difficulty tuning
 * means editing numbers, not touching 3D code.
 */

import { Obstacle } from '../entities/Obstacle.js';
import { PowerUp } from '../entities/PowerUp.js';

const CHUNK_SIZE = 100;

/* ── Base dimensions per obstacle type (scale multiplies these) ────────── */

const BASE_DIMS = {
  pillar:           { w: 12, h: 30 },
  'slide-oscillate': { w: 18, h: 12 },
};

/* ── Pattern definitions (plain data — edit numbers, not geometry code) ── */

const PATTERNS = [
  {
    name: 'corridor_narrow',
    weight: 20,
    obstacles: [
      { type: 'pillar', x: -32, y: 0, z: 10, scale: 1.0 },
      { type: 'pillar', x:  32, y: 0, z: 10, scale: 1.0 },
      { type: 'pillar', x: -32, y: 0, z: 50, scale: 1.0 },
      { type: 'pillar', x:  32, y: 0, z: 50, scale: 1.0 },
    ],
    powerups: [],
  },
  {
    name: 'gate_pillars',
    weight: 20,
    obstacles: [
      { type: 'pillar', x: -26, y: 0, z: 45, scale: 1.0 },
      { type: 'pillar', x:  26, y: 0, z: 45, scale: 1.0 },
    ],
    powerups: [],
  },
  {
    name: 'rising_towers',
    weight: 25,
    obstacles: [
      { type: 'pillar', x: -28, y: 0, z: 15, scale: 1.0 },
      { type: 'pillar', x:   5, y: 0, z: 35, scale: 1.4 },
      { type: 'pillar', x:  32, y: 0, z: 55, scale: 0.8 },
      { type: 'pillar', x: -12, y: 0, z: 75, scale: 1.7 },
    ],
    powerups: [],
  },
  {
    name: 'moving_platform',
    weight: 15,
    obstacles: [
      { type: 'slide-oscillate', x: 0, y: 0, z: 45, scale: 1.0,
        oscillate: { baseX: 0, amplitude: 28, frequency: 2.0 } },
    ],
    powerups: [],
  },
  {
    name: 'open_stretch',
    weight: 30,
    obstacles: [],
    powerups: [
      { x: -20, z: 25, type: 'shield' },
      { x:  22, z: 60, type: 'boost' },
    ],
  },
];

const TOTAL_WEIGHT = PATTERNS.reduce((s, p) => s + p.weight, 0);

export class ChunkManager {
  constructor(trackWidth, drawDistance) {
    this.trackWidth = trackWidth;
    this.drawDistance = drawDistance;

    this._obstaclePool = [];
    this._powerupPool = [];
    this._activeChunks = new Map();
    this._lastCameraChunk = -10;
    this._totalDistance = 0;
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  reset() {
    for (const chunk of this._activeChunks.values()) {
      for (const obs of chunk.obstacles) this._releaseObstacle(obs);
      for (const pow of chunk.powerups) this._releasePowerUp(pow);
    }
    this._activeChunks.clear();
    this._lastCameraChunk = -10;
    this._totalDistance = 0;
  }

  update(cameraZ, speed) {
    this._totalDistance = cameraZ / 10;
    const currentChunk = Math.floor(cameraZ / CHUNK_SIZE);

    if (currentChunk !== this._lastCameraChunk) {
      this._recycleBehind(currentChunk);
      this._lastCameraChunk = currentChunk;
    }

    this._fillAhead(currentChunk);

    const obstacles = [];
    const powerups = [];

    for (const chunk of this._activeChunks.values()) {
      const remainingObs = [];
      for (const obs of chunk.obstacles) {
        if (obs.passed) {
          this._releaseObstacle(obs);
        } else {
          remainingObs.push(obs);
        }
      }
      chunk.obstacles = remainingObs;
      for (const obs of remainingObs) obstacles.push(obs);

      const remainingPow = [];
      for (const pow of chunk.powerups) {
        if (pow.collected) {
          this._releasePowerUp(pow);
        } else {
          remainingPow.push(pow);
        }
      }
      chunk.powerups = remainingPow;
      for (const pow of remainingPow) powerups.push(pow);
    }

    return { obstacles, powerups };
  }

  /* ── Chunk lifecycle ───────────────────────────────────────────────── */

  _recycleBehind(currentChunk) {
    const minChunk = currentChunk - 1;
    const toDelete = [];
    for (const index of this._activeChunks.keys()) {
      if (index < minChunk) toDelete.push(index);
    }
    for (const index of toDelete) {
      const chunk = this._activeChunks.get(index);
      for (const obs of chunk.obstacles) this._releaseObstacle(obs);
      for (const pow of chunk.powerups) this._releasePowerUp(pow);
      this._activeChunks.delete(index);
    }
  }

  _fillAhead(currentChunk) {
    const maxChunk = currentChunk + 5;
    for (let i = currentChunk - 1; i <= maxChunk; i++) {
      if (!this._activeChunks.has(i)) {
        this._createChunk(i);
      }
    }
  }

  /* ── Pattern selection & instantiation ─────────────────────────────── */

  _pickPattern() {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const p of PATTERNS) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return PATTERNS[PATTERNS.length - 1];
  }

  _createChunk(chunkIndex) {
    const pattern = this._pickPattern();
    const chunkZ = chunkIndex * CHUNK_SIZE;

    const obstacles = [];
    for (const o of this._applyVariation(pattern.obstacles, pattern.name)) {
      obstacles.push(this._acquireObstacle(o, chunkZ));
    }

    const powerups = [];
    for (const p of (pattern.powerups || [])) {
      const clone = { ...p };
      clone.x += (Math.random() - 0.5) * 18;
      clone.z += (Math.random() - 0.5) * 10;
      powerups.push(this._acquirePowerUp(clone, chunkZ));
    }

    this._activeChunks.set(chunkIndex, { obstacles, powerups, patternName: pattern.name });
  }

  _applyVariation(template, patternName) {
    const level = Math.min(6, Math.floor(this._totalDistance / 800));

    return template.map(o => {
      const c = { ...o };
      if (c.oscillate) c.oscillate = { ...c.oscillate };

      switch (patternName) {
        case 'corridor_narrow': {
          const gapMin = 44 - level * 3;
          const gapMax = 80 - level * 4;
          const gap = gapMin + Math.random() * (gapMax - gapMin);
          c.x = c.x < 0 ? -(gap / 2) : (gap / 2);
          break;
        }
        case 'gate_pillars': {
          const gapMin = 40 - level * 2;
          const gapMax = 64 - level * 3;
          const gap = gapMin + Math.random() * (gapMax - gapMin);
          c.x = c.x < 0 ? -(gap / 2) : (gap / 2);
          break;
        }
        case 'rising_towers': {
          c.scale *= 0.8 + Math.random() * 0.4;
          c.x += (Math.random() - 0.5) * 8;
          break;
        }
        case 'moving_platform': {
          c.x += (Math.random() - 0.5) * 16;
          if (c.oscillate) {
            c.oscillate.amplitude += (Math.random() - 0.5) * 8;
            c.oscillate.amplitude = Math.max(10, c.oscillate.amplitude);
          }
          break;
        }
      }

      return c;
    });
  }

  /* ── Object pool ───────────────────────────────────────────────────── */

  _acquireObstacle(config, chunkZ) {
    let obs = this._obstaclePool.pop();
    if (!obs) obs = new Obstacle(0, 0, 12, 30, 'pillar');

    const base = BASE_DIMS[config.type] || BASE_DIMS.pillar;
    const scale = config.scale || 1;
    const worldZ = chunkZ + (config.z || 0);

    obs.x = config.x;
    obs.y = config.y || 0;
    obs.z = worldZ;
    obs.w = base.w * scale;
    obs.h = base.h * scale;
    obs.d = 8;
    obs.type = config.type;
    obs.passed = false;
    obs.nearMissChecked = false;

    if (config.oscillate) {
      obs.oscillate = { ...config.oscillate };
      obs._oscPhase = Math.random() * Math.PI * 2;
      obs.slideDir = 0;
      obs.slideSpeed = 0;
      obs.slideRange = 0;
    } else {
      obs.oscillate = null;
      obs._oscPhase = 0;
      obs.slideDir = 1;
      obs.slideSpeed = 22;
      obs.slideRange = 30;
    }

    return obs;
  }

  _releaseObstacle(obs) {
    this._obstaclePool.push(obs);
  }

  _acquirePowerUp(config, chunkZ) {
    let pow = this._powerupPool.pop();
    if (!pow) pow = new PowerUp(0, 0, 'shield');

    const worldZ = chunkZ + (config.z || 0);

    pow.x = config.x;
    pow.y = 1.5;
    pow.z = worldZ;
    pow.type = config.type;
    pow.collected = false;
    pow.radius = 4;

    return pow;
  }

  _releasePowerUp(pow) {
    this._powerupPool.push(pow);
  }

  /* ── Ground strip ──────────────────────────────────────────────────── */

  drawGround(ctx, camera, width, height, getCurve) {
    const gridStep = 20;
    const startZ = Math.floor(camera.z / gridStep) * gridStep;
    const count = Math.ceil(this.drawDistance / gridStep) + 1;
    const halfW = this.trackWidth / 2;

    for (let i = 0; i < count; i++) {
      const z1 = startZ + i * gridStep;
      const z2 = z1 + gridStep;

      const left1 = camera.project(-halfW, 0, z1, getCurve, width, height);
      const right1 = camera.project(halfW, 0, z1, getCurve, width, height);
      const left2 = camera.project(-halfW, 0, z2, getCurve, width, height);
      const right2 = camera.project(halfW, 0, z2, getCurve, width, height);

      if (!left1 || !right1 || !left2 || !right2) continue;

      const dist = z1 - camera.z;
      const alpha = Math.max(0.02, 0.25 * (1.0 - dist / this.drawDistance));

      ctx.fillStyle = `rgba(8, 14, 32, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(left1.x, left1.y);
      ctx.lineTo(right1.x, right1.y);
      ctx.lineTo(right2.x, right2.y);
      ctx.lineTo(left2.x, left2.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}
