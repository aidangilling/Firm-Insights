// scripts/firms/baker-mckenzie.mjs
//
// Baker McKenzie — MANUAL / CURATED firm.
// bakermckenzie.com exposes a Sitecore insights search API
// (/api/sitecore/insights/search) but its Australia/practice filters are keyed
// by internal GUIDs and the unfiltered feed returns 0 without them, so a robust
// AU-only automated pull isn't available. Baker McKenzie is served from the
// manual layer: add articles under the "Baker McKenzie" key in
// manual-entries.json. This stub returns no scraped rows.

async function fetchRecords() {
  return [];
}

export default {
  name: "Baker McKenzie",
  order: 6,
  badge: { initial: "B", color: "#b31e30" },
  sourceUrl: "https://www.bakermckenzie.com/en/insight",
  domestic: false,
  manualOnly: true,
  fetchRecords,
};
