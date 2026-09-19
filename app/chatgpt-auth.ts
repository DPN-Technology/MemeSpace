import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {readLocalSession,safeReturn} from '@/lib/local-session.mjs';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{return readLocalSession(await headers());}
export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(user)return user;redirect(chatGPTSignInPath(returnTo));}
export function chatGPTSignInPath(returnTo:string){return '/signin-with-chatgpt?return_to='+encodeURIComponent(safeReturn(returnTo));}
export function chatGPTSignOutPath(returnTo='/'){return '/signout-with-chatgpt?return_to='+encodeURIComponent(safeReturn(returnTo));}
