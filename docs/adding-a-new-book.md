# Adding a New Book

This guide documents the steps to add a new book to the library, based on adding "Saint of Wrath - Birmingham" (SoWB).

## Required Files and Changes

### 1. Source Files

Create these files in the repository root - must be set by the human:

- `book-data/{BookId}_export.md` - Source markdown content
- `deployment/{BookId}_secret.txt` - Encryption password (empty for no encryption)
- `public\assets\{BookId}_cover.jpg` - Cover image
- `deployment\{BookId}_secret.txt` - Secret

### 2. Book Data (`src/basicBookData.json`)

Add a new entry:

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

### 3. Dashboard Component (`src/components/homepage.tsx`)

Import and add the new book tile:

```tsx
import SoWBBookDashboardTile from './dashboardTiles/SoWBBookDashboardTile';

// In the component:
<SoWBBookDashboardTile smallView={smallView} />;
```

Create a new dashboard tile component in `src/components/dashboardTiles/` following the pattern of existing tiles (e.g., `PSSJBookDashboardTile.tsx`).

### 4. Source Types (`src/constants.tsx`)

Update the type and array:

```tsx
export type SourceType = 'PSSJ' | 'WtDR' | 'SoWB';
export const SourceTypes: SourceType[] = ['PSSJ', 'WtDR', 'SoWB'];
```

### 5. Patreon Context (`src/context/PatreonProvider.tsx`)

Add the new book to encryption state:

```tsx
const [encryptionPasswordV2, setEncryptionPasswordV2] = useState<Record<SourceType, string>>({
  PSSJ: 'unused',
  WtDR: 'unset',
  SoWB: 'not-set',
});
```

### 6. Encryption Config (`deployment/encryptExport.py`)

Add to `book_id_to_secret_path`:

```python
book_id_to_secret_path = {
    "PSSJ": "secret.txt",
    "WtDR": "WtDR_secret.txt",
    "SoWB": "SoWB_secret.txt"
}
```

### 7. Encryption Settings (`book-data/encrypted_files.md`)

If the book has encrypted content, then the human handles the configuration for it.

### 8. Netlify Function (`netlify/functions/patreon-oauth/patreon-oauth.js`)

Add environment variable reading and encryption password:

```javascript
const sowbSecret = process.env.SOWB_SECRET_PASSWORD;

const encryption_passwordv2 = {
  WtDR: 'NOT_ALLOWED',
  SoWB: 'NOT_ALLOWED',
};

// In the supportsMe check:
if (filteredMembershipData.supportsMe) {
  encryption_passwordv2.WtDR = wtdrSecret;
  encryption_passwordv2.SoWB = sowbSecret;
}
```

Manually set `SOWB_SECRET_PASSWORD` in Netlify environment variables (login with github -> github login with "benis-boy")
https://app.netlify.com/projects/mellow-kitsune-6578b2/configuration/env#environment-variables

### 9. Pipeline (`pipeline.ps1`)

Enable the book processing:

```powershell
HandleBook -bookId "SoWB"
```

Add navigation placeholder fix if needed:

```powershell
ItemPlaceholder -bookId "SoWB"
```

## Cover Assets

Place cover images in `public/assets/`:

- Front cover: `public/assets/{BookId}_cover.jpg`
- Back cover: `public/assets/{BookId}_cover_back.png` (optional)

## Running the Pipeline

```powershell
.\pipeline.ps1
```

The pipeline will:

1. Process and encrypt book content
2. Commit and push to GitHub
3. Update Netlify config if needed
4. Deploy to GitHub Pages
