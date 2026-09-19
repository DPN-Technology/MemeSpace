import {sameOrigin,safeReturn,sessionCookie} from '@/lib/local-session.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){
  if(!sameOrigin(request))return new Response('Local sign-in is only available on this computer.',{status:403});
  return new Response(null,{status:303,headers:{Location:safeReturn(new URL(request.url).searchParams.get('return_to')),'Set-Cookie':sessionCookie(),'Cache-Control':'no-store'}});
}
