# Public track events

`/` and `/events` are public; `/leaderboard` shows public lap-time boards and `/members` is for logging times and managing membership. No account or Supabase query is required to browse events.

The existing Cloudflare Worker serves `/api/events` from its `EVENTS` KV namespace. A scheduled handler checks source schedules at the start of every hour (`0 * * * *`). New published dates appear after a successful refresh. The public API is cached for five minutes; an open calendar checks it every 15 minutes while visible and when the tab is revisited. Public requests never trigger an upstream crawl. Each event links directly to the original listing or registration page and shows attribution. The UI has a month calendar, day selection, list view and filters for region, track, organizer, event type and offers/special events.

Active sources:

- Speed Ventures' official upcoming-event page: California events, including Buttonwillow, Willow Springs and Chuckwalla.
- SpeedSF's official current- and next-year schedules, when published: NorCal and Buttonwillow events, with organizer-provided MotorsportReg registration links. The page year must match the requested year to prevent redirected pages creating incorrect dates.
- Buttonwillow Raceway's published Events Calendar JSON endpoint, paginated for the next twelve months: organizer days and open testing. Open testing means practice, not free admission; no entry price is inferred from a track gate fee.

This is a source-limited calendar, not a guarantee of all California track events. Motorcycle, kart, drift and private-event listings are excluded by the current adapters. Unknown participation requirements are labeled for confirmation. Dates are calendar dates rather than UTC timestamps, avoiding DST shifts. Weekends expand into separate days. Same-organizer/same-track/same-day listings are merged while preserving source attribution.

Every refresh reports per-source health. Failed or empty parses retain previously verified future events with a stale-source warning; cancelled or removed events disappear after a successful source refresh. Separate source snapshots prevent data retained from a failed source being confused with newly verified data. Past dates are filtered using Pacific calendar dates. Users should always verify availability and eligibility on the linked source.

## Discounts, prices and specials

Source adapters collect explicit listing prices and offers. The refresher also checks up to 24 unique linked event pages per run, with four concurrent requests, timeouts, bounded response bodies and an allowlist of organizer/MotorsportReg hosts. Unchecked and oldest pages go first, so coverage rotates. With 51 links, a full pass takes about three hourly runs; the page shows actual checked coverage. Listing updates are hourly even when a detail page waits for its next turn.

Published discount text is shown verbatim in short excerpts with the evidence URL, check time and explicit deadline when present. Early-bird offers, coupons, special rates and dated special-event components get visible badges. Prices retain their published context; gate fees, spectators, rentals and other add-ons are not treated as track-day admission. No discount amount is inferred, and no badge does not prove that a discount is unavailable.

A successful detail check replaces previous extracted offers, removing withdrawn offers. Explicitly expired promotions are filtered at refresh and request time. If a page fails, last-known evidence is retained with a stale label rather than presented as freshly verified. Undated offers remain subject to the source's terms. Private detail caches and source snapshots are excluded from the public API.

## MotorsportReg / Hagerty

Direct MotorsportReg aggregation is not active. Their documented global API requires an authorized API key and approval. The public page provides a MotorsportReg calendar link, and SpeedSF's registration links already lead directly to MotorsportReg. To add the global API as another source, obtain approval/key through MotorsportReg's developer program, add a server-side adapter using the current GraphQL schema, and include their required attribution. Never reuse an API key extracted from another site's JavaScript.

Docs: https://api.motorsportreg.com/ and https://assets.motorsportreg.com/gec/docs/

## Verification

Run `node --test tests/*.test.js`, `npm run build`, and `npm run deploy:check`. Live-source smoke checks must confirm that adapters produce future dates and registration links. Unit tests cover date ranges, duplicate sources, separate organizers, open-testing labels, safe URLs and retained dates after source failures.

The legacy lap duplication fix only collapses identical imported records for display and totals. Raw database rows remain recoverable; no lap records were deleted.
