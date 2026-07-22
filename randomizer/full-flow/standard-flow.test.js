"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../app/simulation-env");
const fixture = require("./standard-flow-v1.fixture");

function initialSnapshot(env) {
  const state = env.observe().publicState;
  return {
    turn: [state.roundNumber, state.turnNumber, state.actionCycleNumber, state.currentPlayerId],
    players: state.players.map((player) => [
      player.playerId, player.score, player.credits, player.energy, player.publicity,
      player.availableData, player.handCount, player.reservedCount,
    ]),
    publicCards: state.board.publicCards.map((card) => card.cardId),
    rockets: state.board.rockets.map((rocket) => [rocket.id, rocket.playerId, rocket.surface]),
    pending: [state.pending.actorPlayerId, state.pending.pendingOwnerPlayerId, state.pending.decisionType, state.pending.choiceCount],
  };
}

function finalSnapshot(env) {
  const observation = env.observe();
  const checkpoint = env.createCheckpoint();
  const state = typeof checkpoint.coreState.committedState === "string"
    ? JSON.parse(checkpoint.coreState.committedState)
    : checkpoint.coreState.committedState;
  const markerOwners = (markers) => (markers || []).map((marker) => marker.playerId);
  const alienKeys = ["amiba", "aomomo", "banrenma", "chong", "fangzhou", "jiuzhe", "runezu", "yichangdian"];
  return {
    turn: [
      state.turn.roundNumber, state.turn.turnNumber, state.turn.actionCycleNumber,
      state.turn.currentPlayerId, state.turn.passedPlayerIds,
      state.turn.completedTurnPlayerIds, state.turn.gameEnded,
    ],
    players: state.players.players.map((player) => [
      player.id, player.resources.score, player.resources.credits, player.resources.energy,
      player.resources.publicity, player.resources.availableData,
      player.hand.map((card) => card.cardId), player.reservedCards.map((card) => card.cardId),
      player.techState.ownedTiles, player.dataState.poolTokens.length,
      player.dataState.placedTokens.map((token) => [token.id, token.placementSlot]),
    ]),
    cards: {
      public: state.cards.publicCards.map((card) => card.cardId),
      discard: state.cards.discardPile.map((card) => card.cardId),
    },
    rockets: state.pieces.rockets.map((rocket) => [
      rocket.id, rocket.playerId, rocket.surface,
      rocket.surface === "solar-board" ? [rocket.sectorX, rocket.sectorY] : null,
      rocket.referencePlacement?.planetId || null, rocket.referencePlacement?.kind || null,
    ]),
    planets: Object.fromEntries(Object.entries(state.planets.planets).map(([planetId, planet]) => [planetId, [
      markerOwners(planet.orbitMarkers), markerOwners(planet.landingMarkers), markerOwners(planet.satelliteLandings),
    ]])),
    data: Object.entries(state.data.nebulae).flatMap(([nebulaId, nebula]) => nebula.tokens
      .filter((token) => token.replacedByPlayerId)
      .map((token) => [nebulaId, token.slotIndex, token.replacedByPlayerId])),
    aliens: {
      slots: Object.entries(state.aliens.aliens).map(([slotId, slot]) => [
        slotId, slot.alienId, slot.revealed,
        [slot.traces.blue.firstPlaced, slot.traces.pink.firstPlaced, slot.traces.yellow.firstPlaced],
      ]),
      revealed: alienKeys.map((key) => state.aliens[key].revealInitialized),
    },
    authority: [state.meta.stateVersion, state.meta.rngState.algorithm, state.meta.rngState.state, state.meta.sequences.historyStep],
    session: [
      checkpoint.effectSessionCheckpoint ?? null,
      observation.publicState.pending.actorPlayerId,
      observation.publicState.pending.pendingOwnerPlayerId,
      observation.publicState.pending.decisionType,
      observation.publicState.pending.choiceCount,
      checkpoint.replayCursor.stepIndex,
      checkpoint.effectSessionJournals.length,
    ],
  };
}

const env = createSimulationEnv();
env.reset(fixture.config);
assert.deepEqual(initialSnapshot(env), fixture.initialSnapshot, "版本化初始状态发生漂移");

for (const [stepIndex, [actionId, maskIndex]] of fixture.operations.entries()) {
  const legalActions = env.legalActions();
  const semanticChoice = fixture.openingSemanticChoices?.[stepIndex] || null;
  const semanticMatches = semanticChoice ? legalActions.filter((candidate) => (
    candidate.family === semanticChoice.family
    && candidate.actorPlayerId === semanticChoice.actorPlayerId
    && candidate.target?.cardId === semanticChoice.cardId
  )) : [];
  if (semanticChoice) {
    assert.equal(semanticMatches.length, 1,
      `opening 语义选择必须唯一：${semanticChoice.actorPlayerId}/${semanticChoice.cardId}`);
    assert.equal(semanticMatches[0].actionId, actionId, "opening 语义选择解析出的 actionId 漂移");
    assert.equal(semanticMatches[0].maskIndex, maskIndex, "opening 语义选择解析出的 maskIndex 漂移");
  }
  const action = semanticChoice
    ? semanticMatches[0]
    : legalActions.find((candidate) => candidate.actionId === actionId && candidate.maskIndex === maskIndex);
  assert.ok(action, `固定脚本动作不可用：${actionId}#${maskIndex}`);
  const result = env.step(action);
  assert.equal(result.ok, true, result.error || `固定脚本动作失败：${actionId}`);
  assert.notEqual(result.blocked, true, `流程不得 blocked：${actionId}`);
}

assert.deepEqual(finalSnapshot(env), fixture.finalSnapshot, "最终权威盘面发生漂移");
assert.equal(env.createCheckpoint().effectSessionJournals.length, fixture.operations.length,
  "每次 composition 输入都必须留下对应 Effect Session journal");
assert.equal(env.createCheckpoint().effectSessionCheckpoint ?? null, null, "最终 Effect Session 必须清空");
env.dispose();

console.log("standard full-flow v1 passed");
