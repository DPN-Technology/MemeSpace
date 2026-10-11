import {rawDatabase} from '@/db/raw';
import {identity,failure} from '../../common';
import {MAX_FORM_BYTES,verifySocialImage} from '@/lib/social-media.mjs';
import {communityWritable,communityVisiblePostFilter} from '@/lib/social-community.mjs';

export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
const validId=(s:string)=>/^[a-zA-Z0-9_-]{1,100}$/.test(s);
const topics=['general','memes','gaming','culture','web3'];

export async function POST(request:Request){
 try{
  const uid=await identity(request);
  const length=Number(request.headers.get('content-length'));
  if(!Number.isSafeInteger(length)||length<=0)return Response.json({error:'Upload length is required.'},{status:411,headers:noStore});
  if(length>MAX_FORM_BYTES)return Response.json({error:'Images must be 2 MB or smaller.'},{status:413,headers:noStore});
  const db=rawDatabase();
  if(db.prepare("SELECT value FROM platform_settings WHERE key='chat_readonly'").get()?.value==='true')
   return Response.json({error:'Community posting is temporarily paused.'},{status:403,headers:noStore});
  const data=await request.formData();
  const image=data.get('image'),text=data.get('text'),topic=data.get('topic'),reply=data.get('replyTo'),quote=data.get('quotePostId'),communityId=data.get('communityId');
  if(!(image instanceof File)||typeof text!=='string'||typeof topic!=='string'||!topics.includes(topic)||text.length>1200||(text.trim().length===1)||typeof reply==='object'&&reply!==null||typeof quote==='object'&&quote!==null)throw Error('INPUT');
  if(communityId!==null&&(typeof communityId!=='string'||!validId(communityId)))throw Error('INPUT');
  if(reply!==null&&(typeof reply!=='string'||!validId(reply)))throw Error('INPUT');
  if(quote!==null&&(typeof quote!=='string'||!validId(quote)||reply!==null))throw Error('INPUT');
  if(image.size<20||image.size>MAX_FORM_BYTES)throw Error('INPUT');
  const bytes=Buffer.from(await image.arrayBuffer()),verified=verifySocialImage(bytes,image.type);
  if(!verified)return Response.json({error:'Use a valid PNG, JPEG or GIF up to 2 MB and 4096 pixels per side.'},{status:400,headers:noStore});
  function canSee(id:string){
   return db.prepare("SELECT p.id,p.reply_to,p.topic,p.community_id FROM social_posts p JOIN accounts a ON a.user_id=p.user_id "+
    "WHERE p.id=? AND p.hidden_at=0 AND a.deleted_at=0 AND a.suspended_at=0 AND "+communityVisiblePostFilter('p')+" "+
    "AND NOT EXISTS(SELECT 1 FROM social_relationships r WHERE r.actor_id=? AND r.target_id=p.user_id AND r.kind IN ('block','mute')) "+
    "AND NOT EXISTS(SELECT 1 FROM social_relationships r WHERE r.actor_id=p.user_id AND r.target_id=? AND r.kind='block')").get(id,uid,uid) as {id:string;reply_to:string|null;topic:string;community_id:string|null}|undefined;
  }
  const parent=reply?canSee(reply):null;
  if(reply&&!parent)return Response.json({error:'Conversation unavailable.'},{status:404,headers:noStore});
  if(quote&&!canSee(quote))return Response.json({error:'Quoted post unavailable.'},{status:404,headers:noStore});
  const replyTo=parent?(parent.reply_to||parent.id):null;
  if(parent&&communityId!==null&&communityId!==parent.community_id)throw Error('INPUT');
  const resolvedCommunity=parent?parent.community_id:(communityId||null);
  if(resolvedCommunity&&!communityWritable(db,resolvedCommunity,uid))
   return Response.json({error:'Join this community before posting.'},{status:403,headers:noStore});
  const postId=crypto.randomUUID(),now=Date.now(),caption=text.trim();
  db.exec('BEGIN IMMEDIATE');
  try{
   const quota=db.prepare('SELECT COUNT(*) AS n FROM social_media WHERE user_id=?').get(uid) as {n:number};
   if(quota.n>=100){db.exec('ROLLBACK');return Response.json({error:'You have reached the 100-image local account limit.'},{status:429,headers:noStore});}
   const result=db.prepare("INSERT INTO social_posts(id,user_id,body,topic,reply_to,quote_post_id,community_id,created_at) "+
    "SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM social_posts WHERE user_id=? AND created_at>?)<5")
    .run(postId,uid,caption,parent?parent.topic:topic,replyTo,quote||null,resolvedCommunity,now,uid,now-60000);
   if(!result.changes){db.exec('ROLLBACK');return Response.json({error:'You can publish up to five posts per minute.'},{status:429,headers:noStore});}
   db.prepare('INSERT INTO social_media(post_id,user_id,mime,content,byte_size,width,height,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(postId,uid,verified.mime,bytes,verified.byteSize,verified.width,verified.height,now);
   const tags=[...new Set([...caption.matchAll(/(?:^|[^a-zA-Z0-9_])#([a-zA-Z][a-zA-Z0-9_]{0,29})(?![a-zA-Z0-9_])/g)].map(m=>m[1].toLowerCase()))].slice(0,10);
   for(const tag of tags)db.prepare('INSERT OR IGNORE INTO social_hashtags(post_id,tag) VALUES(?,?)').run(postId,tag);
   db.exec('COMMIT');
   return Response.json({ok:true,id:postId},{status:201,headers:noStore});
  }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
 }catch(e){return failure(e);}
}
