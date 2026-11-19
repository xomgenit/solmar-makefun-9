// city.js — seeded procedural city of Solmar Bay (fresh, SOLMAR)
import { makeRng, clamp, circleRect, pushCircleOutOfRect, shuffle } from './util.js';

export const WORLD = 3600;
export const BLOCK = 300;
export const ROAD_W = 96;
export const PIER = { x: 3420, y: 1800, deck: { x: 3300, y: 1770, w: 260, h: 60 } };
export const BEACH_X = 3100;   // sand starts here
export const SEA_X = 3440;     // water starts here (except pier deck)

export const LANDMARKS = {
  hideout: 'Dice Hideout', diner: 'Sunset Diner', garage: 'Vera\'s Garage',
  bank: 'Solmar National Bank', docks: 'East Docks', pier: 'Solmar Pier',
  spa: 'Sunset Auto Spa', hospital: 'Solmar General', hq: 'SBPD Headquarters',
};

const ROOF_COLORS = ['#b08968', '#8d99ae', '#6d6875', '#a98467', '#7f8c8d', '#977a5e', '#5d6d7e', '#a67c52'];

// road centre lines are at multiples of BLOCK (300, 600, ... 3300)
export function isRoad(x, y) {
  const mx = ((x % BLOCK) + BLOCK) % BLOCK, my = ((y % BLOCK) + BLOCK) % BLOCK;
  return Math.min(mx, BLOCK - mx) < ROAD_W / 2 || Math.min(my, BLOCK - my) < ROAD_W / 2;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const zones = [];
  // landmark placement: shuffle interior block centres (multiples of 300),
  // docks forced to an eastern block, pier fixed on the beach.
  const centres = [];
  for (let bx = 300; bx <= 2700; bx += BLOCK)
    for (let by = 300; by <= 3300; by += BLOCK) centres.push({ x: bx, y: by });
  const picked = shuffle(rng, centres);
  const docksIdx = picked.findIndex(c => c.x >= 2400);
  const docksC = picked.splice(docksIdx, 1)[0];
  const ids = ['hideout', 'diner', 'garage', 'bank', 'spa', 'hospital', 'hq'];
  const landmarkById = {};
  ids.forEach((id, i) => {
    const c = picked[i];
    landmarkById[id] = { id, cx: c.x, cy: c.y, name: LANDMARKS[id] };
  });
  landmarkById.docks = { id: 'docks', cx: docksC.x, cy: docksC.y, name: LANDMARKS.docks };
  landmarkById.pier = { id: 'pier', cx: PIER.x, cy: PIER.y, name: LANDMARKS.pier };
  // buildings: one per block, skipping landmark blocks (landmarks get their own)
  const lmCells = new Set(Object.values(landmarkById).map(l => `${Math.round(l.cx / BLOCK)},${Math.round(l.cy / BLOCK)}`));
  for (let gx = 0; gx < 12; gx++) {
    for (let gy = 0; gy < 12; gy++) {
      const cx = gx * BLOCK + BLOCK / 2, cy = gy * BLOCK + BLOCK / 2;
      if (cx >= BEACH_X) continue; // beach / sea: no buildings
      if (lmCells.has(`${gx},${gy}`)) continue;
      if (rng() < 0.18) continue; // empty lot / parking
      const w = 90 + rng() * 110, h = 90 + rng() * 110;
      buildings.push({
        x: cx - w / 2, y: cy - h / 2, w, h,
        color: ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)],
        roof: rng() < 0.5,
      });
    }
  }
  // landmark buildings (bigger, distinct)
  for (const l of Object.values(landmarkById)) {
    if (l.id === 'pier') continue;
    const w = l.id === 'bank' || l.id === 'hq' || l.id === 'hospital' ? 190 : 150;
    const h = 130;
    buildings.push({ x: l.cx - w / 2, y: l.cy - h / 2, w, h, color: '#7a5c3e', roof: true, landmark: l.id });
  }
  // palms: along beach + scattered on sidewalks
  for (let i = 0; i < 90; i++) {
    const x = BEACH_X + rng() * 280;
    const y = 60 + rng() * (WORLD - 120);
    palms.push({ x, y, s: 0.8 + rng() * 0.5 });
  }
  for (let i = 0; i < 60; i++) {
    const gx = Math.floor(rng() * 11) * BLOCK + 60 + rng() * 180;
    const gy = Math.floor(rng() * 11) * BLOCK + 60 + rng() * 180;
    if (!isRoad(gx, gy)) palms.push({ x: gx, y: gy, s: 0.7 + rng() * 0.4 });
  }
  const city = { seed, buildings, palms, landmarkById, zones };
  return city;
}

export function zoneAt(x, y) {
  if (x >= BEACH_X) return 'PALMA BEACH';
  if (x >= 2400) return y < 1500 ? 'EAST HARBOUR' : 'SOUTH DOCKS';
  if (x < 1200 && y < 1200) return 'DOWNTOWN';
  if (x < 1200) return 'OLD TOWN';
  if (y < 1200) return 'NORTHSIDE';
  if (y >= 2400) return 'SOUTHSIDE';
  return 'MIDTOWN';
}

// Resolve circle vs buildings / sea / world bounds. Returns corrected {x,y}.
export function collideCircle(city, x, y, r) {
  const out = { x, y };
  const tmp = { x: 0, y: 0 };
  for (const b of city.buildings) {
    if (pushCircleOutOfRect(out.x, out.y, r, b.x, b.y, b.w, b.h, tmp)) { out.x = tmp.x; out.y = tmp.y; }
  }
  // sea: blocked unless on the pier deck
  const onPier = out.x > PIER.deck.x - r && out.x < PIER.deck.x + PIER.deck.w + r &&
    out.y > PIER.deck.y - r && out.y < PIER.deck.y + PIER.deck.h + r;
  if (out.x + r > SEA_X && !onPier) out.x = SEA_X - r;
  out.x = clamp(out.x, r, WORLD - r);
  out.y = clamp(out.y, r, WORLD - r);
  return out;
}

export function nearestRoadPoint(city, x, y) {
  const rx = Math.round(x / BLOCK) * BLOCK;
  const ry = Math.round(y / BLOCK) * BLOCK;
  if (Math.abs(x - rx) < Math.abs(y - ry)) return { x: rx, y };
  return { x, y: ry };
}

export function rectsOf(city) { return city.buildings; }
export function pointInBuilding(city, x, y) {
  return city.buildings.some(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}
