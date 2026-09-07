"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/company-delayed-availability-repro-20260907.json";
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
      const inspection = fork.inspect(), decision = inspection.session?.decision;
      const result = action.phase === "conditional"
        ? fork.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
          ownerId: decision.ownerId, choice: action }, { skipProjection: true })
        : fork.inputPort.submitAction(action, { skipProjection: true });
      assert.equal(result.ok, true, JSON.stringify(result.failure));
      report.steps.push(action);
    }
    submit(a => a.family === "play_card" && a.target?.cardInstanceId === "card-21-pass-1-2");
    submit(a => a.target?.rocketId === 2 && a.target.deltaX === -1 && a.target.deltaY === 0);
    submit(a => a.target?.rocketId === 2 && a.target.deltaX === 0 && a.target.deltaY === 1);
    const asteroid = boundary();
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
    report.formalPaidMovementPoints = 2;
    report.bugReproduced = report.asteroid.route.required.paidMovementPoints > report.formalPaidMovementPoints;
    assert.equal(report.bugReproduced, true, "当前版本应暴露把未来公司额度漏算的反例");
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, bugReproduced: report.bugReproduced,
      predictedPaidPoints: report.asteroid?.route?.required?.paidMovementPoints,
      formalPaidPoints: report.formalPaidMovementPoints, outside: report.outside, error: report.error }, null, 2));
  }
}
