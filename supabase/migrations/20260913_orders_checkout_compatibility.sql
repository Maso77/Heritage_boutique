-- HERITAGE — réparation ciblée du passage en caisse
-- À exécuter une seule fois dans le SQL Editor Supabase lorsque l'ancienne
-- table orders impose delivery_address et/ou total_amount.
-- Cette migration est sans suppression et peut être relancée sans doublon.

begin;

-- Colonnes canoniques utilisées par le serveur de commande actuel. Elles
-- sont ajoutées lorsqu'une ancienne table `orders` existait déjà avant les
-- migrations du portail.
alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists customer_commune text;
alter table public.orders add column if not exists customer_delivery_address text;
alter table public.orders add column if not exists customer_notes text;
alter table public.orders add column if not exists delivery_mode text;
alter table public.orders add column if not exists status text;
alter table public.orders add column if not exists subtotal_xof numeric;
alter table public.orders add column if not exists delivery_cost_xof numeric;
alter table public.orders add column if not exists total_xof numeric;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists status_history jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists shipping_address text;
alter table public.orders add column if not exists commune text;
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists total_amount numeric;
alter table public.orders add column if not exists delivery_reference text;
alter table public.orders add column if not exists delivery_proof_url text;

-- Les deux champs vus dans l'erreur étaient obligatoires dans une version
-- antérieure. Un retrait n'a pas d'adresse client à inventer : on relâche la
-- contrainte historique, tandis que l'API enregistre son point de retrait.
alter table public.orders alter column customer_delivery_address drop not null;
alter table public.orders alter column delivery_address drop not null;
alter table public.orders alter column shipping_address drop not null;
alter table public.orders alter column total_amount drop not null;

-- Complète les colonnes miroir pour les éventuelles commandes historiques,
-- sans modifier un montant déjà présent.
update public.orders
set customer_delivery_address = coalesce(
      nullif(btrim(customer_delivery_address), ''),
      nullif(btrim(delivery_address), ''),
      nullif(btrim(shipping_address), '')
    ),
    delivery_address = coalesce(
      nullif(btrim(delivery_address), ''),
      nullif(btrim(customer_delivery_address), ''),
      nullif(btrim(shipping_address), '')
    ),
    shipping_address = coalesce(
      nullif(btrim(shipping_address), ''),
      nullif(btrim(customer_delivery_address), ''),
      nullif(btrim(delivery_address), '')
    ),
    subtotal_xof = coalesce(subtotal_xof, 0),
    delivery_cost_xof = coalesce(delivery_cost_xof, 0),
    total_xof = coalesce(total_xof, total_amount, subtotal_xof, 0),
    total_amount = coalesce(total_amount, total_xof, subtotal_xof, 0),
    delivery_mode = coalesce(nullif(btrim(delivery_mode), ''), 'livraison_abidjan'),
    status = coalesce(nullif(btrim(status), ''), 'pending_payment'),
    status_history = coalesce(status_history, '[]'::jsonb);

alter table public.orders alter column delivery_mode set default 'livraison_abidjan';
alter table public.orders alter column status set default 'pending_payment';
alter table public.orders alter column delivery_cost_xof set default 0;
alter table public.orders alter column status_history set default '[]'::jsonb;

-- Le détail des articles est créé juste après la commande. Ces colonnes
-- couvrent les deux schémas d'articles connus (price_xof / unit_price_xof).
alter table public.order_items add column if not exists product_id text;
alter table public.order_items add column if not exists product_sku text;
alter table public.order_items add column if not exists product_name text;
alter table public.order_items add column if not exists title text;
alter table public.order_items add column if not exists product_reference text;
alter table public.order_items add column if not exists product_ref text;
alter table public.order_items add column if not exists quantity integer;
alter table public.order_items add column if not exists price numeric;
alter table public.order_items add column if not exists price_xof numeric;
alter table public.order_items add column if not exists unit_price_xof numeric;
alter table public.order_items add column if not exists image_url text;

commit;
