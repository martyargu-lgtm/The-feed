import numpy as np, sys, os, subprocess, struct
def parse(path):
    cache = path + '.npz'
    if os.path.exists('/home/claude/meshy/' + os.path.basename(cache)): 
        d = np.load('/home/claude/meshy/' + os.path.basename(cache)); return d['v'], d['vt'], d['fv'], d['ft']
    V, VT, FV, FT = [], [], [], []
    with open(path) as f:
        for line in f:
            if line.startswith('v '): V.append(line[2:])
            elif line.startswith('vt '): VT.append(line[3:])
            elif line.startswith('f '):
                a = [p.split('/') for p in line[2:].split()]
                FV.append([int(x[0]) - 1 for x in a[:3]])
                FT.append([int(x[1]) - 1 if len(x) > 1 and x[1] else -1 for x in a[:3]])
    v = np.loadtxt(V, dtype=np.float32); vt = np.loadtxt(VT, dtype=np.float32)[:, :2] if VT else np.zeros((0, 2), np.float32)
    fv = np.array(FV, np.int32); ft = np.array(FT, np.int32)
    np.savez('/home/claude/meshy/' + os.path.basename(cache), v=v, vt=vt, fv=fv, ft=ft); return v, vt, fv, ft
def decimate(v, vt, fv, ft, target):
    hasuv = len(vt) > 0
    if hasuv:
        key = fv.astype(np.int64) * (len(vt) + 1) + ft
        uniq, inv = np.unique(key.ravel(), return_inverse=True)
        wpos = (uniq // (len(vt) + 1)).astype(np.int64); wuv = (uniq % (len(vt) + 1)).astype(np.int64)
        F = inv.reshape(-1, 3).astype(np.int32); P = v[wpos]; UV = vt[wuv]
        cnt = np.bincount(wpos, minlength=len(v)); lock = (cnt[wpos] > 1).astype(np.uint8)
    else:
        F = fv.copy(); P = v; UV = None; wpos = np.arange(len(v)); lock = np.zeros(len(v), np.uint8)
    # bordi aperti bloccati
    e = np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1)
    ek = e[:, 0].astype(np.int64) * len(P) + e[:, 1]; u, c = np.unique(ek, return_counts=True)
    b = u[c == 1]; lock[(b // len(P)).astype(np.int64)] = 1; lock[(b % len(P)).astype(np.int64)] = 1
    with open('/tmp/in.bin', 'wb') as o:
        o.write(struct.pack('<ii', len(P), len(F))); o.write(P.astype(np.float32).tobytes()); o.write(lock.tobytes()); o.write(F.astype(np.int32).tobytes())
    subprocess.run(['/home/claude/meshy/qem', '/tmp/in.bin', '/tmp/out.bin', str(target)], check=True)
    d = open('/tmp/out.bin', 'rb').read(); n2, nf2 = struct.unpack('<ii', d[:8])
    remap = np.frombuffer(d, np.int32, len(P), 8); F2 = np.frombuffer(d, np.int32, nf2 * 3, 8 + 4 * len(P)).reshape(-1, 3)
    keep = np.where(remap >= 0)[0]; order = np.empty(n2, np.int64); order[remap[keep]] = keep
    P2 = P[order]; UV2 = UV[order] if UV is not None else None; W2 = wpos[order]
    # normali lisce, saldate per posizione originale
    fn = np.cross(P2[F2[:, 1]] - P2[F2[:, 0]], P2[F2[:, 2]] - P2[F2[:, 0]])
    acc = np.zeros((len(v), 3), np.float64)
    for k in range(3): np.add.at(acc, W2[F2[:, k]], fn)
    N2 = acc[W2]; N2 /= np.linalg.norm(N2, axis=1, keepdims=True) + 1e-12
    return P2.astype(np.float32), N2.astype(np.float32), UV2, F2
def save(out, P, N, UV, F):
    with open(out, 'wb') as o:
        o.write(struct.pack('<iii', len(P), len(F), 1 if UV is not None else 0)); o.write(P.tobytes()); o.write(N.tobytes())
        if UV is not None: o.write(UV.astype(np.float32).tobytes())
        o.write(F.astype(np.uint32).tobytes())
if __name__ == '__main__':
    src, out, target = sys.argv[1], sys.argv[2], int(sys.argv[3])
    v, vt, fv, ft = parse(src); print('loaded', v.shape, vt.shape, fv.shape, 'bbox', v.min(0), v.max(0))
    P, N, UV, F = decimate(v, vt, fv, ft, target); save(out, P, N, UV, F); print('saved', out, len(P), len(F))
