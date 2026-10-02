import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {createHash,createHmac,randomBytes,randomUUID,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {dataDirectory} from '../lib/local-database.mjs';
import {hashPassword,verifyPassword,validateRegistration,normalizeIdentifier} from '../lib/local-auth.mjs';

export const cookieName='memespace_control';
export const sessionAge=8*60*60*1000, idleAge=30*60*1000;
export const roles={
  owner:{name:'System owner',permissions:['overview.view','users.view','users.suspend','users.sessions','chat.moderate','content.manage','content.publish','games.manage','security.view','admins.manage','system.manage','system.backup']},
  administrator:{name:'Administrator',permissions:['overview.view','users.view','users.suspend','users.sessions','chat.moderate','content.manage','content.publish','games.manage','security.view']},
  moderator:{name:'Moderator',permissions:['overview.view','users.view','users.suspend','chat.moderate']},
  observer:{name:'Observer',permissions:['overview.view']}
};
export function fail(status,message){throw Object.assign(new Error(message),{status})}
export const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const randomToken=()=>randomBytes(32).toString('base64url');
export function transaction(db,fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value}catch(e){db.exec('ROLLBACK');throw e}}
export function openSecurity(root){
  const dir=path.join(dataDirectory(root),'admin');mkdirSync(dir,{recursive:true,mode:0o700});
  const db=new DatabaseSync(path.join(dir,'control.sqlite'));
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, hash TEXT NOT NULL)');
  const sql=readFileSync(path.join(root,'admin/migrations/001.sql'),'utf8'),hash=digest(sql);
  transaction(db,()=>{const old=db.prepare('SELECT hash FROM migrations WHERE id=?').get('001');if(old&&old.hash!==hash)throw Error('An applied admin migration was changed.');if(!old){db.exec(sql);db.prepare('INSERT INTO migrations VALUES(?,?)').run('001',hash)}});
  const keyPath=path.join(dir,'mfa.key');let key;
  try{key=readFileSync(keyPath)}catch(e){if(e.code!=='ENOENT')throw e;if(db.prepare('SELECT count(*) n FROM admins').get().n)throw Error('Admin MFA key is missing. Restore data/admin/mfa.key from your private backup.');try{writeFileSync(keyPath,randomBytes(32),{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST')throw e}key=readFileSync(keyPath)}
  if(key.length!==32)throw Error('Invalid admin MFA key.');
  if(process.platform!=='win32'){chmodSync(dir,0o700);chmodSync(path.join(dir,'control.sqlite'),0o600);chmodSync(keyPath,0o600)}
  return {db,key};
}
export function audit(db,ctx,action,objectId='',details={},result='success'){
  db.prepare('INSERT INTO audit_events(at,actor_id,actor_name,session_id,action,object_id,result,source,details) VALUES(?,?,?,?,?,?,?,?,?)').run(Date.now(),ctx?.id||'anonymous',ctx?.name||'Local visitor',ctx?.sessionId||'',action,String(objectId),result,ctx?.source||'loopback',JSON.stringify(details));
}
export function requirePermission(ctx,permission){if(!ctx)fail(401,'Sign in to the Control Center.');if(!roles[ctx.role]?.permissions.includes(permission))fail(403,'Your role does not have permission for this action.')}
export function safeAdmin(row){return {id:row.id,email:row.email,name:row.name,role:row.role,roleName:roles[row.role].name,permissions:roles[row.role].permissions,createdAt:row.created_at,lastLoginAt:row.last_login_at,disabledAt:row.disabled_at}}
function encrypt(secret,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64url')).join('.')}
function decrypt(value,key){const [iv,tag,data]=value.split('.').map(b=>Buffer.from(b,'base64url'));const cipher=createDecipheriv('aes-256-gcm',key,iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8')}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buffer){let bits=0,value=0,out='';for(const byte of buffer){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out}
function fromBase32(value){let bits=0,acc=0,bytes=[];for(const c of value){const n=alphabet.indexOf(c);if(n<0)throw Error('Invalid authenticator key');acc=(acc<<5)|n;bits+=5;if(bits>=8){bytes.push((acc>>>(bits-8))&255);bits-=8}}return Buffer.from(bytes)}
// RFC 6238 / RFC 4226: 30-second time step, six digits, HMAC-SHA1.
export function totp(secret,time=Date.now(),digits=6){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(time/30000)));const h=createHmac('sha1',fromBase32(secret)).update(counter).digest(),offset=h[h.length-1]&15;return String((h.readUInt32BE(offset)&0x7fffffff)%10**digits).padStart(digits,'0')}
export function verifyTotp(secret,code,lastStep=-1,now=Date.now()){
  if(typeof code!=='string'||!/^\d{6}$/.test(code))return -1;
  for(const drift of [0,-1,1]){const time=now+drift*30000,step=Math.floor(time/30000);if(step>lastStep&&timingSafeEqual(Buffer.from(totp(secret,time)),Buffer.from(code)))return step}return -1;
}
export function rateLimit(db,bucket,max=10,window=15*60*1000){
  const now=Date.now();db.prepare('INSERT INTO admin_limits(bucket,hits,reset_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN reset_at<=? THEN 1 ELSE hits+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END').run(bucket,now+window,now,now);
  if(db.prepare('SELECT hits FROM admin_limits WHERE bucket=?').get(bucket).hits>max)fail(429,'Too many attempts. Wait 15 minutes before trying again.');
}
export function createInvite(db,ctx,{role='moderator',email=''}={},bootstrap=false){
  if(bootstrap){if(db.prepare('SELECT count(*) n FROM admins').get().n)fail(409,'The first owner is already enrolled.');role='owner'}else{requirePermission(ctx,'admins.manage');if(!Object.hasOwn(roles,role)||role==='owner')fail(400,'Choose administrator, moderator or observer.');email=normalizeIdentifier(email);if(!/^[^@\s]+@[^@\s]+$/.test(email))fail(400,'Enter the staff email address.');if(db.prepare('SELECT id FROM admins WHERE email=?').get(email))fail(409,'That staff member already exists.')}
  return transaction(db,()=>{
    const now=Date.now(),token=randomToken(),id=randomUUID(),expiresAt=now+(bootstrap?20:60)*60000;
    if(bootstrap)db.prepare("UPDATE admin_invites SET revoked_at=? WHERE role='owner' AND used_at=0").run(now);
    db.prepare('INSERT INTO admin_invites(id,token_hash,role,email,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').run(id,digest(token),role,email,ctx?.id||'local-console',now,expiresAt);
    audit(db,ctx||{id:'local-console',name:'Local console'},'admin.invitation.created',id,{role,email,expiresAt});return {id,token,role,email,expiresAt};
  });
}
export function beginEnrollment(db,key,input){
  const invite=db.prepare('SELECT * FROM admin_invites WHERE token_hash=? AND expires_at>? AND used_at=0 AND revoked_at=0').get(digest(input.invitation),Date.now());
  if(!invite)fail(400,'This setup code is invalid or expired.');
  const {identifier,name,displayName,password}=validateRegistration(input);void name;
  if(invite.email&&invite.email!==identifier)fail(400,'Use the email address on your staff invitation.');
  if(db.prepare('SELECT id FROM admins WHERE email=?').get(identifier))fail(409,'That staff identity already exists.');
  const secret=base32(randomBytes(20)),token=randomToken(),passwordHash=hashPassword(password).passwordHash;
  transaction(db,()=>{db.prepare('DELETE FROM admin_enrollments WHERE invite_id=? OR expires_at<?').run(invite.id,Date.now());db.prepare('INSERT INTO admin_enrollments(token_hash,invite_id,email,name,password_hash,mfa_secret,expires_at) VALUES(?,?,?,?,?,?,?)').run(digest(token),invite.id,identifier,displayName,passwordHash,encrypt(secret,key),Date.now()+10*60000)});
  return {enrollmentToken:token,secret,email:identifier,role:roles[invite.role].name};
}
function session(db,id){const now=Date.now(),token=randomToken(),sessionId=randomUUID();db.prepare('INSERT INTO admin_sessions(id,token_hash,admin_id,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?)').run(sessionId,digest(token),id,now,now,now+sessionAge);return {token,sessionId}}
export function finishEnrollment(db,key,input,source='loopback'){
  const row=db.prepare('SELECT e.*,i.role,i.email AS invited_email,i.used_at,i.revoked_at,i.expires_at AS invite_expires FROM admin_enrollments e JOIN admin_invites i ON i.id=e.invite_id WHERE e.token_hash=?').get(digest(input.enrollmentToken));
  if(!row||row.expires_at<=Date.now()||row.invite_expires<=Date.now()||row.used_at||row.revoked_at||row.attempts>=5)fail(400,'Enrollment expired. Start again with a valid invitation.');
  db.prepare('UPDATE admin_enrollments SET attempts=attempts+1 WHERE token_hash=?').run(row.token_hash);
  const step=verifyTotp(decrypt(row.mfa_secret,key),input.code);if(step<0)fail(400,'The authenticator code is incorrect. Check your device clock.');
  return transaction(db,()=>{
    if(row.role==='owner'&&db.prepare('SELECT count(*) n FROM admins').get().n)fail(409,'The first owner is already enrolled.');
    const id=randomUUID(),now=Date.now();
    db.prepare('INSERT INTO admins(id,email,name,password_hash,mfa_secret,mfa_step,role,created_at,last_login_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,row.email,row.name,row.password_hash,row.mfa_secret,step,row.role,now,now);
    db.prepare('UPDATE admin_invites SET used_at=? WHERE id=?').run(now,row.invite_id);db.prepare('DELETE FROM admin_enrollments WHERE invite_id=?').run(row.invite_id);
    const codes=Array.from({length:8},()=>randomBytes(10).toString('hex').match(/.{1,5}/g).join('-'));
    for(const code of codes)db.prepare('INSERT INTO admin_recovery(admin_id,code_hash) VALUES(?,?)').run(id,digest(code));
    const issued=session(db,id);audit(db,{id,name:row.name,sessionId:issued.sessionId,source},'admin.enrolled',id,{role:row.role});return {...issued,account:safeAdmin(db.prepare('SELECT * FROM admins WHERE id=?').get(id)),recoveryCodes:codes};
  });
}
const dummyHash=hashPassword(randomToken()).passwordHash;
export function login(db,key,input,source='loopback'){
  let email;try{email=normalizeIdentifier(input.email)}catch{email='invalid'}
  const row=db.prepare('SELECT * FROM admins WHERE email=?').get(email),now=Date.now();
  const valid=verifyPassword(input.password,row?.password_hash||dummyHash);
  let step=-1,recovery=null;
  if(row&&valid&&!row.disabled_at&&row.locked_until<=now){step=verifyTotp(decrypt(row.mfa_secret,key),input.code,row.mfa_step);if(step<0&&typeof input.code==='string'&&/^[a-f0-9]{5}(-[a-f0-9]{5}){3}$/.test(input.code))recovery=db.prepare('SELECT code_hash FROM admin_recovery WHERE admin_id=? AND code_hash=? AND used_at=0').get(row.id,digest(input.code));}
  if(!row||!valid||row.disabled_at||row.locked_until>now||(step<0&&!recovery)){
    if(row&&row.locked_until<=now){const tries=(row.locked_until?0:row.failed_attempts)+1;db.prepare('UPDATE admins SET failed_attempts=?,locked_until=? WHERE id=?').run(tries,tries>=5?now+15*60000:0,row.id)}
    audit(db,{source},'admin.login',row?.id||'unknown',{},'denied');fail(401,'Email, password or authentication code is incorrect.');
  }
  return transaction(db,()=>{
    if(recovery)db.prepare('UPDATE admin_recovery SET used_at=? WHERE code_hash=? AND used_at=0').run(now,recovery.code_hash);
    db.prepare('UPDATE admins SET failed_attempts=0,locked_until=0,last_login_at=?,mfa_step=? WHERE id=?').run(now,step>=0?step:row.mfa_step,row.id);
    const issued=session(db,row.id);audit(db,{id:row.id,name:row.name,sessionId:issued.sessionId,source},'admin.login',row.id,{method:recovery?'recovery code':'authenticator'});return {...issued,account:safeAdmin(row)};
  });
}
export function readSession(db,cookie='',source='loopback'){
  const matches=cookie.split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));if(matches.length!==1)return null;
  const token=matches[0].slice(cookieName.length+1);if(!/^[\w-]{43}$/.test(token))return null;
  const row=db.prepare('SELECT a.*,s.id AS session_id,s.last_seen_at,s.expires_at,s.revoked_at FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=?').get(digest(token));
  const now=Date.now();if(!row||row.disabled_at||row.revoked_at||row.expires_at<=now||row.last_seen_at+idleAge<=now)return null;
  db.prepare('UPDATE admin_sessions SET last_seen_at=? WHERE id=?').run(now,row.session_id);return {...safeAdmin(row),sessionId:row.session_id,csrf:digest('csrf:'+token),source};
}
export function revokeStaff(db,ctx,id,disabled){
  requirePermission(ctx,'admins.manage');const target=db.prepare('SELECT * FROM admins WHERE id=?').get(id);if(!target)fail(404,'Staff member not found.');if(target.role==='owner'||id===ctx.id)fail(400,'The system owner and current account cannot be disabled here.');
  transaction(db,()=>{db.prepare('UPDATE admins SET disabled_at=? WHERE id=?').run(disabled?Date.now():0,id);db.prepare('UPDATE admin_sessions SET revoked_at=? WHERE admin_id=? AND revoked_at=0').run(Date.now(),id);audit(db,ctx,disabled?'admin.disabled':'admin.enabled',id)});
}
