(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppCardTriggerRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  // Browser 只保留只读 projection helper。任务、type1、bonus、followup 与 cleanup
  // 已由 Production Composition 的 residual/card Effect executor 独占。
  const BROWSER_STATIC_DEPENDENCY_KEYS = Object.freeze(["rocketActions"]);

  function createBrowserCardTriggerStaticContext(dependencies = {}) {
    const missing = BROWSER_STATIC_DEPENDENCY_KEYS.filter(
      (key) => !Object.prototype.hasOwnProperty.call(dependencies, key) || dependencies[key] == null,
    );
    if (missing.length) throw new Error(`Browser Card Trigger 静态模块缺少依赖：${missing.join(", ")}`);
    return Object.freeze(Object.fromEntries(
      BROWSER_STATIC_DEPENDENCY_KEYS.map((key) => [key, dependencies[key]]),
    ));
  }

  function createCardTriggerRuntime(context = {}) {
    const { rocketActions } = context;
    const productionDecisionOwnedBySession = () => ({
      ok: false,
      code: "CARD_TRIGGER_DECISION_INPUT_OWNED_BY_SESSION",
      message: "卡牌触发 Decision 只能通过当前 Effect Session identity 提交",
    });
    const rootOf = (workingRoot) => {
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("card-trigger projection requires explicit workingRoot");
      }
      return workingRoot;
    };
    function buildPlayerDataTotals(workingRoot) {
      const totals = {};
      for (const player of rootOf(workingRoot).playerState?.players || []) {
        const playerData = player.dataState || {};
        const available = Array.isArray(playerData.poolTokens)
          ? playerData.poolTokens.length
          : Number(player.resources?.availableData) || 0;
        const placed = Array.isArray(playerData.placedTokens)
          ? playerData.placedTokens.length
          : Number(player.resources?.placedData) || 0;
        if (player.id) totals[player.id] = available + placed;
        if (player.color) totals[player.color] = available + placed;
      }
      return totals;
    }

    function addProbeLocation(index, key, locationType) {
      if (!key || !locationType) return;
      if (!Array.isArray(index[key])) index[key] = [];
      if (!index[key].includes(locationType)) index[key].push(locationType);
    }

    function buildProbeLocationIndexFromPieces(pieces) {
      const index = {};
      const details = [];
      for (const rocket of pieces?.rockets || []) {
        const coordinate = rocketActions.getRocketSectorCoordinate?.(rocket) || null;
        const locationType = rocket.referencePlacement?.kind === "orbit"
          || rocket.referencePlacement?.kind === "land"
          ? "planet"
          : null;
        if (locationType) {
          addProbeLocation(index, rocket.playerId, locationType);
          addProbeLocation(index, rocket.color, locationType);
        }
        details.push({
          rocketId: rocket.id,
          playerId: rocket.playerId,
          color: rocket.color,
          coordinate,
          locationType,
          planetId: rocket.referencePlacement?.planetId || null,
        });
      }
      return { index, details };
    }

    function buildProbeLocationIndex(workingRoot) {
      return buildProbeLocationIndexFromPieces(rootOf(workingRoot).rocketState);
    }

    function buildCardTaskContext(workingRoot) {
      const root = rootOf(workingRoot);
      const probes = buildProbeLocationIndex(workingRoot);
      return {
        nebulaDataState: root.nebulaDataState,
        alienGameState: root.alienGameState,
        planetStatsState: root.planetStatsState,
        probeLocations: probes.index,
        probeLocationDetails: probes.details,
        dataTotals: buildPlayerDataTotals(workingRoot),
      };
    }

    function getReadyCardTasks(workingRoot) {
      rootOf(workingRoot);
      return [];
    }

    function refreshCardTaskState(workingRoot) {
      return { readyTasks: getReadyCardTasks(workingRoot) };
    }

    function getReadyTaskForReservedCard(workingRoot, card) {
      return getReadyCardTasks(workingRoot).find((entry) => entry.card?.id === card?.id) || null;
    }

    const emptyArray = () => [];
    const falseValue = () => false;
    const nullValue = () => null;
    const emptySettlement = () => ({
      cardEventBonuses: [],
      chongCompletions: [],
      runezuCompletions: [],
      type1Result: null,
    });

    return {
      buildCardTaskContext,
      buildPlayerDataTotals,
      addProbeLocation,
      buildProbeLocationIndex,
      buildProbeLocationIndexFromPieces,
      startTemporaryCardTaskRewardFlow: falseValue,
      getReadyCardTasks,
      refreshCardTaskState,
      cloneType1TriggerEvent: (event) => event == null ? event : structuredClone(event),
      enqueueType1TriggerEvents: productionDecisionOwnedBySession,
      isCardTriggerPickSelectionActive: falseValue,
      hasActiveCardTriggerResolution: falseValue,
      isCardTriggerRewardFlowBusy: falseValue,
      getType1TriggerMatchesForEvent: emptyArray,
      applyType1TriggerMatches: productionDecisionOwnedBySession,
      continueAfterCardTriggerResolution: productionDecisionOwnedBySession,
      cancelCardTriggerChoice: productionDecisionOwnedBySession,
      buildAlienTraceEvent: (_root, input = {}) => ({ type: "alienTrace", ...structuredClone(input) }),
      getNebulaColorForCardEvent: nullValue,
      ensureCardFlowEventBonuses: emptyArray,
      getActiveCardEventBonuses: emptyArray,
      eventMatchesCardBonus: falseValue,
      getCardEventBonusKey: nullValue,
      applyCardEventBonusReward: productionDecisionOwnedBySession,
      applyPublicityMoveFollowupBonus: falseValue,
      processCardEventBonuses: emptyArray,
      processChongTransportArrivalEvents: emptyArray,
      getChongTransportDestinationCoordinate: nullValue,
      getChongTransportArrivalEventKey: nullValue,
      buildChongPositionArrivalEvents: emptyArray,
      settleCardTasksAfterEffect: emptySettlement,
      getChongRewardPrimaryIcon: () => "task",
      createChongTaskEffect: (...args) => ({ id: args[0], type: args[1], label: args[2], icon: args[3], options: args[4] || {} }),
      buildChongRewardQueueEffects: emptyArray,
      buildChongFossilRewardQueueEffects: emptyArray,
      buildChongTransportCleanupEffect: nullValue,
      buildChongTaskCompletionEffects: emptyArray,
      getReadyTaskForReservedCard,
      getReadyChongTaskForReservedCard: nullValue,
      getReadyAmibaTaskForReservedCard: nullValue,
      getReadyRunezuTaskForReservedCard: nullValue,
      getRunezuTaskProgressIndexes: emptyArray,
      incrementCompletedTaskCount: productionDecisionOwnedBySession,
      removeReservedCardToDiscard: () => false,
      discardReservedCardIfFinished: () => false,
      createCardTriggerProgressSnapshot: (workingRoot) => ({
        playerState: structuredClone(rootOf(workingRoot).playerState),
        cardState: structuredClone(rootOf(workingRoot).cardState),
      }),
      createCardTriggerProgressCommands: emptyArray,
      consumeCardTriggerWithSnapshot: productionDecisionOwnedBySession,
      confirmCardTriggerProgress: productionDecisionOwnedBySession,
      prepareCardTriggerRewardEffects: emptyArray,
      queueCardTriggerRewardEffects: productionDecisionOwnedBySession,
      getCardTaskCompletionBlockReason: nullValue,
      openCardTaskCompletionPicker: falseValue,
      closeCardTaskCompletionPicker: falseValue,
      confirmCardTaskCompletion: productionDecisionOwnedBySession,
      openCardTriggerPicker: falseValue,
      closeCardTriggerPicker: falseValue,
      applyCardTriggerReward: productionDecisionOwnedBySession,
      beginCardTriggerFreeMove: productionDecisionOwnedBySession,
      applyCardTriggerMatch: productionDecisionOwnedBySession,
      handleCardTriggerChoice: productionDecisionOwnedBySession,
      executeFreeMoveForCardTrigger: productionDecisionOwnedBySession,
    };
  }

  function createBrowserCardTriggerRuntime(context = {}) {
    return createCardTriggerRuntime({
      ...context.staticContext,
      ...context.hostPort,
      hostPort: context.hostPort,
    });
  }

  return {
    BROWSER_STATIC_DEPENDENCY_KEYS,
    createBrowserCardTriggerStaticContext,
    createBrowserCardTriggerRuntime,
    createCardTriggerRuntime,
  };
});
