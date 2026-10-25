// Create a consistent SQLite backup *inside* the persistent staging volume.
// A backup in this volume alone is NOT disaster recovery: encrypt and copy it off-host.
import {backup,DatabaseSync} from 'node:sqlite';
import {mkdir,chmod} from 'node:fs/promises';
import path from 'node:path';
import {dataDirectory} from '../../lib/local-database.mjs';

const data=dataDirectory();
const destinationDir=path.join(data,'snapshots');
await mkdir(destinationDir,{recursive:true,mode:0o700});
await chmod(destinationDir,0o700);
const file='memespace-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite';
const destination=path.join(destinationDir,file);
const database=new DatabaseSync(path.join(data,'memespace.sqlite'),{readOnly:true});
try{
  await backup(database,destination);
}finally{database.close();}
await chmod(destination,0o600);
const restored=new DatabaseSync(destination,{readOnly:true});
try{
  if(restored.prepare('PRAGMA quick_check').get()?.quick_check!=='ok')throw Error('SQLite snapshot quick_check failed');
}finally{restored.close();}
console.log('Consistent local SQLite snapshot verified: '+destination);
console.log('ACTION REQUIRED: copy this snapshot to an encrypted, access-controlled, OFF-HOST location and test restore.');
