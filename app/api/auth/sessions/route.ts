import {listSessions} from '@/lib/local-auth.mjs';
import {authFailure,authResponse,requireAuth} from '../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){try{const context=requireAuth(request);return authResponse({sessions:listSessions(context.db,context.session.userId,context.session.sessionId)},200,context.cookie)}catch(error){return authFailure(error)}}
