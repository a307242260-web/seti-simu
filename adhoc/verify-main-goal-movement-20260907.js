"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = process.argv[2] || "reports/iteration/main-goal-movement-contract-20260907.json";
if (fs.existsSync(output)) console.log(`已有记录：${output}`);
else {
  const report = { scope: "真实42公司两来源的目标筛选、正式输入、阶段读取及计划依赖；148/497既有卡牌路线阶段读取；不运行AI或全盘", rows: [], passed: false };
  function run(checkpoint, work) {
    const env = createSimulationEnv(); let fork;
    try {
      const cp = structuredClone(checkpoint); delete cp.replaySteps;
      env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
      const seatId = JSON.parse(cp.coreState.committedState).turn.currentPlayerId;
      function boundary() {
        const inspection = fork.inspect();
        return { observation: fork.projection({ playerId: seatId, role: "player" }).state,
          legal: inspection.phase === "awaiting_input" ? inspection.session.decision.choices : fork.inputPort.enumerateActions() };
      }
      function submit(action) {
        assert.ok(action, "正式目标输入必须存在");
        const inspection = fork.inspect(), decision = inspection.session?.decision;
        const result = action.phase === "conditional"
          ? fork.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
            ownerId: decision.ownerId, choice: action }, { skipProjection: true })
          : fork.inputPort.submitAction(action, { skipProjection: true });
        assert.equal(result.ok, true, JSON.stringify(result.failure));
        return result;
      }
      work({ boundary, submit, seatId });
    } finally { fork?.dispose(); env.dispose(); }
  }
  try {
    const input42 = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json"));
    run(input42.checkpoint, ({ boundary, submit, seatId }) => {
      const root = boundary();
      const company = root.legal.find(a => a.target?.abilityId === "huanyu_free_moves");
      const goal = root.observation.probeRouteRequirements.candidates.find(g => g.rocketId === 1 && g.targetId === "land:mars:planet:");
      assert.equal(goal.required.paidMovementPoints, 0);
      const catalog = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: root.observation,
        legalActions: root.legal, focalSeatId: seatId });
      assert.ok(catalog.some(t => t.compatibleActionIds.includes(company.actionId)), "公司须有主要目标绑定");
      submit(company);
      const first = boundary();
      assert.equal(first.observation.probeRouteRequirements.movementContext.phase, "company");
      function select(state) {
        return evaluator.selectSecondaryAgentSuccessors({ branchObservation: state.observation,
          legalSuccessors: state.legal, focalSeatId: seatId, routeTargetId: goal.targetId,
          routePlanId: `probe:${goal.requirementId}` });
      }
      const selectedFirst = select(first);
      const firstMove = selectedFirst.find(a => a.target?.skip !== true);
      assert.ok(firstMove); assert.equal(firstMove.target.rocketId, 1);
      assert.ok(selectedFirst.every(a => a.target.skip || a.target.rocketId === 1), "首艘未用前不能改走第二艘");
      submit(first.legal.find(a => a.actionId === firstMove.actionId));
      const second = boundary(), movement = second.observation.probeRouteRequirements.movementContext;
      assert.equal(movement.phase, "company"); assert.equal(movement.companyRemaining, 1);
      assert.deepEqual(movement.usedRocketIds, [1]);
      const selectedSecond = select(second), secondMove = selectedSecond.find(a => a.movementPreparation);
      assert.ok(secondMove, "剩余第二艘有可推进的主要目标");
      assert.equal(secondMove.routePlanId, `probe:${goal.requirementId}`);
      assert.equal(secondMove.movementPreparation.rocketId, 2);
      assert.ok(selectedSecond.some(a => a.target.skip), "必须保留结束公司移动");
      assert.ok(selectedSecond.every(a => a.target.skip || a.movementPreparation), "每个第二艘方向须有目的");
      const formal = second.legal.find(a => a.actionId === secondMove.actionId);
      assert.equal(Object.hasOwn(formal, "movementPreparation"), false, "目的不能混入正式Action");
      const evidence = { ...plans.capturePlanStep({ action: formal, observation: second.observation }),
        routeTargetId: goal.targetId, routePlanId: `probe:${goal.requirementId}`, goalDepth: 0,
        movementPreparation: secondMove.movementPreparation };
      const steps = plans.compilePlanSteps([evidence]);
      assert.equal(steps[0].valid, true, JSON.stringify(steps[0]));
      const plan = { schemaVersion: "seti-action-plan-v2", nextActionId: formal.actionId, steps };
      assert.equal(plans.planReuseCheck(plan, second.observation, second.legal).hit, true);
      for (const change of ["secondary-position", "company-used", "primary-route", "secondary-route"]) {
        const changed = structuredClone(second.observation);
        if (change === "secondary-position") changed.publicState.board.rockets.find(r => r.id === 2).sectorX += 1;
        if (change === "company-used") changed.probeRouteRequirements.movementContext.usedRocketIds.push(2);
        if (change.endsWith("-route")) {
          const sourceId = change === "primary-route" ? goal.sourceId : secondMove.movementPreparation.sourceId;
          for (const g of changed.probeRouteRequirements.candidates.filter(g => g.sourceId === sourceId)) g.gap.movementSteps += 1;
        }
        assert.equal(plans.planReuseCheck(plan, changed, second.legal).hit, false, change);
      }
      submit(formal);
      const after = boundary();
      assert.equal(after.observation.probeRouteRequirements.movementContext.companyRemaining, 0);
      report.rows.push({ step: 42, rootCompanyTargets: catalog.filter(t => t.compatibleActionIds.includes(company.actionId)),
        firstChoices: selectedFirst, secondChoices: selectedSecond, plan: steps[0], after: after.observation.probeRouteRequirements.movementContext });
    });
    const routes = JSON.parse(fs.readFileSync("reports/iteration/turn-visit-routes-formal-20260907.json"));
    const inputs = JSON.parse(fs.readFileSync("reports/iteration/current-movement-hotspots-20260907.json"));
    for (const route of routes.rows) run(inputs.entries.find(e => e.step === route.step).checkpoint,
      ({ boundary, submit }) => {
        const stages = [];
        for (const expected of route.inputs) {
          const state = boundary();
          const action = state.legal.find(a => a.actionId === expected.actionId);
          assert.deepEqual(action, expected, "已有正式规则路线不变");
          const movement = state.observation.probeRouteRequirements.movementContext;
          if (movement.phase === "card") {
            assert.ok(movement.cardInstanceId);
            const derived = [
              ...state.observation.probeRouteRequirements.candidates,
              ...(state.observation.dataAnalyzeRequirements?.acquisitionPlans || []).filter(p => p.kind === "probe"),
              ...(state.observation.incomeGainRequirements?.plans || []).filter(p => p.kind === "probe"),
            ];
            assert.ok(derived.length > 0);
            assert.ok(derived.every(p => p.movementSource?.cardInstanceId === movement.cardInstanceId),
              "卡牌移动派生的主路线、数据和收入目录均须保留隐藏信息来源");
          }
          if (action.family === "choose_target" && Number.isInteger(action.target?.deltaX)
            && action.target?.kind === "card-play") assert.equal(movement.phase, "card");
          stages.push({ actionId: action.actionId, family: action.family, movement });
          submit(action);
        }
        assert.deepEqual(stages.filter(s => s.movement.phase === "card").map(s => s.movement.cardRemaining),
          [2, 1], "两次正式卡牌移动必须读取2→1剩余额度");
        report.rows.push({ step: route.step, companyAllowance: route.companyAllowance, stages });
      });
    report.passed = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: report.passed, rows: report.rows.length, error: report.error }, null, 2));
}
