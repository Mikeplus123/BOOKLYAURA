-- ═══════════════════════════════════════════════════════════════════════════
-- Bookly — ratings & comments per summary, and cover artwork
-- Run once in the Supabase SQL editor (after 0001 and 0002), or `supabase db push`.
-- Safe to run again: every statement is idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── cover artwork ──────────────────────────────────────────────────────────
-- Optional image URL (e.g. /covers/atomic-habits.webp). Empty = CSS-drawn cover.
alter table public.summaries add column if not exists cover_image text;

-- ─── reviews: one rating (1–5) + optional comment per user per summary ──────
create table if not exists public.summary_reviews (
  id            uuid primary key default gen_random_uuid(),
  summary_slug  text not null references public.summaries(slug) on update cascade on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  comment       text check (comment is null or char_length(comment) <= 1000),
  -- Snapshot of the author's public name/avatar (profiles are private, so we copy them here).
  author_name   text,
  author_avatar text,
  is_hidden     boolean not null default false,   -- moderation: admins can hide a review
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (summary_slug, user_id)
);
create index if not exists summary_reviews_slug_created_idx
  on public.summary_reviews (summary_slug, created_at desc);

drop trigger if exists summary_reviews_updated on public.summary_reviews;
create trigger summary_reviews_updated before update on public.summary_reviews
  for each row execute function public.set_updated_at();

-- Fill author fields from the profile and keep ownership honest (cannot review as someone else).
create or replace function public.summary_reviews_fill_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  if tg_op = 'INSERT' then
    new.user_id := coalesce(auth.uid(), new.user_id);
  else
    new.user_id := old.user_id;
    new.summary_slug := old.summary_slug;
    new.created_at := old.created_at;
  end if;
  new.comment := nullif(btrim(coalesce(new.comment, '')), '');
  select display_name, avatar_url into p from public.profiles where id = new.user_id;
  new.author_name := coalesce(nullif(btrim(p.display_name), ''), 'Bookly o‘quvchisi');
  new.author_avatar := p.avatar_url;
  return new;
end $$;

drop trigger if exists summary_reviews_author on public.summary_reviews;
create trigger summary_reviews_author before insert or update on public.summary_reviews
  for each row execute function public.summary_reviews_fill_author();

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.summary_reviews enable row level security;

drop policy if exists "reviews: read visible" on public.summary_reviews;
create policy "reviews: read visible" on public.summary_reviews
  for select using (not is_hidden or user_id = auth.uid() or public.is_admin());

drop policy if exists "reviews: insert own" on public.summary_reviews;
create policy "reviews: insert own" on public.summary_reviews
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.summaries s where s.slug = summary_slug and s.is_published)
  );

drop policy if exists "reviews: update own" on public.summary_reviews;
create policy "reviews: update own" on public.summary_reviews
  for update to authenticated using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "reviews: delete own" on public.summary_reviews;
create policy "reviews: delete own" on public.summary_reviews
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- Column-level rights: learners may only write rating + comment. is_hidden is for admins.
revoke insert, update on public.summary_reviews from anon, authenticated;
grant select on public.summary_reviews to anon, authenticated;
grant insert (summary_slug, rating, comment) on public.summary_reviews to authenticated;
grant update (rating, comment) on public.summary_reviews to authenticated;
grant delete on public.summary_reviews to authenticated;

-- Admins hide/unhide reviews through this function (column grants above block direct writes).
create or replace function public.set_review_hidden(p_review_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.summary_reviews set is_hidden = p_hidden where id = p_review_id;
end $$;
grant execute on function public.set_review_hidden(uuid, boolean) to authenticated;

-- ─── per-summary rating stats (public) ──────────────────────────────────────
create or replace view public.summary_rating_stats
with (security_invoker = true) as
select
  summary_slug,
  count(*)::int                                  as review_count,
  round(avg(rating)::numeric, 2)::float8         as avg_rating,
  count(*) filter (where rating = 5)::int        as stars_5,
  count(*) filter (where rating = 4)::int        as stars_4,
  count(*) filter (where rating = 3)::int        as stars_3,
  count(*) filter (where rating = 2)::int        as stars_2,
  count(*) filter (where rating = 1)::int        as stars_1,
  count(comment)::int                            as comment_count
from public.summary_reviews
where not is_hidden
group by summary_slug;

grant select on public.summary_rating_stats to anon, authenticated;

-- ─── analytics: allow the new event ─────────────────────────────────────────
alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'summary_view', 'session_start', 'summary_complete', 'practice_complete',
  'mode_change', 'ai_explain', 'premium_view', 'premium_interest', 'sign_in', 'waitlist_join',
  'review_submit'
));
