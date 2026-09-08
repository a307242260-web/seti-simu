"use strict";
// 只读调试器断点读取执行键；不改生产源码、筛选器或预算。耗时不作性能验收。
const fs = require("node:fs"), assert = require("node:assert/strict");
const path = require("node:path"), inspector = require("node:inspector");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/inspect.js");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "blue50-physical-reexecution-81ee9ed6-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { passed: false, executions: [], scope: "单根全执行键取证；调试耗时不作为性能指标" };
const debug = new inspector.Session();
let composition, callbackError;
function post(method, params = {}) {
  let result, failure, done = false;
  debug.post(method, params, (error, value) => { failure = error; result = value; done = true; });
  assert.equal(done, true, "同进程调试命令必须同步返回");
  if (failure) throw failure;
  return result;
}
try {
  report.codeHead = require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const sourcePath = path.resolve("randomizer/game/rule-composition.js");
  const lines = fs.readFileSync(sourcePath, "utf8").split("\n");
  const line = lines.findIndex(value => value.includes("const execution = executeNode(node);"));
  assert.ok(line > 0);
  debug.connect(); post("Debugger.enable");
  debug.on("Debugger.paused", ({ params }) => {
    try {
      const result = post("Debugger.evaluateOnCallFrame", {
        callFrameId: params.callFrames[0].callFrameId,
        expression: "({key, ordinal:executedNodeCount, family:node.action.family, summary:node.action.summary, origins:node.origins.map(o=>({target:o.routeTargetId,plan:o.routePlanId,masked:Boolean(o.informationMasked)}))})",
        returnByValue: true, throwOnSideEffect: true,
      });
      assert.equal(result.exceptionDetails, undefined);
      report.executions.push(result.result.value);
    } catch (error) { callbackError = error; }
    finally { post("Debugger.resume"); }
  });
  post("Debugger.setBreakpointByUrl", { url: require("node:url").pathToFileURL(sourcePath).href, lineNumber: line });
  const { createSimulationRuleComposition } = req("../randomizer/training/simulation-rule-composition");
  const { createSeededRandom, RNG_ALGORITHM } = req("../randomizer/game/random");
  const { buildRuleObservation } = req("../randomizer/app/rule-observation");
  const evaluator = req("../randomizer/game/ai/expected-score-evaluator");
  const model = req("../randomizer/game/ai/outcome-model");
  const continuation = req("../randomizer/game/ai/plan-continuation");
  const recorded = JSON.parse(fs.readFileSync(base + "blue50-expiry-fangzhou-20260908.json"));
  const config = JSON.parse(fs.readFileSync("/private/tmp/seti-turing-immediate-expiry-20260908/reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
  const random = createSeededRandom(config.seed), seatId = "player-blue";
  composition = createSimulationRuleComposition({ seed: config.seed, activePlayerCount: 4, random,
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() }, trustedProjectionReader: true,
    projectCounterfactualState: (state, viewer) => buildRuleObservation(state, config.seed,
      viewer?.playerId || null, [], { cheap: viewer?.cheap === true }) }).composition;
  assert.equal(composition.lifecycle.restore(recorded.rootEnvelope, { silent: true }).ok, true);
  const before = composition.lifecycle.save().envelope;
  const observation = composition.projection({ playerId: seatId, role: "player" }).state;
  const actions = evaluator.selectSecondaryAgentRootActions({ focalSeatId: seatId,
    rootObservation: observation, maxProxyDepth: 15,
    legalActions: composition.inputPort.enumerateActions().filter(a => evaluator.requiresRootCounterfactual(a, observation)) });
  console.log("[第50步取证] 第一轮蓝方；开始观察全部物理执行，不重跑整局、不改变4096上限。");
  const raw = composition.counterfactualPort.evaluate(actions, {
    viewer: { playerId: seatId, role: "player" }, maxDepth: 15, maxLeaves: 8,
    maxNodes: 128, maxExecutionNodes: 4096, maxFrontierNodes: 256, maxMilliseconds: 30000,
    maxFrontierPerRoot: 1, allowUntargetedRootActions: true, confidence: "low",
    capturePlanStep: continuation.capturePlanStep,
    getBranchPriority: input => evaluator.evaluateSecondaryAgentSearchPriority({ ...input, focalSeatId: seatId }),
    secondaryAgentSearch: {
      focalSeatId: seatId, maxProxyDepth: 15, rolloutVersion: evaluator.SECONDARY_AGENT_ROLLOUT_VERSION,
      selectRootTargets: evaluator.enumerateSecondaryAgentRootTargets,
      selectSuccessors: evaluator.selectSecondaryAgentSuccessors,
      selectDataSettlement: evaluator.selectSecondaryAgentDataSettlement,
      selectRouteTarget: evaluator.selectSecondaryAgentRouteTarget,
      completesRouteTarget: evaluator.completesSecondaryAgentRouteTarget,
      advanceRoutePlan: evaluator.advanceSecondaryAgentRoutePlan,
    },
  });
  if (callbackError) throw callbackError;
  report.diagnostics = composition.counterfactualPort.getDiagnostics();
  assert.equal(report.executions.length, report.diagnostics.executedNodeCount);
  for (const key of ["executedNodeCount", "successfulInputSubmissionCount", "attemptedNodeCountByFamily",
    "failedNodeCountByCode", "remainingFrontierNodeCount", "transpositionHitCount"]) {
    assert.deepEqual(report.diagnostics[key], recorded.diagnostics[key], key);
  }
  const outcomes = model.projectOutcomeObservations(raw, { seatId, stateVersion: actions[0].stateVersion,
    decisionVersion: actions[0].decisionVersion });
  const winner = outcomes.find(o => o.actionId === recorded.decision.actionId);
  const evaluation = evaluator.evaluateOutcome({ seatId, actionOutcomes: [winner] }, actions.find(a => a.actionId === winner.actionId), {});
  const leaf = winner.leaves.find(l => l.leafId === evaluation.selectedLeafId);
  assert.deepEqual(leaf.planSteps, recorded.leaf.planSteps);
  assert.equal(evaluation.value, recorded.evaluation.value);
  assert.deepEqual(composition.lifecycle.save().envelope, before);
  const byKey = new Map();
  for (const entry of report.executions) {
    if (!byKey.has(entry.key)) byKey.set(entry.key, []);
    byKey.get(entry.key).push(entry.ordinal);
  }
  report.repeatedKeys = [...byKey].filter(([, ordinals]) => ordinals.length > 1)
    .map(([key, ordinals]) => ({ key, ordinals }));
  report.repeatedExecutionCount = report.executions.length - byKey.size;
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  debug.disconnect(); composition?.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error,
    observed: report.executions.length, repeatedExecutionCount: report.repeatedExecutionCount,
    repeatedKeyCount: report.repeatedKeys?.length }, null, 2));
}
