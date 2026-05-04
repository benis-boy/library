# Adding a New Book

This guide documents the current process for adding a new book to the library with the modular content pipeline.

## Required Files and Changes

### 1. Source Files (human-provided)

Create these files in the repository root:

- `book-data/{BookId}_export.md` - source markdown content
- `deployment/{BookId}_secret.txt` - encryption password file (required for `encryptExport.py` map)
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

Add the new key to `encryptionPasswordV2` initial state.

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

If the new book can be supporter-only, wire env var + returned key:

- add `process.env.<BOOK>_SECRET_PASSWORD`
- add key to `encryption_passwordv2`
- assign real value for supporters

Also set the env var in Netlify project settings.

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

## Running the Pipeline

Regenerate content for selected books only:

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

No `--book` arguments means no content regeneration (intentional for no-book-change runs).

## Validation Checklist

After adding a book, verify:

- `public/navigation-data/{BookId}_chapters.json` exists and is non-empty
- `public/navigation-data/{BookId}_navigation.html` exists
- `public/book-data/{BookId}/` has generated chapter HTML files
- app can open `#/reader/{BookId}` and load first/next chapter correctly
- secured chapter access rules behave as expected (login/supporter gating)
