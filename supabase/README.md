# Existing Supabase project

- Name: spinout club
- Project reference: wzdqnzfoaaxmnkvxtlpt
- Dashboard: https://supabase.com/dashboard/project/wzdqnzfoaaxmnkvxtlpt
- Region: us-west-2

The app retains this hosted backend. Use only the public publishable key in Vite configuration. Server credentials remain in the Edge Function environment and Supabase Vault.

`migrations/20261017053044_secure_member_auth.sql` contains the applied authentication/permission cutover. `setup-security.sql` is an identical readable copy; do not run both. The follow-up `20261017055042_isolate_auth_privileges.sql` isolates privileged implementations behind invoker RPCs. Existing member, application and lap records are retained. Credentials are private bcrypt hashes; obsolete public password fields contain only a non-secret marker.

See `../SECURITY-CUTOVER.md` for provider configuration, production checks and verification limits. No automated Supabase GitHub migration deployment has been enabled; review and baseline the earlier schema before enabling that integration.
