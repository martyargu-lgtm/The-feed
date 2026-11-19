// Vignette di dialogo con effetto macchina da scrivere (lettera dopo lettera) e Giulia 3D a mezzo busto.
import { el, CHEVRON_R, wait, onResize, stageScale } from './stage.js';
import { Renderer, Camera, Node } from './m3d.js';
import { Avatar3D, GIULIA } from './avatar3d.js';

// Giulia 3D a mezzo busto su un livello trasparente sopra la stanza sfocata
const PW = 816, PH = 1056;
class GiuliaPortrait {
  constructor(canvas) {
    this.r = new Renderer(canvas, { alpha: true, shadowSize: 1024 });
    this.r.shadowBox = { center: [0, 1.2, 0], size: 1 };
    this.root = new Node(); this.avatar = new Avatar3D(GIULIA); this.root.add(this.avatar.root);
    this.avatar.root.rotation = [0, -0.22, 0];
    this.cam = new Camera(24); this.cam.position = [-0.04, 1.42, 2.6]; this.cam.target = [-0.02, 1.31, 0];
    this.resize = () => this.r.setSize(PW, PH, Math.max(0.6, Math.min(2, (window.devicePixelRatio || 1) * stageScale())));
    this.resize(); onResize(this.resize);
    this.alive = true; let last = performance.now();
    const loop = (now) => { if (!this.alive) return; this.avatar.update(Math.min(0.05, (now - last) / 1000)); last = now; this.r.render(this.root, this.cam); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  // 1 saluto, 2 mani giunte, 3 mano sul fianco + occhiolino (come Fig. 10–12)
  pose(n) { this.avatar.setPose(null); this.avatar.setExpression({ wink: false }); }   // nei dialoghi Giulia resta ferma con le braccia lungo i fianchi (niente gesti: le maniche larghe non si incastrano)
  dispose() { this.alive = false; }
}

const SPEED = 32; // ms per lettera

export function typewriter(node, text) {
  let i = 0, done = false, timer, resolve;
  node.textContent = '';
  const p = new Promise((res) => {
    resolve = res;
    const step = () => {
      i++;
      node.textContent = text.slice(0, i);
      if (i >= text.length) { done = true; res(); return; }
      timer = setTimeout(step, text[i - 1] === ',' || text[i - 1] === '.' ? SPEED * 5 : SPEED);
    };
    timer = setTimeout(step, 250);
  });
  return { promise: p, finish() { if (done) return; clearTimeout(timer); node.textContent = text; done = true; resolve(); }, get done() { return done; } };
}

export class GiuliaTalk {
  constructor(ui) {
    this.node = el(`<div class="dlg">
      <div class="veil"></div>
      <canvas class="portrait"></canvas>
      <div class="bubble"><div class="who">GIULIA</div><div class="txt"></div>
        <button class="next" aria-label="Avanti">${CHEVRON_R.replace('currentColor', '#fff')}</button></div>
    </div>`);
    ui.appendChild(this.node);
    this.portraitEl = this.node.querySelector('.portrait');
    this.giulia = new GiuliaPortrait(this.portraitEl);
    this.bubble = this.node.querySelector('.bubble');
    this.txt = this.node.querySelector('.txt');
    this.next = this.node.querySelector('.next');
  }
  async enter() {
    await wait(60);
    this.portraitEl.classList.add('in');      // entra da destra e si ferma sulla destra
    await wait(750);
    this.bubble.classList.add('in');
    await wait(300);
  }
  // pose: 1 saluto, 2 mani giunte, 3 occhiolino (Fig. 10–12)
  say(text, pose = 1, cta = null) {
    this.giulia.pose(pose);
    this.next.classList.remove('on');
    this.bubble.querySelector('.cta')?.remove();
    const tw = typewriter(this.txt, text);
    const onBubble = () => tw.finish();
    this.bubble.addEventListener('pointerdown', onBubble);
    return new Promise(async (res) => {
      await tw.promise;
      this.bubble.removeEventListener('pointerdown', onBubble);
      if (cta) {
        const b = el(`<button class="btn cta pop">${cta}</button>`);
        this.bubble.appendChild(b);
        b.addEventListener('click', () => res(), { once: true });
      } else {
        this.next.classList.add('on');
        this.next.addEventListener('click', (e) => { e.stopPropagation(); res(); }, { once: true });
      }
    });
  }
  remove() { this.giulia.dispose(); this.node.remove(); }
}
