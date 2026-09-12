"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "randomizer"], { encoding: "utf8" }).trim(), "");
for (const step of [196, 264, 303, 428, 430, 445, 452, 508, 564]) {
  const output = `adhoc/runezu-error-inputs-20260913/verified-${step}-${commit.slice(0, 8)}.json`;
  if (fs.existsSync(output)) { console.log(`已有核验：${output}`); continue; }
  const input = JSON.parse(fs.readFileSync(`adhoc/runezu-error-inputs-20260913/step-${step}.json`));
  const env = createSimulationEnv(), report = { commit, step };
  try {
    env.loadCheckpoint(input.checkpoint); assert.deepEqual(env.legalActions(), input.legalActions);
    console.log(`[错误核验] 第${step}步开始`);
    const result = env.runHeuristicPolicyDecision();
    report.ok = result.ok; report.searches = result.searches;
    assert.equal(result.ok, true);
    for (const search of result.searches) assert.deepEqual(search.diagnostics.failedNodeCountByCode, {});
  } catch (e) { report.error = { message: e.message, stack: e.stack }; process.exitCode = 1; }
  finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    console.log(`[错误核验] 第${step}步 ${report.error ? report.error.message : "错误为零"}`);
  }
  if (report.error) break;
}
