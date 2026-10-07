# MemeSpace Arcade Challenges and Milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic daily challenges and long-term milestones across pinball, pool, and slots, saved locally per current identity.

**Architecture:** A pure challenge module owns UTC rotation, challenge definitions, progress reduction, and save migration. Cabinet components send typed completed-game events to the reducer; lobby and cabinet views display the resulting progress. No game engine depends on React or localStorage.

**Tech Stack:** TypeScript, Next.js/React, Canvas 2D, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-10-07-memespace-arcade-v2-6-design.md`

## Global Constraints

- Keep progress in a versioned browser-local save scoped to the current identity.
- Daily challenge selection is deterministic for a given UTC date.
- Invalid/unavailable browser storage does not prevent current-visit play and must display a persistence warning.
- Do not add account sync, server leaderboards, or competitive claims.
- Add no runtime dependency unless implementation evidence shows a necessary gap.

## Review Focus

- UTC date boundary and daylight-saving changes; daily key stays UTC and rotates once, tested in Task 1.
- Duplicate event delivery; progress increments once per event ID, tested in Task 1.
- Identity changes while a cabinet is open; progress is saved to the original scope and never leaks, tested in Task 2.
- Invalid or old localStorage JSON; recover to safe empty progress without crashing, tested in Task 1.
- Storage quota/access failure; current play continues with visible warning, tested in Task 2.

---

### Task 1: Implement challenge definitions, deterministic rotation, and migration

**Files:**
- Create: `app/arcade/challenges.ts`
- Test: `tests/arcade.test.mjs`

**Interfaces:**
- Export `ChallengeGame = 'pinball' | 'pool' | 'slots'`.
- Export `ArcadeEvent = { id: string; game: ChallengeGame; type: 'mission-complete' | 'rack-complete' | 'bonus-triggered'; value?: number; at: number }`.
- Export `ChallengeProgressV1`, `dailyChallenges(date: Date): ChallengeDefinition[]`, `lifetimeMilestones(progress): Milestone[]`, `applyArcadeEvent(progress, event): ChallengeProgressV1`, `readChallengeProgress(serialized): ChallengeProgressV1`, and `serializeChallengeProgress(progress): string`.
- Keep storage scope out of the pure module. `runtime.tsx` owns `localStorage` and uses key `memespace-arcade-challenges:<scope>`.
- Challenge definition includes `id`, `game`, `title`, `description`, `target`, and `eventType`. Daily objectives are: one pinball mission completion; one pool rack completion in either practice layout; one slot bonus trigger. Lifetime milestones are pinball missions at 1/10/50, pool racks at 5/25, and slot bonus triggers at 1/10/25.

- [ ] **Step 1: Write failing tests** named `dailyChallenges are stable within and change across UTC days`, `applyArcadeEvent increments matching progress once per event ID`, `readChallengeProgress migrates existing empty and valid saves`, and `invalid progress recovers to empty progress`.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm missing module/function failures.
- [ ] **Step 3: Implement** pure deterministic challenge definitions with one daily objective for each featured game. Use UTC date keys, reject events for a mismatched game/type, de-duplicate the latest 500 event IDs, and keep 30 days of daily progress plus lifetime totals. Test `dailyChallenges` at 2026-10-07T23:59:59Z and 2026-10-08T00:00:00Z.
- [ ] **Step 4: Run** `pnpm test:arcade`; confirm rotation, progress, migration, and deduplication pass.
- [ ] **Step 5: Commit** `feat: add deterministic arcade challenges`.

### Task 2: Connect cabinet events and identity-scoped persistence

**Files:**
- Modify: `app/arcade/pinball-game.tsx`
- Modify: `app/arcade/pool-game.tsx`
- Modify: `app/arcade/slots-game.tsx`
- Modify: `app/arcade/runtime.tsx`
- Test: `tests/arcade.test.mjs`

**Interfaces:**
- Consume the Task 1 `ArcadeEvent` and `applyArcadeEvent`.
- Emit event IDs from the completed gameplay event and persist under `memespace-arcade-challenges:<scope>`.

- [ ] **Step 1: Add failing adapter tests** for pinball mission completion, pool rack completion, and slot bonus trigger; assert each changes only its own daily challenge.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm cabinet events do not reach challenge progress.
- [ ] **Step 3: Implement** a small `recordArcadeEvent(scope, event)` helper in `runtime.tsx` that loads, applies, and persists progress. Generate event IDs once when outcomes settle, never during a render.
- [ ] **Step 4: Add** storage-failure handling that keeps in-memory progress for the active visit and surfaces the existing style of warning without blocking play.
- [ ] **Step 5: Run** `pnpm test:arcade`; verify duplicate slot settlement cannot duplicate challenge credit.
- [ ] **Step 6: Commit** `feat: persist arcade challenge progress`.

### Task 3: Display daily objectives and milestones

**Files:**
- Modify: `app/arcade/arcade-center.tsx`
- Modify: `app/arcade/pinball-game.tsx`
- Modify: `app/arcade/pool-game.tsx`
- Modify: `app/arcade/slots-game.tsx`
- Modify: `app/arcade/arcade.css`

- [ ] **Step 1: Run** `pnpm test:arcade`; confirm UTC rotation, reducer, migration, and event-adapter tests pass before UI work.
- [ ] **Step 2: Open** the lobby and each cabinet in a running browser and verify one daily objective per cabinet, progress count, completed state, and lifetime milestone history.
- [ ] **Step 3: Implement** lobby cards for today's three challenges and compact cabinet HUD progress. Show UTC reset date in local display time; show an explicit empty-progress state and never imply online competition.
- [ ] **Step 4: Verify** `pnpm lint`, `pnpm typecheck`, identity switch behavior, and desktop/mobile render sizes.
- [ ] **Step 5: Commit** `feat: show arcade challenges and milestones`.

### Task 4: Full regression gate

- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm security:gate`; require zero failures before merge.
