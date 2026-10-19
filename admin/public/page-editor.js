// Control Center page editor. admin.js hands over its helpers through initPageEditor().
// The Control Center CSP forbids inline styles and remote images, so everything here is class based.
let X=null;
export function initPageEditor(helpers){X=helpers}
const e=v=>X.e(v);
const rid=()=>(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now()).replace(/-/g,'').slice(0,12);
const safeLink=v=>/^(https?:\/\/|\/(?!\/))/i.test(String(v||'').trim());
const slugify=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);

const TONES=[['info','Information'],['success','Success'],['warning','Warning']];
const TYPES={
 hero:{label:'Hero',glyph:'◆',blank:()=>({eyebrow:'',title:'A headline that lands',text:'',buttonLabel:'',buttonUrl:''}),fields:[['eyebrow','Eyebrow','text',60],['title','Headline','text',120],['text','Supporting text','area',400],['buttonLabel','Button label','text',40],['buttonUrl','Button link','url',500]]},
 heading:{label:'Heading',glyph:'H',blank:()=>({text:'Section heading',level:2}),fields:[['text','Heading','text',140],['level','Size','select',[['2','Section heading'],['3','Sub-heading']]]]},
 text:{label:'Text',glyph:'¶',blank:()=>({text:''}),fields:[['text','Text (blank line starts a new paragraph)','area',4000]]},
 list:{label:'List',glyph:'☰',blank:()=>({ordered:false,items:['First point','Second point']}),fields:[['ordered','Numbered list','check'],['items','One item per line','lines']]},
 quote:{label:'Quote',glyph:'❝',blank:()=>({text:'',cite:''}),fields:[['text','Quote','area',500],['cite','Attribution','text',100]]},
 callout:{label:'Callout',glyph:'ℹ',blank:()=>({tone:'info',title:'',text:''}),fields:[['tone','Tone','select',TONES],['title','Title','text',80],['text','Message','area',600]]},
 image:{label:'Image',glyph:'▣',blank:()=>({url:'',alt:'',caption:''}),fields:[['url','Image link (https://)','url',500],['alt','Alt text (describe the image)','text',200],['caption','Caption','text',200]]},
 button:{label:'Button',glyph:'▭',blank:()=>({label:'Learn more',url:'/',style:'primary'}),fields:[['label','Label','text',40],['url','Link','url',500],['style','Style','select',[['primary','Gradient'],['ghost','Outline']]]]},
 divider:{label:'Divider',glyph:'—',blank:()=>({}),fields:[]},
 faq:{label:'FAQ',glyph:'?',blank:()=>({items:[{q:'',a:''}]}),repeat:{max:20,add:'Add question',fields:[['q','Question','text',200],['a','Answer','area',1000]]}},
 cards:{label:'Cards',glyph:'▦',blank:()=>({items:[{title:'',text:'',url:''}]}),repeat:{max:6,add:'Add card',fields:[['title','Title','text',80],['text','Text','area',300],['url','Link (optional)','url',500]]}}
};
const TEMPLATES={
 blank:{label:'Blank page',note:'Start from nothing.',blocks:()=>[]},
 landing:{label:'Landing page',note:'Hero, feature cards and FAQ.',blocks:()=>[{type:'hero',eyebrow:'NEW',title:'Say something worth sharing',text:'A short line that explains what this page is about.',buttonLabel:'Enter the Meme Mind',buttonUrl:'/'},{type:'cards',items:[{title:'Explore',text:'Describe the first idea.',url:''},{title:'Create',text:'Describe the second idea.',url:''},{title:'Share',text:'Describe the third idea.',url:''}]},{type:'faq',items:[{q:'What is this page?',a:'Write a helpful answer here.'}]}]},
 article:{label:'Article',note:'Headings, text, quote and callout.',blocks:()=>[{type:'heading',text:'Introduction',level:2},{type:'text',text:'Open with the story in a couple of sentences.'},{type:'callout',tone:'info',title:'Good to know',text:'Use callouts for tips and warnings.'},{type:'heading',text:'The details',level:2},{type:'list',ordered:false,items:['First point','Second point']},{type:'quote',text:'A line worth quoting.',cite:''}]},
 faq:{label:'FAQ',note:'A page of questions and answers.',blocks:()=>[{type:'heading',text:'Frequently asked questions',level:2},{type:'faq',items:[{q:'First question?',a:'First answer.'},{q:'Second question?',a:'Second answer.'}]}]}
};

let ed=null,list={q:'',status:''},listTimer=0,renderQueued=false,newDraft={template:'blank',slugTouched:false};

// ---------- list view ----------
export function pagesView(d){
 const c=d.counts||{},total=(c.draft||0)+(c.published||0)+(c.archived||0);
 return X.pageHeading(X.button('+ New page','new','primary').replace('data-action="new"','data-pe="new"'))
 +`<section class="pe-stats" aria-label="Page totals">${[['Pages',total],['Published',c.published||0],['Drafts',c.draft||0],['Archived',c.archived||0]].map(([l,n])=>`<div class="pe-stat"><b>${n}</b><small>${l}</small></div>`).join('')}</section>`
 +`<section class="panel"><div class="toolbar"><label class="search"><input id="pe-search" aria-label="Search pages" placeholder="Search title or address" value="${e(list.q)}"></label><div class="filters" aria-label="Filter pages">${[['','All'],['published','Published'],['draft','Drafts'],['archived','Archived']].map(([v,l])=>`<button class="filter ${list.status===v?'active':''}" data-pe="status" data-v="${v}" aria-pressed="${list.status===v}">${l}</button>`).join('')}</div></div><div id="pe-list">${rows(d.items)}</div></section>`;
}
function rows(items){
 if(!items.length)return X.empty('No pages yet','Create a page to publish custom content on the public site at /p/your-page.');
 return items.map(p=>`<div class="pe-list-row" data-pe="edit" data-id="${e(p.id)}" tabindex="0" role="button" aria-label="Edit ${e(p.title)}"><div><b>${e(p.title)}</b><small class="muted">/p/${e(p.slug)}</small></div><div>${X.status(p.status,p.status==='published'?'':p.status==='archived'?'neutral':'warn')}${p.unpublishedChanges?'<div class="changed">● unpublished changes</div>':''}</div><small>${p.blockCount} blocks</small><small>${e(X.date(p.updatedAt))}</small><span>${p.status==='published'?`<a class="button ghost" target="_blank" rel="noopener" href="http://127.0.0.1:${X.state.sitePort}/p/${e(p.slug)}">View live</a>`:''}</span></div>`).join('');
}
async function refreshList(){
 const box=document.querySelector('#pe-list');if(!box)return;
 try{const d=await X.api('pages?q='+encodeURIComponent(list.q)+'&status='+encodeURIComponent(list.status));box.innerHTML=rows(d.items)}catch(err){X.toast(err.message)}
}

// ---------- create dialog ----------
function newDialog(){
 newDraft={template:'blank',slugTouched:false};
 X.openDialog('New page',`<p>Pages are drafts until you publish them. Published pages appear at <span class="mono">/p/address</span> on the public site.</p><label class="field">Title<input id="pe-new-title" maxlength="120" autocomplete="off" placeholder="About MemeSpace"></label><label class="field">Address<input id="pe-new-slug" maxlength="60" autocomplete="off" placeholder="about-memespace"></label><div class="pe-templates" role="group" aria-label="Starting point">${Object.entries(TEMPLATES).map(([k,t])=>`<button type="button" class="pe-template" data-pe="tpl" data-v="${k}" aria-pressed="${k==='blank'}"><b>${t.label}</b><small class="muted">${t.note}</small></button>`).join('')}</div><p class="form-error" role="alert" id="pe-new-error"></p><div class="form-actions">${X.button('Cancel','close-dialog','ghost')}<button class="button primary" type="button" data-pe="create">Create page</button></div>`);
 document.querySelector('#pe-new-title')?.focus();
}
async function createPage(){
 const title=document.querySelector('#pe-new-title').value,slug=document.querySelector('#pe-new-slug').value,err=document.querySelector('#pe-new-error');
 err.textContent='';
 try{
  const blocks=TEMPLATES[newDraft.template].blocks().map(b=>({id:rid(),...b}));
  const page=await X.api('pages',{title,slug,blocks});
  document.querySelector('#dialog').close();X.toast('Draft created');openEditor(page);
 }catch(error){err.textContent=error.message}
}

// ---------- editor model ----------
const snapshot=()=>JSON.stringify([ed.title,ed.description,ed.slug,ed.blocks]);
function clean(){
 return ed.blocks.map(b=>{
  const c=JSON.parse(JSON.stringify(b));
  if(c.type==='list')c.items=(c.items||[]).map(s=>String(s).trim()).filter(Boolean);
  if(c.type==='faq'||c.type==='cards')c.items=(c.items||[]).filter(i=>Object.values(i).some(v=>String(v).trim()));
  if(c.type==='heading')c.level=Number(c.level)||2;
  return c;
 });
}
function record(force=false){
 const now=Date.now();
 if(force||now-ed.lastRecord>800){ed.history.push(snapshot());if(ed.history.length>100)ed.history.shift();ed.future=[]}
 ed.lastRecord=now;
}
function restoreSnapshot(s){const [title,description,slug,blocks]=JSON.parse(s);Object.assign(ed,{title,description,slug,blocks});}
function undo(){if(!ed?.history.length)return;ed.future.push(snapshot());restoreSnapshot(ed.history.pop());ed.lastRecord=0;changed(true)}
function redo(){if(!ed?.future.length)return;ed.history.push(snapshot());restoreSnapshot(ed.future.pop());ed.lastRecord=0;changed(true)}
function changed(structural=false){
 ed.dirty=true;ed.failed=false;setState('Unsaved changes','dirty');
 clearTimeout(ed.timer);ed.timer=setTimeout(()=>void save(false),1600);
 if(structural){renderEdit();renderSide()}else{renderOutlineLabels();renderMeta()}
 renderPreview();renderTop();
}
function setState(text,kind=''){ed.stateText=text;ed.stateKind=kind;const n=document.querySelector('#pe-state');if(n){n.textContent=text;n.className='pe-state '+kind}}

async function save(checkpoint=false,note=''){
 if(!ed||ed.conflict)return false;
 clearTimeout(ed.timer);
 if(ed.saving){ed.queued={checkpoint:checkpoint||ed.queued?.checkpoint,note:note||ed.queued?.note};return ed.saving}
 if(!ed.dirty&&!checkpoint)return true;
 const sent=snapshot(),body={baseVersion:ed.version,title:ed.title,description:ed.description,blocks:clean(),checkpoint,note};
 if(ed.slug!==ed.page.slug)body.slug=ed.slug;
 setState('Saving…','dirty');
 const state=ed;
 state.saving=(async()=>{
  try{
   const p=await X.api('pages/'+state.id,body);
   state.page=p;state.version=p.version;state.live=p.liveBlocks;state.status=p.status;state.unpublished=p.unpublishedChanges;
   if(ed===state){state.dirty=snapshot()!==sent;setState(state.dirty?'Unsaved changes':'Saved · v'+p.version,state.dirty?'dirty':'ok');if(checkpoint){X.toast('Version saved');void loadRevisions()}renderTop();renderMeta();renderBanner()}
   return true;
  }catch(err){
   state.failed=true;
   if(/another window/i.test(err.message))state.conflict=true;
   if(ed===state){setState(state.conflict?'Out of date':'Needs attention','error');renderBanner(err.message)}
   return false;
  }finally{
   state.saving=null;
   const q=state.queued;state.queued=null;
   if(ed===state&&!state.conflict){if(q)void save(q.checkpoint,q.note);else if(state.dirty&&!state.failed)state.timer=setTimeout(()=>void save(false),400)}
  }
 })();
 return state.saving;
}

// ---------- editor rendering ----------
async function openEditor(input){
 try{
  const page=typeof input==='string'?await X.api('pages/'+input):input;
  const wide=window.innerWidth>=1250;
  ed={id:page.id,page,title:page.title,description:page.description,slug:page.slug,blocks:page.blocks,live:page.liveBlocks,status:page.status,unpublished:page.unpublishedChanges,version:page.version,dirty:false,failed:false,conflict:false,saving:null,queued:null,timer:0,history:[],future:[],lastRecord:0,sel:page.blocks[0]?.id||null,mode:localStorage.getItem('pe-mode')||(wide?'split':'edit'),device:'desktop',tab:'blocks',revs:null,revView:null,stateText:'Saved · v'+page.version,stateKind:'ok',words:page.words};
  document.querySelector('#main').innerHTML=`<div class="pe pe-mode-${ed.mode}" data-pe-root><div id="pe-top"></div><div id="pe-banner"></div><div class="pe-body"><aside class="pe-side" id="pe-side" aria-label="Page tools"></aside><section class="pe-edit" id="pe-edit" aria-label="Block editor"></section><section class="pe-preview" id="pe-preview" aria-label="Live preview"></section></div></div>`;
  renderAll();
 }catch(err){X.toast(err.message)}
}
function renderAll(){renderTop();renderBanner();renderSide();renderEdit();renderPreview()}
function wordsNow(){
 const skip=new Set(['id','type','url','buttonUrl','style','tone','level','ordered']);
 const walk=(v,k='')=>typeof v==='string'?(skip.has(k)?[]:[v]):Array.isArray(v)?v.flatMap(i=>walk(i)):v&&typeof v==='object'?Object.entries(v).flatMap(([kk,i])=>walk(i,kk)):[];
 return walk(clean()).join(' ').split(/\s+/).filter(Boolean).length;
}
function diff(){
 const live=new Map((ed.live||[]).map(b=>[b.id,JSON.stringify(b)])),now=clean(),ids=new Set(now.map(b=>b.id));
 return {added:now.filter(b=>!live.has(b.id)).length,removed:[...live.keys()].filter(id=>!ids.has(id)).length,edited:now.filter(b=>live.has(b.id)&&live.get(b.id)!==JSON.stringify(b)).length};
}
function renderTop(){
 const n=document.querySelector('#pe-top');if(!n||!ed)return;
 const pub=X.can('content.publish'),live=ed.status==='published';
 const label=live?(ed.unpublished||ed.dirty?'Publish changes':'Published'):'Publish';
 const hadFocus=document.activeElement?.id==='pe-title',caret=hadFocus?document.activeElement.selectionStart:0;
 n.innerHTML=`<div class="pe-top"><button class="pe-icon" data-pe="back" aria-label="Back to pages" title="Back to pages">←</button><div class="pe-titlebox"><input class="pe-title-input" id="pe-title" aria-label="Page title" maxlength="120" value="${e(ed.title)}"><span class="pe-slug">/p/${e(ed.slug)} · ${X.status(ed.status,live?'':ed.status==='archived'?'neutral':'warn')}</span></div><span id="pe-state" class="pe-state ${ed.stateKind}" role="status">${e(ed.stateText)}</span><button class="pe-icon" id="pe-undo" data-pe="undo" aria-label="Undo" title="Undo (Ctrl+Z)" ${ed.history.length?'':'disabled'}>↶</button><button class="pe-icon" id="pe-redo" data-pe="redo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" ${ed.future.length?'':'disabled'}>↷</button><div class="pe-seg" role="group" aria-label="Layout">${[['edit','Edit'],['split','Split'],['preview','Preview']].map(([v,l])=>`<button data-pe="mode" data-v="${v}" aria-pressed="${ed.mode===v}">${l}</button>`).join('')}</div><button class="button ghost" data-pe="save" title="Save a named version (Ctrl+S)">Save version</button><button class="button primary" data-pe="publish" ${pub&&ed.status!=='archived'&&(ed.unpublished||ed.dirty||!live)?'':'disabled'} title="${pub?'Make the current draft live':'You need publishing permission'}">${label}</button><details class="pe-more"><summary class="pe-icon" aria-label="More actions">⋯</summary><div class="pe-menu">${live?`<a target="_blank" rel="noopener" href="http://127.0.0.1:${X.state.sitePort}/p/${e(ed.page.slug)}">View live page</a>`:''}<button data-pe="duplicate-page">Duplicate page</button>${live&&pub?'<button data-pe="unpublish">Unpublish</button>':''}${ed.status==='archived'?'<button data-pe="unarchive">Restore from archive</button>':'<button data-pe="archive">Archive page</button>'}</div></details></div>`;
 if(hadFocus){const t=n.querySelector('#pe-title');t.focus();t.setSelectionRange(caret,caret)}
}
function renderBanner(message=''){
 const n=document.querySelector('#pe-banner');if(!n||!ed)return;
 if(ed.conflict){n.innerHTML=`<div class="pe-banner danger"><span>This page was changed in another window. Your edits here were not saved.</span><button class="button" data-pe="reload">Reload latest</button></div>`;return}
 if(message&&ed.failed){n.innerHTML=`<div class="pe-banner danger" role="alert"><span>${e(message)}</span></div>`;return}
 if(ed.status==='published'&&(ed.unpublished||ed.dirty)){const d=diff(),t=d.added+d.removed+d.edited;n.innerHTML=t||ed.unpublished?`<div class="pe-banner"><span>Unpublished changes${t?` — ${[d.added&&d.added+' added',d.edited&&d.edited+' edited',d.removed&&d.removed+' removed'].filter(Boolean).join(' · ')}`:''}. The public page still shows the last published version.</span></div>`:'';return}
 n.innerHTML='';
}
function renderSide(){
 const n=document.querySelector('#pe-side');if(!n||!ed)return;
 n.innerHTML=`<div class="pe-tabs" role="tablist">${[['blocks','Blocks'],['page','Page'],['history','History']].map(([v,l])=>`<button role="tab" data-pe="tab" data-v="${v}" aria-selected="${ed.tab===v}">${l}</button>`).join('')}</div><div class="pe-pane" id="pe-pane"></div>`;
 renderPane();
}
function renderPane(){
 const n=document.querySelector('#pe-pane');if(!n)return;
 if(ed.tab==='blocks')n.innerHTML=`<div><small class="muted">Add a block ${ed.sel?'after the selected one':'to the end'}</small></div><div class="pe-palette">${Object.entries(TYPES).map(([k,t])=>`<button data-pe="add" data-type="${k}" title="Add ${t.label}"><i>${t.glyph}</i>${t.label}</button>`).join('')}</div><ul class="pe-outline" id="pe-outline" aria-label="Page outline">${outline()}</ul><div class="pe-limit" id="pe-limit">${ed.blocks.length} / 60 blocks</div>`;
 else if(ed.tab==='page')n.innerHTML=pageTab();
 else n.innerHTML=historyTab();
}
const summary=b=>{const t=TYPES[b.type];const v=b.title||b.text||b.label||b.alt||b.url||(b.items?.[0]?(typeof b.items[0]==='string'?b.items[0]:b.items[0].q||b.items[0].title):'')||'';return String(v).slice(0,60)||'(empty)'};
function outline(){return ed.blocks.map(b=>`<li draggable="true" data-pe="select" data-id="${b.id}" class="${b.id===ed.sel?'sel':''}"><i>${TYPES[b.type].glyph}</i><span>${e(summary(b))}</span><small class="muted">${TYPES[b.type].label}</small></li>`).join('')||'<li class="muted">No blocks yet</li>'}
function renderOutlineLabels(){const n=document.querySelector('#pe-outline');if(n&&ed.tab==='blocks'){const labels=n.querySelectorAll('li[data-id] span');ed.blocks.forEach((b,i)=>{if(labels[i])labels[i].textContent=summary(b)})}}
function pageTab(){
 const live=ed.status==='published',words=wordsNow();
 return `<label>Address<input data-meta="slug" maxlength="60" value="${e(ed.slug)}" ${live?'disabled':''}></label>${live?'<small class="muted">Unpublish this page to change its address.</small>':''}<label>Description (search &amp; sharing)<textarea data-meta="description" maxlength="300">${e(ed.description)}</textarea></label><div class="pe-limit" id="pe-desc-count">${ed.description.length} / 300</div><div class="pe-serp" id="pe-serp"><b>${e(ed.title||'Untitled')}</b><i>memespace/p/${e(ed.slug)}</i><span>${e(ed.description||'Add a description to control how this page appears in search results.')}</span></div><div class="pe-meta" id="pe-meta"><div><span>Blocks</span><b>${ed.blocks.length}</b></div><div><span>Words</span><b>${words}</b></div><div><span>Reading time</span><b>${Math.max(1,Math.ceil(words/200))} min</b></div><div><span>Created</span><b>${e(X.date(ed.page.createdAt))}</b></div><div><span>Published</span><b>${ed.page.publishedAt?e(X.date(ed.page.publishedAt)):'Never'}</b></div></div>`;
}
function renderMeta(){
 if(!ed||ed.tab!=='page')return;
 const w=wordsNow(),set=(id,v)=>{const n=document.querySelector(id);if(n)n.innerHTML=v};
 set('#pe-serp',`<b>${e(ed.title||'Untitled')}</b><i>memespace/p/${e(ed.slug)}</i><span>${e(ed.description||'Add a description to control how this page appears in search results.')}</span>`);
 set('#pe-desc-count',`${ed.description.length} / 300`);
 const m=document.querySelector('#pe-meta');if(m){const b=m.querySelectorAll('b');b[0].textContent=ed.blocks.length;b[1].textContent=w;b[2].textContent=Math.max(1,Math.ceil(w/200))+' min'}
}
function historyTab(){
 if(!ed.revs)return '<p class="muted">Loading versions…</p>';
 if(!ed.revs.length)return '<p class="muted">No saved versions yet. Use “Save version” or publish to create one.</p>';
 return `<small class="muted">Autosave keeps your draft safe. Saved versions and publishes appear here (latest ${ed.revs.length}).</small>`+ed.revs.map(r=>`<div class="pe-rev ${ed.revView?.id===r.id?'view':''}"><div><b>v${r.version}</b> · ${e(r.kind)} ${r.note?`· ${e(r.note)}`:''}</div><small class="muted">${e(r.author)} · ${e(X.date(r.createdAt))}</small><div class="pe-rev-actions"><button data-pe="rev-view" data-id="${r.id}">${ed.revView?.id===r.id?'Viewing':'Preview'}</button><button data-pe="rev-restore" data-id="${r.id}">Restore</button></div></div>`).join('')+(ed.revView?'<button class="button ghost" data-pe="rev-clear">Back to current draft</button>':'');
}
async function loadRevisions(){
 if(!ed)return;const state=ed;
 try{const d=await X.api('pages/'+state.id+'/revisions');if(ed===state){ed.revs=d.items;if(ed.tab==='history')renderPane()}}catch(err){X.toast(err.message)}
}
const input=(b,[k,label,kind,extra],item,idx,sub)=>{
 const val=item?item[k]:b[k],attrs=item?`data-b="${b.id}" data-f="items" data-i="${idx}" data-s="${k}"`:`data-b="${b.id}" data-f="${k}"`;
 if(kind==='check')return `<label class="pe-check"><input type="checkbox" ${attrs} ${val?'checked':''}> ${label}</label>`;
 if(kind==='select')return `<label>${label}<select ${attrs}>${extra.map(([v,l])=>`<option value="${v}" ${String(val)===v?'selected':''}>${l}</option>`).join('')}</select></label>`;
 if(kind==='area')return `<label>${label}<textarea ${attrs} maxlength="${extra}">${e(val)}</textarea></label>`;
 if(kind==='lines')return `<label>${label}<textarea ${attrs} data-lines="1" maxlength="6000">${e((b.items||[]).join('\n'))}</textarea></label>`;
 return `<label>${label}<input ${attrs} maxlength="${extra}" ${kind==='url'?'inputmode="url" autocomplete="off"':''} value="${e(val)}"></label>`;
};
function blockCard(b,i){
 const t=TYPES[b.type];
 const body=t.repeat?`<div class="pe-repeat">${(b.items||[]).map((it,n)=>`<div class="pe-item"><div class="pe-item-bar"><span>${t.label==='FAQ'?'Question':'Card'} ${n+1}</span><button class="pe-icon" data-pe="item-del" data-id="${b.id}" data-i="${n}" aria-label="Remove item ${n+1}">×</button></div>${t.repeat.fields.map(f=>input(b,f,it,n)).join('')}</div>`).join('')}${(b.items||[]).length<t.repeat.max?`<button class="button ghost" data-pe="item-add" data-id="${b.id}">${t.repeat.add}</button>`:''}</div>`:t.fields.length?t.fields.map(f=>input(b,f)).join(''):'<small class="muted">A thin line that separates sections. Nothing to configure.</small>';
 return `<article class="pe-block ${b.id===ed.sel?'sel':''}" data-pe="select" data-id="${b.id}" id="blk-${b.id}"><div class="pe-block-head"><b>${t.glyph} ${t.label}</b><button data-pe="up" data-id="${b.id}" aria-label="Move up" ${i?'':'disabled'}>↑</button><button data-pe="down" data-id="${b.id}" aria-label="Move down" ${i<ed.blocks.length-1?'':'disabled'}>↓</button><button data-pe="dup" data-id="${b.id}" aria-label="Duplicate block" title="Duplicate">⧉</button><button data-pe="del" data-id="${b.id}" aria-label="Delete block" title="Delete">🗑</button></div><div class="pe-fields">${body}</div></article>`;
}
function renderEdit(){
 const n=document.querySelector('#pe-edit');if(!n||!ed)return;
 n.innerHTML=ed.blocks.length?ed.blocks.map(blockCard).join(''):`<div class="pe-empty"><strong>This page is empty</strong>Add your first block from the panel on the left.<button class="button primary" data-pe="add" data-type="hero">Add a hero</button></div>`;
}

// ---------- preview ----------
const paras=t=>String(t||'').split(/\n{2,}/).filter(s=>s.trim()).map(p=>`<p>${e(p.trim()).replace(/\n/g,'<br>')}</p>`).join('');
function pv(b){
 const link=v=>safeLink(v)?e(v):'#';
 switch(b.type){
  case 'hero':return `<section class="cms-hero">${b.eyebrow?`<small>${e(b.eyebrow)}</small>`:''}<h2>${e(b.title)}</h2>${b.text?`<p>${e(b.text)}</p>`:''}${b.buttonLabel&&b.buttonUrl?`<a class="cms-btn" href="${link(b.buttonUrl)}">${e(b.buttonLabel)}</a>`:''}</section>`;
  case 'heading':return `<h${Number(b.level)===3?3:2} class="cms-h">${e(b.text)}</h${Number(b.level)===3?3:2}>`;
  case 'text':return `<div>${paras(b.text)}</div>`;
  case 'list':{const tag=b.ordered?'ol':'ul';return `<${tag}>${(b.items||[]).filter(s=>String(s).trim()).map(s=>`<li>${e(s)}</li>`).join('')}</${tag}>`}
  case 'quote':return `<blockquote class="cms-quote">${paras(b.text)}${b.cite?`<footer>— ${e(b.cite)}</footer>`:''}</blockquote>`;
  case 'callout':return `<aside class="cms-callout ${['success','warning'].includes(b.tone)?b.tone:'info'}">${b.title?`<b>${e(b.title)}</b>`:''}${paras(b.text)}</aside>`;
  case 'image':{let host='';try{host=new URL(b.url).host}catch{host=b.url||''}return `<figure class="cms-figure"><div class="cms-img-missing">${e(b.alt||'Image')}${host?` · ${e(host)}`:''}<br><small>Remote images are not loaded inside the Control Center.</small></div>${b.caption?`<figcaption>${e(b.caption)}</figcaption>`:''}</figure>`}
  case 'button':return `<div class="cms-actions"><a class="cms-btn ${b.style==='ghost'?'ghost':''}" href="${link(b.url)}">${e(b.label)}</a></div>`;
  case 'divider':return '<hr>';
  case 'faq':return `<div class="cms-faq">${(b.items||[]).filter(i=>i.q).map(i=>`<details><summary>${e(i.q)}</summary>${paras(i.a)}</details>`).join('')}</div>`;
  case 'cards':return `<div class="cms-cards">${(b.items||[]).filter(i=>i.title).map(i=>{const inner=`<b>${e(i.title)}</b><span>${e(i.text)}</span>`;return i.url&&safeLink(i.url)?`<a class="cms-card" href="${e(i.url)}">${inner}</a>`:`<div class="cms-card">${inner}</div>`}).join('')}</div>`;
 }
 return '';
}
function renderPreview(){
 if(renderQueued)return;renderQueued=true;
 requestAnimationFrame(()=>{
  renderQueued=false;const n=document.querySelector('#pe-preview');if(!n||!ed)return;
  const rv=ed.revView,title=rv?rv.title:ed.title,desc=rv?rv.description:ed.description,blocks=rv?rv.blocks:ed.blocks;
  n.innerHTML=`<div class="pe-seg" role="group" aria-label="Preview width">${[['desktop','Desktop'],['tablet','Tablet'],['mobile','Mobile']].map(([v,l])=>`<button data-pe="device" data-v="${v}" aria-pressed="${ed.device===v}">${l}</button>`).join('')}</div>${rv?`<div class="pe-banner">Previewing saved version v${rv.version}. Nothing here is live.</div>`:''}<div class="pe-frame pe-device-${ed.device}"><h1 class="pv-title">${e(title||'Untitled')}</h1>${desc?`<p class="pv-desc">${e(desc)}</p>`:''}<div class="cms">${blocks.map(pv).join('')||'<p class="muted">Nothing to preview yet.</p>'}</div></div>`;
 });
}

// ---------- actions ----------
function add(type){
 record(true);const b={id:rid(),type,...TYPES[type].blank()};
 if(ed.blocks.length>=60){X.toast('A page can have at most 60 blocks.');return}
 const at=ed.sel?ed.blocks.findIndex(x=>x.id===ed.sel)+1:ed.blocks.length;
 ed.blocks.splice(at,0,b);ed.sel=b.id;changed(true);
 requestAnimationFrame(()=>{const card=document.querySelector('#blk-'+b.id);card?.scrollIntoView({block:'center'});card?.querySelector('input,textarea,select')?.focus()});
}
function move(id,delta){
 const i=ed.blocks.findIndex(b=>b.id===id),j=i+delta;if(i<0||j<0||j>=ed.blocks.length)return;
 record(true);[ed.blocks[i],ed.blocks[j]]=[ed.blocks[j],ed.blocks[i]];changed(true);
 requestAnimationFrame(()=>document.querySelector('#blk-'+id)?.scrollIntoView({block:'nearest'}));
}
function select(id){
 if(ed.sel===id)return;ed.sel=id;
 document.querySelectorAll('.pe-block').forEach(n=>n.classList.toggle('sel',n.dataset.id===id));
 document.querySelectorAll('#pe-outline li[data-id]').forEach(n=>n.classList.toggle('sel',n.dataset.id===id));
}
async function lifecycle(action,extra={}){
 const ok=await save(false);if(ok===false){X.toast('Fix the highlighted problem before continuing.');return}
 try{
  const p=await X.api('pages/'+ed.id+'/action',{action,...extra});
  if(action==='duplicate'){X.toast('Duplicate created as a draft');await openEditor(p);return}
  Object.assign(ed,{page:p,title:p.title,description:p.description,slug:p.slug,blocks:p.blocks,live:p.liveBlocks,status:p.status,unpublished:p.unpublishedChanges,version:p.version,dirty:false,failed:false,revView:null});
  ed.history=[];ed.future=[];setState('Saved · v'+p.version,'ok');renderAll();void loadRevisions();
  X.toast({publish:'Published to the public site',unpublish:'Page unpublished',archive:'Page archived',unarchive:'Page restored as a draft',restore:'Version restored to your draft'}[action]||'Done');
 }catch(err){X.toast(err.message)}
}
async function leave(){
 if(ed.dirty){const ok=await save(false);if(ok===false&&!confirm('Your latest edits could not be saved. Leave anyway?'))return}
 ed=null;void X.renderView();
}

document.addEventListener('click',async event=>{
 const root=document.querySelector('[data-pe-root]');if(!root&&ed)ed=null;
 if(ed&&event.target.closest('.pe-frame a')){event.preventDefault();return}
 if(ed&&ed.dirty&&event.target.closest('[data-view]')){
  event.preventDefault();event.stopImmediatePropagation();const t=event.target.closest('[data-view]');await save(false);ed=null;t.click();return;
 }
 const t=event.target.closest('[data-pe]');if(!t||event.target.closest('a'))return;
 const a=t.dataset.pe,id=t.dataset.id,v=t.dataset.v;
 try{
  if(a==='new')return newDialog();
  if(a==='tpl'){newDraft.template=v;document.querySelectorAll('.pe-template').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.v===v)));return}
  if(a==='create')return await createPage();
  if(a==='edit')return await openEditor(id);
  if(a==='status'){list.status=v;document.querySelectorAll('[data-pe=status]').forEach(n=>{n.classList.toggle('active',n.dataset.v===v);n.setAttribute('aria-pressed',String(n.dataset.v===v))});return await refreshList()}
  if(!ed)return;
  if(a==='back')return await leave();
  if(a==='undo')return undo();if(a==='redo')return redo();
  if(a==='mode'){ed.mode=v;localStorage.setItem('pe-mode',v);root.className='pe pe-mode-'+v;renderTop();return}
  if(a==='device'){ed.device=v;return renderPreview()}
  if(a==='tab'){ed.tab=v;renderSide();if(v==='history')void loadRevisions();return}
  if(a==='add')return add(t.dataset.type);
  if(a==='select'){select(id);if(t.tagName==='LI')document.querySelector('#blk-'+id)?.scrollIntoView({block:'center'});return}
  if(a==='up')return move(id,-1);if(a==='down')return move(id,1);
  if(a==='dup'){const i=ed.blocks.findIndex(b=>b.id===id);record(true);const copy=JSON.parse(JSON.stringify(ed.blocks[i]));copy.id=rid();ed.blocks.splice(i+1,0,copy);ed.sel=copy.id;return changed(true)}
  if(a==='del'){const i=ed.blocks.findIndex(b=>b.id===id);if(i<0)return;record(true);ed.blocks.splice(i,1);ed.sel=ed.blocks[Math.min(i,ed.blocks.length-1)]?.id||null;return changed(true)}
  if(a==='item-add'){const b=ed.blocks.find(x=>x.id===id);record(true);b.items.push(structuredClone(TYPES[b.type].blank().items[0]));return changed(true)}
  if(a==='item-del'){const b=ed.blocks.find(x=>x.id===id);record(true);b.items.splice(Number(t.dataset.i),1);return changed(true)}
  if(a==='save'){await save(true,'Manual save');return}
  if(a==='publish')return await lifecycle('publish');
  if(a==='unpublish'){if(confirm('Unpublish this page? The public address will stop working until you publish again.'))await lifecycle('unpublish');return}
  if(a==='archive'){if(confirm('Archive this page? It will be unpublished and hidden from the main list.'))await lifecycle('archive');return}
  if(a==='unarchive')return await lifecycle('unarchive');
  if(a==='duplicate-page')return await lifecycle('duplicate');
  if(a==='reload')return await openEditor(ed.id);
  if(a==='rev-view'){ed.revView=await X.api(`pages/${ed.id}/revisions/${id}`);renderPane();return renderPreview()}
  if(a==='rev-clear'){ed.revView=null;renderPane();return renderPreview()}
  if(a==='rev-restore'){if(confirm('Replace your current draft with this version? Your current draft is kept in history.'))await lifecycle('restore',{revisionId:Number(id)});return}
 }catch(err){X.toast(err.message)}
});

document.addEventListener('input',event=>{
 const el=event.target;
 if(el.id==='pe-search'){list.q=el.value;clearTimeout(listTimer);listTimer=setTimeout(refreshList,250);return}
 if(el.id==='pe-new-title'){const s=document.querySelector('#pe-new-slug');if(!newDraft.slugTouched&&s)s.value=slugify(el.value);return}
 if(el.id==='pe-new-slug'){newDraft.slugTouched=true;return}
 if(!ed||!el.closest('[data-pe-root]'))return;
 if(el.id==='pe-title'){record();ed.title=el.value;return changed()}
 if(el.dataset.meta){record();ed[el.dataset.meta]=el.dataset.meta==='slug'?el.value.toLowerCase():el.value;return changed()}
 if(el.dataset.b){
  const b=ed.blocks.find(x=>x.id===el.dataset.b);if(!b)return;record();
  const value=el.type==='checkbox'?el.checked:el.dataset.f==='level'?Number(el.value):el.value;
  if(el.dataset.i!==undefined)b.items[Number(el.dataset.i)][el.dataset.s]=value;
  else if(el.dataset.lines)b.items=el.value.split('\n');
  else b[el.dataset.f]=value;
  select(b.id);changed();
 }
});
document.addEventListener('keydown',event=>{
 if(!ed)return;if(!document.querySelector('[data-pe-root]')){ed=null;return}
 const mod=event.ctrlKey||event.metaKey,typing=/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
 if(mod&&event.key.toLowerCase()==='s'){event.preventDefault();void save(true,'Manual save');return}
 if(mod&&!typing&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();return}
 if(mod&&!typing&&event.key.toLowerCase()==='y'){event.preventDefault();redo();return}
 if(event.altKey&&ed.sel&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();move(ed.sel,event.key==='ArrowUp'?-1:1)}
});
document.addEventListener('keydown',event=>{
 const row=event.target.closest?.('.pe-list-row');if(row&&(event.key==='Enter'||event.key===' ')&&event.target===row){event.preventDefault();void openEditor(row.dataset.id)}
});
document.addEventListener('dragstart',event=>{const li=event.target.closest?.('#pe-outline li[data-id]');if(!li||!ed)return;ed.drag=li.dataset.id;li.classList.add('drag');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',ed.drag)});
document.addEventListener('dragover',event=>{const li=event.target.closest?.('#pe-outline li[data-id]');if(!li||!ed?.drag)return;event.preventDefault();document.querySelectorAll('#pe-outline li.over').forEach(n=>n.classList.remove('over'));li.classList.add('over')});
document.addEventListener('dragend',()=>{document.querySelectorAll('#pe-outline li').forEach(n=>n.classList.remove('over','drag'));if(ed)ed.drag=null});
document.addEventListener('drop',event=>{
 const li=event.target.closest?.('#pe-outline li[data-id]');if(!li||!ed?.drag)return;event.preventDefault();
 const from=ed.blocks.findIndex(b=>b.id===ed.drag),to=ed.blocks.findIndex(b=>b.id===li.dataset.id);ed.drag=null;
 if(from<0||to<0||from===to)return;record(true);const [b]=ed.blocks.splice(from,1);ed.blocks.splice(to,0,b);changed(true);
});
addEventListener('beforeunload',event=>{if(ed?.dirty){event.preventDefault();event.returnValue=''}});
