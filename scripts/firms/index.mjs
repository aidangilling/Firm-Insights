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
import dlaPiper from "./dla-piper.mjs";
import hallWilcox from "./hall-wilcox.mjs";
import macphersonKelley from "./macpherson-kelley.mjs";
import millsOakley from "./mills-oakley.mjs";

// Real logo badges (files under assets/logos/). tile: optional tile background
// when a logo needs contrast (default tile is white). Firms omitted here use a
// monogram. HSF Kramer stays manual (hard Cloudflare); everything else is
// automated.
const BADGES = {
  "Addisons": { logo: "assets/logos/addisons.svg" },
  "Allens": { logo: "assets/logos/allens.webp" },
  "Mallesons": { logo: "assets/logos/mallesons.png" },
  "Gilbert + Tobin": { logo: "assets/logos/gilbert-tobin.png" },
  "Clayton Utz": { logo: "assets/logos/clayton-utz.png" },
  "Ashurst": { logo: "assets/logos/ashurst.webp" },
  "Baker McKenzie": { logo: "assets/logos/baker-mckenzie.png" },
  "Bird & Bird": { logo: "assets/logos/bird-and-bird.png" },
  "Herbert Smith Freehills Kramer": { logo: "assets/logos/hsf-kramer.png" },
  "Gadens": { logo: "assets/logos/gadens.png" },
  "Corrs Chambers Westgarth": { logo: "assets/logos/corrs.jpg" },
  "Dentons": { logo: "assets/logos/dentons.png" },
  "Maddocks": { logo: "assets/logos/maddocks.png" },
  "DLA Piper": { logo: "assets/logos/dla-piper.webp" },
  "Mills Oakley": { logo: "assets/logos/mills-oakley.png" },
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
  dlaPiper,          // 15 (headless — Vercel challenge)
  hallWilcox,        // 16
  macphersonKelley,  // 17
  millsOakley,       // 18
];

// Reassign display order from position, and attach real logos where supplied.
ADAPTERS.forEach((a, i) => {
  a.order = i + 1;
  if (BADGES[a.name]) a.badge = { ...a.badge, ...BADGES[a.name] };
});
