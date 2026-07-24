// scripts/firms/clayton-utz.mjs
//
// Clayton Utz — Australian (Umbraco + Azure Cognitive Search). The insights list
// is a JSON XHR. We query the firm's competition/consumer expertise tags (OR'd)
// and include everything under them (over-include):
//   POST /search/azure/search  { keywords, sortBy:"DDesc", page, pageSize, filter }
// Fields: results[].name / url (prefix) / date (ISO) / briefDescription.

import { fetchJson, clean } from "../lib/shared.mjs";

const ORIGIN = "https://www.claytonutz.com";
const ENDPOINT = `${ORIGIN}/search/azure/search`;
const PAGE_SIZE = 50;
const MAX_PAGES = 12;

const TAGS = [
  "Competition",
  "Competition law enforcement, cartels and dawn raids",
  "Merger Clearance",
  "Australian Consumer Law",
  "Advertising and Marketing",
  "Franchising",
];
const FILTER =
  "ContentType eq 'insight' and ArticleType ne 'Media Release' and Tags/any(x: " +
  TAGS.map((t) => "x eq '" + t.replace(/'/g, "''") + "'").join(" or ") +
  ")";

async function fetchRecords() {
  const out = [];
  const seen = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    let json;
    try {
      json = await fetchJson(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: "", sortBy: "DDesc", page, pageSize: PAGE_SIZE, filter: FILTER }),
      });
    } catch { break; }
    const results = Array.isArray(json?.results) ? json.results : [];
    if (results.length === 0) break;
    for (const r of results) {
      const title = clean(r?.name);
      let rel = clean(r?.url);
      if (!title || !rel) continue;
      const url = rel.startsWith("http") ? rel : ORIGIN + rel;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        title,
        url,
        dateISO: (clean(r?.date) || "").slice(0, 10) || null,
        teaser: clean(r?.briefDescription),
        preFiltered: true,
        defaultTopics: ["Competition & Consumer"],
      });
    }
    const totalPages = Number(json?.totalPages || 0);
    if (page >= totalPages) break;
  }
  return out;
}

export default {
  name: "Clayton Utz",
  order: 6,
  badge: { initial: "C", color: "#e5231b" },
  sourceUrl: "https://www.claytonutz.com/insights",
  domestic: true,
  fetchRecords,
};
