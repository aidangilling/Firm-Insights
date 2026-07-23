// scripts/firms/ashurst.mjs
//
// Ashurst — https://www.ashurstperkinscoie.com/en/insights/all-insights/
// International firm. The listing is a shell; results come from a Sitecore SXA
// search JSON endpoint that supports facet filters. We query the intersection
// of CountriesComputed=Australia AND each competition/consumer ServicesComputed
// practice area, so we get Australian competition/consumer content directly.
//   GET /en/sxa/search/results/?l=en&s={..}&itemid={..}&v={..}
//        &o=ArticleDate,Descending&p=<size>&e=<offset>
//        &CountriesComputed=Australia&ServicesComputed=<label>
// Each Results[i] has .Url and an .Html blob we parse for title/date/teaser.
// Because every record is already Australia-faceted, we mark auHint:true.

import { load } from "cheerio";
import { fetchJson, clean, sleep, REQUEST_DELAY_MS } from "../lib/shared.mjs";

const BASE = "https://www.ashurstperkinscoie.com/en/sxa/search/results/";
// Load-bearing Sitecore GUIDs, published in the listing page's search config.
const CONST = {
  l: "en",
  s: "{D8645672-9702-45A4-B842-B9F492A73E71}",
  itemid: "{DB88CDCD-6EA1-4DB9-B7C4-0EEADA692250}",
  v: "{06AE7648-090F-40BE-90FB-9B434EE78B77}",
  o: "ArticleDate,Descending",
};
const SERVICES = [
  "Antitrust & Competition",
  "Antitrust, Regulatory and Trade",
  "Products, Liability & Consumer Protection",
];
const PAGE_SIZE = 20;
const MAX_PAGES = 6; // per service facet

function parseHtmlItem(url, html) {
  const $ = load(html);
  const title = clean($("h3.field-articlename").first().text()) || clean($("a[title]").first().attr("title"));
  const dateRaw = clean($("p.field-articledate").first().text()); // "July 02, 2026"
  const teaser = clean($(".field-metadescription").first().text());
  const tag = clean($(".field-tag-text").first().text()).toLowerCase();
  return { title, dateRaw, teaser, tag };
}

async function fetchService(label, seen, out) {
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      ...CONST,
      p: String(PAGE_SIZE),
      e: String(page * PAGE_SIZE),
      CountriesComputed: "Australia",
      ServicesComputed: label,
    });
    let json;
    try {
      json = await fetchJson(`${BASE}?${params.toString()}`);
    } catch {
      break;
    }
    const results = Array.isArray(json?.Results) ? json.Results : [];
    if (results.length === 0) break;

    for (const r of results) {
      const url = r?.Url ? (r.Url.startsWith("http") ? r.Url : "https://www.ashurstperkinscoie.com" + r.Url) : null;
      if (!url || seen.has(url)) continue;
      const { title, dateRaw, teaser, tag } = parseHtmlItem(url, r.Html || "");
      if (!title) continue;
      if (tag === "event") continue; // drop pure events
      seen.add(url);
      out.push({ title, url, dateRaw, teaser, auHint: true });
    }

    const total = Number(json?.Count || 0);
    if ((page + 1) * PAGE_SIZE >= total) break;
    await sleep(REQUEST_DELAY_MS);
  }
}

async function fetchRecords() {
  const out = [];
  const seen = new Set();
  for (const label of SERVICES) {
    await fetchService(label, seen, out);
  }
  return out;
}

export default {
  name: "Ashurst",
  order: 5,
  badge: { initial: "A", color: "#6b2c91" },
  sourceUrl: "https://www.ashurstperkinscoie.com/en/insights/all-insights/",
  domestic: false,
  fetchRecords,
};
