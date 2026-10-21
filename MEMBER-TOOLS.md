# Track-day plans, garage and lightweight service checks

## Member experience

The public calendar remains available without an account. `Plan / who’s going` loads the optional member panel for a selected event. Approved members can save a day, mark interest or mark themselves going. Saved/Interested plans are private. Going stays private until the member checks **Show my username publicly as going**. Switching status or removing a plan removes shared attendance. Public attendance includes approved, non-banned members only, and expires from public display after the event date. No email address or account ID is exposed.

`My track days` lists saved plans, with an option to include past plans. Google Calendar links and all-day `.ics` exports are available from the event panel and saved plans. Exports preserve calendar dates, escape/fold text and use an exclusive next-day end date. Saving a plan does not book an event. Dates missing from the current calendar are flagged for organizer confirmation.

`Profile → My Garage` saves reusable vehicle, wheel horsepower and tire defaults. The same picker is directly on the lap reporting page. All existing fields remain editable. Choosing a garage entry fills only vehicle, horsepower and tires; it does not change driver, time, circuit, date, proof or lap type. Editing the lap does not automatically save defaults. **Update garage defaults** explicitly saves the current form specs; **Save as another vehicle** creates a separate entry. Existing lap records retain their own snapshots. Removing a garage entry never deletes laps. The existing PB grouping and moderation flow are unchanged; garage names do not automatically merge old free-text vehicle variants.

## Isolation and permissions

The additive migration `20261019182803_member_event_plans_and_garage.sql` creates separate `event_plans` and `member_garage` tables. It does not alter the lap tables, existing auth functions or existing RLS policies. Apply it before publishing the new frontend. Owners can manage only their own entries. RLS, column grants and an invoker view limit public access to shared attendance. Quotas bound each member to 256 plans and 30 garage entries. Admin service totals use an admin-checked private implementation behind an invoker RPC.

Member modules load on demand behind local error boundaries. Calendar browsing starts no Supabase requests. Garage failure leaves manual lap reporting available. New data reads are not added to the app’s existing all-or-nothing member refresh. There is no new periodic polling or external analytics dependency. Browser sessions continue through the existing Supabase Auth client.

## Calendar quality and service health

Generic membership/merchandise advertisements and bare coupon inputs are excluded from offer badges. Calendar-invalid deadlines such as September 31 are rejected. Known expired absolute, year-inferred and supported relative deadlines are filtered, including retained cached offers. Capacity limits and checkout availability remain unverified; source conditions and stale evidence are still shown.

`Date announced` identifies calendar-only dates, while `Registration link` identifies organizer listings. These labels do not assert that registration is open or that places remain.

`GET /api/health` reads only the existing KV snapshot. Refresh age over 150 minutes, delayed sources and count drops are flagged. A source with a baseline of at least five event days that falls below half its baseline gets a review flag until recovery. Checks never reject a refresh or suppress valid empty schedules. The existing hourly cron and bounded detail-page rotation are preserved.

`Race Control → Service Health` loads calendar checks and aggregate club/plan/garage/lap totals only when opened. Worker logs retain one summary per refresh and anonymous `registration_click` events. Click logging is a best-effort keepalive request and cannot block navigation; Do Not Track is respected. The endpoint accepts only a fixed same-origin event under 40 bytes. It records no username, destination, cookie, visitor ID or request body. Invocation logs are disabled and URL query strings are redacted. Click totals are available through Cloudflare’s structured logs; they are sampled operational observations, not unique visitors or guaranteed registrations. No notification destination has been configured.

## Validation and rollback

Regression coverage includes ownership, forged writes, banned membership, private plans, reversible public sharing, garage limits, admin-only totals, calendar export dates/text, cached-offer cleanup and snapshot-only health checks. React DOM checks exercise lazy calendar loading, attendee usernames, Going privacy defaults, reversal of sharing, garage autofill, inline spec editing and unchanged submitted-lap snapshots after later garage updates.

Rollback the Worker/frontend to the prior version if needed. The optional tables can remain in place; the prior app does not read them. No existing lap data needs to be restored. Production smoke checks must verify the public calendar/boards, the anonymous attendance view and denial of private plan/garage fields. Real Google/legacy sign-in and user-owned plan/garage writes should also be checked by an approved member.

## Track / layout selectors and private mod inbox

Lap entry, staff lap editing, and Spinner boards use a shared map tray with region tabs, searchable circuit cards, per-layout traces, and approved entry counts (deduplicated import copies, across all dates). Configuration IDs remain the existing `lap.track` keys, so historical CW13, CCW13, The Circuit, Streets CW/CCW, and 5-mile Thunderhill submissions keep their original layout assignments and separate PBs. `src/tracks.js` includes additional Buttonwillow Classic configurations and Thunderhill East Cyclone/Bypass and West CW/CCW layouts, with source URLs. Custom entries join their circuit group. Control → Tracks now lets verified moderators and admins add circuits/layouts, rename circuits consistently, edit layout labels, select credited outlines or trace a reference image, and change visibility. Reference images stay in browser memory; only bounded SVG point geometry and an HTTPS credit URL are saved.

Spinner boards automatically show only layouts with valid approved times. Circuits with no qualifying layouts disappear too. Visibility is derived from approved results on each refresh, so a first approval reveals a layout and removal of its final approved time hides it. Manual Hide still takes precedence. The lap-submission picker retains available empty layouts so members can log their first time; staff retain the full editor.

Archive removes a layout from new lap submissions while keeping its historical board available. Hide also removes it from the public picker. Both are independent and reversible by unchecking the control and saving. Staff still see every layout. Stable IDs keep all approved and pending lap assignments unchanged. There is no delete action. The `visual_track_catalog` migration seeds all built-in IDs, revokes direct client catalog writes, and exposes only the verified-staff `spinout_save_track_layout` RPC. A restrictive insert policy rejects new pending laps for archived/hidden or unknown layouts. Existing pending laps remain reviewable. See `TRACK-MAPS.md` for source provenance and venue-reference limitations.

A yellow Message Mods launcher appears on every route. The panel loads account services on opening. Active members can create private conversations and read/reply through My messages; signed-out visitors are prompted to sign in. Control → Mod Inbox lets admins and appointed moderators filter open/resolved conversations, reply, resolve, and reopen. New replies reopen resolved threads. The Control and inbox badges show open conversations and refresh on focus, local updates, and every minute.

The `track_layouts_mod_inbox` migration adds RLS-protected `mod_threads` and `mod_replies`. Client table grants allow SELECT only, constrained to the owner or verified current staff. Invoker public RPCs delegate to private, identity-checked functions that set authors/staff flags server-side, serialize per-account writes, limit new conversations to 5 per 10 minutes and replies to 20 per 10 minutes, and limit body/subject length. No notifications are sent outside the site. Local synthetic database tests exercise ownership, spoofing, staff delegation/revocation, rate limits, replies, and resolution.
