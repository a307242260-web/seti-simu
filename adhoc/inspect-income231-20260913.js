"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const root = process.argv[2];
assert(root, "需要明确受测目录");
const req = createRequire(`${root}/adhoc/inspect-income231-20260913.js`);
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const output = `${__dirname}/income231-${commit.slice(0, 8)}-20260913.json`;
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const source = "/Users/bilibili/code/seti-simu/seti-saves/seti-save-research-final-income-input-fix-20260913-5b3f3e20-full-v307.json";
const hash = value => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const save = JSON.parse(fs.readFileSync(source));
const env = req("../randomizer/app/simulation-env").createSimulationEnv();
const report = { root, commit, source, sourceHash: hash(fs.readFileSync(source, "utf8")), step: 231 };
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (let i = 0; i < 230; i++) {
    const step = save.replaySteps[i];
    assert.deepEqual(env.legalActions().find(a => a.actionId === step.action.actionId), step.action);
    assert.equal(env.step(step.action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
    if ((i + 1) % 50 === 0) console.log(`[231重放] ${commit.slice(0, 8)} ${i + 1}/230，无AI搜索`);
  }
  report.stateHash = hash(env.saveBrowserSave().committedState);
  report.legal = env.legalActions();
  report.observation = env.observe(report.legal[0].actorId);
  console.log(`[231单决策] ${commit.slice(0, 8)} 开始`);
  const start = performance.now();
  const result = env.runHeuristicPolicyDecision();
  report.wallMs = performance.now() - start;
  assert.equal(result.ok, true);
  report.selection = result.policyDecision;
  report.searches = result.searches;
  report.outcomeSummary = (result.actionOutcomes || []).map(o => ({ actionId: o.actionId, status: o.status }));
} catch (e) { report.error = { message: e.message, stack: e.stack }; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, stateHash: report.stateHash, selection: report.selection, wallMs: report.wallMs, error: report.error }));
}
