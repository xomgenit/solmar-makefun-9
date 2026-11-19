// effects.js — particles, tracers, floaters, skids, shake (fresh, SOLMAR)
// NOTE (retry 7 bug): helpers are methods bound onto the returned object
// itself (game.effects.burst etc.), not on a separate helper object.
export function createEffects() {
  const fx = {
    parts: [], tracers: [], floaters: [], skids: [], shake: 0,
    burst(x, y, n, color, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = (speed || 120) * (0.4 + Math.random());
        fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color: color || '#ffcf5c', size: 2 + Math.random() * 3 });
      }
    },
    sparks(x, y, n) { fx.burst(x, y, n || 8, '#ffd166', 200); },
    smoke(x, y, n) { fx.burst(x, y, n || 6, '#9aa0a6', 40); },
    blood(x, y, n) { fx.burst(x, y, n || 8, '#c0392b', 140); },
    tracer(x1, y1, x2, y2, color) { fx.tracers.push({ x1, y1, x2, y2, life: 0.09, color: color || '#ffe08a' }); },
    floater(x, y, text, color) { fx.floaters.push({ x, y, text, color: color || '#fff', life: 1.1 }); },
    skid(x, y, angle) { fx.skids.push({ x, y, angle, life: 2.2 }); if (fx.skids.length > 220) fx.skids.shift(); },
    muzzle(x, y) { fx.burst(x, y, 4, '#ffd166', 90); },
    addShake(amount) { fx.shake = Math.min(14, fx.shake + (amount || 4)); },
  };
  return fx;
}

export function updateEffects(fx, dt) {
  for (const p of fx.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  fx.parts = fx.parts.filter(p => p.life > 0);
  for (const t of fx.tracers) t.life -= dt;
  fx.tracers = fx.tracers.filter(t => t.life > 0);
  for (const f of fx.floaters) { f.y -= 34 * dt; f.life -= dt; }
  fx.floaters = fx.floaters.filter(f => f.life > 0);
  for (const s of fx.skids) s.life -= dt;
  fx.skids = fx.skids.filter(s => s.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 26);
}

export function drawEffects(fx, ctx) {
  ctx.save();
  for (const s of fx.skids) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
    ctx.globalAlpha = Math.min(0.5, s.life * 0.25);
    ctx.fillStyle = '#1c1c1c'; ctx.fillRect(-7, -2, 14, 4); ctx.restore();
  }
  for (const t of fx.tracers) {
    ctx.globalAlpha = Math.max(0, t.life / 0.09);
    ctx.strokeStyle = t.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  for (const p of fx.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const f of fx.floaters) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}
