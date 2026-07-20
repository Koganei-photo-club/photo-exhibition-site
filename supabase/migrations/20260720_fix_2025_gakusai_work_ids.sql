update public.survey_exhibitions
set work_ids = array(select n::text from generate_series(1, 40) n)
where exhibition_key = '2025-gakusai';
