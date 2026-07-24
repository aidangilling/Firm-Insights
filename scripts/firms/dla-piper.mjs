// scripts/firms/dla-piper.mjs
//
// DLA Piper — international; we want AUSTRALIA only. The whole site sits behind a
// Vercel JS challenge and the insights listing is a Sitecore Discover SPA, so we
// use headless Chromium. We load the listing pre-filtered to its own
// "Antitrust and Competition" capability AND the Australia country facet, and
// include every article under it (over-include):
//   /en-au/insights?...&f:CountriesID=[Australia]&f:RelatedCapabilityID=[Antitrust and Competition]
// Cards link to /en-au/insights/publications/YYYY/MM/… ; we read each article's
// JSON-LD date in-page (falling back to the /YYYY/MM/ in the URL). auHint (AU
// facet) + preFiltered (competition capability).
//
// NOTE: as at build time DLA's AU antitrust/competition insights are all dated
// 2025 or earlier, so none fall in the 2026 window yet — the adapter will
// populate automatically once they publish 2026 content.

import { withPage } from "../lib/browser.mjs";
import { clean } from "../lib/shared.mjs";

const LISTING =
  "https://www.dlapiper.com/en-au/insights?sort=insights_year_descending&t=All" +
  "&f:CountriesID=[Australia]&f:RelatedCapabilityID=[Antitrust and Competition]";

function isoFromUrl(u) {
  const m = /\/(20\d\d)\/(\d{2})\//.exec(u);
  return m ? `${m[1]}-${m[2]}-01` : null;
}

async function fetchRecords() {
  return withPage(LISTING, async (page) => {
    // Wait for the Discover widget to render the filtered cards.
    try { await page.waitForSelector('a[href*="/en-au/insights/publications/"]', { timeout: 20000 }); } catch { /* */ }
    await page.waitForTimeout(2500);

    const cards = await page.evaluate(() => {
      const map = new Map();
      document.querySelectorAll('a[href*="/en-au/insights/"]').forEach((a) => {
        const href = a.getAttribute("href") || "";
        const title = (a.textContent || "").replace(/\s+/g, " ").trim();
        if (!/\/en-au\/insights\/publications\//.test(href) || title.length < 12) return;
        const url = href.startsWith("http") ? href : "https://www.dlapiper.com" + href;
        if (!map.has(url)) map.set(url, title);
      });
      return [...map.entries()].map(([url, title]) => ({ url, title }));
    });

    if (cards.length) {
      const dates = await page.evaluate(async (urls) => {
        const out = {};
        let i = 0;
        async function w() {
          while (i < urls.length) {
            const u = urls[i++];
            try {
              const html = await (await fetch(u)).text();
              const m = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/);
              out[u] = m ? m[1] : null;
            } catch { out[u] = null; }
          }
        }
        await Promise.all(Array.from({ length: 4 }, w));
        return out;
      }, cards.map((c) => c.url));
      cards.forEach((c) => { c.dateISO = dates[c.url] || isoFromUrl(c.url); });
    }

    return cards.map((c) => ({
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
  sourceUrl:
    "https://www.dlapiper.com/en-au/insights?f:CountriesID=[Australia]&f:RelatedCapabilityID=[Antitrust and Competition]",
  domestic: false,
  fetchRecords,
};
