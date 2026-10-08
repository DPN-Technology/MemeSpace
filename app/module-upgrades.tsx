"use client";
import {useEffect,useRef,useState} from 'react';
import {useIdentityScope} from './identity-scope';
import {ArrowRight,Check,Copy,ExternalLink,RotateCcw,Save,Shield,Wallet} from 'lucide-react';

type LessonEntry={payload?:{text?:string}};
type ModuleId='learn';
type PhantomKey={toString:()=>string};
type PhantomError={code?:number;message?:string};
type PhantomProvider={isPhantom?:boolean;isConnected?:boolean;publicKey?:PhantomKey;connect:()=>Promise<{publicKey:PhantomKey}>;disconnect:()=>Promise<void>;on?:(name:string,fn:(key?:PhantomKey|null)=>void)=>void;removeListener?:(name:string,fn:(key?:PhantomKey|null)=>void)=>void};
type PhantomWindow=Window & {phantom?:{solana?:PhantomProvider}};

export function LessonNotes({id,title,entry,save,openIdentity}:{id:string;title:string;entry?:LessonEntry;save:(kind:string,key:string,payload:unknown)=>Promise<boolean>;openIdentity?:()=>void}){
  const scope=useIdentityScope();
  const [text,setText]=useState(''),[status,setStatus]=useState('');
  const dirty=useRef(false);
  useEffect(()=>{const timer=setTimeout(()=>{dirty.current=false;setText('');try{const draft=localStorage.getItem('memespace-note:'+scope+':'+id);if(draft!==null){setText(draft);dirty.current=true;}}catch{}},0);return()=>clearTimeout(timer)},[id,scope]);
  useEffect(()=>{const timer=setTimeout(()=>{if(!dirty.current)setText(entry?.payload?.text||'')},0);return()=>clearTimeout(timer)},[entry,id,scope]);
  return <section className="lesson-notes"><p className="micro-label">YOUR FIELD NOTES</p><h3>Make the idea your own.</h3><label className="field-label" htmlFor={'notes-'+id}>What do you want to remember?</label><textarea id={'notes-'+id} maxLength={1200} rows={5} value={text} placeholder="A useful definition, a question, or something to revisit…" onChange={e=>{dirty.current=true;setText(e.target.value);setStatus('Draft kept on this device.');try{localStorage.setItem('memespace-note:'+scope+':'+id,e.target.value)}catch{setStatus('Browser storage is unavailable. Save your notes before leaving.')}}}/><div className="module-toolbar"><button className="secondary-action" onClick={async()=>{if(await save('note',id,{title,text}))setStatus('Notes saved to your library.');else setStatus('Sign in to save your notes to your library. Your draft stays here.')}}><Save/>Save notes</button>{openIdentity&&<button type="button" className="identity-inline-link" onClick={openIdentity}>Open Identity Center</button>}<span className="micro-label">{text.length}/1200</span></div><p className="notice" role="status">{status||'Keep a draft on this device, or sign in to save it in your library.'}</p></section>;
}

export function SignalSequence(){
  const [sequence,setSequence]=useState<number[]>([]),[position,setPosition]=useState(0),[active,setActive]=useState(-1),[status,setStatus]=useState<'idle'|'watch'|'play'|'over'>('idle'),[speed,setSpeed]=useState('steady'),[score,setScore]=useState(0),[best,setBest]=useState(0);
  const feedback=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{const timer=setTimeout(()=>{try{setBest(Number(localStorage.getItem('memespace-sequence-best-'+speed))||0)}catch{}},0);return()=>clearTimeout(timer)},[speed]);
  useEffect(()=>()=>{if(feedback.current)clearTimeout(feedback.current)},[]);
  useEffect(()=>{
    if(status!=='watch')return;
    const interval=speed==='fast'?500:850,timers:ReturnType<typeof setTimeout>[]=[];
    sequence.forEach((pad,i)=>{timers.push(setTimeout(()=>setActive(pad),450+i*interval));timers.push(setTimeout(()=>setActive(-1),450+i*interval+interval*.65));});
    timers.push(setTimeout(()=>{setPosition(0);setStatus('play')},450+sequence.length*interval));
    return()=>timers.forEach(clearTimeout);
  },[sequence,status,speed]);
  function start(){setScore(0);setPosition(0);setActive(-1);setSequence([Math.floor(Math.random()*4)]);setStatus('watch')}
  function press(pad:number){
    if(status!=='play')return;
    if(feedback.current)clearTimeout(feedback.current);
    setActive(pad);feedback.current=setTimeout(()=>setActive(-1),180);
    if(sequence[position]!==pad){setStatus('over');return}
    if(position===sequence.length-1){const next=score+1;setScore(next);if(next>best){setBest(next);try{localStorage.setItem('memespace-sequence-best-'+speed,String(next))}catch{}}setSequence(s=>[...s,Math.floor(Math.random()*4)]);setStatus('watch');}else setPosition(p=>p+1);
  }
  return <div className="signal-game"><div className="game-stats"><span>SIGNAL SEQUENCE</span><span>{score} {score===1?'ROUND':'ROUNDS'} · BEST {best}</span></div><div className="module-toolbar">{['steady','fast'].map(s=><button className={'chip '+(speed===s?'selected':'')} key={s} disabled={status==='watch'||status==='play'} onClick={()=>setSpeed(s)}>{s==='steady'?'Steady pulse':'Fast pulse'}</button>)}</div><div className="sequence-readout" aria-live="polite"><h2>{status==='watch'?'Watch the signal.':status==='play'?'Your turn.':status==='over'?'Connection interrupted.':'Follow the pattern.'}</h2><p>{status==='play'?`Signal ${position+1} of ${sequence.length}`:status==='watch'?`Round ${sequence.length} · remember the order`:status==='over'?`${score} ${score===1?'round':'rounds'} completed. Ready for another run?`:'Four receptors. One growing sequence.'}</p></div><div className="sequence-grid">{['01','10','11','00'].map((n,i)=><button key={n} aria-label={'Signal pad '+(i+1)} aria-pressed={active===i} disabled={status!=='play'} className={'sequence-pad pad-'+i+(active===i?' lit':'')} onClick={()=>press(i)}><strong>{n}</strong><span>RECEPTOR 0{i+1}</span></button>)}</div>{status==='idle'||status==='over'?<button className="primary-action" onClick={start}><RotateCcw/>{status==='over'?'Try again':'Start sequence'}</button>:<button className="secondary-action" onClick={()=>{setStatus('idle');setActive(-1)}}>End run</button>}<p className="notice">Watch the lit receptors, then repeat the exact order. Each completed round adds one signal. Your best score stays on this device.</p></div>;
}

export function WalletDashboard({open}:{open:(id:ModuleId,target?:string)=>void}){
  const [provider,setProvider]=useState<PhantomProvider|null>(null),[address,setAddress]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{const detect=()=>setProvider((window as PhantomWindow).phantom?.solana||null);const timer=setTimeout(detect,0);window.addEventListener('focus',detect);return()=>{clearTimeout(timer);window.removeEventListener('focus',detect)}},[]);
  useEffect(()=>{
    if(!provider?.isPhantom)return;
    const connected=()=>setAddress(provider.isConnected?provider.publicKey?.toString()||'':''),changed=(key?:PhantomKey|null)=>setAddress(key?.toString()||''),disconnected=()=>setAddress('');
    const timer=setTimeout(connected,0);provider.on?.('connect',connected);provider.on?.('accountChanged',changed);provider.on?.('disconnect',disconnected);
    return()=>{clearTimeout(timer);provider.removeListener?.('connect',connected);provider.removeListener?.('accountChanged',changed);provider.removeListener?.('disconnect',disconnected)};
  },[provider]);
  async function connect(){setBusy(true);setError('');try{const p=(window as PhantomWindow).phantom?.solana;if(!p?.isPhantom)throw Error('Open MemeSpace in a browser with the Phantom extension or its in-app browser.');setProvider(p);setAddress((await p.connect()).publicKey.toString())}catch(error:unknown){const e=error as PhantomError;setError(e.code===4001?'Connection cancelled. You can reconnect whenever you are ready.':e.message||'Connection failed.')}finally{setBusy(false)}}
  return <div className="wallet-dashboard"><section className="wallet-identity"><div className="module-toolbar"><span className="micro-label">SOLANA / PHANTOM</span><span className={'connection-state '+(address?'connected':'')}>{address?'CONNECTED':'DISCONNECTED'}</span></div><div className="wallet-emblem"><Wallet/></div><h2>{address?'Your connection is live.':'Your keys. Your connection.'}</h2><p>{address?'Your public address is available to this session. Account changes in Phantom appear here automatically.':'Connect your wallet to bring your public identity into the mind.'}</p>{address?<><label className="field-label">PUBLIC ADDRESS</label><code className="wallet-address">{address}</code><div className="module-toolbar"><button className="secondary-action" onClick={async()=>{try{await navigator.clipboard.writeText(address);setNotice('Public address copied.')}catch{setNotice('Select the address above to copy it manually.')}}}><Copy/>Copy address</button><a className="secondary-action" target="_blank" rel="noreferrer" href={'https://explorer.solana.com/address/'+encodeURIComponent(address)}><ExternalLink/>View on Solana Explorer</a></div><button className="secondary-action" disabled={busy} onClick={async()=>{setError('');setBusy(true);try{await provider?.disconnect();setAddress('');setNotice('Wallet disconnected.')}catch{setError('Could not disconnect. You can revoke access in Phantom.')}finally{setBusy(false)}}}>Disconnect wallet</button></>:<><button className="primary-action" disabled={busy} onClick={connect}><Wallet/>{busy?'Waiting for Phantom…':'Connect Phantom'}</button><p className="notice">{provider?.isPhantom?'Phantom detected in this browser.':'Phantom is not detected in this browser.'}</p></>}{error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}</section><aside className="wallet-details"><article className="module-card"><Shield/><h3>You stay in control.</h3><p>This connection shares your public address. This release does not request signatures or move assets.</p><div className="permission-line"><Check/>Public address</div><div className="permission-line"><Check/>Wallet account updates</div><p className="notice">Balances and transactions can be viewed in the external explorer. MemeSpace does not retrieve them automatically.</p></article><article className="module-card"><h3>Understand the connection.</h3><p>Explore how wallets, keys and signatures fit together.</p><button className="secondary-action" onClick={()=>open('learn','wallets')}>Open the wallet lesson<ArrowRight/></button></article><p className="notice">Wallet connections and your MemeSpace profile are separate. Never enter a recovery phrase into a website.</p></aside></div>;
}
