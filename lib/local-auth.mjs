import {createHash,randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
import {localRequest,readLocalSession} from './local-session.mjs';

export const authCookie='memespace_session';
export const sessionMaxAge=30*24*60*60;
export const sessionIdleAge=7*24*60*60;
const touchInterval=5*60*1000;
const lockDuration=15*60*1000;
const scryptOptions={N:16384,r:8,p:1,maxmem:32*1024*1024};

function error(code,message=code){const failure=new Error(message);failure.code=code;return failure;}
function stringValue(value){return typeof value==='string'?value:'';}
function rowAccount(row){
  if(!row)return null;
  return {
    userId:row.user_id,
    email:row.email,
    displayName:row.display_name,
    createdAt:Number(row.created_at),
    updatedAt:Number(row.updated_at),
    lastLoginAt:Number(row.last_login_at||0),
    needsPasswordSetup:String(row.password_hash||'').startsWith('legacy_unset$')
  };
}
function accountRow(db,userId){return db.prepare('SELECT * FROM accounts WHERE user_id=?').get(userId)||null;}

export function normalizeIdentifier(value){
  const normalized=stringValue(value).normalize('NFKC').trim().toLowerCase();
  if(normalized.length<3||normalized.length>254||/[\u0000-\u001f\u007f\s]/.test(normalized))throw error('AUTH_INPUT','Enter a valid email or identifier.');
  return normalized;
}

function validatePassword(password){
  if(typeof password!=='string'||password.length<12||password.length>128||/[\u0000-\u001f\u007f]/.test(password)||!(/\S/.test(password)))throw error('AUTH_INPUT','Password must be 12–128 characters.');
  return password;
}

export function validateRegistration(input={}){
  if(!input||typeof input!=='object')input={};
  const identifier=normalizeIdentifier(input.identifier??input.email);
  if(!/^[^@\s]+@[^@\s]+$/.test(identifier))throw error('AUTH_INPUT','Enter a valid email or identifier.');
  const displayName=stringValue(input.displayName??input.name).normalize('NFKC').trim();
  if(displayName.length<1||displayName.length>80||/[\u0000-\u001f\u007f]/.test(displayName))throw error('AUTH_INPUT','Enter a display name.');
  return {identifier,displayName,password:validatePassword(input.password)};
}

export function hashPassword(password){
  validatePassword(password);
  const salt= randomBytes(16).toString('base64url');
  const digest=scryptSync(password,Buffer.from(salt,'base64url'),64,scryptOptions).toString('base64url');
  const passwordHash=`scrypt$${scryptOptions.N}$${scryptOptions.r}$${scryptOptions.p}$${salt}$${digest}`;
  return {passwordHash,passwordSalt:salt,hash:passwordHash,salt};
}

export function verifyPassword(password,encoded){
  if(typeof password!=='string'||typeof encoded!=='string'||encoded.startsWith('legacy_unset$'))return false;
  const parts=encoded.split('$');
  if(parts.length!==6||parts[0]!=='scrypt')return false;
  const [,n,r,p,salt,digest]=parts;
  if(!/^\d+$/.test(n)||!/^\d+$/.test(r)||!/^\d+$/.test(p)||!salt||!digest)return false;
  try{
    const expected=Buffer.from(digest,'base64url');
    const actual=scryptSync(password,Buffer.from(salt,'base64url'),expected.length,{N:Number(n),r:Number(r),p:Number(p),maxmem:32*1024*1024});
    return actual.length===expected.length&&timingSafeEqual(actual,expected);
  }catch{return false;}
}

export function createAccount(db,input){
  const {identifier,displayName,password}=validateRegistration(input);
  if(db.prepare('SELECT user_id FROM accounts WHERE email=?').get(identifier))throw error('DUPLICATE','That identifier is already in use.');
  const userId='usr_'+randomBytes(18).toString('base64url');
  const {passwordHash,passwordSalt}=hashPassword(password);
  const now=Date.now();
  try{
    db.exec('BEGIN IMMEDIATE');
    db.prepare('INSERT INTO accounts(user_id,email,password_hash,password_salt,display_name,created_at,updated_at,last_login_at,failed_attempts,locked_until,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(userId,identifier,passwordHash,passwordSalt,displayName,now,now,0,0,0,0);
    db.prepare('INSERT OR IGNORE INTO profiles(user_id,name,bio,updated_at) VALUES(?,?,?,?)').run(userId,displayName,'',now);
    db.exec('COMMIT');
  }catch(cause){try{db.exec('ROLLBACK')}catch{};if(String(cause?.message||'').toLowerCase().includes('unique'))throw error('DUPLICATE','That identifier is already in use.');throw cause;}
  return rowAccount(accountRow(db,userId));
}

export function authenticateAccount(db,identifier,password){
  let normalized;
  try{normalized=normalizeIdentifier(identifier)}catch{throw error('AUTH_INVALID','Invalid sign-in.');}
  const row=db.prepare('SELECT * FROM accounts WHERE email=?').get(normalized);
  if(!row||row.deleted_at||row.suspended_at||Number(row.locked_until)>Date.now())throw error('AUTH_INVALID','Invalid sign-in.');
  if(!verifyPassword(password,row.password_hash)){
    const next=(row.locked_until?0:Number(row.failed_attempts||0))+1;
    const lockedUntil=next>=5?Date.now()+lockDuration:0;
    db.prepare('UPDATE accounts SET failed_attempts=?,locked_until=?,updated_at=? WHERE user_id=?').run(next,lockedUntil,Date.now(),row.user_id);
    throw error('AUTH_INVALID','Invalid sign-in.');
  }
  const now=Date.now();
  db.prepare('UPDATE accounts SET failed_attempts=0,locked_until=0,last_login_at=?,updated_at=? WHERE user_id=?').run(now,now,row.user_id);
  return rowAccount(accountRow(db,row.user_id));
}

function tokenDigest(token){return createHash('sha256').update(token).digest('hex');}
function cookieValue(headers,name){
  const raw=headers?.get?.('cookie')||'';
  const matches=raw.split(';').map(value=>value.trim()).filter(value=>value.startsWith(name+'='));
  return matches.length===1?matches[0].slice(name.length+1):null;
}

export function issueSession(db,userId,label='Local browser'){
  const row=accountRow(db,userId);
  if(!row||row.deleted_at||row.suspended_at)throw error('AUTH_INVALID','Invalid account.');
  const token=randomBytes(32).toString('base64url');
  const id=randomUUID();
  const now=Date.now();
  const expiresAt=now+sessionMaxAge*1000;
  const safeLabel=stringValue(label).normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80)||'Local browser';
  db.prepare('INSERT INTO sessions(id,token_hash,user_id,label,created_at,last_seen_at,expires_at,revoked_at) VALUES(?,?,?,?,?,?,?,?)').run(id,tokenDigest(token),userId,safeLabel,now,now,expiresAt,0);
  return {id,token,tokenHash:tokenDigest(token),userId,createdAt:now,lastSeenAt:now,expiresAt};
}

function authFromSession(db,token){
  if(!token||!/^[A-Za-z0-9_-]{40,}$/.test(token))return null;
  const row=db.prepare('SELECT s.*,a.user_id AS account_user_id,a.email,a.password_hash,a.password_salt,a.display_name,a.created_at AS account_created_at,a.updated_at AS account_updated_at,a.last_login_at,a.failed_attempts,a.locked_until,a.deleted_at,a.suspended_at FROM sessions s JOIN accounts a ON a.user_id=s.user_id WHERE s.token_hash=?').get(tokenDigest(token));
  if(!row)return null;
  const now=Date.now();
  if(row.revoked_at||row.deleted_at||row.suspended_at||Number(row.expires_at)<=now||Number(row.last_seen_at)+sessionIdleAge*1000<=now){
    if(!row.revoked_at)db.prepare('UPDATE sessions SET revoked_at=? WHERE id=?').run(now,row.id);
    return null;
  }
  if(now-Number(row.last_seen_at)>=touchInterval)db.prepare('UPDATE sessions SET last_seen_at=? WHERE id=?').run(now,row.id);
  return {userId:row.user_id,sessionId:row.id,legacy:false,account:rowAccount({user_id:row.account_user_id,email:row.email,password_hash:row.password_hash,display_name:row.display_name,created_at:row.account_created_at,updated_at:row.account_updated_at,last_login_at:row.last_login_at})};
}

export function readAuthSession(db,headers){
  if(!localRequest(headers))return null;
  const token=cookieValue(headers,authCookie);
  if(token)return authFromSession(db,token);
  const legacy=readLocalSession(headers);
  if(!legacy)return null;
  const account=accountRow(db,legacy.userId);
  return account&&!account.deleted_at&&!account.suspended_at&&!account.legacy_claimed_at&&account.password_hash.startsWith('legacy_unset$')?{userId:legacy.userId,sessionId:null,legacy:true,account:rowAccount(account)}:null;
}

export function revokeSession(db,sessionId,userId){
  if(!sessionId||!userId)return false;
  const result=db.prepare('UPDATE sessions SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at=0').run(Date.now(),sessionId,userId);
  return Number(result.changes)>0;
}

export function revokeOtherSessions(db,userId,currentSessionId=null){
  const result=db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at=0 AND (? IS NULL OR id<>?)').run(Date.now(),userId,currentSessionId,currentSessionId);
  return Number(result.changes);
}

export function listSessions(db,userId,currentSessionId=null){
  return db.prepare('SELECT id,label,created_at,last_seen_at,expires_at FROM sessions WHERE user_id=? AND revoked_at=0 AND expires_at>? AND last_seen_at>? ORDER BY last_seen_at DESC').all(userId,Date.now(),Date.now()-sessionIdleAge*1000).map(row=>({id:row.id,label:row.label,createdAt:Number(row.created_at),lastSeenAt:Number(row.last_seen_at),expiresAt:Number(row.expires_at),current:row.id===currentSessionId}));
}

export function changePassword(db,userId,currentPassword,newPassword,options={}){
  validatePassword(newPassword);
  const row=accountRow(db,userId);
  if(!row||row.deleted_at||row.suspended_at)throw error('AUTH_INVALID','Invalid account.');
  const legacy=String(row.password_hash).startsWith('legacy_unset$');
  if(!(legacy&&options.legacy===true)&&!verifyPassword(currentPassword,row.password_hash))throw error('AUTH_INVALID','Current password is incorrect.');
  const {passwordHash,passwordSalt}=hashPassword(newPassword);const now=Date.now();
  db.prepare('UPDATE accounts SET password_hash=?,password_salt=?,failed_attempts=0,locked_until=0,updated_at=? WHERE user_id=?').run(passwordHash,passwordSalt,now,userId);
  revokeOtherSessions(db,userId,options.currentSessionId??null);
  return rowAccount(accountRow(db,userId));
}

export function exportAccount(db,userId){
  const account=accountRow(db,userId);
  if(!account||account.deleted_at)throw error('AUTH_INVALID','Invalid account.');
  return {
    exportedAt:new Date().toISOString(),
    account:rowAccount(account),
    profile:db.prepare('SELECT user_id,name,bio,updated_at FROM profiles WHERE user_id=?').get(userId)||null,
    messages:db.prepare('SELECT id,user_id,text,channel,reply_to,edited_at,created_at FROM messages WHERE user_id=? ORDER BY created_at ASC').all(userId),
    likes:db.prepare('SELECT id,user_id,message_id FROM likes WHERE user_id=?').all(userId),
    reports:db.prepare('SELECT id,user_id,message_id,created_at FROM reports WHERE user_id=?').all(userId),
    savedItems:db.prepare('SELECT id,user_id,kind,item_key,payload,updated_at FROM saved_items WHERE user_id=? ORDER BY updated_at ASC').all(userId)
  };
}

export function deleteAccount(db,userId,confirmation,legacyConfirmation='',currentPassword=''){
  if(confirmation!=='DELETE MY ACCOUNT')throw error('CONFIRMATION','Type DELETE MY ACCOUNT to continue.');
  if(userId==='local_seedy'&&legacyConfirmation!=='DELETE LEGACY OWNER DATA')throw error('CONFIRMATION','Type DELETE LEGACY OWNER DATA to continue.');
  const row=accountRow(db,userId);if(!row||row.deleted_at||row.suspended_at)throw error('AUTH_INVALID','Invalid account.');
  if(!verifyPassword(currentPassword,row.password_hash))throw error('AUTH_INVALID','Current password is incorrect.');
  const now=Date.now();
  db.exec('BEGIN IMMEDIATE');
  try{
    for(const table of ['messages','likes','reports','saved_items','profiles'])db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(userId);
    db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at=0').run(now,userId);
    db.prepare('UPDATE accounts SET email=?,password_hash=?,password_salt=?,display_name=?,deleted_at=?,updated_at=? WHERE user_id=?').run(`deleted+${userId}@localhost`,'deleted$'+randomBytes(12).toString('hex'),'deleted', '[deleted]',now,now,userId);
    db.exec('COMMIT');
  }catch(cause){try{db.exec('ROLLBACK')}catch{};throw cause;}
  return true;
}

export function accountSummary(db,userId){return rowAccount(accountRow(db,userId));}
