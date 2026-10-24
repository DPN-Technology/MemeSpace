import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const compose=readFileSync(path.join(root,'deploy/home/compose.yml'),'utf8');
const ignore=readFileSync(path.join(root,'.dockerignore'),'utf8');
const gitignore=readFileSync(path.join(root,'.gitignore'),'utf8');
const workflow=readFileSync(path.join(root,'.github/workflows/staging-readiness.yml'),'utf8');
const launcher=readFileSync(path.join(root,'deploy/home/start-protected-tunnel.ps1'),'utf8');
const docs=readFileSync(path.join(root,'docs/home-cloudflare-deployment.md'),'utf8');


test('home tunnel token is excluded from Git and Docker build context',()=>{
  assert.match(ignore,/^deploy\/home\/\.secrets\/$/m);
  assert.match(gitignore,/^\/deploy\/home\/\.secrets\/$/m);
  assert.match(ignore,/^\.env\*$/m);
  assert.match(gitignore,/^\.env\*$/m);
  assert.doesNotMatch(compose,/\$\{(?:TUNNEL_TOKEN|CLOUDFLARE_TUNNEL_TOKEN)/);
  assert.match(compose,/--token-file/);
});
test('Cloudflare tunnel is an opt-in profile, app is not internet port-published',()=>{
  assert.match(compose,/profiles: \["tunnel"\]/);
  assert.match(workflow,/"deploy\/home\/\*\*"/);
  const cfg=JSON.parse(execFileSync('docker',['compose','--profile','tunnel','-f','deploy/home/compose.yml','config','--format','json'],{
    cwd:root,encoding:'utf8',env:{...process.env,MEMESPACE_STAGE_HOSTNAME:'staging.example.org'}
  }));
  assert.ok(cfg.services.app,'app service required');
  assert.equal(cfg.services.app.ports,undefined,'app must never bind a host port');
  assert.equal(cfg.services.tunnel.ports,undefined,'cloudflared must not bind a host port');
  assert.deepEqual(cfg.services.tunnel.profiles,['tunnel']);
  assert.equal(cfg.services.app.environment.MEMESPACE_PUBLIC_ORIGIN,'https://staging.example.org');
  assert.ok(cfg.services.app.volumes.some(v=>v.target==='/app/data'&&v.type==='volume'));
  assert.ok(cfg.services.tunnel.volumes.some(v=>v.target==='/run/secrets/tunnel-token'&&v.read_only));
  assert.ok(cfg.services.tunnel.command.includes('--token-file'));
  assert.ok(!JSON.stringify(cfg.services.tunnel).includes('docker.sock'),'Docker socket must not be exposed to tunnel');
});

test('home tunnel launch uses an explicit Access-policy checkpoint and fail-closed anonymous probe',()=>{
  assert.match(launcher,/ACCESS POLICY VERIFIED/);
  assert.match(launcher,/scripts\/home-access-boundary\.mjs/);
  assert.match(launcher,/--profile tunnel up -d app tunnel/);
  assert.match(launcher,/--profile tunnel stop tunnel/);
  assert.match(launcher,/verify-host\.ps1/);
  assert.match(docs,/start-protected-tunnel\.ps1/);
  assert.match(workflow,/home-access-boundary\.test\.mjs/);
  assert.match(workflow,/start-protected-tunnel\.ps1/);
});
