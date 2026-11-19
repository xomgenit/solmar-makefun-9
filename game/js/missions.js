// missions.js — Vera's job chain + hidden stashes + gold sports-car unlock (fresh, SOLMAR)
// Built by B2 retry 9 from the retry 8 / retry 7 B2 handoffs + B1 retry 9 contract.
// All mission targets read landmark coords from city.landmarkById at runtime.
// Stash spots + sports-car spot verified 0px collideCircle push in THIS city (seed 7).
import { dist } from './util.js';
import { PIER } from './city.js';
import { spawnEnemy } from './combat.js';
import { createCar } from './vehicles.js';

// Hidden cash stashes, $300 each — all on road centrelines, 0px push, seed 7.
export const STASHES = [
  { x: 1050, y: 1500, zone: 'OLD TOWN' },
  { x: 2250, y: 900, zone: 'NORTHSIDE' },
  { x: 2850, y: 2100, zone: 'SOUTH DOCKS' },
];
const STASH_REWARD = 300;
const GOLD = '#f1c40f';
// King spawn spots on the pier deck (x 3300-3560, y 1770-1830), all 0px push.
const KING_W1 = [[3380, 1800], [3480, 1800]];
const KING_W2 = [[3350, 1800], [3520, 1800]];

function lm(game, id) { return game.city.landmarkById[id]; }
function clearKings(game) { game.enemies = game.enemies.filter(e => e.type !== 'king'); }
function liveKings(game) { return game.enemies.filter(e => e.type === 'king' && !e.dead); }
function spawnKings(game, spots) {
  for (const [x, y] of spots) spawnEnemy(game, x, y, 'king');
}
function ensureSportsCar(game, ms) {
  if (!ms.data.sportsUnlocked) return;
  if (game.cars.some(c => c.model === 'sports' && c.color === GOLD && !c.dead)) return;
  const g = lm(game, 'garage');
  const car = createCar(g.cx, g.cy + 150, Math.PI / 2, 'sports', 'parked');
  car.color = GOLD;
  car.handbrake = true;
  game.cars.push(car);
}
function setMarker(game, x, y) { game.missionMarker = { x, y }; }

export const MISSION_DEFS = {
  'first-wheels': {
    id: 'first-wheels', title: 'FIRST WHEELS', brief: 'Steal a car, then drive it to Vera\'s Garage.',
    reward: 250, next: 'the-pickup',
    start(game, ms) {
      ms.state = { gotCar: false };
      const g = lm(game, 'garage');
      setMarker(game, g.cx, g.cy);
      game.hud?.setObjective('FIRST WHEELS', 'Steal a car (E) — then drive it to Vera\'s Garage');
    },
    update(game, ms, dt) {
      const s = ms.state, g = lm(game, 'garage'), p = game.player;
      if (!s.gotCar && p.car) {
        s.gotCar = true;
        game.hud?.setObjective('FIRST WHEELS', 'Drive to Vera\'s Garage');
      }
      if (s.gotCar && p.car && dist(p.x, p.y, g.cx, g.cy) < 200) return 'done';
      return undefined;
    },
  },
  'the-pickup': {
    id: 'the-pickup', title: 'THE PICKUP', brief: 'Collect the package at East Harbour Docks, deliver to Sunset Diner.',
    reward: 400, next: 'hot-delivery',
    start(game, ms) {
      ms.state = { picked: false };
      const d = lm(game, 'docks');
      setMarker(game, d.cx, d.cy);
      game.hud?.setObjective('THE PICKUP', 'Collect the package at East Harbour Docks');
    },
    update(game, ms, dt) {
      const s = ms.state, p = game.player;
      const d = lm(game, 'docks'), din = lm(game, 'diner');
      if (!s.picked && dist(p.x, p.y, d.cx, d.cy) < 120) {
        s.picked = true;
        setMarker(game, din.cx, din.cy);
        game.hud?.setObjective('THE PICKUP', 'Deliver the package to Sunset Diner');
      }
      if (s.picked && dist(p.x, p.y, din.cx, din.cy) < 200) return 'done';
      return undefined;
    },
  },
  'hot-delivery': {
    id: 'hot-delivery', title: 'HOT DELIVERY', brief: 'Timed 90s: deliver to East Harbour Docks.',
    reward: 600, next: 'payback-pier',
    start(game, ms) {
      ms.state = { t: 90 };
      const d = lm(game, 'docks');
      setMarker(game, d.cx, d.cy);
      game.hud?.setObjective('HOT DELIVERY', '90s — Deliver to East Harbour Docks');
    },
    update(game, ms, dt) {
      const s = ms.state, p = game.player;
      const d = lm(game, 'docks');
      s.t -= dt;
      game.hud?.setObjective('HOT DELIVERY', `${Math.max(0, Math.ceil(s.t))}s — Deliver to East Harbour Docks`);
      if (dist(p.x, p.y, d.cx, d.cy) < 200) {
        // Gold sports car unlocks when this delivery lands.
        game.missions.data.sportsUnlocked = true;
        ensureSportsCar(game, game.missions);
        return 'done';
      }
      if (s.t <= 0) return 'failed'; // timeout: failCurrent restarts in place, pays $0
      return undefined;
    },
  },
  'payback-pier': {
    id: 'payback-pier', title: 'PAYBACK AT THE PIER', brief: 'Eliminate 4 Harbor Kings on the pier deck.',
    reward: 800, next: 'solmar-score',
    start(game, ms) {
      ms.state = { wave: 1, kills: 0, waveKills: 0 };
      clearKings(game); // pause-menu restart must never duplicate kings
      spawnKings(game, KING_W1);
      ensureSportsCar(game, game.missions);
      const pier = lm(game, 'pier');
      setMarker(game, pier.cx, pier.cy);
      game.hud?.setObjective('PAYBACK AT THE PIER', 'Take out the Harbor Kings (0/4)');
    },
    onEnemyDown(game, ms, enemy) {
      if (enemy.type !== 'king') return;
      const s = ms.state;
      s.kills += 1; s.waveKills += 1;
      game.hud?.setObjective('PAYBACK AT THE PIER', `Take out the Harbor Kings (${s.kills}/4)`);
      // Wave-2 detection MUST read state.wave === 2 (retry 7 lesson): one burst
      // can kill a wave-1 king and a fresh wave-2 king, so live-king counts lie.
      if (s.wave === 1 && s.waveKills >= 2) {
        s.wave = 2; s.waveKills = 0;
        spawnKings(game, KING_W2);
        game.hud?.banner('REINFORCEMENTS', 'More Kings on the pier', '#e74c3c');
      }
    },
    update(game, ms, dt) {
      const s = ms.state;
      if (s.kills >= 4) return 'done';
      // Anti-stall: if the player was wasted/busted mid-mission and the wave
      // is gone, respawn the current wave's remainder — the mission can never strand.
      if (liveKings(game).length === 0 && s.kills < 4) {
        const spots = s.wave === 1 ? KING_W1 : KING_W2;
        const need = 2 - s.waveKills;
        spawnKings(game, spots.slice(s.waveKills, s.waveKills + need));
      }
      return undefined;
    },
  },
  'solmar-score': {
    id: 'solmar-score', title: 'THE SOLMAR SCORE', brief: 'Crack the vault at Solmar National Bank, then lose the heat.',
    reward: 1500, next: null,
    start(game, ms) {
      ms.state = { phase: 'channel', channel: 0 };
      // Normalize heat first (retry 7 lesson): stray M4 ped-heat must not stack
      // on top of the alarm's +2.
      game.police?.clearWanted();
      clearKings(game);
      ensureSportsCar(game, game.missions);
      const b = lm(game, 'bank');
      setMarker(game, b.cx, b.cy);
      game.hud?.setObjective('THE SOLMAR SCORE', 'Crack the vault — stay at the bank');
    },
    update(game, ms, dt) {
      const s = ms.state, p = game.player;
      const b = lm(game, 'bank');
      if (s.phase === 'channel') {
        if (dist(p.x, p.y, b.cx, b.cy) < 200) {
          s.channel += dt;
          const pct = Math.min(100, Math.floor((s.channel / 5) * 100));
          game.hud?.setObjective('THE SOLMAR SCORE', `Cracking the vault ${pct}% — hold position`);
          if (s.channel >= 5) {
            s.phase = 'escape';
            game.police?.addWanted(2); // alarm: fresh heat 3s, first response spawns
            game.missionMarker = null;
            game.hud?.banner('ALARM TRIPPED', 'Lose the heat — 2 stars', '#e74c3c');
            game.hud?.setObjective('THE SOLMAR SCORE', 'Lose the heat!');
          }
        } else {
          s.channel = 0; // stepping away resets the channel
          game.hud?.setObjective('THE SOLMAR SCORE', 'Cracking the vault 0% — stay at the bank');
        }
        return undefined;
      }
      // Escape phase: done once the heat is fully gone.
      if (game.wanted === 0) return 'done';
      return undefined;
    },
  },
  'free-roam': {
    id: 'free-roam', title: 'FREE ROAM', brief: 'Explore Solmar Bay. Visit the Pier for a bonus.',
    reward: 0, next: null,
    start(game, ms) {
      ms.state = {};
      ensureSportsCar(game, game.missions);
    },
    update(game, ms, dt) {
      // Pier bonus: +$50 ONCE. pierPaid lives in the missions closure,
      // NOT in per-start state (retry 7 bug: it must survive restarts).
      // Accessed via game.missions so the def (module-level) can reach it.
      if (!game.missions.pierPaid && dist(game.player.x, game.player.y, PIER.x, PIER.y) < 130) {
        game.missions.pierPaid = true;
        game.player.cash += 50;
        game.hud?.banner('PIER BONUS', '+$50', '#f2c200');
        game.sfx?.('cash');
        game.effects?.floater(game.player.x, game.player.y - 24, '+$50', '#f2c200');
        game.saveNow?.();
      }
      return undefined;
    },
  },
};

export function createMissions(game) {
  let pierPaid = false; // closure state (see free-roam above)
  const data = { stashesTaken: [], sportsUnlocked: false };
  const ms = {
    current: null, currentId: null, pierPaid: false, data,
    start(id) {
      const def = MISSION_DEFS[id];
      if (!def) return false;
      ms.current = { def, state: {} };
      ms.currentId = id;
      def.start?.(game, ms.current);
      game.hud?.setObjective(def.title, def.brief);
      return true;
    },
    completeCurrent() {
      if (!ms.current) return;
      const def = ms.current.def;
      // Clear state FIRST, then pay/banner/autosave/chain (pay-once).
      ms.current = null; ms.currentId = null;
      // Record the completion (B1 never wrote missionsDone; the save's
      // `done` list stayed empty — pay-once across reload needs this).
      const done = game.saveData?.missionsDone || [];
      if (!done.includes(def.id)) done.push(def.id);
      game.saveData.missionsDone = done;
      if (def.reward > 0) {
        game.player.cash += def.reward;
        game.hud?.banner('MISSION COMPLETE', `${def.title}  +$${def.reward}`, '#2ecc71');
        game.sfx?.('cash');
      }
      game.saveNow?.();
      if (def.next) ms.start(def.next);
      else ms.start('free-roam');
    },
    failCurrent(reason) {
      if (!ms.current) return;
      const def = ms.current.def;
      ms.current = null; ms.currentId = null;
      game.hud?.banner('MISSION FAILED', reason || def.title, '#e74c3c');
      game.saveNow?.();
      ms.start(def.id); // retry the same mission
    },
    restartCurrent() {
      if (!ms.current) return;
      const id = ms.current.def.id;
      ms.current = null; ms.currentId = null;
      ms.start(id);
    },
    setObjective(text, marker) {
      game.hud?.setObjective(text, marker);
    },
    onEnemyDown(enemy) {
      ms.current?.def.onEnemyDown?.(game, ms.current, enemy);
    },
    stashes() {
      return STASHES.map((s, i) => ({ x: s.x, y: s.y, zone: s.zone, taken: data.stashesTaken.includes(i) }));
    },
    reset() {
      data.stashesTaken = [];
      data.sportsUnlocked = false;
      pierPaid = false;
      ms.pierPaid = false;
      ms.current = null;
      ms.currentId = null;
    },
    update(dt) {
      // Hidden stashes: live in every mission + free roam, pay exactly once.
      const p = game.player;
      if (p && !p.dead) {
        for (let i = 0; i < STASHES.length; i++) {
          if (data.stashesTaken.includes(i)) continue;
          const s = STASHES[i];
          if (dist(p.x, p.y, s.x, s.y) < 40) {
            data.stashesTaken.push(i);
            p.cash += STASH_REWARD;
            game.hud?.banner('HIDDEN CASH', `+$${STASH_REWARD} — ${s.zone}`, '#2ecc71');
            game.sfx?.('cash');
            game.effects?.floater(p.x, p.y - 24, `+$${STASH_REWARD}`, '#2ecc71');
            game.saveNow?.();
          }
        }
      }
      if (!ms.current) return;
      const r = ms.current.def.update?.(game, ms.current, dt);
      if (r === 'done') ms.completeCurrent();
      else if (r === 'failed') ms.failCurrent();
    },
    list() { return Object.values(MISSION_DEFS).map(d => ({ id: d.id, title: d.title, reward: d.reward })); },
    isComplete(id) { return !!(game.saveData?.missionsDone || []).includes(id); },
    serialize() {
      return {
        currentId: ms.currentId, pierPaid,
        done: game.saveData?.missionsDone || [],
        data: { stashesTaken: [...data.stashesTaken], sportsUnlocked: data.sportsUnlocked },
      };
    },
    restore(saved) {
      if (!saved) return;
      pierPaid = !!saved.pierPaid;
      ms.pierPaid = pierPaid;
      if (saved.data) {
        data.stashesTaken = [...(saved.data.stashesTaken || [])];
        data.sportsUnlocked = !!saved.data.sportsUnlocked;
      }
      if (saved.currentId && MISSION_DEFS[saved.currentId]) ms.start(saved.currentId);
      else ms.start('free-roam');
      ensureSportsCar(game, ms);
    },
  };
  // pierPaid accessor keeps the closure and the property in sync
  Object.defineProperty(ms, 'pierPaid', {
    get() { return pierPaid; },
    set(v) { pierPaid = !!v; },
  });
  return ms;
}
