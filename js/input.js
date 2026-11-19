// Comandi touch: cursore sinistro (movimento), cursore destro (telecamera), pulsante Interagisci.
// Su computer funzionano anche con il mouse e con WASD / frecce + Q/E (solo per i test).
import { stageScale } from './stage.js';

const ICON_MOVE = '<svg width="150" height="150" viewBox="0 0 100 100" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M50 8l-9 9M50 8l9 9M50 92l-9-9M50 92l9-9M8 50l9-9M8 50l9 9M92 50l-9-9M92 50l-9 9"/></svg>';
const ICON_CAM = '<svg width="150" height="150" viewBox="0 0 100 100" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M16 50a34 34 0 0 1 60-22M84 50a34 34 0 0 1-60 22"/><path d="M76 14v14H62M24 86V72h14" stroke-linejoin="round"/></svg>';
const ICON_HAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-5.5v-1a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v6m0-3.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.6-2.2L4.6 16a1.6 1.6 0 0 1 2.4-2.1L8 15"/></svg>';

export class Controls {
  constructor(root) {
    this.root = root;
    this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 };
    this.keys = new Set();
    this.onAct = null;
    root.innerHTML = `
      <div class="joy left"><div class="cap">Muoviti</div><div class="ico">${ICON_MOVE}</div><div class="knob"></div></div>
      <div class="joy right"><div class="cap">Telecamera</div><div class="ico">${ICON_CAM}</div><div class="knob"></div></div>
      <button class="act" aria-label="Interagisci">${ICON_HAND}<span>INTERAGISCI</span></button>`;
    this.stick(root.querySelector('.joy.left'), this.move);
    this.stick(root.querySelector('.joy.right'), this.look);
    this.actBtn = root.querySelector('.act');
    this.actBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.actBtn.classList.contains('on') && this.onAct) this.onAct(); });
    addEventListener('keydown', (e) => { this.keys.add(e.code); if ((e.code === 'Space' || e.code === 'Enter') && this.enabled && this.actBtn.classList.contains('on') && this.onAct) this.onAct(); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.enabled = false;
  }
  stick(el, out) {
    const knob = el.querySelector('.knob');
    const R = 110;
    let id = null, cx = 0, cy = 0;
    const set = (x, y) => {
      const s = stageScale();
      let dx = (x - cx) / s, dy = (y - cy) / s;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      out.x = dx / R; out.y = dy / R;
    };
    el.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId; el.setPointerCapture(id);
      const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      set(e.clientX, e.clientY); e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; out.x = out.y = 0; knob.style.transform = ''; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  }
  show(on) { this.enabled = on; this.root.classList.toggle('hidden', !on); if (!on) { this.move.x = this.move.y = this.look.x = this.look.y = 0; } }
  setAct(on) { this.actBtn.classList.toggle('on', !!on); }
  read() {
    const k = this.keys, m = { ...this.move }, l = { ...this.look };
    if (!this.enabled) return { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
    if (k.has('KeyW') || k.has('ArrowUp')) m.y = -1;
    if (k.has('KeyS') || k.has('ArrowDown')) m.y = 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) m.x = -1;
    if (k.has('KeyD') || k.has('ArrowRight')) m.x = 1;
    if (k.has('KeyQ')) l.x = -1;
    if (k.has('KeyE')) l.x = 1;
    return { move: m, look: l };
  }
}
