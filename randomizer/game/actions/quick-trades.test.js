const assert = require("node:assert/strict");
require("../card-catalog");
require("../cards/deck");
require("../basic-cards");
require("../players");
require("./quick-trades");

const basicCards = require("../basic-cards");
const players = require("../players");
const quickTrades = require("./quick-trades");

function createContext(overrides = {}) {
  const context = {
    playerState: players.createPlayerState({
      currentPlayer: {
        color: "white",
        resources: { credits: 10, energy: 1, handSize: 4 },
      },
    }),
    blindDrawCard(player) {
      const target = player || players.getCurrentPlayer(context.playerState);
      return basicCards.drawRandomBasicCardToHand(target.hand);
    },
    beginDiscardSelection(count, pending) {
      const player = pending.player || players.getCurrentPlayer(context.playerState);
      for (let index = 0; index < count; index += 1) {
        player.hand.pop();
      }
      player.resources.handSize = player.hand.length;
      return quickTrades.finalizeTradeAfterDiscard(pending.tradeId, context, player);
    },
    ...overrides,
  };
  return context;
}

const context = createContext();

const energyTrade = quickTrades.executeTrade("credits-for-energy", context);
assert.equal(energyTrade.ok, true);
assert.equal(players.getCurrentPlayer(context.playerState).resources.credits, 8);
assert.equal(players.getCurrentPlayer(context.playerState).resources.energy, 2);

const cardTrade = quickTrades.executeTrade("credits-for-card", context);
assert.equal(cardTrade.ok, true);
assert.equal(players.getCurrentPlayer(context.playerState).resources.handSize, 5);

const creditTrade = quickTrades.executeTrade("cards-for-credit", context);
assert.equal(creditTrade.ok, true);
assert.equal(players.getCurrentPlayer(context.playerState).resources.credits, 7);
assert.equal(players.getCurrentPlayer(context.playerState).resources.handSize, 3);

const energyForCard = quickTrades.executeTrade("energy-for-card", context);
assert.equal(energyForCard.ok, true);
assert.equal(players.getCurrentPlayer(context.playerState).resources.energy, 0);
assert.equal(players.getCurrentPlayer(context.playerState).resources.handSize, 4);

const energyCreditContext = createContext({
  playerState: players.createPlayerState({
    currentPlayer: {
      color: "white",
      resources: { credits: 0, energy: 4, handSize: 0 },
    },
  }),
});
const energyCreditTrade = quickTrades.executeTrade("energy-for-credit", energyCreditContext);
assert.equal(energyCreditTrade.ok, true);
assert.equal(players.getCurrentPlayer(energyCreditContext.playerState).resources.credits, 1);
assert.equal(players.getCurrentPlayer(energyCreditContext.playerState).resources.energy, 2);

const blocked = quickTrades.executeTrade("cards-for-energy", {
  playerState: players.createPlayerState({
    currentPlayer: {
      color: "white",
      resources: { credits: 0, energy: 0, handSize: 1 },
    },
  }),
});
assert.equal(blocked.ok, false);
assert.match(blocked.message, /资源不足/);

console.log("quick trade tests passed");
