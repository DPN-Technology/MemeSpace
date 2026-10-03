import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl=process.env.CAPTURE_BASE_URL||"http://127.0.0.1:5173";
const outputDir=path.resolve("docs/evidence/runtime");
await fs.mkdir(outputDir,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:1600,height:1000},
  colorScheme:"dark",
  reducedMotion:"reduce"
});
const page=await context.newPage();
const artifacts=[];

async function shot(file,label){
  await page.waitForTimeout(900);
  await page.screenshot({path:path.join(outputDir,file),fullPage:true});
  artifacts.push({file,label,route:new URL(page.url()).pathname+new URL(page.url()).hash,viewport:"1600x1000"});
}

await page.goto(baseUrl,{waitUntil:"networkidle",timeout:120000});
await shot("memespace-entry.png","MemeSpace Entry");

await page.goto(baseUrl+"/#games",{waitUntil:"networkidle",timeout:120000});
await page.getByText("A different kind", {exact:false}).first().waitFor({state:"visible",timeout:30000});
await shot("memespace-arcade-lobby.png","Neon Arcade Lobby");

for(const [name,file,label] of [
  ["Reactor Pinball","memespace-reactor-pinball.png","Reactor Pinball"],
  ["After Hours Pool","memespace-after-hours-pool.png","After Hours Pool"],
  ["Quantum Reels","memespace-quantum-reels.png","Quantum Reels"]
]){
  await page.goto(baseUrl+"/#games",{waitUntil:"networkidle",timeout:120000});
  const button=page.getByText(name,{exact:true}).first();
  if(await button.count()){
    await button.click();
    await page.waitForTimeout(1000);
    await shot(file,label);
  }
}

await fs.writeFile(path.join(outputDir,"manifest.json"),JSON.stringify({
  schemaVersion:1,
  product:"MemeSpace",
  repository:"MemeSpace",
  generatedAt:new Date().toISOString(),
  sourceCommit:process.env.GITHUB_SHA||"local",
  evidenceType:"actual-rendered-ui",
  dataBoundary:"Captured from the real local MemeSpace Node/Next.js runtime against a fresh isolated SQLite data directory. Arcade values and records are local capture-session state and are not server-verified competitive scores.",
  artifacts
},null,2)+"\n");
await browser.close();
