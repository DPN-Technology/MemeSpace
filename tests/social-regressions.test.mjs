import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,cpSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {migrate} from '../lib/local-database.mjs';
import {createAccount,deleteAccount,exportAccount} from '../lib/local-auth.mjs';
import {verifySocialImage,readSocialForm,MAX_FORM_BYTES} from '../lib/social-media.mjs';
import {communityVisiblePostFilter} from '../lib/social-community.mjs';
import {openSecurity,createInvite,beginEnrollment,finishEnrollment,readSession,totp,cookieName} from '../admin/security.mjs';
import {reports,moderate} from '../admin/operations.mjs';

const root=process.cwd(),password='social-regression-password-123';
function fixture(){
 const folder=mkdtempSync(path.join(root,'.social-regression-')),db=new DatabaseSync(path.join(folder,'site.sqlite'));
 migrate(db,root);
 return {folder,db,close(){db.close();rmSync(folder,{recursive:true,force:true})}};
}
function member(db,name){return createAccount(db,{identifier:name+'@example.test',displayName:name,password}).userId}
function post(db,id,user,reply=null,community=null){db.prepare('INSERT INTO social_posts(id,user_id,body,reply_to,community_id,created_at) VALUES(?,?,?,?,?,?)').run(id,user,'Original social content',reply,community,1)}

test('social journal is sequential and additive; original migrations and populated SQLite survive upgrade',()=>{
 const entries=JSON.parse(readFileSync(path.join(root,'drizzle','meta','_journal.json'),'utf8')).entries;
 assert.deepEqual(entries.map(e=>e.idx),Array.from({length:15},(_,i)=>i));
 const f=fixture();
 try{
  const db=f.db;
  db.close();
  f.db=new DatabaseSync(path.join(f.folder,'upgrade.sqlite'));
  f.db.exec('CREATE TABLE d1_migrations(name TEXT PRIMARY KEY)');
  // Start with an actual pre-social database, not just an empty latest schema.
  for(const entry of entries.slice(0,5)){
   const filename='drizzle/'+entry.tag+'.sql',original=execFileSync('git',['show','HEAD:'+filename]);
   assert.equal(readFileSync(path.join(root,'drizzle',entry.tag+'.sql'),'utf8').replace(/\r\n/g,'\n'),original.toString().replace(/\r\n/g,'\n'));
   f.db.exec(original.toString());
   f.db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(entry.tag+'.sql');
  }
  f.db.prepare("INSERT INTO profiles(user_id,name,bio,updated_at) VALUES('upgrade_member','Keep this profile','Unchanged',1)").run();
  f.db.prepare("INSERT INTO saved_items(id,user_id,kind,item_key,payload,updated_at) VALUES('saved','upgrade_member','story','history','{}',1)").run();
  migrate(f.db,root);migrate(f.db,root);
  assert.equal(f.db.prepare('SELECT name FROM profiles WHERE user_id=?').get('upgrade_member').name,'Keep this profile');
  assert.equal(f.db.prepare('SELECT count(*) n FROM saved_items').get().n,1);
  assert.equal(f.db.prepare('SELECT count(*) n FROM _memespace_migrations').get().n,15);
 }finally{f.db.close();rmSync(f.folder,{recursive:true,force:true})}
});

test('social export and password-confirmed deletion preserve others’ ownership and private-space confidentiality',()=>{
 const f=fixture(),db=f.db;
 try{
  const alice=member(db,'Alice'),bob=member(db,'Bob');
  post(db,'parent',alice);post(db,'reply',bob,'parent');post(db,'independent',bob);
  db.prepare("INSERT INTO social_communities(id,slug,name,owner_id,visibility,created_at,updated_at) VALUES('space','private-space','Private space',?,'private',1,1)").run(alice);
  db.prepare("INSERT INTO social_community_members VALUES('space',?,'owner',1)").run(alice);
  db.prepare("INSERT INTO social_community_members VALUES('space',?,'member',1)").run(bob);
  post(db,'secret',bob,null,'space');
  db.prepare("INSERT INTO social_reactions VALUES(?,'parent',1)").run(bob);
  db.prepare("INSERT INTO social_bookmarks VALUES(?,'parent',1)").run(bob);
  db.prepare("INSERT INTO social_follows VALUES(?,?,1)").run(bob,alice);
  db.prepare("INSERT INTO social_relationships VALUES(?,?,'mute',1)").run(alice,bob);
  db.prepare("INSERT INTO social_hashtags VALUES('parent','signal')").run();
  db.prepare("INSERT INTO social_creator_profiles(user_id,headline,avatar_mime,avatar_content) VALUES(?,'Creator','image/png',?)").run(alice,Buffer.from('private binary'));
  db.prepare("INSERT INTO social_notifications(id,recipient_id,actor_id,kind,community_id,message,created_at) VALUES('notice',?,?,'join_review','space','Private community notice',1)").run(bob,bob);
  const exported=exportAccount(db,alice);
  assert.equal(exported.socialPosts.length,1);
  assert.equal(exported.socialHashtags[0].tag,'signal');
  assert.equal(exported.creatorProfile.headline,'Creator');
  assert.equal(exported.creatorProfile.avatar_content,undefined);
  assert.equal(exported.ownedCommunities[0].visibility,'private');
  assert.throws(()=>deleteAccount(db,alice,'DELETE MY ACCOUNT','','wrong-password'));
  deleteAccount(db,alice,'DELETE MY ACCOUNT','',password);
  assert.equal(db.prepare('SELECT count(*) n FROM social_posts WHERE user_id=?').get(alice).n,0);
  assert.ok(db.prepare("SELECT hidden_at FROM social_posts WHERE id='reply'").get().hidden_at>0);
  assert.ok(db.prepare("SELECT hidden_at FROM social_posts WHERE id='secret'").get().hidden_at>0);
  assert.equal(db.prepare("SELECT hidden_at FROM social_posts WHERE id='independent'").get().hidden_at,0);
  const visible=db.prepare("SELECT id FROM social_posts p WHERE hidden_at=0 AND "+communityVisiblePostFilter()).all();
  assert.deepEqual(visible.map(p=>p.id),['independent']);
  for(const table of ['social_notifications','social_reactions','social_bookmarks','social_follows','social_relationships','social_communities','social_community_members','social_creator_profiles'])
   assert.equal(db.prepare('SELECT count(*) n FROM '+table).get().n,0,table);
 }finally{f.close()}
});

test('Control Center social moderation shares existing MFA, permissions and audit boundaries',()=>{
 const f=fixture(),db=f.db;
 cpSync(path.join(root,'admin','migrations'),path.join(f.folder,'admin','migrations'),{recursive:true});
 const {db:security,key}=openSecurity(f.folder);
 try{
  const invitation=createInvite(security,null,{},true);
  const start=beginEnrollment(security,key,{invitation:invitation.token,identifier:'owner@example.test',displayName:'Owner',password});
  const signed=finishEnrollment(security,key,{enrollmentToken:start.enrollmentToken,code:totp(start.secret)});
  const ctx=readSession(security,cookieName+'='+signed.token);
  const alice=member(db,'Alice'),bob=member(db,'Bob');
  post(db,'reported',alice);post(db,'child',bob,'reported');
  db.prepare("INSERT INTO social_reports(user_id,post_id,reason,created_at) VALUES(?,'reported','spam',1)").run(bob);
  const queue=reports(db,ctx,new URL('http://localhost/reports'));
  const report=queue.items.find(r=>r.id==='social:reported:'+bob);
  assert.ok(report);
  assert.throws(()=>moderate(db,security,{...ctx,role:'support'},report.id,{action:'hide',reason:'Verified spam content'}));
  moderate(db,security,ctx,report.id,{action:'hide',reason:'Verified spam content'});
  assert.ok(db.prepare("SELECT hidden_at FROM social_posts WHERE id='reported'").get().hidden_at);
  assert.ok(db.prepare("SELECT hidden_at FROM social_posts WHERE id='child'").get().hidden_at);
  assert.equal(db.prepare('SELECT status FROM social_reports').get().status,'resolved');
  assert.ok(security.prepare("SELECT id FROM audit_events WHERE action='social.report.hide'").get());
 }finally{security.close();f.close()}
});

test('native media rejects executable types, invalid dimensions and oversized actual streams',async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/+l40AAAAASUVORK5CYII=','base64');
 assert.equal(verifySocialImage(png,'image/png').width,1);
 assert.equal(verifySocialImage(png,'image/svg+xml'),null);
 const giant=Buffer.from(png);giant.writeUInt32BE(10000,16);
 assert.equal(verifySocialImage(giant,'image/png'),null);
 assert.equal(verifySocialImage(Buffer.alloc(MAX_FORM_BYTES),'image/png'),null);
 const request=new Request('http://localhost/upload',{method:'POST',headers:{'Content-Length':'10','Content-Type':'multipart/form-data; boundary=test'},body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_FORM_BYTES+1));controller.close()}}),duplex:'half'});
 await assert.rejects(readSocialForm(request),/UPLOAD_TOO_LARGE/);
});
