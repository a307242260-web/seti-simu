"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/turn-visit-selection-v2-20260907.json";
if (fs.existsSync(output)) console.log(`已有选择器证据：${output}`);
else {
  const fixtures = JSON.parse(fs.readFileSync("reports/iteration/current-movement-hotspots-20260907.json"));
  const routes = JSON.parse(fs.readFileSync("reports/iteration/turn-visit-routes-formal-20260907.json"));
  const report = { scope: "对已验证148/497路线逐一测试当前实际根目标绑定及无绑定对照；后续位置由已验证访问路线推进，不冒充这些目标选择器自行生成整条链；不是完整AI搜索或实际错误复用证据", rows: [] };
  try {
    for (const route of routes.rows.filter(r => r.companyAllowance === 0)) {
      const env = createSimulationEnv(); let fork;
      try {
        const cp = structuredClone(fixtures.entries.find(e => e.step === route.step).checkpoint);
        delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
        const actorId = route.inputs[0].actorId;
        const rootObservation = fork.projection(actorId).state;
        const roots = evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: actorId,
          rootObservation, legalActions: fork.inputPort.enumerateActions() });
        const row = { step: route.step, roots, choices: [] };
        let previous = null;
        for (const expected of route.inputs) {
          const inspection = fork.inspect(), decision = inspection.session?.decision;
          const legal = inspection.phase === "awaiting_input" ? decision.choices : fork.inputPort.enumerateActions();
          const action = legal.find(a => a.actionId === expected.actionId);
          assert.ok(action); assert.deepEqual(action, expected);
          if (inspection.phase === "awaiting_input" && inspection.session.currentEffect.type.includes("card_move")) {
            const observation = fork.projection(actorId).state;
            const bindings = roots.filter(r => r.compatibleActionIds.includes(route.inputs[0].actionId));
            assert.ok(bindings.length, "实际打牌入口有现行目标绑定");
            const comparisons = [...bindings, { targetId: null, planId: null }].map(binding => {
              const selected = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: actorId,
                currentAction: previous, branchObservation: observation, legalSuccessors: legal,
                focalProxyDepth: 0, actionChain: [], routeTargetId: binding.targetId,
                routePlanId: binding.planId, maxProxyDepth: 24 });
              return { binding, selected, containsVisitRouteStep: selected.some(a => a.actionId === action.actionId),
                compiled: selected.map(a => plans.compilePlanSteps([{ ...plans.capturePlanStep({ observation, action: legal.find(l => l.actionId === a.actionId) }),
                  goalDepth: 0, routeTargetId: a.routeTargetId, routePlanId: a.routePlanId }])[0]) };
            });
            row.choices.push({ chosen: action, legal, comparisons,
              ownerEffect: inspection.session.currentEffect,
              bonusProgress: JSON.parse(fork.lifecycle.save().envelope.committedState).turn.cardTurnEventBonuses });
          }
          const result = action.phase === "conditional"
            ? fork.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
              ownerId: decision.ownerId, choice: action }, { skipProjection: true })
            : fork.inputPort.submitAction(action, { skipProjection: true });
          assert.equal(result.ok, true, JSON.stringify(result.failure)); previous = action;
        }
        assert.equal(row.choices.length, 2);
        report.rows.push(row);
      } finally { fork?.dispose(); env.dispose(); }
    }
    report.verified = true;
  } catch (error) {
    report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, error: report.error,
    rows: report.rows.map(r => ({ step: r.step, roots: r.roots.length, choices: r.choices.map(c => ({
      legal: c.legal.length, chosen: c.chosen.summary, comparisons: c.comparisons.map(x => ({
        target: x.binding.targetId, selected: x.selected.length, containsVisitRouteStep: x.containsVisitRouteStep,
        dependencyCounts: x.compiled.map(p => p.dependencies.length) })) })) })) }, null, 2));
}
