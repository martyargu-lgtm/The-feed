# Capigliature dai busti Meshy: allineamento alla testa del manichino, separazione capelli/pelle, orli puliti, calotta.
import numpy as np, struct, sys, json
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from rig import save, SCALE

def vnorm(P, F):
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); n = np.zeros_like(P)
    for k in range(3): np.add.at(n, F[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)

def adjacency(F, n):
    e = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); e = np.concatenate([e, e[:, ::-1]])
    A = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)).tocsr(); A.data[:] = 1
    return A

def smooth_field(f, A, it):
    deg = np.asarray(A.sum(1)).ravel() + 1
    if f.ndim == 2: deg = deg[:, None]
    for _ in range(it): f = (A @ f + f) / deg
    return f

def clip(P, F, f):
    P = list(P); out = []; cache = {}; fl = list(f)
    def cut(a, b):
        k = (min(a, b), max(a, b))
        if k in cache: return cache[k]
        t = fl[a] / (fl[a] - fl[b]); P.append(P[a] + (P[b] - P[a]) * t); fl.append(0.0); cache[k] = len(P) - 1; return cache[k]
    for tri in F:
        ins = [fl[v] >= 0 for v in tri]; c = sum(ins)
        if c == 3: out.append(list(tri)); continue
        if c == 0: continue
        if c == 1:
            i = ins.index(True); a, b, d = tri[i], tri[(i + 1) % 3], tri[(i + 2) % 3]; out.append([a, cut(a, b), cut(a, d)])
        else:
            i = ins.index(False); d, a, b = tri[i], tri[(i + 1) % 3], tri[(i + 2) % 3]; ca, cb = cut(d, a), cut(d, b); out.append([a, b, cb]); out.append([a, cb, ca])
    P = np.array(P); F = np.array(out, np.int64); u, inv = np.unique(F, return_inverse=True)
    return P[u], inv.reshape(-1, 3)

# manichino ad alta risoluzione, nella stessa posizione del corpo del gioco
hr = np.load('Meshy_AI_Base_Body_Mannequin_20261118_generate.obj.npz')
MP = hr['v'].astype(np.float64) * SCALE; MP[:, 1] -= MP[:, 1].min()
m = (MP[:, 1] > 0.85) & (MP[:, 1] < 1.25); MP[:, 0] -= MP[m, 0].mean(); MP[:, 2] -= (MP[m, 2].max() + MP[m, 2].min()) / 2
MF = hr['fv'].astype(np.int64)
headV = MP[:, 1] > 1.3
mtree = cKDTree(MP)
head_tree = cKDTree(MP[headV]); headP = MP[headV]

def icp_from(M, B, bt, R, s, t, it=40):
    for _ in range(it):
        X = (M @ R.T) * s + t; dist, idx = bt.query(X); Y = B[idx]; keep = dist < np.percentile(dist, 85)
        A, Bq = M[keep], Y[keep]; mA, mB = A.mean(0), Bq.mean(0); A0, B0 = A - mA, Bq - mB
        U, Sg, Vt = np.linalg.svd(B0.T @ A0 / len(A)); D = np.eye(3); D[2, 2] = np.sign(np.linalg.det(U @ Vt))
        R = U @ D @ Vt; s = np.trace(np.diag(Sg) @ D) / (A0 ** 2).sum(1).mean(); t = mB - s * R @ mA
    X = (M @ R.T) * s + t; dist, _ = bt.query(X)
    return R, s, t, np.median(dist) / s

def align(B):
    M = headP[(headP[:, 2] > 0.03) & (headP[:, 1] < 1.50) & (headP[:, 1] > 1.355) & (np.abs(headP[:, 0]) < 0.09)]
    bt = cKDTree(B); mc = M.mean(0); Ms = M[::4]; best = None
    for sc in np.arange(2.6, 7.0, 0.12):
        for oy in np.arange(-0.4, 0.45, 0.03):
            for oz in np.arange(0.1, 0.85, 0.04):
                Y = (Ms - mc) * sc + [0, oy, oz]; dist, _ = bt.query(Y); sco = np.median(dist) / sc
                if best is None or sco < best[0]: best = (sco, sc, oy, oz)
    _, sc, oy, oz = best
    R, s, t, err = icp_from(M, B, bt, np.eye(3), sc, np.array([0, oy, oz]) - sc * mc)
    Ri = R.T; si = 1 / s; ti = -si * (Ri @ t)
    return Ri, si, ti, err

def hair(name, npz, col_out):
    d = np.load(npz); B = d['P'].astype(np.float64); F = d['F'].astype(np.int64)
    import os
    cf = 'heads/%s_align.npz' % name
    if os.path.exists(cf): c = np.load(cf); R, s, t, err = c['R'], float(c['s']), c['t'], float(c['err'])
    else: R, s, t, err = align(B); np.savez(cf, R=R, s=s, t=t, err=err)
    X = (B @ R.T) * s + t
    # spessore locale (nello spazio del busto): ciocche e trecce sono sottili, il corpo del busto è pieno
    BN = vnorm(B, F); btree = cKDTree(B); thick = np.full(len(B), 9.0)
    for k in np.arange(0.01, 0.2, 0.01):
        Q = B - BN * k; _, ii = btree.query(Q); outside = ((Q - B[ii]) * BN[ii]).sum(1) > 0
        thick = np.where((thick == 9.0) & outside, k * s, thick)
    dd, _ = mtree.query(X)
    # sotto il collo il busto ha il suo corpo: si allinea anche il busto del manichino (spalle/petto) e si misura da quello
    TM = MP[(MP[:, 1] > 1.12) & (MP[:, 1] < 1.33) & (np.abs(MP[:, 0]) < 0.2)][::3]
    low = X[:, 1] < 1.36; XL = X[low]; tl = cKDTree(XL); R2 = np.eye(3); s2 = 1.0; t2 = np.zeros(3)
    for it in range(40):
        Y = (TM @ R2.T) * s2 + t2; dist2, idx = tl.query(Y); keep = dist2 < np.percentile(dist2, 60)
        A_, B_ = TM[keep], XL[idx[keep]]; mA, mB = A_.mean(0), B_.mean(0); A0, B0 = A_ - mA, B_ - mB
        U, Sg, Vt = np.linalg.svd(B0.T @ A0 / len(A_)); D = np.eye(3); D[2, 2] = np.sign(np.linalg.det(U @ Vt))
        R2 = U @ D @ Vt; s2 = np.trace(np.diag(Sg) @ D) / (A0 ** 2).sum(1).mean(); t2 = mB - s2 * R2 @ mA
    TMf = (MP[(MP[:, 1] > 1.0) & (MP[:, 1] < 1.36)] @ R2.T) * s2 + t2
    dlow, _ = cKDTree(TMf).query(X)
    dd = np.where(X[:, 1] < 1.3, dlow, np.where(X[:, 1] < 1.36, np.minimum(dd, dlow), dd))
    body = (X[:, 1] < 1.34) & (thick > 0.035)      # parte piena sotto il collo = corpo del busto
    if name == 'straight': body &= ~((X[:, 2] < -0.035) & (np.abs(X[:, 0]) < 0.115))   # capelli lunghi: la schiena del busto sta sotto la chioma, la si tiene per chiudere i buchi
    dd = np.where(body, 0.0, dd)
    print('  torso fit scale %.3f err %.4f' % (s2, dist2[keep].mean()))
    # segno: fuori/dentro dal manichino (con la normale del vertice più vicino)
    x, y, z = X[:, 0], X[:, 1], X[:, 2]; ax = np.abs(x)
    face = (z > 0.03) & (ax < 0.105) & (y < 1.505) & (y > 1.33)
    thr = np.where(y < 1.33, 0.006, np.where(face, 0.03, np.where((z > 0.04) & (y < 1.56), 0.0035, 0.005)))
    ear = (ax > 0.115) & (y > 1.415) & (y < 1.505) & (z > -0.04) & (z < 0.04) & (dd < 0.006)
    f = dd - thr; f[ear] = -0.01
    A = adjacency(F, len(X)); f = smooth_field(f, A, 12)
    HP, HF = clip(X, F, f)
    # tieni i pezzi grandi attaccati alla testa
    n = len(HP); e = np.concatenate([HF[:, [0, 1]], HF[:, [1, 2]]]); G = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n))
    nc, lab = connected_components(G, directed=False)
    cnt = np.bincount(lab[HF[:, 0]], minlength=nc); onhead = np.bincount(lab, weights=(HP[:, 1] > 1.45).astype(float), minlength=nc)
    good = (cnt > 150) & (onhead > 20) | (cnt > 3000)
    HF = HF[good[lab[HF[:, 0]]]]; u, inv = np.unique(HF, return_inverse=True); HP = HP[u]; HF = inv.reshape(-1, 3)
    # adattamento radiale: lo strato interno dei capelli si appoggia al cranio del manichino (niente capelli dentro la testa o sospesi)
    C = np.array([0, 1.49, -0.02]); V = HP - C; r = np.linalg.norm(V, axis=1); Dn = V / r[:, None]
    th = np.arccos(np.clip(Dn[:, 1], -1, 1)); ph = np.arctan2(Dn[:, 0], Dn[:, 2])
    nb = 36; bi = np.clip((th / np.pi * nb).astype(int), 0, nb - 1); bj = ((ph + np.pi) / (2 * np.pi) * nb * 2).astype(int) % (nb * 2)
    rmin = np.full((nb, nb * 2), np.nan); np.fmin.at(rmin, (bi, bj), r)
    # raggio del manichino per cella
    Vm = headP - C; rm_ = np.linalg.norm(Vm, axis=1); Dm = Vm / rm_[:, None]
    mi = np.clip((np.arccos(np.clip(Dm[:, 1], -1, 1)) / np.pi * nb).astype(int), 0, nb - 1); mj = ((np.arctan2(Dm[:, 0], Dm[:, 2]) + np.pi) / (2 * np.pi) * nb * 2).astype(int) % (nb * 2)
    rmax = np.full((nb, nb * 2), np.nan); np.fmax.at(rmax, (mi, mj), rm_)
    shift = np.clip(rmax + 0.003 - rmin, -0.012, 0.08); shift = np.where(np.isnan(shift), 0, shift)
    from scipy.ndimage import uniform_filter
    shift = uniform_filter(shift, size=3, mode='wrap')
    w = np.clip((HP[:, 1] - 1.36) / 0.08, 0, 1) * (th < 2.3)
    HP = HP + Dn * (shift[bi, bj] * w)[:, None]
    HN = vnorm(HP, HF)
    dm, im_ = mtree.query(HP); MN_ = vnorm(MP, MF)[im_]
    inside = ((HP - MP[im_]) * MN_).sum(1) < 0.004
    push = inside & (HP[:, 1] < 1.37)
    HP[push] = MP[im_][push] + MN_[push] * 0.005
    # calotta: testa del manichino dove sopra ci sono capelli (campo trasferito dal busto, poi lisciato)
    bt = cKDTree(X); dk, ik = bt.query(MP, k=4); fm = (f[ik] / (dk + 1e-4)).sum(1) / (1 / (dk + 1e-4)).sum(1)
    my, mz, max_ = MP[:, 1], MP[:, 2], np.abs(MP[:, 0])
    mface = (mz > 0.0) & (max_ < 0.115) & (my < 1.50)
    fm = np.where((my < 1.40) | mface, -1, fm + 0.003)
    sel = (my[MF] > 1.36).all(1); SFm = MF[sel]; u, inv = np.unique(SFm, return_inverse=True); SP0 = MP[u]; SF0 = inv.reshape(-1, 3)
    fs = smooth_field(fm[u], adjacency(SF0, len(SP0)), 8)
    SP, SF = clip(SP0, SF0, fs); SN = vnorm(SP, SF); SP = SP + SN * 0.0012
    # unisci, pesi tutti sulla testa (osso 9)
    P2 = np.concatenate([HP, SP]); N2 = np.concatenate([HN, SN]); F2 = np.concatenate([HF, SF + len(HP)])
    JI = np.zeros((len(P2), 4), np.uint8); JI[:, 0] = 9; JW = np.zeros((len(P2), 4), np.float32); JW[:, 0] = 1
    save(col_out, P2.astype(np.float32), N2.astype(np.float32), None, F2, JI, JW)
    print(name, 'icp err %.4f scale %.3f' % (err, s), 'hair faces', len(HF), 'scalp faces', len(SF))

if __name__ == '__main__':
    for nm in sys.argv[1:]:
        hair(nm, 'heads/%s.npz' % nm, 'hair_%s.bin' % nm)
