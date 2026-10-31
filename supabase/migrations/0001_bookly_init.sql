-- ═══════════════════════════════════════════════════════════════════════════
-- Bookly — initial schema
-- Run in Supabase SQL editor (or `supabase db push`). Safe to run once on a new project.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── helpers ────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  display_name            text,
  avatar_url              text,
  role                    text not null default 'user' check (role in ('user', 'admin')),
  preferences             jsonb not null default '{}'::jsonb,
  preferences_updated_at  timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

-- Create a profile automatically when someone signs up (Google provides name + avatar).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── subscriptions (written only by the server / payment webhooks via service role) ──
create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  plan                text not null default 'premium_monthly',
  status              text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  provider            text not null default 'manual',   -- manual | payme | click | stripe ...
  provider_ref        text,
  current_period_end  timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions(user_id);
create trigger subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─── role helpers (security definer so they can be used inside RLS) ───────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_premium()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = auth.uid()
      and status in ('trialing', 'active')
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- ─── content ────────────────────────────────────────────────────────────────
-- Public metadata (cards, intro page). Visible to everyone once published.
create table public.summaries (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null,
  title_uz      text not null default '',
  author        text not null,
  topic         text not null,
  duration_min  integer not null default 5 check (duration_min between 1 and 60),
  level         text not null default 'intermediate'
                check (level in ('beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced')),
  languages     text[] not null default array['en', 'uz'],
  is_free       boolean not null default false,
  is_published  boolean not null default false,
  cover_color   text not null default '#0B5D4B',
  tagline       text not null default '',
  intro         text not null default '',
  learn_points  jsonb not null default '[]'::jsonb,
  attribution   text not null default '',
  sort_order    integer not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger summaries_updated before update on public.summaries
  for each row execute function public.set_updated_at();

-- The actual lesson (sentences, translations, timings, vocab, questions, audio).
-- Gated: free summaries for everyone, the rest for Premium members.
create table public.summary_content (
  summary_id  uuid primary key references public.summaries(id) on delete cascade,
  content     jsonb not null,
  updated_at  timestamptz not null default now()
);
create trigger summary_content_updated before update on public.summary_content
  for each row execute function public.set_updated_at();

-- ─── learner data (synced across devices) ────────────────────────────────────
create table public.progress (
  user_id         uuid not null references auth.users(id) on delete cascade,
  summary_slug    text not null,
  sentence_index  integer not null default 0,
  position_sec    real not null default 0,
  percent         real not null default 0 check (percent between 0 and 100),
  mode            text,
  format          text,
  completed_at    timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (user_id, summary_slug)
);

create table public.library_items (
  user_id       uuid not null references auth.users(id) on delete cascade,
  summary_slug  text not null,
  saved         boolean not null default true,     -- false = tombstone (un-saved), keeps sync correct
  updated_at    timestamptz not null default now(),
  primary key (user_id, summary_slug)
);

create table public.practice_results (
  user_id       uuid not null references auth.users(id) on delete cascade,
  summary_slug  text not null,
  score         integer not null,
  total         integer not null,
  best_score    integer not null,
  answers       jsonb not null default '[]'::jsonb,
  completed_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, summary_slug)
);

-- ─── product analytics (MVP success metrics) ─────────────────────────────────
create table public.events (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  anon_id     text,
  name        text not null check (name in (
                'summary_view', 'session_start', 'summary_complete', 'practice_complete',
                'mode_change', 'ai_explain', 'premium_view', 'premium_interest', 'sign_in'
              )),
  summary_slug text,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index events_name_created_idx on public.events(name, created_at);

create table public.premium_interest (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  plan        text not null default 'premium_monthly',
  note        text,
  created_at  timestamptz not null default now()
);

-- ─── AI usage limits + explanation cache ────────────────────────────────────
create table public.ai_usage (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null default current_date,
  count    integer not null default 0,
  primary key (user_id, day)
);

create table public.ai_explanations (
  summary_slug  text not null,
  sentence_id   text not null,
  content_hash  text not null,
  explanation   jsonb not null,
  created_at    timestamptz not null default now(),
  primary key (summary_slug, sentence_id, content_hash)
);

-- Atomically consume one AI request from today's allowance.
-- Limits live here (not in the client) so they cannot be bypassed: 15/day free, 100/day Premium.
create or replace function public.consume_ai_quota()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  lim  integer;
  used integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  lim := case when public.is_premium() or public.is_admin() then 100 else 15 end;

  insert into public.ai_usage as u (user_id, day, count)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update
    set count = u.count + 1
    where u.count < lim
  returning u.count into used;

  return used is not null;
end $$;

-- ═══ Row Level Security ══════════════════════════════════════════════════════
alter table public.profiles          enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.summaries         enable row level security;
alter table public.summary_content   enable row level security;
alter table public.progress          enable row level security;
alter table public.library_items     enable row level security;
alter table public.practice_results  enable row level security;
alter table public.events            enable row level security;
alter table public.premium_interest  enable row level security;
alter table public.ai_usage          enable row level security;
alter table public.ai_explanations   enable row level security;  -- service role only

-- profiles: read/update your own row; users can never change their own role.
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar_url, preferences, preferences_updated_at) on public.profiles to authenticated;

-- subscriptions: read your own; writes only via service role (payments).
create policy "subscriptions: read own" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

-- summaries metadata
create policy "summaries: read published" on public.summaries
  for select using (is_published or public.is_admin());
create policy "summaries: admin insert" on public.summaries
  for insert with check (public.is_admin());
create policy "summaries: admin update" on public.summaries
  for update using (public.is_admin()) with check (public.is_admin());
create policy "summaries: admin delete" on public.summaries
  for delete using (public.is_admin());

-- summary content — the paywall lives here
create policy "content: free or premium" on public.summary_content
  for select using (
    public.is_admin() or exists (
      select 1 from public.summaries s
      where s.id = summary_id and s.is_published and (s.is_free or public.is_premium())
    )
  );
create policy "content: admin insert" on public.summary_content
  for insert with check (public.is_admin());
create policy "content: admin update" on public.summary_content
  for update using (public.is_admin()) with check (public.is_admin());
create policy "content: admin delete" on public.summary_content
  for delete using (public.is_admin());

-- learner data: each user owns their rows
create policy "progress: own" on public.progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "library: own" on public.library_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "practice: own" on public.practice_results
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- events: anyone may insert (anonymous visitors too), only admins read
create policy "events: insert" on public.events
  for insert with check (user_id is null or user_id = auth.uid());
create policy "events: admin read" on public.events
  for select using (public.is_admin());

-- premium interest (waitlist / willingness-to-pay signal)
create policy "interest: own insert" on public.premium_interest
  for insert with check (user_id = auth.uid());
create policy "interest: own read" on public.premium_interest
  for select using (user_id = auth.uid() or public.is_admin());
create policy "interest: own update" on public.premium_interest
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ai usage: users may read their own counter (writes go through consume_ai_quota)
create policy "ai_usage: read own" on public.ai_usage
  for select using (user_id = auth.uid());

grant execute on function public.consume_ai_quota() to authenticated;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_premium() to authenticated, anon;

-- ═══ Storage: audio files ═══════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

create policy "audio: admin upload" on storage.objects
  for insert with check (bucket_id = 'audio' and public.is_admin());
create policy "audio: admin update" on storage.objects
  for update using (bucket_id = 'audio' and public.is_admin());
create policy "audio: admin delete" on storage.objects
  for delete using (bucket_id = 'audio' and public.is_admin());
