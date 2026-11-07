# Team notes — Connected Histories

Everything here used to be on the site ("How it works", "The brief", data quality). It's for us, judges' Q&A and the pitch, not for visitors.

## 1. How it answers the brief

| The brief asks for | Where to show it in the demo |
|---|---|
| Ingest or reference metadata from 2–3+ sample sources | 4 real sources, each a different shape: Nova Scotia Archives (exhibit lists), Library and Archives Canada (federal catalogue), Canadian War Museum (museum objects), Halifax Municipal Archives (a source-guide web page). *Admin → Sources* |
| Normalize into a common structure | One crosswalk per source → one common record. The untouched source record is kept beside it. *Admin → Sources* (open a source), or any record → *Provenance* |
| Search by people, places, communities, subjects, dates, institutions, resource type | Search + filters; Browse cards; every person/place/topic has its own page |
| Identify the source institution | Every result says who **holds** it, and the record page says which catalogue we **found** it through when that's different (e.g. a Black Cultural Centre photo found through the NSA exhibit) |
| Explain where and how to access it | Access line on every record + "Visit …" panel with address |
| Link to the authoritative record | "View original record" on every record and result |
| Preserve provenance | Record → *Provenance*: each step the hub took + the original metadata |
| AI search grounded in records, nothing invented | *Ask a question*. Answers are built only from matching records, numbered sources on every line; says so when nothing matches (try "Tell me about Martin Luther King"). Optional Claude mode: Claude sees only the cited records; any sentence without a valid citation is deleted |
| Institution / location views | Institutions page; map of places + holders |
| Relationship mapping | Mini graph beside search results and on every page, showing only direct connections. Gold lines = relationship with a cited source |
| Reference, don't copy | Only metadata + links stored; thumbnails shown from the source servers |
| Sustainable for a small organization | Admin: CSV import, suggestion queue, review queue — a curator approves, nothing is auto-trusted |

## 2. Pipeline (how it works)

```
Source catalogues (4 formats) → harvest snapshot (metadata only) → crosswalk → common model
  → link to gazetteer + authority file → index → search · map · graph · ask
```

- **Common record fields:** id (source key + the source's own id) · title (as written) · description · dateText (as written) · dateStart/dateEnd (parsed years) · dateApprox · resourceType (+ the rule used) · holder · provider · url · reference · creator · collection · access · places · entities (each with how it was found + confidence) · provenance · native (untouched).
  These extend the planning doc's fields (record_id, title, description, institution, source_url, source_id, date, place, latitude/longitude, resource_type, access_status, provenance).
- **Confirmed vs suggested links.** Confirmed = the source names it, classifies it, or a curator approved it. Suggested = keyword match only. **The public site only shows confirmed links.** Suggested ones wait in *Admin → Review queue* (64 at harvest).
- **Map pins** come only from the Canadian Geographical Names Database (NRCan). A record naming no place, or only a county, gets no pin and stays searchable (88 of 170 have a pin).
- **Context sentences** on pages are quoted, never written by us, each linked to its source.
- **Harmful historical language** in titles is kept as the source wrote it (changing it would break provenance). Admin dashboard flags these.

## 3. The data

- 170 records harvested 7 Nov 2026: NSA 106, LAC 40, HMA 20, CWM 4.
- 11 holding institutions appear, because catalogues credit others (Black Cultural Centre, Dartmouth Heritage Museum, Acadia, Dalhousie, NS Museum, The National Archives UK, British Library).
- Flags for curators: "Eddie Beals" vs "Edward 'Ned' Beals" (maybe the same man); Samuel Johnson named in two family records.

## 4. Round 2 changes (team feedback, 7 Nov) — and why

| Feedback | What changed |
|---|---|
| Admin should still be there | New **Admin** area: dashboard, review queue, suggestions (from a new public *Suggest a resource* form), institutions editor, CSV import, sources, backup/restore/reset. Saved in the browser; no sign-in in the prototype |
| Use the brand design guide | Fonts: Anton (display), Playfair Display (headings), Google Sans Flex (UI), Dancing Script (one tagline). All colour, spacing and radius tokens copied from the guide. Borders, not shadows. One red primary button per view |
| Clean like Umbra / Europeana / DPLA; too compact | One job per screen, much more white space, plain result rows (title, one meta line, one link), filters as four dropdowns |
| Knowledge graph too much for ordinary users | Removed the Connections page and nav item. A small graph sits **beside search results** and on each page, showing only what's directly connected, laid out in a circle so it doesn't jiggle |
| Full map not in the nav | Map removed from nav; linked from Home ("Open the full map"), from the search sidebar and footer |
| Change the font | See brand fonts above |
| Scrap "Browse what's connected" or make it a few cards | Six Browse cards (People, Places, Organizations, Events, Topics, Institutions) → each opens a simple list |
| Remove "Across time" and the search bar chart | Both gone |
| No coloured strips on tabs/cards (AI tell) | Removed every side/top colour strip. Tabs use a plain underline |
| Featured card cut off text and image; changed when DevTools opened | Root cause: the card had a **fixed height** and switched layout on the **window** width. Opening DevTools narrows the window, crossing the 900px breakpoint. Now all slides share one grid cell (the card grows to fit the tallest), the layout follows the **card's own width** (container query) and images use `contain`, so nothing is cropped. Slides without an image show three records from that topic instead of empty space |
| Remove meta/educational content from the site | "How it works", "The brief", data quality and grounding explanations moved here. The site keeps only one short line under answers |
| Nav brand disappeared on hover; space things out | Brand stays visible (turns gold on hover). Brand left, links pushed right, gold underline slides in on hover |

**Impeccable check** (`npx impeccable detect`, rendered pages): clean except `cream-palette`, which flags the brand's own paper background `#faf6ee`. That's a team brand decision; kept on purpose. Fixed along the way: nested cards, long lines, skipped heading levels, orphan words.

## 4b. Round 3 changes (7 Nov, evening)

| Feedback | What changed |
|---|---|
| Guysborough card showed Eliza Brody (Sunnyville) under a Guysborough caption | Real mismatch: the photo's record is linked to Sunnyville / Guysborough County, not Guysborough. The Guysborough card now uses the 1895 "men in front of a barn" photo, and Preston uses "Group with ox cart, Preston" (the old one was North Preston). The carousel now refuses any image whose record isn't linked to that card, and the card text describes the pictured record |
| Graph: clicking the centre filled it with connection labels | Labels now only appear for an outer node. Clicking an outer node shows how it connects (and its source) under the graph, with an "Open" link; double-click opens its page. Clicking the centre clears it |
| Addresses should lead to the map | Every institution address with a pin (record, page, "Where to find it", Institutions list) links to the full map, zoomed in with that institution's popup open. Place pages have "See … on the map" |
| Suggestions under the search box | Typing 2+ letters shows matching pages and records right under the box, with the match in bold. Arrow keys + Enter work; "See all results" at the bottom. Matches by word start, so "pre" finds Preston, not "Supreme Court" |
| Tagline capitalised | Kept David's "Our Stories, Connected" in the source too |

## 5. Round 1 changes (prototype → full build)

| Prototype (v5.x) | Full build | Why |
|---|---|---|
| Fictional records, NSCC campuses as pins | Real records from 4 institutions; pins only from the gazetteer | Brief requires authoritative links and no invented info |
| Map of institutions only | Places named in records + where they're held, joined by lines | People search by place; place → holder is the "direct users to where it's held" story |
| Records typed through admin forms | Crosswalk per source, native record kept, provenance on each | "Ingest… normalize… preserve provenance" |
| Dictionary terms + approve/reject | Every link has how + confidence; suggestions wait for a curator | Same trust idea, applied everywhere |
| Long editorial demo articles | Pages built from records + quoted sources | The hub shouldn't write history |

## 6. Known limits (say these before judges ask)

- One-day snapshot of selected result pages, not a live sync. Production: scheduled re-harvest (OAI-PMH, APIs, CSV drops), logged per run.
- Names matched as spelled; possible duplicates flagged, never auto-merged.
- Some holders' visitor details unconfirmed (marked). Institution pins sit on the community point, not the building.
- Admin changes live in one browser; no login. Use *Admin → Data and backup* to move them.
