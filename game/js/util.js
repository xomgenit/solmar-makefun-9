// util.js — math + seeded RNG + collision helpers (fresh, SOLMAR)
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function angleLerp(a, b, t) { return a + angleDiff(a, b) * clamp(t, 0, 1); }
export function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}
// Push a circle out of a rect; returns true if a collision happened.
export function pushCircleOutOfRect(cx, cy, r, rx, ry, rw, rh, out) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    out.x = cx + (dx / d) * (r - d); out.y = cy + (dy / d) * (r - d);
  } else {
    // centre inside rect: push out along the smallest penetration axis
    const pl = cx - rx, pr = rx + rw - cx, pt = cy - ry, pb = ry + rh - cy;
    const m = Math.min(pl, pr, pt, pb);
    out.x = cx; out.y = cy;
    if (m === pl) out.x = rx - r; else if (m === pr) out.x = rx + rw + r;
    else if (m === pt) out.y = ry - r; else out.y = ry + rh + r;
  }
  return true;
}
// Does segment (x1,y1)-(x2,y2) hit any rect in `rects`? (line-of-sight test)
export function segmentHitsRects(x1, y1, x2, y2, rects) {
  for (const rc of rects) {
    const rx = rc.x, ry = rc.y, rw = rc.w, rh = rc.h;
    if (x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) return true;
    if (x2 >= rx && x2 <= rx + rw && y2 >= ry && y2 <= ry + rh) return true;
    const dx = x2 - x1, dy = y2 - y1;
    const edges = [
      [rx, ry, rx + rw, ry], [rx + rw, ry, rx + rw, ry + rh],
      [rx + rw, ry + rh, rx, ry + rh], [rx, ry + rh, rx, ry],
    ];
    for (const [ex1, ey1, ex2, ey2] of edges) {
      const den = dx * (ey2 - ey1) - dy * (ex2 - ex1);
      if (Math.abs(den) < 1e-9) continue;
      const t = ((ex1 - x1) * (ey2 - ey1) - (ey1 - y1) * (ex2 - ex1)) / den;
      const u = ((ex1 - x1) * dy - (ey1 - y1) * dx) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
    }
  }
  return false;
}
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
