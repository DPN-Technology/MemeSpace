// Browser-side Solana wallet flow (issue #25). Works with Phantom's injected provider and
// any provider exposing the same connect/signMessage surface. The wallet only ever signs a
// plain-text login message; MemeSpace never requests a transaction or sees a private key.
export type WalletKey={toString():string};
export type WalletProvider={
  isPhantom?:boolean;
  connect():Promise<{publicKey:WalletKey}|void>;
  publicKey?:WalletKey|null;
  signMessage(message:Uint8Array,display?:'utf8'|'hex'):Promise<{signature:Uint8Array}|Uint8Array>;
};
export type WalletRequest=(path:string,method?:string,payload?:unknown)=>Promise<any>;
export type WalletPurpose='signin'|'link';

export function findWalletProvider(host:any=typeof window==='undefined'?undefined:window):WalletProvider|null{
  const candidate=host?.phantom?.solana??host?.solana;
  return candidate&&typeof candidate.connect==='function'&&typeof candidate.signMessage==='function'?candidate:null;
}

export function toBase64(bytes:Uint8Array){let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}

export function walletErrorMessage(error:unknown){
  const code=(error as {code?:unknown})?.code;
  if(code===4001||/reject|denied|cancel/i.test((error as Error)?.message??''))return 'You cancelled the request in your wallet. Nothing was signed.';
  return error instanceof Error&&error.message?error.message:'The wallet request could not be completed.';
}

export async function authorizeWithWallet(provider:WalletProvider,request:WalletRequest,purpose:WalletPurpose='signin'){
  const connected=await provider.connect();
  const key=(connected&&'publicKey' in connected?connected.publicKey:provider.publicKey)?.toString();
  if(!key)throw new Error('Your wallet did not share an address.');
  const challenge=await request('wallet/challenge','POST',{address:key,purpose});
  const signed=await provider.signMessage(new TextEncoder().encode(String(challenge.message)),'utf8');
  const bytes=signed instanceof Uint8Array?signed:signed.signature;
  return {address:key,result:await request('wallet/verify','POST',{address:key,nonce:challenge.nonce,signature:toBase64(bytes),purpose})};
}

export const shortWallet=(address:string)=>address.length>10?`${address.slice(0,4)}…${address.slice(-4)}`:address;
