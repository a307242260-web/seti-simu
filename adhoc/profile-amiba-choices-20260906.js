"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");
const { createSeededRandom, RNG_ALGORITHM } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { createHeuristicDecisionFunction } = require("../randomizer/game/ai/heuristic-decision-function");
const { createMachinePlayerCoordinator } = require("../randomizer/game/ai/machine-player-coordinator");
const output = "reports/iteration/amiba-choice-profile-210-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  let composition;
  const report = { scope: "真实绿210，正式selector只读回调取证；按来源调用计数，不冒充物理节点计数", byChoiceCount: {}, byTarget: {}, examples: {} };
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/round-income-green-before-search-20260906.json"));
    const seed = cp.config.seed, random = createSeededRandom(seed);
    random.setState(JSON.parse(cp.coreState.committedState).meta.rngState.state);
    composition = createSimulationRuleComposition({ seed, activePlayerCount: cp.config.activePlayerCount, random,
      rngState: { algorithm: RNG_ALGORITHM, state: random.getState() }, trustedProjectionReader: true,
      projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId || null, [], { cheap: viewer?.cheap === true }),
    }).composition;
    assert.equal(composition.lifecycle.restore(cp.coreState.compositionEnvelope).ok, true);
    const port = composition.counterfactualPort;
    const recorder = { getDiagnostics: () => port.getDiagnostics(), evaluate(actions, options) {
      if (!options.secondaryAgentSearch) return port.evaluate(actions, options);
      const select = options.secondaryAgentSearch.selectSuccessors;
      return port.evaluate(actions, { ...options, secondaryAgentSearch: { ...options.secondaryAgentSearch,
        selectSuccessors(input) {
          const selected = select(input), legal = input.legalSuccessors;
          if (legal.length && legal.every(a => a.family === "choose_target" && a.target?.symbolId && a.target?.slotId)) {
            report.byChoiceCount[legal.length] = (report.byChoiceCount[legal.length] || 0) + 1;
            const target = input.routeTargetId || "<unbound>";
            report.byTarget[target] = (report.byTarget[target] || 0) + 1;
            report.examples[legal.length] ||= { currentAction: input.currentAction, routeTargetId: input.routeTargetId,
              actionChain: input.actionChain, legal, branchObservation: input.branchObservation };
          }
          return selected;
        },
      } });
    } };
    const boundary = createMachinePlayerCoordinator({ composition, execute() { throw new Error("诊断禁止根提交"); } }).readBoundary();
    const result = createHeuristicDecisionFunction({ composition: { counterfactualPort: recorder }, difficulty: cp.config.aiDifficulty }).run(boundary);
    report.actionId = result.actionId;
    report.diagnostics = result.searches;
    assert.equal(result.actionId, "move:2bb2c433");
    report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { composition?.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, byChoiceCount: report.byChoiceCount, byTarget: report.byTarget, error: report.error }, null, 2)); }
}
