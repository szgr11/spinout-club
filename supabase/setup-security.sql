-- Run once atomically. Existing records and columns are retained; passwords never leave Postgres.
-- Credentials are converted in place to private bcrypt hashes, then obsolete public copies are neutralized.
begin;
create schema if not exists spinout_private;
revoke all on schema spinout_private from public, anon, authenticated;
create table spinout_private.credentials (
  username text primary key, password_hash text not null,
  updated_at timestamptz not null default now()
);
insert into spinout_private.credentials(username,password_hash)
select username, extensions.crypt(password,extensions.gen_salt('bf',12)) from public.profiles where role <> 'system'
union all
select username, extensions.crypt(password,extensions.gen_salt('bf',12)) from public.pending_users
on conflict do nothing;
-- Verify every copied credential before neutralizing the old password fields.
do $$ begin
 if exists(select 1 from public.profiles p left join spinout_private.credentials c using(username)
   where p.role <> 'system' and (c.password_hash is null or extensions.crypt(p.password,c.password_hash) is distinct from c.password_hash))
 or exists(select 1 from public.pending_users p left join spinout_private.credentials c using(username)
   where c.password_hash is null or extensions.crypt(p.password,c.password_hash) is distinct from c.password_hash)
 then raise exception 'Credential verification failed; migration rolled back'; end if;
end $$;
update public.profiles set password='[secured]';
update public.pending_users set password='[secured]';
alter table public.profiles alter column password set default '[secured]';
alter table public.pending_users alter column password set default '[secured]';
alter table public.profiles add constraint no_plaintext_password check(password='[secured]');
alter table public.pending_users add constraint no_plaintext_password check(password='[secured]');
-- Scrub password copies at every depth in the retired store while retaining all other fields.
create function spinout_private.scrub_passwords(v jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; begin
 if jsonb_typeof(v)='object' then
  select coalesce(jsonb_object_agg(key,case when key='password' then '"[secured]"'::jsonb else spinout_private.scrub_passwords(value) end),'{}'::jsonb) into result from jsonb_each(v);
 elsif jsonb_typeof(v)='array' then
  select coalesce(jsonb_agg(spinout_private.scrub_passwords(value) order by ordinal),'[]'::jsonb) into result from jsonb_array_elements(v) with ordinality a(value,ordinal);
 else result:=v; end if;
 return result;
end $$;
revoke all on function spinout_private.scrub_passwords(jsonb) from public,anon,authenticated;
update public.app_kv set value=spinout_private.scrub_passwords(value) where jsonb_path_exists(value,'$.**.password');
alter table public.profiles add column auth_user_id uuid unique references auth.users(id);
alter table public.pending_users add column auth_user_id uuid unique references auth.users(id);
create table spinout_private.rate_limits (key text primary key, window_start timestamptz not null, attempts integer not null);
create table spinout_private.config (key text primary key, vault_id uuid not null);
alter table spinout_private.credentials enable row level security;
alter table spinout_private.rate_limits enable row level security;
alter table spinout_private.config enable row level security;
revoke all on all tables in schema spinout_private from public,anon,authenticated;

create function spinout_private.member_name() returns text language sql stable security definer set search_path='' as $$
 select username from public.profiles where auth_user_id=(select auth.uid()) and not coalesce(banned,false) and role in ('admin','member')
$$;
create function spinout_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where auth_user_id=(select auth.uid()) and role='admin' and not coalesce(banned,false))
$$;
grant usage on schema spinout_private to anon,authenticated;
revoke all on function spinout_private.member_name(),spinout_private.is_admin() from public;
grant execute on function spinout_private.member_name(),spinout_private.is_admin() to anon,authenticated;

-- Remove the old allow-everything policies, including the retired store.
do $$ declare p record; begin
 for p in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('profiles','pending_users','laps','pending_laps','reports','tracks','billboards','app_kv') loop
 execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
 end loop;
end $$;
revoke all on public.app_kv from anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['profiles','pending_users','laps','pending_laps','reports','tracks','billboards'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy admin_access on public.%I for all to authenticated using ((select spinout_private.is_admin())) with check ((select spinout_private.is_admin()))',t);
 end loop;
end $$;
create policy member_profiles on public.profiles for select to authenticated using ((select spinout_private.member_name()) is not null or auth_user_id=(select auth.uid()));
create policy member_laps on public.laps for select to authenticated using ((select spinout_private.member_name()) is not null);
create policy member_tracks on public.tracks for select to authenticated using ((select spinout_private.member_name()) is not null);
create policy member_billboards on public.billboards for select to authenticated using ((select spinout_private.member_name()) is not null);
create policy own_application on public.pending_users for select to authenticated using (auth_user_id=(select auth.uid()));
create policy own_pending_laps on public.pending_laps for select to authenticated using (submitted_by=(select spinout_private.member_name()));
create policy submit_pending_lap on public.pending_laps for insert to authenticated with check (submitted_by=(select spinout_private.member_name()) and length(driver) between 1 and 80 and length(time) between 4 and 20 and coalesce(length(image),0)<2800000);
create policy own_reports on public.reports for select to authenticated using (reporter=(select spinout_private.member_name()));
create policy submit_report on public.reports for insert to authenticated with check (reporter=(select spinout_private.member_name()) and length(reason) between 1 and 2000);
create unique index reports_once_per_member on public.reports(lap_id,reporter);
create index pending_laps_submitter on public.pending_laps(submitted_by);
create index reports_reporter on public.reports(reporter);
create index laps_track_date on public.laps(track,date);

create function public.spinout_account() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('username',p.username,'nickname',p.nickname,'role',p.role,'banned',p.banned,'has_password',exists(select 1 from spinout_private.credentials c where c.username=p.username)) from public.profiles p where p.auth_user_id=(select auth.uid())
$$;
revoke all on function public.spinout_account() from public,anon;
grant execute on function public.spinout_account() to authenticated;

create function public.spinout_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer; begin
 insert into spinout_private.rate_limits values(p_key,now(),1) on conflict(key) do update set
 attempts=case when spinout_private.rate_limits.window_start < now()-make_interval(secs=>p_seconds) then 1 else spinout_private.rate_limits.attempts+1 end,
 window_start=case when spinout_private.rate_limits.window_start < now()-make_interval(secs=>p_seconds) then now() else spinout_private.rate_limits.window_start end
 returning attempts into n;
 delete from spinout_private.rate_limits where window_start < now()-interval '2 days';
 return n<=p_limit;
end $$;
create function public.spinout_verify_legacy(p_username text,p_password text) returns jsonb language plpgsql security definer set search_path='' as $$
declare h text; p public.profiles; begin
 select * into p from public.profiles where username=p_username and role in ('admin','member') and not coalesce(banned,false);
 select password_hash into h from spinout_private.credentials where username=p_username;
 if p_password is null or octet_length(p_password)>72 or h is null or p.username is null then return null; end if;
 if extensions.crypt(p_password,h)<>h then return null; end if;
 return jsonb_build_object('username',p.username,'auth_user_id',p.auth_user_id);
end $$;
create function public.spinout_attach_auth(p_username text,p_auth_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.profiles set auth_user_id=p_auth_id where username=p_username and (auth_user_id is null or auth_user_id=p_auth_id);
 if not found then raise exception 'Account already linked'; end if;
end $$;
create function public.spinout_security_config() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_object_agg(c.key,v.decrypted_secret) from spinout_private.config c join vault.decrypted_secrets v on v.id=c.vault_id
$$;
revoke all on function public.spinout_rate_limit(text,integer,integer),public.spinout_verify_legacy(text,text),public.spinout_attach_auth(text,uuid),public.spinout_security_config() from public,anon,authenticated;
grant execute on function public.spinout_rate_limit(text,integer,integer),public.spinout_verify_legacy(text,text),public.spinout_attach_auth(text,uuid),public.spinout_security_config() to service_role;

create function public.spinout_submit_application(p_auth_id uuid,p_username text,p_nickname text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=p_auth_id and email_confirmed_at is not null and deleted_at is null) then raise exception 'Verify your email first'; end if;
 if p_username !~ '^[a-z0-9_]{3,24}$' or length(p_nickname) not between 1 and 60 or length(p_reason) not between 10 and 1000 then raise exception 'Check username, display name and application'; end if;
 if exists(select 1 from public.profiles where username=p_username or auth_user_id=p_auth_id) or exists(select 1 from public.pending_users where username=p_username or auth_user_id=p_auth_id) then raise exception 'An account or application already exists'; end if;
 insert into public.pending_users(username,nickname,reason,submitted_at,auth_user_id) values(p_username,p_nickname,p_reason,(extract(epoch from now())*1000)::bigint,p_auth_id);
end $$;
revoke all on function public.spinout_submit_application(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.spinout_submit_application(uuid,text,text,text) to service_role;

create function public.spinout_approve_user(p_username text) returns void language plpgsql security definer set search_path='' as $$
declare p public.pending_users; begin
 if not spinout_private.is_admin() then raise exception 'Admin required'; end if;
 select * into p from public.pending_users where username=p_username for update;
 if p.username is null then raise exception 'Application not found'; end if;
 insert into public.profiles(username,nickname,role,banned,joined_at,auth_user_id) values(p.username,p.nickname,'member',false,(extract(epoch from now())*1000)::bigint,p.auth_user_id);
 delete from public.pending_users where username=p_username;
end $$;
revoke all on function public.spinout_approve_user(text) from public,anon;
grant execute on function public.spinout_approve_user(text) to authenticated;

create function public.spinout_change_password(p_old text,p_new text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u text; h text; begin
 u:=spinout_private.member_name();
 if u is null then return jsonb_build_object('error','Approved member required'); end if;
 if not public.spinout_rate_limit('password:'||auth.uid()::text,5,900) then return jsonb_build_object('error','Please wait before trying again'); end if;
 select password_hash into h from spinout_private.credentials where username=u;
 if p_old is null or octet_length(p_old)>72 or h is null or extensions.crypt(p_old,h)<>h then return jsonb_build_object('error','Current password is incorrect'); end if;
 if p_new is null or length(p_new)<12 or octet_length(p_new)>72 then return jsonb_build_object('error','Use 12 or more characters, up to 72 bytes'); end if;
 update spinout_private.credentials set password_hash=extensions.crypt(p_new,extensions.gen_salt('bf',12)),updated_at=now() where username=u;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.spinout_change_password(text,text) from public,anon;
grant execute on function public.spinout_change_password(text,text) to authenticated;
commit;
