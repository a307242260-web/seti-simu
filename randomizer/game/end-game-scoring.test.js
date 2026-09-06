const assert = require("node:assert/strict");
const finalScoring = require("./final-scoring");
const endGameScoring = require("./end-game-scoring");
const cardEffects = require("./cards/effects");
const jiuzhe = require("./aliens/jiuzhe");
const fangzhou = require("./aliens/fangzhou");
const banrenma = require("./aliens/banrenma");
const chong = require("./aliens/chong");
const aomomo = require("./aliens/aomomo");
const runezu = require("./aliens/runezu");
const solar = require("../solar-system/core");
const rockets = require("./rockets");

const root = { meta: { sequences: { alienEntity: 1, finalMark: 1 } } };
const nextAlienIdentity = () => ({ sequence: root.meta.sequences.alienEntity++ });
function markTile(state, tileId, targetPlayer, options = {}) {
  return finalScoring.markTile(state, tileId, targetPlayer, { ...options, root });
}

function player(overrides = {}) {
  return {
    id: "player-white",
    color: "white",
    resources: { score: 20 },
    income: { credits: 3, energy: 2, handSize: 2 },
    completedTaskCount: 0,
    reservedCards: [],
    techState: { ownedTiles: {}, blueBoardSlots: {} },
    ...overrides,
  };
}

const state = finalScoring.createFinalScoringState(["a", "b", "c", "d"]);
finalScoring.setTileVariants(state, { a: 1, b: 2, c: 1, d: 2 });

const white = player();
white.resources.score = 25;
const markResult = markTile(state, "a", white, { tokenSrc: "white.png" });
assert.equal(markResult.ok, true);
assert.equal(markResult.mark.slotIndex, 1);

const tileContext = {
  currentPlayer: white,
  finalScoring: state,
  data: { sectorSettlements: { winsByPlayerId: {} }, nebulae: {}, sectorExtraMarks: {} },
  aliens: { aliens: {} },
  planets: { planets: {} },
  cardEffects,
  getCardTypeCode: (card) => cardEffects.getRuntimeCardTypeCode(card, 0),
};

const tileScore = endGameScoring.computePlayerTileScore(state, white, tileContext);
assert.equal(tileScore.total, 15, "a1 with income 3/2 on slot 1 should score 3*5=15");
assert.equal(tileScore.tiles[0].formulaId, "a1");
const tileBreakdown = endGameScoring.computePlayerFinalScore({
  ...tileContext,
  currentPlayer: white,
});
assert.equal(tileBreakdown.tileScoresById.a, 15);
assert.equal(tileBreakdown.tileScoresById.b, 0);

const baseIncomeOnlyPlayer = player({
  income: { credits: 3, energy: 1, handSize: 1 },
});
const huanyuBaseIncome = { credits: 3, energy: 1, handSize: 1 };
const baseIncomeContext = {
  ...tileContext,
  getPlayerCompanyBaseIncome: () => huanyuBaseIncome,
};
assert.equal(
  endGameScoring.getFormulaBaseValue("a1", baseIncomeOnlyPlayer, baseIncomeContext),
  0,
  "a1 should not count company default credit or energy income",
);
assert.equal(
  endGameScoring.getFormulaBaseValue("a2", baseIncomeOnlyPlayer, baseIncomeContext),
  0,
  "a2 should not count company default credit, energy, or blind-draw income",
);

const incomeIncreasePlayer = player({
  resources: { score: 25 },
  income: { credits: 5, energy: 3, handSize: 2 },
});
assert.equal(
  endGameScoring.getIncomeIncreaseValue(incomeIncreasePlayer, "credits", baseIncomeContext),
  2,
  "income increase should be total income minus company default income",
);
assert.equal(
  endGameScoring.getFormulaBaseValue("a1", incomeIncreasePlayer, baseIncomeContext),
  2,
  "a1 should use the larger credit/energy increase after removing company defaults",
);
assert.equal(
  endGameScoring.getFormulaBaseValue("a2", incomeIncreasePlayer, baseIncomeContext),
  1,
  "a2 should use the smallest credit/energy/blind-draw increase after removing company defaults",
);
const incomeIncreaseState = finalScoring.createFinalScoringState(["a"]);
finalScoring.setTileVariants(incomeIncreaseState, { a: 1 });
markTile(incomeIncreaseState, "a", incomeIncreasePlayer, { tokenSrc: "white.png" });
const incomeIncreaseTile = endGameScoring.computePlayerTileScore(incomeIncreaseState, incomeIncreasePlayer, {
  ...baseIncomeContext,
  finalScoring: incomeIncreaseState,
  currentPlayer: incomeIncreasePlayer,
}).tiles[0];
assert.equal(incomeIncreaseTile.baseValue, 2);
assert.equal(incomeIncreaseTile.score, 10, "a1 slot 1 should score income increase 2 * 5");

white.resources.score = 50;
markTile(state, "b", white, { tokenSrc: "white.png" });
const bTile = endGameScoring.computePlayerTileScore(state, white, tileContext).tiles
  .find((entry) => entry.tileId === "b");
assert.equal(bTile.formulaId, "b2");

const disabledTechPlayer = player({
  techState: {
    ownedTiles: { orange1: true, purple1: true, blue1: true, purple2: true },
    disabledTiles: { orange1: true, purple2: true },
    blueBoardSlots: { blue1: 1 },
  },
});
assert.equal(
  endGameScoring.countOwnedTech(disabledTechPlayer, "orange"),
  1,
  "disabled tech still counts as owned for tech-count scoring",
);
assert.equal(endGameScoring.countOwnedTech(disabledTechPlayer, "purple"), 2);
assert.equal(endGameScoring.countTotalOwnedTech(disabledTechPlayer), 4);
assert.equal(endGameScoring.getFormulaBaseValue("d1", disabledTechPlayer, tileContext), 1);
assert.equal(endGameScoring.getFormulaBaseValue("d2", disabledTechPlayer, tileContext), 2);

assert.equal(
  endGameScoring.countPlanetOrbitOrLand(white, { planets: {} }, "pluto", {
    plutoMarkers: [
      { kind: "orbit", planetId: "pluto", playerId: "player-white" },
      { kind: "land", planetId: "pluto", playerId: "player-white" },
    ],
  }),
  2,
  "Pluto orbit/land markers should count as that player's planet markers",
);
assert.equal(
  endGameScoring.countOrbitOrLandMarkers(white, { planets: {} }, {
    plutoMarkers: [
      { kind: "orbit", planetId: "pluto", playerId: "player-white" },
      { kind: "land", planetId: "pluto", playerId: "player-white" },
    ],
  }),
  2,
  "global orbit/land marker count should include Pluto",
);
assert.equal(
  endGameScoring.countPlanetLandingPairs(white, { planets: {} }, 2, {
    plutoMarkers: [
      { kind: "land", planetId: "pluto", playerId: "player-white", sequence: 1 },
      { kind: "land", planetId: "pluto", playerId: "player-white", sequence: 2 },
    ],
  }),
  1,
  "duplicate Pluto landings should count as same-planet landing pairs",
);

const aomomoMarkerState = {
  aliens: {
    1: {
      revealed: true,
      alienId: aomomo.ALIEN_ID,
      assignedAlienId: aomomo.ALIEN_ID,
    },
  },
  aomomo: aomomo.createAomomoState(),
};
aomomo.initializeAomomoReveal(aomomoMarkerState, 1, white, () => 0);
aomomo.addOrbitMarker(aomomoMarkerState, white, nextAlienIdentity());
aomomo.addLandingMarker(aomomoMarkerState, white, nextAlienIdentity());
aomomo.addLandingMarker(aomomoMarkerState, white, nextAlienIdentity());
assert.equal(
  endGameScoring.countPlanetOrbitOrLand(white, { planets: {} }, aomomo.PLANET_ID, {
    aliens: aomomoMarkerState,
  }),
  3,
  "Aomomo panel orbit/land markers should count as that player's planet markers",
);
assert.equal(
  endGameScoring.countOrbitOrLandMarkers(white, { planets: {} }, {
    aliens: aomomoMarkerState,
  }),
  3,
  "global orbit/land marker count should include Aomomo panel markers",
);
assert.equal(
  endGameScoring.countPlanetLandingPairs(white, { planets: {} }, 2, {
    aliens: aomomoMarkerState,
  }),
  1,
  "duplicate Aomomo landings should count as same-planet landing pairs",
);

const slotThreeState = finalScoring.createFinalScoringState(["c"]);
// 访问条件与终局共用标记归属，但访问只认可环绕，不把登陆混入。
{
  const markerState = { planets: { mars: {
    orbitMarkers: [{ playerId: white.id }, { playerId: "other" }],
    landingMarkers: [{ playerId: white.id }], satelliteLandings: [{ playerId: white.id }],
  } } };
  assert.equal(endGameScoring.countPlanetMarkers(white, markerState, "mars", "orbit"), 1);
  assert.equal(endGameScoring.countPlanetMarkers(white, markerState, "mars", "land"), 2);
  assert.equal(endGameScoring.countPlanetOrbitOrLand(white, markerState, "mars"), 3);
  assert.equal(endGameScoring.countPlanetMarkers(white, markerState, "venus", "orbit"), 0);
  const context = { aliens: structuredClone(aomomoMarkerState) };
  const before = JSON.stringify(context);
  const freeze = value => {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  freeze(context);
  assert.equal(endGameScoring.countPlanetMarkers(white, markerState, "aomomo", "orbit", context), 1);
  assert.equal(endGameScoring.countPlanetMarkers(white, markerState, "aomomo", "land", context), 2);
  assert.equal(JSON.stringify(context), before, "奥陌陌标记计数不初始化或修改输入");
  assert.equal(endGameScoring.countPlanetMarkers(white, markerState, "pluto", "orbit", {
    plutoMarkers: [{ playerId: white.id, kind: "land" }, { playerId: white.id, kind: "orbit" }],
  }), 1);
}
finalScoring.setTileVariants(slotThreeState, { c: 1 });
const slotThreePlayer = player({
  id: "player-brown",
  color: "brown",
  completedTaskCount: 10,
  resources: { score: 25 },
});
const slotOnePlayer = player({ id: "player-blue", color: "blue", resources: { score: 25 } });
const slotTwoPlayer = player({ id: "player-green", color: "green", resources: { score: 25 } });
markTile(slotThreeState, "c", slotOnePlayer, { tokenSrc: "blue.png" });
markTile(slotThreeState, "c", slotTwoPlayer, { tokenSrc: "green.png" });
markTile(slotThreeState, "c", slotThreePlayer, { tokenSrc: "brown.png" });
const thirdTile = endGameScoring.computePlayerTileScore(slotThreeState, slotThreePlayer, {
  ...tileContext,
  currentPlayer: slotThreePlayer,
}).tiles.find((entry) => entry.tileId === "c");
assert.equal(thirdTile.slotIndex, 3);
assert.equal(thirdTile.multiplier, 2, "slot 3 should use third-rank multiplier for c1");
assert.equal(thirdTile.score, 20, "10 completed tasks * 2 = 20");

const cardPlayer = player({
  reservedCards: [{ cardId: "b_14.webp" }],
});
const cardContext = {
  ...tileContext,
  currentPlayer: cardPlayer,
  data: {
    sectorSettlements: {
      winsByPlayerId: {
        white: [{ sectorId: "sector-2-b" }, { sectorId: "sector-3-b" }],
      },
    },
    nebulae: {},
    sectorExtraMarks: {},
  },
};
const cardScore = endGameScoring.computePlayerCardScore(cardPlayer, cardContext);
assert.equal(cardScore.total, 6, "two red sector wins on b_14 should score 6");

const signalPlayer = player({
  reservedCards: [{ cardId: "b_45.webp" }],
});
const signalContext = {
  ...tileContext,
  currentPlayer: signalPlayer,
  data: {
    sectorSettlements: { winsByPlayerId: {} },
    nebulae: {
      "sector-1-a": {
        tokens: [{ replacedByPlayerColor: "white" }],
      },
      "sector-2-b": {
        tokens: [{ replacedByPlayerColor: "white" }],
      },
    },
    sectorExtraMarks: {},
  },
};
assert.equal(
  endGameScoring.computePlayerCardScore(signalPlayer, signalContext).total,
  2,
);

const finalScore = endGameScoring.computePlayerFinalScore({
  ...signalContext,
  finalScoring: finalScoring.createFinalScoringState(),
  currentPlayer: player({
    id: "player-final",
    color: "white",
    resources: { score: 10 },
    reservedCards: [{ cardId: "b_45.webp" }],
  }),
});
assert.equal(finalScore.baseScore, 10);
assert.equal(finalScore.cardScore, 2);
assert.equal(finalScore.totalScore, 12);

const jiuzheState = {
  aliens: {
    1: {
      revealed: true,
      alienId: jiuzhe.ALIEN_ID,
      traces: { yellow: {}, pink: {}, blue: {} },
    },
  },
};
jiuzhe.ensureJiuzheState(jiuzheState).revealedSlotId = 1;
const threatPlayerA = player({
  id: "player-a",
  color: "white",
  resources: { score: 100 },
  completedTaskCount: 5,
});
const threatPlayerB = player({
  id: "player-b",
  color: "blue",
  resources: { score: 80 },
});
jiuzhe.dealJiuzheCards(jiuzheState, [threatPlayerA, threatPlayerB], () => 0);
jiuzhe.getPlayerJiuzheCards(jiuzheState, threatPlayerA)[0] = {
  index: 13,
  threat: 4,
  score: 12,
  label: "完成5张任务牌",
  played: true,
};
jiuzhe.addThreat(jiuzheState, threatPlayerA, 4);
jiuzhe.addThreat(jiuzheState, threatPlayerB, 4);
const jiuzheFinal = endGameScoring.computePlayerFinalScore({
  currentPlayer: threatPlayerA,
  players: { players: [threatPlayerA, threatPlayerB] },
  finalScoring: finalScoring.createFinalScoringState(),
  data: { sectorSettlements: { winsByPlayerId: {} }, nebulae: {}, sectorExtraMarks: {} },
  aliens: jiuzheState,
  planets: { planets: {} },
  cardEffects,
  getCardTypeCode: (card) => cardEffects.getRuntimeCardTypeCode(card, 0),
});
assert.equal(jiuzheFinal.jiuzheCardScore, 12);
assert.equal(jiuzheFinal.jiuzhePenaltyApplied, true);
assert.equal(jiuzheFinal.totalScore, Math.ceil(112 * 0.9));
assert.equal(jiuzheFinal.jiuzhePenaltyScore, Math.ceil(112 * 0.9) - 112);
assert.ok(jiuzheFinal.jiuzhePenaltyScore < 0);

const jiuzheNoPenaltyState = {
  aliens: {
    1: {
      revealed: true,
      alienId: jiuzhe.ALIEN_ID,
      traces: { yellow: {}, pink: {}, blue: {} },
    },
  },
};
jiuzhe.ensureJiuzheState(jiuzheNoPenaltyState).revealedSlotId = 1;
const jiuzheNoPenaltyPlayer = player({
  id: "player-jiuzhe-clean",
  color: "white",
  resources: { score: 100 },
  completedTaskCount: 5,
});
jiuzhe.getPlayerJiuzheState(jiuzheNoPenaltyState, jiuzheNoPenaltyPlayer, true).cards = [{
  index: 13,
  threat: 4,
  score: 12,
  label: "完成5张任务牌",
  played: true,
}];
const jiuzheNoPenaltyFinal = endGameScoring.computePlayerFinalScore({
  currentPlayer: jiuzheNoPenaltyPlayer,
  players: [jiuzheNoPenaltyPlayer],
  finalScoring: finalScoring.createFinalScoringState(),
  data: { sectorSettlements: { winsByPlayerId: {} }, nebulae: {}, sectorExtraMarks: {} },
  aliens: jiuzheNoPenaltyState,
  planets: { planets: {} },
  cardEffects,
  getCardTypeCode: (card) => cardEffects.getRuntimeCardTypeCode(card, 0),
});
assert.equal(jiuzheNoPenaltyFinal.jiuzheCardScore, 12);
assert.equal(jiuzheNoPenaltyFinal.jiuzhePenaltyApplied, false);
assert.equal(jiuzheNoPenaltyFinal.totalScore, 112, "completed Jiuzhe cards should add to final total when no threat penalty applies");

const revealedStateTracePlayer = player();
const revealedStateTraceState = {
  aliens: {
    1: {
      revealed: true,
      alienId: fangzhou.ALIEN_ID,
      traces: {
        yellow: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 1 },
        pink: { firstPlaced: false, ownerPlayerColor: null, extraCount: 0 },
        blue: { firstPlaced: false, ownerPlayerColor: null, extraCount: 0 },
      },
    },
  },
  fangzhou: fangzhou.createFangzhouState(),
};
revealedStateTraceState.fangzhou.revealedSlotId = 1;
fangzhou.placeFangzhouTrace(revealedStateTraceState, 1, "yellow", 1, revealedStateTracePlayer, nextAlienIdentity());
assert.equal(
  endGameScoring.countTraceMarkers(revealedStateTracePlayer, revealedStateTraceState, "yellow"),
  3,
  "revealed alien trace count should include state first, state extra, and face markers",
);

const splitExtraOwnerTraceState = {
  aliens: {
    1: {
      traces: {
        pink: {
          firstPlaced: true,
          ownerPlayerColor: "green",
          extraCount: 1,
          extraMarkers: [{ ownerPlayerColor: "white" }],
        },
      },
    },
  },
};
assert.equal(
  endGameScoring.countTraceMarkers({ id: "p-white", color: "white" }, splitExtraOwnerTraceState, "pink"),
  1,
  "extra state trace should score for the gaining player",
);
assert.equal(
  endGameScoring.countTraceMarkers({ id: "p-green", color: "green" }, splitExtraOwnerTraceState, "pink"),
  1,
  "first state trace should score for the first owner",
);

const banrenmaTracePlayer = player({ resources: { score: 25, availableData: 10 } });
const banrenmaTraceState = {
  aliens: {
    1: {
      revealed: true,
      alienId: banrenma.ALIEN_ID,
      assignedAlienId: banrenma.ALIEN_ID,
      traces: {
        yellow: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 1 },
        pink: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 },
        blue: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 },
      },
    },
  },
  banrenma: banrenma.createBanrenmaState(),
};
banrenma.initializeBanrenmaReveal(
  banrenmaTraceState,
  1,
  banrenmaTracePlayer,
  [banrenmaTracePlayer],
  () => 0,
  { takeSequence: () => nextAlienIdentity().sequence },
);
banrenma.placeBanrenmaTrace(banrenmaTraceState, 1, "yellow", 1, banrenmaTracePlayer, nextAlienIdentity());
banrenma.placeBanrenmaTrace(banrenmaTraceState, 1, "yellow", 1, banrenmaTracePlayer, nextAlienIdentity());
banrenma.placeBanrenmaTrace(banrenmaTraceState, 1, "yellow", 4, banrenmaTracePlayer, nextAlienIdentity());
banrenma.placeBanrenmaTrace(banrenmaTraceState, 1, "pink", 1, banrenmaTracePlayer, nextAlienIdentity());
banrenma.placeBanrenmaTrace(banrenmaTraceState, 1, "blue", 2, banrenmaTracePlayer, nextAlienIdentity());
assert.equal(
  endGameScoring.countTraceMarkers(banrenmaTracePlayer, banrenmaTraceState, "yellow"),
  5,
  "Banrenma trace count should include state first, state extra, stacked face position 1, and face grid slots",
);
assert.equal(
  endGameScoring.getFormulaBaseValue("b1", banrenmaTracePlayer, {
    ...tileContext,
    aliens: banrenmaTraceState,
  }),
  2,
  "b1 should use all state and revealed-face trace markers when taking the minimum color count",
);
const banrenmaB1State = finalScoring.createFinalScoringState(["b"]);
finalScoring.setTileVariants(banrenmaB1State, { b: 1 });
markTile(banrenmaB1State, "b", banrenmaTracePlayer, { tokenSrc: "white.png" });
const banrenmaB1Tile = endGameScoring.computePlayerTileScore(banrenmaB1State, banrenmaTracePlayer, {
  ...tileContext,
  finalScoring: banrenmaB1State,
  currentPlayer: banrenmaTracePlayer,
  aliens: banrenmaTraceState,
}).tiles.find((entry) => entry.tileId === "b");
assert.equal(banrenmaB1Tile.baseValue, 2);
assert.equal(banrenmaB1Tile.score, 16, "b1 slot 1 should score minimum trace count 2 * 8");

const aomomoSharedTraceState = {
  aliens: {
    1: {
      revealed: true,
      alienId: aomomo.ALIEN_ID,
      assignedAlienId: aomomo.ALIEN_ID,
      traces: {
        yellow: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 1 },
      },
    },
  },
  aomomo: aomomo.createAomomoState(),
};
aomomo.initializeAomomoReveal(aomomoSharedTraceState, 1, white, () => 0);
aomomo.placeAomomoTrace(aomomoSharedTraceState, 1, "yellow", 1, white, nextAlienIdentity());
aomomo.placeAomomoTrace(aomomoSharedTraceState, 1, "yellow", 1, white, nextAlienIdentity());
aomomo.placeAomomoTrace(aomomoSharedTraceState, 1, "yellow", 4, white, nextAlienIdentity());
assert.equal(
  endGameScoring.countTraceMarkers(white, aomomoSharedTraceState, "yellow"),
  5,
  "shared trace count should include stacked Aomomo face traces plus state traces",
);

const runezuSharedTraceState = {
  aliens: {
    1: {
      revealed: true,
      alienId: runezu.ALIEN_ID,
      assignedAlienId: runezu.ALIEN_ID,
      traces: {
        yellow: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 1 },
      },
    },
  },
  runezu: runezu.createRunezuState(),
};
runezu.initializeRunezuReveal(runezuSharedTraceState, 1, white, { random: () => 0, techTileIds: [] });
runezu.placeRunezuTrace(runezuSharedTraceState, 1, "yellow", 1, white, nextAlienIdentity());
runezu.placeRunezuTrace(runezuSharedTraceState, 1, "yellow", 1, white, nextAlienIdentity());
runezu.placeRunezuTrace(runezuSharedTraceState, 1, "yellow", 4, white, nextAlienIdentity());
assert.equal(
  endGameScoring.countTraceMarkers(white, runezuSharedTraceState, "yellow"),
  5,
  "shared trace count should include stacked Runezu face traces plus state traces",
);

assert.equal(finalScoring.getTileVariant(state, "a"), 1);
assert.equal(finalScoring.getTileVariant(state, "b"), 2);
const randomized = finalScoring.randomizeTileVariants(finalScoring.createFinalScoringState(), ["a", "b"], () => 0.9);
assert.equal(randomized.a, 2);
assert.equal(randomized.b, 2);

assert.ok(cardEffects.getCardModel("b_14.webp"));
assert.equal(cardEffects.getCardModel("b_14.webp").endGameScoring.scorePer, 3);
assert.ok(cardEffects.getCardModel("b_34.webp"));
assert.equal(cardEffects.getCardModel("b_34.webp").endGameScoring.planetId, "jupiter");

const chongState = {
  aliens: {
    2: {
      revealed: true,
      alienId: chong.ALIEN_ID,
      traces: { yellow: {}, pink: {}, blue: {} },
    },
  },
  chong: chong.createChongState(),
};
chong.initializeChongReveal(chongState, 2, white, () => 0);
chong.placeChongTrace(chongState, 2, "pink", 1, white, nextAlienIdentity());
chong.placeChongTrace(chongState, 2, "yellow", 1, white, nextAlienIdentity());
chong.placeChongTrace(chongState, 2, "blue", 7, white, nextAlienIdentity());
const chongPlayer = player({
  reservedCards: [chong.createAlienCard(2, 1)],
});
const chongScore = endGameScoring.computePlayerCardScore(chongPlayer, {
  ...tileContext,
  currentPlayer: chongPlayer,
  aliens: chongState,
  getCardTypeCode: (card) => card.cardTypeCode,
});
assert.equal(chongScore.total, 3, "生态系统研究 should score 1 per owned Chong trace");

const aomomoState = {
  aliens: {
    1: {
      revealed: true,
      alienId: aomomo.ALIEN_ID,
      assignedAlienId: aomomo.ALIEN_ID,
      traces: {
        yellow: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 1 },
        pink: { firstPlaced: false, ownerPlayerColor: null, extraCount: 0 },
        blue: { firstPlaced: false, ownerPlayerColor: null, extraCount: 0 },
      },
    },
  },
  aomomo: aomomo.createAomomoState(),
};
aomomo.initializeAomomoReveal(aomomoState, 1, white, () => 0);
aomomo.placeAomomoTrace(aomomoState, 1, "blue", 2, white, nextAlienIdentity());
const aomomoPlayer = player({
  reservedCards: [aomomo.createAlienCard(8, 1)],
});
const aomomoScore = endGameScoring.computePlayerCardScore(aomomoPlayer, {
  ...tileContext,
  currentPlayer: aomomoPlayer,
  aliens: aomomoState,
  getCardTypeCode: (card) => card.cardTypeCode,
});
assert.equal(aomomoScore.total, 3, "奥陌陌8 should score state first, state extra, and face traces");

const marsCardPlayer = player({
  reservedCards: [{ cardId: "b_74.webp", cardTypeCode: 3 }],
});
assert.equal(endGameScoring.computePlayerCardScore(marsCardPlayer, {
  ...tileContext,
  currentPlayer: marsCardPlayer,
  planets: {
    planets: {
      mars: {
        orbitMarkers: [{ playerId: "player-white" }],
        landingMarkers: [{ playerId: "player-white" }],
        satelliteLandings: [{ playerId: "player-white" }],
      },
    },
  },
}).total, 12);

const asteroidFinalPlayer = player({
  reservedCards: [{ cardId: "b_82.webp", cardTypeCode: 3 }],
});
const asteroidBoard = solar.createBaselineState();
const asteroidCoordinate = solar.collectVisibleCoordinateContents(asteroidBoard).find(c => c.content.kind === "asteroid");
assert.equal(endGameScoring.computePlayerCardScore(asteroidFinalPlayer, {
  ...tileContext,
  currentPlayer: asteroidFinalPlayer,
  solarSystem: asteroidBoard,
  pieces: { rockets: [{ id: "asteroid-probe", playerId: "player-white", color: "white",
    sectorX: asteroidCoordinate.x, sectorY: asteroidCoordinate.y }] },
}).total, 13, "正式位置计分不得依赖调用方手工注入位置索引");

for (const rotation of [asteroidBoard.rotation, solar.applySolarOrbitRotation(asteroidBoard.rotation)]) {
  const board = { ...asteroidBoard, rotation };
  for (const cell of solar.collectVisibleCoordinateContents(board).filter(c => c.y >= 1 && c.y <= 4)) {
    const probe = { id: "position-score", playerId: "player-white", color: "white", sectorX: cell.x, sectorY: cell.y };
    const context = { solarSystem: board, pieces: { rockets: [probe] },
      probeLocations: { "player-white": ["asteroid"] } };
    const score = () => endGameScoring.computePlayerCardScore(asteroidFinalPlayer, context).total;
    assert.equal(score(), cell.content.kind === "asteroid" ? 13 : 0, "伪造旧索引不能覆盖当前旋转盘面");
    probe.playerId = "player-blue"; probe.color = "blue";
    assert.equal(score(), 0, "不能借用对手探测器计分");
    probe.playerId = "player-white"; probe.color = "white"; probe.kind = rockets.ROCKET_KIND.CHONG_FOSSIL;
    assert.equal(score(), 0, "化石不属于普通探测器位置计分");
    probe.kind = rockets.ROCKET_KIND.STANDARD; probe.surface = "planet-reference";
    assert.equal(score(), 0, "参考图标记不属于太阳系探测器");
  }
}
assert.throws(() => endGameScoring.computePlayerCardScore(asteroidFinalPlayer, {}), /位置计分缺少/, "缺少必需盘面不能静默计0分");

// 执行真正的UMD计分模块，验证无require且rockets稍后装入的浏览器加载语义。
const browserScoringScope = {};
require("node:vm").runInNewContext(require("node:fs").readFileSync(require.resolve("./end-game-scoring"), "utf8"), browserScoringScope);
const browserPositionContext = { solarSystem: asteroidBoard,
  pieces: { rockets: [{ playerId: "player-white", sectorX: asteroidCoordinate.x, sectorY: asteroidCoordinate.y }] } };
assert.throws(() => browserScoringScope.SetiEndGameScoring.computePlayerCardScore(asteroidFinalPlayer, browserPositionContext), /缺少 SetiRocketActions/);
browserScoringScope.SetiRocketActions = rockets;
assert.equal(browserScoringScope.SetiEndGameScoring.computePlayerCardScore(asteroidFinalPlayer, browserPositionContext).total, 13);

const blueBlackPlayer = player({
  reservedCards: [
    { cardId: "b_100.webp", cardTypeCode: 3 },
    { cardId: "b_128.webp", cardTypeCode: 3 },
  ],
});
assert.equal(endGameScoring.computePlayerCardScore(blueBlackPlayer, {
  ...tileContext,
  currentPlayer: blueBlackPlayer,
  data: {
    sectorSettlements: {
      winsByPlayerId: {
        white: [{ sectorId: "sector-2-a" }, { sectorId: "sector-1-a" }, { sectorId: "sector-1-b" }],
      },
    },
    nebulae: {},
    sectorExtraMarks: {},
  },
}).total, 9);

const unmarkedState = finalScoring.createFinalScoringState(["c"]);
finalScoring.setTileVariants(unmarkedState, { c: 1 });
const unmarkedPlayer = player({
  completedTaskCount: 10,
  reservedCards: [{ cardId: "b_115.webp", cardTypeCode: 3 }],
});
assert.equal(endGameScoring.computePlayerCardScore(unmarkedPlayer, {
  ...tileContext,
  currentPlayer: unmarkedPlayer,
  finalScoring: unmarkedState,
}).total, 29);

const dlcResourcePlayer = player({
  resources: { score: 0, availableData: 4, publicity: 7 },
  reservedCards: [
    { cardId: "dlc_8.png", cardTypeCode: 3 },
    { cardId: "dlc_10.png", cardTypeCode: 3 },
  ],
});
assert.equal(endGameScoring.computePlayerCardScore(dlcResourcePlayer, {
  ...tileContext,
  currentPlayer: dlcResourcePlayer,
}).total, 19);

const dlcLandingPlayer = player({
  reservedCards: [{ cardId: "dlc_31.png", cardTypeCode: 3 }],
});
assert.equal(endGameScoring.computePlayerCardScore(dlcLandingPlayer, {
  ...tileContext,
  currentPlayer: dlcLandingPlayer,
  planets: {
    planets: {
      mars: {
        orbitMarkers: [],
        landingMarkers: [{ playerId: "player-white" }, { playerId: "player-white" }],
        satelliteLandings: [{ playerId: "player-white" }],
      },
      venus: {
        orbitMarkers: [],
        landingMarkers: [{ playerId: "player-white" }],
        satelliteLandings: [],
      },
    },
  },
}).total, 6);

const dlcGrandTourPlayer = player({
  reservedCards: [{ cardId: "dlc_39.png", cardTypeCode: 3 }],
});
assert.equal(endGameScoring.computePlayerCardScore(dlcGrandTourPlayer, {
  ...tileContext,
  currentPlayer: dlcGrandTourPlayer,
  planets: {
    planets: {
      mars: {
        orbitMarkers: [{ playerId: "player-white" }],
        landingMarkers: [{ playerId: "player-white" }],
        satelliteLandings: [{ playerId: "player-white" }],
      },
      jupiter: {
        orbitMarkers: [{ color: "white" }],
        landingMarkers: [],
        satelliteLandings: [],
      },
    },
  },
}).total, 8);

console.log("end-game-scoring tests passed");
