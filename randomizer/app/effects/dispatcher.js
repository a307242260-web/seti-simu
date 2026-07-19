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
      alienGameState,
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
      cardState,
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
      pendingState,
      planetRewards,
      playerState,
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
      rocketState,
      runezu,
      scanEffects,
      shouldSkipCurrentResearchTechCost,
      skipActionEffectWithMessage,
      syncHandScanSelectionChrome,
      tech,
      turnState,
      updateActionButtons,
    } = context;

    function executeCardEffect(effect) {
      const types = cardEffects.EFFECT_TYPES;
      switch (effect.type) {
        case types.SCAN_NEBULA:
          return executeCardFixedNebulaScanEffect(effect);
        case types.SCAN_COLOR_CHOICE:
        case "card_color_scan":
          return openCardColorScanEffect(effect);
        case types.PUBLIC_SCAN:
          return openCardPublicScanEffect(effect);
        case types.ANY_SECTOR_SCAN:
          return openCardAnySectorScanEffect(effect);
        case types.SCAN_ACTION:
          return expandCardScanActionEffect(effect);
        case types.RESEARCH_TECH:
          return executeCardResearchTechEffect(effect);
        case types.CARD_ORBIT:
          return executeCardOrbitEffect(effect);
        case types.CARD_LAND:
          return executeCardLandEffect(effect);
        case types.REMOVE_PLANET_MARKER:
          return openRemovePlanetMarkerPicker(effect);
        case types.PROBE_SECTOR_SCAN:
          return executeProbeSectorScanEffect(effect);
        case types.PLANET_SECTOR_SCAN:
          return executePlanetSectorScanEffect(effect);
        case types.SECTOR_X_SCAN:
          return executeSectorXScanEffect(effect);
        case types.INCOME:
          return openCardIncomeEffect(effect);
        case types.REGISTER_EVENT_BONUS:
          return executeRegisterEventBonusEffect(effect);
        case types.COUNT_HAND_INCOME_RESOURCE:
          return executeCountHandIncomeResourceEffect(effect);
        case types.COUNT_CURRENT_INCOME_RESOURCE:
          return executeCountCurrentIncomeResourceEffect(effect);
        case types.COUNT_ALIENS_RESOURCE:
          return executeCountAliensResourceEffect(effect);
        case types.TUCK_PLAYED_CARD_TO_INCOME:
          return executeTuckPlayedCardToIncomeEffect(effect);
        case types.PICK_CARD_CORNER_REWARD:
          return executePickCardCornerRewardEffect(effect);
        case types.FREE_MOVE:
        case types.CARD_MOVE:
          return beginCardMoveEffect(effect);
        case types.DRAW_THEN_SCAN:
          return openCardDrawThenScanEffect(effect);
        case types.DRAW_THEN_DISCARD_ACTION:
          return executeCardDrawThenDiscardActionEffect(effect);
        case types.CONDITIONAL_REWARD:
          return executeConditionalRewardEffect(effect);
        case types.OPTIONAL_DISCARD_SCAN:
          return executeOptionalDiscardScanEffect(effect);
        case types.HAND_SCAN:
          return executeHandScanEffect(effect);
        case types.COUNT_HAND_CORNER_MOVE:
          return executeCountHandCornerMoveEffect(effect);
        case types.CHOOSE_HAND_CORNER_REWARD:
          return executeChooseHandCornerRewardEffect(effect);
        case types.DISCARD_PUBLIC_CORNER_REWARDS:
          return executeDiscardPublicCornerRewardsEffect(effect);
        case types.RETURN_PLAYED_CARD_TO_HAND_IF:
          return executeReturnPlayedCardToHandIfEffect(effect);
        case types.LANDING_SECTOR_SCAN:
          return executeLandingSectorScanEffect(effect);
        case types.CONDITIONAL_SECTOR_SCAN:
          return executeConditionalSectorScanEffect(effect);
        case types.DISCARD_ANY_FOR_INCOME:
          return executeDiscardAnyForIncomeEffect(effect);
        case types.PAY_CREDITS_FOR_REWARD:
          return executePayCreditsForRewardEffect(effect);
        case types.DISCARD_CARD_CORNER_REPEAT:
          return executeDiscardCardCornerRepeatEffect(effect);
        case types.REMOVE_ORBIT_TO_PROBE:
          return executeRemoveOrbitToProbeEffect(effect);
        case types.RETURN_UNFINISHED_TASK_TO_HAND:
          return executeReturnUnfinishedTaskToHandEffect(effect);
        case types.COUNT_TECH_TYPES_REWARD:
          return executeCountTechTypesRewardEffect(effect);
        case types.COUNT_OWNED_TECH_REWARD:
          return executeCountOwnedTechRewardEffect(effect);
        case types.COUNT_ROCKETS_REWARD:
          return executeCountRocketsRewardEffect(effect);
        case types.DISCARD_ALL_HAND:
          return executeDiscardAllHandEffect(effect);
        case types.PROBE_STACK_REWARD:
          return executeProbeStackRewardEffect(effect);
        case types.PROBE_LOCATION_REWARD:
          return executeProbeLocationRewardEffect(effect);
        case types.EARTH_SECTOR_CONTENT_MOVE:
          return executeEarthSectorContentMoveEffect(effect);
        case types.PLUTO_RESERVE:
          return executePlutoReserveEffect(effect);
        case types.YICHANGDIAN_NEXT_ANOMALY_REWARD:
          return executeYichangdianNextAnomalyRewardEffect(effect);
        case types.YICHANGDIAN_ANOMALY_SIGNAL_SCORE:
          return executeYichangdianAnomalySignalScoreEffect(effect);
        case types.YICHANGDIAN_ALIEN_TRACE:
          return executeYichangdianAlienTraceEffect(effect);
        case types.YICHANGDIAN_PUBLIC_ALL:
          return executeYichangdianPublicAllEffect(effect);
        case types.YICHANGDIAN_DRAW_THEN_TWO_CORNERS:
          return executeYichangdianDrawThenTwoCornersEffect(effect);
        case types.YICHANGDIAN_NEXT_ANOMALY_SCAN:
          return executeYichangdianNextAnomalyScanEffect(effect);
        case types.YICHANGDIAN_LAUNCH_ANOMALY_MOVE:
          return executeYichangdianLaunchAnomalyMoveEffect(effect);
        case chong?.EFFECT_TYPES?.CHONG_LAND_FOR_PICKUP:
        case chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP:
          return executeChongTravelForPickupEffect(effect);
        case chong?.EFFECT_TYPES?.CHONG_PICKUP_FOSSIL:
          return executeChongPickupFossilEffect(effect);
        case chong?.EFFECT_TYPES?.CHONG_PROBE_PLANET_FOSSIL_REWARD:
          return executeChongProbePlanetFossilRewardEffect(effect);
        case chong?.EFFECT_TYPES?.CHONG_CHOOSE_PLANET_FOSSIL_REWARD:
          return executeChongChoosePlanetFossilRewardEffect(effect);
        case chong?.EFFECT_TYPES?.CHONG_TASK_CLEANUP:
          return executeChongTaskCleanupEffect(effect);
        case amiba?.EFFECT_TYPES?.CHOOSE_SYMBOL_REWARD:
          return openAmibaSymbolChoiceDialog({
            effect,
            region: effect.options?.region,
            player: getCurrentPlayer(),
            fromEffectFlow: true,
            beforeAlienState: structuredClone(alienGameState),
            beforePlayerState: structuredClone(playerState),
            beforeCardState: structuredClone(cardState),
          });
        case amiba?.EFFECT_TYPES?.REMOVE_TRACE_FOR_REGION_REWARD:
          return openAmibaTraceRemovalDialog(effect);
        case runezu?.EFFECT_TYPES?.SYMBOL_REWARD:
          return executeRunezuSymbolRewardEffect(effect);
        case runezu?.EFFECT_TYPES?.SYMBOL_BRANCH:
          return openRunezuSymbolBranchDialog(effect);
        case aomomo?.EFFECT_GAIN_FOSSILS:
          return executeAomomoGainFossilsEffect(effect);
        case aomomo?.EFFECT_VISIT_AOMOMO_THIS_TURN_FOSSIL:
          return executeAomomoVisitThisTurnFossilEffect(effect);
        case aomomo?.EFFECT_SCAN_AOMOMO_X:
        case aomomo?.EFFECT_SCAN_AOMOMO_X_GAIN_FOSSIL:
        case aomomo?.EFFECT_SCAN_AOMOMO_X_SCORE:
          return openAomomoCurrentXScanEffect(effect);
        case aomomo?.EFFECT_LAND_SCORE_IF_AOMOMO:
          return executeAomomoLandEffect(effect);
        case aomomo?.EFFECT_FOSSIL_FOR_DATA:
          return executeAomomoFossilForDataEffect(effect);
        case aomomo?.EFFECT_FOSSIL_FOR_MOVE_AND_LAND:
          return executeAomomoFossilMoveAndLandEffect(effect);
        case aomomo?.EFFECT_FOSSIL_FOR_ANY_SCAN:
          return openAomomoFossilAnyScanEffect(effect);
        case aomomo?.EFFECT_SPEND_FOSSILS_GAIN_SCORE:
          return executeAomomoSpendFossilsScoreEffect(effect);
        case "aomomo_land_only":
          return executeAomomoLandEffect(effect);
        default:
          return null;
      }
    }

    function openPickCardRewardEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      pendingState.cardSelectionAction = null;
      const result = beginCardSelection({
        type: "planet_reward_pick_card",
        player: currentPlayer,
        effectLabel: effect.label,
        allowBlindDraw: true,
      });
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderStateReadout();
      }
      return result;
    }

    function openTechBonusPickCardEffect(effect) {
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
        rocketState.statusNote = result.message;
        renderStateReadout();
      }
      return result;
    }

    function openInitialIncomeEffect(effect) {
      const playerId = effect?.options?.playerId;
      const incomePlayer = getPlayerById(playerId) || getCurrentPlayer();

      if (incomePlayer?.id) {
        playerState.currentPlayerId = incomePlayer.id;
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
        rocketState.statusNote = result.message;
        renderStateReadout();
        effect.result = { ok: false, undoable: false, message: result.message };
        completeCurrentActionEffect("skipped");
      }
      return result;
    }

    function openCardIncomeEffect(effect) {
      const incomePlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
      const result = beginDiscardSelection(1, {
        type: "card_income",
        player: incomePlayer,
        fromEffectFlow: true,
        effectLabel: effect.label,
        beforePlayerState: structuredClone(incomePlayer),
        beforeCardState: structuredClone(cardState),
      });
      if (!result.ok) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          undoable: true,
          message: `${effect.label}：没有手牌可作为收入，已跳过`,
          payload: { reason: result.message || null },
        });
      }
      return result;
    }

    function openFundamentalismRoundStartIncomeEffect(effect) {
      const incomePlayer = getEffectOwnerPlayer(effect);
      const round = Math.max(1, Math.round(Number(effect?.options?.roundNumber || turnState.roundNumber) || 1));
      if (!incomePlayer?.hand?.length) {
        if (incomePlayer) incomePlayer.industryFundamentalismRoundStartIncomeRound = round;
        return finishAutomaticRewardEffect(effect, {
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
        beforeCardState: structuredClone(cardState),
        roundNumber: round,
      });
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderStateReadout();
        effect.result = { ok: false, undoable: true, message: result.message };
        completeCurrentActionEffect("skipped");
      }
      return result;
    }

    function openIncomeRewardEffect(effect) {
      const currentPlayer = getEffectTargetPlayer(effect);
      if (!currentPlayer?.hand?.length) {
        effect.result = {
          ok: true,
          undoable: true,
          skipped: true,
          message: `${effect.label}：${currentPlayer?.colorLabel || currentPlayer?.name || "玩家"}没有手牌可用于收入，跳过`,
        };
        rocketState.statusNote = effect.result.message;
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
        beforeCardState: structuredClone(cardState),
        effectLabel: effect.label,
      });
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderStateReadout();
      }
      return result;
    }

    function executeBanrenmaGainIncomeEffect(effect) {
      const currentPlayer = getEffectTargetPlayer(effect);
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
      rocketState.statusNote = effect.result.message;
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function openNebulaChoiceRewardEffect(effect) {
      const nebulaIds = effect.options?.nebulaIds || [];
      rocketState.statusNote = `${effect.label}：请选择 1 个星云`;
      renderStateReadout();
      return openScanTargetPicker({
        type: "sector_scan",
        fromEffectFlow: true,
        title: effect.label,
        subtitle: "按槽位顺序替换未替换的数据；无可替换数据时追加扫描计数且不获得数据。",
        choices: expandScanChoicesWithAomomoTargets(nebulaIds.map((nebulaId) => buildNebulaScanChoice(nebulaId))),
      });
    }

    function openAlienTraceRewardEffect(effect) {
      const traceType = effect.options?.traceType || null;
      const allowedTraceTypes = traceType
        ? [traceType]
        : (effect.options?.allowedTraceTypes?.length ? effect.options.allowedTraceTypes : aliens.TRACE_TYPES);
      const targetPlayer = resolvePlayerReference({
        playerId: effect.options?.targetPlayerId,
        playerColor: effect.options?.targetPlayerColor,
      }) || getEffectOwnerPlayer(effect) || getCurrentPlayer();
      const allowedAlienSlotIds = getEligibleAlienSlotIdsForTraceEffect(effect, targetPlayer, allowedTraceTypes);
      pendingState.alienTraceAction = {
        type: "planet_reward_alien_trace",
        beforeAlienState: structuredClone(alienGameState),
        beforePlayerState: structuredClone(playerState),
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
          pendingState.alienTraceAction = null;
          pendingState.alienTracePickerState = null;
          closeAlienTracePicker();
          return finishAutomaticRewardEffect(effect, {
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

    function openAomomoCardRewardEffect(effect) {
      return openAomomoCardGainDialog({
        player: getEffectTargetPlayer(effect),
        fromEffectFlow: true,
        effectLabel: effect.label || "奥陌陌外星人牌",
        beforeAlienState: structuredClone(alienGameState),
        beforePlayerState: structuredClone(playerState),
      });
    }

    function executePlanetRewardEffect(effect) {
      switch (effect.type) {
        case planetRewards.EFFECT_TYPES.GAIN_RESOURCES:
          return executeGainResourcesRewardEffect(effect);
        case planetRewards.EFFECT_TYPES.GAIN_DATA:
          return executeGainDataRewardEffect(effect);
        case planetRewards.EFFECT_TYPES.LAUNCH:
          return executeLaunchRewardEffect(effect);
        case planetRewards.EFFECT_TYPES.DRAW_CARDS:
          return executeDrawCardsRewardEffect(effect);
        case planetRewards.EFFECT_TYPES.PICK_CARD:
          return openPickCardRewardEffect(effect);
        case planetRewards.EFFECT_TYPES.INCOME:
          return openIncomeRewardEffect(effect);
        case planetRewards.EFFECT_TYPES.SCAN_PLANET_SECTOR:
          return executeSectorScanAtPlanet(effect.options?.planetId, effect.label, effect);
        case planetRewards.EFFECT_TYPES.CHOOSE_NEBULA_SCAN:
        case planetRewards.EFFECT_TYPES.CHOOSE_COLORED_NEBULA_SCAN:
          return openNebulaChoiceRewardEffect(effect);
        case planetRewards.EFFECT_TYPES.ALIEN_TRACE:
          return openAlienTraceRewardEffect(effect);
        case planetRewards.EFFECT_TYPES.AOMOMO_CARD:
          return openAomomoCardRewardEffect(effect);
        default:
          return null;
      }
    }

    function executeResearchTechEffect(effect) {
      if (!effect) return null;

      switch (effect.type) {
        case "research_tech_select":
          rocketState.statusNote = "科技：请选择要研究的科技片";
          renderStateReadout();
          return { ok: true, message: rocketState.statusNote };
        case "research_tech_take": {
          beginEffectHistoryStep(effect.label, { effectType: "research_tech_take" });
          const result = abilities.executeAbility("researchTechTake", createActionContext(), effect.options || {});
          if (!result.ok) {
            endEffectHistoryStep();
            rocketState.statusNote = result.message;
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
          rocketState.statusNote = result.message;
          onTechTileTaken(result);
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return result;
        }
        case "research_tech_rotate": {
          const result = abilities.executeAbility("researchTechRotate", createActionContext());
          if (!result.ok) {
            rocketState.statusNote = result.message;
            renderStateReadout();
            return result;
          }
          effect.result = result;
          rocketState.statusNote = result.message;
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
            return openTechBonusPickCardEffect(effect);
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
                source: pendingState.actionEffectFlow?.actionType || "tech",
              },
            ];
          }
          effect.result = result;
          rocketState.statusNote = result.message;
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return result;
        }
        default:
          return null;
      }
    }

    function executeActionEffectForOwner(effect) {
      if (!effect || effect.status !== "active") return { ok: false, message: "当前效果不可执行" };

      const techResult = executeResearchTechEffect(effect);
      if (techResult) return techResult;

      const cardResult = executeCardEffect(effect);
      if (cardResult) return cardResult;

      const rewardResult = planetRewards?.EFFECT_TYPES ? executePlanetRewardEffect(effect) : null;
      if (rewardResult) return rewardResult;

      if (banrenma && effect.type === banrenma.EFFECT_GAIN_INCOME) {
        return executeBanrenmaGainIncomeEffect(effect);
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
          return executeHuanyuSuperdrivePassLaunchEffect(effect);
        case "industry_stratus_corner":
          return executeIndustryStratusCornerEffect(effect);
        case "industry_sentinel_corner":
          return executeIndustrySentinelCornerEffect(effect);
        case "industry_helios_passive_reward":
          return executeIndustryHeliosPassiveRewardEffect(effect);
        case "industry_strategy_passive_reward":
          return executeIndustryStrategyPassiveRewardEffect(effect);
        case "industry_fundamentalism_exchange":
          return executeIndustryFundamentalismExchangeEffect(effect);
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
          rocketState.statusNote = result.message;
          renderRockets();
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return result;
        }
        case "fangzhou_additional_public_scan": {
          const currentPlayer = getEffectOwnerPlayer(effect);
          if (!currentPlayer) {
            rocketState.statusNote = "方舟公共扫描标记缺少目标玩家";
            renderStateReadout();
            return { ok: false, message: rocketState.statusNote };
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
          rocketState.statusNote = effect.result.message;
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return effect.result;
        }
        case "initial_income":
          return openInitialIncomeEffect(effect);
        case "industry_fundamentalism_income":
          return openFundamentalismRoundStartIncomeEffect(effect);
        case scanEffects.EFFECT_TYPES.PAY_SCAN_COST: {
          beginEffectHistoryStep(effect.label);
          const result = abilities.executeAbility("payScanCost", createActionContext(), {
            cost: effect.options?.cost || scanEffects.SCAN_COST,
          });
          if (!result.ok) {
            endEffectHistoryStep();
            rocketState.statusNote = result.message;
            renderStateReadout();
            return result;
          }
          if (effect.options?.standardAction !== false) {
            maybeConsumeAlienLabPanelForMainAction("scan", result);
          }
          recordAbilityCommands(result);
          effect.result = result;
          rocketState.statusNote = result.message;
          renderPlayerStats();
          completeCurrentActionEffect();
          renderStateReadout();
          return result;
        }
        case scanEffects.EFFECT_TYPES.EARTH_SECTOR_SCAN:
          return executeSectorScanAtPlanet("earth", effect.label, effect);
        case scanEffects.EFFECT_TYPES.IMPROVED_SECTOR_SCAN:
          return executeImprovedEarthSectorScanEffect();
        case scanEffects.EFFECT_TYPES.MERCURY_SECTOR_SCAN:
          return executeSectorScanAtPlanet("mercury", effect.label, effect);
        case scanEffects.EFFECT_TYPES.PUBLIC_CARD_SCAN: {
          const scanPlayer = getCurrentPlayer();
          const scanRunId = effect.options?.scanRunId || null;
          const deferPublicRefill = Boolean(scanRunId && effect.options?.fullScanAction);
          const maxSelectable = getPublicScanMaxSelectable(scanPlayer);
          rocketState.statusNote = maxSelectable > 1
            ? `公共牌区扫描：最多选择 ${maxSelectable} 张公共牌`
            : "公共牌区扫描：请选择一张公共牌";
          renderStateReadout();
          return beginCardSelection(createPublicScanPendingAction(scanPlayer, true, {
            scanRunId,
            deferPublicRefill,
          }));
        }
        case scanEffects.EFFECT_TYPES.HAND_SCAN: {
          const currentPlayer = getCurrentPlayer();
          if (!currentPlayer?.hand?.length) {
            effect.result = { ok: true, skipped: true, message: `${effect.label || "手牌扫描"}：没有手牌，跳过` };
            rocketState.statusNote = effect.result.message;
            completeCurrentActionEffect("skipped");
            renderStateReadout();
            return effect.result;
          }
          if (!hasHandScanTargetCard(currentPlayer)) {
            effect.result = { ok: true, skipped: true, message: `${effect.label || "手牌扫描"}：没有可扫描角标的手牌，跳过` };
            rocketState.statusNote = effect.result.message;
            completeCurrentActionEffect("skipped");
            renderStateReadout();
            return effect.result;
          }
          pendingState.handScanAction = { type: "hand_scan", player: currentPlayer, fromEffectFlow: true };
          rocketState.statusNote = "手牌扫描：请选择一张手牌弃除并扫描";
          syncHandScanSelectionChrome();
          updateActionButtons();
          renderStateReadout();
          return { ok: true, message: rocketState.statusNote };
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
