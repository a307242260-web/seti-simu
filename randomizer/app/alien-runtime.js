(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppAlienRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function requireFunction(name, fn) {
    if (typeof fn !== "function") {
      throw new Error(`createAlienRuntimeHelpers requires function: ${name}`);
    }
    return fn;
  }

  function createAlienRuntimeHelpers(context = {}) {
    const structuredClone = context.structuredClone || root.structuredClone;
    const aliens = context.aliens || {};
    const players = context.players || {};
    const data = context.data || {};
    const cardEffects = context.cardEffects || {};
    const historyCommands = context.historyCommands || {};
    const jiuzhe = context.jiuzhe || null;
    const yichangdian = context.yichangdian || null;
    const fangzhou = context.fangzhou || null;
    const banrenma = context.banrenma || null;
    const chong = context.chong || null;
    const amiba = context.amiba || null;
    const aomomo = context.aomomo || null;
    const runezu = context.runezu || null;

    const decisionState = context.decisionSessions?.createFacade?.({
      discardAction: "discard_action",
      cardSelectionAction: "card_selection_action",
      scanTargetAction: "scan_target_action",
      handScanAction: "hand_scan_action",
      alienTraceAction: "alien_trace_action",
      alienTracePickerState: "alien_trace_picker_state",
      alienRevealConfirmation: "alien_reveal_confirmation",
      actionEffectFlow: "action_effect_flow",
    }) || {};
    const alienGameState = context.alienGameState || {};
    const playerState = context.playerState || {};
    const rocketState = context.rocketState || {};
    const solarState = context.solarState || {};
    const nebulaDataState = context.nebulaDataState || {};
    const techGameState = context.techGameState || {};

    const getCurrentPlayer = requireFunction("getCurrentPlayer", context.getCurrentPlayer);
    const getActivePlayers = requireFunction("getActivePlayers", context.getActivePlayers);
    const getPlayerById = requireFunction("getPlayerById", context.getPlayerById);
    const getPlayerByColor = requireFunction("getPlayerByColor", context.getPlayerByColor);
    const getPlayerActionLabel = requireFunction("getPlayerActionLabel", context.getPlayerActionLabel);
    const resolvePlayerReference = requireFunction("resolvePlayerReference", context.resolvePlayerReference);
    const getEarthSectorCoordinate = requireFunction("getEarthSectorCoordinate", context.getEarthSectorCoordinate);
    const isDebugAlienTraceMode = requireFunction("isDebugAlienTraceMode", context.isDebugAlienTraceMode);
    const isAlienTracePickerChoiceAllowed = requireFunction("isAlienTracePickerChoiceAllowed", context.isAlienTracePickerChoiceAllowed);
    const getAvailableDataTokenCount = requireFunction("getAvailableDataTokenCount", context.getAvailableDataTokenCount);
    const renderAlienPanels = requireFunction("renderAlienPanels", context.renderAlienPanels);
    const renderPlayerStats = requireFunction("renderPlayerStats", context.renderPlayerStats);
    const renderPlayerHand = requireFunction("renderPlayerHand", context.renderPlayerHand);
    const renderReservedCards = requireFunction("renderReservedCards", context.renderReservedCards);
    const renderRockets = requireFunction("renderRockets", context.renderRockets);
    const renderStateReadout = requireFunction("renderStateReadout", context.renderStateReadout);
    const renderWheels = requireFunction("renderWheels", context.renderWheels);
    const renderSectorNebulaDataBoard = requireFunction("renderSectorNebulaDataBoard", context.renderSectorNebulaDataBoard);
    const renderFangzhouCardDisplays = requireFunction("renderFangzhouCardDisplays", context.renderFangzhouCardDisplays);
    const updateActionButtons = requireFunction("updateActionButtons", context.updateActionButtons);
    const closeAlienTracePicker = requireFunction("closeAlienTracePicker", context.closeAlienTracePicker);
    const clearAlienTracePlacementMode = requireFunction("clearAlienTracePlacementMode", context.clearAlienTracePlacementMode);
    const maybeRevealAlienAfterTrace = requireFunction("maybeRevealAlienAfterTrace", context.maybeRevealAlienAfterTrace);
    const createActionLogImpactSnapshot = requireFunction("createActionLogImpactSnapshot", context.createActionLogImpactSnapshot);
    const beginEffectHistoryStep = requireFunction("beginEffectHistoryStep", context.beginEffectHistoryStep);
    const recordHistoryCommand = requireFunction("recordHistoryCommand", context.recordHistoryCommand);
    const getCurrentActionEffect = requireFunction("getCurrentActionEffect", context.getCurrentActionEffect);
    const completeCurrentActionEffect = requireFunction("completeCurrentActionEffect", context.completeCurrentActionEffect);
    const beginQuickActionStep = requireFunction("beginQuickActionStep", context.beginQuickActionStep);
    const recordQuickHistoryCommand = requireFunction("recordQuickHistoryCommand", context.recordQuickHistoryCommand);
    const completeQuickActionStep = requireFunction("completeQuickActionStep", context.completeQuickActionStep);
    const settleCardTasksAfterEffect = requireFunction("settleCardTasksAfterEffect", context.settleCardTasksAfterEffect);
    const maybeContinueAlienRevealQueuedOpportunities = requireFunction("maybeContinueAlienRevealQueuedOpportunities", context.maybeContinueAlienRevealQueuedOpportunities);
    const maybeContinuePendingTurnEndRevealFlow = requireFunction("maybeContinuePendingTurnEndRevealFlow", context.maybeContinuePendingTurnEndRevealFlow);
    const markCurrentActionIrreversible = requireFunction("markCurrentActionIrreversible", context.markCurrentActionIrreversible);
    const appendActionLogStep = requireFunction("appendActionLogStep", context.appendActionLogStep);
    const queueJiuzheOpportunitiesForPlayer = requireFunction("queueJiuzheOpportunitiesForPlayer", context.queueJiuzheOpportunitiesForPlayer);
    const queueBanrenmaOpportunitiesForPlayer = requireFunction("queueBanrenmaOpportunitiesForPlayer", context.queueBanrenmaOpportunitiesForPlayer);
    const recordAlienTraceScore = requireFunction("recordAlienTraceScore", context.recordAlienTraceScore);
    const formatPlanetRewardGain = requireFunction("formatPlanetRewardGain", context.formatPlanetRewardGain);
    const appendRevealCardGrantMessage = requireFunction("appendRevealCardGrantMessage", context.appendRevealCardGrantMessage);
    const getRevealIrreversible = requireFunction("getRevealIrreversible", context.getRevealIrreversible);
    const buildAlienTraceEvent = requireFunction("buildAlienTraceEvent", context.buildAlienTraceEvent);
    const maybeRestoreAlienLabPanelForTrace = requireFunction("maybeRestoreAlienLabPanelForTrace", context.maybeRestoreAlienLabPanelForTrace);
    const beginCardSelection = requireFunction("beginCardSelection", context.beginCardSelection);
    const enqueueFangzhouCard1RewardEffects = requireFunction("enqueueFangzhouCard1RewardEffects", context.enqueueFangzhouCard1RewardEffects);
    const applyYichangdianRewardToPlayer = requireFunction("applyYichangdianRewardToPlayer", context.applyYichangdianRewardToPlayer);
    const applyFangzhouTraceRewardToPlayer = requireFunction("applyFangzhouTraceRewardToPlayer", context.applyFangzhouTraceRewardToPlayer);
    const getAlienTraceScoreSourceKey = requireFunction("getAlienTraceScoreSourceKey", context.getAlienTraceScoreSourceKey);
    const applyBanrenmaRewardToPlayer = requireFunction("applyBanrenmaRewardToPlayer", context.applyBanrenmaRewardToPlayer);
    const applyAomomoRewardToPlayer = requireFunction("applyAomomoRewardToPlayer", context.applyAomomoRewardToPlayer);
    const applyChongRewardToPlayer = requireFunction("applyChongRewardToPlayer", context.applyChongRewardToPlayer);
    const applyAmibaRewardToPlayer = requireFunction("applyAmibaRewardToPlayer", context.applyAmibaRewardToPlayer);
    const applyRunezuRewardToPlayer = requireFunction("applyRunezuRewardToPlayer", context.applyRunezuRewardToPlayer);
    const applyJiuzheRewardToPlayer = requireFunction("applyJiuzheRewardToPlayer", context.applyJiuzheRewardToPlayer);
    const openYichangdianCardGainDialog = requireFunction("openYichangdianCardGainDialog", context.openYichangdianCardGainDialog);
    const openBanrenmaCardGainDialog = requireFunction("openBanrenmaCardGainDialog", context.openBanrenmaCardGainDialog);
    const openAomomoCardGainDialog = requireFunction("openAomomoCardGainDialog", context.openAomomoCardGainDialog);
    const openChongRewardFollowUps = requireFunction("openChongRewardFollowUps", context.openChongRewardFollowUps);
    const openAmibaRewardFollowUps = requireFunction("openAmibaRewardFollowUps", context.openAmibaRewardFollowUps);
    const openRunezuRewardFollowUps = requireFunction("openRunezuRewardFollowUps", context.openRunezuRewardFollowUps);
    const isJiuzheTracePlacementMode = requireFunction("isJiuzheTracePlacementMode", context.isJiuzheTracePlacementMode);
    const isYichangdianTracePlacementMode = requireFunction("isYichangdianTracePlacementMode", context.isYichangdianTracePlacementMode);
    const isFangzhouTracePlacementMode = requireFunction("isFangzhouTracePlacementMode", context.isFangzhouTracePlacementMode);
    const isBanrenmaTracePlacementMode = requireFunction("isBanrenmaTracePlacementMode", context.isBanrenmaTracePlacementMode);
    const isChongTracePlacementMode = requireFunction("isChongTracePlacementMode", context.isChongTracePlacementMode);
    const isAmibaTracePlacementMode = requireFunction("isAmibaTracePlacementMode", context.isAmibaTracePlacementMode);
    const isAomomoTracePlacementMode = requireFunction("isAomomoTracePlacementMode", context.isAomomoTracePlacementMode);
    const isRunezuTracePlacementMode = requireFunction("isRunezuTracePlacementMode", context.isRunezuTracePlacementMode);
    const canPlaceJiuzheTrace = requireFunction("canPlaceJiuzheTrace", context.canPlaceJiuzheTrace);
    const canPlaceYichangdianTrace = requireFunction("canPlaceYichangdianTrace", context.canPlaceYichangdianTrace);
    const canPlaceFangzhouTrace = requireFunction("canPlaceFangzhouTrace", context.canPlaceFangzhouTrace);
    const canPlaceBanrenmaTrace = requireFunction("canPlaceBanrenmaTrace", context.canPlaceBanrenmaTrace);
    const canPlaceChongTrace = requireFunction("canPlaceChongTrace", context.canPlaceChongTrace);
    const canPlaceAmibaTrace = requireFunction("canPlaceAmibaTrace", context.canPlaceAmibaTrace);
    const canPlaceAomomoTrace = requireFunction("canPlaceAomomoTrace", context.canPlaceAomomoTrace);
    const canPlaceRunezuTrace = requireFunction("canPlaceRunezuTrace", context.canPlaceRunezuTrace);
    const HISTORY_SOURCE_MAIN = context.HISTORY_SOURCE_MAIN || "main";

    function formatFangzhouRevealBasicRewardMessage(rewards) {
      if (!rewards?.length) return null;
      const groups = new Map();
      for (const reward of rewards) {
        const playerLabel = reward.playerLabel || "未知玩家";
        if (!groups.has(playerLabel)) groups.set(playerLabel, []);
        groups.get(playerLabel).push(reward.label || `方舟奖励 ${reward.index}`);
      }
      const parts = [...groups.entries()].map(([playerLabel, labels]) => (
        `${playerLabel}基础奖励 ${labels.length} 次（${labels.join("、")}）`
      ));
      return parts.length ? `方舟揭示基础奖励：${parts.join("；")}` : null;
    }

    function processFangzhouRevealBasicRewards() {
      if (!fangzhou) return { ok: true, count: 0 };
      const rewards = [];
      while (alienGameState.fangzhou?.pendingRevealBasicRewards?.length) {
        const next = fangzhou.takeNextRevealBasicReward(alienGameState);
        if (!next.ok || !next.entry) break;
        const player = getPlayerById(next.entry.playerId) || getPlayerByColor(next.entry.playerColor);
        if (!player) continue;
        const flip = fangzhou.flipCard1Reward(alienGameState, "basic");
        if (!flip.ok) break;
        rewards.push({
          ...flip,
          playerId: player.id || next.entry.playerId || null,
          playerColor: player.color || next.entry.playerColor || null,
          targetPlayerId: player.id || next.entry.playerId || null,
          targetPlayerColor: player.color || next.entry.playerColor || null,
          playerLabel: getPlayerActionLabel(player, next.entry),
        });
      }
      if (rewards.length) {
        renderFangzhouCardDisplays();
        enqueueFangzhouCard1RewardEffects(rewards, "方舟揭示基础奖励", { actionType: "fangzhouBasic" });
      }
      return {
        ok: true,
        count: rewards.length,
        rewards,
        message: formatFangzhouRevealBasicRewardMessage(rewards),
      };
    }

    function handleFangzhouRevealSideEffects(alienSlotId, revealResult, triggerPlayer) {
      if (!fangzhou || !revealResult?.ok || revealResult.alienId !== fangzhou.ALIEN_ID) return null;
      const initResult = fangzhou.initializeFangzhouReveal(
        alienGameState,
        alienSlotId,
        triggerPlayer,
        getActivePlayers(),
      );
      const rewardResult = initResult.alreadyInitialized
        ? { ok: true, count: 0, rewards: [], message: null }
        : processFangzhouRevealBasicRewards();
      const rewardMessages = rewardResult.message ? [rewardResult.message] : [];
      return {
        ...initResult,
        rewardResult,
        rewardMessages,
        message: [initResult.message, ...rewardMessages].filter(Boolean).join("；"),
      };
    }

    function grantRevealCardsForFirstTraces(alienModule, label, alienSlotId) {
      if (!aliens.grantAlienCardsForFirstTraces) {
        return { ok: false, totalExpected: 0, totalDrawn: 0, grants: [], message: "" };
      }
      return aliens.grantAlienCardsForFirstTraces(
        alienGameState,
        alienSlotId,
        getActivePlayers(),
        alienModule,
        { label },
      );
    }

    function handleJiuzheRevealSideEffects(alienSlotId, revealResult, triggerPlayer) {
      if (!jiuzhe || !revealResult?.ok || revealResult.alienId !== jiuzhe.ALIEN_ID) return null;
      const initResult = jiuzhe.initializeJiuzheReveal(
        alienGameState,
        alienSlotId,
        triggerPlayer,
        getActivePlayers(),
      );
      for (const player of getActivePlayers()) {
        queueJiuzheOpportunitiesForPlayer(player);
      }
      return {
        ...initResult,
        rewardMessages: [],
        message: initResult.message,
      };
    }

    function handleYichangdianRevealSideEffects(alienSlotId, revealResult, triggerPlayer) {
      if (!yichangdian || !revealResult?.ok || revealResult.alienId !== yichangdian.ALIEN_ID) return null;
      const earth = getEarthSectorCoordinate();
      const initResult = yichangdian.initializeYichangdianReveal(
        alienGameState,
        alienSlotId,
        triggerPlayer,
        earth.x,
      );
      const cardGrant = initResult.alreadyInitialized
        ? null
        : grantRevealCardsForFirstTraces(yichangdian, "异常点", alienSlotId);
      return {
        ...initResult,
        cardGrant,
        rewardMessages: [],
        message: appendRevealCardGrantMessage(initResult.message, cardGrant),
      };
    }

    function handleBanrenmaRevealSideEffects(alienSlotId, revealResult, triggerPlayer) {
      if (!banrenma || !revealResult?.ok || revealResult.alienId !== banrenma.ALIEN_ID) return null;
      const initResult = banrenma.initializeBanrenmaReveal(
        alienGameState,
        alienSlotId,
        triggerPlayer,
        getActivePlayers(),
      );
      const cardGrant = initResult.alreadyInitialized
        ? null
        : grantRevealCardsForFirstTraces(banrenma, "半人马", alienSlotId);
      for (const player of getActivePlayers()) {
        queueBanrenmaOpportunitiesForPlayer(player);
      }
      return {
        ...initResult,
        cardGrant,
        rewardMessages: [],
        message: appendRevealCardGrantMessage(initResult.message, cardGrant),
      };
    }

    function handleChongRevealSideEffects(alienSlotId, revealResult, triggerPlayer) {
      if (!chong || !revealResult?.ok || revealResult.alienId !== chong.ALIEN_ID) return null;
      const initResult = chong.initializeChongReveal(
        alienGameState,
        alienSlotId,
        triggerPlayer,
      );
      const cardGrant = initResult.alreadyInitialized
        ? null
        : grantRevealCardsForFirstTraces(chong, "虫族", alienSlotId);
      return {
        ...initResult,
        cardGrant,
        rewardMessages: [],
        message: appendRevealCardGrantMessage(initResult.message, cardGrant),
      };
    }

    function handleAmibaRevealSideEffects(alienSlotId, revealResult, triggerPlayer) {
      if (!amiba || !revealResult?.ok || revealResult.alienId !== amiba.ALIEN_ID) return null;
      const initResult = amiba.initializeAmibaReveal(
        alienGameState,
        alienSlotId,
        triggerPlayer,
      );
      const cardGrant = initResult.alreadyInitialized
        ? null
        : grantRevealCardsForFirstTraces(amiba, "阿米巴", alienSlotId);
      return {
        ...initResult,
        cardGrant,
        rewardMessages: [],
        message: appendRevealCardGrantMessage(initResult.message, cardGrant),
      };
    }

    function activateAomomoBoard(options = {}) {
      solarState.aomomoActive = true;
      const existingTokens = data.listNebulaTokens(nebulaDataState, aomomo.NEBULA_ID);
      let fillResult = null;
      if (options.replaceData || !existingTokens.length) {
        if (options.replaceData) data.clearNebulaData(nebulaDataState, aomomo.NEBULA_ID);
        fillResult = data.fillNebulaData(nebulaDataState, aomomo.NEBULA_ID, {
          source: options.source || "aomomo_reveal",
        });
      }
      renderWheels();
      renderSectorNebulaDataBoard();
      renderRockets();
      return fillResult;
    }

    function handleAomomoRevealSideEffects(alienSlotId, revealResult, triggerPlayer) {
      if (!aomomo || !revealResult?.ok || revealResult.alienId !== aomomo.ALIEN_ID) return null;
      const initResult = aomomo.initializeAomomoReveal(
        alienGameState,
        alienSlotId,
        triggerPlayer,
      );
      const cardGrant = initResult.alreadyInitialized
        ? null
        : grantRevealCardsForFirstTraces(aomomo, "奥陌陌", alienSlotId);
      const fillResult = activateAomomoBoard({ source: "aomomo_reveal" });
      const fillMessage = fillResult?.ok ? `；${fillResult.message}` : "";
      const message = appendRevealCardGrantMessage(`${initResult.message}${fillMessage}`, cardGrant);
      return {
        ...initResult,
        cardGrant,
        rewardMessages: [],
        fillResult,
        message,
      };
    }

    function handleRunezuRevealSideEffects(alienSlotId, revealResult, triggerPlayer) {
      if (!runezu || !revealResult?.ok || revealResult.alienId !== runezu.ALIEN_ID) return null;
      const initResult = runezu.initializeRunezuReveal(
        alienGameState,
        alienSlotId,
        triggerPlayer,
        { techBoardState: techGameState.board },
      );
      const cardGrant = initResult.alreadyInitialized
        ? null
        : grantRevealCardsForFirstTraces(runezu, "符文族", alienSlotId);
      return {
        ...initResult,
        cardGrant,
        rewardMessages: [],
        message: appendRevealCardGrantMessage(initResult.message, cardGrant),
      };
    }

    function handleAlienRevealSideEffects(alienSlotId, revealResult, triggerPlayer) {
      return handleJiuzheRevealSideEffects(alienSlotId, revealResult, triggerPlayer)
        || handleYichangdianRevealSideEffects(alienSlotId, revealResult, triggerPlayer)
        || handleFangzhouRevealSideEffects(alienSlotId, revealResult, triggerPlayer)
        || handleBanrenmaRevealSideEffects(alienSlotId, revealResult, triggerPlayer)
        || handleChongRevealSideEffects(alienSlotId, revealResult, triggerPlayer)
        || handleAmibaRevealSideEffects(alienSlotId, revealResult, triggerPlayer)
        || handleAomomoRevealSideEffects(alienSlotId, revealResult, triggerPlayer)
        || handleRunezuRevealSideEffects(alienSlotId, revealResult, triggerPlayer);
    }

    function getAlienTraceActionPlayer(pending, options = {}) {
      const player = resolvePlayerReference({
        playerId: pending?.targetPlayerId || decisionState.alienTracePickerState?.targetPlayerId,
        playerColor: pending?.targetPlayerColor || decisionState.alienTracePickerState?.targetPlayerColor,
      });
      if (player) return player;
      if (options.allowFallback || isDebugAlienTraceMode()) return getCurrentPlayer();
      return null;
    }

    function failMissingAlienTraceTargetPlayer() {
      rocketState.statusNote = "外星人痕迹缺少目标玩家，已中止放置";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    function formatAlienFirstTraceRewardGain(gain = {}) {
      const parts = [];
      if (gain.score != null) parts.push(`${gain.score}分`);
      if (gain.publicity != null) parts.push(`${gain.publicity}宣传`);
      if (gain.credits != null) parts.push(`${gain.credits}信用点`);
      if (gain.energy != null) parts.push(`${gain.energy}能量`);
      if (gain.availableData != null) parts.push(`${gain.availableData}数据`);
      if (gain.additionalPublicScan != null) parts.push(`${gain.additionalPublicScan}额外公共扫描`);
      if (gain.handSize != null) parts.push(`${gain.handSize}手牌`);
      return parts.join("+");
    }

    function applyAlienFirstTraceReward(alienSlotId, traceType, player, placementResult) {
      if (!placementResult?.ok || placementResult.extraOnly) return null;
      const reward = aliens.getFirstTraceRewardForSlot?.(alienSlotId);
      const gain = reward?.gain || null;
      if (!gain || !Object.values(gain).some((value) => Number(value) !== 0)) return null;

      players.gainResources(player, gain);
      recordAlienTraceScore(player, traceType, gain);

      return {
        kind: "firstTraceReward",
        gain: { ...gain },
        message: `${aliens.getAlienSlotLabel(alienSlotId)}首痕迹奖励：${formatAlienFirstTraceRewardGain(gain) || "无奖励"}`,
      };
    }

    function applyAlienStateExtraTraceReward(alienSlotId, traceType, player, placementResult) {
      if (!placementResult?.ok || !placementResult.extraOnly) return null;
      const reward = aliens.getExtraTraceReward?.(alienSlotId, traceType);
      const gain = reward?.gain || null;
      if (!gain || !Object.values(gain).some((value) => Number(value) !== 0)) return null;

      players.gainResources(player, gain);
      recordAlienTraceScore(player, traceType, gain);

      return {
        kind: "stateExtraTraceReward",
        reward,
        gain: { ...gain },
        message: `${aliens.getAlienSlotLabel(alienSlotId)} state额外痕迹奖励：${formatAlienFirstTraceRewardGain(gain) || "无奖励"}`,
      };
    }

    function addFangzhouUnlockedCardToHand(player, handCard) {
      if (!player || !handCard) return false;
      if (!Array.isArray(player.hand)) player.hand = [];
      player.hand.push(handCard);
      if (player.resources) player.resources.handSize = player.hand.length;
      return true;
    }

    function maybeUnlockFangzhouCardForStateExtraTrace(alienSlotId, traceType, player, placementResult) {
      if (!placementResult?.ok || !placementResult.extraOnly) return null;
      if (!fangzhou?.isFangzhouRevealedSlot?.(alienGameState, alienSlotId)) return null;
      if (!fangzhou.canUnlockCard2ForTrace?.(alienGameState, player, traceType)) return null;

      const unlockResult = fangzhou.unlockCard2(alienGameState, player, traceType);
      if (unlockResult.ok) {
        addFangzhouUnlockedCardToHand(player, unlockResult.handCard);
      }
      return {
        kind: "fangzhouStateExtraUnlock",
        ok: Boolean(unlockResult.ok),
        traceType,
        unlockCount: unlockResult.unlockCount || null,
        cardId: unlockResult.handCard?.cardId || null,
        message: unlockResult.message,
      };
    }

    function applyAlienTraceAfterReward(pending, player, traceType) {
      const reward = pending?.afterTraceReward;
      if (!reward || reward.kind !== "traceCountScore") return null;
      const scorePer = Math.max(0, Math.round(Number(reward.scorePer) || 1));
      const count = Math.max(0, Math.round(Number(
        cardEffects.countTraceMarkers?.(player, alienGameState, traceType) || 0,
      )));
      const gain = { score: count * scorePer };
      if (gain.score > 0) {
        players.gainResources(player, gain);
        recordAlienTraceScore(player, traceType, gain);
      }
      return {
        kind: reward.kind,
        count,
        gain,
        message: `${aliens.getTraceTypeLabel(traceType)}痕迹 ${count} 个：${formatPlanetRewardGain(gain) || "无奖励"}`,
      };
    }

    function appendAlienTraceAfterRewardMessage(afterReward) {
      if (afterReward?.message) {
        rocketState.statusNote = `${rocketState.statusNote ? `${rocketState.statusNote}；` : ""}${afterReward.message}`;
      }
    }

    function recordPlacementHistory(beforeAlienState, beforePlayerState, alienMessage, playerMessage, options = {}) {
      const restoreAlien = historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        alienMessage,
      );
      const restorePlayer = historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        playerMessage,
      );
      if (options.quick) {
        recordQuickHistoryCommand(restoreAlien);
        recordQuickHistoryCommand(restorePlayer);
        return;
      }
      recordHistoryCommand(restoreAlien);
      recordHistoryCommand(restorePlayer);
    }

    function confirmAlienTracePlacement(alienSlotId, traceType) {
      const inDebugMode = isDebugAlienTraceMode();
      const pending = decisionState.alienTraceAction;
      const currentPlayer = getAlienTraceActionPlayer(pending, { allowFallback: inDebugMode });
      if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
      if (!inDebugMode && !isAlienTracePickerChoiceAllowed(alienSlotId, traceType)) {
        rocketState.statusNote = "该外星人痕迹目标不符合当前卡牌限制";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
      const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
      const beforeLogSnapshot = createActionLogImpactSnapshot(currentPlayer);
      decisionState.alienTraceAction = null;
      const result = aliens.placeFirstTrace(
        alienGameState,
        alienSlotId,
        traceType,
        currentPlayer.color,
      );
      if (!inDebugMode) {
        closeAlienTracePicker();
      }
      const firstTraceReward = result.ok
        ? applyAlienFirstTraceReward(alienSlotId, traceType, currentPlayer, result)
        : null;
      const stateExtraTraceReward = result.ok
        ? applyAlienStateExtraTraceReward(alienSlotId, traceType, currentPlayer, result)
        : null;
      const fangzhouStateExtraUnlock = result.ok
        ? maybeUnlockFangzhouCardForStateExtraTrace(alienSlotId, traceType, currentPlayer, result)
        : null;
      const revealResult = maybeRevealAlienAfterTrace(alienSlotId, result, { immediate: inDebugMode });
      const immediateRevealResult = revealResult?.delayed ? null : revealResult;
      const revealIrreversibleReason = immediateRevealResult?.ok
        ? "外星人揭示初始化随机内容"
        : null;
      const revealSideEffect = handleAlienRevealSideEffects(alienSlotId, immediateRevealResult, currentPlayer);
      const revealIrreversible = getRevealIrreversible(revealIrreversibleReason, revealSideEffect);
      rocketState.statusNote = [
        result.message,
        firstTraceReward?.message || null,
        stateExtraTraceReward?.message || null,
        fangzhouStateExtraUnlock?.message || null,
        revealSideEffect?.message || revealResult?.message || null,
      ].filter(Boolean).join("；");
      const traceEvents = result.ok && !inDebugMode
        ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, immediateRevealResult?.alienId || null)]
        : [];
      const alienLabRestore = result.ok ? maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType) : null;
      if (alienLabRestore?.changed) {
        rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
      }
      const afterReward = result.ok ? applyAlienTraceAfterReward(pending, currentPlayer, traceType) : null;
      appendAlienTraceAfterRewardMessage(afterReward);
      if (pending?.type === "planet_reward_alien_trace" && result.ok) {
        beginEffectHistoryStep(pending.effectLabel || "外星人标记奖励", { logBefore: beforeLogSnapshot });
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复外星人标记奖励前状态",
          "恢复外星人标记奖励前玩家状态",
        );
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: !revealIrreversible,
            irreversible: revealIrreversible,
            message: rocketState.statusNote,
            events: traceEvents,
            payload: {
              alienSlotId,
              traceType,
              revealed: immediateRevealResult || null,
              revealPending: revealResult?.delayed || false,
              firstTraceReward,
              stateExtraTraceReward,
              fangzhouStateExtraUnlock,
              afterReward,
            },
          };
        }
        completeCurrentActionEffect();
      } else if (pending?.type === "banrenma_bonus_alien_trace" && result.ok) {
        beginQuickActionStep("banrenma-alien-trace", pending.effectLabel || "半人马外星人痕迹", {
          logBefore: beforeLogSnapshot,
        });
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复半人马痕迹奖励前外星人状态",
          "恢复半人马痕迹奖励前玩家状态",
          { quick: true },
        );
        completeQuickActionStep(rocketState.statusNote);
        settleCardTasksAfterEffect({ events: traceEvents, render: true });
      } else if (result.ok) {
        settleCardTasksAfterEffect({ events: traceEvents, render: true });
      }
      renderAlienPanels();
      if (immediateRevealResult?.alienId === chong?.ALIEN_ID || immediateRevealResult?.alienId === aomomo?.ALIEN_ID) {
        renderRockets();
      }
      renderPlayerStats();
      renderPlayerHand();
      maybeContinueAlienRevealQueuedOpportunities();
      renderStateReadout();
      return revealResult || result;
    }

    function confirmYichangdianTracePlacement(alienSlotId, traceType, position) {
      const inDebugMode = isDebugAlienTraceMode();
      if (!yichangdian || (!isYichangdianTracePlacementMode() && !inDebugMode)) {
        rocketState.statusNote = "请先通过获取外星人标记进入异常点放置模式";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!canPlaceYichangdianTrace(alienSlotId, traceType, position)) {
        rocketState.statusNote = "该异常点痕迹位不可放置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const pending = decisionState.alienTraceAction;
      const currentPlayer = getAlienTraceActionPlayer(pending, { allowFallback: inDebugMode });
      if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
      const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
      const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
      if (!inDebugMode) {
        decisionState.alienTraceAction = null;
        clearAlienTracePlacementMode("yichangdian-grid");
      }

      const result = yichangdian.placeYichangdianTrace(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      );
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderAlienPanels();
        renderStateReadout();
        return result;
      }

      const rewardResult = applyYichangdianRewardToPlayer(
        currentPlayer,
        result.reward,
        `异常点${yichangdian.formatTraceLabel(traceType, Number(position))}`,
      );
      if (rewardResult.ok) recordAlienTraceScore(currentPlayer, traceType, result.reward?.gain);
      rocketState.statusNote = rewardResult.ok ? rewardResult.message : result.message;
      const traceEvents = !inDebugMode
        ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, yichangdian.ALIEN_ID)]
        : [];
      const alienLabRestore = maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType);
      if (alienLabRestore?.changed) {
        rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
      }
      const afterReward = applyAlienTraceAfterReward(pending, currentPlayer, traceType);
      appendAlienTraceAfterRewardMessage(afterReward);

      if (pending?.type === "planet_reward_alien_trace") {
        beginEffectHistoryStep(pending.effectLabel || "异常点痕迹奖励");
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复异常点痕迹奖励前外星人状态",
          "恢复异常点痕迹奖励前玩家状态",
        );
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: true,
            message: rocketState.statusNote,
            events: traceEvents,
            payload: { alienSlotId, traceType, position, reward: result.reward || null, afterReward },
          };
        }
      } else {
        settleCardTasksAfterEffect({ events: traceEvents, render: false });
      }

      renderAlienPanels();
      renderPlayerStats();

      if (result.reward?.pickAlienCard) {
        const openResult = openYichangdianCardGainDialog({
          player: currentPlayer,
          fromEffectFlow: pending?.type === "planet_reward_alien_trace",
          effectLabel: pending?.effectLabel || "异常点外星人牌",
          beforeAlienState,
          beforePlayerState,
        });
        if (!openResult.ok && pending?.type === "planet_reward_alien_trace") {
          completeCurrentActionEffect();
        }
        return result;
      }

      if (pending?.type === "planet_reward_alien_trace") {
        completeCurrentActionEffect();
      }
      updateActionButtons();
      maybeContinuePendingTurnEndRevealFlow();
      renderStateReadout();
      return result;
    }

    function confirmFangzhouTracePlacement(alienSlotId, traceType, position) {
      const inDebugMode = isDebugAlienTraceMode();
      if (!fangzhou || (!isFangzhouTracePlacementMode() && !inDebugMode)) {
        rocketState.statusNote = "请先通过获取外星人标记进入方舟放置模式";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!canPlaceFangzhouTrace(alienSlotId, traceType, position)) {
        rocketState.statusNote = "该方舟痕迹位不可放置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const pending = decisionState.alienTraceAction;
      const currentPlayer = getAlienTraceActionPlayer(pending, { allowFallback: inDebugMode });
      if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
      const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
      const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
      if (!inDebugMode) {
        decisionState.alienTraceAction = null;
        clearAlienTracePlacementMode("fangzhou-grid", "fangzhou-use");
      }

      const result = fangzhou.placeFangzhouTrace(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      );
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderAlienPanels();
        renderStateReadout();
        return result;
      }

      const rewardResult = applyFangzhouTraceRewardToPlayer(
        currentPlayer,
        result.reward,
        `方舟${fangzhou.formatTraceLabel(traceType, Number(position))}`,
        { scoreSourceKey: getAlienTraceScoreSourceKey(traceType) },
      );
      if (rewardResult.ok) recordAlienTraceScore(currentPlayer, traceType, result.reward?.gain);
      rocketState.statusNote = rewardResult.ok ? rewardResult.message : result.message;
      const traceEvents = !inDebugMode
        ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, fangzhou.ALIEN_ID)]
        : [];
      const alienLabRestore = maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType);
      if (alienLabRestore?.changed) {
        rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
      }
      const afterReward = applyAlienTraceAfterReward(pending, currentPlayer, traceType);
      appendAlienTraceAfterRewardMessage(afterReward);

      if (pending?.type === "planet_reward_alien_trace") {
        beginEffectHistoryStep(pending.effectLabel || "方舟痕迹奖励");
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复方舟痕迹奖励前外星人状态",
          "恢复方舟痕迹奖励前玩家状态",
        );
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: rewardResult.undoable !== false,
            irreversible: rewardResult.irreversible || null,
            message: rocketState.statusNote,
            events: traceEvents,
            payload: { alienSlotId, traceType, position, reward: result.reward || null, afterReward },
          };
        }
      } else {
        beginQuickActionStep("fangzhou-trace", rocketState.statusNote);
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复方舟痕迹放置前外星人状态",
          "恢复方舟痕迹放置前玩家状态",
          { quick: true },
        );
        completeQuickActionStep(null, rewardResult.irreversible ? {
          irreversibleCode: rewardResult.irreversible.code,
          irreversibleReason: rewardResult.irreversible.reason,
        } : {});
        settleCardTasksAfterEffect({ events: traceEvents, render: false });
      }

      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCards();

      if (pending?.type === "planet_reward_alien_trace") {
        completeCurrentActionEffect();
      }
      updateActionButtons();
      maybeContinuePendingTurnEndRevealFlow();
      renderStateReadout();
      return result;
    }

    function confirmBanrenmaTracePlacement(alienSlotId, traceType, position) {
      const inDebugMode = isDebugAlienTraceMode();
      if (!banrenma || (!isBanrenmaTracePlacementMode() && !inDebugMode)) {
        rocketState.statusNote = "请先通过获取外星人标记进入半人马放置模式";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!canPlaceBanrenmaTrace(alienSlotId, traceType, position)) {
        rocketState.statusNote = "该半人马痕迹位不可放置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const pending = decisionState.alienTraceAction;
      const currentPlayer = getAlienTraceActionPlayer(pending, { allowFallback: inDebugMode });
      if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
      const rewardPreview = banrenma.getTraceReward(traceType, Number(position));
      if (rewardPreview?.payData && getAvailableDataTokenCount(currentPlayer) < rewardPreview.payData) {
        rocketState.statusNote = `数据不足：该位置需要 ${rewardPreview.payData} 数据`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
      const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
      if (!inDebugMode) {
        decisionState.alienTraceAction = null;
        clearAlienTracePlacementMode("banrenma-grid");
      }

      const result = banrenma.placeBanrenmaTrace(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      );
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderAlienPanels();
        renderStateReadout();
        return result;
      }

      const rewardResult = applyBanrenmaRewardToPlayer(
        currentPlayer,
        result.reward,
        `半人马${banrenma.formatTraceLabel(traceType, Number(position))}`,
      );
      if (rewardResult.ok) recordAlienTraceScore(currentPlayer, traceType, result.reward?.gain);
      rocketState.statusNote = rewardResult.ok ? rewardResult.message : result.message;
      const traceEvents = !inDebugMode
        ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, banrenma.ALIEN_ID)]
        : [];
      const alienLabRestore = maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType);
      if (alienLabRestore?.changed) {
        rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
      }
      const afterReward = applyAlienTraceAfterReward(pending, currentPlayer, traceType);
      appendAlienTraceAfterRewardMessage(afterReward);

      if (pending?.type === "planet_reward_alien_trace") {
        beginEffectHistoryStep(pending.effectLabel || "半人马痕迹奖励");
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复半人马痕迹奖励前外星人状态",
          "恢复半人马痕迹奖励前玩家状态",
        );
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: rewardResult.undoable !== false,
            irreversible: rewardResult.irreversible || null,
            message: rocketState.statusNote,
            events: traceEvents,
            payload: { alienSlotId, traceType, position, reward: result.reward || null, afterReward },
          };
        }
      } else if (pending?.type === "banrenma_bonus_alien_trace") {
        beginQuickActionStep("banrenma-trace", pending.effectLabel || "半人马痕迹奖励");
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复半人马痕迹奖励前外星人状态",
          "恢复半人马痕迹奖励前玩家状态",
          { quick: true },
        );
        completeQuickActionStep();
        settleCardTasksAfterEffect({ events: traceEvents, render: false });
      } else {
        beginQuickActionStep("banrenma-trace", rocketState.statusNote);
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复半人马痕迹放置前外星人状态",
          "恢复半人马痕迹放置前玩家状态",
          { quick: true },
        );
        completeQuickActionStep();
        settleCardTasksAfterEffect({ events: traceEvents, render: false });
      }

      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCards();

      if (result.reward?.pickAlienCard) {
        const openResult = openBanrenmaCardGainDialog({
          player: currentPlayer,
          fromEffectFlow: pending?.type === "planet_reward_alien_trace",
          effectLabel: pending?.effectLabel || "半人马外星人牌",
          beforeAlienState,
          beforePlayerState,
        });
        if (!openResult.ok && pending?.type === "planet_reward_alien_trace") {
          completeCurrentActionEffect();
        }
        return result;
      }

      if (pending?.type === "planet_reward_alien_trace") {
        completeCurrentActionEffect();
      }
      updateActionButtons();
      maybeContinueAlienRevealQueuedOpportunities();
      renderStateReadout();
      return result;
    }

    function confirmAomomoTracePlacement(alienSlotId, traceType, position) {
      const inDebugMode = isDebugAlienTraceMode();
      if (!aomomo || (!isAomomoTracePlacementMode() && !inDebugMode)) {
        rocketState.statusNote = "请先通过获取外星人标记进入奥陌陌放置模式";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!canPlaceAomomoTrace(alienSlotId, traceType, position)) {
        rocketState.statusNote = "该奥陌陌痕迹位不可放置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const pending = decisionState.alienTraceAction;
      const currentPlayer = getAlienTraceActionPlayer(pending, { allowFallback: inDebugMode });
      if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
      const rewardPreview = aomomo.getTraceReward(traceType, Number(position));
      if (rewardPreview?.payFossils && !players.canAfford(currentPlayer, { aomomoFossils: rewardPreview.payFossils })) {
        rocketState.statusNote = `化石不足：该位置需要 ${rewardPreview.payFossils} 化石`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
      const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
      if (!inDebugMode) {
        decisionState.alienTraceAction = null;
        clearAlienTracePlacementMode("aomomo-grid");
      }

      const result = aomomo.placeAomomoTrace(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      );
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderAlienPanels();
        renderStateReadout();
        return result;
      }

      const rewardResult = applyAomomoRewardToPlayer(
        currentPlayer,
        result.reward,
        `奥陌陌${aomomo.formatTraceLabel(traceType, Number(position))}`,
      );
      if (rewardResult.ok) recordAlienTraceScore(currentPlayer, traceType, result.reward?.gain);
      rocketState.statusNote = rewardResult.ok ? rewardResult.message : result.message;
      const traceEvents = !inDebugMode
        ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, aomomo.ALIEN_ID)]
        : [];
      const alienLabRestore = maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType);
      if (alienLabRestore?.changed) {
        rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
      }
      const afterReward = applyAlienTraceAfterReward(pending, currentPlayer, traceType);
      appendAlienTraceAfterRewardMessage(afterReward);

      if (pending?.type === "planet_reward_alien_trace") {
        beginEffectHistoryStep(pending.effectLabel || "奥陌陌痕迹奖励");
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复奥陌陌痕迹奖励前外星人状态",
          "恢复奥陌陌痕迹奖励前玩家状态",
        );
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: true,
            message: rocketState.statusNote,
            events: traceEvents,
            payload: { alienSlotId, traceType, position, reward: result.reward || null, afterReward },
          };
        }
      } else {
        beginQuickActionStep("aomomo-trace", rocketState.statusNote);
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复奥陌陌痕迹放置前外星人状态",
          "恢复奥陌陌痕迹放置前玩家状态",
          { quick: true },
        );
        completeQuickActionStep();
        if (!result.reward?.pickAlienCard) {
          settleCardTasksAfterEffect({ events: traceEvents, render: false });
        }
      }

      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCards();

      if (result.reward?.pickAlienCard) {
        const openResult = openAomomoCardGainDialog({
          player: currentPlayer,
          fromEffectFlow: pending?.type === "planet_reward_alien_trace",
          effectLabel: pending?.effectLabel || "奥陌陌外星人牌",
          beforeAlienState,
          beforePlayerState,
          deferredEvents: pending?.type === "planet_reward_alien_trace" ? [] : traceEvents,
        });
        if (!openResult.ok && pending?.type === "planet_reward_alien_trace") {
          completeCurrentActionEffect();
        }
        return result;
      }

      if (pending?.type === "planet_reward_alien_trace") {
        completeCurrentActionEffect();
      }
      updateActionButtons();
      maybeContinuePendingTurnEndRevealFlow();
      renderStateReadout();
      return result;
    }

    function confirmChongTracePlacement(alienSlotId, traceType, position) {
      const inDebugMode = isDebugAlienTraceMode();
      if (!chong || (!isChongTracePlacementMode() && !inDebugMode)) {
        rocketState.statusNote = "请先通过获取外星人标记进入虫族放置模式";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!canPlaceChongTrace(alienSlotId, traceType, position)) {
        rocketState.statusNote = "该虫族痕迹位不可放置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const pending = decisionState.alienTraceAction;
      const currentPlayer = getAlienTraceActionPlayer(pending, { allowFallback: inDebugMode });
      if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
      const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
      const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
      if (!inDebugMode) {
        decisionState.alienTraceAction = null;
        clearAlienTracePlacementMode("chong-grid");
      }

      const result = chong.placeChongTrace(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      );
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderAlienPanels();
        renderStateReadout();
        return result;
      }

      const rewardResult = applyChongRewardToPlayer(
        currentPlayer,
        result.reward,
        `虫族${chong.formatTraceLabel(traceType, Number(position))}`,
      );
      if (rewardResult.ok) recordAlienTraceScore(currentPlayer, traceType, result.reward?.gain);
      rocketState.statusNote = rewardResult.ok ? rewardResult.message : result.message;
      const traceEvents = !inDebugMode
        ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, chong.ALIEN_ID)]
        : [];
      const alienLabRestore = maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType);
      if (alienLabRestore?.changed) {
        rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
      }
      const afterReward = applyAlienTraceAfterReward(pending, currentPlayer, traceType);
      appendAlienTraceAfterRewardMessage(afterReward);

      if (pending?.type === "planet_reward_alien_trace") {
        beginEffectHistoryStep(pending.effectLabel || "虫族痕迹奖励");
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复虫族痕迹奖励前外星人状态",
          "恢复虫族痕迹奖励前玩家状态",
        );
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: rewardResult.undoable !== false,
            irreversible: rewardResult.irreversible || null,
            message: rocketState.statusNote,
            events: traceEvents,
            payload: { alienSlotId, traceType, position, reward: result.reward || null, afterReward },
          };
        }
      } else {
        beginQuickActionStep("chong-trace", rocketState.statusNote);
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复虫族痕迹放置前外星人状态",
          "恢复虫族痕迹放置前玩家状态",
          { quick: true },
        );
        completeQuickActionStep(null, rewardResult.irreversible ? {
          irreversibleCode: rewardResult.irreversible.code,
          irreversibleReason: rewardResult.irreversible.reason,
        } : {});
        settleCardTasksAfterEffect({ events: traceEvents, render: false });
      }

      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCards();

      const openedFollowUp = openChongRewardFollowUps(
        result,
        currentPlayer,
        pending,
        beforeAlienState,
        beforePlayerState,
      );
      if (!openedFollowUp && pending?.type === "planet_reward_alien_trace") {
        completeCurrentActionEffect();
      }
      updateActionButtons();
      maybeContinuePendingTurnEndRevealFlow();
      renderStateReadout();
      return result;
    }

    function confirmAmibaTracePlacement(alienSlotId, traceType, position) {
      const inDebugMode = isDebugAlienTraceMode();
      if (!amiba || (!isAmibaTracePlacementMode() && !inDebugMode)) {
        rocketState.statusNote = "请先通过获取外星人标记进入阿米巴放置模式";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!canPlaceAmibaTrace(alienSlotId, traceType, position)) {
        rocketState.statusNote = "该阿米巴痕迹位不可放置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const pending = decisionState.alienTraceAction;
      const currentPlayer = getAlienTraceActionPlayer(pending, { allowFallback: inDebugMode });
      if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
      const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
      const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
      if (!inDebugMode) {
        decisionState.alienTraceAction = null;
        clearAlienTracePlacementMode("amiba-grid");
      }

      const result = amiba.placeAmibaTrace(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      );
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderAlienPanels();
        renderStateReadout();
        return result;
      }

      const rewardResult = applyAmibaRewardToPlayer(
        currentPlayer,
        result.reward,
        `阿米巴${amiba.formatTraceLabel(traceType, Number(position))}`,
      );
      if (rewardResult.ok) recordAlienTraceScore(currentPlayer, traceType, result.reward?.gain);
      rocketState.statusNote = rewardResult.ok ? rewardResult.message : result.message;
      const traceEvents = !inDebugMode
        ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, amiba.ALIEN_ID)]
        : [];
      const alienLabRestore = maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType);
      if (alienLabRestore?.changed) {
        rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
      }
      const afterReward = applyAlienTraceAfterReward(pending, currentPlayer, traceType);
      appendAlienTraceAfterRewardMessage(afterReward);

      if (pending?.type === "planet_reward_alien_trace") {
        beginEffectHistoryStep(pending.effectLabel || "阿米巴痕迹奖励");
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复阿米巴痕迹奖励前外星人状态",
          "恢复阿米巴痕迹奖励前玩家状态",
        );
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: true,
            message: rocketState.statusNote,
            events: traceEvents,
            payload: { alienSlotId, traceType, position, reward: result.reward || null, afterReward },
          };
        }
      } else if (!inDebugMode) {
        beginQuickActionStep("amiba-trace", rocketState.statusNote);
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复阿米巴痕迹放置前外星人状态",
          "恢复阿米巴痕迹放置前玩家状态",
          { quick: true },
        );
        completeQuickActionStep(null, rewardResult.irreversible ? {
          irreversibleCode: rewardResult.irreversible.code,
          irreversibleReason: rewardResult.irreversible.reason,
        } : {});
        settleCardTasksAfterEffect({ events: traceEvents, render: false });
      }

      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCards();

      const openedFollowUp = openAmibaRewardFollowUps(
        result,
        currentPlayer,
        pending,
        beforeAlienState,
        beforePlayerState,
      );
      if (!openedFollowUp && pending?.type === "planet_reward_alien_trace") {
        completeCurrentActionEffect();
      }
      updateActionButtons();
      maybeContinuePendingTurnEndRevealFlow();
      renderStateReadout();
      return result;
    }

    function confirmRunezuTracePlacement(alienSlotId, traceType, position) {
      const inDebugMode = isDebugAlienTraceMode();
      if (!runezu || (!isRunezuTracePlacementMode() && !inDebugMode)) {
        rocketState.statusNote = "请先通过获取外星人标记进入符文族放置模式";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!canPlaceRunezuTrace(alienSlotId, traceType, position)) {
        rocketState.statusNote = "该符文族痕迹位不可放置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const pending = decisionState.alienTraceAction;
      const currentPlayer = getAlienTraceActionPlayer(pending, { allowFallback: inDebugMode });
      if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
      const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
      const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
      if (!inDebugMode) {
        decisionState.alienTraceAction = null;
        clearAlienTracePlacementMode("runezu-grid");
      }

      const result = runezu.placeRunezuTrace(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      );
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderAlienPanels();
        renderStateReadout();
        return result;
      }

      const rewardResult = applyRunezuRewardToPlayer(
        currentPlayer,
        result.reward,
        `符文族${runezu.formatTraceLabel(traceType, Number(position))}`,
      );
      if (rewardResult.ok) recordAlienTraceScore(currentPlayer, traceType, result.reward?.gain);
      rocketState.statusNote = rewardResult.ok ? rewardResult.message : result.message;
      const traceEvents = !inDebugMode
        ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, runezu.ALIEN_ID)]
        : [];
      const alienLabRestore = maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType);
      if (alienLabRestore?.changed) {
        rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
      }
      const afterReward = applyAlienTraceAfterReward(pending, currentPlayer, traceType);
      appendAlienTraceAfterRewardMessage(afterReward);

      if (pending?.type === "planet_reward_alien_trace") {
        beginEffectHistoryStep(pending.effectLabel || "符文族痕迹奖励");
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复符文族痕迹奖励前外星人状态",
          "恢复符文族痕迹奖励前玩家状态",
        );
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: rewardResult.undoable !== false,
            irreversible: rewardResult.irreversible || null,
            message: rocketState.statusNote,
            events: traceEvents,
            payload: { alienSlotId, traceType, position, reward: result.reward || null, afterReward },
          };
        }
      } else if (!inDebugMode) {
        beginQuickActionStep("runezu-trace", rocketState.statusNote);
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复符文族痕迹放置前外星人状态",
          "恢复符文族痕迹放置前玩家状态",
          { quick: true },
        );
        completeQuickActionStep(null, rewardResult.irreversible ? {
          irreversibleCode: rewardResult.irreversible.code,
          irreversibleReason: rewardResult.irreversible.reason,
        } : {});
        settleCardTasksAfterEffect({ events: traceEvents, render: false });
      }

      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCards();

      const openedFollowUp = openRunezuRewardFollowUps(
        result,
        currentPlayer,
        pending,
        beforeAlienState,
        beforePlayerState,
      );
      if (!openedFollowUp && pending?.type === "planet_reward_alien_trace") {
        completeCurrentActionEffect();
      }
      updateActionButtons();
      maybeContinuePendingTurnEndRevealFlow();
      renderStateReadout();
      return result;
    }

    function confirmJiuzheTracePlacement(alienSlotId, traceType, position) {
      const inDebugMode = isDebugAlienTraceMode();
      if (!jiuzhe || (!isJiuzheTracePlacementMode() && !inDebugMode)) {
        rocketState.statusNote = "请先通过获取外星人标记进入九折放置模式";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!canPlaceJiuzheTrace(alienSlotId, traceType, position)) {
        rocketState.statusNote = "该九折痕迹位不可放置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const pending = decisionState.alienTraceAction;
      const currentPlayer = getAlienTraceActionPlayer(pending, { allowFallback: inDebugMode });
      if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
      const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
      const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
      if (!inDebugMode) {
        decisionState.alienTraceAction = null;
        clearAlienTracePlacementMode("jiuzhe-grid");
      }

      const result = jiuzhe.placeJiuzheTrace(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      );
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderAlienPanels();
        renderStateReadout();
        return result;
      }

      const rewardResult = applyJiuzheRewardToPlayer(
        currentPlayer,
        result.reward,
        `九折${jiuzhe.formatTraceLabel(traceType, Number(position))}`,
      );
      if (rewardResult.ok) recordAlienTraceScore(currentPlayer, traceType, result.reward?.gain);
      rocketState.statusNote = rewardResult.ok ? rewardResult.message : result.message;
      const traceEvents = !inDebugMode
        ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, jiuzhe.ALIEN_ID)]
        : [];
      const alienLabRestore = maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType);
      if (alienLabRestore?.changed) {
        rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
      }
      const afterReward = applyAlienTraceAfterReward(pending, currentPlayer, traceType);
      appendAlienTraceAfterRewardMessage(afterReward);

      if (pending?.type === "planet_reward_alien_trace") {
        beginEffectHistoryStep(pending.effectLabel || "九折痕迹奖励");
        recordPlacementHistory(
          beforeAlienState,
          beforePlayerState,
          "恢复九折痕迹奖励前外星人状态",
          "恢复九折痕迹奖励前玩家状态",
        );
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: true,
            message: rocketState.statusNote,
            events: traceEvents,
            payload: { alienSlotId, traceType, position, reward: result.reward || null, afterReward },
          };
        }
      } else {
        settleCardTasksAfterEffect({ events: traceEvents, render: false });
      }

      renderAlienPanels();
      renderPlayerStats();

      if (result.reward?.pickCard) {
        const pickResult = beginCardSelection({
          type: "jiuzhe_trace_pick",
          player: currentPlayer,
          fromEffectFlow: pending?.type === "planet_reward_alien_trace",
          effectLabel: pending?.effectLabel || "九折痕迹精选",
        });
        if (!pickResult.ok && pending?.type === "planet_reward_alien_trace") {
          completeCurrentActionEffect();
        }
        return result;
      }

      if (pending?.type === "planet_reward_alien_trace") {
        completeCurrentActionEffect();
      }
      updateActionButtons();
      maybeContinuePendingTurnEndRevealFlow();
      renderStateReadout();
      return result;
    }

    function settleTurnEndAlienRevealEntries(triggerPlayer, revealEntries) {
      const settledEntries = (revealEntries || []).map((entry) => {
        const sideEffect = entry.sideEffect !== undefined
          ? entry.sideEffect
          : handleAlienRevealSideEffects(entry.alienSlotId, entry.revealResult, triggerPlayer);
        return {
          ...entry,
          sideEffect,
          message: sideEffect?.message || entry.revealResult?.message || null,
        };
      });

      const messages = settledEntries.map((entry) => entry.message).filter(Boolean);
      const message = messages.length
        ? `回合结束揭示外星人：${messages.join("；")}`
        : "回合结束揭示外星人";
      markCurrentActionIrreversible("回合结束揭示外星人", "alien_reveal_turn_end");
      appendActionLogStep(HISTORY_SOURCE_MAIN, "回合结束揭示外星人", message, {
        player: triggerPlayer,
        undoable: false,
        irreversibleCode: "alien_reveal_turn_end",
        irreversibleReason: "回合结束揭示外星人",
      });
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCards();
      renderRockets();
      renderSectorNebulaDataBoard();
      maybeContinueAlienRevealQueuedOpportunities();
      renderStateReadout();
      return settledEntries;
    }

    return {
      handleJiuzheRevealSideEffects,
      handleYichangdianRevealSideEffects,
      handleFangzhouRevealSideEffects,
      handleBanrenmaRevealSideEffects,
      handleChongRevealSideEffects,
      handleAmibaRevealSideEffects,
      handleAomomoRevealSideEffects,
      handleRunezuRevealSideEffects,
      handleAlienRevealSideEffects,
      failMissingAlienTraceTargetPlayer,
      getAlienTraceActionPlayer,
      confirmAlienTracePlacement,
      confirmYichangdianTracePlacement,
      confirmFangzhouTracePlacement,
      confirmBanrenmaTracePlacement,
      confirmAomomoTracePlacement,
      confirmChongTracePlacement,
      confirmAmibaTracePlacement,
      confirmRunezuTracePlacement,
      confirmJiuzheTracePlacement,
      settleTurnEndAlienRevealEntries,
    };
  }

  return {
    createAlienRuntimeHelpers,
  };
});
