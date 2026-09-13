-- HERITAGE — réparation des profils clients créés par Supabase Auth.
-- À exécuter APRÈS 20260913_customer_accounts.sql.
-- Cette réparation remplace un éventuel ancien trigger `handle_new_user`
-- qui ignorait les métadonnées du formulaire (téléphone, commune, adresse).

begin;

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
  values (new.id, new.email, submitted_name, submitted_phone, submitted_commune, submitted_address, account_role, true)
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone),
        commune = coalesce(excluded.commune, public.profiles.commune),
        delivery_address = coalesce(excluded.delivery_address, public.profiles.delivery_address),
        updated_at = now();

  if account_role = 'customer' and submitted_address is not null and char_length(submitted_address) >= 4 then
    insert into public.customer_addresses (user_id, label, recipient_name, phone, commune, address_line, is_default)
    select new.id, 'Adresse principale', nullif(submitted_name, ''), submitted_phone, submitted_commune, submitted_address, true
    where not exists (
      select 1 from public.customer_addresses
      where user_id = new.id and address_line = submitted_address
    );
  end if;
  return new;
end;
$$;

-- Une seule source de vérité : le trigger de ce projet. On supprime les
-- anciennes variantes qui pouvaient écraser les champs avec des valeurs nulles.
drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Répare aussi tous les comptes déjà créés à partir des métadonnées Auth.
insert into public.profiles (id, email, full_name, phone, commune, delivery_address, role, is_active)
select
  user_row.id,
  user_row.email,
  coalesce(nullif(trim(user_row.raw_user_meta_data ->> 'full_name'), ''), ''),
  nullif(trim(coalesce(user_row.raw_user_meta_data ->> 'phone', user_row.raw_user_meta_data ->> 'whatsapp')), ''),
  nullif(trim(user_row.raw_user_meta_data ->> 'commune'), ''),
  nullif(trim(user_row.raw_user_meta_data ->> 'delivery_address'), ''),
  case when user_row.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'customer' end,
  true
from auth.users user_row
on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email),
      full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
      phone = coalesce(excluded.phone, public.profiles.phone),
      commune = coalesce(excluded.commune, public.profiles.commune),
      delivery_address = coalesce(excluded.delivery_address, public.profiles.delivery_address),
      updated_at = now();

insert into public.customer_addresses (user_id, label, recipient_name, phone, commune, address_line, is_default)
select p.id, 'Adresse principale', nullif(p.full_name, ''), p.phone, p.commune, p.delivery_address, true
from public.profiles p
where p.role = 'customer'
  and nullif(trim(p.delivery_address), '') is not null
  and char_length(trim(p.delivery_address)) >= 4
  and not exists (
    select 1 from public.customer_addresses address_row
    where address_row.user_id = p.id and address_row.address_line = p.delivery_address
  );

commit;
