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
      buildAiPlayCardCandidate, buildSectorScanChoicesForX, canAiContinueCardMoveAfterStep, canAiPlanetAcceptLanding, canAiPlanetAcceptOrbit, canPayForMove, cancelTechSelection, cardEffects,
      cards, chong, chooseAiDataPlacementOptionFromButtons, chooseAiLandChoice, closeScanTargetPicker, confirmDataPlacement, confirmDiscardAnyForIncome, confirmLandTargetPicker,
      confirmMovePayment, confirmProbeSectorScanSelection, confirmScanTarget, confirmStrategyPassiveSlotChoice, confirmTechBlueSlotChoice, createActionContext, data, els,
      enrichAiAlienUseOptions, executeCardMoveForEffect, executeFreeMoveForCardCorner, executeFreeMoveForScanAction4, executeIndustryFreeMove, fangzhou, finishIndustryAbilityFlow, formatRocketLabel,
      getAiAlienCardConversionMultiplier, getAiAlienTraceRewardForValuation, getAiAlienTraceTargetDemandForSlot, getAiAvailableDataRoom, getAiDiscardedCardOpportunityCost, getAiMapDemand, getAiNextActionEffect, getAiNextMissingFinalScoreThreshold,
      getAiPlanetAtCoordinate, getAiResearchTechCandidateExecutionCheck, getAiResearchTechSelectionOptionsForEffect, getAiResourceValuesForRound, getAiRoundNumber, getAiStrategyDemand, getAlienTraceActionPlayer, getBestAiNebulaChoiceScore,
      getCardPrice, getCurrentActionEffect,
      getPublicScanChoicesForCard, getRequiredMovePointsForUi, handleAmibaCardGainChoice, handleAmibaSymbolChoice, handleAmibaTraceRemovalChoice, handleAomomoCardGainChoice, handleBanrenmaBonusChoice, handleBanrenmaCardConditionChoice,
      handleBanrenmaCardGainChoice, handleChongCardGainChoice, handleChongFossilChoice, handleConditionalSectorChoice, handleDiscardCornerRepeatChoice, handleDiscardIncomeCardChoice, handleHandCornerChoice,
      handleJiuzheCardChoice, handleJiuzheOpportunitySkip, handleOptionalHandScanChoice, handlePayCreditChoice, handleProbeLocationRewardChoice, handleProbeSectorScanChoice, handleRemoveOrbitToProbeChoice, handleRemovePlanetMarkerChoice,
      handleReturnUnfinishedTaskChoice, handleRunezuCardGainChoice, handleRunezuFaceSymbolChoice, handleRunezuSymbolBranchChoice, handleScanAction4Choice, handleSupplyTechTileClick, handleYichangdianCardGainChoice, handleYichangdianCornerChoice,
      industry, isActionEffectFlowActive, isAiAutoBattlePlayer, isAiChongFossilToken, isAiChongPickupPlanetId, isAiChongTravelEffect, isAiHiddenFirstTraceColorLost, isAiHiddenFirstTraceTakenByOpponent,
      isAiLandingEffect, isAiOpenHiddenFirstTraceTarget, isMovePaymentCard, isMovePaymentSelectionActive, isTechTilePickingActive, jiuzhe, listAiBorrowTechCandidates, listAiIndustryHuanyuMoveCandidates,
      listAiResearchTechCandidates, moveRocket, players, rankAiScanTargetButtons, rankAiScanTargetChoices, recordAiAutoBattleLog, rocketActions,
      roundAiScore, runezu, scanEffects, scoreAiAlienTraceValue, scoreAiAomomoTraceTimingValue, scoreAiB1TraceMarginalValue, scoreAiBanrenmaTraceTimingValue,
      scoreAiCardCornerOpportunity, scoreAiFangzhouUnlockChoiceValue, scoreAiFinalSecondMarkNoDirectSetupPenalty, scoreAiHighCostPointConversionPenalty, scoreAiLandingAfterMove, scoreAiLateAlienCardConversionPenalty, scoreAiLaunchAction, scoreAiMoveArrivalRewardValue,
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

    function decidePolicyChoice(workingRoot, family, player, decisionId, choices) {
      const { turnState } = requireWorkingRoot(workingRoot);
      return ai?.heuristicPolicy?.decideChoice?.({
        seatId: player?.id,
        family,
        stateVersion: Math.max(0, Number(turnState.roundNumber) || 0),
        decisionVersion: Math.max(0, Number(turnState.turnNumber) || 0),
        decisionId,
        requestId: `browser:${player?.id}:${decisionId}:${turnState.roundNumber || 0}:${turnState.turnNumber || 0}`,
        observation: {
          publicState: { roundNumber: turnState.roundNumber || 0 },
          selfState: { playerId: player?.id || null },
        },
        choices,
      }) || { ok: false, code: "HEURISTIC_POLICY_NOT_CONFIGURED", message: "公共 Heuristic Policy 未装配" };
    }

    function decideBlueSlot(workingRoot, player, availableSlots, decisionId) {
      return decidePolicyChoice(workingRoot, "choose_target", player, decisionId, availableSlots.map((slot) => ({
        choiceId: String(slot),
        value: -Number(slot),
        target: { blueSlot: Number(slot) },
        summary: `蓝色科技槽 ${slot}`,
        slot: Number(slot),
      })));
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

    function scoreAiHandCornerChoice(choice, counts = {}) {
      if (choice === "move") return aiNumber(counts.move) * AI_RESOURCE_VALUES.movement;
      if (choice === "data") return aiNumber(counts.data) * AI_RESOURCE_VALUES.availableData;
      if (choice === "publicity") return aiNumber(counts.publicity) * AI_RESOURCE_VALUES.publicity;
      return -Infinity;
    }

    function chooseAiHandCornerChoice(pending) {
      return queryAiButtons("[data-hand-corner-choice]")
        .map((button, index) => ({
          button,
          choice: button.dataset.handCornerChoice,
          index,
          score: scoreAiHandCornerChoice(button.dataset.handCornerChoice, pending?.counts || {}),
        }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0] || null;
    }

    function getAiIncomeGainValue(card) {
      const gain = cards.getIncomeGainForCard?.(card) || null;
      if (!gain) return 0;
      return scoreAiResourceBundle(gain);
    }

    function chooseAiDiscardAnyIncomeCards(pending, player) {
      const pendingChoices = new Set((pending?.choices || []).map((card) => card?.id).filter(Boolean));
      const hand = (player?.hand || []).filter((card) => !pendingChoices.size || pendingChoices.has(card.id));
      return hand
        .map((card, index) => ({
          card,
          index,
          score: getAiIncomeGainValue(card) - Math.max(0, scoreAiCardCornerOpportunity(card)) * 0.15,
        }))
        .filter((entry) => entry.card?.id && entry.score > 0)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .map((entry) => entry.card);
    }

    function scoreAiPayCreditReward(effect, player) {
      const reward = effect?.options?.reward || null;
      if (!reward) return 0;
      if (reward.type === "gain_resources") {
        return scoreAiResourceBundle(reward.options?.gain || {});
      }
      return 0;
    }

    function chooseAiDiscardCornerRepeatCard(pending, player) {
      return (pending?.choices || player?.hand || [])
        .map((card, index) => ({
          card,
          index,
          score: scoreAiCardCornerOpportunity(card) - Math.max(0, getCardPrice(card)) * 0.1,
        }))
        .filter((entry) => entry.card?.id && Number.isFinite(entry.score))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.card || null;
    }

    function chooseAiProbeSectorScanChoices(workingRoot, pending) {
      const maxTargets = Math.max(1, Math.round(aiNumber(pending?.effect?.options?.maxTargets || 1)));
      return (pending?.choices || [])
        .map((choice, index) => {
          const sectorX = choice?.sector?.x;
          const scanScore = sectorX == null
            ? 0
            : getBestAiNebulaChoiceScore(buildSectorScanChoicesForX(sectorX), {
              player: getAiPendingDecisionPlayer(workingRoot, pending),
              pendingType: "probe_sector_scan",
              gainData: pending?.effect?.options?.gainData,
            });
          return {
            choice,
            index,
            score: Number.isFinite(scanScore) ? scanScore : 0,
          };
        })
        .filter((entry) => entry.choice?.rocket?.id != null)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .slice(0, maxTargets)
        .map((entry) => entry.choice);
    }

    function chooseAiProbeLocationRewardButton() {
      return queryAiButtons("[data-probe-location-reward-rocket-id]")
        .map((button, index) => {
          const dataMatch = String(button.textContent || "").match(/(\d+)\s*数据/);
          return {
            button,
            index,
            score: dataMatch ? Number(dataMatch[1]) * AI_RESOURCE_VALUES.availableData : 0,
          };
        })
        .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.button || null;
    }

    function runAiDataPlacementDecision(workingRoot) {
      if (!els.dataPlaceOverlay || els.dataPlaceOverlay.hidden) return null;
      const pending = state.pendingDataPlaceAction || null;
      const player = getAiPendingDecisionPlayer(workingRoot, pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择数据放置` };
      }
      const selected = chooseAiDataPlacementOptionFromButtons(
        els.dataPlaceActions?.querySelectorAll("[data-place-target]") || [],
        player,
      );
      if (!selected) {
        return { ok: false, blocked: true, message: "AI 没有可用数据放置目标" };
      }
      recordAiAutoBattleLog("data-placement", `${player.colorLabel}AI 放置数据`, {
        logPlayerId: player.id,
        selected: {
          target: selected.target,
          blueSlot: selected.blueSlot,
          placementSlot: selected.placementSlot,
          label: selected.label,
          score: selected.score,
        },
      });
      return confirmDataPlacement(selected.target, selected.blueSlot);
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

    function runAiStrategyPassiveSlotChoiceDecision(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const pending = state.pendingStrategyPassiveSlotChoice;
      if (!pending) return null;
      const effect = getCurrentActionEffect();
      const player = getWorkingEffectOwnerPlayer(workingRoot, effect) || getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择宇宙战略集团奖励槽` };
      }
      const rankedChoices = (pending.slotIds || [])
        .map((slotId) => ({
          slotId,
          score: scoreAiStrategyPassiveSlotChoice(workingRoot, slotId, player),
          rewardLabel: industry?.getStrategySlotRewardLabel?.(slotId) || "",
        }))
        .filter((entry) => entry.slotId && Number.isFinite(Number(entry.score)))
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
      const selected = rankedChoices[0] || null;
      if (!selected) {
        return { ok: false, blocked: true, message: "AI 没有可选的宇宙战略集团奖励槽" };
      }
      recordAiAutoBattleLog("industry", `${player.colorLabel}AI 选择宇宙战略集团奖励槽`, {
        logPlayerId: player.id,
        slotId: selected.slotId,
        score: selected.score,
        rewardLabel: selected.rewardLabel,
        choices: rankedChoices,
      });
      return confirmStrategyPassiveSlotChoice(selected.slotId);
    }

    function runAiMovePaymentDecision(workingRoot) {
      const { rocketState, turnState } = requireWorkingRoot(workingRoot);
      if (!isMovePaymentSelectionActive()) return null;
      const currentPlayer = getAiPendingDecisionPlayer(workingRoot, state.pendingMovePayment)
        || getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工确认移动支付` };
      }

      const requiredMovePoints = state.pendingMovePayment.requiredMovePoints || MOVE_ENERGY_COST;
      const availableEnergy = Math.max(0, Math.round(Number(currentPlayer?.resources?.energy) || 0));
      const moveCardIndexes = (currentPlayer?.hand || [])
        .map((card, index) => (isMovePaymentCard(card) ? index : null))
        .filter((index) => index != null);
      const fallbackMoveCardCost = Math.max(0, aiNumber(getAiResourceValuesForRound().handSize));
      const moveCardEntries = moveCardIndexes.map((handIndex) => {
        const card = currentPlayer.hand?.[handIndex] || null;
        const playCandidate = card ? buildAiPlayCardCandidate(workingRoot, card, handIndex, currentPlayer) : null;
        return {
          card,
          handIndex,
          playCandidate,
          opportunityCost: Math.max(
            fallbackMoveCardCost,
            card ? getAiDiscardedCardOpportunityCost(card, playCandidate) : fallbackMoveCardCost,
          ),
        };
      });
      const moveCardOpportunityCosts = Object.fromEntries(
        moveCardEntries.map((entry) => [entry.handIndex, roundAiScore(entry.opportunityCost)]),
      );
      const rocket = (rocketState.rockets || [])
        .find((item) => Number(item.id) === Number(state.pendingMovePayment.rocketId)) || null;
      const from = rocket ? rocketActions.getRocketSectorCoordinate(rocket) : null;
      const effect = getCurrentActionEffect?.() || state.pendingMovePayment.cardMoveEffectContext?.effect || null;
      const nextEffect = getAiNextActionEffect();
      const to = from
        ? {
          x: solar.mod8(from.x + aiNumber(state.pendingMovePayment.deltaX)),
          y: Math.min(
            rocketActions.SECTOR_RING_MAX,
            Math.max(rocketActions.SECTOR_RING_MIN, aiNumber(from.y) + aiNumber(state.pendingMovePayment.deltaY)),
          ),
        }
        : null;
      const routeScore = scoreAiMoveTowardTargets(from, to, currentPlayer, {
        rocket,
        effect,
        nextEffect,
      });
      const preserveEnergyForRouteCashout = shouldAiPreserveEnergyForRouteCashout(currentPlayer, to, {
        routeTarget: routeScore.target,
        requiredMovePoints,
      });
      const preferredHandIndices = ai?.selectionEvaluator?.evaluateMovePaymentIndexes?.(currentPlayer.hand || [], {
        requiredMovePoints,
        availableEnergy,
        moveCardIndexes,
        moveCardOpportunityCosts,
        roundNumber: turnState.roundNumber,
        preserveEnergy: preserveEnergyForRouteCashout,
      }) || [];
      const orderedMoveCards = [...moveCardIndexes].sort((left, right) => (
        Number(moveCardOpportunityCosts[left] ?? 0) - Number(moveCardOpportunityCosts[right] ?? 0) || left - right
      ));
      const minimumCards = Math.max(0, requiredMovePoints - availableEnergy);
      const paymentChoices = Array.from(
        { length: Math.max(0, Math.min(requiredMovePoints, orderedMoveCards.length) - minimumCards) + 1 },
        (_item, offset) => orderedMoveCards.slice(0, minimumCards + offset),
      );
      const paymentPolicy = decidePolicyChoice(workingRoot, "choose_payment", currentPlayer, "move-payment", paymentChoices.map((indexes) => ({
        choiceId: indexes.join("+") || "energy-only",
        value: indexes.join(",") === preferredHandIndices.join(",")
          ? 100
          : -indexes.reduce((total, index) => total + Number(moveCardOpportunityCosts[index] || 0), 0),
        target: { handIndexes: indexes },
        summary: indexes.length ? `支付移动牌 ${indexes.join(",")}` : "仅支付能量",
        indexes,
      })));
      if (!paymentPolicy.ok) return { ok: false, blocked: true, code: paymentPolicy.code, message: paymentPolicy.message };
      const selectedHandIndices = paymentPolicy.choice.indexes;
      state.pendingMovePayment.selectedHandIndices = selectedHandIndices.slice(0, requiredMovePoints);
      recordAiAutoBattleLog("move-payment", `${currentPlayer.colorLabel}AI 确认移动支付`, {
        rocketId: state.pendingMovePayment.rocketId,
        deltaX: state.pendingMovePayment.deltaX,
        deltaY: state.pendingMovePayment.deltaY,
        requiredMovePoints,
        selectedHandIndices: state.pendingMovePayment.selectedHandIndices,
        selectedCards: state.pendingMovePayment.selectedHandIndices
          .map((handIndex) => {
            const entry = moveCardEntries.find((candidate) => candidate.handIndex === Number(handIndex));
            const card = entry?.card || currentPlayer.hand?.[handIndex] || null;
            if (!card) return null;
            return {
              handIndex,
              cardId: card.cardId || card.id || null,
              cardInstanceId: card.id || null,
              cardLabel: cards.getCardLabel?.(card) || card.cardName || card.label || null,
              opportunityCost: roundAiScore(entry?.opportunityCost),
              playScore: entry?.playCandidate ? roundAiScore(entry.playCandidate.score) : null,
            };
          })
          .filter(Boolean),
        moveCardOpportunityCosts,
        energyCost: Math.max(0, requiredMovePoints - state.pendingMovePayment.selectedHandIndices.length),
        preserveEnergy: preserveEnergyForRouteCashout,
        preserveEnergyForRouteCashout,
      });
      const result = confirmMovePayment({ automated: true });
      if (result?.ok) incrementAiMoveCountThisTurn(workingRoot, currentPlayer.id);
      return result || { ok: false, blocked: true, message: "AI 移动支付未产生结果" };
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

    function runAiProbeSectorScanDecision(workingRoot) {
      const pending = state.pendingProbeSectorScanAction || null;
      if (!pending) return null;
      const player = getAiPendingDecisionPlayer(workingRoot, pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择探测器扇区扫描` };
      }
      const selectedChoices = chooseAiProbeSectorScanChoices(workingRoot, pending);
      if (!selectedChoices.length) {
        return { ok: false, blocked: true, message: "AI 没有可选探测器扇区扫描目标" };
      }
      const maxTargets = Math.max(1, Math.round(aiNumber(pending.effect?.options?.maxTargets || 1)));
      recordAiAutoBattleLog("probe-sector-scan", `${player.colorLabel}AI 选择探测器扇区扫描`, {
        logPlayerId: player.id,
        selectedRocketIds: selectedChoices.map((choice) => choice.rocket?.id),
        maxTargets,
      });
      let result = null;
      for (const choice of selectedChoices) {
        result = handleProbeSectorScanChoice(choice.rocket.id);
        if (maxTargets === 1) return result;
        if (result?.ok === false) return result;
      }
      return confirmProbeSectorScanSelection();
    }

    function runAiProbeLocationRewardDecision(workingRoot) {
      const pending = state.pendingProbeLocationRewardAction || null;
      if (!pending) return null;
      const player = getAiPendingDecisionPlayer(workingRoot, pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择探测器位置奖励` };
      }
      const button = chooseAiProbeLocationRewardButton();
      const rocketId = button?.dataset?.probeLocationRewardRocketId
        || pending.choices?.[0]?.rocket?.id
        || null;
      if (rocketId == null) {
        return { ok: false, blocked: true, message: "AI 没有可选探测器位置奖励目标" };
      }
      recordAiAutoBattleLog("probe-location-reward", `${player.colorLabel}AI 选择探测器位置奖励`, {
        logPlayerId: player.id,
        rocketId,
        label: button?.textContent || "",
      });
      return handleProbeLocationRewardChoice(rocketId);
    }

    function runAiRareScanTargetDecision(pending, player) {
      const pendingType = pending?.type || null;
      if (pendingType === "remove_planet_marker") {
        const button = chooseFirstAiButton("[data-planet-marker-choice]");
        const choiceId = button?.dataset?.planetMarkerChoice || pending.choices?.[0]?.id || null;
        if (!choiceId) return { ok: false, blocked: true, message: "AI 没有可移除的星球标记" };
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 移除星球标记`, {
          logPlayerId: player.id,
          choiceId,
          label: button?.textContent || "",
        });
        return handleRemovePlanetMarkerChoice(choiceId);
      }

      if (pendingType === "hand_corner_reward") {
        const selected = chooseAiHandCornerChoice(pending);
        const choice = selected?.choice || null;
        if (!choice) return { ok: false, blocked: true, message: "AI 没有可选手牌角标奖励" };
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 选择手牌角标奖励`, {
          logPlayerId: player.id,
          choice,
          score: selected.score,
        });
        return handleHandCornerChoice(choice);
      }

      if (pendingType === "discard_any_income") {
        const selectedCards = chooseAiDiscardAnyIncomeCards(pending, player);
        for (const card of selectedCards) {
          const result = handleDiscardIncomeCardChoice(card.id);
          if (result?.ok === false) return result;
        }
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 确认收入弃牌`, {
          logPlayerId: player.id,
          selectedCardIds: selectedCards.map((card) => card.id),
        });
        return confirmDiscardAnyForIncome();
      }

      if (pendingType === "pay_credit_reward") {
        const rewardValue = scoreAiPayCreditReward(pending.effect, player);
        const canPay = typeof players.canAfford === "function"
          ? players.canAfford(player, { credits: 1 })
          : aiNumber(player?.resources?.credits) > 0;
        const choice = canPay && rewardValue >= AI_RESOURCE_VALUES.credits * 0.85 ? "pay" : "skip";
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI ${choice === "pay" ? "支付信用" : "跳过信用支付"}`, {
          logPlayerId: player.id,
          rewardValue,
          creditValue: AI_RESOURCE_VALUES.credits,
          choice,
        });
        return handlePayCreditChoice(choice);
      }

      if (pendingType === "discard_corner_repeat") {
        const selectedCard = chooseAiDiscardCornerRepeatCard(pending, player);
        const cardId = selectedCard?.id || chooseFirstAiButton("[data-discard-corner-card-id]")?.dataset?.discardCornerCardId || null;
        if (!cardId) return { ok: false, blocked: true, message: "AI 没有可重复角标的弃牌" };
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 选择重复角标弃牌`, {
          logPlayerId: player.id,
          cardId,
        });
        return handleDiscardCornerRepeatChoice(cardId);
      }

      if (pendingType === "remove_orbit_to_probe") {
        const button = chooseFirstAiButton("[data-remove-orbit-to-probe]");
        const choiceId = button?.dataset?.removeOrbitToProbe || pending.choices?.[0]?.id || null;
        if (!choiceId) return { ok: false, blocked: true, message: "AI 没有可移除的环绕标记" };
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 移除环绕放置探测器`, {
          logPlayerId: player.id,
          choiceId,
          label: button?.textContent || "",
        });
        return handleRemoveOrbitToProbeChoice(choiceId);
      }

      if (pendingType === "return_unfinished_task") {
        const selected = (pending.choices || [])
          .map((card, index) => ({ card, index, price: getCardPrice(card) }))
          .sort((left, right) => aiNumber(left.price) - aiNumber(right.price) || left.index - right.index)[0]?.card || null;
        const cardId = selected?.id || chooseFirstAiButton("[data-return-task-card-id]")?.dataset?.returnTaskCardId || null;
        if (!cardId) return { ok: false, blocked: true, message: "AI 没有可返回手牌的任务卡" };
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 返回未完成任务卡`, {
          logPlayerId: player.id,
          cardId,
        });
        return handleReturnUnfinishedTaskChoice(cardId);
      }

      return null;
    }

    function runAiScanTargetDecision(workingRoot) {
      if (!state.pendingScanTargetAction && (!els.scanTargetOverlay || els.scanTargetOverlay.hidden)) return null;
      const pending = state.pendingScanTargetAction || null;
      const pendingType = pending?.type || null;
      if (!pendingType) return null;
      const player = getAiPendingDecisionPlayer(workingRoot, pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择扫描目标` };
      }

      if (pendingType === "optional_hand_scan") {
        const hasScannableHandCard = (player?.hand || [])
          .some((card) => card && getPublicScanChoicesForCard(card).ok);
        const choice = hasScannableHandCard ? "start" : "skip";
        recordAiAutoBattleLog("hand-scan", `${player.colorLabel}AI ${choice === "start" ? "开始" : "跳过"}可选手牌扫描`, {
          logPlayerId: player.id,
          choice,
          effectId: pending.effect?.id || null,
        });
        return handleOptionalHandScanChoice(choice);
      }

      if (pendingType === "conditional_sector_scan") {
        const scanTargetOptions = {
          player,
          pendingType,
          gainData: pending.effect?.options?.gainData,
        };
        const rankedButtons = rankAiScanTargetButtons(
          queryAiButtons("[data-conditional-sector-x]"),
          scanTargetOptions,
        );
        const button = rankedButtons[0]?.button || null;
        if (!button) {
          return { ok: false, blocked: true, message: "AI 没有可选条件扇区" };
        }
        recordAiAutoBattleLog("scan-target", `${player.colorLabel}AI 选择条件扇区扫描`, {
          logPlayerId: player.id,
          pendingType,
          sectorX: button.dataset.conditionalSectorX || null,
          label: button.textContent || "",
          selectedScore: roundAiScore(rankedButtons[0]?.score),
          topChoices: rankedButtons
            .slice(0, 6)
            .map((entry) => summarizeAiScanTargetChoiceEntry(entry, player)),
        });
        return handleConditionalSectorChoice(button.dataset.conditionalSectorX);
      }

      if (pendingType === "industry_remove_tech") {
        const choice = (pending.choices || []).find((entry) => entry?.nebulaId) || null;
        const tileId = choice?.nebulaId || chooseFirstAiButton("[data-nebula-id]")?.dataset?.nebulaId || null;
        if (!tileId) return { ok: false, blocked: true, message: "AI 没有可无效的非蓝色科技" };
        recordAiAutoBattleLog("industry", `${player.colorLabel}AI 选择赫利昂无效科技`, {
          logPlayerId: player.id,
          tileId,
        });
        return confirmScanTarget(tileId);
      }

      const rareResult = runAiRareScanTargetDecision(pending, player);
      if (rareResult) return rareResult;

      if (!["sector_scan", "public_scan", "hand_scan"].includes(pendingType)) {
        return null;
      }
      const scanTargetOptions = {
        player,
        pendingType,
        gainData: pending.gainData,
      };
      const rankedButtons = rankAiScanTargetButtons(
        queryAiButtons(".scan-target-option-button")
          .filter((item) => item.dataset.nebulaId != null),
        scanTargetOptions,
      );
      const button = rankedButtons[0]?.button || null;
      if (!button) {
        let fallbackChoices = pending.choices || [];
        if (!fallbackChoices.length && (pendingType === "public_scan" || pendingType === "hand_scan") && pending.card) {
          const scanChoices = getPublicScanChoicesForCard(pending.card);
          fallbackChoices = scanChoices?.ok ? (scanChoices.choices || []) : [];
        }
        const rankedChoices = rankAiScanTargetChoices(fallbackChoices, {
          player,
          pendingType,
          gainData: pending.gainData,
        });
        const choiceEntry = rankedChoices[0] || null;
        const choice = choiceEntry?.choice || null;
        if (choice) {
          recordAiAutoBattleLog("scan-target", `${player.colorLabel}AI 选择扫描目标`, {
            logPlayerId: player.id,
            pendingType,
            nebulaId: choice.nebulaId || null,
            sectorX: choice.sectorX ?? null,
            label: choice.label || "",
            source: "pending-choice-fallback",
            selectedScore: roundAiScore(choiceEntry?.score),
            topChoices: rankedChoices
              .slice(0, 6)
              .map((entry) => summarizeAiScanTargetChoiceEntry(entry, player)),
          });
          return confirmScanTarget(choice.nebulaId, choice.sectorX);
        }
        if (isActionEffectFlowActive()) {
          const effect = getCurrentActionEffect?.() || null;
          recordAiAutoBattleLog("scan-target", `${player.colorLabel}AI 跳过无目标扫描`, {
            logPlayerId: player.id,
            pendingType,
            effectId: effect?.id || null,
            effectType: effect?.type || null,
          });
          closeScanTargetPicker?.({
            forcePublicScanQueueClose: true,
            forceYichangdianCornerClose: true,
          });
          skipCurrentActionEffect?.();
          return { ok: true, progressed: true, skipped: true, message: "AI 已跳过无可选目标扫描" };
        }
        return { ok: false, blocked: true, message: "AI 没有可选扫描目标" };
      }
      recordAiAutoBattleLog("scan-target", `${player.colorLabel}AI 选择扫描目标`, {
        logPlayerId: player.id,
        pendingType,
        nebulaId: button.dataset.nebulaId || null,
        sectorX: button.dataset.sectorX || null,
        label: button.textContent || "",
        selectedScore: roundAiScore(rankedButtons[0]?.score),
        topChoices: rankedButtons
          .slice(0, 6)
          .map((entry) => summarizeAiScanTargetChoiceEntry(entry, player)),
      });
      return confirmScanTarget(button.dataset.nebulaId, button.dataset.sectorX);
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

    function runAiActionEffectMoveDecision(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      if (!state.pendingActionEffectFlow?.cardMoveEffect && !state.pendingActionEffectFlow?.freeMoveMode) return null;
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工选择移动路径` };
      }

      if (state.pendingActionEffectFlow.freeMoveMode) {
        const candidates = listAiEffectMoveCandidates(workingRoot, { id: "freeMove", free: true });
        const selected = selectScoredItem(candidates);
        if (!selected || aiNumber(selected.score) < 0) {
          const message = "AI 没有可用免费移动路径，跳过移动效果";
          recordAiAutoBattleLog("move-path-skip", `${currentPlayer.colorLabel}${message}`, {
            reason: selected ? "negative-free-move-score" : "no-free-move-candidates",
            selected,
          });
          skipCurrentActionEffect?.();
          return { ok: true, progressed: true, skipped: true, message };
        }
        recordAiAutoBattleLog("move-path", `${currentPlayer.colorLabel}AI 选择免费移动 ${selected.rocketLabel} ${selected.directionLabel}`, {
          selected,
          candidates,
        });
        const result = executeFreeMoveForScanAction4(workingRoot, selected.deltaX, selected.deltaY, selected.rocketId);
        if (result?.ok !== false) return result;
        skipCurrentActionEffect?.();
        return {
          ok: true,
          progressed: true,
          skipped: true,
          message: `免费移动执行失败，已跳过：${result.message || "未知原因"}`,
        };
      }

      const ctx = state.pendingActionEffectFlow.cardMoveEffect;
      const effect = ctx?.effect || getCurrentActionEffect();
      const nextEffect = getAiNextActionEffect();
      const candidates = listAiEffectMoveCandidates(workingRoot, {
        id: "cardMove",
        effect,
        poolRemaining: ctx?.poolRemaining ?? effect?.options?.movementPoints ?? 1,
        nextEffect,
      });
      const selected = selectScoredItem(candidates);
      if (!selected || aiNumber(selected.score) < 0) {
        const message = "AI 没有可用卡牌移动路径，跳过移动效果";
        recordAiAutoBattleLog("move-path-skip", `${currentPlayer.colorLabel}${message}`, {
          effectId: effect?.id || null,
          reason: selected ? "negative-card-move-score" : "no-card-move-candidates",
          selected,
        });
        skipCurrentActionEffect?.();
        return { ok: true, progressed: true, skipped: true, message };
      }
      recordAiAutoBattleLog("move-path", `${currentPlayer.colorLabel}AI 选择卡牌移动 ${selected.rocketLabel} ${selected.directionLabel}`, {
        effectId: effect?.id || null,
        selected,
        candidates,
      });
      const result = executeCardMoveForEffect(workingRoot, selected.deltaX, selected.deltaY, selected.rocketId);
      if (result?.ok !== false) return result;
      skipCurrentActionEffect?.();
      return {
        ok: true,
        progressed: true,
        skipped: true,
        message: `卡牌移动执行失败，已跳过：${result.message || "未知原因"}`,
      };
    }

    function runAiCardCornerFreeMoveDecision(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      if (!state.pendingCardCornerFreeMove) return null;
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工处理卡牌角标移动` };
      }
      const pending = state.pendingCardCornerFreeMove;
      const movementPoints = pending.action?.moveReward?.movementPoints || pending.action?.movementPoints || 1;
      const candidates = listAiEffectMoveCandidates(workingRoot, {
        id: "cardCornerMove",
        free: true,
        poolRemaining: movementPoints,
      });
      const selected = selectScoredItem(candidates);
      if (!selected) {
        return { ok: false, blocked: true, message: "AI 没有可用卡牌角标移动路径" };
      }
      recordAiAutoBattleLog("move-path", `${currentPlayer.colorLabel}AI 选择卡牌角标移动 ${selected.rocketLabel} ${selected.directionLabel}`, {
        selected,
        candidates,
      });
      const result = executeFreeMoveForCardCorner(workingRoot, selected.deltaX, selected.deltaY, selected.rocketId);
      if (result?.ok) incrementAiCardCornerMoveCountThisTurn(workingRoot, currentPlayer.id);
      return result;
    }

    function runAiIndustryFreeMoveDecision(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      if (!state.industryFreeMoveState) return null;
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工处理公司免费移动` };
      }
      const candidates = listAiIndustryHuanyuMoveCandidates(workingRoot);
      const selected = selectScoredItem(candidates);
      if (!selected || aiNumber(selected.score) < 0) {
        const message = `${state.industryFreeMoveState?.label || "公司免费移动"}：无正收益移动，结束剩余免费移动`;
        recordAiAutoBattleLog("industry", `${currentPlayer.colorLabel}AI 跳过公司剩余免费移动`, {
          candidates,
          message,
        });
        if (typeof finishIndustryAbilityFlow === "function") {
          finishIndustryAbilityFlow(message);
          return { ok: true, progressed: true, message };
        }
        return { ok: false, blocked: true, message: "AI 没有可用公司免费移动路径" };
      }
      recordAiAutoBattleLog("move-path", `${currentPlayer.colorLabel}AI 选择公司免费移动 ${selected.rocketLabel} ${selected.directionLabel}`, {
        selected,
        candidates,
      });
      return executeIndustryFreeMove(workingRoot, selected.deltaX, selected.deltaY, selected.rocketId);
    }

    function listAiScanAction4Candidates(workingRoot, currentPlayer = getWorkingCurrentPlayer(workingRoot)) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!currentPlayer) return [];
      const candidates = [];
      const effect = getCurrentActionEffect?.() || null;
      const skipCost = Boolean(effect?.options?.skipCost);
      const rocketLimit = abilities.rocket.getRocketLimitForPlayer(currentPlayer, createActionContext(workingRoot));
      const activeRocketCount = rocketActions.getRocketsForPlayer
        ? rocketActions.getRocketsForPlayer(rocketState, currentPlayer.id).length
        : getWorkingMovableTokens(workingRoot, currentPlayer.id).length;
      const canLaunch = activeRocketCount < rocketLimit
        && (skipCost || players.canAfford(currentPlayer, { energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY }));
      if (canLaunch) {
        const launchGain = scoreAiLaunchAction(currentPlayer);
        const launchCost = skipCost ? 0 : scoreAiResourceBundle({ energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY });
        candidates.push({
          id: "launch",
          kind: "effect",
          choice: "launch",
          available: true,
          gain: launchGain,
          cost: launchCost,
          score: launchGain - launchCost,
          valueBreakdown: {
            launchGain,
            launchCost,
            scanAction4: true,
            skipCost,
          },
        });
      }

      candidates.push(...listAiEffectMoveCandidates(workingRoot, {
        id: "move",
        free: true,
        poolRemaining: 1,
      }).map((candidate) => ({
        ...candidate,
        id: "move",
        kind: "effect",
        choice: "move",
        valueBreakdown: {
          ...(candidate.valueBreakdown || {}),
          scanAction4: true,
        },
      })));
      return candidates;
    }

    function runAiScanAction4Decision(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      if (!els.scanAction4Overlay || els.scanAction4Overlay.hidden) return null;
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工处理扫描发射/移动` };
      }

      const candidates = listAiScanAction4Candidates(workingRoot, currentPlayer);
      const selected = selectScoredItem(candidates);
      if (!selected || aiNumber(selected.score) < 0) {
        const message = "AI 没有正收益的扫描发射/移动选择，跳过效果";
        recordAiAutoBattleLog("scan-action-4-skip", `${currentPlayer.colorLabel}${message}`, {
          selected,
          candidates,
        });
        skipCurrentActionEffect?.();
        return { ok: true, progressed: true, skipped: true, message };
      }

      recordAiAutoBattleLog("scan-action-4", `${currentPlayer.colorLabel}AI 选择扫描发射/移动：${selected.choice}`, {
        selected,
        candidates,
      });
      if (selected.choice === "launch") {
        return handleScanAction4Choice("launch");
      }
      return executeFreeMoveForScanAction4(workingRoot, selected.deltaX, selected.deltaY, selected.rocketId);
    }

    function getAiAlienTraceButtons(selector, roots = []) {
      return [...(roots || [])]
        .flatMap((root) => [...(root?.querySelectorAll?.(selector) || [])])
        .filter((button) => button && !button.disabled)
        .map((button) => button);
    }

    function listAiAlienStateTraceTargets(options = {}) {
      const pickerMode = String(state.alienTracePickerState?.mode || "");
      const allowPendingFallback = Boolean(options.allowPendingFallback && state.pendingAlienTraceAction);
      if (
        pickerMode !== "debug-direct"
        && pickerMode !== "trace-board"
        && !pickerMode.endsWith("-grid")
        && !allowPendingFallback
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
      const forcedPendingStateExtraTrace = Boolean(
        state.pendingAlienTraceAction
        && target.kind === "state-slot"
        && target.button.dataset.stateTraceKind === "extra"
      );
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
      } else if (pickerMode || state.pendingAlienTraceAction) {
        targets = listAiAlienPickerTargets();
        if (!targets.length && state.pendingAlienTraceAction) {
          targets = listAiAlienStateTraceTargets({ allowPendingFallback: true });
        }
      }
      return targets
        .map((target, index) => ({ ...target, index, score: scoreAiAlienTraceTarget(workingRoot, target, player) }))
        .filter((target) => Number.isFinite(target.score))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0] || null;
    }

    function runAiAlienTraceDecision(workingRoot) {
      if (!state.pendingAlienTraceAction && (!state.alienTracePickerState || !state.alienTracePickerState.mode)) return null;
      const player = getAlienTraceActionPlayer(state.pendingAlienTraceAction || state.alienTracePickerState);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择外星人痕迹` };
      }

      const target = chooseAiAlienTraceTarget(workingRoot, player);
      if (!target?.button) {
        const message = "AI 没有可用外星人痕迹目标，已跳过当前效果";
        recordAiAutoBattleLog("alien-trace-skip", message, {
          logPlayerId: player.id || null,
          logPlayerColor: player.color || null,
          mode: state.alienTracePickerState?.mode || null,
        });
        skipCurrentActionEffect?.();
        return { ok: true, progressed: true, skipped: true, message };
      }
      const button = target.button;
      const traceType = getAiAlienTraceTargetTraceType(target);
      recordAiAutoBattleLog("alien-trace", `${player.colorLabel}AI 选择外星人痕迹`, {
        logPlayerId: player.id || null,
        logPlayerColor: player.color || null,
        kind: target.kind,
        mode: state.alienTracePickerState?.mode || null,
        alienSlot: button.dataset.alienSlot || null,
        pickerStep: button.dataset.alienPickerStep || null,
        traceType: traceType || null,
        position: getAiAlienTraceTargetPosition(target),
        score: target.score,
        b1TraceValue: scoreAiB1TraceMarginalValue(player, traceType),
        label: button.textContent || "",
      });
      button.click();
      return { ok: true, progressed: true, message: "AI 已选择外星人痕迹" };
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

    function runAiAlienUseDecision(workingRoot) {
      const flows = getAiAlienUseFlows();
      if (!flows.length) return null;
      let flow = null;
      let options = [];
      let selected = null;
      for (const candidateFlow of flows) {
        const candidatePlayer = getAiAlienPendingPlayer(workingRoot, candidateFlow.pending);
        if (!isAiAutoBattlePlayer(candidatePlayer?.id)) {
          flow = candidateFlow;
          break;
        }
        const candidateOptions = listAiAlienUseOptions(workingRoot, candidateFlow);
        const alienPolicy = decidePolicyChoice(workingRoot, "choose_reward", candidatePlayer, `alien:${candidateFlow.type}`, candidateOptions
          .filter((option) => !option.disabled)
          .map((option, index) => ({
            choiceId: `alien-option-${index}`,
            value: ai.selectionEvaluator.scoreAlienUseOption(option),
            target: { optionIndex: index },
            summary: `外星人选项 ${index + 1}`,
            option,
          })));
        const candidateSelected = alienPolicy.ok ? alienPolicy.choice.option : null;
        if (candidateSelected) {
          flow = candidateFlow;
          options = candidateOptions;
          selected = candidateSelected;
          break;
        }
      }
      if (!flow && isActionEffectFlowActive()) return null;
      if (!flow) return { ok: false, blocked: true, message: "AI 没有可处理的外星人选项" };
      const player = getAiAlienPendingPlayer(workingRoot, flow.pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工处理${flow.label}` };
      }
      if (!selected) {
        return { ok: false, blocked: true, message: `AI 没有可用${flow.label}选项` };
      }

      recordAiAutoBattleLog("alien-use", `${player.colorLabel}AI 处理${flow.label}`, {
        logPlayerId: player.id || null,
        logPlayerColor: player.color || null,
        pendingType: flow.type,
        selected: {
          choice: selected.choice,
          label: selected.label,
        },
        options: options.map((option) => ({
          choice: option.choice,
          label: option.label,
          disabled: option.disabled,
          score: option.score,
        })),
      });

      if (typeof flow.handleChoice === "function") {
        return flow.handleChoice(selected.choice, { automated: true });
      }
      selected.button?.click();
      return { ok: true, progressed: true, message: `AI 已处理${flow.label}` };
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


    function runAiResearchTechSelectionDecision(workingRoot, effect) {
      const { techGameState, playerState } = requireWorkingRoot(workingRoot);
      if (!isTechTilePickingActive()) return null;
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工选择科技片` };
      }
      const selectionOptions = getAiResearchTechSelectionOptionsForEffect(effect);

      if (techGameState.ui.pendingTileId) {
        const availableSlots = tech.getAvailableBlueSlots(currentPlayer.techState);
        const blueSlotPolicy = decideBlueSlot(workingRoot, currentPlayer, availableSlots, `blue-slot:${techGameState.ui.pendingTileId}`);
        if (!blueSlotPolicy.ok) return { ok: false, blocked: true, code: blueSlotPolicy.code, message: blueSlotPolicy.message };
        const blueSlot = blueSlotPolicy.choice.slot;
        if (blueSlot == null) {
          return { ok: false, blocked: true, message: "AI 没有可用蓝色科技槽位" };
        }
        recordAiAutoBattleLog("tech-placement", `${currentPlayer.colorLabel}AI 选择蓝色科技槽位 ${blueSlot}`, {
          tileId: techGameState.ui.pendingTileId,
          availableSlots,
          blueSlot,
        });
        return confirmTechBlueSlotChoice(workingRoot, blueSlot);
      }

      const candidates = techGameState.ui.industryBorrowMode
        ? listAiBorrowTechCandidates(workingRoot, currentPlayer)
        : listAiResearchTechCandidates(workingRoot, selectionOptions);
      const techPolicy = decidePolicyChoice(workingRoot, "choose_target", currentPlayer, `research-tech:${effect?.id || "generic"}`, candidates
        .filter((candidate) => candidate?.available !== false)
        .map((candidate) => ({
          choiceId: candidate.tileId,
          value: ai.selectionEvaluator.scoreResearchTechCandidate(candidate),
          target: { tileId: candidate.tileId },
          summary: candidate.label || candidate.tileId,
          candidate,
        })));
      const policySelected = techPolicy.ok ? techPolicy.choice.candidate : null;
      if (!techPolicy.ok && candidates.length) {
        return { ok: false, blocked: true, code: techPolicy.code, message: techPolicy.message };
      }
      const policyCheck = policySelected
        ? getAiResearchTechCandidateExecutionCheck(workingRoot, policySelected, currentPlayer, selectionOptions)
        : null;
      let selected = policySelected || candidates[0] || null;
      const executable = selectExecutableAiResearchTechCandidate(workingRoot, candidates, selected, currentPlayer, selectionOptions);
      if (!executable.candidate && selected?.tileId) {
        recordAiAutoBattleLog("tech-placement-reject", `${currentPlayer.colorLabel}AI 科技候选失效：${selected.tileId}`, {
          selected,
          reason: executable.check?.message || null,
        });
      }
      selected = executable.candidate;
      if (!selected?.tileId) {
        const message = `${effect?.label || "选择科技"}：${executable.check?.message || "没有可研究科技候选"}，已跳过`;
        recordAiAutoBattleLog("tech-placement", `${currentPlayer.colorLabel}AI 跳过科技选择`, {
          effectId: effect?.id || null,
          effectType: effect?.type || null,
          candidates,
          message,
        });
        cancelTechSelection?.();
        skipCurrentActionEffect?.();
        return { ok: true, progressed: true, skipped: true, message };
      }
      if (policySelected?.tileId && policySelected.tileId !== selected.tileId) {
        recordAiAutoBattleLog("tech-placement-retarget", `${currentPlayer.colorLabel}AI 改选科技 ${selected.tileId}`, {
          rejected: policySelected,
          selected,
          reason: policyCheck?.message || null,
        });
      }
      recordAiAutoBattleLog("tech-placement", `${currentPlayer.colorLabel}AI 选择科技 ${selected.tileId}`, {
        selected,
        candidates,
      });
      const result = handleSupplyTechTileClick(selected.tileId);
      if (result?.needsBlueSlotChoice) {
        const availableSlots = result.availableSlots || [];
        const blueSlotPolicy = decideBlueSlot(workingRoot, currentPlayer, availableSlots, `blue-slot:${selected.tileId}`);
        if (!blueSlotPolicy.ok) return { ok: false, blocked: true, code: blueSlotPolicy.code, message: blueSlotPolicy.message };
        const blueSlot = blueSlotPolicy.choice.slot;
        if (blueSlot == null) return result;
        recordAiAutoBattleLog("tech-placement", `${currentPlayer.colorLabel}AI 选择蓝色科技槽位 ${blueSlot}`, {
          tileId: selected.tileId,
          availableSlots,
          blueSlot,
        });
        return confirmTechBlueSlotChoice(workingRoot, blueSlot);
      }
      return result;
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
      scoreAiHandCornerChoice,
      chooseAiHandCornerChoice,
      getAiIncomeGainValue,
      chooseAiDiscardAnyIncomeCards,
      scoreAiPayCreditReward,
      chooseAiDiscardCornerRepeatCard,
      chooseAiProbeSectorScanChoices,
      chooseAiProbeLocationRewardButton,
      runAiDataPlacementDecision,
      scoreAiStrategyPassiveSlotChoice,
      runAiStrategyPassiveSlotChoiceDecision,
      runAiMovePaymentDecision,
      runAiLandTargetDecision,
      runAiProbeSectorScanDecision,
      runAiProbeLocationRewardDecision,
      runAiRareScanTargetDecision,
      runAiScanTargetDecision,
      buildAiEffectMoveCandidate,
      isAiIndustryHuanyuMoveEffect,
      isAiIndustryHuanyuMoveContext,
      getAiCompletedIndustryHuanyuMoveRocketIds,
      listAiEffectMoveCandidates,
      runAiActionEffectMoveDecision,
      runAiCardCornerFreeMoveDecision,
      runAiIndustryFreeMoveDecision,
      listAiScanAction4Candidates,
      runAiScanAction4Decision,
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
      runAiAlienUseDecision,
      runAiMoveActionDecision,
      runAiResearchTechSelectionDecision,
    };
  }

  const REQUIRED_CONTEXT_KEYS = Object.freeze([
    "AI_MAX_CARD_CORNER_MOVES_PER_TURN", "AI_MOVE_DIRECTIONS", "AI_RESOURCE_VALUES", "FINAL_ROUND_NUMBER", "MOVE_ENERGY_COST", "abilities", "ai", "aiAutoBattleState",
    "aiNumber", "aliens", "amiba", "aomomo", "applyAiStrategyWeight", "banrenma", "buildAiChongTransportMoveCandidate",
    "buildAiPlayCardCandidate", "buildSectorScanChoicesForX", "canAiContinueCardMoveAfterStep", "canAiPlanetAcceptLanding", "canAiPlanetAcceptOrbit", "canPayForMove", "cancelTechSelection", "cardEffects",
    "cards", "chong", "chooseAiDataPlacementOptionFromButtons", "chooseAiLandChoice", "closeScanTargetPicker", "confirmDataPlacement", "confirmDiscardAnyForIncome", "confirmLandTargetPicker",
    "confirmMovePayment", "confirmProbeSectorScanSelection", "confirmScanTarget", "confirmStrategyPassiveSlotChoice", "confirmTechBlueSlotChoice", "createActionContext", "data", "els",
    "enrichAiAlienUseOptions", "executeCardMoveForEffect", "executeFreeMoveForCardCorner", "executeFreeMoveForScanAction4", "executeIndustryFreeMove", "fangzhou", "finishIndustryAbilityFlow", "formatRocketLabel",
    "getAiAlienCardConversionMultiplier", "getAiAlienTraceRewardForValuation", "getAiAlienTraceTargetDemandForSlot", "getAiAvailableDataRoom", "getAiDiscardedCardOpportunityCost", "getAiMapDemand", "getAiNextActionEffect", "getAiNextMissingFinalScoreThreshold",
    "getAiPlanetAtCoordinate", "getAiResearchTechCandidateExecutionCheck", "getAiResearchTechSelectionOptionsForEffect", "getAiResourceValuesForRound", "getAiRoundNumber", "getAiStrategyDemand", "getAlienTraceActionPlayer", "getBestAiNebulaChoiceScore",
    "getCardPrice", "getCurrentActionEffect",
    "getPublicScanChoicesForCard", "getRequiredMovePointsForUi", "handleAmibaCardGainChoice", "handleAmibaSymbolChoice", "handleAmibaTraceRemovalChoice", "handleAomomoCardGainChoice", "handleBanrenmaBonusChoice", "handleBanrenmaCardConditionChoice",
    "handleBanrenmaCardGainChoice", "handleChongCardGainChoice", "handleChongFossilChoice", "handleConditionalSectorChoice", "handleDiscardCornerRepeatChoice", "handleDiscardIncomeCardChoice", "handleHandCornerChoice",
    "handleJiuzheCardChoice", "handleJiuzheOpportunitySkip", "handleOptionalHandScanChoice", "handlePayCreditChoice", "handleProbeLocationRewardChoice", "handleProbeSectorScanChoice", "handleRemoveOrbitToProbeChoice", "handleRemovePlanetMarkerChoice",
    "handleReturnUnfinishedTaskChoice", "handleRunezuCardGainChoice", "handleRunezuFaceSymbolChoice", "handleRunezuSymbolBranchChoice", "handleScanAction4Choice", "handleSupplyTechTileClick", "handleYichangdianCardGainChoice", "handleYichangdianCornerChoice",
    "industry", "isActionEffectFlowActive", "isAiAutoBattlePlayer", "isAiChongFossilToken", "isAiChongPickupPlanetId", "isAiChongTravelEffect", "isAiHiddenFirstTraceColorLost", "isAiHiddenFirstTraceTakenByOpponent",
    "isAiLandingEffect", "isAiOpenHiddenFirstTraceTarget", "isMovePaymentCard", "isMovePaymentSelectionActive", "isTechTilePickingActive", "jiuzhe", "listAiBorrowTechCandidates", "listAiIndustryHuanyuMoveCandidates",
    "listAiResearchTechCandidates", "moveRocket", "players", "rankAiScanTargetButtons", "rankAiScanTargetChoices", "recordAiAutoBattleLog", "rocketActions",
    "roundAiScore", "runezu", "scanEffects", "scoreAiAlienTraceValue", "scoreAiAomomoTraceTimingValue", "scoreAiB1TraceMarginalValue", "scoreAiBanrenmaTraceTimingValue",
    "scoreAiCardCornerOpportunity", "scoreAiFangzhouUnlockChoiceValue", "scoreAiFinalSecondMarkNoDirectSetupPenalty", "scoreAiHighCostPointConversionPenalty", "scoreAiLandingAfterMove", "scoreAiLateAlienCardConversionPenalty", "scoreAiLaunchAction", "scoreAiMoveArrivalRewardValue",
    "scoreAiMovePaymentCost", "scoreAiMoveTowardTargets", "scoreAiMovementPathPenalty", "scoreAiNearestActionablePlanetTimingPenalty", "scoreAiPaceValueForDirectScore", "scoreAiResourceBundle", "scoreAiSecondFinalMarkNudgeValue", "scoreAiThirdFinalMarkCashoutValue",
    "scoreAiYichangdianAlienCardTracePriorityValue", "scoreAiYichangdianTraceTimingValue", "selectExecutableAiResearchTechCandidate", "shouldAiPreserveEnergyForRouteCashout", "skipCurrentActionEffect", "solar", "state", "summarizeAiScanTargetChoiceEntry",
    "tech", "yichangdian",
  ]);

  return { createInteractionPendingRuntime, REQUIRED_CONTEXT_KEYS };
});
