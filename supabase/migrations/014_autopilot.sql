-- Autopilot: confidence-gated auto-send pipeline for AI draft replies

-- 1. Autopilot topics: user-defined categories eligible for auto-send
create table autopilot_topics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  name text not null,
  description text not null,
  embedding vector(1536),
  mode text not null default 'off' check (mode in ('off', 'shadow', 'auto')),
  confidence_threshold numeric not null default 0.95,
  daily_send_limit integer not null default 100,
  daily_sends_today integer not null default 0,
  daily_sends_reset_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index autopilot_topics_org_id on autopilot_topics (org_id);
create index autopilot_topics_org_mode on autopilot_topics (org_id, mode);

alter table autopilot_topics enable row level security;

create policy "Users can view their org autopilot topics"
  on autopilot_topics for select
  using (org_id = get_user_org_id());

create policy "Users can insert their org autopilot topics"
  on autopilot_topics for insert
  with check (org_id = get_user_org_id());

create policy "Users can update their org autopilot topics"
  on autopilot_topics for update
  using (org_id = get_user_org_id());

create policy "Users can delete their org autopilot topics"
  on autopilot_topics for delete
  using (org_id = get_user_org_id());

create trigger autopilot_topics_updated_at
  before update on autopilot_topics
  for each row execute function update_updated_at_column();

-- 2. Autopilot evaluations: audit log for every pipeline run
create table autopilot_evaluations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  conversation_id uuid not null references conversations on delete cascade,
  draft_id uuid references drafts(id) on delete set null,

  -- Gate 1: Topic Classification
  gate1_passed boolean,
  gate1_topic_id uuid references autopilot_topics(id) on delete set null,
  gate1_topic_name text,
  gate1_confidence numeric,
  gate1_embedding_similarity numeric,
  gate1_reasoning text,

  -- Gate 2: Retrieval Quality
  gate2_passed boolean,
  gate2_confidence numeric,
  gate2_reasoning text,

  -- Gate 3: Generation Escape Hatch
  gate3_passed boolean,
  gate3_needs_human_reason text,

  -- Gate 4: Post-Generation Validation
  gate4_passed boolean,
  gate4_confidence numeric,
  gate4_checks jsonb,
  gate4_reasoning text,

  -- Outcome
  all_gates_passed boolean not null default false,
  outcome text not null default 'human_queue'
    check (outcome in ('auto_sent', 'shadow_tagged', 'human_queue')),
  failure_gate integer,

  -- Shadow mode tracking (populated when human reviews a shadow-tagged draft)
  human_action text check (human_action in ('approved_no_edit', 'approved_with_edit', 'discarded')),
  edit_distance integer,

  created_at timestamptz not null default now()
);

create index autopilot_evaluations_org_id on autopilot_evaluations (org_id);
create index autopilot_evaluations_conversation_id on autopilot_evaluations (conversation_id);
create index autopilot_evaluations_topic_id on autopilot_evaluations (gate1_topic_id);
create index autopilot_evaluations_org_outcome on autopilot_evaluations (org_id, outcome);

alter table autopilot_evaluations enable row level security;

create policy "Users can view their org autopilot evaluations"
  on autopilot_evaluations for select
  using (org_id = get_user_org_id());

create policy "Users can update their org autopilot evaluations"
  on autopilot_evaluations for update
  using (org_id = get_user_org_id());

-- 3. Add columns to existing tables

-- Per-thread escalation flag
alter table conversations
  add column autopilot_disabled boolean not null default false;

-- Flag auto-sent outbound messages
alter table messages
  add column sent_by_autopilot boolean not null default false;

-- Link drafts to autopilot evaluations
alter table drafts
  add column autopilot_evaluation_id uuid references autopilot_evaluations(id) on delete set null,
  add column sent_by_autopilot boolean not null default false,
  add column is_regeneration boolean not null default false;

-- Expand usage_logs call_type to include autopilot gate calls
alter table usage_logs drop constraint if exists usage_logs_call_type_check;
alter table usage_logs add constraint usage_logs_call_type_check
  check (call_type in ('draft', 'classification', 'autopilot_classify', 'autopilot_retrieval_judge', 'autopilot_validate', 'autopilot_escalation'));

-- 4. Helper functions

-- Reset daily send counts (call from cron or at check time)
create or replace function reset_autopilot_daily_sends()
returns void as $$
begin
  update autopilot_topics
  set daily_sends_today = 0, daily_sends_reset_at = now()
  where daily_sends_reset_at < current_date;
end;
$$ language plpgsql security definer;

-- Atomic increment of daily send count
create or replace function increment_autopilot_daily_sends(topic_id uuid)
returns void as $$
begin
  update autopilot_topics
  set daily_sends_today = daily_sends_today + 1
  where id = topic_id;
end;
$$ language plpgsql security definer;
