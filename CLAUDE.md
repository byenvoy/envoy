# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Envoyer is a self-hosted AI customer support platform with a human-in-the-loop RAG pipeline. It crawls a user's knowledge base, generates embeddings, and uses retrieval-augmented generation to draft replies to incoming customer emails. Support agents review, edit, and approve drafts before they're sent. See PRODUCT_PLAN.md for the full product plan.

## Commands

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — Run ESLint
- `npm start` — Start production server
- `docker compose up db -d` — Start local Postgres (required for dev)
- `docker compose down` — Stop local Postgres (data persists)
- `npx drizzle-kit push` — Push schema changes to database (dev)
- `npx drizzle-kit migrate` — Run migrations (production)
- `npx drizzle-kit generate` — Generate migration from schema changes
- `npx drizzle-kit studio` — Open Drizzle Studio (database UI)

## Tech Stack

- **Framework:** Next.js 16 with App Router, TypeScript, React 19
- **Styling:** Tailwind CSS v4
- **Database:** Postgres + pgvector for embeddings, Drizzle ORM
- **Auth:** Better Auth (email/password, sessions stored in Postgres)
- **Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **LLM:** Anthropic Claude Haiku (default), abstracted behind provider interface
- **Email:** OAuth (Google/Microsoft) via IMAP/SMTP
- **Web scraping:** Mozilla Readability + Turndown (local, no external APIs)

## Conventions

- **Responsive design:** Mobile-first approach. Design for mobile, scale up using Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`)
- **Tailwind v4:** Config lives in CSS (`@theme` in `globals.css`), not in a `tailwind.config.js` file
- **Server Components by default:** Only add `"use client"` when the component needs event handlers, hooks, or browser APIs
- **Database naming:** snake_case for all table and column names in Postgres; camelCase in Drizzle schema and TypeScript code. Never use snake_case types from `src/lib/types/database.ts` for Drizzle query results — use Drizzle inferred types (`typeof table.$inferSelect`) instead.

## Architecture

- `src/` directory with Next.js App Router (`src/app/`)
- Path alias: `@/*` maps to `./src/*`
- No Vercel-specific features (Edge Middleware, Vercel KV, Vercel Blob) — must stay portable for self-hosted deployment
- RAG pipeline is custom (no LangChain/LlamaIndex): chunk text → embed via OpenAI → query pgvector → construct prompt → call LLM
- Same codebase runs both hosted and self-hosted (Docker Compose) — no abstraction layers or conditional logic between deployment modes
- Environment variable-driven configuration; feature flags only for hosted-only features (billing, usage limits)

### Database

- Postgres + pgvector, accessed via Drizzle ORM (`src/lib/db/index.ts`)
- Schema defined in `src/lib/db/schema/` — one file per domain (organizations, profiles, conversations, etc.)
- Migrations in `drizzle/` — includes pgvector extension and HNSW index setup
- Local dev: Docker container (`pgvector/pgvector:pg16`) via `docker-compose.yml`
- All tables use `org_id` for multi-tenancy, enforced at app layer (no RLS)
- Vector columns use a custom `vector1536` type (`src/lib/db/schema/columns.ts`) that auto-converts between `number[]` in JS and pgvector format in Postgres

### Auth

- Better Auth with Drizzle adapter — config in `src/lib/auth.ts`, client in `src/lib/auth-client.ts`
- API routes: catch-all at `src/app/api/auth/[...all]/route.ts`
- Auth tables (user, session, account, verification) managed by Better Auth via `src/lib/db/schema/auth.ts`
- `withAuth()` helper (`src/lib/db/helpers/auth.ts`) — use in API routes to get `{ userId, email, orgId, role, fullName }` or return 401/404
- Server components use `auth.api.getSession({ headers: await headers() })` directly
- Middleware (`src/middleware.ts`) uses cookie-based check for redirects (no DB call)
- After-signup hook in `src/lib/auth.ts` creates organization + profile automatically
- Email verification and password reset: implemented via Resend (`src/lib/auth.ts`)

### Helpers

- `src/lib/db/helpers/` — shared database helpers:
  - `withAuth()` — authenticate API routes, return user context
  - `orgEq()` — consistent org_id filtering
  - `matchChunks()` — pgvector cosine similarity search
  - `tryAdvisoryLock()` / `advisoryUnlock()` — Postgres advisory locks
  - `incrementAutopilotDailySends()` — atomic counter increment

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
