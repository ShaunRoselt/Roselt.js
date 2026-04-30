#!/usr/bin/env node

import { runRoseltCli } from "../scripts/cli-core.js";

runRoseltCli().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});