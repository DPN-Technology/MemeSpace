import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase,adapter,importLegacyDatabase} from '../lib/local-database.mjs';
const source=fileURLToPath(new URL('../',import.meta.url));
function fixture(){const root=mkdtempSync(path.join(tmpdir(),'memespace-db-'));cpSync(path.join(source,'drizzle'),path.join(root,'drizzle'),{recursive:true});return root;}
test('migrations preserve saved data after close and reopen',async()=>{
 const root=fixture();let db;
 try{
  db=openDatabase(root);let q=adapter(db);
  await q.prepare('INSERT INTO profiles(user_id,name,bio,updated_at) VALUES(?,?,?,?)').bind('local_seedy','Diesel','Saved locally',1).run();
  db.close();db=openDatabase(root);q=adapter(db);
  assert.equal((await q.prepare('SELECT name FROM profiles WHERE user_id=?').bind('local_seedy').first()).name,'Diesel');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM _memespace_migrations').get().n,2);
  assert.equal((await q.prepare('SELECT name FROM profiles WHERE user_id=?').bind('missing').first()),null);
 }finally{db?.close();rmSync(root,{recursive:true,force:true})}
});
test('copies the old database and upgrades it without losing profiles',async()=>{
 const root=fixture();let db,old;
 try{
  const dir=path.join(root,'.wrangler/state/v3/d1/legacy');mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'original.sqlite');old=new DatabaseSync(file);
  old.exec(readFileSync(path.join(root,'drizzle/0000_sparkling_marten_broadcloak.sql'),'utf8'));
  old.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL)');
  old.prepare('INSERT INTO d1_migrations VALUES(?,?,?)').run(1,'0000_sparkling_marten_broadcloak.sql','2026-09-19');
  old.prepare('INSERT INTO profiles VALUES(?,?,?,?)').run('local_seedy','Diesel','Keep me',1);old.close();old=undefined;
  assert.equal(await importLegacyDatabase(root),true);db=openDatabase(root);
  assert.equal(db.prepare('SELECT name FROM profiles').get().name,'Diesel');
  assert.ok(db.prepare('PRAGMA table_info(messages)').all().some(c=>c.name==='channel'));
  assert.equal(await importLegacyDatabase(root),false);
  old=new DatabaseSync(file,{readOnly:true});assert.equal(old.prepare('SELECT bio FROM profiles').get().bio,'Keep me');
  assert.ok(!old.prepare('PRAGMA table_info(messages)').all().some(c=>c.name==='channel'));
 }finally{db?.close();old?.close();rmSync(root,{recursive:true,force:true})}
});
