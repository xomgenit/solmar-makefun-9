// combat.js — hitscan shooting + generic enemies (fresh, SOLMAR)
import { dist, segmentHitsRects } from './util.js';
import { rectsOf } from './city.js';

export function spawnEnemy(game, x, y, type) {
  const e = {
    type: type || 'king', x, y, angle: 0,
    hp: type === 'cop' ? 60 : 80, maxHp: type === 'cop' ? 60 : 80,
    fireCd: 0.6 + Math.random() * 0.8, dead: false, holdX: x, holdY: y,
  };
  game.enemies.push(e);
  return e;
}

export function hasLineOfSight(game, x1, y1, x2, y2) {
  return !segmentHitsRects(x1, y1, x2, y2, rectsOf(game.city));
}

// Hitscan shot from (x,y) along angle. Returns the hit enemy/player or null.
export function shoot(game, x, y, angle, opts) {
  const fromPlayer = !!(opts && opts.fromPlayer);
  const range = 460;
  const tx = x + Math.cos(angle) * range, ty = y + Math.sin(angle) * range;
  let best = null, bestD = range;
  const targets = fromPlayer ? game.enemies : [game.player];
  for (const t of targets) {
    if (t.dead) continue;
    if (fromPlayer && t.hp <= 0) continue;
    const dx = t.x - x, dy = t.y - y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 0 || along > range) continue;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp > 18) continue;
    if (!hasLineOfSight(game, x, y, t.x, t.y)) continue;
    if (along < bestD) { bestD = along; best = t; }
  }
  // wall stop: shorten the tracer at the first building hit
  let endX = tx, endY = ty;
  const rects = rectsOf(game.city);
  let wallD = range;
  for (let d = 20; d < range; d += 20) {
    const px = x + Math.cos(angle) * d, py = y + Math.sin(angle) * d;
    if (rects.some(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)) { wallD = d; break; }
  }
  if (best) { endX = best.x; endY = best.y; }
  else if (wallD < range) { endX = x + Math.cos(angle) * wallD; endY = y + Math.sin(angle) * wallD; }
  if (game.effects) {
    game.effects.tracer(x, y, endX, endY);
    game.effects.muzzle(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18);
  }
  game.sfx?.('shoot');
  if (fromPlayer) game.shotsFiredAt = performance.now();
  if (best) {
    if (fromPlayer) {
      best.hp -= 34;
      if (game.effects) game.effects.blood(best.x, best.y, 5);
      if (best.hp <= 0) killEnemy(game, best);
    } else {
      hurtPlayer(game, 12);
    }
  }
  return best;
}

export function killEnemy(game, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  if (game.effects) game.effects.burst(enemy.x, enemy.y, 12, '#c0392b', 150);
  if (enemy.type === 'cop') game.police?.addWanted(1);
  if (enemy.type === 'king') game.missions?.onEnemyDown(enemy);
  game.stats.kills = (game.stats.kills || 0) + 1;
}

export function hurtPlayer(game, amount) {
  if (game.state !== 'playing' || game.player.dead) return;
  game.player.health -= amount;
  game.player.lastHurt = performance.now();
  if (game.effects) game.effects.addShake(3);
  if (game.player.health <= 0) {
    game.player.health = 0;
    game.player.dead = true;
  }
}

export function updateEnemies(game, dt) {
  const p = game.player;
  for (const e of game.enemies) {
    if (e.dead) continue;
    e.fireCd -= dt;
    const d = dist(e.x, e.y, p.x, p.y);
    const range = e.type === 'king' ? 380 : 320;
    if (d < range && hasLineOfSight(game, e.x, e.y, p.x, p.y)) {
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.fireCd <= 0) {
        e.fireCd = 0.9 + Math.random() * 0.7;
        // enemy shot: spread, may miss
        const a = e.angle + (Math.random() - 0.5) * 0.22;
        shoot(game, e.x, e.y, a, { fromPlayer: false });
      }
    } else if (e.type === 'king') {
      // kings hold ground: drift back toward their post
      const hd = dist(e.x, e.y, e.holdX, e.holdY);
      if (hd > 60) {
        const a = Math.atan2(e.holdY - e.y, e.holdX - e.x);
        e.x += Math.cos(a) * 40 * dt; e.y += Math.sin(a) * 40 * dt;
      }
    }
  }
  game.enemies = game.enemies.filter(e => !e.dead || (e.deadT = (e.deadT || 0) + dt) < 3);
}

export function drawEnemy(ctx, e) {
  if (e.dead) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.fillStyle = e.type === 'cop' ? '#1c2733' : '#7a1f1f';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(6, -3, 14, 6); // gun
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(2, 0, 5, 0, Math.PI * 2); ctx.fill();
  if (e.type === 'cop') {
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-7, -7, 14, 4);
  }
  ctx.restore();
  // health bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(e.x - 16, e.y - 20, 32, 4);
  ctx.fillStyle = e.type === 'cop' ? '#3498db' : '#e74c3c';
  ctx.fillRect(e.x - 16, e.y - 20, 32 * Math.max(0, e.hp / e.maxHp), 4);
}
