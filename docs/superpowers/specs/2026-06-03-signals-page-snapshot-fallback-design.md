# Signals Page Snapshot Fallback Design

## Goal

When the live signals page cannot complete a fresh load, show the most recent successful signals result instead of a hard error page, and clearly label that the page is showing a cached snapshot.

## Scope

This change applies only to the `web/app/signals/page.tsx` page-level rendering path.

Included:

- Persist the last successful full-page signals result.
- Read that stored result when a fresh signals load fails.
- Surface snapshot timestamp metadata in the UI.

Excluded:

- Export/download changes.
- Snapshot pipeline behavior changes.
- Backtest result caching changes.
- Automatic TTL-based invalidation of signals page snapshots.

## Recommended Approach

Store the signals page snapshot inside the existing `web/.cache/web.db` SQLite cache layer, not as a standalone JSON file.

Why:

- The repo already uses `web.db` for model-response caching and backtest persistence.
- Server-rendered code can reuse the same storage layer without introducing a second cache backend.
- A single-purpose read/write API keeps the page code simple.

## Data Model

Add a dedicated signals snapshot record in the existing cache database with:

- `generatedAt`: Unix timestamp or ISO string for the successful render time.
- `rows`: fully rendered signals page row data, including:
  - entry metadata
  - latest snapshot fields used by the table
  - resolved signal payload

The stored payload should match the render needs of the page so fallback does not need to recompute or partially rebuild state.

## Read/Write Flow

### Fresh success path

1. `loadSignals()` fetches current market inputs.
2. `scoreSymbols()` succeeds.
3. The assembled page rows are written to the signals snapshot cache.
4. The page renders live data with no fallback banner.

### Fallback path

1. `loadSignals()` or `scoreSymbols()` throws.
2. Page code looks up the most recent stored signals snapshot.
3. If found, render that snapshot instead of throwing the top-level page into the error card.
4. Show a clear banner with the snapshot timestamp.
5. If no snapshot exists, preserve the current hard-error behavior.

## UI Behavior

When rendering fallback data, show a compact warning/information card above the table:

- message: current page is showing the most recent successful snapshot
- timestamp: when that snapshot was generated

The main signals table remains unchanged.

## Error Handling

- Fresh load failure + snapshot available: render snapshot and warning banner.
- Fresh load failure + no snapshot available: render existing error card.
- Snapshot read failure: treat as no snapshot and render existing error card.
- Snapshot write failure after a successful load: do not fail the page render; log/ignore and continue showing live results.

## Testing

Add targeted coverage for:

- cache write/read helpers for signals page snapshots
- signals page fallback path uses stored snapshot when fresh load fails
- no snapshot still produces the current error state

## Tradeoffs

### Option A: SQLite snapshot storage (recommended)

Pros:

- Consistent with current cache architecture
- No extra file lifecycle concerns
- Easy server-side read/write semantics

Cons:

- Requires small extension to `web/lib/cache.ts`

### Option B: JSON file snapshot

Pros:

- Easy to inspect manually

Cons:

- Adds a second persistence pattern
- More brittle in concurrent local dev/server scenarios

## Open Decisions Resolved

- Fallback should happen automatically when fresh signals load fails.
- Snapshot age should be shown to the user.
- No TTL expiration policy is required initially; recency is communicated through the timestamp.
