"use strict";

const assert = require("node:assert/strict");
const actionBriefing = require("./action-briefing");

const metadata = actionBriefing.createActionBriefingStepMetadata({
  payload: { sectorX: 9, nebulaId: "aomomo" },
  events: [
    { type: "signalMarked", x: 10, nebulaId: "aomomo", label: "奥陌陌" },
    { type: "signalMarked", x: 10, nebulaId: "aomomo", label: "奥陌陌" },
  ],
}, {
  normalizeActionLogText: (value) => String(value || "").trim(),
  solar: { mod8: (x) => x % 8 },
  data: { getNebulaLabel: (id) => (id === "aomomo" ? "奥陌陌" : id) },
});

assert.deepEqual(metadata, {
  scanTargets: [
    { x: 1, nebulaId: "aomomo", label: "奥陌陌" },
    { x: 2, nebulaId: "aomomo", label: "奥陌陌" },
  ],
});

const scanEntry = {
  actionType: "scan",
  steps: [
    {
      source: "main",
      text: "扫描：奥陌陌与扇区[4]",
      briefing: {
        scanTargets: [
          { x: 2, nebulaId: "aomomo", label: "奥陌陌" },
        ],
      },
    },
  ],
};

assert.equal(
  actionBriefing.getActionBriefingDetailText(scanEntry, {
    normalizeActionLogText: (value) => String(value || "").trim(),
    historySourceMain: "main",
    solar: {
      getNebulaLocations: () => [{ id: "aomomo", label: "奥陌陌", x: 2 }],
    },
    solarState: {},
    data: { getNebulaLabel: (id) => (id === "aomomo" ? "奥陌陌" : id) },
    aomomo: { NEBULA_ID: "aomomo" },
    getAomomoCurrentX: () => 2,
  }),
  "扫描了扇区[2]奥陌陌、扇区[4]",
);

const item = actionBriefing.createActionBriefingItemFromEntry({
  id: 9,
  roundNumber: 2,
  turnNumber: 5,
  actionCycleNumber: 3,
  playerId: "p1",
  actionType: "playCard",
  steps: [
    {
      source: "main",
      playedCard: { id: "card-1", label: "深空雷达", src: "/card.png" },
    },
  ],
}, {
  normalizeActionLogText: (value) => String(value || "").trim(),
  isAiAutoBattlePlayer: (playerId) => playerId === "p1",
  getPlayerById: () => ({ color: "white", colorLabel: "白色玩家" }),
  getPlayerLabelById: () => "白色玩家",
  getPlayerColorDefinition: () => ({ uiColor: "#fff" }),
  createActionLogPlayedCardSnapshot: (card) => card,
  historySourceMain: "main",
  solar: { getNebulaLocations: () => [] },
  solarState: {},
  data: { getNebulaLabel: () => "" },
  aomomo: { NEBULA_ID: "aomomo" },
  getAomomoCurrentX: () => null,
});

assert.equal(item.playerLabel, "白色玩家");
assert.equal(item.actionName, "打牌");
assert.equal(item.detailText, "打出了深空雷达");

const pruned = actionBriefing.pruneActionBriefingItems([
  { roundNumber: 1, actionCycleNumber: 1, playerId: "a" },
  { roundNumber: 1, actionCycleNumber: 2, playerId: "a" },
  { roundNumber: 1, actionCycleNumber: 3, playerId: "a" },
], 2);
assert.deepEqual(pruned.map((entry) => entry.actionCycleNumber), [2, 3]);

const ordered = actionBriefing.getActionBriefingItemsForCompletedCycle([
  { roundNumber: 3, actionCycleNumber: 7, playerId: "p2", playerLabel: "蓝色玩家" },
  { roundNumber: 3, actionCycleNumber: 7, playerId: "p1", playerLabel: "白色玩家" },
], {
  completedActionCycle: true,
  completedActionCycleRoundNumber: 3,
  completedActionCycleNumber: 7,
  completedActionCycleTurnNumber: 9,
  completedActionCyclePlayerIds: ["p1", "p2"],
}, {
  getPlayerById: (playerId) => ({
    color: playerId === "p1" ? "white" : "blue",
    colorLabel: playerId === "p1" ? "白色玩家" : "蓝色玩家",
  }),
});

assert.deepEqual(ordered.map((entry) => entry.playerId), ["p1", "p2"]);

console.log("action-briefing tests passed");
