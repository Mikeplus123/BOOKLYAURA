-- ═══════════════════════════════════════════════════════════════════════════
-- Bookly — launch waitlist
-- Run once in the Supabase SQL editor (after 0001_bookly_init.sql).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.waitlist (
  id           bigint generated always as identity primary key,
  email        text not null,
  name         text,
  telegram     text,
  source       text not null default 'landing',
  user_id      uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  notified_at  timestamptz,           -- set when the launch notification has been sent
  unsubscribed boolean not null default false
);
create unique index if not exists waitlist_email_key on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- Nobody reads the list directly except admins. Sign-ups go through join_waitlist() below.
drop policy if exists "waitlist: admin read" on public.waitlist;
create policy "waitlist: admin read" on public.waitlist for select using (public.is_admin());
drop policy if exists "waitlist: admin update" on public.waitlist;
create policy "waitlist: admin update" on public.waitlist for update using (public.is_admin()) with check (public.is_admin());

-- Validated, duplicate-safe sign-up. Returns 'joined' or 'already'. Never reveals other entries.
create or replace function public.join_waitlist(p_email text, p_name text default null, p_telegram text default null, p_source text default 'landing')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_tg    text := nullif(regexp_replace(trim(coalesce(p_telegram, '')), '^(https?://)?(t\.me/)?@?', ''), '');
  v_new   boolean;
begin
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if v_tg is not null and v_tg !~ '^[A-Za-z0-9_]{4,32}$' then
    raise exception 'invalid_telegram' using errcode = '22023';
  end if;

  insert into public.waitlist (email, name, telegram, source, user_id)
  values (v_email, nullif(left(trim(coalesce(p_name, '')), 80), ''), v_tg, left(coalesce(p_source, 'landing'), 40), auth.uid())
  on conflict (lower(email)) do update
    set telegram = coalesce(excluded.telegram, waitlist.telegram),
        name = coalesce(excluded.name, waitlist.name),
        user_id = coalesce(waitlist.user_id, excluded.user_id),
        unsubscribed = false
  returning (xmax = 0) into v_new;   -- xmax = 0 only for a freshly inserted row

  return case when v_new then 'joined' else 'already' end;
end $$;

grant execute on function public.join_waitlist(text, text, text, text) to anon, authenticated;

-- Lets a signed-in user see whether they are already on the list (no other data exposed).
create or replace function public.on_waitlist()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.waitlist w
    where w.user_id = auth.uid()
       or lower(w.email) = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
  );
$$;
grant execute on function public.on_waitlist() to authenticated;

-- Allow the new analytics event.
alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'summary_view', 'session_start', 'summary_complete', 'practice_complete',
  'mode_change', 'ai_explain', 'premium_view', 'premium_interest', 'sign_in', 'waitlist_join'
));
