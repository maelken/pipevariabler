# AGENTS.md

## Cursor Cloud specific instructions

Pipe Variabler is a **frontend-only** single-page app (Vite + SolidJS + TypeScript
+ Tailwind CSS 4). There is no backend, database, or auth. Everything runs client
side in the browser.

Live site: https://pipes.maelk.net (custom domain via `public/CNAME`).

### Runtime / tooling
- Requires **Node 22** (see `.github/workflows/deploy.yml`). The VM default (nvm) is
  already Node 22, so no extra setup is needed.
- Package manager is **npm** (`package-lock.json`). The update script runs `npm ci`.

### Commands (already defined in `package.json`)
- Dev server: `npm run dev` — Vite serves on `http://localhost:5173/`.
- Build: `npm run build` — outputs to `build/` (note: not the Vite default `dist/`).
- Preview production build: `npm run preview`.
- Typecheck: `npm run typecheck`.

### Non-obvious gotchas
- `vite.config.ts` uses `base: '/'` so the app works on the root custom domain
  `pipes.maelk.net`. Do not change this back to `/pipevariabler/` (that is only for
  the upstream GitHub Pages project path).
- Items are added to chests **only via drag-and-drop** (`@thisbeyond/solid-dnd`).
  To exercise/demonstrate core functionality without dragging, open the settings cog
  (top-right) → **Skabeloner** → load a preset such as **"Iver og super 26.2"** /
  `ivers_kisterum` that populates chests with items and per-chest `/signedit`
  character counters.
