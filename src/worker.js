// Property and Technology directory.
// A Cloudflare Worker that reads the public fields from Supabase and renders
// plain HTML pages. No build step: this file is the whole server.
//
// Settings live in wrangler.jsonc under "vars":
//   SUPABASE_URL     the project's API address
//   SUPABASE_KEY     the publishable key (safe to publish; the database only
//                    lets it read the free fields)
//   HUB_URL          the Property and Technology hub
//   REPORT_FORM_URL  the "Report incorrect info" form. A pre-filled link ending
//                    in "=" gets the company name added; "" hides the link
//   ANALYTICS_TOKEN  Cloudflare Web Analytics site token (cookie-less visitor
//                    counts). "" leaves tracking off

const NEWSLETTER = 'https://evanprothro-newsletter.beehiiv.com/subscribe?utm_source=propertyandtechnology&utm_medium=directory';
const JOBS = 'https://www.propertyandtechnologyjobs.com/?utm_source=propertyandtechnology&utm_medium=directory';

const LIST_FIELDS = 'id,slug,name,company_type,segment,hq_city,hq_state,units_owned_range,units_managed_range,open_roles,market_count,leader_count,merged_into';
const DETAIL_FIELDS = [
  'id,slug,name,company_type,segment,description,website,careers_url,hq_city,hq_state',
  'units_owned_range,units_managed_range,open_roles,market_count,operating_states',
  'scale_as_of,scale_note,leader_count,merged_into,last_verified_at',
  'markets:company_markets(market:markets(slug,name))',
  'units_source:sources!companies_units_source_id_fkey(url,title,publisher)',
  'markets_source:sources!companies_markets_source_id_fkey(url,title,publisher)',
  'profile_source:sources!companies_profile_source_id_fkey(url,title,publisher)',
].join(',');

const BANDS = ['50,000+', '25,000-50,000', '10,000-25,000', '5,000-10,000', '1,000-5,000', 'Under 1,000'];
const TYPE_LABEL = { operator: 'Operator', proptech: 'Proptech', capital: 'Capital', other: 'Other real estate', unclassified: 'Unclassified' };
// Rental operators lead every list; other real estate firms come last.
const TYPE_ORDER = { operator: 0, proptech: 1, capital: 2, other: 3, unclassified: 4 };

// Default list order: rental operators first, then largest unit band first,
// then most open roles, then name. A company with no unit band sorts after
// the smallest band.
const bandRank = (c) => {
  const ranks = [c.units_owned_range, c.units_managed_range].map((b) => BANDS.indexOf(b)).filter((i) => i >= 0);
  return ranks.length ? Math.min(...ranks) : BANDS.length;
};
const bySize = (a, b) =>
  (TYPE_ORDER[a.company_type] ?? 9) - (TYPE_ORDER[b.company_type] ?? 9) ||
  bandRank(a) - bandRank(b) ||
  (b.open_roles || 0) - (a.open_roles || 0) ||
  a.name.localeCompare(b.name);

// ---------- helpers ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const band = (c) => c.units_owned_range || c.units_managed_range || '';
const bandKind = (c) => (c.units_owned_range ? 'owned' : c.units_managed_range ? 'managed' : '');
const hq = (c) => [c.hq_city, c.hq_state].filter(Boolean).join(', ');
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

async function db(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: env.SUPABASE_KEY } });
  if (!res.ok) throw new Error(`Database request failed (${res.status})`);
  return res.json();
}

let listCache = { at: 0, rows: null };
async function allCompanies(env) {
  if (listCache.rows && Date.now() - listCache.at < 60_000) return listCache.rows;
  const rows = await db(env, `companies?select=${LIST_FIELDS}&merged_into=is.null&order=open_roles.desc.nullslast,name.asc&limit=5000`);
  rows.sort(bySize);
  listCache = { at: Date.now(), rows };
  return rows;
}

// ---------- page shell ----------

function page(env, { title, description, path, body }) {
  const hub = esc(env.HUB_URL || '/');
  const token = /^[a-f0-9]{16,64}$/i.test(env.ANALYTICS_TOKEN || '') ? env.ANALYTICS_TOKEN : '';
  const beacon = token
    ? `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${token}"}'></script>\n`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0B0618">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<nav>
  <a class="brand" href="${hub}">
    <img class="logo-mark" src="/logo-mark.png" alt="" width="34" height="34">
    <span class="logo">Property and Technology</span>
  </a>
  <div class="navlinks">
    <a href="/"${path === '/' ? ' aria-current="page"' : ''}>Directory</a>
    <a href="/markets"${path.startsWith('/markets') ? ' aria-current="page"' : ''}>Markets</a>
    <a href="${esc(JOBS)}" target="_blank" rel="noopener noreferrer">Jobs</a>
    <a class="cta" href="${esc(NEWSLETTER)}" target="_blank" rel="noopener noreferrer">Subscribe</a>
  </div>
</nav>
<main>
${body}
</main>
<footer>
  <div class="fmeta">
    <a href="${hub}">Property and Technology</a>
    <a href="/">Directory</a>
    <a href="/markets">Markets</a>
    <a href="${esc(JOBS)}" target="_blank" rel="noopener noreferrer">Jobs</a>
    <a href="${esc(NEWSLETTER)}" target="_blank" rel="noopener noreferrer">Newsletter</a>
  </div>
  <p class="fnote">Figures come from company sites and public filings, with a source on each profile. Unit counts are shown as bands.</p>
</footer>
${beacon}</body>
</html>`;
}

const html = (body, status = 200, maxAge = 300) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` } });

function companyRow(c) {
  const b = band(c);
  return `<a class="row" href="/companies/${esc(c.slug)}">
    <span class="r-name"><span class="r-title">${esc(c.name)}</span><span class="r-seg">${esc(c.segment || '')}</span></span>
    <span class="r-type"><span class="pill ${c.company_type === 'operator' ? 'open' : ''}">${esc(TYPE_LABEL[c.company_type] || c.company_type)}</span></span>
    <span class="r-cell" data-label="HQ">${esc(hq(c)) || '<i>n/a</i>'}</span>
    <span class="r-cell" data-label="Units">${b ? esc(b) : '<i>n/a</i>'}</span>
    <span class="r-cell" data-label="Markets">${c.market_count ? num(c.market_count) : '<i>n/a</i>'}</span>
    <span class="r-cell r-roles" data-label="Open roles">${c.open_roles ? num(c.open_roles) : '<i>0</i>'}</span>
  </a>`;
}

const rowsHead = `<div class="row row-head" aria-hidden="true">
    <span>Company</span><span>Type</span><span>HQ</span><span>Units</span><span>Markets</span><span>Open roles</span>
  </div>`;

// ---------- pages ----------

async function listPage(env, url) {
  const all = await allCompanies(env);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const type = url.searchParams.get('type') || '';
  const state = url.searchParams.get('state') || '';
  const bandSel = url.searchParams.get('band') || '';
  const hiring = url.searchParams.get('hiring') === '1';

  const rows = all.filter((c) =>
    (!type || c.company_type === type) &&
    (!state || c.hq_state === state) &&
    (!bandSel || band(c) === bandSel) &&
    (!hiring || (c.open_roles || 0) > 0) &&
    (!q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.segment || '').toLowerCase().includes(q.toLowerCase())));

  const states = [...new Set(all.map((c) => c.hq_state).filter(Boolean))].sort();
  const operators = all.filter((c) => c.company_type === 'operator').length;
  const proptech = all.filter((c) => c.company_type === 'proptech').length;
  const others = all.length - operators - proptech;
  const roles = all.reduce((n, c) => n + (c.open_roles || 0), 0);
  const filtered = q || type || state || bandSel || hiring;
  const opt = (v, label, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(label)}</option>`;

  const body = `<section class="hero">
  <div class="eyebrow">Directory</div>
  <h1>Who runs <span class="grad">scattered site rentals</span>, and who sells to them.</h1>
  <p class="sub">${num(operators)} rental operators and ${num(proptech)} proptech companies, with unit bands, markets and ${num(roles)} open roles${others ? `, plus ${num(others)} other real estate firms` : ''}. Free while we build it out.</p>
</section>

<section class="wrap">
  <form class="filters" method="get" action="/">
    <label class="f-search"><span>Search</span><input type="search" name="q" value="${esc(q)}" placeholder="Company or segment"></label>
    <label><span>Type</span><select name="type">${opt('', 'All types', type)}${opt('operator', 'Operators', type)}${opt('proptech', 'Proptech', type)}${opt('other', 'Other real estate', type)}</select></label>
    <label><span>HQ state</span><select name="state">${opt('', 'All states', state)}${states.map((s) => opt(s, s, state)).join('')}</select></label>
    <label><span>Units</span><select name="band">${opt('', 'Any size', bandSel)}${BANDS.map((b) => opt(b, b, bandSel)).join('')}</select></label>
    <label class="f-check"><input type="checkbox" name="hiring" value="1"${hiring ? ' checked' : ''}><span>Hiring now</span></label>
    <button class="btn primary" type="submit">Apply</button>
    ${filtered ? '<a class="btn" href="/">Clear</a>' : ''}
  </form>

  <p class="count">${num(rows.length)} ${rows.length === 1 ? 'company' : 'companies'}${filtered ? ' match' : ''}</p>
  <div class="rows">
  ${rowsHead}
  ${rows.map(companyRow).join('\n  ') || '<p class="empty">No companies match those filters.</p>'}
  </div>
</section>`;

  return html(page(env, {
    title: 'Scattered site rental directory | Property and Technology',
    description: `${operators} rental operators and ${proptech} proptech companies, with unit bands, markets and open roles.`,
    path: '/', body,
  }));
}

function sourceLine(label, s) {
  const u = safeUrl(s && s.url);
  return u ? `<li><span>${esc(label)}</span><a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${esc(s.publisher || host(u))}</a></li>` : '';
}

async function companyPage(env, slug) {
  const found = await db(env, `companies?slug=eq.${encodeURIComponent(slug)}&select=${DETAIL_FIELDS}&limit=1`);
  const c = found[0];
  if (!c) return notFound(env);

  const [jobs, survivor] = await Promise.all([
    db(env, `job_postings?company_id=eq.${c.id}&select=title,category,level,location,apply_url,posted_at&order=posted_at.desc.nullslast&limit=12`),
    c.merged_into ? db(env, `companies?id=eq.${c.merged_into}&select=slug,name&limit=1`) : Promise.resolve([]),
  ]);

  const markets = (c.markets || []).map((m) => m.market).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const b = band(c);
  const site = safeUrl(c.website);
  const careers = safeUrl(c.careers_url);
  const sources = [sourceLine('Unit count', c.units_source), sourceLine('Markets', c.markets_source), sourceLine('Profile', c.profile_source)].join('');
  // A link ending in "=" is a pre-filled form link: the company name goes after it.
  const formUrl = env.REPORT_FORM_URL || '';
  const reportHref = formUrl.endsWith('=') ? formUrl + encodeURIComponent(c.name) : formUrl;
  const report = safeUrl(reportHref) ? `<a href="${esc(reportHref)}" target="_blank" rel="noopener noreferrer">Report incorrect info</a>` : '';
  const fact = (label, value) => (value ? `<div class="fact"><dt>${esc(label)}</dt><dd>${value}</dd></div>` : '');

  const body = `<section class="hero hero-tight">
  <a class="back" href="/">&larr; Directory</a>
  <div class="eyebrow">${esc(TYPE_LABEL[c.company_type] || c.company_type)}${c.segment ? ' &middot; ' + esc(c.segment) : ''}</div>
  <h1>${esc(c.name)}</h1>
  ${survivor[0] ? `<p class="notice">Now part of <a href="/companies/${esc(survivor[0].slug)}">${esc(survivor[0].name)}</a>.</p>` : ''}
  <div class="hero-actions">
    ${site ? `<a class="btn ghost-green" href="${esc(site)}" target="_blank" rel="noopener noreferrer">${esc(host(site))} &nearr;</a>` : ''}
    ${careers ? `<a class="btn" href="${esc(careers)}" target="_blank" rel="noopener noreferrer">Careers page &nearr;</a>` : ''}
  </div>
</section>

<section class="wrap grid-2">
  <div>
    <h2>At a glance</h2>
    <dl class="facts">
      ${fact('Headquarters', esc(hq(c)))}
      ${fact(bandKind(c) === 'managed' ? 'Homes managed' : 'Homes owned', b ? esc(b) : '')}
      ${fact('Markets', c.market_count ? num(c.market_count) : '')}
      ${fact('Operating states', (c.operating_states || []).length ? esc(c.operating_states.join(', ')) : '')}
      ${fact('Open roles', c.open_roles ? num(c.open_roles) : '0')}
      ${fact('Figures as of', c.scale_as_of ? esc(c.scale_as_of) : '')}
    </dl>
    ${c.scale_note ? `<p class="note">${esc(c.scale_note)}</p>` : ''}

    ${markets.length ? `<h2>Markets</h2>
    <div class="chips">${markets.map((m) => `<a class="chip" href="/markets/${esc(m.slug)}">${esc(m.name)}</a>`).join('')}</div>` : ''}

    <h2>Open roles</h2>
    ${jobs.length ? `<ul class="jobs">${jobs.map((j) => `<li><a href="${esc(safeUrl(j.apply_url) || '#')}" target="_blank" rel="noopener noreferrer"><span class="j-title">${esc(j.title)}</span><span class="j-meta">${esc([j.location, j.level].filter(Boolean).join(' · '))}</span></a></li>`).join('')}</ul>
    ${(c.open_roles || 0) > jobs.length ? `<p class="note">Showing ${jobs.length} of ${num(c.open_roles)}. <a href="${esc(JOBS)}" target="_blank" rel="noopener noreferrer">See them all on the job board</a>.</p>` : ''}` : '<p class="note">No open roles on file right now.</p>'}
  </div>

  <aside>
    <div class="locked">
      <div class="eyebrow">Leaders</div>
      <p class="locked-n">${c.leader_count ? num(c.leader_count) + ' on file' : 'None on file yet'}</p>
      <p>Names, titles and contact details will be part of the paid tier. Subscribe to Origins to hear when it opens.</p>
      <a class="btn primary" href="${esc(NEWSLETTER)}" target="_blank" rel="noopener noreferrer">Get Origins &rarr;</a>
    </div>
    ${sources ? `<h2>Sources</h2><ul class="sources">${sources}</ul>` : ''}
    <p class="note">${c.last_verified_at ? 'Last checked ' + esc(String(c.last_verified_at).slice(0, 10)) + '. ' : ''}${report}</p>
  </aside>
</section>`;

  const desc = `${c.name}: ${[TYPE_LABEL[c.company_type], c.segment, hq(c), b && b + ' homes'].filter(Boolean).join(', ')}.`;
  return html(page(env, { title: `${c.name} | Property and Technology directory`, description: desc, path: '/companies', body }));
}

async function marketsPage(env) {
  const rows = await db(env, 'markets?select=slug,name,company_markets(company:companies(merged_into))&order=name.asc&limit=2000');
  const items = rows
    .map((m) => ({ ...m, n: (m.company_markets || []).filter((x) => x.company && !x.company.merged_into).length }))
    .filter((m) => m.n > 0);
  const body = `<section class="hero hero-tight">
  <div class="eyebrow">Markets</div>
  <h1>Operators by market.</h1>
  <p class="sub">${num(items.length)} markets, named the way each operator names them.</p>
</section>
<section class="wrap">
  <div class="chips chips-lg">${items.map((m) => `<a class="chip" href="/markets/${esc(m.slug)}">${esc(m.name)} <b>${m.n}</b></a>`).join('')}</div>
</section>`;
  return html(page(env, { title: 'Markets | Property and Technology directory', description: `Rental operators listed across ${items.length} markets.`, path: '/markets', body }));
}

async function marketPage(env, slug) {
  const found = await db(env, `markets?slug=eq.${encodeURIComponent(slug)}&select=slug,name,company_markets(company:companies(${LIST_FIELDS}))&limit=1`);
  const m = found[0];
  if (!m) return notFound(env);
  const rows = (m.company_markets || []).map((x) => x.company).filter((c) => c && !c.merged_into)
    .sort(bySize);
  const body = `<section class="hero hero-tight">
  <a class="back" href="/markets">&larr; Markets</a>
  <div class="eyebrow">Market</div>
  <h1>${esc(m.name)}</h1>
  <p class="sub">${num(rows.length)} ${rows.length === 1 ? 'operator lists' : 'operators list'} this market.</p>
</section>
<section class="wrap">
  <div class="rows">
  ${rowsHead}
  ${rows.map(companyRow).join('\n  ')}
  </div>
</section>`;
  return html(page(env, { title: `${m.name} rental operators | Property and Technology directory`, description: `${rows.length} rental operators active in ${m.name}.`, path: '/markets', body }));
}

async function sitemap(env, origin) {
  const [companies, markets] = await Promise.all([
    allCompanies(env),
    db(env, 'markets?select=slug&limit=5000'),
  ]);
  const urls = ['/', '/markets', ...companies.map((c) => `/companies/${c.slug}`), ...markets.map((m) => `/markets/${m.slug}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(origin + u)}</loc></url>`).join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

function notFound(env) {
  return html(page(env, {
    title: 'Not found | Property and Technology directory', description: 'That page does not exist.', path: '',
    body: `<section class="hero hero-tight"><div class="eyebrow">404</div><h1>That page isn't here.</h1><div class="hero-actions"><a class="btn primary" href="/">Back to the directory</a></div></section>`,
  }), 404, 60);
}

// ---------- router ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    try {
      if (path === '/') return await listPage(env, url);
      if (path === '/markets') return await marketsPage(env);
      if (path === '/sitemap.xml') return await sitemap(env, url.origin);
      if (path === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nSitemap: ${url.origin}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
      let m;
      if ((m = path.match(/^\/companies\/([a-z0-9-]+)$/))) return await companyPage(env, m[1]);
      if ((m = path.match(/^\/markets\/([a-z0-9-]+)$/))) return await marketPage(env, m[1]);
      return notFound(env);
    } catch (err) {
      console.error(err);
      return html(page(env, {
        title: 'Something went wrong | Property and Technology directory', description: 'The directory could not load.', path: '',
        body: `<section class="hero hero-tight"><div class="eyebrow">Error</div><h1>The directory couldn't load.</h1><p class="sub">Try again in a minute.</p></section>`,
      }), 502, 0);
    }
  },
};
