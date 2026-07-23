"use strict";

const assert = require("node:assert/strict");
const { createIncomeRuntime, isIncomeDiscardActionType } = require("./income-runtime");

assert.equal(isIncomeDiscardActionType("initial_income"), true);
assert.equal(isIncomeDiscardActionType("play_card"), false);

{
  const player = {
    id: "p1",
    color: "white",
    resources: {},
    income: { credits: 2, energy: 1, handSize: 1 },
  };
  const runtime = createIncomeRuntime({
    INCOME_GAIN_LABELS: { credits: "信用点" },
    players: {
      DEFAULT_INCOME: {},
      gainIncome(target, gain) {
        target.resources.credits = (target.resources.credits || 0) + (gain.credits || 0);
        return { ok: true };
      },
      gainResources(target, gain) {
        Object.assign(target.resources, gain);
      },
      getCurrentPlayer(playerState) {
        return playerState.players[playerState.currentPlayerIndex];
      },
    },
    data: { gainData: () => ({ ok: true }) },
    blindDrawCardForPlayer: () => ({ ok: true, card: { id: "drawn" } }),
    industry: { shouldCompleteIncomeTaskCards: () => false },
    getCardTypeCode: () => 0,
    incrementCompletedTaskCount: () => 1,
    cards: {
      getIncomeCodeForCard: () => 1,
      getIncomeGainForCard: () => ({ credits: 1 }),
      getCardLabel: () => "收入牌",
    },
    turnState: { roundNumber: 2 },
    getCurrentPlayer: () => player,
    beginDiscardSelection: (_workingRoot, count, pending) => ({ ok: true, count, pending }),
  });

  const result = runtime.applyIncomeFromCard(player, { id: "income-card" });
  assert.equal(result.ok, true);
  assert.equal(player.resources.credits, 1);
  assert.match(result.message, /收入牌/);

  const workingRoot = { playerState: { players: [player], currentPlayerIndex: 0 } };
  const started = runtime.beginIncomeForCurrentPlayer(workingRoot, { source: "round" });
  assert.equal(started.count, 1);
  assert.equal(started.pending.type, "income");
  assert.equal(started.pending.source, "round");
}

console.log("income-runtime tests passed");
