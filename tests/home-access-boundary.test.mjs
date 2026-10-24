import test from 'node:test';
import assert from 'node:assert/strict';
import {protectedPaths,validateStageOrigin,isAccessChallenge,verifyAnonymousAccess} from '../scripts/home-access-boundary.mjs';

const access='https://team.cloudflareaccess.com/cdn-cgi/access/login/stage.example.org?redirect_url=opaque';
const challenge=()=>new Response(null,{status:302,headers:{location:access}});
test('the anonymous preflight targets only a bare HTTPS DNS hostname',()=>{
  assert.equal(validateStageOrigin('https://stage.example.org'),'https://stage.example.org');
  for(const invalid of [
    'http://stage.example.org','https://stage.example.org/','https://stage.example.org:444',
    'https://user:pass@stage.example.org','https://127.0.0.1',
    'https://localhost','https://stage.local','https://stage.example.org/api/health',
    'https://stage.example.org?token=value'
  ])assert.throws(()=>validateStageOrigin(invalid));
});
test('only an authentic Cloudflare Access login redirect qualifies',()=>{
  assert.equal(isAccessChallenge(challenge()),true);
  for(const response of [
    new Response('site',{status:200}),
    new Response('denied',{status:403}),
    new Response(null,{status:302,headers:{location:'https://attacker.example.net/login'}}),
    new Response(null,{status:302,headers:{location:'https://team.cloudflareaccess.com.evil.example/cdn-cgi/access/login'}}),
    new Response(null,{status:302,headers:{location:'http://team.cloudflareaccess.com/cdn-cgi/access/login'}}),
    new Response(null,{status:302,headers:{location:'https://team.cloudflareaccess.com/anything-else'}}),
    new Response(null,{status:302,headers:{location:'/cdn-cgi/access/login'}})
  ])assert.equal(isAccessChallenge(response),false);
});
test('all anonymous routes must be protected, with no cookies, credentials or redirect following',async()=>{
  const paths=[];
  const result=await verifyAnonymousAccess('https://stage.example.org',{fetcher:async(url,options)=>{
    paths.push(new URL(url).pathname);
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'manual');
    assert.equal(options.headers.Authorization,undefined);
    assert.equal(options.headers.Cookie,undefined);
    assert.equal(options.signal.aborted,false);
    return challenge();
  }});
  assert.deepEqual(paths,protectedPaths);
  assert.equal(result.verifiedAnonymousRedirects,protectedPaths.length);
});
test('any anonymously accessible route fails closed instead of reporting protected',async()=>{
  const paths=[];
  await assert.rejects(verifyAnonymousAccess('https://stage.example.org',{fetcher:async url=>{
    paths.push(new URL(url).pathname);
    return paths.length===3?new Response('private session',{status:200}):challenge();
  }}),/\/api\/auth\/session.*HTTP 200/);
  assert.deepEqual(paths,protectedPaths.slice(0,3));
});
test('unreachable host fails preflight instead of enabling the tunnel',async()=>{
  await assert.rejects(verifyAnonymousAccess('https://stage.example.org',{fetcher:async()=>{throw Error('DNS unavailable')}}),/DNS unavailable/);
});
