"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import type {ElementType,KeyboardEvent} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';

export type MindNode={id:string;title:string;icon:ElementType;x:number;y:number;tag?:string;preview?:string};

const W=400,H=190;
// Silhouette of the brain the nodes sit inside, plus the central fissure.
const SHELL='M62 104C34 82 48 38 98 34C122 10 176 10 196 32C214 10 276 12 298 36C350 38 368 84 336 106C344 138 294 152 252 138C232 154 176 154 154 138C112 154 58 138 62 104Z';
const FISSURE='M200 32C192 58 208 70 198 92C192 108 204 120 200 140';

export function MindNav({nodes,active,onGo}:{nodes:MindNode[];active:string|null;onGo:(id:string)=>void}){
 const root=useRef<HTMLElement|null>(null),previous=useRef<string|null>(null);
 const [from,setFrom]=useState<string|null>(null),[tip,setTip]=useState<string|null>(null),[seen,setSeen]=useState<string[]>([]);
 // Spread the portal coordinates over the area of the silhouette.
 const pts=useMemo(()=>{const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);return Object.fromEntries(nodes.map(n=>[n.id,{x:13+((n.x-x0)/(x1-x0||1))*74,y:19+((n.y-y0)/(y1-y0||1))*46}]))},[nodes]);
 const px=(id:string)=>({x:pts[id].x*W/100,y:pts[id].y*H/100});
 // Each node links to its two nearest neighbours so the map reads like a small neural net.
 const edges=useMemo(()=>{const seenKeys=new Set<string>(),out:[string,string][]=[];nodes.forEach(a=>{nodes.filter(b=>b.id!==a.id).map(b=>({b,d:Math.hypot((pts[a.id].x-pts[b.id].x)*W,(pts[a.id].y-pts[b.id].y)*H)})).sort((p,q)=>p.d-q.d).slice(0,2).forEach(({b})=>{const k=[a.id,b.id].sort().join('|');if(!seenKeys.has(k)){seenKeys.add(k);out.push([a.id,b.id])}})});return out},[nodes,pts]);
 useEffect(()=>{setFrom(previous.current);previous.current=active;if(active)setSeen(s=>s.includes(active)?s:[...s,active])},[active]);
 const index=nodes.findIndex(n=>n.id===active),shown=nodes.find(n=>n.id===(tip||active));
 function go(delta:number){const next=nodes[(Math.max(index,0)+delta+nodes.length)%nodes.length];onGo(next.id);requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('[data-node="'+next.id+'"]')?.focus())}
 function keys(e:KeyboardEvent){if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();go(1)}else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();go(-1)}}
 const trip=from&&active&&from!==active&&pts[from]?{a:px(from),b:px(active)}:null;
 const ambient=edges.filter((_,i)=>i%3===0).slice(0,4);
 const cardNode=tip?nodes.find(n=>n.id===tip):null,cardAt=cardNode?pts[cardNode.id]:null;
 return <nav ref={root} className="bmap" aria-label="Navigate the mind" onKeyDown={keys}>
  <div className="bmap-clip"/>
  <svg className="bmap-svg" viewBox={'0 0 '+W+' '+H} aria-hidden="true">
   <defs><linearGradient id="bmapGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0"><stop offset="0" stopColor="#5cffb0"/><stop offset=".55" stopColor="#38d4ff"/><stop offset="1" stopColor="#8b7bff"/></linearGradient></defs>
   <path className="bmap-shell" d={SHELL}/><path className="bmap-fissure" d={FISSURE}/>
   {edges.map(([a,b])=>{const p=px(a),q=px(b),hot=a===active||b===active;return <line key={a+b} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={hot?'hot':''}/>})}
   {ambient.map(([a,b],i)=>{const p=px(a),q=px(b);return <circle key={'s'+a+b} className="bmap-spark" r="1.8"><animateMotion dur={(3.2+i*.9)+'s'} begin={(i*.7)+'s'} repeatCount="indefinite" path={'M'+p.x+' '+p.y+' L'+q.x+' '+q.y}/></circle>})}
   {trip&&<circle key={active} className="bmap-spark" r="4.2"><animateMotion dur=".7s" fill="freeze" path={'M'+trip.a.x+' '+trip.a.y+' L'+trip.b.x+' '+trip.b.y}/></circle>}
  </svg>
  {nodes.map(n=>{const p=pts[n.id],Icon=n.icon,on=n.id===active;return <button key={n.id} data-node={n.id} type="button" className={'bmap-node'+(on?' active':'')+(!on&&seen.includes(n.id)?' visited':'')} style={{left:p.x+'%',top:p.y+'%'}} aria-label={'Go to '+n.title} aria-current={on?'page':undefined} onClick={()=>onGo(n.id)} onMouseEnter={()=>setTip(n.id)} onMouseLeave={()=>setTip(null)} onFocus={()=>setTip(n.id)} onBlur={()=>setTip(null)}><Icon/></button>})}
  {cardNode&&cardAt&&<div className="bmap-card" role="presentation" style={{left:Math.min(80,Math.max(20,cardAt.x))+'%',top:cardAt.y+'%'}}><small>{cardNode.tag||'MEMESPACE'}</small><b>{cardNode.title}</b>{cardNode.preview&&<span>{cardNode.preview}</span>}</div>}
  <div className="bmap-bar"><button type="button" aria-label="Previous module" onClick={()=>go(-1)}><ChevronLeft/></button><b aria-live="polite">{shown?shown.title:'The Mind'}</b><em>{index>=0?String(index+1).padStart(2,'0')+' / '+String(nodes.length).padStart(2,'0'):'—'}</em><button type="button" aria-label="Next module" onClick={()=>go(1)}><ChevronRight/></button></div>
  <div className="bmap-progress" aria-hidden="true"><i style={{width:(nodes.length?(seen.length/nodes.length)*100:0)+'%'}}/></div>
 </nav>;
}
