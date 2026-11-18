# Property and Technology directory

A public directory of scattered site rental operators and the proptech companies that sell to them.

## How it works

- **Data** lives in the Supabase project "Property and Technology Data".
- **The site** is one Cloudflare Worker, `src/worker.js`. It reads the public fields from Supabase and returns plain HTML. There is no build step.
- **Styles and images** are in `public/`.
- **Settings** are in `wrangler.jsonc`. Every push to `main` republishes the site.

## Pages

| Address | What it shows |
|---|---|
| `/` | All companies, with search and filters |
| `/companies/<slug>` | One company: scale, counts, sources, and what the paid tier holds |
| `/markets` | Every market with an operator in it, with counts |
| `/markets/<slug>` | The 3 largest operators in one market; the rest are locked |
| `/sitemap.xml` | Every page, for search engines |

## Free and paid

Modelled on the Thesis Driven database. Free pages show who a company is, where it is, its size band, and **counts**: markets, leaders, open roles. The **lists** behind those counts are the paid tier.

| Free | Paid |
|---|---|
| Name, type, segment, HQ, website, description | Leader names, titles, LinkedIn |
| Unit bands, "figures as of" | Market list and operating states |
| Number of markets, leaders, open roles | Open role details, tech stack |
| Source links, last checked | Signals, CSV export |
| Top 3 operators per market | Every operator in every market |

"Get full access" buttons go to `PAID_URL` in `wrangler.jsonc`. While it is empty they go to the Origins signup tagged `utm_campaign=paid-waitlist`. Put a Stripe checkout link there once the paid tier is priced.

## How the gate is enforced

The site uses Supabase's publishable key. That key can read two views and nothing else:

- `directory_companies`: the free fields, with counts in place of lists.
- `directory_markets`: per market, the operator count and the 3 largest operators.

The base tables (companies, company_markets, job_postings, sources, people, roles, contacts, signals, events) are closed to it, so the lists cannot be pulled from the database directly, even by someone who copies the key.

## "Report incorrect info"

Each company page links to the Google Form set in `REPORT_FORM_URL` in `wrangler.jsonc`. If that value is a pre-filled link ending in `=`, the company name is added after it so the form opens with the company filled in.
