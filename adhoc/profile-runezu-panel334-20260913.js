"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
let source = fs.readFileSync("adhoc/benchmark-runezu-panel334-20260913.js", "utf8");
assert.equal(source.split("adhoc/runezu-panel334-${commit.slice(0, 8)}").length, 2);
source = source.replace("adhoc/runezu-panel334-${commit.slice(0, 8)}", "adhoc/runezu-panel334-profile-${commit.slice(0, 8)}");
// 独立CPU采样实验，不替代未插桩冷门槛；相同profile结果存在时复用，不覆盖。
new Function("require", "console", "process", "performance", source)(require, console, process, performance);
