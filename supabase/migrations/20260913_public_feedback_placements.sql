-- HERITAGE — restitution publique des avis approuvés et de la FAQ générale.
-- Cette migration est sûre à rejouer et ne crée aucun avis ni aucune question.

begin;

-- The administration portal stores one or many public placements in this JSON
-- array. Old single-placement rows are converted without changing their text.
alter table public.faqs add column if not exists placements jsonb not null default '[]'::jsonb;

update public.faqs
set placements = case placement
  when 'home' then '["home"]'::jsonb
  when 'catalog' then '["catalog"]'::jsonb
  when 'contact' then '["contact"]'::jsonb
  when 'all' then '["home", "catalog", "contact"]'::jsonb
  else '[]'::jsonb
end
where jsonb_typeof(placements) <> 'array' or placements = '[]'::jsonb;

create or replace function public.faq_placements_valid(value jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(
    jsonb_typeof(value) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements_text(value) as placement_value
      where placement_value not in ('home', 'catalog', 'contact')
    ),
    false
  );
$$;

alter table public.faqs drop constraint if exists faqs_placements_check;
alter table public.faqs add constraint faqs_placements_check
  check (public.faq_placements_valid(placements)) not valid;

-- These indexes support the exact public queries without modifying existing
-- content or bypassing the server-side field whitelist.
create index if not exists product_reviews_public_display_idx
  on public.product_reviews(status, rating desc, created_at desc);

create index if not exists faqs_public_display_idx
  on public.faqs(is_active, sort_order, updated_at desc);

commit;
