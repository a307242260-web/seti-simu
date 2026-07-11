"use strict";

const assert = require("node:assert/strict");
const jiuzhe = require("./jiuzhe");
const state = require("./state");

const alienState = state.createDefaultAlienState();
alienState.aliens[1].assignedAlienId = jiuzhe.ALIEN_ID;
alienState.aliens[1].alienId = jiuzhe.ALIEN_ID;
alienState.aliens[1].revealed = true;
jiuzhe.ensureJiuzheState(alienState).revealedSlotId = 1;

const white = {
  id: "player-white",
  color: "white",
  colorLabel: "白色",
  resources: { score: 10, credits: 2 },
  income: { credits: 2, energy: 2, handSize: 1, publicity: 1, availableData: 1, additionalPublicScan: 1 },
  techState: { ownedTiles: { purple1: true, purple2: true, purple3: true }, blueBoardSlots: {} },
  completedTaskCount: 5,
};

let result = jiuzhe.placeJiuzheTrace(alienState, 1, "pink", 1, white);
assert.equal(result.ok, true);
assert.equal(result.reward.gain.score, 3);
assert.equal(jiuzhe.getThreat(alienState, white), 1);

result = jiuzhe.placeJiuzheTrace(alienState, 1, "pink", 1, white);
assert.equal(result.ok, false, "same Jiuzhe trace slot cannot be occupied twice");

result = jiuzhe.placeJiuzheTrace(alienState, 1, "yellow", 2, white);
assert.equal(result.ok, true);
assert.equal(result.reward.pickCard, true);
assert.equal(jiuzhe.getThreat(alienState, white), 3);

jiuzhe.dealJiuzheCards(alienState, [white], () => 0);
assert.equal(jiuzhe.getPlayerJiuzheCards(alienState, white).length, 3);

result = jiuzhe.playJiuzheCard(alienState, white, jiuzhe.getPlayerJiuzheCards(alienState, white)[0].index, {
  reason: "freeThreshold",
});
assert.equal(result.ok, true);
assert.equal(jiuzhe.countPlayedCards(alienState, white), 1);
assert.equal(jiuzhe.getPanelThreat(alienState, white), 3, "panel threat only counts alien board traces");
assert.equal(
  jiuzhe.getThreat(alienState, white),
  3 + (result.card.threat || 0),
  "total threat still includes played card threat",
);

const purpleCard = { index: 3 };
assert.equal(
  jiuzhe.isCardConditionMet(purpleCard, white, {
    alienGameState: alienState,
    planetStatsState: { planets: {} },
    nebulaDataState: { sectorSettlements: { winsByPlayerId: {} } },
  }),
  true,
  "purple tech condition should be met",
);

const baseIncomeOnlyTotalEightPlayer = {
  id: "player-brown",
  color: "brown",
  income: { credits: 2, energy: 1, handSize: 1, publicity: 4, availableData: 0, additionalPublicScan: 0 },
  initialSelection: { industry: { label: "层云核心" } },
};
assert.equal(
  jiuzhe.countIncomeIncreases(baseIncomeOnlyTotalEightPlayer),
  4,
  "company base income should not count as income increases",
);
assert.equal(
  jiuzhe.isCardConditionMet({ index: 5 }, baseIncomeOnlyTotalEightPlayer),
  false,
  "Jiuzhe card 5 should not count company base income toward the 8 income threshold",
);

const eightIncomeIncreasePlayer = {
  id: "player-green",
  color: "green",
  income: { credits: 4, energy: 3, handSize: 2, publicity: 1, availableData: 1, additionalPublicScan: 1 },
  initialSelection: { industry: { label: "层云核心" } },
};
assert.equal(
  jiuzhe.countIncomeIncreases(eightIncomeIncreasePlayer),
  8,
  "income increases should count only values above company base income",
);
assert.equal(
  jiuzhe.isCardConditionMet({ index: 5 }, eightIncomeIncreasePlayer),
  true,
  "Jiuzhe card 5 should score after 8 income increases",
);

assert.equal(
  jiuzhe.isCardConditionMet({ index: 1 }, white, {
    alienGameState: alienState,
    planetStatsState: { planets: {} },
    nebulaDataState: { sectorSettlements: { winsByPlayerId: {} } },
    plutoMarkers: [
      { kind: "orbit", planetId: "pluto", playerId: "player-white" },
      { kind: "land", planetId: "pluto", playerId: "player-white", sequence: 1 },
      { kind: "land", planetId: "pluto", playerId: "player-white", sequence: 2 },
    ],
  }),
  true,
  "Pluto markers should count for same-planet orbit/land Jiuzhe conditions",
);

{
  const progressPlayer = {
    id: "player-progress",
    color: "green",
    income: {
      credits: 4,
      energy: 3,
      handSize: 2,
      publicity: 1,
      availableData: 1,
      additionalPublicScan: 1,
    },
    techState: {
      ownedTiles: {
        purple1: true,
        purple2: true,
        purple3: true,
        blue1: true,
        blue2: true,
        orange1: true,
        orange2: true,
        orange3: true,
      },
    },
    completedTaskCount: 5,
  };
  const progressAlienState = state.createDefaultAlienState();
  progressAlienState.aliens[1].assignedAlienId = jiuzhe.ALIEN_ID;
  progressAlienState.aliens[1].alienId = jiuzhe.ALIEN_ID;
  progressAlienState.aliens[1].revealed = true;
  jiuzhe.ensureJiuzheState(progressAlienState).revealedSlotId = 1;
  for (const position of [1, 2, 3, 4, 5]) {
    assert.equal(
      jiuzhe.placeJiuzheTrace(progressAlienState, 1, "pink", position, progressPlayer).ok,
      true,
    );
  }
  assert.equal(jiuzhe.placeJiuzheTrace(progressAlienState, 1, "yellow", 1, progressPlayer).ok, true);

  progressAlienState.aliens[2].traces.pink = {
    firstPlaced: true,
    ownerPlayerId: progressPlayer.id,
    ownerPlayerColor: progressPlayer.color,
    extraCount: 4,
    extraMarkers: Array.from({ length: 4 }, () => ({
      ownerPlayerId: progressPlayer.id,
      ownerPlayerColor: progressPlayer.color,
    })),
  };
  progressAlienState.aliens[2].traces.yellow = {
    firstPlaced: true,
    ownerPlayerId: progressPlayer.id,
    ownerPlayerColor: progressPlayer.color,
    extraCount: 0,
  };

  const marker = () => ({ playerId: progressPlayer.id, playerColor: progressPlayer.color });
  const progressContext = {
    alienGameState: progressAlienState,
    companyBaseIncome: {
      credits: 2,
      energy: 1,
      handSize: 1,
      publicity: 0,
      availableData: 0,
      additionalPublicScan: 0,
    },
    planetStatsState: {
      planets: {
        mars: { orbitMarkers: [marker(), marker()], landingMarkers: [], satelliteLandings: [] },
        venus: { orbitMarkers: [], landingMarkers: [marker()], satelliteLandings: [marker()] },
      },
    },
    plutoMarkers: [
      { ...marker(), kind: "orbit", planetId: "pluto" },
      { ...marker(), kind: "land", planetId: "pluto", sequence: 1 },
      { ...marker(), kind: "land", planetId: "pluto", sequence: 2 },
    ],
    nebulaDataState: {
      sectorSettlements: {
        winsByPlayerId: {
          [progressPlayer.id]: [
            { sectorId: "sector-2-a" },
            { sectorId: "sector-1-a" },
            { sectorId: "sector-1-b" },
            { sectorId: "sector-4-a" },
            { sectorId: "sector-3-a" },
          ],
        },
      },
    },
  };
  const expectedProgressByCard = new Map([
    [0, 6],
    [1, 3],
    [2, 2],
    [3, 3],
    [4, 2],
    [5, 8],
    [6, 1],
    [7, 4],
    [8, 10],
    [9, 6],
    [10, 3],
    [11, 0],
    [12, 3],
    [13, 5],
    [14, 2],
  ]);

  for (const definition of jiuzhe.CARD_DEFINITIONS) {
    const progress = jiuzhe.getCardConditionProgress(definition, progressPlayer, progressContext);
    assert.ok(progress, `Jiuzhe card ${definition.index} should expose condition progress`);
    assert.equal(progress.current, expectedProgressByCard.get(definition.index));
    assert.equal(progress.target, definition.condition.count);
    assert.equal(progress.remaining, Math.max(0, progress.target - progress.current));
    assert.equal(progress.met, progress.current >= progress.target);
    assert.equal(
      jiuzhe.isCardConditionMet(definition, progressPlayer, progressContext),
      progress.met,
      `Jiuzhe card ${definition.index} condition result should reuse shared progress`,
    );
  }

  const totalIncomeProgress = jiuzhe.getCardConditionProgress({
    index: 99,
    condition: { type: "totalIncome", count: 8 },
  }, progressPlayer, progressContext);
  assert.equal(totalIncomeProgress.current, 8, "legacy totalIncome should share income-increase progress");
  assert.equal(totalIncomeProgress.met, true);
  assert.equal(
    jiuzhe.getCardConditionProgress({ index: 100, condition: { type: "unknown", count: 1 } }, progressPlayer, progressContext),
    null,
    "unsupported Jiuzhe conditions should not invent progress",
  );
}

const revealState = {
  aliens: {
    1: {
      revealed: true,
      assignedAlienId: jiuzhe.ALIEN_ID,
      alienId: jiuzhe.ALIEN_ID,
      traces: {
        pink: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 },
        yellow: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 },
        blue: { firstPlaced: true, ownerPlayerColor: "blue", extraCount: 0 },
      },
    },
  },
};
const blue = { id: "player-blue", color: "blue", resources: { score: 12 } };
const revealResult = jiuzhe.initializeJiuzheReveal(revealState, 1, white, [white, blue], () => 0);
assert.equal(revealResult.ok, true, "Jiuzhe reveal should initialize");
assert.equal(revealResult.freeScoreThreshold, 32, "free threshold should use the current highest score, not the trigger player's score");
assert.equal(revealResult.paidScoreThreshold, 52, "paid threshold should use the current highest score, not the trigger player's score");
assert.equal(jiuzhe.getTraceGrid(revealState, 1), null, "reveal should not prefill Jiuzhe trace grid");
assert.equal(
  jiuzhe.getPlayerJiuzheCards(revealState, white).length,
  5,
  "white should receive 3 base Jiuzhe cards plus 2 first-trace cards",
);
assert.equal(
  jiuzhe.getPlayerJiuzheCards(revealState, blue).length,
  4,
  "blue should receive 3 base Jiuzhe cards plus 1 first-trace card",
);
assert.equal(
  new Set([
    ...jiuzhe.getPlayerJiuzheCards(revealState, white),
    ...jiuzhe.getPlayerJiuzheCards(revealState, blue),
  ].map((card) => card.index)).size,
  9,
  "Jiuzhe reveal deal should not duplicate dealt cards",
);
assert.equal(
  jiuzhe.getPlayerJiuzheState(revealState, white).revealPlaysRemaining,
  2,
  "white should get one reveal play per owned first trace",
);
assert.equal(
  jiuzhe.getPlayerJiuzheState(revealState, blue).revealPlaysRemaining,
  1,
  "blue should get its reveal play by color ownership",
);
assert.equal(
  jiuzhe.getPendingOpportunity(revealState, white).reason,
  "reveal",
  "reveal should create an immediate card play opportunity",
);
assert.equal(jiuzhe.getThreat(revealState, white), 0, "reveal should not add threat from first traces");

console.log("aliens/jiuzhe.test.js ok");
