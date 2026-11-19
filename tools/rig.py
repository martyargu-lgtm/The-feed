# Scala i modelli Meshy a misura reale, calcola i pesi dello scheletro (distanza geodesica sulla mesh) e salva il formato del gioco.
import numpy as np, struct, sys
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra

H_MODEL = 1.903       # altezza normalizzata dei file Meshy
SCALE = 1.65 / H_MODEL

# articolazioni (metri, personaggio con i piedi a y=0, guarda verso +z). "L" = x negativa
J = {
  'pelvis': [0, 0.80, 0.0], 'chest': [0, 1.28, -0.01], 'neck': [0, 1.31, -0.01], 'headTop': [0, 1.62, 0.0],
  'hipL': [-0.077, 0.80, 0.0], 'kneeL': [-0.071, 0.49, -0.02], 'ankleL': [-0.073, 0.10, -0.035], 'toeL': [-0.075, 0.02, 0.09],
  'shL': [-0.15, 1.19, -0.03], 'elL': [-0.178, 1.0, -0.04], 'wrL': [-0.198, 0.855, -0.025], 'handL': [-0.205, 0.70, -0.02],
}
for k in list(J):
    if k.endswith('L'): J[k[:-1] + 'R'] = [-J[k][0], J[k][1], J[k][2]]
J = {k: np.array(v, np.float64) for k, v in J.items()}
# ossa del gioco: 0 busto, 1 coscia L, 2 ginocchio L, 3 coscia R, 4 ginocchio R, 5 spalla L, 6 gomito L, 7 spalla R, 8 gomito R, 9 testa
BONES = [
  ('pelvis', [('pelvis', 'chest')], 0.11),
  ('hipL', [('hipL', 'kneeL')], 0.07), ('kneeL', [('kneeL', 'ankleL'), ('ankleL', 'toeL')], 0.06),
  ('hipR', [('hipR', 'kneeR')], 0.07), ('kneeR', [('kneeR', 'ankleR'), ('ankleR', 'toeR')], 0.06),
  ('shL', [('shL', 'elL')], 0.045), ('elL', [('elL', 'wrL'), ('wrL', 'handL')], 0.045),
  ('shR', [('shR', 'elR')], 0.045), ('elR', [('elR', 'wrR'), ('wrR', 'handR')], 0.045),
  ('neck', [('neck', 'headTop')], 0.25),
]

def load(fn):
    d = open(fn, 'rb').read(); nv, nf, hu = struct.unpack('<iii', d[:12]); o = 12
    P = np.frombuffer(d, np.float32, nv * 3, o).reshape(-1, 3).copy(); o += nv * 12
    N = np.frombuffer(d, np.float32, nv * 3, o).reshape(-1, 3).copy(); o += nv * 12
    UV = None
    if hu: UV = np.frombuffer(d, np.float32, nv * 2, o).reshape(-1, 2).copy(); o += nv * 8
    F = np.frombuffer(d, np.uint32, nf * 3, o).reshape(-1, 3).copy()
    return P, N, UV, F

def place(P, ref=None):
    # stessa scala per tutti i file Meshy; centro orizzontale dal corpo, piedi a terra
    P = P * SCALE
    P[:, 1] -= P[:, 1].min()
    m = (P[:, 1] > 0.85) & (P[:, 1] < 1.25)       # busto: centro in x e z
    P[:, 0] -= P[m, 0].mean() if ref is None else ref[0]
    P[:, 2] -= (P[m, 2].max() + P[m, 2].min()) / 2 if ref is None else ref[1]
    return P

def segdist(P, a, b):
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)

def weights(P, F, sigma=0.012):
    nv = len(P)
    # le cuciture UV dividono i vertici: si saldano per posizione, così la distanza sulla superficie attraversa le isole
    key = np.round(P * 1e5).astype(np.int64); _, wid = np.unique(key, axis=0, return_inverse=True); wid = wid.ravel(); nw = wid.max() + 1
    e = wid[np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]).astype(np.int64)]
    rep = np.zeros(nw, np.int64); rep[wid] = np.arange(nv)
    w = np.linalg.norm(P[rep[e[:, 0]]] - P[rep[e[:, 1]]], axis=1) + 1e-6
    G = coo_matrix((np.concatenate([w, w]), (np.concatenate([e[:, 0], e[:, 1]]), np.concatenate([e[:, 1], e[:, 0]]))), shape=(nw, nw)).tocsr()
    eu = np.stack([np.min([segdist(P, J[a], J[b]) for a, b in segs], axis=0) for _, segs, _ in BONES], 1)
    near = eu.argmin(1)
    D = np.full((nv, len(BONES)), np.inf)
    for bi, (_, segs, rad) in enumerate(BONES):
        seeds = np.where((near == bi) & (eu[:, bi] < rad))[0]
        if len(seeds) == 0: seeds = np.array([eu[:, bi].argmin()])
        D[:, bi] = dijkstra(G, directed=False, indices=np.unique(wid[seeds]), min_only=True)[wid]
    # parti staccate dalla rete (es. occhi, gioielli) → distanza euclidea
    bad = ~np.isfinite(D).any(1); D[bad] = eu[bad]
    D[~np.isfinite(D)] = 1e3
    W = np.exp(-(D - D.min(1, keepdims=True)) / sigma)
    # maniche larghe e polsi: tutto ciò che sta di lato sotto il gomito segue l'avambraccio
    x, y = P[:, 0], P[:, 1]
    import json, os
    prof = np.array(json.load(open('profile.json'))) if os.path.exists('profile.json') else None
    thr = np.interp(y, prof[:, 0], prof[:, 1]) + 0.016 if prof is not None else 0.155
    cuff = (np.abs(x) > thr) & (y > 0.66) & (y < 0.97) & (np.abs(x) > 0.11)
    W[cuff] = 0; W[cuff & (x < 0), 6] = 1; W[cuff & (x >= 0), 8] = 1
    top = np.argsort(-W, 1)[:, :4]; Wt = np.take_along_axis(W, top, 1); Wt[Wt < 0.02] = 0; Wt /= Wt.sum(1, keepdims=True)
    return top.astype(np.uint8), Wt.astype(np.float32)

def save(fn, P, N, UV, F, JI, JW):
    with open(fn, 'wb') as o:
        flags = (1 if UV is not None else 0) | (2 if JI is not None else 0)
        o.write(struct.pack('<iii', len(P), len(F), flags)); o.write(P.astype(np.float32).tobytes()); o.write(N.astype(np.float32).tobytes())
        if UV is not None: o.write(UV.astype(np.float32).tobytes())
        if JI is not None: o.write(JI.astype(np.uint8).tobytes()); o.write(JW.astype(np.float32).tobytes())
        o.write(F.astype(np.uint32).tobytes())

if __name__ == '__main__':
    for src, dst, sg in [('body.bin', 'body_rig.bin', 0.012), ('giulia.bin', 'giulia_rig.bin', 0.02)]:
        P, N, UV, F = load(src); P = place(P)
        JI, JW = weights(P, F, sg)
        save(dst, P, N, UV, F, JI, JW)
        lab = JI[:, 0]
        print(dst, len(P), 'per osso', np.bincount(lab, minlength=10))
    np.save('joints.npy', {k: v for k, v in J.items()})
