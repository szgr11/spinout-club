begin;
-- Privileged implementations stay in the unexposed private schema. Public RPCs
-- are invoker wrappers; the private implementations still enforce caller identity.
alter function public.spinout_account() set schema spinout_private;
create function public.spinout_account() returns jsonb
language sql stable security invoker set search_path='' as $$
 select spinout_private.spinout_account()
$$;
revoke all on function public.spinout_account() from public,anon;
grant execute on function public.spinout_account() to authenticated;

alter function public.spinout_change_password(text,text) set schema spinout_private;
create function public.spinout_change_password(p_old text,p_new text) returns jsonb
language sql security invoker set search_path='' as $$
 select spinout_private.spinout_change_password(p_old,p_new)
$$;
revoke all on function public.spinout_change_password(text,text) from public,anon;
grant execute on function public.spinout_change_password(text,text) to authenticated;

-- Admin row policies already authorize the approval transaction. This function
-- needs no owner privileges; its explicit admin check and RLS both apply.
alter function public.spinout_approve_user(text) security invoker;
commit;
