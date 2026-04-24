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
- Vite base path is `/library/` (`vite.config.ts`); OAuth redirect uses the same URL in both frontend and Netlify function. If URL/base changes, update both:
  - `src/context/PatreonProvider.tsx`
  - `netlify/functions/patreon-oauth/patreon-oauth.js`

## Content pipeline (read before running)
- `pipeline.ps1` is a publishing script, not a normal dev script.
- It now requires explicit `--book` args (repeatable); each selected book runs both `HandleBook` and `ItemPlaceholder`.
- `--commit` is required to run any git push / Netlify / deploy steps; without it the script only regenerates content.
- It deletes and regenerates book artifacts, then runs git/deploy steps automatically (`git add .`, commit, push, possible Netlify update, then `npm run deploy`).
- Use it only when intentionally publishing book content.

## Book data flow
- Source markdown lives in `book-data/<BookId>_export.md`.
- `deployment/modifyExport.py` generates chapter HTML + navigation and updates `src/basicBookData.json` word counts/dates.
- `deployment/encryptExport.py` reads `book-data/encrypted_files.md`, encrypts selected files, and uses secrets in `deployment/secret.txt`, `deployment/WtDR_secret.txt`, `deployment/SoWB_secret.txt`.
- Generated outputs copied to `public/` are overwritten by pipeline runs; avoid manual edits there unless you also update the generation flow.

## Netlify and secrets
- Netlify function currently reads only `NETLIFY_SECRET_PASSWORD` and `WTDR_SECRET_PASSWORD`.
- `deployment/deploy-netlify.ps1` force-pushes `origin/netlify`; treat it as a deliberate release action.
- Secret files are gitignored (`secret.txt`, `*_secret.txt`).

## Adding/changing book IDs
- Book IDs are centralized in `src/constants.tsx` (`SourceType`, `SourceTypes`).
- New IDs must stay consistent across at least:
  - `src/basicBookData.json`
  - `src/components/homepage.tsx` (dashboard tile wiring)
  - `src/context/PatreonProvider.tsx` (`encryptionPasswordV2` defaults)
  - `deployment/encryptExport.py` (`book_id_to_secret_path`)
- `docs/adding-a-new-book.md` is useful, but verify against current code before following it verbatim.
