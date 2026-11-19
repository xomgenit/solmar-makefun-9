// hud.js — DOM HUD + round minimap (fresh, SOLMAR)
import { WORLD, BLOCK } from './city.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  let bannerTimer = null;
  const hud = {
    showHud(on) {
      const el = $('hud');
      if (el) el.style.display = on ? 'block' : 'none';
    },
    banner(title, sub, color) {
      const b = $('banner'); if (!b) return;
      $('banner-title').textContent = title;
      $('banner-sub').textContent = sub || '';
      b.style.borderColor = color || '#fff';
      b.style.color = color || '#fff';
      b.classList.add('show');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => b.classList.remove('show'), 2600);
    },
    setHint(text) {
      const h = $('hint'); if (h) h.textContent = text || '';
    },
    setObjective(title, text) {
      const t = $('objective-title'), x = $('objective-text');
      if (t) t.textContent = title || '';
      if (x) x.textContent = text || '';
    },
    update(game, dt) {
      const p = game.player;
      const hf = $('health-fill'), ht = $('health-text');
      if (hf) hf.style.width = Math.max(0, p.health) + '%';
      if (ht) ht.textContent = Math.ceil(Math.max(0, p.health));
      const cash = $('cash'); if (cash) cash.textContent = '$' + Math.floor(p.cash);
      const stars = $('stars');
      if (stars) stars.textContent = '★'.repeat(game.wanted) + '☆'.repeat(5 - game.wanted);
      const zone = $('zone'); if (zone) zone.textContent = game.zoneName || '';
      const sp = $('speed'), sm = $('speedometer'), ch = $('car-health');
      if (p.car) {
        if (sm) sm.style.display = 'block';
        if (sp) sp.textContent = Math.round(Math.abs(p.car.speed || 0) * 0.42) + ' km/h';
        if (ch) ch.textContent = 'CAR ' + Math.ceil(p.car.health);
      } else if (sm) sm.style.display = 'none';
      hud.drawMinimap(game);
    },
    drawMinimap(game) {
      const cv = $('minimap');
      if (!cv) return;
      const ctx = cv.getContext('2d');
      const S = cv.width, scale = S / WORLD;
      ctx.clearRect(0, 0, S, S);
      // round mask
      ctx.save();
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#20301f'; ctx.fillRect(0, 0, S, S);
      // sea + beach
      ctx.fillStyle = '#2e6f8e'; ctx.fillRect(3100 * scale, 0, S, S);
      ctx.fillStyle = '#d9c08a'; ctx.fillRect(3100 * scale - 14 * scale * 10, 0, 340 * scale, S);
      // roads
      ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
      for (let g = 0; g <= 12; g++) {
        const p = g * BLOCK * scale;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
      }
      const dot = (x, y, color, r) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x * scale, y * scale, r || 3, 0, Math.PI * 2); ctx.fill();
      };
      // mission marker
      if (game.missionMarker) dot(game.missionMarker.x, game.missionMarker.y, '#f2c200', 4);
      for (const e of game.enemies) if (!e.dead) dot(e.x, e.y, e.type === 'cop' ? '#3498db' : '#e74c3c', 2.5);
      for (const c of game.cars) if (c.role === 'cruiser' && !c.dead) dot(c.x, c.y, '#3498db', 3);
      const p = game.player;
      dot(p.x, p.y, '#fff', 4);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.stroke();
    },
  };
  return hud;
}
