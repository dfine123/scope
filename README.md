# SCOPE

A daily operating system disguised as a terminal. Not a todo app. Not a habit tracker. A command interface for running your life with precision.

## Run

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev:electron        # build renderer + launch desktop app
```

For UI iteration only (no AI parsing / insights):

```bash
npm run dev                 # vite dev server in a browser
```

The browser preview persists to `localStorage` and uses local heuristics for motto→accent and debriefs so the flow stays usable.

## Stack

- **Electron** shell · **Vite** + **React** + **TypeScript** renderer
- **Tailwind CSS** + custom CSS animations
- **Framer Motion** for layout / transition choreography
- **Zustand** for app state
- **better-sqlite3** for local persistence (lives in your OS user-data dir as `scope.db`)
- **Claude Sonnet 4** for schedule vision parsing, debrief generation, "Have You Thought About" prompts, reflective questions, and motto→accent color mapping

## Build

```bash
npm run build               # type-check + vite build + electron tsc
npm run build:electron      # packaged installer via electron-builder
```

## Data

- `scope.db` (SQLite WAL) in Electron's userData directory
- Export everything: `window.scope.db.exportAll()` returns a single JSON blob

## File layout

See the directory tree — the structure follows the spec.
