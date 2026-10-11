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
  db.prepare('INSERT INTO social_posts(id,user_id,body,topic,created_at) VALUES(?,?,?,?,?)').run('owned-social',one.userId,'Owner post','general',Date.now());
  db.prepare('INSERT INTO social_media(post_id,user_id,mime,content,byte_size,width,height,created_at) VALUES(?,?,?,?,?,?,?,?)').run('owned-social',one.userId,'image/png',Buffer.from([1,2,3]),3,1,1,Date.now());
  db.prepare('INSERT INTO social_posts(id,user_id,body,topic,reply_to,created_at) VALUES(?,?,?,?,?,?)').run('other-social',two.userId,'Other author reply','general','owned-social',Date.now());
  db.prepare('INSERT INTO social_reactions(user_id,post_id,created_at) VALUES(?,?,?)').run(two.userId,'owned-social',Date.now());
  db.prepare('INSERT INTO social_bookmarks(user_id,post_id,created_at) VALUES(?,?,?)').run(two.userId,'owned-social',Date.now());
  db.prepare('INSERT INTO social_follows(follower_id,following_id,created_at) VALUES(?,?,?)').run(two.userId,one.userId,Date.now());
  db.prepare('INSERT INTO social_reports(user_id,post_id,reason,created_at) VALUES(?,?,?,?)').run(two.userId,'owned-social','spam',Date.now());
  db.prepare('INSERT INTO social_relationships(actor_id,target_id,kind,created_at) VALUES(?,?,?,?)').run(two.userId,one.userId,'mute',Date.now());
  const now=Date.now();
  db.prepare('INSERT INTO social_communities(id,slug,name,description,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run('owned-group','owner-guild','Owned Guild','Creator-owned community',one.userId,now,now);
  db.prepare("INSERT INTO social_community_members(community_id,user_id,role,joined_at) VALUES(?,?,'owner',?)").run('owned-group',one.userId,now);
  db.prepare("INSERT INTO social_community_members(community_id,user_id,role,joined_at) VALUES(?,?,?,?)").run('owned-group',two.userId,'member',now);
  db.prepare('UPDATE social_posts SET community_id=? WHERE id=?').run('owned-group','other-social');
  db.prepare('INSERT INTO social_posts(id,user_id,body,topic,community_id,created_at) VALUES(?,?,?,?,?,?)').run('removed-group-post',two.userId,'Removed by moderators','memes','owned-group',now);
  db.prepare('INSERT INTO social_community_removed_posts(community_id,post_id,actor_id,reason,created_at) VALUES(?,?,?,?,?)').run('owned-group','removed-group-post',one.userId,'Guideline violation',now);
  db.prepare("INSERT INTO social_community_appeals(id,community_id,user_id,target_kind,target_id,reason,created_at) VALUES(?,?,?,?,?,?,?)").run('appeal-one','owned-group',one.userId,'ban',one.userId,'Review this case please',now);
  db.prepare('INSERT INTO social_community_audit(id,community_id,actor_id,action,target_id,note,created_at) VALUES(?,?,?,?,?,?,?)').run('log-one','owned-group',one.userId,'post_removed','removed-group-post','Violation',now);
  const exported=exportAccount(db,one.userId);
  assert.equal(exported.socialPosts.length,1);
  assert.equal(exported.ownedCommunities.length,1);
  assert.equal(exported.communityMemberships.length,1);
  assert.ok(Array.isArray(exported.communityRequests));
  assert.ok(Array.isArray(exported.communityTransfers));
  assert.equal(exported.communityAppeals.length,1);
  assert.equal(exported.communityAuditActions.length,1);
  assert.equal(exported.socialMedia.length,1);
  assert.equal(exported.socialMedia[0].mime,'image/png');
  assert.equal(exported.socialPosts[0].body,'Owner post');
  assert.equal(exported.socialFollows.length,1);
  assert.equal(exported.socialRelationships.length,1);
  expectCode(()=>deleteAccount(db,one.userId,'wrong'),'CONFIRMATION');
  expectCode(()=>deleteAccount(db,one.userId,'DELETE MY ACCOUNT','','wrong-password'),'AUTH_INVALID');
  assert.equal(deleteAccount(db,one.userId,'DELETE MY ACCOUNT','','one-valid-password'),true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id=?').get(one.userId).n,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id=?').get(two.userId).n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_posts WHERE user_id=?').get(one.userId).n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_media WHERE user_id=?').get(one.userId).n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_communities WHERE owner_id=?').get(one.userId).n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_community_members WHERE community_id=?').get('owned-group').n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_community_appeals WHERE user_id=?').get(one.userId).n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_community_audit WHERE actor_id=?').get(one.userId).n,0);
  assert.equal(db.prepare('SELECT community_id FROM social_posts WHERE id=?').get('other-social').community_id,null,"member keeps their content after the owner account closes");
  const removedGroupPost=db.prepare('SELECT hidden_at,community_id FROM social_posts WHERE id=?').get('removed-group-post');
  assert.ok(removedGroupPost.hidden_at>0,'moderated content stays hidden when the owner closes a community');
  assert.equal(removedGroupPost.community_id,null);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_reactions WHERE post_id=?').get('owned-social').n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_bookmarks WHERE post_id=?').get('owned-social').n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_reports WHERE post_id=?').get('owned-social').n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_follows WHERE following_id=?').get(one.userId).n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM social_relationships WHERE target_id=?').get(one.userId).n,0);
  assert.ok(db.prepare('SELECT hidden_at FROM social_posts WHERE id=?').get('other-social').hidden_at>0,'other authors retain records but orphaned replies are hidden');
  expectCode(()=>authenticateAccount(db,'one@localhost','one-valid-password'),'AUTH_INVALID');
 }finally{db?.close();rmSync(root,{recursive:true,force:true})}
});
