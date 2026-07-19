import { COLORS, CANVAS_GLOW } from '../styleGuide.js';
import { clamp, lerp } from '../utils/helpers.js';

export class PlayerShip {
  constructor() {
    this.x = 0;
    this.y = 0.5;
    this.z = 15;
    this.width = 4.2;
    this.height = 1.4;
    this.length = 6.0;

    this.roll = 0;
    this.pitch = 0;
    this.yaw = 0;
    this.velocity = 0;
    this.shield = 1;
    this.boostActive = 0;

    this.thrusterPulse = 0;
    this.idlePhase = 0;
    this.prevSpeed = 50;

    this.isDying = false;
    this.deathTimer = 0;
    this.deathSpin = 0;
    this.deathFlash = 0;

    this.leftTrail = [];
    this.rightTrail = [];
    this.trailMaxLen = 40;
    this.cameraZ = 0;
  }

  update(dt, speed, steerVelocity, multiplier = 1.0, cameraZ = 0) {
    this.velocity = steerVelocity;
    this.cameraZ = cameraZ;

    this.roll = -steerVelocity * 0.055;

    const speedDelta = speed - this.prevSpeed;
    this.prevSpeed = speed;
    this.pitch += (speedDelta * 0.002 - this.pitch) * 0.1;

    this.idlePhase += dt * 1.1;
    const idleRoll = Math.sin(this.idlePhase * 0.6) * 0.015;
    const idleYaw = Math.sin(this.idlePhase * 0.4) * 0.008;
    const idleBob = Math.sin(this.idlePhase * 0.12) * 0.04;

    this.roll += idleRoll;
    this.yaw = idleYaw;

    this.thrusterPulse += dt * 25;
    this.y = 0.5 + idleBob;

    if (this.boostActive > 0) {
      this.boostActive -= dt;
    }

    if (this.isDying) {
      this.deathTimer -= dt;
      this.deathSpin += dt * 18;
      this.deathFlash = Math.min(1, this.deathFlash + dt * 3);
      this.y += Math.sin(this.deathSpin * 0.5) * dt * 4;
      this.x += Math.cos(this.deathSpin * 0.3) * dt * 2;
    }

    this.updateTrails(dt, multiplier);
  }

  updateTrails(dt, multiplier) {
    const roll = this.roll;
    const lTip = { x: -3.0, y: -0.5, z: -2.0 };
    const rTip = { x: 3.0, y: -0.5, z: -2.0 };

    const rotL = this._rotate(lTip.x, lTip.y, roll);
    const rotR = this._rotate(rTip.x, rTip.y, roll);

    const camZ = this.cameraZ;
    const lWorld = { x: this.x + rotL.x, y: this.y + rotL.y, z: camZ + this.z + lTip.z };
    const rWorld = { x: this.x + rotR.x, y: this.y + rotR.y, z: camZ + this.z + rTip.z };

    this.leftTrail.push(lWorld);
    this.rightTrail.push(rWorld);

    if (this.leftTrail.length > this.trailMaxLen) this.leftTrail.shift();
    if (this.rightTrail.length > this.trailMaxLen) this.rightTrail.shift();
  }

  _rotate(x, y, angle) {
    const rx = x * Math.cos(angle) - y * Math.sin(angle);
    const ry = x * Math.sin(angle) + y * Math.cos(angle);
    return { x: rx, y: ry };
  }

  draw(ctx, camera, width, height, getCurve, speed = 100, multiplier = 1.0) {
    if (this.isDying) {
      this.drawDeathOverlay(ctx, camera, width, height, getCurve);
    }

    const roll = this.roll;

    const localPts = {
      noseTip:      { x: 0,    y: 0,    z: 5.0  },
      cockpitFront: { x: 0,    y: 0.25, z: 3.2  },
      cockpitRear:  { x: 0,    y: 0.2,  z: 2.0  },
      noseBase:     { x: 0,    y: -0.1, z: 3.5  },
      midFuse:      { x: 0,    y: -0.3, z: 0.5  },
      tailBase:     { x: 0,    y: -0.4, z: -3.0 },
      tailTop:      { x: 0,    y: 0.3,  z: -3.2 },
      lWingRoot:    { x: -1.0, y: -0.2, z: 1.0  },
      lWingTip:     { x: -3.0, y: -0.5, z: -2.0 },
      rWingRoot:    { x: 1.0,  y: -0.2, z: 1.0  },
      rWingTip:     { x: 3.0,  y: -0.5, z: -2.0 },
      lFinBase:     { x: -0.6, y: 0.0,  z: -2.8 },
      lFinTip:      { x: -0.7, y: 1.2,  z: -3.0 },
      rFinBase:     { x: 0.6,  y: 0.0,  z: -2.8 },
      rFinTip:      { x: 0.7,  y: 1.2,  z: -3.0 },
      exhaustL:     { x: -0.5, y: -0.3, z: -3.3 },
      exhaustR:     { x: 0.5,  y: -0.3, z: -3.3 },
    };

    const proj = {};
    for (const key in localPts) {
      const pt = localPts[key];

      const yawShift = pt.z * this.yaw;
      const pitchShift = pt.z * this.pitch;

      const rot = this._rotate(pt.x + yawShift, pt.y - pitchShift, roll);

      const worldX = this.x + rot.x;
      const worldY = this.y + rot.y;
      const worldZ = camera.z + this.z + pt.z;

      proj[key] = camera.project(worldX, worldY, worldZ, getCurve, width, height);
    }

    if (!proj.noseTip || !proj.midFuse || !proj.tailBase || !proj.lWingTip || !proj.rWingTip) return;

    const cyan = COLORS.neonCyan;
    const pink = COLORS.neonPink;
    const activeColor = this.boostActive > 0 ? COLORS.neonGreen : cyan;

    ctx.lineWidth = 2.5;

    const drawLine = (a, b, color, glow) => {
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = glow || CANVAS_GLOW.low;
      ctx.stroke();
    };

    const fillFace = (a, b, c, fillStyle) => {
      if (!a || !b || !c) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
    };

    const strokeFace = (a, b, c, color, glow) => {
      if (!a || !b || !c) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = glow || CANVAS_GLOW.low;
      ctx.stroke();
    };

    this.drawTrails(ctx, camera, width, height, getCurve, multiplier);

    const darkBlue = 'rgba(0, 40, 80, 0.3)';
    const cyanFill = `rgba(${COLORS.neonCyanRGB}, 0.12)`;
    const pinkFill = `rgba(${COLORS.neonPinkRGB}, 0.1)`;

    fillFace(proj.noseBase, proj.lWingRoot, proj.tailBase, darkBlue);
    fillFace(proj.noseBase, proj.rWingRoot, proj.tailBase, darkBlue);
    fillFace(proj.lWingRoot, proj.rWingRoot, proj.tailBase, darkBlue);

    fillFace(proj.noseBase, proj.lWingRoot, proj.tailBase, cyanFill);
    fillFace(proj.noseBase, proj.rWingRoot, proj.tailBase, cyanFill);

    fillFace(proj.noseTip, proj.cockpitRear, proj.tailTop, cyanFill);
    fillFace(proj.noseTip, proj.cockpitFront, proj.noseBase, cyanFill);

    fillFace(proj.lWingRoot, proj.lWingTip, proj.midFuse, pinkFill);
    fillFace(proj.rWingRoot, proj.rWingTip, proj.midFuse, pinkFill);

    const cockpitAlpha = 0.25 + Math.sin(this.thrusterPulse * 0.1) * 0.1;
    ctx.fillStyle = `rgba(${COLORS.neonPinkRGB}, ${cockpitAlpha})`;
    ctx.shadowColor = COLORS.neonPink;
    ctx.shadowBlur = CANVAS_GLOW.medium;
    fillFace(proj.cockpitFront, proj.cockpitRear, proj.noseBase, ctx.fillStyle);
    fillFace(proj.cockpitFront, proj.cockpitRear, proj.midFuse, ctx.fillStyle);

    ctx.shadowBlur = CANVAS_GLOW.low;
    ctx.shadowColor = activeColor;
    ctx.strokeStyle = activeColor;

    const edges = [
      [proj.noseTip, proj.cockpitFront],
      [proj.cockpitFront, proj.cockpitRear],
      [proj.cockpitRear, proj.midFuse],
      [proj.midFuse, proj.tailTop],
      [proj.noseTip, proj.noseBase],
      [proj.noseBase, proj.midFuse],
      [proj.midFuse, proj.tailBase],
      [proj.lWingRoot, proj.lWingTip],
      [proj.lWingTip, proj.midFuse],
      [proj.midFuse, proj.lWingRoot],
      [proj.rWingRoot, proj.rWingTip],
      [proj.rWingTip, proj.midFuse],
      [proj.midFuse, proj.rWingRoot],
    ];

    for (const [a, b] of edges) {
      drawLine(a, b, activeColor, CANVAS_GLOW.low);
    }

    ctx.strokeStyle = activeColor;
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 0;
    drawLine(proj.lFinBase, proj.lFinTip, activeColor, 0);
    drawLine(proj.lFinTip, proj.tailTop, activeColor, 0);
    drawLine(proj.rFinBase, proj.rFinTip, activeColor, 0);
    drawLine(proj.rFinTip, proj.tailTop, activeColor, 0);
    drawLine(proj.tailTop, proj.tailBase, activeColor, 0);
    drawLine(proj.exhaustL, proj.exhaustR, activeColor, 0);

    ctx.lineWidth = 1.5;
    drawLine(proj.lFinBase, proj.tailBase, activeColor, 0);
    drawLine(proj.rFinBase, proj.tailBase, activeColor, 0);
    drawLine(proj.exhaustL, proj.tailBase, activeColor, 0);
    drawLine(proj.exhaustR, proj.tailBase, activeColor, 0);
    ctx.lineWidth = 2.5;

    const speedRatio = clamp((speed - 35) / 125, 0, 1);
    const thrusterGlow = 0.6 + speedRatio * 1.4;
    const flamePulse = 1.0 + Math.sin(this.thrusterPulse) * 0.3;
    const flameLen = (3 + speedRatio * 5 + (this.boostActive > 0 ? 5 : 0)) * flamePulse;

    const flameColor1 = this.boostActive > 0
      ? `rgba(${COLORS.neonGreenRGB}, ${0.35 * thrusterGlow})`
      : `rgba(${COLORS.neonPinkRGB}, ${0.4 * thrusterGlow})`;
    const flameColor2 = this.boostActive > 0
      ? `rgba(${COLORS.neonGreenRGB}, ${0.2 * thrusterGlow})`
      : `rgba(${COLORS.neonCyanRGB}, ${0.35 * thrusterGlow})`;
    const outerGlowColor = this.boostActive > 0
      ? `rgba(${COLORS.neonGreenRGB}, ${0.12 * thrusterGlow})`
      : `rgba(${COLORS.neonPinkRGB}, ${0.15 * thrusterGlow})`;

    const flameL = { x: 0, y: -0.3, z: -3.3 - flameLen };
    const flameR = { x: 0, y: -0.3, z: -3.3 - flameLen };
    const rotFlameL = this._rotate(flameL.x, flameL.y, roll);
    const rotFlameR = this._rotate(flameR.x, flameR.y, roll);
    const projFlameL = camera.project(
      this.x + rotFlameL.x, this.y + rotFlameL.y,
      camera.z + this.z + flameL.z, getCurve, width, height
    );
    const projFlameR = camera.project(
      this.x + rotFlameR.x, this.y + rotFlameR.y,
      camera.z + this.z + flameR.z, getCurve, width, height
    );

    if (projFlameL && projFlameR) {
      const glowScale = thrusterGlow * (this.boostActive > 0 ? 3 : 2);

      ctx.save();
      ctx.shadowColor = this.boostActive > 0 ? COLORS.neonGreen : COLORS.neonPink;
      ctx.shadowBlur = CANVAS_GLOW.medium * thrusterGlow;

      ctx.beginPath();
      ctx.moveTo(proj.exhaustL.x, proj.exhaustL.y);
      ctx.lineTo(proj.lWingTip.x, proj.lWingTip.y);
      ctx.lineTo(projFlameL.x, projFlameL.y);
      ctx.closePath();
      ctx.fillStyle = flameColor1;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(proj.exhaustR.x, proj.exhaustR.y);
      ctx.lineTo(proj.rWingTip.x, proj.rWingTip.y);
      ctx.lineTo(projFlameR.x, projFlameR.y);
      ctx.closePath();
      ctx.fillStyle = flameColor2;
      ctx.fill();

      ctx.restore();

      ctx.save();
      ctx.shadowColor = this.boostActive > 0 ? COLORS.neonGreen : COLORS.neonPink;
      ctx.shadowBlur = CANVAS_GLOW.high * thrusterGlow;

      ctx.beginPath();
      ctx.arc(proj.exhaustL.x, proj.exhaustL.y, 4 * proj.exhaustL.scale / 120 * glowScale, 0, Math.PI * 2);
      ctx.fillStyle = outerGlowColor;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(proj.exhaustR.x, proj.exhaustR.y, 4 * proj.exhaustR.scale / 120 * glowScale, 0, Math.PI * 2);
      ctx.fillStyle = outerGlowColor;
      ctx.fill();

      ctx.restore();
    }

    if (this.shield > 0) {
      const shieldCenter = camera.project(this.x, this.y, camera.z + this.z + 1.0, getCurve, width, height);
      if (shieldCenter) {
        ctx.beginPath();
        const shieldRadius = 6.0 * shieldCenter.scale;
        ctx.arc(shieldCenter.x, shieldCenter.y, shieldRadius, 0, Math.PI * 2);

        ctx.strokeStyle = COLORS.neonYellow;
        ctx.shadowColor = COLORS.neonYellow;
        ctx.shadowBlur = CANVAS_GLOW.medium;
        ctx.lineWidth = 2.0;

        const alpha = 0.08 + Math.sin(this.thrusterPulse * 0.2) * 0.04;
        ctx.fillStyle = `rgba(${COLORS.neonYellowRGB}, ${alpha})`;
        ctx.fill();
        ctx.stroke();
      }
    }

    if (this.isDying) {
      const flashAlpha = Math.max(0, 1 - this.deathFlash) * 0.7;
      if (flashAlpha > 0.01) {
        const pts = Object.values(proj).filter(p => p);
        if (pts.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          }
          const pad = 10;
          ctx.fillStyle = `rgba(${COLORS.accentWhiteRGB}, ${flashAlpha})`;
          ctx.shadowBlur = 0;
          ctx.fillRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
        }
      }
    }

    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
  }

  drawTrails(ctx, camera, width, height, getCurve, multiplier) {
    const boosted = this.boostActive > 0;
    const greenT = boosted ? 1 : clamp((multiplier - 1.0) / 3.0, 0, 1);

    const r = Math.floor(lerp(0, 57, greenT));
    const g = Math.floor(lerp(243, 255, greenT));
    const b = Math.floor(lerp(255, 20, greenT));

    this._drawSingleTrail(ctx, this.leftTrail, camera, width, height, getCurve, r, g, b);
    this._drawSingleTrail(ctx, this.rightTrail, camera, width, height, getCurve, r, g, b);
  }

  _drawSingleTrail(ctx, trail, camera, width, height, getCurve, r, g, b) {
    if (trail.length < 3) return;

    const projected = [];
    for (const pt of trail) {
      const proj = camera.project(pt.x, pt.y, pt.z, getCurve, width, height);
      if (proj) {
        projected.push(proj);
      }
    }

    if (projected.length < 2) return;

    for (let i = 1; i < projected.length; i++) {
      const a = projected[i - 1];
      const bPt = projected[i];
      if (!a || !bPt) continue;

      const life = i / projected.length;
      const alpha = life * 0.5;
      const widthPx = Math.max(0.3, 2.5 * life * ((a.scale + bPt.scale) / 300));

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bPt.x, bPt.y);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`;
      ctx.shadowBlur = widthPx * 3;
      ctx.lineWidth = widthPx;
      ctx.stroke();
    }
  }

  drawDeathOverlay(ctx, camera, width, height, getCurve) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.shadowBlur = 0;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
