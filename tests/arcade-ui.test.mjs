import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('..',import.meta.url));
const port=Number(process.env.MEMESPACE_UI_PORT||5397);
const base=`http://127.0.0.1:${port}`;

async function waitForHealth(){
 for(let attempt=0;attempt<120;attempt++){
  try{
   const response=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(1500)});
   if(response.ok&&(await response.json()).runtime==='node')return;
  }catch{}
  await delay(250);
 }
 throw new Error(`MemeSpace did not become ready at ${base}`);
}

async function waitForVisible(locator,timeout=15000){
 await locator.waitFor({state:'visible',timeout});
 return locator;
}

test('arcade controls work in the production browser at desktop and mobile sizes',{timeout:180000},async(t)=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'memespace-arcade-ui-'));
 const server=spawn(process.execPath,['scripts/local.mjs','serve'],{
  cwd:root,
  env:{...process.env,MEMESPACE_PORT:String(port),MEMESPACE_DATA_DIR:dataDir,MEMESPACE_TEST_MODE:'serve'},
  stdio:['ignore','pipe','pipe']
 });
 let serverOutput='';server.stdout.on('data',chunk=>{serverOutput+=chunk});server.stderr.on('data',chunk=>{serverOutput+=chunk});
 t.after(async()=>{server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(5000)]);await rm(dataDir,{recursive:true,force:true})});
 await waitForHealth();

 const executable=process.env.MEMESPACE_CHROMIUM_EXECUTABLE;
 const browser=await chromium.launch({headless:true,executablePath:executable||undefined,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error));

 async function openGames(){
  await page.goto(`${base}/#games`,{waitUntil:'networkidle',timeout:30000});
  await waitForVisible(page.locator('.arcade-lobby'));
  await waitForVisible(page.locator('.pinball-feature:not([disabled])'),30000);
 }
 async function lobby(){
  if(await page.locator('.arcade-lobby').isVisible().catch(()=>false))return;
  await page.locator('.arcade-backbar button').click();
  await waitForVisible(page.locator('.arcade-lobby'));
 }
 async function openGame(card,ready){
  await lobby();
  await page.locator(card).click();
  await waitForVisible(page.locator(ready),30000);
 }
 async function shots(){return Number(await page.locator('.pool-scorebar .arcade-stat').nth(1).locator('strong').textContent());}
 function point(box,x,y){return {x:box.x+box.width*x/1000,y:box.y+box.height*y/540}}
 function assertDialogFits(viewport){
  return page.locator('.workspace-dialog').boundingBox().then(box=>{
   assert.ok(box,'workspace dialog should be rendered');
   assert.ok(box.x>=0&&box.y>=0,'workspace dialog should not be translated off-screen');
   assert.ok(box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'workspace dialog should fit the viewport');
  });
 }

 await openGames();
 await assertDialogFits({width:1440,height:960});

 await openGame('.pool-feature','.pool-canvas');
 const canvas=page.locator('.pool-canvas');
 const box=await canvas.boundingBox();assert.ok(box);
 const cue=point(box,270,270);
 await page.mouse.click(cue.x+22,cue.y);
 assert.equal(await shots(),0,'a tap beside the cue should only aim');
 await page.mouse.move(cue.x+24,cue.y);await page.mouse.down();await page.mouse.move(cue.x+130,cue.y);await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('.pool-scorebar .arcade-stat:nth-child(2) strong')?.textContent==='1');
 assert.equal(await shots(),1,'a deliberate pull should shoot');
 await page.getByRole('button',{name:'Restart this game',exact:true}).click();
 await page.locator('.pool-cabinet').press('Space');
 await page.waitForFunction(()=>document.querySelector('.pool-scorebar .arcade-stat:nth-child(2) strong')?.textContent==='1');
 await page.getByRole('button',{name:'Restart this game',exact:true}).click();
 await page.getByRole('tab',{name:'Vs computer',exact:true}).click();
 const cpu=page.locator('.pool-options label').filter({hasText:/CPU/}).locator('select');
 await cpu.waitFor({state:'visible'});await cpu.selectOption('hard');
 const practice=page.getByLabel('Practice table');await practice.selectOption('line-drill');
 assert.equal(await practice.inputValue(),'line-drill');assert.equal(await cpu.inputValue(),'hard');

 await openGame('.pinball-feature','.pinball-canvas');
 await page.locator('.pinball-canvas').click();
 await page.waitForFunction(()=>document.querySelector('.arcade-live-note')?.textContent?.includes('Reactor online'));
 assert.equal(await page.getByRole('button',{name:'Launch ball',exact:true}).isDisabled(),true,'tapping the table should launch a ready pinball ball');
 await page.getByRole('button',{name:'Launch ball',exact:true}).click();
 await page.getByRole('button',{name:'Pause game',exact:true}).click();
 await waitForVisible(page.locator('.arcade-tools button[aria-label="Resume game"]'));
 await page.locator('.arcade-tools button[aria-label="Resume game"]').click();
 assert.equal(await page.locator('.pinball-canvas').count(),1);

 await openGame('.slots-feature','.slot-reels');
 assert.equal(await page.locator('.slot-reel').count(),5,'Quantum Reels should render five reels');
 await page.locator('.slots-cabinet').press('Enter');
 await waitForVisible(page.locator('.slot-history-list > div'),10000);
 const wallet=await page.evaluate(()=>JSON.parse(localStorage.getItem('memespace-arcade-slots:guest')));
 assert.equal(wallet.spins,1,'a completed spin should persist in the browser wallet');
 await lobby();
 await openGame('.slots-feature','.slot-reels');
 const reloadedWallet=await page.evaluate(()=>JSON.parse(localStorage.getItem('memespace-arcade-slots:guest')));
 assert.equal(reloadedWallet.spins,1,'slot history should survive returning to the cabinet');

 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 const mobileErrors=[];mobile.on('pageerror',error=>mobileErrors.push(error));
 await mobile.goto(`${base}/#games`,{waitUntil:'networkidle',timeout:30000});
 await waitForVisible(mobile.locator('.arcade-lobby'));
 await waitForVisible(mobile.locator('.pool-feature:not([disabled])'),30000);
 await mobile.locator('.pool-feature').tap();
 await waitForVisible(mobile.locator('.pool-canvas'),30000);
 const mobileBox=await mobile.locator('.pool-canvas').boundingBox();assert.ok(mobileBox);
 const mobileDialog=await mobile.locator('.workspace-dialog').boundingBox();assert.ok(mobileDialog);
 assert.equal(mobileDialog.x,0);assert.equal(mobileDialog.y,0);assert.ok(mobileDialog.width<=390&&mobileDialog.height<=844);
 const mobileCue=point(mobileBox,270,270);
 await mobile.touchscreen.tap(mobileCue.x+22,mobileCue.y);
 assert.equal(Number(await mobile.locator('.pool-scorebar .arcade-stat').nth(1).locator('strong').textContent()),0,'a mobile tap should not fire a pool shot');
 await mobile.close();

 assert.deepEqual(pageErrors,[],'the desktop arcade flow should not raise page errors');
 assert.deepEqual(mobileErrors,[],'the mobile arcade flow should not raise page errors');
 if(server.exitCode!==null)throw new Error(`MemeSpace server exited early (${server.exitCode})\n${serverOutput}`);
});
