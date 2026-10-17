# Public track events

`/` and `/events` are public; `/members` opens the existing member area. No account or Supabase query is required to browse events.

The existing Cloudflare Worker serves `/api/events` from its `EVENTS` KV namespace. A scheduled handler refreshes sources at 00:00, 06:00, 12:00 and 18:00 UTC. Public requests never trigger an upstream crawl. Each event links directly to the original listing or registration page and shows attribution. The UI has a month calendar, day selection, list view and filters for region, track, organizer and event type.

Active sources:

- Speed Ventures' official upcoming-event page: California events, including Buttonwillow, Willow Springs and Chuckwalla.
- SpeedSF's official current-year schedule: NorCal and Buttonwillow events, with organizer-provided MotorsportReg registration links.
- Buttonwillow Raceway's published Events Calendar JSON endpoint, paginated for the next twelve months: organizer days and open testing. Open testing means practice, not free admission; no entry price is inferred from a track gate fee.

This is a source-limited calendar, not a guarantee of all California track events. Motorcycle, kart, drift and private-event listings are excluded by the current adapters. Unknown participation requirements are labeled for confirmation. Dates are calendar dates rather than UTC timestamps, avoiding DST shifts. Weekends expand into separate days. Same-organizer/same-track/same-day listings are merged while preserving source attribution.

Every refresh reports per-source health. Failed or empty parses retain previously verified future events with a stale-source warning; cancelled or removed events disappear after a successful source refresh. Users should always verify availability and eligibility on the linked source.

## MotorsportReg / Hagerty

Direct MotorsportReg aggregation is not active. Their documented global API requires an authorized API key and approval. The public page provides a MotorsportReg calendar link, and SpeedSF's registration links already lead directly to MotorsportReg. To add the global API as another source, obtain approval/key through MotorsportReg's developer program, add a server-side adapter using the current GraphQL schema, and include their required attribution. Never reuse an API key extracted from another site's JavaScript.

Docs: https://api.motorsportreg.com/ and https://assets.motorsportreg.com/gec/docs/

## Verification

Run `node --test tests/*.test.js`, `npm run build`, and `npm run deploy:check`. Live-source smoke checks must confirm that adapters produce future dates and registration links. Unit tests cover date ranges, duplicate sources, separate organizers, open-testing labels, safe URLs and retained dates after source failures.

The legacy lap duplication fix only collapses identical imported records for display and totals. Raw database rows remain recoverable; no lap records were deleted.
