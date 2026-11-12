-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
create table if not exists public.pulse_users (
  id text primary key,                      -- Buffer account id
  data jsonb not null default '{}'::jsonb,  -- the user's Pulse workspace
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Lock the table: with RLS on and no policies, only the server's
-- service-role key can read or write. The public anon key sees nothing.
alter table public.pulse_users enable row level security;
