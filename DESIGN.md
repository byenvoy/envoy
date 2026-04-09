# Design System — Envoy

## Product Context
- **What this is:** Self-hosted and hosted AI customer support platform with a human-in-the-loop RAG pipeline
- **Who it's for:** Support teams at SaaS and e-commerce companies
- **Space/industry:** Customer support (Zendesk, Intercom, Help Scout, Front, Freshdesk)
- **Project type:** Web app / dashboard
- **Positioning:** Ghost-like dual deployment (same codebase for hosted SaaS and self-hosted). Indie, opinionated, open — not enterprise corporate

## Aesthetic Direction
- **Direction:** Refined Industrial — the precision of Linear meets the warmth of Ghost
- **Decoration level:** Intentional — subtle warm texture on surfaces (off-white instead of pure white), meaningful color for AI trust states, no decorative flourishes
- **Mood:** Quiet confidence. A tool that feels chosen, not assigned. Sharp, respectful of the agent's time, and immediately functional. The feeling you get when you pick up a well-made tool designed by someone who understood the job.
- **Reference sites:** ghost.org, linear.app (for polish + developer-tool feel)

## Typography
- **Display/Headings:** DM Sans (Google Fonts, free) — geometric clarity with humanist warmth, same family as DM Mono for visual consistency. 600-700 weight, tight tracking on headings (-0.02em to -0.03em)
- **Body/UI Labels:** Instrument Sans (Google Fonts, free) — clean, slightly narrower, excellent for data-dense interfaces. 400-500 weight
- **Email Content/Drafts:** DM Mono (Google Fonts, free) — monospace for customer messages and AI drafts gives content a telegraph/dispatch quality and creates natural visual rhythm in conversational threads. Same DM family as the display font.
- **Data/Tables:** Instrument Sans with font-variant-numeric: tabular-nums
- **Code:** DM Mono
- **Loading:** All fonts via Google Fonts + next/font for automatic optimization and self-hosting
- **Scale:**
  - 36px / 700 — page titles (Dashboard Overview)
  - 24px / 700 — section headings (Knowledge Base)
  - 18px / 600 — card titles, thread subjects
  - 15px / 400 — body text
  - 13px / 500-600 — UI labels, metadata, nav items
  - 14px mono — email content, draft text, data values
  - 11px mono — timestamps, secondary metadata

## Color
- **Approach:** Restrained — green primary + warm neutrals + amber for AI states. Every competitor is blue; green signals resolution, growth, health.
- **Primary (Viridian):** `#2D6A4F` — buttons, selected states, approved drafts, primary actions
- **Primary Dark (Pine):** `#1B4332` — hover states, emphasis
- **Primary Light (Sage):** `#95D5B2` — success states, subtle highlights, active nav background
- **AI Accent (Amber):** `#E09F3E` — AI-generated content indicator, unreviewed draft border. The amber-to-viridian progression is a trust mechanism: amber = AI touched this, viridian = human approved
- **AI Accent Light:** `#FDF3E3` — AI badge backgrounds, amber chip tint
- **Surface (Parchment):** `#FAF8F5` — main background. Warm off-white (not #FFF) reduces eye strain for agents working 8hr/day and gives the app subtle materiality
- **Surface Alt (Warm Gray):** `#F0EDEA` — cards, panels, secondary surfaces
- **Border (Stone):** `#D4CFC9` — borders, dividers
- **Text Primary (Ink):** `#1A1A1A` — headings, body text
- **Text Secondary (Graphite):** `#6B6560` — metadata, timestamps, labels
- **Error (Brick):** `#C1292E` — destructive actions, errors
- **Signal Red:** `#E63946` — unread badges, SLA warnings
- **Info Blue:** `#3B82F6` — informational alerts
- **Warning:** `#F59E0B` — SLA warnings, caution states
- **Dark mode strategy:** Reduce saturation 10-20%, redesign surfaces to dark warm tones:
  - Surface: `#141210`, Surface Alt: `#1E1C19`, Border: `#2E2B27`
  - Text Primary: `#EDEBE8`, Text Secondary: `#9B9590`
  - Primary shifts to `#40916C`, Primary Light to `#74C69D`

## AI Trust States
Three visual states for AI-generated drafts, using the amber-to-viridian progression:
1. **AI Generated / Unreviewed** — amber left border (`#E09F3E`), amber-tinted background
2. **Human Edited** — neutral border (Stone), normal surface background
3. **Approved / Ready to Send** — viridian left border (`#2D6A4F`), normal surface background

## Draft Panel Layout
- **Customer context card** — always visible at top of draft panel. Shows customer name, email, key stats (order count, total spent, tenure), and the relevant order expanded with status/tracking. Dense, monospace-accented layout.
- **Draft body** — full-width, no gutter. Rendered in Commit Mono. Border-left color indicates trust state.
- **Sources bar** — compact row of chips below the draft. KB sources are amber-tinted with similarity scores. Customer data sources are green-tinted. All sources apply to the whole draft (per-paragraph attribution is a future enhancement requiring structured LLM citations).
- **Action buttons** — below sources bar

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined, with purpose-built three-column layout for inbox (conversation list | thread | draft panel)
- **Grid:** Single column mobile, responsive breakpoints for 2-col and 3-col
- **Max content width:** 1120px for marketing/settings pages; full-width for inbox
- **Border radius:** sm: 4px, md: 8px, lg: 12px, full: 9999px (pills/badges)
- **Navigation:** Top nav bar with logo, nav items (active state highlighting), search trigger (Cmd+K), and user avatar. No sidebar. Inbox uses full-viewport height below nav. Command palette (Cmd+K) as power-user navigation layer.
- **Inbox layout:** Three-column unified view: conversation list (260px) | thread panel (flex) | draft panel (380px). Single page with client-side ticket selection, no separate detail route. Mobile collapses to single column with back navigation.

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** enter: ease-out, exit: ease-in, move: ease-in-out
- **Duration:** micro: 50-100ms, short: 150ms, medium: 250ms
- **Rules:** No bouncy animations, no scroll-driven effects, no decorative motion. Fast and purposeful.

## Anti-Patterns (never use)
- Purple/violet gradients as default accent
- 3-column feature grid with icons in colored circles
- Centered everything with uniform spacing
- Uniform bubbly border-radius on all elements
- Gradient buttons as the primary CTA pattern
- Generic stock-photo-style hero sections

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-24 | Initial design system created | Created by /design-consultation. Competitive research of Intercom, Help Scout, Front, Ghost, Linear. Independent Claude subagent proposal synthesized. |
| 2026-03-24 | Green primary, not blue | Every competitor owns blue. Green signals resolution/growth, differentiates instantly. |
| 2026-03-24 | Amber-to-viridian AI trust states | Baked into color system as a trust mechanism, not decoration. Amber = AI unreviewed, viridian = human approved. |
| 2026-03-24 | Commit Mono for email/draft content | Monospace gives customer messages gravity and creates natural rhythm in threads. Differentiator vs. competitors. |
| 2026-03-24 | Sources bar (not per-paragraph annotations) | Current RAG architecture stores sources per-draft, not per-paragraph. Sources bar shows all sources as compact chips below draft. Per-paragraph attribution is a future enhancement. |
| 2026-03-24 | Always-visible customer context card | Support agents glance at customer data constantly. Hiding behind a click adds friction. Compact card with key stats + relevant order always visible above draft. |
| 2026-03-24 | Top nav bar, not sidebar | Inbox needs max horizontal space for three-column layout. Sidebar on other pages but not inbox creates inconsistency. Ghost and Linear both use top nav. |
| 2026-03-24 | Three-column unified inbox | Conversation list + thread + draft panel in one view. No separate detail page. Client-side ticket selection for instant switching. |
| 2026-03-24 | Command palette (Cmd+K) | Power-user navigation. Search trigger in nav bar. Modal with keyboard navigation for jumping between views. |
| 2026-03-24 | DM Sans + DM Mono (not General Sans + Commit Mono) | DM family keeps all fonts on Google Fonts with next/font optimization. No external CDN dependency. DM Sans closest match to General Sans geometry. |
