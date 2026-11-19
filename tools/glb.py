import json, struct, sys, numpy as np
CT={5126:np.float32,5123:np.uint16,5125:np.uint32,5121:np.uint8}
N={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def read(fn):
    d=open(fn,'rb').read(); jl=struct.unpack('<I',d[12:16])[0]; g=json.loads(d[20:20+jl]); o=20+jl; bl=struct.unpack('<I',d[o:o+4])[0]; b=d[o+8:o+8+bl]
    def acc(i):
        a=g['accessors'][i]; bv=g['bufferViews'][a['bufferView']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0)
        n=N[a['type']]; arr=np.frombuffer(b,CT[a['componentType']],a['count']*n,off).reshape(a['count'],n)
        if a.get('normalized') and a['componentType']==5123: arr=arr/65535.0
        return arr.astype(np.float32) if a['componentType']==5126 or a.get('normalized') else arr
    return g,b,acc
if __name__=='__main__':
    for fn in sys.argv[1:]:
        g,b,acc=read(fn)
        print('==',fn.split('/')[-1][:60], 'meshes',len(g['meshes']),'nodes',[ (n.get('name'),n.get('matrix') or n.get('scale'),n.get('rotation')) for n in g['nodes']][:3], 'imgs',len(g.get('images',[])), 'skins',len(g.get('skins',[])))
        for m in g['meshes']:
            for p in m['primitives']:
                A=p['attributes']; pos=acc(A['POSITION']); print('  attrs',list(A), 'v',len(pos),'f',g['accessors'][p['indices']]['count']//3,'bbox',pos.min(0).round(3),pos.max(0).round(3), 'mat',p.get('material'))
        print('  mats',[ (m.get('name'), m.get('pbrMetallicRoughness',{}).get('baseColorFactor'), 'tex' if 'baseColorTexture' in m.get('pbrMetallicRoughness',{}) else '') for m in g.get('materials',[])])
        for im in g.get('images',[]): print('  img',im.get('mimeType'), g['bufferViews'][im['bufferView']]['byteLength'])
