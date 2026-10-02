import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {rawDatabase} from '@/db/raw';
import {readAuthSession} from '@/lib/local-auth.mjs';
import {safeReturn} from '@/lib/local-session.mjs';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null;needsPasswordSetup?:boolean};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{
  const session=readAuthSession(rawDatabase(),await headers());
  if(!session)return null;
  const account=session.account;if(!account)return null;
  return {userId:account.userId,displayName:account.displayName,email:account.email,fullName:account.displayName,needsPasswordSetup:account.needsPasswordSetup};
}
export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(user)return user;redirect(chatGPTSignInPath(returnTo));}
export function chatGPTSignInPath(returnTo:string){return '/signin-with-chatgpt?return_to='+encodeURIComponent(safeReturn(returnTo));}
export function chatGPTSignOutPath(returnTo='/'){return '/signout-with-chatgpt?return_to='+encodeURIComponent(safeReturn(returnTo));}
