import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {openDatabase} from '../lib/local-database.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
test('social posts, discovery, reactions, follows, replies, search and moderation persist safely',{timeout:180000},async t=>{
 const data=await mkdtemp(path.join(tmpdir(),'memespace-social-api-'));
 const port=Number(process.env.MEMESPACE_SOCIAL_TEST_PORT||5404),base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['scripts/local.mjs',process.env.MEMESPACE_TEST_MODE==='serve'?'serve':'start'],{cwd:root,env:{...process.env,MEMESPACE_PORT:String(port),MEMESPACE_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
 let logs='';server.stdout.on('data',chunk=>logs+=chunk);server.stderr.on('data',chunk=>logs+=chunk);
 t.after(async()=>{server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(5000)]);await rm(data,{recursive:true,force:true});});
 let ready=false;
 for(let i=0;i<180;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await delay(250)}
 assert.ok(ready,logs);
 async function register(identifier,displayName){
  const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({identifier,displayName,password:'social-testing-password-123'})});
  assert.equal(r.status,201,await r.text());
  return {cookie:r.headers.get('set-cookie')?.split(';')[0],account:(await r.json()).account};
 }
 // A POST without session must not create content.
 const denied=await fetch(base+'/api/social',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'create',text:'Unauthenticated content',topic:'memes'})});
 assert.equal(denied.status,401);
 const alice=await register('social-alice@example.test','Alice Builder');
 const bob=await register('social-bob@example.test','Bob Creator');
 async function mutate(actor,payload,method='POST'){
  const r=await fetch(base+'/api/social',{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:actor.cookie},body:JSON.stringify(payload)});
  const json=await r.json();
  assert.ok(r.ok,JSON.stringify({status:r.status,result:json}));
  return json;
 }
 async function read(path,actor){
  const r=await fetch(base+path,{headers:actor?.cookie?{Cookie:actor.cookie}:{}});
  assert.equal(r.status,200,await r.text());
  return r.json();
 }
 const created=await mutate(alice,{action:'create',text:'Our first MemeSpace signal 100%_! What should we build?',topic:'memes'});
 assert.ok(created.id);
 const feed=await read('/api/social?mode=feed',bob);
 assert.equal(feed.posts.length,1);
 assert.equal(feed.posts[0].body,'Our first MemeSpace signal 100%_! What should we build?');
 assert.equal(feed.posts[0].mine,false);
 assert.equal(feed.posts[0].reactions,0);
 assert.equal((await read('/api/social?mode=feed&q='+encodeURIComponent('100%_'),bob)).posts.length,1,'search uses literal text');
 assert.equal((await read('/api/social?mode=feed&q=nomatch',bob)).posts.length,0);
 assert.equal((await read('/api/social?mode=feed&topic=gaming',bob)).posts.length,0);
 assert.equal((await read('/api/social?mode=people',bob)).people.some(p=>p.userId===alice.account.userId),true);
 await mutate(bob,{action:'follow',userId:alice.account.userId,enabled:true});
 assert.equal((await read('/api/social?mode=feed&view=following',bob)).posts.length,1);
 await mutate(bob,{action:'react',postId:created.id,enabled:true});
 await mutate(bob,{action:'bookmark',postId:created.id,enabled:true});
 const saved=await read('/api/social?mode=feed&view=saved',bob);
 assert.equal(saved.posts.length,1);assert.equal(saved.posts[0].reacted,true);assert.equal(saved.posts[0].saved,true);
 const reply=await mutate(bob,{action:'create',text:'A dedicated creator space!',topic:'memes',replyTo:created.id});
 const discussion=await read('/api/social?mode=thread&id='+created.id,alice);
 assert.equal(discussion.replies.length,1);assert.equal(discussion.replies[0].id,reply.id);
 const activity=await read('/api/social?mode=activity',alice);
 assert.ok(activity.activity.some(e=>e.kind==='reaction'));
 assert.ok(activity.activity.some(e=>e.kind==='reply'));
 assert.ok(activity.activity.some(e=>e.kind==='follow'));
 await mutate(bob,{action:'report',postId:created.id,reason:'spam'});
 let db;const old=process.env.MEMESPACE_DATA_DIR;process.env.MEMESPACE_DATA_DIR=data;
 try{db=openDatabase(root);assert.equal(db.prepare('SELECT reason FROM social_reports WHERE post_id=?').get(created.id).reason,'spam');}
 finally{db?.close();if(old===undefined)delete process.env.MEMESPACE_DATA_DIR;else process.env.MEMESPACE_DATA_DIR=old}
 await mutate(alice,{id:created.id},'DELETE');
 assert.equal((await read('/api/social?mode=feed',bob)).posts.length,0);
 const hidden=await fetch(base+'/api/social?mode=thread&id='+created.id);assert.equal(hidden.status,404);
 const invalid=await fetch(base+'/api/social?mode=feed&page=-1');assert.equal(invalid.status,400);
});
