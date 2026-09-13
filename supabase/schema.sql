-- DevTrackAcademy Certificate Claim Platform
-- Safe to run more than once. Apply in the Supabase SQL editor, then import students.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  -- First and last day of the workshop. The certificate prints a single date when they
  -- match (or when the end date is null) and a range otherwise.
  workshop_start_date date not null,
  workshop_end_date date,
  -- Optional override for the printed issue date. Defaults to the last day of the workshop.
  certificate_issue_date date,
  certificate_prefix text not null default 'DTA-2026-DVOPS',
  certificate_seq integer not null default 0,
  -- Printed on the certificate face; keeps the wording configurable per workshop.
  event_name text,
  course_name text,
  format_label text,
  projects_completed integer,
  promo_code text,
  interview_platform_url text,
  dev_tools_url text,
  resources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workshops add column if not exists certificate_seq integer not null default 0;
alter table public.workshops add column if not exists event_name text;
alter table public.workshops add column if not exists course_name text;
alter table public.workshops add column if not exists format_label text;
alter table public.workshops add column if not exists projects_completed integer;
alter table public.workshops add column if not exists workshop_end_date date;
alter table public.workshops add column if not exists certificate_issue_date date;

-- Rename the original single-date column, once, for projects created before start/end existed.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'workshops' and column_name = 'workshop_date')
     and not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'workshops' and column_name = 'workshop_start_date')
  then
    alter table public.workshops rename column workshop_date to workshop_start_date;
  end if;
end $$;
alter table public.workshops add column if not exists workshop_start_date date;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Registered name from the roster. Never overwritten, so the original is always auditable.
  name text not null,
  -- Student-supplied correction. When set, this is what the certificate prints.
  certificate_name text,
  roll_no text,
  branch text,
  campus text,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  eligible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(email, workshop_id)
);
alter table public.students add column if not exists certificate_name text;
create index if not exists students_email_idx on public.students (email);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  workshop_rating smallint not null check (workshop_rating between 1 and 5),
  understanding_rating smallint not null check (understanding_rating between 1 and 5),
  implementation_rating smallint not null check (implementation_rating between 1 and 5),
  resource_person_rating smallint not null check (resource_person_rating between 1 and 5),
  liked text not null check (char_length(liked) <= 2000),
  disliked text check (char_length(disliked) <= 2000),
  improvements text not null check (char_length(improvements) <= 2000),
  internship_interest text not null check (internship_interest in ('Yes','Maybe','No')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, workshop_id)
);

create table if not exists public.certificate_claims (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  certificate_number text not null unique,
  certificate_path text not null,
  claimed_at timestamptz not null default now(),
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, workshop_id)
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin'))
);

-- ---------------------------------------------------------------- functions

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

-- Allocates the next sequential certificate number for a workshop.
-- UPDATE ... RETURNING takes a row lock, so concurrent claims are serialised by Postgres
-- and can never receive the same number.
create or replace function public.next_certificate_number(p_workshop uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_prefix text;
  v_seq integer;
begin
  update public.workshops
     set certificate_seq = certificate_seq + 1
   where id = p_workshop
  returning certificate_prefix, certificate_seq into v_prefix, v_seq;

  if v_prefix is null then
    raise exception 'Unknown workshop %', p_workshop;
  end if;

  return v_prefix || '-' || lpad(v_seq::text, 6, '0');
end;
$$;
-- Only the server (service role) may allocate numbers.
revoke all on function public.next_certificate_number(uuid) from public, anon, authenticated;
grant execute on function public.next_certificate_number(uuid) to service_role;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists workshops_updated on public.workshops;
drop trigger if exists students_updated on public.students;
drop trigger if exists feedback_updated on public.feedback;
drop trigger if exists certificate_claims_updated on public.certificate_claims;
create trigger workshops_updated before update on public.workshops for each row execute function public.touch_updated_at();
create trigger students_updated before update on public.students for each row execute function public.touch_updated_at();
create trigger feedback_updated before update on public.feedback for each row execute function public.touch_updated_at();
create trigger certificate_claims_updated before update on public.certificate_claims for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- row level security
-- Every write in the application goes through the service role on the server. These policies
-- exist so that a leaked anon key still cannot read another student's data.

alter table public.workshops enable row level security;
alter table public.students enable row level security;
alter table public.feedback enable row level security;
alter table public.certificate_claims enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists "student sees own workshop" on public.workshops;
drop policy if exists "student sees own registration" on public.students;
drop policy if exists "student sees own feedback" on public.feedback;
drop policy if exists "student sees own certificate" on public.certificate_claims;
drop policy if exists "admins manage registrations" on public.students;
drop policy if exists "admins manage workshops" on public.workshops;
drop policy if exists "admins manage feedback" on public.feedback;
drop policy if exists "admins manage claims" on public.certificate_claims;
drop policy if exists "admins read roles" on public.user_roles;

create policy "student sees own workshop" on public.workshops for select to authenticated
  using (exists(select 1 from public.students s where s.workshop_id = workshops.id and lower(s.email) = lower(auth.jwt() ->> 'email')) or public.is_admin());
create policy "student sees own registration" on public.students for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email') or public.is_admin());
create policy "student sees own feedback" on public.feedback for select to authenticated
  using (exists(select 1 from public.students s where s.id = feedback.student_id and lower(s.email) = lower(auth.jwt() ->> 'email')) or public.is_admin());
create policy "student sees own certificate" on public.certificate_claims for select to authenticated
  using (exists(select 1 from public.students s where s.id = certificate_claims.student_id and lower(s.email) = lower(auth.jwt() ->> 'email')) or public.is_admin());

create policy "admins manage registrations" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage workshops" on public.workshops for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage feedback" on public.feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage claims" on public.certificate_claims for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read roles" on public.user_roles for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- storage
-- Create a PRIVATE bucket named `certificates` (Storage > New bucket, "Public bucket" off).
-- No anon/authenticated policies are added: PDFs are served only through short-lived signed
-- URLs minted by the server.
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- seed
insert into public.workshops (name, slug, workshop_start_date, workshop_end_date, certificate_prefix, event_name, course_name, format_label, projects_completed, promo_code, interview_platform_url, dev_tools_url, resources)
values (
  'DevOps & Docker Workshop',
  'devops-docker-2026',
  '2026-09-11',
  '2026-09-12',
  'DTA-2026-DVOPS',
  'Codex''26',
  'DevOps & Docker',
  'Live Hands-on Workshop',
  3,
  'DTADEVOPS2026',
  'https://interview.devtrackacademy.com',
  'https://workshop.devtrackacademy.com/workshops/free-dev-tools',
  '[{"title":"Workshop Slides","url":"https://gniworkshop.devtrackacademy.com/","description":"Every deck from the sessions"}]'::jsonb
)
on conflict (slug) do nothing;

-- Backfill the certificate wording on an existing workshop row (the insert above is a no-op
-- once the row exists). Safe to re-run: it never overwrites a value you have customised.
update public.workshops set
  event_name          = coalesce(event_name, 'Codex''26'),
  course_name         = coalesce(course_name, 'DevOps & Docker'),
  format_label        = coalesce(format_label, 'Live Hands-on Workshop'),
  projects_completed  = coalesce(projects_completed, 3),
  -- Set explicitly, not coalesced: the seed insert above is a no-op once the row exists,
  -- so these are the only way to correct an already-created workshop.
  workshop_start_date = date '2026-09-11',
  workshop_end_date   = date '2026-09-12',
  dev_tools_url       = 'https://workshop.devtrackacademy.com/workshops/free-dev-tools',
  resources           = '[{"title":"Workshop Slides","url":"https://gniworkshop.devtrackacademy.com/","description":"Every deck from the sessions"}]'::jsonb
where slug = 'devops-docker-2026';

-- Grant yourself admin access after signing in once at /admin/login:
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'you@devtrackacademy.com'
--   on conflict (user_id) do update set role = 'admin';
