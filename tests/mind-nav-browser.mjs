import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';

export async function checkMindNavigation(base){
 const work=await mkdtemp(path.join(process.cwd(),'.social-browser-'));
 const previous=Object.fromEntries(['TEMP','TMP','TMPDIR'].map(key=>[key,process.env[key]]));
 for(const key of Object.keys(previous))process.env[key]=work;
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.MEMESPACE_CHROMIUM_EXECUTABLE||undefined});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],diagnostics=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')diagnostics.push(message.text())});
  page.on('response',response=>{if(response.status()>=400)diagnostics.push(response.status()+' '+response.url())});
  await page.goto(base+'/#menu',{waitUntil:'networkidle'});
  const dialog=page.getByRole('dialog'),nav=dialog.getByRole('navigation',{name:'Navigate the mind'});
  await nav.waitFor({timeout:15000}).catch(async error=>{throw Error(error.message+'\nBrowser errors: '+JSON.stringify(errors)+'\nDiagnostics: '+JSON.stringify(diagnostics).slice(0,2500)+'\nPage: '+(await page.locator('body').innerText()).slice(0,1800))});
  assert.equal(await nav.locator('.bmap-node').count(),9);
  assert.equal(await dialog.locator('.workspace-tabs,.menu-grid').count(),0);
  const modules=[['history','Meme History'],['coins','Memecoin History'],['games','Game Center'],['chat','Community Chat'],['social','Social Network'],['media','Media Vault'],['learn','Crypto Education'],['wallet','Wallet'],['profile','Your Profile']];
  for(const [id,title] of modules){
   await dialog.getByRole('button',{name:'Go to '+title,exact:true}).click();
   await page.waitForFunction(id=>document.querySelector('.workspace-'+id)!==null,id);
   assert.equal(await dialog.locator('.bmap-node[aria-current="page"]').getAttribute('data-node'),id);
   assert.ok((await dialog.locator('.workspace-body').textContent()).trim().length>0,title+' renders working module content');
  }
  const profile=dialog.getByRole('button',{name:'Go to Your Profile',exact:true});
  await profile.focus();await profile.press('Home');
  await page.waitForFunction(()=>location.hash==='#history');
  await dialog.getByRole('button',{name:'Go to Meme History',exact:true}).press('End');
  await page.waitForFunction(()=>location.hash==='#profile');
  await dialog.getByRole('button',{name:'Go to Your Profile',exact:true}).press('5');
  await page.waitForFunction(()=>location.hash==='#social');
  await page.keyboard.press('Control+k');
  await page.waitForFunction(()=>location.hash==='#search');
  await dialog.getByRole('button',{name:'Go to Social Network',exact:true}).click();
  await dialog.locator('.social-network').waitFor();
  await dialog.getByRole('button',{name:'Discover people',exact:true}).click();
  await dialog.getByRole('region',{name:'Creator discovery'}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const bounds=await nav.boundingBox();
  assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391,'mobile brain-map stays inside viewport: '+JSON.stringify({bounds,dialog:await dialog.boundingBox(),header:await dialog.locator('.workspace-header').boundingBox(),viewport:await page.evaluate(()=>({width:innerWidth,scroll:scrollX}))}));
  const overflow=await nav.evaluate(el=>el.scrollWidth>el.clientWidth+1);
  assert.equal(overflow,false,'mobile brain-map does not overflow');
  await page.goto(base+'/social',{waitUntil:'networkidle'});
  await page.getByRole('navigation',{name:'Navigate the mind'}).waitFor();
  assert.equal(await page.locator('.social-network').count(),1);
  await page.getByRole('button',{name:'Go to Community Chat',exact:true}).click();
  await page.waitForURL(base+'/#chat');await page.locator('.workspace-chat').waitFor();
  const registered=await page.context().request.post(base+'/api/auth/register',{headers:{Origin:base},data:{identifier:'browser-social@example.test',displayName:'Browser Social Creator',password:'browser-social-password-123'}});
  assert.equal(registered.status(),201);
  await page.goto('about:blank');
  await page.goto(base+'/#social',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Publish post',exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Write a post',exact:true}).fill('A real social post from the mobile brain map #browser_signal');
  await page.getByRole('button',{name:'Publish post',exact:true}).click();
  await page.getByText('Published to MemeSpace.',{exact:true}).waitFor();
  await page.reload({waitUntil:'networkidle'});
  await page.getByText('A real social post from the mobile brain map #browser_signal',{exact:true}).waitFor();
  await delay(200);
  assert.deepEqual(errors,[],'browser has no runtime errors');
 }finally{
  if(browser)await browser.close();
  for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}
  await rm(work,{recursive:true,force:true,maxRetries:10,retryDelay:250});
 }
}
