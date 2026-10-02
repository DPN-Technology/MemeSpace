import {openDatabase} from '../lib/local-database.mjs';
import {changePassword} from '../lib/local-auth.mjs';
import {fileURLToPath} from 'node:url';
import {emitKeypressEvents} from 'node:readline';
const root=fileURLToPath(new URL('../',import.meta.url));
function hiddenPassword(prompt){
 if(!process.stdin.isTTY)throw Error('Run this command in an interactive terminal.');
 emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();process.stdout.write(prompt);let value='';
 return new Promise((resolve,reject)=>{const finish=(err)=>{process.stdin.off('keypress',read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');err?reject(err):resolve(value)};const read=(text,key)=>{if(key?.ctrl&&key.name==='c'){finish(Error('Cancelled.'));return}if(key?.name==='return'){finish();return}if(key?.name==='backspace'){value=value.slice(0,-1);return}if(text&&!key?.ctrl&&!key?.meta&&value.length<128&&!/[\u0000-\u001f\u007f]/.test(text))value+=text};process.stdin.on('keypress',read)});
}
let db;
try{
 db=openDatabase(root);const account=db.prepare("SELECT password_hash,email FROM accounts WHERE user_id='local_seedy'").get();
 if(!account?.password_hash.startsWith('legacy_unset$'))throw Error('The legacy owner is already password protected. Sign in using its existing credentials.');
 console.log('Set the first password for your preserved v2.2 member account.\nThis does not create admin access. Typed characters will be hidden.');
 const password=await hiddenPassword('New password (12–128 characters): '),confirm=await hiddenPassword('Confirm password: ');
 if(password!==confirm)throw Error('Passwords do not match. Nothing was changed.');
 changePassword(db,'local_seedy','',password,{legacy:true});console.log('Owner account claimed. Open the website and sign in as '+account.email+'.');
}catch(e){console.error(e.message);process.exitCode=1}finally{db?.close()}
