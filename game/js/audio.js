// audio.js — WebAudio-synthesised sound, no assets (fresh, SOLMAR)
let ctx = null;
let engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;

export function ensureAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* audio unavailable: stay silent */ }
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) { /* ignore */ }
}

function noise(dur, vol, freq) {
  if (!ctx) return;
  try {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain(); g.gain.value = vol || 0.1;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
  } catch (e) { /* ignore */ }
}

export const sfx = {
  shoot() { noise(0.09, 0.16, 2600); tone(190, 0.07, 'square', 0.06, 60); },
  crash() { noise(0.25, 0.2, 500); },
  blip() { tone(660, 0.07, 'sine', 0.07); },
  cash() { tone(880, 0.09, 'sine', 0.09); setTimeout(() => tone(1320, 0.12, 'sine', 0.09), 80); },
  horn() { tone(370, 0.18, 'sawtooth', 0.05, 340); },
  wasted() { tone(220, 0.5, 'sawtooth', 0.1, 55); },
  click() { tone(520, 0.05, 'sine', 0.06); },
  heal() { tone(520, 0.15, 'sine', 0.07, 780); },
  steal() { tone(300, 0.12, 'square', 0.06, 520); },
  siren() { /* handled by loop */ },
};

export function updateEngine(driving, speed01) {
  if (!ctx) return;
  try {
    if (driving && !engineOsc) {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain(); engineGain.gain.value = 0.02;
      engineOsc.connect(engineGain); engineGain.connect(ctx.destination);
      engineOsc.start();
    }
    if (engineOsc) {
      engineOsc.frequency.value = 60 + speed01 * 160;
      engineGain.gain.value = driving ? 0.02 + speed01 * 0.03 : 0.0;
    }
  } catch (e) { /* ignore */ }
}

export function updateSiren(active) {
  if (!ctx) return;
  try {
    if (active && !sirenOsc) {
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine';
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0.015;
      sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
      sirenOsc.start();
    }
    if (sirenOsc) {
      sirenOsc.frequency.value = active ? (Math.sin(performance.now() / 350) > 0 ? 950 : 700) : 700;
      sirenGain.gain.value = active ? 0.015 : 0.0;
    }
  } catch (e) { /* ignore */ }
}

export function stopAllLoops() {
  try { if (engineOsc) { engineOsc.stop(); engineOsc = null; } } catch (e) {}
  try { if (sirenOsc) { sirenOsc.stop(); sirenOsc = null; } } catch (e) {}
}
