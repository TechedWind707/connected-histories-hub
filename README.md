# Connected Histories — Black History Knowledge Hub (full proof of concept)

RBC HubHacks 2026 · Problem Statement 1 · Black Cultural Centre for Nova Scotia · Team Ctrl_Alt

**Open `index.html`.** That's the whole app in one file — email it, put it on a USB stick, double-click it.
It works offline except for three things that load from the internet: map tiles, preview thumbnails (shown from the institutions' own servers) and the web fonts.

---

## What it proves (the brief, line by line)

| The brief asks for | Where to see it |
|---|---|
| Ingest or reference metadata from 2–3+ sample sources | **4 real sources**, each in a different shape: Nova Scotia Archives (exhibit lists), Library and Archives Canada (federal catalogue), Canadian War Museum (museum objects), Halifax Municipal Archives (a source-guide web page). *How it works → Pipeline* |
| Normalize into a common structure | One "crosswalk" per source → one common record model. The untouched source record is kept beside it. *How it works → Common model* |
| Search by people, places, communities, subjects, dates, institutions, resource type | Search + filters for each, plus a decade timeline you can drag across |
| Identify the source institution | Every result shows who **holds** the original — and, if different, which catalogue we **found** it in (e.g. a Black Cultural Centre photo found through the Nova Scotia Archives exhibit) |
| Explain where and how to access it | Access status, instructions and visitor address on every record and page |
| Link to the authoritative record | Every record has a button straight to the institution's own page |
| Preserve provenance | Step-by-step log of what the hub did to each record + the original metadata |
| AI search grounded in records, nothing invented | **Ask a question**: the answer is built only from matching records, with a numbered citation on every line. If nothing matches, it says so. Optional Claude mode: Claude only sees the cited records, and any sentence without a valid citation is deleted before you see it |
| Institution / location views | Institutions page + Map |
| Relationship mapping | **Connections** — the knowledge graph |
| Reference, don't copy | Only metadata + links are stored. Thumbnails are displayed from the source, never copied |

## The data (all real)

- **170 records**, harvested 7 Nov 2026 from public search/exhibit pages:
  Nova Scotia Archives (106), Library and Archives Canada (40), Halifax Municipal Archives (20), Canadian War Museum (4).
- **11 holding institutions** appear, because some catalogues credit others (Black Cultural Centre, Dartmouth Heritage Museum, Acadia, Dalhousie, NS Museum, The National Archives UK, British Library).
- **Map pins come only from the Canadian Geographical Names Database (NRCan).** A record that names no place, or only a county, gets no pin — it stays searchable. 88 of 170 have a pin.
- **Context sentences are quoted**, never written by us, and each links to its source (halifax.ca, Province of NS, Canadian Museum for Human Rights, Canadian War Museum, Black Loyalist Heritage Centre, NSA).
- Historical titles that use language that is offensive today are kept exactly as the source wrote them (changing them would break provenance) and are flagged on the Data quality page.

## What changed from the prototype — and why

| Prototype (v5.x) | Full build | Why |
|---|---|---|
| Fictional records and NSCC campuses as stand-in pins | Real records from 4 institutions; pins only from the national gazetteer | The brief requires links to the authoritative record and "no invented information". Judges will click the links. |
| Map showed where to visit institutions | Map shows **places named in the records** (circles) + **where they're held** (squares), joined by dashed lines | People search by place ("Preston", "Africville"); the line from place → holder *is* the "direct users to where it's held" story. |
| Records typed in through admin forms | One crosswalk per source, native record kept, provenance log on every record | "Ingest… normalize… preserve provenance." Shows how it scales without retyping. |
| Dictionary terms + Approve/Reject in Reader & link review | Kept and widened: every link says **how** it was found and is **confirmed** (source says so) or **suggested** (keyword only). Suggestions wait in *Curator review* | Same trust idea, applied everywhere. A keyword is not proof. |
| Long editorial demo articles | Each person/place/topic page is built from its records + quoted source sentences | The hub shouldn't write history; it points to who holds it. |
| Public/Admin toggle, submissions form, backup tab, institution editor | Replaced by *How it works* (pipeline, model, data quality, curator review, CSV import) | No login/back-end in a hackathon build anyway. The demo time is better spent on what the brief scores. Submissions can come back later. |
| — | **Ask a question** (grounded), **knowledge graph**, decade timeline, **featured carousel**, **The brief** page | From the team suggestions + the brief's "grounded natural-language search" and "relationship mapping". |
| Separate colours | Brand palette: gold `#a87f19`, red `#951814`, green `#166411` | Chosen team colours. |
| One HTML file | Still one file (Leaflet is bundled inside) | Portability. |

### Team suggestions — how each landed

- **Map at the end of an article, showing related locations** → every person/place/topic page ends with "Places connected to …".
- **Card that keeps alternating between highlighted articles, with imagery** → Featured carousel on the home page (rotates every 6 s; uses source thumbnails where they exist, a typographic card where they don't).
- **Map showing locations associated with the searched topic** → search results have a **Map** view; the Map page filters by topic and years.
- **Knowledge graph like Obsidian (people, places, meetings, activities; hover highlights everything related; searchable)** → *Connections* page + a mini graph on every page. Hover = neighbours light up, search box highlights matches *and* their neighbours, click = details, double-click = open page. Events & meetings are their own type.
- **Map vs graph as "the main thing" (contradiction)** → neither: home is **search-first**, and every result set can switch between **List / Map / Graph**. The team doc's map stays central; the graph is pitched alongside it, not instead of it.

## How it's built

```
src/feeds.js       raw harvest snapshots, in each source's own field names
src/authority.js   institutions, gazetteer (CGNDB ids), people/orgs/events/topics, quoted statements, curated relations
src/normalize.js   the crosswalk: per-source mapping → common model → date parsing → entity/place linking
src/graph.js       small force-directed graph on <canvas> (no library)
src/app.js         screens: home, search, ask, entity page, record, graph, map, institutions, how it works, brief
src/style.css      styles
build.py           bundles everything (+ Leaflet) into index.html
```

Edit files in `src/`, then run `python build.py`.

**Add a source without code:** *How it works → Add a source (CSV)*. Paste a spreadsheet; the hub guesses which column is which, shows you, and adds the rows (this browser session only). Rows with no link to an authoritative record are refused.

## Left for David on purpose

`carouselShouldPause()` in `src/app.js` — the carousel never pauses. Make it return `true` when the mouse is over it, focus is inside it, the tab is hidden, or the user prefers reduced motion. Hints are in the comment.

## Known limits

- One-day snapshot of selected result pages, not a live sync. Production would re-harvest on a schedule (OAI-PMH, APIs, CSV drops) and log each run.
- Names are matched as spelled; topics stay "suggested" until a curator confirms. Possible duplicates (e.g. "Eddie Beals" vs "Edward 'Ned' Beals") are flagged, never auto-merged.
- Some holders' visitor details aren't confirmed and are marked so. Institution pins sit on the community point, not the building.
- Curator decisions and CSV imports live in the browser only; no login.

Sources harvested: archives.novascotia.ca/africanns · archives.novascotia.ca/desmond · recherche-collection-search.bac-lac.gc.ca · warmuseum.ca/collections · halifax.ca/about-halifax/municipal-archives/source-guides/africville-sources · geogratis.gc.ca (CGNDB).
Leaflet 1.9.4 © Volodymyr Agafonkin, BSD-2 (see `vendor/LEAFLET-LICENSE`).
