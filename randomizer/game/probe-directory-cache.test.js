"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../app/simulation-env");
const techBoard = require("./tech/board-state");
const playerTech = require("./tech/player-tech");
const rockets = require("./rockets");

// 只测公共投影目录对临时科技和合法来源的依赖；不执行AI或锁定历史轨迹。
const env = createSimulationEnv();
let fork;
try {
  env.reset({ seed: "probe-directory-borrowed-tech", activePlayerCount: 4, offlineTeacher: true });
  const opening = new Map();
  for (let step = 0; env.legalActions()[0]?.family?.startsWith("choose_"); step += 1) {
    assert.ok(step < 50, "标准开局必须有限完成");
    const actions = env.legalActions();
    const id = actions[0].actorId;
    const selected = opening.get(id) || { industry: false, cards: new Set() };
    let action = actions.find((a) => ["start_initial_setup", "confirm_initial_setup"].includes(a.target?.kind));
    if (!action && !selected.industry) {
      action = actions.find((a) => a.target?.selectionKind === "industry");
      if (action) selected.industry = true;
    }
    if (!action && selected.cards.size < 2) {
      action = actions.find((a) => a.target?.selectionKind === "initial" && !selected.cards.has(a.target.cardId));
      if (action) selected.cards.add(action.target.cardId);
    }
    opening.set(id, selected);
    assert.equal(env.step(action || actions[0]).ok, true);
  }
  fork = env.createCounterfactualFork().composition;
  const envelope = fork.lifecycle.save().envelope;
  const base = JSON.parse(envelope.committedState);
  const actorId = base.turn.currentPlayerId;
  const actor = base.players.players.find((p) => p.id === actorId);
  assert.ok(actor);
  base.turn.gameEnded = false;
  base.turn.roundNumber = 1;
  base.turn.turnNumber = 1;
  for (const player of base.players.players) {
    for (const tile of ["orange3", "orange4"]) {
      delete player.techState.ownedTiles[tile];
      delete player.techState.disabledTiles[tile];
    }
    player.industryBorrowedTechTileId = null;
    player.industryBorrowedTechRound = 0;
    player.industryBorrowedTechTurn = 0;
  }
  let sequence = 0;
  function project(state, playerId = actorId, cold = false) {
    const snapshot = structuredClone(state);
    // 唯一gameId只隔离缓存；盘面、资源、科技与正式费用输入完全相同。
    if (cold) snapshot.meta.gameId = `borrowed-cache-reference-${++sequence}`;
    const restored = fork.lifecycle.restore({ ...envelope,
      committedState: JSON.stringify(snapshot), session: null });
    assert.equal(restored.ok, true, JSON.stringify(restored));
    return fork.projection({ role: "player", playerId }).state.probeRouteRequirements;
  }
  const baseline = project(base);
  assert.ok(baseline.candidates.some((c) => c.endpointFamily === "land"));
  for (const tile of ["orange3", "orange4", "orange3", null]) {
    const state = structuredClone(base);
    const player = state.players.players.find((p) => p.id === actorId);
    player.industryBorrowedTechTileId = tile;
    player.industryBorrowedTechRound = tile ? 1 : 0;
    player.industryBorrowedTechTurn = tile ? 1 : 0;
    const warm = project(state);
    assert.deepEqual(warm, project(state, actorId, true), `借用${tile}热/冷目录必须一致`);
    if (tile === "orange3") {
      assert.ok(warm.candidates.some((c) => c.endpointFamily === "land"
        && c.required.energy < baseline.candidates.find((b) => b.requirementId === c.requirementId)?.required.energy));
    }
    if (tile === "orange4") {
      assert.ok(warm.candidates.some((c) => c.endpointTarget.type === "satellite"));
      assert.ok(warm.candidates.length > baseline.candidates.length);
    }
    const otherId = state.players.players.find((p) => p.id !== actorId).id;
    assert.deepEqual(project(state, otherId), project(state, otherId, true),
      "其他观察席位不能继承借用卫星权限或旧费用");
    if (tile) {
      state.turn.turnNumber += 1;
      assert.deepEqual(project(state), project(state, actorId, true), "借用到期后目录必须重读");
      assert.deepEqual(project(state), baseline, "过期借用不得保留收益");
    }
  }
  for (const tile of ["orange3", "orange4"]) {
    const state = structuredClone(base);
    const player = state.players.players.find((p) => p.id === actorId);
    assert.equal(techBoard.consumeStartupTileWithoutRewards(state.tech, tile).ok, true);
    assert.equal(playerTech.recordPlayerTake(player.techState, tile).ok, true);
    assert.deepEqual(project(state), project(state, actorId, true), "永久科技缓存一致");
    player.techState.disabledTiles[tile] = true;
    assert.deepEqual(project(state), baseline, "禁用科技不得保留费用或卫星收益");
  }
  // 反事实与正式分支可独立发射同编号探测器；位置相同不代表归属相同。
  const other = base.players.players.find((p) => p.id !== actorId);
  for (const ownerId of [actorId, other.id, actorId, other.id]) {
    const ownerState = structuredClone(base);
    ownerState.meta.gameId = "probe-owner-cache-20260912";
    const owner = ownerState.players.players.find(p => p.id === ownerId);
    const launched = rockets.launchRocketAtSector(ownerState.pieces, { x: 3, y: 1 },
      { root: ownerState, playerId: ownerId, color: owner.color });
    assert.equal(launched.ok, true);
    for (const viewer of [actorId, other.id]) {
      const warm = project(ownerState, viewer);
      const cold = project(ownerState, viewer, true);
      assert.deepEqual(warm, cold, `同编号探测器归属${ownerId}，观察席位${viewer}热冷目录一致`);
      assert.ok(warm.candidates.length > 0);
      for (const candidate of warm.candidates) {
        if (candidate.rocketId != null) assert.equal(
          ownerState.pieces.rockets.find(r => r.id === candidate.rocketId)?.playerId,
          viewer, "目录不得继承其他玩家的探测器");
      }
      if (!ownerState.pieces.rockets.some(r => r.playerId === viewer && r.surface === "solar-board"))
        assert.ok(warm.candidates.some(c => c.sourceId === "launch"),
        "无自有探测器且发射位可用时保留发射来源");
    }
  }
  console.log("probe directory borrowed-tech and owner cache tests passed");
} finally {
  fork?.dispose();
  env.dispose();
}
