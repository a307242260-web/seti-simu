"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const stateApi = require("../../game/state/state-store");
const projectionApi = require("./projection-adapter");
const residentProjectionApi = require("./resident-projection");
const finalReadModelApi = require("../../game/final-read-model");
const browserReadModelApi = require("../../game/browser-read-model");
const viewStateApi = require("./view-state-store");
const inputApi = require("./input-adapter");
const actionInteractionApi = require("../action-interaction-runtime");

function deepFreeze(value) {
  if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function createFinalReadModel() {
  return {
    schemaVersion: "seti-final-read-model-v1",
    turn: {
      roundNumber: 2, turnNumber: 3, displayedTurnNumber: 3, actionCycleNumber: 1, currentPlayerId: "p1",
      activePlayerIds: ["p1"], passedPlayerIds: [], completedTurnPlayerIds: [],
      gameEnded: false, gameEndReason: null,
    },
    players: [{
      id: "p1", color: "blue", colorLabel: "蓝色", name: "一号", score: 12, publicity: 0,
      industryId: null, industryLabel: null, passed: false, scoreSources: {},
      metrics: {
        completedTaskCount: 0, reservedTaskCount: 0, handTaskCount: 0, type3Reserved: 0,
        type3InHand: 0, traceCounts: { yellow: 0, pink: 0, blue: 0 },
        techCounts: { orange: 0, purple: 0, blue: 0 }, orbitLandCount: 0, sectorWins: 0,
      },
      breakdown: { totalScore: 12, baseScore: 12 },
    }],
    finalBoard: {
      thresholds: [25, 50, 70],
      tiles: { a: { id: "a", variant: 1, marks: [] } },
      formulaMultipliers: { a1: { 1: 5, 2: 4, 3: 3 } },
      pendingByPlayerId: { p1: [{ id: "pending-1", playerId: "p1", threshold: 25 }] },
      claimedThresholdsByPlayerId: { p1: [] },
      markedTileIdsByPlayerId: { p1: [] },
      legalTilesByPlayerId: { p1: { a: { ok: true, reason: null, slotIndex: 1 } } },
    },
    candidatesByPlayerId: {
      p1: {
        a: {
          tileId: "a", variant: 1, formulaId: "a1", available: true, reason: null,
          slotIndex: 1, baseValue: 2, multiplier: 5, immediateScore: 10,
        },
      },
    },
    revealFlags: { jiuzhe: false, runezu: false },
  };
}

function createProjectionWithFinalReadModel() {
  const browserReadModelOwner = browserReadModelApi.createBrowserReadModelOwner({
    solar: {
      createSolarSnapshot: () => ({
        planetLocations: [{ planetId: "earth", x: 0, y: 4 }],
        visibleContents: [],
      }),
    },
    aliens: {
      ALIEN_SLOT_IDS: [1, 2],
      getAlienSlot: (alienState, slotId) => alienState?.slots?.[slotId] || null,
      JIUZHE_ALIEN_ID: "jiuzhe",
    },
    tech: {
      isSupplySelectionActive: (ui) => Boolean(ui?.techSelectionActive),
      listTakeableTiles: () => ["blue1"],
    },
  });
  return projectionApi.createBrowserProjectionAdapter({
    stateStore: stateApi.createStateStore(createState()),
    visibilityPolicy(state, viewer, context) {
      const visible = projectionApi.defaultVisibilityPolicy(state, viewer, context);
      const presentationPlayers = visible.resident.players.players;
      visible.resident = {
        finalReadModel: createFinalReadModel(),
        browserReadModel: browserReadModelOwner.project(state, {
          viewer,
          presentationPlayers,
          presentationState: {
            match: visible.match,
            turn: visible.resident.turn,
            players: visible.resident.players,
            solarSystem: visible.resident.solar,
            pieces: visible.resident.pieces,
            planets: visible.resident.planets,
            data: visible.resident.data,
            cards: visible.resident.cards,
            tech: visible.resident.tech,
            aliens: visible.resident.aliens,
            finalScoring: visible.resident.finalScoring,
            effectPresentation: visible.resident.effectPresentation,
          },
        }),
      };
      return visible;
    },
  }).projectCommitted({
    viewer: { viewerId: "viewer-p1", playerId: "p1", role: "player" },
  });
}

(function testFinalReadModelOwnerDerivesFrozenNarrowRuleResultsWithoutMutatingState() {
  const state = structuredClone(createState());
  state.turn = {
    roundNumber: 2, turnNumber: 3, actionCycleNumber: 4, currentPlayerId: "p1",
    activePlayerIds: ["p1"], passedPlayerIds: [], completedTurnPlayerIds: [],
  };
  state.players = {
    currentPlayerId: "p1",
    players: [{
      id: "p1", color: "blue", colorLabel: "蓝色", resources: { score: 25, publicity: 1 },
      hand: [], reservedCards: [], completedTaskCount: 0, scoreSources: { scanScore: 3 },
    }],
  };
  state.finalScoring = {
    thresholds: [25, 50, 70],
    tiles: Object.fromEntries(["a", "b", "c", "d"].map((id) => [id, { id, marks: [] }])),
    pendingMarks: [{ id: "pending-p1-25", playerId: "p1", threshold: 25 }],
    tileVariants: { a: 1, b: 1, c: 1, d: 1 },
  };
  const before = structuredClone(state);
  const finalScoring = {
    FINAL_SCORE_THRESHOLDS: [25, 50, 70],
    getPendingMarksForPlayer: (finalState, playerId) => (
      finalState.pendingMarks.filter((entry) => entry.playerId === playerId)
    ),
    listMarks: (finalState) => Object.values(finalState.tiles).flatMap((tile) => tile.marks),
    canMarkTile: () => ({ ok: true, slotIndex: 1 }),
    getTileVariant: (finalState, tileId) => finalState.tileVariants[tileId],
    getNextSlotIndex: () => 1,
  };
  const endGameScoring = {
    computePlayerFinalScore: ({ currentPlayer }) => ({
      totalScore: currentPlayer.resources.score + 10,
      baseScore: currentPlayer.resources.score,
    }),
    countTraceMarkers: () => 0,
    countOwnedTech: () => 0,
    countType3Cards: () => 0,
    countOrbitOrLandMarkers: () => 0,
    countSectorWins: () => 0,
    getFormulaId: (tileId, variant) => `${tileId}${variant}`,
    getFormulaBaseValue: () => 2,
    getSlotMultiplier: () => 5,
  };
  const readModel = finalReadModelApi.createFinalReadModelOwner({
    finalScoring,
    endGameScoring,
    cardEffects: { getCardModel: () => null },
    getCardTypeCode: () => 0,
  }).project(state);

  assert.equal(readModel.players[0].breakdown.totalScore, 35);
  assert.equal(readModel.candidatesByPlayerId.p1.a.immediateScore, 10);
  assert.equal(readModel.finalBoard.legalTilesByPlayerId.p1.a.ok, true);
  assert.equal(Object.hasOwn(readModel, "pieces"), false);
  assert.equal(Object.hasOwn(readModel, "finalScoringState"), false);
  assert.deepEqual(state, before);
  assert.equal(Object.isFrozen(readModel.candidatesByPlayerId.p1.a), true);
  assert.throws(() => { readModel.players[0].score = 999; }, TypeError);
})();

(function testFinalLogAndRecoveryBrowserRuntimesHaveNoLegacyReadoutOrRuleRecomputePath() {
  const files = [
    "../final-ui-runtime.js",
    "../action-log-runtime.js",
    "../action-log-export.js",
    "../game-recovery.js",
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.equal(/projection\.scoring/.test(source), false, file);
  }
  const finalUiSource = fs.readFileSync(path.join(__dirname, "../final-ui-runtime.js"), "utf8");
  assert.equal(/\bendGameScoring\b|computePlayerFinalScoreBreakdown/.test(finalUiSource), false);
})();

function createState() {
  return stateApi.createCommittedGameState({
    gameId: "seti-73",
    rulesetVersion: "prototype-2026-07",
    seed: 73,
    rngState: { secretCanary: "HIDDEN_RNG_CANARY" },
    sequences: {},
    match: { status: "playing", debugCanary: "HIDDEN_MATCH_CANARY" },
    turn: { round: 2, turn: 3, currentPlayerId: "p1" },
    players: {
      p1: { id: "p1", name: "一号", resources: { credits: 5 }, privateGoal: "OWN_GOAL" },
      p2: { id: "p2", name: "二号", resources: { credits: 4 }, privateGoal: "OPPONENT_GOAL_CANARY" },
    },
    solarSystem: { rotation: 2, secretCanary: "HIDDEN_BOARD_CANARY" },
    pieces: {},
    planets: {},
    data: {},
    cards: {
      deck: ["DECK_ORDER_CANARY", "c3"],
      hands: { p1: ["own-card"], p2: ["OPPONENT_HAND_CANARY"] },
      reserved: { p1: ["own-reserved"], p2: ["OPPONENT_RESERVED_CANARY"] },
      market: ["public-card"],
      discard: ["discarded-card"],
    },
    tech: { supply: { orange: ["orange-1"] }, secretCanary: "HIDDEN_TECH_CANARY" },
    aliens: { revealed: ["species-1"], secretCanary: "HIDDEN_ALIEN_CANARY" },
    finalScoring: { tiles: ["a"] },
  });
}

(function testRenderBuilderOnlyReceivesFrozenViewerSafePresentation() {
  const state = structuredClone(createState());
  const before = JSON.stringify(state);
  const owner = browserReadModelApi.createBrowserReadModelOwner({
    solar: {
      createSolarSnapshot: () => ({ planetLocations: [], visibleContents: [] }),
    },
    aliens: {
      ALIEN_SLOT_IDS: [],
      getAlienSlot: () => null,
    },
    tech: {
      isSupplySelectionActive: () => false,
      listTakeableTiles: () => [],
    },
  });
  const presentationPlayers = [{
    id: "p1", name: "一号", resources: { credits: 5 }, hand: ["own-card"],
  }];
  const presentationState = {
    match: { status: "playing" },
    turn: { roundNumber: 2, turnNumber: 3, currentPlayerId: "p1" },
    players: { currentPlayerId: "p1", players: presentationPlayers },
    cards: { ui: {} },
  };
  assert.throws(
    () => owner.project(state, {
      presentationState,
      presentationPlayers,
      createRenderPresentation(input) {
        assert.equal(Object.isFrozen(input.state), true);
        assert.equal(Object.isFrozen(input.players), true);
        const serialized = JSON.stringify(input);
        assert.equal(serialized.includes("DECK_ORDER_CANARY"), false);
        assert.equal(serialized.includes("OPPONENT_HAND_CANARY"), false);
        input.state.match.status = "poison";
        return {};
      },
    }),
    TypeError,
  );
  assert.equal(JSON.stringify(state), before, "renderer 异常不得改写 canonical bytes");
})();

(function testCommittedProjectionIsDefaultDenyFrozenAndIsolated() {
  const store = stateApi.createStateStore(createState());
  let snapshotCalls = 0;
  const stateStore = {
    getSnapshot() {
      snapshotCalls += 1;
      return store.getSnapshot();
    },
  };
  const actions = [{
    schemaVersion: "seti-standard-action-v1",
    actionId: "pass:1",
    family: "pass",
    phase: "main",
    actorId: "p1",
    stateVersion: 0,
    decisionVersion: null,
    target: null,
    payload: {},
    summary: "PASS",
  }];
  const adapter = projectionApi.createBrowserProjectionAdapter({
    stateStore,
    actionAdapter: { enumerate: () => actions },
  });
  const projection = adapter.projectCommitted({
    viewer: { viewerId: "viewer-p1", playerId: "p1", role: "player" },
  });
  assert.equal(snapshotCalls, 1);
  assert.equal(projection.schemaVersion, "seti-browser-host-v1");
  assert.equal(projection.source.kind, "committed");
  assert.equal(projection.source.stateVersion, 0);
  assert.deepEqual(projection.cards.hand, ["own-card"]);
  assert.deepEqual(projection.cards.opponentCounts.p2, { hand: 1, reserved: 1 });
  assert.equal(projection.players.p1.privateGoal, "OWN_GOAL");
  assert.equal(Object.hasOwn(projection.players.p2, "privateGoal"), false);
  assert.equal(projection.cards.deckCount, 2);
  const json = JSON.stringify(projection);
  for (const canary of [
    "HIDDEN_RNG_CANARY", "HIDDEN_MATCH_CANARY", "HIDDEN_BOARD_CANARY", "DECK_ORDER_CANARY",
    "OPPONENT_HAND_CANARY", "OPPONENT_RESERVED_CANARY", "OPPONENT_GOAL_CANARY",
    "HIDDEN_TECH_CANARY", "HIDDEN_ALIEN_CANARY",
  ]) assert.equal(json.includes(canary), false, canary);
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.players.p1.resources), true);
  assert.throws(() => { projection.players.p1.resources.credits = 99; }, TypeError);
  assert.equal(store.getSnapshot().players.p1.resources.credits, 5);
  assert.equal(adapter.projectCommitted({
    viewer: { viewerId: "viewer-p1", playerId: "p1", role: "player" },
  }).players.p1.resources.credits, 5);
})();

(function testRuntimeSelectorsAcceptOnlyCanonicalFrozenBrowserProjection() {
  const projection = createProjectionWithFinalReadModel();
  const finalUi = residentProjectionApi.selectFinalUiProjection(projection);
  const finalAi = residentProjectionApi.selectFinalScoreAiProjection(projection);
  const actionLog = residentProjectionApi.selectActionLogProjection(projection);
  const recovery = residentProjectionApi.selectRecoveryProjection(projection);

  assert.equal(finalUi.schemaVersion, "seti-final-ui-projection-v1");
  assert.equal(finalUi.players[0].id, "p1");
  assert.equal(finalAi.schemaVersion, "seti-final-score-ai-projection-v1");
  assert.equal(finalAi.candidatesByPlayerId.p1.a.immediateScore, 10);
  assert.deepEqual(
    { roundNumber: actionLog.roundNumber, turnNumber: actionLog.turnNumber, currentPlayerId: actionLog.currentPlayerId },
    { roundNumber: 2, turnNumber: 3, currentPlayerId: "p1" },
  );
  assert.equal(recovery.schemaVersion, "seti-recovery-projection-v1");
  assert.equal(Object.isFrozen(finalUi.finalBoard.tiles), true);
  assert.throws(() => { finalAi.candidatesByPlayerId.p1.a.immediateScore = 999; }, TypeError);

  const forged = Object.freeze({ ...projection, ruleRoot: {} });
  assert.throws(
    () => residentProjectionApi.selectActionLogProjection(forged),
    /字段不匹配/,
  );
  const mutable = structuredClone(projection);
  assert.throws(
    () => residentProjectionApi.selectRecoveryProjection(mutable),
    /必须深冻结/,
  );
  const missing = Object.freeze(Object.fromEntries(
    Object.entries(projection).filter(([key]) => key !== "resident"),
  ));
  assert.throws(
    () => residentProjectionApi.selectFinalUiProjection(missing),
    /字段不匹配/,
  );
  const forgedCandidate = structuredClone(projection);
  forgedCandidate.resident.finalReadModel.candidatesByPlayerId.p1.a.ruleRoot = {};
  assert.throws(
    () => residentProjectionApi.selectFinalScoreAiProjection(deepFreeze(forgedCandidate)),
    /字段不匹配/,
  );
  const withoutReadModel = structuredClone(projection);
  delete withoutReadModel.resident.finalReadModel;
  assert.throws(
    () => residentProjectionApi.selectFinalUiProjection(deepFreeze(withoutReadModel)),
    /缺少 seti-final-read-model-v1/,
  );
})();

(function testBoardEventRenderAndTurnSelectorsAreFrozenNarrowDtos() {
  const projection = createProjectionWithFinalReadModel();
  const events = residentProjectionApi.selectEventsProjection(projection);
  const actionInteraction = residentProjectionApi.selectActionInteractionProjection(projection);
  const turn = residentProjectionApi.selectTurnFlowProjection(projection);
  const board = residentProjectionApi.selectBoardCoordinateProjection(projection);
  const render = residentProjectionApi.selectRenderProjection(projection);
  const playerTurn = residentProjectionApi.selectPlayerTurnProjection(projection);
  const effectPresentation = residentProjectionApi.selectEffectPresentation(projection);
  const cardUi = residentProjectionApi.selectCardUiProjection(projection);
  const solarBriefing = residentProjectionApi.selectSolarBriefingProjection(projection);
  const alienBoard = residentProjectionApi.selectAlienBoardProjection(projection);

  assert.deepEqual(Object.keys(actionInteraction).sort(), [
    "activeRocketId", "identity", "industryBorrowMode", "schemaVersion",
  ]);
  assert.equal(turn.displayedTurnNumber, 2);
  assert.deepEqual(turn.roundOrderPlayerIds, []);
  assert.deepEqual(board.planetLocations, [{ planetId: "earth", x: 0, y: 4 }]);
  assert.deepEqual(events.clickableTechTileIds, []);
  assert.equal(events.aomomoRevealedSlotId, null);
  assert.equal(Object.hasOwn(render, "solar"), false);
  assert.equal(Object.hasOwn(render, "players"), false);
  assert.equal(Object.hasOwn(render, "pieces"), false);
  assert.deepEqual(Object.keys(render.dataPresentation).sort(), [
    "aomomoTokens", "blueDropZones", "playerTokens", "sectorTokensBySectorId",
  ]);
  assert.deepEqual(Object.keys(render.markerPresentation).sort(), [
    "anomalies", "planetFossils", "runezuSymbols",
  ]);
  assert.equal(playerTurn.schemaVersion, "seti-player-turn-projection-v1");
  assert.equal(playerTurn.value.players.players.some((player) => player.privateGoal === "OPPONENT_GOAL_CANARY"), false);
  assert.equal(effectPresentation.schemaVersion, "seti-effect-presentation-v1");
  assert.equal(cardUi.schemaVersion, "seti-card-ui-projection-v1");
  assert.equal(solarBriefing.schemaVersion, "seti-solar-briefing-projection-v1");
  assert.equal(alienBoard.schemaVersion, "seti-alien-board-projection-v1");
  for (const dto of [
    events, actionInteraction, turn, board, render,
    playerTurn, effectPresentation, cardUi, solarBriefing, alienBoard,
  ]) {
    assert.equal(Object.isFrozen(dto), true);
    assert.equal(JSON.stringify(dto).includes("ruleRoot"), false);
    assert.equal(JSON.stringify(dto).includes("OPPONENT_HAND_CANARY"), false);
  }

  assert.throws(
    () => residentProjectionApi.assertTurnFlowProjection(Object.freeze({ ...turn, forged: true })),
    /字段不匹配/,
  );
  assert.throws(
    () => residentProjectionApi.assertEventsProjection(Object.freeze({ ...events, forged: true })),
    /字段不匹配/,
  );
  const missingEventField = structuredClone(events);
  delete missingEventField.aomomoRevealedSlotId;
  assert.throws(
    () => residentProjectionApi.assertEventsProjection(deepFreeze(missingEventField)),
    /字段不匹配/,
  );
  assert.throws(
    () => residentProjectionApi.assertRenderProjection(structuredClone(render)),
    /必须深冻结/,
  );
  const forgedRender = structuredClone(projection);
  forgedRender.resident.browserReadModel.render.boardChrome.solarState = {};
  assert.throws(
    () => residentProjectionApi.selectRenderProjection(deepFreeze(forgedRender)),
    /字段不匹配/,
  );
  const missingRenderField = structuredClone(projection);
  delete missingRenderField.resident.browserReadModel.render.dataPresentation.playerTokens;
  assert.throws(
    () => residentProjectionApi.selectRenderProjection(deepFreeze(missingRenderField)),
    /字段不匹配/,
  );

  const renderSource = fs.readFileSync(path.join(__dirname, "../render-runtime.js"), "utf8");
  const renderOwnerBody = renderSource.slice(
    renderSource.indexOf("function createRenderRuntime"),
    renderSource.indexOf("return {", renderSource.indexOf("function createRenderRuntime")),
  );
  assert.equal(
    /\b(?:solar|players|rocketActions|planetStats|endGameScoring|finalScoring|data|aliens|jiuzhe|chong|aomomo|runezu|industry|tech)\./
      .test(renderOwnerBody),
    false,
  );
})();

(function testPrimaryActionUiOnlyPresentsAndSubmitsCompositionDescriptors() {
  const submitted = [];
  const pickerRequests = [];
  const actionsByFamily = {
    launch: [{
      schemaVersion: "seti-standard-action-v1", actionId: "launch:1", family: "launch",
      target: null, summary: "发射",
    }],
    orbit: [1, 2].map((rocketId) => ({
      schemaVersion: "seti-standard-action-v1", actionId: `orbit:${rocketId}`, family: "orbit",
      target: { rocketId, planetId: "mars" }, summary: `R${rocketId} 环绕火星`,
    })),
    land: [{
      schemaVersion: "seti-standard-action-v1", actionId: "land:1", family: "land",
      target: { rocketId: 1, planetId: "mars", type: "planet" }, summary: "登陆火星",
    }],
    move: [{
      schemaVersion: "seti-standard-action-v1", actionId: "move:1", family: "move",
      target: { rocketId: 1, deltaX: 1, deltaY: 0 }, summary: "移动",
    }],
  };
  const runtime = actionInteractionApi.createPrimaryActionUiRuntime({
    enumerateActions: ({ family }) => structuredClone(actionsByFamily[family] || []),
    submitAction(action) { submitted.push(["main", action]); return { ok: true }; },
    submitQuickAction(action) { submitted.push(["quick", action]); return { ok: true }; },
    canStartMainAction: () => true,
    getMainActionStartBlockReason: () => null,
    getAvailablePlutoAction: () => ({ ok: false }),
    requestLandTargetPicker(options) { pickerRequests.push(options); return { ok: true }; },
    executePlutoAction: () => assert.fail("普通 descriptor 路径不应执行冥王星 fallback"),
    setStatusNote: () => {},
    renderStateReadout: () => {},
    renderPlayerStats: () => {},
    updateActionButtons: () => {},
    isAiInputLocked: () => false,
    blockManualAiInput: () => ({ ok: false }),
    getHighlightedRocketId: () => null,
    getActionInteractionProjection: () => Object.freeze({ activeRocketId: 1 }),
    beginMovePaymentSelection: () => assert.fail("首次 move intent 应直接提交 descriptor"),
  });

  assert.equal(runtime.launchRocketForCurrentPlayer().ok, true);
  assert.equal(runtime.orbitForCurrentPlayer().ok, true);
  assert.equal(pickerRequests[0].choices.every((choice) => choice.standardAction), true);
  assert.equal(runtime.landForCurrentPlayer().ok, true);
  assert.equal(runtime.moveActiveRocket(1, 0).ok, true);
  assert.deepEqual(submitted.map(([kind, action]) => [kind, action.actionId]), [
    ["main", "launch:1"],
    ["main", "land:1"],
    ["quick", "move:1"],
  ]);
})();

(function testSessionProjectionUsesOnlyConsistentInspectObserveAndHidesDecisionChoices() {
  let storeReads = 0;
  let inspectCalls = 0;
  let observeCalls = 0;
  const state = createState();
  state.players.p1.resources.credits = 2;
  const decision = {
    ok: true,
    decisionId: "session-1:effect:2",
    decisionVersion: 4,
    ownerId: "p1",
    decisionKind: "choose_tech",
    allowQuickActions: true,
    choices: [{ id: "orange-1", label: "橙色科技" }, { id: "blue-1", label: "蓝色科技" }],
  };
  const sessionRuntime = {
    inspect() {
      inspectCalls += 1;
      return {
        ok: true, sessionId: "session-1", phase: "awaiting_input", baseVersion: 0,
        revision: 4, decision,
        controls: { canUndo: false, undoDisabledReason: "不可越过隐藏信息屏障撤销", allowQuickActions: true },
        progress: { completedEffects: 2, remainingEffects: 1, totalEffects: 3, currentEffectType: "choose-tech" },
      };
    },
    observe(_session, viewer) {
      observeCalls += 1;
      assert.equal(viewer.viewerId.startsWith("viewer-"), true);
      return {
        schemaVersion: "seti-effect-session-v1",
        sessionId: "session-1",
        phase: "awaiting_input",
        revision: 4,
        state,
        decision,
      };
    },
  };
  const adapter = projectionApi.createBrowserProjectionAdapter({
    stateStore: { getSnapshot() { storeReads += 1; return createState(); } },
    sessionRuntime,
    actionAdapter: {
      enumerate() {
        return [
          {
            schemaVersion: "seti-standard-action-v1", actionId: "pass:session", family: "pass", phase: "main",
            actorId: "p1", stateVersion: 0, decisionVersion: 4, summary: "PASS",
          },
          {
            schemaVersion: "seti-standard-action-v1", actionId: "quick_trade:session", family: "quick_trade", phase: "quick",
            actorId: "p1", stateVersion: 0, decisionVersion: 4, summary: "快速交易", disabledReason: "信用点不足",
          },
        ];
      },
    },
  });
  const ownerProjection = adapter.projectSession({}, {
    viewer: { viewerId: "viewer-p1", playerId: "p1", role: "player" },
  });
  assert.equal(storeReads, 0);
  assert.equal(inspectCalls, 1);
  assert.equal(observeCalls, 1);
  assert.equal(ownerProjection.source.kind, "session");
  assert.equal(ownerProjection.source.sessionRevision, 4);
  assert.equal(ownerProjection.players.p1.resources.credits, 2);
  assert.deepEqual(ownerProjection.decision.choices.map((choice) => choice.choiceId), ["orange-1", "blue-1"]);
  assert.equal(ownerProjection.controls.actions[0].actionId, "pass:session");
  assert.equal(ownerProjection.controls.quickActions[0].disabledReason, "信用点不足");
  assert.equal(ownerProjection.controls.canUndo, false);
  assert.equal(ownerProjection.controls.undoDisabledReason, "不可越过隐藏信息屏障撤销");
  assert.equal(ownerProjection.feedback.progress.currentEffectType, "choose-tech");
  const spectator = adapter.projectSession({}, {
    viewer: { viewerId: "viewer-s", playerId: "p2", role: "spectator" },
  });
  assert.equal(spectator.decision.ownerId, "p1");
  assert.deepEqual(spectator.decision.choices, []);
  assert.equal(Object.hasOwn(spectator.players.p2, "privateGoal"), false);

  const inconsistent = projectionApi.createBrowserProjectionAdapter({
    stateStore: { getSnapshot: () => createState() },
    sessionRuntime: {
      inspect: () => ({ ok: true, sessionId: "s", phase: "draining", revision: 1 }),
      observe: () => ({ sessionId: "s", phase: "draining", revision: 2, state }),
    },
  }).projectSession({}, {
    viewer: { viewerId: "viewer-p1", playerId: "p1", role: "player" },
  });
  assert.equal(inconsistent.code, "BROWSER_PROJECTION_SESSION_SOURCE_MISMATCH");
})();

(function testViewStateReconcileAndClearNeverTouchRulePorts() {
  const store = viewStateApi.createViewStateStore();
  store.reconcileProjection({
    projectionId: "projection-1",
    decision: { decisionId: "d1", decisionVersion: 1, choices: [{ choiceId: "a" }, { choiceId: "removed" }] },
  });
  store.dispatch({
    type: "draft.set",
    intentKind: "decision",
    selectedChoiceIds: ["a", "removed"],
    text: "draft",
  });
  store.reconcileProjection({
    projectionId: "projection-2",
    decision: { decisionId: "d1", decisionVersion: 2, choices: [{ choiceId: "a" }, { choiceId: "new" }] },
  });
  assert.deepEqual(store.getSnapshot().draft.selectedChoiceIds, ["a"]);
  store.reconcileProjection({
    projectionId: "projection-3",
    decision: { decisionId: "d2", decisionVersion: 1, choices: [{ choiceId: "a" }] },
  });
  assert.deepEqual(store.getSnapshot().draft, { intentKind: null, selectedChoiceIds: [], text: "" });
  const cleared = store.clear();
  assert.equal(cleared.overlay.activeId, null);
  assert.deepEqual(cleared.draft.selectedChoiceIds, []);
  assert.equal(Object.isFrozen(cleared.layout.panelSizes), true);
})();

(function testInputRoutingAndStaleRefreshWithoutRetryOrVersionRewrite() {
  const calls = { action: [], decision: [], view: [], refresh: 0 };
  const viewStateStore = viewStateApi.createViewStateStore();
  const originalViewDispatch = viewStateStore.dispatch;
  const wrappedViewStore = {
    getSnapshot: viewStateStore.getSnapshot,
    dispatch(intent) {
      calls.view.push(intent);
      return originalViewDispatch(intent);
    },
  };
const adapter = inputApi.createBrowserInputAdapter({
    dispatchAction(action) {
      calls.action.push(action);
      return { ok: false, code: "STANDARD_ACTION_STALE", authority: { stateVersion: 8 } };
    },
    submitDecision(submission) {
      calls.decision.push(submission);
      return { ok: false, code: "EFFECT_DECISION_STALE", decision: { decisionVersion: 6 } };
    },
    viewStateStore: wrappedViewStore,
    refreshProjection() {
      calls.refresh += 1;
      return { projectionId: `refreshed-${calls.refresh}` };
    },
  });
  const staleAction = { actionId: "pass:old", stateVersion: 7, decisionVersion: null };
  const staleDecision = { decisionId: "d1", decisionVersion: 5, choice: { id: "a" } };
  assert.equal(adapter.dispatchIntent({ kind: "action", action: staleAction }).code, "STANDARD_ACTION_STALE");
  assert.equal(adapter.dispatchIntent({ kind: "decision", submission: staleDecision }).code, "EFFECT_DECISION_STALE");
  adapter.dispatchIntent({ kind: "view", type: "overlay.set", activeId: "tech" });
  assert.deepEqual(calls.action, [staleAction]);
  assert.deepEqual(calls.decision, [staleDecision]);
  assert.deepEqual(calls.view, [{ type: "overlay.set", activeId: "tech" }]);
  assert.equal(calls.refresh, 2);
  assert.equal(adapter.inspectInputState().viewState.overlay.activeId, "tech");
  assert.equal(adapter.dispatchIntent({ kind: "mystery" }).code, "BROWSER_INPUT_INTENT_UNKNOWN");
  assert.equal(calls.action.length, 1);
  assert.equal(calls.decision.length, 1);
})();

(function testActiveDecisionPortOwnsBrowserDecisionMapping() {
  const submissions = [];
  const decisions = inputApi.createActiveDecisionPort({
    inspect: () => ({
      phase: "awaiting_input",
      session: { decision: {
        decisionId: "d1",
        decisionVersion: 2,
        choices: [{ target: { kind: "industry-free-move", rocketId: 7, direction: "cw" } }],
      } },
    }),
    submitDecision(submission) { submissions.push(submission); return { ok: true }; },
  });
  assert.equal(decisions.submitDirectional("industry-free-move", 1, 0, 7).ok, true);
  assert.equal(submissions[0].decisionVersion, 2);
  assert.equal(decisions.submit("unknown", () => true).code, "CARD_DECISION_REQUIRED");
})();

(function testHumanActionInputAdapterOnlyDispatchesCurrentCompleteDescriptor() {
  const dispatched = [];
  let legal = [{
    schemaVersion: "seti-standard-action-v1",
    actionId: "move:p1:r7:cw:v3",
    family: "move",
    phase: "quick",
    actorId: "p1",
    stateVersion: 3,
    decisionVersion: 8,
    target: { rocketId: 7, deltaX: 1, deltaY: 0 },
    payload: { cost: { energy: 1 } },
    summary: "顺时针移动",
    disabledReason: null,
  }];
  const adapter = inputApi.createHumanActionInputAdapter({
    readLegalActions: () => legal,
    dispatchAction(action) {
      dispatched.push(action);
      return { ok: true };
    },
  });
  const current = structuredClone(legal[0]);
  assert.equal(adapter.submit(current).ok, true);
  assert.deepEqual(dispatched, [current], "唯一 action port 必须收到 current legal set 的完整 descriptor");

  assert.equal(adapter.submit({ ...current, actorId: "p2" }).code, "HUMAN_ACTION_WRONG_ACTOR");
  assert.equal(adapter.submit({ ...current, stateVersion: 2 }).code, "HUMAN_ACTION_STALE");
  assert.equal(adapter.submit({ ...current, payload: { cost: { energy: 0 } } }).code, "HUMAN_ACTION_DESCRIPTOR_STALE");
  legal = [];
  assert.equal(adapter.submit(current).code, "HUMAN_ACTION_REMOVED");
  assert.equal(dispatched.length, 1, "stale/wrong actor/removed/tampered action 必须零提交");
})();

(function testHumanActionInputAdapterCoversEveryTopLevelHumanFamily() {
  const families = [
    "launch", "orbit", "land", "scan", "analyze", "research_tech", "play_card", "pass",
    "move", "quick_trade", "industry", "card_corner", "place_data",
    "runezu_face_symbol", "end_turn",
  ];
  const legal = families.map((family, index) => ({
    schemaVersion: "seti-standard-action-v1",
    actionId: `${family}:p1:v9:${index}`,
    family,
    phase: ["move", "quick_trade", "card_corner", "place_data", "runezu_face_symbol"].includes(family)
      ? "quick" : "main",
    actorId: "p1",
    stateVersion: 9,
    decisionVersion: 4,
    target: { identity: index },
    payload: { proof: family },
    summary: family,
    disabledReason: null,
  }));
  const dispatched = [];
  const adapter = inputApi.createHumanActionInputAdapter({
    readLegalActions: () => legal,
    dispatchAction(action) { dispatched.push(action); return { ok: true }; },
  });
  for (const action of legal) assert.equal(adapter.submit(structuredClone(action)).ok, true);
  assert.deepEqual(
    dispatched.map((action) => action.family),
    families,
    "15 family 必须逐项提交 current legal set 的完整 descriptor",
  );
})();

console.log("browser host reference core tests passed");
