# Envoyer

AI-powered customer support with a human-in-the-loop. Envoyer crawls your knowledge base, generates draft replies to incoming emails using RAG, and lets your team review and approve before sending.

## Features

- **RAG Pipeline** — Crawls your docs/help center, chunks and embeds content, retrieves relevant context for each customer email
- **Email Integration** — Connects to Gmail and Outlook via OAuth. Polls for new emails, threads replies automatically
- **Draft Generation** — Uses Claude, GPT-4o, Gemini, Mistral, or DeepSeek to draft replies grounded in your knowledge base
- **Autopilot** — Automatically send replies for well-understood topics with configurable quality gates
- **Shopify Integration** — Pulls order, return, and customer data into draft context
- **Team Management** — Invite agents with role-based permissions (owner, admin, agent)
- **Self-Hosted** — Run the full stack on your own infrastructure with Docker Compose

## Quick Start (Development)

```bash
# Start Postgres
docker compose up db -d

# Install dependencies
npm install

# Copy env template and fill in your keys
cp .env.example .env.local

# Push schema to database
npx drizzle-kit push

# Start dev server
npm run dev
```

Open http://localhost:3000 and create an account. The onboarding wizard walks you through connecting your knowledge base, choosing an AI model, and linking your email.

## Self-Hosted Deployment (Docker Compose)

```bash
# Copy and configure environment
cp .env.example .env.local
# Edit .env.local with your API keys and settings

# Start everything (app + Postgres + migrations)
docker compose -f docker-compose.prod.yml up -d
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Auth session signing secret (random string) |
| `BETTER_AUTH_URL` | Your app's public URL |
| `NEXT_PUBLIC_APP_URL` | Same as above (used client-side) |
| `ENCRYPTION_KEY` | 32-byte hex string for encrypting OAuth tokens |
| `CRON_SECRET` | Bearer token for cron job authentication |
| `OPENAI_API_KEY` | Required for embeddings (text-embedding-3-small) |

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | For Claude models |
| `GOOGLE_AI_KEY` | For Gemini models |
| `MISTRAL_API_KEY` | For Mistral models |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail OAuth |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Outlook OAuth |
| `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` | Shopify integration |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Transactional email (verification, invites) |

### Email Polling

Set up a cron job to poll for new emails. Call the poll endpoint with your `CRON_SECRET`:

```bash
# Every 2 minutes
*/2 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/email/poll
```

### Knowledge Base Recrawl

Optionally re-sync your knowledge base on a schedule:

```bash
# Every 6 hours
0 */6 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/knowledge-base/recrawl
```

## Deploy to Render

Click the button below or use the included `render.yaml` Blueprint:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

The Blueprint provisions a web service, Postgres database, and cron jobs for email polling and KB recrawl.

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript, React 19
- **Database:** Postgres + pgvector, Drizzle ORM
- **Auth:** Better Auth
- **Embeddings:** OpenAI text-embedding-3-small
- **LLM:** Provider-agnostic (Anthropic, OpenAI, Google, Mistral, DeepSeek)
- **Email:** IMAP/SMTP via OAuth (Google, Microsoft)

## License

MIT
