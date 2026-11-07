/* =====================================================================
   app.js — the hub's screens
   ---------------------------------------------------------------------
   Sections (search for the ═══ banners):
     1. Index      — run the pipeline, build look-up tables
     2. Curator    — confirm / reject suggested links (saved in browser)
     3. Search     — scoring, filters, entity suggestions
     4. Router     — #/path?params  →  view function
     5. Views      — home, search, entity (article), record, graph, map,
                     institutions, how-it-works, brief
     6. Widgets    — carousel, timeline, maps, mini-graph
     7. Ask        — grounded question answering (+ optional Claude)
   ===================================================================== */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: keep in memory only */ } }
};

/* ═══ 1. INDEX ═════════════════════════════════════════════════════ */
let IMPORTED = [];                    // records added via CSV this session
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
  PIPE = runPipeline(IMPORTED);
  RECORDS = PIPE.records;
  REC = new Map(RECORDS.map(r => [r.id, r]));
  ENT_RECS = new Map();
  const push = (id, rid) => { if (!ENT_RECS.has(id)) ENT_RECS.set(id, new Set()); ENT_RECS.get(id).add(rid); };
  for (const r of RECORDS) {
    for (const l of linksOf(r)) push(l.id, r.id);
    push(r.holder, r.id);
  }
  // co-mentions: how many records two (non-institution) nodes share
  CO = new Map();
  for (const r of RECORDS) {
    const ids = linksOf(r).map(l => l.id);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = ids[i] < ids[j] ? ids[i] + '|' + ids[j] : ids[j] + '|' + ids[i];
      CO.set(k, (CO.get(k) || 0) + 1);
    }
  }
  SEARCH_DOCS = RECORDS.map(r => ({ r, fields: [
    [tok(r.title), 3], [tok(linksOf(r).map(l => nameOf(l.id)).join(' ')), 2.2], [tok(r.description), 1.2],
    [tok([instName(r.holder), instName(r.provider), r.resourceType].join(' ')), 1], [tok([r.reference, r.creator, r.collection].join(' ')), .6]
  ] }));
}

/* ═══ 2. CURATOR DECISIONS (human-in-the-loop trust) ═══════════════ */
let CUR = store.get('ch-curator-v1', {});      // { 'recordId|entityId': 'confirmed' | 'rejected' }
function linksOf(r) {
  return r.links.filter(l => CUR[r.id + '|' + l.id] !== 'rejected')
    .map(l => CUR[r.id + '|' + l.id] === 'confirmed' ? { ...l, status: 'confirmed', how: l.how + ' · curator confirmed' } : l);
}
function decide(rid, eid, val) {
  if (val) CUR[rid + '|' + eid] = val; else delete CUR[rid + '|' + eid];
  store.set('ch-curator-v1', CUR); buildIndex(); render();
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
  ['person', 'Person', r => linksOf(r).filter(l => l.kind === 'person').map(l => l.id), nameOf],
  ['org', 'Organization', r => linksOf(r).filter(l => l.kind === 'organization').map(l => l.id), nameOf],
  ['event', 'Event / meeting', r => linksOf(r).filter(l => l.kind === 'event').map(l => l.id), nameOf],
  ['topic', 'Topic', r => linksOf(r).filter(l => l.kind === 'topic').map(l => l.id), nameOf],
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
    const rank = names.some(x => x === qn) ? 0 : names.some(x => x.startsWith(qn)) ? 1 : names.some(x => x.includes(qn)) ? 2
      : tok(q).every(t => names.some(x => x.includes(t))) ? 3 : 99;
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
  const views = { '': viewHome, search: viewSearch, e: viewEntity, r: viewRecord, graph: viewGraph, map: viewMap, institutions: viewInstitutions, how: viewHow, brief: viewBrief };
  const fn = views[view || ''] || viewHome;
  $('#app').innerHTML = fn(id, params);
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === (view || '')));
  $('#hdr-search').hidden = !view;
  if ($('#hdr-q') && view !== 'search') $('#hdr-q').value = '';
  MOUNTS.forEach(f => f());
  if (!params.keep) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

/* ═══ 5. VIEWS ═════════════════════════════════════════════════════ */

/* small building blocks */
const chip = (id, extra = '') => { const n = node(id); if (!n) return ''; return `<a class="chip t-${n.type}" href="${href('e/' + id)}" data-eid="${h(id)}">${h(n.name)}${extra}</a>`; };
const typeLabel = t => TYPE_STYLE[t]?.label || t;
const PLURAL = { person: 'People', place: 'Places & communities', organization: 'Organizations', event: 'Events & meetings', topic: 'Topics', institution: 'Institutions' };
const dateLabel = r => r.dateText ? h(r.dateText) : '<span class="muted">No date given</span>';
const span = recs => { const ys = recs.flatMap(r => [r.dateStart, r.dateEnd]).filter(y => y != null); return ys.length ? (Math.min(...ys) === Math.max(...ys) ? `${Math.min(...ys)}` : `${Math.min(...ys)}–${Math.max(...ys)}`) : 'undated'; };
const accessBadge = r => `<span class="badge acc-${/^Online/.test(r.access.status) ? 'on' : 'cat'}">${h(r.access.status)}</span>`;

function recordCard(r, opts = {}) {
  const ents = linksOf(r).filter(l => l.kind !== 'topic').slice(0, 5);
  return `<article class="rcard">
    ${r.image && !opts.noImg ? `<a class="rthumb" href="${href('r/' + r.id)}"><img loading="lazy" src="${h(r.image)}" alt="" onerror="this.parentNode.remove()"></a>` : ''}
    <div class="rbody">
      <div class="rmeta"><span class="rtype">${h(r.resourceType)}</span> · ${dateLabel(r)}${r.dateApprox ? ' <span class="muted" title="The source marks this date as approximate">(approx.)</span>' : ''}</div>
      <h3><a href="${href('r/' + r.id)}">${h(r.title)}</a></h3>
      ${r.description ? `<p class="rdesc">${h(r.description.slice(0, 180))}${r.description.length > 180 ? '…' : ''}</p>` : ''}
      <div class="rhold"><span class="inst-dot"></span>Held by <b>${h(instName(r.holder))}</b>${r.provider !== r.holder ? ` <span class="muted">· indexed via ${h(instName(r.provider))}</span>` : ''} ${accessBadge(r)}</div>
      ${ents.length ? `<div class="chips">${ents.map(l => chip(l.id)).join('')}</div>` : ''}
      <div class="ractions"><a class="btn-src" href="${h(r.url)}" target="_blank" rel="noopener">View at ${h(instName(r.provider))} ↗</a><a class="btn-ghost" href="${href('r/' + r.id)}">Details & provenance</a></div>
    </div></article>`;
}

/* ---------- HOME ---------- */
function viewHome() {
  const nInst = new Set(RECORDS.map(r => r.holder)).size;
  const nMapped = new Set(RECORDS.flatMap(r => r.mapped)).size;
  const browse = ['person', 'place', 'organization', 'event', 'topic'].map(t => {
    const ids = [...Object.keys(ENTITIES).filter(i => ENTITIES[i].type === t && !ENTITIES[i].creator), ...(t === 'place' ? Object.keys(PLACES) : [])]
      .filter(i => ENT_RECS.get(i)?.size).sort((a, b) => ENT_RECS.get(b).size - ENT_RECS.get(a).size).slice(0, t === 'person' ? 12 : 10);
    return `<div class="browse-col"><h4><span class="dot t-${t}"></span>${PLURAL[t]}</h4><div class="chips">${ids.map(i => chip(i, `<small>${ENT_RECS.get(i).size}</small>`)).join('')}</div></div>`;
  }).join('');
  onMount(mountCarousel);
  onMount(() => mountTimeline($('#home-tl'), RECORDS, (a, b) => go('search', { from: a, to: b })));
  onMount(bindSearchBox);
  return `
  <section class="hero">
    <div class="hero-in">
      <p class="eyebrow">Black History Knowledge Hub · proof of concept for the Black Cultural Centre for Nova Scotia</p>
      <h1>Find Black history across Canada's collections — and go straight to where it's held.</h1>
      <p class="lede">One search across ${Object.keys(SOURCES).length} institutions' catalogues. Every result links to the authoritative record, shows who owns it, and how to see it.</p>
      ${searchBox('')}
      <div class="stats">
        <div><b>${RECORDS.length}</b><span>records indexed</span></div>
        <div><b>${Object.keys(SOURCES).length}</b><span>source catalogues</span></div>
        <div><b>${nInst}</b><span>holding institutions</span></div>
        <div><b>${nMapped}</b><span>places on the map</span></div>
      </div>
    </div>
  </section>
  <section class="wrap feat-wrap">
    <div class="sec-head"><h2>Featured</h2><p class="muted">Rotating highlights. Each one is built only from indexed records and quoted sources.</p></div>
    <div id="carousel" class="carousel" aria-roledescription="carousel"></div>
  </section>
  <section class="wrap">
    <div class="sec-head"><h2>Browse what's connected</h2><p class="muted">Numbers = records linked. Click any name for its page, records, connections and map.</p></div>
    <div class="browse">${browse}</div>
  </section>
  <section class="wrap">
    <div class="sec-head"><h2>Across time</h2><p class="muted">Records by decade. Drag across the bars to search a period.</p></div>
    <div id="home-tl" class="timeline big"></div>
  </section>
  <section class="wrap three">
    <a class="tile" href="${href('map')}"><h3>Map</h3><p>Places named in the records — and dashed lines to the institutions that hold them.</p></a>
    <a class="tile" href="${href('graph')}"><h3>Connections</h3><p>A knowledge graph of people, places, organizations, events and topics. Hover to see what's linked.</p></a>
    <a class="tile" href="${href('how')}"><h3>How it works</h3><p>Four different catalogue formats, one common model — with every step of provenance visible.</p></a>
  </section>`;
}

function searchBox(q, mode = 'search') {
  return `<form id="sbox" class="sbox" role="search">
    <div class="sbox-tabs" role="tablist">
      <button type="button" role="tab" data-mode="search" class="${mode === 'search' ? 'on' : ''}">Search</button>
      <button type="button" role="tab" data-mode="ask" class="${mode === 'ask' ? 'on' : ''}">Ask a question</button>
    </div>
    <div class="sbox-row">
      <input id="q" name="q" autocomplete="off" value="${h(q)}" placeholder="${mode === 'ask' ? 'e.g. Where can I see photographs of Preston before 1950?' : 'People, places, communities, subjects, years, institutions…'}" aria-label="Search">
      <button class="btn-main" type="submit">${mode === 'ask' ? 'Ask' : 'Search'}</button>
    </div>
    <div id="suggest" class="suggest" hidden></div>
    <div class="examples">Try: ${(mode === 'ask'
      ? ['Where can I see records about Viola Desmond?', 'Photographs of Upper Hammonds Plains', 'Who is named in records about Five Mile Plains?', 'When were the No. 2 Construction Battalion files created?']
      : ['Africville', 'Preston', '1946', 'Black Loyalists', 'photograph 1949', 'Battalion'])
      .map(x => `<button type="button" class="ex" data-ex="${h(x)}">${h(x)}</button>`).join('')}</div>
  </form>`;
}
function bindSearchBox() {
  const f = $('#sbox'); if (!f) return;
  let mode = $('.sbox-tabs .on', f).dataset.mode;
  $$('.sbox-tabs button', f).forEach(b => b.onclick = () => {
    mode = b.dataset.mode;
    const parent = f.parentNode, q = $('#q', f).value;
    f.outerHTML = searchBox(q, mode); bindSearchBox(); $('#q').focus();
  });
  f.onsubmit = e => { e.preventDefault(); const q = $('#q', f).value.trim(); if (!q) return; mode === 'ask' ? go('search', { ask: q }) : go('search', { q }); };
  $$('.ex', f).forEach(b => b.onclick = () => { $('#q', f).value = b.dataset.ex; f.requestSubmit(); });
  const inp = $('#q', f), box = $('#suggest', f);
  inp.oninput = () => {
    if (mode !== 'search') return;
    const m = entityMatches(inp.value, 6);
    box.hidden = !m.length;
    box.innerHTML = m.map(x => `<a href="${href('e/' + x.id)}"><span class="dot t-${x.n.type}"></span><b>${h(x.n.name)}</b><small>${typeLabel(x.n.type)} · ${x.count} records</small></a>`).join('');
  };
  inp.onblur = () => setTimeout(() => box.hidden = true, 200);
}

/* ---------- SEARCH RESULTS ---------- */
function viewSearch(_, p) {
  if (p.ask) return viewAsk(p);
  const hits = runSearch(p);
  const view = p.view || 'list';
  const ents = p.q ? entityMatches(p.q, 6) : [];
  const facetHtml = FACETS.map(([key, label, get, name]) => {
    const counts = new Map();
    for (const r of hits) for (const v of new Set(get(r))) counts.set(v, (counts.get(v) || 0) + 1);
    if (!counts.size && !p[key]) return '';
    const items = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return `<details class="facet" ${p[key] || ['holder', 'type'].includes(key) ? 'open' : ''}><summary>${label}</summary>
      ${p[key] ? `<a class="fopt on" href="${href('search', { ...p, [key]: '' })}">✕ ${h(name(p[key]))}</a>` : items.map(([v, c]) => `<a class="fopt" href="${href('search', { ...p, [key]: v })}">${h(name(v))}<small>${c}</small></a>`).join('')}
    </details>`;
  }).join('');
  const active = [...FACETS.map(f => f[0]), 'from', 'to', 'mapped', 'image'].filter(k => p[k]);
  onMount(() => mountTimeline($('#res-tl'), hits, (a, b) => go('search', { ...p, from: a, to: b })));
  if (view === 'map') onMount(() => mountRecordsMap($('#res-map'), hits, { lines: true }));
  if (view === 'graph') onMount(() => mountGraph($('#res-graph'), { records: hits, height: 560 }));
  return `<div class="wrap search-page">
    <div class="search-top">${searchBox(p.q || '')}</div>
    ${ents.length ? `<div class="ent-hits"><span class="muted">Pages for:</span> ${ents.map(x => chip(x.id, `<small>${x.count}</small>`)).join('')}</div>` : ''}
    <div class="search-grid">
      <aside class="facets">
        <div class="facet-h"><b>Refine</b>${active.length ? `<a href="${href('search', { q: p.q })}">Clear all</a>` : ''}</div>
        <div class="facet"><div class="ftitle">Date</div><div id="res-tl" class="timeline"></div>
          <form class="years" onsubmit="event.preventDefault();go('search',{...${h(JSON.stringify(p))},from:this.from.value,to:this.to.value})">
            <input name="from" inputmode="numeric" placeholder="from" value="${h(p.from || '')}"> – <input name="to" inputmode="numeric" placeholder="to" value="${h(p.to || '')}"><button>Go</button></form></div>
        <label class="tgl"><input type="checkbox" ${p.mapped ? 'checked' : ''} onchange="go('search',{...${h(JSON.stringify(p))},mapped:this.checked?1:''})"> Only records with a map location</label>
        <label class="tgl"><input type="checkbox" ${p.image ? 'checked' : ''} onchange="go('search',{...${h(JSON.stringify(p))},image:this.checked?1:''})"> Only with an image preview</label>
        ${facetHtml}
      </aside>
      <section>
        <div class="res-bar">
          <div><b>${hits.length}</b> record${hits.length === 1 ? '' : 's'}${p.q ? ` for “${h(p.q)}”` : ''} from <b>${new Set(hits.map(r => r.holder)).size}</b> institution(s)</div>
          <div class="seg">${['list', 'map', 'graph'].map(v => `<a class="${view === v ? 'on' : ''}" href="${href('search', { ...p, view: v })}">${v[0].toUpperCase() + v.slice(1)}</a>`).join('')}</div>
          <select onchange="go('search',{...${h(JSON.stringify(p))},sort:this.value})" aria-label="Sort">
            ${[['rel', 'Best match'], ['old', 'Oldest first'], ['new', 'Newest first']].map(([v, l]) => `<option value="${v}" ${(p.sort || (p.q ? 'rel' : 'old')) === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        ${!hits.length ? `<div class="empty"><h3>No indexed records match.</h3><p>The hub only shows what institutions have described — it never fills gaps with guesses. Try fewer words, a different spelling, or <a href="${href('search', { ask: p.q })}">ask it as a question</a>.</p></div>` : ''}
        ${view === 'list' ? `<div class="rlist">${hits.slice(0, +(p.n || 40)).map(r => recordCard(r)).join('')}</div>
          ${hits.length > +(p.n || 40) ? `<a class="more" href="${href('search', { ...p, n: +(p.n || 40) + 40, keep: 1 })}">Show more (${hits.length - +(p.n || 40)} left)</a>` : ''}` : ''}
        ${view === 'map' ? `<div id="res-map" class="map tall"></div><p class="muted small">Only records whose place name matched the national gazetteer get a pin (${hits.filter(r => r.mapped.length).length} of ${hits.length}). Squares = holding institutions; dashed lines join a place to where its records are held.</p>` : ''}
        ${view === 'graph' ? `<div id="res-graph" class="graph-box"></div>` : ''}
      </section>
    </div></div>`;
}

/* ---------- ENTITY / ARTICLE PAGE ---------- */
function viewEntity(id) {
  const n = node(id);
  if (!n) return `<div class="wrap"><h2>Not found</h2><p>No page for “${h(id)}”.</p></div>`;
  const recs = recsOf(id).sort((a, b) => (a.dateStart ?? 9999) - (b.dateStart ?? 9999));
  const holders = [...new Set(recs.map(r => r.holder))];
  const rels = RELATIONS.filter(r => r[0] === id || r[2] === id);
  const co = [...CO].map(([k, c]) => { const [a, b] = k.split('|'); return a === id ? [b, c] : b === id ? [a, c] : null; }).filter(Boolean)
    .filter(([x]) => node(x)).sort((a, b) => b[1] - a[1]);
  const byType = {}; for (const [x, c] of co) { const t = node(x).type; (byType[t] = byType[t] || []).push([x, c]); }
  const statements = n.statements || [];
  const dated = recs.filter(r => r.dateStart != null);
  const autoFacts = recs.length ? [
    `The hub indexes <b>${recs.length}</b> record${recs.length > 1 ? 's' : ''} linked to ${h(n.name)}, held by <b>${holders.length}</b> institution${holders.length > 1 ? 's' : ''}.`,
    dated.length ? `Dated records span <b>${span(dated)}</b>. Earliest: <a href="${href('r/' + dated[0].id)}">${h(dated[0].title)}</a> (${h(dated[0].dateText)}).` : 'None of the linked records carry a date.',
    recs.length - dated.length ? `${recs.length - dated.length} record(s) have no date in the source.` : ''
  ].filter(Boolean) : [];
  const types = [...new Set(recs.map(r => r.resourceType))];
  onMount(() => mountTimeline($('#ent-tl'), recs, (a, b) => go('search', { [facetKeyFor(n.type)]: id, from: a, to: b })));
  onMount(() => mountGraph($('#ent-graph'), { focus: id, height: 380, ego: true }));
  onMount(() => mountRecordsMap($('#ent-map'), recs, { lines: true, focusPlace: PLACES[id]?.lat != null ? id : null }));
  onMount(() => $$('.tfilter').forEach(b => b.onclick = () => {
    $$('.tfilter').forEach(x => x.classList.toggle('on', x === b));
    $$('#ent-recs .rcard-wrap').forEach(c => c.hidden = b.dataset.t && c.dataset.t !== b.dataset.t);
    $$('#ent-recs details.more-recs').forEach(d => d.open = !!b.dataset.t);
  }));
  return `<div class="wrap article">
    <nav class="crumbs"><a href="#/">Discover</a> › <span>${typeLabel(n.type)}</span></nav>
    <header class="art-head">
      <span class="kind t-${n.type}">${typeLabel(n.type)}${n.community ? ' · community' : ''}${n.meeting ? ' · meeting' : ''}</span>
      <h1>${h(n.name)}</h1>
      <p class="art-meta">${recs.length} records · ${holders.length} holding institution(s) · ${span(recs)}${n.cgndb ? ` · <a href="${CGNDB(n.cgndb)}" target="_blank" rel="noopener">Gazetteer: CGNDB ${n.cgndb} ↗</a>` : ''}${n.unmappedWhy ? ` · <span class="muted">No map pin: ${h(n.unmappedWhy)}</span>` : ''}</p>
    </header>
    <div class="art-grid">
      <div>
        <section class="card">
          <h2 class="h-sm">What the sources say</h2>
          ${statements.length ? statements.map(([t, l, u]) => `<blockquote class="quote">“${h(t)}”<cite>— <a href="${h(u)}" target="_blank" rel="noopener">${h(l)} ↗</a></cite></blockquote>`).join('')
            : `<p class="muted">No curator has added a quoted context statement yet. The hub doesn't write history itself — here is what the records show:</p>`}
          ${n.note ? `<p class="note">${h(n.note)}</p>` : ''}
          <ul class="facts">${autoFacts.map(f => `<li>${f}</li>`).join('')}</ul>
          ${n.address ? `<p><b>Visit:</b> ${h(n.address)}<br><span class="muted">${h(n.access)}</span>${n.web ? `<br><a href="${h(n.web)}" target="_blank" rel="noopener">${h(n.web)} ↗</a>` : ''}</p>` : (n.type === 'institution' ? `<p class="muted">${h(n.access)}</p>` : '')}
        </section>
        ${recs.length ? `<section class="card"><h2 class="h-sm">Across time</h2><div id="ent-tl" class="timeline"></div></section>` : ''}
        <section class="card" id="ent-recs">
          <div class="row-between"><h2 class="h-sm">Records (${recs.length})</h2>
            <a class="btn-ghost" href="${href('search', { [facetKeyFor(n.type)]: id })}">Open in search →</a></div>
          ${types.length > 1 ? `<div class="tfilters"><button class="tfilter on" data-t="">All</button>${types.map(t => `<button class="tfilter" data-t="${h(t)}">${h(t)} <small>${recs.filter(r => r.resourceType === t).length}</small></button>`).join('')}</div>` : ''}
          ${holders.map(k => `<h3 class="hold-h"><span class="inst-sq"></span>${h(instName(k))} <small class="muted">${recs.filter(r => r.holder === k).length} record(s)</small></h3>
            <p class="muted small">${h(INSTITUTIONS[k]?.access || '')}${INSTITUTIONS[k]?.address ? ' · ' + h(INSTITUTIONS[k].address) : ''}</p>
            ${(() => { const rs = recs.filter(r => r.holder === k), card = r => `<div class="rcard-wrap" data-t="${h(r.resourceType)}">${recordCard(r)}</div>`;
              return rs.slice(0, 4).map(card).join('') + (rs.length > 4 ? `<details class="more-recs"><summary>Show ${rs.length - 4} more from ${h(instName(k))}</summary>${rs.slice(4).map(card).join('')}</details>` : ''); })()}`).join('') || '<p class="muted">No records linked yet.</p>'}
        </section>
      </div>
      <aside>
        <section class="card">
          <h2 class="h-sm">Connections</h2>
          <div id="ent-graph" class="graph-box mini"></div>
          <p class="muted small">Solid gold = a curated relationship with evidence. Dashed = appear in the same records. Click a node to explore.</p>
          ${rels.length ? `<ul class="rels">${rels.map(([a, label, b, el, eu]) => `<li>${a === id ? '' : chip(a) + ' '}<span class="rel-l">${h(label)}</span>${b === id ? '' : ' ' + chip(b)}
            <div class="ev">Evidence: ${/^https?:/.test(eu) ? `<a href="${h(eu)}" target="_blank" rel="noopener">${h(el)} ↗</a>` : `<a href="${href('r/' + eu)}">${h(el)}</a>`}</div></li>`).join('')}</ul>` : ''}
          ${Object.entries(byType).map(([t, list]) => `<h4 class="co-h"><span class="dot t-${t}"></span>${PLURAL[t]} in the same records</h4><div class="chips">${list.slice(0, 10).map(([x, c]) => chip(x, `<small>${c}</small>`)).join('')}</div>`).join('')}
        </section>
        <section class="card"><h2 class="h-sm">Where to go</h2>
          ${holders.map(k => { const I = INSTITUTIONS[k]; return `<div class="where"><b><a href="${href('e/' + k)}">${h(I.name)}</a></b><span class="muted small">${h(I.kind)}</span><div class="small">${I.address ? h(I.address) : '<span class="muted">Address not confirmed</span>'}</div><div class="small muted">${h(I.access)}</div></div>`; }).join('') || '<p class="muted">—</p>'}
        </section>
      </aside>
    </div>
    <section class="card map-end">
      <div class="row-between"><h2 class="h-sm">Places connected to ${h(n.name)}</h2><span class="muted small">Circles = places named in the records · squares = where they're held · dashed = record held there</span></div>
      <div id="ent-map" class="map"></div>
    </section>
  </div>`;
}
const facetKeyFor = t => ({ person: 'person', place: 'place', organization: 'org', event: 'event', topic: 'topic', institution: 'holder' }[t] || 'topic');

/* ---------- RECORD PAGE ---------- */
function viewRecord(id) {
  const r = REC.get(id);
  if (!r) return `<div class="wrap"><h2>Record not found</h2></div>`;
  const links = r.links.map(l => ({ ...l, decision: CUR[r.id + '|' + l.id] }));
  const similar = RECORDS.filter(x => x !== r).map(x => [x, linksOf(x).filter(l => l.kind !== 'topic' && linksOf(r).some(m => m.id === l.id)).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 4);
  onMount(() => mountRecordsMap($('#rec-map'), [r], { lines: true }));
  onMount(() => $$('[data-decide]').forEach(b => b.onclick = () => decide(r.id, b.dataset.eid, b.dataset.decide || null)));
  const I = INSTITUTIONS[r.holder];
  return `<div class="wrap record">
    <nav class="crumbs"><a href="#/">Discover</a> › <a href="${href('search', { holder: r.holder })}">${h(instName(r.holder))}</a> › <span>Record</span></nav>
    <div class="rec-grid">
      <div>
        <p class="eyebrow dark">${h(r.resourceType)} · ${dateLabel(r)}</p>
        <h1 class="rec-title">${h(r.title)}</h1>
        ${r.description ? `<p class="lede dark">${h(r.description)}</p>` : ''}
        ${r.image ? `<figure class="rec-img"><img src="${h(r.image)}" alt="Preview of ${h(r.title)}" onerror="this.parentNode.remove()"><figcaption>Preview displayed from ${h(instName(r.provider))}'s server — not copied. ${h(r.imageCredit)}</figcaption></figure>` : ''}
        <table class="kv">
          <tr><th>Held by</th><td><a href="${href('e/' + r.holder)}">${h(instName(r.holder))}</a></td></tr>
          ${r.provider !== r.holder ? `<tr><th>Indexed via</th><td>${h(instName(r.provider))} <span class="muted">(the catalogue/exhibit we read)</span></td></tr>` : ''}
          <tr><th>Date</th><td>${dateLabel(r)} ${r.dateStart ? `<span class="muted">→ indexed as ${r.dateStart}${r.dateEnd !== r.dateStart ? '–' + r.dateEnd : ''}${r.dateApprox ? ', approximate' : ''}</span>` : ''}</td></tr>
          <tr><th>Reference</th><td>${h(r.reference || '—')}</td></tr>
          ${r.creator ? `<tr><th>Creator</th><td>${h(r.creator)}</td></tr>` : ''}
          <tr><th>Collection</th><td>${h(r.collection)}</td></tr>
          <tr><th>Source id</th><td><code>${h(r.sourceRecordId)}</code></td></tr>
        </table>
        <section class="card"><h2 class="h-sm">People, places & topics</h2>
          <p class="muted small">How each link was found. <b>Confirmed</b> = the source names it, classifies it, or a curator approved it. <b>Suggested</b> = a keyword match only — not proof.</p>
          <ul class="links">${links.map(l => `<li class="${l.decision === 'rejected' ? 'rej' : ''}">${chip(l.id)} <span class="badge st-${l.decision || l.status}">${l.decision || l.status}</span><span class="muted small">${h(l.how)}</span>
            <span class="cur">${l.decision ? `<button data-decide="" data-eid="${h(l.id)}">undo</button>` : l.status === 'suggested' ? `<button data-decide="confirmed" data-eid="${h(l.id)}">confirm</button><button data-decide="rejected" data-eid="${h(l.id)}">reject</button>` : ''}</span></li>`).join('')}</ul>
        </section>
        <section class="card"><h2 class="h-sm">Provenance — what the hub did</h2><ol class="prov">${r.provenance.map(s => `<li>${h(s)}</li>`).join('')}</ol>
          <details><summary>Original metadata, exactly as harvested</summary><pre class="native">${h(JSON.stringify(r.native, null, 2))}</pre></details></section>
      </div>
      <aside>
        <section class="card access">
          <h2 class="h-sm">How to access</h2>
          ${accessBadge(r)}
          <p>${h(r.access.note)}</p>
          <a class="btn-main block" href="${h(r.url)}" target="_blank" rel="noopener">Open the authoritative record ↗</a>
          <p class="muted small">${h(instName(r.provider))} remains the authority for this record. The hub keeps only a pointer and basic metadata.</p>
          ${I ? `<div class="where"><b>${h(I.name)}</b><div class="small">${h(I.address || 'Address not confirmed')}</div><div class="small muted">${h(I.access)}</div></div>` : ''}
        </section>
        <section class="card"><h2 class="h-sm">On the map</h2>${r.mapped.length ? '' : `<p class="muted small">No pin — ${r.places.length ? 'the place named (' + r.places.map(nameOf).map(h).join(', ') + ') is too broad or not in the gazetteer.' : 'the record names no place the gazetteer could confirm.'} Only the holding institution is shown.</p>`}<div id="rec-map" class="map short"></div></section>
        ${similar.length ? `<section class="card"><h2 class="h-sm">Connected records</h2>${similar.map(([x, c]) => `<a class="sim" href="${href('r/' + x.id)}"><b>${h(x.title)}</b><span class="muted small">${h(x.dateText || 'n.d.')} · ${h(instName(x.holder))} · ${c} shared</span></a>`).join('')}</section>` : ''}
      </aside>
    </div></div>`;
}

/* ---------- GRAPH (full) ---------- */
function viewGraph(_, p) {
  onMount(() => mountGraph($('#big-graph'), { height: Math.max(560, innerHeight - 220), full: true, focus: p.focus }));
  return `<div class="wrap">
    <div class="sec-head"><h1 class="h1-sm">Connections</h1><p class="muted">Every person, place, organization, event, topic and holding institution in the hub, and how they link. Hover to highlight what's related · drag to rearrange · scroll to zoom · click for details · double-click to open its page.</p></div>
    <div id="big-graph" class="graph-box full"></div></div>`;
}

/* ---------- MAP (full) ---------- */
function viewMap(_, p) {
  const recs = runSearch(p);
  onMount(() => mountRecordsMap($('#big-map'), recs, { lines: !!p.lines, cluster: true }));
  const unm = recs.filter(r => !r.mapped.length).length;
  const topics = Object.keys(ENTITIES).filter(i => ENTITIES[i].type === 'topic' && ENT_RECS.get(i)?.size);
  return `<div class="wrap">
    <div class="sec-head"><h1 class="h1-sm">Map</h1><p class="muted">Places named in the records (circles, sized by number of records) and the institutions that hold them (squares). Coordinates come only from the Canadian Geographical Names Database — ${unm} of ${recs.length} records name no confirmable place, so they stay searchable without a pin.</p></div>
    <div class="map-tools">
      <select onchange="go('map',{...${h(JSON.stringify(p))},topic:this.value})"><option value="">All topics</option>${topics.map(t => `<option value="${t}" ${p.topic === t ? 'selected' : ''}>${h(nameOf(t))}</option>`).join('')}</select>
      <form onsubmit="event.preventDefault();go('map',{...${h(JSON.stringify(p))},from:this.from.value,to:this.to.value})" class="years"><input name="from" placeholder="from" value="${h(p.from || '')}"> – <input name="to" placeholder="to" value="${h(p.to || '')}"><button>Filter years</button></form>
      <label class="tgl"><input type="checkbox" ${p.lines ? 'checked' : ''} onchange="go('map',{...${h(JSON.stringify(p))},lines:this.checked?1:''})"> Show place → holder lines</label>
    </div>
    <div id="big-map" class="map xl"></div></div>`;
}

/* ---------- INSTITUTIONS ---------- */
function viewInstitutions() {
  const list = Object.keys(INSTITUTIONS).map(k => ({ k, I: INSTITUTIONS[k], held: recsOf(k).length, via: RECORDS.filter(r => r.provider === k).length }))
    .sort((a, b) => b.held - a.held);
  onMount(() => mountRecordsMap($('#inst-map'), [], { institutionsOnly: true }));
  return `<div class="wrap">
    <div class="sec-head"><h1 class="h1-sm">Institutions</h1><p class="muted">Who holds the material, and how to reach it. "Source catalogue" means the hub reads that institution's metadata directly. Others are named as holders inside those catalogues.</p></div>
    <div id="inst-map" class="map short"></div>
    <div class="inst-grid">${list.map(({ k, I, held, via }) => `<article class="card inst">
      <div class="row-between"><h3><a href="${href('e/' + k)}">${h(I.name)}</a></h3>${I.isSource ? '<span class="badge st-confirmed">source catalogue</span>' : I.isPartner ? '<span class="badge partner">challenge partner</span>' : ''}</div>
      <p class="muted small">${h(I.kind)}</p>
      <p class="small">${I.address ? h(I.address) : '<span class="muted">Visitor address not confirmed in this prototype</span>'}</p>
      <p class="small muted">${h(I.access)}</p>
      <p class="small"><b>${held}</b> record(s) held${via && via !== held ? ` · <b>${via}</b> indexed via its catalogue` : ''} ${held ? `· <a href="${href('search', { holder: k })}">see records →</a>` : ''}</p>
      ${I.web ? `<a class="small" href="${h(I.web)}" target="_blank" rel="noopener">${h(I.web)} ↗</a>` : ''}
    </article>`).join('')}</div></div>`;
}

/* ---------- HOW IT WORKS (sources, model, quality, curator queue, import) ---------- */
function viewHow(_, p) {
  const tab = p.tab || 'pipeline';
  const tabs = [['pipeline', 'Pipeline & sources'], ['model', 'Common model'], ['quality', 'Data quality'], ['review', 'Curator review'], ['import', 'Add a source (CSV)']];
  let body = '';
  if (tab === 'pipeline') {
    body = `<div class="flow">${['Source catalogues<small>4 formats</small>', 'Harvest snapshot<small>metadata only</small>', 'Crosswalk<small>→ common model</small>', 'Link<small>gazetteer + authority file</small>', 'Index<small>search · map · graph</small>', 'Ask<small>grounded answers</small>'].map(s => `<div>${s}</div>`).join('<span>→</span>')}</div>
    <p class="muted">Each source is read in its own shape. Nothing is copied except the fields shown here; every result points back to the source.</p>
    ${Object.entries(SOURCES).map(([key, s]) => { const f = s.feed(); const sample = f.records[0]; const mapped = crosswalk[key](sample);
      return `<article class="card src">
      <div class="row-between"><h3>${h(s.label)}</h3><span class="badge">${f.records.length} records</span></div>
      <p class="small"><b>Shape:</b> ${h(s.shape)} · <b>Method:</b> ${h(f.method)} · <b>Harvested:</b> ${h(f.harvested)}</p>
      <p class="small">From: ${f.harvestUrls.map(u => `<a href="${h(u)}" target="_blank" rel="noopener">${h(u.replace(/^https:\/\//, '').slice(0, 60))}…</a>`).join(' · ')}</p>
      <div class="xwalk"><div><h4>As the source publishes it</h4><pre class="native">${h(JSON.stringify(sample, null, 2))}</pre></div>
      <div><h4>After the crosswalk</h4><table class="kv small">${['id', 'title', 'dateText', 'resourceType', 'holder', 'provider', 'url', 'reference', 'collection'].map(k => `<tr><th>${k}</th><td>${h(mapped[k])}</td></tr>`).join('')}</table></div></div>
    </article>`; }).join('')}`;
  }
  if (tab === 'model') body = `<table class="kv model">${COMMON_FIELDS.map(([k, v]) => `<tr><th><code>${h(k)}</code></th><td>${h(v)}</td></tr>`).join('')}</table>
    <p class="muted small">Field names follow the team's planning document (record_id, title, description, institution, source_url, source_id, date, place, latitude/longitude, resource_type, access_status, provenance) plus holder vs provider, confidence on every link, and the untouched native record.</p>`;
  if (tab === 'quality') {
    const n = RECORDS.length, pct = x => Math.round(100 * x / n) + '%';
    const sugg = RECORDS.flatMap(r => r.links.filter(l => l.status === 'suggested' && !CUR[r.id + '|' + l.id]));
    const lang = RECORDS.filter(r => /Negro|mulatto|Slums/i.test(r.title));
    body = `<div class="qgrid">
      ${[['Have a date', RECORDS.filter(r => r.dateStart != null).length], ['Approximate dates', RECORDS.filter(r => r.dateApprox).length], ['Have a map location', RECORDS.filter(r => r.mapped.length).length], ['Name a place too broad to pin', RECORDS.filter(r => r.places.length && !r.mapped.length).length], ['Have a description', RECORDS.filter(r => r.description).length], ['Image preview at source', RECORDS.filter(r => r.image).length], ['Original held elsewhere than the catalogue we read', RECORDS.filter(r => r.holder !== r.provider).length], ['Type inferred by keyword rule', RECORDS.filter(r => /keyword rule|default/.test(r.resourceTypeRule)).length]]
        .map(([l, c]) => `<div class="q"><b>${c}</b><span>${l}</span><small>${pct(c)}</small></div>`).join('')}</div>
      <h3>Open issues for curators</h3>
      <ul class="issues"><li><b>${sugg.length}</b> suggested topic links waiting for review — <a href="${href('how', { tab: 'review' })}">review them</a>.</li>
      ${REVIEW_FLAGS.map(f => `<li>${f.ids ? f.ids.map(i => chip(i)).join(' ') : ''} ${h(f.why)} ${f.url ? `<a href="${h(f.url)}" target="_blank" rel="noopener">Read ↗</a>` : ''}</li>`).join('')}
      <li><b>${lang.length}</b> titles contain historical terms that are harmful today. They're kept verbatim because changing a source's title would break provenance — the hub flags them instead.</li></ul>`;
  }
  if (tab === 'review') {
    const groups = new Map();
    for (const r of RECORDS) for (const l of r.links) if (l.status === 'suggested') { if (!groups.has(l.id)) groups.set(l.id, []); groups.get(l.id).push(r); }
    onMount(() => $$('[data-decide]').forEach(b => b.onclick = () => decide(b.dataset.rid, b.dataset.eid, b.dataset.decide || null)));
    body = `<p class="muted">Keyword matches are never treated as fact. A curator confirms or rejects them; decisions are saved in this browser (a real deployment would store them with the curator's name).</p>
      ${[...groups].map(([eid, rs]) => `<details class="card rev" ${groups.size < 4 ? 'open' : ''}><summary>${chip(eid)} <span class="muted">${rs.length} suggestion(s)</span></summary>
        ${rs.map(r => { const d = CUR[r.id + '|' + eid]; const l = r.links.find(x => x.id === eid); return `<div class="rev-row ${d || ''}"><a href="${href('r/' + r.id)}">${h(r.title)}</a><span class="muted small">${h(l.how)}</span>
          <span class="cur">${d ? `<span class="badge st-${d}">${d}</span><button data-decide="" data-rid="${r.id}" data-eid="${eid}">undo</button>` : `<button data-decide="confirmed" data-rid="${r.id}" data-eid="${eid}">confirm</button><button data-decide="rejected" data-rid="${r.id}" data-eid="${eid}">reject</button>`}</span></div>`; }).join('')}
      </details>`).join('')}`;
  }
  if (tab === 'import') { onMount(bindImporter); body = importerHtml(); }
  return `<div class="wrap">
    <div class="sec-head"><h1 class="h1-sm">How it works</h1><p class="muted">The gap: no simple, trusted layer connects records across institutions while keeping each institution's ownership. This page shows how the hub closes it — and what it refuses to do.</p></div>
    <nav class="tabs">${tabs.map(([k, l]) => `<a class="${tab === k ? 'on' : ''}" href="${href('how', { tab: k })}">${l}</a>`).join('')}</nav>
    ${body}</div>`;
}

/* CSV importer: proves a new institution can join without custom code */
const SAMPLE_CSV = `id,title,date,link,institution,notes
desmond-7,Affidavit of Service to Stipendiary Magistrate MacKay (dated 6 January 1947),7 January 1947,https://archives.novascotia.ca/desmond/archives/?ID=7,Nova Scotia Archives,Viola Desmond court file
desmond-8,Affidavit of Service to Henry MacNeil (dated 6 January 1947),7 January 1947,https://archives.novascotia.ca/desmond/archives/?ID=8,Nova Scotia Archives,Viola Desmond court file
desmond-9,Affidavit of Service to Stipendiary Magistrate MacKay and Henry MacNeil,7 January 1947,https://archives.novascotia.ca/desmond/archives/?ID=9,Nova Scotia Archives,Viola Desmond court file`;
const CSV_GUESS = { id: /^(id|identifier|record.?id|accession|ref.?no)$/i, title: /title|name|heading/i, dateText: /date|year|span/i, url: /url|link|uri|web/i, holder: /institution|holder|repository|owner|held/i, description: /desc|notes?|scope|summary|abstract/i, creator: /creator|author|photographer|maker/i, resourceType: /type|format|material/i, placeText: /place|location|community|town/i };
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
function importerHtml() {
  return `<div class="card"><p>Paste a spreadsheet export (CSV) from any institution. The hub guesses which column is which, shows you the mapping, and adds the records <b>to this browser session only</b>. The sample is three more real records from the Nova Scotia Archives Viola Desmond exhibit, shaped like a simple spreadsheet.</p>
    <div class="row"><button class="btn-ghost" id="csv-sample">Load sample</button><label class="btn-ghost">Choose file<input type="file" id="csv-file" accept=".csv,text/csv" hidden></label></div>
    <textarea id="csv-text" rows="7" placeholder="id,title,date,link,institution,notes"></textarea>
    <div id="csv-map"></div><div id="csv-preview"></div>
    ${IMPORTED.length ? `<p class="badge st-confirmed">${IMPORTED.length} record(s) imported this session — <a href="${href('search', { provider: 'csv' })}">see them in search</a>.</p>` : ''}</div>`;
}
function bindImporter() {
  const ta = $('#csv-text');
  $('#csv-sample').onclick = () => { ta.value = SAMPLE_CSV; preview(); };
  $('#csv-file').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => { ta.value = t; preview(); }); };
  ta.oninput = preview;
  let mapping = {};
  function preview() {
    const rows = parseCsv(ta.value); if (rows.length < 2) { $('#csv-map').innerHTML = ''; $('#csv-preview').innerHTML = ''; return; }
    const head = rows[0];
    mapping = {};
    for (const [field, re] of Object.entries(CSV_GUESS)) { const i = head.findIndex(c => re.test(c.trim())); if (i >= 0 && !Object.values(mapping).includes(i)) mapping[field] = i; }
    $('#csv-map').innerHTML = `<h4>Column mapping (guessed — change if wrong)</h4><div class="mapgrid">${Object.keys(CSV_GUESS).map(f => `<label>${f}<select data-f="${f}"><option value="">— none —</option>${head.map((c, i) => `<option value="${i}" ${mapping[f] === i ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></label>`).join('')}</div>`;
    $$('#csv-map select').forEach(s => s.onchange = () => { if (s.value === '') delete mapping[s.dataset.f]; else mapping[s.dataset.f] = +s.value; show(); });
    show();
    function show() {
      const recs = rows.slice(1).map((r, n) => csvToRecord(r, mapping, n));
      const bad = recs.filter(r => !r.title || !r.url);
      $('#csv-preview').innerHTML = `<h4>Preview (${recs.length} rows)</h4>
        ${bad.length ? `<p class="warn">${bad.length} row(s) have no title or no link to the authoritative record — they'll be skipped. A hub record must point back to its source.</p>` : ''}
        <table class="kv small"><tr><th>title</th><th>date → years</th><th>holder</th><th>linked</th></tr>${recs.slice(0, 6).map(r => { const d = parseDate(r.dateText); const l = linkEntities(r); return `<tr><td>${h(r.title)}</td><td>${h(r.dateText)} → ${d.start ?? '—'}</td><td>${h(instName(r.holder))}</td><td>${l.map(x => h(nameOf(x.id))).join(', ') || '—'}</td></tr>`; }).join('')}</table>
        <button class="btn-main" id="csv-go" ${recs.length === bad.length ? 'disabled' : ''}>Add ${recs.length - bad.length} record(s) to the index</button>`;
      const goBtn = $('#csv-go'); if (goBtn) goBtn.onclick = () => { IMPORTED.push(...recs.filter(r => r.title && r.url).filter(r => !REC.has(r.id))); buildIndex(); render(); };
    }
  }
}
function csvToRecord(row, m, n) {
  const g = f => m[f] != null ? (row[m[f]] || '').trim() : '';
  const instText = g('holder');
  const holder = Object.keys(INSTITUTIONS).find(k => norm(INSTITUTIONS[k].name) === norm(instText)) || (instText ? 'csv-' + norm(instText).replace(/\W+/g, '-') : 'csv-unknown');
  if (!INSTITUTIONS[holder]) INSTITUTIONS[holder] = { name: instText || 'Unknown institution', kind: 'Imported (CSV)', address: '', place: '', access: 'Imported this session — access details not yet supplied.' };
  if (!INSTITUTIONS.csv) INSTITUTIONS.csv = { name: 'CSV import (this session)', kind: 'Imported source', access: 'Session-only import.' };
  return {
    id: 'csv-' + (g('id') || n), source: 'csv', sourceRecordId: g('id') || String(n),
    title: g('title'), description: g('description'), dateText: g('dateText'),
    resourceType: g('resourceType') || 'Record', resourceTypeRule: 'CSV column', holder, provider: 'csv', url: g('url'),
    reference: g('id'), creator: g('creator'), collection: 'CSV import', themeKey: 'csv:*', placesText: g('placeText'),
    access: { status: 'Catalogue online', note: 'Imported from a spreadsheet; check the linked record for access.' }, image: '',
    native: Object.fromEntries(row.map((v, i) => [String(i), v])),
    provenance: ['Imported from CSV in this browser session.', `Columns mapped: ${Object.entries(m).map(([k, i]) => k + '←col' + i).join(', ')}.`]
  };
}

/* ---------- THE BRIEF ---------- */
function viewBrief() {
  const rows = [
    ['Ingest or reference metadata from multiple sample sources', `${Object.keys(SOURCES).length} real public sources in 4 different shapes (exhibit list, federal catalogue, museum objects, municipal source guide).`, 'how'],
    ['Normalize into a common structure', 'One crosswalk per source → common model; native record kept untouched beside it.', 'how?tab=model'],
    ['Search by people, places, communities, subjects, dates, institutions, resource type', 'Full-text search + facets for each of those, a decade timeline, and entity pages.', 'search'],
    ['Identify the source institution', 'Every result shows the holder — and, when different, the catalogue it was found in.', 'institutions'],
    ['Explain where and how it can be accessed', 'Access status + instructions + visitor address on every record and entity page.', 'institutions'],
    ['Link to the authoritative record', 'Every record button opens the source institution\'s own page.', 'search'],
    ['Preserve provenance', 'Step-by-step provenance log + original harvested metadata on each record.', 'r/nsa-africanns-26'],
    ['AI-assisted search grounded in source records, no invented information', 'Ask a question: answers are built only from retrieved records, with a numbered citation on every line; optional Claude mode drops any sentence without a citation.', 'search?ask=Where%20can%20I%20see%20records%20about%20Viola%20Desmond%3F'],
    ['Institution or location views', 'Institutions directory + map of places (CGNDB coordinates only) and holders.', 'map'],
    ['Relationship mapping', 'Knowledge graph of people, places, organizations, events, topics; curated relations carry evidence.', 'graph'],
    ['Index or reference — not copy collections', 'Only metadata and links are held; thumbnails display from the source servers.', 'how'],
    ['Sustainable for a small organization', 'New sources join through a CSV mapping screen; keyword links wait for curator review rather than being trusted.', 'how?tab=import']
  ];
  return `<div class="wrap">
    <div class="sec-head"><h1 class="h1-sm">The brief → what this proves</h1><p class="muted">RBC HubHacks · Problem Statement 1 · Black Cultural Centre for Nova Scotia</p></div>
    <blockquote class="quote big">How might BCCNS create a trusted, scalable national Black History Knowledge Hub … while preserving the ownership, attribution and authority of each source institution, directing users to where the material is actually held, and making fragmented information easier to find, understand and connect?</blockquote>
    <table class="brief">${rows.map(([a, b, l]) => `<tr><td><b>${h(a)}</b></td><td>${h(b)}</td><td><a href="#/${l}">See it →</a></td></tr>`).join('')}</table>
    <h3>Known limits of this proof of concept</h3>
    <ul class="facts">
      <li>A one-day harvest snapshot (${FEEDS.nsa.harvested}) of selected result pages — not a live sync. A production hub would re-harvest on a schedule (OAI-PMH, APIs or CSV drops) and record each run.</li>
      <li>People and topics are found by name/keyword matching. Names are matched exactly as spelled; topics stay "suggested" until a curator confirms.</li>
      <li>Some holder institutions' visitor details are not confirmed and are marked so.</li>
      <li>Curator decisions and CSV imports live in this browser only; there is no login.</li>
    </ul></div>`;
}

/* ═══ 6. WIDGETS ═══════════════════════════════════════════════════ */

/* Featured carousel — rotates every 6 s */
function mountCarousel() {
  const el = $('#carousel'); if (!el) return;
  const items = FEATURED.filter(f => node(f.id) && recsOf(f.id).length);
  let i = 0, timer = 0;
  el.innerHTML = `<div class="car-track">${items.map((f, k) => {
    const n = node(f.id), recs = recsOf(f.id), st = (n.statements || [])[0];
    return `<a class="slide ${k === 0 ? 'on' : ''} ${f.img ? 'has-img' : 'type-only'} t-${n.type}" href="${href('e/' + f.id)}" aria-hidden="${k !== 0}">
      ${f.img ? `<img src="${h(f.img)}" alt="" onerror="this.closest('.slide').classList.replace('has-img','type-only');this.remove()">` : ''}
      <div class="slide-txt"><span class="kicker">${h(f.kicker)}</span><h3>${h(n.name)}</h3>
        <p class="sl-meta">${recs.length} records · ${new Set(recs.map(r => r.holder)).size} institution(s) · ${span(recs)}</p>
        ${st ? `<p class="sl-q">“${h(st[0].length > 170 ? st[0].slice(0, 168) + '…' : st[0])}” <small>— ${h(st[1])}</small></p>` : `<p class="sl-q">${h(recs[0].title)}</p>`}
        <span class="sl-cta">Explore →</span>
        ${f.imgCredit ? `<small class="sl-credit">Image: ${h(f.imgCredit)} (shown from source)</small>` : ''}</div></a>`;
  }).join('')}</div>
  <div class="car-ctl"><button aria-label="Previous" data-d="-1">‹</button>${items.map((_, k) => `<button class="dotb ${k === 0 ? 'on' : ''}" data-k="${k}" aria-label="Slide ${k + 1}"></button>`).join('')}<button aria-label="Next" data-d="1">›</button></div>`;
  const show = k => {
    i = (k + items.length) % items.length;
    $$('.slide', el).forEach((s, j) => { s.classList.toggle('on', j === i); s.setAttribute('aria-hidden', j !== i); });
    $$('.dotb', el).forEach((d, j) => d.classList.toggle('on', j === i));
  };
  $$('.car-ctl button', el).forEach(b => b.onclick = () => { show(b.dataset.k != null ? +b.dataset.k : i + +b.dataset.d); restart(); });
  const restart = () => { clearInterval(timer); timer = setInterval(() => { if (!carouselShouldPause(el)) show(i + 1); }, 6000); };
  restart();
  CLEANUP.push(() => clearInterval(timer));
}
/* ─── DAVID'S PIECE ──────────────────────────────────────────────────
   The carousel never pauses right now, even when someone is reading a
   slide. Make this return true when it SHOULD pause, for example:
     • the mouse is over the carousel        (hint: el.matches(':hover'))
     • keyboard focus is inside it           (hint: el.contains(document.activeElement))
     • the browser tab is hidden             (hint: document.hidden)
     • the user prefers reduced motion       (hint: matchMedia('(prefers-reduced-motion: reduce)').matches)
   One line with || between the checks is enough.                       */
function carouselShouldPause(el) {
  return false;
}

/* Decade histogram; drag across bars to choose a range */
function mountTimeline(el, recs, onPick) {
  if (!el) return;
  const dated = recs.filter(r => r.dateStart != null);
  if (!dated.length) { el.innerHTML = '<p class="muted small">No dated records.</p>'; return; }
  const d0 = Math.floor(Math.min(...dated.map(r => r.dateStart)) / 10) * 10, d1 = Math.floor(Math.max(...dated.map(r => r.dateStart)) / 10) * 10;
  const bins = []; for (let d = d0; d <= d1; d += 10) bins.push({ d, n: dated.filter(r => Math.floor(r.dateStart / 10) * 10 === d).length });
  const max = Math.max(...bins.map(b => b.n));
  el.innerHTML = `<div class="tl-bars">${bins.map(b => `<button class="bar" data-d="${b.d}" title="${b.d}s: ${b.n} record(s)" style="--h:${b.n ? Math.max(6, 100 * b.n / max) : 0}%"><span></span></button>`).join('')}</div>
    <div class="tl-axis"><span>${d0}s</span><span>${Math.round((d0 + d1) / 20) * 10}s</span><span>${d1}s</span></div>`;
  let start = null;
  $$('.bar', el).forEach(b => {
    b.onpointerdown = () => { start = +b.dataset.d; b.classList.add('sel'); };
    b.onpointerenter = () => { if (start == null) return; const a = Math.min(start, +b.dataset.d), z = Math.max(start, +b.dataset.d); $$('.bar', el).forEach(x => x.classList.toggle('sel', +x.dataset.d >= a && +x.dataset.d <= z)); };
    b.onpointerup = () => { if (start == null) return; const a = Math.min(start, +b.dataset.d), z = Math.max(start, +b.dataset.d) + 9; start = null; onPick(a, z); };
  });
}

/* Leaflet map of records → places (circles) + holders (squares) */
function mountRecordsMap(el, recs, opt = {}) {
  if (!el) return;
  if (!window.L) {
    el.innerHTML = '<div class="map-off">The bundled Leaflet library did not initialize. Please reload the page.</div>';
    return;
  }
  const map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
  let active = true;
  CLEANUP.push(() => { active = false; map.remove(); });
  const tileSources = [
    { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors', options: { maxZoom: 19 } },
    { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '© OpenStreetMap contributors © CARTO', options: { maxZoom: 19 } }
  ];
  const status = document.createElement('div');
  status.className = 'map-tile-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  el.appendChild(status);
  let tileLayer = null;
  let sourceIndex = 0;
  let failedTiles = 0;
  let loadedTiles = 0;
  const useTileSource = index => {
    if (!active) return;
    if (tileLayer) map.removeLayer(tileLayer);
    sourceIndex = index;
    failedTiles = 0;
    loadedTiles = 0;
    status.hidden = true;
    const source = tileSources[index];
    tileLayer = L.tileLayer(source.url, { ...source.options, attribution: source.attribution, crossOrigin: true });
    tileLayer.on('tileload', () => { loadedTiles++; status.hidden = true; });
    tileLayer.on('tileerror', () => {
      failedTiles++;
      if (!active || loadedTiles > 0 || failedTiles < 2) return;
      if (sourceIndex + 1 < tileSources.length) {
        useTileSource(sourceIndex + 1);
      } else {
        status.textContent = 'Map background could not load. Check your internet connection or network permissions. Location pins remain available.';
        status.hidden = false;
      }
    });
    tileLayer.addTo(map);
  };
  useTileSource(0);
  const bounds = [];
  // places
  const byPlace = new Map();
  for (const r of recs) for (const p of (r.mapped || []).filter(p => Number.isFinite(PLACES[p]?.lat) && Number.isFinite(PLACES[p]?.lng))) { if (!byPlace.has(p)) byPlace.set(p, []); byPlace.get(p).push(r); }
  const holders = new Map();
  for (const r of recs) { const k = r.holder; if (!holders.has(k)) holders.set(k, []); holders.get(k).push(r); }
  if (opt.institutionsOnly) for (const k of Object.keys(INSTITUTIONS)) holders.set(k, recsOf(k));
  // lines first (underneath)
  if (opt.lines) for (const [p, rs] of byPlace) {
    const P = PLACES[p];
    for (const k of new Set(rs.map(r => r.holder))) { const I = INSTITUTIONS[k], ip = PLACES[I?.place]; if (Number.isFinite(ip?.lat) && Number.isFinite(ip?.lng) && (ip.lat !== P.lat || ip.lng !== P.lng)) L.polyline([[P.lat, P.lng], [ip.lat, ip.lng]], { color: '#a87f19', weight: 1.4, opacity: .55, dashArray: '4 5' }).addTo(map); }
  }
  for (const [p, rs] of byPlace) {
    const P = PLACES[p];
    const m = L.circleMarker([P.lat, P.lng], { radius: 6 + Math.sqrt(rs.length) * 3.2, color: '#fff', weight: 2, fillColor: p === opt.focusPlace ? '#951814' : '#166411', fillOpacity: .85 }).addTo(map);
    m.bindPopup(`<div class="pop"><b><a href="${href('e/' + p)}">${h(P.name)}</a></b><div class="muted small">${rs.length} record(s) · CGNDB <a href="${CGNDB(P.cgndb)}" target="_blank" rel="noopener">${P.cgndb}</a></div>
      <ul>${rs.slice(0, 6).map(r => `<li><a href="${href('r/' + r.id)}">${h(r.title.slice(0, 70))}</a> <span class="muted">${h(r.dateText || '')}</span></li>`).join('')}</ul>
      ${rs.length > 6 ? `<a href="${href('search', { place: p })}">All ${rs.length} →</a>` : ''}${P.note ? `<div class="muted small">${h(P.note)}</div>` : ''}</div>`);
    m.bindTooltip(`${P.name} · ${rs.length}`);
    bounds.push([P.lat, P.lng]);
  }
  // institutions (squares)
  const sq = L.divIcon({ className: 'inst-icon', html: '<span></span>', iconSize: [16, 16], iconAnchor: [8, 8] });
  const placed = new Map();
  for (const [k, rs] of holders) {
    const I = INSTITUTIONS[k], ip = PLACES[I?.place]; if (!Number.isFinite(ip?.lat) || !Number.isFinite(ip?.lng)) continue;
    const off = placed.get(I.place) || 0; placed.set(I.place, off + 1);   // nudge institutions sharing a city
    const ll = [ip.lat + off * 0.012, ip.lng + off * 0.018];
    L.marker(ll, { icon: sq }).addTo(map).bindPopup(`<div class="pop"><b><a href="${href('e/' + k)}">${h(I.name)}</a></b><div class="small">${h(I.address || 'Address not confirmed')}</div><div class="muted small">${h(I.access)}</div><div class="small">${rs.length} record(s) here</div><div class="muted small">Pin = ${h(ip.name)} community point, not the building.</div></div>`)
      .bindTooltip(I.name);
    bounds.push(ll);
  }
  const pb = [...byPlace.keys()].map(p => [PLACES[p].lat, PLACES[p].lng]);   // frame the places; far-away holders show as lines running off-map
  if (pb.length > 1) map.fitBounds(pb, { padding: [40, 40], maxZoom: 11 });
  else if (pb.length === 1) map.setView(pb[0], 10);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
  else if (bounds.length === 1) map.setView(bounds[0], 10);
  else map.setView([44.9, -63.5], 7);
  requestAnimationFrame(() => { if (active) map.invalidateSize(); });
  const sizeTimer = setTimeout(() => { if (active) map.invalidateSize(); }, 180);
  CLEANUP.push(() => clearTimeout(sizeTimer));
}

/* Build graph nodes/edges, then mount the canvas graph with its panel */
function graphData({ records = RECORDS, withRecords = false } = {}) {
  const rset = new Set(records.map(r => r.id));
  const count = new Map();
  for (const r of records) for (const l of linksOf(r)) count.set(l.id, (count.get(l.id) || 0) + 1);
  for (const r of records) count.set(r.holder, (count.get(r.holder) || 0) + 1);
  const nodes = [], edges = [];
  for (const [id, c] of count) { const n = node(id); if (n) nodes.push({ id, label: n.name, type: n.type, r: Math.min(18, 4.5 + Math.sqrt(c) * 1.9), count: c }); }
  for (const [a, rel, b] of RELATIONS) if (count.has(a) || count.has(b)) {
    for (const x of [a, b]) if (!count.has(x) && node(x)) { count.set(x, 0); nodes.push({ id: x, label: node(x).name, type: node(x).type, r: 5, count: 0 }); }
    edges.push({ s: a, t: b, kind: 'rel', label: rel, w: 2 });
  }
  // co-mention edges, computed over the given records only
  const co = new Map();
  for (const r of records) { const ids = linksOf(r).map(l => l.id); for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = [ids[i], ids[j]].sort().join('|'); co.set(k, (co.get(k) || 0) + 1); } }
  for (const [k, w] of co) { const [a, b] = k.split('|'); const topicish = node(a)?.type === 'topic' || node(b)?.type === 'topic'; if (!edges.some(e => (e.s === a && e.t === b) || (e.s === b && e.t === a))) edges.push({ s: a, t: b, kind: 'co', w: topicish ? .35 : Math.min(w, 3), label: `${w} shared record${w > 1 ? 's' : ''}` }); }
  // entity → holding institution
  const held = new Map();
  for (const r of records) for (const l of linksOf(r)) if (l.kind !== 'topic') { const k = l.id + '|' + r.holder; held.set(k, (held.get(k) || 0) + 1); }
  for (const [k, w] of held) { const [a, b] = k.split('|'); edges.push({ s: a, t: b, kind: 'co', w: .25, label: `held by (${w})` }); }
  if (withRecords) for (const r of records) {
    nodes.push({ id: r.id, label: r.title, type: 'record', r: 3.2, count: 1 });
    for (const l of linksOf(r)) edges.push({ s: r.id, t: l.id, kind: 'co', w: .5 });
    edges.push({ s: r.id, t: r.holder, kind: 'co', w: .4 });
  }
  return { nodes, edges, rset };
}

function mountGraph(el, opt = {}) {
  if (!el) return;
  let withRecords = false, types = new Set(['person', 'place', 'organization', 'event', 'topic', 'institution', 'record']);
  el.innerHTML = `
    <div class="g-tools">
      <input class="g-search" placeholder="Search the graph…" aria-label="Search the graph">
      <div class="g-legend">${Object.entries(TYPE_STYLE).filter(([t]) => t !== 'record').map(([t, s]) => `<label><input type="checkbox" data-t="${t}" checked><span class="dot" style="background:${s.color}"></span>${s.label}</label>`).join('')}
        ${opt.full ? `<label><input type="checkbox" class="g-recs"> Show records</label>` : ''}</div>
    </div>
    <div class="g-stage"><canvas></canvas><div class="g-panel" hidden></div></div>`;
  const canvas = $('canvas', el), panel = $('.g-panel', el);
  canvas.style.height = (opt.height || 500) + 'px';
  let g;
  const build = () => {
    g && g.destroy();
    let data = graphData({ records: opt.records || RECORDS, withRecords });
    if (opt.ego && opt.focus) {          // only the focus node + 2 steps out, trimmed
      const keep = new Set([opt.focus]);
      const n1 = data.edges.filter(e => e.s === opt.focus || e.t === opt.focus).sort((a, b) => (b.kind === 'rel') - (a.kind === 'rel') || b.w - a.w).slice(0, 16);
      n1.forEach(e => { keep.add(e.s); keep.add(e.t); });
      data = { nodes: data.nodes.filter(n => keep.has(n.id)), edges: data.edges.filter(e => keep.has(e.s) && keep.has(e.t)) };
    }
    g = createGraph(canvas, {
      nodes: data.nodes, edges: data.edges, repulsion: opt.ego ? 1400 : 2600, spread: opt.ego ? .9 : 1.15, allLabels: !!opt.ego,
      onClick: n => showPanel(n), onOpen: n => n.type === 'record' ? go('r/' + n.id) : go('e/' + n.id)
    });
    g.setFilter(n => types.has(n.type));
    if (opt.focus && !opt.ego) setTimeout(() => g.focus(opt.focus), 50);
    CLEANUP.push(() => g.destroy());
  };
  function showPanel(n) {
    if (!n) { panel.hidden = true; return; }
    panel.hidden = false;
    if (n.type === 'record') { const r = REC.get(n.id); panel.innerHTML = `<b>${h(r.title)}</b><div class="muted small">${h(r.dateText)} · ${h(instName(r.holder))}</div><a href="${href('r/' + r.id)}">Open record →</a>`; return; }
    const N = node(n.id), recs = recsOf(n.id), nb = [...g.neighbours(n.id)].map(node).filter(Boolean);
    panel.innerHTML = `<span class="kind t-${N.type}">${typeLabel(N.type)}</span><b class="p-title">${h(N.name)}</b>
      <div class="muted small">${recs.length} record(s) · ${span(recs)}</div>
      ${(N.statements || [])[0] ? `<p class="small">“${h(N.statements[0][0].slice(0, 160))}…”</p>` : ''}
      <div class="small"><b>Connected to ${nb.length}:</b> ${nb.slice(0, 8).map(x => h(x.name)).join(' · ')}${nb.length > 8 ? '…' : ''}</div>
      <a class="btn-main sm" href="${href('e/' + n.id)}">Open page →</a>`;
  }
  build();
  $$('.g-legend input[data-t]', el).forEach(c => c.onchange = () => { c.checked ? types.add(c.dataset.t) : types.delete(c.dataset.t); g.setFilter(n => types.has(n.type)); });
  const rc = $('.g-recs', el); if (rc) rc.onchange = () => { withRecords = rc.checked; build(); };
  $('.g-search', el).oninput = e => {
    const q = norm(e.target.value).trim();
    if (q.length < 2) { g.highlight(null); return; }
    const hits = new Set(graphData({ records: opt.records || RECORDS, withRecords }).nodes.filter(n => norm(n.label).includes(q) || (node(n.id)?.aliases || []).some(a => norm(a).includes(q))).map(n => n.id));
    g.highlight(hits);
  };
}

/* ═══ 7. ASK — grounded question answering ═════════════════════════ */
const TYPE_WORDS = [[/photo|picture|image/i, ['Photograph', 'Photograph collection']], [/letter|correspond/i, ['Correspondence']], [/map|plan/i, ['Map / plan / view']], [/court|legal|affidavit/i, ['Court record', 'Legal / government document']],
  [/newspaper|advert|clipping/i, ['Newspaper item']], [/object|artifact|artefact|medal|badge|quilt/i, ['Museum object']], [/stamp/i, ['Stamp / philatelic record']], [/film|video/i, ['Moving image']], [/list|register|census|return/i, ['List / register', 'Register (copy)']], [/book/i, ['Book']], [/municipal|council|series/i, ['Record series (municipal)']]];
const INST_WORDS = { nsa: /nova scotia archives|\bnsa\b|provincial archives/i, lac: /library and archives|\blac\b|national archives of canada/i, cwm: /war museum|\bcwm\b/i, hma: /municipal archives|halifax archives|\bhma\b/i, bccns: /black cultural centre|bccns/i };

function parseQuestion(q) {
  const found = [];
  const ids = [...Object.keys(ENTITIES), ...Object.keys(PLACES)];
  let rest = ' ' + q + ' ';
  // longest names first so "North Preston" wins over "Preston"
  const cands = ids.flatMap(id => [node(id).name, ...(node(id).aliases || [])].filter(a => a && a.length > 3).map(a => [id, a])).sort((a, b) => b[1].length - a[1].length);
  for (const [id, a] of cands) {
    const re = new RegExp('\\b' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/^'|'$/g, '') + '\\b', 'i');
    if (re.test(rest) && ENT_RECS.get(id)?.size) { if (!found.includes(id)) found.push(id); rest = rest.replace(re, ' '); }
  }
  let from = null, to = null, m;
  if ((m = q.match(/between\s+(\d{4})\s+and\s+(\d{4})/i))) { from = +m[1]; to = +m[2]; }
  else if ((m = q.match(/(?:before|until|prior to)\s+(\d{4})/i))) to = +m[1] - 1;
  else if ((m = q.match(/(?:after|since)\s+(\d{4})/i))) from = +m[1] + 1;
  else if ((m = q.match(/\b(1[6-9]\d0|20[0-2]0)s\b/))) { from = +m[1]; to = +m[1] + 9; }
  else if ((m = q.match(/\bin\s+(1[6-9]\d\d|20[0-2]\d)\b/))) { from = to = +m[1]; }
  const types = TYPE_WORDS.filter(([re]) => re.test(q)).flatMap(([, t]) => t);
  const insts = Object.keys(INST_WORDS).filter(k => INST_WORDS[k].test(q));
  const intent = /where|held|hold|visit|access|see (them|it|the)|view/i.test(q) ? 'where' : /^\s*(who|which people)|people|person|named/i.test(q) ? 'who' : /^\s*when|what year|how old|date/i.test(q) ? 'when' : /how many|number of|count/i.test(q) ? 'count' : 'what';
  const leftover = tok(rest.replace(/\b(1[6-9]\d\d|20\d\d)s?\b/g, ' ')).filter(t => !/^(photo|photos|photograph|photographs|picture|pictures|letters?|maps?|records?|documents?|see|held|hold|visit|access|named|people|person|before|after|between|since|until|many|number|year|years|tell|know|anything|information|info|nova|scotia|black|history)$/.test(t) && !TYPE_WORDS.some(([re]) => re.test(t)));
  return { found, from, to, types, insts, intent, leftover };
}

function retrieve(pq) {
  let pool = RECORDS;
  if (pq.found.length) {
    const and = pool.filter(r => pq.found.every(id => linksOf(r).some(l => l.id === id) || r.holder === id));
    pool = and.length ? and : pool.filter(r => pq.found.some(id => linksOf(r).some(l => l.id === id)));
  }
  if (pq.from != null) pool = pool.filter(r => r.dateEnd != null && r.dateEnd >= pq.from);
  if (pq.to != null) pool = pool.filter(r => r.dateStart != null && r.dateStart <= pq.to);
  if (pq.types.length) pool = pool.filter(r => pq.types.includes(r.resourceType));
  if (pq.insts.length) pool = pool.filter(r => pq.insts.includes(r.holder) || pq.insts.includes(r.provider));
  let scored = pool.map(r => ({ r, s: pq.leftover.length ? scoreDoc(SEARCH_DOCS.find(d => d.r === r), pq.leftover.filter(t => t.length > 2)) : 1 }));
  if (!pq.found.length) scored = scored.filter(x => x.s > 0);       // nothing named → need keyword evidence
  return scored.sort((a, b) => b.s - a.s || (a.r.dateStart ?? 9999) - (b.r.dateStart ?? 9999)).map(x => x.r);
}

function composeAnswer(q) {
  const pq = parseQuestion(q), hits = retrieve(pq);
  const cites = [];
  const cite = r => { let i = cites.indexOf(r); if (i < 0) { cites.push(r); i = cites.length - 1; } return `<a class="cite" href="${href('r/' + r.id)}" title="${h(r.title)}">[${i + 1}]</a>`; };
  const understood = [...pq.found.map(id => chip(id)), pq.from || pq.to ? `<span class="chip">${pq.from ?? '…'}–${pq.to ?? '…'}</span>` : '', ...[...new Set(pq.types)].slice(0, 2).map(t => `<span class="chip">${h(t)}</span>`), ...pq.insts.map(k => `<span class="chip t-institution">${h(instName(k))}</span>`)].filter(Boolean).join(' ');
  const lines = [];
  if (!hits.length) {
    const near = entityMatches(pq.leftover.join(' '), 5);
    return { html: `<p><b>No indexed record answers that.</b> I won't guess or fill the gap from general knowledge.</p>
      ${understood ? `<p class="muted small">I understood: ${understood}</p>` : ''}
      ${pq.leftover.length ? `<p class="muted small">No record mentions: ${pq.leftover.map(t => `<code>${h(t)}</code>`).join(' ')}</p>` : ''}
      ${near.length ? `<p>Closest pages: ${near.map(x => chip(x.id)).join(' ')}</p>` : ''}`, cites: [], hits, pq };
  }
  const holders = [...new Set(hits.map(r => r.holder))];
  lines.push(`I found <b>${hits.length}</b> record${hits.length > 1 ? 's' : ''} held by <b>${holders.length}</b> institution${holders.length > 1 ? 's' : ''}${understood ? ` for ${understood}` : ''}.`);
  const top = hits.slice(0, 6);
  if (pq.intent === 'where') {
    for (const k of holders.slice(0, 5)) {
      const rs = hits.filter(r => r.holder === k), I = INSTITUTIONS[k];
      const online = rs.filter(r => /^Online/.test(r.access.status)).length;
      lines.push(`<b>${h(I.name)}</b> holds ${rs.length} of them${online ? ` (${online} viewable online)` : ''}. ${I.address ? 'Visit: ' + h(I.address) + '. ' : ''}${h(I.access)} ${rs.slice(0, 3).map(cite).join('')}`);
    }
  } else if (pq.intent === 'when') {
    const dated = hits.filter(r => r.dateStart != null).sort((a, b) => a.dateStart - b.dateStart);
    if (dated.length) {
      lines.push(`The earliest is “${h(dated[0].title)}”, dated <b>${h(dated[0].dateText)}</b> ${cite(dated[0])}.`);
      if (dated.length > 1) lines.push(`The latest is “${h(dated.at(-1).title)}”, dated <b>${h(dated.at(-1).dateText)}</b> ${cite(dated.at(-1))}.`);
    }
    if (hits.length - dated.length) lines.push(`${hits.length - dated.length} of them have no date in the source.`);
  } else if (pq.intent === 'who') {
    const ppl = new Map();
    for (const r of hits) for (const l of linksOf(r)) if (l.kind === 'person' && !pq.found.includes(l.id)) { if (!ppl.has(l.id)) ppl.set(l.id, r); }
    lines.push(ppl.size ? `People named in these records: ${[...ppl].slice(0, 10).map(([id, r]) => `${chip(id)}${cite(r)}`).join(', ')}.` : 'These records do not name any person the hub recognises.');
  } else if (pq.intent === 'count') {
    const byT = {}; for (const r of hits) (byT[r.resourceType] = byT[r.resourceType] || []).push(r);
    lines.push(Object.entries(byT).map(([t, rs]) => `${rs.length} × ${h(t)} ${cite(rs[0])}`).join('; ') + '.');
  }
  if (pq.intent !== 'who' && pq.intent !== 'count') for (const r of top.slice(0, pq.intent === 'what' ? 6 : 3))
    lines.push(`“${h(r.title)}” (${h(r.dateText || 'no date')}) — ${h(r.resourceType.toLowerCase())}, held by ${h(instName(r.holder))} ${cite(r)}`);
  const places = [...new Set(hits.flatMap(r => r.mapped))];
  if (places.length) lines.push(`Places named: ${places.slice(0, 8).map(p => chip(p)).join(' ')}.`);
  const ctx = pq.found.flatMap(id => (node(id).statements || []).slice(0, 1).map(s => [id, s]));
  return {
    html: `<ul class="ans">${lines.map(l => `<li>${l}</li>`).join('')}</ul>
      ${ctx.length ? `<div class="ans-ctx"><b>Context, quoted from sources:</b>${ctx.map(([id, [t, l, u]]) => `<blockquote class="quote sm">“${h(t)}” <cite>— <a href="${h(u)}" target="_blank" rel="noopener">${h(l)} ↗</a></cite></blockquote>`).join('')}</div>` : ''}`,
    cites, hits, pq
  };
}

let LLM = { key: '', model: 'claude-sonnet-4-5' };     // key kept in memory only — never saved
function viewAsk(p) {
  const a = composeAnswer(p.ask);
  onMount(bindSearchBox);
  onMount(() => {
    const f = $('#llm-form'); if (!f) return;
    f.onsubmit = async e => {
      e.preventDefault();
      LLM.key = f.key.value.trim() || LLM.key; LLM.model = f.model.value.trim() || LLM.model;
      if (!LLM.key) return;
      const out = $('#llm-out'); out.innerHTML = '<p class="muted">Asking Claude, with only the numbered records below as its material…</p>';
      try { out.innerHTML = await askClaude(p.ask, a.cites.length ? a.cites : a.hits.slice(0, 12)); }
      catch (err) { out.innerHTML = `<p class="warn">Claude request failed: ${h(err.message)}. The grounded answer above is unaffected.</p>`; }
    };
  });
  return `<div class="wrap ask-page">
    <div class="search-top">${searchBox(p.ask, 'ask')}</div>
    <div class="ask-grid">
      <section class="card answer">
        <p class="eyebrow dark">Grounded answer</p>
        <h2 class="ask-q">${h(p.ask)}</h2>
        ${a.html}
        <p class="ground-note">Every line above is assembled from the numbered records' own fields. Nothing is written from general knowledge.</p>
        <details class="llm"><summary>Optional: have Claude phrase it (your API key, sent only to Anthropic)</summary>
          <form id="llm-form" class="llm-form"><input name="key" type="password" placeholder="Anthropic API key (kept in memory, not saved)" value="${h(LLM.key)}" autocomplete="off"><input name="model" value="${h(LLM.model)}" aria-label="Model"><button class="btn-main sm">Ask Claude</button></form>
          <p class="muted small">Claude only sees the records cited below. Any sentence it writes without a valid [n] citation is removed before you see it.</p>
          <div id="llm-out"></div></details>
      </section>
      <aside class="card">
        <h2 class="h-sm">Sources used (${a.cites.length})</h2>
        <ol class="srcs">${a.cites.map(r => `<li><a href="${href('r/' + r.id)}">${h(r.title)}</a><div class="muted small">${h(r.dateText || 'n.d.')} · ${h(instName(r.holder))} · <a href="${h(r.url)}" target="_blank" rel="noopener">authoritative record ↗</a></div></li>`).join('')}</ol>
        ${a.hits.length > a.cites.length ? `<a class="btn-ghost" href="${href('search', { q: [...a.pq.found.map(nameOf), ...a.pq.leftover].join(' '), from: a.pq.from ?? '', to: a.pq.to ?? '' })}">All ${a.hits.length} matching records →</a>` : ''}
      </aside>
    </div></div>`;
}

async function askClaude(question, recs) {
  const context = recs.map((r, i) => `[${i + 1}] ${JSON.stringify({ title: r.title, date: r.dateText, type: r.resourceType, holder: instName(r.holder), description: r.description, reference: r.reference, collection: r.collection, access: r.access.note, people_places_topics: linksOf(r).map(l => nameOf(l.id)) })}`).join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': LLM.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: LLM.model, max_tokens: 700, system: 'You answer questions for a Black history discovery hub. Use ONLY the numbered records provided. Every sentence must end with one or more citations like [2]. If the records do not answer the question, say so plainly. Never add facts, dates, names or interpretation that are not in the records. Plain language, under 150 words.',
      messages: [{ role: 'user', content: `Records:\n${context}\n\nQuestion: ${question}` }] })
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const text = (data.content || []).map(c => c.text || '').join(' ');
  // grounding check: keep only sentences that cite a record we actually sent
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const kept = [], dropped = [];
  for (const s of sentences) {
    const nums = [...s.matchAll(/\[(\d+)\]/g)].map(m => +m[1]);
    (nums.length && nums.every(n => n >= 1 && n <= recs.length) ? kept : dropped).push(s);
  }
  const linked = kept.map(s => h(s).replace(/\[(\d+)\]/g, (_, n) => `<a class="cite" href="${href('r/' + recs[n - 1].id)}">[${n}]</a>`));
  return `<div class="llm-ans"><p>${linked.join(' ') || '<i>Claude gave no cited sentences.</i>'}</p>
    <p class="muted small">Grounding check: ${kept.length} sentence(s) kept${dropped.length ? `, <b>${dropped.length} removed</b> for missing or invalid citations` : ''}. Citation numbers refer to the Sources list.</p></div>`;
}

/* ═══ BOOT ═════════════════════════════════════════════════════════ */
function boot() {
  buildIndex();
  const hq = $('#hdr-q');
  $('#hdr-search').onsubmit = e => { e.preventDefault(); if (hq.value.trim()) go('search', { q: hq.value.trim() }); };
  render();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
