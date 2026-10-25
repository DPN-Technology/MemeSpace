import {getChatGPTUser} from '../chatgpt-auth';
import {sameOrigin} from '@/lib/local-session.mjs';
export async function identity(request:Request){if(!sameOrigin(request))throw new Error('ORIGIN');const user=await getChatGPTUser();if(!user)throw new Error('AUTH');return user.userId;}
export async function body(request:Request){
  const contentType=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(contentType!=='application/json')throw new Error('INPUT');
  const declared=request.headers.get('content-length');
  if(declared&&/^\d+$/.test(declared)&&Number(declared)>4096)throw new Error('BODY_TOO_LARGE');
  if(!request.body)throw new Error('INPUT');
  const reader=request.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let bytes=0,raw='';
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>4096)throw new Error('BODY_TOO_LARGE');
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
  }catch(error){
    void reader.cancel().catch(()=>{});
    if(error instanceof Error&&error.message==='BODY_TOO_LARGE')throw error;
    throw new Error('INPUT');
  }finally{reader.releaseLock()}
  try{const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('INPUT');return parsed}catch{throw new Error('INPUT')}
}
export function failure(e:unknown){const m=e instanceof Error?e.message:'';if(m==='AUTH')return Response.json({error:'Please sign in to use this feature.'},{status:401});if(m==='ORIGIN')return Response.json({error:'This request is not allowed.'},{status:403});if(m==='BODY_TOO_LARGE')return Response.json({error:'Request exceeds 4 KB.'},{status:413});
if(m==='INPUT')return Response.json({error:'Please check your input and try again.'},{status:400});console.error('MemeSpace storage operation failed');return Response.json({error:'This module is temporarily unavailable. Your input has been kept; please try again.'},{status:503});}
