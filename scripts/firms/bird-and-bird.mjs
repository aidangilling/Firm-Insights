// scripts/firms/bird-and-bird.mjs
//
// Bird & Bird — international, Sydney office. Insights are a Vue SPA backed by a
// private Solr JSON endpoint:
//   POST https://www.twobirds.com/api/insightslisting/v1
//   body: { datasourceId, pageNumber, sortOrderDescending:true,
//           Countries:["Australia"], Practices:[…] }
// The API exposes NO teaser, so we query by competition/consumer PRACTICE facet
// in buckets and tag each record with a normalised topic (which also lets the
// shared relevance filter recognise it). Countries=Australia → auHint:true.

import { fetchJson, clean } from "../lib/shared.mjs";

const ENDPOINT = "https://www.twobirds.com/api/insightslisting/v1";
const DATASOURCE = "{33586D35-3082-4775-8837-DF6AC721CC12}";
const HOST = "https://www.twobirds.com";
const MAX_PAGES = 8;

// practice buckets → the topic tag we attach (each tag matches a CORE rule)
const BUCKETS = [
  { tag: "Competition Law", practices: ["Competition Law", "Competition & Regulatory Investigations"] },
  { tag: "Merger control", practices: ["Merger Control, FDI, EU FSR"] },
  { tag: "Consumer Law", practices: ["Consumer contracts", "Consumer enforcement", "Consumer litigation", "International Business-to-Consumer"] },
];

async function fetchBucket(bucket, seen, out) {
  let total = Infinity, got = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    let json;
    try {
      json = await fetchJson(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "en",
          pageNumber: page,
          datasourceId: DATASOURCE,
          initialLoad: false,
          sortByRelevance: false,
          sortOrderDescending: true,
          Countries: ["Australia"],
          Practices: bucket.practices,
        }),
      });
    } catch {
      break;
    }
    total = Number(json?.TotalResultCount ?? total);
    const results = Array.isArray(json?.Results) ? json.Results : [];
    if (results.length === 0) break;
    for (const r of results) {
      const title = clean(r?.Title);
      const rel = clean(r?.ItemUrl);
      if (!title || !rel) continue;
      const url = rel.startsWith("http") ? rel : HOST + rel;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        title,
        url,
        dateISO: (clean(r?.PublicationDate) || "").slice(0, 10) || null,
        topics: [bucket.tag === "Merger control" ? "Mergers" : bucket.tag === "Competition Law" ? "Competition" : "Consumer Law"],
        auHint: true,
        preFiltered: true,
      });
    }
    got += results.length;
    if (got >= total) break;
  }
}

async function fetchRecords() {
  const out = [];
  const seen = new Set();
  for (const bucket of BUCKETS) {
    await fetchBucket(bucket, seen, out);
  }
  return out;
}

export default {
  name: "Bird & Bird",
  order: 7,
  badge: { initial: "B", color: "#d81f2a" },
  sourceUrl: "https://www.twobirds.com/en/insights",
  domestic: false,
  fetchRecords,
};
