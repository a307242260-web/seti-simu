(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiConditionalDecisionDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createConditionalPlayerResolver(context = {}) {
    return function getConditionalPlayer(workingRoot, pending) {
      return context.resolvePlayerReference(workingRoot, {
        playerId: pending?.playerId || pending?.targetPlayerId || null,
        playerColor: pending?.playerColor || pending?.targetPlayerColor || null,
      }) || context.getEffectOwnerPlayer(workingRoot, pending?.effect) || context.getCurrentPlayer(workingRoot);
    };
  }

  function createResolvedConditionalDecisionDomain(context) {
    const {
      finalScoring,
      FINAL_SCORE_IDS,
      getCurrentPlayer,
      getPendingProbeSectorScanDecision,
      getPendingProbeLocationRewardDecision,
      getPendingYichangdianCornerAction,
      getPendingYichangdianCornerCards,
      getSimulationConditionalPlayer,
      getPendingChongFossilChoice,
      getPendingAmibaSymbolChoice,
      getPendingRunezuSymbolBranch,
      getPendingRunezuFaceSymbolPlacement,
      getPendingRunezuCardGain,
      getPendingAmibaCardGain,
      getPendingAomomoCardGain,
      getPendingYichangdianCardGain,
      getPendingBanrenmaCardGain,
      getPendingChongCardGain,
      getPendingAmibaTraceRemoval,
      getPendingJiuzheCardPlay,
      getPendingBanrenmaOpportunity,
      getPlayerById,
      cards,
      players,
      getPublicScanChoicesForCard,
      getPendingPassReserveSelection,
      getPassReserveSelectionCards,
      isMovePaymentCard,
      isTechTilePickingActive,
      tech,
      industry,
      getResearchTechSelectionOptions,
      isTechTileOwnedByOtherPlayer,
      isActionEffectFlowActive,
      skipCurrentActionEffect,
      data,
      getMovableTokensForPlayer,
      rocketActions,
      getRequiredMovePointsForUi,
      canPayForMove,
      formatRocketLabel,
      getEffectOwnerPlayer,
      getCurrentActionEffect,
      getMovableTokensForCardMoveEffect,
      validateIndustryHuanyuMoveRocket,
      isFutureSpanEligibleHandCard,
      getPublicCardMultiSelectMinSelectable,
      getPublicScanMinSelectable,
      getPublicCardSelectedSlots,
      allowsBlindDrawInSelection,
      canBlindDraw,
      getAlienTracePickerState,
      openPendingDecision,
      abilities,
      createActionContext,
      getFangzhouUnlockableTraceTypes,
      hasAlienTracePanelPlacementTarget,
      getAlienTraceChoiceSlotIds,
      canPlaceStateTrace,
      aliens,
      handleConditionalSectorChoice,
      handleChongFossilChoice,
      confirmProbeSectorScanSelection,
      handleProbeLocationRewardChoice,
      handleRunezuSymbolBranchChoice,
      handleRunezuFaceSymbolChoice,
      handleAmibaSymbolChoice,
      handleYichangdianCornerChoice,
      handleRunezuCardGainChoice,
      handleAmibaCardGainChoice,
      handleAomomoCardGainChoice,
      handleYichangdianCardGainChoice,
      handleBanrenmaCardGainChoice,
      handleChongCardGainChoice,
      handleAmibaTraceRemovalChoice,
      handleJiuzheCardChoice,
      handleJiuzheOpportunitySkip,
      handleBanrenmaBonusChoice,
      handleBanrenmaCardConditionChoice,
      handleFinalScoreTileClick,
      handleSupplyTechTileClick,
      confirmIndustryTuringBorrow,
      cancelIndustryAbilityFlow,
      confirmTechBlueSlotChoice,
      cancelTechSelection,
      handleFangzhouTraceDestinationChoice,
      handleFangzhouUnlockTraceChoice,
      handleDiscardCornerRepeatChoice,
      handleReturnUnfinishedTaskChoice,
      handleRemoveOrbitToProbeChoice,
      handleRemovePlanetMarkerChoice,
      confirmDataPlacement,
      skipPendingDataPlacement,
      handleDiscardIncomeCardChoice,
      confirmDiscardAnyForIncome,
      handlePayCreditChoice,
      handleFundamentalismExchangeChoice,
      handleOptionalHandScanChoice,
      handleHandCornerChoice,
      handlePiratesRaidLaunchChoice,
      handlePiratesRaidTechMarkerClick,
      confirmScanTarget,
      handleDrawnHandScanSkip,
      confirmPassReserveSelection,
      handleCardTriggerChoice,
      cancelCardTriggerChoice,
      confirmCardTaskCompletion,
      handleHandScanCardClick,
      resolveCardMoveDirectionDecision,
      handleScanAction4Choice,
      executeFreeMoveForCardTrigger,
      restoreObjectSnapshot,
      clearMoveRocketHighlight,
      deactivateMoveMode,
      continueAfterCardTriggerResolution,
      finishCurrentCardMoveEffectEarly,
      executeFreeMoveForCardCorner,
      executeIndustryFreeMove,
      settleCardTasksAfterEffect,
      finishIndustryAbilityFlow,
      resolveMovePaymentDecision,
      confirmStrategyPassiveSlotChoice,
      cancelStrategyPassiveSlotChoice,
      finalizePendingDiscardSelection,
      cancelDiscardSelection,
      handlePublicCardClick,
      confirmPublicCornerDiscardSelection,
      confirmPublicScanSelection,
      handleIndustryDeepspaceHandClick,
      handleIndustryFutureSpanHandClick,
      drawCardForCurrentPlayer,
      confirmLandTargetChoice,
      cancelLandTargetChoice,
      finishCurrentTurnAfterAlienReveal,
      handleStateTraceSlotPlacement,
    } = context;

  function enumerateSimulationMovePaymentActions(workingRoot, movePending) {
    const player = (workingRoot.playerState?.players || []).find((entry) => entry.id === movePending.playerId)
      || getSimulationConditionalPlayer(workingRoot, movePending);
    const required = Math.max(0, Math.round(Number(movePending.requiredMovePoints) || 0));
    const moveCardIndexes = (player?.hand || []).flatMap((card, handIndex) => (
      isMovePaymentCard(card) ? [handIndex] : []
    ));
    const subsets = [[]];
    for (const handIndex of moveCardIndexes) {
      for (const selected of [...subsets]) {
        if (selected.length < required) subsets.push([...selected, handIndex]);
      }
    }
    return {
      actorPlayer: player,
      candidates: subsets.flatMap((selectedHandIndices) => {
        const energyCost = Math.max(0, required - selectedHandIndices.length);
        if (!players.canAfford(player, { energy: energyCost })) return [];
        const choiceId = selectedHandIndices.length ? selectedHandIndices.join(",") : "energy";
        return [{
          id: "conditionalChoice",
          family: "choose_payment",
          label: selectedHandIndices.length
            ? `弃 ${selectedHandIndices.length} 张移动牌${energyCost ? ` + ${energyCost} 能量` : ""}`
            : `消耗 ${energyCost} 能量`,
          target: { kind: "move-payment", choiceId },
          selectedHandIndices,
        }];
      }),
    };
  }

  function describePendingDecision(workingRoot, kind, pending) {
    if (!workingRoot || typeof workingRoot !== "object") {
      throw new TypeError("Browser pending Decision 需要显式 working root");
    }
    if (kind === "hand_scan") {
      const player = getSimulationConditionalPlayer(workingRoot, pending);
      const candidates = (player?.hand || []).flatMap((card, handIndex) => (
        getPublicScanChoicesForCard(card)?.ok ? [{
          id: "conditionalChoice",
          family: "choose_card",
          label: cards.getCardLabel(card),
          target: {
            kind: "hand-scan-card",
            choiceId: String(handIndex),
            cardId: card.cardId || card.id || null,
            handIndex,
          },
          handIndex,
        }] : []
      ));
      if (pending.optional || !candidates.length) {
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "跳过手牌扫描",
          target: { kind: "skip-hand-scan", choiceId: "skip" },
        });
      }
      return { actorPlayer: player, candidates };
    }
    if (kind === "pass_reserve") {
      const player = getPlayerById(workingRoot, pending.playerId) || getCurrentPlayer(workingRoot);
      return {
        actorPlayer: player,
        candidates: getPassReserveSelectionCards(workingRoot, pending).map((card) => ({
          id: "conditionalChoice",
          family: "choose_card",
          label: cards.getCardLabel(card),
          target: {
            kind: "pass-reserve-card",
            choiceId: card.id,
            cardId: card.cardId || card.id || null,
          },
          cardInstanceId: card.id,
        })),
      };
    }
    if (kind === "move_payment") return enumerateSimulationMovePaymentActions(workingRoot, pending);
    if (kind === "discard") {
      const player = getSimulationConditionalPlayer(workingRoot, pending);
      const count = Math.max(0, Math.round(Number(pending.count) || 0));
      const hand = player?.hand || [];
      const combinations = [];
      function collectCombinations(startIndex, selected) {
        if (selected.length === count) {
          combinations.push([...selected]);
          return;
        }
        for (let handIndex = startIndex; handIndex <= hand.length - (count - selected.length); handIndex += 1) {
          selected.push(handIndex);
          collectCombinations(handIndex + 1, selected);
          selected.pop();
        }
      }
      collectCombinations(0, []);
      return {
        actorPlayer: player,
        candidates: [
          ...combinations.map((handIndexes) => ({
            id: "conditionalChoice",
            family: "choose_payment",
            label: handIndexes.map((handIndex) => cards.getCardLabel(hand[handIndex])).join("、"),
            target: {
              kind: "discard-hand-cards",
              choiceId: handIndexes.join("+"),
              handIndexes,
              cardIds: handIndexes.map((handIndex) => hand[handIndex]?.cardId || hand[handIndex]?.id || null),
            },
            handIndexes,
          })),
          ...(!pending.required ? [{
            id: "conditionalChoice",
            family: "accept_optional_effect",
            label: "取消弃牌",
            target: { kind: "cancel-discard-selection", choiceId: "cancel" },
          }] : []),
        ],
      };
    }
    if (kind === "card_trigger") {
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, pending) || getCurrentPlayer(workingRoot),
        candidates: (pending.matches || []).map((match, choiceIndex) => ({
          id: "conditionalChoice",
          family: "choose_branch",
          label: match?.effect?.label || cards.getCardLabel(match?.card),
          target: { kind: "card-trigger", choiceId: String(choiceIndex), choiceIndex },
        })).concat({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "取消本次卡牌触发",
          target: { kind: "card-trigger-cancel", choiceId: "cancel" },
        }),
      };
    }
    if (kind === "card_task_completion") {
      if (!pending.ready) return { actorPlayer: null, candidates: [] };
      const transports = pending.ready.chongTask
        && pending.ready.task?.kind === "transport"
        ? pending.ready.deliveredTransports || []
        : [];
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, pending) || getCurrentPlayer(workingRoot),
        candidates: transports.length > 1
          ? transports.map((transport) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: `选择搬运飞船 ${transport.rocketId}`,
            target: { kind: "card-task-completion", choiceId: String(transport.rocketId) },
          }))
          : [{
            id: "conditionalChoice",
            family: "accept_optional_effect",
            label: "确认完成任务",
            target: { kind: "card-task-completion", choiceId: "confirm" },
          }],
      };
    }
    if (kind === "card_trigger_free_move") {
      const player = getSimulationConditionalPlayer(workingRoot, pending) || getCurrentPlayer(workingRoot);
      const providedMovePoints = Math.max(0, Math.round(Number(
        pending.match?.effect?.options?.movementPoints ?? 1
      ) || 0));
      const candidates = [];
      for (const rocket of getMovableTokensForPlayer(player?.id) || []) {
        for (const direction of [
          { id: "out", deltaX: 0, deltaY: 1 },
          { id: "cw", deltaX: 1, deltaY: 0 },
          { id: "ccw", deltaX: -1, deltaY: 0 },
          { id: "in", deltaX: 0, deltaY: -1 },
        ]) {
          if (!rocketActions.canMoveRocket(workingRoot.rocketState, rocket.id, direction.deltaX, direction.deltaY)?.ok) continue;
          const terrainRequired = getRequiredMovePointsForUi(
            player,
            rocket.id,
            direction.deltaX,
            direction.deltaY,
            pending.match?.effect?.options || {},
          );
          const supplemental = Math.max(0, terrainRequired - providedMovePoints);
          if (supplemental && !canPayForMove(player, supplemental)?.ok) continue;
          candidates.push({
            id: "conditionalChoice",
            family: "choose_target",
            label: `${formatRocketLabel(rocket)} ${direction.id}`,
            target: {
              kind: "card-trigger-free-move",
              choiceId: `${rocket.id}:${direction.id}`,
              rocketId: rocket.id,
              direction: direction.id,
            },
            rocketId: rocket.id,
            deltaX: direction.deltaX,
            deltaY: direction.deltaY,
          });
        }
      }
      if (!candidates.length) {
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "取消无法执行的卡牌触发",
          target: { kind: "skip-card-trigger-free-move", choiceId: "skip" },
        });
      }
      return { actorPlayer: player, candidates };
    }
    if (kind === "card_move") {
      const effect = getCurrentActionEffect(workingRoot);
      const player = getEffectOwnerPlayer(workingRoot, effect) || getCurrentPlayer(workingRoot);
      const candidates = [];
      for (const rocket of getMovableTokensForCardMoveEffect(effect, player?.id) || []) {
        for (const direction of [
          { id: "out", deltaX: 0, deltaY: 1 },
          { id: "cw", deltaX: 1, deltaY: 0 },
          { id: "ccw", deltaX: -1, deltaY: 0 },
          { id: "in", deltaX: 0, deltaY: -1 },
        ]) {
          if (!validateIndustryHuanyuMoveRocket(effect, rocket.id)?.ok) continue;
          if (!rocketActions.canMoveRocket(workingRoot.rocketState, rocket.id, direction.deltaX, direction.deltaY)?.ok) continue;
          const terrainRequired = getRequiredMovePointsForUi(
            player,
            rocket.id,
            direction.deltaX,
            direction.deltaY,
            effect?.options || {},
          );
          const supplemental = Math.max(0, terrainRequired - Math.max(0, pending.poolRemaining || 0));
          if (supplemental && !canPayForMove(player, supplemental)?.ok) continue;
          candidates.push({
            id: "conditionalChoice",
            family: "choose_target",
            label: `${formatRocketLabel(rocket)} ${direction.id}`,
            target: {
              kind: "card-effect-move",
              choiceId: `${rocket.id}:${direction.id}`,
              rocketId: rocket.id,
              direction: direction.id,
            },
            rocketId: rocket.id,
            deltaX: direction.deltaX,
            deltaY: direction.deltaY,
          });
        }
      }
      if (pending.moved) {
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "结束剩余移动",
          target: { kind: "finish-card-effect-move", choiceId: "finish" },
        });
      }
      if (!candidates.length) {
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "跳过无可用路径的移动效果",
          target: { kind: "skip-card-effect-move", choiceId: "skip" },
        });
      }
      return { actorPlayer: player, candidates };
    }
    if (kind === "card_corner_free_move") {
      const player = getSimulationConditionalPlayer(workingRoot, pending) || getCurrentPlayer(workingRoot);
      const providedMovePoints = Math.max(0, Math.round(Number(
        pending.action?.moveReward?.movementPoints
          ?? pending.action?.movementPoints
          ?? 1
      ) || 0));
      const candidates = [];
      for (const rocket of getMovableTokensForPlayer(player?.id) || []) {
        for (const direction of [
          { id: "out", deltaX: 0, deltaY: 1 },
          { id: "cw", deltaX: 1, deltaY: 0 },
          { id: "ccw", deltaX: -1, deltaY: 0 },
          { id: "in", deltaX: 0, deltaY: -1 },
        ]) {
          if (!rocketActions.canMoveRocket(workingRoot.rocketState, rocket.id, direction.deltaX, direction.deltaY)?.ok) continue;
          const terrainRequired = getRequiredMovePointsForUi(
            player,
            rocket.id,
            direction.deltaX,
            direction.deltaY,
          );
          const supplemental = Math.max(0, terrainRequired - providedMovePoints);
          if (supplemental && !canPayForMove(player, supplemental)?.ok) continue;
          candidates.push({
            id: "conditionalChoice",
            family: "choose_target",
            label: `${formatRocketLabel(rocket)} ${direction.id}`,
            target: {
              kind: "card-corner-free-move",
              choiceId: `${rocket.id}:${direction.id}`,
              rocketId: rocket.id,
              direction: direction.id,
            },
            rocketId: rocket.id,
            deltaX: direction.deltaX,
            deltaY: direction.deltaY,
          });
        }
      }
      if (!candidates.length) {
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "跳过无法执行的免费移动",
          target: { kind: "skip-card-corner-free-move", choiceId: "skip" },
        });
      }
      return { actorPlayer: player, candidates };
    }
    if (kind === "industry_ability") {
      const player = getSimulationConditionalPlayer(workingRoot, pending) || getCurrentPlayer(workingRoot);
      if (pending.flowType !== "turing_borrow_tech") {
        return { actorPlayer: player, candidates: [] };
      }
      const candidates = tech.listTakeableTiles(
        workingRoot.techGameState.board,
        player?.techState,
        { techTypes: workingRoot.techGameState.ui.allowedTechTypes },
      ).map((tileId) => ({
        id: "conditionalChoice",
        family: "choose_target",
        label: `借用科技 ${tileId}`,
        target: { kind: "research-tech-tile", choiceId: tileId, tileId },
        tileId,
      })).concat({
        id: "conditionalChoice",
        family: "accept_optional_effect",
        label: "取消图灵系统科技借用",
        target: { kind: "cancel-industry-ability", choiceId: "cancel" },
      });
      return { actorPlayer: player, candidates };
    }
    if (kind === "industry_free_move") {
      const player = getSimulationConditionalPlayer(workingRoot, pending) || getCurrentPlayer(workingRoot);
      const movedRocketIds = new Set((pending.movedRocketIds || []).map(String));
      const candidates = [];
      for (const rocket of rocketActions.getMovableTokensForPlayer(workingRoot.rocketState, player?.id) || []) {
        if (movedRocketIds.has(String(rocket.id))) continue;
        for (const direction of [
          { id: "out", deltaX: 0, deltaY: 1 },
          { id: "cw", deltaX: 1, deltaY: 0 },
          { id: "ccw", deltaX: -1, deltaY: 0 },
          { id: "in", deltaX: 0, deltaY: -1 },
        ]) {
          if (!rocketActions.canMoveRocket(workingRoot.rocketState, rocket.id, direction.deltaX, direction.deltaY)?.ok) continue;
          const terrainRequired = getRequiredMovePointsForUi(player, rocket.id, direction.deltaX, direction.deltaY);
          const supplemental = Math.max(0, terrainRequired - 1);
          if (supplemental && !canPayForMove(player, supplemental)?.ok) continue;
          candidates.push({
            id: "conditionalChoice",
            family: "choose_target",
            label: `${formatRocketLabel(rocket)} ${direction.id}`,
            target: {
              kind: "industry-free-move",
              choiceId: `${rocket.id}:${direction.id}`,
              rocketId: rocket.id,
              direction: direction.id,
            },
            rocketId: rocket.id,
            deltaX: direction.deltaX,
            deltaY: direction.deltaY,
          });
        }
      }
      if (!candidates.length) {
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "结束公司免费移动",
          target: { kind: "finish-industry-free-move", choiceId: "finish" },
        });
      }
      return { actorPlayer: player, candidates };
    }
    if (kind === "strategy_slot") {
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, pending) || getCurrentPlayer(workingRoot),
        candidates: (pending.slotIds || []).map((slotId) => ({
          id: "conditionalChoice",
          family: "choose_reward",
          label: industry.getStrategyPassiveSlotLabel?.(slotId) || slotId,
          target: {
            kind: "strategy-passive-slot",
            choiceId: slotId,
            slotId,
          },
          slotId,
        })).concat({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "取消奖励槽选择",
          target: { kind: "cancel-strategy-passive-slot", choiceId: "cancel" },
        }),
      };
    }
    if (kind === "probe_sector_scan") {
      const choices = pending.choices || [];
      const maxTargets = Math.max(1, Math.round(Number(pending.effect?.options?.maxTargets) || 1));
      const subsets = [];
      const visit = (start, selected) => {
        if (selected.length) subsets.push([...selected]);
        if (selected.length >= maxTargets) return;
        for (let index = start; index < choices.length; index += 1) {
          selected.push(choices[index]);
          visit(index + 1, selected);
          selected.pop();
        }
      };
      visit(0, []);
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
        candidates: subsets.map((subset) => {
          const rocketIds = subset.map((choice) => choice.rocket.id);
          return {
            id: "conditionalChoice",
            family: "choose_target",
            label: `选择探测器 ${rocketIds.join(",")}`,
            target: { kind: "probe-sector-selection", choiceId: rocketIds.join(","), rocketIds },
          };
        }),
      };
    }
    if (kind === "probe_location_reward") {
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
        candidates: (pending.choices || []).map(({ rocket }) => ({
          id: "conditionalChoice",
          family: "choose_target",
          label: `探测器位置奖励 R${rocket.id}`,
          target: { kind: "probe-location-reward", choiceId: String(rocket.id), rocketId: rocket.id },
        })),
      };
    }
    if (kind === "scan_free_move") {
      const player = getSimulationConditionalPlayer(workingRoot, pending);
      if (pending.stage === "action_choice") {
        const labels = { launch: "发射", move: "移动", skip: "跳过" };
        return {
          actorPlayer: player,
          candidates: (pending.choices || []).map((choiceId) => ({
            id: "conditionalChoice",
            family: choiceId === "skip" ? "accept_optional_effect" : "choose_branch",
            label: labels[choiceId] || choiceId,
            target: {
              kind: `scan-action-${choiceId}`,
              choiceId,
            },
          })),
        };
      }
      const candidates = [];
      for (const rocket of rocketActions.getMovableTokensForPlayer(workingRoot.rocketState, player?.id) || []) {
        for (const direction of [
          { id: "out", deltaX: 0, deltaY: 1 },
          { id: "cw", deltaX: 1, deltaY: 0 },
          { id: "ccw", deltaX: -1, deltaY: 0 },
          { id: "in", deltaX: 0, deltaY: -1 },
        ]) {
          if (!rocketActions.canMoveRocket(
            workingRoot.rocketState,
            rocket.id,
            direction.deltaX,
            direction.deltaY,
          )?.ok) continue;
          candidates.push({
            id: "conditionalChoice",
            family: "choose_target",
            label: `${formatRocketLabel(rocket)} ${direction.id}`,
            target: {
              kind: "scan-free-move",
              choiceId: `${rocket.id}:${direction.id}`,
              rocketId: rocket.id,
              direction: direction.id,
            },
            rocketId: rocket.id,
            deltaX: direction.deltaX,
            deltaY: direction.deltaY,
          });
        }
      }
      return { actorPlayer: player, candidates };
    }
    if (kind === "data_placement") {
      const player = getSimulationConditionalPlayer(workingRoot, pending);
      const candidates = (data.listPlaceDataChoices?.(player) || []).map((choice, choiceIndex) => ({
        id: "conditionalChoice",
        family: "choose_target",
        label: choice.label || `放置数据 ${choiceIndex + 1}`,
        target: {
          kind: "pending-data-placement",
          choiceId: `${choice.target}:${choice.blueSlot ?? ""}`,
          slotId: choice.target,
          blueSlot: choice.blueSlot ?? null,
        },
        placementTarget: choice.target,
        blueSlot: choice.blueSlot ?? null,
      }));
      candidates.push({
        id: "conditionalChoice",
        family: "accept_optional_effect",
        label: "跳过本次数据获得",
        target: { kind: "skip-pending-data-placement", choiceId: "skip" },
      });
      return { actorPlayer: player, candidates };
    }
    if (kind === "land_target") {
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
        candidates: (pending.choices || []).map((choice, choiceIndex) => ({
          id: "conditionalChoice",
          family: "choose_target",
          choiceIndex,
          label: choice.label || `登陆目标 ${choiceIndex + 1}`,
          target: {
            kind: "land-target",
            choiceId: String(choiceIndex),
            planetId: choice.target || null,
            rocketId: choice.rocketId || null,
          },
        })).concat(pending.cancelKind ? [{
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "取消登陆目标选择",
          target: { kind: "land-target-cancel", choiceId: "cancel" },
        }] : []),
      };
    }
    if (kind === "pirates_raid") {
      const player = getSimulationConditionalPlayer(workingRoot, pending);
      return {
        actorPlayer: player,
        candidates: (industry.listPiratesRaidBlockedTechTiles?.(player) || []).map((tileId) => ({
          id: "conditionalChoice",
          family: "choose_target",
          label: `放置掠夺标记：${tileId}`,
          target: { kind: "pirates-raid-marker", choiceId: tileId, tileId },
        })),
      };
    }
    if (kind === "turn_end_reveal") {
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
        candidates: [{
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "确认外星人揭示并继续回合结束",
          target: { kind: "turn-end-reveal-confirm", choiceId: "confirm" },
        }],
      };
    }
    if (kind === "alien_trace") {
      const picker = getAlienTracePickerState();
      const player = getSimulationConditionalPlayer(workingRoot, picker || pending);
      if (picker?.mode === "fangzhou-destination") {
        const traceTypes = getFangzhouUnlockableTraceTypes(
          workingRoot,
          Number(picker.selectedAlienSlotId || 0),
          picker.allowedTraceTypes || aliens.TRACE_TYPES,
          player,
        );
        const candidates = [];
        if (hasAlienTracePanelPlacementTarget(
          workingRoot,
          picker.allowedAlienSlotIds || null,
          picker.allowedTraceTypes || aliens.TRACE_TYPES,
          player,
        )) {
          candidates.push({
            id: "conditionalChoice",
            family: "choose_branch",
            label: "放到外星人面板",
            target: { kind: "fangzhou-trace-destination", choiceId: "panel" },
            destination: "panel",
          });
        }
        for (const traceType of traceTypes) {
          candidates.push({
            id: "conditionalChoice",
            family: "choose_branch",
            label: `解锁${aliens.getTraceTypeLabel(traceType)}方舟牌`,
            target: { kind: "fangzhou-trace-destination", choiceId: `unlock:${traceType}`, traceType },
            destination: "unlock",
            traceType,
          });
        }
        return { actorPlayer: player, candidates };
      }
      if (picker?.mode === "fangzhou-unlock-color") {
        const traceTypes = getFangzhouUnlockableTraceTypes(
          workingRoot,
          Number(picker.selectedAlienSlotId || 0),
          picker.allowedTraceTypes || aliens.TRACE_TYPES,
          player,
        );
        return {
          actorPlayer: player,
          candidates: traceTypes.map((traceType) => ({
            id: "conditionalChoice",
            family: "choose_branch",
            label: `解锁${aliens.getTraceTypeLabel(traceType)}方舟牌`,
            target: { kind: "fangzhou-unlock-color", choiceId: traceType, traceType },
            traceType,
          })),
        };
      }
      if (picker?.mode === "trace-board") {
        const slotIds = getAlienTraceChoiceSlotIds(workingRoot, picker.allowedAlienSlotIds);
        const traceTypes = picker.allowedTraceTypes?.length ? picker.allowedTraceTypes : aliens.TRACE_TYPES;
        const candidates = [];
        for (const alienSlotId of slotIds) {
          for (const traceType of traceTypes) {
            if (!canPlaceStateTrace(workingRoot, alienSlotId, traceType, "first")
              && !canPlaceStateTrace(workingRoot, alienSlotId, traceType, "extra")) continue;
            candidates.push({
              id: "conditionalChoice",
              family: "choose_target",
              label: `${aliens.getAlienSlotLabel(alienSlotId)} ${aliens.getTraceTypeLabel(traceType)}`,
              target: {
                kind: "alien-state-trace",
                choiceId: `${alienSlotId}:${traceType}`,
                slotId: String(alienSlotId),
                traceType,
              },
              alienSlotId: Number(alienSlotId),
              traceType,
            });
          }
        }
        return { actorPlayer: player, candidates };
      }
      return { actorPlayer: player, candidates: [] };
    }
    if (kind === "scan_target" || kind === "public_scan") {
      if (pending.type === "sector_scan") {
        return {
          actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
          candidates: (pending.choices || []).filter((choice) => choice?.disabled !== true).map((choice) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: choice.label || `扫描 ${choice.nebulaId}`,
            target: {
              kind: "sector-scan-target",
              choiceId: String(choice.nebulaId),
              nebulaId: choice.nebulaId,
              sectorX: choice.sectorX,
            },
          })),
        };
      }
      if (pending.type === "conditional_sector_scan") {
        return {
          actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
          candidates: (pending.sectorXs || []).map((sectorX) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: `条件扫描扇区 ${sectorX}`,
            target: { kind: "conditional-sector", choiceId: String(sectorX), sectorX },
          })),
        };
      }
      if (pending.type === "discard_corner_repeat" || pending.type === "return_unfinished_task") {
        const targetKind = pending.type === "discard_corner_repeat"
          ? "discard-corner-repeat"
          : "return-unfinished-task";
        return {
          actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
          candidates: (pending.choices || []).map((card) => ({
            id: "conditionalChoice",
            family: "choose_card",
            label: cards.getCardLabel(card),
            target: { kind: targetKind, choiceId: card.id, cardId: card.id },
            cardInstanceId: card.id,
          })),
        };
      }
      if (pending.type === "remove_orbit_to_probe" || pending.type === "remove_planet_marker") {
        const targetKind = pending.type === "remove_orbit_to_probe"
          ? "remove-orbit-to-probe"
          : "remove-planet-marker";
        return {
          actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
          candidates: (pending.choices || []).map((choice) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: choice.label || (pending.type === "remove_orbit_to_probe" ? "移除环绕标记" : "移除星球标记"),
            target: {
              kind: targetKind,
              choiceId: choice.id,
              ...(choice.planetId ? { planetId: choice.planetId } : {}),
            },
          })),
        };
      }
      if (pending.type === "discard_any_income") {
        const player = getSimulationConditionalPlayer(workingRoot, pending);
        const hand = player?.hand || [];
        const candidates = [];
        const cardIdSubsets = [[]];
        for (const card of hand) {
          cardIdSubsets.push(...cardIdSubsets.map((cardIds) => [...cardIds, card.id]));
        }
        for (const cardIds of cardIdSubsets) {
          candidates.push({
            id: "conditionalChoice",
            family: "choose_payment",
            label: cardIds.length
              ? `弃掉 ${cardIds.map((cardId) => cards.getCardLabel(hand.find((card) => card.id === cardId))).join("、")}`
              : "不弃牌",
            target: {
              kind: "confirm-discard-income",
              choiceId: cardIds.join("+") || "none",
              cardIds,
            },
          });
        }
        return { actorPlayer: player, candidates };
      }
      if (pending.type === "pay_credit_reward") {
        const player = getSimulationConditionalPlayer(workingRoot, pending);
        const candidates = [];
        if (players.canAfford(player, { credits: 1 })) {
          candidates.push({
            id: "conditionalChoice",
            family: "choose_payment",
            label: "支付 1 信用",
            target: { kind: "pay-credit-reward", choiceId: "pay" },
          });
        }
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "跳过支付",
          target: { kind: "pay-credit-reward", choiceId: "skip" },
        });
        return { actorPlayer: player, candidates };
      }
      if (pending.type === "industry_fundamentalism_exchange") {
        return {
          actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
          candidates: (pending.choices || []).filter((choice) => !choice.disabled).map((choice) => ({
            id: "conditionalChoice",
            family: "choose_reward",
            label: choice.label,
            target: { kind: "fundamentalism-exchange", choiceId: choice.id },
          })),
        };
      }
      if (pending.type === "optional_hand_scan") {
        return {
          actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
          candidates: [
            {
              id: "conditionalChoice",
              family: "choose_branch",
              label: "选择手牌",
              target: { kind: "optional-hand-scan", choiceId: "start" },
            },
            {
              id: "conditionalChoice",
              family: "accept_optional_effect",
              label: "跳过手牌扫描",
              target: { kind: "optional-hand-scan", choiceId: "skip" },
            },
          ],
        };
      }
      if (pending.type === "hand_corner_reward") {
        const labels = { publicity: "宣传", data: "数据", move: "移动" };
        return {
          actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
          candidates: Object.entries(pending.counts || {}).flatMap(([choice, count]) => (
            Number(count) > 0 ? [{
              id: "conditionalChoice",
              family: "choose_reward",
              label: `${labels[choice] || choice} ${count}`,
              target: { kind: "hand-corner-choice", choiceId: choice },
            }] : []
          )),
        };
      }
      if (pending.type === "industry_pirates_raid_launch") {
        return {
          actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
          candidates: (pending.choices || []).map((choice) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: choice.label,
            target: { kind: "pirates-raid-launch", choiceId: choice.id },
          })),
        };
      }
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
        candidates: [
          ...(pending.choices || []).flatMap((choice, choiceIndex) => (
            choice?.disabled ? [] : [{
              id: "conditionalChoice",
              family: "choose_target",
              label: choice.label || `扫描目标 ${choiceIndex + 1}`,
              target: {
                kind: "scan-target",
                choiceId: String(choiceIndex),
                sectorX: choice.sectorX,
                nebulaId: choice.nebulaId,
              },
              nebulaId: choice.nebulaId,
              sectorX: choice.sectorX,
            }]
          )),
          ...(pending.type === "hand_scan" && pending.discardDrawnOnSkip ? [{
            id: "conditionalChoice",
            family: "accept_optional_effect",
            label: "跳过盲抽手牌扫描",
            target: { kind: "skip-drawn-hand-scan", choiceId: "skip" },
          }] : []),
        ],
      };
    }
    throw new TypeError(`未知 browser pending Decision: ${kind || "<missing>"}`);
  }

  function collectConditionalChoices(workingRoot) {
    if (!workingRoot || typeof workingRoot !== "object") {
      throw new TypeError("Conditional Decision 需要显式 working root");
    }
    const finalScorePlayer = getCurrentPlayer(workingRoot);
    const finalScorePending = finalScoring.getNextPendingMarkForPlayer(
      workingRoot.finalScoringState,
      finalScorePlayer?.id,
    );
    if (finalScorePending) {
      return {
        actorPlayer: finalScorePlayer,
        candidates: FINAL_SCORE_IDS.flatMap((tileId) => (
          finalScoring.canMarkTile(workingRoot.finalScoringState, tileId, finalScorePlayer)?.ok
            ? [{
              id: "conditionalChoice",
              family: "choose_final_scoring",
              label: `终局板块 ${String(tileId).toUpperCase()}`,
              target: { kind: "final-score-tile", choiceId: String(tileId) },
            }]
            : []
        )),
      };
    }
    const chongFossilPending = getPendingChongFossilChoice();
    const yichangdianCornerPending = getPendingYichangdianCornerAction();
    if (yichangdianCornerPending) {
      return {
        actorPlayer: getPlayerById(workingRoot, yichangdianCornerPending.playerId) || getCurrentPlayer(workingRoot),
        candidates: getPendingYichangdianCornerCards(workingRoot, yichangdianCornerPending).map((card) => ({
          id: "conditionalChoice",
          family: "choose_reward",
          label: `异常点角标 ${card.id}`,
          target: { kind: "yichangdian-corner-choice", choiceId: card.id },
          pendingContext: structuredClone(yichangdianCornerPending),
        })),
      };
    }
    const amibaTraceRemovalPending = getPendingAmibaTraceRemoval();
    if (amibaTraceRemovalPending) {
      const traceChoices = amibaTraceRemovalPending.choices || [];
      return {
        actorPlayer: getPlayerById(workingRoot, amibaTraceRemovalPending.playerId) || getCurrentPlayer(workingRoot),
        candidates: (traceChoices.length ? traceChoices : ["cancel"]).map((choiceId) => ({
          id: "conditionalChoice",
          family: choiceId === "cancel" ? "accept_optional_effect" : "choose_target",
          label: choiceId === "cancel" ? "跳过阿米巴痕迹移除" : `移除阿米巴痕迹 ${choiceId}`,
          target: { kind: "amiba-trace-removal", choiceId },
          pendingContext: structuredClone(amibaTraceRemovalPending),
        })),
      };
    }
    const jiuzheCardPlayPending = getPendingJiuzheCardPlay();
    if (jiuzheCardPlayPending) {
      return {
        actorPlayer: getPlayerById(workingRoot, jiuzheCardPlayPending.playerId) || getCurrentPlayer(workingRoot),
        candidates: [
          ...(jiuzheCardPlayPending.cardIndexes || []).map((cardIndex) => ({
            id: "conditionalChoice",
            family: "choose_card",
            label: `打出九折牌 ${cardIndex}`,
            target: { kind: "jiuzhe-card-play", choiceId: String(cardIndex), cardIndex },
            pendingContext: structuredClone(jiuzheCardPlayPending),
          })),
          {
            id: "conditionalChoice",
            family: "accept_optional_effect",
            label: "放弃本次九折机会",
            target: { kind: "jiuzhe-card-skip", choiceId: "skip" },
            pendingContext: structuredClone(jiuzheCardPlayPending),
          },
        ],
      };
    }
    const banrenmaOpportunityPending = getPendingBanrenmaOpportunity();
    if (banrenmaOpportunityPending) {
      const isPanel = banrenmaOpportunityPending.type === "panel";
      const rawChoices = isPanel
        ? (banrenmaOpportunityPending.positions || []).map(String)
        : (banrenmaOpportunityPending.cardIds || []).map(String);
      return {
        actorPlayer: getPlayerById(workingRoot, banrenmaOpportunityPending.playerId) || getCurrentPlayer(workingRoot),
        candidates: [
          ...rawChoices.map((choiceId) => ({
            id: "conditionalChoice",
            family: isPanel ? "choose_reward" : "choose_card",
            label: isPanel ? `半人马顶部奖励 ${choiceId}` : `结算半人马牌 ${choiceId}`,
            target: {
              kind: isPanel ? "banrenma-panel-bonus" : "banrenma-card-condition",
              choiceId,
            },
            pendingContext: structuredClone(banrenmaOpportunityPending),
          })),
          ...(!isPanel ? [{
            id: "conditionalChoice",
            family: "accept_optional_effect",
            label: "跳过半人马牌条件",
            target: { kind: "banrenma-card-condition", choiceId: "skip" },
            pendingContext: structuredClone(banrenmaOpportunityPending),
          }] : []),
        ],
      };
    }
    const buildAlienCardGainDecision = (pending, kind, label) => ({
      actorPlayer: getPlayerById(workingRoot, pending.playerId) || getCurrentPlayer(workingRoot),
      candidates: [
        ...(pending.displayedAvailable ? [{
          id: "conditionalChoice",
          family: "choose_reward",
          label: `${label}展示牌`,
          target: { kind, choiceId: "displayed" },
          pendingContext: structuredClone(pending),
        }] : []),
        {
          id: "conditionalChoice",
          family: "choose_reward",
          label: `${label}盲抽`,
          target: { kind, choiceId: "blind" },
          pendingContext: structuredClone(pending),
        },
        {
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: `跳过${label}`,
          target: { kind, choiceId: "cancel" },
          pendingContext: structuredClone(pending),
        },
      ],
    });
    const yichangdianCardGainPending = getPendingYichangdianCardGain();
    if (yichangdianCardGainPending) {
      return buildAlienCardGainDecision(yichangdianCardGainPending, "yichangdian-card-gain", "异常点外星人牌");
    }
    const banrenmaCardGainPending = getPendingBanrenmaCardGain();
    if (banrenmaCardGainPending) {
      return buildAlienCardGainDecision(banrenmaCardGainPending, "banrenma-card-gain", "半人马外星人牌");
    }
    const chongCardGainPending = getPendingChongCardGain();
    if (chongCardGainPending) {
      return buildAlienCardGainDecision(chongCardGainPending, "chong-card-gain", "虫族外星人牌");
    }
    const amibaCardGainPending = getPendingAmibaCardGain();
    if (amibaCardGainPending) {
      return buildAlienCardGainDecision(amibaCardGainPending, "amiba-card-gain", "阿米巴外星人牌");
    }
    const aomomoCardGainPending = getPendingAomomoCardGain();
    if (aomomoCardGainPending) {
      return buildAlienCardGainDecision(aomomoCardGainPending, "aomomo-card-gain", "奥陌陌外星人牌");
    }
    const runezuCardGainPending = getPendingRunezuCardGain();
    if (runezuCardGainPending) {
      return buildAlienCardGainDecision(runezuCardGainPending, "runezu-card-gain", "符文族外星人牌");
    }
    if (chongFossilPending) {
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, chongFossilPending),
        candidates: (chongFossilPending.fossilIds || []).map((fossilId) => ({
          id: "conditionalChoice",
          family: "choose_reward",
          label: `虫族化石 ${fossilId}`,
          target: { kind: "chong-fossil-choice", choiceId: fossilId },
          fossilId,
          pendingContext: structuredClone(chongFossilPending),
        })),
      };
    }
    const runezuFacePending = getPendingRunezuFaceSymbolPlacement();
    if (runezuFacePending) {
      return {
        actorPlayer: getPlayerById(workingRoot, runezuFacePending.playerId) || getCurrentPlayer(workingRoot),
        candidates: (runezuFacePending.choices || []).map((choice) => ({
          id: "conditionalChoice",
          family: "choose_reward",
          label: choice.label || choice.symbolId,
          target: {
            kind: "runezu-face-symbol-choice",
            choiceId: choice.symbolId,
          },
          symbolId: choice.symbolId,
          pendingContext: structuredClone(runezuFacePending),
        })),
      };
    }
    const runezuBranchPending = getPendingRunezuSymbolBranch();
    if (runezuBranchPending) {
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, runezuBranchPending),
        candidates: (runezuBranchPending.branches || []).map((branch, index) => ({
          id: "conditionalChoice",
          family: "choose_branch",
          label: branch.label || `符文分支 ${index + 1}`,
          target: { kind: "runezu-symbol-branch", choiceId: String(index) },
          pendingContext: structuredClone(runezuBranchPending),
        })),
      };
    }
    const amibaSymbolPending = getPendingAmibaSymbolChoice();
    if (amibaSymbolPending) {
      const symbolSlotIds = amibaSymbolPending.symbolSlotIds || [];
      const candidates = symbolSlotIds.map((slotId) => ({
        id: "conditionalChoice",
        family: "choose_reward",
        label: `阿米巴 symbol ${slotId}`,
        target: { kind: "amiba-symbol-choice", choiceId: String(slotId) },
        pendingContext: structuredClone(amibaSymbolPending),
      }));
      if (!candidates.length) {
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "跳过空的阿米巴 symbol 奖励",
          target: { kind: "amiba-symbol-choice", choiceId: "cancel" },
          pendingContext: structuredClone(amibaSymbolPending),
        });
      }
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, amibaSymbolPending),
        candidates,
      };
    }
    if (isTechTilePickingActive(workingRoot)) {
      const player = getCurrentPlayer(workingRoot);
      const pendingTileId = workingRoot.techGameState.ui.pendingTileId;
      if (pendingTileId) {
        return {
          actorPlayer: player,
          candidates: tech.getAvailableBlueSlots(player?.techState).map((blueSlot) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: `蓝色科技槽位 ${blueSlot}`,
            target: {
              kind: "research-tech-blue-slot",
              choiceId: String(blueSlot),
              slotId: String(blueSlot),
            },
            blueSlot,
          })),
        };
      }
      const selectionOptions = getResearchTechSelectionOptions(workingRoot);
      const candidates = tech.listTakeableTiles(
        workingRoot.techGameState.board,
        player?.techState,
        { techTypes: workingRoot.techGameState.ui.allowedTechTypes },
      ).flatMap((tileId) => {
        if (industry?.isTechBlockedByPirates?.(player, tileId)) return [];
        if (selectionOptions.researchedByOthersOnly && !isTechTileOwnedByOtherPlayer(workingRoot, tileId)) return [];
        return [{
          id: "conditionalChoice",
          family: "choose_target",
          label: `研究科技 ${tileId}`,
          target: { kind: "research-tech-tile", choiceId: tileId, tileId },
          tileId,
        }];
      });
      if (!candidates.length) {
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "跳过无可用科技的效果",
          target: { kind: "skip-research-tech", choiceId: "skip" },
        });
      }
      return { actorPlayer: player, candidates };
    }
    if (kind === "pirates_raid") {
      const player = getSimulationConditionalPlayer(workingRoot, pending);
      return {
        actorPlayer: player,
        candidates: (industry.listPiratesRaidBlockedTechTiles?.(player) || []).map((tileId) => ({
          id: "conditionalChoice",
          family: "choose_target",
          label: `放置掠夺标记：${tileId}`,
          target: {
            kind: "pirates-raid-launch",
            choiceId: tileId,
            tileId,
          },
        })),
      };
    }
    if (kind === "turn_end_reveal") {
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, pending),
        candidates: [{
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "确认外星人揭示并继续回合结束",
          target: { kind: "turn-end-reveal-confirm", choiceId: "confirm" },
        }],
      };
    }
    const dataPlacePending = kind === "data_placement" ? pending : null;
    if (dataPlacePending) {
      const player = getSimulationConditionalPlayer(workingRoot, dataPlacePending);
      const candidates = (data.listPlaceDataChoices?.(player) || []).map((choice, choiceIndex) => ({
        id: "conditionalChoice",
        family: "choose_target",
        label: choice.label || `放置数据 ${choiceIndex + 1}`,
        target: {
          kind: "pending-data-placement",
          choiceId: `${choice.target}:${choice.blueSlot ?? ""}`,
          slotId: choice.target,
          blueSlot: choice.blueSlot ?? null,
        },
        placementTarget: choice.target,
        blueSlot: choice.blueSlot ?? null,
      }));
      candidates.push({
        id: "conditionalChoice",
        family: "accept_optional_effect",
        label: "跳过本次数据获得",
        target: { kind: "skip-pending-data-placement", choiceId: "skip" },
      });
      return { actorPlayer: player, candidates };
    }
    const landPending = kind === "land_target" ? pending : null;
    if (landPending) {
      return {
        actorPlayer: getSimulationConditionalPlayer(workingRoot, landPending),
        candidates: (landPending.choices || []).map((choice, choiceIndex) => ({
          id: "conditionalChoice",
          family: "choose_target",
          choiceIndex,
          label: choice.label || `登陆目标 ${choiceIndex + 1}`,
          target: {
            kind: "land-target",
            choiceId: String(choiceIndex),
            planetId: choice.target || null,
            rocketId: choice.rocketId || null,
          },
        })),
      };
    }

    const tracePending = kind === "alien_trace" ? pending : null;
    const picker = getAlienTracePickerState();
    if (tracePending && picker?.mode === "fangzhou-destination") {
      const player = getSimulationConditionalPlayer(workingRoot, picker);
      const alienSlotId = Number(picker.selectedAlienSlotId || 0);
      const traceTypes = getFangzhouUnlockableTraceTypes(
        workingRoot,
        alienSlotId,
        picker.allowedTraceTypes || aliens.TRACE_TYPES,
        player,
      );
      const candidates = [];
      if (hasAlienTracePanelPlacementTarget(workingRoot, picker.allowedAlienSlotIds || null, picker.allowedTraceTypes || aliens.TRACE_TYPES, player)) {
        candidates.push({
          id: "conditionalChoice",
          family: "choose_branch",
          label: "放到外星人面板",
          target: { kind: "fangzhou-trace-destination", choiceId: "panel" },
          destination: "panel",
        });
      }
      for (const traceType of traceTypes) {
        candidates.push({
          id: "conditionalChoice",
          family: "choose_branch",
          label: `解锁${aliens.getTraceTypeLabel(traceType)}方舟牌`,
          target: { kind: "fangzhou-trace-destination", choiceId: `unlock:${traceType}`, traceType },
          destination: "unlock",
          traceType,
        });
      }
      return { actorPlayer: player, candidates };
    }
    if (tracePending && picker?.mode === "fangzhou-unlock-color") {
      const player = getSimulationConditionalPlayer(workingRoot, picker);
      const traceTypes = getFangzhouUnlockableTraceTypes(
        workingRoot,
        Number(picker.selectedAlienSlotId || 0),
        picker.allowedTraceTypes || aliens.TRACE_TYPES,
        player,
      );
      return {
        actorPlayer: player,
        candidates: traceTypes.map((traceType) => ({
          id: "conditionalChoice",
          family: "choose_branch",
          label: `解锁${aliens.getTraceTypeLabel(traceType)}方舟牌`,
          target: { kind: "fangzhou-unlock-color", choiceId: traceType, traceType },
          traceType,
        })),
      };
    }
    if (picker?.mode === "trace-board") {
      const slotIds = getAlienTraceChoiceSlotIds(workingRoot, picker.allowedAlienSlotIds);
      const traceTypes = picker.allowedTraceTypes?.length ? picker.allowedTraceTypes : aliens.TRACE_TYPES;
      const candidates = [];
      for (const alienSlotId of slotIds) {
        for (const traceType of traceTypes) {
          if (!canPlaceStateTrace(workingRoot, alienSlotId, traceType, "first")
            && !canPlaceStateTrace(workingRoot, alienSlotId, traceType, "extra")) continue;
          candidates.push({
            id: "conditionalChoice",
            family: "choose_target",
            label: `${aliens.getAlienSlotLabel(alienSlotId)} ${aliens.getTraceTypeLabel(traceType)}`,
            target: {
              kind: "alien-state-trace",
              choiceId: `${alienSlotId}:${traceType}`,
              slotId: String(alienSlotId),
              traceType,
            },
            alienSlotId: Number(alienSlotId),
            traceType,
          });
        }
      }
      return { actorPlayer: getSimulationConditionalPlayer(workingRoot, tracePending || picker), candidates };
    }
    return { actorPlayer: null, candidates: [] };
  }

  const CONDITIONAL_CHOICE_HANDLERS = Object.freeze({
    "conditional-sector": (action, workingRoot) => handleConditionalSectorChoice(
      workingRoot,
      action.target.sectorX ?? action.target.choiceId,
      action.decisionContext?.pending,
    ),
    "sector-scan-target": (action, workingRoot) => confirmScanTarget(
      workingRoot,
      action.target.nebulaId ?? action.target.choiceId,
      action.target.sectorX,
      action.pendingContext || null,
    ),
    "chong-fossil-choice": (action) => handleChongFossilChoice(
      action.target.choiceId,
      action.pendingContext || null,
    ),
    "yichangdian-corner-choice": (action) => handleYichangdianCornerChoice(
      action.target.choiceId,
      action.pendingContext || null,
    ),
    "runezu-card-gain": (action) => handleRunezuCardGainChoice(action.target.choiceId, action.pendingContext || null),
    "amiba-card-gain": (action) => handleAmibaCardGainChoice(action.target.choiceId, action.pendingContext || null),
    "aomomo-card-gain": (action) => handleAomomoCardGainChoice(action.target.choiceId, action.pendingContext || null),
    "yichangdian-card-gain": (action) => handleYichangdianCardGainChoice(action.target.choiceId, action.pendingContext || null),
    "banrenma-card-gain": (action) => handleBanrenmaCardGainChoice(action.target.choiceId, action.pendingContext || null),
    "chong-card-gain": (action) => handleChongCardGainChoice(action.target.choiceId, action.pendingContext || null),
    "amiba-trace-removal": (action) => handleAmibaTraceRemovalChoice(action.target.choiceId, action.pendingContext || null),
    "jiuzhe-card-play": (action) => handleJiuzheCardChoice(
      action.target.cardIndex ?? action.target.choiceId,
      {},
      action.pendingContext || null,
    ),
    "jiuzhe-card-skip": (action) => handleJiuzheOpportunitySkip({}, action.pendingContext || null),
    "banrenma-panel-bonus": (action) => handleBanrenmaBonusChoice(action.target.choiceId, action.pendingContext || null),
    "banrenma-card-condition": (action) => handleBanrenmaCardConditionChoice(action.target.choiceId, action.pendingContext || null),
    "probe-sector-selection": (action, workingRoot) => {
      const pending = action.decisionContext?.pending
        || action.pendingContext
        || getPendingProbeSectorScanDecision(workingRoot);
      if (!pending) return { ok: false, message: "没有待处理的探测器扫描" };
      return confirmProbeSectorScanSelection(
        workingRoot,
        [...(action.target.rocketIds || [])],
        pending,
      );
    },
    "probe-location-reward": (action, workingRoot) => handleProbeLocationRewardChoice(
      workingRoot,
      action.target.rocketId ?? action.target.choiceId,
      action.decisionContext?.pending || action.pendingContext || null,
    ),
    "runezu-symbol-branch": (action) => handleRunezuSymbolBranchChoice(
      action.target.choiceId,
      action.pendingContext || null,
    ),
    "runezu-face-symbol-choice": (action) => handleRunezuFaceSymbolChoice(
      action.target.choiceId,
      action.pendingContext || null,
    ),
    "amiba-symbol-choice": (action) => handleAmibaSymbolChoice(
      action.target.choiceId,
      action.pendingContext || null,
    ),
    "final-score-tile": (action, workingRoot) => handleFinalScoreTileClick(
      action.target.choiceId,
      workingRoot,
    ),
    "research-tech-tile": (action, workingRoot) => {
      if (action.decisionContext?.kind === "industry_ability") {
        return confirmIndustryTuringBorrow(workingRoot, action.target.tileId || action.target.choiceId);
      }
      const result = handleSupplyTechTileClick(workingRoot, action.target.tileId || action.target.choiceId);
      if (result?.ok !== false && workingRoot.techGameState.ui.pendingTileId) {
        const blueSlot = tech.getAvailableBlueSlots(getCurrentPlayer(workingRoot)?.techState)?.[0];
        if (blueSlot != null) return confirmTechBlueSlotChoice(workingRoot, blueSlot);
      }
      return result;
    },
    "research-tech-blue-slot": (action, workingRoot) => confirmTechBlueSlotChoice(
      workingRoot,
      Number(action.target.slotId),
    ),
    "cancel-industry-ability": (_action, workingRoot) => {
      cancelIndustryAbilityFlow(workingRoot);
      workingRoot.rocketState.statusNote = "已取消图灵系统科技借用";
      return { ok: true, progressed: true, skipped: true, message: workingRoot.rocketState.statusNote };
    },
    "skip-research-tech": (_action, workingRoot) => {
      cancelTechSelection(workingRoot);
      if (isActionEffectFlowActive(workingRoot)) skipCurrentActionEffect(workingRoot);
      return { ok: true, progressed: true, skipped: true, message: "已跳过无可用科技的效果" };
    },
    "fangzhou-trace-destination": (action, workingRoot) => {
      const result = handleFangzhouTraceDestinationChoice(
        workingRoot, action.destination, action.traceType || null,
      );
      if (result?.ok !== false && getAlienTracePickerState()) {
        openPendingDecision(workingRoot, "alien_trace", action.decisionContext?.pending);
      }
      return result;
    },
    "fangzhou-unlock-color": (action, workingRoot) => {
      const result = handleFangzhouUnlockTraceChoice(workingRoot, action.target.traceType);
      if (result?.ok !== false && getAlienTracePickerState()) {
        openPendingDecision(workingRoot, "alien_trace", action.decisionContext?.pending);
      }
      return result;
    },
    "discard-corner-repeat": (action, workingRoot) => handleDiscardCornerRepeatChoice(
      workingRoot,
      action.target.cardId,
      action.decisionContext?.pending,
    ),
    "return-unfinished-task": (action, workingRoot) => handleReturnUnfinishedTaskChoice(
      workingRoot,
      action.target.cardId,
      action.decisionContext?.pending,
    ),
    "remove-orbit-to-probe": (action, workingRoot) => handleRemoveOrbitToProbeChoice(
      workingRoot,
      action.target.choiceId,
      action.decisionContext?.pending,
    ),
    "remove-planet-marker": (action, workingRoot) => handleRemovePlanetMarkerChoice(
      workingRoot,
      action.target.choiceId,
      action.decisionContext?.pending,
    ),
    "pending-data-placement": (action, workingRoot) => confirmDataPlacement(
      workingRoot,
      action.placementTarget,
      action.blueSlot,
      { pending: action.decisionContext?.pending },
    ),
    "skip-pending-data-placement": (action, workingRoot) => skipPendingDataPlacement(
      workingRoot,
      action.decisionContext?.pending,
    )
      || { ok: true, progressed: true, skipped: true, message: "已跳过本次数据获得" },
    "confirm-discard-income": (action, workingRoot) => confirmDiscardAnyForIncome(
      workingRoot,
      action.target.cardIds || [],
      action.decisionContext?.pending,
    ),
    "pay-credit-reward": (action, workingRoot) => handlePayCreditChoice(
      workingRoot,
      action.target.choiceId,
      action.decisionContext?.pending,
    ),
    "fundamentalism-exchange": (action, workingRoot) => handleFundamentalismExchangeChoice(
      workingRoot,
      action.target.choiceId,
      action.decisionContext?.pending,
    ),
    "optional-hand-scan": (action, workingRoot) => handleOptionalHandScanChoice(
      workingRoot,
      action.target.choiceId,
      action.decisionContext?.pending,
    ),
    "hand-corner-choice": (action, workingRoot) => handleHandCornerChoice(
      workingRoot,
      action.target.choiceId,
      action.decisionContext?.pending,
    ),
    "pirates-raid-launch": (action, workingRoot) => handlePiratesRaidLaunchChoice(
      workingRoot,
      action.target.choiceId,
      action.decisionContext?.pending,
    ),
    "pirates-raid-marker": (action, workingRoot) => handlePiratesRaidTechMarkerClick(
      workingRoot,
      action.target.tileId || action.target.choiceId,
      action.decisionContext?.pending,
    ),
    "scan-target": (action, workingRoot) => confirmScanTarget(
      workingRoot,
      action.target.nebulaId,
      action.target.sectorX,
      action.decisionContext?.pending,
    ),
    "skip-drawn-hand-scan": (action, workingRoot) => handleDrawnHandScanSkip(
      workingRoot,
      action.decisionContext?.pending,
    ),
    "pass-reserve-card": (action, workingRoot) => {
      return confirmPassReserveSelection(
        workingRoot,
        action.target.choiceId,
        action.decisionContext?.pending,
      );
    },
    "card-trigger": (action, workingRoot) => handleCardTriggerChoice(
      workingRoot,
      Number(action.target.choiceIndex),
      action.decisionContext?.pending,
    ),
    "card-trigger-cancel": (action, workingRoot) => cancelCardTriggerChoice(
      workingRoot,
      action.decisionContext?.pending,
    )
      ? { ok: true, progressed: true, skipped: true, message: "已取消卡牌触发" }
      : { ok: false, message: "当前没有可取消的卡牌触发" },
    "card-task-completion": (action, workingRoot) => confirmCardTaskCompletion(
      workingRoot,
      action.target.choiceId,
      { automated: true, pending: action.decisionContext?.pending },
    ),
    "hand-scan-card": (action, workingRoot) => handleHandScanCardClick(
      workingRoot,
      Number(action.target.handIndex),
      action.decisionContext?.pending,
    ),
    "skip-hand-scan": (_action, workingRoot) => {
      skipCurrentActionEffect(workingRoot);
      return { ok: true, progressed: true, skipped: true, message: "已跳过手牌扫描" };
    },
    "card-effect-move": (action, workingRoot) => resolveCardMoveDirectionDecision(
      workingRoot,
      action.deltaX,
      action.deltaY,
      action.target.rocketId,
      action.decisionContext?.pending,
    ),
    "scan-free-move": (action, workingRoot) => executeFreeMoveForScanAction4(
      workingRoot,
      action.deltaX,
      action.deltaY,
      action.target.rocketId,
      { pending: action.decisionContext?.pending },
    ),
    "scan-action-launch": (_action, workingRoot) => handleScanAction4Choice(workingRoot, "launch"),
    "scan-action-move": (_action, workingRoot) => handleScanAction4Choice(workingRoot, "move"),
    "scan-action-skip": (_action, workingRoot) => handleScanAction4Choice(workingRoot, "skip"),
    "card-trigger-free-move": (action, workingRoot) => executeFreeMoveForCardTrigger(
      workingRoot,
      action.deltaX,
      action.deltaY,
      action.target.rocketId,
      { pending: action.decisionContext?.pending },
    ),
    "skip-card-trigger-free-move": (action, workingRoot) => {
      const pending = action.decisionContext?.pending;
      const player = getCurrentPlayer(workingRoot);
      if (pending.beforePlayer) restoreObjectSnapshot(player, pending.beforePlayer);
      if (pending.beforeCardState) restoreObjectSnapshot(workingRoot.cardState, pending.beforeCardState);
      workingRoot.rocketState.activeRocketId = null;
      clearMoveRocketHighlight();
      deactivateMoveMode();
      continueAfterCardTriggerResolution(workingRoot);
      return { ok: true, progressed: true, skipped: true, message: "已取消无法执行的卡牌触发" };
    },
    "finish-card-effect-move": (action, workingRoot) => finishCurrentCardMoveEffectEarly(
      workingRoot,
      action.decisionContext?.pending,
    )
      ? { ok: true, progressed: true, message: "已结束剩余移动" }
      : { ok: false, message: "当前不能结束移动效果" },
    "skip-card-effect-move": () => {
      skipCurrentActionEffect();
      return { ok: true, progressed: true, skipped: true, message: "已跳过无可用路径的移动效果" };
    },
    "card-corner-free-move": (action, workingRoot) => executeFreeMoveForCardCorner(
      workingRoot,
      action.deltaX,
      action.deltaY,
      action.target.rocketId,
      { pending: action.decisionContext?.pending },
    ),
    "industry-free-move": (action, workingRoot) => executeIndustryFreeMove(
      workingRoot,
      action.deltaX,
      action.deltaY,
      action.target.rocketId,
      { pending: action.decisionContext?.pending },
    ),
    "finish-industry-free-move": (action, workingRoot) => {
      const pending = action.decisionContext?.pending;
      finishIndustryAbilityFlow(workingRoot, `${pending?.label || "公司免费移动"}：已结束`);
      return { ok: true, progressed: true, skipped: true, message: "已结束公司免费移动" };
    },
    "skip-card-corner-free-move": (action, workingRoot) => {
      const pending = action.decisionContext?.pending;
      workingRoot.rocketState.activeRocketId = null;
      clearMoveRocketHighlight();
      deactivateMoveMode();
      settleCardTasksAfterEffect({ events: pending.deferredEvents || [], render: false });
      if (pending.finishIndustryFlowAfterMove) {
        finishIndustryAbilityFlow(
          workingRoot,
          pending.afterMoveStatus || "公司 1x 行动：已跳过无法执行的免费移动",
          { irreversible: Boolean(pending.irreversibleIndustryFlow) },
        );
      }
      return { ok: true, progressed: true, skipped: true, message: "已跳过无法执行的免费移动" };
    },
    "move-payment": (action, workingRoot) => {
      return resolveMovePaymentDecision(workingRoot, {
        automated: true,
        selectedHandIndices: [...(action.selectedHandIndices || [])],
        pending: action.decisionContext?.pending,
      });
    },
    "strategy-passive-slot": (action, workingRoot) => confirmStrategyPassiveSlotChoice(
      workingRoot,
      action.target.slotId,
      action.decisionContext?.pending,
    ),
    "cancel-strategy-passive-slot": (_action, workingRoot) => {
      cancelStrategyPassiveSlotChoice(workingRoot);
      return { ok: true, progressed: true, skipped: true, message: "已取消奖励槽选择" };
    },
    "discard-hand-cards": (action, workingRoot) => finalizePendingDiscardSelection(
      workingRoot,
      action.target.handIndexes,
      action.decisionContext?.pending,
    ),
    "cancel-discard-selection": (_action, workingRoot) => cancelDiscardSelection(workingRoot)
      || { ok: true, progressed: true, skipped: true, message: "已取消弃牌" },
    "public-card": (action, workingRoot) => handlePublicCardClick(workingRoot, Number(action.target.slotId))
      || { ok: true, progressed: true, message: "已选择公共牌" },
    "confirm-public-corner-discard": (_action, workingRoot) => confirmPublicCornerDiscardSelection(workingRoot),
    "confirm-public-scan": (_action, workingRoot) => confirmPublicScanSelection(workingRoot),
    "hand-card": (action, workingRoot) => action.pendingType === "industry_deepspace_hand"
      ? handleIndustryDeepspaceHandClick(workingRoot, Number(action.target.handIndex))
      : handleIndustryFutureSpanHandClick(workingRoot, Number(action.target.handIndex)),
    "blind-draw": (_action, workingRoot) => drawCardForCurrentPlayer(workingRoot, { fromSelection: true }),
    "land-target": (action, workingRoot) => confirmLandTargetChoice(
      workingRoot,
      Number(action.target.choiceId),
      action.decisionContext?.pending,
    ),
    "land-target-cancel": (action, workingRoot) => cancelLandTargetChoice(
      workingRoot,
      action.decisionContext?.pending,
    ),
    "turn-end-reveal-confirm": (action, workingRoot) => {
      return finishCurrentTurnAfterAlienReveal(workingRoot, action.decisionContext?.pending || {});
    },
    "alien-state-trace": (action, workingRoot) => handleStateTraceSlotPlacement(
      workingRoot, Number(action.target.slotId), action.target.traceType,
    ),
  });

  function executeProductionConditionalChoice(workingRoot, choice, decision) {
    if (!workingRoot || typeof workingRoot !== "object") {
      return { ok: false, code: "CONDITIONAL_WORKING_ROOT_REQUIRED", message: "Conditional choice 缺少 working root" };
    }
    if (choice?.family == null || choice?.family !== decision?.choices?.find((entry) => (
      entry.choiceId === choice.choiceId && entry.family === choice.family
    ))?.family) {
      return { ok: false, code: "CONDITIONAL_CHOICE_NOT_LEGAL", message: "Decision choice identity 已失效" };
    }
    const handler = CONDITIONAL_CHOICE_HANDLERS[choice.followup?.handlerId];
    if (!handler) {
      return { ok: false, code: "CONDITIONAL_FOLLOWUP_UNMIGRATED", message: "条件动作 followup handler 不存在" };
    }
    return handler({
      ...structuredClone(choice.payload || {}),
      family: choice.family,
      target: structuredClone(choice.target || null),
      decisionContext: structuredClone(choice.payload?.decisionContext || null),
    }, workingRoot);
  }


    return Object.freeze({
      describeDecision: collectConditionalChoices,
      describePendingDecision,
      executeChoice: executeProductionConditionalChoice,
    });
  }

  function createConditionalDecisionDomain(context = {}) {
    let resolvedDomain = null;
    const resolve = () => {
      if (!resolvedDomain) {
        const resolvedContext = typeof context === "function" ? context() : context;
        resolvedDomain = createResolvedConditionalDecisionDomain(resolvedContext);
      }
      return resolvedDomain;
    };
    return Object.freeze({
      describeDecision: (...args) => resolve().describeDecision(...args),
      describePendingDecision: (...args) => resolve().describePendingDecision(...args),
      executeChoice: (...args) => resolve().executeChoice(...args),
    });
  }

  return Object.freeze({ createConditionalPlayerResolver, createConditionalDecisionDomain });
});
