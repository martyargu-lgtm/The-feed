// SCENA 0 – Scegli il tuo mondo + creazione del personaggio + entrata di Giulia.
import { state, save, g, fill } from '../state.js';
import { el, wait, fadeToWhite, CHEVRON_L, CHEVRON_R } from '../stage.js';
import { setView } from '../engine.js';
import { EditorView } from '../views.js';
import { SKIN, EYES, HAIR_COLORS, HAIR_STYLES, LOOK, defaultConfig, lookComplete, skinGradient, eyeGradient } from '../avatar3d.js';
import { GiuliaTalk } from '../dialogue.js';
import { prewarm } from '../geoclient.js';

const ui = () => document.getElementById('ui');
function mount(node) { const u = ui(); u.innerHTML = ''; u.appendChild(node); return node; }

// ---------------- Moodboard ----------------
const MOODS = [
  [{ id: 'messy', name: 'Messy girl' }, { id: 'y2k', name: 'Y2K' }, { id: 'soft', name: 'Soft boy' }],
  [{ id: 'gym', name: 'Gym bro' }, { id: 'clean', name: 'Clean girl', open: true }, { id: 'trad', name: 'Trad wife' }],
  [{ id: 'gorp', name: 'Gorpcore' }],
];

function chooseWorld() {
  return new Promise((done) => {
    const s = mount(el(`<div class="screen mood">
      <h1 class="title">Quale di questi mondi ti appartiene? Esplora le<br>moodboard e scegli quella che senti più tua.</h1>
      <div class="mood-strip">
        <button class="arrow l" aria-label="Indietro">${CHEVRON_L}</button>
        <div class="mood-viewport"><div class="mood-track"></div></div>
        <button class="arrow r" aria-label="Avanti">${CHEVRON_R}</button>
      </div>
      <div class="dots"></div>
      <button class="btn ghost">CONTINUA</button>
    </div>`));
    const track = s.querySelector('.mood-track'), dots = s.querySelector('.dots'), btn = s.querySelector('.btn');
    MOODS.forEach((page) => {
      const p = el('<div class="mood-page"></div>');
      page.forEach((m) => {
        const bg = m.id === 'gorp'
          ? 'background:linear-gradient(160deg,#9aa77f,#6d7a52 45%,#c7b28a);'
          : `background-image:url(assets/mb_${m.id}.jpg)`;
        const c = el(`<div class="mood-card" data-id="${m.id}"><p class="lbl">${m.name}</p>
          <div class="img" style="${bg}">${m.open ? '' : '<div class="lock"><span>Presto disponibile</span></div>'}</div></div>`);
        c.addEventListener('click', () => {
          if (!m.open) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); toast(s, `${m.name}: presto disponibile`); return; }
          s.querySelectorAll('.mood-card').forEach(x => x.classList.remove('sel'));
          c.classList.add('sel'); state.world = m.id;
          btn.classList.remove('ghost'); btn.classList.add('pop');
        });
        p.appendChild(c);
      });
      track.appendChild(p);
      dots.appendChild(el('<i></i>'));
    });
    let page = 0;
    const go = (n) => {
      page = Math.max(0, Math.min(MOODS.length - 1, n));
      track.style.transform = `translateX(${-page * 100}%)`;
      s.querySelector('.arrow.l').classList.toggle('off', page === 0);
      s.querySelector('.arrow.r').classList.toggle('off', page === MOODS.length - 1);
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === page));
    };
    s.querySelector('.arrow.l').onclick = () => go(page - 1);
    s.querySelector('.arrow.r').onclick = () => go(page + 1);
    // scorrimento anche con il dito
    let sx = null;
    track.addEventListener('pointerdown', e => { sx = e.clientX; });
    track.addEventListener('pointerup', e => { if (sx === null) return; const d = e.clientX - sx; if (Math.abs(d) > 40) go(page + (d < 0 ? 1 : -1)); sx = null; });
    go(0);
    btn.onclick = () => done();
  });
}
function toast(s, text) {
  s.querySelector('.toast')?.remove();
  const t = el(`<div class="toast">${text}</div>`); s.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// ---------------- Domande ----------------
function askName() {
  return new Promise((done) => {
    const s = mount(el(`<div class="screen form">
      <h1 class="title intro">Prima di entrare nel mondo clean<br>girl, creiamo il tuo personaggio!</h1>
      <p class="q">Come ti chiami?</p>
      <input class="field" maxlength="16" placeholder="Inserisci il tuo nome" autocomplete="off" enterkeyhint="done">
      <button class="btn ghost">CONTINUA</button></div>`));
    const inp = s.querySelector('input'), btn = s.querySelector('.btn');
    inp.value = state.name || '';
    const check = () => btn.classList.toggle('ghost', !inp.value.trim());
    inp.addEventListener('input', check); check();
    const ok = () => { if (!inp.value.trim()) return; state.name = inp.value.trim(); inp.blur(); done(); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    btn.onclick = ok;
  });
}

function askGender() {
  return new Promise((done) => {
    const opts = [['F', 'Femmina'], ['M', 'Maschio'], ['NB', 'Non binario'], ['NS', 'Preferisco non specificare']];
    const s = mount(el(`<div class="screen form"><p class="q">Come ti identifichi?</p>
      <div class="opts">${opts.map(([k, v]) => `<button class="opt" data-k="${k}">${v}</button>`).join('')}</div>
      <button class="btn ghost">CONTINUA</button></div>`));
    const btn = s.querySelector('.btn');
    s.querySelectorAll('.opt').forEach(o => o.onclick = () => {
      s.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
      o.classList.add('sel'); state.gender = o.dataset.k; btn.classList.remove('ghost');
    });
    btn.onclick = () => state.gender && done();
  });
}

function askAge() {
  return new Promise((done) => {
    const s = mount(el(`<div class="screen form"><p class="q">Quanti anni hai?</p>
      <input class="field" type="number" inputmode="numeric" min="1" max="120" placeholder="Inserisci la tua età" enterkeyhint="done" style="width:520px">
      <button class="btn ghost">CONTINUA</button></div>`));
    const inp = s.querySelector('input'), btn = s.querySelector('.btn');
    const valid = () => { const n = parseInt(inp.value, 10); return n >= 1 && n <= 120; };
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 3); btn.classList.toggle('ghost', !valid()); if (valid()) btn.classList.add('pop'); });
    const ok = () => { if (!valid()) return; state.age = parseInt(inp.value, 10); inp.blur(); done(); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    btn.onclick = ok;
  });
}

function chooseBase() {
  return new Promise((done) => {
    const s = mount(el(`<div class="screen white choose"><h1 class="title">Scegli il tuo personaggio!</h1>
      <div class="bases"><div class="base" data-k="F" style="background-image:url(assets/base_f.png)"></div>
      <div class="base" data-k="M" style="background-image:url(assets/base_m.png)"></div></div></div>`));
    s.querySelectorAll('.base').forEach(b => b.onclick = async () => {
      b.classList.add('sel'); state.base = b.dataset.k; prewarm(state.base);
      await wait(450); done();
    });
  });
}

// ---------------- Creazione dell'avatar ----------------
function avatarEditor() {
  return new Promise((done) => {
    const cfg = state.avatar && state.avatar.base === state.base ? { ...state.avatar } : defaultConfig(state.base);
    const view = new EditorView(cfg);
    setView(view);
    const s = mount(el(`<div class="screen editor">
      <div class="ed-panel"><div class="tabs">
        <div class="tab on" data-t="pelle">Pelle</div><div class="tab" data-t="capelli">Capelli</div>
        <div class="tab" data-t="occhi">Occhi</div><div class="tab" data-t="look">Look</div></div>
        <div class="ed-body"></div></div>
      <button class="btn small done ghost">FATTO</button>
      <div class="rot-hint">Trascina per ruotare</div>
    </div>`));
    const body = s.querySelector('.ed-body'), doneBtn = s.querySelector('.done');
    let tab = 'pelle', moreHair = false;
    const apply = () => {
      view.setConfig(cfg);
      const ok = lookComplete(cfg);
      if (ok && doneBtn.classList.contains('ghost')) doneBtn.classList.add('pop');
      doneBtn.classList.toggle('ghost', !ok);
    };
    const swatches = (list, key) => `<div class="sw-grid">${list.map((c, i) => `<div class="sw ${cfg[key] === i ? 'sel' : ''}" data-i="${i}" style="background:${c}"></div>`).join('')}</div>`;
    const slider = (grad, val) => `<div class="slider" style="background:linear-gradient(90deg,${grad.join(',')})"><div class="knob" style="left:${val * 100}%;background:${grad[1]}"></div></div>`;
    const tile = (id, sel) => `<div class="tile ${sel ? 'sel' : ''}" data-id="${id}" style="background-image:url(assets/ic_${id}.png)"></div>`;

    const render = () => {
      s.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.t === tab));
      view.setFocus(tab === 'look' ? 'body' : 'face');
      if (tab === 'pelle') {
        body.innerHTML = swatches(SKIN, 'skin') + slider(skinGradient(cfg.skin), cfg.skinShade);
        bindSw('skin', 'skinShade', skinGradient);
      } else if (tab === 'occhi') {
        body.innerHTML = swatches(EYES, 'eyes') + slider(eyeGradient(cfg.eyes), cfg.eyesShade);
        bindSw('eyes', 'eyesShade', eyeGradient);
      } else if (tab === 'capelli') {
        const cols = HAIR_COLORS.map((c, i) => ({ c, i })).slice(moreHair ? 6 : 0, moreHair ? 12 : 6);
        body.innerHTML = `<div class="hair-colors">
          ${moreHair ? `<button class="more" data-m="0">${CHEVRON_L}</button>` : ''}
          ${cols.map(({ c, i }) => `<div class="sw ${cfg.hairColor === i ? 'sel' : ''} ${c === '#f4f1ec' ? 'light' : ''}" data-i="${i}" style="background:${c}"></div>`).join('')}
          ${moreHair ? '' : `<button class="more" data-m="1">${CHEVRON_R}</button>`}</div>
          <div class="tile-grid">${HAIR_STYLES.map(id => tile(id, cfg.hairStyle === id)).join('')}</div>
          <p class="ed-hint" style="margin-top:40px">Scorri per vedere tutte le acconciature</p>`;
        body.querySelector('.more').onclick = (e) => { moreHair = e.currentTarget.dataset.m === '1'; render(); };
        body.querySelectorAll('.sw').forEach(sw => sw.onclick = () => { cfg.hairColor = +sw.dataset.i; if (!cfg.hairStyle) cfg.hairStyle = cfg.base === 'M' ? 'hm5' : 'hf5'; apply(); render(); });
        body.querySelectorAll('.tile').forEach(t => t.onclick = () => { cfg.hairStyle = cfg.hairStyle === t.dataset.id ? null : t.dataset.id; apply(); render(); });
      } else {
        const rows = ['top', 'bottom', 'dress', 'shoes', 'bag', 'glasses'];
        body.innerHTML = rows.map(r => `<div class="row-wrap"><div class="tile-grid">${LOOK[r].map(id => tile(id, cfg[r] === id)).join('')}</div></div>`).join('')
          + '<p class="ed-hint">Scorri per vedere scarpe e accessori</p>';
        body.querySelectorAll('.row-wrap').forEach((rw, ri) => {
          const r = rows[ri];
          rw.querySelectorAll('.tile').forEach(t => t.onclick = () => {
            const id = t.dataset.id;
            cfg[r] = cfg[r] === id ? null : id;
            if (r === 'dress' && cfg.dress) { cfg.top = null; cfg.bottom = null; }
            if ((r === 'top' || r === 'bottom') && cfg[r]) cfg.dress = null;
            apply(); const st = body.scrollTop; render(); body.scrollTop = st;
          });
        });
      }
    };
    const bindSw = (key, shadeKey, gradFn) => {
      body.querySelectorAll('.sw').forEach(sw => sw.onclick = () => { cfg[key] = +sw.dataset.i; apply(); render(); });
      const sl = body.querySelector('.slider'), knob = sl.querySelector('.knob');
      const setV = (e) => {
        const r = sl.getBoundingClientRect();
        cfg[shadeKey] = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        knob.style.left = cfg[shadeKey] * 100 + '%'; apply();
      };
      sl.addEventListener('pointerdown', (e) => { sl.setPointerCapture(e.pointerId); setV(e); });
      sl.addEventListener('pointermove', (e) => { if (sl.hasPointerCapture(e.pointerId)) setV(e); });
    };
    s.querySelectorAll('.tab').forEach(t => t.onclick = () => { tab = t.dataset.t; body.scrollTop = 0; render(); });
    doneBtn.onclick = () => { if (!lookComplete(cfg)) return; state.avatar = { ...cfg }; save(); done(); };
    render(); apply();
  });
}

// ---------------- Sfida + Giulia ----------------
function challenge() {
  return new Promise((done) => {
    const text = g('Tutto pronto! Scopri quanto sei disposta a cambiare per diventare una Clean Girl.',
      'Tutto pronto! Scopri quanto sei disposto a cambiare per diventare una Clean Girl.',
      'Tutto pronto! Scopri fin dove arriveresti per diventare una Clean Girl.');
    const s = mount(el(`<div class="screen pink challenge"><h1 class="title">${text}</h1>
      <button class="btn white">ACCETTO LA SFIDA</button></div>`));
    s.querySelector('.btn').onclick = () => done();
  });
}

// esegue fn a schermo bianco e attende la sua conclusione
function trans(fn) { let p; return fadeToWhite(() => { p = fn(); }).then(() => p); }

export async function runScene0({ enterRoom, roomBackdrop }) {
  state.checkpoint = 'start';
  await chooseWorld();
  await trans(askName);
  await askGender();
  await askAge();
  await chooseBase();
  await trans(avatarEditor);
  await trans(() => { setView(null); return challenge(); });
  // transizione a bianco → entra Giulia, con la stanza sfocata dietro
  let talk;
  await fadeToWhite(() => {
    roomBackdrop();
    ui().innerHTML = '';
    talk = new GiuliaTalk(ui());
  });
  await talk.enter();
  await talk.say(fill('Hey {nome}, sono Giulia, ho 22 anni e sono una Clean Girl: routine, ordine e tanto benessere.'), 1);
  await talk.say('Condivido sui social i miei rituali preferiti e tutto ciò che mi fa sentire al meglio.', 2);
  await talk.say('È ora di iniziare la tua prima giornata da Clean Girl!', 3, 'INIZIA');
  await fadeToWhite(() => { talk.remove(); enterRoom(); });
}
