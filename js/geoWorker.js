// Worker: genera in sottofondo corpo, mani, scarpe e vestiti (calcolo pesante) senza bloccare il gioco.
import { makeGeo } from './body.js';
self.onmessage = (e) => {
  const { id, kind, base, item } = e.data;
  try {
    const geos = makeGeo(kind, base, item);
    const out = geos.map(g => ({ pos: g.pos, nrm: g.nrm, idx: g.idx, joints: g.joints, weights: g.weights }));
    self.postMessage({ id, out });
  } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};
