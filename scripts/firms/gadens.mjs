// scripts/firms/gadens.mjs
//
// Gadens — https://www.gadens.com/latest-insights/
// WordPress, but the "legal insights" post type is NOT exposed via the REST
// API, so we parse the server-rendered listing pages with cheerio. Pagination
// is the standard WordPress /page/N/ form. Cards look like:
//   <h2 class="titlein"><a href="/legal-insights/<slug>/">Title</a></h2>
//   <div class="date">20 July 2026</div>
//   <p>teaser…</p>
// Gadens is an Australian firm → domestic:true.

import { load } from "cheerio";
import { fetchText, clean, sleep, REQUEST_DELAY_MS } from "../lib/shared.mjs";

const ORIGIN = "https://www.gadens.com";
const MAX_PAGES = 8;

async function fetchRecords() {
  const out = [];
  const seen = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1
      ? `${ORIGIN}/latest-insights/`
      : `${ORIGIN}/latest-insights/page/${page}/`;
    let html;
    try {
      html = await fetchText(url);
    } catch (err) {
      if (/HTTP 404/.test(err.message)) break; // past the last page
      throw err;
    }
    const $ = load(html);
    let added = 0;

    $("h2.titlein").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href");
      const title = clean(a.text());
      if (!href || !title) return;
      if (!/\/legal-insights\//.test(href)) return;
      const url = href.startsWith("http") ? href : ORIGIN + href;
      if (seen.has(url)) return;
      seen.add(url);
      added++;

      const dateText = clean($(el).nextAll(".date").first().text());
      const teaser = clean($(el).nextAll("p").first().text());
      out.push({ title, url, dateRaw: dateText, teaser });
    });

    if (added === 0) break; // no new items — end of listing
    await sleep(REQUEST_DELAY_MS);
  }
  return out;
}

export default {
  name: "Gadens",
  order: 10,
  badge: { initial: "G", color: "#3f9c35" },
  sourceUrl: "https://www.gadens.com/latest-insights/",
  domestic: true,
  fetchRecords,
};
