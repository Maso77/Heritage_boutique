-- HERITAGE — comptes clients, adresses, panier et favoris persistants.
-- À exécuter après la migration principale du portail admin.

begin;

create extension if not exists pgcrypto;

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Adresse principale' check (char_length(label) between 1 and 80),
  recipient_name text,
  phone text,
  commune text,
  address_line text not null check (char_length(address_line) between 4 and 500),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.customer_wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists customer_addresses_user_id_idx
  on public.customer_addresses(user_id, is_default desc, created_at asc);
create index if not exists customer_cart_items_user_id_idx
  on public.customer_cart_items(user_id, updated_at desc);
create index if not exists customer_wishlist_items_user_id_idx
  on public.customer_wishlist_items(user_id, created_at desc);
create index if not exists orders_customer_user_created_idx
  on public.orders(user_id, created_at desc);
create index if not exists orders_customer_email_created_idx
  on public.orders(lower(customer_email), created_at desc);

drop trigger if exists customer_addresses_set_updated_at on public.customer_addresses;
create trigger customer_addresses_set_updated_at
before update on public.customer_addresses
for each row execute function public.set_updated_at();

drop trigger if exists customer_cart_items_set_updated_at on public.customer_cart_items;
create trigger customer_cart_items_set_updated_at
before update on public.customer_cart_items
for each row execute function public.set_updated_at();

-- Un compte client est créé exclusivement par Supabase Auth. Le trigger garde
-- les métadonnées non sensibles du formulaire et initialise son adresse par
-- défaut lorsqu’elle a été fournie.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_role text := case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'customer' end;
  submitted_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), '');
  submitted_phone text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', new.raw_user_meta_data ->> 'whatsapp')), '');
  submitted_commune text := nullif(trim(new.raw_user_meta_data ->> 'commune'), '');
  submitted_address text := nullif(trim(new.raw_user_meta_data ->> 'delivery_address'), '');
begin
  insert into public.profiles (id, email, full_name, phone, commune, delivery_address, role, is_active)
  values (
    new.id,
    new.email,
    submitted_name,
    submitted_phone,
    submitted_commune,
    submitted_address,
    account_role,
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone),
        commune = coalesce(excluded.commune, public.profiles.commune),
        delivery_address = coalesce(excluded.delivery_address, public.profiles.delivery_address),
        updated_at = now();

  if account_role = 'customer' and submitted_address is not null and char_length(submitted_address) >= 4 then
    insert into public.customer_addresses (user_id, label, recipient_name, phone, commune, address_line, is_default)
    select new.id, 'Adresse principale', nullif(submitted_name, ''), submitted_phone, submitted_commune, submitted_address, true
    where not exists (
      select 1
      from public.customer_addresses
      where user_id = new.id and address_line = submitted_address
    );
  end if;

  return new;
end;
$$;

-- Évite qu’un ancien trigger de schéma écrase les métadonnées du compte
-- (notamment le téléphone) au moment de l’inscription.
drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Préserve les adresses déjà renseignées par les comptes existants.
insert into public.customer_addresses (user_id, label, recipient_name, phone, commune, address_line, is_default)
select p.id, 'Adresse principale', nullif(p.full_name, ''), p.phone, p.commune, p.delivery_address, true
from public.profiles p
where p.role = 'customer'
  and nullif(trim(p.delivery_address), '') is not null
  and char_length(trim(p.delivery_address)) >= 4
  and not exists (
    select 1
    from public.customer_addresses a
    where a.user_id = p.id and a.address_line = p.delivery_address
  );

-- Le navigateur ne lit ni n’écrit directement les données de compte. Toutes
-- les opérations passent par l’API serveur, qui vérifie le jeton du client
-- puis applique le rôle et l’état de son profil.
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.customer_cart_items enable row level security;
alter table public.customer_wishlist_items enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'orders', 'order_items',
        'customer_addresses', 'customer_cart_items', 'customer_wishlist_items'
      )
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end;
$$;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.customer_addresses from anon, authenticated;
revoke all on table public.customer_cart_items from anon, authenticated;
revoke all on table public.customer_wishlist_items from anon, authenticated;

commit;
