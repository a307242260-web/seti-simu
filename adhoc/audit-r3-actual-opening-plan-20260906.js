"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/r3-actual-opening-plan-20260906.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重跑：${output}`);
} else {
  const savePath = "seti-saves/seti-save-research-plan-steps-r3-20260906-d7a78140-full-v299.json";
  const raw = fs.readFileSync(savePath);
  const save = JSON.parse(raw);
  const record = JSON.parse(fs.readFileSync("reports/research/e529366a.d7a78140.full.json"));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(),
    scope: "实际全盘前23步正式重放＋第24步单次生产决策＋同回合逐步复用核对；不跑全盘",
    savePath, sha256: crypto.createHash("sha256").update(raw).digest("hex") };
  try {
    env.reset({ seed: record.seed, activePlayerCount: record.activePlayerCount,
      aiDifficulty: record.aiDifficulty, policyVersion: record.policyVersion, ...record.flags });
    for (let index = 0; index < 23; index += 1) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find((item) => item.actionId === expected.action.actionId);
      assert.ok(action, `重放第${index + 1}步缺合法动作`);
      assert.equal(JSON.stringify(action), JSON.stringify(expected.action), "描述符的JSON语义必须一致");
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.beforeRoot = env.createCheckpoint();
    const observation = env.observe();
    const legal = env.legalActions();
    const started = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(decision.ok, true);
    assert.equal(decision.policyDecision.actionId, save.replaySteps[23].action.actionId);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, save.replaySteps[23].after);
    const action = legal.find((item) => item.actionId === decision.policyDecision.actionId);
    const snapshot = plans.extractPlanSnapshot({ seatId: action.actorId, chosenAction: action,
      legalActions: legal, actionOutcomes: decision.actionOutcomes,
      rootObservation: decision.actionOutcomes.find((outcome) => outcome.actionId === action.actionId)?.rootObservation
        || observation }, { light: true });
    report.rootAction = action;
    report.macroContinuation = snapshot.plan?.continuation;
    report.actualPlan = decision.plan;
    report.boundaries = [];
    let plan = decision.plan;
    for (let index = 24; index <= 26; index += 1) {
      const actions = env.legalActions();
      const currentObservation = env.observe();
      const reuse = plans.planReuseCheck(plan, currentObservation, actions, { sameTurn: true });
      report.boundaries.push({ index, legalActions: actions, reuse: { hit: reuse.hit, reason: reuse.reason || null },
        nextActionId: plan?.nextActionId });
      assert.equal(reuse.hit, true, `真实第${index + 1}步必须证明按计划执行`);
      assert.equal(reuse.action.actionId, save.replaySteps[index].action.actionId);
      if (index === 26) report.beforeDivergence = env.createCheckpoint();
      assert.equal(env.step(reuse.action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, save.replaySteps[index].after);
      plan = reuse.nextPlan;
    }
    assert.ok(report.wallMs <= 10000);
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    env.dispose();
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      rootAction: report.rootAction?.actionId, macro: report.macroContinuation,
      actual: report.actualPlan?.steps.map((step) => step.actionId),
      boundaries: report.boundaries?.map((boundary) => ({ index: boundary.index,
        count: boundary.legalActions.length, reuse: boundary.reuse })), error: report.error }, null, 2));
  }
}
