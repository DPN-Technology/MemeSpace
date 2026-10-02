import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const center=readFileSync(new URL('../app/identity-center.tsx',import.meta.url),'utf8');
const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const expanded=readFileSync(new URL('../app/expanded-modules.tsx',import.meta.url),'utf8');
test('Identity Center exposes local account flows and replaces one-click module prompts',()=>{
 for(const phrase of ['Identity Center','identifier','password','display name','Create local account','Sign in','needsPasswordSetup','Change password','Active sessions','Export your data','DELETE MY ACCOUNT','local account'])assert.match(center,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
 assert.match(page,/IdentityCenter/);assert.match(page,/openIdentity/);assert.doesNotMatch(page,/href="\/signin-with-chatgpt\?return_to=%2F%23profile/);assert.doesNotMatch(expanded,/href="\/signin-with-chatgpt\?return_to=%2F%23chat/);assert.match(expanded,/openIdentity/);
});
