import {rawDatabase} from '@/db/raw';
import {body} from '@/app/api/common';
import {authCookie,changePassword,deleteAccount,exportAccount,issueSession,listSessions,readAuthSession,revokeOtherSessions,revokeSession,sessionMaxAge} from '@/lib/local-auth.mjs';
import {sameOrigin} from '@/lib/local-session.mjs';

export function jsonAccount(account:unknown){return account||null;}
export function secureCookie(request:Request){return new URL(request.url).protocol==='https:'?'; Secure':'';}
export function setSessionCookie(request:Request,token:string,maxAge=sessionMaxAge){return `${authCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookie(request)}`;}
export function clearSessionCookie(request:Request){return `${authCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(request)}`;}
export function clearLegacyCookie(){return 'memespace_local_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';}
export function noStore(){return {'Cache-Control':'no-store'};}
export function withCookie(headers:HeadersInit={},cookie?:string){const result=new Headers(headers);if(cookie)result.append('Set-Cookie',cookie);result.set('Cache-Control','no-store');return result;}

export function authFailure(error:unknown){
  const code=error instanceof Error&&'code' in error?String((error as Error&{code?:unknown}).code||''):'';
  if(code==='ORIGIN')return Response.json({error:'This request is not allowed.'},{status:403,headers:noStore()});
  if(code==='AUTH_REQUIRED')return Response.json({error:'Please sign in to use this feature.'},{status:401,headers:noStore()});
  if(code==='AUTH_INVALID')return Response.json({error:'Invalid email or password.'},{status:401,headers:noStore()});
  if(code==='DUPLICATE')return Response.json({error:'That identifier is already in use.'},{status:409,headers:noStore()});
  if(code==='CONFIRMATION')return Response.json({error:error instanceof Error?error.message:'Confirmation required.'},{status:400,headers:noStore()});
  if(code==='AUTH_INPUT'||code==='INPUT')return Response.json({error:error instanceof Error?error.message:'Please check your input and try again.'},{status:400,headers:noStore()});
  console.error('MemeSpace auth operation failed');
  return Response.json({error:'This identity operation is temporarily unavailable.'},{status:503,headers:noStore()});
}

export function requireOrigin(request:Request){if(!sameOrigin(request))throw Object.assign(new Error('ORIGIN'),{code:'ORIGIN'});}
export async function parseBody(request:Request){try{return await body(request)}catch{throw Object.assign(new Error('INPUT'),{code:'INPUT'})}}

export function authContext(request:Request){
  requireOrigin(request);
  const db=rawDatabase();
  const session=readAuthSession(db,request.headers);
  if(!session){return {db,session:null,cookie:undefined};}
  if(session.legacy){
    db.prepare('UPDATE accounts SET legacy_claimed_at=? WHERE user_id=?').run(Date.now(),session.userId);
    const issued=issueSession(db,session.userId,'Legacy browser upgrade');
    return {db,session:{...session,sessionId:issued.id,legacy:false},cookie:setSessionCookie(request,issued.token)};
  }
  return {db,session,cookie:undefined};
}

export function requireAuth(request:Request){
  const context=authContext(request);
  if(!context.session)throw Object.assign(new Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED'});
  return context;
}

export function authResponse(payload:unknown,status=200,cookie?:string){return Response.json(payload,{status,headers:withCookie(noStore(),cookie)});}
export function sessionPayload(context:{db:ReturnType<typeof rawDatabase>;session:{userId:string;sessionId:string|null;account:unknown}|null}){
  if(!context.session)return {account:null,sessionCount:0};
  return {account:jsonAccount(context.session.account),sessionCount:listSessions(context.db,context.session.userId).length};
}

export {authCookie,changePassword,deleteAccount,exportAccount,listSessions,revokeOtherSessions,revokeSession,issueSession,readAuthSession};
