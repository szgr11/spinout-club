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
 "create table laps(id text primary key,track text,driver text,time text,submitted_by text,date text,car text,hp integer,tire text,temp text,organizer text,type text);"+
 "create table pending_laps(id text primary key,track text,driver text,time text,image text,submitted_by text);"+
 "create table reports(id text primary key,lap_id text,reason text,reporter text);"+
 "create table tracks(id text primary key,name text,variant text,region text);create table billboards(id text primary key,title text);"+
 "create table app_kv(key text primary key,value jsonb);"+
 "insert into profiles values('admin','dummy-admin-password','Admin','admin',false,1),('member','dummy-member-password','Member','member',false,1),('banned','dummy-banned-password','Banned','member',true,1),('legacy_import','dummy-system-password','Import','system',false,1);"+
 "insert into pending_users values('legacy_applicant','dummy-pending-password','Applicant','Track days',1);"+
 "insert into app_kv values('user:admin','{\"password\":\"dummy-admin-password\",\"nickname\":\"Admin\"}');"+
 "insert into laps(id,track,driver,time,submitted_by,date) values('lap1','sow_cw','Driver','1:30.000','member','2026-10-16');"+
 "insert into auth.users values('"+ADMIN+"',now(),null),('"+MEMBER+"',now(),null),('"+NEW+"',now(),null),('"+BANNED+"',now(),null);"
 );
 try{
  await db.exec(await readFile(new URL('../supabase/setup-security.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261017055042_isolate_auth_privileges.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261017060105_public_leaderboard_views.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261019182803_member_event_plans_and_garage.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261020063347_moderator_permissions.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261021060415_track_layouts_mod_inbox.sql',import.meta.url),'utf8'));
  const scalar=async q=>(await db.query(q)).rows[0];
  const as=async(role,uid='')=>db.exec("reset role;set role "+role+";set request.jwt.claim.sub='"+uid+"';");
  await db.exec("update profiles set auth_user_id='"+ADMIN+"' where username='admin';update profiles set auth_user_id='"+MEMBER+"' where username='member';update profiles set auth_user_id='"+BANNED+"' where username='banned';");
  await t.test('mod messages are private, rate limited, and support staff replies and resolution',async()=>{
   await as('anon');
   await assert.rejects(db.query('select * from mod_threads'),/permission denied/);
   await assert.rejects(db.query("select spinout_contact_mods('Hello','Help','/')"),/permission denied/);
   await as('authenticated',NEW);
   await assert.rejects(db.query("select spinout_contact_mods('Hello','Help','/')"),/active club membership/);
   await as('authenticated',BANNED);
   await assert.rejects(db.query("select spinout_contact_mods('Hello','Help','/')"),/active club membership/);
   await as('authenticated',MEMBER);
   await assert.rejects(db.query("select spinout_contact_mods('  ','Help','/')"),/Enter a subject/);
   const id=(await scalar("select spinout_contact_mods('Layout request','Please add a layout','/leaderboard') id")).id;
   assert.equal((await scalar('select count(*) n from mod_threads')).n,1);
   await assert.rejects(db.query("insert into mod_threads(username,subject,body) values('admin','Spoof','No')"),/permission denied/);
   await assert.rejects(db.query("select spinout_set_mod_thread_status('"+id+"','resolved')"),/Moderator required/);
   await as('authenticated',NEW);
   assert.equal((await scalar('select count(*) n from mod_threads')).n,0);
   await assert.rejects(db.query("select spinout_reply_mod_thread('"+id+"','Not mine')"),/active club membership/);
   await as('authenticated',ADMIN);
   assert.equal((await scalar('select count(*) n from mod_threads')).n,1);
   await db.query("select spinout_reply_mod_thread('"+id+"','We can help')");
   await db.query("select spinout_set_mod_thread_status('"+id+"','resolved')");
   await as('authenticated',MEMBER);
   assert.equal((await scalar('select staff from mod_replies limit 1')).staff,true);
   assert.equal((await scalar('select status from mod_threads limit 1')).status,'resolved');
   await db.query("select spinout_reply_mod_thread('"+id+"','Thank you')");
   assert.equal((await scalar('select status from mod_threads limit 1')).status,'open');
   assert.equal((await scalar("select staff from mod_replies where author='member'")).staff,false);
   for(let i=0;i<4;i++)await db.query("select spinout_contact_mods('Question','Details','/')");
   await assert.rejects(db.query("select spinout_contact_mods('Question','Flood','/')"),/Please wait/);
   for(let i=0;i<19;i++)await db.query("select spinout_reply_mod_thread('"+id+"','Follow up')");
   await assert.rejects(db.query("select spinout_reply_mod_thread('"+id+"','Flood')"),/Please wait/);
   // An approved second member cannot view or reply to the first member's thread.
   await as('postgres');
   await db.exec("insert into profiles(username,nickname,role,auth_user_id) values('second','Second','member','"+NEW+"')");
   await as('authenticated',NEW);
   assert.equal((await scalar('select count(*) n from mod_threads')).n,0);
   assert.equal((await scalar('select count(*) n from mod_replies')).n,0);
   await assert.rejects(db.query("select spinout_reply_mod_thread('"+id+"','Not mine')"),/Conversation unavailable/);
   // Delegated moderators can read/reply/resolve, and revoked access takes effect immediately.
   await as('authenticated',ADMIN);await db.query("select spinout_set_moderator('second',true)");
   await as('authenticated',NEW);assert.equal((await scalar('select count(*) n from mod_threads')).n,5);
   await db.query("select spinout_reply_mod_thread('"+id+"','Moderator reply')");
   assert.equal((await scalar("select staff from mod_replies where author='second'")).staff,true);
   await db.query("select spinout_set_mod_thread_status('"+id+"','resolved')");
   await as('authenticated',ADMIN);await db.query("select spinout_set_moderator('second',false)");
   await as('authenticated',NEW);assert.equal((await scalar('select count(*) n from mod_threads')).n,0);
   await assert.rejects(db.query("select spinout_set_mod_thread_status('"+id+"','open')"),/Moderator required/);
   await as('postgres');await db.exec("delete from mod_replies;delete from mod_threads;delete from profiles where username='second'");
  });
  await t.test('plaintext removed and bcrypt credentials verify',async()=>{
   assert.equal((await scalar("select count(*) n from profiles where password <> '[secured]'")).n,0);
   assert.equal((await scalar("select count(*) n from pending_users where password <> '[secured]'")).n,0);
   assert.equal((await scalar("select count(*) n from spinout_private.credentials where password_hash like '$2%'")).n,4);
   assert.equal((await scalar("select value->>'password' as password from app_kv")).password,'[secured]');
   assert.equal((await scalar("select spinout_verify_legacy('member','dummy-member-password')->>'username' as username")).username,'member');
   assert.equal((await scalar("select spinout_verify_legacy('member','wrong') as account")).account,null);
  });
  await t.test('authenticated public RPCs do not execute with owner privileges',async()=>{
   assert.equal((await scalar("select count(*) n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('spinout_account','spinout_change_password','spinout_approve_user','spinout_set_moderator','spinout_set_suspended') and p.prosecdef")).n,0);
  });
  await t.test('anonymous credential and account-claim access denied',async()=>{
   await as('anon');
   for(const q of ["select * from profiles","select * from app_kv","select * from spinout_private.credentials","select spinout_verify_legacy('admin','wrong')","select spinout_attach_auth('admin',null)","select spinout_security_config()"])await assert.rejects(db.query(q),/permission denied/);
  });
  await t.test('public readers see approved results but cannot read private columns or write',async()=>{
   await as('anon');
   assert.equal((await scalar('select count(*) n from leaderboard_laps')).n,1);
   assert.equal((await scalar("select driver from leaderboard_laps where id='lap1'")).driver,'Driver');
   await assert.rejects(db.query('select submitted_by from laps'),/permission denied/);
   await assert.rejects(db.query("insert into laps(id) values('public-write')"),/permission denied/);
   await assert.rejects(db.query('select * from pending_laps'),/permission denied/);
   await assert.rejects(db.query('select * from reports'),/permission denied/);
  });
  await t.test('unapproved users cannot read laps, self-approve or insert applications directly',async()=>{
   await as('authenticated',NEW);assert.equal((await scalar('select count(*) n from laps')).n,0);
   await assert.rejects(db.query("insert into profiles(username,nickname,role,auth_user_id) values('attacker','Attacker','admin','"+NEW+"')"),/row-level security/);
   await assert.rejects(db.query("select spinout_approve_user('legacy_applicant')"),/Admin or moderator required/);
   await assert.rejects(db.query("insert into pending_users(username,nickname,reason,auth_user_id) values('flood','Flood','Track days','"+NEW+"')"),/row-level security/);
  });
  await t.test('member ownership is enforced on submissions and approved data',async()=>{
   await as('authenticated',MEMBER);assert.equal((await scalar('select count(*) n from laps')).n,1);
   await db.exec("insert into pending_laps(id,driver,time,submitted_by) values('mine','Member','1:30.000','member')");
   await assert.rejects(db.query("insert into pending_laps(id,driver,time,submitted_by) values('forged','Admin','1:20.000','admin')"),/row-level security/);
   assert.equal((await db.query("update profiles set role='admin' where username='member' returning username")).rows.length,0);
   await assert.rejects(db.query("insert into laps(id,track,driver,time,submitted_by,date) values('unauthorized','sow_cw','Member','1:00.000','member','2026-10-16')"),/row-level security/);
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
  await t.test('garage defaults belong to approved owners and do not update lap snapshots',async()=>{
   await as('authenticated',MEMBER);
   const car=(await db.query("insert into member_garage(car,hp,tire) values('Track GR86',200,'RT660') returning id")).rows[0];
   await db.query("update member_garage set hp=230,tire='RE71RS' where id=$1",[car.id]);
   assert.equal((await scalar('select hp from member_garage')).hp,230);
   assert.equal((await scalar("select hp from laps where id='lap1'")).hp,null);
   await assert.rejects(db.query("insert into member_garage(username,car) values('admin','Forged')"),/Approved owner|row-level security/);
   await as('authenticated',ADMIN);assert.equal((await scalar('select count(*) n from member_garage')).n,0);
   await as('authenticated',BANNED);await assert.rejects(db.query("insert into member_garage(car) values('Banned car')"),/Approved owner|row-level security|not-null/);
   await as('anon');await assert.rejects(db.query('select * from member_garage'),/permission denied/);
  });
  await t.test('attendance sharing is explicit, reversible, and reveals no private plan details',async()=>{
   await as('authenticated',MEMBER);
   const plan="('day-key-0001','2099-11-21','Buttonwillow day','Buttonwillow Circuit','Organizer','https://example.com/event','going',false)";
   await db.query('insert into event_plans(event_key,date,title,track,organizer,url,state,share_attendance) values '+plan);
   await as('anon');assert.equal((await scalar('select count(*) n from event_attendees')).n,0);
   await assert.rejects(db.query('select url from event_plans'),/permission denied/);
   await as('authenticated',MEMBER);await db.query("update event_plans set share_attendance=true where event_key='day-key-0001'");
   await as('anon');assert.deepEqual((await db.query('select * from event_attendees')).rows,[{event_key:'day-key-0001',username:'member'}]);
   await as('authenticated',ADMIN);assert.equal((await db.query("update event_plans set title='Changed' where event_key='day-key-0001' returning event_key")).rows.length,0);
   await as('authenticated',MEMBER);await db.query("update event_plans set share_attendance=false where event_key='day-key-0001'");
   await as('anon');assert.equal((await scalar('select count(*) n from event_attendees')).n,0);
   await assert.rejects(db.query("insert into event_plans(event_key) values('forged-key')"),/permission denied/);
   await as('authenticated',MEMBER);await db.query("update event_plans set share_attendance=true where event_key='day-key-0001'");
   await as('postgres');await db.query("update profiles set banned=true where username='member'");
   await as('anon');assert.equal((await scalar('select count(*) n from event_attendees')).n,0);
   await as('postgres');await db.query("update profiles set banned=false where username='member'");
  });
  await t.test('service counts are admin-only and garage quotas are enforced',async()=>{
   await as('authenticated',MEMBER);await assert.rejects(db.query('select spinout_service_counts()'),/Admin required/);
   await assert.rejects(db.query("insert into member_garage(car) select 'Garage '||n from generate_series(1,30) n"),/Garage limit/);
   await as('authenticated',ADMIN);assert.equal((await scalar("select spinout_service_counts()->>'garage_vehicles' n")).n,'1');
   await as('anon');await assert.rejects(db.query('select spinout_service_counts()'),/permission denied/);
  });
  await t.test('only full admins may appoint and revoke moderators',async()=>{
   await as('authenticated',MEMBER);
   await assert.rejects(db.query("select spinout_set_moderator('member',true)"),/Admin required/);
   await as('authenticated',ADMIN);
   await db.query("select spinout_set_moderator('newdriver',true)");
   await assert.rejects(db.query("select spinout_set_moderator('admin',true)"),/active member/);
   await assert.rejects(db.query("select spinout_set_moderator('banned',true)"),/active member/);
   await assert.rejects(db.query("select spinout_set_moderator('member',null)"),/on or off/);
   await as('authenticated',NEW);
   assert.equal((await scalar("select spinout_account()->>'moderator' enabled")).enabled,'true');
   assert.equal((await scalar("select spinout_account()->>'role' role")).role,'member');
   for(const target of ['member','admin','newdriver']) await assert.rejects(db.query("select spinout_set_moderator('"+target+"',true)"),/Admin required/);
   assert.equal((await db.query("update profiles set moderator=true,role='admin' where username='newdriver' returning username")).rows.length,0);
   assert.equal((await db.query("update profiles set auth_user_id=null,nickname='Forged',banned=false where username='member' returning username")).rows.length,0);
   assert.equal((await db.query("delete from profiles where username='admin' returning username")).rows.length,0);
   await assert.rejects(db.query("insert into profiles(username,nickname,role,moderator) values('forgedmod','Fake','member',true)"),/row-level security/);
   await assert.rejects(db.query("select spinout_service_counts()"),/Admin required/);
  });
  await t.test('moderators can review content and approve ordinary members only',async()=>{
   await as('postgres');
   await db.query("insert into pending_users(username,nickname,reason) values('mod_applicant','New driver','Track days')");
   await as('authenticated',NEW);
   await db.query("select spinout_approve_user('mod_applicant')");
   assert.deepEqual((await db.query("select role,moderator from profiles where username='mod_applicant'")).rows,[{role:'member',moderator:false}]);
   await db.query("insert into laps(id,track,driver,time,submitted_by,date) values('mod-approved','sow_cw','Member','1:25.000','member','2026-10-20')");
   await db.query("update laps set time='1:24.000' where id='mod-approved'");
   assert.equal((await scalar("select time from laps where id='mod-approved'")).time,'1:24.000');
   await db.query("delete from laps where id='mod-approved'");
   await db.query("insert into tracks(id,name) values('mod-track','Custom circuit')");
   await db.query("delete from tracks where id='mod-track'");
   await db.query("insert into billboards(id,title) values('mod-notice','Club notice')");
   await db.query("delete from billboards where id='mod-notice'");
   await db.query("delete from pending_laps where id='mine'");
   assert.equal((await scalar("select count(*) n from pending_laps where id='mine'")).n,0);
  });
  await t.test('moderators cannot suspend staff or change roles through suspension',async()=>{
   await as('authenticated',NEW);
   await db.query("select spinout_set_suspended('member',true)");
   await as('authenticated',MEMBER);assert.equal((await scalar('select count(*) n from laps')).n,0);
   await assert.rejects(db.query("select spinout_set_suspended('newdriver',true)"),/Moderator required/);
   await as('authenticated',NEW);await db.query("select spinout_set_suspended('member',false)");
   for(const target of ['admin','legacy_import']) await assert.rejects(db.query("select spinout_set_suspended('"+target+"',true)"),/Only member/);
   await assert.rejects(db.query("select spinout_set_suspended('newdriver',true)"),/Only admins/);
   await as('authenticated',ADMIN);await db.query("select spinout_set_moderator('member',true)");
   await as('authenticated',NEW);await assert.rejects(db.query("select spinout_set_suspended('member',true)"),/Only admins/);
   await as('authenticated',ADMIN);await db.query("select spinout_set_moderator('member',false)");
  });
  await t.test('revocation and suspension take effect with the same existing identity',async()=>{
   await as('authenticated',ADMIN);await db.query("select spinout_set_suspended('newdriver',true)");
   await as('authenticated',NEW);
   await assert.rejects(db.query("insert into laps(id) values('banned-mod')"),/row-level security/);
   await assert.rejects(db.query("select spinout_set_suspended('member',true)"),/Moderator required/);
   await as('authenticated',ADMIN);await db.query("select spinout_set_suspended('newdriver',false)");
   await db.query("select spinout_set_moderator('newdriver',false)");
   await as('authenticated',NEW);
   assert.equal((await scalar("select spinout_account()->>'moderator' enabled")).enabled,'false');
   await assert.rejects(db.query("insert into laps(id) values('revoked-mod')"),/row-level security/);
   await assert.rejects(db.query("select spinout_approve_user('mod_applicant')"),/Admin or moderator required/);
   await assert.rejects(db.query("select spinout_set_suspended('member',true)"),/Moderator required/);
   await as('anon');
   for(const q of ["select spinout_set_moderator('member',true)","select spinout_set_suspended('member',true)","select spinout_approve_user('mod_applicant')"]) await assert.rejects(db.query(q),/permission denied/);
  });
 }finally{await db.close();}
});
