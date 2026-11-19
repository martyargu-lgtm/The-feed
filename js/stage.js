// Palcoscenico 16:9 (1920×1080 logici) adattato a qualsiasi schermo, con bande se servono.
export const STAGE_W = 1920, STAGE_H = 1080;
let scale = 1;
export function stageScale() { return scale; }
const listeners = [];
export function onResize(fn) { listeners.push(fn); }

export function fitStage() {
  const stage = document.getElementById('stage');
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = Math.min(vw / STAGE_W, vh / STAGE_H);
  const ox = (vw - STAGE_W * scale) / 2, oy = (vh - STAGE_H * scale) / 2;
  stage.style.transform = `translate(${ox}px,${oy}px) scale(${scale})`;
  listeners.forEach(fn => fn(scale));
}
addEventListener('resize', fitStage);
addEventListener('orientationchange', () => setTimeout(fitStage, 300));

// Transizione "fade to white": lo schermo diventa bianco, si cambia scena, poi si rischiara.
export function fadeToWhite(middle) {
  const f = document.getElementById('fade');
  return new Promise((res) => {
    f.classList.add('on');
    setTimeout(async () => {
      await middle?.();
      setTimeout(() => { f.classList.remove('on'); setTimeout(res, 700); }, 180);
    }, 750);
  });
}

export const wait = (ms) => new Promise(r => setTimeout(r, ms));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export async function goFullscreen() {
  try {
    const d = document.documentElement;
    if (!document.fullscreenElement && d.requestFullscreen) await d.requestFullscreen({ navigationUI: 'hide' });
    if (screen.orientation?.lock) await screen.orientation.lock('landscape').catch(() => {});
  } catch (e) { /* non supportato: si gioca comunque */ }
}

export const CHEVRON_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
export const CHEVRON_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
