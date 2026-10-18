import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  base58Decode, base58Encode, isSolanaAddress, createNonceStore, verifySignIn, buildSignInMessage, NONCE_TTL_MS,
} from '../lib/wallet-auth.mjs';

function wallet() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  return { address: base58Encode(raw), signMessage: (m) => sign(null, Buffer.from(m), privateKey).toString('base64') };
}
const DOMAIN = 'memespace.local';

test('base58 round-trips and validates addresses', () => {
  const bytes = Buffer.from([0, 0, 1, 2, 255, 128]);
  assert.deepEqual(base58Decode(base58Encode(bytes)), bytes);
  assert.equal(isSolanaAddress(wallet().address), true);
  assert.equal(isSolanaAddress('not-an-address'), false);
  assert.equal(isSolanaAddress('0OIl'), false);
  assert.equal(isSolanaAddress(''), false);
});

test('a valid signature signs the user in exactly once', () => {
  const w = wallet(), store = createNonceStore();
  const { nonce, message } = store.issue(w.address, DOMAIN);
  const signature = w.signMessage(message);
  assert.deepEqual(verifySignIn(store, { address: w.address, nonce, signature, domain: DOMAIN }), { ok: true, address: w.address });
  assert.equal(verifySignIn(store, { address: w.address, nonce, signature, domain: DOMAIN }).reason, 'unknown-or-expired-nonce');
});

test('forged, cross-wallet and cross-domain attempts are rejected and burn the nonce', () => {
  const w = wallet(), other = wallet(), store = createNonceStore();
  let issued = store.issue(w.address, DOMAIN);
  assert.equal(verifySignIn(store, { address: w.address, nonce: issued.nonce, signature: other.signMessage(issued.message), domain: DOMAIN }).reason, 'bad-signature');
  assert.equal(store.size(), 0);
  issued = store.issue(w.address, DOMAIN);
  assert.equal(verifySignIn(store, { address: other.address, nonce: issued.nonce, signature: other.signMessage(issued.message), domain: DOMAIN }).reason, 'address-mismatch');
  issued = store.issue(w.address, DOMAIN);
  assert.equal(verifySignIn(store, { address: w.address, nonce: issued.nonce, signature: w.signMessage(issued.message), domain: 'evil.example' }).reason, 'domain-mismatch');
});

test('a signature over a different message is rejected', () => {
  const w = wallet(), store = createNonceStore();
  const { nonce } = store.issue(w.address, DOMAIN);
  const tampered = buildSignInMessage({ domain: DOMAIN, address: w.address, nonce, issuedAt: 1, statement: 'Send me all your funds' });
  assert.equal(verifySignIn(store, { address: w.address, nonce, signature: w.signMessage(tampered), domain: DOMAIN }).reason, 'bad-signature');
});

test('nonces expire and the store is bounded', () => {
  let clock = 1_000_000;
  const w = wallet(), store = createNonceStore({ now: () => clock, maxEntries: 2 });
  const { nonce, message } = store.issue(w.address, DOMAIN);
  clock += NONCE_TTL_MS + 1;
  assert.equal(verifySignIn(store, { address: w.address, nonce, signature: w.signMessage(message), domain: DOMAIN }).reason, 'unknown-or-expired-nonce');
  store.issue(w.address, DOMAIN);
  store.issue(w.address, DOMAIN);
  assert.throws(() => store.issue(w.address, DOMAIN), RangeError);
  assert.throws(() => store.issue('bogus', DOMAIN), TypeError);
});

test('malformed signatures never throw', () => {
  const w = wallet(), store = createNonceStore();
  const { nonce } = store.issue(w.address, DOMAIN);
  assert.equal(verifySignIn(store, { address: w.address, nonce, signature: 'AAAA', domain: DOMAIN }).ok, false);
});
