begin;
create table spinout_private.calendar_entry_overrides(
 id text primary key check(length(id) between 1 and 600),
 state text not null check(state in ('visible','hidden','removed')),
 document jsonb not null,
 updated_at timestamptz not null default clock_timestamp(),
 updated_by text not null
);
create table spinout_private.calendar_entry_audit(
 id bigint generated always as identity primary key,
 entry_id text not null,action text not null,actor text not null,
 previous jsonb,document jsonb not null,created_at timestamptz not null default clock_timestamp()
);
alter table spinout_private.calendar_entry_overrides enable row level security;
alter table spinout_private.calendar_entry_audit enable row level security;
revoke all on spinout_private.calendar_entry_overrides,spinout_private.calendar_entry_audit from public,anon,authenticated;

create function spinout_private.calendar_editor() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not spinout_private.can_moderate() then raise exception 'Moderator access required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'state',state,'document',document,'updated_at',updated_at) order by id) from spinout_private.calendar_entry_overrides),'[]'::jsonb);
end $$;

create function spinout_private.calendar_public_changes() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'state',state,'document',case when state='visible' then document else null end)),'[]'::jsonb)
 from spinout_private.calendar_entry_overrides
$$;

create function spinout_private.edit_calendar_entries(p_action text,p_entries jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare entry jsonb;doc jsonb;entry_id text;new_state text;prior spinout_private.calendar_entry_overrides;exists_before boolean;actor text:=spinout_private.member_name();stamp timestamptz;
begin
 if not spinout_private.can_moderate() then raise exception 'Moderator access required';end if;
 if p_action is null or p_action not in ('save','hide','remove','restore') then raise exception 'Invalid calendar action';end if;
 if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) not between 1 and 100 then raise exception 'Select between 1 and 100 entries';end if;
 for entry in select value from jsonb_array_elements(p_entries) loop
  entry_id:=entry->>'id';doc:=entry->'document';
  if entry_id is null or length(entry_id) not between 1 and 600 or jsonb_typeof(doc) is distinct from 'object' or length(doc::text)>16000 then raise exception 'Invalid calendar entry';end if;
  if coalesce(doc->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'A valid date is required';end if;
  if (doc->>'date')::date::text<>doc->>'date' then raise exception 'A valid date is required';end if;
  if coalesce(length(btrim(doc->>'title')),0) not between 1 and 180 or coalesce(length(btrim(doc->>'track')),0) not between 1 and 120 or coalesce(length(btrim(doc->>'organizer')),0) not between 1 and 120 then raise exception 'Title, track and organizer are required';end if;
  if coalesce(doc->>'region','') not in ('SoCal','NorCal','Nevada') or coalesce(doc->>'kind','') not in ('Track day','Track day / time trial','Open practice','Autocross','Track event') then raise exception 'Choose a valid region and event type';end if;
  if coalesce(doc->>'url','') !~ '^https://[^[:space:]]+$' or length(doc->>'url')>2000 or coalesce(length(doc->>'note'),0)>2000 then raise exception 'A valid HTTPS event link is required';end if;
  if doc ? 'sources' and jsonb_typeof(doc->'sources') is distinct from 'array' then raise exception 'Invalid source links';end if;
  if exists(select 1 from jsonb_array_elements(coalesce(doc->'sources','[]'::jsonb)) s where jsonb_typeof(s) is distinct from 'object' or coalesce(s->>'url','') !~ '^https?://[^[:space:]]+$' or length(s->>'url')>2000 or coalesce(length(s->>'name'),0) not between 1 and 160 or coalesce(length(s->>'id'),0) not between 1 and 100) then raise exception 'Invalid source links';end if;
  doc:=jsonb_build_object('id',entry_id,'date',doc->>'date','title',btrim(doc->>'title'),'track',btrim(doc->>'track'),'organizer',btrim(doc->>'organizer'),'region',doc->>'region','kind',doc->>'kind','url',doc->>'url','note',coalesce(doc->>'note',''),'scheduleOnly',coalesce((doc->>'scheduleOnly')::boolean,false),
   'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s->>'id','name',s->>'name','url',s->>'url')) from jsonb_array_elements(coalesce(doc->'sources','[]'::jsonb)) s),jsonb_build_array(jsonb_build_object('id','staff-calendar','name','Staff calendar entry','url',doc->>'url'))));
  select * into prior from spinout_private.calendar_entry_overrides where id=entry_id for update;exists_before:=found;
  if exists_before and (nullif(entry->>'revision','')::timestamptz is distinct from prior.updated_at) then raise exception 'This entry changed; reload the editor';end if;
  if not exists_before and nullif(entry->>'revision','') is not null then raise exception 'This entry changed; reload the editor';end if;
  new_state:=case p_action when 'hide' then 'hidden' when 'remove' then 'removed' else 'visible' end;
  doc:=case when exists_before and p_action='restore' then prior.document else doc end;
  doc:=doc||jsonb_build_object('id',entry_id,'staffEdited',true);
  stamp:=clock_timestamp();
  if exists_before then
   update spinout_private.calendar_entry_overrides set state=new_state,document=doc,updated_at=stamp,updated_by=actor where id=entry_id;
  else
   insert into spinout_private.calendar_entry_overrides(id,state,document,updated_at,updated_by) values(entry_id,new_state,doc,stamp,actor) on conflict do nothing;
   if not found then raise exception 'This entry changed; reload the editor';end if;
  end if;
  insert into spinout_private.calendar_entry_audit(entry_id,action,actor,previous,document) values(entry_id,p_action,actor,case when exists_before then to_jsonb(prior) else null end,jsonb_build_object('state',new_state,'document',doc));
 end loop;
end $$;

revoke all on function spinout_private.calendar_editor(),spinout_private.calendar_public_changes(),spinout_private.edit_calendar_entries(text,jsonb) from public,anon,authenticated;
grant execute on function spinout_private.calendar_editor(),spinout_private.edit_calendar_entries(text,jsonb) to authenticated;
grant execute on function spinout_private.calendar_public_changes() to anon,authenticated;
create function public.spinout_calendar_editor() returns jsonb language sql stable security invoker set search_path='' as $$select spinout_private.calendar_editor()$$;
create function public.spinout_calendar_changes() returns jsonb language sql stable security invoker set search_path='' as $$select spinout_private.calendar_public_changes()$$;
create function public.spinout_edit_calendar_entries(p_action text,p_entries jsonb) returns void language sql security invoker set search_path='' as $$select spinout_private.edit_calendar_entries(p_action,p_entries)$$;
revoke all on function public.spinout_calendar_editor(),public.spinout_edit_calendar_entries(text,jsonb),public.spinout_calendar_changes() from public,anon,authenticated;
grant execute on function public.spinout_calendar_editor(),public.spinout_edit_calendar_entries(text,jsonb) to authenticated;
grant execute on function public.spinout_calendar_changes() to anon,authenticated;
notify pgrst,'reload schema';
commit;
