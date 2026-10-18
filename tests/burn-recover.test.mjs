import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPERATIONS, buildPlan, classifyAsset, validateConfirmations, formatSol,
  TOKEN_ACCOUNT_RENT_LAMPORTS, SIGNATURE_FEE_LAMPORTS,
} from '../lib/burn-recover.mjs';

const W = 'Wallet111';
const tok = (n, o = {}) => ({ account: `acc${n}`, mint: `mint${n}`, owner: W, amount: '0', decimals: 6, ...o });

test('empty accounts are eligible and reclaim rent', () => {
  const plan = buildPlan({ wallet: W, assets: [tok(1), tok(2)], operation: OPERATIONS.CLOSE_EMPTY });
  assert.equal(plan.items.length, 2);
  assert.equal(plan.estimate.reclaimLamports, TOKEN_ACCOUNT_RENT_LAMPORTS * 2n);
  assert.equal(plan.estimate.netLamports, TOKEN_ACCOUNT_RENT_LAMPORTS * 2n - SIGNATURE_FEE_LAMPORTS);
  assert.equal(plan.irreversible, false);
});

test('NFTs, valuable, frozen, delegated and foreign accounts are blocked', () => {
  const assets = [
    tok(1, { amount: '1', decimals: 0, supply: '1' }),
    tok(2, { amount: '5', valueUsd: 100 }),
    tok(3, { frozen: true }),
    tok(4, { delegate: 'D' }),
    tok(5, { owner: 'Someone' }),
  ];
  const plan = buildPlan({ wallet: W, assets, operation: OPERATIONS.BURN_AND_CLOSE });
  assert.equal(plan.items.length, 0);
  assert.equal(plan.blocked.length, 5);
});

test('operation and balance must match; duplicates are rejected', () => {
  const full = tok(1, { amount: '10' });
  assert.equal(buildPlan({ wallet: W, assets: [full], operation: OPERATIONS.CLOSE_EMPTY }).items.length, 0);
  assert.equal(buildPlan({ wallet: W, assets: [tok(2)], operation: OPERATIONS.BURN }).items.length, 0);
  const dup = buildPlan({ wallet: W, assets: [full, full], operation: OPERATIONS.BURN_AND_CLOSE });
  assert.equal(dup.items.length, 1);
  assert.equal(dup.blocked.length, 1);
});

test('batches respect the instruction limit and fees scale per transaction', () => {
  const assets = Array.from({ length: 12 }, (_, i) => tok(i));
  const plan = buildPlan({ wallet: W, assets, operation: OPERATIONS.CLOSE_EMPTY, priorityFeeLamports: 1000n });
  assert.equal(plan.batches.length, 2);
  assert.equal(plan.estimate.networkFeeLamports, 2n * (SIGNATURE_FEE_LAMPORTS + 1000n));
  const bc = buildPlan({ wallet: W, assets: assets.map((a) => ({ ...a, amount: '1' })), operation: OPERATIONS.BURN_AND_CLOSE });
  assert.ok(bc.batches.every((b) => b.length <= 5));
});

test('destructive plans demand the typed phrase before wallet approval', () => {
  const plan = buildPlan({ wallet: W, assets: [tok(1, { amount: '3' })], operation: OPERATIONS.BURN });
  assert.equal(plan.irreversible, true);
  assert.deepEqual(validateConfirmations(plan, { review: true, irreversible: true, 'type-burn': 'burn', wallet: true }).missing, ['type-burn']);
  assert.equal(validateConfirmations(plan, { review: true, irreversible: true, 'type-burn': 'BURN', wallet: true }).ok, true);
  assert.equal(validateConfirmations(plan, {}).ok, false);
});

test('malformed input is rejected safely', () => {
  assert.equal(classifyAsset(null, W).eligible, false);
  assert.equal(classifyAsset(tok(1, { amount: 'abc' }), W).kind, 'invalid');
  assert.throws(() => buildPlan({ wallet: W, assets: [], operation: 'nuke' }), RangeError);
  assert.throws(() => buildPlan({ wallet: '', assets: [], operation: OPERATIONS.BURN }), TypeError);
});

test('SOL formatting uses exact integer math', () => {
  assert.equal(formatSol(2_039_280n), '0.00203928 SOL');
  assert.equal(formatSol(1_000_000_000n), '1 SOL');
  assert.equal(formatSol(-5_000n), '-0.000005 SOL');
});
