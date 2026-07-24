// scripts/firms/dentons.mjs
//
// Dentons — international; we want SYDNEY only. The insights listing is an ASMX
// ScriptService returning base64-encoded gzip JSON. We filter to the Competition
// & Antitrust practice AND the Sydney city, and include all (over-include):
//   GET /DentonsServices/DentonsInsightSearch.asmx/InsightSearchData
//       ?data=practiceid=BA4220D5COMPE:regionid=:city=5CFDCB74SYDNE
//       &contextLanguage=en&contextSite=dentons&pageNumber=1&pageSize=500
// IMPORTANT: do NOT send a Content-Type header on this GET (→ HTTP 500).
// Fields: [0].tabData[] { heading, link, date ("July 9, 2026"), details }.

import { gunzipSync } from "node:zlib";
import { politeFetch, stripHtml, clean } from "../lib/shared.mjs";

const ENDPOINT = "https://www.dentons.com/DentonsServices/DentonsInsightSearch.asmx/InsightSearchData";
const SYDNEY = "regionid=:city=5CFDCB74SYDNE";
const COMPETITION_SYDNEY = "practiceid=BA4220D5COMPE:" + SYDNEY;

async function fetchData(dataFilter) {
  const url =
    `${ENDPOINT}?data=${encodeURIComponent(dataFilter)}` +
    `&contextLanguage=en&contextSite=dentons&pageNumber=1&pageSize=500`;
  const res = await politeFetch(url, {
    headers: { Referer: "https://www.dentons.com/en/insights", Accept: "*/*" },
  });
  const b64 = (await res.text()).trim();
  let json;
  try {
    json = JSON.parse(gunzipSync(Buffer.from(b64, "base64")).toString("utf8"));
  } catch {
    json = JSON.parse(b64); // some responses are plain JSON
  }
  const block = Array.isArray(json) ? json[0] : json;
  return block?.tabData || [];
}

function mapRow(r, extra) {
  const title = stripHtml(r?.heading);
  const url = clean(r?.link);
  if (!title || !url) return null;
  const dates = String(r?.date || "").match(/[A-Za-z]+ \d{1,2}, \d{4}/g) || [];
  return {
    title,
    url,
    dateRaw: dates.length ? dates[dates.length - 1] : clean(r?.date),
    teaser: stripHtml(r?.details),
    ...extra,
  };
}

async function fetchRecords() {
  const out = [];
  const seen = new Set();
  const push = (rec) => { if (rec && !seen.has(rec.url)) { seen.add(rec.url); out.push(rec); } };

  // A) Competition practice × Sydney — include all.
  try {
    (await fetchData(COMPETITION_SYDNEY)).forEach((r) =>
      push(mapRow(r, { preFiltered: true, defaultTopics: ["Competition & Consumer"] })));
  } catch { /* keep going */ }

  // B) All Sydney insights — keyword filter catches competition/consumer pieces
  //    filed under other practices.
  try {
    (await fetchData(SYDNEY)).forEach((r) => push(mapRow(r, {})));
  } catch { /* keep going */ }

  return out;
}

export default {
  name: "Dentons",
  order: 13,
  badge: { initial: "D", color: "#6a1a9a" },
  sourceUrl: "https://www.dentons.com/en/insights?Filters=%26regionid%3D5CFDCB74SYDNE",
  domestic: false,
  fetchRecords,
};
