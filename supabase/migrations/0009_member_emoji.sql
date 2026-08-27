-- ------------------------------------------------------------
-- 참여자 이모지
--
-- people 이 아니라 trip_members 에 붙인다. people 은 여행 간 공유 테이블이라
-- 거기 넣으면 다른 여행의 그 사람 이모지까지 바뀐다. 여행마다 다른 걸
-- 쓰고 싶을 수도 있고.
--
-- 빈 문자열이 기본값이다 — 안 고르면 아무것도 안 붙는다. null 대신 빈
-- 문자열을 쓰는 이유는 화면에서 `emoji + name` 으로 그냥 이어붙이기 위해서다.
-- ------------------------------------------------------------

alter table public.trip_members
  add column if not exists emoji text not null default '';

comment on column public.trip_members.emoji is
  '참여자 이름 앞에 붙는 이모지. 안 고르면 빈 문자열.';
