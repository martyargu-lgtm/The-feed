// Ambienti 3D (motore m3d), telecamera in terza persona, collisioni e oggetti interattivi.
import { Node, mesh, mat, rbox, plane, cylinder, sphere, disc, torus } from './m3d.js';

// ---------- Camera della protagonista ----------
export function buildBedroom() {
  const root = new Node();
  const W = 3.6, D = 3.0, H = 2.75;
  const colliders = [];
  const solid = (x, z, w, d) => colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const box = (w, h, d, col, r = 0.12) => mesh(rbox(w, h, d, r), mat(col));
  const put = (n, x, y, z) => { n.at(x, y, z); root.add(n); return n; };

  // pavimento, listelli e pareti
  put(mesh(plane(W * 2, D * 2), mat('#ecd6c1'), false), 0, 0, 0);
  for (let i = -6; i <= 6; i++) put(mesh(plane(0.012, D * 2), mat('#dec4ac'), false), i * 0.55, 0.002, 0);
  const wall = mat('#f6e4de');
  put(mesh(rbox(W * 2 + 0.2, H, 0.12, 0.08), wall, false), 0, H / 2, -D - 0.06);
  put(mesh(rbox(W * 2 + 0.2, H, 0.12, 0.08), wall, false), 0, H / 2, D + 0.06);
  put(mesh(rbox(0.12, H, D * 2 + 0.2, 0.08), wall, false), -W - 0.06, H / 2, 0);
  put(mesh(rbox(0.12, H, D * 2 + 0.2, 0.08), wall, false), W + 0.06, H / 2, 0);
  const sk = mat('#fffaf6');
  put(mesh(rbox(W * 2, 0.1, 0.03, 0.2), sk, false), 0, 0.05, -D + 0.015); put(mesh(rbox(W * 2, 0.1, 0.03, 0.2), sk, false), 0, 0.05, D - 0.015);
  put(mesh(rbox(0.03, 0.1, D * 2, 0.2), sk, false), -W + 0.015, 0.05, 0); put(mesh(rbox(0.03, 0.1, D * 2, 0.2), sk, false), W - 0.015, 0.05, 0);

  // finestra con tende (parete di fondo)
  const win = put(new Node(), 0.9, 1.55, -D + 0.04);
  win.add(box(1.5, 1.25, 0.08, '#ffffff', 0.1));
  win.add(mesh(rbox(1.32, 1.08, 0.02, 0.1), mat('#cfe6f2')).at(0, 0, 0.04));
  win.add(box(0.05, 1.1, 0.05, '#ffffff', 0.3).at(0, 0, 0.06)); win.add(box(1.34, 0.05, 0.05, '#ffffff', 0.3).at(0, 0.1, 0.06));
  for (const sx of [-1, 1]) win.add(box(0.36, 1.75, 0.09, '#fbf3ee', 0.35).at(sx * 0.95, -0.12, 0.12));
  win.add(box(2.4, 0.04, 0.04, '#d9b98c', 0.4).at(0, 0.8, 0.15));

  // letto
  const bx = -2.15, bz = -1.85, bed = put(new Node(), bx, 0, bz);
  bed.add(box(1.75, 0.32, 2.15, '#e2c4a6', 0.12).at(0, 0.2, 0));
  bed.add(box(1.62, 0.2, 2.0, '#fdf9f6', 0.25).at(0, 0.45, 0));
  bed.add(box(1.7, 0.14, 1.35, '#f5d2cf', 0.25).at(0, 0.56, 0.36));
  bed.add(box(1.72, 0.1, 0.22, '#fdf9f6', 0.35).at(0, 0.62, -0.3));
  for (const sx of [-1, 1]) bed.add(box(0.62, 0.17, 0.38, sx < 0 ? '#ffffff' : '#f7dcd8', 0.5).at(sx * 0.38, 0.64, -0.72).rot(-0.25, 0, 0));
  bed.add(box(1.8, 1.0, 0.12, '#e8cdb2', 0.12).at(0, 0.7, -1.05));
  solid(bx, bz, 1.8, 2.25);

  // comodino + lampada
  const ns = put(new Node(), -0.95, 0, -2.7);
  ns.add(box(0.5, 0.52, 0.42, '#efd9c3', 0.15).at(0, 0.26, 0));
  ns.add(mesh(sphere(10, 8), mat('#c9a77d')).at(0, 0.32, 0.22).sc(0.02));
  ns.add(mesh(cylinder(0.06, 0.08, 0.2, 16), mat('#ffffff')).at(0, 0.52, 0));
  ns.add(mesh(cylinder(0.1, 0.17, 0.2, 20, false), mat('#fff1e2', { double: true })).at(0, 0.72, 0));
  solid(-0.95, -2.7, 0.55, 0.5);

  // scrivania con laptop, telefono, pianta
  const desk = put(new Node(), -3.18, 0, 1.15);
  desk.add(box(0.72, 0.05, 1.45, '#f3e6d8', 0.2).at(0, 0.76, 0));
  for (const [dx, dz] of [[-0.3, -0.66], [0.3, -0.66], [-0.3, 0.66], [0.3, 0.66]]) desk.add(mesh(cylinder(0.022, 0.022, 0.74, 10), mat('#d6b48f')).at(dx, 0, dz));
  desk.add(box(0.32, 0.02, 0.24, '#d8d8dc', 0.3).at(0.05, 0.79, 0.05));
  desk.add(box(0.015, 0.22, 0.32, '#d8d8dc', 0.3).at(-0.08, 0.9, 0.05).rot(0, 0, 0.2));
  desk.add(box(0.08, 0.012, 0.15, '#f2b9c6', 0.3).at(0.15, 0.79, -0.35));
  desk.add(mesh(cylinder(0.09, 0.07, 0.16, 16), mat('#e9b49b')).at(-0.12, 0.78, -0.52));
  for (let i = 0; i < 6; i++) desk.add(mesh(sphere(12, 10), mat(i % 2 ? '#8db08a' : '#a3c49b')).at(-0.12 + Math.cos(i) * 0.06, 1.0 + (i % 3) * 0.05, -0.52 + Math.sin(i) * 0.06).sc(0.07, 0.1, 0.05));
  desk.add(mesh(cylinder(0.035, 0.03, 0.09, 14), mat('#ffffff')).at(0.2, 0.78, 0.45));
  solid(-3.18, 1.15, 0.78, 1.5);
  const chair = put(new Node(), -2.5, 0, 1.15);
  chair.add(box(0.46, 0.06, 0.46, '#ffffff', 0.3).at(0, 0.46, 0)); chair.add(box(0.06, 0.5, 0.46, '#ffffff', 0.3).at(0.22, 0.74, 0));
  for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) chair.add(mesh(cylinder(0.018, 0.018, 0.44, 8), mat('#d6b48f')).at(dx, 0, dz));
  solid(-2.5, 1.15, 0.48, 0.48);
  put(box(0.25, 0.04, 1.2, '#e2c4a6', 0.3), -3.47, 1.55, 1.15);
  ['#f2b9c6', '#c9d8e6', '#f6e3b5', '#bfd6b8', '#ffffff', '#e8c3d9'].forEach((c, i) => put(box(0.18, 0.22 + (i % 3) * 0.04, 0.06, c, 0.2), -3.47, 1.69 + (i % 3) * 0.02, 0.7 + i * 0.09));

  // armadio
  const wr = put(new Node(), 2.85, 0, -2.62);
  wr.add(box(1.25, 2.15, 0.62, '#f3e6d8', 0.08).at(0, 1.075, 0));
  wr.add(box(0.012, 2.0, 0.01, '#dcc8b4', 0.3).at(0, 1.08, 0.315));
  for (const sx of [-1, 1]) wr.add(box(0.025, 0.25, 0.03, '#c9a77d', 0.4).at(sx * 0.07, 1.1, 0.33));
  solid(2.85, -2.62, 1.3, 0.7);

  // specchio a figura intera
  const mir = put(new Node(), W - 0.06, 1.05, -0.3);
  mir.add(box(0.07, 1.75, 0.72, '#e3c290', 0.3));
  mir.add(mesh(rbox(0.02, 1.6, 0.6, 0.3), mat('#e3eff3')).at(-0.035, 0, 0));
  solid(W - 0.1, -0.3, 0.2, 0.75);

  // tappeto, pouf, pianta grande, quadri, porta
  put(mesh(disc(1.35, 64), mat('#f6cfcd'), false), 0.2, 0.006, 0.35);
  put(mesh(torus(1.18, 0.035, 64, 6), mat('#fbe3e1'), false), 0.2, 0.006, 0.35).sc(1, 0.2, 1);
  put(mesh(sphere(24, 16), mat('#fdf6ef')), 1.2, 0.2, 1.3).sc(0.34, 0.21, 0.34); solid(1.2, 1.3, 0.6, 0.6);
  put(mesh(cylinder(0.22, 0.17, 0.42, 18), mat('#f3e6d8')), 3.1, 0, 2.5);
  for (let i = 0; i < 9; i++) put(mesh(sphere(12, 10), mat(i % 2 ? '#8db08a' : '#a3c49b')), 3.1 + Math.cos(i * 0.7) * 0.18, 0.75 + (i % 3) * 0.18, 2.5 + Math.sin(i * 0.7) * 0.18).sc(0.1, 0.26, 0.1).rot(0, 0, Math.cos(i) * 0.5);
  solid(3.1, 2.5, 0.5, 0.5);
  [[-2.6, 1.85, '#f6e3b5', 0.5, 0.65], [-1.85, 1.95, '#cfe0d3', 0.45, 0.45], [-1.4, 1.7, '#f2c3cc', 0.32, 0.42]].forEach(([x, y, c, w, h]) => {
    put(box(w, h, 0.04, '#ffffff', 0.15), x, y, -D + 0.03);
    put(mesh(rbox(w * 0.78, h * 0.78, 0.01, 0.1), mat(c)), x, y, -D + 0.055);
  });
  const door = put(new Node(), 1.9, 0, D - 0.02);
  door.add(box(0.95, 2.1, 0.06, '#fffaf5', 0.1).at(0, 1.05, 0));
  door.add(mesh(sphere(10, 8), mat('#d9b98c')).at(0.36, 1.0, -0.05).sc(0.035));

  return {
    root, colliders,
    interactables: [], // gli oggetti interattivi vengono aggiunti solo dagli script delle scene
    bounds: { minX: -W + 0.25, maxX: W - 0.25, minZ: -D + 0.25, maxZ: D - 0.25 },
    camBounds: { minX: -W + 0.15, maxX: W - 0.15, minZ: -D + 0.15, maxZ: D - 0.15, maxY: H - 0.1 },
    spawn: [0.3, 0, 0.6], spawnYaw: Math.PI,
    shadowBox: { center: [0, 1, 0], size: 4.2 },
  };
}

// ---------- Controller in terza persona ----------
export class ThirdPerson {
  constructor(camera, avatar, level) {
    this.camera = camera; this.avatar = avatar; this.level = level;
    this.pos = level.spawn.slice(); this.facing = level.spawnYaw ?? 0;
    this.yaw = this.facing + Math.PI; this.pitch = 0.3; this.dist = 3.0;
    this.speed = 1.9; this.radius = 0.22; this.camPos = [0, 0, 0]; this.near = null;
    this.updateCamera(1, true);
  }
  snapCamera() { this.updateCamera(1, true); }
  update(dt, move, look) {
    this.yaw -= look.x * dt * 2.6;
    this.pitch = Math.max(-0.05, Math.min(1.05, this.pitch + look.y * dt * 1.6));
    const mag = Math.min(1, Math.hypot(move.x, move.y));
    if (mag > 0.08) {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const vx = rx * move.x - fx * move.y, vz = rz * move.x - fz * move.y, l = Math.hypot(vx, vz) || 1;
      const sp = this.speed * mag * dt;
      this.tryMove(vx / l * sp, vz / l * sp);
      let d = Math.atan2(vx, vz) - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 12);
    }
    this.avatar.walk += ((mag > 0.08 ? mag : 0) - this.avatar.walk) * Math.min(1, dt * 10);
    this.avatar.root.position = this.pos.slice();
    this.avatar.root.rotation = [0, this.facing, 0];
    this.avatar.update(dt);
    this.updateCamera(dt);
    let best = null, bd = Infinity;
    for (const it of this.level.interactables) {
      if (it.enabled === false) continue;
      const d = Math.hypot(it.pos[0] - this.pos[0], it.pos[2] - this.pos[2]);
      if (d < it.r && d < bd) { bd = d; best = it; }
    }
    this.near = best;
  }
  tryMove(dx, dz) {
    const b = this.level.bounds, r = this.radius;
    const ok = (x, z) => {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
      return !this.level.colliders.some(c => { const cx = Math.max(c.minX, Math.min(x, c.maxX)), cz = Math.max(c.minZ, Math.min(z, c.maxZ)); return (x - cx) ** 2 + (z - cz) ** 2 < r * r; });
    };
    const [x, , z] = this.pos;
    if (ok(x + dx, z + dz)) { this.pos[0] += dx; this.pos[2] += dz; }
    else if (ok(x + dx, z)) this.pos[0] += dx;
    else if (ok(x, z + dz)) this.pos[2] += dz;
  }
  updateCamera(dt, snap = false) {
    const t = [this.pos[0], 1.22, this.pos[2]], cb = this.level.camBounds;
    const dir = [Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)];
    let dist = this.dist;
    for (let i = 0; i < 14; i++) {
      const p = [t[0] + dir[0] * dist, t[1] + dir[1] * dist, t[2] + dir[2] * dist];
      if (p[0] > cb.minX && p[0] < cb.maxX && p[2] > cb.minZ && p[2] < cb.maxZ && p[1] < cb.maxY) break;
      dist *= 0.88;
    }
    dist = Math.max(dist, 0.9);
    const want = [t[0] + dir[0] * dist, t[1] + dir[1] * dist, t[2] + dir[2] * dist];
    const k = snap ? 1 : Math.min(1, dt * 10);
    this.camPos = this.camPos.map((v, i) => v + (want[i] - v) * k);
    this.camera.position = this.camPos.slice();
    this.camera.target = [t[0], t[1] + 0.08, t[2]];
  }
}
