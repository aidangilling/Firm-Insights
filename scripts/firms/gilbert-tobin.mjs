// scripts/firms/gilbert-tobin.mjs
//
// Gilbert + Tobin — Australian firm, but the whole site sits behind Cloudflare
// so a plain Node fetch is challenged. Their insights listing is powered by
// Funnelback, which returns clean JSON:
//   /designs/connectors/funnelback/search?collection=gti~sp-news-insights
//     &query=&sort=date&num_ranks=50&start_rank=<n>&f.Type|type=insights&form=json
// We pass Cloudflare with headless Chromium, then fetch that JSON in-page.
// results[]: { title, liveUrl, date (epoch ms), summary }. domestic:true.

import { withPage, pageFetchJson } from "../lib/browser.mjs";
import { clean } from "../lib/shared.mjs";

const ORIGIN = "https://www.gtlaw.com.au";
const PAGE = 50;
const MAX_START = 300; // ~6 pages of newest insights

function fbUrl(start) {
  return (
    `${ORIGIN}/designs/connectors/funnelback/search?collection=gti~sp-news-insights` +
    `&query=&sort=date&num_ranks=${PAGE}&start_rank=${start}` +
    `&f.Type%7Ctype=insights&form=json`
  );
}

function isoFromMs(ms) {
  const n = Number(ms);
  if (!n) return null;
  const d = new Date(n);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

async function fetchRecords() {
  return withPage(`${ORIGIN}/insights`, async (page) => {
    const out = [];
    const seen = new Set();
    for (let start = 1; start <= MAX_START; start += PAGE) {
      let json;
      try {
        json = await pageFetchJson(page, fbUrl(start));
      } catch {
        break;
      }
      const rp = json?.response?.resultPacket || json?.resultPacket;
      const results = rp?.results || [];
      if (results.length === 0) break;

      let oldestISO = null;
      for (const r of results) {
        const url = clean(r.liveUrl || r.displayUrl);
        const title = clean(r.title);
        if (!url || !title) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        const iso = isoFromMs(r.date);
        oldestISO = iso;
        out.push({ title, url, dateISO: iso, teaser: clean(r.summary) });
      }
      // Sorted newest-first: once a page ends before 2026 we can stop.
      if (oldestISO && oldestISO < "2026-01-01") break;
    }
    return out;
  });
}

export default {
  name: "Gilbert + Tobin",
  order: 4,
  badge: { initial: "G", color: "#e4002b" },
  sourceUrl: "https://www.gtlaw.com.au/insights",
  domestic: true,
  fetchRecords,
};
