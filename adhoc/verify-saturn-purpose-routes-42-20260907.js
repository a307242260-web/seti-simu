"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const rockets = require("../randomizer/game/rockets"), solar = require("../randomizer/solar-system/core");
const ability = require("../randomizer/game/abilities/rocket");
const output = "reports/iteration/saturn-purpose-routes-42-state-20260907.json";
const key = p => `${p.x},${p.y}`;
if (fs.existsSync(output)) console.log(`已有正式路线证据：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42同一探测器到土星的两条同成本路线：公司首步+结束另一艘+纯能量支付；全部输入正式提交，不运行AI、不追加资源", cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const initial = fork.lifecycle.save().envelope;
    const root = fork.projection({ role: "simulation" }).state;
    const actor = root.players.players.find(p => p.id === "player-green");
    const rocket = rockets.getRocketsForPlayer(root.pieces, actor.id)[0];
    const destination = solar.createSolarSnapshot(root.solarSystem).planetLocations.find(p => p.planetId === "saturn");
    const context = { ...root, state: root }, from = rockets.getRocketSectorCoordinate(rocket);
    for (const firstDirection of ["out", "cw"]) {
      const direction = ability.MOVE_DIRECTIONS.find(d => d.id === firstDirection);
      const firstMove = rockets.canMoveFromCoordinate(root.pieces, from, direction.deltaX, direction.deltaY, rocket.id);
      assert.equal(firstMove.ok, true);
      const start = { coordinate: firstMove.to, points: ability.getRequiredMovePointsFromCoordinate(context, actor, from), path: [direction] };
      const best = new Map([[key(start.coordinate), start]]), queue = [start];
      while (queue.length) {
        queue.sort((a, b) => a.points - b.points || a.path.length - b.path.length);
        const current = queue.shift();
        if (best.get(key(current.coordinate)) !== current) continue;
        for (const nextDirection of ability.MOVE_DIRECTIONS) {
          const move = rockets.canMoveFromCoordinate(root.pieces, current.coordinate, nextDirection.deltaX, nextDirection.deltaY, rocket.id);
          if (!move.ok) continue;
          const next = { coordinate: move.to, points: current.points + ability.getRequiredMovePointsFromCoordinate(context, actor, current.coordinate),
            path: [...current.path, nextDirection] };
          const prior = best.get(key(next.coordinate));
          if (prior && (prior.points < next.points || (prior.points === next.points && prior.path.length <= next.path.length))) continue;
          best.set(key(next.coordinate), next); queue.push(next);
        }
      }
      const route = best.get(key(destination));
      assert.ok(route); assert.equal(route.points, 4);
      assert.ok(actor.resources.energy >= route.points - 1, "真实资源足够支付剩余路径，不注入能量");
      assert.equal(fork.lifecycle.restore(initial).ok, true);
      const entry = { firstDirection, path: route.path, points: route.points, inputs: [], events: [] };
      let cursor = 0;
      const submit = action => {
        assert.ok(action, "该路径输入必须出现在正式合法集中");
        const inspection = fork.inspect();
        if (action.phase !== "conditional") cursor = 0;
        const d = inspection.session?.decision;
        const result = action.phase === "conditional"
          ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
            ownerId: d.ownerId, choice: action }, { skipProjection: true })
          : fork.inputPort.submitAction(action, { skipProjection: true });
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.ok(Array.isArray(result.journal.events));
        assert.ok(result.journal.events.length >= cursor);
        entry.events.push(...result.journal.events.slice(cursor)); cursor = result.journal.events.length;
        entry.inputs.push({ action, ok: result.ok });
      };
      submit(fork.inputPort.enumerateActions().find(a => a.family === "industry" && a.target.abilityId === "huanyu_free_moves"));
      submit(fork.inspect().session.decision.choices.find(a => a.target.rocketId === rocket.id && a.payload.direction === firstDirection));
      submit(fork.inspect().session.decision.choices.find(a => a.target.skip === true));
      for (const step of route.path.slice(1)) {
        submit(fork.inputPort.enumerateActions().find(a => a.family === "move" && a.target.rocketId === rocket.id
          && a.target.deltaX === step.deltaX && a.target.deltaY === step.deltaY));
        const inspection = fork.inspect();
        if (inspection.phase === "awaiting_input") {
          submit(inspection.session.decision.choices.find(a => a.family === "choose_payment"
            && a.target.kind === "move-payment" && a.target.cardIds.length === 0));
        }
        assert.notEqual(fork.inspect().phase, "awaiting_input", "本样本每步奖励无需其他选择");
      }
      const final = fork.projection({ role: "simulation" }).state;
      entry.player = final.players.players.find(p => p.id === actor.id);
      entry.rocket = final.pieces.rockets.find(r => r.id === rocket.id);
      entry.arrivalEvents = entry.events.filter(e => ["visitPlanet", "visitComet", "visitAsteroid"].includes(e.type));
      entry.committedState = JSON.parse(fork.lifecycle.save().envelope.committedState);
      assert.deepEqual(rockets.getRocketSectorCoordinate(entry.rocket), { x: destination.x, y: destination.y });
      assert.equal(entry.player.resources.energy, actor.resources.energy - 3);
      report.cases.push(entry);
    }
    report.stateDifferences = [];
    const compare = (a, b, path) => {
      if (JSON.stringify(a) === JSON.stringify(b)) return;
      if (a && b && typeof a === "object" && typeof b === "object") {
        for (const property of new Set([...Object.keys(a), ...Object.keys(b)])) compare(a[property], b[property], `${path}.${property}`);
      } else report.stateDifferences.push({ path, out: a, cw: b });
    };
    compare(report.cases[0].committedState, report.cases[1].committedState, "state");
    report.verified = true;
  } catch (error) { report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, cases: report.cases.map(c => ({ first: c.firstDirection,
      path: c.path.map(d => d.id), points: c.points, inputs: c.inputs.length, resources: c.player.resources,
      arrivalEvents: c.arrivalEvents })), stateDifferences: report.stateDifferences, error: report.error }, null, 2));
  }
}
