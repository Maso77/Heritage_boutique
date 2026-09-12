-- HERITAGE – catalogue administré et publication sûre
-- À exécuter après 20260910_admin_portal.sql et 20260911_cms_completion.sql.
-- Cette migration conserve les produits existants, normalise les valeurs
-- incompatibles et dépublie uniquement les fiches sans galerie conforme.

begin;

-- ---------------------------------------------------------------------------
-- Normalisation des données historiques
-- ---------------------------------------------------------------------------
update public.products
set category = case
  when lower(trim(coalesce(category, ''))) like 'parfum%' then 'parfums'
  when lower(trim(coalesce(category, ''))) like 'lunett%' then 'lunettes'
  else 'montres'
end
where category is null or lower(trim(category)) not in ('montres', 'parfums', 'lunettes');

update public.products
set purchase_price_xof = greatest(0, round(coalesce(purchase_price_xof, 0))),
    regular_price_xof = greatest(0, round(coalesce(regular_price_xof, price_xof, 0))),
    stock_quantity = greatest(0, round(coalesce(stock_quantity, stock_count, 0)))::integer,
    low_stock_threshold = greatest(0, round(coalesce(low_stock_threshold, 2)))::integer;

update public.products
set sale_price_xof = null
where sale_price_xof is not null
  and (sale_price_xof <= 0 or sale_price_xof >= regular_price_xof);

update public.products
set sale_price_xof = round(sale_price_xof)
where sale_price_xof is not null;

update public.product_variants
set purchase_price_xof = case when purchase_price_xof is null then null else greatest(0, round(purchase_price_xof)) end,
    sale_price_xof = case when sale_price_xof is null then null else greatest(0, round(sale_price_xof)) end,
    stock_quantity = greatest(0, coalesce(stock_quantity, 0));

-- Backfill the canonical gallery relation from a legacy primary media ID.
insert into public.product_media (product_id, media_id, position)
select p.id, p.primary_media_id, 0
from public.products p
join public.media_assets m on m.id = p.primary_media_id
where p.primary_media_id is not null
on conflict (product_id, media_id) do nothing;

update public.media_assets m
set product_id = pm.product_id
from public.product_media pm
where pm.media_id = m.id
  and m.product_id is null;

-- A published product must use a real, described, non-AI primary image.
-- Invalid legacy publications are made private until fixed in the portal.
update public.products p
set status = 'draft'
where p.status = 'published'
  and (
    p.primary_media_id is null
    or not exists (
      select 1
      from public.product_media pm
      join public.media_assets m on m.id = pm.media_id
      where pm.product_id = p.id
        and pm.media_id = p.primary_media_id
        and m.is_ai_generated = false
        and nullif(btrim(m.alt_text), '') is not null
    )
    or exists (
      select 1
      from public.product_media pm
      join public.media_assets m on m.id = pm.media_id
      where pm.product_id = p.id
        and (m.is_ai_generated = true or nullif(btrim(m.alt_text), '') is null)
    )
  );

-- ---------------------------------------------------------------------------
-- Product and variant integrity. Prices remain integer FCFA/XOF values.
-- ---------------------------------------------------------------------------
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('montres', 'parfums', 'lunettes'));

alter table public.products drop constraint if exists products_purchase_xof_integer_check;
alter table public.products add constraint products_purchase_xof_integer_check
  check (purchase_price_xof = trunc(purchase_price_xof) and purchase_price_xof >= 0);

alter table public.products drop constraint if exists products_regular_xof_integer_check;
alter table public.products add constraint products_regular_xof_integer_check
  check (regular_price_xof = trunc(regular_price_xof) and regular_price_xof >= 0);

alter table public.products drop constraint if exists products_sale_xof_integer_check;
alter table public.products add constraint products_sale_xof_integer_check
  check (sale_price_xof is null or (sale_price_xof = trunc(sale_price_xof) and sale_price_xof > 0));

alter table public.products drop constraint if exists products_sale_price_rule_check;
alter table public.products add constraint products_sale_price_rule_check
  check (sale_price_xof is null or sale_price_xof < regular_price_xof);

alter table public.product_variants drop constraint if exists product_variants_purchase_xof_integer_check;
alter table public.product_variants add constraint product_variants_purchase_xof_integer_check
  check (purchase_price_xof is null or (purchase_price_xof = trunc(purchase_price_xof) and purchase_price_xof >= 0));

alter table public.product_variants drop constraint if exists product_variants_sale_xof_integer_check;
alter table public.product_variants add constraint product_variants_sale_xof_integer_check
  check (sale_price_xof is null or (sale_price_xof = trunc(sale_price_xof) and sale_price_xof >= 0));

create index if not exists products_catalogue_admin_idx
  on public.products (status, category, updated_at desc);
create index if not exists products_brand_idx
  on public.products (brand);
create index if not exists products_stock_idx
  on public.products (stock_quantity, low_stock_threshold);
create index if not exists product_media_product_position_idx
  on public.product_media (product_id, position);
create index if not exists product_variants_product_idx
  on public.product_variants (product_id, is_active);

-- ---------------------------------------------------------------------------
-- Database safeguards for direct SQL or future server routes.
-- ---------------------------------------------------------------------------
create or replace function public.assert_product_media_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asset record;
begin
  select id, alt_text, is_ai_generated into asset
  from public.media_assets
  where id = new.media_id;

  if not found
    or asset.is_ai_generated
    or nullif(btrim(coalesce(asset.alt_text, '')), '') is null then
    raise exception 'Une image de galerie doit être une photo non IA avec un texte alternatif.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists product_media_asset_guard on public.product_media;
create trigger product_media_asset_guard
before insert or update of media_id on public.product_media
for each row execute function public.assert_product_media_asset();

create or replace function public.assert_published_product_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' then
    if nullif(btrim(coalesce(new.name, '')), '') is null
      or new.category not in ('montres', 'parfums', 'lunettes')
      or coalesce(new.regular_price_xof, 0) <= 0
      or new.primary_media_id is null then
      raise exception 'Un produit publié requiert un nom, une catégorie, un prix normal et une image principale.'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.product_media pm
      join public.media_assets m on m.id = pm.media_id
      where pm.product_id = new.id
        and pm.media_id = new.primary_media_id
        and m.is_ai_generated = false
        and nullif(btrim(m.alt_text), '') is not null
    ) then
      raise exception 'L’image principale publiée doit appartenir à la galerie, posséder un texte alternatif et ne pas être générée par IA.'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.product_media pm
      join public.media_assets m on m.id = pm.media_id
      where pm.product_id = new.id
        and (m.is_ai_generated = true or nullif(btrim(m.alt_text), '') is null)
    ) then
      raise exception 'Toutes les images de la galerie publiée doivent posséder un texte alternatif et ne pas être générées par IA.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists products_publication_guard on public.products;
create trigger products_publication_guard
before insert or update of status, name, category, regular_price_xof, sale_price_xof, primary_media_id
on public.products
for each row execute function public.assert_published_product_ready();

-- ---------------------------------------------------------------------------
-- RLS: the browser can only read public catalogue data. All administration
-- uses the verified Express API with the Supabase service-role key.
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_media enable row level security;
alter table public.media_assets enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
for select to anon, authenticated
using (status = 'published');

drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read on public.product_variants
for select to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_id and p.status = 'published'
  )
);

drop policy if exists product_media_public_read on public.product_media;
create policy product_media_public_read on public.product_media
for select to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_id and p.status = 'published'
  )
);

drop policy if exists media_public_read on public.media_assets;
create policy media_public_read on public.media_assets
for select to anon, authenticated
using (
  exists (
    select 1
    from public.product_media pm
    join public.products p on p.id = pm.product_id
    where pm.media_id = public.media_assets.id and p.status = 'published'
  )
  or exists (
    select 1 from public.products p
    where p.primary_media_id = public.media_assets.id and p.status = 'published'
  )
  or exists (
    select 1 from public.blog_posts b
    where b.cover_media_id = public.media_assets.id and b.status = 'published'
  )
  or exists (
    select 1 from public.page_meta pm where pm.og_media_id = public.media_assets.id
  )
);

-- No INSERT, UPDATE or DELETE policy is deliberately granted to anon or
-- authenticated clients on catalogue tables. The service role bypasses RLS
-- only after server.ts verifies an active administrator session.
drop policy if exists products_admin_write on public.products;
drop policy if exists variants_admin_write on public.product_variants;
drop policy if exists media_admin_write on public.media_assets;
drop policy if exists product_media_admin_write on public.product_media;
drop policy if exists stock_movements_admin_write on public.stock_movements;

commit;
