begin;
-- Additive member tools. Existing auth, lap tables and policies are unchanged.
create table public.member_garage (
 id uuid primary key default gen_random_uuid(),
 username text not null default spinout_private.member_name() references public.profiles(username) on delete cascade,
 car text not null check (length(trim(car)) between 1 and 120),
 hp integer check (hp between 0 and 5000),
 tire text not null default '' check (length(tire)<=160),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index member_garage_owner on public.member_garage(username,created_at);
alter table public.member_garage enable row level security;
revoke all on public.member_garage from public,anon,authenticated;
grant select,insert,update,delete on public.member_garage to authenticated;
create policy own_garage on public.member_garage for all to authenticated
 using (username=(select spinout_private.member_name()))
 with check (username=(select spinout_private.member_name()));

create table public.event_plans (
 event_key text not null check (length(event_key) between 10 and 500),
 username text not null default spinout_private.member_name() references public.profiles(username) on delete cascade,
 date date not null,
 title text not null check (length(title) between 1 and 180),
 track text not null check (length(track) between 1 and 120),
 organizer text not null check (length(organizer) between 1 and 160),
 url text not null check (length(url)<=2000 and url ~ '^https://[^[:space:]]+$'),
 state text not null check (state in ('saved','interested','going')),
 share_attendance boolean not null default false check (not share_attendance or state='going'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(event_key,username)
);
create index event_plans_owner_date on public.event_plans(username,date);
alter table public.event_plans enable row level security;
revoke all on public.event_plans from public,anon,authenticated;
grant select,insert,update,delete on public.event_plans to authenticated;
-- Public visitors can only read opted-in usernames and event keys, never plans.
-- Predicate columns are needed by the invoker view; RLS still hides private rows.
grant select(event_key,username,state,share_attendance,date) on public.event_plans to anon;
create function spinout_private.active_member(p_username text) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where username=p_username and not coalesce(banned,false) and role in ('member','admin'))
$$;
revoke all on function spinout_private.active_member(text) from public;
grant execute on function spinout_private.active_member(text) to anon,authenticated;
create policy own_event_plans on public.event_plans for all to authenticated
 using (username=(select spinout_private.member_name()))
 with check (username=(select spinout_private.member_name()));
create policy shared_attendance on public.event_plans for select to anon,authenticated
 using (state='going' and share_attendance and date>=(now() at time zone 'America/Los_Angeles')::date and spinout_private.active_member(username));
create view public.event_attendees with (security_invoker=true) as
 select event_key,username from public.event_plans
 where state='going' and share_attendance and date>=(now() at time zone 'America/Los_Angeles')::date;
grant select on public.event_attendees to anon,authenticated;

-- Bound each member's optional data and serialize concurrent inserts per member.
create function spinout_private.guard_member_tools() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if new.username is distinct from spinout_private.member_name() then raise exception 'Approved owner required';end if;
 if tg_op='INSERT' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.username,0));
  if tg_table_name='member_garage' then
   select count(*) into n from public.member_garage where username=new.username;
   if n>=30 then raise exception 'Garage limit is 30 vehicles';end if;
  else
   -- Upserts for an existing key do not consume another plan slot.
   if not exists(select 1 from public.event_plans where username=new.username and event_key=new.event_key) then
    select count(*) into n from public.event_plans where username=new.username;
    if n>=256 then raise exception 'Plan limit is 256 days; remove an old plan first';end if;
   end if;
  end if;
 end if;
 new.updated_at:=now();return new;
end;
$$;
revoke all on function spinout_private.guard_member_tools() from public;
grant execute on function spinout_private.guard_member_tools() to authenticated;
create trigger garage_guard before insert or update on public.member_garage for each row execute function spinout_private.guard_member_tools();
create trigger plans_guard before insert or update on public.event_plans for each row execute function spinout_private.guard_member_tools();

-- Only admins may read service totals. No visitor identifiers are collected.
create function spinout_private.service_counts() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
begin
 if not spinout_private.is_admin() then raise exception 'Admin required';end if;
 return jsonb_build_object(
 'active_members',(select count(*) from public.profiles where role in ('member','admin') and not coalesce(banned,false)),
 'saved_event_days',(select count(*) from public.event_plans),
 'going',(select count(*) from public.event_plans where state='going' and date>=(now() at time zone 'America/Los_Angeles')::date),
 'garage_vehicles',(select count(*) from public.member_garage),
 'approved_laps',(select count(*) from public.laps),
 'pending_laps',(select count(*) from public.pending_laps));
end;
$$;
revoke all on function spinout_private.service_counts() from public,anon;
grant execute on function spinout_private.service_counts() to authenticated;
create function public.spinout_service_counts() returns jsonb
 language sql stable security invoker set search_path='' as $$select spinout_private.service_counts()$$;
revoke all on function public.spinout_service_counts() from public,anon;
grant execute on function public.spinout_service_counts() to authenticated;
commit;
