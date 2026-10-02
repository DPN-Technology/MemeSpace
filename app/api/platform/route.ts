import {rawDatabase} from '@/db/raw';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(){
  const db=rawDatabase();
  const announcements=db.prepare("SELECT id,title,body,tone,published_at FROM announcements WHERE status='published' ORDER BY published_at DESC LIMIT 5").all();
  const settings=Object.fromEntries(db.prepare('SELECT key,value FROM platform_settings').all().map((r:any)=>[r.key,r.value==='true']));
  return Response.json({announcements,registrationOpen:settings.registration_open,chatReadOnly:settings.chat_readonly},{headers:{'Cache-Control':'no-store'}});
}
