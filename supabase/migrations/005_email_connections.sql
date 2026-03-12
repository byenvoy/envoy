-- Email connections: OAuth-connected email accounts (Gmail, Outlook)
create table email_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  email_address text not null,
  display_name text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  imap_host text not null,
  imap_port integer not null default 993,
  smtp_host text not null,
  smtp_port integer not null default 587,
  last_polled_at timestamptz,
  last_uid text,
  status text not null default 'active' check (status in ('active', 'error', 'revoked')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create index email_connections_org_id on email_connections (org_id);
create index email_connections_status on email_connections (status);

alter table email_connections enable row level security;

create policy "Users can view their org email connections"
  on email_connections for select
  using (org_id = get_user_org_id());

create policy "Users can update their org email connections"
  on email_connections for update
  using (org_id = get_user_org_id());

create policy "Users can delete their org email connections"
  on email_connections for delete
  using (org_id = get_user_org_id());

-- Auto-update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger email_connections_updated_at
  before update on email_connections
  for each row execute function update_updated_at_column();

-- Add source and connection_id to tickets
alter table tickets
  add column source text not null default 'webhook' check (source in ('webhook', 'imap'));

alter table tickets
  add column connection_id uuid references email_connections(id);

-- Add connection_type to email_addresses
alter table email_addresses
  add column connection_type text not null default 'webhook' check (connection_type in ('webhook', 'oauth'));
