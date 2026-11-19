import numpy as np, sys
from glb import read
from glb2bin import cluster
fn,out,cell=sys.argv[1],sys.argv[2],float(sys.argv[3])
g,b,acc=read(fn); p=g['meshes'][0]['primitives'][0]
P=acc(p['attributes']['POSITION']).astype(np.float64); F=acc(p['indices']).reshape(-1,3).astype(np.int64)
P2,F2=cluster(P,F,cell); np.savez(out,P=P2,F=F2); print(len(P2),len(F2))
