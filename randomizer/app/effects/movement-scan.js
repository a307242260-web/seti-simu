(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppEffectMovementScanExecutors = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createEffectMovementScanExecutors(context = {}) {
    const {
      INCOME_GAIN_LABELS,
      SCORE_SOURCE_KEYS,
      abilities,
      addPlutoMarker,
      alienGameState,
      aomomo,
      attachScoreSourceToEffects,
      beginEffectHistoryStep,
      beginScanAction4FreeMove,
      buildPlanetRewardEffectsWithIndustry,
      buildPlutoMarkerRemovalChoices,
      buildProbeLocationIndex,
      buildSectorScanChoicesForX,
      buildSectorScanChoicesForXs,
      cardEffects,
      cardState,
      cards,
      claimRunezuPlanetSymbolForTravelResult,
      closeScanAction4Picker,
      closeScanTargetPicker,
      collectPlutoMarkers,
      completeCurrentActionEffect,
      createActionContext,
      data,
      decisionSessions,
      document,
      effectChoiceFlowHelpers,
      els,
      endEffectHistoryStep,
      endGameScoring,
      formatPlutoChoiceLabel,
      getActionResultOwnerPlayer,
      getAomomoCurrentX,
      getCurrentActionEffect,
      getCurrentPlanetActionPlacement,
      getCurrentPlayer,
      getEarthSectorCoordinate,
      getEffectOwnerPlayer,
      getFlowMarkedNebulaIds,
      getPendingOwnerFields,
      getPlanetSectorCoordinate,
      getPlutoActionCost,
      getPlutoActionState,
      getPlutoCandidateRockets,
      getPlutoChoiceActionLabel,
      getPlutoReservedCards,
      getSectorScanTargetLabel,
      historyCommands,
      insertActionEffectsAfterCurrent,
      isActionEffectFlowActive,
      launchRocketForScanAction4,
      maybeCompleteActionEffectFromScan,
      nebulaDataState,
      normalizeResourceCost,
      openLandTargetPicker,
      openScanTargetPicker,
      planetReferenceLayout,
      planetRewards,
      planetStats,
      planetStatsState,
      playerHasOwnPlutoLanding,
      playerState,
      players,
      recordAbilityCommands,
      recordHistoryCommand,
      removePlutoMarker,
      removeRocketElement,
      renderActionEffectBar,
      renderAlienPanels,
      renderPlayerHand,
      renderPlayerStats,
      renderPublicCards,
      renderReservedCardsFromTaskState,
      renderRockets,
      renderStateReadout,
      replaceNebulaDataForCurrentPlayer,
      restoreMutableObject,
      rocketActions,
      rocketState,
      skipActionEffectWithMessage,
      solar,
      syncPlanetOrbitLandMarkers,
      updateActionButtons,
      updatePublicCardControls,
      withEffectExecutionPlayer,
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

    function executeSectorScanAtPlanet(planetId, prefixLabel, effect = null) {
      const cost = effect?.options?.skipCost ? {} : (normalizeResourceCost(effect?.options?.cost) || {});
      if (Object.keys(cost).length && !players.canAfford(getCurrentPlayer(), cost)) {
        const message = `${prefixLabel || "扇区扫描"}：资源不足，需要 ${players.formatResourceCost(cost)}，已跳过`;
        return skipActionEffectWithMessage(effect || getCurrentActionEffect(), message, {
          planetId,
          cost,
        });
      }

      if (planetId === aomomo?.PLANET_ID) {
        if (getAomomoCurrentX() == null) {
          rocketState.statusNote = "奥陌陌星球尚未启用，无法扫描奥陌陌";
          renderStateReadout();
          return { ok: false, message: rocketState.statusNote };
        }
        const result = replaceNebulaDataForCurrentPlayer(aomomo.NEBULA_ID, {
          prefix: prefixLabel || "扫描奥陌陌",
          source: "scan",
          cost,
        });
        if (!result.ok && effect && isActionEffectFlowActive()) {
          return finishAutomaticRewardEffect(effect, {
            ok: true,
            skipped: true,
            undoable: true,
            message: `${prefixLabel || "扫描奥陌陌"}：${result.message || "无法扫描"}，已跳过`,
            payload: { planetId, nebulaId: aomomo.NEBULA_ID, failedMessage: result.message || null },
          });
        }
        maybeCompleteActionEffectFromScan(result);
        return result;
      }

      const sector = getPlanetSectorCoordinate(planetId);
      const choices = buildSectorScanChoicesForX(sector.x).filter((choice) => choice.nebulaId);
      if (!choices.length || choices.every((choice) => choice.disabled)) {
        const planetName = planetId === "earth" ? "地球" : planetId === "mercury" ? "水星" : planetId;
        const message = `${planetName}所在扇区没有可扫描星云，已跳过`;
        const activeEffect = effect || (isActionEffectFlowActive() ? getCurrentActionEffect() : null);
        if (activeEffect) {
          return finishAutomaticRewardEffect(activeEffect, {
            ok: true,
            undoable: true,
            skipped: true,
            message,
            payload: { planetId, sectorX: sector.x, skipped: true },
          });
        }
        rocketState.statusNote = message;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (choices.length > 1) {
        rocketState.statusNote = `${prefixLabel || "扇区扫描"}：请选择要扫描的星云`;
        renderStateReadout();
        return openScanTargetPicker({
          type: "sector_scan",
          fromEffectFlow: isActionEffectFlowActive(),
          effect,
          cost,
          title: prefixLabel || "扇区扫描",
          subtitle: "该 x 坐标同时存在外圈星云与奥陌陌，选择一个目标；满星云会追加扫描计数。",
          choices,
        });
      }

      const result = replaceNebulaDataForCurrentPlayer(choices[0].nebulaId, {
        prefix: prefixLabel || `扇区${sector.x}扫描`,
        source: "scan",
        cost,
      });
      if (!result.ok && effect && isActionEffectFlowActive()) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          undoable: true,
          message: `${prefixLabel || `扇区${sector.x}扫描`}：${result.message || "无法扫描"}，已跳过`,
          payload: {
            planetId,
            nebulaId: choices[0].nebulaId,
            sectorX: sector.x,
            failedMessage: result.message || null,
          },
        });
      }
      maybeCompleteActionEffectFromScan(result);
      return result;
    }

    function executeSectorXScanEffect(effect) {
      const sectorX = solar.mod8(Number(effect.options?.sectorX) || 0);
      const choices = buildSectorScanChoicesForX(sectorX).filter((choice) => choice.nebulaId);
      if (!choices.length || choices.every((choice) => choice.disabled)) {
        if (effect.options?.skipIfNoTarget) {
          return finishAutomaticRewardEffect(effect, {
            ok: true,
            undoable: true,
            message: `${effect.label || `扇区${sectorX}扫描`}：该扇区没有可扫描星云，已跳过`,
            payload: { sectorX, skipped: true },
          });
        }
        rocketState.statusNote = `${effect.label || `扇区${sectorX}扫描`}：该扇区没有可扫描星云`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (choices.length > 1) {
        rocketState.statusNote = `${effect.label || `扇区${sectorX}扫描`}：请选择要扫描的星云`;
        renderStateReadout();
        return openScanTargetPicker({
          type: "sector_scan",
          fromEffectFlow: true,
          title: effect.label || `扇区${sectorX}扫描`,
          subtitle: "该 x 坐标同时存在外圈星云与奥陌陌，选择一个目标；满星云会追加扫描计数。",
          gainData: effect.options?.gainData,
          returnToHandIfSignalCount: effect.options?.returnToHandIfSignalCount,
          choices,
        });
      }
      const result = replaceNebulaDataForCurrentPlayer(choices[0].nebulaId, {
        prefix: effect.label || `扇区${sectorX}扫描`,
        source: "card",
        gainData: effect.options?.gainData,
        sectorX,
      });
      if (result.ok) {
        maybeReturnPlayedCardToHandAfterSectorScan(effect, sectorX);
      }
      maybeCompleteActionEffectFromScan(result);
      return result;
    }

    function countMarkedSignalsInSectorX(sectorX) {
      const choices = buildSectorScanChoicesForX(sectorX).filter((choice) => choice.nebulaId);
      let count = 0;
      for (const choice of choices) {
        const nebulaId = choice.nebulaId;
        count += data.listNebulaTokens(nebulaDataState, nebulaId)
          .filter((token) => token.replacedByPlayerId || token.replacedByPlayerColor || token.playerId || token.playerColor)
          .length;
        if (typeof data.listSectorExtraMarks === "function") {
          count += data.listSectorExtraMarks(nebulaDataState, nebulaId).length;
        }
      }
      return count;
    }

    function maybeReturnPlayedCardToHandAfterSectorScan(effect, sectorX) {
      const targetCount = effect.options?.returnToHandIfSignalCount;
      if (!Number.isFinite(Number(targetCount))) return false;
      if (countMarkedSignalsInSectorX(sectorX) !== Number(targetCount)) return false;
      const returnTarget = resolvePlayedCardReturnTarget(effect);
      const currentPlayer = returnTarget.player;
      if (!currentPlayer || !returnTarget.playedCard) return false;
      const discardIndex = returnTarget.discardIndex;
      if (discardIndex < 0) return false;
      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: cardState.discardPile.slice(),
      };
      const [card] = cardState.discardPile.splice(discardIndex, 1);
      currentPlayer.hand.push(card);
      currentPlayer.resources.handSize = currentPlayer.hand.length;
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复卡牌回手前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        cardState,
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
      rocketState.statusNote = `${rocketState.statusNote}；${cards.getCardLabel(card)} 返回手牌`;
      renderPlayerHand();
      renderPlayerStats();
      return true;
    }

    function getProbeSectorScanRockets(effect) {
      const currentPlayer = getCurrentPlayer();
      const owner = effect.options?.owner || "current";
      return (rocketState.rockets || [])
        .filter((rocket) => owner === "any" || rocket.playerId === currentPlayer?.id)
        .map((rocket) => ({ rocket, sector: rocketActions.getRocketSectorCoordinate(rocket) }))
        .filter((entry) => entry.sector)
        .sort((left, right) => Number(left.rocket.id) - Number(right.rocket.id));
    }

    function buildSectorScanEffectsForProbe(effect, rocket) {
      const sector = rocketActions.getRocketSectorCoordinate(rocket);
      if (!sector) return [];
      const xs = effect.options?.includeAdjacent
        ? [sector.x - 1, sector.x, sector.x + 1].map((x) => solar.mod8(x))
        : [solar.mod8(sector.x)];
      const repeat = Math.max(1, Math.round(Number(effect.options?.repeat) || 1));
      const effects = [];
      for (const sectorX of xs) {
        for (let index = 0; index < repeat; index += 1) {
          const sectorLabel = getSectorScanTargetLabel(sectorX);
          effects.push({
            id: `${effect.id || "probe-sector-scan"}-${rocket.id}-${sectorX}-${index + 1}`,
            type: cardEffects.EFFECT_TYPES.SECTOR_X_SCAN,
            label: `${effect.label}：${sectorLabel}${repeat > 1 ? ` ${index + 1}/${repeat}` : ""}`,
            icon: "scan",
            options: {
              sectorX,
              gainData: effect.options?.gainData,
              returnToHandIfSignalCount: effect.options?.returnToHandIfSignalCount,
            },
          });
        }
      }
      return effects;
    }

    function queueProbeSectorScanEffects(effect, selectedRockets) {
      const scanEffectsToInsert = [];
      for (const rocket of selectedRockets || []) {
        scanEffectsToInsert.push(...buildSectorScanEffectsForProbe(effect, rocket));
      }
      if (!scanEffectsToInsert.length) {
        rocketState.statusNote = `${effect.label}：没有可扫描的探测器扇区`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (scanEffectsToInsert.length === 1) {
        return executeSectorXScanEffect(scanEffectsToInsert[0]);
      }
      insertActionEffectsAfterCurrent(scanEffectsToInsert);
      effect.result = {
        ok: true,
        undoable: true,
        message: `${effect.label}：已追加 ${scanEffectsToInsert.length} 个扇区扫描`,
        payload: { count: scanEffectsToInsert.length },
      };
      rocketState.statusNote = effect.result.message;
      completeCurrentActionEffect();
      renderActionEffectBar();
      renderStateReadout();
      return effect.result;
    }

    function renderProbeSectorScanPicker() {
      const pending = decisionSessions.peek("probe_sector_scan");
      if (!pending || !els.scanTargetActions) return;
      const selected = new Set(pending.selectedRocketIds || []);
      const maxTargets = Math.max(1, Math.round(Number(pending.effect.options?.maxTargets) || 1));
      const buttons = pending.choices.map(({ rocket, sector }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.probeScanRocketId = String(rocket.id);
        const active = selected.has(rocket.id);
        button.classList.toggle("is-selected", active);
        button.innerHTML = `${getSectorScanTargetLabel(sector.x)}<small>${active ? "已选择" : "点击选择该扇区"}</small>`;
        return button;
      });
      if (maxTargets > 1) {
        const confirm = document.createElement("button");
        confirm.type = "button";
        confirm.className = "scan-target-option-button";
        confirm.dataset.probeScanConfirm = "true";
        confirm.disabled = selected.size === 0;
        confirm.innerHTML = `确认扫描<small>已选 ${selected.size}/${maxTargets}</small>`;
        buttons.push(confirm);
      }
      els.scanTargetActions.replaceChildren(...buttons);
    }

    function openProbeSectorScanPicker(effect, choices) {
      if (!els.scanTargetOverlay || !els.scanTargetActions) {
        return { ok: false, message: "无法打开探测器扫描选择" };
      }
      decisionSessions.open("probe_sector_scan", {
        ...getPendingOwnerFields(effect),
        effect,
        choices,
        selectedRocketIds: [],
      });
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = effect.label;
      if (els.scanTargetSubtitle) {
        const maxTargets = Math.max(1, Math.round(Number(effect.options?.maxTargets) || 1));
        els.scanTargetSubtitle.textContent = maxTargets > 1
          ? `最多选择 ${maxTargets} 个探测器。`
          : "选择 1 个探测器扫描其所在扇区。";
      }
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      renderProbeSectorScanPicker();
      els.scanTargetOverlay.hidden = false;
      return { ok: true, message: effect.label };
    }

    function executeProbeSectorScanEffect(effect) {
      return effectChoiceFlowHelpers.executeProbeSectorScanEffect(effect);
    }

    function handleProbeSectorScanChoice(rocketId) {
      return effectChoiceFlowHelpers.handleProbeSectorScanChoice(rocketId);
    }

    function confirmProbeSectorScanSelection() {
      return effectChoiceFlowHelpers.confirmProbeSectorScanSelection();
    }

    function getPlanetName(planetId) {
      return planetRewards?.PLANET_NAMES?.[planetId]
        || solar?.PLANETS?.[planetId]?.name
        || planetId
        || "星球";
    }

    function getPlayerOwnerKeys(player) {
      if (endGameScoring?.getPlayerKeys) return endGameScoring.getPlayerKeys(player);
      return new Set([player?.id, player?.color].filter(Boolean));
    }

    function markerBelongsToPlayer(marker, player) {
      const keys = getPlayerOwnerKeys(player);
      return keys.has(marker?.playerId) || keys.has(marker?.color) || keys.has(marker?.playerColor);
    }

    function playerHasOwnOrbitMarkerAtPlanet(player, planetId) {
      if (planetId === (aomomo?.PLANET_ID || "aomomo") && aomomo?.listOrbitMarkers) {
        const hasAomomoPanelOrbit = aomomo.listOrbitMarkers(alienGameState)
          .some((marker) => markerBelongsToPlayer(marker, player));
        if (hasAomomoPanelOrbit) return true;
      }
      return planetStats.getPlanetOrbitMarkers(planetStatsState, planetId)
        .some((marker) => markerBelongsToPlayer(marker, player));
    }

    function markerOwnerLabel(marker) {
      const definition = players.getPlayerColorDefinition(marker?.color || marker?.playerColor);
      return definition?.label || marker?.color || marker?.playerId || "未知玩家";
    }

    function buildPlanetMarkerRemovalChoices(effect) {
      const currentPlayer = getCurrentPlayer();
      const owner = effect.options?.owner || "current";
      const markerKinds = new Set(effect.options?.markerKinds || ["orbit", "land", "satelliteLand"]);
      const choices = [];
      const canUseMarker = (marker) => owner === "any" || markerBelongsToPlayer(marker, currentPlayer);
      const planetIds = planetReferenceLayout.PLANET_ORDER || planetStats.PLANET_IDS || [];

      for (const planetId of planetIds) {
        const planetName = getPlanetName(planetId);
        if (markerKinds.has("orbit")) {
          for (const marker of planetStats.getPlanetOrbitMarkers(planetStatsState, planetId)) {
            if (!canUseMarker(marker)) continue;
            choices.push({
              id: `orbit:${planetId}:${marker.sequence}`,
              kind: "orbit",
              planetId,
              sequence: marker.sequence,
              label: `${planetName} 环绕 ${marker.sequence}`,
              description: `${markerOwnerLabel(marker)}标记`,
            });
          }
        }
        if (markerKinds.has("land")) {
          for (const marker of planetStats.getPlanetLandingMarkers(planetStatsState, planetId)) {
            if (!canUseMarker(marker)) continue;
            choices.push({
              id: `land:${planetId}:${marker.sequence}`,
              kind: "land",
              planetId,
              sequence: marker.sequence,
              label: `${planetName} 登陆 ${marker.sequence}`,
              description: `${markerOwnerLabel(marker)}标记`,
            });
          }
        }
        if (markerKinds.has("satelliteLand")) {
          for (const marker of planetStats.getSatelliteLandingMarkers(planetStatsState, planetId)) {
            if (!canUseMarker(marker)) continue;
            choices.push({
              id: `satelliteLand:${planetId}:${marker.satelliteId}`,
              kind: "satelliteLand",
              planetId,
              satelliteId: marker.satelliteId,
              label: `${planetName} ${marker.satelliteName || marker.satelliteId}`,
              description: `${markerOwnerLabel(marker)}卫星登陆标记`,
            });
          }
        }
      }

      return [...choices, ...buildPlutoMarkerRemovalChoices(owner, markerKinds)];
    }

    function removePlanetMarkerForChoice(choice, player, owner = "current") {
      const markerRef = owner === "any" ? {} : { player };
      if (choice.kind === "plutoOrbit" || choice.kind === "plutoLand") {
        return removePlutoMarker(choice, player, owner);
      }
      if (choice.kind === "orbit") {
        return planetStats.removePlanetOrbitMarker(planetStatsState, choice.planetId, {
          sequence: choice.sequence,
          ...markerRef,
        });
      }
      if (choice.kind === "land") {
        return planetStats.removePlanetLandingMarker(planetStatsState, choice.planetId, {
          sequence: choice.sequence,
          ...markerRef,
        });
      }
      if (choice.kind === "satelliteLand") {
        return planetStats.removeSatelliteLandingMarker(planetStatsState, choice.planetId, choice.satelliteId, markerRef);
      }
      return { ok: false, message: "未知标记类型" };
    }

    function executeRemovePlanetMarkerChoice(effect, choice) {
      const currentPlayer = getCurrentPlayer();
      beginEffectHistoryStep(effect.label);
      const beforePlanetStats = structuredClone(planetStatsState);
      const beforePlayerState = choice.kind === "plutoOrbit" || choice.kind === "plutoLand"
        ? structuredClone(playerState)
        : null;
      const result = removePlanetMarkerForChoice(choice, currentPlayer, effect.options?.owner || "current");
      if (!result.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = `${effect.label}：${result.message}`;
        renderStateReadout();
        return result;
      }
      if (beforePlayerState) {
        recordHistoryCommand(historyCommands.createRestoreObjectCommand(
          playerState,
          beforePlayerState,
          "恢复移除冥王星标记前玩家状态",
        ));
      } else {
        recordHistoryCommand(historyCommands.createRestorePlanetStatsCommand(
          planetStatsState,
          beforePlanetStats,
          "恢复移除星球标记前状态",
        ));
      }
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${choice.label}`,
        payload: { choice, removedMarker: result.marker },
      }, [syncPlanetOrbitLandMarkers, renderReservedCardsFromTaskState]);
    }

    function openRemovePlanetMarkerPicker(effect) {
      const choices = buildPlanetMarkerRemovalChoices(effect);
      if (!choices.length) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          undoable: true,
          message: `${effect.label}：没有可移除的环绕或登陆标记，已跳过`,
          payload: { markerIds: [] },
        });
      }
      if (choices.length === 1) {
        return executeRemovePlanetMarkerChoice(effect, choices[0]);
      }
      if (!els.scanTargetOverlay || !els.scanTargetActions) {
        decisionState.scanTargetAction = {
          ...getPendingOwnerFields(effect),
          type: "remove_planet_marker",
          effect,
          choices,
        };
        return { ok: true, pendingChoice: true, message: effect.label };
      }
      decisionState.scanTargetAction = {
        ...getPendingOwnerFields(effect),
        type: "remove_planet_marker",
        effect,
        choices,
      };
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = effect.label || "移除环绕或登陆标记";
      if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "选择要移除的己方环绕或登陆标记。";
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      els.scanTargetActions.replaceChildren(...choices.map((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.planetMarkerChoice = choice.id;
        button.innerHTML = `${choice.label}<small>${choice.description}</small>`;
        return button;
      }));
      els.scanTargetOverlay.hidden = false;
      rocketState.statusNote = `${effect.label}：请选择要移除的标记`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: rocketState.statusNote };
    }

    function handleRemovePlanetMarkerChoice(choiceId) {
      const pending = decisionState.scanTargetAction;
      if (pending?.type !== "remove_planet_marker") {
        return { ok: false, message: "没有待移除的星球标记" };
      }
      const choice = (pending.choices || []).find((item) => item.id === choiceId);
      const effect = pending.effect;
      closeScanTargetPicker();
      if (!choice || !effect) return { ok: false, message: "无效标记选择" };
      return withPendingOwnerPlayer(pending, () => executeRemovePlanetMarkerChoice(effect, choice));
    }

    function executeCardLandTarget(effect, target, contextInfo = {}) {
      beginEffectHistoryStep(effect.label);
      const result = abilities.executeAbility("landProbe", createActionContext(), {
        ...(effect.options || {}),
        target,
        source: "card",
        historyLabel: effect.label,
      });
      if (!result.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }
      recordAbilityCommands(result);
      const actionOwner = getActionResultOwnerPlayer(result, getEffectOwnerPlayer(effect));
      claimRunezuPlanetSymbolForTravelResult("land", result, actionOwner);
      if (decisionState.actionEffectFlow) {
        const sector = getPlanetSectorCoordinate(result.planetId);
        decisionState.actionEffectFlow.lastLanding = {
          planetId: result.planetId,
          sectorX: sector.x,
          hadOwnLandingMarker: Boolean(contextInfo.preOwnLandingMarker),
          hadAnyLandingMarker: Boolean(contextInfo.preAnyLandingMarker),
        };
      }
      if (result.removedRocketId != null) removeRocketElement(result.removedRocketId);
      syncPlanetOrbitLandMarkers();
      renderAlienPanels();
      const rewardEffects = effect.options?.grantRewards === false
        ? []
        : buildPlanetRewardEffectsWithIndustry("land", result, {
          player: actionOwner,
          scoreSourceKey: SCORE_SOURCE_KEYS.LAND,
        });
      const afterLandRewards = (effect.options?.afterLandRewards || [])
        .filter((reward) => {
          const planetIds = reward.planetIds || [];
          const planetMatch = !planetIds.length || planetIds.includes(result.planetId);
          const satelliteMatch = reward.includeSatellites && result.markerKind === "satellite";
          return planetMatch || satelliteMatch;
        })
        .map((reward) => reward.effect)
        .filter(Boolean);
      if (afterLandRewards.length) {
        rewardEffects.push(...attachScoreSourceToEffects(afterLandRewards, SCORE_SOURCE_KEYS.LAND));
      }
      if (rewardEffects.length) insertActionEffectsAfterCurrent(rewardEffects);
      effect.result = {
        ...result,
        undoable: true,
        message: rewardEffects.length
          ? `${result.message}；追加 ${rewardEffects.length} 个地点奖励`
          : result.message,
        payload: { ...(result.payload || {}), rewardCount: rewardEffects.length },
      };
      rocketState.statusNote = effect.result.message;
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function executeCardLandEffect(effect) {
      const context = createActionContext();
      const landOptions = abilities.planet.getLandOptions(context, effect.options || {});
      const placement = getCurrentPlanetActionPlacement(context);
      const preferredRocketId = placement?.ok ? placement.rocket?.id : null;
      const pluto = getAvailablePlutoEffectAction("land", effect, { preferredRocketId });
      if (!landOptions.ok && !pluto.ok) {
        return skipActionEffectWithMessage(
          effect,
          `${effect.label || "登陆"}：${landOptions.message || "没有可用登陆目标"}，已跳过`,
          { reason: landOptions.message || null, abilityId: "land" },
        );
      }
      const currentPlayer = getCurrentPlayer();
      const choices = [];
      if (landOptions.ok) {
        choices.push(...landOptions.choices.map((choice) => ({
          ...choice,
          kind: "normal",
          preOwnLandingMarker: effect.options?.rememberPreLandingOwnMarker
            ? playerHasOwnLandingOnPlanet(currentPlayer, choice.planetId || landOptions.planet?.planetId)
            : false,
          preAnyLandingMarker: effect.options?.rememberPreLandingMarker
            ? planetHasAnyLandingOnPlanet(choice.planetId || landOptions.planet?.planetId)
            : false,
        })));
      }
      if (pluto.ok) {
        choices.push({
          kind: "pluto",
          label: formatPlutoChoiceLabel("land", pluto, effect),
          available: pluto,
          preOwnLandingMarker: effect.options?.rememberPreLandingOwnMarker
            ? playerHasOwnLandingOnPlanet(currentPlayer, "pluto")
            : false,
          preAnyLandingMarker: effect.options?.rememberPreLandingMarker
            ? planetHasAnyLandingOnPlanet("pluto")
            : false,
        });
      }
      if (choices.length > 1) {
        return openCardPlutoActionPicker(effect, "land", choices);
      }
      const [choice] = choices;
      if (choice?.kind === "pluto") {
        return executePlutoCardActionEffect(effect, "land", choice.available, {
          preOwnLandingMarker: choice.preOwnLandingMarker,
          preAnyLandingMarker: choice.preAnyLandingMarker,
        });
      }
      return executeCardLandTarget(effect, choice.target, {
        preOwnLandingMarker: choice.preOwnLandingMarker,
        preAnyLandingMarker: choice.preAnyLandingMarker,
      });
    }

    function executeImprovedEarthSectorScanEffect() {
      const earth = getEarthSectorCoordinate();
      const sectorXs = [(earth.x + 7) % 8, earth.x, (earth.x + 1) % 8];
      const choices = buildSectorScanChoicesForXs(sectorXs);
      rocketState.statusNote = "扇区扫描：请选择地球及相邻扇区之一";
      renderStateReadout();
      return openScanTargetPicker({
        type: "sector_scan",
        fromEffectFlow: true,
        title: "扇区扫描",
        subtitle: "地球及左右相邻扇区三选一；无可替换数据时追加扫描计数且不获得数据。",
        choices,
      });
    }

    function handleScanAction4Choice(choiceId) {
      closeScanAction4Picker();

      if (choiceId === "launch") {
        const result = launchRocketForScanAction4();
        rocketState.statusNote = result.ok ? result.message : result.message;
        if (result.ok) {
          renderPlayerStats();
          completeCurrentActionEffect();
        }
        renderStateReadout();
        return result;
      }

      if (choiceId === "move") {
        return beginScanAction4FreeMove();
      }

      if (choiceId === "skip") {
        const effect = getCurrentActionEffect();
        return skipActionEffectWithMessage(effect, `${effect?.label || "发射/移动"}：已跳过`, {
          choice: "skip",
        });
      }

      return { ok: false, message: "未知选择" };
    }

    function formatPlanetRewardGain(gain) {
      return Object.entries(gain || {})
        .filter(([, value]) => Number(value) !== 0)
        .map(([key, value]) => `${INCOME_GAIN_LABELS[key] || (key === "score" ? "分数" : key)}+${value}`)
        .join("、");
    }

    function finishAutomaticRewardEffect(effect, result, renderers = []) {
      effect.result = result;
      rocketState.statusNote = result.message;
      for (const render of renderers) render();
      renderPlayerStats();
      renderPublicCards();
      updatePublicCardControls();
      updateActionButtons();
      completeCurrentActionEffect();
      renderStateReadout();
      return result;
    }

    function playerHasOwnLandingOnPlanet(player, planetId) {
      if (planetId === "pluto") return playerHasOwnPlutoLanding(player);
      if (planetId === (aomomo?.PLANET_ID || "aomomo") && aomomo?.listLandingMarkers) {
        return aomomo.listLandingMarkers(alienGameState)
          .some((marker) => markerBelongsToPlayer(marker, player));
      }
      return planetStats.getPlanetLandingMarkers(planetStatsState, planetId)
        .some((marker) => markerBelongsToPlayer(marker, player));
    }

    function planetHasAnyLandingOnPlanet(planetId) {
      if (planetId === "pluto") {
        return collectPlutoMarkers().some((marker) => marker.kind === "land");
      }
      if (planetId === (aomomo?.PLANET_ID || "aomomo") && aomomo?.listLandingMarkers) {
        return aomomo.listLandingMarkers(alienGameState).length > 0;
      }
      return planetStats.getPlanetLandingMarkers(planetStatsState, planetId).length > 0;
    }

    function getPlutoEffectCost(actionType, card, effect) {
      if (effect.options?.skipCost) return {};
      return getPlutoActionCost(actionType, card);
    }

    function getAvailablePlutoEffectAction(actionType, effect, options = {}) {
      const allowDuplicate = actionType === "land" && Boolean(effect.options?.allowDuplicateLanding);
      const currentPlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
      const card = getPlutoReservedCards(currentPlayer).find((item) => {
        const state = getPlutoActionState(item);
        if (actionType === "orbit") return !state.orbitDone;
        return allowDuplicate || !state.landDone;
      });
      if (!card) return { ok: false, message: "没有可用的冥王星保留牌" };
      const rockets = getPlutoCandidateRockets(currentPlayer, options);
      if (!rockets.length) return { ok: false, message: "没有 y=4 的己方探测器可前往冥王星" };
      const cost = getPlutoEffectCost(actionType, card, effect);
      if (!players.canAfford(currentPlayer, cost)) {
        return { ok: false, message: `资源不足，需要 ${players.formatResourceCost(cost)}` };
      }
      return { ok: true, card, rocket: rockets[0], cost, allowDuplicate };
    }

    function canExecuteNormalCardOrbit(effect, context) {
      return abilities.planet.getOrbitOptions(context, effect.options || {});
    }

    function buildPlutoRewardEffectsForAction(actionType) {
      return actionType === "orbit"
        ? [
          { id: "pluto-orbit-score", type: "gain_resources", label: "冥王星环绕：11分+3宣传", icon: "score", options: { gain: { score: 11, publicity: 3 }, scoreSourceKey: SCORE_SOURCE_KEYS.ORBIT } },
          { id: "pluto-orbit-trace", type: "alien_trace", label: "冥王星环绕：任意外星人痕迹", icon: "alien_trace", options: {} },
        ]
        : [
          { id: "pluto-land-score", type: "gain_resources", label: "冥王星登陆：11分", icon: "score", options: { gain: { score: 11 }, scoreSourceKey: SCORE_SOURCE_KEYS.LAND } },
          { id: "pluto-land-data", type: "gain_data", label: "冥王星登陆：4数据", icon: "data", options: { count: 4 } },
          { id: "pluto-land-trace", type: "alien_trace", label: "冥王星登陆：黄色外星人痕迹", icon: "alien_yellow", options: { allowedTraceTypes: ["yellow"] } },
        ];
    }

    function formatLocationRewardSummary(effects) {
      if (typeof planetRewards?.formatRewardEffectsSummary === "function") {
        return planetRewards.formatRewardEffectsSummary(effects);
      }
      return (effects || [])
        .map((effect) => String(effect?.label || "").trim())
        .filter(Boolean)
        .join("；");
    }

    function getMatchingAfterLandRewardEffects(options = {}, planetId, targetType = "planet") {
      if (!Array.isArray(options.afterLandRewards)) return [];
      return options.afterLandRewards
        .filter((reward) => {
          const planetIds = reward?.planetIds || [];
          const planetMatch = !planetIds.length || planetIds.includes(planetId);
          const satelliteMatch = reward?.includeSatellites && targetType === "satellite";
          return planetMatch || satelliteMatch;
        })
        .map((reward) => reward?.effect)
        .filter(Boolean);
    }

    function buildPlutoChoiceRewardSummary(actionType, effect = null) {
      const rewardEffects = effect?.options?.grantRewards === false
        ? []
        : buildPlutoRewardEffectsForAction(actionType);
      if (actionType === "land") {
        rewardEffects.push(...getMatchingAfterLandRewardEffects(effect?.options || {}, "pluto", "planet"));
      }
      return formatLocationRewardSummary(rewardEffects);
    }

    function executePlutoCardActionEffect(effect, actionType, available, contextInfo = {}) {
      const currentPlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      const beforeRocketState = structuredClone(rocketState);
      const beforeCard = structuredClone(available.card);
      const spendResult = players.spendResources(currentPlayer, available.cost);
      if (!spendResult.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = spendResult.message;
        renderStateReadout();
        return spendResult;
      }
      const removeResult = rocketActions.removeRocket(rocketState, available.rocket.id);
      if (!removeResult.ok) {
        restoreMutableObject(currentPlayer, beforePlayer);
        endEffectHistoryStep();
        rocketState.statusNote = removeResult.message;
        renderStateReadout();
        return removeResult;
      }
      const markerResult = addPlutoMarker(available.card, actionType, currentPlayer, {
        allowDuplicate: available.allowDuplicate,
        rocket: available.rocket,
      });
      if (!markerResult.ok) {
        restoreMutableObject(currentPlayer, beforePlayer);
        restoreMutableObject(rocketState, beforeRocketState);
        endEffectHistoryStep();
        rocketState.statusNote = markerResult.message;
        renderStateReadout();
        return markerResult;
      }
      if (actionType === "orbit") {
        players.incrementPlayerOrbitCount(playerState, currentPlayer.id);
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复冥王星卡牌行动前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreRocketStateCommand(
        rocketState,
        beforeRocketState,
        "恢复冥王星卡牌行动前探测器状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        available.card,
        beforeCard,
        "恢复冥王星卡牌行动前卡牌状态",
      ));
      if (decisionState.actionEffectFlow && actionType === "land") {
        decisionState.actionEffectFlow.lastLanding = {
          planetId: "pluto",
          sectorX: markerResult.marker.sectorX,
          hadOwnLandingMarker: Boolean(contextInfo.preOwnLandingMarker),
          hadAnyLandingMarker: Boolean(contextInfo.preAnyLandingMarker),
        };
      }
      removeRocketElement(available.rocket.id);
      const result = {
        ok: true,
        undoable: true,
        message: `${effect.label}：${actionType === "orbit" ? "环绕" : "登陆"}冥王星，消耗 ${players.formatResourceCost(available.cost) || "0"}，移除 R${available.rocket.id}`,
        events: [{
          type: actionType,
          planetId: "pluto",
          markerKind: actionType === "orbit" ? "pluto-orbit" : "pluto-land",
          playerId: currentPlayer.id,
          playerColor: currentPlayer.color,
          source: "card",
        }],
        removedRocketId: available.rocket.id,
        planetId: "pluto",
        markerKind: actionType === "orbit" ? "pluto-orbit" : "pluto-land",
        markerSequence: markerResult.marker.sequence,
        cost: available.cost,
      };
      const rewardEffects = effect.options?.grantRewards === false
        ? []
        : buildPlutoRewardEffectsForAction(actionType);
      if (actionType === "land") {
        const afterLandRewards = (effect.options?.afterLandRewards || [])
          .filter((reward) => (reward.planetIds || []).includes("pluto"))
          .map((reward) => reward.effect)
          .filter(Boolean);
        if (afterLandRewards.length) {
          rewardEffects.push(...attachScoreSourceToEffects(afterLandRewards, SCORE_SOURCE_KEYS.LAND));
        }
      }
      if (rewardEffects.length) insertActionEffectsAfterCurrent(rewardEffects);
      effect.result = {
        ...result,
        message: rewardEffects.length
          ? `${result.message}；追加 ${rewardEffects.length} 个地点奖励`
          : result.message,
        payload: { ...(result.payload || {}), rewardCount: rewardEffects.length },
      };
      rocketState.statusNote = effect.result.message;
      renderRockets();
      renderReservedCardsFromTaskState();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function executeNormalCardOrbitEffect(effect, choice = null) {
      beginEffectHistoryStep(effect.label);
      const result = abilities.executeAbility("orbitProbe", createActionContext(), {
        ...(effect.options || {}),
        rocketId: choice?.rocketId,
        source: "card",
        historyLabel: effect.label,
      });
      if (!result.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }
      recordAbilityCommands(result);
      const actionOwner = getActionResultOwnerPlayer(result, getEffectOwnerPlayer(effect));
      claimRunezuPlanetSymbolForTravelResult("orbit", result, actionOwner);
      if (result.removedRocketId != null) removeRocketElement(result.removedRocketId);
      syncPlanetOrbitLandMarkers();
      const rewardEffects = effect.options?.grantRewards === false
        ? []
        : buildPlanetRewardEffectsWithIndustry("orbit", result, {
          player: actionOwner,
          scoreSourceKey: SCORE_SOURCE_KEYS.ORBIT,
        });
      if (rewardEffects.length) insertActionEffectsAfterCurrent(rewardEffects);
      effect.result = {
        ...result,
        message: rewardEffects.length ? `${result.message}；追加 ${rewardEffects.length} 个地点奖励` : result.message,
        payload: { ...(result.payload || {}), rewardCount: rewardEffects.length },
      };
      rocketState.statusNote = effect.result.message;
      renderRockets();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function openCardPlutoActionPicker(effect, actionType, choices, options = {}) {
      openLandTargetPicker({
        effect,
        title: `选择${getPlutoChoiceActionLabel(actionType)}目标`,
        selectLabel: `${getPlutoChoiceActionLabel(actionType)}到`,
        confirmText: `确认${getPlutoChoiceActionLabel(actionType)}`,
        planet: { planetId: `card-pluto-${actionType}`, name: `${getPlutoChoiceActionLabel(actionType)}目标` },
        choices,
        getOptions: () => ({ ok: true, choices }),
        onConfirm: (choice) => {
          return withEffectExecutionPlayer(effect, () => {
            if (choice.kind === "pluto") {
              return executePlutoCardActionEffect(effect, actionType, choice.available, {
                preOwnLandingMarker: choice.preOwnLandingMarker,
              });
            }
            if (actionType === "orbit") return executeNormalCardOrbitEffect(effect, choice);
            return executeCardLandTarget(effect, choice.target, {
              preOwnLandingMarker: choice.preOwnLandingMarker,
            });
          });
        },
      });
      rocketState.statusNote = `请选择${getPlutoChoiceActionLabel(actionType)}目标`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: rocketState.statusNote };
    }

    function executeCardOrbitEffect(effect) {
      const context = createActionContext();
      const normal = canExecuteNormalCardOrbit(effect, context);
      const preferredRocketId = normal?.defaultRocketId || null;
      const pluto = getAvailablePlutoEffectAction("orbit", effect, { preferredRocketId });
      if (!normal.ok && !pluto.ok) {
        return skipActionEffectWithMessage(
          effect,
          `${effect.label || "环绕"}：${normal.message || "没有可用环绕目标"}，已跳过`,
          { reason: normal.message || null, abilityId: "orbitProbe" },
        );
      }
      const choices = [];
      if (normal.ok) {
        choices.push(...normal.choices.map((choice) => ({
          ...choice,
          kind: "normal",
        })));
      }
      if (pluto.ok) choices.push({ kind: "pluto", label: formatPlutoChoiceLabel("orbit", pluto, effect), available: pluto });
      if (choices.length > 1) return openCardPlutoActionPicker(effect, "orbit", choices);
      if (!normal.ok && pluto.ok) return executePlutoCardActionEffect(effect, "orbit", pluto);
      if (choices.length === 1 && choices[0].kind === "normal") return executeNormalCardOrbitEffect(effect, choices[0]);
      return executeNormalCardOrbitEffect(effect);
    }

    function returnPlayedCardToHandFromDiscard(effect) {
      const returnTarget = resolvePlayedCardReturnTarget(effect);
      const currentPlayer = returnTarget.player;
      const playedCard = returnTarget.playedCard;
      if (!currentPlayer || !playedCard) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          skipped: true,
          message: `${effect.label}：没有可回手的当前卡牌`,
          payload: { conditionMet: true, returned: false },
        });
      }
      const discardIndex = returnTarget.discardIndex;
      if (discardIndex < 0) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          skipped: true,
          message: `${effect.label}：当前卡牌不在弃牌堆，无法回手`,
          payload: {
            conditionMet: true,
            returned: false,
            cardId: returnTarget.sourceCardId,
            instanceId: returnTarget.sourceInstanceId,
          },
        });
      }
      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };
      beginEffectHistoryStep(effect.label);
      const [card] = cardState.discardPile.splice(discardIndex, 1);
      cards.addCardToHand(currentPlayer, card);
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复卡牌回手前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        cardState,
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${cards.getCardLabel(card)} 返回手牌`,
        payload: { cardId: card.cardId || returnTarget.sourceCardId, instanceId: card.id },
      }, [renderPlayerHand]);
    }

    function resolvePlayedCardReturnTarget(effect) {
      const flow = decisionState.actionEffectFlow || {};
      const playedCard = flow.card || null;
      const sourceInstanceId = playedCard?.id || flow.playCardEvent?.sourceCardInstanceId || null;
      const sourceCardId = playedCard?.cardId || flow.playCardEvent?.cardId || null;
      const discardPile = cardState.discardPile || [];
      let discardIndex = -1;

      if (sourceInstanceId) {
        discardIndex = discardPile.findIndex((card) => card?.id === sourceInstanceId);
      }
      if (discardIndex < 0 && playedCard) {
        discardIndex = discardPile.findIndex((card) => card === playedCard);
      }
      if (discardIndex < 0 && sourceCardId) {
        for (let index = discardPile.length - 1; index >= 0; index -= 1) {
          if (discardPile[index]?.cardId === sourceCardId) {
            discardIndex = index;
            break;
          }
        }
      }
      const resolvedPlayedCard = playedCard || (discardIndex >= 0 ? discardPile[discardIndex] : null);

      return {
        player: getEffectOwnerPlayer(effect),
        playedCard: resolvedPlayedCard,
        discardIndex,
        sourceInstanceId,
        sourceCardId,
      };
    }

    function runtimeProbeAdjacentEarth(player) {
      const earth = getEarthSectorCoordinate();
      return (rocketState.rockets || []).some((rocket) => {
        if (rocket.playerId !== player?.id) return false;
        const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
        if (!earth || !coordinate) return false;
        const dx = Math.min(
          Math.abs(solar.mod8(coordinate.x - earth.x)),
          8 - Math.abs(solar.mod8(coordinate.x - earth.x)),
        );
        return (Number(coordinate.y) === Number(earth.y) && dx === 1)
          || (Number(coordinate.x) === Number(earth.x) && Number(coordinate.y) === Number(earth.y) + 1);
      });
    }

    function runtimeOtherProbeAtPlanet(player, planetId) {
      const coordinate = getPlanetSectorCoordinate(planetId);
      return (rocketState.rockets || []).some((rocket) => {
        if (rocket.playerId === player?.id) return false;
        const rocketCoordinate = rocketActions.getRocketSectorCoordinate(rocket);
        return rocketCoordinate
          && Number(rocketCoordinate.x) === Number(coordinate.x)
          && Number(rocketCoordinate.y) === Number(coordinate.y);
      });
    }

    function isRuntimeCardConditionMet(condition) {
      if (!condition) return false;
      const currentPlayer = getCurrentPlayer();
      if (condition.type === "resourceThreshold") {
        return (Number(currentPlayer?.resources?.[condition.resource]) || 0) >= Number(condition.count || 1);
      }
      if (condition.type === "resourceEquals") {
        return (Number(currentPlayer?.resources?.[condition.resource]) || 0) === Number(condition.count || 0);
      }
      if (condition.type === "handEmpty") {
        return (currentPlayer?.hand || []).length === 0;
      }
      if (condition.type === "lastLandingHadOwnMarker") {
        return Boolean(decisionState.actionEffectFlow?.lastLanding?.hadOwnLandingMarker);
      }
      if (condition.type === "lastLandingHadAnyMarker") {
        return Boolean(decisionState.actionEffectFlow?.lastLanding?.hadAnyLandingMarker);
      }
      if (condition.type === "flowMarkedNebula") {
        const markedNebulaIds = getFlowMarkedNebulaIds(decisionState.actionEffectFlow);
        const requiredNebulaIds = condition.nebulaIds || condition.includeNebulaIds || [condition.nebulaId];
        return requiredNebulaIds.filter(Boolean).some((nebulaId) => markedNebulaIds.has(String(nebulaId)));
      }
      if (condition.type === "probeAdjacentEarth") {
        return runtimeProbeAdjacentEarth(currentPlayer);
      }
      if (condition.type === "otherProbeAtPlanet") {
        return runtimeOtherProbeAtPlanet(currentPlayer, condition.planetId);
      }
      if (condition.type === "probeLocation") {
        const probeLocationData = buildProbeLocationIndex();
        return [currentPlayer?.id, currentPlayer?.color]
          .filter(Boolean)
          .some((key) => (probeLocationData.index?.[key] || []).includes(condition.locationType));
      }
      return false;
    }

    function executeReturnPlayedCardToHandIfEffect(effect) {
      const met = isRuntimeCardConditionMet(effect.options?.condition);
      if (!met) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${effect.label}：条件未满足`,
          payload: { conditionMet: false },
        });
      }
      return returnPlayedCardToHandFromDiscard(effect);
    }

    function countHandCornerKinds(player) {
      const counts = { publicity: 0, data: 0, move: 0 };
      for (const card of player?.hand || []) {
        const resourceReward = cards.getDiscardActionRewardForCard(card);
        const moveReward = cards.getDiscardActionMoveRewardForCard?.(card);
        if (moveReward) {
          counts.move += 1;
        } else if (Math.max(0, Math.round(Number(resourceReward?.dataCount) || 0)) > 0) {
          counts.data += 1;
        } else if (resourceReward?.gain?.publicity) {
          counts.publicity += 1;
        }
      }
      return counts;
    }

    function executeChooseHandCornerRewardEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const counts = countHandCornerKinds(currentPlayer);
      if (!els.scanTargetOverlay || !els.scanTargetActions) {
        return applyHandCornerChoice(effect, "publicity");
      }
      decisionState.scanTargetAction = { ...getPendingOwnerFields(effect), type: "hand_corner_reward", effect, counts };
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = effect.label;
      if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "选择一种左上角快速行动类别，按当前手牌数量获得对应奖励。";
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      const specs = [
        ["publicity", "宣传", `${counts.publicity} 宣传`],
        ["data", "数据", `${counts.data} 数据`],
        ["move", "移动", `${counts.move} 移动`],
      ];
      els.scanTargetActions.replaceChildren(...specs.map(([choice, label, detail]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.handCornerChoice = choice;
        button.disabled = counts[choice] <= 0;
        button.innerHTML = `${label}<small>${detail}</small>`;
        return button;
      }));
      els.scanTargetOverlay.hidden = false;
      rocketState.statusNote = `${effect.label}：请选择奖励类别`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: rocketState.statusNote };
    }

    function applyHandCornerChoice(effect, choice) {
      const currentPlayer = getCurrentPlayer();
      const counts = countHandCornerKinds(currentPlayer);
      const count = Math.max(0, counts[choice] || 0);
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      const dataResults = [];
      if (choice === "publicity" && count > 0) {
        players.gainResources(currentPlayer, { publicity: count });
      } else if (choice === "data") {
        for (let index = 0; index < count; index += 1) {
          dataResults.push(data.gainData(currentPlayer, { source: "hand_corner_choice" }));
        }
      } else if (choice === "move" && count > 0) {
        insertActionEffectsAfterCurrent([{
          id: `${effect.id || "hand-corner"}-move`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: `${effect.label}：${count}移动`,
          icon: "movement",
          options: { movementPoints: count, historyLabel: effect.label },
        }]);
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复按手牌角标奖励前玩家状态",
      ));
      const message = choice === "move"
        ? `${effect.label}：追加 ${count} 移动`
        : choice === "data"
          ? `${effect.label}：获得 ${dataResults.filter((item) => item.ok).length}/${count} 数据`
          : `${effect.label}：获得 ${count} 宣传`;
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message,
        payload: { choice, count },
      }, [renderPlayerHand]);
    }

    function handleHandCornerChoice(choice) {
      const pending = decisionState.scanTargetAction;
      if (pending?.type !== "hand_corner_reward") return { ok: false, message: "没有待处理的手牌角标奖励" };
      const effect = pending.effect;
      closeScanTargetPicker();
      return withPendingOwnerPlayer(pending, () => applyHandCornerChoice(effect, choice));
    }

    function executeLandingSectorScanEffect(effect) {
      const sectorX = decisionState.actionEffectFlow?.lastLanding?.sectorX;
      if (sectorX == null) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          message: `${effect.label}：本卡尚未记录登陆扇区，已跳过`,
        });
      }
      const repeat = Math.max(1, Math.round(Number(effect.options?.repeat || 1)));
      const followups = [];
      for (let index = 0; index < repeat; index += 1) {
        followups.push({
          id: `${effect.id || "landing-sector-scan"}-${index + 1}`,
          type: cardEffects.EFFECT_TYPES.SECTOR_X_SCAN,
          label: `${effect.label}${repeat > 1 ? ` ${index + 1}/${repeat}` : ""}`,
          icon: "scan",
          options: { sectorX, gainData: effect.options?.gainData, skipIfNoTarget: true },
        });
      }
      insertActionEffectsAfterCurrent(followups);
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：已追加 ${followups.length} 次扇区${sectorX}扫描`,
        payload: { sectorX, count: followups.length },
      });
    }

    return {
      executeSectorScanAtPlanet,
      executeSectorXScanEffect,
      countMarkedSignalsInSectorX,
      maybeReturnPlayedCardToHandAfterSectorScan,
      getProbeSectorScanRockets,
      buildSectorScanEffectsForProbe,
      queueProbeSectorScanEffects,
      renderProbeSectorScanPicker,
      openProbeSectorScanPicker,
      executeProbeSectorScanEffect,
      handleProbeSectorScanChoice,
      confirmProbeSectorScanSelection,
      getPlanetName,
      getPlayerOwnerKeys,
      markerBelongsToPlayer,
      playerHasOwnOrbitMarkerAtPlanet,
      markerOwnerLabel,
      buildPlanetMarkerRemovalChoices,
      removePlanetMarkerForChoice,
      executeRemovePlanetMarkerChoice,
      openRemovePlanetMarkerPicker,
      handleRemovePlanetMarkerChoice,
      executeCardLandTarget,
      executeCardLandEffect,
      executeImprovedEarthSectorScanEffect,
      handleScanAction4Choice,
      formatPlanetRewardGain,
      finishAutomaticRewardEffect,
      playerHasOwnLandingOnPlanet,
      planetHasAnyLandingOnPlanet,
      getPlutoEffectCost,
      getAvailablePlutoEffectAction,
      canExecuteNormalCardOrbit,
      buildPlutoRewardEffectsForAction,
      formatLocationRewardSummary,
      getMatchingAfterLandRewardEffects,
      buildPlutoChoiceRewardSummary,
      executePlutoCardActionEffect,
      executeNormalCardOrbitEffect,
      openCardPlutoActionPicker,
      executeCardOrbitEffect,
      returnPlayedCardToHandFromDiscard,
      resolvePlayedCardReturnTarget,
      runtimeProbeAdjacentEarth,
      runtimeOtherProbeAtPlanet,
      isRuntimeCardConditionMet,
      executeReturnPlayedCardToHandIfEffect,
      countHandCornerKinds,
      executeChooseHandCornerRewardEffect,
      applyHandCornerChoice,
      handleHandCornerChoice,
      executeLandingSectorScanEffect,
    };
  }

  return { createEffectMovementScanExecutors };
});
