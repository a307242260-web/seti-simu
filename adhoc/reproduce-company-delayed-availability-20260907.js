"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = process.argv[2] || "reports/iteration/company-delayed-availability-repro-20260907.json";
const verifyFixed = process.argv[3] === "fixed";
if (fs.existsSync(output)) console.log(`已有复现：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实148检查点，经正式b24移动进入小行星，再付费移出并启用公司到达金星；验证未来额度而非追求绕路奖励，不运行AI", steps: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/current-movement-hotspots-20260907.json"))
      .entries.find(e => e.step === 148).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const seatId = "player-green";
    function boundary() {
      const inspection = fork.inspect();
      return { observation: fork.projection({ playerId: seatId, role: "player" }).state,
        legal: inspection.phase === "awaiting_input" ? inspection.session.decision.choices : fork.inputPort.enumerateActions() };
    }
    function submit(predicate) {
      const state = boundary(), action = state.legal.find(predicate);
      assert.ok(action, JSON.stringify(state.legal));
      const before = fork.lifecycle.save().envelope;
      function execute() {
        const inspection = fork.inspect(), decision = inspection.session?.decision;
        const result = action.phase === "conditional"
          ? fork.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
            ownerId: decision.ownerId, choice: action }, { skipProjection: true })
          : fork.inputPort.submitAction(action, { skipProjection: true });
        assert.equal(result.ok, true, JSON.stringify(result.failure));
      }
      execute();
      if (verifyFixed) {
        const after = fork.lifecycle.save().envelope;
        assert.equal(fork.lifecycle.restore(before).ok, true);
        assert.deepEqual(boundary().legal.find(a => a.actionId === action.actionId), action);
        execute();
        assert.deepEqual(fork.lifecycle.save().envelope, after, "每步恢复重交保持状态、RNG和序列");
      }
      report.steps.push(action);
    }
    submit(a => a.family === "play_card" && a.target?.cardInstanceId === "card-21-pass-1-2");
    submit(a => a.target?.rocketId === 2 && a.target.deltaX === -1 && a.target.deltaY === 0);
    submit(a => a.target?.rocketId === 2 && a.target.deltaX === 0 && a.target.deltaY === 1);
    const asteroid = boundary();
    const asteroidEnvelope = fork.lifecycle.save().envelope;
    report.asteroid = { movement: asteroid.observation.probeRouteRequirements.movementContext,
      route: asteroid.observation.probeRouteRequirements.candidates.find(g => g.rocketId === 2 && g.targetId === "orbit:venus:planet:"),
      companyLegal: asteroid.legal.some(a => a.target?.abilityId === "huanyu_free_moves") };
    assert.equal(report.asteroid.companyLegal, false);
    submit(a => a.family === "move" && a.target?.rocketId === 2 && a.target.deltaX === 0 && a.target.deltaY === -1);
    const payment = boundary();
    if (payment.legal[0]?.family === "choose_payment") {
      report.paymentChoices = payment.legal;
      submit(a => a.family === "choose_payment" && (a.target?.paymentKind === "energy" || a.target?.choiceId === "energy"));
    }
    const outside = boundary();
    report.outside = { movement: outside.observation.probeRouteRequirements.movementContext,
      companyLegal: outside.legal.some(a => a.target?.abilityId === "huanyu_free_moves") };
    assert.equal(report.outside.companyLegal, true, "付费移出后公司仍然可用");
    submit(a => a.target?.abilityId === "huanyu_free_moves");
    submit(a => a.target?.rocketId === 2 && a.target.deltaX === -1 && a.target.deltaY === 0);
    const end = boundary();
    report.endRoute = end.observation.probeRouteRequirements.candidates.find(g => g.rocketId === 2 && g.targetId === "orbit:venus:planet:");
    assert.equal(report.endRoute.required.movementSteps, 0);
    report.formalPaidMovementPoints = report.steps.filter(a => a.target?.kind === "move-payment"
      && a.target.choiceId === "energy").reduce((sum, a) => sum + a.payload.energyCost, 0);
    assert.equal(report.formalPaidMovementPoints, 2);
    report.bugReproduced = report.asteroid.route.required.paidMovementPoints > report.formalPaidMovementPoints;
    if (verifyFixed) {
      assert.equal(report.asteroid.route.required.paidMovementPoints, report.formalPaidMovementPoints,
        "路线必须计入付费移出后可用的公司额度");
      assert.equal(report.asteroid.movement.companyRemaining, 2);
      assert.ok(report.asteroid.route.movementNextSteps.every(s => s.family === "move"),
        "当前公司不可启用，正式首步必须先付费移出");
      assert.deepEqual(report.steps, JSON.parse(fs.readFileSync(
        "reports/iteration/company-delayed-availability-repro-20260907.json")).steps,
      "修复派生读取不改变正式动作链");
      assert.equal(asteroidEnvelope.session, null);
      report.cacheCases = [];
      for (const variant of ["available", "marked", "available-again", "passed", "available-last"]) {
        // 独立缓存unit情形，不把直接修改标记/PASS的fixture冒充正式行动链。
        const envelope = structuredClone(asteroidEnvelope), root = JSON.parse(envelope.committedState);
        if (variant === "marked") root.players.players.find(p => p.id === seatId).industryRoundMarkRound = root.turn.roundNumber;
        if (variant === "passed") root.turn.passedPlayerIds.push(seatId);
        envelope.committedState = JSON.stringify(root);
        assert.equal(fork.lifecycle.restore(envelope).ok, true);
        const observed = boundary().observation.probeRouteRequirements;
        const route = observed.candidates.find(g => g.requirementId === report.asteroid.route.requirementId);
        const available = variant.startsWith("available");
        assert.equal(observed.movementContext.companyRemaining, available ? 2 : 0);
        assert.equal(route.required.paidMovementPoints, available ? 2 : 3);
        if (available) assert.deepEqual(route, report.asteroid.route, "标记和PASS情形不能污染可用额度缓存");
        report.cacheCases.push({ variant, movement: observed.movementContext, paidPoints: route.required.paidMovementPoints });
      }
      report.fixedVerified = true;
    } else assert.equal(report.bugReproduced, true, "当前版本应暴露把未来公司额度漏算的反例");
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, bugReproduced: report.bugReproduced,
      predictedPaidPoints: report.asteroid?.route?.required?.paidMovementPoints,
      formalPaidPoints: report.formalPaidMovementPoints, outside: report.outside, error: report.error }, null, 2));
  }
}
