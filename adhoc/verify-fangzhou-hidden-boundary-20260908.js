"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/fangzhou-hidden.js");
const { createSimulationRuleComposition } = req("../randomizer/training/simulation-rule-composition");
const { createSeededRandom, RNG_ALGORITHM } = req("../randomizer/game/random");
const { buildRuleObservation } = req("../randomizer/app/rule-observation");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "fangzhou-hidden-boundary-4d3711c5-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const envelope = structuredClone(JSON.parse(fs.readFileSync(base + "fangzhou-play-missing-reward-v2-20260908.json")).fixture);
const root = JSON.parse(envelope.committedState);
// 奖励5不抽手牌、不重洗，单独证明翻奖励本身就是隐藏边界，不借抽牌屏障过关。
root.aliens.fangzhou.card1Deck = [5, 0, 1, 2, 3, 4, 6, 7, 8];
envelope.committedState = JSON.stringify(root);
const seed = root.meta.seed, random = createSeededRandom(seed);
const report = { passed: false, scope: "派生规则fixture、单一打牌根；非固定完整局或性能基准", rootEnvelope: envelope };
let composition;
try {
  composition = createSimulationRuleComposition({ seed, activePlayerCount: 4, random,
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() }, trustedProjectionReader: true,
    projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed,
      viewer?.playerId || null, [], { cheap: viewer?.cheap === true }) }).composition;
  assert.equal(composition.lifecycle.restore(envelope, { silent: true }).ok, true);
  const before = composition.lifecycle.save().envelope;
  const action = composition.inputPort.enumerateActions().find(a => a.family === "play_card"
    && a.target?.cardInstanceId === "fixture-fangzhou-pink1");
  assert.ok(action);
  const targetId = "card:resolve:fixture-fangzhou-pink1";
  report.outcomes = composition.counterfactualPort.evaluate([action], {
    viewer: { playerId: "player-blue", role: "player" },
    maxDepth: 15, maxLeaves: 8, maxNodes: 128, maxExecutionNodes: 4096,
    maxFrontierNodes: 256, maxMilliseconds: 30000,
    secondaryAgentSearch: { focalSeatId: "player-blue", maxProxyDepth: 1,
      rolloutVersion: "fangzhou-hidden-boundary-proof",
      selectRootTargets: () => [{ targetId, planId: targetId, resultTargetIds: [targetId], compatibleActionIds: [action.actionId] }],
      selectSuccessors: input => input.legalSuccessors,
      completesRouteTarget: input => input.action.actionId === action.actionId,
    },
  });
  report.diagnostics = composition.counterfactualPort.getDiagnostics();
  assert.deepEqual(composition.lifecycle.save().envelope, before, "反事实不得修改正式根/RNG/牌堆");
  assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
  assert.ok(report.diagnostics.hiddenInformationBarrierCountByCode.fangzhou_reward_reveal > 0);
  const leaves = report.outcomes.flatMap(o => o.leaves || []);
  assert.ok(leaves.length > 0);
  assert.ok(leaves.every(l => l.observation.informationBoundary?.code === "fangzhou_reward_reveal"));
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  composition?.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, error: report.error,
    nodes: report.diagnostics?.executedNodeCount, barriers: report.diagnostics?.hiddenInformationBarrierCountByCode, output }, null, 2));
}
