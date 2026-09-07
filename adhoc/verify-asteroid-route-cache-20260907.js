"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const solar = require("../randomizer/solar-system/core"), rockets = require("../randomizer/game/rockets");
const ability = require("../randomizer/game/abilities/rocket"), effects = require("../randomizer/game/cards/effects");
const output = "reports/iteration/asteroid-route-cache-20260907.json";
if (fs.existsSync(output)) console.log(`已有缓存证据：${output}`);
else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json"));
  const cp = structuredClone(source.checkpoint); delete cp.replaySteps;
  const base = JSON.parse(cp.coreState.committedState), actorId = base.turn.currentPlayerId;
  const rocket = base.pieces.rockets.find(r => r.playerId === actorId && r.surface === "solar-board");
  const at = Array.from({ length: 32 }, (_, i) => ({ x: i % 8, y: Math.floor(i / 8) + 1 }))
    .find(p => solar.resolveVisibleContent(p.x, p.y, base.solarSystem).content.kind === "asteroid");
  rocket.sectorX = at.x; rocket.sectorY = at.y;
  const model = effects.getCardModel("b_124.webp").playEffects[0];
  const report = { scope: "以真实42为基础的费用缓存unit场景：同一玩家/盘面、探测器置小行星，依次无修正/本人物效/他人物效/清除；不运行AI或声称这些状态构成正式行动链", rows: [], verified: false };
  const env = createSimulationEnv();
  try {
    for (const mode of ["absent", "own", "other", "cleared"]) {
      const root = structuredClone(base);
      root.turn.cardTurnEventBonuses = ["own", "other"].includes(mode)
        ? [{ ...structuredClone(model.options.bonus), id: model.id,
          ownerId: mode === "own" ? actorId : "other-player" }] : [];
      const current = structuredClone(cp);
      current.coreState.committedState = JSON.stringify(root);
      current.coreState.compositionEnvelope.committedState = JSON.stringify(root);
      env.loadCheckpoint(current);
      const observation = env.observe(actorId);
      const goals = observation.probeRouteRequirements.candidates.filter(g => g.rocketId === rocket.id);
      assert.ok(goals.length);
      const actor = root.players.players.find(p => p.id === actorId);
      for (const goal of goals) {
        let coordinate = rockets.getRocketSectorCoordinate(rocket), cost = 0;
        for (const step of goal.path) {
          cost += ability.getRequiredMovePointsFromCoordinate({ ...root, state: root }, actor, coordinate);
          coordinate = { x: solar.mod8(coordinate.x + step.deltaX), y: coordinate.y + step.deltaY };
        }
        assert.equal(goal.required.movementPoints, cost, `${mode}: 缓存路径费用应等于共享正式逐段费用`);
      }
      report.rows.push({ mode, goals: goals.map(g => ({ id: g.requirementId, points: g.required.movementPoints, path: g.path })) });
    }
    assert.notDeepEqual(report.rows[1].goals, report.rows[0].goals);
    assert.deepEqual(report.rows[2].goals, report.rows[0].goals);
    assert.deepEqual(report.rows[3].goals, report.rows[0].goals);
    report.verified = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, cases: report.rows.map(r => ({ mode: r.mode, goals: r.goals.length })), error: report.error }, null, 2));
  }
}
