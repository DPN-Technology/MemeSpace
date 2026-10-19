import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {rawDatabase} from '@/db/raw';
import {livePage} from '@/lib/site-pages.mjs';
import '../../../admin/public/cms-blocks.css';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Block={id:string;type:string;[key:string]:any};
type Params={params:Promise<{slug:string}>};

const load=(slug:string)=>/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)?livePage(rawDatabase(),slug) as {slug:string;title:string;description:string;blocks:Block[]}|null:null;
// Stored links were validated when saved; check again so a tampered row can never emit a script URL.
const href=(v:unknown)=>typeof v==='string'&&/^(https?:\/\/|\/(?!\/))/i.test(v)?v:'';
const external=(v:string)=>/^https?:/i.test(v);
const paras=(t:unknown)=>String(t??'').split(/\n{2,}/).filter(s=>s.trim()).map((p,i)=><p key={i}>{p.trim().split('\n').flatMap((line,n)=>n?[<br key={'b'+n}/>,line]:[line])}</p>);
function A({to,className,children}:{to:string;className?:string;children:React.ReactNode}){
 return external(to)?<a className={className} href={to} rel="noopener noreferrer">{children}</a>:<Link className={className} href={to}>{children}</Link>;
}
function Render({b}:{b:Block}){
 switch(b.type){
  case 'hero':{const to=href(b.buttonUrl);return <section className="cms-hero">{b.eyebrow&&<small>{b.eyebrow}</small>}<h2>{b.title}</h2>{b.text&&<p>{b.text}</p>}{b.buttonLabel&&to&&<A to={to} className="cms-btn">{b.buttonLabel}</A>}</section>}
  case 'heading':return b.level===3?<h3 className="cms-h">{b.text}</h3>:<h2 className="cms-h">{b.text}</h2>;
  case 'text':return <div>{paras(b.text)}</div>;
  case 'list':{const items=(b.items||[]).map((s:string,i:number)=><li key={i}>{s}</li>);return b.ordered?<ol>{items}</ol>:<ul>{items}</ul>}
  case 'quote':return <blockquote className="cms-quote">{paras(b.text)}{b.cite&&<footer>— {b.cite}</footer>}</blockquote>;
  case 'callout':return <aside className={'cms-callout '+(['success','warning'].includes(b.tone)?b.tone:'info')}>{b.title&&<b>{b.title}</b>}{paras(b.text)}</aside>;
  case 'image':{const src=href(b.url);return src?<figure className="cms-figure"><img src={src} alt={b.alt||''} loading="lazy" referrerPolicy="no-referrer"/>{b.caption&&<figcaption>{b.caption}</figcaption>}</figure>:null}
  case 'button':{const to=href(b.url);return to?<div className="cms-actions"><A to={to} className={'cms-btn'+(b.style==='ghost'?' ghost':'')}>{b.label}</A></div>:null}
  case 'divider':return <hr/>;
  case 'faq':return <div className="cms-faq">{(b.items||[]).map((i:{q:string;a:string},n:number)=><details key={n}><summary>{i.q}</summary>{paras(i.a)}</details>)}</div>;
  case 'cards':return <div className="cms-cards">{(b.items||[]).map((i:{title:string;text:string;url:string},n:number)=>{const to=href(i.url),inner=<><b>{i.title}</b><span>{i.text}</span></>;return to?<A key={n} to={to} className="cms-card">{inner}</A>:<div key={n} className="cms-card">{inner}</div>})}</div>;
  default:return null;
 }
}
export async function generateMetadata({params}:Params):Promise<Metadata>{
 const page=load((await params).slug);
 return page?{title:page.title+' · MemeSpace',description:page.description||undefined}:{title:'Page not found · MemeSpace'};
}
export default async function CustomPage({params}:Params){
 const page=load((await params).slug);
 if(!page)notFound();
 return <main style={{minHeight:'100svh',background:'radial-gradient(60% 40% at 50% 0,#8b7bff22,transparent 70%),#05060b',padding:'clamp(18px,4vw,56px) 18px 80px'}}>
  <div style={{maxWidth:760,margin:'0 auto 28px'}}><Link href="/" style={{display:'inline-flex',alignItems:'center',gap:8,color:'#9aa6b8',fontSize:14,textDecoration:'none'}}><ArrowLeft size={16}/> Meme Mind</Link></div>
  <header style={{maxWidth:760,margin:'0 auto 34px',textAlign:'center'}}>
   <h1 style={{margin:0,fontSize:'clamp(32px,6vw,54px)',letterSpacing:'-.04em',lineHeight:1.05,color:'#f3f6fb'}}>{page.title}</h1>
   {page.description&&<p style={{margin:'14px auto 0',maxWidth:'56ch',color:'#9aa6b8',fontSize:18,lineHeight:1.6}}>{page.description}</p>}
  </header>
  <article className="cms">{page.blocks.map(b=><Render key={b.id} b={b}/>)}</article>
 </main>;
}
