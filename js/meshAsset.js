// Carica i modelli 3D di riferimento (convertiti dagli OBJ in un formato binario compatto)
import { Geometry } from './m3d.js';
const cache = new Map();
export function loadMesh(url) {
  if (!cache.has(url)) cache.set(url, fetch(url.replace(/\.bin$/, '.json')).then(r => r.json()).then(([b64]) => {   // binario in base64 (formato servibile)
    const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return parseMesh(u.buffer);
  }));
  return cache.get(url);
}
export function parseMesh(buf) {
  const h = new Int32Array(buf, 0, 3), nv = h[0], nf = h[1], fl = h[2];
  let o = 12;
  const pos = new Float32Array(buf, o, nv * 3); o += nv * 12;
  const nrm = new Float32Array(buf, o, nv * 3); o += nv * 12;
  let uv = null; if (fl & 1) { uv = new Float32Array(buf, o, nv * 2); o += nv * 8; }
  let joints = null, weights = null;
  if (fl & 2) { joints = new Float32Array(new Uint8Array(buf, o, nv * 4)); o += nv * 4; weights = new Float32Array(buf.slice(o, o + nv * 16)); o += nv * 16; }
  const idx = new Uint32Array(buf.slice(o, o + nf * 12));
  return { pos, nrm, uv, idx, nv, nf, joints, weights };
}
export function toGeometry(m) { const g = new Geometry(m.pos, m.nrm, m.uv, m.idx); if (m.joints) { g.joints = m.joints; g.weights = m.weights; } return g; }
export function loadImage(url) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
}
