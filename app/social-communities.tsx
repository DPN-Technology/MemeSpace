'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {CommunityModeration} from './social-community-moderation';
import {ArrowLeft,ArrowRight,Ban,Check,Compass,Crown,LockKeyhole,Plus,ShieldCheck,Sparkles,Users,X} from 'lucide-react';

export type Community={id:string;slug:string;name:string;description:string;ownerId:string;createdAt:number;updatedAt:number;members:number;posts:number|null;visibility:'public'|'private';requested:boolean;role:'owner'|'moderator'|'member'|null;banned:boolean};
type Member={userId:string;name:string;role:'owner'|'moderator'|'member';joinedAt:number};
type BanRecord={userId:string;reason:string;createdAt:number};
type JoinRequest={userId:string;name:string;requestedAt:number};
async function request<T>(params='',payload?:unknown,method='POST'):Promise<T>{
 const response=await fetch('/api/social/communities'+params,payload===undefined?{cache:'no-store'}:{cache:'no-store',method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const data=await response.json() as T & {error?:string};
 if(!response.ok)throw Error(data.error||'Community request failed.');
 return data;
}
export function SocialCommunities({selectedId,onOpen,onBack,onCommunityChange,onRefresh,signedIn,openIdentity}:{selectedId:string;onOpen:(id:string)=>void;onBack:()=>void;onCommunityChange:(community:Community|null)=>void;onRefresh:()=>void;signedIn:boolean;openIdentity:()=>void}){
 const [communities,setCommunities]=useState<Community[]>([]);
 const [community,setCommunity]=useState<Community|null>(null);
 const [members,setMembers]=useState<Member[]>([]);
 const [bans,setBans]=useState<BanRecord[]>([]);
 const [requests,setRequests]=useState<JoinRequest[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [tick,setTick]=useState(0);
 const [search,setSearch]=useState('');
 const [creating,setCreating]=useState(false);
 const [editing,setEditing]=useState(false);
 const [name,setName]=useState('');
 const [slug,setSlug]=useState('');
 const [description,setDescription]=useState('');
 const [visibility,setVisibility]=useState<'public'|'private'>('public');
 useEffect(()=>{
  let ignore=false;setLoading(true);
  const route=selectedId?'?id='+encodeURIComponent(selectedId):'?q='+encodeURIComponent(search);
  request<{community:Community;members:Member[];bans:BanRecord[];requests:JoinRequest[];communities:Community[]}>(route)
  .then(data=>{if(ignore)return;
   if(selectedId){setCommunity(data.community);setMembers(data.members);setBans(data.bans);setRequests(data.requests);onCommunityChange(data.community);}
   else{setCommunities(data.communities);setCommunity(null);onCommunityChange(null);}
  }).catch(e=>{if(!ignore)setError(e instanceof Error?e.message:'Unable to load communities.')})
  .finally(()=>{if(!ignore)setLoading(false)});
  return()=>{ignore=true};
 },[selectedId,search,tick,onCommunityChange]);
 async function mutate(payload:unknown,method='POST'){
  if(!signedIn){openIdentity();return false;}
  setBusy(true);setError('');setNotice('');
  try{
   await request('',payload,method);
   setTick(v=>v+1);onRefresh();return true;
  }catch(e){setError(e instanceof Error?e.message:'Action failed.');return false}
  finally{setBusy(false)}
 }
 async function create(){
  const response=await mutate({action:'create',name,slug,description,visibility});
  if(response){setCreating(false);setName('');setSlug('');setDescription('');setVisibility('public');setNotice('Community created.');setTick(v=>v+1);}
 }
 async function update(){
  if(!community)return;
  if(await mutate({communityId:community.id,name,description,visibility},'PATCH')){setEditing(false);setNotice('Community details updated.');}
 }
 async function membership(){
  if(!community)return;
  const operation=community.requested?'cancel_request':community.role?'leave':'join';
  if(await mutate({action:operation,communityId:community.id})){
   setNotice(operation==='cancel_request'?'Join request cancelled.':operation==='leave'?'You left the community.':community.visibility==='private'?'Join request sent for moderator approval.':'Welcome to the community.');
  }
 }
 async function changeRole(member:Member){
  if(!community)return;
  if(await mutate({action:'role',communityId:community.id,userId:member.userId,role:member.role==='moderator'?'member':'moderator'}))setNotice('Member permissions updated.');
 }
 async function ban(member:Member){
  if(!community)return;
  const reason=window.prompt('Reason for removing this member from the community:','Community guidelines violation');
  if(reason===null)return;
  if(await mutate({action:'ban',communityId:community.id,userId:member.userId,reason}))setNotice('Member banned from this community.');
 }
 async function review(item:JoinRequest,approved:boolean){
  if(!community)return;
  if(await mutate({action:approved?'approve':'deny',communityId:community.id,userId:item.userId}))setNotice(approved?'Member request approved.':'Member request declined.');
 }
 async function transfer(member:Member){
  if(!community||community.role!=='owner')return;
  if(!window.confirm('Transfer ownership of '+community.name+' to '+member.name+'? You will become a moderator.'))return;
  const confirm=window.prompt('To confirm the transfer, type TRANSFER OWNERSHIP');
  if(confirm!=='TRANSFER OWNERSHIP')return;
  if(await mutate({action:'transfer',communityId:community.id,userId:member.userId,confirm}))setNotice('Ownership transferred to '+member.name+'.');
 }
 async function unban(item:BanRecord){
  if(!community)return;
  if(await mutate({action:'unban',communityId:community.id,userId:item.userId}))setNotice('Ban lifted. The member may join again.');
 }
 return <div className="sc-hub">
  {error&&<div className="sc-message sc-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X/></button></div>}
  {notice&&<div className="sc-message" role="status"><Check/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss message"><X/></button></div>}
  {!selectedId?<section className="sc-directory">
   <div className="sc-hero"><span><Sparkles/> MEMESPACE / CREATOR UNIVERSES</span><h3>Build a world around your people.</h3><p>Find a circle for your memes, ideas and creativity, or launch a community of your own. Every community is powered by real members and posts.</p><button className="sc-primary" onClick={()=>{if(!signedIn){openIdentity();return}setCreating(v=>!v)}}><Plus/> {creating?'Close creator':'Create a community'}</button></div>
   {creating&&<form className="sc-form" onSubmit={e=>{e.preventDefault();void create()}}>
    <h4>Launch your space</h4><label>Community name<input required minLength={3} maxLength={64} value={name} onChange={e=>{setName(e.target.value);setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40))}} placeholder="Meme Builders Guild"/></label>
    <label>Unique address<input required minLength={3} maxLength={40} pattern="[a-z][a-z0-9-]{2,39}" value={slug} onChange={e=>setSlug(e.target.value)} placeholder="meme-builders"/></label>
    <label>About your community<textarea maxLength={400} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Tell members why this community exists…"/></label>
    <label>Visibility<select value={visibility} onChange={e=>setVisibility(e.target.value as 'public'|'private')}><option value="public">Public · anyone can read and join</option><option value="private">Private · posts visible to approved members</option></select></label>
    <button className="sc-primary" disabled={busy||name.trim().length<3||!/^[a-z][a-z0-9-]{2,39}$/.test(slug)} type="submit"><Plus/> Create community</button>
   </form>}
   <div className="sc-find"><Compass/><input aria-label="Find communities" placeholder="Search creator communities…" value={search} onChange={e=>setSearch(e.target.value.slice(0,80))}/></div>
   {loading?<p className="sc-empty">Loading creator communities…</p>:communities.length?<div className="sc-grid">{communities.map(c=><button className="sc-tile" key={c.id} onClick={()=>onOpen(c.id)}><div className="sc-tile-icon"><Users/></div><div className="sc-tile-name"><h4>{c.name}</h4>{c.visibility==='private'&&<span className="sc-member-chip"><LockKeyhole/> Private</span>}{c.role&&<span className="sc-member-chip">{c.role==='owner'?'Owner':c.role==='moderator'?'Moderator':'Joined'}</span>}</div><p>{c.description||'A community for creators to share and connect.'}</p><div className="sc-tile-foot"><span>{c.members} members</span><span>{c.posts===null?'Members only':c.posts+' posts'}</span><ArrowRight/></div></button>)}</div>:<div className="sc-empty"><Users/><h4>No communities found</h4><p>Try a different search or launch the first creator community.</p></div>}
  </section>:<section className="sc-detail">
   <button className="sc-back" onClick={onBack}><ArrowLeft/> All communities</button>
   {loading&&!community?<p className="sc-empty">Loading community…</p>:community&&<>
    <div className="sc-cover"><span>{community.visibility==='private'?<><LockKeyhole/> PRIVATE CREATOR COMMUNITY</>:<><Sparkles/> CREATOR COMMUNITY</>}</span><h3>{community.name}</h3><p>{community.description||'Welcome to this creator community.'}</p><div className="sc-cover-stats"><span><Users/> {community.members} members</span><span>{community.posts===null?'Members-only posts':community.posts+' posts'}</span><span>/{community.slug}</span></div></div>
    <div className="sc-actions">
     <Link href={'/social?community='+encodeURIComponent(community.slug)} className="sc-deeplink">Community link <ArrowRight/></Link>
     {community.role&&<span className="sc-member-chip"><ShieldCheck/> {community.role}</span>}
     {community.banned?<span className="sc-locked"><Ban/> Membership restricted</span>:community.role==='owner'?<button className="sc-primary" onClick={()=>{setEditing(v=>!v);setName(community.name);setDescription(community.description);setVisibility(community.visibility)}}><Crown/> Manage community</button>:<button className="sc-primary" disabled={busy} onClick={membership}>{community.requested?<><X/> Cancel request</>:community.role?<><X/> Leave community</>:community.visibility==='private'?<><LockKeyhole/> Request to join</>:<><Plus/> Join community</>}</button>}
    </div>
    {editing&&community.role==='owner'&&<form className="sc-form" onSubmit={e=>{e.preventDefault();void update()}}><h4>Community settings</h4><label>Display name<input value={name} maxLength={64} minLength={3} required onChange={e=>setName(e.target.value)}/></label><label>Description<textarea value={description} maxLength={400} onChange={e=>setDescription(e.target.value)}/></label><label>Visibility<select value={visibility} onChange={e=>setVisibility(e.target.value as 'public'|'private')}><option value="public">Public</option><option value="private">Private · approval required</option></select></label><button type="submit" disabled={busy||name.trim().length<3} className="sc-primary"><Check/> Save settings</button></form>}
    {['owner','moderator'].includes(community.role||'')&&<section className="sc-request-queue"><h4><ShieldCheck/> Membership approval queue <span>{requests.length} pending</span></h4>{requests.length?requests.map(item=><div key={item.userId}><span><strong>{item.name}</strong><small>Requested {new Date(item.requestedAt).toLocaleDateString()}</small></span><button disabled={busy} onClick={()=>review(item,true)}><Check/> Approve</button><button disabled={busy} onClick={()=>review(item,false)}><X/> Deny</button></div>):<p>No pending membership requests.</p>}</section>}
    {community.visibility==='private'&&!community.role&&<div className="sc-post-gate"><LockKeyhole/> Community posts and members are visible only after approval.</div>}
    <CommunityModeration communityId={community.id} role={community.role} signedIn={signedIn} onRefresh={onRefresh}/>
    <div className="sc-members"><div className="sc-members-title"><h4><Users/> Community members</h4><span>{community.members} members</span></div>
    {members.map(member=><div className="sc-member" key={member.userId}><span className="sc-member-avatar">{member.name.trim().slice(0,2).toUpperCase()}</span><span className="sc-member-info"><strong>{member.name}</strong><small>{member.role==='owner'?'Community founder':member.role==='moderator'?'Moderator':'Member'}</small></span>
     {community.role==='owner'&&member.role!=='owner'&&<button onClick={()=>transfer(member)} disabled={busy} className="sc-mod-action" title="Transfer community ownership"><Crown/> Transfer</button>}
     {community.role==='owner'&&member.role!=='owner'&&<button onClick={()=>changeRole(member)} disabled={busy} className="sc-mod-action">{member.role==='moderator'?'Demote':'Make mod'}</button>}
     {['owner','moderator'].includes(community.role||'')&&member.role!=='owner'&&(community.role==='owner'||member.role!=='moderator')&&<button onClick={()=>ban(member)} disabled={busy} className="sc-ban-action" title="Ban member"><Ban/></button>}</div>)}
    {['owner','moderator'].includes(community.role||'')&&bans.length>0&&<div className="sc-bans"><h4><LockKeyhole/> Banned members</h4>{bans.map(item=><div key={item.userId}><span><strong>{item.userId.slice(0,12)}</strong><small>{item.reason||'Community restriction'}</small></span><button disabled={busy} onClick={()=>unban(item)}>Unban</button></div>)}</div>}
    </div>
   </>}
  </section>}
 </div>;
}
