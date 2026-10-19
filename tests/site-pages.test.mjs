import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase} from '../lib/local-database.mjs';
import {openSecurity} from '../admin/security.mjs';
import * as ops from '../admin/operations.mjs';
import * as pages from '../lib/site-pages.mjs';

const source=fileURLToPath(new URL('../',import.meta.url));
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'memespace-pages-'));
 for(const dir of ['drizzle','admin'])cpSync(path.join(source,dir),path.join(root,dir),{recursive:true});
 const site=openDatabase(root),{db}=openSecurity(root);
 const as=role=>({id:'staff-'+role,name:'Tester '+role,role,permissions:undefined,sessionId:'session-1',source:'127.0.0.1'});
 return {site,db,as,close(){site.close();db.close();rmSync(root,{recursive:true,force:true})}};
}
const hero={type:'hero',title:'Hello',text:'World',buttonLabel:'Go',buttonUrl:'/'};

test('block sanitiser keeps valid content and rejects unsafe or malformed blocks',()=>{
 const ok=pages.sanitizeBlocks([hero,{type:'text',text:'One\n\nTwo'},{type:'list',items:['a','b'],ordered:true},{type:'image',url:'https://example.test/a.png',alt:'An image'},{type:'faq',items:[{q:'Q?',a:'A.'}]}]);
 assert.equal(ok.length,5);assert.ok(ok.every(b=>/^[A-Za-z0-9_-]{4,40}$/.test(b.id)));
 assert.equal(ok[0].extra,undefined);
 for(const bad of ['javascript:alert(1)','data:text/html,x','//evil.test/x','/\\evil.test','ftp://example.test/x'])assert.throws(()=>pages.sanitizeBlocks([{type:'button',label:'x',url:bad}]),/link|start with/i,bad);
 assert.throws(()=>pages.sanitizeBlocks([{type:'image',url:'http://example.test/a.png',alt:'x'}]),/https/);
 assert.throws(()=>pages.sanitizeBlocks([{type:'script',text:'x'}]),/unknown type/);
 assert.throws(()=>pages.sanitizeBlocks([{type:'__proto__'}]),/unknown type/);
 assert.throws(()=>pages.sanitizeBlocks([{type:'heading',text:'a\u0000b'}]),/Block 1 \(heading\)/);
 assert.throws(()=>pages.sanitizeBlocks(Array.from({length:61},()=>({type:'divider'}))),/at most 60/);
 assert.throws(()=>pages.sanitizeBlocks({}),/list/);
 const stripped=pages.sanitizeBlocks([{type:'divider',onclick:'x',id:'dup1'},{type:'divider',id:'dup1'}]);
 assert.deepEqual(Object.keys(stripped[0]).sort(),['id','type']);assert.notEqual(stripped[0].id,stripped[1].id);
});
test('page addresses are normalised, validated and protect reserved routes',()=>{
 assert.equal(pages.normalizeSlug(' About-Us '),'about-us');
 for(const bad of ['a','-x','x-','x--y','x y','x/y','..','api','admin','p'])assert.throws(()=>pages.normalizeSlug(bad),bad);
});
test('draft, publish, unpublish and archive keep the public page isolated from drafts',()=>{
 const f=fixture();try{
  const page=pages.createPage(f.site,{slug:'about',title:'About',blocks:[hero]},'Tester');
  assert.equal(page.status,'draft');assert.equal(pages.livePage(f.site,'about'),null);
  assert.throws(()=>pages.createPage(f.site,{slug:'about',title:'Again'},'Tester'),/already uses/);
  assert.throws(()=>pages.publishPage(f.site,pages.createPage(f.site,{slug:'empty',title:'Empty'},'T').id,'T'),/at least one block/);
  const published=pages.publishPage(f.site,page.id,'Tester');
  assert.equal(published.status,'published');assert.equal(pages.livePage(f.site,'about').blocks[0].title,'Hello');
  const edited=pages.saveDraft(f.site,page.id,{baseVersion:published.version,title:'About us',description:'',blocks:[{...hero,title:'Draft only'}]},'Tester');
  assert.equal(edited.unpublishedChanges,true);
  assert.equal(pages.livePage(f.site,'about').title,'About');assert.equal(pages.livePage(f.site,'about').blocks[0].title,'Hello');
  assert.throws(()=>pages.saveDraft(f.site,page.id,{baseVersion:published.version,title:'Stale',description:'',blocks:[]},'Tester'),/another window/);
  assert.throws(()=>pages.saveDraft(f.site,page.id,{baseVersion:edited.version,slug:'moved',title:'x',description:'',blocks:[hero]},'Tester'),/Unpublish/);
  pages.publishPage(f.site,page.id,'Tester');assert.equal(pages.livePage(f.site,'about').blocks[0].title,'Draft only');
  const off=pages.unpublishPage(f.site,page.id);assert.equal(off.status,'draft');assert.equal(pages.livePage(f.site,'about'),null);
  const moved=pages.saveDraft(f.site,page.id,{baseVersion:off.version,slug:'about-us',title:'About',description:'d',blocks:[hero]},'Tester');assert.equal(moved.slug,'about-us');
  assert.equal(pages.archivePage(f.site,page.id,true).status,'archived');
  assert.throws(()=>pages.publishPage(f.site,page.id,'T'),/Restore/);
  assert.equal(pages.archivePage(f.site,page.id,false).status,'draft');
  const copy=pages.duplicatePage(f.site,page.id,'Tester');assert.match(copy.slug,/-copy/);assert.equal(copy.status,'draft');
  assert.equal(pages.listPages(f.site,{status:'draft'}).items.length,3);
 }finally{f.close()}
});
test('revisions record checkpoints and publishes, can be previewed and restored, and are capped',()=>{
 const f=fixture();try{
  let page=pages.createPage(f.site,{slug:'history',title:'v1',blocks:[hero]},'A');
  page=pages.saveDraft(f.site,page.id,{baseVersion:page.version,title:'v2',description:'',blocks:[hero,{type:'divider'}],checkpoint:true,note:'Second'},'A');
  const list=pages.revisions(f.site,page.id).items;assert.equal(list[0].note,'Second');assert.equal(list.at(-1).note,'Created');
  const first=list.at(-1),detail=pages.revisionDetail(f.site,page.id,first.id);assert.equal(detail.title,'v1');assert.equal(detail.blocks.length,1);
  const restored=pages.restoreRevision(f.site,page.id,first.id,'A');page=restored;assert.equal(restored.title,'v1');assert.equal(restored.blocks.length,1);
  assert.equal(pages.revisions(f.site,page.id).items[0].kind,'restore');
  assert.throws(()=>pages.revisionDetail(f.site,page.id,999999),/not found/);
  for(let i=0;i<60;i++)page=pages.saveDraft(f.site,page.id,{baseVersion:page.version,title:'n'+i,description:'',blocks:[hero],checkpoint:true},'A');
  assert.equal(pages.revisions(f.site,page.id).items.length,pages.REVISION_LIMIT);
 }finally{f.close()}
});
test('page editor operations enforce staff permissions and write audit records',()=>{
 const f=fixture();try{
  const owner=f.as('owner'),admin=f.as('administrator'),mod=f.as('moderator'),observer=f.as('observer');
  const created=ops.pageCreate(f.site,f.db,admin,{slug:'news',title:'News',blocks:[hero]});
  assert.equal(created.status,'draft');
  for(const who of [mod,observer]){
   assert.throws(()=>ops.pageList(f.site,who,new URL('http://x/api/pages')),/permission/);
   assert.throws(()=>ops.pageCreate(f.site,f.db,who,{slug:'nope',title:'No',blocks:[]}),/permission/);
   assert.throws(()=>ops.pageAction(f.site,f.db,who,created.id,{action:'publish'}),/permission/);
  }
  assert.throws(()=>ops.pageAction(f.site,f.db,admin,created.id,{action:'delete'}),/Unknown/);
  const live=ops.pageAction(f.site,f.db,owner,created.id,{action:'publish'});assert.equal(live.status,'published');
  const saved=ops.pageSave(f.site,f.db,owner,created.id,{baseVersion:live.version,title:'News!',description:'',blocks:[hero],checkpoint:true,note:'Tweak'});
  assert.equal(ops.pageRevisions(f.site,owner,created.id).items[0].note,'Tweak');
  assert.equal(saved.title,'News!');
  const actions=f.db.prepare("SELECT action,result FROM audit_events WHERE action LIKE 'page.%' ORDER BY id").all().map(r=>r.action+':'+r.result);
  assert.ok(actions.includes('page.created:success')&&actions.includes('page.publish:success')&&actions.includes('page.checkpoint:success'));
  const denied=f.db.prepare("SELECT count(*) n FROM audit_events WHERE action='page.created' AND result='failed'").get().n;assert.equal(denied,0);
  assert.throws(()=>ops.pageCreate(f.site,f.db,admin,{slug:'news',title:'Dup',blocks:[]}),/already uses/);
  assert.equal(f.db.prepare("SELECT count(*) n FROM audit_events WHERE action='page.created' AND result='failed'").get().n,1);
 }finally{f.close()}
});
