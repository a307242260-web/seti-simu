(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppCardTriggerRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  // Browser 只保留只读 projection helper。任务、type1、bonus、followup 与 cleanup
  // 已由 Production Composition 的 residual/card Effect executor 独占。
  const BROWSER_INPUT_NAMES = Object.freeze([
    "refreshCardTaskState", "applyType1TriggerMatches", "continueAfterCardTriggerResolution",
    "applyCardEventBonusReward",
    "applyPublicityMoveFollowupBonus", "processCardEventBonuses", "processChongTransportArrivalEvents",
    "settleCardTasksAfterEffect",
    "removeReservedCardToDiscard", "discardReservedCardIfFinished",
    "consumeCardTriggerWithSnapshot", "confirmCardTriggerProgress",
    "prepareCardTriggerRewardEffects", "queueCardTriggerRewardEffects", "openCardTaskCompletionPicker",
    "openCardTriggerPicker", "applyCardTriggerReward", "beginCardTriggerFreeMove", "applyCardTriggerMatch",
  ]);

  const BROWSER_STATIC_DEPENDENCY_KEYS = Object.freeze(["rocketActions"]);

  function createBrowserInputPort(registry, getTarget) {
    if (typeof registry?.registerTarget !== "function") {
      throw new TypeError("card_trigger input port 需要已校验 registry");
    }
    if (typeof getTarget !== "function") throw new TypeError("card_trigger input port 缺少 owner resolver");
    return registry.registerTarget("card_trigger", BROWSER_INPUT_NAMES, getTarget);
  }

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

    const hostPort = context.hostPort || context;
    const submitProductionDecision = (...hints) => (
      hostPort.submitActiveDecision?.("residual-domain", (target, candidate) => {
        const values = hints.flatMap((hint) => (
          ["string", "number"].includes(typeof hint) ? [String(hint)]
            : hint && typeof hint === "object" ? Object.values(hint).map(String) : []
        ));
        const text = JSON.stringify({ target, payload: candidate?.payload || {} });
        return values.length === 0 || values.every((value) => text.includes(value));
      }) || {
        ok: false,
        code: "CARD_TRIGGER_DECISION_REQUIRED",
        message: "当前没有正式卡牌触发 Decision",
      }
    );
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
      const decision = hostPort.inspect?.()?.session?.decision;
      return (decision?.choices || []).filter((entry) => {
        const target = entry.target || entry.standardAction?.target || {};
        const payload = entry.payload || entry.standardAction?.payload || {};
        return target.kind === "residual-domain"
          && ["card_trigger", "task"].includes(payload.domain || payload.effectType);
      }).map((entry) => structuredClone(entry));
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
      enqueueType1TriggerEvents: submitProductionDecision,
      isCardTriggerPickSelectionActive: falseValue,
      hasActiveCardTriggerResolution: falseValue,
      isCardTriggerRewardFlowBusy: falseValue,
      getType1TriggerMatchesForEvent: emptyArray,
      applyType1TriggerMatches: submitProductionDecision,
      continueAfterCardTriggerResolution: submitProductionDecision,
      cancelCardTriggerChoice: submitProductionDecision,
      buildAlienTraceEvent: (_root, input = {}) => ({ type: "alienTrace", ...structuredClone(input) }),
      getNebulaColorForCardEvent: nullValue,
      ensureCardFlowEventBonuses: emptyArray,
      getActiveCardEventBonuses: emptyArray,
      eventMatchesCardBonus: falseValue,
      getCardEventBonusKey: nullValue,
      applyCardEventBonusReward: submitProductionDecision,
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
      incrementCompletedTaskCount: submitProductionDecision,
      removeReservedCardToDiscard: () => false,
      discardReservedCardIfFinished: () => false,
      createCardTriggerProgressSnapshot: (workingRoot) => ({
        playerState: structuredClone(rootOf(workingRoot).playerState),
        cardState: structuredClone(rootOf(workingRoot).cardState),
      }),
      createCardTriggerProgressCommands: emptyArray,
      consumeCardTriggerWithSnapshot: submitProductionDecision,
      confirmCardTriggerProgress: submitProductionDecision,
      prepareCardTriggerRewardEffects: emptyArray,
      queueCardTriggerRewardEffects: submitProductionDecision,
      getCardTaskCompletionBlockReason: nullValue,
      openCardTaskCompletionPicker: falseValue,
      closeCardTaskCompletionPicker: falseValue,
      confirmCardTaskCompletion: submitProductionDecision,
      openCardTriggerPicker: falseValue,
      closeCardTriggerPicker: falseValue,
      applyCardTriggerReward: submitProductionDecision,
      beginCardTriggerFreeMove: submitProductionDecision,
      applyCardTriggerMatch: submitProductionDecision,
      handleCardTriggerChoice: submitProductionDecision,
      executeFreeMoveForCardTrigger: submitProductionDecision,
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
    BROWSER_INPUT_NAMES,
    BROWSER_STATIC_DEPENDENCY_KEYS,
    createBrowserInputPort,
    createBrowserCardTriggerStaticContext,
    createBrowserCardTriggerRuntime,
    createCardTriggerRuntime,
  };
});
