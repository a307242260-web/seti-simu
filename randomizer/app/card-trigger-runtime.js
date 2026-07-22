(function (root, factory) {
  "use strict";

  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppCardTriggerRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createCardTriggerRuntime(context = {}) {
    const {
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      SCORE_SOURCE_KEYS,
      abilities,
      actionLogOptionsFromHistoryStep,
      activateMoveMode,
      activateNextActionEffectIfIdle,
      addScoreSourceFromGain,
      aliens,
      amiba,
      appendActionLogStep,
      banrenma,
      beginCardSelection,
      beginQuickActionStep,
      beginSupplementalMovePayment,
      blockManualAiPendingInputIfNeeded,
      buildPlutoMarkerContext,
      cardEffects,
      cardTaskState,
      cardTaskStateModule,
      cardTriggerNeedsFreeMove,
      cards,
      chong,
      clearMoveRocketHighlight,
      completeQuickActionStep,
      composeActionLogDetailWithImpact,
      createActionContext,
      createActionLogImpactSnapshot,
      createBanrenmaReservedButton,
      createJiuzheReservedButton,
      createReservedCardButton,
      createReservedCardRow,
      decisionSessions,
      data,
      deactivateMoveMode,
      document,
      els,
      ensureEffectHistorySession,
      fangzhou,
      finishActionEffectFlow,
      formatCardCornerRewardMessage,
      formatChongGain,
      formatChongFossilRewardSummary,
      formatPlanetRewardGain,
      getCardTriggerFreeMoveEffect,
      getCardTypeCode,
      getChongPlanetLabel,
      getEarthSectorCoordinate,
      getPendingOwnerFields,
      getPendingAmibaSymbolChoice,
      getPlanetSectorCoordinate,
      getRequiredMovePointsForUi,
      getSectorContentForMove,
      hasActivePendingSubFlow,
      historyCommands,
      insertActionEffectsAfterCurrent,
      insertActionEffectsBeforeCurrent,
      isActionEffectFlowActive,
      isAsteroidContent,
      isCardSelectionActive,
      isInitialSelectionActive,
      jiuzhe,
      layoutReservedCardRows,
      listCardTriggerFreeMoveCandidates,
      listReadyChongTransportCandidates,
      markCurrentActionIrreversibleForSource,
      maybeApplyIndustryLaunchScan,
      openAmibaSymbolChoiceDialog,
      playerHasOwnOrbitMarkerAtPlanet,
      players,
      quickActionHistory,
      recordAbilityCommands,
      recordQuickHistoryCommand,
      rememberHistoryStep,
      renderActionEffectBar,
      renderAlienPanels,
      renderInitialSelectionArea,
      renderPlayerHand,
      renderPlayerStats,
      renderPublicCards,
      renderReservedCards,
      renderRocketElement,
      renderRockets,
      renderStateReadout,
      rocketActions,
      runezu,
      solar,
      startCardEffectFlow,
      structuredClone,
      updateActionButtons,
    } = context;

    function requireWorkingRoot(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("card-trigger-runtime operation requires an explicit workingRoot");
      }
      return workingRoot;
    }

    function getWorkingCurrentPlayer(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      return players.getCurrentPlayer(playerState);
    }

    function resolveWorkingPlayerReference(workingRoot, reference = {}) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const options = reference.options || {};
      const playerId = reference.playerId || options.playerId || options.targetPlayerId || null;
      const playerColor = reference.playerColor || options.playerColor || options.targetPlayerColor || null;
      return (playerState.players || []).find((player) => (
        (playerId && player.id === playerId)
        || (playerColor && player.color === playerColor)
      )) || null;
    }

    function getWorkingEffectOwnerPlayer(workingRoot, effect) {
      return resolveWorkingPlayerReference(workingRoot, effect?.options || effect)
        || getWorkingCurrentPlayer(workingRoot);
    }

    function getWorkingMovableTokens(workingRoot, playerId) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      return rocketActions.getMovableTokensForPlayer
        ? rocketActions.getMovableTokensForPlayer(rocketState, playerId)
        : rocketActions.getRocketsForPlayer(rocketState, playerId);
    }
    const decisionState = context.decisionSessions?.createFacade?.({
      discardAction: "discard_action",
      cardSelectionAction: "card_selection_action",
      scanTargetAction: "scan_target_action",
      handScanAction: "hand_scan_action",
      alienTraceAction: "alien_trace_action",
      alienTracePickerState: "alien_trace_picker_state",
      actionEffectFlow: "action_effect_flow",
    }) || {};

    const TYPE1_TRIGGER_CONTINUATION_FIELD = "type1TriggerEvents";
    const CARD_CORNER_FREE_MOVE_SESSION = "card_corner_free_move";
    const CARD_TRIGGER_FREE_MOVE_SESSION = "card_trigger_free_move";
    const CARD_TRIGGER_ACTION_SESSION = "card_trigger_action";
    const CARD_TASK_COMPLETION_SESSION = "card_task_completion";
    const getCardTriggerAction = () => decisionSessions.peek(CARD_TRIGGER_ACTION_SESSION);
    const getCardTaskCompletion = () => decisionSessions.peek(CARD_TASK_COMPLETION_SESSION);
    function setCardTriggerAction(session) {
      if (!session) return decisionSessions.clear(CARD_TRIGGER_ACTION_SESSION);
      return decisionSessions.open(CARD_TRIGGER_ACTION_SESSION, session);
    }
    function setCardTaskCompletion(session) {
      if (!session) return decisionSessions.clear(CARD_TASK_COMPLETION_SESSION);
      return decisionSessions.open(CARD_TASK_COMPLETION_SESSION, session);
    }
    const getCardTriggerFreeMove = () => decisionSessions.peek(CARD_TRIGGER_FREE_MOVE_SESSION);
    function setCardTriggerFreeMove(session) {
      if (!session) return decisionSessions.clear(CARD_TRIGGER_FREE_MOVE_SESSION);
      return decisionSessions.open(CARD_TRIGGER_FREE_MOVE_SESSION, session);
    }
    function getType1TriggerEvents(workingRoot) {
      requireWorkingRoot(workingRoot);
      return workingRoot.match?.[TYPE1_TRIGGER_CONTINUATION_FIELD] || [];
    }

    function buildCardTaskContext(workingRoot) {
      const { alienGameState, nebulaDataState, planetStatsState } = requireWorkingRoot(workingRoot);
      const probeLocationData = buildProbeLocationIndex(workingRoot);
      return {
        nebulaDataState,
        alienGameState,
        planetStatsState,
        ...buildPlutoMarkerContext(workingRoot),
        probeLocations: probeLocationData.index,
        probeLocationDetails: probeLocationData.details,
        dataTotals: buildPlayerDataTotals(workingRoot),
      };
    }

    function buildPlayerDataTotals(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const totals = {};
      for (const player of playerState.players || []) {
        const dataState = data.ensurePlayerDataState?.(player) || player?.dataState || {};
        const available = Array.isArray(dataState.poolTokens)
          ? dataState.poolTokens.length
          : Number(player?.resources?.availableData) || 0;
        const placed = Array.isArray(dataState.placedTokens)
          ? dataState.placedTokens.length
          : Number(player?.resources?.placedData) || 0;
        const total = available + placed;
        if (player?.id) totals[player.id] = total;
        if (player?.color) totals[player.color] = total;
      }
      return totals;
    }

    function addProbeLocation(index, key, locationType) {
      if (!key || !locationType) return;
      if (!Array.isArray(index[key])) index[key] = [];
      if (!index[key].includes(locationType)) index[key].push(locationType);
    }

    function buildProbeLocationIndex(workingRoot) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const index = {};
      const details = [];
      const earth = getEarthSectorCoordinate();
      for (const rocket of rocketState.rockets || []) {
        const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
        const content = getSectorContentForMove(coordinate);
        let locationType = null;
        if (isAsteroidContent(content)) locationType = "asteroid";
        if (content?.kind === solar.layout.CONTENT_KIND.COMET) locationType = "comet";
        if (content?.kind === solar.layout.CONTENT_KIND.PLANET) locationType = "planet";
        const distanceFromEarth = earth && coordinate
          ? Math.min(
            Math.abs(solar.mod8(coordinate.x - earth.x)),
            8 - Math.abs(solar.mod8(coordinate.x - earth.x)),
          ) + Math.abs(Number(coordinate.y) - Number(earth.y))
          : null;
        const dxFromEarth = earth && coordinate
          ? Math.min(
            Math.abs(solar.mod8(coordinate.x - earth.x)),
            8 - Math.abs(solar.mod8(coordinate.x - earth.x)),
          )
          : null;
        const adjacentToEarth = Boolean(earth && coordinate
          && (
            (Number(coordinate.y) === Number(earth.y) && dxFromEarth === 1)
            || (Number(coordinate.x) === Number(earth.x) && Number(coordinate.y) === Number(earth.y) + 1)
          ));
        if (locationType) {
          addProbeLocation(index, rocket.playerId, locationType);
          addProbeLocation(index, rocket.color, locationType);
        }
        if (adjacentToEarth && locationType === "asteroid") {
          addProbeLocation(index, rocket.playerId, "earthAdjacentAsteroid");
          addProbeLocation(index, rocket.color, "earthAdjacentAsteroid");
        }
        details.push({
          rocketId: rocket.id,
          playerId: rocket.playerId,
          color: rocket.color,
          coordinate,
          locationType,
          planetId: content?.kind === solar.layout.CONTENT_KIND.PLANET ? content.planetId : null,
          distanceFromEarth,
          adjacentToEarth,
        });
      }
      return { index, details };
    }

    function startTemporaryCardTaskRewardFlow(tasks, settlementResult, options = {}) {
      const effects = options.effects || cardEffects.collectTemporaryTaskRewards(tasks, settlementResult);
      if (!effects.length) return false;
      return startCardEffectFlow(
        "card-temporary-task-rewards",
        "卡牌临时任务奖励",
        effects,
        {
          workingRoot: options.workingRoot,
          actionType: "cardTask",
          futureSpanPlayedCard: Boolean(options.futureSpanPlayedCard),
          historySource: options.historySource || HISTORY_SOURCE_MAIN,
          scanRunId: options.scanRunId || null,
          delayedPublicRefills: options.delayedPublicRefills || [],
        },
      );
    }

    function getReadyCardTasks(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!currentPlayer) return [];
      cardTaskStateModule.refreshTaskState(
        cardTaskState,
        currentPlayer,
        buildCardTaskContext(workingRoot),
        cardEffects,
      );
      const regularTasks = cardTaskStateModule.getReadyType2Tasks(cardTaskState);
      const readyByCardId = new Map((regularTasks || []).map((ready) => [ready?.card?.id, ready]));
      for (const card of currentPlayer.reservedCards || []) {
        const readyChongTask = getReadyChongTaskForReservedCard(workingRoot, card, currentPlayer);
        const readyAmibaTask = readyChongTask ? null : getReadyAmibaTaskForReservedCard(workingRoot, card, currentPlayer);
        const readyRunezuTask = readyChongTask || readyAmibaTask ? null : getReadyRunezuTaskForReservedCard(workingRoot, card, currentPlayer);
        const readySpecialTask = readyChongTask || readyAmibaTask || readyRunezuTask;
        if (readySpecialTask?.card?.id && !readyByCardId.has(readySpecialTask.card.id)) {
          readyByCardId.set(readySpecialTask.card.id, readySpecialTask);
        }
      }
      return [...readyByCardId.values()];
    }

    function refreshCardTaskState(workingRoot, options = {}) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!currentPlayer) {
        cardTaskStateModule.refreshTaskState(cardTaskState, null, buildCardTaskContext(workingRoot), cardEffects);
        return cardTaskState;
      }
      cardTaskStateModule.refreshTaskState(
        cardTaskState,
        currentPlayer,
        buildCardTaskContext(workingRoot),
        cardEffects,
      );
      if (options.render !== false) {
        renderReservedCards();
      }
      return cardTaskState;
    }

    function cloneType1TriggerEvent(event) {
      return event && typeof event === "object" ? { ...event } : event;
    }

    function enqueueType1TriggerEvents(workingRoot, events) {
      requireWorkingRoot(workingRoot);
      const normalized = (events || []).filter(Boolean).map(cloneType1TriggerEvent);
      if (!normalized.length) return;
      if (!workingRoot.match || typeof workingRoot.match !== "object") workingRoot.match = {};
      if (!Array.isArray(workingRoot.match[TYPE1_TRIGGER_CONTINUATION_FIELD])) {
        workingRoot.match[TYPE1_TRIGGER_CONTINUATION_FIELD] = [];
      }
      workingRoot.match[TYPE1_TRIGGER_CONTINUATION_FIELD].push(...normalized);
    }

    function isCardTriggerPickSelectionActive() {
      return isCardSelectionActive() && decisionState.cardSelectionAction?.type === "card_trigger_pick";
    }

    function hasActiveCardTriggerResolution() {
      return Boolean(
        getCardTriggerAction()
        || getCardTriggerFreeMove()
        || decisionSessions.peek(CARD_CORNER_FREE_MOVE_SESSION)
        || isCardTriggerPickSelectionActive()
        || getPendingAmibaSymbolChoice()?.triggerMatch
      );
    }

    function isCardTriggerRewardFlowBusy() {
      return decisionState.actionEffectFlow?.actionType === "cardTrigger"
        && !decisionState.actionEffectFlow.completed;
    }

    function getType1TriggerMatchesForEvent(player, event) {
      return cardTaskStateModule
        .collectType1TriggerMatches(player, [event], cardEffects)
        .filter((match) => (
          !cardTriggerNeedsFreeMove(match)
          || listCardTriggerFreeMoveCandidates(match).length > 0
        ));
    }

    function applyType1TriggerMatches(workingRoot, events = []) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!currentPlayer) return null;
      enqueueType1TriggerEvents(workingRoot, events);
      if (hasActiveCardTriggerResolution() || isCardTriggerRewardFlowBusy()) return null;

      const queuedEvents = getType1TriggerEvents(workingRoot);
      while (queuedEvents.length) {
        const event = queuedEvents.shift();
        const matches = getType1TriggerMatchesForEvent(currentPlayer, event);
        if (!matches.length) continue;
        return matches.length === 1 ? applyCardTriggerMatch(workingRoot, matches[0]) : openCardTriggerPicker(workingRoot, matches);
      }
      delete workingRoot.match[TYPE1_TRIGGER_CONTINUATION_FIELD];
      return null;
    }

    function continueAfterCardTriggerResolution(workingRoot) {
      const type1Result = applyType1TriggerMatches(workingRoot, []);
      if (type1Result || hasActiveCardTriggerResolution() || isCardTriggerRewardFlowBusy()) {
        updateActionButtons();
        renderStateReadout();
        return Boolean(type1Result);
      }
      if (activateNextActionEffectIfIdle()) {
        renderActionEffectBar();
        updateActionButtons();
        renderStateReadout();
        return true;
      }
      if (decisionState.actionEffectFlow?.completed) {
        finishActionEffectFlow();
        return true;
      }
      updateActionButtons();
      renderStateReadout();
      return false;
    }

    function cancelCardTriggerChoice(workingRoot) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!getCardTriggerAction()) return false;
      closeCardTriggerPicker();
      rocketState.statusNote = "已取消卡牌触发";
      continueAfterCardTriggerResolution(workingRoot);
      return true;
    }

    function buildAlienTraceEvent(workingRoot, alienSlotId, traceType, player, alienIdOverride = null) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      const slot = aliens.getAlienSlot(alienGameState, Number(alienSlotId));
      return {
        type: "alienTrace",
        alienSlotId: Number(alienSlotId),
        alienId: alienIdOverride || slot?.alienId || slot?.assignedAlienId || null,
        traceType,
        playerId: player?.id || null,
        playerColor: player?.color || null,
        source: "alien_trace",
      };
    }

    function getNebulaColorForCardEvent(nebulaId) {
      for (const [color, nebulaIds] of Object.entries(cardEffects.NEBULA_IDS_BY_COLOR || {})) {
        if (nebulaIds.includes(nebulaId)) return color;
      }
      return null;
    }

    function ensureCardFlowEventBonuses(flow = decisionState.actionEffectFlow) {
      if (!flow) return [];
      if (!Array.isArray(flow.cardFlowEventBonuses)) flow.cardFlowEventBonuses = [];
      return flow.cardFlowEventBonuses;
    }

    function getActiveCardEventBonuses(workingRoot) {
      const { turnState, playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      return [
        ...ensureCardFlowEventBonuses(decisionState.actionEffectFlow),
        ...((turnState.cardTurnEventBonuses || []).filter((bonus) => bonus.playerId === currentPlayer?.id)),
      ];
    }

    function eventMatchesCardBonus(event, bonus) {
      if (!event || !bonus || event.type !== bonus.eventType) return false;
      if (bonus.color && getNebulaColorForCardEvent(event.nebulaId) !== bonus.color) return false;
      const includedNebulaIds = bonus.nebulaIds || bonus.includeNebulaIds || [];
      if (includedNebulaIds.length && !includedNebulaIds.includes(event.nebulaId)) return false;
      const excludedNebulaIds = bonus.excludeNebulaIds || [];
      if (excludedNebulaIds.length && excludedNebulaIds.includes(event.nebulaId)) return false;
      if (bonus.includePlanetIds?.length && !bonus.includePlanetIds.includes(event.planetId)) return false;
      if (bonus.excludePlanetIds?.length && bonus.excludePlanetIds.includes(event.planetId)) return false;
      return true;
    }

    function getCardEventBonusKey(event, bonus) {
      if (!bonus.distinctBy) return null;
      return String(event?.[bonus.distinctBy] ?? "");
    }

    function applyCardEventBonusReward(workingRoot, rewardEffect, sourceLabel) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!currentPlayer || !rewardEffect) return null;
      if (rewardEffect.type === "gain_resources") {
        const gain = rewardEffect.options?.gain || {};
        players.gainResources(currentPlayer, gain);
        addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.TASK_CARD, gain);
        return { ok: true, message: `${sourceLabel || rewardEffect.label}：${formatPlanetRewardGain(gain)}` };
      }
      if (rewardEffect.type === "gain_data") {
        const count = Math.max(0, Math.round(Number(rewardEffect.options?.count) || 0));
        for (let index = 0; index < count; index += 1) {
          data.gainData(currentPlayer, { source: "card_event_bonus" });
        }
        return { ok: true, message: `${sourceLabel || rewardEffect.label}：${count}数据` };
      }
      return null;
    }

    function applyPublicityMoveFollowupBonus(workingRoot, event, bonus, messages) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!currentPlayer || !bonus.publicityToMoveFollowup) return false;
      if (Math.max(0, Number(event.publicityReward) || 0) <= 0) return false;
      const moveEffect = {
        id: `${bonus.id || "card-event"}-pay-publicity-move-${event.planetId || "planet"}`,
        type: cardEffects.EFFECT_TYPES.CARD_MOVE,
        label: `${bonus.label || "卡牌事件"}：支付1宣传，1移动`,
        icon: "movement",
        options: {
          cost: { publicity: 1 },
          movementPoints: 1,
          historyLabel: bonus.label || "卡牌事件移动",
        },
      };
      if (decisionState.actionEffectFlow) {
        insertActionEffectsAfterCurrent([moveEffect]);
      } else {
        startCardEffectFlow("card-event-bonus-move", bonus.label || "卡牌事件奖励", [moveEffect], {
          workingRoot,
          actionType: "cardEventBonus",
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
        });
      }
      messages.push(`${bonus.label || "卡牌事件"}：追加1宣传换1移动`);
      return true;
    }

    function processCardEventBonuses(workingRoot, events = []) {
      const { rocketState, turnState, playerState } = requireWorkingRoot(workingRoot);
      if (!events?.length) return [];
      const bonuses = getActiveCardEventBonuses(workingRoot);
      if (!bonuses.length) return [];
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const beforePlayer = currentPlayer ? structuredClone(currentPlayer) : null;
      const beforeTurnBonuses = structuredClone(turnState.cardTurnEventBonuses || []);
      const beforeFlowBonuses = structuredClone(decisionState.actionEffectFlow?.cardFlowEventBonuses || []);
      const messages = [];
      for (const event of events) {
        for (const bonus of bonuses) {
          if (!eventMatchesCardBonus(event, bonus)) continue;
          const distinctKey = getCardEventBonusKey(event, bonus);
          if (distinctKey) {
            if (!Array.isArray(bonus.usedKeys)) bonus.usedKeys = [];
            if (bonus.usedKeys.includes(distinctKey)) continue;
            bonus.usedKeys.push(distinctKey);
          }
          const minCount = Math.max(0, Math.round(Number(bonus.minCount) || 0));
          if (minCount > 0) {
            const currentCount = distinctKey ? bonus.usedKeys.length : 1;
            if (currentCount < minCount) continue;
            if (!Array.isArray(bonus.claimedKeys)) bonus.claimedKeys = [];
            const onceKey = bonus.onceKey || `${bonus.id || "card-event-bonus"}:min-count`;
            if (bonus.claimedKeys.includes(onceKey)) continue;
            bonus.claimedKeys.push(onceKey);
          }
          let pendingOnceKey = null;
          if (minCount <= 0 && bonus.onceKey) {
            if (!Array.isArray(bonus.claimedKeys)) bonus.claimedKeys = [];
            if (bonus.claimedKeys.includes(bonus.onceKey)) continue;
            pendingOnceKey = bonus.onceKey;
          }
          if (applyPublicityMoveFollowupBonus(workingRoot, event, bonus, messages)) {
            if (pendingOnceKey) bonus.claimedKeys.push(pendingOnceKey);
            continue;
          }
          let appliedReward = false;
          for (const reward of bonus.rewards || []) {
            const result = applyCardEventBonusReward(workingRoot, reward, bonus.label);
            if (result?.ok) {
              appliedReward = true;
              messages.push(result.message);
            }
          }
          if (appliedReward && pendingOnceKey) bonus.claimedKeys.push(pendingOnceKey);
        }
      }
      if (messages.length) {
        const source = decisionState.actionEffectFlow?.historySource
          || (quickActionHistory.hasSession() ? HISTORY_SOURCE_QUICK : HISTORY_SOURCE_MAIN);
        const history = ensureEffectHistorySession(source, "cardEventBonus", "卡牌事件触发奖励");
        history.beginStep({
          source,
          type: "card_event_bonus",
          label: "卡牌事件触发奖励",
          logBefore: createActionLogImpactSnapshot(beforePlayer),
        });
        if (beforePlayer && currentPlayer) {
          history.record(historyCommands.createRestorePlayerCommand(
            currentPlayer,
            beforePlayer,
            "恢复卡牌事件触发奖励前玩家状态",
          ));
        }
        history.record({
          label: "恢复卡牌事件触发状态",
          describe: "恢复卡牌事件触发计数",
          undo() {
            turnState.cardTurnEventBonuses = structuredClone(beforeTurnBonuses);
            if (decisionState.actionEffectFlow) {
              decisionState.actionEffectFlow.cardFlowEventBonuses = structuredClone(beforeFlowBonuses);
            }
          },
        });
        const step = history.endStep();
        if (step) {
          rememberHistoryStep(source, step.id);
          appendActionLogStep(
            source,
            step.label,
            composeActionLogDetailWithImpact(messages.join("；"), step),
            actionLogOptionsFromHistoryStep(step),
          );
        }
        rocketState.statusNote = `${rocketState.statusNote ? `${rocketState.statusNote}；` : ""}${messages.join("；")}`;
        renderPlayerStats();
        renderStateReadout();
      }
      return messages;
    }

    function processChongTransportArrivalEvents(workingRoot, events = []) {
      const { alienGameState, rocketState } = requireWorkingRoot(workingRoot);
      if (!chong || !events?.length) return [];
      const arrivals = [];
      for (const event of events) {
        if (event?.type !== "visitPlanet") continue;
        if ((event.tokenKind || "") !== rocketActions.ROCKET_KIND.CHONG_FOSSIL) continue;
        const task = chong.getTransportTaskForRocket(alienGameState, event.rocketId);
        if (!task) continue;
        const fossil = alienGameState.chong?.fossilsById?.[task.fossilId] || null;
        const message = `${fossil?.fossilId || "虫族化石"} 到达 ${getChongPlanetLabel(event.planetId)}，若有匹配虫族任务可点击保留牌完成`;
        arrivals.push({ event, fossil, task, message });
      }
      if (arrivals.length) {
        rocketState.statusNote = arrivals.map((item) => item.message).join("；");
        renderAlienPanels(workingRoot);
        renderRockets();
        renderPlayerStats();
        renderPlayerHand();
        renderReservedCards();
        renderStateReadout();
      }
      return arrivals;
    }

    function getChongTransportDestinationCoordinate(planetId) {
      if (!planetId) return null;
      return planetId === "earth"
        ? getEarthSectorCoordinate()
        : getPlanetSectorCoordinate(planetId);
    }

    function getChongTransportArrivalEventKey(event) {
      if (!event || event.type !== "visitPlanet") return null;
      if ((event.tokenKind || "") !== rocketActions.ROCKET_KIND.CHONG_FOSSIL) return null;
      if (!event.planetId || !Number.isFinite(Number(event.rocketId))) return null;
      return `${Number(event.rocketId)}:${event.planetId}`;
    }

    function buildChongPositionArrivalEvents(workingRoot, existingEvents = []) {
      const { alienGameState, rocketState } = requireWorkingRoot(workingRoot);
      if (!chong?.listTransportArrivalEvents) return [];
      const existingKeys = new Set(
        (existingEvents || [])
          .map(getChongTransportArrivalEventKey)
          .filter(Boolean),
      );
      return chong.listTransportArrivalEvents(
        alienGameState,
        rocketState.rockets || [],
        getChongTransportDestinationCoordinate,
        { chongFossilKind: rocketActions.ROCKET_KIND.CHONG_FOSSIL },
      ).filter((event) => {
        const key = getChongTransportArrivalEventKey(event);
        return key && !existingKeys.has(key);
      });
    }

    function settleCardTasksAfterEffect(workingRoot, options = {}) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const { events, skipType1 = false, type1Only = false, render = true } = options;
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const normalizedEvents = (events || []).map((event) => (
        event?.type === "visitPlanet" && event.planetId
          ? { ...event, hasOwnOrbit: playerHasOwnOrbitMarkerAtPlanet(currentPlayer, event.planetId) }
          : event
      ));
      const cardEventBonuses = type1Only ? [] : processCardEventBonuses(workingRoot, normalizedEvents);
      const chongEvents = type1Only
        ? []
        : [...normalizedEvents, ...buildChongPositionArrivalEvents(workingRoot, normalizedEvents)];
      const chongCompletions = type1Only ? [] : processChongTransportArrivalEvents(workingRoot, chongEvents);
      const runezuCompletions = [];
      refreshCardTaskState(workingRoot, { render });
      const type1Result = skipType1 ? null : applyType1TriggerMatches(workingRoot, normalizedEvents);
      if (!hasActiveCardTriggerResolution()) {
        activateNextActionEffectIfIdle();
      }
      return {
        cardEventBonuses,
        chongCompletions,
        runezuCompletions,
        type1Result,
      };
    }

    function getChongRewardPrimaryIcon(reward = {}) {
      const gain = reward.gain || {};
      if (Number(gain.score) > 0) return "score";
      if (Number(gain.energy) > 0) return "energy";
      if (Number(gain.publicity) > 0) return "publicity";
      if (Number(gain.credits) > 0) return "credits";
      if (Number(reward.dataCount) > 0) return "data";
      if (Number(reward.drawCards) > 0) return "blind_card";
      if (reward.pickCard) return "pick_card";
      if (reward.pickAlienCard) return "chongCard";
      return "chongFossilOk";
    }

    function createChongTaskEffect(id, type, label, icon, options = {}, extra = {}) {
      return {
        id,
        type,
        label,
        icon,
        options: { ...options },
        status: "pending",
        ...extra,
      };
    }

    function buildChongRewardQueueEffects(reward = {}, prefix, labelPrefix) {
      const effects = [];
      const gain = Object.fromEntries(
        Object.entries(reward.gain || {})
          .filter(([, value]) => Number(value) !== 0)
          .map(([key, value]) => [key, Math.round(Number(value))]),
      );
      if (Object.keys(gain).length) {
        effects.push(createChongTaskEffect(
          `${prefix}-gain`,
          "gain_resources",
          `${labelPrefix}：${formatChongGain(gain)}`,
          getChongRewardPrimaryIcon({ gain }),
          { gain, scoreSourceKey: SCORE_SOURCE_KEYS.TASK_CARD },
        ));
      }

      const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
      if (dataCount > 0) {
        effects.push(createChongTaskEffect(
          `${prefix}-data`,
          "gain_data",
          `${labelPrefix}：${dataCount}数据`,
          "data",
          { count: dataCount, source: "chong_task" },
        ));
      }

      const drawCount = Math.max(0, Math.round(Number(reward.drawCards) || 0));
      if (drawCount > 0) {
        effects.push(createChongTaskEffect(
          `${prefix}-draw`,
          "draw_cards",
          `${labelPrefix}：盲抽${drawCount}张牌`,
          "blind_card",
          { count: drawCount },
        ));
      }

      if (reward.pickCard) {
        effects.push(createChongTaskEffect(
          `${prefix}-pick`,
          "pick_card",
          `${labelPrefix}：精选1张牌`,
          "pick_card",
          { count: 1 },
          { needsUserChoice: true },
        ));
      }

      return effects;
    }

    function buildChongFossilRewardQueueEffects(fossilId, repeat, prefix, labelPrefix) {
      const reward = chong?.getFossilReward?.(fossilId);
      if (!reward) return [];
      const total = Math.max(1, Math.round(Number(repeat) || 1));
      const effects = [];
      for (let index = 0; index < total; index += 1) {
        const repeatLabel = total > 1 ? `${labelPrefix} ${index + 1}/${total}` : labelPrefix;
        effects.push(...buildChongRewardQueueEffects(
          reward,
          `${prefix}-fossil-${index + 1}`,
          repeatLabel,
        ));
      }
      return effects;
    }

    function buildChongTransportCleanupEffect(card, deliveredTransport, task = null) {
      const rocketId = Math.round(Number(deliveredTransport?.rocketId));
      const fossilId = deliveredTransport?.fossil?.fossilId || deliveredTransport?.task?.fossilId || null;
      return createChongTaskEffect(
        `chong-task-${card?.id || "card"}-cleanup`,
        chong?.EFFECT_TYPES?.CHONG_TASK_CLEANUP || "chong_task_cleanup",
        `${cards.getCardLabel(card)}：清理搬运化石`,
        "chongFossilOk",
        {
          cardId: card?.id || null,
          rocketId,
          fossilId,
          destinationPlanetId: task?.destinationPlanetId
            || deliveredTransport?.completionTask?.destinationPlanetId
            || deliveredTransport?.task?.destinationPlanetId
            || deliveredTransport?.fossil?.destinationPlanetId
            || null,
          task,
        },
        { required: true },
      );
    }

    function buildChongTaskCompletionEffects(card, task, deliveredTransport = null) {
      const cardLabel = cards.getCardLabel(card);
      const prefix = `chong-task-${card?.id || "card"}`;
      const effects = [];

      if (task?.kind === "transport") {
        const fossilId = deliveredTransport?.fossil?.fossilId || deliveredTransport?.task?.fossilId || null;
        if (fossilId) {
          effects.push(...buildChongFossilRewardQueueEffects(
            fossilId,
            task.fossilRewardRepeat,
            prefix,
            `${cardLabel}：${fossilId}化石奖励`,
          ));
        }
        effects.push(...buildChongRewardQueueEffects(task, `${prefix}-extra`, `${cardLabel}：任务奖励`));
        effects.push(buildChongTransportCleanupEffect(card, deliveredTransport, task));
        return effects;
      }

      if (task?.kind === "trace") {
        effects.push(createChongTaskEffect(
          `${prefix}-choose-fossil-reward`,
          chong?.EFFECT_TYPES?.CHONG_CHOOSE_PLANET_FOSSIL_REWARD || "chong_choose_planet_fossil_reward",
          `${cardLabel}：选择木星/土星化石奖励`,
          "chongFossilOk",
          {
            cardId: card?.id || null,
            taskKind: "trace",
          },
          { needsUserChoice: true },
        ));
        effects.push(...buildChongRewardQueueEffects(task, `${prefix}-extra`, `${cardLabel}：任务奖励`));
      }

      return effects;
    }

    function getReadyTaskForReservedCard(workingRoot, card, player = getWorkingCurrentPlayer(workingRoot)) {
      cardTaskStateModule.refreshTaskState(
        cardTaskState,
        player,
        buildCardTaskContext(workingRoot),
        cardEffects,
      );
      const readyChongTask = getReadyChongTaskForReservedCard(workingRoot, card, player);
      if (readyChongTask) return readyChongTask;
      const readyAmibaTask = getReadyAmibaTaskForReservedCard(workingRoot, card, player);
      if (readyAmibaTask) return readyAmibaTask;
      const readyRunezuTask = getReadyRunezuTaskForReservedCard(workingRoot, card, player);
      if (readyRunezuTask) return readyRunezuTask;
      return cardTaskStateModule.getReadyType2ForCard(cardTaskState, card?.id) || null;
    }

    function getReadyChongTaskForReservedCard(workingRoot, card, player = getWorkingCurrentPlayer(workingRoot)) {
      if (!chong?.isChongCard?.(card)) return null;
      if (card?.chongTaskCompleted) return null;
      const task = card.chongTask || chong.getCardTask(card);
      if (!task) return null;
      if (task.kind === "transport") {
        const deliveredTransports = listReadyChongTransportCandidates(workingRoot, player, task);
        const deliveredTransport = deliveredTransports[0] || null;
        if (!deliveredTransport) return null;
        return {
          chongTask: true,
          card,
          task,
          deliveredTransport,
          deliveredTransports,
          effects: buildChongTaskCompletionEffects(card, task, deliveredTransport),
        };
      }
      if (task.kind !== "trace") return null;
      if (!chong.isTraceTaskReady(alienGameState, player, task)) return null;
      return {
        chongTask: true,
        card,
        task,
        effects: buildChongTaskCompletionEffects(card, task),
      };
    }

    function getReadyAmibaTaskForReservedCard(workingRoot, card, player = getWorkingCurrentPlayer(workingRoot)) {
      if (!amiba?.isAmibaCard?.(card)) return null;
      if (card?.amibaTaskCompleted) return null;
      const task = card.amibaTask || amiba.getCardTask(card);
      if (!task || task.kind !== "three-traces-empty-slots") return null;
      if (!amiba.isTheoryTaskReady(alienGameState, player)) return null;
      const reward = amiba.getTheoryTaskReward(alienGameState);
      return {
        amibaTask: true,
        card,
        task,
        effects: reward.effects || [],
        emptyCount: reward.emptyCount || 0,
      };
    }

    function getReadyRunezuTaskForReservedCard(workingRoot, card, player = getWorkingCurrentPlayer(workingRoot)) {
      if (!runezu?.isRunezuCard?.(card)) return null;
      return runezu.getReadyThreeTraceTask?.(card, alienGameState, player) || null;
    }

    function getRunezuTaskProgressIndexes(card) {
      if (!runezu?.isRunezuCard?.(card)) return [];
      return runezu.getTaskProgressIndexes?.(card) || [];
    }

    function incrementCompletedTaskCount(player) {
      if (!player) return 0;
      player.completedTaskCount = Math.max(0, Math.round(Number(player.completedTaskCount) || 0)) + 1;
      return player.completedTaskCount;
    }

    function removeReservedCardToDiscard(workingRoot, player, card) {
      const { cardState } = requireWorkingRoot(workingRoot);
      const index = player?.reservedCards?.findIndex((item) => item.id === card?.id) ?? -1;
      if (index < 0) return false;
      const [finishedCard] = player.reservedCards.splice(index, 1);
      cards.addToDiscardPile(cardState, finishedCard);
      return true;
    }

    function discardReservedCardIfFinished(workingRoot, player, card) {
      if (!cardEffects.areAllTriggersConsumed(card)) return false;
      if (!removeReservedCardToDiscard(workingRoot, player, card)) return false;
      incrementCompletedTaskCount(player);
      return true;
    }

    function createCardTriggerProgressSnapshot(workingRoot) {
      const { cardState, playerState } = requireWorkingRoot(workingRoot);
      return {
        playerState: structuredClone(playerState),
        cardState: structuredClone(cardState),
      };
    }

    function createCardTriggerProgressCommands(workingRoot, snapshot, label = "卡牌触发") {
      const { cardState, playerState } = requireWorkingRoot(workingRoot);
      if (!snapshot) return [];
      return [
        historyCommands.createRestoreObjectCommand(
          playerState,
          snapshot.playerState,
          `恢复${label}前玩家状态`,
        ),
        historyCommands.createRestoreObjectCommand(
          cardState,
          snapshot.cardState,
          `恢复${label}前牌区状态`,
        ),
      ];
    }

    function consumeCardTriggerWithSnapshot(workingRoot, match, player = getWorkingCurrentPlayer(workingRoot), label = "卡牌触发") {
      const snapshot = createCardTriggerProgressSnapshot(workingRoot);
      if (match?.card && match?.trigger) {
        cardEffects.consumeTrigger(match.card, match.trigger.id);
        discardReservedCardIfFinished(workingRoot, player, match.card);
      }
      return {
        snapshot,
        commands: createCardTriggerProgressCommands(workingRoot, snapshot, label),
      };
    }

    function confirmCardTriggerProgress(workingRoot, match, player = getWorkingCurrentPlayer(workingRoot), label = "卡牌触发") {
      const triggerProgress = consumeCardTriggerWithSnapshot(workingRoot, match, player, label);
      beginQuickActionStep("card-trigger-confirm", label);
      for (const command of triggerProgress.commands) {
        recordQuickHistoryCommand(command);
      }
      completeQuickActionStep("确认卡牌触发");
      return triggerProgress;
    }

    function prepareCardTriggerRewardEffects(workingRoot, match, effects, label) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const rewardEffects = (effects || []).filter(Boolean);
      if (!rewardEffects.length) return [];
      const triggerProgress = consumeCardTriggerWithSnapshot(workingRoot, match, getWorkingCurrentPlayer(workingRoot), label);
      const prepared = rewardEffects.map((effect, index) => ({
        ...effect,
        id: effect.id || `${match?.trigger?.id || "card-trigger"}-effect-${index + 1}`,
        options: { ...(effect.options || {}) },
        preHistoryCommands: index === 0 ? triggerProgress.commands : [],
        preHistoryCommandsApplied: false,
        status: "pending",
      }));
      return prepared;
    }

    function queueCardTriggerRewardEffects(workingRoot, match, effects = [match?.effect]) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!match?.card || !match?.trigger) return { ok: false, message: "没有可结算的卡牌触发" };
      const label = `卡牌触发：${match.effect?.label || "任务奖励"}`;
      const preparedEffects = prepareCardTriggerRewardEffects(workingRoot, match, effects, label);
      if (!preparedEffects.length) return { ok: false, message: "卡牌触发没有可执行奖励" };

      closeCardTriggerPicker();
      renderReservedCards();

      if (decisionState.actionEffectFlow) {
        insertActionEffectsBeforeCurrent(preparedEffects);
        rocketState.statusNote = `${label}：已加入效果队列`;
        renderActionEffectBar();
        updateActionButtons();
        renderStateReadout();
        return { ok: true, queued: true, message: rocketState.statusNote };
      }

      const started = startCardEffectFlow(
        "card-trigger-effects",
        label,
        preparedEffects,
        {
          workingRoot,
          actionType: "cardTrigger",
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
        },
      );
      return started
        ? { ok: true, queued: true, message: rocketState.statusNote }
        : { ok: false, message: "无法启动卡牌触发奖励队列" };
    }

    function getCardTaskCompletionBlockReason() {
      if (isActionEffectFlowActive()) return "请先完成当前行动的效果";
      if (hasActivePendingSubFlow()) return "请先完成或取消当前流程";
      return null;
    }

    function openCardTaskCompletionPicker(workingRoot, card, options = {}) {
      const { rocketState, playerState } = requireWorkingRoot(workingRoot);
      const player = options.player
        || resolveWorkingPlayerReference(workingRoot, {
          playerId: options.playerId,
          playerColor: options.playerColor,
        })
        || getWorkingCurrentPlayer(workingRoot);
      const blockReason = getCardTaskCompletionBlockReason();
      if (blockReason) {
        rocketState.statusNote = blockReason;
        renderStateReadout();
        return { ok: false, message: blockReason };
      }

      const ready = getReadyTaskForReservedCard(workingRoot, card, player);
      if (!ready) return { ok: false, message: "这张任务卡尚未满足完成条件" };
      if (!els.scanTargetOverlay || !els.scanTargetActions) return { ok: false, message: "无法打开任务确认窗口" };

      setCardTaskCompletion({
        ...getPendingOwnerFields(null, player),
        ready,
      });
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = "完成任务";
      if (els.scanTargetSubtitle) {
        els.scanTargetSubtitle.textContent = `${cards.getCardLabel(ready.card)} 已满足条件，确认后结算奖励并移除。`;
      }
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      if (ready.chongTask && ready.task?.kind === "transport" && (ready.deliveredTransports || []).length > 1) {
        const nodes = ready.deliveredTransports.map((transport) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "scan-target-option-button chong-fossil-choice-button";
          button.dataset.cardTaskComplete = String(transport.rocketId);
          const fossilId = transport.fossil?.fossilId || "化石";
          const summary = formatChongFossilRewardSummary(fossilId);
          const image = document.createElement("img");
          image.className = "chong-fossil-choice-image";
          image.src = chong.getFossilSrc(fossilId);
          image.alt = fossilId;
          image.width = 128;
          image.height = 128;
          image.decoding = "async";
          const meta = document.createElement("small");
          meta.textContent = `${getChongPlanetLabel(transport.currentPlanetId)} · ${summary}`;
          button.append(image, meta);
          return button;
        });
        els.scanTargetActions.replaceChildren(...nodes);
      } else {
        const confirmButton = document.createElement("button");
        confirmButton.type = "button";
        confirmButton.className = "scan-target-option-button";
        confirmButton.dataset.cardTaskComplete = ready.deliveredTransport?.rocketId != null
          ? String(ready.deliveredTransport.rocketId)
          : "confirm";
        confirmButton.innerHTML = `确认完成任务<small>${ready.effects.map((item) => item.label).join("；")}</small>`;
        els.scanTargetActions.replaceChildren(confirmButton);
      }
      els.scanTargetOverlay.hidden = false;
      rocketState.statusNote = "任务已满足：点击确认完成任务";
      renderStateReadout();
      return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
    }

    function closeCardTaskCompletionPicker() {
      setCardTaskCompletion(null);
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
    }

    function confirmCardTaskCompletion(workingRoot, choice = "confirm", options = {}) {
      const { cardState, playerState, rocketState } = requireWorkingRoot(workingRoot);
      const pending = getCardTaskCompletion();
      if (!pending?.ready) return { ok: false, message: "没有待完成的任务" };
      const blocked = blockManualAiPendingInputIfNeeded(pending, options, "任务完成");
      if (blocked) return blocked;
      if (isActionEffectFlowActive()) {
        rocketState.statusNote = "请先完成当前行动的效果";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const currentPlayer = resolveWorkingPlayerReference(workingRoot, pending)
        || getWorkingCurrentPlayer(workingRoot)
        || (playerState.players || []).find((player) => (
          (player.reservedCards || []).includes(pending.ready?.card)
        ))
        || null;
      let ready = pending.ready;
      if (ready.chongTask && ready.task?.kind === "transport" && choice !== "confirm") {
        const selectedTransport = (ready.deliveredTransports || [])
          .find((transport) => String(transport.rocketId) === String(choice));
        if (!selectedTransport) {
          rocketState.statusNote = "没有选择有效的虫族搬运化石";
          renderStateReadout();
          return { ok: false, message: rocketState.statusNote };
        }
        ready = {
          ...ready,
          deliveredTransport: selectedTransport,
          effects: buildChongTaskCompletionEffects(ready.card, ready.task, selectedTransport),
        };
      }
      closeCardTaskCompletionPicker();

      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };
      if (ready.chongTask) {
        ready.card.chongTaskCompleted = true;
      } else if (ready.runezuTask) {
        runezu?.completeRunezuTask?.(ready.card);
      } else {
        cardEffects.completeTask(ready.card, ready.task.id);
      }
      removeReservedCardToDiscard(workingRoot, currentPlayer, ready.card);
      incrementCompletedTaskCount(currentPlayer);

      beginQuickActionStep("card-task", `完成任务：${cards.getCardLabel(ready.card)}`);
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复卡牌任务结算前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        cardState,
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
      completeQuickActionStep();

      renderPlayerStats();
      renderPublicCards();
      updateActionButtons();
      renderStateReadout();
      return startCardEffectFlow(
        "card-task-rewards",
        ready.chongTask ? "虫族任务奖励" : "卡牌任务奖励",
        ready.effects,
        {
          workingRoot,
          actionType: "cardTask",
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
        },
      );
    }

    function openCardTriggerPicker(workingRoot, matches) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!matches?.length) return { ok: false, message: "没有可触发的卡牌" };
      if (!els.scanTargetOverlay || !els.scanTargetActions) return { ok: false, message: "无法打开卡牌触发选择" };

      setCardTriggerAction({ matches });
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = "卡牌触发";
      if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "选择 1 个满足条件的触发效果结算。";
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      els.scanTargetActions.replaceChildren(...matches.map((match, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.cardTriggerChoice = String(index);
        button.innerHTML = `${match.effect.label}<small>${cards.getCardLabel(match.card)}</small>`;
        return button;
      }));
      els.scanTargetOverlay.hidden = false;
      rocketState.statusNote = "卡牌触发：请选择一个效果";
      renderStateReadout();
      return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
    }

    function closeCardTriggerPicker() {
      setCardTriggerAction(null);
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
    }

    function applyCardTriggerReward(workingRoot, match) {
      const { cardState, playerState, rocketState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!currentPlayer || !match?.card || !match.trigger) return { ok: false, message: "没有可结算的卡牌触发" };

      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };
      beginQuickActionStep("card-trigger", `卡牌触发：${match.effect.label}`);
      const effect = match.effect;
      let result = null;

      if (effect.type === "gain_resources") {
        const gain = effect.options?.gain || {};
        players.gainResources(currentPlayer, gain);
        addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.TASK_CARD, gain);
        result = { ok: true, message: effect.label };
      } else if (effect.type === "gain_data") {
        const count = Math.max(0, Math.round(effect.options?.count || 0));
        const results = [];
        for (let index = 0; index < count; index += 1) {
          results.push(data.gainData(currentPlayer, { source: "card_trigger" }));
        }
        result = { ok: true, message: `${effect.label}：获得 ${results.filter((item) => item.ok).length}/${count} 数据` };
      } else if (effect.type === "draw_cards") {
        const count = Math.max(0, Math.round(effect.options?.count || 0));
        const drawResult = cards.drawCardsToHand(cardState, playerState, currentPlayer, count);
        const drawnCount = (drawResult.cards || []).length;
        const irreversible = drawnCount
          ? { code: "hidden_card_reveal", reason: "盲抽翻出新牌" }
          : null;
        result = {
          ok: Boolean(drawResult.ok),
          undoable: !irreversible,
          irreversible,
          message: `${effect.label}：盲抽 ${drawnCount}/${count} 张`,
        };
        if (irreversible) {
          markCurrentActionIrreversibleForSource(
            HISTORY_SOURCE_QUICK,
            irreversible.reason,
            irreversible.code,
          );
        }
      } else if (effect.type === "launch") {
        const launchResult = abilities.executeAbility("launchProbe", createActionContext(workingRoot), {
          ...(effect.options || {}),
          source: "card_trigger",
          historyLabel: effect.label,
        });
        if (launchResult.rocket) renderRocketElement(launchResult.rocket);
        if (launchResult.ok) {
          maybeApplyIndustryLaunchScan(workingRoot, launchResult);
          recordAbilityCommands(launchResult, undefined, workingRoot);
          settleCardTasksAfterEffect(workingRoot, { events: launchResult.events, render: false });
        }
        result = launchResult;
      } else if (effect.type === cardEffects.EFFECT_TYPES.CARD_CORNER_EVENT_REWARD) {
        const corner = match.event || {};
        const resourceReward = corner.resourceReward || null;
        const moveReward = corner.moveReward || null;
        const dataResults = [];
        if (resourceReward) {
          if (Object.keys(resourceReward.gain || {}).length) {
            players.gainResources(currentPlayer, resourceReward.gain);
            addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.TASK_CARD, resourceReward.gain);
          }
          const dataCount = Math.max(0, Math.round(resourceReward.dataCount || 0));
          for (let index = 0; index < dataCount; index += 1) {
            dataResults.push(data.gainData(currentPlayer, { source: "card_corner_trigger" }));
          }
        }
        if (moveReward?.gain && Object.keys(moveReward.gain).length) {
          players.gainResources(currentPlayer, moveReward.gain);
          addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.TASK_CARD, moveReward.gain);
        }
        const message = resourceReward
          ? formatCardCornerRewardMessage(resourceReward, dataResults)
          : moveReward
            ? [formatPlanetRewardGain(moveReward.gain || {}), `${moveReward.movementPoints || 1}移动`].filter(Boolean).join("、")
            : "无可结算角标";
        result = { ok: true, message: `${effect.label}：${message}` };
      } else {
        result = { ok: false, message: `暂不支持的卡牌触发效果：${effect.type}` };
      }

      if (result.ok) {
        cardEffects.consumeTrigger(match.card, match.trigger.id);
        discardReservedCardIfFinished(workingRoot, currentPlayer, match.card);
        recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
          currentPlayer,
          beforePlayer,
          "恢复卡牌触发前玩家状态",
        ));
        recordQuickHistoryCommand(historyCommands.createRestorePublicCardsCommand(
          cardState,
          beforeCardState.publicCards,
          beforeCardState.discardPile,
        ));
        completeQuickActionStep(null, result.irreversible ? {
          irreversibleCode: result.irreversible.code,
          irreversibleReason: result.irreversible.reason,
        } : {});
        rocketState.statusNote = result.message;
      } else {
        quickActionHistory.undoLastStep();
        rocketState.statusNote = result.message;
      }

      renderPlayerStats();
      renderPublicCards();
      renderPlayerHand();
      if (result.ok) {
        continueAfterCardTriggerResolution(workingRoot);
      } else {
        updateActionButtons();
        renderStateReadout();
      }
      return result;
    }

    function beginCardTriggerFreeMove(workingRoot, match) {
      const { cardState, rocketState, playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const rocketsForPlayer = getWorkingMovableTokens(workingRoot, currentPlayer?.id);
      if (!rocketsForPlayer.length) {
        return { ok: false, message: "没有可移动的飞船" };
      }
      setCardTriggerFreeMove({
        match,
        beforePlayer: structuredClone(currentPlayer),
        beforeCardState: {
          publicCards: cardState.publicCards.slice(),
          discardPile: (cardState.discardPile || []).slice(),
        },
      });
      rocketState.statusNote = rocketsForPlayer.length > 1
        ? "卡牌触发：请点击要免费移动的飞船"
        : "卡牌触发：使用方向键免费移动飞船";
      if (rocketsForPlayer.length === 1) {
        activateMoveMode(rocketsForPlayer[0].id);
      } else {
        const fallbackRocket = rocketsForPlayer[rocketsForPlayer.length - 1] || null;
        rocketState.activeRocketId = fallbackRocket?.id || null;
      }
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function applyCardTriggerMatch(workingRoot, match) {
      const { alienGameState, cardState, playerState } = requireWorkingRoot(workingRoot);
      if (match?.effect?.type === amiba?.EFFECT_TYPES?.CHOOSE_SYMBOL_REWARD) {
        closeCardTriggerPicker();
        return openAmibaSymbolChoiceDialog(workingRoot, {
          region: match.effect.options?.region,
          player: getWorkingCurrentPlayer(workingRoot),
          triggerMatch: match,
          effectLabel: match.effect.label,
          beforeAlienState: structuredClone(alienGameState),
          beforePlayerState: structuredClone(playerState),
          beforeCardState: structuredClone(cardState),
        });
      }
      if (match?.effect?.type === "pick_card") {
        closeCardTriggerPicker();
        return beginCardSelection(workingRoot, {
          type: "card_trigger_pick",
          player: getWorkingCurrentPlayer(workingRoot),
          allowBlindDraw: true,
          triggerMatch: match,
          triggerSnapshot: createCardTriggerProgressSnapshot(workingRoot),
        });
      }
      if (match?.effect?.type === cardEffects.EFFECT_TYPES.FREE_MOVE) {
        return queueCardTriggerRewardEffects(workingRoot, match, [match.effect]);
      }
      if (match?.effect?.type === cardEffects.EFFECT_TYPES.CARD_CORNER_EVENT_REWARD
        && match.event?.moveReward) {
        return beginCardTriggerFreeMove(workingRoot, {
          ...match,
          effect: getCardTriggerFreeMoveEffect(match),
        });
      }
      if (match?.effect?.type === cardEffects.EFFECT_TYPES.CARD_CORNER_EVENT_REWARD) {
        return applyCardTriggerReward(workingRoot, match);
      }
      if (
        match?.effect?.type === runezu?.EFFECT_TYPES?.SYMBOL_REWARD
        || match?.effect?.type === runezu?.EFFECT_TYPES?.SYMBOL_BRANCH
      ) {
        return queueCardTriggerRewardEffects(workingRoot, match, [match.effect]);
      }
      if (String(match?.effect?.type || "").startsWith("card_")) {
        return queueCardTriggerRewardEffects(workingRoot, match, [match.effect]);
      }
      return applyCardTriggerReward(workingRoot, match);
    }

    function handleCardTriggerChoice(workingRoot, choiceIndex) {
      const matches = getCardTriggerAction()?.matches || [];
      const match = matches[Number(choiceIndex)];
      closeCardTriggerPicker();
      if (!match) return { ok: false, message: "无效的卡牌触发选择" };
      return applyCardTriggerMatch(workingRoot, match);
    }

    function executeFreeMoveForCardTrigger(workingRoot, deltaX, deltaY, rocketId, payment = {}) {
      const { cardState, rocketState, playerState } = requireWorkingRoot(workingRoot);
      const pending = getCardTriggerFreeMove();
      if (!pending) return { ok: false, message: "没有待结算的卡牌免费移动" };

      const moveCheck = rocketActions.canMoveRocket(rocketState, rocketId, deltaX, deltaY);
      if (!moveCheck.ok) {
        rocketState.statusNote = moveCheck.message;
        renderStateReadout();
        return moveCheck;
      }

      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const providedMovePoints = Math.max(
        0,
        Math.round(Number(payment.providedMovePoints ?? pending.match.effect.options?.movementPoints ?? 1) || 0),
      );
      const terrainRequired = Number.isFinite(Number(payment.terrainRequired))
        ? Math.max(1, Math.round(Number(payment.terrainRequired)))
        : getRequiredMovePointsForUi(currentPlayer, rocketId, deltaX, deltaY, pending.match.effect.options || {});
      if (!payment.fromMovePayment && providedMovePoints < terrainRequired) {
        return beginSupplementalMovePayment({
          deltaX,
          deltaY,
          rocketId,
          terrainRequired,
          providedMovePoints,
          context: { type: "card_trigger_free_move", terrainRequired },
          message: `${pending.match.effect.label}：已有 ${providedMovePoints} 点移动力，还需 ${terrainRequired - providedMovePoints} 点（可弃移动牌或用能量）`,
        });
      }

      const energyCost = Math.max(0, Math.round(Number(payment.energyCost) || 0));
      const result = abilities.executeAbility("moveProbe", createActionContext(workingRoot), {
        cost: energyCost > 0 ? { energy: energyCost } : {},
        movementPoints: Math.max(terrainRequired, providedMovePoints + energyCost),
        rocketId,
        deltaX,
        deltaY,
        historyLabel: "卡牌触发：免费移动",
      });
      if (result.rocket) renderRocketElement(result.rocket);
      if (!result.ok) {
        if (payment.discardCommand) payment.discardCommand.undo();
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }

      const moveReward = pending.match.event?.moveReward || null;
      const moveRewardGain = moveReward?.gain || {};
      const moveRewardGainText = Object.keys(moveRewardGain).length
        ? formatPlanetRewardGain(moveRewardGain)
        : "";
      if (Object.keys(moveRewardGain).length) {
        const currentPlayer = getWorkingCurrentPlayer(workingRoot);
        players.gainResources(currentPlayer, moveRewardGain);
        addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.TASK_CARD, moveRewardGain);
      }

      beginQuickActionStep("card-trigger-move", `卡牌触发：${pending.match.effect.label}`);
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        getWorkingCurrentPlayer(workingRoot),
        pending.beforePlayer,
        "恢复卡牌触发前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        cardState,
        pending.beforeCardState.publicCards,
        pending.beforeCardState.discardPile,
      ));
      if (payment.discardCommand) recordQuickHistoryCommand(payment.discardCommand);
      recordAbilityCommands(result, quickActionHistory, workingRoot);
      cardEffects.consumeTrigger(pending.match.card, pending.match.trigger.id);
      discardReservedCardIfFinished(workingRoot, getWorkingCurrentPlayer(workingRoot), pending.match.card);
      completeQuickActionStep();

      setCardTriggerFreeMove(null);
      rocketState.activeRocketId = null;
      clearMoveRocketHighlight();
      deactivateMoveMode();
      rocketState.statusNote = `卡牌触发：${[moveRewardGainText, result.message].filter(Boolean).join("，")}`;
      renderPlayerStats();
      renderPublicCards();
      renderPlayerHand();
      updateActionButtons();
      renderStateReadout();
      settleCardTasksAfterEffect(workingRoot, { events: result.events, render: false });
      continueAfterCardTriggerResolution(workingRoot);
      return result;
    }

    return {
      buildCardTaskContext,
      buildPlayerDataTotals,
      addProbeLocation,
      buildProbeLocationIndex,
      startTemporaryCardTaskRewardFlow,
      getReadyCardTasks,
      refreshCardTaskState,
      cloneType1TriggerEvent,
      enqueueType1TriggerEvents,
      isCardTriggerPickSelectionActive,
      hasActiveCardTriggerResolution,
      isCardTriggerRewardFlowBusy,
      getType1TriggerMatchesForEvent,
      applyType1TriggerMatches,
      continueAfterCardTriggerResolution,
      cancelCardTriggerChoice,
      buildAlienTraceEvent,
      getNebulaColorForCardEvent,
      ensureCardFlowEventBonuses,
      getActiveCardEventBonuses,
      eventMatchesCardBonus,
      getCardEventBonusKey,
      applyCardEventBonusReward,
      applyPublicityMoveFollowupBonus,
      processCardEventBonuses,
      processChongTransportArrivalEvents,
      getChongTransportDestinationCoordinate,
      getChongTransportArrivalEventKey,
      buildChongPositionArrivalEvents,
      settleCardTasksAfterEffect,
      getChongRewardPrimaryIcon,
      createChongTaskEffect,
      buildChongRewardQueueEffects,
      buildChongFossilRewardQueueEffects,
      buildChongTransportCleanupEffect,
      buildChongTaskCompletionEffects,
      getReadyTaskForReservedCard,
      getReadyChongTaskForReservedCard,
      getReadyAmibaTaskForReservedCard,
      getReadyRunezuTaskForReservedCard,
      getRunezuTaskProgressIndexes,
      incrementCompletedTaskCount,
      removeReservedCardToDiscard,
      discardReservedCardIfFinished,
      createCardTriggerProgressSnapshot,
      createCardTriggerProgressCommands,
      consumeCardTriggerWithSnapshot,
      confirmCardTriggerProgress,
      prepareCardTriggerRewardEffects,
      queueCardTriggerRewardEffects,
      getCardTaskCompletionBlockReason,
      openCardTaskCompletionPicker,
      closeCardTaskCompletionPicker,
      confirmCardTaskCompletion,
      openCardTriggerPicker,
      closeCardTriggerPicker,
      applyCardTriggerReward,
      beginCardTriggerFreeMove,
      applyCardTriggerMatch,
      handleCardTriggerChoice,
      executeFreeMoveForCardTrigger,
    };
  }

  return { createCardTriggerRuntime };
});
