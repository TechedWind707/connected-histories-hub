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
let IMPORTED = store.get('ch-imported-v1', []);    // records added through the CSV importer
let SUBS = store.get('ch-submissions-v1', []);     // public "Suggest a resource" submissions
let INST_EDITS = store.get('ch-inst-edits-v1', {}); // admin edits to institution access details (+ new institutions)
let ACTIVITY = store.get('ch-activity-v1', []);    // short admin activity log
const ORIGINAL_INST = JSON.parse(JSON.stringify(INSTITUTIONS));
function applyInstEdits() { for (const [k, v] of Object.entries(INST_EDITS)) INSTITUTIONS[k] = { ...(ORIGINAL_INST[k] || {}), ...v }; }
function saveAll() {
  store.set('ch-curator-v1', CUR); store.set('ch-imported-v1', IMPORTED); store.set('ch-submissions-v1', SUBS);
  store.set('ch-inst-edits-v1', INST_EDITS); store.set('ch-activity-v1', ACTIVITY.slice(0, 60));
}
function logActivity(text) { ACTIVITY.unshift({ at: new Date().toISOString(), text }); }

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
  // copies, because the pipeline adds links/provenance to the objects it is given
  PIPE = runPipeline([...IMPORTED, ...SUBS.filter(x => x.status === 'approved').map(submissionToRecord)].map(r => JSON.parse(JSON.stringify(r))));
  RECORDS = PIPE.records;
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
    if (/^\d{4}s?$/.test(t)) {                                    // year or decade
      const y = parseInt(t), y2 = t.endsWith('s') ? y + 9 : y;
      if (doc.r.dateStart != null && doc.r.dateStart <= y2 && doc.r.dateEnd >= y) best = 2.5;
    }
    for (const [toks, w] of doc.fields) {
      if (toks.includes(t)) best = Math.max(best, w);
      else if (t.length >= 3 && toks.some(x => x.startsWith(t))) best = Math.max(best, w * .7);
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
  MOUNTS.forEach(f => f());
  if (!params.keep) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

function boot() {
  buildIndex();
  const hq = $('#hdr-q');
  $('#hdr-search').onsubmit = e => { e.preventDefault(); if (hq.value.trim()) go('search', { q: hq.value.trim() }); };
  render();
}
