"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");
const { createSeededRandom, RNG_ALGORITHM } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const { createHeuristicDecisionFunction } = require("../randomizer/game/ai/heuristic-decision-function");
const { createMachinePlayerCoordinator } = require("../randomizer/game/ai/machine-player-coordinator");
const output = "reports/iteration/data-choice-routes-52-20260906-verified.json";
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const report = { scope: "棕52单决策诊断；仅通过正式selectSuccessors参数包装记录输入输出，返回原结果，不改生产或预算；观察分组不是物理状态等价证明", routes: {}, groups: [] };
  let composition;
  try {
    const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/node-types-before-step-52-20260906.json"));
    const seed = checkpoint.config.seed;
    const random = createSeededRandom(seed);
    random.setState(JSON.parse(checkpoint.coreState.committedState).meta.rngState.state);
    composition = createSimulationRuleComposition({ seed, activePlayerCount: checkpoint.config.activePlayerCount,
      random, rngState: { algorithm: RNG_ALGORITHM, state: random.getState() }, trustedProjectionReader: true,
      projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId || null, [], { cheap: viewer?.cheap === true }),
    }).composition;
    assert.equal(composition.lifecycle.restore(checkpoint.coreState.compositionEnvelope).ok, true);
    const groups = new Map();
    const port = composition.counterfactualPort;
    const diagnosticPort = {
      getDiagnostics: () => port.getDiagnostics(),
      evaluate(actions, options) {
        if (!options.secondaryAgentSearch) return port.evaluate(actions, options);
        const original = options.secondaryAgentSearch.selectSuccessors;
        return port.evaluate(actions, { ...options, secondaryAgentSearch: { ...options.secondaryAgentSearch,
          selectSuccessors(input) {
            const selected = original(input);
            const dataChoices = input.legalSuccessors.filter(a => String(a.target?.choiceId || "").startsWith("data:"));
            if (dataChoices.length) {
              const route = `${input.routeTargetId}|${input.routePlanId}`;
              const row = report.routes[route] ||= { calls: 0, singleton: 0, multiple: 0, empty: 0, choices: {} };
              row.calls += 1;
              row[selected.length === 1 ? "singleton" : selected.length > 1 ? "multiple" : "empty"] += 1;
              for (const action of selected) row.choices[action.summary] = (row.choices[action.summary] || 0) + 1;
              const key = hash([input.branchObservation, input.currentAction, input.legalSuccessors]);
              const group = groups.get(key) || { key, choices: dataChoices.map(a => ({ actionId: a.actionId, target: a.target, summary: a.summary })), selections: [] };
              group.selections.push({ route, ids: selected.map(a => a.actionId), chain: input.actionChain });
              groups.set(key, group);
            }
            return selected;
          },
        } });
      },
    };
    const boundary = createMachinePlayerCoordinator({ composition, execute() { throw new Error("诊断禁止根提交"); } }).readBoundary();
    const start = performance.now();
    const result = createHeuristicDecisionFunction({ composition: { counterfactualPort: diagnosticPort }, difficulty: checkpoint.config.aiDifficulty }).run(boundary);
    report.wallMs = performance.now() - start;
    report.groups = [...groups.values()];
    report.divergentGroups = report.groups.filter(g => new Set(g.selections.map(s => JSON.stringify(s.ids))).size > 1).map(g => g.key);
    const baseline = JSON.parse(fs.readFileSync("reports/iteration/node-types-baseline-step-52-20260906.json"));
    assert.deepEqual(result.decision, baseline.policyDecision);
    assert.deepEqual(result.plan, baseline.plan);
    const leaves = result.actionOutcomes.map(({ leaves, ...outcome }) => ({ actionId: outcome.actionId,
      metadataHash: hash(outcome), leaves: leaves.map(leaf => ({ leafId: leaf.leafId, hash: hash(leaf) })) }));
    assert.deepEqual(leaves.map(({ actionId, leaves }) => ({ actionId, leaves })), baseline.outcomes.map(({ actionId, leaves }) => ({ actionId, leaves })));
    report.oldMetadataHashDifferences = leaves.filter((o, index) => o.metadataHash !== baseline.outcomes[index].metadataHash).map(o => o.actionId);
    // 完整元数据含恢复入口字段；用相同checkpoint的真实env直接核对对象，不靠忽略hash差异过门禁。
    const reference = createSimulationEnv();
    try {
      const restored = structuredClone(checkpoint); delete restored.replaySteps;
      reference.loadCheckpoint(restored);
      const native = reference.runHeuristicPolicyDecision();
      assert.equal(native.ok, true);
      assert.deepEqual(result.actionOutcomes, native.actionOutcomes);
      assert.deepEqual(result.plan, native.plan);
      assert.deepEqual(result.decision, native.policyDecision);
      report.matchesNativeRestoredDecision = true;
    } finally { reference.dispose(); }
    report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    composition?.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, routes: report.routes,
      groups: report.groups.length, divergentGroups: report.divergentGroups?.length, error: report.error }, null, 2));
  }
}
