# MemeSpace v2.6 Arcade Depth — Design

**Status:** Approved direction; awaiting review of this written design  
**Repository baseline:** MemeSpace v2.5 / `main`  
**Branch:** `codex/memespace-arcade-v2-6-design`

## Goal

Make the three featured arcade cabinets feel substantial and reliable enough for repeat play. v2.5 has working independent game engines and a good safety boundary around free play, but the pinball board and slot cabinet are mechanically simple, and pool separates table aiming from a Shoot button that the player reports does not work reliably.

Keep the MemeSpace arcade identity, the existing six-cabinet lobby, current member identity boundaries, and local free-play model. The work should improve game decisions and moment-to-moment control, not just add visual effects.

## Player experience

### Reactor Pinball

Replace the sparse playfield with a multi-zone table built from readable, physics-backed features: orbit/ramp paths, lanes, drop-target banks, spinners, and kickers. Add shots that connect those features into short missions and score chains. A run should teach its current objective, show target state on the table and HUD, and reward deliberate shots with clearly explained scoring, bonus, and multiball progress.

Retain real-time flippers, the plunger, three-ball rounds, nudging/tilt, and the existing fixed-step simulation. New elements must participate in ball collision or trigger logic; decorative-only additions do not meet the goal. Table geometry, collision triggers, and mission rules should stay data-driven enough to test separately from canvas rendering.

### After Hours Pool

Keep solo clearance, local two-player eight-ball, and computer play. Add selectable practice/challenge layouts and clearer shot feedback. Improve the CPU with selectable difficulty profiles that vary shot selection and execution, while preserving legal targeting and house rules.

Make the table itself a complete mouse/touch control surface. The player should be able to press and drag from the cue ball to set direction and draw-back power, then release to shoot. The preview must show direction, power, and the likely first contact. Keep keyboard aim/power/shoot as a fully usable alternative; keep the on-screen Shoot control as an accessible fallback. Ball-in-hand placement must work by pointer/touch and by keyboard.

The current source confirms that pointer motion aims, a separate button or Space initiates a shot, and the pointer is captured on table press. This is a split interaction. It does not establish why the Shoot button fails in the user's runtime, so reproduce that behavior in a running browser and trace the button-to-strike state transition before changing that path.

### Quantum Reels

Expand the current three-column, three-row, five-line cabinet into a five-reel, three-row game with a clearly displayed set of paylines, additional symbol behaviors, and at least one triggered free-play bonus round. Keep outcomes independently sampled with browser cryptographic randomness and settle each spin once before animation. Display the complete paytable, trigger rules, and free-credit cost before the player spins.

Recalculate and test the payout model after changing the reel layout. Show its theoretical return as an engine calculation with appropriate limits; do not imply a guaranteed personal-session return. Credits remain free, local, non-transferable, and without cash value. No purchase, wallet connection, cash-out, or prizes.

## Shared replay layer

Add daily cabinet challenges and longer-term milestones across all three featured games. Define each challenge with an explicit objective, progress rule, completion state, and date/rotation rule. Keep the catalog deterministic for a given UTC date so all local sessions receive the same challenge for that day. Evaluate progress from game results/events, not presentation state.

Persist challenge and milestone progress in a versioned browser-local save scoped to the current identity. Migrate existing records and slot wallets without losing them. If browser storage is unavailable or invalid, the current visit remains playable and the UI explains that progress may not persist. Do not add accounts sync, server leaderboards, or competitive claims.

## Technical design

- Keep physics, scoring, rules, slot evaluation, and challenge evaluation in pure engine modules.
- Keep React responsible for controls, HUD, menus, and render scheduling; canvas rendering consumes engine state.
- Add explicit event/result data where the shared challenge layer needs to observe a completed shot, round, mission, or bonus. Avoid coupling game engines to React or localStorage.
- Preserve fixed-step simulation and pause behavior when the page is hidden or unfocused.
- Keep keyboard, pointer, touch, reduced-motion, and sound preference behavior accessible and documented.
- Add no runtime dependency unless implementation evidence shows a necessary gap.

## Verification and acceptance

1. Pinball tests cover every new trigger, mission transition, score award, collision boundary, and a complete multi-ball round; deterministic scenarios must prove intended shots can reach and activate each feature.
2. Pool tests cover pointer-drag aim/power mapping, release-to-shot exactly once, keyboard fallback, ball-in-hand placement, legal targeting, CPU profiles, and existing eight-ball rules. Reproduce the reported Shoot-button failure in a browser and verify both fallback and direct table controls.
3. Slot tests cover 5×3 evaluation, every payline/symbol feature, bonus-round trigger and settlement exactly once, storage reload, invalid saves, and independently sampled outcomes. An exhaustive or reproducible probability check must match the published theoretical return.
4. Challenge tests cover UTC rotation, deterministic selection, each objective's progress and completion, duplicate events, and save migration.
5. Run lint, typecheck, arcade tests, full tests, production build, and the repository security gate. Inspect actual rendered tables/reels at desktop and mobile sizes; exercise keyboard, mouse, and touch in a running browser.

## Out of scope

Online multiplayer, global rankings, server-authoritative scores, cash-value play, monetization, NFTs, cryptocurrency, unrelated admin redesign, and replacement of the existing DPN/MemeSpace visual identity.
