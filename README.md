# The Spinout Club

React + Vite source for the Spinout Club track community and driver leaderboards. Supabase remains the shared backend.

## Recovered baseline

`src/SpinoutClub.jsx` is an unchanged copy of `SpinoutClub(4).jsx`, saved May 13, 2026 at 07:36 UTC. This is the newest recovered source, not a verified export of the currently deployed site. The missing Vite entry point and Supabase client module have been recreated.

The existing interface includes track leaderboards, lap submissions and review, membership applications, profiles, announcements, reports, and custom tracks.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
cp .env.example .env
```

Set these values in `.env` using the existing Supabase project's settings:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

```sh
npm run dev
```

Only a public anon/publishable key belongs in this browser app. Never use a Supabase service-role or secret key here. Vite embeds `VITE_` variables in the public bundle. Local environment files are excluded from Git.

## Build

```sh
npm run build
npm run preview
```

The production output is `dist/`. The build also succeeds without configuration; the app then displays a configuration notice rather than contacting a database. Building does not validate credentials, database availability, or row-level security policies.

## Existing Supabase database

The recovered app uses these existing tables: `laps`, `pending_laps`, `profiles`, `pending_users`, `tracks`, `billboards`, and `reports`. No database migration is included or applied. The older deployment guide's sample schema does not exactly match this later component, so it must not be run as a migration for this baseline.

The recovered component uses custom username/password fields and a local session record, rather than Supabase Auth. It reads password fields into the browser. This legacy behavior is preserved for recovery; authentication and database authorization need review before expanding access or publishing a new deployment.

## Hosting

The live site uses the existing static-assets Worker `raspy-water-4eb5`, targeted by `wrangler.jsonc`. Cloudflare Workers Builds is connected to this repository and automatically builds and deploys pushes to `main`. The first deployment succeeded on October 16, 2026 (Pacific time), using the existing Supabase project and `spinoutclub.cc` domain. No Supabase schema or data changes were made. See `CLOUDFLARE.md` for the verified configuration and the optional manual GitHub Actions workflow.

The existing project reference and verification notes are in `supabase/README.md`. The client also accepts `VITE_SUPABASE_ANON_KEY` for compatibility with older hosting settings.
