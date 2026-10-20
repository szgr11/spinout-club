begin;
-- Moderators remain ordinary member accounts. Delegation never grants admin.
alter table public.profiles add column moderator boolean not null default false;
alter table public.profiles add constraint moderator_member_only check (not moderator or role='member');

create function spinout_private.can_moderate() returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where auth_user_id=(select auth.uid())
  and not coalesce(banned,false) and (role='admin' or (role='member' and moderator)))
$$;
revoke all on function spinout_private.can_moderate() from public,anon;
grant execute on function spinout_private.can_moderate() to authenticated;

-- Content powers are separate from profile/role administration.
do $$ declare t text; begin
 foreach t in array array['laps','pending_laps','tracks','billboards'] loop
  execute format('create policy moderator_content on public.%I for all to authenticated using ((select spinout_private.can_moderate())) with check ((select spinout_private.can_moderate()))',t);
 end loop;
 foreach t in array array['pending_users','reports'] loop
  execute format('create policy moderator_read on public.%I for select to authenticated using ((select spinout_private.can_moderate()))',t);
  execute format('create policy moderator_delete on public.%I for delete to authenticated using ((select spinout_private.can_moderate()))',t);
 end loop;
end $$;

create or replace function spinout_private.spinout_account() returns jsonb
 language sql stable security definer set search_path='' as $$
 select jsonb_build_object('username',p.username,'nickname',p.nickname,'role',p.role,
  'moderator',p.moderator,'banned',p.banned,
  'has_password',exists(select 1 from spinout_private.credentials c where c.username=p.username))
 from public.profiles p where p.auth_user_id=(select auth.uid())
$$;

-- This invoker RPC and existing profile RLS independently require full admin.
create function public.spinout_set_moderator(p_username text,p_enabled boolean) returns void
 language plpgsql security invoker set search_path='' as $$
begin
 if not spinout_private.is_admin() then raise exception 'Admin required';end if;
 if p_enabled is null then raise exception 'Choose moderator access on or off';end if;
 update public.profiles set moderator=p_enabled where username=p_username
  and role='member' and (not p_enabled or not coalesce(banned,false));
 if not found then raise exception 'An active member is required to grant moderator access';end if;
end $$;
revoke all on function public.spinout_set_moderator(text,boolean) from public,anon;
grant execute on function public.spinout_set_moderator(text,boolean) to authenticated;

-- Mods may suspend ordinary members, but can never change identity or roles.
-- Protected profile writes stay in a private implementation with explicit checks.
create function spinout_private.set_suspended(p_username text,p_banned boolean) returns void
 language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
 if not spinout_private.can_moderate() then raise exception 'Moderator required';end if;
 if p_banned is null then raise exception 'Choose suspended or active';end if;
 select * into target from public.profiles where username=p_username for update;
 if not found or target.role is distinct from 'member' then raise exception 'Only member accounts can be suspended';end if;
 if target.moderator and not spinout_private.is_admin() then raise exception 'Only admins may suspend moderators';end if;
 update public.profiles set banned=p_banned where username=p_username;
end $$;
revoke all on function spinout_private.set_suspended(text,boolean) from public,anon;
grant execute on function spinout_private.set_suspended(text,boolean) to authenticated;
create function public.spinout_set_suspended(p_username text,p_banned boolean) returns void
 language sql security invoker set search_path='' as $$select spinout_private.set_suspended(p_username,p_banned)$$;
revoke all on function public.spinout_set_suspended(text,boolean) from public,anon;
grant execute on function public.spinout_set_suspended(text,boolean) to authenticated;

-- Approval always creates a regular member; it never accepts delegated privileges.
create function spinout_private.approve_user(p_username text) returns void
 language plpgsql security definer set search_path='' as $$
declare p public.pending_users;
begin
 if not spinout_private.can_moderate() then raise exception 'Admin or moderator required';end if;
 select * into p from public.pending_users where username=p_username for update;
 if p.username is null then raise exception 'Application not found';end if;
 insert into public.profiles(username,nickname,role,banned,joined_at,auth_user_id)
 values(p.username,p.nickname,'member',false,(extract(epoch from now())*1000)::bigint,p.auth_user_id);
 delete from public.pending_users where username=p_username;
end $$;
revoke all on function spinout_private.approve_user(text) from public,anon;
grant execute on function spinout_private.approve_user(text) to authenticated;
create or replace function public.spinout_approve_user(p_username text) returns void
 language sql security invoker set search_path='' as $$select spinout_private.approve_user(p_username)$$;
revoke all on function public.spinout_approve_user(text) from public,anon;
grant execute on function public.spinout_approve_user(text) to authenticated;
commit;
