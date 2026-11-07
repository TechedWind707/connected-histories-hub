/* =====================================================================
   widgets.js — featured carousel and the mini knowledge graph
   (the Leaflet map lives in map.js)
   ===================================================================== */

/* ---------- Featured carousel ----------------------------------------
   All slides sit in the SAME grid cell, so the carousel is always as tall
   as its tallest slide: no fixed height, nothing gets cut off. Layout
   switches on the carousel's own width (container query), not the
   window's, which is why opening DevTools no longer changes it.        */
function mountCarousel() {
  const el = $('#carousel'); if (!el) return;
  const items = FEATURED.filter(f => node(f.id) && recsOf(f.id).length);  // see the image check below
  let i = 0, timer = 0;
  el.innerHTML = `<div class="car-track">${items.map((feat, k) => {
    let f = feat;
    const n = node(f.id), recs = recsOf(f.id), st = (n.statements || [])[0];
    // only show a picture that really belongs to this entity, and describe THAT record
    const imgRec = f.imgRecord && recs.find(r => r.id === f.imgRecord);
    if (!imgRec) f = { ...f, img: '' };
    const quote = st ? (st[0].length > 240 ? st[0].slice(0, 238).replace(/\s+\S*$/, '') + '…' : st[0]) : '';
    return `<a class="slide ${k === 0 ? 'on' : ''} ${f.img ? 'with-img' : 'with-list'}" href="${href('e/' + f.id)}" aria-hidden="${k !== 0}" ${k !== 0 ? 'tabindex="-1"' : ''}>
      <div class="slide-text">
        <p class="meta">${h(f.kicker)}</p>
        <h3>${h(n.name)}</h3>
        ${quote ? `<p class="slide-quote">“${h(quote)}”</p><p class="meta">${h(st[1])}</p>` : `<p class="slide-quote">${h((imgRec || recs[0]).title)}</p><p class="meta">${h((imgRec || recs[0]).dateText || 'Date not recorded')} · ${h(instName((imgRec || recs[0]).holder))}</p>`}
        <p class="slide-foot">${plural(recs.length, 'record')} from ${plural(new Set(recs.map(r => r.holder)).size, 'institution')} <span class="slide-go">Explore</span></p>
      </div>
      ${!f.img ? `<div class="slide-list"><p class="meta">In the records</p><ul>${[...new Map(recs.filter(r => r.dateStart != null).concat(recs).map(r => [r.title, r])).values()].slice(0, 3).map(r => `<li>${h(r.title)}<span class="meta">${h(r.dateText || 'Date not recorded')} · ${h(instName(r.holder))}</span></li>`).join('')}</ul></div>` : ''}
      ${f.img ? `<figure class="slide-fig"><img src="${h(f.img)}" alt="" loading="lazy" onerror="this.closest('.slide').classList.remove('with-img');this.parentNode.remove()"><figcaption>${h(f.imgCredit)}</figcaption></figure>` : ''}
    </a>`;
  }).join('')}</div>
  <div class="car-ctl"><button class="btn btn-quiet" data-d="-1" aria-label="Previous">Previous</button>
    <span class="car-dots">${items.map((_, k) => `<button class="dot ${k === 0 ? 'on' : ''}" data-k="${k}" aria-label="Show ${h(node(items[k].id).name)}"></button>`).join('')}</span>
    <button class="btn btn-quiet" data-d="1" aria-label="Next">Next</button></div>`;
  const show = k => {
    i = (k + items.length) % items.length;
    $$('.slide', el).forEach((s, j) => { s.classList.toggle('on', j === i); s.setAttribute('aria-hidden', j !== i); s.tabIndex = j === i ? 0 : -1; });
    $$('.dot', el).forEach((d, j) => d.classList.toggle('on', j === i));
  };
  $$('.car-ctl button', el).forEach(b => b.onclick = () => { show(b.dataset.k != null ? +b.dataset.k : i + +b.dataset.d); restart(); });
  const restart = () => { clearInterval(timer); timer = setInterval(() => { if (!carouselShouldPause(el)) show(i + 1); }, 7000); };
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

/* ---------- Mini knowledge graph --------------------------------------
   Shows ONE thing in the middle and only what is DIRECTLY connected to it.
   - { focus: id }            → an entity and its direct neighbours
   - { query, records }       → the search words in the middle, joined to
                                 the people/places/topics most common in
                                 the results
   Gold lines = a relationship with a cited source. Grey = appear in the
   same records (the number is how many).                               */
function neighboursOf(id, limit = 14) {
  const out = new Map();
  for (const [a, label, b, el, eu] of RELATIONS) {
    if (a === id && node(b)) out.set(b, { id: b, kind: 'rel', label, w: 99, el, eu, dir: 'out' });
    if (b === id && node(a)) out.set(a, { id: a, kind: 'rel', label, w: 99, el, eu, dir: 'in' });
  }
  for (const [k, c] of CO) {
    const [a, b] = k.split('|'); const other = a === id ? b : b === id ? a : null;
    if (other && node(other) && !out.has(other)) out.set(other, { id: other, kind: 'co', label: plural(c, 'shared record'), w: c });
  }
  return [...out.values()].sort((x, y) => y.w - x.w).slice(0, limit);
}
function mountMiniGraph(el, opt) {
  if (!el) return;
  let centre, nbrs;
  if (opt.focus) {
    const n = node(opt.focus); if (!n) { el.innerHTML = ''; return; }
    centre = { id: opt.focus, label: n.name, type: n.type };
    nbrs = neighboursOf(opt.focus, 10);
  } else {
    const count = new Map();
    for (const r of (opt.records || []).slice(0, 60)) for (const l of publicLinks(r)) if (l.kind !== 'topic' || true) count.set(l.id, (count.get(l.id) || 0) + 1);
    centre = { id: '__q', label: opt.query ? `“${opt.query}”` : 'Results', type: 'query' };
    nbrs = [...count].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, c]) => ({ id, kind: 'co', label: plural(c, 'result'), w: c }));
  }
  if (!nbrs.length) { el.innerHTML = '<p class="meta">Nothing is linked to this yet.</p>'; return; }
  el.innerHTML = '<canvas aria-label="Connections graph"></canvas><div class="mg-detail" aria-live="polite"></div><ul class="sr-only"></ul>';
  // screen-reader / no-canvas fallback: the same connections as a list
  $('ul', el).innerHTML = nbrs.map(x => `<li><a href="${href('e/' + x.id)}">${h(nameOf(x.id))}</a> (${h(x.label)})</li>`).join('');
  const canvas = $('canvas', el);
  canvas.style.height = '270px';
  // radial layout: the centre in the middle, neighbours evenly around it (no drifting)
  const nodes = [{ ...centre, r: 13, x: 0, y: 0 }, ...nbrs.map((x, i) => {
    const n = node(x.id), a = -Math.PI / 2 + i * 2 * Math.PI / nbrs.length, rad = i % 2 ? 120 : 96;
    return { id: x.id, label: n.name, type: n.type, r: x.kind === 'rel' ? 8 : 5 + Math.min(5, Math.sqrt(x.w) * 1.5), x: Math.cos(a) * rad * 1.1, y: Math.sin(a) * rad };
  })];
  const edges = nbrs.map(x => ({ s: centre.id, t: x.id, kind: x.kind === 'rel' ? 'rel' : 'co', w: x.kind === 'rel' ? 2 : 1, label: x.label }));
  const g = createGraph(canvas, {
    nodes, edges, fixed: true, allLabels: true, labelMax: 22, fitPad: 190,
    centreId: centre.id,
    // click an outer node → show how it connects (click the centre or empty space to clear)
    onClick: n => showDetail(n && n.id !== centre.id ? n : null),
    onOpen: n => { if (n && n.id !== '__q') go('e/' + n.id); }
  });
  const box = $('.mg-detail', el);
  function showDetail(n) {
    if (!n) { box.innerHTML = '<p class="meta">Select a name to see how it connects.</p>'; return; }
    const x = nbrs.find(y => y.id === n.id), N = node(n.id);
    const how = x.kind === 'rel'
      ? (x.dir === 'out' ? `${h(centre.label)} ${h(x.label)} ${h(N.name)}` : `${h(N.name)} ${h(x.label)} ${h(centre.label)}`)
      : `Appears with ${h(centre.label)} in ${h(x.label)}`;
    const src = x.kind === 'rel' && x.eu ? `<p class="meta">Source: ${/^https?:/.test(x.eu) ? ext(x.eu, h(x.el)) : `<a href="${href('r/' + x.eu)}">${h(x.el)}</a>`}</p>` : '';
    box.innerHTML = `<p class="mg-name">${h(N.name)} <span class="meta">${typeLabel(N.type)}</span></p><p>${how}.</p>${src}<a class="ext" href="${href('e/' + n.id)}">Open ${h(N.name)}</a>`;
  }
  showDetail(null);
  CLEANUP.push(() => g.destroy());
}
