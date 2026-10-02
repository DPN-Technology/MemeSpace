import {revokeSession} from '@/lib/local-auth.mjs';
import {authFailure,authResponse,requireAuth} from '../../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{const context=requireAuth(request);const {id}=await params;if(id===context.session.sessionId)return authResponse({error:'Use sign out to close the current session.'},400,context.cookie);const revoked=revokeSession(context.db,id,context.session.userId);return authResponse({ok:revoked},200,context.cookie)}catch(error){return authFailure(error)}}
