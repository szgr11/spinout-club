# Connect the existing Cloudflare Pages site

Repository: https://github.com/szgr11/spinout-club

Existing custom domain: https://spinoutclub.cc/

The earlier site was deployed using Cloudflare Pages Direct Upload. Cloudflare supports deploying to that same project from GitHub Actions with Wrangler. This preserves the existing custom-domain assignment; it does not require switching the Pages project to native Git integration.

## Prepared deployment workflow

`.github/workflows/cloudflare-pages.yml` builds `main` using Node.js 24, `npm ci`, and `npm run build`, then uploads `dist/` to the configured existing Pages project. It is currently manual-only (`workflow_dispatch`); uploading this file does not start a deployment. Automatic deployments can be enabled after the account and project have been verified.

Set these repository variables in GitHub Settings > Secrets and variables > Actions > Variables:

| Variable | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The account owning the current Pages project |
| `CLOUDFLARE_PAGES_PROJECT` | The exact existing Cloudflare Pages project name; do not use the custom domain here |
| `VITE_SUPABASE_URL` | `https://wzdqnzfoaaxmnkvxtlpt.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The existing project's public publishable key |

Set `CLOUDFLARE_API_TOKEN` as a repository **secret**. Scope it to the owning Cloudflare account with Cloudflare Pages Edit permission. Do not put this token in source files or Vite variables.

Cloudflare account access, project name, and GitHub repository variables/secrets have not yet been configured. Neither the domain nor the existing deployment has been changed by this repository preparation.

Before running the workflow, confirm the project name and review differences between this recovered source and the currently deployed site. From GitHub Actions, choose the workflow, select `main`, and run it. Confirm the deployment in Cloudflare and check `https://spinoutclub.cc/` afterward.

## References

- https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
