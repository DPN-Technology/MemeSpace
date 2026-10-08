import {spawn} from 'node:child_process';
import {access,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {backup} from 'node:sqlite';
import {openDatabase,importLegacyDatabase,dataDirectory} from '../lib/local-database.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const command=process.argv[2]||'start',port=Number(process.env.MEMESPACE_PORT||5173);
if(Number(process.versions.node.split('.')[0])<24)throw Error('Install Node.js 24 or newer, then open a new terminal.');
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('MEMESPACE_PORT must be from 1024 to 65535.');
process.env.MEMESPACE_PORT=String(port);process.env.NEXT_TELEMETRY_DISABLED='1';process.env.MEMESPACE_LOCAL_MODE='1';
process.env.MEMESPACE_DATA_DIR=dataDirectory(root);
let currentChild;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{currentChild?.kill(signal);process.exit(signal==='SIGINT'?130:143)});
async function installed(){try{await access(path.join(root,'node_modules/next/dist/bin/next'))}catch{throw Error('Run SETUP-WINDOWS.cmd first to install dependencies.')}}
async function run(exe,args,options={}){
  const child=spawn(exe,args,{cwd:root,stdio:'inherit',...options});currentChild=child;
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});currentChild=undefined;
  if(code!==0)throw Error(`Command stopped (${code??'signal'}). Read the error above. Your database was not removed.`);
}
async function migrate(){
  const imported=await importLegacyDatabase(root),db=openDatabase(root);db.close();
  console.log(imported?'Copied your previous local database. The original remains untouched.':'Local SQLite database is ready.');
}
async function serve(production=false){
  await installed();await migrate();
  console.log('Starting MemeSpace on Node.js. Waiting for the server and database check...');
  const args=['node_modules/next/dist/bin/next',production?'start':'dev',...(!production?['--webpack']:[]),'--hostname','127.0.0.1','--port',String(port)];
  const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit'});currentChild=child;let stopped=false;
  const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>{stopped=true;resolve(code)})});
  void (async()=>{
    for(let i=0;i<240&&!stopped;i++){
      try{const r=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(3000)});if(r.ok&&(await r.json()).runtime==='node'){
        if(!stopped)console.log(`\nMemeSpace is ready: http://localhost:${port}/\nUse Sign in inside the site for your local account. Press Ctrl+C to stop.\n`);return;
      }}catch{}
      await delay(500);
    }
    if(!stopped)console.error('The startup check is taking longer than expected. Check the server messages above.');
  })();
  const code=await done;currentChild=undefined;if(code!==0)throw Error('MemeSpace stopped before it could run. Read the server error above.');
}
try{
  if(command==='setup'){
    if(!process.argv.includes('--skip-install'))await run('npm',['exec','--yes','--package=pnpm@11.25.0','--','pnpm','install','--frozen-lockfile','--prod=false'],{shell:process.platform==='win32'});
    await installed();await migrate();console.log('\nSetup complete. Open START-WINDOWS.cmd next.');
  }else if(command==='start')await serve();
  else if(command==='serve')await serve(true);
  else if(command==='build'){
    await installed();await migrate();
    // Next's persisted page responses can point to the prior client bundle after a rebuild.
    // Only discard generated route responses; application data and backups live elsewhere.
    await rm(path.join(root,'.next/server/route-cache'),{recursive:true,force:true});
    await run(process.execPath,['node_modules/next/dist/bin/next','build','--webpack']);
  }
  else if(command==='migrate')await migrate();
  else if(command==='backup'){
    await migrate();const folder=path.join(root,'backups');await mkdir(folder,{recursive:true});
    const destination=path.join(folder,'memespace-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite'),db=openDatabase(root);
    try{await backup(db,destination)}finally{db.close()}
    console.log('Database backup saved: '+destination);
  }else if(command==='test')await run(process.execPath,['--test','--test-concurrency=1','tests/local-database.test.mjs','tests/local-auth.test.mjs','tests/identity-ui.test.mjs','tests/admin.test.mjs','tests/arcade.test.mjs','tests/arcade-extra.test.mjs','tests/local-startup.test.mjs','tests/chat-history.test.mjs'],{env:{...process.env,MEMESPACE_DATA_DIR:''}});
  else throw Error('Use setup, start, build, serve, migrate, backup, or test.');
}catch(error){console.error('\n'+error.message);process.exitCode=1;}
