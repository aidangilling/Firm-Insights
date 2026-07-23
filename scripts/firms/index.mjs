// scripts/firms/index.mjs
//
// The ordered registry of firm adapters. Addisons is first (per the brief),
// then the rest. Adapters are added here as each is built + verified against
// the live site. Each adapter default-exports:
//   { name, order, badge:{initial,color}, sourceUrl, domestic, fetchRecords() }

import addisons from "./addisons.mjs";
import allens from "./allens.mjs";
import kingWoodMallesons from "./king-wood-mallesons.mjs";
import gilbertTobin from "./gilbert-tobin.mjs";
import ashurst from "./ashurst.mjs";
import bakerMckenzie from "./baker-mckenzie.mjs";
import birdAndBird from "./bird-and-bird.mjs";
import nortonRoseFulbright from "./norton-rose-fulbright.mjs";
import hsfKramer from "./hsf-kramer.mjs";
import gadens from "./gadens.mjs";
import corrs from "./corrs.mjs";

// Order matches the brief. Manual-only firms (no reliable automated feed):
// King & Wood Mallesons (3), Baker McKenzie (6) and Herbert Smith Freehills
// Kramer (9) — their tables are filled from manual-entries.json.
export const ADAPTERS = [
  addisons,
  allens,
  kingWoodMallesons,
  gilbertTobin,
  ashurst,
  bakerMckenzie,
  birdAndBird,
  nortonRoseFulbright,
  hsfKramer,
  gadens,
  corrs,
].sort((a, b) => (a.order || 0) - (b.order || 0));
