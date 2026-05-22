# SCOPE

A daily operating system disguised as a terminal. Not a todo app. Not a habit tracker. A command interface for running your life with precision.

Web-based. Single operator. Cloud-deployable on Railway.

## Run locally (Windows / macOS / Linux)

```bash
npm install

# .env
ANTHROPIC_API_KEY=sk-ant-...
SCOPE_PASSCODE=pickAnything
SCOPE_DB_PATH=./data/scope.db

npm run build           # type-check + vite build + tsc server
npm start               # http://localhost:3000
```

Iteration mode (Vite HMR + tsx-watch server, parallel):

```bash
# terminal A — renderer
npm run dev             # http://localhost:5173 (proxies /api to the server)

# terminal B — server
ANTHROPIC_API_KEY=... SCOPE_PASSCODE=... npm run dev:server
```

## Deploy to Railway

1. Push this repo to GitHub.
2. New Railway project → **Deploy from GitHub repo** → pick this repo. Railway picks up `Dockerfile` + `railway.json`.
3. Add a **Persistent Volume**, mount it at `/data`. (Settings → Volumes → New Volume → Mount path `/data`.)
4. Set env vars (Settings → Variables):
   - `ANTHROPIC_API_KEY` — your Claude key
   - `SCOPE_PASSCODE` — anything; the passcode you'll type to unlock
   - `SCOPE_AUTH_SECRET` — 32+ random chars (e.g. `openssl rand -hex 32`)
   - `SCOPE_DB_PATH` — `/data/scope.db`
   - `SCOPE_CLAUDE_MODEL` — optional override
5. Railway auto-deploys. The first deploy will take ~3 minutes (compiling `better-sqlite3`).

All data lives in `/data/scope.db` on the volume — survives restarts and redeploys.

## Mobile

Open the Railway URL on your phone, log in with the passcode, schedule-upload's file picker triggers the native camera on iOS/Android.

## Stack

- **Express** server · **Vite** + **React** + **TypeScript** renderer
- **Tailwind CSS** + custom CSS animations
- **Framer Motion** for layout / transition choreography
- **Zustand** for state
- **better-sqlite3** for storage (single file, WAL mode, on a persistent volume in prod)
- **Claude Sonnet 4** for schedule vision parsing, debrief, "have you thought about" prompts, reflective questions, motto→accent color

## Endpoints

`/api/me`, `/api/auth/{login,logout}`, `/api/day/{current,:id}`, `/api/day`, `/api/task`, `/api/ai/{schedule,debrief,think,reflect,motto}`, `/api/streaks`, `/api/export`. All gated behind the passcode session cookie.

## Data export

```bash
curl -b "scope_session=..." https://<your-railway>.up.railway.app/api/export > scope-backup.json
```

Or hit `GET /api/export` from a logged-in browser tab.
