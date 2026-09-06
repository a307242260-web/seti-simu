"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const cards = require("../randomizer/game/cards/effects");
const rockets = require("../randomizer/game/rockets"), solar = require("../randomizer/solar-system/core");
const output = "reports/iteration/movement-purpose-witnesses-20260907.json";
const inputs = ["reports/iteration/movement-demand-catalog-20260907.json",
  "reports/iteration/company-movement-input-42-20260906.json",
  "reports/iteration/company-hot-prefix-20260907.json"];

function conditionAt(root, actor, condition) {
  const facts = rockets.buildProbeLocationData(root);
  return cards.taskConditionMet({ condition }, actor, {
    probeLocations: facts.index, probeLocationDetails: facts.details,
  });
}

// 这里只枚举位置条件见证，不声称从原位置支付/移动可达，也不执行任务或获得奖励。
function positioned(root, placements) {
  const pieces = structuredClone(root.pieces);
  for (const { rocketId, coordinate } of placements) {
    const rocket = pieces.rockets.find(r => r.id === rocketId);
    assert.ok(rocket);
    if (!rockets.placeRocketByPriority(pieces, rocket, coordinate.x, coordinate.y)) return null;
  }
  return { ...root, pieces };
}

if (fs.existsSync(output)) console.log(`已有条件证据：${output}`);
else {
  const buffers = inputs.map(path => fs.readFileSync(path));
  const [catalog, initial, hot] = buffers.map(buffer => JSON.parse(buffer));
  const entries = Object.entries(catalog.conditions).filter(([type]) => /probe/i.test(type)).flatMap(([, rows]) => rows);
  assert.equal(entries.length, 8);
  assert.equal(new Set(entries.map(entry => entry.value.type)).size, 6);
  for (const entry of entries) {
    const current = entry.path.split(".").slice(1).reduce((value, field) => value[field], cards.getCardModel(entry.cardId));
    assert.deepEqual(current, entry.value, `条件源已变化：${entry.cardId}/${entry.path}`);
  }
  const report = { scope: "正式位置条件的完整有限目录与来源见证；仅位置反事实，不是合法路线、收益、全部移动消费者或生产优化验收",
    inputs: inputs.map((path, index) => ({ path, sha256: crypto.createHash("sha256").update(buffers[index]).digest("hex") })),
    conditionTypes: 6, conditionEntries: 8, states: [] };
  for (const [name, serialized] of [["root42", initial.checkpoint.coreState.committedState], ["hot-prefix", hot.envelope.committedState]]) {
    const root = JSON.parse(serialized), before = JSON.stringify(root);
    const actor = root.players.players.find(player => player.id === "player-green");
    const own = rockets.getRocketsForPlayer(root.pieces, actor.id).filter(rocket => rocket.surface === "solar-board");
    assert.equal(own.length, 2);
    const coordinates = solar.collectVisibleCoordinateContents(root.solarSystem)
      .filter(c => c.y >= rockets.SECTOR_RING_MIN && c.y <= rockets.SECTOR_RING_MAX)
      .map(({ x, y }) => ({ x, y }));
    assert.equal(coordinates.length, 32);
    const state = { name, rocketIds: own.map(r => r.id), conditions: [], joint: {} };
    for (const entry of entries) {
      const baseline = conditionAt(root, actor, entry.value);
      const row = { ...entry, held: [...actor.hand, ...actor.reservedCards].some(card => card.cardId === entry.cardId), baseline, sources: [] };
      for (const rocket of own) {
        const destinations = [], blockedCoordinates = [];
        for (const coordinate of coordinates) {
          const projected = positioned(root, [{ rocketId: rocket.id, coordinate }]);
          if (!projected) { blockedCoordinates.push(coordinate); continue; }
          if (conditionAt(projected, actor, entry.value)) destinations.push(coordinate);
        }
        row.sources.push({ rocketId: rocket.id, destinations, blockedCoordinates });
        // 对手条件不应随己方单艘落位改变；它不是可控制的移动目标。
        if (entry.value.type === "otherProbeAtPlanet") assert.equal(destinations.length, baseline ? 32 - blockedCoordinates.length : 0);
      }
      state.conditions.push(row);
    }
    const joint = state.conditions.find(row => row.value.type === "probesOnDifferentPlanets");
    const planets = solar.createSolarSnapshot(root.solarSystem).planetLocations.filter(p => p.planetId !== "earth");
    const witnesses = [];
    for (const first of planets) for (const second of planets) {
      const placements = own.map((rocket, index) => ({ rocketId: rocket.id,
        coordinate: { x: [first, second][index].x, y: [first, second][index].y } }));
      const projected = positioned(root, placements);
      if (!projected || !conditionAt(projected, actor, joint.value)) continue;
      const requiredRocketIds = own.filter(rocket => !conditionAt({ ...projected,
        pieces: { ...projected.pieces, rockets: projected.pieces.rockets.filter(r => r.id !== rocket.id) } }, actor, joint.value)).map(r => r.id);
      assert.deepEqual(requiredRocketIds, own.map(r => r.id), "联合任务计划必须依赖两艘，不是仅移动的那艘");
      witnesses.push({ placements, requiredRocketIds });
    }
    state.joint = { oneSourceDestinationCounts: joint.sources.map(s => ({ rocketId: s.rocketId, count: s.destinations.length })),
      pairWitnessCount: witnesses.length, firstWitness: witnesses[0] };
    assert.ok(witnesses.length > 0);
    if (name === "root42") assert.ok(joint.sources.every(source => source.destinations.length === 0),
      "起点两艘都在地球：只查询单艘完成条件会错误丢弃联合需求");
    else assert.ok(joint.sources.some(source => source.destinations.length > 0), "热点已有一艘火星，另一艘应能补全联合条件");
    assert.equal(JSON.stringify(root), before, "条件枚举不得修改输入/RNG/序号");
    report.states.push(state);
  }
  report.verified = true;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, states: report.states.map(state => ({ name: state.name,
    joint: state.joint, heldConditions: state.conditions.filter(row => row.held).map(row => ({ cardId: row.cardId,
      baseline: row.baseline, destinations: row.sources.map(source => ({ rocketId: source.rocketId, count: source.destinations.length })) })) })) }, null, 2));
}
