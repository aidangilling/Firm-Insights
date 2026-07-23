// scripts/firms/addisons.mjs
//
// Addisons — https://addisons.com/insights/
// WordPress site. The insights feed is a custom post type exposed via the WP
// REST API, so we hit that JSON endpoint directly (fast + robust; no browser).
//   https://addisons.com/wp-json/wp/v2/td_insights   (title, link, date, excerpt)
//   https://addisons.com/wp-json/wp/v2/td_guides_reports  (guides & reports)
// Addisons is an Australian firm → domestic:true (jurisdiction auto-passes).
// Relevance is decided by the shared competition/consumer filter on the
// title + excerpt.

import { fetchJson, clean } from "../lib/shared.mjs";

const ORIGIN = "https://addisons.com";
const PER_PAGE = 100;
const MAX_PAGES = 6; // safety cap (td_insights ~220 items = 3 pages)

const stripHtml = (s) =>
  clean(String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&#8216;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&hellip;/g, "…"));

async function fetchPostType(restBase) {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let batch;
    try {
      batch = await fetchJson(
        `${ORIGIN}/wp-json/wp/v2/${restBase}?per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc`
      );
    } catch (err) {
      // WP returns 400 for pages past the end — treat as "no more".
      if (/HTTP 400|rest_post_invalid_page_number/.test(err.message)) break;
      throw err;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const p of batch) {
      const title = stripHtml(p?.title?.rendered);
      const url = clean(p?.link);
      if (!title || !url) continue;
      out.push({
        title,
        url,
        dateISO: (p.date || "").slice(0, 10) || null,
        teaser: stripHtml(p?.excerpt?.rendered),
      });
    }
    if (batch.length < PER_PAGE) break;
  }
  return out;
}

async function fetchRecords() {
  const [insights, guides] = await Promise.all([
    fetchPostType("td_insights"),
    fetchPostType("td_guides_reports").catch(() => []),
  ]);
  return [...insights, ...guides];
}

export default {
  name: "Addisons",
  order: 1,
  badge: { initial: "A", color: "#0a3a4a" },
  sourceUrl: "https://addisons.com/insights/",
  domestic: true,
  fetchRecords,
};
