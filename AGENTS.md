# AGENTS.md

## Project Overview

Personal author homepage/library for "BenisBoy16" featuring book previews (Pokemon fanfic "Solo's Strange Journey", original fiction "Where the Dead Remember", and "Saint of Wrath - Birmingham"), Patreon integration, and support tier management.

## Tech Stack

- React 19 + TypeScript + Vite 6
- Tailwind CSS v4 (Vite plugin, NOT the traditional PostCSS approach)
- MUI (Material UI) + Emotion + styled-components
- ESLint (flat config) + Prettier
- gh-pages for GitHub Pages deployment

## Key Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Run tsc -b (typecheck) then vite build
npm run lint       # ESLint check
npm run preview    # Preview production build
npm run deploy     # Build then gh-pages -d dist (GitHub Pages)
```

## Deployment

- **Base path**: `/library/` (configured in `vite.config.ts`)
- **GitHub Pages URL**: `benis-boy.github.io/library/`
- Deploy script runs `npm run build` first via `predeploy`

## Architecture Notes

- **Main app**: Single-page React app in `src/`, entry point `src/main.tsx`
- **Standalone tools** (not part of main build):
  - `apps/notes-app/` - vanilla TS note-taking app with localStorage persistence
  - `apps/simple-tts/` - Python TTS script (requires `pyttsx3`)
- **Netlify function**: `netlify/functions/patreon-oauth/patreon-oauth.js` handles Patreon OAuth token exchange and membership verification

## Build Configuration

- Vite config uses `tailwindcss/vite` plugin (v4 approach)
- `tsconfig.app.json` + `tsconfig.node.json` (project references)
- PostCSS config at `./postcss.config.js` with `@tailwindcss/postcss`

## Environment Variables (Netlify)

- `NETLIFY_SECRET_PASSWORD` - encryption key for patron sessions
- `WTDR_SECRET_PASSWORD` - unlock code for "Where the Dead Remember" content
- `SOWB_SECRET_PASSWORD` - unlock code for "Saint of Wrath - Birmingham" content

## ESLint Configuration

Two config files exist: legacy `.eslintrc.json` and flat config `eslint.config.js`. Vite/TypeScript uses the flat config.

## Publishing Pipeline (`pipeline.ps1`)

The `pipeline.ps1` script handles publishing book content. Run it from PowerShell after exporting new chapters.

### Pipeline Flow

1. **Process each book** via `HandleBook` function:
   - Cleans old folders (`book-data/{bookId}`, `book-data/{bookId}_raw`, `public/book-data/{bookId}`)
   - Runs `deployment/modifyExport.py` - splits markdown into volumes/chapters, converts to HTML, generates navigation, counts words, updates `src/basicBookData.json`
   - Runs `deployment/encryptExport.py` - encrypts content files per `book-data/encrypted_files.md`, removes non-HTML files
   - Copies navigation HTML and book data to `public/`
   - Removes `.webnovel.html` files and renames `#` to `_` in filenames

2. **Commits and pushes** to GitHub

3. **Updates Netlify** (if netlify.toml/.netlify/netlify/ changed):
   - Uses a git worktree to isolate and push Netlify config to `origin/netlify` branch
   - Runs `deployment/deploy-netlify.ps1`

4. **Deploys to GitHub Pages** via `npm run deploy`

### Configuration Files

- `book-data/encrypted_files.md` - defines which folders/files are encrypted
- `book-data/{bookId}_export.md` - source markdown to publish
- `deployment/{bookId}_secret.txt` - encryption password

### Book IDs

- `PSSJ` - Pokemon - Solo's Strange Journey
- `WtDR` - Where the Dead Remember
- `SoWB` - Saint of Wrath – Birmingham

### Adding a New Book

See [docs/adding-a-new-book.md](docs/adding-a-new-book.md) for a complete step-by-step guide.

## Build Artifact

- Output goes to `dist/` directory
- Do not edit `dist/` directly (it's gitignored)
