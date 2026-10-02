import {DatabaseSync,backup} from 'node:sqlite';
import {existsSync,mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import path from 'node:path';

export function dataDirectory(root=process.cwd()){
  return path.resolve(process.env.MEMESPACE_DATA_DIR || path.join(root,'data'));
}
export function migrate(db,root=process.cwd()){
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  db.exec('CREATE TABLE IF NOT EXISTS _memespace_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  const journal=JSON.parse(readFileSync(path.join(root,'drizzle/meta/_journal.json'),'utf8'));
  const hasLegacy=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'").get();
  for(const {tag} of journal.entries){
    const name=tag+'.sql',sql=readFileSync(path.join(root,'drizzle',name),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try{
      const applied=db.prepare('SELECT hash FROM _memespace_migrations WHERE name=?').get(name);
      if(applied){if(applied.hash!==hash)throw Error('An applied migration was changed: '+name);}
      else{
        const legacy=hasLegacy && db.prepare('SELECT name FROM d1_migrations WHERE name=?').get(name);
        if(!legacy)db.exec(sql);
        db.prepare('INSERT INTO _memespace_migrations(name,hash,applied_at) VALUES(?,?,?)').run(name,hash,Date.now());
      }
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  ensureLegacyOwner(db);
}

function ensureLegacyOwner(db){
  const existing=db.prepare('SELECT user_id FROM accounts WHERE user_id=?').get('local_seedy');
  if(existing)return;
  const now=Date.now();
  const marker='legacy_unset$'+randomBytes(24).toString('base64url');
  const salt=randomBytes(16).toString('base64url');
  const emailTaken=db.prepare('SELECT user_id FROM accounts WHERE email=?').get('owner@localhost');
  const email=emailTaken?'legacy-local-seedy@localhost':'owner@localhost';
  db.prepare('INSERT INTO accounts(user_id,email,password_hash,password_salt,display_name,created_at,updated_at,last_login_at,failed_attempts,locked_until,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('local_seedy',email,marker,salt,'Local Owner',now,now,0,0,0,0);
}
export function openDatabase(root=process.cwd()){
  const dir=dataDirectory(root);mkdirSync(dir,{recursive:true});
  const db=new DatabaseSync(path.join(dir,'memespace.sqlite'));
  try{migrate(db,root);return db}catch(error){db.close();throw error}
}
function legacyFiles(dir){
  if(!existsSync(dir))return [];
  return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?legacyFiles(path.join(dir,e.name)):e.isFile()&&e.name.endsWith('.sqlite')?[path.join(dir,e.name)]:[]);
}
export async function importLegacyDatabase(root=process.cwd()){
  const dir=dataDirectory(root),target=path.join(dir,'memespace.sqlite');
  if(existsSync(target))return false;
  const matches=legacyFiles(path.join(root,'.wrangler/state/v3/d1')).filter(file=>{
    let db;try{db=new DatabaseSync(file,{readOnly:true});return db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('profiles','messages','d1_migrations')").get().n===3;}finally{db?.close()}
  });
  if(matches.length>1)throw Error('Multiple old databases found. Preserve them and select the correct database before migrating.');
  if(!matches.length)return false;
  mkdirSync(dir,{recursive:true});const old=new DatabaseSync(matches[0],{readOnly:true});
  try{await backup(old,target)}finally{old.close()}
  return true;
}
export function adapter(db){
  return {prepare(sql){
    function bound(values){return {
      bind(...next){return bound(next)},
      async all(){return {results:db.prepare(sql).all(...values),success:true}},
      async first(){return db.prepare(sql).get(...values) || null},
      async run(){const result=db.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
    }}
    return bound([]);
  }};
}
