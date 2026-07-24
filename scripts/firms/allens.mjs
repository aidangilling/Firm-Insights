// scripts/firms/allens.mjs
//
// Allens — https://www.allens.com.au/insights-news/
// The server-rendered insights search accepts the firm's own practice/topic
// filter. Topic id 262 = "Competition, Consumer & Regulatory", so we list EVERY
// insight under that practice (over-include) rather than keyword-searching:
//   https://www.allens.com.au/search/insights/?t=262&p=<n>   (10 / page, p NOT page)
// Cards: .block-search-result → .block-search-result__link-text (title),
// a.block-search-result__link (href), .block-search-result__meta-date
// ("13 Jul 2026"), .block-search-result__description (teaser).
// Allens is Australian → domestic:true.

import { load } from "cheerio";
import { fetchText, clean, sleep, REQUEST_DELAY_MS } from "../lib/shared.mjs";

const ORIGIN = "https://www.allens.com.au";
const TOPIC = 262; // Competition, Consumer & Regulatory
const MAX_PAGES = 30; // 146 results ÷ 10 ≈ 15 pages; cap generously

const stripTrack = (href) => (href || "").split("?")[0];

async function fetchRecords() {
  const out = [];
  const seen = new Set();

  for (let p = 1; p <= MAX_PAGES; p++) {
    let html;
    try {
      html = await fetchText(`${ORIGIN}/search/insights/?t=${TOPIC}&p=${p}`);
    } catch {
      break;
    }
    const $ = load(html);
    const cards = $(".block-search-result");
    if (cards.length === 0) break; // past the last page

    cards.each((_, el) => {
      const card = $(el);
      const a = card.find("a.block-search-result__link").first();
      const href = stripTrack(a.attr("href"));
      const title = clean(card.find(".block-search-result__link-text").first().text());
      if (!href || !title) return;
      if (!/\/insights-news\//.test(href)) return;
      const permalink = href.startsWith("http") ? href : ORIGIN + href;
      if (seen.has(permalink)) return;
      seen.add(permalink);
      out.push({
        title,
        url: permalink,
        dateRaw: clean(card.find(".block-search-result__meta-date").first().text()),
        teaser: clean(card.find(".block-search-result__description").first().text()),
        preFiltered: true,
        defaultTopics: ["Competition & Consumer"],
      });
    });
    await sleep(REQUEST_DELAY_MS);
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
