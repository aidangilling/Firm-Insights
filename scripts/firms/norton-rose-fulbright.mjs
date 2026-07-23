// scripts/firms/norton-rose-fulbright.mjs
//
// Norton Rose Fulbright — international. The en-AU knowledge/publications are
// powered by Coveo-for-Sitecore with a SAME-ORIGIN proxy that injects the
// search token server-side, so we need no token:
//   POST https://www.nortonrosefulbright.com/coveo/rest/search/v2
//   body: { q:"", aq:"@z95xlanguage==en-AU @templatename==Publication",
//           numberOfResults, firstResult, sortCriteria:"@nrfpublishdate descending" }
// Every result is en-AU faceted → auHint:true. clickUri points at the CMS host
// (cm.…) so we swap it to www. Relevance is decided by the shared filter on
// title + excerpt + practice-area tags.

import { fetchJson, clean } from "../lib/shared.mjs";

const ENDPOINT = "https://www.nortonrosefulbright.com/coveo/rest/search/v2";
const PAGE = 50;
const MAX_PAGES = 8; // 333 AU publications ≈ 7 pages

function toISO(ms) {
  const n = Number(ms);
  if (!n) return null;
  const d = new Date(n);
  if (isNaN(d)) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function fetchRecords() {
  const out = [];
  const seen = new Set();
  let total = Infinity;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = JSON.stringify({
      q: "",
      aq: "@z95xlanguage==en-AU @templatename==Publication",
      numberOfResults: PAGE,
      firstResult: page * PAGE,
      searchHub: "site search",
      sortCriteria: "@nrfpublishdate descending",
    });
    let json;
    try {
      json = await fetchJson(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch {
      break;
    }
    total = Number(json?.totalCount || total);
    const results = Array.isArray(json?.results) ? json.results : [];
    if (results.length === 0) break;

    for (const r of results) {
      const raw = r?.raw || {};
      const id = raw.id || raw.permanentid || r.clickUri;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      const title = clean(r.title || raw.title);
      let url = clean(r.clickUri || raw.clickuri || "");
      url = url.replace("cm.nortonrosefulbright.com", "www.nortonrosefulbright.com");
      if (!title || !url) continue;
      const tags = []
        .concat(raw.practiceareas || [])
        .concat(raw.primarytag || [])
        .concat(raw.keyindustries || [])
        .filter(Boolean);
      out.push({
        title,
        url,
        dateISO: toISO(raw.nrfpublishdate || raw.date || raw.sysdate),
        teaser: clean(r.excerpt || ""),
        tags,
        auHint: true,
      });
    }
    if ((page + 1) * PAGE >= total) break;
  }
  return out;
}

export default {
  name: "Norton Rose Fulbright",
  order: 8,
  badge: { initial: "N", color: "#7a2e3a" },
  sourceUrl: "https://www.nortonrosefulbright.com/en-au/knowledge/publications",
  domestic: false,
  fetchRecords,
};
