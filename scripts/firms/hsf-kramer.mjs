// scripts/firms/hsf-kramer.mjs
//
// Herbert Smith Freehills Kramer — MANUAL / CURATED firm.
// hsfkramer.com sits behind a hard Cloudflare challenge that even headless
// Chromium can't pass (verified), so it can't be scraped from CI. HSF Kramer is
// therefore served from the manual layer: add articles under the "Herbert Smith
// Freehills Kramer" key in manual-entries.json. This stub returns no scraped
// rows; the runner merges the manual entries and renders the firm table.

async function fetchRecords() {
  return [];
}

export default {
  name: "Herbert Smith Freehills Kramer",
  order: 9,
  badge: { initial: "H", color: "#00524c" },
  sourceUrl: "https://www.hsfkramer.com/insights/insights-listing",
  domestic: false,
  manualOnly: true,
  fetchRecords,
};
