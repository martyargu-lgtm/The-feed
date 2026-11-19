// Corpo continuo: superficie unica generata da forme morbide fuse insieme (campo di distanza + "surface nets"),
// scheletro per il movimento (skinning) e vestiti aderenti ricavati dallo stesso corpo leggermente gonfiato.
import { Geometry } from './m3d.js';

// ---------------- primitive di distanza ----------------
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
function ell(px, py, pz, cx, cy, cz, rx, ry, rz) { // ellissoide (approssimato)
  const x = px - cx, y = py - cy, z = pz - cz;
  const k0 = len3(x / rx, y / ry, z / rz), k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
function cone(px, py, pz, a, b, r1, r2) { // capsula affusolata da a (raggio r1) a b (raggio r2)
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const qx = px - a[0], qy = py - a[1], qz = pz - a[2];
  const L2 = bx * bx + by * by + bz * bz;
  const t = Math.max(0, Math.min(1, (qx * bx + qy * by + qz * bz) / L2));
  return len3(qx - bx * t, qy - by * t, qz - bz * t) - (r1 + (r2 - r1) * t);
}
export function smin(a, b, k) {
  if (k < 1e-4) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
const smax = (a, b, k) => -smin(-a, -b, k);
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------- misure (dalla sagoma fornita, altezza 1,65 m) ----------------
export const RIG = {
  F: {
    torso: [[0.79, 0.118, 0.07, 0.08], [0.82, 0.142, 0.08, 0.098], [0.86, 0.149, 0.085, 0.106], [0.93, 0.138, 0.08, 0.098],
      [1.0, 0.115, 0.072, 0.08], [1.06, 0.092, 0.066, 0.066], [1.1, 0.087, 0.066, 0.064], [1.15, 0.095, 0.072, 0.066],
      [1.2, 0.108, 0.078, 0.072], [1.25, 0.114, 0.078, 0.076], [1.29, 0.117, 0.074, 0.076], [1.33, 0.118, 0.066, 0.07],
      [1.36, 0.108, 0.056, 0.062], [1.376, 0.096, 0.05, 0.058], [1.39, 0.068, 0.043, 0.05], [1.4, 0.04, 0.036, 0.04]],
    bust: 1, hipX: 0.079, hipY: 0.84, knee: [0.064, 0.47], ankle: [0.059, 0.085],
    thighR: [0.062, 0.044], shinR: [0.045, 0.026], calf: 0.047,
    shoulder: [0.13, 1.32], armAng: 0.25, upper: 0.265, fore: 0.235, armR: [0.035, 0.027, 0.0275, 0.019],
    neck: [0.037, 1.36, 1.575], headY: 1.53,
  },
  M: {
    torso: [[0.8, 0.12, 0.075, 0.08], [0.83, 0.138, 0.085, 0.095], [0.87, 0.14, 0.088, 0.098], [0.94, 0.132, 0.084, 0.09],
      [1.0, 0.124, 0.08, 0.082], [1.06, 0.12, 0.08, 0.078], [1.12, 0.124, 0.084, 0.08], [1.18, 0.134, 0.09, 0.084],
      [1.24, 0.146, 0.094, 0.088], [1.29, 0.155, 0.09, 0.088], [1.33, 0.158, 0.08, 0.084], [1.36, 0.152, 0.07, 0.076],
      [1.385, 0.12, 0.06, 0.066], [1.4, 0.108, 0.055, 0.062], [1.412, 0.078, 0.05, 0.054], [1.42, 0.047, 0.042, 0.046]],
    bust: 0, hipX: 0.078, hipY: 0.86, knee: [0.066, 0.48], ankle: [0.062, 0.088],
    thighR: [0.068, 0.048], shinR: [0.049, 0.029], calf: 0.052,
    shoulder: [0.158, 1.35], armAng: 0.22, upper: 0.275, fore: 0.245, armR: [0.044, 0.034, 0.034, 0.023],
    neck: [0.033, 1.38, 1.5], headY: 1.56,
  },
};
function torsoRow(T, y) {
  if (y <= T[0][0]) return T[0];
  for (let i = 0; i < T.length - 1; i++) if (y <= T[i + 1][0]) { const t = (y - T[i][0]) / (T[i + 1][0] - T[i][0]); return T[i].map((v, k) => v + (T[i + 1][k] - v) * t); }
  return T[T.length - 1];
}
export function joints(R) {
  const s = R.shoulder, a = R.armAng;
  const J = {};
  for (const [side, sx] of [['L', -1], ['R', 1]]) {
    J['hip' + side] = [sx * R.hipX, R.hipY, 0];
    J['knee' + side] = [sx * R.knee[0], R.knee[1], 0.006];
    J['ankle' + side] = [sx * R.ankle[0], R.ankle[1], -0.004];
    J['sh' + side] = [sx * s[0], s[1], -0.004];
    J['el' + side] = [sx * (s[0] + Math.sin(a) * R.upper), s[1] - Math.cos(a) * R.upper, -0.01];
    J['wr' + side] = [sx * (s[0] + Math.sin(a) * R.upper + Math.sin(a + 0.04) * R.fore), s[1] - Math.cos(a) * R.upper - Math.cos(a + 0.04) * R.fore, 0.004];
  }
  return J;
}

// ---------------- parti del corpo come campi di distanza ----------------
function torsoField(R, x, y, z) {
  const T = R.torso, [, w, f, b] = torsoRow(T, y), rz = z >= 0 ? f : b;
  let d = (len3(x / w, 0, z / rz) - 1) * Math.min(w, rz) * 0.92;
  d = smax(d, T[0][0] - y, 0.04);
  d = smax(d, y - T[T.length - 1][0] - 0.02, 0.03);
  // glutei, spalle, seno (morbidi)
  for (const sx of [-1, 1]) {
    d = smin(d, ell(x, y, z, sx * 0.052, 0.86, -0.045, 0.074, 0.085, 0.068), 0.03);
    d = smin(d, ell(x, y, z, sx * (R.shoulder[0] - 0.012), R.shoulder[1] + 0.005, -0.004, 0.05, 0.042, 0.046), 0.04);
    if (R.bust) d = smin(d, ell(x, y, z, sx * 0.05, 1.235, 0.04, 0.058, 0.055, 0.05), 0.035);
  }
  // collo
  // collo: cilindro dritto, un po' più profondo che largo, attaccato alle spalle con un raccordo corto
  { const nr = R.neck[0], ny = Math.max(0, Math.min(1, (y - R.neck[1]) / (R.neck[2] - R.neck[1])));
    const nk = Math.hypot(x / (nr * (1.0 + 0.14 * ny * ny)), (z + 0.006 + 0.012 * ny * ny) / (nr * (1.08 + 0.6 * ny * ny))) - 1;   // in alto si allarga dietro la mandibola
    let n = nk * nr; n = smax(n, R.neck[1] - 0.04 - y, 0.01); n = smax(n, y - R.neck[2], 0.01);
    d = smin(d, n, 0.016); }
  d = smin(d, ell(x, y, z, 0, R.neck[1] - 0.005, -0.045, R.neck[0] * 2.2, 0.03, 0.03), 0.02);   // trapezio, dietro
  for (const sx of [-1, 1]) d = smin(d, cone(x, y, z, [sx * 0.012, R.neck[1] - 0.025, 0.045], [sx * R.shoulder[0] * 0.85, R.neck[1] - 0.02, 0.03], 0.008, 0.007), 0.012);   // clavicole
  return d;
}
function legField(R, J, side, x, y, z, { foot = true } = {}) {
  const h = J['hip' + side], k = J['knee' + side], a = J['ankle' + side], sx = side === 'L' ? -1 : 1;
  let d = cone(x, y, z, [h[0], h[1] + 0.03, h[2]], k, R.thighR[0], R.thighR[1]);
  d = smin(d, ell(x, y, z, h[0] + sx * 0.004, h[1] - 0.1, 0.006, R.thighR[0] * 1.03, 0.15, R.thighR[0]), 0.03); // coscia piena
  d = smin(d, cone(x, y, z, k, a, R.shinR[0], R.shinR[1]), 0.03);
  d = smin(d, ell(x, y, z, k[0] + sx * 0.002, k[1] - 0.14, -0.014, R.calf * 0.95, 0.11, R.calf * 0.92), 0.06); // polpaccio
  if (foot) d = smin(d, footField(a, x, y, z), 0.03);
  return d;
}
function footField(a, x, y, z) {
  const sx = a[0] > 0 ? 1 : -1;
  let d = ell(x, y, z, a[0], 0.032, 0.025, 0.03, 0.03, 0.065);                                   // collo del piede
  d = smin(d, ell(x, y, z, a[0] + sx * 0.003, 0.016, 0.085, 0.032, 0.016, 0.04), 0.02);           // pianta
  d = smin(d, ell(x, y, z, a[0], 0.034, -0.016, 0.026, 0.034, 0.03), 0.025);                     // tallone
  for (let t = 0; t < 5; t++) {                                                                   // dita
    const tx = a[0] + sx * (-0.017 + t * 0.0085), tz = 0.122 - t * 0.0055 - (t === 0 ? 0 : 0.004), r = t === 0 ? 0.0085 : 0.0068 - t * 0.0004;
    d = smin(d, ell(x, y, z, tx, 0.011, tz, r, r * 0.9, r * 1.2), 0.008);
  }
  return d;
}
function armField(R, J, side, x, y, z, upTo = 1) { // upTo ≥ 1: fino al polso; altrimenti lunghezza (m) dalla spalla, con taglio netto
  const s = J['sh' + side], e = J['el' + side], w = J['wr' + side], r = R.armR;
  let d = cone(x, y, z, s, e, r[0], r[1]);
  d = smin(d, cone(x, y, z, e, w, r[2], r[3]), 0.012);   // avambraccio: profilo liscio e regolare
  if (upTo < 1) { // manica corta: taglio perpendicolare al braccio
    const dx = e[0] - s[0], dy = e[1] - s[1], dz = e[2] - s[2], L = Math.hypot(dx, dy, dz);
    const t = ((x - s[0]) * dx + (y - s[1]) * dy + (z - s[2]) * dz) / L;
    d = smax(d, t - upTo, 0.006);
  }
  return d;
}
function handField(R, J, side, x, y, z) {
  // mano anatomica: palmo lungo quanto le dita, quattro dita con tre falangi e nocche, pollice che nasce dalla base del palmo
  const w = J['wr' + side], sx = side === 'L' ? -1 : 1, k = R === RIG.M ? 1.1 : 1;
  const ax = Math.sin(R.armAng) * sx, ay = -Math.cos(R.armAng);          // lungo il braccio
  const ix = -sx * Math.cos(R.armAng), iy = -Math.sin(R.armAng);         // verso il corpo (palmo)
  const P = (along, inward, dz) => [w[0] + (ax * along + ix * inward) * k, w[1] + (ay * along + iy * inward) * k, w[2] + dz * k];
  let d = cone(x, y, z, P(-0.035, 0, 0), P(0.004, 0, 0.001), R.armR[3], R.armR[3] * 1.08);              // polso
  // palmo: più largo verso le nocche, sottile, leggermente incavato
  d = smin(d, cone(x, y, z, P(0.012, 0.001, 0.0), P(0.06, 0.002, 0.0), 0.012 * k, 0.012 * k), 0.012);
  { const c = P(0.05, 0.002, 0.0); d = smin(d, ell(x, y, z, c[0], c[1], c[2], 0.011 * k, 0.04 * k, 0.03 * k), 0.012); }
  { const c = P(0.03, 0.006, 0.018); d = smin(d, ell(x, y, z, c[0], c[1], c[2], 0.011 * k, 0.025 * k, 0.013 * k), 0.012); }   // eminenza tenar
  { const c = P(0.04, 0.005, -0.02); d = smin(d, ell(x, y, z, c[0], c[1], c[2], 0.009 * k, 0.03 * k, 0.01 * k), 0.012); }    // eminenza ipotenar
  const lens = [0.064, 0.072, 0.068, 0.054], base = [0.088, 0.09, 0.088, 0.083];
  for (let f = 0; f < 4; f++) {                                     // indice (davanti) → mignolo (dietro)
    const o = (1.5 - f) * 0.0152, L = lens[f], b = base[f], sp = 1 + 0.12;
    const r0 = (0.0078 - f * 0.0004) * k, r3 = r0 * 0.74;
    const k0 = P(b, 0.0, o), k1 = P(b + L * 0.45, 0.004, o * sp), k2 = P(b + L * 0.75, 0.009, o * sp * 1.02), k3 = P(b + L, 0.014, o * sp * 1.03);
    d = smin(d, ell(x, y, z, ...P(b - 0.006, -0.002, o), 0.0065 * k, 0.009 * k, 0.0075 * k), 0.01);   // nocca, appena accennata
    d = smin(d, cone(x, y, z, k0, k1, r0, r0 * 0.9), 0.011);
    d = smin(d, cone(x, y, z, k1, k2, r0 * 0.9, r0 * 0.82), 0.003);
    d = smin(d, cone(x, y, z, k2, k3, r0 * 0.82, r3), 0.003);
  }
  // pollice: metacarpo nella base del palmo, poi due falangi verso l'avanti e in basso
  const t0 = P(0.01, 0.004, 0.014), t1 = P(0.045, 0.01, 0.03), t2 = P(0.07, 0.014, 0.037), t3 = P(0.092, 0.016, 0.038);
  d = smin(d, cone(x, y, z, t0, t1, 0.011 * k, 0.0095 * k), 0.012);
  d = smin(d, cone(x, y, z, t1, t2, 0.0092 * k, 0.0082 * k), 0.004);
  d = smin(d, cone(x, y, z, t2, t3, 0.0082 * k, 0.007 * k), 0.003);
  return d;
}

// ---------------- surface nets ----------------
// f(x,y,z) < 0 dentro. Restituisce posizioni e triangoli; normali dal gradiente del campo.
export function surfaceNets(f, [x0, y0, z0], [x1, y1, z1], h) {
  const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
  const F = new Float32Array(nx * ny * nz);
  // griglia grossolana: la valutazione esatta serve solo vicino alla superficie
  const S = 4, cx = Math.ceil((nx - 1) / S) + 1, cy = Math.ceil((ny - 1) / S) + 1, cz = Math.ceil((nz - 1) / S) + 1;
  const Cg = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) Cg[i + cx * (j + cy * k)] = f(x0 + i * S * h, y0 + j * S * h, z0 + k * S * h);
  const far = S * h * 1.9;
  for (let k = 0; k < nz; k++) {
    const kc = Math.min(cz - 2, Math.floor(k / S)), fk = k / S - kc;
    for (let j = 0; j < ny; j++) {
      const jc = Math.min(cy - 2, Math.floor(j / S)), fj = j / S - jc;
      for (let i = 0; i < nx; i++) {
        const ic = Math.min(cx - 2, Math.floor(i / S)), fi = i / S - ic;
        const o = ic + cx * (jc + cy * kc);
        const c000 = Cg[o], c100 = Cg[o + 1], c010 = Cg[o + cx], c110 = Cg[o + cx + 1];
        const c001 = Cg[o + cx * cy], c101 = Cg[o + cx * cy + 1], c011 = Cg[o + cx * cy + cx], c111 = Cg[o + cx * cy + cx + 1];
        const mn = Math.min(Math.abs(c000), Math.abs(c100), Math.abs(c010), Math.abs(c110), Math.abs(c001), Math.abs(c101), Math.abs(c011), Math.abs(c111));
        const sameSign = (c000 > 0) === (c111 > 0) && (c000 > 0) === (c100 > 0) && (c000 > 0) === (c010 > 0) && (c000 > 0) === (c001 > 0) && (c000 > 0) === (c110 > 0) && (c000 > 0) === (c101 > 0) && (c000 > 0) === (c011 > 0);
        if (sameSign && mn > far) {
          const a = c000 + (c100 - c000) * fi, b = c010 + (c110 - c010) * fi, c = c001 + (c101 - c001) * fi, d = c011 + (c111 - c011) * fi;
          F[i + nx * (j + ny * k)] = (a + (b - a) * fj) + ((c + (d - c) * fj) - (a + (b - a) * fj)) * fk;
        } else F[i + nx * (j + ny * k)] = f(x0 + i * h, y0 + j * h, z0 + k * h);
      }
    }
  }
  const V = (i, j, k) => F[i + nx * (j + ny * k)];
  const cellIdx = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const C = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const [a, b, d] = corners[c]; cv[c] = V(i + a, j + b, k + d); if (cv[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb), A = corners[a], B = corners[b];
      sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++;
    }
    cellIdx[C(i, j, k)] = pos.length / 3;
    pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const inside = V(i, j, k) < 0;
    if (i < nx - 1 && (V(i + 1, j, k) < 0) !== inside) quad(cellIdx[C(i, j - 1, k - 1)], cellIdx[C(i, j, k - 1)], cellIdx[C(i, j, k)], cellIdx[C(i, j - 1, k)], inside);
    if (j < ny - 1 && (V(i, j + 1, k) < 0) !== inside) quad(cellIdx[C(i - 1, j, k - 1)], cellIdx[C(i - 1, j, k)], cellIdx[C(i, j, k)], cellIdx[C(i, j, k - 1)], inside);
    if (k < nz - 1 && (V(i, j, k + 1) < 0) !== inside) quad(cellIdx[C(i - 1, j - 1, k)], cellIdx[C(i, j - 1, k)], cellIdx[C(i, j, k)], cellIdx[C(i - 1, j, k)], inside);
  }
  // normali dal gradiente
  const nrm = new Float32Array(pos.length), e = h * 0.5;
  for (let v = 0; v < pos.length; v += 3) {
    const x = pos[v], y = pos[v + 1], z = pos[v + 2];
    const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; nrm[v] = gx / l; nrm[v + 1] = gy / l; nrm[v + 2] = gz / l;
  }
  return new Geometry(pos, nrm, null, idx);
}

// ---------------- pesi dello scheletro ----------------
// ossa: 0 busto, 1 anca L, 2 ginocchio L, 3 anca R, 4 ginocchio R, 5 spalla L, 6 gomito L, 7 spalla R, 8 gomito R
export const BONES = { torso: 0, hipL: 1, kneeL: 2, hipR: 3, kneeR: 4, shL: 5, elL: 6, shR: 7, elR: 8 };
function segT(p, a, b) { const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2]; const t = ((p[0] - a[0]) * bx + (p[1] - a[1]) * by + (p[2] - a[2]) * bz) / (bx * bx + by * by + bz * bz); const c = [a[0] + bx * t, a[1] + by * t, a[2] + bz * t]; return [t, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])]; }
export function skinWeights(geo, R, J, { torsoOnly = false, part = null, side: forced = null } = {}) {
  const n = geo.pos.length / 3, jo = new Float32Array(n * 4), we = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const p = [geo.pos[v * 3], geo.pos[v * 3 + 1], geo.pos[v * 3 + 2]];
    const side = forced || (p[0] < 0 ? 'L' : 'R');
    let w = [[0, 1]];
    if (part === 'arm' || part === 'sleeve') {
      const [ta] = segT(p, J['sh' + side], J['wr' + side]), tl = ta * (R.upper + R.fore);
      const a = part === 'sleeve' ? ss(-0.045, -0.02, tl) : ss(-0.01, 0.06, tl), e = ss(R.upper - 0.022, R.upper + 0.022, tl);
      w = [[0, 1 - a], [BONES['sh' + side], a * (1 - e)], [BONES['el' + side], a * e]];
    } else if (part === 'pants') {
      if (p[1] < R.hipY + 0.03) {
        const k = J['knee' + side][1], l = ss(R.hipY + 0.03, R.hipY - 0.07, p[1]), kk = ss(k + 0.045, k - 0.045, p[1]);
        w = [[0, 1 - l], [BONES['hip' + side], l * (1 - kk)], [BONES['knee' + side], l * kk]];
      }
    } else if (part === 'leg') {
      const k = J['knee' + side][1], l = ss(R.hipY + 0.03, R.hipY - 0.07, p[1]), kk = ss(k + 0.045, k - 0.045, p[1]);
      w = [[0, 1 - l], [BONES['hip' + side], l * (1 - kk)], [BONES['knee' + side], l * kk]];
    } else if (!torsoOnly && part !== 'torso') {
      // braccio? il punto deve essere più vicino alla superficie del braccio che a quella del busto
      const [ta, da] = segT(p, J['sh' + side], J['wr' + side]);
      const [, tw, tf, tb] = torsoRow(R.torso, p[1]);
      const dt = (Math.hypot(p[0] / tw, p[2] / (p[2] >= 0 ? tf : tb)) - 1) * Math.min(tw, tf);
      const armR = R.armR[0] - (R.armR[0] - R.armR[3]) * Math.max(0, Math.min(1, ta));
      const armish = ta > -0.06 && p[1] < R.shoulder[1] + 0.07 && (da - armR) < dt - 0.004 && da < 0.11;
      if (armish) {
        const L = R.upper + R.fore, tl = ta * L;
        const a = ss(-0.03, 0.02, tl);                       // dalla spalla al braccio (transizione corta: niente membrana sotto l'ascella)
        const e = ss(R.upper - 0.022, R.upper + 0.022, tl);  // gomito
        w = [[0, 1 - a], [BONES['sh' + side], a * (1 - e)], [BONES['el' + side], a * e]];
      } else if (p[1] < R.hipY + 0.03) {
        const k = J['knee' + side][1];
        const nearCrotch = ss(R.hipY - 0.16, R.hipY - 0.06, p[1]);              // solo in alto conta la vicinanza al centro
        const l = ss(R.hipY + 0.03, R.hipY - 0.07, p[1]) * (1 - nearCrotch * (1 - ss(0.0, 0.03, Math.abs(p[0]))));
        const kk = ss(k + 0.045, k - 0.045, p[1]);
        w = [[0, 1 - l], [BONES['hip' + side], l * (1 - kk)], [BONES['knee' + side], l * kk]];
      }
    }
    w = w.filter(([, x]) => x > 1e-4).slice(0, 4);
    const s = w.reduce((a, [, x]) => a + x, 0) || 1;
    for (let i = 0; i < 4; i++) { jo[v * 4 + i] = w[i] ? w[i][0] : 0; we[v * 4 + i] = w[i] ? w[i][1] / s : 0; }
  }
  geo.joints = jo; geo.weights = we;
  return geo;
}

// i vestiti prendono i pesi della pelle più vicina: si muovono esattamente come il corpo sotto
function transferWeights(geo, src) {
  const H = 0.02, grid = new Map(), key = (x, y, z) => `${Math.floor(x / H)},${Math.floor(y / H)},${Math.floor(z / H)}`;
  for (let v = 0; v < src.pos.length / 3; v++) { const k = key(src.pos[v * 3], src.pos[v * 3 + 1], src.pos[v * 3 + 2]); (grid.get(k) || grid.set(k, []).get(k)).push(v); }
  const n = geo.pos.length / 3, jo = new Float32Array(n * 4), we = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const x = geo.pos[v * 3], y = geo.pos[v * 3 + 1], z = geo.pos[v * 3 + 2];
    const cx = Math.floor(x / H), cy = Math.floor(y / H), cz = Math.floor(z / H);
    let best = -1, bd = Infinity;
    for (let r = 1; r <= 3 && best < 0; r++)
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        const L = grid.get(`${cx + i},${cy + j},${cz + k}`); if (!L) continue;
        for (const u of L) { const d = (src.pos[u * 3] - x) ** 2 + (src.pos[u * 3 + 1] - y) ** 2 + (src.pos[u * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = u; } }
      }
    if (best < 0) { we[v * 4] = 1; continue; }
    for (let i = 0; i < 4; i++) { jo[v * 4 + i] = src.joints[best * 4 + i]; we[v * 4 + i] = src.weights[best * 4 + i]; }
  }
  geo.joints = jo; geo.weights = we; return geo;
}

// ---------------- costruzione (con cache) ----------------
const CACHE = new Map();
const BOX = [[-0.4, -0.01, -0.17], [0.4, 1.62, 0.2]];
function build(key, f, box = BOX, h = 0.0075, R, J, opt = {}) {
  if (CACHE.has(key)) return CACHE.get(key);
  const g0 = surfaceNets(f, box[0], box[1], h);
  const g = opt.from ? transferWeights(g0, opt.from) : skinWeights(g0, R, J, opt);
  CACHE.set(key, g); return g;
}
export function bodyGeo(base) {
  const R = RIG[base], J = joints(R);
  return build('body' + base, (x, y, z) => {
    let d = torsoField(R, x, y, z);
    d = smin(d, Math.min(legField(R, J, 'L', x, y, z), legField(R, J, 'R', x, y, z)), 0.035);   // gambe separate tra loro
    const ka = 0.03 * ss(R.shoulder[1] - 0.13, R.shoulder[1] - 0.05, y);   // braccio e busto si fondono solo alla spalla
    for (const s of ['L', 'R']) d = smin(d, armField(R, J, s, x, y, z), ka);
    return d;
  }, BOX, 0.0085, R, J);
}
export function handsGeo(base) { // mani a risoluzione più fine
  const R = RIG[base], J = joints(R);
  const wl = J.wrL;
  return build('hands' + base, (x, y, z) => Math.min(handField(R, J, 'L', x, y, z), handField(R, J, 'R', x, y, z)),
    [[-Math.abs(wl[0]) - 0.11, wl[1] - 0.2, -0.05], [Math.abs(wl[0]) + 0.11, wl[1] + 0.05, 0.07]], 0.0024, R, J);
}
// vestiti aderenti: busto, gambe e maniche generati come pezzi separati (così non si "cuciono" tra loro)
// parts = { torso:[yMin,yMax], legs:yOrlo, arms:lunghezza manica (≥1 = intera) }, pad = spessore
export function garmentGeo(base, key, { torso = null, legs = null, arms = null, pad = 0.01, flare = 0 }) {
  const R = RIG[base], J = joints(R), out = [];
  if (torso) out.push(build('g' + base + key + 'T', (x, y, z) => {
    let d = torsoField(R, x, y, z);
    if (torso[1] > 1.3 && !arms) { // senza maniche: come il corpo: raccordo morbido busto-braccio alla spalla
      const ka = 0.03 * ss(R.shoulder[1] - 0.13, R.shoulder[1] - 0.05, y);
      for (const s of ['L', 'R']) d = smin(d, armField(R, J, s, x, y, z, 0.07), ka);
    }
    d = smax(d, smax(torso[0] - y, y - torso[1], 0.015), 0.015);
    if (legs !== null) { // pantaloni/shorts: bacino e gambe in un pezzo, gambe mai oltre la linea centrale
      let lm = 1e3;
      for (const s of ['L', 'R']) {
        const sx = s === 'L' ? -1 : 1;
        let ld = legField(R, J, s, x, y, z, { foot: false });
        if (flare) ld -= flare * Math.max(0, J['knee' + s][1] - 0.05 - y);
        if (y < R.hipY - 0.06) ld = smax(ld, 0.006 + pad - sx * x, 0.004);
        lm = Math.min(lm, smax(ld, legs - y, 0.008));   // le due gambe non si fondono mai
      }
      d = smin(d, lm, 0.03);
    }
    return d - pad;
  }, [[-0.32, legs !== null ? Math.max(-0.01, legs - 0.03) : torso[0] - 0.05, -0.17], [0.32, torso[1] + 0.06, 0.2]], legs !== null ? 0.0058 : 0.006, R, J, legs !== null ? { part: 'pants' } : { from: bodyGeo(base) }));
  if (arms) for (const s of ['L', 'R']) {
    const sx = s === 'L' ? -1 : 1, box = [[-0.4, 0.75, -0.13], [0.4, 1.45, 0.13]];
    const half = sx < 0 ? [[box[0][0], box[0][1], box[0][2]], [-0.02, box[1][1], box[1][2]]] : [[0.02, box[0][1], box[0][2]], [box[1][0], box[1][1], box[1][2]]];
    out.push(build('g' + base + key + 'arm' + s, (x, y, z) => {
      let d = armField(R, J, s, x, y, z, arms >= 1 ? 1 : arms);
      d = smin(d, ell(x, y, z, sx * (R.shoulder[0] - 0.012), R.shoulder[1] + 0.005, -0.004, 0.05, 0.042, 0.046), 0.04); // attacco della manica (come la spalla del corpo)
      { // la manica comincia alla spalla: niente lembi sotto l'ascella quando il braccio si alza
        const sh = J['sh' + s], wr = J['wr' + s], L = Math.hypot(wr[0] - sh[0], wr[1] - sh[1], wr[2] - sh[2]);
        const t = ((x - sh[0]) * (wr[0] - sh[0]) + (y - sh[1]) * (wr[1] - sh[1]) + (z - sh[2]) * (wr[2] - sh[2])) / L;
        d = smax(d, -0.06 - t, 0.01);
      }
      return d - pad;
    }, half, 0.0045, R, J, { part: 'sleeve', side: s }));
  }
  return out;
}
export function shoeGeo(base, type) {
  const R = RIG[base], J = joints(R);
  return build('shoe' + base + type, (x, y, z) => {
    let d = 1e3;
    for (const s of ['L', 'R']) {
      const a = J['ankle' + s], sx = a[0] > 0 ? 1 : -1;
      let f;
      if (type === 'sock') {
        f = smin(footField(a, x, y, z), cone(x, y, z, [a[0], 0.05, -0.004], [a[0], 0.15, 0.0], 0.025, 0.027), 0.02) - 0.003;
        f = smax(f, y - 0.13, 0.004);
      } else if (type === 'sole2') { // suola bianca della sneaker, con bordo arrotondato
        f = smin(ell(x, y, z, a[0] + sx * 0.002, 0.009, 0.05, 0.043, 0.011, 0.112), ell(x, y, z, a[0], 0.009, -0.01, 0.036, 0.011, 0.045), 0.02);
      } else {
        // tomaia: il piede "chiuso" in una forma di scarpa (dita unite, punta arrotondata)
        let shoe = ell(x, y, z, a[0], 0.032, 0.025, 0.031, 0.031, 0.07);
        shoe = smin(shoe, ell(x, y, z, a[0] + sx * 0.003, 0.022, 0.09, 0.034, 0.022, 0.048), 0.025);
        shoe = smin(shoe, ell(x, y, z, a[0], 0.036, -0.016, 0.028, 0.036, 0.032), 0.025);
        if (type === 'sho2') { f = smax(shoe - 0.011, y - (0.085 - 0.03 * Math.max(0, Math.min(1, (z - 0.02) / 0.09))), 0.01); f = smin(f, cone(x, y, z, [a[0], 0.058, 0.04], [a[0], 0.072, 0.0], 0.012, 0.012), 0.012); }
        else if (type === 'sho1') {
          f = smax(shoe - 0.006, y - (0.052 - 0.014 * Math.max(0, (z - 0.03) / 0.1)), 0.006);
          f = Math.min(f, cone(x, y, z, [a[0] - 0.034, 0.03, 0.03], [a[0] + 0.034, 0.045, 0.03], 0.0045, 0.0045));   // cinturino
        } else { // décolleté con tacchetto
          f = smax(shoe - 0.005, y - (0.048 - 0.022 * Math.max(0, (z - 0.02) / 0.1)), 0.006);
          f = smin(f, cone(x, y, z, [a[0], 0.0, -0.025], [a[0], 0.022, -0.02], 0.011, 0.015), 0.004);
        }
      }
      d = Math.min(d, f);
    }
    return d;
  }, [[-0.17, -0.01, -0.08], [0.17, 0.2, 0.19]], 0.0035, R, J);
}
// catalogo dei capi aderenti (usato dal worker per prepararli in anticipo)
export const GARMENTS = {
  tank: { torso: [1.1, 1.385], pad: 0.004 },
  briefs: { torso: [0.76, 0.93], legs: 0.79, pad: 0.004 },
  tee: { torso: [0.9, 1.385], arms: 0.13, pad: 0.011 },
  crop: { torso: [1.12, 1.385], arms: 0.12, pad: 0.006 },
  sweater: { torso: [0.88, 1.385], arms: 1, pad: 0.012 },
  gtop: { torso: [1.13, 1.37], arms: 1, pad: 0.009 },
  skirtTop: { torso: [0.95, 1.1], pad: 0.006 },
  jeans: { torso: [0.76, 1.05], legs: 0.1, pad: 0.006, flare: 0.05 },
  wide: { torso: [0.76, 1.05], legs: 0.1, pad: 0.012, flare: 0.03 },
  gshorts: { torso: [0.76, 1.06], legs: 0.67, pad: 0.008 },
  dre1: { torso: [0.98, 1.3], pad: 0.006 },
  dre2: { torso: [0.965, 1.3], pad: 0.007 },
  dre3: { torso: [0.965, 1.36], arms: 1, pad: 0.007 },
};
export function makeGeo(kind, base, id) {
  if (kind === 'body') return [bodyGeo(base)];
  if (kind === 'hands') return [handsGeo(base)];
  if (kind === 'shoe') return [shoeGeo(base, id)];
  return garmentGeo(base, id, GARMENTS[id]);
}
