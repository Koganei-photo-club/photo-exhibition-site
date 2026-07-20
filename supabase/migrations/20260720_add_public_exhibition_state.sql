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
