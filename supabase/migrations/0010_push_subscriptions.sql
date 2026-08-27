-- 관리자 푸시 알림 구독.
--
-- 참여자가 여행에 새로 들어오면 관리자 폰으로 알림을 보낸다. 메일 서비스를
-- 따로 붙이지 않고 웹 푸시로 처리한다 — 외부 가입이 필요 없고 VAPID 키만
-- 있으면 되기 때문.
--
-- 이 테이블은 관리자 기기 하나(또는 몇 개)만 담는다. 참여자 기기는 넣지
-- 않는다. 그래서 행이 아주 적고, 여행에 종속되지 않는다(전역).

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- 브라우저가 발급한 push endpoint URL. 기기마다 고유하다.
  endpoint text not null unique,
  -- 메시지 암호화에 쓰는 값들. 구독 객체의 keys.p256dh / keys.auth.
  p256dh text not null,
  auth text not null,
  -- 어느 기기인지 알아보기 위한 메모(예: "갤럭시").
  label text,
  created_at timestamptz not null default now()
);

-- RLS: 클라이언트는 이 테이블을 직접 읽거나 쓸 수 없다.
-- 등록은 notify-join Edge Function 이 ADMIN_PASSWORD 확인 후 service_role 로,
-- 발송 시 조회도 같은 함수가 service_role 로 한다. 정책을 하나도 만들지
-- 않으면 anon 은 아무것도 못 한다 — endpoint 가 유출되면 남이 관리자 폰으로
-- 임의의 알림을 보낼 수 있으므로 열어둘 이유가 없다.
alter table push_subscriptions enable row level security;
