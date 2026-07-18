(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppAiAutomationRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createAutomationRuntime(context) {
    if (!context || typeof context !== "object") {
      throw new Error("createAutomationRuntime requires explicit app context");
    }
    const {
      activateNextActionEffect, ai, buildAiTurnActionCandidates, cardEffects, chooseInitialSelectionForAiPlayer, confirmAlienRevealNotice, executeActionEffect, executeAiTurnAction,
      getAiAutoBattlePendingState, getAiNextActionEffect, getAiResearchTechSelectionOptionsForEffect, getCurrentActionEffect, getCurrentPlayer, getEffectOwnerPlayer, getMovableTokensForPlayer, getPlayerLabelById,
      hasActivePendingSubFlow, isActionEffectFlowActive, isAiAutoBattlePlayer, isAiLandingEffect, isAiResearchTechEffectType, isGameEnded, isTechTilePickingActive, listAiEffectMoveCandidates,
      listAiResearchTechCandidates, playerState, recordAiAutoBattleBug, recordAiAutoBattleLog, runAiActionEffectMoveDecision, runAiAlienTraceDecision, runAiAlienUseDecision, runAiCardCornerFreeMoveDecision,
      runAiCardSelectionDecision, runAiCardTaskCompletionDecision, runAiCardTriggerDecision, runAiCardTriggerFreeMoveDecision, runAiDataPlacementDecision, runAiDiscardDecision, runAiFinalScoreMarkDecision, runAiHandScanDecision,
      runAiIndustryFreeMoveDecision, runAiLandTargetDecision, runAiMovePaymentDecision, runAiPassReserveDecision, runAiPlayCardSelectionDecision, runAiReadyBanrenmaOpportunityOpenDecision, runAiReadyCardTaskOpenDecision, runAiResearchTechSelectionDecision,
      runAiScanAction4Decision, runAiScanTargetDecision, runAiStrategyPassiveSlotChoiceDecision, runAiTurnActionDecision, selectExecutableAiResearchTechCandidate, skipCurrentActionEffect, state,
    } = context;

    function runAiActionEffectStep() {
      if (!state.pendingActionEffectFlow) return null;
      const effect = getCurrentActionEffect();
      const playerId = getEffectOwnerPlayer(effect)?.id || state.pendingActionEffectFlow.playerId || playerState.currentPlayerId;
      if (playerId && !isAiAutoBattlePlayer(playerId)) {
        return { ok: false, blocked: true, message: `${getPlayerLabelById(playerId)}需要人工处理效果` };
      }
      if (!effect) return null;
      if (effect.status && effect.status !== "active") {
        recordAiAutoBattleLog("effect", `AI 推进已${effect.status === "completed" ? "完成" : "处理"}效果：${effect.label || effect.type}`, {
          logPlayerId: playerId || null,
          effectId: effect.id || null,
          effectType: effect.type || null,
          effectStatus: effect.status,
        });
        activateNextActionEffect?.();
        return { ok: true, progressed: true, advancedCompletedEffect: true };
      }
      if (
        effect.type === cardEffects.EFFECT_TYPES.CARD_MOVE
        || effect.type === cardEffects.EFFECT_TYPES.FREE_MOVE
      ) {
        const nextEffect = getAiNextActionEffect();
        const effectPlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
        const movableTokens = effectPlayer?.id ? getMovableTokensForPlayer(effectPlayer.id) : [];
        if (!movableTokens.length) {
          if (effect.type === cardEffects.EFFECT_TYPES.CARD_MOVE && isAiLandingEffect(nextEffect)) {
            return { ok: false, blocked: true, message: `${effect.label || "卡牌移动"}：没有可移动的飞船完成后续登陆` };
          }
          const message = `${effect.label || "移动效果"}：没有可移动的飞船，已跳过`;
          recordAiAutoBattleLog("move-path-skip", `${getPlayerLabelById(playerId)}AI 跳过移动效果`, {
            effectId: effect.id || null,
            effectType: effect.type || null,
            playerId: effectPlayer?.id || null,
            message,
          });
          skipCurrentActionEffect?.();
          return { ok: true, progressed: true, skipped: true, message };
        }
      }
      if (effect.type === cardEffects.EFFECT_TYPES.CARD_MOVE) {
        const nextEffect = getAiNextActionEffect();
        const candidates = listAiEffectMoveCandidates({
          id: "cardMove",
          effect,
          poolRemaining: effect?.options?.movementPoints ?? 1,
          nextEffect,
        });
        if (!candidates.length) {
          if (isAiLandingEffect(nextEffect)) {
            return { ok: false, blocked: true, message: `${effect.label || "卡牌移动"}：没有可移动的飞船完成后续登陆` };
          }
          const message = `${effect.label || "卡牌移动"}：没有可用移动路径，已跳过`;
          recordAiAutoBattleLog("move-path-skip", `${getPlayerLabelById(playerId)}AI 跳过卡牌移动效果`, {
            effectId: effect.id || null,
            effectType: effect.type || null,
            message,
          });
          skipCurrentActionEffect?.();
          return { ok: true, progressed: true, skipped: true, message };
        }
      }
      if (isAiResearchTechEffectType(effect.type) && !isTechTilePickingActive()) {
        const effectPlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
        const selectionOptions = getAiResearchTechSelectionOptionsForEffect(effect);
        const candidates = listAiResearchTechCandidates(selectionOptions);
        const executable = selectExecutableAiResearchTechCandidate(
          candidates,
          candidates[0] || null,
          effectPlayer,
          selectionOptions,
        );
        if (!executable.candidate) {
          const message = `${effect.label || "科技行动"}：${executable.check?.message || "没有可研究科技候选"}，已跳过`;
          recordAiAutoBattleLog("tech-placement-skip", `${getPlayerLabelById(playerId)}AI 跳过科技行动效果`, {
            effectId: effect.id || null,
            effectType: effect.type || null,
            candidates,
            message,
          });
          skipCurrentActionEffect?.();
          return { ok: true, progressed: true, skipped: true, message };
        }
      }
      const researchTechResult = runAiResearchTechSelectionDecision(effect);
      if (researchTechResult) return researchTechResult;
      recordAiAutoBattleLog("effect", `AI 处理效果：${effect.label || effect.type}`, {
        logPlayerId: playerId || null,
        effectId: effect.id || null,
        effectType: effect.type || null,
      });
      const result = executeActionEffect(effect);
      if (
        result?.ok === false
        && (
          effect.type === cardEffects.EFFECT_TYPES.CARD_MOVE
          || effect.type === cardEffects.EFFECT_TYPES.FREE_MOVE
        )
      ) {
        skipCurrentActionEffect?.();
        return {
          ok: true,
          progressed: true,
          skipped: true,
          message: `${effect.label || "移动效果"}执行失败，已跳过：${result.message || "未知原因"}`,
        };
      }
      return result;
    }

    function hasAiPendingDecisionForCurrentEffect(pending = getAiAutoBattlePendingState()) {
      if (!pending) return false;
      return [
        "pendingScanTargetType",
        "pendingPublicScanQueue",
        "pendingHandScan",
        "pendingPassReserve",
        "pendingCardSelection",
        "pendingPlayCardSelection",
        "pendingMovePayment",
        "pendingCardTrigger",
        "pendingCardTriggerFreeMove",
        "pendingCardCornerFreeMove",
        "pendingCardTaskCompletion",
        "pendingStrategyPassiveSlotChoice",
        "pendingJiuzheCardPlay",
        "pendingYichangdianCardGain",
        "pendingYichangdianCornerAction",
        "pendingBanrenmaCardGain",
        "pendingBanrenmaOpportunity",
        "pendingChongTaskCompletion",
        "pendingChongCardGain",
        "pendingChongFossilChoice",
        "pendingAmibaCardGain",
        "pendingAmibaSymbolChoice",
        "pendingAmibaTraceRemoval",
        "pendingAomomoCardGain",
        "pendingRunezuCardGain",
        "pendingRunezuSymbolBranch",
        "pendingRunezuFaceSymbolPlacement",
        "pendingAlienTrace",
        "pendingLandTarget",
        "pendingScanAction4",
        "pendingDataPlacement",
        "pendingActionEffectCardMove",
        "pendingActionEffectFreeMove",
        "pendingIndustryAbility",
        "pendingIndustryFreeMove",
        "pendingIndustryHandSelection",
      ].some((key) => Boolean(pending[key]));
    }

    function recoverAiIdleActionEffectStep() {
      if (!isActionEffectFlowActive()) return null;
      const effect = getCurrentActionEffect();
      if (!effect || (effect.status && effect.status !== "active")) return null;
      const pending = getAiAutoBattlePendingState();
      if (hasAiPendingDecisionForCurrentEffect(pending)) return null;
      recordAiAutoBattleLog("effect-recovery", `AI 恢复推进效果：${effect.label || effect.type}`, {
        effectId: effect.id || null,
        effectType: effect.type || null,
        pending,
      });
      return runAiActionEffectStep();
    }

    function runAiNonTurnAutomationStep() {
      if (!ai?.policy) return { ok: false, blocked: true, message: "SetiAI 未加载" };
      if (isGameEnded()) return { ok: true, done: true, message: "游戏已结束" };

      if (state.pendingAlienRevealConfirmation) {
        return confirmAlienRevealNotice?.() || {
          ok: false,
          blocked: true,
          message: "AI 无法确认外星人揭示",
        };
      }

      const alienUseResult = runAiAlienUseDecision();
      if (alienUseResult) return alienUseResult;

      const alienTraceResult = runAiAlienTraceDecision();
      if (alienTraceResult) return alienTraceResult;

      if (!isActionEffectFlowActive()) {
        const earlyReadyBanrenmaResult = runAiReadyBanrenmaOpportunityOpenDecision();
        if (earlyReadyBanrenmaResult) return earlyReadyBanrenmaResult;
      }

      const initialResult = chooseInitialSelectionForAiPlayer();
      if (initialResult) return initialResult;

      const discardResult = runAiDiscardDecision();
      if (discardResult) return discardResult;

      const passReserveResult = runAiPassReserveDecision();
      if (passReserveResult) return passReserveResult;

      const finalScoreMarkResult = runAiFinalScoreMarkDecision();
      if (finalScoreMarkResult) return finalScoreMarkResult;

      const cardSelectionResult = runAiCardSelectionDecision();
      if (cardSelectionResult) return cardSelectionResult;

      if (!isActionEffectFlowActive()) {
        const techSelectionResult = runAiResearchTechSelectionDecision();
        if (techSelectionResult) return techSelectionResult;
      }

      const handScanResult = runAiHandScanDecision();
      if (handScanResult) return handScanResult;

      const playCardResult = runAiPlayCardSelectionDecision();
      if (playCardResult) return playCardResult;

      const movePaymentResult = runAiMovePaymentDecision();
      if (movePaymentResult) return movePaymentResult;

      const landTargetResult = runAiLandTargetDecision();
      if (landTargetResult) return landTargetResult;

      const dataPlacementResult = runAiDataPlacementDecision();
      if (dataPlacementResult) return dataPlacementResult;

      const scanTargetResult = runAiScanTargetDecision();
      if (scanTargetResult) return scanTargetResult;

      const strategyPassiveSlotResult = runAiStrategyPassiveSlotChoiceDecision();
      if (strategyPassiveSlotResult) return strategyPassiveSlotResult;

      const effectMoveResult = runAiActionEffectMoveDecision();
      if (effectMoveResult) return effectMoveResult;

      if (isActionEffectFlowActive() && !hasActivePendingSubFlow()) {
        const activeEffectResult = runAiActionEffectStep();
        if (activeEffectResult) return activeEffectResult;
      }

      const readyBanrenmaResult = runAiReadyBanrenmaOpportunityOpenDecision();
      if (readyBanrenmaResult) return readyBanrenmaResult;

      const cardTriggerResult = runAiCardTriggerDecision();
      if (cardTriggerResult) return cardTriggerResult;

      const cardTriggerMoveResult = runAiCardTriggerFreeMoveDecision();
      if (cardTriggerMoveResult) return cardTriggerMoveResult;

      const cardCornerMoveResult = runAiCardCornerFreeMoveDecision();
      if (cardCornerMoveResult) return cardCornerMoveResult;

      const industryFreeMoveResult = runAiIndustryFreeMoveDecision();
      if (industryFreeMoveResult) return industryFreeMoveResult;

      const scanAction4Result = runAiScanAction4Decision();
      if (scanAction4Result) return scanAction4Result;

      const readyCardTaskResult = runAiReadyCardTaskOpenDecision();
      if (readyCardTaskResult) return readyCardTaskResult;

      const cardTaskResult = runAiCardTaskCompletionDecision();
      if (cardTaskResult) return cardTaskResult;

      const effectResult = runAiActionEffectStep();
      if (effectResult) return effectResult;

      if (hasActivePendingSubFlow()) {
        return { ok: false, blocked: true, message: "AI 遇到尚未收口的 pending 流程" };
      }

      return { ok: true, idle: true, message: "已推进到顶层决策点" };
    }

    function resolveAiAutomationToTurnBoundary(options = {}) {
      const maxSteps = Math.max(1, Math.round(Number(options.maxSteps) || 500));
      const steps = [];
      for (let index = 0; index < maxSteps; index += 1) {
        const result = runAiNonTurnAutomationStep();
        if (result) steps.push(result);
        if (!result || result.idle || result.done || result.blocked || result.bug || result.ok === false) {
          return {
            ok: result ? result.ok !== false : true,
            steps,
            final: result || { ok: true, idle: true, message: "已推进到顶层决策点" },
          };
        }
      }
      return {
        ok: false,
        blocked: true,
        message: `推进到顶层决策点超过 ${maxSteps} 步仍未收敛`,
        steps,
      };
    }

    function matchesAiTurnActionSelector(candidate = {}, selector = {}) {
      if (!selector || typeof selector !== "object") return false;
      if (selector.id && candidate.id !== selector.id) return false;
      if (selector.tradeId && candidate.tradeId !== selector.tradeId) return false;
      if (selector.cardId && candidate.cardId !== selector.cardId) return false;
      if (selector.cardInstanceId && candidate.cardInstanceId !== selector.cardInstanceId) return false;
      if (selector.handIndex != null && Number(candidate.handIndex) !== Number(selector.handIndex)) return false;
      if (selector.blueSlot != null && Number(candidate.blueSlot) !== Number(selector.blueSlot)) return false;
      if (selector.target && JSON.stringify(candidate.target || null) !== JSON.stringify(selector.target)) return false;
      return true;
    }

    function runAiSelectedTurnAction(selector = {}, options = {}) {
      const currentPlayer = getCurrentPlayer();
      const buildResult = buildAiTurnActionCandidates(currentPlayer);
      if (!buildResult.ok) return buildResult;
      const candidates = buildResult.candidates || [];
      const action = Number.isInteger(selector?.candidateIndex)
        ? candidates[selector.candidateIndex] || null
        : candidates.find((candidate) => matchesAiTurnActionSelector(candidate, selector)) || null;
      if (!action) {
        return {
          ok: false,
          blocked: true,
          message: "未找到匹配的顶层行动候选",
          candidates,
        };
      }
      const actionResult = executeAiTurnAction(action, currentPlayer);
      if (actionResult?.ok === false || options.resolveToTurnBoundary === false) {
        return {
          ...actionResult,
          action,
          candidates,
        };
      }
      const resolution = resolveAiAutomationToTurnBoundary(options);
      return {
        ok: resolution.ok !== false,
        progressed: true,
        action,
        actionResult,
        resolution,
      };
    }

    function runAiAutomationStep() {
      try {
        const nonTurnResult = runAiNonTurnAutomationStep();
        if (nonTurnResult && !nonTurnResult.idle) return nonTurnResult;
        return runAiTurnActionDecision();
      } catch (error) {
        const entry = recordAiAutoBattleBug(error?.message || String(error), {
          stack: error?.stack || null,
        });
        return { ok: false, blocked: true, bug: entry, message: entry.message };
      }
    }

    return {
      runAiActionEffectStep,
      hasAiPendingDecisionForCurrentEffect,
      recoverAiIdleActionEffectStep,
      runAiNonTurnAutomationStep,
      resolveAiAutomationToTurnBoundary,
      matchesAiTurnActionSelector,
      runAiSelectedTurnAction,
      runAiAutomationStep,
    };
  }

  const REQUIRED_CONTEXT_KEYS = Object.freeze([
    "activateNextActionEffect", "ai", "buildAiTurnActionCandidates", "cardEffects", "chooseInitialSelectionForAiPlayer", "confirmAlienRevealNotice", "executeActionEffect", "executeAiTurnAction",
    "getAiAutoBattlePendingState", "getAiNextActionEffect", "getAiResearchTechSelectionOptionsForEffect", "getCurrentActionEffect", "getCurrentPlayer", "getEffectOwnerPlayer", "getMovableTokensForPlayer", "getPlayerLabelById",
    "hasActivePendingSubFlow", "isActionEffectFlowActive", "isAiAutoBattlePlayer", "isAiLandingEffect", "isAiResearchTechEffectType", "isGameEnded", "isTechTilePickingActive", "listAiEffectMoveCandidates",
    "listAiResearchTechCandidates", "playerState", "recordAiAutoBattleBug", "recordAiAutoBattleLog", "runAiActionEffectMoveDecision", "runAiAlienTraceDecision", "runAiAlienUseDecision", "runAiCardCornerFreeMoveDecision",
    "runAiCardSelectionDecision", "runAiCardTaskCompletionDecision", "runAiCardTriggerDecision", "runAiCardTriggerFreeMoveDecision", "runAiDataPlacementDecision", "runAiDiscardDecision", "runAiFinalScoreMarkDecision", "runAiHandScanDecision",
    "runAiIndustryFreeMoveDecision", "runAiLandTargetDecision", "runAiMovePaymentDecision", "runAiPassReserveDecision", "runAiPlayCardSelectionDecision", "runAiReadyBanrenmaOpportunityOpenDecision", "runAiReadyCardTaskOpenDecision", "runAiResearchTechSelectionDecision",
    "runAiScanAction4Decision", "runAiScanTargetDecision", "runAiStrategyPassiveSlotChoiceDecision", "runAiTurnActionDecision", "selectExecutableAiResearchTechCandidate", "skipCurrentActionEffect", "state",
  ]);

  return { createAutomationRuntime, REQUIRED_CONTEXT_KEYS };
});
