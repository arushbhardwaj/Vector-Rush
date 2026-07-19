import { COLORS, CANVAS_GLOW } from '../styleGuide.js';

export class PowerUp {
  constructor(xRelative, z, type) {
    this.x = xRelative;
    this.y = 1.2;
    this.z = z;
    this.type = type;
    this.collected = false;
    this.radius = 2.0;
    this.spin = 0;
  }

  update(dt) {
    this.spin += 2.5 * dt;
    this.y = 1.0 + Math.sin(this.spin * 1.5) * 0.3;
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
      const color = COLORS.neonYellow;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = Math.min(CANVAS_GLOW.high, scale / 8);
      ctx.lineWidth = Math.max(1.5, 2.5 * scale / 100);

      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.8, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(${COLORS.neonYellowRGB}, 0.15)`;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-r * 0.8, 0);
      ctx.lineTo(r * 0.8, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();
    } else {
      const color = COLORS.neonGreen;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = Math.min(CANVAS_GLOW.high, scale / 8);
      ctx.lineWidth = Math.max(2, 3 * scale / 100);

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
