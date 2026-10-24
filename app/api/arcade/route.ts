import {rawDatabase} from '@/db/raw';
import {arcadeCatalog,isFreeBeta} from '@/lib/arcade-catalog.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(){
  return Response.json({mode:isFreeBeta()?'beta':'standard',games:arcadeCatalog(rawDatabase())},{headers:{'Cache-Control':'no-store'}});
}
