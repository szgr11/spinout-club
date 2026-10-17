begin;
-- Public readers receive only approved racing results and circuit labels.
-- Member tables, pending submissions, reports and moderation history stay private.
create view public.leaderboard_laps with (security_invoker=true) as
select id,track,driver,time,car,hp,tire,temp,date,organizer,type from public.laps;
create view public.leaderboard_tracks with (security_invoker=true) as
select id,name,variant,region from public.tracks;
revoke all on public.leaderboard_laps,public.leaderboard_tracks from public,anon,authenticated;
grant select on public.leaderboard_laps,public.leaderboard_tracks to anon,authenticated;
grant select(id,track,driver,time,car,hp,tire,temp,date,organizer,type) on public.laps to anon;
grant select(id,name,variant,region) on public.tracks to anon;
create policy public_lap_results on public.laps for select to anon using(true);
create policy public_circuit_labels on public.tracks for select to anon using(true);
-- The public UI uses a separate, session-free client for these views. This lets
-- anyone browse without expanding authenticated access to private base columns.
commit;
