# Quantum Reels Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Quantum Reels into a transparent five-reel free-play cabinet with additional symbol behavior and a triggered bonus round.

**Architecture:** Keep reel sampling, payline evaluation, and settlement pure in the slot engine. UI renders the five-reel state and bonus sequence; a saved settlement remains authoritative before any animation starts.

**Tech Stack:** TypeScript, Next.js/React, Canvas/CSS UI, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-10-07-memespace-arcade-v2-6-design.md`

## Global Constraints

- Use browser cryptographic randomness with rejection sampling for symbol draws.
- Credits are free, local, non-transferable, and have no cash value; there are no purchases, wallet connections, cash-out, or prizes.
- Settle each spin once before animation; leaving or reloading cannot award a spin twice.
- Recalculate and test the payout model after changing the reel layout.
- Display complete paytable, paylines, bonus trigger, free-credit cost, and theoretical return with session-return limitations.

## Review Focus

- Corrupt or old wallet save; migrate valid existing balance/history and reset only malformed data, tested in Task 3.
- Player reloads or leaves during reel animation; settled outcome is not repeated, tested in Task 3.
- Bonus starts while balance is below normal bet; free spins continue without debiting credits, tested in Task 2.
- Invalid bet, symbol, or grid shape; reject without changing wallet, tested in Task 1.
- Browser storage unavailable; allow play for current visit and show persistence warning, tested in Task 3.

---

### Task 1: Define five-reel outcomes and payline math

**Files:**
- Modify: `app/arcade/engines/slots.ts`
- Test: `tests/arcade.test.mjs`

**Interfaces:**
- Change `SlotGrid` to five reel columns of three `SymbolId` values.
- Extend `SpinResult` with `bonusTriggered: boolean`, `freeSpinsAwarded: number`, and `freeSpinIndex: number | null`.
- Preserve `freshWallet()`, `readWallet(value)`, and `spinSlots(wallet, bet, pick, id, at)` as pure engine contracts.

- [ ] **Step 1: Write failing tests** named `slot evaluator scores the 5x3 paylines`, `wild substitutes for regular symbols`, `three scatters trigger eight free spins`, and `free spin uses no credit debit and applies its 2x bonus multiplier`. Assert 10 fixed paylines, 5 reels × 3 rows, 8 free spins per 3+ scatter trigger, and a 2× free-spin award multiplier.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm evaluator rejects five columns and missing symbol behaviors.
- [ ] **Step 3: Implement** a five-reel, three-row grid; ten fixed paylines; a wild symbol substituting for all non-scatter symbols; scatter pays anywhere and triggers 8 free spins at 3+ symbols; free-spin wins use a 2× multiplier. Preserve independent cryptographic draws per cell.
- [ ] **Step 4: Add** a deterministic probability calculation over the documented symbol weights and all payline/bonus cases. Recalculate the theoretical return, expose it as `theoreticalReturn()`, and test against an exact documented value to a tolerance of 1e-9.
- [ ] **Step 5: Run** `pnpm test:arcade`; confirm legacy single-line and wallet tests are updated and all outcomes settle exactly once.
- [ ] **Step 6: Commit** `feat: expand slot rules and bonus rounds`.

### Task 2: Render the five-reel cabinet and bonus sequence

**Files:**
- Modify: `app/arcade/slots-game.tsx`
- Modify: `app/arcade/slot-symbol.tsx`
- Modify: `app/arcade/arcade.css`
- Test: `tests/arcade.test.mjs`

**Interfaces:**
- Consume the Task 1 `SlotGrid`, `SpinResult`, and `theoreticalReturn()`.
- Keep `SlotSymbol` rendering each symbol ID and keep keyboard Space-to-spin.

- [ ] **Step 1: Add failing UI contract checks** for all 5 reels, 10 paylines, bonus status, free-spin count, and return/paytable text.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm expected UI selectors/text are absent.
- [ ] **Step 3: Implement** the expanded reels, visible line patterns, distinct wild/scatter art, bonus-start and free-spin feedback, and responsive layout. Display the exact return from the tested engine function with wording that it is theoretical.
- [ ] **Step 4: Verify** `pnpm lint`, `pnpm typecheck`, and visual render at 360px and desktop widths, including reduced motion.
- [ ] **Step 5: Commit** `feat: render Quantum Reels bonus cabinet`.

### Task 3: Migrate and validate stored balances and history

**Files:**
- Modify: `app/arcade/engines/slots.ts`
- Modify: `app/arcade/slots-game.tsx`
- Test: `tests/arcade.test.mjs`

- [ ] **Step 1: Add failing migration tests** for v1 3×3 wallets, malformed history, duplicate spin IDs, and a reload during a settled bonus.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm legacy wallet is rejected or bonus state is lost.
- [ ] **Step 3: Implement** version 2 wallet migration, preserving credits and valid recent history while mapping old outcomes as legacy records; persist pending free spins and settlement IDs before animation. When storage throws, keep in-memory play active and show the existing storage warning.
- [ ] **Step 4: Run** `pnpm test:arcade`; verify a reload cannot replay a paid/free spin settlement.
- [ ] **Step 5: Commit** `fix: migrate Quantum Reels wallet state`.

### Task 4: Full regression gate

- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm security:gate`; require zero failures before merge.
