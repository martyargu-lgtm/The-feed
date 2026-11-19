// Stato di gioco: profilo, avatar, variabili, flag delle scelte. Salvato nel browser.
const KEY = 'cleangirl_save_v1';

export const VAR_MAX = 10;            // scala delle barre (modificabile quando avremo gli script completi)
export const VARS = {
  rapporti: { label: 'Rapporti reali', cls: 'rr' },
  approvazione: { label: 'Approvazione online', cls: 'ao' },
};

function fresh() {
  return {
    world: null,          // moodboard scelta
    name: '',
    gender: null,         // 'F' | 'M' | 'NB' | 'NS'
    age: null,
    base: null,           // 'F' (personaggio sinistro) | 'M' (personaggio destro)
    avatar: null,         // configurazione dell'avatar (vedi avatar.js)
    vars: { rapporti: 0, approvazione: 0 },
    varsActive: false,    // le barre compaiono solo dalla Scena 1
    day: 1,
    flags: {},            // conseguenze permanenti delle scelte: flags['scena1.colazione'] = 'smoothie'
    checkpoint: 'start',  // ultimo punto di ripresa
  };
}

export const state = fresh();
const listeners = new Set();
export function onVarChange(fn) { listeners.add(fn); }

export function resetState() { Object.assign(state, fresh()); }

export function changeVar(key, delta) {
  if (!(key in state.vars) || !delta) return;
  const before = state.vars[key];
  state.vars[key] = Math.max(0, Math.min(VAR_MAX, before + delta));
  listeners.forEach(fn => fn(key, delta, state.vars[key]));
  save();
}

export function setFlag(k, v) { state.flags[k] = v; save(); }
export function getFlag(k) { return state.flags[k]; }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage non disponibile */ }
}
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.avatar && s.checkpoint && s.checkpoint !== 'start') return s;
  } catch (e) {}
  return null;
}
export function restore(s) { Object.assign(state, fresh(), s); }
export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) {} }

// Pronomi: g('disposta','disposto','neutra') -> sceglie in base all'identità indicata.
// Non binario e "Preferisco non specificare" usano formulazioni neutre.
export function g(f, m, n) {
  if (state.gender === 'F') return f;
  if (state.gender === 'M') return m;
  return n;
}
export function fill(text) {
  return text.replace(/\{nome\}/g, state.name || '');
}
