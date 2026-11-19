// Renderer 3D unico (motore m3d) e ciclo di gioco. Ogni "vista" fornisce root, camera e update().
import { Renderer, M4 } from './m3d.js';
import { STAGE_W, STAGE_H, onResize, stageScale } from './stage.js';

export const canvas = document.getElementById('gl');
export const renderer = new Renderer(canvas, { clear: '#faedea' });

function resize(s = stageScale()) {
  const pr = Math.max(0.6, Math.min((window.devicePixelRatio || 1) * s, 1.6));
  renderer.setSize(STAGE_W, STAGE_H, pr);
}
onResize(resize);

let view = null;
export function setView(v) { view?.leave?.(); view = v; v?.enter?.(); }
export function getView() { return view; }

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (view) {
    view.update?.(dt);
    if (view.root && view.camera) {
      renderer.clear = view.clear || renderer.clear;
      if (view.shadowBox) renderer.shadowBox = view.shadowBox;
      renderer.render(view.root, view.camera);
    }
  }
  requestAnimationFrame(frame);
}
export function start() { resize(); requestAnimationFrame(frame); }

// proietta un punto 3D sulle coordinate del palcoscenico (1920×1080)
export function toStage(p, camera) {
  const { vp } = camera.matrices(STAGE_W / STAGE_H);
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12], y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13], w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  return { x: (x / w + 1) / 2 * STAGE_W, y: (1 - y / w) / 2 * STAGE_H, behind: w < 0 };
}
