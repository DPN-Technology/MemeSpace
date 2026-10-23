// DPN launch-control: CI-only real HTTP data durability fixture.
// Seed a fresh staging container, then verify the SAME account/session/profile/saved
// item following Docker container recreation and an isolated SQLite snapshot restore.
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const [operation,base,file]=process.argv.slice(2);
if(!['seed','verify'].includes(operation)||!base||!file){
  console.error('Usage: node scripts/staging-durability-e2e.mjs seed|verify http://127.0.0.1:5190 /path/to/fixture.json');
  process.exit(2);
}
const url=new URL(base);
if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Only isolated loopback HTTP CI targets allowed');
const host='staging.example.org',origin='https://'+host;

async function request(route,{method='GET',body,cookie}={}){
  const headers={Host:host,...(cookie?{Cookie:cookie}:{}),...(body?{'content-type':'application/json',Origin:origin}:{})};
  const response=await new Promise((resolve,reject)=>{
    const req=http.request(new URL(route,url),{method,headers,timeout:15000},res=>{
      const parts=[];
      res.on('data',part=>parts.push(part));
      res.on('end',()=>resolve(new Response(Buffer.concat(parts),{status:res.statusCode,headers:res.headers})));
      res.on('error',reject);
    });
    req.on('timeout',()=>req.destroy(new Error('Timed out contacting staging container')));
    req.on('error',reject);
    if(body)req.write(JSON.stringify(body));
    req.end();
  });
  let data;try{data=await response.json()}catch{data={}}
  return {status:response.status,headers:response.headers,data};
}
const check=(r,status,what)=>assert.equal(r.status,status,what+': '+JSON.stringify(r.data));
const arcade=await request('/api/arcade');
check(arcade,200,'Arcade API');
assert.equal(arcade.data.mode,'beta','durability suite requires money-off beta mode');
if(operation==='seed'){
  const random=randomUUID().replaceAll('-','');
  const fixture={
    email:'durable-'+random+'@example.invalid',
    password:'Durability-test-'+random,
    itemKey:'test-'+random,
    profileName:'Durable Member',
    profileBio:'Persistent profile through container recreation and backup restore'
  };
  const registered=await request('/api/auth/register',{method:'POST',body:{identifier:fixture.email,displayName:'Durable Member',password:fixture.password}});
  check(registered,201,'Register persistent account');
  const cookieHeader=registered.headers.get('set-cookie')||'';
  assert.match(cookieHeader,/HttpOnly/);
  assert.match(cookieHeader,/Secure/);
  fixture.cookie=cookieHeader.split(';')[0];
  assert.match(fixture.cookie,/^memespace_session=/);
  const profile=await request('/api/profile',{method:'POST',cookie:fixture.cookie,body:{name:fixture.profileName,bio:fixture.profileBio}});
  check(profile,200,'Save member profile');
  const saved=await request('/api/saved',{method:'POST',cookie:fixture.cookie,body:{kind:'bookmark',key:fixture.itemKey,payload:{title:'Restart-safe collection'}}});
  check(saved,200,'Save persistent bookmark');
  // Confidential CI-only test cookie and password never printed or uploaded as artifacts.
  await writeFile(file,JSON.stringify(fixture),{encoding:'utf8',mode:0o600,flag:'wx'});
  console.log('PASS: new staging account, profile and bookmark created in persistent SQLite volume');
}else{
  const fixture=JSON.parse(await readFile(file,'utf8'));
  const session=await request('/api/auth/session',{cookie:fixture.cookie});
  check(session,200,'Persistent member session');
  assert.equal(session.data.account?.email,fixture.email,'auth session table lost after restart/restore');
  const profile=await request('/api/profile',{cookie:fixture.cookie});
  check(profile,200,'Persistent profile API');
  assert.equal(profile.data.profile?.name,fixture.profileName);
  assert.equal(profile.data.profile?.bio,fixture.profileBio);
  const saved=await request('/api/saved',{cookie:fixture.cookie});
  check(saved,200,'Persistent saved items API');
  assert.ok(saved.data.items?.some(item=>item.item_key===fixture.itemKey&&item.payload?.title==='Restart-safe collection'),'bookmark missing after restart/restore');
  const relogin=await request('/api/auth/login',{method:'POST',body:{identifier:fixture.email,password:fixture.password}});
  check(relogin,200,'Existing account can sign in after restart/restore');
  assert.match(relogin.headers.get('set-cookie')||'',/Secure/);
  console.log('PASS: session + account + member profile + saved item + sign-in survive restart/restore');
}
