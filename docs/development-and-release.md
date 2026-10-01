# Development, verification, and release

For a change-by-change release decision map and copy/paste recipes, start with [Publishing: choose the safe path](../PUBLISHING.md).

This guide is for safely checking library, reader, gallery, settings, supporter-access, and comments changes before an intentional release. Local checks do not publish the site or provide proof that the separately hosted production services are configured correctly.

## Repository and release boundaries

- The shipped frontend is the Vite React/TypeScript SPA under `src/`; runtime book and gallery data is supplied under `public/`.
- `npm run build` runs `tsc -b && vite build`. `npm run lint` runs ESLint.
- There are no checked-in `.github` workflows and no root quality-test/CI script. Do not treat a successful push or a GitHub Pages hosting configuration as evidence that build, lint, or behavior checks ran. The repository alone also does not establish what build checks may be configured in an external hosting account.
- `npm run deploy` invokes `gh-pages -d dist`; its `predeploy` hook runs `npm run build`. It publishes the static app to the `gh-pages` branch, separately from the source branch. This is a release action, not a pretest.
- `pipeline.ps1` is a content regeneration and publishing tool, not a safe frontend pretest. Even without `--book` it processes gallery assets/manifest, updates general cache versions and `src/cacheVersions.json`, and may run strict gallery review. With `--book`, it also regenerates selected book outputs and book cache versions. Its `--commit` mode does `git add .`, may commit all staged and worktree changes, pushes the current branch, may force-update the orphan `origin/netlify` branch through `deployment/deploy-netlify.ps1`, and then runs the GitHub Pages deploy. A missing remote `netlify` branch makes the pipeline stop before the Pages deploy. Do not use `--commit` as routine verification.
- `netlify.toml` names the functions directory but has a placeholder `echo` build command; it does not build or start a local full stack. The existence of Netlify function source does not prove the hosted function deployment, environment variables, or endpoint configuration.
- `deployment/deploy-netlify.ps1` is also unsafe as a standalone pretest: it stages Netlify paths and commits (including any other already-staged work), deletes/recreates the local `netlify` branch in a temporary worktree, and force-pushes `origin/netlify`. It does not run the quality checks. Source `git push`, frontend Pages publishing, and backend branch publishing are distinct operations; none establishes that all regression tests passed.

## Safe frontend pretest

From the repository root, install dependencies and run the code checks:

```powershell
npm ci
npm run build
npm run lint
```

These are local checks. `npm ci` replaces the local `node_modules` tree based on the lockfile; it does not stage or commit files. Review `git status` before and after any verification, and do not run the publishing pipeline or deployment commands just to validate changes.

There is no root unit-test script. The existing OAuth regression suite and browser configuration check can be run directly:

```powershell
node --test netlify/functions/patreon-oauth/patreon-oauth.test.cjs
node --test scripts/playwright-cli-config.test.cjs
```

The OAuth test uses mocked Patreon responses; it does not call Patreon or prove the live OAuth configuration.

### Behavior checks in Storybook

Interaction tests are meaningful `play` flows in `src/**/*.stories.tsx`. The runner script builds Storybook, serves `storybook-static` on port 6007 by default, runs the interaction suite, and cleans up its server:

```powershell
npm run test-storybook
```

`-ExtraArgs` forwards runner options, but it is not itself a working test-title selector. The installed runner rejects direct `--testNamePattern`/`--testPathPattern` options; Jest options require a `--` passthrough delimiter, and PowerShell/native argument quoting can split titles containing spaces. Scoped commands attempted during this audit did not execute the intended test, so no working exact-title command is claimed here. Use the verified full suite for the pre-release check until a scoped invocation is independently verified. `npx test-storybook --help` lists supported runner options, including tag filters; those require corresponding story tags.

The `App/Whole App` flows exercise navigation, reading, and gating; the `App/Notifications` and `Comments/Thread` flows use in-memory mocks. `FullAppHarness` substitutes a mock Patreon provider, and comments stories substitute a mock comments API. These flows check frontend behavior only, not real Patreon, Netlify, or Upstash integration. To explore these interactions manually, run `npm run storybook` and open `http://localhost:6006/`.

Storybook serves `public/` and also exposes root `book-data/` under `/storybook-book-data`. Do not publish `storybook-static` as a public site without reviewing that copied content for exposure, including raw source data.

## Run the shipped frontend locally

Start Vite from the root:

```powershell
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/library/#/`. Vite's base path is `/library/`, and routing uses `HashRouter`; reader routes have the form `/library/#/reader/:bookId/:chapter?`. `npm run dev:browser` instead listens on port 5173 and opens the app. For a production-bundle smoke check, run `npm run build`, then `npm run preview -- --host 127.0.0.1` and open `http://127.0.0.1:4173/library/#/`.

The local app uses checked-in runtime content and can exercise frontend loading, routes, library/reader/gallery/settings UI, and local browser state. In Vite development on `localhost` or `127.0.0.1`, clicking login attempts to load the gitignored `admin.secret` token instead of starting OAuth. Its availability and validity were not inspected; this shortcut bypasses live eligibility verification and is not an isolated comments identity. Do not create, copy, log, or publish credentials for ordinary pretesting. A production bundle served with `npm run preview` does not enable that development shortcut: login starts real Patreon OAuth with the production GitHub Pages redirect, not a localhost callback. Code exchanges still target the hosted OAuth function.

The comments client has a hardcoded hosted Netlify function URL in both dev and preview. Comments mutations can change real Upstash-backed data; opening the notification inbox can also POST a mark-checked update, so browsing that UI is not necessarily read-only. Do not attempt comment/reaction/notification actions expecting an isolated test service. There is no configured local OAuth callback, comments endpoint override/proxy, Netlify dev command, isolated Redis database, or disposable test identity in this repository. Running the local function with production Upstash credentials would not isolate its data. Use Storybook mocks for safe frontend interaction checks. A true isolated full-stack test needs explicitly configured test-only auth and comments endpoints, redirect/callback settings, data store, and cleanup before it can be safely documented or run.

### Validation evidence (2026-10-01)

- `npm run build` and `npm run lint`: passed.
- OAuth Node suite: 11 tests passed; browser configuration Node suite: 1 test passed.
- Full Storybook interaction suite: 3 suites, 16 tests passed, including all seven whole-app reading/navigation/access-gate stories.
- Build advisories: outdated Browserslist data and chunks above 500 kB; Storybook also suggests migrating to its Vitest addon. These were warnings, not failures.
- No ordinary dev/preview browser smoke or real Patreon/Netlify/Upstash integration was performed. The passed interaction suite uses local Storybook with mocked service boundaries.

## Intentional release

Only publish after reviewing all source and generated-content changes, staged changes, branch/remotes, secrets/configuration, and the intended release target. `npm run deploy` publishes only the built frontend to `gh-pages`; the comments and OAuth functions are a separate Netlify deployment concern. `pipeline.ps1 --commit` can publish both kinds of output and affects more than its selected books, so use it only when that combined content/release workflow is deliberately intended. Netlify deployment setup and production environment variables must be verified in their hosting account; this checkout cannot confirm deployed settings or production service health.

For book-specific inputs and generated metadata, see [Adding a New Book](adding-a-new-book.md). For supporter eligibility and OAuth behavior, see [Patreon authentication](patreon-authentication.md).
