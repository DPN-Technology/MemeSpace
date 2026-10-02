import {clearLegacyCookie,clearSessionCookie,authContext,authFailure,authResponse} from '../_shared';
import {revokeSession} from '@/lib/local-auth.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{const context=authContext(request);if(context.session?.sessionId)revokeSession(context.db,context.session.sessionId,context.session.userId);const response=authResponse({ok:true},200,clearSessionCookie(request));response.headers.append('Set-Cookie',clearLegacyCookie());return response}catch(error){return authFailure(error)}
}
