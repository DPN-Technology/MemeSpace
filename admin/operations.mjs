import {backup,DatabaseSync} from 'node:sqlite';
import {mkdir,readdir,stat,readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {dataDirectory} from '../lib/local-database.mjs';
import {arcadeCatalog,GAME_CATALOG} from '../lib/arcade-catalog.mjs';
import {audit,fail,requirePermission,transaction,roles,safeAdmin} from './security.mjs';

export function textInput(value,label,max=500,min=1){if(typeof value!=='string'||value.trim().length<min||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail(400,`${label} must be ${min}–${max} characters.`);return value.trim()}
function pagination(url){const page=Number(url.searchParams.get('page')||1);return {page:Number.isSafeInteger(page)&&page>0?Math.min(page,100000):1,limit:20}}
function resultPage(db,sql,countSql,args,url){const {page,limit}=pagination(url);return {items:db.prepare(sql+' LIMIT ? OFFSET ?').all(...args,limit,(page-1)*limit),total:db.prepare(countSql).get(...args).n,page,pageSize:limit}}
function publicMutation(site,security,ctx,action,id,details,fn){
  // Persist intent before touching site data; success follows the committed change.
  audit(security,ctx,action,id,details,'requested');
  try{const result=transaction(site,fn);audit(security,ctx,action,id,details,'success');return result}catch(e){audit(security,ctx,action,id,{},'failed');throw e}
}
export function overview(site,ctx){
  requirePermission(ctx,'overview.view');const n=(sql,...args)=>Number(site.prepare(sql).get(...args).n),now=Date.now(),since=now-24*3600000;
  const counts={members:n("SELECT count(*) n FROM accounts WHERE deleted_at=0 AND password_hash NOT LIKE 'legacy_unset$%'"),newMembers:n("SELECT count(*) n FROM accounts WHERE deleted_at=0 AND created_at>? AND password_hash NOT LIKE 'legacy_unset$%'",since),activeSessions:n('SELECT count(DISTINCT user_id) n FROM sessions WHERE revoked_at=0 AND expires_at>? AND last_seen_at>?',now,now-5*60000),messages:n('SELECT count(*) n FROM messages WHERE hidden_at=0'),messagesToday:n('SELECT count(*) n FROM messages WHERE hidden_at=0 AND created_at>?',since),openReports:n("SELECT count(*) n FROM reports WHERE status='open'"),suspended:n('SELECT count(*) n FROM accounts WHERE suspended_at>0 AND deleted_at=0')};
  const first=new Date(now-13*86400000);first.setUTCHours(0,0,0,0);
  const registrations=site.prepare("SELECT strftime('%Y-%m-%d',created_at/1000,'unixepoch') day,count(*) n FROM accounts WHERE deleted_at=0 AND created_at>=? AND password_hash NOT LIKE 'legacy_unset$%' GROUP BY day").all(first.getTime());
  const messages=site.prepare("SELECT strftime('%Y-%m-%d',created_at/1000,'unixepoch') day,count(*) n FROM messages WHERE created_at>=? GROUP BY day").all(first.getTime());
  const trend=Array.from({length:14},(_,i)=>{const day=new Date(first.getTime()+i*86400000).toISOString().slice(0,10);return {day,registrations:registrations.find(r=>r.day===day)?.n||0,messages:messages.find(r=>r.day===day)?.n||0}});
  return {counts,trend,generatedAt:now,settings:settings(site),channels:site.prepare('SELECT channel,count(*) total FROM messages WHERE hidden_at=0 GROUP BY channel ORDER BY total DESC').all()};
}
export function users(site,ctx,url){
  requirePermission(ctx,'users.view');const q=String(url.searchParams.get('q')||'').slice(0,120),status=url.searchParams.get('status')||'all';
  const where=" WHERE a.deleted_at=0 AND (a.email LIKE ? ESCAPE '\\' OR COALESCE(p.name,a.display_name) LIKE ? ESCAPE '\\')"+(status==='suspended'?' AND a.suspended_at>0':status==='active'?' AND a.suspended_at=0':'');
  const like='%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%',base=' FROM accounts a LEFT JOIN profiles p ON p.user_id=a.user_id';
  return resultPage(site,'SELECT a.user_id id,a.email,COALESCE(p.name,a.display_name) name,a.created_at,a.last_login_at,a.suspended_at,a.suspension_reason,(SELECT count(*) FROM messages m WHERE m.user_id=a.user_id) messages'+base+where+' ORDER BY a.created_at DESC','SELECT count(*) n'+base+where,[like,like],url);
}
export function memberAction(site,security,ctx,id,input){
  const action=input.action;requirePermission(ctx,action==='revoke'?'users.sessions':'users.suspend');if(!['suspend','restore','revoke'].includes(action))fail(400,'Unknown member action.');
  const row=site.prepare('SELECT user_id FROM accounts WHERE user_id=? AND deleted_at=0').get(id);if(!row)fail(404,'Member not found.');
  const reason=textInput(input.reason,'Reason',500,5);
  return publicMutation(site,security,ctx,'user.'+action,id,{reason},()=>{if(action!=='revoke')site.prepare('UPDATE accounts SET suspended_at=?,suspension_reason=?,updated_at=? WHERE user_id=?').run(action==='suspend'?Date.now():0,action==='suspend'?reason:'',Date.now(),id);if(action!=='restore')site.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at=0').run(Date.now(),id);return {ok:true}});
}
export function reports(site,ctx,url){
  requirePermission(ctx,'chat.moderate');const status=url.searchParams.get('status')||'open';if(!['open','resolved','dismissed','all'].includes(status))fail(400,'Invalid report filter.');const where=status==='all'?'':' WHERE r.status=?',args=status==='all'?[]:[status];
  const from=" FROM reports r LEFT JOIN messages m ON m.id=r.message_id LEFT JOIN accounts a ON a.user_id=m.user_id LEFT JOIN profiles p ON p.user_id=m.user_id LEFT JOIN accounts reporter ON reporter.user_id=r.user_id";
  return resultPage(site,"SELECT r.id,r.message_id,r.created_at,r.status,r.resolution_note,r.reviewed_at,m.text,m.channel,m.hidden_at,COALESCE(p.name,a.display_name,'Removed member') author,COALESCE(reporter.display_name,'Removed member') reporter"+from+where+' ORDER BY r.created_at DESC','SELECT count(*) n FROM reports r'+where,args,url);
}
export function moderate(site,security,ctx,id,input){
  requirePermission(ctx,'chat.moderate');if(!['hide','resolve','dismiss','reopen'].includes(input.action))fail(400,'Invalid report action.');const reason=textInput(input.reason,'Decision note',500,5),row=site.prepare('SELECT * FROM reports WHERE id=?').get(id);if(!row)fail(404,'Report not found.');
  return publicMutation(site,security,ctx,'report.'+input.action,id,{reason,messageId:row.message_id},()=>{if(input.action==='hide'){const changed=site.prepare('UPDATE messages SET hidden_at=?,hidden_reason=? WHERE id=?').run(Date.now(),reason,row.message_id);if(!changed.changes)fail(409,'This message was already deleted. Resolve the report without hiding it.');}
    const status=input.action==='reopen'?'open':input.action==='dismiss'?'dismissed':'resolved';site.prepare('UPDATE reports SET status=?,reviewed_at=?,reviewed_by=?,resolution_note=? WHERE id=?').run(status,Date.now(),ctx.id,reason,id);return {ok:true};});
}
export function messages(site,ctx,url){
  requirePermission(ctx,'chat.moderate');const where=url.searchParams.get('status')==='hidden'?' WHERE m.hidden_at>0':'';
  const from=' FROM messages m LEFT JOIN profiles p ON p.user_id=m.user_id LEFT JOIN accounts a ON a.user_id=m.user_id';
  return resultPage(site,"SELECT m.id,m.text,m.channel,m.hidden_at,m.hidden_reason,m.created_at,COALESCE(p.name,a.display_name,'Explorer') author"+from+where+' ORDER BY m.created_at DESC','SELECT count(*) n FROM messages m'+where,[],url);
}
export function messageAction(site,security,ctx,id,input){
  requirePermission(ctx,'chat.moderate');if(!['hide','restore'].includes(input.action))fail(400,'Invalid message action.');const reason=textInput(input.reason,'Decision note',500,5);
  return publicMutation(site,security,ctx,'message.'+input.action,id,{reason},()=>{const r=site.prepare('UPDATE messages SET hidden_at=?,hidden_reason=? WHERE id=?').run(input.action==='hide'?Date.now():0,input.action==='hide'?reason:'',id);if(!r.changes)fail(404,'Message not found.');return {ok:true}});
}
export function settings(site){return Object.fromEntries(site.prepare("SELECT key,value FROM platform_settings WHERE key IN ('registration_open','chat_readonly')").all().map(r=>[r.key,r.value==='true']))}
export function changeSettings(site,security,ctx,input){
  requirePermission(ctx,'system.manage');if(typeof input.registration_open!=='boolean'||typeof input.chat_readonly!=='boolean')fail(400,'Both switches must be true or false.');const reason=textInput(input.reason,'Change note',500,5);
  return publicMutation(site,security,ctx,'system.settings','platform',{reason,before:settings(site),after:{registration_open:input.registration_open,chat_readonly:input.chat_readonly}},()=>{for(const key of ['registration_open','chat_readonly'])site.prepare('UPDATE platform_settings SET value=?,updated_at=? WHERE key=?').run(String(input[key]),Date.now(),key);return {ok:true,settings:settings(site)}});
}
export function games(site,ctx){requirePermission(ctx,'games.manage');return {items:arcadeCatalog(site)}}
export function changeGame(site,security,ctx,id,input){
  requirePermission(ctx,'games.manage');
  if(!GAME_CATALOG.some(game=>game.id===id))fail(404,'Cabinet not found.');
  if(!['enable','pause'].includes(input.action))fail(400,'Choose enable or pause.');
  const reason=textInput(input.reason,'Change note',500,5),enabled=input.action==='enable',before=arcadeCatalog(site).find(game=>game.id===id).enabled;
  return publicMutation(site,security,ctx,'game.'+input.action,id,{reason,before,after:enabled},()=>{
    site.prepare('UPDATE platform_settings SET value=?,updated_at=? WHERE key=?').run(String(enabled),Date.now(),'game_'+id+'_enabled');
    return {ok:true,game:arcadeCatalog(site).find(game=>game.id===id)};
  });
}
export function announcements(site,ctx){requirePermission(ctx,'content.manage');return {items:site.prepare('SELECT * FROM announcements ORDER BY updated_at DESC LIMIT 100').all()}}
export function saveAnnouncement(site,security,ctx,input,id=null){
  requirePermission(ctx,'content.manage');const title=textInput(input.title,'Title',100),body=textInput(input.body,'Message',1000),tone=input.tone,status=input.status;
  if(!['info','event','maintenance'].includes(tone)||!['draft','published','archived'].includes(status))fail(400,'Invalid announcement status or type.');
  const old=id?site.prepare('SELECT * FROM announcements WHERE id=?').get(id):null;if(id&&!old)fail(404,'Announcement not found.');if(status==='published'||old?.status==='published')requirePermission(ctx,'content.publish');
  id??=randomUUID();const now=Date.now();
  return publicMutation(site,security,ctx,'content.'+status,id,{title},()=>{site.prepare('INSERT INTO announcements(id,title,body,tone,status,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,tone=excluded.tone,status=excluded.status,updated_at=excluded.updated_at,published_at=excluded.published_at').run(id,title,body,tone,status,old?.created_at||now,now,status==='published'?now:old?.published_at||0);return {ok:true,id}});
}
export function auditEvents(db,ctx,url){
  requirePermission(ctx,'security.view');const q=String(url.searchParams.get('q')||'').slice(0,100),where=' WHERE action LIKE ? OR actor_name LIKE ? OR object_id LIKE ?',like='%'+q.replaceAll('%','').replaceAll('_','')+'%';
  return resultPage(db,'SELECT * FROM audit_events'+where+' ORDER BY id DESC','SELECT count(*) n FROM audit_events'+where,[like,like,like],url);
}
export function staff(db,ctx){requirePermission(ctx,'admins.manage');return {roles:Object.entries(roles).filter(([id])=>id!=='owner').map(([id,r])=>({id,...r})),items:db.prepare('SELECT * FROM admins ORDER BY created_at').all().map(safeAdmin),invitations:db.prepare('SELECT id,email,role,expires_at,used_at,revoked_at FROM admin_invites WHERE used_at=0 AND revoked_at=0 AND expires_at>? ORDER BY created_at DESC').all(Date.now())}}
export async function backupList(root){const folder=path.join(dataDirectory(root),'backups');await mkdir(folder,{recursive:true,mode:0o700});const files=await readdir(folder),names=files.filter(n=>/^memespace-[\w.-]+\.sqlite$/.test(n)&&files.includes(n+'.sha256'));const rows=await Promise.all(names.map(async name=>{const info=await stat(path.join(folder,name));return {name,bytes:info.size,createdAt:info.mtimeMs}}));return rows.sort((a,b)=>b.createdAt-a.createdAt)}
let backupRunning=false;
export async function createBackup(site,security,ctx,root){
  if(ctx?.id!=='local-scheduler')requirePermission(ctx,'system.backup');if(backupRunning)fail(409,'A backup is already running.');backupRunning=true;
  try{
    const folder=path.join(dataDirectory(root),'backups');await mkdir(folder,{recursive:true,mode:0o700});const name='memespace-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'.sqlite',file=path.join(folder,name);
    audit(security,ctx,'system.backup',name,{},'requested');await backup(site,file);
    const copy=new DatabaseSync(file,{readOnly:true});let integrity;try{integrity=Object.values(copy.prepare('PRAGMA integrity_check').get())[0]}finally{copy.close()}if(integrity!=='ok')throw Error('Backup integrity check failed');
    const bytes=await readFile(file),sha256=createHash('sha256').update(bytes).digest('hex');await writeFile(file+'.sha256',sha256+'  '+name+'\n',{mode:0o600});audit(security,ctx,'system.backup',name,{sha256,bytes:bytes.length,integrity});return {ok:true,name,sha256,bytes:bytes.length,integrity};
  }catch(e){audit(security,ctx,'system.backup','',{message:'Backup could not be verified'},'failed');throw e}finally{backupRunning=false}
}
