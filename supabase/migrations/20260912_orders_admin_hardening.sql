-- HERITAGE — commandes, snapshots et journalisation admin
-- À exécuter après :
--   20260910_admin_portal.sql
--   20260911_cms_completion.sql
--   20260912_product_catalog_hardening.sql
-- Cette migration est réexécutable et conserve les commandes existantes.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Compatibilité avec les commandes créées par les versions antérieures
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists shipping_address text;
alter table public.orders add column if not exists commune text;
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists delivery_reference text;
alter table public.orders add column if not exists delivery_proof_url text;
alter table public.orders alter column customer_delivery_address drop not null;

-- Certaines installations antérieures utilisaient une table `order_items`
-- minimale. Toutes les colonnes lues et écrites par le serveur sont ajoutées
-- avant toute normalisation, y compris `price_xof`.
alter table public.order_items add column if not exists product_id text;
alter table public.order_items add column if not exists product_sku text;
alter table public.order_items add column if not exists product_name text;
alter table public.order_items add column if not exists product_reference text;
alter table public.order_items add column if not exists product_ref text;
alter table public.order_items add column if not exists quantity integer;
alter table public.order_items add column if not exists price_xof numeric;
alter table public.order_items add column if not exists unit_price_xof numeric;
alter table public.order_items add column if not exists image_url text;
alter table public.order_items add column if not exists variant_label text;

-- Copier des valeurs d'anciennes colonnes éventuelles, sans jamais supposer
-- leur existence. Cela évite qu'un schéma prototype bloque cette migration.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'price'
  ) then
    execute 'update public.order_items set price_xof = coalesce(price_xof, round(price::numeric)) where price_xof is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'unit_price'
  ) then
    execute 'update public.order_items set price_xof = coalesce(price_xof, round(unit_price::numeric)) where price_xof is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'name'
  ) then
    execute 'update public.order_items set product_name = coalesce(nullif(product_name, ''''), name::text) where product_name is null or product_name = ''''';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'sku'
  ) then
    execute 'update public.order_items set product_sku = coalesce(nullif(product_sku, ''''), sku::text) where product_sku is null or product_sku = ''''';
  end if;
end;
$$;

-- Retirer d'abord d'éventuelles contraintes héritées afin de pouvoir
-- normaliser les anciens libellés sans interrompre la migration.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders drop constraint if exists orders_delivery_mode_check;

update public.orders
set status = case lower(trim(coalesce(status, '')))
  when 'pending' then 'pending_payment'
  when 'new' then 'pending_payment'
  when 'payment_pending' then 'payment_pending'
  when 'pending_payment' then 'pending_payment'
  when 'paid' then 'paid'
  when 'processing' then 'processing'
  when 'shipped' then 'shipped_or_ready'
  when 'ready' then 'shipped_or_ready'
  when 'shipped_or_ready' then 'shipped_or_ready'
  when 'delivered' then 'delivered'
  when 'cancelled' then 'cancelled'
  when 'canceled' then 'cancelled'
  when 'refunded' then 'refunded'
  when 'payment_failed' then 'payment_failed'
  else 'pending_payment'
end
where status is null
   or lower(trim(status)) not in (
     'pending_payment', 'payment_pending', 'paid', 'processing',
     'shipped_or_ready', 'delivered', 'cancelled', 'refunded', 'payment_failed'
   );

update public.orders
set delivery_mode = case
  when lower(trim(coalesce(delivery_mode, ''))) in ('retrait_yopougon', 'retrait', 'pickup') then 'retrait_yopougon'
  else 'livraison_abidjan'
end
where delivery_mode is null
   or lower(trim(delivery_mode)) not in ('livraison_abidjan', 'retrait_yopougon');

-- Une ancienne ligne « livrée » sans trace de remise est remise au statut
-- « prête / expédiée » : aucune preuve n'est inventée pendant la migration.
update public.orders
set status = 'shipped_or_ready'
where status = 'delivered'
  and nullif(trim(coalesce(delivery_reference, '')), '') is null
  and nullif(trim(coalesce(delivery_proof_url, '')), '') is null;

update public.order_items
set unit_price_xof = round(coalesce(unit_price_xof, price_xof, 0)),
    product_ref = coalesce(nullif(product_ref, ''), nullif(product_reference, ''), nullif(product_sku, ''))
where unit_price_xof is null or product_ref is null;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'pending_payment', 'payment_pending', 'paid', 'processing',
    'shipped_or_ready', 'delivered', 'cancelled', 'refunded', 'payment_failed'
  ));
alter table public.orders drop constraint if exists orders_delivery_mode_check;
alter table public.orders add constraint orders_delivery_mode_check
  check (delivery_mode in ('livraison_abidjan', 'retrait_yopougon'));
alter table public.orders drop constraint if exists orders_amounts_are_integers;
alter table public.orders add constraint orders_amounts_are_integers
  check (
    subtotal_xof >= 0 and delivery_cost_xof >= 0 and total_xof >= 0
    and subtotal_xof = trunc(subtotal_xof)
    and delivery_cost_xof = trunc(delivery_cost_xof)
    and total_xof = trunc(total_xof)
  ) not valid;
alter table public.order_items drop constraint if exists order_items_unit_price_is_integer;
alter table public.order_items add constraint order_items_unit_price_is_integer
  check (unit_price_xof is null or (unit_price_xof >= 0 and unit_price_xof = trunc(unit_price_xof))) not valid;
alter table public.orders drop constraint if exists orders_delivery_proof_url_check;
alter table public.orders add constraint orders_delivery_proof_url_check
  check (delivery_proof_url is null or delivery_proof_url ~ '^https?://') not valid;

-- ---------------------------------------------------------------------------
-- Journal immuable des changements de statut
-- ---------------------------------------------------------------------------
create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  status text not null check (status in (
    'pending_payment', 'payment_pending', 'paid', 'processing',
    'shipped_or_ready', 'delivered', 'cancelled', 'refunded', 'payment_failed'
  )),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null default 'Système',
  source text not null default 'system' check (source in ('customer', 'administrator', 'system')),
  note text,
  delivery_reference text,
  delivery_proof_url text,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_desc_idx on public.orders(created_at desc);
create index if not exists orders_status_created_at_idx on public.orders(status, created_at desc);
create index if not exists orders_customer_email_created_at_idx on public.orders(customer_email, created_at desc);
create index if not exists orders_customer_name_idx on public.orders(customer_name);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_status_events_order_created_at_idx on public.order_status_events(order_id, created_at desc);

-- Les commandes précédentes gardent au moins un événement consultable.
insert into public.order_status_events (order_id, status, actor_name, source, note, created_at)
select o.id, o.status, 'Historique importé', 'system', 'État de commande existant importé.', coalesce(o.updated_at, o.created_at, now())
from public.orders o
where not exists (
  select 1 from public.order_status_events event where event.order_id = o.id
);

-- Une remise marquée « delivered » doit toujours être traçable, même en cas
-- d'appel SQL direct. L'API admin applique la même règle avant cette barrière.
create or replace function public.require_delivery_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'delivered'
     and nullif(trim(coalesce(new.delivery_reference, '')), '') is null
     and nullif(trim(coalesce(new.delivery_proof_url, '')), '') is null then
    raise exception 'Une référence ou une preuve de remise est obligatoire pour le statut delivered.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_require_delivery_evidence on public.orders;
create trigger orders_require_delivery_evidence
before insert or update of status, delivery_reference, delivery_proof_url on public.orders
for each row execute function public.require_delivery_evidence();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : aucune écriture directe depuis le navigateur.
-- Le passage en caisse validé et le portail admin appellent l'API Express,
-- laquelle utilise service_role uniquement après vérification de la session.
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_events enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('orders', 'order_items', 'order_status_events')
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end;
$$;

revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.order_status_events from anon, authenticated;

-- Les clients connectés peuvent uniquement lire leurs propres commandes ;
-- l'administration authentifiée est couverte par les politiques explicites.
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
grant select on table public.order_status_events to authenticated;

create policy orders_select_owner_or_admin
on public.orders
for select to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy order_items_select_owner_or_admin
on public.order_items
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  )
);

create policy order_status_events_select_admin
on public.order_status_events
for select to authenticated
using (public.is_admin());

commit;
