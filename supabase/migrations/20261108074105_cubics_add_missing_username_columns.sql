-- Applied to connected Cubics Supabase PostgreSQL via Supabase migration system.
-- Supabase version: 20261108074105
-- Name: cubics_add_missing_username_columns
-- Safe additive parity repair for prisma/schema.prisma. Existing records kept.
-- Do not apply the outdated SQLite migration in prisma/migrations/ to Supabase.
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "usernameKey" text;
CREATE UNIQUE INDEX IF NOT EXISTS "User_usernameKey_key"
  ON public."User" ("usernameKey");
