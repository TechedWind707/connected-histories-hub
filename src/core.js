/* =====================================================================
   core.js — data index, saved state, search and the router
   ---------------------------------------------------------------------
   Sections:
     1. Saved state  — curator decisions, imports, submissions, institution
                       edits. All kept in this browser (localStorage).
     2. Index        — run the pipeline, build look-up tables
     3. Search       — scoring, filters, entity suggestions
     4. Router       — #/path?params  →  view function
   Public screens only ever use CONFIRMED links (publicLinks). Keyword
   "suggested" links stay hidden until a curator confirms them in Admin.
   ===================================================================== */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: keep in memory only */ } }
};

/* ═══ 1. SAVED STATE ═══════════════════════════════════════════════ */
let CUR = store.get('ch-curator-v1', {});          // { 'recordId|entityId': 'confirmed' | 'rejected' }
let IMPORTED = store.get('ch-imported-v1', []);
let PENDING_IMPORTS = store.get('ch-pending-imports-v1', []);
let RIGHTS_EDITS = store.get('ch-rights-edits-v1', {});
for (const r of IMPORTED.filter(x => !x.rightsVerified)) if (!PENDING_IMPORTS.some(x => x.id === r.id)) PENDING_IMPORTS.push({ ...r, reviewStatus: 'pending' });
IMPORTED = IMPORTED.filter(x => x.rightsVerified);    // records added through the CSV importer
let SUBS = store.get('ch-submissions-v1', []);     // public "Suggest a resource" submissions
let INST_EDITS = store.get('ch-inst-edits-v1', {}); // admin edits to institution access details (+ new institutions)
let ACTIVITY = store.get('ch-activity-v1', []);
let DUPS = store.get('ch-duplicates-v1', {});      // curator decisions on possible duplicates: { groupKey: 'same' | 'different' }
let KEYWORDS = store.get('ch-keywords-v1', []);
let KEYWORD_SUGGESTIONS = store.get('ch-keyword-suggestions-v1', []);
let KEYWORD_DISMISSED = store.get('ch-keyword-dismissed-v1', []);
let KEYWORD_DISABLED = store.get('ch-keyword-disabled-v1', []);
KEYWORDS.forEach(k => { if (k.strength === 'medium') k.strength = 'weak'; });
KEYWORD_SUGGESTIONS.forEach(k => { if (k.strength === 'medium') k.strength = 'weak'; });
const keywordKey = (term, subject) => norm(term).trim() + '|' + subject;
const keywordDisabled = (term, subject) => KEYWORD_DISABLED.includes(keywordKey(term, subject));
function dictionaryEntries() {
  const base = Object.entries(ENTITIES).filter(([, e]) => e.type === 'topic').flatMap(([subject,e]) => (e.aliases || []).map(term => ({term, subject, strength: /^(family|children|his wife|her husband|generation|community)$/i.test(term) ? 'weak' : 'strong', enabled: !keywordDisabled(term,subject), builtIn: true})));
  return [...base.filter(k => !KEYWORDS.some(x => x.override && keywordKey(x.term,x.subject) === keywordKey(k.term,k.subject))), ...KEYWORDS.map(k => ({...k, enabled: k.enabled !== false && !keywordDisabled(k.term,k.subject), builtIn: false}))];
}
function discoverKeywords(r) {
  const title = String(r.title || '').replace(/^DEMO(?: ONLY)?\s*[—:-]\s*/i,'');
  const candidates = [];
  const seen = new Set();
  const add = (term, category, strength) => {
    term = term.trim().replace(/[.,;:]+$/,'');
    if (term.length < 5 || term.length > 85 || seen.has(norm(term))) return;
    if (dictionaryEntries().some(k => norm(k.term) === norm(term))) return;
    if (KEYWORD_DISMISSED.includes(norm(term)) || KEYWORD_SUGGESTIONS.some(k => norm(k.term) === norm(term))) return;
    seen.add(norm(term)); candidates.push({id:'kw-'+Date.now()+'-'+candidates.length,term,category,strength,sourceId:r.id,sourceTitle:r.title});
  };
  for (const match of title.matchAll(/\b(?:[A-Z][a-z]+|[A-Z]\.)+(?:\s+(?:of|de|the|[A-Z][a-z]+|[A-Z]\.)){1,3}/g)) {
    const term = match[0].trim();
    if (/^(Community|Family|Historical|Photograph|Letter|Record|Records|Handwritten|Collection|Album|Certificate|Report|The|Nova Scotia|Halifax Municipal|Library and)/i.test(term)) continue;
    add(term,'Possible name / place','strong');
  }
  return candidates.slice(0, 8);
}
function discoverApprovedRecords() {
  const approved = [...IMPORTED, ...SUBS.filter(s => s.status === 'approved').map(submissionToRecord)];
  for (const r of approved) {
    for (const suggestion of discoverKeywords(r)) KEYWORD_SUGGESTIONS.push(suggestion);
  }
}
    // short admin activity log
const ORIGINAL_INST = JSON.parse(JSON.stringify(INSTITUTIONS));
function applyInstEdits() { for (const [k, v] of Object.entries(INST_EDITS)) INSTITUTIONS[k] = { ...(ORIGINAL_INST[k] || {}), ...v }; }
function saveAll() {
  store.set('ch-curator-v1', CUR); store.set('ch-imported-v1', IMPORTED); store.set('ch-pending-imports-v1', PENDING_IMPORTS); store.set('ch-rights-edits-v1', RIGHTS_EDITS); store.set('ch-submissions-v1', SUBS);
  store.set('ch-keywords-v1', KEYWORDS); store.set('ch-keyword-suggestions-v1', KEYWORD_SUGGESTIONS); store.set('ch-keyword-dismissed-v1', KEYWORD_DISMISSED); store.set('ch-keyword-disabled-v1', KEYWORD_DISABLED);
  store.set('ch-inst-edits-v1', INST_EDITS); store.set('ch-duplicates-v1', DUPS); store.set('ch-activity-v1', ACTIVITY.slice(0, 60));
}
/* ═══ DUPLICATE CHECK ═══════════════════════════════════════════════
   Flags records that may describe the same item. It never merges or hides
   anything: a curator decides "same item" or "different items".
   Strong = same original link, or same title + same date at the same holder.
   Check  = same title at the same holder, different or missing date.        */
const dupTitle = t => norm(t).replace(/[^a-z0-9]+/g, ' ').trim();
function findDuplicates(pool = RECORDS) {
  const groups = new Map();
  const add = (key, why, strength, rs) => { if (rs.length > 1 && !groups.has(key)) groups.set(key, { key, why, strength, records: rs }); };
  const by = f => { const m = new Map(); for (const r of pool) { const k = f(r); if (k) m.set(k, [...(m.get(k) || []), r]); } return m; };
  for (const [u, rs] of by(r => r.url && r.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))) add('url|' + u, 'Same original link', 'strong', rs);
  for (const [t, rs] of by(r => dupTitle(r.title) && r.holder + '|' + dupTitle(r.title))) {
    const byDate = new Map(); const dk = r => /^(n\.?\s*d\.?|undated|s\.?\s*d\.?|unknown)$/i.test((r.dateText || '').trim()) ? '' : (r.dateText || '').trim();
    for (const r of rs) byDate.set(dk(r), [...(byDate.get(dk(r)) || []), r]);
    const same = [...byDate].filter(([d, x]) => d && x.length > 1);
    for (const [d, x] of same) add('td|' + t + '|' + d, 'Same title and date, same holder', 'strong', x);
    if (!same.length || same[0][1].length < rs.length) add('t|' + t, 'Same title, same holder', 'check', rs);
  }
  return [...groups.values()].map(g => ({ ...g, decision: DUPS[g.key] || '' }));
}
const openDuplicates = () => findDuplicates().filter(g => !g.decision);
/* Does a new (not yet published) record look like one we already have? */
function looksLikeExisting(r) {
  const t = dupTitle(r.title || ''), u = (r.url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  return RECORDS.filter(x => x.id !== r.id && ((u && x.url && x.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') === u) || (t && dupTitle(x.title) === t && x.holder === r.holder)));
}

function logActivity(text) { ACTIVITY.unshift({ at: new Date().toISOString(), text }); }

const DEMO_PHYSICAL = [
  {
    id: 'demo-physical-001', source: 'demo', sourceRecordId: 'PHYS-001',
    title: 'DEMO ONLY — Community Photograph Album (physical-only)', description: 'Fictional album for testing records without digital URLs. Not an actual archival holding.', dateText: 'ca. 1968',
    resourceType: 'Photograph', resourceTypeRule: 'Demonstration record', holder: 'nsa', provider: 'nsa', url: '', format: 'physical',
    physicalLocation: 'Nova Scotia Archives, 6016 University Avenue, Halifax, NS', reference: 'DEMO-PHYS-001', creator: 'Fictional creator', collection: 'Fictional demo holdings', placesText: 'Halifax',
    access: { status: 'Physical only — demonstration', note: 'Synthetic test record; not an actual holding of Nova Scotia Archives.' },
    rightsHolder: 'Fictional Demo Rights Holder', ownershipStatus: 'Fictional custodial holding', copyrightStatus: 'Copyrighted (fictional)', reproductionPermission: 'Permission required (demo)', rightsSource: 'Fictional demo declaration — not a real rights clearance', accessRestrictions: 'Demo only — no public access', rightsVerified: true,
    image: '', native: { demo: true }, provenance: ['Synthetic test record created for physical-only discovery and rights-display testing.']
  },
  {
    id: 'demo-physical-002', source: 'demo', sourceRecordId: 'PHYS-002',
    title: 'DEMO ONLY — Handwritten Family Correspondence (physical-only)', description: 'Fictional private letters for testing physical access, rights and privacy notices. Not an actual archival holding.', dateText: '1934',
    resourceType: 'Correspondence', resourceTypeRule: 'Demonstration record', holder: 'hma', provider: 'hma', url: '', format: 'physical',
    physicalLocation: 'Halifax Municipal Archives, 81 Ilsley Ave, Unit 11, Dartmouth, NS', reference: 'DEMO-PHYS-002', creator: 'Fictional author', collection: 'Fictional demo holdings', placesText: 'Halifax',
    access: { status: 'Physical only — demonstration', note: 'Synthetic test record; not an actual holding of Halifax Municipal Archives.' },
    rightsHolder: 'Fictional Family Estate', ownershipStatus: 'Private family ownership (fictional)', copyrightStatus: 'Copyrighted (fictional)', reproductionPermission: 'Permission required (demo)', rightsSource: 'Fictional demo declaration — not a real rights clearance', accessRestrictions: 'Private correspondence — demo restricted', rightsVerified: true,
    image: '', native: { demo: true }, provenance: ['Synthetic test record created for physical-only discovery and rights-display testing.']
  }
];

/* ═══ 2. INDEX ═════════════════════════════════════════════════════ */
let PIPE, RECORDS, REC, ENT_RECS, CO, SEARCH_DOCS;

function node(id) {                   // resolve any id to {id,type,name,...}
  if (ENTITIES[id]) return { id, ...ENTITIES[id] };
  if (PLACES[id]) return { id, type: 'place', ...PLACES[id] };
  if (INSTITUTIONS[id]) return { id, type: 'institution', ...INSTITUTIONS[id] };
  return null;
}
const nameOf = id => node(id)?.name || id;
const instName = k => INSTITUTIONS[k]?.name || k;

function buildIndex() {
  applyInstEdits();
  discoverApprovedRecords();
  MATCHERS = null;
  // copies, because the pipeline adds links/provenance to the objects it is given
  PIPE = runPipeline([...IMPORTED, ...DEMO_PHYSICAL, ...SUBS.filter(x => x.status === 'approved').map(submissionToRecord)].map(r => JSON.parse(JSON.stringify(r))));
  RECORDS = PIPE.records;
  for (const r of RECORDS) if (RIGHTS_EDITS[r.id]) Object.assign(r, RIGHTS_EDITS[r.id]);
  REC = new Map(RECORDS.map(r => [r.id, r]));
  ENT_RECS = new Map();
  const push = (id, rid) => { if (!ENT_RECS.has(id)) ENT_RECS.set(id, new Set()); ENT_RECS.get(id).add(rid); };
  for (const r of RECORDS) {
    for (const l of publicLinks(r)) push(l.id, r.id);
    push(r.holder, r.id);
  }
  // co-mentions: how many records two (non-institution) nodes share
  CO = new Map();
  for (const r of RECORDS) {
    const ids = publicLinks(r).map(l => l.id);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = ids[i] < ids[j] ? ids[i] + '|' + ids[j] : ids[j] + '|' + ids[i];
      CO.set(k, (CO.get(k) || 0) + 1);
    }
  }
  SEARCH_DOCS = RECORDS.map(r => ({ r, fields: [
    [tok(r.title), 3], [tok(publicLinks(r).map(l => nameOf(l.id)).join(' ')), 2.2], [tok(r.description), 1.2],
    [tok([instName(r.holder), instName(r.provider), r.resourceType].join(' ')), 1], [tok([r.reference, r.creator, r.collection].join(' ')), .6]
  ] }));
}

/* Curator decisions apply on top of the pipeline's links */
function linksOf(r) {
  return r.links.filter(l => CUR[r.id + '|' + l.id] !== 'rejected')
    .map(l => CUR[r.id + '|' + l.id] === 'confirmed' ? { ...l, status: 'confirmed', how: l.how + ' · curator confirmed' } : l);
}
const publicLinks = r => linksOf(r).filter(l => l.status === 'confirmed');
function decide(rid, eid, val) {
  if (val) CUR[rid + '|' + eid] = val; else delete CUR[rid + '|' + eid];
  logActivity(`${val || 'cleared'}: ${nameOf(eid)} on “${REC.get(rid)?.title || rid}”`);
  saveAll(); buildIndex(); render();
}
const recsOf = id => [...(ENT_RECS.get(id) || [])].map(x => REC.get(x)).filter(Boolean);

/* ═══ 3. SEARCH ════════════════════════════════════════════════════ */
const STOP = new Set('the a an of and or in on at to for from by with about is are was were what which who where when how do does did can could i me my any all show find records record'.split(' '));
function tok(s) { return norm(s).split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP.has(t)); }

function scoreDoc(doc, qt) {
  let score = 0;
  for (const t of qt) {
    let best = 0;
    const isYear = /^\d{4}s?$/.test(t);
    if (isYear) {                                                  // year or decade
      const y = parseInt(t), y2 = t.endsWith('s') ? y + 9 : y;
      const s0 = doc.r.dateStart, s1 = doc.r.dateEnd;
      if (s0 != null && s0 <= y2 && s1 >= y) {
        // dated inside the year first, then ranges that run through it (narrow ranges before wide ones)
        best = s0 >= y && s1 <= y2 ? 4 : 2 + 1 / (1 + (s1 - s0) / 10);
      }
    }
    for (const [toks, w] of doc.fields) {
      const wt = isYear ? Math.min(w, 1.5) : w;                    // a year only in the text ranks after real dates
      if (toks.includes(t)) best = Math.max(best, wt);
      else if (t.length >= 3 && toks.some(x => x.startsWith(t))) best = Math.max(best, wt * .7);
    }
    if (!best) return 0;                                           // every term must match somewhere
    score += best;
  }
  return score;
}

const FACETS = [
  ['holder', 'Held by', r => [r.holder], instName],
  ['provider', 'Source catalogue', r => [r.provider], instName],
  ['type', 'Resource type', r => [r.resourceType], x => x],
  ['place', 'Place', r => r.places, nameOf],
  ['person', 'Person', r => publicLinks(r).filter(l => l.kind === 'person').map(l => l.id), nameOf],
  ['org', 'Organization', r => publicLinks(r).filter(l => l.kind === 'organization').map(l => l.id), nameOf],
  ['event', 'Event / meeting', r => publicLinks(r).filter(l => l.kind === 'event').map(l => l.id), nameOf],
  ['topic', 'Topic', r => publicLinks(r).filter(l => l.kind === 'topic').map(l => l.id), nameOf],
  ['access', 'Access', r => [r.access.status], x => x]
];

function runSearch(p) {
  const qt = tok(p.q);
  let hits = SEARCH_DOCS.map(d => ({ r: d.r, s: qt.length ? scoreDoc(d, qt) : 1 })).filter(x => x.s > 0);
  for (const [key, , get] of FACETS) if (p[key]) hits = hits.filter(x => get(x.r).includes(p[key]));
  if (p.from) hits = hits.filter(x => x.r.dateEnd != null && x.r.dateEnd >= +p.from);
  if (p.to) hits = hits.filter(x => x.r.dateStart != null && x.r.dateStart <= +p.to);
  if (p.mapped) hits = hits.filter(x => x.r.mapped.length);
  if (p.nodate) hits = hits.filter(x => x.r.dateStart == null);    // admin dashboard: records missing a date
  if (p.nomap) hits = hits.filter(x => !x.r.mapped.length);        // admin dashboard: records with no map pin
  if (p.image) hits = hits.filter(x => x.r.image);
  const sort = p.sort || (qt.length ? 'rel' : 'old');
  hits.sort((a, b) => sort === 'rel' ? b.s - a.s || (a.r.dateStart ?? 9999) - (b.r.dateStart ?? 9999)
    : sort === 'new' ? (b.r.dateStart ?? -1) - (a.r.dateStart ?? -1) : (a.r.dateStart ?? 9999) - (b.r.dateStart ?? 9999));
  return hits.map(x => x.r);
}

function entityMatches(q, limit = 8) {
  const qn = norm(q).trim(); if (qn.length < 2) return [];
  const out = [];
  const all = [...Object.keys(ENTITIES), ...Object.keys(PLACES), ...Object.keys(INSTITUTIONS)];
  for (const id of all) {
    const n = node(id); if (!ENT_RECS.get(id)?.size && !n.statements) continue;
    const names = [n.name, ...(n.aliases || [])].map(norm);
    const words = names.flatMap(x => x.split(/[^a-z0-9]+/));
    const rank = names.some(x => x === qn) ? 0 : names.some(x => x.startsWith(qn)) ? 1 : words.some(w => w.startsWith(qn)) ? 2 : (qn.length >= 4 && names.some(x => x.includes(qn))) ? 2.5
      : tok(q).every(t => words.some(w => w.startsWith(t))) ? 3 : 99;
    if (rank < 99) out.push({ id, n, rank, count: ENT_RECS.get(id)?.size || 0 });
  }
  return out.sort((a, b) => a.rank - b.rank || b.count - a.count).slice(0, limit);
}

/* ═══ 4. ROUTER ════════════════════════════════════════════════════ */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { parts: (path || '').split('/').filter(Boolean).map(decodeURIComponent), params };
}
function href(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false)).toString();
  return '#/' + path + (qs ? '?' + qs : '');
}
const go = (path, params) => { location.hash = href(path, params); };
let MOUNTS = [];          // functions to run after HTML is in the page
let CLEANUP = [];
const onMount = fn => MOUNTS.push(fn);

function render() {
  CLEANUP.forEach(f => { try { f(); } catch { } }); CLEANUP = []; MOUNTS = [];
  const { parts, params } = parseHash();
  const [view, id] = parts;
  const views = { '': viewHome, search: viewSearch, e: viewEntity, r: viewRecord, map: viewMap, browse: viewBrowse, institutions: viewInstitutions, suggest: viewSuggest, admin: viewAdmin };
  const fn = views[view || ''] || viewHome;
  $('#app').innerHTML = fn(id, params);
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === (view || '') || (a.dataset.v === 'browse' && view === 'e')));
  document.body.classList.toggle('is-admin', view === 'admin');
  $('#hdr-search').hidden = !view || view === 'search';
  if ($('#hdr-q')) $('#hdr-q').value = '';
  if ($('#hdr-suggest')) $('#hdr-suggest').hidden = true;
  MOUNTS.forEach(f => f());
  if (!params.keep) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

function boot() {
  buildIndex();
  const hq = $('#hdr-q');
  $('#hdr-search').onsubmit = e => { e.preventDefault(); if (hq.value.trim()) go('search', { q: hq.value.trim() }); };
  attachSuggest(hq, $('#hdr-suggest'));
  render();
}
