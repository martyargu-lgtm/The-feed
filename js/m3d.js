// m3d – piccolo motore 3D WebGL2 del gioco (nessuna libreria esterna).
// Gerarchia di nodi, materiali "argilla" morbidi, luce emisferica + luce principale con ombre morbide,
// texture da canvas (volto disegnato), costruttori di geometrie (sfera deformabile, tornio, tubi, ecc.).

// ---------------- matematica ----------------
export const M4 = {
  ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b, o = new Float32Array(16)) {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  },
  ortho(l, r, b, t, n, f) {
    const m = M4.ident();
    m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); return m;
  },
  lookAt(e, c, up = [0, 1, 0]) {
    let z = norm(sub(e, c)), x = norm(cross(up, z)), y = cross(z, x);
    const m = M4.ident();
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
    m[12] = -dot(x, e); m[13] = -dot(y, e); m[14] = -dot(z, e); return m;
  },
  // T * Rz * Ry * Rx * S  (ordine di rotazione XYZ come three.js)
  compose(p, r, s, o = new Float32Array(16)) {
    const [x, y, z] = r, cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    const ae = cx * cz, af = cx * sz, be = sx * cz, bf = sx * sz;
    o[0] = cy * cz * s[0]; o[4] = -cy * sz * s[1]; o[8] = sy * s[2];
    o[1] = (af + be * sy) * s[0]; o[5] = (ae - bf * sy) * s[1]; o[9] = -sx * cy * s[2];
    o[2] = (bf - ae * sy) * s[0]; o[6] = (be + af * sy) * s[1]; o[10] = cx * cy * s[2];
    o[3] = o[7] = o[11] = 0; o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1; return o;
  },
  normalMat(m) { // inversa trasposta 3x3
    const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C || 1e-9;
    return new Float32Array([A / det, B / det, C / det, -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det, (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det]);
  },
  apply(m, v) { return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]; },
};
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a, b, t) => a + (b - a) * t;

export function hexLin(h) { // colore sRGB esadecimale → lineare
  const n = parseInt(h.replace('#', ''), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => Math.pow(v / 255, 2.2));
}

// ---------------- scena ----------------
export class Node {
  constructor(mesh = null) {
    this.position = [0, 0, 0]; this.rotation = [0, 0, 0]; this.scale = [1, 1, 1];
    this.children = []; this.mesh = mesh; this.visible = true; this.parent = null;
    this.local = new Float32Array(16); this.world = M4.ident();
  }
  add(...n) { for (const c of n) { c.parent = this; this.children.push(c); } return this; }
  remove(n) { this.children = this.children.filter(c => c !== n); }
  clear() { this.children = []; }
  at(x, y, z) { this.position = [x, y, z]; return this; }
  rot(x, y, z) { this.rotation = [x, y, z]; return this; }
  sc(x, y = x, z = x) { this.scale = [x, y, z]; return this; }
  update(parent) {
    if (this.matrix) this.local.set(this.matrix); else M4.compose(this.position, this.rotation, this.scale, this.local);
    if (parent) M4.mul(parent, this.local, this.world); else this.world.set(this.local);
    for (const c of this.children) c.update(this.world);
  }
}
export class Mesh { constructor(geo, mat) { this.geo = geo; this.mat = mat; this.castShadow = true; this.bones = null; } }
export const mesh = (geo, mat, cast = true) => { const m = new Mesh(geo, mat); m.castShadow = cast; return new Node(m); };

export class Material {
  constructor(color = '#ffffff', o = {}) {
    this.color = hexLin(color); this.hex = color;
    this.map = o.map || null; this.double = !!o.double; this.opacity = o.opacity ?? 1;
    this.rough = o.rough ?? 0.75; this.unlit = !!o.unlit; this.offset = o.offset || 0;
    this.spec = o.spec ?? 0.04; this.shin = o.shin ?? 24; this.sss = o.sss ?? 0;
  }
}
const matCache = new Map();
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!o.map && matCache.has(k)) return matCache.get(k);
  const m = new Material(color, o); if (!o.map) matCache.set(k, m); return m;
}

// ---------------- geometrie ----------------
let GID = 0;
export class Geometry {
  constructor(pos, nrm, uv, idx) { this.pos = new Float32Array(pos); this.nrm = new Float32Array(nrm); this.uv = uv ? new Float32Array(uv) : null; this.idx = new Uint32Array(idx); this.id = GID++; }
  static computeNormals(pos, idx) {
    const n = new Float32Array(pos.length);
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
      const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
      const f = cross(e1, e2);
      for (const v of [a, b, c]) { n[v] += f[0]; n[v + 1] += f[1]; n[v + 2] += f[2]; }
    }
    for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
    return n;
  }
}
// griglia (u,v) → punto: base per quasi tutte le forme; weld unisce la cucitura per normali lisce
function gridGeo(nu, nv, fn, { closeU = false, weldPoles = false } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = fn(i / nu, j / nv); pos.push(p[0], p[1], p[2]); uv.push(i / nu, 1 - j / nv);
  }
  const W = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  let nrm = Geometry.computeNormals(pos, idx);
  if (closeU) { // media delle normali sulla cucitura
    for (let j = 0; j <= nv; j++) {
      const a = j * W * 3, b = (j * W + nu) * 3;
      for (let k = 0; k < 3; k++) { const m = (nrm[a + k] + nrm[b + k]) / 2; nrm[a + k] = nrm[b + k] = m; }
    }
  }
  if (weldPoles) {
    for (const j of [0, nv]) {
      let s = [0, 0, 0];
      for (let i = 0; i <= nu; i++) { const o = (j * W + i) * 3; s = add(s, [nrm[o], nrm[o + 1], nrm[o + 2]]); }
      s = norm(s);
      for (let i = 0; i <= nu; i++) { const o = (j * W + i) * 3; nrm[o] = s[0]; nrm[o + 1] = s[1]; nrm[o + 2] = s[2]; }
    }
  }
  return new Geometry(pos, nrm, uv, idx);
}
// sfera (u: giro, 0 = davanti +z verso destra; v: dall'alto in basso); deform(p, dir) → nuovo punto
export function sphere(nu = 32, nv = 20, deform = null, phase = 0) {
  return gridGeo(nu, nv, (u, v) => {
    const th = v * Math.PI, ph = u * Math.PI * 2 + phase;
    const d = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
    return deform ? deform(d.slice(), d) : d;
  }, { closeU: true, weldPoles: true });
}
// calotta sferica (0..thetaMax dall'asse +y): palpebre
export function sphereCap(thetaMax, nu = 32, nv = 12) {
  return gridGeo(nu, nv, (u, v) => {
    const th = v * thetaMax, ph = u * Math.PI * 2;
    return [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
  }, { closeU: true });
}
// tornio: profilo [[r, y], ...] dal basso all'alto, sezione ellittica (zs) e spostamento in avanti (zo)
export function lathe(profile, segs = 32, { zs = 1, zo = null, xo = null } = {}) {
  const n = profile.length - 1;
  return gridGeo(segs, n, (u, v) => {
    const k = Math.round(v * n), [r, y] = profile[n - k];
    const ph = u * Math.PI * 2;
    return [r * Math.sin(ph) + (xo ? xo(y) : 0), y, r * Math.cos(ph) * zs + (zo ? zo(y, Math.cos(ph)) : 0)];
  }, { closeU: true, weldPoles: true });
}
// sezioni libere: rings = [{y, rx, rzF, rzB, x, z}] → superficie (sezioni ovali asimmetriche avanti/dietro)
export function rings(list, segs = 40, { capTop = true, capBot = true } = {}) {
  const L = list.slice();
  if (capBot) L.unshift({ ...L[0], rx: 0.0001, rzF: 0.0001, rzB: 0.0001, y: L[0].y - 0.0001 });
  if (capTop) L.push({ ...L[L.length - 1], rx: 0.0001, rzF: 0.0001, rzB: 0.0001, y: L[L.length - 1].y + 0.0001 });
  const n = L.length - 1;
  return gridGeo(segs, n, (u, v) => {
    const R = L[n - Math.round(v * n)], ph = u * Math.PI * 2;
    const c = Math.cos(ph), s = Math.sin(ph);
    return [(R.x || 0) + R.rx * s, R.y, (R.z || 0) + (c > 0 ? R.rzF : R.rzB) * c];
  }, { closeU: true, weldPoles: true });
}
// tubo lungo una polilinea (con raggio variabile) e tappi arrotondati
export function tube(points, radius, radial = 12, steps = null) {
  const P = catmull(points, steps || points.length * 8);
  const N = P.length - 1;
  const rf = typeof radius === 'function' ? radius : () => radius;
  const frames = []; let prevN = null;
  for (let i = 0; i <= N; i++) {
    const t = norm(sub(P[Math.min(N, i + 1)], P[Math.max(0, i - 1)]));
    let nn = prevN ? norm(sub(prevN, scl(t, dot(prevN, t)))) : norm(Math.abs(t[1]) < 0.9 ? cross(t, [0, 1, 0]) : cross(t, [1, 0, 0]));
    prevN = nn; frames.push([nn, cross(t, nn)]);
  }
  return gridGeo(radial, N, (u, v) => {
    const i = Math.round(v * N), [nn, bb] = frames[i], a = u * Math.PI * 2;
    const r = rf(i / N) * (i === 0 || i === N ? 0.0001 : 1);
    return add(P[i], add(scl(nn, Math.cos(a) * r), scl(bb, Math.sin(a) * r)));
  }, { closeU: true });
}
export function catmull(pts, n) {
  if (pts.length < 3) { const o = []; for (let i = 0; i <= n; i++) o.push(add(pts[0], scl(sub(pts[1], pts[0]), i / n))); return o; }
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(t)), f = t - k;
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
    const f2 = f * f, f3 = f2 * f;
    out.push([0, 1, 2].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * f3)));
  }
  return out;
}
export function torus(R, r, nu = 32, nv = 10, arc = Math.PI * 2) {
  return gridGeo(nu, nv, (u, v) => {
    const a = u * arc, b = v * Math.PI * 2;
    return [(R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a)];
  }, { closeU: arc >= Math.PI * 2 - 1e-6 });
}
// parallelepipedo arrotondato (superellissoide): mobili morbidi
export function rbox(w, h, d, round = 0.25, seg = 16) {
  const e = Math.max(0.08, round);
  const sp = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);
  return gridGeo(seg * 2, seg, (u, v) => {
    const th = (v - 0.5) * Math.PI, ph = u * Math.PI * 2;
    const ct = Math.cos(th), st = Math.sin(th);
    return [w / 2 * sp(ct, e) * sp(Math.sin(ph), e), h / 2 * sp(-st, e), d / 2 * sp(ct, e) * sp(Math.cos(ph), e)];
  }, { closeU: true, weldPoles: true });
}
export function cylinder(rt, rb, h, segs = 24, caps = true) {
  const prof = caps ? [[0, 0], [rb, 0], [rb, 0], [rt, h], [rt, h], [0, h]] : [[rb, 0], [rt, h]];
  return lathe(prof, segs);
}
export function plane(w, d) { return new Geometry([-w / 2, 0, -d / 2, w / 2, 0, -d / 2, -w / 2, 0, d / 2, w / 2, 0, d / 2], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 1, 1, 1, 0, 0, 1, 0], [0, 2, 1, 1, 2, 3]); }
export function disc(r, segs = 40) {
  const pos = [0, 0, 0], nrm = [0, 1, 0], idx = [];
  for (let i = 0; i <= segs; i++) { const a = i / segs * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); nrm.push(0, 1, 0); if (i) idx.push(0, i + 1, i); }
  return new Geometry(pos, nrm, null, idx);
}

// ---------------- camera ----------------
export class Camera {
  constructor(fov = 40, near = 0.05, far = 60) { this.fov = fov; this.near = near; this.far = far; this.position = [0, 1.5, 4]; this.target = [0, 1, 0]; this.shiftX = 0; this.shiftY = 0; }
  matrices(aspect) {
    const p = M4.persp(this.fov * Math.PI / 180, aspect, this.near, this.far);
    p[8] += this.shiftX; p[9] += this.shiftY; // spostamento dell'inquadratura (soggetto decentrato)
    const v = M4.lookAt(this.position, this.target);
    return { proj: p, view: v, vp: M4.mul(p, v) };
  }
}

// ---------------- renderer ----------------
const SKIN_GLSL = `in vec4 aJ; in vec4 aW; uniform mat4 uBones[12]; uniform bool uSkinned;
mat4 skinMat(){ if(!uSkinned) return mat4(1.0); return uBones[int(aJ.x)]*aW.x + uBones[int(aJ.y)]*aW.y + uBones[int(aJ.z)]*aW.z + uBones[int(aJ.w)]*aW.w; }`;
const VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in vec2 aUv;
uniform mat4 uVP, uModel, uShadowVP; uniform mat3 uNrmM;
${SKIN_GLSL}
out vec3 vN; out vec3 vW; out vec2 vUv; out vec4 vSh;
void main(){ mat4 S = skinMat(); vec4 w = uModel*(S*vec4(aPos,1.0)); vW=w.xyz; vN=normalize(uNrmM*(mat3(S)*aNrm)); vUv=aUv; vSh=uShadowVP*w; gl_Position=uVP*w; }`;
const FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vN; in vec3 vW; in vec2 vUv; in vec4 vSh;
uniform vec3 uColor; uniform float uOpacity; uniform bool uHasMap; uniform sampler2D uMap; uniform bool uUnlit; uniform float uSpec, uShin, uSSS;
uniform vec3 uSky, uGround, uKeyDir, uKeyCol, uFillDir, uFillCol, uCam; uniform float uWrap;
uniform sampler2DShadow uShadow; uniform bool uUseShadow; uniform float uShadowTexel;
out vec4 frag;
float shadow(){
  if(!uUseShadow) return 1.0;
  vec3 p = vSh.xyz/vSh.w*0.5+0.5;
  if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0||p.z>1.0) return 1.0;
  float s=0.0; for(int x=-2;x<=2;x++) for(int y=-2;y<=2;y++) s+=texture(uShadow, vec3(p.xy+vec2(x,y)*uShadowTexel*1.5, p.z-0.0015));
  return s/25.0;
}
void main(){
  vec3 base = uColor; float a = uOpacity;
  if(uHasMap){ vec4 t=texture(uMap,vUv); base*=t.rgb; a*=t.a; }
  if(uUnlit){ frag=vec4(pow(base,vec3(1.0/2.2)),a); return; }
  vec3 N = normalize(vN); if(!gl_FrontFacing) N=-N;
  vec3 V = normalize(uCam - vW);
  vec3 amb = mix(uGround, uSky, N.y*0.5+0.5);
  float k = max(0.0,(dot(N,uKeyDir)+uWrap)/(1.0+uWrap));
  float f = max(0.0,(dot(N,uFillDir)+0.5)/1.5);
  float sh = mix(0.55,1.0,shadow());
  vec3 light = amb + uKeyCol*k*sh + uFillCol*f;
  float rim = pow(1.0-max(0.0,dot(N,V)),3.0)*0.12;
  vec3 c = base*light + rim*vec3(1.0,0.96,0.95)*base;
  // pelle: luce che "filtra" calda nella zona d'ombra (effetto cartone 3D)
  float term = max(0.0, 1.0 - abs(dot(N,uKeyDir)) * 1.6);
  c += base*uSSS*(0.10*term*vec3(1.0,0.45,0.35) + 0.06*vec3(1.0,0.55,0.5));
  float spec = pow(max(0.0,dot(N,normalize(uKeyDir+V))),uShin)*uSpec*sh;
  c += spec*vec3(1.0,0.97,0.94);
  frag = vec4(pow(c,vec3(1.0/2.2)),a);
}`;
const SVS = `#version 300 es
in vec3 aPos; uniform mat4 uVP, uModel; ${SKIN_GLSL}
void main(){ gl_Position=uVP*uModel*(skinMat()*vec4(aPos,1.0)); }`;
const SFS = `#version 300 es
precision mediump float; out vec4 f; void main(){ f=vec4(1.0); }`;

export class Renderer {
  constructor(canvas, { alpha = false, clear = '#faedea', shadowSize = 2048 } = {}) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 non disponibile');
    this.gl = gl; this.canvas = canvas; this.alpha = alpha;
    this.clear = alpha ? [0, 0, 0, 0] : [...hexLin(clear).map(v => Math.pow(v, 1 / 2.2)), 1];
    this.prog = this.program(VS, FS); this.sprog = this.program(SVS, SFS);
    this.bufs = new Map(); this.texs = new Map();
    this.lights = { sky: hexLin('#ffffff').map(v => v * 0.62), ground: hexLin('#e9d2c9').map(v => v * 0.5), key: norm([0.45, 0.85, 0.6]), keyCol: [0.62, 0.6, 0.57], fill: norm([-0.7, 0.3, 0.6]), fillCol: [0.1, 0.09, 0.1], wrap: 0.35 };
    // ombre
    this.shadowSize = shadowSize;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, shadowSize, shadowSize);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    this.shadowFB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.shadowBox = { center: [0, 1, 0], size: 2.5 }; this.shadows = true;
    // texture neutra 1×1: evita che un'unità senza texture blocchi i disegni
    this.white = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.white);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  }
  program(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh);
    }
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aNrm'); gl.bindAttribLocation(p, 2, 'aUv'); gl.bindAttribLocation(p, 3, 'aJ'); gl.bindAttribLocation(p, 4, 'aW');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  setSize(w, h, pr = 1) { this.canvas.width = Math.round(w * pr); this.canvas.height = Math.round(h * pr); this.w = w; this.h = h; }
  vao(g) {
    let b = this.bufs.get(g); if (b) return b;
    const gl = this.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const put = (loc, data, size) => { const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    put(0, g.pos, 3); put(1, g.nrm, 3);
    if (g.uv) put(2, g.uv, 2); else { gl.disableVertexAttribArray(2); gl.vertexAttrib2f(2, 0, 0); }
    if (g.joints) { put(3, g.joints, 4); put(4, g.weights, 4); } else { gl.disableVertexAttribArray(3); gl.disableVertexAttribArray(4); }
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    b = { vao, n: g.idx.length }; this.bufs.set(g, b); return b;
  }
  tex(canvas) {
    const gl = this.gl; let t = this.texs.get(canvas);
    if (!t) { t = { tex: gl.createTexture(), ver: -1 }; this.texs.set(canvas, t); }
    if (t.ver !== (canvas._ver || 0)) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
      t.ver = canvas._ver || 0;
    }
    return t.tex;
  }
  setSkin(u, m) {
    const gl = this.gl, on = !!(m.bones && m.geo.joints);
    gl.uniform1i(u.uSkinned, on ? 1 : 0);
    if (on) gl.uniformMatrix4fv(u['uBones[0]'], false, m.bones);
  }
  collect(root) {
    const list = [];
    const walk = (n) => { if (!n.visible) return; if (n.mesh) list.push(n); n.children.forEach(walk); };
    root.update(); walk(root); return list;
  }
  render(root, cam) {
    const gl = this.gl, list = this.collect(root);
    // ---- passaggio ombre ----
    const L = this.lights, sb = this.shadowBox;
    const lpos = add(sb.center, scl(L.key, sb.size * 2));
    const shadowVP = M4.mul(M4.ortho(-sb.size, sb.size, -sb.size, sb.size, 0.1, sb.size * 4), M4.lookAt(lpos, sb.center, Math.abs(L.key[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0]));
    if (this.shadows) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.useProgram(this.sprog.p); gl.uniformMatrix4fv(this.sprog.u.uVP, false, shadowVP);
      for (const n of list) { if (!n.mesh.castShadow || n.mesh.mat.opacity < 1) continue; const b = this.vao(n.mesh.geo); gl.bindVertexArray(b.vao); gl.uniformMatrix4fv(this.sprog.u.uModel, false, n.world); this.setSkin(this.sprog.u, n.mesh); gl.drawElements(gl.TRIANGLES, b.n, gl.UNSIGNED_INT, 0); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // ---- passaggio principale ----
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(...this.clear); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    const P = this.prog, u = P.u; gl.useProgram(P.p);
    const { vp } = cam.matrices(this.canvas.width / this.canvas.height);
    gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniformMatrix4fv(u.uShadowVP, false, shadowVP);
    gl.uniform3fv(u.uSky, L.sky); gl.uniform3fv(u.uGround, L.ground); gl.uniform3fv(u.uKeyDir, L.key); gl.uniform3fv(u.uKeyCol, L.keyCol);
    gl.uniform3fv(u.uFillDir, L.fill); gl.uniform3fv(u.uFillCol, L.fillCol); gl.uniform1f(u.uWrap, L.wrap); gl.uniform3fv(u.uCam, cam.position);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex); gl.uniform1i(u.uShadow, 1);
    gl.uniform1i(u.uUseShadow, this.shadows ? 1 : 0); gl.uniform1f(u.uShadowTexel, 1 / this.shadowSize);
    gl.uniform1i(u.uMap, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.white);
    const opaque = list.filter(n => n.mesh.mat.opacity >= 1), trans = list.filter(n => n.mesh.mat.opacity < 1);
    const draw = (n) => {
      const m = n.mesh.mat, b = this.vao(n.mesh.geo);
      if (m.double) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
      if (m.offset) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(m.offset, m.offset); } else gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.uniformMatrix4fv(u.uModel, false, n.world); gl.uniformMatrix3fv(u.uNrmM, false, M4.normalMat(n.world)); this.setSkin(u, n.mesh);
      gl.uniform3fv(u.uColor, m.color); gl.uniform1f(u.uOpacity, m.opacity); gl.uniform1i(u.uUnlit, m.unlit ? 1 : 0);
      gl.uniform1f(u.uSpec, m.spec); gl.uniform1f(u.uShin, m.shin); gl.uniform1f(u.uSSS, m.sss);
      gl.activeTexture(gl.TEXTURE0);
      if (m.map) { gl.bindTexture(gl.TEXTURE_2D, this.tex(m.map)); gl.uniform1i(u.uHasMap, 1); } else { gl.bindTexture(gl.TEXTURE_2D, this.white); gl.uniform1i(u.uHasMap, 0); }
      gl.bindVertexArray(b.vao); gl.drawElements(gl.TRIANGLES, b.n, gl.UNSIGNED_INT, 0);
    };
    gl.disable(gl.BLEND); opaque.forEach(draw);
    if (trans.length) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); trans.forEach(draw); gl.depthMask(true); gl.disable(gl.BLEND); }
    gl.bindVertexArray(null);
  }
}
