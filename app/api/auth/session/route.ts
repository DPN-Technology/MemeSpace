import {authContext,authFailure,authResponse,sessionPayload} from '../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){try{const context=authContext(request);return authResponse(sessionPayload(context),200,context.cookie)}catch(error){return authFailure(error)}}
