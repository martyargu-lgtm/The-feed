// Richieste al worker delle geometrie, con cache. Se i worker non sono disponibili calcola direttamente.
import { Geometry } from './m3d.js';
import { makeGeo, GARMENTS } from './body.js';

const cache = new Map(), pending = new Map();
let worker = null, seq = 0;
try { worker = new Worker(new URL('./geoWorker.js', import.meta.url), { type: 'module' }); } catch (e) { worker = null; }
if (worker) {
  worker.onmessage = (e) => {
    const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id);
    if (e.data.error) { p.reject(new Error(e.data.error)); return; }
    p.resolve(e.data.out.map(o => { const g = new Geometry([], [], null, []); Object.assign(g, o); return g; }));
  };
  worker.onerror = () => { worker = null; };
}
export function getGeo(kind, base, item = '') {
  const key = kind + base + item;
  if (cache.has(key)) return cache.get(key);
  let pr;
  if (worker) pr = new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); worker.postMessage({ id, kind, base, item }); })
    .catch(() => makeGeo(kind, base, item));
  else pr = new Promise((r) => setTimeout(() => r(makeGeo(kind, base, item)), 0));
  cache.set(key, pr);
  return pr;
}
// prepara in anticipo tutto il guardaroba di un personaggio (in ordine di utilità)
export function prewarm(base) {
  getGeo('body', base); getGeo('hands', base);
  for (const id of ['tank', 'briefs']) getGeo('garment', base, id);
  for (const s of ['sho1', 'sock', 'sho2', 'sole2', 'sho3']) getGeo('shoe', base, s);
  for (const id of Object.keys(GARMENTS)) getGeo('garment', base, id);
}
