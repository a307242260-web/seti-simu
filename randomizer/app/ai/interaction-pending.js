(function (root, factory) {
  "use strict";

  let heuristicEvaluator = root.SetiHeuristicEvaluator;
  if (!heuristicEvaluator && typeof require === "function") {
    heuristicEvaluator = require("../../game/ai/heuristic-evaluator");
  }
  const api = factory(heuristicEvaluator);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppAiInteractionPending = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (heuristicEvaluator) {
  "use strict";

  function createInteractionPendingRuntime(context) {
    if (!context || typeof context !== "object") {
      throw new Error("createInteractionPendingRuntime requires explicit app context");
    }
    const {
      AI_MAX_CARD_CORNER_MOVES_PER_TURN, AI_MOVE_DIRECTIONS, AI_RESOURCE_VALUES, FINAL_ROUND_NUMBER, MOVE_ENERGY_COST, abilities, ai, aiAutoBattleState,
      aiNumber, aliens, amiba, aomomo, applyAiStrategyWeight, banrenma, buildAiChongTransportMoveCandidate,
      buildAiPlayCardCandidate, canAiContinueCardMoveAfterStep, canAiPlanetAcceptLanding, canAiPlanetAcceptOrbit, canPayForMove, cancelTechSelection, cardEffects,
      chong, chooseAiLandChoice, confirmLandTargetPicker,
      confirmTechBlueSlotChoice, createActionContext, data, els,
      enrichAiAlienUseOptions, fangzhou, formatRocketLabel,
      getAiAlienCardConversionMultiplier, getAiAlienTraceRewardForValuation, getAiAlienTraceTargetDemandForSlot, getAiAvailableDataRoom, getAiDiscardedCardOpportunityCost, getAiMapDemand, getAiNextActionEffect, getAiNextMissingFinalScoreThreshold,
      getAiPlanetAtCoordinate, getAiResearchTechCandidateExecutionCheck, getAiResearchTechSelectionOptionsForEffect, getAiResourceValuesForRound, getAiRoundNumber, getAiStrategyDemand, getAlienTraceActionPlayer,
      getCurrentActionEffect,
      getRequiredMovePointsForUi, handleAmibaCardGainChoice, handleAmibaSymbolChoice, handleAmibaTraceRemovalChoice, handleAomomoCardGainChoice, handleBanrenmaBonusChoice, handleBanrenmaCardConditionChoice,
      handleBanrenmaCardGainChoice, handleChongCardGainChoice, handleChongFossilChoice,
      handleJiuzheCardChoice, handleJiuzheOpportunitySkip,
      handleRunezuCardGainChoice, handleRunezuFaceSymbolChoice, handleRunezuSymbolBranchChoice, handleSupplyTechTileClick, handleYichangdianCardGainChoice, handleYichangdianCornerChoice,
      industry, isActionEffectFlowActive, isAiAutoBattlePlayer, isAiChongFossilToken, isAiChongPickupPlanetId, isAiChongTravelEffect, isAiHiddenFirstTraceColorLost, isAiHiddenFirstTraceTakenByOpponent,
      isAiLandingEffect, isAiOpenHiddenFirstTraceTarget, isTechTilePickingActive, jiuzhe, listAiBorrowTechCandidates,
      listAiResearchTechCandidates, moveRocket, players, recordAiAutoBattleLog, rocketActions,
      roundAiScore, runezu, scoreAiAlienTraceValue, scoreAiAomomoTraceTimingValue, scoreAiB1TraceMarginalValue, scoreAiBanrenmaTraceTimingValue,
      scoreAiFangzhouUnlockChoiceValue, scoreAiFinalSecondMarkNoDirectSetupPenalty, scoreAiHighCostPointConversionPenalty, scoreAiLandingAfterMove, scoreAiLateAlienCardConversionPenalty, scoreAiMoveArrivalRewardValue,
      scoreAiMovePaymentCost, scoreAiMoveTowardTargets, scoreAiMovementPathPenalty, scoreAiNearestActionablePlanetTimingPenalty, scoreAiPaceValueForDirectScore, scoreAiResourceBundle, scoreAiSecondFinalMarkNudgeValue, scoreAiThirdFinalMarkCashoutValue,
      scoreAiYichangdianAlienCardTracePriorityValue, scoreAiYichangdianTraceTimingValue, selectExecutableAiResearchTechCandidate, shouldAiPreserveEnergyForRouteCashout, skipCurrentActionEffect, solar, state, summarizeAiScanTargetChoiceEntry,
      tech, yichangdian,
    } = context;

    function requireWorkingRoot(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") throw new TypeError("AI interaction pending requires an explicit workingRoot");
      return workingRoot;
    }

    function getWorkingCurrentPlayer(workingRoot) {
      return players.getCurrentPlayer(requireWorkingRoot(workingRoot).playerState);
    }

    function resolveWorkingPlayerById(workingRoot, playerId) {
      return (requireWorkingRoot(workingRoot).playerState.players || []).find((player) => player.id === playerId) || null;
    }

    function resolveWorkingPlayerReference(workingRoot, reference = {}) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const options = reference.options || {};
      const playerId = reference.playerId || options.playerId || options.targetPlayerId || null;
      const playerColor = reference.playerColor || options.playerColor || options.targetPlayerColor || null;
      return (playerState.players || []).find((player) => (
        (playerId && player.id === playerId) || (playerColor && player.color === playerColor)
      )) || null;
    }

    function getWorkingEffectOwnerPlayer(workingRoot, effect) {
      return resolveWorkingPlayerReference(workingRoot, effect?.options || effect) || getWorkingCurrentPlayer(workingRoot);
    }

    function getWorkingMovableTokens(workingRoot, playerId) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      return rocketActions.getMovableTokensForPlayer
        ? rocketActions.getMovableTokensForPlayer(rocketState, playerId)
        : rocketActions.getRocketsForPlayer(rocketState, playerId);
    }

    const selectScoredItem = ai?.heuristicEvaluator?.selectScoredItem || heuristicEvaluator.selectScoredItem;

    function getAiMoveTurnKey(workingRoot, playerId = requireWorkingRoot(workingRoot).playerState.currentPlayerId) {
      const { turnState } = requireWorkingRoot(workingRoot);
      return `${turnState.roundNumber}:${turnState.turnNumber}:${playerId || "unknown"}`;
    }

    function getAiMoveCountThisTurn(workingRoot, playerId = requireWorkingRoot(workingRoot).playerState.currentPlayerId) {
      const key = getAiMoveTurnKey(workingRoot, playerId);
      return Math.max(0, Math.round(Number(aiAutoBattleState.turnMoveCounts[key]) || 0));
    }

    function incrementAiMoveCountThisTurn(workingRoot, playerId = requireWorkingRoot(workingRoot).playerState.currentPlayerId) {
      const key = getAiMoveTurnKey(workingRoot, playerId);
      aiAutoBattleState.turnMoveCounts[key] = getAiMoveCountThisTurn(workingRoot, playerId) + 1;
    }

    function canAiMoveThisTurn(workingRoot, playerId = requireWorkingRoot(workingRoot).playerState.currentPlayerId) {
      return getAiMoveCountThisTurn(workingRoot, playerId) < aiAutoBattleState.maxMovesPerTurn;
    }

    function getAiCardCornerMoveCountThisTurn(workingRoot, playerId = requireWorkingRoot(workingRoot).playerState.currentPlayerId) {
      const key = getAiMoveTurnKey(workingRoot, playerId);
      return Math.max(0, Math.round(Number(aiAutoBattleState.turnCardCornerMoveCounts[key]) || 0));
    }

    function incrementAiCardCornerMoveCountThisTurn(workingRoot, playerId = requireWorkingRoot(workingRoot).playerState.currentPlayerId) {
      const key = getAiMoveTurnKey(workingRoot, playerId);
      aiAutoBattleState.turnCardCornerMoveCounts[key] = getAiCardCornerMoveCountThisTurn(workingRoot, playerId) + 1;
    }

    function canAiUseCardCornerMoveThisTurn(workingRoot, playerId = requireWorkingRoot(workingRoot).playerState.currentPlayerId) {
      return getAiCardCornerMoveCountThisTurn(workingRoot, playerId) < AI_MAX_CARD_CORNER_MOVES_PER_TURN;
    }


    function getAiPendingDecisionPlayer(workingRoot, pending = null) {
      return resolveWorkingPlayerReference(workingRoot, pending || pending?.effect || getCurrentActionEffect?.() || {});
    }

    function queryAiButtons(selector) {
      return [...(els.scanTargetActions?.querySelectorAll(selector) || [])]
        .filter((button) => button && !button.disabled);
    }

    function chooseFirstAiButton(selector) {
      return queryAiButtons(selector)[0] || null;
    }

    function scoreAiStrategyPassiveSlotChoice(workingRoot, slotId, player = getWorkingCurrentPlayer(workingRoot)) {
      const reward = industry?.getStrategySlotReward?.(slotId) || null;
      if (!reward) return -Infinity;
      const bundle = {};
      if (reward.credits) bundle.credits = reward.credits;
      if (reward.publicity) bundle.publicity = reward.publicity;
      if (reward.data) bundle.availableData = reward.data;
      let value = scoreAiResourceBundle(bundle);
      if (reward.data && getAiAvailableDataRoom(player) <= 0) value -= 4;
      return value;
    }

    function runAiLandTargetDecision(workingRoot) {
      if (!els.landTargetOverlay || els.landTargetOverlay.hidden) return null;
      const pending = state.pendingLandTargetAction || null;
      const player = getAiPendingDecisionPlayer(workingRoot, pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择登陆目标` };
      }
      const optionCount = els.landTargetSelect?.options?.length || 0;
      if (optionCount <= 0) {
        return { ok: false, blocked: true, message: "AI 没有可选登陆目标" };
      }
      const options = typeof pending?.getOptions === "function"
        ? pending.getOptions()
        : abilities.planet.getLandOptions(createActionContext(workingRoot));
      const selected = options?.ok
        ? chooseAiLandChoice(options.choices || [], player)
        : null;
      const selectedIndex = Math.min(
        optionCount - 1,
        Math.max(0, selected?.index ?? 0),
      );
      els.landTargetSelect.value = String(selectedIndex);
      recordAiAutoBattleLog("land-target", `${player.colorLabel}AI 选择登陆目标 ${selectedIndex + 1}`, {
        logPlayerId: player.id,
        optionCount,
        planetId: els.landTargetOverlay.dataset.planetId || null,
        selectedIndex,
        selected: selected
          ? {
            label: selected.choice?.label || null,
            target: selected.choice?.target || null,
            score: selected.score,
          }
          : null,
      });
      const result = confirmLandTargetPicker();
      return result || { ok: true, progressed: true, message: "AI 已选择登陆目标" };
    }

        function buildAiEffectMoveCandidate(workingRoot, rocket, direction, index = 0, options = {}) {
      const { alienGameState, rocketState, playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = options.player || getWorkingCurrentPlayer(workingRoot);
      const moveCheck = rocketActions.canMoveRocket(
        rocketState,
        rocket.id,
        direction.deltaX,
        direction.deltaY,
      );
      if (!moveCheck.ok) return null;

      const effect = options.effect || null;
      const explicitPoolRemaining = options.poolRemaining ?? effect?.options?.movementPoints ?? null;
      const poolRemaining = explicitPoolRemaining == null
        ? 0
        : Math.max(0, Math.round(Number(explicitPoolRemaining) || 0));
      const terrainRequired = getRequiredMovePointsForUi(
        workingRoot,
        currentPlayer,
        rocket.id,
        direction.deltaX,
        direction.deltaY,
        effect?.options || {},
      );
      if (options.free && poolRemaining > 0 && terrainRequired > poolRemaining) return null;
      const paymentRequired = options.free
        ? 0
        : Math.max(0, terrainRequired - Math.min(poolRemaining, terrainRequired));
      if (paymentRequired > 0 && !canPayForMove(currentPlayer, paymentRequired).ok) return null;

      const from = rocketActions.getRocketSectorCoordinate(rocket);
      const to = from
        ? {
          x: solar.mod8(from.x + direction.deltaX),
          y: Math.min(
            rocketActions.SECTOR_RING_MAX,
            Math.max(rocketActions.SECTOR_RING_MIN, from.y + direction.deltaY),
          ),
        }
        : null;
      const poolUsed = Math.min(poolRemaining, terrainRequired);
      const remainingPoolAfterStep = Math.max(0, poolRemaining - poolUsed);
      const nextEffect = options.nextEffect || null;
      const landingRequiredThisStep = isAiLandingEffect(nextEffect);
      const originPlanet = getAiPlanetAtCoordinate(from);
      const destinationPlanet = getAiPlanetAtCoordinate(to);
      if (isAiChongTravelEffect(nextEffect)) {
        const destinationPlanetId = destinationPlanet?.planetId || null;
        if (
          !isAiChongPickupPlanetId(destinationPlanetId)
          || !(chong?.getAvailablePlanetFossils?.(alienGameState, destinationPlanetId) || []).length
        ) {
          return null;
        }
      }
      const isB49PublicityMoveFollowup = /b49-visit-publicity-move-followup-pay-publicity-move/.test(String(effect?.id || ""));
      if (
        isB49PublicityMoveFollowup
        && !landingRequiredThisStep
        && originPlanet?.planetId
        && originPlanet.planetId !== "earth"
        && (
          canAiPlanetAcceptLanding(originPlanet.planetId, currentPlayer)
          || canAiPlanetAcceptOrbit(originPlanet.planetId)
        )
      ) {
        return null;
      }
      if (
        isB49PublicityMoveFollowup
        && !landingRequiredThisStep
        && destinationPlanet?.planetId
        && destinationPlanet.planetId !== "earth"
      ) {
        return null;
      }
      if (
        effect?.type === cardEffects.EFFECT_TYPES.CARD_MOVE
        && remainingPoolAfterStep > 0
        && !canAiContinueCardMoveAfterStep(rocket, to, remainingPoolAfterStep, effect, currentPlayer)
      ) {
        return null;
      }
      const paymentCost = paymentRequired > 0
        ? scoreAiMovePaymentCost(currentPlayer, paymentRequired)
        : 0;
      if (isAiChongFossilToken(rocket)) {
        return buildAiChongTransportMoveCandidate({
          id: options.id || "effectMove",
          kind: "effect",
          rocket,
          direction,
          index,
          player: currentPlayer,
          from,
          to,
          terrainRequired,
          paymentRequired,
          paymentCost,
          free: options.free,
          effect,
          nextEffect,
        });
      }
      const landingScore = landingRequiredThisStep
        ? scoreAiLandingAfterMove(to, nextEffect, currentPlayer)
        : { ok: true, score: 0, planet: null };
      if (!landingScore.ok) return null;
      const routeScore = scoreAiMoveTowardTargets(from, to, currentPlayer, {
        rocket,
        effect,
        nextEffect,
      });
      const finalSecondMarkNoDirectSetupPenalty = scoreAiFinalSecondMarkNoDirectSetupPenalty(currentPlayer, {
        actionId: options.id || "effectMove",
        directScoreGain: 0,
        followupDirectScore: landingScore.directScoreGain,
        setupScore: routeScore.score,
        consumesHand: false,
        noCashoutRoute: Math.max(0, aiNumber(landingScore.directScoreGain)) <= 0
          && routeScore.target?.kind === "planet",
      });
      const movementGain = applyAiStrategyWeight(applyAiStrategyWeight(routeScore.score, "route", 0.7), "move", 0.8) * 0.75
        + direction.score * 0.08
        + scoreAiMoveArrivalRewardValue(to, currentPlayer, { free: paymentRequired <= 0 }) * 0.85
        + applyAiStrategyWeight(landingScore.score, "orbitLand", 0.6);
      const nearestActionablePlanetPenalty = scoreAiNearestActionablePlanetTimingPenalty({
        player: currentPlayer,
        effect,
        nextEffect,
        from,
        to,
        direction,
        routeScore,
        followupScore: landingScore.score,
        remainingPoolAfterStep,
        industryHuanyuMove: options.industryHuanyuMove,
      });
      const pathPenalty = scoreAiMovementPathPenalty({
        player: currentPlayer,
        effect,
        nextEffect,
        from,
        to,
        direction,
        requiredMovePoints: terrainRequired,
        routeScore,
        followupScore: landingScore.score,
        remainingPoolAfterStep,
        nearestActionablePlanetPenalty,
        industryHuanyuMove: options.industryHuanyuMove,
      });
      const movementCost = paymentCost + pathPenalty + finalSecondMarkNoDirectSetupPenalty;
      return {
        id: options.id || "effectMove",
        kind: "effect",
        available: true,
        rocketId: rocket.id,
        rocketLabel: formatRocketLabel(rocket),
        direction: direction.id,
        directionLabel: direction.label,
        deltaX: direction.deltaX,
        deltaY: direction.deltaY,
        from,
        to,
        terrainRequired,
        paymentRequired,
        routeTarget: routeScore.target,
        followupLanding: landingRequiredThisStep
          ? {
            planetId: landingScore.planet?.planetId || null,
            planetName: landingScore.planet?.name || null,
            score: landingScore.score,
          }
          : null,
        gain: movementGain,
        cost: movementCost + index * 0.1,
        score: movementGain - movementCost - index * 0.1,
        valueBreakdown: {
          movementGain,
          paymentCost,
          pathPenalty,
          nearestActionablePlanetPenalty,
          finalSecondMarkNoDirectSetupPenalty,
          movementCost,
          routeScore: routeScore.score,
          landingScore: landingScore.score,
          landingDirectScoreGain: landingScore.directScoreGain || 0,
          terrainRequired,
          paymentRequired,
          remainingPoolAfterStep,
          industryHuanyuMove: isAiIndustryHuanyuMoveContext({ ...options, effect }),
        },
      };
    }

    function isAiIndustryHuanyuMoveEffect(effect) {
      return Boolean(
        effect?.options?.industryHuanyuMoveGroupId
        && effect.options?.requireDifferentRocketInGroup,
      );
    }

    function isAiIndustryHuanyuMoveContext(options = {}) {
      return Boolean(options.industryHuanyuMove || isAiIndustryHuanyuMoveEffect(options.effect));
    }

    function getAiCompletedIndustryHuanyuMoveRocketIds(effect) {
      const groupId = effect?.options?.industryHuanyuMoveGroupId || null;
      if (!groupId || !state.pendingActionEffectFlow?.effects?.length) return new Set();
      const used = new Set();
      for (const candidate of state.pendingActionEffectFlow.effects) {
        if (!candidate || candidate === effect || candidate.id === effect.id) continue;
        if (candidate.options?.industryHuanyuMoveGroupId !== groupId) continue;
        if (candidate.status !== "completed" || candidate.result?.skipped) continue;
        const rocketId = Math.round(Number(
          candidate.result?.payload?.rocketId
          ?? candidate.result?.rocket?.id
          ?? candidate.result?.rocketId,
        ));
        if (Number.isInteger(rocketId)) used.add(rocketId);
      }
      return used;
    }

    function listAiEffectMoveCandidates(workingRoot, options = {}) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = options.player || getWorkingCurrentPlayer(workingRoot);
      if (!currentPlayer) return [];
      const effect = options.effect || getCurrentActionEffect?.() || null;
      const usedHuanyuRocketIds = isAiIndustryHuanyuMoveEffect(effect)
        ? getAiCompletedIndustryHuanyuMoveRocketIds(effect)
        : null;
      return getWorkingMovableTokens(workingRoot, currentPlayer.id)
        .filter((rocket) => !usedHuanyuRocketIds?.has(Number(rocket.id)))
        .flatMap((rocket, index) => AI_MOVE_DIRECTIONS
          .map((direction) => buildAiEffectMoveCandidate(workingRoot, rocket, direction, index, {
            ...options,
            effect,
          }))
          .filter(Boolean));
    }

    function getAiAlienTraceButtons(selector, roots = []) {
      return [...(roots || [])]
        .flatMap((root) => [...(root?.querySelectorAll?.(selector) || [])])
        .filter((button) => button && !button.disabled)
        .map((button) => button);
    }

    function listAiAlienStateTraceTargets(options = {}) {
      const pickerMode = String(state.alienTracePickerState?.mode || "");
      if (
        pickerMode !== "debug-direct"
        && pickerMode !== "trace-board"
        && !pickerMode.endsWith("-grid")
      ) return [];
      return getAiAlienTraceButtons("[data-state-trace-slot].is-placeable", els.alienTraceLayers || [])
        .map((button) => ({ kind: "state-slot", button }));
    }

    function listAiAlienGridTraceTargets() {
      const pickerMode = String(state.alienTracePickerState?.mode || "");
      const selectorsByMode = {
        "banrenma-grid": "[data-banrenma-trace-slot].is-placeable",
        "yichangdian-grid": "[data-yichangdian-trace-slot].is-placeable",
        "fangzhou-grid": "[data-fangzhou-trace-slot].is-placeable",
        "chong-grid": "[data-chong-trace-slot].is-placeable",
        "amiba-grid": "[data-amiba-trace-slot].is-placeable",
        "aomomo-grid": "[data-aomomo-trace-slot].is-placeable",
        "runezu-grid": "[data-runezu-trace-slot].is-placeable",
        "jiuzhe-grid": "[data-jiuzhe-trace-slot].is-placeable",
      };
      const gridSelectors = pickerMode === "trace-board"
        ? Object.values(selectorsByMode).join(",")
        : selectorsByMode[pickerMode];
      if (!gridSelectors) return [];
      return getAiAlienTraceButtons(gridSelectors, els.alienJiuzheTraceLayers || [])
        .map((button) => ({ kind: "grid-slot", button }));
    }

    function listAiAlienPickerTargets() {
      return [...(els.alienTraceActions?.querySelectorAll("[data-alien-picker-step][data-alien-slot]") || [])]
        .filter((button) => !button.disabled)
        .map((button) => ({ kind: "picker", button }));
    }

    function getAiAlienTraceTargetTraceType(target) {
      const button = target?.button;
      return button?.dataset?.traceType
        || button?.dataset?.stateTraceType
        || button?.dataset?.banrenmaTraceType
        || button?.dataset?.yichangdianTraceType
        || button?.dataset?.fangzhouTraceType
        || button?.dataset?.chongTraceType
        || button?.dataset?.amibaTraceType
        || button?.dataset?.aomomoTraceType
        || button?.dataset?.runezuTraceType
        || button?.dataset?.jiuzheTraceType
        || state.alienTracePickerState?.selectedTraceType
        || (state.alienTracePickerState?.allowedTraceTypes?.length === 1
          ? state.alienTracePickerState.allowedTraceTypes[0]
          : null);
    }

    function getAiAlienTraceTargetPosition(target) {
      const dataset = target?.button?.dataset || {};
      const raw = dataset.tracePosition
        || dataset.position
        || dataset.stateTraceSlot
        || dataset.banrenmaPosition
        || dataset.yichangdianPosition
        || dataset.fangzhouPosition
        || dataset.chongPosition
        || dataset.amibaPosition
        || dataset.aomomoPosition
        || dataset.runezuPosition
        || dataset.jiuzhePosition
        || dataset.banrenmaTraceSlot
        || dataset.yichangdianTraceSlot
        || dataset.fangzhouTraceSlot
        || dataset.chongTraceSlot
        || dataset.amibaTraceSlot
        || dataset.aomomoTraceSlot
        || dataset.runezuTraceSlot
        || dataset.jiuzheTraceSlot;
      const match = String(raw || "").match(/\d+/);
      return match ? Number(match[0]) : null;
    }

    function getAiAlienTraceTargetMode(target, fallbackMode = state.alienTracePickerState?.mode || "") {
      const button = target?.button;
      if (target?.kind === "picker" && button?.dataset?.alienPickerStep === "fangzhou-use") {
        return "fangzhou-use";
      }
      if (target?.kind === "grid-slot" && button?.matches) {
        if (button.matches("[data-banrenma-trace-slot]")) return "banrenma-grid";
        if (button.matches("[data-yichangdian-trace-slot]")) return "yichangdian-grid";
        if (button.matches("[data-fangzhou-trace-slot]")) return "fangzhou-grid";
        if (button.matches("[data-chong-trace-slot]")) return "chong-grid";
        if (button.matches("[data-amiba-trace-slot]")) return "amiba-grid";
        if (button.matches("[data-aomomo-trace-slot]")) return "aomomo-grid";
        if (button.matches("[data-runezu-trace-slot]")) return "runezu-grid";
        if (button.matches("[data-jiuzhe-trace-slot]")) return "jiuzhe-grid";
      }
      return String(fallbackMode || "");
    }

    function scoreAiAlienGridPosition(mode, traceType, position, label) {
      const trace = String(traceType || "");
      const pos = Number(position);
      const positionLadder = scoreAiRevealedAlienGridPosition(pos);
      if (mode === "yichangdian-grid") {
        return 1.4 + positionLadder * 0.55 + (pos >= 4 ? 1.2 : 0);
      }
      if (mode === "fangzhou-grid") {
        if (label.includes("解锁")) return 10 + positionLadder * 0.4;
        return 3 + positionLadder;
      }
      if (mode === "banrenma-grid") return 3 + positionLadder;
      if (mode === "aomomo-grid") return 3 + positionLadder;
      if (mode === "chong-grid" || mode === "amiba-grid" || mode === "runezu-grid") return 2.5 + positionLadder;
      if (mode === "jiuzhe-grid") {
        return 0.8 + positionLadder * 0.75;
      }
      return 0;
    }

    function scoreAiRevealedAlienGridPosition(position) {
      const pos = Math.max(0, Math.round(aiNumber(position)));
      if (pos >= 5) return 8.5;
      if (pos === 4) return 6.5;
      if (pos === 3) return 4.5;
      if (pos === 2) return 3;
      if (pos === 1) return 1.5;
      return 0;
    }

    function getAiAlienTraceTargetReward(workingRoot, mode, traceType, position) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      if (!traceType || position == null) return null;
      const pos = Number(position);
      if (mode === "jiuzhe-grid") return jiuzhe?.getTraceReward?.(traceType, pos) || null;
      if (mode === "yichangdian-grid") return yichangdian?.getTraceReward?.(traceType, pos) || null;
      if (mode === "fangzhou-grid") return fangzhou?.getTraceReward?.(traceType, pos) || null;
      if (mode === "banrenma-grid") return banrenma?.getTraceReward?.(traceType, pos) || null;
      if (mode === "chong-grid") return chong?.getTraceReward?.(alienGameState, traceType, pos) || null;
      if (mode === "amiba-grid") return amiba?.getTraceReward?.(alienGameState, traceType, pos) || null;
      if (mode === "aomomo-grid") return aomomo?.getTraceReward?.(traceType, pos) || null;
      if (mode === "runezu-grid") return runezu?.getTraceReward?.(alienGameState, traceType, pos) || null;
      return null;
    }

    function getAiAvailableDataTokenCount(player) {
      if (!player) return 0;
      const dataState = data?.ensurePlayerDataState?.(player);
      if (Array.isArray(dataState?.poolTokens)) return dataState.poolTokens.length;
      return Math.max(0, Math.round(aiNumber(player.resources?.availableData)));
    }

    function getAiAllowedAlienTraceTypes(alienModule, allowedTraceTypes) {
      const supportedTypes = alienModule?.TRACE_TYPES || aliens.TRACE_TYPES;
      const requestedTypes = allowedTraceTypes?.length ? allowedTraceTypes : supportedTypes;
      return requestedTypes.filter((traceType) => supportedTypes.includes(traceType));
    }

    function getAiAlienModuleTracePositions(alienModule, traceType) {
      if (typeof alienModule?.getPositionsForTraceType === "function") {
        return alienModule.getPositionsForTraceType(traceType) || [];
      }
      return alienModule?.TRACE_POSITIONS || [];
    }

    function hasAiFeasibleGridTraceTarget(alienModule, alienSlotId, allowedTraceTypes, canPlace) {
      const traceTypes = getAiAllowedAlienTraceTypes(alienModule, allowedTraceTypes);
      return traceTypes.some((traceType) => (
        getAiAlienModuleTracePositions(alienModule, traceType)
          .some((position) => canPlace(traceType, Number(position)))
      ));
    }

    function hasAiFeasibleSimpleGridTraceTarget(workingRoot, alienModule, alienSlotId, allowedTraceTypes, options = {}) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      const grid = alienModule?.getTraceGrid?.(alienGameState, alienSlotId);
      return hasAiFeasibleGridTraceTarget(alienModule, alienSlotId, allowedTraceTypes, (traceType, position) => {
        if (options.stackPosition === Number(position)) return true;
        return !grid?.[traceType]?.[position];
      });
    }

    function hasAiFeasibleBanrenmaTraceTarget(workingRoot, alienSlotId, allowedTraceTypes, player) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      if (!banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) return false;
      const grid = banrenma.getTraceGrid?.(alienGameState, alienSlotId);
      const availableData = getAiAvailableDataTokenCount(player);
      return hasAiFeasibleGridTraceTarget(banrenma, alienSlotId, allowedTraceTypes, (traceType, position) => {
        const reward = banrenma.getTraceReward?.(traceType, Number(position));
        const requiredData = Math.max(0, Math.round(aiNumber(reward?.payData)));
        if (requiredData > availableData) return false;
        return Number(position) === 1 || !grid?.[traceType]?.[position];
      });
    }

    function getAiBestSimpleGridTraceDirectScore(workingRoot, alienModule, mode, alienSlotId, traceType, options = {}) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      if (!alienModule || !traceType) return 0;
      const grid = alienModule.getTraceGrid?.(alienGameState, alienSlotId);
      return getAiAlienModuleTracePositions(alienModule, traceType).reduce((best, rawPosition) => {
        const position = Number(rawPosition);
        if (options.stackPosition !== position && grid?.[traceType]?.[position]) return best;
        const reward = getAiAlienTraceTargetReward(workingRoot, mode, traceType, position);
        return Math.max(best, Math.max(0, aiNumber(reward?.gain?.score)));
      }, 0);
    }

    function getAiBestCheckedGridTraceDirectScore(workingRoot, alienModule, mode, alienSlotId, traceType, canPlace) {
      if (!alienModule || !traceType || typeof canPlace !== "function") return 0;
      return getAiAlienModuleTracePositions(alienModule, traceType).reduce((best, rawPosition) => {
        const position = Number(rawPosition);
        if (!canPlace(traceType, position)) return best;
        const reward = getAiAlienTraceTargetReward(workingRoot, mode, traceType, position);
        return Math.max(best, Math.max(0, aiNumber(reward?.gain?.score)));
      }, 0);
    }

    function getAiBestBanrenmaTraceDirectScore(workingRoot, alienSlotId, traceType, player) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      if (!banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) return 0;
      const grid = banrenma.getTraceGrid?.(alienGameState, alienSlotId);
      const availableData = getAiAvailableDataTokenCount(player);
      return getAiBestCheckedGridTraceDirectScore(workingRoot, banrenma, "banrenma-grid", alienSlotId, traceType, (item, position) => {
        const reward = banrenma.getTraceReward?.(item, Number(position));
        const requiredData = Math.max(0, Math.round(aiNumber(reward?.payData)));
        if (requiredData > availableData) return false;
        return Number(position) === 1 || !grid?.[item]?.[position];
      });
    }

    function getAiBestRevealedAlienTraceDirectScoreForSlot(workingRoot, player, alienSlotId, traceType) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      if (jiuzhe?.isJiuzheRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestSimpleGridTraceDirectScore(workingRoot, jiuzhe, "jiuzhe-grid", alienSlotId, traceType);
      }
      if (yichangdian?.isYichangdianRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestSimpleGridTraceDirectScore(workingRoot, yichangdian, "yichangdian-grid", alienSlotId, traceType, { stackPosition: 1 });
      }
      if (fangzhou?.isFangzhouRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestCheckedGridTraceDirectScore(workingRoot, fangzhou, "fangzhou-grid", alienSlotId, traceType, (item, position) => (
          fangzhou.canPlaceFangzhouTrace?.(alienGameState, alienSlotId, item, position, player)?.ok
        ));
      }
      if (banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestBanrenmaTraceDirectScore(workingRoot, alienSlotId, traceType, player);
      }
      if (chong?.isChongRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestCheckedGridTraceDirectScore(workingRoot, chong, "chong-grid", alienSlotId, traceType, (item, position) => (
          chong.canPlaceChongTrace?.(alienGameState, alienSlotId, item, position, player)?.ok
        ));
      }
      if (amiba?.isAmibaRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestCheckedGridTraceDirectScore(workingRoot, amiba, "amiba-grid", alienSlotId, traceType, (item, position) => (
          amiba.canPlaceAmibaTrace?.(alienGameState, alienSlotId, item, position, player)?.ok
        ));
      }
      if (aomomo?.isAomomoRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestCheckedGridTraceDirectScore(workingRoot, aomomo, "aomomo-grid", alienSlotId, traceType, (item, position) => (
          aomomo.canPlaceAomomoTrace?.(alienGameState, alienSlotId, item, position, player)?.ok
        ));
      }
      if (runezu?.isRunezuRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestCheckedGridTraceDirectScore(workingRoot, runezu, "runezu-grid", alienSlotId, traceType, (item, position) => (
          runezu.canPlaceRunezuTrace?.(alienGameState, alienSlotId, item, position, player)?.ok
        ));
      }
      return 0;
    }

    function hasAiFeasibleRevealedAlienTraceTarget(workingRoot, alienSlotId, allowedTraceTypes, player) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      if (jiuzhe?.isJiuzheRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleSimpleGridTraceTarget(workingRoot, jiuzhe, alienSlotId, allowedTraceTypes);
      }
      if (yichangdian?.isYichangdianRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleSimpleGridTraceTarget(workingRoot, yichangdian, alienSlotId, allowedTraceTypes, { stackPosition: 1 });
      }
      if (fangzhou?.isFangzhouRevealedSlot?.(alienGameState, alienSlotId)) {
        const canPlaceOnPanel = hasAiFeasibleGridTraceTarget(fangzhou, alienSlotId, allowedTraceTypes, (traceType, position) => (
          fangzhou.canPlaceFangzhouTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok
        ));
        const canUnlockCard = (allowedTraceTypes || []).some((traceType) => (
          fangzhou.canUnlockCard2ForTrace?.(alienGameState, player, traceType)
        ));
        return canPlaceOnPanel || canUnlockCard;
      }
      if (banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleBanrenmaTraceTarget(workingRoot, alienSlotId, allowedTraceTypes, player);
      }
      if (chong?.isChongRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleGridTraceTarget(chong, alienSlotId, allowedTraceTypes, (traceType, position) => (
          chong.canPlaceChongTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok
        ));
      }
      if (amiba?.isAmibaRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleGridTraceTarget(amiba, alienSlotId, allowedTraceTypes, (traceType, position) => (
          amiba.canPlaceAmibaTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok
        ));
      }
      if (aomomo?.isAomomoRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleGridTraceTarget(aomomo, alienSlotId, allowedTraceTypes, (traceType, position) => (
          aomomo.canPlaceAomomoTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok
        ));
      }
      if (runezu?.isRunezuRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleGridTraceTarget(runezu, alienSlotId, allowedTraceTypes, (traceType, position) => (
          runezu.canPlaceRunezuTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok
        ));
      }
      return true;
    }

    function getAiAlienTracePlayerKeys(player) {
      if (!player) return [];
      return [player.id, player.color, player.colorLabel].filter(Boolean).map(String);
    }

    function listAiAlienTraceEntriesForSlot(workingRoot, alienSlotId, traceType) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      const slotId = Number(alienSlotId);
      if (jiuzhe?.isJiuzheRevealedSlot?.(alienGameState, slotId)) return jiuzhe.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (yichangdian?.isYichangdianRevealedSlot?.(alienGameState, slotId)) return yichangdian.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (fangzhou?.isFangzhouRevealedSlot?.(alienGameState, slotId)) return fangzhou.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (banrenma?.isBanrenmaRevealedSlot?.(alienGameState, slotId)) return banrenma.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (chong?.isChongRevealedSlot?.(alienGameState, slotId)) return chong.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (amiba?.isAmibaRevealedSlot?.(alienGameState, slotId)) return amiba.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (aomomo?.isAomomoRevealedSlot?.(alienGameState, slotId)) return aomomo.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (runezu?.isRunezuRevealedSlot?.(alienGameState, slotId)) return runezu.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      const traceSlot = aliens.getAlienSlot?.(alienGameState, slotId)?.traces?.[traceType];
      return traceSlot?.tokens || [];
    }

    function aiAlienTraceEntryBelongsToPlayer(entry, player) {
      const keys = getAiAlienTracePlayerKeys(player);
      if (!keys.length || !entry) return false;
      return [
        entry.playerId,
        entry.playerColor,
        entry.color,
        entry.ownerPlayerId,
        entry.ownerPlayerColor,
      ].filter(Boolean).map(String).some((key) => keys.includes(key));
    }

    function aiAlienSlotHasPlayerTrace(workingRoot, alienSlotId, traceType, player) {
      return listAiAlienTraceEntriesForSlot(workingRoot, alienSlotId, traceType)
        .some((entry) => aiAlienTraceEntryBelongsToPlayer(entry, player));
    }

    function aiAlienSlotHasPlayerTraceSet(workingRoot, alienSlotId, traceTypes, player) {
      return (traceTypes || []).every((traceType) => aiAlienSlotHasPlayerTrace(workingRoot, alienSlotId, traceType, player));
    }

    function getAiEligibleAlienSlotIdsForTraceEffect(workingRoot, effect, player, traceTypes) {
      const targetRule = effect?.options?.targetRule;
      if (!targetRule) return aliens.ALIEN_SLOT_IDS || [];
      return (aliens.ALIEN_SLOT_IDS || []).filter((alienSlotId) => {
        if (targetRule === "playerHasSameTrace") {
          return (traceTypes || []).some((traceType) => aiAlienSlotHasPlayerTrace(workingRoot, alienSlotId, traceType, player));
        }
        if (targetRule === "singleAlienTraceSet") {
          const requiredTypes = effect.options?.traceTypes || ["yellow", "pink", "blue"];
          return aiAlienSlotHasPlayerTraceSet(workingRoot, alienSlotId, requiredTypes, player);
        }
        return true;
      });
    }

    function canAiPlaceBasicAlienTrace(workingRoot, alienSlotId, traceType) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      const traceSlot = aliens.getAlienSlot?.(alienGameState, alienSlotId)?.traces?.[traceType];
      return Boolean(traceSlot) && !traceSlot.firstPlaced;
    }

    function canAiResolveAlienTraceEffect(workingRoot, effect, player = getWorkingCurrentPlayer(workingRoot)) {
      if (effect?.type !== "alien_trace") return true;
      const traceType = effect.options?.traceType || null;
      const allowedTraceTypes = traceType
        ? [traceType]
        : (effect.options?.allowedTraceTypes?.length ? effect.options.allowedTraceTypes : aliens.TRACE_TYPES || []);
      const eligibleSlots = getAiEligibleAlienSlotIdsForTraceEffect(workingRoot, effect, player, allowedTraceTypes);
      if (!eligibleSlots.length) return false;
      return eligibleSlots.some((alienSlotId) => {
        const slot = aliens.getAlienSlot?.(alienGameState, alienSlotId);
        if (slot?.revealed && slot?.alienId) {
          return hasAiFeasibleRevealedAlienTraceTarget(workingRoot, alienSlotId, allowedTraceTypes, player);
        }
        return allowedTraceTypes.some((item) => canAiPlaceBasicAlienTrace(workingRoot, alienSlotId, item));
      });
    }

    function canAiPlaceAlienGridTraceTarget(workingRoot, target, player = getWorkingCurrentPlayer(workingRoot)) {
      if (target?.kind !== "grid-slot") return true;
      const button = target.button;
      const dataset = button?.dataset || {};
      const alienSlotId = Number(dataset.alienSlot || state.alienTracePickerState?.selectedAlienSlotId);
      const traceType = getAiAlienTraceTargetTraceType(target);
      const position = getAiAlienTraceTargetPosition(target);
      if (!Number.isFinite(alienSlotId) || !traceType || position == null) return false;
      if (button.matches?.("[data-banrenma-trace-slot]")) {
        const grid = banrenma?.getTraceGrid?.(alienGameState, alienSlotId);
        const reward = banrenma?.getTraceReward?.(traceType, Number(position));
        const requiredData = Math.max(0, Math.round(aiNumber(reward?.payData)));
        if (requiredData > getAiAvailableDataTokenCount(player)) return false;
        return Number(position) === 1 || !grid?.[traceType]?.[position];
      }
      if (button.matches?.("[data-yichangdian-trace-slot]")) {
        const grid = yichangdian?.getTraceGrid?.(alienGameState, alienSlotId);
        return Number(position) === 1 || !grid?.[traceType]?.[position];
      }
      if (button.matches?.("[data-jiuzhe-trace-slot]")) {
        const grid = jiuzhe?.getTraceGrid?.(alienGameState, alienSlotId);
        return !grid?.[traceType]?.[position];
      }
      if (button.matches?.("[data-fangzhou-trace-slot]")) {
        return Boolean(fangzhou?.canPlaceFangzhouTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok);
      }
      if (button.matches?.("[data-chong-trace-slot]")) {
        return Boolean(chong?.canPlaceChongTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok);
      }
      if (button.matches?.("[data-amiba-trace-slot]")) {
        return Boolean(amiba?.canPlaceAmibaTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok);
      }
      if (button.matches?.("[data-aomomo-trace-slot]")) {
        return Boolean(aomomo?.canPlaceAomomoTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok);
      }
      if (button.matches?.("[data-runezu-trace-slot]")) {
        return Boolean(runezu?.canPlaceRunezuTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok);
      }
      return true;
    }

    function scoreAiAlienTraceTarget(workingRoot, target, player) {
      if (!target?.button || target.button.disabled) return -Infinity;
      if (!canAiPlaceAlienGridTraceTarget(workingRoot, target, player)) return -Infinity;
      const label = String(target.button.textContent || target.button.title || "");
      const pickerMode = String(state.alienTracePickerState?.mode || "");
      const mode = getAiAlienTraceTargetMode(target, pickerMode);
      const traceType = getAiAlienTraceTargetTraceType(target);
      const position = getAiAlienTraceTargetPosition(target);
      const fangzhouUseChoice = target.button.dataset.fangzhouUse || null;
      const isFangzhouUnlockChoice = mode === "fangzhou-use" && fangzhouUseChoice === "unlock";
      const isStateExtraTraceTarget = target.kind === "state-slot"
        && target.button.dataset.stateTraceKind === "extra";
      const scoringMode = mode === "fangzhou-use" && fangzhouUseChoice === "place" && position != null
        ? "fangzhou-grid"
        : mode;
      const rawReward = isFangzhouUnlockChoice
        ? fangzhou?.getCard2UnlockTraceReward?.()
        : isStateExtraTraceTarget
          ? aliens?.getExtraTraceReward?.()
        : getAiAlienTraceTargetReward(workingRoot, scoringMode, traceType, position);
      const reward = getAiAlienTraceRewardForValuation(scoringMode, rawReward, player);
      const demand = getAiStrategyDemand(player);
      const alienSlot = Number(target.button.dataset.alienSlot || state.alienTracePickerState?.selectedAlienSlotId);
      const traceDemand = traceType
        ? getAiMapDemand(demand.traceTypes, traceType)
          + getAiAlienTraceTargetDemandForSlot(demand, alienSlot, traceType)
        : 0;
      const hiddenFirstTraceColorLost = Number.isFinite(alienSlot)
        && isAiOpenHiddenFirstTraceTarget(alienSlot, traceType)
        && isAiHiddenFirstTraceColorLost(traceType, player);
      const forcedPendingStateExtraTrace = false;
      if (
        target.kind === "state-slot"
        && mode !== "debug-direct"
        && !forcedPendingStateExtraTrace
        && Number.isFinite(alienSlot)
        && isAiHiddenFirstTraceTakenByOpponent(alienSlot, traceType, player)
      ) {
        return -Infinity;
      }
      if (
        target.kind === "picker"
        && mode === "fangzhou-use"
        && fangzhouUseChoice === "place"
        && target.button.dataset.fangzhouPlaceKind === "state"
        && Number.isFinite(alienSlot)
        && isAiHiddenFirstTraceTakenByOpponent(alienSlot, traceType, player)
      ) {
        return -Infinity;
      }
      if (pickerMode.endsWith("-grid") && target.kind === "picker") return -Infinity;
      if (
        target.kind === "picker"
        && mode !== "fangzhou-use"
        && Number.isFinite(alienSlot)
        && !hasAiFeasibleRevealedAlienTraceTarget(workingRoot,
          alienSlot,
          state.alienTracePickerState?.allowedTraceTypes,
          player,
        )
      ) {
        return -Infinity;
      }
      if (mode === "banrenma-grid" && traceType && position != null) {
        const reward = banrenma?.getTraceReward?.(traceType, position);
        const requiredData = Math.max(0, Math.round(aiNumber(reward?.payData)));
        const availableData = getAiAvailableDataTokenCount(player);
        if (requiredData > availableData) return -Infinity;
      }
      let score = scoreAiAlienTraceValue({
        player,
        traceType,
        alienSlotId: Number.isFinite(alienSlot) ? alienSlot : null,
        mode: scoringMode,
        position,
        label,
        reward,
      });
      if (
        Number.isFinite(alienSlot)
        && isAiHiddenFirstTraceTakenByOpponent(alienSlot, traceType, player)
      ) {
        score -= 12;
      }

      if (target.kind === "grid-slot") score += 12;
      if (target.kind === "picker") score += 8;
      if (target.kind === "state-slot") score += 3;
      if (
        hiddenFirstTraceColorLost
        && (
          target.kind === "state-slot"
          || (
            target.kind === "picker"
            && mode === "fangzhou-use"
            && fangzhouUseChoice === "place"
            && target.button.dataset.fangzhouPlaceKind === "state"
          )
        )
      ) {
        score -= 14;
      }
      score += traceDemand * 0.45;
      score += ({ pink: 4, blue: 3.5, yellow: 3 })[traceType] || 0;
      score += scoreAiAlienGridPosition(scoringMode, traceType, position, label);
      if (label.includes("未揭示")) score += 3;
      if (label.includes("得分") || label.includes("分数")) score += 3;
      if (label.includes("精选")) score += 4.5;
      if (label.includes("牌")) score += 4.5 * getAiAlienCardConversionMultiplier(player);
      if (label.includes("信用")) score += 2;
      if (label.includes("数据") || label.includes("扫描")) score += 1.5;
      if (label.includes("解锁")) score += 8;
      if (reward?.pickAlienCard) {
        score += 4 * getAiAlienCardConversionMultiplier(player);
        score -= scoreAiLateAlienCardConversionPenalty(player);
      }
      if (reward?.drawCards) score += Math.max(0, aiNumber(reward.drawCards)) * 1.8;
      if (reward?.blindDraw) score += Math.max(0, aiNumber(reward.blindDraw)) * 1.4;
      if (isFangzhouUnlockChoice) score += scoreAiFangzhouUnlockChoiceValue(player, traceType);
      score += scoreAiBanrenmaTraceTimingValue(scoringMode, reward, player, position);
      score += scoreAiAomomoTraceTimingValue(scoringMode, reward, player, position);
      score += scoreAiYichangdianAlienCardTracePriorityValue(scoringMode, reward, player, position);
      score += scoreAiYichangdianTraceTimingValue(scoringMode, reward, player, position, traceType, alienSlot);
      if (target.kind === "grid-slot" || target.kind === "state-slot" || (mode === "fangzhou-use" && fangzhouUseChoice === "place") || isFangzhouUnlockChoice) {
        const directScore = Math.max(0, aiNumber(reward?.gain?.score));
        const pointConversionPenalty = scoreAiHighCostPointConversionPenalty(player, {
          actionId: "alienTrace",
          directScore,
          payData: reward?.payData,
          highScoreTarget: directScore >= 15 && aiNumber(reward?.payData) >= 3,
          engineReward: Boolean(reward?.pickAlienCard || reward?.drawCards || reward?.blindDraw),
        });
        if (pointConversionPenalty > 0) score -= pointConversionPenalty;
        if (directScore > 0) {
          const threshold = getAiNextMissingFinalScoreThreshold(player);
          const currentScore = Math.max(0, aiNumber(player?.resources?.score));
          if (threshold && currentScore < threshold && getAiRoundNumber() >= FINAL_ROUND_NUMBER - 1) {
            score += currentScore + directScore >= threshold
              ? (threshold <= 50 ? 16 : 12)
              : Math.min(threshold <= 50 ? 10 : 7, directScore * (threshold <= 50 ? 0.9 : 0.55));
          }
          score += scoreAiPaceValueForDirectScore(directScore, player, {
            baseWeight: getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 0.75 : 0.45,
            pressureWeight: getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 0.4 : 0.22,
          });
          score += scoreAiSecondFinalMarkNudgeValue(directScore, player, { weight: 1.15 });
          score += scoreAiThirdFinalMarkCashoutValue(directScore, player, { weight: 0.85 });
        }
      }
      if (isFangzhouUnlockChoice) {
        const threshold = getAiNextMissingFinalScoreThreshold(player);
        const currentScore = Math.max(0, aiNumber(player?.resources?.score));
        const directScore = Math.max(0, aiNumber(reward?.gain?.score));
        if (threshold && threshold <= 50 && currentScore >= 45 && currentScore < threshold && currentScore + directScore < threshold) {
          score -= 5;
        }
      }

      if (Number.isFinite(alienSlot)) score += (10 - Math.min(10, Math.max(0, alienSlot))) * 0.01;
      return score;
    }

    function chooseAiAlienTraceTarget(workingRoot, player) {
      const pickerMode = String(state.alienTracePickerState?.mode || "");
      let targets = [];
      if (pickerMode.endsWith("-grid")) {
        targets = [
          ...listAiAlienGridTraceTargets(),
          ...listAiAlienStateTraceTargets(),
        ];
      } else if (pickerMode === "debug-direct") {
        targets = listAiAlienStateTraceTargets();
      } else if (pickerMode === "trace-board") {
        targets = [
          ...listAiAlienGridTraceTargets(),
          ...listAiAlienStateTraceTargets(),
        ];
      } else if (pickerMode) {
        targets = listAiAlienPickerTargets();
      }
      return targets
        .map((target, index) => ({ ...target, index, score: scoreAiAlienTraceTarget(workingRoot, target, player) }))
        .filter((target) => Number.isFinite(target.score))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0] || null;
    }

    function runAiAlienTraceDecision(workingRoot) {
      requireWorkingRoot(workingRoot);
      return null;
    }

    function getAiAlienPendingPlayer(workingRoot, pending = {}) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const explicitPlayerId = pending?.playerId || pending?.targetPlayerId || pending?.player?.id || null;
      const explicitPlayerColor = pending?.playerColor || pending?.targetPlayerColor || pending?.player?.color || null;
      const ownerPlayerId = getWorkingEffectOwnerPlayer(workingRoot, pending?.effect)?.id
        || state.pendingActionEffectFlow?.playerId
        || playerState.currentPlayerId;
      const explicitColorPlayer = explicitPlayerColor
        ? resolveWorkingPlayerReference(workingRoot, { playerColor: explicitPlayerColor })
        : null;
      return resolveWorkingPlayerById(workingRoot, explicitPlayerId)
        || explicitColorPlayer
        || resolveWorkingPlayerById(workingRoot, ownerPlayerId)
        || getWorkingCurrentPlayer(workingRoot);
    }

    function makeAiAlienChoiceFlow(type, label, pending, selector, datasetKey, handler, options = {}) {
      return {
        type,
        label,
        pending,
        selector,
        allowCancel: options.allowCancel === true,
        getChoice: options.getChoice || ((button) => button?.dataset?.[datasetKey] ?? null),
        handleChoice: handler,
      };
    }

    function getAiAlienUseFlows() {
      return [
        makeAiAlienChoiceFlow(
          "jiuzhe-card",
          "九折牌",
          state.pendingJiuzheCardPlay?.reason === "view" ? null : state.pendingJiuzheCardPlay,
          "[data-jiuzhe-card-choice], [data-jiuzhe-opportunity-skip]",
          null,
          (choice, handlerOptions = {}) => (
            choice === "skip"
              ? handleJiuzheOpportunitySkip?.(handlerOptions)
              : handleJiuzheCardChoice?.(choice, handlerOptions)
          ),
          {
            getChoice: (button) => (button?.dataset?.jiuzheOpportunitySkip ? "skip" : button?.dataset?.jiuzheCardChoice),
          },
        ),
        makeAiAlienChoiceFlow(
          "yichangdian-card",
          "异常点外星人牌",
          state.pendingYichangdianCardGain,
          "[data-yichangdian-card-gain]",
          "yichangdianCardGain",
          handleYichangdianCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "yichangdian-corner",
          "异常点角标",
          state.pendingYichangdianCornerAction,
          "[data-yichangdian-corner-card-id]",
          "yichangdianCornerCardId",
          handleYichangdianCornerChoice,
        ),
        makeAiAlienChoiceFlow(
          "banrenma-card",
          "半人马外星人牌",
          state.pendingBanrenmaCardGain,
          "[data-banrenma-card-gain]",
          "banrenmaCardGain",
          handleBanrenmaCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "banrenma-bonus",
          "半人马顶部奖励",
          state.pendingBanrenmaOpportunity?.type === "panel" ? state.pendingBanrenmaOpportunity : null,
          "[data-banrenma-bonus-choice]",
          "banrenmaBonusChoice",
          handleBanrenmaBonusChoice,
        ),
        makeAiAlienChoiceFlow(
          "banrenma-condition",
          "半人马条件效果",
          state.pendingBanrenmaOpportunity?.type === "card" ? state.pendingBanrenmaOpportunity : null,
          "[data-banrenma-card-choice]",
          "banrenmaCardChoice",
          handleBanrenmaCardConditionChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "chong-card",
          "虫族外星人牌",
          state.pendingChongCardGain,
          "[data-chong-card-gain]",
          "chongCardGain",
          handleChongCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "chong-fossil",
          "虫族化石",
          state.pendingChongFossilChoice,
          "[data-chong-fossil-choice]",
          "chongFossilChoice",
          handleChongFossilChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "amiba-card",
          "阿米巴外星人牌",
          state.pendingAmibaCardGain,
          "[data-amiba-card-gain]",
          "amibaCardGain",
          handleAmibaCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "amiba-symbol",
          "阿米巴 symbol",
          state.pendingAmibaSymbolChoice,
          "[data-amiba-symbol-choice]",
          "amibaSymbolChoice",
          handleAmibaSymbolChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "amiba-trace-removal",
          "阿米巴痕迹移除",
          state.pendingAmibaTraceRemoval,
          "[data-amiba-trace-remove]",
          "amibaTraceRemove",
          handleAmibaTraceRemovalChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "aomomo-card",
          "奥陌陌外星人牌",
          state.pendingAomomoCardGain,
          "[data-aomomo-card-gain]",
          "aomomoCardGain",
          handleAomomoCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "runezu-card",
          "符文族外星人牌",
          state.pendingRunezuCardGain,
          "[data-runezu-card-gain]",
          "runezuCardGain",
          handleRunezuCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "runezu-face-symbol",
          "符文族黑圈",
          state.pendingRunezuFaceSymbolPlacement,
          "[data-runezu-face-symbol-choice]",
          "runezuFaceSymbolChoice",
          handleRunezuFaceSymbolChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "runezu-symbol-branch",
          "符文族符文奖励",
          state.pendingRunezuSymbolBranch,
          "[data-runezu-symbol-branch]",
          "runezuSymbolBranch",
          handleRunezuSymbolBranchChoice,
          { allowCancel: true },
        ),
      ].filter((flow) => flow.pending);
    }


    function listAiAlienUseOptions(workingRoot, flow) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      const buttons = [...(els.scanTargetActions?.querySelectorAll(flow.selector) || [])];
      let options = buttons.map((button, index) => ({
        button,
        index,
        choice: flow.getChoice(button),
        label: button.textContent || button.title || button.getAttribute?.("aria-label") || "",
        disabled: Boolean(button.disabled),
      }));
      if (flow.type === "banrenma-bonus" && !options.some((option) => !option.disabled)) {
        const synthetic = (banrenma?.getAvailableBonusPositions?.(alienGameState) || [])
          .map((position, index) => ({
            button: null,
            index,
            choice: String(position),
            label: `半人马${position}号奖励`,
            disabled: false,
            synthetic: true,
          }));
        options.push(...synthetic);
      }
      if (flow.type === "amiba-symbol" && !options.some((option) => !option.disabled)) {
        options.push(...(flow.pending?.symbolSlotIds || []).map((slotId, index) => ({
          button: null,
          index,
          choice: String(slotId),
          label: `阿米巴 symbol ${slotId}`,
          disabled: false,
          synthetic: true,
        })));
      }
      if (flow.type === "jiuzhe-card" && !options.some((option) => !option.disabled) && flow.pending?.reason !== "view") {
        options.push({
          button: null,
          index: 999,
          choice: "skip",
          label: "放弃本次机会",
          disabled: false,
          synthetic: true,
        });
      }
      if (flow.type === "jiuzhe-card" && flow.pending?.reason !== "view") {
        const player = getAiAlienPendingPlayer(workingRoot, flow.pending);
        const cost = flow.pending?.cost || {};
        const needsPayment = Object.keys(cost).length > 0;
        if (needsPayment && player && !players.canAfford(player, cost)) {
          if (!options.some((option) => option.choice === "skip")) {
            options.push({
              button: null,
              index: 999,
              choice: "skip",
              label: "放弃本次机会",
              disabled: false,
              synthetic: true,
            });
          }
          for (const option of options) {
            if (option.choice !== "skip") option.disabled = true;
          }
        }
      }
      if (!options.length && flow.allowCancel) {
        options.push({
          button: null,
          index: 999,
          choice: "cancel",
          label: "取消",
          disabled: false,
        });
      }
      options = enrichAiAlienUseOptions(options, flow);
      return options;
    }

    function runAiMoveActionDecision(workingRoot, action) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!action?.rocketId) return { ok: false, message: "AI 移动缺少火箭" };
      recordAiAutoBattleLog("move", `${currentPlayer.colorLabel}AI 移动 ${action.rocketLabel || `R${action.rocketId}`} ${action.directionLabel}`, {
        action,
      });
      return moveRocket(action.deltaX, action.deltaY, action.rocketId, { automated: true });
    }


    return {
      getAiMoveTurnKey,
      getAiMoveCountThisTurn,
      incrementAiMoveCountThisTurn,
      canAiMoveThisTurn,
      getAiCardCornerMoveCountThisTurn,
      incrementAiCardCornerMoveCountThisTurn,
      canAiUseCardCornerMoveThisTurn,
      getAiPendingDecisionPlayer,
      queryAiButtons,
      chooseFirstAiButton,
      scoreAiStrategyPassiveSlotChoice,
      runAiLandTargetDecision,
      buildAiEffectMoveCandidate,
      isAiIndustryHuanyuMoveEffect,
      isAiIndustryHuanyuMoveContext,
      getAiCompletedIndustryHuanyuMoveRocketIds,
      listAiEffectMoveCandidates,
      getAiAlienTraceButtons,
      listAiAlienStateTraceTargets,
      listAiAlienGridTraceTargets,
      listAiAlienPickerTargets,
      getAiAlienTraceTargetTraceType,
      getAiAlienTraceTargetPosition,
      getAiAlienTraceTargetMode,
      scoreAiAlienGridPosition,
      scoreAiRevealedAlienGridPosition,
      getAiAlienTraceTargetReward,
      getAiAvailableDataTokenCount,
      getAiAllowedAlienTraceTypes,
      getAiAlienModuleTracePositions,
      hasAiFeasibleGridTraceTarget,
      hasAiFeasibleSimpleGridTraceTarget,
      hasAiFeasibleBanrenmaTraceTarget,
      getAiBestSimpleGridTraceDirectScore,
      getAiBestCheckedGridTraceDirectScore,
      getAiBestBanrenmaTraceDirectScore,
      getAiBestRevealedAlienTraceDirectScoreForSlot,
      hasAiFeasibleRevealedAlienTraceTarget,
      getAiAlienTracePlayerKeys,
      listAiAlienTraceEntriesForSlot,
      aiAlienTraceEntryBelongsToPlayer,
      aiAlienSlotHasPlayerTrace,
      aiAlienSlotHasPlayerTraceSet,
      getAiEligibleAlienSlotIdsForTraceEffect,
      canAiPlaceBasicAlienTrace,
      canAiResolveAlienTraceEffect,
      canAiPlaceAlienGridTraceTarget,
      scoreAiAlienTraceTarget,
      chooseAiAlienTraceTarget,
      runAiAlienTraceDecision,
      getAiAlienPendingPlayer,
      makeAiAlienChoiceFlow,
      getAiAlienUseFlows,
      listAiAlienUseOptions,
      runAiMoveActionDecision,
    };
  }

  const REQUIRED_CONTEXT_KEYS = Object.freeze([
    "AI_MAX_CARD_CORNER_MOVES_PER_TURN", "AI_MOVE_DIRECTIONS", "AI_RESOURCE_VALUES", "FINAL_ROUND_NUMBER", "MOVE_ENERGY_COST", "abilities", "ai", "aiAutoBattleState",
    "aiNumber", "aliens", "amiba", "aomomo", "applyAiStrategyWeight", "banrenma", "buildAiChongTransportMoveCandidate",
    "buildAiPlayCardCandidate", "canAiContinueCardMoveAfterStep", "canAiPlanetAcceptLanding", "canAiPlanetAcceptOrbit", "canPayForMove", "cancelTechSelection", "cardEffects",
    "chong", "chooseAiLandChoice", "confirmLandTargetPicker",
    "confirmTechBlueSlotChoice", "createActionContext", "data", "els",
    "enrichAiAlienUseOptions", "fangzhou", "formatRocketLabel",
    "getAiAlienCardConversionMultiplier", "getAiAlienTraceRewardForValuation", "getAiAlienTraceTargetDemandForSlot", "getAiAvailableDataRoom", "getAiDiscardedCardOpportunityCost", "getAiMapDemand", "getAiNextActionEffect", "getAiNextMissingFinalScoreThreshold",
    "getAiPlanetAtCoordinate", "getAiResearchTechCandidateExecutionCheck", "getAiResearchTechSelectionOptionsForEffect", "getAiResourceValuesForRound", "getAiRoundNumber", "getAiStrategyDemand", "getAlienTraceActionPlayer",
    "getCurrentActionEffect",
    "getRequiredMovePointsForUi", "handleAmibaCardGainChoice", "handleAmibaSymbolChoice", "handleAmibaTraceRemovalChoice", "handleAomomoCardGainChoice", "handleBanrenmaBonusChoice", "handleBanrenmaCardConditionChoice",
    "handleBanrenmaCardGainChoice", "handleChongCardGainChoice", "handleChongFossilChoice",
    "handleJiuzheCardChoice", "handleJiuzheOpportunitySkip",
    "handleRunezuCardGainChoice", "handleRunezuFaceSymbolChoice", "handleRunezuSymbolBranchChoice", "handleSupplyTechTileClick", "handleYichangdianCardGainChoice", "handleYichangdianCornerChoice",
    "industry", "isActionEffectFlowActive", "isAiAutoBattlePlayer", "isAiChongFossilToken", "isAiChongPickupPlanetId", "isAiChongTravelEffect", "isAiHiddenFirstTraceColorLost", "isAiHiddenFirstTraceTakenByOpponent",
    "isAiLandingEffect", "isAiOpenHiddenFirstTraceTarget", "isTechTilePickingActive", "jiuzhe", "listAiBorrowTechCandidates",
    "listAiResearchTechCandidates", "moveRocket", "players", "recordAiAutoBattleLog", "rocketActions",
    "roundAiScore", "runezu", "scoreAiAlienTraceValue", "scoreAiAomomoTraceTimingValue", "scoreAiB1TraceMarginalValue", "scoreAiBanrenmaTraceTimingValue",
    "scoreAiFangzhouUnlockChoiceValue", "scoreAiFinalSecondMarkNoDirectSetupPenalty", "scoreAiHighCostPointConversionPenalty", "scoreAiLandingAfterMove", "scoreAiLateAlienCardConversionPenalty", "scoreAiMoveArrivalRewardValue",
    "scoreAiMovePaymentCost", "scoreAiMoveTowardTargets", "scoreAiMovementPathPenalty", "scoreAiNearestActionablePlanetTimingPenalty", "scoreAiPaceValueForDirectScore", "scoreAiResourceBundle", "scoreAiSecondFinalMarkNudgeValue", "scoreAiThirdFinalMarkCashoutValue",
    "scoreAiYichangdianAlienCardTracePriorityValue", "scoreAiYichangdianTraceTimingValue", "selectExecutableAiResearchTechCandidate", "shouldAiPreserveEnergyForRouteCashout", "skipCurrentActionEffect", "solar", "state", "summarizeAiScanTargetChoiceEntry",
    "tech", "yichangdian",
  ]);

  return { createInteractionPendingRuntime, REQUIRED_CONTEXT_KEYS };
});
