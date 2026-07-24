// scripts/lib/shared.mjs
//
// Shared helpers for every firm adapter and the runner:
//  - polite fetch (browser UA, retries/backoff, delay)
//  - text cleaning + date parsing → { dateISO, dateText, month, year }
//  - the RELEVANCE filter (competition / consumer law keyword seed list)
//  - the JURISDICTION filter (Australia / NSW-Sydney signals)
//  - a Topic label derived from which keywords matched
//
// Adapters return "raw" records; the runner passes them through here.

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------

// A plain, current-browser UA. NOTE: several WAFs (incl. the ACCC's) block any
// UA containing the word "bot" — keep this clean.
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const REQUEST_DELAY_MS = 450; // be polite between requests
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "en-AU,en;q=0.9",
};

/** Fetch with retries + exponential backoff. Returns the Response (ok only). */
export async function politeFetch(url, opts = {}, attempt = 1) {
  const MAX_ATTEMPTS = 3;
  const headers = { ...DEFAULT_HEADERS, ...(opts.headers || {}) };
  try {
    const res = await fetch(url, { redirect: "follow", ...opts, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) {
      const backoff = 900 * attempt;
      await sleep(backoff);
      return politeFetch(url, opts, attempt + 1);
    }
    throw new Error(`${err.message} for ${url}`);
  }
}

export async function fetchText(url, opts) {
  const res = await politeFetch(url, opts);
  return res.text();
}
export async function fetchJson(url, opts) {
  const res = await politeFetch(url, {
    ...opts,
    headers: { Accept: "application/json, text/javascript, */*; q=0.01", ...(opts?.headers || {}) },
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Text + dates
// ---------------------------------------------------------------------------

export const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

/** Strip HTML tags + decode the common entities seen in CMS titles/excerpts. */
export function stripHtml(s) {
  return clean(
    String(s || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#0?38;/g, "&")
      .replace(/&#8217;|&#8216;|&rsquo;|&lsquo;/g, "'")
      .replace(/&#8220;|&#8221;|&rdquo;|&ldquo;|&quot;/g, '"')
      .replace(/&#8211;|&ndash;/g, "–")
      .replace(/&#8212;|&mdash;/g, "—")
      .replace(/&hellip;|&#8230;/g, "…")
  );
}

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_INDEX = {};
MONTHS_FULL.forEach((m, i) => {
  MONTH_INDEX[m.toLowerCase()] = i + 1;
  MONTH_INDEX[m.slice(0, 3).toLowerCase()] = i + 1;
});
MONTH_INDEX["sept"] = 9;

/** Build the display/sort fields from an ISO date string (YYYY-MM-DD). */
export function dateFieldsFromISO(iso) {
  if (!iso || typeof iso !== "string") return { dateISO: null, dateText: "", month: "", year: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return { dateISO: null, dateText: "", month: "", year: null };
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return {
    dateISO: `${m[1]}-${m[2]}-${m[3]}`,
    dateText: `${d} ${MONTHS_FULL[mo - 1]} ${y}`,
    month: `${MONTHS_FULL[mo - 1]} ${y}`,
    year: y,
  };
}

/**
 * Best-effort parse of a human date string into ISO. Handles:
 *  "10 July 2026", "July 10, 2026", "10 Jul 2026", "2026-07-10",
 *  "10/07/2026" (day-first, AU), "July 2026".
 * Returns null if nothing usable.
 */
export function parseDateToISO(input) {
  const s = clean(input);
  if (!s) return null;

  // Already ISO?
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // "10 July 2026" / "10 Jul 2026" / "10 September 2026"
  m = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/.exec(s);
  if (m && MONTH_INDEX[m[2].toLowerCase()]) {
    return isoOf(m[3], MONTH_INDEX[m[2].toLowerCase()], m[1]);
  }

  // "July 10, 2026" / "Jul 10 2026"
  m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(s);
  if (m && MONTH_INDEX[m[1].toLowerCase()]) {
    return isoOf(m[3], MONTH_INDEX[m[1].toLowerCase()], m[2]);
  }

  // "10/07/2026" or "10-07-2026" — day-first (Australian convention)
  m = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/.exec(s);
  if (m) {
    let d = Number(m[1]), mo = Number(m[2]);
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // tolerate month-first
    if (mo >= 1 && mo <= 12) return isoOf(m[3], mo, d);
  }

  // "July 2026" (month only) → first of month
  m = /\b([A-Za-z]{3,9})\.?\s+(\d{4})\b/.exec(s);
  if (m && MONTH_INDEX[m[1].toLowerCase()]) {
    return isoOf(m[2], MONTH_INDEX[m[1].toLowerCase()], 1);
  }

  // Fallback: let Date try (e.g. ISO timestamps).
  const d = new Date(s);
  if (!isNaN(d)) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate()
    ).padStart(2, "0")}`;
  }
  return null;
}

function isoOf(y, mo, d) {
  const yy = Number(y), mm = Number(mo), dd = Number(d);
  if (!yy || !mm || !dd) return null;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Relevance filter — competition and/or consumer law
// ---------------------------------------------------------------------------
// Two tiers:
//  - CORE_RULES: a match QUALIFIES the article as relevant AND contributes its
//    Topic label. These are unambiguous competition / consumer-law signals.
//    Per the brief we LEAN TO INCLUDE — even a single core mention qualifies.
//  - CONTEXT_RULES: generic terms ("penalties", "enforcement", "pricing") that
//    are all over general legal writing (employment penalty rates, Privacy Act
//    penalties, ASIC crypto enforcement…). These only ADD a label when the
//    article is ALREADY relevant via a core rule — they never qualify it alone.
//    This keeps the aggregator on-topic without silently dropping real items.

const CORE_RULES = [
  { label: "Competition", re: /\b(competition law|anti-?competitive|antitrust|competitive process|competition (and|&) consumer)\b/i },
  { label: "Cartel", re: /\bcartels?\b|price[-\s]?fixing|bid[-\s]?rigging|market sharing/i },
  { label: "Mergers", re: /\bmergers?\b|merger control|merger reform|merger clearance|\bM&A\b|mergers?\s+(and|&)\s+acquisitions?|gun[-\s]?jumping/i },
  { label: "Market Power", re: /market power|misuse of market power|section 46\b|\bs\.?\s?46\b|exclusive dealing|resale price maintenance/i },
  { label: "ACCC", re: /\bACCC\b|australian competition (and|&) consumer commission/i },
  { label: "Competition and Consumer Act", re: /competition and consumer act|\bCCA\b|trade practices act/i },
  { label: "Consumer Law", re: /consumer law|australian consumer law|\bACL\b|consumer guarantee|consumer protection|consumer rights/i },
  { label: "Misleading Conduct", re: /misleading or deceptive|misleading and deceptive|misleading conduct|false or misleading|misrepresentation to consumers/i },
  { label: "Unconscionable Conduct", re: /unconscionable conduct/i },
  { label: "Unfair Contract Terms", re: /unfair contract terms?|\bUCT\b/i },
  { label: "Unfair Trading", re: /unfair trading|unfair (trade )?practices/i },
  { label: "Product Safety", re: /product safety|product recall|consumer goods safety|mandatory (safety )?standard/i },
  { label: "Franchising", re: /franchis(ing|e) code|\bfranchising\b/i },
  { label: "Greenwashing", re: /greenwashing|misleading environmental claims|misleading sustainability claims/i },
  { label: "Pricing", re: /\bprice fixing\b|drip pricing|surcharg|excessive pricing|deceptive pricing|misleading pricing|\bpricing practices\b/i },
];

const CONTEXT_RULES = [
  { label: "Enforcement & Penalties", re: /\bpenalt(y|ies)\b|enforcement action|infringement notice|civil penalt|pecuniary penalt/i },
];

/** Returns { relevant:boolean, topics:string[] } for a blob of text. */
export function assessRelevance(text) {
  const t = text || "";
  const topics = [];
  for (const rule of CORE_RULES) {
    if (rule.re.test(t)) topics.push(rule.label);
  }
  const relevant = topics.length > 0;
  // Context labels only enrich an already-relevant article.
  if (relevant) {
    for (const rule of CONTEXT_RULES) {
      if (rule.re.test(t)) topics.push(rule.label);
    }
  }
  return { relevant, topics: [...new Set(topics)] };
}

// ---------------------------------------------------------------------------
// Jurisdiction filter — Australia / NSW-Sydney
// ---------------------------------------------------------------------------
// For international firms we require at least one Australian signal. Domestic
// Australian firms are treated as AU by default (adapter sets domestic:true).

const AU_SIGNAL = /\b(australia|australian|sydney|melbourne|brisbane|perth|canberra|adelaide|new south wales|\bNSW\b|victoria|queensland|western australia|\bACCC\b|\bASIC\b|\bASX\b|\bAPRA\b|\bACMA\b|\bAER\b|federal court of australia|high court of australia|competition and consumer act|australian consumer law|foreign investment review board|\bFIRB\b|treasury laws)\b/i;

const AU_URL = /(\.com\.au|\.gov\.au|\/au\/|\/en-au|\/australia|[?&](country|region|location)=au)/i;

/** True if the text/url carries an Australian jurisdiction signal. */
export function hasAuSignal({ text = "", url = "" } = {}) {
  return AU_URL.test(url) || AU_SIGNAL.test(text);
}

// A clearly-FOREIGN jurisdiction signal. Used for domestic Australian firms
// (which also run Asia/UK/US practices): a piece that is plainly about another
// country AND carries no Australian tie is excluded. Country NAMES are matched
// case-insensitively; the ambiguous 2–3 letter abbreviations (US/UK/EU — "us"
// is also a pronoun) are matched case-SENSITIVELY to avoid false hits.
const FOREIGN_NAME = /\b(vietnam|singapore|hong kong|\bchina\b|chinese|indonesia|malaysia|thailand|philippines|japan|japanese|korea|korean|\bindia\b|indian|taiwan|united kingdom|england|scotland|ireland|united states|america|american|europe|european union|germany|german|france|french|spain|italy|netherlands|belgium|brussels|switzerland|new zealand|middle east|saudi|qatar|\buae\b|abu dhabi|dubai|\bafrica\b|brazil|\bcanada\b|mexico)\b/i;
const FOREIGN_ABBR = /\b(UK|US|USA|EU|PRC|NZ)\b/;

export function hasForeignSignal({ text = "", url = "" } = {}) {
  return FOREIGN_NAME.test(text) || FOREIGN_ABBR.test(text) ||
    /(\/en-gb|\/en-us|\/uk\/|\/us\/|\/asia|\/en-419|\/de-de)/i.test(url);
}
