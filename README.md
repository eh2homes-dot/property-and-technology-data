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
| `/companies/<slug>` | One company: scale, markets, open roles, sources |
| `/markets` | Every market with an operator in it |
| `/markets/<slug>` | The operators in one market |
| `/sitemap.xml` | Every page, for search engines |

## What is public and what is not

The site uses Supabase's publishable key, which can only read what the database allows:

- **Public:** company profile fields, unit bands, markets, open job postings, source links.
- **Closed:** exact unit counts, people, roles, contacts, signals, events.

The rules are set in the database itself, so the site cannot leak a closed field even by mistake.

## Turning on "Report incorrect info"

Put the pre-filled Google Form link in `REPORT_FORM_URL` in `wrangler.jsonc`. It must end with `=` so the company name can be added after it.
