// Wallet sign-in verification for Phantom / Solana (issue #25). Pure and dependency-free:
// it uses Node's built-in ed25519 support, issues single-use nonces, and verifies the
// signed message server-side. Nothing here ever sees a private key.
import { createPublicKey, verify, randomBytes } from 'node:crypto';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export const NONCE_TTL_MS = 5 * 60 * 1000;

export function base58Decode(text) {
  if (typeof text !== 'string' || !text) throw new TypeError('Invalid base58 string');
  let value = 0n;
  for (const ch of text) {
    const digit = B58.indexOf(ch);
    if (digit < 0) throw new TypeError('Invalid base58 character');
    value = value * 58n + BigInt(digit);
  }
  const bytes = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  for (const ch of text) {
    if (ch !== '1') break;
    bytes.unshift(0);
  }
  return Buffer.from(bytes);
}

export function base58Encode(bytes) {
  let value = BigInt(`0x${Buffer.from(bytes).toString('hex') || '0'}`);
  let out = '';
  while (value > 0n) {
    out = B58[Number(value % 58n)] + out;
    value /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}

export function isSolanaAddress(address) {
  try {
    return base58Decode(address).length === 32;
  } catch {
    return false;
  }
}

export function buildSignInMessage({ domain, address, nonce, issuedAt, statement = 'Sign in to MemeSpace. This does not trigger a transaction or cost any fees.' }) {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    address,
    '',
    statement,
    '',
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(issuedAt).toISOString()}`,
  ].join('\n');
}

export function createNonceStore({ now = () => Date.now(), ttlMs = NONCE_TTL_MS, maxEntries = 10_000 } = {}) {
  const pending = new Map();
  const purge = () => {
    const t = now();
    for (const [nonce, entry] of pending) if (entry.expiresAt <= t) pending.delete(nonce);
  };
  return {
    issue(address, domain) {
      if (!isSolanaAddress(address)) throw new TypeError('Invalid wallet address');
      purge();
      if (pending.size >= maxEntries) throw new RangeError('Too many pending sign-in requests');
      const nonce = randomBytes(16).toString('hex');
      const issuedAt = now();
      pending.set(nonce, { address, domain, issuedAt, expiresAt: issuedAt + ttlMs });
      return { nonce, issuedAt, message: buildSignInMessage({ domain, address, nonce, issuedAt }) };
    },
    // Single use: a nonce is removed the first time it is looked up, valid or not.
    consume(nonce) {
      purge();
      const entry = pending.get(nonce);
      pending.delete(nonce);
      return entry ?? null;
    },
    size: () => pending.size,
  };
}

export function verifyWalletSignature({ address, message, signature }) {
  try {
    const key = base58Decode(address);
    const sig = Buffer.isBuffer(signature) ? signature : Buffer.from(String(signature), 'base64');
    if (key.length !== 32 || sig.length !== 64) return false;
    const publicKey = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, key]), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(message, 'utf8'), publicKey, sig);
  } catch {
    return false;
  }
}

export function verifySignIn(store, { address, nonce, signature, domain }) {
  const entry = store.consume(nonce);
  if (!entry) return { ok: false, reason: 'unknown-or-expired-nonce' };
  if (entry.address !== address) return { ok: false, reason: 'address-mismatch' };
  if (entry.domain !== domain) return { ok: false, reason: 'domain-mismatch' };
  const message = buildSignInMessage({ domain: entry.domain, address, nonce, issuedAt: entry.issuedAt });
  if (!verifyWalletSignature({ address, message, signature })) return { ok: false, reason: 'bad-signature' };
  return { ok: true, address };
}
