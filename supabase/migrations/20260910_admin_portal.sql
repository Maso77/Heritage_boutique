-- HERITAGE administration portal
-- Run this file once, in Supabase Dashboard > SQL Editor, as the project owner.
-- It creates the content model, row-level security and the one-hour admin invitations.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity and roles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null default '',
  phone text,
  commune text,
  delivery_address text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists commune text;
alter table public.profiles add column if not exists delivery_address text;
alter table public.profiles add column if not exists role text not null default 'customer';
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
update public.profiles set role = 'customer' where role is null or role not in ('customer', 'admin');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
     and current_user not in ('postgres', 'service_role')
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Le rôle ne peut être modifié que par le service d’administration.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
before update of role on public.profiles
for each row execute function public.prevent_profile_role_escalation();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'customer' end,
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- ---------------------------------------------------------------------------
-- Commerce data
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id text primary key default (gen_random_uuid())::text,
  name text not null,
  slug text not null unique,
  sku text unique,
  reference text unique,
  brand text,
  category text not null default 'montres',
  short_description text,
  description_html text,
  purchase_price_xof numeric(14,2) not null default 0 check (purchase_price_xof >= 0),
  regular_price_xof numeric(14,2) not null default 0 check (regular_price_xof >= 0),
  sale_price_xof numeric(14,2) check (sale_price_xof is null or sale_price_xof >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 2 check (low_stock_threshold >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  primary_media_id uuid,
  attributes jsonb not null default '{}'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  faq jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility with the earlier HERITAGE schema. These columns keep legacy
-- product records readable while the portal uses the richer columns above.
-- `create table if not exists` does not extend an already-existing table.
-- Keep this baseline before the constraint and RLS statements below so the
-- migration can also be run safely on the original storefront schema.
alter table public.products add column if not exists name text not null default '';
alter table public.products add column if not exists slug text not null default '';
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists reference text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists category text not null default 'montres';
alter table public.products add column if not exists short_description text;
alter table public.products add column if not exists description_html text;
alter table public.products add column if not exists purchase_price_xof numeric(14,2) not null default 0;
alter table public.products add column if not exists regular_price_xof numeric(14,2) not null default 0;
alter table public.products add column if not exists sale_price_xof numeric(14,2);
alter table public.products add column if not exists stock_quantity integer not null default 0;
alter table public.products add column if not exists low_stock_threshold integer not null default 2;
alter table public.products add column if not exists primary_media_id uuid;
alter table public.products add column if not exists attributes jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists colors jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists faq jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists seo_title text;
alter table public.products add column if not exists seo_description text;
alter table public.products add column if not exists status text not null default 'draft';
alter table public.products add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.products add column if not exists price_xof numeric(14,2) not null default 0;
alter table public.products add column if not exists stock_count integer not null default 0;
alter table public.products add column if not exists stock_status text not null default 'En stock';
alter table public.products add column if not exists primary_image text not null default '';

do $$
begin
  if (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'id') = 'text' then
    alter table public.products alter column id set default (gen_random_uuid())::text;
  end if;
end;
$$;

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check check (status in ('draft', 'published', 'archived'));

update public.products
set regular_price_xof = coalesce(regular_price_xof, price_xof, 0),
    stock_quantity = coalesce(stock_quantity, stock_count, 0),
    price_xof = coalesce(price_xof, regular_price_xof, 0),
    stock_count = coalesce(stock_count, stock_quantity, 0),
    primary_image = coalesce(primary_image, '');

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  name text not null,
  sku text unique,
  options jsonb not null default '{}'::jsonb,
  purchase_price_xof numeric(14,2) check (purchase_price_xof is null or purchase_price_xof >= 0),
  sale_price_xof numeric(14,2) check (sale_price_xof is null or sale_price_xof >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket_path text not null unique,
  public_url text not null,
  file_name text not null,
  mime_type text not null,
  alt_text text not null default '',
  size_bytes bigint,
  product_id text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.products
  drop constraint if exists products_primary_media_id_fkey;
alter table public.products
  add constraint products_primary_media_id_fkey
  foreign key (primary_media_id) references public.media_assets(id) on delete set null;

-- Existing installations already have these two tables. They are declared
-- here as well so a fresh Supabase project receives a complete portal model.
create table if not exists public.orders (
  id text primary key,
  order_number text unique not null,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_commune text not null,
  customer_delivery_address text not null,
  customer_notes text,
  delivery_mode text not null default 'livraison_abidjan',
  status text not null default 'pending_payment',
  subtotal_xof numeric not null,
  delivery_cost_xof numeric not null default 0,
  total_xof numeric not null,
  payment_method text not null,
  payment_reference text,
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product_id text,
  product_sku text,
  product_name text not null,
  product_reference text,
  quantity integer not null default 1 check (quantity > 0),
  price_xof numeric not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  author_email text,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Editorial and site content
-- ---------------------------------------------------------------------------
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content_html text not null default '',
  cover_media_id uuid references public.media_assets(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  placement text not null default 'all' check (placement in ('home', 'catalog', 'contact', 'all')),
  question text not null,
  answer_html text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_pages (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique check (page_key in ('mentions-legales', 'cgv', 'confidentialite', 'livraison-retours', 'cookies')),
  title text not null,
  content_html text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.page_meta (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique,
  title text not null,
  description text not null,
  og_title text,
  og_description text,
  no_index boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id boolean primary key default true check (id = true),
  business_name text not null default 'HERITAGE',
  email text,
  phone text,
  address text,
  hours text,
  social_links jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.tracking_pixels (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('meta', 'google_ads', 'google_analytics', 'custom')),
  label text not null,
  pixel_id text,
  script_code text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Administrators and one-hour invitations
-- ---------------------------------------------------------------------------
create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '1 hour')
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Timestamps
-- ---------------------------------------------------------------------------
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'products', 'product_variants', 'product_reviews', 'blog_posts',
    'faqs', 'legal_pages', 'page_meta', 'tracking_pixels'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security. The browser only reads public published content.
-- Every administrative write goes through the verified server API.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.product_variants enable row level security;
alter table public.media_assets enable row level security;
alter table public.product_reviews enable row level security;
alter table public.blog_posts enable row level security;
alter table public.faqs enable row level security;
alter table public.legal_pages enable row level security;
alter table public.page_meta enable row level security;
alter table public.site_settings enable row level security;
alter table public.tracking_pixels enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Remove the permissive policies included with the earlier prototype. The
-- browser has no administrative database write path; the server service key
-- bypasses RLS only after it verifies an administrator's session.
drop policy if exists "Public can view basic profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Anyone can view published products" on public.products;
drop policy if exists "Service role manages products" on public.products;
drop policy if exists "Anyone can create orders" on public.orders;
drop policy if exists "Users can view their orders" on public.orders;
drop policy if exists "Service role manages orders" on public.orders;
drop policy if exists "Anyone can insert order items" on public.order_items;
drop policy if exists "Users can view order items" on public.order_items;

-- Customers can submit an order, then only the authenticated owner can read it.
-- There is intentionally no browser update policy for orders or order items.
drop policy if exists orders_create on public.orders;
create policy orders_create on public.orders
for insert to anon, authenticated with check (true);
drop policy if exists orders_read_owner on public.orders;
create policy orders_read_owner on public.orders
for select to authenticated using (
  auth.uid() = user_id or auth.jwt() ->> 'email' = customer_email
);
drop policy if exists order_items_create on public.order_items;
create policy order_items_create on public.order_items
for insert to anon, authenticated with check (true);
drop policy if exists order_items_read_owner on public.order_items;
create policy order_items_read_owner on public.order_items
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (auth.uid() = o.user_id or auth.jwt() ->> 'email' = o.customer_email)
  )
);

drop policy if exists profiles_read_own_or_admin on public.profiles;
create policy profiles_read_own_or_admin on public.profiles
for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
for update to authenticated using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
for select using (status = 'published');
drop policy if exists products_admin_write on public.products;

drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read on public.product_variants
for select using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
drop policy if exists variants_admin_write on public.product_variants;

drop policy if exists media_public_read on public.media_assets;
create policy media_public_read on public.media_assets for select using (true);
drop policy if exists media_admin_write on public.media_assets;

drop policy if exists reviews_public_read on public.product_reviews;
create policy reviews_public_read on public.product_reviews
for select using (status = 'approved' or author_id = auth.uid());
drop policy if exists reviews_admin_write on public.product_reviews;

drop policy if exists blogs_public_read on public.blog_posts;
create policy blogs_public_read on public.blog_posts
for select using (status = 'published');
drop policy if exists blogs_admin_write on public.blog_posts;

drop policy if exists faqs_public_read on public.faqs;
create policy faqs_public_read on public.faqs for select using (is_active);
drop policy if exists faqs_admin_write on public.faqs;

drop policy if exists legal_public_read on public.legal_pages;
create policy legal_public_read on public.legal_pages for select using (true);
drop policy if exists legal_admin_write on public.legal_pages;

drop policy if exists meta_public_read on public.page_meta;
create policy meta_public_read on public.page_meta for select using (true);
drop policy if exists meta_admin_write on public.page_meta;

drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings for select using (true);
drop policy if exists settings_admin_write on public.site_settings;

drop policy if exists pixels_admin_only on public.tracking_pixels;

drop policy if exists invitations_admin_only on public.admin_invitations;

drop policy if exists audit_admin_only on public.admin_audit_logs;

-- Supabase Storage bucket used by the media library. Files are public only
-- after an administrator has uploaded them through the secured API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'heritage-media', 'heritage-media', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists heritage_media_public_read on storage.objects;
create policy heritage_media_public_read on storage.objects
for select using (bucket_id = 'heritage-media');
drop policy if exists heritage_media_admin_insert on storage.objects;
drop policy if exists heritage_media_admin_update on storage.objects;
drop policy if exists heritage_media_admin_delete on storage.objects;

commit;
