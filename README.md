# Connected Histories — Black History Knowledge Hub

RBC HubHacks 2026 · Problem Statement 1 · Black Cultural Centre for Nova Scotia · Team Ctrl_Alt

**Open `index.html`.** The whole site is one file: email it, put it on a USB stick, double-click it.
Only map backgrounds, preview images (shown from the institutions' own servers) and the brand web fonts need the internet.

Live: https://techedwind707.github.io/connected-histories-hub/

**For the team:** how it works, how it answers the brief, the pitch talking points and every design decision are in [`TEAM-NOTES.md`](TEAM-NOTES.md). They were taken off the site on purpose, so the site speaks only to visitors.

## What's on the site

- **Home** — one search box (Search or Ask a question), a rotating Featured card, six Browse cards, and a link to the full map.
- **Search** — results with simple filters (held by, type, place, years). Beside the results: a mini graph of what is **directly** connected to what you searched, and a small map.
- **Pages for people, places, organizations, events, topics and institutions** — quoted context with sources, the records, direct connections, where to find them, and a map of connected places at the end.
- **Record pages** — who holds it, how to access it, one button to the original, provenance.
- **Map** — linked from Home and Search (not in the nav).
- **Suggest a resource** — public form; suggestions wait for a curator.
- **Admin** (no sign-in in this prototype; saved in the browser) — dashboard, review queue for keyword links, suggestions, institution visitor details, CSV import, sources, backup and restore.

## How it's built

```
src/feeds.js       raw harvest snapshots, in each source's own field names
src/authority.js   institutions, gazetteer (CGNDB ids), people/orgs/events/topics, quoted statements, relations
src/normalize.js   the crosswalk: per-source mapping → common model → dates → people/places linking
src/graph.js       small graph drawing on <canvas> (no library)
src/core.js        saved state, data index, search, router
src/map.js         Leaflet map (OpenStreetMap tiles, CARTO fallback)
src/widgets.js     featured carousel, mini graph
src/ask.js         grounded question answering (+ optional Claude)
src/views.js       public screens
src/admin.js       admin screens
src/style.css      styles, from the Connected Histories design system
build.py           bundles everything (+ Leaflet) into index.html
```

Edit files in `src/`, then run `python build.py`.

## Left for David on purpose

`carouselShouldPause()` in `src/widgets.js`. The carousel never pauses. Make it return `true` when the mouse is over it, focus is inside it, the tab is hidden, or the user prefers reduced motion. Hints are in the comment.

Sources harvested: archives.novascotia.ca/africanns · archives.novascotia.ca/desmond · recherche-collection-search.bac-lac.gc.ca · warmuseum.ca/collections · halifax.ca/about-halifax/municipal-archives/source-guides/africville-sources · geogratis.gc.ca (CGNDB).
Leaflet 1.9.4 © Volodymyr Agafonkin, BSD-2 (see `vendor/LEAFLET-LICENSE`).

## November 2026 prototype update — physical holdings, rights, and import approval

- CSV imports are queued in **Admin → Record approvals**. New records do not appear in public search until approved. Older browser-stored CSV records without verified rights are moved into the pending queue when this version loads.
- Public **Suggest a resource** supports digital, physical, and both. Physical-only submissions do not require URLs, but do require a holding location. Submissions remain pending until curator approval.
- Records show rights holder, ownership/custody, copyright, reproduction permission, restrictions, evidence source, and whether those details were curator-verified. Existing harvested records without verified metadata remain discoverable but explicitly flagged for review; their rights are not fabricated.
- Two synthetic physical-only records, `demo-physical-001` and `demo-physical-002`, test the public record-to-location map flow. Their fictional holding institution has approximate Halifax coordinates solely for testing; it is **not a real visitor address**.
- The importer now accepts digital/physical/both records and has a **Download CSV template** button. A blank template and 15-record synthetic CSV are included with this project. Imported records require rights and location evidence to be reviewed before publication.
- All demo rights statements are invented and are **not evidence of permission for real materials**.
- This remains a browser-local prototype with no login or server-side audit. Rights verification is a curator workflow simulation, not legal clearance.

### Record Linking and physical-location map update
- Admin **Review queue** is now **Record Linking**. Approve, Reject, and Undo update each row and its waiting count without re-rendering the page, closing groups, or changing scroll position.
- Physical-only record maps display only the exact institution holding-location marker (no separate city/place marker). Hovering shows the institution name, address, and access details. The **Find where this record is held** button opens the holding-only map view.
- If no exact coordinates are verified, no approximate pin is presented as an exact location; the map displays a notice instead.
