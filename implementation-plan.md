# Chapter Metadata and Pipeline Modularization Plan

## Goal

Create a clean, testable content pipeline that:

1. Keeps `src/basicBookData.json` lightweight (book-level metadata only).
2. Generates a per-book machine-readable chapter index at `public/navigation-data/<BookId>_chapters.json`.
3. Uses that chapter index in the frontend as the source of truth for:
   - first chapter lookup,
   - next chapter lookup,
   - chapter security lookup (`isSecured`).
4. Splits `deployment/modifyExport.py` into focused scripts:
   - `deployment/create_htmls.py`
   - `deployment/update_navigation.py`
   - `deployment/generate_metadata.py`
   - `deployment/update_wordcount.py`
5. Leaves `deployment/modifyExport.py` untouched so we can run parity checks against legacy behavior.

---

## Non-Goals

- Do not remove or rewrite `deployment/modifyExport.py` in this phase.
- Do not store full chapter arrays in `src/basicBookData.json`.
- Do not change reader route contract (`#/reader/:bookId/:chapter?`).

---

## Target Output Contract

### 1) `src/basicBookData.json`

Remains lightweight and book-level only, e.g. title/asset/wordCount/lastUpdate/isReady.

### 2) `public/navigation-data/<BookId>_chapters.json`

Generated for each processed book. Contains ordered chapter entries.

Suggested shape:

```json
{
  "bookId": "PSSJ",
  "generatedAt": "2026-04-24T12:00:00Z",
  "chapters": [
    {
      "chapter": "PSSJ/V1 - My first pokemon/01_I choose you.html",
      "title": "01 I choose you?",
      "isSecured": false,
      "volume": "V1 - My first pokemon"
    }
  ]
}
```

Notes:

- `chapter` is a relative path used by reader loading logic.
- Prefer forward slashes in JSON for consistency; frontend normalizes `\\` to `/` if needed.
- `volume` is optional, but included when available.
- `chapters` order is canonical reading order.

---

## Script Responsibilities

## `deployment/create_htmls.py`

Purpose: create all chapter HTML artifacts from `<BookId>_export.md`.

Responsibilities:

- Trim and clean export markdown.
- Split by volume and chapter.
- Generate chapter `.txt` files and scene files (if currently needed).
- Generate chapter `.html` and `.webnovel.html` files.
- Return/emit chapter discovery data needed downstream (or write an intermediate manifest).

Inputs:

- `bookId`
- `book-data/<BookId>_export.md`
- optional output root (default `book-data/`)

Outputs:

- `book-data/<BookId>/.../*.html`
- `book-data/<BookId>/.../*.webnovel.html`
- optional intermediate manifest for chapter metadata generation

## `deployment/generate_metadata.py`

Purpose: generate `<BookId>_chapters.json` (machine-readable chapter index).

Responsibilities:

- Walk generated chapter HTML files in canonical order.
- Resolve display title exactly as shown in navigation.
- Determine `isSecured` using `book-data/encrypted_files.md` rules.
- Include optional `volume` from folder structure.
- Write `book-data/<BookId>_chapters.json` (staging location before copy).

Inputs:

- `bookId`
- `book-data/<BookId>` generated chapter tree
- `book-data/encrypted_files.md`

Outputs:

- `book-data/<BookId>_chapters.json`

## `deployment/update_navigation.py`

Purpose: generate legacy-compatible HTML nav using structured chapter data.

Responsibilities:

- Read ordered chapter metadata.
- Emit `book-data/<BookId>_navigation.html` with current behavior:
  - volume grouping,
  - `loadContent('<chapter>'[, true])` wiring,
  - `$` marker for secured chapters.

Inputs:

- `bookId`
- `book-data/<BookId>_chapters.json`

Outputs:

- `book-data/<BookId>_navigation.html`

## `deployment/update_wordcount.py`

Purpose: update `src/basicBookData.json` from generated chapter HTML.

Responsibilities:

- Compute total words from chapter `.html` files (excluding `.webnovel.html`).
- Apply existing formatting and last-update rules.
- Update only matching `bookId` entry.

Inputs:

- `bookId`
- generated HTML root (`book-data/<BookId>`)
- `src/basicBookData.json`

Outputs:

- updated `src/basicBookData.json`

---

## Shared Utility Layer (Recommended)

To avoid logic drift between scripts, add shared helpers under `deployment/lib/`:

- `encrypted_rules.py`
  - parse `encrypted_files.md`
  - `is_encrypted_file(path)`
- `chapter_discovery.py`
  - discover chapter HTML files in deterministic order
  - derive chapter title + volume
- `wordcount.py`
  - HTML-to-text and word count

This reduces duplication and helps parity with legacy behavior.

---

## Pipeline Changes (`pipeline.ps1`)

Update `HandleBook` to orchestrate new scripts in explicit order:

1. `python .\deployment\create_htmls.py ...`
2. `python .\deployment\generate_metadata.py ...`
3. `python .\deployment\update_navigation.py ...`
4. `python .\deployment\update_wordcount.py ...`
5. `python .\deployment\encryptExport.py ...`
6. copy artifacts to `public/`:
   - `book-data/<BookId>` -> `public/book-data/<BookId>`
   - `book-data/<BookId>_navigation.html` -> `public/navigation-data/<BookId>_navigation.html`
   - `book-data/<BookId>_chapters.json` -> `public/navigation-data/<BookId>_chapters.json`
7. post-copy cleanup (`*.webnovel.html` removal, `#` rename behavior if retained)

Keep existing `--book` and `--commit` semantics.

Optional safety flag for rollout:

- `--use-legacy-modify-export` to call `modifyExport.py` instead.

---

## Frontend Integration Plan

## A) Add metadata loader and cache

In `src/context/LibraryContext.tsx`:

- Add `loadBookChapters(bookId)` that fetches `navigation-data/<BookId>_chapters.json`.
- Add in-memory cache keyed by `bookId`.
- Add normalization for path separators.

## B) Add deterministic helpers

In `src/context/LibraryContext.tsx`:

- `getFirstChapter(bookId)` -> first entry.
- `getNextChapter(bookId, currentChapter)` -> next entry or `undefined`.
- `getChapterSecurity(bookId, chapter)` -> boolean.

## C) Update provider flow

In `src/context/LibraryProvider.tsx`:

- Replace HTML regex security resolution with metadata lookup.
- On `setSelectedBook(book, true)` with no stored chapter:
  - use `getFirstChapter(book)` and call `setSelectedChapter` directly.
- Remove custom window events:
  - `loadFirstChapter`
  - `loadedNewChapter`

## D) Update reader "Next Chapter"

In `src/components/data-viewer.tsx`:

- Replace `loadNextChapter` event dispatch with direct call:
  - read current route/book/chapter,
  - call `getNextChapter(...)`,
  - navigate to next route or `/reader/end`.

## E) Simplify navigator behavior

In `src/components/navigator.tsx`:

- Keep iframe `postMessage` handling for click capture.
- Remove event listeners for `loadNextChapter` and `loadFirstChapter`.
- Keep visual highlight behavior based on selected chapter.

## F) Scroll reset behavior

In `src/components/data-viewer.tsx`:

- Replace `loadedNewChapter` listener with route-driven effect:
  - on `[bookId, chapter]` change, scroll container to top.

---

## Parity Testing Strategy (Legacy vs New)

Because `modifyExport.py` remains untouched, run both pipelines and compare outputs for the same input book.

Compare:

1. Chapter file set under `book-data/<BookId>/` (`.html`, excluding `.webnovel.html` if desired).
2. Navigation output parity:
   - `book-data/<BookId>_navigation.html` (normalize whitespace before diff).
3. Word count update behavior in `src/basicBookData.json`.
4. Security behavior parity:
   - chapter-by-chapter `isSecured` in metadata versus legacy nav `loadContent(..., true)` behavior.
5. Frontend parity:
   - first chapter load,
   - next chapter transitions,
   - access redirects for secured chapters.

Acceptance rule:

- No user-visible regression in chapter order, chapter titles, security gates, or reader progression.

---

## Rollout Phases

## Phase 1: Pipeline split only (no frontend switch)

- Implement four new scripts.
- Keep frontend reading legacy navigation HTML behavior.
- Copy generated `<BookId>_chapters.json` to `public/navigation-data/`.

Deliverable:

- New scripts run and produce artifacts.

## Phase 2: Frontend read-path migration

- Add metadata loader/helpers.
- Migrate first/next/security logic to metadata.
- Remove custom chapter window events.

Deliverable:

- Reader flows powered by chapter JSON.

## Phase 3: Parity hardening and cleanup

- Execute parity comparisons against `modifyExport.py` outputs.
- Fix any formatting/order discrepancies.
- Keep legacy script available for fallback.

Deliverable:

- Stable, modular pipeline with validated parity.

---

## Definition of Done

- `deployment/modifyExport.py` is unchanged.
- Four new scripts exist and are wired in `pipeline.ps1`.
- `public/navigation-data/<BookId>_chapters.json` is generated per processed book.
- Frontend uses chapter JSON for first/next/security logic.
- Custom events `loadFirstChapter`, `loadNextChapter`, `loadedNewChapter` are removed from app flow.
- `npm run lint` and `npm run build` pass.
- Parity check results documented for at least one large book and one secured-book scenario.

---

## Risks and Mitigations

- Path separator mismatch (`\\` vs `/`): normalize at script output and frontend input.
- Drift in title formatting versus legacy nav: centralize title generation in shared helper.
- Security mismatch with encrypted rules: share one encryption-rule parser across scripts.
- Ordering regressions: enforce deterministic sort + explicit index tests.
- Incremental rollout risk: keep legacy script and optional fallback mode during transition.
