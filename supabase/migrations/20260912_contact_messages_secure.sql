-- HERITAGE — messages du formulaire de contact
-- À exécuter dans Supabase Dashboard > SQL Editor après les migrations
-- 20260910_admin_portal.sql et 20260911_cms_completion.sql.

begin;

create extension if not exists pgcrypto;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  subject text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  read_by uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  processed_by uuid references public.profiles(id) on delete set null,
  source_ip_hash text
);

-- Existing installations created an earlier version with unread/read/archived.
-- Preserve its data while bringing it to the public terminology new/read/processed.
alter table public.contact_messages add column if not exists full_name text not null default '';
alter table public.contact_messages add column if not exists email text not null default '';
alter table public.contact_messages add column if not exists phone text not null default '';
alter table public.contact_messages add column if not exists subject text not null default '';
alter table public.contact_messages add column if not exists message text not null default '';
alter table public.contact_messages add column if not exists status text not null default 'new';
alter table public.contact_messages add column if not exists created_at timestamptz not null default now();
alter table public.contact_messages add column if not exists read_at timestamptz;
alter table public.contact_messages add column if not exists read_by uuid references public.profiles(id) on delete set null;
alter table public.contact_messages add column if not exists processed_at timestamptz;
alter table public.contact_messages add column if not exists processed_by uuid references public.profiles(id) on delete set null;
alter table public.contact_messages add column if not exists source_ip_hash text;

update public.contact_messages
set status = case status
  when 'unread' then 'new'
  when 'archived' then 'processed'
  when 'read' then 'read'
  when 'processed' then 'processed'
  when 'new' then 'new'
  else 'new'
end;

alter table public.contact_messages alter column status set default 'new';
alter table public.contact_messages drop constraint if exists contact_messages_status_check;
alter table public.contact_messages
  add constraint contact_messages_status_check
  check (status in ('new', 'read', 'processed'));

-- NOT VALID keeps pre-existing historical rows intact while enforcing these
-- checks on all messages created after this migration.
alter table public.contact_messages drop constraint if exists contact_messages_full_name_check;
alter table public.contact_messages
  add constraint contact_messages_full_name_check
  check (char_length(btrim(full_name)) between 2 and 160) not valid;

alter table public.contact_messages drop constraint if exists contact_messages_email_check;
alter table public.contact_messages
  add constraint contact_messages_email_check
  check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') not valid;

alter table public.contact_messages drop constraint if exists contact_messages_phone_check;
alter table public.contact_messages
  add constraint contact_messages_phone_check
  check (char_length(regexp_replace(phone, '\D', '', 'g')) between 8 and 20) not valid;

alter table public.contact_messages drop constraint if exists contact_messages_subject_check;
alter table public.contact_messages
  add constraint contact_messages_subject_check
  check (char_length(btrim(subject)) between 2 and 180) not valid;

alter table public.contact_messages drop constraint if exists contact_messages_message_check;
alter table public.contact_messages
  add constraint contact_messages_message_check
  check (char_length(btrim(message)) between 2 and 5000) not valid;

alter table public.contact_messages drop constraint if exists contact_messages_source_ip_hash_check;
alter table public.contact_messages
  add constraint contact_messages_source_ip_hash_check
  check (source_ip_hash is null or source_ip_hash ~ '^[a-f0-9]{64}$') not valid;

create index if not exists contact_messages_created_at_idx
  on public.contact_messages(created_at desc);
create index if not exists contact_messages_status_created_at_idx
  on public.contact_messages(status, created_at desc);

alter table public.contact_messages enable row level security;

-- Kept here so this migration remains self-contained for an existing
-- administration portal whose profiles table is already in place.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

-- Remove every policy inherited from an earlier setup before declaring the
-- exact access model below.
do $$
declare
  existing_policy text;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contact_messages'
  loop
    execute format('drop policy if exists %I on public.contact_messages', existing_policy);
  end loop;
end;
$$;

-- No anon/authenticated browser client may insert messages directly. The
-- public Express route validates, rate-limits and inserts with service_role.
revoke all on table public.contact_messages from anon, authenticated;
grant select, update, delete on table public.contact_messages to authenticated;

create policy contact_messages_admin_select
on public.contact_messages
for select
to authenticated
using (public.is_admin());

create policy contact_messages_admin_update
on public.contact_messages
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy contact_messages_admin_delete
on public.contact_messages
for delete
to authenticated
using (public.is_admin());

commit;
