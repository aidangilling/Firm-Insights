# Australian Firm Insights — competition & consumer law digest

A self-updating static website that aggregates the **insights / media releases of
11 law firms**, filtered to **Australian / NSW-Sydney content that touches
competition and/or consumer law**. One sortable, searchable table per firm, with
a code-generated monogram badge next to each heading. It refreshes automatically
**twice daily** via a GitHub Action and deploys on **GitHub Pages** — no server,
no build step, the front end just reads a committed `data.json`.

Scope: only articles dated **1 January 2026 onwards** are shown (configurable via
the `START_DATE` env var in `scripts/scrape.mjs`).

Live site: <https://aidangilling.github.io/firm-insights/>

---

## The 11 firms

Shown in this order (Addisons first). "Method" is how each firm's list is fetched.

| # | Firm | Method | Source |
|---|------|--------|--------|
| 1 | Addisons | WordPress REST API (`td_insights`) | insights |
| 2 | Allens | EPiServer server-rendered search (per-topic queries) | insights-news |
| 3 | King & Wood Mallesons | **Manual** (hard Cloudflare block, no dates on listing) | Latest Thinking |
| 4 | Gilbert + Tobin | Headless Chromium → Funnelback JSON (passes Cloudflare) | insights |
| 5 | Ashurst | Sitecore SXA search JSON (`CountriesComputed=Australia` + competition/consumer practices) | all-insights |
| 6 | Baker McKenzie | **Manual** (Sitecore search needs internal filter GUIDs) | insight |
| 7 | Bird & Bird | Solr JSON (`Countries=Australia` + competition/consumer practices) | insights |
| 8 | Norton Rose Fulbright | Coveo proxy JSON (`en-AU` publications) | knowledge/publications |
| 9 | Herbert Smith Freehills Kramer | **Manual** (hard Cloudflare block, even headless) | insights-listing |
| 10 | Gadens | WordPress listing (cheerio) | latest-insights |
| 11 | Corrs Chambers Westgarth | Elastic App Search JSON + SSR homepage for freshness | insights |

**Automated firms** update themselves twice daily. **Manual firms** (KWM, Baker
McKenzie, HSF Kramer) sit behind protections that block automation, so their
tables are filled from `manual-entries.json` — see *Adding entries by hand* below.

## How the selection works

Every article passes two filters (in `scripts/lib/shared.mjs`):

- **Jurisdiction** — international firms (Ashurst, Baker, Bird & Bird, NRF, HSF)
  must show an Australian signal; the queries above already restrict them to
  Australia. Domestic firms are kept unless a piece is *plainly* about another
  country with no Australian tie (they run Asia/UK/US practices too).
- **Relevance** — a competition/consumer-law keyword engine. Unambiguous signals
  (ACCC, cartel, merger control, Australian Consumer Law, misleading conduct,
  unfair contract terms, greenwashing, product safety, …) qualify an article and
  set its Topic. Generic words ("penalties", "enforcement", "pricing") only add a
  label to an already-relevant article — they never qualify one alone, which
  keeps out employment/privacy/ASIC noise. The bias is **lean-to-include**.

## Architecture

```
index.html                  ← front end (reads data.json), no build step
assets/css/styles.css        ← styling (orange / white / dark-gray, blue links)
assets/js/app.js             ← tables, filters, sort, search, zoom
assets/logos/                ← optional real logo files (see Badges)
data.json                    ← committed output of the scraper
manual-entries.json          ← hand-added articles (deep-merged in)
scripts/scrape.mjs           ← the shared runner
scripts/lib/shared.mjs       ← fetch, dates, relevance + jurisdiction filters
scripts/lib/browser.mjs      ← headless-Chromium helper (Cloudflare firms)
scripts/firms/<firm>.mjs     ← one adapter per firm
.github/workflows/update.yml ← twice-daily cron + manual "Run workflow"
```

Each adapter exports `{ name, order, badge, sourceUrl, domestic, fetchRecords }`.
The runner iterates them, applies the shared filters + the date window, dedupes
by URL, merges the manual layer, and writes `data.json` shaped as
`{ generatedAt, firms: [{ name, badge, records: [...] }] }`.

### Robustness

- A firm that **errors** keeps its previous records rather than blanking — one
  broken firm never empties the site.
- `data.json` is only rewritten when the data actually changed.
- The front end shows an amber staleness banner if the data is > 24h old.

## Adding entries by hand (`manual-entries.json`)

For the manual firms (or to pin anything the scraper misses), add an entry under
the exact firm name:

```json
{
  "King & Wood Mallesons": [
    {
      "title": "ACCC's new merger regime: what dealmakers need to know",
      "url": "https://www.mallesons.com/au/en/insights/latest-thinking/....html",
      "date": "10 July 2026",
      "topic": "Mergers, ACCC",
      "teaser": "Optional one-line description."
    }
  ]
}
```

`date` accepts "10 July 2026", "2026-07-10", etc. Manual entries are deduped by
URL (manual wins), tagged `manual` on the site, and are **not** date-filtered.

## Badges / logos

Each firm shows a code-generated monogram tile (initial + brand colour) by
default. To use a real logo, drop a file at `assets/logos/<firm>.svg|png` and set
`badge: { logo: "assets/logos/<firm>.svg" }` in that adapter. Firm logos are
trademarks — only use files you're entitled to; never hotlink.

## Local development

```bash
npm install
npx playwright install chromium   # only needed for the Gilbert + Tobin adapter
npm run scrape                     # rebuild data.json
python3 -m http.server 8765        # then open http://localhost:8765
```

Change the date window: `START_DATE=2025-01-01 npm run scrape`.

## Deployment

GitHub Pages from `main` / root. The Action (`.github/workflows/update.yml`) runs
at ~07:00 and ~19:00 Sydney (and on demand), rebuilds `data.json`, and commits it
only when it changed.
