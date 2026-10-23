import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {allowPublicRegistration,rateLimitAuth} from '../lib/auth-abuse.mjs';
import {createAccountAsync,authenticateAccountAsync,hashPasswordAsync,verifyPasswordAsync} from '../lib/local-auth.mjs';

test('public signups require explicit externally authenticated beta',()=>{
  assert.equal(allowPublicRegistration({}),true);
  assert.equal(allowPublicRegistration({MEMESPACE_PUBLIC_ORIGIN:'https://stage.example.org'}),false);
  assert.equal(allowPublicRegistration({MEMESPACE_PUBLIC_ORIGIN:'https://stage.example.org',MEMESPACE_LAUNCH_SCOPE:'beta'}),false);
  assert.equal(allowPublicRegistration({MEMESPACE_PUBLIC_ORIGIN:'https://stage.example.org',MEMESPACE_LAUNCH_SCOPE:'beta',MEMESPACE_REGISTRATION_GATE:'external'}),true);
});
test('persistent request quotas limit repeated identifiers and include retry delay',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    for(let n=0;n<3;n++)rateLimitAuth(db,'register','u@example.org',10000);
    assert.throws(()=>rateLimitAuth(db,'register','U@EXAMPLE.ORG',10001),e=>e.code==='AUTH_LIMIT'&&e.retryAfter>0);
    rateLimitAuth(db,'register','different@example.org',10001);
    rateLimitAuth(db,'register','u@example.org',10000+900001);
  }finally{db.close()}
});
test('async scrypt preserves existing member password format',async()=>{
  const hash=await hashPasswordAsync('long-valid-password-2026');
  assert.equal(await verifyPasswordAsync('long-valid-password-2026',hash.passwordHash),true);
  assert.equal(await verifyPasswordAsync('incorrect',hash.passwordHash),false);
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE accounts(user_id TEXT PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,password_salt TEXT,display_name TEXT,created_at INTEGER,updated_at INTEGER,last_login_at INTEGER,failed_attempts INTEGER DEFAULT 0,locked_until INTEGER DEFAULT 0,deleted_at INTEGER DEFAULT 0,suspended_at INTEGER DEFAULT 0);CREATE TABLE profiles(user_id TEXT PRIMARY KEY,name TEXT,bio TEXT,updated_at INTEGER)');
  try{
    const created=await createAccountAsync(db,{identifier:'user@example.org',displayName:'Beta Tester',password:'long-valid-password-2026'});
    assert.equal((await authenticateAccountAsync(db,'user@example.org','long-valid-password-2026')).userId,created.userId);
    await assert.rejects(authenticateAccountAsync(db,'missing@example.org','wrong'),e=>e.code==='AUTH_INVALID');
    await assert.rejects(authenticateAccountAsync(db,'user@example.org','wrong'),e=>e.code==='AUTH_INVALID');
  }finally{db.close()}
});
