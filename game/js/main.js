// main.js — orchestration: states, player control, save wiring, debug hooks (fresh, SOLMAR)
import { buildCity, zoneAt, collideCircle, PIER } from './city.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createEffects, updateEffects } from './effects.js';
import { createMissions } from './missions.js';
import { createPolice } from './police.js';
import { createCar, driveCar, collideCars, updateTraffic, spawnTrafficCar, spawnParkedCar, drawCar } from './vehicles.js';
import { createPed, updatePeds, scarePeds, knockDownPed } from './people.js';
import { shoot, updateEnemies, hasLineOfSight } from './combat.js';
import { drawWorld } from './render.js';
import { SAVE_KEY, hasSave, saveGame, loadSave, clearSave } from './save.js';
import { ensureAudio, sfx, updateEngine, updateSiren, stopAllLoops } from './audio.js';
import { clamp, dist } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const autostart = params.get('autostart') === '1';

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const input = createInput(canvas);
const hud = createHud();

// ---- single game object, reset in place (window.__solmar.game never goes stale)
const game = {
  state: 'title', // title | playing | paused | wasted | busted
  city: null, player: null, cars: [], peds: [], enemies: [],
  wanted: 0, cam: { x: 1800, y: 1800 }, zoneName: 'DOWNTOWN',
  missionMarker: null, stats: {}, saveData: { missionsDone: [] },
  busted: false, shotsFiredAt: 0, effects: null, hud, police: null, missions: null,
  sfx: (n) => { try { sfx[n]?.(); } catch (e) {} },
  saveNow: null,
};
game.effects = createEffects();

function resetGame(seed, saveData) {
  const city = buildCity(seed);
  game.city = city;
  game.cars = [];
  game.peds = [];
  game.enemies = [];
  game.wanted = 0;
  game.busted = false;
  game.stats = { kills: 0, pedsHit: 0 };
  game.saveData = { missionsDone: (saveData && saveData.missionsDone) || [] };
  const h = city.landmarkById.hideout;
  const startX = saveData ? saveData.x : h.cx;
  const startY = saveData ? saveData.y : h.cy + 130;
  game.player = {
    x: startX, y: startY, angle: 0, aimAngle: 0,
    health: saveData ? saveData.health : 100,
    cash: saveData ? saveData.cash : 200,
    car: null, dead: false, fireCd: 0, lastHurt: 0,
  };
  game.cam = { x: startX, y: startY };
  // red sports car in the eastbound lane by the hideout
  const sports = createCar(h.cx + 130, h.cy + 24, 0, 'sports', 'parked');
  sports.handbrake = true;
  game.cars.push(sports);
  // parked cars scattered near roads
  for (let i = 0; i < 8; i++) {
    const gx = (1 + Math.floor(Math.random() * 10)) * 300;
    const gy = (1 + Math.floor(Math.random() * 10)) * 300;
    game.cars.push(spawnParkedCar(game, gx + 130, gy + 24));
  }
  // traffic
  for (let i = 0; i < 10; i++) game.cars.push(spawnTrafficCar(game, startX, startY));
  // pedestrians
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2, d = 200 + Math.random() * 800;
    game.peds.push(createPed(clamp(startX + Math.cos(a) * d, 40, 3560), clamp(startY + Math.sin(a) * d, 40, 3560)));
  }
  // restore saved car
  if (saveData && saveData.car) {
    const c = createCar(saveData.car.x, saveData.car.y, saveData.car.angle, saveData.car.model, 'player');
    c.health = saveData.car.health;
    if (saveData.car.color) c.color = saveData.car.color; // B2: keep the gold sports car gold on CONTINUE
    game.cars.push(c);
    game.player.car = c;
  }
  game.police = createPolice(game);
  game.missions = createMissions(game);
  if (saveData && saveData.missions) game.missions.restore(saveData.missions);
  else game.missions.start('free-roam');
}

game.saveNow = () => { saveGame(game); return true; };

function startNewGame() {
  const seed = seedParam ? parseInt(seedParam, 10) || 7 : Math.floor(Math.random() * 100000);
  resetGame(seed, null);
  // B2: NEW GAME starts Vera's job chain (mission 1), $200 start (set in resetGame).
  game.missions.reset();
  game.missions.start('first-wheels');
  game.state = 'playing';
  showScreen(null);
  hud.showHud(true);
  hud.banner('SOLMAR', 'Streets of the Sun — Vera has work for you', '#f2c200');
  ensureAudio();
}

function continueGame() {
  const sv = loadSave();
  if (!sv) return startNewGame();
  resetGame(sv.seed, sv);
  game.state = 'playing';
  showScreen(null);
  hud.showHud(true);
  ensureAudio();
}

function showScreen(name) {
  for (const id of ['title-screen', 'pause-screen', 'wasted-screen', 'busted-screen']) {
    const el = document.getElementById(id);
    if (el) el.style.display = id === name ? 'flex' : 'none';
  }
}

function quitToTitle() {
  game.state = 'title';
  stopAllLoops();
  showScreen('title-screen');
  hud.showHud(false);
  document.getElementById('continue-btn').style.display = hasSave() ? 'block' : 'none';
}

// ---- UI wiring
document.getElementById('newgame-btn').addEventListener('click', () => { sfx.click(); startNewGame(); });
document.getElementById('continue-btn').addEventListener('click', () => { sfx.click(); continueGame(); });
document.getElementById('howto-btn').addEventListener('click', () => {
  sfx.click();
  document.getElementById('howto').style.display =
    document.getElementById('howto').style.display === 'block' ? 'none' : 'block';
});
document.getElementById('resume-btn').addEventListener('click', () => { sfx.click(); game.state = 'playing'; showScreen(null); });
document.getElementById('save-btn').addEventListener('click', () => {
  sfx.click();
  saveGame(game);
  hud.banner('SAVED', 'Progress saved', '#2ecc71');
});
document.getElementById('restart-mission-btn').addEventListener('click', () => { sfx.click(); game.missions?.restartCurrent(); game.state = 'playing'; showScreen(null); });
document.getElementById('quit-btn').addEventListener('click', () => { sfx.click(); quitToTitle(); });
document.getElementById('respawn-btn').addEventListener('click', () => { sfx.click(); respawn('hospital'); });
document.getElementById('bail-btn').addEventListener('click', () => { sfx.click(); respawn('hideout'); });
document.getElementById('continue-btn').style.display = hasSave() ? 'block' : 'none';

function respawn(where) {
  const p = game.player;
  const fine = where === 'hospital' ? 100 : 150;
  p.cash = Math.max(0, p.cash - fine);
  p.health = 100; p.dead = false; p.car = null;
  game.wanted = 0;
  game.police?.clearWanted();
  const spot = where === 'hospital' ? game.city.landmarkById.hospital : game.city.landmarkById.hideout;
  p.x = spot.cx; p.y = spot.cy + 130;
  game.cam.x = p.x; game.cam.y = p.y;
  game.state = 'playing';
  showScreen(null);
  hud.banner(where === 'hospital' ? 'PATCHED UP' : 'BAILED OUT', `-$${fine}`, '#e74c3c');
  saveGame(game);
}

// ---- debug hooks (tests / screenshots)
window.__solmar = {
  game,
  teleport(x, y) {
    const p = game.player;
    p.x = x; p.y = y;
    if (p.car) { p.car.x = x; p.car.y = y; p.car.vx = 0; p.car.vy = 0; } // teleport zeroes car velocity (retry 8 fix)
    game.cam.x = x; game.cam.y = y;
  },
  setWanted(n) { game.police?.setWanted(n); },
  giveCash(n) { game.player.cash += n; },
  zone() { return game.zoneName; },
  los(x1, y1, x2, y2) { return hasLineOfSight(game, x1, y1, x2, y2); },
};

// ---- player control
function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of game.cars) {
    if (c.dead || c.wrecked || c.role === 'cruiser') continue;
    const d = dist(game.player.x, game.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function stealOrExit() {
  const p = game.player;
  if (p.car) {
    // exit: step out beside the car, leave it parked
    const car = p.car;
    car.role = 'parked'; car.handbrake = true; car.vx = 0; car.vy = 0;
    p.car = null;
    p.x = car.x - 30; p.y = car.y + 26;
    const fixed = collideCircle(game.city, p.x, p.y, 10);
    p.x = fixed.x; p.y = fixed.y;
    return;
  }
  const car = nearestCar(85);
  if (!car) return;
  // seen theft raises heat: a cop or a ped nearby witnesses it
  let seen = false;
  for (const e of game.enemies) if (e.type === 'cop' && !e.dead && dist(e.x, e.y, p.x, p.y) < 420) seen = true;
  for (const pd of game.peds) if (pd.state !== 'down' && dist(pd.x, pd.y, p.x, p.y) < 200) seen = true;
  car.role = 'player'; car.handbrake = false;
  p.car = car;
  p.x = car.x; p.y = car.y;
  game.sfx('steal');
  hud.setHint('W/S drive — A/D steer — SPACE handbrake — E exit');
  if (seen) { game.police?.addWanted(1); hud.banner('STOLEN CAR', 'Someone saw that — wanted +1', '#e74c3c'); }
}

function updatePlayer(dt) {
  const p = game.player;
  if (p.dead) return;
  p.fireCd = Math.max(0, p.fireCd - dt);
  // aim at mouse (world coords)
  const rect = canvas.getBoundingClientRect();
  const mx = input.mouse.x, my = input.mouse.y;
  const wx = game.cam.x + (mx - canvas.width / 2), wy = game.cam.y + (my - canvas.height / 2);
  p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
  if (p.car) {
    const car = p.car;
    const throttle = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) + (input.down('KeyS') || input.down('ArrowDown') ? -1 : 0);
    const steer = (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0) + (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
    driveCar(game, car, { throttle, steer, handbrake: input.down('Space') }, dt);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (car.wrecked) {
      hud.banner('CAR WRECKED', 'Your ride is done', '#e74c3c');
      p.car = null;
      p.x = car.x - 30; p.y = car.y + 26;
    }
    if (car.health <= 0 && !car.wrecked) { /* handled in driveCar/damageCar */ }
  } else {
    let dx = 0, dy = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) dy -= 1;
    if (input.down('KeyS') || input.down('ArrowDown')) dy += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) dx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) dx += 1;
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? 260 : 170;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      p.angle = Math.atan2(dy, dx);
      const nx = p.x + (dx / len) * speed * dt, ny = p.y + (dy / len) * speed * dt;
      const fixed = collideCircle(game.city, nx, ny, 10);
      p.x = fixed.x; p.y = fixed.y;
    }
    // shoot on click
    if ((input.mouse.down || input.mouse.clicked) && p.fireCd <= 0) {
      p.fireCd = 0.18;
      shoot(game, p.x, p.y, p.aimAngle, { fromPlayer: true });
      scarePeds(game, p.x, p.y, 260);
    }
    // run over peds while driving is handled below; on foot, touching a downed ped does nothing
  }
  if (input.wasPressed('KeyE')) stealOrExit();
  // health regen after 8s calm
  if (performance.now() - p.lastHurt > 8000 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + 3 * dt);
  }
  // car hits peds
  if (p.car && Math.abs(p.car.speed || 0) > 120) {
    for (const pd of game.peds) {
      if (pd.state !== 'down' && dist(pd.x, pd.y, p.car.x, p.car.y) < 26) {
        knockDownPed(game, pd, true);
        if (game.effects) game.effects.blood(pd.x, pd.y, 6);
      }
    }
  }
  // services: spa respray + hospital heal
  const spa = game.city.landmarkById.spa, hosp = game.city.landmarkById.hospital;
  if (!p.car && dist(p.x, p.y, hosp.cx, hosp.cy) < 130 && p.health < 100 && p.cash >= 100 && input.wasPressed('KeyF')) {
    p.cash -= 100; p.health = 100;
    game.sfx('heal');
    hud.banner('PATCHED UP', '-$100 — full health', '#2ecc71');
    saveGame(game);
  }
  if (p.car && dist(p.x, p.y, spa.cx, spa.cy) < 150 && game.wanted > 0 && p.cash >= 150 && input.wasPressed('KeyF')) {
    p.cash -= 150;
    p.car.health = 100;
    game.police?.clearWanted();
    game.sfx('heal');
    hud.banner('RESPRAY', '-$150 — wanted cleared', '#2ecc71');
    saveGame(game);
  }
  // contextual hints
  if (!p.car) {
    const car = nearestCar(85);
    if (car) hud.setHint('E — Steal car');
    else if (dist(p.x, p.y, hosp.cx, hosp.cy) < 130 && p.health < 100) hud.setHint('F — Heal $100');
    else if (dist(p.x, p.y, spa.cx, spa.cy) < 150 && game.wanted > 0) hud.setHint('Drive in & press F — Respray $150');
    else hud.setHint('');
  }
}

// ---- main loop
let last = performance.now();
let titlePan = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state === 'title') {
    if (!game.city) resetGame(seedParam ? parseInt(seedParam, 10) || 7 : 7, null);
    titlePan += dt * 24;
    game.cam.x = 1800 + Math.cos(titlePan * 0.01) * 700;
    game.cam.y = 1800 + Math.sin(titlePan * 0.013) * 700;
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld(game, ctx, game.cam, canvas.width, canvas.height);
    input.postUpdate();
    return;
  }
  if (game.state !== 'playing') {
    // paused / wasted / busted: keep rendering the frozen world
    if (game.state === 'paused' && input.wasPressed('Escape')) {
      game.state = 'playing';
      showScreen(null);
    }
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld(game, ctx, game.cam, canvas.width, canvas.height);
    input.postUpdate();
    return;
  }
  ensureAudio();
  if (input.wasPressed('Escape')) {
    game.state = 'paused';
    showScreen('pause-screen');
    document.getElementById('pause-stats').textContent =
      `Cash $${Math.floor(game.player.cash)}  •  Kills ${game.stats.kills || 0}  •  Wanted ${'★'.repeat(game.wanted)}`;
    input.postUpdate();
    return;
  }
  updatePlayer(dt);
  updateTraffic(game, dt);
  updatePeds(game, dt);
  updateEnemies(game, dt);
  game.police?.update(dt);
  game.missions?.update(dt);
  updateEffects(game.effects, dt);
  collideCars(game, dt);
  // camera follows player
  const p = game.player;
  game.cam.x += (p.x - game.cam.x) * Math.min(1, dt * 5);
  game.cam.y += (p.y - game.cam.y) * Math.min(1, dt * 5);
  game.zoneName = zoneAt(p.x, p.y);
  // mission marker: free-roam points at the pier until the bonus is paid
  if (game.missions?.currentId === 'free-roam' && !game.missions.pierPaid) {
    game.missionMarker = { x: PIER.x, y: PIER.y };
  } else if (game.missions?.currentId === 'free-roam') {
    game.missionMarker = null;
  }
  hud.update(game, dt);
  updateEngine(!!p.car, p.car ? Math.abs(p.car.speed || 0) / 560 : 0);
  updateSiren(game.wanted > 0);
  // death / busted transitions
  if (p.dead && game.state === 'playing') {
    game.state = 'wasted';
    game.sfx('wasted');
    showScreen('wasted-screen');
    stopAllLoops();
  } else if (game.busted && game.state === 'playing') {
    game.busted = false;
    game.state = 'busted';
    game.sfx('wasted');
    showScreen('busted-screen');
    stopAllLoops();
  }
  // draw
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawWorld(game, ctx, game.cam, canvas.width, canvas.height);
  input.postUpdate();
}

// boot
if (autostart) startNewGame();
else { showScreen('title-screen'); hud.showHud(false); }
requestAnimationFrame(loop);
