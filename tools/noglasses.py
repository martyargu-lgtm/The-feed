import numpy as np, struct
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
d=open('giulia_rig.bin','rb').read(); nv,nf,fl=struct.unpack('<iii',d[:12]); o=12
P=np.frombuffer(d,np.float32,nv*3,o).reshape(-1,3); o+=nv*24
UV=np.frombuffer(d,np.float32,nv*2,o).reshape(-1,2); o+=nv*8+nv*20
F=np.frombuffer(d,np.uint32,nf*3,o).reshape(-1,3)
im=np.array(Image.open('giulia_tex_orig.jpg').convert('RGB')).astype(np.float32); H,W,_=im.shape
c=P[F].mean(1); x,y,z=c[:,0],c[:,1],c[:,2]
sel=(y>1.40)&(y<1.54)&(z>-0.04)&(np.abs(x)<0.16)
mask=Image.new('L',(W,H),0); dr=ImageDraw.Draw(mask)
for t in F[sel]:
    dr.polygon([(UV[v,0]*W,(1-UV[v,1])*H) for v in t],fill=255)
face=np.array(mask)>0; face=ndi.binary_dilation(face,iterations=2)
r,g,b=im[...,0],im[...,1],im[...,2]; mx=im.max(2); mn=im.min(2)
white=(mn>200)&(mx-mn<45)&face
dark=(mx<90)&face
lab,n=ndi.label(white)
near_dark=ndi.binary_dilation(dark,iterations=3)
keep_ids=np.unique(lab[near_dark&white]); rim=white&~np.isin(lab,keep_ids)
eyes=ndi.binary_dilation(np.isin(lab,keep_ids[keep_ids>0])|dark,iterations=4)
L=im.mean(2); med=ndi.median_filter(L,size=31)
light=(L>med+14)&face&~eyes
rim=ndi.binary_dilation(rim|light,iterations=3)&face&~ndi.binary_dilation(dark,iterations=1)&~ndi.binary_dilation(np.isin(lab,keep_ids[keep_ids>0]),iterations=1)
print('face px',face.sum(),'rim px',rim.sum(),'comps',n)
out=im.copy(); unknown=rim.copy()
for it in range(40):
    if not unknown.any(): break
    known=~unknown
    s=ndi.uniform_filter(out*known[...,None],size=(5,5,1)); w=ndi.uniform_filter(known.astype(np.float32),size=5)
    fill=unknown&(w>0.05)
    out[fill]=s[fill]/w[fill][:,None]; unknown&=~fill
# seconda passata: nella fascia degli occhiali la pelle diventa uniforme (via aloni e lenti)
sel2=(y>1.44)&(y<1.535)&(z>-0.04)&(np.abs(x)<0.16)
m2=Image.new('L',(W,H),0); d2=ImageDraw.Draw(m2)
for t in F[sel2]: d2.polygon([(UV[v,0]*W,(1-UV[v,1])*H) for v in t],fill=255)
band=np.array(m2)>0
Lo=out.mean(2); protect=ndi.binary_dilation(eyes|(Lo<150),iterations=3)
cand=band&~protect
skin=cand&(np.abs(Lo-ndi.median_filter(Lo,size=41))<6)
s_=ndi.uniform_filter(out*skin[...,None],size=(41,41,1)); w_=ndi.uniform_filter(skin.astype(np.float32),size=41)
ok=cand&(w_>0.02)
smooth=s_/np.maximum(w_,1e-6)[...,None]
a=ndi.gaussian_filter(ok.astype(np.float32),2)[...,None]
out=out*(1-a)+smooth*a*(w_[...,None]>0.02)+out*a*(w_[...,None]<=0.02)
Image.fromarray(out.clip(0,255).astype(np.uint8)).save('/home/claude/game/assets/models/giulia_tex.jpg',quality=90)
Image.fromarray((rim*255).astype(np.uint8)).save('/tmp/rim.png')
