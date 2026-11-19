// render.js — canvas world renderer (fresh, SOLMAR)
import { WORLD, BLOCK, ROAD_W, BEACH_X, SEA_X, PIER, isRoad } from './city.js';
import { drawCar } from './vehicles.js';
import { drawPed } from './people.js';
import { drawEnemy } from './combat.js';
import { drawEffects } from './effects.js';

function drawGround(ctx, cam, vw, vh) {
  const x0 = Math.max(0, cam.x - vw / 2 - 60), y0 = Math.max(0, cam.y - vh / 2 - 60);
  const x1 = Math.min(WORLD, cam.x + vw / 2 + 60), y1 = Math.min(WORLD, cam.y + vh / 2 + 60);
  // grass base
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // beach + sea
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(Math.max(x0, BEACH_X), y0, Math.min(x1, SEA_X) - Math.max(x0, BEACH_X), y1 - y0);
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(Math.max(x0, SEA_X), y0, x1 - Math.max(x0, SEA_X), y1 - y0);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
    ctx.fillRect(SEA_X + 6, y, 60, 3);
  }
  // roads
  ctx.fillStyle = '#3a3a3d';
  for (let g = 0; g <= 12; g++) {
    const c = g * BLOCK;
    if (c - ROAD_W / 2 < x1 && c + ROAD_W / 2 > x0) ctx.fillRect(c - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    if (c - ROAD_W / 2 < y1 && c + ROAD_W / 2 > y0) ctx.fillRect(x0, c - ROAD_W / 2, x1 - x0, ROAD_W);
  }
  // centre dashes
  ctx.fillStyle = '#e8c832';
  for (let g = 0; g <= 12; g++) {
    const c = g * BLOCK;
    for (let t = Math.floor(y0 / 60) * 60; t < y1; t += 60) {
      if (c > x0 && c < x1) ctx.fillRect(c - 2, t, 4, 26);
    }
    for (let t = Math.floor(x0 / 60) * 60; t < x1; t += 60) {
      if (c > y0 && c < y1) ctx.fillRect(t, c - 2, 26, 4);
    }
  }
  // crosswalks at intersections
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let gx = 0; gx <= 12; gx++) for (let gy = 0; gy <= 12; gy++) {
    const cx = gx * BLOCK, cy = gy * BLOCK;
    if (cx < x0 - 60 || cx > x1 + 60 || cy < y0 - 60 || cy > y1 + 60) continue;
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(cx + i * 16 - 4, cy - ROAD_W / 2 - 14, 8, 10);
      ctx.fillRect(cx + i * 16 - 4, cy + ROAD_W / 2 + 4, 8, 10);
    }
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.dead) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aimAngle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.fillStyle = '#f39c12';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(4, 0, 6, 0, Math.PI * 2); ctx.fill();
  // gun
  ctx.fillStyle = '#222';
  ctx.fillRect(6, -2, 14, 4);
  // facing tick
  ctx.fillStyle = '#fff';
  ctx.fillRect(10, -1, 4, 2);
  ctx.restore();
}

export function drawWorld(game, ctx, cam, vw, vh) {
  ctx.save();
  const shx = (Math.random() - 0.5) * (game.effects?.shake || 0);
  const shy = (Math.random() - 0.5) * (game.effects?.shake || 0);
  ctx.translate(Math.round(vw / 2 - cam.x + shx), Math.round(vh / 2 - cam.y + shy));
  drawGround(ctx, cam, vw, vh);
  const x0 = cam.x - vw / 2 - 80, y0 = cam.y - vh / 2 - 80, x1 = cam.x + vw / 2 + 80, y1 = cam.y + vh / 2 + 80;
  const inView = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
  // pier deck
  ctx.fillStyle = '#8a6b46';
  ctx.fillRect(PIER.deck.x, PIER.deck.y, PIER.deck.w, PIER.deck.h);
  ctx.fillStyle = '#a8845c';
  for (let x = PIER.deck.x + 8; x < PIER.deck.x + PIER.deck.w; x += 22) ctx.fillRect(x, PIER.deck.y, 3, PIER.deck.h);
  // buildings
  ctx.textAlign = 'center';
  for (const b of game.city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.roof) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h / 2 - 10, 28, 20);
    }
    if (b.landmark) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(game.city.landmarkById[b.landmark].name, b.x + b.w / 2, b.y - 8);
    }
  }
  // palms
  for (const pl of game.city.palms) {
    if (!inView(pl.x, pl.y)) continue;
    ctx.save(); ctx.translate(pl.x, pl.y); ctx.scale(pl.s, pl.s);
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3, -14); ctx.stroke();
    ctx.fillStyle = '#2e8b57';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * 8, -14 + Math.sin(a) * 5, 9, 3.5, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // zone labels
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('DOWNTOWN', 600, 150);
  ctx.fillText('EAST HARBOUR', 2850, 150);
  ctx.fillText('PALMA BEACH', 3270, 900);
  // mission beacon
  if (game.missionMarker) {
    const bob = Math.sin(performance.now() / 300) * 6;
    ctx.strokeStyle = '#f2c200'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(game.missionMarker.x, game.missionMarker.y + bob, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f2c200';
    ctx.beginPath(); ctx.moveTo(game.missionMarker.x, game.missionMarker.y + bob - 26);
    ctx.lineTo(game.missionMarker.x - 8, game.missionMarker.y + bob - 12);
    ctx.lineTo(game.missionMarker.x + 8, game.missionMarker.y + bob - 12);
    ctx.closePath(); ctx.fill();
  }
  // skids / effects under cars
  for (const car of game.cars) if (inView(car.x, car.y)) drawCar(ctx, car);
  for (const ped of game.peds) if (inView(ped.x, ped.y)) drawPed(ctx, ped);
  for (const e of game.enemies) if (inView(e.x, e.y)) drawEnemy(ctx, e);
  drawPlayer(ctx, game);
  if (game.effects) drawEffects(game.effects, ctx);
  ctx.restore();
}
