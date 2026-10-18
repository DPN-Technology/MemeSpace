"use client";
import {useEffect,useRef,useState} from 'react';
import Legacy from './scene';

type Props={inside:boolean;warp:boolean;reduced:boolean;quality:boolean;onReady:()=>void;focus?:string|null;glow?:number;paused?:boolean};
type Prog={p:WebGLProgram;u:Map<string,WebGLUniformLocation|null>};
const ARC_N=28,ARC_SEG=24,RING_SEG=96,RINGS=3,RAIN=860,DUST=170;
const receptors:Record<string,[number,number,number]>={history:[-.65,.35,.5],coins:[.6,.4,.5],games:[-.78,-.15,.25],chat:[.78,0,.25],media:[-.45,-.5,.4],learn:[.5,-.5,.4],wallet:[0,.75,.3],profile:[0,-.65,.4],social:[.84,-.4,.3]};
const eyelid=(t:number)=>{const phase=t%6.3;return Math.exp(-(((phase-5.3)/.085)**2))+.65*Math.exp(-(((phase-5.55)/.07)**2));};

const COMMON=`#version 300 es
precision highp float;
uniform vec2 uRes,uCenter;uniform float uScale,uZoom,uDpr,uMaxPt,uTime,uForm;uniform vec4 uR;
const float TAU=6.2831853,PI=3.1415927;
const vec3 MINT=vec3(.36,1.,.69),CYAN=vec3(.23,.84,1.),VIOLET=vec3(.55,.48,1.),WHITE=vec3(.92,1.,.97);
vec3 rotate(vec3 p){float x1=p.x*uR.x+p.z*uR.y,z1=p.z*uR.x-p.x*uR.y;return vec3(x1,p.y*uR.z-z1*uR.w,p.y*uR.w+z1*uR.z);}
float persp(float z){return 3.6/max(.4,3.6-z-uZoom*2.9);}
vec2 toScreen(vec3 q){return uCenter+vec2(q.x,-q.y)*uScale*persp(q.z);}
vec4 toClip(vec2 px){return vec4(px.x/uRes.x*2.-1.,1.-px.y/uRes.y*2.,0.,1.);}
`;
const HIDE='gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;';

const POINTS_VS=COMMON+`
layout(location=0)in vec3 aPos;layout(location=1)in vec3 aNor;layout(location=2)in float aSeed;
uniform float uBlend,uInside,uGlow,uBlink,uQuality,uReduced,uFocusOn,uMouseOn;uniform vec3 uFocus;uniform vec2 uMouse;
out vec3 vCol;out float vDigit;
void main(){
 vCol=vec3(0.);vDigit=0.;
 if(uQuality<.5&&mod(float(gl_VertexID),2.)>.5){${HIDE}return;}
 vec3 p=aPos;float seed=aSeed;bool inside=uInside>.5;
 if(!inside&&uForm<1.){float a=seed*TAU*4.+(1.-uForm)*8.;float r=1.5+(1.-uForm)*4.;float f=uForm;
  p=vec3(p.x*f+cos(a)*r*(1.-f),p.y*f+(sin(a)*1.8+(seed-.5)*2.)*(1.-f),p.z*f+sin(a*1.7)*2.*(1.-f));}
 if(uReduced<.5){p.y+=sin(uTime*1.3)*.0025;
  if(!inside){bool near=abs(p.y-.18)<.09&&abs(abs(p.x)-.25)<.14&&p.z>.42;if(near)p.y=.18+(p.y-.18)*(1.-uBlink*.86);}}
 vec3 n=rotate(aNor);vec3 q=rotate(p);
 float hover=uMouseOn*exp(-pow(length(toScreen(q)-uMouse)/uScale,2.)*7.);
 q+=n*hover*.035;
 float pr=persp(q.z);
 float facing=smoothstep(0.,.28,n.z);if(uForm<.98)facing=1.;
 if(facing<.01){${HIDE}return;}
 float diff=max(0.,dot(n,normalize(vec3(-.32,.52,.79))));
 float light=.16+pow(diff,.9)*.8+pow(1.-max(0.,n.z),2.)*.2;
 vec3 col;float reveal=1.;
 if(!inside){
  vec3 base=mix(MINT,CYAN,smoothstep(-.5,.95,p.y*.9+p.x*.25));
  float rim=pow(1.-clamp(n.z,0.,1.),2.2);
  col=mix(base,VIOLET,clamp(rim*1.15,0.,1.));
  float sweep=fract(uTime*.11)*2.6-1.3;float band=exp(-pow((p.y-sweep)*8.,2.))*(1.-uReduced);
  light+=band*.75;col=mix(col,WHITE,band*.5);
  float ed=length(vec3(abs(p.x)-.255,p.y-.181,(p.z-.685)*.6));
  light=light*smoothstep(.04,.075,ed)+exp(-ed*20.)*.35*uGlow*smoothstep(.05,.08,ed);
 }else{
  float pulse=uReduced<.5?pow(max(0.,cos(p.x*4.1+p.y*5.2+p.z*3.-uTime*2.4)),28.):0.;
  col=mix(mix(MINT,CYAN,smoothstep(-.8,.2,p.x)),VIOLET,smoothstep(.2,.75,p.x));
  col=mix(col,WHITE,smoothstep(.5,1.,pulse)*.85);light+=pulse*.7;
  float d=distance(p,uFocus);
  float foc=uFocusOn*exp(-d*2.8)*(uReduced>.5?.45:.35+.3*pow(sin(uTime*5.-d*8.),2.));
  light+=foc;col=mix(col,WHITE,clamp(foc*.5,0.,1.));reveal=uBlend;
 }
 light*=mix(.6,1.,clamp((q.z+1.)*.5,0.,1.));
 vCol=col*light*facing*reveal*(1.-uZoom*.7)*(1.+hover*1.4)*(inside?.42:1.);
 vDigit=float((int(seed*31.)+int(uTime*(.26+seed*.22)))%2);
 float size=max(3.5,uScale*.03*pr)*(uQuality>.5?1.:1.25)*(inside?.62:1.);
 gl_PointSize=min(uMaxPt,size*1.7*uDpr);gl_Position=toClip(toScreen(q));
}`;
const GLYPH_FS=`#version 300 es
precision mediump float;
in vec3 vCol;in float vDigit;uniform sampler2D uAtlas;out vec4 o;
void main(){
 float g=texture(uAtlas,vec2(gl_PointCoord.x*.5+vDigit*.5,gl_PointCoord.y)).a;
 vec2 c=gl_PointCoord-.5;float halo=exp(-dot(c,c)*18.);
 vec3 col=vCol*(g*1.35+halo*.3);o=vec4(col,max(col.r,max(col.g,col.b)));
}`;
const FLAT_FS=`#version 300 es
precision mediump float;
in vec3 vCol;out vec4 o;
void main(){o=vec4(vCol,max(vCol.r,max(vCol.g,vCol.b)));}`;

const RAIN_VS=COMMON+`
out vec3 vCol;out float vDigit;
void main(){
 int id=gl_VertexID;vec2 px;vec3 col;float size=12.;
 if(id<${RAIN}){
  int cl=id/10;int k=id%10;float x=fract(float(cl)*.6180339887);float by=fract(float(cl)*.39271);float sp=.012+float(cl%7)*.004;
  float y=mod(by+uTime*sp,1.35);px=vec2(x*uRes.x,(y*1.1-.1)*uRes.y-float(k)*14.);
  float a=k==0?.5:float(10-k)*.03;col=mix(vec3(.2,.9,.55),vec3(.3,.7,1.),fract(x*7.))*a;
  vDigit=float(int(floor(uTime*1.8+x*100.+float(k)))%2);
 }else{
  int i=id-${RAIN};float a=float(i)*2.3999+uTime*.12;
  float rr=min(uRes.x,uRes.y)*(.25+float((i*37)%100)/100.)*(.32+(1.-uForm)*.6+uZoom*2.);
  px=uCenter+vec2(cos(a)*rr,sin(a)*rr*.7);float z=float(i%17)/17.;col=z>.7?VIOLET*.38:MINT*.22;vDigit=float(i%2);size=11.;
 }
 vCol=col*(1.-uZoom*.6);gl_PointSize=size*uDpr*1.4;gl_Position=toClip(px);
}`;

const RING_VS=COMMON+`
out vec3 vCol;
void main(){
 int seg=gl_VertexID/2;int ring=seg/${RING_SEG};float a=float(seg%${RING_SEG}+gl_VertexID%2)/${RING_SEG}.*TAU;
 float fr=float(ring);float R=1.28+fr*.34;float dir=ring==1?-1.:1.;
 vec3 p=vec3(cos(a)*R,0.,sin(a)*R);
 float spin=uTime*(.08+fr*.03)*dir;float cs=cos(spin),sn=sin(spin);p=vec3(p.x*cs+p.z*sn,p.y,p.z*cs-p.x*sn);
 float tilt=.35+fr*.5;float ct=cos(tilt),st=sin(tilt);p=vec3(p.x,p.y*ct-p.z*st,p.y*st+p.z*ct);
 vec3 q=rotate(p);
 float tail=fract(a/TAU*dir-uTime*.07+fr*.33);float br=exp(-tail*5.);
 float depth=mix(.3,1.,smoothstep(-1.4,1.4,q.z));
 vCol=mix(CYAN,VIOLET,fr/2.)*(.07+br*.65)*depth*(1.-uZoom);
 gl_Position=toClip(toScreen(q));
}`;

const ARC_VS=COMMON+`
uniform float uMode,uBlend,uFocusOn,uReduced;uniform vec3 uFocus;
out vec3 vCol;out float vDigit;
vec3 pathPoint(float k,float f){
 float ang=k*TAU/${ARC_N}.;vec3 tg=vec3(cos(ang)*.81,sin(ang)*.62,.34);
 if(uFocusOn>.5&&k<6.)tg=uFocus;
 return vec3(tg.x*f+sin(f*PI)*cos(ang+1.)*.13,tg.y*f+sin(f*TAU+k)*.055,.4+sin(f*3.+k)*.16);
}
void main(){
 float k,f,tailI=0.;
 if(uMode<.5){int seg=gl_VertexID/2;k=float(seg/${ARC_SEG});f=float(seg%${ARC_SEG}+gl_VertexID%2)/${ARC_SEG}.;}
 else{k=float(gl_VertexID/6);tailI=float(gl_VertexID%6);f=0.;}
 bool sel=uFocusOn>.5&&k<6.;
 float phase=uReduced>.5?.5:fract(uTime*(sel?.38:.2)+k*.083);
 vec3 tint=mod(k,3.)>.5?MINT:VIOLET;
 if(uMode<.5){
  float behind=mod(phase-f+1.,1.);float trail=exp(-behind*14.)*step(behind,.4);
  vCol=(sel?CYAN*.5:VIOLET*.13)+tint*trail*.8;vCol*=uBlend;vDigit=0.;
  gl_Position=toClip(toScreen(rotate(pathPoint(k,f))));
 }else{
  f=fract(phase-tailI*.016+1.);
  vCol=mix(tint,WHITE,.4)*(1.-tailI/6.)*.9*uBlend*(1.-uReduced);vDigit=float((int(k)+int(tailI))%2);
  gl_PointSize=min(uMaxPt,(tailI<.5?16.:11.)*uDpr);gl_Position=toClip(toScreen(rotate(pathPoint(k,f))));
 }
}`;

const SPRITE_VS=COMMON+`
uniform vec3 uPos;uniform float uRad;
void main(){vec3 q=rotate(uPos);gl_Position=toClip(toScreen(q));gl_PointSize=min(uMaxPt,uScale*uRad*persp(q.z)*7.*uDpr);}`;
const SPRITE_FS=`#version 300 es
precision highp float;
uniform float uKind,uOpen,uFade,uGlow,uTime;out vec4 o;
const vec3 MINT=vec3(.36,1.,.69),CYAN=vec3(.23,.84,1.);
void main(){
 vec2 p=(gl_PointCoord-.5)*2.;vec3 col=vec3(0.);
 if(uKind<.5){
  vec2 q=vec2(p.x,p.y/max(uOpen,.07))/.2857;float r=length(q);float ang=atan(q.y,q.x);
  float fib=.55+.45*sin(ang*22.+r*9.+uTime*.5)*sin(ang*7.-uTime*.3);
  float iris=smoothstep(1.04,.96,r);vec3 ic=mix(MINT,CYAN,smoothstep(.25,1.,r))*(.45+.7*fib);
  float limbal=smoothstep(.72,1.,r)*iris;float pupil=smoothstep(.42,.36,r);
  col=ic*iris*(1.-pupil)*1.15+vec3(.7,1.,.9)*limbal*.5;
  col+=vec3(1.)*smoothstep(.2,.08,length(q-vec2(-.36,-.38)))*.95*step(.2,uOpen);
  col+=mix(MINT,CYAN,.35)*exp(-dot(p,p)*5.)*.55*uGlow*mix(.35,1.,uOpen);
 }else{float r=length(p);col=MINT*smoothstep(.07,0.,abs(r-.5))*.9+MINT*exp(-r*r*6.)*.15;}
 col*=uFade;o=vec4(col,max(col.r,max(col.g,col.b)));
}`;

function GL({inside,warp,reduced,quality,onReady,focus,glow=1,paused=false,onFail}:Props&{onFail:()=>void}){
 const ref=useRef<HTMLCanvasElement>(null);
 const state=useRef({inside,warp,reduced,quality,focus,glow,paused});state.current={inside,warp,reduced,quality,focus,glow,paused};
 const ready=useRef(onReady);ready.current=onReady;
 const fail=useRef(onFail);fail.current=onFail;
 const[error,setError]=useState(false);
 useEffect(()=>{
  const canvas=ref.current!;
  const ctx=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,powerPreference:'high-performance'});
  if(!ctx){fail.current();return;}
  const gl:WebGL2RenderingContext=ctx;
  const controller=new AbortController();
  let stopped=false,raf=0,began=performance.now(),last=0,frames=0,mx=0,my=0,mpx=-9999,mpy=-9999,mouseOn=0,mouseTarget=0,yaw=0,pitch=0,zoom=0,blend=0,lastInside=false;
  const compile=(type:number,src:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Shader compile failed');return s;};
  const make=(vs:string,fs:string):Prog=>{const p=gl.createProgram()!;gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)||'link');return{p,u:new Map()};};
  let points:Prog,rain:Prog,rings:Prog,arcLines:Prog,arcPulses:Prog,sprite:Prog;
  try{points=make(POINTS_VS,GLYPH_FS);rain=make(RAIN_VS,GLYPH_FS);rings=make(RING_VS,FLAT_FS);arcLines=make(ARC_VS,FLAT_FS);arcPulses=make(ARC_VS,GLYPH_FS);sprite=make(SPRITE_VS,SPRITE_FS);}
  catch(e){console.warn('MemeSpace WebGL scene unavailable, using the classic renderer.',e);fail.current();return;}
  const loc=(g:Prog,n:string)=>{let l=g.u.get(n);if(l===undefined){l=gl.getUniformLocation(g.p,n);g.u.set(n,l);}return l;};
  const f1=(g:Prog,n:string,v:number)=>gl.uniform1f(loc(g,n),v);

  const atlasCanvas=document.createElement('canvas');atlasCanvas.width=128;atlasCanvas.height=64;
  const ax=atlasCanvas.getContext('2d')!;ax.fillStyle='#fff';ax.textAlign='center';ax.textBaseline='middle';ax.font='700 46px ui-monospace,Consolas,monospace';
  ax.fillText('0',32,34);ax.fillText('1',96,34);
  const atlas=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,atlas);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlasCanvas);gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);

  const maxPt=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] as number;
  const upload=(buffer:ArrayBuffer)=>{
   const src=new Float32Array(buffer),n=src.length/6,data=new Float32Array(n*7);
   for(let i=0;i<n;i++){data.set(src.subarray(i*6,i*6+6),i*7);data[i*7+6]=((i*73.173)%997)/997;}
   const vao=gl.createVertexArray()!;gl.bindVertexArray(vao);
   const vbo=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
   gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);
   gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,28,12);
   gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,28,24);
   gl.bindVertexArray(null);return{vao,count:n};
  };
  type Geo={vao:WebGLVertexArrayObject;count:number};
  let head:Geo|null=null,brain:Geo|null=null;
  Promise.all(['/geometry/head.bin','/geometry/brain.bin'].map(async url=>{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('Geometry unavailable');return r.arrayBuffer();}))
   .then(([h,b])=>{if(stopped)return;head=upload(h);brain=upload(b);began=performance.now();canvas.dataset.geometry='loaded';canvas.dataset.headGlyphs=String(head.count);canvas.dataset.brainGlyphs=String(brain.count);ready.current();})
   .catch(e=>{if(e.name!=='AbortError'){setError(true);ready.current();}});

  const move=(e:PointerEvent)=>{mx=Math.max(-1,Math.min(1,(e.clientX/innerWidth-.5)*2));my=Math.max(-1,Math.min(1,(e.clientY/innerHeight-.45)*2));mpx=e.clientX;mpy=e.clientY;mouseTarget=1;};
  const leave=()=>{mx=0;my=0;mouseTarget=0;};
  window.addEventListener('pointermove',move);document.addEventListener('pointerleave',leave);
  const lost=(e:Event)=>{e.preventDefault();fail.current();};canvas.addEventListener('webglcontextlost',lost);

  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.disable(gl.DEPTH_TEST);

  function draw(now:number){
   if(stopped)return;raf=requestAnimationFrame(draw);
   const s=state.current;if(document.hidden||s.paused||now-last<1000/(s.quality?60:30)-2)return;
   const dt=Math.min(.08,(now-last)/1000||.016);last=now;frames++;
   const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,s.quality?2:1.25);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
   gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
   const t=s.reduced?0:(now-began)/1000;
   if(s.inside!==lastInside){blend=0;lastInside=s.inside;}blend=Math.min(1,blend+dt*1.6);
   mouseOn+=(mouseTarget-mouseOn)*Math.min(1,dt*6);
   yaw+=(mx*.28+(s.inside?.28:.015)+(!s.reduced?Math.sin(t*.42)*.026:0)-yaw)*Math.min(1,dt*3);
   pitch+=(-my*.12+(s.inside?.55:0)-pitch)*Math.min(1,dt*3);
   zoom+=(Number(s.warp)-zoom)*Math.min(1,dt*2.5);
   const forming=s.reduced?1:Math.min(1,Math.max(0,t/3.2)),form=1-Math.pow(1-forming,3);
   const rotY=s.reduced?(s.inside?.24:0):yaw,rotX=s.reduced?(s.inside?.55:0):pitch;
   const scale=Math.min(h*(s.inside?.31:.25),w*(s.inside?.37:.32)),cx=w*.5,cy=h*(s.inside?.55:.39);
   const sel=s.focus?receptors[s.focus]:null;
   const common=(g:Prog)=>{
    gl.useProgram(g.p);
    gl.uniform2f(loc(g,'uRes'),w,h);gl.uniform2f(loc(g,'uCenter'),cx,cy);
    gl.uniform4f(loc(g,'uR'),Math.cos(rotY),Math.sin(rotY),Math.cos(rotX),Math.sin(rotX));
    f1(g,'uScale',scale);f1(g,'uZoom',zoom);f1(g,'uDpr',dpr);f1(g,'uMaxPt',maxPt);f1(g,'uTime',t);f1(g,'uForm',form);
    f1(g,'uBlend',s.inside?blend:1);f1(g,'uInside',s.inside?1:0);f1(g,'uGlow',s.glow);f1(g,'uBlink',s.reduced?0:Math.min(1,eyelid(t)));
    f1(g,'uQuality',s.quality?1:0);f1(g,'uReduced',s.reduced?1:0);
    f1(g,'uFocusOn',s.inside&&sel?1:0);gl.uniform3f(loc(g,'uFocus'),sel?sel[0]:0,sel?sel[1]:0,sel?sel[2]:0);
    gl.uniform2f(loc(g,'uMouse'),mpx,mpy);f1(g,'uMouseOn',s.reduced?0:mouseOn);
   };
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlas);
   if(!s.reduced){common(rain);gl.uniform1i(loc(rain,'uAtlas'),0);gl.drawArrays(gl.POINTS,0,RAIN+DUST);}
   common(rings);gl.drawArrays(gl.LINES,0,RINGS*RING_SEG*2);
   const geo=s.inside?brain:head;
   if(geo){common(points);gl.uniform1i(loc(points,'uAtlas'),0);gl.bindVertexArray(geo.vao);gl.drawArrays(gl.POINTS,0,geo.count);gl.bindVertexArray(null);}
   if(s.inside){
    common(arcLines);f1(arcLines,'uMode',0);gl.drawArrays(gl.LINES,0,ARC_N*ARC_SEG*2);
    common(arcPulses);f1(arcPulses,'uMode',1);gl.uniform1i(loc(arcPulses,'uAtlas'),0);gl.drawArrays(gl.POINTS,0,ARC_N*6);
    if(sel){common(sprite);f1(sprite,'uKind',1);f1(sprite,'uFade',1);gl.uniform3f(loc(sprite,'uPos'),sel[0],sel[1],sel[2]);f1(sprite,'uRad',.075*(s.reduced?1:1+Math.sin(t*3)*.1));gl.drawArrays(gl.POINTS,0,1);}
   }else if(geo&&form>.9){
    const open=s.reduced?1:Math.max(.04,1-Math.min(1,eyelid(t)));
    common(sprite);f1(sprite,'uKind',0);f1(sprite,'uOpen',open);f1(sprite,'uFade',(1-zoom*.7)*Math.min(1,(form-.9)*10));f1(sprite,'uRad',.056);
    for(const side of [-1,1]){gl.uniform3f(loc(sprite,'uPos'),side*.255+(s.reduced?0:mx*.019),.181+(s.reduced?0:-my*.013),.69);gl.drawArrays(gl.POINTS,0,1);}
   }
   if(frames%40===0){canvas.dataset.frames=String(frames);canvas.dataset.gaze=`${yaw.toFixed(3)},${pitch.toFixed(3)}`;canvas.dataset.mode=s.inside?'brain':'head';canvas.dataset.focus=s.focus||'';canvas.dataset.eyeGlow=String(s.glow);canvas.dataset.glyphs=String(geo?.count??0);canvas.dataset.renderer='webgl2';}
  }
  raf=requestAnimationFrame(draw);
  return()=>{stopped=true;controller.abort();cancelAnimationFrame(raf);window.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);canvas.removeEventListener('webglcontextlost',lost);};
 },[]);
 return <><canvas ref={ref} className="binary-scene" role="img" aria-label={inside?'Live three-dimensional brain composed of animated binary digits':'Live three-dimensional human head composed of binary digits, following your pointer'}/>{error&&<div className="scene-error" role="status">The binary geometry could not load. You can still enter and use every module.</div>}</>;
}

export default function Scene(props:Props){
 const[fallback,setFallback]=useState(false);
 if(fallback)return <Legacy {...props}/>;
 return <GL {...props} onFail={()=>setFallback(true)}/>;
}
