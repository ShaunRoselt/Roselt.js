import { build } from "esbuild";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const strictModeBanner = '"use strict";';

const sharedOptions = {
  absWorkingDir: rootDirectory,
  bundle: true,
  legalComments: "none",
  target: ["es2022"],
};

await Promise.all([
  build({
    ...sharedOptions,
    entryPoints: ["./src/browser-global.js"],
    banner: { js: strictModeBanner },
    format: "iife",
    minify: true,
    outfile: "./dist/roselt.min.js",
  }),
  build({
    ...sharedOptions,
    entryPoints: ["./src/browser-global.js"],
    banner: { js: strictModeBanner },
    format: "iife",
    outfile: "./dist/roselt.js",
  }),
]);

console.log("Roselt.js builds refreshed.");