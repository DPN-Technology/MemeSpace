'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';
import {ArrowLeft,ArrowRight,Check,Compass,Filter,Image as ImageIcon,MapPin,Search,Sparkles,Users} from 'lucide-react';

type Creator={userId:string;name:string;bio:string;handle:string;headline:string;interests:string;location:string;accent:'mint'|'violet'|'coral'|'amber';hasAvatar:boolean;posts:number;lastPostedAt:number;joinedAt:number;followers:number;following:boolean;mutuals:number};
type Sort='recommended'|'active'|'popular'|'new';
type Filter='all'|'following'|'mutuals'|'avatars';
type Topic='all'|'general'|'memes'|'gaming'|'culture'|'web3';
type ResponseData={creators:Creator[];hasMore:boolean;page:number};
const accent:Record<string,string>={mint:'#b4ffd2',violet:'#d5bcff',coral:'#ffbba8',amber:'#ffe19b'};
const channels:{value:Topic;label:string}[]=[{value:'all',label:'All worlds'},{value:'memes',label:'Memes'},{value:'gaming',label:'Gaming'},{value:'culture',label:'Culture'},{value:'web3',label:'Web3'},{value:'general',label:'General'}];
export function SocialDiscovery({signedIn,openIdentity,onOpenProfile,onRefresh}:{signedIn:boolean;openIdentity:()=>void;onOpenProfile:(id:string)=>void;onRefresh:()=>void}){
 const [typed,setTyped]=useState(''),[query,setQuery]=useState('');
 const [sort,setSort]=useState<Sort>('recommended'),[filter,setFilter]=useState<Filter>('all'),[topic,setTopic]=useState<Topic>('all'),[page,setPage]=useState(0);
 const [creators,setCreators]=useState<Creator[]>([]),[hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refreshId,setRefreshId]=useState(0);
 useEffect(()=>{
  let cancelled=false;setLoading(true);setError('');
  const params=new URLSearchParams({q:query,sort,filter,topic,page:String(page)});
  fetch('/api/social/discover?'+params.toString(),{cache:'no-store'}).then(async r=>{const data=await r.json() as ResponseData&{error?:string};if(!r.ok)throw Error(data.error||'Creator discovery failed.');return data})
   .then(data=>{if(cancelled)return;setCreators(data.creators);setHasMore(data.hasMore)})
   .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Could not load creators.')})
   .finally(()=>{if(!cancelled)setLoading(false)});
  return()=>{cancelled=true};
 },[query,sort,filter,topic,page,refreshId]);
 async function follow(creator:Creator){
  if(!signedIn){openIdentity();return}
  setBusy(creator.userId);setError('');setNotice('');
  try{
   const r=await fetch('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'follow',userId:creator.userId,enabled:!creator.following})});
   const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Unable to update follow.');
   setCreators(all=>all.map(row=>row.userId===creator.userId?{...row,following:!row.following,followers:Math.max(0,row.followers+(row.following?-1:1))}:row));
   setNotice(creator.following?'Creator unfollowed.':'Creator added to your network.');
   if(filter==='following'&&creator.following)setRefreshId(v=>v+1);
   onRefresh();
  }catch(e){setError(e instanceof Error?e.message:'Unable to follow creator.')}
  finally{setBusy(null)}
 }
 const setFilterValue=(f:Filter)=>{setFilter(f);setPage(0)};
 return <section className="sd-directory" aria-label="Creator discovery">
  <div className="sd-hero"><div className="sd-hero-eyebrow"><Compass/> MEMESPACE / SIGNAL DISCOVERY</div><h3>Find the minds behind the memes.</h3><p>Discover real creators by their public work, shared connections, interests and identity. No fictional followers or manufactured rankings.</p><div className="sd-hero-meta"><span><Sparkles/> Creator-powered</span><span><Users/> Real connections</span></div></div>
  <form className="sd-search" role="search" onSubmit={e=>{e.preventDefault();setQuery(typed.trim().replace(/^@/,''));setPage(0)}}>
   <Search/><input aria-label="Search creators by name, handle or interests" value={typed} onChange={e=>setTyped(e.target.value.slice(0,80))} placeholder="Creator name, @handle, headline or interests…" maxLength={80}/>
   <button type="submit"><Search/> Find creators</button>
  </form>
  <div className="sd-controls">
   <div className="sd-filter-row" role="group" aria-label="Creator filters">
    <span><Filter/> SHOW</span>
    {([['all','Everyone'],['following','Following'],['mutuals','Mutuals'],['avatars','With avatars']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} className={filter===value?'active':''} onClick={()=>setFilterValue(value)}>{label}</button>)}
   </div>
   <div className="sd-selects"><label>Content niche<select aria-label="Creator content niche" value={topic} onChange={e=>{setTopic(e.target.value as Topic);setPage(0)}}>{channels.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
    <label>Order by<select aria-label="Creator discovery order" value={sort} onChange={e=>{setSort(e.target.value as Sort);setPage(0)}}><option value="recommended">Community signals</option><option value="active">Recent public posts</option><option value="popular">Most followed</option><option value="new">Newest members</option></select></label>
   </div>
  </div>
  {error&&<div className="social-alert social-error" role="alert">{error}</div>}
  {notice&&<div className="social-alert social-success" role="status">{notice}</div>}
  {loading?<div className="sd-empty"><Sparkles/> Searching the creator network…</div>:creators.length?<div className="sd-grid">{creators.map(c=><article key={c.userId} className="sd-card" style={{['--sd-accent' as string]:accent[c.accent]||accent.mint} as React.CSSProperties}>
   <div className="sd-card-banner"><span>CREATOR // {c.accent.toUpperCase()}</span><span><Sparkles/></span></div>
   <div className="sd-card-body">
    <button className="sd-avatar-button" onClick={()=>onOpenProfile(c.userId)} aria-label={'View '+c.name+' profile'}>{c.hasAvatar?<Image src={'/api/social/creator/media/'+encodeURIComponent(c.userId)+'?kind=avatar'} alt={c.name+' creator avatar'} width={70} height={70} unoptimized/>:<span>{c.name.trim().slice(0,2).toUpperCase()}</span>}</button>
    <div className="sd-card-id"><button onClick={()=>onOpenProfile(c.userId)}>{c.name}</button><small>{c.handle?'@'+c.handle:'CREATOR · '+c.userId.slice(0,8)}</small></div>
    <p className="sd-card-headline">{c.headline||c.bio||'Exploring the MemeSpace universe.'}</p>
    {c.interests&&<p className="sd-card-interest"><Sparkles/> {c.interests}</p>}
    {c.location&&<small className="sd-card-location"><MapPin/> {c.location}</small>}
    <div className="sd-stats"><span><strong>{c.followers}</strong> followers</span><span><strong>{c.posts}</strong> public posts</span><span><strong>{c.mutuals}</strong> mutuals</span></div>
    <div className="sd-card-actions"><button onClick={()=>void follow(c)} disabled={busy!==null} className={c.following?'following':''}>{c.following?<Check/>:<Users/>}{c.following?'Following':signedIn?'Follow':'Sign in to follow'}</button><button onClick={()=>onOpenProfile(c.userId)}>View profile <ArrowRight/></button></div>
   </div>
  </article>)}</div>:<div className="sd-empty"><ImageIcon/><strong>No creators match these filters.</strong><p>Try a broader niche, a different handle, or show all members.</p><button onClick={()=>{setTyped('');setQuery('');setFilter('all');setTopic('all');setPage(0)}}>Reset filters</button></div>}
  <div className="sd-footer"><p>Community signals use public post counts, followers, and mutual follows—not private group activity.</p><div>{page>0&&<button onClick={()=>setPage(n=>Math.max(0,n-1))}><ArrowLeft/> Previous</button>}{hasMore&&<button onClick={()=>setPage(n=>n+1)}>More creators <ArrowRight/></button>}</div></div>
 </section>;
}
