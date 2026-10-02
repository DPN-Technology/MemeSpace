import {changePassword} from '@/lib/local-auth.mjs';
import {authFailure,authResponse,parseBody,requireAuth} from '../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{const context=requireAuth(request);const input=await parseBody(request);const legacyClaim=Boolean(input?.setup)&&Boolean(context.session.account?.needsPasswordSetup);const account=changePassword(context.db,context.session.userId,input?.currentPassword??'',input?.newPassword??'',{legacy:legacyClaim,currentSessionId:context.session.sessionId});return authResponse({account,sessionCount:1},200,context.cookie)}catch(error){return authFailure(error)}
}
