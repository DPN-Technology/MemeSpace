import {sameOrigin,safeReturn} from '@/lib/local-session.mjs';
import {authContext} from '@/app/api/auth/_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){
  if(!sameOrigin(request))return new Response('Local sign-in is only available on this computer.',{status:403});
  const context=authContext(request);
  const destination=context.session?safeReturn(new URL(request.url).searchParams.get('return_to')):'/?signin=1';
  const headers=new Headers({Location:destination,'Cache-Control':'no-store'});
  if(context.cookie)headers.append('Set-Cookie',context.cookie);
  headers.append('Set-Cookie','memespace_local_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  return new Response(null,{status:303,headers});
}
