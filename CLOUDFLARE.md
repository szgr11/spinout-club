# Existing Cloudflare deployment

Repository: https://github.com/szgr11/spinout-club

Live domain: https://spinoutclub.cc/

Cloudflare API inspection on October 16, 2026 confirmed that the domain is attached to the static-assets Worker `raspy-water-4eb5`. The account has no Pages projects.

| Setting | Value |
| --- | --- |
| Account ID | `260a0ada5fbdf9925db5e9d497b70ddc` |
| Worker name | `raspy-water-4eb5` |
| Worker tag | `39426bcf428844d3a8be016ebba77c49` |
| Compatibility date | `2026-05-13`, matching the existing deployment |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy -- --keep-vars` |
| Static asset directory | `dist/` |

`wrangler.jsonc` targets the existing Worker. The domain assignment is managed in Cloudflare.

## Native Workers Builds

Authorize the Cloudflare Workers and Pages GitHub App for **only** `szgr11/spinout-club`:

https://github.com/apps/cloudflare-workers-and-pages

Then connect the repository to the existing Worker using Workers Builds, with the commands above, root directory `/`, and production branch `main`.

Set these **build variables** in Cloudflare:

- `VITE_SUPABASE_URL=https://wzdqnzfoaaxmnkvxtlpt.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the existing project's public publishable key.
- `NODE_VERSION=24`

The Supabase variables must be available while Vite builds, rather than only at Worker request time. Never use a Supabase server secret in this frontend.

Cloudflare MCP account access is verified. The repository-link attempt returned a disconnected-Git-account error. GitHub App authorization and the native build trigger are pending. No deployment has been started by this source preparation.

## Manual GitHub Actions alternative

`.github/workflows/cloudflare-workers.yml` can deploy the same Worker from `main`. It is manual-only and has not been run. It requires:

- Repository **secret** `CLOUDFLARE_API_TOKEN`, scoped to this Cloudflare account with Workers Scripts Write access.
- Repository **variable** `VITE_SUPABASE_PUBLISHABLE_KEY`, containing the public client key.

The account ID and Supabase URL are configured in the workflow. Never put a Cloudflare token or Supabase service-role key in a Vite variable or committed file.

The previous Pages workflow was removed after inspecting the real hosting configuration.

## References

- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/
