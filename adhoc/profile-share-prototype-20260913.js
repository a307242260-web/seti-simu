"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
let source = fs.readFileSync("adhoc/profile-share-check-20260913.js", "utf8");
source = source.replace('"adhoc/share-check-components-20260913.json"', '"adhoc/share-check-prototype-20260913.json"');
const start = source.indexOf("let candidate = source.replace("), end = source.indexOf("assert.notEqual(candidate, source);", start);
assert(start > 0 && end > start);
source = source.slice(0, start) + `let candidate = source.replace('const observations = new Map();', 'const observations = new Map(); const unsafePrototypes = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON") || Object.getOwnPropertyDescriptor(Array.prototype, "toJSON");')
  .replace('Object.getOwnPropertyDescriptor(Object.prototype, "toJSON")\\n      || (array && Object.getOwnPropertyDescriptor(Array.prototype, "toJSON"))', 'unsafePrototypes');
` + source.slice(end);
new Function("require", "console", "process", "performance", source)(require, console, process, performance);
