(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppEffectDispatcher = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createEffectDispatcher(context = {}) {
    const {
      BANRENMA_PANEL_BONUS_EFFECT_TYPE,
      JIUZHE_THRESHOLD_CARD_EFFECT_TYPE,
      abilities,
      alienTraceRewardFlow,
      aliens,
      amiba,
      aomomo,
      applyIncomeGainWithImmediateRewards,
      banrenma,
      beginAlienTraceBoardPlacement,
      beginCardMoveEffect,
      beginCardSelection,
      beginDiscardSelection,
      beginEffectHistoryStep,
      beginPassReserveSelection,
      buildNebulaScanChoice,
      cardEffects,
      chong,
      claimRunezuSourceSymbolWithHistory,
      closeAlienTracePicker,
      completeCurrentActionEffect,
      createActionContext,
      createPublicScanPendingAction,
      endEffectHistoryStep,
      executeAomomoFossilForDataEffect,
      executeAomomoFossilMoveAndLandEffect,
      executeAomomoGainFossilsEffect,
      executeAomomoLandEffect,
      executeAomomoSpendFossilsScoreEffect,
      executeAomomoVisitThisTurnFossilEffect,
      executeBanrenmaPanelBonusEffect,
      executeCardDrawThenDiscardActionEffect,
      executeCardFixedNebulaScanEffect,
      executeCardLandEffect,
      executeCardOrbitEffect,
      executeCardResearchTechEffect,
      executeChongChoosePlanetFossilRewardEffect,
      executeChongPickupFossilEffect,
      executeChongProbePlanetFossilRewardEffect,
      executeChongTaskCleanupEffect,
      executeChongTravelForPickupEffect,
      executeChooseHandCornerRewardEffect,
      executeConditionalRewardEffect,
      executeConditionalSectorScanEffect,
      executeCountAliensResourceEffect,
      executeCountCurrentIncomeResourceEffect,
      executeCountHandCornerMoveEffect,
      executeCountHandIncomeResourceEffect,
      executeCountOwnedTechRewardEffect,
      executeCountRocketsRewardEffect,
      executeCountTechTypesRewardEffect,
      executeDiscardAllHandEffect,
      executeDiscardAnyForIncomeEffect,
      executeDiscardCardCornerRepeatEffect,
      executeDiscardPublicCornerRewardsEffect,
      executeDrawCardsRewardEffect,
      executeEarthSectorContentMoveEffect,
      executeGainDataRewardEffect,
      executeGainResourcesRewardEffect,
      executeHandScanEffect,
      executeHuanyuSuperdrivePassLaunchEffect,
      executeImprovedEarthSectorScanEffect,
      executeIndustryFundamentalismExchangeEffect,
      executeIndustryHeliosPassiveRewardEffect,
      executeIndustryPiratesRaidLaunchEffect,
      executeIndustryPiratesRaidMarkerEffect,
      executeIndustryPiratesRaidPublicityEffect,
      executeIndustrySentinelCornerEffect,
      executeIndustryStrategyPassiveRewardEffect,
      executeIndustryStratusCornerEffect,
      executeJiuzheThresholdCardEffect,
      executeLandingSectorScanEffect,
      executeLaunchRewardEffect,
      executeOptionalDiscardScanEffect,
      executePassFirstRotateEffect,
      executePassHandLimitEffect,
      executePayCreditsForRewardEffect,
      executePickCardCornerRewardEffect,
      executePlanetSectorScanEffect,
      executePlutoReserveEffect,
      executeProbeLocationRewardEffect,
      executeProbeSectorScanEffect,
      executeProbeStackRewardEffect,
      executeRegisterEventBonusEffect,
      executeRemoveOrbitToProbeEffect,
      executeReturnPlayedCardToHandIfEffect,
      executeReturnUnfinishedTaskToHandEffect,
      executeRunezuSymbolRewardEffect,
      executeScanActionFinalizeEffect,
      executeScanPublicRefillEffect,
      executeSectorFinishScanEffect,
      executeSectorScanAtPlanet,
      executeSectorXScanEffect,
      executeTuckPlayedCardToIncomeEffect,
      executeYichangdianAlienTraceEffect,
      executeYichangdianAnomalySignalScoreEffect,
      executeYichangdianDrawThenTwoCornersEffect,
      executeYichangdianLaunchAnomalyMoveEffect,
      executeYichangdianNextAnomalyRewardEffect,
      executeYichangdianNextAnomalyScanEffect,
      executeYichangdianPublicAllEffect,
      expandCardScanActionEffect,
      expandScanChoicesWithAomomoTargets,
      finishAutomaticRewardEffect,
      formatIncomeGain,
      getCurrentPlayer,
      getEffectOwnerPlayer,
      getEffectTargetPlayer,
      getEligibleAlienSlotIdsForTraceEffect,
      getPlayerById,
      getPublicScanMaxSelectable,
      getPublicScanChoicesForCard,
      getResearchTechSelectionPayload,
      hasAlienTracePanelPlacementTarget,
      hasHandScanTargetCard,
      historyCommands,
      jiuzhe,
      maybeApplyIndustryLaunchScan,
      maybeConsumeAlienLabPanelForMainAction,
      onTechTileTaken,
      openAmibaSymbolChoiceDialog,
      openAmibaTraceRemovalDialog,
      openAomomoCardGainDialog,
      openAomomoCurrentXScanEffect,
      openAomomoFossilAnyScanEffect,
      openCardAnySectorScanEffect,
      openCardColorScanEffect,
      openCardDrawThenScanEffect,
      openCardPublicScanEffect,
      openFangzhouTraceDestinationChoice,
      openRemovePlanetMarkerPicker,
      openRunezuSymbolBranchDialog,
      openScanAction4Picker,
      openScanTargetPicker,
      planetRewards,
      recordAbilityCommands,
      recordHistoryCommand,
      recordTechBonusScore,
      renderDebugPlayerSwitch,
      renderPlayerHand,
      renderPlayerStats,
      renderRockets,
      renderRotateStateToken,
      renderRunezuBoardSymbols,
      renderSectorNebulaDataBoard,
      renderStateReadout,
      renderWheels,
      resolvePlayerReference,
      runezu,
      scanEffects,
      shouldSkipCurrentResearchTechCost,
      skipActionEffectWithMessage,
      syncHandScanSelectionChrome,
      tech,
      updateActionButtons,
    } = context;
    const ruleAlienGameState = (workingRoot) => workingRoot.alienGameState;
    const ruleCardState = (workingRoot) => workingRoot.cardState;
    const rulePlayerState = (workingRoot) => workingRoot.playerState;
    const ruleRocketState = (workingRoot) => workingRoot.rocketState;
    const ruleTurnState = (workingRoot) => workingRoot.turnState;
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

    function executeCardEffect(workingRoot, effect) {
      const types = cardEffects.EFFECT_TYPES;
      switch (effect.type) {
        case types.SCAN_NEBULA:
          return executeCardFixedNebulaScanEffect(workingRoot, effect);
        case types.SCAN_COLOR_CHOICE:
        case "card_color_scan":
          return openCardColorScanEffect(workingRoot, effect);
        case types.PUBLIC_SCAN:
          return openCardPublicScanEffect(workingRoot, effect);
        case types.ANY_SECTOR_SCAN:
          return openCardAnySectorScanEffect(workingRoot, effect);
        case types.SCAN_ACTION:
          return expandCardScanActionEffect(workingRoot, effect);
        case types.RESEARCH_TECH:
          return executeCardResearchTechEffect(workingRoot, effect);
        case types.CARD_ORBIT:
          return executeCardOrbitEffect(workingRoot, effect);
        case types.CARD_LAND:
          return executeCardLandEffect(workingRoot, effect);
        case types.REMOVE_PLANET_MARKER:
          return openRemovePlanetMarkerPicker(workingRoot, effect);
        case types.PROBE_SECTOR_SCAN:
          return executeProbeSectorScanEffect(workingRoot, effect);
        case types.PLANET_SECTOR_SCAN:
          return executePlanetSectorScanEffect(workingRoot, effect);
        case types.SECTOR_X_SCAN:
          return executeSectorXScanEffect(workingRoot, effect);
        case types.INCOME:
          return openCardIncomeEffect(workingRoot, effect);
        case types.REGISTER_EVENT_BONUS:
          return executeRegisterEventBonusEffect(workingRoot, effect);
        case types.COUNT_HAND_INCOME_RESOURCE:
          return executeCountHandIncomeResourceEffect(workingRoot, effect);
        case types.COUNT_CURRENT_INCOME_RESOURCE:
          return executeCountCurrentIncomeResourceEffect(workingRoot, effect);
        case types.COUNT_ALIENS_RESOURCE:
          return executeCountAliensResourceEffect(workingRoot, effect);
        case types.TUCK_PLAYED_CARD_TO_INCOME:
          return executeTuckPlayedCardToIncomeEffect(workingRoot, effect);
        case types.PICK_CARD_CORNER_REWARD:
          return executePickCardCornerRewardEffect(workingRoot, effect);
        case types.FREE_MOVE:
        case types.CARD_MOVE:
          return beginCardMoveEffect(effect);
        case types.DRAW_THEN_SCAN:
          return openCardDrawThenScanEffect(workingRoot, effect);
        case types.DRAW_THEN_DISCARD_ACTION:
          return executeCardDrawThenDiscardActionEffect(workingRoot, effect);
        case types.CONDITIONAL_REWARD:
          return executeConditionalRewardEffect(workingRoot, effect);
        case types.OPTIONAL_DISCARD_SCAN:
          return executeOptionalDiscardScanEffect(workingRoot, effect);
        case types.HAND_SCAN:
          return executeHandScanEffect(workingRoot, effect);
        case types.COUNT_HAND_CORNER_MOVE:
          return executeCountHandCornerMoveEffect(workingRoot, effect);
        case types.CHOOSE_HAND_CORNER_REWARD:
          return executeChooseHandCornerRewardEffect(workingRoot, effect);
        case types.DISCARD_PUBLIC_CORNER_REWARDS:
          return executeDiscardPublicCornerRewardsEffect(workingRoot, effect);
        case types.RETURN_PLAYED_CARD_TO_HAND_IF:
          return executeReturnPlayedCardToHandIfEffect(workingRoot, effect);
        case types.LANDING_SECTOR_SCAN:
          return executeLandingSectorScanEffect(workingRoot, effect);
        case types.CONDITIONAL_SECTOR_SCAN:
          return executeConditionalSectorScanEffect(workingRoot, effect);
        case types.DISCARD_ANY_FOR_INCOME:
          return executeDiscardAnyForIncomeEffect(workingRoot, effect);
        case types.PAY_CREDITS_FOR_REWARD:
          return executePayCreditsForRewardEffect(workingRoot, effect);
        case types.DISCARD_CARD_CORNER_REPEAT:
          return executeDiscardCardCornerRepeatEffect(workingRoot, effect);
        case types.REMOVE_ORBIT_TO_PROBE:
          return executeRemoveOrbitToProbeEffect(workingRoot, effect);
        case types.RETURN_UNFINISHED_TASK_TO_HAND:
          return executeReturnUnfinishedTaskToHandEffect(workingRoot, effect);
        case types.COUNT_TECH_TYPES_REWARD:
          return executeCountTechTypesRewardEffect(workingRoot, effect);
        case types.COUNT_OWNED_TECH_REWARD:
          return executeCountOwnedTechRewardEffect(workingRoot, effect);
        case types.COUNT_ROCKETS_REWARD:
          return executeCountRocketsRewardEffect(workingRoot, effect);
        case types.DISCARD_ALL_HAND:
          return executeDiscardAllHandEffect(workingRoot, effect);
        case types.PROBE_STACK_REWARD:
          return executeProbeStackRewardEffect(workingRoot, effect);
        case types.PROBE_LOCATION_REWARD:
          return executeProbeLocationRewardEffect(workingRoot, effect);
        case types.EARTH_SECTOR_CONTENT_MOVE:
          return executeEarthSectorContentMoveEffect(workingRoot, effect);
        case types.PLUTO_RESERVE:
          return executePlutoReserveEffect(workingRoot, effect);
        case types.YICHANGDIAN_NEXT_ANOMALY_REWARD:
          return executeYichangdianNextAnomalyRewardEffect(workingRoot, effect);
        case types.YICHANGDIAN_ANOMALY_SIGNAL_SCORE:
          return executeYichangdianAnomalySignalScoreEffect(workingRoot, effect);
        case types.YICHANGDIAN_ALIEN_TRACE:
          return executeYichangdianAlienTraceEffect(workingRoot, effect);
        case types.YICHANGDIAN_PUBLIC_ALL:
          return executeYichangdianPublicAllEffect(workingRoot, effect);
        case types.YICHANGDIAN_DRAW_THEN_TWO_CORNERS:
          return executeYichangdianDrawThenTwoCornersEffect(workingRoot, effect);
        case types.YICHANGDIAN_NEXT_ANOMALY_SCAN:
          return executeYichangdianNextAnomalyScanEffect(workingRoot, effect);
        case types.YICHANGDIAN_LAUNCH_ANOMALY_MOVE:
          return executeYichangdianLaunchAnomalyMoveEffect(workingRoot, effect);
        case chong?.EFFECT_TYPES?.CHONG_LAND_FOR_PICKUP:
        case chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP:
          return executeChongTravelForPickupEffect(workingRoot, effect);
        case chong?.EFFECT_TYPES?.CHONG_PICKUP_FOSSIL:
          return executeChongPickupFossilEffect(workingRoot, effect);
        case chong?.EFFECT_TYPES?.CHONG_PROBE_PLANET_FOSSIL_REWARD:
          return executeChongProbePlanetFossilRewardEffect(workingRoot, effect);
        case chong?.EFFECT_TYPES?.CHONG_CHOOSE_PLANET_FOSSIL_REWARD:
          return executeChongChoosePlanetFossilRewardEffect(workingRoot, effect);
        case chong?.EFFECT_TYPES?.CHONG_TASK_CLEANUP:
          return executeChongTaskCleanupEffect(workingRoot, effect);
        case amiba?.EFFECT_TYPES?.CHOOSE_SYMBOL_REWARD:
          return openAmibaSymbolChoiceDialog({
            effect,
            region: effect.options?.region,
            player: getCurrentPlayer(),
            fromEffectFlow: true,
            beforeAlienState: structuredClone(ruleAlienGameState(workingRoot)),
            beforePlayerState: structuredClone(rulePlayerState(workingRoot)),
            beforeCardState: structuredClone(ruleCardState(workingRoot)),
          });
        case amiba?.EFFECT_TYPES?.REMOVE_TRACE_FOR_REGION_REWARD:
          return openAmibaTraceRemovalDialog(effect);
        case runezu?.EFFECT_TYPES?.SYMBOL_REWARD:
          return executeRunezuSymbolRewardEffect(effect);
        case runezu?.EFFECT_TYPES?.SYMBOL_BRANCH:
          return openRunezuSymbolBranchDialog(effect);
        case aomomo?.EFFECT_GAIN_FOSSILS:
          return executeAomomoGainFossilsEffect(workingRoot, effect);
        case aomomo?.EFFECT_VISIT_AOMOMO_THIS_TURN_FOSSIL:
          return executeAomomoVisitThisTurnFossilEffect(workingRoot, effect);
        case aomomo?.EFFECT_SCAN_AOMOMO_X:
        case aomomo?.EFFECT_SCAN_AOMOMO_X_GAIN_FOSSIL:
        case aomomo?.EFFECT_SCAN_AOMOMO_X_SCORE:
          return openAomomoCurrentXScanEffect(workingRoot, effect);
        case aomomo?.EFFECT_LAND_SCORE_IF_AOMOMO:
          return executeAomomoLandEffect(workingRoot, effect);
        case aomomo?.EFFECT_FOSSIL_FOR_DATA:
          return executeAomomoFossilForDataEffect(workingRoot, effect);
        case aomomo?.EFFECT_FOSSIL_FOR_MOVE_AND_LAND:
          return executeAomomoFossilMoveAndLandEffect(workingRoot, effect);
        case aomomo?.EFFECT_FOSSIL_FOR_ANY_SCAN:
          return openAomomoFossilAnyScanEffect(workingRoot, effect);
        case aomomo?.EFFECT_SPEND_FOSSILS_GAIN_SCORE:
          return executeAomomoSpendFossilsScoreEffect(workingRoot, effect);
        case "aomomo_land_only":
          return executeAomomoLandEffect(workingRoot, effect);
        default:
          return null;
      }
    }

    function openPickCardRewardEffect(workingRoot, effect) {
      const currentPlayer = getCurrentPlayer();
      decisionState.cardSelectionAction = null;
      const result = beginCardSelection({
        type: "planet_reward_pick_card",
        player: currentPlayer,
        effectLabel: effect.label,
        allowBlindDraw: true,
      });
      if (!result.ok) {
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
      }
      return result;
    }

    function openTechBonusPickCardEffect(workingRoot, effect) {
      const selection = getResearchTechSelectionPayload();
      const currentPlayer = getCurrentPlayer();
      const result = beginCardSelection({
        type: "tech_bonus_pick_card",
        player: currentPlayer,
        effectLabel: effect.label,
        bonusId: effect.options?.bonusId || selection?.bonusId,
        firstTake: Boolean(effect.options?.firstTake ?? selection?.firstTake),
        selection,
        allowBlindDraw: true,
      });
      if (!result.ok) {
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
      }
      return result;
    }

    function openInitialIncomeEffect(workingRoot, effect) {
      const playerId = effect?.options?.playerId;
      const incomePlayer = getPlayerById(playerId) || getCurrentPlayer();

      if (incomePlayer?.id) {
        rulePlayerState(workingRoot).currentPlayerId = incomePlayer.id;
        renderDebugPlayerSwitch();
        renderPlayerStats();
        renderPlayerHand();
      }

      const result = beginDiscardSelection(1, {
        type: "initial_income",
        player: incomePlayer,
        fromEffectFlow: true,
        effectLabel: effect.label,
      });
      if (!result.ok) {
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
        effect.result = { ok: false, undoable: false, message: result.message };
        completeCurrentActionEffect("skipped");
      }
      return result;
    }

    function openCardIncomeEffect(workingRoot, effect) {
      const incomePlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
      const result = beginDiscardSelection(1, {
        type: "card_income",
        player: incomePlayer,
        fromEffectFlow: true,
        effectLabel: effect.label,
        beforePlayerState: structuredClone(incomePlayer),
        beforeCardState: structuredClone(ruleCardState(workingRoot)),
      });
      if (!result.ok) {
        return finishAutomaticRewardEffect(workingRoot, effect, {
          ok: true,
          skipped: true,
          undoable: true,
          message: `${effect.label}：没有手牌可作为收入，已跳过`,
          payload: { reason: result.message || null },
        });
      }
      return result;
    }

    function openFundamentalismRoundStartIncomeEffect(workingRoot, effect) {
      const incomePlayer = getEffectOwnerPlayer(effect);
      const round = Math.max(1, Math.round(Number(effect?.options?.roundNumber || ruleTurnState(workingRoot).roundNumber) || 1));
      if (!incomePlayer?.hand?.length) {
        if (incomePlayer) incomePlayer.industryFundamentalismRoundStartIncomeRound = round;
        return finishAutomaticRewardEffect(workingRoot, effect, {
          ok: true,
          undoable: true,
          skipped: true,
          message: `原教旨主义：第${round}轮开始没有手牌可作为收入，已跳过`,
          payload: { roundNumber: round, skipped: true },
        });
      }

      const result = beginDiscardSelection(1, {
        type: "industry_fundamentalism_income",
        player: incomePlayer,
        required: true,
        fromEffectFlow: true,
        effectLabel: effect.label,
        beforePlayerState: structuredClone(incomePlayer),
        beforeCardState: structuredClone(ruleCardState(workingRoot)),
        roundNumber: round,
      });
      if (!result.ok) {
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
        effect.result = { ok: false, undoable: true, message: result.message };
        completeCurrentActionEffect("skipped");
      }
      return result;
    }

    function openIncomeRewardEffect(workingRoot, effect) {
      const currentPlayer = getEffectTargetPlayer(workingRoot, effect);
      if (!currentPlayer?.hand?.length) {
        effect.result = {
          ok: true,
          undoable: true,
          skipped: true,
          message: `${effect.label}：${currentPlayer?.colorLabel || currentPlayer?.name || "玩家"}没有手牌可用于收入，跳过`,
        };
        ruleRocketState(workingRoot).statusNote = effect.result.message;
        renderPlayerStats();
        renderPlayerHand();
        completeCurrentActionEffect();
        renderStateReadout();
        return effect.result;
      }
      const result = beginDiscardSelection(1, {
        type: "planet_reward_income",
        player: currentPlayer,
        beforePlayerState: structuredClone(currentPlayer),
        beforeCardState: structuredClone(ruleCardState(workingRoot)),
        effectLabel: effect.label,
      });
      if (!result.ok) {
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
      }
      return result;
    }

    function executeBanrenmaGainIncomeEffect(workingRoot, effect) {
      const currentPlayer = getEffectTargetPlayer(workingRoot, effect);
      const gain = effect.options?.gain || {};
      const beforePlayer = structuredClone(currentPlayer);
      beginEffectHistoryStep(effect.label);
      const incomeResult = applyIncomeGainWithImmediateRewards(currentPlayer, gain, "banrenma-income");
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复半人马收入前玩家状态",
      ));
      effect.result = {
        ok: true,
        undoable: incomeResult.undoable,
        irreversible: incomeResult.irreversible,
        message: `收入增加：${formatIncomeGain(gain)}`,
      };
      ruleRocketState(workingRoot).statusNote = effect.result.message;
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function openNebulaChoiceRewardEffect(workingRoot, effect) {
      const nebulaIds = effect.options?.nebulaIds || [];
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择 1 个星云`;
      renderStateReadout();
      return openScanTargetPicker({
        type: "sector_scan",
        fromEffectFlow: true,
        title: effect.label,
        subtitle: "按槽位顺序替换未替换的数据；无可替换数据时追加扫描计数且不获得数据。",
        choices: expandScanChoicesWithAomomoTargets(nebulaIds.map((nebulaId) => buildNebulaScanChoice(nebulaId))),
      });
    }

    function openAlienTraceRewardEffect(workingRoot, effect) {
      const traceType = effect.options?.traceType || null;
      const allowedTraceTypes = traceType
        ? [traceType]
        : (effect.options?.allowedTraceTypes?.length ? effect.options.allowedTraceTypes : aliens.TRACE_TYPES);
      const targetPlayer = resolvePlayerReference({
        playerId: effect.options?.targetPlayerId,
        playerColor: effect.options?.targetPlayerColor,
      }) || getEffectOwnerPlayer(effect) || getCurrentPlayer();
      const allowedAlienSlotIds = getEligibleAlienSlotIdsForTraceEffect(effect, targetPlayer, allowedTraceTypes);
      decisionState.alienTraceAction = {
        type: "planet_reward_alien_trace",
        beforeAlienState: structuredClone(ruleAlienGameState(workingRoot)),
        beforePlayerState: structuredClone(rulePlayerState(workingRoot)),
        effectLabel: effect.label,
        targetPlayerId: targetPlayer?.id || effect.options?.targetPlayerId || null,
        targetPlayerColor: targetPlayer?.color || effect.options?.targetPlayerColor || null,
        afterTraceReward: effect.options?.afterTraceReward || null,
      };
      const flow = alienTraceRewardFlow.resolveAlienTraceRewardFlow({
        effect,
        allowedTraceTypes,
        allowedAlienSlotIds,
        targetPlayer,
        openFangzhouChoice: () => openFangzhouTraceDestinationChoice({
          allowedTraceTypes,
          allowedAlienSlotIds,
          targetPlayerId: targetPlayer?.id || null,
          targetPlayerColor: targetPlayer?.color || null,
          label: effect.label,
        }),
        hasPanelPlacementTarget: () => hasAlienTracePanelPlacementTarget(
          allowedAlienSlotIds,
          allowedTraceTypes,
          targetPlayer,
        ),
        beginPanelPlacement: () => beginAlienTraceBoardPlacement({
          allowedTraceTypes,
          allowedAlienSlotIds,
          targetPlayerId: targetPlayer?.id || null,
          targetPlayerColor: targetPlayer?.color || null,
          label: effect.label,
        }),
        finishNoTarget: () => {
          const message = `${effect.label}：没有合法外星人痕迹位置，奖励落空`;
          decisionState.alienTraceAction = null;
          decisionState.alienTracePickerState = null;
          closeAlienTracePicker();
          return finishAutomaticRewardEffect(workingRoot, effect, {
            ok: true,
            skipped: true,
            undoable: true,
            message,
            payload: {
              traceType,
              allowedTraceTypes,
              allowedAlienSlotIds,
              alienTraceRewardLost: true,
            },
          });
        },
      });
      return flow.result;
    }

    function openAomomoCardRewardEffect(workingRoot, effect) {
      return openAomomoCardGainDialog({
        player: getEffectTargetPlayer(workingRoot, effect),
        fromEffectFlow: true,
        effectLabel: effect.label || "奥陌陌外星人牌",
        beforeAlienState: structuredClone(ruleAlienGameState(workingRoot)),
        beforePlayerState: structuredClone(rulePlayerState(workingRoot)),
      });
    }

    function executePlanetRewardEffect(workingRoot, effect) {
      switch (effect.type) {
        case planetRewards.EFFECT_TYPES.GAIN_RESOURCES:
          return executeGainResourcesRewardEffect(workingRoot, effect);
        case planetRewards.EFFECT_TYPES.GAIN_DATA:
          return executeGainDataRewardEffect(workingRoot, effect);
        case planetRewards.EFFECT_TYPES.LAUNCH:
          return executeLaunchRewardEffect(workingRoot, effect);
        case planetRewards.EFFECT_TYPES.DRAW_CARDS:
          return executeDrawCardsRewardEffect(workingRoot, effect);
        case planetRewards.EFFECT_TYPES.PICK_CARD:
          return openPickCardRewardEffect(workingRoot, effect);
        case planetRewards.EFFECT_TYPES.INCOME:
          return openIncomeRewardEffect(workingRoot, effect);
        case planetRewards.EFFECT_TYPES.SCAN_PLANET_SECTOR:
          return executeSectorScanAtPlanet(workingRoot, effect.options?.planetId, effect.label, effect);
        case planetRewards.EFFECT_TYPES.CHOOSE_NEBULA_SCAN:
        case planetRewards.EFFECT_TYPES.CHOOSE_COLORED_NEBULA_SCAN:
          return openNebulaChoiceRewardEffect(workingRoot, effect);
        case planetRewards.EFFECT_TYPES.ALIEN_TRACE:
          return openAlienTraceRewardEffect(workingRoot, effect);
        case planetRewards.EFFECT_TYPES.AOMOMO_CARD:
          return openAomomoCardRewardEffect(workingRoot, effect);
        default:
          return null;
      }
    }

    function executeResearchTechEffect(workingRoot, effect) {
      if (!effect) return null;

      switch (effect.type) {
        case "research_tech_select":
          ruleRocketState(workingRoot).statusNote = "科技：请选择要研究的科技片";
          renderStateReadout();
          return { ok: true, message: ruleRocketState(workingRoot).statusNote };
        case "research_tech_take": {
          beginEffectHistoryStep(effect.label, { effectType: "research_tech_take" });
          const result = abilities.executeAbility("researchTechTake", createActionContext(), effect.options || {});
          if (!result.ok) {
            endEffectHistoryStep();
            ruleRocketState(workingRoot).statusNote = result.message;
            renderStateReadout();
            return result;
          }
          if (!shouldSkipCurrentResearchTechCost()) {
            maybeConsumeAlienLabPanelForMainAction("researchTech", result);
          }
          recordAbilityCommands(result);
          if (result.firstTake) {
            const claim = claimRunezuSourceSymbolWithHistory(
              "tech",
              result.tileId,
              getCurrentPlayer(),
              "研究科技获得符文族symbol",
            );
            if (claim?.ok) result.message = `${result.message}；${claim.message}`;
          }
          effect.result = result;
          ruleRocketState(workingRoot).statusNote = result.message;
          onTechTileTaken(result);
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return result;
        }
        case "research_tech_rotate": {
          const result = abilities.executeAbility("researchTechRotate", createActionContext());
          if (!result.ok) {
            ruleRocketState(workingRoot).statusNote = result.message;
            renderStateReadout();
            return result;
          }
          effect.result = result;
          ruleRocketState(workingRoot).statusNote = result.message;
          renderWheels();
          renderSectorNebulaDataBoard();
          renderRunezuBoardSymbols();
          renderRockets();
          renderRotateStateToken();
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return result;
        }
        case "research_tech_bonus": {
          const selection = getResearchTechSelectionPayload();
          const bonusId = effect.options?.bonusId || selection?.bonusId;
          const bonusEffect = tech.BONUS_EFFECTS[bonusId];
          if (bonusEffect?.cardSelection) {
            return openTechBonusPickCardEffect(workingRoot, effect);
          }
          const result = abilities.executeAbility("researchTechBonus", createActionContext(), {
            bonusId,
            firstTake: Boolean(effect.options?.firstTake ?? selection?.firstTake),
          });
          recordTechBonusScore(getCurrentPlayer(), result);
          if (result.ok) {
            result.events = [
              ...(result.events || []),
              {
                type: "researchTech",
                playerId: getCurrentPlayer()?.id || null,
                playerColor: getCurrentPlayer()?.color || null,
                techType: selection?.techType || null,
                tileId: selection?.tileId || null,
                source: decisionState.actionEffectFlow?.actionType || "tech",
              },
            ];
          }
          effect.result = result;
          ruleRocketState(workingRoot).statusNote = result.message;
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return result;
        }
        default:
          return null;
      }
    }

    function executeActionEffectForOwner(workingRoot, effect) {
      if (!effect || effect.status !== "active") return { ok: false, message: "当前效果不可执行" };

      const techResult = executeResearchTechEffect(workingRoot, effect);
      if (techResult) return techResult;

      const cardResult = executeCardEffect(workingRoot, effect);
      if (cardResult) return cardResult;

      const rewardResult = planetRewards?.EFFECT_TYPES ? executePlanetRewardEffect(workingRoot, effect) : null;
      if (rewardResult) return rewardResult;

      if (banrenma && effect.type === banrenma.EFFECT_GAIN_INCOME) {
        return executeBanrenmaGainIncomeEffect(workingRoot, effect);
      }

      if (jiuzhe && effect.type === JIUZHE_THRESHOLD_CARD_EFFECT_TYPE) {
        return executeJiuzheThresholdCardEffect(effect);
      }

      if (banrenma && effect.type === BANRENMA_PANEL_BONUS_EFFECT_TYPE) {
        return executeBanrenmaPanelBonusEffect(effect);
      }

      switch (effect.type) {
        case "pass_hand_limit":
          return executePassHandLimitEffect(effect);
        case "pass_first_rotate":
          return executePassFirstRotateEffect(effect);
        case "pass_reserve_pick":
          return beginPassReserveSelection(effect);
        case "industry_huanyu_superdrive_launch":
          return executeHuanyuSuperdrivePassLaunchEffect(workingRoot, effect);
        case "industry_stratus_corner":
          return executeIndustryStratusCornerEffect(effect);
        case "industry_sentinel_corner":
          return executeIndustrySentinelCornerEffect(effect);
        case "industry_helios_passive_reward":
          return executeIndustryHeliosPassiveRewardEffect(effect);
        case "industry_strategy_passive_reward":
          return executeIndustryStrategyPassiveRewardEffect(effect);
        case "industry_fundamentalism_exchange":
          return executeIndustryFundamentalismExchangeEffect(workingRoot, effect);
        case "industry_pirates_raid_marker":
          return executeIndustryPiratesRaidMarkerEffect(effect);
        case "industry_pirates_raid_publicity":
          return executeIndustryPiratesRaidPublicityEffect(effect);
        case "industry_pirates_raid_launch":
          return executeIndustryPiratesRaidLaunchEffect(effect);
        case "fangzhou_launch": {
          beginEffectHistoryStep(effect.label);
          const result = abilities.executeAbility("launchProbe", createActionContext(), {
            skipCost: true,
            source: "fangzhou",
            ignoreRocketLimit: true,
          });
          if (!result.ok) {
            endEffectHistoryStep();
            return skipActionEffectWithMessage(
              effect,
              `${effect.label || "方舟发射"}：${result.message || "无法发射"}，已跳过`,
              { reason: result.message || null, abilityId: result.abilityId || "launchProbe" },
            );
          }
          maybeApplyIndustryLaunchScan(result);
          recordAbilityCommands(result);
          effect.result = result;
          ruleRocketState(workingRoot).statusNote = result.message;
          renderRockets();
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return result;
        }
        case "fangzhou_additional_public_scan": {
          const currentPlayer = getEffectOwnerPlayer(workingRoot, effect);
          if (!currentPlayer) {
            ruleRocketState(workingRoot).statusNote = "方舟公共扫描标记缺少目标玩家";
            renderStateReadout();
            return { ok: false, message: ruleRocketState(workingRoot).statusNote };
          }
          const count = Math.max(0, Math.round(Number(effect.options?.count) || 1));
          const beforePlayer = structuredClone(currentPlayer);
          beginEffectHistoryStep(effect.label);
          currentPlayer.resources.additionalPublicScan = Math.min(
            2,
            (Number(currentPlayer.resources.additionalPublicScan) || 0) + count,
          );
          recordHistoryCommand(historyCommands.createRestorePlayerCommand(
            currentPlayer,
            beforePlayer,
            "恢复方舟公共扫描标记前玩家状态",
          ));
          effect.result = {
            ok: true,
            undoable: true,
            message: `公共弃牌扫描 +${count}`,
          };
          ruleRocketState(workingRoot).statusNote = effect.result.message;
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return effect.result;
        }
        case "initial_income":
          return openInitialIncomeEffect(workingRoot, effect);
        case "industry_fundamentalism_income":
          return openFundamentalismRoundStartIncomeEffect(workingRoot, effect);
        case scanEffects.EFFECT_TYPES.PAY_SCAN_COST: {
          beginEffectHistoryStep(effect.label);
          const result = abilities.executeAbility("payScanCost", createActionContext(), {
            cost: effect.options?.cost || scanEffects.SCAN_COST,
          });
          if (!result.ok) {
            endEffectHistoryStep();
            ruleRocketState(workingRoot).statusNote = result.message;
            renderStateReadout();
            return result;
          }
          if (effect.options?.standardAction !== false) {
            maybeConsumeAlienLabPanelForMainAction("scan", result);
          }
          recordAbilityCommands(result);
          effect.result = result;
          ruleRocketState(workingRoot).statusNote = result.message;
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return result;
        }
        case scanEffects.EFFECT_TYPES.EARTH_SECTOR_SCAN:
          return executeSectorScanAtPlanet(workingRoot, "earth", effect.label, effect);
        case scanEffects.EFFECT_TYPES.IMPROVED_SECTOR_SCAN:
          return executeImprovedEarthSectorScanEffect(workingRoot);
        case scanEffects.EFFECT_TYPES.MERCURY_SECTOR_SCAN:
          return executeSectorScanAtPlanet(workingRoot, "mercury", effect.label, effect);
        case scanEffects.EFFECT_TYPES.PUBLIC_CARD_SCAN: {
          const scanPlayer = getCurrentPlayer(workingRoot);
          const hasCandidate = (ruleCardState(workingRoot).publicCards || []).some((card) => (
            card && (getPublicScanChoicesForCard(card)?.choices || []).length > 0
          ));
          if (!hasCandidate) {
            return skipActionEffectWithMessage(
              effect,
              `${effect.label || "公共牌区扫描"}：公共牌区为空，已跳过`,
              { reason: "no_public_scan_candidate" },
            );
          }
          const scanRunId = effect.options?.scanRunId || null;
          const deferPublicRefill = Boolean(scanRunId && effect.options?.fullScanAction);
          const maxSelectable = getPublicScanMaxSelectable(scanPlayer);
          ruleRocketState(workingRoot).statusNote = maxSelectable > 1
            ? `公共牌区扫描：最多选择 ${maxSelectable} 张公共牌`
            : "公共牌区扫描：请选择一张公共牌";
          renderStateReadout();
          return beginCardSelection(createPublicScanPendingAction(scanPlayer, true, {
            scanRunId,
            deferPublicRefill,
          }));
        }
        case scanEffects.EFFECT_TYPES.HAND_SCAN: {
          const currentPlayer = getCurrentPlayer(workingRoot);
          if (!currentPlayer?.hand?.length) {
            effect.result = { ok: true, skipped: true, message: `${effect.label || "手牌扫描"}：没有手牌，跳过` };
            ruleRocketState(workingRoot).statusNote = effect.result.message;
            completeCurrentActionEffect("skipped");
            renderStateReadout();
            return effect.result;
          }
          if (!hasHandScanTargetCard(currentPlayer)) {
            effect.result = { ok: true, skipped: true, message: `${effect.label || "手牌扫描"}：没有可扫描角标的手牌，跳过` };
            ruleRocketState(workingRoot).statusNote = effect.result.message;
            completeCurrentActionEffect("skipped");
            renderStateReadout();
            return effect.result;
          }
          decisionState.handScanAction = { type: "hand_scan", player: currentPlayer, fromEffectFlow: true };
          ruleRocketState(workingRoot).statusNote = "手牌扫描：请选择一张手牌弃除并扫描";
          syncHandScanSelectionChrome();
          updateActionButtons();
          renderStateReadout();
          return { ok: true, message: ruleRocketState(workingRoot).statusNote };
        }
        case scanEffects.EFFECT_TYPES.SCAN_ACTION_4:
          return openScanAction4Picker();
        case scanEffects.EFFECT_TYPES.SCAN_ACTION_FINALIZE:
          return executeScanActionFinalizeEffect(effect);
        case scanEffects.EFFECT_TYPES.SECTOR_FINISH_SCAN:
          return executeSectorFinishScanEffect(effect);
        case scanEffects.EFFECT_TYPES.SCAN_PUBLIC_REFILL:
          return executeScanPublicRefillEffect(effect);
        default:
          return { ok: false, message: `未知效果类型: ${effect.type}` };
      }
    }

    return {
      executeCardEffect,
      openPickCardRewardEffect,
      openTechBonusPickCardEffect,
      openInitialIncomeEffect,
      openCardIncomeEffect,
      openFundamentalismRoundStartIncomeEffect,
      openIncomeRewardEffect,
      executeBanrenmaGainIncomeEffect,
      openNebulaChoiceRewardEffect,
      openAlienTraceRewardEffect,
      openAomomoCardRewardEffect,
      executePlanetRewardEffect,
      executeResearchTechEffect,
      executeActionEffectForOwner,
    };
  }

  return { createEffectDispatcher };
});
