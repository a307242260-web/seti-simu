"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
let source = fs.readFileSync("adhoc/verify-clone-cache-projection334-20260913.js", "utf8");
function replace(from, to) { assert.equal(source.split(from).length, 2, from); source = source.replace(from, to); }
replace('"adhoc/clone-cache-projection334-20260913.json"', '"adhoc/node-leaf-projection334-20260913.json"');
replace('const env = require("../randomizer/app/simulation-env").createSimulationEnv();', `
globalThis.__setiAssertLeafProjection334 = (cached, fresh) => {
  assert.deepEqual(cached, fresh, "节点内缓存与当下重新投影/遮蔽值一致");
  report.cacheProjectionChecks = (report.cacheProjectionChecks || 0) + 1;
};
const rulePath = path.resolve("randomizer/game/rule-composition.js");
let ruleSource = fs.readFileSync(rulePath, "utf8");
const needle = "const fullObservation = fullLeafObservation(origin, leafObservation);";
assert.equal(ruleSource.split(needle).length, 2);
ruleSource = ruleSource.replace(needle, needle + "const rebuilt = activeForkComposition.projection(viewer).state; globalThis.__setiAssertLeafProjection334(fullObservation, origin.informationMasked ? sanitizeHiddenInformationObservation(rootObservation, rebuilt, origin.informationBarrier || null) : rebuilt);");
const rule = new Module(rulePath, module); rule.filename = rulePath; rule.paths = Module._nodeModulePaths(path.dirname(rulePath));
rule._compile(ruleSource, rulePath); rule.loaded = true; require.cache[rulePath] = rule;
const env = require("../randomizer/app/simulation-env").createSimulationEnv();`);
// 原脚本在env装配前只加载AI纯模块，rule-composition由此诊断版本进入共享Composition。
new Function("require", "module", "console", "process", "performance", source)(require, module, console, process, performance);
