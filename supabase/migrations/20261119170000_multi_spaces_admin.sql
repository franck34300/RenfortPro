-- RenfortPro: profils entreprise multi-espace et rôle administrateur sécurisé
-- Admin bootstrap (user-specific) is intentionally handled in the private database, not this public migration.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.platform_admins enable row level security;
revoke all on private.platform_admins from public, anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.platform_admins a
    where a.user_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create table if not exists public.company_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null,
  siret text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  city text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.company_profiles enable row level security;
grant select, insert, update, delete on public.company_profiles to authenticated;

drop policy if exists company_profiles_select_own_or_admin on public.company_profiles;
create policy company_profiles_select_own_or_admin on public.company_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists company_profiles_insert_own on public.company_profiles;
create policy company_profiles_insert_own on public.company_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists company_profiles_update_own_or_admin on public.company_profiles;
create policy company_profiles_update_own_or_admin on public.company_profiles
  for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists company_profiles_delete_admin on public.company_profiles;
create policy company_profiles_delete_admin on public.company_profiles
  for delete to authenticated
  using ((select public.is_platform_admin()));

grant select on public.profiles to authenticated;
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_platform_admin());

-- RenfortPro user/company profile images and storage policies
alter table public.profiles add column if not exists avatar_url text;
alter table public.company_profiles add column if not exists image_url text;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('renfortpro-images','renfortpro-images',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=3145728,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "RenfortPro user uploads own images" on storage.objects for insert to authenticated
with check (bucket_id='renfortpro-images' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy "RenfortPro user updates own images" on storage.objects for update to authenticated
using (bucket_id='renfortpro-images' and (storage.foldername(name))[1]=(select auth.uid()::text))
with check (bucket_id='renfortpro-images' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy "RenfortPro user deletes own images" on storage.objects for delete to authenticated
using (bucket_id='renfortpro-images' and (storage.foldername(name))[1]=(select auth.uid()::text));
