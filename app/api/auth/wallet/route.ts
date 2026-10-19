import {listWallets,unlinkWallet} from '@/lib/wallet-accounts.mjs';
import {authFailure,authResponse,parseBody,requireAuth} from '../_shared';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{const context=requireAuth(request);return authResponse({wallets:listWallets(context.db,context.session!.userId)},200,context.cookie)}
  catch(error){return authFailure(error)}
}
export async function DELETE(request:Request){
  try{
    const context=requireAuth(request);const input=await parseBody(request);
    const removed=unlinkWallet(context.db,context.session!.userId,String(input?.address??''));
    return authResponse({removed},200,context.cookie);
  }catch(error){return authFailure(error)}
}
