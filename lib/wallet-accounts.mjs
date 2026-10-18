// Database-backed wallet identity (issue #25). Builds on lib/wallet-auth.mjs.
// A wallet signs a challenge to sign in (creating a wallet-only account on first use)
// or to link itself to an existing signed-in account. Nonces are single-use and persisted.
import { randomBytes } from 'node:crypto';
import { buildSignInMessage, isSolanaAddress, verifyWalletSignature, NONCE_TTL_MS } from './wallet-auth.mjs';

const MAX_PENDING = 5_000;
const MAX_WALLETS_PER_USER = 5;

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function shortAddress(address) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function issueChallenge(db, { address, domain, purpose = 'signin', userId = null, now = Date.now() }) {
  if (!isSolanaAddress(address)) throw fail('AUTH_INPUT', 'Enter a valid Solana wallet address.');
  if (typeof domain !== 'string' || !domain) throw fail('AUTH_INPUT', 'Missing domain.');
  if (purpose !== 'signin' && purpose !== 'link') throw fail('AUTH_INPUT', 'Unknown challenge purpose.');
  if (purpose === 'link' && !userId) throw fail('AUTH_REQUIRED', 'Sign in before linking a wallet.');
  db.prepare('DELETE FROM wallet_challenges WHERE expires_at<=?').run(now);
  if (db.prepare('SELECT COUNT(*) AS n FROM wallet_challenges').get().n >= MAX_PENDING) {
    throw fail('RATE_LIMIT', 'Too many pending wallet requests. Try again shortly.');
  }
  const nonce = randomBytes(16).toString('hex');
  db.prepare('INSERT INTO wallet_challenges(nonce,address,domain,purpose,user_id,issued_at,expires_at) VALUES(?,?,?,?,?,?,?)')
    .run(nonce, address, domain, purpose, purpose === 'link' ? userId : null, now, now + NONCE_TTL_MS);
  return { nonce, message: buildSignInMessage({ domain, address, nonce, issuedAt: now }), expiresAt: now + NONCE_TTL_MS };
}

// Deletes the nonce atomically before verifying, so a challenge is never reusable.
function consumeChallenge(db, { address, nonce, signature, domain, now }) {
  const row = typeof nonce === 'string' ? db.prepare('DELETE FROM wallet_challenges WHERE nonce=? RETURNING *').get(nonce) : null;
  if (!row || Number(row.expires_at) <= now) throw fail('AUTH_INVALID', 'Wallet sign-in expired. Try again.');
  if (row.address !== address || row.domain !== domain) throw fail('AUTH_INVALID', 'Wallet sign-in does not match.');
  const message = buildSignInMessage({ domain: row.domain, address, nonce, issuedAt: Number(row.issued_at) });
  if (!verifyWalletSignature({ address, message, signature })) throw fail('AUTH_INVALID', 'Wallet signature was not valid.');
  return row;
}

function createWalletAccount(db, address, now) {
  const userId = `usr_${randomBytes(18).toString('base64url')}`;
  const name = `Wallet ${shortAddress(address)}`;
  db.prepare('INSERT INTO accounts(user_id,email,password_hash,password_salt,display_name,created_at,updated_at,last_login_at,failed_attempts,locked_until,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(userId, `${address.toLowerCase()}@wallet.invalid`, 'wallet_only$', '', name, now, now, now, 0, 0, 0);
  db.prepare('INSERT OR IGNORE INTO profiles(user_id,name,bio,updated_at) VALUES(?,?,?,?)').run(userId, name, '', now);
  return userId;
}

export function signInWithWallet(db, { address, nonce, signature, domain, now = Date.now() }) {
  const row = consumeChallenge(db, { address, nonce, signature, domain, now });
  db.exec('BEGIN IMMEDIATE');
  try {
    if (row.purpose !== 'signin') throw fail('AUTH_INVALID', 'Wallet sign-in does not match.');
    const link = db.prepare('SELECT user_id FROM wallet_links WHERE address=?').get(address);
    let userId;
    let created = false;
    if (link) {
      userId = link.user_id;
      const account = db.prepare('SELECT deleted_at,suspended_at FROM accounts WHERE user_id=?').get(userId);
      if (!account || account.deleted_at || account.suspended_at) throw fail('AUTH_INVALID', 'This account is unavailable.');
      db.prepare('UPDATE wallet_links SET last_used_at=? WHERE address=?').run(now, address);
      db.prepare('UPDATE accounts SET last_login_at=?,updated_at=? WHERE user_id=?').run(now, now, userId);
    } else {
      userId = createWalletAccount(db, address, now);
      db.prepare('INSERT INTO wallet_links(address,user_id,linked_at,last_used_at) VALUES(?,?,?,?)').run(address, userId, now, now);
      created = true;
    }
    db.exec('COMMIT');
    return { userId, created };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function linkWallet(db, { userId, address, nonce, signature, domain, now = Date.now() }) {
  const row = consumeChallenge(db, { address, nonce, signature, domain, now });
  db.exec('BEGIN IMMEDIATE');
  try {
    if (row.purpose !== 'link' || row.user_id !== userId) throw fail('AUTH_INVALID', 'Wallet link does not match.');
    if (db.prepare('SELECT 1 FROM wallet_links WHERE address=?').get(address)) throw fail('DUPLICATE', 'That wallet is already linked.');
    if (db.prepare('SELECT COUNT(*) AS n FROM wallet_links WHERE user_id=?').get(userId).n >= MAX_WALLETS_PER_USER) {
      throw fail('AUTH_INPUT', `You can link up to ${MAX_WALLETS_PER_USER} wallets.`);
    }
    db.prepare('INSERT INTO wallet_links(address,user_id,linked_at,last_used_at) VALUES(?,?,?,?)').run(address, userId, now, now);
    db.exec('COMMIT');
    return { address };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function listWallets(db, userId) {
  return db.prepare('SELECT address,linked_at,last_used_at FROM wallet_links WHERE user_id=? ORDER BY linked_at').all(userId)
    .map((r) => ({ address: r.address, linkedAt: Number(r.linked_at), lastUsedAt: Number(r.last_used_at) }));
}

export function unlinkWallet(db, userId, address) {
  const account = db.prepare('SELECT password_hash FROM accounts WHERE user_id=?').get(userId);
  const wallets = db.prepare('SELECT COUNT(*) AS n FROM wallet_links WHERE user_id=?').get(userId).n;
  if (account?.password_hash === 'wallet_only$' && wallets <= 1) {
    throw fail('AUTH_INPUT', 'This is your only way to sign in. Set a password before unlinking it.');
  }
  return db.prepare('DELETE FROM wallet_links WHERE user_id=? AND address=?').run(userId, address).changes > 0;
}
