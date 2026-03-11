-- Replace per-column API key storage with a flexible table

-- Drop the columns from organizations
alter table organizations
  drop column if exists anthropic_api_key_encrypted,
  drop column if exists openai_api_key_encrypted,
  drop column if exists google_ai_key_encrypted;

-- Create flexible API key table
create table org_api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  provider_key text not null,
  api_key_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider_key)
);

create trigger org_api_keys_updated_at
  before update on org_api_keys
  for each row execute function update_updated_at();

alter table org_api_keys enable row level security;

create policy "Users can view their org API keys"
  on org_api_keys for select
  using (org_id = get_user_org_id());

create policy "Users can insert API keys for their org"
  on org_api_keys for insert
  with check (org_id = get_user_org_id());

create policy "Users can update their org API keys"
  on org_api_keys for update
  using (org_id = get_user_org_id());

create policy "Users can delete their org API keys"
  on org_api_keys for delete
  using (org_id = get_user_org_id());
