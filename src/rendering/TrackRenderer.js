export class TrackRenderer {
  constructor(game) {
    this.game = game;
  }

  draw(ctx, width, height) {
    const gridStep = 20;
    const startZ = Math.floor(this.game.camera.z / gridStep) * gridStep;
    const count = Math.ceil(this.game.drawDistance / gridStep);

    const trackHalfW = this.game.trackWidth / 2;
    const neonCyan = '#00f3ff';
    const neonPink = '#ff007f';
    const sideGlow = this.game.ship.boostActive > 0 ? '#39ff14' : neonCyan;

    const lanes = [-trackHalfW, -trackHalfW / 2, 0, trackHalfW / 2, trackHalfW];

    lanes.forEach((xOffset, lIdx) => {
      const isRail = lIdx === 0 || lIdx === lanes.length - 1;

      ctx.save();
      ctx.strokeStyle = isRail ? sideGlow : 'rgba(0, 243, 255, 0.15)';
      ctx.lineWidth = isRail ? 3.5 : 1.5;

      if (isRail) {
        ctx.shadowColor = sideGlow;
        ctx.shadowBlur = 15;
      }

      ctx.beginPath();
      let first = true;

      for (let i = 0; i <= count; i++) {
        const lineZ = startZ + i * gridStep;
        const proj = this.game.camera.project(xOffset, 0, lineZ, this.game.getTrackCurve, width, height);
        if (!proj) continue;

        if (first) {
          ctx.moveTo(proj.x, proj.y);
          first = false;
        } else {
          ctx.lineTo(proj.x, proj.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    });

    for (let i = 0; i < count; i++) {
      const lineZ = startZ + i * gridStep;

      const leftProj = this.game.camera.project(-trackHalfW, 0, lineZ, this.game.getTrackCurve, width, height);
      const rightProj = this.game.camera.project(trackHalfW, 0, lineZ, this.game.getTrackCurve, width, height);

      if (!leftProj || !rightProj) continue;

      const thickness = Math.max(0.5, 3.5 * leftProj.scale / 100);
      const alpha = Math.max(0.02, 0.5 * (1.0 - (lineZ - this.game.camera.z) / this.game.drawDistance));

      ctx.strokeStyle = `rgba(0, 243, 255, ${alpha * 0.4})`;
      ctx.lineWidth = thickness;

      ctx.beginPath();
      ctx.moveTo(leftProj.x, leftProj.y);
      ctx.lineTo(rightProj.x, rightProj.y);
      ctx.stroke();

      if (lineZ % 40 === 0) {
        const postHeight = 8.5;
        const leftTopProj = this.game.camera.project(-trackHalfW, postHeight, lineZ, this.game.getTrackCurve, width, height);
        const rightTopProj = this.game.camera.project(trackHalfW, postHeight, lineZ, this.game.getTrackCurve, width, height);

        if (leftTopProj && rightTopProj) {
          const fenceColor = lineZ % 80 === 0 ? neonPink : sideGlow;
          ctx.lineWidth = Math.max(1, 2.0 * leftProj.scale / 100);
          ctx.strokeStyle = fenceColor;
          ctx.shadowColor = fenceColor;
          ctx.shadowBlur = Math.min(15, leftProj.scale / 12);

          ctx.beginPath();
          ctx.moveTo(leftProj.x, leftProj.y);
          ctx.lineTo(leftTopProj.x, leftTopProj.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(rightProj.x, rightProj.y);
          ctx.lineTo(rightTopProj.x, rightTopProj.y);
          ctx.stroke();

          const nextZ = lineZ + 40;
          const leftNextTopProj = this.game.camera.project(-trackHalfW, postHeight, nextZ, this.game.getTrackCurve, width, height);
          const rightNextTopProj = this.game.camera.project(trackHalfW, postHeight, nextZ, this.game.getTrackCurve, width, height);

          if (leftNextTopProj && rightNextTopProj) {
            ctx.beginPath();
            ctx.moveTo(leftTopProj.x, leftTopProj.y);
            ctx.lineTo(leftNextTopProj.x, leftNextTopProj.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(rightTopProj.x, rightTopProj.y);
            ctx.lineTo(rightNextTopProj.x, rightNextTopProj.y);
            ctx.stroke();
          }
        }
      }
    }
  }
}
