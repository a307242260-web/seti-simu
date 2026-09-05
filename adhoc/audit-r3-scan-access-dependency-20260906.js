"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/r3-scan-access-dependency-20260906-v2.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/mercury-scan-directory-audit-20260906.json")).checkpoint;
  const state = JSON.parse(checkpoint.coreState.committedState);
  const player = state.players.players.find((p) => p.id === "player-brown");
  delete player.techState.ownedTiles.purple2;
  state.tech.stacks.purple2.remaining += 1;
  state.meta.gameId += ":scan-plan-access";
  const report = { createdAt: new Date().toISOString(), scope: "隔离正式规则输入：采集实际scan和目标选择，再只旋转太阳系检查复用；非历史优胜计划，不运行搜索",
    sourceSha256: crypto.createHash("sha256").update(fs.readFileSync("randomizer/game/ai/plan-continuation.js")).digest("hex"), state };
  function createEnv(inputState) {
    const input = structuredClone(checkpoint);
    delete input.replaySteps;
    input.coreState.committedState = JSON.stringify(inputState);
    input.coreState.compositionEnvelope.committedState = input.coreState.committedState;
    const env = createSimulationEnv();
    try { env.loadCheckpoint(input); return env; }
    catch (error) { env.dispose(); throw error; }
  }
  const original = createEnv(state);
  let changed;
  try {
    const before = original.observe();
    const scan = original.legalActions().find((a) => a.family === "scan");
    assert.ok(scan);
    const metadata = { goalDepth: 0, routeTargetId: before.sectorWinRequirements.candidates.find((c) => c.sectorId === "sector-1-a").targetId,
      routePlanId: "sector:standard-scan:sector-1-a" };
    const first = { ...plans.capturePlanStep({ observation: before, action: scan }), ...metadata };
    assert.equal(original.step(scan).ok, true);
    const target = original.legalActions().find((a) => a.target?.nebulaId === "sector-1-a");
    assert.ok(target);
    report.choiceObservation = original.observe();
    const second = { ...plans.capturePlanStep({ observation: original.observe(), action: target }), ...metadata };
    assert.equal(original.step(target).ok, true);
    const steps = plans.compilePlanSteps([first, second]);
    const plan = { schemaVersion: plans.PLAN_SCHEMA_VERSION, nextActionId: scan.actionId, steps };
    const rotated = structuredClone(state);
    rotated.solarSystem.rotation.wheel1Steps = 2;
    changed = createEnv(rotated);
    const observation = changed.observe();
    const reuse = plans.planReuseCheck(plan, observation, changed.legalActions(), { sameTurn: true });
    report.plan = plan;
    report.beforeSources = before.sectorWinRequirements.accessSources;
    report.afterSources = observation.sectorWinRequirements.accessSources;
    report.reuse = reuse;
    assert.equal(reuse.hit, true, "复现：旧依赖未识别扫描范围变化");
    assert.equal(changed.step(reuse.action).ok, true);
    report.actualChoices = changed.legalActions();
    assert.equal(report.actualChoices.some((a) => a.target?.nebulaId === "sector-1-a"), false);
    assert.ok(report.actualChoices.some((a) => a.target?.nebulaId === "sector-2-a"));
    report.beforeResources = before.publicState.players.find((p) => p.playerId === "player-brown");
    report.afterResources = changed.observe().publicState.players.find((p) => p.playerId === "player-brown");
    report.reproduced = true;
  } catch (error) {
    report.reproduced = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    original.dispose();
    changed?.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, reproduced: report.reproduced, beforeSources: report.beforeSources,
      afterSources: report.afterSources, reuseHit: report.reuse?.hit, choices: report.actualChoices, error: report.error }));
  }
}
