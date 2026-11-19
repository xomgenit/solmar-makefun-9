// vehicles.js — car models, arcade physics, traffic, parked cars (fresh, SOLMAR)
import { clamp, angleDiff, dist } from './util.js';
import { collideCircle, nearestRoadPoint, BLOCK, ROAD_W, WORLD } from './city.js';

export const MODELS = {
  sedan:  { name: 'Sedan',  color: '#4a90d9', len: 46, wid: 22, accel: 420, top: 430, grip: 0.92 },
  sports: { name: 'Sports', color: '#d92626', len: 44, wid: 21, accel: 620, top: 560, grip: 0.88 },
  taxi:   { name: 'Taxi',   color: '#f2c200', len: 46, wid: 22, accel: 400, top: 410, grip: 0.92 },
  van:    { name: 'Van',    color: '#7d8c99', len: 54, wid: 24, accel: 320, top: 340, grip: 0.95 },
  pickup: { name: 'Pickup', color: '#3f7d4e', len: 50, wid: 23, accel: 460, top: 430, grip: 0.9 },
  cruiser:{ name: 'Cruiser',color: '#1c2733', len: 48, wid: 22, accel: 560, top: 520, grip: 0.9 },
};

export function createCar(x, y, angle, model, role) {
  const m = MODELS[model] || MODELS.sedan;
  return {
    x, y, angle, model, role: role || 'traffic', color: null, // B2: color override (gold sports car); null = model default
    vx: 0, vy: 0, health: 100, wrecked: false, handbrake: false,
    speed: 0, cruise: 150 + Math.random() * 90, axis: 'x', dir: 1,
    noTurn: false, stuckT: 0, dead: false,
  };
}

// Arcade driving: velocity-vector model. Drag fix (retry 8): forward speed
// decays with no throttle so a car never coasts at top speed forever.
export function driveCar(game, car, input, dt) {
  if (car.wrecked) { car.vx *= 0.9; car.vy *= 0.9; return; }
  const m = MODELS[car.model];
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let fwd = car.vx * fx + car.vy * fy;
  let lat = -car.vx * fy + car.vy * fx;
  if (input.throttle > 0) fwd += m.accel * input.throttle * dt;
  else if (input.throttle < 0) fwd += m.accel * 0.6 * input.throttle * dt; // reverse/brake
  const drag = input.throttle !== 0 ? 0.12 : 0.9;
  fwd *= Math.exp(-drag * dt);
  fwd = clamp(fwd, -160, m.top);
  const grip = input.handbrake ? 0.55 : m.grip;
  lat *= Math.exp(-(input.handbrake ? 1.2 : 5.0) * dt); // lateral grip: kill sideways slide (stronger when not drifting)
  lat = clamp(lat, -260, 260);
  const steerRate = (input.steer || 0) * 2.6 * clamp(Math.abs(fwd) / 160, 0, 1) * (fwd < 0 ? -1 : 1) * (input.handbrake ? 1.5 : 1);
  car.angle += steerRate * dt;
  const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
  car.vx = nfx * fwd - nfy * lat;
  car.vy = nfy * fwd + nfx * lat;
  car.speed = Math.abs(fwd);
  const nx = car.x + car.vx * dt, ny = car.y + car.vy * dt;
  const fixed = collideCircle(game.city, nx, ny, 15);
  if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) {
    // hit a building: scrub speed, spark
    if (car.speed > 200 && game.effects) game.effects.sparks(car.x, car.y, 4);
    car.vx *= 0.4; car.vy *= 0.4;
  }
  car.x = fixed.x; car.y = fixed.y;
  if (input.handbrake && car.speed > 180 && game.effects && Math.random() < 0.5)
    game.effects.skid(car.x, car.y, car.angle);
}

export function damageCar(game, car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (game.effects && amount > 8) game.effects.smoke(car.x, car.y, 3);
  if (car.health <= 0) {
    car.health = 0; car.wrecked = true; car.vx = 0; car.vy = 0;
    if (game.effects) { game.effects.smoke(car.x, car.y, 10); game.effects.burst(car.x, car.y, 10, '#ff7b00', 120); }
  }
}

// Circle-pair separation between cars (parked cars never get shoved).
// Collision damage is throttled per car (hitCd): a rear-end must cost one
// hit, not per-frame damage until the car is wrecked.
export function collideCars(game, dt) {
  const cars = game.cars;
  for (const c of cars) if (c.hitCd > 0) c.hitCd -= dt || 0;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy), min = 30;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2, nx = dx / d, ny = dy / d;
        const aMove = a.role === 'parked' ? 0 : (b.role === 'parked' ? 1 : 0.5);
        const bMove = b.role === 'parked' ? 0 : (a.role === 'parked' ? 1 : 0.5);
        a.x -= nx * push * aMove * 2; a.y -= ny * push * aMove * 2;
        b.x += nx * push * bMove * 2; b.y += ny * push * bMove * 2;
        const rel = Math.abs((b.vx - a.vx) * nx + (b.vy - a.vy) * ny);
        if (rel > 120) {
          for (const c of [a, b]) {
            if ((c.hitCd || 0) <= 0) { damageCar(game, c, rel * 0.02); c.hitCd = 0.6; }
          }
          if (game.effects) game.effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 3);
        }
      }
    }
  }
}

function laneOffset(axis, dir) {
  // right-hand traffic: offset +24 from road centre on the driving side
  if (axis === 'x') return { ox: 0, oy: dir > 0 ? 24 : -24 };
  return { ox: dir > 0 ? -24 : 24, oy: 0 };
}

export function spawnTrafficCar(game, nearX, nearY) {
  const rng = Math.random;
  const axis = rng() < 0.5 ? 'x' : 'y';
  const dir = rng() < 0.5 ? 1 : -1;
  const road = Math.round(((axis === 'x' ? nearY : nearX) + (rng() - 0.5) * 900) / BLOCK) * BLOCK;
  const along = (axis === 'x' ? nearX : nearY) + (rng() - 0.5) * 1200;
  const off = laneOffset(axis, dir);
  const models = ['sedan', 'taxi', 'van', 'pickup', 'sedan'];
  const model = models[Math.floor(rng() * models.length)];
  const car = createCar(
    axis === 'x' ? clamp(along, 60, WORLD - 60) : clamp(road + off.ox, 60, WORLD - 60),
    axis === 'x' ? clamp(road + off.oy, 60, WORLD - 60) : clamp(along, 60, WORLD - 60),
    axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
    model, 'traffic');
  car.axis = axis; car.dir = dir;
  car.cruise = 130 + rng() * 100;
  return car;
}

export function spawnParkedCar(game, x, y) {
  const models = ['sedan', 'sports', 'taxi', 'van', 'pickup'];
  const model = models[Math.floor(Math.random() * models.length)];
  const car = createCar(x, y, (Math.floor(Math.random() * 4) * Math.PI) / 2, model, 'parked');
  car.handbrake = true;
  return car;
}

export function updateTraffic(game, dt) {
  const p = game.player;
  const keep = [];
  for (const car of game.cars) {
    if (car.role !== 'traffic' || car.dead) { keep.push(car); continue; }
    // recycle far cars near the player
    if (dist(car.x, car.y, p.x, p.y) > 1500) {
      const nc = spawnTrafficCar(game, p.x, p.y);
      nc.x = car.x; // keep slot, reposition via respawn logic below
      const fresh = spawnTrafficCar(game, p.x, p.y);
      keep.push(fresh);
      continue;
    }
    // stop for the car ahead in the same lane
    let blocked = false;
    for (const o of game.cars) {
      if (o === car || o.dead) continue;
      const dx = o.x - car.x, dy = o.y - car.y;
      const ahead = car.axis === 'x' ? dx * car.dir : dy * car.dir;
      const side = car.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
      if (ahead > 0 && ahead < 70 && side < 30) { blocked = true; break; }
    }
    // turn at intersections sometimes
    const nearX = Math.abs(car.x - Math.round(car.x / BLOCK) * BLOCK) < 14;
    const nearY = Math.abs(car.y - Math.round(car.y / BLOCK) * BLOCK) < 14;
    if (nearX && nearY && Math.random() < dt * 0.25) {
      car.axis = car.axis === 'x' ? 'y' : 'x';
      car.dir = Math.random() < 0.5 ? 1 : -1;
    }
    const target = blocked ? 0 : car.cruise;
    const fwd = car.axis === 'x' ? car.vx * car.dir : car.vy * car.dir;
    const accel = target - fwd;
    const step = clamp(accel, -260 * dt, 200 * dt);
    const ns = fwd + step;
    if (car.axis === 'x') { car.vx = ns * car.dir; car.vy = 0; }
    else { car.vy = ns * car.dir; car.vx = 0; }
    car.angle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.x += car.vx * dt; car.y += car.vy * dt;
    const fixed = collideCircle(game.city, car.x, car.y, 14);
    car.x = fixed.x; car.y = fixed.y;
    keep.push(car);
  }
  game.cars = keep;
  // keep traffic density up near the player
  const traffic = game.cars.filter(c => c.role === 'traffic').length;
  if (traffic < 10) {
    for (let i = traffic; i < 10; i++) game.cars.push(spawnTrafficCar(game, p.x, p.y));
  }
}

export function drawCar(ctx, car) {
  const m = MODELS[car.model];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-m.len / 2 + 3, -m.wid / 2 + 4, m.len, m.wid);
  ctx.fillStyle = car.wrecked ? '#2b2b2b' : (car.color || m.color);
  ctx.fillRect(-m.len / 2, -m.wid / 2, m.len, m.wid);
  // cabin + windshield
  ctx.fillStyle = car.wrecked ? '#1a1a1a' : '#222831';
  ctx.fillRect(-m.len * 0.18, -m.wid / 2 + 4, m.len * 0.32, m.wid - 8);
  ctx.fillStyle = 'rgba(180,220,255,0.75)';
  ctx.fillRect(m.len * 0.22, -m.wid / 2 + 4, 5, m.wid - 8);
  // headlights
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(m.len / 2 - 2, -m.wid / 2 + 2, 3, 4);
  ctx.fillRect(m.len / 2 - 2, m.wid / 2 - 6, 3, 4);
  if (car.model === 'cruiser') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-m.len * 0.05, -m.wid / 2, m.len * 0.1, m.wid);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-6, -m.wid / 2, 5, 5);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(1, -m.wid / 2, 5, 5);
  }
  if (car.model === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-8, -m.wid / 2, 16, 4);
    ctx.fillRect(-8, m.wid / 2 - 4, 16, 4);
  }
  ctx.restore();
  if (car.health < 100 && !car.wrecked) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(car.x - 20, car.y - 26, 40, 5);
    ctx.fillStyle = car.health > 40 ? '#f2c200' : '#e74c3c';
    ctx.fillRect(car.x - 20, car.y - 26, 40 * (car.health / 100), 5);
  }
}
