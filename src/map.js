/* Where an institution's pin goes: its own latitude/longitude when an admin has
   entered them (exact), otherwise its community's gazetteer point (approximate). */
function instLatLng(k) {
  const I = INSTITUTIONS[k]; if (!I) return null;
  const lat = parseFloat(I.lat), lng = parseFloat(I.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { ll: [lat, lng], exact: true };
  const P = PLACES[I.place];
  return Number.isFinite(P?.lat) && Number.isFinite(P?.lng) ? { ll: [P.lat, P.lng], exact: false } : null;
}

/* Leaflet map of records → places (circles) + holders (squares) */
function mountRecordsMap(el, recs, opt = {}) {
  if (!el) return;
  if (!window.L) {
    el.innerHTML = '<div class="map-off">The bundled Leaflet library did not initialize. Please reload the page.</div>';
    return;
  }
  const map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
  const holdingOnly = !!opt.holdingOnly;
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
  for (const r of (holdingOnly ? [] : recs)) for (const p of (r.mapped || []).filter(p => Number.isFinite(PLACES[p]?.lat) && Number.isFinite(PLACES[p]?.lng))) { if (!byPlace.has(p)) byPlace.set(p, []); byPlace.get(p).push(r); }
  const holders = new Map();
  for (const r of recs) { const k = r.holder; if (!holders.has(k)) holders.set(k, []); holders.get(k).push(r); }
  if (opt.institutionsOnly && !holdingOnly) for (const k of Object.keys(INSTITUTIONS)) holders.set(k, recsOf(k));
  // opt.focus = 'i:<institution>' or 'p:<place>': make sure it is on the map, then open it
  const [fk, fid] = String(opt.focus || '').split(':');
  if (fk === 'i' && INSTITUTIONS[fid] && !holders.has(fid)) holders.set(fid, recsOf(fid));
  if (!holdingOnly && fk === 'p' && PLACES[fid]?.lat != null && !byPlace.has(fid)) byPlace.set(fid, recsOf(fid));
  const markers = {};
  // lines first (underneath)
  if (opt.lines) for (const [p, rs] of byPlace) {
    const P = PLACES[p];
    for (const k of new Set(rs.map(r => r.holder))) { const pos = instLatLng(k); if (pos && (pos.ll[0] !== P.lat || pos.ll[1] !== P.lng)) L.polyline([[P.lat, P.lng], pos.ll], { color: '#a87f19', weight: 1.4, opacity: .55, dashArray: '4 5' }).addTo(map); }
  }
  for (const [p, rs] of byPlace) {
    const P = PLACES[p];
    const m = L.circleMarker([P.lat, P.lng], { radius: 6 + Math.sqrt(rs.length) * 3.2, color: '#fff', weight: 2, fillColor: p === opt.focusPlace ? '#951814' : '#166411', fillOpacity: .85 }).addTo(map);
    m.bindPopup(`<div class="pop"><b><a href="${href('e/' + p)}">${h(P.name)}</a></b><div class="meta">${rs.length} record(s) · CGNDB <a href="${CGNDB(P.cgndb)}" target="_blank" rel="noopener">${P.cgndb}</a></div>
      <ul>${rs.slice(0, 6).map(r => `<li><a href="${href('r/' + r.id)}">${h(r.title.slice(0, 70))}</a> <span class="muted">${h(r.dateText || '')}</span></li>`).join('')}</ul>
      ${rs.length > 6 ? `<a href="${href('search', { place: p })}">All ${rs.length} →</a>` : ''}${P.note ? `<div class="meta">${h(P.note)}</div>` : ''}</div>`);
    m.bindTooltip(`${P.name} · ${rs.length}`);
    markers['p:' + p] = m;
    bounds.push([P.lat, P.lng]);
  }
  // institutions (squares)
  const sq = L.divIcon({ className: 'inst-icon', html: '<span></span>', iconSize: [16, 16], iconAnchor: [8, 8] });
  const placed = new Map();
  for (const [k, rs] of holders) {
    const I = INSTITUTIONS[k], pos = instLatLng(k); if (!pos || (holdingOnly && !pos.exact)) continue;
    let ll = pos.ll;
    if (!pos.exact) { const off = placed.get(I.place) || 0; placed.set(I.place, off + 1); ll = [ll[0] + off * 0.012, ll[1] + off * 0.018]; }   // nudge institutions sharing a community point
    const tooltip = `<b>${h(I.name)}</b><br>${h(I.address || 'Street address not available')}`;
    const marker = L.marker(ll, { icon: sq }).addTo(map)
      .bindTooltip(tooltip, { direction: 'top', opacity: .97 });
    if (!holdingOnly) marker.bindPopup(`<div class="pop"><b><a href="${href('e/' + k)}">${h(I.name)}</a></b><div class="meta">${h(I.address || 'Address not confirmed')}</div><div class="meta">${h(I.access)}</div><div class="meta">${rs.length} record(s) here</div><div class="meta">${pos.exact ? 'Pin = exact location.' : `Pin = ${h(PLACES[I.place].name)} community point, not the building.`}</div></div>`);
    markers['i:' + k] = marker;
    bounds.push(ll);
  }
  const pb = [...byPlace.keys()].map(p => [PLACES[p].lat, PLACES[p].lng]);   // frame the places; far-away holders show as lines running off-map
  if (pb.length > 1) map.fitBounds(pb, { padding: [40, 40], maxZoom: 11 });
  else if (pb.length === 1) map.setView(pb[0], 10);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
  else if (bounds.length === 1) map.setView(bounds[0], 10);
  else map.setView([44.9, -63.5], 7);
  const fm = markers[opt.focus];
  if (fm) map.setView(fm.getLatLng(), 14);
  if (holdingOnly && !bounds.length) {
    status.textContent = 'An exact holding location has not been verified. See the record details for the known address or contact information.';
    status.hidden = false;
  }
  requestAnimationFrame(() => { if (active) { map.invalidateSize(); if (fm && !holdingOnly) fm.openPopup(); } });
  const sizeTimer = setTimeout(() => { if (active) map.invalidateSize(); }, 180);
  CLEANUP.push(() => clearTimeout(sizeTimer));
}
