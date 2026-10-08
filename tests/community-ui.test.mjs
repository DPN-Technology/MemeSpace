import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {DatabaseSync} from 'node:sqlite';

const root=fileURLToPath(new URL('../',import.meta.url));
test('community and knowledge flows persist across navigation at desktop and mobile sizes',{timeout:240000},async t=>{
 const data=await mkdtemp(path.join(tmpdir(),'memespace-community-ui-'));
 const port=Number(process.env.MEMESPACE_COMMUNITY_UI_PORT||5399),base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['scripts/local.mjs','serve'],{cwd:root,env:{...process.env,MEMESPACE_PORT:String(port),MEMESPACE_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
 let log='';server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v);
 t.after(async()=>{server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(5000)]);await rm(data,{recursive:true,force:true})});
 let ready=false;for(let i=0;i<160;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await delay(250)}assert.ok(ready,log);
 const builtHtml=await readFile(path.join(root,'.next/server/app/index.html'),'utf8');
 const servedHtml=await (await fetch(base)).text();
 const builtBundle=builtHtml.match(/page-[a-z0-9]+\.js/)?.[0],servedBundle=servedHtml.match(/page-[a-z0-9]+\.js/)?.[0];
 assert.ok(builtBundle,'the production build must contain a page bundle');assert.ok(servedBundle,'the served page must contain a page bundle');
 assert.equal(servedBundle,builtBundle,'production must serve the current build, not a persisted response from an older build');
 const browser=await chromium.launch({headless:true,executablePath:process.env.MEMESPACE_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 const register=await context.request.post(base+'/api/auth/register',{headers:{Origin:base},data:{identifier:'reader@example.test',displayName:'Community tester',password:'community-test-password'}});assert.equal(register.status(),201);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async hash=>{await page.goto('about:blank');await page.goto(base+'/#'+hash,{waitUntil:'networkidle'});await page.locator('.workspace-body').waitFor();};
 const waitEnabled=async locator=>{await locator.waitFor();for(let i=0;i<80&&await locator.isDisabled();i++)await delay(100);assert.equal(await locator.isEnabled(),true);};
 const message=page.getByRole('textbox',{name:'Message',exact:true});
 const evidence=process.env.MEMESPACE_COMMUNITY_EVIDENCE_DIR;
 async function capture(name){if(evidence){await mkdir(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,name+'.png'),fullPage:true})}}
 async function assertFits(){const dimensions=await page.locator('.workspace-body').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth}));assert.ok(dimensions.scrollWidth<=dimensions.width+1,'workspace content must not overflow horizontally');const box=await page.locator('.workspace-dialog').boundingBox(),size=page.viewportSize();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1,'workspace must remain on screen');}

 await t.test('editing preserves the unsent draft; keyboard replies and room drafts work',async()=>{
  await open('chat');await waitEnabled(message);
  await message.fill('What is your pinball strategy?');await message.press('Enter');
  await page.getByText('What is your pinball strategy?',{exact:true}).waitFor();
  const first=(await (await context.request.get(base+'/api/chat')).json()).messages[0];
  const card=page.locator('[data-message-id="'+first.id+'"]');
  await message.fill('A draft I am still thinking about');
  await card.getByRole('button',{name:'Edit',exact:true}).click();
  await message.fill('An edit I will cancel');await page.getByRole('button',{name:'Cancel reply or edit'}).click();
  assert.equal(await message.inputValue(),'A draft I am still thinking about');
  await card.getByRole('button',{name:'Edit',exact:true}).click();await message.fill('What is your best pinball strategy?');
  await page.getByRole('button',{name:'Save edited message'}).click();await page.getByText('Message updated. Your draft is ready below.',{exact:true}).waitFor();
  assert.equal(await message.inputValue(),'A draft I am still thinking about','saving an edit must restore the normal draft');
  await page.getByRole('button',{name:'Open gaming channel'}).click();await waitEnabled(message);await message.fill('A separate gaming draft');
  await page.getByRole('button',{name:'Open general channel'}).click();await waitEnabled(message);assert.equal(await message.inputValue(),'A draft I am still thinking about');
  await card.getByRole('button',{name:'Reply',exact:true}).click();await message.fill('I aim for controlled bumper chains.');await message.press('Enter');
  await page.getByText('I aim for controlled bumper chains.',{exact:true}).waitFor();
  await card.getByRole('button',{name:'View 1 reply',exact:true}).click();await page.locator('.thread-root').waitFor();
  assert.equal(await page.locator('.chat-message-card').count(),2);
  await page.locator('.chat-message-card:not(.thread-root)').getByRole('button',{name:'Reply',exact:true}).click();
  await message.fill('How do you control the next shot?');await message.press('Enter');
  await page.locator('.chat-message-card:not(.thread-root)').getByText('How do you control the next shot?',{exact:true}).waitFor();
  assert.ok((await page.locator('.thread-root').textContent()).includes('I aim for controlled bumper chains.'),'a nested reply must remain visible in its own conversation');
  await page.getByRole('button',{name:'All messages',exact:true}).click();
  await page.getByRole('textbox',{name:'Search channel messages'}).fill('bumper chains');
  await page.waitForFunction(()=>document.querySelectorAll('.chat-message-card').length===1);
  await page.getByRole('button',{name:'Clear message search'}).click();await page.waitForFunction(()=>document.querySelectorAll('.chat-message-card').length===3);
  await capture('chat-desktop');await assertFits();
 });
 await t.test('guests can browse replies and the sign-in control opens Identity Center',async()=>{
  const guest=await browser.newPage({viewport:{width:1100,height:800}});await guest.goto(base+'/#chat',{waitUntil:'networkidle'});
  await guest.getByRole('button',{name:'View 1 reply',exact:true}).first().click();await guest.locator('.thread-root').waitFor();
  assert.equal(await guest.getByRole('textbox',{name:'Message',exact:true}).isDisabled(),true);
  await guest.getByRole('button',{name:'Open Identity Center to join'}).click();await guest.locator('.identity-dialog').waitFor();await guest.close();
 });
 await t.test('moderation clears selected reply context while keeping the unsent draft',async()=>{
  await open('chat');await waitEnabled(message);
  const first=page.locator('.chat-message-card').first(),id=await first.getAttribute('data-message-id');
  await first.getByRole('button',{name:'Reply',exact:true}).click();await message.fill('Keep this unsent draft');
  const db=new DatabaseSync(path.join(data,'memespace.sqlite'));
  try{
   db.prepare('UPDATE messages SET hidden_at=? WHERE id=?').run(Date.now(),id);
   await page.locator('.chat-compose-context').waitFor({state:'detached',timeout:12000});
   assert.equal(await message.inputValue(),'Keep this unsent draft');
   assert.equal(await page.getByText('What is your best pinball strategy?',{exact:true}).count(),0,'neither the list nor a reply preview may retain hidden text');
  }finally{db.prepare('UPDATE messages SET hidden_at=0 WHERE id=?').run(id);db.close()}
 });
 await t.test('reading-list toggles persist, including removal from the article view',async()=>{
  await open('history/forums');
  const save=page.getByRole('button',{name:'Save Before the feed, there were rooms.',exact:true});await waitEnabled(save);await save.click();
  await page.getByRole('button',{name:'Unsave Before the feed, there were rooms.',exact:true}).waitFor();
  await open('history/forums');const unsave=page.getByRole('button',{name:'Unsave Before the feed, there were rooms.',exact:true});await waitEnabled(unsave);await unsave.click();await save.waitFor();
  const saved=(await (await context.request.get(base+'/api/saved')).json()).items;assert.equal(saved.some(i=>i.kind==='bookmark'&&i.item_key==='forums'),false);
  assert.ok(await page.locator('.reading-sources a').count()>0);
  await capture('reading-desktop');await assertFits();
 });
 await t.test('lesson answers explain mistakes and completion survives a return visit',async()=>{
  await open('learn/security');await page.getByRole('radio',{name:'Share only the first words',exact:true}).check();
  const check=page.getByRole('button',{name:'Check answer',exact:true});await waitEnabled(check);await check.click();await page.getByText('Take another look, then try again.',{exact:true}).waitFor();
  let items=(await (await context.request.get(base+'/api/saved')).json()).items;assert.equal(items.some(i=>i.kind==='lesson'&&i.item_key==='security'),false);
  await page.getByRole('radio',{name:'Refuse and report the impersonation',exact:true}).check();await check.click();await page.getByText('Correct. Your completion is saved.',{exact:true}).waitFor();
  await page.getByLabel('What do you want to remember?').fill('Check the request through an independent route.');await page.getByRole('button',{name:'Save notes',exact:true}).click();await page.getByText('Notes saved to your library.',{exact:true}).waitFor();
  await open('learn/security');await page.locator('.lesson-complete-badge').waitFor();assert.equal(await page.locator('progress').getAttribute('value'),'1');
  await page.waitForFunction(()=>document.querySelector('.lesson-notes textarea')?.value==='Check the request through an independent route.');
  items=(await (await context.request.get(base+'/api/saved')).json()).items;assert.ok(items.some(i=>i.kind==='note'&&i.item_key==='security'));
  await capture('learning-desktop');await assertFits();
 });
 await t.test('expanded content is discoverable through global full-text search',async()=>{
  await open('search');await page.getByRole('textbox',{name:'Search all content'}).fill('reproducible');
  await page.getByRole('button').filter({hasText:'How to verify an on-chain claim'}).click();await page.getByRole('heading',{name:'How to verify an on-chain claim',exact:true}).waitFor();
 });
 await t.test('mobile navigation, reading and the chat composer fit and remain usable',async()=>{
  await page.setViewportSize({width:390,height:844});await open('chat');await waitEnabled(message);await assertFits();
  await page.getByRole('button',{name:'Open gaming channel'}).click();await waitEnabled(message);assert.equal(await message.inputValue(),'A separate gaming draft');
  await message.fill('Touch controls work for this conversation.');await page.getByRole('button',{name:'Send message'}).click();await page.getByText('Touch controls work for this conversation.',{exact:true}).waitFor();
  await capture('chat-mobile');
  await open('history');await page.locator('.reading-card').first().waitFor();await assertFits();await capture('reading-mobile');
  await page.getByRole('textbox',{name:'Search reading'}).fill('Kabosu');assert.equal(await page.locator('.reading-card').count(),1,'article body is included in search');
  await page.locator('.reading-card-open').click();await page.getByRole('heading',{name:'Much language. Very culture.',exact:true}).waitFor();await assertFits();
  await open('learn/security');await page.locator('.lesson-complete-badge').waitFor();await assertFits();await capture('learning-mobile');
 });
 assert.deepEqual(errors,[],'browser must not raise application exceptions');
});
