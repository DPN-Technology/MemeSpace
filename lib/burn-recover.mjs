// Burn & Recover planning engine (issue #28). Pure and non-custodial: it never signs,
// holds keys, or touches the network. It classifies assets and builds the plan the
// wallet must confirm; the user's wallet signs every transaction.

export const OPERATIONS = Object.freeze({
  BURN: 'burn',
  CLOSE_EMPTY: 'close-empty',
  BURN_AND_CLOSE: 'burn-and-close',
});

export const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280n;
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const SIGNATURE_FEE_LAMPORTS = 5_000n;
export const MAX_INSTRUCTIONS_PER_TX = 10;

const PROTECTED_REASONS = Object.freeze({
  nft: 'NFTs and collectibles are protected from bulk burns.',
  valuable: 'This asset has a meaningful market value and needs a deliberate single-asset burn.',
  frozen: 'The token account is frozen and cannot be closed.',
  notOwner: 'The connected wallet does not own this token account.',
  delegated: 'A delegate is attached; revoke it before closing.',
});

export function classifyAsset(asset, wallet, { valueThresholdUsd = 5 } = {}) {
  const reasons = [];
  if (!asset || typeof asset.account !== 'string' || typeof asset.mint !== 'string') {
    return { eligible: false, kind: 'invalid', reasons: ['Malformed asset record.'] };
  }
  let amount;
  try {
    amount = BigInt(asset.amount ?? 0);
  } catch {
    return { eligible: false, kind: 'invalid', reasons: ['Invalid token amount.'] };
  }
  if (amount < 0n) return { eligible: false, kind: 'invalid', reasons: ['Invalid token amount.'] };
  if (asset.owner !== wallet) reasons.push(PROTECTED_REASONS.notOwner);
  if (asset.frozen) reasons.push(PROTECTED_REASONS.frozen);
  if (asset.delegate) reasons.push(PROTECTED_REASONS.delegated);
  const isNft = asset.decimals === 0 && (asset.supply === '1' || asset.isNft === true);
  if (isNft) reasons.push(PROTECTED_REASONS.nft);
  if (Number(asset.valueUsd ?? 0) >= valueThresholdUsd) reasons.push(PROTECTED_REASONS.valuable);
  const kind = amount === 0n ? 'empty' : isNft ? 'nft' : asset.spamScore >= 0.7 ? 'likely-spam' : 'token';
  return { eligible: reasons.length === 0, kind, amount, reasons };
}

export function reclaimableLamports(asset) {
  return asset.rentLamports === undefined ? TOKEN_ACCOUNT_RENT_LAMPORTS : BigInt(asset.rentLamports);
}

export function buildPlan({ wallet, assets, operation, priorityFeeLamports = 0n, valueThresholdUsd = 5 }) {
  if (typeof wallet !== 'string' || !wallet) throw new TypeError('wallet is required');
  if (!Object.values(OPERATIONS).includes(operation)) throw new RangeError(`Unknown operation: ${operation}`);
  const items = [];
  const blocked = [];
  const seen = new Set();
  for (const asset of assets ?? []) {
    const verdict = classifyAsset(asset, wallet, { valueThresholdUsd });
    if (asset?.account && seen.has(asset.account)) {
      blocked.push({ asset, reasons: ['Duplicate account in selection.'] });
      continue;
    }
    if (asset?.account) seen.add(asset.account);
    if (!verdict.eligible) {
      blocked.push({ asset, reasons: verdict.reasons });
      continue;
    }
    if (operation === OPERATIONS.CLOSE_EMPTY && verdict.amount !== 0n) {
      blocked.push({ asset, reasons: ['Account still holds tokens; use burn-and-close.'] });
      continue;
    }
    if (operation === OPERATIONS.BURN && verdict.amount === 0n) {
      blocked.push({ asset, reasons: ['Nothing to burn; use close-empty to reclaim rent.'] });
      continue;
    }
    items.push({ asset, amount: verdict.amount, kind: verdict.kind, closes: operation !== OPERATIONS.BURN });
  }
  const instructionsPerItem = operation === OPERATIONS.BURN_AND_CLOSE ? 2 : 1;
  const perTx = Math.max(1, Math.floor(MAX_INSTRUCTIONS_PER_TX / instructionsPerItem));
  const batches = [];
  for (let i = 0; i < items.length; i += perTx) batches.push(items.slice(i, i + perTx));
  const fee = BigInt(batches.length) * (SIGNATURE_FEE_LAMPORTS + BigInt(priorityFeeLamports));
  const reclaim = items.filter((i) => i.closes).reduce((sum, i) => sum + reclaimableLamports(i.asset), 0n);
  return {
    wallet,
    operation,
    items,
    blocked,
    batches,
    estimate: { networkFeeLamports: fee, reclaimLamports: reclaim, netLamports: reclaim - fee },
    irreversible: operation !== OPERATIONS.CLOSE_EMPTY,
    confirmations: confirmationSequence(operation, items.length),
  };
}

export function confirmationSequence(operation, count) {
  const steps = [
    { id: 'review', text: `Review ${count} account${count === 1 ? '' : 's'} and the estimated fees.` },
  ];
  if (operation !== OPERATIONS.CLOSE_EMPTY) {
    steps.push({ id: 'irreversible', text: 'Burned tokens are destroyed permanently and cannot be recovered.' });
    steps.push({ id: 'type-burn', text: 'Type BURN to confirm.', phrase: 'BURN' });
  }
  steps.push({ id: 'wallet', text: 'Approve each transaction in your wallet. MemeSpace never holds your keys.' });
  return steps;
}

export function validateConfirmations(plan, answers) {
  const missing = [];
  for (const step of plan.confirmations) {
    const answer = answers?.[step.id];
    if (step.phrase ? answer !== step.phrase : answer !== true) missing.push(step.id);
  }
  return { ok: missing.length === 0, missing };
}

export function formatSol(lamports) {
  const negative = lamports < 0n;
  const abs = negative ? -lamports : lamports;
  const whole = abs / LAMPORTS_PER_SOL;
  const frac = (abs % LAMPORTS_PER_SOL).toString().padStart(9, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${frac ? `.${frac}` : ''} SOL`;
}
