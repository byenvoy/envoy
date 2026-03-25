-- Schema refactor: tickets/draft_replies → conversations/messages/drafts
-- This migration creates the new tables, migrates data, and removes the old tables.

-- 1. Create new types and tables

create type conversation_status as enum ('open', 'waiting', 'closed');

create table conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  subject text,
  status conversation_status not null default 'open',
  customer_email text not null,
  customer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_org_id on conversations (org_id);
create index conversations_org_status on conversations (org_id, status);
create index conversations_org_updated on conversations (org_id, updated_at desc);

alter table conversations enable row level security;

create policy "Users can view their org conversations"
  on conversations for select
  using (org_id = get_user_org_id());

create policy "Users can update their org conversations"
  on conversations for update
  using (org_id = get_user_org_id());

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at_column();

-- Messages: every email in both directions
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations on delete cascade,
  org_id uuid not null references organizations on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_email text not null,
  from_name text,
  to_email text not null,
  body_text text,
  body_html text,
  message_id text,
  in_reply_to text,
  source text not null default 'imap' check (source in ('imap', 'smtp', 'manual')),
  connection_id uuid references email_connections(id),
  created_at timestamptz not null default now()
);

create index messages_conversation_id on messages (conversation_id);
create index messages_org_id on messages (org_id);
create index messages_message_id on messages (message_id);
create index messages_conversation_created on messages (conversation_id, created_at);

alter table messages enable row level security;

create policy "Users can view their org messages"
  on messages for select
  using (org_id = get_user_org_id());

-- Drafts: AI-generated responses linked to conversations
create table drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations on delete cascade,
  org_id uuid not null references organizations on delete cascade,
  message_id uuid references messages(id),
  draft_content text not null,
  edited_content text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'discarded')),
  model_used text,
  chunks_used jsonb,
  customer_context jsonb,
  classification_result jsonb,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index drafts_conversation_id on drafts (conversation_id);
create index drafts_org_id on drafts (org_id);

alter table drafts enable row level security;

create policy "Users can view their org drafts"
  on drafts for select
  using (org_id = get_user_org_id());

create policy "Users can update their org drafts"
  on drafts for update
  using (org_id = get_user_org_id());

-- 2. Migrate data

-- 2a. Create conversations from ticket threads
-- Each unique thread_id becomes one conversation. Use the first ticket in the thread for metadata.
insert into conversations (id, org_id, subject, status, customer_email, customer_name, created_at, updated_at)
select distinct on (coalesce(t.thread_id, t.id))
  coalesce(t.thread_id, t.id) as id,
  t.org_id,
  t.subject,
  case
    when exists (
      select 1 from tickets t2
      where coalesce(t2.thread_id, t2.id) = coalesce(t.thread_id, t.id)
      and t2.status in ('new', 'draft_generated')
    ) then 'open'::conversation_status
    when exists (
      select 1 from tickets t2
      where coalesce(t2.thread_id, t2.id) = coalesce(t.thread_id, t.id)
      and t2.status in ('approved', 'sent')
    ) then 'waiting'::conversation_status
    else 'closed'::conversation_status
  end as status,
  t.from_email as customer_email,
  t.from_name as customer_name,
  t.created_at,
  t.created_at as updated_at
from tickets t
order by coalesce(t.thread_id, t.id), t.created_at asc;

-- 2b. Create inbound messages from all tickets
insert into messages (id, conversation_id, org_id, direction, from_email, from_name, to_email, body_text, body_html, message_id, in_reply_to, source, connection_id, created_at)
select
  t.id,
  coalesce(t.thread_id, t.id) as conversation_id,
  t.org_id,
  'inbound' as direction,
  t.from_email,
  t.from_name,
  t.to_email,
  t.body_text,
  t.body_html,
  t.message_id,
  t.in_reply_to,
  coalesce(t.source, 'imap') as source,
  t.connection_id,
  t.created_at
from tickets t;

-- 2c. Create outbound messages from approved/sent drafts
insert into messages (conversation_id, org_id, direction, from_email, from_name, to_email, body_text, source, created_at)
select
  coalesce(t.thread_id, t.id) as conversation_id,
  t.org_id,
  'outbound' as direction,
  t.to_email as from_email,
  null as from_name,
  t.from_email as to_email,
  coalesce(dr.edited_content, dr.draft_content) as body_text,
  'smtp' as source,
  coalesce(dr.approved_at, dr.created_at) as created_at
from draft_replies dr
join tickets t on dr.ticket_id = t.id
where dr.was_approved = true;

-- 2d. Migrate draft_replies → drafts
-- Link to conversation via the ticket's thread
insert into drafts (id, conversation_id, org_id, draft_content, edited_content, status, model_used, chunks_used, customer_context, classification_result, approved_at, approved_by, created_at)
select
  dr.id,
  coalesce(t.thread_id, t.id) as conversation_id,
  dr.org_id,
  dr.draft_content,
  dr.edited_content,
  case
    when dr.was_approved = true then 'approved'
    when dr.was_approved = false then 'discarded'
    else 'pending'
  end as status,
  dr.model_used,
  dr.chunks_used,
  dr.customer_context,
  dr.classification_result,
  dr.approved_at,
  dr.approved_by,
  dr.created_at
from draft_replies dr
join tickets t on dr.ticket_id = t.id;

-- 3. Update usage_logs foreign key
alter table usage_logs drop constraint if exists usage_logs_draft_reply_id_fkey;
alter table usage_logs rename column draft_reply_id to draft_id;
alter table usage_logs add constraint usage_logs_draft_id_fkey
  foreign key (draft_id) references drafts(id) on delete set null;

-- 4. Update conversations.updated_at to reflect latest message
update conversations c
set updated_at = (
  select max(m.created_at) from messages m where m.conversation_id = c.id
);

-- 5. Drop old tables (rename to _old for safety during transition)
alter table draft_replies rename to draft_replies_old;
alter table tickets rename to tickets_old;

-- Drop old RLS policies on renamed tables
drop policy if exists "Users can view their org draft replies" on draft_replies_old;
drop policy if exists "Users can update their org draft replies" on draft_replies_old;
drop policy if exists "Users can view their org tickets" on tickets_old;
drop policy if exists "Users can update their org tickets" on tickets_old;

-- Drop old type
drop type if exists ticket_status;
