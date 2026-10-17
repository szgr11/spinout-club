# Authentication cutover — staged, not active

This branch contains the password/session migration, Google sign-in and membership bot protection. The public calendar and lap display fix are already live on main. Do not merge the new member UI before the database and Edge Function are ready.

Automatic approval review rejected the live migration (plaintext-column removal and access-rule replacement without a validated backup) and the encrypted recovery snapshot (sensitive backup requires explicit authorization). Neither operation succeeded. Owner approval is required for the backup and production cutover.

## Prepared behavior

Existing passwords convert inside PostgreSQL to salted bcrypt (cost 12), in a private schema with no client table privileges. Active plaintext columns are removed, and retired app_kv password copies are scrubbed. No actual passwords are returned, downloaded or saved to source. Usernames, memberships, bans, pending applications and lap history are preserved.

Existing members keep username/password login. The server checks the bcrypt hash and issues a signed, refreshable Supabase Auth session. Auth identities are created on first protected login with random reserved addresses, preventing a pre-created email from claiming a username. Role permissions come from server-owned profile rows, never localStorage or editable user metadata.

Existing members can link Google from Profile → Settings while signed in, preserving their member record and laps. New applicants sign in with Google or a verified email link first. Membership applications require server-verified Turnstile, a unique Auth identity, daily identity/IP quotas and admin approval. Direct public database writes are denied.

Only approved members can submit their own laps/reports. Only admins can approve membership/laps or manage approved records, tracks and announcements. Bans take effect at the database even while a JWT remains valid.

## After owner approval

1. Create and verify a restricted, encrypted recovery snapshot before changing live tables. Proposed backup SQL is in supabase/backup-security.sql. It contains the original records, including old passwords, encrypted with AES-256; a random recovery key remains in Supabase Vault. Return only backup ID and record counts. Agree snapshot retention/removal after validating admin sign-in.
2. Re-run the tests/build. Validate setup-security.sql in a rollback-only transaction against the actual project, then apply its atomic transaction. Any error must roll back the transaction.
3. Save the new Turnstile widget secret in Supabase Vault and reference its UUID in spinout_private.config under turnstile_secret. Sitekey: 0x4AAAAAAFZC5gsfKkYlIdpi. Domains: spinoutclub.cc, localhost, 127.0.0.1. Production siteverify accepts only spinoutclub.cc, and exact login/application actions. The secret is not in GitHub and was not stored in Supabase.
4. Deploy supabase/functions/club-auth with verify_jwt=false. The endpoint performs its own authentication: server-checked credentials for login and validated bearer JWT plus verified email for applications. The service-role key remains in the Edge Function's built-in environment.
5. Set Supabase Auth Site URL to https://spinoutclub.cc and allowed redirect URL to https://spinoutclub.cc/members. Enable manual identity linking and Google below. Merge and deploy this branch through the existing Cloudflare pipeline.
6. Verify actual member/admin login, password change, Google link/sign-in, RLS denials, application approval, lap submission, and fresh/replayed/missing Turnstile proofs. Use secure owner sign-in when required. Never request credentials in chat.

## Google configuration still required

The project's public Auth settings confirm Google is disabled. Create an owner-owned Google Cloud Web application OAuth client with:
- Origin: https://spinoutclub.cc
- Redirect URI: https://wzdqnzfoaaxmnkvxtlpt.supabase.co/auth/v1/callback
- Scopes: openid, userinfo.email, userinfo.profile only.
- Public audience as intended; testing audience permits only named test users.

Save the client ID/secret in Supabase's Google provider settings, never Vite variables or GitHub. Enable manual linking for existing member accounts.

Docs: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/auth/auth-identity-linking

## Validation and limits

The migration passed isolated PostgreSQL/pgcrypto tests using synthetic records: bcrypt verification, plaintext removal, anonymous denials, member ownership, role escalation denial, banned-member restrictions, unique application identity, atomic approval and password updates. Endpoint tests cover missing/replayed proofs, exact hostname/action, invalid JWTs, request limits and rate-limit failures. The Vite build passed before a workspace transport interruption.

These checks do not validate Supabase Vault encryption, the deployed Edge runtime, actual Google credentials/redirects, or real Turnstile success/replay. Those checks remain required before reporting production completion.

To reproduce the isolated database test, install @electric-sql/pglite@0.5.10 locally with --no-save --package-lock=false, then run node --test tests/security-database.local.mjs. Regular endpoint/calendar tests use node --test tests/*.test.js.

Old passwords were previously publicly readable. Hashing prevents future disclosure; members should change old or reused passwords after the cutover.
