import {rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {identity,body,failure} from '../../common';

export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
const idValid=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const accents=['mint','violet','coral','amber'] as const;
const blank={headline:'',location:'',website:'',interests:'',accent:'mint',hasAvatar:false,hasBanner:false};
function record(db:ReturnType<typeof rawDatabase>,id:string,viewer:string){
 const row=db.prepare("SELECT a.user_id AS userId,COALESCE(pr.name,a.display_name) AS name,COALESCE(pr.bio,'') AS bio,a.created_at AS joinedAt, "+
  "COALESCE(h.handle,'') AS handle,COALESCE(cp.headline,'') AS headline,COALESCE(cp.location,'') AS location,COALESCE(cp.website,'') AS website, "+
  "COALESCE(cp.interests,'') AS interests,COALESCE(cp.accent,'mint') AS accent,cp.avatar_mime IS NOT NULL AS hasAvatar,cp.banner_mime IS NOT NULL AS hasBanner "+
  "FROM accounts a LEFT JOIN profiles pr ON pr.user_id=a.user_id LEFT JOIN social_handles h ON h.user_id=a.user_id LEFT JOIN social_creator_profiles cp ON cp.user_id=a.user_id "+
  "WHERE a.user_id=? AND a.deleted_at=0 AND a.suspended_at=0 AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=a.user_id AND sr.target_id=? AND sr.kind='block')").get(id,viewer);
 return row?{...row,hasAvatar:!!(row as {hasAvatar:number}).hasAvatar,hasBanner:!!(row as {hasBanner:number}).hasBanner}:null;
}
export async function GET(request:Request){
 try{
  const q=new URL(request.url).searchParams,uid=(await getChatGPTUser())?.userId||'',id=q.get('id')||uid;
  if(!idValid(id))throw Error('INPUT');
  const profile=record(rawDatabase(),id,uid);
  return profile?Response.json({profile:{...blank,...profile,mine:id===uid}},{headers}):Response.json({error:'Creator profile unavailable.'},{status:404,headers});
 }catch(e){return failure(e);}
}
export async function PATCH(request:Request){
 try{
  const uid=await identity(request),d=await body(request),db=rawDatabase(),now=Date.now();
  if(typeof d.name!=='string'||d.name.trim().length<2||d.name.trim().length>56||
     typeof d.bio!=='string'||d.bio.length>240||
     typeof d.headline!=='string'||d.headline.length>90||
     typeof d.location!=='string'||d.location.length>60||
     typeof d.website!=='string'||d.website.length>180||
     typeof d.interests!=='string'||d.interests.length>120||
     !accents.includes(d.accent as typeof accents[number]))throw Error('INPUT');
  if(d.website){
   try{
    const url=new URL(d.website);
    if(!['https:','http:'].includes(url.protocol)||!url.hostname.includes('.')||url.username||url.password)throw Error('INPUT');
   }catch{return Response.json({error:'Enter a valid http(s) website.'},{status:400,headers})}
  }
  db.exec('BEGIN IMMEDIATE');
  try{
   db.prepare('INSERT INTO profiles(user_id,name,bio,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,bio=excluded.bio,updated_at=excluded.updated_at').run(uid,d.name.trim(),d.bio.trim(),now);
   db.prepare('INSERT INTO social_creator_profiles(user_id,headline,location,website,interests,accent,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET headline=excluded.headline,location=excluded.location,website=excluded.website,interests=excluded.interests,accent=excluded.accent,updated_at=excluded.updated_at')
    .run(uid,d.headline.trim(),d.location.trim(),d.website.trim(),d.interests.trim(),d.accent,now);
   db.exec('COMMIT');
  }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
  return Response.json({ok:true,profile:record(db,uid,uid)},{headers});
 }catch(e){return failure(e);}
}
