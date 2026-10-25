import test from 'node:test';
import assert from 'node:assert/strict';
import {sameOrigin,localRequest,trustedSessionHost} from '../lib/local-session.mjs';
import {validateBase,checkStaging} from '../scripts/staging-smoke.mjs';

function request(host,origin,site='same-origin'){
  return {url:'https://'+host+'/api/auth/session',headers:new Headers({host,...(origin?{origin}:{}),'sec-fetch-site':site})};
}

test('public HTTPS origin: allow same host, deny others',()=>{
  const previous=process.env.MEMESPACE_PUBLIC_ORIGIN;
  try{
    process.env.MEMESPACE_PUBLIC_ORIGIN='https://stage.example.org';
    assert.equal(sameOrigin(request('stage.example.org','https://stage.example.org')),true);
    assert.equal(sameOrigin(request('stage.example.org')),true);
    assert.equal(sameOrigin(request('stage.example.org','https://evil.example.org')),false);
    assert.equal(sameOrigin(request('stage.example.org','https://stage.example.org','cross-site')),false);
    assert.equal(sameOrigin(request('evil.example.org','https://stage.example.org')),false);
    assert.equal(sameOrigin(request('stage.example.org:443','https://stage.example.org')),false);
    assert.equal(localRequest(request('stage.example.org').headers),false);
    assert.equal(trustedSessionHost(request('stage.example.org').headers),true);
    assert.equal(trustedSessionHost(request('other.example.org').headers),false);
    for(const invalid of ['http://stage.example.org','https://stage.example.org/','https://stage.example.org/a','https://evil:secret@stage.example.org']){
      process.env.MEMESPACE_PUBLIC_ORIGIN=invalid;
      assert.equal(sameOrigin(request('stage.example.org','https://stage.example.org')),false);
      assert.equal(trustedSessionHost(request('stage.example.org').headers),false);
    }
  }finally{
    if(previous===undefined)delete process.env.MEMESPACE_PUBLIC_ORIGIN;
    else process.env.MEMESPACE_PUBLIC_ORIGIN=previous;
  }
});

test('public mutating requests without Origin fail closed',()=>{
  const previous=process.env.MEMESPACE_PUBLIC_ORIGIN;
  try{
    process.env.MEMESPACE_PUBLIC_ORIGIN='https://stage.example.org';
    const request=(method,headers={})=>({url:'https://stage.example.org/api/auth/login',method,headers:new Headers({host:'stage.example.org',...headers})});
    assert.equal(sameOrigin(request('POST')),false);
    assert.equal(sameOrigin(request('POST',{'sec-fetch-site':'cross-site'})),false);
    assert.equal(sameOrigin(request('POST',{origin:'null'})),false);
    assert.equal(sameOrigin(request('POST',{origin:'https://evil.example.org'})),false);
    assert.equal(sameOrigin(request('POST',{origin:'https://stage.example.org'})),true);
    assert.equal(sameOrigin(request('POST',{'sec-fetch-site':'same-origin'})),true);
    assert.equal(sameOrigin(request('GET')),true);
  }finally{
    if(previous===undefined)delete process.env.MEMESPACE_PUBLIC_ORIGIN;else process.env.MEMESPACE_PUBLIC_ORIGIN=previous;
  }
});

test('local mode retains loopback-only origin restriction',()=>{
  const previous=process.env.MEMESPACE_PUBLIC_ORIGIN,local=process.env.MEMESPACE_LOCAL_MODE,port=process.env.MEMESPACE_PORT;
  try{
    delete process.env.MEMESPACE_PUBLIC_ORIGIN;
    process.env.MEMESPACE_LOCAL_MODE='1';
    process.env.MEMESPACE_PORT='5173';
    assert.equal(sameOrigin({url:'http://127.0.0.1:5173/',headers:new Headers({host:'127.0.0.1:5173',origin:'http://127.0.0.1:5173'})}),true);
    assert.equal(sameOrigin(request('stage.example.org','https://stage.example.org')),false);
  }finally{
    for(const [name,value] of [['MEMESPACE_PUBLIC_ORIGIN',previous],['MEMESPACE_LOCAL_MODE',local],['MEMESPACE_PORT',port]]){
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});

test('staging probe disallows insecure off-host targets and validates both routes',async()=>{
  assert.throws(()=>validateBase('http://example.org'),/HTTPS/);
  assert.throws(()=>validateBase('https://example.org/path'),/bare origin/);
  assert.equal(validateBase('http://127.0.0.1:5173'),'http://127.0.0.1:5173');
  const urls=[];
  const fetcher=async url=>{
    urls.push(url);
    if(url.endsWith('/api/health'))return {ok:true,json:async()=>({ok:true,runtime:'node',storage:'sqlite'})};
    return {ok:true,headers:new Headers({'Content-Type':'text/html'})};
  };
  const result=await checkStaging('https://stage.example.org',{fetcher});
  assert.equal(result.ok,true);
  assert.deepEqual(urls,['https://stage.example.org/api/health','https://stage.example.org/']);
  await assert.rejects(()=>checkStaging('https://stage.example.org',{fetcher,user:'only'}),/both/);
});
