"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/r3-brown-plan-realization-20260906.json";
const hash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
if (fs.existsSync(output)) {
  console.log(`已有记录，未重跑：${output}`);
} else {
  const sourcePath = "reports/iteration/r3-brown-route-selection-20260906.json";
  const raw = fs.readFileSync(sourcePath);
  const source = JSON.parse(raw).samples[0];
  const savePath = "seti-saves/seti-save-research-plan-steps-r3-20260906-d7a78140-full-v299.json";
  const saveRaw = fs.readFileSync(savePath);
  const save = JSON.parse(saveRaw);
  const report = { createdAt: new Date().toISOString(), sourcePath, sourceSha256: hash(raw),
    savePath, saveSha256: hash(saveRaw),
    scope: "重放既有棕方起手计划至首次失效/行为分歧，不调用搜索；核对实际边界与原计划，不推断历史缓存内部状态",
    roots: source.outcomes.filter((row) => row.selectedLeaf).map((row) => ({
      actionId: row.action.actionId, family: row.action.family,
      rootRound: row.evaluation.rootValue.infrastructure.roundNumber,
      leafRound: row.evaluation.leafValue.infrastructure.roundNumber,
      remainingRounds: row.evaluation.remainingRounds,
      incomeDelta: row.evaluation.incomeDelta, incomeValue: row.evaluation.incomeValue,
      techValue: row.evaluation.techValue, score: row.evaluation.score,
    })), boundaries: [] };
  const env = createSimulationEnv();
  try {
    env.loadCheckpoint(JSON.parse(fs.readFileSync(source.checkpointPath)));
    let plan = source.plan;
    let previousTurn = null;
    for (let index = source.index; index < save.replaySteps.length; index += 1) {
      const expected = save.replaySteps[index];
      const observation = env.observe();
      const legal = env.legalActions();
      const action = legal.find((item) => item.actionId === expected.action.actionId);
      assert.ok(action, `第${index + 1}步缺合法动作`);
      assert.equal(JSON.stringify(action), JSON.stringify(expected.action));
      if (action.actorId === source.recordedAction.actorId) {
        const turn = `${observation.publicState.roundNumber}:${observation.publicState.turnNumber}`;
        if (index !== source.index) {
          const reuse = plans.planReuseCheck(plan, observation, legal, { sameTurn: previousTurn === turn });
          const boundary = { index, turn, sameTurn: previousTurn === turn,
            planned: plan?.nextActionId, actual: action.actionId,
            reuse: { hit: reuse.hit, reason: reuse.reason, affected: reuse.affected },
            matches: plan?.nextActionId === action.actionId };
          report.boundaries.push(boundary);
          if (!reuse.hit || !boundary.matches) {
            report.firstBoundary = boundary;
            report.stoppedBefore = index;
            report.observationAtStop = observation;
            report.planAtStop = plan;
            break;
          }
          plan = reuse.nextPlan;
        }
        previousTurn = turn;
      }
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
      report.replayVerifiedThrough = index;
      if (!plan?.nextActionId) break;
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, roots: report.roots,
      boundaries: report.boundaries, verifiedThrough: report.replayVerifiedThrough,
      error: report.error }, null, 2));
  }
}
