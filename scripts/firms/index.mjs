// scripts/firms/index.mjs
//
// The ordered registry of firm adapters. Display order = array order below
// (each adapter's `order` is reassigned from its position). Real logo badges are
// attached centrally from the BADGES map; firms with no supplied logo fall back
// to a code-generated monogram.

import addisons from "./addisons.mjs";
import allens from "./allens.mjs";
import kingWoodMallesons from "./king-wood-mallesons.mjs"; // now "Mallesons"
import gilbertTobin from "./gilbert-tobin.mjs";
import minterEllison from "./minter-ellison.mjs";
import claytonUtz from "./clayton-utz.mjs";
import ashurst from "./ashurst.mjs";
import bakerMckenzie from "./baker-mckenzie.mjs";
import birdAndBird from "./bird-and-bird.mjs";
import hsfKramer from "./hsf-kramer.mjs";
import gadens from "./gadens.mjs";
import corrs from "./corrs.mjs";
import dentons from "./dentons.mjs";
import maddocks from "./maddocks.mjs";
import hallWilcox from "./hall-wilcox.mjs";
import macphersonKelley from "./macpherson-kelley.mjs";
import millsOakley from "./mills-oakley.mjs";

// Real logo badges (files under assets/logos/). tile: optional tile background
// when a logo needs contrast (default tile is white). Firms omitted here use a
// monogram. HSF Kramer stays manual (hard Cloudflare); everything else is
// automated.
// logo: the badge image. color: the firm's brand accent (used for its "Visit
// insights" button — deliberately NOT all orange). imgH: optional badge image
// height override (px) for logos that read too large at the default 48.
// color = sampled from each firm's own logo (see badge-colour tooling), lightened
// only where needed for white-text contrast.
const BADGES = {
  "Addisons": { logo: "assets/logos/addisons.svg", color: "#ef8645" },
  "Allens": { logo: "assets/logos/allens.webp", color: "#2559a9" },
  "Mallesons": { logo: "assets/logos/mallesons.png", color: "#242424" },
  "Gilbert + Tobin": { logo: "assets/logos/gilbert-tobin.png", color: "#050c32" },
  "MinterEllison": { logo: "assets/logos/minter-ellison.png", color: "#1a1a1a" },
  "Clayton Utz": { logo: "assets/logos/clayton-utz.jpg", color: "#234443" },
  "Ashurst": { logo: "assets/logos/ashurst.webp", color: "#e15541" },
  "Baker McKenzie": { logo: "assets/logos/baker-mckenzie.png", color: "#c81e2e" },
  "Bird & Bird": { logo: "assets/logos/bird-and-bird.png", color: "#37434c", imgH: 38 },
  "Herbert Smith Freehills Kramer": { logo: "assets/logos/hsf-kramer.png", color: "#211e1e" },
  "Gadens": { logo: "assets/logos/gadens.png", color: "#06839a" },
  "Corrs Chambers Westgarth": { logo: "assets/logos/corrs.jpg", color: "#1a1a1a" },
  "Dentons": { logo: "assets/logos/dentons.png", color: "#6f2e91" },
  "Maddocks": { logo: "assets/logos/maddocks.png", color: "#333333" },
  "Hall & Wilcox": { logo: "assets/logos/hall-wilcox.png", color: "#3496b4" },
  "Macpherson Kelley": { logo: "assets/logos/macpherson-kelley.jpg", color: "#fc482f" },
  "Mills Oakley": { logo: "assets/logos/mills-oakley.webp", color: "#00a0e3" },
};

export const ADAPTERS = [
  addisons,          // 1
  allens,            // 2
  kingWoodMallesons, // 3  Mallesons
  gilbertTobin,      // 4
  minterEllison,     // 5
  claytonUtz,        // 6
  ashurst,           // 7
  bakerMckenzie,     // 8
  birdAndBird,       // 9
  hsfKramer,         // 10 (manual — hard Cloudflare)
  gadens,            // 11
  corrs,             // 12
  dentons,           // 13 (Sydney only)
  maddocks,          // 14
  hallWilcox,        // 15
  macphersonKelley,  // 16
  millsOakley,       // 17
];

// Reassign display order from position, and attach real logos where supplied.
ADAPTERS.forEach((a, i) => {
  a.order = i + 1;
  if (BADGES[a.name]) a.badge = { ...a.badge, ...BADGES[a.name] };
});
