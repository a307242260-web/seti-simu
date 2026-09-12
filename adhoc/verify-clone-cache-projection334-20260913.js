"use strict";
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), assert = require("node:assert/strict"), crypto = require("node:crypto"), { execFileSync } = require("node:child_process");
const output = "adhoc/clone-cache-projection334-20260913.json";
if (fs.existsSync(output)) { console.log(`已有证据不重跑：${output}`); process.exit(0); }
const modelPath = path.resolve("randomizer/game/ai/outcome-model.js");
const oldSource = execFileSync("git", ["show", "c5fd5155:randomizer/game/ai/outcome-model.js"], { encoding: "utf8" });
const oldModule = new Module(modelPath, module); oldModule.filename = modelPath; oldModule.paths = Module._nodeModulePaths(path.dirname(modelPath));
oldModule._compile(oldSource, modelPath); oldModule.loaded = true;
const model = require(modelPath), evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const report = { base: "c5fd5155", commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope: "同一次真实搜索原始叶，旧新投影逐叶对照；插桩非冷门槛，不生成整图字符串", leaves: [] };
let rawOutcomes;
globalThis.__setiProjectionCompare334 = (outcomes, options) => {
  rawOutcomes = outcomes;
  const result = model.projectOutcomeObservations(outcomes, options);
  for (let i = 0; i < outcomes.length; i++) for (let j = 0; j < (outcomes[i].leaves || []).length; j++) {
    const old = oldModule.exports.projectOutcomeObservations([{ ...outcomes[i], leaves: [outcomes[i].leaves[j]] }], options)[0];
    const leaf = result[i].leaves[j];
    assert.deepEqual(result[i].rootObservation, old.rootObservation);
    assert.deepEqual(leaf, old.leaves[0], `完整叶值不变：${leaf.leafId}`);
    // 评分输入已逐字段验证相等，再分别调用同一正式评估器核对每一真实叶。
    const action = legalActions.find(a => a.actionId === old.actionId);
    const score = (outcome) => evaluator.evaluateOutcome({ seatId: "player-blue", observation: outcome.rootObservation,
      actionOutcomes: [outcome] }, action, {});
    const previous = score(old), current = score({ ...result[i], leaves: [leaf] });
    assert.deepEqual(current, previous);
    report.leaves.push({ actionId: old.actionId, leafId: leaf.leafId, score: current.score,
      observationHash: hash(leaf.observation), evaluationHash: hash(current) });
    if (report.leaves.length % 500 === 0) console.log(`[逐叶等价] 已验证${report.leaves.length}叶`);
  }
  return result;
};
const hdfPath = path.resolve("randomizer/game/ai/heuristic-decision-function.js");
let source = fs.readFileSync(hdfPath, "utf8");
assert.equal(source.split("outcomeModel.projectOutcomeObservations(").length, 2);
source = source.replace("outcomeModel.projectOutcomeObservations(", "globalThis.__setiProjectionCompare334(");
const hdf = new Module(hdfPath, module); hdf.filename = hdfPath; hdf.paths = Module._nodeModulePaths(path.dirname(hdfPath));
hdf._compile(source, hdfPath); hdf.loaded = true; require.cache[hdfPath] = hdf;
const input = JSON.parse(fs.readFileSync("/tmp/seti-budget334-20260913.OJif7i/adhoc/budget334-input-20260913.json"));
const legalActions = input.legalActions;
const env = require("../randomizer/app/simulation-env").createSimulationEnv();
try {
  env.loadCheckpoint(input.checkpoint); assert.deepEqual(env.legalActions(), legalActions);
  console.log("[投影批次等价] 真实334开始，同一次搜索逐叶比较旧新投影");
  const result = env.runHeuristicPolicyDecision(); assert.equal(result.ok, true);
  report.action = result.policyDecision.actionId; report.searches = result.searches;
  assert.equal(report.leaves.length, 6701);
  assert.equal(report.action, "move:3a47af7c");
  report.plan = result.plan;
  assert(result.searches.every(s => !Object.keys(s.diagnostics.failedNodeCountByCode).length));
  report.passed = true;
} catch (error) { report.error = { message: error.message, stack: error.stack }; report.passed = false; process.exitCode = 1; }
finally {
  env.dispose(); delete globalThis.__setiProjectionCompare334;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, leaves: report.leaves.length, passed: report.passed, error: report.error }, null, 2));
}
