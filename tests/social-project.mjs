import {mkdtemp,symlink,copyFile,cp,rm} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';

export async function socialProject(root){
 const project=await mkdtemp(path.join(root,'.social-project-'));
 await cp(path.join(root,'app'),path.join(project,'app'),{recursive:true});
 for(const name of ['components','db','drizzle','hooks','lib','public','node_modules'])
  await symlink(path.join(root,name),path.join(project,name),process.platform==='win32'?'junction':'dir');
 for(const name of ['next.config.ts','tsconfig.json','next-env.d.ts','package.json','postcss.config.mjs'])
  await copyFile(path.join(root,name),path.join(project,name));
 return project;
}

export async function startSocialServer(t,root,port){
 const data=await mkdtemp(path.join(root,'.social-api-')),project=await socialProject(root);
 const base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,[path.join(root,'tests','social-server.mjs')],{cwd:root,env:{...process.env,MEMESPACE_PORT:String(port),MEMESPACE_DATA_DIR:data,MEMESPACE_TEST_PROJECT:project},stdio:['ignore','pipe','pipe']});
 let output='';
 server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
 t.after(async()=>{
  if(server.exitCode===null){
   const exited=new Promise(resolve=>server.once('exit',resolve));
   server.kill('SIGTERM');await Promise.race([exited,delay(5000)]);
  }
  await rm(data,{recursive:true,force:true,maxRetries:10,retryDelay:250});
  await rm(project,{recursive:true,force:true,maxRetries:10,retryDelay:250});
 });
 let ready=false;
 for(let i=0;i<180&&server.exitCode===null;i++){
  try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(3000)})).ok){ready=true;break}}catch{}
  await delay(250);
 }
 assert.ok(ready,output);
 return {data,base,logs:()=>output};
}
