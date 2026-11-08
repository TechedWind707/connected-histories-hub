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
| AI search grounded in records, nothing invented | *Ask a question*. Answers are built only from matching records, numbered sources on every line; says so when nothing matches (try "Tell me about Martin Luther King"). (The optional Claude phrasing was taken off the public page in round 5; the code is still in `ask.js` for a future curator tool) |
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

## 4c. Round 4 changes

| Feedback | What changed |
|---|---|
| Clicking a suggestion did nothing | Cause: pressing the mouse took focus off the search box, which closed the list before the click finished (a normal-speed click lost; only very fast clicks worked). The list now keeps focus while you press, and clicking a row goes straight to that page or record |
| Suggestions in the header search too | One shared suggestion component now powers every search box: home, search page and header |
| Add institutions in Admin; precise pins | *Admin → Institutions*: edit or **add** an institution with address, **latitude/longitude**, a fallback community, website and access notes. With coordinates the pin sits on the building ("Pin = exact location"); without, it falls back to the community point as before. Address links open the map on that exact pin. Coordinates are validated |
| | Note: none of the 11 institutions have exact coordinates yet. Enter them in Admin (they save in the browser) or tell Claude/the team to add them to `src/authority.js` as `lat`/`lng` so everyone gets them |

## 4d. Ezri's update (merged 8 Nov)

- **Record approvals:** CSV imports wait as drafts and are not public until a curator checks rights and approves them.
- **Rights fields** on every record (rights holder, custody, copyright, reproduction permission, restrictions, evidence) and a rights review for existing records.
- **Keyword dictionary** with automatic keyword suggestions, and a **Record Linking** queue.
- **Physical-only and "both" submissions:** no link needed if you say where the item is held. Such records get "Find where this record is held" (opens the map on the building).
- **Blank CSV template** + a 15-record rights test file (in the repo root).
- Two `DEMO ONLY` physical records (titles say so). They are attributed to NSA and HMA, so they are fake items under real names: keep them labelled, or remove before judging if anyone worries about "no invented information".

## 4e. Round 5 changes (8 Nov)

| Feedback | What changed |
|---|---|
| Find the coordinates for the institutions | 9 buildings now use OpenStreetMap coordinates (popup says "Pin = building (OpenStreetMap)"). BCCNS isn't in OpenStreetMap, so its pin is street-level on Cherry Brook Road and says so. Nova Scotia Museum (History Collection) has no confirmed address, so no pin. If an admin types new coordinates, the popup changes to "entered in Admin" |
| Homepage intro, "Every result…" line | Two sentences, two deliberate lines, so the second never wraps awkwardly |
| Remove "Have Claude phrase the answer" | Gone from the public Ask page. Answers are still built only from records, with numbered sources |
| Map text positioning | One short lead line, with the no-pin note under it in small text. Checkbox gets its own row on phones |
| "Search within these" didn't work | Cause: typing a new search on that page threw away the filter (e.g. Africville), so you searched everything. Now the filter is kept: the box says "Search within these records", and if nothing matches you get a link to search all records |
| POC: overall review status | Every record page now shows one status: **Fully reviewed**, **Partly reviewed**, **Catalogue description** (rights not yet reviewed, no reuse permission implied) or **Demo record** |
| POC B5: delete a test submission | *Admin → Suggestions* has a **Delete** button (asks first) |
| Mentor: duplicate detection | New *Admin → Duplicates*: flags records with the same original link, or the same title at the same holder (stronger if the date matches too). Curator picks "Same item" or "Different items"; nothing is merged or hidden. "Same item" adds "Also listed as" on the record pages. A CSV draft that looks like an existing record gets a warning before approval |
| Mentor: dashboard shows pending work and possible errors | Dashboard "Needs attention" now lists automatic checks: duplicates, CSV drafts that look like existing records, records with no link and no address, dates that look wrong, holders with no address |
| Rights audit couldn't be used (title opened the record instead of the form; Save demanded every field) | *Admin → Record approvals → Rights for harvested records* is now grouped by source. Each source has **one form for all its records** (check their terms-of-use page once, fill it in, apply), plus "Check records one by one". Save draft works with empty fields; "Mark rights as checked" still needs every field. Expand arrows on all admin lists. A source-wide review can be cleared in one click |
| Source-wide rights must not cover items a catalogue shows for someone else | The source form only applies to records that source **holds itself** (NSA: 94 of 106). The 12 NSA-exhibit items held elsewhere (Black Cultural Centre, Dartmouth Heritage Museum, UK archives, etc.) are checked one by one, because their rights come from the holder |
| Header search suggestions cut off on the left (mid-size windows) | The list now shifts itself to stay on screen |
| Carousel never paused | Pauses while the mouse is over it, focus is inside it, the tab is hidden, or the user prefers reduced motion |
| "Search within these" too hidden; page vs results confusing | Place/person pages now label the quoted section **Highlights** and have a red **"Search within these N records"** button. That opens results with a bar on top: "Searching within Preston · 9 records", plus "Back to the Preston page" and "Search everything instead". The box hint says "Search within Preston records"; "Try" examples are hidden there |
| Try links went to results, dropdown went to the page | Both stay as they are, but results now start with a card when your words match a page ("Place · 9 records · Preston · Open the Preston page: highlights, map and connections") |
| Clicking a Try example (e.g. Africville) went to results, not the page | Try examples that name a page now open that page, same as picking it from the dropdown. "1946" still goes to results. Typing and pressing Enter still gives results, with the page card on top |
| Year search order was wrong; text matches missing | Searching a year now lists records dated in that year first, then records whose date range runs through it (narrowest ranges first), then records that only mention the year in their text. Pages whose names match (e.g. "Roseland Theatre (8 Nov 1946)") are listed under the results as "Pages that match" — before, they only appeared in the dropdown |
| Ask examples were long sentences squeezed onto one line | On the Ask tab the examples are now a "Try asking" list, one question per line. Search examples stay on one line |
| Type / Held by dropdowns only showed the picked option | Each dropdown now counts results as if its own choice were off, so you can switch directly to another option |
| Backup missed some admin data | Backup / restore / reset now include the keyword dictionary and duplicate decisions too |

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
- Some holders' visitor details unconfirmed (marked). Institution pins are on the building (OpenStreetMap) except BCCNS (street level) and NS Museum (no pin). Place pins are the community point from the gazetteer, not an exact spot.
- Admin changes live in one browser; no login. Use *Admin → Data and backup* to move them.
- Rights fields on harvested records are mostly "Unknown"; the hub shows catalogue descriptions and links, and never implies permission to reuse.

## 7. Future development (from the mentor meeting)

**Scalability.** All data lives in the page and the browser now. Fine for 172 records, not for thousands.
- **PostgreSQL** for records, sources, rights, curator decisions and the audit log (who approved what, when). Full-text search in Postgres to start; a search engine later if needed.
- **Neo4j** for the knowledge graph: people, places, organizations, events and topics as nodes, with each link carrying its source and confidence. Lets us ask "who appears with whom, where" across thousands of records.
- **Sign-in with roles** (curator, institution editor, admin) instead of the open admin demo.
- **Scheduled re-harvest** per source (OAI-PMH, APIs, CSV drops) with a log per run.

**Automation.** Already in the prototype: duplicate detection, automatic keyword suggestions, the dashboard of pending work and likely errors, CSV duplicate warnings. Next:
- Fuzzy duplicate matching (similar titles, same reference number) and name variants ("Eddie Beals" / "Edward 'Ned' Beals").
- Grouping keywords automatically into themes for curators to accept.
- Incremental graph updates: when one record is approved, update only its links instead of rebuilding everything, and rank graph neighbours by how many records they share.
