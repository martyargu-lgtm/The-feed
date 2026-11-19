# Capelli da tutti i busti (femminili e maschili): solo ciocche, niente orecchie/fronte del busto,
# cuoio capelluto solo sotto i capelli, ombreggiatura (radici scure, solchi tra le ciocche) nelle UV.
import numpy as np, os, sys
from scipy.spatial import cKDTree
import heads
from heads import vnorm, adjacency, smooth_field, clip, MP, MF, headP
from rig import save

MN = vnorm(MP, MF); mtree = cKDTree(MP)

def aligned(name):
    d = np.load('heads/%s.npz' % name); B = d['P'].astype(np.float64); F = d['F'].astype(np.int64)
    old = 'heads/%s_align.npz' % name
    if name in ('bob', 'bun', 'braids', 'straight') and os.path.exists(old):   # allineamenti già verificati
        c = np.load(old); return (B @ c['R'].T) * float(c['s']) + c['t'], F, float(c['s'])
    cf = 'heads/%s_align2.npz' % name
    if os.path.exists(cf): c = np.load(cf); s, t = float(c['s']), c['t']
    elif name == 'mcurly':   # inquadratura identica al busto liscio: si parte da quello e si raffina
        c = np.load('heads/mstraight_align2.npz'); s, t = refine(B, float(c['s']), c['t']); np.savez(cf, s=s, t=t)
    else: s, t = align2(B); np.savez(cf, s=s, t=t)
    return B * s + t, F, s

def refine(B, s, t):
    M = headP[(headP[:, 2] > 0.03) & (headP[:, 1] < 1.50) & (headP[:, 1] > 1.345) & (np.abs(headP[:, 0]) < 0.09)]
    bt = cKDTree(B); sc = 1 / s; tt = -t / s
    for _ in range(40):
        Y = M * sc + tt; d, ii = bt.query(Y); k = d < np.percentile(d, 80); A = M[k]; Bq = B[ii[k]]
        mA, mB = A.mean(0), Bq.mean(0); sc = ((A - mA) * (Bq - mB)).sum() / ((A - mA) ** 2).sum(); tt = mB - sc * mA
    print('  refine scale %.3f err %.4f' % (1 / sc, np.median(d) / sc)); return 1 / sc, -tt / sc

def align2(B):
    # i busti sono dritti e frontali: solo scala + traslazione, sulla parte bassa del viso (mai coperta dai capelli)
    M = headP[(headP[:, 2] > 0.03) & (headP[:, 1] < 1.50) & (headP[:, 1] > 1.345) & (np.abs(headP[:, 0]) < 0.09)]
    bt = cKDTree(B); Ms = M[::3]; mc = M.mean(0); best = None
    for sc in np.arange(2.4, 7.2, 0.15):
        for oy in np.arange(-0.45, 0.45, 0.04):
            for oz in np.arange(0.05, 0.9, 0.05):
                Y = (Ms - mc) * sc + [0, oy, oz]; d, _ = bt.query(Y); v = np.mean(np.minimum(d, 0.05 * sc)) / sc
                if best is None or v < best[0]: best = (v, sc, oy, oz)
    _, sc, oy, oz = best; t = np.array([0, oy, oz]) - sc * mc
    for _ in range(40):   # raffinamento: scala e traslazione (busto = sc*M + t)
        Y = M * sc + t; d, ii = bt.query(Y); k = d < np.percentile(d, 80); A = M[k]; Bq = B[ii[k]]
        mA, mB = A.mean(0), Bq.mean(0); sc = ((A - mA) * (Bq - mB)).sum() / ((A - mA) ** 2).sum(); t = mB - sc * mA
    print('  align scale %.3f err %.4f' % (1 / sc, np.median(d) / sc))
    return 1 / sc, -t / sc

def rough_of(P, F, A):
    N = vnorm(P, F); Ns = N.copy()
    for _ in range(3): Ns = smooth_field(Ns, A, 1)
    r = 1 - (N * Ns).sum(1) / (np.linalg.norm(Ns, axis=1) + 1e-9)
    return smooth_field(r, A, 3)

def zones(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]; ax = np.abs(x)
    face = (z > 0.02) & (ax < 0.11) & (y < 1.505) & (y > 1.33)
    ear = (ax > 0.09) & (ax < 0.185) & (y > 1.37) & (y < 1.525) & (z > -0.08) & (z < 0.07)
    forehead = (z > 0.03) & (ax < 0.12) & (y >= 1.47) & (y < 1.565)
    return face, ear, forehead

def extract(name, long_hair):
    X, F, s = aligned(name)
    if not long_hair: X, F = clip(X, F, X[:, 1] - 1.37)
    A = adjacency(F, len(X)); rough = rough_of(X, F, A)
    dd, im = mtree.query(X); side = ((X - MP[im]) * MN[im]).sum(1)   # >0 fuori dal manichino
    face, ear, forehead = zones(X)
    y = X[:, 1]
    if long_hair:   # sotto il collo: ciocche sottili sì, corpo del busto no
        BN = vnorm(X, F); bt = cKDTree(X); thick = np.full(len(X), 9.0)
        for k in np.arange(0.003, 0.051, 0.003):
            Q = X - BN * k; _, ii = bt.query(Q); out = ((Q - X[ii]) * BN[ii]).sum(1) > 0
            thick = np.where((thick == 9.0) & out, k, thick)
        body = (y < 1.36) & (thick > 0.042)          # il busto è spesso: trecce e ciocche no
    else: body = np.zeros(len(X), bool)
    f = np.where(side > 0, dd, -dd) - 0.004
    ax = np.abs(X[:, 0])
    f = np.where(face, np.where(y > 1.47, np.minimum(f, 0.25 * (rough - 0.2)), -0.03), f)   # sul viso solo la frangia
    low = (y < 1.43) & (ax < 0.135) & (X[:, 2] > -0.04)
    f = np.where(low, np.minimum(f, 0.25 * (rough - 0.1)), f)
    f = np.where(forehead, np.minimum(f, 0.25 * (rough - 0.1)), f)           # fronte liscia = pelle
    f = np.where(ear, np.minimum(f, np.minimum(dd - 0.014, 0.25 * (rough - 0.22))), f)   # l'orecchio del busto non è capelli
    f = np.where(body, -0.02, f)
    if not long_hair:   # tagli corti: orecchie e guance sempre pelle
        f = np.where(ear | ((y < 1.445) & (ax > 0.085)), -0.03, f)
    f = smooth_field(f, A, 6)
    HP, HF = clip(X, F, f)
    # pezzi piccoli staccati via
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    n = len(HP); e = np.concatenate([HF[:, [0, 1]], HF[:, [1, 2]]])
    nc, lab = connected_components(coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)), directed=False)
    cnt = np.bincount(lab[HF[:, 0]], minlength=nc); HF = HF[cnt[lab[HF[:, 0]]] > 60]
    u, inv = np.unique(HF, return_inverse=True); HP = HP[u]; HF = inv.reshape(-1, 3)
    # niente capelli dentro il cranio
    dd2, im2 = mtree.query(HP); s2 = ((HP - MP[im2]) * MN[im2]).sum(1)
    inside = s2 < 0.0015; HP[inside] = MP[im2][inside] + MN[im2][inside] * 0.0015
    return HP, HF

def cap(HP, thick=0.0012):
    # cuoio capelluto: solo dove sopra ci sono davvero capelli, ritirato di ~1 cm dal bordo
    sel = (MP[MF][:, :, 1] > 1.36).all(1); SF0 = MF[sel]; u, inv = np.unique(SF0, return_inverse=True); SP0 = MP[u]; SN0 = MN[u]; SF0 = inv.reshape(-1, 3)
    ht = cKDTree(HP); cov = np.zeros(len(SP0))
    for i, nb in enumerate(ht.query_ball_point(SP0, 0.05)):
        if nb:
            v = HP[nb] - SP0[i]; a = v @ SN0[i]; lat = np.linalg.norm(v - a[:, None] * SN0[i], axis=1)
            cov[i] = float(((a > 0.0005) & (lat < 0.01 + 0.25 * a)).any())
    face, ear, _ = zones(SP0); cov[face | ear] = 0
    cov = smooth_field(cov, adjacency(SF0, len(SP0)), 10) - 0.6
    CP, CF = clip(SP0, SF0, cov); _, ii = cKDTree(SP0).query(CP)
    CP = CP + SN0[ii] * thick
    return CP, CF

def shade(HP, HF, seed=0):
    A = adjacency(HF, len(HP)); N = vnorm(HP, HF)
    dd, _ = mtree.query(HP); occ = np.clip(dd / 0.03, 0, 1)
    Ps = smooth_field(HP.copy(), A, 4); cav = np.clip(((HP - Ps) * N).sum(1) / 0.0015, -1, 1)
    rng = np.random.default_rng(seed); noise = rng.normal(0, 1, len(HP)); noise = smooth_field(noise, A, 2) * 0.8
    return np.clip(0.42 + 0.42 * occ + 0.14 * cav + 0.05 * noise, 0.25, 1.0)

def write(out, parts):
    P = []; Fs = []; U = []; o = 0
    for p, f, u in parts: P.append(p); Fs.append(f + o); U.append(u); o += len(p)
    P = np.concatenate(P); F = np.concatenate(Fs); U = np.concatenate(U)
    N = vnorm(P, F); UV = np.stack([U, np.full(len(U), 0.5)], 1).astype(np.float32)
    JI = np.zeros((len(P), 4), np.uint8); JI[:, 0] = 9; JW = np.zeros((len(P), 4), np.float32); JW[:, 0] = 1
    save(out, P.astype(np.float32), N.astype(np.float32), UV, F, JI, JW); print(out, len(F))

def shorten(HP, k):
    dd, im = mtree.query(HP); return MP[im] + (HP - MP[im]) * np.where(HP[:, 1] > 1.36, k, 1)[:, None]

if __name__ == '__main__':
    STY = {'curls': True, 'bob': True, 'bun': True, 'braids': True, 'straight': True, 'mstraight': False, 'mcurly': False}
    for nm in sys.argv[1:]:
        HP, HF = extract(nm, STY[nm]); CP, CF = cap(HP)
        write('hair3_%s.bin' % nm, [(HP, HF, shade(HP, HF)), (CP, CF, np.full(len(CP), 0.4))])
        if nm == 'bun':   # chignon ordinato: niente ciocche libere davanti alle orecchie
            P2, F2 = clip(HP, HF, np.where(HP[:, 2] > -0.06, HP[:, 1] - 1.47, 1.0))
            write('hair3_bunneat.bin', [(P2, F2, shade(P2, F2)), (CP, CF, np.full(len(CP), 0.4))])
        if not STY[nm]:   # varianti maschili: taglio corto e rasato
            S = shorten(HP, 0.5); write('hair3_%s_short.bin' % nm, [(S, HF, shade(S, HF)), (CP, CF, np.full(len(CP), 0.4))])
            BP, BF = cap(HP, 0.0028); write('hair3_%s_buzz.bin' % nm, [(BP, BF, np.full(len(BP), 0.55))])
