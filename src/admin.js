/* =====================================================================
   admin.js — curator / administrator screens  (#/admin/<tab>)
   ---------------------------------------------------------------------
   Dashboard · Record Linking · Suggestions · Institutions · Import CSV ·
   Sources · Data and backup
   No sign-in in this prototype. Everything is saved in this browser
   (see saveAll in core.js). A real deployment puts this behind a login
   and stores decisions with the curator's name.
   ===================================================================== */

const ADMIN_TABS = [['dashboard', 'Dashboard'], ['review', 'Record Linking'], ['dictionary', 'Keyword Dictionary'], ['record-review', 'Record approvals'], ['duplicates', 'Duplicates'], ['suggestions', 'Suggestions'], ['institutions', 'Institutions'], ['import', 'Import CSV'], ['sources', 'Sources'], ['data', 'Data and backup']];
const statusWord = s => `<span class="status status-${s}">${{ pending: 'Pending', approved: 'Approved', confirmed: 'Approved', rejected: 'Rejected', suggested: 'Pending' }[s] || s}</span>`;

function viewAdmin(tab = 'dashboard', p = {}) {
  if (!ADMIN_TABS.some(t => t[0] === tab)) tab = 'dashboard';
  const body = { dashboard: adminDashboard, review: adminReview, dictionary: adminDictionary, 'record-review': adminRecordReview, duplicates: adminDuplicates, suggestions: adminSuggestions, institutions: adminInstitutions, import: adminImport, sources: adminSources, data: adminData }[tab](p);
  return `<div class="wrap page admin">
    <p class="notice">Admin demo. There is no sign-in in this prototype, and changes are saved in this browser only.</p>
    <h1>Admin</h1>
    <nav class="subnav" aria-label="Admin sections">${ADMIN_TABS.map(([k, l]) => `<a href="${href('admin/' + k)}" ${k === tab ? 'aria-current="page"' : ''}>${l}${k === 'suggestions' && SUBS.some(s => s.status === 'pending') ? ` (${SUBS.filter(s => s.status === 'pending').length})` : ''}${k === 'duplicates' && openDuplicates().length ? ` (${openDuplicates().length})` : ''}</a>`).join('')}</nav>
    ${body}</div>`;
}

const pendingLinks = () => RECORDS.flatMap(r => r.links.filter(l => l.status === 'suggested' && !CUR[r.id + '|' + l.id]).map(l => ({ r, l })));

function adminDashboard() {
  const stats = [
    ['Records indexed', RECORDS.length, 'search'],
    ['Suggestions waiting', SUBS.filter(s => s.status === 'pending').length, 'admin/suggestions'],
    ['CSV records awaiting review', PENDING_IMPORTS.filter(r => r.reviewStatus === 'pending').length, 'admin/record-review'],
    ['Records needing rights verification', RECORDS.filter(r => !r.rightsVerified).length, 'admin/record-review'],
    ['Record links to review', pendingLinks().length, 'admin/review'],
    ['Possible duplicates', openDuplicates().length, 'admin/duplicates'],
    ['Holding institutions', new Set(RECORDS.map(r => r.holder)).size, 'admin/institutions'],
    ['Records with no date', RECORDS.filter(r => r.dateStart == null).length, null],
    ['Records with no map location', RECORDS.filter(r => !r.mapped.length).length, null]
  ];
  return `<div class="stat-grid">${stats.map(([l, n, to]) => `<${to ? `a href="#/${to}"` : 'div'} class="stat"><span class="stat-n">${n}</span><span>${l}</span></${to ? 'a' : 'div'}>`).join('')}</div>
    <div class="two">
      <section><h2>Needs attention</h2><ul class="plain">
        ${autoChecks().map(c => `<li>${c}</li>`).join('')}
        ${REVIEW_FLAGS.map(f => `<li>${f.ids ? f.ids.map(i => tag(i)).join(' ') + ' ' : ''}${h(f.why)} ${f.url ? ext(f.url, 'Read more') : ''}</li>`).join('')}
        <li>${RECORDS.filter(r => /Negro|mulatto|Slums/i.test(r.title)).length} titles use historical terms that are harmful today. They are kept as the source wrote them; consider adding a content note.</li>
      </ul></section>
      <section><h2>Recent activity</h2>${ACTIVITY.length ? `<ul class="plain">${ACTIVITY.slice(0, 10).map(a => `<li><span class="meta">${new Date(a.at).toLocaleString()}</span><br>${h(a.text)}</li>`).join('')}</ul>` : '<p class="meta">Nothing yet.</p>'}</section>
    </div>`;
}

/* Automatic checks for the dashboard: work waiting and likely mistakes. */
function autoChecks() {
  const out = [];
  const dup = openDuplicates(); if (dup.length) out.push(`<a href="${href('admin/duplicates')}">${plural(dup.length, 'group')} of possible duplicate records</a> (${dup.filter(g => g.strength === 'strong').length} strong).`);
  const pendDup = PENDING_IMPORTS.filter(r => r.reviewStatus === 'pending' && looksLikeExisting(r).length);
  if (pendDup.length) out.push(`<a href="${href('admin/record-review')}">${plural(pendDup.length, 'CSV record')} waiting for approval ${pendDup.length === 1 ? 'looks' : 'look'} like records already in the hub.</a>`);
  const noWay = RECORDS.filter(r => !r.url && !r.physicalLocation && !INSTITUTIONS[r.holder]?.address);
  if (noWay.length) out.push(`${plural(noWay.length, 'record')} ${noWay.length === 1 ? 'has' : 'have'} no original link and no address to visit.`);
  const badDate = RECORDS.filter(r => r.dateStart != null && (r.dateStart < 1500 || r.dateStart > new Date().getFullYear()));
  if (badDate.length) out.push(`${plural(badDate.length, 'record')} ${badDate.length === 1 ? 'has' : 'have'} a date that looks wrong: ${badDate.slice(0, 3).map(r => `<a href="${href('r/' + r.id)}">${h(r.title)}</a>`).join(', ')}.`);
  const noAddr = Object.keys(INSTITUTIONS).filter(k => recsOf(k).length && !INSTITUTIONS[k].address);
  if (noAddr.length) out.push(`${plural(noAddr.length, 'holding institution')} ${noAddr.length === 1 ? 'has' : 'have'} no visitor address: ${noAddr.map(k => h(instName(k))).join(', ')}.`);
  return out;
}

function adminDuplicates() {
  onMount(() => $$('[data-dup]').forEach(b => b.onclick = () => {
    const g = findDuplicates().find(x => x.key === b.dataset.key); if (!g) return;
    if (b.dataset.dup) DUPS[g.key] = b.dataset.dup; else delete DUPS[g.key];
    logActivity(`${b.dataset.dup ? (b.dataset.dup === 'same' ? 'Marked as the same item' : 'Marked as different items') : 'Reopened'}: “${g.records[0].title}” (${g.records.length} records)`);
    saveAll(); render();
  }));
  const all = findDuplicates().sort((a, b) => !!a.decision - !!b.decision || (a.strength === 'strong' ? -1 : 1));
  if (!all.length) return '<p class="lead">No possible duplicates found.</p>';
  return `<p class="lead">The hub checks every record for the same original link, or the same title at the same institution. Nothing is merged or hidden automatically: you decide.</p>
    ${all.map(g => `<article class="panel sub"><div class="row-between"><h3>${h(g.records[0].title)}</h3>${g.decision ? statusWord(g.decision === 'same' ? 'approved' : 'rejected').replace(/>(Approved|Rejected)</, '>' + (g.decision === 'same' ? 'Same item' : 'Different items') + '<') : `<span class="status status-pending">${g.strength === 'strong' ? 'Likely duplicate' : 'Check'}</span>`}</div>
      <p class="meta">${h(g.why)} · ${plural(g.records.length, 'record')} · ${h(instName(g.records[0].holder))}</p>
      <ul class="plain">${g.records.map(r => `<li><a href="${href('r/' + r.id)}">${h(r.title)}</a> <span class="meta">${h(r.dateText || 'no date')} · ${h(r.reference || r.id)}</span>${r.url ? ' · ' + ext(r.url, 'original') : ''}</li>`).join('')}</ul>
      <div class="rev-act">${g.decision ? `<button class="btn btn-quiet" data-dup="" data-key="${h(g.key)}">Undo</button>` : `<button class="btn btn-secondary" data-dup="same" data-key="${h(g.key)}">Same item</button><button class="btn btn-quiet" data-dup="different" data-key="${h(g.key)}">Different items</button>`}</div></article>`).join('')}`;
}

function linkActionMarkup(rid,eid,term) {
  const d = CUR[rid + '|' + eid];
  return d ? `${statusWord(d)} <button class="btn btn-quiet" data-decide="" data-rid="${h(rid)}" data-eid="${h(eid)}">Undo</button>`
    : `${statusWord('pending')} <button class="btn btn-secondary" data-decide="confirmed" data-rid="${h(rid)}" data-eid="${h(eid)}">Approve</button><button class="btn btn-quiet" data-decide="rejected" data-rid="${h(rid)}" data-eid="${h(eid)}">Reject</button>${term ? `<button class="btn btn-quiet" data-disable-term="${h(term)}" data-eid="${h(eid)}" title="Stop suggesting this keyword in future">Disable keyword</button>` : ''}`;
}
function adminReview() {
  const records = RECORDS.map(r => ({r, links:r.links.filter(l => l.status === 'suggested')})).filter(x => x.links.length);
  onMount(() => {
    const host = $('#record-linking-list'); if (!host) return;
    const groups = [...host.querySelectorAll('details.rev')];
    const pageSize = $('#link-page-size'), prev = $('#link-prev'), next = $('#link-next');
    const pageLabel = $('#link-page-label'), count = $('#link-count');
    let page = 1;
    const updatePage = () => {
      const size = Number(pageSize.value);
      const pages = Math.max(1, Math.ceil(groups.length / size));
      page = Math.min(Math.max(1, page), pages);
      groups.forEach((group, i) => { group.hidden = i < (page - 1) * size || i >= page * size; });
      count.textContent = `${groups.length} records · Showing ${groups.length ? (page - 1) * size + 1 : 0}–${Math.min(page * size, groups.length)}`;
      pageLabel.textContent = `Page ${page} of ${pages}`;
      prev.disabled = page === 1;
      next.disabled = page === pages;
    };
    pageSize.addEventListener('change', () => { page = 1; updatePage(); });
    prev.addEventListener('click', () => { if (page > 1) { page--; updatePage(); } });
    next.addEventListener('click', () => { page++; updatePage(); });
    updatePage();
    host.onclick = event => {
      const b = event.target.closest('button[data-decide],button[data-disable-term]'); if (!b) return;
      const {rid,eid} = b.dataset;
      if (b.hasAttribute('data-disable-term')) {
        const term = b.dataset.disableTerm;
        if (!confirm(`Disable "${term}" for ${nameOf(eid)}? Existing approved relationships will be retained.`)) return;
        const key = keywordKey(term,eid);
        if (!KEYWORD_DISABLED.includes(key)) KEYWORD_DISABLED.push(key);
        KEYWORDS.forEach(k => {if (keywordKey(k.term,k.subject) === key) k.enabled = false;});
        logActivity(`Disabled dictionary keyword "${term}"`);
        saveAll(); buildIndex(); render(); return;
      }
      const val = b.dataset.decide || null;
      if (val) CUR[rid+'|'+eid] = val; else delete CUR[rid+'|'+eid];
      logActivity(`${val || 'cleared'}: ${nameOf(eid)} on “${REC.get(rid)?.title || rid}”`);
      saveAll(); buildIndex();
      const row = b.closest('.rev-row');
      const link = records.find(x => x.r.id === rid)?.links.find(l => l.id === eid);
      row.querySelector('.rev-act').innerHTML = linkActionMarkup(rid,eid,link?.evidence);
      const group = b.closest('details.rev');
      const x = records.find(x => x.r.id === rid);
      group.querySelector('[data-link-count]').textContent = `${x.links.filter(l => !CUR[rid+'|'+l.id]).length} waiting · ${x.links.length} total`;
    };
  });
  return `<h2>Record Linking</h2><p class="lead">Review suggested subject connections one historical record at a time. Approving a link makes that relationship visible publicly. Rejecting does not delete the record. Disable a broad keyword to stop new suggestions.</p>
    <div class="dict-list-toolbar"><p class="meta" id="link-count" aria-live="polite"></p><label class="dict-page-size-label">Records per page <select id="link-page-size" aria-label="Records per page"><option value="10">10</option><option value="20">20</option></select></label></div>
    <div id="record-linking-list">${records.length ? records.map(({r,links}) => `<details class="rev"><summary><b class="rev-title">${h(r.title)}</b> <span class="meta" data-link-count>${links.filter(l => !CUR[r.id+'|'+l.id]).length} waiting · ${links.length} total</span></summary>
      ${links.map(l => `<div class="rev-row"><div class="rev-main"><strong>${h(nameOf(l.id))}</strong><p class="meta">${h(l.how)}</p></div><div class="rev-act">${linkActionMarkup(r.id,l.id,l.evidence)}</div></div>`).join('')}
    </details>`).join('') : '<p class="notice">No suggested record links to review.</p>'}</div><nav class="dict-pagination" aria-label="Record linking pages"><button class="btn btn-secondary" id="link-prev" type="button">Previous</button><span id="link-page-label" aria-live="polite">Page 1</span><button class="btn btn-secondary" id="link-next" type="button">Next</button></nav>`;
}
function adminDictionary() {
  const subjects = Object.entries(ENTITIES).filter(([,e])=>e.type==='topic');
  const entries = dictionaryEntries();
  const options = subjects.map(([id,e])=>`<option value="${h(id)}">${h(e.name)}</option>`).join('');
  onMount(() => {
    const list = $('#dict-list'), search = $('#dict-search'), category = $('#dict-category'), strength = $('#dict-strength');
    const pageSize = $('#dict-page-size'), prev = $('#dict-prev'), next = $('#dict-next'), pageLabel = $('#dict-page-label');
    let page = 1;
    const strengthOrder = {strong:0, weak:1};
    const reorderOnNavigation = () => {
      const rows = [...list.querySelectorAll('[data-dict-row]')];
      rows.sort((a,b) => (strengthOrder[a.dataset.strength] ?? 3) - (strengthOrder[b.dataset.strength] ?? 3) || a.dataset.term.localeCompare(b.dataset.term));
      rows.forEach(row => list.appendChild(row));
    };
    const refresh = () => {
      const query = norm(search.value), cat = category.value, level = strength.value;
      const rows = [...list.querySelectorAll('[data-dict-row]')];
      const matching = rows.filter(row => (!query || norm(row.dataset.term+' '+row.dataset.subjectName).includes(query)) && (!cat || row.dataset.subject === cat) && (!level || row.dataset.strength === level));
      const size = Number(pageSize.value), pages = Math.max(1, Math.ceil(matching.length / size));
      page = Math.min(Math.max(1, page), pages);
      const visible = new Set(matching.slice((page-1)*size, page*size));
      rows.forEach(row => { row.hidden = !visible.has(row); });
      $('#dict-count').textContent = `${matching.length} of ${rows.length} terms · Showing ${matching.length ? (page-1)*size+1 : 0}–${Math.min(page*size, matching.length)}`;
      pageLabel.textContent = `Page ${page} of ${pages}`;
      prev.disabled = page === 1;
      next.disabled = page === pages;
    };
    [search,category,strength].forEach(el => el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{page=1;refresh();}));
    pageSize.addEventListener('change',()=>{page=1;refresh();});
    prev.addEventListener('click',()=>{if(page>1){page--;reorderOnNavigation();refresh();}});
    next.addEventListener('click',()=>{page++;reorderOnNavigation();refresh();});
    refresh();
    $('#dict-add').onsubmit = e => {
      e.preventDefault(); const f=e.currentTarget, term=f.elements.namedItem('term').value.trim(), subject=f.elements.namedItem('subject').value;
      if (!term || entries.some(k=>keywordKey(k.term,k.subject)===keywordKey(term,subject))) {alert('This keyword already exists for that subject, or is empty.');return;}
      KEYWORDS.push({term,subject,strength:f.elements.namedItem('strength').value,enabled:true});
      KEYWORD_DISABLED=KEYWORD_DISABLED.filter(k=>k!==keywordKey(term,subject));
      logActivity(`Added keyword "${term}"`); saveAll(); buildIndex(); render();
    };
    list.onchange = e => {
      const select = e.target.closest('select[data-dict-strength-select]');
      if (!select) return;
      const {term,subject} = select.dataset;
      const key = keywordKey(term,subject);
      const custom = KEYWORDS.find(k=>keywordKey(k.term,k.subject)===key);
      const next = select.value;
      if (!['strong','weak'].includes(next)) return;
      if (custom) custom.strength = next;
      else KEYWORDS.push({term,subject,strength:next,enabled:true,override:true});
      select.closest('[data-dict-row]').dataset.strength = next;
      logActivity(`Changed keyword strength to ${next}: "${term}"`);
      saveAll(); buildIndex();
      // Preserve the current row order and pagination until the user navigates.
    };
    list.onclick = e => {
      const b=e.target.closest('button[data-dict-action]');if(!b)return;
      const {dictAction:action,term,subject} = b.dataset;
      const key=keywordKey(term,subject), custom=KEYWORDS.find(k=>keywordKey(k.term,k.subject)===key);
      if (action==='toggle') {
        if (keywordDisabled(term,subject) || custom?.enabled===false) {
          KEYWORD_DISABLED=KEYWORD_DISABLED.filter(x=>x!==key); if(custom)custom.enabled=true;
        } else { if(!KEYWORD_DISABLED.includes(key))KEYWORD_DISABLED.push(key); if(custom)custom.enabled=false; }
      } else if(action==='edit' && custom) { const next=prompt('Edit keyword or phrase:',custom.term); if(next===null)return; const cleaned=next.trim(); if(!cleaned || KEYWORDS.some(k=>k!==custom && keywordKey(k.term,k.subject)===keywordKey(cleaned,subject))){alert('Please enter a unique, non-empty keyword.');return;} custom.term=cleaned; } else if(action==='delete' && custom) {if(!confirm(`Delete keyword "${term}"?`))return;KEYWORDS=KEYWORDS.filter(k=>k!==custom);}
      logActivity(`${action}: keyword "${term}"`);saveAll();buildIndex();render();
    };
    $('#dict-suggestions').onclick = e => {
      const b=e.target.closest('button[data-suggest]');if(!b)return;
      const s=KEYWORD_SUGGESTIONS.find(x=>x.id===b.dataset.suggest);if(!s)return;
      if(b.dataset.action==='dismiss') KEYWORD_DISMISSED.push(norm(s.term));
      else {
        const form=b.closest('[data-suggestion-row]'), subject=form.querySelector('select').value, strength=form.querySelector('[name="strength"]').value;
        if (!subject) {alert('Select a destination subject first.');return;}
        if(!dictionaryEntries().some(k=>keywordKey(k.term,k.subject)===keywordKey(s.term,subject))) KEYWORDS.push({term:s.term,subject,strength,enabled:true});
      }
      KEYWORD_SUGGESTIONS=KEYWORD_SUGGESTIONS.filter(x=>x.id!==s.id);
      saveAll();buildIndex();render();
    };
    $('#dict-scan').onclick=()=>{discoverApprovedRecords();saveAll();render();};
  });
  const merged = entries.filter(k=>!k.override || !k.builtIn).filter(k=>!k.builtIn || !KEYWORDS.some(x=>x.override && keywordKey(x.term,x.subject)===keywordKey(k.term,k.subject)));
  return `<h2>Keyword Dictionary</h2><p class="lead">Manage terms that suggest connections to historical subjects. Strong and weak terms both require review. Disabling a term prevents new suggestions without removing approved relationships.</p>
    <details class="rev"><summary><b>Add keyword manually</b></summary><form id="dict-add" class="form"><label>Keyword or phrase<input name="term" required maxlength="85"></label><label>Subject<select name="subject" required>${options}</select></label><label>Strength<select name="strength"><option value="strong">Strong</option><option value="weak">Weak</option></select></label><button class="btn btn-primary">Add keyword</button></form></details>
    <details class="rev"><summary><b>Suggested Keywords (${KEYWORD_SUGGESTIONS.length})</b></summary><p class="meta">Candidates discovered from approved submissions and CSV records. Confirm the destination subject before adding them.</p><button id="dict-scan" class="btn btn-secondary" type="button">Scan approved records</button><div id="dict-suggestions">${KEYWORD_SUGGESTIONS.length ? KEYWORD_SUGGESTIONS.slice(0,20).map(s=>`<div class="rev-row" data-suggestion-row><div class="rev-main"><b>${h(s.term)}</b><p class="meta">From: ${h(s.sourceTitle)} · ${h(s.category)}</p><select aria-label="Destination subject"><option value="">Choose subject</option>${options}</select><select name="strength" aria-label="Strength">${['strong','weak'].map(level=>`<option value="${level}" ${s.strength===level?'selected':''}>${level[0].toUpperCase()+level.slice(1)}</option>`).join('')}</select></div><div class="rev-act"><button class="btn btn-secondary" data-suggest="${h(s.id)}" data-action="add">Add</button><button class="btn btn-quiet" data-suggest="${h(s.id)}" data-action="dismiss">Dismiss</button></div></div>`).join(''):'<p class="meta">No new candidates waiting.</p>'}</div></details>
    <h3>Master keyword list</h3><div class="dict-filters"><input id="dict-search" placeholder="Search keywords or subjects…" aria-label="Search keywords"><select id="dict-category" aria-label="Filter by subject"><option value="">All subjects</option>${options}</select><select id="dict-strength" aria-label="Filter by strength"><option value="">All strengths</option><option value="strong">Strong</option><option value="weak">Weak</option></select></div>
    <div class="dict-list-toolbar"><p class="meta" id="dict-count" aria-live="polite"></p><label class="dict-page-size-label">Terms per page <select id="dict-page-size" aria-label="Terms per page"><option value="10">10</option><option value="20">20</option></select></label></div>
    <div id="dict-list">${merged.map(k=>`<div class="rev-row" data-dict-row data-term="${h(k.term)}" data-subject="${h(k.subject)}" data-subject-name="${h(nameOf(k.subject))}" data-strength="${h(k.strength)}"><div class="rev-main"><b>${h(k.term)}</b><p class="meta">${h(nameOf(k.subject))} · ${k.builtIn?'Built-in':'Added by curator'}</p></div><div class="rev-act"><label class="dict-strength-control">Strength <select data-dict-strength-select data-term="${h(k.term)}" data-subject="${h(k.subject)}" aria-label="Strength for ${h(k.term)}">${['strong','weak'].map(level=>`<option value="${level}" ${k.strength===level?'selected':''}>${level[0].toUpperCase()+level.slice(1)}</option>`).join('')}</select></label><button class="btn btn-secondary" data-dict-action="toggle" data-term="${h(k.term)}" data-subject="${h(k.subject)}">${k.enabled?'Disable':'Enable'}</button>${!k.builtIn?`<button class="btn btn-quiet" data-dict-action="edit" data-term="${h(k.term)}" data-subject="${h(k.subject)}">Edit</button><button class="btn btn-quiet" data-dict-action="delete" data-term="${h(k.term)}" data-subject="${h(k.subject)}">Delete</button>`:''}</div></div>`).join('')}</div><nav class="dict-pagination" aria-label="Keyword dictionary pages"><button class="btn btn-secondary" id="dict-prev" type="button">Previous</button><span id="dict-page-label" aria-live="polite">Page 1</span><button class="btn btn-secondary" id="dict-next" type="button">Next</button></nav>`;
}

function rightsReady(r) {
  return !!(r.rightsHolder && r.ownershipStatus && r.copyrightStatus && r.reproductionPermission && r.rightsSource && r.accessRestrictions &&
    r.rightsHolder !== 'Unknown — verification needed' && r.rightsHolder !== 'Unknown' &&
    r.ownershipStatus !== 'Unknown' && r.copyrightStatus !== 'Unknown' &&
    r.reproductionPermission !== 'Not verified' && r.accessRestrictions !== 'Not assessed' &&
    (r.url || (r.physicalLocation || INSTITUTIONS[r.holder]?.address)));
}
function rightsFields(r, blankUnknown = false) {
  const fields = [
    ['rightsHolder', 'Rights / copyright holder'], ['ownershipStatus', 'Ownership or custody status'],
    ['copyrightStatus', 'Copyright status'], ['reproductionPermission', 'Reproduction permission'],
    ['rightsSource', 'Evidence / source for rights decision'], ['accessRestrictions', 'Privacy / access restrictions']
  ];
  const tips = { rightsSource: 'Link to the terms of use / copyright page, or the permission you hold' };
  return fields.map(([key, label]) => `<label>${label}<input name="${key}" value="${h(blankUnknown && /^(Unknown|Not verified|Not assessed)/.test(r[key] || '') ? '' : (r[key] || ''))}" placeholder="${h(tips[key] || r[key] || '')}" required></label>`).join('');
}
function adminRecordReview() {
  onMount(() => {
    $$('form[data-review-record]').forEach(f => f.onsubmit = e => {
      e.preventDefault();
      const r = PENDING_IMPORTS.find(x => x.id === f.dataset.reviewRecord);
      if (!r) return;
      Object.assign(r, Object.fromEntries(new FormData(f)));
      const action = e.submitter?.value || 'save';
      if (action === 'approve') {
        if (!rightsReady(r)) { alert('Complete and verify all rights, ownership, restriction and location fields before approving. Unknown rights are not permission.'); return; }
        r.rightsVerified = true; r.reviewStatus = 'approved';
        if (!IMPORTED.some(x => x.id === r.id)) IMPORTED.push({ ...r });
      } else if (action === 'reject') r.reviewStatus = 'rejected';
      logActivity(`${action}: CSV record “${r.title}”`); discoverApprovedRecords(); saveAll(); buildIndex(); render();
    });
    $$('form[data-legacy-rights]').forEach(f => f.onsubmit = e => {
      e.preventDefault();
      const r = REC.get(f.dataset.legacyRights); if (!r) return;
      const d = Object.fromEntries([...new FormData(f)].filter(([, v]) => String(v).trim()));
      const action = e.submitter?.value || 'save';
      const verified = action === 'verify';
      if (verified && !rightsReady({ ...r, ...d })) { alert('A complete, evidenced rights and restrictions review is required. Unknown is not a verified permission.'); return; }
      RIGHTS_EDITS[r.id] = { ...d, rightsVerified: verified };
      logActivity(`${verified ? 'Verified' : 'Saved'} rights metadata for “${r.title}”`);
      saveAll(); buildIndex(); render();
    });
    // one rights statement for every record from a source (rights rules are usually the same across a catalogue)
    $$('form[data-source-rights]').forEach(f => f.onsubmit = e => {
      e.preventDefault();
      const src = f.dataset.sourceRights, d = Object.fromEntries(new FormData(f));
      const recs = RECORDS.filter(r => r.provider === src && r.source !== 'demo' && !r.rightsVerified);
      if (!rightsReady({ ...d, url: 'x' })) { alert('Fill every field with what the source actually says. "Unknown" is not a permission.'); return; }
      if (!confirm(`Apply this rights statement to ${recs.length} records from ${instName(src)}? Records already reviewed one by one are not changed.`)) return;
      for (const r of recs) RIGHTS_EDITS[r.id] = { ...d, rightsVerified: true, rightsBy: 'source' };
      logActivity(`Verified rights for ${recs.length} records from ${instName(src)} with one source statement`);
      saveAll(); buildIndex(); render();
    });
    $$('[data-undo-source]').forEach(b => b.onclick = () => {
      const src = b.dataset.undoSource; let n = 0;
      for (const r of RECORDS) if (r.provider === src && RIGHTS_EDITS[r.id]) { delete RIGHTS_EDITS[r.id]; n++; }
      logActivity(`Cleared rights reviews for ${n} records from ${instName(src)}`); saveAll(); buildIndex(); render();
    });
  });
  const pending = PENDING_IMPORTS.filter(r => r.reviewStatus === 'pending');
  const previous = PENDING_IMPORTS.filter(r => r.reviewStatus !== 'pending');
  const harvested = RECORDS.filter(r => r.source !== 'csv' && r.source !== 'demo' && r.source !== 'sub');
  const legacy = harvested.filter(r => !r.rightsVerified);
  return `<p class="lead">CSV imports stay private until approved. Confirm rights ownership, reproduction permission, restrictions and holding location before publication. Existing catalogue records are flagged as unverified; do not assume permission to reuse their content.</p>
    <h2>Pending CSV records (${pending.length})</h2>
    ${pending.length ? pending.map(r => `<details class="rev"><summary>${h(r.title)} · ${h(instName(r.holder))}</summary>
      <form class="form" data-review-record="${h(r.id)}"><p class="meta">${h(r.format)} · ${r.url ? ext(r.url, 'Catalogue') : 'No URL — physical only'}</p>${(d => d.length ? `<p class="notice">Possible duplicate of ${d.slice(0, 3).map(x => `<a href="${href('r/' + x.id)}">${h(x.title)}</a>`).join(', ')}. Check before approving.</p>` : '')(looksLikeExisting(r))}
      ${rightsFields(r)}<label>Physical holding location (when applicable)<input name="physicalLocation" value="${h(r.physicalLocation || '')}"></label>
      <div class="rev-act"><button class="btn btn-secondary" value="save" formnovalidate>Save review details</button><button class="btn btn-primary" value="approve">Approve and publish</button><button class="btn btn-quiet" value="reject" formnovalidate>Reject</button></div></form></details>`).join('') : '<p>No CSV records awaiting review.</p>'}
    ${previous.length ? `<h2>Decided imports</h2><p>${previous.map(r => `${h(r.title)} (${h(r.reviewStatus)})`).join(' · ')}</p>` : ''}
    <h2>Rights for harvested records (${legacy.length} to check)</h2>
    <p class="meta">These came from the institutions' catalogues. Rights usually apply to a whole source, so check each source's terms of use once, then fix single records below if they differ. Fill in what the source actually says. "Unknown" is not a permission.</p>
    ${[...new Set(harvested.map(r => r.provider))].map(src => {
      const all = harvested.filter(r => r.provider === src), todo = all.filter(r => !r.rightsVerified), I = INSTITUTIONS[src];
      return `<article class="panel sub"><div class="row-between"><h3>${h(instName(src))}</h3><span class="status status-${todo.length ? 'pending' : 'approved'}">${all.length - todo.length} of ${all.length} checked</span></div>
        <p class="meta">Find their rights or terms-of-use page ${I?.web ? `starting from ${ext(I.web, 'their website')}` : ''}, then fill this in once for the whole source.</p>
        <details class="rev"><summary>Rights for all ${plural(todo.length, 'unchecked record')} from this source</summary>
          <form class="form" data-source-rights="${h(src)}">${rightsFields({})}<div class="rev-act"><button class="btn btn-primary">Apply to ${plural(todo.length, 'record')}</button>${all.length - todo.length ? `<button type="button" class="btn btn-quiet" data-undo-source="${h(src)}">Clear all reviews for this source</button>` : ''}</div></form></details>
        ${todo.length ? `<details class="rev"><summary>Check records one by one (${todo.length})</summary>${todo.map(r => `<details class="rev"><summary>${h(r.title)} <span class="meta">· ${h(r.dateText || 'no date')}</span></summary>
          <p class="meta"><a href="${href('r/' + r.id)}">Open record page</a>${r.url ? ' · ' + ext(r.url, 'Original catalogue page') : ''}</p>
          <form class="form" data-legacy-rights="${h(r.id)}">${rightsFields(r, true)}<div class="rev-act"><button class="btn btn-secondary" value="save" formnovalidate>Save draft</button><button class="btn btn-primary" value="verify">Mark rights as checked</button></div></form></details>`).join('')}</details>` : ''}
      </article>`; }).join('')}`;
}
function adminSuggestions() {
  onMount(() => {
    $$('form[data-sub-review]').forEach(f => f.onsubmit = e => {
      e.preventDefault(); const s = SUBS.find(x => x.id === f.dataset.subReview); if (!s) return;
      Object.assign(s, Object.fromEntries(new FormData(f)));
      const action = e.submitter?.value || 'save';
      if (action === 'approved') {
        const r = submissionToRecord(s);
        if (!rightsReady({ ...r, physicalLocation: s.physicalLocation })) { alert('Verify rights holder, ownership, permissions, restrictions, evidence and physical location or URL before approval.'); return; }
        s.rightsVerified = true;
      }
      if (action === 'delete') {
        if (!confirm(`Delete “${s.title}”? This removes the suggestion, and its record if it was approved.`)) return;
        SUBS = SUBS.filter(x => x !== s); logActivity(`Deleted suggestion “${s.title}”`); saveAll(); buildIndex(); render(); return;
      }
      if (action !== 'save') { s.status = action; s.decidedAt = new Date().toISOString(); }
      logActivity(`${action} suggestion “${s.title}”`); saveAll(); buildIndex(); render();
    });
  });
  if (!SUBS.length) return `<p class="lead">No suggestions yet. They arrive from the public <a href="${href('suggest')}">Suggest a resource</a> form.</p>`;
  return `<p class="lead">Verify ownership and rights before approving. Unknown copyright or unverified permission is not sufficient.</p>
    ${SUBS.map(s => `<article class="panel sub"><div class="row-between"><h3>${h(s.title)}</h3>${statusWord(s.status)}</div>
      <p class="meta">${h(s.holder)} · ${h(s.format || 'digital')} · ${h(s.physicalLocation || 'No physical location')} · submitted ${new Date(s.at).toLocaleDateString()}</p>
      <p>${h(s.description || '')}</p>${s.url ? `<p>${ext(s.url, 'Submitted link')}</p>` : '<p>Physical-only submission — no URL.</p>'}
      <form class="form" data-sub-review="${h(s.id)}">${rightsFields(s)}
      <div class="rev-act"><button class="btn btn-secondary" value="save" formnovalidate>Save details</button>
      ${s.status !== 'approved' ? `<button class="btn btn-primary" value="approved">Approve</button>` : `<a href="${href('r/sub-' + s.id)}">View record</a>`}
      <button class="btn btn-quiet" value="rejected" formnovalidate>Reject</button><button class="btn btn-quiet" value="pending" formnovalidate>Pending</button><button class="btn btn-quiet danger" value="delete" formnovalidate>Delete</button></div></form></article>`).join('')}`;
}

function adminInstitutions(p) {
  const keys = Object.keys(INSTITUTIONS).filter(k => k !== 'csv').sort((a, b) => recsOf(b).length - recsOf(a).length);
  const placeOpts = sel => `<option value="">None</option>` + Object.keys(PLACES).filter(id => PLACES[id].lat != null).sort((a, b) => PLACES[a].name.localeCompare(PLACES[b].name))
    .map(id => `<option value="${id}" ${sel === id ? 'selected' : ''}>${h(PLACES[id].name)}</option>`).join('');
  // one form layout for both "edit" and "add"
  const fields = (I = {}) => `
    <label>Visitor address<input name="address" value="${h(I.address || '')}" placeholder="Street, town, province"></label>
    <div class="coord-row">
      <label>Latitude<input name="lat" inputmode="decimal" value="${h(I.lat ?? '')}" placeholder="e.g. 44.6488"></label>
      <label>Longitude<input name="lng" inputmode="decimal" value="${h(I.lng ?? '')}" placeholder="e.g. -63.5752"></label>
    </div>
    <p class="meta">With latitude and longitude the map pin sits on the building. Without them it falls back to the community point below.</p>
    <label>Community (fallback pin)<select name="place">${placeOpts(I.place)}</select></label>
    <label>Website<input name="web" type="url" value="${h(I.web || '')}" placeholder="https://"></label>
    <label>How to access<textarea name="access" rows="2">${h(I.access || '')}</textarea></label>`;
  const check = d => {
    const has = d.lat !== '' || d.lng !== '';
    const lat = parseFloat(d.lat), lng = parseFloat(d.lng);
    if (has && !(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return 'Latitude must be between -90 and 90 and longitude between -180 and 180, both filled in.';
    return '';
  };
  onMount(() => {
    $$('form[data-inst]').forEach(f => f.onsubmit = e => {
      e.preventDefault();
      const k = f.dataset.inst, d = Object.fromEntries(new FormData(f)), err = check(d);
      if (err) { $('.form-err', f).textContent = err; $('.form-err', f).hidden = false; return; }
      INST_EDITS[k] = { ...(INST_EDITS[k] || {}), ...d };
      const O = ORIGINAL_INST[k] || {};   // a new pin entered here is the admin's, not OpenStreetMap's
      INST_EDITS[k].pinNote = (+d.lat === O.lat && +d.lng === O.lng) ? (O.pinNote || '') : (d.lat ? 'Pin = exact location (entered in Admin).' : '');
      logActivity(`Updated details for ${INSTITUTIONS[k].name}`); saveAll(); buildIndex(); go('admin/institutions', { saved: k });
    });
    const nf = $('#inst-new');
    nf.onsubmit = e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(nf)), name = d.name.trim();
      const err = !name ? 'Give the institution a name.' : check(d);
      if (err) { $('.form-err', nf).textContent = err; $('.form-err', nf).hidden = false; return; }
      const k = 'inst-' + norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (INSTITUTIONS[k]) { $('.form-err', nf).textContent = 'An institution with that name already exists.'; $('.form-err', nf).hidden = false; return; }
      INST_EDITS[k] = { ...d, name, kind: d.kind.trim() || 'Institution', added: true };
      logActivity(`Added institution ${name}`); saveAll(); buildIndex(); go('admin/institutions', { saved: k });
    };
  });
  return `<p class="lead">Keep visitor details current. They appear on every record the institution holds, and the address links to its pin on the map.</p>
    ${p.saved && INSTITUTIONS[p.saved] ? `<p class="notice">${statusWord('approved')} Saved ${h(INSTITUTIONS[p.saved].name)}. ${hasPin(p.saved) ? `<a href="${href('map', { focus: 'i:' + p.saved })}">See it on the map</a>` : 'No map pin yet: add coordinates or a community.'}</p>` : ''}
    ${keys.map(k => { const I = INSTITUTIONS[k]; const pos = instLatLng(k); return `<details class="rev" ${p.saved === k ? 'open' : ''}><summary><b>${h(I.name)}</b> <span class="meta">${plural(recsOf(k).length, 'record')} · ${pos ? (pos.exact ? 'exact pin' : 'community pin') : 'no pin'}${INST_EDITS[k] ? ' · edited' : ''}</span></summary>
      <form class="form" data-inst="${k}">${fields(I)}<p class="notice notice-rejected form-err" hidden></p><button class="btn btn-secondary">Save</button></form></details>`; }).join('')}
    <section class="inst-new"><h2>Add an institution</h2>
      <form class="form" id="inst-new">
        <label>Name<input name="name" required></label>
        <label>Kind<input name="kind" placeholder="e.g. Community museum, University archives"></label>
        ${fields()}
        <p class="notice notice-rejected form-err" hidden></p>
        <button class="btn btn-primary">Add institution</button>
      </form></section>`;
}

/* ---------- CSV import: a new institution can join with a spreadsheet ---------- */
const CSV_HEADERS = ['id','title','date','link','institution','notes','creator','type','place','format','physical_location','access_instructions','rights_holder','ownership_status','copyright_status','reproduction_permission','rights_source','access_restrictions'];
const SAMPLE_CSV = `${CSV_HEADERS.join(',')}\nDEMO-EXAMPLE,Sample physical archive item,1970,,Demo Archive,Physical-only sample,Unknown,Photograph,Halifax,physical,Archive reading room,Contact archive for appointment,Demo Archive,Institutional custody,Copyrighted,Permission required,Demo curator test assertion,By appointment`;
const CSV_GUESS = { id: /^(id|identifier|record.?id|accession|ref.?no)$/i, title: /title|name|heading/i, dateText: /^date$|year|span/i, url: /^(url|link|uri|web)$/i, holder: /^institution$|^holder$|repository/i, description: /^description$|notes?|scope|summary|abstract/i, creator: /creator|author|photographer|maker/i, resourceType: /^type$|resource.?type/i, placeText: /^place$|community|town/i, format: /^format$|availability.?format/i, physicalLocation: /physical.?location|holding.?address/i, accessNote: /access.?instructions|access.?note/i, rightsHolder: /rights.?holder|copyright.?holder/i, ownershipStatus: /ownership.?status|custody.?status/i, copyrightStatus: /^copyright.?status$/i, reproductionPermission: /reproduction.?permission|reuse.?permission/i, rightsSource: /rights.?source|rights.?evidence/i, accessRestrictions: /access.?restrictions|privacy.?restrictions/i };
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
  return `<p class="lead">Paste a spreadsheet export (CSV). The hub guesses which column is which and shows you before anything is added. Digital records need a URL; physical-only records need a holding location. All imported records await curator approval and rights verification.</p>
    <p><button class="btn btn-secondary" id="csv-sample" type="button">Load a sample</button> <button class="btn btn-secondary" id="csv-download" type="button">Download CSV template</button> <label class="btn btn-quiet">Choose a file<input type="file" id="csv-file" accept=".csv,text/csv" hidden></label></p>
    <label class="sr-only" for="csv-text">CSV text</label><textarea id="csv-text" class="mono" rows="7" placeholder="Paste CSV with title, format, rights and holding location fields"></textarea>
    <div id="csv-map"></div><div id="csv-preview"></div>
    <p>${PENDING_IMPORTS.filter(r => r.reviewStatus === 'pending').length} CSV records pending approval. <a href="${href('admin/record-review')}">Review imported records</a></p>
    ${IMPORTED.length ? `<p>${statusWord('approved')} ${plural(IMPORTED.length, 'record')} imported. <a href="${href('search', { provider: 'csv' })}">See them in search</a> · <button class="linklike" id="csv-clear">Remove imported records</button></p>` : ''}`;
}
function bindImporter() {
  const ta = $('#csv-text');
  $('#csv-sample').onclick = () => { ta.value = SAMPLE_CSV; preview(); };
  $('#csv-download').onclick = () => { const blob = new Blob([CSV_HEADERS.join(',') + '\r\n'], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'connected-histories-import-template.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  $('#csv-file').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => { ta.value = t; preview(); }); };
  const clr = $('#csv-clear'); if (clr) clr.onclick = () => { IMPORTED = []; logActivity('Removed imported records'); saveAll(); buildIndex(); render(); };
  ta.oninput = preview;
  let mapping = {};
  let csvPage = 1;
  let csvPageSize = 10;
  function preview() {
    csvPage = 1;
    const rows = parseCsv(ta.value); if (rows.length < 2) { $('#csv-map').innerHTML = ''; $('#csv-preview').innerHTML = ''; return; }
    const head = rows[0];
    mapping = {};
    for (const [field, re] of Object.entries(CSV_GUESS)) { const i = head.findIndex(c => re.test(c.trim())); if (i >= 0 && !Object.values(mapping).includes(i)) mapping[field] = i; }
    $('#csv-map').innerHTML = `<h2 class="h3">Column mapping</h2><div class="mapgrid">${Object.keys(CSV_GUESS).map(f => `<label>${f}<select data-f="${f}"><option value="">None</option>${head.map((c, i) => `<option value="${i}" ${mapping[f] === i ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></label>`).join('')}</div>`;
    $$('#csv-map select').forEach(s => s.onchange = () => { if (s.value === '') delete mapping[s.dataset.f]; else mapping[s.dataset.f] = +s.value; csvPage = 1; show(); });
    show();
    function show() {
      const recs = rows.slice(1).map((r, n) => csvToRecord(r, mapping, n));
      const ok = recs.filter(r => r.title && ['digital','physical','both'].includes(r.format) && (r.format === 'physical' ? !!r.physicalLocation : /^https?:\/\/[^\s]+$/.test(r.url)) && (r.format !== 'both' || !!r.physicalLocation)), bad = recs.length - ok.length;
      const pages = Math.max(1, Math.ceil(ok.length / csvPageSize));
      csvPage = Math.min(Math.max(1, csvPage), pages);
      const start = (csvPage - 1) * csvPageSize;
      $('#csv-preview').innerHTML = `<h2 class="h3">Preview</h2>
        ${bad ? `<p class="notice notice-rejected">${plural(bad, 'row')} with missing title, format, digital URL or physical location will be skipped.</p>` : ''}
        <div class="dict-list-toolbar"><p class="meta">Showing ${ok.length ? start + 1 : 0}–${Math.min(start + csvPageSize, ok.length)} of ${ok.length} valid records</p><label class="dict-page-size-label">Records per page <select id="csv-page-size" aria-label="CSV preview records per page"><option value="10" ${csvPageSize === 10 ? 'selected' : ''}>10</option><option value="20" ${csvPageSize === 20 ? 'selected' : ''}>20</option></select></label></div>
        <table class="tbl"><thead><tr><th>Title</th><th>Date read as</th><th>Held by</th><th>Linked to</th></tr></thead><tbody>${ok.slice(start, start + csvPageSize).map(r => { const d = parseDate(r.dateText); const l = linkEntities(r).filter(x => x.status === 'confirmed'); return `<tr><td>${h(r.title)}</td><td>${h(r.dateText)} → ${d.start ?? 'none'}</td><td>${h(instName(r.holder))}</td><td>${l.map(x => h(nameOf(x.id))).join(', ') || 'Nothing yet'}</td></tr>`; }).join('')}</tbody></table>
        <nav class="dict-pagination" aria-label="CSV preview pages"><button class="btn btn-secondary" id="csv-prev" type="button" ${csvPage === 1 ? 'disabled' : ''}>Previous</button><span aria-live="polite">Page ${csvPage} of ${pages}</span><button class="btn btn-secondary" id="csv-next" type="button" ${csvPage === pages ? 'disabled' : ''}>Next</button></nav>
        <button class="btn btn-primary" id="csv-go" ${ok.length ? '' : 'disabled'}>Queue ${plural(ok.length, 'record')} for review</button>`;
      $('#csv-page-size').onchange = e => { csvPageSize = Number(e.target.value); csvPage = 1; show(); };
      $('#csv-prev').onclick = () => { if (csvPage > 1) { csvPage--; show(); } };
      $('#csv-next').onclick = () => { if (csvPage < pages) { csvPage++; show(); } };
      const g = $('#csv-go'); if (g) g.onclick = () => {
        const fresh = ok.filter(r => !REC.has(r.id) && !PENDING_IMPORTS.some(x => x.id === r.id));
        PENDING_IMPORTS.push(...fresh.map(r => ({ ...r, reviewStatus: 'pending', rightsVerified: false }))); logActivity(`Queued ${plural(fresh.length, 'CSV record')} for curator review`); saveAll(); buildIndex(); render();
      };
    }
  }
}
function csvToRecord(row, m, n) {
  const g = f => m[f] != null ? (row[m[f]] || '').trim() : '';
  const instText = g('holder');
  const format = (g('format') || (g('url') ? 'digital' : 'physical')).toLowerCase();
  let holder = Object.keys(INSTITUTIONS).find(k => norm(INSTITUTIONS[k].name) === norm(instText));
  if (!holder) {
    holder = 'csv-' + (norm(instText).replace(/\W+/g, '-') || 'unknown');
    INST_EDITS[holder] = INST_EDITS[holder] || { name: instText || 'Unknown institution', kind: 'Added by CSV import', address: g('physicalLocation'), place: '', access: g('accessNote') || 'Visitor details not yet added.' };
    INSTITUTIONS[holder] = { ...INST_EDITS[holder] };
  }
  if (!INSTITUTIONS.csv) INSTITUTIONS.csv = { name: 'CSV import', kind: 'Imported source', access: 'Imported by a curator.' };
  return {
    id: 'csv-' + (g('id') || n), source: 'csv', sourceRecordId: g('id') || String(n),
    title: g('title'), description: g('description'), dateText: g('dateText'),
    resourceType: g('resourceType') || 'Record', resourceTypeRule: 'CSV column', holder, provider: 'csv', url: g('url'), format, physicalLocation: g('physicalLocation'),
    reference: g('id'), creator: g('creator'), collection: 'CSV import', themeKey: 'csv:*', placesText: g('placeText'),
    access: { status: format === 'digital' ? 'Catalogue online' : 'Physical holding', note: g('accessNote') || (format === 'digital' ? 'Check linked catalogue.' : 'Contact the holding institution.') }, image: '',
    rightsHolder: g('rightsHolder'), ownershipStatus: g('ownershipStatus'), copyrightStatus: g('copyrightStatus'), reproductionPermission: g('reproductionPermission'), rightsSource: g('rightsSource'), accessRestrictions: g('accessRestrictions'), rightsVerified: false,
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
      const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), CUR, IMPORTED, PENDING_IMPORTS, RIGHTS_EDITS, SUBS, INST_EDITS, ACTIVITY, KEYWORDS, KEYWORD_SUGGESTIONS, KEYWORD_DISMISSED, KEYWORD_DISABLED, DUPS }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'connected-histories-admin-backup.json'; a.click(); URL.revokeObjectURL(a.href);
    };
    $('#imp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => {
      try { const d = JSON.parse(t); CUR = d.CUR || {}; IMPORTED = d.IMPORTED || []; PENDING_IMPORTS = d.PENDING_IMPORTS || []; RIGHTS_EDITS = d.RIGHTS_EDITS || {}; SUBS = d.SUBS || []; INST_EDITS = d.INST_EDITS || {}; ACTIVITY = d.ACTIVITY || []; KEYWORDS = d.KEYWORDS || []; KEYWORD_SUGGESTIONS = d.KEYWORD_SUGGESTIONS || []; KEYWORD_DISMISSED = d.KEYWORD_DISMISSED || []; KEYWORD_DISABLED = d.KEYWORD_DISABLED || []; DUPS = d.DUPS || {}; applyInstEdits(); logActivity('Restored a backup'); saveAll(); buildIndex(); render(); }
      catch { alert('That file is not a Connected Histories backup.'); } }); };
    $('#reset').onclick = () => { if (!confirm('Remove all decisions, imports, suggestions and edits saved in this browser?')) return;
      CUR = {}; IMPORTED = []; PENDING_IMPORTS = []; RIGHTS_EDITS = {}; SUBS = []; INST_EDITS = {}; ACTIVITY = []; KEYWORDS = []; KEYWORD_SUGGESTIONS = []; KEYWORD_DISMISSED = []; KEYWORD_DISABLED = []; DUPS = {}; for (const k of Object.keys(INSTITUTIONS)) if (!ORIGINAL_INST[k] && k !== 'community') delete INSTITUTIONS[k]; Object.assign(INSTITUTIONS, JSON.parse(JSON.stringify(ORIGINAL_INST))); saveAll(); buildIndex(); render(); };
  });
  return `<p class="lead">Admin changes live in this browser. Download a backup to move them to another computer.</p>
    <p><button class="btn btn-secondary" id="exp">Download backup</button> <label class="btn btn-quiet">Restore from a backup<input type="file" id="imp" accept="application/json" hidden></label></p>
    <p><button class="btn btn-quiet danger" id="reset">Reset everything saved in this browser</button></p>`;
}
