-- Email addresses: maps inbound addresses to orgs
create table email_addresses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  email_address text not null unique,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table email_addresses enable row level security;

create policy "Users can view their org email addresses"
  on email_addresses for select
  using (org_id = get_user_org_id());

create policy "Users can insert email addresses for their org"
  on email_addresses for insert
  with check (org_id = get_user_org_id());

create policy "Users can update their org email addresses"
  on email_addresses for update
  using (org_id = get_user_org_id());

create policy "Users can delete their org email addresses"
  on email_addresses for delete
  using (org_id = get_user_org_id());

-- Tickets: incoming customer emails
create type ticket_status as enum ('new', 'draft_generated', 'approved', 'sent', 'discarded');

create table tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  from_email text not null,
  from_name text,
  to_email text not null,
  subject text,
  body_text text,
  body_html text,
  message_id text,
  in_reply_to text,
  thread_id uuid references tickets(id),
  inbound_email_id text,
  status ticket_status not null default 'new',
  created_at timestamptz not null default now()
);

create index tickets_org_id on tickets (org_id);
create index tickets_thread_id on tickets (thread_id);
create index tickets_message_id on tickets (message_id);
create index tickets_org_status on tickets (org_id, status);

alter table tickets enable row level security;

create policy "Users can view their org tickets"
  on tickets for select
  using (org_id = get_user_org_id());

create policy "Users can update their org tickets"
  on tickets for update
  using (org_id = get_user_org_id());

-- Draft replies: AI-generated responses
create table draft_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets on delete cascade,
  org_id uuid not null references organizations on delete cascade,
  draft_content text not null,
  edited_content text,
  was_approved boolean,
  model_used text,
  chunks_used jsonb,
  created_at timestamptz not null default now()
);

create index draft_replies_ticket_id on draft_replies (ticket_id);

alter table draft_replies enable row level security;

create policy "Users can view their org draft replies"
  on draft_replies for select
  using (org_id = get_user_org_id());

create policy "Users can update their org draft replies"
  on draft_replies for update
  using (org_id = get_user_org_id());
