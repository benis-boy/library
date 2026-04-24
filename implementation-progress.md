# Implementation Progress

## 2026-04-24

- Created modular deployment scripts while keeping `deployment/modifyExport.py` untouched:
  - `deployment/create_htmls.py`
  - `deployment/generate_metadata.py`
  - `deployment/update_navigation.py`
  - `deployment/update_wordcount.py`
- Updated `pipeline.ps1` to orchestrate the new script sequence and copy chapter metadata output to:
  - `public/navigation-data/<BookId>_chapters.json`
- Added metadata-first chapter helpers in `src/context/LibraryContext.tsx`:
  - chapter path normalization,
  - metadata loading with cache,
  - first/next/security lookup helpers.
- Removed legacy runtime fallback to `*_navigation.html` parsing; chapter metadata JSON is now required at runtime.
- Updated `src/context/LibraryProvider.tsx` to use metadata-based security lookup and first-chapter loading.
- Removed custom chapter window-event workflow from UI flow (`loadFirstChapter`, `loadNextChapter`, `loadedNewChapter`).
- Updated `src/components/data-viewer.tsx`:
  - next chapter now uses metadata helper directly,
  - scroll-to-top now reacts to route chapter changes.
- Simplified `src/components/navigator.tsx` by removing custom event listeners and keeping iframe `postMessage` handling.
- Updated dashboard tile start actions to route directly to the selected chapter URL after `setSelectedBook(...)` resolves:
  - `src/components/dashboardTiles/PSSJBookDashboardTile.tsx`
  - `src/components/dashboardTiles/SoWBBookDashboardTile.tsx`
- Added Python cache ignore entry in `.gitignore`:
  - `__pycache__/`

## Verification Performed

- Python syntax check passed for new scripts:
  - `python -m py_compile deployment/create_htmls.py deployment/generate_metadata.py deployment/update_navigation.py deployment/update_wordcount.py`
- Pipeline smoke test passed for modular flow:
  - `.\pipeline.ps1 --book SoWB`
  - Generated `public/navigation-data/SoWB_chapters.json` successfully.
- Frontend build passed:
  - `npm run build`
- Targeted lint passed on modified frontend files:
  - `npx eslint src/context/LibraryContext.tsx src/context/LibraryProvider.tsx src/components/data-viewer.tsx src/components/navigator.tsx src/components/dashboardTiles/PSSJBookDashboardTile.tsx src/components/dashboardTiles/SoWBBookDashboardTile.tsx`
- Full repo lint still has pre-existing unrelated errors in `apps/notes-app/app.ts` (not introduced by this change).
- Re-verified after fallback removal:
  - `npx eslint src/context/LibraryContext.tsx src/context/LibraryProvider.tsx src/components/data-viewer.tsx src/components/navigator.tsx`
  - `npm run build`

## Pending Verification

- Run modular pipeline for all active books so required metadata files exist:
  - `./pipeline.ps1 --book PSSJ --book WtDR --book SoWB`
- Compare modular output vs legacy `modifyExport.py` output (`*_navigation.html`, chapter order, security flags, wordcount behavior).
- Decide whether to add an optional legacy fallback flag in `pipeline.ps1` (e.g. `--use-legacy-modify-export`) during transition.
