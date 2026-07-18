"use strict";

const assert = require("node:assert/strict");
const { createAiBattleLog } = require("./battle-log");

const player = { id: "p1", colorLabel: "蓝色", resources: { score: 12, credits: 3, energy: 2, publicity: 1, availableData: 4 }, hand: [], reservedCards: [] };
const state = { logs: [], bugs: [], bugCounts: {}, compactLogs: true };
const runtime = createAiBattleLog({
  aiAutoBattleState: state,
  turnState: { roundNumber: 2, turnNumber: 3 },
  playerState: { currentPlayerId: player.id },
  getActivePlayers: () => [player],
  getCurrentPlayer: () => player,
  getPlayerById: () => player,
  getPlayerByColor: () => player,
  getAiDisplayedTurnNumber: (value) => value,
  aiNumber: (value) => Number(value) || 0,
  countAiPlayerTech: () => 0,
  roundAiScore: (value) => Number(value) || 0,
  getAiCandidateRankScore: (candidate) => candidate.score || 0,
  summarizeAiTurnActionCandidate: (candidate) => ({ id: candidate.id || null }),
  summarizeAiFinalScoreMarkCandidate: (candidate) => ({ id: candidate.id || null }),
  getAiCardDisplayLabel: () => null,
  getCardPrice: () => 0,
  getCardTypeCode: () => null,
});

const entry = runtime.recordAiAutoBattleLog("turn-action", "执行行动", { action: { id: "scan" }, candidates: [] });
assert.equal(entry.id, 1);
assert.equal(entry.roundNumber, 2);
assert.equal(entry.playerId, player.id);
assert.deepEqual(entry.details.action, { id: "scan" });

const bug = runtime.recordAiAutoBattleBug("阻塞", { pending: true });
assert.equal(bug.details.repeatCount, 1);
assert.equal(state.bugs.length, 1);
assert.equal(state.bugCounts["阻塞"], 1);

console.log("app/ai/battle-log.test.js ok");
