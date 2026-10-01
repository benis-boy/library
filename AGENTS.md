# AGENTS.md

## Product context and living summary
- The shipped site presents a book library, chapter reader, image gallery, and reader settings. Patreon authentication supplies supporter access; comments and reply/thread notifications are consumed through a separately hosted Netlify function implemented in this repository and persisted in Upstash Redis.
- Paid-reader eligibility is the authenticated Patreon user ID `101723637` (owner) OR an active Patreon membership OR finite numeric lifetime payments strictly above 500 cents to campaign `12346885` (USD campaign assumed). All configured decryption keys, including legacy v1, share this rule; `supportsMe` represents reader eligibility, not necessarily an active subscription. See `docs/patreon-authentication.md` for the contract and legacy-key retirement research.
- Book source markdown and encryption rules are the source of truth for generated chapters and navigation. `src/constants.tsx` defines book IDs; chapter metadata defines stable reader route tokens and actual chapter paths. The separately hosted comments function owns persisted comment data in Upstash Redis; frontend types and mocks are consumer contracts, not its implementation.
- Update this product summary in the same change when product direction, capability boundaries, or system-of-record decisions evolve. New inferred goal outcomes require human review and explicit approval through `/init-goals` before authoritative goal writes.

## Scope and entrypoints
- [Publishing: choose the safe path](PUBLISHING.md) is the root release decision map for choosing scoped checks, content generation, source pushes, GitHub Pages, Netlify, and separately approved data operations. Consult it before release commands; it does not authorize staging or publishing user changes.
- Main shipped app is the Vite React+TS SPA in `src/` (`src/main.tsx` -> `src/App.tsx`).
- Runtime content is loaded from `public/book-data/` and `public/navigation-data/`; keep these paths stable.
- `apps/notes-app/` and `apps/simple-tts/` are side tools and are not part of root build/deploy scripts.
- Backend/API implementations are Netlify functions at `netlify/functions/patreon-oauth/patreon-oauth.js` and `netlify/functions/comments/comments.js`. The frontend comments client uses a hardcoded hosted function URL; local function code does not by itself provide a local comments service or prove its deployed configuration.

## Commands (root)
- `npm run dev` - Vite dev server.
- `npm run dev:browser` - Vite dev server with browser auto-open.
- `npm run build` - `tsc -b && vite build` (typecheck + production bundle).
- `npm run lint` - ESLint run.
- `npm run deploy` - publishes `dist/` with `gh-pages` (runs `predeploy` -> `npm run build`).
- `npm run test-storybook` - builds Storybook and runs interaction tests through `scripts/run-storybook-tests.ps1`. `-ExtraArgs` forwards runner options, but exact-title/path scoping has a known CLI/PowerShell quoting gap; see `docs/development-and-release.md` before selecting verification.
- There is no root unit-test or backend-test script. Focused Node tests can be run directly with `node --test` against the relevant `*.test.cjs` file.

## Storybook testing
- Use Storybook for interaction testing only.
- Do not add or maintain purely visual stories, visual regression checks, or component showcase stories without meaningful interaction coverage.
- Prefer real app flows or behavior-driven stories with `play` functions over isolated visual demos.

## Agent context guardrails
- Project agent configuration is `.opencode/opencode.json`; `design` is the primary agent, with bounded role-specific subagents in `.opencode/agents/`. Project skills belong in `.opencode/skills/`, with explicit role-based allowlists and wildcard skill denial.
- Goal workflow and proof contracts live in `.opencode/skills/goal-oriented-design/SKILL.md` and its `references/`. Seeds remain uninitialized until a fresh-session `/init-goals` proposal is corrected and explicitly approved by the human. Storybook mocks do not establish integrated production-service E2E proof.
- Ignore dependency/build outputs (`node_modules/`, `dist/`, `storybook-static/`) and browser artifacts (`.playwright-cli/`) in routine source discovery.
- Do not read `.png` files unless explicitly required for the task; image files can consume too much context and hurt task performance.
- Never stage changes on your own (`git add`, `git add -A`, `git add .`). Only stage files when the user explicitly requests it.
- On Windows OpenCode browser work, prefer the project `browser_cli` custom tool (captured, fixed 8-second CLI deadline) over Bash/PowerShell browser calls. Use a unique explicit named session you own and close only that session; never use global close/kill or implicit session reuse. Timeouts do not prove a browser daemon was cleaned up. Direct CLI examples in the skill are manual-reference only for OpenCode on Windows.

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
- `--book` args are optional and repeatable. Each selected book runs both `HandleBook` and `ItemPlaceholder`, then updates its cache version.
- No `--book` args means no book chapter/navigation regeneration, but the script still regenerates gallery assets/manifest, updates general cache versions, saves `src/cacheVersions.json`, and runs any required strict gallery review. This is not a read-only/no-op pretest.
- `--commit` runs publication steps, not just a guarded push: it uses `git add .` and may commit all staged/worktree changes, pushes the current branch, may force-update `origin/netlify` through `deployment/deploy-netlify.ps1`, then runs `npm run deploy` to publish `dist/` to `gh-pages`. Never use this as a routine local validation command; use it only as an intentional release after inspecting all changes and remotes.
- For each selected book, pipeline runs this modular flow:
  1. `deployment/create_htmls.py`
  2. `deployment/generate_metadata.py`
  3. `deployment/update_navigation.py`
  4. `deployment/update_wordcount.py`
  5. `deployment/encryptExport.py`
  6. Copy outputs to `public/`
- Use it only when intentionally regenerating/publishing content. For ordinary frontend validation, use the build, lint, Storybook, and local server steps in `docs/development-and-release.md`.

## Book data flow
- Source markdown lives in `book-data/<BookId>_export.md`.
- `deployment/create_htmls.py` generates chapter HTML and an intermediate manifest.
- `deployment/generate_metadata.py` generates `book-data/<BookId>_chapters.json` with ordered chapter entries (`chapterId`, `chapter`, `title`, `isSecured`, optional `volume`).
- In this repo, `encrypted` / `isSecured` means Patreon supporter-only paid content, not unavailable or unpublished content.
- `deployment/update_navigation.py` generates `book-data/<BookId>_navigation.html` from chapter metadata.
- `deployment/update_wordcount.py` updates `src/basicBookData.json` word counts/dates.
- `deployment/encryptExport.py` reads `deployment/encrypted_files.md`, encrypts selected files, and uses secrets in `deployment/secret.txt`, `deployment/WtDR_secret.txt`, `deployment/SoWB_secret.txt`.
- Shared encryption rule parsing for modular scripts lives in `deployment/encryption_rules.py`.
- Legacy `deployment/modifyExport.py` is intentionally kept untouched for parity checks and is not called by current pipeline.
- Frontend reader logic consumes `public/navigation-data/<BookId>_chapters.json`; each entry needs both the short stable `chapterId` route token and the real `chapter` file path.
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
  - `src/App.stories.tsx` (typed chapter manifest and story maps)
  - `netlify/functions/patreon-oauth/patreon-oauth.js` (key configuration, denial defaults, and returned v2 fields for secured books)
  - `deployment/encryptExport.py` (`book_id_to_secret_path`)
  - `public/navigation-data/<BookId>_chapters.json` generation via pipeline
- `docs/adding-a-new-book.md` is useful, but verify against current code before following it verbatim.
