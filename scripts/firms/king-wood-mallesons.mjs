// scripts/firms/king-wood-mallesons.mjs
//
// King & Wood Mallesons — MANUAL / CURATED firm.
// The KWM site (mallesons.com) sits behind a Cloudflare challenge, and its
// "Latest Thinking" listing carries no publication dates (they live only on the
// article pages), so it can't be scraped reliably/dated in CI. KWM is therefore
// served from the manual layer: add articles under the "King & Wood Mallesons"
// key in manual-entries.json. This stub returns no scraped rows; the runner
// merges the manual entries and renders the firm table.

async function fetchRecords() {
  return [];
}

export default {
  name: "King & Wood Mallesons",
  order: 3,
  badge: { initial: "K", color: "#3b2a6b" },
  sourceUrl: "https://www.mallesons.com/au/en/insights/latest-thinking.html?page=1",
  domestic: true,
  manualOnly: true,
  fetchRecords,
};
