"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const ev = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/data-settlement-p2-contract-20260906-complete.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const report = { scope: "真实棕52填数据决策的需求共识与来源边界；不运行搜索", checks: [] };
  const env = createSimulationEnv(); let fork;
  try {
    const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/node-types-before-step-52-20260906.json"));
    delete checkpoint.replaySteps; env.loadCheckpoint(checkpoint);
    const evidence = JSON.parse(fs.readFileSync("reports/iteration/data-choice-routes-52-20260906-verified.json"));
    const chain = evidence.groups.find(g => g.key === evidence.divergentGroups[0]).selections[0].chain;
    let action;
    for (const actionId of chain) {
      action = env.legalActions().find(a => a.actionId === actionId);
      assert.ok(action, `真实来源链动作缺失：${actionId}`);
      assert.equal(env.step(action).ok, true);
    }
    report.sourceChain = chain;
    // 旧宏chain省略了起手唯一computer选位及下一次place_data。正式补齐这两个
    // 输入后才到原分组的第2格/blue1决策，不能把第1格状态当作冲突反例。
    const firstComputer = env.legalActions().find(a => a.target?.target === "computer");
    assert.equal(firstComputer.summary, "第一排放置位 1");
    assert.equal(env.step(firstComputer).ok, true);
    action = env.legalActions().find(a => a.family === "place_data");
    assert.equal(env.step(action).ok, true);
    report.foldedInputsRestored = [firstComputer.actionId, action.actionId];
    fork = env.createCounterfactualFork();
    const c = fork.composition, legalSuccessors = c.inspect().session.decision.choices;
    const input = { currentAction: action, focalSeatId: "player-brown", maxProxyDepth: 15,
      legalSuccessors, branchObservation: c.projection({ playerId: "player-brown", role: "player", cheap: true }).state };
    const analyze = { routeTargetId: "data:analyze", routePlanId: "data:place_data", routeResultTargetIds: ["data:analyze"] };
    const income = { routeTargetId: "income:gain:3,1,1,0,1,0", routePlanId: "income:data:computer-slot-4", routeResultTargetIds: ["income:gain:3,1,1,0,1,0"] };
    for (const origin of [analyze, income]) {
      const selected = ev.selectSecondaryAgentSuccessors({ ...input, ...origin });
      assert.equal(selected.length, 1);
      const consensus = ev.selectSecondaryAgentDataSettlement({ ...input, origins: [origin, origin] });
      assert.equal(consensus.actionId, selected[0].actionId);
      report.checks.push({ route: origin.routeTargetId, choice: selected[0].target });
    }
    assert.notEqual(report.checks[0].choice.choiceId, report.checks[1].choice.choiceId);
    assert.equal(ev.selectSecondaryAgentDataSettlement({ ...input, origins: [analyze, income] }), null);
    for (const patch of [{ rootWasConditional: true }, { goalCompletionPending: true }, { routeTargetId: null }]) {
      assert.equal(ev.selectSecondaryAgentDataSettlement({ ...input, origins: [{ ...analyze, ...patch }] }), null);
    }
    const before = c.lifecycle.save().envelope;
    const choice = legalSuccessors.find(a => a.target.target === "blueBonus");
    const decision = c.inspect().session.decision;
    assert.equal(c.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId, choice }).ok, true);
    const after = c.lifecycle.save().envelope;
    assert.deepEqual(JSON.parse(after.committedState).meta.rngState, JSON.parse(before.committedState).meta.rngState);
    report.blueChoiceRngMetadataUnchanged = true;
    report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fork?.composition.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report, null, 2)); }
}
