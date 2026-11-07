/* =====================================================================
   views.js — the public screens
   ---------------------------------------------------------------------
   home · browse · search (+ mini graph) · entity page · record · map ·
   institutions · suggest a resource
   Rule of thumb for this file: one job per screen, few things at once,
   every record shows who holds it and links to the original.
   ===================================================================== */

/* ---------- small building blocks ---------- */
const TYPE_NAME = { person: 'Person', place: 'Place', organization: 'Organization', event: 'Event', topic: 'Topic', institution: 'Institution' };
const PLURAL = { person: 'People', place: 'Places and communities', organization: 'Organizations', event: 'Events and meetings', topic: 'Topics', institution: 'Institutions' };
const typeLabel = t => TYPE_NAME[t] || t;
const tag = (id, extra = '') => { const n = node(id); if (!n) return ''; return `<a class="tag" href="${href('e/' + id)}">${h(n.name)}${extra}</a>`; };
const chip = tag;                                   // ask.js uses chip()
const dateLabel = r => r.dateText ? h(r.dateText) : 'Date not recorded';
const span = recs => { const ys = recs.flatMap(r => [r.dateStart, r.dateEnd]).filter(y => y != null); return ys.length ? (Math.min(...ys) === Math.max(...ys) ? `${Math.min(...ys)}` : `${Math.min(...ys)}–${Math.max(...ys)}`) : 'undated'; };
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const facetKeyFor = t => ({ person: 'person', place: 'place', organization: 'org', event: 'event', topic: 'topic', institution: 'holder' }[t] || 'topic');
/* "See it on the map" links: only when the place/institution really has a pin */
const hasPin = k => !!instLatLng(k);
const addressLink = k => { const I = INSTITUTIONS[k]; if (!I) return ''; const t = h(I.address || 'Address not confirmed');
  return hasPin(k) ? `<a class="addr" href="${href('map', { focus: 'i:' + k })}" title="Show ${h(I.name)} on the map">${t}</a>` : t; };
const ext = (url, label) => `<a class="ext" href="${h(url)}" target="_blank" rel="noopener">${label}<span aria-hidden="true"> ↗</span></a>`;

function recordRow(r) {
  return `<article class="rrow">
    ${r.image ? `<a class="rrow-img" href="${href('r/' + r.id)}" tabindex="-1"><img loading="lazy" src="${h(r.image)}" alt="" onerror="this.parentNode.remove()"></a>` : ''}
    <div class="rrow-body">
      <h3><a href="${href('r/' + r.id)}">${h(r.title)}</a></h3>
      <p class="meta">${h(r.resourceType)} · ${dateLabel(r)} · Held by ${h(instName(r.holder))}</p>
      ${r.description ? `<p class="rrow-desc">${h(r.description)}</p>` : ''}
      ${ext(r.url, `View original at ${h(instName(r.provider))}`)}
    </div></article>`;
}

/* ═══ HOME ═════════════════════════════════════════════════════════ */
function viewHome() {
  const nInst = new Set(RECORDS.map(r => r.holder)).size;
  const types = ['person', 'place', 'organization', 'event', 'topic', 'institution'];
  const cards = types.map(t => {
    const ids = browseIds(t);
    const sample = ids.slice(0, 3).map(nameOf).join(', ');
    return `<a class="bcard" href="${href('browse/' + t)}"><h3>${PLURAL[t]}</h3><p class="meta">${ids.length} with linked records</p><p class="bcard-sample">${h(sample)}</p></a>`;
  }).join('');
  onMount(mountCarousel);
  onMount(bindSearchBox);
  return `
  <section class="hero"><div class="wrap">
    <h1 class="display">Find Black history across Canada</h1>
    <p class="script">Our Stories, Connected</p>
    <p class="hero-lede">Search records held by archives, museums and community organizations. Every result takes you to the institution that holds the original.</p>
    ${searchBox('')}
    <p class="meta hero-count">${RECORDS.length} records from ${nInst} institutions</p>
  </div></section>
  <section class="wrap section">
    <h2>Featured</h2>
    <div id="carousel" class="carousel" aria-roledescription="carousel" aria-label="Featured"></div>
  </section>
  <section class="wrap section">
    <h2>Browse</h2>
    <div class="bgrid">${cards}</div>
  </section>
  <section class="wrap section map-cta">
    <div><h2>See it on a map</h2><p>Places named in the records, and where each record is held.</p></div>
    <a class="btn btn-secondary" href="${href('map')}">Open the full map</a>
  </section>`;
}
function browseIds(t) {
  const pool = t === 'place' ? Object.keys(PLACES) : t === 'institution' ? Object.keys(INSTITUTIONS) : Object.keys(ENTITIES).filter(i => ENTITIES[i].type === t && !ENTITIES[i].creator);
  return pool.filter(i => ENT_RECS.get(i)?.size).sort((a, b) => ENT_RECS.get(b).size - ENT_RECS.get(a).size);
}

/* ---------- search box (Search / Ask) ---------- */
function searchBox(q, mode = 'search') {
  const ex = mode === 'ask'
    ? ['Where can I see records about Viola Desmond?', 'Photographs of Upper Hammonds Plains', 'Who is named in records about Five Mile Plains?']
    : ['Africville', 'Preston', 'Viola Desmond', 'No. 2 Construction Battalion', '1946'];
  return `<form id="sbox" class="sbox" role="search">
    <div class="sbox-mode" role="tablist" aria-label="Search mode">
      <button type="button" role="tab" data-mode="search" aria-selected="${mode === 'search'}">Search</button>
      <button type="button" role="tab" data-mode="ask" aria-selected="${mode === 'ask'}">Ask a question</button>
    </div>
    <div class="sbox-row">
      <div class="sbox-field">
        <label class="sr-only" for="q">${mode === 'ask' ? 'Your question' : 'Search records'}</label>
        <input id="q" name="q" autocomplete="off" value="${h(q)}" placeholder="${mode === 'ask' ? 'Ask about a person, place or event' : 'People, places, communities, subjects, years'}"
          ${mode === 'search' ? 'role="combobox" aria-autocomplete="list" aria-controls="suggest" aria-expanded="false"' : ''}>
        <div id="suggest" class="suggest" role="listbox" hidden></div>
      </div>
      <button class="btn btn-primary" type="submit">${mode === 'ask' ? 'Ask' : 'Search'}</button>
    </div>
    <p class="sbox-ex">Try ${ex.map(x => `<button type="button" class="linklike" data-ex="${h(x)}">${h(x)}</button>`).join(', ')}</p>
  </form>`;
}
function bindSearchBox() {
  const f = $('#sbox'); if (!f) return;
  let mode = $('[aria-selected="true"]', f).dataset.mode;
  $$('.sbox-mode button', f).forEach(b => b.onclick = () => {
    if (b.dataset.mode === mode) return;
    const q = $('#q', f).value; f.outerHTML = searchBox(q, b.dataset.mode); bindSearchBox(); $('#q').focus();
  });
  f.onsubmit = e => { e.preventDefault(); const q = $('#q', f).value.trim(); if (!q) return; mode === 'ask' ? go('search', { ask: q }) : go('search', { q }); };
  $$('[data-ex]', f).forEach(b => b.onclick = () => { $('#q', f).value = b.dataset.ex; f.requestSubmit(); });
  const inp = $('#q', f), box = $('#suggest', f);
  if (mode !== 'search') return;
  attachSuggest(inp, box);
}

/* ---------- live suggestions under any search box ----------
   Used by the main search box and the header search.
   Click (or Enter on a highlighted row) goes straight to that page/record. */
function attachSuggest(inp, box) {
  if (!inp || !box) return;
  let active = -1;
  const mark = (text, q) => { const i = norm(text).indexOf(norm(q)); return i < 0 ? h(text) : h(text.slice(0, i)) + '<b>' + h(text.slice(i, i + q.length)) + '</b>' + h(text.slice(i + q.length)); };
  const close = () => { box.hidden = true; inp.setAttribute('aria-expanded', 'false'); active = -1; };
  const open = target => { close(); inp.blur(); location.hash = target; };
  inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-autocomplete', 'list'); inp.setAttribute('aria-controls', box.id);
  inp.oninput = () => {
    const q = inp.value.trim();
    if (q.length < 2) { close(); return; }
    const pages = entityMatches(q, 5);
    const recs = runSearch({ q }).slice(0, 4);
    if (!pages.length && !recs.length) { box.innerHTML = `<p class="sug-none">No matches for “${h(q)}”</p>`; box.hidden = false; return; }
    box.innerHTML = (pages.length ? `<p class="sug-h">Pages</p>${pages.map(x => `<a role="option" href="${href('e/' + x.id)}"><span>${mark(x.n.name, q)}</span><span class="meta">${typeLabel(x.n.type)}${x.count ? ' · ' + plural(x.count, 'record') : ''}</span></a>`).join('')}` : '')
      + (recs.length ? `<p class="sug-h">Records</p>${recs.map(r => `<a role="option" href="${href('r/' + r.id)}"><span>${mark(r.title, q)}</span><span class="meta">${h(r.dateText || '')}</span></a>`).join('')}` : '')
      + `<a role="option" class="sug-all" href="${href('search', { q })}">See all results for “${h(q)}”</a>`;
    box.hidden = false; inp.setAttribute('aria-expanded', 'true'); active = -1;
  };
  // pressing the mouse on the list must not blur the input (that used to close the list before the click landed)
  box.onmousedown = e => e.preventDefault();
  box.onclick = e => { const a = e.target.closest('a[role="option"]'); if (!a) return; e.preventDefault(); open(a.getAttribute('href')); };
  inp.onkeydown = e => {
    const opts = $$('a[role="option"]', box);
    if (box.hidden || !opts.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      opts.forEach((o, i) => o.classList.toggle('on', i === active));
      opts[active].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); open(opts[active].getAttribute('href')); }
    else if (e.key === 'Escape') close();
  };
  inp.onfocus = () => { if (inp.value.trim().length >= 2) inp.oninput(); };
  inp.onblur = () => setTimeout(close, 150);
}

/* ═══ BROWSE ═══════════════════════════════════════════════════════ */
function viewBrowse(type = 'person') {
  if (!PLURAL[type]) type = 'person';
  const ids = browseIds(type);
  return `<div class="wrap page">
    <nav class="subnav" aria-label="Browse by">${Object.keys(PLURAL).map(t => `<a href="${href('browse/' + t)}" ${t === type ? 'aria-current="page"' : ''}>${PLURAL[t]}</a>`).join('')}</nav>
    <h1>${PLURAL[type]}</h1>
    <div class="egrid">${ids.map(id => { const rs = recsOf(id); return `<a class="ecard" href="${href('e/' + id)}"><h2 class="h3">${h(nameOf(id))}</h2><p class="meta">${plural(rs.length, 'record')} · ${span(rs)}</p></a>`; }).join('')}</div>
  </div>`;
}

/* ═══ SEARCH ═══════════════════════════════════════════════════════ */
function viewSearch(_, p) {
  if (p.ask) return viewAsk(p);
  const hits = runSearch(p);
  const n = +(p.n || 20);
  const sel = (key, label, get, name) => {
    const counts = new Map();
    for (const r of hits) for (const v of new Set(get(r))) counts.set(v, (counts.get(v) || 0) + 1);
    if (p[key] && !counts.has(p[key])) counts.set(p[key], 0);
    const opts = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 25);
    return `<label class="fsel"><span>${label}</span><select data-k="${key}"><option value="">Any</option>${opts.map(([v, c]) => `<option value="${h(v)}" ${p[key] === v ? 'selected' : ''}>${h(name(v))} (${c})</option>`).join('')}</select></label>`;
  };
  const entityFilters = ['person', 'org', 'event', 'topic'].filter(k => p[k]);
  // the centre of the mini graph: the entity the query names, else the query itself
  const top = p.q ? entityMatches(p.q, 1).find(x => x.rank <= 1) : null;
  const focus = entityFilters.length ? p[entityFilters[0]] : (p.place || top?.id || null);
  onMount(bindSearchBox);
  onMount(() => {
    $$('.filters select').forEach(s => s.onchange = () => go('search', { ...p, [s.dataset.k]: s.value, n: '' }));
    const yf = $('#years'); if (yf) yf.onsubmit = e => { e.preventDefault(); go('search', { ...p, from: yf.from.value, to: yf.to.value }); };
    mountMiniGraph($('#mini-graph'), focus ? { focus } : { query: p.q, records: hits });
    mountRecordsMap($('#mini-map'), hits, { lines: false });
  });
  const mapped = hits.filter(r => r.mapped.length).length;
  return `<div class="wrap page search-page">
    ${searchBox(p.q || '')}
    <div class="filters">
      ${sel('holder', 'Held by', r => [r.holder], instName)}
      ${sel('type', 'Type', r => [r.resourceType], x => x)}
      ${sel('place', 'Place', r => r.places, nameOf)}
      <form id="years" class="fsel years"><span>Years</span><div><input name="from" inputmode="numeric" placeholder="From" value="${h(p.from || '')}" aria-label="From year"><input name="to" inputmode="numeric" placeholder="To" value="${h(p.to || '')}" aria-label="To year"><button class="btn btn-quiet" type="submit">Apply</button></div></form>
    </div>
    ${entityFilters.length ? `<p class="active-f">Showing records linked to ${entityFilters.map(k => `<a class="tag tag-x" href="${href('search', { ...p, [k]: '' })}" aria-label="Remove ${h(nameOf(p[k]))}">${h(nameOf(p[k]))} ×</a>`).join(' ')}</p>` : ''}
    <div class="search-cols">
      <section aria-live="polite">
        <p class="count">${plural(hits.length, 'result')}${p.q ? ` for “${h(p.q)}”` : ''}</p>
        ${!hits.length ? `<div class="empty"><h2>Nothing matches yet</h2><p>The hub only shows what institutions have described. Try fewer words or another spelling, or <a href="${href('search', { ask: p.q })}">ask it as a question</a>.</p></div>` : ''}
        <div class="rlist">${hits.slice(0, n).map(recordRow).join('')}</div>
        ${hits.length > n ? `<a class="btn btn-secondary more" href="${href('search', { ...p, n: n + 20, keep: 1 })}">Show more results</a>` : ''}
      </section>
      <aside class="side">
        <section class="panel">
          <h2 class="h3">${focus ? `Connected to ${h(nameOf(focus))}` : p.q ? `Connected to “${h(p.q)}”` : 'Connections'}</h2>
          <div id="mini-graph" class="mini-graph"></div>
          
        </section>
        <section class="panel">
          <h2 class="h3">On the map</h2>
          <div id="mini-map" class="map map-sm"></div>
          <p class="meta">${mapped} of ${hits.length} results have a place. <a href="${href('map', { q: p.q, holder: p.holder, place: p.place, from: p.from, to: p.to })}">Open the full map</a></p>
        </section>
      </aside>
    </div></div>`;
}

/* ═══ ENTITY PAGE (person · place · organization · event · topic · institution) ═══ */
function viewEntity(id) {
  const n = node(id);
  if (!n) return `<div class="wrap page"><h1>Not found</h1><p>There is no page for “${h(id)}”.</p></div>`;
  const recs = recsOf(id).sort((a, b) => (a.dateStart ?? 9999) - (b.dateStart ?? 9999));
  const holders = [...new Set(recs.map(r => r.holder))];
  const rels = RELATIONS.filter(r => r[0] === id || r[2] === id);
  const statements = n.statements || [];
  const kind = typeLabel(n.type) + (n.community ? ' · community' : '') + (n.meeting ? ' · meeting' : '');
  onMount(() => mountMiniGraph($('#ent-graph'), { focus: id }));
  onMount(() => mountRecordsMap($('#ent-map'), recs, { lines: true, focusPlace: PLACES[id]?.lat != null ? id : null }));
  const shown = 6;
  return `<div class="wrap page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${href('browse/' + (n.type === 'place' ? 'place' : n.type))}">${PLURAL[n.type] || 'Browse'}</a></nav>
    <h1>${h(n.name)}</h1>
    <p class="meta lead-meta">${PLACES[id]?.lat != null ? `<a href="${href('map', { focus: 'p:' + id })}">See ${h(n.name)} on the map</a> · ` : ''}${kind} · ${plural(recs.length, 'record')}${n.type === 'institution' ? '' : ' · ' + plural(holders.length, 'institution')} · ${span(recs)}</p>
    <div class="two">
      <div>
        ${statements.length ? `<section class="quotes">${statements.map(([t, l, u]) => `<blockquote><p>“${h(t)}”</p><footer>${ext(u, h(l))}</footer></blockquote>`).join('')}</section>` : ''}
        ${n.note ? `<p>${h(n.note)}</p>` : ''}
        ${n.type === 'institution' ? `<section class="panel"><h2 class="h3">Visiting</h2><p>${n.address ? addressLink(id) : 'Visitor address not confirmed.'}</p><p class="meta">${h(n.access || '')}</p>${n.web ? ext(n.web, h(n.web.replace(/^https?:\/\//, ''))) : ''}</section>` : ''}
        <section class="section-sm">
          <div class="row-between"><h2>Records</h2>${recs.length ? `<a href="${href('search', { [facetKeyFor(n.type)]: id })}">Search within these</a>` : ''}</div>
          ${recs.length ? `<div class="rlist">${recs.slice(0, shown).map(recordRow).join('')}</div>
            ${recs.length > shown ? `<details class="more-recs"><summary>Show ${recs.length - shown} more</summary><div class="rlist">${recs.slice(shown).map(recordRow).join('')}</div></details>` : ''}`
            : '<p>No records are linked yet.</p>'}
        </section>
      </div>
      <aside class="side">
        <section class="panel">
          <h2 class="h3">Directly connected</h2>
          <div id="ent-graph" class="mini-graph"></div>
          ${rels.length ? `<details class="rels-d"><summary>Sources for these connections</summary><ul class="rels">${rels.map(([a, label, b, el, eu]) => `<li>${a === id ? '' : tag(a) + ' '}<span>${h(label)}</span>${b === id ? '' : ' ' + tag(b)}<span class="meta"> Source: ${/^https?:/.test(eu) ? ext(eu, h(el)) : `<a href="${href('r/' + eu)}">${h(el)}</a>`}</span></li>`).join('')}</ul></details>` : ''}
        </section>
        ${holders.length && n.type !== 'institution' ? `<section class="panel"><h2 class="h3">Where to find it</h2>${holders.map(k => { const I = INSTITUTIONS[k]; return `<div class="where"><a href="${href('e/' + k)}">${h(I.name)}</a><p class="meta">${addressLink(k)}</p></div>`; }).join('')}</section>` : ''}
      </aside>
    </div>
    <section class="section-sm">
      <h2>Places connected to ${h(n.name)}</h2>
      <p class="meta">Green circles are places named in the records. Dark squares are where the records are held.</p>
      <div id="ent-map" class="map"></div>
    </section>
  </div>`;
}

/* ═══ RECORD ═══════════════════════════════════════════════════════ */
function viewRecord(id) {
  const r = REC.get(id);
  if (!r) return `<div class="wrap page"><h1>Record not found</h1></div>`;
  const I = INSTITUTIONS[r.holder];
  const subjects = publicLinks(r);
  const similar = RECORDS.filter(x => x !== r).map(x => [x, publicLinks(x).filter(l => l.kind !== 'topic' && subjects.some(m => m.id === l.id)).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 4);
  onMount(() => mountRecordsMap($('#rec-map'), [r], { lines: true }));
  return `<div class="wrap page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${href('e/' + r.holder)}">${h(instName(r.holder))}</a></nav>
    <div class="two">
      <div>
        <h1 class="rec-title">${h(r.title)}</h1>
        <p class="meta lead-meta">${h(r.resourceType)} · ${dateLabel(r)}${r.dateApprox ? ' (approximate)' : ''}</p>
        ${r.image ? `<figure class="rec-img"><img src="${h(r.image)}" alt="Preview of ${h(r.title)}" onerror="this.parentNode.remove()"><figcaption>Preview shown from ${h(instName(r.provider))}. ${h(r.imageCredit)}</figcaption></figure>` : ''}
        ${r.description ? `<p class="rec-desc">${h(r.description)}</p>` : ''}
        <p><a class="btn btn-primary" href="${h(r.url)}" target="_blank" rel="noopener">View original record<span aria-hidden="true"> ↗</span></a></p>
        <dl class="facts">
          <dt>Held by</dt><dd><a href="${href('e/' + r.holder)}">${h(instName(r.holder))}</a></dd>
          ${r.provider !== r.holder ? `<dt>Found through</dt><dd>${h(instName(r.provider))}</dd>` : ''}
          <dt>Date</dt><dd>${dateLabel(r)}</dd>
          <dt>Reference</dt><dd>${h(r.reference || 'Not recorded')}</dd>
          ${r.creator ? `<dt>Creator</dt><dd>${h(r.creator)}</dd>` : ''}
          <dt>Collection</dt><dd>${h(r.collection)}</dd>
          <dt>Access</dt><dd>${h(r.access.status)}. ${h(r.access.note)}</dd>
        </dl>
        ${subjects.length ? `<h2 class="h3">People, places and topics</h2><div class="tags">${subjects.map(l => tag(l.id)).join('')}</div>` : ''}
        <details class="prov"><summary>Provenance</summary><ol>${r.provenance.map(s => `<li>${h(s)}</li>`).join('')}</ol>
          <p class="meta">Original metadata as harvested:</p><pre>${h(JSON.stringify(r.native, null, 2))}</pre></details>
      </div>
      <aside class="side">
        ${I ? `<section class="panel"><h2 class="h3">Visit ${h(I.name)}</h2><p>${I.address ? addressLink(r.holder) : 'Visitor address not confirmed.'}</p><p class="meta">${h(I.access)}</p></section>` : ''}
        <section class="panel"><h2 class="h3">On the map</h2>${r.mapped.length ? '' : `<p class="meta">${r.places.length ? 'The place named is too broad to pin.' : 'No place recorded.'} Showing where it is held.</p>`}<div id="rec-map" class="map map-sm"></div></section>
        ${similar.length ? `<section class="panel"><h2 class="h3">Connected records</h2>${similar.map(([x]) => `<a class="sim" href="${href('r/' + x.id)}">${h(x.title)}<span class="meta">${h(x.dateText || 'Date not recorded')} · ${h(instName(x.holder))}</span></a>`).join('')}</section>` : ''}
      </aside>
    </div></div>`;
}

/* ═══ FULL MAP (linked from pages, not in the nav) ═════════════════ */
function viewMap(_, p) {
  const recs = runSearch({ ...p, focus: '' });
  const topics = Object.keys(ENTITIES).filter(i => ENTITIES[i].type === 'topic' && ENT_RECS.get(i)?.size);
  onMount(() => {
    mountRecordsMap($('#big-map'), recs, { lines: !!p.lines, focus: p.focus });
    $('#map-topic').onchange = e => go('map', { ...p, topic: e.target.value });
    $('#map-lines').onchange = e => go('map', { ...p, lines: e.target.checked ? 1 : '' });
  });
  return `<div class="wrap page">
    <h1>Map</h1>
    <p class="lead">Places named in ${plural(recs.length, 'record')}. Records without a confirmed place stay searchable without a pin.</p>
    <div class="filters">
      <label class="fsel"><span>Topic</span><select id="map-topic"><option value="">Any</option>${topics.map(t => `<option value="${t}" ${p.topic === t ? 'selected' : ''}>${h(nameOf(t))}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="map-lines" ${p.lines ? 'checked' : ''}> Show where records are held</label>
    </div>
    <div id="big-map" class="map map-xl"></div></div>`;
}

/* ═══ INSTITUTIONS ═════════════════════════════════════════════════ */
function viewInstitutions() {
  const list = Object.keys(INSTITUTIONS).filter(k => k !== 'csv' && k !== 'community').map(k => ({ k, I: INSTITUTIONS[k], held: recsOf(k).length })).filter(x => x.held || x.I.added).sort((a, b) => b.held - a.held);
  return `<div class="wrap page">
    <h1>Institutions</h1>
    <p class="lead">The archives, museums and organizations that hold the records, and how to reach them.</p>
    <div class="egrid wide">${list.map(({ k, I, held }) => `<div class="ecard"><h2 class="h3"><a class="card-link" href="${href('e/' + k)}">${h(I.name)}</a></h2><p class="meta">${h(I.kind)} · ${plural(held, 'record')}</p><p>${addressLink(k)}</p></div>`).join('')}</div>
  </div>`;
}

/* ═══ SUGGEST A RESOURCE (public submission → admin review) ════════ */
function viewSuggest(_, p) {
  onMount(() => {
    const f = $('#sub-form'); if (!f) return;
    f.onsubmit = e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      if (!/^https?:\/\//.test(d.url)) { $('#sub-err').hidden = false; f.url.focus(); return; }
      SUBS.unshift({ id: Date.now().toString(36), at: new Date().toISOString(), status: 'pending', ...d });
      logActivity(`New suggestion: “${d.title}”`); saveAll();
      go('suggest', { sent: 1 });
    };
  });
  if (p.sent) return `<div class="wrap page narrow"><h1>Thank you</h1><p class="lead">Your suggestion is waiting for a curator. Once it's checked against the original record, it will appear in search.</p><p><a class="btn btn-secondary" href="${href('suggest')}">Suggest another</a> <a class="btn btn-quiet" href="#/">Back to search</a></p></div>`;
  return `<div class="wrap page narrow">
    <h1>Suggest a resource</h1>
    <p class="lead">Know of a Black history record held somewhere we don't list yet? Tell us where it is. A curator checks every suggestion before it appears.</p>
    <form id="sub-form" class="form">
      <label>Title of the record<input name="title" required></label>
      <label>Link to the original record<input name="url" type="url" required placeholder="https://"></label>
      <p id="sub-err" class="notice notice-rejected" hidden>Please add a link that starts with https:// so people can reach the original.</p>
      <label>Institution that holds it<input name="holder" required></label>
      <div class="form-2"><label>Date, as written<input name="dateText" placeholder="e.g. ca. 1920"></label><label>Place<input name="place" placeholder="e.g. Preston"></label></div>
      <label>Type of record<input name="type" placeholder="e.g. Photograph, Letter"></label>
      <label>Short description<textarea name="description" rows="4"></textarea></label>
      <label>Your name (optional)<input name="name"></label>
      <button class="btn btn-primary" type="submit">Send suggestion</button>
    </form></div>`;
}
function submissionToRecord(s) {
  let holder = Object.keys(INSTITUTIONS).find(k => norm(INSTITUTIONS[k].name) === norm(s.holder));
  if (!holder) { holder = 'sub-' + norm(s.holder).replace(/\W+/g, '-'); INSTITUTIONS[holder] = INSTITUTIONS[holder] || { name: s.holder, kind: 'Named in a suggestion', address: '', place: '', access: 'Visitor details not yet confirmed by a curator.' }; }
  return {
    id: 'sub-' + s.id, source: 'sub', sourceRecordId: s.id, title: s.title, description: s.description || '', dateText: s.dateText || '',
    resourceType: s.type || 'Record', resourceTypeRule: 'Given by the person who suggested it', holder, provider: 'community', url: s.url,
    reference: '', creator: '', collection: 'Community suggestion', themeKey: 'sub:*', placesText: s.place || '',
    access: { status: 'Catalogue online', note: 'Check the original record for access.' },
    image: '', native: { ...s },
    provenance: [`Suggested ${s.at.slice(0, 10)}${s.name ? ' by ' + s.name : ''}.`, `Approved by a curator ${String(s.decidedAt || '').slice(0, 10)}.`]
  };
}
if (!INSTITUTIONS.community) INSTITUTIONS.community = { name: 'Community suggestions', kind: 'Approved public suggestions', address: '', place: '', access: 'Suggested by the public and checked by a curator.' };
