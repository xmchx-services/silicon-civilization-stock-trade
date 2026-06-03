# Signals Page Snapshot Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache the last successful signals page result and automatically fall back to it when a fresh signals load fails.

**Architecture:** Extract signals-page loading into a reusable server-side module that assembles rows, writes successful results into the existing SQLite-backed web cache, and reads that snapshot when live loading fails. Keep the page component thin so fallback behavior is testable without rendering the full server component.

**Tech Stack:** Next.js App Router, TypeScript, better-sqlite3 cache layer, Node test runner with `tsx`

---

### Task 1: Add signals snapshot persistence helpers

**Files:**
- Modify: `web/lib/cache.ts`
- Test: `web/test/cache.test.ts`

- [ ] Add a `SignalsPageSnapshot` type plus `saveSignalsPageSnapshot()` / `getSignalsPageSnapshot()` helpers in `web/lib/cache.ts`.
- [ ] Store snapshots under a fixed cache key in `web.db`, with `ttl_seconds = 0` so the latest successful page snapshot persists until replaced.
- [ ] Extend `web/test/cache.test.ts` with a round-trip test covering save/read behavior and timestamp preservation.
- [ ] Run: `cd web && npm test -- test/cache.test.ts`

### Task 2: Extract signals page loading into a reusable module

**Files:**
- Create: `web/lib/signals-page.ts`
- Test: `web/test/signals-page.test.ts`

- [ ] Define shared row/data types for the signals page in `web/lib/signals-page.ts`.
- [ ] Implement a `loadSignalsPageData()` function that:
  - loads the universe
  - fetches klines, spot, and best-effort fundamentals
  - scores usable symbols
  - saves a page snapshot on success
  - falls back to `getSignalsPageSnapshot()` on live-load failure
- [ ] Accept dependency injection overrides so tests can simulate success, scorer failure, and snapshot fallback without mocking module internals.
- [ ] Add tests for:
  - successful live load writes a snapshot
  - scorer/load failure returns the stored snapshot and fallback timestamp
  - failure with no stored snapshot rethrows
- [ ] Run: `cd web && npm test -- test/signals-page.test.ts`

### Task 3: Wire the page component to fallback metadata

**Files:**
- Modify: `web/app/signals/page.tsx`
- Test: `web/test/signals-page.test.ts`

- [ ] Replace the inline `loadSignals()` implementation with the extracted loader from `web/lib/signals-page.ts`.
- [ ] Keep the existing table rendering, but add a compact warning/info card when fallback snapshot data is being shown.
- [ ] Include the snapshot generation timestamp in that banner.
- [ ] Preserve the existing hard-error card when both fresh load and snapshot fallback fail.
- [ ] Run: `cd web && npm test -- test/signals-page.test.ts`

### Task 4: Verify end-to-end consistency

**Files:**
- Modify: none unless verification finds issues

- [ ] Run targeted web tests:
  - `cd web && npm test -- test/cache.test.ts test/pyserver.test.ts test/fundamental-loader.test.ts test/signals-page.test.ts`
- [ ] Run type-check:
  - `cd web && ./node_modules/.bin/tsc --noEmit`
- [ ] Review the final diff for only signals snapshot fallback changes.
