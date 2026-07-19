import { COLORS, CANVAS_GLOW } from '../styleGuide.js';

export class PlayerShip {
  constructor() {
    this.x = 0;
    this.y = 0.5;
    this.z = 15;
    this.width = 4.2;
    this.height = 1.4;
    this.length = 6.0;

    this.roll = 0;
    this.steerInput = 0;
    this.velocity = 0;
    this.shield = 1;
    this.boostActive = 0;

    this.thrusterPulse = 0;
  }

  update(dt, speed, steerVelocity) {
    this.velocity = steerVelocity;
    this.roll = -steerVelocity * 0.055;

    this.thrusterPulse += dt * 25;
    this.y = 0.5 + Math.sin(this.thrusterPulse * 0.15) * 0.06;

    if (this.boostActive > 0) {
      this.boostActive -= dt;
    }
  }

  draw(ctx, camera, width, height, getCurve) {
    const roll = this.roll;

    const rotateRoll = (xLocal, yLocal) => {
      const rx = xLocal * Math.cos(roll) - yLocal * Math.sin(roll);
      const ry = xLocal * Math.sin(roll) + yLocal * Math.cos(roll);
      return { x: rx, y: ry };
    };

    const localPts = {
      nose:      { x: 0,    y: 0,     z: 4.0 },
      leftWing:  { x: -2.3, y: -0.4,  z: -2.0 },
      rightWing: { x: 2.3,  y: -0.4,  z: -2.0 },
      topFin:    { x: 0,    y: 1.1,   z: -2.5 },
      exhaust:   { x: 0,    y: -0.2,  z: -2.5 },
      belly:     { x: 0,    y: -0.4,  z: 0 }
    };

    const proj = {};
    for (const key in localPts) {
      const pt = localPts[key];
      const rot = rotateRoll(pt.x, pt.y);

      const worldX = this.x + rot.x;
      const worldY = this.y + rot.y;
      const worldZ = camera.z + this.z + pt.z;

      proj[key] = camera.project(worldX, worldY, worldZ, getCurve, width, height);
    }

    if (!proj.nose || !proj.leftWing || !proj.rightWing || !proj.topFin || !proj.exhaust || !proj.belly) return;

    const cyan = COLORS.neonCyan;
    const pink = COLORS.neonPink;
    const activeColor = this.boostActive > 0 ? COLORS.neonGreen : cyan;

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = activeColor;
    ctx.shadowBlur = CANVAS_GLOW.low;
    ctx.shadowColor = activeColor;

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

    fillFace(proj.nose, proj.leftWing, proj.belly, `rgba(${COLORS.neonCyanRGB}, 0.15)`);
    fillFace(proj.nose, proj.rightWing, proj.belly, `rgba(${COLORS.neonCyanRGB}, 0.15)`);
    fillFace(proj.leftWing, proj.rightWing, proj.belly, 'rgba(0, 100, 200, 0.25)');

    ctx.strokeStyle = pink;
    ctx.shadowColor = pink;
    fillFace(proj.nose, proj.topFin, proj.leftWing, `rgba(${COLORS.neonPinkRGB}, 0.1)`);
    fillFace(proj.nose, proj.topFin, proj.rightWing, `rgba(${COLORS.neonPinkRGB}, 0.1)`);

    ctx.strokeStyle = activeColor;
    ctx.shadowColor = activeColor;
    drawLine(proj.leftWing, proj.topFin);
    drawLine(proj.rightWing, proj.topFin);

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
      ctx.fillStyle = this.boostActive > 0 ? `rgba(${COLORS.neonGreenRGB}, 0.4)` : `rgba(${COLORS.neonPinkRGB}, 0.4)`;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(proj.exhaust.x, proj.exhaust.y);
      ctx.lineTo(proj.rightWing.x, proj.rightWing.y);
      ctx.lineTo(projFlame.x, projFlame.y);
      ctx.closePath();
      ctx.fillStyle = this.boostActive > 0 ? `rgba(${COLORS.neonGreenRGB}, 0.2)` : `rgba(${COLORS.neonCyanRGB}, 0.4)`;
      ctx.fill();
    }

    if (this.shield > 0) {
      const shieldCenter = camera.project(this.x, this.y, this.z + 1.0, getCurve, width, height);
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

    ctx.shadowBlur = 0;
  }
}
