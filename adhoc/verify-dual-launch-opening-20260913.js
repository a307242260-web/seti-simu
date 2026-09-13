"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const baseline = process.argv[2];
if (!baseline) throw new Error("需要329bd8a0独立快照目录");
const output = "adhoc/dual-launch-opening-proof-20260913.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
function capture(api) {
  const env = api.createSimulationEnv();
  try {
    env.reset({ seed: "seti-107", activePlayerCount: 4 });
    assert.equal(env.step(env.legalActions()[0]).ok, true);
    const fork = env.createCounterfactualFork().composition;
    try {
      const state = fork.projection({ role: "simulation" }).state;
      return { seed: state.meta.seed, setup: structuredClone(state.match.initialSetup) };
    } finally { fork.dispose(); }
  } finally { env.dispose(); }
}
const original = capture(require(`${baseline}/randomizer/app/simulation-env`));
const current = capture(require("../randomizer/app/simulation-env"));
assert.equal(current.seed, "seti-107");
assert.deepEqual(current.setup, original.setup, "保留四席起始选项及顺序，不恢复错误meta.seed");
assert.deepEqual(current.setup.offersByPlayerId["player-white"].industryOptions.map(c => c.value),
  ["寰宇动力.png", "异星实验室.png"]);
const result = { baselineCommit: "329bd8a0", baselinePath: baseline, originalSeed: original.seed,
  currentSeed: current.seed, setup: current.setup,
  setupHash: crypto.createHash("sha256").update(JSON.stringify(current.setup)).digest("hex"),
  scope: "仅起始选择定义；不证明其他随机配置、得分与所有页面行为" };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, setupHash: result.setupHash }));
