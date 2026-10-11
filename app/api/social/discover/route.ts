import {rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {failure} from '../../common';

export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
const topics=['all','general','memes','gaming','culture','web3'];
const sorts=['recommended','active','popular','new'];
const filters=['all','following','mutuals','avatars'];
export async function GET(request:Request){
 try{
  const q=new URL(request.url).searchParams;
  const search=(q.get('q')||'').trim().replace(/^@/,'');
  const topic=q.get('topic')||'all',sort=q.get('sort')||'recommended',filter=q.get('filter')||'all';
  const page=Number(q.get('page')||'0');
  if(search.length>80||!topics.includes(topic)||!sorts.includes(sort)||!filters.includes(filter)||
     !Number.isSafeInteger(page)||page<0||page>100)throw Error('INPUT');
  const uid=(await getChatGPTUser())?.userId||'';
  const db=rawDatabase();
  // Only publicly visible, top-level posts are used for discovery/rank/activity metrics.
  const publicPosts="SELECT p.user_id,p.topic,p.created_at FROM social_posts p WHERE p.hidden_at=0 AND p.reply_to IS NULL "+
   "AND NOT EXISTS(SELECT 1 FROM social_community_removed_posts rm WHERE rm.post_id=p.id) "+
   "AND (p.community_id IS NULL OR EXISTS(SELECT 1 FROM social_communities c WHERE c.id=p.community_id AND c.visibility='public'))";
  const prefix="WITH public_posts AS ("+publicPosts+"), stats AS ("+
   "SELECT user_id,COUNT(*) AS posts,MAX(created_at) AS last_posted_at FROM public_posts GROUP BY user_id), "+
   "creators AS (SELECT a.user_id AS userId,COALESCE(pr.name,a.display_name) AS name,COALESCE(pr.bio,'') AS bio,"+
   "COALESCE(h.handle,'') AS handle,COALESCE(cp.headline,'') AS headline,COALESCE(cp.interests,'') AS interests,"+
   "COALESCE(cp.location,'') AS location,COALESCE(cp.accent,'mint') AS accent,"+
   "CASE WHEN cp.avatar_mime IS NULL THEN 0 ELSE 1 END AS hasAvatar,"+
   "COALESCE(stats.posts,0) AS posts,COALESCE(stats.last_posted_at,0) AS lastPostedAt,"+
   "a.created_at AS joinedAt,"+
   "(SELECT COUNT(*) FROM social_follows f WHERE f.following_id=a.user_id) AS followers,"+
   "EXISTS(SELECT 1 FROM social_follows f WHERE f.following_id=a.user_id AND f.follower_id=?) AS following,"+
   "(SELECT COUNT(*) FROM social_follows f JOIN social_follows mine ON mine.following_id=f.follower_id AND mine.follower_id=? WHERE f.following_id=a.user_id) AS mutuals,"+
   "EXISTS(SELECT 1 FROM public_posts pp WHERE pp.user_id=a.user_id AND pp.topic=?) AS topicMatch "+
   "FROM accounts a LEFT JOIN profiles pr ON pr.user_id=a.user_id "+
   "LEFT JOIN social_handles h ON h.user_id=a.user_id "+
   "LEFT JOIN social_creator_profiles cp ON cp.user_id=a.user_id "+
   "LEFT JOIN stats ON stats.user_id=a.user_id "+
   "WHERE a.deleted_at=0 AND a.suspended_at=0 AND a.user_id<>'local_seedy' AND a.user_id<>? "+
   "AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE "+
   "(sr.actor_id=? AND sr.target_id=a.user_id AND sr.kind IN ('block','mute')) OR "+
   "(sr.actor_id=a.user_id AND sr.target_id=? AND sr.kind='block'))) "+
   "SELECT userId,name,bio,handle,headline,interests,location,accent,hasAvatar,posts,lastPostedAt,joinedAt,followers,following,mutuals FROM creators WHERE 1=1";
  const args:(string|number)[]=[uid,uid,topic==='all'?'__all__':topic,uid||'__guest__',uid,uid];
  let sql=prefix;
  if(search){sql+=" AND (instr(lower(name),lower(?))>0 OR instr(lower(handle),lower(?))>0 OR instr(lower(headline),lower(?))>0 OR instr(lower(interests),lower(?))>0 OR instr(lower(bio),lower(?))>0)";args.push(search,search,search,search,search);}
  if(topic!=='all')sql+=" AND topicMatch=1";
  if(filter==='following')sql+=" AND following=1";
  if(filter==='mutuals')sql+=" AND mutuals>0";
  if(filter==='avatars')sql+=" AND hasAvatar=1";
  if(sort==='active')sql+=" ORDER BY lastPostedAt DESC,posts DESC,userId ASC";
  else if(sort==='popular')sql+=" ORDER BY followers DESC,posts DESC,userId ASC";
  else if(sort==='new')sql+=" ORDER BY joinedAt DESC,userId ASC";
  else sql+=" ORDER BY (mutuals*8+followers*3+MIN(posts,20)*2+hasAvatar*2) DESC,lastPostedAt DESC,userId ASC";
  // Fetch one additional row for reliable pagination without leaking private content.
  const rows=db.prepare(sql+" LIMIT 13 OFFSET ?").all(...args,page*12) as {hasAvatar:number;following:number;[key:string]:unknown}[];
  const creators=rows.slice(0,12).map(row=>({...row,hasAvatar:!!row.hasAvatar,following:!!row.following}));
  return Response.json({creators,hasMore:rows.length>12,page,sort,filter,topic},{headers:noStore});
 }catch(e){return failure(e);}
}
