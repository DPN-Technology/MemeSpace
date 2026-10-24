// Read-only, unauthenticated outside-in guard for the home Cloudflare Tunnel.
// Never send credentials, follow redirects, read response bodies, or modify the app.
// A passing redirect is necessary but NOT proof the Access allow-list is correct.
import {pathToFileURL} from 'node:url';

export const protectedPaths=['/','/api/health','/api/auth/session','/api/arcade'];
export function validateStageOrigin(input){
  if(typeof input!=='string')throw Error('Expected HTTPS staging origin');
  const value=new URL(input);
  if(value.protocol!=='https:'||value.origin!==input||value.pathname!=='/'||value.search||value.hash||value.username||value.password||value.port)throw Error('Expected a bare HTTPS staging origin');
  const host=value.hostname;
  if(host.length>253||!host.includes('.')||!host.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))||
     /^(?:localhost|127\.|10\.|192\.168\.)/.test(host)||/\.(?:localhost|local|internal)$/.test(host))throw Error('Expected a public DNS staging hostname');
  return value.origin;
}
export function isAccessChallenge(response){
  // Accept only a login redirect to the genuine Cloudflare Access domain.
  // Plain 401/403 is not sufficient proof: an unrelated WAF can emit those.
  if(![302,303].includes(response.status))return false;
  const location=response.headers.get('location');
  if(!location)return false;
  try{
    const login=new URL(location);
    return login.protocol==='https:' &&
      login.hostname.endsWith('.cloudflareaccess.com') &&
      login.pathname.startsWith('/cdn-cgi/access/login') &&
      !login.username&&!login.password;
  }catch{return false}
}
export async function verifyAnonymousAccess(origin,{fetcher=fetch}={}){
  const base=validateStageOrigin(origin);
  for(const pathname of protectedPaths){
    const response=await fetcher(base+pathname,{
      method:'GET',redirect:'manual',
      headers:{'Accept':'text/html','Cache-Control':'no-cache'},
      signal:AbortSignal.timeout(10000)
    });
    if(!isAccessChallenge(response)){
      // Do not read or log any response body (may contain account data).
      throw Error('Anonymous access gate failed at '+pathname+' (HTTP '+response.status+'); stop the tunnel and review Cloudflare Access policy.');
    }
  }
  return {verifiedAnonymousRedirects:protectedPaths.length,origin:base};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(!process.argv[2])throw Error('Usage: node scripts/home-access-boundary.mjs https://stage.your-domain.com');
    const result=await verifyAnonymousAccess(process.argv[2]);
    console.log('PASS: '+result.verifiedAnonymousRedirects+' anonymous routes redirect to Cloudflare Access login. Still verify allowed/denied identities manually.');
  }catch(error){
    console.error('FAIL: anonymous Cloudflare Access boundary: '+(error instanceof Error?error.message:'unknown error'));
    process.exitCode=1;
  }
}
