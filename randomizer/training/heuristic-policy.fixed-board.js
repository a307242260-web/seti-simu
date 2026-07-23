"use strict";

const crypto = require("node:crypto");
const heuristicPolicy = require("../game/ai/heuristic-policy");

const FIXED_BOARD_ID = "seti-104-board-v1";
const FIXED_BOARD_CONFIG = Object.freeze({
  seed: "seti-104-official-v1",
  activePlayerCount: 4,
  aiDifficulty: "weak_start",
  offlineTeacher: true,
  policyVersion: heuristicPolicy.POLICY_VERSION,
  opponentIdentity: heuristicPolicy.POLICY_VERSION,
});

function stableSerialize(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(value[key])}`
  )).join(",")}}`;
}

function contentToken(content) {
  const cell = content.content || content;
  if (cell.kind === "planet") return `planet:${cell.planetId}`;
  if (cell.kind === "nebula") return `nebula:${cell.label}`;
  return cell.kind;
}

function projectFixedBoard(observation) {
  const publicState = observation.publicState || {};
  const board = publicState.board || {};
  const solar = board.solarSystem || {};
  const planetStats = board.planets?.planets || {};
  const contents = solar.visibleContents || [];
  const rows = {};
  for (let y = 0; y <= 5; y += 1) {
    rows[y] = contents
      .filter((content) => content.y === y)
      .sort((left, right) => left.x - right.x)
      .map(contentToken);
  }
  return {
    boardId: FIXED_BOARD_ID,
    seed: observation.seed,
    perspectivePlayerId: observation.perspectivePlayerId,
    roundNumber: publicState.roundNumber,
    currentPlayerId: publicState.currentPlayerId,
    rotation: solar.rotation?.normalized || null,
    sectorBySlot: solar.sectorBySlot || null,
    visibleRows: rows,
    planets: (solar.planetLocations || []).map((planet) => ({
      planetId: planet.planetId,
      x: planet.x,
      y: planet.y,
    })),
    planetMarkers: Object.entries(planetStats).map(([planetId, stats]) => ({
      planetId,
      orbitOwners: (stats.orbitMarkers || []).map((marker) => marker.playerId),
      landingOwners: (stats.landingMarkers || []).map((marker) => marker.playerId),
    })),
    rockets: (board.rockets || []).map((rocket) => ({
      id: rocket.id,
      playerId: rocket.playerId,
      surface: rocket.surface,
    })),
    publicCards: (board.publicCards || []).map((card) => card.cardId),
    techBonuses: Object.values(board.techSupply?.stacks || {}).map((stack) => ({
      tileId: stack.tileId,
      bonusId: stack.bonusId,
    })),
    players: (publicState.players || []).map((player) => ({
      playerId: player.playerId,
      score: player.score,
      credits: player.credits,
      energy: player.energy,
      publicity: player.publicity,
      availableData: player.availableData,
      handCount: player.handCount,
    })),
    selfHand: (observation.selfState?.hand || []).map((card) => card.cardId),
  };
}

function fingerprintFixedBoard(projection) {
  return crypto.createHash("sha256").update(stableSerialize(projection)).digest("hex");
}

module.exports = Object.freeze({
  FIXED_BOARD_ID,
  FIXED_BOARD_CONFIG,
  projectFixedBoard,
  fingerprintFixedBoard,
});
