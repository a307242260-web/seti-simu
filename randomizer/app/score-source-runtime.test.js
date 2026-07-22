"use strict";

const assert = require("node:assert/strict");
const { SCORE_SOURCE_KEYS, createScoreSourceRuntime } = require("./score-source-runtime");

const history = { name: "main" };
const quickHistory = { name: "quick" };
const commands = [];
const player = { id: "p1", color: "blue", resources: { score: 0 }, hand: [] };
let flow = { actionType: "orbit" };
const runtime = createScoreSourceRuntime({
  actionHistory: history,
  quickActionHistory: quickHistory,
  players: { getCurrentPlayer: () => player },
  getPlayerById: (id) => (id === player.id ? player : null),
  getPlayerByColor: (color) => (color === player.color ? player : null),
  getActionEffectFlow: () => flow,
  isAlienFamilyCard: (card) => card?.family === "alien",
  recordHistoryCommand: (root, command) => commands.push({ root, command }),
  recordQuickHistoryCommand: (command) => commands.push({ quick: true, command }),
});

assert.equal(runtime.addPlayerScoreSource(player, SCORE_SOURCE_KEYS.INITIAL, 1.234), 1.23);
assert.equal(runtime.getPlayerScoreSource(player, SCORE_SOURCE_KEYS.INITIAL), 1.23);
assert.equal(runtime.addPlayerScoreSource(player, "unknown", 10), 0);

const root = { playerState: { currentPlayerId: "p1", players: [player] } };
runtime.recordScanScoreSourcesFromAbilityResult(root, { scoreAwarded: 2, playerId: "p1" }, history);
assert.equal(player.scoreSources.scanScore, 2);
assert.equal(commands[0].root, root);
commands[0].command.undo();
assert.equal(player.scoreSources.scanScore, undefined);

runtime.recordInitialSelectionScoreSources({
  results: [{
    playerId: "p1",
    results: [
      { type: "resources", gain: { score: 3 } },
      { type: "alienTraceReward", trace: { traceType: "pink" }, gain: { score: 1 } },
    ],
  }],
});
assert.equal(player.scoreSources.initialScore, 4.23);
assert.equal(player.scoreSources.alienTracePinkScore, 1);

assert.equal(runtime.recordScoreSourceForGainEffect(player, {}, { score: 2 }), 2);
assert.equal(player.scoreSources.orbitScore, 2);
flow = { actionType: "playCard", card: { family: "alien" } };
runtime.recordScoreSourceForGainEffect(player, {}, { score: 4 });
assert.equal(player.scoreSources.alienEffectScore, 4);

const effects = runtime.attachScoreSourceToEffects([{ type: "gain" }], SCORE_SOURCE_KEYS.LAND);
assert.equal(effects[0].options.scoreSourceKey, SCORE_SOURCE_KEYS.LAND);
assert.notEqual(effects[0], effects);

console.log("score-source-runtime tests passed");
