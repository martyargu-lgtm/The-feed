// Esporta un Avatar3D in glTF binario (.glb) con scheletro e pesi, apribile in Blender.
import { M4 } from './m3d.js';

const BONE_NAMES = ['Torso', 'Coscia.R', 'Ginocchio.R', 'Coscia.L', 'Ginocchio.L', 'Spalla.R', 'Gomito.R', 'Spalla.L', 'Gomito.L'];
// nel gioco "L" è la x negativa = il lato destro del personaggio: in Blender .R / .L seguono il personaggio

function lin2srgb(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
function xf(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
function xfn(m, x, y, z) { const v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z]; const l = Math.hypot(...v) || 1; return v.map(a => a / l); }
// normali con l'inversa trasposta (scale non uniformi)
function normalMat(m) {
  const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
  const G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
  // matrice dei cofattori (= inversa trasposta a meno di un fattore)
  return [A, B, C, 0, D, E, F, 0, G, H, I, 0, 0, 0, 0, 1];
}

export async function exportAvatarGLB(av, name = 'Personaggio') {
  // posa di riposo: ossa senza rotazioni
  for (const b of av.bones) b.rotation = [0, 0, 0];
  av.root.position = [0, 0, 0]; av.root.rotation = [0, 0, 0]; av.root.scale = [1, 1, 1];
  av.root.update(null); av.rig.update(null);
  if (av.handNode) { av.arms[0].wr.parent && av.rig.update(null); av.handNode.matrix.set(av.arms[0].wr.world); av.root.update(null); }

  const chunks = [], bufferViews = [], accessors = [], meshes = [], nodes = [], materials = [], textures = [], images = [], samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
  let byteLen = 0;
  const push = (typed, target) => {
    const pad = (4 - (byteLen % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); byteLen += pad; }
    const u8 = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    chunks.push(u8.slice()); const bv = { buffer: 0, byteOffset: byteLen, byteLength: u8.byteLength }; if (target) bv.target = target;
    byteLen += u8.byteLength; bufferViews.push(bv); return bufferViews.length - 1;
  };
  const acc = (typed, type, compType, count, target, minmax, extra = {}) => {
    const a = { bufferView: push(typed, target), componentType: compType, count, type, ...extra };
    if (minmax) { const n = { VEC3: 3, VEC2: 2 }[type]; const mn = Array(n).fill(Infinity), mx = Array(n).fill(-Infinity); for (let i = 0; i < count; i++) for (let k = 0; k < n; k++) { const v = typed[i * n + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; } a.min = mn; a.max = mx; }
    accessors.push(a); return accessors.length - 1;
  };

  // --- scheletro ---
  const jointNodes = [];
  const rest = av.bones.map(b => b.rest);
  const parentIdx = [-1, 0, 1, 0, 3, 0, 5, 0, 7];
  av.bones.forEach((b, i) => {
    const p = parentIdx[i] < 0 ? [0, 0, 0] : rest[parentIdx[i]];
    nodes.push({ name: BONE_NAMES[i], translation: [rest[i][0] - p[0], rest[i][1] - p[1], rest[i][2] - p[2]], children: [] });
    jointNodes.push(nodes.length - 1);
  });
  // osso della testa (le parti rigide della testa sono legate a questo)
  const headWorld = av.head.world, headPos = [headWorld[12], headWorld[13] - 0.12, headWorld[14]];
  nodes.push({ name: 'Testa', translation: headPos, children: [] }); const headJ = nodes.length - 1;
  const allRest = [...rest, headPos];
  const allJoints = [...jointNodes, headJ];
  parentIdx.forEach((p, i) => { if (p >= 0) nodes[jointNodes[p]].children.push(jointNodes[i]); });
  nodes[jointNodes[0]].children.push(headJ);
  nodes[headJ].translation = headPos.map((v, k) => v - rest[0][k]);
  const ibm = new Float32Array(allJoints.length * 16);
  allRest.forEach((r, i) => { const m = M4.ident(); m[12] = -r[0]; m[13] = -r[1]; m[14] = -r[2]; ibm.set(m, i * 16); });
  const skin = { name: 'Scheletro', joints: allJoints, inverseBindMatrices: acc(ibm, 'MAT4', 5126, allJoints.length), skeleton: jointNodes[0] };

  // --- materiali ---
  const matIndex = new Map();
  const texIndex = new Map();
  const canvasTex = async (cv) => {
    if (texIndex.has(cv)) return texIndex.get(cv);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    images.push({ bufferView: push(bytes), mimeType: 'image/png', name: 'texture' + images.length });
    textures.push({ source: images.length - 1, sampler: 0 });
    texIndex.set(cv, textures.length - 1); return textures.length - 1;
  };
  const matFor = async (m, label) => {
    if (matIndex.has(m)) return matIndex.get(m);
    const c = m.color.map(lin2srgb).map(v => Math.pow(v, 2.2)); // fattore lineare
    const g = { name: label + '_' + (m.hex || '').replace('#', ''), pbrMetallicRoughness: { baseColorFactor: [...m.color, m.opacity], metallicFactor: 0, roughnessFactor: Math.min(1, Math.max(0.05, m.rough)) } };
    void c;
    if (m.map) g.pbrMetallicRoughness.baseColorTexture = { index: await canvasTex(m.map) };
    if (m.double) g.doubleSided = true;
    if (m.opacity < 1) g.alphaMode = 'BLEND';
    else if (m.map) g.alphaMode = 'MASK';
    materials.push(g); matIndex.set(m, materials.length - 1); return materials.length - 1;
  };

  // --- mesh: tutte cotte nello spazio del personaggio, una sola pelle ---
  const meshNodes = [];
  const isUnder = (n, anc) => { for (let p = n; p; p = p.parent) if (p === anc) return true; return false; };
  const walk = async (n) => {
    if (!n.visible) return;
    if (n.mesh) {
      const geo = n.mesh.geo, m = n.world, nm = normalMat(m), vc = geo.pos.length / 3;
      const pos = new Float32Array(vc * 3), nrm = new Float32Array(vc * 3);
      for (let i = 0; i < vc; i++) {
        pos.set(xf(m, geo.pos[i * 3], geo.pos[i * 3 + 1], geo.pos[i * 3 + 2]), i * 3);
        nrm.set(xfn(nm, geo.nrm[i * 3], geo.nrm[i * 3 + 1], geo.nrm[i * 3 + 2]), i * 3);
      }
      const jo = new Uint16Array(vc * 4), we = new Float32Array(vc * 4);
      if (n.mesh.bones && geo.joints) {
        for (let i = 0; i < vc * 4; i++) { jo[i] = geo.joints[i]; we[i] = geo.weights[i]; }
        for (let i = 0; i < vc; i++) { const s = we[i * 4] + we[i * 4 + 1] + we[i * 4 + 2] + we[i * 4 + 3] || 1; for (let k = 0; k < 4; k++) we[i * 4 + k] /= s; if (we[i * 4] + we[i * 4 + 1] + we[i * 4 + 2] + we[i * 4 + 3] === 0) we[i * 4] = 1; }
      } else {
        const j = isUnder(n, av.head) ? allJoints.length - 1 : (av.handNode && isUnder(n, av.handNode)) ? 6 : 0;
        for (let i = 0; i < vc; i++) { jo[i * 4] = j; we[i * 4] = 1; }
      }
      // glTF vuole i triangoli in senso antiorario: se la matrice ribalta, inverti
      const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
      const idx = new Uint32Array(geo.idx);
      if (det < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      const attributes = { POSITION: acc(pos, 'VEC3', 5126, vc, 34962, true), NORMAL: acc(nrm, 'VEC3', 5126, vc, 34962), JOINTS_0: acc(jo, 'VEC4', 5123, vc, 34962), WEIGHTS_0: acc(we, 'VEC4', 5126, vc, 34962) };
      if (geo.uv) { const uv = new Float32Array(geo.uv); for (let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i]; attributes.TEXCOORD_0 = acc(uv, 'VEC2', 5126, vc, 34962); }
      const label = n.mesh.bones ? 'Corpo' : isUnder(n, av.head) ? 'Testa' : 'Dettaglio';
      meshes.push({ name: label + meshes.length, primitives: [{ attributes, indices: acc(idx, 'SCALAR', 5125, idx.length, 34963), material: await matFor(n.mesh.mat, label) }] });
      nodes.push({ name: label + '_' + meshes.length, mesh: meshes.length - 1, skin: 0 }); meshNodes.push(nodes.length - 1);
    }
    for (const c of n.children) await walk(c);
  };
  await walk(av.root);

  nodes.push({ name, children: [jointNodes[0], ...meshNodes] });
  const rootIdx = nodes.length - 1;
  const gltf = {
    asset: { version: '2.0', generator: 'Clean Girl – esportatore avatar' },
    scene: 0, scenes: [{ name, nodes: [rootIdx] }], nodes, meshes, materials, skins: [skin], accessors, bufferViews,
    buffers: [{ byteLength: 0 }],
  };
  if (images.length) { gltf.images = images; gltf.textures = textures; gltf.samplers = samplers; }
  const pad = (4 - (byteLen % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); byteLen += pad; }
  gltf.buffers[0].byteLength = byteLen;
  let json = new TextEncoder().encode(JSON.stringify(gltf));
  const jp = (4 - (json.length % 4)) % 4; if (jp) { const j2 = new Uint8Array(json.length + jp).fill(0x20); j2.set(json); json = j2; }
  const total = 12 + 8 + json.length + 8 + byteLen, out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, json.length, true); dv.setUint32(16, 0x4E4F534A, true); out.set(json, 20);
  let o = 20 + json.length; dv.setUint32(o, byteLen, true); dv.setUint32(o + 4, 0x004E4942, true); o += 8;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
