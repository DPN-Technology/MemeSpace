import {revokeOtherSessions} from '@/lib/local-auth.mjs';
import {authFailure,authResponse,requireAuth} from '../../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const context=requireAuth(request);const revoked=revokeOtherSessions(context.db,context.session.userId,context.session.sessionId);return authResponse({ok:true,revoked},200,context.cookie)}catch(error){return authFailure(error)}}
