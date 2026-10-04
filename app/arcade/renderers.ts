import {BUMPERS,TARGETS,RAILS} from './engines/pinball.ts';
import type {PinState} from './engines/pinball.ts';
import {POCKETS,aimTrace,legalTargets} from './engines/pool.ts';
import type {PoolState,PoolBall} from './engines/pool.ts';
import type {Vec} from './engines/physics.ts';
type C=CanvasRenderingContext2D;
function circle(c:C,x:number,y:number,r:number,fill:string|CanvasGradient,stroke?:string,width=1){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}}
function round(c:C,x:number,y:number,w:number,h:number,r:number,fill:string|CanvasGradient,stroke?:string){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke()}}
function line(c:C,points:number[],color:string|CanvasGradient,width=1){c.beginPath();c.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);c.lineWidth=width;c.strokeStyle=color;c.stroke()}
function label(c:C,value:string,x:number,y:number,size=12,color='#eaf8f0',font='monospace'){c.font=`${size}px ${font}`;c.fillStyle=color;c.textAlign='center';c.fillText(value,x,y)}
function metal(c:C,x:number,y:number,r:number){const g=c.createRadialGradient(x-r*.4,y-r*.45,1,x,y,r);g.addColorStop(0,'#ffffff');g.addColorStop(.22,'#dbe9e8');g.addColorStop(.5,'#768c98');g.addColorStop(.76,'#213343');g.addColorStop(.9,'#bfd4db');g.addColorStop(1,'#314c58');circle(c,x,y,r,g,'#9ab4bc',.65)}
export function drawPinball(c:C,s:PinState,lowMotion=false){
 const bg=c.createLinearGradient(0,0,560,820);bg.addColorStop(0,'#1f163b');bg.addColorStop(.45,'#0b1a21');bg.addColorStop(1,'#071217');round(c,5,5,550,810,35,'#131622','#566171');round(c,16,15,528,790,27,bg,'#746290');
 c.save();c.beginPath();c.roundRect(22,23,517,775,25);c.clip();
 for(let i=0;i<20;i++){line(c,[28+i*29,26,28+i*29,805],'#9fffbb07');line(c,[22,30+i*42,540,30+i*42],'#9fffbb07')}
 const energy=c.createRadialGradient(272,278,10,272,278,290);energy.addColorStop(0,'#47306b60');energy.addColorStop(1,'#1d162a00');c.fillStyle=energy;c.fillRect(25,30,500,700);
 // Etched data tracks and layered guide channels.
 for(const pts of [[104,340,104,388,184,424,184,545,225,590],[442,342,442,390,360,430,360,548,332,590],[272,92,272,132,220,157],[272,92,272,132,324,157]]){line(c,pts,'#60798930',5);line(c,pts,'#a9b7ff40',1)}
 for(let i=0;i<7;i++){const x=135+i*45;circle(c,x,570,2,i%2?'#845eaf':'#98d69a');line(c,[x,559,x,542],'#91a8b323')}
 c.save();c.translate(274,394);c.rotate(-.02);label(c,'NEURAL',0,-8,30,'#cedddd','sans-serif');label(c,'R E A C T O R',0,21,15,'#b799ed','monospace');label(c,'MEMESPACE  /  PINBALL DIVISION',0,45,7,'#647d90');c.restore();
 for(const [x1,y1,x2,y2] of RAILS){c.lineCap='round';line(c,[x1,y1,x2,y2],'#01080dc9',14);line(c,[x1,y1,x2,y2],'#435369',8);line(c,[x1-1,y1-1,x2-1,y2-1],'#9aaaaa',2)}
 // Slings are field elements, positioned exactly over their collision rails.
 for(const [x,flip] of [[102,1],[425,-1]]){c.save();c.translate(x,476);c.scale(flip,1);c.shadowColor='#b79aff';c.shadowBlur=12;line(c,[-14,-31,14,-18,7,20,-14,-31],'#a894f0',3);c.restore()}
 for(let i=0;i<BUMPERS.length;i++){
  const b=BUMPERS[i],flash=!lowMotion?Math.max(0,1-(s.time-s.hits[i])*3):0;
  circle(c,b.x+3,b.y+7,b.r+12,'#0009');circle(c,b.x,b.y,b.r+9,'#151f2b','#576470',3);
  c.save();c.shadowColor=i===2?'#a1ff89':'#bda0ff';c.shadowBlur=14+flash*25;circle(c,b.x,b.y,b.r+2,i===2?'#4ba878':'#7664b7',i===2?'#baffae':'#d4baff',3);c.restore();
  const g=c.createRadialGradient(b.x-9,b.y-12,3,b.x,b.y,b.r);g.addColorStop(0,i===2?'#d5fcb1':'#dbcdf8');g.addColorStop(.15,i===2?'#79c875':'#a48be5');g.addColorStop(.7,i===2?'#224b43':'#413065');g.addColorStop(1,'#11282e');circle(c,b.x,b.y,b.r-5,g,'#e6effa60',1);
  circle(c,b.x,b.y,b.r-15,'#12202d90','#caddce70');label(c,i===2?'01':'10',b.x,b.y+4,14,i===2?'#d0ffaa':'#eee5ff');
  if(flash){circle(c,b.x,b.y,b.r+10+(1-flash)*20,'#ffffff00',`rgba(205,255,201,${flash*.6})`,2)}
 }
 for(let i=0;i<TARGETS.length;i++){const p=TARGETS[i],lit=s.targets[i],flash=s.time-s.targetHits[i]<.2;circle(c,p.x,p.y,p.r+7,'#17242c','#748895');c.save();c.shadowColor=lit?'#a8ff8d':'#bc93ff';c.shadowBlur=lit?17:5;circle(c,p.x,p.y,p.r,flash?'#ffffff':lit?'#bcff83':'#745093','#a7bebe');c.restore();label(c,String(i+1),p.x,p.y+4,12,lit?'#142627':'#ddd2f3')}
 label(c,'LIGHT 1 · 2 · 3  FOR MULTIBALL',275,499,9,'#ac98c7');label(c,`${s.multiplier}×`,278,553,33,'#c8e79c');
 // Flippers: rubber perimeter, brushed-metal body and pivot caps.
 for(const [x,angle] of [[168,s.left],[392,s.right]]){c.save();c.translate(x,683);c.rotate(angle);c.lineCap='round';line(c,[0,0,95,0],'#000a',27);line(c,[0,-2,95,-2],s.tilted?'#495158':'#c0ffad',22);line(c,[1,-3,93,-3],'#263b45',13);line(c,[9,-7,87,-7],'#d6e8ec70',2);c.restore();metal(c,x,683,12)}
 // Shooter lane and spring.
 round(c,497,238,29,550,13,'#060c1290');for(let y=759;y<790;y+=5)line(c,[501,y,525,y-3],'#8ba1a7',2);label(c,'↟',512,644,25,'#7cabb1');
 for(let i=0;i<6;i++){circle(c,64,171+i*74,2,'#b399d6');circle(c,462,235+i*55,1.5,'#88c1a8')}
 if(s.phase==='playing'&&!lowMotion)for(const b of s.balls){c.lineCap='round';for(let i=1;i<b.trail.length;i++){const a=b.trail[i-1],n=b.trail[i];line(c,[a.x,a.y,n.x,n.y],`rgba(151,239,228,${i/b.trail.length*.26})`,i/b.trail.length*7)}}
 for(const b of s.balls){circle(c,b.x+2,b.y+4,b.r+2,'#0008');metal(c,b.x,b.y,b.r)}
 label(c,s.tilted?'T I L T':s.phase==='ready'?'L A U N C H  S I G N A L':'D R A I N',277,773,10,s.tilted?'#ff899e':'#7e909d');
 c.restore();
 for(const [x,y] of [[29,35],[532,35],[29,786],[532,786]]){metal(c,x,y,4);line(c,[x-2,y,x+2,y],'#223337',1)}
}
const BALL_COLORS=['#f0eee3','#e7b742','#245ec0','#ba3d45','#8555ba','#d67a32','#257c68','#793c49','#171c25'];
export function drawPoolBall(c:C,b:PoolBall){
 const r=b.r,color=BALL_COLORS[b.id===0?0:b.id<=8?b.id:b.id-8];c.save();c.translate(b.x,b.y);
 circle(c,3,5,r+1,'#0008');circle(c,0,0,r,b.id>8?'#e7e3cd':color,'#ffffff40',.7);
 if(b.id>8){c.save();c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.clip();c.rotate(Math.sin(b.rotation*.4)*.45);c.fillStyle=color;c.fillRect(-r,-r*.55,r*2,r*1.1);c.restore()}
 if(b.id){circle(c,-1,-1,5.7,'#ede8d7');label(c,String(b.id),-1,2.3,7.5,'#14202d','Arial')}
 const shine=c.createRadialGradient(-4,-5,.2,0,0,r);shine.addColorStop(0,'#ffffff95');shine.addColorStop(.35,'#ffffff05');shine.addColorStop(.76,'#00000005');shine.addColorStop(1,'#00000088');circle(c,0,0,r,shine);circle(c,-4,-5,1.8,'#fff8');c.restore();
}
export function drawPool(c:C,s:PoolState,angle=0,called:number|null=null,placement?:Vec){
 const frame=c.createLinearGradient(0,0,0,540);frame.addColorStop(0,'#3b3441');frame.addColorStop(.5,'#151e27');frame.addColorStop(1,'#303344');round(c,8,8,984,524,42,'#080e15','#5b6169');round(c,18,18,964,504,33,frame,'#8b7981');
 const wood=c.createLinearGradient(0,0,1000,540);wood.addColorStop(0,'#342b26');wood.addColorStop(.55,'#201c1e');wood.addColorStop(1,'#514039');round(c,27,27,946,486,27,wood,'#766253');
 for(let y=32;y<512;y+=5){c.save();c.beginPath();c.roundRect(28,28,944,484,26);c.clip();line(c,[30,y,969,y+7],'#d4a47306');c.restore()}
 round(c,44,44,912,452,18,'#111e20','#74756a');const cloth=c.createRadialGradient(430,235,60,500,270,520);cloth.addColorStop(0,'#1a655c');cloth.addColorStop(.5,'#164d49');cloth.addColorStop(1,'#0a2b2d');round(c,60,60,880,420,9,cloth);
 // Cloth weave is static and deterministic; no frame-to-frame random noise.
 c.save();c.beginPath();c.rect(61,61,878,418);c.clip();for(let y=64;y<480;y+=7)line(c,[61,y,939,y],'#e4fddd04');for(let x=64;x<940;x+=13)line(c,[x,61,x+35,479],'#d6f1de03');c.restore();
 for(const [x,y,w,h] of [[73,47,399,13],[528,47,399,13],[73,480,399,13],[528,480,399,13],[47,76,13,388],[940,76,13,388]])round(c,x,y,w,h,4,'#225148','#758f7330');
 line(c,[73,61,470,61],'#81a69750',1);line(c,[530,61,927,61],'#81a69750',1);line(c,[61,76,61,464],'#81a69750',1);
 for(const x of [170,280,390,610,720,830])for(const y of [36,504]){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle='#baa87e';c.fillRect(-2,-2,4,4);c.restore()}
 for(const y of [165,270,375])for(const x of [36,964]){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle='#baa87e';c.fillRect(-2,-2,4,4);c.restore()}
 c.save();c.globalAlpha=.22;label(c,'AFTER HOURS',500,251,25,'#cee6c8','Georgia');label(c,'B I L L I A R D S   C L U B',500,278,10,'#d6dfc7');line(c,[429,296,571,296],'#c3c8a7',1);label(c,'M E M E S P A C E',500,318,7,'#d6dfc7');c.restore();
 circle(c,280,270,2,'#e6edd380');circle(c,690,270,2,'#e6edd380');
 for(let i=0;i<POCKETS.length;i++){const p=POCKETS[i],active=i===called;circle(c,p.x,p.y,27,active?'#cbaa66':'#645844');circle(c,p.x,p.y,23,'#03070b','#101c1e',4);const shade=c.createRadialGradient(p.x,p.y+5,3,p.x,p.y,23);shade.addColorStop(0,'#000');shade.addColorStop(1,'#1d282a');circle(c,p.x,p.y,21,shade);if(active){circle(c,p.x,p.y,29,'#0000','#f8d27d',2);label(c,String(i+1),p.x,p.y+4,10,'#f0d7a2')}}
 if(s.phase==='aim'){
  const cue=s.balls[0],trace=aimTrace(s,angle);c.save();c.setLineDash([6,7]);line(c,[cue.x,cue.y,trace.end.x,trace.end.y],'#e6eedd75',1.2);c.setLineDash([]);circle(c,trace.end.x,trace.end.y,12,'#e6ecdd09','#cbe5dd66');
  if(trace.target){const b=trace.target,dx=b.x-trace.end.x,dy=b.y-trace.end.y,d=Math.hypot(dx,dy)||1;line(c,[b.x,b.y,b.x+dx/d*70,b.y+dy/d*70],'#d6d29685',1.5);const legal=legalTargets(s).some(t=>t.id===b.id);circle(c,b.x,b.y,16,'#0000',legal?'#b7ffc85e':'#ff9a9760',1)}
  c.restore();c.save();c.translate(cue.x,cue.y);c.rotate(angle);const shaft=c.createLinearGradient(-157,0,-23,0);shaft.addColorStop(0,'#2b191d');shaft.addColorStop(.25,'#80592f');shaft.addColorStop(.75,'#dab87c');shaft.addColorStop(1,'#e9d8b3');c.lineCap='round';c.shadowColor='#0009';c.shadowBlur=3;c.shadowOffsetY=3;line(c,[-160,0,-28,0],shaft,5);line(c,[-32,0,-25,0],'#e5eee5',4);line(c,[-25,0,-23,0],'#6c9dba',4);line(c,[-160,-1,-92,-1],'#e6ca8560',1);c.restore();
 }
 for(const b of s.balls.filter(b=>!b.pocketed))drawPoolBall(c,b);
 if(s.phase==='placement'&&placement){const valid=placement.x>73&&placement.x<927&&placement.y>73&&placement.y<467;c.save();c.globalAlpha=.7;drawPoolBall(c,{id:0,...placement,r:12,vx:0,vy:0,pocketed:false,rotation:0});circle(c,placement.x,placement.y,17,'#0000',valid?'#d8eead':'#ee858e');c.restore()}
}
