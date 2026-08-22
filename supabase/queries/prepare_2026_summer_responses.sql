-- 2026年度夏写真展の全28作品を投票対象として登録します。
-- 画像掲載の同意有無にかかわらず、会場展示作品は投票対象です。
-- このSQLでは回答受付を開始しません。

update public.survey_exhibitions
set work_ids = array(select n::text from generate_series(1, 28) n),
    is_accepting_responses = false
where exhibition_key = '2026-summer';

select
  exhibition_key,
  title,
  work_ids,
  opens_at at time zone 'Asia/Tokyo' as opens_at_jst,
  closes_at at time zone 'Asia/Tokyo' as closes_at_jst,
  is_accepting_responses
from public.survey_exhibitions
where exhibition_key = '2026-summer';
