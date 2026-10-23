import {createHash} from 'node:crypto';
// No spoofable client-IP headers. Bind rate accounting to single-instance SQLite.
// Enforce true per-IP limits on the trusted HTTPS proxy.
const rules={login:[[90,60000],[8,900000]],register:[[15,60000],[3,900000]],password:[[40,60000],[6,900000]],delete:[[30,60000],[4,900000]]};
let checks=0;
export function allowPublicRegistration(env=process.env){
  return !env.MEMESPACE_PUBLIC_ORIGIN||(env.MEMESPACE_LAUNCH_SCOPE==='beta'&&env.MEMESPACE_REGISTRATION_GATE==='external');
}
export function rateLimitAuth(db,kind,identifier='',now=Date.now()){
  const rule=rules[kind];if(!rule)throw Error('Invalid auth rate scope');
  db.exec('CREATE TABLE IF NOT EXISTS auth_request_limits(bucket TEXT PRIMARY KEY,hits INTEGER NOT NULL,reset_at INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS auth_limits_expiry ON auth_request_limits(reset_at)');
  if(++checks%64===0)db.prepare('DELETE FROM auth_request_limits WHERE reset_at<?').run(now);
  const normalized=typeof identifier==='string'?identifier.normalize('NFKC').trim().toLowerCase().slice(0,254):'';
  const digest=createHash('sha256').update(kind+'\0'+normalized).digest('hex');
  for(const [key,settings] of [[kind+':global',rule[0]],[kind+':'+digest,rule[1]]]){
    const [cap,window]=settings;
    const row=db.prepare('INSERT INTO auth_request_limits(bucket,hits,reset_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN reset_at<=? THEN 1 ELSE hits+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING hits,reset_at').get(key,now+window,now,now);
    if(row.hits>cap){const ex=Error('Too many requests');ex.code='AUTH_LIMIT';ex.retryAfter=Math.max(1,Math.ceil((row.reset_at-now)/1000));throw ex}
  }
}
