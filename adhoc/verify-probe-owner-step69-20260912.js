"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const output = path.join(__dirname, "probe-owner-step69-20260912.json");
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const audit = JSON.parse(fs.readFileSync("/tmp/seti-move-path-audit-20260912.lZS8sa/move-plan69-audit-20260912.json"));
const save = JSON.parse(fs.readFileSync("/Users/bilibili/code/seti-simu/seti-saves/seti-save-research-probe-move-greedy-20260912-d59d423f-full-v270.json"));
const { createSimulationEnv } = require(path.join(root, "randomizer/app/simulation-env"));
const pc = require(path.join(root, "randomizer/game/ai/plan-continuation"));
const env = createSimulationEnv(), report = { root, source: audit.source };
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (let i = 0; i < 68; i++) {
    const expected = save.replaySteps[i];
    const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
    assert.deepEqual(action, expected.action); assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
  }
  const observation = env.observe("player-blue");
  report.check = pc.planReuseCheck(audit.plan69, observation, env.legalActions());
  report.sources = [...new Set(observation.probeRouteRequirements.candidates.map(c => c.sourceId))];
  report.rockets = observation.publicState.board.rockets;
  for (const c of observation.probeRouteRequirements.candidates) if (c.rocketId != null) {
    assert.equal(report.rockets.find(r => r.id === c.rocketId)?.playerId, "player-blue");
  }
  assert(report.sources.includes("launch"));
  report.verifiedThroughStep = 68;
} catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, verifiedThroughStep: report.verifiedThroughStep,
    hit: report.check?.hit, reason: report.check?.reason, sources: report.sources, error: report.error }, null, 2));
}
