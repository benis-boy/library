# Publishing: choose the safe path

Use this page as the release decision map. It helps choose whether a change needs a source-branch push, a GitHub Pages frontend publish, a Netlify function publish, content regeneration, or a separately planned data operation. These are different actions, not one automatic release.

The intended outcomes are reliable updates to the library, reader, gallery, settings, supporter authentication, and comments while preserving existing reader access and persisted data. A push is not proof of a successful hosted deployment. There is no checked-in CI workflow that guarantees release checks ran. **Stop rather than guess** when a recipe does not cover the change, a destructive step fails, or service configuration cannot be confirmed.

## 1. Choose a release path

| Change | Required release action | Before publishing |
| --- | --- | --- |
| Library, reader, gallery UI, settings UI, or a frontend comments/auth contract change | Source commit and push; then `npm run deploy` for GitHub Pages | Run frontend build and lint. For changed interactions, use verified scoped Storybook cases when available; otherwise run the verified full suite (see [Development and release](docs/development-and-release.md)). |
| Netlify function code, including Patreon OAuth or comments behavior | Source commit and push; separately publish Netlify function files using the Netlify recipe below | OAuth has a focused Node test file. No dedicated comments-function test suite was found; do not treat frontend mocks as function or live-service verification. Confirm the target Netlify account/deployment in its dashboard. |
| Redis client/business logic in a Netlify function | Publish the Netlify function; also publish the frontend if its API/types/contracts changed | Preserve existing persisted-data semantics. Function code does not deploy Redis data or prove the live Upstash configuration. |
| Redis persisted data, schema, key/index layout, or migration/cleanup | **No generic Git/publish command. Stop for a separately approved, backed-up, reviewed migration plan.** | Identify the exact production dataset and rollback/restore plan with its owner. Never run a guessed migration or cleanup against production. |
| Existing book chapter/source content | Regenerate only the selected book(s), review generated diffs, commit/push, then publish GitHub Pages | The pipeline also regenerates gallery assets/manifest and general cache versions, even with `--book`. |
| First publication of a new book | Coordinate frontend, metadata/content generator, and—if secured—backend key delivery/configuration; then regenerate and publish all affected targets | Follow the [new-book checklist](docs/adding-a-new-book.md). Verify chapter route tokens and real chapter file paths agree. |
| New gallery image(s) | Pipeline, human tag approval for every new image, source commit/push, then GitHub Pages publish | Back up original images elsewhere first: conversion deletes the originals in the source folder. **A human must tag each new image before publishing.** |
| Retagging/removing existing gallery images | Use the gallery admin for retagging; carefully coordinate manifest and asset changes for removal; then update cache versions, commit/push, and publish Pages | No established deletion command is documented. Do not assume removing a source file removes its manifest entry or generated assets. |
| Encryption rules, decryption keys, or key rotation | Coordinated content + backend + frontend/configuration review; publish each affected target intentionally | No generic safe key-rotation runner. Plan key availability, existing encrypted output, active reader sessions/cache, and rollback without weakening eligibility or exposing secrets. |
| Environment secrets, OAuth redirect/base URL, or hosting configuration | Manually coordinate the relevant code publish and a separately verified hosting-account configuration change | No repository command updates production environment variables. Keep redirect URLs aligned; never put secret values in source or docs. |
| Docs/tools/tests/dependencies only | Source commit and push, if desired; **no site/backend deployment by default** | Run checks appropriate to the changed files. A dependency change that affects shipped `src/` still needs frontend checks and Pages publishing. |
| Mixed changes | Combine the applicable rows, perform prerequisites first, then publish every affected target | For example, a new secured book can require generated content + Pages + Netlify keys/code + manual Netlify environment configuration. Do not infer that one deployment includes another. |

## 2. Safe common workflow

1. **Inspect before touching the index.** From the repository root, review all of:

   ```powershell
   git status --short
   git diff
   git diff --cached
   git branch --show-current
   git remote -v
   git log --oneline -10
   ```

   Confirm the current branch and remote are the intended ones. Review both staged and unstaged changes, generated outputs, ignored secret/config files, and the exact deployment target. Existing staged work belongs to its owner: do not silently include it in another release. If you cannot cleanly separate the index, stop and ask the owner before committing.

2. **Regenerate only when the selected recipe requires it.** Read the impact notes below first; generation commands can delete/overwrite files. Do not use `--commit` as a shortcut.

3. **Run only relevant checks** for the changed surface. A successful local check does not verify a hosted deployment or live Patreon/Netlify/Upstash configuration.

4. **Inspect the complete result again.** Review `git status --short`, `git diff`, and `git diff --cached`; verify generated metadata/assets and make sure no credentials or unrelated files are included. Stage explicit reviewed paths only, for example:

   ```powershell
   # Replace these examples with the exact paths for this change.
   git add -- src/components/ChangedComponent.tsx src/components/ChangedComponent.stories.tsx
   git diff --cached
   ```

   `git add` does not remove already-staged paths. A commit includes the entire index, so verify every staged path belongs in that commit before committing. Do not use `git add .` as the default.

5. **Commit and push the intended source branch** only after reviewing the index and making the commit intentionally. Use the repository's normal commit message convention; there is no universal release commit required here. Push the named branch explicitly when appropriate:

   ```powershell
   git push origin <branch-name>
   ```

   Replace `<branch-name>` with the branch you inspected. Source push, GitHub Pages publish, and Netlify function publish are separate steps. Check each actual hosting deployment after initiating it.

## 3. Recipes

### Frontend-only change

After the common inspection, run the frontend checks relevant to the change:

```powershell
npm run build
npm run lint
```

For interaction behavior changes, also run relevant Storybook `play` cases with an independently verified selector. Exact title/path scoping currently has CLI/PowerShell quoting limitations, so the supported pre-release fallback is the verified full interaction suite:

```powershell
npm run test-storybook
```

See [Development and release](docs/development-and-release.md) for the scoping gap and mock boundaries. Storybook mocks do not prove live service integration.

After an intentional source commit/push, publish the static frontend:

```powershell
npm run deploy
```

This runs the `predeploy` build and publishes `dist/` to `gh-pages`. It does **not** run lint or interaction tests, deploy Netlify functions, change environment variables, or migrate Redis data. Check the GitHub Pages deployment/site itself; a successful local command or source push alone is not end-to-end proof.

### Netlify function code (OAuth/comments)

For OAuth code changes, the focused existing test command is:

```powershell
node --test netlify/functions/patreon-oauth/patreon-oauth.test.cjs
```

Also check JavaScript syntax as appropriate (for example `node --check netlify/functions/patreon-oauth/patreon-oauth.js`). The OAuth tests mock Patreon and do not verify production credentials or the hosted function. There is no dedicated comments-function test suite documented here. If the frontend contract changed too, use the frontend checks and Pages recipe as well.

Netlify publishing uses a separate orphan `netlify` branch. Only after the related source changes are committed on the intended source branch, inspect the script and targets, ensure the index is clean (the script itself attempts to commit Netlify paths and that can include staged work), and explicitly accept that it force-updates `origin/netlify`:

```powershell
& ".\deployment\deploy-netlify.ps1"
```

This is a destructive release action, **not** a pretest or routine safe command. The script has no reliable fail-fast checks for each Git operation; inspect its output and exit status, and stop on any unexpected result. It recreates a local orphan branch/worktree and force-pushes the remote `netlify` branch. Verify the remote/account and resulting Netlify deployment in the hosting dashboard, including environment variables and function health. Do not infer deployment success from a push. This command does not publish the frontend or migrate Redis data.

### Existing chapter/content update

Run only for books whose source markdown changed. `--book` is repeatable; each selected book regenerates chapter artifacts/metadata/navigation/word counts/encrypted outputs and updates that book's cache version. The pipeline also regenerates gallery assets/manifest and the general gallery cache version on every run.

```powershell
.\pipeline.ps1 --book WtDR
# Or select more than one book explicitly:
.\pipeline.ps1 --book WtDR --book PSSJ
```

Run **without** `--commit`, then inspect all generated changes. Check that chapter metadata contains stable `chapterId` route tokens **and** actual `chapter` file paths; generated public chapter/navigation data is runtime-required. Run appropriate frontend checks, commit/push reviewed source and generated outputs, and publish GitHub Pages. Deploy Netlify only if backend/function/configuration files also changed. Do not regenerate unrelated books just to publish a chapter edit.

### New book publication

Follow the detailed [new-book checklist](docs/adding-a-new-book.md). Besides source/export, cover, metadata, and dashboard/types, check encryption mapping/rules and all explicit reader manifest/story maps. For a secured book, coordinate the OAuth function's denial and eligible-key response fields, secret name, and the manually configured Netlify environment variable. Never commit local password files or secret values.

Regenerate the new book without `--commit`, for example:

```powershell
.\pipeline.ps1 --book <BookId>
```

Replace `<BookId>` with the repository's exact ID. Inspect generated files, verify every chapter's stable route token maps to its actual generated path, and verify secured entries and `NOT_ALLOWED` denial behavior in code/tests where applicable. Commit/push the reviewed changes. If the secured-reader backend changed, configure its required hosting secret, deploy Netlify, and verify key delivery before publishing the dependent Pages frontend/content. For a public book with no backend changes, publish Pages directly. A book is not ready merely because one target deployed.

### New gallery image(s): human review is a release gate

Before running the generator, place new original `.png`, `.jpg`, or `.jpeg` files in `public/assets/gallery/full/` and keep an external backup. The conversion generator writes WebP full/thumb files and **deletes each processed original file**. Do not use `npm run gallery:admin` for adding images: that command runs gallery generation without the pipeline's strict-review handoff.

Run the root pipeline with **no `--commit`** (it processes gallery input even without a `--book`):

```powershell
.\pipeline.ps1
```

When new images are found, the pipeline launches the strict review admin at `http://127.0.0.1:8765/` and waits up to 120 minutes. A human must inspect and assign at least one tag to **every** new image, then press **Approve review**. Approval saves the manifest; do not bypass the gate. If the admin fails, a tag is missing, approval fails/times out, or output is unexpected, stop—do not publish. The server binds to localhost; do not expose it publicly. After approval, inspect generated WebP files and `public/assets/gallery/gallery.json`, run relevant frontend checks, then commit/push and publish Pages.

The pipeline also updates `src/cacheVersions.json`; its gallery generator merges previous image tags/translations rather than requiring a fresh tag for each unchanged image. It may invoke OpenCode for missing tag translations when available and otherwise uses fallback labels; this translation behavior is not a substitute for the required human tag approval.

Conversion and manifest writes occur **before** approval. If a review is interrupted, do not assume rerunning the pipeline will rediscover the same images as new: their originals may already be consumed. Preserve the pending image list/review-session information and finish reviewing every image from that batch before publishing. A later run with no new-image gate is not evidence that the interrupted batch was approved.

### Retag existing gallery images

Use the standalone local admin to edit the existing manifest:

```powershell
python .\dev-tools\gallery_tag_admin.py
```

Open `http://127.0.0.1:8765/`, edit tags, and press **Save tags**. This edits `public/assets/gallery/gallery.json` directly. Stop the server when finished. Then run the pipeline to regenerate gallery/cache output and review its diff:

```powershell
.\pipeline.ps1
```

With no new source images, strict new-image review is skipped; that is expected for a retag-only change. Commit/push reviewed manifest/cache changes and publish Pages. Do not use `npm run gallery:admin` as a retag-only shortcut: it regenerates image assets/manifest and deletes processed source originals.

### Remove an existing gallery image

There is no documented, safe one-command removal workflow. **Stop before publishing** until a human has audited and coordinated the manifest entry, full/thumb WebP files, cache versions, and desired retention/backup. The generator merges prior entries and filters missing referenced assets; removing an input file alone is not a reliable removal plan. Manually editing a manifest without an asset/rollback plan can leave broken links or orphaned files. No automated migration or cleanup command is implied here. Once the exact deletion set and recovery plan are approved, make only those changes, review the complete diff, and publish Pages intentionally.

### Encryption rules/key rotation, production settings, and Redis data

These are coordinated operational changes, not generic publishing recipes. Stop and obtain the relevant human/service-owner approval before changing keys, encryption rules, production environment variables, OAuth redirects, persisted Redis records, schemas, or indexes. For key changes, inventory which frontend and backend keys, source rules, encrypted generated files, current reader sessions/caches, and rollback materials must remain compatible; never invent a command or silently weaken access. For Redis data/schema/index migrations or cleanup, require a separately approved exact backup, migration, validation, and restore plan. A Git commit/deploy does not execute a data migration, back up production data, or preserve it automatically.

## 4. Combined changes, safety, and limits

- Apply every matching row and recipe for a mixed change. For example, function plus frontend API contract means Netlify **and** Pages; secured new-book publication can also require content generation and manual environment configuration.
- Keep mixed releases backward-compatible: add required backend keys/configuration or additive API fields first, verify that deployment, then publish frontend/content that depends on them. Preserve fields used by cached older clients. A breaking API/data/key change has no universal safe order: stop for a staged migration plan instead of deploying both sides blindly.
- Keep a known-good source/generated-output revision for recovery. Restoring a static frontend or function revision does not restore Redis records, hosting secrets, or rotated/shared keys; those require their separate recovery plan.
- `pipeline.ps1 --commit` is deliberately not recommended. It runs `git add .`, can commit unrelated or pre-staged work, pushes the current branch, may force-update `origin/netlify`, and then runs the Pages publish. If the remote Netlify branch is absent, it exits with status **0** before Pages: a successful exit does not prove a completed release. Run generation without `--commit`, inspect and check the result, and publish only intended targets separately; confirm the actual hosting deployments.
- Do not run release commands for ordinary verification. No release command here establishes that all tests ran. Do not browse production comments/notifications as a safe test: they can mutate persisted Upstash-backed data. Local OAuth/comments are not an isolated production-equivalent stack.
- Preserve working-tree and staged user changes. This guide does not authorize an agent or maintainer to stage, commit, or publish on another person's behalf; stage only when the owner explicitly requests it.
- The goal/proof tree remains uninitialized: there are no goal IDs or authoritative goal writes in this documentation task. Do not infer or initialize goals as part of a release.

For verification limitations, local frontend behavior, and hosting boundaries, see [Development and release](docs/development-and-release.md). For adding a book, see [Adding a New Book](docs/adding-a-new-book.md).
