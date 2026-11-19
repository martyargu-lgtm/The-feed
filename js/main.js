// Avvio del gioco e collegamento delle scene.
import { fitStage, el, goFullscreen, fadeToWhite } from './stage.js';
import { start, setView } from './engine.js';
import { state, load, restore, resetState, clearSave } from './state.js';
import { HUD } from './hud.js';
import { Controls } from './input.js';
import { RoomView } from './views.js';
import { runScene0 } from './scenes/scene0.js';
import { startScene1 } from './scenes/scene1.js';
import { prewarm } from './geoclient.js';

window.__booted = true;
prewarm('F');   // Giulia e personaggio femminile: preparati in sottofondo
fitStage();
start();

const hud = new HUD(document.getElementById('hud'));
const controls = new Controls(document.getElementById('controls'));
const worldEl = document.getElementById('gl');
let room = null;

function roomBackdrop() {
  room = new RoomView(state.avatar);
  setView(room);
  worldEl.classList.add('blur');            // la stanza resta sfocata dietro a Giulia
}
function enterRoom() {
  if (!room) roomBackdrop();
  worldEl.classList.remove('blur');
  startScene1(room, controls, hud);
}

// pulsante casa: dalla stanza si torna alla schermata iniziale (dopo la conferma)
hud.onPause = (on) => { if (room) room.paused = on || !room.controls; };
hud.onHome = () => fadeToWhite(() => {
  hud.show(false); controls.show(false);
  if (room) { room.paused = true; room.onTick = null; }
  room = null; setView(null); worldEl.classList.remove('blur');
  splash();
});

function splash() {
  const saved = load();
  const ui = document.getElementById('ui');
  ui.innerHTML = '';
  const s = el(`<div class="screen splash">
    <h1>Clean Girl</h1><p>Gioca con il telefono in orizzontale</p>
    <div class="row">${saved ? '<button class="btn white" data-a="cont">CONTINUA PARTITA</button>' : ''}
    <button class="btn" data-a="new">${saved ? 'NUOVA PARTITA' : 'GIOCA'}</button></div></div>`);
  ui.appendChild(s);
  s.querySelectorAll('.btn').forEach(b => b.onclick = async () => {
    goFullscreen();
    if (b.dataset.a === 'cont') {
      restore(saved);
      await fadeToWhite(() => enterRoom());
    } else {
      clearSave(); resetState();
      fadeToWhite(() => { runScene0({ enterRoom, roomBackdrop }); });
    }
  });
}
splash();
