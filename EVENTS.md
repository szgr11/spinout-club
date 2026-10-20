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

The compiled list is retained in `src/event-catalog.js`: all 16 organizers appear in the organizer filter and a collapsible directory, including organizers with no upcoming published dates. Twenty-three public feeds cover twelve organizers (including NASA national listings and two regional announcement pages) plus official venue calendars. VIP Track Days has Instagram-only announcements; TRACKED.llc and Touge2Track do not currently provide a usable schedule at their compiled URLs; FastLane says standalone track days are no longer offered. These four remain external links rather than fabricated automatic feeds. The directory displays those limitations briefly.

## Official track calendars

Venue feeds are independent of the organizer directory, so a new organizer's published event at a supported track can be discovered without adding an organizer feed. They run on the same hourly refresh and use the same stale-source retention. Track announcements yield to actual organizer registration listings when the organizer, day and circuit agree. Generic Buttonwillow/Thunderhill announcements only resolve to a specific circuit when exactly one configuration agrees for that organizer and day.

| Facility | Imported official source | Scope and limits |
| --- | --- | --- |
| Buttonwillow Classic / Circuit | Published Events Calendar JSON | Existing feed; through December of the next year. |
| Big Willow / Streets of Willow | Events & Experiences page | Published car test-and-tune sections and reserve links; currently Big Willow dates only. The former full venue calendar is no longer on the current site; this does not establish full Streets coverage. |
| Chuckwalla | Official app calendar's confirmed JSON entries | Car entries only, through December of next year; membership days, private bookings, motorcycles and explicitly racing-only listings excluded. Pending bookings are not imported. Gate fees are never track entry prices. |
| Thunderhill East / West / 5 mile | Public Google ICS feeds embedded by the track | Main road courses only; skid-pad calendars excluded. All-day end dates are exclusive, folded text is decoded, and published individual recurrence exceptions are retained. Available/private/tentative dates and known motorcycle/race listings are excluded. Unsupported recurring driving series report a source failure rather than invented dates. |
| Laguna Seca | Public Airtable ICS feed embedded through the official Track Calendar | Uses the actual rental calendar, rather than the headline spectator events. Off-track, private, motorcycle and known spectator/race listings excluded. Unknown car bookings are labeled Track event with eligibility unconfirmed. |
| Sonoma | Official On-Track Experiences Calendar | Reads embedded date-specific event HTML without executing JavaScript; imports driving/open-test providers, excludes karting, drags, motorcycles and known race-only series. Competition-license requirements are preserved. Only the dates published in the official rolling calendar are available. |
| Las Vegas Motor Speedway | Official Experiences Calendar | Watches for track-day/open-test entries; rental-car experiences, NASCAR rides and spectator events are excluded. A calendar with no relevant entries is a successful empty feed. Only published dates are available. |
| Spring Mountain | Official school calendar | Imports explicitly named Advanced Track Days, labeled Advanced driving program with prerequisites unconfirmed. Follows published pagination (maximum 30 pages, three concurrent requests). Owner-only schools and member-only days are excluded; this is not a public open-HPDE calendar. |

New venue-only listings link to the official calendar if no usable organizer or registration link is published. Unknown participation requirements remain explicit; a venue booking does not guarantee public admission. All new adapters exclude past dates and stop at the end of the next calendar year. As checked October 17, 2026, Chuckwalla publishes 2027 car bookings; other venue calendars may have no relevant 2027 entries yet. The feeds keep checking without inventing future dates.

Track aliases distinguish Buttonwillow Classic/Circuit, Big Willow/Streets, and Thunderhill East/West, separate East-and-West days, connected five-mile days, and three-/five-mile programs. Known circuits remain selectable even when no current event is published. Organizer aliases such as SDC/Southern Cal Drivers Club resolve to one name before merging.

Canyon Run, Canyon Run Racing and Canyon Run Sunday/Sundays resolve to **Canyon Run Sundays**. Buttonwillow's November 21, 2026 Canyon Run listing links to the organizer's own matching event at The Circuit. Canonical names also apply when serving older cached calendars and retaining failed-source snapshots. Matching organizer/day/circuit entries merge with their source attribution; different days, circuit layouts and autocross entries remain separate.

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


## Calendar presentation

The feed serves upcoming track days, so the current month starts at the current Pacific-time week by default. “Show full month” restores elapsed weeks; other months always show their complete month with only the required Sunday–Saturday rows. Past dates are marked as past rather than presented as evidence that no events took place.

Today has a yellow date badge, a cell outline and a visible TODAY label. The Today button returns to the current month and scrolls to that cell. The date marker refreshes every minute and when the page becomes visible.

Selecting a date or a +more button opens the day's event details in a native modal tray. It retains registration links, published offers and optional planning tools. Escape, the close button or a backdrop click closes it and restores focus to the trigger. Month transitions and the tray entrance honor reduced-motion preferences. Calendar navigation and page headings share the same components as the other pages.

The month list remains mounted when a date is selected. The day tray is a separate, persistent dialog, opened in a layout effect before paint, with a transform-only slide and no opacity animation. Focus moves without scrolling; closing returns focus to the day trigger. The dialog and controls use square corners.
