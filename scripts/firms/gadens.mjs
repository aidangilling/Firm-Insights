// scripts/firms/gadens.mjs
//
// Gadens — https://www.gadens.com/latest-insights/
// The insights CPT is REST-invisible, but the theme has a bespoke AJAX endpoint
// that returns EVERY article under a practice-area filter in one POST:
//   POST /wp-content/themes/gardens/ajax.php
//   body: mode=search&keyword1=&area1=Competition, Consumer and Trade Law
// That returns ~145 cards (title/url/teaser) but NO dates, so we read each
// article's Yoast JSON-LD `datePublished`. Dates are cached across runs via the
// previousByUrl map, so only NEW articles are fetched. Every article here is
// filed under the firm's Competition/Consumer/Trade practice → preFiltered.

import { load } from "cheerio";
import { fetchText, politeFetch, clean, sleep } from "../lib/shared.mjs";

const ORIGIN = "https://www.gadens.com";
const AJAX = `${ORIGIN}/wp-content/themes/gardens/ajax.php`;
const AREA = "Competition, Consumer and Trade Law";
const DATE_CONCURRENCY = 6;

async function fetchListing() {
  const body = new URLSearchParams({ mode: "search", keyword1: "", area1: AREA }).toString();
  const html = await fetchText(AJAX, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const $ = load(html);
  const items = [];
  const seen = new Set();
  $("h2.titlein").each((_, el) => {
    const a = $(el).find("a").first();
    const href = a.attr("href");
    const title = clean(a.text());
    if (!href || !title) return;
    if (!/\/legal-insights\//.test(href)) return;
    const url = href.startsWith("http") ? href : ORIGIN + href;
    if (seen.has(url)) return;
    seen.add(url);
    const teaser = clean($(el).nextAll("p").first().text());
    items.push({ title, url, teaser });
  });
  return items;
}

/** Read an article's publication date (ISO) from its Yoast JSON-LD. */
async function fetchDateISO(url) {
  try {
    const res = await politeFetch(url);
    const html = await res.text();
    const m = /"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(html);
    if (m) return m[1];
    const $ = load(html);
    const d = clean($(".date").first().text());
    const m2 = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(d);
    if (m2) return null; // let the runner's parser handle dateRaw instead
    return null;
  } catch {
    return null;
  }
}

// Simple concurrency-limited map.
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function fetchRecords({ previousByUrl } = {}) {
  const items = await fetchListing();

  // Split into cached (date known from a previous run) and new (needs a fetch).
  const needDate = [];
  for (const it of items) {
    const prev = previousByUrl && previousByUrl.get(it.url);
    if (prev && prev.dateISO) it.dateISO = prev.dateISO;
    else needDate.push(it);
  }

  await mapPool(needDate, DATE_CONCURRENCY, async (it) => {
    it.dateISO = await fetchDateISO(it.url);
    await sleep(120);
  });

  return items.map((it) => ({
    title: it.title,
    url: it.url,
    dateISO: it.dateISO || null,
    teaser: it.teaser,
    preFiltered: true,
    defaultTopics: ["Competition & Consumer"],
  }));
}

export default {
  name: "Gadens",
  order: 10,
  badge: { initial: "G", color: "#3f9c35" },
  sourceUrl: "https://www.gadens.com/latest-insights/",
  domestic: true,
  fetchRecords,
};
