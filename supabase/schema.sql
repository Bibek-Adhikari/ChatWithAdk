-- ============================================================================
-- Tufan — fresh Supabase schema
-- Run this once in the NEW Supabase project: SQL Editor → paste → Run.
--
-- Security model (important — read this):
--   * The browser NEVER talks to Supabase directly.
--   * Every request goes through the Express server (server/index.js),
--     which verifies the Firebase ID token (Firebase Admin SDK) and then
--     uses the SERVICE ROLE key.
--   * The service-role key bypasses Row Level Security, so RLS is enabled
--     below with NO permissive policies: anon/authenticated keys can
--     read/write NOTHING. That is intentional — locked by default.
--   * user_id columns store the Firebase UID (verified server-side from
--     the ID token, never trusted from the client body).
-- ============================================================================

-- --- Chat sessions (one row per conversation) -------------------------------
create table if not exists public.sessions (
  id         text        primary key,          -- client session id (e.g. "new_..." / timestamp)
  user_id    text        not null,             -- Firebase UID (verified)
  title      text        not null default 'New conversation',
  updated_at timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_user_updated_idx on public.sessions (user_id, updated_at desc);

-- --- Chat messages (belong to a session; replaced wholesale on each save) ---
create table if not exists public.messages (
  id         uuid        primary key default gen_random_uuid(),
  session_id text        not null references public.sessions (id) on delete cascade,
  role       text        not null check (role in ('user', 'assistant')),
  parts      jsonb       not null default '[]'::jsonb,
  model_id   text,
  timestamp  timestamptz not null default now()
);
create index if not exists messages_session_id_idx on public.messages (session_id);

-- --- Image tool jobs (every PhotoAdk run, per user) --------------------------
create table if not exists public.image_jobs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    text        not null,             -- Firebase UID (verified)
  tool       text        not null,             -- e.g. 'adktool', 'genaiBackground', 'upscaleUltra'
  prompt     text        not null default '',
  output_url text,                            -- result image URL (may be null on failure)
  status     text        not null default 'complete',
  created_at timestamptz not null default now()
);
create index if not exists image_jobs_user_created_idx on public.image_jobs (user_id, created_at desc);

-- --- AI code explanations ----------------------------------------------------
create table if not exists public.code_explanations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,             -- Firebase UID (verified)
  language    text        not null default '',
  code        text        not null default '',
  explanation text        not null default '',
  timestamp   timestamptz not null default now()
);
create index if not exists code_explanations_user_time_idx on public.code_explanations (user_id, timestamp desc);
create index if not exists code_explanations_time_idx on public.code_explanations (timestamp desc);

-- --- Converter history (used by existing /api/supabase/conversion-history) ---
create table if not exists public.conversion_history (
  id          text        primary key,
  user_id     text        not null,             -- Firebase UID (verified)
  source_lang text        not null,
  target_lang text        not null,
  source_code text        not null,
  target_code text        not null default '',
  timestamp   timestamptz not null default now()
);
create index if not exists conversion_history_user_time_idx on public.conversion_history (user_id, timestamp desc);

-- --- Lock everything down: RLS on, no public policies ------------------------
-- The service-role key bypasses RLS, so the server keeps full access while
-- anon/authenticated keys get nothing. Do NOT add permissive policies unless
-- you introduce Supabase Auth with verified JWTs.
alter table public.sessions            enable row level security;
alter table public.messages            enable row level security;
alter table public.image_jobs          enable row level security;
alter table public.code_explanations   enable row level security;
alter table public.conversion_history  enable row level security;
