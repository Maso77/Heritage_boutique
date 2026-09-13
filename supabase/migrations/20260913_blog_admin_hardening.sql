-- HERITAGE — Blogs administration and public publication hardening
-- Execute this migration once in the Supabase SQL Editor.

begin;

-- Compatibility with the initial CMS migration and with older databases.
alter table public.blog_posts add column if not exists category text;
alter table public.blog_posts add column if not exists cover_image text;
alter table public.blog_posts add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.blog_posts add column if not exists related_product_ids jsonb not null default '[]'::jsonb;
alter table public.blog_posts add column if not exists seo_title text;
alter table public.blog_posts add column if not exists seo_description text;
alter table public.blog_posts add column if not exists author_id uuid references public.profiles(id) on delete set null;
alter table public.blog_posts add column if not exists published_at timestamptz;

-- Keep legacy records valid before the JSONB indexes are created.
update public.blog_posts set tags = '[]'::jsonb where tags is null or jsonb_typeof(tags) <> 'array';
update public.blog_posts set related_product_ids = '[]'::jsonb where related_product_ids is null or jsonb_typeof(related_product_ids) <> 'array';

alter table public.blog_posts drop constraint if exists blog_posts_status_check;
alter table public.blog_posts add constraint blog_posts_status_check
  check (status in ('draft', 'scheduled', 'published', 'archived'));

create index if not exists blog_posts_publication_idx
  on public.blog_posts (status, published_at desc, updated_at desc);
create index if not exists blog_posts_category_idx
  on public.blog_posts (category, updated_at desc);
create index if not exists blog_posts_tags_gin_idx
  on public.blog_posts using gin (tags);

-- The browser may only read an article once it is effectively public. The
-- administrative Express API uses the server-side service role after it has
-- verified an administrator session, so it is not granted through browser RLS.
alter table public.blog_posts enable row level security;
drop policy if exists blogs_public_read on public.blog_posts;
create policy blogs_public_read on public.blog_posts
for select
to anon, authenticated
using (
  (status = 'published' and (published_at is null or published_at <= now()))
  or (status = 'scheduled' and published_at <= now())
);

commit;
