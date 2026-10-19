import {randomUUID} from 'node:crypto';

export const BLOCK_LIMIT=60,REVISION_LIMIT=50,RESERVED_SLUGS=['api','admin','social','arcade','p','_next','static','login','signin','signup'];
const text=(v,label,max,{min=0,lines=false}={})=>{
 if(v==null)v='';
 if(typeof v!=='string')throw invalid(`${label} must be text.`);
 const clean=v.replace(/\r\n?/g,'\n');
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(clean)||(!lines&&clean.includes('\n')))throw invalid(`${label} contains characters that are not allowed.`);
 const out=clean.trim();
 if(out.length<min||out.length>max)throw invalid(`${label} must be ${min}–${max} characters.`);
 return out;
};
function invalid(message){const e=new Error(message);e.status=400;return e}
// Only http(s) and same-site paths: this is what keeps javascript: and data: links out of published pages.
export function safeUrl(v,label,{allowEmpty=true,imageOnly=false}={}){
 const url=text(v,label,500);
 if(!url){if(allowEmpty)return '';throw invalid(`${label} is required.`)}
 if(url.startsWith('/')&&!url.startsWith('//')&&!url.includes('\\'))return url;
 let parsed;try{parsed=new URL(url)}catch{throw invalid(`${label} must be a valid link.`)}
 if(!(parsed.protocol==='https:'||(!imageOnly&&parsed.protocol==='http:')))throw invalid(`${label} must start with https:// or be a path on this site.`);
 return parsed.href;
}
const tone=(v,allowed,label)=>{if(!allowed.includes(v))throw invalid(`${label} is not valid.`);return v};
const items=(v,label,max)=>{if(!Array.isArray(v)||v.length>max)throw invalid(`${label} must have at most ${max} items.`);return v};

export const blockTypes={
 hero:b=>({eyebrow:text(b.eyebrow,'Eyebrow',60),title:text(b.title,'Headline',120,{min:1}),text:text(b.text,'Text',400),buttonLabel:text(b.buttonLabel,'Button label',40),buttonUrl:safeUrl(b.buttonUrl,'Button link')}),
 heading:b=>({text:text(b.text,'Heading',140,{min:1}),level:tone(Number(b.level)||2,[2,3],'Heading level')}),
 text:b=>({text:text(b.text,'Text',4000,{min:1,lines:true})}),
 list:b=>({ordered:b.ordered===true,items:items(b.items,'List',30).map(i=>text(i,'List item',240,{min:1}))}),
 quote:b=>({text:text(b.text,'Quote',500,{min:1,lines:true}),cite:text(b.cite,'Attribution',100)}),
 callout:b=>({tone:tone(b.tone||'info',['info','success','warning'],'Callout tone'),title:text(b.title,'Title',80),text:text(b.text,'Text',600,{min:1,lines:true})}),
 image:b=>({url:safeUrl(b.url,'Image link',{allowEmpty:false,imageOnly:true}),alt:text(b.alt,'Alt text',200,{min:1}),caption:text(b.caption,'Caption',200)}),
 button:b=>({label:text(b.label,'Label',40,{min:1}),url:safeUrl(b.url,'Link',{allowEmpty:false}),style:tone(b.style||'primary',['primary','ghost'],'Button style')}),
 divider:()=>({}),
 faq:b=>({items:items(b.items,'FAQ',20).map(i=>({q:text(i?.q,'Question',200,{min:1}),a:text(i?.a,'Answer',1000,{min:1,lines:true})}))}),
 cards:b=>({items:items(b.items,'Cards',6).map(i=>({title:text(i?.title,'Card title',80,{min:1}),text:text(i?.text,'Card text',300),url:safeUrl(i?.url,'Card link')}))})
};

export function sanitizeBlocks(input){
 if(!Array.isArray(input))throw invalid('Blocks must be a list.');
 if(input.length>BLOCK_LIMIT)throw invalid(`A page can have at most ${BLOCK_LIMIT} blocks.`);
 const seen=new Set();
 return input.map((raw,index)=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw invalid(`Block ${index+1} is not valid.`);
  const make=Object.hasOwn(blockTypes,raw.type)?blockTypes[raw.type]:null;
  if(!make)throw invalid(`Block ${index+1} has an unknown type.`);
  let id=typeof raw.id==='string'&&/^[A-Za-z0-9_-]{4,40}$/.test(raw.id)&&!seen.has(raw.id)?raw.id:randomUUID().slice(0,12);
  seen.add(id);
  return {id,type:raw.type,...(()=>{try{return make(raw)}catch(error){error.message=`Block ${index+1} (${raw.type}): ${error.message}`;throw error}})()};
 });
}
export function normalizeSlug(v){
 const slug=String(v??'').trim().toLowerCase();
 if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)||slug.length<2||slug.length>60)throw invalid('The address must be 2–60 lowercase letters, numbers and single hyphens.');
 if(RESERVED_SLUGS.includes(slug))throw invalid('That address is reserved.');
 return slug;
}
export const pageTitle=v=>text(v,'Title',120,{min:1});
export const pageDescription=v=>text(v,'Description',300);
const skipKeys=new Set(['id','type','url','buttonUrl','style','tone','level','ordered']);
const strings=(v,key='')=>typeof v==='string'?(skipKeys.has(key)?[]:[v]):Array.isArray(v)?v.flatMap(i=>strings(i)):v&&typeof v==='object'?Object.entries(v).flatMap(([k,i])=>strings(i,k)):[];
export const wordCount=blocks=>blocks.reduce((n,b)=>n+strings(b).join(' ').split(/\s+/).filter(Boolean).length,0);

const parse=s=>{try{const v=JSON.parse(s);return Array.isArray(v)?v:[]}catch{return[]}};
const summary=r=>({id:r.id,slug:r.slug,title:r.title,description:r.description,status:r.status,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at,publishedAt:r.published_at,blockCount:parse(r.draft_blocks).length,unpublishedChanges:r.status==='published'&&(r.draft_blocks!==r.live_blocks||r.title!==r.live_title||r.description!==r.live_description)});
const full=r=>({...summary(r),blocks:parse(r.draft_blocks),liveBlocks:parse(r.live_blocks),words:wordCount(parse(r.draft_blocks))});

export function listPages(db,{query='',status=''}={}){
 const like='%'+String(query).replace(/[%_]/g,'').slice(0,80)+'%';
 const rows=db.prepare("SELECT * FROM site_pages WHERE (title LIKE ? OR slug LIKE ?) AND (?='' OR status=?) ORDER BY updated_at DESC LIMIT 200").all(like,like,status,status);
 const counts=Object.fromEntries(db.prepare('SELECT status,count(*) n FROM site_pages GROUP BY status').all().map(r=>[r.status,r.n]));
 return {items:rows.map(summary),counts};
}
export function getPage(db,id){const r=db.prepare('SELECT * FROM site_pages WHERE id=?').get(id);if(!r){const e=new Error('Page not found.');e.status=404;throw e}return full(r)}
const revise=(db,page,kind,author,note='')=>{
 db.prepare('INSERT INTO site_page_revisions(page_id,version,kind,title,description,blocks,author,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(page.id,page.version,kind,page.title,page.description,page.draft_blocks,author,note,Date.now());
 db.prepare('DELETE FROM site_page_revisions WHERE page_id=? AND id NOT IN (SELECT id FROM site_page_revisions WHERE page_id=? ORDER BY id DESC LIMIT ?)').run(page.id,page.id,REVISION_LIMIT);
};
const conflict=message=>{const e=new Error(message);e.status=409;return e};
const row=(db,id)=>{const r=db.prepare('SELECT * FROM site_pages WHERE id=?').get(id);if(!r){const e=new Error('Page not found.');e.status=404;throw e}return r};

export function createPage(db,input,author){
 const slug=normalizeSlug(input.slug),title=pageTitle(input.title),blocks=sanitizeBlocks(input.blocks??[]),now=Date.now(),id=randomUUID();
 if(db.prepare('SELECT 1 FROM site_pages WHERE slug=?').get(slug))throw conflict('Another page already uses that address.');
 db.prepare('INSERT INTO site_pages(id,slug,title,description,draft_blocks,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id,slug,title,pageDescription(input.description),JSON.stringify(blocks),author,now,now);
 revise(db,row(db,id),'draft',author,'Created');
 return getPage(db,id);
}
export function saveDraft(db,id,input,author){
 const page=row(db,id);
 if(!Number.isInteger(input.baseVersion)||input.baseVersion!==page.version)throw conflict('This page was changed in another window. Reload it before saving.');
 const title=pageTitle(input.title),description=pageDescription(input.description),blocks=JSON.stringify(sanitizeBlocks(input.blocks));
 let slug=page.slug;
 if(input.slug!==undefined&&input.slug!==page.slug){
  slug=normalizeSlug(input.slug);
  if(page.status==='published')throw conflict('Unpublish this page before changing its address.');
  if(db.prepare('SELECT 1 FROM site_pages WHERE slug=? AND id<>?').get(slug,id))throw conflict('Another page already uses that address.');
 }
 db.prepare('UPDATE site_pages SET slug=?,title=?,description=?,draft_blocks=?,version=version+1,updated_at=? WHERE id=?').run(slug,title,description,blocks,Date.now(),id);
 if(input.checkpoint===true)revise(db,row(db,id),'draft',author,text(input.note,'Note',120));
 return getPage(db,id);
}
export function publishPage(db,id,author){
 const page=row(db,id);
 if(page.status==='archived')throw conflict('Restore this archived page before publishing.');
 const blocks=sanitizeBlocks(parse(page.draft_blocks));
 if(!blocks.length)throw invalid('Add at least one block before publishing.');
 const now=Date.now();
 db.prepare("UPDATE site_pages SET status='published',live_title=title,live_description=description,live_blocks=draft_blocks,published_at=?,version=version+1,updated_at=? WHERE id=?").run(now,now,id);
 revise(db,row(db,id),'publish',author,'Published');
 return getPage(db,id);
}
export function unpublishPage(db,id){
 const page=row(db,id);if(page.status!=='published')throw conflict('This page is not published.');
 db.prepare("UPDATE site_pages SET status='draft',live_title='',live_description='',live_blocks='[]',version=version+1,updated_at=? WHERE id=?").run(Date.now(),id);
 return getPage(db,id);
}
export function archivePage(db,id,archived){
 const page=row(db,id);
 if(archived){if(page.status==='archived')throw conflict('This page is already archived.')}else if(page.status!=='archived')throw conflict('This page is not archived.');
 db.prepare("UPDATE site_pages SET status=?,live_title='',live_description='',live_blocks='[]',version=version+1,updated_at=? WHERE id=?").run(archived?'archived':'draft',Date.now(),id);
 return getPage(db,id);
}
export function duplicatePage(db,id,author){
 const page=row(db,id);let slug=page.slug.slice(0,52)+'-copy',n=1;
 while(db.prepare('SELECT 1 FROM site_pages WHERE slug=?').get(slug))slug=page.slug.slice(0,50)+'-copy-'+(++n);
 return createPage(db,{slug,title:(page.title+' (copy)').slice(0,120),description:page.description,blocks:parse(page.draft_blocks)},author);
}
export function revisions(db,id){
 row(db,id);
 return {items:db.prepare('SELECT id,version,kind,title,author,note,created_at,length(blocks) size FROM site_page_revisions WHERE page_id=? ORDER BY id DESC').all(id).map(r=>({id:r.id,version:r.version,kind:r.kind,title:r.title,author:r.author,note:r.note,createdAt:r.created_at,size:r.size}))};
}
export function revisionDetail(db,id,revisionId){
 const r=db.prepare('SELECT * FROM site_page_revisions WHERE id=? AND page_id=?').get(revisionId,id);
 if(!r){const e=new Error('Revision not found.');e.status=404;throw e}
 return {id:r.id,version:r.version,kind:r.kind,title:r.title,description:r.description,blocks:parse(r.blocks),author:r.author,note:r.note,createdAt:r.created_at};
}
export function restoreRevision(db,id,revisionId,author){
 const page=row(db,id),r=db.prepare('SELECT * FROM site_page_revisions WHERE id=? AND page_id=?').get(revisionId,id);
 if(!r){const e=new Error('Revision not found.');e.status=404;throw e}
 db.prepare('UPDATE site_pages SET title=?,description=?,draft_blocks=?,version=version+1,updated_at=? WHERE id=?').run(r.title,r.description,JSON.stringify(sanitizeBlocks(parse(r.blocks))),Date.now(),page.id);
 revise(db,row(db,id),'restore',author,'Restored version '+r.version);
 return getPage(db,id);
}
export function livePage(db,slug){
 const r=db.prepare("SELECT slug,live_title title,live_description description,live_blocks blocks,published_at FROM site_pages WHERE slug=? AND status='published'").get(slug);
 return r?{slug:r.slug,title:r.title,description:r.description,blocks:parse(r.blocks),publishedAt:r.published_at}:null;
}
