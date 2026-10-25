'use client';
import {useCallback,useEffect,useState} from 'react';
import {AtSign,Bell,BellRing,Check,CheckCheck,ChevronLeft,ChevronRight,Settings2,ShieldAlert,UserRound,X} from 'lucide-react';

type Kind='follow'|'reaction'|'reply'|'mention'|'post_removed'|'post_restored'|'ban'|'unban'|'appeal_review'|'join_review'|'report_review';
type Notice={id:string;kind:Kind;actorId:string|null;actor:string;postId:string|null;communityId:string|null;message:string;createdAt:number;readAt:number};
type Preferences={social:number;mentions:number;communities:number;moderation:number};
type Inbox={notifications:Notice[];hasMore:boolean;unread:number;handle:string;preferences:Preferences};
const categories:[keyof Preferences,string,string][]=[['social','Social activity','Follows, reactions and replies'],['mentions','Creator mentions','Someone tags your @handle'],['communities','Community requests','Membership approvals and decisions'],['moderation','Security and moderation','Bans, removals, appeals and restorations']];
const copy:Record<Kind,string>={follow:'followed you',reaction:'liked your post',reply:'replied to your post',mention:'mentioned you in a post',post_removed:'moderated one of your posts',post_restored:'restored a community post',ban:'restricted your community membership',unban:'lifted your community ban',appeal_review:'updated an appeal',join_review:'reviewed your membership request',report_review:'reviewed a post report'};
async function call<T>(params='',payload?:unknown):Promise<T>{
 const r=await fetch('/api/social/notifications'+params,payload===undefined?{cache:'no-store'}:{method:'PATCH',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const d=await r.json() as T&{error?:string};if(!r.ok)throw Error(d.error||'Notification request failed.');return d;
}
const since=(ms:number)=>{const delta=Math.max(0,Date.now()-ms);return delta<60000?'Just now':delta<3600000?Math.floor(delta/60000)+'m ago':delta<86400000?Math.floor(delta/3600000)+'h ago':new Date(ms).toLocaleDateString(undefined,{month:'short',day:'numeric'})};
export function SocialNotifications({onOpenPost,onOpenCommunity,onOpenProfile,onUnreadChange}:{onOpenPost:(id:string)=>void;onOpenCommunity:(id:string)=>void;onOpenProfile:(id:string)=>void;onUnreadChange:(n:number)=>void}){
 const [entries,setEntries]=useState<Notice[]>([]),[unread,setUnread]=useState(0),[hasMore,setHasMore]=useState(false),[filter,setFilter]=useState<'all'|'unread'>('all'),[page,setPage]=useState(0);
 const [preferences,setPreferences]=useState<Preferences|null>(null),[handle,setHandle]=useState(''),[editHandle,setEditHandle]=useState('');
 const [settingsOpen,setSettingsOpen]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const refresh=useCallback(async()=>{
  const result=await call<Inbox>('?mode=list&filter='+filter+'&page='+page);
  setEntries(result.notifications);setUnread(result.unread);setHasMore(result.hasMore);setPreferences(result.preferences);setHandle(result.handle);onUnreadChange(result.unread);
 },[filter,page,onUnreadChange]);
 useEffect(()=>{
  let cancelled=false;
  call<Inbox>('?mode=list&filter='+filter+'&page='+page).then(r=>{if(cancelled)return;setEntries(r.notifications);setUnread(r.unread);setHasMore(r.hasMore);setPreferences(r.preferences);setHandle(r.handle);setEditHandle(r.handle);onUnreadChange(r.unread)}).catch(e=>{if(!cancelled)setError(e.message)}).finally(()=>{if(!cancelled)setLoading(false)});
  return()=>{cancelled=true};
 },[filter,page,onUnreadChange]);
 useEffect(()=>{const timer=setInterval(()=>{void refresh().catch(()=>{})},20000);return()=>clearInterval(timer)},[refresh]);
 async function update(payload:unknown,notice:string){
  setBusy(true);setError('');setSuccess('');
  try{await call('',payload);setSuccess(notice);await refresh();return true}
  catch(e){setError(e instanceof Error?e.message:'Could not update notifications.');return false}
  finally{setBusy(false)}
 }
 async function mark(item:Notice){
  if(!item.readAt)await update({action:'read',id:item.id},'');
  if(item.postId){onOpenPost(item.postId);return;}
  if(item.communityId){onOpenCommunity(item.communityId);return;}
  if(item.actorId)onOpenProfile(item.actorId);
 }
 async function toggle(key:keyof Preferences){if(preferences)await update({action:'preferences',preferences:{[key]:!preferences[key]}},'Preference saved.')}
 async function claim(){const newHandle=editHandle.trim().toLowerCase();if(await update({action:'handle',handle:newHandle},'Creator handle updated.'))setHandle(newHandle);}
 return <section className="sn-inbox" aria-label="Social notification center">
  <div className="sn-hero"><div><span><BellRing/> MEMESPACE / SIGNAL INBOX</span><h3>Stay in the loop.</h3><p>Replies, creator mentions, community decisions and moderation updates. Automatically refreshed while this view is open.</p></div><button aria-label="Notification preferences" className={settingsOpen?'sn-settings active':'sn-settings'} onClick={()=>setSettingsOpen(v=>!v)}><Settings2/> Preferences</button></div>
  {error&&<div className="social-alert social-error" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X/></button></div>}
  {success&&<div className="social-alert social-success" role="status">{success}<button aria-label="Dismiss message" onClick={()=>setSuccess('')}><X/></button></div>}
  {settingsOpen&&<section className="sn-preferences" aria-label="Notification preferences"><h4><Settings2/> Signal controls</h4><p>Choose which events create new notifications for your account.</p><div className="sn-toggle-list">{categories.map(([key,label,desc])=><label key={key}><span><strong>{label}</strong><small>{desc}</small></span><input aria-label={label} type="checkbox" checked={!!preferences?.[key]} disabled={busy||!preferences} onChange={()=>void toggle(key)}/></label>)}</div><form className="sn-handle-form" onSubmit={e=>{e.preventDefault();void claim()}}><label htmlFor="sn-handle">Your public creator handle</label><div><AtSign/><input id="sn-handle" value={editHandle} onChange={e=>setEditHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,24))} placeholder="your_creative_name" minLength={3} maxLength={24} pattern="[a-z][a-z0-9_]{2,23}"/><button type="submit" disabled={busy||editHandle===handle||!/^[a-z][a-z0-9_]{2,23}$/.test(editHandle)}><Check/> Save</button></div><small>Unique handles enable @mentions in posts and images. You can change yours once every seven days. {handle?'Current: @'+handle:'Choose a handle to get started.'}</small></form></section>}
  <div className="sn-toolbar"><div className="sn-filters"><button className={filter==='all'?'active':''} onClick={()=>{setFilter('all');setPage(0)}}>All signals</button><button className={filter==='unread'?'active':''} onClick={()=>{setFilter('unread');setPage(0)}}>Unread {unread>0&&<strong>{unread>99?'99+':unread}</strong>}</button></div><button className="sn-mark-all" disabled={busy||!unread} onClick={()=>void update({action:'read_all'},'All notifications marked read.')}><CheckCheck/> Mark all read</button></div>
  {loading?<p className="sn-empty">Loading notifications…</p>:entries.length?<div className="sn-entries">{entries.map(item=><button className={item.readAt?'sn-entry':'sn-entry unread'} key={item.id} disabled={busy} onClick={()=>void mark(item)}><span className="sn-entry-symbol">{item.kind==='mention'?<AtSign/>:item.kind==='post_removed'||item.kind==='ban'||item.kind==='appeal_review'?<ShieldAlert/>:item.kind==='follow'?<UserRound/>:<Bell/>}</span><span className="sn-entry-content"><strong>{item.actor||'MemeSpace'} <span>{copy[item.kind]}</span></strong>{item.message&&<small>{item.message}</small>}<em>{since(item.createdAt)}</em></span>{!item.readAt&&<span className="sn-unread-dot" aria-label="Unread"/>}<ChevronRight/></button>)}</div>:<div className="sn-empty"><Bell/><strong>{filter==='unread'?'Nothing left unread.':'Your signal is clear.'}</strong><p>New activity will appear here when other members engage with you.</p></div>}
  <div className="sn-pages">{page>0&&<button onClick={()=>setPage(p=>p-1)}><ChevronLeft/> Newer</button>}{hasMore&&<button onClick={()=>setPage(p=>p+1)}>Older <ChevronRight/></button>}</div>
 </section>;
}
