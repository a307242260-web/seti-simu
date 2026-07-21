(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiConditionalDecisionDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createResolvedConditionalDecisionDomain(context) {
    const {
      browserRuleState,
      finalScoring,
      finalScoringState,
      FINAL_SCORE_IDS,
      getCurrentPlayer,
      getPendingProbeSectorScanDecision,
      getHeadlessConditionalPlayer,
      decisionSessions,
      getPlayerById,
      decisionState,
      cards,
      players,
      getPublicScanChoicesForCard,
      getPendingPassReserveSelection,
      getPassReserveSelectionCards,
      getPendingMovePayment,
      isMovePaymentCard,
      isTechTilePickingActive,
      techGameState,
      tech,
      industry,
      getResearchTechSelectionOptions,
      isTechTileOwnedByOtherPlayer,
      isActionEffectFlowActive,
      skipCurrentActionEffect,
      getPendingDataPlacementDecision,
      data,
      getPendingCardTriggerFreeMove,
      getMovableTokensForPlayer,
      rocketActions,
      rocketState,
      getRequiredMovePointsForUi,
      canPayForMove,
      formatRocketLabel,
      getEffectOwnerPlayer,
      getCurrentActionEffect,
      getMovableTokensForCardMoveEffect,
      validateIndustryHuanyuMoveRocket,
      getPendingCardCornerFreeMove,
      isPlayCardSelectionActive,
      getCardPlayCost,
      getPendingStrategySlotDecision,
      isFutureSpanEligibleHandCard,
      cardState,
      getPublicCardMultiSelectMinSelectable,
      getPublicScanMinSelectable,
      allowsBlindDrawInSelection,
      canBlindDraw,
      getPendingLandTargetDecision,
      abilities,
      createActionContext,
      getFangzhouUnlockableTraceTypes,
      hasAlienTracePanelPlacementTarget,
      getAlienTraceChoiceSlotIds,
      aliens,
      handleConditionalSectorChoice,
      handleChongFossilChoice,
      confirmProbeSectorScanSelection,
      handleRunezuSymbolBranchChoice,
      handleRunezuFaceSymbolChoice,
      handleAmibaSymbolChoice,
      handleFinalScoreTileClick,
      handleSupplyTechTileClick,
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
      confirmScanTarget,
      selectPassReserveCard,
      confirmPassReserveSelection,
      handleHandScanCardClick,
      executeCardMoveForEffect,
      executeFreeMoveForCardTrigger,
      restoreObjectSnapshot,
      CARD_TRIGGER_FREE_MOVE_SESSION,
      clearMoveRocketHighlight,
      deactivateMoveMode,
      continueAfterCardTriggerResolution,
      finishCurrentCardMoveEffectEarly,
      executeFreeMoveForCardCorner,
      CARD_CORNER_FREE_MOVE_SESSION,
      settleCardTasksAfterEffect,
      finishIndustryAbilityFlow,
      confirmMovePayment,
      handlePlayCardSelect,
      confirmPlayCardSelection,
      confirmStrategyPassiveSlotChoice,
      handleHandCardDiscard,
      handlePublicCardClick,
      confirmPublicCornerDiscardSelection,
      confirmPublicScanSelection,
      handleIndustryDeepspaceHandClick,
      handleIndustryFutureSpanHandClick,
      drawCardForCurrentPlayer,
      confirmLandTargetChoice,
      handleStateTraceSlotPlacement,
    } = context;

  function enumerateHeadlessMovePaymentActions(movePending) {
    const player = movePending.player || getHeadlessConditionalPlayer(movePending);
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

  function collectConditionalChoices(workingRoot = browserRuleState) {
    if (workingRoot !== browserRuleState) {
      return { actorPlayer: null, candidates: [], code: "CONDITIONAL_WORKING_ROOT_MISMATCH" };
    }
    const finalScorePlayer = getCurrentPlayer();
    const finalScorePending = finalScoring.getNextPendingMarkForPlayer(
      finalScoringState,
      finalScorePlayer?.id,
    );
    if (finalScorePending) {
      return {
        actorPlayer: finalScorePlayer,
        candidates: FINAL_SCORE_IDS.flatMap((tileId) => (
          finalScoring.canMarkTile(finalScoringState, tileId, finalScorePlayer)?.ok
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
    const probeSectorPending = getPendingProbeSectorScanDecision();
    if (probeSectorPending) {
      const choices = probeSectorPending.choices || [];
      const maxTargets = Math.max(1, Math.round(Number(probeSectorPending.effect?.options?.maxTargets) || 1));
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
        actorPlayer: getHeadlessConditionalPlayer(probeSectorPending),
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
    const chongFossilPending = decisionSessions.peek("chong_fossil_choice");
    if (chongFossilPending) {
      return {
        actorPlayer: getHeadlessConditionalPlayer(chongFossilPending),
        candidates: (chongFossilPending.fossilIds || []).map((fossilId) => ({
          id: "conditionalChoice",
          family: "choose_reward",
          label: `虫族化石 ${fossilId}`,
          target: { kind: "chong-fossil-choice", choiceId: fossilId },
          fossilId,
        })),
      };
    }
    const runezuFacePending = decisionSessions.peek("runezu_face_symbol_placement");
    if (runezuFacePending) {
      return {
        actorPlayer: getPlayerById(runezuFacePending.playerId) || getCurrentPlayer(),
        candidates: (runezuFacePending.choices || []).map((choice) => ({
          id: "conditionalChoice",
          family: "choose_reward",
          label: choice.label || choice.symbolId,
          target: {
            kind: "runezu-face-symbol-choice",
            choiceId: choice.symbolId,
          },
          symbolId: choice.symbolId,
        })),
      };
    }
    const runezuBranchPending = decisionSessions.peek("runezu_symbol_branch");
    if (runezuBranchPending) {
      return {
        actorPlayer: getHeadlessConditionalPlayer(runezuBranchPending),
        candidates: (runezuBranchPending.branches || []).map((branch, index) => ({
          id: "conditionalChoice",
          family: "choose_branch",
          label: branch.label || `符文分支 ${index + 1}`,
          target: { kind: "runezu-symbol-branch", choiceId: String(index) },
        })),
      };
    }
    const amibaSymbolPending = decisionSessions.peek("amiba_symbol_choice");
    if (amibaSymbolPending) {
      const symbolSlotIds = amibaSymbolPending.symbolSlotIds || [];
      const candidates = symbolSlotIds.map((slotId) => ({
        id: "conditionalChoice",
        family: "choose_reward",
        label: `阿米巴 symbol ${slotId}`,
        target: { kind: "amiba-symbol-choice", choiceId: String(slotId) },
      }));
      if (!candidates.length) {
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "跳过空的阿米巴 symbol 奖励",
          target: { kind: "amiba-symbol-choice", choiceId: "cancel" },
        });
      }
      return {
        actorPlayer: getHeadlessConditionalPlayer(amibaSymbolPending),
        candidates,
      };
    }
    const scanTargetPending = decisionState.scanTargetAction;
    if (scanTargetPending) {
      if (scanTargetPending.type === "conditional_sector_scan") {
        return {
          actorPlayer: getHeadlessConditionalPlayer(scanTargetPending),
          candidates: (scanTargetPending.sectorXs || []).map((sectorX) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: `条件扫描扇区 ${sectorX}`,
            target: { kind: "conditional-sector", choiceId: String(sectorX), sectorX },
            sectorX,
          })),
        };
      }
      if (scanTargetPending.type === "discard_corner_repeat") {
        return {
          actorPlayer: getHeadlessConditionalPlayer(scanTargetPending),
          candidates: (scanTargetPending.choices || []).map((card) => ({
            id: "conditionalChoice",
            family: "choose_card",
            label: cards.getCardLabel(card),
            target: { kind: "discard-corner-repeat", choiceId: card.id, cardId: card.id },
            cardInstanceId: card.id,
          })),
        };
      }
      if (scanTargetPending.type === "return_unfinished_task") {
        return {
          actorPlayer: getHeadlessConditionalPlayer(scanTargetPending),
          candidates: (scanTargetPending.choices || []).map((card) => ({
            id: "conditionalChoice",
            family: "choose_card",
            label: cards.getCardLabel(card),
            target: { kind: "return-unfinished-task", choiceId: card.id, cardId: card.id },
            cardInstanceId: card.id,
          })),
        };
      }
      if (scanTargetPending.type === "remove_orbit_to_probe") {
        return {
          actorPlayer: getHeadlessConditionalPlayer(scanTargetPending),
          candidates: (scanTargetPending.choices || []).map((choice) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: choice.label || "移除环绕标记",
            target: { kind: "remove-orbit-to-probe", choiceId: choice.id, planetId: choice.planetId },
          })),
        };
      }
      if (scanTargetPending.type === "remove_planet_marker") {
        return {
          actorPlayer: getHeadlessConditionalPlayer(scanTargetPending),
          candidates: (scanTargetPending.choices || []).map((choice) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: choice.label || "移除星球标记",
            target: { kind: "remove-planet-marker", choiceId: choice.id },
          })),
        };
      }
      if (scanTargetPending.type === "discard_any_income") {
        const player = getHeadlessConditionalPlayer(scanTargetPending);
        const selected = new Set(scanTargetPending.selectedCardIds || []);
        const candidates = (player?.hand || []).flatMap((card) => (
          selected.has(card.id) ? [] : [{
            id: "conditionalChoice",
            family: "choose_card",
            label: cards.getCardLabel(card),
            target: { kind: "discard-income-card", choiceId: card.id, cardId: card.id },
            cardInstanceId: card.id,
          }]
        ));
        candidates.push({
          id: "conditionalChoice",
          family: "choose_branch",
          label: "确认收入弃牌",
          target: { kind: "confirm-discard-income", choiceId: "confirm" },
        });
        return { actorPlayer: player, candidates };
      }
      if (scanTargetPending.type === "pay_credit_reward") {
        const player = getHeadlessConditionalPlayer(scanTargetPending);
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
      return {
        actorPlayer: getHeadlessConditionalPlayer(scanTargetPending),
        candidates: (scanTargetPending.choices || []).flatMap((choice, choiceIndex) => (
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
      };
    }
    const handScanPending = decisionState.handScanAction;
    if (handScanPending) {
      const player = handScanPending.player || getHeadlessConditionalPlayer(handScanPending);
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
      if (handScanPending.optional || !candidates.length) {
        candidates.push({
          id: "conditionalChoice",
          family: "accept_optional_effect",
          label: "跳过手牌扫描",
          target: { kind: "skip-hand-scan", choiceId: "skip" },
        });
      }
      return { actorPlayer: player, candidates };
    }
    const passReservePending = getPendingPassReserveSelection();
    if (passReservePending) {
      const player = getPlayerById(passReservePending.playerId) || getCurrentPlayer();
      return {
        actorPlayer: player,
        candidates: getPassReserveSelectionCards().map((card) => ({
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
    if (getPendingMovePayment()) {
      return enumerateHeadlessMovePaymentActions(getPendingMovePayment());
    }
    if (isTechTilePickingActive()) {
      const player = getCurrentPlayer();
      const pendingTileId = techGameState.ui.pendingTileId;
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
      const selectionOptions = getResearchTechSelectionOptions();
      const candidates = tech.listTakeableTiles(
        techGameState.board,
        player?.techState,
        { techTypes: techGameState.ui.allowedTechTypes },
      ).flatMap((tileId) => {
        if (industry?.isTechBlockedByPirates?.(player, tileId)) return [];
        if (selectionOptions.researchedByOthersOnly && !isTechTileOwnedByOtherPlayer(tileId)) return [];
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
    const dataPlacePending = getPendingDataPlacementDecision();
    if (dataPlacePending) {
      const player = getHeadlessConditionalPlayer(dataPlacePending);
      const candidates = (data.listPlaceDataChoices?.(player) || []).map((choice, choiceIndex) => ({
        id: "conditionalChoice",
        family: "choose_target",
        label: choice.label || `放置数据 ${choiceIndex + 1}`,
        target: {
          kind: "pending-data-placement",
          choiceId: `${choice.target}:${choice.blueSlot ?? ""}`,
          slotId: choice.target,
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
    const cardTriggerMovePending = getPendingCardTriggerFreeMove();
    if (cardTriggerMovePending) {
      const player = getCurrentPlayer();
      const providedMovePoints = Math.max(0, Math.round(Number(
        cardTriggerMovePending.match?.effect?.options?.movementPoints ?? 1
      ) || 0));
      const candidates = [];
      for (const rocket of getMovableTokensForPlayer(player?.id) || []) {
        for (const direction of [
          { id: "out", deltaX: 0, deltaY: 1 },
          { id: "cw", deltaX: 1, deltaY: 0 },
          { id: "ccw", deltaX: -1, deltaY: 0 },
          { id: "in", deltaX: 0, deltaY: -1 },
        ]) {
          if (!rocketActions.canMoveRocket(rocketState, rocket.id, direction.deltaX, direction.deltaY)?.ok) continue;
          const terrainRequired = getRequiredMovePointsForUi(
            player,
            rocket.id,
            direction.deltaX,
            direction.deltaY,
            cardTriggerMovePending.match?.effect?.options || {},
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
    const cardMovePending = decisionState.actionEffectFlow?.cardMoveEffect;
    if (cardMovePending) {
      const effect = cardMovePending.effect || getCurrentActionEffect();
      const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
      const candidates = [];
      for (const rocket of getMovableTokensForCardMoveEffect(effect, player?.id) || []) {
        for (const direction of [
          { id: "out", deltaX: 0, deltaY: 1 },
          { id: "cw", deltaX: 1, deltaY: 0 },
          { id: "ccw", deltaX: -1, deltaY: 0 },
          { id: "in", deltaX: 0, deltaY: -1 },
        ]) {
          if (!validateIndustryHuanyuMoveRocket(effect, rocket.id)?.ok) continue;
          if (!rocketActions.canMoveRocket(rocketState, rocket.id, direction.deltaX, direction.deltaY)?.ok) continue;
          const terrainRequired = getRequiredMovePointsForUi(
            player,
            rocket.id,
            direction.deltaX,
            direction.deltaY,
            effect?.options || {},
          );
          const supplemental = Math.max(0, terrainRequired - Math.max(0, cardMovePending.poolRemaining || 0));
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
      if (cardMovePending.moved) {
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
    const cardCornerMovePending = getPendingCardCornerFreeMove();
    if (cardCornerMovePending) {
      const player = getCurrentPlayer();
      const providedMovePoints = Math.max(0, Math.round(Number(
        cardCornerMovePending.action?.moveReward?.movementPoints
          ?? cardCornerMovePending.action?.movementPoints
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
          if (!rocketActions.canMoveRocket(rocketState, rocket.id, direction.deltaX, direction.deltaY)?.ok) continue;
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
    if (isPlayCardSelectionActive()) {
      const player = getCurrentPlayer();
      return {
        actorPlayer: player,
        candidates: (player?.hand || []).flatMap((card, handIndex) => {
          const cost = getCardPlayCost(card);
          if (!players.canAfford(player, cost)) return [];
          return [{
            id: "conditionalChoice",
            family: "choose_card",
            label: cards.getCardLabel(card),
            target: {
              kind: "play-hand-card",
              choiceId: String(handIndex),
              cardId: card.cardId || card.id || null,
              handIndex,
            },
            handIndex,
          }];
        }),
      };
    }
    const strategySlotPending = getPendingStrategySlotDecision();
    if (strategySlotPending) {
      return {
        actorPlayer: getHeadlessConditionalPlayer(strategySlotPending),
        candidates: (strategySlotPending.slotIds || []).map((slotId) => ({
          id: "conditionalChoice",
          family: "choose_reward",
          label: industry.getStrategyPassiveSlotLabel?.(slotId) || slotId,
          target: {
            kind: "strategy-passive-slot",
            choiceId: slotId,
            slotId,
          },
          slotId,
        })),
      };
    }
    const discardPending = decisionState.discardAction;
    if (discardPending) {
      const player = discardPending.player || getHeadlessConditionalPlayer(discardPending);
      const selectedIndexes = new Set(discardPending.selectedIndexes || []);
      return {
        actorPlayer: player,
        candidates: (player?.hand || []).flatMap((card, handIndex) => (
          selectedIndexes.has(handIndex) ? [] : [{
            id: "conditionalChoice",
            family: "choose_payment",
            label: cards.getCardLabel(card),
            target: {
              kind: "discard-hand-card",
              choiceId: String(handIndex),
              cardId: card.cardId || card.id || null,
              handIndex,
            },
            handIndex,
          }]
        )),
      };
    }
    const cardPending = decisionState.cardSelectionAction;
    if (cardPending) {
      if (["industry_deepspace_hand", "industry_future_hand"].includes(cardPending.type)) {
        const player = cardPending.player || getHeadlessConditionalPlayer(cardPending);
        return {
          actorPlayer: player,
          candidates: (player?.hand || []).flatMap((card, handIndex) => (
            cardPending.type === "industry_future_hand" && !isFutureSpanEligibleHandCard(card)
              ? []
              : [{
                id: "conditionalChoice",
                family: "choose_card",
                label: cards.getCardLabel(card),
                target: {
                  kind: "hand-card",
                  choiceId: String(handIndex),
                  cardId: card.cardId || card.id || null,
                  handIndex,
                },
                handIndex,
                pendingType: cardPending.type,
              }]
          )),
        };
      }
      const selectedSlots = new Set(cardPending.selectedSlots || []);
      const maxSelectable = Math.max(1, Math.round(Number(cardPending.maxSelectable) || 1));
      const candidates = (cardState.publicCards || []).flatMap((card, slotIndex) => (
        card
          && !selectedSlots.has(slotIndex)
          && selectedSlots.size < maxSelectable
          && (cardPending.type !== "public_scan" || getPublicScanChoicesForCard(card)?.ok)
          ? [{
          id: "conditionalChoice",
          family: "choose_card",
          label: cards.getCardLabel(card),
          target: {
            kind: "public-card",
            choiceId: String(slotIndex),
            slotId: String(slotIndex),
            cardId: card.cardId || card.id || null,
          },
          slotIndex,
        }] : []
      ));
      if (
        cardPending.type === "card_public_corner_discard"
        && selectedSlots.size >= getPublicCardMultiSelectMinSelectable(cardPending)
      ) {
        candidates.push({
          id: "conditionalChoice",
          family: "choose_branch",
          label: "确认弃除公共牌",
          target: { kind: "confirm-public-corner-discard", choiceId: "confirm" },
        });
      }
      if (
        cardPending.type === "public_scan"
        && selectedSlots.size >= getPublicScanMinSelectable(cardPending)
      ) {
        candidates.push({
          id: "conditionalChoice",
          family: "choose_branch",
          label: "确认公共牌扫描",
          target: { kind: "confirm-public-scan", choiceId: "confirm" },
        });
      }
      if (allowsBlindDrawInSelection() && canBlindDraw()) {
        candidates.push({
          id: "conditionalChoice",
          family: "choose_card",
          label: "盲抽",
          target: { kind: "blind-draw", choiceId: "blind-draw" },
        });
      }
      return {
        actorPlayer: cardPending.player || getHeadlessConditionalPlayer(cardPending),
        candidates,
      };
    }
    const landPending = getPendingLandTargetDecision();
    if (landPending) {
      const options = typeof landPending.getOptions === "function"
        ? landPending.getOptions()
        : abilities.planet.getLandOptions(createActionContext());
      return {
        actorPlayer: getHeadlessConditionalPlayer(landPending),
        candidates: (options?.ok ? options.choices || [] : []).map((choice, choiceIndex) => ({
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

    const tracePending = decisionState.alienTraceAction;
    const picker = decisionState.alienTracePickerState;
    if (tracePending && picker?.mode === "fangzhou-destination") {
      const player = getHeadlessConditionalPlayer(picker);
      const alienSlotId = Number(picker.selectedAlienSlotId || 0);
      const traceTypes = getFangzhouUnlockableTraceTypes(
        alienSlotId,
        picker.allowedTraceTypes || aliens.TRACE_TYPES,
        player,
      );
      const candidates = [];
      if (hasAlienTracePanelPlacementTarget(picker.allowedAlienSlotIds || null, picker.allowedTraceTypes || aliens.TRACE_TYPES, player)) {
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
      const player = getHeadlessConditionalPlayer(picker);
      const traceTypes = getFangzhouUnlockableTraceTypes(
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
      const slotIds = getAlienTraceChoiceSlotIds(picker.allowedAlienSlotIds);
      const traceTypes = picker.allowedTraceTypes?.length ? picker.allowedTraceTypes : aliens.TRACE_TYPES;
      const candidates = [];
      for (const alienSlotId of slotIds) {
        for (const traceType of traceTypes) {
          if (!canPlaceStateTrace(alienSlotId, traceType, "first")
            && !canPlaceStateTrace(alienSlotId, traceType, "extra")) continue;
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
      return { actorPlayer: getHeadlessConditionalPlayer(tracePending || picker), candidates };
    }
    return { actorPlayer: null, candidates: [] };
  }

  const CONDITIONAL_CHOICE_HANDLERS = Object.freeze({
    "conditional-sector": (action) => handleConditionalSectorChoice(action.target.sectorX ?? action.target.choiceId),
    "chong-fossil-choice": (action) => handleChongFossilChoice(action.target.choiceId),
    "probe-sector-selection": (action) => {
      const pending = getPendingProbeSectorScanDecision();
      if (!pending) return { ok: false, message: "没有待处理的探测器扫描" };
      pending.selectedRocketIds = [...(action.target.rocketIds || [])];
      return confirmProbeSectorScanSelection();
    },
    "runezu-symbol-branch": (action) => handleRunezuSymbolBranchChoice(action.target.choiceId),
    "runezu-face-symbol-choice": (action) => handleRunezuFaceSymbolChoice(action.target.choiceId),
    "amiba-symbol-choice": (action) => handleAmibaSymbolChoice(action.target.choiceId),
    "final-score-tile": (action) => handleFinalScoreTileClick(action.target.choiceId),
    "research-tech-tile": (action) => {
      const result = handleSupplyTechTileClick(action.target.tileId || action.target.choiceId);
      if (result?.ok !== false && techGameState.ui.pendingTileId) {
        const blueSlot = tech.getAvailableBlueSlots(getCurrentPlayer()?.techState)?.[0];
        if (blueSlot != null) return confirmTechBlueSlotChoice(blueSlot);
      }
      return result;
    },
    "research-tech-blue-slot": (action) => confirmTechBlueSlotChoice(Number(action.target.slotId)),
    "skip-research-tech": () => {
      cancelTechSelection();
      if (isActionEffectFlowActive()) skipCurrentActionEffect();
      return { ok: true, progressed: true, skipped: true, message: "已跳过无可用科技的效果" };
    },
    "fangzhou-trace-destination": (action) => handleFangzhouTraceDestinationChoice(
      action.destination, action.traceType || null,
    ),
    "fangzhou-unlock-color": (action) => handleFangzhouUnlockTraceChoice(action.target.traceType),
    "discard-corner-repeat": (action) => handleDiscardCornerRepeatChoice(action.target.cardId),
    "return-unfinished-task": (action) => handleReturnUnfinishedTaskChoice(action.target.cardId),
    "remove-orbit-to-probe": (action) => handleRemoveOrbitToProbeChoice(action.target.choiceId),
    "remove-planet-marker": (action) => handleRemovePlanetMarkerChoice(action.target.choiceId),
    "pending-data-placement": (action) => confirmDataPlacement(action.placementTarget, action.blueSlot),
    "skip-pending-data-placement": () => skipPendingDataPlacement()
      || { ok: true, progressed: true, skipped: true, message: "已跳过本次数据获得" },
    "discard-income-card": (action) => handleDiscardIncomeCardChoice(action.target.cardId),
    "confirm-discard-income": () => confirmDiscardAnyForIncome(),
    "pay-credit-reward": (action) => handlePayCreditChoice(action.target.choiceId),
    "scan-target": (action) => confirmScanTarget(action.target.nebulaId, action.target.sectorX),
    "pass-reserve-card": (action) => {
      selectPassReserveCard(action.target.choiceId);
      return confirmPassReserveSelection();
    },
    "hand-scan-card": (action) => handleHandScanCardClick(Number(action.target.handIndex)),
    "skip-hand-scan": () => {
      skipCurrentActionEffect();
      return { ok: true, progressed: true, skipped: true, message: "已跳过手牌扫描" };
    },
    "card-effect-move": (action) => executeCardMoveForEffect(action.deltaX, action.deltaY, action.target.rocketId),
    "card-trigger-free-move": (action) => executeFreeMoveForCardTrigger(action.deltaX, action.deltaY, action.target.rocketId),
    "skip-card-trigger-free-move": () => {
      const pending = getPendingCardTriggerFreeMove();
      const player = getCurrentPlayer();
      if (pending.beforePlayer) restoreObjectSnapshot(player, pending.beforePlayer);
      if (pending.beforeCardState) restoreObjectSnapshot(cardState, pending.beforeCardState);
      decisionSessions.clear(CARD_TRIGGER_FREE_MOVE_SESSION);
      rocketState.activeRocketId = null;
      clearMoveRocketHighlight();
      deactivateMoveMode();
      continueAfterCardTriggerResolution();
      return { ok: true, progressed: true, skipped: true, message: "已取消无法执行的卡牌触发" };
    },
    "finish-card-effect-move": () => finishCurrentCardMoveEffectEarly()
      ? { ok: true, progressed: true, message: "已结束剩余移动" }
      : { ok: false, message: "当前不能结束移动效果" },
    "skip-card-effect-move": () => {
      skipCurrentActionEffect();
      return { ok: true, progressed: true, skipped: true, message: "已跳过无可用路径的移动效果" };
    },
    "card-corner-free-move": (action) => executeFreeMoveForCardCorner(action.deltaX, action.deltaY, action.target.rocketId),
    "skip-card-corner-free-move": () => {
      const pending = getPendingCardCornerFreeMove();
      decisionSessions.clear(CARD_CORNER_FREE_MOVE_SESSION);
      rocketState.activeRocketId = null;
      clearMoveRocketHighlight();
      deactivateMoveMode();
      settleCardTasksAfterEffect({ events: pending.deferredEvents || [], render: false });
      if (pending.finishIndustryFlowAfterMove) {
        finishIndustryAbilityFlow(pending.afterMoveStatus || "公司 1x 行动：已跳过无法执行的免费移动");
      }
      return { ok: true, progressed: true, skipped: true, message: "已跳过无法执行的免费移动" };
    },
    "move-payment": (action) => {
      getPendingMovePayment().selectedHandIndices = [...(action.selectedHandIndices || [])];
      return confirmMovePayment({ automated: true });
    },
    "play-hand-card": (action) => {
      const selected = handlePlayCardSelect(Number(action.target.handIndex));
      return selected?.ok === false ? selected : confirmPlayCardSelection();
    },
    "strategy-passive-slot": (action) => confirmStrategyPassiveSlotChoice(action.target.slotId),
    "discard-hand-card": (action) => handleHandCardDiscard(Number(action.target.handIndex))
      || { ok: true, progressed: true, message: "已选择弃牌" },
    "public-card": (action) => handlePublicCardClick(Number(action.target.slotId))
      || { ok: true, progressed: true, message: "已选择公共牌" },
    "confirm-public-corner-discard": () => confirmPublicCornerDiscardSelection(),
    "confirm-public-scan": () => confirmPublicScanSelection(),
    "hand-card": (action) => decisionState.cardSelectionAction?.type === "industry_deepspace_hand"
      ? handleIndustryDeepspaceHandClick(Number(action.target.handIndex))
      : handleIndustryFutureSpanHandClick(Number(action.target.handIndex)),
    "blind-draw": () => drawCardForCurrentPlayer({ fromSelection: true }),
    "land-target": (action) => confirmLandTargetChoice(Number(action.target.choiceId)),
    "alien-state-trace": (action) => handleStateTraceSlotPlacement(
      Number(action.target.slotId), action.target.traceType,
    ),
  });

  function executeProductionConditionalChoice(workingRoot, choice, decision) {
    if (workingRoot !== browserRuleState) {
      return {
        ok: false,
        code: "CONDITIONAL_WORKING_ROOT_MISMATCH",
        message: "Conditional choice 必须写入当前 Browser Composition working root",
      };
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
    });
  }


    return Object.freeze({
      describeDecision: collectConditionalChoices,
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
      executeChoice: (...args) => resolve().executeChoice(...args),
    });
  }

  return Object.freeze({ createConditionalDecisionDomain });
});
