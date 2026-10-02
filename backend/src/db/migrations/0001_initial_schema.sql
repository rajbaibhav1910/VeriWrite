-- VeriWrite — initial schema (spec §38).
--
-- PostgreSQL 14+. Every table below is the durable form of something the frontend
-- already models, so a row read back from here is shaped like the row the pages parse
-- (see src/services/documentService.ts). The CHECK constraints are the same unions the
-- TypeScript types declare; keep the two in step or a write that the app accepts will be
-- refused here, which is the safer direction but still a bug.
--
-- Nothing in this file is executed by the browser build. See backend/README.md for what
-- actually runs today.

begin;

-- ------------------------------------------------------------------ users

create extension if not exists pgcrypto;

create table users (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique,
  name             text not null,
  -- Never the password itself: an Argon2id encoded hash, or NULL for an account that
  -- only ever signed in through an external provider.
  password_hash    text,
  role             text not null default 'user'
                   check (role in ('user', 'admin', 'support')),
  status           text not null default 'active'
                   check (status in ('active', 'suspended', 'deleted')),
  locale           text not null default 'en',
  email_verified_at timestamptz,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint users_name_present check (length(btrim(name)) > 0)
);

-- Sessions are the server-side half of the "session authentication" the app's auth
-- service abstracts: the token the client holds is only an id into this table, so a
-- revoked row ends access immediately without waiting for a JWT to expire.
create table user_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  token_hash    text not null unique,
  user_agent    text,
  ip            inet,
  issued_at     timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  constraint user_sessions_lifetime check (expires_at > issued_at)
);
create index user_sessions_user_idx on user_sessions (user_id, expires_at);

-- ------------------------------------------------------------------ subscriptions

-- The plan lives here, not on `users`, because it changes over time and the history of
-- those changes is what billing questions are asked about.
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references users(id) on delete cascade,
  provider               text not null default 'local'
                         check (provider in ('local', 'stripe', 'manual')),
  plan                   text not null check (plan in ('free', 'pro', 'team')),
  billing_interval       text not null default 'monthly'
                         check (billing_interval in ('monthly', 'annual')),
  status                 text not null
                         check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  seats                  integer not null default 1 check (seats > 0),
  current_period_start   timestamptz not null default now(),
  current_period_end     timestamptz not null,
  cancel_at_period_end   boolean not null default false,
  -- External references only. The provider's API keys are server secrets and never
  -- stored per-row, never in the frontend bundle.
  provider_customer_id   text,
  provider_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint subscriptions_period_ordered check (current_period_end > current_period_start)
);
create index subscriptions_user_idx on subscriptions (user_id, current_period_end desc);

-- One live subscription per user: the plan the quota guard reads.
create unique index subscriptions_one_live_per_user
  on subscriptions (user_id)
  where status in ('active', 'trialing', 'past_due');

-- ------------------------------------------------------------------ folders

-- A folder belongs to a user and may nest one level through `parent_id`. Deleting a
-- folder never deletes a document: `documents.folder_id` is set null, which is exactly
-- what the "unfiled list" in the UI means.
create table folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 60),
  parent_id  uuid references folders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A folder cannot be its own parent, and the app only builds one level.
  constraint folders_not_self check (parent_id is null or parent_id <> id),
  constraint folders_no_nested_parent_check exclude (null)
);
create unique index folders_name_per_user on folders (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name);
create index folders_user_idx on folders (user_id);

-- ------------------------------------------------------------------ documents

create table documents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  folder_id  uuid references folders(id) on delete set null,
  title      text not null check (length(btrim(title)) between 1 and 120),
  body       text not null default '',
  -- The tool the document was made in. Same union as the app's ToolId.
  tool       text not null default 'detector'
             check (tool in ('detector', 'paraphraser', 'humanizer', 'grammar',
                             'plagiarism', 'summarizer', 'translator', 'citations', 'writer')),
  language   text not null default 'en',
  status     text not null default 'draft'
             check (status in ('draft', 'processing', 'completed', 'failed')),
  word_count integer not null default 0 check (word_count >= 0),
  favorite   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_user_recent_idx on documents (user_id, updated_at desc);
create index documents_folder_idx on documents (folder_id);
-- The unfiled list is a real query in the UI, so it gets a real index.
create index documents_unfiled_idx on documents (user_id) where folder_id is null;

-- ------------------------------------------------------------------ analyses

-- One finished detector run. `result` holds the engine's full measurement (the same
-- object the frontend downloads as JSON), while the columns beside it are the fields
-- lists, filters and quotas sort on — denormalised on purpose so History never has to
-- decode a blob to render a row.
create table analyses (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid references documents(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  tool           text not null default 'detector' check (tool in ('detector', 'paraphraser', 'humanizer',
                             'grammar', 'plagiarism', 'summarizer', 'translator', 'citations', 'writer')),
  status         text not null check (status in ('draft', 'processing', 'completed', 'failed')),
  language       text not null default 'en',
  -- Percentages on the app's own 0-100 scale, not fractions: the engine reports 72 as a
  -- band edge and the UI prints "72%", so a fraction here would be a second unit to
  -- convert and a chance to show one number while meaning another.
  ai_probability numeric(5,2) check (ai_probability >= 0 and ai_probability <= 100),
  classification text check (classification in ('ai_generated', 'ai_generated_refined',
                             'human_refined', 'human_written')),
  confidence     text check (confidence in ('low', 'moderate', 'high', 'very-high')),
  word_count     integer not null default 0 check (word_count >= 0),
  -- Which model said this, and which version of it. A score without its provenance is
  -- not auditable, and the app refuses to print one.
  model_id       text not null default 'feature-v1',
  model_version  text not null default '1',
  result         jsonb,
  error_code     text,
  analyzed_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  -- A completed run is the only shape that has to carry a measurement.
  constraint analyses_completed_are_measured
    check (status <> 'completed' or (ai_probability is not null
                                     and classification is not null
                                     and confidence is not null))
);
create index analyses_user_recent_idx on analyses (user_id, analyzed_at desc);
create index analyses_document_idx on analyses (document_id);
create index analyses_classification_idx on analyses (user_id, classification);

-- ------------------------------------------------------------------ sentence analyses

create table sentence_analyses (
  id             uuid primary key default gen_random_uuid(),
  analysis_id    uuid not null references analyses(id) on delete cascade,
  ordinal        integer not null check (ordinal >= 0),
  text           text not null,
  -- Offsets are into the *plain text* the model read, which is what the editor maps
  -- back to ProseMirror positions. Paragraph/sentence split is the model's, not the UI's.
  start_offset   integer not null check (start_offset >= 0),
  end_offset     integer not null check (end_offset > start_offset),
  ai_probability numeric(5,2) not null check (ai_probability >= 0 and ai_probability <= 100),
  classification text not null check (classification in ('ai_generated', 'ai_generated_refined',
                             'human_refined', 'human_written')),
  confidence     text not null check (confidence in ('low', 'moderate', 'high', 'very-high')),
  signals        jsonb not null default '[]',
  metrics        jsonb not null default '{}',
  constraint sentence_analyses_position check (end_offset <= length(text) + 4096),
  constraint sentence_analyses_unique_ordinal unique (analysis_id, ordinal)
);
create index sentence_analyses_analysis_idx on sentence_analyses (analysis_id, ordinal);

-- ------------------------------------------------------------------ reports + sharing

create table reports (
  id          uuid primary key default gen_random_uuid(),
  analysis_id uuid references analyses(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  user_id     uuid not null references users(id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 120),
  format      text not null default 'json' check (format in ('json', 'pdf', 'html')),
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);
create index reports_user_idx on reports (user_id, created_at desc);
create index reports_analysis_idx on reports (analysis_id);

-- A share link is a separate row from the report so it can be revoked, expire, and be
-- counted without touching the measurement itself. The token — not the report id — is
-- what appears in a URL.
create table shared_reports (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references reports(id) on delete cascade,
  owner_id    uuid not null references users(id) on delete cascade,
  token       text not null unique check (length(token) >= 24),
  visibility  text not null default 'link' check (visibility in ('link', 'restricted')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  view_count  integer not null default 0 check (view_count >= 0),
  constraint shared_reports_lifetime check (expires_at is null or expires_at > created_at)
);
create index shared_reports_report_idx on shared_reports (report_id);

-- ------------------------------------------------------------------ history

-- The saved-runs list the History page reads. It is written in the same transaction as
-- the analysis it points at. Deleting the document takes the row with it, exactly as the
-- local store does; `result_present` says honestly whether the figures behind the row can
-- still be handed back, which is false as soon as the analysis blob it points at is gone.
create table history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  document_id    uuid references documents(id) on delete cascade,
  analysis_id    uuid references analyses(id) on delete set null,
  tool           text not null check (tool in ('detector', 'paraphraser', 'humanizer',
                             'grammar', 'plagiarism', 'summarizer', 'translator', 'citations', 'writer')),
  title          text not null check (length(btrim(title)) between 1 and 120),
  status         text not null check (status in ('draft', 'processing', 'completed', 'failed')),
  ai_probability numeric(5,2) not null check (ai_probability >= 0 and ai_probability <= 100),
  classification text not null check (classification in ('ai_generated', 'ai_generated_refined',
                             'human_refined', 'human_written')),
  confidence     text not null check (confidence in ('low', 'moderate', 'high', 'very-high')),
  word_count     integer not null default 0 check (word_count >= 0),
  result_present boolean not null default true,
  analyzed_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index history_user_recent_idx on history (user_id, analyzed_at desc);
create index history_user_classification_idx on history (user_id, classification);
create index history_user_confidence_idx on history (user_id, confidence);

-- ------------------------------------------------------------------ usage

-- Month counters. `period` is 'YYYY-MM' in UTC, the same key the quota guard uses, so a
-- reset is simply a new row rather than a job that deletes one.
create table usage_counters (
  user_id    uuid not null references users(id) on delete cascade,
  period     text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  words      integer not null default 0 check (words >= 0),
  analyses   integer not null default 0 check (analyses >= 0),
  rewrites   integer not null default 0 check (rewrites >= 0),
  plagiarism integer not null default 0 check (plagiarism >= 0),
  documents  integer not null default 0 check (documents >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

-- Per-day buckets for the usage chart. A row exists only for a day that recorded
-- something, which is why the chart draws a gap rather than a zero it invented.
create table usage_days (
  user_id    uuid not null references users(id) on delete cascade,
  day        date not null,
  words      integer not null default 0 check (words >= 0),
  analyses   integer not null default 0 check (analyses >= 0),
  rewrites   integer not null default 0 check (rewrites >= 0),
  plagiarism integer not null default 0 check (plagiarism >= 0),
  primary key (user_id, day)
);
create index usage_days_day_idx on usage_days (day);

-- ------------------------------------------------------------------ citations

create table citations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  style       text not null check (style in ('apa', 'mla', 'chicago', 'harvard', 'ieee', 'vancouver')),
  source_type text not null check (source_type in ('webpage', 'book', 'journal', 'news',
                             'interview', 'software', 'report')),
  -- The fields the generator was given (author, title, year, url, …) exactly as entered.
  fields      jsonb not null,
  formatted   text not null,
  -- True only when a lookup actually reached a service. An unverifiable source is
  -- flagged in the row itself, not just in the UI, so an export keeps the caveat.
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index citations_user_idx on citations (user_id, created_at desc);

-- ------------------------------------------------------------------ plagiarism results

-- One matched source per row for one scan, so a report can be rebuilt and a stale scan
-- can be expired without re-running anything.
create table plagiarism_results (
  id            uuid primary key default gen_random_uuid(),
  analysis_id   uuid references analyses(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  document_id   uuid references documents(id) on delete set null,
  rank          integer not null check (rank >= 0),
  source_url    text,
  source_title  text not null,
  snippet       text not null,
  matched_words integer not null default 0 check (matched_words >= 0),
  similarity    numeric(5,2) not null check (similarity >= 0 and similarity <= 100),
  start_offset  integer check (start_offset is null or start_offset >= 0),
  end_offset    integer check (end_offset is null or end_offset > coalesce(start_offset, 0)),
  -- 'live' means a real web scan answered. Anything else must be labelled in the UI.
  engine        text not null default 'demo' check (engine in ('live', 'cache', 'demo')),
  searched_at   timestamptz not null default now(),
  constraint plagiarism_results_unique_rank unique (analysis_id, rank)
);
create index plagiarism_results_user_idx on plagiarism_results (user_id, searched_at desc);

-- ------------------------------------------------------------------ async work

-- Not one of the §38 entities: the queue the file-processing workers and any long model
-- run take jobs from. Large uploads are processed out of the request (spec §40), so the
-- job has to outlive the connection that created it.
create table processing_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  document_id  uuid references documents(id) on delete cascade,
  kind         text not null check (kind in ('extract', 'detect', 'plagiarism', 'report')),
  status       text not null default 'queued'
               check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  attempts     integer not null default 0 check (attempts >= 0),
  payload      jsonb not null default '{}',
  result       jsonb,
  error        text,
  run_after    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
create index processing_jobs_claim_idx on processing_jobs (status, run_after);
create index processing_jobs_user_idx on processing_jobs (user_id, created_at desc);

-- ------------------------------------------------------------------ audit trail

-- Security-relevant events, kept narrow on purpose: who did what to which row, without
-- storing document text. Phase 26's rate limiting and role checks write here.
create table audit_events (
  id        bigserial primary key,
  user_id   uuid references users(id) on delete set null,
  action    text not null,
  subject   text,
  ip        inet,
  metadata  jsonb not null default '{}',
  at        timestamptz not null default now()
);
create index audit_events_user_idx on audit_events (user_id, at desc);

-- Keep `updated_at` honest in one place rather than in every handler.
create or replace function set_updated_at() returns trigger as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$ language plpgsql;

create trigger users_touch before update on users for each row execute function set_updated_at();
create trigger documents_touch before update on documents for each row execute function set_updated_at();
create trigger folders_touch before update on folders for each row execute function set_updated_at();
create trigger subscriptions_touch before update on subscriptions for each row execute function set_updated_at();

commit;
