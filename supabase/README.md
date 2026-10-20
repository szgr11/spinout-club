# Existing Supabase project

- Name: spinout club
- Project reference: wzdqnzfoaaxmnkvxtlpt
- Dashboard: https://supabase.com/dashboard/project/wzdqnzfoaaxmnkvxtlpt
- Region: us-west-2

The app retains this hosted backend. Use only the public publishable key in Vite configuration. Server credentials remain in the Edge Function environment and Supabase Vault.

`migrations/20261017053044_secure_member_auth.sql` contains the applied authentication/permission cutover. `setup-security.sql` is an identical readable copy; do not run both. The follow-up `20261017055042_isolate_auth_privileges.sql` isolates privileged implementations behind invoker RPCs. Existing member, application and lap records are retained. Credentials are private bcrypt hashes; obsolete public password fields contain only a non-secret marker.

See `../SECURITY-CUTOVER.md` for provider configuration, production checks and verification limits. No automated Supabase GitHub migration deployment has been enabled; review and baseline the earlier schema before enabling that integration.


## Moderator delegation

Apply `20261020063347_moderator_permissions.sql` before deploying the frontend that selects the new `moderator` column. This migration has been verified in the isolated local PostgreSQL tests; it must be applied separately from the frontend release.

Full admins use **Control → Members → Make mod / Remove mod**. Moderator accounts keep their member role and receive a separate boolean permission; no admin account is created. Mods can review lap submissions, reports and membership applications, manage laps, tracks and announcements, and suspend ordinary members. Only full admins can grant/remove moderator access or suspend other mods. Admins, system accounts and service health totals remain protected.

Role delegation uses an invoker RPC guarded by an explicit admin check and existing profile RLS. Mods cannot write profile identities or roles directly. Member approval and suspension use private, narrowly scoped implementations with caller checks and public invoker wrappers. Permissions are read from the current database row for each operation, so revoking or suspending a moderator does not depend on refreshing a JWT. No existing user is automatically promoted.
