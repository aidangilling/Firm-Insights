// scripts/firms/corrs.mjs
//
// Corrs Chambers Westgarth — Australian firm. Two sources, merged:
//  1) Elastic App Search (Swiftype) JSON API — the full back-catalogue,
//     newest-first, with clean title/url/date/teaser. Uses the site's public
//     search key (embedded in their app.js). NOTE: this index lags ~4 months.
//  2) The server-rendered /insights homepage cards (UIkit) — the freshest
//     items the search index hasn't picked up yet.
// Relevance is decided by the shared competition/consumer filter.

import { load } from "cheerio";
import { fetchJson, fetchText, clean, sleep, REQUEST_DELAY_MS } from "../lib/shared.mjs";

const ORIGIN = "https://www.corrs.com.au";
const SWIFTYPE =
  "https://host-67byae.api.swiftype.com/api/as/v1/engines/corrs-site-search-pre-prod/search";
const SEARCH_KEY = "search-e84uht5ow3117df9upxe6pc9"; // public search-only key
const API_PAGES = 3; // 300 most-recent insights from the index

async function fetchApi(out, seen) {
  for (let page = 1; page <= API_PAGES; page++) {
    let json;
    try {
      json = await fetchJson(SWIFTYPE, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SEARCH_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: "",
          page: { size: 100, current: page },
          filters: { type: "insight" },
          sort: [{ published_at_unix: "desc" }],
        }),
      });
    } catch {
      break;
    }
    const results = Array.isArray(json?.results) ? json.results : [];
    if (results.length === 0) break;
    for (const r of results) {
      const title = clean(r?.title?.raw);
      let uri = clean(r?.uri?.raw);
      if (!title || !uri) continue;
      const url = uri.startsWith("http") ? uri : `${ORIGIN}/${uri.replace(/^\//, "")}`;
      if (seen.has(url)) continue;
      seen.add(url);
      const tags = [].concat(r?.related_capabilities?.raw || []).concat(r?.tags?.raw || []);
      out.push({
        title,
        url,
        dateISO: (clean(r?.published_at?.raw) || "").slice(0, 10) || null,
        teaser: clean(r?.summary?.raw),
        tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
      });
    }
    const totalPages = Number(json?.meta?.page?.total_pages || 0);
    if (page >= totalPages) break;
    await sleep(REQUEST_DELAY_MS);
  }
}

// Freshest items straight off the SSR listing (covers the index's ~4-month lag).
async function fetchHomepage(out, seen) {
  let html;
  try {
    html = await fetchText(`${ORIGIN}/insights`);
  } catch {
    return;
  }
  const $ = load(html);
  $("a[href*='/insights/']").each((_, el) => {
    const a = $(el);
    const href = a.attr("href") || "";
    if (!/\/insights\/[a-z0-9-]{6,}/i.test(href)) return; // article, not hub
    const url = href.startsWith("http") ? href : ORIGIN + href;
    if (seen.has(url)) return;
    const title = clean(a.text());
    if (!title || title.length < 12) return;
    seen.add(url);
    const card = a.closest(".uk-card, li, article, div");
    const teaser = clean(card.find("p").not(".uk-text-uppercase").first().text());
    out.push({ title, url, teaser });
  });
}

async function fetchRecords() {
  const out = [];
  const seen = new Set();
  await fetchApi(out, seen);
  await fetchHomepage(out, seen);
  return out;
}

export default {
  name: "Corrs Chambers Westgarth",
  order: 11,
  badge: { initial: "C", color: "#c8102e" },
  sourceUrl: "https://www.corrs.com.au/insights",
  domestic: true,
  fetchRecords,
};
