"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const solar = require("../randomizer/solar-system/core"), rockets = require("../randomizer/game/rockets");
const ability = require("../randomizer/game/abilities/rocket"), cards = require("../randomizer/game/cards/effects");
const output = "reports/iteration/asteroid-routes-42-20260907.json";
if (fs.existsSync(output)) console.log(`已有路线证据：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42手牌小行星任务与各公司首步的最短移动点；只读正式几何/成本，不执行搜索或证明全部收益等价", routes: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const root = fork.projection({ role: "simulation" }).state;
    const actor = root.players.players.find(p => p.id === "player-green");
    const context = { ...root, state: root };
    report.handModels = actor.hand.map(card => ({ card, model: cards.getCardModel(card) }));
    assert.equal(report.handModels.find(m => m.card.cardId === "dlc_11.png").model.tasks[0].condition.locationType, "asteroid");
    const prior = JSON.parse(fs.readFileSync("reports/iteration/company-arrivals-42-v2-20260907.json"));
    for (const sample of prior.cases) {
      const choice = sample.choice, id = choice.target.rocketId;
      const rocket = root.pieces.rockets.find(r => r.id === id);
      const from = rockets.getRocketSectorCoordinate(rocket);
      const first = rockets.canMoveFromCoordinate(root.pieces, from, choice.target.deltaX, choice.target.deltaY, id);
      assert.equal(first.ok, true);
      const initial = { coordinate: first.to, points: ability.getRequiredMovePointsFromCoordinate(context, actor, from), path: [first.to] };
      const key = p => `${p.x},${p.y}`;
      const best = new Map([[key(initial.coordinate), initial]]), queue = [initial];
      while (queue.length) {
        queue.sort((a, b) => a.points - b.points);
        const route = queue.shift();
        if (best.get(key(route.coordinate)) !== route) continue;
        for (const direction of ability.MOVE_DIRECTIONS) {
          const move = rockets.canMoveFromCoordinate(root.pieces, route.coordinate, direction.deltaX, direction.deltaY, id);
          if (!move.ok) continue;
          const points = route.points + ability.getRequiredMovePointsFromCoordinate(context, actor, route.coordinate);
          if (best.has(key(move.to)) && best.get(key(move.to)).points <= points) continue;
          const next = { coordinate: move.to, points, path: [...route.path, move.to] };
          best.set(key(move.to), next); queue.push(next);
        }
      }
      const destinations = [...best.values()].filter(r => solar.resolveVisibleContent(r.coordinate.x, r.coordinate.y, root.solarSystem).content.kind === solar.layout.CONTENT_KIND.ASTEROID)
        .sort((a, b) => a.points - b.points);
      assert.ok(destinations.length);
      report.routes.push({ choice, minimumPoints: destinations[0].points, destinations, exploredCoordinates: best.size });
    }
    report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, routes: report.routes.map(r => ({
      choice: r.choice.target.choiceId, points: r.minimumPoints, nearest: r.destinations[0], coordinates: r.exploredCoordinates,
    })), error: report.error }, null, 2)); }
}
