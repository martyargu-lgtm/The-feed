# Vestiti ricavati dalla superficie del manichino: ritaglio con orli netti + spessore lungo le normali.
import numpy as np, struct, json
from rig import J, save

def load_rig(fn):
    d = open(fn, 'rb').read(); nv, nf, fl = struct.unpack('<iii', d[:12]); o = 12
    P = np.frombuffer(d, np.float32, nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12
    N = np.frombuffer(d, np.float32, nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12
    if fl & 1: o += nv * 8
    JI = np.frombuffer(d, np.uint8, nv * 4, o).reshape(-1, 4).copy(); o += nv * 4
    JW = np.frombuffer(d, np.float32, nv * 4, o).reshape(-1, 4).astype(np.float64); o += nv * 16
    F = np.frombuffer(d, np.uint32, nf * 3, o).reshape(-1, 3).astype(np.int64)
    return P, N, JI, JW, F

P, N, JI, JW, F = load_rig('body_rig.bin')
nv = len(P)
Wd = np.zeros((nv, 10)); [np.add.at(Wd, (np.arange(nv), JI[:, k]), JW[:, k]) for k in range(4)]
armW = Wd[:, 5:9].sum(1); legW = Wd[:, 1:5].sum(1); neckW = Wd[:, 9]
side = np.where(P[:, 0] < 0, 0, 1)
# posizione lungo il braccio (0 spalla → 1 polso)
def along(P, a, b): ab = b - a; return ((P - a) @ ab) / (ab @ ab)
tArm = np.where(side == 0, along(P, J['shL'], J['wrL']), along(P, J['shR'], J['wrR']))

def clip(P, N, W, F, f):
    """tiene la parte con f>=0, tagliando i triangoli esattamente sull'orlo"""
    P, N, W = list(P), list(N), list(W); out = []; cache = {}
    def cut(a, b):
        k = (min(a, b), max(a, b))
        if k in cache: return cache[k]
        t = f[a] / (f[a] - f[b]); P.append(P[a] + (P[b] - P[a]) * t); n = N[a] + (N[b] - N[a]) * t; N.append(n / (np.linalg.norm(n) + 1e-12))
        W.append(W[a] + (W[b] - W[a]) * t); cache[k] = len(P) - 1; return cache[k]
    fl = list(f)
    for tri in F:
        ins = [fl[v] >= 0 for v in tri]; c = sum(ins)
        if c == 3: out.append(list(tri)); continue
        if c == 0: continue
        r = [0, 1, 2]
        if c == 1:
            i = ins.index(True); a, b, d = tri[i], tri[(i + 1) % 3], tri[(i + 2) % 3]
            out.append([a, cut(a, b), cut(a, d)])
        else:
            i = ins.index(False); d, a, b = tri[i], tri[(i + 1) % 3], tri[(i + 2) % 3]
            ca, cb = cut(d, a), cut(d, b); out.append([a, b, cb]); out.append([a, cb, ca])
        fl += [0.0] * (len(P) - len(fl))
    return np.array(P), np.array(N), np.array(W), np.array(out, np.int64)

def smooth(P, F, it, fixed=None, lam=0.5):
    n = len(P); e = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); e = np.concatenate([e, e[:, ::-1]])
    deg = np.bincount(e[:, 0], minlength=n).astype(np.float64)
    for _ in range(it):
        acc = np.zeros_like(P); np.add.at(acc, e[:, 0], P[e[:, 1]])
        avg = acc / np.maximum(deg, 1)[:, None]; Q = P + lam * (avg - P)
        if fixed is not None: Q[fixed] = P[fixed]
        P = Q
    return P

def vnormals(P, F):
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); n = np.zeros_like(P)
    for k in range(3): np.add.at(n, F[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)

def boundary(F, n):
    e = np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), 1); k = e[:, 0] * n + e[:, 1]
    u, c = np.unique(k, return_counts=True); b = u[c == 1]; m = np.zeros(n, bool); m[b // n] = True; m[b % n] = True; return m

def garment(name, fields, pad, flare=None, smooth_it=2, base_pad=None):
    attrs = np.concatenate([P, N, Wd, armW[:, None], legW[:, None], neckW[:, None], tArm[:, None]], 1)
    Pc, Nc, A, Fc = P.copy(), N.copy(), attrs.copy(), F.copy()
    for fn in fields:
        f = fn(Pc, A)
        Pc, Nc, A, Fc = clip(Pc, Nc, A, Fc, f)
    u, inv = np.unique(Fc, return_inverse=True); Pc, Nc, A, Fc = Pc[u], Nc[u], A[u], inv.reshape(-1, 3)
    Pc = smooth(Pc, Fc, smooth_it, fixed=boundary(Fc, len(Pc)), lam=0.3)
    Nn = vnormals(Pc, Fc)
    off = pad + (flare(Pc) if flare else 0)
    Q = Pc + Nn * (off[:, None] if np.ndim(off) else off)
    # pesi: dai 10 ossi, primi 4
    Wm = A[:, 6:16]; top = np.argsort(-Wm, 1)[:, :4]; tw = np.take_along_axis(Wm, top, 1); tw[tw < 0.02] = 0; tw /= tw.sum(1, keepdims=True) + 1e-12
    save('g_' + name + '.bin', Q.astype(np.float32), Nn.astype(np.float32), None, Fc, top.astype(np.uint8), tw.astype(np.float32))
    print(name, len(Q), len(Fc))

# campi (>=0 = dentro). A: colonne 0-2 posizione, 6-15 pesi, 16 braccio, 17 gamba, 18 collo, 19 t braccio
Y = lambda A: A[:, 1]
above = lambda y0: (lambda Pc, A: A[:, 1] - y0)
below = lambda y1: (lambda Pc, A: y1 - A[:, 1])
noArms = lambda Pc, A: np.where(A[:, 1] > 1.08, 0.132 - np.abs(A[:, 0]) - 0.02 * np.clip((A[:, 1] - 1.2) / 0.08, 0, 1), 0.5 - A[:, 16])   # giromanica netto
noNeck = lambda Pc, A: 1.292 - A[:, 1] + 0.02 * np.clip(-A[:, 2] / 0.08, 0, 1)   # scollo pulito, un po' più alto dietro
noLegs = lambda Pc, A: 0.5 - A[:, 17]
def armsTo(t):  # maniche fino a t (0 spalla, 1 polso); il busto resta
    return lambda Pc, A: np.where(A[:, 16] > 0.5, t - A[:, 19], 1.0)
def legsTo(y):  # gambe fino a quota y
    return lambda Pc, A: np.where(A[:, 17] > 0.5, A[:, 1] - y, 1.0)
def neckline(depth, width):  # scollo davanti: toglie una "U" sotto il collo
    def f(Pc, A):
        x, y, z = A[:, 0], A[:, 1], A[:, 2]
        front = np.clip((z + 0.01) / 0.07, 0, 1)
        top = 1.30 - depth * front * np.clip(1 - (x / width) ** 2, 0, 1) ** 0.7
        return top - y
    return f

WAIST, CROTCH, HIP = 1.0, 0.73, 0.82
G = {
  'tank':    ([above(0.98), noArms, noNeck, neckline(0.06, 0.07)], 0.004),
  'briefs':  ([below(0.86), legsTo(0.665), noArms], 0.004),
  'tee':     ([above(0.92), armsTo(0.4), noNeck, neckline(0.03, 0.065)], 0.008),
  'crop':    ([above(1.07), armsTo(0.32), noNeck, neckline(0.04, 0.07)], 0.006),
  'sweater': ([above(0.88), armsTo(0.97), noNeck, neckline(0.015, 0.06)], 0.01),
  'gtop':    ([above(1.07), armsTo(0.97), noNeck, neckline(0.1, 0.06)], 0.007),
  'skirtTop':([above(0.93), below(1.06), noArms], 0.008),
  'jeans':   ([below(1.04), legsTo(0.075), noArms], 0.006),
  'wide':    ([below(1.04), legsTo(0.06), noArms], 0.01),
  'gshorts': ([below(1.05), legsTo(0.6), noArms], 0.008),
  'dre1':    ([above(0.97), below(1.22), noArms, noNeck], 0.006),
  'dre2':    ([above(0.97), below(1.25), noArms, noNeck], 0.007),
  'dre3':    ([above(0.97), armsTo(0.97), noNeck, neckline(0.05, 0.07)], 0.007),
}
FLARE = {
  'jeans': lambda Q: 0.03 * np.clip((0.32 - Q[:, 1]) / 0.25, 0, 1) * (Q[:, 1] < 0.6),
  'wide': lambda Q: 0.012 + 0.04 * np.clip((0.75 - Q[:, 1]) / 0.6, 0, 1) * (Q[:, 1] < 0.75),
  'gtop': lambda Q: 0.03 * np.clip((A_t(Q) - 0.55) / 0.4, 0, 1),
}
def A_t(Q):  # t lungo il braccio per i punti già spostati
    tl = along(Q, J['shL'], J['wrL']); tr = along(Q, J['shR'], J['wrR'])
    t = np.where(Q[:, 0] < 0, tl, tr); armlike = np.abs(Q[:, 0]) > 0.14
    return np.where(armlike, t, 0)

for k, (fields, pad) in G.items():
    garment(k, fields, pad, FLARE.get(k))

# scarpe: piede lisciato (niente dita) e ingrossato
for name, ytop, pad in [('sho1', 0.045, 0.005), ('sho2', 0.085, 0.007), ('sho3', 0.042, 0.004), ('sock', 0.15, 0.003), ('sole2', 0.02, 0.011)]:
    garment(name, [below(ytop)], pad, smooth_it=6 if name != 'sock' else 2)

# profilo del busto (per gonne, cinture, bottoni): [y, mezza larghezza, davanti, dietro] senza braccia
rows = []
for y in np.arange(0.3, 1.31, 0.02):
    m = (np.abs(P[:, 1] - y) < 0.011) & (armW < 0.5)
    q = P[m]; rows.append([round(float(y), 3), round(float(np.abs(q[:, 0]).max()), 4), round(float(q[:, 2].max()), 4), round(float(-q[:, 2].min()), 4)])
json.dump(rows, open('profile.json', 'w'))
print('profile rows', len(rows))
