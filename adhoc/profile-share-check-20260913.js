"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "adhoc/share-check-components-20260913.json";
if (fs.existsSync(output)) { console.log(fs.readFileSync(output, "utf8")); process.exit(0); }
const file = "randomizer/game/ai/heuristic-decision-function.js", text = fs.readFileSync(file, "utf8");
const start = text.indexOf("function policyOutcomeView(outcomes) {"), end = text.indexOf("function createHeuristicDecisionFunction", start);
assert(start >= 0 && end > start);
const source = text.slice(start, end), build = (s, ObjectApi = Object) => new Function("Object", `${s}; return policyOutcomeView;`)(ObjectApi);
const env = require("../randomizer/app/simulation-env").createSimulationEnv();
const model = require("../randomizer/game/ai/outcome-model");
const input = JSON.parse(fs.readFileSync("/tmp/seti-budget334-20260913.OJif7i/adhoc/budget334-input-20260913.json"));
env.loadCheckpoint(input.checkpoint);
const observation = model.createDecisionObservation(env.observe(), { seatId: "player-blue" });
env.dispose();
function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const outcomes = [{ leaves: Array.from({ length: 100 }, () => ({ observation: freeze(structuredClone(observation)) })) }];
const calls = {}, times = {}, api = Object.create(Object);
for (const name of ["isFrozen", "getPrototypeOf", "getOwnPropertyDescriptor", "hasOwn"]) {
  api[name] = (...args) => { const t = performance.now(); const result = Object[name](...args);
    times[name] = (times[name] || 0) + performance.now() - t; calls[name] = (calls[name] || 0) + 1; return result; };
}
let t = performance.now(); const original = build(source)(outcomes); const originalMs = performance.now() - t;
t = performance.now(); build(source, api)(outcomes); const instrumentedMs = performance.now() - t;
// 等价冻结判定实验：非扩展+逐属性不可配置/不可写；复用本来必读的descriptor，不省略冻结条件。
let candidate = source.replace("!Object.isFrozen(value)", "Object.isExtensible(value)")
  .replace('if (array && key === "length") continue;', 'if (array && key === "length") { if (Object.getOwnPropertyDescriptor(value, key).writable) return false; continue; }')
  .replace('if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")', 'if (descriptor.configurable || descriptor.writable || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")');
assert.notEqual(candidate, source);
t = performance.now(); const changed = build(candidate)(outcomes); const candidateMs = performance.now() - t;
assert.deepEqual(changed, original);
assert.equal(changed[0].leaves[0].observation, changed[0].leaves[99].observation);
const report = { source: file, sourceHash: crypto.createHash("sha256").update(text).digest("hex"),
  scope: "真实334根观察复制100份的受控微基准；不代表完整叶分布或正式单决策成绩", originalMs, instrumentedMs, calls, times, candidateMs };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(report, null, 2));
