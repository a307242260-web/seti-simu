(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiConditionalDecisionDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createResolvedConditionalDecisionDomain(context) {
    const {
      finalScoring,
      FINAL_SCORE_IDS,
      getCurrentPlayer,
      getPendingProbeSectorScanDecision,
      getPendingProbeLocationRewardDecision,
      getPendingYichangdianCornerAction,
      getPendingYichangdianCornerCards,
      getHeadlessConditionalPlayer,
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
      getPendingCardTriggerAction,
      getPendingCardTaskCompletion,
      getPassReserveSelectionCards,
      isMovePaymentCard,
      isTechTilePickingActive,
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
      getRequiredMovePointsForUi,
      canPayForMove,
      formatRocketLabel,
      getEffectOwnerPlayer,
      getCurrentActionEffect,
      getMovableTokensForCardMoveEffect,
      validateIndustryHuanyuMoveRocket,
      getPendingCardCornerFreeMove,
      getPendingStrategySlotDecision,
      isFutureSpanEligibleHandCard,
      getPublicCardMultiSelectMinSelectable,
      getPublicScanMinSelectable,
      getPublicCardSelectedSlots,
      allowsBlindDrawInSelection,
      canBlindDraw,
      getPendingLandTargetDecision,
      getAlienTraceContinuation,
      getAlienTracePickerState,
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
      handleDrawnHandScanSkip,
      confirmPassReserveSelection,
      handleCardTriggerChoice,
      cancelCardTriggerChoice,
      confirmCardTaskCompletion,
      handleHandScanCardClick,
      executeCardMoveForEffect,
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
      finalizePendingDiscardSelection,
      cancelDiscardSelection,
      handlePublicCardClick,
      confirmPublicCornerDiscardSelection,
      confirmPublicScanSelection,
      handleIndustryDeepspaceHandClick,
      handleIndustryFutureSpanHandClick,
      drawCardForCurrentPlayer,
      confirmLandTargetChoice,
      handleStateTraceSlotPlacement,
    } = context;

  function enumerateHeadlessMovePaymentActions(workingRoot, movePending) {
    const player = (workingRoot.playerState?.players || []).find((entry) => entry.id === movePending.playerId)
      || getHeadlessConditionalPlayer(workingRoot, movePending);
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
    const probeSectorPending = getPendingProbeSectorScanDecision(workingRoot);
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
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, probeSectorPending),
        candidates: subsets.map((subset) => {
          const rocketIds = subset.map((choice) => choice.rocket.id);
          return {
            id: "conditionalChoice",
            family: "choose_target",
            label: `选择探测器 ${rocketIds.join(",")}`,
            target: { kind: "probe-sector-selection", choiceId: rocketIds.join(","), rocketIds },
            pendingContext: structuredClone(probeSectorPending),
          };
        }),
      };
    }
    const probeLocationPending = getPendingProbeLocationRewardDecision(workingRoot);
    if (probeLocationPending) {
      return {
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, probeLocationPending),
        candidates: (probeLocationPending.choices || []).map(({ rocket }) => ({
          id: "conditionalChoice",
          family: "choose_target",
          label: `探测器位置奖励 R${rocket.id}`,
          target: { kind: "probe-location-reward", choiceId: String(rocket.id), rocketId: rocket.id },
          pendingContext: structuredClone(probeLocationPending),
        })),
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
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, chongFossilPending),
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
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, runezuBranchPending),
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
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, amibaSymbolPending),
        candidates,
      };
    }
    const scanTargetPending = workingRoot.match?.scanTargetContinuation;
    if (scanTargetPending) {
      if (scanTargetPending.type === "sector_scan") {
        return {
          actorPlayer: getHeadlessConditionalPlayer(workingRoot, scanTargetPending),
          candidates: (scanTargetPending.choices || []).filter((choice) => choice?.disabled !== true).map((choice) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: choice.label || `扫描 ${choice.nebulaId}`,
            target: {
              kind: "sector-scan-target",
              choiceId: String(choice.nebulaId),
              nebulaId: choice.nebulaId,
              sectorX: choice.sectorX,
            },
            pendingContext: structuredClone(scanTargetPending),
          })),
        };
      }
      if (scanTargetPending.type === "conditional_sector_scan") {
        return {
          actorPlayer: getHeadlessConditionalPlayer(workingRoot, scanTargetPending),
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
          actorPlayer: getHeadlessConditionalPlayer(workingRoot, scanTargetPending),
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
          actorPlayer: getHeadlessConditionalPlayer(workingRoot, scanTargetPending),
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
          actorPlayer: getHeadlessConditionalPlayer(workingRoot, scanTargetPending),
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
          actorPlayer: getHeadlessConditionalPlayer(workingRoot, scanTargetPending),
          candidates: (scanTargetPending.choices || []).map((choice) => ({
            id: "conditionalChoice",
            family: "choose_target",
            label: choice.label || "移除星球标记",
            target: { kind: "remove-planet-marker", choiceId: choice.id },
          })),
        };
      }
      if (scanTargetPending.type === "discard_any_income") {
        const player = getHeadlessConditionalPlayer(workingRoot, scanTargetPending);
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
        const player = getHeadlessConditionalPlayer(workingRoot, scanTargetPending);
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
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, scanTargetPending),
        candidates: [
          ...(scanTargetPending.choices || []).flatMap((choice, choiceIndex) => (
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
          ...(scanTargetPending.type === "hand_scan" && scanTargetPending.discardDrawnOnSkip ? [{
            id: "conditionalChoice",
            family: "accept_optional_effect",
            label: "跳过盲抽手牌扫描",
            target: { kind: "skip-drawn-hand-scan", choiceId: "skip" },
          }] : []),
        ],
      };
    }
    const handScanPending = workingRoot.match?.handScanContinuation;
    if (handScanPending) {
      const player = getHeadlessConditionalPlayer(workingRoot, handScanPending);
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
    const passReservePending = getPendingPassReserveSelection(workingRoot);
    if (passReservePending) {
      const player = getPlayerById(workingRoot, passReservePending.playerId) || getCurrentPlayer(workingRoot);
      return {
        actorPlayer: player,
        candidates: getPassReserveSelectionCards(workingRoot).map((card) => ({
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
    const movePaymentContinuation = workingRoot.match?.movePaymentContinuation || null;
    if (movePaymentContinuation) {
      return enumerateHeadlessMovePaymentActions(workingRoot, movePaymentContinuation);
    }
    if (isTechTilePickingActive(workingRoot)) {
      const player = getHeadlessConditionalPlayer(
        workingRoot,
        workingRoot.match?.industryAbilityContinuation,
      ) || getCurrentPlayer(workingRoot);
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
    const dataPlacePending = getPendingDataPlacementDecision(workingRoot);
    if (dataPlacePending) {
      const player = getHeadlessConditionalPlayer(workingRoot, dataPlacePending);
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
    const cardTriggerPending = getPendingCardTriggerAction(workingRoot);
    if (cardTriggerPending) {
      return {
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, cardTriggerPending) || getCurrentPlayer(workingRoot),
        candidates: (cardTriggerPending.matches || []).map((match, choiceIndex) => ({
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
    const cardTaskPending = getPendingCardTaskCompletion(workingRoot);
    if (cardTaskPending?.ready) {
      const transports = cardTaskPending.ready.chongTask
        && cardTaskPending.ready.task?.kind === "transport"
        ? cardTaskPending.ready.deliveredTransports || []
        : [];
      const choices = transports.length > 1
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
        }];
      return {
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, cardTaskPending) || getCurrentPlayer(workingRoot),
        candidates: choices,
      };
    }
    const cardTriggerMovePending = getPendingCardTriggerFreeMove(workingRoot);
    if (cardTriggerMovePending) {
      const player = getHeadlessConditionalPlayer(workingRoot, cardTriggerMovePending) || getCurrentPlayer(workingRoot);
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
          if (!rocketActions.canMoveRocket(workingRoot.rocketState, rocket.id, direction.deltaX, direction.deltaY)?.ok) continue;
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
    const scanFreeMovePending = workingRoot.match?.scanFreeMoveContinuation;
    if (scanFreeMovePending) {
      const player = getHeadlessConditionalPlayer(workingRoot, scanFreeMovePending);
      const candidates = [];
      for (const rocket of rocketActions.getMovableTokensForPlayer(workingRoot.rocketState, player?.id) || []) {
        for (const direction of [
          { id: "out", deltaX: 0, deltaY: 1 },
          { id: "cw", deltaX: 1, deltaY: 0 },
          { id: "ccw", deltaX: -1, deltaY: 0 },
          { id: "in", deltaX: 0, deltaY: -1 },
        ]) {
          if (!rocketActions.canMoveRocket(workingRoot.rocketState, rocket.id, direction.deltaX, direction.deltaY)?.ok) continue;
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
    const industryFreeMovePending = workingRoot.match?.industryFreeMoveContinuation;
    if (industryFreeMovePending) {
      const player = getHeadlessConditionalPlayer(workingRoot, industryFreeMovePending);
      const movedRocketIds = new Set((industryFreeMovePending.movedRocketIds || []).map(String));
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
    const cardMovePending = workingRoot.match?.cardMoveContinuation;
    if (cardMovePending) {
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
    const cardCornerMovePending = getPendingCardCornerFreeMove(workingRoot);
    if (cardCornerMovePending) {
      const player = getHeadlessConditionalPlayer(workingRoot, cardCornerMovePending) || getCurrentPlayer(workingRoot);
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
    const strategySlotPending = getPendingStrategySlotDecision(workingRoot);
    if (strategySlotPending) {
      return {
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, strategySlotPending),
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
    const discardPending = workingRoot.match?.discardContinuation;
    if (discardPending) {
      const player = getHeadlessConditionalPlayer(workingRoot, discardPending);
      const count = Math.max(0, Math.round(Number(discardPending.count) || 0));
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
          ...(!discardPending.required ? [{
            id: "conditionalChoice",
            family: "accept_optional_effect",
            label: "取消弃牌",
            target: { kind: "cancel-discard-selection", choiceId: "cancel" },
          }] : []),
        ],
      };
    }
    const cardPending = workingRoot.match?.cardSelectionContinuation;
    if (cardPending) {
      if (["industry_deepspace_hand", "industry_future_hand"].includes(cardPending.type)) {
        const player = getHeadlessConditionalPlayer(workingRoot, cardPending);
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
      const selectedSlots = new Set(getPublicCardSelectedSlots?.() || []);
      const maxSelectable = Math.max(1, Math.round(Number(cardPending.maxSelectable) || 1));
      const candidates = (workingRoot.cardState.publicCards || []).flatMap((card, slotIndex) => (
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
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, cardPending),
        candidates,
      };
    }
    const landPending = getPendingLandTargetDecision(workingRoot);
    if (landPending) {
      return {
        actorPlayer: getHeadlessConditionalPlayer(workingRoot, landPending),
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

    const tracePending = getAlienTraceContinuation(workingRoot);
    const picker = getAlienTracePickerState();
    if (tracePending && picker?.mode === "fangzhou-destination") {
      const player = getHeadlessConditionalPlayer(workingRoot, picker);
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
      const player = getHeadlessConditionalPlayer(workingRoot, picker);
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
      return { actorPlayer: getHeadlessConditionalPlayer(workingRoot, tracePending || picker), candidates };
    }
    return { actorPlayer: null, candidates: [] };
  }

  const CONDITIONAL_CHOICE_HANDLERS = Object.freeze({
    "conditional-sector": (action) => handleConditionalSectorChoice(action.target.sectorX ?? action.target.choiceId),
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
      const pending = action.pendingContext || getPendingProbeSectorScanDecision(workingRoot);
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
      action.pendingContext || null,
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
    "skip-research-tech": (_action, workingRoot) => {
      cancelTechSelection(workingRoot);
      if (isActionEffectFlowActive(workingRoot)) skipCurrentActionEffect(workingRoot);
      return { ok: true, progressed: true, skipped: true, message: "已跳过无可用科技的效果" };
    },
    "fangzhou-trace-destination": (action, workingRoot) => handleFangzhouTraceDestinationChoice(
      workingRoot, action.destination, action.traceType || null,
    ),
    "fangzhou-unlock-color": (action, workingRoot) => handleFangzhouUnlockTraceChoice(workingRoot, action.target.traceType),
    "discard-corner-repeat": (action) => handleDiscardCornerRepeatChoice(action.target.cardId),
    "return-unfinished-task": (action) => handleReturnUnfinishedTaskChoice(action.target.cardId),
    "remove-orbit-to-probe": (action) => handleRemoveOrbitToProbeChoice(action.target.choiceId),
    "remove-planet-marker": (action) => handleRemovePlanetMarkerChoice(action.target.choiceId),
    "pending-data-placement": (action, workingRoot) => confirmDataPlacement(workingRoot, action.placementTarget, action.blueSlot),
    "skip-pending-data-placement": (_action, workingRoot) => skipPendingDataPlacement(workingRoot)
      || { ok: true, progressed: true, skipped: true, message: "已跳过本次数据获得" },
    "discard-income-card": (action) => handleDiscardIncomeCardChoice(action.target.cardId),
    "confirm-discard-income": () => confirmDiscardAnyForIncome(),
    "pay-credit-reward": (action) => handlePayCreditChoice(action.target.choiceId),
    "scan-target": (action, workingRoot) => confirmScanTarget(
      workingRoot,
      action.target.nebulaId,
      action.target.sectorX,
    ),
    "skip-drawn-hand-scan": (_action, workingRoot) => handleDrawnHandScanSkip(workingRoot),
    "pass-reserve-card": (action, workingRoot) => {
      return confirmPassReserveSelection(workingRoot, action.target.choiceId);
    },
    "card-trigger": (action, workingRoot) => handleCardTriggerChoice(
      workingRoot,
      Number(action.target.choiceIndex),
    ),
    "card-trigger-cancel": (_action, workingRoot) => cancelCardTriggerChoice(workingRoot)
      ? { ok: true, progressed: true, skipped: true, message: "已取消卡牌触发" }
      : { ok: false, message: "当前没有可取消的卡牌触发" },
    "card-task-completion": (action, workingRoot) => confirmCardTaskCompletion(
      workingRoot,
      action.target.choiceId,
      { automated: true },
    ),
    "hand-scan-card": (action, workingRoot) => handleHandScanCardClick(workingRoot, Number(action.target.handIndex)),
    "skip-hand-scan": (_action, workingRoot) => {
      delete workingRoot.match.handScanContinuation;
      skipCurrentActionEffect(workingRoot);
      return { ok: true, progressed: true, skipped: true, message: "已跳过手牌扫描" };
    },
    "card-effect-move": (action, workingRoot) => executeCardMoveForEffect(workingRoot, action.deltaX, action.deltaY, action.target.rocketId),
    "scan-free-move": (action, workingRoot) => executeFreeMoveForScanAction4(
      workingRoot,
      action.deltaX,
      action.deltaY,
      action.target.rocketId,
    ),
    "card-trigger-free-move": (action, workingRoot) => executeFreeMoveForCardTrigger(
      workingRoot,
      action.deltaX,
      action.deltaY,
      action.target.rocketId,
    ),
    "skip-card-trigger-free-move": (_action, workingRoot) => {
      const pending = getPendingCardTriggerFreeMove(workingRoot);
      const player = getCurrentPlayer(workingRoot);
      if (pending.beforePlayer) restoreObjectSnapshot(player, pending.beforePlayer);
      if (pending.beforeCardState) restoreObjectSnapshot(workingRoot.cardState, pending.beforeCardState);
      delete workingRoot.match.cardTriggerFreeMoveContinuation;
      workingRoot.rocketState.activeRocketId = null;
      clearMoveRocketHighlight();
      deactivateMoveMode();
      continueAfterCardTriggerResolution(workingRoot);
      return { ok: true, progressed: true, skipped: true, message: "已取消无法执行的卡牌触发" };
    },
    "finish-card-effect-move": () => finishCurrentCardMoveEffectEarly()
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
    ),
    "industry-free-move": (action, workingRoot) => executeIndustryFreeMove(
      workingRoot,
      action.deltaX,
      action.deltaY,
      action.target.rocketId,
    ),
    "finish-industry-free-move": (_action, workingRoot) => {
      const pending = workingRoot.match?.industryFreeMoveContinuation;
      finishIndustryAbilityFlow(workingRoot, `${pending?.label || "公司免费移动"}：已结束`);
      return { ok: true, progressed: true, skipped: true, message: "已结束公司免费移动" };
    },
    "skip-card-corner-free-move": (_action, workingRoot) => {
      const pending = getPendingCardCornerFreeMove(workingRoot);
      delete workingRoot.match.cardCornerFreeMoveContinuation;
      workingRoot.rocketState.activeRocketId = null;
      clearMoveRocketHighlight();
      deactivateMoveMode();
      settleCardTasksAfterEffect({ events: pending.deferredEvents || [], render: false });
      if (pending.finishIndustryFlowAfterMove) {
        finishIndustryAbilityFlow(pending.afterMoveStatus || "公司 1x 行动：已跳过无法执行的免费移动");
      }
      return { ok: true, progressed: true, skipped: true, message: "已跳过无法执行的免费移动" };
    },
    "move-payment": (action) => {
      return resolveMovePaymentDecision({
        automated: true,
        selectedHandIndices: [...(action.selectedHandIndices || [])],
      });
    },
    "strategy-passive-slot": (action) => confirmStrategyPassiveSlotChoice(action.target.slotId),
    "discard-hand-cards": (action, workingRoot) => finalizePendingDiscardSelection(
      workingRoot,
      action.target.handIndexes,
    ),
    "cancel-discard-selection": (_action, workingRoot) => cancelDiscardSelection(workingRoot)
      || { ok: true, progressed: true, skipped: true, message: "已取消弃牌" },
    "public-card": (action, workingRoot) => handlePublicCardClick(workingRoot, Number(action.target.slotId))
      || { ok: true, progressed: true, message: "已选择公共牌" },
    "confirm-public-corner-discard": (_action, workingRoot) => confirmPublicCornerDiscardSelection(workingRoot),
    "confirm-public-scan": (_action, workingRoot) => confirmPublicScanSelection(workingRoot),
    "hand-card": (action, workingRoot) => workingRoot.match?.cardSelectionContinuation?.type === "industry_deepspace_hand"
      ? handleIndustryDeepspaceHandClick(workingRoot, Number(action.target.handIndex))
      : handleIndustryFutureSpanHandClick(workingRoot, Number(action.target.handIndex)),
    "blind-draw": (_action, workingRoot) => drawCardForCurrentPlayer(workingRoot, { fromSelection: true }),
    "land-target": (action, workingRoot) => confirmLandTargetChoice(workingRoot, Number(action.target.choiceId)),
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
    }, workingRoot);
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
