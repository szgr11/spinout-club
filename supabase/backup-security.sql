-- REQUIRES EXPLICIT OWNER APPROVAL. No plaintext is returned to the caller.
begin;
create schema if not exists spinout_private;
revoke all on schema spinout_private from public,anon,authenticated;
create table if not exists spinout_private.recovery_snapshots (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 key_id uuid not null, encrypted_data bytea not null
);
alter table spinout_private.recovery_snapshots enable row level security;
revoke all on spinout_private.recovery_snapshots from public,anon,authenticated;
do $$
declare k text; v uuid; payload text;
begin
 k:=encode(extensions.gen_random_bytes(32),'hex');
 v:=vault.create_secret(k,'spinout_security_recovery','Pre-migration recovery key; project administrators only');
 select jsonb_object_agg(t.name,t.rows)::text into payload from (
  select 'profiles' name,jsonb_agg(to_jsonb(p)) rows from public.profiles p
  union all select 'pending_users',jsonb_agg(to_jsonb(p)) from public.pending_users p
  union all select 'laps',jsonb_agg(to_jsonb(p)) from public.laps p
  union all select 'pending_laps',jsonb_agg(to_jsonb(p)) from public.pending_laps p
  union all select 'tracks',jsonb_agg(to_jsonb(p)) from public.tracks p
  union all select 'billboards',jsonb_agg(to_jsonb(p)) from public.billboards p
  union all select 'reports',jsonb_agg(to_jsonb(p)) from public.reports p
  union all select 'app_kv',jsonb_agg(to_jsonb(p)) from public.app_kv p
 )t;
 insert into spinout_private.recovery_snapshots(key_id,encrypted_data) values(v,extensions.pgp_sym_encrypt(payload,k,'cipher-algo=aes256'));
end $$;
commit;
select r.id,r.created_at,octet_length(r.encrypted_data) encrypted_bytes,
 jsonb_array_length((extensions.pgp_sym_decrypt(r.encrypted_data,v.decrypted_secret)::jsonb)->'profiles') profiles,
 jsonb_array_length((extensions.pgp_sym_decrypt(r.encrypted_data,v.decrypted_secret)::jsonb)->'laps') laps
from spinout_private.recovery_snapshots r join vault.decrypted_secrets v on v.id=r.key_id;
