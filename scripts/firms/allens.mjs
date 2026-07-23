// scripts/firms/allens.mjs
//
// Allens — https://www.allens.com.au/insights-news/
// The landing page shows only ~9 highlights, but the EPiServer/Optimizely
// "search insights" page is fully SERVER-RENDERED and paginates cleanly:
//   https://www.allens.com.au/search/insights/?q=<term>&page=<n>   (8 / page)
// We run a small set of competition/consumer queries through it (leveraging
// Allens' own search as a relevance signal), then the shared filter refines.
// Allens is an Australian firm → domestic:true (foreign-only pieces still get
// dropped by the runner's jurisdiction check).

import { load } from "cheerio";
import { fetchText, clean, sleep, REQUEST_DELAY_MS } from "../lib/shared.mjs";

const ORIGIN = "https://www.allens.com.au";
const PAGES_PER_QUERY = 2; // 16 most-relevant results per query
const QUERIES = [
  "competition law",
  "consumer law",
  "ACCC",
  "merger control",
  "cartel",
  "unfair contract terms",
  "misleading or deceptive",
  "greenwashing",
];

const stripTrack = (href) => (href || "").split("?")[0];

async function fetchQuery(term, seen, out) {
  for (let page = 1; page <= PAGES_PER_QUERY; page++) {
    const url = `${ORIGIN}/search/insights/?q=${encodeURIComponent(term)}&page=${page}`;
    let html;
    try {
      html = await fetchText(url);
    } catch {
      break;
    }
    const $ = load(html);
    const cards = $(".block-search-result");
    if (cards.length === 0) break;

    cards.each((_, el) => {
      const card = $(el);
      const a = card.find("a.block-search-result__link").first();
      const href = stripTrack(a.attr("href"));
      const title = clean(card.find(".block-search-result__link-text").first().text());
      if (!href || !title) return;
      if (!/\/insights-news\/insights\//.test(href)) return; // insights only, not news
      const permalink = href.startsWith("http") ? href : ORIGIN + href;
      if (seen.has(permalink)) return;
      seen.add(permalink);
      out.push({
        title,
        url: permalink,
        dateRaw: clean(card.find(".block-search-result__meta-date").first().text()),
        teaser: clean(card.find(".block-search-result__description").first().text()),
      });
    });
    await sleep(REQUEST_DELAY_MS);
  }
}

async function fetchRecords() {
  const out = [];
  const seen = new Set();
  for (const term of QUERIES) {
    await fetchQuery(term, seen, out);
  }
  return out;
}

export default {
  name: "Allens",
  order: 2,
  badge: { initial: "A", color: "#000000" },
  sourceUrl: "https://www.allens.com.au/insights-news/",
  domestic: true,
  fetchRecords,
};
