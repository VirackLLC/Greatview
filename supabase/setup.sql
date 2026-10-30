-- Run in the Supabase SQL Editor as the project administrator.
-- Then run the seed statement produced by: node scripts/print-seed.mjs
begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
drop policy if exists "Owner uploads new website photos" on storage.objects;
drop function if exists public.publish_site(jsonb, integer);
drop function if exists public.is_site_owner();

create table if not exists app_private.site_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null unique check (role in ('owner', 'editor'))
);
alter table app_private.site_editors enable row level security;
revoke all on app_private.site_editors from public, anon, authenticated;

-- Preserve the previously configured permanent owner if this script upgrades
-- a one-owner installation. The editor slot remains empty until provisioned.
do $$
begin
  if to_regclass('app_private.site_owner') is not null then
    execute 'insert into app_private.site_editors(user_id, role)
             select user_id, ''owner'' from app_private.site_owner
             on conflict (user_id) do nothing';
    execute 'drop table app_private.site_owner';
  end if;
end;
$$;

create or replace function public.can_edit_site()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from app_private.site_editors where user_id = auth.uid());
$$;
revoke all on function public.can_edit_site() from public, anon;
grant execute on function public.can_edit_site() to authenticated;

create or replace function public.is_site_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app_private.site_editors
    where user_id = auth.uid() and role = 'owner'
  );
$$;
revoke all on function public.is_site_owner() from public, anon;
grant execute on function public.is_site_owner() to authenticated;

create table if not exists public.site_content (
  id integer primary key check (id = 1),
  content jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
revoke all on public.site_content from public, anon, authenticated;
grant select on public.site_content to anon, authenticated;
drop policy if exists "Published content is public" on public.site_content;
create policy "Published content is public" on public.site_content
  for select to anon, authenticated using (id = 1);

create or replace function app_private.valid_photo_url(value jsonb, nullable boolean default true)
returns boolean language sql immutable set search_path = ''
as $$
  select case when value = 'null'::jsonb then nullable
    when jsonb_typeof(value) <> 'string' then false
    else length(value #>> '{}') <= 1000 and (
      (value #>> '{}') ~ '^https://res[.]cloudinary[.]com/dgxsmxiax/image/upload/[A-Za-z0-9_./-]+$'
      or (value #>> '{}') ~ '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/site-photos/[a-f0-9-]{36}/[a-f0-9-]{36}[.]webp$'
    ) end;
$$;

create or replace function app_private.valid_content(doc jsonb)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare item jsonb; license jsonb; gallery_id text;
begin
  if doc is null or jsonb_typeof(doc) <> 'object' or octet_length(doc::text) > 100000 then return false; end if;
  if not (doc ?& array['hero','featured','services','gallery','license','serviceArea']) then return false; end if;
  if not app_private.valid_photo_url(doc->'hero') or not app_private.valid_photo_url(doc->'featured') then return false; end if;
  if jsonb_typeof(doc->'services') <> 'array' or jsonb_array_length(doc->'services') <> 5 then return false; end if;
  for item in select jsonb_array_elements(doc->'services') loop
    if not app_private.valid_photo_url(item) then return false; end if;
  end loop;
  if jsonb_typeof(doc->'gallery') <> 'array' or jsonb_array_length(doc->'gallery') > 80 then return false; end if;
  for item in select jsonb_array_elements(doc->'gallery') loop
    if jsonb_typeof(item) <> 'object' or not (item ?& array['id','url','title']) then return false; end if;
    gallery_id := item->>'id';
    if jsonb_typeof(item->'id') <> 'string' or gallery_id !~ '^[a-zA-Z0-9-]{1,80}$' then return false; end if;
    if not app_private.valid_photo_url(item->'url', false) then return false; end if;
    if jsonb_typeof(item->'title') <> 'string' or length(item->>'title') > 160 then return false; end if;
  end loop;
  if (select count(*) <> count(distinct value->>'id') from jsonb_array_elements(doc->'gallery')) then return false; end if;
  if jsonb_typeof(doc->'serviceArea') <> 'object'
    or not ((doc->'serviceArea') ?& array['region','cities']) then return false; end if;
  if jsonb_typeof(doc->'serviceArea'->'region') <> 'string'
    or length(btrim(doc->'serviceArea'->>'region')) < 1
    or length(doc->'serviceArea'->>'region') > 100 then return false; end if;
  if jsonb_typeof(doc->'serviceArea'->'cities') <> 'array'
    or jsonb_array_length(doc->'serviceArea'->'cities') > 30 then return false; end if;
  for item in select jsonb_array_elements(doc->'serviceArea'->'cities') loop
    if jsonb_typeof(item) <> 'string' or length(btrim(item #>> '{}')) < 1
      or length(item #>> '{}') > 80 then return false; end if;
    if exists (
      select 1 from jsonb_array_elements(doc->'serviceArea'->'cities') city
      where lower(btrim(city #>> '{}')) = lower(btrim(item #>> '{}'))
      group by lower(btrim(city #>> '{}')) having count(*) > 1
    ) then return false; end if;
  end loop;
  license := doc->'license';
  if jsonb_typeof(license) <> 'object' or not (license ?& array['businessName','number','verificationUrl']) then return false; end if;
  if jsonb_typeof(license->'businessName') <> 'string' or jsonb_typeof(license->'number') <> 'string'
    or jsonb_typeof(license->'verificationUrl') <> 'string' then return false; end if;
  if license->>'businessName' = '' and license->>'number' = '' and license->>'verificationUrl' = '' then return true; end if;
  if length(btrim(license->>'businessName')) < 1 or length(license->>'businessName') > 160 then return false; end if;
  if (license->>'number') !~ '^[0-9]{6}$' then return false; end if;
  if length(license->>'verificationUrl') > 500 then return false; end if;
  if license->>'verificationUrl' <> '' and (license->>'verificationUrl') !~ '^https://(([a-z0-9-]+[.])*roc[.]az[.]gov|azroc[.]my[.]site[.]com)([/?#][^[:space:]]*)?$' then return false; end if;
  return true;
exception when others then return false;
end;
$$;
revoke all on all functions in schema app_private from public, anon, authenticated;

create or replace function public.publish_site(new_content jsonb, expected_version integer)
returns integer language plpgsql security definer set search_path = ''
as $$
declare next_version integer;
begin
  if not public.can_edit_site() then raise exception 'Only approved editors can save changes' using errcode = '42501'; end if;
  if not app_private.valid_content(new_content) then raise exception 'Please check the photos and license information' using errcode = '22023'; end if;
  update public.site_content set content = new_content, version = version + 1, updated_at = now()
    where id = 1 and version = expected_version returning version into next_version;
  if next_version is null then
    raise exception 'The website changed in another tab. Reload before saving.' using errcode = '40001';
  end if;
  return next_version;
end;
$$;
revoke all on function public.publish_site(jsonb, integer) from public, anon;
grant execute on function public.publish_site(jsonb, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-photos', 'site-photos', true, 5242880, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/webp'];
create policy "Owner uploads new website photos" on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-photos' and public.can_edit_site()
  and (storage.foldername(name))[1] = auth.uid()::text
  and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.]webp$'
);
-- Deliberately no UPDATE or DELETE policy. Immutable files keep already-published
-- pages safe. Removing/replacing a photo unlinks it on Save, not before.
commit;
