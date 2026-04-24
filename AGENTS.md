# AGENTS.md

## Scope and entrypoints
- Main shipped app is the Vite React+TS SPA in `src/` (`src/main.tsx` -> `src/App.tsx`).
- Runtime content is loaded from `public/book-data/` and `public/navigation-data/`; keep these paths stable.
- `apps/notes-app/` and `apps/simple-tts/` are side tools and are not part of root build/deploy scripts.
- Backend/API logic is only the Netlify function at `netlify/functions/patreon-oauth/patreon-oauth.js`.

## Commands (root)
- `npm run dev` - Vite dev server.
- `npm run dev:browser` - Vite dev server with browser auto-open.
- `npm run build` - `tsc -b && vite build` (typecheck + production bundle).
- `npm run lint` - ESLint run.
- `npm run deploy` - publishes `dist/` with `gh-pages` (runs `predeploy` -> `npm run build`).
- There is no root test script.

## Tooling quirks that matter
- ESLint source of truth is `eslint.config.js` (flat config, TS files only); `.eslintrc.json` is legacy.
- Routing uses `HashRouter` for GitHub Pages compatibility (`/library/#/...`), so avoid history-mode assumptions.
- Reader routes carry selection in URL (`/library/#/reader/:bookId/:chapter?`); keep route params and chapter state in sync.
- Chapter metadata JSON is required by runtime reader logic (no fallback to parsing navigation HTML).
- Vite base path is `/library/` (`vite.config.ts`); OAuth redirect uses the same URL in both frontend and Netlify function. If URL/base changes, update both:
  - `src/context/PatreonProvider.tsx`
  - `netlify/functions/patreon-oauth/patreon-oauth.js`

## Content pipeline (read before running)
- `pipeline.ps1` is a publishing script, not a normal dev script.
- `--book` args are optional and repeatable. Each selected book runs both `HandleBook` and `ItemPlaceholder`.
- No `--book` args means no content regeneration. This is intentional for no-book-change runs.
- `--commit` is required to run any git push / Netlify / deploy steps; without it the script only regenerates selected content.
- For each selected book, pipeline runs this modular flow:
  1. `deployment/create_htmls.py`
  2. `deployment/generate_metadata.py`
  3. `deployment/update_navigation.py`
  4. `deployment/update_wordcount.py`
  5. `deployment/encryptExport.py`
  6. Copy outputs to `public/`
- Use it only when intentionally publishing book content.

## Book data flow
- Source markdown lives in `book-data/<BookId>_export.md`.
- `deployment/create_htmls.py` generates chapter HTML and an intermediate manifest.
- `deployment/generate_metadata.py` generates `book-data/<BookId>_chapters.json` with ordered chapter entries (`chapter`, `title`, `isSecured`, optional `volume`).
- `deployment/update_navigation.py` generates `book-data/<BookId>_navigation.html` from chapter metadata.
- `deployment/update_wordcount.py` updates `src/basicBookData.json` word counts/dates.
- `deployment/encryptExport.py` reads `book-data/encrypted_files.md`, encrypts selected files, and uses secrets in `deployment/secret.txt`, `deployment/WtDR_secret.txt`, `deployment/SoWB_secret.txt`.
- Shared encryption rule parsing for modular scripts lives in `deployment/encryption_rules.py`.
- Legacy `deployment/modifyExport.py` is intentionally kept untouched for parity checks and is not called by current pipeline.
- Frontend reader logic consumes `public/navigation-data/<BookId>_chapters.json`; ensure this file exists for every supported book ID.
- Generated outputs copied to `public/` are overwritten by pipeline runs; avoid manual edits there unless you also update the generation flow.

## Netlify and secrets
- Netlify function currently reads `NETLIFY_SECRET_PASSWORD`, `WTDR_SECRET_PASSWORD`, and `SOWB_SECRET_PASSWORD`.
- `deployment/deploy-netlify.ps1` force-pushes `origin/netlify`; treat it as a deliberate release action.
- Secret files are gitignored (`secret.txt`, `*_secret.txt`).

## Adding/changing book IDs
- Book IDs are centralized in `src/constants.tsx` (`SourceType`, `SourceTypes`).
- New IDs must stay consistent across at least:
  - `src/basicBookData.json`
  - `src/components/homepage.tsx` (dashboard tile wiring)
  - `src/context/PatreonProvider.tsx` (`encryptionPasswordV2` defaults)
  - `deployment/encryptExport.py` (`book_id_to_secret_path`)
  - `public/navigation-data/<BookId>_chapters.json` generation via pipeline
- `docs/adding-a-new-book.md` is useful, but verify against current code before following it verbatim.
