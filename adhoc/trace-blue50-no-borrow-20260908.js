"use strict";
// 独立取证实验：全局搜索参数保持生产口径，回调原样返回正式筛选结果。
// 只记录历史优胜路径的前缀，不重复整局或将此次耗时作为性能验收。
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/global536.js");
const { createSimulationRuleComposition } = req("../randomizer/training/simulation-rule-composition");
const { createSeededRandom, RNG_ALGORITHM } = req("../randomizer/game/random");
const { buildRuleObservation } = req("../randomizer/app/rule-observation");
const evaluator = req("../randomizer/game/ai/expected-score-evaluator");
const model = req("../randomizer/game/ai/outcome-model");
const continuation = req("../randomizer/game/ai/plan-continuation");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const queueTrace = process.argv.includes("--queue-trace");
const output = base + (queueTrace ? "blue50-no-borrow-queue-trace-20260908.json"
  : "blue50-no-borrow-prefix-20260908.json");
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { passed: false, prefixes: [], callbackCount: 0,
  scope: queueTrace ? "指定旧路径队列事件；节点、输入与优胜计划须与历史一致"
    : "全局搜索旧路径回调观测，不修改筛选，不等于队列裁剪事件追踪",
  codeHead: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() };
let composition;
try {
  const old = JSON.parse(fs.readFileSync(base + "blue50-expiry-baseline-20260908.json"));
  const recorded = JSON.parse(fs.readFileSync(base + "blue50-expiry-candidate-20260908.json"));
  const removed = new Set(old.leaf.planSteps.slice(7, 9).map(s => s.action.actionId));
  const chain = old.leaf.actionChain.filter(id => !removed.has(id)), physicalSteps = [];
  report.tracedChain = chain;
  for (const step of old.leaf.planSteps.filter(s => !removed.has(s.action.actionId))) {
    if (step.action.actionId === chain[physicalSteps.length]) physicalSteps.push(step);
  }
  assert.equal(physicalSteps.length, chain.length);
  const config = JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
  const random = createSeededRandom(config.seed), seatId = "player-blue";
  composition = createSimulationRuleComposition({ seed: config.seed, activePlayerCount: 4, random,
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() }, trustedProjectionReader: true,
    projectCounterfactualState: (state, viewer) => buildRuleObservation(state, config.seed,
      viewer?.playerId || null, [], { cheap: viewer?.cheap === true }) }).composition;
  assert.equal(composition.lifecycle.restore(old.rootEnvelope, { silent: true }).ok, true);
  const rootBefore = composition.lifecycle.save().envelope.committedState;
  const observation = composition.projection({ playerId: seatId, role: "player" }).state;
  const rootCandidates = composition.inputPort.enumerateActions().filter(action =>
    evaluator.requiresRootCounterfactual(action, observation));
  const actions = evaluator.selectSecondaryAgentRootActions({ focalSeatId: seatId,
    rootObservation: observation, legalActions: rootCandidates, maxProxyDepth: 15 });
  assert.equal(actions.length, recorded.diagnostics.candidateCount);
  report.actions = actions;
  console.log("[50路径取证] 第一轮蓝方；固定4096上限，候选/评分不变，开始记录旧路径前缀。");
  const started = performance.now();
  const raw = composition.counterfactualPort.evaluate(actions, {
    viewer: { playerId: seatId, role: "player" }, maxDepth: 15, maxLeaves: 8,
    maxNodes: 128, maxExecutionNodes: 4096, maxFrontierNodes: 256, maxMilliseconds: 30000,
    maxFrontierPerRoot: 1, allowUntargetedRootActions: true, confidence: "low",
    capturePlanStep: continuation.capturePlanStep,
    ...(queueTrace ? { traceActionChain: chain } : {}),
    getBranchPriority(input) {
      return evaluator.evaluateSecondaryAgentSearchPriority({ ...input, focalSeatId: seatId });
    },
    secondaryAgentSearch: {
      focalSeatId: seatId, maxProxyDepth: 15, rolloutVersion: evaluator.SECONDARY_AGENT_ROLLOUT_VERSION,
      selectRootTargets: evaluator.enumerateSecondaryAgentRootTargets,
      selectSuccessors(input) {
        const selected = evaluator.selectSecondaryAgentSuccessors(input);
        report.callbackCount++;
        if (input.actionChain.length <= chain.length
          && input.actionChain.every((id, index) => chain[index] === id)) {
          const expected = physicalSteps[input.actionChain.length];
          report.prefixes.push({ callback: report.callbackCount, length: input.actionChain.length,
            current: input.currentAction.summary, target: input.routeTargetId, plan: input.routePlanId,
            nextExpected: expected?.action.summary,
            admitted: expected ? selected.filter(a => a.actionId === expected.action.actionId
              && a.routeTargetId === expected.routeTargetId && a.routePlanId === expected.routePlanId) : [],
            selected: selected.map(a => ({ id: a.actionId, summary: a.summary,
              target: a.routeTargetId, plan: a.routePlanId })) });
        }
        return selected;
      },
      selectDataSettlement: evaluator.selectSecondaryAgentDataSettlement,
      selectRouteTarget: evaluator.selectSecondaryAgentRouteTarget,
      completesRouteTarget: evaluator.completesSecondaryAgentRouteTarget,
      advanceRoutePlan: evaluator.advanceSecondaryAgentRoutePlan,
    },
  });
  report.wallMs = performance.now() - started;
  report.diagnostics = composition.counterfactualPort.getDiagnostics();
  assert.ok(report.diagnostics);
  if (queueTrace) assert.ok(Array.isArray(report.diagnostics.searchPathTrace));
  const stableFields = ["executedNodeCount", "successfulInputSubmissionCount", "attemptedNodeCountByFamily",
    "failedNodeCountByCode", "executionLimitReached", "remainingFrontierNodeCount", "beamPrunedOriginCount",
    "transpositionHitCount", "executedOriginCountByTargetAndDecisionKind"];
  for (const key of stableFields) assert.deepEqual(report.diagnostics[key], recorded.diagnostics[key], key);
  const outcomes = model.projectOutcomeObservations(raw, { seatId, stateVersion: actions[0].stateVersion,
    decisionVersion: actions[0].decisionVersion });
  report.evaluations = outcomes.map(o => ({ actionId: o.actionId,
    evaluation: evaluator.evaluateOutcome({ seatId, actionOutcomes: [o] }, actions.find(a => a.actionId === o.actionId), {}) }));
  const winner = outcomes.find(o => o.actionId === recorded.decision.actionId);
  const evaluation = report.evaluations.find(o => o.actionId === recorded.decision.actionId).evaluation;
  const leaf = winner.leaves.find(l => l.leafId === evaluation.selectedLeafId);
  assert.deepEqual(leaf.planSteps, recorded.leaf.planSteps);
  assert.equal(evaluation.value, recorded.evaluation.value);
  assert.equal(composition.lifecycle.save().envelope.committedState, rootBefore);
  report.longestObservedPrefix = Math.max(0, ...report.prefixes.map(p => p.length));
  report.matchRecordedSearch = true;
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  composition?.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, wallMs: report.wallMs,
    longestObservedPrefix: report.longestObservedPrefix, nodes: report.diagnostics?.executedNodeCount,
    queueEvents: report.diagnostics?.searchPathTrace?.filter(event => event.chain.length >= 8
      && ["beam-pruned", "remaining", "execute"].includes(event.event)),
    prefixes: report.prefixes.map(p => ({ length: p.length, current: p.current,
      nextExpected: p.nextExpected, admittedCount: p.admitted.length })) }, null, 2));
}
