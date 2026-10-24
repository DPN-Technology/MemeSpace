import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStageEnv,runWatchdogOnce} from '../scripts/home-access-watchdog.mjs';

const config=()=>({origin:'https://stage.example.org',teamDomain:'myteam.cloudflareaccess.com'});
test('watchdog config requires an exact staging + Access tenant pair',()=>{
  assert.deepEqual(parseStageEnv('MEMESPACE_STAGE_HOSTNAME=stage.example.org\nMEMESPACE_ACCESS_TEAM_DOMAIN=myteam.cloudflareaccess.com\n'),config());
  for(const bad of [
    'MEMESPACE_STAGE_HOSTNAME=stage.example.org\n',
    'MEMESPACE_STAGE_HOSTNAME=https://stage.example.org\nMEMESPACE_ACCESS_TEAM_DOMAIN=myteam.cloudflareaccess.com',
    'MEMESPACE_STAGE_HOSTNAME=stage.example.org\nMEMESPACE_ACCESS_TEAM_DOMAIN=evil.example.org',
    'MEMESPACE_STAGE_HOSTNAME=stage.example.org\nMEMESPACE_STAGE_HOSTNAME=other.example.org\nMEMESPACE_ACCESS_TEAM_DOMAIN=myteam.cloudflareaccess.com',
    'MEMESPACE_STAGE_HOSTNAME=stage.example.org\nMEMESPACE_ACCESS_TEAM_DOMAIN=myteam.cloudflareaccess.com\nCLOUDFLARE_TUNNEL_TOKEN=fake'
  ])assert.throws(()=>parseStageEnv(bad));
});
test('passing scheduled probe leaves the tunnel running',async()=>{
  let stopped=0,checks=0;
  const result=await runWatchdogOnce({
    loadConfig:config,
    probe:async(origin,options)=>{
      checks++;assert.equal(origin,'https://stage.example.org');
      assert.equal(options.teamDomain,'myteam.cloudflareaccess.com');
      return {verifiedAnonymousRedirects:4};
    },
    stop:async()=>{stopped++}
  });
  assert.deepEqual(result,{ok:true,verifiedRoutes:4});
  assert.equal(checks,1);assert.equal(stopped,0);
});
test('anonymous exposure forces a tunnel stop',async()=>{
  let stopped=0;
  await assert.rejects(runWatchdogOnce({
    loadConfig:config,
    probe:async()=>{throw Error('Unexpected HTTP 200 at /api/health')},
    stop:async()=>{stopped++}
  }),error=>error.code==='ACCESS_GUARD_STOP');
  assert.equal(stopped,1);
});
test('DNS problems or invalid Access config also force a tunnel stop',async()=>{
  for(const options of [
    {loadConfig:config,probe:async()=>{throw Error('DNS outage')}},
    {loadConfig:()=>{throw Error('missing .env')},probe:async()=>({verifiedAnonymousRedirects:4})},
    {loadConfig:config,probe:async()=>({verifiedAnonymousRedirects:1})}
  ]){
    let stopped=0;
    await assert.rejects(runWatchdogOnce({...options,stop:async()=>{stopped++}}),error=>error.code==='ACCESS_GUARD_STOP');
    assert.equal(stopped,1);
  }
});
test('Docker stop failure must be reported as CRITICAL instead of claiming safety',async()=>{
  await assert.rejects(runWatchdogOnce({
    loadConfig:config,
    probe:async()=>{throw Error('Public exposure')},
    stop:async()=>{throw Error('Docker unavailable')}
  }),error=>error.code==='ACCESS_GUARD_CRITICAL'&&/Revoke the Cloudflare published route/.test(error.message));
});
