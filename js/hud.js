// HUD: "GIORNATA : n" e le due barre sovrapposte (Fig. 13).
import { state, VARS, VAR_MAX, onVarChange, changeVar } from './state.js';

export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `<button class="home" aria-label="Torna alla schermata iniziale"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10"/></svg></button><div class="day"></div><div class="bars">${Object.entries(VARS).map(([k, v]) =>
      `<div class="bar ${v.cls}" data-k="${k}"><label>${v.label}</label><div class="track"><div class="fill"></div></div></div>`).join('')}</div>`;
    onVarChange((k, d) => this.bump(k, d));
    this.onHome = null;
    root.querySelector('.home').addEventListener('click', () => this.confirmHome());
    if (location.hash === '#debug') this.debug();
  }
  // finestra di conferma prima di tornare alla schermata iniziale
  confirmHome() {
    if (document.querySelector('.modal')) return;
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="card pop"><p>Sei sicuro di voler tornare alla schermata iniziale?</p>
      <div class="row"><button class="btn white small" data-a="no">ANNULLA</button><button class="btn small" data-a="yes">SÌ, TORNA</button></div></div>`;
    document.getElementById('stage').appendChild(m);
    const close = () => m.remove();
    m.querySelector('[data-a=no]').onclick = close;
    m.querySelector('[data-a=yes]').onclick = () => { close(); this.onHome?.(); };
    m.addEventListener('pointerdown', (e) => { if (e.target === m) close(); });
    this.onPause?.(true);
    const obs = new MutationObserver(() => { if (!m.isConnected) { obs.disconnect(); this.onPause?.(false); } });
    obs.observe(document.getElementById('stage'), { childList: true });
  }
  show(on) { this.root.classList.toggle('hidden', !on); if (on) this.refresh(); }
  refresh() {
    this.root.querySelector('.day').textContent = `GIORNATA : ${state.day}`;
    for (const k of Object.keys(VARS)) {
      const v = state.vars[k];
      this.root.querySelector(`.bar[data-k="${k}"] .fill`).style.width = (v / VAR_MAX * 100) + '%';
    }
  }
  bump(k, d) {
    this.refresh();
    const bar = this.root.querySelector(`.bar[data-k="${k}"]`);
    bar.classList.remove('flash'); void bar.offsetWidth; bar.classList.add('flash');
    const tag = document.createElement('div');
    tag.className = 'delta';
    tag.style.color = k === 'rapporti' ? 'var(--bar-blue)' : 'var(--bar-pink)';
    tag.textContent = (d > 0 ? '+' : '') + d;
    bar.appendChild(tag);
    setTimeout(() => tag.remove(), 1700);
  }
  debug() {
    const d = document.createElement('div');
    d.className = 'debug';
    d.innerHTML = Object.entries(VARS).map(([k, v]) => `<div>${v.label}<button data-k="${k}" data-d="-1">−</button><button data-k="${k}" data-d="1">+</button></div>`).join('');
    d.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) changeVar(b.dataset.k, +b.dataset.d); });
    this.root.appendChild(d);
  }
}
