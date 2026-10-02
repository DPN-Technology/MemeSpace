import {deleteAccount} from '@/lib/local-auth.mjs';
import {authContext,authFailure,authResponse,clearLegacyCookie,clearSessionCookie,parseBody,requireAuth} from '../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){try{const context=requireAuth(request);return authResponse({account:context.session.account},200,context.cookie)}catch(error){return authFailure(error)}}
export async function DELETE(request:Request){
  try{const context=requireAuth(request);const input=await parseBody(request);deleteAccount(context.db,context.session.userId,input?.confirmation,input?.legacyConfirmation,input?.currentPassword);const response=authResponse({ok:true},200,clearSessionCookie(request));response.headers.append('Set-Cookie',clearLegacyCookie());return response}catch(error){return authFailure(error)}
}
