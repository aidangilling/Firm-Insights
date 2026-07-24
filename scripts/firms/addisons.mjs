// scripts/firms/addisons.mjs
//
// Addisons — https://addisons.com/insights/  (WordPress)
// Two signals, unioned for maximum recall:
//  1) The firm's own "Competition, Consumer & Antitrust" capability (td_expertise
//     id 667). Its tagged insight IDs are rendered on the capability page's
//     Elementor loop-carousel; every one of those is INCLUDED (preFiltered) —
//     this catches articles whose text never trips our keywords.
//  2) All insights (td_insights REST) run through the shared keyword filter, so
//     round-ups that merely mention competition/consumer are caught too.
// Addisons is Australian → domestic:true.

import { fetchJson, fetchText, clean } from "../lib/shared.mjs";

const ORIGIN = "https://addisons.com";
const PER_PAGE = 100;
const MAX_PAGES = 6;
const CAPABILITY_URL = `${ORIGIN}/capabilities/competition-consumer-antitrust/`;

const stripHtml = (s) =>
  clean(String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&#8216;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&#038;/g, "&").replace(/&hellip;/g, "…"));

/** Insight post-IDs tagged to the Competition/Consumer/Antitrust capability. */
async function fetchCapabilityIds() {
  try {
    const html = await fetchText(CAPABILITY_URL);
    const ids = new Set();
    const re = /e-loop-item-(\d+)\s+post-\1\s+td_insights/g;
    let m;
    while ((m = re.exec(html))) ids.add(Number(m[1]));
    return ids;
  } catch {
    return new Set();
  }
}

async function fetchPostType(restBase) {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let batch;
    try {
      batch = await fetchJson(
        `${ORIGIN}/wp-json/wp/v2/${restBase}?per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc&_fields=id,date,title,link,excerpt`
      );
    } catch (err) {
      if (/HTTP 400|rest_post_invalid_page_number/.test(err.message)) break;
      throw err;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const p of batch) {
      const title = stripHtml(p?.title?.rendered);
      const url = clean(p?.link);
      if (!title || !url) continue;
      out.push({
        id: p.id,
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
  const [capIds, insights, guides] = await Promise.all([
    fetchCapabilityIds(),
    fetchPostType("td_insights"),
    fetchPostType("td_guides_reports").catch(() => []),
  ]);

  return [...insights, ...guides].map((r) => {
    const tagged = capIds.has(r.id);
    return {
      title: r.title,
      url: r.url,
      dateISO: r.dateISO,
      teaser: r.teaser,
      preFiltered: tagged,
      defaultTopics: tagged ? ["Competition & Consumer"] : [],
    };
  });
}

export default {
  name: "Addisons",
  order: 1,
  badge: { initial: "A", color: "#0a3a4a" },
  sourceUrl: "https://addisons.com/insights/",
  domestic: true,
  fetchRecords,
};
