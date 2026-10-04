"""Convert attributed mesh geometry to surface samples; no photographic textures."""
import json, struct, pathlib, numpy as np

def grid_sample(p,f,norm=None,spacing=.014):
 if norm is None:
  norm=np.zeros_like(p)
  for face in f:
   a,b,c=p[face];n=np.cross(b-a,c-a)
   for idx in face:norm[idx]+=n
  norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-12)
 # Frontmost and rearmost positions at a regular XY grid: 3D ray/triangle intersections.
 grid={}
 for face in f:
  tri=p[face];x0,x1=np.floor(tri[:,0].min()/spacing).astype(int),np.ceil(tri[:,0].max()/spacing).astype(int)
  y0,y1=np.floor(tri[:,1].min()/(spacing*1.4)).astype(int),np.ceil(tri[:,1].max()/(spacing*1.4)).astype(int)
  a,b,c=tri;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-10:continue
  for ix in range(x0,x1+1):
   for iy in range(y0,y1+1):
    x,y=ix*spacing,iy*spacing*1.4;w0=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den;w1=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;w2=1-w0-w1
    if min(w0,w1,w2)<-1e-7:continue
    weights=np.array([w0,w1,w2]);q=weights@tri;n=weights@norm[face];n/=max(np.linalg.norm(n),1e-12)
    for side in [1,-1]:
     key=(ix,iy,side)
     if key not in grid or q[2]*side>grid[key][2]*side:grid[key]=np.r_[q,n]
 return np.array(list(grid.values()),dtype='<f4')

rng=np.random.default_rng(41)
out=pathlib.Path('public/geometry');out.mkdir(exist_ok=True)
import urllib.request
for name,url in [('head.glb','https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb'),('brain.obj','https://raw.githubusercontent.com/niivue/niivue/main/packages/niivue/demos/images/simplify_brain.obj')]:
 if not pathlib.Path('/tmp',name).exists():urllib.request.urlretrieve(url,pathlib.Path('/tmp',name))
b=pathlib.Path('/tmp/head.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);blob=b[28+n:]
def accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];cols={'SCALAR':1,'VEC3':3,'VEC2':2}[a['type']];return np.frombuffer(blob,dtype={5123:'<u2',5126:'<f4'}[a['componentType']],count=a['count']*cols,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,cols)
p=accessor(1);f=accessor(0).reshape(-1,3);norm=accessor(2)
print('head bounds',p.min(0),p.max(0))
def sample(p,f,count,norm=None):
 tri=p[f];cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);areas=np.linalg.norm(cross,axis=1);ids=rng.choice(len(f),count,p=areas/areas.sum());t=tri[ids];r=np.sqrt(rng.random(count));s=rng.random(count);weights=np.stack([1-r,r*(1-s),r*s],1);pts=(t*weights[:,:,None]).sum(1)
 if norm is not None:ns=(norm[f[ids]]*weights[:,:,None]).sum(1)
 else:ns=cross[ids]
 ns/=np.maximum(np.linalg.norm(ns,axis=1)[:,None],1e-10)
 return pts,ns
# Crop shoulders below the neck, retain actual face proportions.
p=p/3.8
p[:,1]-=.32;p*=1.38
arr=grid_sample(p,f,norm,.021);arr=arr[arr[:,1]>-.96];arr.tofile(out/'head.bin');print('head',len(arr))
vs=[];fs=[]
for l in pathlib.Path('/tmp/brain.obj').read_text().splitlines():
 s=l.split()
 if not s:continue
 if s[0]=='v':vs.append(list(map(float,s[1:4])))
 if s[0]=='f':fs.append([int(v.split('/')[0])-1 for v in s[1:4]])
v=np.array(vs);f=np.array(fs);print('brain bounds',v.min(0),v.max(0),'faces',len(f))
# MRI coordinates: left/right X, anterior Y, superior Z -> display X,Y=superior,Z=anterior.
v=v[:,[0,2,1]];v-=(v.min(0)+v.max(0))/2;v/=max(np.ptp(v,axis=0))/2
f=f[:,[0,2,1]]
a=grid_sample(v,f,None,.019)
b=grid_sample(v[:,[0,2,1]],f[:,[0,2,1]],None,.019)[:,[0,2,1,3,5,4]]
ba=np.vstack([a,b]);_,ids=np.unique(np.round(ba[:,:3]/.012).astype(int),axis=0,return_index=True);ba=ba[ids];ba.tofile(out/'brain.bin')
meta={'head':len(arr),'brain':len(ba),'stride':6,'type':'little-endian Float32 x,y,z,nx,ny,nz'};(out/'manifest.json').write_text(json.dumps(meta))
# Orthographic mesh inspection, not a site asset.
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
fig,ax=plt.subplots(1,2,figsize=(8,5));ax[0].scatter(p[:,0],p[:,1],s=.2,c=p[:,2]);ax[1].scatter(v[:,0],v[:,1],s=.2,c=v[:,2]);[a.set_aspect('equal') for a in ax];fig.savefig('/tmp/mesh-check.png')
