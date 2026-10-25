'use client';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {ArrowLeft} from 'lucide-react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {SocialNetwork} from '../social-network';
import {IdentityCenter,type IdentityAccount} from '../identity-center';
import {MindNav} from '../mind-nav';
import {modules} from '../mind-modules';
const motionQuery='(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(onChange:()=>void){const media=matchMedia(motionQuery);media.addEventListener('change',onChange);addEventListener('storage',onChange);return()=>{media.removeEventListener('change',onChange);removeEventListener('storage',onChange)}}
const readReducedMotion=()=>matchMedia(motionQuery).matches||localStorage.getItem('memespace-reduced')==='true';
export default function SocialPage(){
 const router=useRouter();
 const [identityOpen,setIdentityOpen]=useState(false);
 const [account,setAccount]=useState<IdentityAccount|null>(null);
 const reduced=useSyncExternalStore(subscribeReducedMotion,readReducedMotion,()=>false);
 useEffect(()=>{let alive=true;fetch('/api/auth/session',{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{account:IdentityAccount|null}>:null).then(data=>{if(alive&&data)setAccount(data.account||null)}).catch(()=>{});return()=>{alive=false}},[]);
 return <div className={reduced?'no-motion':undefined} style={{background:'#030807',minHeight:'100svh',padding:'clamp(12px,2vw,35px)'}}>
  <div style={{maxWidth:1720,margin:'0 auto'}}>
   <nav aria-label="Return navigation" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:15}}>
    <Link href="/" style={{display:'inline-flex',alignItems:'center',gap:7,color:'#aefdbd',fontSize:12,letterSpacing:1}}><ArrowLeft size={16}/> RETURN TO THE MEME MIND</Link>
    <button style={{padding:'10px 13px',border:'1px solid #426d51',borderRadius:8,color:'#c7ffd6',background:'#11271a',fontSize:12}} onClick={()=>setIdentityOpen(true)}>{account?'ACCOUNT · '+account.displayName:'SIGN IN / JOIN'}</button>
   </nav>
   <MindNav nodes={modules} active="social" onGo={id=>{if(id!=='social')router.push('/#'+id)}}/>
   <SocialNetwork key={account?.userId||'guest'} openIdentity={()=>setIdentityOpen(true)}/>
  </div>
  <IdentityCenter open={identityOpen} onOpenChange={setIdentityOpen} account={account} onAccountChange={setAccount}/>
 </div>;
}
