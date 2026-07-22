(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppEffectRewardExecutors = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createEffectRewardExecutors(context = {}) {
    const {
      SCORE_SOURCE_KEYS,
      abilities,
      activateNextActionEffect,
      addPlayerScoreSource,
      addScoreSourceFromGain,
      applyIncomeGainWithImmediateRewards,
      assignEffectOwner,
      banrenma,
      beginCardSelection,
      beginDiscardSelection,
      beginEffectHistoryStep,
      buildNebulaScanChoice,
      buildPlutoMarkerRemovalChoices,
      buildSectorScanChoicesForX,
      buildSectorScanChoicesForXs,
      cardEffects,
      cards,
      chong,
      closeScanTargetPicker,
      completeCurrentActionEffect,
      createActionContext,
      createPublicScanPendingAction,
      createScanRunId,
      data,
      document,
      effectChoiceFlowHelpers,
      els,
      endEffectHistoryStep,
      ensureCardFlowEventBonuses,
      ensurePlutoCardEffectState,
      executeSectorScanAtPlanet,
      expandScanChoicesWithAomomoTargets,
      finishAutomaticRewardEffect,
      formatCardCornerRewardMessage,
      formatIncomeGain,
      formatPlanetRewardGain,
      getAutoDataPlacementCheck,
      getCardTypeCode,
      getCurrentActionEffect,
      getCurrentPlayer,
      getEarthSectorCoordinate,
      getEffectOwnerPlayer,
      getExplicitEffectOwnerPlayer,
      getNebulaCurrentX,
      getPendingOwnerFields,
      getPendingOwnerPlayer,
      getPlanetName,
      getPlayerOwnerKeys,
      getPublicScanChoicesForCard,
      getPublicScanIconForScanCode,
      getSectorContentForMove,
      historyCommands,
      initialCards,
      isAsteroidContent,
      isDataPoolFull,
      isRuntimeCardConditionMet,
      markCurrentActionIrreversible,
      markerBelongsToPlayer,
      maybeApplyIndustryLaunchScan,
      nebulaHasScannableData,
      normalizeResourceCost,
      openAutoDataPlacementPrompt,
      openScanTargetPicker,
      planetReferenceLayout,
      planetStats,
      players,
      recordAbilityCommands,
      recordHistoryCommand,
      recordScoreSourceForGainEffect,
      renderActionEffectBar,
      renderPlayerHand,
      renderPlayerStats,
      renderPublicCards,
      renderReservedCards,
      renderRocketElement,
      renderRockets,
      renderStateReadout,
      renderTechBoard,
      replaceNebulaDataForCurrentPlayer,
      resolvePlayerReference,
      restoreObjectSnapshot,
      rocketActions,
      runezu,
      scanEffects,
      solar,
      skipActionEffectWithMessage,
      syncHandScanSelectionChrome,
      syncTechSelectionChrome,
      uiRuntimeState,
      updateActionButtons,
      withPendingOwnerPlayer,
    } = context;
    const ruleAlienGameState = (workingRoot) => workingRoot.alienGameState;
    const ruleCardState = (workingRoot) => workingRoot.cardState;
    const ruleNebulaDataState = (workingRoot) => workingRoot.nebulaDataState;
    const rulePlanetStatsState = (workingRoot) => workingRoot.planetStatsState;
    const rulePlayerState = (workingRoot) => workingRoot.playerState;
    const ruleRocketState = (workingRoot) => workingRoot.rocketState;
    const ruleTurnState = (workingRoot) => workingRoot.turnState;
    const getScanTargetContinuation = (workingRoot) => workingRoot.match?.scanTargetContinuation || null;
    function setScanTargetContinuation(workingRoot, continuation) {
      if (!continuation) delete workingRoot.match.scanTargetContinuation;
      else workingRoot.match.scanTargetContinuation = structuredClone(continuation);
    }
    const decisionState = context.decisionSessions?.createFacade?.({
      alienTraceAction: "alien_trace_action",
      alienTracePickerState: "alien_trace_picker_state",
      actionEffectFlow: "action_effect_flow",
    }) || {};

    function signalOwnerMatches(workingRoot, item, player) {
      const keys = getPlayerOwnerKeys(workingRoot, player);
      return keys.has(item?.replacedByPlayerId)
        || keys.has(item?.playerId)
        || keys.has(item?.replacedByPlayerColor)
        || keys.has(item?.playerColor);
    }

    function countPlayerSignalsInNebula(workingRoot, player, nebulaId) {
      let count = data.listNebulaTokens(ruleNebulaDataState(workingRoot), nebulaId)
        .filter((token) => signalOwnerMatches(workingRoot, token, player))
        .length;
      if (typeof data.listSectorExtraMarks === "function") {
        count += data.listSectorExtraMarks(ruleNebulaDataState(workingRoot), nebulaId)
          .filter((mark) => signalOwnerMatches(workingRoot, mark, player))
          .length;
      }
      return count;
    }

    function countPlayerSignalsInSectorX(workingRoot, player, sectorX) {
      return buildSectorScanChoicesForX(sectorX)
        .filter((choice) => choice.nebulaId)
        .reduce((total, choice) => total + countPlayerSignalsInNebula(workingRoot, player, choice.nebulaId), 0);
    }

    function getSectorXsMatchingCondition(workingRoot, condition, player = getCurrentPlayer(workingRoot)) {
      return cardEffects.getMatchingConditionalSectorXs(
        condition,
        Array.from({ length: 8 }, (_item, x) => x),
        (sectorX) => countPlayerSignalsInSectorX(workingRoot, player, sectorX),
      );
    }

    function sectorXHasAvailableScanTarget(workingRoot, sectorX) {
      return buildSectorScanChoicesForX(solar.mod8(Number(sectorX) || 0))
        .some((choice) => choice.nebulaId && !choice.disabled);
    }

    function executeConditionalSectorScanEffect(workingRoot, effect) {
      return effectChoiceFlowHelpers.executeConditionalSectorScanEffect(workingRoot, effect);
    }

    function handleConditionalSectorChoice(workingRoot, sectorXValue) {
      return effectChoiceFlowHelpers.handleConditionalSectorChoice(workingRoot, sectorXValue);
    }

    function renderDiscardIncomePicker(workingRoot) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "discard_any_income" || !els.scanTargetActions) return;
      const selected = new Set(pending.selectedCardIds || []);
      const currentPlayer = getPendingOwnerPlayer(workingRoot, pending, pending.effect);
      const buttons = (currentPlayer?.hand || []).map((card) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.classList.toggle("is-selected", selected.has(card.id));
        button.dataset.discardIncomeCardId = card.id;
        const gain = cards.getIncomeGainForCard(card);
        button.innerHTML = `${cards.getCardLabel(card)}<small>${gain ? formatIncomeGain(gain) : "无收入图标"}</small>`;
        return button;
      });
      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "scan-target-option-button";
      confirm.dataset.discardIncomeConfirm = "true";
      confirm.innerHTML = `确认<small>已选 ${selected.size} 张</small>`;
      buttons.push(confirm);
      els.scanTargetActions.replaceChildren(...buttons);
    }

    function executeDiscardAnyForIncomeEffect(workingRoot, effect) {
      return effectChoiceFlowHelpers.executeDiscardAnyForIncomeEffect(workingRoot, effect);
    }

    function handleDiscardIncomeCardChoice(workingRoot, cardId) {
      return effectChoiceFlowHelpers.handleDiscardIncomeCardChoice(workingRoot, cardId);
    }

    function confirmDiscardAnyForIncome(workingRoot) {
      return effectChoiceFlowHelpers.confirmDiscardAnyForIncome(workingRoot);
    }

    function expandPayCreditsForRewardEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const count = Math.max(0, Math.round(Number(currentPlayer?.resources?.credits) || 0));
      if (count <= 0) {
        return finishAutomaticRewardEffect(workingRoot, effect, {
          ok: true,
          skipped: true,
          message: `${effect.label}：没有信用可支付，已跳过`,
        });
      }
      const followups = [];
      for (let index = 0; index < count; index += 1) {
        followups.push({
          ...effect,
          id: `${effect.id || "pay-credit"}-${index + 1}`,
          label: `${effect.label} ${index + 1}/${count}`,
          icon: "credits",
          options: { ...(effect.options || {}), single: true, groupId: effect.id || "pay-credit" },
        });
      }
      insertActionEffectsAfterCurrent(workingRoot, followups);
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：已追加 ${count} 个可选支付节点`,
        payload: { count },
      });
    }

    function executePayCreditsForRewardEffect(workingRoot, effect) {
      return effectChoiceFlowHelpers.executePayCreditsForRewardEffect(workingRoot, effect);
    }

    function handlePayCreditChoice(workingRoot, choice) {
      return effectChoiceFlowHelpers.handlePayCreditChoice(workingRoot, choice);
    }

    function getFundamentalismExchangeChoiceSpecs(workingRoot, player = getCurrentPlayer(workingRoot)) {
      const score = Number(player?.resources?.score) || 0;
      const credits = Number(player?.resources?.credits) || 0;
      const energy = Number(player?.resources?.energy) || 0;
      const handCount = Array.isArray(player?.hand) ? player.hand.length : 0;
      const publicCount = Array.isArray(ruleCardState(workingRoot).publicCards) ? ruleCardState(workingRoot).publicCards.length : 0;
      return [
        {
          id: "score_to_credits",
          label: "3分换1信用点",
          description: "消耗3分，获得1信用点",
          cost: { score: 3 },
          gain: { credits: 1 },
          disabled: score < 3,
        },
        {
          id: "score_to_energy",
          label: "3分换1能量",
          description: "消耗3分，获得1能量",
          cost: { score: 3 },
          gain: { energy: 1 },
          disabled: score < 3,
        },
        {
          id: "score_to_card",
          label: "3分换1精选",
          description: "消耗3分，精选1张公共牌",
          cost: { score: 3 },
          pickCard: true,
          disabled: score < 3 || publicCount <= 0,
        },
        {
          id: "credits_to_score",
          label: "1信用点换3分",
          description: "消耗1信用点，获得3分",
          cost: { credits: 1 },
          gain: { score: 3 },
          disabled: credits < 1,
        },
        {
          id: "energy_to_score",
          label: "1能量换3分",
          description: "消耗1能量，获得3分",
          cost: { energy: 1 },
          gain: { score: 3 },
          disabled: energy < 1,
        },
        {
          id: "card_to_score",
          label: "弃1牌换3分",
          description: "弃1张手牌，获得3分",
          discardCard: true,
          gain: { score: 3 },
          disabled: handCount < 1,
        },
      ];
    }

    function getFundamentalismExchangeChoice(workingRoot, choiceId, player = getCurrentPlayer(workingRoot)) {
      return getFundamentalismExchangeChoiceSpecs(workingRoot, player).find((choice) => choice.id === choiceId) || null;
    }

    function executeIndustryFundamentalismExchangeEffect(workingRoot, effect) {
      return effectChoiceFlowHelpers.executeIndustryFundamentalismExchangeEffect(workingRoot, effect);
    }

    function formatFundamentalismExchangeCost(workingRoot, cost) {
      const normalizedCost = normalizeResourceCost(cost) || {};
      const scoreCost = Math.max(0, Math.round(Number(normalizedCost.score) || 0));
      const resourceCost = { ...normalizedCost };
      delete resourceCost.score;
      const parts = [];
      if (scoreCost) parts.push(`${scoreCost}分`);
      const resourceText = players.formatResourceCost(resourceCost);
      if (resourceText) parts.push(resourceText);
      return parts.join(" + ");
    }

    function canAffordFundamentalismExchangeCost(workingRoot, player, cost) {
      const normalizedCost = normalizeResourceCost(cost) || {};
      const scoreCost = Math.max(0, Math.round(Number(normalizedCost.score) || 0));
      if (scoreCost > 0 && (Number(player?.resources?.score) || 0) < scoreCost) return false;
      const resourceCost = { ...normalizedCost };
      delete resourceCost.score;
      return players.canAfford(player, resourceCost);
    }

    function spendFundamentalismExchangeCost(workingRoot, player, cost) {
      const normalizedCost = normalizeResourceCost(cost) || {};
      if (!Object.keys(normalizedCost).length) return { ok: true };
      if (!canAffordFundamentalismExchangeCost(workingRoot, player, normalizedCost)) {
        return { ok: false, message: `资源不足，需要 ${formatFundamentalismExchangeCost(workingRoot, normalizedCost)}` };
      }
      const scoreCost = Math.max(0, Math.round(Number(normalizedCost.score) || 0));
      const resourceCost = { ...normalizedCost };
      delete resourceCost.score;
      if (scoreCost) {
        player.resources.score = (Number(player.resources.score) || 0) - scoreCost;
        addPlayerScoreSource(player, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, -scoreCost);
      }
      if (!Object.keys(resourceCost).length) return { ok: true };
      return players.spendResources(player, resourceCost);
    }

    function completeFundamentalismImmediateExchange(workingRoot, effect, player, choice) {
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(player);
      const spend = spendFundamentalismExchangeCost(workingRoot, player, choice.cost);
      if (!spend.ok) {
        endEffectHistoryStep();
        ruleRocketState(workingRoot).statusNote = spend.message;
        renderStateReadout();
        return spend;
      }
      if (choice.gain && Object.keys(choice.gain).length) {
        players.gainResources(player, choice.gain);
        addScoreSourceFromGain(player, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, choice.gain);
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复原教旨主义兑换前玩家状态",
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `原教旨主义：${choice.label}`,
        payload: { choiceId: choice.id, cost: choice.cost || null, gain: choice.gain || null },
      }, [renderPlayerHand]);
    }

    function startFundamentalismPickExchange(workingRoot, effect, player, choice) {
      const beforePlayer = structuredClone(player);
      const beforeCardState = structuredClone(ruleCardState(workingRoot));
      const spend = spendFundamentalismExchangeCost(workingRoot, player, choice.cost);
      if (!spend.ok) {
        ruleRocketState(workingRoot).statusNote = spend.message;
        renderStateReadout();
        return spend;
      }
      const result = beginCardSelection({
        type: "fundamentalism_exchange_pick",
        player,
        effect,
        effectLabel: effect.label,
        beforePlayerState: beforePlayer,
        beforeCardState,
        choiceId: choice.id,
        allowBlindDraw: false,
        fromEffectFlow: true,
      });
      if (!result.ok) {
        restoreObjectSnapshot(player, beforePlayer);
        restoreObjectSnapshot(ruleCardState(workingRoot), beforeCardState);
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
        return result;
      }
      ruleRocketState(workingRoot).statusNote = `原教旨主义：${choice.label}，请选择公共牌`;
      renderPlayerStats();
      renderStateReadout();
      return result;
    }

    function startFundamentalismDiscardExchange(workingRoot, effect, player) {
      const result = beginDiscardSelection(1, {
        type: "industry_fundamentalism_score_discard",
        player,
        fromEffectFlow: true,
        effectLabel: effect.label,
        beforePlayerState: structuredClone(player),
        beforeCardState: structuredClone(ruleCardState(workingRoot)),
      });
      if (result.ok) {
        ruleRocketState(workingRoot).statusNote = "原教旨主义：请选择 1 张手牌弃掉换 3 分";
        renderStateReadout();
      }
      return result;
    }

    function handleFundamentalismExchangeChoice(workingRoot, choiceId) {
      return effectChoiceFlowHelpers.handleFundamentalismExchangeChoice(workingRoot, choiceId);
    }

    function isAlienFamilyCard(workingRoot, card) {
      const setText = String(card?.set || "");
      const cardId = String(card?.cardId || "");
      return setText.startsWith("alien:") || /^(aomomo|yichangdian|chong|amiba|jiuzhe|banrenma|fangzhou|runezu)_/.test(cardId);
    }

    function executeDiscardCardCornerRepeatEffect(workingRoot, effect) {
      return effectChoiceFlowHelpers.executeDiscardCardCornerRepeatEffect(workingRoot, effect);
    }

    function handleDiscardCornerRepeatChoice(workingRoot, cardId) {
      return effectChoiceFlowHelpers.handleDiscardCornerRepeatChoice(workingRoot, cardId);
    }

    function buildOwnOrbitChoices(workingRoot) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const choices = [];
      const planetIds = planetReferenceLayout.PLANET_ORDER || planetStats.PLANET_IDS || [];
      for (const planetId of planetIds) {
        for (const marker of planetStats.getPlanetOrbitMarkers(rulePlanetStatsState(workingRoot), planetId)) {
          if (!markerBelongsToPlayer(workingRoot, marker, currentPlayer)) continue;
          choices.push({
            id: `${planetId}:${marker.sequence}`,
            planetId,
            sequence: marker.sequence,
            label: `${getPlanetName(workingRoot, planetId)} 环绕 ${marker.sequence}`,
          });
        }
      }
      for (const choice of buildPlutoMarkerRemovalChoices("current", new Set(["orbit"]))) {
        if (choice.sectorX == null || choice.sectorY == null) continue;
        choices.push({
          ...choice,
          id: `pluto:${choice.cardId}:${choice.sequence}`,
          kind: "plutoOrbit",
          label: `${choice.label}`,
        });
      }
      return choices;
    }

    function executeRemoveOrbitToProbeEffect(workingRoot, effect) {
      return effectChoiceFlowHelpers.executeRemoveOrbitToProbeEffect(workingRoot, effect);
    }

    function handleRemoveOrbitToProbeChoice(workingRoot, choiceId) {
      return effectChoiceFlowHelpers.handleRemoveOrbitToProbeChoice(workingRoot, choiceId);
    }

    function isChongTransportStartedForCard(workingRoot, card) {
      return Boolean(card?.id && chong?.getActiveTransportForCard?.(ruleAlienGameState(workingRoot), card.id));
    }

    function isReservedTaskCardUnfinished(workingRoot, card, effect = null) {
      if (runezu?.isRunezuCard?.(card)) {
        if (cardEffects.getCardModel?.(card)?.triggers?.length) {
          return cardEffects.isReturnUnfinishedTaskTarget(card, {
            cardTypes: effect?.options?.cardTypes || [1, 2],
            isBanrenmaCard: (candidate) => Boolean(banrenma?.isBanrenmaCard?.(candidate)),
            isChongTransportStarted: isChongTransportStartedForCard,
          });
        }
        const cardTypes = new Set(
          (effect?.options?.cardTypes || [1, 2])
            .map((typeCode) => Math.round(Number(typeCode)))
            .filter((typeCode) => Number.isFinite(typeCode)),
        );
        if (!cardTypes.has(getCardTypeCode(card))) return false;
        return Boolean(runezu.isTaskUnfinished?.(card));
      }
      return cardEffects.isReturnUnfinishedTaskTarget(card, {
        cardTypes: effect?.options?.cardTypes || [1, 2],
        isBanrenmaCard: (candidate) => Boolean(banrenma?.isBanrenmaCard?.(candidate)),
        isChongTransportStarted: isChongTransportStartedForCard,
      });
    }

    function executeReturnUnfinishedTaskToHandEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const choices = (currentPlayer?.reservedCards || []).filter((card) => isReservedTaskCardUnfinished(workingRoot, card, effect));
      if (!choices.length) {
        return finishAutomaticRewardEffect(workingRoot, effect, {
          ok: true,
          skipped: true,
          undoable: true,
          message: `${effect.label}：没有未完成的 1/2 型任务卡，已跳过`,
          payload: { cardIds: [] },
        });
      }
      setScanTargetContinuation(workingRoot, { ...getPendingOwnerFields(workingRoot, effect), type: "return_unfinished_task", effect, choices });
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = effect.label;
      if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "选择一张未完成的 1/2 型保留任务卡返回手牌。";
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      if (document && els.scanTargetActions) {
        const buttons = choices.map((card) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "scan-target-option-button";
          button.dataset.returnTaskCardId = card.id;
          button.innerHTML = `${cards.getCardLabel(card)}<small>返回手牌</small>`;
          return button;
        });
        els.scanTargetActions.replaceChildren(...buttons);
      }
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = false;
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择任务卡`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function handleReturnUnfinishedTaskChoice(workingRoot, cardId) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "return_unfinished_task") return { ok: false, message: "没有待处理的任务卡回手" };
      const effect = pending.effect;
      closeScanTargetPicker(workingRoot);
      return withPendingOwnerPlayer(pending, () => {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const index = (currentPlayer?.reservedCards || []).findIndex((card) => card.id === cardId);
      if (index < 0) return { ok: false, message: "无效任务卡" };
      if (!isReservedTaskCardUnfinished(workingRoot, currentPlayer.reservedCards[index], effect)) {
        ruleRocketState(workingRoot).statusNote = "该牌不能作为未完成任务卡返回手牌";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      const [card] = currentPlayer.reservedCards.splice(index, 1);
      cards.addCardToHand(currentPlayer, card);
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复任务卡回手前玩家状态",
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${cards.getCardLabel(card)} 返回手牌`,
        payload: { cardId: card.id },
      }, [renderPlayerHand, renderReservedCards]);
      });
    }

    function countOwnedTechByType(workingRoot, player, techType) {
      return Object.keys(player?.techState?.ownedTiles || {})
        .filter((tileId) => player.techState.ownedTiles[tileId]
          && (!techType || String(tileId).startsWith(techType)))
        .length;
    }

    function executeCountTechTypesRewardEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const count = Math.max(
        countOwnedTechByType(workingRoot, currentPlayer, "orange"),
        countOwnedTechByType(workingRoot, currentPlayer, "purple"),
        countOwnedTechByType(workingRoot, currentPlayer, "blue"),
      );
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: ruleCardState(workingRoot).publicCards.slice(),
        discardPile: (ruleCardState(workingRoot).discardPile || []).slice(),
      };
      const drawResult = effect.options?.reward === "draw"
        ? cards.drawCardsToHand(ruleCardState(workingRoot), rulePlayerState(workingRoot), currentPlayer, count)
        : { ok: true, cards: [] };
      const drawnCount = (drawResult.cards || []).length;
      const irreversible = drawnCount
        ? { code: "hidden_card_reveal", reason: "盲抽翻出新牌" }
        : null;
      if (irreversible) markCurrentActionIrreversible(irreversible.reason, irreversible.code);
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复科技类型奖励前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        ruleCardState(workingRoot),
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: drawResult.ok,
        undoable: !irreversible,
        irreversible,
        message: `${effect.label}：最多科技类型 ${count}，盲抽 ${drawnCount}/${count} 张`,
        payload: { count },
      }, [renderPlayerHand]);
    }

    function executeCountOwnedTechRewardEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const count = countOwnedTechByType(workingRoot, currentPlayer, effect.options?.techType);
      const total = Math.max(0, Math.round(count * Number(effect.options?.per || 1)));
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      const dataResults = [];
      if (effect.options?.resource === "data") {
        for (let index = 0; index < total; index += 1) dataResults.push(data.gainData(currentPlayer, { source: "owned_tech_reward" }));
      } else if (total > 0) {
        const gain = { [effect.options?.resource || "score"]: total };
        players.gainResources(currentPlayer, gain);
        recordScoreSourceForGainEffect(currentPlayer, effect, gain);
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复科技数量奖励前玩家状态",
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: effect.options?.resource === "data"
          ? `${effect.label}：获得 ${dataResults.filter((item) => item.ok).length}/${total} 数据`
          : `${effect.label}：获得 ${total}`,
        payload: { count, total },
      });
    }

    function executeCountRocketsRewardEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const count = cardEffects.countRocketsForReward(
        ruleRocketState(workingRoot).rockets,
        currentPlayer,
        effect.options || {},
      );
      const total = Math.max(0, Math.round(count * Number(effect.options?.per || 1)));
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      if (total > 0) {
        const gain = { [effect.options?.resource || "energy"]: total };
        players.gainResources(currentPlayer, gain);
        recordScoreSourceForGainEffect(currentPlayer, effect, gain);
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复探测器数量奖励前玩家状态",
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${count} 个探测器，获得 ${total}`,
        payload: { count, total },
      });
    }

    function executeDiscardAllHandEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: ruleCardState(workingRoot).publicCards.slice(),
        discardPile: (ruleCardState(workingRoot).discardPile || []).slice(),
      };
      const discarded = [];
      while ((currentPlayer.hand || []).length) {
        const result = cards.discardFromHandAtIndex(currentPlayer, currentPlayer.hand.length - 1);
        if (result.ok) {
          cards.addToDiscardPile(ruleCardState(workingRoot), result.card);
          discarded.push(result.card);
        } else {
          break;
        }
      }
      insertActionEffectsAfterCurrent(workingRoot, effect.options?.rewards || []);
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复弃掉全部手牌前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        ruleCardState(workingRoot),
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：弃掉 ${discarded.length} 张手牌，已追加奖励`,
        payload: { discardedCount: discarded.length },
      }, [renderPlayerHand]);
    }

    function executeProbeStackRewardEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const match = cardEffects.getProbeStackRewardMatch(ruleRocketState(workingRoot).rockets || [], currentPlayer, {
        getCoordinate: (rocket) => rocketActions.getRocketSectorCoordinate(rocket),
      });
      const met = Boolean(match.conditionMet);
      if (met) insertActionEffectsAfterCurrent(workingRoot, effect.options?.rewards || []);
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: met
          ? `${effect.label}：扇区[${match.coordinate.x},${match.coordinate.y}]有 ${match.totalCount} 个探测器，已追加奖励`
          : `${effect.label}：条件未满足`,
        payload: match,
      });
    }

    function enrichScanResultEvents(workingRoot, result, nebulaId, options = {}) {
      if (!result?.ok) return result;
      const sectorX = options.sectorX != null
        ? solar.mod8(Number(options.sectorX))
        : getNebulaCurrentX(nebulaId);
      result.sectorX = result.sectorX ?? sectorX;
      if (result.payload && typeof result.payload === "object") {
        result.payload = {
          ...result.payload,
          nebulaId: result.payload.nebulaId || nebulaId,
          sectorX: result.payload.sectorX ?? sectorX,
        };
      }
      if (Array.isArray(result.events)) {
        result.events = result.events.map((event) => (
          event?.type === "signalMarked"
            ? { ...event, nebulaId: event.nebulaId || nebulaId, sectorX: event.sectorX ?? sectorX }
            : event
        ));
      }
      return result;
    }

    function getEffectTargetPlayer(workingRoot, effect) {
      return resolvePlayerReference(workingRoot, {
        playerId: effect?.options?.targetPlayerId || effect?.playerId || effect?.options?.playerId,
        playerColor: effect?.options?.targetPlayerColor || effect?.playerColor || effect?.options?.playerColor,
      }) || getCurrentPlayer(workingRoot);
    }

    function executeGainResourcesRewardEffect(workingRoot, effect) {
      const currentPlayer = getEffectTargetPlayer(workingRoot, effect);
      const gain = effect.options?.gain || {};
      const beforePlayer = structuredClone(currentPlayer);
      beginEffectHistoryStep(effect.label);
      players.gainResources(currentPlayer, gain);
      recordScoreSourceForGainEffect(currentPlayer, effect, gain);
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复奖励前玩家状态",
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${currentPlayer?.colorLabel || currentPlayer?.name || "玩家"} ${formatPlanetRewardGain(workingRoot, gain)}`,
        payload: { gain },
      });
    }

    function finishGainDataRewardEffect(workingRoot, effect, currentPlayer, count, source, options = {}) {
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(effect.label);
      const results = [];
      if (!options.skipGain) {
        for (let index = 0; index < count; index += 1) {
          const gainResult = data.gainData(currentPlayer, { source });
          results.push(gainResult);
          if (!options.restoreRecorded) {
            recordHistoryCommand(historyCommands.createGainDataCommand(currentPlayer, gainResult));
          }
        }
      }
      const gained = results.filter((item) => item.ok).length;
      const discarded = results.filter((item) => item.discarded).length;
      const placementText = options.placementMessages?.length
        ? `；${options.placementMessages.join("；")}`
        : "";
      const message = options.skipGain
        ? `${effect.label}：数据池已满，已跳过本次数据获得`
        : `${effect.label}：${currentPlayer?.colorLabel || currentPlayer?.name || "玩家"}获得 ${gained}/${count} 个数据${discarded ? `，弃置 ${discarded} 个溢出数据` : ""}${placementText}`;
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        skipped: Boolean(options.skipGain),
        message,
        payload: { results, placementMessages: options.placementMessages || [] },
      });
    }

    function executeGainDataRewardEffect(workingRoot, effect) {
      const currentPlayer = getEffectTargetPlayer(workingRoot, effect);
      const count = Math.max(0, Math.round(effect.options?.count || 0));
      const source = effect.options?.source || "planet_reward";
      if (count > 0 && isDataPoolFull(currentPlayer)) {
        const placeCheck = getAutoDataPlacementCheck(currentPlayer);
        if (placeCheck.ok) {
          return openAutoDataPlacementPrompt(effect, currentPlayer, {
            resumeKind: "gain-data-reward",
          });
        }
        beginEffectHistoryStep(effect.label);
        effect.result = {
          ok: true,
          undoable: true,
          skipped: true,
          message: `${effect.label}：${placeCheck.message || "数据池已满且无法放置，未获得数据"}`,
        };
        ruleRocketState(workingRoot).statusNote = effect.result.message;
        completeCurrentActionEffect("skipped");
        renderStateReadout();
        return effect.result;
      }
      beginEffectHistoryStep(effect.label);
      return finishGainDataRewardEffect(workingRoot, effect, currentPlayer, count, source);
    }

    function executeLaunchRewardEffect(workingRoot, effect) {
      const options = effect.options || {};
      beginEffectHistoryStep(effect.label);
      const result = abilities.executeAbility("launchProbe", createActionContext(workingRoot), {
        skipCost: Boolean(options.skipCost),
        cost: options.cost,
        source: options.source || "reward",
        ignoreRocketLimit: Boolean(options.ignoreRocketLimit),
        historyLabel: effect.label,
      });
      if (!result.ok) {
        endEffectHistoryStep();
        if (/火箭数量已达上限|资源不足/.test(String(result.message || ""))) {
          return skipActionEffectWithMessage(
            effect,
            `${effect.label || "发射奖励"}：${result.message}，已跳过`,
            { reason: result.message || null, abilityId: result.abilityId || "launchProbe" },
          );
        }
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
        return result;
      }
      maybeApplyIndustryLaunchScan(result);
      recordAbilityCommands(result, undefined, workingRoot);
      if (result.rocket) renderRocketElement(result.rocket);
      const finished = finishAutomaticRewardEffect(workingRoot, effect, {
        ...result,
        undoable: true,
        message: `${effect.label}：${result.message}`,
      }, [renderRockets]);
      return finished;
    }

    function executeHuanyuSuperdrivePassLaunchEffect(workingRoot, effect) {
      const options = effect.options || {};
      beginEffectHistoryStep(effect.label);
      const result = abilities.executeAbility("launchProbe", createActionContext(workingRoot), {
        skipCost: options.skipCost !== false,
        ignoreRocketLimit: options.ignoreRocketLimit !== false,
        source: "industry_huanyu_superdrive",
        historyLabel: effect.label,
      });
      if (!result.ok) {
        endEffectHistoryStep();
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
        return result;
      }
      recordAbilityCommands(result, undefined, workingRoot);
      if (result.rocket) renderRocketElement(result.rocket);
      effect.result = {
        ...result,
        undoable: true,
        message: `${effect.label}：${result.message}`,
      };
      ruleRocketState(workingRoot).statusNote = effect.result.message;
      completeCurrentActionEffect();
      renderRockets();
      renderPlayerStats();
      renderStateReadout();
      return effect.result;
    }

    function executeDrawCardsRewardEffect(workingRoot, effect) {
      const currentPlayer = getEffectTargetPlayer(workingRoot, effect);
      const count = Math.max(0, Math.round(effect.options?.count || 0));
      const available = cards.getAvailablePool(ruleCardState(workingRoot), rulePlayerState(workingRoot)).length;
      if (available <= 0) {
        ruleRocketState(workingRoot).statusNote = "牌库已无可用卡牌";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }

      const drawResult = cards.drawCardsToHand(ruleCardState(workingRoot), rulePlayerState(workingRoot), currentPlayer, count);
      markCurrentActionIrreversible("盲抽翻出新牌", "hidden_card_reveal");
      const drawnCount = drawResult.cards?.length || 0;
      const message = drawResult.ok
        ? `${effect.label}：已抽 ${drawnCount} 张`
        : `${effect.label}：已抽 ${drawnCount}/${count} 张，${drawResult.message}`;
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: false,
        irreversible: { code: "hidden_card_reveal", reason: "盲抽翻出新牌" },
        message,
        payload: { cards: drawResult.cards || [] },
      });
    }

    function executeRegisterEventBonusEffect(workingRoot, effect) {
      const owner = getEffectOwnerPlayer(workingRoot, effect);
      const beforeTurnBonuses = structuredClone(ruleTurnState(workingRoot).cardTurnEventBonuses || []);
      const flowBonuses = ensureCardFlowEventBonuses();
      const beforeFlowBonuses = structuredClone(flowBonuses);
      beginEffectHistoryStep(effect.label);
      const bonus = {
        ...(effect.options?.bonus || {}),
        id: effect.id,
        label: effect.label,
        playerId: owner?.id || null,
        usedKeys: [],
      };
      if (bonus.duration === "turn") {
        if (!Array.isArray(ruleTurnState(workingRoot).cardTurnEventBonuses)) ruleTurnState(workingRoot).cardTurnEventBonuses = [];
        ruleTurnState(workingRoot).cardTurnEventBonuses.push(bonus);
      } else {
        flowBonuses.push(bonus);
      }
      recordHistoryCommand({
        label: "恢复卡牌事件触发登记",
        describe: "移除已登记的卡牌事件触发",
        undo() {
          ruleTurnState(workingRoot).cardTurnEventBonuses = structuredClone(beforeTurnBonuses);
          if (decisionState.actionEffectFlow) {
            decisionState.actionEffectFlow.cardFlowEventBonuses = structuredClone(beforeFlowBonuses);
          }
        },
      });
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：已登记`,
        payload: { bonus },
      });
    }

    function executeCountHandIncomeResourceEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const incomeCode = Number(effect.options?.incomeCode);
      const resource = effect.options?.resource || "energy";
      const per = Math.max(0, Number(effect.options?.per) || 1);
      const count = (currentPlayer?.hand || [])
        .filter((card) => Number(cards.getIncomeCodeForCard(card)) === incomeCode)
        .length;
      const gain = { [resource]: Math.round(count * per) };
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      if (gain[resource] > 0) {
        players.gainResources(currentPlayer, gain);
        recordScoreSourceForGainEffect(currentPlayer, effect, gain);
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复手牌收入统计奖励前玩家状态",
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${count} 张，${formatPlanetRewardGain(workingRoot, gain) || "无奖励"}`,
        payload: { count, gain },
      }, [renderPlayerHand]);
    }

    function getPlayerCompanyBaseIncome(workingRoot, player) {
      const industryEffect = initialCards?.getIndustryEffect?.(player?.initialSelection?.industry);
      return players.normalizeIncome(industryEffect?.baseIncome || null);
    }

    function executeCountCurrentIncomeResourceEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const incomeKey = effect.options?.incomeKey || "credits";
      const resource = effect.options?.resource || "score";
      const per = Math.max(0, Number(effect.options?.per) || 1);
      const currentIncomeCount = Math.max(0, Math.round(Number(currentPlayer?.income?.[incomeKey]) || 0));
      const companyBaseIncome = getPlayerCompanyBaseIncome(workingRoot, currentPlayer);
      const baseIncomeCount = Math.max(0, Math.round(Number(companyBaseIncome?.[incomeKey]) || 0));
      const count = Math.max(0, currentIncomeCount - baseIncomeCount);
      const gain = { [resource]: Math.round(count * per) };
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      if (gain[resource] > 0) {
        players.gainResources(currentPlayer, gain);
        recordScoreSourceForGainEffect(currentPlayer, effect, gain);
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复收入统计奖励前玩家状态",
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：高于公司默认 ${count} 个，${formatPlanetRewardGain(workingRoot, gain) || "无奖励"}`,
        payload: { count, currentIncomeCount, baseIncomeCount, gain },
      });
    }

    function executeCountAliensResourceEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const alienCount = Object.keys(ruleAlienGameState(workingRoot)?.aliens || {}).length;
      const gainPerAlien = effect.options?.gainPerAlien || {};
      const gain = {};
      for (const [resource, amount] of Object.entries(gainPerAlien)) {
        gain[resource] = Math.max(0, Math.round(Number(amount) || 0)) * alienCount;
      }
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      if (Object.values(gain).some((value) => value > 0)) {
        players.gainResources(currentPlayer, gain);
        recordScoreSourceForGainEffect(currentPlayer, effect, gain);
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复外星人数量奖励前玩家状态",
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${alienCount} 个外星人，${formatPlanetRewardGain(workingRoot, gain) || "无奖励"}`,
        payload: { alienCount, gain },
      });
    }

    function executeTuckPlayedCardToIncomeEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const playedCard = decisionState.actionEffectFlow?.card;
      if (!currentPlayer || !playedCard) {
        ruleRocketState(workingRoot).statusNote = "没有可放入收入区的当前卡牌";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      const gain = cards.getIncomeGainForCard(playedCard);
      if (!gain) {
        ruleRocketState(workingRoot).statusNote = `${cards.getCardLabel(playedCard)} 没有可识别收入`;
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      const discardIndex = (ruleCardState(workingRoot).discardPile || []).findIndex((card) => card.id === playedCard.id);
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = structuredClone(ruleCardState(workingRoot));
      if (discardIndex >= 0) ruleCardState(workingRoot).discardPile.splice(discardIndex, 1);
      const incomeResult = applyIncomeGainWithImmediateRewards(currentPlayer, gain, "card_income");
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复本卡放入收入区前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        ruleCardState(workingRoot),
        beforeCardState,
        "恢复本卡放入收入区前牌区",
      ));
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: incomeResult.undoable,
        irreversible: incomeResult.irreversible,
        message: `${effect.label}：${formatIncomeGain(gain)}`,
        payload: { gain, card: playedCard, drawnCards: incomeResult.drawnCards },
      }, [renderPlayerHand, renderPublicCards]);
    }

    function executePickCardCornerRewardEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const result = beginCardSelection({
        type: "card_pick_corner_reward",
        player: currentPlayer,
        effectLabel: effect.label,
        allowBlindDraw: Boolean(effect.options?.allowBlindDraw),
        fromEffectFlow: true,
        beforePlayerState: structuredClone(currentPlayer),
        beforeCardState: {
          publicCards: ruleCardState(workingRoot).publicCards.slice(),
          discardPile: (ruleCardState(workingRoot).discardPile || []).slice(),
        },
      });
      if (!result.ok) {
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
      }
      return result;
    }

    function executeDiscardPublicCornerRewardsEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      if (!currentPlayer) return { ok: false, message: "没有当前玩家" };
      const count = Math.max(1, Math.round(Number(effect.options?.count || 1)));
      const filledSlots = ruleCardState(workingRoot).publicCards
        .map((card, index) => card ? index : null)
        .filter((index) => index != null);
      if (filledSlots.length < count) {
        ruleRocketState(workingRoot).statusNote = `${effect.label}：公共牌不足 ${count} 张`;
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      const result = beginCardSelection({
        type: "card_public_corner_discard",
        player: currentPlayer,
        effect,
        effectLabel: effect.label,
        count,
        maxSelectable: count,
        minSelectable: count,
        selectedSlots: [],
        allowBlindDraw: false,
        fromEffectFlow: true,
        beforePlayerState: structuredClone(currentPlayer),
        beforeCardState: {
          publicCards: ruleCardState(workingRoot).publicCards.slice(),
          discardPile: (ruleCardState(workingRoot).discardPile || []).slice(),
        },
      });
      if (!result.ok) {
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
      }
      return result;
    }

    function normalizeInsertedActionEffect(workingRoot, effect, ownerId, fallbackId) {
      return {
        ...assignEffectOwner({ ...effect }, ownerId),
        id: effect.id || fallbackId,
        options: { ...(effect.options || {}) },
        preHistoryCommands: Array.isArray(effect.preHistoryCommands) ? [...effect.preHistoryCommands] : [],
        preHistoryCommandsApplied: false,
        status: "pending",
      };
    }

    function insertActionEffectsAfterCurrent(workingRoot, effects) {
      if (!decisionState.actionEffectFlow || !effects?.length) return;
      const insertedEffects = effects.filter(Boolean);
      const insertIndex = Math.max(0, decisionState.actionEffectFlow.currentIndex + 1);
      const insertionSource = abilities.chain.createInsertionSource?.(decisionState.actionEffectFlow) || null;
      const currentOwner = getCurrentActionEffect()
        ? getEffectOwnerPlayer(workingRoot, getCurrentActionEffect())
        : null;
      const ownerId = currentOwner?.id
        || decisionState.actionEffectFlow.activePlayerId
        || decisionState.actionEffectFlow.defaultPlayerId
        || decisionState.actionEffectFlow.playerId
        || null;
      decisionState.actionEffectFlow.effects.splice(insertIndex, 0, ...insertedEffects.map((effect, index) => {
        const normalized = normalizeInsertedActionEffect(workingRoot, effect, ownerId, `inserted-card-effect-${insertIndex}-${index}`);
        return abilities.chain.markInsertedNode?.(normalized, insertionSource) || normalized;
      }));
      decisionState.actionEffectFlow.completed = false;
    }

    function insertActionEffectsBeforeCurrent(workingRoot, effects) {
      if (!decisionState.actionEffectFlow || !effects?.length) return false;
      const insertedEffects = effects.filter(Boolean);
      if (!insertedEffects.length) return false;
      const flow = decisionState.actionEffectFlow;
      const current = getCurrentActionEffect();
      const insertIndex = flow.completed
        ? Math.min(flow.effects.length, Math.max(0, flow.currentIndex + 1))
        : Math.max(0, flow.currentIndex);
      if (current?.status === "active") {
        current.status = "pending";
      }
      const ownerId = getEffectOwnerPlayer(workingRoot, current)?.id
        || flow.activePlayerId
        || flow.defaultPlayerId
        || flow.playerId
        || getCurrentPlayer(workingRoot)?.id
        || null;
      flow.effects.splice(insertIndex, 0, ...insertedEffects.map((effect, index) => (
        normalizeInsertedActionEffect(workingRoot, effect, ownerId, `inserted-card-trigger-effect-${insertIndex}-${index}`)
      )));
      flow.currentIndex = insertIndex;
      flow.completed = false;
      activateNextActionEffect();
      return true;
    }

    function executeConditionalRewardEffect(workingRoot, effect) {
      const met = isRuntimeCardConditionMet(workingRoot, effect.options?.condition);
      if (met) {
        insertActionEffectsAfterCurrent(workingRoot, effect.options?.rewards || []);
      }
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: met ? `${effect.label}：条件满足，已追加奖励` : `${effect.label}：条件未满足`,
        payload: { conditionMet: met },
      });
    }

    function startHandScanFromCardEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const optional = Boolean(effect.options?.optional);
      if (!currentPlayer?.hand?.length) {
        effect.result = { ok: true, skipped: true, message: `${effect.label}：没有手牌，跳过` };
        ruleRocketState(workingRoot).statusNote = effect.result.message;
        completeCurrentActionEffect("skipped");
        renderStateReadout();
        return effect.result;
      }
      workingRoot.match.handScanContinuation = {
        type: "hand_scan",
        playerId: currentPlayer.id,
        playerColor: currentPlayer.color || null,
        fromEffectFlow: true,
        optional,
      };
      ruleRocketState(workingRoot).statusNote = optional
        ? `${effect.label}：请选择一张手牌弃除并扫描，或点击跳过`
        : `${effect.label}：请选择一张手牌弃除并扫描`;
      syncHandScanSelectionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function openOptionalHandScanPrompt(workingRoot, effect) {
      if (!els.scanTargetOverlay || !els.scanTargetActions) {
        return startHandScanFromCardEffect(workingRoot, { ...effect, options: { ...(effect.options || {}), optional: true } });
      }
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = effect.label || "可选手牌扫描";
      if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "可以执行一次手牌扫描，也可以跳过本次。";
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      const start = document.createElement("button");
      start.type = "button";
      start.className = "scan-target-option-button";
      start.dataset.optionalHandScan = "start";
      start.innerHTML = "选择手牌<small>弃除一张手牌并扫描其右上角目标</small>";
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "scan-target-option-button";
      skip.dataset.optionalHandScan = "skip";
      skip.innerHTML = "跳过<small>不执行这次弃牌扫描</small>";
      els.scanTargetActions.replaceChildren(start, skip);
      setScanTargetContinuation(workingRoot, { ...getPendingOwnerFields(workingRoot, effect), type: "optional_hand_scan", effect });
      els.scanTargetOverlay.hidden = false;
      ruleRocketState(workingRoot).statusNote = `${effect.label}：选择手牌或跳过`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function handleOptionalHandScanChoice(workingRoot, choice) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "optional_hand_scan") return { ok: false, message: "没有待处理的可选手牌扫描" };
      const effect = pending.effect;
      closeScanTargetPicker(workingRoot);
      return withPendingOwnerPlayer(pending, () => {
      if (choice === "skip") {
        effect.result = { ok: true, skipped: true, message: `${effect.label}：已跳过` };
        ruleRocketState(workingRoot).statusNote = effect.result.message;
        completeCurrentActionEffect("skipped");
        renderStateReadout();
        return effect.result;
      }
      return startHandScanFromCardEffect(workingRoot, { ...effect, options: { ...(effect.options || {}), optional: true } });
      });
    }

    function executeOptionalDiscardScanEffect(workingRoot, effect) {
      const count = Math.max(1, Math.round(Number(effect.options?.count || 1)));
      const followups = [];
      for (let index = 0; index < count; index += 1) {
        followups.push({
          id: `${effect.id || "optional-discard-scan"}-${index + 1}`,
          type: cardEffects.EFFECT_TYPES.HAND_SCAN,
          label: `${effect.label || "可选弃牌扫描"} ${index + 1}/${count}`,
          icon: "scan",
          options: { optional: true },
        });
      }
      insertActionEffectsAfterCurrent(workingRoot, followups);
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：已追加 ${count} 次可选手牌扫描`,
        payload: { count },
      });
    }

    function executeHandScanEffect(workingRoot, effect) {
      if (effect.options?.optional) return openOptionalHandScanPrompt(workingRoot, effect);
      return startHandScanFromCardEffect(workingRoot, effect);
    }

    function executeCountHandCornerMoveEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const count = (currentPlayer?.hand || [])
        .filter((card) => cards.getDiscardActionMoveRewardForCard?.(card))
        .length;
      if (count > 0) {
        insertActionEffectsAfterCurrent(workingRoot, [{
          id: `${effect.id || "hand-corner"}-move`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: `手牌移动角标：${count}移动`,
          icon: "movement",
          options: { movementPoints: count, historyLabel: effect.label },
        }]);
      }
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${count} 张`,
        payload: { count },
      }, [renderPlayerHand]);
    }

    function getEarthSectorMoveContentKinds(workingRoot, effect) {
      const kinds = effect?.options?.contentKinds;
      if (Array.isArray(kinds) && kinds.length) return new Set(kinds);
      return new Set([solar.layout.CONTENT_KIND.PLANET, solar.layout.CONTENT_KIND.COMET]);
    }

    function isEarthSectorMoveContent(workingRoot, content, contentKinds) {
      if (!content?.kind || !contentKinds?.has(content.kind)) return false;
      return content.kind !== solar.layout.CONTENT_KIND.PLANET || content.planetId !== "earth";
    }

    function countEarthSectorMoveContents(workingRoot, effect) {
      const earth = getEarthSectorCoordinate();
      if (earth?.x == null) return 0;
      const contentKinds = getEarthSectorMoveContentKinds(workingRoot, effect);
      let count = 0;
      for (let y = rocketActions.SECTOR_RING_MIN; y <= rocketActions.SECTOR_RING_MAX; y += 1) {
        const content = getSectorContentForMove({ x: earth.x, y });
        if (isEarthSectorMoveContent(workingRoot, content, contentKinds)) count += 1;
      }
      return count;
    }

    function executeEarthSectorContentMoveEffect(workingRoot, effect) {
      const count = countEarthSectorMoveContents(workingRoot, effect);
      if (count > 0) {
        insertActionEffectsAfterCurrent(workingRoot, [{
          id: `${effect.id || "earth-sector"}-move`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: `地球扇区行星/彗星：${count}移动`,
          icon: "movement",
          options: { movementPoints: count, historyLabel: effect.label },
        }]);
      }
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${count}移动`,
        payload: { count },
      });
    }

    function computeProbeLocationReward(workingRoot, effect, rocket) {
      const sector = rocketActions.getRocketSectorCoordinate(rocket);
      if (!sector) return { dataCount: 0, asteroid: false, adjacentAsteroids: 0 };
      const content = getSectorContentForMove(sector);
      const asteroid = isAsteroidContent(content);
      const adjacentAsteroids = [-1, 1].reduce((total, dx) => {
        const adjacent = { x: solar.mod8(sector.x + dx), y: sector.y };
        return total + (isAsteroidContent(getSectorContentForMove(adjacent)) ? 1 : 0);
      }, 0);
      const dataCount = (asteroid ? Math.max(0, Number(effect.options?.asteroidData) || 0) : 0)
        + adjacentAsteroids * Math.max(0, Number(effect.options?.adjacentAsteroidData) || 0);
      return { dataCount, asteroid, adjacentAsteroids };
    }

    function finishProbeLocationReward(workingRoot, effect, rocket) {
      const currentPlayer = getExplicitEffectOwnerPlayer(workingRoot, effect) || getCurrentPlayer(workingRoot);
      const reward = computeProbeLocationReward(workingRoot, effect, rocket);
      beginEffectHistoryStep(effect.label);
      const results = [];
      for (let index = 0; index < reward.dataCount; index += 1) {
        const gainResult = data.gainData(currentPlayer, { source: "probeLocationReward" });
        results.push(gainResult);
        recordHistoryCommand(historyCommands.createGainDataCommand(currentPlayer, gainResult));
      }
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：获得 ${results.filter((item) => item.ok).length}/${reward.dataCount} 数据`,
        payload: { rocketId: rocket?.id, reward, results },
      });
    }

    function openProbeLocationRewardPicker(workingRoot, effect, choices) {
      return effectChoiceFlowHelpers.openProbeLocationRewardPicker(workingRoot, effect, choices);
    }

    function executeProbeLocationRewardEffect(workingRoot, effect) {
      return effectChoiceFlowHelpers.executeProbeLocationRewardEffect(workingRoot, effect);
    }

    function handleProbeLocationRewardChoice(workingRoot, rocketId) {
      return effectChoiceFlowHelpers.handleProbeLocationRewardChoice(workingRoot, rocketId);
    }

    function executePlutoReserveEffect(workingRoot, effect) {
      const card = decisionState.actionEffectFlow?.card;
      if (card) {
        ensurePlutoCardEffectState(card).pluto = {
          ...(card.cardEffectState?.pluto || {}),
          orbitDone: Boolean(card.cardEffectState?.pluto?.orbitDone),
          landDone: Boolean(card.cardEffectState?.pluto?.landDone),
        };
      }
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：已保留`,
        payload: { cardId: card?.id || null },
      }, [renderReservedCards]);
    }

    function executeCardFixedNebulaScanEffect(workingRoot, effect) {
      const repeat = Math.max(1, Math.round(Number(effect.options?.repeat || 1)));
      if (repeat > 1 && !effect.options?._repeatExpanded) {
        const followups = [];
        for (let index = 1; index < repeat; index += 1) {
          followups.push({
            ...effect,
            id: `${effect.id || "fixed-nebula-scan"}-${index + 1}`,
            label: `${effect.label} ${index + 1}/${repeat}`,
            status: "pending",
            options: { ...(effect.options || {}), repeat: 1, _repeatExpanded: true },
          });
        }
        insertActionEffectsAfterCurrent(workingRoot, followups);
        effect.label = `${effect.label} 1/${repeat}`;
        effect.options = { ...(effect.options || {}), repeat: 1, _repeatExpanded: true };
      }
      if (!nebulaHasScannableData(effect.options?.nebulaId)) {
        const nebulaLabel = data.getNebulaLabel?.(effect.options?.nebulaId) || "目标星云";
        return finishAutomaticRewardEffect(workingRoot, effect, {
          ok: true,
          undoable: true,
          skipped: true,
          message: `${effect.label}：${nebulaLabel}没有可扫描数据，已跳过`,
          payload: { nebulaId: effect.options?.nebulaId || null, skipped: true },
        });
      }
      const result = replaceNebulaDataForCurrentPlayer(effect.options?.nebulaId, {
        prefix: effect.label,
        source: "card",
        gainData: effect.options?.gainData,
      });
      if (result.ok) {
        effect.result = result;
        completeCurrentActionEffect();
      }
      return result;
    }

    function executePlanetSectorScanEffect(workingRoot, effect) {
      const repeat = Math.max(1, Math.round(Number(effect.options?.repeat || 1)));
      if (repeat > 1 && !effect.options?._repeatExpanded) {
        const followups = [];
        for (let index = 1; index < repeat; index += 1) {
          followups.push({
            ...effect,
            id: `${effect.id || "planet-sector-scan"}-${index + 1}`,
            label: `${effect.label} ${index + 1}/${repeat}`,
            status: "pending",
            options: { ...(effect.options || {}), repeat: 1, _repeatExpanded: true },
          });
        }
        insertActionEffectsAfterCurrent(workingRoot, followups);
        effect.label = `${effect.label} 1/${repeat}`;
        effect.options = { ...(effect.options || {}), repeat: 1, _repeatExpanded: true };
      }
      return executeSectorScanAtPlanet(workingRoot, effect.options?.planetId, effect.label, effect);
    }

    function openCardColorScanEffect(workingRoot, effect) {
      const color = effect.options?.color;
      const nebulaIds = cardEffects.NEBULA_IDS_BY_COLOR[color] || [];
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择 1 个星云`;
      renderStateReadout();
      return openScanTargetPicker(workingRoot, {
        type: "sector_scan",
        fromEffectFlow: true,
        title: effect.label,
        subtitle: "按槽位顺序替换未替换的数据；无可替换数据时追加扫描计数且不获得数据。",
        gainData: effect.options?.gainData,
        choices: expandScanChoicesWithAomomoTargets(nebulaIds.map((nebulaId) => buildNebulaScanChoice(nebulaId))),
      });
    }

    function openCardAnySectorScanEffect(workingRoot, effect) {
      const choices = buildSectorScanChoicesForXs(Array.from({ length: 8 }, (_, x) => x));
      const repeat = Math.max(1, Math.round(Number(effect.options?.repeat) || 1));
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择 0-7 号扇区之一`;
      renderStateReadout();
      return openScanTargetPicker(workingRoot, {
        type: "sector_scan",
        fromEffectFlow: true,
        effect,
        title: effect.label,
        subtitle: repeat > 1
          ? `选定一个扇区后，在同一目标连续扫描 ${repeat} 次；无可替换数据时追加扫描计数且不获得数据。`
          : "选择任意外圈扇区中的一个星云；无可替换数据时追加扫描计数且不获得数据。",
        gainData: effect.options?.gainData,
        repeat,
        choices,
      });
    }

    function openCardPublicScanEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const repeat = Math.max(1, Math.round(Number(effect.options?.repeat || 1)));
      const filledSlots = ruleCardState(workingRoot).publicCards.filter((card) => (
        card && (getPublicScanChoicesForCard(card)?.choices || []).length > 0
      )).length;
      if (filledSlots === 0) {
        return skipActionEffectWithMessage(
          effect,
          `${effect.label}：公共牌区为空，已跳过`,
          { reason: "no_public_scan_candidate" },
        );
      }
      const selectableCount = Math.min(repeat, Math.max(1, filledSlots));
      const scanRunId = effect.options?.scanRunId || createScanRunId(effect.id || "card-public-scan");
      effect.options = {
        ...(effect.options || {}),
        scanRunId,
        deferPublicRefill: true,
      };
      ruleRocketState(workingRoot).statusNote = selectableCount > 1
        ? `${effect.label}：请选择 ${selectableCount} 张当前公共牌`
        : `${effect.label}：请选择一张亮明的公共牌`;
      renderStateReadout();
      return beginCardSelection({
        ...createPublicScanPendingAction(currentPlayer, true, {
          maxSelectable: selectableCount,
          minSelectable: selectableCount,
          freeAdditionalPublicScans: repeat > 1,
          scanRunId,
          deferPublicRefill: true,
        }),
        maxSelectable: selectableCount,
        minSelectable: selectableCount,
        selectedSlots: [],
      });
    }

    function expandCardScanActionEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const scanRunId = createScanRunId(effect.id || "card-scan-action");
      const followups = scanEffects.buildScanEffectQueue(currentPlayer, {
        includeFinalize: true,
        fullScanAction: true,
        scanRunId,
        turnState: ruleTurnState(workingRoot),
        roundNumber: ruleTurnState(workingRoot).roundNumber,
        turnNumber: ruleTurnState(workingRoot).turnNumber,
      })
        .map((item, index) => ({
          ...item,
          id: `${effect.id || "card-scan-action"}-${index}`,
          status: "pending",
        }));
      insertActionEffectsAfterCurrent(workingRoot, followups);
      effect.result = {
        ok: true,
        undoable: true,
        message: "扫描行动已展开",
        payload: { inserted: followups.length, scanRunId },
        events: [{ type: "scanAction", source: "card", scanRunId }],
      };
      ruleRocketState(workingRoot).statusNote = "扫描行动已展开，请继续处理后续扫描效果";
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function executeCardResearchTechEffect(workingRoot, effect) {
      if (effect.options?.requireCondition && !isRuntimeCardConditionMet(workingRoot, effect.options.requireCondition)) {
        return finishAutomaticRewardEffect(workingRoot, effect, {
          ok: true,
          skipped: true,
          message: `${effect.label}：条件未满足，已跳过`,
        });
      }
      const result = abilities.executeAbility("researchTechPrepare", createActionContext(workingRoot), {
        techTypes: effect.options?.techTypes || effect.options?.techType,
        skipCost: Boolean(effect.options?.skipCost),
        source: "card",
      });
      if (!result.ok) {
        if (result.reason === "no_takeable_tech") {
          return finishAutomaticRewardEffect(workingRoot, effect, {
            ok: true,
            skipped: true,
            message: `${effect.label}：${result.message}，已跳过`,
            payload: { reason: result.reason },
          });
        }
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
        return result;
      }
      ruleRocketState(workingRoot).statusNote = result.message || "请选择要研究的科技片";
      syncTechSelectionChrome();
      renderTechBoard();
      updateActionButtons();
      renderStateReadout();
      return result;
    }

    function openCardDrawThenScanEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const drawResult = cards.blindDraw(ruleCardState(workingRoot), rulePlayerState(workingRoot), currentPlayer);
      if (!drawResult.ok) {
        ruleRocketState(workingRoot).statusNote = drawResult.message;
        renderStateReadout();
        return drawResult;
      }

      markCurrentActionIrreversible("盲抽翻出新牌", "hidden_card_reveal");
      const drawnCard = drawResult.card;
      const handIndex = currentPlayer.hand.findIndex((item) => item.id === drawnCard.id);
      const scanChoices = getPublicScanChoicesForCard(drawnCard);
      if (!scanChoices.ok) {
        ruleRocketState(workingRoot).statusNote = scanChoices.message;
        renderPlayerStats();
        renderPlayerHand();
        renderStateReadout();
        return { ...scanChoices, drawnCard };
      }

      effect.icon = getPublicScanIconForScanCode(scanChoices.scanCode);
      renderActionEffectBar();
      ruleRocketState(workingRoot).statusNote = `${effect.label}：${cards.getCardLabel(drawnCard)}，请选择${scanChoices.scanLabel}目标`;
      renderPlayerStats();
      renderPlayerHand();
      renderStateReadout();
      return openScanTargetPicker(workingRoot, {
        type: "hand_scan",
        card: drawnCard,
        handIndex,
        player: currentPlayer,
        effect,
        scanCode: scanChoices.scanCode,
        fromEffectFlow: true,
        irreversibleDraw: true,
        discardDrawnOnSkip: Boolean(effect.options?.discardDrawnOnSkip),
        hideCancel: Boolean(effect.options?.discardDrawnOnSkip),
        title: effect.label,
        subtitle: effect.options?.discardDrawnOnSkip
          ? `${cards.getCardLabel(drawnCard)}：${scanChoices.scanLabel}，请选择 2 选 1 星云。确认或跳过都会弃除这张牌。`
          : `${cards.getCardLabel(drawnCard)}：${scanChoices.scanLabel}，请选择 2 选 1 星云。确认后弃除这张牌。`,
        choices: scanChoices.choices,
      });
    }

    function executeCardDrawThenDiscardActionEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      if (!currentPlayer) return { ok: false, message: "没有当前玩家" };

      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: ruleCardState(workingRoot).publicCards.slice(),
        discardPile: (ruleCardState(workingRoot).discardPile || []).slice(),
      };

      beginEffectHistoryStep(effect.label);
      const drawResult = cards.blindDraw(ruleCardState(workingRoot), rulePlayerState(workingRoot), currentPlayer);
      if (!drawResult.ok) {
        endEffectHistoryStep();
        ruleRocketState(workingRoot).statusNote = drawResult.message;
        renderStateReadout();
        return drawResult;
      }

      markCurrentActionIrreversible("盲抽翻出新牌", "hidden_card_reveal");
      const drawnCard = drawResult.card;
      const drawnIndex = currentPlayer.hand.findIndex((item) => item.id === drawnCard.id);
      const discardResult = cards.discardFromHandAtIndex(currentPlayer, drawnIndex);
      if (!discardResult.ok) {
        endEffectHistoryStep();
        ruleRocketState(workingRoot).statusNote = discardResult.message;
        renderPlayerHand();
        renderStateReadout();
        return discardResult;
      }
      cards.addToDiscardPile(ruleCardState(workingRoot), discardResult.card);

      const resourceReward = cards.getDiscardActionRewardForCard(discardResult.card);
      const moveReward = cards.getDiscardActionMoveRewardForCard?.(discardResult.card);
      const dataResults = [];

      if (resourceReward) {
        if (Object.keys(resourceReward.gain || {}).length) {
          players.gainResources(currentPlayer, resourceReward.gain);
          addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.CARD_EFFECT, resourceReward.gain);
        }
        const dataCount = Math.max(0, Math.round(resourceReward.dataCount || 0));
        for (let index = 0; index < dataCount; index += 1) {
          dataResults.push(data.gainData(currentPlayer, { source: "card_corner" }));
        }
      }

      if (moveReward?.gain && Object.keys(moveReward.gain).length) {
        players.gainResources(currentPlayer, moveReward.gain);
        addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.CARD_EFFECT, moveReward.gain);
      }

      if (moveReward) {
        insertActionEffectsAfterCurrent(workingRoot, [{
          id: `${effect.id || "card-corner"}-move-${discardResult.card.id}`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: `${cards.getCardLabel(discardResult.card)}：${moveReward.label}`,
          icon: "movement",
          options: {
            movementPoints: moveReward.movementPoints || 1,
            historyLabel: moveReward.label,
          },
        }]);
      }

      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复盲抽角标结算前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        ruleCardState(workingRoot),
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));

      const rewardText = resourceReward
        ? formatCardCornerRewardMessage(resourceReward, dataResults)
        : moveReward
          ? `${formatPlanetRewardGain(workingRoot, moveReward.gain || {})}${moveReward.gain?.score ? "，" : ""}${moveReward.label}`
          : "无可结算角标";
      return finishAutomaticRewardEffect(workingRoot, effect, {
        ok: true,
        undoable: false,
        irreversible: { code: "hidden_card_reveal", reason: "盲抽翻出新牌" },
        message: `${effect.label}：抽到并弃除 ${cards.getCardLabel(discardResult.card)}，${rewardText}`,
        payload: {
          card: discardResult.card,
          resourceReward,
          moveReward,
          dataResults,
        },
      }, [renderPlayerHand]);
    }

    return {
      signalOwnerMatches,
      countPlayerSignalsInNebula,
      countPlayerSignalsInSectorX,
      getSectorXsMatchingCondition,
      sectorXHasAvailableScanTarget,
      executeConditionalSectorScanEffect,
      handleConditionalSectorChoice,
      renderDiscardIncomePicker,
      executeDiscardAnyForIncomeEffect,
      handleDiscardIncomeCardChoice,
      confirmDiscardAnyForIncome,
      expandPayCreditsForRewardEffect,
      executePayCreditsForRewardEffect,
      handlePayCreditChoice,
      getFundamentalismExchangeChoiceSpecs,
      getFundamentalismExchangeChoice,
      executeIndustryFundamentalismExchangeEffect,
      formatFundamentalismExchangeCost,
      canAffordFundamentalismExchangeCost,
      spendFundamentalismExchangeCost,
      completeFundamentalismImmediateExchange,
      startFundamentalismPickExchange,
      startFundamentalismDiscardExchange,
      handleFundamentalismExchangeChoice,
      isAlienFamilyCard,
      executeDiscardCardCornerRepeatEffect,
      handleDiscardCornerRepeatChoice,
      buildOwnOrbitChoices,
      executeRemoveOrbitToProbeEffect,
      handleRemoveOrbitToProbeChoice,
      isChongTransportStartedForCard,
      isReservedTaskCardUnfinished,
      executeReturnUnfinishedTaskToHandEffect,
      handleReturnUnfinishedTaskChoice,
      countOwnedTechByType,
      executeCountTechTypesRewardEffect,
      executeCountOwnedTechRewardEffect,
      executeCountRocketsRewardEffect,
      executeDiscardAllHandEffect,
      executeProbeStackRewardEffect,
      enrichScanResultEvents,
      getEffectTargetPlayer,
      executeGainResourcesRewardEffect,
      finishGainDataRewardEffect,
      executeGainDataRewardEffect,
      executeLaunchRewardEffect,
      executeHuanyuSuperdrivePassLaunchEffect,
      executeDrawCardsRewardEffect,
      executeRegisterEventBonusEffect,
      executeCountHandIncomeResourceEffect,
      getPlayerCompanyBaseIncome,
      executeCountCurrentIncomeResourceEffect,
      executeCountAliensResourceEffect,
      executeTuckPlayedCardToIncomeEffect,
      executePickCardCornerRewardEffect,
      executeDiscardPublicCornerRewardsEffect,
      normalizeInsertedActionEffect,
      insertActionEffectsAfterCurrent,
      insertActionEffectsBeforeCurrent,
      executeConditionalRewardEffect,
      startHandScanFromCardEffect,
      openOptionalHandScanPrompt,
      handleOptionalHandScanChoice,
      executeOptionalDiscardScanEffect,
      executeHandScanEffect,
      executeCountHandCornerMoveEffect,
      getEarthSectorMoveContentKinds,
      isEarthSectorMoveContent,
      countEarthSectorMoveContents,
      executeEarthSectorContentMoveEffect,
      computeProbeLocationReward,
      finishProbeLocationReward,
      openProbeLocationRewardPicker,
      executeProbeLocationRewardEffect,
      handleProbeLocationRewardChoice,
      executePlutoReserveEffect,
      executeCardFixedNebulaScanEffect,
      executePlanetSectorScanEffect,
      openCardColorScanEffect,
      openCardAnySectorScanEffect,
      openCardPublicScanEffect,
      expandCardScanActionEffect,
      executeCardResearchTechEffect,
      openCardDrawThenScanEffect,
      executeCardDrawThenDiscardActionEffect,
    };
  }

  return { createEffectRewardExecutors };
});
