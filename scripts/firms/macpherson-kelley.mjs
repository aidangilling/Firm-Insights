// scripts/firms/macpherson-kelley.mjs
//
// Macpherson Kelley (mk.com.au) — Australian, WordPress. Its "Competition and
// Consumer" expertise taxonomy (term id 61) tags every relevant article, so we
// list ALL posts under it (over-include):
//   /wp-json/wp/v2/posts?expertise=61&per_page=100&page=N
// Fields: title.rendered, link, date, excerpt.rendered.

import { fetchJson, stripHtml, clean } from "../lib/shared.mjs";

const ORIGIN = "https://mk.com.au";
const TERM = 61; // "competition and consumer" expertise term

async function fetchRecords() {
  const out = [];
  for (let page = 1; page <= 4; page++) {
    let batch;
    try {
      batch = await fetchJson(
        `${ORIGIN}/wp-json/wp/v2/posts?expertise=${TERM}&per_page=100&page=${page}&_fields=id,date,link,title,excerpt`
      );
    } catch (err) {
      if (/HTTP 400|invalid_page/.test(err.message)) break;
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
        preFiltered: true,
        defaultTopics: ["Competition & Consumer"],
      });
    }
    if (batch.length < 100) break;
  }
  return out;
}

export default {
  name: "Macpherson Kelley",
  order: 17,
  badge: { initial: "MK", color: "#0057b8" },
  sourceUrl: "https://mk.com.au/news-insights/?expertise=competition-and-consumer",
  domestic: true,
  fetchRecords,
};
