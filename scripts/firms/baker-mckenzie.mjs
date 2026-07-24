// scripts/firms/baker-mckenzie.mjs
//
// Baker McKenzie — international. Sitecore insights search JSON API (not
// Cloudflare-blocked). Two unioned queries for maximum recall:
//  A) Australia region set → keyword-filtered for competition/consumer.
//  B) The firm's Antitrust & Competition practice + Consumer Protection AOP →
//     every article INCLUDED (preFiltered); jurisdiction keeps only the AU ones
//     (Baker titles these "Australia: …", so the AU signal is present).
//   POST /api/sitecore/insights/search  (body needs InitialPageSize/UseFallback/
//   MixedGlobalContent; practice filters are [{ID,IsSelected}], region filters
//   are {Filter:[{ID,IsSelected}]}). Fields: GridData[].Title / NavigateLink.Url
//   / DisplayDate ("25 February 2026") / Summary.

import { fetchJson, clean } from "../lib/shared.mjs";

const ENDPOINT = "https://www.bakermckenzie.com/api/sitecore/insights/search";
const HOST = "https://www.bakermckenzie.com";
const TAKE = 50;
const MAX_PAGES = 6;

const AU = { ID: "eb8c0cc7-f706-490c-b4ee-ed5d00fa1487", IsSelected: true };
const ANTITRUST = { ID: "5cfa9087-cfb9-4c08-8470-2842f94d3af0", IsSelected: true };
const CONSUMER = { ID: "fa2c0bbe-e5c2-4c9b-841e-85c5f37f2600", IsSelected: true };

const unescapeHtml = (s) =>
  clean(String(s || "").replace(/&ndash;/g, "–").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/<[^>]*>/g, " "));

async function runQuery(extra, decorate, seen, out) {
  for (let page = 0; page < MAX_PAGES; page++) {
    let json;
    try {
      json = await fetchJson(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Skip: page * TAKE,
          Take: TAKE,
          InitialPageSize: TAKE,
          UseFallback: false,
          MixedGlobalContent: false,
          ...extra,
        }),
      });
    } catch {
      break;
    }
    const grid = Array.isArray(json?.GridData) ? json.GridData : [];
    if (grid.length === 0) break;
    for (const g of grid) {
      const title = unescapeHtml(g?.Title);
      const rel = clean(g?.NavigateLink?.Url);
      if (!title || !rel) continue;
      const url = rel.startsWith("http") ? rel : HOST + rel;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        title,
        url,
        dateRaw: clean(g?.DisplayDate),
        teaser: unescapeHtml(g?.Summary),
        ...decorate,
      });
    }
    if (!json?.HasMoreResults) break;
  }
}

// Competition/consumer keywords — an Australia-region article that Baker's own
// search matches on any of these is INCLUDED (over-include).
const KEYWORDS = [
  "competition", "ACCC", "consumer law", "merger", "cartel", "unfair trading",
  "unfair contract", "misleading", "unconscionable", "product safety",
  "franchising", "antitrust", "scams", "greenwashing",
];

async function fetchRecords() {
  const out = [];
  const seen = new Set();
  // Run the INCLUDE-ALL (preFiltered) queries FIRST so a competition/consumer
  // article claims its slot as preFiltered before the plain region sweep sees it.
  // B) The firm's Competition + Consumer practices — include all (AU via signal).
  await runQuery({ PracticeFilters: [ANTITRUST] }, { preFiltered: true, defaultTopics: ["Competition"] }, seen, out);
  await runQuery({ AOPFilters: [CONSUMER] }, { preFiltered: true, defaultTopics: ["Consumer Law"] }, seen, out);
  // C) Australia region + each competition/consumer keyword — include all.
  for (const kw of KEYWORDS) {
    await runQuery(
      { AsiaPacificFilters: { Filter: [AU] }, KeywordFilter: kw },
      { auHint: true, preFiltered: true },
      seen,
      out
    );
  }
  // A) The rest of the Australia region — keyword-filtered by the shared engine.
  await runQuery({ AsiaPacificFilters: { Filter: [AU] } }, { auHint: true }, seen, out);
  return out;
}

export default {
  name: "Baker McKenzie",
  order: 6,
  badge: { initial: "B", color: "#b31e30" },
  sourceUrl: "https://www.bakermckenzie.com/en/insight",
  domestic: false,
  fetchRecords,
};
