import {authenticateAccount,issueSession} from '@/lib/local-auth.mjs';
import {rawDatabase} from '@/db/raw';
import {authFailure,authResponse,parseBody,requireOrigin,setSessionCookie} from '../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{
    requireOrigin(request);const input=await parseBody(request);const db=rawDatabase();
    const account=authenticateAccount(db,input?.identifier??input?.email,input?.password);if(!account)throw Object.assign(new Error('AUTH_INVALID'),{code:'AUTH_INVALID'});const session=issueSession(db,account.userId,'Local sign-in');
    return authResponse({account,sessionCount:1},200,setSessionCookie(request,session.token));
  }catch(error){return authFailure(error)}
}
