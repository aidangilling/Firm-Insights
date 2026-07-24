// scripts/firms/king-wood-mallesons.mjs
//
// King & Wood Mallesons — Australian firm behind Cloudflare (needs a real
// browser). Its "Competition & Antitrust" practice page lists every related
// insight, and each article page carries a JSON-LD `datePublished`. So we pass
// Cloudflare with headless Chromium, read the practice page's insight links +
// titles, then fetch each article's date IN-PAGE (same origin → CF applies).
// Dates are cached across runs (previousByUrl) so only new articles are fetched.
// Every article here is under the firm's competition practice → preFiltered.
//
// If Cloudflare blocks the CI runner, fetchRecords throws and the runner keeps
// KWM's last-good records + any manual entries.

import { withPage } from "../lib/browser.mjs";
import { clean } from "../lib/shared.mjs";

const ORIGIN = "https://www.mallesons.com";
const PRACTICE = `${ORIGIN}/au/en/expertise/practices/competition-and-antitrust.html`;

async function fetchRecords({ previousByUrl } = {}) {
  return withPage(PRACTICE, async (page) => {
    // 1) insight links (href + title text) from the practice page
    const links = await page.evaluate(() => {
      const map = new Map();
      // .article-display is the practice's own insight list; links elsewhere
      // (e.g. .nav-content) are the site-wide menu, not competition content.
      document.querySelectorAll('.article-display a[href*="/latest-thinking/"][href$=".html"]').forEach((a) => {
        const href = a.getAttribute("href");
        const text = (a.textContent || "").replace(/\s+/g, " ").trim();
        if (!href) return;
        if (!map.has(href) || (text && text.length > (map.get(href) || "").length)) {
          map.set(href, text);
        }
      });
      return [...map.entries()].map(([href, title]) => ({ href, title }));
    });

    const items = links
      .map(({ href, title }) => ({
        url: href.startsWith("http") ? href : ORIGIN + href,
        title,
      }))
      .filter((it) => it.title && it.title.length > 8);

    // 2) resolve dates — reuse cached, fetch the rest in-page (CF applies)
    const needDate = [];
    for (const it of items) {
      const prev = previousByUrl && previousByUrl.get(it.url);
      if (prev && prev.dateISO) it.dateISO = prev.dateISO;
      else needDate.push(it);
    }

    if (needDate.length) {
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
            } catch {
              out[u] = null;
            }
          }
        }
        await Promise.all(Array.from({ length: 5 }, worker));
        return out;
      }, needDate.map((it) => it.url));
      for (const it of needDate) it.dateISO = dates[it.url] || null;
    }

    return items.map((it) => ({
      title: clean(it.title),
      url: it.url,
      dateISO: it.dateISO || null,
      preFiltered: true,
      defaultTopics: ["Competition & Consumer"],
    }));
  }, { waitMs: 6000 });
}

export default {
  name: "King & Wood Mallesons",
  order: 3,
  badge: { initial: "K", color: "#3b2a6b" },
  sourceUrl: "https://www.mallesons.com/au/en/insights/latest-thinking.html?page=1",
  domestic: true,
  fetchRecords,
};
