import {linkWallet,signInWithWallet} from '@/lib/wallet-accounts.mjs';
import {rawDatabase} from '@/db/raw';
import {authContext,authFailure,authResponse,issueSession,parseBody,requireOrigin,setSessionCookie} from '../../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{
    requireOrigin(request);const input=await parseBody(request);
    const params={address:String(input?.address??''),nonce:String(input?.nonce??''),signature:String(input?.signature??''),domain:new URL(request.url).host};
    if(input?.purpose==='link'){
      const context=authContext(request);
      if(!context.session)throw Object.assign(new Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED'});
      linkWallet(context.db,{userId:context.session.userId,...params});
      return authResponse({linked:params.address},200,context.cookie);
    }
    const db=rawDatabase();const result=signInWithWallet(db,params);
    const session=issueSession(db,result.userId,'Wallet sign-in');
    return authResponse({created:result.created,sessionCount:1},200,setSessionCookie(request,session.token));
  }catch(error){return authFailure(error)}
}
