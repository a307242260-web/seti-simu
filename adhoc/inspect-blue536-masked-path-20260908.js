"use strict";
// 诊断实验：正式搜索内核只展开已保存的一条路径，观察/RNG/结算全部由内核提供。
// 不是生产候选或性能基准，不将受约束路径的完成外推为全局搜索完成。
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/masked536.js");
const { createSimulationRuleComposition } = req("../randomizer/training/simulation-rule-composition");
const { createSeededRandom, RNG_ALGORITHM } = req("../randomizer/game/random");
const { buildRuleObservation } = req("../randomizer/app/rule-observation");
const evaluator = req("../randomizer/game/ai/expected-score-evaluator");
const parent = require("/private/tmp/seti-borrowed-probe-cache-20260908/randomizer/game/ai/expected-score-evaluator");
const continuation = req("../randomizer/game/ai/plan-continuation");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "blue536-masked-path-native-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { passed: false, checks: [], scope: "约束旧物理路径，只验证准入与隐藏信息边界，不验证全局beam" };
let fork;
try {
  const old = JSON.parse(fs.readFileSync(base + "blue536-turing-baseline-20260908.json"));
  const chain = old.leaf.actionChain, physicalSteps = [];
  for (const step of old.leaf.planSteps) {
    if (step.action.actionId === chain[physicalSteps.length]) physicalSteps.push(step);
  }
  assert.equal(physicalSteps.length, chain.length);
  // 普通反事实fork禁止再次创建fork。使用与Simulation相同的正式宿主factory，
  // 再载入根envelope；不是嵌套fork或给生产接口注入旁路。
  const config = JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
  const random = createSeededRandom(config.seed);
  fork = createSimulationRuleComposition({ seed: config.seed, activePlayerCount: 4, random,
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() }, trustedProjectionReader: true,
    projectCounterfactualState: (state, viewer) => buildRuleObservation(state, config.seed,
      viewer?.playerId || null, [], { cheap: viewer?.cheap === true }) }).composition;
  assert.equal(fork.lifecycle.restore(old.rootEnvelope, { silent: true }).ok, true);
  const rootState = fork.lifecycle.save().envelope.committedState;
  const started = performance.now();
  const outcomes = fork.counterfactualPort.evaluate([physicalSteps[0].action], {
    viewer: { playerId: "player-blue", role: "player" },
    maxDepth: 15, maxLeaves: 8, maxNodes: 128, maxExecutionNodes: 4096,
    maxFrontierNodes: 256, maxMilliseconds: 30000, allowUntargetedRootActions: true,
    capturePlanStep: continuation.capturePlanStep,
    secondaryAgentSearch: {
      focalSeatId: "player-blue", maxProxyDepth: 15,
      rolloutVersion: evaluator.SECONDARY_AGENT_ROLLOUT_VERSION,
      selectRootTargets(input) {
        const roots = evaluator.enumerateSecondaryAgentRootTargets(input).filter(t =>
          t.targetId === physicalSteps[0].routeTargetId && t.planId === physicalSteps[0].routePlanId);
        assert.equal(roots.length, 1); return roots;
      },
      selectSuccessors(input) {
        assert.deepEqual(input.actionChain, chain.slice(0, input.actionChain.length));
        const expected = physicalSteps[input.actionChain.length];
        if (!expected) return [];
        const before = parent.selectSecondaryAgentSuccessors(input);
        const after = evaluator.selectSecondaryAgentSuccessors(input);
        const matches = a => a.actionId === expected.action.actionId
          && a.routeTargetId === expected.routeTargetId && a.routePlanId === expected.routePlanId;
        const oldMatches = before.filter(matches), newMatches = after.filter(matches);
        report.checks.push({ chainLength: input.actionChain.length, nextAction: expected.action.summary,
          nextActionId: expected.action.actionId, target: expected.routeTargetId, plan: expected.routePlanId,
          parentAdmitted: oldMatches.length > 0, candidateAdmitted: newMatches.length > 0,
          parentCount: before.length, candidateCount: after.length,
          observation: input.branchObservation, legal: input.legalSuccessors,
          removed: before.filter(a => !after.some(b => a.actionId === b.actionId
            && a.routeTargetId === b.routeTargetId && a.routePlanId === b.routePlanId)).map(a => a.summary) });
        assert.equal(oldMatches.length, 1, "父版路径准入应匹配；不匹配先检查诊断重放契约");
        if (!newMatches.length) report.firstExcluded = input.actionChain.length + 1;
        return newMatches;
      },
      selectDataSettlement: evaluator.selectSecondaryAgentDataSettlement,
      selectRouteTarget: evaluator.selectSecondaryAgentRouteTarget,
      completesRouteTarget: evaluator.completesSecondaryAgentRouteTarget,
      advanceRoutePlan: evaluator.advanceSecondaryAgentRoutePlan,
    },
  });
  report.wallMs = performance.now() - started;
  report.diagnostics = fork.counterfactualPort.getDiagnostics();
  report.outcomes = outcomes;
  assert.ok(report.diagnostics, JSON.stringify(outcomes.map(o => ({ status: o.status, code: o.code }))));
  assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
  assert.equal(fork.lifecycle.save().envelope.committedState, rootState, "诊断不能污染根");
  const leaf = outcomes[0].leaves.find(l => JSON.stringify(l.actionChain) === JSON.stringify(chain));
  report.completeOldChain = Boolean(leaf);
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  fork?.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error,
    completeOldChain: report.completeOldChain, firstExcluded: report.firstExcluded,
    wallMs: report.wallMs, nodes: report.diagnostics?.executedNodeCount,
    checks: report.checks.map(({ observation, legal, ...rest }) => rest) }, null, 2));
}
