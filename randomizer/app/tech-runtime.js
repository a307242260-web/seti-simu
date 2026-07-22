(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppTechRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function createTechRuntime(context = {}) {
    const headless = context.headless === true;
    const {
      Array,
      Boolean,
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      Math,
      Number,
      String,
      actions,
      abilities,
      actionHistory,
      beginCardSelection,
      beginEffectHistoryStep,
      buildPlanetMarkerRemovalChoices,
      buildPlutoMarkerRemovalChoices,
      cancelIndustryAbilityFlow,
      cardEffects,
      cards,
      clearActionEffectFlow,
      clearActionPending,
      clearHistoryStepOrderForSource,
      closeScanTargetPicker,
      completeCurrentActionEffect,
      confirmIndustryTuringBorrow,
      countOwnedTechByType,
      createActionContext,
      decisionSessions,
      document,
      els,
      endEffectHistoryStep,
      finishAutomaticRewardEffect,
      formatPlanetRewardGain,
      getCurrentActionEffect,
      getPlanetName,
      getPlanetSectorCoordinate,
      getCurrentActionIrreversibleReason,
      hasCurrentMainActionIrreversibleBarrier,
      historyCommands,
      industry,
      maybeApplyIndustryLaunchScan,
      normalizeResourceCost,
      planetReferenceLayout,
      planetRewards,
      planetStats,
      players,
      recordAbilityCommands,
      recordHistoryCommand,
      removeActionLogStepsBySource,
      renderActionEffectBar,
      renderPlayerStats,
      renderRocketElement,
      renderRockets,
      renderRotateStateToken,
      renderRunezuBoardSymbols,
      renderSectorNebulaDataBoard,
      renderStateReadout,
      renderWheels,
      removePlutoMarker,
      restoreObjectSnapshot,
      rocketActions,
      runAction,
      setQuickPanelOpen,
      skipActionEffectWithMessage,
      startCardEffectFlow,
      structuredClone,
      syncCardSelectionChrome,
      syncInteractionFocusChrome,
      syncPlanetOrbitLandMarkers,
      syncTechRenderContext,
      tech,
      techRenderContext,
      uiRuntimeState,
      updateActionButtons,
    } = context;
    const decisionState = context.decisionSessions?.createFacade?.({
      actionEffectFlow: "action_effect_flow",
    }) || {};
    const getPiratesRaidDecision = (workingRoot) => requireWorkingRoot(workingRoot).match?.piratesRaidContinuation || null;

    function requireWorkingRoot(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("tech-runtime operation requires an explicit workingRoot");
      }
      return workingRoot;
    }
    const getScanTargetContinuation = (workingRoot) => requireWorkingRoot(workingRoot).match?.scanTargetContinuation || null;
    function setScanTargetContinuation(workingRoot, continuation) {
      const activeRoot = requireWorkingRoot(workingRoot);
      if (!continuation) delete activeRoot.match.scanTargetContinuation;
      else activeRoot.match.scanTargetContinuation = structuredClone(continuation);
    }

    function getWorkingCurrentPlayer(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      return players.getCurrentPlayer(playerState);
    }

    function resolveWorkingPlayerReference(workingRoot, reference = {}) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const options = reference.options || {};
      const playerId = reference.playerId || options.playerId || options.targetPlayerId || reference.id || null;
      if (playerId) {
        const player = (playerState.players || []).find((entry) => entry.id === playerId);
        if (player) return player;
      }
      const playerColor = reference.playerColor || options.playerColor || options.targetPlayerColor || reference.color || null;
      return playerColor
        ? (playerState.players || []).find((entry) => entry.color === playerColor) || null
        : null;
    }

    function getWorkingEffectOwnerPlayer(workingRoot, effect = null) {
      const explicit = resolveWorkingPlayerReference(workingRoot, {
        playerId: effect?.options?.targetPlayerId || effect?.playerId || effect?.options?.playerId,
        playerColor: effect?.options?.targetPlayerColor || effect?.playerColor || effect?.options?.playerColor,
      });
      return explicit
        || resolveWorkingPlayerReference(workingRoot, {
          playerId: decisionState.actionEffectFlow?.defaultPlayerId || decisionState.actionEffectFlow?.playerId,
        })
        || getWorkingCurrentPlayer(workingRoot);
    }

    function getWorkingPendingOwnerFields(workingRoot, effect = null, player = null) {
      const owner = player || getWorkingEffectOwnerPlayer(workingRoot, effect);
      return { playerId: owner?.id || null, playerColor: owner?.color || null };
    }

    function getPlayerOwnerKeys(player) {
      return new Set([player?.id, player?.color].filter(Boolean));
    }

    function markerBelongsToPlayer(marker, player) {
      const keys = getPlayerOwnerKeys(player);
      return keys.has(marker?.playerId) || keys.has(marker?.color) || keys.has(marker?.playerColor);
    }

    function markerOwnerLabel(marker) {
      const definition = players.getPlayerColorDefinition?.(marker?.color || marker?.playerColor);
      return definition?.label || marker?.color || marker?.playerId || "未知玩家";
    }

    function buildWorkingPlanetMarkerRemovalChoices(workingRoot, effect) {
      const { planetStatsState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const owner = effect?.options?.owner || "current";
      const markerKinds = new Set(effect?.options?.markerKinds || ["orbit", "land", "satelliteLand"]);
      const choices = [];
      const canUseMarker = (marker) => owner === "any" || markerBelongsToPlayer(marker, currentPlayer);

      for (const planetId of planetReferenceLayout?.PLANET_ORDER || planetStats?.PLANET_IDS || []) {
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
      return [...choices, ...(buildPlutoMarkerRemovalChoices?.(workingRoot, owner, markerKinds) || [])];
    }

    function removeWorkingPlanetMarker(workingRoot, choice, player, owner = "current") {
      const { planetStatsState } = requireWorkingRoot(workingRoot);
      const markerRef = owner === "any" ? {} : { player };
      if (choice.kind === "plutoOrbit" || choice.kind === "plutoLand") {
        return removePlutoMarker(workingRoot, choice, player, owner);
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
        return planetStats.removeSatelliteLandingMarker(
          planetStatsState,
          choice.planetId,
          choice.satelliteId,
          markerRef,
        );
      }
      return { ok: false, message: "未知标记类型" };
    }

    function isTechActionSelectionActive(workingRoot) {
      const { techGameState } = requireWorkingRoot(workingRoot);
      return Boolean(techGameState.ui.techSelectionActive);
    }

    function isTechTilePickingActive(workingRoot) {
      const { techGameState } = requireWorkingRoot(workingRoot);
      const ui = techGameState.ui;
      return Boolean(ui.techSelectionActive && (!ui.selectedTileId || ui.pendingTileId));
    }

    function isTechAwaitingConfirm() {
      return false;
    }

    function getResearchTechSelectionEffect() {
      if (!decisionState.actionEffectFlow) return null;
      return decisionState.actionEffectFlow.effects.find((effect) => (
        effect.type === "research_tech_select"
        || effect.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH
      )) || null;
    }

    function getResearchTechSelectionPayload() {
      const result = getResearchTechSelectionEffect()?.result;
      return result?.payload || result || null;
    }

    function getResearchTechSelectionOptions() {
      return getResearchTechSelectionEffect()?.options || {};
    }

    function isTechTileOwnedByOtherPlayer(workingRoot, tileId) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      return (playerState.players || []).some((player) => (
        player?.id !== currentPlayer?.id
        && player?.techState?.ownedTiles?.[tileId]
        && !player?.techState?.disabledTiles?.[tileId]
      ));
    }

    function shouldSkipCurrentResearchTechCost() {
      return Boolean(getResearchTechSelectionOptions().skipCost);
    }

    function isGeneratedResearchTechFollowupEffect(effect) {
      if (!effect) return false;
      if (effect.options?.generatedByResearchTech) return true;
      if (String(effect.id || "").startsWith("research-tech-")) return true;
      return [
        "research_tech_take",
        "research_tech_rotate",
        "research_tech_bonus",
      ].includes(effect.type);
    }

    function countOwnedTechByTypeAfterSelection(player, techType, selectResult) {
      const currentCount = countOwnedTechByType(player, techType);
      const tileId = selectResult?.tileId || selectResult?.payload?.tileId || null;
      if (!tileId || player?.techState?.ownedTiles?.[tileId]) return currentCount;
      if (techType && !String(tileId).startsWith(techType)) return currentCount;
      return currentCount + 1;
    }

    function appendResearchTechFollowupEffects(workingRoot, selectResult) {
      requireWorkingRoot(workingRoot);
      if (!decisionState.actionEffectFlow) return;
      const selectionOptions = getResearchTechSelectionOptions();
      const owner = resolveWorkingPlayerReference(workingRoot, getCurrentActionEffect() || {})
        || getWorkingCurrentPlayer(workingRoot);
      const ownerFields = {
        playerId: owner?.id || null,
        playerColor: owner?.color || null,
      };

      const selectIndex = decisionState.actionEffectFlow.effects.findIndex((effect) => (
        effect.type === "research_tech_select"
        || effect.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH
      ));
      const trailingEffects = selectIndex >= 0
        ? decisionState.actionEffectFlow.effects
          .slice(selectIndex + 1)
          .filter((effect) => !isGeneratedResearchTechFollowupEffect(effect))
        : [];
      if (selectIndex >= 0) {
        decisionState.actionEffectFlow.effects.splice(selectIndex + 1);
      }

      const bonusId = selectResult.bonusId ?? selectResult.payload?.bonusId;
      const bonusLabel = tech.BONUS_LABELS[bonusId] || bonusId || "奖励";
      const followups = [];
      const tileId = selectResult.tileId || selectResult.payload?.tileId;
      const techType = selectResult.techType || selectResult.payload?.techType;

      followups.push({
        id: "research-tech-take",
        type: "research_tech_take",
        ...ownerFields,
        abilityId: "researchTechTake",
        icon: "research_tech",
        label: `获得科技片：${tileId}`,
        status: "pending",
        undoable: false,
        options: {
          tileId,
          techType,
          bonusId,
          blueSlot: selectResult.blueSlot ?? selectResult.payload?.blueSlot ?? null,
          firstTake: Boolean(selectResult.firstTake ?? selectResult.payload?.firstTake),
        },
      });

      if (!selectionOptions.skipRotate) {
        followups.push({
          id: "research-tech-rotate",
          type: "research_tech_rotate",
          ...ownerFields,
          abilityId: "researchTechRotate",
          icon: "rotate",
          label: "旋转",
          status: "pending",
          undoable: false,
        });
      }

      if (selectResult.tileId === "orange1") {
        followups.push({
          ...planetRewards.launchEffect({ skipCost: true, source: "tech" }),
          id: "research-tech-launch",
          ...ownerFields,
          status: "pending",
          undoable: true,
        });
      }

      if (!selectionOptions.skipBonus) {
        followups.push({
          id: "research-tech-bonus",
          type: "research_tech_bonus",
          ...ownerFields,
          abilityId: "researchTechBonus",
          icon: bonusId,
          label: `获取${bonusLabel}`,
          status: "pending",
          undoable: false,
          options: {
            tileId: selectResult.tileId,
            bonusId,
            firstTake: Boolean(selectResult.firstTake),
          },
        });
      }

      if (!selectionOptions.skipBonus && selectionOptions.afterResearchReward?.kind === "repeatBonus") {
        followups.push({
          id: "research-tech-bonus-repeat",
          type: "research_tech_bonus",
          ...ownerFields,
          abilityId: "researchTechBonus",
          icon: bonusId,
          label: `再次获取${bonusLabel}`,
          status: "pending",
          undoable: false,
          options: {
            tileId: selectResult.tileId,
            bonusId,
            firstTake: Boolean(selectResult.firstTake),
          },
        });
      }

      if (selectResult.tileId === "purple1") {
        followups.push({
          ...planetRewards.dataEffect(2),
          id: "research-tech-data",
          ...ownerFields,
          status: "pending",
          undoable: true,
        });
      }

      if (selectionOptions.afterResearchReward?.kind === "techTypeCountScore") {
        const currentPlayer = getWorkingCurrentPlayer(workingRoot);
        const scorePer = Math.max(0, Math.round(Number(selectionOptions.afterResearchReward.scorePer) || 1));
        const count = countOwnedTechByTypeAfterSelection(currentPlayer, techType, selectResult);
        followups.push({
          id: "research-tech-type-score",
          type: planetRewards.EFFECT_TYPES.GAIN_RESOURCES,
          ...ownerFields,
          icon: "score",
          label: `同色科技得分：${count * scorePer}分`,
          status: "pending",
          undoable: true,
          options: { gain: { score: count * scorePer } },
        });
      }

      if (selectionOptions.afterResearchReward?.kind === "resourceValueScore") {
        const currentPlayer = getWorkingCurrentPlayer(workingRoot);
        const resource = selectionOptions.afterResearchReward.resource || "publicity";
        const score = Math.max(0, Math.round(Number(currentPlayer?.resources?.[resource]) || 0));
        followups.push({
          id: "research-tech-resource-score",
          type: planetRewards.EFFECT_TYPES.GAIN_RESOURCES,
          ...ownerFields,
          icon: "score",
          label: `资源得分：${score}分`,
          status: "pending",
          undoable: true,
          options: { gain: { score } },
        });
      }

      if (selectionOptions.afterResearchReward?.kind === "publicityIfNotFirstTake" && !selectResult.firstTake) {
        const publicity = Math.max(0, Math.round(Number(selectionOptions.afterResearchReward.publicity) || 0));
        followups.push({
          id: "research-tech-shared-publicity",
          type: planetRewards.EFFECT_TYPES.GAIN_RESOURCES,
          ...ownerFields,
          icon: "publicity",
          label: `非首次拿取科技：${publicity}宣传`,
          status: "pending",
          undoable: true,
          options: { gain: { publicity } },
        });
      }

      const heliosEffect = industry?.buildHeliosPassiveRewardEffect?.(
        getWorkingCurrentPlayer(workingRoot),
        techType,
        selectResult.tileId || selectResult.payload?.tileId,
      );
      if (heliosEffect) {
        heliosEffect.playerId = heliosEffect.playerId || ownerFields.playerId;
        heliosEffect.playerColor = heliosEffect.playerColor || ownerFields.playerColor;
        followups.push(heliosEffect);
      }

      decisionState.actionEffectFlow.effects.push(
        ...followups.map((effect) => ({
          ...effect,
          options: {
            ...(effect.options || {}),
            generatedByResearchTech: true,
          },
        })),
        ...trailingEffects,
      );
    }

    function onTechTileSelected(workingRoot, result) {
      appendResearchTechFollowupEffects(workingRoot, result);
      syncTechSelectionChrome(workingRoot);
      renderTechBoard(workingRoot);
      renderActionEffectBar();
      updateActionButtons();
    }

    function onTechTileTaken(workingRoot, result) {
      const player = getWorkingCurrentPlayer(workingRoot);
      if (industry?.shouldApplyTuringBlueTechPublicity?.(player, result.tileId)) {
        players.gainResources(player, { publicity: industry.getTuringBlueTechPublicityGain() });
        result.message = `${result.message}；图灵系统蓝色科技 +${industry.getTuringBlueTechPublicityGain()} 宣传`;
      }
      const techType = result.techType || result.payload?.techType || String(result.tileId || "").match(/^(orange|purple|blue)/)?.[1] || null;
      const techEvent = techType
        ? {
          type: "researchTech",
          techType,
          tileId: result.tileId || result.payload?.tileId,
          firstTake: Boolean(result.firstTake),
          playerId: player?.id || null,
        }
        : null;
      if (techEvent) {
        result.events = [...(result.events || []), techEvent];
      }
      syncTechSelectionChrome(workingRoot);
      renderTechBoard(workingRoot);
      renderActionEffectBar();
      updateActionButtons();
    }

    function syncTechSelectionChrome(workingRoot) {
      const { techGameState } = requireWorkingRoot(workingRoot);
      const active = isTechTilePickingActive(workingRoot) || Boolean(techGameState.ui?.industryBorrowMode);
      els.appWrap?.classList.toggle("tech-selection-active", active);
      if (els.techSelectionBackdrop) {
        els.techSelectionBackdrop.hidden = !active;
        els.techSelectionBackdrop.setAttribute("aria-hidden", String(!active));
      }
      if (els.techSelectionCancel) {
        els.techSelectionCancel.hidden = !active;
      }
      if (els.techPanel) {
        els.techPanel.classList.toggle("tech-panel-focused", active);
      }
      if (active) setQuickPanelOpen(false);
      syncInteractionFocusChrome();
    }

    function clearResearchTechSelectionState(workingRoot) {
      const { techGameState } = requireWorkingRoot(workingRoot);
      tech.setTechSelectionActive(techGameState, false);
      tech.cancelPendingTake(techGameState);
      techGameState.ui.selectedTileId = null;
      techGameState.ui.selectedBlueSlot = null;
      techGameState.ui.allowedTechTypes = null;
      closeTechBlueSlotPicker(workingRoot);
      techGameState.ui.statusNote = "";
      syncTechSelectionChrome(workingRoot);
      renderTechBoard(workingRoot);
    }

    function restoreResearchTechSelectionAfterUndo(workingRoot, effect) {
      const { rocketState, techGameState } = requireWorkingRoot(workingRoot);
      const selectIndex = decisionState.actionEffectFlow?.effects?.indexOf(effect) ?? -1;
      if (selectIndex >= 0) {
        const trailingEffects = decisionState.actionEffectFlow.effects
          .slice(selectIndex + 1)
          .filter((item) => !isGeneratedResearchTechFollowupEffect(item));
        decisionState.actionEffectFlow.effects.splice(selectIndex + 1, decisionState.actionEffectFlow.effects.length, ...trailingEffects);
      }
      tech.setTechSelectionActive(techGameState, true);
      techGameState.ui.pendingTileId = null;
      techGameState.ui.selectedTileId = null;
      techGameState.ui.selectedBlueSlot = null;
      if (Array.isArray(effect?.options?.allowedTechTypes)) {
        techGameState.ui.allowedTechTypes = [...effect.options.allowedTechTypes];
      }
      closeTechBlueSlotPicker(workingRoot);
      techGameState.ui.statusNote = "请选择要研究的科技板块";
      rocketState.statusNote = "科技：请选择要研究的科技片";
      syncTechSelectionChrome(workingRoot);
      renderTechBoard(workingRoot);
    }

    function cancelPendingResearchTechTileChoice(workingRoot) {
      const { rocketState, techGameState } = requireWorkingRoot(workingRoot);
      techGameState.ui.pendingTileId = null;
      techGameState.ui.selectedTileId = null;
      techGameState.ui.selectedBlueSlot = null;
      closeTechBlueSlotPicker(workingRoot);
      techGameState.ui.statusNote = "请选择要研究的科技板块";
      rocketState.statusNote = "科技：请选择要研究的科技片";
      syncTechSelectionChrome(workingRoot);
      renderTechBoard(workingRoot);
      updateActionButtons();
      renderStateReadout();
    }

    function cancelTechSelection(workingRoot) {
      const { rocketState, techGameState } = requireWorkingRoot(workingRoot);
      if (techGameState.ui.industryBorrowMode) {
        techGameState.ui.industryBorrowMode = false;
        tech.setTechSelectionActive(techGameState, false);
        techGameState.ui.statusNote = "";
        cancelIndustryAbilityFlow();
        rocketState.statusNote = "已取消图灵系统科技借用";
        syncTechSelectionChrome(workingRoot);
        renderStateReadout();
        return;
      }
      if (decisionState.actionEffectFlow?.actionType === "researchTech" && hasCurrentMainActionIrreversibleBarrier()) {
        const irreversibleReason = getCurrentActionIrreversibleReason?.();
        rocketState.statusNote = irreversibleReason
          ? `不可撤销：${irreversibleReason}`
          : "当前科技行动已有不可撤销影响";
        syncTechSelectionChrome(workingRoot);
        renderTechBoard(workingRoot);
        updateActionButtons();
        renderStateReadout();
        return;
      }
      tech.setTechSelectionActive(techGameState, false);
      tech.cancelPendingTake(techGameState);
      techGameState.ui.selectedTileId = null;
      techGameState.ui.selectedBlueSlot = null;
      techGameState.ui.allowedTechTypes = null;
      closeTechBlueSlotPicker(workingRoot);
      techGameState.ui.statusNote = "";
      rocketState.statusNote = "";
      if (decisionState.actionEffectFlow?.actionType === "researchTech") {
        const rollbackResult = actionHistory.rollbackSession();
        if (!rollbackResult.ok) {
          rocketState.statusNote = rollbackResult.message || "当前科技行动不能取消";
          syncTechSelectionChrome(workingRoot);
          renderTechBoard(workingRoot);
          updateActionButtons();
          renderStateReadout();
          return;
        }
        clearHistoryStepOrderForSource(HISTORY_SOURCE_MAIN);
        removeActionLogStepsBySource(HISTORY_SOURCE_MAIN);
        uiRuntimeState.effectStepActive = false;
        clearActionEffectFlow();
      }
      clearActionPending();
      syncTechSelectionChrome(workingRoot);
      renderTechBoard(workingRoot);
      updateActionButtons();
      renderStateReadout();
    }

    function renderTechBoard(workingRoot) {
      const { techGameState } = requireWorkingRoot(workingRoot);
      if (headless) return;
      syncTechRenderContext();
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      tech.renderAll(techGameState, techRenderContext, els.techTiles, {
        currentPlayer,
        canTakeTile: (tileId) => {
          if (!currentPlayer?.techState) return false;
          if (!tech.isSupplySelectionActive(techGameState.ui)) return false;
          if (industry?.isTechBlockedByPirates?.(currentPlayer, tileId)) return false;
          const selectionOptions = getResearchTechSelectionOptions();
          if (selectionOptions.researchedByOthersOnly && !isTechTileOwnedByOtherPlayer(workingRoot, tileId)) return false;
          return tech.resolver.canTakeTile(
            techGameState.board,
            currentPlayer.techState,
            tileId,
            { techTypes: techGameState.ui.allowedTechTypes },
          ).ok;
        },
      });
      syncTechSelectionChrome(workingRoot);
      renderPiratesRaidTechMarkers(workingRoot, currentPlayer);
      renderRunezuBoardSymbols();
    }

    function closeTechBlueSlotPicker(workingRoot) {
      requireWorkingRoot(workingRoot);
      if (!els.techBlueSlotOverlay) return;
      els.techBlueSlotOverlay.hidden = true;
      delete els.techBlueSlotOverlay.dataset.tileId;
      renderTechBoard(workingRoot);
    }

    function openTechBlueSlotPicker(workingRoot, request) {
      const { techGameState } = requireWorkingRoot(workingRoot);
      if (!els.techBlueSlotOverlay || !els.techBlueSlotActions || !els.techBlueSlotSubtitle) return;

      els.techBlueSlotSubtitle.textContent = `将 ${request.tileId} 放到蓝色科技位置`;
      els.techBlueSlotActions.replaceChildren(...request.availableSlots.map((slot) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tech-blue-slot-button";
        button.dataset.blueSlot = String(slot);
        button.textContent = String(slot);
        return button;
      }));
      els.techBlueSlotOverlay.dataset.tileId = request.tileId;
      els.techBlueSlotOverlay.hidden = false;
      techGameState.ui.pendingTileId = request.tileId;
      renderTechBoard(workingRoot);
    }

    function finalizeTechTakeResult(workingRoot, result) {
      const { rocketState, techGameState } = requireWorkingRoot(workingRoot);
      if (!result?.ok || result.needsBlueSlotChoice) return result;

      tech.setTechSelectionActive(techGameState, false);
      closeTechBlueSlotPicker(workingRoot);
      syncTechSelectionChrome(workingRoot);
      renderWheels();
      renderSectorNebulaDataBoard();
      renderRunezuBoardSymbols();
      renderRotateStateToken();
      if (result.freeLaunch?.rocket) renderRocketElement(result.freeLaunch.rocket);
      renderPlayerStats();
      renderTechBoard(workingRoot);
      updateActionButtons();

      if (result.awaitingCardSelection) {
        const selectionResult = beginCardSelection();
        rocketState.statusNote = selectionResult.ok
          ? `${result.message}；${selectionResult.message}`
          : (selectionResult.message || result.message);
      }

      renderStateReadout();
      return result;
    }

    function commitResearchTechSelectionResult(workingRoot, result) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!result?.ok || result.needsBlueSlotChoice) return result;
      rocketState.statusNote = result.message;
      beginEffectHistoryStep(result.message || "选择科技片", { effectType: "research_tech_select" });
      recordAbilityCommands(result, undefined, workingRoot);
      rocketState.statusNote = result.message;
      const current = getCurrentActionEffect();
      if (current) current.result = result;
      onTechTileSelected(workingRoot, result);
      completeCurrentActionEffect();
      renderStateReadout();
      return result;
    }

    function selectResearchTechTileForCurrentFlow(workingRoot, tileId, blueSlot = null) {
      const { rocketState, techGameState } = requireWorkingRoot(workingRoot);
      const options = {
        tileId,
        skipCost: shouldSkipCurrentResearchTechCost(),
      };
      if (actions?.createStandardAdapter) options.selectionOnly = true;
      if (blueSlot != null) options.blueSlot = blueSlot;

      const needsBlueSlotDecision = blueSlot == null && tech.getTechType?.(tileId) === "blue";
      const result = actions?.createStandardAdapter && !needsBlueSlotDecision
        ? context.dispatchStandardIntent?.(
          "research_tech",
          { tileId, ...(blueSlot == null ? {} : { blueSlot }) },
          {
            payload: {
              selectionOnly: true,
              skipCost: Boolean(options.skipCost),
              ...(techGameState.ui.allowedTechTypes
                ? { techTypes: [...techGameState.ui.allowedTechTypes] }
                : {}),
            },
          },
        ) || { ok: false, code: "ENGINE_ACTION_EXECUTOR_REQUIRED", message: "科技行动 executor 未装配" }
        : abilities.executeAbility("researchTechSelect", createActionContext(workingRoot), options);
      if (result.needsBlueSlotChoice) {
        techGameState.ui.pendingTileId = tileId;
        openTechBlueSlotPicker(workingRoot, result);
        renderTechBoard(workingRoot);
        renderStateReadout();
        return result;
      }

      if (!result.ok) {
        techGameState.ui.statusNote = result.message;
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }

      return commitResearchTechSelectionResult(workingRoot, result);
    }

    function confirmTechBlueSlotChoice(workingRoot, blueSlot) {
      const { techGameState } = requireWorkingRoot(workingRoot);
      const tileId = els.techBlueSlotOverlay?.dataset.tileId || techGameState.ui.pendingTileId;
      if (!tileId) return { ok: false, message: "没有待放置的蓝色科技" };

      closeTechBlueSlotPicker(workingRoot);
      return selectResearchTechTileForCurrentFlow(workingRoot, tileId, blueSlot);
    }

    function handleSupplyTechTileClick(workingRoot, tileId) {
      const { rocketState, techGameState } = requireWorkingRoot(workingRoot);
      if (techGameState.ui.industryBorrowMode) {
        return confirmIndustryTuringBorrow(tileId);
      }
      if (!tech.isSupplySelectionActive(techGameState.ui)) return;

      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (currentPlayer?.techState) {
        if (industry?.isTechBlockedByPirates?.(currentPlayer, tileId)) {
          const message = "星际海盗掠夺标记封锁了该科技";
          techGameState.ui.statusNote = message;
          rocketState.statusNote = message;
          renderStateReadout();
          return { ok: false, message };
        }
        const selectionOptions = getResearchTechSelectionOptions();
        if (selectionOptions.researchedByOthersOnly && !isTechTileOwnedByOtherPlayer(workingRoot, tileId)) {
          const message = "这张牌只能选择其他玩家已研究过的科技";
          techGameState.ui.statusNote = message;
          rocketState.statusNote = message;
          renderStateReadout();
          return { ok: false, message };
        }
        const canTake = tech.resolver.canTakeTile(
          techGameState.board,
          currentPlayer.techState,
          tileId,
          { techTypes: techGameState.ui.allowedTechTypes },
        );
        if (!canTake.ok) {
          techGameState.ui.statusNote = canTake.message;
          rocketState.statusNote = canTake.message;
          renderStateReadout();
          return canTake;
        }
      }

      return selectResearchTechTileForCurrentFlow(workingRoot, tileId);
    }

    function isPiratesRaidPlacementActiveForPlayer(workingRoot, player) {
      return Boolean(
        getPiratesRaidDecision(workingRoot)
        && player
        && getPiratesRaidDecision(workingRoot).playerId === player.id,
      );
    }

    function renderPiratesRaidTechMarkers(workingRoot, player) {
      const layer = els.playerBoardTechLayer;
      if (!layer) return;
      layer.querySelectorAll(".pirates-raid-tech-marker-button").forEach((element) => element.remove());
      if (!industry?.shouldShowPiratesRaidMarkers?.(player)) return;

      const active = isPiratesRaidPlacementActiveForPlayer(workingRoot, player);
      const targetPlanetId = getPiratesRaidDecision(workingRoot)?.planetId || null;
      const markerSrc = industry.PIRATES_RAID_MARKER_SRC || "../assets/industry/掠夺标记.png";
      for (const tileId of industry.listPiratesRaidBlockedTechTiles?.(player) || []) {
        const layout = tech.getPlacementLayout?.(tileId);
        if (!layout) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pirates-raid-tech-marker-button";
        button.dataset.piratesRaidTech = tileId;
        button.style.left = `${layout.percentX}%`;
        button.style.top = `${layout.percentY}%`;
        button.style.setProperty("--pirates-raid-tech-scale", String((layout.scalePercent || 36.14) / 100));
        const canPlace = active && industry.canPlacePiratesRaidMarker?.(player, tileId, targetPlanetId)?.ok;
        button.disabled = !canPlace;
        button.title = canPlace
          ? `放置 ${tileId} 掠夺标记到 ${getPlanetName(targetPlanetId)}`
          : `${tileId} 被星际海盗掠夺标记封锁`;
        button.setAttribute("aria-label", button.title);
        button.classList.toggle("is-placeable", canPlace);

        const image = document.createElement("img");
        image.className = "pirates-raid-tech-marker";
        image.src = markerSrc;
        image.alt = "";
        image.decoding = "async";
        image.draggable = false;
        button.append(image);
        layer.append(button);
      }
    }

    function getCurrentPiratesRaidMarkerEffect(workingRoot) {
      const effect = getCurrentActionEffect();
      if (!effect || effect.type !== "industry_pirates_raid_marker" || effect.status !== "active") return null;
      if (getPiratesRaidDecision(workingRoot) && getPiratesRaidDecision(workingRoot).effectId !== effect.id) return null;
      return effect;
    }

    function executeIndustryPiratesRaidMarkerEffect(workingRoot, effect) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const player = getWorkingEffectOwnerPlayer(workingRoot, effect);
      const planetId = effect.options?.planetId || null;
      if (!player || !planetId) {
        rocketState.statusNote = "星际海盗：缺少掠夺目标";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const blocked = industry.listPiratesRaidBlockedTechTiles?.(player) || [];
      if (!blocked.length) {
        return skipActionEffectWithMessage(effect, "星际海盗：没有可放置的掠夺标记，已跳过", {
          reason: "no_pirates_raid_marker",
        });
      }
      workingRoot.match.piratesRaidContinuation = {
        effectId: effect.id,
        playerId: player.id,
        playerColor: player.color,
        planetId,
      };
      rocketState.statusNote = `${effect.label}：请选择玩家面板上的掠夺标记放置到 ${getPlanetName(planetId)}`;
      renderTechBoard(workingRoot);
      syncInteractionFocusChrome();
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: rocketState.statusNote };
    }

    function handlePiratesRaidTechMarkerClick(workingRoot, tileId) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const effect = getCurrentPiratesRaidMarkerEffect(workingRoot);
      const pending = getPiratesRaidDecision(workingRoot);
      if (!effect || !pending) {
        return { ok: false, message: "没有待放置的掠夺标记" };
      }
      const player = resolveWorkingPlayerReference(workingRoot, pending);
      const planetId = pending.planetId;
      const check = industry.canPlacePiratesRaidMarker?.(player, tileId, planetId);
      if (!check?.ok) {
        rocketState.statusNote = check?.message || "无法放置该掠夺标记";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(player);
      const result = industry.placePiratesRaidMarker(player, tileId, planetId);
      if (!result.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复星际海盗掠夺标记放置前玩家状态",
      ));
      delete workingRoot.match.piratesRaidContinuation;
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${tileId} -> ${getPlanetName(planetId)}`,
        payload: { tileId, planetId },
      }, [renderTechBoard, renderRockets]);
    }

    function executeIndustryPiratesRaidPublicityEffect(workingRoot, effect) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const player = getWorkingEffectOwnerPlayer(workingRoot, effect);
      if (!player) {
        rocketState.statusNote = "星际海盗：没有目标玩家";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const gain = effect.options?.gain || { publicity: industry?.PIRATES_RAID_PUBLICITY_GAIN || 3 };
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(player);
      players.gainResources(player, gain);
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复星际海盗宣传奖励前玩家状态",
      ));
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${formatPlanetRewardGain(gain)}`,
        payload: { gain },
      });
    }

    function startIndustryPiratesRaidLaunchFlow(workingRoot, flow, options = {}) {
      const { cardState, rocketState, turnState } = requireWorkingRoot(workingRoot);
      const groupId = `industry-pirates-raid-${turnState.roundNumber}-${turnState.turnNumber}`;
      const nodes = industry?.buildPiratesRaidLaunchEffectNodes?.(flow, { groupId }) || [];
      delete workingRoot.match.industryAbilityContinuation;
      delete workingRoot.match.cardSelectionContinuation;
      uiRuntimeState.publicCardSelectedSlots = [];
      uiRuntimeState.cardSelectionType = null;
      cards.setSelectionActive(cardState, false);
      syncCardSelectionChrome();

      if (!nodes.length) {
        rocketState.statusNote = "星际海盗：没有可结算的掠夺发射效果";
        renderStateReadout();
        return false;
      }

      const preHistoryCommands = [];
      if (options.markerRestoreCommand) preHistoryCommands.push(options.markerRestoreCommand);
      const started = startCardEffectFlow(
        "industry-pirates-raid-launch",
        flow.label || "星际海盗",
        nodes,
        {
          workingRoot,
          actionType: "industryPiratesRaid",
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
          preHistoryCommands,
        },
      );
      if (started) {
        rocketState.statusNote = flow.message || "星际海盗：请选择已有掠夺标记主星上的己方环绕或登陆标记";
        renderActionEffectBar();
        updateActionButtons();
        renderStateReadout();
      }
      return started;
    }

    function buildPiratesRaidLaunchChoices(workingRoot, effect) {
      requireWorkingRoot(workingRoot);
      const player = getWorkingEffectOwnerPlayer(workingRoot, effect);
      return buildWorkingPlanetMarkerRemovalChoices(workingRoot, {
        options: {
          owner: "current",
          markerKinds: ["orbit", "land"],
          ...(effect.options || {}),
        },
      }).filter((choice) => (
        choice.planetId
        && (choice.kind === "orbit" || choice.kind === "land")
        && industry?.canUsePiratesRaidLaunchOnPlanet?.(player, choice.planetId)
      ));
    }

    function executeIndustryPiratesRaidLaunchEffect(workingRoot, effect) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const player = getWorkingEffectOwnerPlayer(workingRoot, effect);
      const cost = normalizeResourceCost(effect.options?.cost || industry?.PIRATES_RAID_ACTIVE_COST || { credits: 1 }) || {};
      if (!players.canAfford(player, cost)) {
        rocketState.statusNote = `星际海盗：资源不足，需要 ${players.formatResourceCost(cost)}`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const choices = buildPiratesRaidLaunchChoices(workingRoot, effect);
      if (!choices.length) {
        rocketState.statusNote = "星际海盗：没有位于已掠夺主星的己方环绕或登陆标记";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      setScanTargetContinuation(workingRoot, { ...getWorkingPendingOwnerFields(workingRoot, effect, player), type: "industry_pirates_raid_launch", effect, choices });
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = effect.label || "星际海盗";
      if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "选择一个已有掠夺标记主星上的己方环绕或登陆标记，移除后消耗 1 信用点并在该星球当前扇区免费发射。";
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      els.scanTargetActions.replaceChildren(...choices.map((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.piratesRaidLaunchChoice = choice.id;
        button.innerHTML = `${choice.label}<small>${choice.description || "己方标记"}；移除并免费发射</small>`;
        return button;
      }));
      els.scanTargetOverlay.hidden = false;
      rocketState.statusNote = `${effect.label}：请选择已有掠夺标记主星上要移除的己方标记`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: rocketState.statusNote };
    }

    function getPiratesRaidLaunchCoordinate(choice) {
      if (choice.kind === "plutoOrbit" || choice.kind === "plutoLand") {
        if (choice.sectorX == null || choice.sectorY == null) return null;
        return { x: choice.sectorX, y: choice.sectorY };
      }
      return getPlanetSectorCoordinate(choice.planetId);
    }

    function handlePiratesRaidLaunchChoice(workingRoot, choiceId) {
      const { planetStatsState, playerState, rocketState } = requireWorkingRoot(workingRoot);
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "industry_pirates_raid_launch") {
        return { ok: false, message: "没有待处理的星际海盗发射" };
      }
      const choice = pending.choices.find((item) => item.id === choiceId);
      const effect = pending.effect;
      closeScanTargetPicker(workingRoot);
      if (!choice) return { ok: false, message: "无效标记" };

      const player = resolveWorkingPlayerReference(workingRoot, pending)
        || getWorkingEffectOwnerPlayer(workingRoot, effect);
      return (() => {
        const cost = normalizeResourceCost(effect.options?.cost || industry?.PIRATES_RAID_ACTIVE_COST || { credits: 1 }) || {};
        if (!players.canAfford(player, cost)) {
          rocketState.statusNote = `星际海盗：资源不足，需要 ${players.formatResourceCost(cost)}`;
          renderStateReadout();
          return { ok: false, message: rocketState.statusNote };
        }
        const coordinate = getPiratesRaidLaunchCoordinate(choice);
        if (!coordinate) {
          rocketState.statusNote = "星际海盗：找不到该星球当前扇区";
          renderStateReadout();
          return { ok: false, message: rocketState.statusNote };
        }

        beginEffectHistoryStep(effect.label);
        const beforePlayer = structuredClone(player);
        const beforePlanetStats = structuredClone(planetStatsState);
        const beforePlayerState = choice.kind === "plutoOrbit" || choice.kind === "plutoLand"
          ? structuredClone(playerState)
          : null;
        const beforeRocketState = structuredClone(rocketState);
        const spend = players.spendResources(player, cost);
        if (!spend.ok) {
          endEffectHistoryStep();
          rocketState.statusNote = spend.message;
          renderStateReadout();
          return spend;
        }
        const remove = removeWorkingPlanetMarker(workingRoot, choice, player, "current");
        if (!remove.ok) {
          restoreObjectSnapshot(player, beforePlayer);
          if (beforePlayerState) restoreObjectSnapshot(playerState, beforePlayerState);
          else restoreObjectSnapshot(planetStatsState, beforePlanetStats);
          endEffectHistoryStep();
          rocketState.statusNote = remove.message;
          renderStateReadout();
          return remove;
        }
        const place = rocketActions.launchRocketAtSector(rocketState, coordinate, {
          playerId: player.id,
          color: player.color,
        });
        if (!place.ok) {
          restoreObjectSnapshot(player, beforePlayer);
          if (beforePlayerState) restoreObjectSnapshot(playerState, beforePlayerState);
          else restoreObjectSnapshot(planetStatsState, beforePlanetStats);
          restoreObjectSnapshot(rocketState, beforeRocketState);
          endEffectHistoryStep();
          rocketState.statusNote = place.message;
          renderStateReadout();
          return place;
        }

        recordHistoryCommand(historyCommands.createRestorePlayerCommand(
          player,
          beforePlayer,
          "恢复星际海盗发射前玩家状态",
        ));
        if (beforePlayerState) {
          recordHistoryCommand(historyCommands.createRestoreObjectCommand(
            playerState,
            beforePlayerState,
            "恢复星际海盗移除冥王星标记前玩家状态",
          ));
        } else {
          recordHistoryCommand(historyCommands.createRestorePlanetStatsCommand(
            planetStatsState,
            beforePlanetStats,
            "恢复星际海盗移除星球标记前状态",
          ));
        }
        recordHistoryCommand(historyCommands.createRestoreRocketStateCommand(
          rocketState,
          beforeRocketState,
          "恢复星际海盗发射前探测器状态",
        ));
        const launchResult = {
          ok: true,
          undoable: true,
          message: place.message,
          commands: [],
          events: [{
            type: "launch",
            playerId: player.id,
            playerColor: player.color,
            source: "industry_pirates_raid",
            rocketId: place.rocket?.id || null,
          }],
          payload: { rocketId: place.rocket?.id || null },
        };
        maybeApplyIndustryLaunchScan(workingRoot, launchResult);
        recordAbilityCommands(launchResult, undefined, workingRoot);
        renderRockets();
        syncPlanetOrbitLandMarkers();
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${effect.label}：移除 ${choice.label}，${launchResult.message}`,
          events: launchResult.events || [],
          payload: { choice, rocketId: place.rocket?.id || null, cost },
        }, [renderRockets]);
      })();
    }

    function setCheatModeOpen(workingRoot, open) {
      const { rocketState, techGameState } = requireWorkingRoot(workingRoot);
      tech.setCheatModeEnabled(techGameState, open);
      els.debugCheatButton?.setAttribute("aria-pressed", String(open));
      rocketState.statusNote = open ? "作弊模式：研究科技不消耗宣传" : "";
      updateActionButtons();
      renderStateReadout();
    }

    function toggleCheatMode(workingRoot) {
      const { techGameState } = requireWorkingRoot(workingRoot);
      setCheatModeOpen(workingRoot, !techGameState.ui.cheatModeEnabled);
    }

    function researchTechForCurrentPlayer() {
      return runAction("researchTech");
    }

    function commitSelectedResearchTech() {
      return { ok: false, message: "科技行动已改为效果链结算" };
    }


    return {
      isTechActionSelectionActive,
      isTechTilePickingActive,
      isTechAwaitingConfirm,
      getResearchTechSelectionEffect,
      getResearchTechSelectionPayload,
      getResearchTechSelectionOptions,
      isTechTileOwnedByOtherPlayer,
      shouldSkipCurrentResearchTechCost,
      isGeneratedResearchTechFollowupEffect,
      countOwnedTechByTypeAfterSelection,
      appendResearchTechFollowupEffects,
      onTechTileSelected,
      onTechTileTaken,
      syncTechSelectionChrome,
      clearResearchTechSelectionState,
      restoreResearchTechSelectionAfterUndo,
      cancelPendingResearchTechTileChoice,
      cancelTechSelection,
      renderTechBoard,
      closeTechBlueSlotPicker,
      openTechBlueSlotPicker,
      finalizeTechTakeResult,
      commitResearchTechSelectionResult,
      selectResearchTechTileForCurrentFlow,
      confirmTechBlueSlotChoice,
      handleSupplyTechTileClick,
      isPiratesRaidPlacementActiveForPlayer,
      renderPiratesRaidTechMarkers,
      getCurrentPiratesRaidMarkerEffect,
      executeIndustryPiratesRaidMarkerEffect,
      handlePiratesRaidTechMarkerClick,
      executeIndustryPiratesRaidPublicityEffect,
      startIndustryPiratesRaidLaunchFlow,
      buildPiratesRaidLaunchChoices,
      executeIndustryPiratesRaidLaunchEffect,
      getPiratesRaidLaunchCoordinate,
      handlePiratesRaidLaunchChoice,
      setCheatModeOpen,
      toggleCheatMode,
      researchTechForCurrentPlayer,
      commitSelectedResearchTech
    };
  }

  return { createTechRuntime };
});
