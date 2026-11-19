// SCENA 1 – per ora: stanza esplorabile di prova (in attesa dello script della Scena 1).
// Qui verranno caricate le azioni, i dialoghi e le scelte dello script.
import { state, save } from '../state.js';
import { el } from '../stage.js';
import { typewriter } from '../dialogue.js';
import { toStage } from '../engine.js';

export function startScene1(room, controls, hud) {
  state.varsActive = true;                 // le variabili si attivano all'inizio della Scena 1
  state.checkpoint = 'scene1';
  save();
  hud.show(true);
  controls.show(true);
  room.controls = controls; room.paused = false;

  const ui = document.getElementById('ui');
  ui.innerHTML = '';
  const prompt = el('<div class="prompt hidden"></div>');
  ui.appendChild(prompt);
  let busy = false;

  room.onTick = () => {
    const it = busy ? null : room.player.near;
    controls.setAct(!!it);
    if (it) {
      const p = toStage(it.pos, room.camera);
      prompt.textContent = it.label;
      prompt.style.left = p.x + 'px'; prompt.style.top = p.y + 'px';
      prompt.classList.toggle('hidden', p.behind);
    } else prompt.classList.add('hidden');
  };

  // Gli oggetti interattivi (room.level.interactables) e le loro azioni verranno definiti dallo script della Scena 1:
  // ogni voce avrà { id, label, pos: [x, y, z], r, run: async () => {...} } (coordinate 3D della stanza).
  controls.onAct = async () => {
    const it = room.player.near;
    if (!it || busy || !it.run) return;
    busy = true; room.paused = true;
    await it.run({ line });
    busy = false; room.paused = false;
  };

  function line(who, text) {
    return new Promise((res) => {
      const n = el(`<div class="line"><div class="who alt">${who}</div><div class="t"></div></div>`);
      ui.appendChild(n);
      const tw = typewriter(n.querySelector('.t'), text);
      n.addEventListener('pointerdown', () => { if (!tw.done) tw.finish(); else { n.remove(); res(); } });
    });
  }
}
