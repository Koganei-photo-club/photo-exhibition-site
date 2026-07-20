-- 2026年度 夏写真展「夏彩」の公開期間を登録します。
-- 作品番号が確定するまでは work_ids を空配列、回答受付を false にします。
-- 日時は Asia/Tokyo（UTC+09:00）です。

insert into public.survey_exhibitions (
  exhibition_key,
  title,
  work_ids,
  opens_at,
  closes_at,
  is_accepting_responses
) values (
  '2026-summer',
  '2026年度 夏写真展「夏彩」',
  array[]::text[],
  '2026-08-23 05:00:00+09',
  '2026-08-27 23:59:00+09',
  false
)
on conflict (exhibition_key) do update
set title = excluded.title,
    work_ids = excluded.work_ids,
    opens_at = excluded.opens_at,
    closes_at = excluded.closes_at,
    is_accepting_responses = false;

select
  exhibition_key,
  title,
  work_ids,
  opens_at at time zone 'Asia/Tokyo' as opens_at_jst,
  closes_at at time zone 'Asia/Tokyo' as closes_at_jst,
  is_accepting_responses
from public.survey_exhibitions
where exhibition_key = '2026-summer';
