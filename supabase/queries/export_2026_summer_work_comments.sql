-- 2026年度 夏写真展「夏彩」の作品別感想を、作者共有用に抽出します。
-- 回答者ID、回答ID、写真展全体への感想は出力しません。
-- 自由記述に個人情報や不適切な内容がないか確認してから作者へ共有してください。

select
  s.work_id,
  s.comment,
  r.submitted_at at time zone 'Asia/Tokyo' as submitted_at_jst
from public.survey_response_selections s
join public.survey_responses r
  on r.id = s.response_id
join public.survey_exhibitions e
  on e.id = r.exhibition_id
where e.exhibition_key = '2026-summer'
  and nullif(btrim(s.comment), '') is not null
order by s.work_id, r.submitted_at;
