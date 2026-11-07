/* =====================================================================
   graph.js — tiny force-directed knowledge graph on <canvas>
   ---------------------------------------------------------------------
   No library: keeps the single HTML file portable and offline-friendly.
   How it works, in plain words:
     • every node pushes every other node away (repulsion)
     • every edge pulls its two nodes together like a spring
     • a weak pull toward the centre stops things drifting off
     • each tick the movement shrinks ("cooling") until it settles
   Hover a node → it and its direct neighbours light up, the rest fade.
   ===================================================================== */

const TYPE_STYLE = {
  person:       { color: '#951814', label: 'Person' },
  place:        { color: '#166411', label: 'Place' },
  organization: { color: '#a87f19', label: 'Organization' },
  event:        { color: '#2e4a7d', label: 'Event / meeting' },
  topic:        { color: '#7a6f60', label: 'Topic' },
  institution:  { color: '#1b1611', label: 'Holding institution' },
  record:       { color: '#c4b8a3', label: 'Record' }
};

function createGraph(canvas, opts) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  const nodes = opts.nodes.map(n => ({ ...n, x: (Math.random() - .5) * 400, y: (Math.random() - .5) * 400, vx: 0, vy: 0 }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges = opts.edges.filter(e => byId.has(e.s) && byId.has(e.t)).map(e => ({ ...e, a: byId.get(e.s), b: byId.get(e.t) }));
  const nbrs = new Map(nodes.map(n => [n.id, new Set()]));
  for (const e of edges) { nbrs.get(e.s).add(e.t); nbrs.get(e.t).add(e.s); }

  let view = { x: 0, y: 0, k: 1 };          // pan + zoom
  let hover = null, pinned = null, dragging = null, panning = null;
  let highlight = null;                      // Set of ids from search
  let visible = () => true;                  // filter function
  let alpha = 1;                             // "temperature" of the simulation
  let raf = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    draw();
  }

  /* ---------- physics ---------- */
  function tick() {
    const vis = nodes.filter(n => visible(n));
    const rep = opts.repulsion || 900;
    for (let i = 0; i < vis.length; i++) {
      const a = vis[i];
      for (let j = i + 1; j < vis.length; j++) {
        const b = vis[j];
        let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + .01;
        if (d2 > 360000) continue;              // ignore far pairs (speed)
        const f = rep / d2;
        dx *= f; dy *= f;
        a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
      }
    }
    for (const e of edges) {
      if (!visible(e.a) || !visible(e.b)) continue;
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const rest = (e.kind === 'rel' ? 80 : 120) * (opts.spread || 1);
      const f = (d - rest) * 0.01 * Math.min(2.5, e.w || 1);
      const fx = dx / d * f, fy = dy / d * f;
      e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
    }
    for (const n of vis) {
      n.vx -= n.x * 0.0025; n.vy -= n.y * 0.0025;     // gentle gravity to centre
      if (n === dragging) { n.vx = n.vy = 0; continue; }
      n.x += n.vx * alpha; n.y += n.vy * alpha;
      n.vx *= 0.82; n.vy *= 0.82;
    }
    alpha = Math.max(0.02, alpha * 0.985);
  }

  /* ---------- drawing ---------- */
  const toScreen = n => [(n.x * view.k + view.x) + W / 2, (n.y * view.k + view.y) + H / 2];
  function activeSet() {
    const focus = hover || pinned;
    if (focus) return new Set([focus.id, ...nbrs.get(focus.id)]);
    if (highlight && highlight.size) { const s = new Set(highlight); for (const id of highlight) for (const x of nbrs.get(id) || []) s.add(x); return s; }
    return null;
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const act = activeSet();
    // edges
    for (const e of edges) {
      if (!visible(e.a) || !visible(e.b)) continue;
      const on = act ? (act.has(e.a.id) && act.has(e.b.id) && (!(hover || pinned) || e.a === (hover || pinned) || e.b === (hover || pinned))) : false;
      const [x1, y1] = toScreen(e.a), [x2, y2] = toScreen(e.b);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = on ? (e.kind === 'rel' ? '#a87f19' : '#6b6256') : (act ? 'rgba(120,110,95,.06)' : (e.kind === 'rel' ? 'rgba(168,127,25,.45)' : 'rgba(120,110,95,.18)'));
      ctx.lineWidth = on ? 2 : (e.kind === 'rel' ? 1.3 : 0.8);
      if (e.kind !== 'rel') ctx.setLineDash([3, 3]); else ctx.setLineDash([]);
      ctx.stroke();
      if (on && e.label && view.k > .55) {
        ctx.setLineDash([]);
        ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillStyle = '#7a5c10';
        ctx.fillText(e.label, (x1 + x2) / 2 + 4, (y1 + y2) / 2 - 4);
      }
    }
    ctx.setLineDash([]);
    // nodes (big first, so their labels win when space is tight)
    const boxes = [];
    const order = [...nodes].sort((a, b) => b.r - a.r);
    const labelQueue = [];
    for (const n of order) {
      if (!visible(n)) continue;
      const [x, y] = toScreen(n);
      const r = n.r * Math.max(.6, Math.min(1.6, view.k));
      const dim = act && !act.has(n.id);
      ctx.globalAlpha = dim ? .12 : 1;
      ctx.beginPath();
      if (n.type === 'institution') ctx.rect(x - r, y - r, r * 2, r * 2); else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = TYPE_STYLE[n.type]?.color || '#888'; ctx.fill();
      if (n === hover || n === pinned || (highlight && highlight.has(n.id))) { ctx.lineWidth = 3; ctx.strokeStyle = '#f2c94c'; ctx.stroke(); }
      else { ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      const showLabel = !dim && (act ? act.has(n.id) : (opts.allLabels || n.r >= 8 || view.k > 1.3));
      if (showLabel) labelQueue.push([n, x, y, r]);
      ctx.globalAlpha = 1;
    }
    // labels last, skipping any that would overlap one already drawn
    for (const [n, x, y, r] of labelQueue) {
      const strong = n === hover || n === pinned;
      ctx.font = `${strong ? 700 : 500} ${n.r >= 11 ? 13 : 11.5}px Inter, system-ui, sans-serif`;
      const label = n.label.length > 34 ? n.label.slice(0, 33) + '…' : n.label;
      const w = ctx.measureText(label).width, bx = x + r + 4, by = y - 9, bh = 15;
      if (!strong && boxes.some(b => bx < b[0] + b[2] && bx + w > b[0] && by < b[1] + b[3] && by + bh > b[1])) continue;
      boxes.push([bx, by, w, bh]);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(251,248,241,.92)'; ctx.strokeText(label, bx, y + 4);
      ctx.fillStyle = '#1b1611'; ctx.fillText(label, bx, y + 4);
    }
  }
  function loop() { if (alpha > 0.021 || dragging) tick(); draw(); raf = requestAnimationFrame(loop); }

  /* ---------- interaction ---------- */
  function nodeAt(px, py) {
    let best = null, bd = Infinity;
    for (const n of nodes) {
      if (!visible(n)) continue;
      const [x, y] = toScreen(n); const d = (x - px) ** 2 + (y - py) ** 2;
      const r = n.r * Math.max(.6, Math.min(1.6, view.k)) + 4;
      if (d < r * r && d < bd) { best = n; bd = d; }
    }
    return best;
  }
  const pos = ev => { const r = canvas.getBoundingClientRect(); const p = ev.touches ? ev.touches[0] : ev; return [p.clientX - r.left, p.clientY - r.top]; };
  let downAt = null;
  canvas.addEventListener('pointerdown', ev => {
    const [x, y] = pos(ev); downAt = [x, y];
    const n = nodeAt(x, y);
    if (n) { dragging = n; alpha = Math.max(alpha, .3); } else panning = [x, y, view.x, view.y];
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', ev => {
    const [x, y] = pos(ev);
    if (dragging) { dragging.x = (x - W / 2 - view.x) / view.k; dragging.y = (y - H / 2 - view.y) / view.k; return; }
    if (panning) { view.x = panning[2] + x - panning[0]; view.y = panning[3] + y - panning[1]; return; }
    const n = nodeAt(x, y);
    if (n !== hover) { hover = n; canvas.style.cursor = n ? 'pointer' : 'grab'; opts.onHover && opts.onHover(n); }
  });
  canvas.addEventListener('pointerup', ev => {
    const [x, y] = pos(ev);
    const moved = downAt && Math.hypot(x - downAt[0], y - downAt[1]) > 5;
    if (!moved) {
      const n = nodeAt(x, y);
      pinned = n || null;
      opts.onClick && opts.onClick(n);
    }
    dragging = null; panning = null;
  });
  canvas.addEventListener('pointerleave', () => { hover = null; opts.onHover && opts.onHover(pinned); });
  canvas.addEventListener('dblclick', ev => { const [x, y] = pos(ev); const n = nodeAt(x, y); if (n && opts.onOpen) opts.onOpen(n); });
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const [x, y] = pos(ev);
    const k2 = Math.max(.25, Math.min(4, view.k * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
    // zoom around the cursor
    view.x = x - W / 2 - (x - W / 2 - view.x) * (k2 / view.k);
    view.y = y - H / 2 - (y - H / 2 - view.y) * (k2 / view.k);
    view.k = k2;
  }, { passive: false });

  const ro = new ResizeObserver(resize); ro.observe(canvas);
  resize();
  for (let i = 0; i < 260; i++) tick();     // settle before first paint
  // fit to view
  function fit(ids) {
    const list = nodes.filter(n => visible(n) && (!ids || ids.has(n.id)));
    if (!list.length) return;
    const xs = list.map(n => n.x), ys = list.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const k = Math.min(1.6, Math.max(.3, Math.min(W / (maxX - minX + 160), H / (maxY - minY + 120))));
    view.k = k; view.x = -((minX + maxX) / 2) * k; view.y = -((minY + maxY) / 2) * k;
  }
  fit();
  loop();

  return {
    highlight(ids) { highlight = ids && ids.size ? ids : null; if (highlight) fit(activeSet()); else fit(); },
    focus(id) { const n = byId.get(id); if (n) { pinned = n; fit(new Set([id, ...nbrs.get(id)])); opts.onClick && opts.onClick(n); } },
    setFilter(fn) { visible = fn; alpha = .6; },
    reheat() { alpha = .8; },
    fit: () => fit(),
    neighbours: id => nbrs.get(id) || new Set(),
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); }
  };
}
