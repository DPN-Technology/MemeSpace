// MemeSpace operator-only encrypted SQLite recovery artifacts.
// Format: "MSVAULT1" (8) | scrypt salt (16) | AES-256-GCM IV (12) |
// encrypted SQLite bytes | authentication tag (16).
// No password on the command line. NEVER overwrite an existing recovery file.
import {createCipheriv,createDecipheriv,randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {createReadStream,createWriteStream} from 'node:fs';
import {open,stat,rm,appendFile,mkdtemp,chmod} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';

const magic=Buffer.from('MSVAULT1','ascii');
const headerSize=36,tagSize=16,saltSize=16,ivSize=12;
const kdf={N:32768,r:8,p:1,maxmem:64*1024*1024};
const derive=promisify(scrypt);

function validateSecret(secret){
  const value=Buffer.isBuffer(secret)?secret:Buffer.from(String(secret??''),'utf8');
  if(value.length<16||value.length>4096)throw Error('Backup passphrase must be 16 to 4096 UTF-8 bytes');
  return value;
}
async function encryptionKey(secret,salt){return derive(validateSecret(secret),salt,32,kdf)}
export function verifySqlite(file){
  const db=new DatabaseSync(file,{readOnly:true});
  try{
    if(db.prepare('PRAGMA quick_check').get()?.quick_check!=='ok')throw Error('Recovered SQLite quick_check failed');
    // Detect truncated/empty generic SQLite files.
    const tables=Number(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get()?.n||0);
    if(tables===0)throw Error('Recovered SQLite contains no tables');
    return true;
  }finally{db.close()}
}
export async function encryptSnapshot(source,output,secret){
  const src=resolve(source),dest=resolve(output);
  if(src===dest)throw Error('Source and encrypted destination must differ');
  verifySqlite(src);
  const salt=randomBytes(saltSize),iv=randomBytes(ivSize);
  const key=await encryptionKey(secret,salt);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  key.fill(0);
  const header=Buffer.concat([magic,salt,iv]);
  let created=false;
  try{
    const handle=await open(dest,'wx',0o600);created=true;
    try{await handle.writeFile(header)}finally{await handle.close()}
    await pipeline(createReadStream(src),cipher,createWriteStream(dest,{flags:'a',mode:0o600}));
    await appendFile(dest,cipher.getAuthTag());
    await chmod(dest,0o600);
    return {path:dest,bytes:(await stat(dest)).size};
  }catch(err){if(created)await rm(dest,{force:true}).catch(()=>{});throw err}
}
async function decryptTo(source,destination,secret){
  const src=resolve(source),dest=resolve(destination);
  if(src===dest)throw Error('Never overwrite encrypted input');
  const size=(await stat(src)).size;
  if(size<=headerSize+tagSize)throw Error('Invalid encrypted recovery artifact');
  const file=await open(src,'r');
  let header,tag;
  try{
    header=Buffer.alloc(headerSize);tag=Buffer.alloc(tagSize);
    const h=await file.read(header,0,headerSize,0);
    const t=await file.read(tag,0,tagSize,size-tagSize);
    if(h.bytesRead!==headerSize||t.bytesRead!==tagSize||!header.subarray(0,8).equals(magic))throw Error('Invalid recovery envelope');
  }finally{await file.close()}
  const salt=header.subarray(8,24),iv=header.subarray(24,36);
  const key=await encryptionKey(secret,salt);
  const decipher=createDecipheriv('aes-256-gcm',key,iv);key.fill(0);
  decipher.setAuthTag(tag);
  let created=false;
  try{
    const handle=await open(dest,'wx',0o600);created=true;await handle.close();
    await pipeline(createReadStream(src,{start:headerSize,end:size-tagSize-1}),decipher,createWriteStream(dest,{flags:'w',mode:0o600}));
    verifySqlite(dest);
    await chmod(dest,0o600);
    return {path:dest,bytes:(await stat(dest)).size};
  }catch(err){if(created)await rm(dest,{force:true}).catch(()=>{});throw err}
}
export async function restoreSnapshot(encrypted,output,secret){return decryptTo(encrypted,output,secret)}
export async function verifyEncryptedSnapshot(encrypted,secret){
  const scratch=await mkdtemp(join(tmpdir(),'memespace-restore-check-'));
  try{
    const result=await decryptTo(encrypted,join(scratch,'restored.sqlite'),secret);
    return {valid:true,bytes:result.bytes};
  }finally{await rm(scratch,{recursive:true,force:true})}
}
async function readSecretFromStdin(){
  if(process.stdin.isTTY)throw Error('Supply a secret via private stdin pipe, never a command argument');
  let raw='',length=0;
  for await(const chunk of process.stdin){
    length+=chunk.length;
    if(length>4096)throw Error('Secret input exceeds maximum length');
    raw+=chunk.toString('utf8');
  }
  return validateSecret(Buffer.from(raw.replace(/\r?\n$/,''),'utf8'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const [mode,src,dest]=process.argv.slice(2);
    if(!['encrypt','verify','restore'].includes(mode)||!src||(mode!=='verify'&&!dest))throw Error('Usage: node scripts/backup-vault.mjs encrypt|restore <input> <output>, or verify <input> (secret via stdin)');
    const secret=await readSecretFromStdin();
    try{
      const result=mode==='encrypt'?await encryptSnapshot(src,dest,secret):mode==='restore'?await restoreSnapshot(src,dest,secret):await verifyEncryptedSnapshot(src,secret);
      console.log('PASS: '+(mode==='encrypt'?'encrypted SQLite artifact':mode==='restore'?'isolated SQLite restore':'authenticated artifact verification')+' ('+result.bytes+' bytes)');
    }finally{secret.fill(0)}
  }catch(err){console.error('Backup recovery operation FAILED: '+(err instanceof Error?err.message:'unknown error'));process.exitCode=1}
}
