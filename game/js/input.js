// input.js — keyboard / mouse with edge detection (fresh, SOLMAR)
export function createInput(canvas) {
  const keys = {};
  const pressed = {};
  const mouse = { x: 0, y: 0, down: false, clicked: false, wx: 0, wy: 0 };
  const onKeyDown = (e) => {
    if (e.code === 'Tab') e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e) => { keys[e.code] = false; };
  const onMouseMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  };
  const onMouseDown = (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  };
  const onMouseUp = (e) => { if (e.button === 0) mouse.down = false; };
  const onBlur = () => { for (const k in keys) keys[k] = false; mouse.down = false; };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  return {
    mouse,
    down(code) { return !!keys[code]; },
    wasPressed(code) { return !!pressed[code]; },
    anyPressed() { return Object.keys(pressed).length > 0; },
    postUpdate() {
      for (const k in pressed) delete pressed[k];
      mouse.clicked = false;
    },
  };
}
