begin;
-- Immutable documents and acceptance evidence are never client-writable.
create table spinout_private.terms_documents (
 version text primary key,
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 document jsonb not null,
 active boolean not null default false,
 published_at timestamptz not null default now(),
 unique(version,content_hash)
);
create unique index one_active_terms on spinout_private.terms_documents(active) where active;
create table spinout_private.terms_reviews (
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 version text not null references spinout_private.terms_documents(version),
 review_id uuid not null unique default gen_random_uuid(),
 opened_at timestamptz not null default clock_timestamp(),
 bottom_at timestamptz,
 primary key(auth_user_id,version)
);
create table spinout_private.terms_acceptances (
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 version text not null,
 content_hash text not null,
 reviewed_at timestamptz not null,
 bottom_at timestamptz not null,
 accepted_at timestamptz not null default clock_timestamp(),
 primary key(auth_user_id,version),
 foreign key(version,content_hash) references spinout_private.terms_documents(version,content_hash),
 check(bottom_at>=reviewed_at and accepted_at>=bottom_at+interval '12 seconds')
);
alter table spinout_private.terms_documents enable row level security;
alter table spinout_private.terms_reviews enable row level security;
alter table spinout_private.terms_acceptances enable row level security;
revoke all on spinout_private.terms_documents,spinout_private.terms_reviews,spinout_private.terms_acceptances from public,anon,authenticated;

-- PUBLISHED_DOCUMENT is inserted by the release script below, never by a browser.
-- Superseded draft omitted from public source; the current release seeds the Terms.

create function spinout_private.has_current_terms(p_auth_id uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select p_auth_id is not null and exists(
  select 1 from spinout_private.terms_documents d join spinout_private.terms_acceptances a
   on a.version=d.version and a.content_hash=d.content_hash
  where d.active and a.auth_user_id=p_auth_id)
$$;
create function spinout_private.terms_status() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 select jsonb_build_object('version',d.version,'content_hash',d.content_hash,
  'accepted',a.auth_user_id is not null,'accepted_at',a.accepted_at)
 into result from spinout_private.terms_documents d left join spinout_private.terms_acceptances a
  on a.version=d.version and a.content_hash=d.content_hash and a.auth_user_id=auth.uid() where d.active;
 if result is null then raise exception 'Terms unavailable';end if;
 return result;
end $$;
create function spinout_private.begin_terms_review(p_version text,p_hash text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if not exists(select 1 from spinout_private.terms_documents where active and version=p_version and content_hash=p_hash) then raise exception 'Terms changed; refresh the page';end if;
 insert into spinout_private.terms_reviews(auth_user_id,version) values(auth.uid(),p_version)
 on conflict(auth_user_id,version) do update set review_id=gen_random_uuid(),opened_at=clock_timestamp(),bottom_at=null
 returning review_id into result;
 return result;
end $$;
create function spinout_private.terms_bottom(p_review_id uuid) returns void
 language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 update spinout_private.terms_reviews r set bottom_at=coalesce(r.bottom_at,clock_timestamp())
 where r.review_id=p_review_id and r.auth_user_id=auth.uid()
  and r.opened_at>clock_timestamp()-interval '1 hour'
  and exists(select 1 from spinout_private.terms_documents d where d.version=r.version and d.active);
 if not found then raise exception 'Review expired; reopen the Terms';end if;
end $$;
create function spinout_private.accept_terms(p_version text,p_hash text,p_review_id uuid,p_agreed boolean) returns void
 language plpgsql security definer set search_path='' as $$
declare review spinout_private.terms_reviews;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if p_agreed is distinct from true then raise exception 'Choose whether to agree';end if;
 if not exists(select 1 from spinout_private.terms_documents where active and version=p_version and content_hash=p_hash) then raise exception 'Terms changed; refresh the page';end if;
 select * into review from spinout_private.terms_reviews where review_id=p_review_id and auth_user_id=auth.uid() and version=p_version for update;
 if not found or review.opened_at<clock_timestamp()-interval '1 hour' or review.bottom_at is null then raise exception 'Open and scroll through the Terms first';end if;
 if clock_timestamp()<review.bottom_at+interval '12 seconds' then raise exception 'Wait 12 seconds after reaching the bottom';end if;
 insert into spinout_private.terms_acceptances(auth_user_id,version,content_hash,reviewed_at,bottom_at)
 values(auth.uid(),p_version,p_hash,review.opened_at,review.bottom_at) on conflict do nothing;
end $$;
revoke all on function spinout_private.has_current_terms(uuid),spinout_private.terms_status(),spinout_private.begin_terms_review(text,text),spinout_private.terms_bottom(uuid),spinout_private.accept_terms(text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function spinout_private.has_current_terms(uuid) to anon,authenticated;
grant execute on function spinout_private.terms_status(),spinout_private.begin_terms_review(text,text),spinout_private.terms_bottom(uuid),spinout_private.accept_terms(text,text,uuid,boolean) to authenticated;
create function public.spinout_terms_status() returns jsonb language sql stable security invoker set search_path='' as $$select spinout_private.terms_status()$$;
create function public.spinout_begin_terms_review(p_version text,p_hash text) returns uuid language sql security invoker set search_path='' as $$select spinout_private.begin_terms_review(p_version,p_hash)$$;
create function public.spinout_terms_bottom(p_review_id uuid) returns void language sql security invoker set search_path='' as $$select spinout_private.terms_bottom(p_review_id)$$;
create function public.spinout_accept_terms(p_version text,p_hash text,p_review_id uuid,p_agreed boolean) returns void language sql security invoker set search_path='' as $$select spinout_private.accept_terms(p_version,p_hash,p_review_id,p_agreed)$$;
revoke all on function public.spinout_terms_status(),public.spinout_begin_terms_review(text,text),public.spinout_terms_bottom(uuid),public.spinout_accept_terms(text,text,uuid,boolean) from public,anon;
grant execute on function public.spinout_terms_status(),public.spinout_begin_terms_review(text,text),public.spinout_terms_bottom(uuid),public.spinout_accept_terms(text,text,uuid,boolean) to authenticated;

-- Existing signed sessions, Google identities, and direct REST requests all need
-- the current agreement. No roles are granted through user-editable metadata.
create or replace function spinout_private.member_name() returns text language sql stable security definer set search_path='' as $$
 select username from public.profiles where auth_user_id=(select auth.uid()) and not coalesce(banned,false) and role in ('admin','member') and spinout_private.has_current_terms(auth.uid())
$$;
create or replace function spinout_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where auth_user_id=(select auth.uid()) and role='admin' and not coalesce(banned,false) and spinout_private.has_current_terms(auth.uid()))
$$;
create or replace function spinout_private.can_moderate() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where auth_user_id=(select auth.uid()) and not coalesce(banned,false) and (role='admin' or (role='member' and moderator)) and spinout_private.has_current_terms(auth.uid()))
$$;
-- Restrictive policies also close permissive ownership paths on existing tables.
do $$declare t text;begin
 foreach t in array array['profiles','pending_users','laps','pending_laps','reports','tracks','billboards','member_garage','event_plans','mod_threads','mod_replies'] loop
 execute format('create policy current_terms_required on public.%I as restrictive for all to authenticated using ((select spinout_private.has_current_terms(auth.uid()))) with check ((select spinout_private.has_current_terms(auth.uid())))',t);
 end loop;
end $$;
create or replace function public.spinout_submit_application(p_auth_id uuid,p_username text,p_nickname text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=p_auth_id and email_confirmed_at is not null and deleted_at is null) then raise exception 'Verify your email first';end if;
 if not spinout_private.has_current_terms(p_auth_id) then raise exception 'Accept the current Terms before applying';end if;
 if p_username !~ '^[a-z0-9_]{3,24}$' or length(p_nickname) not between 1 and 60 or length(p_reason) not between 10 and 1000 then raise exception 'Check username, display name and application';end if;
 if exists(select 1 from public.profiles where username=p_username or auth_user_id=p_auth_id) or exists(select 1 from public.pending_users where username=p_username or auth_user_id=p_auth_id) then raise exception 'An account or application already exists';end if;
 insert into public.pending_users(username,nickname,reason,submitted_at,auth_user_id) values(p_username,p_nickname,p_reason,(extract(epoch from now())*1000)::bigint,p_auth_id);
end $$;

-- A rights complainant must not need an account or acceptance of these Terms.
-- Only the bot-verified, rate-limited Edge Function can insert these records.
create table public.legal_reports (
 id uuid primary key default gen_random_uuid(),
 category text not null check(category in ('community','copyright','counter_notice','privacy','appeal','other')),
 email text not null check(char_length(email) between 3 and 254),
 subject text not null check(char_length(btrim(subject)) between 1 and 120),
 body text not null check(char_length(btrim(body)) between 10 and 4000),
 page text not null default '' check(char_length(page)<=500),
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now()
);
create index legal_reports_created on public.legal_reports(created_at desc);
alter table public.legal_reports enable row level security;
revoke all on public.legal_reports from public,anon,authenticated;
grant select on public.legal_reports to authenticated;
grant update(status) on public.legal_reports to authenticated;
grant all on public.legal_reports to service_role;
create policy legal_reports_staff_read on public.legal_reports for select to authenticated using ((select spinout_private.can_moderate()));
create policy legal_reports_staff_resolve on public.legal_reports for update to authenticated using ((select spinout_private.can_moderate())) with check ((select spinout_private.can_moderate()));
commit;
