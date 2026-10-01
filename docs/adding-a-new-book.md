# Adding a New Book

For the release decision and separate Pages/Netlify steps, see [Publishing: choose the safe path](../PUBLISHING.md).

This guide documents the current process for adding a new book to the library. Read [Development and release](development-and-release.md) before running verification or publishing commands; the content pipeline has side effects beyond book generation.

## Required Files and Changes

### 1. Source Files (human-provided)

Create these files in the repository root:

- `book-data/{BookId}_export.md` - source markdown content
- The local encryption password file named by `book_id_to_secret_path` in `deployment/encryptExport.py` (needed when generating encrypted content; secret files are gitignored and must never be committed)
- `public/assets/{BookId}_cover.jpg` - cover image (or matching format used in book data)

### 2. Book Metadata (`src/basicBookData.json`)

Add a new book entry:

```json
{
  "id": "SoWB",
  "title": "Saint of Wrath - Birmingham",
  "assetId": "assets/SoWB_cover.jpg",
  "assetIdBack": "assets/SoWB_cover.jpg",
  "wordCountData": "0 Words",
  "lastUpdate": "Added on 16 Apr 2026",
  "isReady": true
}
```

Note: `wordCountData` and `lastUpdate` are updated by the pipeline (`update_wordcount.py`).

### 3. Dashboard Wiring (`src/components/homepage.tsx`)

Import and render the new dashboard tile component.

### 4. Source Types (`src/constants.tsx`)

Update both type and list:

```tsx
export type SourceType = 'PSSJ' | 'WtDR' | 'SoWB';
export const SourceTypes: SourceType[] = ['PSSJ', 'WtDR', 'SoWB'];
```

### 5. Patreon Frontend Defaults (`src/context/PatreonProvider.tsx`)

Add the new ID to `DEFAULT_ENCRYPTION_PASSWORD_V2` so the type and state cover it.

Also update the manifest imports and the `chapterManifests` and `storyChaptersByBook` maps in `src/App.stories.tsx`. They explicitly cover every `SourceType` and are included in the root TypeScript build. Add meaningful reader interactions for the new book; do not add visual-only stories.

### 6. Encryption Secret Mapping (`deployment/encryptExport.py`)

Add the new book to `book_id_to_secret_path`:

```python
book_id_to_secret_path = {
    "PSSJ": "secret.txt",
    "WtDR": "WtDR_secret.txt",
    "SoWB": "SoWB_secret.txt"
}
```

### 7. Encryption Rules (`deployment/encrypted_files.md`)

If the new book contains secured chapters, add folder/file rules and exceptions.

Rule parsing is shared by modular scripts via `deployment/encryption_rules.py`.

### 8. Netlify Function (`netlify/functions/patreon-oauth/patreon-oauth.js`)

If the new book can contain secured chapters, add its environment variable to `KEY_ENVIRONMENT_NAMES` and return the key in `encryption_passwordv2`. Set that environment variable in Netlify project settings. Current configured names are `NETLIFY_SECRET_PASSWORD` (legacy v1), `WTDR_SECRET_PASSWORD`, and `SOWB_SECRET_PASSWORD`; the server requires every configured key for an eligible reader. Do not put secret values in source or documentation.

In `getKeys`, update both the initial denial-value map and the returned `encryption_passwordv2` fields. Adding only `KEY_ENVIRONMENT_NAMES` does not add a returned key: the response fields are explicit. Verify both eligible-key delivery and ineligible `NOT_ALLOWED` for the new ID.

All configured keys use the same eligibility rule: an active membership of campaign `12346885` OR lifetime campaign payments strictly greater than 500 cents (USD campaign assumed). `supportsMe` means eligible to read secured content, not necessarily currently subscribed. Adding a book does not introduce a separate eligibility policy. See [Patreon authentication](patreon-authentication.md).

## Pipeline (modular)

Current `pipeline.ps1` flow per selected `--book`:

1. `deployment/create_htmls.py`
2. `deployment/generate_metadata.py`
3. `deployment/update_navigation.py`
4. `deployment/update_wordcount.py`
5. `deployment/encryptExport.py`
6. Copy generated outputs into `public/`

Generated artifacts include:

- `public/book-data/{BookId}/...`
- `public/navigation-data/{BookId}_navigation.html`
- `public/navigation-data/{BookId}_chapters.json`

`{BookId}_chapters.json` is required by runtime reader logic.

Each chapter entry must include:

- `chapterId`: stable 8-character route token used in `#/reader/{BookId}/{chapterId}`
- `chapter`: actual generated HTML path under `public/book-data/`
- `title`
- `isSecured`
- optional `volume`

## Running the Pipeline

Regenerate selected books (gallery processing and general cache updates also run):

```powershell
.\pipeline.ps1 --book SoWB
```

Multiple books:

```powershell
.\pipeline.ps1 --book PSSJ --book WtDR --book SoWB
```

Publish (commit/push/deploy) after regeneration:

```powershell
.\pipeline.ps1 --book SoWB --commit
```

No `--book` arguments means no book chapter/navigation regeneration, but this is not a no-op or safe pretest: the pipeline still regenerates gallery assets/manifest, updates general cache versions and `src/cacheVersions.json`, and may run strict gallery review. A run without `--commit` still writes/regenerates those files.

Do not append `--commit` as a routine validation step. It runs `git add .`, can commit existing staged or unrelated worktree changes, pushes the current source branch, may force-update the orphan `origin/netlify` branch, and runs `npm run deploy` for GitHub Pages. Use that mode only for an intentional reviewed release. For safe local frontend checks, see [Development and release](development-and-release.md).

## Validation Checklist

After adding a book, verify:

- `public/navigation-data/{BookId}_chapters.json` exists and is non-empty
- `public/navigation-data/{BookId}_navigation.html` exists
- `public/book-data/{BookId}/` has generated chapter HTML files
- app can open `#/reader/{BookId}` and load first/next chapter correctly
- secured chapter access rules behave as expected (login/supporter gating)

Use focused Storybook interactions for safe frontend gating checks. Do not treat mock provider/API flows as production-service proof, and do not use the live comments UI for test mutations: the frontend points at a hosted API that persists to Upstash. The deployment guide describes the current local integration limitations.
