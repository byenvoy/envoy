# Launch Checklist

Pre-launch checklist for Envoy — hosted (Render) and open-source self-hosted.

## Critical Path (Start Now)

- [ ] **Google OAuth verification** — Submit app for Google OAuth consent screen review. Can take 2-6 weeks. Requires privacy policy, homepage, scopes justification (IMAP/SMTP).
- [ ] **Microsoft OAuth verification** — Register app in Azure AD, configure admin consent. Faster than Google but still requires publisher verification.

## Must-Have Before Launch

### Infrastructure

- [x] **Dockerfile** — Multi-stage Node.js build for Render and Docker deployments.
- [x] **render.yaml** — Render Blueprint: web service, Postgres with pgvector, cron jobs for email polling (every 2 min) and KB recrawl (every 6 hours).
- [x] **Docker Compose (self-hosted)** — Full stack: app + Postgres + worker. Single `docker compose up` to run.
- [x] **Startup env validation** — Fail fast with clear messages when required env vars are missing.
- [x] **Security headers** — CSP, X-Frame-Options, HSTS, Referrer-Policy via next.config.

### Email Polling

- [x] **Remove IMAP_ALLOW_SENDERS test filter** — Currently blocks all emails except a test allowlist. Must be removed for production.
- [x] **Fix initial lookback** — Reduce from 14 days to 3 days so new users aren't flooded with old threads.
- [x] **First-poll behavior** — Generates drafts on first poll within 3-day window. Drafts require manual approval so no risk of unwanted sends.
- [x] **Polling frequency** — Set to every 2 minutes in render.yaml and documented in README for self-hosted cron setup.

### API Key Error Handling

- [x] **Catch provider errors** — Distinguish between auth errors, quota/credit exhaustion, rate limits, and transient failures in LLM calls.
- [x] **Surface errors in UI** — Show banner/notification when draft generation fails due to API key issues.
- [x] **Pause autopilot on key failure** — Don't auto-send when the LLM provider is returning errors.

### Documentation

- [x] **README rewrite** — Project description, features, screenshots placeholder, setup guide (hosted + self-hosted), env var reference.

### Security

- [x] **Auth rate limiting** — Better Auth built-in with tightened per-route rules (sign-up, sign-in, forgot-password).
- [x] **Session revocation on password reset** — All sessions invalidated when password is changed.
- [x] **CSRF protection** — Handled by Better Auth (origin validation, SameSite cookies, JSON content-type).
- [x] **Playground route removed** — Eliminated unnecessary API surface (`/api/rag/draft`).

## Should-Have for Launch

- [ ] **Autopilot activation UI** — Metrics summary on topic cards (approval rate, volume, edit rate). Manual "Activate" button. Auto-disable on escalation spike.

## Nice-to-Have (Post-Launch)

- [ ] **Test suite** — Zero tests currently. Add critical path coverage: auth, RAG pipeline, email send.
- [ ] **Autopilot Calibrating to Active pipeline** — Automated readiness detection, in-app notification, confirmation flow (see AUTOPILOT_ACTIVATION_TODO.md).
- [ ] **Usage analytics drill-down** — Per-topic stats, cost breakdown, trend charts.
- [ ] **Structured logging** — Replace console.log with a logging service for production observability.
- [ ] **Hybrid search (BM25 + vector)** — Better retrieval for SKUs, error codes, exact matches.
