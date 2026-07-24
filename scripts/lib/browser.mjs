// scripts/lib/browser.mjs
//
// Playwright helper for the Cloudflare-protected firms (KWM, Gilbert + Tobin).
// A real headless Chromium passes Cloudflare's managed challenge, after which
// same-origin XHRs (their JSON search endpoints) succeed. We launch once,
// navigate to the origin to obtain the cf_clearance cookie, then run in-page
// fetches. On CI (GitHub Actions) install chromium via:
//   npx playwright install --with-deps chromium
//
// NOTE: if Cloudflare blocks the CI runner's IP, fetchRecords() throws and the
// runner keeps that firm's last-good records (and any manual entries).

import { USER_AGENT } from "./shared.mjs";

let _chromium = null;
async function chromium() {
  if (!_chromium) ({ chromium: _chromium } = await import("playwright"));
  return _chromium;
}

/** Launch, pass Cloudflare on `origin`, run fn(page), always clean up. */
export async function withPage(origin, fn, { waitMs = 4000 } = {}) {
  const c = await chromium();
  const browser = await c.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  try {
    const ctx = await browser.newContext({
      userAgent: USER_AGENT,
      locale: "en-AU",
      viewport: { width: 1280, height: 900 },
    });
    const page = await ctx.newPage();
    // Cloudflare's managed challenge sometimes needs a couple of tries.
    let passed = false;
    for (let attempt = 1; attempt <= 3 && !passed; attempt++) {
      await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(waitMs);
      const title = await page.title();
      if (!/just a moment|attention required|checking your browser/i.test(title)) {
        passed = true;
      } else {
        await page.waitForTimeout(4000); // give the challenge more time, then retry
      }
    }
    if (!passed) throw new Error("Cloudflare challenge not passed");
    return await fn(page);
  } finally {
    await browser.close();
  }
}

/** In-page fetch of a same-origin JSON endpoint (cookies/CF apply). */
export async function pageFetchJson(page, url) {
  return page.evaluate(async (u) => {
    const r = await fetch(u, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }, url);
}
