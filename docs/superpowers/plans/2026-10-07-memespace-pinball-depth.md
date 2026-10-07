# Reactor Pinball Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Reactor Pinball into a deeper skill game with a multi-zone playfield, physics-backed features, and readable missions.

**Architecture:** Keep the fixed-step engine authoritative for collisions, feature triggers, scoring, and mission state. Keep table geometry in a focused layout module and render it from the existing canvas renderer; React presents objective and mission progress.

**Tech Stack:** TypeScript, Next.js/React, Canvas 2D, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-10-07-memespace-arcade-v2-6-design.md`

## Global Constraints

- Keep existing fixed-step simulation, flippers, plunger, three-ball rounds, nudging/tilt, and pause behavior.
- New table features must affect collision or trigger logic; decoration alone does not satisfy the goal.
- Keep physics, scoring, and mission rules in pure engine modules.
- Add no runtime dependency unless implementation evidence shows a necessary gap.

## Review Focus

- High-speed ball crosses a feature trigger between simulation frames; feature fires once, tested in Task 1.
- Ball rests on or jitters across a sensor; cooldown prevents duplicate awards, tested in Task 1.
- Tilted or paused ball contacts a feature; no score or mission progress, tested in Task 1.
- Multiball balls enter the same feature together; each ball obeys cooldown and scoring rules, tested in Task 1.
- Small viewport or reduced-motion preference; board remains legible without animation, verified in Task 3.

---

### Task 1: Add deterministic feature and mission rules

**Files:**
- Create: `app/arcade/engines/pinball-layout.ts`
- Modify: `app/arcade/engines/pinball.ts`
- Test: `tests/arcade.test.mjs`

**Interfaces:**
- Produce `PinballFeatureId`, `PINBALL_FEATURES`, and engine state fields `featureHits`, `dropTargets`, `spinnerCharge`, `missionStep`, `missionAt`, `missionsCompleted`.
- Preserve public functions `createPinball()`, `stepPinball(state, dt, input)`, and `launchPinball(state, power)`.

- [ ] **Step 1: Write failing tests** named `pinball routes activate features and award a mission once`, `pinball drop targets reset and award a bank clear`, and `pinball trigger cooldown and tilt suppress duplicate awards`. Assert a left-orbit → spinner → right-orbit sequence completes once, awards 1,000 points × current multiplier, and expires after 6 seconds without the next feature.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm the new tests fail because the state and feature triggers do not exist.
- [ ] **Step 3: Implement** swept segment-to-trigger detection in `pinball-layout.ts`; define orbit, spinner, lane, and three-target-bank trigger IDs. Add feature cooldowns and mission state in `pinball.ts`. Award 350 points × multiplier for an orbit, 25 per spinner hit and 250 when spinner charge reaches 8, and 500 × multiplier for clearing all three drop targets. A mission awards 1,000 × multiplier once.
- [ ] **Step 4: Run** `pnpm test:arcade`; confirm new and existing pinball tests pass, including finite trajectories and complete three-ball rounds.
- [ ] **Step 5: Commit** `feat: add pinball feature and mission rules`.

### Task 2: Build and render the multi-zone playfield

**Files:**
- Modify: `app/arcade/engines/pinball-layout.ts`
- Modify: `app/arcade/engines/pinball.ts`
- Modify: `app/arcade/renderers.ts`
- Test: `tests/arcade.test.mjs`

**Interfaces:**
- Consume the Task 1 layout and feature IDs.
- Preserve `drawPinball(context, state, lowMotion)`.

- [ ] **Step 1: Add failing geometry assertions** that every feature trigger lies inside the table, does not overlap the shooter lane, and can be reached by a deterministic shot path.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm geometry tests fail for missing layout entries.
- [ ] **Step 3: Add** two visible orbit/ramp paths, three upper lanes, spinner, drop-target bank, and kickers in the fixed 560×820 table coordinate space. Use the same data for collision/trigger handling and canvas drawing.
- [ ] **Step 4: Render** table images for the initial state, a target-bank hit, and active multiball. Verify lanes, ramps, mission lights, targets, flippers, shooter lane, and ball contrast are distinguishable at desktop and mobile scaling.
- [ ] **Step 5: Run** `pnpm test:arcade` and commit `feat: expand pinball playfield`.

### Task 3: Surface objectives, scoring, and control feedback

**Files:**
- Modify: `app/arcade/pinball-game.tsx`
- Modify: `app/arcade/arcade.css`
- Test: `tests/arcade.test.mjs`

- [ ] **Step 1: Add failing engine-to-HUD assertions** for current mission step, completed missions, target-bank state, and spinner progress.
- [ ] **Step 2: Run** `pnpm test:arcade`; confirm expected mission HUD fields are absent.
- [ ] **Step 3: Update** the pinball HUD to show the active 3-shot mission, feature lights, progress, score-award feedback, and the next available route. Keep keyboard and touch flipper/plunger controls unchanged.
- [ ] **Step 4: Verify** `pnpm lint`, `pnpm typecheck`, `pnpm test:arcade`, reduced-motion rendering, and readable layout at 360px and desktop widths.
- [ ] **Step 5: Commit** `feat: show pinball mission progress`.

### Task 4: Full regression gate

- [ ] Run `pnpm test && pnpm build && pnpm security:gate`; require zero failures before merge.
