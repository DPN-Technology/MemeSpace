'use client';

import {useEffect,useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {ArrowRight,Camera,CalendarDays,Check,ExternalLink,ImagePlus,MapPin,PenLine,ShieldCheck,Sparkles,UserRoundX,Volume2,VolumeX,Plus,X} from 'lucide-react';

type Profile={userId:string;name:string;bio:string;joinedAt:number;posts:number;followers:number;followingCount:number;following:boolean;blocked:boolean;muted:boolean;mine:boolean};
type Details={userId:string;name:string;bio:string;joinedAt:number;handle:string;headline:string;location:string;website:string;interests:string;accent:'mint'|'violet'|'coral'|'amber';hasAvatar:boolean;hasBanner:boolean;mine:boolean};
const tones=['mint','violet','coral','amber'] as const;
const accents:Record<string,string>={mint:'#a6ffcb',violet:'#cdb3ff',coral:'#ffc0ae',amber:'#ffe49d'};
async function api<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,{cache:'no-store',...options}),value=await response.json() as T&{error?:string};
 if(!response.ok)throw Error(value.error||'Profile request failed.');
 return value;
}
export function SocialCreatorProfile({profile,busy:onHold,onFollow,onMute,onBlock,onUpdated}:{profile:Profile;busy:boolean;onFollow:()=>void;onMute:()=>void;onBlock:()=>void;onUpdated:()=>void}){
 const [details,setDetails]=useState<Details|null>(null),[editor,setEditor]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[imageVersion,setImageVersion]=useState(0);
 const [name,setName]=useState(profile.name),[bio,setBio]=useState(profile.bio),[headline,setHeadline]=useState(''),[location,setLocation]=useState(''),[website,setWebsite]=useState(''),[interests,setInterests]=useState(''),[accent,setAccent]=useState<Details['accent']>('mint');
 useEffect(()=>{
  let canceled=false;
  api<{profile:Details}>('/api/social/creator?id='+encodeURIComponent(profile.userId)).then(({profile:p})=>{if(canceled)return;setDetails(p);setName(p.name);setBio(p.bio);setHeadline(p.headline);setLocation(p.location);setWebsite(p.website);setInterests(p.interests);setAccent(p.accent)})
   .catch(e=>{if(!canceled)setError(e instanceof Error?e.message:'Unable to load creator details.')});
  return()=>{canceled=true};
 },[profile.userId]);
 async function save(){
  setWorking(true);setError('');setNotice('');
  try{
   const {profile:p}=await api<{profile:Details}>('/api/social/creator',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,bio,headline,location,website,interests,accent})});
   setDetails(p);setEditor(false);setNotice('Your creator profile has been updated.');onUpdated();
  }catch(e){setError(e instanceof Error?e.message:'Could not save profile.')}
  finally{setWorking(false)}
 }
 async function imageChange(kind:'avatar'|'banner',file:File|null){
  if(!file)return;
  if(file.size>(kind==='avatar'?512*1024:2*1024*1024)){setError(kind==='avatar'?'Avatar limit is 512 KB.':'Banner limit is 2 MB.');return}
  setWorking(true);setError('');setNotice('');
  try{
   const form=new FormData();form.append('kind',kind);form.append('image',file);
   await api('/api/social/creator/media',{method:'POST',body:form});
   setDetails(d=>d?{...d,[kind==='avatar'?'hasAvatar':'hasBanner']:true}:d);
   setImageVersion(n=>n+1);setNotice('Your '+kind+' is now live.');onUpdated();
  }catch(e){setError(e instanceof Error?e.message:'Could not upload image.')}
  finally{setWorking(false)}
 }
 async function removeImage(kind:'avatar'|'banner'){
  setWorking(true);setError('');setNotice('');
  try{
   await api('/api/social/creator/media',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind})});
   setDetails(d=>d?{...d,[kind==='avatar'?'hasAvatar':'hasBanner']:false}:d);
   setImageVersion(n=>n+1);setNotice('Image removed.');onUpdated();
  }catch(e){setError(e instanceof Error?e.message:'Could not remove image.')}
  finally{setWorking(false)}
 }
 const src=(kind:'avatar'|'banner')=>'/api/social/creator/media/'+encodeURIComponent(profile.userId)+'?kind='+kind+'&v='+imageVersion;
 const style={['--creator-accent' as string]:accents[details?.accent||'mint']} as React.CSSProperties;
 const site=details?.website||'';
 return <section className="sp-creator" style={style} aria-label="Creator profile">
  <div className="sp-cover" data-accent={details?.accent||'mint'}>
   {details?.hasBanner&&<Image src={src('banner')} alt={profile.name+' profile banner'} width={1600} height={480} sizes="(max-width: 700px) 100vw, 750px" unoptimized/>}
   <span className="sp-cover-label"><Sparkles/> MEMESPACE // CREATOR IDENTITY</span>
   {profile.mine&&<div className="sp-image-actions"><label><ImagePlus/> Banner<input type="file" accept="image/png,image/jpeg,image/gif" aria-label="Change banner" disabled={working} onChange={e=>{void imageChange('banner',e.target.files?.[0]||null);e.target.value=''}}/></label>{details?.hasBanner&&<button disabled={working} onClick={()=>void removeImage('banner')} aria-label="Remove banner"><X/></button>}</div>}
  </div>
  <div className="sp-body">
   <div className="sp-avatar-wrap">
    <span className="sp-avatar">{details?.hasAvatar?<Image src={src('avatar')} alt={profile.name+' avatar'} width={140} height={140} unoptimized/>:profile.name.trim().slice(0,2).toUpperCase()}</span>
    {profile.mine&&<div className="sp-avatar-actions"><label title="Change avatar"><Camera/><input type="file" accept="image/png,image/jpeg,image/gif" aria-label="Change avatar" disabled={working} onChange={e=>{void imageChange('avatar',e.target.files?.[0]||null);e.target.value=''}}/></label>{details?.hasAvatar&&<button disabled={working} onClick={()=>void removeImage('avatar')} title="Remove avatar"><X/></button>}</div>}
   </div>
   <div className="sp-identity">
    <div className="sp-name-row"><div><h3>{details?.name||profile.name}</h3><small>@{details?.handle||profile.userId.slice(0,12)} {details?.handle&&<ShieldCheck/>}</small></div><span className="sp-joined"><CalendarDays/> Joined {new Date(profile.joinedAt).toLocaleDateString(undefined,{month:'short',year:'numeric'})}</span></div>
    {details?.headline&&<strong className="sp-headline">{details.headline}</strong>}
    <p>{details?.bio||profile.bio||'A creator carving out their own corner of the internet.'}</p>
    <div className="sp-meta">{details?.location&&<span><MapPin/> {details.location}</span>}{site&&<a href={site} target="_blank" rel="noopener noreferrer"><ExternalLink/> Website</a>}{details?.interests&&<span><Sparkles/> {details.interests}</span>}</div>
    <div className="social-profile-counts"><span><strong>{profile.posts}</strong> posts</span><span><strong>{profile.followers}</strong> followers</span><span><strong>{profile.followingCount}</strong> following</span></div>
    <div className="social-profile-controls">{profile.mine?<button className="sp-edit-btn" onClick={()=>setEditor(v=>!v)}><PenLine/> {editor?'Close editor':'Edit my profile'}</button>:<>
     <button className="social-follow" disabled={onHold||profile.blocked} onClick={onFollow}>{profile.following?<Check/>:<Plus/>}{profile.following?'Following':'Follow'}</button>
     <button className={profile.muted?'social-relationship selected':'social-relationship'} disabled={onHold} onClick={onMute}>{profile.muted?<Volume2/>:<VolumeX/>}{profile.muted?'Unmute':'Mute'}</button>
     <button className={profile.blocked?'social-relationship selected danger':'social-relationship danger'} disabled={onHold} onClick={onBlock}><UserRoundX/>{profile.blocked?'Unblock':'Block'}</button>
    </>}<Link className="social-profile-permalink" href={'/social?profile='+encodeURIComponent(profile.userId)}>Profile link <ArrowRight/></Link></div>
    {profile.blocked&&<p className="social-profile-private">You blocked this creator. Unblock to view their posts.</p>}
    {error&&<p className="sp-alert" role="alert">{error}</p>}{notice&&<p className="sp-good" role="status">{notice}</p>}
    {profile.mine&&editor&&<form className="sp-editor" onSubmit={e=>{e.preventDefault();void save()}}>
     <h4><PenLine/> Customize your creator identity</h4>
     <div className="sp-editor-grid"><label>Display name<input required minLength={2} maxLength={56} value={name} onChange={e=>setName(e.target.value)}/></label><label>Creator headline<input maxLength={90} value={headline} placeholder="Meme artist and storyteller" onChange={e=>setHeadline(e.target.value)}/></label></div>
     <label>About you<textarea maxLength={240} value={bio} onChange={e=>setBio(e.target.value)}/></label>
     <div className="sp-editor-grid"><label>Location (optional)<input maxLength={60} value={location} onChange={e=>setLocation(e.target.value)}/></label><label>Portfolio URL<input type="url" maxLength={180} placeholder="https://example.com" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
     <label>Creator interests<input maxLength={120} value={interests} placeholder="Memes, art, gaming…" onChange={e=>setInterests(e.target.value)}/></label>
     <fieldset><legend>Identity color</legend>{tones.map(t=><label key={t} className={accent===t?'sp-swatch selected':'sp-swatch'}><input type="radio" name="tone" value={t} checked={accent===t} onChange={()=>setAccent(t)}/><span style={{background:accents[t]}}/> {t}</label>)}</fieldset>
     <button className="sp-save" type="submit" disabled={working||name.trim().length<2}><Check/> Save creator profile</button>
    </form>}
   </div>
  </div>
 </section>;
}
