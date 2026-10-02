import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase,importLegacyDatabase} from '../lib/local-database.mjs';
import {openSecurity,createInvite,beginEnrollment,finishEnrollment,login,readSession,rateLimit,audit,fail,requirePermission,revokeStaff,cookieName,sessionAge} from './security.mjs';
import * as ops from './operations.mjs';

const assets={'/':['index.html','text/html; charset=utf-8'],'/admin.css':['admin.css','text/css; charset=utf-8'],'/admin.js':['admin.js','text/javascript; charset=utf-8']};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
function cookie(token='',age=sessionAge/1000){return `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`}
async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Use a JSON request.');let length=0,chunks=[];for await(const chunk of req){length+=chunk.length;if(length>16384)fail(413,'This request is too large.');chunks.push(chunk)}let data;try{data=JSON.parse(Buffer.concat(chunks).toString())}catch{fail(400,'Invalid JSON.')}if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'A JSON object is required.');return data}
export async function createAdminServer({root=fileURLToPath(new URL('../',import.meta.url)),port=5174,sitePort=5173}={}){
  if(!Number.isInteger(sitePort)||sitePort<1024||sitePort>65535||!Number.isInteger(port)||port<1024||port>65535||port===sitePort)throw Error('The admin port must be a different port from 1024 to 65535.');
  await importLegacyDatabase(root);const site=openDatabase(root),{db:security,key}=openSecurity(root);
  const files=Object.fromEntries(await Promise.all(Object.entries(assets).map(async([url,[name,type]])=>[url,{type,data:await readFile(path.join(root,'admin/public',name))}])));
  const send=(res,status,value,extra={})=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8',...extra});res.end(JSON.stringify(value))};
  const server=createServer(async(req,res)=>{
    let ctx=null;
    try{
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))fail(403,'Control Center is local to this computer.');
      const host=req.headers.host;if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host))fail(403,'Invalid admin host.');
      const origin=`http://${host}`,url=new URL(req.url,origin),route=url.pathname,method=req.method,mutation=!['GET','HEAD'].includes(method);
      if(req.headers.origin&&req.headers.origin!==origin)fail(403,'Cross-origin requests are not allowed.');
      if(req.headers['sec-fetch-site']==='cross-site'||(mutation&&req.headers.origin!==origin))fail(403,'This request must originate in the Control Center.');
      if(method==='GET'&&files[route]){res.writeHead(200,{...headers,'Content-Type':files[route].type});res.end(files[route].data);return}
      if(!route.startsWith('/api/'))fail(404,'Page not found.');
      ctx=readSession(security,req.headers.cookie||'',req.socket.remoteAddress);
      if(method==='GET'&&route==='/api/session'){send(res,200,{account:ctx?{...ctx,csrf:undefined,source:undefined,sessionId:undefined}:null,csrf:ctx?.csrf||null,sitePort,setupRequired:security.prepare('SELECT count(*) n FROM admins').get().n===0});return}
      const authRoute=['/api/login','/api/enroll/start','/api/enroll/finish'].includes(route);
      if(authRoute&&method==='POST'){
        rateLimit(security,'auth:'+req.socket.remoteAddress,20);const input=await body(req);let data;
        if(route==='/api/enroll/start'){data=beginEnrollment(security,key,input);send(res,200,data);return}
        data=route==='/api/login'?login(security,key,input,req.socket.remoteAddress):finishEnrollment(security,key,input,req.socket.remoteAddress);
        send(res,200,{account:data.account,recoveryCodes:data.recoveryCodes},{'Set-Cookie':cookie(data.token)});return;
      }
      if(!ctx)fail(401,'Sign in to the Control Center.');
      if(mutation&&req.headers['x-csrf-token']!==ctx.csrf)fail(403,'Session verification failed. Refresh the Control Center.');
      if(mutation)rateLimit(security,'write:'+ctx.id,120,60000);
      let data,id;
      if(method==='POST'&&route==='/api/logout'){security.prepare('UPDATE admin_sessions SET revoked_at=? WHERE id=?').run(Date.now(),ctx.sessionId);audit(security,ctx,'admin.logout',ctx.id);send(res,200,{ok:true},{'Set-Cookie':cookie('',0)});return}
      if(method==='GET'&&route==='/api/overview')data=ops.overview(site,ctx);
      else if(method==='GET'&&route==='/api/users')data=ops.users(site,ctx,url);
      else if(method==='POST'&&(id=route.match(/^\/api\/users\/([^/]+)$/)?.[1]))data=ops.memberAction(site,security,ctx,id,await body(req));
      else if(method==='GET'&&route==='/api/reports')data=ops.reports(site,ctx,url);
      else if(method==='POST'&&(id=route.match(/^\/api\/reports\/([^/]+)$/)?.[1]))data=ops.moderate(site,security,ctx,id,await body(req));
      else if(method==='GET'&&route==='/api/messages')data=ops.messages(site,ctx,url);
      else if(method==='POST'&&(id=route.match(/^\/api\/messages\/([^/]+)$/)?.[1]))data=ops.messageAction(site,security,ctx,id,await body(req));
      else if(method==='GET'&&route==='/api/announcements')data=ops.announcements(site,ctx);
      else if(method==='POST'&&route==='/api/announcements')data=ops.saveAnnouncement(site,security,ctx,await body(req));
      else if(method==='POST'&&(id=route.match(/^\/api\/announcements\/([^/]+)$/)?.[1]))data=ops.saveAnnouncement(site,security,ctx,await body(req),id);
      else if(method==='GET'&&route==='/api/games')data=ops.games(site,ctx);
      else if(method==='POST'&&/^\/api\/games\/[a-z]+$/.test(route))data=ops.changeGame(site,security,ctx,route.split('/')[3],await body(req));
      else if(method==='GET'&&route==='/api/settings'){requirePermission(ctx,'system.manage');data={settings:ops.settings(site)}}
      else if(method==='POST'&&route==='/api/settings')data=ops.changeSettings(site,security,ctx,await body(req));
      else if(method==='GET'&&route==='/api/audit')data=ops.auditEvents(security,ctx,url);
      else if(method==='GET'&&route==='/api/staff')data=ops.staff(security,ctx);
      else if(method==='POST'&&route==='/api/invitations')data=createInvite(security,ctx,await body(req));
      else if(method==='POST'&&(id=route.match(/^\/api\/invitations\/([^/]+)$/)?.[1])){requirePermission(ctx,'admins.manage');const r=security.prepare('UPDATE admin_invites SET revoked_at=? WHERE id=? AND used_at=0 AND revoked_at=0').run(Date.now(),id);if(!r.changes)fail(404,'Active invitation not found.');audit(security,ctx,'admin.invitation.revoked',id);data={ok:true}}
      else if(method==='POST'&&(id=route.match(/^\/api\/staff\/([^/]+)$/)?.[1])){const input=await body(req);if(typeof input.disabled!=='boolean')fail(400,'Invalid access state.');revokeStaff(security,ctx,id,input.disabled);data={ok:true}}
      else if(method==='POST'&&route==='/api/sessions/revoke-others'){security.prepare('UPDATE admin_sessions SET revoked_at=? WHERE admin_id=? AND id<>? AND revoked_at=0').run(Date.now(),ctx.id,ctx.sessionId);audit(security,ctx,'admin.sessions.revoked',ctx.id);data={ok:true}}
      else if(method==='GET'&&route==='/api/system'){
        requirePermission(ctx,'system.manage');let publicSite='offline';try{const r=await fetch(`http://127.0.0.1:${sitePort}/api/health`,{signal:AbortSignal.timeout(1500)});if(r.ok&&(await r.json()).ok)publicSite='online'}catch{}
        data={version:'2.5.0',node:process.version,uptime:Math.floor(process.uptime()),publicSite,sitePort,adminPort:port,integrity:Object.values(site.prepare('PRAGMA quick_check').get())[0],migrations:site.prepare('SELECT name,applied_at FROM _memespace_migrations ORDER BY name').all(),backups:await ops.backupList(root),settings:ops.settings(site)};
      }
      else if(method==='POST'&&route==='/api/backups')data=await ops.createBackup(site,security,ctx,root);
      else fail(404,'Endpoint not found.');
      send(res,200,data);
    }catch(e){
      const status=e.status||(['AUTH_INPUT','INPUT'].includes(e.code)?400:500);
      if(status===403&&ctx)audit(security,ctx,'request.denied',String(req.url).split('?')[0],{},'denied');
      if(status===500)console.error('Control Center request failed:',e.message);
      send(res,status,{error:status===500?'This operation could not be completed. Check the admin terminal.':e.message});
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  const close=()=>new Promise(resolve=>{server.close(()=>{site.close();security.close();resolve()});server.closeAllConnections()});
  return {server,site,security,key,close,bootstrap:()=>createInvite(security,null,{},true)};
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.MEMESPACE_ADMIN_PORT||5174),sitePort=Number(process.env.MEMESPACE_PORT||5173);
  try{
    if(Number(process.versions.node.split('.')[0])<24)throw Error('Install Node.js 24 or newer.');
    const app=await createAdminServer({root,port,sitePort});
    await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve)});
    console.log(`\nMemeSpace Control Center: http://127.0.0.1:${port}/\nSeparate admin service. Keep this terminal open. Ctrl+C to stop.\n`);
    if(!app.security.prepare('SELECT count(*) n FROM admins').get().n){const invite=app.bootstrap();console.log(`FIRST OWNER SETUP\nSetup code (expires in 20 minutes):\n${invite.token}\n\nOpen the Control Center, choose Set up access, and enter this code.\nUse an authenticator app; save the recovery codes shown at the end.\n`)}
    const scheduled=async()=>{try{const list=await ops.backupList(root);if(!list.length||Date.now()-list[0].createdAt>86400000)await ops.createBackup(app.site,app.security,{id:'local-scheduler',name:'Daily backup'},root)}catch(e){console.error('Scheduled backup failed:',e.message)}};
    void scheduled();const timer=setInterval(scheduled,3600000);timer.unref();
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{clearInterval(timer);await app.close();process.exit(0)});
  }catch(e){console.error('Control Center could not start:',e.message);process.exitCode=1}
}
