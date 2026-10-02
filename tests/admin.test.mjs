import test from 'node:test';
import {request as httpRequest} from 'node:http';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase} from '../lib/local-database.mjs';
import {createAccount,issueSession,readAuthSession,authenticateAccount} from '../lib/local-auth.mjs';
import {sessionCookie} from '../lib/local-session.mjs';
import {openSecurity,createInvite,beginEnrollment,finishEnrollment,login,readSession,totp,base32,cookieName,sessionAge,rateLimit,requirePermission} from '../admin/security.mjs';
import {createAdminServer} from '../admin/server.mjs';
import * as ops from '../admin/operations.mjs';
const source=fileURLToPath(new URL('../',import.meta.url));
const pw='correct-admin-passphrase-2026';
function fixture(){const root=mkdtempSync(path.join(tmpdir(),'memespace-admin-'));for(const dir of ['drizzle','admin'])cpSync(path.join(source,dir),path.join(root,dir),{recursive:true});return root}
function enroll(db,key,invite,email='operator@example.test') {const start=beginEnrollment(db,key,{invitation:invite.token,identifier:email,displayName:'Test operator',password:pw});const finish=finishEnrollment(db,key,{enrollmentToken:start.enrollmentToken,code:totp(start.secret)});return {start,...finish,cookie:cookieName+'='+finish.token,context:readSession(db,cookieName+'='+finish.token)}}
function unitFixture(){const root=fixture(),site=openDatabase(root),{db,key}=openSecurity(root);return {root,site,db,key,close(){site.close();db.close();rmSync(root,{recursive:true,force:true})}}}

test('authenticator implementation matches RFC 6238 independent test vectors',()=>{
 const secret=base32(Buffer.from('12345678901234567890'));
 for(const [seconds,expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])assert.equal(totp(secret,seconds*1000,8),expected);
});
test('owner enrollment is single-use, encrypted, MFA-bound and recoverable without replay',()=>{
 const f=unitFixture();try{
  const invite=createInvite(f.db,null,{},true);const owner=enroll(f.db,f.key,invite);
  assert.equal(owner.account.role,'owner');assert.equal(owner.recoveryCodes.length,8);
  assert.notEqual(f.db.prepare('SELECT mfa_secret FROM admins').get().mfa_secret,owner.start.secret);
  assert.equal(f.site.prepare("SELECT name FROM sqlite_master WHERE name='admins'").get(),undefined,'public database contains no admin identities');
  assert.throws(()=>beginEnrollment(f.db,f.key,{invitation:invite.token,identifier:'attacker@test.local',displayName:'x',password:pw}),/invalid or expired/);
  assert.throws(()=>createInvite(f.db,null,{},true),/already enrolled/);
  assert.throws(()=>login(f.db,f.key,{email:'operator@example.test',password:pw,code:totp(owner.start.secret)}),/incorrect/,'used TOTP cannot sign in twice');
  const signed=login(f.db,f.key,{email:'operator@example.test',password:pw,code:owner.recoveryCodes[0]});assert.ok(signed.token);
  assert.throws(()=>login(f.db,f.key,{email:'operator@example.test',password:pw,code:owner.recoveryCodes[0]}),/incorrect/);
  assert.equal(readSession(f.db,'memespace_session='+signed.token),null);
  assert.equal(readSession(f.db,cookieName+'='+owner.token+'; '+cookieName+'='+owner.token),null);
  f.db.prepare('UPDATE admin_sessions SET last_seen_at=? WHERE id=?').run(Date.now()-31*60000,owner.sessionId);assert.equal(readSession(f.db,owner.cookie),null);
  f.db.prepare('UPDATE admin_sessions SET expires_at=? WHERE id=?').run(Date.now()-1,signed.sessionId);assert.equal(readSession(f.db,cookieName+'='+signed.token),null);
 }finally{f.close()}
});
test('staff permissions, invite binding, disabling and audit protection are enforced',()=>{
 const f=unitFixture();try{
  const owner=enroll(f.db,f.key,createInvite(f.db,null,{},true));
  const invite=createInvite(f.db,owner.context,{role:'moderator',email:'moderator@example.test'});
  assert.throws(()=>beginEnrollment(f.db,f.key,{invitation:invite.token,identifier:'wrong@example.test',displayName:'Wrong',password:pw}),/email address/);
  const moderator=enroll(f.db,f.key,invite,'moderator@example.test');
  requirePermission(moderator.context,'chat.moderate');assert.throws(()=>requirePermission(moderator.context,'system.manage'),/permission/);assert.throws(()=>createInvite(f.db,moderator.context,{role:'administrator',email:'more@example.test'}),/permission/);
  assert.throws(()=>createInvite(f.db,owner.context,{role:'owner',email:'more@example.test'}),/Choose/);
  assert.throws(()=>f.db.prepare('UPDATE audit_events SET action=?').run('changed'),/append-only/);
  assert.throws(()=>f.db.exec('DELETE FROM audit_events'),/append-only/);
  for(let i=0;i<3;i++)rateLimit(f.db,'unit-limit',3);assert.throws(()=>rateLimit(f.db,'unit-limit',3),e=>e.status===429);
 }finally{f.close()}
});
test('member suspensions revoke public sessions and reject password sign-in until restored',()=>{
 const f=unitFixture(),oldMode=process.env.MEMESPACE_LOCAL_MODE,oldPort=process.env.MEMESPACE_PORT;
 try{
  process.env.MEMESPACE_LOCAL_MODE='1';process.env.MEMESPACE_PORT='5173';
  const owner=enroll(f.db,f.key,createInvite(f.db,null,{},true));
  const member=createAccount(f.site,{identifier:'member@example.test',displayName:'Member',password:pw}),issued=issueSession(f.site,member.userId);
  const headers=new Headers({host:'localhost:5173',cookie:'memespace_session='+issued.token});assert.ok(readAuthSession(f.site,headers));
  ops.memberAction(f.site,f.db,owner.context,member.userId,{action:'suspend',reason:'Repeated community spam'});
  assert.equal(readAuthSession(f.site,headers),null);assert.throws(()=>authenticateAccount(f.site,member.email,pw),/Invalid/);
  ops.memberAction(f.site,f.db,owner.context,member.userId,{action:'restore',reason:'Appeal reviewed and approved'});
  assert.equal(readAuthSession(f.site,headers),null);assert.equal(authenticateAccount(f.site,member.email,pw).userId,member.userId);
  assert.equal(readAuthSession(f.site,new Headers({host:'localhost:5173',cookie:owner.cookie})),null);
 }finally{if(oldMode===undefined)delete process.env.MEMESPACE_LOCAL_MODE;else process.env.MEMESPACE_LOCAL_MODE=oldMode;if(oldPort===undefined)delete process.env.MEMESPACE_PORT;else process.env.MEMESPACE_PORT=oldPort;f.close()}
});
test('moderation, announcements, live switches and verified backups use actual records',async()=>{
 const f=unitFixture();try{
  const owner=enroll(f.db,f.key,createInvite(f.db,null,{},true)),ctx=owner.context;
  f.site.prepare('INSERT INTO messages(id,user_id,text,created_at) VALUES(?,?,?,?)').run('m1','local_seedy','Review this message',Date.now());
  f.site.prepare('INSERT INTO reports(id,user_id,message_id,created_at) VALUES(?,?,?,?)').run('r1','local_seedy','m1',Date.now());
  ops.moderate(f.site,f.db,ctx,'r1',{action:'hide',reason:'Spam review confirmed'});assert.ok(f.site.prepare('SELECT hidden_at FROM messages WHERE id=?').get('m1').hidden_at);
  assert.equal(ops.reports(f.site,ctx,new URL('http://localhost?status=open')).total,0);
  ops.messageAction(f.site,f.db,ctx,'m1',{action:'restore',reason:'Appeal reviewed in full'});assert.equal(f.site.prepare('SELECT hidden_at FROM messages WHERE id=?').get('m1').hidden_at,0);
  const news=ops.saveAnnouncement(f.site,f.db,ctx,{title:'Welcome',body:'Community update',tone:'info',status:'draft'});assert.equal(f.site.prepare("SELECT count(*) n FROM announcements WHERE status='published'").get().n,0);
  ops.saveAnnouncement(f.site,f.db,ctx,{title:'Welcome',body:'Now live',tone:'event',status:'published'},news.id);assert.equal(f.site.prepare("SELECT body FROM announcements WHERE status='published'").get().body,'Now live');
  ops.changeSettings(f.site,f.db,ctx,{registration_open:false,chat_readonly:true,reason:'Maintenance window'});assert.deepEqual(ops.settings(f.site),{registration_open:false,chat_readonly:true});
  const saved=await ops.createBackup(f.site,f.db,ctx,f.root);assert.equal(saved.integrity,'ok');assert.match(saved.sha256,/^[a-f0-9]{64}$/);
  const restored=new DatabaseSync(path.join(f.root,'data/backups',saved.name),{readOnly:true});try{assert.equal(restored.prepare('SELECT text FROM messages WHERE id=?').get('m1').text,'Review this message');assert.equal(restored.prepare('SELECT body FROM announcements').get().body,'Now live')}finally{restored.close()}
  assert.equal((await ops.backupList(f.root)).length,1);assert.ok(f.db.prepare("SELECT id FROM audit_events WHERE action='system.backup' AND result='success'").get());
 }finally{f.close()}
});
test('separate HTTP API rejects public cookies, foreign origins, missing CSRF and unauthorized roles',async()=>{
 const root=fixture(),port=Number(process.env.MEMESPACE_ADMIN_TEST_PORT||5391),base=`http://127.0.0.1:${port}`;let app;
 try{
  app=await createAdminServer({root,port,sitePort:5392});await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
  async function call(route,{data,cookie,csrf,origin=base,headers={}}={}){return fetch(base+route,{method:data===undefined?'GET':'POST',headers:{...(data!==undefined?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)})}
  const page=await call('/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(await page.text(),/Control Center/);
  assert.equal((await call('/api/users')).status,401);assert.equal((await call('/api/users',{cookie:'memespace_session=forged'})).status,401);
  assert.equal((await call('/api/login',{data:{},origin:'http://127.0.0.1:5392'})).status,403);
  const badHost=await new Promise((resolve,reject)=>{const request=httpRequest(base+'/api/session',{headers:{Host:'attacker.example'}},r=>{r.resume();resolve(r.statusCode)});request.on('error',reject);request.end()});assert.equal(badHost,403);
  const invite=app.bootstrap();const startResponse=await call('/api/enroll/start',{data:{invitation:invite.token,identifier:'operator@example.test',displayName:'Operator',password:pw}});assert.equal(startResponse.status,200);const start=await startResponse.json();
  const finish=await call('/api/enroll/finish',{data:{enrollmentToken:start.enrollmentToken,code:totp(start.secret)}});assert.equal(finish.status,200);assert.match(finish.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const ownerCookie=finish.headers.get('set-cookie').split(';')[0],summary=await (await call('/api/session',{cookie:ownerCookie})).json();assert.equal(summary.account.role,'owner');assert.ok(summary.csrf);
  assert.equal((await call('/api/settings',{cookie:ownerCookie,data:{}})).status,403);
  assert.equal((await call('/api/overview',{cookie:ownerCookie})).status,200);
  assert.equal((await call('/api/admins',{cookie:ownerCookie})).status,404);
  const invitation=await (await call('/api/invitations',{cookie:ownerCookie,csrf:summary.csrf,data:{email:'observer@example.test',role:'observer'}})).json();const observer=enroll(app.security,app.key,invitation,'observer@example.test');
  assert.equal((await call('/api/overview',{cookie:observer.cookie})).status,200);assert.equal((await call('/api/users',{cookie:observer.cookie})).status,403);
  assert.equal((await call('/api/games',{cookie:observer.cookie})).status,403);
  const observerSummary=await (await call('/api/session',{cookie:observer.cookie})).json();
  assert.equal((await call('/api/games/pool',{cookie:observer.cookie,csrf:observerSummary.csrf,data:{action:'pause',reason:'Unauthorized change'}})).status,403);
  assert.equal((await call('/api/games/pool',{cookie:ownerCookie,data:{action:'pause',reason:'Missing CSRF check'}})).status,403);
  assert.equal((await call('/api/staff/'+observer.account.id,{cookie:ownerCookie,csrf:summary.csrf,data:{disabled:true}})).status,200);assert.equal((await call('/api/overview',{cookie:observer.cookie})).status,401);
  assert.equal((await call('/api/staff/'+summary.account.id,{cookie:ownerCookie,csrf:summary.csrf,data:{disabled:true}})).status,400);
  assert.equal((await call('/api/logout',{cookie:ownerCookie,csrf:summary.csrf,data:{}})).status,200);assert.equal((await call('/api/users',{cookie:ownerCookie})).status,401);
 }finally{await app?.close();rmSync(root,{recursive:true,force:true})}
});


test('arcade controls validate cabinet actions, enforce permissions, preserve settings and audit changes',()=>{
 const f=unitFixture();try{
  const owner=enroll(f.db,f.key,createInvite(f.db,null,{},true)),ctx=owner.context;
  assert.equal(ops.games(f.site,ctx).items.length,6);assert.ok(ops.games(f.site,ctx).items.every(g=>g.enabled));
  assert.throws(()=>ops.changeGame(f.site,f.db,{...ctx,role:'moderator'},'pool',{action:'pause',reason:'Valid change reason'}),e=>e.status===403);
  assert.throws(()=>ops.changeGame(f.site,f.db,ctx,'unknown',{action:'pause',reason:'Valid change reason'}),e=>e.status===404);
  assert.throws(()=>ops.changeGame(f.site,f.db,ctx,'pool',{action:'destroy',reason:'Valid change reason'}),e=>e.status===400);
  assert.throws(()=>ops.changeGame(f.site,f.db,ctx,'pool',{action:'pause',reason:''}),e=>e.status===400);
  const changed=ops.changeGame(f.site,f.db,ctx,'pool',{action:'pause',reason:'Prepare table update'});assert.equal(changed.game.enabled,false);
  assert.equal(ops.settings(f.site).registration_open,true);assert.ok(ops.games(f.site,ctx).items.find(g=>g.id==='slots').enabled);
  const audit=f.db.prepare("SELECT details FROM audit_events WHERE action='game.pause' AND result='success'").get();assert.deepEqual(JSON.parse(audit.details),{reason:'Prepare table update',before:true,after:false});
  ops.changeGame(f.site,f.db,{...ctx,role:'administrator'},'pool',{action:'enable',reason:'Table update complete'});assert.ok(ops.games(f.site,ctx).items.find(g=>g.id==='pool').enabled);
 }finally{f.close()}
});
