-- Enable extensions
create extension if not exists "vector" with schema "extensions";

-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;

-- Profiles (linked to auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  org_id uuid not null references organizations on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Knowledge base pages
create table knowledge_base_pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  url text not null,
  title text,
  markdown_content text,
  content_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index knowledge_base_pages_org_url on knowledge_base_pages (org_id, url);

alter table knowledge_base_pages enable row level security;

-- Helper function to get current user's org_id
create or replace function get_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- RLS policies: organizations
create policy "Users can view their own organization"
  on organizations for select
  using (id = get_user_org_id());

create policy "Users can update their own organization"
  on organizations for update
  using (id = get_user_org_id());

-- RLS policies: profiles
create policy "Users can view their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Users can update their own profile"
  on profiles for update
  using (id = auth.uid());

-- RLS policies: knowledge_base_pages
create policy "Users can view their org pages"
  on knowledge_base_pages for select
  using (org_id = get_user_org_id());

create policy "Users can insert pages for their org"
  on knowledge_base_pages for insert
  with check (org_id = get_user_org_id());

create policy "Users can update their org pages"
  on knowledge_base_pages for update
  using (org_id = get_user_org_id());

create policy "Users can delete their org pages"
  on knowledge_base_pages for delete
  using (org_id = get_user_org_id());

-- Trigger: auto-create org + profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  company_name text;
begin
  company_name := coalesce(
    new.raw_user_meta_data ->> 'company_name',
    'My Organization'
  );

  insert into public.organizations (name)
  values (company_name)
  returning id into new_org_id;

  insert into public.profiles (id, org_id, full_name)
  values (
    new.id,
    new_org_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Updated_at trigger for knowledge_base_pages
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger knowledge_base_pages_updated_at
  before update on knowledge_base_pages
  for each row execute function update_updated_at();
