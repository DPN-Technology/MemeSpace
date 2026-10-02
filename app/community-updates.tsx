'use client';
import {useEffect,useState} from 'react';
import {Bell,ChevronDown,ChevronUp} from 'lucide-react';
type Update={id:string;title:string;body:string;tone:string;published_at:number};
export function CommunityUpdates({inside}:{inside:boolean}){
 const [updates,setUpdates]=useState<Update[]>([]),[expanded,setExpanded]=useState(false),[readOnly,setReadOnly]=useState(false);
 useEffect(()=>{let alive=true;const load=()=>fetch('/api/platform').then(r=>r.ok?r.json():null).then((d:any)=>{if(alive&&d){setUpdates(d.announcements);setReadOnly(d.chatReadOnly)}}).catch(()=>{});void load();const id=setInterval(load,30000);return()=>{alive=false;clearInterval(id)}},[]);
 if(!inside||(!updates.length&&!readOnly))return null;
 return <aside className={'community-updates '+(expanded?'expanded':'')} aria-label="Community updates"><button className="updates-trigger" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}><Bell/><span><small>COMMUNITY SIGNAL</small><strong>{updates[0]?.title||'Chat is temporarily read only'}</strong></span>{expanded?<ChevronUp/>:<ChevronDown/>}</button>{expanded&&<div className="updates-list">{readOnly&&<p className="notice">Chat is temporarily read only. You can still browse conversations.</p>}{updates.map(u=><article key={u.id}><small>{u.tone.toUpperCase()} · {new Date(u.published_at).toLocaleDateString()}</small><h3>{u.title}</h3><p>{u.body}</p></article>)}</div>}</aside>
}
