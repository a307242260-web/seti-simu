"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const input = "reports/iteration/company-movement-input-42-20260906.json";
const output = "reports/iteration/company-plan-scopes-v2-20260907.json";
if (fs.existsSync(output)) console.log(`已有证据：${output}`);
else {
  const env = createSimulationEnv();
  const report = { scope: "真实42正式公司两阶段的计划证据接口审查；目标标签为拟接入方案，不冒充当前搜索已输出这些目标或当前计划已发生错误复用", input,
    inputSha256: crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex"), cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync(input)).checkpoint;
    delete cp.replaySteps;
    env.loadCheckpoint(cp);
    fork = env.createCounterfactualFork().composition;
    const company = fork.inputPort.enumerateActions().find(a => a.family === "industry" && a.target.abilityId === "huanyu_free_moves");
    assert.ok(company);
    assert.equal(fork.inputPort.submitAction(company, { skipProjection: true }).ok, true);
    const start = fork.lifecycle.save().envelope;
    const outward = fork.inspect().session.decision.choices.filter(a => a.payload.direction === "out");
    assert.equal(outward.length, 2, "两艘各有正式向外方向");
    for (const first of outward) {
      assert.equal(fork.lifecycle.restore(start).ok, true);
      let inspection = fork.inspect(), decision = inspection.session.decision;
      assert.equal(fork.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: first }, { skipProjection: true }).ok, true);
      inspection = fork.inspect(); decision = inspection.session.decision;
      const second = decision.choices.find(a => a.target.rocketId != null && a.payload.direction === "cw");
      assert.ok(second, "另一艘保留正式顺时针选择");
      assert.notEqual(second.target.rocketId, first.target.rocketId);
      const observation = fork.projection(first.actorId).state;
      const captured = plans.capturePlanStep({ observation, action: second });
      const route = captured.facts.routes.find(r => r.targetId.startsWith("orbit:mars:")
        && String(r.rocketId) === String(first.target.rocketId));
      assert.ok(route, "首艘已到火星，仍有正式环绕需求");
      const primary = plans.compilePlanSteps([{ ...captured, goalDepth: 0,
        routeTargetId: route.targetId, routePlanId: `probe:${route.requirementId}` }])[0];
      const futurePosition = plans.compilePlanSteps([{ ...captured, goalDepth: 0,
        routeTargetId: "position:card-7-0:asteroid", routePlanId: "position:card-7-0:asteroid" }])[0];
      assert.equal(primary.valid, true);
      assert.deepEqual(primary.dependencies.map(d => d.scope.sourceId), [route.sourceId], "现有接口只保留主路线来源");
      assert.equal(futurePosition.valid, false);
      assert.equal(futurePosition.reason, "plan-target-scope-unknown");
      const result = fork.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: second }, { skipProjection: true });
      assert.equal(result.ok, true);
      report.cases.push({ first, second, ownerPayload: inspection.session.currentEffect.payload,
        primaryRoute: route, compiledPrimary: primary, compiledPosition: futurePosition,
        secondSubmissionOk: result.ok, finalPhase: fork.inspect().phase });
    }
    report.verified = true;
  } catch (error) {
    report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, cases: report.cases.length, error: report.error }));
  }
}
