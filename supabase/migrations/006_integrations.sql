-- Integrations: third-party service connections (Shopify, etc.)
create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  provider text not null check (provider in ('shopify')),
  access_token_encrypted text not null,
  config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create index integrations_org_id on integrations (org_id);
create index integrations_provider on integrations (provider);

alter table integrations enable row level security;

create policy "Users can view their org integrations"
  on integrations for select
  using (org_id = get_user_org_id());

create policy "Users can insert their org integrations"
  on integrations for insert
  with check (org_id = get_user_org_id());

create policy "Users can update their org integrations"
  on integrations for update
  using (org_id = get_user_org_id());

create policy "Users can delete their org integrations"
  on integrations for delete
  using (org_id = get_user_org_id());

create trigger integrations_updated_at
  before update on integrations
  for each row execute function update_updated_at_column();

-- Add customer context and classification to draft_replies
alter table draft_replies
  add column customer_context jsonb,
  add column classification_result jsonb;
