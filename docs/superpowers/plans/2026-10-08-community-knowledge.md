# Community and knowledge implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline, then request one independent whole-branch review.

**Goal:** Make community chat and information workspaces useful for return visits.

**Architecture:** Extend the existing chat route with cursor pagination and context without changing storage. Use separate readable client components and a shared content catalog for reading, lessons and search.

**Tech Stack:** Next.js, React, TypeScript, native SQLite, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-community-knowledge.md`

## Global constraints

- No new dependencies or schema migration.
- Preserve local accounts, SQLite storage, existing saved items and moderation.
- Desktop and 390px mobile layouts must remain usable with keyboard and touch.
- Repository publication is part of completion; verify before merging.

## Review focus

- Same-timestamp messages must not disappear between pages (API regression).
- Hidden parents must not leak through previews or search (API regression).
- Editing and changing rooms must preserve independent drafts (browser regression).
- Bookmark removal and progress must survive reopening (browser regression).
- Searches and counts must include newly added content (browser regression).

## Task 1: Community conversation

Files: `app/api/chat/route.ts`, `app/chat-upgrade.tsx`, `app/community-content.css`, `tests/chat-history.test.mjs`.

Interface: GET chat accepts `channel`, `q`, `filter`, `before`, `thread`, `context`; returns messages, channels, nextCursor, thread, context, signedIn and readOnly. Messages include replyCount and visible parent context. Cursor orders by created_at plus id. Preserve existing mutation interfaces.

- [x] Write and run real API regressions for pagination, literal search, filters, moderation and reply context; observe failure on the old route.
- [x] Implement the API and chat component with independent normal/edit drafts and explicit history navigation.
- [x] Run API regressions and production browser draft/reply checks.

## Task 2: Reading and learning

Files: `app/content-expansion.ts`, `app/content-catalog.ts`, `app/information-upgrade.tsx`, `app/use-library.ts`, `app/community-content.css`, `app/page.tsx`, `app/expanded-modules.tsx`, `tests/community-ui.test.mjs`.

Interface: Export allStories, allCoinStories, allLearning from the catalog. useLibrary provides items, error, busy, save(kind,key,payload), remove(kind,key). Reuse /api/saved and LessonNotes; do not create a parallel persistence mechanism.

- [x] Write browser regressions for bookmark toggle, lesson completion and expanded search.
- [x] Implement sourced examples, article outlines, filters, related reading and lesson explanations; synchronize counts and search.
- [x] Verify desktop/mobile flows and inspect screenshots.

## Task 3: Delivery

- [x] Run lint, typecheck, repository tests, production build and new browser checks.
- [x] Request a fresh code review and resolve concrete findings.
- [ ] Commit, publish PR, inspect review/check results, and merge when clear.

### Verification record

- 56 repository tests and 8 production browser checks passed.
- Production build and standalone TypeScript check passed. ESLint reported zero errors and 66 warnings.
- Desktop and 390px mobile screenshots were inspected for chat, reading and learning.
- Independent review findings fixed: complete content search, visible nested replies, refreshed moderated context and consistent lesson order. Follow-up review found no merge-blocking issues.
- A build followed immediately by the browser suite confirmed the restarted server serves the current client bundle after generated route-cache cleanup.
- Publication and remote checks are tracked in the pull request.
