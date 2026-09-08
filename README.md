# Interview Drills

Next.js app for drilling frontend interview questions. Add questions, write your own
answers, mark what you can already explain, and quiz yourself. Everything lives in
Postgres, so your progress follows you to any device you sign in from.

Next.js 15 (App Router) · TypeScript · Drizzle ORM · Postgres · Auth.js

## Run it locally

```bash
npm install
npm run db:seed
npm run dev
```

That's the whole setup. No database to install and no accounts to create — with
`DATABASE_URL` unset the app uses **PGlite**, real Postgres compiled to WASM, stored
in `.pglite/`. Auth is also skipped locally, so you land straight on the questions.

Two things worth knowing:

- PGlite allows a single process at a time, so stop `npm run dev` before running
  `npm run db:seed`. (Neon has no such limit.)
- Scripts load `.env` through Next's own loader, so `npm run dev` and `npm run db:seed`
  always resolve `DATABASE_URL` the same way. `db:seed` prints its target before it
  writes anything.

## Deploying to Vercel

**1 · Push the repo and import it at [vercel.com/new](https://vercel.com/new).**

**2 · Add the database.** In the project's **Storage** tab, create a **Neon** Postgres
database. Vercel sets `DATABASE_URL` for you across all environments.

**3 · Create a GitHub OAuth app** at
[github.com/settings/developers](https://github.com/settings/developers) → *New OAuth App*:

| Field | Value |
| --- | --- |
| Homepage URL | `https://your-app.vercel.app` |
| Authorization callback URL | `https://your-app.vercel.app/api/auth/callback/github` |

**4 · Set the environment variables** in Settings → Environment Variables:

| Name | Value |
| --- | --- |
| `AUTH_SECRET` | generate with `npx auth secret` |
| `AUTH_GITHUB_ID` | the OAuth app's Client ID |
| `AUTH_GITHUB_SECRET` | the OAuth app's Client Secret |
| `ALLOWED_LOGIN` | your GitHub username, e.g. `AoiTechDev` |

`DATABASE_URL` is already there from step 2.

**5 · Create the tables and fill them.** Put the Neon connection string in a local
`.env` (or run `vercel env pull`), then:

```bash
npm run db:seed
```

It prints which database it is about to touch, creates the tables, and loads
`seed/questions.json`. It refuses to touch a database that already has questions in
it, so it can never overwrite your work. To point at a different database for one run:

```bash
DATABASE_URL="postgres://…" npm run db:seed
```

**6 · Redeploy** so the new environment variables take effect.

### If you skip a step

The app fails closed rather than exposing your notes:

- No `AUTH_GITHUB_*` in production → every page redirects to `/login`, which explains
  what's missing. No question data is served.
- A GitHub account not in `ALLOWED_LOGIN` → sign-in is refused.
- No `DATABASE_URL` in production → a clear error naming the fix, not a silent
  fallback to a scratch database that disappears on the next deploy.

## What you can do

| Action | How |
| --- | --- |
| Mark a question reviewed | Click its checkbox |
| Write / edit an answer | Click the question or the pencil, type — it autosaves |
| Edit the question wording | Same panel, top field |
| Star a question | Star icon on the row |
| Add a question | "+ Add a question to …" at the bottom of any category |
| Add a category | "+ Category" in the toolbar |
| Rename a category | Double-click its title |
| Move a question | Category dropdown in the answer panel |
| Delete | Trash icon on the row or the category header |
| Quiz yourself | "Drill me" — shuffles whatever is currently filtered |
| Filter | All / To review / Reviewed / Starred / No answer |
| Search | Searches question text *and* your answers |
| Back up | Export downloads a JSON snapshot; Import restores one |
| Light / dark | "Theme" cycles system → light → dark |

Keyboard: `/` focuses search, `d` starts a drill. In a drill, `Space` reveals the
answer then marks it reviewed and moves on, `→` skips, `Esc` closes.

## Bringing over older data

Import accepts exports from both earlier versions of this app (the Node server and the
standalone `drills.html`) as well as its own. The old format used `order` where the
tables now use `position`; the import handles either. Use **Import JSON** in the
toolbar and pick the file.

## Layout

```
app/
  page.tsx            server component: session check, then loads the snapshot
  login/page.tsx      GitHub sign-in, and the setup screen when unconfigured
  api/auth/…          Auth.js route handlers
  globals.css         the design system, one file of CSS variables
components/
  Drills.tsx          all interactive state: filters, search, categories
  QuestionRow.tsx     one row plus its answer editor and autosave
  DrillOverlay.tsx    the flashcard mode
lib/
  schema.ts           Drizzle tables and shared types
  db.ts               driver selection, Neon or PGlite
  queries.ts          reads
  actions.ts          server actions — every one re-checks the session
  auth.ts             Auth.js config and the fail-closed user resolver
scripts/seed.ts       creates tables and loads seed/questions.json
seed/questions.json   the starter 102 questions
legacy/               the previous local-only versions, kept for reference
```

### Notes on a couple of decisions

**Server actions, not API routes.** Mutations are server actions called straight from
the client component. Each one starts with `requireUser()` — a server action is its own
HTTP endpoint, so it cannot rely on the page having already checked the session.

**No `revalidatePath`.** The page is `force-dynamic`, so nothing is cached, and the
client applies each result optimistically. Revalidating would push a full RSC payload
down the wire after every debounced answer save.

**Optimistic updates with rollback.** Marking, starring and editing apply locally
first and roll back if the server rejects them, so the UI never stalls on a round trip.
