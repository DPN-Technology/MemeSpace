import {createAccount,issueSession} from '@/lib/local-auth.mjs';
import {rawDatabase} from '@/db/raw';
import {authFailure,authResponse,parseBody,requireOrigin,setSessionCookie} from '../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{
    requireOrigin(request);
    const db=rawDatabase();
    if(db.prepare("SELECT value FROM platform_settings WHERE key='registration_open'").get()?.value==='false')return authResponse({error:'New registrations are temporarily paused. Existing members can still sign in.'},403);
    const account=createAccount(db,await parseBody(request));if(!account)throw Object.assign(new Error('AUTH_INVALID'),{code:'AUTH_INVALID'});
    const session=issueSession(db,account.userId,'First local device');
    return authResponse({account,sessionCount:1},201,setSessionCookie(request,session.token));
  }catch(error){return authFailure(error)}
}
