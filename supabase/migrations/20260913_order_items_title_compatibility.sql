-- HERITAGE — compatibilité de l'ancien détail de commande.
-- À exécuter après 20260913_orders_checkout_compatibility.sql, ou seul si
-- l'unique erreur restante est « order_items.title violates not-null ».

begin;

alter table public.order_items add column if not exists title text;

-- Préserve les éventuels articles historiques : la valeur ne remplace jamais
-- un titre déjà renseigné.
update public.order_items
set title = coalesce(nullif(btrim(title), ''), nullif(btrim(product_name), ''))
where title is null or btrim(title) = '';

commit;
