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
      alienGameState,
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
      cardState,
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
      nebulaDataState,
      nebulaHasScannableData,
      normalizeResourceCost,
      openAutoDataPlacementPrompt,
      openScanTargetPicker,
      planetReferenceLayout,
      planetStats,
      planetStatsState,
      playerState,
      players,
      recordAbilityCommands,
      recordHistoryCommand,
      recordScoreSourceForGainEffect,
      renderActionEffectBar,
      renderPlayerHand,
      renderPlayerStats,
      renderPublicCards,
      renderReservedCardsFromTaskState,
      renderRocketElement,
      renderRockets,
      renderStateReadout,
      renderTechBoard,
      replaceNebulaDataForCurrentPlayer,
      resolvePlayerReference,
      restoreObjectSnapshot,
      rocketActions,
      rocketState,
      runezu,
      scanEffects,
      solar,
      skipActionEffectWithMessage,
      syncHandScanSelectionChrome,
      syncTechSelectionChrome,
      turnState,
      uiRuntimeState,
      updateActionButtons,
      withPendingOwnerPlayer,
    } = context;
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

    function signalOwnerMatches(item, player) {
      const keys = getPlayerOwnerKeys(player);
      return keys.has(item?.replacedByPlayerId)
        || keys.has(item?.playerId)
        || keys.has(item?.replacedByPlayerColor)
        || keys.has(item?.playerColor);
    }

    function countPlayerSignalsInNebula(player, nebulaId) {
      let count = data.listNebulaTokens(nebulaDataState, nebulaId)
        .filter((token) => signalOwnerMatches(token, player))
        .length;
      if (typeof data.listSectorExtraMarks === "function") {
        count += data.listSectorExtraMarks(nebulaDataState, nebulaId)
          .filter((mark) => signalOwnerMatches(mark, player))
          .length;
      }
      return count;
    }

    function countPlayerSignalsInSectorX(player, sectorX) {
      return buildSectorScanChoicesForX(sectorX)
        .filter((choice) => choice.nebulaId)
        .reduce((total, choice) => total + countPlayerSignalsInNebula(player, choice.nebulaId), 0);
    }

    function getSectorXsMatchingCondition(condition, player = getCurrentPlayer()) {
      return cardEffects.getMatchingConditionalSectorXs(
        condition,
        Array.from({ length: 8 }, (_item, x) => x),
        (sectorX) => countPlayerSignalsInSectorX(player, sectorX),
      );
    }

    function sectorXHasAvailableScanTarget(sectorX) {
      return buildSectorScanChoicesForX(solar.mod8(Number(sectorX) || 0))
        .some((choice) => choice.nebulaId && !choice.disabled);
    }

    function executeConditionalSectorScanEffect(effect) {
      return effectChoiceFlowHelpers.executeConditionalSectorScanEffect(effect);
    }

    function handleConditionalSectorChoice(sectorXValue) {
      return effectChoiceFlowHelpers.handleConditionalSectorChoice(sectorXValue);
    }

    function renderDiscardIncomePicker() {
      const pending = decisionState.scanTargetAction;
      if (pending?.type !== "discard_any_income" || !els.scanTargetActions) return;
      const selected = new Set(pending.selectedCardIds || []);
      const currentPlayer = getPendingOwnerPlayer(pending, pending.effect);
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

    function executeDiscardAnyForIncomeEffect(effect) {
      return effectChoiceFlowHelpers.executeDiscardAnyForIncomeEffect(effect);
    }

    function handleDiscardIncomeCardChoice(cardId) {
      return effectChoiceFlowHelpers.handleDiscardIncomeCardChoice(cardId);
    }

    function confirmDiscardAnyForIncome() {
      return effectChoiceFlowHelpers.confirmDiscardAnyForIncome();
    }

    function expandPayCreditsForRewardEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const count = Math.max(0, Math.round(Number(currentPlayer?.resources?.credits) || 0));
      if (count <= 0) {
        return finishAutomaticRewardEffect(effect, {
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
      insertActionEffectsAfterCurrent(followups);
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：已追加 ${count} 个可选支付节点`,
        payload: { count },
      });
    }

    function executePayCreditsForRewardEffect(effect) {
      return effectChoiceFlowHelpers.executePayCreditsForRewardEffect(effect);
    }

    function handlePayCreditChoice(choice) {
      return effectChoiceFlowHelpers.handlePayCreditChoice(choice);
    }

    function getFundamentalismExchangeChoiceSpecs(player = getCurrentPlayer()) {
      const score = Number(player?.resources?.score) || 0;
      const credits = Number(player?.resources?.credits) || 0;
      const energy = Number(player?.resources?.energy) || 0;
      const handCount = Array.isArray(player?.hand) ? player.hand.length : 0;
      const publicCount = Array.isArray(cardState.publicCards) ? cardState.publicCards.length : 0;
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

    function getFundamentalismExchangeChoice(choiceId, player = getCurrentPlayer()) {
      return getFundamentalismExchangeChoiceSpecs(player).find((choice) => choice.id === choiceId) || null;
    }

    function executeIndustryFundamentalismExchangeEffect(effect) {
      return effectChoiceFlowHelpers.executeIndustryFundamentalismExchangeEffect(effect);
    }

    function formatFundamentalismExchangeCost(cost) {
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

    function canAffordFundamentalismExchangeCost(player, cost) {
      const normalizedCost = normalizeResourceCost(cost) || {};
      const scoreCost = Math.max(0, Math.round(Number(normalizedCost.score) || 0));
      if (scoreCost > 0 && (Number(player?.resources?.score) || 0) < scoreCost) return false;
      const resourceCost = { ...normalizedCost };
      delete resourceCost.score;
      return players.canAfford(player, resourceCost);
    }

    function spendFundamentalismExchangeCost(player, cost) {
      const normalizedCost = normalizeResourceCost(cost) || {};
      if (!Object.keys(normalizedCost).length) return { ok: true };
      if (!canAffordFundamentalismExchangeCost(player, normalizedCost)) {
        return { ok: false, message: `资源不足，需要 ${formatFundamentalismExchangeCost(normalizedCost)}` };
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

    function completeFundamentalismImmediateExchange(effect, player, choice) {
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(player);
      const spend = spendFundamentalismExchangeCost(player, choice.cost);
      if (!spend.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = spend.message;
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
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `原教旨主义：${choice.label}`,
        payload: { choiceId: choice.id, cost: choice.cost || null, gain: choice.gain || null },
      }, [renderPlayerHand]);
    }

    function startFundamentalismPickExchange(effect, player, choice) {
      const beforePlayer = structuredClone(player);
      const beforeCardState = structuredClone(cardState);
      const spend = spendFundamentalismExchangeCost(player, choice.cost);
      if (!spend.ok) {
        rocketState.statusNote = spend.message;
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
        restoreObjectSnapshot(cardState, beforeCardState);
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }
      rocketState.statusNote = `原教旨主义：${choice.label}，请选择公共牌`;
      renderPlayerStats();
      renderStateReadout();
      return result;
    }

    function startFundamentalismDiscardExchange(effect, player) {
      const result = beginDiscardSelection(1, {
        type: "industry_fundamentalism_score_discard",
        player,
        fromEffectFlow: true,
        effectLabel: effect.label,
        beforePlayerState: structuredClone(player),
        beforeCardState: structuredClone(cardState),
      });
      if (result.ok) {
        rocketState.statusNote = "原教旨主义：请选择 1 张手牌弃掉换 3 分";
        renderStateReadout();
      }
      return result;
    }

    function handleFundamentalismExchangeChoice(choiceId) {
      return effectChoiceFlowHelpers.handleFundamentalismExchangeChoice(choiceId);
    }

    function isAlienFamilyCard(card) {
      const setText = String(card?.set || "");
      const cardId = String(card?.cardId || "");
      return setText.startsWith("alien:") || /^(aomomo|yichangdian|chong|amiba|jiuzhe|banrenma|fangzhou|runezu)_/.test(cardId);
    }

    function executeDiscardCardCornerRepeatEffect(effect) {
      return effectChoiceFlowHelpers.executeDiscardCardCornerRepeatEffect(effect);
    }

    function handleDiscardCornerRepeatChoice(cardId) {
      return effectChoiceFlowHelpers.handleDiscardCornerRepeatChoice(cardId);
    }

    function buildOwnOrbitChoices() {
      const currentPlayer = getCurrentPlayer();
      const choices = [];
      const planetIds = planetReferenceLayout.PLANET_ORDER || planetStats.PLANET_IDS || [];
      for (const planetId of planetIds) {
        for (const marker of planetStats.getPlanetOrbitMarkers(planetStatsState, planetId)) {
          if (!markerBelongsToPlayer(marker, currentPlayer)) continue;
          choices.push({
            id: `${planetId}:${marker.sequence}`,
            planetId,
            sequence: marker.sequence,
            label: `${getPlanetName(planetId)} 环绕 ${marker.sequence}`,
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

    function executeRemoveOrbitToProbeEffect(effect) {
      return effectChoiceFlowHelpers.executeRemoveOrbitToProbeEffect(effect);
    }

    function handleRemoveOrbitToProbeChoice(choiceId) {
      return effectChoiceFlowHelpers.handleRemoveOrbitToProbeChoice(choiceId);
    }

    function isChongTransportStartedForCard(card) {
      return Boolean(card?.id && chong?.getActiveTransportForCard?.(alienGameState, card.id));
    }

    function isReservedTaskCardUnfinished(card, effect = null) {
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

    function executeReturnUnfinishedTaskToHandEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const choices = (currentPlayer?.reservedCards || []).filter((card) => isReservedTaskCardUnfinished(card, effect));
      if (!choices.length) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          undoable: true,
          message: `${effect.label}：没有未完成的 1/2 型任务卡，已跳过`,
          payload: { cardIds: [] },
        });
      }
      decisionState.scanTargetAction = { ...getPendingOwnerFields(effect), type: "return_unfinished_task", effect, choices };
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
      rocketState.statusNote = `${effect.label}：请选择任务卡`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: rocketState.statusNote };
    }

    function handleReturnUnfinishedTaskChoice(cardId) {
      const pending = decisionState.scanTargetAction;
      if (pending?.type !== "return_unfinished_task") return { ok: false, message: "没有待处理的任务卡回手" };
      const effect = pending.effect;
      closeScanTargetPicker();
      return withPendingOwnerPlayer(pending, () => {
      const currentPlayer = getCurrentPlayer();
      const index = (currentPlayer?.reservedCards || []).findIndex((card) => card.id === cardId);
      if (index < 0) return { ok: false, message: "无效任务卡" };
      if (!isReservedTaskCardUnfinished(currentPlayer.reservedCards[index], effect)) {
        rocketState.statusNote = "该牌不能作为未完成任务卡返回手牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
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
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${cards.getCardLabel(card)} 返回手牌`,
        payload: { cardId: card.id },
      }, [renderPlayerHand, renderReservedCardsFromTaskState]);
      });
    }

    function countOwnedTechByType(player, techType) {
      return Object.keys(player?.techState?.ownedTiles || {})
        .filter((tileId) => player.techState.ownedTiles[tileId]
          && (!techType || String(tileId).startsWith(techType)))
        .length;
    }

    function executeCountTechTypesRewardEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const count = Math.max(
        countOwnedTechByType(currentPlayer, "orange"),
        countOwnedTechByType(currentPlayer, "purple"),
        countOwnedTechByType(currentPlayer, "blue"),
      );
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };
      const drawResult = effect.options?.reward === "draw"
        ? cards.drawCardsToHand(cardState, playerState, currentPlayer, count)
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
        cardState,
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
      return finishAutomaticRewardEffect(effect, {
        ok: drawResult.ok,
        undoable: !irreversible,
        irreversible,
        message: `${effect.label}：最多科技类型 ${count}，盲抽 ${drawnCount}/${count} 张`,
        payload: { count },
      }, [renderPlayerHand]);
    }

    function executeCountOwnedTechRewardEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const count = countOwnedTechByType(currentPlayer, effect.options?.techType);
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
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: effect.options?.resource === "data"
          ? `${effect.label}：获得 ${dataResults.filter((item) => item.ok).length}/${total} 数据`
          : `${effect.label}：获得 ${total}`,
        payload: { count, total },
      });
    }

    function executeCountRocketsRewardEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const count = cardEffects.countRocketsForReward(
        rocketState.rockets,
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
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${count} 个探测器，获得 ${total}`,
        payload: { count, total },
      });
    }

    function executeDiscardAllHandEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };
      const discarded = [];
      while ((currentPlayer.hand || []).length) {
        const result = cards.discardFromHandAtIndex(currentPlayer, currentPlayer.hand.length - 1);
        if (result.ok) {
          cards.addToDiscardPile(cardState, result.card);
          discarded.push(result.card);
        } else {
          break;
        }
      }
      insertActionEffectsAfterCurrent(effect.options?.rewards || []);
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复弃掉全部手牌前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        cardState,
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：弃掉 ${discarded.length} 张手牌，已追加奖励`,
        payload: { discardedCount: discarded.length },
      }, [renderPlayerHand]);
    }

    function executeProbeStackRewardEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const match = cardEffects.getProbeStackRewardMatch(rocketState.rockets || [], currentPlayer, {
        getCoordinate: (rocket) => rocketActions.getRocketSectorCoordinate(rocket),
      });
      const met = Boolean(match.conditionMet);
      if (met) insertActionEffectsAfterCurrent(effect.options?.rewards || []);
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: met
          ? `${effect.label}：扇区[${match.coordinate.x},${match.coordinate.y}]有 ${match.totalCount} 个探测器，已追加奖励`
          : `${effect.label}：条件未满足`,
        payload: match,
      });
    }

    function enrichScanResultEvents(result, nebulaId, options = {}) {
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

    function getEffectTargetPlayer(effect) {
      return resolvePlayerReference({
        playerId: effect?.options?.targetPlayerId || effect?.playerId || effect?.options?.playerId,
        playerColor: effect?.options?.targetPlayerColor || effect?.playerColor || effect?.options?.playerColor,
      }) || getCurrentPlayer();
    }

    function executeGainResourcesRewardEffect(effect) {
      const currentPlayer = getEffectTargetPlayer(effect);
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
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${currentPlayer?.colorLabel || currentPlayer?.name || "玩家"} ${formatPlanetRewardGain(gain)}`,
        payload: { gain },
      });
    }

    function finishGainDataRewardEffect(effect, currentPlayer, count, source, options = {}) {
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
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        skipped: Boolean(options.skipGain),
        message,
        payload: { results, placementMessages: options.placementMessages || [] },
      });
    }

    function executeGainDataRewardEffect(effect) {
      const currentPlayer = getEffectTargetPlayer(effect);
      const count = Math.max(0, Math.round(effect.options?.count || 0));
      const source = effect.options?.source || "planet_reward";
      if (count > 0 && isDataPoolFull(currentPlayer)) {
        const placeCheck = getAutoDataPlacementCheck(currentPlayer);
        if (placeCheck.ok) {
          return openAutoDataPlacementPrompt(effect, currentPlayer, {
            onAfterPlacement: ({ messages, restoreRecorded }) => finishGainDataRewardEffect(
              effect,
              currentPlayer,
              count,
              source,
              { placementMessages: messages, restoreRecorded },
            ),
            onSkip: () => {
              beginEffectHistoryStep(effect.label);
              effect.result = {
                ok: true,
                undoable: true,
                skipped: true,
                message: `${effect.label}：数据池已满，已跳过本次数据获得`,
              };
              rocketState.statusNote = effect.result.message;
              completeCurrentActionEffect("skipped");
              renderStateReadout();
              return effect.result;
            },
          });
        }
        beginEffectHistoryStep(effect.label);
        effect.result = {
          ok: true,
          undoable: true,
          skipped: true,
          message: `${effect.label}：${placeCheck.message || "数据池已满且无法放置，未获得数据"}`,
        };
        rocketState.statusNote = effect.result.message;
        completeCurrentActionEffect("skipped");
        renderStateReadout();
        return effect.result;
      }
      beginEffectHistoryStep(effect.label);
      return finishGainDataRewardEffect(effect, currentPlayer, count, source);
    }

    function executeLaunchRewardEffect(effect) {
      const options = effect.options || {};
      beginEffectHistoryStep(effect.label);
      const result = abilities.executeAbility("launchProbe", createActionContext(), {
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
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }
      maybeApplyIndustryLaunchScan(result);
      recordAbilityCommands(result);
      if (result.rocket) renderRocketElement(result.rocket);
      const finished = finishAutomaticRewardEffect(effect, {
        ...result,
        undoable: true,
        message: `${effect.label}：${result.message}`,
      }, [renderRockets]);
      return finished;
    }

    function executeHuanyuSuperdrivePassLaunchEffect(effect) {
      const options = effect.options || {};
      beginEffectHistoryStep(effect.label);
      const result = abilities.executeAbility("launchProbe", createActionContext(), {
        skipCost: options.skipCost !== false,
        ignoreRocketLimit: options.ignoreRocketLimit !== false,
        source: "industry_huanyu_superdrive",
        historyLabel: effect.label,
      });
      if (!result.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }
      recordAbilityCommands(result);
      if (result.rocket) renderRocketElement(result.rocket);
      effect.result = {
        ...result,
        undoable: true,
        message: `${effect.label}：${result.message}`,
      };
      rocketState.statusNote = effect.result.message;
      completeCurrentActionEffect();
      renderRockets();
      renderPlayerStats();
      renderStateReadout();
      return effect.result;
    }

    function executeDrawCardsRewardEffect(effect) {
      const currentPlayer = getEffectTargetPlayer(effect);
      const count = Math.max(0, Math.round(effect.options?.count || 0));
      const available = cards.getAvailablePool(cardState, playerState).length;
      if (available <= 0) {
        rocketState.statusNote = "牌库已无可用卡牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const drawResult = cards.drawCardsToHand(cardState, playerState, currentPlayer, count);
      markCurrentActionIrreversible("盲抽翻出新牌", "hidden_card_reveal");
      const drawnCount = drawResult.cards?.length || 0;
      const message = drawResult.ok
        ? `${effect.label}：已抽 ${drawnCount} 张`
        : `${effect.label}：已抽 ${drawnCount}/${count} 张，${drawResult.message}`;
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: false,
        irreversible: { code: "hidden_card_reveal", reason: "盲抽翻出新牌" },
        message,
        payload: { cards: drawResult.cards || [] },
      });
    }

    function executeRegisterEventBonusEffect(effect) {
      const owner = getEffectOwnerPlayer(effect);
      const beforeTurnBonuses = structuredClone(turnState.cardTurnEventBonuses || []);
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
        if (!Array.isArray(turnState.cardTurnEventBonuses)) turnState.cardTurnEventBonuses = [];
        turnState.cardTurnEventBonuses.push(bonus);
      } else {
        flowBonuses.push(bonus);
      }
      recordHistoryCommand({
        label: "恢复卡牌事件触发登记",
        describe: "移除已登记的卡牌事件触发",
        undo() {
          turnState.cardTurnEventBonuses = structuredClone(beforeTurnBonuses);
          if (decisionState.actionEffectFlow) {
            decisionState.actionEffectFlow.cardFlowEventBonuses = structuredClone(beforeFlowBonuses);
          }
        },
      });
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：已登记`,
        payload: { bonus },
      });
    }

    function executeCountHandIncomeResourceEffect(effect) {
      const currentPlayer = getCurrentPlayer();
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
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${count} 张，${formatPlanetRewardGain(gain) || "无奖励"}`,
        payload: { count, gain },
      }, [renderPlayerHand]);
    }

    function getPlayerCompanyBaseIncome(player) {
      const industryEffect = initialCards?.getIndustryEffect?.(player?.initialSelection?.industry);
      return players.normalizeIncome(industryEffect?.baseIncome || null);
    }

    function executeCountCurrentIncomeResourceEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const incomeKey = effect.options?.incomeKey || "credits";
      const resource = effect.options?.resource || "score";
      const per = Math.max(0, Number(effect.options?.per) || 1);
      const currentIncomeCount = Math.max(0, Math.round(Number(currentPlayer?.income?.[incomeKey]) || 0));
      const companyBaseIncome = getPlayerCompanyBaseIncome(currentPlayer);
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
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：高于公司默认 ${count} 个，${formatPlanetRewardGain(gain) || "无奖励"}`,
        payload: { count, currentIncomeCount, baseIncomeCount, gain },
      });
    }

    function executeCountAliensResourceEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const alienCount = Object.keys(alienGameState?.aliens || {}).length;
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
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${alienCount} 个外星人，${formatPlanetRewardGain(gain) || "无奖励"}`,
        payload: { alienCount, gain },
      });
    }

    function executeTuckPlayedCardToIncomeEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const playedCard = decisionState.actionEffectFlow?.card;
      if (!currentPlayer || !playedCard) {
        rocketState.statusNote = "没有可放入收入区的当前卡牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const gain = cards.getIncomeGainForCard(playedCard);
      if (!gain) {
        rocketState.statusNote = `${cards.getCardLabel(playedCard)} 没有可识别收入`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const discardIndex = (cardState.discardPile || []).findIndex((card) => card.id === playedCard.id);
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = structuredClone(cardState);
      if (discardIndex >= 0) cardState.discardPile.splice(discardIndex, 1);
      const incomeResult = applyIncomeGainWithImmediateRewards(currentPlayer, gain, "card_income");
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复本卡放入收入区前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        cardState,
        beforeCardState,
        "恢复本卡放入收入区前牌区",
      ));
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: incomeResult.undoable,
        irreversible: incomeResult.irreversible,
        message: `${effect.label}：${formatIncomeGain(gain)}`,
        payload: { gain, card: playedCard, drawnCards: incomeResult.drawnCards },
      }, [renderPlayerHand, renderPublicCards]);
    }

    function executePickCardCornerRewardEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const result = beginCardSelection({
        type: "card_pick_corner_reward",
        player: currentPlayer,
        effectLabel: effect.label,
        allowBlindDraw: Boolean(effect.options?.allowBlindDraw),
        fromEffectFlow: true,
        beforePlayerState: structuredClone(currentPlayer),
        beforeCardState: {
          publicCards: cardState.publicCards.slice(),
          discardPile: (cardState.discardPile || []).slice(),
        },
      });
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderStateReadout();
      }
      return result;
    }

    function executeDiscardPublicCornerRewardsEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) return { ok: false, message: "没有当前玩家" };
      const count = Math.max(1, Math.round(Number(effect.options?.count || 1)));
      const filledSlots = cardState.publicCards
        .map((card, index) => card ? index : null)
        .filter((index) => index != null);
      if (filledSlots.length < count) {
        rocketState.statusNote = `${effect.label}：公共牌不足 ${count} 张`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
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
          publicCards: cardState.publicCards.slice(),
          discardPile: (cardState.discardPile || []).slice(),
        },
      });
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderStateReadout();
      }
      return result;
    }

    function normalizeInsertedActionEffect(effect, ownerId, fallbackId) {
      return {
        ...assignEffectOwner({ ...effect }, ownerId),
        id: effect.id || fallbackId,
        options: { ...(effect.options || {}) },
        preHistoryCommands: Array.isArray(effect.preHistoryCommands) ? [...effect.preHistoryCommands] : [],
        preHistoryCommandsApplied: false,
        status: "pending",
      };
    }

    function insertActionEffectsAfterCurrent(effects) {
      if (!decisionState.actionEffectFlow || !effects?.length) return;
      const insertedEffects = effects.filter(Boolean);
      const insertIndex = Math.max(0, decisionState.actionEffectFlow.currentIndex + 1);
      const insertionSource = abilities.chain.createInsertionSource?.(decisionState.actionEffectFlow) || null;
      const currentOwner = getCurrentActionEffect()
        ? getEffectOwnerPlayer(getCurrentActionEffect())
        : null;
      const ownerId = currentOwner?.id
        || decisionState.actionEffectFlow.activePlayerId
        || decisionState.actionEffectFlow.defaultPlayerId
        || decisionState.actionEffectFlow.playerId
        || null;
      decisionState.actionEffectFlow.effects.splice(insertIndex, 0, ...insertedEffects.map((effect, index) => {
        const normalized = normalizeInsertedActionEffect(effect, ownerId, `inserted-card-effect-${insertIndex}-${index}`);
        return abilities.chain.markInsertedNode?.(normalized, insertionSource) || normalized;
      }));
      decisionState.actionEffectFlow.completed = false;
    }

    function insertActionEffectsBeforeCurrent(effects) {
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
      const ownerId = getEffectOwnerPlayer(current)?.id
        || flow.activePlayerId
        || flow.defaultPlayerId
        || flow.playerId
        || getCurrentPlayer()?.id
        || null;
      flow.effects.splice(insertIndex, 0, ...insertedEffects.map((effect, index) => (
        normalizeInsertedActionEffect(effect, ownerId, `inserted-card-trigger-effect-${insertIndex}-${index}`)
      )));
      flow.currentIndex = insertIndex;
      flow.completed = false;
      activateNextActionEffect();
      return true;
    }

    function executeConditionalRewardEffect(effect) {
      const met = isRuntimeCardConditionMet(effect.options?.condition);
      if (met) {
        insertActionEffectsAfterCurrent(effect.options?.rewards || []);
      }
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: met ? `${effect.label}：条件满足，已追加奖励` : `${effect.label}：条件未满足`,
        payload: { conditionMet: met },
      });
    }

    function startHandScanFromCardEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const optional = Boolean(effect.options?.optional);
      if (!currentPlayer?.hand?.length) {
        effect.result = { ok: true, skipped: true, message: `${effect.label}：没有手牌，跳过` };
        rocketState.statusNote = effect.result.message;
        completeCurrentActionEffect("skipped");
        renderStateReadout();
        return effect.result;
      }
      decisionState.handScanAction = {
        type: "hand_scan",
        player: currentPlayer,
        fromEffectFlow: true,
        optional,
      };
      rocketState.statusNote = optional
        ? `${effect.label}：请选择一张手牌弃除并扫描，或点击跳过`
        : `${effect.label}：请选择一张手牌弃除并扫描`;
      syncHandScanSelectionChrome();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: rocketState.statusNote };
    }

    function openOptionalHandScanPrompt(effect) {
      if (!els.scanTargetOverlay || !els.scanTargetActions) {
        return startHandScanFromCardEffect({ ...effect, options: { ...(effect.options || {}), optional: true } });
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
      decisionState.scanTargetAction = { ...getPendingOwnerFields(effect), type: "optional_hand_scan", effect };
      els.scanTargetOverlay.hidden = false;
      rocketState.statusNote = `${effect.label}：选择手牌或跳过`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: rocketState.statusNote };
    }

    function handleOptionalHandScanChoice(choice) {
      const pending = decisionState.scanTargetAction;
      if (pending?.type !== "optional_hand_scan") return { ok: false, message: "没有待处理的可选手牌扫描" };
      const effect = pending.effect;
      closeScanTargetPicker();
      return withPendingOwnerPlayer(pending, () => {
      if (choice === "skip") {
        effect.result = { ok: true, skipped: true, message: `${effect.label}：已跳过` };
        rocketState.statusNote = effect.result.message;
        completeCurrentActionEffect("skipped");
        renderStateReadout();
        return effect.result;
      }
      return startHandScanFromCardEffect({ ...effect, options: { ...(effect.options || {}), optional: true } });
      });
    }

    function executeOptionalDiscardScanEffect(effect) {
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
      insertActionEffectsAfterCurrent(followups);
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：已追加 ${count} 次可选手牌扫描`,
        payload: { count },
      });
    }

    function executeHandScanEffect(effect) {
      if (effect.options?.optional) return openOptionalHandScanPrompt(effect);
      return startHandScanFromCardEffect(effect);
    }

    function executeCountHandCornerMoveEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const count = (currentPlayer?.hand || [])
        .filter((card) => cards.getDiscardActionMoveRewardForCard?.(card))
        .length;
      if (count > 0) {
        insertActionEffectsAfterCurrent([{
          id: `${effect.id || "hand-corner"}-move`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: `手牌移动角标：${count}移动`,
          icon: "movement",
          options: { movementPoints: count, historyLabel: effect.label },
        }]);
      }
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${count} 张`,
        payload: { count },
      }, [renderPlayerHand]);
    }

    function getEarthSectorMoveContentKinds(effect) {
      const kinds = effect?.options?.contentKinds;
      if (Array.isArray(kinds) && kinds.length) return new Set(kinds);
      return new Set([solar.layout.CONTENT_KIND.PLANET, solar.layout.CONTENT_KIND.COMET]);
    }

    function isEarthSectorMoveContent(content, contentKinds) {
      if (!content?.kind || !contentKinds?.has(content.kind)) return false;
      return content.kind !== solar.layout.CONTENT_KIND.PLANET || content.planetId !== "earth";
    }

    function countEarthSectorMoveContents(effect) {
      const earth = getEarthSectorCoordinate();
      if (earth?.x == null) return 0;
      const contentKinds = getEarthSectorMoveContentKinds(effect);
      let count = 0;
      for (let y = rocketActions.SECTOR_RING_MIN; y <= rocketActions.SECTOR_RING_MAX; y += 1) {
        const content = getSectorContentForMove({ x: earth.x, y });
        if (isEarthSectorMoveContent(content, contentKinds)) count += 1;
      }
      return count;
    }

    function executeEarthSectorContentMoveEffect(effect) {
      const count = countEarthSectorMoveContents(effect);
      if (count > 0) {
        insertActionEffectsAfterCurrent([{
          id: `${effect.id || "earth-sector"}-move`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: `地球扇区行星/彗星：${count}移动`,
          icon: "movement",
          options: { movementPoints: count, historyLabel: effect.label },
        }]);
      }
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${count}移动`,
        payload: { count },
      });
    }

    function computeProbeLocationReward(effect, rocket) {
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

    function finishProbeLocationReward(effect, rocket) {
      const currentPlayer = getExplicitEffectOwnerPlayer(effect) || getCurrentPlayer();
      const reward = computeProbeLocationReward(effect, rocket);
      beginEffectHistoryStep(effect.label);
      const results = [];
      for (let index = 0; index < reward.dataCount; index += 1) {
        const gainResult = data.gainData(currentPlayer, { source: "probe_location_reward" });
        results.push(gainResult);
        recordHistoryCommand(historyCommands.createGainDataCommand(currentPlayer, gainResult));
      }
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：获得 ${results.filter((item) => item.ok).length}/${reward.dataCount} 数据`,
        payload: { rocketId: rocket?.id, reward, results },
      });
    }

    function openProbeLocationRewardPicker(effect, choices) {
      return effectChoiceFlowHelpers.openProbeLocationRewardPicker(effect, choices);
    }

    function executeProbeLocationRewardEffect(effect) {
      return effectChoiceFlowHelpers.executeProbeLocationRewardEffect(effect);
    }

    function handleProbeLocationRewardChoice(rocketId) {
      return effectChoiceFlowHelpers.handleProbeLocationRewardChoice(rocketId);
    }

    function executePlutoReserveEffect(effect) {
      const card = decisionState.actionEffectFlow?.card;
      if (card) {
        ensurePlutoCardEffectState(card).pluto = {
          ...(card.cardEffectState?.pluto || {}),
          orbitDone: Boolean(card.cardEffectState?.pluto?.orbitDone),
          landDone: Boolean(card.cardEffectState?.pluto?.landDone),
        };
      }
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：已保留`,
        payload: { cardId: card?.id || null },
      }, [renderReservedCardsFromTaskState]);
    }

    function executeCardFixedNebulaScanEffect(effect) {
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
        insertActionEffectsAfterCurrent(followups);
        effect.label = `${effect.label} 1/${repeat}`;
        effect.options = { ...(effect.options || {}), repeat: 1, _repeatExpanded: true };
      }
      if (!nebulaHasScannableData(effect.options?.nebulaId)) {
        const nebulaLabel = data.getNebulaLabel?.(effect.options?.nebulaId) || "目标星云";
        return finishAutomaticRewardEffect(effect, {
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

    function executePlanetSectorScanEffect(effect) {
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
        insertActionEffectsAfterCurrent(followups);
        effect.label = `${effect.label} 1/${repeat}`;
        effect.options = { ...(effect.options || {}), repeat: 1, _repeatExpanded: true };
      }
      return executeSectorScanAtPlanet(effect.options?.planetId, effect.label, effect);
    }

    function openCardColorScanEffect(effect) {
      const color = effect.options?.color;
      const nebulaIds = cardEffects.NEBULA_IDS_BY_COLOR[color] || [];
      rocketState.statusNote = `${effect.label}：请选择 1 个星云`;
      renderStateReadout();
      return openScanTargetPicker({
        type: "sector_scan",
        fromEffectFlow: true,
        title: effect.label,
        subtitle: "按槽位顺序替换未替换的数据；无可替换数据时追加扫描计数且不获得数据。",
        gainData: effect.options?.gainData,
        choices: expandScanChoicesWithAomomoTargets(nebulaIds.map((nebulaId) => buildNebulaScanChoice(nebulaId))),
      });
    }

    function openCardAnySectorScanEffect(effect) {
      const choices = buildSectorScanChoicesForXs(Array.from({ length: 8 }, (_, x) => x));
      const repeat = Math.max(1, Math.round(Number(effect.options?.repeat) || 1));
      rocketState.statusNote = `${effect.label}：请选择 0-7 号扇区之一`;
      renderStateReadout();
      return openScanTargetPicker({
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

    function openCardPublicScanEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const repeat = Math.max(1, Math.round(Number(effect.options?.repeat || 1)));
      const filledSlots = cardState.publicCards.filter(Boolean).length;
      const selectableCount = Math.min(repeat, Math.max(1, filledSlots));
      const scanRunId = effect.options?.scanRunId || createScanRunId(effect.id || "card-public-scan");
      effect.options = {
        ...(effect.options || {}),
        scanRunId,
        deferPublicRefill: true,
      };
      rocketState.statusNote = selectableCount > 1
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

    function expandCardScanActionEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const scanRunId = createScanRunId(effect.id || "card-scan-action");
      const followups = scanEffects.buildScanEffectQueue(currentPlayer, {
        includeFinalize: true,
        fullScanAction: true,
        scanRunId,
        turnState,
        roundNumber: turnState.roundNumber,
        turnNumber: turnState.turnNumber,
      })
        .map((item, index) => ({
          ...item,
          id: `${effect.id || "card-scan-action"}-${index}`,
          status: "pending",
        }));
      insertActionEffectsAfterCurrent(followups);
      effect.result = {
        ok: true,
        undoable: true,
        message: "扫描行动已展开",
        payload: { inserted: followups.length, scanRunId },
        events: [{ type: "scanAction", source: "card", scanRunId }],
      };
      rocketState.statusNote = "扫描行动已展开，请继续处理后续扫描效果";
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function executeCardResearchTechEffect(effect) {
      if (effect.options?.requireCondition && !isRuntimeCardConditionMet(effect.options.requireCondition)) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          message: `${effect.label}：条件未满足，已跳过`,
        });
      }
      const result = abilities.executeAbility("researchTechPrepare", createActionContext(), {
        techTypes: effect.options?.techTypes || effect.options?.techType,
        skipCost: Boolean(effect.options?.skipCost),
        source: "card",
      });
      if (!result.ok) {
        if (result.reason === "no_takeable_tech") {
          return finishAutomaticRewardEffect(effect, {
            ok: true,
            skipped: true,
            message: `${effect.label}：${result.message}，已跳过`,
            payload: { reason: result.reason },
          });
        }
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }
      rocketState.statusNote = result.message || "请选择要研究的科技片";
      syncTechSelectionChrome();
      renderTechBoard();
      updateActionButtons();
      renderStateReadout();
      return result;
    }

    function openCardDrawThenScanEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const drawResult = cards.blindDraw(cardState, playerState, currentPlayer);
      if (!drawResult.ok) {
        rocketState.statusNote = drawResult.message;
        renderStateReadout();
        return drawResult;
      }

      markCurrentActionIrreversible("盲抽翻出新牌", "hidden_card_reveal");
      const drawnCard = drawResult.card;
      const handIndex = currentPlayer.hand.findIndex((item) => item.id === drawnCard.id);
      const scanChoices = getPublicScanChoicesForCard(drawnCard);
      if (!scanChoices.ok) {
        rocketState.statusNote = scanChoices.message;
        renderPlayerStats();
        renderPlayerHand();
        renderStateReadout();
        return { ...scanChoices, drawnCard };
      }

      effect.icon = getPublicScanIconForScanCode(scanChoices.scanCode);
      renderActionEffectBar();
      rocketState.statusNote = `${effect.label}：${cards.getCardLabel(drawnCard)}，请选择${scanChoices.scanLabel}目标`;
      renderPlayerStats();
      renderPlayerHand();
      renderStateReadout();
      return openScanTargetPicker({
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

    function executeCardDrawThenDiscardActionEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) return { ok: false, message: "没有当前玩家" };

      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };

      beginEffectHistoryStep(effect.label);
      const drawResult = cards.blindDraw(cardState, playerState, currentPlayer);
      if (!drawResult.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = drawResult.message;
        renderStateReadout();
        return drawResult;
      }

      markCurrentActionIrreversible("盲抽翻出新牌", "hidden_card_reveal");
      const drawnCard = drawResult.card;
      const drawnIndex = currentPlayer.hand.findIndex((item) => item.id === drawnCard.id);
      const discardResult = cards.discardFromHandAtIndex(currentPlayer, drawnIndex);
      if (!discardResult.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = discardResult.message;
        renderPlayerHand();
        renderStateReadout();
        return discardResult;
      }
      cards.addToDiscardPile(cardState, discardResult.card);

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
        insertActionEffectsAfterCurrent([{
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
        cardState,
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));

      const rewardText = resourceReward
        ? formatCardCornerRewardMessage(resourceReward, dataResults)
        : moveReward
          ? `${formatPlanetRewardGain(moveReward.gain || {})}${moveReward.gain?.score ? "，" : ""}${moveReward.label}`
          : "无可结算角标";
      return finishAutomaticRewardEffect(effect, {
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
