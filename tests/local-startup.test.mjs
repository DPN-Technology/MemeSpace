import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=fileURLToPath(new URL('../',import.meta.url));
test('starts without a worker runtime and persists signed-in module data',{timeout:180000},async()=>{
  const data=await mkdtemp(path.join(tmpdir(),'memespace-startup-'));
  const port=Number(process.env.MEMESPACE_TEST_PORT||5381),base=`http://127.0.0.1:${port}`;
  const hook=new URL('./no-worker-runtime.mjs',import.meta.url).href;
  let log='',exit=null;
  const child=spawn(process.execPath,['scripts/local.mjs',process.env.MEMESPACE_TEST_MODE==='serve'?'serve':'start'],{cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,MEMESPACE_PORT:String(port),MEMESPACE_DATA_DIR:data,NODE_OPTIONS:`${process.env.NODE_OPTIONS||''} --import=${hook}`}});
  child.stdout.on('data',c=>log+=c);child.stderr.on('data',c=>log+=c);child.once('exit',code=>exit=code??1);
  async function call(route,body,cookie,extra={}){
    return fetch(base+route,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:base}),...(cookie?{Cookie:cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
  }
  try{
    let ready=false;
    for(let i=0;i<240;i++){
      if(exit!==null)assert.fail('Local server exited before readiness:\n'+log);
      try{const r=await call('/api/health');if(r.status===200&&(await r.json()).ok){ready=true;break}}catch{}
      await delay(250);
    }
    assert.ok(ready,'Local server did not become ready:\n'+log);
    const page=await call('/');assert.equal(page.status,200);assert.equal(page.headers.get('x-content-type-options'),'nosniff');assert.equal(page.headers.get('x-frame-options'),'DENY');assert.match(await page.text(),/Everything begins/);
    for(const asset of ['head.bin','brain.bin']){const r=await call('/geometry/'+asset);assert.equal(r.status,200);assert.ok((await r.arrayBuffer()).byteLength>100000)}
    assert.equal((await call('/api/profile')).status,401);
    assert.equal((await call('/api/profile',undefined,undefined,{'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':'spoof@example.com'})).status,401);
    const blockedLogin=await call('/signin-with-chatgpt?return_to=%2F',undefined,undefined,{'Sec-Fetch-Site':'cross-site'});assert.equal(blockedLogin.status,403);
    const login=await call('/signin-with-chatgpt?return_to=%2F%23profile');assert.equal(login.status,303);
    const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
    assert.equal((await call('/api/profile',{name:'Local test',bio:'Persists on this computer.'},cookie)).status,200);
    assert.equal((await (await call('/api/profile',undefined,cookie)).json()).profile.name,'Local test');
    assert.equal((await call('/api/profile',{name:'Untrusted',bio:''},cookie,{Origin:'https://untrusted.example'})).status,403);
    assert.equal((await call('/api/saved',{kind:'bookmark',key:'doge',payload:{title:'Doge'}},cookie)).status,200);
    assert.equal((await (await call('/api/saved',undefined,cookie)).json()).items[0].item_key,'doge');
    const note={kind:'note',key:'wallets',payload:{title:'Wallets',text:'My own learning notes.'}};
    assert.equal((await call('/api/saved',note,cookie)).status,200);
    assert.equal((await call('/api/saved',{...note,payload:{...note.payload,text:'Updated notes.'}},cookie)).status,200);
    const notes=(await (await call('/api/saved',undefined,cookie)).json()).items.filter(i=>i.kind==='note');
    assert.equal(notes.length,1);assert.equal(notes[0].payload.text,'Updated notes.');
    assert.equal((await call('/api/saved',{...note,payload:{title:'Wallets',text:'x'.repeat(1201)}},cookie)).status,400);
    const creation={kind:'meme',key:'studio-test',payload:{top:'TOP',bottom:'BOTTOM',image:'brain',fontSize:54,color:'#b4ffc8'}};
    assert.equal((await call('/api/saved',creation,cookie)).status,200);
    assert.equal((await call('/api/saved',{...creation,payload:{...creation.payload,fontSize:500}},cookie)).status,400);
    assert.equal((await call('/api/saved',{...creation,payload:{...creation.payload,color:'invalid'}},cookie)).status,400);
    const deletion=await fetch(base+'/api/saved',{method:'DELETE',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify({kind:'note',key:'wallets'})});
    assert.equal(deletion.status,200);
    assert.ok(!(await (await call('/api/saved',undefined,cookie)).json()).items.some(i=>i.kind==='note'));
    assert.equal((await call('/api/chat',{text:'Local runtime works',channel:'general'},cookie)).status,201);
    const chat=await (await call('/api/chat?channel=general',undefined,cookie)).json();assert.equal(chat.messages[0].text,'Local runtime works');assert.equal(chat.messages[0].mine,true);
    assert.equal((await call('/api/chat/like',{id:chat.messages[0].id,enabled:true},cookie)).status,200);
    assert.equal((await (await call('/api/chat?channel=general',undefined,cookie)).json()).messages[0].likes,1);
    assert.equal((await call('/signout-with-chatgpt',undefined,cookie,{'Sec-Fetch-Site':'cross-site'})).status,403);
    assert.equal((await call('/api/profile',undefined,cookie+'tampered')).status,401);
  }catch(error){console.error(log);throw error;}finally{
    child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));
    await rm(data,{recursive:true,force:true});
  }
});
