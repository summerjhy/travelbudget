-- ============================================================
-- 관찰일지 리마인더 pg_cron 스케줄
--
-- 1분마다 send-journal-reminders Edge Function을 호출한다. 이 함수는
-- 요청 바디를 아예 읽지 않고 DB 상태(journal_reminders)만으로 발송
-- 대상을 정하므로, 호출 자체는 anon key로 충분하다. anon key는 클라이언트
-- 번들에도 그대로 노출되는 공개 값이라(RLS가 실제 보호선) 여기 커밋해도
-- 새로운 비밀 노출이 아니다.
--
-- 실제로 pg_cron이 1분마다 이 함수를 호출해 journal_reminders.last_sent_at을
-- 자동 갱신하는 것을 확인했다(수동 호출 없이 last_sent_at이 갱신됨).
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'journal-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://qyufjajkgttffilluygm.supabase.co/functions/v1/send-journal-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5dWZqYWprZ3R0ZmZpbGx1eWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MzYxMTcsImV4cCI6MjEwMzMxMjExN30.N_iHue1ASWrGtSc2ff04-n_cROhvahwfteXkdIyN8oc',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5dWZqYWprZ3R0ZmZpbGx1eWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MzYxMTcsImV4cCI6MjEwMzMxMjExN30.N_iHue1ASWrGtSc2ff04-n_cROhvahwfteXkdIyN8oc'
    ),
    body := '{}'::jsonb
  );
  $$
);
