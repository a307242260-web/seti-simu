"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const randomizerDir = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(randomizerDir, "index.html"), "utf8");
const localScriptSources = [...indexHtml.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/g)]
  .map((match) => match[1])
  .filter((source) => source.startsWith("./"));

assert.ok(localScriptSources.length > 0, "index.html should load local scripts");

const missingScripts = localScriptSources.filter((source) => {
  const pathname = source.split("?", 1)[0];
  return !fs.existsSync(path.resolve(randomizerDir, pathname));
});

assert.deepEqual(
  missingScripts,
  [],
  `index.html references missing local scripts: ${missingScripts.join(", ")}`,
);

console.log("script loading tests passed");
