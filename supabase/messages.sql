-- ============================================================
-- メッセージ（「話を聞きたい」1件ごとのやりとり）
-- 看護師：自分の申し込みのスレッドだけ読める・送れる
-- 運営：全スレッドを読める・病院として返信できる（代理送信）
-- ============================================================
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  talk_id bigint not null references public.talk_requests(id) on delete cascade,
  sender text not null check (sender in ('nurse', 'hospital')),
  sender_name text not null default '',
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_talk_idx on public.messages (talk_id, created_at);

alter table public.messages enable row level security;

-- 送り主・時刻・既読は利用者に決めさせない
create or replace function public.messages_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.talk_requests; p public.profiles;
begin
  select * into t from public.talk_requests where id = new.talk_id;
  if public.is_admin() then
    new.sender := 'hospital';
    if coalesce(btrim(new.sender_name), '') = '' then new.sender_name := t.hospital; end if;
  else
    select * into p from public.profiles where id = auth.uid();
    new.sender := 'nurse';
    new.sender_name := coalesce(p.name, '');
  end if;
  new.body := btrim(new.body);
  new.read_at := null;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists messages_defaults on public.messages;
create trigger messages_defaults before insert on public.messages
  for each row execute function public.messages_defaults();

drop policy if exists "messages select" on public.messages;
create policy "messages select" on public.messages for select using (
  public.is_admin() or exists (select 1 from public.talk_requests t where t.id = talk_id and t.user_id = auth.uid())
);
drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert with check (
  public.is_admin() or exists (select 1 from public.talk_requests t where t.id = talk_id and t.user_id = auth.uid())
);

-- 既読にする：看護師は病院からのメッセージを、運営は看護師からのメッセージを
create or replace function public.mark_read(p_talk bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    update public.messages set read_at = now() where talk_id = p_talk and sender = 'nurse' and read_at is null;
  else
    update public.messages m set read_at = now()
      from public.talk_requests t
     where m.talk_id = p_talk and t.id = m.talk_id and t.user_id = auth.uid()
       and m.sender = 'hospital' and m.read_at is null;
  end if;
end $$;
revoke all on function public.mark_read(bigint) from public;
grant execute on function public.mark_read(bigint) to authenticated;

-- 看護師の未読数（ナビのバッジ用）
create or replace function public.unread_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.messages m join public.talk_requests t on t.id = m.talk_id
   where t.user_id = auth.uid() and m.sender = 'hospital' and m.read_at is null;
$$;
revoke all on function public.unread_count() from public;
grant execute on function public.unread_count() to authenticated;

-- 通知：看護師→運営は Slack、病院→看護師はメール（Resend の APIキーが Vault にあるときだけ）
create or replace function public.on_message_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.talk_requests; p public.profiles; k text; site text;
begin
  select * into t from public.talk_requests where id = new.talk_id;
  select * into p from public.profiles where id = t.user_id;
  if new.sender = 'nurse' then
    perform public.notify_slack('【メッセージ】' || t.hospital || '｜' || coalesce(nullif(p.name, ''), '看護師') ||
      E'\n' || left(new.body, 300) || E'\n受付番号: ' || t.id || '（管理画面の申し込みから返信できます）');
  else
    -- APIキーは暗号化された保管庫（Vault）から読む。Supabase の Vault に resend_api_key という名前で登録する
    select decrypted_secret into k from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    select value into site from public.app_config where key = 'site_url';
    if coalesce(k, '') <> '' and coalesce(p.email, '') <> '' then
      perform net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || k, 'Content-Type', 'application/json'),
        body := jsonb_build_object(
          'from', 'ナスリー <noreply@nasuri.unou.design>',
          'to', jsonb_build_array(p.email),
          'subject', t.hospital || 'からメッセージが届きました',
          'text', coalesce(nullif(p.name, ''), '') || E'さん\n\n' || t.hospital || E'から、ナスリーにメッセージが届きました。\n内容は下のリンクから確認できます。\n\n' ||
                  coalesce(nullif(site, ''), 'https://unouinc.github.io/fleming-prototype/') || E'scouts.html\n\n' ||
                  E'このメールは送信専用です。返信はナスリーのメッセージ画面からお願いします。\n― ナスリー（運営：unou株式会社）'));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists message_created_notify on public.messages;
create trigger message_created_notify after insert on public.messages
  for each row execute function public.on_message_created();
