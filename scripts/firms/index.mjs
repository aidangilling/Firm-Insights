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
import hsfKramer from "./hsf-kramer.mjs";
import gadens from "./gadens.mjs";
import corrs from "./corrs.mjs";

// Norton Rose Fulbright was dropped: it publishes no findable Australian
// competition/consumer content in its feed. Herbert Smith Freehills Kramer (9)
// is hard-Cloudflare-blocked (headless can't pass) so it is filled from the
// manual layer (manual-entries.json). Every other firm is fully automated.
export const ADAPTERS = [
  addisons,
  allens,
  kingWoodMallesons,
  gilbertTobin,
  ashurst,
  bakerMckenzie,
  birdAndBird,
  hsfKramer,
  gadens,
  corrs,
].sort((a, b) => (a.order || 0) - (b.order || 0));
