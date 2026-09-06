"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const rockets = require("../randomizer/game/rockets"), solar = require("../randomizer/solar-system/core");
const ability = require("../randomizer/game/abilities/rocket"), cards = require("../randomizer/game/cards/effects");
const input = "reports/iteration/company-movement-input-42-20260906.json";
const output = "reports/iteration/purpose-routes-42-v2-20260907.json";
const key = c => `${c.x},${c.y}`;

// 反向最短路只给需求的移动成本下界与所有等成本首步，不声称收益不同的路线等价。
function distancesTo(graph, destinations) {
  const distances = new Map(destinations.map(c => [key(c), 0]));
  const queue = [...distances.keys()];
  while (queue.length) {
    queue.sort((a, b) => distances.get(a) - distances.get(b));
    const current = queue.shift();
    for (const [from, edges] of graph) for (const edge of edges) {
      if (key(edge.to) !== current) continue;
      const cost = distances.get(current) + edge.points;
      if (distances.has(from) && distances.get(from) <= cost) continue;
      distances.set(from, cost); queue.push(from);
    }
  }
  return distances;
}

if (fs.existsSync(output)) console.log(`已有原型证据：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42显式目的的正式几何最短路原型；不执行AI，不删除生产分支；最短路不是完整收益支配证明", input,
    inputSha256: crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex"), routes: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync(input)).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const root = fork.projection({ role: "simulation" }).state;
    const before = JSON.stringify(root), actor = root.players.players.find(p => p.id === "player-green");
    assert.ok(actor);
    const taskCard = actor.hand.find(c => c.cardId === "dlc_11.png");
    assert.ok(taskCard);
    const task = cards.getCardModel(taskCard).tasks[0];
    const context = { ...root, state: root };
    const locations = solar.collectVisibleCoordinateContents(root.solarSystem)
      .filter(c => c.y >= rockets.SECTOR_RING_MIN && c.y <= rockets.SECTOR_RING_MAX);
    const snapshot = solar.createSolarSnapshot(root.solarSystem);
    const own = rockets.getRocketsForPlayer(root.pieces, actor.id);
    assert.equal(own.length, 2);
    const start = performance.now();
    for (const rocket of own) {
      const graph = new Map();
      for (const coordinate of locations) {
        const edges = [];
        for (const direction of ability.MOVE_DIRECTIONS) {
          const move = rockets.canMoveFromCoordinate(root.pieces, coordinate, direction.deltaX, direction.deltaY, rocket.id);
          // 这是正式合法性预读，边界/满格不是一次失败规则提交。
          if (!move.ok) continue;
          edges.push({ direction: direction.id, from: { x: coordinate.x, y: coordinate.y }, to: move.to,
            points: ability.getRequiredMovePointsFromCoordinate(context, actor, coordinate) });
        }
        graph.set(key(coordinate), edges);
      }
      assert.equal(graph.size, 32);
      const taskDestinations = locations.filter(coordinate => {
        // 纯位置反事实：复用正式落位与条件读取，不执行任务、不分配实体或虚构奖励。
        const moved = { ...rocket }, pieces = { ...root.pieces,
          rockets: root.pieces.rockets.map(r => r.id === rocket.id ? moved : r) };
        if (!rockets.placeRocketByPriority(pieces, moved, coordinate.x, coordinate.y)) return false;
        const facts = rockets.buildProbeLocationData({ ...root, pieces });
        return cards.taskConditionMet(task, actor, { probeLocations: facts.index, probeLocationDetails: facts.details });
      }).map(c => ({ x: c.x, y: c.y }));
      assert.ok(taskDestinations.length);
      const purposes = snapshot.planetLocations.filter(p => p.planetId !== "earth")
        .map(p => ({ id: `planet:${p.planetId}`, role: "既有环绕/登陆的移动前置，不含终点费用", destinations: [{ x: p.x, y: p.y }] }));
      purposes.push({ id: `task:${taskCard.id}:${task.id}`, role: "手牌任务位置准备，仍需打牌与正式领取", destinations: taskDestinations });
      const from = rockets.getRocketSectorCoordinate(rocket);
      for (const purpose of purposes) {
        const distances = distancesTo(graph, purpose.destinations);
        assert.ok(distances.has(key(from)), `目的必须可达：${purpose.id}`);
        const minimumPoints = distances.get(key(from));
        const firstSteps = graph.get(key(from)).filter(edge => distances.has(key(edge.to))
          && edge.points + distances.get(key(edge.to)) === minimumPoints);
        const companyFirstSteps = firstSteps.filter(edge => edge.points <= 1);
        report.routes.push({ rocketId: rocket.id, purpose, from, minimumPoints,
          firstSteps, companyFirstSteps, minimumPaidPointsAfterCompany: companyFirstSteps.length ? minimumPoints - 1 : minimumPoints,
          vertices: graph.size, edges: [...graph.values()].reduce((n, edges) => n + edges.length, 0) });
      }
      const taskRoute = report.routes.find(r => r.rocketId === rocket.id && r.purpose.id.startsWith("task:"));
      assert.equal(taskRoute.minimumPoints, 2);
      assert.deepEqual(taskRoute.firstSteps.map(e => e.direction).sort(), ["cw", "out"]);
      assert.equal(taskRoute.minimumPaidPointsAfterCompany, 1);
      const mars = report.routes.find(r => r.rocketId === rocket.id && r.purpose.id === "planet:mars");
      assert.deepEqual(mars.firstSteps.map(e => e.direction), ["out"]);
      assert.equal(mars.minimumPaidPointsAfterCompany, 0);
      const venus = report.routes.find(r => r.rocketId === rocket.id && r.purpose.id === "planet:venus");
      assert.deepEqual(venus.firstSteps.map(e => e.direction), ["ccw"]);
    }
    report.prototypeWallMs = performance.now() - start;
    assert.equal(JSON.stringify(root), before, "图与任务位置预读不得修改原始状态/RNG/实体序号");
    report.verified = true;
  } catch (error) { report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, prototypeWallMs: report.prototypeWallMs,
      routes: report.routes.map(r => ({ rocketId: r.rocketId, purpose: r.purpose.id, points: r.minimumPoints,
        next: r.firstSteps.map(e => e.direction) })), error: report.error }, null, 2));
  }
}
