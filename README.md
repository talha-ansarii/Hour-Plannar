# Hourly Planner

A production-grade daily planning + execution system built on hour blocks (24 blocks/day) with planning, execution, and history modes.

## Tech stack
- Next.js App Router (Next 15 / React 19)
- TypeScript
- tRPC + React Query
- Prisma (PostgreSQL / Neon)
- Auth.js (NextAuth v5 beta) with Google OAuth
- Tailwind + shadcn/ui
- dnd-kit for draggable todos
- Server-only protected data (SSR session required; no edge for auth/trpc/data routes)

## Core concepts
- **DailyLog**: one per user per date (`YYYY-MM-DD`)
- **HourBlock**: 24 per day (0–23), each has planned text + (today-only) reflection
- **Todo**: always belongs to a DailyLog + HourBlock (no global todos)
- **BacklogItem**: deferred tasks swept from unfinished todos

## Local setup

### 1) Install deps

```bash
pnpm install
```

### 2) Configure environment
- Copy `.env.example` to `.env` and fill values.

Required:
- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `OPENAI_API_KEY`

Optional:
- `OPENAI_MODEL` (defaults to `gpt-4o-mini`)

### 3) Database

Create/migrate schema locally:

```bash
pnpm db:generate
```

Seed with mock users/logs:

```bash
pnpm db:seed
```

### 4) Run the app

```bash
pnpm dev
```

Visit:
- `/auth/login` to sign in
- `/today` to auto-create today’s day + 24 hour blocks

## Google OAuth setup (Auth.js)
In Google Cloud Console:
- Create OAuth Client (Web Application)
- Authorized redirect URI:
  - `http://localhost:3000/api/auth/callback/google` (local)
- Put the resulting client ID/secret in `.env` as `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

## OpenAI setup (AI summaries)
- Set `GOOGLE_GENERATIVE_AI_API_KEY` in `.env`.
- The server calls Gemini from the `daily.generateSummary(date)` tRPC mutation and stores:
  - deterministic `summary`
  - rewritten `aiSummary`

## Useful commands
- `pnpm dev`: start dev server
- `pnpm typecheck`: TypeScript check
- `pnpm lint`: ESLint
- `pnpm db:studio`: Prisma Studio

## Deployment notes (Vercel + Neon)
- Use a managed Postgres like Neon and set `DATABASE_URL` in your deployment environment.
- Set `AUTH_SECRET`, Google OAuth keys, and `OPENAI_API_KEY` as environment variables.
- Ensure OAuth redirect URIs include your production domain:
  - `https://YOUR_DOMAIN/api/auth/callback/google`
