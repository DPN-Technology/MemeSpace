import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openDatabase} from '../lib/local-database.mjs';
import {authenticateAccount,changePassword,createAccount,deleteAccount,exportAccount,hashPassword,issueSession,listSessions,normalizeIdentifier,readAuthSession,revokeOtherSessions,revokeSession,validateRegistration,verifyPassword} from '../lib/local-auth.mjs';

const source=fileURLToPath(new URL('../',import.meta.url));
const priorMode=process.env.MEMESPACE_LOCAL_MODE;
const priorPort=process.env.MEMESPACE_PORT;
process.env.MEMESPACE_LOCAL_MODE='1';
process.env.MEMESPACE_PORT='5173';
function fixture(){const root=mkdtempSync(path.join(tmpdir(),'memespace-auth-'));cpSync(path.join(source,'drizzle'),path.join(root,'drizzle'),{recursive:true});return root;}
function headers(cookie=''){return new Headers({host:'localhost:5173',cookie});}
function expectCode(fn,code){assert.throws(fn,error=>error?.code===code||error?.message===code);}
test.after(()=>{if(priorMode===undefined)delete process.env.MEMESPACE_LOCAL_MODE;else process.env.MEMESPACE_LOCAL_MODE=priorMode;if(priorPort===undefined)delete process.env.MEMESPACE_PORT;else process.env.MEMESPACE_PORT=priorPort;});

test('normalizes identifiers and validates account inputs',()=>{
 assert.equal(normalizeIdentifier('  Diesel@LocalHost '),'diesel@localhost');
 assert.deepEqual(validateRegistration({identifier:' Diesel@LocalHost ',displayName:' Diesel ',password:'twelve-character-password'}),{identifier:'diesel@localhost',displayName:'Diesel',password:'twelve-character-password'});
 expectCode(()=>validateRegistration({identifier:'bad address',displayName:'Diesel',password:'twelve-character-password'}),'AUTH_INPUT');
 expectCode(()=>validateRegistration({identifier:'diesel@localhost',displayName:'Diesel',password:'short'}),'AUTH_INPUT');
});

test('password hashes use independent salts and verify safely',()=>{
 const first=hashPassword('twelve-character-password');
 const second=hashPassword('twelve-character-password');
 assert.notEqual(first.passwordHash,second.passwordHash);
 assert.notEqual(first.passwordSalt,second.passwordSalt);
 assert.equal(verifyPassword('twelve-character-password',first.passwordHash),true);
 assert.equal(verifyPassword('wrong-password',first.passwordHash),false);
 assert.equal(verifyPassword('twelve-character-password','legacy_unset$random'),false);
});

test('account creation rejects normalized duplicates and locks repeated failures',()=>{
 const root=fixture();let db;
 try{
  db=openDatabase(root);
  const account=createAccount(db,{identifier:'Diesel@LocalHost',displayName:'Diesel',password:'twelve-character-password'});
  assert.equal(account.email,'diesel@localhost');
  expectCode(()=>createAccount(db,{identifier:' diesel@localhost ',displayName:'Other',password:'another-valid-password'}),'DUPLICATE');
  for(let i=0;i<5;i++)expectCode(()=>authenticateAccount(db,'DIESEL@LOCALHOST','wrong-password'),'AUTH_INVALID');
  expectCode(()=>authenticateAccount(db,'diesel@localhost','twelve-character-password'),'AUTH_INVALID');
  const row=db.prepare('SELECT failed_attempts,locked_until FROM accounts WHERE user_id=?').get(account.userId);
  assert.equal(row.failed_attempts,5);assert.ok(row.locked_until>Date.now());
 }finally{db?.close();rmSync(root,{recursive:true,force:true})}
});

test('sessions are opaque, owner-scoped, touchable, and revocable',()=>{
 const root=fixture();let db;
 try{
  db=openDatabase(root);const account=createAccount(db,{identifier:'diesel@localhost',displayName:'Diesel',password:'twelve-character-password'});
  const first=issueSession(db,account.userId,'Laptop');const second=issueSession(db,account.userId,'Phone');
  assert.match(first.token,/^[A-Za-z0-9_-]{40,}$/);assert.notEqual(first.token,first.tokenHash);
  const resolved=readAuthSession(db,headers(`memespace_session=${first.token}`));
  assert.equal(resolved.sessionId,first.id);assert.equal(resolved.account.email,'diesel@localhost');assert.equal(resolved.legacy,false);
  assert.equal(listSessions(db,account.userId,first.id).find(row=>row.id===first.id).current,true);
  revokeOtherSessions(db,account.userId,first.id);assert.equal(listSessions(db,account.userId,first.id).length,1);
  assert.equal(readAuthSession(db,headers(`memespace_session=${second.token}`)),null);
  revokeSession(db,first.id,account.userId);assert.equal(readAuthSession(db,headers(`memespace_session=${first.token}`)),null);
 }finally{db?.close();rmSync(root,{recursive:true,force:true})}
});

test('legacy cookie resolves only the migrated owner until initial password claim',()=>{
 const root=fixture();let db;
 try{
  db=openDatabase(root);
  const legacyExpiry=String(Math.floor(Date.now()/1000)+3600);
  // The signature is created through the compatibility route in integration tests; this unit test checks the account marker contract.
  const account=db.prepare('SELECT user_id,password_hash FROM accounts WHERE user_id=?').get('local_seedy');
  assert.equal(account.user_id,'local_seedy');assert.match(account.password_hash,/^legacy_unset\$/);
  assert.equal(readAuthSession(db,headers(`memespace_local_session=${legacyExpiry}.invalid`)),null);
 }finally{db?.close();rmSync(root,{recursive:true,force:true})}
});

test('password change revokes other sessions and export excludes secrets',()=>{
 const root=fixture();let db;
 try{
  db=openDatabase(root);const account=createAccount(db,{identifier:'diesel@localhost',displayName:'Diesel',password:'twelve-character-password'});
  const current=issueSession(db,account.userId,'Laptop');const other=issueSession(db,account.userId,'Phone');
  const changed=changePassword(db,account.userId,'twelve-character-password','new-valid-password',{currentSessionId:current.id});
  assert.equal(changed.email,'diesel@localhost');assert.equal(listSessions(db,account.userId,current.id).length,1);
  assert.equal(authenticateAccount(db,'diesel@localhost','new-valid-password').email,'diesel@localhost');
  const dump=exportAccount(db,account.userId);const text=JSON.stringify(dump);
  assert.ok(dump.account);assert.equal('passwordHash' in dump.account,false);assert.equal('passwordSalt' in dump.account,false);assert.equal(text.includes(current.token),false);assert.equal(text.includes(other.token),false);
 }finally{db?.close();rmSync(root,{recursive:true,force:true})}
});

test('deletion requires ownership confirmations and removes only the target account data',()=>{
 const root=fixture();let db;
 try{
  db=openDatabase(root);const one=createAccount(db,{identifier:'one@localhost',displayName:'One',password:'one-valid-password'});const two=createAccount(db,{identifier:'two@localhost',displayName:'Two',password:'two-valid-password'});
  db.prepare('INSERT INTO messages(id,user_id,text,channel,reply_to,edited_at,created_at) VALUES(?,?,?,?,?,?,?)').run('m1',one.userId,'one','general',null,0,Date.now());
  db.prepare('INSERT INTO messages(id,user_id,text,channel,reply_to,edited_at,created_at) VALUES(?,?,?,?,?,?,?)').run('m2',two.userId,'two','general',null,0,Date.now());
  expectCode(()=>deleteAccount(db,one.userId,'wrong'),'CONFIRMATION');
  expectCode(()=>deleteAccount(db,one.userId,'DELETE MY ACCOUNT','','wrong-password'),'AUTH_INVALID');
  assert.equal(deleteAccount(db,one.userId,'DELETE MY ACCOUNT','','one-valid-password'),true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id=?').get(one.userId).n,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id=?').get(two.userId).n,1);
  expectCode(()=>authenticateAccount(db,'one@localhost','one-valid-password'),'AUTH_INVALID');
 }finally{db?.close();rmSync(root,{recursive:true,force:true})}
});
