import {issueChallenge} from '@/lib/wallet-accounts.mjs';
import {rawDatabase} from '@/db/raw';
import {authContext,authFailure,authResponse,parseBody,requireOrigin} from '../../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{
    requireOrigin(request);const input=await parseBody(request);
    const purpose=input?.purpose==='link'?'link':'signin';
    const context=purpose==='link'?authContext(request):null;
    if(context&&!context.session)throw Object.assign(new Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED'});
    const db=context?.db??rawDatabase();
    const challenge=issueChallenge(db,{address:String(input?.address??''),domain:new URL(request.url).host,purpose,userId:context?.session?.userId??null});
    return authResponse({nonce:challenge.nonce,message:challenge.message,expiresAt:challenge.expiresAt},200,context?.cookie);
  }catch(error){return authFailure(error)}
}
