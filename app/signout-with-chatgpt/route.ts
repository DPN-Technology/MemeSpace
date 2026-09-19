import {sameOrigin,safeReturn,localCookie} from '@/lib/local-session.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){
  if(!sameOrigin(request))return new Response('Request not allowed.',{status:403});
  return new Response(null,{status:303,headers:{Location:safeReturn(new URL(request.url).searchParams.get('return_to')),'Set-Cookie':`${localCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,'Cache-Control':'no-store'}});
}
