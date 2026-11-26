-- ═══════════════════════════════════════════════════════════════════════════
-- Bookly — content reports (Google Play UGC + AI-content policies), app events
-- and Google Play subscriptions.
-- Run once in the Supabase SQL editor (after 0001–0003), or `supabase db push`.
-- Safe to run again: every statement is idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── reports: learners flag reviews or AI explanations ─────────────────────
create table if not exists public.content_reports (
  id            uuid primary key default gen_random_uuid(),
  -- null = reported by a guest (inserted by the server with the service role)
  reporter_id   uuid default auth.uid() references auth.users(id) on delete set null,
  target_type   text not null check (target_type in ('review', 'ai_explanation')),
  -- review: summary_reviews.id · ai_explanation: "<slug>:<sentence id>"
  target_id     text not null check (char_length(target_id) between 1 and 200),
  summary_slug  text check (summary_slug is null or char_length(summary_slug) <= 120),
  reason        text not null check (reason in ('spam', 'offensive', 'harassment', 'wrong', 'copyright', 'other')),
  details       text check (details is null or char_length(details) <= 1000),
  -- Copy of what was reported, so moderators see it even if it changes later.
  snapshot      text check (snapshot is null or char_length(snapshot) <= 4000),
  status        text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution    text check (resolution is null or char_length(resolution) <= 200),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);
create index if not exists content_reports_target_idx on public.content_reports (target_type, target_id);
-- One report per learner per item (guests are rate-limited by the server instead).
create unique index if not exists content_reports_once
  on public.content_reports (reporter_id, target_type, target_id) where reporter_id is not null;

alter table public.content_reports enable row level security;

drop policy if exists "reports: insert own" on public.content_reports;
create policy "reports: insert own" on public.content_reports
  for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "reports: read own or admin" on public.content_reports;
create policy "reports: read own or admin" on public.content_reports
  for select using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "reports: admin update" on public.content_reports;
create policy "reports: admin update" on public.content_reports
  for update using (public.is_admin()) with check (public.is_admin());

revoke insert, update on public.content_reports from anon, authenticated;
grant select on public.content_reports to authenticated;
grant insert (target_type, target_id, summary_slug, reason, details, snapshot) on public.content_reports to authenticated;
grant update (status, resolution, resolved_at) on public.content_reports to authenticated;

-- Safety net between moderator visits: a review with 3+ open reports is hidden automatically.
create or replace function public.content_reports_autohide()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'review' then
    if (select count(*) from public.content_reports
        where target_type = 'review' and target_id = new.target_id and status = 'open') >= 3 then
      update public.summary_reviews set is_hidden = true where id::text = new.target_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists content_reports_autohide on public.content_reports;
create trigger content_reports_autohide after insert on public.content_reports
  for each row execute function public.content_reports_autohide();

-- ─── Google Play subscriptions (written by the RevenueCat webhook) ──────────
-- One row per store subscription; the webhook upserts on (provider, provider_ref).
-- (Not partial, so PostgREST can use it as an ON CONFLICT target; NULL refs never collide.)
create unique index if not exists subscriptions_provider_ref_key
  on public.subscriptions (provider, provider_ref);

-- ─── analytics: allow the new events ────────────────────────────────────────
alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'summary_view', 'session_start', 'summary_complete', 'practice_complete',
  'mode_change', 'ai_explain', 'premium_view', 'premium_interest', 'sign_in', 'waitlist_join',
  'review_submit',
  'content_report', 'download', 'reminder_set', 'purchase_start', 'purchase_complete', 'app_open', 'share'
));
