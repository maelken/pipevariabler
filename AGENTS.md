# AGENTS.md

## Cursor Cloud specific instructions

Pipe Variabler is a **frontend-only** single-page app (Vite + React 19 + TypeScript
+ Tailwind CSS 4). There is no backend, database, or auth. Everything runs client
side in the browser.

### Runtime / tooling
- Requires **Node 22** (see `.github/workflows/deploy.yml`). The VM default (nvm) is
  already Node 22, so no extra setup is needed.
- Package manager is **npm** (`package-lock.json`). The update script runs `npm ci`.

### Commands (already defined in `package.json`)
- Dev server: `npm run dev` (alias `npm start`) — Vite serves on `http://localhost:5173/`.
- Build: `npm run build` — outputs to `build/` (note: not the Vite default `dist/`).
- Preview production build: `npm run preview`.

### Non-obvious gotchas
- **No lint script and no configured test runner.** `src/App.test.tsx` and
  `src/setupTests.ts` are leftover Create React App files that reference
  `@testing-library/react` / `jest`, neither of which is installed. As a result
  `npx tsc --noEmit` reports errors for `src/App.test.tsx`. This is expected and does
  NOT affect the app: `npm run build` uses `vite build`, which only bundles modules
  actually imported by `src/index.tsx`, so the orphan test file is ignored.
- Items are added to chests **only via drag-and-drop** (`@dnd-kit`). Automated,
  synthetic mouse events (e.g. computer-use) do not reliably complete a dnd-kit drag.
  To exercise/demonstrate core functionality without dragging, open the settings cog
  (top-right) → **Skabeloner** → **"Iver og super 26.2"** to load a 151-chest template
  that populates chests with items and per-chest `/signedit` character counters.
- `npm run sync-variabler` fetches sign-edit variables from `variabler.maelk.net` over
  the network. It is optional (CI runs it with `continue-on-error: true`) and is not
  needed to run or build the app locally.
