"use strict";

const assert = require("node:assert/strict");
const { createPlayerStatsUi } = require("./player-stats-ui");

function createElement(tagName) {
  return {
    tagName,
    className: "",
    textContent: "",
    title: "",
    children: [],
    attributes: {},
    style: { setProperty() {} },
    classList: { toggle() {} },
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
  };
}

(() => {
  const resident = Object.freeze({
    solarState: Object.freeze({ aomomoActive: false }),
    alienGameState: Object.freeze({
      aomomo: Object.freeze({ revealInitialized: false }),
      fangzhou: Object.freeze({ revealInitialized: true }),
      runezu: Object.freeze({ revealInitialized: true }),
    }),
  });
  const player = Object.freeze({
    id: "p1",
    name: "蓝色玩家",
    color: "blue",
    colorLabel: "蓝色",
    resources: Object.freeze({ credits: 2, energy: 3, publicity: 1, availableData: 2 }),
    income: Object.freeze({ credits: 3, energy: 2, handSize: 1 }),
    hand: Object.freeze([Object.freeze({ id: "c1" })]),
  });
  const readoutRoot = Object.freeze({
    ...resident,
    playerState: Object.freeze({ currentPlayerId: "p1", players: Object.freeze([player]) }),
  });
  const ui = createPlayerStatsUi({
    document: { createElement },
    players: {
      DEFAULT_RESOURCES: {},
      RESOURCE_LIMITS: { publicity: 5, availableData: 4 },
      normalizeIncome: (income) => income,
      getPlayerColorDefinition: () => ({ uiColor: "#00f" }),
      getCurrentPlayer: (state) => state.players.find((entry) => entry.id === state.currentPlayerId),
    },
    data: {
      COMPUTER_DATA_SLOTS: { a: {}, b: {} },
      listComputerPlacedTokens: () => ["a"],
    },
    aomomo: {},
    fangzhou: { getUnlockCount: () => 2 },
    runezu: {
      SYMBOL_IDS: ["star"],
      getPlayerSymbolCounts: () => ({ star: 1 }),
      formatSymbolLabel: () => "星",
      getSymbolSrc: () => "star.png",
    },
    resourceIconSrc: new Proxy({}, { get: (_, key) => `${String(key)}.png` }),
    getReadoutRoot: () => readoutRoot,
    getPlayerCompanyBaseIncome: () => ({ credits: 1, energy: 1, handSize: 1 }),
    getInterfacePlayer: () => player,
    computeFinalScoreBreakdown: () => ({ totalScore: 9, tileScore: 2, cardScore: 3 }),
    isAiPlayer: () => true,
    isPlayerPassed: () => true,
  });

  const name = ui.createPlayerNameStat(player, 4, 8);
  assert.equal(name.children[1].textContent, "玩家(电脑)");
  assert.equal(ui.buildPlayerResourceStatNodes(player, { includeHandSize: true }).length, 7);
  assert.equal(ui.buildPlayerIncomeStatNodes(player, { showBasePlusIncrease: true })[1].title, "收入信用点 1+2（总计 3）");
  assert.equal(ui.buildPlayerFangzhouStatNodes(player)[1].children[1].textContent, "2/3");
  assert.equal(ui.buildPlayerRunezuStatNodes(player)[0].attributes["aria-label"], "星 1");
  assert.equal(ui.formatPlayerIncomeBreakdown(player, "credits"), "3(1+2)");
  assert.match(ui.getPlayerReadoutLines().join("\n"), /终局总分=9（板块=2 卡牌=3/);
  assert.equal(Object.isFrozen(resident), true);

  console.log("player stats UI tests passed");
})();
