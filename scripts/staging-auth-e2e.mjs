// Authenticated staging regression against an isolated CI Docker container.
// Exercises real HTTP session cookies on a simulated HTTPS public Host.
// Never run against a real staging site: this script creates a test account.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.argv[2]||'http://127.0.0.1:5188';
const host=process.env.MEMESPACE_TEST_PUBLIC_HOST||'staging.example.org';
const origin='https://'+host;
const email='ci-'+randomUUID()+'@example.invalid';
const password='CITest-'+randomUUID()+'-only';
async function req(route,{method='GET',body,cookie,originHeader=origin}={}){
  const headers={host, ...(cookie?{cookie}:{}),...(body?{'content-type':'application/json',origin:originHeader}:{})};
  const response=await fetch(base+route,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual'});
  let payload;try{payload=await response.json()}catch{payload={}}
  return {response,payload};
}
const before=await req('/api/auth/session');
assert.equal(before.response.status,200);
assert.equal(before.payload.account,null);
const denial=await req('/api/auth/register',{method:'POST',originHeader:'https://hostile.example.invalid',body:{identifier:email,displayName:'CI staging test',password}});
assert.equal(denial.response.status,403,'cross-origin registration must be blocked');
const registered=await req('/api/auth/register',{method:'POST',body:{identifier:email,displayName:'CI staging test',password}});
assert.equal(registered.response.status,201,'HTTPS public Host registration should succeed: '+JSON.stringify(registered.payload));
const rawCookie=registered.response.headers.get('set-cookie')||'';
assert.match(rawCookie,/HttpOnly/);
assert.match(rawCookie,/Secure/);
const cookie=rawCookie.split(';')[0];
assert.match(cookie,/^memespace_session=/);
const session=await req('/api/auth/session',{cookie});
assert.equal(session.response.status,200);
assert.equal(session.payload.account?.email,email,'public-host session cookie must remain authenticated');
const profile=await req('/api/profile',{cookie});
assert.equal(profile.response.status,200,'public-host authenticated profile must load');
const arcade=await req('/api/arcade');
assert.equal(arcade.response.status,200);
assert.equal(arcade.payload.mode,'beta','staging must run with free-beta launch scope');
const loggedOut=await req('/api/auth/logout',{method:'POST',cookie,body:{}});
assert.equal(loggedOut.response.status,200);
const after=await req('/api/auth/session',{cookie});
assert.equal(after.payload.account,null,'logout must revoke staging session');
const signIn=await req('/api/auth/login',{method:'POST',body:{identifier:email,password}});
assert.equal(signIn.response.status,200);
const reloginCookie=(signIn.response.headers.get('set-cookie')||'').split(';')[0];
const recovered=await req('/api/auth/session',{cookie:reloginCookie});
assert.equal(recovered.payload.account?.email,email);
console.log('PASS: live HTTP public-host registration, SameSite+Secure cookie, session, profile, arcade beta, logout, re-login.');
