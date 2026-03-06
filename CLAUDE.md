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
- **Database:** Supabase (Postgres + pgvector for embeddings)
- **Auth:** Supabase Auth
- **Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **LLM:** Anthropic Claude Haiku (default), abstracted behind provider interface
- **Email:** Inbound.new or Resend Inbound
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
- All database tables use `org_id` with Supabase RLS for multi-tenancy
- Same codebase runs both hosted and self-hosted (Docker Compose) — no abstraction layers or conditional logic between deployment modes
- Environment variable-driven configuration; feature flags only for hosted-only features (billing, usage limits)
