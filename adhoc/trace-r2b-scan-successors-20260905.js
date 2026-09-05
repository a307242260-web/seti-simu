"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const output = "reports/iteration/resource-r2b-scan-successors-formal-discard-20260905.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重跑：${output}`);
} else {
  const previous = JSON.parse(fs.readFileSync("reports/iteration/resource-r2b-opening-scan-20260905.json"));
  const seed = "seti-104-official-v1";
  const { composition } = createSimulationRuleComposition({
    random: createSeededRandom(seed), trustedProjectionReader: true,
    projectCounterfactualState: (state, viewer) => buildRuleObservation(
      state, seed, viewer?.playerId || null, [], { cheap: viewer?.cheap === true },
    ),
  });
  const selections = [];
  try {
    assert.equal(composition.lifecycle.restore(previous.before.coreState.compositionEnvelope).ok, true);
    const scan = composition.inputPort.enumerateActions().find((action) => action.family === "scan");
    assert.ok(scan);
    const seatId = scan.actorId;
    const before = composition.lifecycle.save().envelope;
    const outcomes = composition.counterfactualPort.evaluate([scan], {
      viewer: { playerId: seatId, role: "player" }, maxDepth: 15, maxNodes: 128,
      maxExecutionNodes: 4096, maxFrontierPerRoot: 1, allowUntargetedRootActions: true,
      secondaryAgentSearch: {
        focalSeatId: seatId, maxProxyDepth: 15,
        rolloutVersion: evaluator.SECONDARY_AGENT_ROLLOUT_VERSION,
        selectRootTargets: evaluator.enumerateSecondaryAgentRootTargets,
        selectRouteTarget: evaluator.selectSecondaryAgentRouteTarget,
        completesRouteTarget: evaluator.completesSecondaryAgentRouteTarget,
        getCompletionFacts: evaluator.secondaryAgentCompletionFacts,
        selectSuccessors(input) {
          assert.ok(input.branchObservation.publicState?.players, "追踪必须使用正式规则观察，不能将裸状态当作策略输入");
          const selected = evaluator.selectSecondaryAgentSuccessors(input);
          selections.push({
            chain: input.actionChain, target: input.routeTargetId, plan: input.routePlanId,
            legal: input.legalSuccessors.map((action) => ({ id: action.actionId, family: action.family, target: action.target })),
            selected: selected.map((action) => action.actionId),
            observation: selected.length ? undefined : input.branchObservation,
          });
          return selected;
        },
      },
      getBranchPriority: (input) => evaluator.evaluateSecondaryAgentSearchPriority({ ...input, focalSeatId: seatId }),
    });
    assert.deepEqual(composition.lifecycle.save().envelope, before);
    const report = { scope: "单独扫描根、原有选择函数的只读回调追踪；不代表全候选调度性能",
      outcomes, selections, diagnostics: composition.counterfactualPort.getDiagnostics() };
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ output, outcomes: outcomes.map((item) => ({ status: item.status, leaves: item.leaves.length })),
      selections: selections.length, empty: selections.filter((item) => !item.selected.length).map((item) => ({chain:item.chain,target:item.target,plan:item.plan})) }));
  } finally { composition.dispose(); }
}
