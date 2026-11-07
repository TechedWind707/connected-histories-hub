/* =====================================================================
   normalize.js — THE CROSSWALK (ingest → common model → links)
   ---------------------------------------------------------------------
   Step 1  crosswalk.<source>(native) → common record
   Step 2  parseDate()                → sortable years + "approximate" flag
   Step 3  linkEntities()             → people / places / topics found in
                                        the record, each tagged with HOW it
                                        was found and whether it is
                                        'confirmed' or only 'suggested'
   Every step appends to record.provenance so a user can see exactly
   what the hub did to the source's metadata.
   ===================================================================== */

const SOURCES = {
  nsa: { inst: 'nsa', label: 'Nova Scotia Archives', shape: 'Virtual exhibit item lists (HTML)', feed: () => FEEDS.nsa },
  lac: { inst: 'lac', label: 'Library and Archives Canada', shape: 'Collection Search results (federal catalogue)', feed: () => FEEDS.lac },
  cwm: { inst: 'cwm', label: 'Canadian War Museum', shape: 'Museum object records', feed: () => FEEDS.cwm },
  hma: { inst: 'hma', label: 'Halifax Municipal Archives', shape: 'Published source guide (finding aid web page)', feed: () => FEEDS.hma }
};

/* The common metadata model — shown on the "How it works" page too. */
const COMMON_FIELDS = [
  ['id', 'Hub identifier = source key + source\'s own id (never reassigned)'],
  ['title', 'Title exactly as the source wrote it'],
  ['description', 'Source-supplied description / scope (may be empty)'],
  ['dateText', 'Date exactly as written by the source'],
  ['dateStart / dateEnd', 'Years parsed from dateText for sorting & filtering'],
  ['dateApprox', 'true when the source marks the date as uncertain (ca., ?, [ ], or…)'],
  ['resourceType', 'Hub vocabulary (Photograph, Textual record, Court record…) + the rule used'],
  ['holder', 'Institution that holds the original'],
  ['provider', 'Institution whose catalogue/exhibit we indexed (may differ from holder)'],
  ['url', 'Link to the authoritative record at the source'],
  ['reference', 'Source reference / call number / accession number'],
  ['creator', 'Photographer / author / maker as given'],
  ['collection', 'Exhibit theme, fonds or series as given'],
  ['access', 'Online / on site / by appointment + how to request'],
  ['places', 'Gazetteer places (with CGNDB id when mapped)'],
  ['entities', 'People, organizations, events, topics — each with how & confidence'],
  ['provenance', 'Every transformation step the hub applied'],
  ['native', 'The untouched harvested metadata']
];

/* ---------- Step 2: dates ---------- */
function parseDate(text) {
  const t = String(text || '').trim();
  if (!t || /^n\.?\s*d\.?$/i.test(t)) return { start: null, end: null, approx: false, note: 'No date given by the source' };
  const approx = /ca\.|c\.a\.|\?|\[|\bor\b|late|early|after|about/i.test(t);
  const years = [];
  // decades like 1840s / 1930s
  for (const m of t.matchAll(/\b(1[6-9]\d0|20[0-2]0)s\b/g)) { years.push(+m[1], +m[1] + 9); }
  // explicit four-digit years
  for (const m of t.matchAll(/\b(1[6-9]\d\d|20[0-2]\d)\b/g)) years.push(+m[1]);
  if (!years.length) return { start: null, end: null, approx: false, note: 'Date text could not be read as a year' };
  let start = Math.min(...years), end = Math.max(...years);
  if (/early\s+\d{4}s/i.test(t)) end = start + 4;               // "early 1930s" → 1930-1934
  return { start, end, approx, note: approx ? 'Approximate / uncertain date as marked by the source' : 'Date read directly from source' };
}

/* ---------- Step 1: crosswalks (one per source) ---------- */
const HOLDER_RULES = [   // NSA "Credit" text → holding institution
  [/National Archives, Kew/i, 'tna'], [/British Library/i, 'bl'], [/Dartmouth Heritage Museum/i, 'dhm'],
  [/Black Cultural Centre/i, 'bccns'], [/Acadia University/i, 'acadia'], [/Dalhousie University/i, 'dal'],
  [/Nova Scotia Museum/i, 'nsm']
];
const TYPE_RULES = [    // keyword → hub resource type (used when a source gives no type)
  [/advertisement|Gazette|clipping|Ship news/i, 'Newspaper item'],
  [/^Letter|Letter,|letter /i, 'Correspondence'],
  [/^(A )?list|^Return|census|^Names of|general return/i, 'List / register'],
  [/Deed|Bill of sale|^Sale |Indenture|lease|Certificate|Passport|Petition|Contract|proclamation|judgement|Address of the House|manumission|Report/i, 'Legal / government document'],
  [/Plot plan|map|A view of/i, 'Map / plan / view'],
  [/^Sign /i, 'Object'],
  [/Book of Negroes/i, 'Register (copy)']
];
function inferType(title, hasPhotographer) {
  for (const [re, type] of TYPE_RULES) if (re.test(title)) return [type, `keyword rule ${re}`];
  if (hasPhotographer) return ['Photograph', 'source lists a photographer'];
  return ['Document', 'default — no rule matched'];
}

const crosswalk = {
  nsa(n) {
    const theme = FEEDS.nsa.themes[n.Theme];
    const credit = n.Credit || '';
    let holder = 'nsa';
    for (const [re, key] of HOLDER_RULES) if (re.test(credit + ' ' + n.Reference)) { holder = key; break; }
    const isDesmond = n.Exhibit === 'desmond';
    const [type, rule] = isDesmond ? ['Court record', 'exhibit = Viola Desmond court file'] : inferType(n.Title, !!(n.Photographer && !/unknown/i.test(n.Photographer)) || /Photo/i.test(n.Reference));
    // Theme 5 thumbnails follow NSA's numbering (ID + 200402111). Shown from NSA, never copied.
    const image = n.Exhibit === 'africanns' && n.Theme === 5 ? `https://archives.novascotia.ca/images/africanns/${200402111 + n.ID}.jpg` : '';
    return {
      id: `nsa-${n.Exhibit}-${n.ID}`, source: 'nsa', sourceRecordId: `${n.Exhibit}?ID=${n.ID}`,
      title: n.Title, description: '', dateText: n.Date,
      resourceType: type, resourceTypeRule: rule,
      holder, provider: 'nsa',
      url: `https://archives.novascotia.ca/${n.Exhibit}/archives/?ID=${n.ID}`,
      reference: n.Reference || credit, creator: /unknown/i.test(n.Photographer) ? '' : n.Photographer,
      collection: `NSA exhibit — ${theme}`, themeKey: `nsa:${n.Theme}`,
      access: holder === 'nsa'
        ? { status: 'Online', note: 'Digitized in the Nova Scotia Archives exhibit. Original at Nova Scotia Archives reading room.' }
        : { status: 'Online (copy)', note: `Exhibit shows a copy. Original held by ${INSTITUTIONS[holder].name} — contact them to see it.` },
      image, imageCredit: image ? `Nova Scotia Archives — ${n.Reference}` : '',
      provenance: [
        `Harvested ${FEEDS.nsa.harvested} from NSA exhibit list "${theme}".`,
        `URL built from exhibit + ID (${n.Exhibit}, ${n.ID}).`,
        holder !== 'nsa' ? `Holder set to ${INSTITUTIONS[holder].name} from the "Credit" field ("${credit || n.Reference}").` : 'Holder = Nova Scotia Archives (no other institution credited).',
        `Resource type "${type}" — ${rule}.`
      ]
    };
  },
  lac(n) {
    const typeMap = { 'Photographs': 'Photograph', 'Textual material': 'Textual record', 'Stamps and stamp products': 'Stamp / philatelic record', 'Moving images': 'Moving image', 'Book': 'Book' };
    const type = typeMap[n.TypeOfMaterial] || n.TypeOfMaterial || 'Record';
    const url = n.app === 'oclc'
      ? `https://central.bac-lac.gc.ca/.redirect?app=oclc&id=${n.IdNumber}&lang=eng`
      : `https://recherche-collection-search.bac-lac.gc.ca/eng/Home/Record?app=${n.app}&IdNumber=${n.IdNumber}`;
    return {
      id: `lac-${n.app}-${n.IdNumber}`, source: 'lac', sourceRecordId: `${n.app}/${n.IdNumber}`,
      title: n.Title, description: n.Unit ? `Unit: ${n.Unit}` : '', dateText: n.Date,
      resourceType: type, resourceTypeRule: `LAC "Type of material" = ${n.TypeOfMaterial || '—'}`,
      holder: 'lac', provider: 'lac', url,
      reference: n.Reference, creator: '', collection: `${n.FoundIn}${n.HierarchicalLevel ? ' · level: ' + n.HierarchicalLevel : ''}`, themeKey: 'lac:*',
      unit: n.Unit,
      access: n.app === 'pffww'
        ? { status: 'Online', note: 'Personnel file digitized (LAC lists digital objects).' }
        : { status: 'Catalogue online', note: 'Description online. Digitization not stated in harvested metadata — check the LAC record, or consult on site / order copies.' },
      image: '', provenance: [
        `Harvested ${FEEDS.lac.harvested} from LAC Collection Search.`,
        `URL built from app + IdNumber (${n.app}, ${n.IdNumber}).`,
        `Resource type mapped from LAC "Type of material".`
      ]
    };
  },
  cwm(n) {
    return {
      id: `cwm-${n.irn}`, source: 'cwm', sourceRecordId: n.artifactNumber,
      title: `${n.objectName} — ${n.militaryUnit}`, description: n.description, dateText: n.date,
      resourceType: 'Museum object', resourceTypeRule: 'CWM artifact record',
      holder: 'cwm', provider: 'cwm', url: `https://www.warmuseum.ca/collections/artifact/${n.irn}`,
      reference: `Artifact ${n.artifactNumber} · ${n.materials}`, creator: '', collection: `Military unit: ${n.militaryUnit}`, themeKey: 'cwm:*',
      people: n.people, placesText: n.places,
      access: { status: 'Catalogue + image online', note: 'Object held by the Canadian War Museum, Ottawa. Contact the museum for research access.' },
      image: n.thumbnail, imageCredit: `Canadian War Museum ${n.artifactNumber}`,
      provenance: [`Harvested ${FEEDS.cwm.harvested} from CWM collection (facet: military unit).`, 'Title = object name + unit (CWM object names are generic, e.g. "Cap Badge").']
    };
  },
  hma(n) {
    const url = n.anchor === 'Flickr'
      ? 'https://www.flickr.com/photos/halifaxarchives/albums/72157681944143775'
      : `https://www.halifax.ca/about-halifax/municipal-archives/source-guides/africville-sources/#${n.anchor}`;
    return {
      id: `hma-${n.anchor}`, source: 'hma', sourceRecordId: n.refCode || n.anchor,
      title: n.heading, description: n.scope, dateText: n.span,
      resourceType: n.anchor === 'Flickr' ? 'Photograph collection' : 'Record series (municipal)', resourceTypeRule: 'Source-guide entry describes a series',
      holder: 'hma', provider: 'hma', url,
      reference: n.refCode, creator: 'City of Halifax / HRM (records creator)', collection: 'HMA — Africville source guide', themeKey: 'hma:*',
      access: n.anchor === 'Flickr'
        ? { status: 'Online', note: 'Digitized photographs on the Archives\' Flickr album.' }
        : { status: 'Online + by appointment', note: 'Source guide links digitized copies where available; originals by appointment at 81 Ilsley Ave, Dartmouth.' },
      image: '', provenance: [`Harvested ${FEEDS.hma.harvested} from the HMA Africville source guide (one entry per series).`, `Reference code kept as given: ${n.refCode || '—'}.`]
    };
  }
};

/* ---------- Step 3: entity & place linking ---------- */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function aliasRegex(alias, caseSensitive) {
  const b1 = /^\w/.test(alias) ? '\\b' : '', b2 = /\w$/.test(alias) ? '\\b' : '';
  return new RegExp(b1 + esc(alias) + b2, caseSensitive ? 'g' : 'gi');
}

// Build the matcher once: one entry per alias, longest first.
let MATCHERS = null;
function buildMatchers() {
  const list = [];
  for (const [id, p] of Object.entries(PLACES)) for (const a of p.aliases || []) list.push({ id, kind: 'place', alias: a, re: aliasRegex(a, false) });
  for (const [id, e] of Object.entries(ENTITIES)) for (const a of e.aliases || [])
    list.push({ id, kind: e.type, alias: a, re: aliasRegex(a, e.type === 'topic') });
  list.sort((a, b) => b.alias.length - a.alias.length);
  MATCHERS = list;
}

function linkEntities(r) {
  if (!MATCHERS) buildMatchers();
  const found = new Map();   // id → {id, kind, how, status, evidence}
  const add = (id, kind, how, status, evidence) => {
    const prev = found.get(id);
    if (!prev || (prev.status === 'suggested' && status === 'confirmed')) found.set(id, { id, kind, how, status, evidence });
  };
  // (a) the source's own classification (theme / collection / unit) → confirmed
  for (const key of [r.themeKey, r.source + ':*']) for (const id of THEME_MAP[key] || [])
    add(id, ENTITIES[id]?.type || 'place', 'source classification', 'confirmed', r.collection);
  if (r.unit && /Construction Battalion/i.test(r.unit)) add('no2cb', 'organization', 'source field "Unit"', 'confirmed', r.unit);
  // (b) structured fields from the source → confirmed
  const structured = [r.people, r.placesText].filter(Boolean).join(' | ');
  // (c) title + description text → names are confirmed when the source spells the name;
  //     topics are only "suggested" (a keyword is not proof of subject)
  const text = [r.title, r.description].join(' ‖ ');
  const taken = [];                                       // spans already claimed by a longer name
  const overlaps = (s, e) => taken.some(([a, b]) => s < b && e > a);
  for (const m of MATCHERS) {
    for (const hay of [[text, 'title/description'], [structured, 'structured field']]) {
      if (!hay[0]) continue;
      m.re.lastIndex = 0;
      let hit;
      while ((hit = m.re.exec(hay[0]))) {
        const s = hit.index, e = s + hit[0].length;
        if (m.kind !== 'topic') {
          if (hay[1] === 'title/description') { if (overlaps(s, e)) continue; taken.push([s, e]); }
          add(m.id, m.kind, `name "${hit[0]}" in ${hay[1]}`, 'confirmed', hit[0]);
        } else {
          if (hay[1] === 'title/description' && overlaps(s, e)) continue;
          add(m.id, 'topic', `keyword "${hit[0]}" in ${hay[1]}`, 'suggested', hit[0]);
        }
      }
    }
  }
  // (d) creator field → creator entity
  for (const [id, e] of Object.entries(ENTITIES)) for (const c of e.creator || [])
    if (r.creator && r.creator.includes(c)) add(id, e.type, 'source field "Photographer/creator"', 'confirmed', r.creator);
  // (e) entities that imply topics (e.g. a church → Church and faith)
  for (const f of [...found.values()]) for (const t of ENTITIES[f.id]?.topics || []) add(t, 'topic', `implied by ${ENTITIES[f.id].name}`, 'confirmed', ENTITIES[f.id].name);
  // (f) curated event evidence lists this record
  for (const [id, e] of Object.entries(ENTITIES)) if ((e.evidence || []).includes(r.id)) add(id, 'event', 'curated evidence for event', 'confirmed', e.name);
  // (g) a place that is "contained" by a more specific one is dropped (North Preston beats Preston only by span rule above)
  return [...found.values()];
}

/* ---------- Run the whole pipeline ---------- */
function runPipeline(extraRecords = []) {
  const out = [];
  const stats = {};
  for (const [key, src] of Object.entries(SOURCES)) {
    const feed = src.feed();
    stats[key] = { harvested: feed.records.length, normalized: 0 };
    for (const native of feed.records) {
      const r = crosswalk[key](native);
      r.native = native;
      out.push(r); stats[key].normalized++;
    }
  }
  for (const r of extraRecords) out.push(r);
  for (const r of out) {
    const d = parseDate(r.dateText);
    Object.assign(r, { dateStart: d.start, dateEnd: d.end, dateApprox: d.approx });
    r.provenance.push(`Date: ${d.note}${d.start ? ` → ${d.start}${d.end !== d.start ? '–' + d.end : ''}` : ''}.`);
    r.links = linkEntities(r);
    const places = r.links.filter(l => l.kind === 'place' || PLACES[l.id]);
    r.places = places.map(l => l.id);
    r.mapped = r.places.filter(p => PLACES[p]?.lat != null);
    r.provenance.push(`Linked ${r.links.length} people/places/topics (${r.links.filter(l => l.status === 'suggested').length} suggested, awaiting curator review).`);
  }
  return { records: out, stats };
}
