"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties,ElementType,KeyboardEvent} from 'react';

export type MindNode={id:string;title:string;icon:ElementType;x:number;y:number};

// Spread the portal coordinates across the whole mini-map.
const norm=(n:MindNode)=>({x:8+((n.x-18)/70)*84,y:12+((n.y-26)/54)*76});

export function MindNav({nodes,active,onGo}:{nodes:MindNode[];active:string|null;onGo:(id:string)=>void}){
 const root=useRef<HTMLElement|null>(null),previous=useRef<string|null>(null);
 const [from,setFrom]=useState<string|null>(null),[tip,setTip]=useState<string|null>(null);
 const pts=useMemo(()=>Object.fromEntries(nodes.map(n=>[n.id,norm(n)])),[nodes]);
 // Each node links to its two nearest neighbours so the map reads like a small neural net.
 const edges=useMemo(()=>{const seen=new Set<string>(),out:[string,string][]=[];nodes.forEach(a=>{nodes.filter(b=>b.id!==a.id).map(b=>({b,d:Math.hypot(pts[a.id].x-pts[b.id].x,(pts[a.id].y-pts[b.id].y)*1.6)})).sort((p,q)=>p.d-q.d).slice(0,2).forEach(({b})=>{const k=[a.id,b.id].sort().join('|');if(!seen.has(k)){seen.add(k);out.push([a.id,b.id])}})});return out},[nodes,pts]);
 useEffect(()=>{setFrom(previous.current);previous.current=active},[active]);
 const index=nodes.findIndex(n=>n.id===active);
 function step(delta:number){const next=nodes[(Math.max(index,0)+delta+nodes.length)%nodes.length];onGo(next.id);requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('[data-node="'+next.id+'"]')?.focus())}
 function keys(e:KeyboardEvent){if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();step(1)}else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();step(-1)}}
 const start=from&&active&&from!==active&&pts[from]?pts[from]:null,end=active?pts[active]:null;
 const label=nodes.find(n=>n.id===(tip||active));
 return <nav ref={root} className="mind-nav" aria-label="Navigate the mind" onKeyDown={keys}>
  <svg className="mind-nav-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{edges.map(([a,b])=>{const hot=a===active||b===active;return <line key={a+b} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} className={hot?'hot':''}/>})}</svg>
  {start&&end&&<i key={active} className="mind-pulse" style={{'--fx':start.x+'%','--fy':start.y+'%','--tx':end.x+'%','--ty':end.y+'%'} as CSSProperties}/>}
  {nodes.map(n=>{const p=pts[n.id],Icon=n.icon,on=n.id===active;return <button key={n.id} data-node={n.id} type="button" className={'mind-node'+(on?' active':'')} style={{left:p.x+'%',top:p.y+'%'}} aria-label={'Go to '+n.title} aria-current={on?'page':undefined} onClick={()=>onGo(n.id)} onMouseEnter={()=>setTip(n.id)} onMouseLeave={()=>setTip(null)} onFocus={()=>setTip(n.id)} onBlur={()=>setTip(null)}><Icon/></button>})}
  <span className="mind-nav-label" aria-live="polite"><b>{label?label.title:'The Mind'}</b><em>{index>=0?String(index+1).padStart(2,'0')+' / '+String(nodes.length).padStart(2,'0'):'Pick a node'}</em></span>
 </nav>;
}
