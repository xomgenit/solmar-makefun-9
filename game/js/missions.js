// missions.js — THE HOOK FOR BUILDER 2 (fresh, SOLMAR)
// Registry + state machine. Only `free-roam` exists now; B2 adds story defs
// to MISSION_DEFS and chains them via `next`. NEW GAME must start the first
// story mission instead of free-roam (one-line change in main.js startNewGame).
import { dist } from './util.js';
import { PIER } from './city.js';

export const MISSION_DEFS = {
  'free-roam': {
    id: 'free-roam', title: 'FREE ROAM', brief: 'Explore Solmar Bay. Visit the Pier for a bonus.',
    reward: 0, next: null,
    start(game, ms) { ms.state = {}; },
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
  const ms = {
    current: null, currentId: null, pierPaid: false,
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
    update(dt) {
      if (!ms.current) return;
      const r = ms.current.def.update?.(game, ms.current, dt);
      if (r === 'done') ms.completeCurrent();
      else if (r === 'failed') ms.failCurrent();
    },
    list() { return Object.values(MISSION_DEFS).map(d => ({ id: d.id, title: d.title, reward: d.reward })); },
    isComplete(id) { return !!(game.saveData?.missionsDone || []).includes(id); },
    serialize() {
      return { currentId: ms.currentId, pierPaid, done: game.saveData?.missionsDone || [] };
    },
    restore(data) {
      if (!data) return;
      pierPaid = !!data.pierPaid;
      ms.pierPaid = pierPaid;
      if (data.currentId && MISSION_DEFS[data.currentId]) ms.start(data.currentId);
      else ms.start('free-roam');
    },
  };
  // pierPaid accessor keeps the closure and the property in sync
  Object.defineProperty(ms, 'pierPaid', {
    get() { return pierPaid; },
    set(v) { pierPaid = !!v; },
  });
  return ms;
}
