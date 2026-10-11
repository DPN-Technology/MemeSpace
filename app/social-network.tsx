'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {Activity,ArrowLeft,ArrowRight,Bell,Bookmark,Check,Compass,Flame,Heart,Hash,MessageCircle,Plus,RefreshCw,Search,Send,ShieldAlert,Sparkles,Users,UserRound,PenLine,Trash2,X} from 'lucide-react';
import './social-network.css';

type Topic='general'|'memes'|'gaming'|'culture'|'web3';
type FeedView='all'|'following'|'mine'|'saved'|'profile';
type Section='feed'|'people'|'activity';
type Post={id:string;userId:string;body:string;topic:Topic;replyTo:string|null;createdAt:number;editedAt:number;author:string;bio:string;reactions:number;replies:number;reacted:boolean;saved:boolean;following:boolean;followers:number;mine:boolean};
type Member={userId:string;name:string;bio:string;posts:number;followers:number;following:number};
type Notice={kind:'reaction'|'reply'|'follow';userId:string;author:string;postId:string|null;createdAt:number};
type FeedResult={posts:Post[];hasMore:boolean;stats:{posts:number;members:number;following:number};signedIn:boolean;readOnly:boolean};
const topicLabels:Record<Topic,string>={general:'The Commons',memes:'Meme Culture',gaming:'Gaming',culture:'Internet Culture',web3:'Web3'};
const topicList=Object.keys(topicLabels) as Topic[];
const initialStats={posts:0,members:0,following:0};

async function social<T>(params:Record<string,string>={},payload?:unknown,method='POST'):Promise<T>{
 const query=new URLSearchParams(params);
 const url='/api/social'+(query.size?'?'+query.toString():'');
 const response=await fetch(url,payload===undefined?{cache:'no-store'}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
 const data=await response.json() as T & {error?:string};
 if(!response.ok)throw Error(data.error||'The community could not complete this request.');
 return data as T;
}
function timeSince(timestamp:number){
 const delta=Math.max(0,Date.now()-timestamp);
 if(delta<60_000)return 'just now';
 if(delta<3_600_000)return Math.floor(delta/60_000)+'m';
 if(delta<86_400_000)return Math.floor(delta/3_600_000)+'h';
 return new Date(timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function Avatar({name,size='normal'}:{name:string;size?:'normal'|'large'}){
 return <span className={'social-avatar '+(size==='large'?'social-avatar-large':'')} aria-hidden="true">{name.trim().slice(0,2).toUpperCase()||'MS'}</span>;
}
function PostCard({post,onAction,onThread,onProfile,onEdit,onDelete,onReport,editing,editValue,setEditValue,saveEdit,cancelEdit,busy}:{
 post:Post;onAction:(action:'react'|'bookmark',post:Post)=>void;onThread:(id:string)=>void;onProfile:(id:string)=>void;
 onEdit:(post:Post)=>void;onDelete:(post:Post)=>void;onReport:(post:Post)=>void;editing:boolean;editValue:string;setEditValue:(v:string)=>void;
 saveEdit:()=>void;cancelEdit:()=>void;busy:boolean;
}){
 return <article className="social-post" data-social-post-id={post.id}>
  <div className="social-post-head">
   <button className="social-author" onClick={()=>onProfile(post.userId)} aria-label={'View '+post.author+' profile'}><Avatar name={post.author}/><span><strong>{post.author}</strong><small>@{post.userId.slice(0,8)} · {timeSince(post.createdAt)}{post.editedAt?' · edited':''}</small></span></button>
   <div className="social-head-side"><span className="social-topic-pill">#{post.topic}</span>
    {post.mine?<div className="social-post-menu"><button aria-label="Edit post" onClick={()=>onEdit(post)}><PenLine/></button><button aria-label="Delete post" onClick={()=>onDelete(post)}><Trash2/></button></div>:<button className="social-icon-action" title="Report post" aria-label="Report post" onClick={()=>onReport(post)}><ShieldAlert/></button>}
   </div>
  </div>
  {editing?<div className="social-edit"><textarea aria-label="Edit post text" maxLength={1200} rows={4} value={editValue} onChange={e=>setEditValue(e.target.value)}/><div><button disabled={busy||editValue.trim().length<2} className="social-primary" onClick={saveEdit}><Check/> Save changes</button><button className="social-muted-btn" onClick={cancelEdit}>Cancel</button></div></div>:<p className="social-post-copy">{post.body}</p>}
  <div className="social-post-actions">
   <button aria-label={post.reacted?'Unlike post':'Like post'} aria-pressed={post.reacted} className={post.reacted?'selected':''} disabled={busy} onClick={()=>onAction('react',post)}><Heart fill={post.reacted?'currentColor':'none'}/><span>{post.reactions}</span></button>
   <button aria-label="View replies" onClick={()=>onThread(post.replyTo||post.id)}><MessageCircle/><span>{post.replies}</span></button>
   <button aria-label={post.saved?'Unsave post':'Save post'} aria-pressed={post.saved} className={post.saved?'selected':''} disabled={busy} onClick={()=>onAction('bookmark',post)}><Bookmark fill={post.saved?'currentColor':'none'}/><span>{post.saved?'Saved':'Save'}</span></button>
   <button className="social-last-action" onClick={()=>onThread(post.replyTo||post.id)}>Join discussion <ArrowRight/></button>
  </div>
 </article>;
}

export function SocialNetwork({openIdentity}:{openIdentity:()=>void}){
 const [section,setSection]=useState<Section>('feed');
 const [view,setView]=useState<FeedView>('all');
 const [profileId,setProfileId]=useState('');
 const [topic,setTopic]=useState<Topic|'all'>('all');
 const [composeTopic,setComposeTopic]=useState<Topic>('general');
 const [sort,setSort]=useState<'latest'|'popular'>('latest');
 const [searchInput,setSearchInput]=useState('');
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(0);
 const [posts,setPosts]=useState<Post[]>([]);
 const [stats,setStats]=useState(initialStats);
 const [hasMore,setHasMore]=useState(false);
 const [people,setPeople]=useState<Member[]>([]);
 const [activity,setActivity]=useState<Notice[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [thread,setThread]=useState<{root:Post;replies:Post[]}|null>(null);
 const [draft,setDraft]=useState('');
 const [reply,setReply]=useState('');
 const [signedIn,setSignedIn]=useState(false);
 const [readOnly,setReadOnly]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [editId,setEditId]=useState<string|null>(null);
 const [editValue,setEditValue]=useState('');
 const [refreshId,setRefreshId]=useState(0);
 const refresh=useCallback(()=>setRefreshId(x=>x+1),[]);
 const changeView=(next:FeedView,id='')=>{setSection('feed');setSelectedId(null);setView(next);setProfileId(id);setPage(0);};
 const chooseTopic=(next:Topic|'all')=>{setTopic(next);setPage(0);setSelectedId(null);setSection('feed');};
 useEffect(()=>{
  let cancelled=false;
  setLoading(true);setError('');
  const params={mode:'feed',view,topic,sort,q:query,page:String(page),...(view==='profile'?{user:profileId}:{})};
  social<FeedResult>(params).then(data=>{if(cancelled)return;setPosts(data.posts);setHasMore(data.hasMore);setStats(data.stats);setSignedIn(data.signedIn);setReadOnly(data.readOnly)})
   .catch((e:Error)=>{if(!cancelled)setError(e.message)}).finally(()=>{if(!cancelled)setLoading(false)});
  return()=>{cancelled=true};
 },[view,topic,sort,page,query,profileId,refreshId]);
 useEffect(()=>{
  if(section!=='people')return;let cancelled=false;
  social<{people:Member[]}>({mode:'people',q:query}).then(data=>{if(!cancelled)setPeople(data.people)}).catch((e:Error)=>{if(!cancelled)setError(e.message)});
  return()=>{cancelled=true};
 },[section,query,refreshId]);
 useEffect(()=>{
  if(section!=='activity')return;let cancelled=false;
  social<{activity:Notice[]}>({mode:'activity'}).then(data=>{if(!cancelled)setActivity(data.activity)}).catch((e:Error)=>{if(!cancelled)setError(e.message)});
  return()=>{cancelled=true};
 },[section,refreshId]);
 useEffect(()=>{
  if(!selectedId)return;let cancelled=false;
  social<{root:Post;replies:Post[]}>({mode:'thread',id:selectedId}).then(data=>{if(!cancelled)setThread(data)})
   .catch((e:Error)=>{if(!cancelled){setError(e.message);setSelectedId(null)}});
  return()=>{cancelled=true};
 },[selectedId,refreshId]);
 useEffect(()=>{
  const params=new URLSearchParams(location.search);
  const id=params.get('post');
  if(id&&/^[a-zA-Z0-9_-]{1,100}$/.test(id))setSelectedId(id);
 },[]);
 function join(){if(!signedIn){openIdentity();return false;}return true;}
 async function action(payload:unknown,method='POST',closeThread=false){
  if(!join())return;
  setBusy(true);setError('');setSuccess('');
  try{await social({},payload,method);if(closeThread){setSelectedId(null);setThread(null);}refresh();return true}
  catch(e){setError(e instanceof Error?e.message:'Action failed.');return false}
  finally{setBusy(false)}
 }
 async function publish(replyTo?:string){
  if(!join())return;
  const text=replyTo?reply:draft;
  if(text.trim().length<2)return;
  const ok=await action({action:'create',text,topic:composeTopic,...(replyTo?{replyTo}:{})});
  if(ok){if(replyTo)setReply('');else{setDraft('');changeView('all');}setSuccess('Published to MemeSpace.');}
 }
 async function toggle(actionName:'react'|'bookmark',post:Post){await action({action:actionName,postId:post.id,enabled:actionName==='react'?!post.reacted:!post.saved})}
 async function toggleFollow(member:{userId:string;following:number|boolean}){await action({action:'follow',userId:member.userId,enabled:!member.following})}
 function startEdit(post:Post){setEditId(post.id);setEditValue(post.body)}
 async function saveEdit(){if(!editId)return;const ok=await action({id:editId,text:editValue},'PATCH');if(ok){setEditId(null);setEditValue('');setSuccess('Your post was updated.')}}
 async function removePost(post:Post){if(!window.confirm('Remove this post and its replies?'))return;const ok=await action({id:post.id},'DELETE',!!selectedId&&(post.id===selectedId||post.replyTo===null));if(ok)setSuccess('Your post was removed.')}
 async function reportPost(post:Post){if(!join())return;if(!window.confirm('Report this post for moderator review?'))return;const ok=await action({action:'report',postId:post.id,reason:'other'});if(ok)setSuccess('Report sent to the moderation queue.')}
 const postHandlers={onAction:toggle,onThread:(id:string)=>{setSelectedId(id);setThread(null);},onProfile:(id:string)=>changeView('profile',id),onEdit:startEdit,onDelete:removePost,onReport:reportPost,editValue,setEditValue,saveEdit,cancelEdit:()=>setEditId(null),busy};
 const postCard=(post:Post)=><PostCard key={post.id} post={post} {...postHandlers} editing={editId===post.id}/>;
 const navigation:[FeedView,string,typeof Compass][]=[
  ['all','For everyone',Compass],['following','Following',Users],['mine','Your posts',UserRound],['saved','Saved posts',Bookmark]
 ];
 const changeSection=(next:Section)=>{setSection(next);setSelectedId(null);setError('');};
 return <div className="social-network">
  <div className="social-ambient" aria-hidden="true"/>
  <header className="social-masthead">
   <div className="social-logo"><span className="social-logo-mark">M<span>✦</span></span><div><small>MEMESPACE / CONNECT</small><strong>The Social Universe<span>.</span></strong><p>Find your people. Build the culture.</p></div></div>
   <div className="social-masthead-cta"><span><span className="social-live-dot"/> COMMUNITY NETWORK</span><button aria-label="Refresh community" onClick={refresh}><RefreshCw/> Refresh</button></div>
  </header>
  <div className="social-shell">
   <aside className="social-sidebar" aria-label="Social navigation">
    <div className="social-sidebar-heading">YOUR NETWORK</div>
    {navigation.map(([key,title,Icon])=><button key={key} className={section==='feed'&&view===key?'active':''} onClick={()=>changeView(key)}><Icon/>{title}{key==='following'&&stats.following>0&&<em>{stats.following}</em>}</button>)}
    <div className="social-sidebar-heading social-nav-separator">DISCOVERY</div>
    <button className={section==='people'?'active':''} onClick={()=>changeSection('people')}><Users/> Discover people</button>
    <button className={section==='activity'?'active':''} onClick={()=>changeSection('activity')}><Bell/> Your activity</button>
    <div className="social-sidebar-heading social-nav-separator">TOPIC CHANNELS</div>
    <button className={section==='feed'&&topic==='all'?'active-soft':''} onClick={()=>chooseTopic('all')}><Hash/> All topics</button>
    {topicList.map(t=><button key={t} className={section==='feed'&&topic===t?'active-soft':''} onClick={()=>chooseTopic(t)}><Hash/> {topicLabels[t]}</button>)}
    <div className="social-sidebar-footer"><Sparkles/><strong>Your corner of the internet.</strong><p>Stay curious. Keep it human. Create something worth sharing.</p></div>
   </aside>
   <main className="social-main">
    <div className="social-feed-header">
     <div><p className="social-kicker">{section==='feed'?'THE COMMUNITY STREAM':section==='people'?'CONNECTION DIRECTORY':'YOUR COMMUNITY SIGNALS'}</p><h2>{section==='people'?'Discover creators':section==='activity'?'Your activity':view==='following'?'People you follow':view==='mine'?'Your posts':view==='saved'?'Saved for later':view==='profile'?'Member timeline':'The Feed'}</h2></div>
     <button className="social-new-btn" onClick={()=>{setSection('feed');changeView('all');document.querySelector<HTMLTextAreaElement>('.social-composer textarea')?.focus()}}><Plus/> New post</button>
    </div>
    <form className="social-search" onSubmit={e=>{e.preventDefault();setQuery(searchInput.trim());setPage(0)}}><Search/><input aria-label="Search the social network" placeholder="Search posts, topics and people…" value={searchInput} onChange={e=>setSearchInput(e.target.value)}/><button type="submit">Search <ArrowRight/></button>{query&&<button type="button" aria-label="Clear search" className="social-search-clear" onClick={()=>{setSearchInput('');setQuery('');setPage(0)}}><X/></button>}</form>
    {error&&<div role="alert" className="social-alert social-error">{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X/></button></div>}
    {success&&<div role="status" className="social-alert social-success">{success}<button onClick={()=>setSuccess('')} aria-label="Dismiss message"><X/></button></div>}
    {selectedId?<section className="social-thread" aria-label="Post discussion">
     <button className="social-return" onClick={()=>{setSelectedId(null);setThread(null)}}><ArrowLeft/> Back to feed</button>
     <h3>Conversation thread</h3>
     {thread?<>{postCard(thread.root)}<div className="social-thread-divider"><MessageCircle/> {thread.replies.length} replies</div>{thread.replies.map(postCard)}
      <div className="social-reply-compose"><strong>Join the discussion</strong><textarea aria-label="Write a reply" value={reply} maxLength={1200} onChange={e=>setReply(e.target.value)} placeholder="Add your perspective…"/><button className="social-primary" disabled={busy||readOnly||reply.trim().length<2} onClick={()=>publish(selectedId)}><Send/> Post reply</button>{!signedIn&&<button className="social-signin" onClick={openIdentity}>Sign in to reply</button>}</div>
     </>:<p className="social-empty">Opening conversation…</p>}</section>:
    section==='feed'?<>
     {view==='all'&&page===0&&!query&&<section className="social-composer" aria-label="Create a social post"><div className="social-composer-top"><Avatar name="YOU"/><div><strong>What&apos;s happening in your universe?</strong><p>Memes, gaming, internet culture — share your perspective.</p></div></div><textarea aria-label="Write a post" value={draft} onChange={e=>setDraft(e.target.value)} placeholder={signedIn?'Start a conversation…':'Sign in to publish your first post…'} maxLength={1200} rows={3} disabled={readOnly}/><div className="social-composer-actions"><label>Post to <select aria-label="Post topic" value={composeTopic} onChange={e=>setComposeTopic(e.target.value as Topic)}>{topicList.map(t=><option key={t} value={t}>{topicLabels[t]}</option>)}</select></label><span>{draft.length}/1200</span>{signedIn?<button className="social-primary" disabled={busy||readOnly||draft.trim().length<2} onClick={()=>publish()}><Send/> Publish post</button>:<button className="social-primary" onClick={openIdentity}><UserRound/> Sign in to post</button>}</div>{readOnly&&<p className="social-readonly">Community posts are temporarily read-only.</p>}</section>}
     <div className="social-timeline-bar"><div><Activity/> {view==='profile'?'MEMBER TIMELINE':topic==='all'?'ALL CONVERSATIONS':topicLabels[topic].toUpperCase()}</div><div><button className={sort==='latest'?'active':''} onClick={()=>{setSort('latest');setPage(0)}}>Latest</button><button className={sort==='popular'?'active':''} onClick={()=>{setSort('popular');setPage(0)}}><Flame/> Popular</button></div></div>
     {loading?<p className="social-empty">Loading the community stream…</p>:posts.length?posts.map(postCard):<div className="social-empty"><Sparkles/><h3>Make the first connection.</h3><p>No posts match this view yet. Try another topic or publish something new.</p></div>}
     <div className="social-pagination">{page>0&&<button onClick={()=>setPage(p=>Math.max(0,p-1))}><ArrowLeft/> Newer posts</button>}{hasMore&&<button onClick={()=>setPage(p=>p+1)}>Older posts <ArrowRight/></button>}</div>
    </>:section==='people'?<section className="social-directory">{people.length?people.map(person=><article key={person.userId} className="social-person"><Avatar name={person.name} size="large"/><div><button className="social-person-name" onClick={()=>changeView('profile',person.userId)}>{person.name}</button><p>{person.bio||'Part of the MemeSpace community.'}</p><small>{person.posts} posts · {person.followers} followers</small></div><button className={person.following?'social-follow following':'social-follow'} disabled={busy} onClick={()=>toggleFollow(person)}>{person.following?<Check/>:<Plus/>}{person.following?'Following':'Follow'}</button></article>):<div className="social-empty"><Users/><h3>No members found.</h3><p>Search a different name or check back as the community grows.</p></div>}</section>:
    <section className="social-notifications">{!signedIn?<div className="social-empty"><Bell/><h3>Your community, your signal.</h3><p>Sign in to see replies, follows and reactions.</p><button onClick={openIdentity} className="social-primary">Sign in</button></div>:activity.length?activity.map((item,i)=><button className="social-activity" key={item.kind+item.userId+item.createdAt+i} onClick={()=>item.postId?(setSelectedId(item.postId),setSection('feed')):changeView('profile',item.userId)}><Avatar name={item.author}/><span><strong>{item.author}</strong> {item.kind==='follow'?'followed you':item.kind==='reaction'?'liked your post':'replied to your post'}<small>{timeSince(item.createdAt)}</small></span><ArrowRight/></button>):<div className="social-empty"><Bell/><h3>All caught up.</h3><p>Your community activity will appear here.</p></div>}</section>}
   </main>
   <aside className="social-right" aria-label="Community overview">
    <section className="social-insights"><small>LIVE COMMUNITY SNAPSHOT</small><h3>Space is better <em>together.</em></h3><div className="social-number-row"><span><strong>{stats.posts}</strong>Posts</span><span><strong>{stats.members}</strong>Members</span><span><strong>{stats.following}</strong>Following</span></div><div className="social-progress"><span/></div><p>Community activity is based on stored posts, not an online-user counter.</p></section>
    <section className="social-trending"><div><Flame/><strong>Explore the signal</strong></div>{topicList.map((t,i)=><button key={t} onClick={()=>chooseTopic(t)}><span><small>0{i+1} / CHANNEL</small><strong>#{t}</strong></span><ArrowRight/></button>)}</section>
    <section className="social-guidelines"><ShieldAlert/><div><strong>Keep the signal clean.</strong><p>Respect creators. No spam, scams, harassment or private keys. Report harmful posts for review.</p></div></section>
    <Link className="social-back-link" href="/">Return to the Meme Mind <ArrowRight/></Link>
   </aside>
  </div>
 </div>;
}
