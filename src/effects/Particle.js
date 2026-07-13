export class Particle {
  constructor(x, y, z, vx, vy, vz, color, size, maxLife) {
    this.x = x;
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
