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
| Deploy command | `npx wrangler deploy` |
| Static asset directory | `dist/` |

`wrangler.jsonc` targets the existing Worker. The domain assignment is managed in Cloudflare.

## Native Workers Builds

The Cloudflare Workers and Pages GitHub App is connected to `szgr11/spinout-club`:

https://github.com/apps/cloudflare-workers-and-pages

Workers Builds is enabled for the existing Worker, with the commands above, root directory `/`, and production branch `main`. Pushes to `main` automatically build and deploy. Preview builds are also enabled. The `previews` block uses the separate `spinout-track-events-preview` KV namespace so previews do not write to the production calendar cache.

These **build variables** are configured for production and preview builds in Cloudflare:

- `VITE_SUPABASE_URL=https://wzdqnzfoaaxmnkvxtlpt.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the existing project's public publishable key.

The first verified Cloudflare build used Node.js 24.21.0.

The Supabase variables must be available while Vite builds, rather than only at Worker request time. Never use a Supabase server secret in this frontend.

Cloudflare account access and GitHub authorization are verified. The first build and deployment succeeded on October 16, 2026 (Pacific time), from commit `931e4c240b3ce00f0f7b9da93dba853340ec944e`; build ID `3a53079c-0090-4113-9bbc-7437f35498eb`. The existing Supabase project and custom domain are retained. No database migration was applied.

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
