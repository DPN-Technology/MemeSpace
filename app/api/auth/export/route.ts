import {exportAccount} from '@/lib/local-auth.mjs';
import {authFailure,authContext,withCookie} from '../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){try{const context=authContext(request);if(!context.session)throw Object.assign(new Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED'});const payload=JSON.stringify(exportAccount(context.db,context.session.userId),null,2);const headers=withCookie({'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="memespace-account-export.json"'},context.cookie);return new Response(payload,{status:200,headers})}catch(error){return authFailure(error)}}
