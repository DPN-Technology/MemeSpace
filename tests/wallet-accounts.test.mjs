import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '../lib/local-database.mjs';
import { base58Encode } from '../lib/wallet-auth.mjs';
import { issueChallenge, signInWithWallet, linkWallet, listWallets, unlinkWallet } from '../lib/wallet-accounts.mjs';
import { createAccount, issueSession, authenticateAccount } from '../lib/local-auth.mjs';

const DOMAIN = 'memespace.local';
function wallet() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const address = base58Encode(publicKey.export({ format: 'der', type: 'spki' }).subarray(-32));
  return { address, sig: (m) => sign(null, Buffer.from(m), privateKey).toString('base64') };
}
function withDb(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'memespace-wallet-'));
  const previous = process.env.MEMESPACE_DATA_DIR;
  process.env.MEMESPACE_DATA_DIR = dir;
  const db = openDatabase(process.cwd());
  try { return fn(db); } finally { db.close(); process.env.MEMESPACE_DATA_DIR = previous ?? ''; rmSync(dir, { recursive: true, force: true }); }
}
const attempt = (db, w, c, extra = {}) => signInWithWallet(db, { address: w.address, nonce: c.nonce, signature: w.sig(c.message), domain: DOMAIN, ...extra });

test('first wallet sign-in creates a wallet-only account and later ones reuse it', () => withDb((db) => {
  const w = wallet();
  const first = attempt(db, w, issueChallenge(db, { address: w.address, domain: DOMAIN }));
  assert.equal(first.created, true);
  const again = attempt(db, w, issueChallenge(db, { address: w.address, domain: DOMAIN }));
  assert.deepEqual([again.created, again.userId], [false, first.userId]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM profiles WHERE user_id=?').get(first.userId).n, 1);
  assert.ok(issueSession(db, first.userId, 'Wallet sign-in').token);
  assert.throws(() => authenticateAccount(db, `${w.address}@wallet.invalid`, 'anything-at-all-12'), { code: 'AUTH_INVALID' });
}));

test('a challenge is single use, even after a failed attempt', () => withDb((db) => {
  const w = wallet(), other = wallet();
  const c = issueChallenge(db, { address: w.address, domain: DOMAIN });
  assert.throws(() => signInWithWallet(db, { address: w.address, nonce: c.nonce, signature: other.sig(c.message), domain: DOMAIN }), { code: 'AUTH_INVALID' });
  assert.throws(() => attempt(db, w, c), { code: 'AUTH_INVALID' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM wallet_links').get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE email LIKE '%@wallet.invalid'").get().n, 0);
}));

test('expired, wrong-domain and wrong-purpose challenges are rejected', () => withDb((db) => {
  const w = wallet();
  const old = issueChallenge(db, { address: w.address, domain: DOMAIN, now: 1_000 });
  assert.throws(() => attempt(db, w, old), { code: 'AUTH_INVALID' });
  const c = issueChallenge(db, { address: w.address, domain: DOMAIN });
  assert.throws(() => signInWithWallet(db, { address: w.address, nonce: c.nonce, signature: w.sig(c.message), domain: 'evil.example' }), { code: 'AUTH_INVALID' });
  const user = createAccount(db, { identifier: 'a@example.com', displayName: 'A', password: 'correct horse battery' });
  const link = issueChallenge(db, { address: w.address, domain: DOMAIN, purpose: 'link', userId: user.userId });
  assert.throws(() => attempt(db, w, link), { code: 'AUTH_INVALID' });
  assert.throws(() => issueChallenge(db, { address: w.address, domain: DOMAIN, purpose: 'link' }), { code: 'AUTH_REQUIRED' });
  assert.throws(() => issueChallenge(db, { address: 'nope', domain: DOMAIN }), { code: 'AUTH_INPUT' });
}));

test('linking attaches a wallet to an existing account and sign-in then resolves to it', () => withDb((db) => {
  const w = wallet();
  const user = createAccount(db, { identifier: 'b@example.com', displayName: 'B', password: 'correct horse battery' });
  const c = issueChallenge(db, { address: w.address, domain: DOMAIN, purpose: 'link', userId: user.userId });
  linkWallet(db, { userId: user.userId, address: w.address, nonce: c.nonce, signature: w.sig(c.message), domain: DOMAIN });
  assert.equal(listWallets(db, user.userId).length, 1);
  assert.equal(attempt(db, w, issueChallenge(db, { address: w.address, domain: DOMAIN })).userId, user.userId);
  const other = createAccount(db, { identifier: 'c@example.com', displayName: 'C', password: 'correct horse battery' });
  const steal = issueChallenge(db, { address: w.address, domain: DOMAIN, purpose: 'link', userId: other.userId });
  assert.throws(() => linkWallet(db, { userId: other.userId, address: w.address, nonce: steal.nonce, signature: w.sig(steal.message), domain: DOMAIN }), { code: 'DUPLICATE' });
  const spoof = issueChallenge(db, { address: wallet().address, domain: DOMAIN, purpose: 'link', userId: other.userId });
  assert.throws(() => linkWallet(db, { userId: user.userId, address: spoof.message.split('\n')[1], nonce: spoof.nonce, signature: 'AA', domain: DOMAIN }), { code: 'AUTH_INVALID' });
}));

test('a wallet-only account cannot unlink its last wallet; others can', () => withDb((db) => {
  const w = wallet();
  const { userId } = attempt(db, w, issueChallenge(db, { address: w.address, domain: DOMAIN }));
  assert.throws(() => unlinkWallet(db, userId, w.address), { code: 'AUTH_INPUT' });
  const user = createAccount(db, { identifier: 'd@example.com', displayName: 'D', password: 'correct horse battery' });
  const w2 = wallet(), c = issueChallenge(db, { address: w2.address, domain: DOMAIN, purpose: 'link', userId: user.userId });
  linkWallet(db, { userId: user.userId, address: w2.address, nonce: c.nonce, signature: w2.sig(c.message), domain: DOMAIN });
  assert.equal(unlinkWallet(db, user.userId, w2.address), true);
  assert.equal(listWallets(db, user.userId).length, 0);
}));
