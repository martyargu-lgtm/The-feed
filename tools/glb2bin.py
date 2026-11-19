import numpy as np, sys, struct, subprocess
from glb import read
def cluster(P, F, cell):
    k = np.floor((P - P.min(0)) / cell).astype(np.int64); key = (k[:, 0] * 4096 + k[:, 1]) * 4096 + k[:, 2]
    u, inv = np.unique(key, return_inverse=True); inv = inv.ravel()
    C = np.zeros((len(u), 3)); np.add.at(C, inv, P); C /= np.bincount(inv)[:, None]
    F2 = inv[F]; ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2]); F2 = F2[ok]
    F2 = np.unique(np.sort(F2, 1) * 0 + F2, axis=0)
    return C.astype(np.float32), F2.astype(np.int32)
def main():
  for fn, out, target in zip(sys.argv[1::3], sys.argv[2::3], sys.argv[3::3]):
      g, b, acc = read(fn); p = g['meshes'][0]['primitives'][0]
      P = acc(p['attributes']['POSITION']).astype(np.float64); F = acc(p['indices']).reshape(-1, 3).astype(np.int64)
      if len(F) > 900000: P, F = cluster(P, F, float(__import__("os").environ.get("CELL", "0.0032")))
      with open('/tmp/in.bin', 'wb') as o:
          o.write(struct.pack('<ii', len(P), len(F))); o.write(P.astype(np.float32).tobytes()); o.write(np.zeros(len(P), np.uint8).tobytes()); o.write(F.astype(np.int32).tobytes())
      subprocess.run(['./qem', '/tmp/in.bin', '/tmp/out.bin', target], check=True)
      d = open('/tmp/out.bin', 'rb').read(); n2, nf2 = struct.unpack('<ii', d[:8]); remap = np.frombuffer(d, np.int32, len(P), 8); F2 = np.frombuffer(d, np.int32, nf2 * 3, 8 + 4 * len(P)).reshape(-1, 3)
      keep = np.where(remap >= 0)[0]; order = np.empty(n2, np.int64); order[remap[keep]] = keep
      np.savez(out, P=P[order].astype(np.float32), F=F2)
      print(out, n2, nf2)

if __name__ == "__main__": main()
