-- HERITAGE — soumission publique d’avis modérés.
-- La table product_reviews existe déjà. Cette migration ajoute uniquement
-- l’index utile au regroupement des avis par produit dans le portail.

begin;

create index if not exists product_reviews_product_status_created_at_idx
  on public.product_reviews(product_id, status, created_at desc);

commit;
