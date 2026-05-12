# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Envoy is a self-hosted AI customer support platform with a human-in-the-loop RAG pipeline. It crawls a user's knowledge base, generates embeddings, and uses retrieval-augmented generation to draft replies to incoming customer emails. Support agents review, edit, and approve drafts before they're sent. See PRODUCT_PLAN.md for the full product plan.

## Commands

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — Run ESLint
- `npm start` — Start production server
- `npm run eval` — Run LLM regression suites (see `evals/README.md`); accepts `agent`, `draft`, `validator`, or `all`
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
- **Analytics:** PostHog (server in `src/lib/posthog-server.ts`, browser SDK via `posthog-js`)

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

### Draft generation: agent vs classic pipeline

Two pipelines coexist. `src/lib/email/generate-draft.ts` is the entry point and routes by the org's preferred LLM provider:

- **Agent pipeline** (`src/lib/agent/`) — Anthropic-provider orgs. Two phases: a triage agent loop (`loop.ts`) using Claude tool-use over a skill-driven prompt, then draft generation (`draft.ts`) with native citations. Orchestrated by `runAgentPipeline` in `pipeline.ts`, which accepts overrides (`skills`, `activeTopics`, `apiKey`) so evals can bypass the DB.
- **Classic pipeline** (`src/lib/email/generate-draft-classic.ts`) — non-Anthropic providers. Single-shot prompt in `src/lib/rag/prompt.ts` plus the four validator gates in `src/lib/autopilot/prompts.ts`.

Both write to the same `drafts` and `autopilot_evaluations` shape — downstream UI / auto-send / analytics don't branch on which pipeline ran.

### Skills system

Skills are the prompt-fragment unit shared across the agent pipeline.

- **Core skills** live as `SKILL.md` files in `src/skills/core/<name>/` (e.g. `triage`, `draft-reply`, `escalation`, `retrieve`, `shopify`, `autopilot-verdict`). Each has frontmatter (`name`, `description`) and a markdown body.
- **Org overlays** live in the `org_skills` table — same shape, per-tenant overrides. Loaded together with core skills via `loadSkills(orgId)` in `src/lib/skills/loader.ts`, merging by name (org wins).
- **Rendered skills** (`voice`, `autopilot`) are derived from org state. The renderers in `src/lib/skills/renderers/` rebuild and upsert these whenever the source changes — voice on tone/instructions/greeting/signoff save, autopilot on topic create/update/delete. After raw-SQL edits to topics, run `scripts/resync-autopilot-skill.ts` to rebuild.
- **Parser / upsert** helpers are in `src/lib/skills/{parser,upsert}.ts`. Use `loadSkills()` rather than reading files directly.

### Evals

`evals/` holds the LLM regression harness — see `evals/README.md`. Three suites: `agent` (agent pipeline, deterministic scoring), `draft` (classic prompt, LLM-judge), `validator` (classic gates, exact-match). Run before merging skill or prompt changes. Requires `ANTHROPIC_API_KEY` in `.env.local`; no DB needed (agent suite uses pipeline overrides).

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
