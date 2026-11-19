// police.js — wanted system 0–5: foot cops + cruisers (fresh, SOLMAR)
import { clamp, dist, angleDiff } from './util.js';
import { spawnEnemy, hasLineOfSight, shoot } from './combat.js';
import { createCar, driveCar, damageCar } from './vehicles.js';
import { collideCircle } from './city.js';

export function createPolice(game) {
  const pol = {
    lastSeen: null, // {x, y, t}
    freshUntil: 0,
    unseenT: 0,
    coolT: 0,
    bustT: 0,

    addWanted(n) {
      const before = game.wanted;
      game.wanted = clamp(game.wanted + n, 0, 5);
      if (game.wanted > before) {
        pol.lastSeen = { x: game.player.x, y: game.player.y, t: performance.now() };
        pol.freshUntil = performance.now() + 3000; // fresh heat draws a first response for 3s
        pol.unseenT = 0; pol.coolT = 0;
      }
    },
    clearWanted() {
      game.wanted = 0;
      pol.lastSeen = null;
      pol.standDown();
    },
    setWanted(n) {
      game.wanted = clamp(n, 0, 5);
      if (n > 0) {
        pol.lastSeen = { x: game.player.x, y: game.player.y, t: performance.now() };
        pol.freshUntil = performance.now() + 3000;
        pol.unseenT = 0; pol.coolT = 0;
      } else pol.standDown();
    },
    standDown() {
      game.enemies = game.enemies.filter(e => e.type !== 'cop');
      for (const c of game.cars) if (c.role === 'cruiser') c.dead = true;
      game.cars = game.cars.filter(c => c.role !== 'cruiser' || !c.dead);
    },
    isSeen() {
      if (performance.now() < pol.freshUntil) return true;
      const p = game.player;
      for (const e of game.enemies) {
        if (e.type !== 'cop' || e.dead) continue;
        if (dist(e.x, e.y, p.x, p.y) < 420 && hasLineOfSight(game, e.x, e.y, p.x, p.y)) return true;
      }
      for (const c of game.cars) {
        if (c.role !== 'cruiser' || c.dead) continue;
        if (dist(c.x, c.y, p.x, p.y) < 460) return true;
      }
      return false;
    },

    update(dt) {
      const p = game.player;
      if (game.wanted <= 0) { pol.standDown(); return; }
      const seen = pol.isSeen();
      if (seen) {
        pol.lastSeen = { x: p.x, y: p.y, t: performance.now() };
        pol.unseenT = 0; pol.coolT = 0;
      } else {
        pol.unseenT += dt;
        // heat cools when unseen: -1 per 2s after 4s unseen, if far from last seen
        if (pol.unseenT > 4 && pol.lastSeen && dist(p.x, p.y, pol.lastSeen.x, pol.lastSeen.y) > 600) {
          pol.coolT += dt;
          if (pol.coolT > 2) { pol.coolT = 0; game.wanted = Math.max(0, game.wanted - 1); if (game.wanted === 0) pol.standDown(); }
        }
      }
      const driving = !!p.car;
      const wantFoot = driving ? 0 : Math.min(game.wanted, 3);
      const wantCruiser = driving ? Math.min(game.wanted, 3) : 0;
      const foot = game.enemies.filter(e => e.type === 'cop' && !e.dead).length;
      const cruisers = game.cars.filter(c => c.role === 'cruiser' && !c.dead).length;
      // Fresh heat draws a first response for 3s; afterwards units only
      // spawn while the player is seen — otherwise heat could never cool.
      const maySpawn = seen;
      // spawn foot cops near the player (off-screen-ish, on roads)
      for (let i = foot; maySpawn && i < wantFoot; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = spawnEnemy(game, clamp(p.x + Math.cos(a) * 380, 40, 3560), clamp(p.y + Math.sin(a) * 380, 40, 3560), 'cop');
        e.hp = 60; e.maxHp = 60;
      }
      for (let i = cruisers; maySpawn && i < wantCruiser; i++) {
        const a = Math.random() * Math.PI * 2;
        const car = createCar(clamp(p.x + Math.cos(a) * 420, 40, 3560), clamp(p.y + Math.sin(a) * 420, 40, 3560), a, 'cruiser', 'cruiser');
        game.cars.push(car);
      }
      // foot cops: chase, shoot, bust (bust timer is per-frame, not per-cop:
      // it must NOT reset when another cop is far away)
      let nearBust = false;
      for (const e of game.enemies) {
        if (e.type !== 'cop' || e.dead) continue;
        const d = dist(e.x, e.y, p.x, p.y);
        const tx = pol.lastSeen ? pol.lastSeen.x : p.x, ty = pol.lastSeen ? pol.lastSeen.y : p.y;
        const a = Math.atan2(ty - e.y, tx - e.x);
        const speed = 175;
        const nx = e.x + Math.cos(a) * speed * dt, ny = e.y + Math.sin(a) * speed * dt;
        const fixed = collideCircle(game.city, nx, ny, 9);
        e.x = fixed.x; e.y = fixed.y;
        e.angle = a;
        if (!p.car && d < 42) nearBust = true;
        if (d < 300 && seen) {
          e.fireCd -= dt;
          if (e.fireCd <= 0) {
            e.fireCd = 1.1 + Math.random() * 0.6;
            shoot(game, e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x) + (Math.random() - 0.5) * 0.2, { fromPlayer: false });
          }
        }
      }
      if (nearBust) {
        pol.bustT += dt;
        if (pol.bustT > 1.1) { game.busted = true; pol.bustT = 0; }
      } else pol.bustT = 0;
      // cruisers: pursue + ram, stuck-recovery reverse
      for (const c of game.cars) {
        if (c.role !== 'cruiser' || c.dead || c.wrecked) continue;
        const tx = pol.lastSeen ? pol.lastSeen.x : p.x, ty = pol.lastSeen ? pol.lastSeen.y : p.y;
        const want = Math.atan2(ty - c.y, tx - c.x);
        const diff = angleDiff(c.angle, want);
        const d = dist(c.x, c.y, p.x, p.y);
        let throttle = 1, steer = clamp(diff * 1.6, -1, 1);
        if (c.speed < 20) { c.stuckT += dt; } else c.stuckT = 0;
        if (c.stuckT > 1.2) { throttle = -0.8; steer = -steer; if (c.stuckT > 2.2) c.stuckT = 0; }
        driveCar(game, c, { throttle, steer, handbrake: false }, dt);
        // ram the player's car
        if (p.car && d < 34) {
          damageCar(game, p.car, 6 * dt * 10);
          if (game.effects && Math.random() < 0.1) game.effects.sparks(p.car.x, p.car.y, 2);
        }
        // despawn far away
        if (d > 2100) c.dead = true;
      }
      game.cars = game.cars.filter(c => !(c.role === 'cruiser' && c.dead));
    },
  };
  return pol;
}
