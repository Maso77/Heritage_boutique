-- HERITAGE — source unique des coordonnées publiques
-- À exécuter après les migrations admin_portal et cms_completion.

begin;

create table if not exists public.site_settings (
  id boolean primary key default true check (id = true),
  business_name text not null default 'HERITAGE',
  email text,
  phone text,
  whatsapp_phone text,
  address text,
  hours text,
  social_links jsonb not null default '{}'::jsonb,
  structured_data_enabled boolean not null default false,
  footer_notices jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings add column if not exists whatsapp_phone text;
alter table public.site_settings add column if not exists business_name text not null default 'HERITAGE';
alter table public.site_settings add column if not exists email text;
alter table public.site_settings add column if not exists phone text;
alter table public.site_settings add column if not exists address text;
alter table public.site_settings add column if not exists hours text;
alter table public.site_settings add column if not exists social_links jsonb not null default '{}'::jsonb;
alter table public.site_settings add column if not exists structured_data_enabled boolean not null default false;
alter table public.site_settings add column if not exists footer_notices jsonb not null default '[]'::jsonb;
alter table public.site_settings add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();

update public.site_settings
set social_links = coalesce(social_links, '{}'::jsonb),
    footer_notices = coalesce(footer_notices, '[]'::jsonb);

alter table public.site_settings
  alter column social_links set default '{}'::jsonb,
  alter column social_links set not null,
  alter column footer_notices set default '[]'::jsonb,
  alter column footer_notices set not null;

insert into public.site_settings (
  id, business_name, social_links, footer_notices, structured_data_enabled
)
values (true, 'HERITAGE', '{}'::jsonb, '[]'::jsonb, false)
on conflict (id) do nothing;

create or replace function public.is_valid_http_url(candidate text)
returns boolean
language sql
immutable
as $$
  select candidate ~* '^https?://[^[:space:]]+$';
$$;

create or replace function public.site_settings_social_links_valid(links jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(
    jsonb_typeof(links) = 'object'
    and not exists (
      select 1
      from jsonb_each_text(links) as social(network, url)
      where social.network not in ('facebook', 'instagram', 'tiktok', 'x', 'youtube')
         or (btrim(social.url) <> '' and not public.is_valid_http_url(btrim(social.url)))
    ),
    false
  );
$$;

alter table public.site_settings drop constraint if exists site_settings_email_format_check;
alter table public.site_settings add constraint site_settings_email_format_check
  check (
    email is null
    or btrim(email) = ''
    or btrim(email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) not valid;

alter table public.site_settings drop constraint if exists site_settings_phone_format_check;
alter table public.site_settings add constraint site_settings_phone_format_check
  check (
    phone is null
    or btrim(phone) = ''
    or (
      phone ~ '^[0-9+(). -]+$'
      and length(regexp_replace(phone, '\D', '', 'g')) between 8 and 15
    )
  ) not valid;

alter table public.site_settings drop constraint if exists site_settings_whatsapp_phone_format_check;
alter table public.site_settings add constraint site_settings_whatsapp_phone_format_check
  check (
    whatsapp_phone is null
    or btrim(whatsapp_phone) = ''
    or (
      whatsapp_phone ~ '^[0-9+(). -]+$'
      and length(regexp_replace(whatsapp_phone, '\D', '', 'g')) between 8 and 15
    )
  ) not valid;

alter table public.site_settings drop constraint if exists site_settings_social_links_format_check;
alter table public.site_settings add constraint site_settings_social_links_format_check
  check (public.site_settings_social_links_valid(social_links)) not valid;

alter table public.site_settings enable row level security;

-- The singleton only contains deliberate public contact details. Reads are
-- public; all writes go through the server after it verifies an admin session.
drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read
  on public.site_settings for select
  using (true);

drop policy if exists settings_admin_write on public.site_settings;

commit;
