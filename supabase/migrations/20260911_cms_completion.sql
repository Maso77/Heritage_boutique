-- HERITAGE CMS completion
-- Run after 20260910_admin_portal.sql in Supabase SQL Editor.
-- This migration is additive: it preserves all existing accounts and content.

begin;

-- ---------------------------------------------------------------------------
-- Commerce: complete product, media, stock and order data
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists last_signed_in_at timestamptz;

-- `products` also existed before the CMS schema on the production project.
-- Add the fields referenced by the public RLS policy and dashboard indexes
-- before they are used below.
alter table public.products add column if not exists category text not null default 'montres';
alter table public.products add column if not exists status text not null default 'draft';
alter table public.products add column if not exists value_story_title text;
alter table public.products add column if not exists value_story_text text;
alter table public.products add column if not exists provenance_summary text;
alter table public.products add column if not exists warranty_summary text;
alter table public.products add column if not exists delivery_summary text;
alter table public.products add column if not exists stock_policy text not null default 'standard';
alter table public.products add column if not exists gallery_images jsonb not null default '[]'::jsonb;
alter table public.products drop constraint if exists products_stock_policy_check;
alter table public.products add constraint products_stock_policy_check
  check (stock_policy in ('standard', 'on_order'));

alter table public.media_assets add column if not exists folder text not null default 'general';
alter table public.media_assets add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.media_assets add column if not exists sort_order integer not null default 0;
alter table public.media_assets add column if not exists is_ai_generated boolean not null default false;
alter table public.media_assets add column if not exists width integer;
alter table public.media_assets add column if not exists height integer;

create table if not exists public.product_media (
  product_id text not null references public.products(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  primary key (product_id, media_id)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null check (reason in ('initial', 'adjustment', 'sale', 'return', 'correction')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists delivery_reference text;
alter table public.orders add column if not exists delivery_proof_url text;

-- ---------------------------------------------------------------------------
-- Reviews, editorial content and client messages
-- ---------------------------------------------------------------------------
-- Some early HERITAGE installations already contained these tables before the
-- portal migration. `create table if not exists` deliberately keeps those
-- rows, but does not add the newer columns.  Add the complete baseline here
-- before policies and indexes reference it.  This makes the migration safe to
-- re-run on both a fresh project and the legacy project.
alter table public.product_reviews add column if not exists product_id text;
alter table public.product_reviews add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.product_reviews add column if not exists author_name text not null default '';
alter table public.product_reviews add column if not exists author_email text;
alter table public.product_reviews add column if not exists rating integer not null default 5;
alter table public.product_reviews add column if not exists title text;
alter table public.product_reviews add column if not exists body text not null default '';
alter table public.product_reviews add column if not exists status text not null default 'pending';
alter table public.product_reviews add column if not exists created_at timestamptz not null default now();
alter table public.product_reviews add column if not exists updated_at timestamptz not null default now();
alter table public.product_reviews add column if not exists verified_purchase boolean not null default false;
alter table public.product_reviews add column if not exists manually_validated boolean not null default false;
alter table public.product_reviews add column if not exists is_featured_home boolean not null default false;
alter table public.product_reviews add column if not exists is_featured_contact boolean not null default false;
alter table public.product_reviews add column if not exists merchant_response text;
alter table public.product_reviews add column if not exists responded_at timestamptz;
alter table public.product_reviews add column if not exists responded_by uuid references public.profiles(id) on delete set null;

alter table public.blog_posts add column if not exists title text not null default '';
alter table public.blog_posts add column if not exists slug text not null default '';
alter table public.blog_posts add column if not exists excerpt text;
alter table public.blog_posts add column if not exists content_html text not null default '';
alter table public.blog_posts add column if not exists status text not null default 'draft';
alter table public.blog_posts add column if not exists published_at timestamptz;
alter table public.blog_posts add column if not exists author_id uuid references public.profiles(id) on delete set null;
alter table public.blog_posts add column if not exists seo_title text;
alter table public.blog_posts add column if not exists seo_description text;
alter table public.blog_posts add column if not exists created_at timestamptz not null default now();
alter table public.blog_posts add column if not exists updated_at timestamptz not null default now();
alter table public.blog_posts add column if not exists category text;
alter table public.blog_posts add column if not exists cover_image text;
alter table public.blog_posts add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.blog_posts add column if not exists related_product_ids jsonb not null default '[]'::jsonb;
alter table public.blog_posts drop constraint if exists blog_posts_status_check;
alter table public.blog_posts add constraint blog_posts_status_check
  check (status in ('draft', 'scheduled', 'published', 'archived'));

alter table public.faqs add column if not exists placement text not null default 'all';
alter table public.faqs add column if not exists question text not null default '';
alter table public.faqs add column if not exists answer_html text not null default '';
alter table public.faqs add column if not exists sort_order integer not null default 0;
alter table public.faqs add column if not exists is_active boolean not null default true;
alter table public.faqs add column if not exists created_at timestamptz not null default now();
alter table public.faqs add column if not exists updated_at timestamptz not null default now();
alter table public.faqs add column if not exists category text;
alter table public.faqs add column if not exists placements jsonb not null default '[]'::jsonb;
update public.faqs
set placements = case placement
  when 'all' then '["home", "catalog", "contact"]'::jsonb
  when 'catalog' then '["catalog"]'::jsonb
  when 'home' then '["home"]'::jsonb
  when 'contact' then '["contact"]'::jsonb
  else '[]'::jsonb
end
where placements = '[]'::jsonb;

alter table public.legal_pages add column if not exists status text not null default 'draft';
alter table public.legal_pages add column if not exists published_at timestamptz;
alter table public.legal_pages drop constraint if exists legal_pages_status_check;
alter table public.legal_pages add constraint legal_pages_status_check check (status in ('draft', 'published'));
alter table public.legal_pages drop constraint if exists legal_pages_page_key_check;
alter table public.legal_pages add constraint legal_pages_page_key_check check (page_key in ('mentions-legales', 'cgv', 'confidentialite', 'livraison-retours', 'garantie-service', 'authenticite-provenance', 'cookies'));

alter table public.page_meta add column if not exists og_media_id uuid references public.media_assets(id) on delete set null;

alter table public.site_settings add column if not exists whatsapp_phone text;
alter table public.site_settings add column if not exists structured_data_enabled boolean not null default false;
-- Empty by default: no trust, warranty or delivery promise is displayed until
-- the business explicitly enters and validates it in the administration portal.
alter table public.site_settings add column if not exists footer_notices jsonb not null default '[]'::jsonb;

alter table public.tracking_pixels add column if not exists requires_consent boolean not null default true;
alter table public.tracking_pixels add column if not exists is_test boolean not null default false;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  subject text not null,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  read_by uuid references public.profiles(id) on delete set null
);

-- Preserve messages recorded by an earlier contact form while completing the
-- fields the CMS uses for filtering and moderation.
alter table public.contact_messages add column if not exists full_name text not null default '';
alter table public.contact_messages add column if not exists email text not null default '';
alter table public.contact_messages add column if not exists phone text not null default '';
alter table public.contact_messages add column if not exists subject text not null default '';
alter table public.contact_messages add column if not exists message text not null default '';
alter table public.contact_messages add column if not exists status text not null default 'unread';
alter table public.contact_messages add column if not exists created_at timestamptz not null default now();
alter table public.contact_messages add column if not exists read_at timestamptz;
alter table public.contact_messages add column if not exists read_by uuid references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Publication and RLS. Public visitors can only read content that is published.
-- Administrative mutations remain server-only through the verified Express API.
-- ---------------------------------------------------------------------------
alter table public.product_media enable row level security;
alter table public.stock_movements enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists legal_public_read on public.legal_pages;
create policy legal_public_read on public.legal_pages
for select using (status = 'published');

drop policy if exists reviews_public_read on public.product_reviews;
create policy reviews_public_read on public.product_reviews
for select using (
  (status = 'approved' and (verified_purchase = true or manually_validated = true))
  or author_id = auth.uid()
);

drop policy if exists blogs_public_read on public.blog_posts;
create policy blogs_public_read on public.blog_posts
for select using (
  status = 'published'
  and (published_at is null or published_at <= now())
);

drop policy if exists product_media_public_read on public.product_media;
create policy product_media_public_read on public.product_media
for select using (exists (
  select 1 from public.products p where p.id = product_id and p.status = 'published'
));

-- The dashboard needs fast, deterministic filters without exposing these rows
-- to browser clients.
create index if not exists products_status_category_idx on public.products(status, category);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists product_reviews_status_idx on public.product_reviews(status, created_at desc);
create index if not exists contact_messages_status_idx on public.contact_messages(status, created_at desc);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id, created_at desc);

commit;
