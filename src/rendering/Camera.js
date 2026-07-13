export class Camera {
  constructor() {
    this.x = 0;
    this.y = 3.2;
    this.z = 0;
    this.fov = 320;
    this.baseFov = 320;
    this.horizonOffset = 25;
    this.depthWarp = 0.0025;
  }

  update(dt, shipX, targetSpeedRatio) {
    this.x += (shipX * 0.72 - this.x) * 0.12;

    const targetFov = this.baseFov + targetSpeedRatio * 60;
    this.fov += (targetFov - this.fov) * 0.05;

    const targetHorizon = 25 + targetSpeedRatio * 90;
    this.horizonOffset += (targetHorizon - this.horizonOffset) * 0.03;
    const targetCamY = 3.2 + targetSpeedRatio * 5;
    this.y += (targetCamY - this.y) * 0.03;
  }

  project(xRelative, yRelative, zAbsolute, getCurve, screenWidth, screenHeight) {
    const dz = zAbsolute - this.z;
    if (dz <= 0.2) return null;

    const curveOffset = getCurve(zAbsolute);
    const camCurveOffset = getCurve(this.z);

    const dx = (xRelative + curveOffset) - (this.x + camCurveOffset);
    const dy = yRelative - this.y;

    const depthWarp = dz + dz * dz * this.depthWarp;
    const scale = this.fov / depthWarp;

    const horizonY = screenHeight / 2 - this.horizonOffset;
    const px = screenWidth / 2 + dx * scale;
    const py = horizonY - dy * scale;

    return { x: px, y: py, scale: scale };
  }
}
