'use client';
import {useEffect,useState} from 'react';
import {Activity,AlertTriangle,ArrowRight,Check,ClipboardList,FileWarning,Flag,RotateCcw,Scale,ShieldCheck,X} from 'lucide-react';

type Appeal={id:string;userId?:string;author?:string;targetKind:'post'|'ban';targetId:string;reason:string;status:'open'|'approved'|'denied';resolutionNote:string;createdAt:number;reviewedAt:number};
type Removed={postId:string;userId?:string;excerpt:string;reason:string;actorId?:string;createdAt?:number;removedAt?:number;hiddenAt?:number};
type Report={postId:string;reporterId:string;authorId:string;reason:string;excerpt:string;createdAt:number};
type Event={id:string;actorId:string;action:string;targetId:string;note:string;createdAt:number};
type Mine={appeals:Appeal[];removed:Removed[];banned:boolean};
type Dashboard={removed:Removed[];appeals:Appeal[];reports:Report[];history:Event[]};
const fmt=(time:number)=>new Date(time).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
async function moderation<T>(group:string,mode:string,payload?:unknown):Promise<T>{
 const url='/api/social/communities/moderation'+(payload===undefined?'?communityId='+encodeURIComponent(group)+'&mode='+mode:'');
 const r=await fetch(url,payload===undefined?{cache:'no-store'}:{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({communityId:group,...payload as object})});
 const data=await r.json() as T & {error?:string};
 if(!r.ok)throw Error(data.error||'Moderation request failed.');
 return data;
}
export function CommunityModeration({communityId,role,signedIn,onRefresh}:{communityId:string;role:'owner'|'moderator'|'member'|null;signedIn:boolean;onRefresh:()=>void}){
 const staff=role==='owner'||role==='moderator';
 const [mine,setMine]=useState<Mine|null>(null),[dashboard,setDashboard]=useState<Dashboard|null>(null);
 const [tab,setTab]=useState<'reports'|'appeals'|'removed'|'audit'|'mine'>('reports');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[tick,setTick]=useState(0);
 const [appealText,setAppealText]=useState('');
 const [selectedPost,setSelectedPost]=useState('');
 useEffect(()=>{
  if(!signedIn){setLoading(false);return}
  let canceled=false;setLoading(true);
  Promise.all([moderation<Mine>(communityId,'mine'),staff?moderation<Dashboard>(communityId,'dashboard'):Promise.resolve(null)])
   .then(([own,board])=>{if(canceled)return;setMine(own);setDashboard(board)})
   .catch(e=>{if(!canceled)setError(e instanceof Error?e.message:'Unable to load moderation cases.')})
   .finally(()=>{if(!canceled)setLoading(false)});
  return()=>{canceled=true};
 },[communityId,staff,signedIn,tick]);
 async function act(payload:Record<string,string>,message:string){
  setBusy(true);setError('');setNotice('');
  try{await moderation(communityId,'',payload);setNotice(message);setAppealText('');setSelectedPost('');setTick(v=>v+1);onRefresh();return true}
  catch(e){setError(e instanceof Error?e.message:'Could not complete moderation action.');return false}
  finally{setBusy(false)}
 }
 async function makeAppeal(kind:'ban'|'post',id:string){
  if(appealText.trim().length<12){setError('Describe your appeal in at least 12 characters.');return}
  await act({action:'appeal',targetKind:kind,targetId:id,reason:appealText},'Your appeal has been submitted for review.');
 }
 async function decideAppeal(appeal:Appeal,decision:'approve'|'deny'){
  const note=window.prompt((decision==='approve'?'Approve':'Deny')+' this appeal? Add an explanation for the member:','Reviewed against community guidelines');
  if(note===null)return;
  await act({action:'resolve_appeal',appealId:appeal.id,decision,note},decision==='approve'?'Appeal approved and decision reversed.':'Appeal denied.');
 }
 async function reviewReport(report:Report,decision:'resolve'|'dismiss'|'remove'){
  const note=window.prompt(decision==='remove'?'Remove this post from the community? Give a moderation reason:':'Record the resolution reason:',report.reason);
  if(note===null)return;
  await act({action:'review_report',postId:report.postId,reporterId:report.reporterId,decision,note},decision==='remove'?'Post removed and report resolved.':'Report reviewed.');
 }
 async function restore(post:Removed){
  if(!window.confirm('Restore this community post? Confirm it is appropriate to make visible again.'))return;
  const note=window.prompt('Reason for restoring this post:','Removal reversed after review');
  if(note===null)return;
  await act({action:'restore_post',postId:post.postId,note},'Community post restored.');
 }
 if(!signedIn)return null;
 const pending=dashboard?.appeals.filter(a=>a.status==='open')||[];
 const current=staff&&tab!=='mine'?tab:'mine';
 return <section className="sc-mod-center" aria-label="Community moderation center">
  <div className="sc-mod-heading"><span><ShieldCheck/> COMMUNITY TRUST CENTER</span><h4>{staff?'Review. Protect. Restore.':'Your community appeals'}</h4><p>{staff?'Review incoming cases, reverse mistakes and keep an auditable decision history.':'You may appeal an active community ban or a removed post. Moderators will review your request.'}</p></div>
  {staff&&<div className="sc-mod-tabs" role="group" aria-label="Moderation views">
   <button className={current==='reports'?'active':''} onClick={()=>setTab('reports')}><Flag/> Reports {dashboard?.reports.length||0}</button>
   <button className={current==='appeals'?'active':''} onClick={()=>setTab('appeals')}><Scale/> Appeals {pending.length}</button>
   <button className={current==='removed'?'active':''} onClick={()=>setTab('removed')}><FileWarning/> Removed {dashboard?.removed.length||0}</button>
   <button className={current==='audit'?'active':''} onClick={()=>setTab('audit')}><Activity/> History</button>
   <button className={current==='mine'?'active':''} onClick={()=>setTab('mine')}><ClipboardList/> My appeals</button>
  </div>}
  {error&&<div className="sc-message sc-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X/></button></div>}
  {notice&&<div className="sc-message" role="status"><Check/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss message"><X/></button></div>}
  {loading?<p className="sc-mod-empty">Loading case files…</p>:
  current==='reports'?<div className="sc-mod-cases">{dashboard?.reports.length?dashboard.reports.map((report,i)=><article className="sc-case" key={report.postId+report.reporterId+i}>
   <div className="sc-case-kicker"><Flag/> OPEN REPORT <span>{fmt(report.createdAt)}</span></div>
   <h5>{report.reason}</h5><p>{report.excerpt||'Image or image-only post'}</p><small>Post: {report.postId.slice(0,12)} · Reporter: {report.reporterId.slice(0,12)}</small>
   <div className="sc-case-actions"><button disabled={busy} onClick={()=>reviewReport(report,'remove')}><FileWarning/> Remove post</button><button disabled={busy} onClick={()=>reviewReport(report,'resolve')}><Check/> Resolve</button><button disabled={busy} onClick={()=>reviewReport(report,'dismiss')}><X/> Dismiss</button></div>
  </article>):<div className="sc-mod-empty"><ShieldCheck/> No open community reports.</div>}</div>:
  current==='appeals'?<div className="sc-mod-cases">{dashboard?.appeals.length?dashboard.appeals.map(appeal=><article className="sc-case" key={appeal.id}>
   <div className="sc-case-kicker"><Scale/> {appeal.targetKind.toUpperCase()} APPEAL <span>{fmt(appeal.createdAt)}</span></div>
   <h5>{appeal.author||appeal.userId} <span className={'sc-case-status '+appeal.status}>{appeal.status}</span></h5>
   <p>{appeal.reason}</p><small>Target: {appeal.targetId.slice(0,16)}{appeal.resolutionNote?' · Decision: '+appeal.resolutionNote:''}</small>
   {appeal.status==='open'&&<div className="sc-case-actions"><button disabled={busy} onClick={()=>decideAppeal(appeal,'approve')}><Check/> Approve</button><button disabled={busy} onClick={()=>decideAppeal(appeal,'deny')}><X/> Deny</button></div>}
  </article>):<div className="sc-mod-empty"><ShieldCheck/> No appeals to review.</div>}</div>:
  current==='removed'?<div className="sc-mod-cases">{dashboard?.removed.length?dashboard.removed.map(post=><article className="sc-case" key={post.postId}>
   <div className="sc-case-kicker"><FileWarning/> REMOVED POST <span>{fmt(post.createdAt||0)}</span></div>
   <h5>{post.reason||'Community guideline decision'}</h5><p>{post.excerpt||'Image or image-only post'}</p><small>Author: {post.userId?.slice(0,12)} · Moderator: {post.actorId?.slice(0,12)}</small>
   <div className="sc-case-actions"><button disabled={busy||!!post.hiddenAt} onClick={()=>restore(post)}><RotateCcw/> Restore post</button></div>
   {!!post.hiddenAt&&<small>Unavailable: also hidden or deleted at platform level.</small>}
  </article>):<div className="sc-mod-empty">No active removed posts.</div>}</div>:
  current==='audit'?<div className="sc-audit">{dashboard?.history.length?dashboard.history.map(e=><div key={e.id}><span className="sc-audit-icon"><Activity/></span><div><strong>{e.action.replaceAll('_',' ')}</strong><p>{e.note||'Community moderation action'}</p><small>{fmt(e.createdAt)} · Actor {e.actorId.slice(0,12)} · Target {e.targetId.slice(0,12)}</small></div></div>):<div className="sc-mod-empty">No moderation decisions recorded yet.</div>}</div>:
  <div className="sc-appeal-self">
   {mine?.banned&&<section><h5><AlertTriangle/> Community membership restriction</h5><p>Your community ban can be appealed for review.</p><button className="sc-mod-appeal-toggle" onClick={()=>setSelectedPost('ban')}>Appeal ban <ArrowRight/></button></section>}
   {mine?.removed.map(post=><section key={post.postId}><h5><FileWarning/> Your removed post</h5><p>{post.excerpt||'Image post'}</p><small>{post.reason}</small><button className="sc-mod-appeal-toggle" onClick={()=>setSelectedPost(post.postId)}>Appeal removal <ArrowRight/></button></section>)}
   {selectedPost&&<form className="sc-mod-appeal-form" onSubmit={e=>{e.preventDefault();void makeAppeal(selectedPost==='ban'?'ban':'post',selectedPost==='ban'?'self':selectedPost)}}><label htmlFor="sc-appeal-reason">Explain why this decision should be reconsidered</label><textarea id="sc-appeal-reason" minLength={12} maxLength={500} required value={appealText} onChange={e=>setAppealText(e.target.value)} placeholder="Provide context for the moderators…"/><div><button type="button" onClick={()=>setSelectedPost('')}>Cancel</button><button type="submit" disabled={busy||appealText.trim().length<12}>Send appeal</button></div></form>}
   <h5><ClipboardList/> Your appeal history</h5>
   {mine?.appeals.length?mine.appeals.map(a=><article className="sc-appeal-history" key={a.id}><div><strong>{a.targetKind==='ban'?'Member ban':'Removed post'}</strong><span className={'sc-case-status '+a.status}>{a.status}</span></div><p>{a.reason}</p>{a.status!=='open'&&<small>Decision: {a.resolutionNote||'Reviewed'} · {fmt(a.reviewedAt)}</small>}</article>):<p className="sc-mod-empty">You have not submitted any appeals.</p>}
  </div>}
 </section>;
}
