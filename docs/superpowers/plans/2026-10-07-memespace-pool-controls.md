# After Hours Pool Controls and Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pool aiming and shooting reliable from the table itself, while adding practice layouts and more capable computer opponents.

**Architecture:** Extract pointer-drag shot math into a pure input module, then connect pointer, touch, and keyboard input to the existing pool engine. Keep rules/physics in the engine, table feedback in Canvas, and practice selection in the React cabinet.

**Tech Stack:** TypeScript, Next.js/React, Canvas 2D, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-10-07-memespace-arcade-v2-6-design.md`

## Global Constraints

- Keep solo clearance, two-player eight-ball, and computer play.
- Keep simplified arcade house rules and ball-in-hand behavior.
- The player can aim, choose power, and shoot through direct table input; keyboard and the on-screen Shoot control remain usable.
- Do not add runtime dependencies.

## Review Focus

- Pointer cancel, lost capture, or leaving the table; cancel drag without firing, tested in Task 2.
- Short or zero-length drag; no invalid or accidental zero-power shot, tested in Task 1.
- One pointer-up event fires once despite pointer-capture/compatibility clicks, tested in Task 2.
- Wrong turn or non-aim phase; no shot is fired, tested in Task 2.
- Cue placement overlaps a ball or pocket; reject it and retain ball-in-hand, tested in Task 3.

---

### Task 1: Specify and test pool drag-shot mapping

**Files:**
- Create: `app/arcade/engines/pool-input.ts`
- Test: `tests/arcade.test.mjs`

**Interfaces:**
- Export `type PoolPoint = { x: number; y: number }` and `type PoolDrag = { pointerId: number; cue: PoolPoint; start: PoolPoint; current: PoolPoint }`.
- Export `dragToShot(cue: PoolPoint, release: PoolPoint): { angle: number; power: number } | null`.
- Export `beginPoolDrag(pointerId: number, press: PoolPoint, cue: PoolPoint, phase: 'aim' | 'rolling' | 'placement' | 'over'): PoolDrag | null`, `movePoolDrag(gesture: PoolDrag, pointerId: number, point: PoolPoint): PoolDrag`, `finishPoolDrag(gesture: PoolDrag, pointerId: number): { angle: number; power: number } | null`, and `cancelPoolDrag(gesture: PoolDrag, pointerId: number): null`.
- Pull direction is opposite the cue-to-release vector; power is `clamp(distance / 180, 0.05, 1)`. A pull shorter than 12 table units returns `null` and must not shoot. A press more than 32 table units from the cue returns `null`.

- [ ] **Step 1: Write failing tests** named `pool drag points opposite the pull direction`, `pool drag power clamps to the playable range`, and `pool zero-length drag stays finite`. Assert horizontal and diagonal direction, null at distances 0 and 11, and power values at distances 12, 90, and 240.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm import/function failures.
- [ ] **Step 3: Implement** `dragToShot` without DOM dependencies.
- [ ] **Step 4: Run** `pnpm test:arcade`; confirm all mapping tests pass.
- [ ] **Step 5: Commit** `feat: add pool drag shot mapping`.

### Task 2: Wire pointer, touch, keyboard, and fallback controls

**Files:**
- Modify: `app/arcade/pool-game.tsx`
- Modify: `app/arcade/engines/pool-input.ts`
- Modify: `app/arcade/arcade.css`
- Test: `tests/arcade.test.mjs`

**Interfaces:**
- Use `dragToShot` from Task 1 and existing `strike(state, angle, power, calledPocket)`.
- Add a single-shot pointer gesture state with pointer ID, cue start, drag end, and cancellation state using the exact Task 1 signatures; only `finishPoolDrag` for the matching pointer ID may produce a shot.

- [ ] **Step 1: Add failing tests** for the pure gesture state: pointer down starts only in aim phase and within 32 table units of the cue; movement updates preview; matching pointer up returns one shot; mismatched pointer ID, cancel, and lost capture return no shot; short pull returns no shot.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm tests fail because no gesture controller exists.
- [ ] **Step 3: Implement** pointer capture on the table. Only start a shot drag within 32 table units of the cue ball. Update aim line and draw-back power during movement; on matching pointer up, derive `angle` and `power`, call `strike` once, then clear gesture state so compatibility clicks cannot fire a second shot. Preserve the on-screen Shoot button and existing keyboard controls.
- [ ] **Step 4: Reproduce** the reported non-firing Shoot-button behavior in a running browser; trace button event → `shoot()` → `strike()` → phase transition. Verify both direct drag and fallback click produce exactly one shot. Exercise mouse and touch pointer types.
- [ ] **Step 5: Commit** `fix: make pool table input fire reliably`.

### Task 3: Add practice layouts and CPU profiles

**Files:**
- Modify: `app/arcade/engines/pool.ts`
- Modify: `app/arcade/pool-game.tsx`
- Modify: `app/arcade/renderers.ts`
- Modify: `app/arcade/arcade.css`
- Test: `tests/arcade.test.mjs`

**Interfaces:**
- Add `PoolLayoutId = 'standard' | 'line-drill' | 'bank-shot'`.
- Add `CpuDifficulty = 'easy' | 'standard' | 'hard'`.
- Extend `createPool(mode, layout = 'standard')` and `cpuShot(state, difficulty = 'standard')`; preserve existing default behavior for existing callers.

- [ ] **Step 1: Write failing tests** for layout initialization, legal target selection under all difficulty profiles, and a deterministic unobstructed shot under standard/hard profiles.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm new options are not supported.
- [ ] **Step 3: Implement** two practice layouts with fixed, documented ball positions. Easy chooses a valid lower-ranked legal option and has reduced aim precision; standard retains the best-scored legal option; hard ranks legal options by alignment and path clearance and uses controlled power. No profile may bypass house rules.
- [ ] **Step 4: Verify** `pnpm test:arcade` and manually exercise practice layout selection, mode switch, CPU turns, and cue placement in a running browser.
- [ ] **Step 5: Commit** `feat: add pool practice and cpu profiles`.

### Task 4: Full regression gate

- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm security:gate`; require zero failures before merge.
