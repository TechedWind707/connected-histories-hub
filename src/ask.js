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
    const and = pool.filter(r => pq.found.every(id => publicLinks(r).some(l => l.id === id) || r.holder === id));
    pool = and.length ? and : pool.filter(r => pq.found.some(id => publicLinks(r).some(l => l.id === id)));
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
  const understood = [...pq.found.map(id => chip(id)), pq.from || pq.to ? `<span class="tag">${pq.from ?? '…'}–${pq.to ?? '…'}</span>` : '', ...[...new Set(pq.types)].slice(0, 2).map(t => `<span class="tag">${h(t)}</span>`), ...pq.insts.map(k => `<span class="tag">${h(instName(k))}</span>`)].filter(Boolean).join(' ');
  const lines = [];
  if (!hits.length) {
    const near = entityMatches(pq.leftover.join(' '), 5);
    return { html: `<p><b>No record in the hub answers that.</b> Rather than guess, here is what was understood.</p>
      ${understood ? `<p class="meta">I understood: ${understood}</p>` : ''}
      ${pq.leftover.length ? `<p class="meta">No record mentions: ${pq.leftover.map(t => `<code>${h(t)}</code>`).join(' ')}</p>` : ''}
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
    for (const r of hits) for (const l of publicLinks(r)) if (l.kind === 'person' && !pq.found.includes(l.id)) { if (!ppl.has(l.id)) ppl.set(l.id, r); }
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
      ${ctx.length ? `<section class="quotes">${ctx.map(([id, [t, l, u]]) => `<blockquote><p>“${h(t)}”</p><footer>${ext(u, h(l))}</footer></blockquote>`).join('')}</section>` : ''}`,
    cites, hits, pq
  };
}

let LLM = { key: '', model: 'claude-sonnet-4-5' };     // key kept in memory only — never saved
function viewAsk(p) {
  const a = composeAnswer(p.ask);
  onMount(bindSearchBox);
  return `<div class="wrap page search-page">
    ${searchBox(p.ask, 'ask')}
    <div class="two">
      <section class="answer">
        <h1 class="h2">${h(p.ask)}</h1>
        ${a.html}
        <p class="meta">This answer is built only from the sources listed. Nothing is added from general knowledge.</p>
      </section>
      <aside class="side"><section class="panel">
        <h2 class="h3">Sources (${a.cites.length})</h2>
        <ol class="srcs">${a.cites.map(r => `<li><a href="${href('r/' + r.id)}">${h(r.title)}</a><span class="meta">${h(r.dateText || 'Date not recorded')} · ${h(instName(r.holder))}</span></li>`).join('')}</ol>
        ${a.hits.length > a.cites.length ? `<a href="${href('search', { q: [...a.pq.found.map(nameOf), ...a.pq.leftover].join(' '), from: a.pq.from ?? '', to: a.pq.to ?? '' })}">See all ${a.hits.length} matching records</a>` : ''}
      </section></aside>
    </div></div>`;
}

async function askClaude(question, recs) {
  const context = recs.map((r, i) => `[${i + 1}] ${JSON.stringify({ title: r.title, date: r.dateText, type: r.resourceType, holder: instName(r.holder), description: r.description, reference: r.reference, collection: r.collection, access: r.access.note, people_places_topics: publicLinks(r).map(l => nameOf(l.id)) })}`).join('\n');
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
    <p class="meta">Grounding check: ${kept.length} sentence(s) kept${dropped.length ? `, <b>${dropped.length} removed</b> for missing or invalid citations` : ''}. Citation numbers refer to the Sources list.</p></div>`;
}
