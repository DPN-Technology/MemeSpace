import {database} from '@/db/raw';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  try{await database().prepare('SELECT 1 AS ok').first();return Response.json({ok:true,runtime:'node',storage:'sqlite'},{headers:{'Cache-Control':'no-store'}})}
  catch{return Response.json({ok:false},{status:503})}
}
