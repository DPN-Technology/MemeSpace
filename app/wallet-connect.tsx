"use client";
import {useEffect,useState} from 'react';
import {Wallet,Unlink} from 'lucide-react';
import {authorizeWithWallet,findWalletProvider,shortWallet,walletErrorMessage} from './wallet-client';
import type {WalletPurpose,WalletRequest} from './wallet-client';

type Linked={address:string;linkedAt:number;lastUsedAt:number};
type Props={purpose:WalletPurpose;request:WalletRequest;onSignedIn?:()=>void|Promise<void>};

export function WalletConnect({purpose,request,onSignedIn}:Props){
  const [available,setAvailable]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[wallets,setWallets]=useState<Linked[]>([]);
  useEffect(()=>{setAvailable(!!findWalletProvider())},[]);
  async function load(){if(purpose!=='link')return;try{setWallets((await request('wallet')).wallets||[])}catch{setWallets([])}}
  useEffect(()=>{load()},[purpose]);
  async function connect(){
    const provider=findWalletProvider();if(!provider){setAvailable(false);return}
    setBusy(true);setError('');setStatus('');
    try{
      const {address}=await authorizeWithWallet(provider,request,purpose);
      if(purpose==='link'){setStatus(`Linked ${shortWallet(address)}.`);await load()}else{setStatus('Signed in with your wallet.');await onSignedIn?.()}
    }catch(cause){setError(walletErrorMessage(cause))}finally{setBusy(false)}
  }
  async function unlink(address:string){
    setBusy(true);setError('');setStatus('');
    try{await request('wallet','DELETE',{address});setStatus(`Unlinked ${shortWallet(address)}.`);await load()}
    catch(cause){setError(walletErrorMessage(cause))}finally{setBusy(false)}
  }
  return <section className="wallet-connect" aria-label={purpose==='link'?'Linked wallets':'Wallet sign-in'}>
    <p className="micro-label">{purpose==='link'?'SOLANA WALLETS':'OR USE A WALLET'}</p>
    <button type="button" className="primary-action" disabled={busy||available===false} onClick={connect}>{busy?'Waiting for wallet…':purpose==='link'?'Link Phantom wallet':'Sign in with Phantom'}<Wallet/></button>
    {available===false&&<p className="notice" role="status">No Solana wallet was found. Install <a href="https://phantom.com/download" target="_blank" rel="noreferrer noopener">Phantom</a> and reload.</p>}
    <p className="identity-local-note">You only sign a short message. It never moves funds and MemeSpace never sees your keys.</p>
    {purpose==='link'&&wallets.length>0&&<ul className="wallet-list">{wallets.map(w=><li key={w.address}><code title={w.address}>{shortWallet(w.address)}</code><button type="button" disabled={busy} onClick={()=>unlink(w.address)} aria-label={`Unlink ${shortWallet(w.address)}`}><Unlink/>Unlink</button></li>)}</ul>}
    {error&&<p className="error" role="alert">{error}</p>}{status&&<p className="notice" role="status">{status}</p>}
  </section>;
}
