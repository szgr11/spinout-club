# Public track events

`/` and `/events` are public; `/leaderboard` shows public lap-time boards and `/members` is for logging times and managing membership. No account or Supabase query is required to browse events.

The existing Cloudflare Worker serves `/api/events` from its `EVENTS` KV namespace. A scheduled handler checks source schedules at the start of every hour (`0 * * * *`). New published dates appear after a successful refresh. The public API is cached for five minutes; an open calendar checks it every 15 minutes while visible and when the tab is revisited. Public requests never trigger an upstream crawl. Counts show the displayed month, that year’s upcoming event days, and all upcoming event days; all three follow the active filters. Each listing on each day counts once, so two events on one date count as two event days. Each event links directly to the original listing or registration page and shows attribution. The UI has a month calendar, day selection, list view and filters for region, track, organizer, event type and offers/special events.

Active sources:

- Speed Ventures' official upcoming-event page: California events, including Buttonwillow, Willow Springs and Chuckwalla.
- SpeedSF's official current- and next-year schedules, when published: NorCal and Buttonwillow events, with organizer-provided MotorsportReg registration links. The page year must match the requested year to prevent redirected pages creating incorrect dates.
- Buttonwillow Raceway's published Events Calendar JSON endpoint, paginated through the end of the next calendar year (up to ten pages of 100; exceeding the bound reports failure instead of silently truncating): organizer days and open testing. Open testing means practice, not free admission; no entry price is inferred from a track gate fee.
- NASA's current public event registration page, restricted to supported regional circuits and HPDE/open-track/time-trial events.
- NASA SoCal and NorCal official regional season announcements, including dates published before national registration opens. The year comes from the current heading, never a reused URL slug. These dates are labeled as announced with registration/session details pending. TBD dates, tentative endurance races and explicitly racing-only days are excluded; crossover dates merge across regions, using a specific circuit only when unambiguous. Actual registration listings take priority when available.
- Extreme Speed's registration cards and Speed District's event cards, using published dates rather than reused URL slugs.
- OnGrid and West Coast Racing's public Squarespace event lists, using full date metadata.
- SoCal Drivers Club's registration products, excluding lunches, rentals, passes and transfer fees. Explicit sale products carry their published sale prices.
- Turn8's public event data embedded in its site, using full dates and each event's timezone; drift events are excluded. Explicit track names in current titles take priority over reused venue metadata. Generic prices from multi-option ticket tables are omitted unless they identify entry/registration/HPDE pricing.
- Hooked on Driving California, Slip Angle Track Events and Fast Toys Club's public MotorsportReg organizer listings. Cancelled/postponed events, gift cards and unrelated venues are excluded.

The compiled list is retained in `src/event-catalog.js`: all 16 organizers appear in the organizer filter and a collapsible directory, including organizers with no upcoming published dates. Fifteen public feeds cover twelve organizers (including NASA national listings and two regional announcement pages) plus the Buttonwillow venue calendar. VIP Track Days has Instagram-only announcements; TRACKED.llc and Touge2Track do not currently provide a usable schedule at their compiled URLs; FastLane says standalone track days are no longer offered. These four remain external links rather than fabricated automatic feeds. The directory displays those limitations briefly.

Track aliases distinguish Buttonwillow Classic/Circuit, Big Willow/Streets, and Thunderhill East/West, separate East-and-West days, connected five-mile days, and three-/five-mile programs. Known circuits remain selectable even when no current event is published. Organizer aliases such as SDC/Southern Cal Drivers Club resolve to one name before merging.

This is a source-limited calendar, not a guarantee of all California track events. Motorcycle, kart, drift and private-event listings are excluded by the current adapters. Unknown participation requirements are labeled for confirmation. Dates are calendar dates rather than UTC timestamps, avoiding DST shifts. Weekends expand into separate days. Same-organizer/same-track/same-day listings are merged while preserving source attribution.

Every refresh reports per-source health. Failed or unrecognized parses retain previously verified future events with a stale-source warning. A recognized, explicitly empty organizer schedule is successful and clears removed dates; it does not keep old events indefinitely. Separate source snapshots prevent data retained from a failed source being confused with newly verified data. Past dates are filtered using Pacific calendar dates. The 2025 dates in the club compilation are archival and were not imported as upcoming events.

## Discounts, prices and specials

Source adapters collect explicit listing prices and offers. The refresher also checks up to 24 unique linked event pages per run, with four concurrent requests, timeouts, bounded response bodies and an allowlist of organizer/MotorsportReg hosts. Unchecked and oldest pages go first, so coverage rotates; full-pass time grows with the number of event links. The public API reports actual checked coverage. Listing updates are hourly even when a detail page waits for its next turn. The page keeps only a compact update timestamp; implementation details stay in this document.

Published discount text is shown verbatim in short excerpts with the evidence URL, check time and explicit deadline when present. Early-bird offers, coupons, special rates and dated special-event components get visible badges. Prices retain their published context; gate fees, spectators, rentals and other add-ons are not treated as track-day admission. No discount amount is inferred, and no badge does not prove that a discount is unavailable.

A successful detail check replaces previous extracted offers, removing withdrawn offers. Explicitly expired promotions and prices are filtered at refresh and request time, including deadlines written with two-digit years in pricing tables. If a page fails, last-known evidence is retained with a stale label rather than presented as freshly verified. Undated offers, relative deadlines and capacity conditions remain subject to the source's terms and are not checkout-verified. Private detail caches and source snapshots are excluded from the public API.

## MotorsportReg / Hagerty

Public organizer-specific registration listings and event links are used above; a global MotorsportReg search/API integration is not active. Their documented global API requires an authorized API key and approval. To add the global API, obtain approval/key through MotorsportReg's developer program, add a server-side adapter using the current GraphQL schema, and include their required attribution. Never reuse an API key extracted from another site's JavaScript.

Docs: https://api.motorsportreg.com/ and https://assets.motorsportreg.com/gec/docs/

## Verification

Run `node --test tests/*.test.js`, `npm run build`, and `npm run deploy:check`. Live-source smoke checks must confirm that adapters produce future dates and registration links. Unit tests cover date ranges, duplicate sources, separate organizers, open-testing labels, safe URLs and retained dates after source failures.

The legacy lap duplication fix only collapses identical imported records for display and totals. Raw database rows remain recoverable; no lap records were deleted.
