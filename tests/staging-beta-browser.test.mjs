// Free-beta launch gate: exercise the real Next.js production UI in Chromium.
// Covers actual account registration/persistent browser session and only the two
// allowed skill-game cabinets at desktop and narrow mobile dimensions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.MEMESPACE_BETA_BROWSER_PORT||5399);
const base='http://127.0.0.1:'+port;

async function healthCheck(){
  for(let i=0;i<120;i++){
    try{const response=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1500)});
      if(response.ok&&(await response.json()).ok===true)return;
    }catch{}
    await delay(250);
  }
  throw new Error('Production beta site never became healthy');
}
async function lobby(page){
  await page.goto(base+'/#games',{waitUntil:'networkidle',timeout:60000});
  await page.locator('.arcade-lobby').waitFor({state:'visible',timeout:30000});
  await page.locator('.arcade-classic-card').first().waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.arcade-classic-card')].every(el=>!el.hasAttribute('disabled')),{timeout:30000});
  assert.equal(await page.locator('.arcade-classic-card').count(),2,'only two free beta cabinets should be present');
  assert.equal(await page.locator('.arcade-feature-grid').count(),0,'pinball, pool and reels must be absent in beta');
  const text=await page.locator('.arcade-lobby').innerText();
  assert.match(text,/Two free skill games/i);
  assert.match(text,/No purchases, wagers or prizes/i);
  assert.doesNotMatch(text,/Quantum Reels|Reactor Pinball|After Hours Pool/i);
}
test('real Chromium free-beta UI: desktop/mobile playable entry + member sign-up and refresh',{timeout:240000},async t=>{
  const dataDir=await mkdtemp(path.join(os.tmpdir(),'memespace-beta-browser-'));
  const child=spawn(process.execPath,['scripts/local.mjs','serve'],{
    cwd:root,
    env:{...process.env,MEMESPACE_PORT:String(port),MEMESPACE_DATA_DIR:dataDir,MEMESPACE_LAUNCH_SCOPE:'beta',MEMESPACE_BIND_HOST:'127.0.0.1',MEMESPACE_PUBLIC_ORIGIN:''},
    stdio:['ignore','pipe','pipe']
  });
  let logs='',exitStatus=null;
  child.stdout.on('data',c=>logs+=c);
  child.stderr.on('data',c=>logs+=c);
  child.once('exit',code=>exitStatus=code??1);
  t.after(async()=>{
    if(child.exitCode===null)child.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(5000)]);
    await rm(dataDir,{recursive:true,force:true});
  });
  await healthCheck();
  assert.equal(exitStatus,null,'Next.js app terminated during startup: '+logs.slice(-1600));
  const browser=await chromium.launch({headless:true,executablePath:process.env.MEMESPACE_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  t.after(()=>browser.close());

  for(const {width,height,name} of [{width:1440,height:960,name:'desktop'},{width:390,height:844,name:'mobile'}]){
    await t.test(name+' viewport: free skill game launch, account registration and session persistence',async()=>{
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
      try{
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await lobby(page);

        // Both actual cabinets must be clickable, render and navigate back safely.
        for(const title of ['Binary Match','Signal Sequence']){
          const card=page.locator('.arcade-classic-card').filter({hasText:title});
          assert.equal(await card.isEnabled(),true);
          await card.click();
          await page.locator('.arcade-classic-stage .cabinet-heading h2').waitFor({state:'visible',timeout:20000});
          assert.match(await page.locator('.arcade-classic-stage .cabinet-heading h2').innerText(),new RegExp(title));
          await page.locator('.arcade-backbar button').click();
          await page.locator('.arcade-lobby').waitFor({state:'visible'});
        }

        if(name==='mobile'){
          const box=await page.locator('.workspace-dialog').boundingBox();
          assert.ok(box,'mobile workspace dialog should exist');
          assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=width+2&&box.y+box.height<=height+2,'workspace dialog must fit the mobile viewport');
        }

        const email='browser-'+randomUUID()+'@example.invalid';
        const pass='Beta-browser-'+randomUUID();
        const display=name==='mobile'?'Beta Mobile':'Beta Desktop';
        // The arcade is a modal. Close it before using global-header identity controls.
        await page.keyboard.press('Escape');
        await page.locator('.workspace-dialog').waitFor({state:'hidden',timeout:15000});
        await page.locator('.identity-trigger').click();
        await page.getByRole('tab',{name:'Create local account'}).click();
        await page.locator('#identity-display').fill(display);
        await page.locator('#identity-identifier').fill(email);
        await page.locator('#identity-password').fill(pass);
        await page.locator('#identity-confirm').fill(pass);
        await page.locator('.identity-submit').click();
        await page.waitForFunction(async expected=>{
          const response=await fetch('/api/auth/session');
          return response.ok&&(await response.json()).account?.email===expected;
        },email,{timeout:20000});
        await page.locator('.identity-dialog').getByText('Local account created on this computer.').waitFor({state:'visible',timeout:10000});
        await page.reload({waitUntil:'networkidle',timeout:60000});
        await page.waitForFunction(expected=>document.querySelector('.identity-trigger')?.textContent?.includes(expected),display);
        const session=await page.evaluate(()=>fetch('/api/auth/session').then(r=>r.json()));
        assert.equal(session.account?.email,email,'browser cookie must survive full refresh');
        await lobby(page);
        assert.equal(errors.length,0,'unhandled browser errors: '+errors.join(' | '));
      }finally{await context.close()}
    });
  }
});
