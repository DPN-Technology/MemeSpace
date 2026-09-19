// Reproduce the unavailable worker-runtime boundary from the reported failure.
import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){
  if(/\/(?:wrangler|workerd|vinext|@cloudflare)\//.test(url.replaceAll('\\','/')))
    throw new Error('Test environment: Cloudflare worker runtime is unavailable.');
  return next(url,context);
}});
