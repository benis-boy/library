Routing Migration Plan (GitHub Pages-safe)

Goal
- Replace `otherPageInfo` / `LibraryPageType` UI-state routing with URL-based routing.
- Keep `LibraryContext` focused on reader domain state (book/chapter/content/encryption).
- Use hash routing so deployment works on GitHub Pages (`/library/#/...`) without server rewrites.

Why hash routing here
- Site is hosted at `https://benis-boy.github.io/library/` (GitHub Pages static hosting).
- History API routes (`/library/reader/...`) are fragile without rewrite support.
- Hash routes keep server path stable at `/library/` while enabling client-side routing.

Routing model
- `#/` -> Homepage
- `#/settings` -> Configuration
- `#/reader/:bookId/:chapter?` -> Reader view (iframe content)
- `#/reader/end` -> End of book
- `#/access/login-required` -> Login required page
- `#/access/supporter-required` -> Supporter required page

Architecture updates
- `main.tsx`: wrap app in `HashRouter`.
- `App.tsx`: define route tree + shared shell layout (header/nav where needed).
- `LibraryContext` / `LibraryProvider`:
  - remove UI page state (`otherPageInfo`, `showOtherPage`, `LibraryPageType`)
  - keep storage + selection + content loading
  - expose typed outcomes from selection/loading where access gating can fail
- `DataViewer` split:
  - `ReaderView` only for chapter iframe rendering + next chapter action
  - dedicated route components for non-reader pages

Access/gating behavior
- `setSelectedChapter(...)` should return a result:
  - `{ ok: true }`
  - `{ ok: false, reason: 'login_required' | 'supporter_required' }`
- Caller (`Navigator` / reader route) performs `navigate(...)` based on result.

URL/path safety notes
- Keep runtime data in existing static locations:
  - `public/book-data/`
  - `public/navigation-data/`
- Ensure URL creation for iframe/fetch is base-safe under `/library/`:
  - prefer `import.meta.env.BASE_URL` + absolute-from-base paths.

Implementation sequence
1) Introduce router with hash mode and route scaffolding.
2) Move non-reader pages to route components.
3) Convert header/home/end/config/nav page transitions to `navigate(...)`.
4) Remove `otherPageInfo` from context/provider.
5) Update reader selection flow to return gating outcomes and route accordingly.
6) Verify deep links and refresh behavior on hash routes.

Verification checklist
- `npm run build` passes.
- Open app at `/library/#/` and navigate to all routes.
- Loading secured chapter while logged out routes to `#/access/login-required`.
- Loading secured chapter as non-supporter routes to `#/access/supporter-required`.
- Reader route is source-of-truth for chapter (`#/reader/:bookId/:chapter` when a chapter is selected).
- Refresh on non-root route works (hash routing keeps app loadable).
