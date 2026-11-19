// save.js — localStorage save (fresh, SOLMAR)
export const SAVE_KEY = 'solmar-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function saveGame(game) {
  try {
    const p = game.player;
    const data = {
      seed: game.city.seed,
      cash: Math.floor(p.cash),
      health: Math.ceil(p.health),
      x: Math.round(p.x), y: Math.round(p.y),
      car: p.car ? { model: p.car.model, x: Math.round(p.car.x), y: Math.round(p.car.y), angle: p.car.angle, health: p.car.health } : null,
      missions: game.missions?.serialize() || null,
      missionsDone: game.saveData?.missionsDone || [],
      stats: game.stats || {},
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return data;
  } catch (e) { return null; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
