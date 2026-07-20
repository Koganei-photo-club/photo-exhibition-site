-- Supabase SQL Editor で実行してください。
-- 実行後、Authentication > Providers で Anonymous Sign-Ins を有効にします。

create table if not exists public.survey_exhibitions (
  id bigint generated always as identity primary key,
  exhibition_key text not null unique,
  title text not null,
  work_ids text[] not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  is_accepting_responses boolean not null default false,
  created_at timestamptz not null default now(),
  constraint survey_exhibitions_period check (opens_at < closes_at)
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  exhibition_id bigint not null references public.survey_exhibitions(id) on delete restrict,
  respondent_id uuid not null references auth.users(id) on delete restrict,
  overall_comment text not null default '',
  submitted_at timestamptz not null default now(),
  constraint one_response_per_respondent unique (exhibition_id, respondent_id),
  constraint overall_comment_length check (char_length(overall_comment) <= 2000)
);

create table if not exists public.survey_response_selections (
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  work_id text not null,
  comment text not null default '',
  position smallint not null,
  primary key (response_id, work_id),
  constraint selection_position check (position between 1 and 3),
  constraint work_comment_length check (char_length(comment) <= 1000)
);

alter table public.survey_exhibitions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_response_selections enable row level security;

revoke all on public.survey_exhibitions from anon, authenticated;
revoke all on public.survey_responses from anon, authenticated;
revoke all on public.survey_response_selections from anon, authenticated;

create or replace function public.submit_survey(
  p_exhibition_key text,
  p_overall_comment text,
  p_selections jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_exhibition public.survey_exhibitions%rowtype;
  v_response_id uuid;
  v_count integer;
  v_distinct_count integer;
  v_invalid_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if jsonb_typeof(p_selections) <> 'array' then
    raise exception 'selections must be an array' using errcode = '22023';
  end if;

  select * into v_exhibition
  from public.survey_exhibitions
  where exhibition_key = p_exhibition_key
  for share;

  if not found then
    raise exception 'unknown exhibition' using errcode = '22023';
  end if;

  if not v_exhibition.is_accepting_responses or now() < v_exhibition.opens_at or now() > v_exhibition.closes_at then
    raise exception 'survey is closed' using errcode = '55000';
  end if;

  select count(*), count(distinct item->>'work_id')
    into v_count, v_distinct_count
  from jsonb_array_elements(p_selections) item;

  if v_count < 1 or v_count > 3 or v_count <> v_distinct_count then
    raise exception 'select between one and three distinct works' using errcode = '22023';
  end if;

  select count(*) into v_invalid_count
  from jsonb_array_elements(p_selections) item
  where nullif(btrim(item->>'work_id'), '') is null
     or not ((item->>'work_id') = any(v_exhibition.work_ids))
     or char_length(coalesce(item->>'comment', '')) > 1000;

  if v_invalid_count > 0 then
    raise exception 'invalid work or comment' using errcode = '22023';
  end if;

  if char_length(coalesce(p_overall_comment, '')) > 2000 then
    raise exception 'overall comment is too long' using errcode = '22023';
  end if;

  insert into public.survey_responses (exhibition_id, respondent_id, overall_comment)
  values (v_exhibition.id, v_user_id, coalesce(p_overall_comment, ''))
  returning id into v_response_id;

  insert into public.survey_response_selections (response_id, work_id, comment, position)
  select v_response_id, item->>'work_id', coalesce(item->>'comment', ''), ordinality::smallint
  from jsonb_array_elements(p_selections) with ordinality as selection(item, ordinality);

  return v_response_id;
end;
$$;

revoke all on function public.submit_survey(text, text, jsonb) from public, anon;
grant execute on function public.submit_survey(text, text, jsonb) to authenticated;

create or replace function public.get_exhibition_public_state(
  p_exhibition_key text
) returns table (
  state text,
  opens_at timestamptz,
  closes_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case
      when now() < e.opens_at then 'upcoming'
      when now() <= e.closes_at then 'open'
      else 'closed'
    end,
    e.opens_at,
    e.closes_at
  from public.survey_exhibitions e
  where e.exhibition_key = p_exhibition_key;
$$;

revoke all on function public.get_exhibition_public_state(text) from public;
grant execute on function public.get_exhibition_public_state(text) to anon, authenticated;

-- 2025学祭の動作確認用。実運用時は日時と作品番号を対象展示に合わせて変更します。
insert into public.survey_exhibitions (
  exhibition_key, title, work_ids, opens_at, closes_at, is_accepting_responses
) values (
  '2025-gakusai',
  '2025年度 学祭写真展「燐光」',
  array(select n::text from generate_series(1, 40) n),
  '2025-11-01 10:00:00+09',
  '2025-11-03 16:00:00+09',
  false
)
on conflict (exhibition_key) do update
set title = excluded.title,
    work_ids = excluded.work_ids;
