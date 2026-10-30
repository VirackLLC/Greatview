-- Minimal Supabase-compatible schemas for isolated, real PostgreSQL policy tests.
-- NOT application storage and NOT for running against a connected/live project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id bigint generated always as identity, bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1];
$$;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant usage on all sequences in schema storage to anon, authenticated;
insert into auth.users values
  ('11111111-1111-4111-a111-111111111111'),
  ('22222222-2222-4222-a222-222222222222'),
  ('33333333-3333-4333-a333-333333333333'),
  ('44444444-4444-4444-a444-444444444444');
-- Simulate a previously initialized single-owner project for the setup upgrade test.
create schema app_private;
create table app_private.site_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
insert into app_private.site_owner(singleton, user_id)
values (true, '11111111-1111-4111-a111-111111111111');
alter table app_private.site_owner enable row level security;
create table public.site_content (
  id integer primary key check (id = 1),
  content jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
create function public.is_site_owner()
returns boolean language sql stable security definer
as $$ select exists (select 1 from app_private.site_owner where user_id = auth.uid()); $$;
create function public.publish_site(new_content jsonb, expected_version integer)
returns integer language plpgsql security definer
as $$
begin
  if not public.is_site_owner() then raise exception 'Only the owner can save changes' using errcode = '42501'; end if;
  return expected_version;
end;
$$;
create policy "Owner uploads new website photos" on storage.objects for insert to authenticated
with check (bucket_id = 'site-photos' and public.is_site_owner());
