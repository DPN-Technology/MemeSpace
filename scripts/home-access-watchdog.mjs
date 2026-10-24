// One-shot Windows Task Scheduler health gate for a Cloudflare Access-protected
// staging tunnel. No credentials, cookies, redirects followed, or body reads.
// A failed check STOPS the tunnel, not the database or other Docker services.
// A passing check is not proof the Access email allow-list is correct.
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateStageOrigin,validateAccessTeamDomain,verifyAnonymousAccess} from './home-access-boundary.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const configPath=join(root,'deploy','home','.env');
export function parseStageEnv(contents){
  const names=['MEMESPACE_STAGE_HOSTNAME','MEMESPACE_ACCESS_TEAM_DOMAIN'];
  const entries=new Map();
  for(const line of contents.split(/\r?\n/)){
    const trimmed=line.trim();
    if(!trimmed||trimmed.startsWith('#'))continue;
    const match=/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if(!match)throw Error('Invalid staging configuration line');
    if(!names.includes(match[1]))throw Error('Unexpected staging configuration variable');
    if(entries.has(match[1]))throw Error('Duplicate staging configuration variable');
    entries.set(match[1],match[2].trim());
  }
  if(entries.size!==2)throw Error('Both staging and Cloudflare Access team domains must be configured');
  const stage=entries.get('MEMESPACE_STAGE_HOSTNAME');
  const teamDomain=validateAccessTeamDomain(entries.get('MEMESPACE_ACCESS_TEAM_DOMAIN'));
  const origin=validateStageOrigin('https://'+stage);
  return {origin,teamDomain};
}
export function loadStageConfig(){return parseStageEnv(readFileSync(configPath,'utf8'))}
export function stopHomeTunnel(){
  // Argument-vector invocation: never construct a shell string and never
  // expose the tunnel token. Windows Docker Desktop must be usable by task owner.
  execFileSync('docker',['compose','--env-file','deploy/home/.env','-f','deploy/home/compose.yml','--profile','tunnel','stop','tunnel'],{
    cwd:root,timeout:30000,stdio:'ignore',windowsHide:true
  });
}
export async function runWatchdogOnce({loadConfig=loadStageConfig,probe=verifyAnonymousAccess,stop=stopHomeTunnel}={}){
  try{
    const {origin,teamDomain}=await loadConfig();
    const result=await probe(origin,{teamDomain});
    if(!result||result.verifiedAnonymousRedirects!==4)throw Error('Anonymous perimeter verification incomplete');
    return {ok:true,verifiedRoutes:result.verifiedAnonymousRedirects};
  }catch(cause){
    let stopped=false;
    try{await stop();stopped=true}catch{ /* shutdown failure is escalated below */ }
    const reason=stopped
      ?'Cloudflare Access policy check failed. Tunnel stop requested; inspect Compose status immediately.'
      :'CRITICAL: Cloudflare Access policy check failed AND Docker tunnel shutdown failed. Revoke the Cloudflare published route now.';
    const failure=Error(reason,{cause});
    failure.code=stopped?'ACCESS_GUARD_STOP':'ACCESS_GUARD_CRITICAL';
    throw failure;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await runWatchdogOnce();
    console.log('PASS: '+result.verifiedRoutes+' Cloudflare Access anonymous challenge checks; continue operator-only allowed/denied identity audits.');
  }catch(error){
    // Do not log the failure cause verbatim; it could contain local file paths.
    console.error(error instanceof Error?error.message:'Cloudflare Access watchdog failed');
    process.exitCode=1;
  }
}
