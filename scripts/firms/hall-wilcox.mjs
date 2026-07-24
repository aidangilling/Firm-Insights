// scripts/firms/hall-wilcox.mjs
//
// Hall & Wilcox — Australian (Next.js + Craft CMS GraphQL). Articles are fetched
// via GraphQL. We filter to the firm's "Competition and Consumer Law" service
// (entry id 15647) and include all (over-include):
//   POST /api/graphql/  entries(section:["article"], relatedToEntries:[{id:[15647]}])
// Fields: title / url / postDate ("j M Y") / summary.

import { fetchJson, clean } from "../lib/shared.mjs";

const ENDPOINT = "https://hallandwilcox.com.au/api/graphql/";
const SERVICE_ID = 15647; // Competition and Consumer Law
const QUERY =
  "query($limit:Int,$offset:Int,$section:[String],$orderBy:String,$rel:[EntryRelationCriteriaInput]){" +
  "entries(private:false,limit:$limit,offset:$offset,section:$section,orderBy:$orderBy,relatedToEntries:$rel){" +
  "id title url postDate @formatDateTime(format:\"j M Y\") ... on article_Entry{summary}}" +
  "entryCount(private:false,section:$section,relatedToEntries:$rel)}";

async function fetchRecords() {
  const out = [];
  const seen = new Set();
  const LIMIT = 50;
  for (let offset = 0; offset < 200; offset += LIMIT) {
    let json;
    try {
      json = await fetchJson(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: QUERY,
          variables: {
            limit: LIMIT,
            offset,
            section: ["article"],
            orderBy: "postDate DESC",
            rel: [{ id: [SERVICE_ID] }],
          },
        }),
      });
    } catch { break; }
    const entries = json?.data?.entries || [];
    if (entries.length === 0) break;
    for (const e of entries) {
      const title = clean(e?.title);
      const url = clean(e?.url);
      if (!title || !url) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        title,
        url,
        dateRaw: clean(e?.postDate), // "14 Apr 2026"
        teaser: clean(e?.summary),
        preFiltered: true,
        defaultTopics: ["Competition & Consumer"],
      });
    }
    const total = Number(json?.data?.entryCount || 0);
    if (offset + LIMIT >= total) break;
  }
  return out;
}

export default {
  name: "Hall & Wilcox",
  order: 16,
  badge: { initial: "H", color: "#5c2d91" },
  sourceUrl: "https://hallandwilcox.com.au/news/?service=15647",
  domestic: true,
  fetchRecords,
};
