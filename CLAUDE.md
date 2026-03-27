# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Envoyer is a self-hosted AI customer support platform with a human-in-the-loop RAG pipeline. It crawls a user's knowledge base, generates embeddings, and uses retrieval-augmented generation to draft replies to incoming customer emails. Support agents review, edit, and approve drafts before they're sent. See PRODUCT_PLAN.md for the full product plan.

## Commands

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — Run ESLint
- `npm start` — Start production server

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
- **Database naming:** snake_case for all table and column names

## Architecture

- `src/` directory with Next.js App Router (`src/app/`)
- Path alias: `@/*` maps to `./src/*`
- No Vercel-specific features (Edge Middleware, Vercel KV, Vercel Blob) — must stay portable for self-hosted deployment
- RAG pipeline is custom (no LangChain/LlamaIndex): chunk text → embed via OpenAI → query pgvector → construct prompt → call LLM
- All database tables use `org_id` with app-layer filtering for multi-tenancy (via `withAuth()` helper and `orgEq()`)
- Database schema defined in `src/lib/db/schema/`, Drizzle config in `drizzle.config.ts`
- Local dev database: `docker compose up db` (pgvector/pgvector:pg16)
- Same codebase runs both hosted and self-hosted (Docker Compose) — no abstraction layers or conditional logic between deployment modes
- Environment variable-driven configuration; feature flags only for hosted-only features (billing, usage limits)

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
