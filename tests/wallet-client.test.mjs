import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeWithWallet,findWalletProvider,toBase64,walletErrorMessage,shortWallet} from '../app/wallet-client.ts';

const ADDRESS='7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
function provider(overrides={}){
  const calls=[];
  return {calls,connect:async()=>({publicKey:{toString:()=>ADDRESS}}),signMessage:async(m,d)=>{calls.push([new TextDecoder().decode(m),d]);return {signature:new Uint8Array([1,2,3,250])}},...overrides};
}
function server(){
  const calls=[];
  const request=async(path,method='GET',payload)=>{calls.push([path,method,payload]);return path==='wallet/challenge'?{nonce:'n1',message:'sign me'}:{ok:true}};
  return {calls,request};
}

test('finds Phantom or a compatible injected provider only when usable',()=>{
  const p=provider();
  assert.equal(findWalletProvider({phantom:{solana:p}}),p);
  assert.equal(findWalletProvider({solana:p}),p);
  assert.equal(findWalletProvider({phantom:{solana:{connect(){}}}}),null);
  assert.equal(findWalletProvider({}),null);
  assert.equal(findWalletProvider(undefined),null);
});

test('signs only the server-issued message and posts the base64 signature',async()=>{
  const p=provider(),s=server();
  const out=await authorizeWithWallet(p,s.request,'signin');
  assert.equal(out.address,ADDRESS);
  assert.deepEqual(p.calls,[['sign me','utf8']]);
  assert.deepEqual(s.calls[0],['wallet/challenge','POST',{address:ADDRESS,purpose:'signin'}]);
  assert.deepEqual(s.calls[1],['wallet/verify','POST',{address:ADDRESS,nonce:'n1',signature:toBase64(new Uint8Array([1,2,3,250])),purpose:'signin'}]);
});

test('accepts providers that return raw bytes or only expose publicKey',async()=>{
  const p=provider({connect:async()=>{},publicKey:{toString:()=>ADDRESS},signMessage:async()=>new Uint8Array([9])});
  const s=server();
  assert.equal((await authorizeWithWallet(p,s.request,'link')).address,ADDRESS);
  assert.equal(s.calls[1][2].signature,toBase64(new Uint8Array([9])));
  assert.equal(s.calls[1][2].purpose,'link');
});

test('a rejected signature or missing address stops before verification',async()=>{
  const s=server();
  await assert.rejects(authorizeWithWallet(provider({signMessage:async()=>{throw Object.assign(new Error('User rejected the request.'),{code:4001})}}),s.request),/rejected/);
  assert.equal(s.calls.some(c=>c[0]==='wallet/verify'),false);
  await assert.rejects(authorizeWithWallet(provider({connect:async()=>{}}),server().request),/did not share an address/);
});

test('error and address helpers are user-friendly',()=>{
  assert.match(walletErrorMessage({code:4001}),/cancelled/);
  assert.match(walletErrorMessage(new Error('denied by user')),/cancelled/);
  assert.equal(walletErrorMessage(new Error('Wallet signature was not valid.')),'Wallet signature was not valid.');
  assert.match(walletErrorMessage(null),/could not be completed/);
  assert.equal(shortWallet(ADDRESS),'7xKX…gAsU');
  assert.equal(toBase64(new Uint8Array([72,105])),'SGk=');
});
