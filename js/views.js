// Viste 3D: anteprima dell'avatar (editor) e stanza esplorabile.
import { Node, Camera, mesh, mat, disc, hexLin } from './m3d.js';
import { Avatar3D } from './avatar3d.js';
import { buildBedroom, ThirdPerson } from './world.js';
import { canvas } from './engine.js';

const FRAMES = { face: { y: 1.5, dist: 1.3, ty: 1.5 }, body: { y: 0.98, dist: 4.1, ty: 0.86 } };

export class EditorView {
  constructor(cfg) {
    this.root = new Node();
    this.clear = [1, 1, 1, 1];
    this.avatar = new Avatar3D(cfg);
    this.root.add(this.avatar.root);
    this.root.add(mesh(disc(0.6, 48), mat('#f3ecea'), false));
    this.camera = new Camera(30);
    this.camera.shiftX = -0.5;            // soggetto al centro della metà destra
    this.shadowBox = { center: [0, 0.9, 0], size: 1.2 };
    this.f = { ...FRAMES.face }; this.goal = FRAMES.face;
    this.rotY = 0; this.rotGoal = 0;
    let id = null, lx = 0;
    // trascina sulla metà destra (anteprima) per girare il personaggio a 360°
    this._down = (e) => {
      if (e.target.closest && e.target.closest('.ed-panel, .done, button')) return;
      const r = canvas.getBoundingClientRect();
      if (e.clientX < r.left + r.width * 0.5) return;
      id = e.pointerId; lx = e.clientX;
    };
    this._move = (e) => { if (e.pointerId !== id) return; this.rotGoal += (e.clientX - lx) * 0.014; lx = e.clientX; };
    this._up = (e) => { if (e.pointerId === id) id = null; };
  }
  setFocus(which) { this.goal = FRAMES[which === 'body' ? 'body' : 'face']; }
  setConfig(cfg) { this.avatar.set(cfg); }
  enter() { addEventListener('pointerdown', this._down); addEventListener('pointermove', this._move); addEventListener('pointerup', this._up); addEventListener('pointercancel', this._up); }
  leave() { removeEventListener('pointerdown', this._down); removeEventListener('pointermove', this._move); removeEventListener('pointerup', this._up); removeEventListener('pointercancel', this._up); }
  update(dt) {
    const k = Math.min(1, dt * 6), f = this.f, g = this.goal;
    for (const key of ['y', 'dist', 'ty']) f[key] += (g[key] - f[key]) * k;
    this.rotY += (this.rotGoal - this.rotY) * Math.min(1, dt * 10);
    this.avatar.root.rotation = [0, this.rotY, 0];
    this.avatar.walk = 0; this.avatar.update(dt);
    this.camera.position = [0, f.y + 0.06, f.dist]; this.camera.target = [0, f.ty, 0];
  }
}

export class RoomView {
  constructor(cfg) {
    this.level = buildBedroom();
    this.root = this.level.root;
    this.avatar = new Avatar3D(cfg);
    this.root.add(this.avatar.root);
    this.camera = new Camera(52);
    this.shadowBox = this.level.shadowBox;
    this.clear = [...hexLin('#faedea').map(v => Math.pow(v, 1 / 2.2)), 1];
    this.player = new ThirdPerson(this.camera, this.avatar, this.level);
    this.controls = null; this.paused = true; this.onTick = null;
  }
  update(dt) {
    const inp = (!this.paused && this.controls) ? this.controls.read() : { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
    this.player.update(dt, inp.move, inp.look);
    this.onTick?.(dt);
  }
}
