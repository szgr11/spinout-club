import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const ADMIN='10000000-0000-0000-0000-000000000001',MEMBER='10000000-0000-0000-0000-000000000002',NEW='10000000-0000-0000-0000-000000000003',BANNED='10000000-0000-0000-0000-000000000004';
test('security migration in isolated PostgreSQL with synthetic users only',async t=>{
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec(
 "create role anon;create role authenticated;create role service_role bypassrls;"+
 "create schema extensions;create extension pgcrypto with schema extensions;"+
 "create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz);"+
 "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;"+
 "grant usage on schema auth,public to anon,authenticated,service_role;"+
 "create schema vault;create table vault.decrypted_secrets(id uuid primary key,decrypted_secret text);"+
 "create table profiles(username text primary key,password text not null,nickname text not null,role text default 'member',banned boolean default false,joined_at bigint);"+
 "create table pending_users(username text primary key,password text not null,nickname text not null,reason text,submitted_at bigint);"+
 "create table laps(id text primary key,track text,driver text,time text,submitted_by text,date text);"+
 "create table pending_laps(id text primary key,track text,driver text,time text,image text,submitted_by text);"+
 "create table reports(id text primary key,lap_id text,reason text,reporter text);"+
 "create table tracks(id text primary key,name text);create table billboards(id text primary key,title text);"+
 "create table app_kv(key text primary key,value jsonb);"+
 "insert into profiles values('admin','dummy-admin-password','Admin','admin',false,1),('member','dummy-member-password','Member','member',false,1),('banned','dummy-banned-password','Banned','member',true,1),('legacy_import','dummy-system-password','Import','system',false,1);"+
 "insert into pending_users values('legacy_applicant','dummy-pending-password','Applicant','Track days',1);"+
 "insert into app_kv values('user:admin','{\"password\":\"dummy-admin-password\",\"nickname\":\"Admin\"}');"+
 "insert into laps values('lap1','sow_cw','Driver','1:30.000','member','2026-10-16');"+
 "insert into auth.users values('"+ADMIN+"',now(),null),('"+MEMBER+"',now(),null),('"+NEW+"',now(),null),('"+BANNED+"',now(),null);"
 );
 try{
  await db.exec(await readFile(new URL('../supabase/setup-security.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261017055042_isolate_auth_privileges.sql',import.meta.url),'utf8'));
  const scalar=async q=>(await db.query(q)).rows[0];
  const as=async(role,uid='')=>db.exec("reset role;set role "+role+";set request.jwt.claim.sub='"+uid+"';");
  await db.exec("update profiles set auth_user_id='"+ADMIN+"' where username='admin';update profiles set auth_user_id='"+MEMBER+"' where username='member';update profiles set auth_user_id='"+BANNED+"' where username='banned';");
  await t.test('plaintext removed and bcrypt credentials verify',async()=>{
   assert.equal((await scalar("select count(*) n from profiles where password <> '[secured]'")).n,0);
   assert.equal((await scalar("select count(*) n from pending_users where password <> '[secured]'")).n,0);
   assert.equal((await scalar("select count(*) n from spinout_private.credentials where password_hash like '$2%'")).n,4);
   assert.equal((await scalar("select value->>'password' as password from app_kv")).password,'[secured]');
   assert.equal((await scalar("select spinout_verify_legacy('member','dummy-member-password')->>'username' as username")).username,'member');
   assert.equal((await scalar("select spinout_verify_legacy('member','wrong') as account")).account,null);
  });
  await t.test('authenticated public RPCs do not execute with owner privileges',async()=>{
   assert.equal((await scalar("select count(*) n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('spinout_account','spinout_change_password','spinout_approve_user') and p.prosecdef")).n,0);
  });
  await t.test('anonymous credential and account-claim access denied',async()=>{
   await as('anon');
   for(const q of ["select * from profiles","select * from app_kv","select * from spinout_private.credentials","select spinout_verify_legacy('admin','wrong')","select spinout_attach_auth('admin',null)","select spinout_security_config()"])await assert.rejects(db.query(q),/permission denied/);
  });
  await t.test('unapproved users cannot read laps, self-approve or insert applications directly',async()=>{
   await as('authenticated',NEW);assert.equal((await scalar('select count(*) n from laps')).n,0);
   await assert.rejects(db.query("insert into profiles(username,nickname,role,auth_user_id) values('attacker','Attacker','admin','"+NEW+"')"),/row-level security/);
   await assert.rejects(db.query("select spinout_approve_user('legacy_applicant')"),/Admin required/);
   await assert.rejects(db.query("insert into pending_users(username,nickname,reason,auth_user_id) values('flood','Flood','Track days','"+NEW+"')"),/row-level security/);
  });
  await t.test('member ownership is enforced on submissions and approved data',async()=>{
   await as('authenticated',MEMBER);assert.equal((await scalar('select count(*) n from laps')).n,1);
   await db.exec("insert into pending_laps(id,driver,time,submitted_by) values('mine','Member','1:30.000','member')");
   await assert.rejects(db.query("insert into pending_laps(id,driver,time,submitted_by) values('forged','Admin','1:20.000','admin')"),/row-level security/);
   assert.equal((await db.query("update profiles set role='admin' where username='member' returning username")).rows.length,0);
   await assert.rejects(db.query("insert into laps values('unauthorized','sow_cw','Member','1:00.000','member','2026-10-16')"),/row-level security/);
  });
  await t.test('banned JWT holder loses member access',async()=>{
   await as('authenticated',BANNED);assert.equal((await scalar('select count(*) n from laps')).n,0);
   await assert.rejects(db.query("insert into pending_laps(id,driver,time,submitted_by) values('banned','Banned','1:30.000','banned')"),/row-level security/);
  });
  await t.test('one application per identity and atomic approval',async()=>{
   await as('postgres');await db.query("select spinout_submit_application('"+NEW+"','newdriver','New driver','I attend California track days')");
   await assert.rejects(db.query("select spinout_submit_application('"+NEW+"','newdriver2','New driver','I attend California track days')"),/already exists/);
   await as('authenticated',ADMIN);await db.query("select spinout_approve_user('newdriver')");
   await as('authenticated',NEW);assert.equal((await scalar("select spinout_account()->>'username' username")).username,'newdriver');
   assert.equal((await scalar('select count(*) n from laps')).n,1);
  });
  await t.test('password replacement requires owner proof and stronger password',async()=>{
   await as('authenticated',MEMBER);
   assert.match((await scalar("select spinout_change_password('wrong','longer-dummy-new-password') as result")).result.error,/Current password is incorrect/);
   assert.match((await scalar("select spinout_change_password('dummy-member-password','short') as result")).result.error,/12 or more/);
   await db.query("select spinout_change_password('dummy-member-password','longer-dummy-new-password')");
   await as('postgres');assert.equal((await scalar("select spinout_verify_legacy('member','dummy-member-password') as account")).account,null);
   assert.equal((await scalar("select spinout_verify_legacy('member','longer-dummy-new-password')->>'username' username")).username,'member');
  });
  await t.test('failed password guesses persist and hit the quota',async()=>{
   await as('authenticated',MEMBER);
   for(let n=0;n<3;n++)await db.query("select spinout_change_password('wrong','longer-dummy-new-password')");
   assert.match((await scalar("select spinout_change_password('wrong','longer-dummy-new-password') as result")).result.error,/Please wait/);
  });
 }finally{await db.close();}
});
