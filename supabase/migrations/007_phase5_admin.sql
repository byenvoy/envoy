-- Phase 5: Admin dashboard, model selection, team management

-- Alter organizations: add model, tone, custom instructions
alter table organizations
  add column preferred_model text not null default 'claude-haiku-4-5-20251001',
  add column tone text not null default 'professional'
    check (tone in ('professional', 'casual', 'technical', 'friendly')),
  add column custom_instructions text,
  add column updated_at timestamptz not null default now();

create trigger organizations_updated_at
  before update on organizations
  for each row execute function update_updated_at();

-- Alter profiles: add role
alter table profiles
  add column role text not null default 'owner'
    check (role in ('owner', 'agent'));

-- RLS: let users view all profiles in their org (for team management)
create policy "Users can view org profiles"
  on profiles for select
  using (org_id = get_user_org_id());

-- Usage logs
create table usage_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  draft_reply_id uuid references draft_replies(id) on delete set null,
  call_type text not null check (call_type in ('draft', 'classification')),
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  estimated_cost_usd numeric(10,6) not null,
  created_at timestamptz not null default now()
);

create index usage_logs_org_created on usage_logs (org_id, created_at);

alter table usage_logs enable row level security;

create policy "Users can view their org usage logs"
  on usage_logs for select
  using (org_id = get_user_org_id());

-- Team invites
create table team_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  email text not null,
  role text not null default 'agent' check (role in ('owner', 'agent')),
  invited_by uuid not null references profiles(id),
  token text not null unique,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table team_invites enable row level security;

create policy "Users can view their org invites"
  on team_invites for select
  using (org_id = get_user_org_id());

create policy "Users can create invites for their org"
  on team_invites for insert
  with check (org_id = get_user_org_id());

create policy "Users can delete their org invites"
  on team_invites for delete
  using (org_id = get_user_org_id());

-- Alter knowledge_base_pages: add source, make url nullable for manual entries
alter table knowledge_base_pages
  add column source text not null default 'crawled'
    check (source in ('crawled', 'manual'));

alter table knowledge_base_pages
  alter column url drop not null;

-- Drop and recreate the unique index to allow null urls
drop index if exists knowledge_base_pages_org_url;
create unique index knowledge_base_pages_org_url on knowledge_base_pages (org_id, url) where url is not null;

-- Alter draft_replies: add approved_at, approved_by
alter table draft_replies
  add column approved_at timestamptz,
  add column approved_by uuid references profiles(id);
