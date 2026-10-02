import {rawDatabase} from '@/db/raw';
import {arcadeCatalog} from '@/lib/arcade-catalog.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(){
  return Response.json({games:arcadeCatalog(rawDatabase())},{headers:{'Cache-Control':'no-store'}});
}
