# Autopilot Activation — TODO

What needs to be built before a topic can transition from Calibrating to Active.

## Current State

- Topics can be turned On (enters Calibrating/shadow mode) or Off
- Active mode exists in the database (`mode: 'auto'`) but there's no user-facing path to reach it
- The transition from Calibrating to Active is currently manual (we flip it in the database)
- The "On" button in the UI sets shadow mode; the "Active" label is not user-clickable

## What We Need to Build

### 1. Define activation criteria

Determine what makes a topic "ready" based on shadow mode data. Candidates:

- **Minimum volume**: N emails evaluated for this topic (enough to be statistically meaningful)
- **Approved-without-edits rate**: X% of shadow-tagged drafts approved by humans without changes
- **False positive rate**: Near-zero discarded drafts that passed all gates
- **Gate pass rate stability**: Gate pass rates are consistent (not wildly fluctuating)

These thresholds are TBD — we need real data from calibration periods to define them. Initially we monitor manually and decide case by case.

### 2. Readiness detection

Once criteria are defined, build a check (could be a cron job or run on each evaluation insert) that:

- Queries `autopilot_evaluations` for the topic
- Computes the metrics against the activation criteria
- If met, marks the topic as "ready" (new state or a boolean flag like `calibration_complete`)

### 3. User notification

Notify the user when a topic is ready to go live. Options:

- **In-app notification**: Badge or banner on the /autopilot page ("Shipping Status is ready to activate")
- **Email notification**: Send an email to org owners
- **Both**: In-app for immediate visibility, email for async awareness

Requires a notification system that doesn't exist yet. For MVP, in-app is sufficient.

### 4. User confirmation flow

When notified, the user should be able to:

- Review the topic's performance summary (approved-without-edits rate, volume)
- Confirm activation (switches topic from shadow to auto)
- Decline / keep calibrating

This could be a modal or an expanded state on the topic card.

### 5. Schema changes

- Add `calibration_complete boolean default false` to `autopilot_topics` (or use a separate `ready` mode)
- Possibly add `activated_at timestamptz` to track when a topic went live

### 6. Quality regression detection (future)

After a topic is active, monitor for quality degradation:

- If escalation rate spikes, auto-disable the topic
- If post-send customer satisfaction signals drop, alert
- Periodic re-evaluation against the activation criteria

## Implementation Order

1. Collect real shadow data from calibrating topics (happening now)
2. Analyze the data manually to determine activation criteria
3. Build readiness detection
4. Build in-app notification on /autopilot page
5. Build confirmation flow
6. Quality regression detection (later)
