"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/r3-scan-earth-verification-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/mercury-scan-directory-audit-20260906.json")).checkpoint;
  const report = { createdAt: new Date().toISOString(), scope: "隔离正式规则反例及扫描收费/顺序验证；不运行AI全盘", rows: [],
    sources: Object.fromEntries(["effects/science-session.js", "production-kernel.js", "ai/plan-continuation.js"].map((file) => [file,
      crypto.createHash("sha256").update(fs.readFileSync(`randomizer/game/${file}`)).digest("hex")])) };
  function createEnv(state) {
    const input = structuredClone(checkpoint);
    delete input.replaySteps;
    input.coreState.committedState = JSON.stringify(state);
    input.coreState.compositionEnvelope.committedState = input.coreState.committedState;
    const env = createSimulationEnv();
    try { env.loadCheckpoint(input); return env; }
    catch (error) { env.dispose(); throw error; }
  }
  try {
    for (const purple2 of [false, true]) {
      const state = JSON.parse(checkpoint.coreState.committedState);
      if (!purple2) {
        delete state.players.players.find((p) => p.id === "player-brown").techState.ownedTiles.purple2;
        state.tech.stacks.purple2.remaining += 1;
      }
      state.meta.gameId += `:earth-verification:${purple2}`;
      const original = createEnv(state);
      let rotated;
      let unrelated;
      try {
        const before = original.observe();
        const scan = original.legalActions().find((a) => a.family === "scan");
        assert.ok(scan);
        const metadata = { goalDepth: 0, routeTargetId: before.sectorWinRequirements.candidates.find((c) => c.sectorId === "sector-1-a").targetId,
          routePlanId: "sector:standard-scan:sector-1-a" };
        const first = { ...plans.capturePlanStep({ observation: before, action: scan }), ...metadata };
        assert.equal(original.step(scan).ok, true);
        const choose = original.legalActions().find((a) => a.target?.nebulaId === "sector-1-a");
        assert.ok(choose);
        const afterScan = original.observe();
        const actor = (obs) => obs.publicState.players.find((p) => p.playerId === "player-brown");
        assert.equal(actor(before).credits - actor(afterScan).credits, before.sectorWinRequirements.standardScanCost.credits);
        assert.equal(actor(before).energy - actor(afterScan).energy, before.sectorWinRequirements.standardScanCost.energy);
        const second = { ...plans.capturePlanStep({ observation: afterScan, action: choose }), ...metadata };
        const steps = plans.compilePlanSteps([first, second]);
        const plan = { schemaVersion: plans.PLAN_SCHEMA_VERSION, nextActionId: scan.actionId, steps };
        const changed = structuredClone(state);
        changed.solarSystem.rotation.wheel1Steps = purple2 ? 4 : 2;
        rotated = createEnv(changed);
        const rotatedBefore = rotated.observe();
        const reuse = plans.planReuseCheck(plan, rotatedBefore, rotated.legalActions(), { sameTurn: true });
        assert.equal(reuse.hit, false);
        assert.equal(reuse.reason, "next-step-affected");
        assert.deepEqual(rotated.observe(), rotatedBefore, "拒绝复用无扣费或状态副作用");
        if (purple2) assert.deepEqual(before.sectorWinRequirements.accessSources, rotatedBefore.sectorWinRequirements.accessSources);
        assert.notDeepEqual(before.sectorWinRequirements.standardScanEarthSource, rotatedBefore.sectorWinRequirements.standardScanEarthSource);
        assert.equal(rotated.step(rotated.legalActions().find((a) => a.family === "scan")).ok, true);
        const rotatedEarth = rotated.legalActions().find((a) => a.target?.nebulaId);
        assert.equal(rotatedEarth.target.nebulaId, purple2 ? "sector-4-a" : "sector-2-a");
        assert.equal(original.step(choose).ok, true);
        if (purple2) {
          const mercury = original.legalActions().find((a) => a.target?.nebulaId === "sector-4-a");
          assert.ok(mercury);
          const beforeMercury = actor(original.observe());
          assert.equal(original.step(mercury).ok, true);
          assert.equal(beforeMercury.publicity - actor(original.observe()).publicity, 1);
        }
        const unrelatedState = structuredClone(state);
        unrelatedState.solarSystem.rotation.wheel2Steps += 1;
        unrelated = createEnv(unrelatedState);
        assert.deepEqual(unrelated.observe().sectorWinRequirements.standardScanEarthSource, before.sectorWinRequirements.standardScanEarthSource);
        assert.equal(plans.planReuseCheck(plan, unrelated.observe(), unrelated.legalActions(), { sameTurn: true }).hit, true);
        report.rows.push({ purple2, beforeSource: before.sectorWinRequirements.standardScanEarthSource,
          rotatedSource: rotatedBefore.sectorWinRequirements.standardScanEarthSource,
          reuse, formalRotatedEarth: rotatedEarth.target, plan });
      } finally { original.dispose(); rotated?.dispose(); unrelated?.dispose(); }
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, rows: report.rows.length, error: report.error }));
  }
}
