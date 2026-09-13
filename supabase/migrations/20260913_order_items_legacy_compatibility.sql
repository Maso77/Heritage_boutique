-- HERITAGE — dernière compatibilité des lignes de commande historiques.
-- Réexécutable : ajoute les noms title / price lorsque le schéma les attend.

begin;

alter table public.order_items add column if not exists title text;
alter table public.order_items add column if not exists price numeric;

update public.order_items
set title = coalesce(nullif(btrim(title), ''), nullif(btrim(product_name), '')),
    price = coalesce(price, unit_price_xof, price_xof)
where title is null or btrim(title) = '' or price is null;

commit;
