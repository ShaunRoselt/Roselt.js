#!/usr/bin/env node

const cliModule = await loadCliModule();

cliModule.runCreateCli(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function loadCliModule() {
  try {
    return await import("roselt-js/cli");
  } catch {
    return import("../../scripts/cli-core.js");
  }
}