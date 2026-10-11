import {rawDatabase} from '@/db/raw';
import {identity,failure} from '../../../common';
import {verifySocialImage,MAX_FORM_BYTES} from '@/lib/social-media.mjs';

export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 try{
  const uid=await identity(request),length=Number(request.headers.get('content-length'));
  if(!Number.isSafeInteger(length)||length<=0)return Response.json({error:'Upload length required.'},{status:411,headers});
  if(length>MAX_FORM_BYTES)return Response.json({error:'Image upload exceeds 2 MB.'},{status:413,headers});
  const form=await request.formData(),kind=form.get('kind'),photo=form.get('image');
  if(!['avatar','banner'].includes(String(kind))||!(photo instanceof File))throw Error('INPUT');
  const limit=kind==='avatar'?512*1024:2*1024*1024;
  if(photo.size>limit||photo.size<20)return Response.json({error:'Avatar limit 512 KB; banner limit 2 MB.'},{status:413,headers});
  const bytes=Buffer.from(await photo.arrayBuffer()),verified=verifySocialImage(bytes,photo.type);
  if(!verified)return Response.json({error:'Use a valid PNG, JPEG or GIF image, 1–4096 pixels per side.'},{status:400,headers});
  const db=rawDatabase(),col=kind==='avatar'?'avatar':'banner';
  db.prepare('INSERT OR IGNORE INTO social_creator_profiles(user_id,updated_at) VALUES(?,?)').run(uid,Date.now());
  db.prepare('UPDATE social_creator_profiles SET '+col+'_mime=?,'+col+'_content=?,updated_at=? WHERE user_id=?')
   .run(verified.mime,bytes,Date.now(),uid);
  return Response.json({ok:true,kind},{status:201,headers});
 }catch(e){return failure(e);}
}
export async function DELETE(request:Request){
 try{
  const uid=await identity(request),d=await request.json();
  if(!d||!['avatar','banner'].includes(d.kind))throw Error('INPUT');
  const kind=d.kind==='avatar'?'avatar':'banner',db=rawDatabase();
  db.prepare('UPDATE social_creator_profiles SET '+kind+'_mime=NULL,'+kind+'_content=NULL,updated_at=? WHERE user_id=?').run(Date.now(),uid);
  return Response.json({ok:true},{headers});
 }catch(e){return failure(e);}
}
