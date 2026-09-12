"use strict";
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const output = "adhoc/real-leaf-sharing334-20260913.json";
if (fs.existsSync(output)) { console.log(`已有诊断不重跑：${output}`); process.exit(0); }
const file = path.resolve("randomizer/game/ai/heuristic-decision-function.js");
const original = fs.readFileSync(file, "utf8");
let source = original;
function replace(from, to) { assert.equal(source.split(from).length, 2, from); source = source.replace(from, to); }
replace("function policyOutcomeView(outcomes) {", "function policyOutcomeView(outcomes) { const stats = { leaves: 0, sharedLeaves: 0, objectChecks: 0, cacheHits: 0, keys: 0, descriptors: 0 }; const started = performance.now();");
replace("if (eligible.has(value)) return eligible.get(value);", "if (eligible.has(value)) { stats.cacheHits++; return eligible.get(value); } stats.objectChecks++;");
replace("const keys = Reflect.ownKeys(value);", "const keys = Reflect.ownKeys(value); stats.keys += keys.length;");
replace("const descriptor = Object.getOwnPropertyDescriptor(value, key);", "stats.descriptors++; const descriptor = Object.getOwnPropertyDescriptor(value, key);");
replace("return outcomes.map((outcome) => ({", "const diagnosticView = outcomes.map((outcome) => ({");
replace("if (!canShare(leaf.observation)) return leaf;", "stats.leaves++; if (!canShare(leaf.observation)) return leaf;");
replace("const key = JSON.stringify(leaf.observation);", "stats.sharedLeaves++; const key = JSON.stringify(leaf.observation); globalThis.__setiLeafSharing334.observe(key, leaf.observation);");
replace("}));\n}\n\nfunction createHeuristicDecisionFunction", "})); globalThis.__setiLeafSharing334.finish({ ...stats, distinctObservations: observations.size, viewMs: performance.now() - started }); return diagnosticView;\n}\n\nfunction createHeuristicDecisionFunction");
const groups = new Map();
const report = { sourceHash: crypto.createHash("sha256").update(original).digest("hex"),
  scope: "真实334插桩诊断；不改变候选/共享判定，不作为冷门槛成绩" };
globalThis.__setiLeafSharing334 = {
  observe(key, observation) {
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    if (groups.has(hash)) { groups.get(hash).count++; return; }
    groups.set(hash, { hash, count: 1, chars: key.length,
      fields: Object.fromEntries(Object.entries(observation).map(([k, v]) => [k, JSON.stringify(v)?.length || 0])) });
  },
  finish(stats) {
    report.stats = stats;
    report.groups = [...groups.values()].sort((a, b) => b.chars * b.count - a.chars * a.count);
    fs.writeFileSync("adhoc/real-leaf-sharing334-view-20260913.json", JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    console.log(`[观察规模] ${JSON.stringify(stats)}`);
  },
};
// 只在本诊断进程编译计数版本，仓库生产文件不写入、不提交适配层。
const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
mod._compile(source, file); mod.loaded = true; require.cache[file] = mod;
const env = require("../randomizer/app/simulation-env").createSimulationEnv();
try {
  const input = JSON.parse(fs.readFileSync("/tmp/seti-budget334-20260913.OJif7i/adhoc/budget334-input-20260913.json"));
  env.loadCheckpoint(input.checkpoint); assert.deepEqual(env.legalActions(), input.legalActions);
  console.log("[真实叶规模诊断] 第334步开始");
  const result = env.runHeuristicPolicyDecision();
  assert.equal(result.ok, true); report.action = result.policyDecision.actionId; report.searches = result.searches;
} catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  env.dispose(); delete globalThis.__setiLeafSharing334;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, action: report.action, stats: report.stats, error: report.error }, null, 2));
}
