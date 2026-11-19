// people.js — pedestrians (fresh, SOLMAR)
import { clamp, dist } from './util.js';
import { collideCircle } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f2c200', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];

export function createPed(x, y) {
  return {
    x, y, angle: Math.random() * Math.PI * 2,
    speed: 45 + Math.random() * 35, state: 'walk', // walk | flee | down
    downT: 0, shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    target: null, retarget: 0,
  };
}

function pickTarget(game, ped) {
  // wander to a nearby road point
  const a = Math.random() * Math.PI * 2, d = 200 + Math.random() * 500;
  ped.target = { x: clamp(ped.x + Math.cos(a) * d, 40, 3560), y: clamp(ped.y + Math.sin(a) * d, 40, 3560) };
}

export function updatePeds(game, dt) {
  const p = game.player;
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) ped.state = 'walk';
      continue;
    }
    const dPlayer = dist(ped.x, ped.y, p.x, p.y);
    const playerSpeed = p.car ? Math.abs(p.car.speed || 0) : 0;
    const danger = dPlayer < 130 && (game.shotsFiredAt && performance.now() - game.shotsFiredAt < 1500 || playerSpeed > 200);
    if (danger && ped.state !== 'flee') { ped.state = 'flee'; ped.retarget = 0; }
    if (ped.state === 'flee') {
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * 150 * dt, ny = ped.y + Math.sin(a) * 150 * dt;
      const fixed = collideCircle(game.city, nx, ny, 8);
      ped.x = fixed.x; ped.y = fixed.y;
      if (dPlayer > 260) ped.state = 'walk';
      continue;
    }
    ped.retarget -= dt;
    if (!ped.target || ped.retarget <= 0 || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
      pickTarget(game, ped);
      ped.retarget = 4 + Math.random() * 4;
    }
    const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    ped.angle = a;
    const nx = ped.x + Math.cos(a) * ped.speed * dt, ny = ped.y + Math.sin(a) * ped.speed * dt;
    const fixed = collideCircle(game.city, nx, ny, 8);
    ped.x = fixed.x; ped.y = fixed.y;
  }
  // keep ped density near the player
  const near = game.peds.filter(pd => dist(pd.x, pd.y, p.x, p.y) < 1200).length;
  if (near < 14) {
    for (let i = near; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, d = 500 + Math.random() * 500;
      game.peds.push(createPed(clamp(p.x + Math.cos(a) * d, 40, 3560), clamp(p.y + Math.sin(a) * d, 40, 3560)));
    }
  }
  game.peds = game.peds.filter(pd => dist(pd.x, pd.y, p.x, p.y) < 2000);
}

export function scarePeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.state !== 'down' && dist(ped.x, ped.y, x, y) < radius) ped.state = 'flee';
  }
}

export function knockDownPed(game, ped, byPlayer) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downT = 3;
  if (byPlayer) {
    if (game.effects) game.effects.blood(ped.x, ped.y, 6);
    game.police?.addWanted(1);
    game.stats.pedsHit = (game.stats.pedsHit || 0) + 1;
  }
}

export function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(1.2);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-9, -4, 18, 8);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(11, 0, 5, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.rotate(ped.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(-4, -6, 8, 12);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(7, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
