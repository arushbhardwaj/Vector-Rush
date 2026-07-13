export class Obstacle {
  constructor(xRelative, z, width, height, type) {
    this.x = xRelative;
    this.y = 0;
    this.z = z;
    this.w = width;
    this.h = height;
    this.d = 8;
    this.type = type;
    this.passed = false;
    this.nearMissChecked = false;

    this.slideDir = type === 'slide-left' ? -1 : 1;
    this.slideSpeed = 22;
    this.slideRange = 30;
  }

  update(dt, currentSpeed) {
    if (this.type.startsWith('slide')) {
      this.x += this.slideDir * this.slideSpeed * dt;
      if (Math.abs(this.x) > this.slideRange) {
        this.x = Math.sign(this.x) * this.slideRange;
        this.slideDir *= -1;
      }
    }
  }

  draw(ctx, camera, width, height, getCurve) {
    const halfW = this.w / 2;
    const h = this.h;
    const d = this.d;

    const v1 = camera.project(this.x - halfW, 0, this.z, getCurve, width, height);
    const v2 = camera.project(this.x + halfW, 0, this.z, getCurve, width, height);
    const v3 = camera.project(this.x - halfW, h, this.z, getCurve, width, height);
    const v4 = camera.project(this.x + halfW, h, this.z, getCurve, width, height);

    const v5 = camera.project(this.x - halfW, 0, this.z + d, getCurve, width, height);
    const v6 = camera.project(this.x + halfW, 0, this.z + d, getCurve, width, height);
    const v7 = camera.project(this.x - halfW, h, this.z + d, getCurve, width, height);
    const v8 = camera.project(this.x + halfW, h, this.z + d, getCurve, width, height);

    if (!v1 || !v2 || !v3 || !v4 || !v5 || !v6 || !v7 || !v8) return;

    const neonPink = '#ff007f';
    const transparentPink = 'rgba(255, 0, 127, 0.15)';

    ctx.lineWidth = Math.max(1, 2.5 * v1.scale / 100);
    ctx.strokeStyle = neonPink;
    ctx.shadowBlur = Math.min(20, v1.scale / 15);
    ctx.shadowColor = neonPink;

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

    drawFace(v1, v2, v4, v3);
    drawFace(v5, v6, v8, v7);
    drawFace(v1, v5, v7, v3);
    drawFace(v2, v6, v8, v4);
    drawFace(v3, v4, v8, v7);

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

    ctx.shadowBlur = 0;
  }
}
