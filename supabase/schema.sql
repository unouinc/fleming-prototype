-- ナスリ 最小リリース用のデータベース定義
-- Supabase の SQL Editor に貼り付けて、上から順に実行してください。

-- 1. 看護師のプロフィール（ログインユーザー1人につき1行）
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text not null,
  license text not null,
  years int not null check (years between 1 and 60),
  station text not null,
  workplace text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. 「話を聞きたい」の送信内容
create table if not exists public.talk_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  hospital text not null,
  job text default '',
  feeling text not null,
  people text[] not null default '{}',
  topics text[] not null default '{}',
  note text default '',
  way text not null,
  status text not null default '未対応',  -- 運営が更新する：未対応／病院に連絡済み／日程確定／見送り
  memo text default '',                    -- 運営メモ
  created_at timestamptz not null default now()
);
create index if not exists talk_requests_user_idx on public.talk_requests (user_id);

-- 3. 本人しか自分の行を読み書きできないようにする
alter table public.profiles enable row level security;
alter table public.talk_requests enable row level security;

drop policy if exists "own profile select" on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own talk select" on public.talk_requests;
drop policy if exists "own talk insert" on public.talk_requests;
create policy "own talk select" on public.talk_requests for select to authenticated using (auth.uid() = user_id);
create policy "own talk insert" on public.talk_requests for insert to authenticated with check (auth.uid() = user_id);

-- 利用者が status / memo を書き換えられないよう、登録時は必ず初期値にする
create or replace function public.talk_requests_defaults() returns trigger language plpgsql set search_path = public as $$
begin
  new.status := '未対応';
  new.memo := '';
  new.created_at := now();
  return new;
end $$;
drop trigger if exists talk_requests_defaults on public.talk_requests;
create trigger talk_requests_defaults before insert on public.talk_requests
  for each row execute function public.talk_requests_defaults();

-- 4. Slack 通知
--    通知先URLを入れる設定表。ポリシーを作らないので、利用者からは読めません。
create extension if not exists pg_net with schema extensions;
create table if not exists public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;

create or replace function public.notify_slack(msg text) returns void
language plpgsql security definer set search_path = public as $$
declare hook text;
begin
  select value into hook from public.app_config where key = 'slack_webhook_url';
  if hook is null or hook = '' then return; end if;
  perform net.http_post(url := hook, body := jsonb_build_object('text', msg));
exception when others then
  null; -- 通知の失敗で登録・送信そのものを止めない
end $$;
revoke all on function public.notify_slack(text) from public, anon, authenticated;

create or replace function public.on_profile_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_slack(
    '【新規登録】' || new.name || '（' || new.license || ' ' || new.years || '年目）' ||
    E'\n最寄駅: ' || new.station ||
    case when coalesce(new.workplace, '') <> '' then E'\nいまの職場: ' || new.workplace else '' end ||
    E'\nメール: ' || coalesce(new.email, ''));
  return new;
end $$;
revoke all on function public.on_profile_created() from public, anon, authenticated;
drop trigger if exists profile_created_notify on public.profiles;
create trigger profile_created_notify after insert on public.profiles
  for each row execute function public.on_profile_created();

create or replace function public.on_talk_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = new.user_id;
  perform public.notify_slack(
    '【話を聞きたい】' || new.hospital || case when coalesce(new.job, '') <> '' then '｜' || new.job else '' end ||
    E'\n送信者: ' || coalesce(p.name, '（プロフィール未登録）') || '（' || coalesce(p.license, '') || ' ' || coalesce(p.years::text, '') || '年目／最寄駅 ' || coalesce(p.station, '') || '）' ||
    E'\nメール: ' || coalesce(p.email, '') ||
    E'\n気持ち: ' || new.feeling ||
    E'\n話したい人: ' || case when cardinality(new.people) > 0 then array_to_string(new.people, '、') else 'おまかせ' end ||
    E'\n聞きたいこと: ' || case when cardinality(new.topics) > 0 or coalesce(new.note, '') <> '' then array_to_string(new.topics || case when coalesce(new.note, '') <> '' then array[new.note] else '{}'::text[] end, '、') else '特になし' end ||
    E'\n話し方: ' || new.way ||
    E'\n受付番号: ' || new.id);
  return new;
end $$;
revoke all on function public.on_talk_created() from public, anon, authenticated;
drop trigger if exists talk_created_notify on public.talk_requests;
create trigger talk_created_notify after insert on public.talk_requests
  for each row execute function public.on_talk_created();

-- 5. Slack の通知先URLを登録（URLを差し替えて、この1行だけ別に実行してください）
-- insert into public.app_config (key, value) values ('slack_webhook_url', 'https://hooks.slack.com/services/XXXX/XXXX/XXXX')
--   on conflict (key) do update set value = excluded.value;
