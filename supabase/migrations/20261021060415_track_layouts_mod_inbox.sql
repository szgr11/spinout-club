begin;
-- Lap configuration IDs stay unchanged. Track / Layout are a presentation of the
-- existing name / variant catalog; no historical times are reassigned.
create table public.mod_threads (
 id uuid primary key default gen_random_uuid(),
 username text not null references public.profiles(username),
 subject text not null check(char_length(btrim(subject)) between 1 and 120),
 body text not null check(char_length(btrim(body)) between 1 and 4000),
 page text not null default '/' check(char_length(page)<=300),
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index mod_threads_owner_updated on public.mod_threads(username,updated_at desc);
create index mod_threads_status_updated on public.mod_threads(status,updated_at desc);
create table public.mod_replies (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.mod_threads(id) on delete cascade,
 author text not null references public.profiles(username),
 staff boolean not null,
 body text not null check(char_length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index mod_replies_thread_created on public.mod_replies(thread_id,created_at);
create index mod_replies_author_created on public.mod_replies(author,created_at desc);
alter table public.mod_threads enable row level security;
alter table public.mod_replies enable row level security;
revoke all on public.mod_threads,public.mod_replies from public,anon,authenticated;
grant select on public.mod_threads,public.mod_replies to authenticated;
grant all on public.mod_threads,public.mod_replies to service_role;
create policy mod_threads_private_read on public.mod_threads for select to authenticated
 using (username=(select spinout_private.member_name()) or (select spinout_private.can_moderate()));
create policy mod_replies_private_read on public.mod_replies for select to authenticated
 using (exists(select 1 from public.mod_threads t where t.id=thread_id));

-- Writes go through bounded RPCs. Private privileged implementations check the
-- verified account each time; clients cannot choose authors, staff labels or dates.
create function spinout_private.contact_mods(p_subject text,p_body text,p_page text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor text:=spinout_private.member_name(); result uuid;
begin
 if actor is null then raise exception 'Please sign in with an active club membership';end if;
 if p_subject is null or char_length(btrim(p_subject)) not between 1 and 120 or p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then raise exception 'Enter a subject (up to 120 characters) and message (up to 4000 characters)';end if;
 -- Serialize per account so simultaneous submissions cannot bypass limits.
 perform pg_advisory_xact_lock(hashtextextended('spinout-mod-send:'||actor,0));
 if (select count(*) from public.mod_threads where username=actor and created_at>now()-interval '10 minutes')>=5 then raise exception 'Please wait before sending more messages (5 new conversations per 10 minutes)';end if;
 insert into public.mod_threads(username,subject,body,page)
 values(actor,btrim(p_subject),btrim(p_body),left(coalesce(p_page,'/'),300)) returning id into result;
 return result;
end $$;
create function spinout_private.reply_mod_thread(p_thread uuid,p_body text) returns void
 language plpgsql security definer set search_path='' as $$
declare actor text:=spinout_private.member_name(); staff boolean:=spinout_private.can_moderate(); target public.mod_threads;
begin
 if actor is null then raise exception 'Please sign in with an active club membership';end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then raise exception 'Enter a reply (up to 4000 characters)';end if;
 perform pg_advisory_xact_lock(hashtextextended('spinout-mod-send:'||actor,0));
 select * into target from public.mod_threads where id=p_thread for update;
 if not found or (target.username<>actor and not staff) then raise exception 'Conversation unavailable';end if;
 if (select count(*) from public.mod_replies where author=actor and created_at>now()-interval '10 minutes')>=20 then raise exception 'Please wait before sending more replies (20 per 10 minutes)';end if;
 insert into public.mod_replies(thread_id,author,staff,body) values(p_thread,actor,staff,btrim(p_body));
 -- A new message reopens a resolved conversation so staff can follow up.
 update public.mod_threads set updated_at=now(),status='open' where id=p_thread;
end $$;
create function spinout_private.set_mod_thread_status(p_thread uuid,p_status text) returns void
 language plpgsql security definer set search_path='' as $$
begin
 if not spinout_private.can_moderate() then raise exception 'Moderator required';end if;
 if p_status is null or p_status not in ('open','resolved') then raise exception 'Choose open or resolved';end if;
 update public.mod_threads set status=p_status,updated_at=now() where id=p_thread;
 if not found then raise exception 'Conversation unavailable';end if;
end $$;
revoke all on function spinout_private.contact_mods(text,text,text),spinout_private.reply_mod_thread(uuid,text),spinout_private.set_mod_thread_status(uuid,text) from public,anon,authenticated;
grant execute on function spinout_private.contact_mods(text,text,text),spinout_private.reply_mod_thread(uuid,text),spinout_private.set_mod_thread_status(uuid,text) to authenticated;
create function public.spinout_contact_mods(p_subject text,p_body text,p_page text default '/') returns uuid
 language sql security invoker set search_path='' as $$select spinout_private.contact_mods(p_subject,p_body,p_page)$$;
create function public.spinout_reply_mod_thread(p_thread uuid,p_body text) returns void
 language sql security invoker set search_path='' as $$select spinout_private.reply_mod_thread(p_thread,p_body)$$;
create function public.spinout_set_mod_thread_status(p_thread uuid,p_status text) returns void
 language sql security invoker set search_path='' as $$select spinout_private.set_mod_thread_status(p_thread,p_status)$$;
revoke all on function public.spinout_contact_mods(text,text,text),public.spinout_reply_mod_thread(uuid,text),public.spinout_set_mod_thread_status(uuid,text) from public,anon,authenticated;
grant execute on function public.spinout_contact_mods(text,text,text),public.spinout_reply_mod_thread(uuid,text),public.spinout_set_mod_thread_status(uuid,text) to authenticated;
commit;
