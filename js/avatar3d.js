// Personaggi 3D del gioco. Corpo ricavato dalla sagoma fornita (Livello_12), volto come nel render di riferimento:
// testa scolpita (naso, labbra, mento, guance) con occhi, ciglia e sopracciglia disegnati.
import { Node, mesh, mat, sphere, sphereCap, lathe, rings, tube, torus, rbox, cylinder, disc, hexLin, Geometry, M4 } from './m3d.js';
import { RIG, joints } from './body.js';
import { getGeo } from './geoclient.js';
import { loadMesh, loadImage } from './meshAsset.js';
import { MJ, MPROFILE, MHEAD, MEYE, MALE_EYES } from './meshyRig.js';

// ---------- personaggi dai modelli di riferimento (OBJ Meshy convertiti) ----------
const MODELS = 'assets/models/';
const geoCache = new Map();
function meshyGeo(file, prep) {   // una Geometry per file, condivisa tra gli avatar
  if (!geoCache.has(file)) geoCache.set(file, loadMesh(MODELS + file).then(m => {
    const g = new Geometry(m.pos, m.nrm, prep ? prep(m) : m.uv, m.idx);
    if (m.joints) { g.joints = m.joints; g.weights = m.weights; }
    return g;
  }));
  return geoCache.get(file);
}
let giuliaTex = null;
// acconciature (tutte valide per entrambe le basi), dai busti di riferimento
const HAIR_FILE = { hf1: 'hair3_curls', hf2: 'hair3_bob', hf3: 'hair3_bun', hf4: 'hair3_bunneat', hf5: 'hair3_braids', hf6: 'hair3_straight',
  hm1: 'hair3_mstraight', hm2: 'hair3_mstraight_short', hm3: 'hair3_mcurly', hm4: 'hair3_mcurly_short', hm5: 'hair3_mstraight_buzz', hm6: 'hair3_mcurly_buzz' };
let hairRamp = null;   // rampa di luminosità: radici e solchi scuri, punte chiare (u della mesh)
function hairMat(hex) {
  if (!hairRamp) { hairRamp = document.createElement('canvas'); hairRamp.width = 256; hairRamp.height = 4; const g = hairRamp.getContext('2d');
    for (let i = 0; i < 256; i++) { const v = Math.round(255 * Math.pow(i / 255, 1 / 2.2)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i, 0, 1, 4); } }
  return mat(mixHex(hex, '#ffffff', 0.08), { map: hairRamp, rough: 0.45, spec: 0.3, shin: 40, double: true });
}
// UV del viso del manichino: proiezione frontale della testa su una texture di trucco (labbra, guance)
const FACE_UV = { x0: -0.16, x1: 0.16, y0: 1.33, y1: 1.65 };
function faceUV(m) {
  const uv = new Float32Array(m.nv * 2);
  for (let i = 0; i < m.nv; i++) {
    const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2];
    if (y > FACE_UV.y0 && z > -0.02) { uv[i * 2] = (x - FACE_UV.x0) / (FACE_UV.x1 - FACE_UV.x0); uv[i * 2 + 1] = (y - FACE_UV.y0) / (FACE_UV.y1 - FACE_UV.y0); }
    else { uv[i * 2] = 0.01; uv[i * 2 + 1] = 0.01; }
  }
  return uv;
}
function drawMeshyFace(cv, { skin, lips, blush, brow, browW = 1 }) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d');
  const X = (x) => (x - FACE_UV.x0) / (FACE_UV.x1 - FACE_UV.x0) * W, Yp = (y) => (1 - (y - FACE_UV.y0) / (FACE_UV.y1 - FACE_UV.y0)) * H, S = W / (FACE_UV.x1 - FACE_UV.x0);
  g.fillStyle = skin; g.fillRect(0, 0, W, H);
  const blob = (x, y, rx, ry, col, a) => { const gr = g.createRadialGradient(X(x), Yp(y), 0, X(x), Yp(y), rx * S); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.globalAlpha = a; g.translate(X(x), Yp(y)); g.scale(1, ry / rx); g.translate(-X(x), -Yp(y)); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); };
  for (const sx of [-1, 1]) blob(sx * 0.068, 1.425, 0.03, 0.018, '#f08a8a', 0.35 * blush);
  // labbra: forma a cuore morbida
  g.save(); g.fillStyle = lips; g.globalAlpha = 0.85; g.filter = `blur(${Math.round(W / 300)}px)`;
  g.beginPath(); g.ellipse(X(0), Yp(1.389), 0.024 * S, 0.0055 * S, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(X(0), Yp(1.381), 0.02 * S, 0.0065 * S, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  g.save(); g.strokeStyle = brow; g.globalAlpha = 0.55; g.lineCap = 'round'; g.lineWidth = 0.004 * S * browW; g.filter = `blur(${Math.round(W / 400)}px)`;
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(X(sx * 0.03), Yp(1.507)); g.quadraticCurveTo(X(sx * 0.065), Yp(1.522), X(sx * 0.098), Yp(1.506)); g.stroke(); }
  g.restore();
}


// ---------- opzioni dell'editor ----------
export const SKIN = ['#dc9889', '#f6b8a7', '#f7cec9', '#f7decd', '#f4d3a7', '#f3c38d', '#e1a469', '#be8342', '#ca9a7b', '#a6765a', '#87634a', '#654735'];
export const EYES = ['#8ac2db', '#5d9cb2', '#3a7382', '#28595b', '#316d61', '#3c7f5d', '#449e6b', '#84aa80', '#a97830', '#876032', '#44301a', '#29200f'];
export const HAIR_COLORS = ['#fbcd88', '#b58050', '#905c14', '#593a15', '#341e15', '#d3672a',
  '#f2a7ba', '#1c1b1b', '#f4f1ec', '#c8b2e4', '#a8c9e6', '#b8322f'];
export const HAIR_STYLES = ['hf1', 'hf2', 'hf3', 'hf4', 'hf5', 'hf6', 'hm1', 'hm2', 'hm3', 'hm4', 'hm5', 'hm6'];
export const LOOK = {
  top: ['top1', 'top2', 'top3'], bottom: ['bot1', 'bot2', 'bot3'], dress: ['dre1', 'dre2', 'dre3'],
  shoes: ['sho1', 'sho2', 'sho3'], bag: ['bag1', 'bag2', 'bag3'], glasses: ['gla1', 'gla2', 'gla3'],
};
export function defaultConfig(base) {
  return { base, skin: 1, skinShade: 0.5, eyes: 9, eyesShade: 0.5, hairStyle: null, hairColor: 4,
    top: null, bottom: null, dress: null, shoes: null, bag: null, glasses: null };
}
export function lookComplete(c) { return !!((c.dress || (c.top && c.bottom)) && c.shoes); }

function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
export function mixHex(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
export function skinColor(c) {
  if (c.skinHex) return c.skinHex;
  const base = SKIN[c.skin], t = c.skinShade;
  return t < 0.5 ? mixHex(base, '#5a3426', (0.5 - t) * 0.55) : mixHex(base, '#ffffff', (t - 0.5) * 0.7);
}
export function skinGradient(i) { return [mixHex(SKIN[i], '#5a3426', 0.27), SKIN[i], mixHex(SKIN[i], '#ffffff', 0.35)]; }
export function eyeColor(c) {
  if (c.eyeHex) return c.eyeHex;
  const base = EYES[c.eyes], t = c.eyesShade;
  return t < 0.5 ? mixHex(base, '#ffffff', (0.5 - t) * 0.6) : mixHex(base, '#000000', (t - 0.5) * 1.6);
}
export function eyeGradient(i) { return [mixHex(EYES[i], '#ffffff', 0.3), EYES[i], '#000000']; }
const hairColorOf = (c) => c.hairHex || HAIR_COLORS[c.hairColor] || HAIR_COLORS[4];

const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const G = (x, s) => Math.exp(-(x * x) / (s * s));

// ======================================================================
// CORPO (misure in metri, dalla sagoma: altezza 1,65 m, testa ≈ 1/7,6)
// ======================================================================
const BODY = {
  F: {
    torso: [ // y, mezza larghezza, profondità davanti/dietro
      [0.79, 0.118, 0.07, 0.08], [0.82, 0.142, 0.08, 0.098], [0.86, 0.149, 0.085, 0.106], [0.93, 0.138, 0.08, 0.098],
      [1.0, 0.115, 0.072, 0.08], [1.06, 0.092, 0.066, 0.066], [1.1, 0.087, 0.066, 0.064], [1.15, 0.096, 0.08, 0.066],
      [1.2, 0.11, 0.098, 0.072], [1.24, 0.116, 0.104, 0.076], [1.28, 0.118, 0.092, 0.078], [1.32, 0.122, 0.074, 0.074],
      [1.345, 0.128, 0.064, 0.068], [1.365, 0.118, 0.058, 0.062], [1.383, 0.088, 0.05, 0.054], [1.398, 0.05, 0.038, 0.042], [1.41, 0.036, 0.032, 0.035]],
    hipX: 0.074, hipY: 0.84, shoulderX: 0.124, shoulderY: 1.315, armAng: 0.2,
    head: { y: 1.585, a: 0.104, b: 0.138, c: 0.12 }, neck: [0.034, 1.37, 1.5],
    arm: [[0, 0.043], [0.03, 0.038], [0.1, 0.034], [0.2, 0.031], [0.26, 0.028], [0.33, 0.029], [0.42, 0.024], [0.465, 0.019]],
    leg: [[0, 0.07], [0.05, 0.072], [0.15, 0.064], [0.26, 0.053], [0.36, 0.043], [0.41, 0.043], [0.49, 0.047], [0.58, 0.038], [0.68, 0.028], [0.75, 0.023]],
    knee: 0.37, elbow: 0.26,
  },
  M: {
    torso: [
      [0.8, 0.12, 0.075, 0.08], [0.83, 0.138, 0.085, 0.095], [0.87, 0.14, 0.088, 0.098], [0.94, 0.132, 0.084, 0.09],
      [1.0, 0.124, 0.08, 0.082], [1.06, 0.12, 0.08, 0.078], [1.12, 0.124, 0.084, 0.08], [1.18, 0.134, 0.09, 0.084],
      [1.24, 0.146, 0.094, 0.088], [1.29, 0.155, 0.09, 0.088], [1.33, 0.158, 0.08, 0.084], [1.36, 0.155, 0.07, 0.076],
      [1.385, 0.13, 0.062, 0.066], [1.405, 0.085, 0.05, 0.054], [1.42, 0.05, 0.042, 0.046]],
    hipX: 0.078, hipY: 0.86, shoulderX: 0.152, shoulderY: 1.345, armAng: 0.16,
    head: { y: 1.615, a: 0.11, b: 0.142, c: 0.124 }, neck: [0.04, 1.39, 1.52],
    arm: [[0, 0.05], [0.03, 0.045], [0.1, 0.041], [0.2, 0.037], [0.27, 0.033], [0.34, 0.035], [0.43, 0.029], [0.48, 0.023]],
    leg: [[0, 0.075], [0.05, 0.077], [0.15, 0.069], [0.26, 0.058], [0.37, 0.047], [0.42, 0.047], [0.5, 0.052], [0.6, 0.042], [0.7, 0.032], [0.77, 0.027]],
    knee: 0.38, elbow: 0.27,
  },
};
// tubo lungo l'asse -y con profilo [distanza, raggio]
function limb(profile, from, to, segs = 28, zs = 1, { capTop = true, capBot = true } = {}) {
  const r0 = interp(profile, from), r1 = interp(profile, to);
  const mid = profile.filter(([d]) => d > from + 1e-4 && d < to - 1e-4).map(([d, r]) => [r, -d]);
  const bot = capBot ? [[0, -to - r1 * 0.5], [r1 * 0.72, -to - r1 * 0.36], [r1, -to]] : [[r1, -to]];
  const top = capTop ? [[r0, -from], [r0 * 0.72, -from + r0 * 0.36], [0, -from + r0 * 0.5]] : [[r0, -from]];
  return lathe([...bot, ...mid.reverse(), ...top], segs, { zs });
}
function interp(prof, d) {
  for (let i = 0; i < prof.length - 1; i++) if (d >= prof[i][0] && d <= prof[i + 1][0]) { const t = (d - prof[i][0]) / (prof[i + 1][0] - prof[i][0]); return prof[i][1] + (prof[i + 1][1] - prof[i][1]) * t; }
  return d < prof[0][0] ? prof[0][1] : prof[prof.length - 1][1];
}
function torsoAt(T, y) {
  for (let i = 0; i < T.length - 1; i++) if (y >= T[i][0] && y <= T[i + 1][0]) { const t = (y - T[i][0]) / (T[i + 1][0] - T[i][0]); return T[i].map((v, k) => v + (T[i + 1][k] - v) * t); }
  return y < T[0][0] ? T[0] : T[T.length - 1];
}
// busto (o guscio di vestito sopra il busto) tra y0 e y1, gonfiato di pad
function torsoGeo(T, y0, y1, pad = 0, { flare = null, capTop = true, capBot = true, steps = 26 } = {}) {
  const list = [];
  for (let i = 0; i <= steps; i++) {
    const y = y0 + (y1 - y0) * i / steps, [, w, f, b] = torsoAt(T, y);
    const fl = flare ? flare(y) : 0;
    list.push({ y, rx: w + pad + fl, rzF: f + pad + fl * 0.8, rzB: b + pad + fl * 0.8 });
  }
  return rings(list, 48, { capTop, capBot });
}

// gonna/abito svasato: sezioni lisce dalla vita all'orlo
function skirtGeo(T, yTop, yHem, hemR, pad = 0.01, curve = 1.2) {
  // il profilo segue il corpo vero (RIG) e copre i glutei, poi si apre verso l'orlo
  const body = (y) => {
    let [, w, f, b] = torsoAt(T, y);
    const gy = (y - 0.86) / 0.095;
    if (Math.abs(gy) < 1) { const q = Math.sqrt(1 - gy * gy); b = Math.max(b, 0.045 + 0.07 * q + 0.004); w = Math.max(w, 0.052 + 0.076 * q); }
    const ty = (0.84 - y) / 0.3;                                         // cosce
    if (ty > 0) w = Math.max(w, 0.079 + 0.064 - 0.02 * Math.min(1, ty));
    return [y, w, f, b];
  };
  const [, w0, f0, b0] = body(yTop), list = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, y = yTop + (yHem - yTop) * t, k = Math.pow(t, curve);
    const [, w, f, b] = body(y);
    const rx = Math.max(w + pad, w0 + pad + (hemR - w0) * k);
    list.push({ y, rx, rzF: Math.max(f + pad, (f0 + pad) + (hemR * 0.82 - f0) * k), rzB: Math.max(b + pad, (b0 + pad) + (hemR * 0.88 - b0) * k) });
  }
  list.reverse();
  return rings(list, 56, { capTop: false, capBot: false });
}

// ======================================================================
// TESTA
// ======================================================================
export const EYE = { x: 0.36, y: 0.02 };
function faceRelief(x, y, z) {
  if (z <= 0.2) return 0;
  let d = 0;
  const ax = Math.sqrt(x * x + 0.0009); // |x| morbido: niente pieghe sulla linea centrale
  // naso piccolo all'insù (stile cartone 3D)
  const t = Math.max(0, Math.min(1.2, (0.02 - y) / 0.32));
  let amp = 0.03 * (y > 0.02 ? G(y - 0.02, 0.1) : 1) + 0.11 * Math.pow(Math.min(1, t), 1.6);   // dorso del naso più definito
  if (y < -0.3) amp *= G(y + 0.3, 0.05);
  d += amp * G(x, 0.045 + 0.05 * Math.min(1, t));
  d += 0.032 * G(ax - 0.07, 0.035) * G(y + 0.3, 0.04);   // ali del naso
  // labbra
  d += 0.04 * G(x, 0.2) * G(y + 0.52, 0.12);            // arcata dentale: la bocca sporge in avanti
  d += 0.05 * G(x, 0.13) * G(y + 0.495, 0.03);           // labbro superiore
  d += 0.012 * G(x, 0.035) * G(y + 0.4, 0.07);           // filtro
  d += 0.055 * G(x, 0.115) * G(y + 0.59, 0.038);          // labbro inferiore, carnoso
  d -= 0.012 * G(x, 0.12) * G(y + 0.54, 0.011);
  d -= 0.012 * G(ax - 0.15, 0.03) * G(y + 0.52, 0.04); // angoli della bocca
  // mento, guance piene, orbite per gli occhi
  d -= 0.012 * G(x, 0.15) * G(y + 0.7, 0.05);   // solco sotto il labbro, leggero
  d += 0.04 * G(x, 0.19) * G(y + 0.88, 0.11);   // mento: sporge appena, largo e morbido
  d += 0.03 * G(ax - 0.5, 0.12) * G(y + 0.1, 0.1);   // zigomi
  d -= 0.015 * G(ax - 0.3, 0.1) * G(y + 0.68, 0.08);  // incavo sotto il labbro ai lati
  d += 0.01 * G(ax - 0.42, 0.18) * G(y + 0.25, 0.18);
  d -= 0.018 * G(ax - 0.62, 0.12) * G(y + 0.42, 0.15);   // guance più asciutte sotto gli zigomi
  d -= 0.06 * sm(0.3, 0.8, ax) * sm(-0.05, -0.55, y);   // piani laterali del viso: la mascella non è una sfera
  d -= 0.07 * G(ax - EYE.x, 0.16) * G(y - EYE.y, 0.12);
  d += 0.02 * G(ax - EYE.x, 0.22) * G(y - EYE.y - 0.2, 0.06); // arcata sopracciliare
  return d * sm(0.2, 0.5, z);
}
// larghezza del viso dall'alto in basso: zigomi → angolo della mandibola → mento (interpolazione morbida)
const JAW = [[0, 1], [-0.15, 0.985], [-0.4, 0.9], [-0.62, 0.79], [-0.82, 0.62], [-0.95, 0.47], [-1.06, 0.3]];
const taperX = (y) => {
  if (y >= 0) return 1 - 0.05 * y * y;
  for (let i = 1; i < JAW.length; i++) if (y >= JAW[i][0]) { const [y0, w0] = JAW[i - 1], [y1, w1] = JAW[i], t = (y - y0) / (y1 - y0), s = t * t * (3 - 2 * t); return w0 + (w1 - w0) * (0.5 * t + 0.5 * s); }
  return JAW[JAW.length - 1][1];
};
// parte bassa della testa: mento più lungo; sotto la mandibola la testa sale (stessa deformazione per testa e capelli)
const warpY = (y, z) => (y < 0 ? y * 1.04 * (1 - 0.4 * sm(0.42, 0.04, z) * sm(-0.3, 0.0, z)) : y);
const taperZ = (y) => (y < 0 ? 1 - 0.06 * -y : 1);
let HEAD_GEO = null;
function headGeo() {
  if (HEAD_GEO) return HEAD_GEO;
  HEAD_GEO = sphere(150, 110, (p, d) => {
    const rel = faceRelief(d[0], d[1], d[2]);
    let y = warpY(d[1], d[2]);
    // mandibola: sotto il mento la testa non è una palla; il bordo della mascella sale dal mento verso l'angolo sotto l'orecchio
    // bordo inferiore: alto sotto l'orecchio, basso al mento; dietro torna giù per chiudere la nuca
    // (scala la parte bassa invece di tagliarla: nessuna piega nella mesh)
    return [d[0] * taperX(d[1]), y, d[2] * taperZ(d[1]) + rel];   // viso ovale, mento più lungo
  }, Math.PI); // il centro del viso cade a metà texture
  return HEAD_GEO;
}
// texture del volto: coordinate del viso (fx a destra, fy in alto, sfera unitaria) → pixel
function proj(W, H, fx, fy) {
  const th = Math.acos(Math.max(-1, Math.min(1, fy)));
  const s = Math.max(0.05, Math.sin(th));
  const a = Math.asin(Math.max(-1, Math.min(1, fx / s)));
  return [(0.5 + a / (Math.PI * 2)) * W, th / Math.PI * H];
}
function drawFace(cv, { skin, brow = '#5a3a28', female, blush = 0.5, lips = '#e38a8f', smile = 1 }) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, PX = W / (Math.PI * 2);
  ctx.fillStyle = skin; ctx.fillRect(0, 0, W, H);
  const P = (x, y) => proj(W, H, x, y);
  const path = (pts, close) => { ctx.beginPath(); pts.forEach(([x, y], i) => { const [u, v] = P(x, y); i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); if (close) ctx.closePath(); };
  const quad = (a, c, b, n = 28) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, m = 1 - t; o.push([m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]]); } return o; };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // guance rosate
  for (const sx of [-1, 1]) {
    const [u, v] = P(sx * 0.47, -0.27), r = 0.17 * PX;
    const g = ctx.createRadialGradient(u, v, 0, u, v, r);
    g.addColorStop(0, `rgba(236,128,132,${0.12 + 0.3 * blush})`); g.addColorStop(1, 'rgba(236,128,132,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(u, v, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  // ombra morbida sotto le orbite e piega della palpebra
  for (const sx of [-1, 1]) {
    const [u, v] = P(sx * EYE.x, EYE.y + 0.02), r = 0.2 * PX;
    const g = ctx.createRadialGradient(u, v, 0, u, v, r);
    g.addColorStop(0, 'rgba(150,80,70,0.10)'); g.addColorStop(1, 'rgba(150,80,70,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(u, v, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
  }
  // sopracciglia morbide e piene (a goccia)
  for (const sx of [-1, 1]) {
    const cx = sx * EYE.x, by = EYE.y + 0.29;
    const top = quad([cx - sx * 0.17, by - 0.01], [cx + sx * 0.0, by + 0.08], [cx + sx * 0.2, by - 0.01]);
    const bot = quad([cx + sx * 0.2, by - 0.01], [cx + sx * 0.0, by + 0.03], [cx - sx * 0.17, by - 0.045]);
    path(top.concat(bot), true); ctx.fillStyle = brow; ctx.globalAlpha = female ? 0.9 : 1; ctx.fill(); ctx.globalAlpha = 1;
  }
  // labbra con sorriso
  const my = -0.53, cw = 0.15, up = 0.035 * smile;
  const topL = quad([-cw, my + up], [-0.07, my + 0.07], [0, my + 0.03]).concat(quad([0, my + 0.03], [0.07, my + 0.07], [cw, my + up]));
  const botL = quad([cw, my + up], [0, my - 0.11], [-cw, my + up]);
  path(topL.concat(botL), true); ctx.fillStyle = female ? lips : mixHex(skin, '#c0646b', 0.35); ctx.fill();
  ctx.strokeStyle = female ? '#9c4450' : '#8a4a4a'; ctx.lineWidth = 0.008 * PX;
  path(quad([-cw - 0.01, my + up + 0.004], [0, my - 0.03], [cw + 0.01, my + up + 0.004])); ctx.stroke();
  if (female) { // riflesso sul labbro inferiore
    const [u, v] = P(0.02, my - 0.065); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(u, v, 0.035 * PX, 0.012 * PX, 0, 0, Math.PI * 2); ctx.fill();
  }
  cv._ver = (cv._ver || 0) + 1;
}
// texture del bulbo oculare: iride sfumata, anello scuro, pupilla
function drawEyeball(cv, iris) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.fillStyle = '#fbf7f4'; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, R = W * 0.11;
  const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
  g.addColorStop(0, mixHex(iris, '#ffffff', 0.35)); g.addColorStop(0.55, iris); g.addColorStop(0.9, mixHex(iris, '#000000', 0.35)); g.addColorStop(1, mixHex(iris, '#000000', 0.6));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, R, R, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45); ctx.lineTo(cx + Math.cos(a) * R * 0.85, cy + Math.sin(a) * R * 0.85); ctx.stroke(); }
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.42, R * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  cv._ver = (cv._ver || 0) + 1;
}

// ======================================================================
// CAPELLI (spazio unitario della testa: raggio 1, +z davanti)
// ======================================================================
function helmet(o = {}) {
  const { front = 0.56, temple = 0.16, side = 0.08, back = -0.6, backStart = 1.95, part = true, vol = 0.07, sideDrop = 0, fringeY = null, thick = 0.07, bump = null } = o;
  return sphere(110, 80, (p, d) => {
    const [x, y, z] = d;
    const phi = Math.abs(Math.atan2(x, z));
    let lim;
    if (fringeY !== null && phi < 1.0) lim = fringeY + (temple - fringeY) * sm(0.6, 1.0, phi);
    else if (phi < 0.9) lim = front - (front - temple) * Math.pow(phi / 0.9, 2);
    else if (phi < backStart) lim = temple + (side - temple) * sm(0.9, backStart, phi) - sideDrop * sm(1.1, 1.6, phi);
    else lim = side + (back - side) * sm(backStart, backStart + 0.5, phi);
    const cov = sm(lim - 0.05, lim + 0.07, y);
    let r = 0.62 + (0.35 + thick + vol * Math.max(0, y)) * cov;   // dove non ci sono capelli il guscio resta ben dentro la testa (anche col viso piatto del modello)
    if (bump) r += bump(x, y, z) * cov;
    r += 0.008 * Math.sin(Math.atan2(x, z) * 38 + y * 4) * cov * sm(-0.2, 0.4, y); // ciocche
    if (part && z > 0 && y > 0.25) r -= 0.03 * G(x, 0.04) * cov * sm(0.25, 0.55, y);
    return [x * r * taperX(y), warpY(y, z) * r, z * r * taperZ(y)];
  });
}
// tenda di capelli lunghi (spazio unitario della testa): aperta davanti sul viso, ricade sulle spalle e sul petto
function curtain({ yTop = 0.25, yBot = -3.0, gap = 0.62 }) {
  const NU = 120, NV = 70, pos = [], idx = [];
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const u = i / NU, v = j / NV;
    const phi = gap + u * (Math.PI * 2 - 2 * gap);          // 0 = davanti
    const sp = Math.sin(phi), cp = Math.cos(phi);
    const hem = yBot + 0.08 * Math.sin(phi * 7) + 0.05 * Math.sin(phi * 17 + 1) + 0.25 * Math.max(0, cp);   // punte ondulate, più corte davanti
    const y = yTop + (hem - yTop) * v;
    const yc = Math.max(y, -0.7), onHead = Math.sqrt(Math.max(0, 1 - yc * yc)) * taperX(yc);
    let r = onHead * (0.99 + 0.1 * sm(0.55, -0.1, y)) + 0.12 * sm(-0.3, -0.7, y);
    const below = sm(-0.4, -1.2, y);
    const drape = 0.98 + 0.12 * (1 - v) + 0.38 * sm(-1.1, -1.7, y) * Math.abs(sp) + 0.06 * Math.sin(v * 7 + phi * 3);
    r = r * (1 - below) + drape * below;
    r += 0.022 * Math.sin(phi * 22 + v * 3) * sm(0.15, 0.4, v);                 // solchi delle ciocche
    let x = sp * r, z = cp * r;
    const front = Math.max(0, cp) * sm(-1.0, -1.8, y);                          // davanti: sul petto
    z += front * 0.55; x *= 1 - 0.15 * front;
    z *= taperZ(Math.max(y, -0.7));
    pos.push(x, y, z);
  }
  const W = NU + 1;
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  return new Geometry(pos, Geometry.computeNormals(pos, idx), null, idx);
}
function buildHair(style, color) {
  const Mdbl = mat(color, { rough: 0.45, spec: 0.22, shin: 36, double: true });
  const M = mat(color, { rough: 0.45, spec: 0.22, shin: 36 }), D = mat(mixHex(color, '#2a1810', 0.18), { rough: 0.45, spec: 0.2, shin: 36 });
  const g = new Node();
  const add = (geo, m = M) => { const n = mesh(geo, m); g.add(n); return n; };
  const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1, m = M) => add(sphere(22, 16), m).at(x, y, z).sc(r * sx, r * sy, r * sz);
  const braid = (sx) => { // treccia che nasce dalla testa dietro l'orecchio e scende sul davanti delle spalle
    const P = (t) => [sx * (0.72 + 0.2 * Math.sin(Math.min(1, t * 2.2) * 1.4)), 0.05 - 3.0 * t, -0.42 + 0.78 * Math.min(1, t * 1.6)];
    add(tube([[sx * 0.62, 0.35, -0.5], [sx * 0.74, 0.1, -0.45], P(0.04)], (t) => 0.3 - 0.06 * t, 12));   // attacco: la ciocca raccolta esce dai capelli
    const n = 9;
    for (let k = 0; k < n; k++) {
      const t = 0.03 + k / n * 0.86, p = P(t), r = 0.25 - k * 0.012;
      const b = ball(r, p[0], p[1], p[2], 1, 1.3, 0.95, k % 2 ? D : M);
      b.rotation = [0, 0, sx * (k % 2 ? 0.45 : -0.45)];
    }
    const e = P(0.95);
    add(torus(0.1, 0.04, 20, 8), mat('#1d1d1b')).at(e[0], e[1] + 0.06, e[2]);
    ball(0.13, e[0], e[1] - 0.12, e[2], 1, 1.6, 1);
  };
  switch (style) {
    case 'hf5': add(helmet({ front: 0.56, temple: 0.2, side: 0.12, back: -0.55, backStart: 2.0 })); braid(-1); braid(1); break;
    case 'hf4': add(helmet({ front: 0.58, temple: 0.2, side: 0.05, back: -0.6 })); ball(0.36, 0, 1.13, -0.08, 1, 0.95, 1); break;
    case 'hf3':
      add(helmet({ front: 0.56, temple: 0.2, side: 0.0, back: -0.6 }));
      ball(0.29, 0, 1.2, -0.08); ball(0.25, 0.34, 1.06, -0.08); ball(0.26, -0.34, 1.06, -0.08);
      add(tube([[0.08, 1.45, -0.05], [0.14, 1.65, 0.0], [0.06, 1.78, 0.06]], 0.025, 8));
      add(tube([[-0.32, 1.28, -0.06], [-0.56, 1.36, -0.03], [-0.72, 1.3, 0.02]], 0.025, 8));
      add(tube([[0.42, 1.25, -0.05], [0.64, 1.31, -0.02], [0.8, 1.43, 0.0]], 0.025, 8));
      for (const sx of [-1, 1]) add(tube([[sx * 0.5, 0.58, 0.68], [sx * 0.86, 0.22, 0.55], [sx * 0.86, -0.4, 0.52], [sx * 0.9, -1.05, 0.44]], (t) => 0.06 * (1 - 0.5 * t), 10));
      break;
    case 'hf1': { // ricci su tutta la capigliatura, distribuiti in modo uniforme e su due strati
      add(helmet({ front: 0.62, temple: 0.25, side: -0.4, back: -0.75, part: false, vol: 0.15, thick: 0.12 }));
      const N = 260;
      for (let i = 0; i < N; i++) {
        const yy = 1 - (i + 0.5) / N * 1.85, rr = Math.sqrt(Math.max(0, 1 - yy * yy)), ph = i * 2.39996;
        const p = [rr * Math.sin(ph), yy, rr * Math.cos(ph)];
        if (p[2] > 0.25 && p[1] < 0.6 - 0.25 * Math.max(0, p[2] - 0.6) && Math.abs(p[0]) < 0.8) continue;   // libera il viso
        if (p[1] < -0.85 + 0.3 * Math.max(0, p[2])) continue;
        const layer = 1.12 + 0.06 * ((i * 7) % 3), r = 0.19 + 0.05 * ((i * 13) % 5) / 4;
        ball(r, p[0] * layer, p[1] * 1.1 - (p[1] < 0 ? 0.04 : 0), p[2] * layer, 1, 1, 1, i % 4 === 0 ? D : M);
      }
      break;
    }
    case 'hf2': // caschetto con frangia dritta
      add(helmet({ front: 0.36, temple: 0.15, side: -0.75, back: -0.8, backStart: 1.3, fringeY: 0.36, part: false, vol: 0.05, thick: 0.09 }));
      for (const sx of [-1, 1]) ball(0.5, sx * 0.84, -0.42, -0.08, 0.44, 0.86, 0.86);
      break;
    case 'hf6': // lunghi e morbidi: una "tenda" di capelli continua che ricade sulle spalle
      add(helmet({ front: 0.58, temple: 0.12, side: -0.3, back: -0.9, backStart: 1.5, vol: 0.08 }));
      add(curtain({ yTop: 0.7, yBot: -3.0, gap: 0.62 }), Mdbl);
      break;
    case 'hm1': case 'hm2': { // pieni e spettinati, frangia a ciocche sulla fronte
      const big = style === 'hm2';
      add(helmet({ front: 0.5, temple: 0.3, side: 0.12, back: -0.45, part: false, fringeY: 0.5, vol: big ? 0.2 : 0.16, thick: 0.1 }));
      const n = big ? 8 : 7;
      for (let i = 0; i < n; i++) { // ciocche della frangia, verso il basso e in avanti
        const x = -0.55 + i * (1.1 / (n - 1)), lean = (i % 2 ? 0.05 : -0.05) + (big ? 0.12 : 0);
        add(tube([[x * 0.92, 0.86, 0.5], [x + lean * 0.5, 0.7, 0.86], [x + lean, 0.46, 0.98]], (t) => 0.13 * (1 - t * 0.8), 10));
      }
      for (let i = 0; i < 6; i++) { // volume spettinato in cima
        const a = -0.8 + i * 0.32;
        ball(0.34, Math.sin(a) * 0.55, 0.96 - Math.abs(a) * 0.12, Math.cos(a) * 0.25 - 0.1, 1.2, 0.55, 1.1).rotation = [0.35, 0, -a * 0.6];
      }
      if (big) { add(tube([[0.25, 1.0, 0.45], [0.42, 1.18, 0.6], [0.62, 1.22, 0.62]], (t) => 0.12 * (1 - t * 0.8), 10)); add(tube([[-0.1, 1.05, 0.3], [-0.12, 1.25, 0.42], [-0.02, 1.36, 0.5]], (t) => 0.1 * (1 - t * 0.8), 10)); }
      break;
    }
    case 'hm3': { // ricci corti fitti su tutta la testa
      add(helmet({ front: 0.58, temple: 0.32, side: 0.12, back: -0.45, part: false, thick: 0.08 }));
      const N = 200;
      for (let i = 0; i < N; i++) {
        const yy = 1 - (i + 0.5) / N * 1.5, rr = Math.sqrt(Math.max(0, 1 - yy * yy)), ph = i * 2.39996;
        const p = [rr * Math.sin(ph), yy, rr * Math.cos(ph)];
        if (p[2] > 0.3 && p[1] < 0.55) continue;                                  // fronte e viso
        if (p[1] < 0.15 && p[2] > -0.35) continue;                                // orecchie e tempie
        if (p[1] < -0.35) continue;                                               // nuca corta
        ball(0.15 + 0.03 * ((i * 7) % 3) / 2, p[0] * 1.1, p[1] * 1.1, p[2] * 1.1, 1, 1, 1, i % 4 === 0 ? D : M);
      }
      break;
    }
    case 'hm4': // ciuffo laterale: volume spostato da un lato
      add(helmet({ front: 0.55, temple: 0.3, side: 0.12, back: -0.45, part: false, vol: 0.14, thick: 0.09, bump: (x, y, z) => 0.08 * Math.max(0, y) * (0.5 + 0.5 * Math.tanh(x * 3)) }));
      add(tube([[-0.75, 0.62, 0.5], [-0.35, 1.0, 0.62], [0.2, 1.12, 0.6], [0.7, 0.98, 0.48], [0.95, 0.7, 0.3]], (t) => 0.26 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)) + 0.03, 16, 60));
      break;
    case 'hm5': // pieni con frangia a punte
      add(helmet({ front: 0.45, temple: 0.28, side: 0.12, back: -0.45, part: false, fringeY: 0.45, vol: 0.18, thick: 0.1 }));
      for (let i = 0; i < 11; i++) { const x = -0.6 + i * 0.12; add(tube([[x, 0.62, 0.78], [x * 1.02, 0.45, 0.92]], (t) => 0.07 * (1 - t), 8)); }
      break;
    case 'hm6': // man bun
      add(helmet({ front: 0.58, temple: 0.22, side: 0.0, back: -0.55, part: false, thick: 0.08 }));
      ball(0.34, 0, 1.12, -0.25, 1.15, 0.9, 1);
      break;
  }
  return g;
}

// ======================================================================
// VESTITI E ACCESSORI
// ======================================================================
const CLOTH = {
  top1: '#435c3c', top2: '#a33a36', top3: '#f5ede5', bot1: '#c48c72', bot2: '#4f7ea6', bot3: '#252525',
  dre1: '#e0b3e6', dre2: '#4f4a7a', dre3: '#bfd38f', base: '#efe3dc', gtop: '#cfe6ee', gshorts: '#dcd9d8',
};
const POSES = { // [spalla x, spalla z, gomito x, gomito z] per braccio destro (r) e sinistro (l)
  idle: { r: [0, 0, -0.08, 0], l: [0, 0, -0.08, 0] },
  wave: { r: [-0.25, -0.55, -0.35, -2.15], l: [0, 0, -0.1, 0] },
  hands: { r: [-0.55, 0.3, -1.55, 0.3], l: [-0.55, -0.3, -1.55, -0.3] },
  hip: { r: [0, 0, -0.1, 0], l: [0.15, 0.78, -0.25, -1.95] },
};

export class Avatar3D {
  constructor(cfg, { faceRes = 2048 } = {}) {
    this.root = new Node(); this.cfg = { ...cfg };
    this.walk = 0; this.phase = 0; this.t = Math.random() * 10; this.pose = null; this.expr = {};
    this.poseNow = JSON.parse(JSON.stringify(POSES.idle));
    this.faceCv = document.createElement('canvas'); this.faceCv.width = faceRes; this.faceCv.height = faceRes / 2;
    this.build();
  }
  set(cfg) { this.cfg = { ...cfg }; this.build(); }
  setPose(p) { this.pose = p; }
  setExpression(e) { this.expr = { ...this.expr, ...e }; }
  paint() {
    const c = this.cfg, hc = c.hairStyle ? hairColorOf(c) : '#6b4a35';
    drawFace(this.faceCv, { skin: skinColor(c), brow: mixHex(hc, '#3a2418', 0.45), female: c.base !== 'M', blush: c.blush ?? 0.45 });
    if (!this.eyeCv) { this.eyeCv = document.createElement('canvas'); this.eyeCv.width = 512; this.eyeCv.height = 256; }
    drawEyeball(this.eyeCv, eyeColor(c));
  }
  // occhi 3D: bulbo con iride, riflesso, palpebre che sbattono, linea delle ciglia
  buildEyes(head, B, F, skin) {
    const { a, b, c } = B.head, r = F ? 0.036 : 0.034;
    const eyeMat = mat('#ffffff', { map: this.eyeCv, rough: 0.3, spec: 0.55, shin: 90 });
    const lidMat = mat(skinColor(this.cfg), { rough: 0.7, sss: 1, double: true });
    const ink = mat('#2a1d18', { rough: 0.6 });
    this.lids = [];
    for (const sx of [-1, 1]) {
      const zs = Math.sqrt(1 - EYE.x ** 2 - EYE.y ** 2);
      const e = new Node().at(sx * EYE.x * a, EYE.y * b, zs * c - r * 1.02); head.add(e);
      e.rotation = [0, sx * 0.05, 0];
      e.add(mesh(sphere(32, 24, null, Math.PI), eyeMat).sc(r));
      e.add(mesh(sphere(10, 8), mat('#ffffff', { unlit: true }), false).at(r * 0.26, r * 0.22, r * 0.95).sc(r * 0.11));
      const mk = (upper) => {
        const n = new Node(); e.add(n);
        const th = upper ? 0.95 : 0.62;
        const cap = mesh(sphereCap(th, 40, 14), lidMat); cap.scale = [r * 1.07, r * 1.07, r * 1.07]; n.add(cap);
        const rim = []; for (let i = 0; i <= 16; i++) { const ph = -1.35 + 2.7 * i / 16; rim.push([Math.sin(th) * Math.sin(ph) * r * 1.08, Math.cos(th) * r * 1.08, Math.sin(th) * Math.cos(ph) * r * 1.08]); }
        n.add(mesh(tube(rim, upper ? r * (F ? 0.075 : 0.055) : r * 0.03, 8, 40), ink, false));
        if (upper && F) for (let k = 0; k < 5; k++) { // ciglia verso l'esterno
          const ph = (sx > 0 ? 0.25 : -1.25) + k * 0.25, p0 = rim[Math.round((ph + 1.35) / 2.7 * 16)];
          const out = [p0[0] * 1.1 + sx * r * 0.08 * (k / 4), p0[1] + r * 0.28, p0[2] * 1.12];
          n.add(mesh(tube([p0, [(p0[0] + out[0]) / 2, p0[1] + r * 0.2, p0[2] * 1.12], out], (t) => r * 0.03 * (1 - t), 6, 8), ink, false));
        }
        return n;
      };
      const up = mk(true), lo = mk(false);
      lo.rotation = [Math.PI - 0.32, 0, 0];
      this.lids.push({ up, lo, sx });
    }
    this.blinkT = 2 + Math.random() * 3; this.blink = 0;
  }
  build() {
    if (this.cfg.base !== 'M') return this.buildMeshy();
    this.headAttach = null;
    const c = this.cfg, F = c.base !== 'M', key = F ? 'F' : 'M', B = BODY[key], R = RIG[key], J = joints(R);
    this.root.clear();
    const skinHex = skinColor(c), skin = mat(skinHex, { rough: 0.65, sss: 1 });
    this.paint();
    const body = new Node(); this.body = body; this.root.add(body);
    // scheletro (fuori dalla scena): le sue matrici deformano corpo e vestiti
    const rig = new Node(); this.rig = rig;
    const torsoB = new Node(); rig.add(torsoB); torsoB.rest = [0, 0, 0];
    const bone = (parent, p, rest) => { const n = new Node().at(...p); n.rest = rest; parent.add(n); return n; };
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    this.legs = []; this.arms = [];
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const hip = bone(torsoB, J['hip' + s], J['hip' + s]);
      const knee = bone(hip, sub(J['knee' + s], J['hip' + s]), J['knee' + s]);
      this.legs.push({ hip, knee, sx });
    }
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const sh = bone(torsoB, J['sh' + s], J['sh' + s]);
      const el = bone(sh, sub(J['el' + s], J['sh' + s]), J['el' + s]);
      const wr = new Node().at(...sub(J['wr' + s], J['el' + s])); el.add(wr);
      this.arms.push({ sh, el, wr, sx });
    }
    this.bones = [torsoB, this.legs[0].hip, this.legs[0].knee, this.legs[1].hip, this.legs[1].knee, this.arms[0].sh, this.arms[0].el, this.arms[1].sh, this.arms[1].el];
    this.boneMats = new Float32Array(12 * 16);
    for (let i = 0; i < 12; i++) this.boneMats[i * 16] = this.boneMats[i * 16 + 5] = this.boneMats[i * 16 + 10] = this.boneMats[i * 16 + 15] = 1;
    const token = this.token = (this.token || 0) + 1, waits = [];
    this.skinned = (geo, m) => { const n = mesh(geo, m); n.mesh.bones = this.boneMats; body.add(n); return n; };
    // le geometrie arrivano dal worker: si aggiungono quando sono pronte (se l'avatar non è cambiato nel frattempo)
    this.want = (kind, item, m) => { const p = getGeo(kind, key, item).then(geos => { if (this.token === token) geos.forEach(g => this.skinned(g, m)); }); waits.push(p); return p; };
    this.want('body', '', skin);
    this.want('hands', '', skin);
    // testa
    const HS = 1.1; const head = new Node().at(0, B.head.y + 0.014, 0).sc(HS, HS, HS); body.add(head); this.head = head;   // testa più grande, proporzioni stile Mii
    const shape = new Node().sc(B.head.a, B.head.b, B.head.c); head.add(shape);
    if (!F) {
      // testa maschile: lo stesso viso del personaggio femminile (manichino di riferimento), con trucco e sopracciglia da ragazzo
      const mh = new Node().at(0, (1.615 - 1.48 - (B.head.y + 0.014)) / HS, 0.012 / HS).sc(1.04 / HS, 1.04 / HS, 1.04 / HS); head.add(mh);
      const addH = (file, m, prep) => { const p = meshyGeo(file, prep).then(g => { if (this.token === token) mh.add(mesh(g, m)); }); waits.push(p); };
      if (!this.faceTex) { this.faceTex = document.createElement('canvas'); this.faceTex.width = this.faceTex.height = 512; }
      const hc = c.hairStyle ? hairColorOf(c) : '#6b4a35';
      drawMeshyFace(this.faceTex, { skin: skinHex, lips: mixHex(skinHex, '#b5605f', 0.3), blush: 0.15, brow: mixHex(hc, '#2a1a12', 0.55), browW: 1.6 });
      addH('head_skin.bin', mat('#ffffff', { map: this.faceTex, rough: 0.62, sss: 1 }), faceUV);
      if (HAIR_FILE[c.hairStyle]) addH(HAIR_FILE[c.hairStyle] + '.bin', hairMat(hairColorOf(c)));
      if (!this.eyeCv) { this.eyeCv = document.createElement('canvas'); this.eyeCv.width = 512; this.eyeCv.height = 256; }
      drawEyeball(this.eyeCv, eyeColor(c));
      const eyeMat = mat('#ffffff', { map: this.eyeCv, rough: 0.25, spec: 0.6, shin: 90 });
      for (const sx of [-1, 1]) {
        const e = new Node().at(sx * MEYE.x, MEYE.y, MEYE.z); e.rotation = [0, sx * 0.12, 0]; mh.add(e);
        e.add(mesh(sphere(32, 24, null, Math.PI), eyeMat).sc(MEYE.r));
        e.add(mesh(sphere(10, 8), mat('#ffffff', { unlit: true }), false).at(MEYE.r * 0.3, MEYE.r * 0.25, MEYE.r * 0.95).sc(MEYE.r * 0.12));
      }
      this.lids = null;
      if (c.glasses) { const gs = new Node().at(...MHEAD.c).sc(MHEAD.a, MHEAD.b, MHEAD.cz); mh.add(gs); gs.add(this.glasses(c.glasses, { y: -0.06, z: 0.98, x: 0.37 })); }
    } else {
    shape.add(mesh(headGeo(), mat('#ffffff', { map: this.faceCv, rough: 0.65, sss: 1 })));
    this.buildEyes(head, B, F, skin);
    for (const sx of [-1, 1]) shape.add(mesh(sphere(20, 14), skin).at(sx * 0.96, -0.08, -0.05).sc(0.1, 0.2, 0.14));
    if (c.hairStyle) shape.add(buildHair(c.hairStyle, hairColorOf(c)));
    if (c.glasses) shape.add(this.glasses(c.glasses));
    }
    this.torso = body;
    this.dress(c, B, F, key, skinHex);
    if (c.shoes === 'sho1') this.want('shoe', 'sock', mat('#f7f1ec', { rough: 0.9 }));
    if (c.shoes === 'sho2') this.want('shoe', 'sole2', mat('#ffffff', { rough: 0.6 }));
    if (c.shoes) this.want('shoe', c.shoes, mat({ sho1: '#a33233', sho2: '#f7f2e6', sho3: '#c98a73' }[c.shoes], { rough: 0.55, spec: 0.12, shin: 30 }));
    this.ready = Promise.all(waits);
    this.handNode = null;
    if (c.bag) { this.handNode = new Node(); this.handNode.matrix = new Float32Array(16); body.add(this.handNode); this.handNode.add(this.bag(c.bag)); }
    this.update(0);
  }
  // personaggio femminile e Giulia: corpi dai modelli di riferimento, con lo stesso scheletro e le stesse pose
  buildMeshy() {
    const c = this.cfg, isG = c.model === 'giulia';
    this.root.clear(); this.lids = null;
    const token = this.token = (this.token || 0) + 1, waits = [];
    const body = new Node(); this.body = body; this.root.add(body);
    const rig = new Node(); this.rig = rig;
    const torsoB = new Node(); rig.add(torsoB); torsoB.rest = [0, 0, 0];
    const bone = (parent, p, rest) => { const n = new Node().at(...p); n.rest = rest; parent.add(n); return n; };
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    this.legs = []; this.arms = [];
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const hip = bone(torsoB, MJ['hip' + s], MJ['hip' + s]);
      const knee = bone(hip, sub(MJ['knee' + s], MJ['hip' + s]), MJ['knee' + s]);
      this.legs.push({ hip, knee, sx });
    }
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const sh = bone(torsoB, MJ['sh' + s], MJ['sh' + s]);
      const el = bone(sh, sub(MJ['el' + s], MJ['sh' + s]), MJ['el' + s]);
      const wr = new Node().at(...sub(MJ['wr' + s], MJ['el' + s])); el.add(wr);
      this.arms.push({ sh, el, wr, sx });
    }
    const headB = bone(torsoB, MJ.neck, MJ.neck); this.head = headB;
    this.bones = [torsoB, this.legs[0].hip, this.legs[0].knee, this.legs[1].hip, this.legs[1].knee, this.arms[0].sh, this.arms[0].el, this.arms[1].sh, this.arms[1].el, headB];
    this.boneMats = new Float32Array(12 * 16);
    for (let i = 0; i < 12; i++) this.boneMats[i * 16] = this.boneMats[i * 16 + 5] = this.boneMats[i * 16 + 10] = this.boneMats[i * 16 + 15] = 1;
    this.skinned = (geo, m) => { const n = mesh(geo, m); n.mesh.bones = this.boneMats; body.add(n); return n; };
    const add = (file, m, prep) => { const p = meshyGeo(file, prep).then(g => { if (this.token === token) this.skinned(g, m); }); waits.push(p); return p; };
    this.want = (kind, item, m) => add(kind === 'shoe' ? 'g_' + item + '.bin' : 'g_' + item + '.bin', m);
    // la testa: un nodo che segue l'osso del collo, per occhi, capelli e occhiali
    const headAttach = new Node(); headAttach.matrix = new Float32Array(16); headAttach.matrix[0] = headAttach.matrix[5] = headAttach.matrix[10] = headAttach.matrix[15] = 1;
    body.add(headAttach); this.headAttach = headAttach;
    if (isG) {
      if (!giuliaTex) giuliaTex = loadImage(MODELS + 'giulia_tex.jpg');
      waits.push(giuliaTex.then(im => add('giulia_rig.bin', mat('#ffffff', { map: im, rough: 0.6, sss: 0.4 }))));
    } else {
      const skinHex = skinColor(c);
      if (!this.faceTex) { this.faceTex = document.createElement('canvas'); this.faceTex.width = this.faceTex.height = 512; }
      const hc = c.hairStyle ? hairColorOf(c) : '#6b4a35';
      drawMeshyFace(this.faceTex, { skin: skinHex, lips: mixHex(skinHex, '#c45a62', 0.55), blush: c.blush ?? 0.5, brow: mixHex(hc, '#3a2418', 0.4) });
      add('body_rig.bin', mat('#ffffff', { map: this.faceTex, rough: 0.62, sss: 1 }), faceUV);
      // occhi nelle orbite del modello
      if (!this.eyeCv) { this.eyeCv = document.createElement('canvas'); this.eyeCv.width = 512; this.eyeCv.height = 256; }
      drawEyeball(this.eyeCv, eyeColor(c));
      const eyeMat = mat('#ffffff', { map: this.eyeCv, rough: 0.25, spec: 0.6, shin: 90 });
      for (const sx of [-1, 1]) {
        const e = new Node().at(sx * MEYE.x, MEYE.y, MEYE.z); e.rotation = [0, sx * 0.12, 0]; headAttach.add(e);
        e.add(mesh(sphere(32, 24, null, Math.PI), eyeMat).sc(MEYE.r));
        e.add(mesh(sphere(10, 8), mat('#ffffff', { unlit: true }), false).at(MEYE.r * 0.3, MEYE.r * 0.25, MEYE.r * 0.95).sc(MEYE.r * 0.12));
      }
      const shape = new Node().at(...MHEAD.c).sc(MHEAD.a, MHEAD.b, MHEAD.cz); headAttach.add(shape);
      if (HAIR_FILE[c.hairStyle]) add(HAIR_FILE[c.hairStyle] + '.bin', hairMat(hairColorOf(c)));
      if (c.glasses) shape.add(this.glasses(c.glasses, { y: -0.06, z: 0.98, x: 0.37 }));
      this.dress(c, null, true, 'F', skinHex, MPROFILE);
      if (c.shoes === 'sho1') this.want('shoe', 'sock', mat('#f7f1ec', { rough: 0.9 }));
      if (c.shoes === 'sho2') this.want('shoe', 'sole2', mat('#ffffff', { rough: 0.6 }));
      if (c.shoes) this.want('shoe', c.shoes, mat({ sho1: '#a33233', sho2: '#f7f2e6', sho3: '#c98a73' }[c.shoes], { rough: 0.55, spec: 0.12, shin: 30 }));
    }
    this.torso = body;
    this.ready = Promise.all(waits);
    this.handNode = null;
    if (c.bag && !isG) { this.handNode = new Node(); this.handNode.matrix = new Float32Array(16); body.add(this.handNode); this.handNode.add(this.bag(c.bag)); }
    this.update(0);
  }
  dress(c, B, F, key, skinHex, profile) {
    const T = profile || RIG[F ? 'F' : 'M'].torso, body = this.body, M = (col) => mat(col, { rough: 0.85, double: true });
    const G = (id, o, col) => this.want('garment', id, M(col));
    const top = c.dress ? null : c.top, bot = c.dress ? null : c.bottom;
    if (!top && !c.dress) G('tank', { torso: [1.1, 1.385], pad: 0.005 }, CLOTH.base);
    if (!bot && !c.dress) G('briefs', { torso: [0.76, 0.93], legs: 0.79, pad: 0.005 }, CLOTH.base);
    if (top === 'top1') G('tee', { torso: [0.9, 1.385], arms: 0.13, pad: 0.017 }, CLOTH.top1);
    if (top === 'top2') {
      G('crop', { torso: [1.12, 1.385], arms: 0.12, pad: 0.01 }, CLOTH.top2);
      for (let k = 0; k < 6; k++) { const y = 1.15 + k * 0.034, [, , f] = torsoAt(T, y); body.add(mesh(sphere(10, 8), mat('#f4ece4')).at(0, y, f + (y > 1.18 && y < 1.3 && F ? 0.03 : 0.014)).sc(0.006)); }
    }
    if (top === 'top3') G('sweater', { torso: [0.88, 1.385], arms: 1, pad: 0.016 }, CLOTH.top3);
    if (top === 'gtop') {
      G('gtop', { torso: [1.13, 1.37], arms: 1, pad: 0.012 }, CLOTH.gtop);
      const [, , f] = torsoAt(T, 1.14);
      body.add(mesh(sphere(14, 10), M(CLOTH.gtop)).at(0, 1.14, f + 0.02).sc(0.02));
      for (const sx of [-1, 1]) body.add(mesh(sphere(14, 10), M(CLOTH.gtop)).at(sx * 0.02, 1.11, f + 0.02).sc(0.014, 0.04, 0.008).rot(0, 0, sx * 0.4));
    }
    if (bot === 'bot1') {
      G('skirtTop', { torso: [0.95, 1.1], pad: 0.01 }, CLOTH.bot1);
      body.add(mesh(skirtGeo(T, 1.0, 0.64, 0.25, 0.012, 0.9), mat(CLOTH.bot1, { rough: 0.85, double: true })));
    }
    if (bot === 'bot2') G('jeans', { torso: [0.76, 1.05], legs: 0.1, pad: 0.009, flare: 0.08 }, CLOTH.bot2);
    if (bot === 'bot3') G('wide', { torso: [0.76, 1.05], legs: 0.1, pad: 0.02, flare: 0.04 }, CLOTH.bot3);
    if (bot === 'gshorts') G('gshorts', { torso: [0.76, 1.06], legs: 0.67, pad: 0.014 }, CLOTH.gshorts);
    if ((bot === 'bot2' || bot === 'bot3') && (!top || top === 'top2' || top === 'gtop')) {
      const [, w, f, bk] = torsoAt(T, 1.035), pd = bot === 'bot3' ? 0.026 : 0.016;
      body.add(mesh(rings([{ y: 1.02, rx: w + pd, rzF: f + pd, rzB: bk + pd }, { y: 1.048, rx: w + pd, rzF: f + pd, rzB: bk + pd }], 48, { capTop: false, capBot: false }), mat(mixHex(CLOTH[bot], '#000000', 0.12), { rough: 0.85, double: true })));
      body.add(mesh(sphere(10, 8), mat('#c9a35a', { spec: 0.4, shin: 40 })).at(0, 1.034, f + pd + 0.002).sc(0.007, 0.007, 0.004));
    }
    if (c.dress === 'dre1') { G('dre1', { torso: [0.95, 1.3], pad: 0.01 }, CLOTH.dre1); body.add(mesh(skirtGeo(T, 1.0, 0.46, 0.27, 0.012, 1.0), mat(CLOTH.dre1, { rough: 0.85, double: true }))); this.straps(body, T, CLOTH.dre1); }
    if (c.dress === 'dre2') { G('dre2', { torso: [0.9, 1.3], pad: 0.012 }, CLOTH.dre2); body.add(mesh(skirtGeo(T, 1.01, 0.36, 0.2, 0.016, 1.3), mat(CLOTH.dre2, { rough: 0.85, double: true }))); this.straps(body, T, CLOTH.dre2, 0.03); }
    if (c.dress === 'dre3') { G('dre3', { torso: [0.9, 1.36], arms: 1, pad: 0.011 }, CLOTH.dre3); body.add(mesh(skirtGeo(T, 1.01, 0.47, 0.2, 0.012, 1.0), mat(CLOTH.dre3, { rough: 0.85, double: true }))); }
  }
  straps(torso, T, col, w = 0.016) {
    for (const sx of [-1, 1]) torso.add(mesh(torus(0.07, w / 2, 20, 8, Math.PI), mat(col)).at(sx * 0.075, 1.3, 0).rot(0, Math.PI / 2, Math.PI / 2).sc(1, 1, 0.7));
  }
  bag(type) {
    // nello spazio del polso: la mano scende di ~7 cm; il manico passa nel pugno, la borsa pende sotto
    const g = new Node(), grip = new Node().at(-0.004, -0.07, 0.004); g.add(grip);
    if (type === 'bag2') { grip.add(mesh(rbox(0.05, 0.11, 0.2, 0.3), mat('#6e4f6e')).at(0.0, -0.01, 0)); return g; }   // pochette stretta in mano
    const col = type === 'bag1' ? '#6b6461' : '#a33a36', hc = type === 'bag1' ? '#4c4644' : '#7a2422';
    grip.add(mesh(tube(Array.from({ length: 11 }, (_, i) => { const t = Math.PI * i / 10; return [0, -0.055 + 0.055 * Math.sin(t), 0.05 * Math.cos(t)]; }), 0.007, 8), mat(hc)));   // manico ad arco, verticale, passa nel pugno
    grip.add(mesh(rbox(0.075, 0.15, 0.2, 0.3), mat(col)).at(0, -0.13, 0));                                 // corpo della borsa
    for (const sz of [-1, 1]) grip.add(mesh(sphere(10, 8), mat('#c9a96a')).at(0, -0.055, sz * 0.05).sc(0.008));   // attacchi metallici
    return g;
  }
  glasses(type, fit = { y: 0.04, z: 1.08, x: 0.34 }) {
    const g = new Node(), { y, z, x } = fit;
    if (type === 'gla3') {
      for (const sx of [-1, 1]) g.add(mesh(sphere(20, 12), mat('#262626', { rough: 0.3 })).at(sx * x, y + 0.02, z).sc(0.27, 0.17, 0.05).rot(0, 0, sx * -0.25));
      g.add(mesh(rbox(0.2, 0.04, 0.04, 0.4), mat('#262626')).at(0, y + 0.06, z + 0.02));
      return g;
    }
    const f = type === 'gla1' ? '#5f8a91' : '#8a5a3a', l = type === 'gla1' ? '#eef0fb' : '#f7f8e6';
    for (const sx of [-1, 1]) {
      g.add(mesh(torus(0.21, 0.025, 32, 8), mat(f)).at(sx * x, y, z).rot(Math.PI / 2, 0, 0).sc(1, 1, type === 'gla2' ? 0.75 : 1));
      g.add(mesh(disc(0.2), mat(l, { opacity: 0.35 }), false).at(sx * x, y, z - 0.005).rot(Math.PI / 2, 0, 0).sc(1, 1, type === 'gla2' ? 0.75 : 1));
      g.add(mesh(rbox(0.03, 0.03, 1.0, 0.4), mat(f)).at(sx * 0.62, y + 0.02, 0.58).rot(0, sx * 0.3, 0));
    }
    g.add(mesh(torus(0.08, 0.022, 14, 6, Math.PI), mat(f)).at(0, y + 0.03, z + 0.03));
    return g;
  }
  update(dt) {
    this.t += dt;
    if (this.lids) { // sbattere le palpebre e occhiolino
      this.blinkT -= dt;
      if (this.blinkT < 0) { this.blink += dt / 0.09; if (this.blink >= 2) { this.blink = 0; this.blinkT = 2.5 + Math.random() * 3.5; } }
      const b = this.blink > 0 ? (this.blink < 1 ? this.blink : 2 - this.blink) : 0;
      for (const L of this.lids) {
        const closed = (this.expr.wink && L.sx < 0) ? 1 : b;
        L.up.rotation = [0.36 + 0.76 * closed, 0, 0];
        L.lo.rotation = [Math.PI - 0.32 - 0.12 * closed, 0, 0];
      }
    }
    const w = this.walk; this.phase += dt * (2 + 7.5 * w);
    const s = Math.sin(this.phase);
    this.legs.forEach((L, i) => {
      const side = i === 0 ? 1 : -1;
      L.hip.rotation = [side * s * 0.5 * w, 0, 0];
      L.knee.rotation = [Math.max(0, -side * Math.cos(this.phase)) * 0.75 * w, 0, 0];
    });
    const tg = POSES[this.pose] || POSES.idle, k = Math.min(1, dt * 6 || 1);
    ['r', 'l'].forEach((sd, i) => {
      const cur = this.poseNow[sd]; for (let j = 0; j < 4; j++) cur[j] += (tg[sd][j] - cur[j]) * k;
      const a = this.arms[i], swing = this.pose ? 0 : (i === 0 ? -1 : 1) * s * 0.42 * w;
      a.sh.rotation = [cur[0] + swing, 0, cur[1] + (this.pose ? 0 : a.sx * 0.012 * Math.sin(this.t * 1.3))];
      a.el.rotation = [cur[2] - (this.pose ? 0 : 0.18 * w), 0, cur[3] + (this.pose === 'wave' && i === 0 ? Math.sin(this.t * 7) * 0.3 : 0)];
    });
    // matrici dello scheletro (relative al corpo): osso_mondo × traslazione(−giunto a riposo)
    this.rig.update();
    const T = M4.ident();
    this.bones.forEach((bn, i) => { T[12] = -bn.rest[0]; T[13] = -bn.rest[1]; T[14] = -bn.rest[2]; this.boneMats.set(M4.mul(bn.world, T), i * 16); });
    if (this.handNode) this.handNode.matrix.set(this.arms[0].wr.world);
    if (this.headAttach) this.headAttach.matrix.set(this.boneMats.subarray(9 * 16, 10 * 16));
    this.body.position = [0, Math.abs(Math.cos(this.phase)) * 0.025 * w + Math.sin(this.t * 2.1) * 0.003, 0];
    this.head.rotation = [0, -s * 0.04 * w + Math.sin(this.t * 0.7) * 0.04 * (1 - w), this.pose ? Math.sin(this.t * 0.9) * 0.035 : 0];
  }
}

export const GIULIA = {
  model: 'giulia', base: 'F', skinHex: '#f0c4b2', eyeHex: '#5d9cb2', hairHex: '#f3d38f', hairStyle: 'hf4', blush: 0.9,
  top: 'gtop', bottom: 'gshorts', shoes: 'sho2', dress: null, bag: null, glasses: null,
};
