// scripts/firms/dla-piper.mjs
//
// DLA Piper — international; we want AUSTRALIA only. The whole site sits behind a
// Vercel JS challenge, so we use headless Chromium. The en-au insights listing
// (CountriesID=Australia facet) is Sitecore SXA. We load it, keep the
// competition/consumer-relevant articles, and read each article's date in-page
// (JSON-LD, falling back to the /YYYY/MM/ in the URL). Australia-faceted →
// auHint; competition/consumer-titled → preFiltered.

import { withPage } from "../lib/browser.mjs";
import { clean } from "../lib/shared.mjs";

const LISTING =
  "https://www.dlapiper.com/en-au/insights?sort=insights_year_descending&t=All&f:CountriesID=[Australia]";
const COMPETITION =
  /competition|antitrust|cartel|\bmerger|acquisition|\bACCC\b|consumer|misleading|unconscionable|unfair (contract|trading)|market power|product safety|franchis|greenwash|foreign investment|\bFIRB\b|advertising|pricing/i;

function isoFromUrl(u) {
  var m = /\/(20\d\d)\/(\d{2})\//.exec(u);
  if (m) return `${m[1]}-${m[2]}-01`;
  return null;
}

async function fetchRecords() {
  return withPage(LISTING, async (page) => {
    // Load more cards by scrolling / clicking any "load more" a few times.
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1200);
      try {
        const btn = await page.$('button:has-text("Load more"), a:has-text("Load more")');
        if (btn) { await btn.click(); await page.waitForTimeout(1200); }
      } catch { /* no button */ }
    }

    const cards = await page.evaluate(() => {
      const map = new Map();
      document.querySelectorAll('a[href*="/insights/"]').forEach((a) => {
        const href = a.getAttribute("href") || "";
        const title = (a.textContent || "").replace(/\s+/g, " ").trim();
        if (!/\/en-au\/insights\//.test(href) || title.length < 18) return;
        const url = href.startsWith("http") ? href : "https://www.dlapiper.com" + href;
        if (!map.has(url)) map.set(url, title);
      });
      return [...map.entries()].map(([url, title]) => ({ url, title }));
    });

    const relevant = cards.filter((c) => COMPETITION.test(c.title));

    // Read each relevant article's JSON-LD date in-page.
    if (relevant.length) {
      const dates = await page.evaluate(async (urls) => {
        const out = {};
        let i = 0;
        async function worker() {
          while (i < urls.length) {
            const u = urls[i++];
            try {
              const html = await (await fetch(u)).text();
              const m = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/);
              out[u] = m ? m[1] : null;
            } catch { out[u] = null; }
          }
        }
        await Promise.all(Array.from({ length: 4 }, worker));
        return out;
      }, relevant.map((c) => c.url));
      relevant.forEach((c) => { c.dateISO = dates[c.url] || isoFromUrl(c.url); });
    }

    return relevant.map((c) => ({
      title: clean(c.title),
      url: c.url,
      dateISO: c.dateISO || isoFromUrl(c.url),
      auHint: true,
      preFiltered: true,
      defaultTopics: ["Competition & Consumer"],
    }));
  }, { waitMs: 7000 });
}

export default {
  name: "DLA Piper",
  order: 15,
  badge: { initial: "D", color: "#003a70" },
  sourceUrl: "https://www.dlapiper.com/en-au/insights?f:CountriesID=[Australia]",
  domestic: false,
  fetchRecords,
};
