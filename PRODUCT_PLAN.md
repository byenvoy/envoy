# Product Plan: Self-Hosted AI Customer Support Platform

## Overview

A Ghost-like, self-hosted customer support platform with a human-in-the-loop RAG pipeline. The product crawls a user's existing knowledge base (support docs, FAQs), generates embeddings, and uses retrieval-augmented generation to draft replies to incoming customer emails. Support agents review, edit, and approve drafts before they're sent. Integrations with Stripe, Shopify, and customer databases enrich responses with order-specific context.

---

## Tech Stack

| Layer | Tool | Rationale |
|---|---|---|
| Framework | Next.js (TypeScript) | Single codebase for frontend + API routes. Backend is thin since Supabase handles auth, database, and vectors. Server-side code is mostly API routes proxying calls to external services (OpenAI, Shopify). Avoid Vercel-specific features (Edge Middleware, Vercel KV, Vercel Blob) to stay portable. |
| Auth | Supabase Auth (both hosted and self-hosted) | One auth system across both deployment modes. Self-hosted users run Supabase via Docker Compose. Eliminates the need for an abstraction layer or maintaining two auth implementations. |
| Database | Supabase (Postgres) for both hosted and self-hosted | Single codebase, single database client, single set of queries for both versions. Self-hosted users run Supabase via its official Docker Compose setup. Avoids the complexity of maintaining a provider abstraction layer. |
| Vector Store | Supabase pgvector | Keeps vectors in the same database, avoids a separate Pinecone dependency |
| Embeddings | OpenAI `text-embedding-3-small` | $0.02 per 1M tokens, strong retrieval performance, 1536 dimensions. Cost is negligible even during development (embedding a few hundred documents costs fractions of a penny). Using one embedding model from development through production avoids vector space compatibility issues. Embedding model is an infrastructure decision, not user-facing. Fixed for the hosted version; configurable via environment variable for self-hosted but defaults to OpenAI. |
| LLM | Anthropic Claude Haiku (default), swappable in Phase 5 | Strong instruction-following and grounding in provided context. Deep familiarity with Claude's prompting behavior accelerates iteration on draft quality. Cost-efficient for high-volume drafting. LLM call abstracted behind a provider interface from Phase 1 so swapping models is trivial. |
| Email Infrastructure | Gmail/Outlook OAuth (IMAP/SMTP) | OAuth for zero-friction onboarding with Gmail/Microsoft; IMAP for receiving, SMTP for sending through the user's own account. |
| Web Scraping / Markdown Extraction | Mozilla Readability + Turndown | Readability isolates main content (strips nav, headers, footers, ads), then Turndown converts clean HTML to markdown. Fully local, no external API keys, works for self-hosted without dependencies. Jina Reader available as an optional fallback for sites with aggressive bot detection (requires user-provided API key). |
| RAG Framework | None (custom pipeline) | The RAG pipeline is four operations: chunk text, call embedding API, query pgvector, construct prompt. Does not justify a framework dependency. LlamaIndex can be reconsidered if integration count grows to the point where dynamic tool routing is needed. |
| Deployment | Render/Railway/Fly.io (hosted) / Docker Compose (self-hosted) | Significantly cheaper than Vercel at scale. All support Docker containers natively. Self-hosted version ships the same Docker image alongside Supabase's Docker Compose. |

---

## RAG Architecture

### No Framework (Custom Pipeline)

The RAG pipeline is written from scratch without LangChain or LlamaIndex. The pipeline consists of four operations: chunk text, call the OpenAI embedding API, query pgvector for similar vectors, and construct a prompt to send to the LLM. Each is a straightforward function call that doesn't justify a framework dependency. This keeps the codebase simple, fully debuggable, and free from framework-specific abstractions.

If the product later grows to support dozens of integrations where dynamic tool routing becomes necessary, LlamaIndex.TS can be evaluated at that point.

### Phased RAG Approach

**Phases 1-3: Naive RAG (no classification)**
Every incoming email gets the same treatment: embed the question, retrieve top-k chunks from the knowledge base, construct the prompt, generate a draft. No classification step, no conditional data fetching. If someone asks "where's my order?" the draft will pull from shipping/returns docs and give a generic policy answer. The support agent can manually look up the order and edit the draft before approving.

**Phase 4 onward: Adaptive RAG (with classification)**
When Shopify is integrated, a lightweight LLM classification call is added before retrieval. This call takes the incoming email and returns structured output indicating the query type (policy, order status, account issue), whether customer data is needed, and any extracted identifiers (order numbers, customer email). Based on that classification, the pipeline branches: if customer data is needed, query the Shopify API in parallel with the vector search. If not, just do the vector search. This is not a framework feature. It is one additional LLM call and an if statement.

### Why Not a Simple Naive RAG (Long-Term)

A basic RAG (embed query, retrieve top-k chunks, pass to LLM) would work for generic FAQ questions but would fall short for customer support because:

- Customer questions often combine policy questions with account-specific context ("where's my order?" requires both shipping policy knowledge and Shopify order data)
- Some questions span multiple knowledge base articles (e.g., a return that involves both the refund policy and shipping policy)
- Threads require conversational context from prior messages, not just the latest email

### Prompt Construction (All Phases)
Assemble a structured prompt:
```
System: You are a customer support agent for {company_name}.
Use the following knowledge base context to answer the customer's question.
If the context doesn't contain enough information to answer confidently, say so.
Maintain a {tone} tone.

Knowledge Base Context:
{retrieved_chunks}

Customer Data:
{shopify_order_details / stripe_subscription_status / etc.}

Conversation History:
{prior_thread_messages}

Customer's Message:
{latest_email_body}

Draft a reply to this customer.
```

### Why Not a Sub-Query Engine (Yet)

A sub-query engine (breaking a complex question into multiple sub-queries, retrieving separately for each, then synthesizing) adds complexity and latency. For v1, the query analysis step handles the most common case (identifying what type of data to pull) without the overhead. If approval rates are low because the bot struggles with multi-part questions, a sub-query engine can be added in a later phase.

### Future RAG Improvements (Post-Launch)

- **Re-ranking:** After initial retrieval, use a cross-encoder re-ranker to improve the relevance of retrieved chunks before passing to the LLM
- **Hybrid search:** Combine vector similarity search with keyword search (BM25) for cases where exact terms matter (product SKUs, error codes)
- **Feedback loop:** Track which drafts get approved vs. edited vs. discarded. Use edited drafts as fine-tuning data or few-shot examples to improve future responses
- **Sub-query decomposition:** For complex multi-part questions, break into sub-queries and retrieve independently

---

## Development Phases

### Phase 1: UI and Knowledge Base Ingestion

**Goal:** A working interface where a user can point the app at their website and build a knowledge base from it.

**Features:**
- Next.js app with Supabase Auth (email/password to start)
- Onboarding flow: user inputs their domain URL
- App fetches the sitemap (or crawls the site if no sitemap) and displays a list of discovered URLs
- Pre-select likely support-relevant pages (URLs containing `/support`, `/faq`, `/help`, `/docs`, `/knowledge`, `/article`)
- User can select/deselect URLs to include
- On submit, the app fetches each selected URL, extracts clean markdown using Readability + Turndown (client-side or via API route)
- Markdown content is saved to the Supabase `knowledge_base_pages` table with fields: `id`, `url`, `title`, `markdown_content`, `content_hash`, `created_at`, `updated_at`

**Technical decisions:**
- Use `mozilla/readability` (the library behind Firefox's Reader View) to isolate main content from HTML (strips navigation, headers, footers, ads, boilerplate), then `turndown` to convert the clean HTML to markdown. Both run locally in Node.js with zero external dependencies. No Cloudflare API key or external service needed.
- If bot detection becomes an issue for specific customer sites, Jina Reader can be offered as an optional fallback (requires user-provided API key).
- Store the SHA-256 hash of the markdown content in `content_hash` for change detection in future syncs.

**Database schema (initial):**

```sql
-- Enable pgvector
create extension if not exists vector;

-- Users/orgs (handled by Supabase Auth, extend with profiles)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  created_at timestamptz default now()
);

create table knowledge_base_pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  url text not null,
  title text,
  markdown_content text,
  content_hash text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

### Phase 2: Embeddings, RAG Pipeline, and Draft Generation

**Goal:** Generate embeddings from the knowledge base, build the retrieval pipeline, and produce draft replies from a hardcoded test email.

**Features:**
- Chunking pipeline: split markdown content into chunks (start with ~500 token chunks with 50 token overlap using a recursive text splitter)
- Embedding generation: call OpenAI's embedding API for each chunk, store vectors in pgvector
- Hash-based change tracking: compare `content_hash` on re-sync to detect new, updated, and deleted pages
- RAG query pipeline: embed incoming question, retrieve top-3 chunks via cosine similarity, construct prompt, call LLM
- Simple UI: paste in a sample customer email, click "generate draft," see the drafted reply
- Basic prompt template with system instructions for tone and behavior

**Technical details:**

```sql
create table knowledge_base_chunks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references knowledge_base_pages(id) on delete cascade,
  org_id uuid references organizations(id),
  chunk_index integer,
  content text,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Index for similarity search
create index on knowledge_base_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
```

**Sync logic (for re-crawling):**
1. Fetch current URLs and compute new content hashes
2. New pages (URL not in DB): insert page + generate chunks + embed
3. Updated pages (hash differs): delete old chunks, re-chunk, re-embed
4. Deleted pages (URL no longer in source): mark inactive, delete chunks and vectors
5. Unchanged pages: skip

**Chunking approach:**
- Write a custom recursive text splitter with markdown-aware separators (split on `##`, `\n\n`, `\n`, then by sentence). No LangChain dependency needed for this.
- Chunk size: ~500 tokens, overlap: ~50 tokens
- Store chunk metadata: page_id, chunk_index, source URL

---

### Phase 3: Email Integration

**Goal:** Connect to a real email inbox so the system receives actual customer emails and drafts replies.

**Features:**
- Store incoming emails in a `tickets` table with status tracking (new, draft_generated, approved, sent, discarded)
- When a new email arrives via IMAP polling: run the RAG pipeline automatically, store the draft
- UI: inbox view showing incoming emails with their generated drafts side by side
- Approve button sends the reply via SMTP through the user's connected account
- Edit button allows modifying the draft before approving
- Discard button marks the ticket for manual handling
- Thread support: include prior messages in the prompt context

**Database additions:**

```sql
create table tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  from_email text,
  from_name text,
  subject text,
  body_text text,
  body_html text,
  thread_id text,
  status text default 'new', -- new, draft_generated, approved, sent, discarded
  created_at timestamptz default now()
);

create table draft_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id),
  draft_content text,
  edited_content text, -- populated if agent edits before sending
  was_approved boolean,
  model_used text,
  chunks_used jsonb, -- store which chunks were retrieved for debugging
  created_at timestamptz default now()
);
```

---

### Phase 3.5: Gmail/Outlook OAuth Email Integration

**Goal:** Direct OAuth connections to Gmail and Microsoft for zero-friction onboarding. Users click "Connect with Google" or "Connect with Microsoft" and Envoyer reads from and sends through their existing email account.

**Why:** DNS configuration (MX records, domain verification, email forwarding) is the primary onboarding friction. OAuth lets users connect their existing `support@company.com` inbox with a single click. Replies are sent through the user's own mail server, so they come from their real address with no domain setup. The user's existing inbox (Gmail/Outlook) continues to work alongside Envoyer — Envoyer is just another client reading the same mailbox. This is the approach used by Front and Freshdesk.

**Features:**
- "Connect with Google" and "Connect with Microsoft" OAuth flows in Settings
- IMAP polling via cron-triggered API route (every 2 minutes) to check for new emails
- New emails processed through the existing RAG pipeline (reuse `generateDraftForTicket()`)
- Approved replies sent via SMTP through the user's own account using OAuth tokens
- Encrypted token storage (AES-256-GCM at application layer)
- Connection health monitoring (token refresh, error tracking, auto-deactivation after repeated failures)
- Settings UI with OAuth connection buttons for Google and Microsoft

**Technical details:**
- Google OAuth scopes: `https://mail.google.com/` (or Gmail API with `gmail.readonly` + `gmail.send`)
- Microsoft OAuth scopes: `IMAP.AccessAsUser.All`, `SMTP.Send`, `offline_access`
- NPM packages: `imapflow` (IMAP client), `nodemailer` (SMTP sending), `mailparser` (email parsing)
- Cron-triggered polling route (`/api/email/poll`) with Postgres advisory locks to prevent concurrent runs
- New `email_connections` table for OAuth tokens, IMAP/SMTP config, and polling state
- `tickets.source` column tracking email source
- `sendReply()` abstraction that checks ticket source and sends via the appropriate method
- OAuth buttons hidden when Google/Microsoft client IDs are not configured (self-hosted compatibility)

**Deployment considerations:**
- **Hosted version:** Envoyer provides its own Google/Microsoft OAuth apps. Users click "Connect with Google/Microsoft" and authorize — no setup required on their end. OAuth credentials and redirect URLs are managed by us.
- **Self-hosted version:** Operators must register their own Google Cloud project and Azure AD app, configure OAuth consent screens, and provide their own client IDs/secrets via environment variables. This is necessary because OAuth redirect URLs must point to the operator's domain, not ours. The same pattern used by self-hosted GitLab, Supabase, etc.

**Database additions:**

```sql
create table email_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  email_address_id uuid references email_addresses(id),
  provider text not null, -- 'google', 'microsoft'
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  imap_host text not null,
  imap_port integer not null default 993,
  smtp_host text not null,
  smtp_port integer not null default 587,
  last_polled_at timestamptz,
  last_polled_uid text,
  last_error text,
  error_count integer not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

**Environment variables:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- `ENCRYPTION_KEY` (32-byte hex string for AES-256-GCM)
- `CRON_SECRET` (shared secret for authenticating the poll endpoint)

---

### Phase 4: Shopify Integration

**Goal:** Pull customer order data to enrich RAG responses with account-specific context.

**Features:**
- OAuth flow to connect user's Shopify store
- Add the adaptive RAG classification step: a lightweight LLM call before retrieval that analyzes the incoming email and returns structured output (query type, whether customer data is needed, extracted identifiers like order numbers and customer email). This is one additional LLM call and an if statement, not a framework feature.
- If classification indicates customer data is needed, look up customer by email in Shopify, pull recent orders, fulfillment status, tracking info in parallel with the knowledge base vector search
- Inject customer data into the prompt alongside knowledge base context
- Store integration credentials securely (encrypted in Supabase, or use Supabase Vault)

**Technical details:**
- Use Shopify's Admin API (GraphQL) for order lookups
- Store OAuth tokens in an `integrations` table
- Add a `customer_context` field to `draft_replies` to log what data was pulled
- Rate limit Shopify API calls and cache recent lookups

**Database additions:**

```sql
create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  provider text not null, -- 'shopify', 'stripe', etc.
  credentials jsonb, -- encrypted OAuth tokens
  config jsonb, -- store-specific config (shop URL, etc.)
  is_active boolean default true,
  created_at timestamptz default now()
);
```

---

### Phase 5: Admin Dashboard and Model Selection

**Goal:** Give teams visibility into their support operations and flexibility in model choice.

**Features:**
- Dashboard showing: open tickets, tickets needing response, approval rate over time, average time to approve
- Ticket history with search and filters
- Model selector: allow switching between LLMs (Claude Haiku, Claude Sonnet, GPT-4o, GPT-4o-mini, Gemini Flash)
- Cost tracking: log token usage per draft, show estimated costs
- Knowledge base management UI: see which pages are indexed, force re-sync, manually add/edit knowledge base entries
- Team management: invite additional agents, role-based permissions
- Tone/style settings: configure how the AI drafts responses (formal, casual, technical)

**Technical details:**
- Store model preference per organization in the `organizations` table
- Abstract the LLM call behind a provider interface so swapping models is a config change
- Log all token usage in a `usage_logs` table for cost tracking

---

### Phase 6: Packaging for Open Source and Hosted Deployment

**Goal:** Make the product available as both a self-hosted open source project and a managed hosted service.

**Self-hosted (open source):**
- Docker Compose setup: Next.js app + Supabase (via Supabase's official Docker Compose) + any background workers
- Same codebase, same auth system (Supabase Auth), same database client as the hosted version. No abstraction layer, no conditional logic, no maintaining two implementations.
- `.env.example` with clear documentation for required API keys
- CLI or setup wizard for initial configuration
- MIT or similar permissive license
- README with quickstart guide
- Users bring their own OpenAI/Anthropic API keys and Google/Microsoft OAuth credentials

**Hosted version (paid):**
- Multi-tenant deployment on Render/Railway/Fly.io + Supabase
- Managed onboarding: no Docker, no CLI, just sign up and connect your domain
- Tiered pricing based on: number of tickets processed, number of knowledge base pages, integrations enabled
- Shared infrastructure with org-level data isolation via Supabase RLS
- Usage-based billing for LLM costs (pass through with margin, or bundle into tiers)

**Technical decisions:**
- RLS policies on every table scoped to `org_id` (this should be built from Phase 1, not bolted on later)
- Environment variable-driven configuration so the same codebase runs in both modes
- Feature flags for hosted-only features (billing, usage limits, analytics)

---

## Key Technical Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Low draft approval rate makes the product feel useless | Track approval rates from Phase 3. Invest in prompt tuning, chunk quality, and re-ranking before adding features. |
| Embedding drift when knowledge base changes frequently | Hash-based sync in Phase 2 ensures vectors stay current. Add monitoring for sync failures. |
| Shopify/Stripe API rate limits | Cache customer data with short TTLs (5-10 min). Batch lookups where possible. |
| Email threading breaks | Store thread_id and always include context. IMAP preserves In-Reply-To/References headers; SMTP replies include proper threading headers via nodemailer. |
| OAuth token expiry/revocation | Auto-refresh tokens before expiry. After 3 consecutive refresh failures, deactivate connection and surface reconnection prompt in Settings UI. |
| Self-hosted users struggle with setup | Invest in Docker Compose reliability and a setup wizard. Minimize required external services. |
| LLM hallucinations in customer-facing responses | The human-in-the-loop approval step is the primary safeguard. Add confidence scoring in later phases. |

---

## Success Metrics

- **Draft approval rate:** Of all drafts the system generates, what percentage does the support person approve (either as-is or after editing)? This is the single most important metric. If most drafts are being discarded, the product isn't working. Target: 60%+ at launch, 80%+ with tuning.
- **Edit rate:** Of the drafts that were approved, how many did the support person modify before sending? A high edit rate is a positive signal: the draft was close enough to be worth fixing rather than starting from scratch. If edits cluster around the same types of corrections (e.g., tone is always too formal), that indicates where to tune the prompt.
- **Discard rate:** How often does the support person throw away the draft entirely and write their own response? A high discard rate is a red flag indicating the retrieved context was wrong, the prompt produced something unhelpful, or the knowledge base lacked relevant content.
- **Knowledge base coverage:** Measured by tracking cosine similarity scores from vector search. When the best matching chunk has a low similarity score (below a configurable threshold), that signals the knowledge base doesn't have content relevant to the question. Surfaced in the dashboard as "X% of tickets had low knowledge base relevance" to prompt the user to add content covering those topics. No separate tracking system needed; it's a filter on data already generated during retrieval.
