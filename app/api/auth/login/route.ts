import {authenticateAccountAsync,issueSession} from '@/lib/local-auth.mjs';
import {rateLimitAuth} from '@/lib/auth-abuse.mjs';
import {rawDatabase} from '@/db/raw';
import {authFailure,authResponse,parseBody,requireOrigin,setSessionCookie} from '../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{
    requireOrigin(request);const input=await parseBody(request);const db=rawDatabase();
    rateLimitAuth(db,'login',undefined,Date.now(),'global');
    let account;
    try{account=await authenticateAccountAsync(db,input?.identifier??input?.email,input?.password)}
    catch(error){
      if(error instanceof Error&&'code' in error&&error.code==='AUTH_INVALID')rateLimitAuth(db,'login',input?.identifier??input?.email,Date.now(),'identifier');
      throw error;
    }if(!account)throw Object.assign(new Error('AUTH_INVALID'),{code:'AUTH_INVALID'});const session=issueSession(db,account.userId,'Local sign-in');
    return authResponse({account,sessionCount:1},200,setSessionCookie(request,session.token));
  }catch(error){return authFailure(error)}
}
