# MotorsportReg calendar API integration

Status: prepared and tested against synthetic schema-based fixtures. No API key or
approval was present in the Worker bindings or build-variable names reviewed for
this release. Live API activation and production-response verification remain pending.

## Request access

For this project, ask for the **Global Events Calendar GraphQL API**, rather than
organizer-account administration or access to attendee/member records.

- Current integration request: https://info.motorsportreg.com/partners
- Calendar API request linked by MotorsportReg's developer announcement:
  https://form.typeform.com/to/oQna7pyH
- Widget/calendar request linked by the official blog:
  https://form.typeform.com/to/JvaTM6T9
- Support: support@motorsportreg.com
- Official developer guidance for calendar mashups:
  https://groups.google.com/g/motorsportreg-api-developers/c/0W6cUD8mmZU
- Schema: https://assets.motorsportreg.com/gec/docs/graphql-api/graphql-schema.html
- Endpoint/authentication example:
  https://groups.google.com/g/motorsportreg-api-developers/c/o9XOoIvkImA

The official request pages require review and provisioned credentials. No request
has been submitted, no account has been created, and no approval is represented.
The organization-specific unauthenticated REST feed still has documented prior
approval and attribution requirements; it is not an approval bypass.

Suggested application description:

> Spinout Club (https://spinoutclub.cc) is a personally operated, noncommercial
> enthusiast community. Members record lap times and find track days at selected
> California and nearby Nevada circuits. We would like read-only Global Events
> Calendar API access to show public event names, dates, venues, organizers,
> registration status and links, with your required attribution. Registration and
> payments stay on MotorsportReg or the organizer's site. We do not need attendee,
> member, contact, payment, or private event data. We plan to cache results on our
> server and refresh hourly, subject to your approved rate limits. Please confirm
> permission for this use, caching/retention limits, required branding, key scope,
> any costs, and whether the GraphQL calendar API is the appropriate integration.

## Activate after approval

1. Obtain the issued calendar API key, applicable terms, and written permission for
   this display/caching use. Confirm the cadence and any fees rather than assuming.
2. Implement/confirm the exact attribution supplied by MotorsportReg. Do not claim
   a partnership, endorsement, or special approval of the site itself.
3. Store `MSR_API_KEY` as a **Worker secret**, never a `VITE_` variable or Git file.
4. Set Worker variables `MSR_API_APPROVED=true` and
   `MSR_ATTRIBUTION_CONFIRMED=true` only once those conditions are met. Preserve
   runtime variables during deployments (`wrangler deploy --keep-vars`).
5. Validate a live response, pagination, track coverage, cancellations, local dates,
   and branding before treating the integration as production-verified. Then
   allow the next scheduled refresh to replace the last-known MSR snapshot.

## Behavior

The Worker uses only `https://api-v2.motorsportreg.com/graphql` and `x-api-key`,
server-side. It searches the current through the entire next calendar year, uses
bounded cursor pagination, and maps structured public event data into the existing
track/organizer merger. Existing track selection still filters the results. The
configured geographic search bounds cover the supported California/Nevada area;
coverage must be checked against approved API results before activation.

It excludes canceled/suspended and non-track-driving events, uses venue time zones,
preserves registration status and opening/closing dates, and does not manufacture
prices or discounts absent from the documented schema. It fails the whole source
refresh on API errors/partial errors or repeated/truncated pagination so prior
dates are not silently replaced with incomplete data.

Without approval/key/attribution confirmation, no MSR API request is made. Previously
saved MSR facts remain labeled stale/pending access. New page fetches, HTML parsing,
and offer-detail requests to MotorsportReg and msreg.com are disabled, including
redirects from supported organizer pages. Other organizer/track sources continue.
