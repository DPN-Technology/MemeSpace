import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {startSocialServer} from './social-project.mjs';
import {checkMindNavigation} from './mind-nav-browser.mjs';

test('brain-map chooser navigates every module and social publishing works on desktop and mobile',{timeout:240000},async t=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const {base}=await startSocialServer(t,root,Number(process.env.MEMESPACE_MIND_NAV_PORT||5405));
 await checkMindNavigation(base);
});
