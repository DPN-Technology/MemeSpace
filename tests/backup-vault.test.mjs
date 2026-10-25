import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {encryptSnapshot,restoreSnapshot,verifyEncryptedSnapshot} from '../scripts/backup-vault.mjs';

test('encrypted backup round-trip restores a usable SQLite database and preserves rows',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'memespace-vault-test-'));
  const src=join(dir,'source.sqlite'),vault=join(dir,'offline.msvault'),restored=join(dir,'recovered.sqlite');
  const pass='valid-long-restore-passphrase-only-for-CI';
  try{
    const db=new DatabaseSync(src);
    db.exec("CREATE TABLE account_recovery(id TEXT PRIMARY KEY, note TEXT);INSERT INTO account_recovery VALUES('seed','sensitive CI fixture')");
    db.close();
    await encryptSnapshot(src,vault,pass);
    const bytes=await readFile(vault);
    assert.equal(bytes.subarray(0,8).toString(),'MSVAULT1');
    assert.equal(bytes.includes(Buffer.from('sensitive CI fixture')),false,'backup leaked plaintext');
    assert.equal((await verifyEncryptedSnapshot(vault,pass)).valid,true);
    await restoreSnapshot(vault,restored,pass);
    const recovered=new DatabaseSync(restored,{readOnly:true});
    try{assert.equal(recovered.prepare('SELECT note FROM account_recovery WHERE id=?').get('seed').note,'sensitive CI fixture')}finally{recovered.close()}
    await assert.rejects(restoreSnapshot(vault,restored,pass),/EEXIST/,'never overwrite a recovery target');
    await assert.rejects(encryptSnapshot(src,vault,pass),/EEXIST/,'never overwrite existing encrypted backup');
    await assert.rejects(verifyEncryptedSnapshot(vault,'wrong-but-long-enough-passphrase'),/auth|authenticate|Unsupported|bad decrypt/i,'wrong secret must be rejected');
    const tampered=Buffer.from(bytes);tampered[50]^=0x80;
    const attack=join(dir,'tampered.msvault');await writeFile(attack,tampered);
    await assert.rejects(restoreSnapshot(attack,join(dir,'tampered-output.sqlite'),pass),/auth|authenticate|Unsupported|bad decrypt/i);
    await assert.rejects(stat(join(dir,'tampered-output.sqlite')),{code:'ENOENT'},'tampered output must not be retained');
    await assert.rejects(encryptSnapshot(src,join(dir,'weak-secret.msvault'),'123'),/16 to 4096/);
  }finally{await rm(dir,{recursive:true,force:true})}
});

test('malformed and non-database source files are rejected',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'memespace-vault-reject-'));
  try{
    const bad=join(dir,'text.sqlite');await writeFile(bad,'not a sqlite database');
    await assert.rejects(encryptSnapshot(bad,join(dir,'bad.msvault'),'this-is-a-long-passphrase'),/database|file|malformed|not a database/i);
    const fake=join(dir,'invalid.msvault');await writeFile(fake,Buffer.from('not an encrypted file'));
    await assert.rejects(verifyEncryptedSnapshot(fake,'this-is-a-long-passphrase'),/Invalid encrypted recovery artifact/);
  }finally{await rm(dir,{recursive:true,force:true})}
});
