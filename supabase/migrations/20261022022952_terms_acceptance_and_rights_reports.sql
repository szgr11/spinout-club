begin;
-- Immutable documents and acceptance evidence are never client-writable.
create table spinout_private.terms_documents (
 version text primary key,
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 document jsonb not null,
 active boolean not null default false,
 published_at timestamptz not null default now(),
 unique(version,content_hash)
);
create unique index one_active_terms on spinout_private.terms_documents(active) where active;
create table spinout_private.terms_reviews (
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 version text not null references spinout_private.terms_documents(version),
 review_id uuid not null unique default gen_random_uuid(),
 opened_at timestamptz not null default clock_timestamp(),
 bottom_at timestamptz,
 primary key(auth_user_id,version)
);
create table spinout_private.terms_acceptances (
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 version text not null,
 content_hash text not null,
 reviewed_at timestamptz not null,
 bottom_at timestamptz not null,
 accepted_at timestamptz not null default clock_timestamp(),
 primary key(auth_user_id,version),
 foreign key(version,content_hash) references spinout_private.terms_documents(version,content_hash),
 check(bottom_at>=reviewed_at and accepted_at>=bottom_at+interval '12 seconds')
);
alter table spinout_private.terms_documents enable row level security;
alter table spinout_private.terms_reviews enable row level security;
alter table spinout_private.terms_acceptances enable row level security;
revoke all on spinout_private.terms_documents,spinout_private.terms_reviews,spinout_private.terms_acceptances from public,anon,authenticated;

-- PUBLISHED_DOCUMENT is inserted by the release script below, never by a browser.
insert into spinout_private.terms_documents(version,content_hash,document,active) values('2026-10-21','d1e957ff8ff11ba9b078c65553a3171fc77af38f22de8cafde53152a5fbaa62d','{"version":"2026-10-21","effectiveDate":"October 21, 2026","title":"Spinout Club Terms of Use","sections":[{"title":"1. About this community","paragraphs":["Spinout Club is a personally operated, volunteer-run, noncommercial project for motorsport enthusiasts. These Terms are an agreement between you and the individual site operator, referred to as “we,” “us,” or “the operator.” Community moderators help administer the service. The name “Club” does not establish a corporation, a registered charity, an event sanctioning body, or a partnership between members.","The service helps people report and compare lap times, keep car and lap records, find published event information, and communicate with the community. These Terms govern account and community use. They do not make you a member of any separate legal organization. You may contact the operator through the public Report or contact form linked below."]},{"title":"2. Accounts and agreement","paragraphs":["You must be at least 18 years old and able to enter this agreement to hold an account. Provide accurate account information, use a public display name you are entitled to use, keep your sign-in credentials secure, and do not share or transfer an account or impersonate another person. Google or email sign-in verifies access to an identity; it does not by itself approve community membership.","Before using member features or submitting a membership application, you must open these Terms, review them, and affirmatively accept the current version. We record your account ID, the version and document fingerprint, and server-generated review and acceptance times. The review steps are an opportunity to read the Terms, not proof that you have understood them. If you do not agree, sign out and do not use member features. You can still browse public information or submit a complaint."]},{"title":"3. Published events and third parties","paragraphs":["Calendar entries summarize and report information published by tracks, organizers, and other sources. Information may be collected or updated with software and may be incomplete, delayed, incorrectly transcribed, or changed after publication. A source link, listed price, promotion, or attendance plan is not a guarantee of availability or accuracy.","Confirm dates, layout, eligibility, safety requirements, prices, discounts, cancellation terms, and registration directly with the organizer before making plans or paying. External registration and payment services have their own terms. A listing does not establish sponsorship, affiliation, endorsement, or authority to act for the organizer. Saving a plan or choosing “going” does not register you for an event or reserve a place."]},{"title":"4. Driving, safety, and lap results","paragraphs":["Motorsport can cause serious injury, death, and property damage. Site information, track illustrations, car specifications, and lap comparisons are for community information; they are not driving instruction, engineering advice, navigation, or a certification of safety. Follow applicable laws, track rules, organizers, and qualified instructors. Do not use the service to arrange or encourage illegal street racing, dangerous public-road driving, or evasion of safety requirements.","Lap times and vehicle details are submitted by users or reported from sources. Review or approval for display does not independently certify a result, a driver, or a vehicle. Results can be disputed, corrected, reclassified, or removed. The service does not promise official rankings, comparable conditions, prizes, or a complete historical record. Unless expressly stated in a separate agreement, the site operator does not organize, supervise, insure, or provide instruction at listed events."]},{"title":"5. Your submissions and permission to display them","paragraphs":["You retain ownership of content you submit. You grant the operator a nonexclusive, worldwide, royalty-free license to host, store, reproduce, format, and display that content as needed to operate the service, including public results, lap history, moderation, and backups. This license does not authorize unrelated sale of your content or use of your identity in advertising. Service providers may process it only as needed to support these purposes.","Submit only material you own, have permission to share, or are otherwise legally entitled to use. Do not upload another person’s confidential information, private messages, identifying documents, or personal details without a lawful basis. Crop or obscure unrelated names, contact details, license plates, and other unnecessary personal information in evidence images.","Published results and associated driver, car, and event details may be visible to anyone and copied by visitors. Attendance is shared publicly only when you choose the sharing option. Your saved garage and private plans are not intended as public profile pages. Review the visibility shown in each feature. To request correction or removal, use Report or contact. Removal from our active service cannot recall copies already made by others. Limited copies may remain as reasonably needed for backups, security, disputes, or legal obligations; the operational license continues only for those limited purposes."]},{"title":"6. Community conduct","paragraphs":["Do not harass, threaten, discriminate against, dox, stalk, defame, or impersonate others. Do not submit fraudulent lap evidence, knowingly false accusations, spam, malicious code, infringing material, or unlawful content. Do not bypass access controls, misuse private data, interfere with the service, or use another member’s identity or content to mislead others.","Reasoned criticism and good-faith disputes are welcome. Report suspected problems privately with enough context to review them. Do not publish personal information or organize harassment in response to a disagreement. Moderation approval does not transfer responsibility for your submission to the operator."]},{"title":"7. Moderation, reports, and appeals","paragraphs":["We may review, label, edit for accuracy or formatting, restrict, or remove content and suspend or end accounts for violations, safety, security, legal concerns, or operation of the community. We do not promise to inspect every submission or provide continuous monitoring. Decisions should be based on the available information; they are not judicial findings.","Use Message mods for a private member conversation, or the public Report or contact form without signing in. Include the relevant page or record, what happened, supporting information, and a way to contact you. You may request reconsideration through the same channels. Where appropriate and lawful, we will give an affected user notice and an opportunity to respond. We may act immediately when necessary and may preserve relevant evidence. No fixed response time or particular outcome is guaranteed."]},{"title":"8. Copyright and other rights complaints","paragraphs":["Respect copyright, trademarks, privacy, and other rights. Source credit alone does not authorize copying protected material. Names and marks identifying tracks, organizers, and vehicles belong to their respective owners. These Terms do not grant you rights to third-party materials.","For a copyright complaint, use Report or contact and identify the copyrighted work, the exact location of the disputed material, your contact information, and your physical or electronic signature. Include a good-faith statement that the disputed use is not authorized by the owner, its agent, or the law, and a statement that the notice is accurate and, under penalty of perjury, that you are the owner or authorized to act for the owner. Consider fair use and other lawful uses before reporting. Knowingly false material representations can have legal consequences.","We may remove or disable disputed material while reviewing it and take reasonable steps to notify the submitter. If material was removed through the statutory DMCA process by mistake or misidentification, the submitter may send a counter-notice with a signature, identification and former location of the material, a statement under penalty of perjury of the good-faith belief in mistake or misidentification, and the submitter’s name, address, and telephone number. It must include consent to the jurisdiction of the appropriate U.S. federal district court (or, for a submitter outside the U.S., a district where the service provider may be found) and acceptance of service from the claimant or its agent. Where that statutory process applies, a valid counter-notice is forwarded to the claimant and material is restored after 10–14 business days unless we receive notice of a filed court action seeking to restrain the alleged infringement. Other independent moderation grounds may still apply.","Accounts of repeat infringers may be terminated in appropriate circumstances. The public form is a rights-complaint channel; publishing this policy does not represent that a designated DMCA agent has been registered or that the service qualifies for a statutory safe harbor."]},{"title":"9. Privacy and contact information","paragraphs":["Use the service with care when choosing what to publish. Do not assume a public username makes submitted details anonymous. Account, security, and moderation information is used to run and protect the service. Rights complaints may be shared with the affected submitter as needed to evaluate or respond to the complaint; statutory notices and counter-notices can require disclosure of contact information. Do not include unnecessary sensitive information.","These Terms do not replace any separately published Privacy Policy or waive privacy rights granted by law. You may contact us without accepting these Terms to raise a privacy concern or request account or content removal. Any additional consent required by law must be requested separately."]},{"title":"10. Availability and limits of responsibility","paragraphs":["To the extent permitted by law, this volunteer service is provided “as is” and “as available,” without warranties of accuracy, availability, fitness for a particular purpose, or uninterrupted operation. Keep your own copies of important records. We may change or discontinue features, and outages or loss of data can occur.","To the extent permitted by law, the operator is not responsible for indirect, incidental, special, or consequential losses arising from use of the service, including losses caused by relying on an inaccurate listing or user submission. For claims arising from the service, the operator’s total liability is limited to the greater of US$100 or amounts you paid the operator for the service in the preceding 12 months.","These limits do not exclude or limit liability for fraud, willful misconduct, gross negligence, injury or other liability that applicable law does not permit to be excluded or limited. They do not waive nonwaivable consumer or privacy rights, and they apply only to the extent enforceable in your circumstances."]},{"title":"11. Changes, ending use, and disputes","paragraphs":["Material changes to these Terms will be identified with a new version and presented for acceptance before continued member use. Changes do not retroactively change the terms governing an existing dispute. You may stop using the service at any time and request account removal through Report or contact.","California law governs this agreement to the extent permitted by applicable law, without displacing mandatory protections that apply to you. Please contact the operator first if practical so we can try to resolve a concern informally; doing so is not a condition on statutory rights or urgent relief. These Terms do not require arbitration or waive class proceedings. If a provision is unenforceable, the remaining provisions continue to the extent permitted by law."]}]}'::jsonb,true);

create function spinout_private.has_current_terms(p_auth_id uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select p_auth_id is not null and exists(
  select 1 from spinout_private.terms_documents d join spinout_private.terms_acceptances a
   on a.version=d.version and a.content_hash=d.content_hash
  where d.active and a.auth_user_id=p_auth_id)
$$;
create function spinout_private.terms_status() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 select jsonb_build_object('version',d.version,'content_hash',d.content_hash,
  'accepted',a.auth_user_id is not null,'accepted_at',a.accepted_at)
 into result from spinout_private.terms_documents d left join spinout_private.terms_acceptances a
  on a.version=d.version and a.content_hash=d.content_hash and a.auth_user_id=auth.uid() where d.active;
 if result is null then raise exception 'Terms unavailable';end if;
 return result;
end $$;
create function spinout_private.begin_terms_review(p_version text,p_hash text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if not exists(select 1 from spinout_private.terms_documents where active and version=p_version and content_hash=p_hash) then raise exception 'Terms changed; refresh the page';end if;
 insert into spinout_private.terms_reviews(auth_user_id,version) values(auth.uid(),p_version)
 on conflict(auth_user_id,version) do update set review_id=gen_random_uuid(),opened_at=clock_timestamp(),bottom_at=null
 returning review_id into result;
 return result;
end $$;
create function spinout_private.terms_bottom(p_review_id uuid) returns void
 language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 update spinout_private.terms_reviews r set bottom_at=coalesce(r.bottom_at,clock_timestamp())
 where r.review_id=p_review_id and r.auth_user_id=auth.uid()
  and r.opened_at>clock_timestamp()-interval '1 hour'
  and exists(select 1 from spinout_private.terms_documents d where d.version=r.version and d.active);
 if not found then raise exception 'Review expired; reopen the Terms';end if;
end $$;
create function spinout_private.accept_terms(p_version text,p_hash text,p_review_id uuid,p_agreed boolean) returns void
 language plpgsql security definer set search_path='' as $$
declare review spinout_private.terms_reviews;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if p_agreed is distinct from true then raise exception 'Choose whether to agree';end if;
 if not exists(select 1 from spinout_private.terms_documents where active and version=p_version and content_hash=p_hash) then raise exception 'Terms changed; refresh the page';end if;
 select * into review from spinout_private.terms_reviews where review_id=p_review_id and auth_user_id=auth.uid() and version=p_version for update;
 if not found or review.opened_at<clock_timestamp()-interval '1 hour' or review.bottom_at is null then raise exception 'Open and scroll through the Terms first';end if;
 if clock_timestamp()<review.bottom_at+interval '12 seconds' then raise exception 'Wait 12 seconds after reaching the bottom';end if;
 insert into spinout_private.terms_acceptances(auth_user_id,version,content_hash,reviewed_at,bottom_at)
 values(auth.uid(),p_version,p_hash,review.opened_at,review.bottom_at) on conflict do nothing;
end $$;
revoke all on function spinout_private.has_current_terms(uuid),spinout_private.terms_status(),spinout_private.begin_terms_review(text,text),spinout_private.terms_bottom(uuid),spinout_private.accept_terms(text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function spinout_private.has_current_terms(uuid) to anon,authenticated;
grant execute on function spinout_private.terms_status(),spinout_private.begin_terms_review(text,text),spinout_private.terms_bottom(uuid),spinout_private.accept_terms(text,text,uuid,boolean) to authenticated;
create function public.spinout_terms_status() returns jsonb language sql stable security invoker set search_path='' as $$select spinout_private.terms_status()$$;
create function public.spinout_begin_terms_review(p_version text,p_hash text) returns uuid language sql security invoker set search_path='' as $$select spinout_private.begin_terms_review(p_version,p_hash)$$;
create function public.spinout_terms_bottom(p_review_id uuid) returns void language sql security invoker set search_path='' as $$select spinout_private.terms_bottom(p_review_id)$$;
create function public.spinout_accept_terms(p_version text,p_hash text,p_review_id uuid,p_agreed boolean) returns void language sql security invoker set search_path='' as $$select spinout_private.accept_terms(p_version,p_hash,p_review_id,p_agreed)$$;
revoke all on function public.spinout_terms_status(),public.spinout_begin_terms_review(text,text),public.spinout_terms_bottom(uuid),public.spinout_accept_terms(text,text,uuid,boolean) from public,anon;
grant execute on function public.spinout_terms_status(),public.spinout_begin_terms_review(text,text),public.spinout_terms_bottom(uuid),public.spinout_accept_terms(text,text,uuid,boolean) to authenticated;

-- Existing signed sessions, Google identities, and direct REST requests all need
-- the current agreement. No roles are granted through user-editable metadata.
create or replace function spinout_private.member_name() returns text language sql stable security definer set search_path='' as $$
 select username from public.profiles where auth_user_id=(select auth.uid()) and not coalesce(banned,false) and role in ('admin','member') and spinout_private.has_current_terms(auth.uid())
$$;
create or replace function spinout_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where auth_user_id=(select auth.uid()) and role='admin' and not coalesce(banned,false) and spinout_private.has_current_terms(auth.uid()))
$$;
create or replace function spinout_private.can_moderate() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where auth_user_id=(select auth.uid()) and not coalesce(banned,false) and (role='admin' or (role='member' and moderator)) and spinout_private.has_current_terms(auth.uid()))
$$;
-- Restrictive policies also close permissive ownership paths on existing tables.
do $$declare t text;begin
 foreach t in array array['profiles','pending_users','laps','pending_laps','reports','tracks','billboards','member_garage','event_plans','mod_threads','mod_replies'] loop
 execute format('create policy current_terms_required on public.%I as restrictive for all to authenticated using ((select spinout_private.has_current_terms(auth.uid()))) with check ((select spinout_private.has_current_terms(auth.uid())))',t);
 end loop;
end $$;
create or replace function public.spinout_submit_application(p_auth_id uuid,p_username text,p_nickname text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=p_auth_id and email_confirmed_at is not null and deleted_at is null) then raise exception 'Verify your email first';end if;
 if not spinout_private.has_current_terms(p_auth_id) then raise exception 'Accept the current Terms before applying';end if;
 if p_username !~ '^[a-z0-9_]{3,24}$' or length(p_nickname) not between 1 and 60 or length(p_reason) not between 10 and 1000 then raise exception 'Check username, display name and application';end if;
 if exists(select 1 from public.profiles where username=p_username or auth_user_id=p_auth_id) or exists(select 1 from public.pending_users where username=p_username or auth_user_id=p_auth_id) then raise exception 'An account or application already exists';end if;
 insert into public.pending_users(username,nickname,reason,submitted_at,auth_user_id) values(p_username,p_nickname,p_reason,(extract(epoch from now())*1000)::bigint,p_auth_id);
end $$;

-- A rights complainant must not need an account or acceptance of these Terms.
-- Only the bot-verified, rate-limited Edge Function can insert these records.
create table public.legal_reports (
 id uuid primary key default gen_random_uuid(),
 category text not null check(category in ('community','copyright','counter_notice','privacy','appeal','other')),
 email text not null check(char_length(email) between 3 and 254),
 subject text not null check(char_length(btrim(subject)) between 1 and 120),
 body text not null check(char_length(btrim(body)) between 10 and 4000),
 page text not null default '' check(char_length(page)<=500),
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now()
);
create index legal_reports_created on public.legal_reports(created_at desc);
alter table public.legal_reports enable row level security;
revoke all on public.legal_reports from public,anon,authenticated;
grant select on public.legal_reports to authenticated;
grant update(status) on public.legal_reports to authenticated;
grant all on public.legal_reports to service_role;
create policy legal_reports_staff_read on public.legal_reports for select to authenticated using ((select spinout_private.can_moderate()));
create policy legal_reports_staff_resolve on public.legal_reports for update to authenticated using ((select spinout_private.can_moderate())) with check ((select spinout_private.can_moderate()));
commit;
