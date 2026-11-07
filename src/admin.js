/* =====================================================================
   admin.js — curator / administrator screens  (#/admin/<tab>)
   ---------------------------------------------------------------------
   Dashboard · Review queue · Suggestions · Institutions · Import CSV ·
   Sources · Data and backup
   No sign-in in this prototype. Everything is saved in this browser
   (see saveAll in core.js). A real deployment puts this behind a login
   and stores decisions with the curator's name.
   ===================================================================== */

const ADMIN_TABS = [['dashboard', 'Dashboard'], ['review', 'Review queue'], ['suggestions', 'Suggestions'], ['institutions', 'Institutions'], ['import', 'Import CSV'], ['sources', 'Sources'], ['data', 'Data and backup']];
const statusWord = s => `<span class="status status-${s}">${{ pending: 'Pending', approved: 'Approved', confirmed: 'Approved', rejected: 'Rejected', suggested: 'Pending' }[s] || s}</span>`;

function viewAdmin(tab = 'dashboard', p = {}) {
  if (!ADMIN_TABS.some(t => t[0] === tab)) tab = 'dashboard';
  const body = { dashboard: adminDashboard, review: adminReview, suggestions: adminSuggestions, institutions: adminInstitutions, import: adminImport, sources: adminSources, data: adminData }[tab](p);
  return `<div class="wrap page admin">
    <p class="notice">Admin demo. There is no sign-in in this prototype, and changes are saved in this browser only.</p>
    <h1>Admin</h1>
    <nav class="subnav" aria-label="Admin sections">${ADMIN_TABS.map(([k, l]) => `<a href="${href('admin/' + k)}" ${k === tab ? 'aria-current="page"' : ''}>${l}${k === 'suggestions' && SUBS.some(s => s.status === 'pending') ? ` (${SUBS.filter(s => s.status === 'pending').length})` : ''}</a>`).join('')}</nav>
    ${body}</div>`;
}

const pendingLinks = () => RECORDS.flatMap(r => r.links.filter(l => l.status === 'suggested' && !CUR[r.id + '|' + l.id]).map(l => ({ r, l })));

function adminDashboard() {
  const stats = [
    ['Records indexed', RECORDS.length, 'search'],
    ['Suggestions waiting', SUBS.filter(s => s.status === 'pending').length, 'admin/suggestions'],
    ['Links to review', pendingLinks().length, 'admin/review'],
    ['Holding institutions', new Set(RECORDS.map(r => r.holder)).size, 'admin/institutions'],
    ['Records with no date', RECORDS.filter(r => r.dateStart == null).length, null],
    ['Records with no map location', RECORDS.filter(r => !r.mapped.length).length, null]
  ];
  return `<div class="stat-grid">${stats.map(([l, n, to]) => `<${to ? `a href="#/${to}"` : 'div'} class="stat"><span class="stat-n">${n}</span><span>${l}</span></${to ? 'a' : 'div'}>`).join('')}</div>
    <div class="two">
      <section><h2>Needs attention</h2><ul class="plain">
        ${REVIEW_FLAGS.map(f => `<li>${f.ids ? f.ids.map(i => tag(i)).join(' ') + ' ' : ''}${h(f.why)} ${f.url ? ext(f.url, 'Read more') : ''}</li>`).join('')}
        <li>${RECORDS.filter(r => /Negro|mulatto|Slums/i.test(r.title)).length} titles use historical terms that are harmful today. They are kept as the source wrote them; consider adding a content note.</li>
      </ul></section>
      <section><h2>Recent activity</h2>${ACTIVITY.length ? `<ul class="plain">${ACTIVITY.slice(0, 10).map(a => `<li><span class="meta">${new Date(a.at).toLocaleString()}</span><br>${h(a.text)}</li>`).join('')}</ul>` : '<p class="meta">Nothing yet.</p>'}</section>
    </div>`;
}

function adminReview() {
  const groups = new Map();
  for (const r of RECORDS) for (const l of r.links) if (l.status === 'suggested') { if (!groups.has(l.id)) groups.set(l.id, []); groups.get(l.id).push(r); }
  onMount(() => $$('[data-decide]').forEach(b => b.onclick = () => decide(b.dataset.rid, b.dataset.eid, b.dataset.decide || null)));
  return `<p class="lead">These links were found by keyword only. They stay hidden from the public site until you approve them.</p>
    ${[...groups].map(([eid, rs]) => { const open = rs.filter(r => !CUR[r.id + '|' + eid]).length; return `<details class="rev" ${groups.size < 4 ? 'open' : ''}><summary><b>${h(nameOf(eid))}</b> <span class="meta">${open} waiting · ${rs.length} total</span></summary>
      ${rs.map(r => { const d = CUR[r.id + '|' + eid]; const l = r.links.find(x => x.id === eid); return `<div class="rev-row"><div><a href="${href('r/' + r.id)}">${h(r.title)}</a><p class="meta">${h(l.how)}</p></div>
        <div class="rev-act">${d ? `${statusWord(d)} <button class="btn btn-quiet" data-decide="" data-rid="${r.id}" data-eid="${eid}">Undo</button>` : `${statusWord('pending')} <button class="btn btn-secondary" data-decide="confirmed" data-rid="${r.id}" data-eid="${eid}">Approve</button><button class="btn btn-quiet" data-decide="rejected" data-rid="${r.id}" data-eid="${eid}">Reject</button>`}</div></div>`; }).join('')}
    </details>`; }).join('')}`;
}

function adminSuggestions() {
  onMount(() => $$('[data-sub]').forEach(b => b.onclick = () => {
    const s = SUBS.find(x => x.id === b.dataset.id); if (!s) return;
    s.status = b.dataset.sub; s.decidedAt = new Date().toISOString();
    logActivity(`${b.dataset.sub === 'pending' ? 'Reopened' : b.dataset.sub === 'approved' ? 'Approved' : 'Rejected'} suggestion “${s.title}”`);
    saveAll(); buildIndex(); render();
  }));
  if (!SUBS.length) return `<p class="lead">No suggestions yet. They arrive from the public <a href="${href('suggest')}">Suggest a resource</a> form.</p>`;
  return `<p class="lead">Check each link opens the institution's own record before approving. Approved suggestions appear in search.</p>
    ${SUBS.map(s => `<article class="panel sub">
      <div class="row-between"><h3>${h(s.title)}</h3>${statusWord(s.status)}</div>
      <p class="meta">${h(s.holder)} · ${h(s.dateText || 'Date not given')} · ${h(s.place || 'Place not given')} · sent ${new Date(s.at).toLocaleDateString()}${s.name ? ' by ' + h(s.name) : ''}</p>
      ${s.description ? `<p>${h(s.description)}</p>` : ''}
      <p>${ext(s.url, h(s.url))}</p>
      <div class="rev-act">${s.status === 'pending'
        ? `<button class="btn btn-primary" data-sub="approved" data-id="${s.id}">Approve</button><button class="btn btn-quiet" data-sub="rejected" data-id="${s.id}">Reject</button>`
        : `<button class="btn btn-quiet" data-sub="pending" data-id="${s.id}">Move back to pending</button>${s.status === 'approved' ? ` <a href="${href('r/sub-' + s.id)}">View in hub</a>` : ''}`}</div>
    </article>`).join('')}`;
}

function adminInstitutions() {
  const keys = Object.keys(INSTITUTIONS).filter(k => k !== 'csv');
  onMount(() => $$('form[data-inst]').forEach(f => f.onsubmit = e => {
    e.preventDefault();
    const k = f.dataset.inst, d = Object.fromEntries(new FormData(f));
    INST_EDITS[k] = { ...(INST_EDITS[k] || {}), ...d };
    logActivity(`Updated visitor details for ${INSTITUTIONS[k].name}`); saveAll(); buildIndex(); render();
  }));
  return `<p class="lead">Keep visitor details current. These appear on every record the institution holds.</p>
    ${keys.map(k => { const I = INSTITUTIONS[k]; return `<details class="rev"><summary><b>${h(I.name)}</b> <span class="meta">${plural(recsOf(k).length, 'record')}${INST_EDITS[k] ? ' · edited' : ''}</span></summary>
      <form class="form" data-inst="${k}">
        <label>Visitor address<input name="address" value="${h(I.address || '')}"></label>
        <label>Website<input name="web" type="url" value="${h(I.web || '')}"></label>
        <label>How to access<textarea name="access" rows="2">${h(I.access || '')}</textarea></label>
        <button class="btn btn-secondary">Save</button>
      </form></details>`; }).join('')}`;
}

/* ---------- CSV import: a new institution can join with a spreadsheet ---------- */
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
function adminImport() {
  onMount(bindImporter);
  return `<p class="lead">Paste a spreadsheet export (CSV). The hub guesses which column is which and shows you before anything is added. Rows without a link to the original record are refused.</p>
    <p><button class="btn btn-secondary" id="csv-sample" type="button">Load a sample</button> <label class="btn btn-quiet">Choose a file<input type="file" id="csv-file" accept=".csv,text/csv" hidden></label></p>
    <label class="sr-only" for="csv-text">CSV text</label><textarea id="csv-text" class="mono" rows="7" placeholder="id,title,date,link,institution,notes"></textarea>
    <div id="csv-map"></div><div id="csv-preview"></div>
    ${IMPORTED.length ? `<p>${statusWord('approved')} ${plural(IMPORTED.length, 'record')} imported. <a href="${href('search', { provider: 'csv' })}">See them in search</a> · <button class="linklike" id="csv-clear">Remove imported records</button></p>` : ''}`;
}
function bindImporter() {
  const ta = $('#csv-text');
  $('#csv-sample').onclick = () => { ta.value = SAMPLE_CSV; preview(); };
  $('#csv-file').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => { ta.value = t; preview(); }); };
  const clr = $('#csv-clear'); if (clr) clr.onclick = () => { IMPORTED = []; logActivity('Removed imported records'); saveAll(); buildIndex(); render(); };
  ta.oninput = preview;
  let mapping = {};
  function preview() {
    const rows = parseCsv(ta.value); if (rows.length < 2) { $('#csv-map').innerHTML = ''; $('#csv-preview').innerHTML = ''; return; }
    const head = rows[0];
    mapping = {};
    for (const [field, re] of Object.entries(CSV_GUESS)) { const i = head.findIndex(c => re.test(c.trim())); if (i >= 0 && !Object.values(mapping).includes(i)) mapping[field] = i; }
    $('#csv-map').innerHTML = `<h2 class="h3">Column mapping</h2><div class="mapgrid">${Object.keys(CSV_GUESS).map(f => `<label>${f}<select data-f="${f}"><option value="">None</option>${head.map((c, i) => `<option value="${i}" ${mapping[f] === i ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></label>`).join('')}</div>`;
    $$('#csv-map select').forEach(s => s.onchange = () => { if (s.value === '') delete mapping[s.dataset.f]; else mapping[s.dataset.f] = +s.value; show(); });
    show();
    function show() {
      const recs = rows.slice(1).map((r, n) => csvToRecord(r, mapping, n));
      const ok = recs.filter(r => r.title && /^https?:\/\//.test(r.url)), bad = recs.length - ok.length;
      $('#csv-preview').innerHTML = `<h2 class="h3">Preview</h2>
        ${bad ? `<p class="notice notice-rejected">${plural(bad, 'row')} with no title or no link will be skipped.</p>` : ''}
        <table class="tbl"><thead><tr><th>Title</th><th>Date read as</th><th>Held by</th><th>Linked to</th></tr></thead><tbody>${ok.slice(0, 6).map(r => { const d = parseDate(r.dateText); const l = linkEntities(r).filter(x => x.status === 'confirmed'); return `<tr><td>${h(r.title)}</td><td>${h(r.dateText)} → ${d.start ?? 'none'}</td><td>${h(instName(r.holder))}</td><td>${l.map(x => h(nameOf(x.id))).join(', ') || 'Nothing yet'}</td></tr>`; }).join('')}</tbody></table>
        <button class="btn btn-primary" id="csv-go" ${ok.length ? '' : 'disabled'}>Add ${plural(ok.length, 'record')}</button>`;
      const g = $('#csv-go'); if (g) g.onclick = () => {
        const fresh = ok.filter(r => !REC.has(r.id));
        IMPORTED.push(...fresh); logActivity(`Imported ${plural(fresh.length, 'record')} from CSV`); saveAll(); buildIndex(); render();
      };
    }
  }
}
function csvToRecord(row, m, n) {
  const g = f => m[f] != null ? (row[m[f]] || '').trim() : '';
  const instText = g('holder');
  let holder = Object.keys(INSTITUTIONS).find(k => norm(INSTITUTIONS[k].name) === norm(instText));
  if (!holder) {
    holder = 'csv-' + (norm(instText).replace(/\W+/g, '-') || 'unknown');
    INST_EDITS[holder] = INST_EDITS[holder] || { name: instText || 'Unknown institution', kind: 'Added by CSV import', address: '', place: '', access: 'Visitor details not yet added.' };
    INSTITUTIONS[holder] = { ...INST_EDITS[holder] };
  }
  if (!INSTITUTIONS.csv) INSTITUTIONS.csv = { name: 'CSV import', kind: 'Imported source', access: 'Imported by a curator.' };
  return {
    id: 'csv-' + (g('id') || n), source: 'csv', sourceRecordId: g('id') || String(n),
    title: g('title'), description: g('description'), dateText: g('dateText'),
    resourceType: g('resourceType') || 'Record', resourceTypeRule: 'CSV column', holder, provider: 'csv', url: g('url'),
    reference: g('id'), creator: g('creator'), collection: 'CSV import', themeKey: 'csv:*', placesText: g('placeText'),
    access: { status: 'Catalogue online', note: 'Check the linked record for access.' }, image: '',
    native: Object.fromEntries(row.map((v, i) => [String(i), v])),
    provenance: [`Imported from CSV on ${new Date().toISOString().slice(0, 10)}.`, `Columns mapped: ${Object.entries(m).map(([k, i]) => k + ' ← column ' + (i + 1)).join(', ')}.`]
  };
}

function adminSources() {
  return `<p class="lead">Where the hub's records come from and how each source's fields map to the common record.</p>
    <table class="tbl"><thead><tr><th>Source</th><th>Format</th><th>Records</th><th>Harvested</th></tr></thead><tbody>
    ${Object.entries(SOURCES).map(([k, s]) => { const f = s.feed(); return `<tr><td>${h(s.label)}</td><td>${h(s.shape)}</td><td>${f.records.length}</td><td>${h(f.harvested)}</td></tr>`; }).join('')}
    ${IMPORTED.length ? `<tr><td>CSV import</td><td>Spreadsheet</td><td>${IMPORTED.length}</td><td>This browser</td></tr>` : ''}
    ${SUBS.some(s => s.status === 'approved') ? `<tr><td>Public suggestions</td><td>Form</td><td>${SUBS.filter(s => s.status === 'approved').length}</td><td>This browser</td></tr>` : ''}
    </tbody></table>
    ${Object.entries(SOURCES).map(([key, s]) => { const f = s.feed(); const sample = f.records[0]; const mapped = crosswalk[key](sample);
      return `<details class="rev"><summary><b>${h(s.label)}</b> <span class="meta">sample record and mapping</span></summary>
        <p class="meta">Harvested from ${f.harvestUrls.map((u, i) => ext(u, 'page ' + (i + 1))).join(', ')}</p>
        <div class="two even"><div><h2 class="h3">As published</h2><pre>${h(JSON.stringify(sample, null, 2))}</pre></div>
        <div><h2 class="h3">After mapping</h2><dl class="facts">${['id', 'title', 'dateText', 'resourceType', 'holder', 'provider', 'url', 'reference', 'collection'].map(k => `<dt>${k}</dt><dd>${h(mapped[k])}</dd>`).join('')}</dl></div></div>
      </details>`; }).join('')}`;
}

function adminData() {
  onMount(() => {
    $('#exp').onclick = () => {
      const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), CUR, IMPORTED, SUBS, INST_EDITS, ACTIVITY }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'connected-histories-admin-backup.json'; a.click(); URL.revokeObjectURL(a.href);
    };
    $('#imp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => {
      try { const d = JSON.parse(t); CUR = d.CUR || {}; IMPORTED = d.IMPORTED || []; SUBS = d.SUBS || []; INST_EDITS = d.INST_EDITS || {}; ACTIVITY = d.ACTIVITY || []; logActivity('Restored a backup'); saveAll(); buildIndex(); render(); }
      catch { alert('That file is not a Connected Histories backup.'); } }); };
    $('#reset').onclick = () => { if (!confirm('Remove all decisions, imports, suggestions and edits saved in this browser?')) return;
      CUR = {}; IMPORTED = []; SUBS = []; INST_EDITS = {}; ACTIVITY = []; for (const k of Object.keys(INSTITUTIONS)) if (!ORIGINAL_INST[k] && k !== 'community') delete INSTITUTIONS[k]; Object.assign(INSTITUTIONS, JSON.parse(JSON.stringify(ORIGINAL_INST))); saveAll(); buildIndex(); render(); };
  });
  return `<p class="lead">Admin changes live in this browser. Download a backup to move them to another computer.</p>
    <p><button class="btn btn-secondary" id="exp">Download backup</button> <label class="btn btn-quiet">Restore from a backup<input type="file" id="imp" accept="application/json" hidden></label></p>
    <p><button class="btn btn-quiet danger" id="reset">Reset everything saved in this browser</button></p>`;
}
