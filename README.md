# The Spinout Club

React + Vite source for the Spinout Club track community and Spinner boards. Supabase remains the shared backend.

## Public pages and member tools

- `/` and `/events`: public track-day calendar, source links, published offers and special events.
- `/leaderboard` (also `/leaderboards`): public Spinner boards with approved lap times and track filters. Each driver/vehicle/circuit-layout combination keeps its fastest result in the selected All/Real/Optimal filter. Formatting differences in driver/vehicle names are normalized; different model/trim descriptions stay separate. No account is required.
- `/members`: sign in to log a time, manage a profile or link Google. Approved membership is required for submissions; admin review remains protected.

All website text uses self-hosted JetBrains Mono Variable, including headings, navigation, tables, forms and member tools. Font files are bundled with the site. The font family is shared through `src/typography.js` and `src/global.css`; no Google Fonts stylesheet is fetched.

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

The app uses the existing `laps`, `pending_laps`, `profiles`, `pending_users`, `tracks`, `billboards`, and `reports` tables. Applied migrations are retained in `supabase/migrations`. Do not run the older deployment guide's sample schema over this database.

Supabase Auth verifies sessions; existing club passwords are checked server-side against private bcrypt hashes. Google can be linked to an existing membership from Profile → Settings. Public leaderboards use `security_invoker` views with explicit safe-column grants. Private account fields, pending submissions and moderation history are excluded. See `SECURITY-CUTOVER.md` for the authorization model.

Members can open Profile → Lap History for their approved submissions, newest event date first, with circuit, vehicle and lap-type filters. Slower results remain available when a PB improves; pending submissions keep their separate tab. Personal Bests and podium counts use the same driver/vehicle/layout ranking as the public board. History is associated with the submitting account, never inferred from a matching display name. Approved-result reads use stable ID pagination so older results are not silently cut off at the API's row limit; a failed page leaves existing data in place. Identical legacy imports remain collapsed for display, with account ownership included in the duplicate key. Vehicle identity remains a normalized text label, rather than a garage/VIN record; different spellings such as “M3” and “BMW M3” are separate entries.

## Hosting

The live site uses the existing static-assets Worker `raspy-water-4eb5`, targeted by `wrangler.jsonc`. Cloudflare Workers Builds automatically builds and deploys pushes to `main`. The existing Supabase project and `spinoutclub.cc` domain are retained. See `CLOUDFLARE.md` for deployment configuration and `EVENTS.md` for calendar update logic.

The existing project reference and verification notes are in `supabase/README.md`. The client also accepts `VITE_SUPABASE_ANON_KEY` for compatibility with older hosting settings.
