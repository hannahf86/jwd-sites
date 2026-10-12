-- ============================================================
-- SUPABASE STAND-INS — local tests only, never run on Supabase
-- ============================================================
-- Just enough of Supabase for the real migration files to run unmodified
-- in PGlite: the auth schema, the three API roles, Storage's two tables,
-- and — most importantly — Supabase's default grants, which give anon and
-- authenticated everything in public. The migrations have to take those
-- back; testing without them would prove nothing.

create schema if not exists auth;
create table auth.users (
  id              uuid primary key,
  email           varchar(255) unique,
  last_sign_in_at timestamptz
);

-- PostgREST puts the JWT's sub here; auth.uid() reads it back.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create role anon          nologin;
create role authenticated nologin;
create role service_role  nologin bypassrls;

grant usage on schema auth   to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- --- Storage ---
create schema if not exists storage;
create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text not null,
  owner     uuid default auth.uid()
);
-- Matches Supabase: every path segment except the file name.
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
