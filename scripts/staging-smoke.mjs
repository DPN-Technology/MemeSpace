// DPN launch gate: read-only health and website smoke checks.
// STAGING_SMOKE_BASIC_USER / STAGING_SMOKE_BASIC_PASSWORD are optional and never logged.
import {pathToFileURL} from 'node:url';

export function validateBase(value){
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Provide a bare origin, not a path or credentials.');
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))throw Error('Remote staging checks require HTTPS.');
  return url.origin;
}

export async function checkStaging(origin,{user,password,fetcher=fetch}={}){
  const base=validateBase(origin);
  if(Boolean(user)!==Boolean(password))throw Error('Supply both staging smoke credentials or neither.');
  const headers={'Accept':'application/json'};
  if(user&&password)headers.Authorization='Basic '+Buffer.from(user+':'+password).toString('base64');
  const health=await fetcher(base+'/api/health',{headers,signal:AbortSignal.timeout(10000),redirect:'manual'});
  if(!health.ok)throw Error('Health endpoint returned HTTP '+health.status);
  const result=await health.json();
  if(result?.ok!==true||result?.runtime!=='node'||result?.storage!=='sqlite')throw Error('Unexpected application runtime or database health.');
  const home=await fetcher(base+'/',{headers:{...headers,Accept:'text/html'},signal:AbortSignal.timeout(15000),redirect:'manual'});
  if(!home.ok)throw Error('Website returned HTTP '+home.status);
  const contentType=home.headers.get('content-type')||'';
  if(!contentType.includes('text/html'))throw Error('Website did not return HTML.');
  return {ok:true,origin:base,runtime:result.runtime,storage:result.storage};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const origin=process.argv[2];
  if(!origin){console.error('Usage: node scripts/staging-smoke.mjs https://staging.example.org');process.exitCode=2;}
  else{
    try{
      const result=await checkStaging(origin,{user:process.env.STAGING_SMOKE_BASIC_USER,password:process.env.STAGING_SMOKE_BASIC_PASSWORD});
      console.log('PASS: HTTPS staging website + SQLite health ('+result.origin+')');
    }catch(error){console.error('Staging smoke check FAILED: '+error.message);process.exitCode=1;}
  }
}
