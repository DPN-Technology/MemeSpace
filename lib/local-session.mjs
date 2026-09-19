import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {dataDirectory} from './local-database.mjs';

export const localCookie='memespace_local_session';
export const localUser={userId:'local_seedy',displayName:'Local Owner',email:'owner@localhost',fullName:'Local Owner'};
const duration=7*24*60*60;
function secret(){
  const dir=dataDirectory();mkdirSync(dir,{recursive:true});const file=path.join(dir,'session.key');
  try{return readFileSync(file)}catch(error){if(error.code!=='ENOENT')throw error;}
  try{writeFileSync(file,randomBytes(32),{flag:'wx',mode:0o600})}catch(error){if(error.code!=='EEXIST')throw error}
  return readFileSync(file);
}
export function localRequest(headers){
  if(process.env.MEMESPACE_LOCAL_MODE!=='1')return false;
  try{const u=new URL('http://'+headers.get('host'));return !u.username&&!u.password&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&u.port===(process.env.MEMESPACE_PORT||'5173')}catch{return false}
}
export function sameOrigin(request){
  if(!localRequest(request.headers)||request.headers.get('sec-fetch-site')==='cross-site')return false;
  const origin=request.headers.get('origin');return !origin||origin===new URL(new URL(request.url).protocol+'//'+request.headers.get('host')).origin;
}
export function safeReturn(value){
  if(!value?.startsWith('/')||value.startsWith('//'))return '/';
  try{const u=new URL(value,'http://localhost');return u.origin==='http://localhost'&&!['/signin-with-chatgpt','/signout-with-chatgpt','/callback'].includes(u.pathname)?u.pathname+u.search+u.hash:'/'}catch{return '/'}
}
export function sessionCookie(){
  const payload=String(Math.floor(Date.now()/1000)+duration);
  const signature=createHmac('sha256',secret()).update(payload).digest('base64url');
  return `${localCookie}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${duration}`;
}
export function readLocalSession(headers){
  if(!localRequest(headers))return null;
  const values=(headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(localCookie+'='));
  if(values.length!==1)return null;
  const [expiry,signature,...rest]=values[0].slice(localCookie.length+1).split('.');
  if(rest.length||!/^\d{10}$/.test(expiry)||!signature||Number(expiry)<Date.now()/1000)return null;
  const expected=createHmac('sha256',secret()).update(expiry).digest('base64url');
  const a=Buffer.from(signature),b=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b)?localUser:null;
}
