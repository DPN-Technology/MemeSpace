import {rawDatabase} from '@/db/raw';
import {readAuthSession,revokeSession} from '@/lib/local-auth.mjs';
import {sameOrigin,safeReturn,localCookie} from '@/lib/local-session.mjs';
import {clearSessionCookie} from '@/app/api/auth/_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){
  if(!sameOrigin(request))return new Response('Request not allowed.',{status:403});
  const db=rawDatabase();const session=readAuthSession(db,request.headers);if(session?.sessionId)revokeSession(db,session.sessionId,session.userId);
  const headers=new Headers({Location:safeReturn(new URL(request.url).searchParams.get('return_to')),'Cache-Control':'no-store'});
  headers.append('Set-Cookie',clearSessionCookie(request));headers.append('Set-Cookie',`${localCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
  return new Response(null,{status:303,headers});
}
