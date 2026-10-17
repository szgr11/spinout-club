# Member authentication cutover

The `secure_member_auth` migration and `club-auth` Edge Function are live in the existing Supabase project. The matching frontend was first deployed directly to the existing Cloudflare Worker at https://spinoutclub.cc/members (deployment `0ce0dda2b38b49efb23558465d8f232c`). Production source includes both applied migrations; do not roll back to the old browser-only login implementation.

The production source is maintained in https://github.com/szgr11/spinout-club. The existing Supabase database and Edge Function retain their own deployments; publishing the Vite frontend does not reapply database migrations.

## Active backend behavior

- Existing username/password credentials are salted bcrypt hashes (cost 12) in `spinout_private.credentials`, which clients cannot read. PostgreSQL verified every copied hash before neutralizing the old public password fields. The retained fields contain only `[secured]`, enforced by constraints and used as the default for new applications. Password fields in the retired key/value store were scrubbed recursively. No original passwords were exported or backed up.
- Member, pending-application and lap records are retained. Existing members keep username/password login; first sign-in creates and links a reserved random Supabase Auth identity. The server returns signed, refreshable Auth tokens. Retired localStorage-only identities are discarded.
- Postgres uses server-owned membership rows for member/admin authorization. Banned members lose database access with an existing token. Public writes and credential access are denied. Applications and pending laps are visible only to their owner and club admins. Existing approved leaderboards remain restricted to members.
- Login, email-link requests and applications require server-verified Turnstile with exact production hostname/action checks. Requests are size-limited. Database-backed quotas apply per address, username/email and authenticated applicant. One pending application is allowed per Auth identity, and approval remains an admin operation.
- Failed password changes return structured errors so their attempt counter commits instead of rolling back. New club passwords require at least 12 characters and at most 72 UTF-8 bytes.
- Turnstile's secret is in Supabase Vault; only a service-role RPC resolves it. No service key or provider secret is shipped to the browser.
- The `isolate_auth_privileges` follow-up keeps privileged account/password implementations in the unexposed private schema. Public account/password RPCs run as invokers; application approval uses its explicit admin check and RLS without owner privileges.
- Pending-lap submitters, report owners and track/date lookups are indexed. Report duplication is constrained per lap/member.

## Google and email provider setup

The Google button and explicit existing-member linking flow are implemented. Google remains disabled until the owner configures an owned OAuth client in Supabase:

1. Google Cloud Web client origin: `https://spinoutclub.cc`.
2. Google callback: `https://wzdqnzfoaaxmnkvxtlpt.supabase.co/auth/v1/callback`.
3. Configure client ID/secret only in Supabase's Google provider settings. Enable manual identity linking. Never place a Google secret in Vite variables or source control.
4. Supabase Auth Site URL: `https://spinoutclub.cc`; allowed redirect: `https://spinoutclub.cc/members`.
5. Confirm production email delivery/redirects and the intended Google audience before advertising those sign-in methods. Supabase Auth's own CAPTCHA and rate limits should also be configured to protect its direct signup/OTP API.

Existing members must sign in with their original club username/password before linking Google from Profile → Settings. Signing in with an unlinked Google identity does not grant membership or access to another member's laps.

## Verification

The migration passed an isolated PostgreSQL/pgcrypto permission suite and a rollback-only rehearsal against the actual hosted schema before application. Endpoint tests cover valid login tokens, application identity binding, email redirects, missing/replayed/wrong-action challenges, forged JWTs, request size, and quota denial. A configured Vite production build passes.

Cloudflare's previous preview failed because `wrangler preview` required a `previews` binding. The configuration now uses the separate `spinout-track-events-preview` KV namespace. Preview bot checks intentionally cannot authenticate against the production endpoint.

Post-release checks passed: 13 profile records, one existing pending application and all 376 lap rows remain; 13 bcrypt credentials are private; no old password values remain in the active or retired stores. Eight live denial checks reject anonymous table access, direct applications, private credential RPCs, missing/invalid bot proofs and forged JWTs. All deployed HTML/JS/CSS bytes match the local build; the public calendar returns 62 event days and the six-hour cron remains configured. Actual member/admin login with a real Turnstile challenge, Google linking and production email delivery need browser/owner validation. Do not describe these untested flows as verified.

## Reproduce local checks

Run `npm ci`, `npm test` and `npm run build` with the public Supabase build variables. PGlite is a pinned development dependency. The first migration and `setup-security.sql` are identical; apply that migration once, never both, followed by the privilege-isolation migration.

Old passwords were previously public. Members should change old or reused passwords after signing back in.

Docs: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/auth/auth-identity-linking
